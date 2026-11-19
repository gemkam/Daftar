-- Part 5b of 7: row level security, second half (includes file storage rules)

create policy personnel_co_read on public.personnel_companies as PERMISSIVE for SELECT to public
  using (can_read());
create policy personnel_co_write on public.personnel_companies as PERMISSIVE for ALL to public
  using (can_write())
  with check (can_write());
create policy personnel_sub_read on public.personnel_subcontractors as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(company)));
create policy personnel_sub_write on public.personnel_subcontractors as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy "data entry add" on public.petty_cash as PERMISSIVE for INSERT to public
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "data entry change" on public.petty_cash as PERMISSIVE for UPDATE to public
  using (((app_role() = 'entry'::text) AND has_company(company)))
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "read petty" on public.petty_cash as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(company)));
create policy "write petty" on public.petty_cash as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy salary_credits_read on public.salary_credits as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(co_person(person_kind, person_id))));
create policy salary_credits_write on public.salary_credits as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(co_person(person_kind, person_id))))
  with check ((can_write() AND has_company(co_person(person_kind, person_id))));
create policy salary_slips_read on public.salary_slips as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(company)));
create policy salary_slips_write on public.salary_slips as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy slip_push_del on public.slip_push_subs as PERMISSIVE for DELETE to public
  using (can_write());
create policy slip_push_read on public.slip_push_subs as PERMISSIVE for SELECT to public
  using (can_write());
create policy "data entry add" on public.stock_moves as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company(co_item(item_id))));
create policy "data entry change" on public.stock_moves as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company(co_item(item_id))))
  with check (((app_role() = 'entry'::text) AND has_company(co_item(item_id))));
create policy read on public.stock_moves as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company(co_item(item_id))));
create policy "write delete" on public.stock_moves as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company(co_item(item_id))));
create policy "write insert" on public.stock_moves as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company(co_item(item_id))));
create policy "write update" on public.stock_moves as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company(co_item(item_id))))
  with check ((can_write() AND has_company(co_item(item_id))));
create policy "data entry add" on public.transport_drivers as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "data entry change" on public.transport_drivers as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company('al-noor'::text)))
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "entry read drivers" on public.transport_drivers as PERMISSIVE for SELECT to authenticated
  using ((app_role() = 'driver'::text));
create policy read on public.transport_drivers as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company('al-noor'::text)));
create policy "write delete" on public.transport_drivers as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company('al-noor'::text)));
create policy "write insert" on public.transport_drivers as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "write update" on public.transport_drivers as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company('al-noor'::text)))
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "data entry add" on public.transport_entries as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "data entry change" on public.transport_entries as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company('al-noor'::text)))
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "entry insert rows" on public.transport_entries as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "entry read open trips" on public.transport_entries as PERMISSIVE for SELECT to authenticated
  using (((app_role() = 'driver'::text) AND (NOT trip_completed)));
create policy read on public.transport_entries as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company('al-noor'::text)));
create policy "write delete" on public.transport_entries as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company('al-noor'::text)));
create policy "write insert" on public.transport_entries as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "write update" on public.transport_entries as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company('al-noor'::text)))
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "data entry add" on public.transport_extras as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "data entry change" on public.transport_extras as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company('al-noor'::text)))
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy read on public.transport_extras as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company('al-noor'::text)));
create policy "write delete" on public.transport_extras as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company('al-noor'::text)));
create policy "write insert" on public.transport_extras as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "write update" on public.transport_extras as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company('al-noor'::text)))
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "data entry add" on public.transport_invoices as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "data entry change" on public.transport_invoices as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company('al-noor'::text)))
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy inv_delete on public.transport_invoices as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company('al-noor'::text)));
create policy inv_insert on public.transport_invoices as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company('al-noor'::text)));
create policy inv_read on public.transport_invoices as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company('al-noor'::text)));
create policy inv_update on public.transport_invoices as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company('al-noor'::text)))
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "data entry add" on public.transport_profit_taken as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "data entry change" on public.transport_profit_taken as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company('al-noor'::text)))
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy ptk_del on public.transport_profit_taken as PERMISSIVE for DELETE to public
  using ((can_write() AND has_company('al-noor'::text)));
create policy ptk_ins on public.transport_profit_taken as PERMISSIVE for INSERT to public
  with check ((can_write() AND has_company('al-noor'::text)));
