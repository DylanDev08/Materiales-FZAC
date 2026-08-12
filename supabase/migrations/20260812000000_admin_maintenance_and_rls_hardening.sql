-- Pre-production maintenance and RLS hardening.
-- Business records remain immutable: this migration never deletes orders, payments or tickets.

begin;

create or replace function public.admin_bulk_void_financial_movements(
  p_actor_id uuid,
  p_actor_email text,
  p_type text,
  p_before timestamptz,
  p_reason text,
  p_max_rows integer default 250
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eligible integer;
  v_updated integer;
begin
  -- Serializes this exceptional maintenance action across app instances.
  perform pg_advisory_xact_lock(748291033014::bigint);

  if p_actor_id is null or not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'ADMIN'
  ) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_type not in ('ALL', 'INCOME', 'EXPENSE') then
    raise exception 'INVALID_MOVEMENT_TYPE';
  end if;
  if p_before is null or p_before > now() + interval '1 minute' then
    raise exception 'INVALID_CUTOFF';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 8 and 240 then
    raise exception 'INVALID_REASON';
  end if;
  if p_max_rows < 1 or p_max_rows > 250 then
    raise exception 'INVALID_LIMIT';
  end if;

  select count(*) into v_eligible
  from (
    select id
    from public.financial_movements
    where status = 'ACTIVE'
      and source in ('MANUAL', 'ADJUSTMENT')
      and occurred_at <= p_before
      and (p_type = 'ALL' or type = p_type)
    order by occurred_at, id
    limit p_max_rows + 1
  ) selected;

  if v_eligible = 0 then
    raise exception 'NO_ELIGIBLE_MOVEMENTS';
  end if;
  if v_eligible > p_max_rows then
    raise exception 'TOO_MANY_MOVEMENTS';
  end if;

  with selected as (
    select id
    from public.financial_movements
    where status = 'ACTIVE'
      and source in ('MANUAL', 'ADJUSTMENT')
      and occurred_at <= p_before
      and (p_type = 'ALL' or type = p_type)
    order by occurred_at, id
    limit p_max_rows
    for update
  )
  update public.financial_movements movement
  set status = 'VOID',
      voided_by = p_actor_id,
      voided_at = now(),
      void_reason = trim(p_reason),
      updated_at = now()
  from selected
  where movement.id = selected.id
    and movement.status = 'ACTIVE';

  get diagnostics v_updated = row_count;

  insert into public.admin_audit_logs (
    actor_id, actor_email, actor_role, action, entity, message, metadata
  ) values (
    p_actor_id,
    p_actor_email,
    'ADMIN',
    'FINANCIAL_MOVEMENTS_BULK_VOIDED',
    'financial_movements',
    v_updated || ' movimientos manuales anulados en una operacion controlada.',
    jsonb_build_object(
      'count', v_updated,
      'movement_type', p_type,
      'before', p_before,
      'reason', trim(p_reason)
    )
  );

  return jsonb_build_object('ok', true, 'count', v_updated);
end;
$$;

revoke execute on function public.admin_bulk_void_financial_movements(uuid, text, text, timestamptz, text, integer)
from public, anon, authenticated;
grant execute on function public.admin_bulk_void_financial_movements(uuid, text, text, timestamptz, text, integer)
to service_role;

-- Sensitive business tables are always governed by their RLS policies, even for table owners.
alter table if exists public.profiles force row level security;
alter table if exists public.addresses force row level security;
alter table if exists public.cart_items force row level security;
alter table if exists public.orders force row level security;
alter table if exists public.order_items force row level security;
alter table if exists public.payments force row level security;
alter table if exists public.payment_events force row level security;
alter table if exists public.purchase_tickets force row level security;
alter table if exists public.purchase_ticket_items force row level security;
alter table if exists public.inventory_movements force row level security;
alter table if exists public.notifications force row level security;
alter table if exists public.admin_audit_logs force row level security;
alter table if exists public.chat_conversations force row level security;
alter table if exists public.chat_messages force row level security;
alter table if exists public.favorites force row level security;
alter table if exists public.reviews force row level security;
alter table if exists public.search_events force row level security;
alter table if exists public.product_views force row level security;

-- Analytics are written through rate-limited server endpoints only.
drop policy if exists "search events owner insert" on public.search_events;
drop policy if exists "search_events_owner_insert" on public.search_events;
revoke insert, update, delete on table public.search_events from anon, authenticated;
revoke insert, update, delete on table public.product_views from anon, authenticated;

-- Server routes own all money and stock mutations. Authenticated users retain RLS-scoped reads only.
revoke insert, update, delete on table public.orders from anon, authenticated;
revoke insert, update, delete on table public.order_items from anon, authenticated;
revoke insert, update, delete on table public.payments from anon, authenticated;
revoke insert, update, delete on table public.purchase_tickets from anon, authenticated;
revoke insert, update, delete on table public.purchase_ticket_items from anon, authenticated;
revoke insert, update, delete on table public.inventory_movements from anon, authenticated;
revoke insert, update, delete on table public.admin_audit_logs from anon, authenticated;

grant select on table public.orders, public.order_items, public.payments,
  public.purchase_tickets, public.purchase_ticket_items to authenticated;

commit;
