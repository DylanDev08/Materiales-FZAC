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
    'pintura-impermeabilizacion',
    'materiales-de-obra',
    'herramientas'
  )
);
