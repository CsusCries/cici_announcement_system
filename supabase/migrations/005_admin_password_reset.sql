-- 005: let admins set a temporary password for a user (no email needed).
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_set_password(target uuid, new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can reset passwords';
  end if;
  if target = auth.uid() then
    raise exception 'Change your own password in My profile';
  end if;
  if new_password is null or char_length(new_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),  -- a reset also unlocks unconfirmed accounts
         updated_at = now()
   where id = target;
  if not found then
    raise exception 'User not found';
  end if;
end $$;

-- Only signed-in users may call it (and the function itself only allows admins).
revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
