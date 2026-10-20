// Lava lamp. The whole page is the inside of a lamp: wax blobs heat at the bottom, rise, merge,
// split and sink, colours drifting. Each option is a blob wearing its label, and the ★ one runs
// hotter, so it always rises to the top. Like a real lamp it takes a while to warm up.

const S0 = 5; // field resolution: one sample per S css px…
const CELLS = 52000; // …coarser on big screens, so the field costs about the same everywhere
const WARM = 180; // seconds for the lamp to "fully warm up"

// wax hue, liquid hue: the lamp drifts from one pairing to the next
const PAIRS = [[18, 285], [340, 232], [30, 345], [190, 300], [275, 215]];

const hsl = (h, s, l) => { // → [r, g, b] 0..255
  h = ((h % 360) + 360) % 360 / 360;
  const f = (n) => { const k2 = (n + h * 12) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k2 - 3, 9 - k2, 1)); };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
};

export default function lavaLamp(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  const low = document.createElement('canvas');
  const lc = low.getContext('2d');
  let img, gw, gh, S = S0;
  let topDpr = 0; // the frame-rate watchdog lowers the DPR: coarsen the field with it
  let blobs = [];
  let mood = k.rand(PAIRS.length);
  let wax = 0, sea = 0;
  let back = null, backAt = -9, glassCv = null;
  let rowF = null;
  let heat = 1;
  let tag = null, tagBox = null, gaps = [];

  function grid() {
    topDpr = Math.max(topDpr, cv.dpr);
    S = Math.max(S0, Math.sqrt(cv.w * cv.h / CELLS)) * Math.sqrt(topDpr / cv.dpr);
    gw = Math.ceil(cv.w / S) + 1; gh = Math.ceil(cv.h / S) + 1;
    low.width = gw; low.height = gh;
    img = lc.createImageData(gw, gh);
  }

  const blob = (o) => ({ x: 0, y: 0, r: 60, T: k.rand(), vx: 0, vy: 0, ph: k.rand(6.28), wob: k.rand(0.3, 0.8), label: null, rec: false, ...o });

  function populate() {
    const W = cv.w, H = cv.h;
    const sp = k.space();
    const free = Array.from({ length: Math.round(k.clamp(W * H / 170000, 5, 9)) }, () => blob({ x: k.rand(W), y: k.rand(H * 0.1, H), r: k.rand(38, 95) }));
    blobs = [...free, ...optionBlobs(sp)];
  }

  // Option blobs start in the biggest gap so you meet them, the ★ one already lifting off.
  function optionBlobs(sp) {
    const q = ctx.question;
    const opts = ctx.front === 'question' && q ? q.options.slice(0, 5) : [];
    const g = sp.gaps.find((x) => x.where === 'bottom' && x.h > 90) || sp.gaps[0];
    if (!opts.length || !g) return [];
    const r = k.clamp(Math.min(g.h * 0.32, g.w / (opts.length * 2.4)), 34, 64);
    return opts.map((o, i) => blob({
      x: g.x + g.w * ((i + 0.5) / opts.length), y: g.y + g.h * (o.recommended ? 0.32 : 0.52) + k.rand(-8, 8),
      r: o.recommended ? r * 1.1 : r, T: o.recommended ? 0.7 : 0.35, label: o.label || `Option ${i + 1}`, rec: o.recommended,
    }));
  }

  function relabel() {
    blobs = blobs.filter((b) => !b.label);
    blobs.push(...optionBlobs(k.space()));
  }

  function layout() {
    const sp = k.space();
    gaps = sp.gaps;
    const g = sp.gaps.find((x) => x.where === 'bottom' && x.h >= 70 && x.w >= 260) || sp.gaps.find((x) => x.where === 'top' && x.h >= 56 && x.w >= 260) || sp.gaps.find((x) => x.w >= 240 && x.h >= 56);
    tag = g ? { x: g.x + g.w - 16, y: g.where === 'top' ? g.y + 10 : g.y + g.h - 16, top: g.where === 'top' } : null;
  }

  const lines = () => {
    const q = ctx.question;
    const warm = Math.min(1, ctx.cardTime / WARM);
    if (ctx.front === 'done') { const n = ctx.decisions.length || ctx.answers.length; return ['Fully melted.', `${n} decision${n === 1 ? '' : 's'}, zero rush.`]; }
    if (!q) return [ctx.agent === 'listening' ? 'The agent is listening.' : 'The agent is thinking.', 'So is the wax.'];
    const second = warm >= 1 ? 'Lamp fully warmed up. Are you?' : `Warming up… ${Math.floor(warm * 100)}%`;
    if (!q.options.length) return ['No options. Just vibes.', second];
    if (!q.recommended.length) return ['No ★ this time. Pure lava.', second];
    return ['Tip: the ★ always rises to the top.', second];
  };

  function step(dt, t) {
    const H = cv.h, W = cv.w;
    const warm = 0.55 + 0.45 * Math.min(1, ctx.cardTime / 60);
    for (const b of blobs) {
      const yf = b.y / H;
      if (yf > 0.78) b.T += dt * 0.09 * heat * warm * (b.rec ? 1.8 : 1);
      else b.T -= dt * (0.025 + (1 - yf) * 0.05) * (b.rec ? 0.6 : 1);
      b.T = k.clamp(b.T);
      const target = (0.5 - b.T) * 70 * (1 + (heat - 1) * 0.6) * (60 / b.r) ** 0.3;
      b.vy = k.lerp(b.vy, target, dt * 0.6);
      b.vx = Math.sin(t * 0.17 * b.wob + b.ph) * 9;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -b.r * 0.6) { b.y = -b.r * 0.6; b.T = Math.min(b.T, 0.3); }
      if (b.y > H + b.r * 0.4) { b.y = H + b.r * 0.4; b.T = Math.max(b.T, 0.6); }
      b.x = k.clamp(b.x, -b.r * 0.3, W + b.r * 0.3);
    }
    heat = k.lerp(heat, 1, dt * 0.25);
  }

  function field(t) {
    const d = img.data;
    const top = hsl(wax, 0.95, 0.58), bot = hsl(wax + 25, 1, 0.52);
    const n = blobs.length;
    const bx = new Float32Array(n), by = new Float32Array(n), r2 = new Float32Array(n), dy2 = new Float32Array(n);
    blobs.forEach((b, i) => { bx[i] = b.x; by[i] = b.y; r2[i] = b.r * b.r; });
    // the pools are analytic: a lumpy puddle on the floor and a thin film on the ceiling
    const H = cv.h, floor = new Float32Array(gw), ceil = new Float32Array(gw);
    for (let x = 0; x < gw; x++) {
      const px = x * S;
      floor[x] = H + 34 + Math.sin(px * 0.006 + t * 0.35) * 22 + Math.sin(px * 0.017 - t * 0.21) * 12;
      ceil[x] = -26 + Math.sin(px * 0.009 - t * 0.17) * 10;
    }
    if (!rowF || rowF.length !== gw) rowF = new Float32Array(gw);
    rowF.fill(0);
    let p = 0;
    for (let j = 0; j < gh; j++) {
      const py = j * S;
      for (let i = 0; i < n; i++) dy2[i] = (py - by[i]) ** 2;
      const v = j / gh;
      const cr = top[0] + (bot[0] - top[0]) * v, cg = top[1] + (bot[1] - top[1]) * v, cb = top[2] + (bot[2] - top[2]) * v;
      let prev = 0;
      for (let x = 0; x < gw; x++, p += 4) {
        const px = x * S;
        let f = 0;
        for (let i = 0; i < n; i++) { const dx = px - bx[i]; f += r2[i] / (dx * dx + dy2[i] + 1); }
        const fl = 78 / Math.max(6, floor[x] - py), ce = 34 / Math.max(6, py - ceil[x]);
        f += fl * fl + ce * ce;
        const dy = rowF[x] - f; // > 0 on the underside of a blob, where the bulb lights it
        const dx = x ? f - prev : 0;
        rowF[x] = f;
        prev = f;
        if (f < 0.6) { d[p + 3] = 0; continue; }
        // anti-aliased over one sample whatever the slope, so edges stay crisp when blobs merge
        const a = Math.min(1, Math.max(0, 0.5 + (f - 1) / Math.max(0.02, Math.sqrt(dx * dx + dy * dy))));
        const lit = dy > 0 ? Math.min(1, (dy / f) * 2.5) : 0;
        const l = 0.86 + lit * 0.18 + v * 0.14;
        d[p] = cr * l + lit * 40; d[p + 1] = cg * l + lit * 35; d[p + 2] = cb * l + lit * 25; d[p + 3] = a * 255;
      }
    }
    lc.putImageData(img, 0, 0);
  }

  // the liquid and the bulb glow, at quarter size (it's all gradients), rebuilt as the colours drift
  function liquid() {
    const W = Math.ceil(cv.w / 4), H = Math.ceil(cv.h / 4);
    back ||= document.createElement('canvas');
    if (back.width !== W || back.height !== H) { back.width = W; back.height = H; }
    const g = back.getContext('2d');
    const [r1, g1, b1] = hsl(sea, 0.65, 0.1), [r2, g2, b2] = hsl(sea + 20, 0.75, 0.17);
    const lg = g.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, `rgb(${r1},${g1},${b1})`);
    lg.addColorStop(1, `rgb(${r2},${g2},${b2})`);
    g.fillStyle = lg;
    g.fillRect(0, 0, W, H);
    const [br, bg, bb] = hsl(wax + 20, 1, 0.6);
    const bulb = g.createRadialGradient(W / 2, H + 10, 2, W / 2, H + 10, H * 0.7);
    bulb.addColorStop(0, `rgba(${br},${bg},${bb},.26)`);
    bulb.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
    g.fillStyle = bulb;
    g.fillRect(0, 0, W, H);
  }

  function glass() {
    const W = cv.w, H = cv.h;
    glassCv ||= document.createElement('canvas');
    glassCv.width = Math.ceil(W / 2); glassCv.height = Math.ceil(H / 2);
    const c2 = glassCv.getContext('2d');
    c2.scale(0.5, 0.5);
    for (const [x, w, a] of [[W * 0.04, W * 0.05, 0.08], [W * 0.1, W * 0.012, 0.1], [W * 0.93, W * 0.03, 0.05]]) {
      const g = c2.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c2.fillStyle = g;
      c2.fillRect(x, 0, w, H);
    }
    const v = c2.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
    c2.fillStyle = v;
    c2.fillRect(0, 0, W, H);
  }

  const inGap = (x, y, hw, hh) => gaps.some((g) => x - hw > g.x && x + hw < g.x + g.w && y - hh > g.y && y + hh < g.y + g.h);

  function labels() {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const b of blobs) {
      if (!b.label) continue;
      const w = b.r * 2.6;
      if (tagBox && b.x + w / 2 > tagBox.x && b.x - w / 2 < tagBox.x + tagBox.w && b.y + 20 > tagBox.y && b.y - 20 < tagBox.y + tagBox.h) continue;
      const text = `${b.rec ? '★ ' : ''}${b.label}`;
      const lines = (c.font = k.font(13, 750), k.wrap(c, text, w, 2));
      const lw = Math.max(...lines.map((l) => c.measureText(l).width));
      const show = inGap(b.x, b.y, lw / 2 + 4, lines.length * 8 + 4) ? 1 : 0;
      b.la = k.reduced ? show : k.lerp(b.la ?? show, show, 0.15); // labels fade as blobs slip behind the card
      if (b.la < 0.02) continue;
      c.globalAlpha = b.la;
      c.shadowColor = 'rgba(40,0,20,.6)'; c.shadowBlur = 6;
      c.lineJoin = 'round'; c.lineWidth = 3.5; c.strokeStyle = 'rgba(30,6,20,.7)';
      c.fillStyle = '#fff8f0';
      lines.forEach((l, i) => { const y = b.y + (i - (lines.length - 1) / 2) * 16; c.strokeText(l, b.x, y); c.fillText(l, b.x, y); });
    }
    c.restore();
  }

  function sticker() {
    if (!tag) return;
    const [a, b] = lines();
    const head = `GROOVY DECISION LAMP · MODEL ${ctx.question ? `Q${ctx.question.n}` : ctx.front === 'done' ? 'FIN' : 'Q0'}`;
    c.save();
    const wOf = (t, f) => ((c.font = f), c.measureText(t).width);
    const w = Math.min(Math.max(wOf(a, k.font(13, 750)), wOf(b, k.font(12, 600)), wOf(head, k.font(9, 800))) + 30, 340);
    const h = 58;
    const x = tag.x - w, y = tag.top ? tag.y : tag.y - h;
    tagBox = { x, y, w, h };
    c.translate(x + w / 2, y + h / 2);
    c.rotate(-0.025);
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 10; c.shadowOffsetY = 3;
    c.fillStyle = '#f6ecd6';
    c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 8); c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = '#c9472b'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 5); c.stroke();
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#c9472b';
    c.font = k.font(9, 800);
    c.fillText(head, -w / 2 + 14, -h / 2 + 15);
    c.fillStyle = '#3a1c10';
    c.font = k.font(13, 750);
    c.fillText(k.ellipsize(c, a, w - 28), -w / 2 + 14, 1);
    c.font = k.font(12, 600);
    c.fillStyle = '#6b4a38';
    c.fillText(k.ellipsize(c, b, w - 28), -w / 2 + 14, h / 2 - 14);
    c.restore();
  }

  cv.resized = (w, h, { dprOnly } = {}) => { if (dprOnly) grid(); else { grid(); populate(); layout(); glass(); backAt = -9; } }; // a DPR step only coarsens the field: the blobs stay put
  grid();
  glass();
  populate();
  layout();

  k.loop((dt, t) => {
    mood += dt / 45;
    const i = Math.floor(mood) % PAIRS.length, j = (i + 1) % PAIRS.length, f = k.ease.inOutCubic(mood % 1);
    const mix = (a, b) => a + ((((b - a) % 360) + 540) % 360 - 180) * f; // shortest way round the wheel
    wax = mix(PAIRS[i][0], PAIRS[j][0]);
    sea = mix(PAIRS[i][1], PAIRS[j][1]);
    if (t - backAt > 0.5 || !back) { liquid(); backAt = t; }
    step(dt, t);
    field(t);
    c.imageSmoothingEnabled = true;
    c.drawImage(back, 0, 0, cv.w, cv.h);
    c.drawImage(low, 0, 0, gw * S, gh * S);
    c.drawImage(glassCv, 0, 0, cv.w, cv.h);
    labels();
    sticker();
  }, { still: 0.1 });

  return {
    question() { relabel(); layout(); },
    layout,
    status() {},
    answer() { heat = 2.6; for (const b of blobs) if (b.y > cv.h * 0.5) b.T = Math.min(1, b.T + 0.3); k.sfx.tone({ type: 'sine', freq: 140, to: 70, dur: 0.6, gain: 0.12, vibrato: { rate: 9, depth: 20 } }); },
    typing(on) { if (on) heat = Math.max(heat, 1.4); },
  };
}
