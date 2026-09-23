-- Remove stale reference prices that are lower than the current price
-- when the product is not marked as on sale.
update public.products
set compare_price = null,
    updated_at = now()
where on_sale = false
  and compare_price is not null
  and compare_price < price;
