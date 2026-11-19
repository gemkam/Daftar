-- 09 Self sign up + Add my company (19 Nov 2026, Kamran)
-- Anyone can make his own login on /signup (role editor, app_metadata.self = true).
-- He then fills ＋ Add company (owner + company details). The company is his only:
-- company_access gets (his id, company key). He never sees other companies.
-- Administrators still see every company.

alter table public.personnel_companies
  add column if not exists name_ar text,
  add column if not exists legal_type text,
  add column if not exists cr_expiry date,
  add column if not exists vat_no text,
  add column if not exists activity text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists owner_name text,
  add column if not exists owner_id_no text,
  add column if not exists owner_nationality text,
  add column if not exists owner_phone text,
  add column if not exists owner_user uuid,
  add column if not exists created_by uuid default auth.uid();

-- self signed up user?
create or replace function public.is_self() returns boolean
language sql stable set search_path to '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'self') = 'true', false);
$$;

-- /signup: make my own login (no Administrator needed)
create or replace function public.public_signup(p_username text, p_password text, p_display text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_user text := lower(trim(p_username));
  v_email text;
  v_id uuid := gen_random_uuid();
begin
  if v_user !~ '^[a-z0-9._-]{3,30}$' then raise exception 'Username must be 3 to 30 letters or numbers, no spaces'; end if;
  if v_user in ('admin', 'administrator', 'root', 'support', 'daftar', 'kstech') then raise exception 'This username is not allowed'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Password must be at least 6 characters'; end if;
  if length(trim(coalesce(p_display, ''))) < 2 then raise exception 'Type your full name'; end if;
  v_email := v_user || '@daftar.local';
  if exists (select 1 from auth.users where email = v_email) then raise exception 'This username is already taken'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', 'editor', 'self', true),
    jsonb_build_object('display_name', left(trim(p_display), 80)), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  return v_id;
end $$;
revoke all on function public.public_signup(text, text, text) from public;
grant execute on function public.public_signup(text, text, text) to anon, authenticated;

-- ＋ Add company by a signed up user: saves the company and gives it to him only
create or replace function public.add_my_company(p jsonb)
returns text language plpgsql security definer set search_path to '' as $$
declare
  v_short text := left(trim(coalesce(p ->> 'short', '')), 60);
  v_name text := left(trim(coalesce(p ->> 'name', '')), 160);
  v_cr text := regexp_replace(coalesce(p ->> 'cr', ''), '[^0-9A-Za-z/-]', '', 'g');
  v_key text;
  v_n int;
begin
  if auth.uid() is null or not public.can_write() then raise exception 'Please log in first'; end if;
  if v_name = '' then raise exception 'Type the company name'; end if;
  if v_short = '' then v_short := left(v_name, 40); end if;
  if v_cr = '' then raise exception 'Type the CR number'; end if;
  if trim(coalesce(p ->> 'owner_name', '')) = '' then raise exception 'Type the owner name'; end if;
  if trim(coalesce(p ->> 'owner_id_no', '')) = '' then raise exception 'Type the ID card number'; end if;
  if exists (select 1 from public.personnel_companies where regexp_replace(coalesce(cr, ''), '[^0-9A-Za-z/-]', '', 'g') = v_cr) then
    raise exception 'This CR number is already registered';
  end if;
  select count(*) into v_n from public.personnel_companies where owner_user = auth.uid();
  if public.is_self() and v_n >= 10 then raise exception 'You can add up to 10 companies'; end if;
  v_key := coalesce(nullif(trim(both '-' from regexp_replace(lower(v_short), '[^a-z0-9]+', '-', 'g')), ''), 'company')
    || '-' || substr(md5(gen_random_uuid()::text), 1, 5);
  insert into public.personnel_companies (key, short, name, sort, cr, address, name_ar, legal_type, cr_expiry, vat_no, activity,
    phone, email, owner_name, owner_id_no, owner_nationality, owner_phone, owner_user, created_by)
  values (v_key, v_short, upper(v_name), 100 + v_n, v_cr, nullif(left(trim(coalesce(p ->> 'address', '')), 300), ''),
    nullif(left(trim(coalesce(p ->> 'name_ar', '')), 160), ''), nullif(left(trim(coalesce(p ->> 'legal_type', '')), 60), ''),
    nullif(p ->> 'cr_expiry', '')::date, nullif(left(trim(coalesce(p ->> 'vat_no', '')), 40), ''),
    nullif(left(trim(coalesce(p ->> 'activity', '')), 200), ''), nullif(left(trim(coalesce(p ->> 'phone', '')), 40), ''),
    nullif(left(trim(coalesce(p ->> 'email', '')), 120), ''), left(trim(p ->> 'owner_name'), 120), left(trim(p ->> 'owner_id_no'), 40),
    nullif(left(trim(coalesce(p ->> 'owner_nationality', '')), 60), ''), nullif(left(trim(coalesce(p ->> 'owner_phone', '')), 40), ''),
    auth.uid(), auth.uid());
  insert into public.company_access (user_id, company, given_by) values (auth.uid(), v_key, 'own company')
    on conflict do nothing;
  return v_key;
end $$;
revoke all on function public.add_my_company(jsonb) from public, anon;
grant execute on function public.add_my_company(jsonb) to authenticated;

-- companies list: only my companies (Administrators and '*' users: all)
drop policy if exists personnel_co_read on public.personnel_companies;
drop policy if exists personnel_co_write on public.personnel_companies;
drop policy if exists personnel_co_insert on public.personnel_companies;
drop policy if exists personnel_co_update on public.personnel_companies;
drop policy if exists personnel_co_delete on public.personnel_companies;
create policy personnel_co_read on public.personnel_companies for select
  using (public.can_read() and (public.has_company(key) or created_by = auth.uid()));
create policy personnel_co_insert on public.personnel_companies for insert
  with check (public.can_write() and not public.is_self());
create policy personnel_co_update on public.personnel_companies for update
  using (public.can_write() and public.has_company(key)) with check (public.can_write() and public.has_company(key));
create policy personnel_co_delete on public.personnel_companies for delete
  using (public.can_write() and not public.is_self() and public.has_company(key));

-- shared things a signed up user must not see or change
drop policy if exists "no self users" on public.doc_checklist;
create policy "no self users" on public.doc_checklist as restrictive for all
  using (not public.is_self()) with check (not public.is_self());
drop policy if exists "no self ins" on public.app_labels;
drop policy if exists "no self upd" on public.app_labels;
drop policy if exists "no self del" on public.app_labels;
create policy "no self ins" on public.app_labels as restrictive for insert with check (not public.is_self());
create policy "no self upd" on public.app_labels as restrictive for update using (not public.is_self());
create policy "no self del" on public.app_labels as restrictive for delete using (not public.is_self());
