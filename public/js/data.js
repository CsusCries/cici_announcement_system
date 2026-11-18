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

/* ---------------- images ---------------- */
const BUCKET = 'announcement-images';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Resize to fit maxSide and re-encode (WebP, or JPEG where WebP encoding isn't supported).
async function shrinkImage(file, maxSide, quality) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG or WebP).');
  if (file.size > 20 * 1024 * 1024) throw new Error('That image is over 20 MB. Please choose a smaller one.');
  let src;
  try { src = await createImageBitmap(file); }
  catch {
    src = await new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image format isn’t supported by your browser. Try a JPG or PNG.')); };
      img.src = url;
    });
  }
  const w0 = src.width, h0 = src.height, k = Math.min(1, maxSide / Math.max(w0, h0));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(w0 * k), height: Math.round(h0 * k) });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); // flatten transparency for JPEG
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if (src.close) src.close();
  const toBlob = (type) => new Promise((r) => canvas.toBlob(r, type, quality));
  let blob = await toBlob('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg');
  if (!blob) throw new Error('Couldn’t process that image.');
  return blob;
}
const blobToDataUrl = (blob) => new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(blob); });

// Roles: student, faculty (Faculty Admin), governor (Governor Admin), admin.
export const ROLES = {
  student:  { label: 'Student',        info: 'Sees announcements for their year level; can register, save and get reminders.' },
  governor: { label: 'Governor Admin', info: 'Student/organization governor: manages Events and Activities (not exams) and sees their sign-ups.' },
  faculty:  { label: 'Faculty Admin',  info: 'Manages all announcements, including exams and exam schedules, and sees sign-ups.' },
  admin:    { label: 'Admin',          info: 'Full access: everything above plus users, roles, passwords and site content.' },
};
export const isStaff = (u) => !!u && (u.role === 'admin' || u.role === 'faculty' || u.role === 'governor');
export const isAdmin = (u) => !!u && u.role === 'admin';
export const roleLabel = (r) => (ROLES[r] ? ROLES[r].label : r);
// Which announcement types a user may create, edit and delete (the database checks the same rule).
export const canManageType = (u, type) => !!u && (u.role === 'admin' || u.role === 'faculty' || (u.role === 'governor' && (type === 'event' || type === 'activity')));
export const initials = (name) => (name || '?').split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !w.endsWith('.')).map((w) => w[0].toUpperCase()).slice(0, 2).join('') || '?';

const base = () => location.origin + location.pathname.replace(/[^/]*$/, '');
// "Failed to fetch" means the browser couldn't reach Supabase at all: explain what to check.
export const OFFLINE_MSG = 'Can’t reach the server right now. Check your internet connection, or turn off any ad blocker or VPN for this site, then try again. If it keeps happening, an admin should check that the Supabase project isn’t paused.';
const isNetworkError = (m) => /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|err_name_not_resolved/i.test(m || '');
const fail = (error) => {
  if (!error) return;
  const m = error.message || String(error);
  throw new Error(isNetworkError(m) ? OFFLINE_MSG : m);
};

/* ---------------- mapping between DB rows and page objects ---------------- */
// Old posts stored one audience label; turn it into the year list used now.
const legacyYears = (aud) => (YEARS.includes(aud) ? [aud] : []);
const byPosition = (x, y) => (x.position ?? 0) - (y.position ?? 0) || (x.id ?? 0) - (y.id ?? 0);

const fromRow = (r) => {
  const photos = (r.announcement_photos || []).slice().sort(byPosition).map((p) => p.path);
  if (!photos.length && r.image_path) photos.push(r.image_path);
  return {
    id: r.id, type: r.type, title: r.title, date: r.date, end: r.end_date || undefined,
    where: r.location || '', body: r.body || '',
    years: Array.isArray(r.audience_years) ? r.audience_years : legacyYears(r.audience),
    staffOnly: r.staff_only ?? r.audience === 'Faculty',
    pinned: !!r.pinned, status: r.status, created: Date.parse(r.created_at),
    photos, image: photos[0] || '',
    schedules: (r.exam_schedules || []).slice().sort(byPosition).map((x) => ({
      subject: x.subject, date: x.exam_date, start: (x.start_time || '').slice(0, 5), end: (x.end_time || '').slice(0, 5), room: x.room || '',
    })),
  };
};
const toRow = (a) => {
  const map = { type: 'type', title: 'title', date: 'date', end: 'end_date', where: 'location', body: 'body', pinned: 'pinned', status: 'status', image: 'image_path', years: 'audience_years', staffOnly: 'staff_only' };
  const row = {};
  for (const [k, col] of Object.entries(map)) if (k in a) row[col] = (k === 'end' || k === 'image') ? (a[k] || null) : a[k];
  if ('years' in a || 'staffOnly' in a) row.audience = audienceLabel(a); // readable label, e.g. for exports
  return row;
};

