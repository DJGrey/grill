// Disco. A light-up floor pulsing at 118 BPM, a mirror ball throwing spots across the whole page,
// you doing the Travolta point and the agent doing the only dance it knows (the robot). A marquee
// plays the request line: the recommended option.

const BPM = 118;
const PAL = ['#ff2d95', '#00e5ff', '#ffe600', '#ff7a00', '#7cff4f', '#b44dff'];
const SONGS = [
  '“Stayin’ Undecided” by The Bee Grills',
  '“Don’t Stop ’Til You Get Enough Context”',
  '“Y.A.G.N.I.” by The Village People Managers',
  '“Le Freak (C’est Spec)”',
  '“Disco Inferno (Prod Is Down Mix)”',
  '“Night Fever (Deploy Friday)”',
  '“I Will Survive This Refactor”',
  '“Ring My Bell (On-Call Version)”',
  '“Boogie Wonderland of Edge Cases”',
  '“It’s Raining Specs”',
  '“Dancing Queue”',
  '“Knock On Wood (No Regressions)”',
  '“Funkytown (Won’t You Take Me To Refactor Town)”',
];
const TAGS = ['KEEP IT FUNKY', 'NO DECISIONS ON AN EMPTY DANCE FLOOR', 'THE AGENT ONLY KNOWS THE ROBOT. BE KIND', 'SHOES ON, SCOPE DOWN', 'DRINKS ARE ON THE BACKLOG', 'NO SCOPE CREEP ON THE DANCE FLOOR'];

// Poses: [lean, armL upper, armL lower, armR upper, armR lower, legL upper, legL lower, legR upper, legR lower, hipX]
// Angles from straight down, positive towards screen right (radians).
const POSE = {
  up: [0.1, -0.9, 0.95, 2.35, 2.5, -0.28, -0.05, 0.38, 0.12, -0.04],
  down: [-0.08, -0.9, 0.95, -0.45, -0.75, -0.22, 0.02, 0.22, 0.42, 0.04],
  ponder: [0.04, 0.35, -1.4, 0.25, 2.95, -0.08, -0.02, 0.1, 0.02, 0],
  vee: [0, -2.55, -2.7, 2.55, 2.7, -0.3, -0.1, 0.3, 0.1, 0],
  hustleA: [0.06, -0.7, 1.2, 0.6, -1.4, -0.3, -0.05, 0.12, 0.25, -0.03],
  hustleB: [-0.06, -0.6, 1.4, 0.7, -1.2, -0.12, -0.25, 0.3, 0.05, 0.03],
  typeA: [0.05, -0.3, 1.35, 0.3, -1.1, -0.15, 0, 0.15, 0, 0],
  typeB: [0.05, -0.3, 1.1, 0.3, -1.35, -0.15, 0, 0.15, 0, 0],
};
const ROBOT = [
  [0, -1.57, -3.14, 1.57, 3.14, -0.1, -0.1, 0.1, 0.1, 0],
  [0, -1.57, 0, 1.57, 1.57, -0.1, -0.1, 0.1, 0.1, 0],
  [0, -0.2, -1.57, 1.57, 0, -0.1, -0.1, 0.1, 0.1, 0],
  [0, -1.57, -1.57, 0.2, 1.57, -0.1, -0.1, 0.1, 0.1, 0],
  [0, -2.4, -2.4, 0.5, 0.5, -0.35, -0.35, 0.1, 0.1, -0.03],
  [0, -0.5, -0.5, 2.4, 2.4, -0.1, -0.1, 0.35, 0.35, 0.03],
];

