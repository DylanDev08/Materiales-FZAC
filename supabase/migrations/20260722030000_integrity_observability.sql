-- Read-only integrity summary for the protected admin system dashboard.

create or replace function public.checkout_integrity_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_orders_without_items integer;
  v_duplicate_keys integer;
  v_negative_stock integer;
  v_atomic_function boolean;
  v_idempotency_index boolean;
  v_profile_guard boolean;
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

  v_atomic_function := to_regprocedure(
    'public.create_checkout_order(uuid,text,text,text,text,numeric,numeric,numeric,jsonb,text,text,text,text,jsonb,jsonb)'
  ) is not null;

  v_idempotency_index := to_regclass('public.payments_provider_session_unique_idx') is not null;

  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and t.tgname = 'protect_profile_security_fields'
      and not t.tgisinternal
  ) into v_profile_guard;

  return jsonb_build_object(
    'orders_without_items', v_orders_without_items,
    'duplicate_idempotency_keys', v_duplicate_keys,
    'negative_stock_products', v_negative_stock,
    'atomic_checkout_function', v_atomic_function,
    'idempotency_unique_index', v_idempotency_index,
    'profile_privilege_guard', v_profile_guard
  );
end;
$$;

revoke execute on function public.checkout_integrity_status() from public, anon, authenticated;
grant execute on function public.checkout_integrity_status() to service_role;
