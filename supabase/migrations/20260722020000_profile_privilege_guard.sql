-- Prevent privilege escalation through direct authenticated profile writes.
-- Service-role writes remain available for the server-side admin email mapping.

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
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

drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_security_fields();

revoke execute on function public.protect_profile_security_fields() from public, anon, authenticated;
