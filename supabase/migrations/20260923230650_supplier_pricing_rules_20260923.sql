alter table public.suppliers
  add column if not exists pricing_margin_percent numeric(7,2),
  add column if not exists pricing_threshold_amount numeric(14,2),
  add column if not exists pricing_margin_above_threshold_percent numeric(7,2),
  add column if not exists pricing_round_to_whole_peso boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suppliers_pricing_margin_percent_check') then
    alter table public.suppliers
      add constraint suppliers_pricing_margin_percent_check
      check (pricing_margin_percent is null or (pricing_margin_percent >= 0 and pricing_margin_percent <= 200));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suppliers_pricing_margin_above_check') then
    alter table public.suppliers
      add constraint suppliers_pricing_margin_above_check
      check (pricing_margin_above_threshold_percent is null or (pricing_margin_above_threshold_percent >= 0 and pricing_margin_above_threshold_percent <= 200));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suppliers_pricing_threshold_check') then
    alter table public.suppliers
      add constraint suppliers_pricing_threshold_check
      check (pricing_threshold_amount is null or pricing_threshold_amount > 0);
  end if;
end $$;

update public.suppliers
set pricing_margin_percent = coalesce(pricing_margin_percent, 20),
    pricing_threshold_amount = coalesce(pricing_threshold_amount, 60000),
    pricing_margin_above_threshold_percent = coalesce(pricing_margin_above_threshold_percent, 10),
    pricing_round_to_whole_peso = true
where code = 'LA-YESERA-ROSARINA';

update public.suppliers
set pricing_margin_percent = coalesce(pricing_margin_percent, 0),
    pricing_threshold_amount = null,
    pricing_margin_above_threshold_percent = null,
    pricing_round_to_whole_peso = false
where code = 'UNIVERSO-PINTURAS-SRL';

create or replace function public.apply_supplier_pricing_rule(p_supplier_code text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier record;
  v_updated integer := 0;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select id, code, pricing_margin_percent, pricing_threshold_amount,
         pricing_margin_above_threshold_percent, pricing_round_to_whole_peso
    into v_supplier
  from public.suppliers
  where code = p_supplier_code
    and active = true
  limit 1;

  if v_supplier.id is null then
    raise exception 'SUPPLIER_NOT_FOUND';
  end if;
  if v_supplier.pricing_margin_percent is null then
    raise exception 'SUPPLIER_MARGIN_NOT_CONFIGURED';
  end if;

  update public.product_supplier_sources pss
  set margin_percent = case
        when v_supplier.pricing_threshold_amount is not null
         and v_supplier.pricing_margin_above_threshold_percent is not null
         and pss.original_price > v_supplier.pricing_threshold_amount
          then v_supplier.pricing_margin_above_threshold_percent
        else v_supplier.pricing_margin_percent
      end,
      checked_at = now()
  where pss.supplier_id = v_supplier.id
    and pss.original_price is not null
    and pss.original_price > 0;

  update public.products p
  set price = case
        when v_supplier.pricing_round_to_whole_peso then
          round(pss.original_price * (1 + pss.margin_percent / 100.0))
        else
          round(pss.original_price * (1 + pss.margin_percent / 100.0), 2)
      end,
      updated_at = now()
  from public.product_supplier_sources pss
  where p.id = pss.product_id
    and pss.supplier_id = v_supplier.id
    and p.active = true
    and pss.original_price is not null
    and pss.original_price > 0;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.apply_supplier_pricing_rule(text) from public, anon, authenticated;
grant execute on function public.apply_supplier_pricing_rule(text) to service_role;
