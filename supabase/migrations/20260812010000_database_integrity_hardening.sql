-- Defense-in-depth for customer, order, payment and operational data.
-- Existing rows are preserved. NOT VALID checks protect new writes without
-- forcing a full-table validation during deployment.

begin;

-- Future database functions are private unless a migration explicitly grants
-- the minimum role required to execute them.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Complete the FORCE RLS posture for public catalog/configuration tables.
alter table if exists public.categories force row level security;
alter table if exists public.products force row level security;
alter table if exists public.product_images force row level security;
alter table if exists public.store_settings force row level security;

-- Catalog and store configuration writes go through protected server routes.
revoke insert, update, delete on table public.categories from anon, authenticated;
revoke insert, update, delete on table public.products from anon, authenticated;
revoke insert, update, delete on table public.product_images from anon, authenticated;
revoke insert, update, delete on table public.store_settings from anon, authenticated;
revoke insert, update, delete on table public.profiles from anon, authenticated;
revoke insert, update, delete on table public.addresses from anon, authenticated;
revoke insert, update, delete on table public.cart_items from anon, authenticated;
revoke insert, update, delete on table public.notifications from anon, authenticated;

-- Conversations are persisted by the rate-limited assistant API. Direct
-- writes would bypass ownership checks, abuse controls and conversation state.
revoke insert, update, delete on table public.chat_conversations from anon, authenticated;
revoke insert, update, delete on table public.chat_messages from anon, authenticated;

-- Search analytics are currently server-side only. Do not leave an anonymous
-- write path that can be used to inflate or exhaust the table.
drop policy if exists "search events owner insert" on public.search_events;
drop policy if exists "search_events_owner_insert" on public.search_events;
revoke insert on table public.search_events from anon, authenticated;

-- Policies that depend on is_admin() must never be evaluated for anon. Public
-- catalog/configuration reads are recreated below without privileged helpers.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select * from (values
      ('addresses', 'addresses owner'),
      ('admin_audit_logs', 'admin audit insert'),
      ('admin_audit_logs', 'admin audit read'),
      ('cart_items', 'cart owner'),
      ('categories', 'admin categories all'),
      ('chat_conversations', 'chat owner'),
      ('chat_messages', 'chat messages owner'),
      ('favorites', 'favorites owner'),
      ('financial_movements', 'admin financial movements insert'),
      ('financial_movements', 'admin financial movements read'),
      ('financial_movements', 'admin financial movements update'),
      ('inventory_movements', 'admin inventory all'),
      ('notifications', 'admin notifications all'),
      ('notifications', 'notifications owner read'),
      ('notifications', 'notifications owner update'),
      ('order_items', 'admin order items all'),
      ('order_items', 'order items owner read'),
      ('orders', 'admin orders all'),
      ('orders', 'orders owner read'),
      ('payment_events', 'admin payment events all'),
      ('payment_events', 'admin payment events read'),
      ('payments', 'admin payments all'),
      ('payments', 'payments owner read'),
      ('product_images', 'admin product images all'),
      ('product_views', 'admin product views read'),
      ('products', 'admin products all'),
      ('profiles', 'admin profiles all'),
      ('profiles', 'profiles owner read'),
      ('profiles', 'profiles owner update'),
      ('purchase_ticket_items', 'admin ticket items all'),
      ('purchase_ticket_items', 'ticket items owner read'),
      ('purchase_tickets', 'admin tickets all'),
      ('purchase_tickets', 'tickets owner read'),
      ('reviews', 'admin reviews all'),
      ('reviews', 'reviews owner insert'),
      ('search_events', 'admin search events read'),
      ('store_settings', 'admin store settings all')
    ) as entries(table_name, policy_name)
  loop
    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = v_policy.table_name
        and policyname = v_policy.policy_name
    ) then
      execute format(
        'alter policy %I on public.%I to authenticated',
        v_policy.policy_name,
        v_policy.table_name
      );
    end if;
  end loop;
end
$$;

drop policy if exists "public product images" on public.product_images;
create policy "product_images_public_read_active"
on public.product_images for select to anon, authenticated
using (exists (
  select 1 from public.products product
  where product.id = product_images.product_id and product.active = true
));

drop policy if exists "public store settings" on public.store_settings;
create policy "store_settings_public_read"
on public.store_settings for select to anon, authenticated
using (public = true);

-- Row-local checks. These are intentionally NOT VALID: historical QA rows stay
-- available for reconciliation while every new/changed row is enforced.
alter table public.addresses
  add constraint addresses_content_shape_check
  check (
    char_length(btrim(label)) between 2 and 50
    and char_length(btrim(street)) between 2 and 120
    and char_length(btrim(number)) between 1 and 30
    and char_length(btrim(city)) between 2 and 80
    and char_length(btrim(province)) between 2 and 80
    and (apartment is null or char_length(btrim(apartment)) between 1 and 60)
    and (postal_code is null or char_length(btrim(postal_code)) between 1 and 30)
    and (notes is null or char_length(notes) <= 240)
  ) not valid;

alter table public.orders
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null;

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

