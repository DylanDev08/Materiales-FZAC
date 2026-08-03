-- Supervised procurement: suppliers, purchase orders and atomic stock receipts.
-- Receiving merchandise changes inventory; creating or sending an order never does.

begin;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_type_check;

alter table public.inventory_movements
  add constraint inventory_movements_type_check
  check (type in ('SALE', 'RETURN', 'ADJUSTMENT', 'PURCHASE_RECEIPT'));

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),
  name text not null check (char_length(name) between 2 and 140),
  contact_name text check (contact_name is null or char_length(contact_name) between 2 and 120),
  email text check (email is null or char_length(email) <= 180),
  phone text check (phone is null or char_length(phone) between 6 and 30),
  tax_id text check (tax_id is null or char_length(tax_id) between 7 and 20),
  payment_terms text check (payment_terms is null or char_length(payment_terms) <= 180),
  lead_time_days int not null default 7 check (lead_time_days between 1 and 120),
  notes text check (notes is null or char_length(notes) <= 600),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (order_number ~ '^FZAC-OC-[0-9]{8}-[A-F0-9]{6}$'),
  request_key uuid not null unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),
  currency text not null default 'ARS' check (currency = 'ARS'),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  expected_at date,
  notes text check (notes is null or char_length(notes) <= 600),
  created_by uuid not null references public.profiles(id) on delete restrict,
  ordered_by uuid references public.profiles(id) on delete restrict,
  ordered_at timestamptz,
  received_by uuid references public.profiles(id) on delete restrict,
  received_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) between 3 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total = subtotal),
  check (
    (status = 'CANCELLED' and cancelled_by is not null and cancelled_at is not null and cancellation_reason is not null)
    or
    (status <> 'CANCELLED' and cancelled_by is null and cancelled_at is null and cancellation_reason is null)
  )
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null check (char_length(product_name) between 2 and 160),
  sku text not null check (char_length(sku) between 2 and 80),
  unit text not null check (char_length(unit) between 1 and 40),
  quantity int not null check (quantity between 1 and 1000000),
  received_quantity int not null default 0 check (received_quantity >= 0 and received_quantity <= quantity),
  unit_cost numeric(14,2) not null check (unit_cost > 0),
  subtotal numeric(14,2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, product_id)
);

create index if not exists suppliers_active_name_idx on public.suppliers(active, name);
create index if not exists purchase_orders_status_created_idx on public.purchase_orders(status, created_at desc);
create index if not exists purchase_orders_supplier_created_idx on public.purchase_orders(supplier_id, created_at desc);
create index if not exists purchase_order_items_order_idx on public.purchase_order_items(purchase_order_id);
create index if not exists purchase_order_items_product_idx on public.purchase_order_items(product_id);

drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at before update on public.suppliers
for each row execute function public.set_updated_at();

drop trigger if exists purchase_orders_updated_at on public.purchase_orders;
create trigger purchase_orders_updated_at before update on public.purchase_orders
for each row execute function public.set_updated_at();

drop trigger if exists purchase_order_items_updated_at on public.purchase_order_items;
create trigger purchase_order_items_updated_at before update on public.purchase_order_items
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;
alter table public.suppliers force row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_orders force row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_order_items force row level security;

drop policy if exists "admin suppliers read" on public.suppliers;
create policy "admin suppliers read" on public.suppliers for select to authenticated
using (public.is_admin());

drop policy if exists "admin purchase orders read" on public.purchase_orders;
create policy "admin purchase orders read" on public.purchase_orders for select to authenticated
using (public.is_admin());

drop policy if exists "admin purchase order items read" on public.purchase_order_items;
create policy "admin purchase order items read" on public.purchase_order_items for select to authenticated
using (public.is_admin());

revoke all on table public.suppliers from anon, authenticated;
revoke all on table public.purchase_orders from anon, authenticated;
revoke all on table public.purchase_order_items from anon, authenticated;
grant select on table public.suppliers to authenticated;
grant select on table public.purchase_orders to authenticated;
grant select on table public.purchase_order_items to authenticated;
grant all on table public.suppliers to service_role;
grant all on table public.purchase_orders to service_role;
grant all on table public.purchase_order_items to service_role;