// A database error that means migration 006 hasn't been run yet.
const NEEDS_006 = /exam_schedules|announcement_photos|audience_years|staff_only|admin_delete_user|relationship/i;
const failWith006 = (error) => {
  if (error && NEEDS_006.test(error.message || '')) throw new Error('The database needs an update: an admin must run supabase/migrations/006_targeting_roles_schedules_gallery.sql in Supabase.');
  fail(error);
};
const fromProfile = (p) => ({ id: p.id, email: p.email, name: p.full_name || p.email.split('@')[0], role: p.role || 'student', active: p.active !== false, year: p.year_level || '' }); // missing 'active' column counts as active

export const YEARS = ['1st year', '2nd year', '3rd year', '4th year'];
// Who sees an announcement (the database enforces the same rule):
// staff see everything; students see posts for all students plus posts that list their
// own year level; staff-only posts are hidden from students. No year set = general posts only.
export const visibleTo = (u, a) => {
  if (isStaff(u)) return true;
  if (a.staffOnly) return false;
  const ys = a.years || [];
  return ys.length === 0 || (!!u?.year && ys.includes(u.year));
};
export const audienceLabel = (a) => {
  if (a.staffOnly) return 'Staff only';
  const ys = (a.years || []).slice().sort();
  return ys.length === 0 ? 'All students' : ys.join(', ');
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
  { id: 'u6', name: 'Gov. R. Lim', email: 'governor@cici.edu', role: 'governor', active: true, year: '3rd year' },
  { id: 'u7', name: 'Rico Reyes', email: 'rico.reyes@student.cici.edu', role: 'student', active: true, year: '4th year' },
];
// Bring demo items saved by older versions up to the current shape.
const upgradeDemoItem = (a) => {
  if (!Array.isArray(a.years)) a.years = legacyYears(a.audience);
  if (a.staffOnly === undefined) a.staffOnly = a.audience === 'Faculty';
  if (!Array.isArray(a.photos)) a.photos = a.image ? [a.image] : [];
  if (!Array.isArray(a.schedules)) a.schedules = [];
  a.image = a.photos[0] || '';
  return a;
};
const demoItems = () => { const v = local.get('items', null) || clone(DEMO_ITEMS); const out = v.map(upgradeDemoItem); if (!local.get('items', null)) local.set('items', out); return out; };
const demoUsers = () => { const v = local.get('demoUsers', null); if (v) return v; local.set('demoUsers', clone(DEMO_USERS)); return clone(DEMO_USERS); };
const demoMe = () => { const s = local.get('session', null); return s && demoUsers().find((u) => u.id === s.id) || null; };

const ALREADY_REGISTERED = 'This email already has an account, and its password was NOT changed. Sign in with your original password, or use “Forgot password?”.';

/* ---------------- session cache ---------------- */
let meCache = null;

