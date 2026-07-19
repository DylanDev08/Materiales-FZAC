-- Additive hardening for profile privileges and atomic payment transitions.
-- This migration does not delete data or relax any existing RLS policy.

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    new.id := old.id;
    new.email := old.email;
    new.role := old.role;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields
before update on public.profiles
for each row execute function public.protect_profile_security_fields();

revoke execute on function public.protect_profile_security_fields() from public, anon, authenticated;

create or replace function public.finalize_paid_order(
  p_order_id uuid,
  p_provider_payment_id text,
  p_raw jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_item record;
  v_stock_before integer;
  v_stock_after integer;
  v_ticket_id uuid;
  v_ticket_number text;
  v_raw_amount numeric;
  v_now timestamptz := now();
begin
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

  if v_payment.status = 'REFUNDED' then
    raise exception 'PAYMENT_ALREADY_REFUNDED';
  end if;

  if v_order.status = 'PAID' then
    update public.payments
    set status = 'PAID',
        provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
        raw = coalesce(raw, '{}'::jsonb) || coalesce(p_raw, '{}'::jsonb),
        updated_at = v_now
    where id = v_payment.id;

    select id, number into v_ticket_id, v_ticket_number
    from public.purchase_tickets
    where order_id = p_order_id;

    return jsonb_build_object(
      'ok', true,
      'already_confirmed', true,
      'ticket_id', v_ticket_id,
      'ticket_number', v_ticket_number
    );
  end if;

  if v_payment.status not in ('PENDING', 'PAID') then
    raise exception 'PAYMENT_STATUS_NOT_CONFIRMABLE';
  end if;

  if abs(v_payment.amount - v_order.total) > 0.01 then
    raise exception 'PAYMENT_ORDER_AMOUNT_MISMATCH';
  end if;

  if exists (
    select 1
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
      and p.id is null
  ) then
    raise exception 'ORDER_PRODUCT_NOT_FOUND';
  end if;

  if coalesce(p_raw ->> 'transaction_amount', '') ~ '^[0-9]+([.][0-9]+)?$' then
    v_raw_amount := (p_raw ->> 'transaction_amount')::numeric;
    if abs(v_raw_amount - v_order.total) > 0.01 then
      raise exception 'PROVIDER_AMOUNT_MISMATCH';
    end if;
  end if;

  for v_item in
    select oi.*, p.stock, p.stock_minimum, p.name as product_name
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
    order by p.id
    for update of p
  loop
    v_stock_before := v_item.stock;
    if v_stock_before < v_item.quantity then
      raise exception 'INSUFFICIENT_STOCK:%', v_item.product_id;
    end if;

    v_stock_after := v_stock_before - v_item.quantity;

    update public.products
    set stock = v_stock_after,
        updated_at = v_now
    where id = v_item.product_id;

    insert into public.inventory_movements (
      product_id, order_id, type, quantity, stock_before, stock_after, reason, metadata
    ) values (
      v_item.product_id,
      p_order_id,
      'SALE',
      -v_item.quantity,
      v_stock_before,
      v_stock_after,
      'Pago aprobado',
      jsonb_build_object('provider', v_payment.provider, 'provider_payment_id', p_provider_payment_id)
    );

    if v_stock_after <= v_item.stock_minimum then
      insert into public.notifications (target_role, type, title, message, link_to)
      values (
        'ADMIN',
        'LOW_STOCK',
        'Stock bajo',
        v_item.product_name || ' quedo con ' || v_stock_after || ' unidades.',
        '/admin/productos?product=' || v_item.product_id
      );
    end if;
  end loop;

  update public.orders
  set status = 'PAID', paid_at = v_now, updated_at = v_now
  where id = p_order_id;

  update public.payments
  set status = 'PAID',
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      raw = coalesce(p_raw, '{}'::jsonb),
      updated_at = v_now
  where id = v_payment.id;

  select id, number into v_ticket_id, v_ticket_number
  from public.purchase_tickets
  where order_id = p_order_id;

  if v_ticket_id is null then
    v_ticket_number := 'FZAC-' || to_char(v_now, 'YYYYMMDDHH24MISS') || '-' || upper(substr(replace(p_order_id::text, '-', ''), 1, 8));

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
      status
    ) values (
      v_ticket_number,
      v_order.id,
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
      'ISSUED'
    ) returning id into v_ticket_id;

    insert into public.purchase_ticket_items (
      ticket_id, product_id, sku, name, quantity, unit_price, subtotal, stock_before, stock_after
    )
    select
      v_ticket_id,
      oi.product_id,
      oi.sku,
      oi.name,
      oi.quantity,
      oi.price,
      oi.price * oi.quantity,
      im.stock_before,
      im.stock_after
    from public.order_items oi
    left join lateral (
      select stock_before, stock_after
      from public.inventory_movements
      where order_id = p_order_id
        and product_id = oi.product_id
        and type = 'SALE'
      order by created_at desc
      limit 1
    ) im on true
    where oi.order_id = p_order_id;
  end if;

  insert into public.notifications (target_role, type, title, message, link_to)
  values (
    'ADMIN',
    'PURCHASE_APPROVED',
    'Compra aprobada',
    'Nueva compra aprobada por ' || v_order.customer_name || '. Ticket ' || v_ticket_number || '.',
    '/admin/tickets?ticket=' || v_ticket_id
  );

  return jsonb_build_object(
    'ok', true,
    'already_confirmed', false,
    'ticket_id', v_ticket_id,
    'ticket_number', v_ticket_number
  );
