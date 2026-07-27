-- Supabase Auth profiles are the current identity source. The legacy Prisma
-- foreign key points to public.users and blocks valid authenticated customers.

begin;

alter table public.addresses
drop constraint if exists "addresses_userId_fkey";

commit;
