// Data layer shared by index.html, admin.html and login.html.
// Uses Supabase when public/config.js has a URL and anon key; otherwise runs a
// local demo backed by localStorage so the site still works before setup.

const cfg = window.CICI_CONFIG || {};
export const live = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);

let sb = null;
if (live) {
  // supabase-js 2.118.0 browser build, bundled in public/vendor/supabase (MIT licence).
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const s = Object.assign(document.createElement('script'), { src: new URL('../vendor/supabase/supabase.js', import.meta.url).href });
      s.onload = resolve; s.onerror = () => reject(new Error('Could not load the Supabase library'));
      document.head.append(s);
    });
  }
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
}

export const isStaff = (u) => !!u && (u.role === 'admin' || u.role === 'faculty');
export const isAdmin = (u) => !!u && u.role === 'admin';
export const roleLabel = (r) => ({ student: 'Student', faculty: 'Faculty', admin: 'Admin' }[r] || r);
export const initials = (name) => (name || '?').split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !w.endsWith('.')).map((w) => w[0].toUpperCase()).slice(0, 2).join('') || '?';

const base = () => location.origin + location.pathname.replace(/[^/]*$/, '');
const fail = (error) => { if (error) throw new Error(error.message || String(error)); };

/* ---------------- mapping between DB rows and page objects ---------------- */
const fromRow = (r) => ({
  id: r.id, type: r.type, title: r.title, date: r.date, end: r.end_date || undefined,
  where: r.location || '', body: r.body || '', audience: r.audience || 'All students',
  pinned: !!r.pinned, status: r.status, created: Date.parse(r.created_at),
});
const toRow = (a) => {
  const map = { type: 'type', title: 'title', date: 'date', end: 'end_date', where: 'location', body: 'body', audience: 'audience', pinned: 'pinned', status: 'status' };
  const row = {};
  for (const [k, col] of Object.entries(map)) if (k in a) row[col] = k === 'end' ? (a.end || null) : a[k];
  return row;
};
const fromProfile = (p) => ({ id: p.id, email: p.email, name: p.full_name || p.email.split('@')[0], role: p.role, active: p.active, year: p.year_level || '' });

export const YEARS = ['1st year', '2nd year', '3rd year', '4th year'];
// Who should see an announcement: staff see everything; students see "All students"
// posts plus their own year (all years if they haven't set one); "Faculty" posts are staff-only.
export const visibleTo = (u, a) => {
  if (isStaff(u)) return true;
  const aud = a.audience || 'All students';
  if (aud === 'All students') return true;
  if (aud === 'Faculty') return false;
  return !u?.year || aud === u.year;
};

