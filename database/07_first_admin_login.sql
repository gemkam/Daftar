-- Part 7: logins for the Daftar showcase. All use the password Daftar@2026 (change it after the first login).
-- admin and faisal = Administrator, khalid = Chairman (approves bills), salim = Co-chairman of Sahil,
-- hamad = bill verifier of Sahil, viewer = read-only guest (all companies).
do $$
declare r record; v_id uuid; v_email text;
begin
  for r in select * from (values
    ('admin','Administrator','admin',null::text), ('khalid','Khalid Nasser','admin',null), ('faisal','Faisal','admin',null),
    ('salim','Salim','editor','sahil'), ('hamad','Hamad','editor','sahil'), ('viewer','Guest Viewer','viewer','*')) t(u, n, role, co) loop
    v_id := gen_random_uuid();
    v_email := r.u || '@daftar.local';
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt('Daftar@2026', extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', r.role),
      jsonb_build_object('display_name', r.n), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
    if r.co is not null then insert into public.company_access (user_id, company, given_by) values (v_id, r.co, 'Administrator'); end if;
  end loop;
end $$;
