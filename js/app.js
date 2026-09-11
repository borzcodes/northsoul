/* ============================================================
   NorthSoul — app
   - Wall: full-bleed grid of photos + videos on a curved 3D surface (hover = colour / play)
   - Hero: scroll-driven landing (title parts → portrait → tiles gather into the wall)
   - One continuous scroll: hero ⇄ wall ⇄ Book
   - Router: hash routes (#/, #/about, #/book, 404)
   ============================================================ */
(() => {
  'use strict';

  const { CONFIG, MEDIA } = window.NS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;

  /* Wall tiles: the photos + videos from data.js, repeated to fill the wall */
  const WALL_REPEAT = 4;
  const TILES = [];
  for (let r = 0; r < WALL_REPEAT; r++) TILES.push(...MEDIA);

  /* ------------------------------------------------------------
     Wall
     ------------------------------------------------------------ */
  class Wall {
    constructor(el) {
      this.el = el;
      this.inner = el.firstElementChild;
      this.tiles = [];
      // offset (px). Target + smoothed current. x: -maxX..maxX, y: minY..0
      this.tx = 0; this.ty = 0; this.ox = 0; this.oy = 0;
      this.vx = 0; this.vy = 0;
      this.minY = 0; this.maxX = 0;
      // pointer, normalised -1..1
      this.px = 0; this.py = 0;
      // 0 = fully scattered (hero), 1 = grid
      this.progress = 1;
      this.anim = null;
      this.mode = 'archive'; // 'intro' | 'archive' | 'ghost'
      this.hidden = false;   // skip rendering while covered
      this.hover = null;
      this.onHover = null;
      this.onScroll = null;
      this.onOverscroll = null; // ('up' | 'down') when dragged past an edge
      this.bind();
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    /* Geometry for the current viewport + tile count. */
    layout() {
      const vw = window.innerWidth, vh = window.innerHeight;
      this.vw = vw; this.vh = vh;
      const fit = vw < 560 ? 2 : vw < 760 ? 3 : vw < 1000 ? 4 : 5;
      this.cellW = vw / fit;
      this.cellH = this.cellW * 0.625; // 16:10 tiles (cell = tile + gap)
      this.gap = Math.round(this.cellW * 0.068);
      // one extra column each side so the wall bleeds off the edges
      this.cols = fit + 2;
      this.left = -this.cellW;
      this.maxX = this.cellW;          // how far it can be dragged sideways
      this.top = -this.cellH * 0.35;   // first row tucks under the header
      this.bottom = 64;                // last row clears the filters
      this.rows = Math.ceil(this.tiles.length / this.cols);
      const gridH = this.rows * this.cellH;
      this.minY = Math.min(0, vh - this.bottom - this.top - gridH);
      this.ty = clamp(this.ty, this.minY, 0);
      this.oy = clamp(this.oy, this.minY, 0);
      this.tx = clamp(this.tx, -this.maxX, this.maxX);
      this.ox = clamp(this.ox, -this.maxX, this.maxX);
      const w = this.cellW - this.gap, h = this.cellH - this.gap;
      this.tiles.forEach((t, i) => {
        t.col = i % this.cols;
        t.row = Math.floor(i / this.cols);
        t.el.style.width = w + 'px';
        t.el.style.height = h + 'px';
      });
      this.reseedScatter();
    }

    setItems(items) {
      for (const t of this.tiles) t.el.remove();
      this.hover = null;
      this.tiles = items.map((item, i) => {
        const el = document.createElement('div');
        el.className = 'tile' + (item.video ? ' tile--video' : '');
        const img = document.createElement('img');
        img.draggable = false;
        img.decoding = 'async';
        img.loading = i < 30 ? 'eager' : 'lazy';
        img.src = item.src;
        img.alt = item.title;
        el.appendChild(img);
        this.inner.appendChild(el);
        return { el, img, item, video: null, sc: null, col: 0, row: 0, off: false };
      });
      this.layout();
    }

    /* Random 3D positions used for the hero → wall gather. */
    reseedScatter(visibleRatio = 0.18) {
      const { vw, vh } = this;
      const r = Math.random;
      const P = 1400; // must match .wall perspective
      for (const t of this.tiles) {
        const z = -(600 + r() * 1300);
        const s = (P - z) / P; // inverse of the perspective scale at this depth
        // pick a spot on screen, then push it back so it lands there after projection
        t.sc = {
          rel: false,
          x: (r() - 0.5) * vw * 0.92 * s,
          y: (r() - 0.5) * vh * 0.92 * s,
          z,
          rx: (r() - 0.5) * 60,
          ry: (r() - 0.5) * 60,
          o: r() < visibleRatio ? 0.6 + r() * 0.3 : 0,
        };
      }
    }

    /* Small displacement around each tile's own slot (filter change). */
    reseedJitter() {
      const r = Math.random;
      for (const t of this.tiles) {
        t.sc = {
          rel: true,
          x: (r() - 0.5) * this.cellW * 0.5,
          y: (r() - 0.5) * this.cellH * 0.5,
          z: -(120 + r() * 380),
          rx: (r() - 0.5) * 24,
          ry: (r() - 0.5) * 24,
          o: 0.25,
        };
      }
    }

    animateTo(to, dur, hooks = {}) {
      if (REDUCED) dur = 0;
      this.anim = { from: this.progress, to, dur, start: performance.now(), ...hooks };
    }

    /* Wheel / keyboard scrolling, clamped to the grid. */
    scrollBy(dy) {
      this.ty = clamp(this.ty - dy, this.minY, 0);
    }
    get atTop() { return this.ty >= -0.5; }
    get atBottom() { return this.ty <= this.minY + 0.5; }
    jumpTo(y) { this.ty = this.oy = clamp(y, this.minY, 0); this.tx = this.ox = 0; if (this.onScroll) this.onScroll(-this.oy); }

    setHover(tile) {
      if (this.hover === tile) return;
      if (this.hover) {
        this.hover.el.classList.remove('is-hover');
        this.stopVideo(this.hover);
      }
      this.hover = tile;
      if (tile) {
        tile.el.classList.add('is-hover');
        if (tile.item.video) this.playVideo(tile);
      }
      if (this.onHover) this.onHover(tile ? tile.item : null);
    }

    /* Video tiles show their poster; the clip itself is created on first
       hover and plays (muted, looping, in colour) while the pointer stays. */
    playVideo(tile) {
      const item = tile.item;
      if (!tile.video) {
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
        v.poster = item.src;
        // start on the same frame as the poster so nothing jumps
        v.src = item.video + '#t=' + (item.posterAt || 1);
        v.addEventListener('playing', () => { if (this.hover === tile) tile.el.classList.add('is-playing'); });
        tile.el.appendChild(v);
        tile.video = v;
      }
      const v = tile.video;
      if (v.readyState >= 2) {
        v.currentTime = item.posterAt || 1;
        tile.el.classList.add('is-playing');
      }
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    }
    stopVideo(tile) {
      if (!tile.video) return;
      tile.video.pause();
      tile.el.classList.remove('is-playing');
    }

    /* Warm the browser cache with the clips so hover starts instantly.
       Desktop only (no hover on touch), one file at a time, low priority. */
    prefetchVideos() {
      if (this._prefetched || window.matchMedia('(hover: none)').matches) return;
      if (navigator.connection && navigator.connection.saveData) return;
      this._prefetched = true;
      const urls = [...new Set(this.tiles.map((t) => t.item.video).filter(Boolean))];
      // wait until every tile image is in, then trickle the clips one by one
      const imgs = this.tiles.map((t) => t.img);
      const ready = Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
      ready.then(() => setTimeout(next, 1500));
      const next = () => {
        const url = urls.shift();
        if (!url) return;
        const l = document.createElement('link');
        l.rel = 'prefetch'; l.as = 'video'; l.href = url;
        l.onload = l.onerror = () => setTimeout(next, 150);
        document.head.appendChild(l);
      };
    }

    bind() {
      const el = this.el;
      let down = null;
      // drag past an edge with resistance; release beyond this to hand over
      const rubber = (v, lo, hi) => (v < lo ? lo - (lo - v) * 0.3 : v > hi ? hi + (v - hi) * 0.3 : v);

      el.addEventListener('pointerdown', (e) => {
        if (this.mode !== 'archive' || e.button !== 0) return;
        down = {
          x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty, rawY: this.ty,
          lastX: e.clientX, lastY: e.clientY, lastT: performance.now(),
          vx: 0, vy: 0, moved: false,
          tile: e.target.closest('.tile'),
          touch: e.pointerType === 'touch',
        };
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* synthetic / lost pointer */ }
      });

      el.addEventListener('pointermove', (e) => {
        this.px = (e.clientX / this.vw) * 2 - 1;
        this.py = (e.clientY / this.vh) * 2 - 1;
        if (down) {
          const dx = e.clientX - down.x, dy = e.clientY - down.y;
          if (!down.moved && Math.hypot(dx, dy) > 5) {
            down.moved = true;
            el.classList.add('is-dragging');
            this.setHover(null);
          }
          if (down.moved) {
            down.rawY = down.ty + dy;
            this.ty = rubber(down.rawY, this.minY, 0);
            this.tx = rubber(down.tx + dx, -this.maxX, this.maxX);
            const now = performance.now();
            const dt = Math.max(1, now - down.lastT);
            down.vx = ((e.clientX - down.lastX) / dt) * 16;
            down.vy = ((e.clientY - down.lastY) / dt) * 16;
            down.lastX = e.clientX; down.lastY = e.clientY; down.lastT = now;
          }
          return;
        }
        if (this.mode === 'archive') {
          const tEl = e.target.closest('.tile');
          if (tEl) this.setHover(this.tiles.find((t) => t.el === tEl));
        }
      });

      const up = () => {
        if (!down) return;
        if (down.moved) {
          el.classList.remove('is-dragging');
          if (down.rawY > 130 && this.onOverscroll) this.onOverscroll('up');
          else if (down.rawY < this.minY - 130 && this.onOverscroll) this.onOverscroll('down');
          // inertia
          this.tx = clamp(this.tx + down.vx * 14, -this.maxX, this.maxX);
          this.ty = clamp(this.ty + down.vy * 14, this.minY, 0);
        } else if (down.tile && down.touch) {
          // no hover on touch screens: a tap toggles the tile (colour / play)
          const t = this.tiles.find((t) => t.el === down.tile);
          this.setHover(this.hover === t ? null : t);
        }
        down = null;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', () => { if (!down) this.setHover(null); });

      let rt;
      window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => this.layout(), 120);
      });
    }

    loop(now) {
      const prevX = this.ox, prevY = this.oy;
      const k = REDUCED ? 1 : 0.1;
      this.ox = lerp(this.ox, this.tx, k);
      this.oy = lerp(this.oy, this.ty, k);
      this.vx = this.ox - prevX;
      this.vy = this.oy - prevY;
      if (Math.abs(this.vy) > 0.01 && this.onScroll) this.onScroll(-this.oy);

      if (this.anim) {
        const a = this.anim;
        const t = a.dur ? clamp((now - a.start) / a.dur, 0, 1) : 1;
        this.progress = lerp(a.from, a.to, easeInOutCubic(t));
        if (a.onUpdate) a.onUpdate(this.progress, t);
        if (t >= 1) { this.anim = null; if (a.onDone) a.onDone(); }
      }

      if (!this.hidden) this.render();
      requestAnimationFrame(this.loop);
    }

    render() {
      const { vw, vh, cellW, cellH, gap, ox, oy, tiles } = this;
      const tileW = cellW - gap, tileH = cellH - gap;
      const p = this.progress;
      // The flat grid is wrapped onto a curved surface (a wide cylinder
      // horizontally, a gentler one vertically) so edge tiles tilt away
      // without ever overlapping their neighbours.
      const RX = vw * 1.35, RY = vh * 2.0;
      const DEG = 180 / Math.PI;

      for (const t of tiles) {
        // flat grid position of the tile centre, relative to the viewport centre
        const u = this.left + t.col * cellW + ox + cellW / 2 - vw / 2;
        const v = this.top + t.row * cellH + oy + cellH / 2 - vh / 2;
        // settled + well outside the viewport: don't bother
        if (p >= 1 && (v < -vh * 0.85 || v > vh * 0.85)) {
          if (!t.off) { t.el.style.visibility = 'hidden'; t.off = true; }
          continue;
        }
        if (t.off) { t.el.style.visibility = ''; t.off = false; }

        const thx = clamp(u / RX, -1.25, 1.25);
        const thy = clamp(v / RY, -1.25, 1.25);
        const gx = RX * Math.sin(thx) + vw / 2 - tileW / 2;
        const gy = RY * Math.sin(thy) + vh / 2 - tileH / 2;
        const gz = RX * (Math.cos(thx) - 1) + RY * (Math.cos(thy) - 1);
        let x = gx, y = gy, z = gz;
        let ry = thx * DEG, rx = -thy * DEG;
        let o = 1;
        if (p < 1) {
          const s = t.sc;
          const sx = s.rel ? gx + s.x : vw / 2 + s.x - tileW / 2;
          const sy = s.rel ? gy + s.y : vh / 2 + s.y - tileH / 2;
          x = lerp(sx, gx, p);
          y = lerp(sy, gy, p);
          z = lerp(s.rel ? gz + s.z : s.z, gz, p);
          rx = lerp(s.rx, rx, p);
          ry = lerp(s.ry, ry, p);
          o = lerp(s.o, 1, easeOutCubic(p));
        }
        t.el.style.transform =
          `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;
        t.el.style.opacity = o.toFixed(3);
      }

      // whole-wall tilt: drag velocity + pointer parallax
      let tiltX = 0, tiltY = 0;
      if (!REDUCED) {
        const par = this.mode === 'archive' ? 0 : 3;
        tiltX = clamp(-this.vy * 0.12, -5, 5) - this.py * par;
        tiltY = clamp(this.vx * 0.12, -5, 5) + this.px * par;
      }
      this.inner.style.transform = `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
    }
  }

  /* ------------------------------------------------------------
     Bootstrap DOM from CONFIG
     ------------------------------------------------------------ */
  const [nameA, nameB] = CONFIG.nameParts;
  $$('[data-name="0"]').forEach((el) => (el.textContent = nameA));
  $$('[data-name="1"]').forEach((el) => (el.textContent = nameB));
  $$('[data-brand-lines]').forEach((el) => (el.innerHTML = `${nameA}<br>${nameB}`));
  $$('[data-logo]').forEach((el) => (el.innerHTML = `${nameA}<br>${nameB}`));
  $$('[data-tagline]').forEach((el) => (el.textContent = CONFIG.tagline));
  $$('[data-tagline-2]').forEach((el) => (el.innerHTML = CONFIG.tagline.replace(' + ', ' +<br>')));
  $$('[data-about-sub]').forEach((el) => (el.textContent = CONFIG.aboutSubtitle));
  $$('[data-about-img]').forEach((el) => (el.src = CONFIG.aboutImage));
  $$('[data-logo-inline], [data-brand]').forEach((el) => (el.textContent = CONFIG.brand));
  $$('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));
  const mailSubject = encodeURIComponent(`Booking request — ${CONFIG.brand}`);
  $$('[data-mail]').forEach((el) => { el.href = `mailto:${CONFIG.bookingEmail}?subject=${mailSubject}`; el.textContent = CONFIG.bookingEmail; });
  $$('[data-mail-cta]').forEach((el) => { el.href = `mailto:${CONFIG.bookingEmail}?subject=${mailSubject}`; el.textContent = `Email ${CONFIG.bookingEmail} ↗`; });
  const waDigits = (CONFIG.whatsapp || '').replace(/\D/g, '');
  $$('[data-whatsapp]').forEach((el) => { el.href = `https://wa.me/${waDigits}?text=${encodeURIComponent('Hi NorthSoul — I\'d like to book a night.')}`; });
  $$('[data-instagram]').forEach((el) => { el.href = CONFIG.instagram; });
  const nav = $('#nav');
  document.title = `${CONFIG.brand} — ${CONFIG.tagline}`;

  // Next event (top of the Book page)
  (function renderNextEvent() {
    const n = CONFIG.nextEvent;
    const box = $('#nextEvent');
    if (!n || !box) { if (box) box.hidden = true; return; }
    $('[data-next-banner]', box).src = n.banner || CONFIG.aboutImage;
    $('[data-next-title]', box).textContent = n.title || 'Next event';
    const meta = [n.city, n.note].filter(Boolean).join(' · ');
    $('[data-next-meta]', box).textContent = meta;
    const dateEl = $('[data-next-date]', box);
    const d = n.date ? new Date(n.date + 'T12:00:00') : null;
    if (d && !isNaN(d)) {
      const label = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const days = Math.ceil((d - new Date()) / 86400000);
      dateEl.textContent = days > 1 ? `${label} · in ${days} days` : days === 1 ? `${label} · tomorrow` : days === 0 ? `${label} · tonight` : label;
    } else {
      dateEl.textContent = 'Date to be announced';
    }
    const link = $('[data-next-link]', box);
    if (n.link) { link.href = n.link; link.hidden = false; }
  })();

  /* ------------------------------------------------------------
     Archive
     ------------------------------------------------------------ */
  const wall = new Wall($('#wall'));
  const ftrTitle = $('#ftrTitle');
  const ftrCount = $('#ftrCount');
  const filtersEl = $('#filters');
  let activeFilter = 'All';

  const tilesFor = (f) =>
    f === 'All' ? TILES
    : f === 'Photos' ? TILES.filter((t) => t.kind === 'photo')
    : f === 'Videos' ? TILES.filter((t) => t.kind === 'video')
    : TILES.filter((t) => (t.tags || []).includes(f));
  const caption = (m) => m.title + (m.year ? ` · ${m.year}` : '');

  for (const f of CONFIG.filters) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = f;
    b.dataset.filter = f;
    if (f === activeFilter) b.classList.add('is-active');
    b.addEventListener('click', () => setFilter(f));
    filtersEl.appendChild(b);
  }

  function setFilter(f) {
    if (f === activeFilter || wall.anim || phase !== 'wall') return;
    activeFilter = f;
    $$('button', filtersEl).forEach((b) => b.classList.toggle('is-active', b.dataset.filter === f));
    // disturb the wall, swap the tiles, let it settle again
    wall.reseedJitter();
    wall.animateTo(0.35, 420, {
      onDone: () => {
        wall.setItems(tilesFor(f));
        wall.jumpTo(0);
        wall.reseedJitter();
        wall.progress = 0.35;
        ftrTitle.textContent = '';
        wall.animateTo(1, 950);
      },
    });
  }

  wall.setItems(TILES);
  wall.onHover = (item) => { if (item) ftrTitle.textContent = caption(item); };
  wall.onScroll = (d) => { ftrCount.textContent = '↓ ' + Math.max(0, Math.round(d)).toLocaleString('en-US'); };

  /* ------------------------------------------------------------
     Landing hero
     Scroll scrubs `heroP` 0→1: "NorthSoul" parts into the About hero
     (words drift to the corners, the portrait fades in). Scrolling past
     the end hands over to the wall; scrolling up from the wall's top
     brings the hero back.
     ------------------------------------------------------------ */
  const hero = $('#hero');
  const heroL = $('.hero__name--l', hero);
  const heroR = $('.hero__name--r', hero);
  const heroTag = $('.hero__tag', hero);
  const heroSub = $('.hero__sub', hero);
  const heroImg = $('.hero__img', hero);
  const heroCta = $('#heroCta');
  const hdr = $('.hdr');

  let introDone = sessionStorage.getItem('ns-intro') === '1';
  // 'hero' (scrubbing) | 'gather' (tiles flying, no input) | 'wall'
  let phase = 'wall';
  let heroP = 0, heroTarget = 0, heroOverflow = 0, heroAuto = false;
  let heroLayout = null;
  let edgeAcc = 0;          // wheel pushed past the wall's top/bottom
  let inputLockUntil = 0;   // brief cooldown after each hand-over
  const lockInput = (ms) => { inputLockUntil = performance.now() + ms; };

  /* Start/end geometry for both words, recomputed on resize. */
  function measureHero() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const mobile = vw < 640;
    // final size = the About page's name size
    const fsEnd = mobile ? clamp(vw * 0.22, 64, 120) : clamp(vw * 0.175, 84, 290);
    heroL.style.fontSize = heroR.style.fontSize = fsEnd + 'px';
    const wN = heroL.offsetWidth, wS = heroR.offsetWidth;
    // start size: the joined word must fit on one line
    const fsStart = Math.min(fsEnd, (fsEnd * vw * 0.88) / (wN + wS));
    const k = fsStart / fsEnd;
    const x0 = (vw - (wN + wS) * k) / 2;
    const edge = mobile ? vw * 0.05 : vw * 0.025;
    heroLayout = {
      fsStart, fsEnd,
      n0: { x: x0, y: vh * 0.5 },
      s0: { x: x0 + wN * k, y: vh * 0.5 },
      n1: { x: edge, y: mobile ? vh * 0.22 : vh * 0.60 },
      s1: { x: vw - edge - wS, y: mobile ? vh * 0.86 : vh * 0.81 },
      tagY: vh * 0.5 + fsStart * 0.42 + 26,
    };
  }

  function renderHero() {
    const L = heroLayout;
    const e = easeInOutCubic(heroP);
    const fs = lerp(L.fsStart, L.fsEnd, e);
    heroL.style.fontSize = heroR.style.fontSize = fs.toFixed(2) + 'px';
    heroL.style.transform = `translate(${lerp(L.n0.x, L.n1.x, e).toFixed(2)}px, ${lerp(L.n0.y, L.n1.y, e).toFixed(2)}px) translateY(-50%)`;
    heroR.style.transform = `translate(${lerp(L.s0.x, L.s1.x, e).toFixed(2)}px, ${lerp(L.s0.y, L.s1.y, e).toFixed(2)}px) translateY(-50%)`;
    heroTag.style.transform = `translate(-50%, ${L.tagY.toFixed(1)}px)`;
    heroTag.style.opacity = (1 - clamp(heroP / 0.22, 0, 1)).toFixed(3);
    const ip = clamp((heroP - 0.3) / 0.6, 0, 1);
    heroImg.style.opacity = ip.toFixed(3);
    heroImg.style.transform = `translate(-50%, -50%) scale(${(0.92 + 0.08 * easeOutCubic(ip)).toFixed(4)})`;
    const late = clamp((heroP - 0.72) / 0.28, 0, 1);
    heroSub.style.opacity = late.toFixed(3);
    hdr.style.opacity = late.toFixed(3);
    hdr.classList.toggle('is-hidden', late < 0.6);
    heroCta.textContent = heroP > 0.97 ? 'Scroll to enter' : 'Scroll';
  }

  function heroLoop() {
    if (phase !== 'hero') return;
    heroP = REDUCED ? heroTarget : lerp(heroP, heroTarget, 0.11);
    if (Math.abs(heroTarget - heroP) < 0.0005) heroP = heroTarget;
    renderHero();
    if (heroAuto && heroP >= 0.995) enterWall();
    requestAnimationFrame(heroLoop);
  }

  /* dy in px: positive = scrolling down */
  function heroInput(dy) {
    if (heroTarget >= 1 && dy > 0) {
      heroOverflow += dy;
      if (heroOverflow > 120) enterWall();
      return;
    }
    heroOverflow = 0;
    heroTarget = clamp(heroTarget + dy / 900, 0, 1);
  }

  /* Show the hero. atEnd = arriving from the wall (already formed). */
  function showHero(atEnd) {
    phase = 'hero';
    heroAuto = false;
    heroOverflow = 0;
    heroP = heroTarget = atEnd ? 1 : 0;
    body.classList.add('is-hero');
    hero.classList.remove('is-entering');
    hero.style.opacity = '';
    measureHero();
    renderHero();
    // widths depend on the web font: measure again once it is in, then reveal
    document.fonts.ready.then(() => {
      if (phase !== 'hero') return;
      measureHero();
      renderHero();
      hero.classList.add('is-ready');
    });
    requestAnimationFrame(heroLoop);
  }

  function startHero() {
    showHero(false);
    // park the wall scattered behind the (opaque) hero, ready to fly in
    wall.mode = 'intro';
    wall.anim = null;
    wall.progress = 0;
    wall.jumpTo(0);
    wall.reseedScatter();
    wall.render();          // lay the scattered tiles out once, then pause
    wall.hidden = true;
  }

  /* Hero → wall: hero dissolves while the tiles gather. */
  function enterWall() {
    if (phase !== 'hero') return;
    phase = 'gather';
    heroAuto = false;
    hdr.style.opacity = '';
    hdr.classList.remove('is-hidden');
    wall.hidden = false;
    wall.mode = 'intro';
    hero.classList.add('is-entering');
    wall.animateTo(1, REDUCED ? 0 : 1900, {
      onUpdate: (p, t) => {
        hero.style.opacity = String(1 - clamp(t / 0.38, 0, 1));
        if (t > 0.62) body.classList.remove('is-hero');
      },
      onDone: () => {
        phase = 'wall';
        edgeAcc = 0;
        wall.mode = 'archive';
        wall.prefetchVideos();
        body.classList.remove('is-hero');
        hero.classList.remove('is-ready', 'is-entering');
        hero.style.opacity = '';
        introDone = true;
        sessionStorage.setItem('ns-intro', '1');
        lockInput(450);
      },
    });
  }

  /* Wall → hero (scrolled up from the top): tiles scatter, hero returns. */
  function leaveWallUp() {
    if (phase !== 'wall' || wall.anim) return;
    phase = 'gather';
    wall.mode = 'intro';
    wall.setHover(null);
    wall.jumpTo(0);
    wall.reseedScatter();
    body.classList.add('is-hero');
    hero.classList.add('is-ready', 'is-entering');
    hero.style.opacity = '0';
    heroP = heroTarget = 1;
    measureHero();
    renderHero();
    wall.animateTo(0, REDUCED ? 0 : 1500, {
      onUpdate: (p, t) => {
        hero.style.opacity = String(clamp((t - 0.25) / 0.5, 0, 1));
      },
      onDone: () => {
        wall.hidden = true;
        showHero(true);
        lockInput(450);
      },
    });
  }

  /* Leaving the landing route: drop whatever the hero was doing. */
  function cancelHero() {
    if (phase === 'wall') return;
    phase = 'wall';
    heroAuto = false;
    body.classList.remove('is-hero');
    hero.classList.remove('is-ready', 'is-entering');
    hero.style.opacity = '';
    hdr.style.opacity = '';
    hdr.classList.remove('is-hidden');
    wall.anim = null;
    wall.progress = 1;
  }

  window.addEventListener('resize', () => { if (phase === 'hero') { measureHero(); renderHero(); } });
  heroCta.addEventListener('click', () => {
    if (phase !== 'hero') return;
    if (heroTarget >= 1) enterWall();
    else { heroTarget = 1; heroAuto = true; }
  });

  /* ------------------------------------------------------------
     One scroll to rule them: hero ⇄ wall ⇄ Book
     ------------------------------------------------------------ */
  let returnToBottom = false; // Book → wall lands at the wall's end
  let bookAcc = 0;            // scrolled up past the top of the Book page

  function goBook() {
    if (phase !== 'wall') return;
    lockInput(600);
    location.hash = '#/book';
  }

  /* Scroll input on the landing route (wheel / keys / hero touch). */
  function landingInput(dy) {
    if (performance.now() < inputLockUntil) return;
    if (phase === 'hero') { heroInput(dy); return; }
    if (phase !== 'wall') return;
    wall.scrollBy(dy);
    if (wall.atTop && dy < 0) {
      edgeAcc += -dy;
      if (edgeAcc > 160) { edgeAcc = 0; leaveWallUp(); }
    } else if (wall.atBottom && dy > 0) {
      edgeAcc += dy;
      if (edgeAcc > 160) { edgeAcc = 0; goBook(); }
    } else {
      edgeAcc = 0;
    }
  }

  window.addEventListener('wheel', (e) => {
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    if (current === 'archive') {
      e.preventDefault();
      landingInput(dy);
    } else if (current === 'book') {
      // at the top of the Book page, keep scrolling up to return to the wall
      if (window.scrollY <= 0 && dy < 0) {
        bookAcc += -dy;
        if (bookAcc > 180) { bookAcc = 0; returnToBottom = true; location.hash = '#/'; }
      } else bookAcc = 0;
    }
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (current !== 'archive') return;
    const down = ['ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key);
    const up = ['ArrowUp', 'PageUp'].includes(e.key);
    if (!down && !up) return;
    e.preventDefault();
    landingInput((down ? 1 : -1) * (phase === 'hero' ? 360 : wall.cellH));
  });

  // touch: the hero is scrubbed by finger; the wall itself is dragged (pointer events)
  let touchY = null;
  window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (touchY == null) return;
    const y = e.touches[0].clientY;
    const dy = touchY - y;
    touchY = y;
    if (current === 'archive' && phase === 'hero') landingInput(dy * 2.2);
    else if (current === 'book' && window.scrollY <= 0 && dy < 0) {
      bookAcc += -dy;
      if (bookAcc > 140) { bookAcc = 0; returnToBottom = true; location.hash = '#/'; }
    }
  }, { passive: true });

  /* ------------------------------------------------------------
     Views / router
     ------------------------------------------------------------ */
  const views = $('#views');
  let current = null;
  let first = true;

  function activate(name) {
    $$('.view', views).forEach((v) => v.classList.toggle('is-active', v.dataset.view === name));
    body.classList.remove('route-archive', 'route-page', 'route-404');
    body.classList.add(name === 'archive' ? 'route-archive' : name === '404' ? 'route-404' : 'route-page');
    $$('a[data-route]', nav).forEach((a) => a.classList.toggle('is-active', a.dataset.route === name));
    if (name !== 'archive') cancelHero();
    wall.hidden = name !== 'archive' && name !== '404';
    if (name === 'archive') {
      if (returnToBottom) {
        returnToBottom = false;
        introDone = true;
        wall.mode = 'archive';
        wall.jumpTo(wall.minY);
        lockInput(500);
      } else if (!introDone) {
        startHero();
      } else {
        wall.mode = 'archive';
      }
      if (wall.mode === 'archive') wall.prefetchVideos();
      edgeAcc = 0;
    } else {
      wall.mode = 'ghost';
      if (name === '404') wall.jumpTo(0);
    }
    bookAcc = 0;
    window.scrollTo(0, 0);
    current = name;
  }

  function go(name, setup) {
    if (setup) setup();
    if (first || REDUCED || name === current) {
      first = false;
      activate(name);
      return;
    }
    body.classList.add('is-leaving');
    setTimeout(() => {
      activate(name);
      requestAnimationFrame(() => body.classList.remove('is-leaving'));
    }, 380);
  }

  function route() {
    const hash = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
    const [name] = hash.split('/');
    if (!name) return go('archive', () => (document.title = `${CONFIG.brand} — ${CONFIG.tagline}`));
    if (name === 'about') return go('about', () => (document.title = `About — ${CONFIG.brand}`));
    if (name === 'book') return go('book', () => (document.title = `Book — ${CONFIG.brand}`));
    go('404', () => (document.title = `404 — ${CONFIG.brand}`));
  }

  window.addEventListener('hashchange', route);
  route();

  // 404: "move to disturb the archive"
  window.addEventListener('pointermove', (e) => {
    if (current !== '404') return;
    wall.px = (e.clientX / wall.vw) * 2 - 1;
    wall.py = (e.clientY / wall.vh) * 2 - 1;
    wall.tx = -wall.px * 60;
    wall.ty = clamp(-40 - wall.py * 50, wall.minY, 0);
  });

})();
