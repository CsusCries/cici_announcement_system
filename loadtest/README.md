# Load test

Simulates many students using CICI at the same time, with [k6](https://k6.io).

Each fake user opens the site, loads their profile, the announcements, settings,
saved posts and sign-ups (like the student home does), reads for a few seconds,
then saves and unsaves a random post.

## 1. Install k6

- Windows: `winget install k6 --source winget`
- Mac: `brew install k6`
- Linux / others: https://grafana.com/docs/k6/latest/set-up/install-k6/

## 2. Make a test account

Sign up on the site with a **test student account** (not a real student). The test
signs in with it once and all fake users share it, so it doesn't hit Supabase's
sign-in limit.

## 3. Run it

From the repo folder:

```bash
k6 run -e EMAIL=test@student.cici.edu -e PASSWORD=yourpassword loadtest/load.js
```

Options (add with `-e NAME=value`):

| Option | Default | What it does |
|---|---|---|
| `USERS` | `50` | Peak number of users at once |
| `WRITES` | `1` | `0` = only read, never save/unsave |
| `SITE` | the Vercel site | Site address to test |
| `SB_URL`, `SB_KEY` | from `public/config.js` | Supabase project (use a test project if you have one) |

Without `EMAIL`/`PASSWORD` it only tests page loads from Vercel.

Start small (`USERS=10`), then try 50, 100, 200. A run takes about 4 minutes.

## 4. Read the results

At the end k6 prints a summary. The important lines:

- `http_req_duration ... p(95)=` : 95% of requests were faster than this. Under ~1 s is good.
- `http_req_failed` : share of failed requests. Should be close to 0%.
- `checks` : share of checks that passed. Should be close to 100%.
- A green ✓ next to each threshold means it passed; a red ✗ means it failed.

If errors appear as you raise `USERS`, that's the limit of your current Supabase plan.
