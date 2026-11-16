// Full-screen photo viewer: openLightbox(urls, startIndex).
// Prev/next buttons, arrow keys, swipe on touch screens, Esc or ✕ to close.

let dlg = null, urls = [], index = 0, startX = null;

function build() {
  const style = document.createElement('style');
  style.textContent = `
    #lightbox { width: 100vw !important; height: 100dvh !important; max-width: none !important; max-height: none !important; margin: 0 !important; padding: 0 !important; border: 0; border-radius: 0 !important; background: rgba(8, 12, 24, .94); color: #fff; overflow: hidden; inset: 0; }
    #lightbox::backdrop { background: rgba(8, 12, 24, .94); }
    #lightbox::before { display: none !important; }
    #lightbox[open] { display: grid; grid-template-rows: auto 1fr auto; animation: none !important; }
    #lightbox .lb-top { display: flex; justify-content: space-between; align-items: center; padding: calc(10px + env(safe-area-inset-top)) 14px 10px; font-weight: 600; }
    #lightbox .lb-stage { position: relative; display: grid; place-items: center; min-height: 0; touch-action: pan-y; }
    #lightbox img { max-width: 100%; max-height: 100%; object-fit: contain; user-select: none; -webkit-user-drag: none; }
    #lightbox button { border: 0; background: rgba(255, 255, 255, .14); color: #fff; width: 48px; height: 48px; border-radius: 50%; font-size: 24px; line-height: 1; cursor: pointer; display: grid; place-items: center; }
    #lightbox button:hover { background: rgba(255, 255, 255, .26); }
    #lightbox .lb-prev, #lightbox .lb-next { position: absolute; top: 50%; transform: translateY(-50%); }
    #lightbox .lb-prev { left: 12px; } #lightbox .lb-next { right: 12px; }
    #lightbox .lb-thumbs { display: flex; gap: 6px; overflow-x: auto; padding: 10px 14px calc(12px + env(safe-area-inset-bottom)); justify-content: center; }
    #lightbox .lb-thumbs img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; opacity: .5; cursor: pointer; flex: none; border: 2px solid transparent; }
    #lightbox .lb-thumbs img.on { opacity: 1; border-color: #fff; }
    @media (max-width: 600px) { #lightbox .lb-prev, #lightbox .lb-next { width: 42px; height: 42px; } #lightbox .lb-thumbs { justify-content: flex-start; } }
  `;
  document.head.append(style);
  dlg = document.createElement('dialog');
  dlg.id = 'lightbox';
  dlg.setAttribute('aria-label', 'Photo viewer');
  dlg.innerHTML = `
    <div class="lb-top"><span class="lb-count" aria-live="polite"></span><button type="button" class="lb-close" aria-label="Close photo viewer">✕</button></div>
    <div class="lb-stage">
      <button type="button" class="lb-prev" aria-label="Previous photo">‹</button>
      <img alt="">
      <button type="button" class="lb-next" aria-label="Next photo">›</button>
    </div>
    <div class="lb-thumbs"></div>`;
  document.body.append(dlg);
  dlg.querySelector('.lb-close').addEventListener('click', () => dlg.close());
  dlg.querySelector('.lb-prev').addEventListener('click', () => show(index - 1));
  dlg.querySelector('.lb-next').addEventListener('click', () => show(index + 1));
  dlg.querySelector('.lb-thumbs').addEventListener('click', (e) => { const t = e.target.closest('[data-i]'); if (t) show(+t.dataset.i); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
  });
  const stage = dlg.querySelector('.lb-stage');
  stage.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX; startX = null;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
  });
  // Tap the dark area around the photo to close.
  stage.addEventListener('click', (e) => { if (e.target === stage) dlg.close(); });
}

function show(i) {
  if (!urls.length) return;
  index = (i + urls.length) % urls.length;
  const img = dlg.querySelector('.lb-stage img');
  img.src = urls[index];
  img.alt = `Photo ${index + 1} of ${urls.length}`;
  dlg.querySelector('.lb-count').textContent = `${index + 1} / ${urls.length}`;
  const many = urls.length > 1;
  dlg.querySelector('.lb-prev').hidden = !many;
  dlg.querySelector('.lb-next').hidden = !many;
  const thumbs = dlg.querySelector('.lb-thumbs');
  thumbs.hidden = !many;
  thumbs.querySelectorAll('img').forEach((t, j) => t.classList.toggle('on', j === index));
  const on = thumbs.querySelector('img.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
}

export function openLightbox(list, start = 0) {
  if (!list || !list.length) return;
  if (!dlg) build();
  urls = list.slice();
  dlg.querySelector('.lb-thumbs').innerHTML = urls.map((u, i) => `<img src="${u.replace(/"/g, '&quot;')}" alt="Photo ${i + 1}" data-i="${i}" loading="lazy">`).join('');
  if (!dlg.open) dlg.showModal();
  show(start);
}
