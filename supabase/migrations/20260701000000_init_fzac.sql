create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'USER' check (role in ('USER','ADMIN','OPERATOR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  image_url text,
  parent_id uuid references public.categories(id) on delete set null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  sku text not null unique,
  name text not null,
  description text not null default '',
  category_id uuid not null references public.categories(id) on delete restrict,
  subcategory text not null default 'General',
  brand text not null default 'FZAC',
  price numeric(12,2) not null check (price >= 0),
  compare_price numeric(12,2) check (compare_price is null or compare_price >= 0),
  stock int not null default 0 check (stock >= 0),
  stock_minimum int not null default 5 check (stock_minimum >= 0),
  unit text not null default 'unidad',
  image_url text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  specifications jsonb not null default '{}'::jsonb,
  featured boolean not null default false,
  on_sale boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Principal',
  street text not null,
  number text not null,
  apartment text,
  city text not null default 'Rosario',
  province text not null default 'Santa Fe',
  postal_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'PENDING_PAYMENT' check (
    status in ('PENDING_PAYMENT','PAID','CONFIRMED','PREPARING','READY_FOR_PICKUP','OUT_FOR_DELIVERY','DELIVERED','COMPLETED','CANCELLED')
  ),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  shipping_method text not null check (shipping_method in ('PICKUP','DELIVERY')),
  shipping_cost numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null,
  total numeric(12,2) not null,
  address_snapshot jsonb,
  notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text not null,
  name text not null,
  price numeric(12,2) not null,
  quantity int not null check (quantity > 0),
  image_url text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  provider text not null default 'MERCADOPAGO' check (provider in ('MERCADOPAGO','NARANJAX','MOCK')),
  status text not null default 'PENDING' check (status in ('PENDING','PAID','FAILED','EXPIRED','REFUNDED')),
  amount numeric(12,2) not null,
  currency text not null default 'ars',
  provider_preference_id text,
  provider_payment_id text,
  provider_session_id text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_tickets (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  payment_provider text not null,
  payment_id text,
  subtotal numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  shipping_method text not null check (shipping_method in ('PICKUP','DELIVERY')),
  address_snapshot jsonb,
  notes text,
  status text not null default 'ISSUED' check (status in ('ISSUED','PRINTED','CANCELLED')),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_ticket_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.purchase_tickets(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text not null,
  name text not null,
  quantity int not null,
  unit_price numeric(12,2) not null,
  subtotal numeric(12,2) not null,
  stock_before int,
  stock_after int,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('SALE','RETURN','ADJUSTMENT')),
  quantity int not null,
  stock_before int not null,
  stock_after int not null,
  reason text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  target_role text check (target_role in ('USER','ADMIN','OPERATOR')),
  type text not null,
  title text not null,
  message text not null,
  link_to text,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id text,
  message text not null,
  metadata jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  visitor_id text,
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  channel text not null default 'AI' check (channel in ('AI','SUPPORT')),
  status text not null default 'OPEN' check (status in ('OPEN','WAITING_ADMIN','RESOLVED','CLOSED')),
  subject text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('USER','ASSISTANT','ADMIN','SYSTEM')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text,
  query text not null,
  results_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  session_id text,
  created_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_active_stock_idx on public.products(active, stock);
create index if not exists products_featured_idx on public.products(featured);
create index if not exists products_on_sale_idx on public.products(on_sale);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists notifications_admin_idx on public.notifications(target_role, read, created_at desc);
create index if not exists chat_status_idx on public.chat_conversations(status, channel);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    'USER'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','categories','products','product_images','addresses','cart_items','orders','order_items','payments',
    'purchase_tickets','purchase_ticket_items','inventory_movements','notifications','admin_audit_logs',
    'chat_conversations','chat_messages','store_settings','favorites','reviews','search_events','product_views'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "profiles owner read" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles owner update" on public.profiles for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());
create policy "admin profiles all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

create policy "public active categories" on public.categories for select using (active = true or public.is_admin());
create policy "admin categories all" on public.categories for all using (public.is_admin()) with check (public.is_admin());

create policy "public active products" on public.products for select using (active = true or public.is_admin());
create policy "admin products all" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "public product images" on public.product_images for select using (
  exists (select 1 from public.products p where p.id = product_id and p.active = true) or public.is_admin()
);
create policy "admin product images all" on public.product_images for all using (public.is_admin()) with check (public.is_admin());

create policy "addresses owner" on public.addresses for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "cart owner" on public.cart_items for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());

create policy "orders owner read" on public.orders for select using (auth.uid() = user_id or public.is_admin());
create policy "admin orders all" on public.orders for all using (public.is_admin()) with check (public.is_admin());
create policy "order items owner read" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "admin order items all" on public.order_items for all using (public.is_admin()) with check (public.is_admin());

create policy "payments owner read" on public.payments for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "admin payments all" on public.payments for all using (public.is_admin()) with check (public.is_admin());

create policy "tickets owner read" on public.purchase_tickets for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
create policy "admin tickets all" on public.purchase_tickets for all using (public.is_admin()) with check (public.is_admin());
create policy "ticket items owner read" on public.purchase_ticket_items for select using (
  exists (
    select 1
    from public.purchase_tickets t
    join public.orders o on o.id = t.order_id
    where t.id = ticket_id and (o.user_id = auth.uid() or public.is_admin())
  )
);
create policy "admin ticket items all" on public.purchase_ticket_items for all using (public.is_admin()) with check (public.is_admin());

create policy "admin inventory all" on public.inventory_movements for all using (public.is_admin()) with check (public.is_admin());
create policy "notifications owner read" on public.notifications for select using (auth.uid() = user_id or target_role = 'ADMIN' and public.is_admin());
create policy "notifications owner update" on public.notifications for update using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "admin notifications all" on public.notifications for all using (public.is_admin()) with check (public.is_admin());
create policy "admin audit read" on public.admin_audit_logs for select using (public.is_admin());
create policy "admin audit insert" on public.admin_audit_logs for insert with check (public.is_admin());

create policy "chat owner" on public.chat_conversations for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "chat messages owner" on public.chat_messages for all using (
  exists (select 1 from public.chat_conversations c where c.id = conversation_id and (c.user_id = auth.uid() or public.is_admin()))
) with check (
  exists (select 1 from public.chat_conversations c where c.id = conversation_id and (c.user_id = auth.uid() or public.is_admin()))
);

create policy "public store settings" on public.store_settings for select using (public = true or public.is_admin());
create policy "admin store settings all" on public.store_settings for all using (public.is_admin()) with check (public.is_admin());
create policy "favorites owner" on public.favorites for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "reviews public approved" on public.reviews for select using (approved = true or auth.uid() = user_id or public.is_admin());
create policy "reviews owner insert" on public.reviews for insert with check (auth.uid() = user_id);
create policy "admin reviews all" on public.reviews for all using (public.is_admin()) with check (public.is_admin());
create policy "search events owner insert" on public.search_events for insert with check (auth.uid() = user_id or user_id is null);
create policy "admin search events read" on public.search_events for select using (public.is_admin());
create policy "product views insert" on public.product_views for insert with check (auth.uid() = user_id or user_id is null);
create policy "admin product views read" on public.product_views for select using (public.is_admin());

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger addresses_updated_at before update on public.addresses for each row execute function public.set_updated_at();
create trigger cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger purchase_tickets_updated_at before update on public.purchase_tickets for each row execute function public.set_updated_at();
create trigger notifications_updated_at before update on public.notifications for each row execute function public.set_updated_at();
create trigger chat_conversations_updated_at before update on public.chat_conversations for each row execute function public.set_updated_at();
