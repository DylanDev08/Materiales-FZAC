-- Recalculates only products explicitly linked to La Yesera Rosarina.
-- Source prices remain private; no stock or availability fields are changed.

begin;

with expected as (
  select
    pss.product_id,
    round(
      pss.original_price * case when pss.original_price > 60000 then 1.10 else 1.20 end
    )::numeric as price
  from public.product_supplier_sources pss
  join public.suppliers s on s.id = pss.supplier_id
  where (s.code = 'LA-YESERA-ROSARINA' or s.name ilike '%yesera%')
    and pss.original_price is not null
    and pss.original_price > 0
)
update public.products p
set price = expected.price,
    updated_at = now()
from expected
where p.id = expected.product_id
  and p.price is distinct from expected.price;

update public.product_supplier_sources pss
set margin_percent = case when pss.original_price > 60000 then 10 else 20 end,
    checked_at = now()
from public.suppliers s
where s.id = pss.supplier_id
  and (s.code = 'LA-YESERA-ROSARINA' or s.name ilike '%yesera%')
  and pss.original_price is not null
  and pss.original_price > 0
  and pss.margin_percent is distinct from
    case when pss.original_price > 60000 then 10 else 20 end;

commit;
