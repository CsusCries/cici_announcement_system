-- 004: editable site content (name, logo, colour, sign-in text, banner slides, footer).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.

-- One row (id = 1) holding the content as JSON.
create table if not exists public.site_settings (
  id         int primary key default 1 check (id = 1),
  content    jsonb not null default '{}'::jsonb check (pg_column_size(content) < 20000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- Record when and by whom it was last changed.
create or replace function public.touch_site_settings() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end $$;

drop trigger if exists site_settings_touch on public.site_settings;
create trigger site_settings_touch
  before update on public.site_settings
  for each row execute function public.touch_site_settings();

-- Everyone can read it (the sign-in page shows it before login); only admins can change it.
alter table public.site_settings enable row level security;

drop policy if exists site_settings_select on public.site_settings;
create policy site_settings_select on public.site_settings for select to anon, authenticated
  using (true);

drop policy if exists site_settings_update on public.site_settings;
create policy site_settings_update on public.site_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.site_settings to anon, authenticated;
grant update (content) on public.site_settings to authenticated;
