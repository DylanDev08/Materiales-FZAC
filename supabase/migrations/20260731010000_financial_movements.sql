-- Administrative cash movements that are not already represented by paid orders.
-- The ledger is append-only: entries can be voided, never deleted or rewritten.

begin;

create table if not exists public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('INCOME', 'EXPENSE')),
  category text not null check (char_length(category) between 2 and 80),
  description text not null check (char_length(description) between 3 and 240),
  amount numeric(14,2) not null check (amount > 0),
  occurred_at timestamptz not null default now(),
  source text not null default 'MANUAL' check (source in ('MANUAL', 'ADJUSTMENT')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'VOID')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  voided_by uuid references public.profiles(id) on delete restrict,
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) between 3 and 240),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'ACTIVE' and voided_by is null and voided_at is null and void_reason is null)
    or
    (status = 'VOID' and voided_by is not null and voided_at is not null and void_reason is not null)
  )
);

create index if not exists financial_movements_period_idx
  on public.financial_movements(occurred_at desc)
  where status = 'ACTIVE';

create index if not exists financial_movements_type_period_idx
  on public.financial_movements(type, occurred_at desc)
  where status = 'ACTIVE';

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
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.metadata is distinct from old.metadata then
    raise exception 'Los datos contables no pueden reescribirse; anulá el movimiento y registrá uno nuevo.';
  end if;

  if new.status <> 'VOID' or new.voided_by is null or new.voided_at is null or new.void_reason is null then
    raise exception 'La única modificación permitida es anular el movimiento con motivo y responsable.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_financial_movement_ledger on public.financial_movements;
create trigger protect_financial_movement_ledger
before update on public.financial_movements
for each row execute function public.protect_financial_movement_ledger();

alter table public.financial_movements enable row level security;
alter table public.financial_movements force row level security;

drop policy if exists "admin financial movements read" on public.financial_movements;
drop policy if exists "admin financial movements insert" on public.financial_movements;
drop policy if exists "admin financial movements update" on public.financial_movements;

create policy "admin financial movements read"
on public.financial_movements for select
using (public.is_admin());

create policy "admin financial movements insert"
on public.financial_movements for insert
with check (public.is_admin() and created_by = auth.uid() and status = 'ACTIVE');

create policy "admin financial movements update"
on public.financial_movements for update
using (public.is_admin())
with check (public.is_admin() and status = 'VOID' and voided_by = auth.uid());

revoke all on table public.financial_movements from anon;
revoke delete on table public.financial_movements from authenticated;
grant select, insert, update on table public.financial_movements to authenticated;
grant all on table public.financial_movements to service_role;

revoke execute on function public.protect_financial_movement_ledger() from public, anon, authenticated;

comment on table public.financial_movements is
  'Libro administrativo de ingresos y egresos manuales. Las ventas aprobadas se obtienen de orders y no deben duplicarse aquí.';

commit;
