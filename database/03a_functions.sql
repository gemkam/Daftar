-- Part 3a of 7: functions (first half)
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.activity_end(p_session uuid, p_reason text DEFAULT 'closed'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.user_sessions set last_seen = now(), ended_at = now(), end_reason = left(p_reason, 30)
   where id = p_session and user_id = auth.uid() and ended_at is null;
end $function$
;
CREATE OR REPLACE FUNCTION public.activity_ping(p_session uuid, p_kind text DEFAULT NULL::text, p_path text DEFAULT NULL::text, p_label text DEFAULT NULL::text, p_detail jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then return false; end if;
  update public.user_sessions set last_seen = now(), ended_at = null, end_reason = null
   where id = p_session and user_id = auth.uid() and (ended_at is null or ended_at > now() - interval '30 minutes');
  if not found then return false; end if;
  if p_kind is not null then
    insert into public.user_events(session_id, user_id, kind, path, label, detail)
    values (p_session, auth.uid(), left(p_kind, 20), left(p_path, 300), left(p_label, 300), p_detail);
  end if;
  return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.activity_start(p_device text DEFAULT NULL::text, p_agent text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_email text;
begin
  if auth.uid() is null then return null; end if;
  v_email := coalesce(auth.jwt() ->> 'email', '');
  insert into public.user_sessions(user_id, username, display_name, role, device, user_agent)
  values (auth.uid(), split_part(v_email, '@', 1),
          coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', split_part(v_email, '@', 1)),
          coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''),
          left(p_device, 80), left(p_agent, 400))
  returning id into v_id;
  return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_company_data(p_company text, p_mode text DEFAULT 'count'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  staff_ids uuid[];
  acc_ids uuid[];
  r jsonb;
begin
  if not public.is_admin() then raise exception 'Only Administrator'; end if;
  if coalesce(p_company,'') = '' then raise exception 'No company'; end if;
  select coalesce(array_agg(id), '{}') into staff_ids from exp_staff where company = p_company;
  select coalesce(array_agg(id), '{}') into acc_ids from acc_accounts where company = p_company;
  if p_mode = 'count' then
    return jsonb_build_object(
      'bills_invoices', (select count(*) from company_docs where company = p_company),
      'expense_lines', (select count(*) from exp_entries where company = p_company and (source is null or source = 'company_docs')),
      'auto_transport_lines', (select count(*) from exp_entries where company = p_company and source is not null and source <> 'company_docs'),
      'staff', (select count(*) from exp_staff where company = p_company),
      'attendance', (select count(*) from exp_attendance where company = p_company),
      'salary_slips', (select count(*) from salary_slips where company = p_company),
      'salary_credits', (select count(*) from salary_credits where person_kind = 'staff' and person_id = any(staff_ids)),
      'subcontractors', (select count(*) from personnel_subcontractors where company = p_company),
      'bank_accounts', (select count(*) from acc_accounts where company = p_company),
      'bank_lines', (select count(*) from acc_txns where account_id = any(acc_ids)),
      'assets_loans', (select count(*) from acc_items where company = p_company),
      'budgets', (select count(*) from exp_budgets where source = p_company),
      'user_access', (select count(*) from company_access where company = p_company));
  elsif p_mode = 'backup' then
    return jsonb_build_object(
      'company', p_company, 'made_at', now(),
      'company_docs', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from company_docs x where company = p_company),
      'exp_entries', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from exp_entries x where company = p_company),
      'exp_staff', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from exp_staff x where company = p_company),
      'exp_attendance', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from exp_attendance x where company = p_company),
      'salary_slips', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from salary_slips x where company = p_company),
      'salary_credits', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from salary_credits x where person_kind = 'staff' and person_id = any(staff_ids)),
      'personnel_subcontractors', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from personnel_subcontractors x where company = p_company),
      'acc_accounts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from acc_accounts x where company = p_company),
      'acc_txns', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from acc_txns x where account_id = any(acc_ids)),
      'acc_items', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from acc_items x where company = p_company),
      'exp_budgets', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from exp_budgets x where source = p_company));
  elsif p_mode = 'delete' then
    r := public.admin_company_data(p_company, 'count');
    delete from company_docs where company = p_company;
    delete from exp_entries where company = p_company and (source is null or source = 'company_docs');
    delete from exp_attendance where company = p_company;
    delete from salary_slips where company = p_company;
    delete from salary_credits where person_kind = 'staff' and person_id = any(staff_ids);
    delete from exp_staff where company = p_company;
    delete from personnel_subcontractors where company = p_company;
    delete from acc_txns where account_id = any(acc_ids);
    delete from acc_accounts where company = p_company;
    delete from acc_items where company = p_company;
    delete from exp_budgets where source = p_company;
    return r;
  elsif p_mode = 'remove' then
    if p_company in ('al-noor','sahil') then raise exception 'The 2 main companies cannot be removed'; end if;
    r := public.admin_company_data(p_company, 'delete');
    delete from company_access where company = p_company;
    delete from personnel_companies where key = p_company;
    return r;
  end if;
  raise exception 'Unknown mode';
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_create_user(p_username text, p_password text, p_display text, p_role text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user text := lower(trim(p_username));
  v_email text;
  v_id uuid := gen_random_uuid();
begin
  if not public.is_admin() then raise exception 'Only Administrator can manage users'; end if;
  if v_user !~ '^[a-z0-9._-]{2,30}$' then raise exception 'Username must be 2 to 30 letters or numbers, no spaces'; end if;
  if p_role not in ('admin', 'editor', 'viewer', 'entry', 'driver') then raise exception 'Unknown access level'; end if;
  if length(coalesce(p_password, '')) < 4 then raise exception 'Password must be at least 4 characters'; end if;
  v_email := v_user || '@daftar.local';
  if exists (select 1 from auth.users where email = v_email) then raise exception 'This username already exists'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', p_role),
    jsonb_build_object('display_name', coalesce(nullif(trim(p_display), ''), p_username)), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Only Administrator can manage users'; end if;
  if p_id = auth.uid() then raise exception 'You cannot delete yourself'; end if;
  delete from auth.users where id = p_id and email like '%@daftar.local';
  if not found then raise exception 'User not found'; end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_list_users()
 RETURNS TABLE(id uuid, username text, display_name text, role text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Only Administrator can manage users'; end if;
  return query
    select u.id, split_part(u.email, '@', 1)::text,
           coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))::text,
           coalesce(u.raw_app_meta_data ->> 'role', '')::text, u.created_at, u.last_sign_in_at
    from auth.users u where u.email like '%@daftar.local' order by u.created_at;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_update_user(p_id uuid, p_role text, p_display text, p_password text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Only Administrator can manage users'; end if;
  if p_role not in ('admin', 'editor', 'viewer', 'entry', 'driver') then raise exception 'Unknown access level'; end if;
  if p_id = auth.uid() and p_role <> 'admin' then raise exception 'You cannot remove your own Administrator access'; end if;
  if p_password is not null and length(p_password) < 4 then raise exception 'Password must be at least 4 characters'; end if;
  update auth.users set
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', coalesce(nullif(trim(p_display), ''), split_part(email, '@', 1))),
    encrypted_password = case when p_password is not null then extensions.crypt(p_password, extensions.gen_salt('bf')) else encrypted_password end,
    updated_at = now()
  where id = p_id and email like '%@daftar.local';
  if not found then raise exception 'User not found'; end if;
  if p_id <> auth.uid() then
    delete from auth.sessions where user_id = p_id;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.allowance_link_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_salary_allowance(old.allowance_salary_id);
    return old;
  end if;
  if tg_op = 'UPDATE' and (old.allowance_salary_id is distinct from new.allowance_salary_id
      or old.driver_allowance is distinct from new.driver_allowance or old.entry_date is distinct from new.entry_date) then
    perform public.recompute_salary_allowance(old.allowance_salary_id);
    perform public.recompute_salary_allowance(new.allowance_salary_id);
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.allowance_link_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_sal uuid; v_now date := date_trunc('month', (now() at time zone 'Asia/Muscat'))::date;
begin
  if coalesce(new.allowance_status,'') = 'Paid' and coalesce(old.allowance_status,'') <> 'Paid' and new.allowance_salary_id is null
     and coalesce(new.driver_allowance,0) <> 0 then
    select id into v_sal from public.transport_salaries
      where driver_id = new.driver_id and month = v_now and date_trunc('month', new.entry_date)::date <= v_now;
    new.allowance_salary_id := v_sal;
  elsif coalesce(new.allowance_status,'') <> 'Paid' and coalesce(old.allowance_status,'') = 'Paid' then
    new.allowance_salary_id := null;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.app_role()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$function$
;
CREATE OR REPLACE FUNCTION public.audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_old jsonb; v_new jsonb; v_changed text[]; v_id text; v_email text;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed
      from jsonb_object_keys(v_new) k
     where k not in ('updated_at') and (v_old -> k) is distinct from (v_new -> k);
    if v_changed is null then return null; end if;
  end if;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key');
  v_email := coalesce(auth.jwt() ->> 'email', '');
  insert into public.audit_log(user_id, username, role, table_name, action, row_id, changed, old_data, new_data)
  values (auth.uid(),
          case when auth.uid() is null then 'Share link / system' else split_part(v_email, '@', 1) end,
          coalesce(auth.jwt() -> 'app_metadata' ->> 'role', ''),
          tg_table_name, tg_op, v_id, v_changed, v_old, v_new);
  return null;
end $function$
;
CREATE OR REPLACE FUNCTION public.can_read()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select public.app_role() in ('admin', 'editor', 'viewer', 'entry');
$function$
;
CREATE OR REPLACE FUNCTION public.can_write()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select public.app_role() in ('admin', 'editor');
$function$
;
CREATE OR REPLACE FUNCTION public.chat_can(p_room uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.chat_rooms r where r.id = p_room and (
      (r.kind = 'dm' and exists (select 1 from public.chat_members m where m.room_id = r.id and m.user_id = auth.uid()))
      or (r.kind = 'group' and public.chat_in_company(r.company))
    )
  );
$function$
;
CREATE OR REPLACE FUNCTION public.chat_can_see(p_other uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare mine text[]; theirs text[];
begin
  if auth.uid() is null then return false; end if;
  if p_other = auth.uid() or public.is_admin() then return true; end if;
  if exists (select 1 from auth.users u where u.id = p_other and u.raw_app_meta_data->>'role' = 'admin') then return true; end if;
  mine := public.chat_user_companies(auth.uid());
  theirs := public.chat_user_companies(p_other);
  return '*' = any(mine) or '*' = any(theirs) or mine && theirs;
end $function$
;
CREATE OR REPLACE FUNCTION public.chat_dm(p_other uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r uuid;
begin
  if auth.uid() is null or p_other is null or p_other = auth.uid() then raise exception 'Choose someone else'; end if;
  if not public.chat_can_see(p_other) then raise exception 'This person is not in your company'; end if;
  select m1.room_id into r from public.chat_members m1 join public.chat_members m2 on m2.room_id = m1.room_id
    join public.chat_rooms cr on cr.id = m1.room_id and cr.kind = 'dm'
    where m1.user_id = auth.uid() and m2.user_id = p_other limit 1;
  if r is null then
    insert into public.chat_rooms (kind) values ('dm') returning id into r;
    insert into public.chat_members (room_id, user_id) values (r, auth.uid()), (r, p_other);
  end if;
  return r;
end $function$
;
CREATE OR REPLACE FUNCTION public.chat_group(p_company text, p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r uuid;
begin
  if not public.chat_in_company(p_company) then raise exception 'No access to this company'; end if;
  select id into r from public.chat_rooms where kind = 'group' and company = p_company;
  if r is null then insert into public.chat_rooms (kind, company, name) values ('group', p_company, p_name) returning id into r; end if;
  return r;
end $function$
;
CREATE OR REPLACE FUNCTION public.chat_in_company(p_company text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin() or public.has_company(p_company)
    or exists (select 1 from public.transport_drivers d where d.user_id = auth.uid() and d.company = p_company and d.archived_at is null)
    or exists (select 1 from public.exp_staff s where s.user_id = auth.uid() and s.company = p_company and s.archived_at is null);
$function$
;
CREATE OR REPLACE FUNCTION public.chat_people()
 RETURNS TABLE(id uuid, username text, name text, role text, company text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select u.id, split_part(u.email, '@', 1)::text, coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))::text,
         coalesce(u.raw_app_meta_data->>'role', 'viewer')::text,
         coalesce((select d.company from public.transport_drivers d where d.user_id = u.id and d.archived_at is null limit 1),
                  (select s.company from public.exp_staff s where s.user_id = u.id and s.archived_at is null limit 1),
                  (select a.company from public.company_access a where a.user_id = u.id and a.company <> '*' limit 1))::text
  from auth.users u where auth.uid() is not null and public.chat_can_see(u.id) order by 3;
$function$
;
CREATE OR REPLACE FUNCTION public.chat_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin update public.chat_rooms set last_at = new.created_at where id = new.room_id; return new; end $function$
;
CREATE OR REPLACE FUNCTION public.chat_unread()
 RETURNS TABLE(room_id uuid, unread bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.room_id, count(*) from public.chat_messages m
  where public.chat_can(m.room_id) and m.user_id <> auth.uid()
    and m.created_at > coalesce((select cm.last_read_at from public.chat_members cm where cm.room_id = m.room_id and cm.user_id = auth.uid()), now() - interval '30 days')
  group by m.room_id;
$function$
;
CREATE OR REPLACE FUNCTION public.chat_user_companies(p_user uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(distinct c), '{}'::text[]) from (
    select a.company c from public.company_access a where a.user_id = p_user
    union select d.company from public.transport_drivers d where d.user_id = p_user and d.archived_at is null
    union select s.company from public.exp_staff s where s.user_id = p_user and s.archived_at is null
  ) x where c is not null;
$function$
;
CREATE OR REPLACE FUNCTION public.co_acc(p_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select company from acc_accounts where id = p_id $function$
;
CREATE OR REPLACE FUNCTION public.co_bill_acc(p_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select company from bill_accounts where id = p_id $function$
;
CREATE OR REPLACE FUNCTION public.co_cat(p_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select company from categories where id = p_id $function$
;
CREATE OR REPLACE FUNCTION public.co_item(p_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select c.company from items i join categories c on c.id = i.category_id where i.id = p_id $function$
;
CREATE OR REPLACE FUNCTION public.co_person(p_kind text, p_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select case when p_kind = 'staff' then (select company from exp_staff where id = p_id) else 'al-noor' end $function$
;
