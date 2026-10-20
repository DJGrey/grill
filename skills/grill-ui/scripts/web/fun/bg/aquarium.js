// Aquarium. Light rays, kelp, a treasure chest and a tank full of fish. One fish tows a banner with
// this question (long titles wear it out), bubbles rise as you type, and the goldfish keeps forgetting.

const SPECIES = {
  clown: { L: 54, H: 30, body: '#ff7a1a', fin: '#ff8c33', speed: [34, 56] },
  tang: { L: 66, H: 40, body: '#2f63d6', fin: '#1b3f9e', tail: '#ffd21a', speed: [40, 64] },
  angel: { L: 50, H: 50, body: '#e9e4d0', fin: '#d8cfa8', speed: [22, 36] },
  gold: { L: 58, H: 32, body: '#ff9a2a', fin: '#ffb357', speed: [26, 40] },
  puffer: { L: 50, H: 40, body: '#d9c27a', fin: '#c4a95a', speed: [16, 26] },
  yellow: { L: 64, H: 48, body: '#ffd21a', fin: '#f2b800', speed: [0, 0] },
};
const FORGET = ['…what was the question again?', '…wait, what are we deciding?', '…is this the same question?', '…oh! a castle!'];

export default function aquarium(k, ctx) {
  const back = k.canvas({ alpha: false });
  const light = k.canvas({ dpr: 1 });
  const cv = k.canvas();
  const c = cv.ctx;

  let G = null;
  let fish = [], school = [], bubbles = [], kelp = [], puffs = [];
  let tower = null, banner = null, think = null, thinkAt = 9;
  let chest = { open: 0, next: 6 };
  let hum = null;

  // ── layout ────────────────────────────────────────────────────────────────

  function layout() {
    const sp = k.space();
    const gap = sp.gaps.find((g) => (g.where === 'bottom' && g.h > 70) || g.where === 'all') || sp.gaps.find((g) => g.where === 'top' && g.h >= 36) || sp.gaps.find((g) => g.where === 'bottom') || { x: sp.stage.x, y: sp.vh - 120, w: sp.stage.width, h: 120 };
    const s = Math.max(0.6, Math.min(1.05, gap.h / 260));
    const sandTop = sp.vh - Math.max(26, Math.min(70, gap.h * 0.26));
    const first = !G;
    G = { sp, gap, s, sandTop, vw: sp.vw, vh: sp.vh, card: sp.card };
    const lane = gap.where === 'top' ? gap.y + gap.h / 2 : Math.max(gap.y + 26 * s, Math.min(sandTop - 60 * s, gap.y + gap.h * 0.36));
    G.lane = lane;
    G.bubbler = { x: gap.x + gap.w * 0.08, y: sandTop + 8 };
    G.chest = { x: gap.x + gap.w * 0.86, y: sandTop + 10 };
    drawBack(back.w, back.h);
    const r = k.rng(7);
    kelp = [];
    for (let x = -20; x < sp.vw + 40; x += r.rand(50, 110)) {
      if (Math.abs(x - G.chest.x) < 50 || Math.abs(x - G.bubbler.x) < 30) continue;
      const inGap = x > gap.x && x < gap.x + gap.w;
      kelp.push({ x, h: (inGap ? r.rand(70, 150) : r.rand(150, 420)) * s, ph: r.rand(6.28), w: r.rand(7, 12) * s, col: r.pick(['#2e8a4e', '#3a9a54', '#256f43', '#4aa35c']), leaves: r.int(4, 8) });
    }
    if (first) seedFish();
    else for (const f of fish) f.band = band(f);
    makeBanner();
  }

  function band(f) {
    const { gap, sandTop, vh } = G;
    return f.zone === 'gap' ? [gap.y + 20, sandTop - 24 * G.s] : [30, vh - 60];
  }

  // ── static water and sand ─────────────────────────────────────────────────

  function drawBack(w, h) {
    if (!G) return;
    const b = back.ctx;
    const g = b.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0e6a86');
    g.addColorStop(0.45, '#0a4a68');
    g.addColorStop(1, '#062a40');
    b.fillStyle = g;
    b.fillRect(0, 0, w, h);
    const r = k.rng(2);
    b.fillStyle = 'rgba(4,30,46,.55)'; // far rocks, in the murk
    for (let x = -40; x < w; x += r.rand(80, 200)) {
      const rw = r.rand(120, 260), rh = r.rand(40, 140);
      b.beginPath(); b.ellipse(x, G.sandTop + 10, rw / 2, rh, 0, Math.PI, 0); b.fill();
    }
    for (let i = 0; i < 60; i++) { // floating specks
      b.fillStyle = `rgba(200,240,255,${r.rand(0.05, 0.18)})`;
      b.beginPath(); b.arc(r.rand(w), r.rand(h), r.rand(0.6, 1.8), 0, 7); b.fill();
    }
    const top = G.sandTop;
    const sg = b.createLinearGradient(0, top - 10, 0, h);
    sg.addColorStop(0, '#e2c98f');
    sg.addColorStop(1, '#a78a55');
    b.fillStyle = sg;
    b.beginPath();
    b.moveTo(0, h);
    for (let x = 0; x <= w; x += 10) b.lineTo(x, top + Math.sin(x * 0.012) * 6 + Math.sin(x * 0.041) * 2);
    b.lineTo(w, h);
    b.closePath();
    b.fill();
    for (let i = 0; i < w / 10; i++) { // pebbles
      const x = r.rand(w), y = r.rand(top + 8, h);
      b.fillStyle = r.pick(['#a8956c', '#c9b48a', '#8f8678', '#b9946e', '#e9dcc0']);
      b.beginPath(); b.ellipse(x, y, r.rand(1.5, 4.5), r.rand(1.2, 3), r.rand(3), 0, 7); b.fill();
    }
    // bubbler stone
    const { x: bx, y: by } = G.bubbler;
    b.fillStyle = '#5a6670';
    b.beginPath(); b.ellipse(bx, by, 16 * G.s, 7 * G.s, 0, 0, 7); b.fill();
    b.fillStyle = 'rgba(255,255,255,.18)';
    b.beginPath(); b.ellipse(bx - 4, by - 3, 7 * G.s, 2.5 * G.s, 0, 0, 7); b.fill();
    for (const [rx, rw, rh, col] of [[0.3, 60, 34, '#4c5a63'], [0.62, 90, 44, '#56636b'], [0.66, 40, 22, '#6a767d']]) {
      const x = G.gap.x + G.gap.w * rx;
      const rg = b.createLinearGradient(x, top - rh, x, top + 8);
      rg.addColorStop(0, col);
      rg.addColorStop(1, '#2c363d');
      b.fillStyle = rg;
      b.beginPath(); b.ellipse(x, top + 6, rw * G.s / 2, rh * G.s, 0, Math.PI, 0); b.fill();
    }
  }

  // ── fish ──────────────────────────────────────────────────────────────────

  function seedFish() {
    const kinds = ['clown', 'clown', 'tang', 'tang', 'angel', 'clown', 'tang', 'angel'];
    fish = kinds.map((sp, i) => newFish(sp, i < 4 ? 'gap' : 'all'));
    fish.push(Object.assign(newFish('gold', 'gap'), { goldfish: true }));
    fish.push(Object.assign(newFish('puffer', 'gap'), { puffer: true, puff: 0 }));
    const r = k.rng(5);
    school = Array.from({ length: 16 }, () => ({ ox: r.rand(-60, 60), oy: r.rand(-26, 26), ph: r.rand(6.28), x: 0, y: 0, face: 1 }));
  }

  function newFish(species, zone) {
    const S = SPECIES[species];
    const f = { species, zone, size: k.rand(0.75, 1.15), dir: k.pick([-1, 1]), face: 1, ph: k.rand(6.28), speed: k.rand(...S.speed), dart: 0, x: 0, y: 0 };
    f.face = f.dir;
    f.band = band(f);
    f.x = k.rand(G.vw);
    f.y = f.base = k.rand(...f.band);
    return f;
  }

  function body(c2, L, H) {
    c2.beginPath();
    c2.moveTo(L * 0.5, 0);
    c2.bezierCurveTo(L * 0.45, -H * 0.42, L * 0.05, -H * 0.55, -L * 0.18, -H * 0.36);
    c2.quadraticCurveTo(-L * 0.3, -H * 0.2, -L * 0.36, -H * 0.1);
    c2.lineTo(-L * 0.36, H * 0.1);
    c2.quadraticCurveTo(-L * 0.3, H * 0.2, -L * 0.18, H * 0.36);
    c2.bezierCurveTo(L * 0.05, H * 0.55, L * 0.45, H * 0.42, L * 0.5, 0);
    c2.closePath();
  }

  function drawFish(f, t, fx = f.x, fy = f.y) {
    const S = SPECIES[f.species];
    const sc = f.size * G.s;
    const L = S.L, H = S.H;
    const beat = Math.sin(t * (6 + f.speed * 0.08 + f.dart * 14) + f.ph);
    c.save();
    c.translate(fx, fy);
    c.scale(sc * (Math.abs(f.face) < 0.15 ? Math.sign(f.face || 1) * 0.15 : f.face), sc);
    c.rotate(Math.sin(t * 0.8 + f.ph) * 0.06);
    if (f.puffer) { drawPuffer(f, t, beat); c.restore(); return; }
    // tail
    c.save();
    c.translate(-L * 0.34, 0);
    c.rotate(beat * 0.32);
    c.fillStyle = S.tail || S.fin;
    c.beginPath();
    if (f.goldfish) { // a flowing double tail
      c.moveTo(0, 0);
      c.bezierCurveTo(-L * 0.25, -H * 0.9, -L * 0.55, -H * 0.5, -L * 0.48, -H * 0.1 + beat * 4);
      c.quadraticCurveTo(-L * 0.36, 0, -L * 0.48, H * 0.12 - beat * 4);
      c.bezierCurveTo(-L * 0.55, H * 0.5, -L * 0.25, H * 0.9, 0, 0);
      c.globalAlpha = 0.85;
    } else {
      c.moveTo(4, 0);
      c.lineTo(-L * 0.24, -H * 0.42);
      c.quadraticCurveTo(-L * 0.16, 0, -L * 0.24, H * 0.42);
      c.closePath();
    }
    c.fill();
    c.globalAlpha = 1;
    c.restore();
    // fins
    c.fillStyle = S.fin;
    if (f.species === 'angel') {
      c.beginPath(); c.moveTo(L * 0.15, -H * 0.38); c.quadraticCurveTo(-L * 0.1, -H * 1.2, -L * 0.32, -H * 1.0); c.lineTo(-L * 0.18, -H * 0.3); c.fill();
      c.beginPath(); c.moveTo(L * 0.15, H * 0.38); c.quadraticCurveTo(-L * 0.1, H * 1.2, -L * 0.32, H * 1.0); c.lineTo(-L * 0.18, H * 0.3); c.fill();
    } else {
      c.beginPath(); c.moveTo(L * 0.18, -H * 0.42); c.quadraticCurveTo(-L * 0.02, -H * 0.72, -L * 0.24, -H * 0.36); c.fill();
      c.beginPath(); c.moveTo(-L * 0.02, H * 0.44); c.quadraticCurveTo(-L * 0.14, H * 0.66, -L * 0.24, H * 0.34); c.fill();
    }
    // body
    body(c, L, H * (f.species === 'angel' ? 0.85 : 1));
    const bg = c.createLinearGradient(0, -H / 2, 0, H / 2);
    bg.addColorStop(0, shade(S.body, 1.15));
    bg.addColorStop(0.6, S.body);
    bg.addColorStop(1, shade(S.body, 0.7));
    c.fillStyle = bg;
    c.fill();
    c.save();
    c.clip();
    if (f.species === 'clown') for (const sx of [L * 0.24, -L * 0.04, -L * 0.3]) {
      c.fillStyle = '#1a1a1a';
      c.fillRect(sx - 6, -H, 12, H * 2);
      c.fillStyle = '#fffaf0';
      c.fillRect(sx - 4.2, -H, 8.4, H * 2);
    }
    if (f.species === 'tang') {
      c.fillStyle = '#10204a';
      c.beginPath(); c.moveTo(L * 0.3, -H * 0.3); c.quadraticCurveTo(-L * 0.05, -H * 0.05, -L * 0.36, -H * 0.3); c.quadraticCurveTo(-L * 0.1, H * 0.25, L * 0.12, -H * 0.05); c.fill();
    }
    if (f.species === 'angel') for (const sx of [L * 0.2, -L * 0.02, -L * 0.22]) { c.fillStyle = 'rgba(30,30,30,.75)'; c.fillRect(sx - 3, -H, 6, H * 2); }
    if (f.species === 'gold' || f.species === 'yellow') { c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(-L * 0.2 + (i % 3) * 9, -H * 0.15 + Math.floor(i / 3) * 8, 3, 0, 7); c.fill(); } }
    c.fillStyle = 'rgba(255,255,255,.22)';
    c.beginPath(); c.ellipse(L * 0.1, -H * 0.24, L * 0.22, H * 0.08, -0.1, 0, 7); c.fill();
    c.restore();
    // pectoral fin, flapping
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.beginPath(); c.ellipse(L * 0.12, H * 0.1, 8, 4, 0.6 + beat * 0.4, 0, 7); c.fill();
    // eye
    const er = f.goldfish ? 6.5 : 5;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(L * 0.3, -H * 0.1, er, 0, 7); c.fill();
    c.fillStyle = '#111';
    c.beginPath(); c.arc(L * 0.31 + 1, -H * 0.1, er * 0.55, 0, 7); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(L * 0.31 + 2, -H * 0.1 - 1.5, er * 0.18, 0, 7); c.fill();
    c.strokeStyle = 'rgba(60,20,10,.6)';
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(L * 0.47, H * 0.05, 3, 0.2, 1.3); c.stroke();
    c.restore();
  }

  function drawPuffer(f, t, beat) {
    const p = k.ease.outBack(Math.min(1, f.puff));
    const R = 20 * (1 + p * 0.75);
    c.fillStyle = '#c4a95a';
    c.save(); c.translate(-R * 0.95, 0); c.rotate(beat * 0.4);
    c.beginPath(); c.moveTo(4, 0); c.lineTo(-12, -9); c.lineTo(-12, 9); c.fill();
    c.restore();
    if (p > 0.05) { // spikes
      c.strokeStyle = '#8a7438';
      c.lineWidth = 1.6;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        c.beginPath(); c.moveTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95); c.lineTo(Math.cos(a) * (R + 7 * p), Math.sin(a) * (R + 7 * p)); c.stroke();
      }
    }
    const g = c.createRadialGradient(-R * 0.3, -R * 0.4, 2, 0, 0, R);
    g.addColorStop(0, '#f6e6a6');
    g.addColorStop(0.7, '#d9c27a');
    g.addColorStop(1, '#a8914c');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, 0, R, R * (0.82 + p * 0.18), 0, 0, 7); c.fill();
    c.fillStyle = '#f7f0d8';
    c.beginPath(); c.ellipse(0, R * 0.35, R * 0.8, R * 0.42, 0, 0, Math.PI); c.fill();
    c.fillStyle = 'rgba(90,70,30,.45)';
    for (const [sx, sy] of [[-8, -10], [2, -14], [-14, -2], [6, -4], [-4, 2]]) { c.beginPath(); c.arc(sx * (1 + p * 0.7), sy * (1 + p * 0.7), 2.4, 0, 7); c.fill(); }
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(R * 0.5, -R * 0.25, 6 + p * 2, 0, 7); c.fill();
    c.fillStyle = '#111';
    c.beginPath(); c.arc(R * 0.55, -R * 0.25, 3.2 + p * 0.8, 0, 7); c.fill();
    c.strokeStyle = '#5a3a1a';
    c.lineWidth = 1.5;
    c.beginPath();
    if (p > 0.3) c.arc(R * 0.86, R * 0.12, 3, 0, 7); // an indignant "o"
    else c.arc(R * 0.8, R * 0.05, 3, 0.2, 1.4);
    c.stroke();
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.min(255, Math.round(v * f))).join(',')})`;
  }

  // ── the banner ────────────────────────────────────────────────────────────

  function bannerText() {
    const q = ctx.question;
    if (q) return `Q${q.n}: ${q.title}`;
    if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      return n ? `ALL DONE! ${n} DECISION${n === 1 ? '' : 'S'}. BLUB.` : 'ALL DONE! BLUB.';
    }
    return ctx.agent === 'listening' ? 'THE AGENT IS LISTENING. BLUB.' : 'THE AGENT IS THINKING. BLUB.';
  }

  function makeBanner(text = bannerText()) {
    const s = G.s;
    const size = Math.round(15 * Math.max(0.85, s));
    const m = document.createElement('canvas').getContext('2d');
    m.font = k.font(size, 800, 'sans');
    const maxW = Math.max(260, G.gap.w * 1.1);
    const shown = k.ellipsize(m, text, maxW);
    const tw = m.measureText(shown).width;
    const W = tw + 34, H = size + 18;
    const dpr = cv.dpr;
    const e = document.createElement('canvas');
    e.width = Math.ceil(W * dpr); e.height = Math.ceil(H * dpr);
    const g = e.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = '#fff8e4';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#d2342b';
    g.fillRect(0, 0, W, 3);
    g.fillRect(0, H - 3, W, 3);
    g.fillStyle = 'rgba(0,0,0,.06)';
    for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
    g.font = k.font(size, 800, 'sans');
    g.textBaseline = 'middle';
    g.fillStyle = '#b3261e';
    g.fillText(shown, 17, H / 2 + 1);
    const tired = text.length > 46;
    if (banner) Object.assign(banner, { e, W, H, tired, text, dpr });
    else banner = { e, W, H, tired, text, dpr };
    if (!tower) tower = { f: Object.assign(newFish('yellow', 'gap'), { size: 1 }), dir: 1, x: G.gap.x - 80, wait: 0.6 };
    tower.speed = Math.max(42, Math.min(120, 150 - W * 0.16));
  }

  function drawBanner(t, dt) {
    const T = tower;
    if (T.wait > 0) { T.wait -= dt; if (T.wait <= 0) T.x = T.dir > 0 ? G.gap.x - 90 * G.s : G.gap.x + G.gap.w + 90 * G.s; return; }
    const huff = banner.tired ? 0.75 + 0.25 * Math.sin(t * 1.3) : 1;
    T.x += T.dir * T.speed * huff * dt * (1 + T.f.dart * 2);
    T.f.dart = Math.max(0, T.f.dart - dt);
    const y = G.lane + Math.sin(t * 0.9) * 6;
    const f = T.f;
    f.face += (T.dir - f.face) * Math.min(1, dt * 6);
    f.speed = T.speed * (banner.tired ? 1.8 : 1);
    const sc = G.s;
    const tail = T.x - T.dir * 40 * sc;
    const lead = tail - T.dir * 26 * sc; // banner's near edge
    const { W, H, e, dpr } = banner;
    // the tow lines
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.lineWidth = 1;
    const by0 = y - H * 0.5 * sc, by1 = y + H * 0.5 * sc;
    c.beginPath(); c.moveTo(tail, y); c.lineTo(lead, by0 + 2); c.moveTo(tail, y); c.lineTo(lead, by1 - 2); c.stroke();
    // the banner, rippling more towards the trailing end, drawn in strips
    const strip = 6;
    const W2 = W * sc, H2 = H * sc;
    for (let u = 0; u < W2; u += strip) {
      const tu = u / W2;
      const wave = Math.sin(u * 0.045 - t * 7 * T.dir) * 4 * (0.25 + tu) * sc;
      const lit = Math.cos(u * 0.045 - t * 7 * T.dir);
      const x = T.dir > 0 ? lead - u - strip : lead + u;
      const sx = T.dir > 0 ? (W2 - u - strip) / W2 * W : u / W2 * W;
      c.drawImage(e, sx * dpr, 0, (strip / W2) * W * dpr + 1, H * dpr, x, by0 + wave, strip + 0.6, H2);
      c.fillStyle = lit > 0 ? `rgba(255,255,255,${lit * 0.12})` : `rgba(0,30,60,${-lit * 0.18})`;
      c.fillRect(x, by0 + wave, strip + 0.6, H2);
    }
    drawFish(f, t, T.x, y);
    if (banner.tired) { // sweat
      const sp = (t * 1.5) % 1;
      c.fillStyle = `rgba(200,240,255,${1 - sp})`;
      c.beginPath(); c.ellipse(T.x + T.dir * 6 * sc, y - 26 * sc + sp * 14, 2.4, 3.6, 0, 0, 7); c.fill();
      if (Math.random() < dt * 1.2) bubbles.push(bubble(T.x + T.dir * 34 * sc, y - 4, k.rand(2, 4)));
    }
    const far = T.dir > 0 ? lead - W2 > G.gap.x + G.gap.w + 40 : lead + W2 < G.gap.x - 40;
    if (far) { T.dir *= -1; T.wait = k.rand(1.5, 4); }
  }

  // ── bubbles ───────────────────────────────────────────────────────────────

  const bubble = (x, y, r) => ({ x, y, r, vy: -k.rand(40, 70) - r * 6, ph: k.rand(6.28), age: 0 });

  function drawBubbles(dt) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += dt;
      b.y += b.vy * dt;
      b.x += Math.sin(b.age * 5 + b.ph) * 18 * dt;
      b.r += dt * 0.3;
      if (b.y < -12) { bubbles.splice(i, 1); continue; }
      c.fillStyle = 'rgba(200,240,255,.12)';
      c.strokeStyle = 'rgba(220,250,255,.6)';
      c.lineWidth = 1;
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath(); c.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.6, b.r * 0.25), 0, 7); c.fill();
    }
  }

  // ── the scene ─────────────────────────────────────────────────────────────

  function drawChest(dt) {
    const { x, y } = G.chest;
    const s = G.s;
    chest.next -= dt;
    if (chest.next <= 0 && !k.reduced) {
      chest.next = k.rand(8, 16);
      chest.t = 0;
      for (let i = 0; i < 14; i++) k.after(300 + i * 60, () => bubbles.push(bubble(x + k.rand(-14, 14) * s, y - 26 * s, k.rand(2, 6))));
      k.after(300, () => k.sfx.tone({ freq: 200, to: 520, dur: 0.25, gain: 0.06, vibrato: { rate: 30, depth: 40 } }));
    }
    if (chest.t !== undefined) { chest.t += dt; chest.open = chest.t < 0.3 ? chest.t / 0.3 : chest.t < 1.6 ? 1 : Math.max(0, 1 - (chest.t - 1.6) / 0.5); }
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath(); c.ellipse(0, 4, 40, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#6a4024';
    c.fillRect(-34, -26, 68, 28);
    c.fillStyle = '#d6a43c';
    for (const bx of [-30, 26]) c.fillRect(bx, -26, 4, 28);
    c.fillStyle = 'rgba(0,0,0,.2)';
    for (let yy = -20; yy < 0; yy += 7) c.fillRect(-34, yy, 68, 1);
    if (chest.open > 0) { // gold inside
      c.fillStyle = '#ffd34a';
      c.beginPath(); c.ellipse(0, -26, 30, 6 * chest.open, 0, Math.PI, 0); c.fill();
      c.globalCompositeOperation = 'lighter';
      const gg = c.createRadialGradient(0, -30, 0, 0, -30, 50);
      gg.addColorStop(0, `rgba(255,220,100,${0.5 * chest.open})`);
      gg.addColorStop(1, 'rgba(255,220,100,0)');
      c.fillStyle = gg;
      c.fillRect(-50, -80, 100, 80);
      c.globalCompositeOperation = 'source-over';
    }
    c.translate(0, -26);
    c.rotate(-chest.open * 0.6);
    c.fillStyle = '#7a4a2a';
    c.beginPath(); c.moveTo(-34, 0); c.lineTo(-34, -8); c.quadraticCurveTo(0, -22, 34, -8); c.lineTo(34, 0); c.closePath(); c.fill();
    c.fillStyle = '#d6a43c';
    c.fillRect(-3, -6, 6, 9);
    c.restore();
  }

  function drawKelp(t) {
    for (const kp of kelp) {
      const n = 14;
      let px = kp.x, py = G.sandTop + 10;
      const pts = [[px, py]];
      for (let i = 1; i <= n; i++) {
        const u = i / n;
        px = kp.x + Math.sin(t * 0.9 + kp.ph + u * 2.2) * 18 * u * u + Math.sin(t * 0.4 + kp.ph) * 6 * u;
        py = G.sandTop + 10 - kp.h * u;
        pts.push([px, py]);
      }
      c.strokeStyle = kp.col;
      c.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        c.lineWidth = kp.w * (1 - i / pts.length * 0.6);
        c.beginPath(); c.moveTo(...pts[i - 1]); c.lineTo(...pts[i]); c.stroke();
      }
      c.fillStyle = kp.col;
      for (let j = 1; j <= kp.leaves; j++) {
        const [lx, ly] = pts[Math.round((j / (kp.leaves + 1)) * n)];
        const side = j % 2 ? 1 : -1;
        c.save();
        c.translate(lx, ly);
        c.rotate(side * (0.9 + Math.sin(t * 1.2 + j + kp.ph) * 0.2) - Math.PI / 2 * 0);
        c.beginPath(); c.ellipse(side * kp.w * 1.4, -4, kp.w * 1.6, kp.w * 0.5, side * -0.5, 0, 7); c.fill();
        c.restore();
      }
    }
  }

  function drawRays(t) {
    const l = light.ctx;
    l.clearRect(0, 0, light.w, light.h);
    l.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = (i / 7) * G.vw * 1.2 - G.vw * 0.05 + Math.sin(t * 0.15 + i * 1.7) * 40;
      const w = 50 + (i % 3) * 30;
      const a = 0.06 + 0.04 * Math.sin(t * 0.5 + i * 2.1);
      const g = l.createLinearGradient(0, 0, 0, G.vh);
      g.addColorStop(0, `rgba(200,250,255,${a})`);
      g.addColorStop(1, 'rgba(200,250,255,0)');
      l.fillStyle = g;
      l.beginPath(); l.moveTo(x, -10); l.lineTo(x + w, -10); l.lineTo(x + w * 2.2 + 160, G.vh); l.lineTo(x + 160, G.vh); l.closePath(); l.fill();
    }
    for (let i = 0; i < 26; i++) { // caustics dancing on the sand
      const x = ((i * 97) % G.vw) + Math.sin(t * 0.8 + i) * 20;
      const y = G.sandTop + 12 + ((i * 37) % Math.max(10, G.vh - G.sandTop - 14));
      l.fillStyle = `rgba(255,255,220,${0.06 + 0.05 * Math.sin(t * 2 + i * 1.3)})`;
      l.beginPath(); l.ellipse(x, y, 22 + 8 * Math.sin(t * 1.3 + i), 4, Math.sin(i) * 0.3, 0, 7); l.fill();
    }
    l.globalCompositeOperation = 'source-over';
  }

  function swim(f, dt, t) {
    f.dart = Math.max(0, f.dart - dt * 1.2);
    f.x += f.dir * f.speed * (1 + f.dart * 5) * dt * G.s;
    const [lo, hi] = f.band;
    f.base += Math.sin(t * 0.13 + f.ph) * 6 * dt;
    f.base = Math.min(hi, Math.max(lo, f.base));
    f.y = f.base + Math.sin(t * 0.7 + f.ph) * 8;
    const minX = f.zone === 'gap' ? G.gap.x - 60 : -80, maxX = f.zone === 'gap' ? G.gap.x + G.gap.w + 60 : G.vw + 80;
    if ((f.x > maxX && f.dir > 0) || (f.x < minX && f.dir < 0) || (Math.random() < dt * 0.04 && !f.dart)) f.dir *= -1;
    f.face += (f.dir - f.face) * Math.min(1, dt * 5);
    if (f.puffer) f.puff = Math.max(0, f.puff - dt * 0.3);
  }

  function step(dt, t) {
    if (!G) return;
    drawRays(t);
    c.clearRect(0, 0, cv.w, cv.h);
    drawKelp(t);
    // the school of tetras, following a wandering point
    const sx = G.gap.x + G.gap.w * (0.5 + 0.42 * Math.sin(t * 0.11)), sy = G.gap.y + G.gap.h * (0.35 + 0.12 * Math.sin(t * 0.23));
    for (const m of school) {
      const tx = sx + m.ox * G.s + Math.sin(t * 1.3 + m.ph) * 8, ty = sy + m.oy * G.s + Math.cos(t * 1.1 + m.ph) * 5;
      const vx = tx - m.x;
      m.x += vx * Math.min(1, dt * 1.6);
      m.y += (ty - m.y) * Math.min(1, dt * 1.6);
      if (Math.abs(vx) > 0.5) m.face += (Math.sign(vx) - m.face) * Math.min(1, dt * 4);
      c.save();
      c.translate(m.x, m.y);
      c.scale(G.s * (Math.abs(m.face) < 0.2 ? 0.2 * Math.sign(m.face || 1) : m.face), G.s);
      c.fillStyle = '#cfd8e6';
      c.beginPath(); c.ellipse(0, 0, 9, 3.4, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(-7, 0); c.lineTo(-13, -3.5 + Math.sin(t * 14 + m.ph) * 1.5); c.lineTo(-13, 3.5 + Math.sin(t * 14 + m.ph) * 1.5); c.fill();
      c.fillStyle = '#2ff3ff';
      c.fillRect(-6, -1.6, 13, 1.6);
      c.fillStyle = '#ff3b4a';
      c.fillRect(-7, 0, 8, 1.8);
      c.fillStyle = '#111';
      c.beginPath(); c.arc(6, -0.6, 1.1, 0, 7); c.fill();
      c.restore();
    }
    for (const f of fish) { swim(f, dt, t); drawFish(f, t); }
    drawChest(dt);
    drawBanner(t, dt);
    if (!k.reduced && Math.random() < dt * 2.2) bubbles.push(bubble(G.bubbler.x + k.rand(-3, 3), G.bubbler.y - 6, k.rand(1.5, 4)));
    drawBubbles(dt);
    // the goldfish forgets
    thinkAt -= dt;
    const gf = fish.find((f) => f.goldfish);
    const forgot = (first) => (ctx.question ? (first ? FORGET[0] : k.pick(FORGET)) : ctx.front === 'done' ? '…did we win?' : '…who are we waiting for?');
    if (thinkAt <= 0 && !k.reduced) { think = { age: 0, text: forgot() }; thinkAt = k.rand(16, 24); }
    if (k.reduced && !think) think = { age: 1, text: forgot(true) };
    if (think && gf) {
      think.age += dt;
      if (think.age > 4) think = null;
      else {
        const a = k.reduced ? 1 : Math.min(1, think.age * 4, (4 - think.age) * 3);
        c.save();
        c.globalAlpha = a;
        c.font = k.font(13 * Math.max(0.85, G.s), 600, 'sans');
        const tw = c.measureText(think.text).width + 24;
        let bx = gf.x - tw / 2, by = gf.y - 52 * G.s;
        bx = Math.max(G.gap.x + 8, Math.min(G.gap.x + G.gap.w - tw - 8, bx));
        by = Math.max(G.gap.y + 4, by);
        c.fillStyle = 'rgba(255,255,255,.92)';
        c.beginPath(); c.roundRect(bx, by, tw, 26, 13); c.fill();
        for (const [dx, dy, r] of [[0, 32, 4.5], [-5, 41, 3]]) { c.beginPath(); c.arc(Math.min(Math.max(gf.x, bx + 10), bx + tw - 10) + dx, by + dy, r, 0, 7); c.fill(); }
        c.fillStyle = '#21405a';
        c.textBaseline = 'middle';
        c.fillText(think.text, bx + 12, by + 13.5);
        c.restore();
      }
    }
  }

  function sound(on) {
    hum?.stop(0.5);
    hum = on ? k.sfx.noise({ dur: Infinity, color: 'pink', filter: 'lowpass', freq: 380, gain: 0.035, attack: 1 }) : null;
  }

  back.resized = drawBack;
  cv.resized = () => { if (banner && banner.dpr !== cv.dpr) makeBanner(banner.text); }; // same text, crisp at the new DPR
  layout();
  if (k.reduced) { // a still frame with the banner mid-tank
    tower.x = G.gap.x + G.gap.w * 0.5 + banner.W * G.s * 0.5;
    tower.wait = 0;
    for (let i = 0; i < 18; i++) bubbles.push({ ...bubble(G.bubbler.x + k.rand(-6, 6), G.sandTop - k.rand(0, G.sandTop - G.gap.y), k.rand(1.5, 4)), vy: 0 });
  }
  k.loop(step, { still: 1 });
  if (k.sfx.on) sound(true);

  // tap the glass: nearby fish dart off, the puffer puffs up
  k.on(k.root, 'pointerdown', (e) => {
    k.sfx.tone({ type: 'sine', freq: 300, to: 700, dur: 0.12, gain: 0.05 });
    if (k.reduced) return; // a still has no time to settle a dart, a puff or bubbles
    for (const f of [...fish, tower.f]) {
      const d = Math.hypot(f.x - e.clientX, f.y - e.clientY);
      if (d < 160) { f.dart = 1; f.dir = Math.sign(f.x - e.clientX) || 1; }
      if (f.puffer && d < 70) { f.puff = 1; k.sfx.boing({ gain: 0.4, pitch: 1.4 }); }
    }
    for (let i = 0; i < 5; i++) bubbles.push(bubble(e.clientX + k.rand(-8, 8), e.clientY, k.rand(1.5, 3.5)));
  });

  return {
    question() { makeBanner(); if (k.reduced) think = null; k.after(500, layout); k.after(1100, layout); },
    layout,
    status() { if (!ctx.question) makeBanner(); },
    decisions() { if (ctx.front === 'done') makeBanner(); },
    answer(a) {
      makeBanner(a.tookRec ? 'NICE PICK! ★ BLUB.' : a.custom && !a.picks?.length ? 'A WRITE-IN! BOLD. BLUB.' : 'BOLD CHOICE. BLUB.');
      [523, 659, 784, 1047].forEach((f, i) => k.sfx.tone({ freq: f, to: f * 1.4, dur: 0.12, gain: 0.05, delay: i * 0.07 }));
      if (k.reduced) return; // the banner is the still's news; darts and bubbles would never settle
      tower.f.dart = 1;
      for (const f of fish) { f.dart = 1; }
      for (let i = 0; i < 30; i++) bubbles.push(bubble(G.gap.x + k.rand(G.gap.w), G.sandTop - k.rand(0, 30), k.rand(2, 6)));
    },
    keystroke() {
      const gx = k.rand() < 0.5 ? G.bubbler.x : (fish[k.int(0, fish.length - 1)]?.x ?? G.bubbler.x);
      if (!k.reduced) bubbles.push(bubble(gx + k.rand(-6, 6), Math.min(G.sandTop - 4, G.gap.y + G.gap.h * k.rand(0.4, 0.9)), k.rand(2, 4.5)));
      if (k.chance(0.25)) k.sfx.tone({ freq: k.rand(500, 800), to: 1100, dur: 0.06, gain: 0.025 });
    },
    sound,
  };
}
