begin;

create or replace function public.guard_order_fulfillment_requires_items()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.status in (
    'PAID','CONFIRMED','PREPARING','READY_FOR_PICKUP',
    'READY_FOR_DELIVERY','OUT_FOR_DELIVERY','DELIVERED','COMPLETED'
  )
  and (
    tg_op = 'INSERT'
    or old.status is distinct from new.status
  )
  and not exists (
    select 1
    from public.order_items oi
    where oi.order_id = new.id
  ) then
    raise exception 'ORDER_HAS_NO_ITEMS'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

commit;