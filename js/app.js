/* Hooke's law · spring constant — lesson app (no dependencies) */
(function () {
  'use strict';

  /* =====================================================================
     1. CONSTANTS + HELPERS
     ===================================================================== */
  const G_CGS = 980;                       // cm/s²
  /* Example readings: a spring with K = 14 000 dyne/cm, read to the nearest mm */
  const EX = {
    K: 14000, zero: 4.0,
    rows: [
      { m: 0, r: 4.0, e: 0.0 },
      { m: 20, r: 5.4, e: 1.4 },
      { m: 40, r: 6.8, e: 2.8 },
      { m: 60, r: 8.2, e: 4.2 },
      { m: 80, r: 9.6, e: 5.6 }
    ]
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs) { const t = el('text', Object.assign({ x, y }, attrs || {}), parent); t.textContent = s; return t; }
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function trim(v, d) { if (!isFinite(v)) return '—'; return String(+Number(v).toFixed(d)); }
  function fmtK(v) { return Math.round(v).toLocaleString('en-US').replace(/,/g, ' '); }
  function svgPoint(svg, e) {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function radioGroup(id, onPick) {
    const box = $(id);
    const btns = Array.from(box.querySelectorAll('[role=radio]'));
    btns.forEach(b => b.addEventListener('click', () => { set(b); onPick(b); }));
    function set(b) { btns.forEach(x => x.setAttribute('aria-checked', x === b ? 'true' : 'false')); }
    return { btns, set, get: () => btns.find(b => b.getAttribute('aria-checked') === 'true') };
  }
  function parseNum(s) { if (s == null) return NaN; s = String(s).trim().replace(',', '.').replace(/\s/g, ''); if (!s) return NaN; return Number(s); }
  const near = (a, b, tol) => isFinite(a) && isFinite(b) && b !== 0 && Math.abs(a - b) / Math.abs(b) <= tol;
  const F_MONO = 'IBM Plex Mono, monospace', F_HEAD = 'Bricolage Grotesque, sans-serif', F_HAND = 'Patrick Hand, cursive';
  const C = { ink: '#201d29', ink2: '#433e4f', muted: '#726c80', plum: '#5a3e85', plum2: '#432c66', plum3: '#9884bd', coral: '#e0644a', coral2: '#b04a34', coral3: '#f1a896', steel: '#3f6a80', line: '#e2dfe8' };

  /* ---------- shared SVG parts ---------- */
  function rigDefs(svg, id) {
    const defs = el('defs', null, svg);
    let g = el('linearGradient', { id: id + '-rod', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    [['0', '#8e8a99'], ['.45', '#e4e2ea'], ['1', '#77738a']].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1] }, g));
    g = el('linearGradient', { id: id + '-ruler', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    [['0', '#fbfaf6'], ['1', '#efece3']].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1] }, g));
    g = el('linearGradient', { id: id + '-mass', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    [['0', '#7d7891'], ['.35', '#565168'], ['1', '#2f2b3c']].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1] }, g));
    g = el('linearGradient', { id: id + '-wood', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    [['0', '#d9c3a3'], ['1', '#b99a72']].forEach(s => el('stop', { offset: s[0], 'stop-color': s[1] }, g));
    return defs;
  }
  /* Ring stand: base, rod, boss and horizontal arm; returns the hook point */
  function drawStand(g, id, o) {
    const { rodX, baseY, armY, hookX, top } = o;
    el('rect', { x: rodX - 36, y: baseY - 12, width: 150, height: 14, rx: 4, fill: '#3a3548' }, g);
    el('rect', { x: rodX - 36, y: baseY - 12, width: 150, height: 3.5, rx: 2, fill: '#57516a' }, g);
    el('rect', { x: rodX - 4.5, y: (top != null ? top : armY - 24), width: 9, height: baseY - 12 - (top != null ? top : armY - 24), rx: 3.5, fill: `url(#${id}-rod)` }, g);
    el('rect', { x: rodX - 10, y: armY - 9, width: 20, height: 18, rx: 4, fill: '#2f2b3c' }, g);
    el('rect', { x: rodX, y: armY - 3.5, width: hookX - rodX + 6, height: 7, rx: 3, fill: `url(#${id}-rod)` }, g);
    el('path', { d: `M${hookX} ${armY + 3} v7 a4 4 0 1 0 4 4`, fill: 'none', stroke: '#4a4559', 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    return { x: hookX, y: armY + 14 };
  }
  /* Helix seen from the front: back strands pale, front strands dark */
  function coilD(cx, y1, y2, R, n, lead) {
    lead = lead == null ? 6 : lead;
    const a = y1 + lead, b = y2 - lead, steps = Math.round(n * 14);
    let back = '', front = '';
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const th = i / steps * n * 2 * Math.PI;
      const x = cx + R * Math.sin(th), y = a + (b - a) * i / steps;
      if (prev) {
        const seg = `M${prev[0].toFixed(1)} ${prev[1].toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`;
        if (Math.cos(th - Math.PI / steps * n) > 0) front += seg; else back += seg;
      }
      prev = [x, y];
    }
    const leads = `M${cx} ${y1}L${cx} ${a}M${cx} ${b}L${cx} ${y2}`;
    return { back, front, leads };
  }
  function makeSpring(parent, o) {
    o = o || {};
    const g = el('g', null, parent);
    const back = el('path', { fill: 'none', stroke: o.back || '#9d98ad', 'stroke-width': o.w || 2, 'stroke-linecap': 'round' }, g);
    const leads = el('path', { fill: 'none', stroke: o.front || '#35303f', 'stroke-width': o.w || 2, 'stroke-linecap': 'round' }, g);
    const front = el('path', { fill: 'none', stroke: o.front || '#35303f', 'stroke-width': (o.w || 2) + .3, 'stroke-linecap': 'round' }, g);
    return {
      g,
      set(cx, y1, y2, R, n) { const d = coilD(cx, y1, y2, R, n, o.lead); back.setAttribute('d', d.back); front.setAttribute('d', d.front); leads.setAttribute('d', d.leads); },
      color(f, b) { front.setAttribute('stroke', f); leads.setAttribute('stroke', f); back.setAttribute('stroke', b); }
    };
  }
  /* A vertical ruler with cm numbers, 0 at the top */
  function drawRuler(g, id, x, w, y0, sc, cmMax, o) {
    o = o || {};
    el('rect', { x, y: y0 - 12, width: w, height: cmMax * sc + 24, rx: 3, fill: `url(#${id}-ruler)`, stroke: '#c8c1ad', 'stroke-width': 1 }, g);
    for (let mm = 0; mm <= cmMax * 10; mm++) {
      if (sc < 10 && mm % 5) continue;
      const y = y0 + mm / 10 * sc, len = mm % 10 === 0 ? w * .42 : mm % 5 === 0 ? w * .28 : w * .16;
      el('line', { x1: x, y1: y, x2: x + len, y2: y, stroke: '#2c2838', 'stroke-width': mm % 10 ? .7 : 1.1 }, g);
      if (mm % 10 === 0 && (mm / 10) % (o.every || 1) === 0) txt(g, x + w - 4, y + 3.6, String(mm / 10), { 'font-size': o.fs || 10.5, fill: '#2c2838', 'text-anchor': 'end', 'font-family': F_MONO });
    }
  }
  /* Slotted mass seen from the front */
  function massShape(g, id, cx, yTop, w, h, label) {
    el('rect', { x: cx - w / 2, y: yTop, width: w, height: h, rx: 2.5, fill: `url(#${id}-mass)`, stroke: '#211d2b', 'stroke-width': .8 }, g);
    el('rect', { x: cx - w / 2 + 2, y: yTop + 1.2, width: w - 4, height: 1.6, rx: .8, fill: 'rgba(255,255,255,.28)' }, g);
    if (label) txt(g, cx, yTop + h - 3, label, { 'font-size': h * .62, fill: '#f3f0f8', 'text-anchor': 'middle', 'font-family': F_MONO, 'font-weight': 600 });
  }
  /* Mass hanger: S-hook, stem and base disc; returns the top of the base */
  function hangerShape(g, cx, yTop, stem, w) {
    el('path', { d: `M${cx} ${yTop} v4 a4 4 0 1 1 0 8 v4`, fill: 'none', stroke: '#4a4559', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, g);
    el('line', { x1: cx, y1: yTop + 16, x2: cx, y2: yTop + 16 + stem, stroke: '#6a6578', 'stroke-width': 3 }, g);
    el('rect', { x: cx - w / 2, y: yTop + 16 + stem, width: w, height: 6, rx: 2, fill: '#3a3548' }, g);
    return yTop + 16 + stem;
  }

  /* =====================================================================
     2. BACKGROUND — faint springs stretching, with chart-recorder traces
     ===================================================================== */
  (function background() {
    const cv = $('bg'), ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    const springs = [];
    const COL = ['90,62,133', '224,100,74', '63,106,128'];
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      springs.length = 0;
      const xs = W < 700 ? [.18, .82] : [.12, .3, .56, .76, .93];
      xs.forEach((fx, i) => springs.push({
        fx, L0: (.16 + (i % 3) * .05) * H, k: 2.2 + (i % 2) * .9, z: .045 + (i % 3) * .015,
        load: 1 + (i % 3), y: 0, v: 0, next: 2 + i * 2.3, col: COL[i % 3], hist: [], coils: 11 + (i % 3) * 3
      }));
      springs.forEach(s => { s.y = eqOf(s); });
    }
    const eqOf = s => s.L0 + s.load * H * .055;
    function step(s, dt, t) {
      if (t > s.next) {                              // add or remove a load now and then
        const up = s.load >= 4 ? false : s.load <= 1 ? true : Math.random() < .5;
        s.load += up ? 1 : -1; s.next = t + 6 + Math.random() * 7;
      }
      const w = s.k, a = -w * w * (s.y - eqOf(s)) - 2 * s.z * w * s.v;
      s.v += a * dt; s.y += s.v * dt;
      s.hist.push(s.y); if (s.hist.length > 520) s.hist.shift();
    }
    function draw(s) {
      const x = s.fx * W, top = -6, bot = s.y, R = 9, n = s.coils;
      // the trace: recent heights drawn leftwards, like a chart recorder
      ctx.beginPath();
      const hl = s.hist.length;
      for (let i = 0; i < hl; i++) {
        const px = x - 18 - (hl - 1 - i) * .55, py = s.hist[i] + 14;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      const gr = ctx.createLinearGradient(x - 18 - hl * .55, 0, x - 18, 0);
      gr.addColorStop(0, `rgba(${s.col},0)`); gr.addColorStop(1, `rgba(${s.col},.20)`);
      ctx.strokeStyle = gr; ctx.lineWidth = 1.2; ctx.stroke();
      // the coil
      const a = top + 10, b = bot - 6, steps = n * 12;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, a);
      for (let i = 0; i <= steps; i++) { const th = i / steps * n * 2 * Math.PI; ctx.lineTo(x + R * Math.sin(th), a + (b - a) * i / steps); }
      ctx.lineTo(x, bot);
      ctx.strokeStyle = 'rgba(32,29,41,.13)'; ctx.lineWidth = 1.1; ctx.stroke();
      // the load: a stack of slotted masses
      for (let j = 0; j < s.load; j++) {
        ctx.fillStyle = `rgba(${s.col},${.10 + j * .02})`;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 15, bot + 2 + j * 9, 30, 8, 2) : ctx.rect(x - 15, bot + 2 + j * 9, 30, 8); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x - 18, s.y + 14, 2, 0, 6.283); ctx.fillStyle = `rgba(${s.col},.35)`; ctx.fill();
    }
    let last = performance.now(), t = 0;
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
      ctx.clearRect(0, 0, W, H);
      springs.forEach(s => { step(s, dt, t); draw(s); });
      if (!reduced) requestAnimationFrame(frame);
    }
    window.addEventListener('resize', size);
    size(); requestAnimationFrame(frame);
  })();

  /* =====================================================================
     3. NAVIGATION + SPRING RAIL
     ===================================================================== */
  const views = Array.from(document.querySelectorAll('.view'));
  const ids = views.map(v => v.id.replace('view-', ''));
  const nav = $('rail-nav'), btnPrev = $('btn-prev'), railBox = $('rail-spring'), railSvg = $('rail-svg');
  const items = views.map((v, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rail-item';
    b.innerHTML = `<span>${v.dataset.title}</span>`;
    b.addEventListener('click', () => goTo(i, true));
    nav.appendChild(b);
    return b;
  });
  let current = -1;
  const onEnter = {}, onLeave = {};
  /* the rail: a coil hung from the top, stretched down to the current section */
  const rail = (function () {
    el('rect', { x: 2, y: 0, width: 22, height: 3, rx: 1.5, fill: C.ink }, railSvg);
    const sp = makeSpring(railSvg, { w: 1.5, lead: 4, front: C.plum2, back: '#c9bfdc' });
    const wt = el('rect', { x: 6, y: 0, width: 14, height: 9, rx: 2.5, fill: C.coral }, railSvg);
    let y = 30, v = 0, target = 30, raf = 0, lastT = 0;
    function draw() { sp.set(13, 3, y, 6.5, 8); wt.setAttribute('y', y); }
    function tick(now) {
      const dt = Math.min(.04, (now - lastT) / 1000); lastT = now;
      const w = 9, a = -w * w * (y - target) - 2 * .22 * w * v;
      v += a * dt; y += v * dt; draw();
      if (Math.abs(y - target) > .2 || Math.abs(v) > .5) raf = requestAnimationFrame(tick); else { y = target; v = 0; draw(); raf = 0; }
    }
    return {
      to(ty) { target = Math.max(20, ty); if (reduced) { y = target; draw(); return; } if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } },
      draw
    };
  })();
  function fillRail() {
    const it = items[current]; if (!it) return;
    const mobile = window.matchMedia('(max-width:980px)').matches;
    if (mobile) { railBox.style.setProperty('--fillw', ((current + .5) / items.length * 100) + '%'); return; }
    const tb = railBox.getBoundingClientRect(), ib = it.getBoundingClientRect();
    railSvg.setAttribute('height', tb.height);
    rail.to(ib.top + ib.height / 2 - tb.top - 4);
  }
  function goTo(i, push) {
    i = clamp(i, 0, views.length - 1);
    if (i === current) return;
    if (current >= 0 && onLeave[ids[current]]) onLeave[ids[current]]();
    current = i;
    views.forEach((v, k) => v.classList.toggle('active', k === i));
    items.forEach((b, k) => {
      b.classList.toggle('current', k === i); b.classList.toggle('done', k < i);
      if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    btnPrev.hidden = i === 0;
    document.querySelector('.stage-top').style.maxWidth = views[i].querySelector('.sheet.wide') ? '1220px' : '';
    requestAnimationFrame(() => {
      fillRail();
      if (window.matchMedia('(max-width:980px)').matches) items[i].scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    if (push && location.hash !== '#' + ids[i]) history.pushState(null, '', '#' + ids[i]);
    window.scrollTo({ top: 0 });
    document.title = views[i].dataset.title.replace('&amp;', '&') + " · Hooke's law";
    if (onEnter[ids[i]]) onEnter[ids[i]]();
  }
  window.addEventListener('resize', () => requestAnimationFrame(fillRail));
  btnPrev.addEventListener('click', () => goTo(current - 1, true));
  document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => goTo(current + 1, true)));
  function fromHash() { const k = ids.indexOf(location.hash.replace('#', '')); return k < 0 ? 0 : k; }
  window.addEventListener('popstate', () => goTo(fromHash(), false));
  window.addEventListener('hashchange', () => goTo(fromHash(), false));

  /* =====================================================================
     4. CUSTOM CURSOR — a tiny spring with a hook that lags behind the pointer
     ===================================================================== */
  const cur = $('cursor');
  const fine = window.matchMedia('(pointer:fine)').matches;
  if (fine) {
    const svgC = cur.querySelector('svg'), coil = $('cu-coil'), hook = $('cu-hook');
    const arm = el('g', null, svgC); arm.appendChild(coil); arm.appendChild(hook);
    const REST = 26;
    let curX = -100, curY = -100, lx = null, ly = null, pvx = 0, pvy = 0, ux = 0, uy = REST, vx = 0, vy = 0, lastT = 0, running = false;
    function drawC() {
      const len = Math.hypot(ux, uy), ang = Math.atan2(-ux, uy) * 180 / Math.PI;
      let d = 'M0 3 L0 6', n = 6, a = 6, b = len - 4;
      for (let i = 1; i <= n * 2; i++) d += ` L${i % 2 ? 3.6 : -3.6} ${(a + (b - a) * (i - .5) / (n * 2)).toFixed(1)}`;
      d += ` L0 ${b.toFixed(1)} L0 ${len.toFixed(1)}`;
      coil.setAttribute('d', d);
      hook.setAttribute('d', `M0 ${len.toFixed(1)} v4 a3.6 3.6 0 1 1 -3.6 3.6`);
      arm.setAttribute('transform', `rotate(${ang.toFixed(2)})`);
    }
    function tickC(now) {
      const dt = Math.min(.04, (now - lastT) / 1000 || .016); lastT = now;
      const cvx = lx == null ? 0 : (curX - lx) / dt, cvy = ly == null ? 0 : (curY - ly) / dt; lx = curX; ly = curY;
      const ax = clamp((cvx - pvx) / dt, -40000, 40000), ay = clamp((cvy - pvy) / dt, -40000, 40000); pvx = cvx; pvy = cvy;
      const w = 22, z = .28;
      const fx = -w * w * ux - 2 * z * w * vx - ax * .55, fy = -w * w * (uy - REST) - 2 * z * w * vy - ay * .55;
      vx += fx * dt; vy += fy * dt; ux += vx * dt; uy += vy * dt;
      ux = clamp(ux, -22, 22); uy = clamp(uy, 12, 44);
      drawC();
      if (Math.abs(vx) + Math.abs(vy) > .5 || Math.abs(ux) > .2 || Math.abs(uy - REST) > .2 || Math.abs(cvx) + Math.abs(cvy) > 1) requestAnimationFrame(tickC);
      else { running = false; ux = 0; uy = REST; vx = vy = 0; drawC(); }
    }
    drawC();
    window.addEventListener('mousemove', e => {
      if (!document.body.classList.contains('has-cursor')) document.body.classList.add('has-cursor');
      curX = e.clientX; curY = e.clientY;
      cur.style.transform = `translate(${curX}px,${curY}px)`;
      cur.classList.remove('hidden');
      const t = e.target.closest ? e.target : null;
      const grab = t && t.closest('.mass-g:not(.locked), .handle');
      const hot = t && t.closest('button:not(:disabled), a, select, label, input[type=range], input[type=checkbox], .live');
      cur.classList.toggle('grab', !!grab);
      cur.classList.toggle('hot', !!hot && !grab);
      if (!running && !reduced) { running = true; lastT = performance.now(); lx = curX; ly = curY; pvx = pvy = 0; requestAnimationFrame(tickC); }
    }, { passive: true });
    document.addEventListener('mouseleave', () => cur.classList.add('hidden'));
    window.addEventListener('blur', () => cur.classList.add('hidden'));
  }

  /* =====================================================================
     5. AIM HERO + MEDICAL ICONS
     ===================================================================== */
  (function aimHero() {
    const svg = $('aim-hero'), id = 'ah'; rigDefs(svg, id);
    const g = el('g', null, svg);
    const P = drawStand(g, id, { rodX: 42, baseY: 412, armY: 40, hookX: 150, top: 14 });
    const RX = 196, Y0 = 112, SC = 9;
    drawRuler(g, id, RX, 32, Y0, SC, 30, { every: 2, fs: 10 });
    const sp = makeSpring(svg, { w: 2 });
    const ptr = el('g', null, svg);
    el('line', { x1: P.x, y1: 0, x2: RX + 1, y2: 0, stroke: C.coral2, 'stroke-width': 2.2 }, ptr);
    el('path', { d: `M${RX + 1} 0 l-7 -3.5 v7 z`, fill: C.coral2 }, ptr);
    el('circle', { cx: P.x, cy: 0, r: 3, fill: '#35303f' }, ptr);
    const hang = el('g', null, svg);
    const baseTop = hangerShape(hang, P.x, 0, 46, 40);
    const masses = [0, 1, 2].map(j => { const mg = el('g', { opacity: 0 }, hang); massShape(mg, id, P.x, baseTop - (j + 1) * 10, 34, 9.4, '20 g'); return mg; });
    const lab = txt(svg, 62, 384, '', { 'font-size': 18, fill: C.plum2, 'font-family': F_HAND });
    const seq = [0, 20, 40, 60, 40, 20];
    let k = 0, m = 0, e = 3, v = 0, nextAt = 0, last = performance.now();
    function draw() {
      const yP = Y0 + e * SC;
      sp.set(P.x, P.y - 2, yP, 9, 12);
      ptr.setAttribute('transform', `translate(0 ${yP})`);
      hang.setAttribute('transform', `translate(0 ${yP + 2})`);
      masses.forEach((mg, j) => mg.setAttribute('opacity', j < m / 20 ? 1 : 0));
      lab.textContent = `m = ${m} g`;
    }
    function f(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (now > nextAt) { k = (k + 1) % seq.length; m = seq[k]; nextAt = now + 3200; }
      const eq = 3 + m / 10, w = 8, a = -w * w * (e - eq) - 2 * .11 * w * v;
      v += a * dt; e += v * dt; draw();
      if (!reduced) requestAnimationFrame(f);
    }
    m = 20; e = 5; nextAt = performance.now() + 2500; k = 1; draw();
    requestAnimationFrame(f);
  })();
  (function medIcons() {
    const anim = (parent, attr, values, dur) => { if (!reduced) el('animate', { attributeName: attr, values, dur, repeatCount: 'indefinite', calcMode: 'spline', keySplines: '.45 0 .55 1;.45 0 .55 1', keyTimes: '0;.5;1' }, parent); };
    // 1 · tendon between two bones, stretching
    let s = $('med-ic-1');
    el('circle', { cx: 40, cy: 40, r: 38, fill: '#eeeaf6' }, s);
    el('rect', { x: 6, y: 31, width: 20, height: 18, rx: 7, fill: '#f6f1e6', stroke: '#b9ad92', 'stroke-width': 1.5 }, s);
    const rb = el('rect', { x: 54, y: 31, width: 20, height: 18, rx: 7, fill: '#f6f1e6', stroke: '#b9ad92', 'stroke-width': 1.5 }, s);
    anim(rb, 'x', '50;57;50', '2.4s');
    [34, 40, 46].forEach((y, i) => {
      const p = el('path', { d: `M26 ${y} C33 ${y - 5} 38 ${y + 5} 45 ${y} S52 ${y - 4} 50 ${y}`, fill: 'none', stroke: i === 1 ? '#c2493a' : '#e0644a', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, s);
      anim(p, 'd', `M26 ${y} C33 ${y - 5} 38 ${y + 5} 45 ${y} S52 ${y - 4} 50 ${y};M26 ${y} C34 ${y - 1.5} 41 ${y + 1.5} 48 ${y} S56 ${y - 1} 57 ${y};M26 ${y} C33 ${y - 5} 38 ${y + 5} 45 ${y} S52 ${y - 4} 50 ${y}`, '2.4s');
    });
    // 2 · prosthetic running blade flexing
    s = $('med-ic-2');
    el('circle', { cx: 40, cy: 40, r: 38, fill: '#fcece6' }, s);
    el('rect', { x: 30, y: 8, width: 20, height: 22, rx: 8, fill: '#5a3e85' }, s);
    el('rect', { x: 36, y: 28, width: 8, height: 8, rx: 2, fill: '#433c50' }, s);
    const blade = el('path', { d: 'M40 36 C40 52 44 62 34 66 C26 69 22 66 18 66', fill: 'none', stroke: '#2b2735', 'stroke-width': 4.5, 'stroke-linecap': 'round' }, s);
    anim(blade, 'd', 'M40 36 C40 52 44 62 34 66 C26 69 22 66 18 66;M40 36 C40 50 47 58 36 63 C27 67 22 66 18 66;M40 36 C40 52 44 62 34 66 C26 69 22 66 18 66', '1.4s');
    el('line', { x1: 12, y1: 69.5, x2: 66, y2: 69.5, stroke: '#b9b2c6', 'stroke-width': 1.5 }, s);
    // 3 · bone under tension
    s = $('med-ic-3');
    el('circle', { cx: 40, cy: 40, r: 38, fill: '#e5eef2' }, s);
    const bone = el('g', null, s);
    el('path', { d: 'M22 34 a6 6 0 1 1 6 -6 l24 0 a6 6 0 1 1 6 6 l0 12 a6 6 0 1 1 -6 6 l-24 0 a6 6 0 1 1 -6 -6 z', fill: '#faf6ec', stroke: '#a99c7c', 'stroke-width': 1.6 }, bone);
    if (!reduced) el('animateTransform', { attributeName: 'transform', type: 'scale', values: '1 1;1.05 .985;1 1', dur: '2s', repeatCount: 'indefinite', additive: 'sum' }, bone);
    bone.setAttribute('transform-origin', '40 40'); bone.style.transformOrigin = '40px 40px';
    [[10, 40, 3, 40], [70, 40, 77, 40]].forEach(([x1, y1, x2, y2]) => el('line', { x1, y1, x2, y2, stroke: '#3f6a80', 'stroke-width': 2.2 }, s));
    el('path', { d: 'M5 36 l-3 4 3 4 M75 36 l3 4 -3 4', fill: 'none', stroke: '#3f6a80', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
  })();

  /* =====================================================================
     6. THEORY — stretch a spring
     ===================================================================== */
  const LIMIT = 150;   // g, elastic limit of the simulated springs
  function extOf(m, k) {   // cm: linear up to the limit, growing faster beyond it
    const lin = m * G_CGS / k;
    if (m <= LIMIT) return lin;
    const over = m - LIMIT;
    return LIMIT * G_CGS / k + over * G_CGS / k * (1 + over / 25);
  }
  (function demo() {
    const svg = $('demo-svg'), id = 'dm'; rigDefs(svg, id);
    const defs = svg.querySelector('defs');
    [['dm-ar-c', C.coral2], ['dm-ar-p', C.plum]].forEach(([mid, c]) => {
      const mk = el('marker', { id: mid, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0 0 L10 5 L0 10 z', fill: c }, mk);
    });
    const g = el('g', null, svg);
    const P = drawStand(g, id, { rodX: 58, baseY: 450, armY: 40, hookX: 210, top: 14 });
    const RX = 252, Y0 = 114, SC = 7, ZERO = 2;
    drawRuler(g, id, RX, 34, Y0, SC, 46, { every: 5, fs: 10 });
    txt(g, RX + 17, Y0 - 18, 'cm', { 'font-size': 11, fill: C.muted, 'text-anchor': 'middle', 'font-family': F_MONO });
    const sp = makeSpring(svg, { w: 2 });
    const ptr = el('g', null, svg);
    el('line', { x1: P.x, y1: 0, x2: RX + 1, y2: 0, stroke: C.coral2, 'stroke-width': 2.2 }, ptr);
    el('path', { d: `M${RX + 1} 0 l-7 -3.5 v7 z`, fill: C.coral2 }, ptr);
    const hang = el('g', null, svg);
    const baseTop = hangerShape(hang, P.x, 0, 62, 44);
    const stack = el('g', null, hang);
    const arrows = el('g', null, svg);
    const zeroLine = el('line', { x1: P.x + 14, x2: RX, y1: Y0 + ZERO * SC, y2: Y0 + ZERO * SC, stroke: C.plum3, 'stroke-dasharray': '4 4' }, svg);
    const dimG = el('g', null, svg);
    const mIn = $('d-m'), mOut = $('d-m-o'), read = $('d-read');
    let k = 14000, m = 40, e = extOf(40, k), v = 0, raf = 0, last = 0, active = false;
    const kSeg = radioGroup('d-k', b => { k = +b.dataset.k; update(); });
    function drawStack() {
      stack.innerHTML = '';
      const n = Math.round(m / 10);
      for (let j = 0; j < n; j++) massShape(stack, id, P.x, baseTop - (j + 1) * 6, 36, 5.6, '');
    }
    function draw() {
      const yP = Y0 + (ZERO + e) * SC;
      sp.set(P.x, P.y - 2, yP, 10, 13);
      sp.color(m > LIMIT ? '#9b3a2a' : '#35303f', m > LIMIT ? '#e6b3a8' : '#9d98ad');
      ptr.setAttribute('transform', `translate(0 ${yP})`);
      hang.setAttribute('transform', `translate(0 ${yP + 2})`);
      arrows.innerHTML = '';
      const ax = P.x - 46;
      const spring = (m > LIMIT ? m : k * e / G_CGS);   // spring force in "grams-weight" for the arrow length
      const Lw = m * .55, Ls = Math.max(0, spring) * .55;
      if (m > 0) {
        const yc = yP + 2 + baseTop - Math.round(m / 10) * 3;
        el('line', { x1: ax, y1: yc, x2: ax, y2: yc + Lw, stroke: C.coral2, 'stroke-width': 3, 'marker-end': 'url(#dm-ar-c)' }, arrows);
        txt(arrows, ax - 16, yc + Lw / 2 + 6, 'mg', { 'font-size': 18, fill: C.coral2, 'text-anchor': 'end', 'font-family': F_HEAD, 'font-style': 'italic', 'font-weight': 600 });
        el('line', { x1: ax, y1: yP, x2: ax, y2: yP - Ls, stroke: C.plum, 'stroke-width': 3, 'marker-end': 'url(#dm-ar-p)' }, arrows);
        txt(arrows, ax - 16, yP - Ls / 2 + 6, 'kΔL', { 'font-size': 18, fill: C.plum, 'text-anchor': 'end', 'font-family': F_HEAD, 'font-style': 'italic', 'font-weight': 600 });
      }
      dimG.innerHTML = '';
      if (e > .4) {
        const x = RX + 46, y1 = Y0 + ZERO * SC, y2 = yP;
        el('path', { d: `M${x} ${y1} v${y2 - y1} M${x - 5} ${y1} h10 M${x - 5} ${y2} h10`, stroke: C.plum, 'stroke-width': 1.8, fill: 'none' }, dimG);
        txt(dimG, x + 8, (y1 + y2) / 2 + 6, 'ΔL', { 'font-size': 20, fill: C.plum, 'font-family': F_HEAD, 'font-style': 'italic', 'font-weight': 600 });
      }
    }
    function tick(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const eq = extOf(m, k), w = 9, a = -w * w * (e - eq) - 2 * .14 * w * v;
      v += a * dt; e += v * dt; draw();
      if (active && (Math.abs(e - eq) > .005 || Math.abs(v) > .01)) raf = requestAnimationFrame(tick); else { if (active) { e = eq; v = 0; draw(); } raf = 0; }
    }
    function kick() { if (reduced) { e = extOf(m, k); draw(); return; } if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    /* mini graph of ΔL against m */
    const fx = $('demo-fx');
    const GX0 = 46, GX1 = 300, GY0 = 30, GY1 = 176, XM = 200, YM = 32;
    const X = mm => GX0 + mm / XM * (GX1 - GX0), Y = d => GY1 - Math.min(d, YM) / YM * (GY1 - GY0);
    function drawFx() {
      fx.innerHTML = '';
      el('rect', { x: X(LIMIT), y: GY0, width: X(XM) - X(LIMIT), height: GY1 - GY0, fill: '#fcece6' }, fx);
      txt(fx, (X(LIMIT) + X(XM)) / 2, GY0 + 14, 'beyond limit', { 'font-size': 11, fill: C.coral2, 'text-anchor': 'middle' });
      for (let i = 0; i <= 4; i++) el('line', { x1: X(i * 50), y1: GY0, x2: X(i * 50), y2: GY1, stroke: '#eeebf2' }, fx);
      for (let j = 0; j <= 4; j++) el('line', { x1: GX0, y1: Y(j * 8), x2: GX1, y2: Y(j * 8), stroke: '#eeebf2' }, fx);
      el('path', { d: `M${GX0} ${GY0 - 6} V${GY1} H${GX1 + 6}`, fill: 'none', stroke: C.ink, 'stroke-width': 1.5 }, fx);
      [0, 50, 100, 150, 200].forEach(v2 => txt(fx, X(v2), GY1 + 16, String(v2), { 'font-size': 11.5, fill: C.ink2, 'text-anchor': 'middle' }));
      [8, 16, 24, 32].forEach(v2 => txt(fx, GX0 - 6, Y(v2) + 4, String(v2), { 'font-size': 11.5, fill: C.ink2, 'text-anchor': 'end' }));
      txt(fx, GX0, GY0 - 12, 'ΔL (cm)', { 'font-size': 13, 'font-weight': 700, fill: C.coral2, 'text-anchor': 'middle' });
      txt(fx, GX1 + 6, GY1 + 32, 'Load m (g)', { 'font-size': 13, 'font-weight': 700, fill: C.steel, 'text-anchor': 'end' });
      kSeg.btns.forEach(b => {
        const kk = +b.dataset.k, on = kk === k;
        let d = '';
        for (let mm = 0; mm <= XM; mm += 2) { const yy = Y(extOf(mm, kk)); d += (mm ? 'L' : 'M') + X(mm).toFixed(1) + ' ' + yy.toFixed(1); if (extOf(mm, kk) > YM) break; }
        el('path', { d, fill: 'none', stroke: on ? C.plum : '#cfc8dc', 'stroke-width': on ? 2.6 : 1.5 }, fx);
      });
      const de = extOf(m, k);
      el('circle', { cx: X(m), cy: Y(de), r: 6, fill: m > LIMIT ? C.coral : '#fff', stroke: m > LIMIT ? C.coral2 : C.plum2, 'stroke-width': 2.4 }, fx);
    }
    function update() {
      m = +mIn.value; mOut.textContent = m + ' g';
      drawStack(); drawFx();
      const F = m * G_CGS, de = extOf(m, k);
      read.className = 'demo-read' + (m > LIMIT ? ' warn' : '');
      if (m === 0) read.innerHTML = 'No load: the spring hangs at its natural length, so ΔL = 0.';
      else if (m <= LIMIT) read.innerHTML = `F = mg = ${m} × 980 = <b>${fmtK(F)} dyne</b><br>ΔL = F / k = ${fmtK(F)} / ${fmtK(k)} = <b>${de.toFixed(2)} cm</b>`;
      else read.innerHTML = `F = mg = <b>${fmtK(F)} dyne</b>, ΔL = <b>${de.toFixed(1)} cm</b><br>Past the elastic limit: the extension grows faster than the load, and a real spring would stay permanently stretched.`;
      kick();
    }
    mIn.addEventListener('input', update);
    onEnter.theory = () => { active = true; kick(); };
    onLeave.theory = () => { active = false; };
    update(); e = extOf(m, k); draw();
  })();

  /* =====================================================================
     7. METHOD — apparatus + illustrated steps
     ===================================================================== */
  /* A complete small rig: stand, ruler, spring, pointer, hanger and n slotted masses */
  function miniRig(svg, id, o) {
    o = Object.assign({ rodX: 70, baseY: 352, armY: 40, hookX: 196, RX: 234, Y0: 88, SC: 14, cm: 14, R: 10, coils: 12, stem: 52 }, o || {});
    const g = el('g', null, svg);
    const P = drawStand(g, id, { rodX: o.rodX, baseY: o.baseY, armY: o.armY, hookX: o.hookX, top: 14 });
    drawRuler(g, id, o.RX, 32, o.Y0, o.SC, o.cm, { every: 1, fs: 10.5 });
    const sp = makeSpring(svg, { w: 2 });
    const ptr = el('g', null, svg);
    el('line', { x1: P.x, y1: 0, x2: o.RX + 1, y2: 0, stroke: C.coral2, 'stroke-width': 2.2 }, ptr);
    el('path', { d: `M${o.RX + 1} 0 l-7 -3.5 v7 z`, fill: C.coral2 }, ptr);
    el('circle', { cx: P.x, cy: 0, r: 3, fill: '#35303f' }, ptr);
    const hang = el('g', null, svg);
    const baseTop = hangerShape(hang, P.x, 0, o.stem, 44);
    const ms = [0, 1, 2, 3].map(j => { const mg = el('g', { opacity: 0 }, hang); massShape(mg, id, P.x, baseTop - (j + 1) * 11, 38, 10.4, '20 g'); return mg; });
    function set(reading, n) {
      const yP = o.Y0 + reading * o.SC;
      sp.set(P.x, P.y - 2, yP, o.R, o.coils);
      ptr.setAttribute('transform', `translate(0 ${yP})`);
      hang.setAttribute('transform', `translate(0 ${yP + 2})`);
      ms.forEach((mg, j) => mg.setAttribute('opacity', j < n ? 1 : 0));
      return yP;
    }
    return { P, set, o, baseTop };
  }
  const exReading = m => EX.zero + m * G_CGS / EX.K;
  (function apparatus() {
    const grid = $('app-grid');
    const items = [
      ['Ring stand', s => { rigDefs(s, 'ap1'); drawStand(s, 'ap1', { rodX: 44, baseY: 102, armY: 24, hookX: 92, top: 8 }); }],
      ['Clamp', s => { rigDefs(s, 'ap2'); el('rect', { x: 18, y: 20, width: 8, height: 80, rx: 3, fill: 'url(#ap2-rod)' }, s); el('rect', { x: 12, y: 44, width: 22, height: 22, rx: 5, fill: '#2f2b3c' }, s); el('circle', { cx: 23, cy: 55, r: 3.5, fill: '#77738a' }, s); el('rect', { x: 32, y: 51, width: 64, height: 8, rx: 3, fill: 'url(#ap2-rod)' }, s); el('path', { d: 'M90 59 v8 a5 5 0 1 0 5 5', fill: 'none', stroke: '#4a4559', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, s); }],
      ['Spring', s => { const sp = makeSpring(s, { w: 2.2 }); sp.set(60, 8, 102, 13, 9); }],
      ['Pointer', s => { const sp = makeSpring(s, { w: 2 }); sp.set(40, 6, 56, 10, 4); el('line', { x1: 40, y1: 58, x2: 92, y2: 58, stroke: C.coral2, 'stroke-width': 2.6 }, s); el('path', { d: 'M94 58 l-9 -4.5 v9 z', fill: C.coral2 }, s); el('circle', { cx: 40, cy: 58, r: 3.4, fill: '#35303f' }, s); el('path', { d: 'M40 62 v6 a4 4 0 1 1 0 8', fill: 'none', stroke: '#4a4559', 'stroke-width': 1.8 }, s); }],
      ['Ruler', s => { rigDefs(s, 'ap5'); drawRuler(s, 'ap5', 46, 28, 14, 9, 9, { every: 1, fs: 9 }); }],
      ['Hanger and 20 g slotted masses', s => { rigDefs(s, 'ap6'); const bt = hangerShape(s, 44, 8, 70, 44); [0, 1, 2].forEach(j => massShape(s, 'ap6', 44, bt - (j + 1) * 11, 38, 10.4, '20 g')); el('ellipse', { cx: 94, cy: 74, rx: 20, ry: 8, fill: '#565168', stroke: '#211d2b' }, s); el('rect', { x: 92, y: 66, width: 4, height: 9, fill: '#f6f5f8' }, s); el('ellipse', { cx: 94, cy: 74, rx: 3, ry: 1.4, fill: '#f6f5f8' }, s); txt(s, 94, 98, 'slot', { 'font-size': 11, fill: C.muted, 'text-anchor': 'middle', 'font-family': F_HAND }); }]
    ];
    items.forEach(([name, f]) => {
      const d = document.createElement('div'); d.className = 'app-item';
      const s = el('svg', { viewBox: '0 0 120 110', 'aria-hidden': 'true' }); d.appendChild(s); f(s);
      const sp = document.createElement('span'); sp.textContent = name; d.appendChild(sp);
      grid.appendChild(d);
    });
  })();

  (function method() {
    const fig = $('step-fig'), cap = $('step-cap');
    const btns = Array.from(document.querySelectorAll('#steps .step'));
    let anim = 0, cur = 0;
    const caps = [
      'The spring hangs from the clamp arm. The pointer at its lower end sits against the vertical ruler, and the hanger hangs below it.',
      'With only the hanger on the spring, read the pointer at eye level. This initial reading is the zero for every extension.',
      'Add one 20 g slotted mass at a time, lowering it gently onto the hanger: 20, 40, 60 and 80 g.',
      'Each new load sets the spring bouncing. Wait until the pointer is still, then read it. ΔL = reading − initial reading.',
      'Each row of the table gives one point: the load across, the extension up. Points on a straight line through the origin verify Hooke\'s law.',
      'Take two points far apart on the line. The slope is the rise over the run, y over x.',
      'The slope is g/K, so K = g · 1/S. With ΔL in cm and m in g, g must be in cm/s²: 9.8 m/s² = 980 cm/s².'
    ];
    function mk(w, h) { const s = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img' }); fig.innerHTML = ''; fig.appendChild(s); return s; }
    function hand(s, x, y, t, c, size, anchor) { return txt(s, x, y, t, { 'font-family': F_HAND, 'font-size': size || 21, fill: c || C.plum, 'text-anchor': anchor || 'start' }); }
    function stopAnim() { cancelAnimationFrame(anim); anim = 0; }
    function exGraph(s, o) {
      const X = m => 70 + m * 4.1, Y = v => 310 - v * 40;
      for (let i = 0; i <= 10; i++) el('line', { x1: X(i * 10), y1: Y(0), x2: X(i * 10), y2: Y(7), stroke: i % 2 ? '#f1eff4' : '#e3dfea' }, s);
      for (let j = 0; j <= 7; j++) el('line', { x1: X(0), y1: Y(j), x2: X(100), y2: Y(j), stroke: '#e3dfea' }, s);
      el('path', { d: `M${X(0)} ${Y(7) - 8} V${Y(0)} H${X(100) + 8}`, fill: 'none', stroke: C.ink, 'stroke-width': 2 }, s);
      txt(s, X(0), Y(7) - 16, 'ΔL (cm)', { 'font-size': 16, 'font-weight': 700, fill: C.coral2, 'text-anchor': 'middle' });
      txt(s, X(100) + 6, Y(0) + 40, 'Load m (g)', { 'font-size': 16, 'font-weight': 700, fill: C.steel, 'text-anchor': 'end' });
      [0, 20, 40, 60, 80, 100].forEach(v => txt(s, X(v), Y(0) + 20, String(v), { 'font-size': 14, fill: C.ink2, 'text-anchor': 'middle' }));
      [1, 2, 3, 4, 5, 6, 7].forEach(v => txt(s, X(0) - 10, Y(v) + 5, String(v), { 'font-size': 14, fill: C.ink2, 'text-anchor': 'end' }));
      if (o.line) el('line', { x1: X(0), y1: Y(0), x2: X(96), y2: Y(96 * .07), stroke: C.plum, 'stroke-width': 2.6 }, s);
      if (o.tri) el('path', { d: `M${X(20)} ${Y(1.4)} H${X(80)} V${Y(5.6)}`, fill: 'rgba(224,100,74,.10)', stroke: C.coral2, 'stroke-dasharray': '6 4', 'stroke-width': 1.8 }, s);
      const pts = EX.rows.map(r => el('circle', { cx: X(r.m), cy: Y(r.e), r: 5.5, fill: '#fff', stroke: C.coral2, 'stroke-width': 2.4 }, s));
      return { X, Y, pts };
    }
    const draws = [
      function s1() {
        const s = mk(460, 360); rigDefs(s, 'm1');
        const R = miniRig(s, 'm1'); const yP = R.set(exReading(40), 2);
        hand(s, 120, 30, 'clamp', C.plum, 21, 'middle');
        hand(s, 150, 120, 'spring →', C.plum, 21, 'end');
        hand(s, 282, yP + 6, '← pointer', C.coral2);
        hand(s, 282, 330, '← ruler', C.plum);
        hand(s, 150, yP + 70, 'hanger →', C.plum, 21, 'end');
        hand(s, 30, 330, 'ring stand', C.plum);
      },
      function s2() {
        const s = mk(460, 360); rigDefs(s, 'm2');
        const R = miniRig(s, 'm2'); const yP = R.set(EX.zero, 0);
        // eye at the level of the pointer
        const ex = 400;
        el('path', { d: `M${ex - 18} ${yP} q18 -14 36 0 q-18 14 -36 0z`, fill: '#fff', stroke: C.ink, 'stroke-width': 1.8 }, s);
        el('circle', { cx: ex, cy: yP, r: 5, fill: C.plum2 }, s);
        el('line', { x1: 268, y1: yP, x2: ex - 22, y2: yP, stroke: C.plum3, 'stroke-dasharray': '5 5', 'stroke-width': 1.6 }, s);
        hand(s, ex, yP - 22, 'eye level', C.plum, 20, 'middle');
        el('rect', { x: 290, y: yP + 40, width: 156, height: 40, rx: 10, fill: '#eeeaf6' }, s);
        txt(s, 368, yP + 66, 'initial = 4.0 cm', { 'font-size': 17, 'font-weight': 600, fill: C.plum2, 'text-anchor': 'middle', 'font-family': F_MONO });
      },
      function s3() {
        const s = mk(460, 360); rigDefs(s, 'm3');
        const R = miniRig(s, 'm3');
        const lab = txt(s, 380, 120, '', { 'font-size': 40, 'font-weight': 600, fill: C.coral2, 'text-anchor': 'middle', 'font-family': F_MONO });
        hand(s, 380, 150, 'load on hanger', C.coral2, 19, 'middle');
        let n = 0, e = EX.zero, v = 0, next = 0, last = performance.now();
        function f(now) {
          const dt = Math.min(.05, (now - last) / 1000); last = now;
          if (now > next) { n = (n + 1) % 5; next = now + (n === 4 ? 2600 : 1900); }
          const eq = exReading(n * 20), w = 9, a = -w * w * (e - eq) - 2 * .13 * w * v;
          v += a * dt; e += v * dt; R.set(e, n); lab.textContent = (n * 20) + ' g';
          if (!reduced) anim = requestAnimationFrame(f);
        }
        R.set(EX.zero, 0); anim = requestAnimationFrame(f);
      },
      function s4() {
        const s = mk(460, 360); rigDefs(s, 'm4');
        const R = miniRig(s, 'm4', { RX: 214, hookX: 176, rodX: 56 });
        const GX = 270, GW = 175, GY = 70, GH = 150;
        el('rect', { x: GX, y: GY, width: GW, height: GH, rx: 8, fill: '#faf9fc', stroke: C.line }, s);
        txt(s, GX + 6, GY - 8, 'pointer reading over time', { 'font-size': 13, fill: C.muted });
        const eqY = GY + GH / 2;
        el('line', { x1: GX, y1: eqY, x2: GX + GW, y2: eqY, stroke: C.plum3, 'stroke-dasharray': '4 4' }, s);
        const tr = el('path', { fill: 'none', stroke: C.coral2, 'stroke-width': 2 }, s);
        const read = txt(s, GX + GW / 2, GY + GH + 50, '', { 'font-size': 18, 'font-weight': 600, fill: C.plum2, 'text-anchor': 'middle', 'font-family': F_MONO });
        const st = txt(s, GX + GW / 2, GY + GH + 26, '', { 'font-size': 20, fill: C.coral2, 'text-anchor': 'middle', 'font-family': F_HAND });
        let t0 = performance.now();
        const eq = exReading(40), A = eq - exReading(20);
        function f(now) {
          let t = (now - t0) / 1000; if (t > 6.5) { t0 = now; t = 0; }
          const disp = t < .4 ? -A : -A * Math.exp(-1.6 * (t - .4)) * Math.cos(9 * (t - .4));
          R.set(eq + disp, 2);
          let d = ''; const tt = Math.min(t, 4.5);
          for (let i = 0; i <= 90; i++) { const u = tt * i / 90; const dd = u < .4 ? -A : -A * Math.exp(-1.6 * (u - .4)) * Math.cos(9 * (u - .4)); d += (i ? 'L' : 'M') + (GX + u / 4.5 * GW).toFixed(1) + ' ' + (eqY + dd * 32).toFixed(1); }
          tr.setAttribute('d', d);
          const settled = t > 3.4;
          st.textContent = t < .4 ? 'load added…' : settled ? 'settled: read now' : 'wait…';
          read.textContent = settled ? '40 g → 6.8 cm' : '';
          if (!reduced) anim = requestAnimationFrame(f);
        }
        anim = requestAnimationFrame(f);
      },
      function s5() {
        const s = mk(460, 360);
        exGraph(s, { line: true });
        hand(s, 170, 70, 'straight line through the origin', C.plum, 21, 'middle');
        hand(s, 170, 96, '→ Hooke\'s law verified', C.plum, 21, 'middle');
      },
      function s6() {
        const s = mk(460, 360);
        const G = exGraph(s, { line: true, tri: true });
        hand(s, G.X(50), G.Y(1.4) + 24, 'x₂ − x₁ = 60 g', C.coral2, 19, 'middle');
        hand(s, G.X(80) + 8, G.Y(3.5), 'y₂ − y₁', C.coral2, 19);
        hand(s, G.X(80) + 8, G.Y(3.5) + 20, '= 4.2 cm', C.coral2, 19);
        hand(s, 190, 66, 'S = (y₂ − y₁) / (x₂ − x₁)', C.plum, 22, 'middle');
        hand(s, 190, 92, '= 4.2 / 60 = 0.07 cm/g', C.plum, 22, 'middle');
      },
      function s7() {
        const s = mk(460, 360);
        txt(s, 230, 120, 'K = g · 1/S', { 'font-family': F_HEAD, 'font-size': 58, 'font-weight': 700, fill: C.ink, 'text-anchor': 'middle' });
        el('rect', { x: 80, y: 150, width: 300, height: 40, rx: 10, fill: '#fcece6' }, s);
        txt(s, 230, 177, 'g = 9.8 m/s² = 980 cm/s²', { 'font-family': F_MONO, 'font-size': 17, 'font-weight': 600, fill: C.coral2, 'text-anchor': 'middle' });
        txt(s, 230, 230, 'K = 980 × 1/0.07', { 'font-family': F_MONO, 'font-size': 19, fill: C.plum2, 'text-anchor': 'middle' });
        txt(s, 230, 268, '= 14 000 dyne/cm', { 'font-family': F_MONO, 'font-size': 22, 'font-weight': 600, fill: C.plum2, 'text-anchor': 'middle' });
      }
    ];
    function show(k) {
      stopAnim(); cur = k;
      btns.forEach((b, i) => b.setAttribute('aria-pressed', i === k ? 'true' : 'false'));
      draws[k](); cap.textContent = caps[k];
    }
    btns.forEach((b, i) => b.addEventListener('click', () => show(i)));
    onEnter.method = () => show(cur);
    onLeave.method = stopAnim;
    show(0);
  })();

  /* =====================================================================
     8. GRAPH PAPER — ΔL (y) against m (x)
     ===================================================================== */
  const GX = { x0: 104, x1: 716, y0: 66, y1: 462 };
  function niceStep(max, maxTicks) {
    const c = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    return c.find(s => max / s <= maxTicks) || 1000;
  }
  function graphBase(svg, o) {
    svg.innerHTML = '';
    const xmax = o.xmax, ymax = o.ymax, xs = o.xstep || niceStep(xmax, 10), ys = o.ystep || niceStep(ymax, 8);
    const X = x => GX.x0 + (x / xmax) * (GX.x1 - GX.x0);
    const Y = y => GX.y1 - (y / ymax) * (GX.y1 - GX.y0);
    const inv = (px, py) => [(px - GX.x0) / (GX.x1 - GX.x0) * xmax, (GX.y1 - py) / (GX.y1 - GX.y0) * ymax];
    const defs = el('defs', null, svg);
    const m = el('marker', { id: svg.id + '-ax', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto' }, defs);
    el('path', { d: 'M0 0 L10 5 L0 10 z', fill: C.ink }, m);
    const grid = el('g', null, svg);
    el('rect', { x: GX.x0, y: GX.y0, width: GX.x1 - GX.x0, height: GX.y1 - GX.y0, fill: '#fcfbfd' }, grid);
    const xm = xs / 5, ym = ys / 5;
    for (let i = 0; i * xm <= xmax + 1e-9; i++) { const x = X(i * xm); el('line', { x1: x, y1: GX.y0, x2: x, y2: GX.y1, stroke: i % 5 ? '#f0edf4' : '#ddd7e6', 'stroke-width': i % 5 ? .8 : 1.1 }, grid); }
    for (let j = 0; j * ym <= ymax + 1e-9; j++) { const y = Y(j * ym); el('line', { x1: GX.x0, y1: y, x2: GX.x1, y2: y, stroke: j % 5 ? '#f0edf4' : '#ddd7e6', 'stroke-width': j % 5 ? .8 : 1.1 }, grid); }
    const under = el('g', null, svg);
    el('line', { x1: GX.x0, y1: GX.y1, x2: GX.x1 + 16, y2: GX.y1, stroke: C.ink, 'stroke-width': 2, 'marker-end': `url(#${svg.id}-ax)` }, svg);
    el('line', { x1: GX.x0, y1: GX.y1, x2: GX.x0, y2: GX.y0 - 16, stroke: C.ink, 'stroke-width': 2, 'marker-end': `url(#${svg.id}-ax)` }, svg);
    const tl = el('g', { fill: C.ink2, 'font-size': 19 }, svg);
    const dx = xs < 1 ? 1 : 0, dy = ys < 1 ? (ys < .2 ? 2 : 1) : 0;
    for (let v = 0; v <= xmax + 1e-9; v += xs) { txt(tl, X(v), GX.y1 + 28, v ? Math.abs(v).toFixed(dx) : '0', { 'text-anchor': 'middle' }); el('line', { x1: X(v), y1: GX.y1, x2: X(v), y2: GX.y1 + 6, stroke: C.ink }, svg); }
    for (let v = ys; v <= ymax + 1e-9; v += ys) { txt(tl, GX.x0 - 12, Y(v) + 6, Math.abs(v).toFixed(dy), { 'text-anchor': 'end' }); el('line', { x1: GX.x0 - 6, y1: Y(v), x2: GX.x0, y2: Y(v), stroke: C.ink }, svg); }
    txt(svg, GX.x0, 34, 'ΔL (cm)', { 'font-size': 23, 'font-weight': 700, fill: C.coral2, 'text-anchor': 'middle' });
    txt(svg, GX.x1 + 14, GX.y1 + 64, 'Load m (g)', { 'font-size': 23, 'font-weight': 700, fill: C.steel, 'text-anchor': 'end' });
    const layers = { under, ref: el('g', null, svg), line: el('g', null, svg), tri: el('g', null, svg), hover: el('g', null, svg), pts: el('g', null, svg), top: el('g', null, svg) };
    return { X, Y, inv, xmax, ymax, layers };
  }
  function lineSeg(G, parent, S, c, xa, xb, attrs) {
    let a = xa, b = xb;
    const yAt = x => S * x + c;
    if (S !== 0) {
      const xTop = (G.ymax - c) / S, xBot = (0 - c) / S;
      const lo = Math.min(xTop, xBot), hi = Math.max(xTop, xBot);
      a = Math.max(a, lo); b = Math.min(b, hi);
    }
    if (b <= a) return null;
    return el('line', Object.assign({ x1: G.X(a), y1: G.Y(yAt(a)), x2: G.X(b), y2: G.Y(yAt(b)), stroke: C.plum, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, attrs || {}), parent);
  }
  function slopeTri(G, parent, p1, p2) {
    const [x1, y1] = p1[0] <= p2[0] ? p1 : p2, [x2, y2] = p1[0] <= p2[0] ? p2 : p1;
    const A = [G.X(x1), G.Y(y1)], B = [G.X(x2), G.Y(y2)];
    el('path', { d: `M${A[0]} ${A[1]} H${B[0]} V${B[1]}`, fill: 'rgba(224,100,74,.10)', stroke: C.coral2, 'stroke-width': 2, 'stroke-dasharray': '7 5' }, parent);
    const dX = x2 - x1, dY = y2 - y1;
    const lowY = Math.max(A[1], B[1]);
    txt(parent, (A[0] + B[0]) / 2, Math.min(lowY + 30, GX.y1 - 8), `Δx = x₂ − x₁ = ${trim(Math.abs(dX), 2)} g`, { class: 'hand', 'font-size': 23, fill: C.coral2, 'text-anchor': 'middle' });
    const room = B[0] + 12 + 215 < 760;   // space to the right of the vertical leg
    const yLab = room ? (A[1] + B[1]) / 2 + 8 : A[1] - 12;
    txt(parent, B[0] + (room ? 12 : -12), yLab, `Δy = y₂ − y₁ = ${trim(Math.abs(dY), 3)} cm`, { class: 'hand', 'font-size': 23, fill: C.coral2, 'text-anchor': room ? 'start' : 'end' });
    return { dX, dY };
  }
  function ptMark(G, parent, x, y, extra, col) {
    const g = el('g', Object.assign({ class: 'ptg' }, extra || {}), parent);
    el('circle', { class: 'hit', cx: G.X(x), cy: G.Y(y), r: 18 }, g);
    el('circle', { class: 'pt-dot', cx: G.X(x), cy: G.Y(y), r: 7, fill: '#fff', stroke: col || C.coral2, 'stroke-width': 2.6 }, g);
    el('circle', { cx: G.X(x), cy: G.Y(y), r: 2.2, fill: col || C.coral2, 'pointer-events': 'none' }, g);
    return g;
  }
  function hoverMark(G, layer, x, y) {
    layer.innerHTML = '';
    const px = G.X(x), py = G.Y(y);
    el('path', { d: `M${GX.x0} ${py} H${px} V${GX.y1}`, fill: 'none', stroke: C.steel, 'stroke-width': 1.4, 'stroke-dasharray': '5 4' }, layer);
    const lab = (s, xx, yy, anchor) => {
      const t = txt(layer, xx, yy, s, { 'font-size': 15, 'font-weight': 600, fill: '#fff', 'text-anchor': anchor, 'font-family': F_MONO });
      const bb = t.getBBox();
      const r = el('rect', { x: bb.x - 6, y: bb.y - 3, width: bb.width + 12, height: bb.height + 6, rx: 5, fill: C.steel }, layer);
      layer.insertBefore(r, t);
    };
    lab(trim(y, 2), GX.x0 + 8, py - 8, 'start');
    lab(trim(x, 1), px, GX.y1 - 10, 'middle');
    const tip = `m = ${trim(x, 1)} g, ΔL = ${trim(y, 2)} cm`;
    const tx = clamp(px, GX.x0 + 110, GX.x1 - 110);
    const t = txt(layer, tx, py - 22, tip, { 'font-size': 16, 'font-weight': 600, fill: C.ink, 'text-anchor': 'middle' });
    const bb = t.getBBox();
    const r = el('rect', { x: bb.x - 10, y: bb.y - 5, width: bb.width + 20, height: bb.height + 10, rx: 8, fill: '#fff', stroke: '#cfcad8' }, layer);
    layer.insertBefore(r, t);
  }
  function leastSq(pts) {
    const n = pts.length; if (n < 2) return null;
    const meanX = pts.reduce((a, p) => a + p[0], 0) / n, meanY = pts.reduce((a, p) => a + p[1], 0) / n;
    let sxy = 0, sxx = 0; pts.forEach(p => { sxy += (p[0] - meanX) * (p[1] - meanY); sxx += (p[0] - meanX) ** 2; });
    if (sxx === 0) return null;
    const S = sxy / sxx; return { S, c: meanY - S * meanX };
  }

  /* =====================================================================
     9. GRAPH PAGE — hover to highlight, slide the slope triangle
     ===================================================================== */
  (function graphPage() {
    const svg = $('g-graph'), tbody = document.querySelector('#g-table tbody'), read = $('g-read'), limChk = $('g-limit');
    const S0 = .07;
    const BEYOND = [{ m: 100, e: 7.0 }, { m: 120, e: 8.4 }, { m: 140, e: 9.8 }, { m: 160, e: 11.5 }, { m: 180, e: 15.1 }];
    let mk = [20, 80], drag = null, lit = -1, G, pts = [];
    const rows = EX.rows.map((r, i) => {
      const tr = document.createElement('tr'); tr.innerHTML = `<td>${r.m}</td><td>${r.e.toFixed(1)}</td>`;
      tr.addEventListener('mouseenter', () => light(i)); tr.addEventListener('mouseleave', () => light(-1));
      tbody.appendChild(tr); return tr;
    });
    limChk.addEventListener('change', render);
    function light(i) {
      lit = i;
      rows.forEach((tr, k) => tr.classList.toggle('lit', k === i));
      pts.forEach((p, k) => p.classList.toggle('lit', k === i));
      if (i < 0) G.layers.hover.innerHTML = ''; else hoverMark(G, G.layers.hover, EX.rows[i].m, EX.rows[i].e);
    }
    function render() {
      const lim = limChk.checked;
      G = graphBase(svg, lim ? { xmax: 200, ymax: 16, xstep: 20, ystep: 2 } : { xmax: 100, ymax: 8, xstep: 10, ystep: 1 });
      if (lim) {
        el('rect', { x: G.X(150), y: GX.y0, width: G.X(200) - G.X(150), height: GX.y1 - GX.y0, fill: 'rgba(224,100,74,.07)' }, G.layers.under);
        el('line', { x1: G.X(150), y1: GX.y0, x2: G.X(150), y2: GX.y1, stroke: C.coral, 'stroke-dasharray': '6 5', 'stroke-width': 1.6 }, G.layers.under);
        txt(G.layers.under, G.X(150) + 8, GX.y1 - 14, 'elastic limit', { class: 'hand', 'font-size': 22, fill: C.coral2 });
        let d = `M${G.X(150)} ${G.Y(150 * S0)}`;
        for (let m2 = 150; m2 <= 185; m2 += 2.5) { const over = m2 - 150; d += ` L${G.X(m2)} ${G.Y(150 * S0 + over * S0 * (1 + over / 25))}`; }
        el('path', { d, fill: 'none', stroke: C.coral, 'stroke-width': 2.2, 'stroke-dasharray': '7 5' }, G.layers.line);
        BEYOND.forEach(b => ptMark(G, G.layers.pts, b.m, b.e, null, '#c9a49b'));
      }
      lineSeg(G, G.layers.line, S0, 0, 0, lim ? 150 : 100);
      const a = [mk[0], mk[0] * S0], b = [mk[1], mk[1] * S0];
      if (Math.abs(mk[1] - mk[0]) > 1) slopeTri(G, G.layers.tri, a, b);
      pts = EX.rows.map((r, i) => {
        const g = ptMark(G, G.layers.pts, r.m, r.e, { class: 'ptg live' });
        g.addEventListener('mouseenter', () => light(i)); g.addEventListener('mouseleave', () => light(-1));
        return g;
      });
      mk.forEach((x, k) => {
        const hg = el('g', { class: 'handle' }, G.layers.top);
        el('circle', { cx: G.X(x), cy: G.Y(x * S0), r: 20, fill: 'transparent' }, hg);
        el('circle', { cx: G.X(x), cy: G.Y(x * S0), r: 10, fill: C.plum, stroke: '#fff', 'stroke-width': 3 }, hg);
        txt(hg, G.X(x) - 14, G.Y(x * S0) - 14, k ? 'B' : 'A', { 'font-size': 17, 'font-weight': 700, fill: C.plum2, 'text-anchor': 'end' });
        hg.addEventListener('pointerdown', e => { e.preventDefault(); drag = k; });
      });
      const [x1, x2] = mk[0] <= mk[1] ? mk : [mk[1], mk[0]];
      const y1 = x1 * S0, y2 = x2 * S0;
      if (x2 - x1 < 1) { read.innerHTML = 'Move the markers apart to form a triangle.'; }
      else {
        const S = (y2 - y1) / (x2 - x1);
        read.innerHTML = `(x₁, y₁) = (${trim(x1, 1)} g, ${trim(y1, 2)} cm)<br>(x₂, y₂) = (${trim(x2, 1)} g, ${trim(y2, 2)} cm)<br>S = (y₂ − y₁) / (x₂ − x₁) = ${trim(y2 - y1, 2)} / ${trim(x2 - x1, 1)} = <b>${trim(S, 4)} cm/g</b><br>K = 980 × 1/${trim(S, 4)} = <b>${fmtK(980 / S)} dyne/cm</b>`;
      }
      if (lit >= 0) light(lit);
    }
    window.addEventListener('pointermove', e => {
      if (drag == null) return;
      const p = svgPoint(svg, e), [x] = G.inv(p.x, p.y);
      mk[drag] = Math.round(clamp(x, 0, 100) * 2) / 2; render();
    });
    window.addEventListener('pointerup', () => { drag = null; });
    render();
  })();

  /* =====================================================================
     10. MCQs — one list, numbered, choices shuffled
     ===================================================================== */
  const MCQ = [
    { q: 'Within the elastic limit, Hooke\'s law states that the extension of a spring is…', a: 'directly proportional to the stretching force', o: ['inversely proportional to the stretching force', 'proportional to the square of the force', 'independent of the force'],
      hint: 'Double the load and see what happens to ΔL.', ex: 'F = kΔL: doubling the force doubles the extension, as long as the elastic limit is not passed.' },
    { q: 'In F = kΔL, the constant k is called…', a: 'the spring constant', o: ['the elastic limit', 'the extension', 'the load'],
      hint: 'It is a property of the particular spring.', ex: 'k, the spring constant, is the force per unit extension: a measure of stiffness.' },
    { q: 'The extension ΔL of the spring is…', a: 'the reading with the load minus the reading with no load', o: ['the pointer reading with the load', 'the total length of the spring', 'the reading with no load'],
      hint: 'Extension is the increase in length.', ex: 'ΔL = reading − initial reading, measured from the zero-load position of the pointer.' },
    { q: 'The zero-load reading is 4.0 cm and with 60 g it is 8.2 cm. The extension is…', a: '4.2 cm', o: ['8.2 cm', '12.2 cm', '2.05 cm'],
      hint: 'Subtract the initial reading.', ex: '8.2 − 4.0 = 4.2 cm.' },
    { q: 'The SI unit of the spring constant is…', a: 'N/m', o: ['N·m', 'N', 'kg/m'],
      hint: 'k = F / ΔL.', ex: 'Force in newtons divided by extension in metres gives N/m.' },
    { q: 'In this practical the spring constant is given in…', a: 'dyne/cm', o: ['dyne·cm', 'g/cm', 'cm/g'],
      hint: 'CGS units: force in dynes, extension in cm.', ex: 'K = g · 1/S with g in cm/s² and S in cm/g gives dyne/cm.' },
    { q: 'One dyne is equal to…', a: '1 g·cm/s²', o: ['1 kg·m/s²', '1 g·m/s²', '1 g·cm'],
      hint: 'A dyne is the CGS unit of force: mass × acceleration.', ex: '1 dyne = 1 g × 1 cm/s². (1 N = 100 000 dynes.)' },
    { q: 'Which graph is plotted in this practical?', a: 'ΔL on the y-axis against the load m on the x-axis', o: ['m on the y-axis against the pointer reading', 'The pointer reading against ΔL', 'ΔL against m²'],
      hint: 'The slope is measured in cm/g.', ex: 'ΔL (cm) goes up the y-axis and m (g) along the x-axis, so the slope is in cm/g.' },
    { q: 'If Hooke\'s law is obeyed, the graph of ΔL against m is…', a: 'a straight line through the origin', o: ['a curve bending upwards', 'a horizontal line', 'a straight line cutting the y-axis well above zero'],
      hint: 'ΔL = (g/k) m has the form y = S x.', ex: 'Proportionality gives a straight line through the origin; that is what verifies the law.' },
    { q: 'The slope S of the ΔL (y) against m (x) graph equals…', a: 'g / k', o: ['k / g', 'k · g', '1 / (g k)'],
      hint: 'Compare ΔL = (g/k) · m with y = S · x.', ex: 'The coefficient of m is g/k, so S = g/k and k = g · 1/S.' },
    { q: 'The slope from two points (x₁, y₁) and (x₂, y₂) is…', a: '(y₂ − y₁) / (x₂ − x₁)', o: ['(x₂ − x₁) / (y₂ − y₁)', 'y₂ / x₁', '(y₂ + y₁) / (x₂ + x₁)'],
      hint: 'Rise over run: change in y divided by change in x.', ex: 'S = Δy / Δx = (y₂ − y₁) / (x₂ − x₁).' },
    { q: 'Two points on the line are (20 g, 1.4 cm) and (80 g, 5.6 cm). The slope is…', a: '0.07 cm/g', o: ['14.3 g/cm', '0.7 cm/g', '0.007 cm/g'],
      hint: '(5.6 − 1.4) / (80 − 20).', ex: '4.2 / 60 = 0.07 cm/g.' },
    { q: 'Before using K = g · 1/S with S in cm/g, g should be written as…', a: '980 cm/s²', o: ['9.8 cm/s²', '98 cm/s²', '9800 cm/s²'],
      hint: '1 m = 100 cm.', ex: '9.8 m/s² × 100 = 980 cm/s².' },
    { q: 'With S = 0.07 cm/g, the spring constant K is…', a: '14 000 dyne/cm', o: ['140 dyne/cm', '68.6 dyne/cm', '0.0000714 dyne/cm'],
      hint: 'K = 980 × 1/0.07.', ex: '980 / 0.07 = 14 000 dyne/cm (= 14 N/m).' },
    { q: 'If g = 9.8 is used instead of 980 in K = g · 1/S, the result is…', a: '100 times too small', o: ['100 times too large', '10 times too small', 'unchanged'],
      hint: 'Compare 9.8 with 980.', ex: '980 / 9.8 = 100, so K comes out 100 times too small.' },
    { q: 'The slope is taken upside down, as Δm / ΔL. The value of K calculated from it will be…', a: 'far too small', o: ['exactly right', '100 times too large', 'only slightly too large'],
      hint: 'With the example, Δm / ΔL = 60 / 4.2 = 14.3 instead of 0.07.', ex: '980 × 1/14.3 ≈ 68.6 instead of 14 000. The slope must be y over x: ΔL / Δm.' },
    { q: 'Why must the zero-load reading be taken first?', a: 'Every extension is measured from it: ΔL = reading − initial', o: ['It is needed to find the value of g', 'It removes the need for a graph', 'It sets the elastic limit of the spring'],
      hint: 'The pointer does not start at 0 on the ruler.', ex: 'Without the initial reading, the readings cannot be turned into extensions.' },
    { q: 'What happens when a spring is loaded beyond its elastic limit?', a: 'It is permanently stretched and does not return to its original length', o: ['It becomes stiffer and still obeys Hooke\'s law', 'Its extension drops to zero', 'Its spring constant doubles exactly'],
      hint: 'Elastic means it returns to its original shape.', ex: 'Past the elastic limit the deformation is permanent and ΔL is no longer proportional to the load.' },
    { q: 'Compared with a soft spring, a stiffer spring (larger k) under the same load gives…', a: 'a smaller extension', o: ['a larger extension', 'the same extension', 'no extension at all'],
      hint: 'ΔL = F / k.', ex: 'A larger k in the denominator gives a smaller ΔL.' },
    { q: 'Why wait for the pointer to stop moving before reading it?', a: 'A new load sets the spring oscillating; the reading is valid only at rest', o: ['The spring cools down while it waits', 'The value of g changes while it moves', 'The load becomes heavier after a few seconds'],
      hint: 'Think about what the spring does right after a mass is added.', ex: 'The spring bounces about its new equilibrium; only the settled position gives the true extension.' }
  ];
  (function mcq() {
    const list = $('mcq-list'), score = $('mcq-score');
    let solved = 0;
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function updScore() { score.textContent = `${solved} of ${MCQ.length} correct`; }
    function render() {
      solved = 0; list.innerHTML = '';
      MCQ.forEach((m, qi) => {
        const li = document.createElement('li'); li.className = 'mcq';
        const opts = shuffle([m.a].concat(m.o));
        li.innerHTML = `<p class="mcq-q"><span class="mcq-n">${qi + 1}.</span><span></span></p><div class="mcq-opts"></div><div class="mcq-fb" aria-live="polite"></div>`;
        li.querySelector('.mcq-q span:last-child').textContent = m.q;
        const box = li.querySelector('.mcq-opts'), fb = li.querySelector('.mcq-fb');
        opts.forEach(o => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.textContent = o;
          b.addEventListener('click', () => {
            if (li.classList.contains('solved')) return;
            if (o === m.a) {
              b.classList.remove('wrong'); b.classList.add('right'); li.classList.add('solved');
              box.querySelectorAll('.opt').forEach(x => { x.disabled = true; x.classList.remove('wrong'); });
              fb.className = 'mcq-fb show explain'; fb.textContent = m.ex;
              solved++; updScore();
            } else {
              b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
              fb.className = 'mcq-fb show hint'; fb.textContent = 'Not quite. ' + m.hint;
            }
          });
          box.appendChild(b);
        });
        list.appendChild(li);
      });
      updScore();
    }
    $('mcq-reset').addEventListener('click', render);
    render();
  })();

  /* =====================================================================
     11. PRACTICAL — front view: stand, spring, pointer, ruler, hanger, rack
     ===================================================================== */
  (function practical() {
    const K_P = 12600;          // dyne/cm, the simulated spring
    const ZERO_R = 5.0;         // cm, pointer reading with the empty hanger
    const SET_P = 1.2;          // cm, permanent stretch after the elastic limit is passed
    const HX = 246, RX = 282, RW = 40, Y0 = 124, SC = 20, STEM = 104, MW = 40, MH = 12, HANG_W = 50;
    const SPOTS = [382.5, 427.5, 472.5, 517.5];
    const SHELF = [560, 650];
    const spotPos = i => ({ x: SPOTS[i % 4], y: SHELF[Math.floor(i / 4)] - MH });

    const st = { load: 0, pos: ZERO_R, v: 0, deformed: false, settled: true, speed: 1, stack: [], drag: null };

    /* ---------- static scenery ---------- */
    const svg = $('rig'), id = 'rg'; rigDefs(svg, id);
    const scene = el('g', null, svg);
    el('rect', { x: 0, y: 704, width: 560, height: 36, fill: '#e7e3ec' }, scene);
    el('line', { x1: 0, y1: 704, x2: 560, y2: 704, stroke: '#cbc4d6', 'stroke-width': 1.5 }, scene);
    // ruler holder: a second boss on the rod, arm passing behind the spring
    el('rect', { x: 78, y: 104, width: RX - 78 + 6, height: 6, rx: 2.5, fill: `url(#${id}-rod)` }, scene);
    el('rect', { x: 68, y: 98, width: 20, height: 18, rx: 4, fill: '#2f2b3c' }, scene);
    const P = drawStand(scene, id, { rodX: 78, baseY: 704, armY: 58, hookX: HX, top: 30 });
    drawRuler(scene, id, RX, RW, Y0, SC, 26, { every: 1, fs: 11 });
    txt(scene, RX + RW / 2, 700, 'cm', { 'font-size': 11, fill: C.muted, 'text-anchor': 'middle', 'font-family': F_MONO });
    // the rack for the slotted masses
    const rack = el('g', null, scene);
    el('rect', { x: 346, y: 690, width: 208, height: 14, rx: 3, fill: `url(#${id}-wood)`, stroke: '#9c7f58' }, rack);
    el('rect', { x: 350, y: 520, width: 9, height: 172, rx: 2, fill: `url(#${id}-wood)`, stroke: '#9c7f58' }, rack);
    el('rect', { x: 541, y: 520, width: 9, height: 172, rx: 2, fill: `url(#${id}-wood)`, stroke: '#9c7f58' }, rack);
    SHELF.forEach(y => el('rect', { x: 350, y, width: 200, height: 15, rx: 2, fill: `url(#${id}-wood)`, stroke: '#9c7f58' }, rack));
    for (let i = 0; i < 8; i++) {
      const p = spotPos(i);
      el('rect', { x: p.x - MW / 2 - 1, y: p.y - 1, width: MW + 2, height: MH + 2, rx: 3, fill: 'rgba(255,255,255,.35)', stroke: '#b9a88e', 'stroke-dasharray': '3 3' }, rack);
      txt(rack, p.x, p.y + MH + 13, String(i + 1), { 'font-size': 11, 'font-weight': 600, fill: '#5d4a2f', 'text-anchor': 'middle', 'font-family': F_MONO });
    }
    txt(rack, 450, 512, '20 g slotted masses', { 'font-size': 17, fill: C.muted, 'text-anchor': 'middle', 'font-family': F_HAND });

    /* ---------- moving parts ---------- */
    const springA = makeSpring(svg, { w: 2.2 }), springB = makeSpring(svg, { w: 2.2 });
    const ptr = el('g', null, svg);
    el('line', { x1: HX, y1: 0, x2: RX + 1, y2: 0, stroke: C.coral2, 'stroke-width': 2.4 }, ptr);
    el('path', { d: `M${RX + 1} 0 l-8 -4 v8 z`, fill: C.coral2 }, ptr);
    el('circle', { cx: HX, cy: 0, r: 3.4, fill: '#35303f' }, ptr);
    const hang = el('g', null, svg);
    const BASE_OFF = hangerShape(hang, HX, 0, STEM, HANG_W) + 2;   // base top, relative to the pointer
    const massLayer = el('g', null, svg), dragLayer = el('g', null, svg);
    const masses = [];
    for (let i = 0; i < 8; i++) {
      const g = el('g', { class: 'mass-g', role: 'img', 'aria-label': `Slotted mass ${i + 1}, 20 g` }, massLayer);
      el('rect', { x: -MW / 2 - 6, y: -8, width: MW + 12, height: MH + 16, fill: 'transparent' }, g);
      massShape(g, id, 0, 0, MW, MH, '20 g');
      txt(g, -MW / 2 + 5, MH - 3.2, String(i + 1), { 'font-size': 7.5, fill: '#ffc2b3', 'font-family': F_MONO, 'font-weight': 600 });
      const M = { i, g, loc: 'rack', x: 0, y: 0 };
      masses.push(M);
      g.addEventListener('pointerdown', e => grabMass(M, e));
    }
    function place(M, x, y) { M.x = x; M.y = y; M.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); }
    const yPtr = () => Y0 + st.pos * SC;
    function stackPos(j) { return { x: HX, y: yPtr() + BASE_OFF - (j + 1) * MH }; }

    function drawRig() {
      const yP = yPtr();
      if (st.deformed) {
        const ySplit = P.y - 2 + (yP - P.y) * .62;
        springA.set(HX, P.y - 2, ySplit + 3, 12, 11); springB.set(HX, ySplit - 3, yP, 12, 3.2);
        springA.color('#8f3b2a', '#e2b1a5'); springB.color('#8f3b2a', '#e2b1a5');
        springB.g.style.display = '';
      } else {
        springA.set(HX, P.y - 2, yP, 12, 16); springA.color('#35303f', '#9d98ad');
        springB.g.style.display = 'none';
      }
      ptr.setAttribute('transform', `translate(0 ${yP})`);
      hang.setAttribute('transform', `translate(0 ${yP + 2})`);
      st.stack.forEach((M, j) => { const p = stackPos(j); place(M, p.x, p.y); });
      drawLoupe();
    }

    /* ---------- loupe: the ruler magnified at the pointer ---------- */
    const lp = $('loupe'), LSC = 60;
    const ldefs = el('defs', null, lp);
    const clip = el('clipPath', { id: 'lp-clip' }, ldefs);
    el('rect', { x: 0, y: 0, width: 220, height: 240, rx: 16 }, clip);
    const lin = el('g', { 'clip-path': 'url(#lp-clip)' }, lp);
    el('rect', { x: 0, y: 0, width: 220, height: 240, fill: '#f7f5ef' }, lin);
    const tape = el('g', null, lin);
    el('rect', { x: 80, y: -40, width: 120, height: 26 * LSC + 80, fill: '#fbfaf5', stroke: '#c8c1ad' }, tape);
    for (let mm = 0; mm <= 260; mm++) {
      const y = mm / 10 * LSC, len = mm % 10 === 0 ? 46 : mm % 5 === 0 ? 32 : 20;
      el('line', { x1: 80, y1: y, x2: 80 + len, y2: y, stroke: '#2c2838', 'stroke-width': mm % 10 ? 1 : 2 }, tape);
      if (mm % 10 === 0) txt(tape, 190, y + 9, String(mm / 10), { 'font-size': 26, 'font-weight': 600, fill: '#2c2838', 'text-anchor': 'end', 'font-family': F_MONO });
      else if (mm % 5 === 0) txt(tape, 188, y + 6, '·5', { 'font-size': 14, fill: '#8a8496', 'text-anchor': 'end', 'font-family': F_MONO });
    }
    el('line', { x1: 0, y1: 120, x2: 220, y2: 120, stroke: C.plum3, 'stroke-width': 1, 'stroke-dasharray': '3 4' }, lin);
    el('line', { x1: 8, y1: 120, x2: 82, y2: 120, stroke: C.coral2, 'stroke-width': 3.2 }, lin);
    el('path', { d: 'M84 120 l-12 -6 v12 z', fill: C.coral2 }, lin);
    el('circle', { cx: 8, cy: 120, r: 4.5, fill: '#35303f' }, lin);
    el('rect', { x: 1, y: 1, width: 218, height: 238, rx: 15, fill: 'none', stroke: 'rgba(0,0,0,.08)', 'stroke-width': 2 }, lp);
    function drawLoupe() { tape.setAttribute('transform', `translate(0 ${(120 - st.pos * LSC).toFixed(2)})`); }

    /* ---------- messages ---------- */
    const rigMsg = $('rig-msg'), readMsg = $('read-msg');
    function say(elm, base, cls, s) { elm.className = base + (cls ? ' ' + cls : ''); elm.textContent = s; }
    const riLoad = $('ri-load'), riState = $('ri-state'), riZero = $('ri-zero'), recM = $('rec-m');
    function showInfo() {
      riLoad.textContent = st.load + ' g'; recM.textContent = st.load;
      if (st.deformed) { riState.textContent = 'Overstretched'; riState.className = 'ri-v state bad'; }
      else if (st.settled) { riState.textContent = 'Settled'; riState.className = 'ri-v state'; }
      else { riState.textContent = 'Oscillating…'; riState.className = 'ri-v state moving'; }
      const z = zeroReading();
      riZero.textContent = isFinite(z) ? z.toFixed(1) + ' cm' : 'not yet recorded';
    }

    /* ---------- physics ---------- */
    const eqOf = () => ZERO_R + extOf(st.load, K_P) + (st.deformed ? SET_P : 0);
    function setLoad() {
      const before = st.load;
      st.load = st.stack.length * 20;
      st.settled = false;
      if (st.load > LIMIT && !st.deformed) {
        st.deformed = true;
        say(rigMsg, 'rig-msg', 'bad', `Elastic limit exceeded: with ${st.load} g the spring has been stretched beyond about ${LIMIT} g and deformed permanently. Its zero has shifted, so the readings no longer follow Hooke's law. Press Start over for a fresh spring.`);
      } else if (st.deformed) {
        say(rigMsg, 'rig-msg', 'bad', 'This spring is permanently deformed: even with the masses removed, the pointer does not return to its original zero. Press Start over for a fresh spring.');
      } else if (st.load >= 140) {
        say(rigMsg, 'rig-msg', 'warn', `${st.load} g on the hanger: close to the elastic limit (about ${LIMIT} g). Adding more would deform the spring permanently.`);
      } else if (st.load > before) {
        say(rigMsg, 'rig-msg', '', `${st.load} g on the hanger. The spring is oscillating; wait for the pointer to settle.`);
      } else {
        say(rigMsg, 'rig-msg', '', st.load ? `${st.load} g on the hanger. Wait for the pointer to settle.` : 'The hanger is empty. Wait for the pointer to settle.');
      }
      showInfo();
    }
    let raf = 0, last = 0, active = false;
    function loop(now) {
      const real = Math.min(.05, (now - last) / 1000); last = now;
      const dt = real * .55 * st.speed;
      const eq = eqOf(), mEff = 25 + st.load, w = Math.sqrt(K_P / mEff), z = .12;
      const n = Math.max(1, Math.ceil(dt / .002)), h = dt / n;
      for (let i = 0; i < n; i++) { const a = -w * w * (st.pos - eq) - 2 * z * w * st.v; st.v += a * h; st.pos += st.v * h; }
      const was = st.settled;
      st.settled = Math.abs(st.pos - eq) < .012 && Math.abs(st.v) < .08;
      if (st.settled && !was) {
        if (!st.deformed && rigMsg.className.indexOf('warn') < 0) {
          const z0 = zeroReading();
          say(rigMsg, 'rig-msg', 'ok', st.load === 0 ? (isFinite(z0) ? 'Settled with the hanger empty.' : 'Settled with the hanger empty. Record this zero-load reading first.') : `Settled with m = ${st.load} g. Read the pointer at eye level and record it.`);
        }
        showInfo();
      } else if (!st.settled && was) showInfo();
      drawRig();
      if (active) raf = requestAnimationFrame(loop);
    }
    onEnter.practical = () => { if (!active) { active = true; last = performance.now(); raf = requestAnimationFrame(loop); } requestAnimationFrame(renderGraph); };
    onLeave.practical = () => { active = false; cancelAnimationFrame(raf); if (tut.on) tut.cancel = true; };

    /* ---------- dragging the masses ---------- */
    function inHangerZone(x, y) { const yP = yPtr(); return Math.abs(x - HX) < 62 && y > yP - 30 && y < yP + BASE_OFF + 34; }
    function spotAt(x, y) { for (let i = 0; i < 8; i++) { const p = spotPos(i); if (Math.abs(x - p.x) < 24 && Math.abs(y - (p.y + MH / 2)) < 22) return i; } return -1; }
    function grabMass(M, e) {
      if (tut.on || st.drag) return;
      e.preventDefault();
      if (M.loc === 'hanger' && st.stack[st.stack.length - 1] !== M) {
        say(readMsg, 'read-msg', 'warn', `Mass ${M.i + 1} is under other masses. Lift off the top one first.`);
        return;
      }
      const p = svgPoint(svg, e);
      st.drag = { M, from: M.loc, dx: M.x - p.x, dy: M.y - p.y };
      if (M.loc === 'hanger') { st.stack.pop(); setLoad(); }
      M.loc = 'drag'; M.g.classList.add('dragging'); dragLayer.appendChild(M.g);
      try { M.g.setPointerCapture && M.g.setPointerCapture(e.pointerId); } catch (_) { /* not needed */ }
    }
    window.addEventListener('pointermove', e => {
      if (!st.drag) return;
      const p = svgPoint(svg, e);
      place(st.drag.M, clamp(p.x + st.drag.dx, 20, 540), clamp(p.y + st.drag.dy, 20, 700));
    });
    function toHanger(M) {
      M.loc = 'hanger'; massLayer.appendChild(M.g); st.stack.push(M); setLoad();
    }
    function toRack(M) {
      M.loc = 'rack'; massLayer.appendChild(M.g);
      const p = spotPos(M.i); tween(M, p.x, p.y, 180);
    }
    function tween(M, x, y, ms, done) {
      const x0 = M.x, y0 = M.y, t0 = performance.now();
      (function f(now) { const u = clamp((now - t0) / ms, 0, 1), s = u * u * (3 - 2 * u); place(M, x0 + (x - x0) * s, y0 + (y - y0) * s); if (u < 1) requestAnimationFrame(f); else if (done) done(); })(t0);
    }
    window.addEventListener('pointerup', () => {
      if (!st.drag) return;
      const { M, from } = st.drag; st.drag = null; M.g.classList.remove('dragging');
      const cx = M.x, cy = M.y + MH / 2;
      if (inHangerZone(cx, cy)) {
        toHanger(M);
        return;
      }
      const s = spotAt(cx, cy);
      if (s === M.i) { toRack(M); say(readMsg, 'read-msg', '', `Mass ${M.i + 1} is back on spot ${M.i + 1}.`); return; }
      if (s >= 0) say(readMsg, 'read-msg', 'warn', `That is spot ${s + 1}. Mass ${M.i + 1} goes back only to spot ${M.i + 1}.`);
      else say(readMsg, 'read-msg', '', from === 'hanger' ? `Drop mass ${M.i + 1} on the hanger, or on spot ${M.i + 1} of the rack.` : `Drop mass ${M.i + 1} on the hanger below the pointer.`);
      if (from === 'hanger') { const p = stackPos(st.stack.length); tween(M, p.x, p.y, 200, () => toHanger(M)); }
      else toRack(M);
    });

    /* ---------- observation table ---------- */
    const tbody = $('p-tbody'), tblMsg = $('tbl-msg');
    const fz = z => Math.abs(z * 10 - Math.round(z * 10)) < 1e-9 ? z.toFixed(1) : trim(z, 2);
    let rows = [];
    const FIELDS = ['m', 'r', 'e'];
    function num(r, f) { return parseNum(r[f]); }
    function zeroReading() { const z = rows.find(r => num(r, 'm') === 0 && isFinite(num(r, 'r'))); return z ? num(z, 'r') : NaN; }
    function renderTable(freshIdx) {
      tbody.innerHTML = '';
      if (!rows.length) { tbody.innerHTML = '<tr class="empty"><td colspan="4">No readings yet. Record the zero-load reading first, or add a row and type the readings.</td></tr>'; validate(); showInfo(); return; }
      rows.forEach((r, i) => {
        const tr = document.createElement('tr');
        if (i === freshIdx) tr.className = 'fresh';
        FIELDS.forEach(f => {
          const td = document.createElement('td'); const inp = document.createElement('input');
          inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off'; inp.value = r[f];
          inp.setAttribute('aria-label', { m: 'Load m in g', r: 'Pointer reading in cm', e: 'Extension in cm' }[f] + ', row ' + (i + 1));
          inp.dataset.f = f;
          inp.addEventListener('input', () => { r[f] = inp.value; validate(); showInfo(); scheduleGraph(); });
          td.appendChild(inp); tr.appendChild(td);
        });
        const td = document.createElement('td'); const x = document.createElement('button');
        x.type = 'button'; x.className = 'row-x'; x.textContent = '×'; x.setAttribute('aria-label', 'Remove row ' + (i + 1));
        x.addEventListener('click', () => { rows.splice(i, 1); fixSel(i); renderTable(); renderGraph(); });
        td.appendChild(x); tr.appendChild(td);
        tr.addEventListener('mouseenter', () => { if (ptIndexOfRow[i] != null) lightPt(i); });
        tr.addEventListener('mouseleave', () => lightPt(-1));
        tbody.appendChild(tr);
      });
      validate(); showInfo();
    }
    function fixSel(removed) { sel = sel.filter(k => k !== removed).map(k => k > removed ? k - 1 : k); }
    function rowIssue(r) {
      const z = zeroReading(), m = num(r, 'm'), rd = num(r, 'r'), e = num(r, 'e');
      if (!isFinite(m) || !isFinite(rd) || !isFinite(e) || !isFinite(z)) return null;
      if (m > 0 && z > .2 && Math.abs(e - rd) < .051) return 'zero';
      if (Math.abs(e - (rd - z)) > .06) return 'calc';
      return null;
    }
    let typingE = false;
    function validate() {
      if (typingE) return;
      const msgs = [], z = zeroReading();
      if (!isFinite(z) && rows.some(r => num(r, 'm') > 0)) msgs.push('The table has no zero-load row (m = 0). Every extension is measured from that reading.');
      Array.from(tbody.children).forEach((tr, i) => {
        const r = rows[i]; if (!r) return;
        const iss = rowIssue(r);
        tr.querySelectorAll('input').forEach(inp => inp.classList.toggle('flag', inp.dataset.f === 'e' && !!iss));
        if (iss === 'zero') msgs.push(`m = ${r.m} g: ΔL equals the pointer reading. Subtract the initial reading: ΔL = ${r.r} − ${fz(z)}.`);
        else if (iss === 'calc') msgs.push(`m = ${r.m} g: check ΔL = reading − initial = ${r.r} − ${fz(z)}.`);
      });
      tblMsg.textContent = msgs.slice(0, 3).join(' ') + (msgs.length > 3 ? ' …' : '');
    }
    $('t-add').addEventListener('click', () => { rows.push({ m: '', r: '', e: '' }); renderTable(); const ins = tbody.querySelectorAll('tr:last-child input'); if (ins[0]) ins[0].focus(); });
    $('t-fill').addEventListener('click', () => {
      const z = zeroReading();
      if (!isFinite(z)) { tblMsg.textContent = 'Enter the zero-load reading (m = 0) first.'; return; }
      rows.forEach(r => { const rd = num(r, 'r'); if (isFinite(rd)) r.e = (rd - z).toFixed(1); });
      renderTable(); renderGraph();
    });
    function sortRows() { rows.sort((a, b) => (isFinite(num(a, 'm')) ? num(a, 'm') : 1e9) - (isFinite(num(b, 'm')) ? num(b, 'm') : 1e9)); }
    function currentReading() { return Math.round(eqOf() * 10) / 10; }
    function record() {
      if (st.drag) return false;
      if (!st.settled) { say(readMsg, 'read-msg', 'warn', 'The pointer is still moving. Wait for it to settle, then read it.'); return false; }
      if (st.deformed) { say(readMsg, 'read-msg', 'bad', 'The spring is permanently deformed, so this reading would not follow Hooke\'s law. Press Start over for a fresh spring.'); return false; }
      const z = zeroReading(), rd = currentReading(), m = st.load;
      if (m > 0 && !isFinite(z)) { say(readMsg, 'read-msg', 'warn', 'Take the zero-load reading first: remove the masses from the hanger, wait for the pointer to settle, then record.'); return false; }
      let i = rows.findIndex(r => num(r, 'm') === m);
      if (i < 0) i = rows.findIndex(r => !String(r.m).trim() && !String(r.r).trim());
      if (i < 0) { rows.push({ m: '', r: '', e: '' }); i = rows.length - 1; }
      const row = rows[i];
      row.m = String(m); row.r = rd.toFixed(1);
      if (m === 0) {
        row.e = '0.0';
        rows.forEach(r => { const rr = num(r, 'r'); if (r !== row && isFinite(rr)) r.e = (rr - rd).toFixed(1); });
      } else row.e = (rd - z).toFixed(1);
      sortRows();
      const fi = rows.indexOf(row);
      sel = []; renderTable(fi); renderGraph();
      say(readMsg, 'read-msg', 'ok', m === 0 ? `Recorded the zero-load reading: ${rd.toFixed(1)} cm. Now add a 20 g mass.` : `Recorded: m = ${m} g, reading = ${rd.toFixed(1)} cm, ΔL = ${rd.toFixed(1)} − ${fz(z)} = ${row.e} cm.`);
      return true;
    }
    $('btn-record').addEventListener('click', record);

    /* ---------- graph ---------- */
    const gsvg = $('p-graph'), slopeOut = $('slope-out');
    let G = null, sel = [], sMode = 'pick', line = null, ptIndexOfRow = {}, ptEls = {}, litRow = -1, gDrag = null, reveal = null;
    const sModeSeg = radioGroup('s-mode', b => { sMode = b.dataset.mode; if (sMode === 'line' && !line) initLine(); renderGraph(); });
    function points() {
      const out = [];
      rows.forEach((r, i) => { const m = num(r, 'm'), y = num(r, 'e'); if (isFinite(m) && isFinite(y) && m >= 0 && y >= 0) out.push({ i, m, y }); });
      return reveal == null ? out : out.slice(0, reveal);
    }
    function scales(pts) {
      const maxM = Math.max(100, ...pts.map(p => p.m)), maxY = Math.max(0, ...pts.map(p => p.y));
      const xmax = Math.ceil(maxM / 20) * 20;
      let ymax = 8;
      if (maxY * 1.1 > 8) { const s = niceStep(maxY * 1.1, 8); ymax = Math.ceil(maxY * 1.1 / s) * s; }
      return { xmax, ymax };
    }
    function initLine() {
      const pts = points(), sc = scales(pts);
      const f = leastSq(pts.map(p => [p.m, p.y]));
      const xa = sc.xmax * .12, xb = sc.xmax * .85;
      if (f) line = [[xa, clamp(f.S * xa + f.c, 0, sc.ymax)], [xb, clamp(f.S * xb + f.c, 0, sc.ymax)]];
      else line = [[xa, sc.ymax * .15], [xb, sc.ymax * .75]];
    }
    function currentPair() {
      const pts = points();
      if (sMode === 'pick') {
        if (sel.length < 2) return null;
        const a = pts.find(p => p.i === sel[0]), b = pts.find(p => p.i === sel[1]);
        if (!a || !b || a.m === b.m) return null;
        return { p1: [a.m, a.y], p2: [b.m, b.y], how: `the points at ${trim(a.m, 1)} g and ${trim(b.m, 1)} g` };
      }
      if (!line || line[0][0] === line[1][0]) return null;
      return { p1: line[0], p2: line[1], how: 'two points on the line' };
    }
    function lightPt(i) {
      litRow = i;
      Array.from(tbody.children).forEach((tr, k) => tr.classList.toggle('lit', k === i));
      Object.keys(ptEls).forEach(k => ptEls[k].classList.toggle('lit', +k === i));
      if (!G) return;
      if (i < 0 || ptIndexOfRow[i] == null) G.layers.hover.innerHTML = '';
      else hoverMark(G, G.layers.hover, num(rows[i], 'm'), num(rows[i], 'e'));
    }
    function renderGraph() {
      const pts = points(), sc = scales(pts);
      G = graphBase(gsvg, sc);
      ptIndexOfRow = {}; ptEls = {};
      if (sMode === 'line' && line) line = line.map(([x, y]) => [clamp(x, 0, sc.xmax), clamp(y, 0, sc.ymax)]);
      const pair = currentPair();
      if (pair) {
        const S = (pair.p2[1] - pair.p1[1]) / (pair.p2[0] - pair.p1[0]), c = pair.p1[1] - S * pair.p1[0];
        lineSeg(G, G.layers.line, S, c, 0, sc.xmax, sMode === 'line' ? {} : { 'stroke-opacity': .85 });
        const d = slopeTri(G, G.layers.tri, pair.p1, pair.p2);
        slopeOut.innerHTML = `From ${pair.how}: Δy = y₂ − y₁ = <b>${trim(Math.abs(d.dY), 3)} cm</b>, Δx = x₂ − x₁ = <b>${trim(Math.abs(d.dX), 2)} g</b>. Next: S = Δy ÷ Δx.`;
      } else {
        slopeOut.textContent = pts.length < 2 ? 'Record or type at least two readings to plot the graph.' :
          sMode === 'pick' ? `Click two points on the graph to use for the slope${sel.length === 1 ? ' (one chosen)' : ''}.` : 'Drag the two round handles to lay the line along the points.';
      }
      pts.forEach(p => {
        const isSel = sMode === 'pick' && sel.includes(p.i);
        const g = ptMark(G, G.layers.pts, p.m, p.y, { class: 'ptg live' + (isSel ? ' sel' : '') });
        if (isSel) g.querySelector('.pt-dot').setAttribute('fill', C.coral3 || '#f1a896');
        ptIndexOfRow[p.i] = true; ptEls[p.i] = g;
        g.addEventListener('mouseenter', () => lightPt(p.i));
        g.addEventListener('mouseleave', () => lightPt(-1));
        if (sMode === 'pick') g.addEventListener('click', () => {
          if (sel.includes(p.i)) sel = sel.filter(k => k !== p.i);
          else { sel.push(p.i); if (sel.length > 2) sel.shift(); }
          renderGraph();
        });
      });
      if (sMode === 'line' && line) {
        line.forEach((h, k) => {
          const hg = el('g', { class: 'handle' }, G.layers.top);
          el('circle', { cx: G.X(h[0]), cy: G.Y(h[1]), r: 20, fill: 'transparent' }, hg);
          el('circle', { cx: G.X(h[0]), cy: G.Y(h[1]), r: 10, fill: C.plum, stroke: '#fff', 'stroke-width': 3 }, hg);
          hg.addEventListener('pointerdown', e => { e.preventDefault(); gDrag = k; });
        });
      }
      if (litRow >= 0) lightPt(litRow);
    }
    let gq = 0; function scheduleGraph() { if (gq) return; gq = requestAnimationFrame(() => { gq = 0; renderGraph(); }); }
    window.addEventListener('pointermove', e => {
      if (gDrag == null || !G) return;
      const p = svgPoint(gsvg, e), [x, y] = G.inv(p.x, p.y);
      line[gDrag] = [Math.round(clamp(x, 0, G.xmax) * 2) / 2, Math.round(clamp(y, 0, G.ymax) * 100) / 100];
      scheduleGraph();
    });
    window.addEventListener('pointerup', () => { gDrag = null; });

    /* ---------- calculation + check ---------- */
    const inS = $('in-s'), inG = $('in-g'), inK = $('in-k'), msg = $('check-msg'), sWork = $('s-work'), gWork = $('g-work'), kWork = $('k-work');
    function cmsg(cls, html) { msg.className = 'check-msg ' + cls; msg.innerHTML = html; }
    function refSlope() {
      const pair = currentPair();
      if (pair) return { S: (pair.p2[1] - pair.p1[1]) / (pair.p2[0] - pair.p1[0]), pair };
      const f = leastSq(points().map(p => [p.m, p.y]));
      return f ? { S: f.S, pair: null } : null;
    }
    function check() {
      const z = zeroReading();
      if (!isFinite(z) && rows.some(r => num(r, 'm') > 0)) { cmsg('nudge', 'The zero-load reading is missing. Record the pointer with the hanger empty first: every extension is reading − initial reading.'); return; }
      const slip = rows.find(r => rowIssue(r) === 'zero');
      if (slip) { cmsg('nudge', `Check the table first: at m = ${slip.m} g the extension equals the pointer reading. The zero reading has been left out: ΔL = ${slip.r} − ${fz(z)}.`); return; }
      const ref = refSlope();
      if (!ref) { cmsg('nudge', 'Plot at least two readings first.'); return; }
      const S = parseNum(inS.value), g = parseNum(inG.value), K = parseNum(inK.value), R = ref.S;
      if (!isFinite(S)) { cmsg('nudge', 'Start with step 1: the slope S = (y₂ − y₁) / (x₂ − x₁).'); return; }
      if (!near(S, R, .04)) {
        if (near(S, 1 / R, .06)) cmsg('nudge', 'The slope is upside down: that is Δm ÷ ΔL (x over y). ΔL is on the y-axis, so S = (y₂ − y₁) / (x₂ − x₁) = ΔL ÷ Δm, in cm/g.');
        else if (near(S, 100 * R, .06) || near(S, R / 100, .06)) cmsg('nudge', 'This slope is 100 times off. Keep ΔL in cm and m in g, so S comes out in cm/g.');
        else { const d = ref.pair ? `y₂ − y₁ = ${trim(Math.abs(ref.pair.p2[1] - ref.pair.p1[1]), 3)} cm and x₂ − x₁ = ${trim(Math.abs(ref.pair.p2[0] - ref.pair.p1[0]), 2)} g` : 'the rise and run of the line through the points'; cmsg('bad', `That slope does not match the graph. Use ${d}, then divide.`); }
        return;
      }
      if (!isFinite(g)) { cmsg('nudge', 'Slope ✓. Step 2: convert g to cm/s², since ΔL is in cm.'); return; }
      if (near(g, 9.8, .03)) { cmsg('nudge', '9.8 is g in m/s². With ΔL in cm and m in g, g must be in cm/s²: 9.8 × 100 = 980 cm/s².'); return; }
      if (!near(g, 980, .005)) { cmsg('bad', '1 m = 100 cm, so 9.8 m/s² = 9.8 × 100 cm/s².'); return; }
      if (!isFinite(K)) { cmsg('nudge', `Slope ✓, g ✓. Step 3: K = g · 1/S = 980 ÷ ${trim(S, 5)}.`); return; }
      const Kexp = 980 / S;
      if (near(K, Kexp, .02)) {
        const diff = (Kexp - K_P) / K_P * 100;
        cmsg('ok', `✓ Correct. Spring constant K = 980 × 1/${trim(S, 5)} ≈ <b>${fmtK(Kexp)} dyne/cm</b>. The points lie on a straight line through the origin, so Hooke's law is verified. ` +
          (Math.abs(diff) < 1 ? 'This matches the simulated spring (12 600 dyne/cm) to within 1%.' : `The simulated spring has K = 12 600 dyne/cm; this result is ${Math.abs(diff).toFixed(1)}% ${diff >= 0 ? 'above' : 'below'} it, as readings to the nearest millimetre allow.`));
        return;
      }
      if (near(K, 9.8 / S, .02)) { cmsg('nudge', 'This K is 100 times too small: g = 9.8 has been used. In this calculation g = 980 cm/s², so K = 980 ÷ S.'); return; }
      if (near(K, 980 * S, .03) || near(K, 9.8 * S, .03)) { cmsg('nudge', 'Multiply g by 1/S, which means dividing by S: K = 980 ÷ S, not 980 × S.'); return; }
      const noZero = rows.find(r => { const m = num(r, 'm'), rd = num(r, 'r'); return m > 0 && rd > 0 && near(K, 980 * m / rd, .02); });
      if (noZero) { cmsg('nudge', `This matches ${noZero.m} × 980 ÷ ${noZero.r}, which treats the pointer reading as the extension. The zero reading must be subtracted first, and K comes from the slope: K = 980 ÷ S.`); return; }
      cmsg('bad', `Not quite. Work out 980 ÷ ${trim(S, 5)}; the result is in dyne/cm.`);
    }
    $('btn-check').addEventListener('click', check);
    [inS, inG, inK].forEach(i => i.addEventListener('input', () => { if (!tut.on) { sWork.textContent = ''; gWork.textContent = ''; kWork.textContent = ''; } }));

    /* ---------- start over ---------- */
    function clearAll() {
      rows = []; sel = []; line = null; sMode = 'pick'; sModeSeg.set(sModeSeg.btns[0]); reveal = null;
      inS.value = ''; inG.value = ''; inK.value = ''; sWork.textContent = ''; gWork.textContent = ''; kWork.textContent = ''; cmsg('', '');
      if (st.drag) { st.drag.M.g.classList.remove('dragging'); st.drag = null; }
      st.stack = []; st.deformed = false; st.load = 0; st.pos = ZERO_R; st.v = 0; st.settled = true; st.speed = 1;
      masses.forEach(M => { M.loc = 'rack'; massLayer.appendChild(M.g); const p = spotPos(M.i); place(M, p.x, p.y); });
      renderTable(); renderGraph(); drawRig(); showInfo();
    }
    $('btn-reset').addEventListener('click', () => {
      clearAll();
      say(rigMsg, 'rig-msg', '', 'Fresh spring, empty hanger. Wait for the pointer to settle and record the zero-load reading first.');
      say(readMsg, 'read-msg', '', 'Masses: 8 × 20 g, numbered 1 to 8. Each one goes back only to its own numbered spot.');
    });

    /* =================================================================
       AUTOMATIC TUTORIAL — a paced demo driven by the simulation
       ================================================================= */
    const tut = { on: false, cancel: false, skip: false };
    const bar = $('tut-bar'), tTitle = $('tut-title'), tText = $('tut-text'), tF = $('tut-f'), tForm = $('tut-formula'), btnTut = $('tut-start');
    const STOP = new Error('tutorial-stop');
    function wait(ms) {
      return new Promise((res, rej) => {
        const t0 = performance.now();
        (function chk() { if (tut.cancel) return rej(STOP); if (tut.skip || performance.now() - t0 >= ms) return res(); setTimeout(chk, 25); })();
      });
    }
    async function until(cond) { while (!cond()) { if (tut.cancel) throw STOP; await new Promise(r => setTimeout(r, 40)); } }
    function step(title, text, f) { tut.skip = false; tTitle.textContent = title; tText.textContent = text; tF.innerHTML = f || ''; }
    let hiEls = [];
    function hi(...els) { hiEls.forEach(e => e.classList.remove('tut-hi')); hiEls = els.filter(Boolean); hiEls.forEach(e => e.classList.add('tut-hi')); }
    async function scrollToEl(elm) {
      const r = elm.getBoundingClientRect();
      const y = window.scrollY + r.top - Math.max(70, (window.innerHeight - Math.min(r.height, window.innerHeight - 200)) / 2 - 60);
      window.scrollTo({ top: Math.max(0, y), behavior: tut.skip ? 'auto' : 'smooth' });
      await wait(850);
    }
    async function typeInto(inp, value, perChar) {
      inp.focus({ preventScroll: true });
      inp.value = '';
      for (const ch of String(value)) { inp.value += ch; inp.dispatchEvent(new Event('input', { bubbles: true })); await wait(perChar || 110); }
      inp.blur();
    }
    function cell(rowIdx, f) { return tbody.querySelectorAll('tr')[rowIdx].querySelector(`input[data-f="${f}"]`); }
    async function moveMassToHanger(M) {
      const p = stackPos(st.stack.length);
      M.loc = 'drag'; dragLayer.appendChild(M.g);
      const lift = { x: M.x, y: M.y - 40 };
      await new Promise(res => tween(M, lift.x, lift.y, tut.skip ? 1 : 350, res));
      await new Promise(res => tween(M, p.x, p.y - 30, tut.skip ? 1 : 900, res));
      const q = stackPos(st.stack.length);
      await new Promise(res => tween(M, q.x, q.y, tut.skip ? 1 : 300, res));
      toHanger(M);
    }
    async function waitSettle() { await until(() => { st.speed = tut.skip ? 8 : 1; return st.settled; }); st.speed = 1; }
    async function fillRow(m, rd, ext, z) {
      await scrollToEl($('tbl-panel'));
      rows.push({ m: '', r: '', e: '' }); renderTable(rows.length - 1);
      const ri = rows.length - 1;
      tForm.hidden = false;
      step('Load', 'Write the load on the hanger.', `m = ${m} g`);
      tForm.innerHTML = `Load m = <b>${m} g</b>`; hi(cell(ri, 'm'));
      await typeInto(cell(ri, 'm'), String(m)); await wait(500);
      step('Pointer reading', 'Write the pointer reading, read at eye level.', `reading = ${rd} cm`);
      tForm.innerHTML = `Pointer reading = <b>${rd} cm</b>`; hi(cell(ri, 'r'));
      await typeInto(cell(ri, 'r'), rd); await wait(500);
      if (m === 0) {
        step('Extension', 'With no load there is no extension. This reading is the zero for all the others.', 'ΔL = 0.0 cm');
        tForm.innerHTML = `ΔL = <b>0.0 cm</b> (initial reading = ${rd} cm)`;
      } else {
        step('Extension', 'Subtract the initial reading from this reading.', `ΔL = ${rd} − ${z} = ${ext} cm`);
        tForm.innerHTML = `ΔL = reading − initial = ${rd} − ${z} = <b>${ext} cm</b>`;
      }
      hi(cell(ri, 'e'));
      typingE = true; try { await typeInto(cell(ri, 'e'), ext); } finally { typingE = false; validate(); } await wait(1000);
      hi(); tForm.hidden = true;
    }
    async function tutorial() {
      tut.on = true; tut.cancel = false; document.body.classList.add('tut-on'); bar.hidden = false; btnTut.disabled = true;
      try {
        clearAll(); reveal = 0; renderGraph();
        const rigCol = document.querySelector('.rig-col'), readPanel = $('read-panel'), gPanel = $('graph-panel'), cPanel = $('calc-panel');
        await scrollToEl(document.querySelector('.prac'));
        step('Zero-load reading', 'Only the hanger is on the spring. Wait for the pointer to settle, then read it at eye level.', '');
        hi(rigCol); await waitSettle(); await wait(1200);
        const z = currentReading().toFixed(1);
        step('Read the pointer', 'The magnified ruler shows the pointer against the millimetre marks.', `initial reading = ${z} cm`);
        hi(readPanel); await wait(2000);
        await fillRow(0, z, '0.0', z);
        const results = [{ m: 0, e: 0 }];
        for (let j = 0; j < 4; j++) {
          const m = (j + 1) * 20;
          await scrollToEl(document.querySelector('.prac'));
          step(`Add mass ${j + 1}`, `Lower slotted mass ${j + 1} from the rack onto the hanger.`, `m = ${m} g`);
          hi(rigCol); await wait(600);
          await moveMassToHanger(masses[j]);
          step('Wait for it to settle', 'The new load sets the spring oscillating. Read only when the pointer is still.', '');
          await waitSettle(); await wait(700);
          const rd = currentReading().toFixed(1), ext = (+rd - +z).toFixed(1);
          step('Read the pointer', `With ${m} g on the hanger the pointer reads ${rd} cm.`, `reading = ${rd} cm`);
          hi(readPanel); await wait(1600);
          await fillRow(m, rd, ext, z);
          results.push({ m, e: +ext });
        }
        // graph
        hi();
        await scrollToEl(gPanel);
        step('Plot ΔL against m', 'Each row of the table becomes one point: the load across, the extension up.', '');
        hi(gPanel);
        for (let n = 1; n <= results.length; n++) {
          reveal = n; renderGraph(); const r = results[n - 1];
          tF.textContent = `(${r.m} g, ${r.e.toFixed(1)} cm)`;
          await wait(900);
        }
        reveal = null;
        const f = leastSq(results.map(r => [r.m, r.e]));
        const X1 = 20, X2 = 80, Y1 = +(f.S * X1 + f.c).toFixed(2), Y2 = +(f.S * X2 + f.c).toFixed(2);
        step('Draw the best straight line', 'One straight line through the points, passing close to the origin: Hooke\'s law is verified.', '');
        line = [[X1, Y1], [X2, Y2]]; sMode = 'line'; sModeSeg.set(sModeSeg.btns[1]); renderGraph();
        const ln = G.layers.line.querySelector('line');
        if (ln && ln.animate) { const len = Math.hypot(ln.x2.baseVal.value - ln.x1.baseVal.value, ln.y2.baseVal.value - ln.y1.baseVal.value); ln.style.strokeDasharray = len; ln.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1400, easing: 'ease-in-out' }); }
        if (G.layers.tri.animate) G.layers.tri.animate([{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], { duration: 2200 });
        await wait(2400);
        step('Two points on the line', 'Read two points far apart on the line itself.', `(x₁, y₁) = (${X1} g, ${Y1} cm) · (x₂, y₂) = (${X2} g, ${Y2} cm)`);
        await wait(2800);
        // calculation
        await scrollToEl(cPanel);
        const dY = +(Y2 - Y1).toFixed(2), S = +(dY / (X2 - X1)).toPrecision(4), K = Math.round(980 / S);
        step('1. Slope', 'S = (y₂ − y₁) / (x₂ − x₁), with y = ΔL and x = m.', `S = (${Y2} − ${Y1}) / (${X2} − ${X1}) = ${dY} / ${X2 - X1} = ${S} cm/g`);
        hi($('cr-s'));
        sWork.textContent = `= (${Y2} − ${Y1}) / (${X2} − ${X1}) = ${dY} / ${X2 - X1} = ${S}`;
        await wait(1200); await typeInto(inS, String(S)); await wait(1200);
        step('2. Convert g', 'ΔL is in cm, so g must be in cm/s²: 1 m = 100 cm.', 'g = 9.8 m/s² × 100 = 980 cm/s²');
        hi($('cr-g'));
        gWork.textContent = '= 9.8 × 100 = 980';
        await wait(1200); await typeInto(inG, '980'); await wait(1200);
        step('3. Spring constant', 'Multiply g by 1/S, which is the same as dividing g by S.', `K = g · 1/S = 980 × 1/${S} = ${fmtK(K)} dyne/cm`);
        hi($('cr-k'));
        kWork.textContent = `= 980 × 1/${S} = 980 / ${S} = ${K}`;
        await wait(1200); await typeInto(inK, String(K)); await wait(1000);
        hi($('btn-check')); await wait(700); check(); hi();
        step('Done', `K ≈ ${fmtK(K)} dyne/cm from the simulated readings. Start over to take the readings by hand.`, '');
        await wait(4500);
      } catch (e) {
        if (e !== STOP) throw e;
      } finally {
        tut.on = false; tut.skip = false; st.speed = 1; reveal = null; hi(); tForm.hidden = true;
        masses.forEach(M => { if (M.loc === 'drag') toRack(M); });
        document.body.classList.remove('tut-on'); bar.hidden = true; btnTut.disabled = false;
        renderGraph();
      }
    }
    btnTut.addEventListener('click', () => { if (!tut.on) tutorial(); });
    $('tut-stop').addEventListener('click', () => { tut.cancel = true; });
    $('tut-skip').addEventListener('click', () => { tut.skip = true; });

    masses.forEach(M => { const p = spotPos(M.i); place(M, p.x, p.y); });
    renderTable(); drawRig(); showInfo();
  })();

  /* =====================================================================
     12. OPTIONAL EXTRAS — opens upward, closes ~500 ms after the pointer leaves
     ===================================================================== */
  (function extras() {
    const box = $('extras'), btn = $('extras-toggle');
    let t = null, openedAt = 0;
    const open = () => { clearTimeout(t); if (!box.classList.contains('open')) openedAt = Date.now(); box.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); };
    const close = () => { clearTimeout(t); box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
    const later = () => { clearTimeout(t); t = setTimeout(close, 500); };
    box.addEventListener('mouseenter', open);
    box.addEventListener('mouseleave', later);
    btn.addEventListener('click', () => {
      if (!box.classList.contains('open')) open();
      else if (Date.now() - openedAt > 350) close();
    });
    box.addEventListener('focusin', open);
    box.addEventListener('focusout', e => { if (!box.contains(e.relatedTarget)) later(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  })();

  goTo(fromHash(), false);
})();
