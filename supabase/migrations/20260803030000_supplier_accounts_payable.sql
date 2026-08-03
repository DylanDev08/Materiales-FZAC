-- Supplier accounts payable. Purchase commitments, stock receipts and cash payments
-- remain separate events and are connected through auditable references.

begin;

alter table public.financial_movements
  add column if not exists source_reference text;

alter table public.financial_movements
  drop constraint if exists financial_movements_source_check;

alter table public.financial_movements
  add constraint financial_movements_source_check
  check (source in ('MANUAL', 'ADJUSTMENT', 'PURCHASE_PAYMENT'));

create unique index if not exists financial_movements_source_reference_uidx
  on public.financial_movements(source, source_reference)
  where source_reference is not null;

create table if not exists public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  invoice_number text not null check (char_length(invoice_number) between 2 and 80),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PARTIALLY_PAID', 'PAID', 'VOID')),
  currency text not null default 'ARS' check (currency = 'ARS'),
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  issued_at date not null,
  due_at date not null,
  notes text check (notes is null or char_length(notes) <= 600),
  created_by uuid not null references public.profiles(id) on delete restrict,
  voided_by uuid references public.profiles(id) on delete restrict,
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) between 3 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, invoice_number),
  check (due_at >= issued_at),
  check (
    (status = 'VOID' and voided_by is not null and voided_at is not null and void_reason is not null)
    or
    (status <> 'VOID' and voided_by is null and voided_at is null and void_reason is null)
  )
);

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  supplier_invoice_id uuid not null references public.supplier_invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('BANK_TRANSFER', 'CASH', 'CARD', 'OTHER')),
  reference text check (reference is null or char_length(reference) <= 120),
  paid_at timestamptz not null,
  notes text check (notes is null or char_length(notes) <= 600),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'VOID')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  voided_by uuid references public.profiles(id) on delete restrict,
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) between 3 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'VOID' and voided_by is not null and voided_at is not null and void_reason is not null)
    or
    (status = 'ACTIVE' and voided_by is null and voided_at is null and void_reason is null)
  )
);

create index if not exists supplier_invoices_status_due_idx
  on public.supplier_invoices(status, due_at);
create index if not exists supplier_invoices_supplier_due_idx
  on public.supplier_invoices(supplier_id, due_at desc);
create index if not exists supplier_invoices_order_idx
  on public.supplier_invoices(purchase_order_id);
create index if not exists supplier_payments_invoice_paid_idx
  on public.supplier_payments(supplier_invoice_id, paid_at desc);

drop trigger if exists supplier_invoices_updated_at on public.supplier_invoices;
create trigger supplier_invoices_updated_at before update on public.supplier_invoices
for each row execute function public.set_updated_at();

drop trigger if exists supplier_payments_updated_at on public.supplier_payments;
create trigger supplier_payments_updated_at before update on public.supplier_payments
for each row execute function public.set_updated_at();

alter table public.supplier_invoices enable row level security;
alter table public.supplier_invoices force row level security;
alter table public.supplier_payments enable row level security;
alter table public.supplier_payments force row level security;

drop policy if exists "admin supplier invoices read" on public.supplier_invoices;
create policy "admin supplier invoices read" on public.supplier_invoices for select to authenticated
using (public.is_admin());

drop policy if exists "admin supplier payments read" on public.supplier_payments;
create policy "admin supplier payments read" on public.supplier_payments for select to authenticated
using (public.is_admin());

revoke all on table public.supplier_invoices from anon, authenticated;
revoke all on table public.supplier_payments from anon, authenticated;
grant select on table public.supplier_invoices to authenticated;
grant select on table public.supplier_payments to authenticated;
grant all on table public.supplier_invoices to service_role;
grant all on table public.supplier_payments to service_role;

