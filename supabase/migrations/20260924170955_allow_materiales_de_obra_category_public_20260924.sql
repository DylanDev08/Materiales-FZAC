begin;

drop policy if exists categories_public_read_active on public.categories;

create policy categories_public_read_active
on public.categories
for select
to anon, authenticated
using (
  active = true
  and slug = any (
    array[
      'construccion-en-seco'::text,
      'steel-framing'::text,
      'ferreteria'::text,
      'pintura-impermeabilizacion'::text,
      'materiales-de-obra'::text
    ]
  )
);

commit;
