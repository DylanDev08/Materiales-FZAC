alter table public.product_supplier_sources
  add column if not exists manual_review_required boolean not null default false,
  add column if not exists manual_review_reason text;

update public.product_supplier_sources pss
set manual_review_required = true,
    manual_review_reason = 'Precio fuente menor a ARS 1000 en Universo; revisar contra proveedor antes de recalcular.'
from public.suppliers s
where s.id = pss.supplier_id
  and s.code = 'UNIVERSO-PINTURAS-SRL'
  and pss.original_price is not null
  and pss.original_price > 0
  and pss.original_price < 1000
  and not pss.manual_review_required;

create or replace function public.apply_supplier_pricing_rule(p_supplier_code text)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
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
    and pss.original_price > 0
    and not coalesce(pss.manual_review_required, false);

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
    and pss.original_price > 0
    and not coalesce(pss.manual_review_required, false);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$function$;

revoke execute on function public.apply_supplier_pricing_rule(text) from public, anon, authenticated;
grant execute on function public.apply_supplier_pricing_rule(text) to service_role;
