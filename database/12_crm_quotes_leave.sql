-- 12 Customers (CRM), Quotations and Leave requests (27 Nov 2026, Kamran).
-- Run once in Supabase > SQL Editor (safe to run again).
-- Same rules as the other company tables: View only can read, Full access can do everything,
-- Data entry can add and change (Data entry cannot approve leave).

-- 🤝 Customers / leads
create table if not exists public.crm_contacts (
  id uuid default gen_random_uuid() primary key,
  company text not null,
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  vat_no text,
  stage text default 'lead' not null check (stage in ('lead', 'contacted', 'quoted', 'won', 'lost')),
  source text,
  value numeric(12,3) default 0 not null,
  next_follow_up date,
  owner text,
  notes text,
  log jsonb default '[]'::jsonb not null,
  created_by text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create index if not exists crm_contacts_co_idx on public.crm_contacts (company, stage);
create index if not exists crm_contacts_follow_idx on public.crm_contacts (company, next_follow_up);

-- 📝 Quotations (Convert to invoice makes a normal invoice in company_docs)
create table if not exists public.quotations (
  id uuid default gen_random_uuid() primary key,
  company text not null,
  quote_no text,
  quote_date date default ((now() at time zone 'Asia/Muscat'))::date not null,
  valid_until date,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  party text not null,
  party_details text,
  party_vat text,
  items jsonb default '[]'::jsonb not null,
  discount numeric(12,3) default 0 not null,
  vat_pct numeric default 5 not null,
  notes text,
  terms text,
  status text default 'draft' not null check (status in ('draft', 'sent', 'accepted', 'rejected', 'invoiced')),
  invoice_id uuid references public.company_docs(id) on delete set null,
  invoice_no text,
  created_by text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create index if not exists quotations_co_idx on public.quotations (company, quote_date desc);

-- 🌴 Leave requests (Approve marks the days in Attendance by itself)
create table if not exists public.leave_requests (
  id uuid default gen_random_uuid() primary key,
  company text not null,
  staff_id uuid not null references public.exp_staff(id) on delete cascade,
  leave_type text default 'Annual' not null,
  date_from date not null,
  date_to date not null,
  days numeric default 0 not null,
  reason text,
  status text default 'pending' not null check (status in ('pending', 'approved', 'rejected')),
  requested_by text,
  decided_by text,
  decided_at timestamp with time zone,
  decision_note text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  check (date_to >= date_from)
);
create index if not exists leave_requests_co_idx on public.leave_requests (company, date_from desc);
create index if not exists leave_requests_staff_idx on public.leave_requests (staff_id, date_from);

alter table public.crm_contacts enable row level security;
alter table public.quotations enable row level security;
alter table public.leave_requests enable row level security;

grant select, insert, update, delete on public.crm_contacts, public.quotations, public.leave_requests to authenticated;

do $$ declare t text; begin
  foreach t in array array['crm_contacts', 'quotations'] loop
    execute format('drop policy if exists "read %1$s" on public.%1$I', t);
    execute format('drop policy if exists "write %1$s" on public.%1$I', t);
    execute format('drop policy if exists "data entry add %1$s" on public.%1$I', t);
    execute format('drop policy if exists "data entry change %1$s" on public.%1$I', t);
    execute format('create policy "read %1$s" on public.%1$I for select using (public.can_read() and public.has_company(company))', t);
    execute format('create policy "write %1$s" on public.%1$I for all using (public.can_write() and public.has_company(company)) with check (public.can_write() and public.has_company(company))', t);
    execute format('create policy "data entry add %1$s" on public.%1$I for insert with check (public.app_role() = ''entry'' and public.has_company(company))', t);
    execute format('create policy "data entry change %1$s" on public.%1$I for update using (public.app_role() = ''entry'' and public.has_company(company)) with check (public.app_role() = ''entry'' and public.has_company(company))', t);
  end loop;
end $$;

drop policy if exists "read leave_requests" on public.leave_requests;
drop policy if exists "write leave_requests" on public.leave_requests;
drop policy if exists "data entry add leave_requests" on public.leave_requests;
drop policy if exists "data entry change leave_requests" on public.leave_requests;
create policy "read leave_requests" on public.leave_requests for select
  using (public.can_read() and public.has_company(company));
create policy "write leave_requests" on public.leave_requests for all
  using (public.can_write() and public.has_company(company))
  with check (public.can_write() and public.has_company(company));
-- Data entry: may add a request and change it while it is still pending, never approve or reject
create policy "data entry add leave_requests" on public.leave_requests for insert
  with check (public.app_role() = 'entry' and public.has_company(company) and status = 'pending');
create policy "data entry change leave_requests" on public.leave_requests for update
  using (public.app_role() = 'entry' and public.has_company(company) and status = 'pending')
  with check (public.app_role() = 'entry' and public.has_company(company) and status = 'pending');

-- Activity log, same as the other tables
drop trigger if exists trg_audit on public.crm_contacts;
drop trigger if exists trg_audit on public.quotations;
drop trigger if exists trg_audit on public.leave_requests;
create trigger trg_audit after insert or delete or update on public.crm_contacts for each row execute function public.audit_row();
create trigger trg_audit after insert or delete or update on public.quotations for each row execute function public.audit_row();
create trigger trg_audit after insert or delete or update on public.leave_requests for each row execute function public.audit_row();
