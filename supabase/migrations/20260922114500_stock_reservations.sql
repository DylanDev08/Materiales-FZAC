-- Temporary stock reservations for online payments.
-- Physical stock is only decremented after payment approval.
-- Mercado Pago checkouts reserve availability for 30 minutes.

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED')),
  expires_at timestamptz not null,
  released_at timestamptz,
  consumed_at timestamptz,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, product_id)
);

alter table public.stock_reservations enable row level security;

revoke all on table public.stock_reservations from public, anon, authenticated;
grant select, insert, update, delete on table public.stock_reservations to service_role;

create index if not exists stock_reservations_product_active_idx
  on public.stock_reservations(product_id, status, expires_at);

create index if not exists stock_reservations_order_idx
  on public.stock_reservations(order_id, status);

create or replace function public.get_product_available_stock(p_product_ids uuid[])
returns table (
  product_id uuid,
  physical_stock integer,
  reserved_stock integer,
  available_stock integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.stock,
    coalesce(r.reserved_stock, 0)::integer,
    greatest(p.stock - coalesce(r.reserved_stock, 0), 0)::integer
  from public.products p
  left join lateral (
    select sum(sr.quantity)::integer as reserved_stock
    from public.stock_reservations sr
    where sr.product_id = p.id
      and sr.status = 'ACTIVE'
      and sr.expires_at > now()
  ) r on true
  where p.id = any(coalesce(p_product_ids, '{}'::uuid[]));
$$;

revoke execute on function public.get_product_available_stock(uuid[]) from public;
grant execute on function public.get_product_available_stock(uuid[]) to anon, authenticated, service_role;

create or replace function public.release_order_stock_reservation(
  p_order_id uuid,
  p_reason text default 'RELEASED'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released integer := 0;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  update public.stock_reservations
  set status = case when expires_at <= now() then 'EXPIRED' else 'RELEASED' end,
      released_at = now(),
      release_reason = left(coalesce(nullif(btrim(p_reason), ''), 'RELEASED'), 120),
      updated_at = now()
  where order_id = p_order_id
    and status = 'ACTIVE';

  get diagnostics v_released = row_count;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'released', v_released
  );
end;
$$;

revoke execute on function public.release_order_stock_reservation(uuid, text) from public, anon, authenticated;
grant execute on function public.release_order_stock_reservation(uuid, text) to service_role;

create or replace function public.reserve_order_stock(
  p_order_id uuid,
  p_ttl_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_item record;
  v_reserved_by_others integer;
  v_available integer;
  v_expires_at timestamptz;
  v_ttl integer;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  v_ttl := greatest(5, least(coalesce(p_ttl_minutes, 30), 60));
  v_expires_at := now() + make_interval(mins => v_ttl);

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select * into v_payment
  from public.payments
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_order.status <> 'PENDING_PAYMENT' then
    raise exception 'ORDER_NOT_RESERVABLE';
  end if;

  if v_payment.provider <> 'MERCADOPAGO' then
    raise exception 'PAYMENT_PROVIDER_NOT_RESERVABLE';
  end if;

  update public.stock_reservations
  set status = 'EXPIRED',
      released_at = coalesce(released_at, now()),
      release_reason = coalesce(release_reason, 'TTL_EXPIRED'),
      updated_at = now()
  where status = 'ACTIVE'
    and expires_at <= now();

  perform 1
  from public.products p
  join public.order_items oi on oi.product_id = p.id
  where oi.order_id = p_order_id
  order by p.id
  for update of p;

  for v_item in
    select oi.product_id, oi.quantity, p.stock, p.active, p.name
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
    order by p.id
  loop
    if not v_item.active then
      raise exception 'PRODUCT_NOT_AVAILABLE:%', v_item.product_id;
    end if;

    select coalesce(sum(sr.quantity), 0)::integer
    into v_reserved_by_others
    from public.stock_reservations sr
    where sr.product_id = v_item.product_id
      and sr.order_id <> p_order_id
      and sr.status = 'ACTIVE'
      and sr.expires_at > now();

    v_available := greatest(v_item.stock - v_reserved_by_others, 0);

    if v_available < v_item.quantity then
      raise exception 'INSUFFICIENT_AVAILABLE_STOCK:%:%', v_item.product_id, v_available;
    end if;
  end loop;

  insert into public.stock_reservations (
    order_id,
    product_id,
    quantity,
    status,
    expires_at,
    released_at,
    consumed_at,
    release_reason,
    updated_at
  )
  select
    p_order_id,
    oi.product_id,
    sum(oi.quantity)::integer,
    'ACTIVE',
    v_expires_at,
    null,
    null,
    null,
    now()
  from public.order_items oi
  where oi.order_id = p_order_id
  group by oi.product_id
  on conflict (order_id, product_id)
  do update set
    quantity = excluded.quantity,
    status = 'ACTIVE',
    expires_at = excluded.expires_at,
    released_at = null,
    consumed_at = null,
    release_reason = null,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'expires_at', v_expires_at
  );
end;
$$;

revoke execute on function public.reserve_order_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_order_stock(uuid, integer) to service_role;

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
set search_path = ''
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
  v_reserved_quantity integer;
  v_available_quantity integer;
  v_should_reserve boolean := false;
  v_reservation_expires_at timestamptz;
begin
  if not public.request_is_service_role() then
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
    o.customer_email,
    (
      select max(sr.expires_at)
      from public.stock_reservations sr
      where sr.order_id = o.id
        and sr.status = 'ACTIVE'
        and sr.expires_at > now()
    ) as reservation_expires_at
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
      'customer_email', v_existing.customer_email,
      'reservation_expires_at', v_existing.reservation_expires_at
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

  v_should_reserve := p_payment_provider = 'MERCADOPAGO' and p_order_status = 'PENDING_PAYMENT';

  update public.stock_reservations
  set status = 'EXPIRED',
      released_at = coalesce(released_at, now()),
      release_reason = coalesce(release_reason, 'TTL_EXPIRED'),
      updated_at = now()
  where status = 'ACTIVE'
    and expires_at <= now();

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

    select coalesce(sum(sr.quantity), 0)::integer
    into v_reserved_quantity
    from public.stock_reservations sr
    where sr.product_id = v_product_id
      and sr.status = 'ACTIVE'
      and sr.expires_at > now();

    v_available_quantity := greatest(v_product.stock - v_reserved_quantity, 0);

    if v_available_quantity < v_requested_quantity then
      raise exception 'INSUFFICIENT_STOCK:%:%', v_product_id, v_available_quantity;
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

    if v_should_reserve then
      v_reservation_expires_at := now() + interval '30 minutes';

      insert into public.stock_reservations (
        order_id,
        product_id,
        quantity,
        status,
        expires_at,
        updated_at
      )
      select
        v_order_id,
        oi.product_id,
        sum(oi.quantity)::integer,
        'ACTIVE',
        v_reservation_expires_at,
        now()
      from public.order_items oi
      where oi.order_id = v_order_id
      group by oi.product_id;
    end if;

  exception when unique_violation then
    select
      p.id as payment_id,
      p.order_id,
      p.provider,
      p.status as payment_status,
      o.status as order_status,
      o.user_id,
      o.customer_email,
      (
        select max(sr.expires_at)
        from public.stock_reservations sr
        where sr.order_id = o.id
          and sr.status = 'ACTIVE'
          and sr.expires_at > now()
      ) as reservation_expires_at
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
      'customer_email', v_existing.customer_email,
      'reservation_expires_at', v_existing.reservation_expires_at
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
    'customer_email', lower(trim(p_customer_email)),
    'reservation_expires_at', v_reservation_expires_at
  );