alter table public.payment_events
  add constraint payment_events_content_check
  check (
    char_length(btrim(event_type)) between 2 and 80
    and (provider_event_id is null or char_length(provider_event_id) <= 180)
    and (provider_payment_id is null or char_length(provider_payment_id) <= 180)
    and (error_message is null or char_length(error_message) <= 1000)
    and (raw is null or pg_column_size(raw) <= 262144)
  ) not valid;

alter table public.purchase_ticket_items
  add constraint purchase_ticket_items_amount_check
  check (
    quantity between 1 and 999
    and unit_price > 0
    and subtotal > 0
    and abs(subtotal - (unit_price * quantity)) <= 0.01
  ) not valid;

alter table public.inventory_movements
  add constraint inventory_movement_arithmetic_check
  check (
    quantity <> 0
    and stock_before >= 0
    and stock_after >= 0
    and stock_after = stock_before + quantity
    and (type <> 'SALE' or quantity < 0)
    and (type not in ('RETURN', 'PURCHASE_RECEIPT') or quantity > 0)
    and char_length(btrim(reason)) between 3 and 240
  ) not valid;

alter table public.chat_messages
  add constraint chat_messages_content_check
  check (char_length(btrim(content)) between 1 and 4000) not valid;

alter table public.search_events
  add constraint search_events_content_check
  check (
    char_length(btrim(query)) between 1 and 160
    and results_count >= 0
    and (session_id is null or char_length(session_id) <= 120)
  ) not valid;

alter table public.product_views
  add constraint product_views_session_check
  check (session_id is null or char_length(session_id) <= 120) not valid;

alter table public.admin_audit_logs
  add constraint admin_audit_logs_content_check
  check (
    char_length(btrim(action)) between 2 and 100
    and char_length(btrim(entity)) between 2 and 100
    and char_length(btrim(message)) between 2 and 1000
    and (entity_id is null or char_length(entity_id) <= 180)
    and (actor_email is null or char_length(actor_email) <= 160)
    and (metadata is null or pg_column_size(metadata) <= 131072)
    and (ip is null or char_length(ip) <= 80)
    and (user_agent is null or char_length(user_agent) <= 500)
  ) not valid;

-- Index foreign keys and policy predicates used on account/admin hot paths.
create index if not exists categories_parent_id_idx on public.categories(parent_id);
create index if not exists product_images_product_sort_idx on public.product_images(product_id, sort_order);
create index if not exists order_items_order_created_idx on public.order_items(order_id, created_at);
create index if not exists order_items_product_idx on public.order_items(product_id) where product_id is not null;
create index if not exists purchase_ticket_items_ticket_created_idx on public.purchase_ticket_items(ticket_id, created_at);
create index if not exists inventory_movements_product_created_idx on public.inventory_movements(product_id, created_at desc);
create index if not exists inventory_movements_order_created_idx on public.inventory_movements(order_id, created_at desc) where order_id is not null;
create index if not exists notifications_user_unread_idx on public.notifications(user_id, read, created_at desc) where user_id is not null;
create index if not exists chat_conversations_user_recent_idx on public.chat_conversations(user_id, last_message_at desc) where user_id is not null;
create index if not exists chat_messages_conversation_created_idx on public.chat_messages(conversation_id, created_at);
create index if not exists reviews_product_approved_idx on public.reviews(product_id, approved, created_at desc);
create index if not exists product_views_product_created_idx on public.product_views(product_id, created_at desc);
create index if not exists search_events_created_idx on public.search_events(created_at desc);
create index if not exists consumer_refund_requests_resolved_by_idx on public.consumer_refund_requests(resolved_by) where resolved_by is not null;
create index if not exists assistant_feedback_conversation_idx on public.assistant_feedback(conversation_id) where conversation_id is not null;
create index if not exists assistant_feedback_user_idx on public.assistant_feedback(user_id) where user_id is not null;
create index if not exists assistant_knowledge_created_by_idx on public.assistant_knowledge(created_by) where created_by is not null;
create index if not exists assistant_knowledge_updated_by_idx on public.assistant_knowledge(updated_by) where updated_by is not null;
create index if not exists assistant_knowledge_versions_changed_by_idx on public.assistant_knowledge_versions(changed_by) where changed_by is not null;
create index if not exists assistant_review_queue_reviewed_by_idx on public.assistant_review_queue(reviewed_by) where reviewed_by is not null;
create index if not exists assistant_review_queue_user_message_idx on public.assistant_review_queue(user_message_id) where user_message_id is not null;
create index if not exists cart_items_product_idx on public.cart_items(product_id);
create index if not exists chat_conversations_assigned_admin_idx on public.chat_conversations(assigned_admin_id) where assigned_admin_id is not null;
create index if not exists chat_messages_sender_idx on public.chat_messages(sender_id) where sender_id is not null;
create index if not exists favorites_product_idx on public.favorites(product_id);
create index if not exists financial_movements_created_by_idx on public.financial_movements(created_by);
create index if not exists financial_movements_voided_by_idx on public.financial_movements(voided_by) where voided_by is not null;
create index if not exists market_price_observations_created_by_idx on public.market_price_observations(created_by) where created_by is not null;
create index if not exists market_price_sources_created_by_idx on public.market_price_sources(created_by) where created_by is not null;
create index if not exists market_price_sources_updated_by_idx on public.market_price_sources(updated_by) where updated_by is not null;
create index if not exists market_price_sync_runs_source_idx on public.market_price_sync_runs(source_id) where source_id is not null;
create index if not exists orders_cancelled_by_idx on public.orders(cancelled_by) where cancelled_by is not null;
create index if not exists product_views_user_idx on public.product_views(user_id) where user_id is not null;
create index if not exists purchase_orders_cancelled_by_idx on public.purchase_orders(cancelled_by) where cancelled_by is not null;
create index if not exists purchase_orders_created_by_idx on public.purchase_orders(created_by);
create index if not exists purchase_orders_ordered_by_idx on public.purchase_orders(ordered_by) where ordered_by is not null;
create index if not exists purchase_orders_received_by_idx on public.purchase_orders(received_by) where received_by is not null;
create index if not exists purchase_ticket_items_product_idx on public.purchase_ticket_items(product_id) where product_id is not null;
create index if not exists reviews_user_idx on public.reviews(user_id);
create index if not exists search_events_user_idx on public.search_events(user_id) where user_id is not null;
create index if not exists supplier_invoices_created_by_idx on public.supplier_invoices(created_by);
create index if not exists supplier_invoices_voided_by_idx on public.supplier_invoices(voided_by) where voided_by is not null;
create index if not exists supplier_payments_created_by_idx on public.supplier_payments(created_by);
create index if not exists supplier_payments_voided_by_idx on public.supplier_payments(voided_by) where voided_by is not null;
create index if not exists suppliers_created_by_idx on public.suppliers(created_by) where created_by is not null;
create index if not exists suppliers_updated_by_idx on public.suppliers(updated_by) where updated_by is not null;

