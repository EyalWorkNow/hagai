create type user_role as enum ('tenant', 'landlord', 'admin', 'vendor');
create type purchase_flow_status as enum ('pending', 'in_progress', 'completed');
create type integration_provider as enum ('yad2', 'midrag', 'insurance');
create type transaction_channel as enum (
  'maintenance_companies',
  'foreign_resident_agencies',
  'commercial_real_estate'
);

create table users (
  id text primary key,
  role user_role not null,
  full_name text not null,
  email text unique not null,
  phone text,
  kyc_status text,
  bdi_status text,
  insurance_preference text default 'undecided',
  created_at timestamptz default now()
);

create table auth_accounts (
  user_id text primary key references users(id) on delete cascade,
  email text unique not null,
  password_hash text not null
);

create table properties (
  id text primary key,
  landlord_id text references users(id),
  tenant_id text references users(id),
  address text not null,
  city text,
  rent_amount numeric(12,2) not null,
  building_committee numeric(12,2) default 0,
  arnona numeric(12,2) default 0,
  utilities_estimate numeric(12,2) default 0,
  status text not null,
  catalog_status text,
  insurance_offered boolean default false,
  created_at timestamptz default now()
);

create table contracts (
  id text primary key,
  property_id text not null references properties(id),
  landlord_id text references users(id),
  tenant_id text references users(id),
  status text not null,
  start_date date not null,
  end_date date not null,
  rent_amount numeric(12,2) not null,
  guarantee_type text,
  template_id text,
  created_at timestamptz default now()
);

create table payments (
  id text primary key,
  property_id text not null references properties(id),
  contract_id text references contracts(id),
  landlord_id text references users(id),
  tenant_id text references users(id),
  payment_type text not null,
  status text not null,
  amount numeric(12,2) not null,
  due_date date not null,
  created_at timestamptz default now()
);

create table integrations (
  id text primary key,
  provider integration_provider not null,
  status text not null,
  sync_health purchase_flow_status not null,
  last_sync_at timestamptz not null,
  transaction_count integer default 0,
  revenue numeric(12,2) default 0
);

create table platform_transactions (
  id text primary key,
  provider integration_provider not null,
  channel transaction_channel not null,
  status purchase_flow_status not null,
  property_id text references properties(id),
  contract_id text references contracts(id),
  payment_id text references payments(id),
  gross_amount numeric(12,2) not null,
  revenue_amount numeric(12,2) not null,
  created_at timestamptz default now()
);

create table support_issues (
  id text primary key,
  source text not null,
  severity text not null,
  status text not null,
  title text not null,
  created_at timestamptz default now()
);

create index idx_payments_due_date on payments(due_date);
create index idx_platform_transactions_created_at on platform_transactions(created_at);
create index idx_platform_transactions_provider on platform_transactions(provider);