create or replace function public.create_purchase_order(
  p_supplier_id uuid,
  p_request_key uuid,
  p_expected_at date,
  p_notes text,
  p_items jsonb,
  p_actor_id uuid
)
returns table(order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity int;
  v_unit_cost numeric(14,2);
  v_total numeric(14,2) := 0;
  v_existing public.purchase_orders%rowtype;
begin
  if p_actor_id is null or not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'Administrador invalido.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'La orden debe tener entre 1 y 50 productos.';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id and active = true) then
    raise exception 'Proveedor inexistente o inactivo.';
  end if;

  select * into v_existing from public.purchase_orders where request_key = p_request_key;
  if found then
    return query select v_existing.id, v_existing.order_number;
    return;
  end if;

  v_order_number := 'FZAC-OC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 6));
  begin
    insert into public.purchase_orders (
      id, order_number, request_key, supplier_id, expected_at, notes, created_by
    ) values (
      v_order_id, v_order_number, p_request_key, p_supplier_id, p_expected_at, nullif(trim(p_notes), ''), p_actor_id
    );
  exception when unique_violation then
    select * into v_existing from public.purchase_orders where request_key = p_request_key;
    if found then
      return query select v_existing.id, v_existing.order_number;
      return;
    end if;
    raise;
  end;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::int;
    v_unit_cost := (v_item->>'unitCost')::numeric;
    if v_quantity < 1 or v_quantity > 1000000 or v_unit_cost <= 0 then
      raise exception 'Cantidad o costo invalido.';
    end if;
    select * into v_product from public.products where id = (v_item->>'productId')::uuid and active = true;
    if not found then raise exception 'Producto inexistente o inactivo.'; end if;

    insert into public.purchase_order_items (
      purchase_order_id, product_id, product_name, sku, unit, quantity, unit_cost
    ) values (
      v_order_id, v_product.id, v_product.name, v_product.sku, v_product.unit, v_quantity, v_unit_cost
    );
    v_total := v_total + (v_quantity * v_unit_cost);
  end loop;

  update public.purchase_orders set subtotal = v_total, total = v_total where id = v_order_id;
  insert into public.admin_audit_logs (
    actor_id, action, entity, entity_id, message, metadata
  ) values (
    p_actor_id, 'PURCHASE_ORDER_CREATED', 'purchase_orders', v_order_id::text,
    'Orden de compra creada: ' || v_order_number,
    jsonb_build_object('supplier_id', p_supplier_id, 'total', v_total)
  );
  return query select v_order_id, v_order_number;
end;
$$;

create or replace function public.receive_purchase_order(
  p_order_id uuid,
  p_items jsonb,
  p_actor_id uuid
)
returns table(order_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_receipt jsonb;
  v_item public.purchase_order_items%rowtype;
  v_product public.products%rowtype;
  v_quantity int;
  v_completed boolean;
  v_status text;
begin
  if p_actor_id is null or not exists (select 1 from public.profiles where id = p_actor_id) then
    raise exception 'Administrador invalido.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'La recepcion debe incluir productos.';
  end if;

  select * into v_order from public.purchase_orders where id = p_order_id for update;
  if not found then raise exception 'Orden inexistente.'; end if;
  if v_order.status not in ('ORDERED', 'PARTIALLY_RECEIVED') then
    raise exception 'La orden no esta habilitada para recepcion.';
  end if;

  for v_receipt in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_receipt->>'quantity')::int;
    if v_quantity < 1 then raise exception 'Cantidad recibida invalida.'; end if;
    select * into v_item
      from public.purchase_order_items
      where id = (v_receipt->>'itemId')::uuid and purchase_order_id = p_order_id
      for update;
    if not found or v_item.received_quantity + v_quantity > v_item.quantity then
      raise exception 'La recepcion supera la cantidad pendiente.';
    end if;
    select * into v_product from public.products where id = v_item.product_id for update;
    if not found then raise exception 'Producto inexistente.'; end if;

    update public.products set stock = stock + v_quantity, updated_at = now() where id = v_product.id;
    update public.purchase_order_items
      set received_quantity = received_quantity + v_quantity
      where id = v_item.id;
    insert into public.inventory_movements (
      product_id, actor_id, type, quantity, stock_before, stock_after, reason, metadata
    ) values (
      v_product.id, p_actor_id, 'PURCHASE_RECEIPT', v_quantity, v_product.stock,
      v_product.stock + v_quantity, 'Recepcion de ' || v_order.order_number,
      jsonb_build_object('purchase_order_id', p_order_id, 'purchase_order_item_id', v_item.id)
    );
  end loop;

  select bool_and(received_quantity = quantity) into v_completed
  from public.purchase_order_items where purchase_order_id = p_order_id;
  v_status := case when v_completed then 'RECEIVED' else 'PARTIALLY_RECEIVED' end;
  update public.purchase_orders set
    status = v_status,
    received_by = case when v_completed then p_actor_id else received_by end,
    received_at = case when v_completed then now() else received_at end
  where id = p_order_id;

  insert into public.admin_audit_logs (
    actor_id, action, entity, entity_id, message, metadata
  ) values (
    p_actor_id, 'PURCHASE_ORDER_RECEIVED', 'purchase_orders', p_order_id::text,
    case when v_completed then 'Orden de compra recibida por completo.' else 'Recepcion parcial de orden de compra.' end,
    jsonb_build_object('status', v_status, 'items', p_items)
  );
  return query select p_order_id, v_status;
end;
$$;

revoke execute on function public.create_purchase_order(uuid, uuid, date, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.receive_purchase_order(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_purchase_order(uuid, uuid, date, text, jsonb, uuid) to service_role;
grant execute on function public.receive_purchase_order(uuid, jsonb, uuid) to service_role;

comment on table public.suppliers is 'Private FZAC supplier directory. Admin only.';
comment on table public.purchase_orders is 'Supervised supplier orders. Stock changes only through atomic receipt.';
comment on function public.receive_purchase_order(uuid, jsonb, uuid) is 'Atomically receives purchase-order items and writes stock movements once.';

commit;