-- A provider payment identifier must never be attached to two local payments.
do $$
begin
  if exists (
    select 1
    from public.payments
    where provider_payment_id is not null
    group by provider, provider_payment_id
    having count(*) > 1
  ) then
    raise warning 'PAYMENT_PROVIDER_ID_DUPLICATES: unique index was not created';
  else
    execute 'create unique index if not exists payments_provider_payment_unique_idx
      on public.payments(provider, provider_payment_id)
      where provider_payment_id is not null';
  end if;
end;
$$;

-- Checkout items are deduplicated by product before persistence. Preserve that
-- invariant when historical data allows the index to be created safely.
do $$
begin
  if exists (
    select 1
    from public.order_items
    where product_id is not null
    group by order_id, product_id
    having count(*) > 1
  ) then
    raise warning 'ORDER_ITEM_DUPLICATES: unique index was not created';
  else
    execute 'create unique index if not exists order_items_order_product_unique_idx
      on public.order_items(order_id, product_id)
      where product_id is not null';
  end if;
end;
$$;

create or replace function public.validate_profile_contact_integrity()
returns trigger
language plpgsql
set search_path = public
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
  if (tg_op = 'INSERT' or new.avatar_url is distinct from old.avatar_url)
    and new.avatar_url is not null and char_length(new.avatar_url) > 500 then
    raise exception 'INVALID_PROFILE_AVATAR';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_profile_contact_integrity on public.profiles;
create trigger validate_profile_contact_integrity
before insert or update of email, full_name, phone, avatar_url on public.profiles
for each row execute function public.validate_profile_contact_integrity();

create or replace function public.validate_category_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    new.name := btrim(new.name);
    if char_length(new.name) not between 2 and 140 then raise exception 'INVALID_CATEGORY_NAME'; end if;
  end if;
  if tg_op = 'INSERT' or new.slug is distinct from old.slug then
    new.slug := lower(btrim(new.slug));
    if char_length(new.slug) > 160 or new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'INVALID_CATEGORY_SLUG';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.description is distinct from old.description)
    and char_length(new.description) > 700 then raise exception 'CATEGORY_DESCRIPTION_TOO_LONG'; end if;
  if tg_op = 'INSERT' or new.image_url is distinct from old.image_url then
    new.image_url := nullif(btrim(new.image_url), '');
    if new.image_url is not null
      and (char_length(new.image_url) > 500 or new.image_url !~ '^https://') then
      raise exception 'INVALID_CATEGORY_IMAGE';
    end if;
  end if;
  if new.parent_id = new.id then raise exception 'CATEGORY_CYCLE'; end if;
  if new.parent_id is not null and exists (
    with recursive ancestors as (
      select id, parent_id from public.categories where id = new.parent_id
      union
      select category.id, category.parent_id
      from public.categories category
      join ancestors parent on parent.parent_id = category.id
    )
    select 1 from ancestors where id = new.id
  ) then raise exception 'CATEGORY_CYCLE'; end if;
  return new;
end;
$$;

drop trigger if exists validate_category_integrity on public.categories;
create trigger validate_category_integrity
before insert or update of name, slug, description, image_url, parent_id on public.categories
for each row execute function public.validate_category_integrity();

