-- Use table-specific date validators: PostgreSQL validates NEW fields per trigger relation.

begin;

drop trigger if exists validate_supplier_invoice_dates on public.supplier_invoices;
drop trigger if exists validate_supplier_payment_dates on public.supplier_payments;
drop function if exists public.validate_supplier_finance_dates();

create or replace function public.validate_supplier_invoice_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.issued_at > current_date + 1 then
    raise exception 'La fecha de emision no puede estar en el futuro.';
  end if;
  return new;
end;
$$;

create or replace function public.validate_supplier_payment_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.paid_at > now() + interval '5 minutes' then
    raise exception 'La fecha de pago no puede estar en el futuro.';
  end if;
  return new;
end;
$$;

create trigger validate_supplier_invoice_dates
before insert on public.supplier_invoices
for each row execute function public.validate_supplier_invoice_date();

create trigger validate_supplier_payment_dates
before insert on public.supplier_payments
for each row execute function public.validate_supplier_payment_date();

revoke execute on function public.validate_supplier_invoice_date() from public, anon, authenticated;
revoke execute on function public.validate_supplier_payment_date() from public, anon, authenticated;

commit;
