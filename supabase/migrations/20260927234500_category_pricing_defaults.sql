begin;

update public.category_pricing_rules r
set target_margin_pct = case c.slug
  when 'materiales-de-obra' then 5
  when 'construccion-en-seco' then 5
  when 'steel-framing' then 5
  when 'ferreteria' then 8
  when 'herramientas' then 8
  when 'electricidad' then 8
  when 'plomeria' then 8
  when 'pintura-impermeabilizacion' then 8
  when 'revestimientos' then 8
  else r.target_margin_pct
end,
auto_update_threshold_pct = 15,
alert_over_market_pct = 15,
active = true,
updated_at = now()
from public.categories c
where c.id = r.category_id;

commit;