create or replace function public.validate_product_commercial_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_image jsonb;
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    new.name := btrim(new.name);
    if char_length(new.name) not between 2 and 160 then raise exception 'INVALID_PRODUCT_NAME'; end if;
  end if;
  if tg_op = 'INSERT' or new.slug is distinct from old.slug then
    new.slug := lower(btrim(new.slug));
    if char_length(new.slug) > 180 or new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'INVALID_PRODUCT_SLUG';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.sku is distinct from old.sku)
    and (char_length(new.sku) not between 2 and 80 or new.sku !~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$') then
    raise exception 'INVALID_PRODUCT_SKU';
  end if;
  if (tg_op = 'INSERT' or new.brand is distinct from old.brand)
    and char_length(btrim(new.brand)) not between 1 and 100 then raise exception 'INVALID_PRODUCT_BRAND'; end if;
  if (tg_op = 'INSERT' or new.description is distinct from old.description)
    and char_length(new.description) > 1200 then raise exception 'PRODUCT_DESCRIPTION_TOO_LONG'; end if;
  if (tg_op = 'INSERT' or new.subcategory is distinct from old.subcategory)
    and char_length(btrim(new.subcategory)) not between 1 and 100 then raise exception 'INVALID_PRODUCT_SUBCATEGORY'; end if;
  if (tg_op = 'INSERT' or new.unit is distinct from old.unit)
    and char_length(btrim(new.unit)) not between 1 and 40 then raise exception 'INVALID_PRODUCT_UNIT'; end if;
  if tg_op = 'INSERT'
    or new.price is distinct from old.price
    or new.compare_price is distinct from old.compare_price
    or new.active is distinct from old.active then
    if new.price < 0 or (new.active and new.price <= 0)
      or new.compare_price is not null and new.compare_price < new.price then
      raise exception 'INVALID_PRODUCT_PRICE';
    end if;
  end if;
  if tg_op = 'INSERT' or new.image_url is distinct from old.image_url then
    new.image_url := btrim(new.image_url);
    if new.image_url <> '' and (char_length(new.image_url) > 500 or new.image_url !~ '^https://') then
      raise exception 'INVALID_PRODUCT_IMAGE';
    end if;
  end if;
  if tg_op = 'INSERT' or new.gallery is distinct from old.gallery then
    if jsonb_typeof(new.gallery) <> 'array' or jsonb_array_length(new.gallery) > 12 or pg_column_size(new.gallery) > 16384 then
      raise exception 'INVALID_PRODUCT_GALLERY';
    end if;
    for v_image in select value from jsonb_array_elements(new.gallery)
    loop
      if jsonb_typeof(v_image) <> 'string'
        or char_length(v_image #>> '{}') > 500
        or (v_image #>> '{}') !~ '^https://' then
        raise exception 'INVALID_PRODUCT_GALLERY_IMAGE';
      end if;
    end loop;
  end if;
  if (tg_op = 'INSERT' or new.specifications is distinct from old.specifications)
    and (jsonb_typeof(new.specifications) <> 'object' or pg_column_size(new.specifications) > 65536) then
    raise exception 'INVALID_PRODUCT_SPECIFICATIONS';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_product_commercial_integrity on public.products;
create trigger validate_product_commercial_integrity
before insert or update of name, slug, sku, brand, description, subcategory,
  unit, price, compare_price, active, image_url, gallery, specifications
on public.products
for each row execute function public.validate_product_commercial_integrity();

create or replace function public.validate_product_image_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.url := btrim(new.url);
  if char_length(new.url) > 500 or new.url !~ '^https://' then raise exception 'INVALID_PRODUCT_IMAGE'; end if;
  if new.alt is not null and char_length(new.alt) > 200 then raise exception 'PRODUCT_IMAGE_ALT_TOO_LONG'; end if;
  return new;
end;
$$;

drop trigger if exists validate_product_image_integrity on public.product_images;
create trigger validate_product_image_integrity
before insert or update of url, alt on public.product_images
for each row execute function public.validate_product_image_integrity();

create or replace function public.validate_review_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if char_length(btrim(new.comment)) not between 2 and 1200 then raise exception 'INVALID_REVIEW_COMMENT'; end if;
  return new;
end;
$$;

drop trigger if exists validate_review_content on public.reviews;
create trigger validate_review_content
before insert or update of comment on public.reviews
for each row execute function public.validate_review_content();

create or replace function public.validate_order_customer_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_profile_email text;
begin
  if tg_op = 'INSERT' or new.customer_name is distinct from old.customer_name then
    new.customer_name := btrim(new.customer_name);
    if char_length(new.customer_name) not between 2 and 120 then raise exception 'INVALID_CUSTOMER_NAME'; end if;
  end if;
  if tg_op = 'INSERT' or new.customer_email is distinct from old.customer_email then
    new.customer_email := lower(btrim(new.customer_email));
    if char_length(new.customer_email) > 160
      or new.customer_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'INVALID_CUSTOMER_EMAIL';
    end if;
  end if;
  if tg_op = 'INSERT' or new.customer_phone is distinct from old.customer_phone then
    new.customer_phone := btrim(new.customer_phone);
    if new.customer_phone !~ '^\+?[0-9[:space:]().-]+$'
      or regexp_replace(new.customer_phone, '[^0-9]', '', 'g') !~ '^(54[0-9]{10}|549[0-9]{10}|[0-9]{10})$' then
      raise exception 'INVALID_CUSTOMER_PHONE';
    end if;
  end if;
  if tg_op = 'INSERT'
    or new.shipping_cost is distinct from old.shipping_cost
    or new.subtotal is distinct from old.subtotal
    or new.total is distinct from old.total then
    if new.shipping_cost < 0 or new.subtotal < 0 or new.total <= 0
      or abs(new.total - (new.subtotal + new.shipping_cost)) > 0.01 then
      raise exception 'INVALID_ORDER_TOTAL';
    end if;
  end if;
  if tg_op = 'INSERT'
    or new.shipping_method is distinct from old.shipping_method
    or new.address_snapshot is distinct from old.address_snapshot then
    if new.shipping_method = 'DELIVERY' and (
      jsonb_typeof(new.address_snapshot) is distinct from 'object'
      or nullif(btrim(new.address_snapshot ->> 'street'), '') is null
      or nullif(btrim(new.address_snapshot ->> 'number'), '') is null
      or nullif(btrim(new.address_snapshot ->> 'city'), '') is null
      or nullif(btrim(new.address_snapshot ->> 'province'), '') is null
    ) then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
  end if;
  if (tg_op = 'INSERT' or new.notes is distinct from old.notes)
    and new.notes is not null and char_length(new.notes) > 500 then
    raise exception 'ORDER_NOTES_TOO_LONG';
  end if;
  if (tg_op = 'INSERT' or new.cancellation_reason is distinct from old.cancellation_reason)
    and new.cancellation_reason is not null
    and char_length(btrim(new.cancellation_reason)) not between 3 and 240 then
    raise exception 'INVALID_CANCELLATION_REASON';
  end if;

  if tg_op = 'INSERT' and new.user_id is null then
    raise exception 'ORDER_USER_REQUIRED';
  end if;

  -- Keep historical orders when an Auth user is deleted. The existing FK uses
  -- ON DELETE SET NULL specifically for that retention case.
  if new.user_id is null then
    return new;
  end if;

  select email into v_profile_email
  from public.profiles
  where id = new.user_id;

  if not found or lower(btrim(v_profile_email)) <> lower(btrim(new.customer_email)) then
    raise exception 'ORDER_CUSTOMER_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_customer_integrity on public.orders;
create trigger validate_order_customer_integrity
before insert or update of user_id, customer_name, customer_email, customer_phone,
  shipping_method, shipping_cost, subtotal, total, address_snapshot, notes, cancellation_reason
on public.orders
for each row execute function public.validate_order_customer_integrity();

create or replace function public.protect_order_commercial_snapshot()
returns trigger
language plpgsql
set search_path = public
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
set search_path = public
as $$
declare
  v_order_total numeric(12,2);
begin
  if tg_op = 'INSERT' or new.order_id is distinct from old.order_id or new.amount is distinct from old.amount then
    select total into v_order_total
    from public.orders
    where id = new.order_id;
    if not found or new.amount <= 0 or abs(v_order_total - new.amount) > 0.01 then
      raise exception 'PAYMENT_ORDER_AMOUNT_MISMATCH';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.currency is distinct from old.currency) and lower(new.currency) <> 'ars' then
    raise exception 'INVALID_PAYMENT_CURRENCY';
  end if;
  if (tg_op = 'INSERT' or new.provider_session_id is distinct from old.provider_session_id)
    and new.provider_session_id is not null
    and char_length(btrim(new.provider_session_id)) not between 8 and 120 then
    raise exception 'INVALID_PAYMENT_SESSION';
  end if;
  if (tg_op = 'INSERT' or new.provider_preference_id is distinct from old.provider_preference_id)
    and new.provider_preference_id is not null and char_length(new.provider_preference_id) > 180 then
    raise exception 'INVALID_PAYMENT_PREFERENCE';
  end if;
  if (tg_op = 'INSERT' or new.provider_payment_id is distinct from old.provider_payment_id)
    and new.provider_payment_id is not null and char_length(new.provider_payment_id) > 180 then
    raise exception 'INVALID_PROVIDER_PAYMENT';
  end if;
  if (tg_op = 'INSERT' or new.raw is distinct from old.raw)
    and new.raw is not null and pg_column_size(new.raw) > 262144 then
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

-- Prevent accidentally publishing secrets through the public store settings
-- policy. Public configuration is limited to small, non-sensitive payloads.
create or replace function public.protect_public_store_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if pg_column_size(new.value) > 65536 then
    raise exception 'STORE_SETTING_TOO_LARGE';
  end if;
  if new.public and lower(new.key) ~ '(secret|token|password|credential|service[_-]?role|private[_-]?key|access[_-]?key)' then
    raise exception 'SENSITIVE_STORE_SETTING_CANNOT_BE_PUBLIC';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_public_store_settings on public.store_settings;
create trigger protect_public_store_settings
before insert or update on public.store_settings
for each row execute function public.protect_public_store_settings();

create or replace function public.validate_notification_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is null and new.target_role is null then raise exception 'NOTIFICATION_TARGET_REQUIRED'; end if;
  if char_length(btrim(new.type)) not between 2 and 80 then raise exception 'INVALID_NOTIFICATION_TYPE'; end if;
  if char_length(btrim(new.title)) not between 2 and 160 then raise exception 'INVALID_NOTIFICATION_TITLE'; end if;
  if char_length(btrim(new.message)) not between 2 and 500 then raise exception 'INVALID_NOTIFICATION_MESSAGE'; end if;
  if new.link_to is not null and char_length(new.link_to) > 500 then raise exception 'INVALID_NOTIFICATION_LINK'; end if;
  return new;
end;
$$;

drop trigger if exists validate_notification_integrity on public.notifications;
create trigger validate_notification_integrity
before insert or update of user_id, target_role, type, title, message, link_to on public.notifications
for each row execute function public.validate_notification_integrity();

create or replace function public.validate_conversation_identity()
returns trigger
language plpgsql
set search_path = public
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
before insert or update of user_id, visitor_id, subject on public.chat_conversations
for each row execute function public.validate_conversation_identity();

create or replace function public.validate_consumer_request_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.request_number is distinct from old.request_number then
    if char_length(btrim(new.request_number)) not between 8 and 60 then raise exception 'INVALID_REQUEST_NUMBER'; end if;
  end if;
  if tg_op = 'INSERT' or new.full_name is distinct from old.full_name then
    if char_length(btrim(new.full_name)) not between 2 and 90 then raise exception 'INVALID_REQUEST_NAME'; end if;
  end if;
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    new.email := lower(btrim(new.email));
    if char_length(new.email) > 160 or new.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'INVALID_REQUEST_EMAIL';
    end if;
  end if;
  if tg_op = 'INSERT' or new.phone is distinct from old.phone then
    if new.phone !~ '^\+?[0-9[:space:]().-]+$'
      or regexp_replace(new.phone, '[^0-9]', '', 'g') !~ '^(54[0-9]{10}|549[0-9]{10}|[0-9]{10})$' then
      raise exception 'INVALID_REQUEST_PHONE';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.details is distinct from old.details)
    and char_length(new.details) not between 10 and 900 then
    raise exception 'INVALID_REQUEST_DETAILS';
  end if;
  if (tg_op = 'INSERT' or new.order_number is distinct from old.order_number)
    and new.order_number is not null
    and (char_length(new.order_number) > 60 or new.order_number !~ '^[A-Za-z0-9-]+$') then
    raise exception 'INVALID_REQUEST_ORDER_NUMBER';
  end if;
  if (tg_op = 'INSERT' or new.idempotency_key is distinct from old.idempotency_key)
    and new.idempotency_key is not null
    and new.idempotency_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'INVALID_REQUEST_IDEMPOTENCY_KEY';
  end if;
  if (tg_op = 'INSERT' or new.resolution_note is distinct from old.resolution_note)
    and new.resolution_note is not null and char_length(new.resolution_note) > 500 then
    raise exception 'INVALID_REQUEST_RESOLUTION';
  end if;
  if (tg_op = 'INSERT'
      or new.status is distinct from old.status
      or new.resolution_note is distinct from old.resolution_note
      or new.resolved_at is distinct from old.resolved_at
      or new.resolved_by is distinct from old.resolved_by)
    and new.status in ('APPROVED', 'REJECTED', 'CLOSED')
    and (
      new.resolution_note is null
      or char_length(btrim(new.resolution_note)) < 10
      or new.resolved_at is null
      or new.resolved_by is null
    ) then raise exception 'REQUEST_RESOLUTION_REQUIRED'; end if;
  return new;
end;
$$;

drop trigger if exists validate_consumer_request_integrity on public.consumer_refund_requests;
create trigger validate_consumer_request_integrity
before insert or update of request_number, full_name, email, phone, details,
  order_number, idempotency_key, status, resolution_note, resolved_at, resolved_by
on public.consumer_refund_requests
for each row execute function public.validate_consumer_request_integrity();

-- Owners can acknowledge a notification but cannot rewrite its source,
-- recipient or message through the public client.
create or replace function public.protect_notification_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.request_is_service_role() then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
    or new.target_role is distinct from old.target_role
    or new.type is distinct from old.type
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.link_to is distinct from old.link_to
    or new.created_at is distinct from old.created_at then
    raise exception 'NOTIFICATION_CONTENT_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_notification_content on public.notifications;
create trigger protect_notification_content
before update on public.notifications
for each row execute function public.protect_notification_content();

-- A customer review always enters moderation. Approval is a protected server
-- action and cannot be self-assigned through the Supabase public client.
create or replace function public.protect_review_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.request_is_service_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.approved := false;
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

-- Application limits also live in the database so parallel requests cannot
-- bypass them between the count and insert performed by an API route.
create or replace function public.enforce_user_collection_limits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if tg_table_name = 'addresses' then
    v_limit := 8;
  elsif tg_table_name = 'favorites' then
    v_limit := 500;
  else
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || new.user_id::text, 0));
  select count(*) into v_count
  from public.addresses
  where tg_table_name = 'addresses' and user_id = new.user_id;
  if tg_table_name = 'favorites' then
    select count(*) into v_count from public.favorites where user_id = new.user_id;
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

