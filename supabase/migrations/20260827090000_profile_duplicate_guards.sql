-- Guardas no destructivas para evitar registros duplicados en perfiles.
-- Email ya tiene constraint unique en el esquema base; estas cubren nombre y telefono normalizados.

do $$
begin
  if exists (
    select 1
    from public.profiles
    where phone is not null and btrim(phone) <> ''
    group by regexp_replace(phone, '[^0-9]', '', 'g')
    having count(*) > 1
  ) then
    raise warning 'PROFILE_PHONE_DUPLICATES: unique index was not created';
  else
    execute 'create unique index if not exists profiles_phone_digits_unique_idx
      on public.profiles ((regexp_replace(phone, ''[^0-9]'', '''', ''g'')))
      where phone is not null and btrim(phone) <> ''''';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.profiles
    where full_name is not null and btrim(full_name) <> ''
    group by lower(btrim(full_name))
    having count(*) > 1
  ) then
    raise warning 'PROFILE_FULL_NAME_DUPLICATES: unique index was not created';
  else
    execute 'create unique index if not exists profiles_full_name_normalized_unique_idx
      on public.profiles ((lower(btrim(full_name))))
      where full_name is not null and btrim(full_name) <> ''''';
  end if;
end;
$$;
