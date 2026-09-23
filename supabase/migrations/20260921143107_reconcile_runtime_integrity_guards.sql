
-- Reconcile integrity protections that exist in historical repository migrations
-- but were never applied to production. This version is adapted to the current
-- production schema and intentionally avoids obsolete columns/tables.

alter table public.order_items
  drop constraint if exists order_items_snapshot_amount_check;
alter table public.order_items
  add constraint order_items_snapshot_amount_check
  check (
    quantity between 1 and 999
    and unit_price > 0
    and subtotal > 0
    and abs(subtotal - (unit_price * quantity)) <= 0.01
    and char_length(btrim(name)) between 1 and 200
    and char_length(btrim(sku)) between 1 and 80
  ) not valid;

alter table public.purchase_ticket_items
  drop constraint if exists purchase_ticket_items_amount_check;
alter table public.purchase_ticket_items
  add constraint purchase_ticket_items_amount_check
  check (
    quantity between 1 and 999
    and unit_price > 0
    and subtotal > 0
    and abs(subtotal - (unit_price * quantity)) <= 0.01
  ) not valid;

alter table public.payment_events
  drop constraint if exists payment_events_content_check;
alter table public.payment_events
  add constraint payment_events_content_check
  check (
    char_length(btrim(event_type)) between 2 and 80
    and (provider_event_id is null or char_length(provider_event_id) <= 180)
    and (provider_payment_id is null or char_length(provider_payment_id) <= 180)
    and (error_message is null or char_length(error_message) <= 1000)
    and (raw is null or pg_column_size(raw) <= 262144)
  ) not valid;

alter table public.chat_messages
  drop constraint if exists chat_messages_content_check;
alter table public.chat_messages
  add constraint chat_messages_content_check
  check (char_length(btrim(content)) between 1 and 4000) not valid;

alter table public.search_events
  drop constraint if exists search_events_content_check;
alter table public.search_events
  add constraint search_events_content_check
  check (
    char_length(btrim(query)) between 1 and 160
    and results_count >= 0
    and (session_id is null or char_length(session_id) <= 120)
  ) not valid;

alter table public.product_views
  drop constraint if exists product_views_session_check;
alter table public.product_views
  add constraint product_views_session_check
  check (session_id is null or char_length(session_id) <= 120) not valid;

alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_content_check;
alter table public.admin_audit_logs
  add constraint admin_audit_logs_content_check
  check (
    char_length(btrim(action)) between 2 and 100
    and (entity is null or char_length(btrim(entity)) between 2 and 100)
    and (message is null or char_length(btrim(message)) between 2 and 1000)
    and (entity_id is null or char_length(entity_id) <= 180)
    and (actor_email is null or char_length(actor_email) <= 160)
    and (metadata is null or pg_column_size(metadata) <= 131072)
    and (ip is null or char_length(ip) <= 80)
    and (user_agent is null or char_length(user_agent) <= 500)
  ) not valid;

create or replace function public.validate_profile_contact_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    new.email := lower(btrim(new.email));
    if char_length(new.email) not between 3 and 160
      or new.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'INVALID_PROFILE_EMAIL';
    end if;
  end if;

  if tg_op = 'INSERT' or new.full_name is distinct from old.full_name then
    new.full_name := nullif(btrim(new.full_name), '');
    if new.full_name is not null and char_length(new.full_name) not between 2 and 120 then
      raise exception 'INVALID_PROFILE_NAME';
    end if;
  end if;

  if tg_op = 'INSERT' or new.phone is distinct from old.phone then
    new.phone := nullif(btrim(new.phone), '');
    if new.phone is not null and (
      new.phone !~ '^\+?[0-9[:space:]().-]+$'
      or regexp_replace(new.phone, '[^0-9]', '', 'g') !~ '^(54[0-9]{10}|549[0-9]{10}|[0-9]{10})$'
    ) then
      raise exception 'INVALID_PROFILE_PHONE';
    end if;
  end if;

  if tg_op = 'INSERT' or new.avatar_url is distinct from old.avatar_url then
    new.avatar_url := nullif(btrim(new.avatar_url), '');
    if new.avatar_url is not null and (
      char_length(new.avatar_url) > 500
      or new.avatar_url !~ '^https://'
    ) then
      raise exception 'INVALID_PROFILE_AVATAR';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_profile_contact_integrity on public.profiles;