export default function disco(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  const beatLen = 60 / BPM;

  const sprite = (col, size = 64, hard = 0) => {
    const s = document.createElement('canvas');
    s.width = s.height = size;
    const x = s.getContext('2d');
    const r = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    r.addColorStop(0, col);
    r.addColorStop(hard, col);
    r.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = r;
    x.fillRect(0, 0, size, size);
    return s;
  };
  const glow = PAL.map((col) => sprite(col));
  const spotS = sprite('rgba(255,255,255,1)', 32, 0.35);
  const spotT = PAL.map((col) => sprite(col, 32, 0.3));
  const glint = (() => {
    const s = document.createElement('canvas');
    s.width = s.height = 48;
    const x = s.getContext('2d');
    x.translate(24, 24);
    const core = x.createRadialGradient(0, 0, 0, 0, 0, 10);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = core;
    x.fillRect(-10, -10, 20, 20);
    x.fillStyle = 'rgba(255,255,255,.95)';
    for (const r of [0, Math.PI / 2]) {
      x.save(); x.rotate(r);
      x.beginPath(); x.moveTo(-23, 0); x.lineTo(0, -1.4); x.lineTo(23, 0); x.lineTo(0, 1.4); x.fill();
      x.restore();
    }
    return s;
  })();

  // ── layout ────────────────────────────────────────────────────────────────
  let L;
  let wall = null;
  function measure() {
    const sp = k.space();
    const st = sp.stage;
    const B = sp.gaps.find((g) => g.where === 'bottom' && g.h >= 60) || { x: st.x, y: sp.vh - 140, w: st.width, h: 140, where: 'none' };
    const T = sp.gaps.find((g) => g.where === 'top' && g.h >= 24);
    const cx = B.x + B.w / 2;
    const Fy0 = B.y + Math.min(B.h * 0.3, 90);
    const z0 = 1.5, z1 = 9.5, H = 1.35;
    const K = (sp.vh + 30 - Fy0) / (1 / z0 - 1 / z1);
    const ballR = k.clamp(B.h * 0.11, 14, 30);
    const dh = k.clamp(B.h * 0.5, 54, 150);
    L = {
      B, T, cx, Fy0, z0, z1, K, Vy: Fy0 - K / z1, f: K / H, vw: sp.vw, vh: sp.vh, st,
      ball: { x: cx, y: B.y + ballR + 12, r: ballR },
      you: { x: B.x + B.w * 0.27, y: B.y + B.h - Math.max(12, B.h * 0.1), h: dh },
      bot: { x: B.x + B.w * 0.75, y: B.y + B.h - Math.max(12, B.h * 0.1), h: dh * 0.92 },
      tick: T ? { x: T.x, y: T.y + T.h / 2, w: T.w } : { x: B.x, y: sp.vh - 14, w: B.w },
    };
    paintWall();
    ticker.dirty = true;
  }

  // Back wall: deep purple with a sequin curtain, painted once per layout.
  function paintWall() {
    const { vw, Fy0 } = L;
    wall = document.createElement('canvas');
    wall.width = Math.round(vw * cv.dpr);
    wall.height = Math.round(Fy0 * cv.dpr) + 2;
    wall.d = cv.dpr;
    const w = wall.getContext('2d');
    w.scale(cv.dpr, cv.dpr);
    const g = w.createLinearGradient(0, 0, 0, Fy0);
    g.addColorStop(0, '#0b0414');
    g.addColorStop(1, '#2a0b3a');
    w.fillStyle = g;
    w.fillRect(0, 0, vw, Fy0 + 1);
    const R = k.rng('curtain');
    for (let x = 0; x < vw; x += 9) {
      w.fillStyle = `rgba(255,255,255,${0.02 + 0.03 * Math.sin(x / 23) ** 2})`;
      w.fillRect(x, 0, 4, Fy0);
      for (let y = R.rand(8); y < Fy0; y += R.rand(6, 18)) {
        w.fillStyle = `rgba(${R.pick(['255,180,240', '170,220,255', '255,240,190'])},${R.rand(0.08, 0.35)})`;
        w.fillRect(x + 1, y, 2, 2);
      }
    }
    const fade = w.createLinearGradient(0, Fy0 - 40, 0, Fy0);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,.55)');
    w.fillStyle = fade;
    w.fillRect(0, Fy0 - 40, vw, 40);
  }

  // ── the marquee ───────────────────────────────────────────────────────────
  const ticker = { cv: null, w: 0, x: 0, text: '', dirty: true };
  const song = () => (ctx.question ? SONGS[k.hash(ctx.question.id || ctx.question.title) % SONGS.length] : SONGS[0]);
  let celebrate = 0;
  function tickerText() {
    const q = ctx.question;
    if (celebrate > 0) return `♪ NOW PLAYING: “Celebration” · ${ctx.lastAnswer?.tookRec ? 'THE REQUEST LINE IS HONOURED' : 'THE DJ RESPECTS A WILD CARD'} · ${ctx.lastAnswer?.tookRec ? '★ ' : ''}${k.clip((ctx.lastAnswer?.picks || [])[0] || 'YOUR OWN ANSWER', 46)} · `;
    if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      return `♪ LAST DANCE · ${n ? `${n} DECISION${n === 1 ? '' : 'S'}` : 'EVERY DECISION'} ON THE FLOOR · THE LIGHTS ARE COMING UP · GET HOME SAFE · YOU WERE THE ★ TONIGHT · `;
    }
    if (!q) return `♪ NOW PLAYING: ${SONGS[0]} (12-minute extended mix) · DJ AGENT IS CUEING UP THE NEXT QUESTION · PLEASE HOLD YOUR POSE · `;
    const recs = q.options.filter((o) => o.recommended).map((o) => k.clip(o.label || 'THE ONE WITH NO NAME', 46));
    const req = !q.options.length ? 'OPEN MIC. WRITE YOUR OWN ANSWER' : recs.length ? `★ ${recs.join(' + ')}${recs.length > 1 ? ' (MEDLEY)' : ''}` : 'ANYTHING YOU LIKE';
    return `♪ NOW PLAYING: ${song()} · REQUEST LINE: ${req} · QUESTION ${q.n} OF ${q.total} · ${TAGS[k.hash(q.id || '') % TAGS.length]} · `;
  }
  function paintTicker() {
    ticker.text = tickerText();
    const s = document.createElement('canvas');
    const g = s.getContext('2d');
    const F = k.font(14, 800, 'sans');
    g.font = F;
    g.letterSpacing = '1.5px';
    const w = Math.ceil(g.measureText(ticker.text).width) + 20;
    s.width = Math.round(w * cv.dpr);
    s.height = Math.round(30 * cv.dpr);
    g.scale(cv.dpr, cv.dpr);
    g.font = F;
    g.letterSpacing = '1.5px';
    g.textBaseline = 'middle';
    g.shadowColor = '#ff2d95';
    g.shadowBlur = 10;
    g.fillStyle = '#ffd6f0';
    g.fillText(ticker.text, 10, 15);
    g.shadowBlur = 3;
    g.fillStyle = '#fff4fb';
    g.fillText(ticker.text, 10, 15);
    Object.assign(ticker, { cv: s, w, dirty: false });
  }

  // ── figures ───────────────────────────────────────────────────────────────
  const dir = (a, l) => [Math.sin(a) * l, Math.cos(a) * l];
  const lerpPose = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function body(x, y, h, p, o) {
    const [lean, aLu, aLl, aRu, aRl, lLu, lLl, lRu, lRl, hipX] = p;
    const hip = [x + hipX * h, y - 0.48 * h + (o.bob || 0)];
    const legs = [[lLu, lLl, -0.035], [lRu, lRl, 0.035]];
    c.lineCap = o.robot ? 'square' : 'round';
    c.lineJoin = 'round';
    c.strokeStyle = c.fillStyle = o.col;
    for (const [u, l, off] of legs) {
      const h0 = [hip[0] + off * h, hip[1]];
      const [dx, dy] = dir(u, 0.25 * h), knee = [h0[0] + dx, h0[1] + dy];
      const [ex, ey] = dir(l, 0.24 * h), foot = [knee[0] + ex, knee[1] + ey];
      c.lineWidth = (o.robot ? 0.075 : 0.065) * h;
      c.beginPath(); c.moveTo(...h0); c.lineTo(...knee); c.lineTo(...foot); c.stroke();
      if (o.flares) { // bell-bottoms
        c.beginPath();
        c.moveTo(knee[0] - 0.03 * h, knee[1]); c.lineTo(foot[0] - 0.065 * h, foot[1] + 0.01 * h); c.lineTo(foot[0] + 0.065 * h, foot[1] + 0.01 * h); c.lineTo(knee[0] + 0.03 * h, knee[1]);
        c.fill();
      } else c.fillRect(foot[0] - 0.05 * h, foot[1] - 0.02 * h, 0.1 * h, 0.04 * h);
    }
    const [tx, ty] = dir(Math.PI + lean, 0.3 * h), neck = [hip[0] + tx, hip[1] + ty];
    if (o.robot) {
      c.save(); c.translate((hip[0] + neck[0]) / 2, (hip[1] + neck[1]) / 2); c.rotate(-lean);
      c.fillRect(-0.1 * h, -0.17 * h, 0.2 * h, 0.32 * h);
      c.restore();
    } else {
      c.lineWidth = 0.13 * h;
      c.beginPath(); c.moveTo(...hip); c.lineTo(...neck); c.stroke();
    }
    for (const [u, l, side] of [[aLu, aLl, -1], [aRu, aRl, 1]]) {
      const sh = [neck[0] + side * 0.075 * h, neck[1] + 0.03 * h];
      const [dx, dy] = dir(u, 0.17 * h), el = [sh[0] + dx, sh[1] + dy];
      const [ex, ey] = dir(l, 0.16 * h), hand = [el[0] + ex, el[1] + ey];
      c.lineWidth = (o.robot ? 0.06 : 0.05) * h;
      c.beginPath(); c.moveTo(...sh); c.lineTo(...el); c.lineTo(...hand); c.stroke();
      if (!o.robot) { c.beginPath(); c.arc(hand[0], hand[1], 0.03 * h, 0, Math.PI * 2); c.fill(); }
      else c.fillRect(hand[0] - 0.03 * h, hand[1] - 0.03 * h, 0.06 * h, 0.06 * h);
    }
    const head = [neck[0] + Math.sin(lean) * 0.08 * h, neck[1] - 0.09 * h];
    if (o.robot) {
      c.fillRect(head[0] - 0.08 * h, head[1] - 0.07 * h, 0.16 * h, 0.14 * h);
      c.lineWidth = 0.015 * h;
      c.beginPath(); c.moveTo(head[0], head[1] - 0.07 * h); c.lineTo(head[0], head[1] - 0.13 * h); c.stroke();
      return head;
    }
    c.beginPath(); // the afro
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2, r = (0.112 + (i % 2) * 0.012) * h;
      c.lineTo(head[0] + Math.cos(a) * r, head[1] - 0.025 * h + Math.sin(a) * r * 0.92);
    }
    c.fill();
    c.beginPath(); c.arc(head[0], head[1] + 0.02 * h, 0.065 * h, 0, Math.PI * 2); c.fill();
    return head;
  }

  function dancer(d, pose, o) {
    const { x, y, h } = d;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.beginPath(); c.ellipse(x, y + 2, h * 0.2, h * 0.035, 0, 0, Math.PI * 2); c.fill();
    if (o.spin) { c.translate(x, 0); c.scale(Math.cos(o.spin) || 0.05, 1); c.translate(-x, 0); }
    c.save(); // reflection in the glossy floor
    c.globalAlpha = 0.28;
    c.translate(0, y * 1.55 + 3); c.scale(1, -0.55);
    body(x, y, h, pose, { ...o, col: '#000' });
    c.restore();
    c.shadowColor = o.rim;
    c.shadowBlur = 16;
    const head = body(x, y, h, pose, { ...o, col: '#08030d' });
    c.shadowBlur = 0;
    if (o.laptop) { // the keyboard boogie: lid towards us, screen glow on the face
      const lx = x + pose[9] * h, ly = y - 0.5 * h;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.5;
      c.drawImage(glow[1], lx - 0.2 * h, ly - 0.45 * h, 0.4 * h, 0.35 * h);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.fillStyle = '#7fe9ff';
      c.fillRect(lx - 0.135 * h, ly - 0.172 * h, 0.27 * h, 0.006 * h);
      c.fillStyle = '#15101c';
      c.fillRect(lx - 0.13 * h, ly - 0.165 * h, 0.26 * h, 0.165 * h);
      c.fillStyle = '#d8d4e8';
      c.beginPath(); c.arc(lx, ly - 0.085 * h, 0.018 * h, 0, Math.PI * 2); c.fill();
    }
    if (o.robot) { // LED eyes and a chest light
      c.fillStyle = o.eyes;
      c.fillRect(head[0] - 0.05 * h, head[1] - 0.015 * h, 0.03 * h, 0.025 * h);
      c.fillRect(head[0] + 0.02 * h, head[1] - 0.015 * h, 0.03 * h, 0.025 * h);
      c.beginPath(); c.arc(head[0], head[1] - 0.14 * h, 0.018 * h, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    c.font = k.font(Math.max(10, h * 0.09), 700, 'sans');
    c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,.55)';
    c.fillText(o.name, x, y + Math.max(12, h * 0.1));
  }

  // ── state ─────────────────────────────────────────────────────────────────
  let rot = 0, spin = 0, flash = 0, lastBeat = -1, pattern = 0, scratch = 0;
  const steps = new Map(); // tile → brightness, from your pointer and keystrokes
  const spots = Array.from({ length: 90 }, (_, i) => ({ lat: Math.asin(k.rand(-0.95, 0.95)), lon: k.rand(Math.PI * 2), tint: i % 5 === 0 ? k.int(0, PAL.length - 1) : -1, s: k.rand(0.7, 1.3) }));
  const haze = Array.from({ length: 7 }, () => ({ x: k.rand(), y: k.rand(), r: k.rand(160, 320), v: k.rand(-12, 12), col: k.int(0, PAL.length - 1) }));

  function tileAt(px, py) {
    const { Vy, K, f, cx, z0 } = L;
    if (py <= L.Fy0) return null;
    const z = K / (py - Vy);
    return `${Math.floor((z - z0) / 0.8)},${Math.floor(((px - cx) * z) / f)}`;
  }

  // How lit each tile is this beat. Patterns change every 16 beats.
  function lit(r, col, b, ph) {
    const env = 0.55 + 0.45 * Math.exp(-ph * 3);
    switch (pattern) {
      case 0: return (r + col + b) % 2 === 0 ? env : 0.06;
      case 1: { const d = Math.round(Math.hypot(r * 1.2, col * 0.8)); return d % 4 === b % 4 ? env : 0.05; }
      case 2: return ((col - r + b) % 4 + 4) % 4 === 0 ? 0.3 + env * 0.7 : 0.05;
      case 3: return k.hash(`${r},${col},${b}`) % 100 < 30 ? env : 0.04;
      case 4: return (((col % 6) + 6) % 6) === b % 6 || r === (b % 8) ? env : 0.05;
      default: { const hgt = k.hash(`eq${col},${b}`) % 9; return 8 - r < hgt ? 0.25 + env * 0.75 : 0.04; }
    }
  }

  function floor(b, ph) {
    const { Vy, K, f, cx, z0, z1, vw, vh, Fy0 } = L;
    c.fillStyle = '#07030b';
    c.fillRect(0, Fy0, vw, vh - Fy0);
    const rows = [];
    for (let z = z0, r = 0; z < z1 - 0.01; z += 0.8, r++) rows.unshift([z, r]);
    const glows = [];
    for (const [z, r] of rows) {
      const zb = z + 0.8;
      const yF = Vy + K / z, yB = Vy + K / zb;
      if (yB > vh) continue;
      const span = Math.ceil(((vw / 2) * z) / f) + 1;
      for (let col = -span; col < span; col++) {
        const xFL = cx + (f * col) / z, xFR = cx + (f * (col + 1)) / z;
        const xBL = cx + (f * col) / zb, xBR = cx + (f * (col + 1)) / zb;
        if (xFR < 0 || xFL > vw) continue;
        const ci = (((r * 2 + col * 3) % PAL.length) + PAL.length) % PAL.length;
        const v = Math.min(1, lit(r, col, b, ph) + (steps.get(`${r},${col}`) || 0) + flash);
        c.globalAlpha = 0.13 + v * 0.87;
        c.fillStyle = PAL[ci];
        c.beginPath();
        c.moveTo(xBL + 1, yB + 1); c.lineTo(xBR - 1, yB + 1); c.lineTo(xFR - 1.5, yF - 1.5); c.lineTo(xFL + 1.5, yF - 1.5);
        c.fill();
        if (v > 0.35) glows.push([ci, (xFL + xFR + xBL + xBR) / 4, (yF + yB) / 2, (xFR - xFL) * 1.5, (yF - yB) * 2.2, v]);
      }
    }
    // a glossy sheen across the floor, then the glow
    c.globalAlpha = 1;
    const sheen = c.createLinearGradient(0, Fy0, 0, vh);
    sheen.addColorStop(0, 'rgba(0,0,0,.55)');
    sheen.addColorStop(0.35, 'rgba(0,0,0,.1)');
    sheen.addColorStop(1, 'rgba(0,0,0,.35)');
    c.fillStyle = sheen;
    c.fillRect(0, Fy0, vw, vh - Fy0);
    c.globalCompositeOperation = 'lighter';
    for (const [ci, x, y, w, h, v] of glows) {
      c.globalAlpha = v * 0.55;
      c.drawImage(glow[ci], x - w / 2, y - h / 2, w, h);
      c.globalAlpha = v * v * 0.35;
      c.drawImage(spotS, x - w / 5, y - h / 6, w / 2.5, h / 3);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  function ball(t) {
    const { x, y, r } = L.ball;
    c.strokeStyle = 'rgba(200,200,220,.6)';
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x, y - r); c.stroke();
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#9aa0b8'); g.addColorStop(1, '#1c1a2a');
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    const rowsN = 12;
    for (let i = 0; i < rowsN; i++) {
      const lat = -Math.PI / 2 + ((i + 0.5) / rowsN) * Math.PI;
      const n = Math.max(4, Math.round(rowsN * 2 * Math.cos(lat)));
      const fh = (Math.PI / rowsN) * r * 0.9;
      for (let j = 0; j < n; j++) {
        const lon = (j / n) * Math.PI * 2 + rot;
        const z = Math.cos(lat) * Math.cos(lon);
        if (z <= 0.05) continue;
        const fx = x + Math.cos(lat) * Math.sin(lon) * r, fy = y - Math.sin(lat) * r;
        const fw = ((Math.PI * 2) / n) * r * Math.cos(lat) * z * 0.9;
        const light = k.clamp(0.25 + 0.55 * (z * 0.6 + Math.sin(lat) * 0.4 - Math.cos(lat) * Math.sin(lon) * 0.3));
        const tw = Math.sin(lon * 7 + i * 1.7 + t * 3) > 0.96;
        const v = Math.round(60 + light * 170);
        c.fillStyle = tw ? '#ffffff' : (i + j) % 7 === 0 ? PAL[(i + j) % PAL.length] : `rgb(${v},${v},${v + 14})`;
        c.globalAlpha = tw ? 1 : (i + j) % 7 === 0 ? 0.6 : 1;
        c.fillRect(fx - fw / 2, fy - fh / 2, Math.max(0.6, fw), fh * Math.max(0.4, Math.sqrt(z)));
      }
    }
    c.globalAlpha = 1;
    c.restore();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = t * 0.9 + i * 2.1;
      const p = (Math.sin(a * 1.7) + 1) / 2;
      const s = r * (0.6 + p * 0.9);
      c.globalAlpha = p;
      c.drawImage(glint, x + Math.cos(a) * r * 0.55 - s / 2, y + Math.sin(a * 1.3) * r * 0.5 - s / 2, s, s);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  function spotsAndBeams(t, b) {
    const { vw, vh, ball: bl, Fy0, B } = L;
    c.globalCompositeOperation = 'lighter';
    // two follow-spots sweeping the floor from the ceiling corners
    [[vw * 0.06, 1], [vw * 0.94, -1]].forEach(([ox, s], i) => {
      const tx = L.cx + Math.sin(t * 0.55 + i * 2.4) * B.w * 0.55 * s, ty = Math.max(Fy0 + 30, B.y + B.h * 0.75);
      const col = PAL[(b >> 3) % 2 ? i * 3 : i * 3 + 1];
      const gr = c.createLinearGradient(ox, -20, tx, ty);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.16;
      c.fillStyle = gr;
      c.beginPath(); c.moveTo(ox - 8, -20); c.lineTo(ox + 8, -20); c.lineTo(tx + 70, ty); c.lineTo(tx - 70, ty); c.fill();
      c.globalAlpha = 0.5;
      c.drawImage(glow[PAL.indexOf(col)], tx - 110, ty - 30, 220, 60);
    });
    // the mirror-ball spots, everywhere
    for (const s of spots) {
      const lon = s.lon + rot;
      const z = Math.cos(s.lat) * Math.cos(lon);
      if (z < 0.08) continue;
      const X = Math.cos(s.lat) * Math.sin(lon), Y = Math.sin(s.lat);
      const x = bl.x + (X / (z + 0.25)) * vw * 0.22, y = bl.y - (Y / (z + 0.25)) * vh * 0.28;
      if (x < -20 || x > vw + 20 || y < -20 || y > vh + 20) continue;
      const sz = (7 + 9 * (1 - z)) * s.s;
      c.globalAlpha = 0.35 + 0.55 * z;
      c.drawImage(s.tint >= 0 ? spotT[s.tint] : spotS, x - sz, y - sz * 0.6, sz * 2, sz * 1.2);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  function hazeLayer(dt) {
    const { vw, vh, Fy0 } = L;
    c.globalCompositeOperation = 'lighter';
    for (const h of haze) {
      h.x += (h.v * dt) / vw;
      if (h.x < -0.3) h.x = 1.3; if (h.x > 1.3) h.x = -0.3;
      c.globalAlpha = 0.07;
      c.drawImage(glow[h.col], h.x * vw - h.r, Fy0 - h.r * 0.2 + h.y * (vh - Fy0) * 0.5, h.r * 2, h.r * 0.8);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  function marquee(dt, b, ph) {
    if (ticker.dirty || ticker.text !== tickerText()) paintTicker();
    const { tick } = L;
    const h = 26;
    const y = tick.y - h / 2;
    c.fillStyle = 'rgba(8,2,14,.82)';
    c.fillRect(tick.x, y, tick.w, h);
    // chasing bulbs, top and bottom
    for (let x = tick.x + 6, i = 0; x < tick.x + tick.w; x += 12, i++) {
      const on = (i + b) % 3 === 0;
      c.fillStyle = on ? '#fff3b0' : '#5a4a20';
      c.globalAlpha = on ? 0.6 + 0.4 * Math.exp(-ph * 3) : 1;
      c.beginPath(); c.arc(x, y + 1.5, 1.6, 0, Math.PI * 2); c.arc(x, y + h - 1.5, 1.6, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    if (!k.reduced) ticker.x = (ticker.x + dt * 70) % ticker.w;
    c.save();
    c.beginPath(); c.rect(tick.x, y + 3, tick.w, h - 6); c.clip();
    for (let x = tick.x - ticker.x; x < tick.x + tick.w; x += ticker.w) c.drawImage(ticker.cv, x, tick.y - 15, ticker.w, 30);
    c.restore();
  }

  // Which move each of you is doing right now.
  function youPose(b, ph, t) {
    if (spin > 0 || ctx.front === 'done') return POSE.vee;
    if (ctx.question && ctx.typing) return (Math.floor(t * 8) % 2 ? POSE.typeA : POSE.typeB);
    if (ctx.question && ctx.idle > 18 && ctx.cardTime > 18) return lerpPose(POSE.ponder, POSE.ponder.map((v, i) => (i === 0 ? v + 0.05 : v)), ph);
    const move = (b >> 3) % 2;
    const [A, Bp] = move ? [POSE.hustleA, POSE.hustleB] : [POSE.up, POSE.down];
    const [from, to] = b % 2 ? [A, Bp] : [Bp, A];
    return lerpPose(from, to, k.ease.outBack(k.clamp(ph / 0.4)));
  }
  const botPose = (b, ph) => ROBOT[k.hash(`bot${b}`) % ROBOT.length].map((v, i) => (i < 5 && ph < 0.08 ? v * (1 + (0.08 - ph) * 1.2) : v));

  // ── sound: whisper-quiet four-on-the-floor, a record scratch on each new question ─
  const kick = () => {
    k.sfx.tone({ freq: 120, to: 42, dur: 0.16, gain: 0.05, attack: 0.002 });
  };
  const hat = () => k.sfx.noise({ dur: 0.04, filter: 'highpass', freq: 7000, gain: 0.018, attack: 0.001 });
  const scratchFx = () => [0, 0.11].forEach((d, i) => k.sfx.noise({ dur: 0.1, filter: 'bandpass', freq: i ? 2400 : 700, to: i ? 600 : 2600, q: 4, gain: 0.25, delay: d, color: 'pink' }));

  measure();
  cv.resized = (w, h, { dprOnly } = {}) => { if (!dprOnly) return measure(); paintWall(); ticker.dirty = true; };

  const lp = k.loop((dt, t) => {
    const T = k.reduced ? 2.2 : t;
    const bf = T / beatLen;
    const b = Math.floor(bf), ph = (bf - b) * beatLen / beatLen;
    if (b !== lastBeat && dt > 0) {
      lastBeat = b;
      pattern = Math.floor(b / 16) % 6;
      if (ctx.sound && !k.reduced) { kick(); k.after(beatLen * 500, hat); }
    }
    rot += dt * (0.32 + spin * 0.9);
    spin = Math.max(0, spin - dt * 0.8);
    flash = Math.max(0, flash - dt * 1.6);
    celebrate = Math.max(0, celebrate - dt);
    scratch = Math.max(0, scratch - dt);
    for (const [key, v] of steps) v - dt * 1.5 <= 0 ? steps.delete(key) : steps.set(key, v - dt * 1.5);
    const p = k.pointer;
    if (p.active && p.y > L.Fy0 && !k.reduced) { const key = tileAt(p.x, p.y); if (key) steps.set(key, 0.9); }

    c.drawImage(wall, 0, 0, L.vw, wall.height / wall.d);
    floor(b, ph);
    hazeLayer(dt);
    spotsAndBeams(T, b);
    ball(T);
    const rim = PAL[b % PAL.length];
    const youSpin = spin > 0 ? (1 - spin / 1.6) * Math.PI * 4 : 0;
    dancer(L.you, youPose(b, ph, T), { laptop: !!ctx.question && ctx.typing && !spin, flares: true, rim, name: 'you', bob: -Math.abs(Math.sin(ph * Math.PI)) * L.you.h * 0.03, spin: youSpin });
    dancer(L.bot, botPose(b * 2 + (ph > 0.5 ? 1 : 0), ph % 0.5), { robot: true, rim: PAL[(b + 3) % PAL.length], eyes: ph < 0.5 ? '#00e5ff' : '#7cff4f', name: ctx.agent === 'working' ? 'the agent (busy)' : 'the agent', bob: ph < 0.1 ? L.bot.h * 0.015 : 0, spin: youSpin ? -youSpin : 0 });
    marquee(dt, b, ph);
    if (scratch > 0) { // the record scratch: a quick wobble of everything
      c.fillStyle = `rgba(255,255,255,${scratch * 0.12})`;
      c.fillRect(0, 0, L.vw, L.vh);
    }
  }, { still: 2.2 });

  return {
    question() {
      ticker.dirty = true;
      ticker.x = 0;
      if (!k.reduced && ctx.question) { scratch = 0.35; if (ctx.sound) scratchFx(); }
      if (k.reduced) celebrate = 0; // nothing counts it down in a still: the next card starts a fresh song
      lp.redraw();
    },
    layout() { measure(); lp.redraw(); },
    status() { ticker.dirty = true; },
    answer(a) {
      celebrate = 6;
      if (!k.reduced) { spin = 1.6; flash = 1; } // a still keeps the Celebration marquee, not a floor stuck on full
      ticker.dirty = true;
      ticker.x = 0;
      k.burst(L.ball.x, L.ball.y, { n: 60, shape: 'confetti', colors: PAL, speed: 520, gravity: 700 });
      k.sfx.tada({ gain: 0.7 });
      if (a.tookRec) k.sfx.cheer({ gain: 0.4 });
    },
    keystroke() {
      if (k.reduced) return;
      const { x, y } = L.you;
      const key = tileAt(x + k.rand(-30, 30), y + k.rand(-6, 10));
      if (key) steps.set(key, 1);
    },
  };
}
