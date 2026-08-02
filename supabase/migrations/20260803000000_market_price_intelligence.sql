create table if not exists public.market_price_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  source_type text not null default 'MANUAL' check (source_type in ('MANUAL', 'API_JSON')),
  base_url text check (base_url is null or base_url ~ '^https://'),
  feed_url text check (feed_url is null or feed_url ~ '^https://'),
  active boolean not null default true,
  trusted boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_price_observations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  source_id uuid not null references public.market_price_sources(id) on delete restrict,
  external_key text not null check (char_length(external_key) between 1 and 160),
  external_name text not null check (char_length(external_name) between 2 and 240),
  source_url text check (source_url is null or source_url ~ '^https://'),
  observed_price numeric(14,2) not null check (observed_price > 0),
  currency text not null default 'ARS' check (currency = 'ARS'),
  sale_unit text not null check (char_length(sale_unit) between 1 and 40),
  equivalent_quantity numeric(12,4) not null default 1 check (equivalent_quantity > 0),
  normalized_price numeric(14,4) generated always as (observed_price / equivalent_quantity) stored,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  fingerprint text not null unique check (char_length(fingerprint) between 32 and 128),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > observed_at)
);

create table if not exists public.market_price_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.market_price_sources(id) on delete set null,
  status text not null check (status in ('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
  imported_count int not null default 0 check (imported_count >= 0),
  rejected_count int not null default 0 check (rejected_count >= 0),
  error_message text check (error_message is null or char_length(error_message) <= 300),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists market_price_observations_product_date_idx
on public.market_price_observations (product_id, observed_at desc);

create index if not exists market_price_observations_source_date_idx
on public.market_price_observations (source_id, observed_at desc);

drop trigger if exists set_market_price_sources_updated_at on public.market_price_sources;
create trigger set_market_price_sources_updated_at
before update on public.market_price_sources
for each row execute function public.set_updated_at();

alter table public.market_price_sources enable row level security;
alter table public.market_price_sources force row level security;
alter table public.market_price_observations enable row level security;
alter table public.market_price_observations force row level security;
alter table public.market_price_sync_runs enable row level security;
alter table public.market_price_sync_runs force row level security;

drop policy if exists "admin market price sources read" on public.market_price_sources;
create policy "admin market price sources read"
on public.market_price_sources for select to authenticated
using (public.is_admin());

drop policy if exists "admin market observations read" on public.market_price_observations;
create policy "admin market observations read"
on public.market_price_observations for select to authenticated
using (public.is_admin());

drop policy if exists "admin market sync runs read" on public.market_price_sync_runs;
create policy "admin market sync runs read"
on public.market_price_sync_runs for select to authenticated
using (public.is_admin());

revoke all on table public.market_price_sources from anon, authenticated;
revoke all on table public.market_price_observations from anon, authenticated;
revoke all on table public.market_price_sync_runs from anon, authenticated;
grant select on table public.market_price_sources to authenticated;
grant select on table public.market_price_observations to authenticated;
grant select on table public.market_price_sync_runs to authenticated;
grant all on table public.market_price_sources to service_role;
grant all on table public.market_price_observations to service_role;
grant all on table public.market_price_sync_runs to service_role;

comment on table public.market_price_observations is
  'Private comparable market observations. They never update FZAC sale prices automatically.';