create trigger validate_profile_contact_integrity
before insert or update of email, full_name, phone, avatar_url
on public.profiles
for each row execute function public.validate_profile_contact_integrity();

create or replace function public.validate_order_customer_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_profile_email text;
begin
  if char_length(btrim(new.customer_name)) not between 2 and 160 then
    raise exception 'INVALID_ORDER_CUSTOMER_NAME';
  end if;

  if char_length(btrim(new.customer_email)) not between 3 and 160
    or new.customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'INVALID_ORDER_CUSTOMER_EMAIL';
  end if;

  if char_length(btrim(new.customer_phone)) not between 8 and 32 then
    raise exception 'INVALID_ORDER_CUSTOMER_PHONE';
  end if;

  if new.subtotal < 0 or new.shipping_cost < 0 or new.total < 0
    or abs(new.total - (new.subtotal + new.shipping_cost)) > 0.01 then
    raise exception 'INVALID_ORDER_TOTALS';
  end if;

  if new.notes is not null and char_length(new.notes) > 1000 then
    raise exception 'ORDER_NOTES_TOO_LONG';
  end if;

  if new.address_snapshot is not null and pg_column_size(new.address_snapshot) > 32768 then
    raise exception 'ORDER_ADDRESS_TOO_LARGE';
  end if;

  if new.user_id is not null then
    select email into v_profile_email
    from public.profiles
    where id = new.user_id;

    if not found
      or lower(btrim(v_profile_email)) <> lower(btrim(new.customer_email)) then
      raise exception 'ORDER_CUSTOMER_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_customer_integrity on public.orders;
create trigger validate_order_customer_integrity
before insert or update of user_id, customer_name, customer_email, customer_phone,
  shipping_cost, subtotal, total, address_snapshot, notes
on public.orders
for each row execute function public.validate_order_customer_integrity();

create or replace function public.protect_order_commercial_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.customer_name is distinct from old.customer_name
    or new.customer_email is distinct from old.customer_email
    or new.customer_phone is distinct from old.customer_phone
    or new.shipping_method is distinct from old.shipping_method
    or new.shipping_cost is distinct from old.shipping_cost
    or new.subtotal is distinct from old.subtotal
    or new.total is distinct from old.total
    or new.address_snapshot is distinct from old.address_snapshot
    or new.notes is distinct from old.notes
    or new.created_at is distinct from old.created_at then
    raise exception 'ORDER_COMMERCIAL_SNAPSHOT_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_order_commercial_snapshot on public.orders;
create trigger protect_order_commercial_snapshot
before update on public.orders
for each row execute function public.protect_order_commercial_snapshot();

create or replace function public.validate_payment_order_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_order_total numeric;
begin
  if tg_op = 'INSERT'
    or new.order_id is distinct from old.order_id
    or new.amount is distinct from old.amount then

    select total into v_order_total
    from public.orders
    where id = new.order_id;

    if not found or new.amount <= 0 or abs(v_order_total - new.amount) > 0.01 then
      raise exception 'PAYMENT_ORDER_AMOUNT_MISMATCH';
    end if;
  end if;

  if lower(btrim(new.currency)) <> 'ars' then
    raise exception 'INVALID_PAYMENT_CURRENCY';
  end if;

  if new.provider_session_id is not null
    and char_length(btrim(new.provider_session_id)) not between 8 and 180 then
    raise exception 'INVALID_PAYMENT_SESSION';
  end if;

  if new.provider_preference_id is not null
    and char_length(new.provider_preference_id) > 180 then
    raise exception 'INVALID_PAYMENT_PREFERENCE';
  end if;

  if new.provider_payment_id is not null
    and char_length(new.provider_payment_id) > 180 then
    raise exception 'INVALID_PROVIDER_PAYMENT';
  end if;

  if new.raw is not null and pg_column_size(new.raw) > 262144 then
    raise exception 'PAYMENT_RAW_TOO_LARGE';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_payment_order_integrity on public.payments;
create trigger validate_payment_order_integrity
before insert or update of order_id, amount, currency, provider_session_id,
  provider_preference_id, provider_payment_id, raw
on public.payments
for each row execute function public.validate_payment_order_integrity();

