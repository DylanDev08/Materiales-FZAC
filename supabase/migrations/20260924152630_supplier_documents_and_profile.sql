begin;

alter table public.suppliers
  add column if not exists website_url text,
  add column if not exists logo_url text,
  add column if not exists catalog_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'suppliers_website_url_check'
      and conrelid = 'public.suppliers'::regclass
  ) then
    alter table public.suppliers add constraint suppliers_website_url_check
      check (website_url is null or (char_length(website_url) <= 500 and website_url ~* '^https://')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'suppliers_logo_url_check'
      and conrelid = 'public.suppliers'::regclass
  ) then
    alter table public.suppliers add constraint suppliers_logo_url_check
      check (logo_url is null or (char_length(logo_url) <= 500 and logo_url ~* '^https://')) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'suppliers_catalog_url_check'
      and conrelid = 'public.suppliers'::regclass
  ) then
    alter table public.suppliers add constraint suppliers_catalog_url_check
      check (catalog_url is null or (char_length(catalog_url) <= 500 and catalog_url ~* '^https://')) not valid;
  end if;
end $$;

create table if not exists public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 160),
  kind text not null default 'PRICE_LIST'
    check (kind in ('PRICE_LIST', 'CATALOG', 'QUOTE', 'INVOICE', 'OTHER')),
  document_date date,
  file_name text not null check (char_length(file_name) between 1 and 180),
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  mime_type text not null check (mime_type in ('application/pdf', 'text/csv', 'application/vnd.ms-excel')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  notes text check (notes is null or char_length(notes) <= 600),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_document_items (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.supplier_documents(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  supplier_sku text check (supplier_sku is null or char_length(supplier_sku) <= 100),
  supplier_product_name text not null check (char_length(supplier_product_name) between 2 and 180),
  unit text check (unit is null or char_length(unit) <= 40),
  supplier_price numeric(14,2) not null check (supplier_price > 0),
  customer_price_snapshot numeric(14,2) check (customer_price_snapshot is null or customer_price_snapshot >= 0),
  supplier_stock numeric(14,3) check (supplier_stock is null or supplier_stock >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, product_id),
  unique (document_id, supplier_sku)
);

create index if not exists supplier_documents_supplier_created_idx
  on public.supplier_documents (supplier_id, created_at desc);
create index if not exists supplier_document_items_document_idx
  on public.supplier_document_items (document_id);
create index if not exists supplier_document_items_product_idx
  on public.supplier_document_items (product_id)
  where product_id is not null;
create index if not exists supplier_documents_created_by_idx
  on public.supplier_documents (created_by)
  where created_by is not null;
create index if not exists supplier_document_items_created_by_idx
  on public.supplier_document_items (created_by)
  where created_by is not null;

drop trigger if exists supplier_documents_updated_at on public.supplier_documents;
create trigger supplier_documents_updated_at before update on public.supplier_documents
for each row execute function public.set_updated_at();

alter table public.supplier_documents enable row level security;
alter table public.supplier_documents force row level security;
alter table public.supplier_document_items enable row level security;
alter table public.supplier_document_items force row level security;

drop policy if exists "admin supplier documents read" on public.supplier_documents;
create policy "admin supplier documents read" on public.supplier_documents
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "admin supplier document items read" on public.supplier_document_items;
create policy "admin supplier document items read" on public.supplier_document_items
  for select to authenticated using ((select public.is_admin()));

revoke all on table public.supplier_documents from public, anon, authenticated;
revoke all on table public.supplier_document_items from public, anon, authenticated;
grant select on table public.supplier_documents to authenticated;
grant select on table public.supplier_document_items to authenticated;
grant all on table public.supplier_documents to service_role;
grant all on table public.supplier_document_items to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-documents',
  'supplier-documents',
  false,
  10485760,
  array['application/pdf', 'text/csv', 'application/vnd.ms-excel']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.supplier_documents is
  'Private supplier files uploaded by admins. Objects live in the private supplier-documents bucket.';
comment on table public.supplier_document_items is
  'Manually verified supplier document rows. Supplier stock is reference-only and never updates FZAC inventory.';
comment on column public.supplier_document_items.supplier_stock is
  'External supplier stock snapshot. It must never be treated as FZAC sellable stock.';

commit;