end;
$$;

revoke execute on function public.create_checkout_order(
  uuid, text, text, text, text, numeric, numeric, numeric, jsonb, text, text, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_checkout_order(
  uuid, text, text, text, text, numeric, numeric, numeric, jsonb, text, text, text, text, jsonb, jsonb
) to service_role;

create or replace function public.admin_transition_order(
  p_order_id uuid,
  p_action text,
  p_reason text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_actor_email text;
  v_next_status text;
  v_action text := upper(btrim(coalesce(p_action, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_reservation jsonb;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select email into v_actor_email
  from public.profiles
  where id = p_actor_id and role = 'ADMIN';

  if not found then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select * into v_payment
  from public.payments
  where order_id = p_order_id
  for update;

  if v_action = 'APPROVE' then
    if v_order.status <> 'PENDING_ADMIN_APPROVAL' then
      raise exception 'ORDER_NOT_AWAITING_APPROVAL';
    end if;

    v_next_status := 'PENDING_PAYMENT';

    update public.orders
    set status = v_next_status,
        updated_at = now()
    where id = p_order_id;

    if v_payment.provider = 'MERCADOPAGO' then
      v_reservation := public.reserve_order_stock(p_order_id, 30);
    end if;

  elsif v_action = 'REJECT' then
    if char_length(v_reason) not between 3 and 240 then
      raise exception 'INVALID_REJECTION_REASON';
    end if;

    if v_order.status not in ('PENDING_PAYMENT', 'PENDING_TRANSFER', 'PENDING_ADMIN_APPROVAL', 'COORDINATE') then
      raise exception 'ORDER_CANNOT_BE_REJECTED';
    end if;

    if v_order.status = 'PENDING_PAYMENT'
      and v_payment.id is not null
      and (
        v_payment.status <> 'PENDING'
        or v_payment.provider_preference_id is not null
        or v_payment.provider_payment_id is not null
      ) then
      raise exception 'PAYMENT_ALREADY_STARTED';
    end if;

    v_next_status := 'CANCELLED';

    update public.orders
    set status = v_next_status,
        cancellation_reason = v_reason,
        cancelled_at = now(),
        cancelled_by = p_actor_id,
        updated_at = now()
    where id = p_order_id;

    update public.payments
    set status = 'FAILED',
        raw = coalesce(raw, '{}'::jsonb)
          || jsonb_build_object(
               'cancelled_by_admin', true,
               'cancellation_reason', v_reason
             ),
        updated_at = now()
    where order_id = p_order_id
      and status = 'PENDING';

    perform public.release_order_stock_reservation(p_order_id, 'ADMIN_REJECTED');

  else
    raise exception 'INVALID_ORDER_ACTION';
  end if;

  insert into public.admin_audit_logs (
    actor_id, actor_email, actor_role, action, entity, entity_id, message, metadata
  ) values (
    p_actor_id,
    v_actor_email,
    'ADMIN',
    case when v_action = 'APPROVE' then 'ORDER_APPROVED_BY_ADMIN' else 'ORDER_REJECTED_BY_ADMIN' end,
    'orders',
    p_order_id::text,
    case when v_action = 'APPROVE' then 'Compra aprobada para continuar el pago.' else 'Compra rechazada sin afectar stock.' end,
    jsonb_build_object(
      'previous_status', v_order.status,
      'next_status', v_next_status,
      'reason', nullif(v_reason, ''),
      'total', v_order.total,
      'reservation_expires_at', case when v_reservation is null then null else v_reservation->>'expires_at' end
    )
  );

  insert into public.notifications (target_role, type, title, message, link_to)
  values (
    'ADMIN',
    case when v_action = 'APPROVE' then 'ORDER_APPROVED_BY_ADMIN' else 'ORDER_REJECTED_BY_ADMIN' end,
    case when v_action = 'APPROVE' then 'Compra aprobada' else 'Compra rechazada' end,
    case
      when v_action = 'APPROVE' then v_actor_email || ' aprobó la compra de ' || v_order.customer_name || '.'
      else v_actor_email || ' rechazó la compra de ' || v_order.customer_name || '.'
    end,
    '/admin/pedidos?order=' || p_order_id
  );

  if v_order.user_id is not null then
    insert into public.notifications (user_id, target_role, type, title, message, link_to)
    values (
      v_order.user_id,
      'USER',
      case when v_action = 'APPROVE' then 'ORDER_APPROVED' else 'ORDER_REJECTED' end,
      case when v_action = 'APPROVE' then 'Tu pedido fue aprobado' else 'Tu pedido fue rechazado' end,
      case
        when v_action = 'APPROVE' then 'Tu pedido ya puede continuar al pago.'
        else 'El pedido fue cancelado. Motivo: ' || v_reason
      end,
      '/cuenta/pedidos?order=' || p_order_id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'status', v_next_status,
    'reservation_expires_at', case when v_reservation is null then null else v_reservation->>'expires_at' end
  );
end;
$$;

revoke execute on function public.admin_transition_order(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_transition_order(uuid, text, text, uuid) to service_role;

create or replace function public.finalize_paid_order(
  p_order_id uuid,
  p_provider_payment_id text default null,
  p_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_ticket_id uuid;
  v_ticket_number text;
  v_insufficient_product text;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select * into v_payment
  from public.payments
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_order.status in ('PAID', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED') then
    update public.stock_reservations
    set status = 'CONSUMED',
        consumed_at = coalesce(consumed_at, now()),
        updated_at = now()
    where order_id = p_order_id
      and status = 'ACTIVE';

    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'order_id', p_order_id
    );
  end if;

  if v_order.status = 'CANCELLED' then
    raise exception 'ORDER_CANCELLED';
  end if;

  if v_payment.status not in ('PENDING', 'PAID') then
    raise exception 'PAYMENT_STATUS_NOT_CONFIRMABLE';
  end if;

  perform 1
  from public.products p
  join public.order_items oi on oi.product_id = p.id
  where oi.order_id = p_order_id
  order by p.id
  for update of p;

  select p.name
  into v_insufficient_product
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  where oi.order_id = p_order_id
    and (
      p.stock
      - coalesce((
          select sum(sr.quantity)
          from public.stock_reservations sr
          where sr.product_id = p.id
            and sr.order_id <> p_order_id
            and sr.status = 'ACTIVE'
            and sr.expires_at > now()
        ), 0)
    ) < oi.quantity
  limit 1;

  if v_insufficient_product is not null then
    raise exception 'INSUFFICIENT_AVAILABLE_STOCK:%', v_insufficient_product;
  end if;

  insert into public.inventory_movements (
    product_id,
    order_id,
    type,
    quantity,
    stock_before,
    stock_after,
    reason,
    metadata,
    created_at
  )
  select
    p.id,
    p_order_id,
    'SALE',
    -oi.quantity,
    p.stock,
    p.stock - oi.quantity,
    'Venta confirmada por Mercado Pago',
    jsonb_build_object(
      'provider', v_payment.provider,
      'provider_payment_id', p_provider_payment_id,
      'stock_reservation', true
    ),
    now()
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  where oi.order_id = p_order_id;

  update public.products p
  set stock = p.stock - oi.quantity,
      updated_at = now()
  from public.order_items oi
  where oi.order_id = p_order_id
    and oi.product_id = p.id;

  update public.stock_reservations
  set status = 'CONSUMED',
      consumed_at = now(),
      updated_at = now()
  where order_id = p_order_id
    and status in ('ACTIVE', 'EXPIRED', 'RELEASED');

  update public.payments
  set status = 'PAID',
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      raw = coalesce(raw, '{}'::jsonb) || coalesce(p_raw, '{}'::jsonb),
      updated_at = now()
  where order_id = p_order_id;

  update public.orders
  set status = 'PAID',
      paid_at = now(),
      updated_at = now()
  where id = p_order_id;

  select id
  into v_ticket_id
  from public.purchase_tickets
  where order_id = p_order_id
  limit 1;

  if v_ticket_id is null then
    v_ticket_number := public.generate_ticket_number();

    insert into public.purchase_tickets (
      number,
      order_id,
      customer_name,
      customer_email,
      customer_phone,
      payment_provider,
      payment_id,
      subtotal,
      discount,
      shipping_cost,
      total,
      shipping_method,
      address_snapshot,
      notes,
      status,
      issued_at
    )
    values (
      v_ticket_number,
      p_order_id,
      v_order.customer_name,
      v_order.customer_email,
      v_order.customer_phone,
      v_payment.provider,
      p_provider_payment_id,
      v_order.subtotal,
      0,
      v_order.shipping_cost,
      v_order.total,
      v_order.shipping_method,
      v_order.address_snapshot,
      v_order.notes,
      'ISSUED',
      now()
    )
    returning id into v_ticket_id;

    insert into public.purchase_ticket_items (
      ticket_id,
      product_id,
      sku,
      name,
      quantity,
      unit_price,
      subtotal,
      created_at
    )
    select
      v_ticket_id,
      product_id,
      sku,
      name,
      quantity,
      unit_price,
      subtotal,
      now()
    from public.order_items
    where order_id = p_order_id;
  end if;

  insert into public.notifications (
    user_id,
    target_role,
    type,
    title,
    message,
    link_to,
    read,
    created_at
  )
  values (
    null,
    'ADMIN',
    'ORDER_PAID',
    'Nuevo pedido pagado',
    'Se confirmó un pago de $' || v_order.total || ' para la orden ' || p_order_id::text,
    '/admin/orders/' || p_order_id::text,
    false,
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'order_id', p_order_id,
    'ticket_id', v_ticket_id
  );
end;
$$;

revoke execute on function public.finalize_paid_order(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_paid_order(uuid, text, jsonb) to service_role;
