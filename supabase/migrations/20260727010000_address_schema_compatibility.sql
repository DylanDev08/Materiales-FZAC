-- Bridge the legacy Prisma address table to the current Supabase contract.
-- Existing camelCase columns remain available; no address record is deleted.

begin;

-- The remote project originally had a Prisma text id, while a clean replay of
-- the current base migration creates a uuid id. Keep both histories valid.
do $$
declare
  v_id_type text;
begin
  select data_type into v_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'addresses' and column_name = 'id';

  if v_id_type = 'uuid' then
    alter table public.addresses alter column id set default gen_random_uuid();
  else
    alter table public.addresses alter column id set default gen_random_uuid()::text;
  end if;
end
$$;

alter table public.addresses
  add column if not exists user_id uuid,
  add column if not exists postal_code text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists "userId" text,
  add column if not exists "postalCode" text not null default '',
  add column if not exists "createdAt" timestamp without time zone not null default (now() at time zone 'UTC'),
  add column if not exists "updatedAt" timestamp without time zone not null default (now() at time zone 'UTC');

update public.addresses
set "userId" = user_id::text
where "userId" is null and user_id is not null;

update public.addresses a
set user_id = p.id
from public.profiles p
where a.user_id is null
  and a."userId" = p.id::text;

update public.addresses
set postal_code = nullif("postalCode", ''),
    created_at = coalesce("createdAt" at time zone 'UTC', now()),
    updated_at = coalesce("updatedAt" at time zone 'UTC', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.addresses'::regclass
      and conname = 'addresses_user_id_fkey'
  ) then
    alter table public.addresses
      add constraint addresses_user_id_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end
$$;

create index if not exists addresses_user_id_created_idx
on public.addresses(user_id, created_at desc);

create or replace function public.sync_legacy_address_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is null and new."userId" is not null then
    select p.id
    into new.user_id
    from public.profiles p
    where p.id::text = new."userId";
  end if;

  if new.user_id is not null then
    new."userId" := new.user_id::text;
  end if;

  new.postal_code := coalesce(new.postal_code, nullif(new."postalCode", ''));
  new."postalCode" := coalesce(new.postal_code, '');
  new."createdAt" := coalesce(new."createdAt", now() at time zone 'UTC');
  new."updatedAt" := now() at time zone 'UTC';
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists sync_legacy_address_columns on public.addresses;
create trigger sync_legacy_address_columns
before insert or update on public.addresses
for each row execute function public.sync_legacy_address_columns();

revoke execute on function public.sync_legacy_address_columns()
from public, anon, authenticated;
grant execute on function public.sync_legacy_address_columns()
to service_role;

commit;
