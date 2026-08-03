-- Follow-up integrity guards for the supplier finance ledger.

begin;

drop policy if exists "admin financial movements insert" on public.financial_movements;
create policy "admin financial movements insert"
on public.financial_movements for insert
with check (
  public.is_admin()
  and created_by = auth.uid()
  and status = 'ACTIVE'
  and source in ('MANUAL', 'ADJUSTMENT')
  and source_reference is null
);

drop policy if exists "admin financial movements update" on public.financial_movements;
create policy "admin financial movements update"
on public.financial_movements for update
using (public.is_admin() and source in ('MANUAL', 'ADJUSTMENT'))
with check (public.is_admin() and source in ('MANUAL', 'ADJUSTMENT') and status = 'VOID' and voided_by = auth.uid());

create or replace function public.validate_supplier_finance_dates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'supplier_invoices' and new.issued_at > current_date + 1 then
    raise exception 'La fecha de emision no puede estar en el futuro.';
  end if;
  if tg_table_name = 'supplier_payments' and new.paid_at > now() + interval '5 minutes' then
    raise exception 'La fecha de pago no puede estar en el futuro.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_supplier_invoice_dates on public.supplier_invoices;
create trigger validate_supplier_invoice_dates
before insert on public.supplier_invoices
for each row execute function public.validate_supplier_finance_dates();

drop trigger if exists validate_supplier_payment_dates on public.supplier_payments;
create trigger validate_supplier_payment_dates
before insert on public.supplier_payments
for each row execute function public.validate_supplier_finance_dates();

create or replace function public.protect_supplier_payment_ledger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'VOID' then
    raise exception 'Los pagos anulados son inmutables.';
  end if;
  if new.id is distinct from old.id
    or new.request_key is distinct from old.request_key
    or new.supplier_invoice_id is distinct from old.supplier_invoice_id
    or new.amount is distinct from old.amount
    or new.method is distinct from old.method
    or new.reference is distinct from old.reference
    or new.paid_at is distinct from old.paid_at
    or new.notes is distinct from old.notes
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Los datos del pago no pueden reescribirse; anula el pago y registra uno nuevo.';
  end if;
  if new.status <> 'VOID' or new.voided_by is null or new.voided_at is null or new.void_reason is null then
    raise exception 'La unica modificacion permitida es anular el pago con motivo y responsable.';
  end if;
  if not exists (
    select 1 from public.financial_movements
    where source = 'PURCHASE_PAYMENT'
      and source_reference = old.id::text
      and status = 'ACTIVE'
  ) then
    raise exception 'El pago no tiene un egreso activo asociado.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_supplier_payment_ledger on public.supplier_payments;
create trigger protect_supplier_payment_ledger
before update on public.supplier_payments
for each row execute function public.protect_supplier_payment_ledger();

revoke execute on function public.validate_supplier_finance_dates() from public, anon, authenticated;
revoke execute on function public.protect_supplier_payment_ledger() from public, anon, authenticated;

comment on function public.protect_supplier_payment_ledger()
  is 'Keeps supplier payments immutable and requires one active linked cash expense before voiding.';

commit;
