-- PostgREST versions may expose the JWT role either as an individual setting
-- or inside request.jwt.claims. Support both without weakening RPC grants.

create or replace function public.request_is_service_role()
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_role text;
  v_claims text;
begin
  v_role := current_setting('request.jwt.claim.role', true);
  if v_role = 'service_role' then
    return true;
  end if;

  v_claims := current_setting('request.jwt.claims', true);
  if v_claims is null or v_claims = '' then
    return false;
  end if;

  begin
    return coalesce(v_claims::jsonb->>'role', '') = 'service_role';
  exception when others then
    return false;
  end;
end;
$$;

revoke execute on function public.request_is_service_role() from public, anon, authenticated;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.request_is_service_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'USER';
    return new;
  end if;

  new.id := old.id;
  new.email := old.email;
  new.role := old.role;
  return new;
end;
$$;

revoke execute on function public.protect_profile_security_fields() from public, anon, authenticated;

do $$
declare
  v_definition text;
  v_old text := $guard$
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
$guard$;
  v_new text := $guard$
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
$guard$;
begin
  select pg_get_functiondef(
    'public.create_checkout_order(uuid,text,text,text,text,numeric,numeric,numeric,jsonb,text,text,text,text,jsonb,jsonb)'::regprocedure
  ) into v_definition;

  if position(v_old in v_definition) = 0 then
    raise exception 'CREATE_CHECKOUT_GUARD_NOT_FOUND';
  end if;

  execute replace(v_definition, v_old, v_new);

  select pg_get_functiondef('public.checkout_integrity_status()'::regprocedure)
  into v_definition;

  if position(v_old in v_definition) = 0 then
    raise exception 'INTEGRITY_STATUS_GUARD_NOT_FOUND';
  end if;

  execute replace(v_definition, v_old, v_new);
end $$;

revoke execute on function public.create_checkout_order(
  uuid, text, text, text, text, numeric, numeric, numeric, jsonb, text, text, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_checkout_order(
  uuid, text, text, text, text, numeric, numeric, numeric, jsonb, text, text, text, text, jsonb, jsonb
) to service_role;

revoke execute on function public.checkout_integrity_status() from public, anon, authenticated;
grant execute on function public.checkout_integrity_status() to service_role;
