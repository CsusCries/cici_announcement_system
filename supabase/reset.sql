-- CICI Announcement System: CLEAN WIPE.
-- Deletes every CICI table, all their data, functions, triggers and security rules.
-- THIS CANNOT BE UNDONE. Make a backup first if you want to keep anything.
--
-- How to use (Supabase → SQL Editor → New query):
--   1. Paste this whole file and click Run.
--   2. Then paste all of schema.sql and click Run. That rebuilds a fresh, empty system
--      (with the sample announcements).
--   3. Sign up again on the site and make yourself admin (see README.md, step 4).
--
-- Photos: Supabase doesn't let SQL delete stored files. To remove them, open
-- Storage → announcement-images, select all files and delete them (before or after this).

-- Sign-up trigger on Supabase's login table
drop trigger if exists on_auth_user_created on auth.users;

-- Photo storage rules (the bucket itself is kept; schema.sql reuses it)
drop policy if exists "announcement images: staff read"   on storage.objects;
drop policy if exists "announcement images: staff upload" on storage.objects;
drop policy if exists "announcement images: staff update" on storage.objects;
drop policy if exists "announcement images: staff delete" on storage.objects;

-- Tables (CASCADE also removes their triggers, rules and realtime subscription)
drop table if exists public.announcement_photos cascade;
drop table if exists public.exam_schedules      cascade;
drop table if exists public.signups             cascade;
drop table if exists public.saves               cascade;
drop table if exists public.admin_log           cascade;
drop table if exists public.announcements       cascade;
drop table if exists public.site_settings       cascade;
drop table if exists public.profiles            cascade;

-- Functions
drop function if exists public.handle_new_user()                  cascade;
drop function if exists public.protect_profile()                  cascade;
drop function if exists public.touch_updated_at()                 cascade;
drop function if exists public.touch_site_settings()              cascade;
drop function if exists public.limit_photos()                     cascade;
drop function if exists public.admin_set_password(uuid, text)     cascade;
drop function if exists public.admin_delete_user(uuid)            cascade;
drop function if exists public.can_manage_type(text)              cascade;
drop function if exists public.my_role()                          cascade;
drop function if exists public.my_year()                          cascade;
drop function if exists public.is_member()                        cascade;
drop function if exists public.is_staff()                         cascade;
drop function if exists public.is_admin()                         cascade;

-- OPTIONAL: also delete every login account (everyone must sign up again).
-- Remove the two dashes at the start of the next line to include it.
-- delete from auth.users;
