-- Part 6 of 7: file buckets, function permissions, live chat

-- File buckets (all private)
insert into storage.buckets (id, name, public, file_size_limit) values
  ('doc-files', 'doc-files', false, 15728640),
  ('trip-files', 'trip-files', false, 15728640),
  ('staff-files', 'staff-files', false, 15728640),
  ('chat-files', 'chat-files', false, null)
on conflict (id) do nothing;

-- Function permissions: same as the original project
revoke execute on function public.activity_start(text,text) from public, anon;
revoke execute on function public.activity_ping(uuid,text,text,text,jsonb) from public, anon;
revoke execute on function public.activity_end(uuid,text) from public, anon;
revoke execute on function public.audit_row() from public, anon, authenticated;
revoke execute on function public.can_write() from public, anon;
revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.co_acc(uuid) from public, anon;
revoke execute on function public.co_bill_acc(uuid) from public, anon;
revoke execute on function public.co_cat(uuid) from public, anon;
revoke execute on function public.co_item(uuid) from public, anon;
revoke execute on function public.co_person(text,uuid) from public, anon;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.record_move(uuid,text,numeric,text) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.set_quantity(uuid,numeric,text) from public, anon;
revoke execute on function public.app_role() from public, anon;
revoke execute on function public.can_read() from public, anon;
revoke execute on function public.admin_delete_user(uuid) from public, anon;
revoke execute on function public.admin_update_user(uuid,text,text,text) from public, anon;
revoke execute on function public.recompute_salary_allowance(uuid) from public, anon;
revoke execute on function public.driver_add_file(uuid,text,jsonb) from public, anon;
revoke execute on function public.driver_trip_counts(uuid) from public, anon;
revoke execute on function public.driver_file_action(uuid,text,text,text,text) from public, anon;
revoke execute on function public.trip_complete(uuid,boolean) from public, anon;
revoke execute on function public.admin_create_user(text,text,text,text) from public, anon;
revoke execute on function public.driver_save_trip(uuid,jsonb) from public, anon;
revoke execute on function public.power_tables() from public, anon;
revoke execute on function public.sync_transport_exp() from public, anon, authenticated;
revoke execute on function public.admin_company_data(text,text) from public, anon;
grant execute on function public.audit_row() to postgres, service_role;
grant execute on function public.sync_transport_exp() to postgres, service_role;

-- Live chat messages
alter publication supabase_realtime add table public.chat_messages;

-- Saved column layout for the Bills table (layout only, no data). Optional.
-- (app_labels key 'bills.columns' existed in the original. Skip it, the app uses defaults.)
