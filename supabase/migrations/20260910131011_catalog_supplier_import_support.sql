-- Additive catalog provenance for supplier imports. Source costs and source
-- image URLs live in a private table so they cannot leak through public
-- product reads. Imported products remain non-purchasable until FZAC records
-- physical stock.

begin;

alter table public.products
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists availability_status text not null default 'IN_STOCK';

alter table public.products
  drop constraint if exists products_availability_status_check;

alter table public.products
  add constraint products_availability_status_check
  check (availability_status in ('IN_STOCK', 'OUT_OF_STOCK', 'CONSULT'));

create index if not exists products_supplier_id_idx
  on public.products(supplier_id);

create table if not exists public.product_supplier_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  source text not null check (char_length(source) between 2 and 140),
  source_product_id text not null,
  source_url text not null check (source_url ~ '^https://'),
  source_image_url text check (source_image_url is null or source_image_url ~ '^https://'),
  source_sku text,
  original_name text not null,
  original_price numeric(12,2) not null check (original_price > 0),
  margin_percent numeric(5,2) not null default 20 check (margin_percent = 20),
  imported_at timestamptz not null default now(),
  checked_at timestamptz not null default now(),
  unique (supplier_id, source_product_id)
);

create index if not exists product_supplier_sources_supplier_idx
  on public.product_supplier_sources(supplier_id, checked_at desc);

alter table public.product_supplier_sources enable row level security;
alter table public.product_supplier_sources force row level security;

drop policy if exists "admin product supplier sources read" on public.product_supplier_sources;
create policy "admin product supplier sources read"
on public.product_supplier_sources for select to authenticated
using (public.is_admin());

revoke all on table public.product_supplier_sources from public, anon, authenticated;
grant select on table public.product_supplier_sources to authenticated;
grant all on table public.product_supplier_sources to service_role;

comment on table public.product_supplier_sources is
  'Private supplier provenance and cost data. Never expose through storefront or assistant responses.';
comment on column public.products.availability_status is
  'CONSULT means no numeric stock was supplied and checkout must remain disabled.';

commit;