/* ---------------- demo (localStorage) ---------------- */
const local = {
  get(k, d) { try { const v = localStorage.getItem('cici.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('cici.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('cici.' + k); } catch {} },
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const DEMO_ITEMS = [
  { id: 1, type: 'event', title: 'CICI Week 2026', date: '2026-11-15', end: '2026-11-21', where: 'Main Campus', pinned: true, body: 'A week of fun, learning, and community!', status: 'published', audience: 'All students', signups: 142 },
  { id: 2, type: 'activity', title: 'Green Campus Initiative', date: '2026-11-10', end: '2026-11-30', where: 'Campus Grounds', body: 'Join our tree planting activity.', status: 'published', audience: 'All students', signups: 64 },
  { id: 3, type: 'exam', title: 'Midterm Examination', date: '2026-11-20', where: 'Online', body: 'Coverage: Modules 1–5.', status: 'published', audience: '2nd year', signups: 0 },
  { id: 4, type: 'activity', title: 'Activity Deadline', date: '2026-11-30', where: 'Student Affairs Office', body: 'Last day to submit your activity sign-up form.', status: 'published', audience: 'All students', signups: 23 },
  { id: 5, type: 'event', title: 'Freshmen Orientation', date: '2026-11-09', where: 'Auditorium', body: 'Welcome session, campus tour and club sign-ups.', status: 'published', audience: '1st year', signups: 198 },
  { id: 6, type: 'exam', title: 'Data Structures Quiz', date: '2026-11-12', where: 'Room 105', body: 'Chapters 4–6. Bring your student ID.', status: 'published', audience: '2nd year', signups: 0 },
  { id: 7, type: 'event', title: 'Career Fair', date: '2026-12-03', where: 'Gym B', body: 'Meet employers and bring printed CVs.', status: 'draft', audience: '4th year', signups: 0 },
];
const DEMO_USERS = [
  { id: 'u1', name: 'Paul Abian', email: 'paul.abian@student.cici.edu', role: 'student', active: true, year: '2nd year' },
  { id: 'u2', name: 'Maria Santos', email: 'maria.santos@student.cici.edu', role: 'student', active: true, year: '1st year' },
  { id: 'u3', name: 'Ana Cruz', email: 'ana.cruz@student.cici.edu', role: 'student', active: false, year: '3rd year' },
  { id: 'u4', name: 'Prof. L. Garcia', email: 'l.garcia@cici.edu', role: 'faculty', active: true },
  { id: 'u5', name: 'Demo Admin', email: 'admin@cici.edu', role: 'admin', active: true },
];
const demoItems = () => { const v = local.get('items', null); if (v) return v; local.set('items', clone(DEMO_ITEMS)); return clone(DEMO_ITEMS); };
const demoUsers = () => { const v = local.get('demoUsers', null); if (v) return v; local.set('demoUsers', clone(DEMO_USERS)); return clone(DEMO_USERS); };
const demoMe = () => { const s = local.get('session', null); return s && demoUsers().find((u) => u.id === s.id) || null; };

/* ---------------- session cache ---------------- */
let meCache = null;

export const api = {
  live,

  /* ---- auth ---- */
  async currentUser() {
    if (!live) return (meCache = demoMe());
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return (meCache = null);
    const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    fail(error);
    if (!data) throw new Error('Your profile is missing. Make sure supabase/schema.sql was run, then sign up again.');
    return (meCache = fromProfile(data));
  },

  // Redirects away (and never resolves) when the visitor may not see this page.
  async requireUser({ staff = false } = {}) {
    let me = null;
    try { me = await this.currentUser(); } catch (e) { alert(e.message); }
    const here = location.pathname.split('/').pop() || 'index.html';
    if (!me) { location.replace('login.html?next=' + encodeURIComponent(here + location.hash)); return new Promise(() => {}); }
    if (!me.active) { await this.signOut(); location.replace('login.html?msg=suspended'); return new Promise(() => {}); }
    if (staff && !isStaff(me)) { location.replace('index.html'); return new Promise(() => {}); }
    return me;
  },

  async signIn(email, password) {
    if (!live) {
      const users = demoUsers();
      let u = users.find((x) => x.email === email.toLowerCase());
      if (!u) throw new Error('No account with that email. Create one first (demo mode).');
      if (!u.active) throw new Error('This account is suspended.');
      local.set('session', { id: u.id }); return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    fail(error);
    const me = await this.currentUser();
    if (me && !me.active) { await this.signOut(); throw new Error('This account is suspended. Contact an administrator.'); }
  },

  async signUp(name, email, password, year = '') {
    if (!live) {
      const users = demoUsers();
      if (users.some((x) => x.email === email.toLowerCase())) throw new Error('That email already has an account.');
      const u = { id: 'u' + Date.now(), name, email: email.toLowerCase(), role: 'student', active: true, year };
      users.push(u); local.set('demoUsers', users); local.set('session', { id: u.id });
      return { needsConfirm: false };
    }
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name, year_level: year }, emailRedirectTo: base() + 'login.html' } });
    fail(error);
    return { needsConfirm: !data.session };
  },

  async signOut() {
    meCache = null;
    if (!live) return local.del('session');
    await sb.auth.signOut();
  },

  async resetPassword(email) {
    if (!live) throw new Error('Password reset needs Supabase. In demo mode no password is checked.');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: base() + 'login.html' });
    fail(error);
  },

  async updatePassword(password) {
    if (!live) throw new Error('Passwords need Supabase. In demo mode no password is checked.');
    const { error } = await sb.auth.updateUser({ password });
    fail(error);
  },

  onRecovery(cb) { if (live) sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') cb(); }); },

  /* ---- announcements ---- */
  async listAnnouncements() {
    if (!live) { const all = demoItems(); return isStaff(meCache) ? all : all.filter((a) => a.status !== 'draft'); }
    const { data, error } = await sb.from('announcements').select('*').order('date');
    fail(error);
    return data.map(fromRow);
  },

  async saveAnnouncement(a) {
    if (!live) {
      const all = demoItems();
      let out;
      if (a.id) { out = Object.assign(all.find((x) => x.id === a.id), a); if (!a.end) delete out.end; }
      else { out = { ...a, id: Math.max(0, ...all.map((x) => x.id)) + 1, signups: 0, created: Date.now() }; if (!out.end) delete out.end; all.push(out); }
      local.set('items', all); return clone(out);
    }
    const row = toRow(a);
    const q = a.id ? sb.from('announcements').update(row).eq('id', a.id) : sb.from('announcements').insert(row);
    const { data, error } = await q.select().single();
    fail(error);
    return fromRow(data);
  },

  async updateAnnouncements(ids, patch) {
    if (!live) { const all = demoItems(); all.forEach((x) => ids.includes(x.id) && Object.assign(x, patch)); return local.set('items', all); }
    const { error } = await sb.from('announcements').update(toRow(patch)).in('id', ids);
    fail(error);
  },

  async deleteAnnouncements(ids) {
    if (!live) return local.set('items', demoItems().filter((x) => !ids.includes(x.id)));
    const { error } = await sb.from('announcements').delete().in('id', ids);
    fail(error);
  },

  onAnnouncementsChange(cb) {
    if (!live) return window.addEventListener('storage', (e) => { if (e.key === 'cici.items') cb(); });
    sb.channel('announcements-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => cb())
      .subscribe();
  },

  /* ---- sign-ups and saved items (per user) ---- */
  async mySignups() { return this._myIds('signups', 'reg'); },
  async mySaves() { return this._myIds('saves', 'saved'); },
  async toggleSignup(id, on) { return this._toggle('signups', 'reg', id, on); },
  async toggleSave(id, on) { return this._toggle('saves', 'saved', id, on); },

  async _myIds(table, key) {
    if (!live) return new Set(local.get(`${key}.${meCache?.id}`, []));
    const { data, error } = await sb.from(table).select('announcement_id').eq('user_id', meCache.id);
    fail(error);
    return new Set(data.map((r) => r.announcement_id));
  },
  async _toggle(table, key, id, on) {
    if (!live) { const k = `${key}.${meCache?.id}`; const s = new Set(local.get(k, [])); on ? s.add(id) : s.delete(id); return local.set(k, [...s]); }
    const { error } = on
      ? await sb.from(table).upsert({ user_id: meCache.id, announcement_id: id }, { onConflict: 'user_id,announcement_id', ignoreDuplicates: true })
      : await sb.from(table).delete().eq('user_id', meCache.id).eq('announcement_id', id);
    fail(error);
  },

  // Staff only: number of sign-ups per announcement id.
  async signupCounts() {
    const counts = new Map();
    if (!live) {
      demoItems().forEach((a) => counts.set(a.id, a.signups || 0));
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.startsWith('cici.reg.')) JSON.parse(localStorage.getItem(k)).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
        }
      } catch {}
      return counts;
    }
    const { data, error } = await sb.from('signups').select('announcement_id');
    fail(error);
    data.forEach((r) => counts.set(r.announcement_id, (counts.get(r.announcement_id) || 0) + 1));
    return counts;
  },

  /* ---- users (admin) ---- */
  async listProfiles() {
    if (!live) return demoUsers();
    const { data, error } = await sb.from('profiles').select('*').order('full_name');
    fail(error);
    return data.map(fromProfile);
  },

  async updateProfile(id, patch) {
    if (!live) { const all = demoUsers(); Object.assign(all.find((u) => u.id === id), patch); return local.set('demoUsers', all); }
    const row = {};
    if ('role' in patch) row.role = patch.role;
    if ('active' in patch) row.active = patch.active;
    if ('name' in patch) row.full_name = patch.name;
    if ('year' in patch) row.year_level = patch.year || null;
    const { data, error } = await sb.from('profiles').update(row).eq('id', id).select('id');
    fail(error);
    if (!data.length) throw new Error('You don’t have permission to change this user.');
  },

  // Change your own name / year level.
  async updateMyProfile(patch) {
    await this.updateProfile(meCache.id, patch);
    Object.assign(meCache, patch);
    return meCache;
  },

  // Staff only: who signed up for an announcement.
  async listSignups(announcementId) {
    if (!live) {
      const users = demoUsers(), out = [];
      users.forEach((u) => { if (local.get(`reg.${u.id}`, []).includes(announcementId)) out.push({ name: u.name, email: u.email, year: u.year || '', at: null }); });
      const sample = (demoItems().find((a) => a.id === announcementId) || {}).signups || 0;
      return { people: out, sample };
    }
    const { data, error } = await sb.from('signups')
      .select('created_at, profiles(full_name, email, year_level)')
      .eq('announcement_id', announcementId).order('created_at');
    fail(error);
    return { people: data.map((r) => ({ name: r.profiles?.full_name || '', email: r.profiles?.email || '', year: r.profiles?.year_level || '', at: Date.parse(r.created_at) })), sample: 0 };
  },

  /* ---- admin activity log ---- */
  async log(msg) {
    try {
      if (!live) { const l = local.get('adminLog', []); l.unshift({ t: Date.now(), msg: `${meCache?.name}: ${msg}` }); return local.set('adminLog', l.slice(0, 25)); }
      await sb.from('admin_log').insert({ message: msg, actor_name: meCache?.name || '' });
    } catch {}
  },
  async listLog() {
    if (!live) return local.get('adminLog', []);
    const { data, error } = await sb.from('admin_log').select('*').order('created_at', { ascending: false }).limit(25);
    fail(error);
    return data.map((r) => ({ t: Date.parse(r.created_at), msg: (r.actor_name ? r.actor_name + ': ' : '') + r.message }));
  },
  async clearLog() {
    if (!live) return local.set('adminLog', []);
    const { error } = await sb.from('admin_log').delete().gt('id', 0);
    fail(error);
  },

  resetDemo() {
    if (live) return;
    try { Object.keys(localStorage).filter((k) => k.startsWith('cici.') && k !== 'cici.session').forEach((k) => localStorage.removeItem(k)); } catch {}
  },
};
