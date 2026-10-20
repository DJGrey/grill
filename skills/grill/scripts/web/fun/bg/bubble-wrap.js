// Bubble wrap over a cardboard box. Click a bubble to pop it, hold and drag to zip through a row.
// The shipping label on the box is this question. One bubble per sheet refuses to pop.

const D = 33; // bubble spacing
const RH = D * 0.866; // hex row height
const R = 11.6; // bubble radius
const CELL = 16.1; // redraw radius per bubble: never reaches a neighbour's
const POP_S = 0.2;
const MILESTONES = {
  10: 'Ten bubbles. Very calming. Very productive.',
  50: '50 bubbles. The question has not answered itself.',
  100: (q) => (q?.recommended[0] ? `100 bubbles. “${clipS(q.recommended[0], 34)}” is still recommended.` : '100 bubbles. The card is still there.'),
  250: '250 bubbles. This counts as research.',
  500: '500 bubbles. Somebody in finance can hear this.',
  1000: '1,000 bubbles. You are the packaging now.',
};
const clipS = (t, n) => (t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`);

export default function bubbleWrap(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  const top = k.canvas(); // floating words: ZIIIP, squeak
  const tc = top.ctx;
  const icon = k.canRender('🫧', 'emoji') ? '🫧' : '🟡';
  const meta = { icon, label: 'Bubbles popped', says: 'popped {n} bubble{s}' };

  let box = null; // cardboard, label and haze, pre-drawn at device resolution
  let cols = 0, rows = 0, x0 = 0, y0 = 0;
  let state, anim, variant; // per bubble: 0 intact, 1 popping, 2 popped / anim clock / sprite variant
  let sprites = null;
  let hover = -1;
  let dud = -1, dudHits = 0;
  let stroke = null; // { n, x, y } while dragging
  const live = new Set(); // bubbles mid-animation
  const refill = new Set(); // popped bubbles waiting for the fresh-sheet wave
  const words = []; // { text, x, y, age, life, size, fill, rot }
  let lastPopSfx = 0;
  let clock = 0;
  let resetting = false;
  let checkedAt = -1e9, checkLater = null; // the fresh-sheet check, at most every 500ms
  let unscored = 0; // pops not yet added to the score: written once per frame
  let boxAt = ''; // the gaps the box was drawn for
  const gapsKey = () => k.space().gaps.map((g) => `${g.where}${Math.round(g.x)},${Math.round(g.y)},${Math.round(g.w)},${Math.round(g.h)}`).join('|');

  // ── sprites ──────────────────────────────────────────────────────────────

  function sprite(draw) {
    const s = document.createElement('canvas');
    s.width = s.height = Math.ceil(CELL * 2 * cv.dpr);
    const g = s.getContext('2d');
    g.scale(cv.dpr, cv.dpr);
    g.translate(CELL, CELL);
    draw(g);
    return s;
  }

  function intact(g, glow = 0) {
    g.fillStyle = 'rgba(70,40,10,.2)'; // shadow on the cardboard
    g.filter = 'blur(1.8px)';
    g.beginPath();
    g.ellipse(1.8, 2.8, R * 0.96, R * 0.88, 0, 0, Math.PI * 2);
    g.fill();
    g.filter = 'none';
    const lens = g.createRadialGradient(R * 0.25, R * 0.3, 0, R * 0.25, R * 0.3, R * 0.7); // light focused through the dome
    lens.addColorStop(0, `rgba(255,248,225,${0.32 + glow})`);
    lens.addColorStop(1, 'rgba(255,248,225,0)');
    const body = g.createRadialGradient(-1.5, -2, 1, 0, 0, R);
    body.addColorStop(0, `rgba(255,255,255,${0.05 + glow * 0.5})`);
    body.addColorStop(0.7, `rgba(240,246,255,${0.1 + glow * 0.5})`);
    body.addColorStop(0.93, `rgba(255,255,255,${0.34 + glow})`);
    body.addColorStop(1, 'rgba(255,255,255,.18)');
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fillStyle = body;
    g.fill();
    g.fillStyle = lens;
    g.fill();
    g.strokeStyle = 'rgba(70,50,30,.18)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.arc(0.3, 0.3, R - 0.2, -0.2, Math.PI * 0.75);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.7)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.arc(0, 0, R - 1.2, Math.PI * 1.02, Math.PI * 1.6);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,.95)'; // specular
    g.beginPath();
    g.ellipse(-R * 0.36, -R * 0.44, R * 0.25, R * 0.13, -0.7, 0, Math.PI * 2);
    g.fill();
  }

  function popped(g, r) {
    const n = 11;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + r.rand(-0.15, 0.15);
      const d = R * r.rand(0.78, 1.04);
      return [Math.cos(a) * d, Math.sin(a) * d * 0.94];
    });
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = 'rgba(255,255,255,.1)';
    g.fill();
    g.strokeStyle = 'rgba(70,45,20,.18)';
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = 0.9;
    g.stroke();
    g.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) { // creases
      const a = r.rand(Math.PI * 2), b = a + r.rand(1.6, 3.2);
      const ra = R * r.rand(0.3, 0.9), rb = R * r.rand(0.3, 0.9);
      g.strokeStyle = i % 2 ? 'rgba(80,55,25,.22)' : 'rgba(255,255,255,.45)';
      g.beginPath();
      g.moveTo(Math.cos(a) * ra, Math.sin(a) * ra);
      g.quadraticCurveTo(r.rand(-3, 3), r.rand(-3, 3), Math.cos(b) * rb, Math.sin(b) * rb);
      g.stroke();
    }
    const t = r.rand(Math.PI * 2); // the tear
    g.strokeStyle = 'rgba(60,40,20,.35)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(Math.cos(t) * R * 0.95, Math.sin(t) * R * 0.95);
    g.lineTo(Math.cos(t + 0.25) * R * 0.55, Math.sin(t + 0.25) * R * 0.55);
    g.lineTo(Math.cos(t + 0.5) * R * 0.9, Math.sin(t + 0.5) * R * 0.9);
    g.stroke();
  }

  function makeSprites() {
    const r = k.rng(7);
    sprites = {
      intact: sprite((g) => intact(g)),
      hover: sprite((g) => intact(g, 0.14)),
      popped: Array.from({ length: 6 }, () => sprite((g) => popped(g, r))),
    };
  }

  // ── the box underneath ─────────────────────────────────────────────────

  function stamp(g, text, x, y, size, rot, color = 'rgba(196,30,30,.78)') {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.font = k.font(size, 900, 'display');
    const w = g.measureText(text).width;
    g.strokeStyle = color;
    g.lineWidth = Math.max(2, size * 0.09);
    g.strokeRect(-w / 2 - size * 0.35, -size * 0.72, w + size * 0.7, size * 1.4);
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 0, size * 0.04);
    g.globalCompositeOperation = 'destination-out'; // worn ink
    const r = k.rng(text);
    for (let i = 0; i < size * 3; i++) {
      g.globalAlpha = r.rand(0.2, 0.7);
      g.fillRect(r.rand(-w / 2 - size * 0.4, w / 2 + size * 0.4), r.rand(-size * 0.75, size * 0.75), r.rand(1, 4), r.rand(1, 2));
    }
    g.restore();
  }

  function arrows(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(40,24,10,.55)';
    for (const dx of [-s * 0.7, s * 0.7]) {
      g.beginPath();
      g.moveTo(dx, -s);
      g.lineTo(dx + s * 0.5, -s * 0.35);
      g.lineTo(dx + s * 0.18, -s * 0.35);
      g.lineTo(dx + s * 0.18, s * 0.6);
      g.lineTo(dx - s * 0.18, s * 0.6);
      g.lineTo(dx - s * 0.18, -s * 0.35);
      g.lineTo(dx - s * 0.5, -s * 0.35);
      g.fill();
    }
    g.fillRect(-s * 1.2, s * 0.8, s * 2.4, s * 0.16);
    g.font = k.font(s * 0.42, 800, 'sans');
    g.textAlign = 'center';
    g.fillText('THIS WAY UP', 0, s * 1.5);
    g.restore();
  }

  function labelLines() {
    const q = ctx.question;
    if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      return { from: 'the agent', to: 'you, finally', contents: n ? `${n} decision${n === 1 ? '' : 's'}, none broken` : 'Every decision, none broken', care: 'Ship it', note: 'Signed for by: you', stamp: 'DELIVERED', ok: true, track: 'GRL-DONE' };
    }
    if (!q) return { from: 'the agent', to: 'you', contents: 'The next question (still being packed)', care: ctx.agent === 'listening' ? 'Agent is listening' : 'Out for delivery', note: 'Do not shake. Agent inside.', stamp: 'IN TRANSIT', track: 'GRL-WAIT' };
    const rec = q.recommended[0];
    return {
      from: `Question ${q.n} of ${q.total}`,
      to: 'future you',
      contents: q.title,
      care: rec ? `★ ${rec}` : q.options.length ? 'No recommendation. Good luck.' : 'No options. Write your own.',
      note: q.options.length > 2 ? `${q.options.length} options. Contents may settle.` : 'Contents may settle while you decide.',
      stamp: 'FRAGILE',
      track: `GRL-${q.n}/${q.total}-${(k.hash(q.id) % 9000) + 1000}`,
    };
  }

  // The label grows to fit what's on it, dropping the least useful rows when the gap is small.
  function drawLabel(g, cx, cy, w, maxH, rot) {
    const L = labelLines();
    const r = k.rng(L.track);
    const tw = w - 92;
    g.font = k.font(13, 750, 'sans');
    const contents = k.wrap(g, L.contents, tw, 3);
    const want = [['FROM', L.from, 3], ['TO', L.to, 4], ['CONTENTS', L.contents, 0], ['HANDLE AS', L.care, 1], ['NOTE', L.note, 5]];
    const bar = maxH > 170 ? 46 : 30;
    const cost = (rows) => 24 + 16 + bar + rows.reduce((n, [key]) => n + 21 + (key === 'CONTENTS' ? (Math.min(contents.length, rows.cl) - 1) * 16 : 0), 0);
    let rows = want.slice();
    rows.cl = 3;
    while (rows.length > 1 && cost(rows) > maxH) {
      if (rows.cl > 1 && rows.length <= 4) { rows.cl--; continue; }
      const drop = rows.reduce((m, x) => (x[2] > m[2] ? x : m));
      rows = Object.assign(rows.filter((x) => x !== drop), { cl: rows.cl });
    }
    if (cost(rows) > maxH) return false;
    const h = cost(rows);
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.shadowColor = 'rgba(50,25,5,.35)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 3;
    g.fillStyle = '#fbf8ef';
    g.fillRect(-w / 2, -h / 2, w, h);
    g.shadowColor = 'transparent';
    g.fillStyle = '#1b1b1b';
    g.fillRect(-w / 2, -h / 2, w, 24);
    g.fillStyle = '#fff';
    g.font = k.font(12, 800, 'sans');
    g.textBaseline = 'middle';
    g.fillText('PRIORITY · HANDLE WITH CARE', -w / 2 + 10, -h / 2 + 12.5);
    g.textAlign = 'right';
    g.fillText(ctx.front === 'question' ? `${ctx.question.n}/${ctx.question.total}` : ctx.front === 'done' ? '✓' : '?', w / 2 - 10, -h / 2 + 12.5);
    g.textAlign = 'left';
    let y = -h / 2 + 42;
    for (const [key, v] of rows) {
      g.fillStyle = '#7a7466';
      g.font = k.font(9.5, 800, 'sans');
      g.fillText(key, -w / 2 + 12, y);
      g.fillStyle = '#1b1b1b';
      const big = key === 'CONTENTS';
      g.font = k.font(big ? 13 : 12.5, big ? 750 : 600, 'sans');
      const ls = k.wrap(g, v, tw, big ? rows.cl : 1);
      ls.forEach((l, i) => g.fillText(l, -w / 2 + 80, y + i * 16));
      y += 21 + (ls.length - 1) * 16;
    }
    const bh = bar - 26;
    const by = h / 2 - bar + 6; // barcode
    let bx = -w / 2 + 12;
    g.fillStyle = '#111';
    while (bx < w / 2 - 12) {
      const bw = r.pick([1, 1, 2, 3]);
      if (r.chance(0.62)) g.fillRect(bx, by, bw, bh);
      bx += bw + r.pick([1, 1, 2]);
    }
    g.font = k.font(9, 600, 'mono');
    g.fillText(L.track, -w / 2 + 12, by + bh + 9);
    stamp(g, L.stamp, w / 2 - 66, h / 2 - bar / 2 - 6, 17, -0.16, L.ok ? 'rgba(20,130,60,.8)' : 'rgba(196,30,30,.8)');
    g.restore();
    return true;
  }

  function buildBox() {
    const W = cv.w, H = cv.h;
    box = document.createElement('canvas');
    box.dpr = cv.dpr; // cell() reads it back with source-rect maths
    box.width = Math.round(W * cv.dpr);
    box.height = Math.round(H * cv.dpr);
    const g = box.getContext('2d');
    g.scale(cv.dpr, cv.dpr);
    const base = g.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, '#cf9f66');
    base.addColorStop(0.5, '#c3925a');
    base.addColorStop(1, '#b6844d');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 7) { // corrugation showing through the liner
      g.fillStyle = `rgba(90,55,20,${0.035 + (x % 14 ? 0 : 0.02)})`;
      g.fillRect(x, 0, 3, H);
    }
    const r = k.rng(3);
    for (let i = 0; i < W * H / 180; i++) { // fibres
      g.fillStyle = r.chance(0.5) ? 'rgba(255,230,190,.07)' : 'rgba(70,40,10,.07)';
      g.fillRect(r.rand(W), r.rand(H), r.rand(1, 5), 1);
    }
    const tapeY = H * 0.32; // packing tape
    g.save();
    g.translate(0, tapeY);
    g.rotate(-0.06);
    g.fillStyle = 'rgba(176,120,52,.55)';
    g.fillRect(-50, -36, W + 200, 72);
    g.fillStyle = 'rgba(255,240,210,.12)';
    g.fillRect(-50, -36, W + 200, 10);
    g.strokeStyle = 'rgba(90,50,10,.18)';
    for (let x = -50; x < W + 150; x += 23) { g.beginPath(); g.moveTo(x, -36); g.lineTo(x + r.rand(-6, 6), 36); g.stroke(); }
    g.restore();

    const sp = k.space();
    boxAt = gapsKey();
    const gap = sp.gaps.find((x) => x.where !== 'top' && x.w > 300 && x.h > 110) || sp.gaps.find((x) => x.w > 300 && x.h > 110);
    if (gap) {
      const w = Math.min(340, gap.w - 60);
      const ok = drawLabel(g, gap.x + gap.w / 2, gap.y + gap.h / 2 - 4, w, Math.min(gap.h - 24, 230), -0.025);
      if (ok && gap.w > w + 300) {
        stamp(g, 'FRAGILE', gap.x + Math.max(110, (gap.w - w) / 4), gap.y + gap.h / 2 - 6, 30, -0.14);
        arrows(g, gap.x + gap.w - Math.max(90, (gap.w - w) / 4), gap.y + gap.h / 2, 26);
      }
    }
    const tg = sp.gaps.find((x) => x.where === 'top' && x.h > 50);
    if (tg && tg.w > 360) stamp(g, ctx.front === 'done' ? 'NO DECISIONS WERE HARMED' : 'DO NOT DROP. DECISIONS INSIDE.', tg.x + tg.w * 0.5, tg.y + tg.h * 0.45, 15, 0.02, 'rgba(40,24,10,.5)');
    g.fillStyle = 'rgba(255,255,255,.07)'; // the plastic's haze
    g.fillRect(0, 0, W, H);
  }

  // ── the sheet ───────────────────────────────────────────────────────────

  function grid() {
    x0 = -k.rand(0, D);
    y0 = -k.rand(0, RH);
    cols = Math.ceil(cv.w / D) + 2;
    rows = Math.ceil(cv.h / RH) + 2;
    const n = cols * rows;
    state = new Uint8Array(n);
    anim = new Float32Array(n);
    variant = Uint8Array.from({ length: n }, () => k.int(0, 5));
    for (let i = 0; i < n; i++) if (k.chance(0.025)) state[i] = 2; // someone's been here
    pickDud();
  }

  const pos = (i) => {
    const row = (i / cols) | 0, col = i % cols;
    return [x0 + col * D + (row & 1 ? D / 2 : 0), y0 + row * RH];
  };

  function at(x, y) {
    const row0 = Math.round((y - y0) / RH);
    let best = -1, bd = R + 3;
    for (let row = row0 - 1; row <= row0 + 1; row++) {
      if (row < 0 || row >= rows) continue;
      const col = Math.round((x - x0 - (row & 1 ? D / 2 : 0)) / D);
      if (col < 0 || col >= cols) continue;
      const i = row * cols + col;
      const [bx, by] = pos(i);
      const d = Math.hypot(bx - x, by - y);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function visible(i, gaps) { // in the clickable stage, not under the card or a panel
    const row = (i / cols) | 0;
    const x = x0 + (i % cols) * D + (row & 1 ? D / 2 : 0), y = y0 + row * RH;
    for (const g of gaps) if (x > g.x + 6 && x < g.x + g.w - 6 && y > g.y + 6 && y < g.y + g.h - 6) return true;
    return false;
  }

  function pickDud() {
    const sp = k.space();
    const g = sp.gaps[0];
    dud = g ? at(g.x + g.w * k.rand(0.2, 0.8), g.y + g.h * k.rand(0.25, 0.75)) : -1;
    if (dud >= 0) state[dud] = 0;
    dudHits = 0;
  }

  function cell(i, scale = 1, sx = 1) {
    const [x, y] = pos(i);
    const d = box.dpr;
    c.save();
    c.beginPath();
    c.arc(x, y, CELL, 0, Math.PI * 2);
    c.clip();
    c.drawImage(box, (x - CELL) * d, (y - CELL) * d, CELL * 2 * d, CELL * 2 * d, x - CELL, y - CELL, CELL * 2, CELL * 2);
    const s = state[i] === 2 || (state[i] === 1 && anim[i] > 0.4) ? sprites.popped[variant[i]] : i === hover ? sprites.hover : sprites.intact;
    c.translate(x, y);
    c.scale(scale * sx, scale / sx);
    c.drawImage(s, -CELL, -CELL, CELL * 2, CELL * 2);
    c.restore();
  }

  function full() {
    c.drawImage(box, 0, 0, cv.w, cv.h);
    for (let i = 0; i < state.length; i++) {
      const [x, y] = pos(i);
      if (x < -CELL || y < -CELL || x > cv.w + CELL || y > cv.h + CELL) continue;
      const s = state[i] ? sprites.popped[variant[i]] : sprites.intact;
      c.drawImage(s, x - CELL, y - CELL, CELL * 2, CELL * 2);
    }
  }

  function rebuild() {
    makeSprites();
    buildBox();
    full();
  }

  // ── popping ────────────────────────────────────────────────────────────

  function say(text, x, y, o = {}) {
    if (k.reduced) return; // they float off: a still frame would pile them up
    words.push({ text, x, y, age: 0, life: o.life ?? 0.8, size: o.size ?? 22, fill: o.fill ?? '#fff', rot: o.rot ?? k.rand(-0.2, 0.2), rise: o.rise ?? 34 });
  }

  function pop(i, { quiet = false, by = 'you' } = {}) {
    if (i < 0 || state[i]) return false;
    const [x, y] = pos(i);
    if (i === dud && by === 'you' && dudHits < 3) {
      dudHits++;
      anim[i] = 0;
      if (!k.reduced) live.add(i);
      k.sfx.boing({ pitch: 2.2 + dudHits * 0.3, gain: 0.35 });
      if (dudHits < 3) {
        say(['squeak', 'nope', 'NOT TODAY'][dudHits - 1], x, y - 18, { fill: '#fff6d8', size: 15 + dudHits * 3 });
        return false;
      }
    }
    const big = i === dud && dudHits >= 3;
    state[i] = k.reduced ? 2 : 1;
    anim[i] = 0;
    if (k.reduced) cell(i); else live.add(i);
    if (!quiet || clock - lastPopSfx > 0.03) {
      lastPopSfx = clock;
      k.sfx.pop({ pitch: big ? 0.55 : k.rand(0.82, 1.3), gain: big ? 1.4 : quiet ? 0.35 : 0.8, pan: (x / cv.w) * 1.4 - 0.7 });
    }
    k.burst(x, y, { shape: 'dot', n: big ? 26 : 5, colors: ['rgba(255,255,255,.75)', 'rgba(230,240,255,.6)'], speed: big ? 300 : 90, gravity: -30, drag: 4, size: big ? 7 : 4, life: big ? 0.9 : 0.45, grow: true });
    if (big) {
      dud = -1;
      say('POP!', x, y - 26, { fill: '#ffd23f', size: 40, life: 1.1, rise: 50 });
      k.toast('The stubborn bubble finally popped. Respect.', { icon });
      k.score('stubborn', 1); // no HUD or done line: achievements listens for it
    }
    if (by === 'you') {
      if (!unscored++) k.after(16, addScore); // a fast drag pops dozens per frame: one write for them all
      if (stroke) {
        stroke.n++;
        if (stroke.n === 8 || (stroke.n > 8 && stroke.n % 6 === 2)) say(`Z${'I'.repeat(Math.min(14, stroke.n / 2))}P!`, x, y - 22, { fill: '#ffe066', size: 20 + Math.min(14, stroke.n / 2), rise: 46 });
      }
      maybeFresh();
    }
    return true;
  }

  function addScore() {
    const n = unscored;
    unscored = 0;
    const total = k.score('bubbles', n, meta);
    const m = Object.keys(MILESTONES).filter((at) => at > total - n && at <= total).map((at) => MILESTONES[at]).pop();
    if (m) k.toast(typeof m === 'function' ? m(ctx.question) : m, { icon });
  }

  // Most of the clickable bubbles gone: a fresh sheet re-inflates in a wave.
  function maybeFresh() {
    if (resetting || checkLater) return;
    const wait = checkedAt + 500 - performance.now();
    if (wait > 0) { checkLater = k.after(wait, () => { checkLater = null; maybeFresh(); }); return; }
    checkedAt = performance.now();
    let n = 0, done = 0;
    const { gaps } = k.space();
    for (let i = 0; i < state.length; i++) {
      if (!visible(i, gaps)) continue;
      n++;
      if (state[i]) done++;
    }
    if (n && done / n < 0.72) return;
    resetting = 'pending';
    if (!stroke) fresh(); // mid-drag, it waits for the button to come up
  }

  function fresh() {
    resetting = 'running';
    k.after(600, async () => {
      k.toast('Fresh sheet. Pop responsibly.', { icon: '📦' });
      k.sfx.whoosh({ pitch: 0.7, gain: 0.5 });
      const order = [...state.keys()].filter((i) => state[i]).sort((a, b) => pos(a)[0] - pos(b)[0]);
      if (k.reduced) { order.forEach((i) => { state[i] = 0; }); pickDud(); full(); resetting = false; return; }
      for (const i of order) { anim[i] = -(pos(i)[0] / cv.w) * 0.9; live.add(i); refill.add(i); } // negative clock: wait for the wave
      await k.wait(1500);
      pickDud();
      resetting = false;
    });
  }

  function hit(e) {
    const i = at(e.clientX, e.clientY);
    if (i !== hover) {
      const old = hover;
      hover = state[i] ? -1 : i;
      if (old >= 0 && !live.has(old)) cell(old);
      if (hover >= 0 && !live.has(hover)) cell(hover);
    }
    return i;
  }

  k.on(k.root, 'pointerdown', (e) => {
    if (e.button !== 0) return;
    stroke = { n: 0, x: e.clientX, y: e.clientY };
    pop(hit(e));
  });
  k.on(k.root, 'pointermove', (e) => {
    const i = hit(e);
    if (!stroke || !(e.buttons & 1)) return;
    const { x, y } = stroke; // a fast drag still pops everything it ran over
    const steps = Math.ceil(Math.hypot(e.clientX - x, e.clientY - y) / 8);
    for (let s = 1; s < steps; s++) pop(at(x + ((e.clientX - x) * s) / steps, y + ((e.clientY - y) * s) / steps));
    pop(i);
    Object.assign(stroke, { x: e.clientX, y: e.clientY });
  });
  k.on(window, 'pointerup', () => {
    if (stroke && resetting === 'pending') fresh();
    if (stroke?.n >= 8) say(`×${stroke.n}`, k.pointer.x, k.pointer.y - 40, { fill: '#fff', size: 26, rise: 30, life: 0.9 });
    stroke = null;
  });
  k.on(k.root, 'pointerleave', () => {
    const old = hover;
    hover = -1;
    if (old >= 0 && !live.has(old)) cell(old);
  });

  cv.resized = (w, h, { dprOnly } = {}) => {
    if (!dprOnly) { // a DPR step keeps the sheet: same bubbles, same pops
      grid();
      live.clear(); // a new sheet: the old indices mean nothing now
      refill.clear();
      hover = -1;
    }
    rebuild();
    for (const i of live) cell(i);
    if (hover >= 0 && !live.has(hover)) cell(hover);
  };
  cv.resized();

  k.loop((dt) => {
    clock += dt;
    for (const i of live) {
      anim[i] += dt;
      const t = anim[i];
      if (t < 0) continue; // waiting for the refill wave
      if (refill.delete(i)) { state[i] = 0; anim[i] = 0; } // plastic puffs back up
      if (state[i] === 1) { // pop: swell, then collapse into crinkled plastic with a wobble
        const p = t / POP_S;
        if (p >= 1) { state[i] = 2; live.delete(i); cell(i); continue; }
        cell(i, p < 0.4 ? 1 + k.ease.outQuad(p / 0.4) * 0.16 : 1.16 - k.ease.outBack((p - 0.4) / 0.6) * 0.16);
      } else if (state[i] === 0) {
        const p = t / 0.45;
        if (p >= 1) { live.delete(i); cell(i); continue; }
        if (i === dud && dudHits) cell(i, 1, 1 + Math.sin(p * 18) * 0.14 * (1 - p)); // the dud jiggles
        else cell(i, 0.4 + k.ease.outBack(p) * 0.6);
      }
    }
    tc.clearRect(0, 0, top.w, top.h);
    for (let j = words.length - 1; j >= 0; j--) {
      const w = words[j];
      w.age += dt;
      const p = w.age / w.life;
      if (p >= 1) { words.splice(j, 1); continue; }
      tc.save();
      tc.translate(w.x, w.y - k.ease.outCubic(p) * w.rise);
      tc.rotate(w.rot);
      const s = 0.5 + k.ease.outBack(Math.min(1, w.age / 0.16)) * 0.5;
      tc.scale(s, s);
      tc.globalAlpha = Math.min(1, (1 - p) * 2.5);
      tc.font = k.font(w.size, 900, 'display');
      tc.textAlign = 'center';
      tc.textBaseline = 'middle';
      tc.lineJoin = 'round';
      tc.lineWidth = w.size * 0.2;
      tc.strokeStyle = '#3a2410';
      tc.strokeText(w.text, 0, 0);
      tc.fillStyle = w.fill;
      tc.fillText(w.text, 0, 0);
      tc.restore();
    }
  }, { still: 0 });

  const relabel = () => { buildBox(); full(); for (const i of live) cell(i); };

  return {
    question() {
      if (k.reduced) relabel(); else k.after(450, relabel);
    },
    status() { if (!ctx.question) relabel(); },
    layout() { if (gapsKey() !== boxAt) relabel(); }, // the stage stopping scrolling moves nothing: keep the box
    decisions() { if (ctx.front === 'done') relabel(); },
    // The sheet applauds: a ripple of pops spreading out from under the card.
    answer() {
      const sp = k.space();
      const cx = sp.card ? sp.card.x + sp.card.width / 2 : cv.w / 2;
      const cy = sp.card ? sp.card.bottom : cv.h / 2;
      const far = Math.hypot(cv.w, cv.h);
      for (let i = 0; i < state.length; i++) {
        if (state[i] || i === dud || !k.chance(0.33) || !visible(i, sp.gaps)) continue;
        const [x, y] = pos(i);
        const d = Math.min(1, (Math.hypot(x - cx, y - cy) / far) * 2.2);
        if (k.reduced) { state[i] = 2; continue; }
        k.after(d * 1100 + k.rand(0, 120), () => pop(i, { quiet: true, by: 'sheet' }));
      }
      if (k.reduced) full();
    },
  };
}
