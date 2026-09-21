/* ==========================================================
   FEATURES: interactive terminal, dark/light/hacker themes,
   sound effects, cursor effects, funny touches.
   Self-contained. Remove the <script src="features.js"> tag
   (and the features.css <link>) to switch all of it off.
   ========================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  function mq(q) { return window.matchMedia ? window.matchMedia(q).matches : false; }
  var reduceMotion = mq('(prefers-reduced-motion: reduce)');
  var finePointer = mq('(pointer: fine)');

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }

  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function clean(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function h(tag, attrs, text) {
    var e = doc.createElement(tag);
    if (attrs) { for (var k in attrs) { if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); } }
    if (text != null) e.textContent = text;
    return e;
  }

  function whenBootDone(fn) {
    if (!root.classList.contains('boot-active')) { fn(); return; }
    var mo = new MutationObserver(function () {
      if (!root.classList.contains('boot-active')) { mo.disconnect(); fn(); }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  var JOKES = [
    "It works on my machine 🤷",
    "There are 10 kinds of people: those who understand binary and those who don't.",
    "A SQL query walks into a bar, sees two tables and asks: “Can I join you?”",
    "!false — it's funny because it's true.",
    "I'd tell you a UDP joke, but you might not get it.",
    "Debugging: being the detective in a crime movie where you are also the murderer.",
    "There's no place like 127.0.0.1",
    "Real programmers count from 0.",
    "To understand recursion, you must first understand recursion.",
    "npm install: 1 package added, 1,483 packages audited. 😬",
    "MongoDB walks into a bar. There's no schema for that.",
    "90% of coding is Googling. The other 10% is Ctrl+C, Ctrl+V.",
    "404: Sleep not found."
  ];

  /* ---------------------------------------------------------
     SOUND  (tiny synthesized blips, no audio files)
     --------------------------------------------------------- */
  var Sound = {
    ctx: null,
    muted: lsGet('pf-sound') === 'off',
    get: function () {
      if (this.ctx) return this.ctx;
      // never try to start audio before the visitor has interacted with the page
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); } catch (e) { return null; }
      return this.ctx;
    },
    tone: function (f, d, type, vol, delay, to) {
      var c = this.ctx, t = c.currentTime + (delay || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + d + 0.03);
    },
    presets: {
      key:     function () { this.tone(1700 + Math.random() * 300, 0.025, 'square', 0.02); },
      enter:   function () { this.tone(880, 0.07, 'triangle', 0.05); },
      click:   function () { this.tone(680, 0.05, 'sine', 0.04, 0, 520); },
      tick:    function () { this.tone(1200, 0.03, 'square', 0.02); },
      open:    function () { this.tone(320, 0.13, 'triangle', 0.05, 0, 720); },
      close:   function () { this.tone(720, 0.13, 'triangle', 0.05, 0, 320); },
      toggle:  function () { this.tone(500, 0.12, 'sine', 0.05, 0, 900); },
      error:   function () { this.tone(150, 0.2, 'sawtooth', 0.045); },
      pop:     function () { this.tone(260, 0.16, 'triangle', 0.07, 0, 60); },
      ready:   function () { this.tone(660, 0.09, 'triangle', 0.05); this.tone(990, 0.14, 'triangle', 0.05, 0.09); },
      success: function () {
        var n = [523, 659, 784, 1047], i;
        for (i = 0; i < n.length; i++) this.tone(n[i], 0.12, 'triangle', 0.05, i * 0.08);
      }
    },
    play: function (name) {
      if (this.muted) return;
      var c = this.get();
      if (!c) return;
      if (c.state === 'suspended') { try { c.resume(); } catch (e) { /* ignore */ } }
      var p = this.presets[name];
      if (p) { try { p.call(this); } catch (e) { /* ignore */ } }
    },
    setMuted: function (m) { this.muted = !!m; lsSet('pf-sound', this.muted ? 'off' : 'on'); }
  };
  // lets the boot screen (inline script) tick along when audio is already allowed
  window.PortfolioSFX = { play: function (n) { Sound.play(n); } };

  /* ---------------------------------------------------------
     TOAST
     --------------------------------------------------------- */
  var Toast = {
    el: null, t: 0,
    show: function (msg, ms) {
      var self = this;
      if (!this.el) {
        this.el = h('div', { 'class': 'pf-toast', role: 'status', 'aria-live': 'polite' });
        doc.body.appendChild(this.el);
      }
      this.el.textContent = msg;
      void this.el.offsetWidth;
      this.el.classList.add('is-on');
      clearTimeout(this.t);
      this.t = setTimeout(function () { self.el.classList.remove('is-on'); }, ms || 2800);
    }
  };

  /* ---------------------------------------------------------
     FX  (cursor sparks + confetti share one canvas)
     --------------------------------------------------------- */
  var FX = {
    canvas: null, ctx: null, parts: [], raf: 0, last: 0, color: '#1abc9c', hacker: false,
    init: function () {
      if (this.canvas) return;
      this.canvas = h('canvas', { id: 'pf-fx', 'aria-hidden': 'true' });
      doc.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', function () { FX.resize(); });
    },
    resize: function () {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },
    refresh: function () {
      var v = getComputedStyle(root).getPropertyValue('--accent').trim();
      if (v) this.color = v;
      this.hacker = root.getAttribute('data-theme') === 'hacker';
    },
    add: function (p) {
      if (this.parts.length > 320) return;
      this.init();
      this.parts.push(p);
      if (!this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(FX.tick); }
    },
    tick: function (now) {
      var self = FX, ctx = self.ctx, dt = Math.min(0.05, (now - self.last) / 1000), i, p, a;
      self.last = now;
      ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
      for (i = self.parts.length - 1; i >= 0; i--) {
        p = self.parts[i];
        p.life -= dt;
        if (p.life <= 0) { self.parts.splice(i, 1); continue; }
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += (p.vr || 0) * dt;
        a = Math.min(1, (p.life / p.max) * 1.6);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        if (p.kind === 'char') {
          ctx.font = '14px monospace';
          ctx.fillText(p.ch, p.x, p.y);
        } else if (p.kind === 'rect') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, 6.2832);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (self.parts.length) { self.raf = requestAnimationFrame(FX.tick); }
      else { self.raf = 0; ctx.clearRect(0, 0, self.canvas.width, self.canvas.height); }
    },
    spark: function (x, y) {
      if (reduceMotion) return;
      var life = 0.45 + Math.random() * 0.4;
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ01';
      this.add({
        kind: this.hacker ? 'char' : 'dot',
        ch: chars.charAt(Math.floor(Math.random() * chars.length)),
        x: x, y: y,
        vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50 + 10,
        g: 40, life: life, max: life, size: 1.5 + Math.random() * 2.5, color: this.color, rot: 0
      });
    },
    burst: function (x, y, n) {
      if (reduceMotion) return;
      var i, ang, sp, life;
      for (i = 0; i < n; i++) {
        ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        sp = 70 + Math.random() * 110;
        life = 0.4 + Math.random() * 0.35;
        this.add({
          kind: 'dot', x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          g: 120, life: life, max: life, size: 1.5 + Math.random() * 2, color: this.color, rot: 0
        });
      }
    },
    confetti: function (x, y) {
      if (reduceMotion) return;
      var cols = this.hacker
        ? ['#00ff41', '#7dff9c', '#00c832', '#c8ffd6']
        : ['#1abc9c', '#60a5fa', '#a78bfa', '#fbbf24', '#f472b6', '#ffffff'];
      var i, ang, sp, life;
      for (i = 0; i < 130; i++) {
        ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        sp = 250 + Math.random() * 520;
        life = 1.6 + Math.random() * 1.4;
        this.add({
          kind: 'rect', x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          g: 900, life: life, max: life, size: 7 + Math.random() * 6,
          color: pick(cols), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12
        });
      }
    }
  };

  /* ---------------------------------------------------------
     MATRIX RAIN  (hacker theme): letters travel bottom → top
     --------------------------------------------------------- */
  var Matrix = {
    canvas: null, ctx: null, raf: 0, last: 0, cols: 0, rows: 0, heads: [], FS: 16, STEP_MS: 55,
    CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ',
    start: function () {
      if (this.canvas) return;
      this.canvas = h('canvas', { id: 'pf-matrix', 'aria-hidden': 'true' });
      doc.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      this._onResize = function () { Matrix.resize(); };
      window.addEventListener('resize', this._onResize);
      if (reduceMotion) return; // colours only, no movement
      this.raf = requestAnimationFrame(Matrix.loop);
    },
    stop: function () {
      if (!this.canvas) return;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      window.removeEventListener('resize', this._onResize);
      if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null; this.ctx = null; this.heads = [];
    },
    resize: function () {
      var c = this.canvas, i;
      if (!c) return;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      this.cols = Math.ceil(c.width / this.FS);
      this.rows = Math.ceil(c.height / this.FS);
      this.heads = [];
      for (i = 0; i < this.cols; i++) this.heads.push(Math.floor(Math.random() * this.rows));
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, c.width, c.height);
    },
    loop: function (now) {
      var m = Matrix;
      if (!m.canvas) return;
      m.raf = requestAnimationFrame(Matrix.loop);
      if (now - m.last < m.STEP_MS) return;
      m.last = now;
      var ctx = m.ctx, i, x, y, ch;
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, m.canvas.width, m.canvas.height);
      ctx.font = m.FS + 'px monospace';
      for (i = 0; i < m.cols; i++) {
        x = i * m.FS;
        y = m.heads[i] * m.FS;
        // the trail (previous head) turns green, the new head is bright
        ctx.fillStyle = '#00ff41';
        ctx.fillText(m.CHARS.charAt(Math.floor(Math.random() * m.CHARS.length)), x, y + m.FS);
        ch = m.CHARS.charAt(Math.floor(Math.random() * m.CHARS.length));
        ctx.fillStyle = '#eaffef';
        ctx.fillText(ch, x, y);
        m.heads[i]--;                                   // ← moves UP the screen
        if (m.heads[i] < -1 && Math.random() > 0.96) m.heads[i] = m.rows + Math.floor(Math.random() * 12);
      }
    }
  };

  /* ---------------------------------------------------------
     THEME  (dark = original, light, hacker)
     --------------------------------------------------------- */
  var Theme = {
    base: lsGet('pf-theme') === 'light' ? 'light' : 'dark',
    hacker: false,
    apply: function () {
      var t = this.hacker ? 'hacker' : (this.base === 'light' ? 'light' : '');
      var meta = $('meta[name="theme-color"]');
      if (t) root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
      if (meta) meta.setAttribute('content', this.hacker ? '#000000' : (this.base === 'light' ? '#f4f8f9' : '#0b1a20'));
      if (this.hacker) Matrix.start(); else Matrix.stop();
      FX.refresh();
      UI.sync();
    },
    setBase: function (b) { this.base = b; this.hacker = false; lsSet('pf-theme', b); this.apply(); },
    toggleBase: function () {
      if (this.hacker) { this.hacker = false; }
      else { this.base = this.base === 'light' ? 'dark' : 'light'; lsSet('pf-theme', this.base); }
      this.apply();
    },
    setHacker: function (on) { this.hacker = !!on; this.apply(); }
  };

  /* ---------------------------------------------------------
     SITE DATA  (read live from the page, so the terminal never
     goes out of date when you edit your content)
     --------------------------------------------------------- */
  var Data = {
    name: function () { return clean(($('header h1') || {}).textContent) || 'Amit Sharma'; },
    about: function () { return $$('#about > p').map(function (p) { return clean(p.textContent); }).filter(Boolean); },
    highlights: function () {
      return $$('.highlight-item').map(function (it) {
        return $$('span', it).map(function (s) { return clean(s.textContent); }).join(' ');
      });
    },
    experience: function () {
      return $$('.timeline-card').map(function (c) {
        return {
          company: clean(($('h3', c) || {}).textContent),
          role: clean(($('.timeline-role', c) || {}).textContent),
          date: clean(($('.timeline-date', c) || {}).textContent)
        };
      });
    },
    projects: function () {
      return $$('#projects .card-link').map(function (a) {
        return {
          name: clean(($('h3', a) || {}).textContent),
          desc: clean(($('p', a) || {}).textContent),
          hash: a.getAttribute('href')
        };
      });
    },
    skills: function () {
      return $$('.skill-group').map(function (g) {
        return {
          title: clean(($('.skill-group-title', g) || {}).textContent),
          tags: $$('.skill-tag', g).map(function (t) { return clean(t.textContent); })
        };
      });
    },
    contact: function () {
      return $$('.contact-item').map(function (a) {
        return {
          label: clean(($('.contact-label', a) || {}).textContent),
          value: clean(($('.contact-value', a) || {}).textContent),
          href: a.getAttribute('href')
        };
      });
    }
  };

  var RESUME_HREF = 'assets/amit_sharma.pdf';
  var PROMPT = 'amit@portfolio:~$';
  var SECTIONS = ['about', 'experience', 'projects', 'skills', 'contact'];

  /* ---------------------------------------------------------
     TERMINAL
     --------------------------------------------------------- */
  var Term = {
    el: null, out: null, input: null, isOpen: false, hist: [], hi: 0, greeted: false,

    build: function () {
      var self = this, bar, row, closeBtn;
      this.el = h('div', { 'class': 'pf-term pf-ui', id: 'pf-term', role: 'dialog', 'aria-label': 'Interactive terminal' });
      bar = h('div', { 'class': 'pf-term-bar' });
      bar.appendChild(h('span', { 'class': 'pf-term-dot' }));
      bar.appendChild(h('span', { 'class': 'pf-term-dot' }));
      bar.appendChild(h('span', { 'class': 'pf-term-dot' }));
      bar.appendChild(h('span', { 'class': 'pf-term-title' }, 'amit@portfolio: ~'));
      closeBtn = h('button', { 'class': 'pf-term-close', type: 'button', 'aria-label': 'Close terminal', 'data-sfx': '1' }, '×');
      closeBtn.addEventListener('click', function () { self.toggle(false); });
      bar.appendChild(closeBtn);

      this.out = h('div', { 'class': 'pf-term-out' });
      this.log = h('div', { 'class': 'pf-term-log', role: 'log', 'aria-live': 'polite' });
      row = h('div', { 'class': 'pf-term-row' });
      row.appendChild(h('span', { 'class': 'pf-term-prompt' }, PROMPT));
      this.input = h('input', {
        'class': 'pf-term-input', type: 'text', autocomplete: 'off', autocapitalize: 'none',
        autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Terminal command'
      });
      row.appendChild(this.input);

      this.out.appendChild(this.log);
      this.out.appendChild(row);      // command line sits right after the last output line
      this.el.appendChild(bar);
      this.el.appendChild(this.out);
      doc.body.appendChild(this.el);

      this.input.addEventListener('keydown', function (e) { self.onKey(e); });
      this.out.addEventListener('click', function () {
        var sel = window.getSelection && window.getSelection().toString();
        if (!sel) self.input.focus({ preventScroll: true });
      });
    },

    toggle: function (force) {
      var want = typeof force === 'boolean' ? force : !this.isOpen;
      if (want === this.isOpen) return;
      if (!this.el) this.build();
      this.isOpen = want;
      if (want) { this.seen = true; UI.hideHint(); if (UI.b.term) UI.b.term.classList.add('is-seen'); }
      this.el.classList.toggle('is-open', want);
      Sound.play(want ? 'open' : 'close');
      if (want) {
        if (!this.greeted) {
          this.greeted = true;
          this.say('Welcome to ' + Data.name() + "'s terminal 👋", 'pf-t-acc');
          this.say("Type 'help' to see what you can do. Tip: try  sudo hire amit", 'pf-t-mute');
          this.say('');
        }
        this.input.focus({ preventScroll: true });
      }
      UI.sync();
    },

    scroll: function () { this.out.scrollTop = this.out.scrollHeight; },

    say: function (text, cls) {
      var d = h('div', cls ? { 'class': cls } : null, text);
      this.log.appendChild(d);
      this.scroll();
      return d;
    },

    row: function (left, right, pad) {
      var d = h('div');
      var l = h('span', { 'class': 'pf-t-acc' }, String(left));
      while (l.textContent.length < (pad || 16)) l.textContent += ' ';
      d.appendChild(l);
      d.appendChild(h('span', { 'class': 'pf-t-mute' }, right || ''));
      this.log.appendChild(d);
      this.scroll();
    },

    link: function (prefix, label, href, opts) {
      opts = opts || {};
      var d = h('div');
      var a = h('a', { href: href }, label);
      if (opts.download) a.setAttribute('download', opts.download);
      if (opts.newTab) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
      if (prefix) d.appendChild(h('span', { 'class': 'pf-t-mute' }, prefix));
      d.appendChild(a);
      this.log.appendChild(d);
      this.scroll();
    },

    onKey: function (e) {
      var v;
      if (e.key === 'Enter') {
        v = this.input.value;
        this.input.value = '';
        Sound.play('enter');
        this.run(v);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.hist.length && this.hi > 0) { this.hi--; this.input.value = this.hist[this.hi]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.hi < this.hist.length - 1) { this.hi++; this.input.value = this.hist[this.hi]; }
        else { this.hi = this.hist.length; this.input.value = ''; }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.complete();
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        this.log.innerHTML = '';
      } else if (e.key === 'Escape') {
        this.toggle(false);
      } else if (e.key.length === 1 || e.key === 'Backspace') {
        Sound.play('key');
      }
    },

    complete: function () {
      var v = this.input.value.toLowerCase(), names = Object.keys(CMDS), m = [], i;
      if (!v || v.indexOf(' ') !== -1) return;
      for (i = 0; i < names.length; i++) if (names[i].indexOf(v) === 0) m.push(names[i]);
      if (m.length === 1) this.input.value = m[0] + ' ';
      else if (m.length > 1) this.say(m.join('  '), 'pf-t-mute');
    },

    run: function (raw) {
      var line = raw.trim(), parts, name, args, fn, echo;
      echo = h('div');
      echo.appendChild(h('span', { 'class': 'pf-t-acc' }, PROMPT + ' '));
      echo.appendChild(doc.createTextNode(raw));
      this.log.appendChild(echo);
      if (!line) { this.scroll(); return; }
      this.hist.push(line);
      this.hi = this.hist.length;
      parts = line.split(/\s+/);
      name = parts[0].toLowerCase();
      args = parts.slice(1);
      fn = CMDS[name];
      if (!fn) {
        this.say('command not found: ' + parts[0] + "  (type 'help')", 'pf-t-err');
        Sound.play('error');
        return;
      }
      try { fn.call(this, args, line); } catch (err) { this.say('Something went wrong running that command.', 'pf-t-err'); }
      this.scroll();
    },

    findProject: function (q) {
      var list = Data.projects(), n = parseInt(q, 10), i, s = (q || '').toLowerCase();
      if (!s) return null;
      if (!isNaN(n) && String(n) === q) return list[n - 1] || null;
      for (i = 0; i < list.length; i++) if (list[i].name.toLowerCase().indexOf(s) !== -1) return list[i];
      return null;
    },

    goto: function (id) {
      var t = id === 'top' || id === 'home' || id === '~' || id === '..' || id === '' ? $('header') : doc.getElementById(id);
      if (!t || (id && id !== 'top' && id !== 'home' && id !== '~' && id !== '..' && SECTIONS.indexOf(id) === -1)) return false;
      this.toggle(false);
      t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      return true;
    },

    downloadResume: function () {
      var a = h('a', { href: RESUME_HREF, download: 'Amit_Sharma_Resume', 'data-pf-direct': '1' });
      doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
    }
  };

  var CMDS = {
    help: function () {
      this.say('Available commands:', 'pf-t-acc');
      this.row('about', 'a little about me');
      this.row('whoami', 'quick intro');
      this.row('experience', "where I've worked");
      this.row('projects', 'list my projects (also: ls projects)');
      this.row('open <n|name>', 'open a project in detail');
      this.row('skills', 'my tech stack');
      this.row('resume', 'download or view my resume');
      this.row('contact', 'get in touch');
      this.row('goto <section>', SECTIONS.join(' | '));
      this.row('theme <mode>', 'dark | light | hacker');
      this.row('matrix', 'toggle hacker mode');
      this.row('sound <on|off>', 'toggle sound effects');
      this.row('joke', 'a dev joke');
      this.row('coffee', 'refill the coffee');
      this.row('history', 'previous commands');
      this.row('clear', 'clear the screen (Ctrl+L)');
      this.row('exit', 'close the terminal (Esc)');
      this.say('Tab autocompletes, ↑/↓ browse history.', 'pf-t-mute');
    },
    about: function () {
      var a = Data.about(), i;
      for (i = 0; i < a.length; i++) { this.say(a[i]); if (i < a.length - 1) this.say(''); }
    },
    whoami: function () {
      var hl = Data.highlights(), i;
      this.say(Data.name(), 'pf-t-acc');
      for (i = 0; i < hl.length; i++) this.say('  ' + hl[i]);
    },
    experience: function () {
      var ex = Data.experience(), i;
      for (i = 0; i < ex.length; i++) {
        this.say('[' + (i + 1) + '] ' + ex[i].company, 'pf-t-acc');
        this.say('    ' + ex[i].role + '  ·  ' + ex[i].date, 'pf-t-mute');
      }
    },
    projects: function () {
      var p = Data.projects(), i;
      for (i = 0; i < p.length; i++) {
        this.say('[' + (i + 1) + '] ' + p[i].name, 'pf-t-acc');
        this.say('    ' + p[i].desc, 'pf-t-mute');
      }
      this.say("Type  open <number|name>  to see the details.", 'pf-t-mute');
    },
    open: function (args) {
      var p = this.findProject(args.join(' '));
      if (!args.length) { this.say('usage: open <number|name>   e.g. open 1', 'pf-t-err'); Sound.play('error'); return; }
      if (!p) { this.say("no such project. Type 'projects' to see the list.", 'pf-t-err'); Sound.play('error'); return; }
      this.say('Opening ' + p.name + '…', 'pf-t-mute');
      this.toggle(false);
      window.location.hash = p.hash;
    },
    skills: function () {
      var g = Data.skills(), i;
      for (i = 0; i < g.length; i++) {
        this.say(g[i].title, 'pf-t-acc');
        this.say('  ' + g[i].tags.join(' · '), 'pf-t-mute');
      }
    },
    resume: function (args) {
      var a = (args[0] || '').toLowerCase();
      if (a === 'download') { this.say('Downloading resume…', 'pf-t-mute'); this.downloadResume(); Sound.play('success'); return; }
      if (a === 'view') { this.say('Opening resume in a new tab…', 'pf-t-mute'); window.open(RESUME_HREF, '_blank', 'noopener'); return; }
      this.say('Opening resume options…', 'pf-t-mute');
      this.toggle(false);
      Resume.open(UI.b.term);
      this.say("Tip: 'resume download' or 'resume view' skips the popup.", 'pf-t-mute');
    },
    contact: function () {
      var c = Data.contact(), i;
      for (i = 0; i < c.length; i++) {
        this.link(('  ' + c[i].label + ':').replace(/$/, ' '), c[i].value, c[i].href, { newTab: c[i].href.indexOf('http') === 0 });
      }
    },
    goto: function (args) {
      var id = (args[0] || '').toLowerCase();
      if (!id) { this.say('usage: goto <' + SECTIONS.join('|') + '>', 'pf-t-err'); Sound.play('error'); return; }
      if (!this.goto(id)) { this.say('no such section: ' + id, 'pf-t-err'); Sound.play('error'); }
    },
    cd: function (args) {
      var id = (args[0] || '~').replace(/\/$/, '').toLowerCase();
      if (!this.goto(id)) { this.say('cd: no such directory: ' + args[0], 'pf-t-err'); Sound.play('error'); }
    },
    ls: function (args) {
      var t = (args[0] || '').replace(/\/$/, '').toLowerCase();
      if (t === 'projects') { CMDS.projects.call(this); return; }
      this.say(SECTIONS.map(function (s) { return s + '/'; }).join('  ') + '  resume.pdf');
    },
    cat: function (args) {
      var f = (args[0] || '').toLowerCase();
      if (f === 'about.txt') CMDS.about.call(this);
      else if (f === 'skills.txt') CMDS.skills.call(this);
      else if (f === 'contact.txt') CMDS.contact.call(this);
      else if (f === 'resume.txt' || f === 'resume.pdf') CMDS.resume.call(this, []);
      else { this.say('cat: ' + (args[0] || '') + ': No such file or directory', 'pf-t-err'); Sound.play('error'); }
    },
    theme: function (args) {
      var m = (args[0] || '').toLowerCase();
      if (m === 'dark' || m === 'light') { Theme.setBase(m); this.say('Theme set to ' + m + '.', 'pf-t-mute'); Sound.play('toggle'); }
      else if (m === 'hacker') { Theme.setHacker(true); this.say('Hacker mode on. Wake up, Neo…', 'pf-t-acc'); Sound.play('success'); }
      else {
        this.say('current: ' + (Theme.hacker ? 'hacker' : Theme.base), 'pf-t-mute');
        this.say('usage: theme <dark|light|hacker>', 'pf-t-mute');
      }
    },
    matrix: function () {
      Theme.setHacker(!Theme.hacker);
      this.say(Theme.hacker ? 'Hacker mode on. Follow the white rabbit 🐇' : 'Hacker mode off.', 'pf-t-acc');
      Sound.play(Theme.hacker ? 'success' : 'toggle');
    },
    sound: function (args) {
      var m = (args[0] || '').toLowerCase();
      if (m === 'on') { Sound.setMuted(false); UI.sync(); Sound.play('success'); this.say('Sound on 🔊', 'pf-t-mute'); }
      else if (m === 'off') { Sound.setMuted(true); UI.sync(); this.say('Sound off 🔇', 'pf-t-mute'); }
      else this.say('sound is ' + (Sound.muted ? 'off' : 'on') + '.  usage: sound <on|off>', 'pf-t-mute');
    },
    joke: function () { this.say(pick(JOKES)); },
    coffee: function () {
      Fun.refill(true);
      this.say('    ( (');
      this.say('     ) )');
      this.say('  .........');
      this.say('  |       |]');
      this.say('  \\       /');
      this.say("   `-----'");
      this.say('Coffee refilled ☕ — productivity restored.', 'pf-t-mute');
    },
    sudo: function (args) {
      var s = args.join(' ').toLowerCase();
      if (/^hire\s+(amit|me)\b/.test(s)) {
        this.say('[sudo] password for recruiter: ********', 'pf-t-mute');
        this.say('Access granted ✅  1 awesome backend developer added to your team 🚀', 'pf-t-acc');
        FX.confetti(window.innerWidth / 2, window.innerHeight * 0.75);
        Sound.play('success');
      } else if (/^rm\s+-rf\s+\/?/.test(s)) {
        this.say("rm: it's a portfolio, not a production server 😅  Permission denied.", 'pf-t-err');
        Sound.play('error');
      } else {
        this.say('recruiter is not in the sudoers file. This incident will be reported 🚨', 'pf-t-err');
        Sound.play('error');
      }
    },
    rm: function (args) {
      if (args.join(' ').indexOf('-rf') !== -1) CMDS.sudo.call(this, ['rm'].concat(args));
      else { this.say("rm: permission denied (this is a portfolio, please don't delete it 🙏)", 'pf-t-err'); Sound.play('error'); }
    },
    history: function () {
      var i;
      if (!this.hist.length) { this.say('(empty)', 'pf-t-mute'); return; }
      for (i = 0; i < this.hist.length; i++) this.say('  ' + (i + 1) + '  ' + this.hist[i], 'pf-t-mute');
    },
    clear: function () { this.log.innerHTML = ''; },
    date: function () { this.say(new Date().toString()); },
    pwd: function () { this.say('/home/amit/portfolio'); },
    echo: function (args) { this.say(args.join(' ')); },
    exit: function () { this.toggle(false); }
  };
  CMDS.cls = CMDS.clear;
  CMDS.exp = CMDS.experience;
  CMDS.quit = CMDS.exit;
  CMDS.close = CMDS.exit;
  CMDS.hacker = CMDS.matrix;
  CMDS['?'] = CMDS.help;

  /* ---------------------------------------------------------
     DOCK  (terminal / theme / hacker / sound buttons)
     --------------------------------------------------------- */
  var UI = {
    dock: null, top: null, hint: null, b: {},
    build: function () {
      var self = this, launch;
      function round(parent, id, label, icon, fn) {
        var b = h('button', { 'class': 'pf-round', type: 'button', title: label, 'aria-label': label, 'data-sfx': '1' });
        b.appendChild(h('i', { 'class': 'fas ' + icon }));
        b.addEventListener('click', fn);
        self.b[id] = b;
        parent.appendChild(b);
      }
      this.dock = h('div', { 'class': 'pf-dock pf-ui' });   // bottom-left
      this.top = h('div', { 'class': 'pf-top pf-ui' });     // top-right

      launch = h('button', {
        'class': 'pf-launch', type: 'button', title: 'Open terminal ( ` )', 'aria-label': 'Open terminal',
        'aria-controls': 'pf-term', 'aria-expanded': 'false', 'data-sfx': '1'
      });
      launch.appendChild(h('i', { 'class': 'fas fa-terminal' }));
      launch.appendChild(h('span', null, 'Terminal'));
      launch.appendChild(h('kbd', null, '`'));
      launch.addEventListener('click', function () { Term.toggle(); });
      this.b.term = launch;
      this.dock.appendChild(launch);

      round(this.top, 'theme', 'Switch theme', 'fa-sun', function () { Theme.toggleBase(); Sound.play('toggle'); });
      round(this.top, 'hacker', 'Toggle hacker mode', 'fa-user-secret', function () {
        Theme.setHacker(!Theme.hacker); Sound.play(Theme.hacker ? 'success' : 'toggle');
      });
      round(this.top, 'sound', 'Mute sound', 'fa-volume-high', function () {
        Sound.setMuted(!Sound.muted); self.sync(); Sound.play('click');
      });
      doc.body.appendChild(this.dock);
      doc.body.appendChild(this.top);

      // attention bubble above the launcher (after the boot screen, until the terminal is opened)
      this.hint = h('div', { 'class': 'pf-hint pf-ui', role: 'note' });
      this.hint.appendChild(h('b', null, 'Try my terminal! '));
      this.hint.appendChild(doc.createTextNode("Type 'help' or press the ` key."));
      this.hint.addEventListener('click', function () { Term.toggle(true); });
      doc.body.appendChild(this.hint);
      whenBootDone(function () {
        setTimeout(function () { if (!Term.seen) self.hint.classList.add('is-on'); }, 900);
        setTimeout(function () { self.hideHint(); }, 13000);
      });
    },
    hideHint: function () { if (this.hint) this.hint.classList.remove('is-on'); },
    sync: function () {
      var b = this.b, light = Theme.base === 'light';
      if (!this.dock) return;
      b.term.classList.toggle('is-open', Term.isOpen);
      b.term.setAttribute('aria-expanded', String(Term.isOpen));
      b.theme.firstChild.className = 'fas ' + (light ? 'fa-moon' : 'fa-sun');
      b.theme.title = light ? 'Switch to dark theme' : 'Switch to light theme';
      b.theme.setAttribute('aria-label', b.theme.title);
      b.hacker.setAttribute('aria-pressed', String(Theme.hacker));
      b.sound.firstChild.className = 'fas ' + (Sound.muted ? 'fa-volume-xmark' : 'fa-volume-high');
      b.sound.title = Sound.muted ? 'Unmute sound' : 'Mute sound';
      b.sound.setAttribute('aria-label', b.sound.title);
    }
  };

  /* ---------------------------------------------------------
     RESUME MODAL  (Download PDF  /  View online)
     --------------------------------------------------------- */
  var Resume = {
    el: null, card: null, sheet: null, opts: {}, sizeEl: null,
    isOpen: false, last: null, timer: 0, sized: false, _kd: null,

    build: function () {
      var self = this, backdrop, x, paper, main, wrap, foot, keys, i, spec, role;

      function check() {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = doc.createElementNS(NS, 'svg'), path = doc.createElementNS(NS, 'path');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('class', 'pf-rm-check');
        svg.setAttribute('aria-hidden', 'true');
        path.setAttribute('d', 'M5 13l4 4L19 7');
        svg.appendChild(path);
        return svg;
      }
      function option(kind, icon, title, desc, key, idx) {
        var b = h('button', { 'class': 'pf-rm-opt', type: 'button', 'data-act': kind, 'data-sfx': '1' });
        var ico = h('span', { 'class': 'pf-rm-ico' });
        var txt = h('span', { 'class': 'pf-rm-txt' });
        var small = h('small', null, desc);
        b.style.setProperty('--i', idx);
        ico.appendChild(h('i', { 'class': 'fas ' + icon }));
        ico.appendChild(check());
        txt.appendChild(h('strong', null, title));
        txt.appendChild(small);
        b.appendChild(ico);
        b.appendChild(txt);
        b.appendChild(h('kbd', null, key));
        b._small = small;
        b._desc = desc;
        b.addEventListener('click', function () { self.act(kind); });
        // spotlight + tilt that follow the pointer
        b.addEventListener('pointermove', function (e) {
          if (reduceMotion || e.pointerType === 'touch') return;
          var r = b.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          b.style.setProperty('--mx', (px * 100) + '%');
          b.style.setProperty('--my', (py * 100) + '%');
          b.style.setProperty('--ry', ((px - 0.5) * 7) + 'deg');
          b.style.setProperty('--rx', ((0.5 - py) * 7) + 'deg');
        });
        b.addEventListener('pointerleave', function () {
          b.style.setProperty('--rx', '0deg');
          b.style.setProperty('--ry', '0deg');
        });
        self.opts[kind] = b;
        return b;
      }

      this.el = h('div', { 'class': 'pf-rm pf-ui', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pf-rm-title' });
      backdrop = h('div', { 'class': 'pf-rm-backdrop' });
      this.card = h('div', { 'class': 'pf-rm-card' });

      x = h('button', { 'class': 'pf-rm-x', type: 'button', 'aria-label': 'Close', 'data-sfx': '1' }, '×');
      x.addEventListener('click', function () { self.close(); });

      // decorative paper that tilts with the pointer
      role = clean((doc.title.split('—')[1] || 'Resume'));
      paper = h('div', { 'class': 'pf-rm-paper', 'aria-hidden': 'true' });
      this.sheet = h('div', { 'class': 'pf-rm-sheet' });
      this.sheet.appendChild(h('div', { 'class': 'pf-rm-pname' }, Data.name()));
      this.sheet.appendChild(h('div', { 'class': 'pf-rm-prole' }, role));
      spec = ['h', 100, 92, 96, 'h', 100, 88, 94, 'h', 96, 72];
      for (i = 0; i < spec.length; i++) {
        var ln = h('i', { 'class': 'pf-rm-line' + (spec[i] === 'h' ? ' h' : '') });
        if (spec[i] !== 'h') ln.style.setProperty('--w', spec[i] + '%');
        this.sheet.appendChild(ln);
      }
      this.sheet.appendChild(h('span', { 'class': 'pf-rm-badge' }, 'PDF'));
      this.sheet.appendChild(h('span', { 'class': 'pf-rm-scan' }));
      paper.appendChild(this.sheet);
      this.card.addEventListener('pointermove', function (e) {
        if (reduceMotion || e.pointerType === 'touch') return;
        var r = self.card.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        self.sheet.style.setProperty('--pry', (dx * 12) + 'deg');
        self.sheet.style.setProperty('--prx', (-dy * 12) + 'deg');
      });
      this.card.addEventListener('pointerleave', function () {
        self.sheet.style.setProperty('--pry', '0deg');
        self.sheet.style.setProperty('--prx', '0deg');
      });

      main = h('div', { 'class': 'pf-rm-main' });
      main.appendChild(h('p', { 'class': 'pf-rm-eyebrow' }, 'Resume'));
      main.appendChild(h('h2', { 'class': 'pf-rm-title', id: 'pf-rm-title' }, 'How would you like it?'));
      main.appendChild(h('p', { 'class': 'pf-rm-sub' }, Data.name() + ' — ' + role));
      wrap = h('div', { 'class': 'pf-rm-opts' });
      wrap.appendChild(option('download', 'fa-download', 'Download PDF', 'Save a copy to your device', 'D', 0));
      wrap.appendChild(option('view', 'fa-eye', 'View Online', 'Open it in a new browser tab', 'V', 1));
      main.appendChild(wrap);

      foot = h('div', { 'class': 'pf-rm-foot' });
      foot.appendChild(h('span', { 'class': 'pf-rm-chip' }, 'PDF'));
      this.sizeEl = h('span', { 'class': 'pf-rm-chip', hidden: '' });
      foot.appendChild(this.sizeEl);
      keys = h('span', { 'class': 'pf-rm-keys' }, 'D · V · Esc');
      foot.appendChild(keys);
      main.appendChild(foot);

      this.card.appendChild(x);
      this.card.appendChild(paper);
      this.card.appendChild(main);
      this.el.appendChild(backdrop);
      this.el.appendChild(this.card);
      doc.body.appendChild(this.el);

      backdrop.addEventListener('click', function () { self.close(); });
      // keep the page still while the modal is up (the card itself may scroll on short screens)
      this.el.addEventListener('wheel', function (e) { if (!e.target.closest('.pf-rm-card')) e.preventDefault(); }, { passive: false });
      this.el.addEventListener('touchmove', function (e) { if (!e.target.closest('.pf-rm-card')) e.preventDefault(); }, { passive: false });
    },

    focusables: function () {
      return $$('button', this.card).filter(function (b) { return !b.disabled; });
    },

    onKey: function (e) {
      var self = Resume, k = e.key, f, i, n;
      if (k === 'Escape') { e.preventDefault(); self.close(); return; }
      if (k === 'Tab') {
        f = self.focusables();
        if (!f.length) return;
        if (!self.card.contains(doc.activeElement)) { e.preventDefault(); f[0].focus(); return; }
        if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === 'd' || k === 'D') { e.preventDefault(); self.act('download'); }
      else if (k === 'v' || k === 'V') { e.preventDefault(); self.act('view'); }
      else if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault();
        n = [self.opts.download, self.opts.view];
        i = n.indexOf(doc.activeElement);
        i = (k === 'ArrowDown' || k === 'ArrowRight') ? (i + 1) % n.length : (i <= 0 ? n.length - 1 : i - 1);
        n[i].focus({ preventScroll: true });
      }
    },

    resetStates: function () {
      var k, b;
      for (k in this.opts) {
        b = this.opts[k];
        b.classList.remove('is-busy', 'is-done');
        b._small.textContent = b._desc;
      }
    },

    fetchSize: function () {
      var el = this.sizeEl;
      if (this.sized) return;
      this.sized = true;
      try {
        fetch(RESUME_HREF, { method: 'HEAD' }).then(function (r) {
          var l = parseInt(r.headers.get('content-length'), 10);
          if (l > 0) { el.textContent = l > 1048576 ? (l / 1048576).toFixed(1) + ' MB' : Math.round(l / 1024) + ' KB'; el.hidden = false; }
        }).catch(function () { /* size chip simply stays hidden */ });
      } catch (e) { /* ignore */ }
    },

    open: function (trigger) {
      var self = this;
      if (!this.el) this.build();
      if (this.isOpen) return;
      this.isOpen = true;
      this.last = trigger || doc.activeElement;
      this.resetStates();
      this.fetchSize();
      this.el.classList.add('is-open');
      doc.addEventListener('keydown', this._kd = this.onKey, true);
      Sound.play('open');
      setTimeout(function () { if (self.isOpen && self.opts.download) self.opts.download.focus({ preventScroll: true }); }, 80);
    },

    close: function () {
      if (!this.isOpen) return;
      this.isOpen = false;
      clearTimeout(this.timer);
      this.el.classList.remove('is-open');
      doc.removeEventListener('keydown', this._kd, true);
      Sound.play('close');
      if (this.last && this.last.focus) { try { this.last.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    },

    act: function (kind) {
      var self = this, opt = this.opts[kind], small, r;
      if (!opt || opt.classList.contains('is-busy') || opt.classList.contains('is-done')) return;
      small = opt._small;
      opt.classList.add('is-busy');
      small.textContent = kind === 'download' ? 'Preparing your download…' : 'Opening in a new tab…';
      Sound.play('enter');
      if (kind === 'download') Term.downloadResume();
      else window.open(RESUME_HREF, '_blank', 'noopener');
      setTimeout(function () {
        if (!self.isOpen) return;
        opt.classList.remove('is-busy');
        opt.classList.add('is-done');
        small.textContent = kind === 'download' ? 'Download started ✓' : 'Opened in a new tab ✓';
        r = opt.getBoundingClientRect();
        if (kind === 'download') FX.confetti(r.left + r.width / 2, r.top + r.height / 2);
        else FX.burst(r.left + r.width / 2, r.top + r.height / 2, 18);
        Sound.play('success');
      }, 650);
      clearTimeout(this.timer);
      this.timer = setTimeout(function () { self.close(); }, 2200);
    }
  };

  /* ---------------------------------------------------------
     FUNNY TOUCHES  (footer joke, badges, "don't click", hire me)
     --------------------------------------------------------- */
  var Fun = {
    coffee: 60 + Math.floor(Math.random() * 35),
    coffeeEl: null, jokeEl: null, stage: 0,

    build: function () {
      var self = this, footer = $('footer'), strip, badges, bugs, dont, d = new Date();
      if (footer) {
        strip = h('div', { 'class': 'pf-fun pf-ui' });
        this.jokeEl = h('div', { 'class': 'pf-joke' }, pick(JOKES));
        badges = h('div', { 'class': 'pf-badges' });
        this.coffeeEl = h('button', { 'class': 'pf-badge', type: 'button', title: 'Click to refill', 'data-sfx': '1' });
        this.coffeeEl.addEventListener('click', function () { self.refill(true); });
        bugs = h('span', { 'class': 'pf-badge' },
          '🐞 Bugs fixed today: ' + (2 + ((d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % 8)));
        badges.appendChild(this.coffeeEl);
        badges.appendChild(bugs);
        dont = h('button', { 'class': 'pf-dont', type: 'button', 'data-sfx': '1' }, "⚠️ Please don't click");
        dont.addEventListener('click', function () { self.dontClick(dont); });
        strip.appendChild(this.jokeEl);
        strip.appendChild(badges);
        strip.appendChild(dont);
        footer.appendChild(strip);
        this.renderCoffee();

        setInterval(function () { if (!doc.hidden) self.nextJoke(); }, 7000);
        setInterval(function () {
          if (doc.hidden) return;
          if (self.coffee > 8) { self.coffee--; self.renderCoffee(); }
        }, 12000);
      }

      var contact = $('#contact'), wrap, hire;
      if (contact) {
        wrap = h('div', { 'class': 'pf-hire pf-ui' });
        hire = h('button', { 'class': 'btn btn-primary pf-hire-btn', type: 'button', 'data-sfx': '1' }, '🚀 Hire Me');
        hire.addEventListener('click', function () {
          var r = hire.getBoundingClientRect();
          FX.confetti(r.left + r.width / 2, r.top + r.height / 2);
          Sound.play('success');
          Toast.show('Best decision of your career 😎 — my email is right above ⬆️', 3600);
        });
        wrap.appendChild(hire);
        contact.appendChild(wrap);
      }
    },

    renderCoffee: function () { if (this.coffeeEl) this.coffeeEl.textContent = '☕ Coffee level: ' + this.coffee + '%'; },

    refill: function (loud) {
      this.coffee = 100;
      this.renderCoffee();
      if (loud) { Sound.play('success'); Toast.show('☕ Refueled. Ready to ship.', 2200); }
    },

    nextJoke: function () {
      var el = this.jokeEl, next;
      if (!el) return;
      do { next = pick(JOKES); } while (next === el.textContent && JOKES.length > 1);
      el.classList.add('is-fading');
      setTimeout(function () { el.textContent = next; el.classList.remove('is-fading'); }, 350);
    },

    dontClick: function (btn) {
      var s = this.stage, i, bug, bugs = ['🐛', '🐞', '🪲'];
      this.stage = (this.stage + 1) % 5;
      if (s === 0) {
        Toast.show('I literally said don’t. 😐', 2400);
        Sound.play('error');
        btn.classList.add('pf-shake');
        setTimeout(function () { btn.classList.remove('pf-shake'); }, 550);
      } else if (s === 1) {
        Toast.show('Now you’ve done it. 💥', 2400);
        Sound.play('pop');
        if (!reduceMotion) {
          root.classList.add('pf-quake');
          setTimeout(function () { root.classList.remove('pf-quake'); }, 700);
        }
      } else if (s === 2) {
        Toast.show('🐛 Bugs everywhere! …kidding, all tests pass ✅', 3000);
        Sound.play('error');
        if (!reduceMotion) {
          for (i = 0; i < 24; i++) {
            bug = h('span', { 'class': 'pf-bug', 'aria-hidden': 'true' }, pick(bugs));
            bug.style.left = Math.random() * 96 + 'vw';
            bug.style.animationDuration = (2 + Math.random() * 1.6) + 's';
            bug.style.animationDelay = (Math.random() * 0.8) + 's';
            doc.body.appendChild(bug);
            (function (b) { setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 4800); })(bug);
          }
        }
      } else if (s === 3) {
        Toast.show('Disco mode 🪩', 3600);
        Sound.play('toggle');
        if (!reduceMotion) {
          root.classList.add('pf-disco');
          setTimeout(function () { root.classList.remove('pf-disco'); }, 3800);
        }
      } else {
        var r = btn.getBoundingClientRect();
        Toast.show('Fine, you win 🏆 (+1 respect)', 3000);
        Sound.play('success');
        FX.confetti(r.left + r.width / 2, r.top);
      }
    }
  };

  /* ---------------------------------------------------------
     GLOBAL WIRING
     --------------------------------------------------------- */
  function isTyping(t) {
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  function init() {
    UI.build();
    Fun.build();
    Theme.apply();

    // click blip on links / buttons / project cards (buttons with data-sfx play their own sound)
    doc.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('a, button, .card') : null;
      if (t && !t.closest('[data-sfx]')) Sound.play('click');
      // click sparks (skip keyboard-triggered clicks)
      if (e.detail > 0) FX.burst(e.clientX, e.clientY, 10);
    });

    // the hero "Resume" link now opens the Download / View Online modal (still downloads if JS is off)
    doc.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[download]') : null;
      if (!a || a.hasAttribute('data-pf-direct') || a.closest('.pf-ui')) return;
      if (!/amit_sharma\.pdf/i.test(a.getAttribute('href') || '')) return;
      e.preventDefault();
      Resume.open(a);
    }, true);

    // cursor sparks
    if (finePointer && !reduceMotion) {
      var lx = -100, ly = -100;
      doc.addEventListener('mousemove', function (e) {
        var dx = e.clientX - lx, dy = e.clientY - ly;
        if (dx * dx + dy * dy < 180) return;
        lx = e.clientX; ly = e.clientY;
        FX.spark(lx, ly);
      }, { passive: true });
    }

    // make the site's custom cursor ring react over the new controls too
    var ring = $('#cursor');
    var HOVER = '.pf-dock button, .pf-top button, .pf-fun button, .pf-hire-btn, .pf-term-close, .pf-rm-opt, .pf-rm-x';
    if (ring) {
      doc.addEventListener('mouseover', function (e) { if (e.target.closest && e.target.closest(HOVER)) ring.classList.add('hovered'); });
      doc.addEventListener('mouseout', function (e) { if (e.target.closest && e.target.closest(HOVER)) ring.classList.remove('hovered'); });
    }

    // keyboard: ` toggles the terminal, Esc closes it, Konami code = hacker mode
    var konami = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    var kpos = 0;
    doc.addEventListener('keydown', function (e) {
      if (root.classList.contains('boot-active') || Resume.isOpen) return;
      if (e.key === '`' && !isTyping(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        Term.toggle();
        return;
      }
      if (e.key === 'Escape' && Term.isOpen) { Term.toggle(false); return; }
      if (isTyping(e.target)) return;
      var k = e.key.toLowerCase();
      if (k === konami[kpos]) {
        kpos++;
        if (kpos === konami.length) {
          kpos = 0;
          Theme.setHacker(true);
          Sound.play('success');
          Toast.show('🔓 Konami code accepted — welcome to the matrix', 3400);
        }
      } else { kpos = k === konami[0] ? 1 : 0; }
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
