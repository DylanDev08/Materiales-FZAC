
alter table public.orders
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null;

create or replace function public.sync_user_cart(
  p_user_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_stored integer;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if p_user_id is null or not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'CART_USER_NOT_FOUND';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_CART_ITEMS';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('cart:' || p_user_id::text, 0));

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'INVALID_CART_ITEM';
    end;
    if v_quantity not between 1 and 999 then
      raise exception 'INVALID_CART_ITEM';
    end if;
  end loop;

  delete from public.cart_items where user_id = p_user_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if exists (
      select 1
      from public.products
      where id = v_product_id
        and active = true
        and availability_status = 'IN_STOCK'
        and stock > 0
    ) then
      insert into public.cart_items (user_id, product_id, quantity)
      values (p_user_id, v_product_id, v_quantity)
      on conflict (user_id, product_id) do update
      set quantity = excluded.quantity,
          updated_at = now();
    end if;
  end loop;

  select count(*) into v_stored
  from public.cart_items
  where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'stored', v_stored);
end;
$$;

revoke all on function public.sync_user_cart(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sync_user_cart(uuid, jsonb) to service_role;

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

  else
    raise exception 'INVALID_ORDER_ACTION';
  end if;

  insert into public.admin_audit_logs (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity,
    entity_id,
    message,
    metadata
  ) values (
    p_actor_id,
    v_actor_email,
    'ADMIN',
    case
      when v_action = 'APPROVE' then 'ORDER_APPROVED_BY_ADMIN'
      else 'ORDER_REJECTED_BY_ADMIN'
    end,
    'orders',
    p_order_id::text,
    case
      when v_action = 'APPROVE' then 'Compra aprobada para continuar el pago.'
      else 'Compra rechazada sin afectar stock.'
    end,
    jsonb_build_object(
      'previous_status', v_order.status,
      'next_status', v_next_status,
      'reason', nullif(v_reason, ''),
      'total', v_order.total
    )
  );

  insert into public.notifications (
    target_role,
    type,
    title,
    message,
    link_to
  ) values (
    'ADMIN',
    case
      when v_action = 'APPROVE' then 'ORDER_APPROVED_BY_ADMIN'
      else 'ORDER_REJECTED_BY_ADMIN'
    end,
    case
      when v_action = 'APPROVE' then 'Compra aprobada'
      else 'Compra rechazada'
    end,
    case
      when v_action = 'APPROVE' then v_actor_email || ' aprobó la compra de ' || v_order.customer_name || '.'
      else v_actor_email || ' rechazó la compra de ' || v_order.customer_name || '.'
    end,
    '/admin/pedidos?order=' || p_order_id
  );

  if v_order.user_id is not null then
    insert into public.notifications (
      user_id,
      target_role,
      type,
      title,
      message,
      link_to
    ) values (
      v_order.user_id,
      'USER',
      case
        when v_action = 'APPROVE' then 'ORDER_APPROVED'
        else 'ORDER_REJECTED'
      end,
      case
        when v_action = 'APPROVE' then 'Tu pedido fue aprobado'
        else 'Tu pedido fue rechazado'
      end,
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
    'status', v_next_status
  );
end;
$$;

revoke all on function public.admin_transition_order(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_transition_order(uuid, text, text, uuid) to service_role;

create or replace function public.admin_bulk_void_financial_movements(
  p_actor_id uuid,
  p_actor_email text,
  p_type text,
  p_before timestamptz,
  p_reason text,
  p_max_rows integer default 250
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_email text;
  v_eligible integer;
  v_updated integer;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select email into v_actor_email
  from public.profiles
  where id = p_actor_id
    and role = 'ADMIN';

  if not found then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if lower(v_actor_email) <> lower(btrim(coalesce(p_actor_email, ''))) then
    raise exception 'ADMIN_IDENTITY_MISMATCH';
  end if;

  if p_type not in ('ALL', 'INCOME', 'EXPENSE') then
    raise exception 'INVALID_MOVEMENT_TYPE';
  end if;

  if p_before is null or p_before > now() + interval '1 minute' then
    raise exception 'INVALID_CUTOFF';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) not between 8 and 240 then
    raise exception 'INVALID_REASON';
  end if;

  if p_max_rows < 1 or p_max_rows > 250 then
    raise exception 'INVALID_LIMIT';
  end if;

  perform pg_advisory_xact_lock(748291033014::bigint);

  select count(*) into v_eligible
  from (
    select id
    from public.financial_movements
    where status = 'ACTIVE'
      and source in ('MANUAL', 'ADJUSTMENT')
      and occurred_at <= p_before
      and (p_type = 'ALL' or type = p_type)
    order by occurred_at, id
    limit p_max_rows + 1
  ) selected;

  if v_eligible = 0 then
    raise exception 'NO_ELIGIBLE_MOVEMENTS';
  end if;

  if v_eligible > p_max_rows then
    raise exception 'TOO_MANY_MOVEMENTS';
  end if;

  with selected as (
    select id
    from public.financial_movements
    where status = 'ACTIVE'
      and source in ('MANUAL', 'ADJUSTMENT')
      and occurred_at <= p_before
      and (p_type = 'ALL' or type = p_type)
    order by occurred_at, id
    limit p_max_rows
    for update
  )
  update public.financial_movements movement
  set status = 'VOID',
      voided_by = p_actor_id,
      voided_at = now(),
      void_reason = btrim(p_reason),
      updated_at = now()
  from selected
  where movement.id = selected.id
    and movement.status = 'ACTIVE';

  get diagnostics v_updated = row_count;

  insert into public.admin_audit_logs (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity,
    message,
    metadata
  ) values (
    p_actor_id,
    v_actor_email,
    'ADMIN',
    'FINANCIAL_MOVEMENTS_BULK_VOIDED',
    'financial_movements',
    v_updated || ' movimientos manuales anulados en una operación controlada.',
    jsonb_build_object(
      'count', v_updated,
      'movement_type', p_type,
      'before', p_before,
      'reason', btrim(p_reason)
    )
  );

  return jsonb_build_object('ok', true, 'count', v_updated);
end;
$$;

revoke all on function public.admin_bulk_void_financial_movements(uuid, text, text, timestamptz, text, integer)
from public, anon, authenticated;
grant execute on function public.admin_bulk_void_financial_movements(uuid, text, text, timestamptz, text, integer)
to service_role;
;\n