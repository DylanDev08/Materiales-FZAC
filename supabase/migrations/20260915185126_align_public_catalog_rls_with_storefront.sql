create or replace function private.is_public_catalog_entry(p_supplier_id uuid, p_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.suppliers s
      where s.id = p_supplier_id
        and s.active = true
        and s.code in ('LA-YESERA-ROSARINA', 'UNIVERSO-PINTURAS-SRL')
    )
    and exists (
      select 1
      from public.categories c
      where c.id = p_category_id
        and c.active = true
        and c.slug in (
          'construccion-en-seco',
          'steel-framing',
          'ferreteria',
          'pintura-impermeabilizacion'
        )
    );
$$;

revoke all on function private.is_public_catalog_entry(uuid, uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_public_catalog_entry(uuid, uuid) to anon, authenticated, service_role;

drop policy if exists products_public_read_active on public.products;
create policy products_public_read_active
on public.products
for select
to anon, authenticated
using (
  active = true
  and (select private.is_public_catalog_entry(supplier_id, category_id))
);

drop policy if exists categories_public_read_active on public.categories;
create policy categories_public_read_active
on public.categories
for select
to anon, authenticated
using (
  active = true
  and slug in (
    'construccion-en-seco',
    'steel-framing',
    'ferreteria',
    'pintura-impermeabilizacion'
  )
);

drop policy if exists reviews_public_read_approved on public.reviews;
create policy reviews_public_read_approved
on public.reviews
for select
to anon, authenticated
using (
  approved = true
  and exists (
    select 1
    from public.products p
    where p.id = reviews.product_id
  )
);;\n