end;
$$;

revoke execute on function public.finalize_paid_order(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_paid_order(uuid, text, jsonb) to service_role;

create or replace function public.finalize_refunded_order(
  p_payment_id uuid,
  p_provider_refund_id text,
  p_raw jsonb,
  p_reason text,
  p_actor_id uuid,
  p_actor_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_item record;
  v_stock_before integer;
  v_stock_after integer;
  v_now timestamptz := now();
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_payment.status = 'REFUNDED' then
    return jsonb_build_object('ok', true, 'already_refunded', true, 'order_id', v_payment.order_id);
  end if;

  if v_payment.provider <> 'MERCADOPAGO' or v_payment.status <> 'PAID' then
    raise exception 'PAYMENT_NOT_REFUNDABLE';
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  for v_item in
    select oi.*, p.stock
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id
    order by p.id
    for update of p
  loop
    v_stock_before := v_item.stock;
    v_stock_after := v_stock_before + v_item.quantity;

    update public.products
    set stock = v_stock_after,
        updated_at = v_now
    where id = v_item.product_id;

    insert into public.inventory_movements (
      product_id, order_id, actor_id, type, quantity, stock_before, stock_after, reason, metadata
    ) values (
      v_item.product_id,
      v_order.id,
      p_actor_id,
      'RETURN',
      v_item.quantity,
      v_stock_before,
      v_stock_after,
      p_reason,
      jsonb_build_object('provider_refund_id', p_provider_refund_id, 'payment_id', p_payment_id)
    );
  end loop;

  update public.payments
  set status = 'REFUNDED',
      raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
        'refund', coalesce(p_raw, '{}'::jsonb),
        'refund_reason', p_reason,
        'refunded_at', v_now
      ),
      updated_at = v_now
  where id = p_payment_id;

  update public.orders
  set status = 'CANCELLED', updated_at = v_now
  where id = v_order.id;

  update public.purchase_tickets
  set status = 'CANCELLED', updated_at = v_now
  where order_id = v_order.id;

  insert into public.notifications (target_role, type, title, message, link_to)
  values (
    'ADMIN',
    'REFUND_APPROVED',
    'Reembolso aprobado',
    'Se reembolso la compra de ' || v_order.customer_name || '. Motivo: ' || p_reason,
    '/admin/pagos?order=' || v_order.id
  );

  if v_order.user_id is not null then
    insert into public.notifications (user_id, target_role, type, title, message, link_to)
    values (
      v_order.user_id,
      'USER',
      'REFUND_APPROVED',
      'Reembolso confirmado',
      'El reembolso de tu pedido fue procesado correctamente.',
      '/cuenta/pedidos'
    );
  end if;

  insert into public.admin_audit_logs (
    actor_id, actor_email, actor_role, action, entity, entity_id, message, metadata
  ) values (
    p_actor_id,
    p_actor_email,
    'ADMIN',
    'PAYMENT_REFUNDED',
    'payments',
    p_payment_id::text,
    'Reembolso total procesado para la orden ' || v_order.id,
    jsonb_build_object(
      'order_id', v_order.id,
      'provider_refund_id', p_provider_refund_id,
      'reason', p_reason
    )
  );

  return jsonb_build_object('ok', true, 'already_refunded', false, 'order_id', v_order.id);
end;
$$;

revoke execute on function public.finalize_refunded_order(uuid, text, jsonb, text, uuid, text) from public, anon, authenticated;
grant execute on function public.finalize_refunded_order(uuid, text, jsonb, text, uuid, text) to service_role;
