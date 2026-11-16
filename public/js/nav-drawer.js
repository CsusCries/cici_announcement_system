// Portrait tablets: the sidebar menu becomes a drawer opened by a ☰ button (styles in css/mobile.css).
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const side = document.querySelector('.side');
    const nav = side && side.querySelector('.nav');
    if (!nav) return;
    nav.id = nav.id || 'nav';

    // The drawer shows the logo at the top, like the desktop sidebar.
    const logo = side.querySelector('.logo');
    if (logo) { const head = logo.cloneNode(true); head.classList.add('drawer-logo'); head.setAttribute('aria-hidden', 'true'); nav.prepend(head); }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-btn';
    btn.setAttribute('aria-controls', nav.id);
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    side.appendChild(btn);
    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    document.body.appendChild(backdrop);

    const isOpen = () => document.body.classList.contains('drawer-open');
    const set = (open) => {
      document.body.classList.toggle('drawer-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) { const first = nav.querySelector('button, a'); if (first) first.focus(); }
    };
    set(false);
    btn.addEventListener('click', () => set(!isOpen()));
    backdrop.addEventListener('click', () => set(false));
    nav.addEventListener('click', (e) => { if (e.target.closest('button, a')) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { set(false); btn.focus(); } });
    matchMedia('(min-width: 761px) and (max-width: 1100px)').addEventListener('change', () => set(false));
  });
})();
