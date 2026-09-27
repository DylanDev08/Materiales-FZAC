begin;

alter table public.financial_movements
  add column if not exists source_reference text;

alter table public.financial_movements
  alter column created_by drop not null;

alter table public.financial_movements
  drop constraint if exists financial_movements_source_check;

alter table public.financial_movements
  add constraint financial_movements_source_check
  check (source in ('MANUAL','ADJUSTMENT','PURCHASE_PAYMENT'));

create unique index if not exists financial_movements_source_reference_uidx
  on public.financial_movements(source, source_reference)
  where source_reference is not null;

create or replace function public.record_paid_order_income()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'PAID'
     and (tg_op = 'INSERT' or old.status is distinct from 'PAID') then
    insert into public.financial_movements (
      type,
      category,
      description,
      amount,
      occurred_at,
      source,
      source_reference,
      status,
      created_by,
      metadata
    )
    values (
      'INCOME',
      'Venta e-commerce',
      'Pago aprobado · pedido ' || upper(substr(new.id::text, 1, 8)),
      new.total,
      coalesce(new.paid_at, now()),
      'PURCHASE_PAYMENT',
      'order:' || new.id::text,
      'ACTIVE',
      null,
      jsonb_build_object(
        'order_id', new.id,
        'customer_email', new.customer_email,
        'customer_name', new.customer_name,
        'automatic', true
      )
    )
    on conflict (source, source_reference) where source_reference is not null
    do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_record_paid_order_income on public.orders;
create trigger trg_record_paid_order_income
after insert or update of status on public.orders
for each row execute function public.record_paid_order_income();

insert into public.financial_movements (
  type, category, description, amount, occurred_at, source,
  source_reference, status, created_by, metadata
)
select
  'INCOME',
  'Venta e-commerce',
  'Pago aprobado · pedido ' || upper(substr(o.id::text, 1, 8)),
  o.total,
  coalesce(o.paid_at, o.updated_at, o.created_at),
  'PURCHASE_PAYMENT',
  'order:' || o.id::text,
  'ACTIVE',
  null,
  jsonb_build_object(
    'order_id', o.id,
    'customer_email', o.customer_email,
    'customer_name', o.customer_name,
    'automatic', true,
    'backfilled', true
  )
from public.orders o
where o.status = 'PAID'
on conflict (source, source_reference) where source_reference is not null
do nothing;

commit;