create policy ptk_read on public.transport_profit_taken as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company('al-noor'::text)));
create policy ptk_upd on public.transport_profit_taken as PERMISSIVE for UPDATE to public
  using ((can_write() AND has_company('al-noor'::text)))
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "data entry add" on public.transport_salaries as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "data entry change" on public.transport_salaries as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company('al-noor'::text)))
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy read on public.transport_salaries as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company('al-noor'::text)));
create policy "write delete" on public.transport_salaries as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company('al-noor'::text)));
create policy "write insert" on public.transport_salaries as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "write update" on public.transport_salaries as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company('al-noor'::text)))
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "data entry add" on public.transport_vehicles as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "data entry change" on public.transport_vehicles as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company('al-noor'::text)))
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "read vehicles" on public.transport_vehicles as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company('al-noor'::text)));
create policy "write vehicles" on public.transport_vehicles as PERMISSIVE for ALL to public
  using ((can_write() AND has_company('al-noor'::text)))
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "user designations admin write" on public.user_designations as PERMISSIVE for ALL to public
  using (is_admin())
  with check (is_admin());
create policy "user designations read" on public.user_designations as PERMISSIVE for SELECT to public
  using ((auth.uid() IS NOT NULL));
create policy ue_admin_read on public.user_events as PERMISSIVE for SELECT to authenticated
  using (is_admin());
create policy us_admin_read on public.user_sessions as PERMISSIVE for SELECT to authenticated
  using (is_admin());
create policy "data entry add" on public.vehicle_maintenance as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "data entry change" on public.vehicle_maintenance as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company('al-noor'::text)))
  with check (((app_role() = 'entry'::text) AND has_company('al-noor'::text)));
create policy "read maintenance" on public.vehicle_maintenance as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company('al-noor'::text)));
create policy "write maintenance" on public.vehicle_maintenance as PERMISSIVE for ALL to public
  using ((can_write() AND has_company('al-noor'::text)))
  with check ((can_write() AND has_company('al-noor'::text)));

-- File storage rules
create policy "chat files add" on storage.objects as PERMISSIVE for INSERT to public
  with check (((bucket_id = 'chat-files'::text) AND public.chat_can((split_part(name, '/'::text, 1))::uuid)));
create policy "chat files read" on storage.objects as PERMISSIVE for SELECT to public
  using (((bucket_id = 'chat-files'::text) AND public.chat_can((split_part(name, '/'::text, 1))::uuid)));
create policy "doc files add" on storage.objects as PERMISSIVE for INSERT to authenticated
  with check (((bucket_id = 'doc-files'::text) AND (public.can_write() OR (public.app_role() = 'entry'::text))));
create policy "doc files change" on storage.objects as PERMISSIVE for UPDATE to authenticated
  using (((bucket_id = 'doc-files'::text) AND (public.can_write() OR (public.app_role() = 'entry'::text))));
create policy "doc files read" on storage.objects as PERMISSIVE for SELECT to authenticated
  using (((bucket_id = 'doc-files'::text) AND public.can_read()));
create policy "doc files remove" on storage.objects as PERMISSIVE for DELETE to authenticated
  using (((bucket_id = 'doc-files'::text) AND public.can_write()));
create policy "staff files add" on storage.objects as PERMISSIVE for INSERT to authenticated
  with check (((bucket_id = 'staff-files'::text) AND public.can_write()));
create policy "staff files change" on storage.objects as PERMISSIVE for UPDATE to authenticated
  using (((bucket_id = 'staff-files'::text) AND public.can_write()));
create policy "staff files read" on storage.objects as PERMISSIVE for SELECT to authenticated
  using (((bucket_id = 'staff-files'::text) AND public.can_read()));
create policy "staff files remove" on storage.objects as PERMISSIVE for DELETE to authenticated
  using (((bucket_id = 'staff-files'::text) AND public.can_write()));
create policy "staff slip by link" on storage.objects as PERMISSIVE for SELECT to anon
  using (((bucket_id = 'staff-files'::text) AND (split_part(name, '/'::text, 1) = 'slip'::text) AND public.slip_token_ok(split_part(name, '/'::text, 2))));
create policy "trip files add" on storage.objects as PERMISSIVE for INSERT to authenticated
  with check (((bucket_id = 'trip-files'::text) AND (public.can_write() OR (public.app_role() = ANY (ARRAY['entry'::text, 'driver'::text])))));
create policy "trip files read" on storage.objects as PERMISSIVE for SELECT to authenticated
  using (((bucket_id = 'trip-files'::text) AND (public.can_read() OR (public.app_role() = 'driver'::text))));
create policy "trip files remove" on storage.objects as PERMISSIVE for DELETE to authenticated
  using (((bucket_id = 'trip-files'::text) AND public.can_write()));
