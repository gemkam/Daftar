-- Part 5a of 7: row level security (who can see and change what), first half

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
alter table private.app_secrets enable row level security;

create policy "data entry add acc_accounts" on public.acc_accounts as PERMISSIVE for INSERT to public
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "data entry change acc_accounts" on public.acc_accounts as PERMISSIVE for UPDATE to public
  using (((app_role() = 'entry'::text) AND has_company(company)))
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "read acc_accounts" on public.acc_accounts as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(company)));
create policy "write acc_accounts" on public.acc_accounts as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy "data entry add acc_items" on public.acc_items as PERMISSIVE for INSERT to public
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "data entry change acc_items" on public.acc_items as PERMISSIVE for UPDATE to public
  using (((app_role() = 'entry'::text) AND has_company(company)))
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "read acc_items" on public.acc_items as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(company)));
create policy "write acc_items" on public.acc_items as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy "data entry add acc_txns" on public.acc_txns as PERMISSIVE for INSERT to public
  with check (((app_role() = 'entry'::text) AND has_company(co_acc(account_id))));
create policy "data entry change acc_txns" on public.acc_txns as PERMISSIVE for UPDATE to public
  using (((app_role() = 'entry'::text) AND has_company(co_acc(account_id))))
  with check (((app_role() = 'entry'::text) AND has_company(co_acc(account_id))));
create policy "read acc_txns" on public.acc_txns as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(co_acc(account_id))));
create policy "write acc_txns" on public.acc_txns as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(co_acc(account_id))))
  with check ((can_write() AND has_company(co_acc(account_id))));
create policy "own dismissals" on public.alert_dismissals as PERMISSIVE for ALL to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "data entry add" on public.app_labels as PERMISSIVE for INSERT to authenticated
  with check ((app_role() = 'entry'::text));
create policy "data entry change" on public.app_labels as PERMISSIVE for UPDATE to authenticated
  using ((app_role() = 'entry'::text))
  with check ((app_role() = 'entry'::text));
create policy "entry read labels" on public.app_labels as PERMISSIVE for SELECT to authenticated
  using ((app_role() = 'driver'::text));
create policy "read labels" on public.app_labels as PERMISSIVE for SELECT to public
  using (can_read());
create policy "write labels" on public.app_labels as PERMISSIVE for ALL to public
  using (can_write())
  with check (can_write());
create policy "admin writes settings" on public.app_settings as PERMISSIVE for ALL to public
  using (is_admin())
  with check (is_admin());
create policy "read settings" on public.app_settings as PERMISSIVE for SELECT to public
  using ((auth.uid() IS NOT NULL));
create policy al_admin_read on public.audit_log as PERMISSIVE for SELECT to authenticated
  using (is_admin());
create policy "data entry add" on public.bill_accounts as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "data entry change" on public.bill_accounts as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company(company)))
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy read on public.bill_accounts as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company(company)));
create policy "write delete" on public.bill_accounts as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company(company)));
create policy "write insert" on public.bill_accounts as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company(company)));
create policy "write update" on public.bill_accounts as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy "data entry add" on public.bill_payments as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company(co_bill_acc(account_id))));
create policy "data entry change" on public.bill_payments as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company(co_bill_acc(account_id))))
  with check (((app_role() = 'entry'::text) AND has_company(co_bill_acc(account_id))));
create policy read on public.bill_payments as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company(co_bill_acc(account_id))));
create policy "write delete" on public.bill_payments as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company(co_bill_acc(account_id))));
create policy "write insert" on public.bill_payments as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company(co_bill_acc(account_id))));
create policy "write update" on public.bill_payments as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company(co_bill_acc(account_id))))
  with check ((can_write() AND has_company(co_bill_acc(account_id))));
create policy "data entry add" on public.categories as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "data entry change" on public.categories as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company(company)))
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy read on public.categories as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company(company)));
create policy "write delete" on public.categories as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company(company)));
create policy "write insert" on public.categories as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company(company)));
create policy "write update" on public.categories as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy "chat members own" on public.chat_members as PERMISSIVE for INSERT to public
  with check (((user_id = auth.uid()) AND chat_can(room_id)));
create policy "chat members own update" on public.chat_members as PERMISSIVE for UPDATE to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));
create policy "chat members read" on public.chat_members as PERMISSIVE for SELECT to public
  using (chat_can(room_id));
create policy "chat messages delete own" on public.chat_messages as PERMISSIVE for DELETE to public
  using (((user_id = auth.uid()) OR is_admin()));
