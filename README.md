# cici_announcement_system

CICI Announcement System: a school announcement site for events, activities and exams, with a student page, an admin panel and sign-in. Static HTML/JS hosted on Vercel, backed by Supabase (database and auth).

## Setup

See [`supabase/README.md`](supabase/README.md) to create the database, configure sign-in, paste your keys into `public/config.js`, and make your first admin.

Without keys the site runs in **demo mode**: no passwords, data saved in the browser. Demo accounts: `admin@cici.edu` (admin), `paul.abian@student.cici.edu` (student).

## Run locally

```bash
python3 -m http.server -d public 8000
```

Then open http://localhost:8000/login.html. (Pages use ES modules, so open them through a server, not as `file://`.)

## Pages

- `public/login.html`: sign in, create account, forgot/reset password.
- `public/index.html`: student home. Shows posts for the student's year level, filter by type, search, sort, calendar day filter, register/join/remind, save (★), notifications, add to calendar (.ics), copy link, profile (name, year, password), display settings.
- `public/admin.html`: admin panel for admins and faculty. Dashboard, announcements table (create/edit/publish/unpublish/pin/duplicate/delete, photos, bulk actions, CSV export), sign-up lists per announcement (with CSV), month calendar, users (admins only: roles, suspend, year level), settings.

## Editable site content

Admins change the site name, subtitle, logo, main colour, sign-in page text, home banner slides (up to 5) and footer in **Admin → Settings → Site content**. It is stored in the `site_settings` table (migration `004_site_settings.sql`); everyone can read it, only admins can change it.

## Mobile app

On phones the pages switch to an app layout (bottom tab bar, bottom sheets, larger tap targets). The site is installable: Android/Chrome shows **Install app** (in the profile menu or admin Settings); on iPhone/iPad use Share → **Add to Home Screen**. A service worker (`public/sw.js`) keeps a copy of the app files so it still opens offline (network first, so online users always get the latest version).

## Code

- `public/js/data.js`: data layer used by all three pages (Supabase or demo mode).
- `public/js/site.js`: default site content and how it is applied to each page.
- `public/css/mobile.css`: phone layout shared by all pages.
- `public/manifest.webmanifest`, `public/sw.js`, `public/js/pwa.js`, `public/icons/`, `public/offline.html`: installable app support.
- `public/config.js`: Supabase URL and anon key.
- `supabase/schema.sql`: full database setup for a new project (tables, row level security, triggers, sample data).
- `supabase/migrations/`: changes to run on an existing database, in order. `schema.sql` already includes them.
  - `002_year_level.sql`: student year levels
  - `003_photos.sql`: announcement photos (storage bucket `announcement-images`)
  - `004_site_settings.sql`: editable site content
