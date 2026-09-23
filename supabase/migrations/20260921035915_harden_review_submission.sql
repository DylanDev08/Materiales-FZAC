
drop policy if exists "reviews_owner_insert" on public.reviews;
create policy "reviews_owner_insert"
on public.reviews
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and approved = false
);

alter table public.reviews
  drop constraint if exists reviews_comment_length_check;
alter table public.reviews
  add constraint reviews_comment_length_check
  check (
    comment is null
    or char_length(btrim(comment)) between 2 and 1200
  );

create or replace function public.protect_review_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.request_is_service_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approved := false;
    new.created_at := now();
    new.updated_at := now();
  else
    new.approved := old.approved;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_review_moderation on public.reviews;
create trigger protect_review_moderation
before insert or update of approved on public.reviews
for each row execute function public.protect_review_moderation();

revoke all on function public.protect_review_moderation() from public, anon, authenticated;
grant execute on function public.protect_review_moderation() to service_role;
;\n