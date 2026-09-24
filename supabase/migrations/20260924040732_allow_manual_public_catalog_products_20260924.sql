create or replace function private.is_public_catalog_entry(
  p_supplier_id uuid,
  p_category_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    (
      p_supplier_id is null
      or exists (
        select 1
        from public.suppliers s
        where s.id = p_supplier_id
          and s.active = true
          and s.code in ('LA-YESERA-ROSARINA', 'UNIVERSO-PINTURAS-SRL')
      )
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
          'pintura-impermeabilizacion',
          'materiales-de-obra'
        )
    );
$function$;

revoke all on function private.is_public_catalog_entry(uuid, uuid) from public, anon, authenticated;
grant execute on function private.is_public_catalog_entry(uuid, uuid) to service_role;
