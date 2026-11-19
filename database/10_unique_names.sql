-- 10 Unique names (19 Nov 2026, Kamran): two users can never have the same username or full name,
-- two companies can never have the same name, short name or CR number. Applied on Supabase (migration unique_names_users_companies).
-- Same = same letters and numbers, ignoring case, spaces, dots and dashes (public.norm_name).
-- Users: trigger trg_unique_user_name on auth.users (sign up, Admin create / edit, SQL).
-- Companies: unique indexes personnel_companies_name_unique / _short_unique / _cr_unique, and add_my_company also
-- checks the fixed companies (Al Noor, Sahil, CR 1000001 / 1000002). Full SQL: see the Supabase migration.
create or replace function public.norm_name(p text) returns text
language sql immutable set search_path to '' as $$
  select nullif(lower(regexp_replace(coalesce(p, ''), '[^[:alnum:]]', '', 'g')), '');
$$;
create or replace function public.guard_user_name() returns trigger
language plpgsql security definer set search_path to '' as $$
declare v text := public.norm_name(new.raw_user_meta_data ->> 'display_name');
begin
  if v is not null and exists (select 1 from auth.users u where u.id <> new.id and public.norm_name(u.raw_user_meta_data ->> 'display_name') = v) then
    raise exception 'This name is already used by another user. Please use your full name or add something to make it different.';
  end if;
  return new;
end $$;
drop trigger if exists trg_unique_user_name on auth.users;
create trigger trg_unique_user_name before insert or update of raw_user_meta_data on auth.users
  for each row execute function public.guard_user_name();
create unique index if not exists personnel_companies_name_unique on public.personnel_companies (public.norm_name(name));
create unique index if not exists personnel_companies_short_unique on public.personnel_companies (public.norm_name(short));
create unique index if not exists personnel_companies_cr_unique on public.personnel_companies (public.norm_name(cr)) where public.norm_name(cr) is not null;
