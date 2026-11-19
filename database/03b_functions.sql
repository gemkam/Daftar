-- Part 3b of 7: functions (second half)
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.driver_add_file(p_id uuid, p_kind text, p_file jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb;
begin
  if public.app_role() not in ('driver', 'entry', 'admin', 'editor') then raise exception 'Not allowed'; end if;
  if p_kind !~ '^[a-z_]{2,30}$' then raise exception 'Bad field'; end if;
  if public.driver_too_old(p_id) then raise exception 'This trip is older than 4 days. Ask the office to change papers.'; end if;
  if public.app_role() = 'driver' and exists (select 1 from transport_entries where id = p_id and trip_completed) then
    raise exception 'This trip is completed. Ask the office to add papers.';
  end if;
  update transport_entries set attachments = jsonb_set(coalesce(attachments, '{}'::jsonb), array[p_kind],
      coalesce(attachments -> p_kind, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object('path', p_file ->> 'path', 'name', left(p_file ->> 'name', 150), 'size', p_file -> 'size',
          'type', left(coalesce(p_file ->> 'type', ''), 80), 'at', now(), 'by', public.entry_user_name())))
   where id = p_id returning attachments into v;
  if not found then raise exception 'Trip not found'; end if;
  return v;
end $function$
;
CREATE OR REPLACE FUNCTION public.driver_file_action(p_id uuid, p_kind text, p_path text, p_action text, p_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb; arr jsonb; out_arr jsonb := '[]'::jsonb; f jsonb;
begin
  if public.app_role() not in ('driver', 'entry', 'admin', 'editor') then raise exception 'Not allowed'; end if;
  if (p_action = 'purge' and public.app_role() not in ('admin', 'editor')) or (p_action = 'restore' and public.app_role() not in ('admin', 'editor', 'entry')) then raise exception 'Only the office can do this'; end if;
  if public.driver_too_old(p_id) then raise exception 'This trip is older than 4 days. Ask the office to change papers.'; end if;
  if public.app_role() = 'driver' and exists (select 1 from transport_entries where id = p_id and trip_completed) then
    raise exception 'This trip is completed. Ask the office to change papers.';
  end if;
  select coalesce(attachments -> p_kind, '[]'::jsonb) into arr from transport_entries where id = p_id;
  if arr is null then raise exception 'Trip not found'; end if;
  for f in select * from jsonb_array_elements(arr) loop
    if f ->> 'path' = p_path then
      if p_action = 'delete' then f := f || jsonb_build_object('deleted_at', now(), 'deleted_by', public.entry_user_name());
      elsif p_action = 'restore' then f := f - 'deleted_at' - 'deleted_by';
      elsif p_action = 'rename' and length(trim(coalesce(p_name, ''))) > 0 then f := f || jsonb_build_object('name', left(trim(p_name), 150), 'renamed_by', public.entry_user_name());
      elsif p_action = 'purge' then continue;
      end if;
    end if;
    out_arr := out_arr || jsonb_build_array(f);
  end loop;
  update transport_entries set attachments = jsonb_set(coalesce(attachments, '{}'::jsonb), array[p_kind], out_arr) where id = p_id returning attachments into v;
  return v;
end $function$
;
CREATE OR REPLACE FUNCTION public.driver_save_trip(p_id uuid, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid := p_id;
  k text;
  n numeric;
  v_driver uuid := nullif(p_data ->> 'driver_id', '')::uuid;
begin
  if public.app_role() not in ('driver', 'entry', 'admin', 'editor') then raise exception 'Not allowed'; end if;
  foreach k in array array['rent','driver_allowance','diesel','toll','gate_pass','exit_fee','empty_border_fee','container_wash','vehicle_wash'] loop
    n := coalesce(nullif(p_data ->> k, '')::numeric, 0);
    if n < 0 or n > 100000 then raise exception 'Check the amount in %', replace(k, '_', ' '); end if;
  end loop;
  if public.app_role() = 'driver' and nullif(p_data ->> 'entry_date', '')::date < (now() at time zone 'Asia/Muscat')::date - 4 then
    raise exception 'Drivers can only enter trips from the last 4 days. Ask the office.';
  end if;
  if v_id is not null and public.driver_too_old(v_id) then raise exception 'This trip is older than 4 days. Ask the office to change it.'; end if;
  if v_id is null then
    if v_driver is null or not exists (select 1 from transport_drivers where id = v_driver) then raise exception 'Choose the driver.'; end if;
    insert into transport_entries (driver_id, entry_date, from_place, to_place, rent, driver_allowance, allowance_status, diesel, toll,
      gate_pass, exit_fee, empty_border_fee, container_wash, vehicle_wash, entered_by, sort)
    values (v_driver, coalesce(nullif(p_data ->> 'entry_date', '')::date, (now() at time zone 'Asia/Muscat')::date),
      left(nullif(trim(p_data ->> 'from_place'), ''), 120), left(nullif(trim(p_data ->> 'to_place'), ''), 120),
      coalesce(nullif(p_data ->> 'rent', '')::numeric, 0), coalesce(nullif(p_data ->> 'driver_allowance', '')::numeric, 0), 'Not paid',
      coalesce(nullif(p_data ->> 'diesel', '')::numeric, 0), coalesce(nullif(p_data ->> 'toll', '')::numeric, 0),
      coalesce(nullif(p_data ->> 'gate_pass', '')::numeric, 0), coalesce(nullif(p_data ->> 'exit_fee', '')::numeric, 0),
      coalesce(nullif(p_data ->> 'empty_border_fee', '')::numeric, 0), coalesce(nullif(p_data ->> 'container_wash', '')::numeric, 0),
      coalesce(nullif(p_data ->> 'vehicle_wash', '')::numeric, 0), left(public.entry_user_name(), 80), extract(epoch from now())::int)
    returning id into v_id;
  else
    if public.app_role() = 'driver' and exists (select 1 from transport_entries where id = v_id and trip_completed) then
      raise exception 'This trip is completed. Ask the office to change it.';
    end if;
    update transport_entries set
      entry_date = coalesce(nullif(p_data ->> 'entry_date', '')::date, entry_date),
      from_place = left(nullif(trim(p_data ->> 'from_place'), ''), 120), to_place = left(nullif(trim(p_data ->> 'to_place'), ''), 120),
      rent = coalesce(nullif(p_data ->> 'rent', '')::numeric, 0), driver_allowance = coalesce(nullif(p_data ->> 'driver_allowance', '')::numeric, 0),
      diesel = coalesce(nullif(p_data ->> 'diesel', '')::numeric, 0), toll = coalesce(nullif(p_data ->> 'toll', '')::numeric, 0),
      gate_pass = coalesce(nullif(p_data ->> 'gate_pass', '')::numeric, 0), exit_fee = coalesce(nullif(p_data ->> 'exit_fee', '')::numeric, 0),
      empty_border_fee = coalesce(nullif(p_data ->> 'empty_border_fee', '')::numeric, 0),
      container_wash = coalesce(nullif(p_data ->> 'container_wash', '')::numeric, 0), vehicle_wash = coalesce(nullif(p_data ->> 'vehicle_wash', '')::numeric, 0)
    where id = v_id;
    if not found then raise exception 'Trip not found'; end if;
  end if;
  return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.driver_too_old(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.app_role() = 'driver' and exists (select 1 from transport_entries where id = p_id and created_at < now() - interval '4 days');
$function$
;
CREATE OR REPLACE FUNCTION public.driver_trip_counts(p_driver uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case when public.app_role() in ('driver', 'entry', 'admin', 'editor', 'viewer') then jsonb_build_object(
    'completed', count(*) filter (where trip_completed),
    'this_month', count(*) filter (where trip_completed and date_trunc('month', completed_at at time zone 'Asia/Muscat') = date_trunc('month', now() at time zone 'Asia/Muscat')),
    'open', count(*) filter (where not trip_completed)) end
  from transport_entries where driver_id = p_driver;
$function$
;
CREATE OR REPLACE FUNCTION public.entry_user_name()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'display_name', split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), 'driver');
$function$
;
CREATE OR REPLACE FUNCTION public.guard_bill_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if old.kind = 'receipt' and coalesce(old.approval->>'status','') = 'approved' then
    raise exception 'Bill % is approved by the chairman. Ask the chairman to undo the approval before deleting it.', coalesce(old.doc_no,'');
  end if;
  return old;
end $function$
;
-- NOTE: the usernames hamad, khalid and salim are fixed in this function (bill verifier and chairmen).
-- For a demo, create users with these usernames, or change the names below.
CREATE OR REPLACE FUNCTION public.guard_bill_verify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare skip text[] := array['approval','verify','ai_check','updated_at'];
  v_email text := coalesce(auth.jwt()->>'email', '');
begin
  if tg_op = 'UPDATE' and old.kind = 'receipt' and coalesce(old.approval->>'status','') = 'approved'
     and (to_jsonb(new) - skip) is distinct from (to_jsonb(old) - skip) then
    raise exception 'Bill % is approved by the chairman. Ask the chairman to undo the approval before changing it.', coalesce(old.doc_no,'');
  end if;

  if (tg_op = 'INSERT' and new.verify is not null) or (tg_op = 'UPDATE' and new.verify is distinct from old.verify) then
    if not (public.is_admin() or (v_email = 'hamad@daftar.local' and new.company = 'sahil') or auth.uid() is null) then
      raise exception 'You can not verify bills of this company.' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and old.approval is not null and new.approval is not distinct from old.approval then
      raise exception 'Bill % was already % by the chairman. Ask the chairman to undo first.', coalesce(old.doc_no,''),
        case when old.approval->>'status' = 'approved' then 'approved' else 'rejected' end;
    end if;
  end if;

  if (tg_op = 'INSERT' and new.approval is not null) or (tg_op = 'UPDATE' and new.approval is distinct from old.approval) then
    if not (v_email = 'khalid@daftar.local' or auth.uid() is null
            or (v_email = 'salim@daftar.local' and exists (select 1 from public.company_access a where a.user_id = auth.uid() and a.company in (new.company, '*')))) then
      raise exception 'Only the chairman of this company can approve its bills.' using errcode = '42501';
    end if;
    if new.approval is not null and coalesce(new.verify->>'status','') <> 'verified' then
      raise exception 'Bill % must be verified before the chairman can approve or reject it.', coalesce(new.doc_no,'');
    end if;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.has_company(p_company text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin() or exists (select 1 from public.company_access a where a.user_id = auth.uid() and a.company in (p_company, '*'))
$function$
;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$function$
;
CREATE OR REPLACE FUNCTION public.power_tables()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when public.is_admin() then coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', t.table_name,
      'pk', (select jsonb_agg(k.column_name order by k.ordinal_position) from information_schema.table_constraints tc
              join information_schema.key_column_usage k on k.constraint_name = tc.constraint_name and k.table_schema = tc.table_schema
              where tc.table_schema = 'public' and tc.table_name = t.table_name and tc.constraint_type = 'PRIMARY KEY'),
      'cols', (select jsonb_agg(jsonb_build_object('name', c.column_name, 'type', c.data_type, 'null', c.is_nullable = 'YES', 'def', c.column_default is not null) order by c.ordinal_position)
               from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.table_name)
    ) order by t.table_name)
    from information_schema.tables t
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and t.table_name not in ('audit_log', 'user_events', 'user_sessions', 'alert_dismissals', 'slip_push_subs')
  ), '[]'::jsonb) else '[]'::jsonb end
