-- CICI Announcement System: database schema for Supabase.
-- Run this whole file once in Supabase: SQL Editor → New query → paste → Run.
-- It is safe to re-run; it only creates what is missing and replaces functions/policies.

-- =========================================================================
-- Tables
-- =========================================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       text not null default 'student' check (role in ('student', 'faculty', 'admin')),
  active     boolean not null default true,
  year_level text check (year_level is null or year_level in ('1st year', '2nd year', '3rd year', '4th year')),
  created_at timestamptz not null default now()
);

-- Added in migration 002 (keeps older databases in step when this file is re-run).
alter table public.profiles add column if not exists year_level text;
alter table public.profiles drop constraint if exists profiles_year_level_check;
alter table public.profiles add constraint profiles_year_level_check
  check (year_level is null or year_level in ('1st year', '2nd year', '3rd year', '4th year'));

create table if not exists public.announcements (
  id         bigint generated always as identity primary key,
  type       text not null check (type in ('event', 'activity', 'exam')),
  title      text not null check (char_length(title) between 1 and 80),
  date       date not null,
  end_date   date,
  location   text not null default '',
  body       text not null default '',
  audience   text not null default 'All students',
  pinned     boolean not null default false,
  status     text not null default 'published' check (status in ('published', 'draft')),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_date is null or end_date >= date)
);

-- Registrations / joins / exam reminders.
create table if not exists public.signups (
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  announcement_id bigint not null references public.announcements (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

-- Bookmarks (★ Saved).
create table if not exists public.saves (
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  announcement_id bigint not null references public.announcements (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

create table if not exists public.admin_log (
  id         bigint generated always as identity primary key,
  actor      uuid default auth.uid() references public.profiles (id) on delete set null,
  actor_name text not null default '',
  message    text not null,
  created_at timestamptz not null default now()
);

create index if not exists announcements_date_idx on public.announcements (date);
create index if not exists signups_announcement_idx on public.signups (announcement_id);

-- =========================================================================
-- Role helpers (security definer so policies can read profiles safely)
-- =========================================================================

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'faculty'), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- =========================================================================
-- Triggers
-- =========================================================================

-- Create a student profile for every new sign-up.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change role, active status or email. The SQL editor
-- (no signed-in user) is allowed, so you can promote the first admin.
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if not public.is_admin()
       and (new.role is distinct from old.role or new.active is distinct from old.active or new.email is distinct from old.email) then
      raise exception 'Only admins can change role or account status';
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

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists announcements_touch on public.announcements;
create trigger announcements_touch
  before update on public.announcements
  for each row execute function public.touch_updated_at();

-- =========================================================================
-- Row level security
-- =========================================================================

alter table public.profiles      enable row level security;
alter table public.announcements enable row level security;
alter table public.signups       enable row level security;
alter table public.saves         enable row level security;
alter table public.admin_log     enable row level security;

-- profiles: see yourself; staff see everyone. Update yourself (name only,
-- enforced by the trigger) or anyone if admin.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- announcements: active members see published; staff see and manage all.
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to authenticated
  using (public.is_member() and (status = 'published' or public.is_staff()));

drop policy if exists announcements_insert on public.announcements;
create policy announcements_insert on public.announcements for insert to authenticated
  with check (public.is_staff());

drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements for delete to authenticated
  using (public.is_staff());

-- signups: manage your own on published items; staff can read all (for counts).
drop policy if exists signups_select on public.signups;
create policy signups_select on public.signups for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists signups_insert on public.signups;
create policy signups_insert on public.signups for insert to authenticated
  with check (
    user_id = auth.uid() and public.is_member()
    and exists (select 1 from public.announcements a where a.id = announcement_id and a.status = 'published')
  );

drop policy if exists signups_delete on public.signups;
create policy signups_delete on public.signups for delete to authenticated
  using (user_id = auth.uid());

-- saves: private to each user.
drop policy if exists saves_select on public.saves;
create policy saves_select on public.saves for select to authenticated
  using (user_id = auth.uid());

drop policy if exists saves_insert on public.saves;
create policy saves_insert on public.saves for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());

drop policy if exists saves_delete on public.saves;
create policy saves_delete on public.saves for delete to authenticated
  using (user_id = auth.uid());

-- admin log: staff read and write; admins can clear it.
drop policy if exists admin_log_select on public.admin_log;
create policy admin_log_select on public.admin_log for select to authenticated
  using (public.is_staff());

drop policy if exists admin_log_insert on public.admin_log;
create policy admin_log_insert on public.admin_log for insert to authenticated
  with check (public.is_staff() and actor = auth.uid());

drop policy if exists admin_log_delete on public.admin_log;
create policy admin_log_delete on public.admin_log for delete to authenticated
  using (public.is_admin());

-- =========================================================================
-- Realtime: push announcement changes to open pages
-- =========================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'announcements'
  ) then
    alter publication supabase_realtime add table public.announcements;
  end if;
end $$;

-- =========================================================================
-- Sample announcements (only inserted when the table is empty)
-- =========================================================================

insert into public.announcements (type, title, date, end_date, location, body, audience, pinned, status, created_by)
select * from (values
  ('event',    'CICI Week 2026',          date '2026-11-15', date '2026-11-21', 'Main Campus',            'A week of fun, learning, and community!',          'All students', true,  'published', null::uuid),
  ('activity', 'Green Campus Initiative', date '2026-11-10', date '2026-11-30', 'Campus Grounds',         'Join our tree planting activity.',                 'All students', false, 'published', null::uuid),
  ('exam',     'Midterm Examination',     date '2026-11-20', null,              'Online',                 'Coverage: Modules 1–5.',                           '2nd year',     false, 'published', null::uuid),
  ('activity', 'Activity Deadline',       date '2026-11-30', null,              'Student Affairs Office', 'Last day to submit your activity sign-up form.',   'All students', false, 'published', null::uuid),
  ('event',    'Freshmen Orientation',    date '2026-11-09', null,              'Auditorium',             'Welcome session, campus tour and club sign-ups.',  '1st year',     false, 'published', null::uuid),
  ('exam',     'Data Structures Quiz',    date '2026-11-12', null,              'Room 105',               'Chapters 4–6. Bring your student ID.',             '2nd year',     false, 'published', null::uuid)
) as v
where not exists (select 1 from public.announcements);

-- =========================================================================
-- After you create your own account on the site, make it an admin:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- =========================================================================
