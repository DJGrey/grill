// Synthwave. A neon grid scrolls towards a striped sun setting behind the card, palms sway, and an
// 80s sports car drives into it. Every question is a sequel ("GRILL III: The Reckoning"), the VHS
// counter runs on your time on the card, and answering floors it into the sunset.

const SUBTITLES = ['The Reckoning', 'Electric Boogaloo', 'Judgment Day', 'Turbo Edition', "Director's Cut", 'Revenge of the Backlog',
  'Scope Creep', 'Midnight Deploy', 'The Refactoring', 'Hot Pursuit', 'No Going Back', 'Requirements Strike Back', 'Final Answer', 'Neon Tradeoffs'];
const ROMAN = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const roman = (n) => { let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s || 'I'; };
const PINK = '#ff2bd6', CYAN = '#2de2ff';
const SCRIPT = '"Brush Script MT", "Snell Roundhand", "Segoe Script", "Bradley Hand", cursive';

export default function synthwave(k, ctx) {
  const cv = k.canvas();
  const c = cv.ctx;
  k.el('div', { style: 'position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 1px, transparent 1px 3px),radial-gradient(ellipse 85% 75% at 50% 50%, transparent 55%, rgba(10,0,25,.55))' });

  let L = {}; // layout: cx, hy (horizon), sunR, title, osd, car…
  let laidOut = ''; // what L was built from, so a layout() that moved nothing rebuilds nothing
  let back = null, front = null; // cached sky and mountains/floor
  let fade = null, win = null; // the grid's and the car window's gradients
  let stars = [];
  let scroll = 0, speed = 1.4, boost = 0, away = 0, arrive = 0, sway = 0;
  const puffs = []; // exhaust: { x, y, r, age, life }

  const mk = (w, h) => {
    const e = document.createElement('canvas');
    e.width = Math.max(1, Math.round(w * cv.dpr));
    e.height = Math.max(1, Math.round(h * cv.dpr));
    const g = e.getContext('2d');
    g.scale(cv.dpr, cv.dpr);
    return [e, g];
  };

  function layout(force) {
    const sp = k.space();
    const st = sp.stage, card = sp.card;
    const cx = card ? card.left + card.width / 2 : st.left + st.width / 2;
    const below = card ? cv.h - card.bottom : cv.h * 0.4;
    const hy = card && below > 150 ? card.bottom + Math.min(125, below * 0.42) : cv.h * 0.66;
    const sunR = k.clamp(card ? card.width * 0.56 : st.width * 0.26, 120, 420);
    const bottom = sp.gaps.find((g) => g.where === 'bottom');
    const top = sp.gaps.find((g) => g.where === 'top' && g.h >= 30);
    const tog = k.rect(document.querySelector('#notes-toggle'));
    const right = Math.min((tog && tog.top < 60 ? tog.left - 8 : st.right) - 20, sp.hud ? sp.hud.left - 14 : Infinity);
    const key = JSON.stringify([cv.w, cv.h, cx, hy, sunR, st, bottom, top, right, ctx.question?.id || ctx.front]);
    if (!force && key === laidOut) return;
    laidOut = key;
    L = { cx, hy, sunR, st, card, bottom, top, below, right };
    const r = k.rng(`${ctx.question?.id || ctx.front}synth`);
    stars = Array.from({ length: 140 }, () => ({ x: r.rand(cv.w), y: r.rand(hy * 0.95), s: r.rand(0.4, 1.6), p: r.rand(6.28), f: r.rand(0.6, 2.4) }));
    build();
  }

  // the cached layers, at the current DPR (the ridges are seeded, so a rebuild looks the same)
  function build() {
    buildBack();
    buildFront(k.rng(`${ctx.question?.id || ctx.front}synthridge`));
    buildTitle();
    sunCv = null;
    fade = c.createLinearGradient(0, L.hy, 0, cv.h);
    fade.addColorStop(0, 'rgba(255,43,214,0)');
    fade.addColorStop(0.12, 'rgba(255,43,214,.55)');
    fade.addColorStop(1, 'rgba(255,90,230,1)');
  }

  function buildBack() {
    const [e, g] = mk(cv.w, cv.h);
    const sky = g.createLinearGradient(0, 0, 0, L.hy);
    sky.addColorStop(0, '#0b0221');
    sky.addColorStop(0.45, '#2a0845');
    sky.addColorStop(0.78, '#7a1361');
    sky.addColorStop(1, '#ff4f7b');
    g.fillStyle = sky;
    g.fillRect(0, 0, cv.w, L.hy);
    const glow = g.createRadialGradient(L.cx, L.hy - L.sunR * 0.4, L.sunR * 0.5, L.cx, L.hy - L.sunR * 0.4, L.sunR * 2.6);
    glow.addColorStop(0, 'rgba(255,120,90,.55)');
    glow.addColorStop(0.4, 'rgba(255,60,140,.18)');
    glow.addColorStop(1, 'rgba(255,60,140,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, cv.w, L.hy);
    back = e;
  }

  // mountains, the floor and the horizon glow: everything in front of the sun that doesn't move
  function buildFront(r) {
    const [e, g] = mk(cv.w, cv.h);
    const ridge = (x0, x1, peak, n, fill, edge) => {
      const pts = [[x0, L.hy]];
      for (let i = 1; i < n; i++) {
        const x = k.lerp(x0, x1, i / n);
        const m = Math.sin((i / n) * Math.PI);
        pts.push([x + r.rand(-12, 12), L.hy - peak * m * r.rand(0.45, 1)]);
      }
      pts.push([x1, L.hy]);
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.fillStyle = fill;
      g.fill();
      g.lineJoin = 'round';
      Object.assign(g, { strokeStyle: edge, lineWidth: 1.5, shadowColor: edge, shadowBlur: 8 });
      g.stroke();
      g.shadowBlur = 0;
      g.globalAlpha = 0.25; // wireframe struts down from each peak
      for (let i = 1; i < pts.length - 1; i++) { g.beginPath(); g.moveTo(...pts[i]); g.lineTo(k.lerp(pts[i][0], L.cx, 0.08), L.hy); g.stroke(); }
      g.globalAlpha = 1;
    };
    const w = Math.max(cv.w * 0.5, L.sunR * 3);
    const mh = Math.min(L.sunR * 0.5, 110);
    ridge(L.cx - L.sunR * 0.55 - w, L.cx - L.sunR * 0.55, mh * 1.4, 9, '#1a0533', 'rgba(45,226,255,.75)');
    ridge(L.cx + L.sunR * 0.6, L.cx + L.sunR * 0.6 + w, mh * 1.2, 8, '#1a0533', 'rgba(45,226,255,.75)');
    ridge(L.cx - L.sunR * 1.25, L.cx - L.sunR * 0.1, mh * 0.7, 6, '#26073f', 'rgba(255,43,214,.7)');
    const floor = g.createLinearGradient(0, L.hy, 0, cv.h);
    floor.addColorStop(0, '#2b0638');
    floor.addColorStop(0.25, '#13021f');
    floor.addColorStop(1, '#05000b');
    g.fillStyle = floor;
    g.fillRect(0, L.hy, cv.w, cv.h - L.hy);
    const haze = g.createLinearGradient(0, L.hy - 30, 0, L.hy + 50);
    haze.addColorStop(0, 'rgba(255,90,170,0)');
    haze.addColorStop(0.4, 'rgba(255,90,170,.55)');
    haze.addColorStop(1, 'rgba(255,90,170,0)');
    g.fillStyle = haze;
    g.fillRect(0, L.hy - 30, cv.w, 80);
    front = e;
  }

  // The sun is drawn once; the stripes are cut out of it each frame with an even-odd clip.
  let sunCv = null;
  function sun(t) {
    const R = L.sunR;
    const sink = Math.min(1, ctx.cardTime / 360) * R * 0.55 + (k.reduced ? 0 : Math.sin(t * 0.4) * 2);
    const cy = L.hy - R * 0.45 + sink;
    if (sunCv?.R !== R) {
      const [e, g] = mk(R * 2, R * 2);
      const grad = g.createLinearGradient(0, 0, 0, R * 2);
      grad.addColorStop(0, '#fff36b');
      grad.addColorStop(0.45, '#ff9a3d');
      grad.addColorStop(0.75, '#ff3d7f');
      grad.addColorStop(1, '#c2179b');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(R, R, R, 0, Math.PI * 2);
      g.fill();
      sunCv = { e, R };
    }
    const x = L.cx - R, y = cy - R;
    c.save();
    c.beginPath();
    c.rect(0, 0, cv.w, L.hy);
    c.clip();
    // the stripes: see-through gaps that thicken towards the bottom and slide down
    c.beginPath();
    c.rect(x, y, R * 2, R * 2);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const f = (i + ((t * 0.35) % 1)) / n;
      c.rect(x, y + R * 0.95 + f * R * 1.05, R * 2, 1 + f * f * R * 0.11);
    }
    c.clip('evenodd');
    c.drawImage(sunCv.e, x, y, R * 2, R * 2);
    c.restore();
  }

  function grid(dt) {
    const { cx, hy } = L;
    const H = cv.h - hy;
    if (H < 10) return;
    c.save();
    c.beginPath();
    c.rect(0, hy, cv.w, H);
    c.clip();
    c.lineCap = 'round';
    const pass = (w, a) => {
      c.strokeStyle = fade;
      c.lineWidth = w;
      c.globalAlpha = a;
      c.beginPath();
      const spread = cv.w * 0.11;
      for (let j = -24; j <= 24; j++) { c.moveTo(cx + j * 2, hy); c.lineTo(cx + j * spread * 2.6, cv.h + H * 0.2); }
      const D = H * 0.9;
      for (let i = 0; i < 26; i++) {
        const z = i + 1 - (scroll % 1);
        if (z <= 0.6) continue;
        const y = hy + D / z;
        if (y > cv.h + 4) continue;
        c.moveTo(0, y);
        c.lineTo(cv.w, y);
      }
      c.stroke();
    };
    pass(9, 0.12); // a cheap glow: wide and faint under thin and bright
    pass(4, 0.3);
    pass(1.4, 1);
    c.restore();
  }

  const fronds = new Map(); // per palm, its fronds' fixed randomness: [angle jitter, length, droop]
  const frondsOf = (seed) => {
    if (!fronds.has(seed)) {
      const r = k.rng(seed);
      fronds.set(seed, Array.from({ length: 8 }, () => [r.rand(-0.15, 0.15), r.rand(0.38, 0.55), r.rand(0.18, 0.3)]));
    }
    return fronds.get(seed);
  };

  function palm(x, base, h, lean, t, seed) {
    const fr = frondsOf(seed);
    const s = Math.sin(t * 0.9 + seed) * 0.05 + sway * 0.15;
    const tx = x + lean * h + s * h * 0.3, ty = base - h;
    c.save();
    c.fillStyle = '#0d0016';
    c.strokeStyle = 'rgba(255,43,214,.55)';
    c.lineWidth = 1.2;
    c.beginPath(); // trunk, tapered
    const w0 = h * 0.045, w1 = h * 0.022;
    c.moveTo(x - w0, base);
    c.quadraticCurveTo(x + lean * h * 0.2 - w0, base - h * 0.55, tx - w1, ty);
    c.lineTo(tx + w1, ty);
    c.quadraticCurveTo(x + lean * h * 0.2 + w0, base - h * 0.55, x + w0, base);
    c.closePath();
    c.fill();
    c.stroke();
    c.globalAlpha = 0.35; // trunk rings
    for (let i = 1; i < 12; i++) {
      const f = i / 12;
      const px = k.lerp(x, tx, f) + lean * h * 0.2 * Math.sin(f * Math.PI) * 0.5;
      const py = k.lerp(base, ty, f);
      c.beginPath(); c.moveTo(px - w0 * (1 - f * 0.5), py); c.lineTo(px + w0 * (1 - f * 0.5), py + 2); c.stroke();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 8; i++) { // fronds
      const [ja, jl, jd] = fr[i];
      const a = -Math.PI / 2 + (i / 7 - 0.5) * Math.PI * 1.9 + ja + s * 2;
      const len = h * jl;
      const droop = h * jd;
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.6 + droop;
      const mx = tx + Math.cos(a) * len * 0.55, my = ty + Math.sin(a) * len * 0.6 - h * 0.08;
      const nx = -Math.sin(a), ny = Math.cos(a);
      const wd = h * 0.05;
      c.beginPath();
      c.moveTo(tx, ty);
      c.quadraticCurveTo(mx + nx * wd, my + ny * wd, ex, ey);
      c.quadraticCurveTo(mx - nx * wd * 0.4, my - ny * wd * 0.4 + wd, tx, ty);
      c.fill();
      c.stroke();
    }
    c.restore();
  }

  function car(t) {
    const b = L.bottom;
    if (!b || b.h < 70) return null;
    const groundY = cv.h - Math.min(40, b.h * 0.14);
    const p = 1 - away; // shrinks into the sunset after an answer
    const enter = 1 - k.ease.outCubic(arrive);
    const scale = k.clamp(b.h / 260, 0.6, 1.15) * k.lerp(0.06, 1, k.ease.inQuad(p));
    const x = L.cx + Math.sin(t * 0.5) * 30 * p;
    const y = k.lerp(L.hy + 6, groundY, k.ease.inQuad(p)) + enter * 200 + (k.reduced ? 0 : Math.sin(t * 13) * 0.6);
    const W = 150 * scale, Hh = 46 * scale;
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    c.fillStyle = 'rgba(0,0,0,.55)'; // shadow
    c.beginPath(); c.ellipse(0, 2, 84, 9, 0, 0, Math.PI * 2); c.fill();
    for (const s of [-1, 1]) { c.fillStyle = '#07000c'; c.fillRect(s * 62 - 13, -16, 26, 18); } // tyres
    // body
    c.fillStyle = '#16051f';
    c.beginPath();
    c.moveTo(-76, -10); c.lineTo(-78, -34); c.lineTo(-62, -44); c.lineTo(62, -44); c.lineTo(78, -34); c.lineTo(76, -10);
    c.quadraticCurveTo(0, -4, -76, -10);
    c.fill();
    c.strokeStyle = CYAN; c.lineWidth = 1.5; c.shadowColor = CYAN; c.shadowBlur = 8;
    c.beginPath(); c.moveTo(-62, -44); c.lineTo(62, -44); c.stroke();
    c.shadowBlur = 0;
    // cabin and rear window
    c.fillStyle = '#1d0829';
    c.beginPath(); c.moveTo(-50, -44); c.lineTo(-36, -70); c.lineTo(36, -70); c.lineTo(50, -44); c.closePath(); c.fill();
    if (!win) { // in the car's own coordinates, so one does for every frame
      win = c.createLinearGradient(0, -68, 0, -46);
      win.addColorStop(0, '#3b1a6b'); win.addColorStop(1, '#ff4f9a');
    }
    c.fillStyle = win;
    c.beginPath(); c.moveTo(-42, -46); c.lineTo(-32, -66); c.lineTo(32, -66); c.lineTo(42, -46); c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.55)'; // two heads, one nodding to the music
    c.beginPath(); c.arc(-14, -52 + Math.sin(t * 8) * 1.2, 7, 0, Math.PI * 2); c.arc(15, -53, 7.5, 0, Math.PI * 2); c.fill();
    // spoiler
    c.fillStyle = '#0d0014';
    c.fillRect(-80, -50, 160, 5);
    c.fillRect(-60, -46, 4, 6); c.fillRect(56, -46, 4, 6);
    // the taillight strip
    const glow = 0.75 + Math.sin(t * 2) * 0.1 + boost * 0.4;
    c.shadowColor = '#ff2040'; c.shadowBlur = 16 * glow;
    c.fillStyle = `rgba(255,${40 + boost * 80},${70 + boost * 30},${glow})`;
    c.fillRect(-72, -33, 144, 7);
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(0,0,0,.6)';
    for (let i = -66; i < 70; i += 12) c.fillRect(i, -33, 1.5, 7);
    // plate
    c.fillStyle = '#f2ecd8'; c.fillRect(-18, -24, 36, 11);
    c.fillStyle = '#2a0a4a'; c.font = k.font(8, 800, 'mono'); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(ctx.question ? `Q${ctx.question.n}OF${ctx.question.total}` : 'GR1LL', 0, -18.3);
    // exhausts, with flames on boost
    for (const s of [-1, 1]) {
      c.fillStyle = '#3a2a44'; c.beginPath(); c.ellipse(s * 46, -10, 5, 3.5, 0, 0, Math.PI * 2); c.fill();
      if (boost > 0.05) {
        const fl = 14 + boost * 30 + Math.random() * 10;
        const fg = c.createRadialGradient(s * 46, -10, 1, s * 46, -10 + fl * 0.3, fl);
        fg.addColorStop(0, 'rgba(255,255,220,.95)'); fg.addColorStop(0.35, 'rgba(80,200,255,.8)'); fg.addColorStop(1, 'rgba(255,40,200,0)');
        c.fillStyle = fg;
        c.beginPath(); c.ellipse(s * 46, -10 + fl * 0.35, 6 + boost * 4, fl * 0.5, 0, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
    return { x, y, W, Hh, scale };
  }

  // The title is drawn once per card into a strip and blitted, since its glow is costly.
  let strip = null;
  function buildTitle() {
    strip = null;
    const size = k.clamp((L.bottom?.h || 0) * 0.2, 30, 58);
    const top = L.hy - 6 - size * 1.5, h = size * 2.6;
    const [e, g] = mk(cv.w, h);
    g.translate(0, -top);
    if (title(g)) strip = { e, top, h };
  }

  function title(c) {
    const q = ctx.question;
    const [big, script] = ctx.front === 'done' ? ['THE END', '…or is it?']
      : !q ? ['GRILL', 'Coming soon to a terminal near you']
      : [`GRILL ${roman(q.n)}`, (q.tag && k.hash(q.id) % 3 === 0) ? `${q.tag} Nights` : k.rng(q.id).pick(SUBTITLES)];
    const b = L.bottom;
    const room = b ? b.h : 0;
    const y = L.hy - 6;
    if (room < 120 || L.hy > cv.h - 60) return false;
    const maxW = Math.min((b?.w || cv.w) - 40, 560);
    const size = k.clamp(room * 0.2, 30, 58);
    const f = k.fit(c, big, maxW, { size, min: 22, weight: 900, family: 'display' });
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.translate(L.cx, y);
    c.transform(1, 0, -0.12, 1, 0, 0);
    const chrome = c.createLinearGradient(0, -f.size, 0, 0);
    chrome.addColorStop(0, '#e9f7ff'); chrome.addColorStop(0.48, '#7bc6ff'); chrome.addColorStop(0.5, '#2a1660'); chrome.addColorStop(0.62, '#ff7ad9'); chrome.addColorStop(1, '#fff1fb');
    c.lineJoin = 'round';
    c.lineWidth = 6; c.strokeStyle = '#1a0533'; c.strokeText(f.text, 0, 0);
    c.shadowColor = 'rgba(45,226,255,.8)'; c.shadowBlur = 14;
    c.fillStyle = chrome; c.fillText(f.text, 0, 0);
    c.shadowBlur = 0;
    c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.7)'; c.strokeText(f.text, 0, 0);
    // the script subtitle, slapped on at an angle in neon
    const s = k.fit(c, script, maxW * 0.8, { size: f.size * 0.62, min: 14, weight: 'italic 700', family: SCRIPT });
    c.rotate(-0.06);
    c.shadowColor = PINK; c.shadowBlur = 12;
    c.fillStyle = '#ffd1f4';
    c.fillText(s.text, f.size * 0.4, f.size * 0.5);
    c.restore();
    return true;
  }

  function osd(t) {
    const x = L.st.left + 20;
    const y = L.top ? L.top.y + Math.min(L.top.h / 2, 28) : L.st.top + 22;
    const right = L.right;
    const q = ctx.question;
    const secs = Math.floor(ctx.cardTime);
    const clock = `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    const [mode, note] = ctx.front === 'done' ? ['■ STOP', 'BE KIND, REWIND'] : !q ? ['❚❚ PAUSE', ctx.agent === 'listening' ? 'AGENT IS LISTENING' : 'AGENT IS THINKING'] : ['▶ PLAY', `SP  ${clock}`];
    c.save();
    c.font = k.font(15, 700, 'mono');
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,.8)';
    c.shadowBlur = 4;
    c.fillStyle = '#f4f4ff';
    if (mode[0] !== '❚' || k.reduced || Math.floor(t * 1.5) % 2 === 0) c.fillText(mode, x, y);
    c.textAlign = 'right';
    c.fillText(note, right, y);
    c.restore();
  }

  cv.resized = (w, h, { dprOnly } = {}) => (dprOnly ? build() : layout(true));
  layout();
  arrive = k.reduced ? 1 : 0;

  k.loop((dt, t) => {
    boost = Math.max(0, boost - dt * 0.6);
    if (away > 0) away += dt * 0.9;
    if (away >= 1) { away = 0; arrive = 0; } // only seen in forced tests: the car comes back for the next card
    arrive = Math.min(1, arrive + dt * 0.8);
    sway = k.lerp(sway, ctx.typing ? 1 : 0, dt * 2);
    scroll += dt * speed * (1 + boost * 5 + (ctx.typing ? 0.5 : 0));
    c.drawImage(back, 0, 0, cv.w, cv.h);
    for (const s of stars) {
      c.globalAlpha = (0.4 + 0.6 * Math.abs(Math.sin(t * s.f + s.p))) * k.clamp(1 - s.y / L.hy * 0.9);
      c.fillStyle = '#fff';
      c.fillRect(s.x, s.y, s.s, s.s);
    }
    c.globalAlpha = 1;
    sun(t);
    c.drawImage(front, 0, 0, cv.w, cv.h);
    grid(dt);
    // palms: a pair framing the stage, more under the frosted panels
    const ground = cv.h + 4;
    const ph = k.clamp((cv.h - L.hy) * 1.6, 160, 380);
    palm(L.st.left + 10, ground, ph, 0.12, t, 1);
    palm(L.st.left - 40, ground, ph * 0.7, 0.2, t, 2);
    palm(L.st.right - 10, ground, ph * 0.9, -0.14, t, 3);
    palm(L.st.right + 60, ground, ph * 0.75, -0.08, t, 4);
    palm(L.cx - L.sunR * 1.6, L.hy + 8, ph * 0.28, 0.1, t, 5);
    if (strip) c.drawImage(strip.e, 0, strip.top, cv.w, strip.h);
    const car0 = car(t);
    if (car0) {
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.age += dt;
        if (p.age > p.life) { puffs.splice(i, 1); continue; }
        p.y += dt * 30; p.r += dt * 18;
        c.globalAlpha = 0.35 * (1 - p.age / p.life);
        c.fillStyle = '#c9a7ff';
        c.beginPath(); c.arc(car0.x + p.x * car0.scale, car0.y + p.y * car0.scale - 10 * car0.scale, p.r * car0.scale, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
    osd(t);
  }, { still: 1.2 });

  const puff = () => { for (const s of [-1, 1]) puffs.push({ x: s * 46 + k.rand(-3, 3), y: 0, r: 4, age: 0, life: 0.7 }); };

  return {
    question() {
      layout();
    },
    layout() { layout(); },
    event(name) { if (name === 'stat') layout(); },
    answer() {
      boost = 1;
      away = 0.001;
      k.sfx.whoosh({ pitch: 0.6, gain: 0.7 });
      k.sfx.tone({ type: 'sawtooth', freq: 70, to: 260, dur: 1.1, gain: 0.06, filter: 'lowpass', freqF: 900 });
    },
    keystroke() { if (!k.reduced && puffs.length < 30) puff(); },
  };
}
