-- Checkout integrity hardening.
-- Keeps legacy columns when present, standardizes the order item snapshot and
-- creates order + items + payment in one service-role-only transaction.

alter table public.order_items
  add column if not exists unit_price numeric(12,2),
  add column if not exists subtotal numeric(12,2);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_items'
      and column_name = 'price'
  ) then
    execute '
      update public.order_items
      set unit_price = coalesce(unit_price, price),
          subtotal = coalesce(subtotal, price * quantity)
      where unit_price is null or subtotal is null
    ';

    execute 'alter table public.order_items alter column price drop not null';
  end if;
end $$;

update public.order_items
set unit_price = coalesce(unit_price, 0),
    subtotal = coalesce(subtotal, coalesce(unit_price, 0) * quantity)
where unit_price is null or subtotal is null;

alter table public.order_items
  alter column unit_price set default 0,
  alter column unit_price set not null,
  alter column subtotal set default 0,
  alter column subtotal set not null;

alter table public.payments
  drop constraint if exists payments_provider_check;

alter table public.payments
  add constraint payments_provider_check
  check (provider in ('MERCADOPAGO','BANK_TRANSFER','WHATSAPP','MOCK','NARANJAX'));

alter table public.payment_events
  drop constraint if exists payment_events_provider_check;

alter table public.payment_events
  add constraint payment_events_provider_check
  check (provider in ('MERCADOPAGO','BANK_TRANSFER','WHATSAPP','MOCK','NARANJAX'));

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'PENDING_PAYMENT',
      'PENDING_TRANSFER',
      'PENDING_ADMIN_APPROVAL',
      'COORDINATE',
      'PAID',
      'CONFIRMED',
      'PREPARING',
      'READY_FOR_PICKUP',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED'
    )
  );

-- Recover the human payment method/status stored in legacy raw snapshots.
update public.payments
set provider = case upper(coalesce(raw->>'method', raw->>'provider', ''))
  when 'BANK_TRANSFER' then 'BANK_TRANSFER'
  when 'WHATSAPP' then 'WHATSAPP'
  else provider
end
where provider = 'MOCK'
  and upper(coalesce(raw->>'method', raw->>'provider', '')) in ('BANK_TRANSFER', 'WHATSAPP');

update public.orders o
set status = case upper(coalesce(p.raw->>'requested_order_status', ''))
  when 'PENDING_TRANSFER' then 'PENDING_TRANSFER'
  when 'PENDING_ADMIN_APPROVAL' then 'PENDING_ADMIN_APPROVAL'
  when 'COORDINATE' then 'COORDINATE'
  else o.status
end,
updated_at = now()
from public.payments p
where p.order_id = o.id
  and o.status = 'PENDING_PAYMENT'
  and p.status = 'PENDING'
  and upper(coalesce(p.raw->>'requested_order_status', '')) in (
    'PENDING_TRANSFER',
    'PENDING_ADMIN_APPROVAL',
    'COORDINATE'
  );

do $$
begin
  if exists (
    select 1
    from public.payments
    where provider_session_id is not null
    group by provider_session_id
    having count(*) > 1
  ) then
    raise exception 'CHECKOUT_IDEMPOTENCY_DUPLICATES';
  end if;
end $$;

create unique index if not exists payments_provider_session_unique_idx
  on public.payments(provider_session_id)
  where provider_session_id is not null;

create index if not exists orders_pending_transfer_idx
  on public.orders(status, created_at desc)
  where status = 'PENDING_TRANSFER';

create index if not exists orders_coordinate_idx
  on public.orders(status, created_at desc)
  where status = 'COORDINATE';