-- Any actor identifier written into operational ledgers must resolve to a real
-- administrator. This closes the weaker "profile exists" checks in older RPCs.
create or replace function public.require_admin_actor_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_field text;
  v_actor uuid;
begin
  foreach v_field in array array['created_by', 'updated_by', 'ordered_by', 'received_by', 'cancelled_by', 'voided_by', 'resolved_by', 'actor_id']
  loop
    if v_new ? v_field and nullif(v_new ->> v_field, '') is not null
      and (tg_op = 'INSERT' or (v_new ->> v_field) is distinct from (v_old ->> v_field)) then
      begin
        v_actor := (v_new ->> v_field)::uuid;
      exception when others then
        raise exception 'INVALID_ADMIN_ACTOR';
      end;
      if not exists (select 1 from public.profiles where id = v_actor and role = 'ADMIN') then
        raise exception 'ADMIN_ACTOR_REQUIRED';
      end if;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists require_admin_actor_suppliers on public.suppliers;
create trigger require_admin_actor_suppliers before insert or update on public.suppliers
for each row execute function public.require_admin_actor_fields();
drop trigger if exists require_admin_actor_purchase_orders on public.purchase_orders;
create trigger require_admin_actor_purchase_orders before insert or update on public.purchase_orders
for each row execute function public.require_admin_actor_fields();
drop trigger if exists require_admin_actor_supplier_invoices on public.supplier_invoices;
create trigger require_admin_actor_supplier_invoices before insert or update on public.supplier_invoices
for each row execute function public.require_admin_actor_fields();
drop trigger if exists require_admin_actor_supplier_payments on public.supplier_payments;
create trigger require_admin_actor_supplier_payments before insert or update on public.supplier_payments
for each row execute function public.require_admin_actor_fields();
drop trigger if exists require_admin_actor_financial_movements on public.financial_movements;
create trigger require_admin_actor_financial_movements before insert or update on public.financial_movements
for each row execute function public.require_admin_actor_fields();
drop trigger if exists require_admin_actor_inventory_movements on public.inventory_movements;
create trigger require_admin_actor_inventory_movements before insert or update on public.inventory_movements
for each row execute function public.require_admin_actor_fields();
drop trigger if exists require_admin_actor_consumer_requests on public.consumer_refund_requests;
create trigger require_admin_actor_consumer_requests before insert or update on public.consumer_refund_requests
for each row execute function public.require_admin_actor_fields();