$function$
;
CREATE OR REPLACE FUNCTION public.public_add_entry(p_token text, p_entry jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.entry_links;
  v_driver uuid;
  n numeric;
  k text;
begin
  select * into l from public.entry_links where token = p_token and active;
  if not found then raise exception 'This link is not active any more. Ask the office for a new link.'; end if;
  v_driver := coalesce(l.driver_id, nullif(p_entry ->> 'driver_id', '')::uuid);
  if v_driver is null or not exists (select 1 from public.transport_drivers where id = v_driver) then raise exception 'Choose the driver.'; end if;
  if nullif(p_entry ->> 'entry_date', '') is null then raise exception 'Choose the date.'; end if;
  if length(trim(coalesce(p_entry ->> 'entered_by', ''))) < 2 then raise exception 'Write your name.'; end if;
  foreach k in array array['rent','received','driver_allowance','diesel','toll','maintenance'] loop
    n := coalesce(nullif(p_entry ->> k, '')::numeric, 0);
    if n < 0 or n > 100000 then raise exception 'Check the amount in %', k; end if;
  end loop;

  insert into public.transport_entries (driver_id, entry_date, from_place, to_place, rent, received, payment_status,
    driver_allowance, allowance_status, diesel, toll, maintenance, description, cargo, consignee, remarks, credit_in, entered_by, sort)
  values (v_driver, (p_entry ->> 'entry_date')::date,
    left(nullif(trim(p_entry ->> 'from_place'), ''), 120), left(nullif(trim(p_entry ->> 'to_place'), ''), 120),
    coalesce(nullif(p_entry ->> 'rent', '')::numeric, 0), coalesce(nullif(p_entry ->> 'received', '')::numeric, 0),
    left(nullif(p_entry ->> 'payment_status', ''), 40),
    coalesce(nullif(p_entry ->> 'driver_allowance', '')::numeric, 0), left(nullif(p_entry ->> 'allowance_status', ''), 40),
    coalesce(nullif(p_entry ->> 'diesel', '')::numeric, 0), coalesce(nullif(p_entry ->> 'toll', '')::numeric, 0),
    coalesce(nullif(p_entry ->> 'maintenance', '')::numeric, 0),
    left(nullif(trim(p_entry ->> 'description'), ''), 300), left(nullif(trim(p_entry ->> 'cargo'), ''), 200),
    left(nullif(trim(p_entry ->> 'consignee'), ''), 200), left(nullif(p_entry ->> 'remarks', ''), 40),
    left(nullif(trim(p_entry ->> 'credit_in'), ''), 120), left(trim(p_entry ->> 'entered_by'), 80),
    extract(epoch from now())::int);

  update public.entry_links set uses = uses + 1, last_used_at = now() where id = l.id;
end $function$
;
CREATE OR REPLACE FUNCTION public.public_entry_info(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l public.entry_links; v_user text;
begin
  select * into l from public.entry_links where token = p_token and active;
  if not found then return null; end if;
  -- a link made for one driver who now has his own login: give his username, so the page can open his own app link /d/<username>
  if l.driver_id is not null then
    select split_part(u.email, '@', 1) into v_user from public.transport_drivers d join auth.users u on u.id = d.user_id
     where d.id = l.driver_id and u.raw_app_meta_data ->> 'role' = 'driver' limit 1;
  end if;
  return jsonb_build_object(
    'label', l.label,
    'driver_id', l.driver_id,
    'username', v_user,
    'drivers', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'vehicle_no', d.vehicle_no) order by d.sort, d.name)
                         from public.transport_drivers d where l.driver_id is null or d.id = l.driver_id), '[]'::jsonb)
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.public_invoice(p_uuid text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object('company', company, 'doc_no', doc_no, 'doc_date', doc_date, 'party', party, 'party_details', party_details,
    'party_vat', party_vat, 'items', items, 'vat_pct', vat_pct, 'notes', notes, 'signatory', signatory, 'einv', einv,
    'discount', discount, 'lh', lh, 'signs', signs)
  from company_docs
  where kind = 'invoice' and length(coalesce(p_uuid, '')) >= 32 and einv->>'uuid' = p_uuid
  limit 1
$function$
;
CREATE OR REPLACE FUNCTION public.public_save_push(p_token text, p_sub jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.slip_token_ok(p_token) then return false; end if;
  insert into public.slip_push_subs (endpoint, token, sub) values (p_sub->>'endpoint', p_token, p_sub)
  on conflict (endpoint) do update set token = excluded.token, sub = excluded.sub, created_at = now();
  return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.public_staff_slip(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.exp_staff; d public.transport_drivers; kind text; pid uuid; base jsonb;
begin
  select * into s from public.exp_staff where slip_token::text = p_token and slip_link_on and active is not false limit 1;
  if found then
    kind := 'staff'; pid := s.id;
    base := jsonb_build_object('kind', coalesce(s.staff_type, 'Office'), 'name', s.name, 'company', s.company,
      'designation', coalesce(nullif(s.designation, ''), s.department), 'basic', s.basic, 'allowances', s.allowances,
      'house_rent', s.house_rent, 'utilities', s.utilities, 'transport', s.transport_allow,
      'files', coalesce(s.files -> 'slip', '[]'::jsonb));
  else
    select * into d from public.transport_drivers where slip_token::text = p_token and slip_link_on limit 1;
    if not found then return null; end if;
    kind := 'driver'; pid := d.id;
    base := jsonb_build_object('kind', 'Driver', 'name', d.name, 'company', d.company, 'designation', 'Driver',
      'basic', d.salary, 'allowances', d.allowances, 'house_rent', d.house_rent, 'utilities', d.utilities,
      'files', coalesce(d.files -> 'slip', '[]'::jsonb));
  end if;
  return base || jsonb_build_object('slips', coalesce((
    select jsonb_agg(to_jsonb(x) - 'history' - 'generated_by' - 'approved_by' order by x.month desc)
    from public.salary_slips x where x.person_kind = kind and x.person_id = pid and x.status = 'approved'), '[]'::jsonb));
end $function$
;
CREATE OR REPLACE FUNCTION public.push_private_key(p_key text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  select value from private.app_secrets where name = 'vapid_private'
    and p_key is not null and p_key = (select value from private.app_secrets where name = 'report_key');
$function$
;
CREATE OR REPLACE FUNCTION public.recompute_salary_allowance(p_salary uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_month date;
begin
  if p_salary is null then return; end if;
  select month into v_month from public.transport_salaries where id = p_salary;
  if v_month is null then return; end if;
  update public.transport_salaries s set
    trip_allowance = coalesce((select sum(e.driver_allowance) from public.transport_entries e
      where e.allowance_salary_id = p_salary and date_trunc('month', e.entry_date)::date = v_month), 0),
    allowance_carried = coalesce((select sum(e.driver_allowance) from public.transport_entries e
      where e.allowance_salary_id = p_salary and date_trunc('month', e.entry_date)::date < v_month), 0),
    allowance_carried_note = (select string_agg(to_char(g.m, 'Mon YYYY') || ' driver allowance ' || to_char(g.amt, 'FM999990.000') || ' paid in ' || to_char(v_month, 'Mon YYYY'), '; ' order by g.m)
      from (select date_trunc('month', e.entry_date)::date m, sum(e.driver_allowance) amt
            from public.transport_entries e
            where e.allowance_salary_id = p_salary and date_trunc('month', e.entry_date)::date < v_month
            group by 1) g)
  where s.id = p_salary;
end $function$
;
CREATE OR REPLACE FUNCTION public.record_move(p_item uuid, p_type text, p_qty numeric, p_note text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  new_qty numeric;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be more than 0';
  end if;

  if p_type = 'in' then
    update items set quantity = quantity + p_qty where id = p_item returning quantity into new_qty;
    if new_qty is null then raise exception 'Item not found'; end if;
  elsif p_type = 'out' then
    update items set quantity = quantity - p_qty where id = p_item and quantity >= p_qty returning quantity into new_qty;
    if new_qty is null then raise exception 'Not enough stock for this quantity'; end if;
  else
    raise exception 'Type must be in or out';
  end if;

  insert into stock_moves (item_id, move_type, qty, note) values (p_item, p_type, p_qty, nullif(trim(p_note), ''));
  return new_qty;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.report_group_data(p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_key is null or not exists (select 1 from private.app_secrets where name = 'report_key' and value = p_key) then
    raise exception 'not allowed';
  end if;
  return jsonb_build_object(
    'exp', coalesce((select jsonb_agg(to_jsonb(e)) from public.exp_entries e), '[]'::jsonb),
    'budgets', coalesce((select jsonb_agg(to_jsonb(b)) from public.exp_budgets b), '[]'::jsonb)
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.report_transport_data(p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_key is null or not exists (select 1 from private.app_secrets where name = 'report_key' and value = p_key) then
    raise exception 'not allowed';
  end if;
  return jsonb_build_object(
    'drivers', coalesce((select jsonb_agg(to_jsonb(d) order by d.sort, d.name) from public.transport_drivers d), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(to_jsonb(e) order by e.entry_date, e.sort, e.created_at) from public.transport_entries e), '[]'::jsonb),
    'salaries', coalesce((select jsonb_agg(to_jsonb(s) order by s.month) from public.transport_salaries s), '[]'::jsonb),
    'extras', coalesce((select jsonb_agg(to_jsonb(x) order by x.month) from public.transport_extras x), '[]'::jsonb)
  );
end $function$
;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.set_quantity(p_item uuid, p_qty numeric, p_note text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  old_qty numeric;
  diff numeric;
begin
  if p_qty is null or p_qty < 0 then
    raise exception 'Quantity cannot be less than 0';
  end if;
  select quantity into old_qty from items where id = p_item for update;
  if old_qty is null then raise exception 'Item not found'; end if;
  diff := p_qty - old_qty;
  if diff = 0 then return p_qty; end if;
  update items set quantity = p_qty where id = p_item;
  if not found then raise exception 'Only Administrator can change stock'; end if;
  insert into stock_moves (item_id, move_type, qty, note)
  values (p_item, case when diff > 0 then 'in' else 'out' end, abs(diff), coalesce(nullif(trim(p_note), ''), 'Adjusted in sheet'));
  return p_qty;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_received_date()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if coalesce(new.received, 0) <= 0 then
    new.received_date := null;
  elsif new.received_date is null
     or (tg_op = 'UPDATE' and new.received is distinct from old.received and new.received_date is not distinct from old.received_date) then
    new.received_date := (now() at time zone 'Asia/Muscat')::date;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.slip_token_ok(p text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.exp_staff where slip_token::text = p and slip_link_on and active is not false and archived_at is null)
      or exists (select 1 from public.transport_drivers where slip_token::text = p and slip_link_on and archived_at is null);
$function$
;
CREATE OR REPLACE FUNCTION public.sync_transport_exp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_drv text; v_trip text; v_amt numeric; v_veh text; v_tot numeric; v_paid numeric;
begin
  if tg_op in ('UPDATE','DELETE') then
    delete from public.exp_entries where source = tg_table_name and source_id = old.id;
  end if;
  if tg_op = 'DELETE' then return old; end if;

  if tg_table_name = 'transport_entries' then
    select name into v_drv from public.transport_drivers where id = new.driver_id;
    v_trip := coalesce(nullif(concat_ws(' to ', nullif(new.from_place,''), nullif(new.to_place,'')),''), new.description, 'Trip');
    if coalesce(new.diesel,0) <> 0 then
      insert into public.exp_entries(company, department, entry_date, description, category, head, paid, account, entered_by, source, source_id, source_kind, sort)
      values ('al-noor','Transport', new.entry_date, concat_ws(' · ', 'Diesel', v_drv, v_trip), 'Diesel', 'Vehicle Running and Maintenance', new.diesel, 'P & L', 'Auto from Transport', tg_table_name, new.id, 'trip', 0);
    end if;
    if coalesce(new.toll,0) <> 0 then
      insert into public.exp_entries(company, department, entry_date, description, category, head, paid, account, entered_by, source, source_id, source_kind, sort)
      values ('al-noor','Transport', new.entry_date, concat_ws(' · ', 'Toll / other', v_drv, v_trip), 'Toll', 'Vehicle Running and Maintenance', new.toll, 'P & L', 'Auto from Transport', tg_table_name, new.id, 'trip', 0);
    end if;
    if coalesce(new.maintenance,0) <> 0 then
      insert into public.exp_entries(company, department, entry_date, description, category, head, paid, account, entered_by, source, source_id, source_kind, sort)
      values ('al-noor','Transport', new.entry_date, concat_ws(' · ', 'Maintenance', v_drv, coalesce(nullif(new.description,''), v_trip)), 'Car service', 'Vehicle Running and Maintenance', new.maintenance, 'P & L', 'Auto from Transport', tg_table_name, new.id, 'trip', 0);
    end if;

  elsif tg_table_name = 'transport_salaries' then
    select name into v_drv from public.transport_drivers where id = new.driver_id;
    v_amt := coalesce(new.basic,0)+coalesce(new.room_rent,0)+coalesce(new.utilities,0)+coalesce(new.mobile,0)+coalesce(new.travel_food,0)+coalesce(new.trip_allowance,0)
             + coalesce(new.allowance_carried,0) - coalesce(new.advance_deduction,0) + coalesce(new.special_allowance,0);
    if v_amt <> 0 then
      v_paid := case when v_amt > 0 then greatest(0, least(v_amt, coalesce(new.paid_amount,0))) else v_amt end;
      insert into public.exp_entries(company, department, entry_date, description, category, head, paid, unpaid, account, entered_by, source, source_id, source_kind, sort)
      values ('al-noor','Transport', new.month, concat_ws(' · ', 'Driver salary', v_drv), 'Salary', 'Salary', v_paid, nullif(v_amt - v_paid, 0), 'P & L', 'Auto from Transport', tg_table_name, new.id, 'salary', 0);
    end if;

  elsif tg_table_name = 'transport_extras' then
    select name into v_drv from public.transport_drivers where id = new.driver_id;
    if coalesce(new.amount,0) <> 0 then
      insert into public.exp_entries(company, department, entry_date, description, category, head, paid, account, entered_by, source, source_id, source_kind, sort)
      values ('al-noor','Transport', new.month, concat_ws(' · ', coalesce(nullif(new.description,''),'Other transport cost'), v_drv), 'Misc', 'Vehicle Running and Maintenance', new.amount, 'P & L', 'Auto from Transport', tg_table_name, new.id, 'extra', 0);
    end if;

  elsif tg_table_name = 'vehicle_maintenance' then
    select concat_ws(' ', name, nullif(plate_no,'')) into v_veh from public.transport_vehicles where id = new.vehicle_id;
    if coalesce(new.amount,0) <> 0 then
      insert into public.exp_entries(company, department, entry_date, description, category, head, paid, unpaid, account, entered_by, source, source_id, source_kind, notes, sort)
      values ('al-noor','Transport', coalesce(new.work_date, (now() at time zone 'Asia/Muscat')::date),
        concat_ws(' · ', coalesce(nullif(new.work,''),'Maintenance'), v_veh, nullif(new.paid_to,'')), 'Car service', 'Vehicle Running and Maintenance',
        case when new.status = 'Paid' then new.amount else 0 end, case when new.status = 'Paid' then null else new.amount end,
        'P & L', 'Auto from Transport', tg_table_name, new.id, 'maint', new.payment_method, 0);
    end if;

  elsif tg_table_name = 'company_docs' then
    if new.kind = 'receipt' and coalesce(new.verify->>'status','') <> 'rejected' and coalesce(new.approval->>'status','') <> 'rejected' then
      if coalesce(new.scan->>'fixed','') = 'true' then
        v_tot := case when coalesce(new.scan->>'amount','') ~ '^-?[0-9]+(\.[0-9]+)?$' then (new.scan->>'amount')::numeric else 0 end;
        v_amt := case when coalesce(new.scan->>'vat_amount','') ~ '^-?[0-9]+(\.[0-9]+)?$' then (new.scan->>'vat_amount')::numeric else 0 end;
        v_tot := v_tot - v_amt;
      else
        select coalesce(sum((i->>'amount')::numeric),0) into v_tot from jsonb_array_elements(new.items) i where (i->>'amount') ~ '^-?[0-9]+(\.[0-9]+)?$';
        v_amt := round(v_tot * coalesce(new.vat_pct,0) / 100, 3);
      end if;
      if v_tot + v_amt <> 0 then
        insert into public.exp_entries(company, department, entry_date, bill_no, description, category, head, paid, vat, vat_reg_no, vehicle_no, account, entered_by, source, source_id, source_kind, notes, sort)
        values (new.company, new.department, new.doc_date, new.doc_no,
          concat_ws(' · ', coalesce(nullif(new.party,''),'Payment'), (select string_agg(i->>'desc', ', ') from jsonb_array_elements(new.items) i where coalesce(i->>'desc','') <> '')),
          coalesce(new.category,''), coalesce(nullif(new.head,''),'Office Expenses'), v_tot + v_amt, nullif(v_amt,0),
          coalesce(nullif(new.scan->>'vat_no',''), nullif(new.party_vat,'')),
          nullif(new.scan->>'vehicle_no',''),
          'P & L', coalesce(new.created_by,'Payment receipt'),
          tg_table_name, new.id, 'receipt', new.payment_method, 0);
      end if;
    end if;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.trip_complete(p_id uuid, p_done boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.app_role() not in ('driver', 'entry', 'admin', 'editor') then raise exception 'Not allowed'; end if;
  if not p_done and public.app_role() not in ('admin', 'editor', 'entry') then raise exception 'Only the office can open a completed trip again'; end if;
  if public.driver_too_old(p_id) then raise exception 'This trip is older than 4 days. Ask the office to close it.'; end if;
  update transport_entries set trip_completed = p_done,
    completed_at = case when p_done then now() else null end,
    completed_by = case when p_done then public.entry_user_name() else null end,
    completed_role = case when p_done then case when public.app_role() = 'driver' then 'driver' else 'office' end else null end,
    remarks = case when p_done then 'Completed' else remarks end
   where id = p_id;
  if not found then raise exception 'Trip not found'; end if;
end $function$
;
