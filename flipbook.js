/* Флипбук для PDF (нейтральная тема, шрифт наследуется со страницы). Вставка: <div data-flipbook="https://…/guide.pdf"></div><script src="flipbook.js"></script>
   Необязательно:
     data-height="calc(100vh - 100px)"  — высота области со страницами (по умолчанию читалка занимает почти весь экран)
     data-title="Название"              — подпись и имя книги в отчётах
     data-book="crm"                    — короткий id книги для аналитики (по умолчанию — имя PDF-файла)
     data-view="spread"                 — сразу открывать разворотом
     data-start="5"                     — стартовая страница
   Оглавление берётся из PDF автоматически.
   Аналитика: window.FlipbookAnalytics = { ym: 'auto' | <номер счётчика>, gtag, dataLayer, endpoint, dwell, milestones } — ставить ДО скрипта.
   Все события также летят в window как CustomEvent 'flipbook:track' (detail = данные события). */
(function () {
  if (window.Flipbook) return;
  var V = '4.4.168', B = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + V + '/build/';
  var lib;
  function pdfjs() { return lib || (lib = import(B + 'pdf.min.mjs').then(function (m) { m.GlobalWorkerOptions.workerSrc = B + 'pdf.worker.min.mjs'; return m; })); }
  var T0 = window.FlipbookTheme || {};
  /* нейтральная тема по умолчанию: серые без оттенка, шрифт берётся со страницы */
  var INK = T0.ink || '#1a1a1a', RULE = T0.rule || '#d9d9d9', MUTED = T0.muted || '#808080', DESK = T0.desk || '#f2f2f2', ACC = T0.accent || INK, CHIP = T0.chip || '#ececec', LINE = T0.line || '#ececec', HOVER = T0.hover || '#f5f5f5', BG = T0.bg || '#fff';
  var UI = T0.font || '', MONO = T0.mono || '', RAD = T0.radius || '16px';
  var DEFAULT_H = 'min(1100px, max(520px, calc(100vh - 120px)))';
  var st = document.createElement('style');
  st.textContent = [
    '.fb-r{-webkit-appearance:none;appearance:none;width:100%;height:20px;background:transparent;margin:0;cursor:pointer}',
    '.fb-r::-webkit-slider-runnable-track{height:3px;background:linear-gradient(to right,' + ACC + ' var(--p,0%),' + RULE + ' var(--p,0%))}',
    '.fb-r::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:' + INK + ';margin-top:-5.5px;border:2px solid #fff;box-shadow:0 0 0 1px ' + RULE + '}',
    '.fb-r::-moz-range-track{height:3px;background:' + RULE + '}.fb-r::-moz-range-progress{height:3px;background:' + ACC + '}',
    '.fb-r::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:' + INK + ';border:2px solid #fff}',
    '.fb-b{transition:background .15s,color .15s,border-color .15s}.fb-b:hover:not(:disabled){background:' + INK + '!important;color:#fff!important;border-color:' + INK + '!important}',
    '.fb-b:disabled{opacity:.35;cursor:default}.fb-dl:hover{opacity:.85}',
    '.fb-c:hover{background:' + HOVER + '!important}',
    '.fb-s::-webkit-scrollbar{width:8px;height:8px}.fb-s::-webkit-scrollbar-thumb{background:#c6c6c6}.fb-s::-webkit-scrollbar-track{background:transparent}'
  ].join('');
  document.head.appendChild(st);

  function h(tag, css, attrs, kids) {
    var e = document.createElement(tag);
    if (css) Object.assign(e.style, css);
    if (attrs) for (var k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function btn(label, extra, attrs) {
    return h('button', Object.assign({ height: '30px', minWidth: '30px', padding: '0 12px', border: 0, borderRadius: '999px', background: CHIP, color: INK, font: '600 12px/1 ' + UI, letterSpacing: '-.01em', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }, extra || {}), Object.assign({ class: 'fb-b', type: 'button', text: label }, attrs || {}));
  }
  function clean(t) {
    return t.replace(/\s+/g, ' ').replace(/ ([,.:;!?»)])/g, '$1').replace(/([«(]) /g, '$1').replace(/ - /g, '-').replace(/(\S)- (\S)/g, '$1-$2').trim();
  }

  /* ---------- аналитика: общая отправка ---------- */
  var SID = Math.random().toString(36).slice(2, 10);
  var VID = (function () { try { var v = localStorage.getItem('fb_vid'); if (!v) { v = Math.random().toString(36).slice(2, 12); localStorage.setItem('fb_vid', v); } return v; } catch (e) { return ''; } })();
  var ymOnce = {};
  function cfg() { return window.FlipbookAnalytics || {}; }
  function ymId(A) {
    if (A.ym && A.ym !== 'auto') return A.ym;
    try { var c = window.Ya && window.Ya.Metrika2 && window.Ya.Metrika2.counters(); if (c && c[0]) return c[0].id; } catch (e) {}
    return 0;
  }
  function timeBucket(s) { return s < 30 ? '1 · до 30 сек' : s < 120 ? '2 · 30 сек – 2 мин' : s < 300 ? '3 · 2–5 мин' : s < 900 ? '4 · 5–15 мин' : '5 · больше 15 мин'; }
  function covBucket(p) { return p < 10 ? '1 · до 10%' : p < 25 ? '2 · 10–25%' : p < 50 ? '3 · 25–50%' : p < 75 ? '4 · 50–75%' : '5 · 75–100%'; }

  /* Яндекс Метрика: цели fb_view, fb_start, fb_25…fb_100, fb_download + параметры визитов в ветке «flipbook» */
  function toYm(d, tries) {
    var A = cfg(); if (!A.ym) return;
    var id = ymId(A);
    if (!id || typeof window.ym !== 'function') { if ((tries || 0) < 400) setTimeout(function () { toYm(d, (tries || 0) + 1); }, 1500); return; }
    var leaf = {}, goal = '';
    switch (d.type) {
      case 'view': goal = 'fb_view'; leaf['Воронка'] = '0 · увидели читалку'; break;
      case 'start': goal = 'fb_start'; leaf['Воронка'] = '1 · начали листать'; break;
      case 'progress': goal = 'fb_' + d.pct; leaf['Воронка'] = d.step + ' · дошли до ' + d.pct + '%'; break;
      case 'chapter': leaf['Главы'] = d.chapter; break;
      case 'toc': leaf['Действия'] = 'переход по оглавлению'; break;
      case 'download': goal = 'fb_download'; leaf['Действия'] = 'скачали PDF'; break;
      case 'fullscreen': leaf['Действия'] = 'полный экран'; break;
      case 'summary':
        if (ymOnce[d.book]) return; ymOnce[d.book] = 1;
        leaf['Время в читалке'] = timeBucket(d.seconds);
        leaf['Охват страниц'] = covBucket(d.coverage);
        break;
      default: return;
    }
    var p = {}; p[d.title] = leaf;
    try { if (goal) window.ym(id, 'reachGoal', goal, { flipbook: p }); else window.ym(id, 'params', { flipbook: p }); } catch (e) {}
  }

  function send(d) {
    var A = cfg();
    try { window.dispatchEvent(new CustomEvent('flipbook:track', { detail: d })); } catch (e) {}
    toYm(d);
    if (A.gtag && typeof window.gtag === 'function') {
      try { window.gtag('event', 'flipbook_' + d.type, { book: d.book, page: d.page, total: d.total, percent: d.pct, chapter: d.chapter, seconds: d.seconds, coverage: d.coverage }); } catch (e) {}
    }
    if (A.dataLayer) {
      var o = { event: 'flipbook_' + d.type }; for (var k in d) o['fb_' + k] = d[k];
      (window.dataLayer = window.dataLayer || []).push(o);
    }
    if (A.endpoint) {
      var body = JSON.stringify(Object.assign({ sid: SID, vid: VID, url: location.href, ts: new Date().toISOString() }, d));
      try { if (!(navigator.sendBeacon && navigator.sendBeacon(A.endpoint, body))) fetch(A.endpoint, { method: 'POST', body: body, mode: 'no-cors', keepalive: true }); } catch (e) {}
    }
  }

  var instances = [];

  function mount(root) {
    var url = root.getAttribute('data-flipbook');
    if (!url) return;
    if (root.__fb) { if (root.__fb.url === url) return; root.__fb.destroy(); }
    var S = { view: root.getAttribute('data-view') === 'spread' ? 'spread' : 'page', url: url, doc: null, total: 0, ratio: 0.707, cur: 1, zoom: 1, cols: 1, pageW: 400, pageH: 566, busy: false, chapters: [], mobile: false, full: false, dead: false };
    root.__fb = S; instances.push(S);
    var baseH = root.getAttribute('data-height') || DEFAULT_H;
    var pageFont = (getComputedStyle(root.parentNode || root).fontFamily || '') + ',Arial,sans-serif';
    if (!T0.font) UI = pageFont;
    if (!T0.mono) MONO = UI;
    root.innerHTML = '';
    Object.assign(root.style, { position: 'relative', display: 'flex', flexDirection: 'column', background: BG, border: 0, borderRadius: RAD, overflow: 'hidden', fontFamily: UI, color: INK, userSelect: 'none' });

    /* ---------- аналитика: состояние книги ---------- */
    var A = cfg();
    var book = root.getAttribute('data-book') || decodeURIComponent(url.split('?')[0].split('/').pop()).replace(/\.pdf$/i, '') || 'book';
    var MS = A.milestones || [25, 50, 75, 100];
    var DWELL = A.dwell || 2000;
    var T = { seen: {}, n: 0, max: 0, ms: {}, ch: {}, started: false, inView: false, viewed: false, secs: 0, last: 0, dt: 0, snap: '' };

    function emit(type, extra) {
      send(Object.assign({ type: type, book: book, title: root.getAttribute('data-title') || book, page: T.max || S.cur, total: S.total }, extra || {}));
    }
    function interact() { T.last = Date.now(); if (!T.started) { T.started = true; emit('start'); seenCheck(); } }
    function chapterAt(p) { var c = null; S.chapters.forEach(function (x) { if (x.p <= p) c = x; }); return c; }
    function chLabel(c) { return (c.n ? c.n + ' · ' : '') + c.t; }
    /* страница считается просмотренной, если провисела на экране DWELL мс, пока читалка видна и вкладка активна */
    function seenCheck() {
      clearTimeout(T.dt);
      if (!S.doc || !T.inView || document.hidden) return;
      var vis = visible(), key = vis.join(',');
      T.dt = setTimeout(function () {
        if (S.dead || !T.inView || document.hidden || visible().join(',') !== key) return;
        vis.forEach(function (p) {
          if (!T.seen[p]) { T.seen[p] = 1; T.n++; if (T.started) emit('page', { page: p }); }
          if (p > T.max) T.max = p;
        });
        if (!T.started) return;
        var pct = T.max / S.total * 100;
        MS.forEach(function (m, i) { if (pct >= m && !T.ms[m]) { T.ms[m] = 1; emit('progress', { pct: m, step: i + 2 }); } });
        var c = chapterAt(vis[vis.length - 1]);
        if (c && !T.ch[c.p]) { T.ch[c.p] = 1; emit('chapter', { chapter: chLabel(c), chapterPage: c.p }); }
      }, DWELL);
    }
    function summary() {
      if (!T.started || !S.total) return;
      var snap = T.n + ':' + T.secs; if (snap === T.snap) return; T.snap = snap;
      emit('summary', { page: T.max, reached: Math.round(T.max / S.total * 100), pages: T.n, coverage: Math.round(T.n / S.total * 100), seconds: T.secs });
    }
    /* активное время: читалка на экране, вкладка открыта, было действие за последние 90 сек */
    var tick = setInterval(function () { if (T.started && T.inView && !document.hidden && Date.now() - T.last < 90000) T.secs++; }, 1000);
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      var e = es[es.length - 1];
      var share = e.isIntersecting ? e.intersectionRect.height / Math.max(1, Math.min(e.boundingClientRect.height, window.innerHeight)) : 0;
      T.inView = share >= 0.3;
      if (T.inView && !T.viewed) { T.viewed = true; emit('view'); }
      seenCheck();
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1] }) : null;
    if (io) io.observe(root); else T.inView = true;
    var onVis = function () { if (document.hidden) summary(); else seenCheck(); };
    var onHide = function () { summary(); };
    var onAct = function () { if (T.started) T.last = Date.now(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    root.addEventListener('mousemove', onAct, { passive: true });
    root.addEventListener('wheel', onAct, { passive: true });
    root.addEventListener('touchstart', onAct, { passive: true });

    /* toolbar */
    var chBtn = btn('', { flex: '1 1 auto', minWidth: 0, justifyContent: 'flex-start', gap: '8px', padding: '0 12px 0 14px' }, { title: 'Содержание' });
    var chNow = h('div', { display: 'none' });
    var chNum = h('span', { font: '500 10.5px/1 ' + MONO, color: MUTED, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' });
    var chTitle = h('span', { fontSize: '12.5px', fontWeight: 600, letterSpacing: '-.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
    chTitle.style.flex = '1 1 auto'; chTitle.style.minWidth = 0; chTitle.style.textAlign = 'left';
    chBtn.appendChild(chNum); chBtn.appendChild(chTitle); chBtn.appendChild(h('span', { fontSize: '9px', color: MUTED, flex: '0 0 auto' }, { text: '▾' }));
    var prevB = btn('←', { padding: 0, width: '30px' }, { 'aria-label': 'Назад' });
    var nextB = btn('→', { padding: 0, width: '30px' }, { 'aria-label': 'Вперёд' });
    var counter = h('span', { font: '600 12px/1 ' + UI, minWidth: '58px', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: INK }, { text: '— / —' });
    var zOut = btn('−', { padding: 0, width: '30px' }, { 'aria-label': 'Уменьшить' });
    var zLbl = h('span', { font: '500 11.5px/1 ' + UI, minWidth: '38px', textAlign: 'center', color: MUTED }, { text: '100%' });
    var zIn = btn('+', { padding: 0, width: '30px' }, { 'aria-label': 'Увеличить' });
    var zoomG = h('div', { display: 'flex', alignItems: 'center', gap: '4px' }, null, [zOut, zLbl, zIn]);
    var viewB = btn('Разворот', null, { title: 'Режим просмотра' });
    var fsB = btn('⤢', { padding: 0, width: '30px' }, { 'aria-label': 'На весь экран', title: 'На весь экран' });
    var dl = h('a', { height: '30px', width: '30px', justifyContent: 'center', padding: 0, display: 'inline-flex', alignItems: 'center', borderRadius: '999px', background: INK, color: '#fff', font: '600 12px/1 ' + UI, letterSpacing: '-.01em', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'background .15s' }, { class: 'fb-dl', title: 'Скачать PDF', 'aria-label': 'Скачать PDF', href: url, download: '', target: '_blank', rel: 'noopener', text: '↓' });

    var bar = h('div', { position: 'relative', zIndex: 4, display: 'flex', alignItems: 'center', padding: '8px', borderBottom: '1px solid ' + LINE, background: BG, flexWrap: 'nowrap', gap: '6px' }, null, [chBtn, zoomG, viewB, fsB, dl]);

    /* chapters dropdown */
    var menu = h('div', { position: 'absolute', left: '12px', top: '50px', width: 'min(400px, calc(100% - 28px))', maxHeight: '62vh', overflowY: 'auto', overflowX: 'hidden', background: BG, border: 0, borderRadius: '18px', boxShadow: '0 30px 60px -30px rgba(20,19,23,.45)', zIndex: 10, display: 'none' }, { class: 'fb-s' });

    /* viewport */
    var vp = h('div', { position: 'relative', height: baseH, overflow: 'auto', background: DESK, display: 'flex', outline: 'none' }, { class: 'fb-s', tabindex: '0' });
    var stage = h('div', { position: 'relative', margin: 'auto', flex: '0 0 auto', perspective: '2800px' });
    vp.appendChild(stage);
    var loader = h('div', { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: '500 11px/1.6 ' + MONO, letterSpacing: '.08em', textTransform: 'uppercase', color: MUTED, textAlign: 'center', padding: '20px' }, { text: 'Загружаем гайд…' });
    vp.appendChild(loader);

    function slot() {
      var s = h('div', { position: 'absolute', top: 0, background: '#fff', overflow: 'hidden', borderRadius: '4px', transition: 'left .45s cubic-bezier(.4,.1,.25,1)' });
      s.cv = h('canvas', { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' });
      s.ly = h('div', { position: 'absolute', inset: 0 });
      s.appendChild(s.cv); s.appendChild(s.ly); s.n = 0;
      return s;
    }
    var L = slot(), R = slot();
    var spine = h('div', { position: 'absolute', top: 0, bottom: 0, left: '50%', width: '48px', transform: 'translateX(-50%)', background: 'linear-gradient(90deg,transparent,rgba(20,19,23,.07) 42%,rgba(20,19,23,.16) 50%,rgba(20,19,23,.07) 58%,transparent)', pointerEvents: 'none', zIndex: 3 });
    stage.appendChild(L); stage.appendChild(R); stage.appendChild(spine);

    /* bottom scrubber */
    var range = h('input', { flex: '1 1 auto', minWidth: 0, accentColor: INK }, { type: 'range', min: '1', max: '1', value: '1', class: 'fb-r', 'aria-label': 'Страница' });
    var foot = h('div', { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderTop: '1px solid ' + LINE, background: BG }, { title: 'Листать: ← → на клавиатуре или клик по странице' }, [prevB, range, counter, nextB]);

    root.appendChild(bar); root.appendChild(menu); root.appendChild(vp); root.appendChild(foot);

    var cache = new Map(), links = new Map(), pend = new Map(), renderedW = 0;

    function pagesFor(p) {
      if (S.cols === 1) return [0, p];
      if (p <= 1) return [0, 1];
      var l = p - (p % 2);
      return [l, l + 1 <= S.total ? l + 1 : 0];
    }
    function visible() { return pagesFor(S.cur).filter(Boolean); }

    function layout() {
      if (!S.doc) return;
      var W = vp.clientWidth, H = vp.clientHeight;
      if (!W) return;
      S.mobile = window.innerWidth < 640;
      zoomG.style.display = S.mobile || W < 420 ? 'none' : 'flex';
      chNow.style.display = W < 520 ? 'none' : 'flex';

      var canSpread = W >= 600 && !S.mobile;
      viewB.style.display = canSpread && (S.full || W >= 520) ? 'inline-flex' : 'none';
      viewB.textContent = S.view === 'spread' ? 'Страница' : 'Разворот';
      S.cols = canSpread && S.view === 'spread' && S.zoom <= 1 ? 2 : 1;
      var pad = S.mobile ? 6 : S.full ? 20 : 10;
      var fitW = (W - pad * 2) / S.cols, fitH = (H - pad * 2) * S.ratio;
      var base = S.mobile && !S.full ? fitW : Math.min(fitW, fitH);
      S.pageW = Math.floor(base * S.zoom);
      S.pageH = Math.floor(S.pageW / S.ratio);
      if (S.mobile && !S.full && S.zoom === 1) vp.style.height = (S.pageH + pad * 2) + 'px';
      Object.assign(stage.style, { width: S.pageW * S.cols + 'px', height: S.pageH + 'px', margin: pad + 'px auto' });
      Object.assign(L.style, { left: 0, width: S.pageW + 'px', height: S.pageH + 'px', display: S.cols === 2 ? 'block' : 'none' });
      Object.assign(R.style, { left: (S.cols === 2 ? S.pageW : 0) + 'px', width: S.pageW + 'px', height: S.pageH + 'px' });
      spine.style.display = S.cols === 2 ? 'block' : 'none';
      zLbl.textContent = Math.round(S.zoom * 100) + '%';
      zOut.disabled = S.zoom <= 0.5; zIn.disabled = S.zoom >= 3;
      if (renderedW !== S.pageW) { cache.clear(); renderedW = S.pageW; }
      if (S.cols === 2 && S.cur > 1) S.cur = S.cur - (S.cur % 2) || 1;
      show(S.cur);
    }

    function raster(n) {
      if (cache.has(n)) return Promise.resolve(cache.get(n));
      var key = n + '@' + S.pageW;
      if (pend.has(key)) return pend.get(key);
      var w = S.pageW;
      var job = S.doc.getPage(n).then(function (page) {
        var v1 = page.getViewport({ scale: 1 });
        var q = Math.min(3, Math.max(2, window.devicePixelRatio || 1) * 1.15);
        var px = Math.min(4200, w * q);
        var v = page.getViewport({ scale: px / v1.width });
        var cv = document.createElement('canvas');
        cv.width = Math.ceil(v.width); cv.height = Math.ceil(v.height);
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        return page.render({ canvasContext: ctx, viewport: v, intent: 'print' }).promise.then(function () {
          if (links.has(n)) return;
          return page.getAnnotations().then(function (ann) {
            return Promise.all(ann.filter(function (a) { return a.subtype === 'Link' && (a.dest || a.url); }).map(function (a) {
              var r = v1.convertToViewportRectangle(a.rect);
              var box = { l: Math.min(r[0], r[2]) / v1.width, t: Math.min(r[1], r[3]) / v1.height, w: Math.abs(r[2] - r[0]) / v1.width, h: Math.abs(r[3] - r[1]) / v1.height };
              if (a.url) { box.url = a.url; return box; }
              return resolveDest(a.dest).then(function (p) { if (p) box.page = p; return p ? box : null; });
            })).then(function (arr) { links.set(n, arr.filter(Boolean)); });
          });
        }).then(function () {
          pend.delete(key);
          if (w === S.pageW) { cache.set(n, cv); if (cache.size > 24) cache.delete(cache.keys().next().value); }
          return cv;
        });
      });
      pend.set(key, job);
      return job;
    }
    function resolveDest(d) {
      var p = typeof d === 'string' ? S.doc.getDestination(d) : Promise.resolve(d);
      return p.then(function (dd) { return dd ? S.doc.getPageIndex(dd[0]).then(function (i) { return i + 1; }) : 0; }).catch(function () { return 0; });
    }

    function paint(s, n) {
      s.n = n; s.ly.innerHTML = '';
      if (!n) { s.style.visibility = 'hidden'; return Promise.resolve(); }
      s.style.visibility = 'visible';
      s.style.boxShadow = '0 1px 0 rgba(20,19,23,.06), 0 30px 60px -40px rgba(20,19,23,.5)';
      return raster(n).then(function (src) {
        if (s.n !== n) return;
        s.cv.width = src.width; s.cv.height = src.height; s.cv.getContext('2d').drawImage(src, 0, 0);
        (links.get(n) || []).forEach(function (k) {
          var a = h('a', { position: 'absolute', left: k.l * 100 + '%', top: k.t * 100 + '%', width: k.w * 100 + '%', height: k.h * 100 + '%', cursor: 'pointer', borderRadius: '2px', transition: 'background .15s' });
          a.setAttribute('data-fl', '1');
          a.onmouseenter = function () { a.style.background = 'rgba(20,19,23,.08)'; };
          a.onmouseleave = function () { a.style.background = 'transparent'; };
          if (k.url) { a.href = k.url; a.target = '_blank'; a.rel = 'noopener'; }
          else a.onclick = function (e) { e.preventDefault(); e.stopPropagation(); turn(k.page); };
          s.ly.appendChild(a);
        });
      });
    }

    function ui() {
      var vis = visible();
      counter.textContent = (vis.length > 1 ? vis[0] + '–' + vis[1] : vis[0]) + ' / ' + S.total;
      range.max = String(S.total); range.value = String(vis[vis.length - 1]);
      range.style.setProperty('--p', (S.total > 1 ? ((vis[vis.length - 1] - 1) / (S.total - 1)) * 100 : 0) + '%');
      prevB.disabled = S.cur <= 1; nextB.disabled = vis[vis.length - 1] >= S.total;
      var last = vis[vis.length - 1], act = -1;
      S.chapters.forEach(function (c, i) { if (c.p <= last) act = i; });
      var c = S.chapters[act];
      chNum.textContent = c ? c.n : ''; chTitle.textContent = c ? c.t : (root.getAttribute('data-title') || '');
      [].forEach.call(menu.children, function (el, i) {
        var on = i === act;
        el.style.background = on ? LINE : BG;
        el.firstChild.style.color = on ? ACC : MUTED;
        el.children[1].style.fontWeight = on ? 600 : 400;
      });
    }

    function center(pr) {
      var solo = S.cols === 2 && !pr[0];
      R.style.left = (S.cols === 2 ? (solo ? S.pageW / 2 : S.pageW) : 0) + 'px';
      spine.style.display = S.cols === 2 && !solo ? 'block' : 'none';
    }
    function show(p) {
      S.cur = p;
      var pr = pagesFor(p);
      center(pr);
      ui();
      var job = Promise.all([paint(L, pr[0]), paint(R, pr[1])]);
      job.then(function () {
        var pre = S.cols === 1 ? [p + 1, p - 1, p + 2] : [pr[1] + 1, pr[1] + 2, pr[0] - 1, pr[0] - 2];
        pre.filter(function (x) { return x >= 1 && x <= S.total; }).reduce(function (ch, x) { return ch.then(function () { return raster(x); }); }, Promise.resolve()).catch(function () {});
      });
      return job;
    }

    function leaf(front, back) {
      var lf = h('div', { position: 'absolute', top: 0, width: S.pageW + 'px', height: S.pageH + 'px', transformStyle: 'preserve-3d', zIndex: 6, transition: 'transform .75s cubic-bezier(.4,.1,.25,1)' });
      [front, back].forEach(function (n, i) {
        var f = h('div', { position: 'absolute', inset: 0, background: '#fff', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', overflow: 'hidden', transform: i ? 'rotateY(180deg)' : 'none' });
        var cv = h('canvas', { position: 'absolute', inset: 0, width: '100%', height: '100%' });
        var src = n && cache.get(n);
        if (src) { cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0); }
        var sh = h('div', { position: 'absolute', inset: 0, opacity: 0, transition: 'opacity .75s', background: i ? 'linear-gradient(270deg,rgba(20,19,23,.22),transparent 45%)' : 'linear-gradient(90deg,rgba(20,19,23,.22),transparent 45%)' });
        f.appendChild(cv); f.appendChild(sh); lf.appendChild(f); lf['sh' + i] = sh;
      });
      return lf;
    }

    function turn(target, animate) {
      if (!S.doc) return;
      interact();
      target = Math.max(1, Math.min(S.total, target | 0));
      var a = pagesFor(S.cur), b = pagesFor(target);
      if (a[0] === b[0] && a[1] === b[1]) return;
      if (S.busy) { S.queued = target; return; }
      var fwd = target > S.cur;
      var anim = animate !== false && S.zoom <= 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!anim) { vp.scrollTop = 0; show(target); return; }
      S.busy = true;
      var finish = function () { S.busy = false; if (S.queued) { var q = S.queued; S.queued = 0; turn(q); } };
      Promise.all(b.filter(Boolean).map(raster)).then(function () {
        if (S.cols === 2) {
          center([1, 1]);
          var lf;
          if (fwd) { lf = leaf(a[1], b[0]); Object.assign(lf.style, { left: S.pageW + 'px', transformOrigin: '0 50%' }); }
          else { lf = leaf(a[0], b[1]); Object.assign(lf.style, { left: 0, transformOrigin: '100% 50%' }); }
          stage.appendChild(lf);
          S.cur = target;
          var keep = fwd ? L : R;
          var swap = fwd ? R : L;
          paint(swap, fwd ? b[1] : b[0]);
          ui();
          requestAnimationFrame(function () { requestAnimationFrame(function () { lf.style.transform = fwd ? 'rotateY(-180deg)' : 'rotateY(180deg)'; lf.sh0.style.opacity = 1; lf.sh1.style.opacity = 0; }); });
          var done = false, end = function () { if (done) return; done = true; paint(keep, fwd ? b[0] : b[1]).then(function () { lf.remove(); show(target); finish(); }); };
          lf.addEventListener('transitionend', function (e) { if (e.propertyName === 'transform') end(); });
          setTimeout(end, 820);
        } else {
          R.style.transition = 'none'; R.style.opacity = '0'; R.style.transform = 'translateX(' + (fwd ? 28 : -28) + 'px)';
          vp.scrollTop = 0;
          show(target).then(function () {
            requestAnimationFrame(function () { R.style.transition = 'opacity .3s ease, transform .3s ease'; R.style.opacity = '1'; R.style.transform = 'none'; });
            setTimeout(finish, 300);
          });
        }
      });
    }
    function next() { var v = visible(); turn(v[v.length - 1] + 1); }
    function prev() { var v = visible(); turn(S.cols === 2 ? v[0] - 1 : S.cur - 1); }

    function buildMenu() {
      menu.innerHTML = '';
      menu.appendChild(h('div', { position: 'sticky', top: 0, padding: '12px 16px', background: BG, borderBottom: '1px solid ' + RULE, font: '500 10px/1 ' + MONO, letterSpacing: '.08em', textTransform: 'uppercase', color: MUTED, display: 'flex', justifyContent: 'space-between' }, null, [h('span', null, { text: 'Содержание' }), h('span', null, { text: String(S.chapters.length) })]));
      var head = menu.firstChild; menu.removeChild(head);
      S.chapters.forEach(function (c) {
        var it = h('button', { display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) auto', gap: '10px', alignItems: 'baseline', width: '100%', textAlign: 'left', padding: '9px 14px', border: 0, borderBottom: '1px solid ' + LINE, background: BG, cursor: 'pointer', color: INK, font: 'inherit' }, { class: 'fb-c', type: 'button' }, [
          h('span', { font: '500 10.5px/1.3 ' + MONO, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, { text: c.n }),
          h('span', { fontSize: '13px', lineHeight: 1.35 }, { text: c.t }),
          h('span', { font: '400 10px/1.3 ' + MONO, color: MUTED }, { text: String(c.p) })
        ]);
        it.onclick = function () { menu.style.display = 'none'; interact(); emit('toc', { chapter: chLabel(c) }); turn(c.p); };
        menu.appendChild(it);
      });
      menu.insertBefore(head, menu.firstChild);
      // header is first child — shift indexes in ui()
      var kids = [].slice.call(menu.children, 1);
      Object.defineProperty(menu, 'items', { value: kids, configurable: true });
      var noCh = !S.chapters.length;
      chBtn.disabled = noCh; chBtn.style.opacity = '1'; chBtn.style.cursor = noCh ? 'default' : 'pointer'; chBtn.lastChild.style.display = noCh ? 'none' : '';
      ui();
    }
    // ui() iterates menu.children; patch to skip header
    var _ui = ui;
    ui = function () {
      var hd = menu.firstChild && !menu.firstChild.classList.contains('fb-c') ? menu.firstChild : null;
      if (hd) menu.removeChild(hd);
      _ui();
      if (hd) menu.insertBefore(hd, menu.firstChild);
      seenCheck();
    };

    function detectChapters() {
      var d = S.doc;
      return d.getOutline().catch(function () { return null; }).then(function (ol) {
        if (ol && ol.length) {
          return Promise.all(ol.map(function (o, i) { return resolveDest(o.dest).then(function (p) { return { n: String(i + 1).padStart(2, '0'), t: clean(o.title), p: p }; }); }))
            .then(function (a) { return a.filter(function (c) { return c.p; }); });
        }
        var found = [], max = Math.min(4, S.total);
        var chain = Promise.resolve();
        for (var i = 1; i <= max; i++) (function (pn) {
          chain = chain.then(function () {
            return d.getPage(pn).then(function (pg) {
              return Promise.all([pg.getTextContent(), pg.getAnnotations()]).then(function (r) {
                var items = r[0].items.filter(function (x) { return x.str && x.str.trim(); }).map(function (x) { return { s: x.str, x: x.transform[4], y: x.transform[5] }; });
                return Promise.all(r[1].filter(function (a) { return a.subtype === 'Link' && a.dest; }).map(function (a) {
                  return resolveDest(a.dest).then(function (p) {
                    if (!p || p === pn) return;
                    var x1 = a.rect[0], y1 = a.rect[1], x2 = a.rect[2], y2 = a.rect[3];
                    var t = clean(items.filter(function (it) { return it.x >= x1 - 2 && it.x <= x2 && it.y >= y1 - 3 && it.y <= y2 + 2; }).map(function (it) { return it.s; }).join(' '));
                    if (t) found.push({ raw: t, p: p });
                  });
                }));
              });
            });
          });
        })(i);
        return chain.then(function () {
          var re = /^(?:Глава|Приложение|Часть|Раздел)?\s*(\d{1,2}|[A-DА-Г]|Введение|Замечания|Заключение)\s+(.+)$/;
          var byPage = {};
          found.forEach(function (f) {
            var m = f.raw.match(re), item = m ? { n: m[1], t: m[2], p: f.p, ok: 1 } : { n: '', t: f.raw.replace(/\s*→\s*$/, ''), p: f.p, ok: 0 };
            if (/^(Введение|Замечания|Заключение)$/.test(item.n)) { item.t = item.n + '. ' + item.t; item.n = '·'; }
            if (/^Приложение/.test(f.raw)) item.n = 'Прил. ' + item.n;
            var cur = byPage[f.p];
            if (!cur || (!cur.ok && item.ok)) byPage[f.p] = item;
          });
          var list = Object.keys(byPage).map(function (k) { return byPage[k]; }).sort(function (a, b) { return a.p - b.p; });
          var good = list.filter(function (c) { return c.ok; });
          return good.length >= 3 ? good : list;
        });
      });
    }

    /* events */
    chBtn.onclick = function (e) { e.stopPropagation(); interact(); menu.style.display = menu.style.display === 'none' ? 'block' : 'none'; };
    var onDoc = function (e) { if (!menu.contains(e.target) && e.target !== chBtn) menu.style.display = 'none'; };
    document.addEventListener('click', onDoc);
    prevB.onclick = prev; nextB.onclick = next;
    zIn.onclick = function () { interact(); S.zoom = Math.min(3, +(S.zoom + 0.25).toFixed(2)); layout(); };
    zOut.onclick = function () { interact(); S.zoom = Math.max(0.5, +(S.zoom - 0.25).toFixed(2)); layout(); };
    range.oninput = function () { counter.textContent = range.value + ' / ' + S.total; };
    range.onchange = function () { turn(+range.value, false); };
    fsB.onclick = function () { setFull(!S.full); };
    viewB.onclick = function () { interact(); S.view = S.view === 'spread' ? 'page' : 'spread'; S.zoom = 1; layout(); };
    dl.addEventListener('click', function () { interact(); emit('download'); });
    function setFull(on) {
      S.full = on;
      if (on) { interact(); emit('fullscreen'); }
      Object.assign(root.style, on ? { position: 'fixed', inset: '0', zIndex: '99999', borderRadius: '0' } : { position: 'relative', inset: 'auto', zIndex: 'auto', borderRadius: RAD });
      vp.style.height = on ? 'auto' : baseH; vp.style.flex = on ? '1 1 auto' : 'none';
      document.documentElement.style.overflow = on ? 'hidden' : '';
      fsB.textContent = on ? '✕' : '⤢';
      setTimeout(layout, 30);
    }
    stage.addEventListener('click', function (e) {
      if (S.zoom > 1 || e.target.closest('[data-fl]')) return;
      var r = stage.getBoundingClientRect();
      (e.clientX - r.left > r.width / 2 ? next : prev)();
    });
    stage.addEventListener('mousemove', function (e) {
      if (S.zoom > 1) { stage.style.cursor = 'grab'; return; }
      var r = stage.getBoundingClientRect();
      stage.style.cursor = e.clientX - r.left > r.width / 2 ? 'e-resize' : 'w-resize';
    });
    var drag = null;
    vp.addEventListener('mousedown', function (e) { if (S.zoom <= 1) return; drag = { x: e.clientX, y: e.clientY, l: vp.scrollLeft, t: vp.scrollTop }; stage.style.cursor = 'grabbing'; e.preventDefault(); });
    var onMove = function (e) { if (!drag) return; vp.scrollLeft = drag.l - (e.clientX - drag.x); vp.scrollTop = drag.t - (e.clientY - drag.y); };
    var onUp = function () { drag = null; };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    var tx = null;
    vp.addEventListener('touchstart', function (e) { tx = S.zoom <= 1 ? e.touches[0].clientX : null; }, { passive: true });
    vp.addEventListener('touchend', function (e) { if (tx == null) return; var dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 45) (dx < 0 ? next : prev)(); tx = null; });
    var onKey = function (e) {
      if (!root.isConnected || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
      if (e.key === 'Escape' && S.full) { setFull(false); return; }
      var r = root.getBoundingClientRect();
      if (!S.full && (r.bottom < 120 || r.top > innerHeight - 120)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    document.addEventListener('keydown', onKey);
    var ro = new ResizeObserver(function () { clearTimeout(ro.t); ro.t = setTimeout(layout, 120); });
    ro.observe(root);

    S.goTo = function (p) { turn(p); };
    S.destroy = function () {
      summary();
      S.dead = true; ro.disconnect();
      clearInterval(tick); clearTimeout(T.dt); if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', onHide);
      document.removeEventListener('keydown', onKey); document.removeEventListener('click', onDoc);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      if (S.full) document.documentElement.style.overflow = '';
      instances = instances.filter(function (x) { return x !== S; });
      root.__fb = null; root.innerHTML = '';
    };

    pdfjs().then(function (m) {
      var task = m.getDocument({ url: url, cMapUrl: B.replace('build/', 'cmaps/'), cMapPacked: true, standardFontDataUrl: B.replace('build/', 'standard_fonts/') });
      task.onProgress = function (p) { if (p.total) loader.textContent = 'Загружаем гайд… ' + Math.round(p.loaded / p.total * 100) + '%'; };
      return task.promise;
    }).then(function (d) {
      if (S.dead) return;
      S.doc = d; S.total = d.numPages;
      return d.getPage(1).then(function (p1) {
        var v = p1.getViewport({ scale: 1 }); S.ratio = v.width / v.height;
        loader.remove();
        S.cur = Math.max(1, Math.min(S.total, +(root.getAttribute('data-start') || 1)));
        layout();
        return detectChapters().then(function (c) { S.chapters = c; buildMenu(); });
      });
    }).catch(function (err) {
      console.warn('[flipbook]', err);
      loader.textContent = 'Не удалось открыть PDF. Нужна прямая ссылка на файл, а сервер должен разрешать CORS.';
    });
  }

  function scan() { document.querySelectorAll('[data-flipbook]').forEach(mount); }
  window.Flipbook = {
    mount: mount, scan: scan,
    goTo: function (page) {
      var s = instances[0]; if (!s) return;
      s.goTo(page);
      var el = document.querySelector('[data-flipbook]');
      if (el) { var top = el.getBoundingClientRect().top + window.scrollY - 80; window.scrollTo({ top: top, behavior: 'smooth' }); }
    }
  };
  window.addEventListener('flipbook:goto', function (e) { window.Flipbook.goTo(e.detail && e.detail.page); });
  new MutationObserver(function () { clearTimeout(scan.t); scan.t = setTimeout(scan, 50); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-flipbook'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
