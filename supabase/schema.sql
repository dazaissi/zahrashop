-- ============================================
-- 1. TABEL PROFIL BISNIS
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  logo_url text,
  bank_info text,
  qris_url text,
  created_at timestamptz default now()
);

-- ============================================
-- 2. PELANGGAN
-- ============================================
create table public.customers (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz default now()
);

-- ============================================
-- 3. PRODUK + STOK
-- ============================================
create table public.products (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sku text,
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  stock int not null default 0,
  min_stock int not null default 0,
  created_at timestamptz default now()
);

-- ============================================
-- 4. RIWAYAT PERGERAKAN STOK
-- ============================================
create table public.stock_movements (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  change int not null,
  reason text not null,
  reference_id bigint,
  created_at timestamptz default now()
);

-- ============================================
-- 5. INVOICE
-- ============================================
create table public.invoices (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id bigint references public.customers(id) on delete set null,
  invoice_number text not null,
  issue_date date not null default current_date,
  due_date date,
  status text not null default 'draft'
    check (status in ('draft','sent','partial','paid','overdue')),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  tax_percent numeric(5,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz default now(),
  unique (user_id, invoice_number)
);

-- ============================================
-- 6. ITEM INVOICE
-- ============================================
create table public.invoice_items (
  id bigint primary key generated always as identity,
  invoice_id bigint not null references public.invoices(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  description text,
  quantity int not null default 1,
  unit_price numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0
);

-- ============================================
-- 7. AKTIFKAN RLS (KEAMANAN DATA)
-- ============================================
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

-- ============================================
-- 8. POLICY RLS
-- ============================================
create policy "profile_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profile_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profile_insert_own" on public.profiles for insert with check (auth.uid() = id);

create policy "customers_all_own" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "products_all_own" on public.products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "stock_all_own" on public.stock_movements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invoices_all_own" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "items_via_invoice" on public.invoice_items
  for all using (
    invoice_id in (select id from public.invoices where user_id = auth.uid())
  ) with check (
    invoice_id in (select id from public.invoices where user_id = auth.uid())
  );

-- ============================================
-- 9. TRIGGER: Buat profil otomatis saat daftar
-- ============================================
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, business_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'business_name', 'Bisnis Saya'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 10. TRIGGER: Kurangi stok saat invoice terkirim
-- ============================================
create function public.apply_invoice_stock()
returns trigger as $$
declare
  it record;
begin
  if new.status in ('sent','paid','partial') and old.status = 'draft' then
    for it in select * from public.invoice_items where invoice_id = new.id loop
      if it.product_id is not null then
        update public.products
          set stock = stock - it.quantity
          where id = it.product_id;
        insert into public.stock_movements (user_id, product_id, change, reason, reference_id)
          values (new.user_id, it.product_id, -it.quantity, 'invoice', new.id);
      end if;
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_invoice_stock
  after update on public.invoices
  for each row execute procedure public.apply_invoice_stock();