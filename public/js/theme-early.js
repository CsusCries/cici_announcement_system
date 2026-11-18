// Runs in <head>, before the page is drawn: applies the saved site colour, name, logo and
// banner text from this device's last visit, so custom branding doesn't flash the defaults.
// (js/site.js then fetches the latest content and updates the page.)
(function () {
  var DEFAULT = '#2563eb';

  // Shared with js/site.js: CSS that recolours the site from one main colour.
  window.ciciThemeCss = function (c) {
    var mix = function (pct, other) { return 'color-mix(in srgb, ' + c + ' ' + pct + '%, ' + other + ')'; };
    var css = '.mark.has-logo { background-color: #fff !important; background-position: center !important; background-size: contain !important; background-repeat: no-repeat !important; box-shadow: 0 0 0 1px var(--border) !important; border-radius: 12px !important; }';
    if (c === DEFAULT) return css;
    return css +
      ':root { --blue-600: ' + c + '; --blue: ' + mix(85, '#000') + '; --blue-d: ' + mix(55, '#000') + '; --blue-100: ' + mix(14, '#fff') + '; --blue-50: ' + mix(5, '#fff') + '; }' +
      '.hero, .brand { background: linear-gradient(110deg, ' + mix(80, '#000') + ', ' + c + ' 55%, ' + mix(65, '#fff') + ') !important; }' +
      '.side { background: linear-gradient(180deg, ' + mix(3, '#fff') + ', ' + mix(8, '#fff') + '); }' +
      '.nav button.on { box-shadow: 0 6px 16px ' + mix(25, 'transparent') + ' !important; }' +
      '.logo .mark:not(.has-logo) { background: radial-gradient(circle, #fff 0 22%, var(--blue) 23% 100%); box-shadow: 0 0 0 6px var(--blue-100) inset; }' +
      '.brand .mark:not(.has-logo) { background: radial-gradient(circle, var(--blue) 0 22%, #fff 23% 100%); }';
  };
  window.ciciThemeMeta = function (c) { return c === DEFAULT ? '#1d4ed8' : c; };

  var site = null;
  try { site = JSON.parse(localStorage.getItem('cici.siteCache') || 'null'); } catch (e) {}
  if (!site || typeof site !== 'object') return;
  var color = /^#[0-9a-f]{6}$/i.test(site.color || '') ? site.color.toLowerCase() : DEFAULT;

  // 1. Colour: right now, before anything is painted.
  var style = document.createElement('style');
  style.id = 'site-theme';
  style.textContent = window.ciciThemeCss(color);
  document.head.appendChild(style);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = window.ciciThemeMeta(color);

  // 2. Name, texts, logo and the first banner slide: as soon as the page's HTML is there.
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof site.name === 'string' && site.name) document.title = document.title.replace(/CICI/g, site.name);
    var els = document.querySelectorAll('[data-site]');
    for (var i = 0; i < els.length; i++) {
      var v = site[els[i].getAttribute('data-site')];
      if (typeof v === 'string') els[i].textContent = v;
    }
    if (site.logoUrl) {
      var marks = document.querySelectorAll('.mark');
      for (var j = 0; j < marks.length; j++) { marks[j].classList.add('has-logo'); marks[j].style.backgroundImage = 'url("' + site.logoUrl + '")'; }
    }
    var s0 = site.slides && site.slides[0];
    if (s0) {
      var set = function (id, text) { var el = document.getElementById(id); if (el && typeof text === 'string') el.textContent = text; };
      set('heroChip', s0.chip); set('heroTitle', s0.title); set('heroText', s0.text); set('heroCta', s0.cta);
    }
  });
})();
