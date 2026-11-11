// Editable site content: name, subtitle, logo, main colour, sign-in text,
// home banner slides and footer. Admins edit it in Admin → Settings; every
// page (including the sign-in page) loads it with loadSite().
import { api } from './data.js';

export const DEFAULT_COLOR = '#2563eb';

export const DEFAULT_SITE = {
  name: 'CICI',
  subtitle: 'Announcement System',
  logo: '',
  color: DEFAULT_COLOR,
  loginTitle: 'Connect. Learn. Participate.',
  loginText: 'Sign in to see events, activities and exam schedules, and keep track of what you’ve joined.',
  slides: [
    { chip: '📢 Latest Announcement', title: 'Welcome to CICI!', text: 'Stay updated with the latest events, activities, and exams.', cta: 'View All Announcements →', view: 'all' },
    { chip: '📅 Event', title: 'Don’t Miss Out', text: 'Browse upcoming events and register in one tap.', cta: 'See Events →', view: 'event' },
    { chip: '📄 Exam', title: 'Stay Exam-Ready', text: 'Check the exam schedule and set reminders.', cta: 'View Exams →', view: 'exam' },
  ],
  footerLeft: 'Connect. Learn. Participate.',
  footerRight: 'Stay informed. Stay ahead. ♡',
};

// Where a banner button can take students.
export const SLIDE_TARGETS = { all: 'All announcements', event: 'Events', activity: 'Activities', exam: 'Exams', saved: 'Saved', mine: 'My list' };

export const COLOR_PRESETS = [
  ['#2563eb', 'Blue'], ['#4f46e5', 'Indigo'], ['#0f766e', 'Teal'], ['#15803d', 'Green'],
  ['#9f1239', 'Maroon'], ['#7e22ce', 'Purple'], ['#c2410c', 'Orange'], ['#334155', 'Slate'],
];

export const LIMITS = { name: 24, subtitle: 40, loginTitle: 60, loginText: 200, footerLeft: 60, footerRight: 60, chip: 40, title: 60, text: 160, cta: 40, slides: 5 };

const str = (v, max, fallback) => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);

// Fill in anything missing and trim anything too long, so a bad or partial
// saved value can never break a page.
export function cleanSite(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const site = {
    name: str(r.name, LIMITS.name, DEFAULT_SITE.name) || DEFAULT_SITE.name,
    subtitle: str(r.subtitle, LIMITS.subtitle, DEFAULT_SITE.subtitle),
    logo: typeof r.logo === 'string' ? r.logo : '',
    color: /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color.toLowerCase() : DEFAULT_COLOR,
    loginTitle: str(r.loginTitle, LIMITS.loginTitle, DEFAULT_SITE.loginTitle),
    loginText: str(r.loginText, LIMITS.loginText, DEFAULT_SITE.loginText),
    footerLeft: str(r.footerLeft, LIMITS.footerLeft, DEFAULT_SITE.footerLeft),
    footerRight: str(r.footerRight, LIMITS.footerRight, DEFAULT_SITE.footerRight),
  };
  const slides = Array.isArray(r.slides) ? r.slides : DEFAULT_SITE.slides;
  site.slides = slides.slice(0, LIMITS.slides).map((s) => ({
    chip: str(s && s.chip, LIMITS.chip, ''),
    title: str(s && s.title, LIMITS.title, ''),
    text: str(s && s.text, LIMITS.text, ''),
    cta: str(s && s.cta, LIMITS.cta, ''),
    view: s && SLIDE_TARGETS[s.view] ? s.view : 'all',
  })).filter((s) => s.title);
  if (!site.slides.length) site.slides = DEFAULT_SITE.slides.map((s) => ({ ...s }));
  return site;
}

// Contrast of white text on a colour (WCAG). 4.5 or more is readable for buttons.
export function contrastWithWhite(hex) {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const n = parseInt(hex.slice(1), 16);
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (L + 0.05);
}

let originalTitle = null;

// Put the content on the current page.
export function applySite(site) {
  if (originalTitle === null) originalTitle = document.title;
  document.title = originalTitle.replace(/CICI/g, site.name);

  document.querySelectorAll('[data-site]').forEach((el) => {
    const v = site[el.dataset.site];
    if (typeof v === 'string') el.textContent = v;
  });

  // Logo: replace the round mark with the uploaded image.
  const logoUrl = site.logo ? api.imageUrl(site.logo) : '';
  document.querySelectorAll('.mark').forEach((el) => {
    el.classList.toggle('has-logo', !!logoUrl);
    el.style.backgroundImage = logoUrl ? `url("${logoUrl}")` : '';
  });

  // Colour: derive the lighter and darker shades from the main colour.
  let style = document.getElementById('site-theme');
  if (!style) { style = document.createElement('style'); style.id = 'site-theme'; document.head.append(style); }
  const c = site.color;
  const mix = (pct, other) => `color-mix(in srgb, ${c} ${pct}%, ${other})`;
  style.textContent = `
    .mark.has-logo { background-color: #fff !important; background-position: center !important; background-size: contain !important; background-repeat: no-repeat !important; box-shadow: 0 0 0 1px var(--border) !important; border-radius: 12px !important; }
    ${c === DEFAULT_COLOR ? '' : `
    :root { --blue-600: ${c}; --blue: ${mix(85, '#000')}; --blue-d: ${mix(55, '#000')}; --blue-100: ${mix(14, '#fff')}; --blue-50: ${mix(5, '#fff')}; }
    .hero, .brand { background: linear-gradient(110deg, ${mix(80, '#000')}, ${c} 55%, ${mix(65, '#fff')}) !important; }
    .side { background: linear-gradient(180deg, ${mix(3, '#fff')}, ${mix(8, '#fff')}); }
    .nav button.on { box-shadow: 0 6px 16px ${mix(25, 'transparent')} !important; }
    .logo .mark:not(.has-logo) { background: radial-gradient(circle, #fff 0 22%, var(--blue) 23% 100%); box-shadow: 0 0 0 6px var(--blue-100) inset; }
    .brand .mark:not(.has-logo) { background: radial-gradient(circle, var(--blue) 0 22%, #fff 23% 100%); }`}
  `;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = c === DEFAULT_COLOR ? '#1d4ed8' : c;
}

// Show the last-seen content straight away (no flash of the defaults),
// then fetch the latest and update the page.
export async function loadSite() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem('cici.siteCache') || 'null'); } catch {}
  let site = cleanSite(cached);
  applySite(site);
  try {
    site = cleanSite(await api.getSiteContent());
    applySite(site);
    try { localStorage.setItem('cici.siteCache', JSON.stringify(site)); } catch {}
  } catch { /* table not created yet or offline: keep what we have */ }
  return site;
}
