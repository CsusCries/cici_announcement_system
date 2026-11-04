-- 002: year level on profiles (used to filter announcements by audience).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.

alter table public.profiles add column if not exists year_level text;

alter table public.profiles drop constraint if exists profiles_year_level_check;
alter table public.profiles add constraint profiles_year_level_check
  check (year_level is null or year_level in ('1st year', '2nd year', '3rd year', '4th year'));

-- New sign-ups can pick their year level on the sign-up form.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  yr text := new.raw_user_meta_data ->> 'year_level';
begin
  insert into public.profiles (id, email, full_name, year_level)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when yr in ('1st year', '2nd year', '3rd year', '4th year') then yr end
  )
  on conflict (id) do nothing;
  return new;
end $$;
