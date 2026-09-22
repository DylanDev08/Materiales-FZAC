-- Payment integrity and operational observability hardening.

do $$
begin
  if exists (
    select 1
    from public.payments
    where provider_payment_id is not null
    group by provider, provider_payment_id
    having count(*) > 1
  ) then
    raise exception 'PROVIDER_PAYMENT_ID_DUPLICATES';
  end if;
end $$;

create unique index if not exists payments_provider_payment_unique_idx
  on public.payments(provider, provider_payment_id)
  where provider_payment_id is not null;

create or replace function public.checkout_integrity_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_orders_without_items integer;
  v_active_orders_without_items integer;
  v_legacy_cancelled_orders_without_items integer;
  v_duplicate_keys integer;
  v_negative_stock integer;
  v_orders_multiple_payments integer;
  v_provider_payment_duplicates integer;
  v_stale_pending_orders integer;
  v_stuck_payment_events integer;
  v_paid_order_mismatches integer;
  v_atomic_function boolean;
  v_idempotency_index boolean;
  v_provider_payment_index boolean;
  v_profile_guard boolean;
  v_finalize_payment_function boolean;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select count(*)::integer
  into v_orders_without_items
  from public.orders o
  where not exists (
    select 1 from public.order_items oi where oi.order_id = o.id
  );

  select count(*)::integer
  into v_active_orders_without_items
  from public.orders o
  where o.status <> 'CANCELLED'
    and not exists (
      select 1 from public.order_items oi where oi.order_id = o.id
    );

  select count(*)::integer
  into v_legacy_cancelled_orders_without_items
  from public.orders o
  where o.status = 'CANCELLED'
    and not exists (
      select 1 from public.order_items oi where oi.order_id = o.id
    );

  select count(*)::integer
  into v_duplicate_keys
  from (
    select provider_session_id
    from public.payments
    where provider_session_id is not null
    group by provider_session_id
    having count(*) > 1
  ) duplicated;

  select count(*)::integer
  into v_negative_stock
  from public.products
  where stock < 0;

  select count(*)::integer
  into v_orders_multiple_payments
  from (
    select order_id
    from public.payments
    group by order_id
    having count(*) > 1
  ) duplicated_orders;

  select count(*)::integer
  into v_provider_payment_duplicates
  from (
    select provider, provider_payment_id
    from public.payments
    where provider_payment_id is not null
    group by provider, provider_payment_id
    having count(*) > 1
  ) duplicated_provider_payments;

  select count(*)::integer
  into v_stale_pending_orders
  from public.orders
  where status = 'PENDING_PAYMENT'
    and created_at < now() - interval '2 hours';

  select count(*)::integer
  into v_stuck_payment_events
  from public.payment_events
  where status = 'RECEIVED'
    and created_at < now() - interval '10 minutes';

  select count(*)::integer
  into v_paid_order_mismatches
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.status = 'PAID'
    and o.status not in (
      'PAID','CONFIRMED','PREPARING','READY_FOR_PICKUP',
      'OUT_FOR_DELIVERY','DELIVERED','COMPLETED'
    );

  v_atomic_function := to_regprocedure(
    'public.create_checkout_order(uuid,text,text,text,text,numeric,numeric,numeric,jsonb,text,text,text,text,jsonb,jsonb)'
  ) is not null;

  v_finalize_payment_function := to_regprocedure(
    'public.finalize_paid_order(uuid,text,jsonb)'
  ) is not null;

  v_idempotency_index := to_regclass('public.payments_provider_session_unique_idx') is not null;
  v_provider_payment_index := to_regclass('public.payments_provider_payment_unique_idx') is not null;

  select exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and t.tgname = 'protect_profile_security_fields'
      and not t.tgisinternal
  ) into v_profile_guard;

  return jsonb_build_object(
    'orders_without_items', v_orders_without_items,
    'active_orders_without_items', v_active_orders_without_items,
    'legacy_cancelled_orders_without_items', v_legacy_cancelled_orders_without_items,
    'duplicate_idempotency_keys', v_duplicate_keys,
    'negative_stock_products', v_negative_stock,
    'orders_multiple_payments', v_orders_multiple_payments,
    'provider_payment_duplicates', v_provider_payment_duplicates,
    'stale_pending_orders', v_stale_pending_orders,
    'stuck_payment_events', v_stuck_payment_events,
    'paid_order_mismatches', v_paid_order_mismatches,
    'atomic_checkout_function', v_atomic_function,
    'finalize_payment_function', v_finalize_payment_function,
    'idempotency_unique_index', v_idempotency_index,
    'provider_payment_unique_index', v_provider_payment_index,
    'profile_privilege_guard', v_profile_guard
  );
end;
$$;

revoke execute on function public.checkout_integrity_status() from public, anon, authenticated;
grant execute on function public.checkout_integrity_status() to service_role;
