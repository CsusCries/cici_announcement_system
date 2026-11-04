-- 003: photos on announcements (Supabase Storage).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.

-- Path of the photo inside the storage bucket, e.g. '2026/2f1c….webp'.
alter table public.announcements add column if not exists image_path text;
alter table public.announcements drop constraint if exists announcements_image_path_check;
alter table public.announcements add constraint announcements_image_path_check
  check (image_path is null or char_length(image_path) between 1 and 300);

-- Public bucket: anyone with the link can view a photo; 5 MB max; images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcement-images', 'announcement-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only staff (admins and faculty) can upload, replace, list or delete photos.
drop policy if exists "announcement images: staff read" on storage.objects;
create policy "announcement images: staff read" on storage.objects for select to authenticated
  using (bucket_id = 'announcement-images' and public.is_staff());

drop policy if exists "announcement images: staff upload" on storage.objects;
create policy "announcement images: staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'announcement-images' and public.is_staff());

drop policy if exists "announcement images: staff update" on storage.objects;
create policy "announcement images: staff update" on storage.objects for update to authenticated
  using (bucket_id = 'announcement-images' and public.is_staff())
  with check (bucket_id = 'announcement-images' and public.is_staff());

drop policy if exists "announcement images: staff delete" on storage.objects;
create policy "announcement images: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'announcement-images' and public.is_staff());
