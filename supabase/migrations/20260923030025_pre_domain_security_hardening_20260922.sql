-- Pre-domain security hardening: admin MFA enforcement, distributed throttling,
-- legacy credential purge and FORCE RLS on retained legacy tables.

create table if not exists public.security_rate_limits (
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash, window_started_at)
);

alter table public.security_rate_limits enable row level security;
alter table public.security_rate_limits force row level security;
revoke all on table public.security_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.security_rate_limits to service_role;

create index if not exists security_rate_limits_updated_idx
  on public.security_rate_limits(updated_at);

create or replace function public.consume_security_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope text := left(btrim(coalesce(p_scope, '')), 80);
  v_subject text := left(btrim(coalesce(p_subject_hash, '')), 128);
  v_limit integer := greatest(1, least(coalesce(p_limit, 1), 10000));
  v_window integer := greatest(1, least(coalesce(p_window_seconds, 60), 86400));
  v_now timestamptz := clock_timestamp();
  v_epoch bigint;
  v_window_started timestamptz;
  v_count integer;
  v_retry integer;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if v_scope = '' or v_subject = '' then
    raise exception 'INVALID_RATE_LIMIT_KEY';
  end if;

  v_epoch := floor(extract(epoch from v_now) / v_window)::bigint * v_window;
  v_window_started := to_timestamp(v_epoch);

  insert into public.security_rate_limits(scope, subject_hash, window_started_at, request_count, updated_at)
  values (v_scope, v_subject, v_window_started, 1, v_now)
  on conflict (scope, subject_hash, window_started_at)
  do update set
    request_count = public.security_rate_limits.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into v_count;

  -- Keep the table bounded without a separate scheduler.
  delete from public.security_rate_limits
  where updated_at < v_now - interval '2 days';

  v_retry := greatest(
    1,
    ceil(extract(epoch from (v_window_started + make_interval(secs => v_window) - v_now)))::integer
  );

  return jsonb_build_object(
    'ok', v_count <= v_limit,
    'remaining', greatest(v_limit - v_count, 0),
    'retry_after', case when v_count <= v_limit then 0 else v_retry end,
    'reset_at', extract(epoch from (v_window_started + make_interval(secs => v_window)))::bigint
  );
end;
$$;

revoke execute on function public.consume_security_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text, text, integer, integer)
  to service_role;

-- Admin privilege now also requires a verified second factor in the current JWT.
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

-- Retained Prisma-era tables must not be reachable without an explicit privileged role.
alter table if exists public.users force row level security;
alter table if exists public."Notification" force row level security;
alter table if exists public."AuditLog" force row level security;
alter table if exists public._prisma_migrations force row level security;

-- Remove legacy credential material while preserving non-secret historical user rows.
update public.users
set "password" = null,
    "refreshToken" = null
where "password" is not null
   or "refreshToken" is not null;

alter table public.users
  drop constraint if exists users_legacy_credentials_must_remain_null;

alter table public.users
  add constraint users_legacy_credentials_must_remain_null
  check ("password" is null and "refreshToken" is null);

create or replace function public.pre_domain_security_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_legacy_passwords integer;
  v_legacy_refresh integer;
  v_rate_rows integer;
  v_admin_profiles integer;
  v_admin_totp integer;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select
    (count(*) filter (where "password" is not null))::integer,
    (count(*) filter (where "refreshToken" is not null))::integer
  into v_legacy_passwords, v_legacy_refresh
  from public.users;

  select count(*)::integer into v_rate_rows
  from public.security_rate_limits;

  select count(*)::integer into v_admin_profiles
  from public.profiles
  where role = 'ADMIN';

  select count(*)::integer into v_admin_totp
  from auth.mfa_factors f
  join public.profiles p on p.id = f.user_id
  where p.role = 'ADMIN'
    and f.factor_type = 'totp'
    and f.status = 'verified';

  return jsonb_build_object(
    'legacy_passwords_remaining', v_legacy_passwords,
    'legacy_refresh_tokens_remaining', v_legacy_refresh,
    'rate_limit_rows', v_rate_rows,
    'admin_profiles', v_admin_profiles,
    'admin_verified_totp_factors', v_admin_totp
  );
end;
$$;

revoke execute on function public.pre_domain_security_status() from public, anon, authenticated;
grant execute on function public.pre_domain_security_status() to service_role;
;\n