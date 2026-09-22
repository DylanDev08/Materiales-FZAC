-- Pre-domain security hardening phase 2.
-- Apply only after the production frontend exposes /seguridad/admin-mfa.

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
    and private.is_admin();
$$;

create or replace function public.admin_mfa_enforcement_status()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  return true;
end;
$$;

revoke execute on function public.admin_mfa_enforcement_status() from public, anon, authenticated;
grant execute on function public.admin_mfa_enforcement_status() to service_role;
