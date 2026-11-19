-- Part 4 of 7: triggers, private secrets table, auto-RLS event trigger

CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.acc_accounts FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.acc_items FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.acc_txns FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.app_labels FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.bill_accounts FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.bill_payments FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER chat_touch AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION chat_touch();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.company_docs FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_guard_bill_delete BEFORE DELETE ON public.company_docs FOR EACH ROW EXECUTE FUNCTION guard_bill_delete();
CREATE TRIGGER trg_guard_bill_verify BEFORE INSERT OR UPDATE ON public.company_docs FOR EACH ROW EXECUTE FUNCTION guard_bill_verify();
CREATE TRIGGER trg_sync_exp AFTER INSERT OR DELETE OR UPDATE ON public.company_docs FOR EACH ROW EXECUTE FUNCTION sync_transport_exp();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.doc_checklist FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.entry_links FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.exp_attendance FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.exp_budgets FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.exp_entries FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.exp_staff FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.personnel_subcontractors FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.petty_cash FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.salary_credits FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.salary_slips FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.stock_moves FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.transport_drivers FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_allowance_link_after AFTER DELETE OR UPDATE ON public.transport_entries FOR EACH ROW EXECUTE FUNCTION allowance_link_after();
CREATE TRIGGER trg_allowance_link_before BEFORE UPDATE ON public.transport_entries FOR EACH ROW EXECUTE FUNCTION allowance_link_before();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.transport_entries FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_set_received_date BEFORE INSERT OR UPDATE ON public.transport_entries FOR EACH ROW EXECUTE FUNCTION set_received_date();
CREATE TRIGGER trg_sync_exp AFTER INSERT OR DELETE OR UPDATE ON public.transport_entries FOR EACH ROW EXECUTE FUNCTION sync_transport_exp();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.transport_extras FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_sync_exp AFTER INSERT OR DELETE OR UPDATE ON public.transport_extras FOR EACH ROW EXECUTE FUNCTION sync_transport_exp();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.transport_invoices FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.transport_profit_taken FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.transport_salaries FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_sync_exp AFTER INSERT OR DELETE OR UPDATE ON public.transport_salaries FOR EACH ROW EXECUTE FUNCTION sync_transport_exp();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.transport_vehicles FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_audit AFTER INSERT OR DELETE OR UPDATE ON public.vehicle_maintenance FOR EACH ROW EXECUTE FUNCTION audit_row();
CREATE TRIGGER trg_sync_exp AFTER INSERT OR DELETE OR UPDATE ON public.vehicle_maintenance FOR EACH ROW EXECUTE FUNCTION sync_transport_exp();

-- Turn on row level security automatically for every new table in public
create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();

-- Private secrets (not reachable from the website). Values are NEW for the demo, not the old ones.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.app_secrets (name text primary key, value text);
-- report_key: any long random text. Put the same text in Vercel as CRON_SECRET.
insert into private.app_secrets (name, value) values
  ('report_key', 'CHANGE-ME-long-random-text'),
  ('vapid_private', 'CHANGE-ME-only-needed-for-phone-notifications')
on conflict (name) do nothing;
