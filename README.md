# cici_announcement_system

A lightweight, dependency-free announcement board UI.

## Features
- Create, edit, delete announcements
- Category (General / Event / Urgent / Update) and priority (high / normal / low)
- Pin important announcements to the top
- Search and filter
- Light/dark mode, mobile friendly
- Data persisted in the browser (localStorage)

## Run
Open `public/index.html` (dashboard) in a browser, or serve it. The working announcement board is at `public/board.html`:

```bash
python3 -m http.server -d public 8000
```

## Pages
- `public/index.html`: home dashboard. Filter by type, search, sort, calendar day filter, post/edit/delete announcements, register/join/remind, save (★), notifications, add to calendar (.ics), copy link, settings. Data is stored in the browser.
- `public/board.html`: working announcement board (create/edit/pin/search)
- `public/mockup.html`: events, exams and activities mockup