create policy "chat messages read" on public.chat_messages as PERMISSIVE for SELECT to public
  using (chat_can(room_id));
create policy "chat messages send" on public.chat_messages as PERMISSIVE for INSERT to public
  with check (((user_id = auth.uid()) AND chat_can(room_id)));
create policy "chat rooms read" on public.chat_rooms as PERMISSIVE for SELECT to public
  using (chat_can(id));
create policy "company access admin delete" on public.company_access as PERMISSIVE for DELETE to public
  using (is_admin());
create policy "company access admin insert" on public.company_access as PERMISSIVE for INSERT to public
  with check (is_admin());
create policy "company access admin update" on public.company_access as PERMISSIVE for UPDATE to public
  using (is_admin())
  with check (is_admin());
create policy "company access read own or admin" on public.company_access as PERMISSIVE for SELECT to public
  using (((user_id = auth.uid()) OR is_admin()));
create policy "read books" on public.company_books as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(company)));
create policy "write books" on public.company_books as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy "data entry add" on public.company_docs as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "data entry change" on public.company_docs as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company(company)))
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "read docs" on public.company_docs as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(company)));
create policy "write docs" on public.company_docs as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy "data entry add" on public.doc_checklist as PERMISSIVE for INSERT to authenticated
  with check ((app_role() = 'entry'::text));
create policy "data entry change" on public.doc_checklist as PERMISSIVE for UPDATE to authenticated
  using ((app_role() = 'entry'::text))
  with check ((app_role() = 'entry'::text));
create policy "read checklist" on public.doc_checklist as PERMISSIVE for SELECT to public
  using (can_read());
create policy "write checklist" on public.doc_checklist as PERMISSIVE for ALL to public
  using (can_write())
  with check (can_write());
create policy "write manage links" on public.entry_links as PERMISSIVE for ALL to authenticated
  using ((can_write() AND has_company('al-noor'::text)))
  with check ((can_write() AND has_company('al-noor'::text)));
create policy "data entry add" on public.exp_attendance as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "data entry change" on public.exp_attendance as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company(company)))
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy exp_attendance_read on public.exp_attendance as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(company)));
create policy exp_attendance_write on public.exp_attendance as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy "data entry add" on public.exp_budgets as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company(source)));
create policy "data entry change" on public.exp_budgets as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company(source)))
  with check (((app_role() = 'entry'::text) AND has_company(source)));
create policy exp_budgets_del on public.exp_budgets as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company(source)));
create policy exp_budgets_ins on public.exp_budgets as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company(source)));
create policy exp_budgets_read on public.exp_budgets as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company(source)));
create policy exp_budgets_upd on public.exp_budgets as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company(source)))
  with check ((can_write() AND has_company(source)));
create policy "data entry add" on public.exp_entries as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "data entry change" on public.exp_entries as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company(company)))
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "read exp" on public.exp_entries as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(company)));
create policy "write exp" on public.exp_entries as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy "data entry add" on public.exp_staff as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "data entry change" on public.exp_staff as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company(company)))
  with check (((app_role() = 'entry'::text) AND has_company(company)));
create policy "read exp staff" on public.exp_staff as PERMISSIVE for SELECT to public
  using ((can_read() AND has_company(company)));
create policy "write exp staff" on public.exp_staff as PERMISSIVE for ALL to public
  using ((can_write() AND has_company(company)))
  with check ((can_write() AND has_company(company)));
create policy "data entry add" on public.items as PERMISSIVE for INSERT to authenticated
  with check (((app_role() = 'entry'::text) AND has_company(co_cat(category_id))));
create policy "data entry change" on public.items as PERMISSIVE for UPDATE to authenticated
  using (((app_role() = 'entry'::text) AND has_company(co_cat(category_id))))
  with check (((app_role() = 'entry'::text) AND has_company(co_cat(category_id))));
create policy read on public.items as PERMISSIVE for SELECT to authenticated
  using ((can_read() AND has_company(co_cat(category_id))));
create policy "write delete" on public.items as PERMISSIVE for DELETE to authenticated
  using ((can_write() AND has_company(co_cat(category_id))));
create policy "write insert" on public.items as PERMISSIVE for INSERT to authenticated
  with check ((can_write() AND has_company(co_cat(category_id))));
create policy "write update" on public.items as PERMISSIVE for UPDATE to authenticated
  using ((can_write() AND has_company(co_cat(category_id))))
  with check ((can_write() AND has_company(co_cat(category_id))));
