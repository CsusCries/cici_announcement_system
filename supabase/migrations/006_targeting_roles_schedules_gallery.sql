-- 006: exam schedules, photo galleries, multi-year targeting enforced in the database,
--      Faculty Admin / Governor Admin roles with per-type permissions,
--      admin update/delete of users, and required name + year level at sign-up.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
-- It also adds any columns an older setup may be missing.

-- -------------------------------------------------------------------------
-- 0. Columns older setups may be missing
-- -------------------------------------------------------------------------
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists year_level text;
alter table public.announcements add column if not exists audience text not null default 'All students';
alter table public.announcements add column if not exists status text not null default 'published';
alter table public.announcements add column if not exists image_path text;

-- -------------------------------------------------------------------------
-- 1. Roles: student, faculty (Faculty Admin), governor (Governor Admin), admin
-- -------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'faculty', 'governor', 'admin'));

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.my_year() returns text
language sql stable security definer set search_path = public as $$
  select year_level from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null
$$;

-- Anyone with admin-panel access (all three admin roles).
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'faculty', 'governor'), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- Which announcement types the signed-in user may create, edit or delete.
--   admin, faculty: events, activities and exams
--   governor:       events and activities only
create or replace function public.can_manage_type(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(case public.my_role()
    when 'admin'    then true
    when 'faculty'  then true
    when 'governor' then t in ('event', 'activity')
    else false end, false)
$$;

-- -------------------------------------------------------------------------
-- 2. Year-level targeting (several years per announcement)
--    audience_years = '{}' means all students; staff_only hides it from students.
-- -------------------------------------------------------------------------
alter table public.announcements add column if not exists audience_years text[] not null default '{}';
alter table public.announcements add column if not exists staff_only boolean not null default false;
alter table public.announcements drop constraint if exists announcements_audience_years_check;
alter table public.announcements add constraint announcements_audience_years_check
  check (audience_years <@ array['1st year', '2nd year', '3rd year', '4th year']::text[]);

-- Convert the old single "audience" value (kept as a readable label).
update public.announcements set audience_years = array[audience]
 where audience in ('1st year', '2nd year', '3rd year', '4th year') and audience_years = '{}';
update public.announcements set staff_only = true where audience = 'Faculty' and not staff_only;

-- Students only receive published posts meant for everyone or for their own year.
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to authenticated
  using (
    public.is_member() and (
      public.is_staff()
      or (status = 'published'
          and not staff_only
          and (cardinality(audience_years) = 0 or public.my_year() = any (audience_years)))
    )
  );

-- Writing is limited by role and announcement type.
drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements for insert to authenticated
  with check (public.can_manage_type(type));

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements for update to authenticated
  using (public.can_manage_type(type)) with check (public.can_manage_type(type));

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements for delete to authenticated
  using (public.can_manage_type(type));

-- -------------------------------------------------------------------------
-- 3. Exam schedules: any number of subject/date/time/room rows per announcement
-- -------------------------------------------------------------------------
create table if not exists public.exam_schedules (
  id              bigint generated always as identity primary key,
  announcement_id bigint not null references public.announcements (id) on delete cascade,
  subject         text not null check (char_length(subject) between 1 and 80),
  exam_date       date not null,
  start_time      time,
  end_time        time,
  room            text not null default '' check (char_length(room) <= 60),
  position        int not null default 0,
  constraint exam_schedules_time_order check (start_time is null or end_time is null or end_time > start_time)
);
create index if not exists exam_schedules_announcement_idx on public.exam_schedules (announcement_id);

-- -------------------------------------------------------------------------
-- 4. Photo gallery: up to 50 photos per announcement (first one is the cover)
-- -------------------------------------------------------------------------
create table if not exists public.announcement_photos (
  id              bigint generated always as identity primary key,
  announcement_id bigint not null references public.announcements (id) on delete cascade,
  path            text not null check (char_length(path) between 1 and 300),
  position        int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists announcement_photos_announcement_idx on public.announcement_photos (announcement_id);

create or replace function public.limit_photos() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.announcement_photos where announcement_id = new.announcement_id) >= 50 then
    raise exception 'An announcement can have at most 50 photos';
  end if;
  return new;
end $$;

drop trigger if exists announcement_photos_limit on public.announcement_photos;
create trigger announcement_photos_limit
  before insert on public.announcement_photos
  for each row execute function public.limit_photos();

-- Copy each existing single photo into the gallery (once).
insert into public.announcement_photos (announcement_id, path, position)
select a.id, a.image_path, 0
  from public.announcements a
 where a.image_path is not null
   and not exists (select 1 from public.announcement_photos p where p.announcement_id = a.id);

-- Schedules and photos follow their announcement: you can see them only if you can
-- see the announcement, and change them only if you may manage that type.
alter table public.exam_schedules      enable row level security;
alter table public.announcement_photos enable row level security;

drop policy if exists exam_schedules_select on public.exam_schedules;
create policy exam_schedules_select on public.exam_schedules for select to authenticated
  using (exists (select 1 from public.announcements a where a.id = announcement_id));

drop policy if exists exam_schedules_write on public.exam_schedules;
create policy exam_schedules_write on public.exam_schedules for all to authenticated
  using (exists (select 1 from public.announcements a where a.id = announcement_id and public.can_manage_type(a.type)))
  with check (exists (select 1 from public.announcements a where a.id = announcement_id and public.can_manage_type(a.type)));

drop policy if exists announcement_photos_select on public.announcement_photos;
create policy announcement_photos_select on public.announcement_photos for select to authenticated
  using (exists (select 1 from public.announcements a where a.id = announcement_id));

drop policy if exists announcement_photos_write on public.announcement_photos;
create policy announcement_photos_write on public.announcement_photos for all to authenticated
  using (exists (select 1 from public.announcements a where a.id = announcement_id and public.can_manage_type(a.type)))
  with check (exists (select 1 from public.announcements a where a.id = announcement_id and public.can_manage_type(a.type)));

-- Remove a helper an earlier draft of this file may have created.
drop function if exists public.announcement_photos_ok(bigint);

grant select, insert, update, delete on public.exam_schedules, public.announcement_photos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- -------------------------------------------------------------------------
-- 5. Profiles: required name + year at sign-up; year changes by admins only
-- -------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  nm text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  yr text := new.raw_user_meta_data ->> 'year_level';
begin
  if nm = '' then
    raise exception 'Full name is required';
  end if;
  if yr is null or yr not in ('1st year', '2nd year', '3rd year', '4th year') then
    raise exception 'Year level is required';
  end if;
  insert into public.profiles (id, email, full_name, year_level)
  values (new.id, new.email, nm, yr)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Non-admins: can change their own name, and set their year level only if it was never set.
-- Admins: can change anyone's role, status and year level (but not remove their own admin access).
-- The SQL editor (no signed-in user) can change anything.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if not public.is_admin() then
      if new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email then
        raise exception 'Only admins can change role or account status';
      end if;
      if new.year_level is distinct from old.year_level and old.year_level is not null then
        raise exception 'Only an admin can change your year level';
      end if;
    end if;
    if new.id = auth.uid() and old.role = 'admin' and (new.role <> 'admin' or not new.active) then
      raise exception 'You cannot remove your own admin access';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile();

-- Admins: delete a user account (their profile, sign-ups and saves go with it).
create or replace function public.admin_delete_user(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete users';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;
  delete from auth.users where id = target;
  if not found then
    raise exception 'User not found';
  end if;
end $$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
