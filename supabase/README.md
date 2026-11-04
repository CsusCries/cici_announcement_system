# Connecting CICI to Supabase

Until these steps are done, the site runs in **demo mode**: no passwords, and data stays in each visitor's browser.

## 1. Create the database

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste all of [`schema.sql`](schema.sql), and click **Run**.
   This creates the tables, the security rules, the sign-up trigger, realtime updates and six sample announcements. It is safe to run again later.

## 2. Configure sign-in

In **Authentication → URL Configuration**:

- **Site URL**: `https://ciciannouncementsystem.vercel.app`
- **Redirect URLs**: add `https://ciciannouncementsystem.vercel.app/login.html`
  (add `http://localhost:8000/login.html` too if you test locally)

These make the confirmation and password-reset emails link back to your site.

Email confirmation is on by default: new users must click the link in their email before signing in. You can turn it off under **Authentication → Providers → Email → Confirm email** while testing.

## 3. Connect the site

In **Project Settings → API**, copy the **Project URL** and the **publishable** key (`sb_publishable_…`, or the legacy anon public key) into [`public/config.js`](../public/config.js):

```js
window.CICI_CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  supabaseAnonKey: 'eyJ...',
};
```

The publishable key is designed to be public. **Never** paste the secret key (`sb_secret_…`) or `service_role` key into the site.

Commit and push; Vercel redeploys automatically.

## 4. Make yourself an admin

1. Open the site and create an account on the sign-in page (and confirm your email if asked).
2. In the Supabase SQL Editor, run:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

3. Sign out and back in. You'll land on the admin panel.

After that, promote or suspend other users from the admin panel's **Users** page.

## Roles

| Role | Student page | Admin panel | Announcements | Users page |
|---|---|---|---|---|
| Student | ✓ | — | read published, sign up, save | — |
| Faculty | ✓ | ✓ | create, edit, publish, delete | — |
| Admin | ✓ | ✓ | create, edit, publish, delete | change roles, suspend |

Suspended accounts can't see anything or sign up for anything. These rules are enforced in the database (row level security), not just hidden in the page.
