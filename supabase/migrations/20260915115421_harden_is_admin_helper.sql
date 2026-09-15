-- Keep the public helper contract used by existing policies, but move the
-- privileged profile lookup outside the exposed Data API schema.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'ADMIN'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

comment on function private.is_admin() is
  'Private SECURITY DEFINER role lookup. Not exposed through the Data API.';
comment on function public.is_admin() is
  'RLS compatibility wrapper. SECURITY INVOKER; delegates to private role lookup.';

commit;