create or replace function public.validate_notification_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is null and new.target_role is null then
    raise exception 'NOTIFICATION_TARGET_REQUIRED';
  end if;

  if char_length(btrim(new.type)) not between 2 and 80 then
    raise exception 'INVALID_NOTIFICATION_TYPE';
  end if;

  if char_length(btrim(new.title)) not between 2 and 160 then
    raise exception 'INVALID_NOTIFICATION_TITLE';
  end if;

  if char_length(btrim(new.message)) not between 2 and 500 then
    raise exception 'INVALID_NOTIFICATION_MESSAGE';
  end if;

  if new.link_to is not null and (
    char_length(new.link_to) > 500
    or new.link_to !~ '^/'
    or new.link_to ~ '^//'
  ) then
    raise exception 'INVALID_NOTIFICATION_LINK';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_notification_integrity on public.notifications;
create trigger validate_notification_integrity
before insert or update of user_id, target_role, type, title, message, link_to
on public.notifications
for each row execute function public.validate_notification_integrity();

create or replace function public.validate_conversation_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.visitor_id := nullif(btrim(new.visitor_id), '');

  if (new.user_id is null and new.visitor_id is null)
    or (new.user_id is not null and new.visitor_id is not null) then
    raise exception 'INVALID_CONVERSATION_IDENTITY';
  end if;

  if new.visitor_id is not null and char_length(new.visitor_id) > 120 then
    raise exception 'INVALID_VISITOR_ID';
  end if;

  if new.subject is not null and char_length(new.subject) > 160 then
    raise exception 'INVALID_CONVERSATION_SUBJECT';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_conversation_identity on public.chat_conversations;
create trigger validate_conversation_identity
before insert or update of user_id, visitor_id, subject
on public.chat_conversations
for each row execute function public.validate_conversation_identity();

create or replace function public.enforce_user_collection_limits()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
  v_user_id uuid;
begin
  if tg_table_name = 'addresses' then
    v_limit := 8;
    v_user_id := new.user_id;
  elsif tg_table_name = 'favorites' then
    v_limit := 500;
    v_user_id := new.user_id;
  else
    return new;
  end if;

  if v_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || v_user_id::text, 0));

  if tg_table_name = 'addresses' then
    select count(*) into v_count
    from public.addresses
    where user_id = v_user_id;
  else
    select count(*) into v_count
    from public.favorites
    where user_id = v_user_id;
  end if;

  if v_count >= v_limit then
    raise exception 'USER_COLLECTION_LIMIT_REACHED:%', tg_table_name;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_address_limit on public.addresses;
create trigger enforce_address_limit
before insert on public.addresses
for each row execute function public.enforce_user_collection_limits();

drop trigger if exists enforce_favorite_limit on public.favorites;
create trigger enforce_favorite_limit
before insert on public.favorites
for each row execute function public.enforce_user_collection_limits();

create or replace function public.protect_public_store_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_text text;
begin
  if new.metadata is not null and pg_column_size(new.metadata) > 65536 then
    raise exception 'STORE_SETTING_TOO_LARGE';
  end if;

  v_text := lower(coalesce(new.metadata::text, ''));

  if v_text ~ '"[^"]*(secret|token|password|credential|service[_-]?role|private[_-]?key|access[_-]?key|api[_-]?key)[^"]*"\s*:' then
    raise exception 'SENSITIVE_STORE_SETTING_CANNOT_BE_PUBLIC';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_public_store_settings on public.store_settings;
create trigger protect_public_store_settings
before insert or update of metadata
on public.store_settings
for each row execute function public.protect_public_store_settings();

revoke all on function public.validate_profile_contact_integrity() from public, anon, authenticated;
revoke all on function public.validate_order_customer_integrity() from public, anon, authenticated;
revoke all on function public.protect_order_commercial_snapshot() from public, anon, authenticated;
revoke all on function public.validate_payment_order_integrity() from public, anon, authenticated;
revoke all on function public.validate_notification_integrity() from public, anon, authenticated;
revoke all on function public.validate_conversation_identity() from public, anon, authenticated;
revoke all on function public.enforce_user_collection_limits() from public, anon, authenticated;
revoke all on function public.protect_public_store_settings() from public, anon, authenticated;
;\n