-- 13 Security cleanup (27 Nov 2026, Kamran). APPLIED on Supabase as migration revoke_anon_chat_trigger_functions.
-- Logged-out visitors can no longer call the chat functions. Trigger functions can not be called directly
-- (triggers still run as before: Postgres does not check EXECUTE when a trigger fires).
-- Kept open on purpose: public_* (share links, sign up), report_* and push_private_key (need the secret report key), slip_token_ok, has_company.
revoke execute on function public.chat_can(uuid) from public, anon;
revoke execute on function public.chat_can_see(uuid) from public, anon;
revoke execute on function public.chat_dm(uuid) from public, anon;
revoke execute on function public.chat_group(text, text) from public, anon;
revoke execute on function public.chat_in_company(text) from public, anon;
revoke execute on function public.chat_people() from public, anon;
revoke execute on function public.chat_unread() from public, anon;
revoke execute on function public.chat_user_companies(uuid) from public, anon;
revoke execute on function public.driver_too_old(uuid) from public, anon;
grant execute on function public.chat_can(uuid), public.chat_can_see(uuid), public.chat_dm(uuid), public.chat_group(text, text),
  public.chat_in_company(text), public.chat_people(), public.chat_unread(), public.chat_user_companies(uuid), public.driver_too_old(uuid) to authenticated;
revoke execute on function public.chat_touch() from public, anon, authenticated;
revoke execute on function public.allowance_link_after() from public, anon, authenticated;
revoke execute on function public.allowance_link_before() from public, anon, authenticated;
revoke execute on function public.guard_bill_delete() from public, anon, authenticated;
revoke execute on function public.guard_bill_verify() from public, anon, authenticated;