create or replace function public.protect_financial_movement_ledger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'VOID' then
    raise exception 'Los movimientos anulados son inmutables.';
  end if;

  if new.id is distinct from old.id
    or new.type is distinct from old.type
    or new.category is distinct from old.category
    or new.description is distinct from old.description
    or new.amount is distinct from old.amount
    or new.occurred_at is distinct from old.occurred_at
    or new.source is distinct from old.source
    or new.source_reference is distinct from old.source_reference
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.metadata is distinct from old.metadata then
    raise exception 'Los datos contables no pueden reescribirse; anula el movimiento y registra uno nuevo.';
  end if;

  if new.status <> 'VOID' or new.voided_by is null or new.voided_at is null or new.void_reason is null then
    raise exception 'La unica modificacion permitida es anular el movimiento con motivo y responsable.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.register_supplier_invoice(
  p_purchase_order_id uuid,
  p_request_key uuid,
  p_invoice_number text,
  p_amount numeric,
  p_issued_at date,
  p_due_at date,
  p_notes text,
  p_actor_id uuid
)
returns table(invoice_id uuid, invoice_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_existing public.supplier_invoices%rowtype;
  v_invoiced numeric(14,2);
  v_invoice_id uuid := gen_random_uuid();
begin
  if p_actor_id is null or not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'Administrador invalido.';
  end if;
  if p_amount <= 0 or p_due_at < p_issued_at then
    raise exception 'Importe o vencimiento invalido.';
  end if;

  select * into v_existing from public.supplier_invoices where request_key = p_request_key;
  if found then
    return query select v_existing.id, v_existing.status;
    return;
  end if;

  select * into v_order from public.purchase_orders where id = p_purchase_order_id for update;
  if not found or v_order.status not in ('ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED') then
    raise exception 'La orden no admite facturas de proveedor.';
  end if;

  select coalesce(sum(amount), 0) into v_invoiced
  from public.supplier_invoices
  where purchase_order_id = p_purchase_order_id and status <> 'VOID';
  if v_invoiced + p_amount > v_order.total then
    raise exception 'El total facturado supera el total de la orden.';
  end if;

  begin
    insert into public.supplier_invoices (
      id, request_key, supplier_id, purchase_order_id, invoice_number,
      amount, issued_at, due_at, notes, created_by
    ) values (
      v_invoice_id, p_request_key, v_order.supplier_id, p_purchase_order_id,
      upper(trim(p_invoice_number)), p_amount, p_issued_at, p_due_at,
      nullif(trim(p_notes), ''), p_actor_id
    );
  exception when unique_violation then
    select * into v_existing from public.supplier_invoices where request_key = p_request_key;
    if found then
      return query select v_existing.id, v_existing.status;
      return;
    end if;
    raise;
  end;

  insert into public.admin_audit_logs (
    actor_id, action, entity, entity_id, message, metadata
  ) values (
    p_actor_id, 'SUPPLIER_INVOICE_CREATED', 'supplier_invoices', v_invoice_id::text,
    'Factura de proveedor registrada: ' || upper(trim(p_invoice_number)),
    jsonb_build_object('purchase_order_id', p_purchase_order_id, 'amount', p_amount, 'due_at', p_due_at)
  );

  return query select v_invoice_id, 'PENDING'::text;
end;
$$;

create or replace function public.register_supplier_payment(
  p_supplier_invoice_id uuid,
  p_request_key uuid,
  p_amount numeric,
  p_method text,
  p_reference text,
  p_paid_at timestamptz,
  p_notes text,
  p_actor_id uuid
)
returns table(payment_id uuid, invoice_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.supplier_invoices%rowtype;
  v_existing public.supplier_payments%rowtype;
  v_supplier_name text;
  v_payment_id uuid := gen_random_uuid();
  v_new_paid numeric(14,2);
  v_status text;
begin
  if p_actor_id is null or not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'Administrador invalido.';
  end if;
  if p_amount <= 0 or p_method not in ('BANK_TRANSFER', 'CASH', 'CARD', 'OTHER') then
    raise exception 'Datos de pago invalidos.';
  end if;

  select * into v_existing from public.supplier_payments where request_key = p_request_key;
  if found then
    select status into v_status from public.supplier_invoices where id = v_existing.supplier_invoice_id;
    return query select v_existing.id, v_status;
    return;
  end if;

  select * into v_invoice from public.supplier_invoices where id = p_supplier_invoice_id for update;
  if not found or v_invoice.status not in ('PENDING', 'PARTIALLY_PAID') then
    raise exception 'La factura no admite pagos.';
  end if;
  if p_amount > v_invoice.amount - v_invoice.paid_amount then
    raise exception 'El pago supera el saldo pendiente.';
  end if;

  select name into v_supplier_name from public.suppliers where id = v_invoice.supplier_id;
  begin
    insert into public.supplier_payments (
      id, request_key, supplier_invoice_id, amount, method, reference,
      paid_at, notes, created_by
    ) values (
      v_payment_id, p_request_key, p_supplier_invoice_id, p_amount, p_method,
      nullif(trim(p_reference), ''), p_paid_at, nullif(trim(p_notes), ''), p_actor_id
    );
  exception when unique_violation then
    select * into v_existing from public.supplier_payments where request_key = p_request_key;
    if found then
      select status into v_status from public.supplier_invoices where id = v_existing.supplier_invoice_id;
      return query select v_existing.id, v_status;
      return;
    end if;
    raise;
  end;

  v_new_paid := v_invoice.paid_amount + p_amount;
  v_status := case when v_new_paid = v_invoice.amount then 'PAID' else 'PARTIALLY_PAID' end;
  update public.supplier_invoices set paid_amount = v_new_paid, status = v_status
  where id = p_supplier_invoice_id;

  insert into public.financial_movements (
    type, category, description, amount, occurred_at, source, source_reference,
    status, created_by, metadata
  ) values (
    'EXPENSE', 'Pago a proveedor',
    'Pago a ' || coalesce(v_supplier_name, 'proveedor') || ' - factura ' || v_invoice.invoice_number,
    p_amount, p_paid_at, 'PURCHASE_PAYMENT', v_payment_id::text, 'ACTIVE', p_actor_id,
    jsonb_build_object(
      'supplier_payment_id', v_payment_id,
      'supplier_invoice_id', p_supplier_invoice_id,
      'purchase_order_id', v_invoice.purchase_order_id,
      'supplier_id', v_invoice.supplier_id,
      'method', p_method
    )
  );

  insert into public.admin_audit_logs (
    actor_id, action, entity, entity_id, message, metadata
  ) values (
    p_actor_id, 'SUPPLIER_PAYMENT_CREATED', 'supplier_payments', v_payment_id::text,
    'Pago a proveedor registrado para factura ' || v_invoice.invoice_number,
    jsonb_build_object('supplier_invoice_id', p_supplier_invoice_id, 'amount', p_amount, 'method', p_method)
  );

  return query select v_payment_id, v_status;
end;
$$;

create or replace function public.void_supplier_payment(
  p_payment_id uuid,
  p_reason text,
  p_actor_id uuid
)
returns table(payment_id uuid, invoice_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.supplier_payments%rowtype;
  v_invoice public.supplier_invoices%rowtype;
  v_new_paid numeric(14,2);
  v_status text;
  v_now timestamptz := now();
begin
  if p_actor_id is null or not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'Administrador invalido.';
  end if;
  if char_length(trim(p_reason)) < 3 then raise exception 'Motivo invalido.'; end if;

  select * into v_payment from public.supplier_payments where id = p_payment_id for update;
  if not found or v_payment.status <> 'ACTIVE' then raise exception 'El pago no existe o ya fue anulado.'; end if;
  select * into v_invoice from public.supplier_invoices where id = v_payment.supplier_invoice_id for update;
  if not found or v_invoice.status = 'VOID' then raise exception 'La factura no esta disponible.'; end if;

  update public.supplier_payments set
    status = 'VOID', voided_by = p_actor_id, voided_at = v_now, void_reason = trim(p_reason)
  where id = p_payment_id;

  v_new_paid := greatest(0, v_invoice.paid_amount - v_payment.amount);
  v_status := case when v_new_paid = 0 then 'PENDING' else 'PARTIALLY_PAID' end;
  update public.supplier_invoices set paid_amount = v_new_paid, status = v_status
  where id = v_invoice.id;

  update public.financial_movements set
    status = 'VOID', voided_by = p_actor_id, voided_at = v_now, void_reason = trim(p_reason)
  where source = 'PURCHASE_PAYMENT' and source_reference = p_payment_id::text and status = 'ACTIVE';

  insert into public.admin_audit_logs (
    actor_id, action, entity, entity_id, message, metadata
  ) values (
    p_actor_id, 'SUPPLIER_PAYMENT_VOIDED', 'supplier_payments', p_payment_id::text,
    'Pago a proveedor anulado.',
    jsonb_build_object('supplier_invoice_id', v_invoice.id, 'amount', v_payment.amount, 'reason', trim(p_reason))
  );

  return query select p_payment_id, v_status;
end;
$$;

create or replace function public.void_supplier_invoice(
  p_invoice_id uuid,
  p_reason text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.supplier_invoices%rowtype;
begin
  if p_actor_id is null or not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'Administrador invalido.';
  end if;
  if char_length(trim(p_reason)) < 3 then raise exception 'Motivo invalido.'; end if;

  select * into v_invoice from public.supplier_invoices where id = p_invoice_id for update;
  if not found or v_invoice.status <> 'PENDING' or v_invoice.paid_amount <> 0 then
    raise exception 'Solo se pueden anular facturas pendientes sin pagos.';
  end if;

  update public.supplier_invoices set
    status = 'VOID', voided_by = p_actor_id, voided_at = now(), void_reason = trim(p_reason)
  where id = p_invoice_id;

  insert into public.admin_audit_logs (
    actor_id, action, entity, entity_id, message, metadata
  ) values (
    p_actor_id, 'SUPPLIER_INVOICE_VOIDED', 'supplier_invoices', p_invoice_id::text,
    'Factura de proveedor anulada.', jsonb_build_object('reason', trim(p_reason))
  );
  return p_invoice_id;
end;
$$;

revoke execute on function public.register_supplier_invoice(uuid, uuid, text, numeric, date, date, text, uuid) from public, anon, authenticated;
revoke execute on function public.register_supplier_payment(uuid, uuid, numeric, text, text, timestamptz, text, uuid) from public, anon, authenticated;
revoke execute on function public.void_supplier_payment(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.void_supplier_invoice(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.register_supplier_invoice(uuid, uuid, text, numeric, date, date, text, uuid) to service_role;
grant execute on function public.register_supplier_payment(uuid, uuid, numeric, text, text, timestamptz, text, uuid) to service_role;
grant execute on function public.void_supplier_payment(uuid, text, uuid) to service_role;
grant execute on function public.void_supplier_invoice(uuid, text, uuid) to service_role;

comment on table public.supplier_invoices is 'Private supplier invoices linked to supervised purchase orders.';
comment on table public.supplier_payments is 'Immutable supplier payment ledger. Active entries create one linked cash expense.';
comment on function public.register_supplier_payment(uuid, uuid, numeric, text, text, timestamptz, text, uuid)
  is 'Atomically records a supplier payment and its linked financial expense once.';

commit;