create or replace function public.create_checkout_order(
  p_user_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_method text,
  p_shipping_cost numeric,
  p_subtotal numeric,
  p_total numeric,
  p_address_snapshot jsonb,
  p_notes text,
  p_order_status text,
  p_payment_provider text,
  p_idempotency_key text,
  p_payment_raw jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_payment_id uuid;
  v_existing record;
  v_item jsonb;
  v_product record;
  v_product_id uuid;
  v_quantity integer;
  v_requested_quantity integer;
  v_unit_price numeric(12,2);
  v_items_subtotal numeric(12,2) := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 120 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  select
    p.id as payment_id,
    p.order_id,
    p.provider,
    p.status as payment_status,
    o.status as order_status,
    o.user_id,
    o.customer_email
  into v_existing
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.provider_session_id = trim(p_idempotency_key)
  limit 1;

  if found then
    return jsonb_build_object(
      'created', false,
      'order_id', v_existing.order_id,
      'payment_id', v_existing.payment_id,
      'order_status', v_existing.order_status,
      'payment_status', v_existing.payment_status,
      'provider', v_existing.provider,
      'user_id', v_existing.user_id,
      'customer_email', v_existing.customer_email
    );
  end if;

  if p_shipping_method not in ('PICKUP', 'DELIVERY') then
    raise exception 'INVALID_SHIPPING_METHOD';
  end if;

  if p_order_status not in ('PENDING_PAYMENT', 'PENDING_TRANSFER', 'PENDING_ADMIN_APPROVAL', 'COORDINATE') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;

  if p_payment_provider not in ('MERCADOPAGO', 'BANK_TRANSFER', 'WHATSAPP', 'NARANJAX') then
    raise exception 'INVALID_PAYMENT_PROVIDER';
  end if;

  if p_subtotal < 0 or p_shipping_cost < 0 or p_total <= 0 or abs(p_total - (p_subtotal + p_shipping_cost)) > 0.01 then
    raise exception 'INVALID_ORDER_TOTAL';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_ORDER_ITEMS';
  end if;

  -- Lock and revalidate every catalog row immediately before the snapshot.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
      v_unit_price := (v_item->>'unit_price')::numeric;
    exception when others then
      raise exception 'INVALID_ORDER_ITEM';
    end;

    if v_quantity < 1 or v_quantity > 999 or v_unit_price <= 0 then
      raise exception 'INVALID_ORDER_ITEM';
    end if;

    select id, sku, name, price, stock, active
    into v_product
    from public.products
    where id = v_product_id
    for update;

    if not found or not v_product.active then
      raise exception 'PRODUCT_NOT_AVAILABLE:%', v_product_id;
    end if;

    select sum((candidate->>'quantity')::integer)
    into v_requested_quantity
    from jsonb_array_elements(p_items) candidate
    where candidate->>'product_id' = v_product_id::text;

    if v_product.stock < v_requested_quantity then
      raise exception 'INSUFFICIENT_STOCK:%:%', v_product_id, v_product.stock;
    end if;

    if abs(v_product.price - v_unit_price) > 0.01 then
      raise exception 'PRICE_CHANGED:%', v_product_id;
    end if;

    v_items_subtotal := v_items_subtotal + (v_unit_price * v_quantity);
  end loop;

  if abs(v_items_subtotal - p_subtotal) > 0.01 then
    raise exception 'INVALID_ITEMS_SUBTOTAL';
  end if;

  begin
    insert into public.orders (
      user_id,
      status,
      customer_name,
      customer_email,
      customer_phone,
      shipping_method,
      shipping_cost,
      subtotal,
      total,
      address_snapshot,
      notes
    ) values (
      p_user_id,
      p_order_status,
      trim(p_customer_name),
      lower(trim(p_customer_email)),
      trim(p_customer_phone),
      p_shipping_method,
      p_shipping_cost,
      p_subtotal,
      p_total,
      p_address_snapshot,
      nullif(trim(p_notes), '')
    ) returning id into v_order_id;

    for v_item in select value from jsonb_array_elements(p_items)
    loop
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
      v_unit_price := (v_item->>'unit_price')::numeric;

      select sku, name
      into v_product
      from public.products
      where id = v_product_id;

      insert into public.order_items (
        order_id,
        product_id,
        sku,
        name,
        image_url,
        quantity,
        unit_price,
        subtotal
      ) values (
        v_order_id,
        v_product_id,
        v_product.sku,
        v_product.name,
        coalesce(v_item->>'image_url', ''),
        v_quantity,
        v_unit_price,
        v_unit_price * v_quantity
      );
    end loop;

    insert into public.payments (
      order_id,
      provider,
      status,
      amount,
      currency,
      provider_session_id,
      raw
    ) values (
      v_order_id,
      p_payment_provider,
      'PENDING',
      p_total,
      'ars',
      trim(p_idempotency_key),
      coalesce(p_payment_raw, '{}'::jsonb)
    ) returning id into v_payment_id;

  exception when unique_violation then
    select
      p.id as payment_id,
      p.order_id,
      p.provider,
      p.status as payment_status,
      o.status as order_status,
      o.user_id,
      o.customer_email
    into v_existing
    from public.payments p
    join public.orders o on o.id = p.order_id
    where p.provider_session_id = trim(p_idempotency_key)
    limit 1;

    if not found then
      raise;
    end if;

    return jsonb_build_object(
      'created', false,
      'order_id', v_existing.order_id,
      'payment_id', v_existing.payment_id,
      'order_status', v_existing.order_status,
      'payment_status', v_existing.payment_status,
      'provider', v_existing.provider,
      'user_id', v_existing.user_id,
      'customer_email', v_existing.customer_email
    );
  end;

  return jsonb_build_object(
    'created', true,
    'order_id', v_order_id,
    'payment_id', v_payment_id,
    'order_status', p_order_status,
    'payment_status', 'PENDING',
    'provider', p_payment_provider,
    'user_id', p_user_id,
    'customer_email', lower(trim(p_customer_email))
  );
end;
$$;

revoke execute on function public.create_checkout_order(
  uuid, text, text, text, text, numeric, numeric, numeric, jsonb, text, text, text, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.create_checkout_order(
  uuid, text, text, text, text, numeric, numeric, numeric, jsonb, text, text, text, text, jsonb, jsonb
) to service_role;