export const api = {
  live,

  /* ---- auth ---- */
  async currentUser() {
    if (!live) return (meCache = demoMe());
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return (meCache = null);
    let res;
    try { res = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle(); }
    catch (e) { fail(e); }
    const { data, error } = res;
    fail(error);
    if (!data) throw new Error('Your account isn’t fully set up yet (no profile). Please ask an administrator to fix your account.');
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
    email = email.trim().toLowerCase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      // Turn Supabase's messages into ones people can act on.
      const m = (error.message || '').toLowerCase();
      if (m.includes('not confirmed')) {
        const e = new Error('Your email isn’t confirmed yet. Open the confirmation link we emailed you (check spam too), or tap “Resend confirmation email” below.');
        e.code = 'email_not_confirmed';
        throw e;
      }
      if (m.includes('invalid login credentials')) throw new Error('Wrong email or password. If you forgot your password, use “Forgot password?”.');
      fail(error); // includes the "can't reach the server" message for network failures
    }
    let me = null;
    try { me = await this.currentUser(); }
    catch (e) { await this.signOut(); throw e; }  // don't leave a half-signed-in session behind
    if (!me) { await this.signOut(); throw new Error('Sign-in failed. Please try again.'); }
    if (!me.active) { await this.signOut(); throw new Error('This account is suspended. Contact an administrator.'); }
  },

  async resendConfirmation(email) {
    if (!live) throw new Error('Not needed in demo mode.');
    const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: base() + 'login.html' } });
    fail(error);
  },

  async signUp(name, email, password, year) {
    if (!String(name || '').trim()) throw new Error('Please enter your full name.');
    if (!YEARS.includes(year)) throw new Error('Please choose your year level.');
    if (!live) {
      const users = demoUsers();
      if (users.some((x) => x.email === email.toLowerCase())) throw new Error('That email already has an account.');
      const u = { id: 'u' + Date.now(), name, email: email.toLowerCase(), role: 'student', active: true, year };
      users.push(u); local.set('demoUsers', users); local.set('session', { id: u.id });
      return { needsConfirm: false };
    }
    email = email.trim().toLowerCase();
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name, year_level: year }, emailRedirectTo: base() + 'login.html' } });
    if (error && /already (been )?registered|already exists/i.test(error.message)) throw new Error(ALREADY_REGISTERED);
    if (error && /database error saving new user/i.test(error.message)) throw new Error('Your account couldn’t be created: full name and year level are required. Please check the form and try again.');
    fail(error);
    // Supabase answers "success" for an email that already has an account (to hide which
    // emails exist) but keeps the OLD password; it marks this with an empty identities list.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error(ALREADY_REGISTERED);
    return { needsConfirm: !data.session };
  },

  async signOut() {
    meCache = null;
    if (!live) return local.del('session');
    await sb.auth.signOut();
  },

  async resetPassword(email) {
    if (!live) throw new Error('Password reset needs Supabase. In demo mode no password is checked.');
    // ?reset=1 tells the sign-in page to open the "choose a new password" form.
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: base() + 'login.html?reset=1' });
    fail(error);
  },

  async updatePassword(password) {
    if (!live) throw new Error('Passwords need Supabase. In demo mode no password is checked.');
    const { error } = await sb.auth.updateUser({ password });
    fail(error);
  },

  onRecovery(cb) { if (live) sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') cb(); }); },

  // After opening a reset link: is there a session that allows setting a new password?
  async hasRecoverySession() {
    if (!live) return false;
    const { data } = await sb.auth.getSession(); // also finishes reading the link's token from the URL
    return !!data.session;
  },

  // Admins: give a user a new temporary password (no email needed). Checked again in the database.
  async adminResetPassword(userId, newPassword) {
    if (!live) return; // demo mode doesn't check passwords
    const { error } = await sb.rpc('admin_set_password', { target: userId, new_password: newPassword });
    fail(error);
  },

  /* ---- announcements ---- */
  async listAnnouncements() {
    if (!live) { const all = demoItems(); return isStaff(meCache) ? all : all.filter((a) => a.status !== 'draft' && visibleTo(meCache, a)); }
    // The database only returns what this user may see (year level, staff-only, drafts).
    let { data, error } = await sb.from('announcements').select('*, exam_schedules(*), announcement_photos(*)').order('date');
    if (error && NEEDS_006.test(error.message || '')) ({ data, error } = await sb.from('announcements').select('*').order('date')); // before migration 006
    fail(error);
    return data.map(fromRow);
  },

  // a.schedules (exam schedule rows) and a.photos (storage paths, first = cover) are optional;
  // when given they replace the announcement's current ones.
  async saveAnnouncement(a) {
    const { schedules, photos, ...core } = a;
    if (photos) core.image = photos[0] || '';
    if (!live) {
      const all = demoItems();
      let out;
      if (a.id) { out = Object.assign(all.find((x) => x.id === a.id), core); if (!core.end) delete out.end; }
      else { out = { ...core, id: Math.max(0, ...all.map((x) => x.id)) + 1, signups: 0, created: Date.now(), schedules: [], photos: [] }; if (!out.end) delete out.end; all.push(out); }
      if (schedules) out.schedules = clone(schedules);
      if (photos) out.photos = photos.slice();
      local.set('items', all); return clone(out);
    }
    const row = toRow(core);
    const q = a.id ? sb.from('announcements').update(row).eq('id', a.id) : sb.from('announcements').insert(row);
    const { data, error } = await q.select().single();
    failWith006(error);
    const saved = Array.isArray(data) ? data[0] : data;
    const id = a.id || (saved && saved.id);
    if (!id) throw new Error('The announcement was saved, but its schedules and photos could not be linked. Please refresh and try again.');
    if (schedules) {
      const del = await sb.from('exam_schedules').delete().eq('announcement_id', id);
      failWith006(del.error);
      if (schedules.length) {
        const ins = await sb.from('exam_schedules').insert(schedules.map((x, i) => ({
          announcement_id: id, subject: x.subject, exam_date: x.date,
          start_time: x.start || null, end_time: x.end || null, room: x.room || '', position: i,
        })));
        failWith006(ins.error);
      }
    }
    if (photos) {
      const del = await sb.from('announcement_photos').delete().eq('announcement_id', id);
      failWith006(del.error);
      if (photos.length) {
        const ins = await sb.from('announcement_photos').insert(photos.map((path, i) => ({ announcement_id: id, path, position: i })));
        failWith006(ins.error);
      }
    }
    return { ...fromRow({ ...saved, id }), schedules: schedules ? clone(schedules) : [], photos: photos ? photos.slice() : [] };
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

  /* ---- editable site content (name, logo, colour, banner, footer) ---- */
  // Readable by everyone, including the sign-in page before login.
  async getSiteContent() {
    if (!live) return local.get('siteContent', {});
    const { data, error } = await sb.from('site_settings').select('content').eq('id', 1).maybeSingle();
    fail(error);
    return (data && data.content) || {};
  },

  // Admins only (enforced by the database).
  async saveSiteContent(content) {
    if (!live) return local.set('siteContent', content);
    const { data, error } = await sb.from('site_settings').update({ content }).eq('id', 1).select('id');
    fail(error);
    if (!data.length) throw new Error('Only admins can change the site content. (If you are an admin, run migration 004 in Supabase.)');
  },

  /* ---- photos ---- */
  // Returns a resized Blob ready to upload (call when the user picks a file, to show errors early).
  prepareImage(file) { return live ? shrinkImage(file, 1600, 0.82) : shrinkImage(file, 900, 0.72); },

  // Uploads a prepared image and returns the value to store in announcement.image.
  async uploadImage(blob) {
    if (!IMAGE_TYPES.includes(blob.type)) throw new Error('Unsupported image type.');
    if (!live) return blobToDataUrl(blob); // demo: kept inline in localStorage
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const id = (crypto.randomUUID && crypto.randomUUID()) || Date.now().toString(36) + Math.random().toString(36).slice(2);
    const path = `${new Date().getFullYear()}/${id}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (error && /bucket not found/i.test(error.message)) throw new Error('Photo storage isn’t set up yet. An admin needs to run supabase/migrations/003_photos.sql in Supabase.');
    if (error && /row-level security|unauthorized|not allowed/i.test(error.message)) throw new Error('You don’t have permission to upload photos (admins and faculty only), or the photo storage rules are missing (run migration 003).');
    fail(error);
    return path;
  },

  // Best effort: removing an unused photo should never block the main action.
  async deleteImage(path) {
    if (!live || !path || path.startsWith('data:')) return;
    try { await sb.storage.from(BUCKET).remove([path]); } catch {}
  },

  imageUrl(path) {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('https://')) return path;
    return live ? sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : '';
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

  // Admins: delete a user account (database function; not yourself).
  async adminDeleteUser(id) {
    if (!live) {
      if (id === meCache?.id) throw new Error('You cannot delete your own account');
      local.set('demoUsers', demoUsers().filter((u) => u.id !== id)); local.del('reg.' + id); local.del('saved.' + id);
      return;
    }
    const { error } = await sb.rpc('admin_delete_user', { target: id });
    failWith006(error);
  },

  // Change your own name / year level.
  async updateMyProfile(patch) {
    if ('year' in patch && meCache.year && patch.year !== meCache.year && !isAdmin(meCache)) throw new Error('Only an admin can change your year level.');
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
