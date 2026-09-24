begin;

create table if not exists public.admin_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  user_agent_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create index if not exists admin_trusted_devices_user_id_idx
  on public.admin_trusted_devices(user_id);

create index if not exists admin_trusted_devices_expires_at_idx
  on public.admin_trusted_devices(expires_at);

alter table public.admin_trusted_devices enable row level security;
alter table public.admin_trusted_devices force row level security;

revoke all on table public.admin_trusted_devices from anon, authenticated;
grant all on table public.admin_trusted_devices to service_role;

commit;
