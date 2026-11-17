// CICI load test (k6). Simulates many students using the site at once.
// How to run: see loadtest/README.md.
//
//   k6 run loadtest/load.js                               -> pages only (Vercel)
//   k6 run -e EMAIL=... -e PASSWORD=... loadtest/load.js  -> pages + database (Supabase)

import http from 'k6/http';
import { check, sleep, group } from 'k6';

const SITE = __ENV.SITE || 'https://ciciannouncementsystem.vercel.app';
const SB_URL = __ENV.SB_URL || 'https://mobtbtvfacxaixgunajy.supabase.co';
const SB_KEY = __ENV.SB_KEY || 'sb_publishable_Gu6waOF-030cQBhtuj1Bsg_01-zsBnF'; // public key
const EMAIL = __ENV.EMAIL;       // a TEST student account
const PASSWORD = __ENV.PASSWORD;
const USERS = Number(__ENV.USERS || 50); // peak number of users at once
const WRITES = __ENV.WRITES !== '0';     // save/unsave a post (set WRITES=0 for read-only)

export const options = {
  stages: [
    { duration: '30s', target: Math.ceil(USERS / 5) }, // warm up
    { duration: '1m', target: USERS },                 // ramp to peak
    { duration: '2m', target: USERS },                 // hold the peak
    { duration: '30s', target: 0 },                    // cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],     // under 1% errors
    http_req_duration: ['p(95)<1500'],  // 95% of requests under 1.5 s
    checks: ['rate>0.99'],
  },
};

// Sign in ONCE and share the token, so the test doesn't hit Supabase's sign-in rate limit.
export function setup() {
  if (!EMAIL || !PASSWORD) {
    console.warn('No EMAIL/PASSWORD given: testing page loads only, not the database.');
    return { token: null };
  }
  const res = http.post(`${SB_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: EMAIL.trim().toLowerCase(), password: PASSWORD }),
    { headers: { apikey: SB_KEY, 'Content-Type': 'application/json' } });
  if (res.status !== 200) throw new Error(`Sign-in failed (${res.status}): ${res.body}`);
  const body = res.json();
  return { token: body.access_token, userId: body.user.id };
}

export default function (data) {
  group('open the site', () => {
    const pages = http.batch([
      ['GET', `${SITE}/index.html`],
      ['GET', `${SITE}/styles.css`],
      ['GET', `${SITE}/app.js`],
      ['GET', `${SITE}/js/data.js`],
    ]);
    pages.forEach((r) => check(r, { 'page/file loaded': (x) => x.status === 200 }));
  });

  if (!data.token) { sleep(3); return; }

  const h = { headers: { apikey: SB_KEY, Authorization: `Bearer ${data.token}`, 'Content-Type': 'application/json' } };
  const rest = `${SB_URL}/rest/v1`;
  let announcements = [];

  group('load the student home', () => {
    const [profile, list, settings, saves, signups] = http.batch([
      ['GET', `${rest}/profiles?select=*&id=eq.${data.userId}`, null, h],
      ['GET', `${rest}/announcements?select=*,exam_schedules(*),announcement_photos(*)&order=date`, null, h],
      ['GET', `${rest}/site_settings?select=content&id=eq.1`, null, h],
      ['GET', `${rest}/saves?select=announcement_id&user_id=eq.${data.userId}`, null, h],
      ['GET', `${rest}/signups?select=announcement_id&user_id=eq.${data.userId}`, null, h],
    ]);
    check(profile, { 'profile ok': (r) => r.status === 200 });
    check(list, { 'announcements ok': (r) => r.status === 200 });
    check(settings, { 'settings ok': (r) => r.status === 200 });
    check(saves, { 'saves ok': (r) => r.status === 200 });
    check(signups, { 'signups ok': (r) => r.status === 200 });
    if (list.status === 200) announcements = list.json();
  });

  sleep(1 + Math.random() * 2); // the student reads for a moment

  if (WRITES && announcements.length) {
    group('save and unsave a post', () => {
      const a = announcements[Math.floor(Math.random() * announcements.length)];
      const add = http.post(`${rest}/saves`, JSON.stringify({ announcement_id: a.id }),
        { headers: { ...h.headers, Prefer: 'resolution=ignore-duplicates,return=minimal' } });
      check(add, { 'save ok': (r) => r.status === 201 || r.status === 200 || r.status === 409 });
      const del = http.del(`${rest}/saves?user_id=eq.${data.userId}&announcement_id=eq.${a.id}`, null, h);
      check(del, { 'unsave ok': (r) => r.status === 204 || r.status === 200 });
    });
  }

  sleep(2 + Math.random() * 3);
}
