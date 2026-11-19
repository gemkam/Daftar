-- Daftar Office Systems: database structure, part 1 of 7: tables (no data)
-- Exported from the live Supabase project on 17 Nov 2026.
-- Run the files in order 01 to 07 in the Supabase SQL Editor of a NEW project.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create table if not exists public.acc_accounts (
  id uuid default gen_random_uuid() not null,
  company text default 'al-noor'::text not null,
  name text not null,
  kind text default 'Bank'::text not null,
  bank_name text,
  account_no text,
  opening_balance numeric default 0 not null,
  opening_date date,
  active boolean default true not null,
  notes text,
  sort integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.acc_items (
  id uuid default gen_random_uuid() not null,
  company text default 'al-noor'::text not null,
  side text not null,
  name text not null,
  amount numeric default 0 not null,
  as_of date,
  notes text,
  sort integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.acc_txns (
  id uuid default gen_random_uuid() not null,
  account_id uuid not null,
  txn_date date default ((now() AT TIME ZONE 'Asia/Muscat'::text))::date not null,
  description text,
  party text,
  ref text,
  category text,
  money_in numeric default 0 not null,
  money_out numeric default 0 not null,
  cleared boolean default false not null,
  transfer_id uuid,
  notes text,
  entered_by text,
  created_at timestamp with time zone default now()
);

create table if not exists public.alert_dismissals (
  user_id uuid default auth.uid() not null,
  key text not null,
  dismissed_at timestamp with time zone default now() not null
);

create table if not exists public.app_labels (
  key text not null,
  label text not null,
  updated_at timestamp with time zone default now()
);

create table if not exists public.app_settings (
  key text not null,
  value text,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid default auth.uid()
);

create table if not exists public.audit_log (
  id bigint generated always as identity not null,
  at timestamp with time zone default now() not null,
  user_id uuid,
  username text,
  role text,
  table_name text not null,
  action text not null,
  row_id text,
  changed text[],
  old_data jsonb,
  new_data jsonb
);

create table if not exists public.bill_accounts (
  id uuid default gen_random_uuid() not null,
  name text not null,
  payment_type text,
  account_no text,
  sort integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  company text
);

create table if not exists public.bill_payments (
  id uuid default gen_random_uuid() not null,
  account_id uuid not null,
  amount numeric(12,3) not null,
  paid_on date default CURRENT_DATE not null,
  period text,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.categories (
  id uuid default gen_random_uuid() not null,
  name text not null,
  sort integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  company text
);

create table if not exists public.chat_members (
  room_id uuid not null,
  user_id uuid not null,
  last_read_at timestamp with time zone default now() not null
);

create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() not null,
  room_id uuid not null,
  user_id uuid default auth.uid() not null,
  kind text default 'text'::text not null,
  body text,
  file_path text,
  seconds numeric,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.chat_rooms (
  id uuid default gen_random_uuid() not null,
  kind text not null,
  company text,
  name text,
  created_at timestamp with time zone default now() not null,
  last_at timestamp with time zone default now() not null
);

create table if not exists public.company_access (
  user_id uuid not null,
  company text not null,
  given_by text,
  given_at timestamp with time zone default now() not null,
  pages jsonb
);

create table if not exists public.company_books (
  id uuid default gen_random_uuid() not null,
  company text not null,
  book text not null,
  title text,
  file_name text,
  sheets jsonb default '[]'::jsonb not null,
  signs jsonb,
  loaded_by text,
  loaded_at timestamp with time zone,
  updated_by text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  media jsonb
);

create table if not exists public.company_docs (
  id uuid default gen_random_uuid() not null,
  company text not null,
  kind text not null,
  doc_no text,
  doc_date date default ((now() AT TIME ZONE 'Asia/Muscat'::text))::date not null,
  party text,
  party_details text,
  party_vat text,
  items jsonb default '[]'::jsonb not null,
  vat_pct numeric default 0 not null,
  payment_method text,
  department text,
  head text,
  category text,
  notes text,
  signatory text,
  created_by text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  scan jsonb,
  files jsonb default '[]'::jsonb not null,
  extra jsonb default '{}'::jsonb not null,
  ai_check jsonb,
  verify jsonb,
  approval jsonb,
  einv jsonb,
  discount numeric(12,3) default 0 not null,
  lh jsonb,
  signs jsonb
);

create table if not exists public.doc_checklist (
  id uuid default gen_random_uuid() not null,
  section text not null,
  owner text,
  doc_name text,
  doc_no text,
  issue_date date,
  expiry_date date,
  state text,
  notes text,
  sort integer default 0,
  entered_by text,
  created_at timestamp with time zone default now(),
  files jsonb default '[]'::jsonb not null
);

create table if not exists public.entry_links (
  id uuid default gen_random_uuid() not null,
  token text default replace((gen_random_uuid())::text, '-'::text, ''::text) not null,
  label text default 'Data entry link'::text not null,
  driver_id uuid,
  active boolean default true not null,
  uses integer default 0 not null,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.exp_attendance (
  id uuid default gen_random_uuid() not null,
  company text not null,
  staff_id uuid not null,
  day date not null,
  mark text not null,
  note text,
  entered_by text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.exp_budgets (
  id uuid default gen_random_uuid() not null,
  source text not null,
  head text not null,
  monthly numeric(12,3) default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.exp_entries (
  id uuid default gen_random_uuid() not null,
  entry_date date not null,
  bill_no text,
  description text,
  category text,
  head text,
  paid numeric default 0,
  unpaid numeric,
  vat numeric,
  vat_reg_no text,
  account text default 'P & L'::text,
  notes text,
  entered_by text,
  sort integer default 0,
  created_at timestamp with time zone default now(),
  company text default 'sahil'::text not null,
  department text,
  source text,
  source_id uuid,
  source_kind text,
  vehicle_no text
);

create table if not exists public.exp_staff (
  id uuid default gen_random_uuid() not null,
  name text not null,
  department text,
  basic numeric default 0,
  allowances numeric default 0,
  working_days numeric default 30,
  deductions numeric default 0,
  active boolean default true,
  sort integer default 0,
  created_at timestamp with time zone default now(),
  company text default 'sahil'::text not null,
  resident_card text,
  resident_card_expiry date,
  visa_expiry date,
  paid_amount numeric(12,3),
  paid_on date,
  prev_balance numeric(12,3) default 0 not null,
  attendance_month text,
  staff_type text default 'Office'::text not null,
  designation text,
  contract text,
  passport text,
  mobile text,
  house_rent numeric default 0 not null,
  utilities numeric default 0 not null,
  transport_allow boolean default false not null,
  ticket text,
  files jsonb default '{}'::jsonb not null,
  slip_token uuid default gen_random_uuid() not null,
  slip_link_on boolean default true not null,
  user_id uuid,
  archived_at timestamp with time zone,
  archived_by text,
  archive_reason text
);

create table if not exists public.items (
  id uuid default gen_random_uuid() not null,
  category_id uuid not null,
  name text not null,
  unit text default 'pcs'::text not null,
  quantity numeric default 0 not null,
  min_qty numeric default 0 not null,
  sort integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  per_pack numeric default 1 not null,
  price numeric(12,3) default 0 not null
);

create table if not exists public.personnel_companies (
  key text not null,
  short text not null,
  name text,
  sort integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  cr text,
  address text
);

create table if not exists public.personnel_subcontractors (
  id uuid default gen_random_uuid() not null,
  name text default ''::text not null,
  company_name text,
  contract text,
  contact text,
  files jsonb default '{}'::jsonb not null,
  sort integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  company text,
  archived_at timestamp with time zone,
  archived_by text,
  archive_reason text
);

create table if not exists public.petty_cash (
  id uuid default gen_random_uuid() not null,
  company text not null,
  date date default CURRENT_DATE not null,
  kind text default 'out'::text not null,
  voucher text,
  description text,
  party text,
  category text,
  amount numeric(12,3) not null,
  note text,
  created_by text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.salary_credits (
  person_kind text not null,
  person_id uuid not null,
  month text not null,
  amount numeric,
  paid_at timestamp with time zone default now() not null,
  paid_by text
);

create table if not exists public.salary_slips (
  id uuid default gen_random_uuid() not null,
  person_kind text not null,
  person_id uuid not null,
  month text not null,
  company text,
  name text,
  designation text,
  staff_type text,
  basic numeric default 0 not null,
  house_rent numeric default 0 not null,
  utilities numeric default 0 not null,
  other_allow numeric default 0 not null,
  transport_allow boolean default false not null,
  earnings jsonb default '[]'::jsonb not null,
  monthly numeric default 0 not null,
  pay_days numeric,
  absent numeric default 0 not null,
  half numeric default 0 not null,
  leave numeric default 0 not null,
  gross numeric default 0 not null,
  deductions jsonb default '[]'::jsonb not null,
  deduction_total numeric default 0 not null,
  net numeric default 0 not null,
  note text,
  status text default 'draft'::text not null,
  version integer default 1 not null,
  revised_at timestamp with time zone,
  revise_reason text,
  history jsonb default '[]'::jsonb not null,
  generated_at timestamp with time zone default now() not null,
  generated_by text,
  approved_at timestamp with time zone,
  approved_by text
);

create table if not exists public.slip_push_subs (
  endpoint text not null,
  token text not null,
  sub jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.stock_moves (
  id uuid default gen_random_uuid() not null,
  item_id uuid not null,
  move_type text not null,
  qty numeric not null,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamp with time zone default now() not null
);

create table if not exists public.transport_drivers (
  id uuid default gen_random_uuid() not null,
  name text not null,
  vehicle_no text,
  sort integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  user_id uuid,
  resident_card text,
  phone text,
  status text default 'Active'::text,
  notes text,
  resident_card_expiry date,
  visa_expiry date,
  tax_on boolean default false not null,
  company text default 'al-noor'::text,
  contract text,
  passport text,
  salary numeric default 0 not null,
  allowances numeric default 0 not null,
  house_rent numeric default 0 not null,
  utilities numeric default 0 not null,
  ticket text,
  files jsonb default '{}'::jsonb not null,
  slip_token uuid default gen_random_uuid() not null,
  slip_link_on boolean default true not null,
  archived_at timestamp with time zone,
  archived_by text,
  archive_reason text
);

create table if not exists public.transport_entries (
  id uuid default gen_random_uuid() not null,
  driver_id uuid not null,
  entry_date date default CURRENT_DATE not null,
  description text,
  cargo text,
  consignee text,
  from_place text,
  to_place text,
  rent numeric(12,3) default 0 not null,
  received numeric(12,3) default 0 not null,
  driver_allowance numeric(12,3) default 0 not null,
  allowance_status text,
  diesel numeric(12,3) default 0 not null,
  toll numeric(12,3) default 0 not null,
  maintenance numeric(12,3) default 0 not null,
  payment_status text,
  remarks text,
  credit_in text,
  sort integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  entered_by text,
  received_date date,
  allowance_salary_id uuid,
  vat_included boolean default false not null,
  customer text,
  gate_pass numeric default 0 not null,
  exit_fee numeric default 0 not null,
  empty_border_fee numeric default 0 not null,
  container_wash numeric default 0 not null,
  vehicle_wash numeric default 0 not null,
  attachments jsonb default '{}'::jsonb not null,
  trip_completed boolean default false not null,
  completed_at timestamp with time zone,
  completed_by text,
  completed_role text
);

create table if not exists public.transport_extras (
  id uuid default gen_random_uuid() not null,
  driver_id uuid not null,
  month date not null,
  description text default 'Other expense'::text not null,
  amount numeric(12,3) default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.transport_invoices (
  id uuid default gen_random_uuid() not null,
  kind text default 'invoice'::text not null,
  invoice_no text,
  invoice_date date default CURRENT_DATE not null,
  customer text,
  from_place text,
  to_place text,
  project text,
  location text,
  client text,
  contractor text,
  items jsonb default '[]'::jsonb not null,
  delivery jsonb default '[]'::jsonb not null,
  signatory text,
  created_by text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  bill_address text,
  client_vat text,
  supply_date date,
  due_text text,
  payment_text text,
  notes text,
  description text,
  cargo text,
  consignee text,
  status text,
  credit_in text,
  labels jsonb default '{}'::jsonb not null,
  signs jsonb
);

create table if not exists public.transport_profit_taken (
  id uuid default gen_random_uuid() not null,
  driver_id uuid not null,
  taken_on date default ((now() AT TIME ZONE 'Asia/Muscat'::text))::date not null,
  amount numeric default 0 not null,
  note text,
  entered_by text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.transport_salaries (
  id uuid default gen_random_uuid() not null,
  driver_id uuid not null,
  month date not null,
  basic numeric(12,3) default 0 not null,
  room_rent numeric(12,3) default 0 not null,
  utilities numeric(12,3) default 0 not null,
  mobile numeric(12,3) default 0 not null,
  travel_food numeric(12,3) default 0 not null,
  trip_allowance numeric(12,3) default 0 not null,
  advance_deduction numeric(12,3) default 0 not null,
  special_allowance numeric(12,3) default 0 not null,
  created_at timestamp with time zone default now() not null,
  allowance_carried numeric(12,3) default 0,
  allowance_carried_note text,
  paid_amount numeric(12,3),
  paid_on date
);

create table if not exists public.transport_vehicles (
  id uuid default gen_random_uuid() not null,
  part text default 'Unit'::text not null,
  name text,
  model text,
  plate_no text,
  ownership text default 'Own'::text,
  trailer_type text,
  insurance_issue date,
  insurance_expiry date,
  mulkiya_issue date,
  mulkiya_expiry date,
  driver_id uuid,
  notes text,
  sort integer default 0,
  created_at timestamp with time zone default now(),
  voc_expiry date
);

create table if not exists public.user_designations (
  user_id uuid not null,
  designation text not null,
  updated_at timestamp with time zone default now()
);

create table if not exists public.user_events (
  id bigint generated always as identity not null,
  session_id uuid,
  user_id uuid default auth.uid() not null,
  at timestamp with time zone default now() not null,
  kind text not null,
  path text,
  label text,
  detail jsonb
);

create table if not exists public.user_sessions (
  id uuid default gen_random_uuid() not null,
  user_id uuid default auth.uid() not null,
  username text,
  display_name text,
  role text,
  started_at timestamp with time zone default now() not null,
  last_seen timestamp with time zone default now() not null,
  ended_at timestamp with time zone,
  end_reason text,
  device text,
  user_agent text
);

create table if not exists public.vehicle_maintenance (
  id uuid default gen_random_uuid() not null,
  vehicle_id uuid,
  work text,
  work_date date default ((now() AT TIME ZONE 'Asia/Muscat'::text))::date,
  amount numeric default 0,
  payment_method text,
  pdc_date date,
  next_due date,
  status text default 'Pending'::text,
  notes text,
  sort integer default 0,
  created_at timestamp with time zone default now(),
  paid_to text
);
