-- Align the inherited inventory schema with the current refund RPC.

begin;

alter table public.inventory_movements
add column if not exists actor_id uuid;

update public.inventory_movements movement
set actor_id = profile.id
from public.profiles profile
where movement.actor_id is null
  and movement.created_by = profile.id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_movements'::regclass
      and conname = 'inventory_movements_actor_id_fkey'
  ) then
    alter table public.inventory_movements
      add constraint inventory_movements_actor_id_fkey
      foreign key (actor_id) references public.profiles(id) on delete set null;
  end if;
end
$$;

create index if not exists inventory_movements_actor_created_idx
on public.inventory_movements(actor_id, created_at desc)
where actor_id is not null;

commit;
