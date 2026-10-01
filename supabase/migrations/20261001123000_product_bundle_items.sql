-- Bundle composition for sellable product kits.
create table if not exists public.product_bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_product_id uuid not null references public.products(id) on delete cascade,
  component_product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 999),
  created_at timestamptz not null default now(),
  unique (bundle_product_id, component_product_id),
  check (bundle_product_id <> component_product_id)
);

alter table public.product_bundle_items enable row level security;

drop policy if exists "Public can read active bundle composition" on public.product_bundle_items;
create policy "Public can read active bundle composition"
on public.product_bundle_items
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = bundle_product_id and p.active = true
  )
);

drop policy if exists "Admins manage bundle composition" on public.product_bundle_items;
create policy "Admins manage bundle composition"
on public.product_bundle_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
