(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const book = $('#book'), stage = $('#stage'), range = $('#range'), pnum = $('#pnum');
  const RATIO = 1191 / 1684, FLIP_MS = 650;
  let N = 487, DATA = null, TEXT = null, TEXTF = null;
  let cur = 1, mode = 'spread', busy = false, zoom = false, queued = null;

  const pad = n => String(n).padStart(3, '0');
  const src = n => `pages/${pad(n)}.webp`;
  const thumb = n => `pages/t${pad(n)}.webp`;

  // ---------- text folding (bỏ dấu, giữ nguyên độ dài để tô sáng) ----------
  const foldCh = c => c === 'đ' || c === 'Đ' ? 'd' : c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().charAt(0) || c;
  const foldMap = new Map();
  const fold = s => { let o = ''; for (const c of s) { let f = foldMap.get(c); if (f === undefined) { f = foldCh(c); foldMap.set(c, f); } o += f; } return o; };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- layout ----------
  function decideMode() {
    const w = stage.clientWidth, h = stage.clientHeight;
    mode = (w >= 900 && w / h > 1.05) ? 'spread' : 'single';
    const padX = mode === 'spread' ? 130 : (w < 760 ? 44 : 120), padY = 28;
    let ph, pw;
    if (mode === 'spread') { ph = Math.min(h - padY, (w - padX) / 2 / RATIO); }
    else { ph = Math.min(h - padY, (w - padX) / RATIO); }
    pw = ph * RATIO;
    document.documentElement.style.setProperty('--pw', pw.toFixed(1) + 'px');
    document.documentElement.style.setProperty('--ph', ph.toFixed(1) + 'px');
  }
  const spreadOf = p => {
    if (mode === 'single' || zoom) return [p];
    if (p <= 1) return [null, 1];
    const l = p % 2 === 0 ? p : p - 1;
    return [l, l + 1 <= N ? l + 1 : null];
  };
  const firstOf = p => { const s = spreadOf(p); return s.find(x => x) || p; };

  // ---------- page element ----------
  function pageEl(n, cls) {
    const d = document.createElement('div');
    d.className = 'page ' + cls + (n ? '' : ' empty');
    if (!n) return d;
    d.dataset.p = n;
    const img = new Image();
    img.decoding = 'async'; img.alt = `Trang ${n}`; img.src = src(n);
    img.draggable = false;
    d.appendChild(img);
    d.appendChild(hotLayer(n));
    return d;
  }
  function hotLayer(n) {
    const h = document.createElement('div'); h.className = 'hot';
    const L = DATA ? DATA.links[n - 1] : [];
    for (const k of L) {
      const a = document.createElement('a');
      a.style.cssText = `left:${k[0] * 100}%;top:${k[1] * 100}%;width:${k[2] * 100}%;height:${k[3] * 100}%`;
      if (typeof k[4] === 'number') {
        a.href = `#p=${k[4]}`; a.dataset.go = k[4]; if (k[5] != null) a.dataset.y = k[5];
        a.title = `Đến trang ${k[4]}`;
      } else {
        a.href = k[4]; a.target = '_blank'; a.rel = 'noopener';
        a.title = k[4].replace(/^mailto:/, '');
      }
      h.appendChild(a);
    }
    return h;
  }
  function addPulse(n, y) {
    if (y == null) return;
    const host = (zoom ? $(`#zoomwrap .zp[data-p="${n}"]`) : book.querySelector(`.page[data-p="${n}"]`));
    if (!host) return;
    const s = document.createElement('div'); s.className = 'pulse';
    s.style.top = Math.max(0, y * 100 - 1) + '%';
    host.appendChild(s); setTimeout(() => s.remove(), 2000);
  }

  // ---------- render ----------
  function render() {
    book.innerHTML = '';
    const s = spreadOf(cur);
    book.className = mode === 'single' ? 'single' : (s[0] == null ? 'cover' : (s[1] == null ? 'back' : ''));
    if (mode === 'single') book.appendChild(pageEl(s[0], 'r'));
    else { book.appendChild(pageEl(s[0], 'l')); book.appendChild(pageEl(s[1], 'r')); }
    afterMove();
  }
  function afterMove() {
    const s = spreadOf(cur).filter(Boolean);
    const lo = s[0], hi = s[s.length - 1];
    range.value = lo; range.style.setProperty('--fill', ((lo - 1) / (N - 1) * 100) + '%');
    pnum.value = lo === hi ? lo : `${lo}–${hi}`;
    $('#prev').disabled = lo <= 1; $('#next').disabled = hi >= N;
    const h = `#p=${lo}`; if (location.hash !== h) history.replaceState(null, '', h);
    updateWhere(lo);
    preload(hi + 1, hi + 2, lo - 1, lo - 2);
  }
  function preload(...ps) { for (const p of ps) if (p >= 1 && p <= N) { const i = new Image(); i.src = src(p); } }

  // ---------- navigation ----------
  function go(p, y, opts = {}) {
    p = Math.max(1, Math.min(N, p | 0));
    if (zoom) { cur = p; zoomTo(p, y); afterMove(); return; }
    const from = spreadOf(cur), to = spreadOf(p);
    if (from.join() === to.join()) { cur = p; afterMove(); addPulse(p, y); return; }
    if (busy) { queued = [p, y]; return; }
    const fwd = p > cur;
    cur = p;
    if (mode === 'spread' && !opts.instant && !matchMedia('(prefers-reduced-motion: reduce)').matches) flip(from, to, fwd, () => addPulse(p, y));
    else if (mode === 'single' && !opts.instant) slide(fwd, () => addPulse(p, y));
    else { render(); addPulse(p, y); }
  }
  const next = () => { const s = spreadOf(cur).filter(Boolean); go(s[s.length - 1] + 1); };
  const prev = () => { const s = spreadOf(cur).filter(Boolean); if (s[0] > 1) go(s[0] - 1); };

  function flip(from, to, fwd, done) {
    busy = true;
    const [fl, fr] = from, [tl, tr] = to;
    const leaf = document.createElement('div'); leaf.className = 'leaf';
    const face = (n) => { const d = document.createElement('div'); if (n) { const i = new Image(); i.src = src(n); i.alt = ''; d.appendChild(i); } return d; };
    const f = face(fwd ? fr : fl), b = face(fwd ? tl : tr);
    f.className = 'f'; b.className = 'b'; leaf.append(f, b);
    const L = book.querySelector('.page.l'), R = book.querySelector('.page.r');
    if (fwd) {
      leaf.style.left = 'var(--pw)'; leaf.style.transformOrigin = '0 50%';
      R.replaceWith(pageEl(tr, 'r'));
    } else {
      leaf.style.left = '0'; leaf.style.transformOrigin = '100% 50%';
      L.replaceWith(pageEl(tl, 'l'));
    }
    book.className = tl == null ? 'cover' : (tr == null ? 'back' : '');
    book.appendChild(leaf);
    const anim = leaf.animate(
      [{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${fwd ? -180 : 180}deg)` }],
      { duration: FLIP_MS, easing: 'cubic-bezier(.45,.05,.3,1)' });
    setTimeout(() => leaf.classList.add('mid'), FLIP_MS * 0.15);
    anim.onfinish = () => {
      if (fwd) book.querySelector('.page.l').replaceWith(pageEl(tl, 'l'));
      else book.querySelector('.page.r').replaceWith(pageEl(tr, 'r'));
      leaf.remove(); busy = false; afterMove(); done && done();
      if (queued) { const q = queued; queued = null; go(q[0], q[1]); }
    };
  }
  function slide(fwd, done) {
    busy = true;
    const old = book.firstElementChild;
    const nw = pageEl(cur, 'r');
    nw.style.transform = `translateX(${fwd ? 40 : -40}px)`; nw.style.opacity = '0';
    book.className = 'single'; book.appendChild(nw);
    requestAnimationFrame(() => {
      nw.style.transition = 'transform .28s ease, opacity .28s ease';
      if (old) { old.style.transition = 'opacity .2s ease'; old.style.opacity = '0'; }
      nw.style.transform = 'none'; nw.style.opacity = '1';
    });
    setTimeout(() => { old && old.remove(); nw.style.transition = ''; busy = false; afterMove(); done && done();
      if (queued) { const q = queued; queued = null; go(q[0], q[1]); } }, 300);
  }

  // ---------- zoom (cuộn dọc, trang to) ----------
  const zw = $('#zoomwrap');
  let zObs = null;
  function setZoom(on) {
    zoom = on; document.body.classList.toggle('zoom', on); zw.hidden = !on;
    $('#btnZoom').classList.toggle('on', on);
    $('#zoomIco').setAttribute('d', on ? 'M16 16l4.5 4.5M8 11h6' : 'M16 16l4.5 4.5M8 11h6M11 8v6');
    if (on) { buildZoom(); afterMove(); } else { zw.innerHTML = ''; render(); }
  }
  function buildZoom() {
    zw.innerHTML = '';
    if (zObs) zObs.disconnect();
    const io = new IntersectionObserver(es => {
      for (const e of es) if (e.isIntersecting) { const d = e.target; if (!d.firstChild) { const i = new Image(); i.loading = 'lazy'; i.src = src(+d.dataset.p); i.alt = `Trang ${d.dataset.p}`; d.append(i, hotLayer(+d.dataset.p)); } }
    }, { root: zw, rootMargin: '1200px 0px' });
    const frag = document.createDocumentFragment();
    for (let p = 1; p <= N; p++) { const d = document.createElement('div'); d.className = 'zp'; d.dataset.p = p; frag.appendChild(d); io.observe(d); }
    zw.appendChild(frag);
    zObs = { disconnect() { io.disconnect(); } };
    zoomTo(cur);
  }
  let zt = null;
  zw.addEventListener('scroll', () => { clearTimeout(zt); zt = setTimeout(() => {
    const first = zw.querySelector('.zp'); if (!first) return;
    const step = first.offsetHeight + 18, mid = zw.scrollTop + zw.clientHeight * 0.35 - first.offsetTop;
    const p = Math.max(1, Math.min(N, Math.floor(mid / step) + 1));
    if (p !== cur) { cur = p; afterMove(); }
  }, 80); }, { passive: true });
  function zoomTo(p, y) {
    const d = zw.querySelector(`.zp[data-p="${p}"]`); if (!d) return;
    const top = d.offsetTop + (y ? y * d.offsetHeight - 80 : -10);
    zw.scrollTop = top;
    setTimeout(() => addPulse(p, y), 250);
  }

  // ---------- where / toc ----------
  let flat = [];
  function updateWhere(p) {
    if (!DATA) return;
    let part = null, item = null, cls = null;
    for (const t of DATA.toc) { if (t.p <= p) { if (t.part) part = t; item = t; } }
    for (const t of DATA.toc) if (t.c) for (const [c, cp] of t.c) if (cp <= p) cls = c;
    const inClasses = item && item.c;
    const label = inClasses && cls ? `${item.t.replace(/\s*\(.*\)$/, '')} · <b>${cls}</b>` : (item ? `<b>${esc(item.t)}</b>` : '');
    $('#sec').innerHTML = label;
    document.querySelectorAll('.toc a.cur,.chip.cur').forEach(e => e.classList.remove('cur'));
    if (inClasses && cls) { const ch = document.querySelector(`.chip[data-c="${cls}"]`); ch && ch.classList.add('cur'); }
    else if (item) { const a = document.querySelector(`.toc a[data-i="${DATA.toc.indexOf(item)}"]`); a && a.classList.add('cur'); }
  }
  function buildToc() {
    const box = $('#tab-toc'); box.innerHTML = '';
    const wrap = document.createElement('nav'); wrap.className = 'toc';
    DATA.toc.forEach((t, i) => {
      const a = document.createElement('a');
      a.href = `#p=${t.p}`; a.dataset.go = t.p; a.dataset.i = i;
      a.className = (t.part ? 'part ' : '') + 'l' + t.l;
      a.innerHTML = `<span class="t">${esc(t.t)}</span><span class="n">${t.p}</span>`;
      wrap.appendChild(a);
      if (t.c) {
        const chips = document.createElement('div'); chips.className = 'chips';
        for (const [c, p] of t.c) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.go = p; b.dataset.c = c; b.textContent = c; b.title = `Lớp ${c} · trang ${p}`; chips.appendChild(b); }
        wrap.appendChild(chips);
      }
    });
    box.appendChild(wrap);
  }

  // ---------- drawer ----------
  const drawer = $('#drawer'), scrim = $('#scrim');
  function openDrawer(tab) {
    showTab(tab); drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); scrim.hidden = false;
    if (tab === 'search') setTimeout(() => $('#q').focus(), 120);
    else { const c = drawer.querySelector('.cur'); c && c.scrollIntoView({ block: 'center' }); }
  }
  function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); scrim.hidden = true; }
  function showTab(tab) {
    drawer.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $('#tab-toc').hidden = tab !== 'toc'; $('#tab-search').hidden = tab !== 'search';
  }

  // ---------- search ----------
  let PF = null;
  async function loadText() {
    if (TEXT) return;
    const r = await fetch('data/text.json'); TEXT = await r.json(); TEXTF = TEXT.map(fold);
  }
  function hl(orig, folded, q) {
    let out = '', i = 0, k;
    while ((k = folded.indexOf(q, i)) >= 0) { out += esc(orig.slice(i, k)) + '<mark>' + esc(orig.slice(k, k + q.length)) + '</mark>'; i = k + q.length; }
    return out + esc(orig.slice(i));
  }
  let sTimer = null, sLimit = 40;
  function search(raw) {
    const box = $('#results');
    const q = fold(raw.trim()).replace(/\s+/g, ' ');
    $('#shint').hidden = !!q;
    if (q.length < 2) { box.innerHTML = ''; return; }
    if (!PF) PF = DATA.people.map(r => fold(r[0] + ' ' + r[1]));
    const words = q.split(' ');
    const ppl = [];
    DATA.people.forEach((r, i) => {
      const f = PF[i];
      if (words.every(w => f.includes(w))) {
        const nf = fold(r[0]);
        const score = (nf === q ? 0 : nf.endsWith(q) ? 1 : nf.startsWith(q) ? 2 : fold(r[1]) === q ? 0 : 3);
        ppl.push([score, r]);
      }
    });
    ppl.sort((a, b) => a[0] - b[0] || a[1][1].localeCompare(b[1][1]));
    let html = '';
    if (ppl.length) {
      html += `<div class="rh">Người · ${ppl.length}</div>`;
      for (const [, r] of ppl.slice(0, sLimit)) {
        const prog = r[1].slice(4, 6), yr = r[1].slice(0, 4);
        const ini = r[0].split(' ').slice(-1)[0].charAt(0);
        html += `<button class="res" data-go="${r[2]}"><span class="av ${prog}">${esc(ini)}</span><span class="m"><span class="nm">${hl(r[0], fold(r[0]), words[words.length - 1] && fold(r[0]).includes(q) ? q : '\u0000')}</span><span class="sub"> ${r[1]} · ${r[3] ? 'thẻ thông tin' : 'danh sách lớp'}</span></span><span class="pg">tr. ${r[2]}</span></button>`;
      }
      if (ppl.length > sLimit) html += `<button class="more" data-more="1">Xem thêm ${ppl.length - sLimit} người…</button>`;
    }
    html += `<div class="rh" id="rtext">Trong nội dung sách</div><div id="rtextb"><div class="empty-r">Đang tìm…</div></div>`;
    box.innerHTML = html;
    loadText().then(() => {
      if (fold($('#q').value.trim()).replace(/\s+/g, ' ') !== q) return;
      const hits = [];
      for (let i = 0; i < N && hits.length < 60; i++) {
        const k = TEXTF[i].indexOf(q); if (k < 0) continue;
        const a = Math.max(0, k - 60), b = Math.min(TEXT[i].length, k + q.length + 90);
        hits.push(`<button class="res" data-go="${i + 1}"><span class="m"><span class="snip">${a ? '…' : ''}${hl(TEXT[i].slice(a, b), TEXTF[i].slice(a, b), q)}…</span></span><span class="pg">tr. ${i + 1}</span></button>`);
      }
      const tb = $('#rtextb'); if (!tb) return;
      $('#rtext').textContent = `Trong nội dung sách · ${hits.length >= 60 ? '60+' : hits.length} trang`;
      tb.innerHTML = hits.join('') || '<div class="empty-r">Không thấy cụm này trong nội dung.</div>';
    });
  }

  // ---------- slider preview ----------
  const peek = $('#peek');
  function showPeek(v) {
    peek.hidden = false;
    peek.querySelector('img').src = thumb(v);
    peek.querySelector('span').textContent = `Trang ${v}`;
    const r = range.getBoundingClientRect(), x = (v - 1) / (N - 1) * (r.width - 16) + 8;
    peek.style.left = Math.max(54, Math.min(r.width - 54, x)) + 'px';
  }

  // ---------- events ----------
  function onLinkClick(e) {
    const t = e.target.closest('[data-go]'); if (!t) return;
    e.preventDefault();
    if (t.dataset.more) return;
    const p = +t.dataset.go, y = t.dataset.y != null ? +t.dataset.y : null;
    if (drawer.contains(t)) closeDrawer();
    go(p, y);
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-more]')) { sLimit += 200; search($('#q').value); return; }
    onLinkClick(e);
  });
  $('#next').onclick = next; $('#prev').onclick = prev;
  $('#btnToc').onclick = () => drawer.classList.contains('open') && !$('#tab-toc').hidden ? closeDrawer() : openDrawer('toc');
  $('#btnSearch').onclick = () => openDrawer('search');
  $('#btnClose').onclick = closeDrawer; scrim.onclick = closeDrawer;
  drawer.querySelectorAll('.tabs button').forEach(b => b.onclick = () => openDrawer(b.dataset.tab));
  $('#btnZoom').onclick = () => setZoom(!zoom);
  $('#btnFull').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  $('#q').addEventListener('input', e => { clearTimeout(sTimer); sLimit = 40; sTimer = setTimeout(() => search(e.target.value), 140); });
  $('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { const f = $('#results .res'); f && f.click(); } });
  $('#goto').onsubmit = e => { e.preventDefault(); const v = parseInt(pnum.value, 10); if (v) go(v); pnum.blur(); };
  pnum.addEventListener('focus', () => pnum.select());
  range.addEventListener('input', () => { showPeek(+range.value); range.style.setProperty('--fill', ((range.value - 1) / (N - 1) * 100) + '%'); });
  range.addEventListener('change', () => { peek.hidden = true; go(+range.value, null, { instant: Math.abs(range.value - cur) > 2 && mode === 'single' }); });
  range.addEventListener('pointerup', () => peek.hidden = true);
  range.addEventListener('blur', () => peek.hidden = true);

  document.addEventListener('keydown', e => {
    if (e.target.matches('input')) { if (e.key === 'Escape') { e.target.blur(); closeDrawer(); } return; }
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !zoom)) { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === 'Home') go(1); else if (k === 'End') go(N);
    else if (k === '/' ) { e.preventDefault(); openDrawer('search'); }
    else if (k === 'm' || k === 'M') openDrawer('toc');
    else if (k === 'z' || k === 'Z') setZoom(!zoom);
    else if (k === 'f' || k === 'F') $('#btnFull').click();
    else if (k === 'Escape') { if (drawer.classList.contains('open')) closeDrawer(); else if (zoom) setZoom(false); }
  });

  // vuốt trên điện thoại
  let sx = null, sy = 0, st = 0;
  stage.addEventListener('pointerdown', e => { if (zoom || e.pointerType === 'mouse') return; sx = e.clientX; sy = e.clientY; st = Date.now(); });
  stage.addEventListener('pointerup', e => {
    if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - st < 700) dx < 0 ? next() : prev();
  });
  // nhấp mép trang để lật
  book.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const r = book.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    if (x > 0.82) next(); else if (x < 0.18) prev();
  });

  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const m = mode; decideMode(); if (!zoom) render(); }, 120); });
  window.addEventListener('hashchange', () => { const m = location.hash.match(/p=(\d+)/); if (m && +m[1] !== cur) go(+m[1]); });

  function toast(msg, ms = 4200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, ms); }

  // ---------- start ----------
  decideMode();
  const m0 = location.hash.match(/p=(\d+)/); cur = m0 ? Math.min(N, Math.max(1, +m0[1])) : 1;
  render();
  fetch('data/book.json').then(r => r.json()).then(d => {
    DATA = d; N = d.n; range.max = N; $('#ptot').textContent = '/ ' + N;
    buildToc(); render();
    let seen = false; try { seen = localStorage.getItem('ky30-hint') === '1'; localStorage.setItem('ky30-hint', '1'); } catch (e) {}
    if (!seen) toast(mode === 'spread' ? 'Dùng ← → hoặc bấm mép trang để lật. Bấm vào tên người hay tên lớp để nhảy đến thẻ thông tin.' : 'Vuốt ngang để lật trang. Chạm vào tên người hay tên lớp để nhảy đến thẻ thông tin.');
  });
})();
