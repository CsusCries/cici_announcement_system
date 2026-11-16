# cici_announcement_system

CICI Announcement System: a school announcement site for events, activities and exams, with a student page, an admin panel and sign-in. Static HTML/JS hosted on Vercel, backed by Supabase (database and auth).

## Setup

See [`supabase/README.md`](supabase/README.md) to create the database, configure sign-in, paste your keys into `public/config.js`, and make your first admin.

Without keys the site runs in **demo mode**: no passwords, data saved in the browser. Demo accounts: `admin@cici.edu` (Admin), `l.garcia@cici.edu` (Faculty Admin), `governor@cici.edu` (Governor Admin), `paul.abian@student.cici.edu` (2nd-year student), `rico.reyes@student.cici.edu` (4th-year student).

## Run locally

```bash
python3 -m http.server -d public 8000
```

Then open http://localhost:8000/login.html. (Pages use ES modules, so open them through a server, not as `file://`.)

## Pages

- `public/login.html`: sign in, create account (full name, email, year level and password all required), forgot/reset password.
- `public/index.html`: student home. Shows only posts for the student's year level, filter by type, search, sort, calendar day filter, exam schedules, photo galleries with a full-screen viewer, register/join/remind, save (★), notifications, add to calendar (.ics), copy link, profile (name, year set once, password), display settings.
- `public/admin.html`: admin panel for the three admin roles. Dashboard, announcements table (create/edit/publish/unpublish/pin/duplicate/delete, audience by year level, exam schedules, photo galleries, bulk actions, CSV export), sign-up lists per announcement (with CSV), month calendar, users (Admin only: update name/year/role/status, reset password, delete), settings.

## Roles and permissions

Enforced in the database (row level security and database functions), not just hidden in the pages.

| | Student | Governor Admin | Faculty Admin | Admin |
|---|:-:|:-:|:-:|:-:|
| See announcements for their year level | ✓ | all | all | all |
| Register / save / reminders | ✓ | ✓ | ✓ | ✓ |
| Admin panel, sign-up lists | | ✓ | ✓ | ✓ |
| Create/edit/delete Events and Activities | | ✓ | ✓ | ✓ |
| Create/edit/delete Exams and exam schedules | | | ✓ | ✓ |
| Users: year level, roles, suspend, reset password, delete | | | | ✓ |
| Site content (name, logo, colour, banner) | | | | ✓ |

Any number of accounts can hold each role. Admins can't remove their own admin access or delete themselves.

## Year-level targeting

Each announcement is visible to **all students**, to **selected year levels** (one or more of 1st–4th), or to **staff only**. The database only returns an announcement (and its exam schedules and photos) to students whose year level is selected, so other years can't read it even by calling the database directly. Students pick their year at sign-up; after that only an admin can change it. A student without a year level only sees posts for all students.

## Exam schedules and photos

- An exam announcement can have any number of schedule rows (subject/session, date, start and end time, room). Its dates follow the schedules.
- Any announcement can have up to 50 photos (the first is the cover). Photos are resized in the browser before upload and open in a full-screen viewer (swipe, arrow keys, thumbnails).

## Editable site content

Admins change the site name, subtitle, logo, main colour, sign-in page text, home banner slides (up to 5) and footer in **Admin → Settings → Site content**. It is stored in the `site_settings` table (migration `004_site_settings.sql`); everyone can read it, only admins can change it.

## Password recovery

- **By email:** *Forgot password?* on the sign-in page emails a link; it opens a "choose a new password" form (expired links are detected). Needs the Supabase redirect URL `…/login.html` allowed and working email delivery.
- **By an admin (no email):** Admin → Users → key button sets a temporary password and shows it once; the user then changes it in *My profile*. Uses the `admin_set_password` database function (migration 005), which only admins can run.
- Password boxes have a show/hide (eye) button. Stored passwords can't be viewed by anyone, admins included.

## Mobile and tablet layout

- **Phones (≤760px):** bottom tab bar, pop-ups as bottom sheets, tables as stacked cards.
- **Portrait tablets (761–1100px):** ☰ menu button with a slide-in drawer; tables as stacked cards up to 900px.
- **Landscape tablets and desktop:** fixed sidebar.
- **Touch screens of any size** get finger-sized controls (about 40–44px); mouse users keep the compact look.

## Installable app

The site is installable: Android/Chrome shows **Install app** (in the profile menu or admin Settings); on iPhone/iPad use Share → **Add to Home Screen**. A service worker (`public/sw.js`) keeps a copy of the app files so it still opens offline (network first, so online users always get the latest version).

## Code

- `public/js/data.js`: data layer used by all three pages (Supabase or demo mode).
- `public/js/site.js`: default site content and how it is applied to each page.
- `public/css/mobile.css`: phone, tablet and touch layout shared by all pages.
- `public/js/lightbox.js`: full-screen photo viewer.
- `public/js/nav-drawer.js`: menu drawer for portrait tablets.
- `public/manifest.webmanifest`, `public/sw.js`, `public/js/pwa.js`, `public/icons/`, `public/offline.html`: installable app support.
- `public/config.js`: Supabase URL and anon key.
- `supabase/schema.sql`: full database setup for a new project (tables, row level security, triggers, sample data).
- `supabase/migrations/`: changes to run on an existing database, in order. `schema.sql` already includes them.
  - `002_year_level.sql`: student year levels
  - `003_photos.sql`: announcement photos (storage bucket `announcement-images`)
  - `004_site_settings.sql`: editable site content
  - `005_admin_password_reset.sql`: admins can set a temporary password for a user
  - `006_targeting_roles_schedules_gallery.sql`: year-level targeting enforced in the database, Faculty/Governor admin roles, exam schedules, photo galleries, admin update/delete of users, required name + year at sign-up
