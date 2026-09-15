create or replace function public.guard_order_fulfillment_requires_items()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in (
    'PAID','CONFIRMED','PREPARING','READY_FOR_PICKUP',
    'OUT_FOR_DELIVERY','DELIVERED','COMPLETED'
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

create or replace function public.guard_paid_payment_requires_items()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'PAID'
  and (
    tg_op = 'INSERT'
    or old.status is distinct from new.status
  )
  and not exists (
    select 1
    from public.order_items oi
    where oi.order_id = new.order_id
  ) then
    raise exception 'PAYMENT_ORDER_HAS_NO_ITEMS'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_order_fulfillment_requires_items() from public, anon, authenticated;
revoke execute on function public.guard_paid_payment_requires_items() from public, anon, authenticated;
grant execute on function public.guard_order_fulfillment_requires_items() to service_role;
grant execute on function public.guard_paid_payment_requires_items() to service_role;

drop trigger if exists guard_order_fulfillment_requires_items_trigger on public.orders;
create trigger guard_order_fulfillment_requires_items_trigger
before insert or update on public.orders
for each row
execute function public.guard_order_fulfillment_requires_items();

drop trigger if exists guard_paid_payment_requires_items_trigger on public.payments;
create trigger guard_paid_payment_requires_items_trigger
before insert or update on public.payments
for each row
execute function public.guard_paid_payment_requires_items();
