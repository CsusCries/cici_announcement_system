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
- `public/index.html`: student home. Filter by type, search, sort, calendar day filter, register/join/remind, save (★), notifications, add to calendar (.ics), copy link, display settings.
- `public/admin.html`: admin panel for admins and faculty. Dashboard, announcements table (create/edit/publish/unpublish/pin/duplicate/delete, bulk actions, CSV export), month calendar, users (admins only: roles, suspend), settings.
- `public/board.html`, `public/mockup.html`: early prototypes, not connected to the backend.

## Code

- `public/js/data.js`: data layer used by all three pages (Supabase or demo mode).
- `public/config.js`: Supabase URL and anon key.
- `supabase/schema.sql`: tables, row level security, triggers, sample data.