-- Replace the complete authenticated cart in one transaction. Locking the
-- profile serializes concurrent browser syncs for the same user and prevents
-- removed items from lingering in Supabase.
create or replace function public.sync_user_cart(
  p_user_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_stored integer;
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_CART_ITEMS';
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'CART_USER_NOT_FOUND'; end if;

  -- Validate the complete payload before replacing any row.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'INVALID_CART_ITEM';
    end;
    if v_quantity not between 1 and 999 then raise exception 'INVALID_CART_ITEM'; end if;
  end loop;

  delete from public.cart_items where user_id = p_user_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if exists (select 1 from public.products where id = v_product_id and active = true) then
      insert into public.cart_items (user_id, product_id, quantity)
      values (p_user_id, v_product_id, v_quantity)
      on conflict (user_id, product_id) do update
      set quantity = excluded.quantity, updated_at = now();
    end if;
  end loop;

  select count(*) into v_stored from public.cart_items where user_id = p_user_id;
  return jsonb_build_object('ok', true, 'stored', v_stored);
end;
$$;

-- Approve/reject pending orders, payment cleanup, audit and notifications in a
-- single transaction. No customer note is overwritten.
create or replace function public.admin_transition_order(
  p_order_id uuid,
  p_action text,
  p_reason text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_actor_email text;
  v_next_status text;
  v_action text := upper(btrim(coalesce(p_action, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.request_is_service_role() then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  select email into v_actor_email
  from public.profiles
  where id = p_actor_id and role = 'ADMIN';
  if not found then raise exception 'ADMIN_REQUIRED'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  select * into v_payment from public.payments where order_id = p_order_id for update;

  if v_action = 'APPROVE' then
    if v_order.status <> 'PENDING_ADMIN_APPROVAL' then
      raise exception 'ORDER_NOT_AWAITING_APPROVAL';
    end if;
    v_next_status := 'PENDING_PAYMENT';
    update public.orders set status = v_next_status, updated_at = now() where id = p_order_id;
  elsif v_action = 'REJECT' then
    if char_length(v_reason) not between 3 and 240 then raise exception 'INVALID_REJECTION_REASON'; end if;
    if v_order.status not in ('PENDING_PAYMENT', 'PENDING_TRANSFER', 'PENDING_ADMIN_APPROVAL', 'COORDINATE') then
      raise exception 'ORDER_CANNOT_BE_REJECTED';
    end if;
    if v_order.status = 'PENDING_PAYMENT'
      and v_payment.id is not null
      and (v_payment.status <> 'PENDING' or v_payment.provider_preference_id is not null or v_payment.provider_payment_id is not null) then
      raise exception 'PAYMENT_ALREADY_STARTED';
    end if;
    v_next_status := 'CANCELLED';
    update public.orders
    set status = v_next_status,
        cancellation_reason = v_reason,
        cancelled_at = now(),
        cancelled_by = p_actor_id,
        updated_at = now()
    where id = p_order_id;
    update public.payments
    set status = 'FAILED',
        raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object('cancelled_by_admin', true, 'cancellation_reason', v_reason),
        updated_at = now()
    where order_id = p_order_id and status = 'PENDING';
  else
    raise exception 'INVALID_ORDER_ACTION';
  end if;

  insert into public.admin_audit_logs (
    actor_id, actor_email, actor_role, action, entity, entity_id, message, metadata
  ) values (
    p_actor_id,
    v_actor_email,
    'ADMIN',
    case when v_action = 'APPROVE' then 'ORDER_APPROVED_BY_ADMIN' else 'ORDER_REJECTED_BY_ADMIN' end,
    'orders',
    p_order_id::text,
    case when v_action = 'APPROVE'
      then 'Compra aprobada para continuar el pago.'
      else 'Compra rechazada sin afectar stock.' end,
    jsonb_build_object(
      'previous_status', v_order.status,
      'next_status', v_next_status,
      'reason', nullif(v_reason, ''),
      'total', v_order.total
    )
  );

  insert into public.notifications (target_role, type, title, message, link_to)
  values (
    'ADMIN',
    case when v_action = 'APPROVE' then 'ORDER_APPROVED_BY_ADMIN' else 'ORDER_REJECTED_BY_ADMIN' end,
    case when v_action = 'APPROVE' then 'Compra aprobada' else 'Compra rechazada' end,
    case when v_action = 'APPROVE'
      then v_actor_email || ' aprobo la compra de ' || v_order.customer_name || '.'
      else v_actor_email || ' rechazo la compra de ' || v_order.customer_name || '.' end,
    '/admin/pedidos?order=' || p_order_id
  );

  if v_order.user_id is not null then
    insert into public.notifications (user_id, target_role, type, title, message, link_to)
    values (
      v_order.user_id,
      'USER',
      case when v_action = 'APPROVE' then 'ORDER_APPROVED' else 'ORDER_REJECTED' end,
      case when v_action = 'APPROVE' then 'Tu pedido fue aprobado' else 'Tu pedido fue rechazado' end,
      case when v_action = 'APPROVE'
        then 'Tu pedido ya puede continuar al pago.'
        else 'El pedido fue cancelado. Motivo: ' || v_reason end,
      '/cuenta/pedidos?order=' || p_order_id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'status', v_next_status,
    'customer_name', v_order.customer_name,
    'total', v_order.total
  );
end;
$$;

revoke execute on function public.validate_order_customer_integrity() from public, anon, authenticated;
revoke execute on function public.validate_profile_contact_integrity() from public, anon, authenticated;
revoke execute on function public.validate_category_integrity() from public, anon, authenticated;
revoke execute on function public.validate_product_commercial_integrity() from public, anon, authenticated;
revoke execute on function public.validate_product_image_integrity() from public, anon, authenticated;
revoke execute on function public.validate_review_content() from public, anon, authenticated;
revoke execute on function public.protect_order_commercial_snapshot() from public, anon, authenticated;
revoke execute on function public.validate_payment_order_integrity() from public, anon, authenticated;
revoke execute on function public.protect_public_store_settings() from public, anon, authenticated;
revoke execute on function public.validate_notification_integrity() from public, anon, authenticated;
revoke execute on function public.validate_conversation_identity() from public, anon, authenticated;
revoke execute on function public.validate_consumer_request_integrity() from public, anon, authenticated;
revoke execute on function public.protect_notification_content() from public, anon, authenticated;
revoke execute on function public.protect_review_moderation() from public, anon, authenticated;
revoke execute on function public.enforce_user_collection_limits() from public, anon, authenticated;
revoke execute on function public.require_admin_actor_fields() from public, anon, authenticated;
revoke execute on function public.sync_user_cart(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_transition_order(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.archive_assistant_knowledge_version() from public, anon, authenticated;
grant execute on function public.sync_user_cart(uuid, jsonb) to service_role;
grant execute on function public.admin_transition_order(uuid, text, text, uuid) to service_role;

comment on function public.admin_transition_order(uuid, text, text, uuid) is
  'Atomically transitions pending orders with payment cleanup, audit and customer/admin notifications.';

commit;
