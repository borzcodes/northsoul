/* ============================================================
   NorthSoul — app
   - Stack: the archive as a vertical cover flow — one card facing you,
     the previous ones flattened above, the next lying below. Click to open
     it in the player (blurred backdrop, play / pause).
   - Hero: scroll-driven landing (title parts → portrait)
   - About: the dark chapter after it — four words, two clips behind them
   - One continuous scroll: hero ⇄ about ⇄ stack ⇄ Book
   - Router: hash routes (#/, #/book, 404; #/about jumps to the chapter)
   ============================================================ */
(() => {
  'use strict';

  const { CONFIG, MEDIA, VENUES } = window.NS;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const smooth = (t) => t * t * (3 - 2 * t);
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;

  /* ------------------------------------------------------------
     Stack
     ------------------------------------------------------------ */
  // Where a card sits for a given distance d from the current one
  // (d < 0: above, flattened and receding; d > 0: below, tilted towards you).
  // y is in card heights (yH) plus, for the "below" poses, viewport heights
  // (yV) so the next card always waits at the bottom edge.
  const POSES = [
    { d: -4, yH: -1.10, z: -360, rx: 85, o: 0 },
    { d: -3, yH: -1.02, z: -280, rx: 82, o: 0.55 },
    { d: -2, yH: -0.88, z: -190, rx: 78, o: 0.85 },
    { d: -1, yH: -0.66, z: -90, rx: 72, o: 1 },
    { d: 0, yH: 0, z: 0, rx: 0, o: 1 },
    { d: 1, yV: 0.33, yH: 0, z: 320, rx: -55, o: 1 },
    { d: 2, yV: 0.33, yH: 1.2, z: 320, rx: -65, o: 0 },
  ];

  class Stack {
    constructor(el, items) {
      this.el = el;
      this.inner = el.firstElementChild;
      this.cards = [];
      this.cur = 0;            // smoothed float index of the card facing you
      this.target = 0;         // where the input wants it (snaps to whole cards when idle)
      this.vel = 0;
      this.lastInput = 0;
      this.max = 0;
      this.progress = 1;       // 0 = scattered (hero), 1 = stacked
      this.anim = null;
      this.mode = 'archive';   // 'intro' | 'archive' | 'ghost'
      this.hidden = false;
      this.paused = false;     // the player is open: no inline playback underneath
      this.index = -1;         // whole-card index currently shown (for the chrome)
      this.onChange = null;    // (index, item)
      this.onOpen = null;      // (item)
      this.onOverscroll = null;// ('up' | 'down')
      this.setItems(items);
      this.bind();
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    setItems(items) {
      for (const c of this.cards) c.el.remove();
      this.cards = items.map((item, i) => {
        const el = document.createElement('div');
        el.className = 'item' + (item.video ? ' item--video' : '');
        const img = document.createElement('img');
        img.src = item.src; img.alt = item.title; img.draggable = false; img.decoding = 'async';
        img.loading = i < 6 ? 'eager' : 'lazy';
        el.appendChild(img);
        this.inner.appendChild(el);
        return { el, img, item, i, video: null, sc: null, tf: '', os: '', zi: '', isCur: false, on: false };
      });
      this.max = this.cards.length - 1;
      this.layout();
    }

    layout() {
      const vw = window.innerWidth, vh = window.innerHeight;
      this.vw = vw; this.vh = vh;
      this.W = vw < 640 ? Math.round(vw * 0.68) : Math.round(clamp(vw * 0.3, 240, 520));
      this.H = Math.round(this.W * 0.625);
      this.cy = Math.round(vh * (vw < 640 ? 0.4 : 0.42)); // where the current card's centre sits
      this.el.style.setProperty('--card-w', this.W + 'px');
      this.reseedScatter();
      this._sig = '';
    }

    /* Random 3D positions for the hero → stack gather. */
    reseedScatter(visibleRatio = 0.5) {
      const { vw, vh } = this;
      const r = Math.random;
      const P = 1100;
      for (const c of this.cards) {
        const z = -(500 + r() * 1100);
        const s = (P - z) / P;
        c.sc = {
          x: (r() - 0.5) * vw * 0.9 * s,
          y: (r() - 0.5) * vh * 0.9 * s,
          z,
          rx: (r() - 0.5) * 70,
          ry: (r() - 0.5) * 70,
          o: r() < visibleRatio ? 0.6 + r() * 0.3 : 0,
        };
      }
      this._sig = '';
    }

    animateTo(to, dur, hooks = {}) {
      if (REDUCED) dur = 0;
      this.anim = { from: this.progress, to, dur, start: performance.now(), ...hooks };
      this._sig = '';
    }

    /* input: dy in px, positive = forward (next card) */
    scrollBy(dy) {
      this.target = clamp(this.target + dy / (this.vh * 0.55), 0, this.max);
      this.lastInput = performance.now();
    }
    stepBy(n) {
      this.target = clamp(Math.round(this.target) + n, 0, this.max);
      this.lastInput = 0;
    }
    get atTop() { return this.target <= 0.001; }
    get atBottom() { return this.target >= this.max - 0.001; }
    jumpTo(i) { this.target = this.cur = clamp(i, 0, this.max); this.lastInput = 0; this._sig = ''; }

    /* geometry for a fractional distance from the current card */
    pose(d) {
      const first = POSES[0], last = POSES[POSES.length - 1];
      const y = (q) => (q.yV || 0) * this.vh + q.yH * this.H;
      if (d <= first.d) return { y: y(first), z: first.z, rx: first.rx, o: first.o };
      if (d >= last.d) return { y: y(last), z: last.z, rx: last.rx, o: last.o };
      let k = 0;
      while (POSES[k + 1].d < d) k++;
      const a = POSES[k], b = POSES[k + 1];
      const t = smooth((d - a.d) / (b.d - a.d));
      return { y: lerp(y(a), y(b), t), z: lerp(a.z, b.z, t), rx: lerp(a.rx, b.rx, t), o: lerp(a.o, b.o, t) };
    }

    bind() {
      const el = this.el;
      let down = null;

      el.addEventListener('pointerdown', (e) => {
        if (this.mode !== 'archive' || e.button !== 0) return;
        down = {
          y: e.clientY, target: this.target, raw: this.target,
          lastY: e.clientY, lastT: performance.now(), v: 0, moved: false,
          card: e.target.closest('.item'),
        };
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
      });
      el.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dy = e.clientY - down.y;
        if (!down.moved && Math.abs(dy) > 6) { down.moved = true; el.classList.add('is-dragging'); }
        if (!down.moved) return;
        down.raw = down.target - dy / (this.vh * 0.5);
        // resistance past either end
        this.target = down.raw < 0 ? down.raw * 0.3 : down.raw > this.max ? this.max + (down.raw - this.max) * 0.3 : down.raw;
        const now = performance.now(), dt = Math.max(1, now - down.lastT);
        down.v = ((e.clientY - down.lastY) / dt) * 16;
        down.lastY = e.clientY; down.lastT = now;
        this.lastInput = now;
      });
      const up = () => {
        if (!down) return;
        if (down.moved) {
          el.classList.remove('is-dragging');
          const coast = this.target - (down.v * 10) / (this.vh * 0.5);
          if ((down.raw < -0.35 || (this.target <= 0 && coast < -0.3)) && this.onOverscroll) this.onOverscroll('up');
          else if ((down.raw > this.max + 0.35 || (this.target >= this.max && coast > this.max + 0.3)) && this.onOverscroll) this.onOverscroll('down');
          this.target = clamp(coast, 0, this.max);
          this.lastInput = performance.now();
        } else if (down.card) {
          const c = this.cards.find((c) => c.el === down.card);
          if (c) {
            // the facing card opens; any other card scrolls into place
            if (Math.abs(c.i - this.cur) < 0.5) { if (this.onOpen) this.onOpen(c.item); }
            else { this.target = c.i; this.lastInput = 0; }
          }
        }
        down = null;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);

      let rt, lastW = window.innerWidth, lastH = window.innerHeight;
      window.addEventListener('resize', () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 160) return;
          lastW = window.innerWidth; lastH = window.innerHeight;
          this.layout();
          this.render(true);
        }, 120);
      });
    }

    loop(now) {
      // snap to a whole card once the input has rested
      if (this.mode === 'archive' && now - this.lastInput > 140) {
        const snapped = clamp(Math.round(this.target), 0, this.max);
        if (snapped !== this.target) this.target = snapped;
      }
      const prev = this.cur;
      const k = REDUCED ? 1 : 0.11;
      this.cur = lerp(this.cur, this.target, k);
      if (Math.abs(this.target - this.cur) < 0.0015) this.cur = this.target;
      this.vel = this.cur - prev;

      if (this.anim) {
        const a = this.anim;
        const t = a.dur ? clamp((now - a.start) / a.dur, 0, 1) : 1;
        this.progress = lerp(a.from, a.to, easeInOutCubic(t));
        if (a.onUpdate) a.onUpdate(this.progress, t);
        if (t >= 1) { this.anim = null; if (a.onDone) a.onDone(); }
      }

      // the card facing you (for the chrome + inline video)
      const idx = clamp(Math.round(this.cur), 0, this.max);
      if (idx !== this.index) {
        this.index = idx;
        if (this.onChange) this.onChange(idx, this.cards[idx].item);
      }
      // the clip on the facing card plays as soon as it comes to the front — mid-scroll, not
      // only once the stack has settled (a little hysteresis so it doesn't flicker at the edge);
      // the next card's clip is fetched ahead so it starts the moment it arrives
      const live = this.mode === 'archive' && this.progress >= 1 && !this.hidden && !this.paused;
      for (const c of this.cards) {
        if (!c.item.video) continue;
        const d = Math.abs(c.i - this.cur);
        const want = live && (c.on ? d < 0.62 : d < 0.42);
        if (want && !c.on) this.play(c);
        else if (!want && c.on) this.stop(c);
        else if (live && !c.video && c.i === idx + 1) this.warm(c);
      }

      if (!this.hidden) this.render();
      requestAnimationFrame(this.loop);
    }

    warm(c) {
      const item = c.item;
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.poster = item.src;
      v.style.objectPosition = `50% ${item.focus || 50}%`;
      v.src = item.video + '#t=' + (item.posterAt || 1);
      v.addEventListener('playing', () => { if (c.on) c.el.classList.add('is-playing'); });
      c.el.appendChild(v);
      c.video = v;
    }
    play(c) {
      const item = c.item;
      if (!c.video) this.warm(c);
      c.on = true;
      if (c.video.readyState >= 2) { c.video.currentTime = item.posterAt || 1; c.el.classList.add('is-playing'); }
      const p = c.video.play();
      if (p && p.catch) p.catch(() => {});
    }
    stop(c) {
      c.on = false;
      if (c.video) c.video.pause();
      c.el.classList.remove('is-playing');
    }

    render(force) {
      const { vw, W, H, cy, cur } = this;
      const p = this.progress;
      const sig = `${cur.toFixed(4)}|${p.toFixed(4)}|${W}`;
      if (!force && sig === this._sig) return false;
      this._sig = sig;

      const x0 = (vw - W) / 2;
      const y0 = cy - H / 2;
      for (const c of this.cards) {
        const d = c.i - cur;
        const near = d > -4.5 && d < 2.5;
        if (!near && p >= 1) {
          if (c.os !== '0') { c.el.style.opacity = '0'; c.os = '0'; }
          continue;
        }
        const q = this.pose(d);
        let x = x0, y = y0 + q.y, z = q.z, rx = q.rx, ry = 0, o = near ? q.o : 0;
        if (p < 1) {
          const s = c.sc;
          x = lerp(vw / 2 + s.x - W / 2, x, p);
          y = lerp(this.vh / 2 + s.y - H / 2, y, p);
          z = lerp(s.z, z, p);
          rx = lerp(s.rx, rx, p);
          ry = lerp(s.ry, 0, p);
          o = lerp(s.o, o, easeOutCubic(p));
          if (this.mode === 'intro' && p === 0) o = 0.02; // parked under the hero: drawn but unseen
        }
        const tf = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        if (tf !== c.tf) { c.el.style.transform = tf; c.tf = tf; }
        const os = o >= 0.999 ? '1' : o.toFixed(3);
        if (os !== c.os) { c.el.style.opacity = os; c.os = os; }
        const zi = String(100 - Math.round(Math.min(9, Math.abs(d)) * 10));
        if (zi !== c.zi) { c.el.style.zIndex = zi; c.zi = zi; }
        const isCur = Math.abs(d) < 0.5;
        if (isCur !== c.isCur) { c.el.classList.toggle('is-current', isCur); c.isCur = isCur; }
      }
      return true;
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
  $$('[data-mail-cta]').forEach((el) => { el.href = `mailto:${CONFIG.bookingEmail}?subject=${mailSubject}`; });
  $$('[data-mail-text]').forEach((el) => { el.textContent = `${CONFIG.bookingEmail} ↗`; });
  $$('[data-whatsapp-text]').forEach((el) => { el.textContent = `${CONFIG.whatsapp} ↗`; });
  $$('[data-instagram-text]').forEach((el) => { const m = (CONFIG.instagram || '').match(/instagram\.com\/([^/?#]+)/); el.textContent = (m ? '@' + m[1] : 'Instagram') + ' ↗'; });
  const waDigits = (CONFIG.whatsapp || '').replace(/\D/g, '');
  $$('[data-whatsapp]').forEach((el) => { el.href = `https://wa.me/${waDigits}?text=${encodeURIComponent('Hi NorthSoul — I\'d like to book a night.')}`; });
  $$('[data-instagram]').forEach((el) => { el.href = CONFIG.instagram; });
  // the clock on the contact panel: his local time
  (function localTime() {
    const els = $$('[data-local-time]');
    if (!els.length) return;
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' });
    const tick = () => { const t = fmt.format(new Date()); els.forEach((el) => (el.textContent = t)); };
    tick();
    setInterval(tick, 30000);
  })();
  const nav = $('#nav');
  document.title = `${CONFIG.brand} — ${CONFIG.tagline}`;

  /* ------------------------------------------------------------
     Story (Book page): two scroll-driven steps on one pinned screen
     ------------------------------------------------------------ */
  const story = $('#story');
  const storyItems = $$('#storyIndex li');
  const storyPanels = $$('.story__panel');
  const STEPS = storyItems.length;
  let storyStep = -1;

  const storyClip = $('.story__clip', story);
  function nightClip(on) {
    if (!storyClip) return;
    if (on) {
      if (!storyClip.src) { storyClip.preload = 'auto'; storyClip.src = storyClip.dataset.src; }
      storyClip.play().catch(() => {});
    } else if (storyClip.src) storyClip.pause();
  }
  function setStoryStep(step) {
    if (step === storyStep) return;
    storyStep = step;
    story.dataset.step = String(step);
    nightClip(step === STEPS - 1);
    storyItems.forEach((li, i) => li.classList.toggle('is-active', i === step));
    storyPanels.forEach((p, i) => p.classList.toggle('is-active', i === step));
  }

  let storyRaf = 0;
  function updateStory() {
    storyRaf = 0;
    if (current !== 'book') return;
    const vh = window.innerHeight;
    const total = Math.max(1, story.offsetHeight - vh);
    const p = clamp((window.scrollY - story.offsetTop) / total, 0, 1);
    setStoryStep(Math.min(STEPS - 1, Math.floor(p * STEPS + 0.0001)));
    story.classList.toggle('is-done', p > 0.9);
    // the story is dark: the header goes light while its pinned screen is on
    const y = window.scrollY, top = story.offsetTop, end = top + story.offsetHeight - vh;
    body.classList.toggle('is-night', y > top - vh * 0.5 && y < end + vh * 0.5);
  }
  window.addEventListener('scroll', () => { if (!storyRaf) storyRaf = requestAnimationFrame(updateStory); }, { passive: true });
  window.addEventListener('resize', () => { if (!storyRaf) storyRaf = requestAnimationFrame(updateStory); });
  $$('[data-step]', story).forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.step;
    const total = story.offsetHeight - window.innerHeight;
    window.scrollTo({ top: story.offsetTop + (total * (i + 0.35)) / STEPS, behavior: 'smooth' });
  }));

  // Trusted by: the venue strip (list twice so the loop is seamless)
  (function renderVenues() {
    const track = $('#venues');
    if (!track || !VENUES || !VENUES.length) { if (track) track.closest('.trusted').hidden = true; return; }
    const make = (v) => {
      const el = document.createElement('div');
      el.className = 'marquee__item' + (v.logo ? '' : ' marquee__item--text');
      el.title = [v.name, v.city].filter(Boolean).join(', ');
      if (v.logo) {
        const img = document.createElement('img');
        img.src = v.logo; img.alt = v.name; img.draggable = false; img.decoding = 'async';
        el.appendChild(img);
      } else {
        el.textContent = v.name;
      }
      if (v.city && !v.logo) {
        const c = document.createElement('span'); c.className = 'marquee__city'; c.textContent = v.city; el.appendChild(c);
      }
      return el;
    };
    for (let r = 0; r < 2; r++) VENUES.forEach((v) => track.appendChild(make(v)));
  })();

  // Next event (first step of the story)
  (function renderNextEvent() {
    const n = CONFIG.nextEvent;
    const box = $('#nextEvent');
    if (!n || !box) return;
    $('[data-next-banner]', box).src = n.banner || CONFIG.aboutImage;
    $$('[data-next-banner-bg]').forEach((el) => (el.src = n.banner || CONFIG.aboutImage));
    $('[data-next-title]', box).textContent = [n.title, n.city].filter(Boolean).join(' — ') || 'Next event';
    const setRow = (name, value) => {
      const row = $(`[data-next-row="${name}"]`, box);
      row.hidden = !value;
      if (value) $(`[data-next-${name}]`, box).textContent = value;
    };
    const d = n.date ? new Date(n.date + 'T12:00:00') : null;
    const count = $('[data-next-count]', box);
    if (d && !isNaN(d)) {
      $('[data-next-date]', box).textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      // the countdown: big while the night is still ahead
      const days = Math.ceil((d - new Date()) / 86400000);
      if (days >= 0) {
        $('[data-next-days]', box).textContent = days === 0 ? 'Tonight' : String(days).padStart(2, '0');
        $('[data-next-unit]', box).textContent = days === 0 ? '' : days === 1 ? 'day to go' : 'days to go';
        count.hidden = false;
      }
    } else {
      $('[data-next-date]', box).textContent = 'To be announced';
    }
    setRow('city', n.city || '');
    setRow('note', n.note || '');
    const link = $('[data-next-link]', box);
    if (n.link) { link.href = n.link; link.hidden = false; }
  })();

  /* ------------------------------------------------------------
     Archive chrome: title / tag, counter, thumbnails
     ------------------------------------------------------------ */
  // the stack opens with a few highlights; the button below brings in the rest
  const HIGHLIGHTS = MEDIA.slice(0, Math.max(1, Math.min(MEDIA.length, CONFIG.highlights || MEDIA.length)));
  let showingAll = HIGHLIGHTS.length === MEDIA.length;
  const stack = new Stack($('#stack'), HIGHLIGHTS);
  window.__stack = stack; // console debugging
  const seeAll = $('#seeAll');
  const ftrCount = $('#ftrCount');
  const indexImgs = $$('#index .index__thumbs img');
  const pad2 = (n) => String(n).padStart(2, '0');

  stack.onChange = (i, item) => {
    ftrCount.textContent = `${pad2(i + 1)} / ${pad2(stack.cards.length)}`;
    indexImgs[0].src = item.src;
    const next = stack.cards[i + 1] && stack.cards[i + 1].item;
    if (next) indexImgs[1].src = next.src;
    indexImgs[1].style.visibility = next ? '' : 'hidden';
  };
  stack.onChange(0, HIGHLIGHTS[0]);

  function labelSeeAll() {
    seeAll.hidden = HIGHLIGHTS.length === MEDIA.length;
    seeAll.textContent = showingAll ? 'Less' : 'More';
  }
  labelSeeAll();
  seeAll.addEventListener('click', () => {
    if (phase !== 'stack') return;
    showingAll = !showingAll;
    const keep = stack.index;
    stack.setItems(showingAll ? MEDIA : HIGHLIGHTS);
    stack.index = -1;                       // re-announce the current card (new counter)
    stack.jumpTo(Math.min(keep, stack.max));
    stack.render(true);
    labelSeeAll();
  });
  stack.onOverscroll = (dir) => { if (dir === 'up') leaveStackUp(); else goBook(); };
  stack.onOpen = (item) => openPlayer(item);

  /* ------------------------------------------------------------
     Player
     ------------------------------------------------------------ */
  const player = $('#player');
  const playerStage = $('#playerStage');
  const playerTitle = $('#playerTitle');
  const playerMeta = $('#playerMeta');
  const playerPlay = $('#playerPlay');
  const playerLine = $('.player__line span', player);
  const playerBg = $('.player__bg img', player);
  const playerIndex = $('.player__index img', player);
  let playerOpen = false;
  let playerVideo = null;

  const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');

  function setPlayState(state) {
    playerPlay.dataset.state = state;
    $('.player__label', playerPlay).textContent = state === 'playing' ? 'Pause' : 'Play';
  }

  function openPlayer(item) {
    if (playerOpen) return;
    playerOpen = true;
    stack.paused = true;
    body.classList.add('is-player');
    playerBg.src = item.src;
    playerIndex.src = item.src;
    playerTitle.textContent = item.title;
    playerStage.innerHTML = '';
    playerLine.style.height = '0';
    playerStage.style.setProperty('--ar', '1.6');
    if (item.video) {
      const v = document.createElement('video');
      v.src = item.video; v.poster = item.src; v.loop = true; v.playsInline = true; v.autoplay = true;
      v.addEventListener('loadedmetadata', () => { if (v.videoWidth) playerStage.style.setProperty('--ar', (v.videoWidth / v.videoHeight).toFixed(4)); });
      playerStage.appendChild(v);
      playerVideo = v;
      playerPlay.hidden = false;
      setPlayState('playing');
      playerMeta.textContent = 'Video';
      v.addEventListener('loadedmetadata', () => { playerMeta.textContent = `Video · ${fmt(v.duration)}`; });
      v.addEventListener('timeupdate', () => { if (v.duration) playerLine.style.height = ((v.currentTime / v.duration) * 100).toFixed(1) + '%'; });
      const p = v.play(); if (p && p.catch) p.catch(() => setPlayState('paused'));
    } else {
      const im = document.createElement('img');
      im.src = item.src; im.alt = item.title;
      playerStage.appendChild(im);
      playerVideo = null;
      playerPlay.hidden = true;
      playerMeta.textContent = 'Photo' + (item.year ? ` · ${item.year}` : '');
    }
    player.hidden = false;
    requestAnimationFrame(() => player.classList.add('is-open'));
  }
  function closePlayer() {
    if (!playerOpen) return;
    playerOpen = false;
    stack.paused = false;
    body.classList.remove('is-player');
    player.classList.remove('is-open');
    if (playerVideo) { playerVideo.pause(); playerVideo = null; }
    setTimeout(() => { if (!playerOpen) { player.hidden = true; playerStage.innerHTML = ''; } }, 450);
  }
  $('.player__back', player).addEventListener('click', closePlayer);
  playerPlay.addEventListener('click', () => {
    if (!playerVideo) return;
    if (playerVideo.paused) { playerVideo.play(); setPlayState('playing'); }
    else { playerVideo.pause(); setPlayState('paused'); }
  });
  playerStage.addEventListener('click', () => playerPlay.click());
  window.addEventListener('keydown', (e) => {
    if (!playerOpen) return;
    if (e.key === 'Escape') closePlayer();
    if (e.key === ' ') { e.preventDefault(); playerPlay.click(); }
  });

  /* ------------------------------------------------------------
     About — the dark chapter after the hero
     Four words on the right (story · sound · stages · contact); hovering
     or scrolling picks one, the panel on the left answers it and the two
     clips behind swap along. One more scroll past the last word and the
     cards fly in; scrolling up from the first brings the title back.
     ------------------------------------------------------------ */
  const about = $('#about');
  const aboutWords = $$('.about__word', about);
  const aboutPanels = $$('.about__panel', about);
  const aboutClips = $$('.about__clip', about);
  const aboutDip = $('.about__dip', about);
  const aboutCount = $('#aboutCount');
  const CHAPTERS = aboutWords.length;
  let chapter = -1, clipOn = -1, dipTimer = 0, aboutHideTimer = 0, aboutWarm = false;
  let aboutAcc = 0, aboutOver = 0, aboutStepUntil = 0;

  // fetch the two clips ahead of time (called once the hero is half-way through)
  function warmAbout() {
    if (aboutWarm) return;
    aboutWarm = true;
    aboutClips.forEach((v) => { v.preload = 'auto'; v.src = v.dataset.src; v.load(); });
    if (document.fonts && document.fonts.load) document.fonts.load('400 20px Anton').catch(() => {}); // the menu's face, before it shows
  }
  // Both clips run the whole time the chapter is on; a switch dips through
  // black and cuts. (Fading a video's opacity keeps the compositor busy for
  // a while, which the cards flying in right after can't afford.)
  function setClip(k) {
    if (k === clipOn) return;
    const fresh = clipOn < 0;
    clipOn = k;
    const cut = () => aboutClips.forEach((c, j) => c.classList.toggle('is-on', j === k));
    clearTimeout(dipTimer);
    if (fresh || REDUCED) { aboutDip.classList.remove('is-on'); cut(); return; }
    aboutDip.classList.add('is-on');
    dipTimer = setTimeout(() => { cut(); aboutDip.classList.remove('is-on'); }, 320);
  }
  function setChapter(i) {
    i = clamp(i, 0, CHAPTERS - 1);
    aboutAcc = 0;
    if (i === chapter) return;
    chapter = i;
    aboutWords.forEach((w, k) => w.classList.toggle('is-active', k === i));
    aboutPanels.forEach((p, k) => p.classList.toggle('is-active', k === i));
    setClip(+aboutWords[i].dataset.clip || 0);
    aboutCount.textContent = `${pad2(i + 1)} / ${pad2(CHAPTERS)}`;
  }
  aboutWords.forEach((w, i) => {
    w.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') setChapter(i); });
    w.addEventListener('click', () => setChapter(i));
  });
  function showAbout(i) {
    clearTimeout(aboutHideTimer);
    warmAbout();
    aboutClips.forEach((v) => v.play().catch(() => {}));
    body.classList.add('is-about');
    aboutOver = 0;
    aboutStepUntil = 0;
    chapter = -1;
    setChapter(i);
    void about.offsetWidth; // commit display:block + the row before the fade starts
    about.classList.add('is-on');
    about.setAttribute('aria-hidden', 'false');
    $$('a[data-route="about"]', nav).forEach((a) => a.classList.add('is-active'));
  }
  function hideAbout() {
    about.classList.remove('is-on');
    about.setAttribute('aria-hidden', 'true');
    $$('a[data-route="about"]', nav).forEach((a) => a.classList.remove('is-active'));
    aboutClips.forEach((v) => v.pause());
    clearTimeout(dipTimer);
    clearTimeout(aboutHideTimer);
    aboutHideTimer = setTimeout(() => {
      body.classList.remove('is-about');
      clipOn = -1;
    }, 850);
  }
  // wheel / keys / finger while the chapter is on: one word per flick; keep pushing at either end to leave
  function aboutInput(dy) {
    const now = performance.now();
    if (now < aboutStepUntil) { aboutOver = 0; return; }
    const first = chapter === 0 && dy < 0, last = chapter === CHAPTERS - 1 && dy > 0;
    if (first || last) {
      aboutOver += Math.abs(dy);
      if (aboutOver > 150) { aboutOver = 0; if (first) leaveAboutUp(); else enterStack(); }
      return;
    }
    aboutOver = 0;
    aboutAcc += dy;
    if (Math.abs(aboutAcc) > 80) { setChapter(chapter + Math.sign(aboutAcc)); aboutStepUntil = now + 420; }
  }

  /* ------------------------------------------------------------
     Landing hero
     Scroll scrubs `heroP` 0→1: "NorthSoul" parts into the About hero
     (words drift to the corners, the portrait fades in). Scrolling past
     the end hands over to the About chapter; scrolling up from its first
     word brings the hero back.
     ------------------------------------------------------------ */
  const hero = $('#hero');
  const heroL = $('.hero__name--l', hero);
  const heroR = $('.hero__name--r', hero);
  const heroTag = $('.hero__tag', hero);
  const heroSub = $('.hero__sub', hero);
  const heroImg = $('.hero__img', hero);
  const heroCta = $('#heroCta');
  const hdr = $('.hdr');

  let introDone = false;  // the hero plays on every load; within the session, Back / Archive return to the stack
  // 'hero' (scrubbing) | 'about' (the chapter) | 'gather' (cards flying, no input) | 'stack'
  let phase = 'stack';
  let heroP = 0, heroTarget = 0, heroOverflow = 0, heroAuto = false;
  let heroLayout = null;
  let edgeAcc = 0;          // wheel pushed past the first / last card
  let inputLockUntil = 0;   // brief cooldown after each hand-over
  const lockInput = (ms) => { inputLockUntil = performance.now() + ms; };

  function measureHero() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const mobile = vw < 640;
    const fsEnd = mobile ? clamp(vw * 0.22, 64, 120) : clamp(vw * 0.175, 84, 290);
    heroL.style.fontSize = heroR.style.fontSize = fsEnd + 'px';
    const wN = heroL.offsetWidth, wS = heroR.offsetWidth;
    const fsStart = Math.min(fsEnd, (fsEnd * vw * 0.88) / (wN + wS));
    const k = fsStart / fsEnd;
    const x0 = (vw - (wN + wS) * k) / 2;
    const edge = mobile ? vw * 0.05 : vw * 0.025;
    heroLayout = {
      fsStart, fsEnd, k, hN: heroL.offsetHeight, hS: heroR.offsetHeight,
      n0: { x: x0, y: vh * 0.5 },
      s0: { x: x0 + wN * k, y: vh * 0.5 },
      n1: { x: edge, y: mobile ? vh * 0.24 : vh * 0.60 },
      s1: { x: vw - edge - wS, y: mobile ? vh * 0.80 : vh * 0.81 },
      tagY: vh * 0.5 + fsStart * 0.42 + 26,
    };
  }

  function renderHero() {
    const L = heroLayout;
    const e = easeInOutCubic(heroP);
    const sc = lerp(L.k, 1, e);
    const nx = lerp(L.n0.x, L.n1.x, e), ny = lerp(L.n0.y, L.n1.y, e) - (L.hN * sc) / 2;
    const sx = lerp(L.s0.x, L.s1.x, e), sy = lerp(L.s0.y, L.s1.y, e) - (L.hS * sc) / 2;
    heroL.style.transform = `translate3d(${nx.toFixed(2)}px, ${ny.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
    heroR.style.transform = `translate3d(${sx.toFixed(2)}px, ${sy.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
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

  let heroLast = -1;
  function heroLoop() {
    if (phase !== 'hero') return;
    heroP = REDUCED ? heroTarget : lerp(heroP, heroTarget, 0.11);
    if (Math.abs(heroTarget - heroP) < 0.0005) heroP = heroTarget;
    if (heroP !== heroLast) { renderHero(); heroLast = heroP; }
    if (!aboutWarm && heroP > 0.5) warmAbout();
    if (heroAuto && heroP >= 0.995) enterAbout();
    requestAnimationFrame(heroLoop);
  }

  function heroInput(dy) {
    if (heroTarget >= 1 && dy > 0) {
      // keep pushing once the words have settled: a hard flick shouldn't skip the split
      if (heroP > 0.9) heroOverflow += dy;
      if (heroOverflow > 120) enterAbout();
      return;
    }
    heroOverflow = 0;
    heroTarget = clamp(heroTarget + dy / 900, 0, 1);
  }

  let heroHideTimer = 0;
  function showHero(atEnd) {
    clearTimeout(heroHideTimer);
    phase = 'hero';
    heroAuto = false;
    heroOverflow = 0;
    heroP = heroTarget = atEnd ? 1 : 0;
    body.classList.add('is-hero');
    hero.classList.remove('is-entering');
    hero.style.opacity = '';
    measureHero();
    heroLast = -1;
    renderHero();
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
    // park the stack scattered behind the (opaque) hero, ready to fly in
    stack.mode = 'intro';
    stack.anim = null;
    stack.progress = 0;
    stack.jumpTo(0);
    stack.reseedScatter();
    stack.render(true);
    stack.hidden = true;
  }

  /* Hero → about: the chapter fades in over the finished title. */
  function enterAbout() {
    if (phase !== 'hero') return;
    phase = 'about';
    heroAuto = false;
    heroOverflow = 0;
    hdr.style.opacity = '';
    hdr.classList.remove('is-hidden');
    showAbout(0);
    lockInput(700);
    clearTimeout(heroHideTimer);
    heroHideTimer = setTimeout(() => {
      body.classList.remove('is-hero');
      hero.classList.remove('is-ready', 'is-entering');
      hero.style.opacity = '';
    }, 900);
  }

  /* About → hero (scrolled up on the first word): the chapter fades, the title is waiting beneath. */
  function leaveAboutUp() {
    if (phase !== 'about') return;
    showHero(true);
    hideAbout();
    lockInput(700);
  }

  /* About → stack: the chapter fades while the cards gather. */
  function enterStack() {
    if (phase !== 'about') return;
    phase = 'gather';
    stack.hidden = false;
    stack.mode = 'intro';
    hideAbout();
    stack.animateTo(1, REDUCED ? 0 : 1600, {
      onDone: () => {
        phase = 'stack';
        edgeAcc = 0;
        stack.mode = 'archive';
        introDone = true;
        lockInput(450);
        if (heroRequested) { heroRequested = false; goHero(); }
        else if (aboutRequested) { aboutRequested = false; goAbout(); }
      },
    });
  }

  /* Stack → about (scrolled up from the first card): the cards scatter and the chapter
     fades in on its last word — or, for the logo, straight back to the title. */
  function leaveStackUp() {
    if (phase !== 'stack' || stack.anim) return;
    phase = 'gather';
    stack.mode = 'intro';
    stack.jumpTo(0);
    stack.reseedScatter();
    const toHero = heroToStart || heroRequested;
    if (toHero) {
      body.classList.add('is-hero');
      hero.classList.add('is-ready', 'is-entering');
      hero.style.opacity = '0';
      heroP = heroTarget = 1;
      measureHero();
      renderHero();
    }
    let shown = false;
    stack.animateTo(0, REDUCED ? 0 : 1400, {
      onUpdate: (p, t) => {
        if (toHero) hero.style.opacity = String(clamp((t - 0.25) / 0.5, 0, 1));
        else if (!shown && t > 0.3) { shown = true; showAbout(aboutToStart ? 0 : CHAPTERS - 1); }
      },
      onDone: () => {
        stack.hidden = true;
        stack.render(true); // last frame: parked at 0.02 so nothing ghosts through the hero
        lockInput(450);
        if (toHero) {
          showHero(true);
          heroToStart = false; heroRequested = false;
          heroTarget = 0;
        } else {
          phase = 'about';
          if (!shown) showAbout(aboutToStart ? 0 : CHAPTERS - 1);
          aboutToStart = false;
          if (aboutRequested) { aboutRequested = false; setChapter(0); }
          if (heroRequested) { heroRequested = false; goHero(); }
        }
      },
    });
  }

  function cancelHero() {
    if (phase === 'stack') return;
    phase = 'stack';
    heroAuto = false;
    if (body.classList.contains('is-about')) hideAbout();
    body.classList.remove('is-hero');
    hero.classList.remove('is-ready', 'is-entering');
    hero.style.opacity = '';
    hdr.style.opacity = '';
    hdr.classList.remove('is-hidden');
    stack.anim = null;
    stack.progress = 1;
  }

  window.addEventListener('resize', () => { if (phase === 'hero') { measureHero(); renderHero(); } });
  heroCta.addEventListener('click', () => {
    if (phase !== 'hero') return;
    if (heroTarget >= 1) enterAbout();
    else { heroTarget = 1; heroAuto = true; }
  });

  /* ------------------------------------------------------------
     One scroll: hero ⇄ about ⇄ stack ⇄ Book
     ------------------------------------------------------------ */
  let returnToBottom = false; // Book → stack lands on the last card
  let wantHero = false;       // logo clicked from another page: land on the hero
  let heroToStart = false;    // logo clicked on the stack: after the cards scatter, rejoin the title
  let heroRequested = false;  // logo clicked while the cards were still flying: go once they land
  let wantAbout = false;      // About clicked from another page: land on the chapter
  let aboutToStart = false;   // About clicked on the stack: after the cards scatter, open on the first word
  let aboutRequested = false; // About clicked while the cards were still flying

  function goHero() {
    if (current === 'archive') {
      closePlayer();
      if (phase === 'stack') {
        if (stack.anim) { heroRequested = true; return; }
        heroToStart = true; leaveStackUp();
      } else if (phase === 'hero') {
        heroAuto = false; heroOverflow = 0; heroTarget = 0;
      } else if (phase === 'about') {
        leaveAboutUp();
        heroTarget = 0; // the title rejoins while the chapter fades
      } else {
        heroRequested = true; // 'gather': finish the flight first
      }
      return;
    }
    wantHero = true;
    location.hash = '#/';
  }
  $$('[data-logo], [data-logo-inline]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goHero(); }));

  function goAbout() {
    if (current === 'archive') {
      closePlayer();
      if (phase === 'about') setChapter(0);
      else if (phase === 'hero') { heroAuto = true; heroTarget = 1; } // finish the title, then the chapter fades in
      else if (phase === 'stack') {
        if (stack.anim) { aboutRequested = true; return; }
        aboutToStart = true; leaveStackUp();
      } else aboutRequested = true; // 'gather'
      return;
    }
    wantAbout = true;
    location.hash = '#/';
  }
  $$('a[data-route="about"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); goAbout(); }));
  let bookAcc = 0;
  let bookStep = -1;          // step to open the Book page on (-1 = top)

  function goBook() {
    if (phase !== 'stack') return;
    lockInput(600);
    location.hash = '#/book';
  }

  function landingInput(dy) {
    if (performance.now() < inputLockUntil || playerOpen) return;
    if (phase === 'hero') { heroInput(dy); return; }
    if (phase === 'about') { aboutInput(dy); return; }
    if (phase !== 'stack') return;
    stack.scrollBy(dy);
    if (stack.atTop && dy < 0) {
      edgeAcc += -dy;
      if (edgeAcc > 160) { edgeAcc = 0; leaveStackUp(); }
    } else if (stack.atBottom && dy > 0) {
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
      if (window.scrollY <= 0 && dy < 0) {
        bookAcc += -dy;
        if (bookAcc > 180) { bookAcc = 0; returnToBottom = true; location.hash = '#/'; }
      } else bookAcc = 0;
    }
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (current !== 'archive' || playerOpen) return;
    const down = ['ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key);
    const up = ['ArrowUp', 'PageUp'].includes(e.key);
    if (!down && !up) return;
    e.preventDefault();
    if (phase === 'stack') {
      if (down && stack.atBottom) { goBook(); return; }
      if (up && stack.atTop) { leaveStackUp(); return; }
      stack.stepBy(down ? 1 : -1);
    } else {
      landingInput(down ? 360 : -360);
    }
  });

  // touch: the hero is scrubbed by finger; the stack itself is dragged (pointer events)
  let touchY = null;
  window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (touchY == null) return;
    const y = e.touches[0].clientY;
    const dy = touchY - y;
    touchY = y;
    if (current === 'archive' && phase === 'hero') landingInput(dy * 2.2);
    else if (current === 'archive' && phase === 'about') landingInput(dy * 1.2);
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
    if (name !== 'archive') { cancelHero(); closePlayer(); }
    if (name !== 'book') { body.classList.remove('is-night'); nightClip(false); }
    stack.hidden = name !== 'archive' && name !== '404';
    if (name === 'archive') {
      if (returnToBottom) {
        returnToBottom = false;
        introDone = true;
        stack.mode = 'archive';
        stack.jumpTo(stack.max);
        lockInput(500);
      } else if (wantAbout) {
        // straight to the chapter: the title is parked at its end pose underneath
        wantAbout = false;
        startHero();
        heroP = heroTarget = 1;
        renderHero();
        enterAbout();
      } else if (!introDone || wantHero) {
        wantHero = false;
        startHero();
      } else {
        stack.mode = 'archive';
      }
      edgeAcc = 0;
    } else {
      stack.mode = 'ghost';
      if (name === '404') stack.jumpTo(0);
    }
    bookAcc = 0;
    window.scrollTo(0, 0);
    current = name;
    if (name === 'book') {
      storyStep = -1;
      if (bookStep >= 0) {
        // jump to that step's scroll position (no animation: the page has only just appeared)
        const total = story.offsetHeight - window.innerHeight;
        window.scrollTo(0, story.offsetTop + (total * (bookStep + 0.35)) / STEPS);
        bookStep = -1;
      }
      updateStory();
    }
  }

  function go(name, setup) {
    if (setup) setup();
    if (first || REDUCED || name === current) {
      first = false;
      activate(name);
      return;
    }
    if (phase === 'about') hideAbout(); // the chapter fades with the page it is leaving
    body.classList.add('is-leaving');
    setTimeout(() => {
      activate(name);
      requestAnimationFrame(() => body.classList.remove('is-leaving'));
    }, 380);
  }

  function route() {
    const hash = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
    const [name, sub] = hash.split('/');
    if (!name) return go('archive', () => (document.title = `${CONFIG.brand} — ${CONFIG.tagline}`));
    if (name === 'about') {
      // the About chapter lives in the main scroll: send it there and keep the address clean
      history.replaceState(null, '', location.pathname + location.search + '#/');
      if (current === 'archive') return goAbout();
      wantAbout = true;
      return go('archive', () => (document.title = `${CONFIG.brand} — ${CONFIG.tagline}`));
    }
    if (name === 'book') {
      // #/book/night lands straight on the "Book the night" step; plain #/book (from the stack) starts at the top
      bookStep = sub === 'night' ? STEPS - 1 : -1;
      return go('book', () => (document.title = `Book — ${CONFIG.brand}`));
    }
    go('404', () => (document.title = `404 — ${CONFIG.brand}`));
  }

  window.addEventListener('hashchange', route);
  // a fresh load always opens on the hero; only the 404 page keeps its own address
  if (location.hash && location.hash !== '#/' && !/^#\/?404/.test(location.hash)) {
    history.replaceState(null, '', location.pathname + location.search + '#/');
  }
  route();

  // console debugging
  window.__ns = { get phase() { return phase; }, get heroP() { return heroP; }, get heroTarget() { return heroTarget; }, get chapter() { return chapter; }, get route() { return current; }, get player() { return playerOpen; } };
})();
