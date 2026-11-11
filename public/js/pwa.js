// Makes the site installable as an app ("Add to Home Screen").
// Any element with data-install is shown when installing is possible and starts it when tapped.
(function () {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let promptEvent = null;

  const buttons = () => document.querySelectorAll('[data-install]');
  const showButtons = (show) => buttons().forEach((el) => { el.hidden = !show; });

  // Android / Chrome / Edge: the browser offers an install prompt we can trigger.
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptEvent = e; showButtons(true); });
  window.addEventListener('appinstalled', () => { promptEvent = null; showButtons(false); });

  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-install]')) return;
    if (promptEvent) {
      promptEvent.prompt();
      await promptEvent.userChoice;
      promptEvent = null;
      showButtons(false);
    } else if (isIOS) {
      alert('To install CICI: tap the Share button (square with an arrow), then "Add to Home Screen".');
    }
  });

  // iPhone / iPad Safari has no install prompt: show the button with instructions instead.
  document.addEventListener('DOMContentLoaded', () => showButtons(!standalone && isIOS));
})();
