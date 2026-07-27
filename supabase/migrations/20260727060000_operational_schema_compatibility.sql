-- Complete columns expected by notifications, ticket cancellation and audit RPCs.

begin;

alter table public.purchase_tickets
add column if not exists updated_at timestamptz not null default now();

alter table public.notifications
add column if not exists updated_at timestamptz not null default now();

alter table public.admin_audit_logs
  add column if not exists actor_id uuid,
  add column if not exists actor_email text,
  add column if not exists actor_role text,
  add column if not exists ip text,
  add column if not exists user_agent text;

update public.admin_audit_logs audit
set actor_id = profile.id
from public.profiles profile
where audit.actor_id is null
  and audit.admin_id = profile.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_audit_logs'::regclass
      and conname = 'admin_audit_logs_actor_id_fkey'
  ) then
    alter table public.admin_audit_logs
      add constraint admin_audit_logs_actor_id_fkey
      foreign key (actor_id) references public.profiles(id) on delete set null;
  end if;
end
$$;

create index if not exists admin_audit_logs_actor_created_idx
on public.admin_audit_logs(actor_id, created_at desc)
where actor_id is not null;

commit;
