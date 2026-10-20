// Ouija board. The planchette drifts over the letters and slowly spells the recommended option,
// then YES. Between questions the spirits have opinions of their own.

const ROW1 = 'ABCDEFGHIJKLM';
const ROW2 = 'NOPQRSTUVWXYZ';
const NUMS = '1234567890';
const BW = 1000, BH = 480; // board layout units, scaled into the biggest visible gap
const INK = '#2a170b';
const GLOW = '#d8fff0';
const QUIPS = ['TRUST THE STAR', 'PICK IT', 'BOO', 'SHIP IT', 'WE ARE WATCHING', 'IT IS ALWAYS DNS', 'I DIED FOR THIS', 'NOT THE WEBHOOK', 'ASK THE INTERN', 'HELLO FROM 1987', 'THE STAR KNOWS', 'DO NOT REFACTOR'];
const MAX = 26; // letters the spirits will spell before they get bored

export default function ouija(k, ctx) {
  const base = k.canvas({ alpha: false });
  const cv = k.canvas();
  const b = base.ctx;
  let c = cv.ctx;
  const spots = new Map(); // key → { x, y, size, rot } in screen px
  let L = null; // { ox, oy, s, cx, cy }
  let scribe = { x: 0, y: 0, w: 0 }; // where "the spirits say" goes
  const pl = { x: 0, y: 0, rot: 0, lift: 0, vx: 0, vy: 0, on: null };
  let queue = [];
  let act = null;
  let said = []; // transcript letters { ch, at }
  let saidFade = 1;
  let time = 0;
  let gust = 0;
  let answeredAt = -9;
  let quipBag = [];
  let fog = [];
  let blob = null;
  let shadow = null;

  // ── the board ──────────────────────────────────────────────────────────────

  function layout() {
    const sp = k.space();
    const top = sp.gaps.find((g) => g.where === 'top' && g.h >= 34);
    const gap = sp.gaps.find((g) => g !== top && g.w >= 220 && g.h >= 110) || sp.gaps[0] || { x: 0, y: 0, w: sp.vw, h: sp.vh };
    const pad = 14;
    const room = top ? { ...gap, h: gap.h - 20 } : { ...gap, y: gap.y + 34, h: gap.h - 54 };
    const s = Math.min((room.w - pad * 2) / BW, (room.h - pad) / BH, 0.95);
    scribe = top
      ? { x: top.x + top.w / 2, y: top.y + top.h / 2 + 2, w: top.w - 40 }
      : { x: gap.x + gap.w / 2, y: gap.y + 20, w: gap.w - 40 };
    spots.clear();
    if (s < 0.4 && room.h >= 64 && room.w >= 360) compact(sp, gap, { ...room, y: room.y + 8, h: room.h - 8 });
    else full(sp, gap, room, s, pad);
    paint();
    if (!pl.x) Object.assign(pl, { x: L.cx, y: spots.get('REST').y });
  }

  function full(sp, gap, room, s, pad) {
    const ox = room.x + (room.w - BW * s) / 2;
    const oy = room.y + Math.max(pad * 0.6, (room.h - BH * s) / 2);
    L = { ox, oy, s, stage: sp.stage, gap, cx: ox + BW / 2 * s, pivot: oy + 1400 * s };
    const P = (x, y) => [ox + x * s, oy + y * s];
    const arc = (row, r, x0, x1, yTop) => [...row].forEach((ch, i) => {
      const x = x0 + (x1 - x0) * (i / (row.length - 1));
      const th = Math.asin((x - 500) / r);
      const [sx, sy] = P(x, yTop + r * (1 - Math.cos(th)));
      spots.set(ch, { x: sx, y: sy, size: 50 * s, rot: th * 0.9, ch });
    });
    arc(ROW1, 1300, 82, 918, 165);
    arc(ROW2, 1100, 128, 872, 268);
    [...NUMS].forEach((ch, i) => { const [x, y] = P(270 + i * 51, 368); spots.set(ch, { x, y, size: 36 * s, rot: 0, ch }); });
    const [yx, yy] = P(205, 62), [nx, ny] = P(795, 62), [gx, gy] = P(500, 438);
    spots.set('YES', { x: yx, y: yy, size: 46 * s, rot: 0, ch: 'YES' });
    spots.set('NO', { x: nx, y: ny, size: 46 * s, rot: 0, ch: 'NO' });
    spots.set('BYE', { x: gx, y: gy, size: 40 * s, rot: 0, ch: 'GOOD BYE' });
    spots.set('REST', { x: L.cx, y: oy + 250 * s });
  }

  // A short gap (a tall card): the board as straight rows, so the letters stay big enough to read.
  function compact(sp, gap, room) {
    const rows3 = room.h >= 150;
    const rh = (room.h - 10) / (rows3 ? 3 : 2);
    const cw = Math.min((room.w - 40) / 16.5, rh * 1.15);
    const size = Math.min(rh * 0.62, cw * 0.8);
    const y0 = room.y + (room.h - rh * (rows3 ? 3 : 2)) / 2 + rh / 2;
    const cx = room.x + room.w / 2;
    const s = size / 50;
    L = { ox: cx - cw * 8.25, oy: y0 - rh / 2, s, stage: sp.stage, gap, cx, pivot: y0 + rh * 14, compact: true };
    const row = (items, y) => {
      const total = items.reduce((a, [, w]) => a + w, 0);
      let x = cx - (total * cw) / 2;
      for (const [key, w, label] of items) {
        spots.set(key, { x: x + (w * cw) / 2, y, size: label.length > 1 ? size * 0.8 : size, rot: 0, ch: label });
        x += w * cw;
      }
    };
    row([['YES', 2.2, 'YES'], ...[...ROW1].map((ch) => [ch, 1, ch]), ['NO', 1.6, 'NO']], y0);
    row([...[...ROW2].map((ch) => [ch, 1, ch]), ['BYE', rows3 ? 1 : 3.6, rows3 ? '' : 'GOOD BYE']], y0 + rh);
    if (rows3) row([...[...NUMS].map((ch) => [ch, 1, ch]), ['BYE', 4, 'GOOD BYE']], y0 + rh * 2);
    spots.set('REST', { x: cx, y: y0 + rh * 0.5 });
  }

  // the table, the board and its printing, pre-drawn once per layout
  function paint() {
    const W = base.w, H = base.h;
    const r = k.rng('ouija');
    b.fillStyle = '#140b06';
    b.fillRect(0, 0, W, H);
    grain(b, 0, 0, W, H, r, 'rgba(255,190,120,', 0.035, 60);
    const st = L.stage;
    const bx = st.x + 12, by = st.y - 40, bw = st.width - 24, bh = st.height + 28;
    b.save();
    b.shadowColor = 'rgba(0,0,0,.7)';
    b.shadowBlur = 40;
    b.shadowOffsetY = 12;
    b.beginPath();
    b.roundRect(bx, by, bw, bh, 22);
    const g = b.createLinearGradient(bx, by, bx + bw * 0.4, by + bh);
    g.addColorStop(0, '#d9b47a');
    g.addColorStop(0.5, '#c79a5c');
    g.addColorStop(1, '#a87640');
    b.fillStyle = g;
    b.fill();
    b.restore();
    b.save();
    b.beginPath();
    b.roundRect(bx, by, bw, bh, 22);
    b.clip();
    grain(b, bx, by, bw, bh, r, 'rgba(90,45,10,', 0.13, Math.round(bh / 7));
    const v = b.createRadialGradient(L.cx, by + bh * 0.62, Math.min(bw, bh) * 0.25, L.cx, by + bh * 0.55, Math.max(bw, bh) * 0.8);
    v.addColorStop(0, 'rgba(255,230,180,.18)');
    v.addColorStop(0.6, 'rgba(60,25,5,.05)');
    v.addColorStop(1, 'rgba(40,15,0,.6)');
    b.fillStyle = v;
    b.fillRect(bx, by, bw, bh);
    b.restore();
    b.strokeStyle = 'rgba(42,23,11,.75)';
    b.lineWidth = 2.5;
    b.beginPath(); b.roundRect(bx + 10, by + 10, bw - 20, bh - 20, 14); b.stroke();
    b.lineWidth = 1;
    b.beginPath(); b.roundRect(bx + 16, by + 16, bw - 32, bh - 32, 10); b.stroke();
    for (const [x, y] of [[bx + 16, by + 16], [bx + bw - 16, by + 16], [bx + 16, by + bh - 16], [bx + bw - 16, by + bh - 16]]) flourish(b, x, y, 7);
    printing();
  }

  function grain(g, x, y, w, h, r, rgba, alpha, n) {
    g.save();
    for (let i = 0; i < n; i++) {
      const yy = y + r.rand(0, h);
      const amp = r.rand(2, 10), freq = r.rand(0.002, 0.008), ph = r.rand(0, 6);
      g.strokeStyle = `${rgba}${(alpha * r.rand(0.3, 1)).toFixed(3)})`;
      g.lineWidth = r.rand(0.5, 2.4);
      g.beginPath();
      for (let xx = x - 10; xx <= x + w + 40; xx += 30) {
        const yv = yy + Math.sin(xx * freq + ph) * amp + Math.sin(xx * freq * 3.7 + ph) * amp * 0.25;
        xx === x - 10 ? g.moveTo(xx, yv) : g.lineTo(xx, yv);
      }
      g.stroke();
    }
    g.restore();
  }

  function flourish(g, x, y, s) {
    g.save();
    g.translate(x, y);
    g.fillStyle = INK;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? s * 0.35 : s;
      g.lineTo(Math.cos(i * Math.PI / 4) * rr, Math.sin(i * Math.PI / 4) * rr);
    }
    g.fill();
    g.restore();
  }

  function engrave(g, text, x, y, size, rot = 0, family = 'serif', weight = 700) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.font = k.font(size, weight, family);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,235,200,.35)';
    g.fillText(text, 0.8, 1.2);
    g.fillStyle = INK;
    g.fillText(text, 0, 0);
    g.restore();
  }

  function printing() {
    const { s, ox, oy } = L;
    if (s < 0.12) return;
    for (const sp of spots.values()) if (sp.ch && sp.ch.length === 1) engrave(b, sp.ch, sp.x, sp.y, sp.size, sp.rot);
    if (L.compact) {
      for (const key of ['YES', 'NO', 'BYE']) { const sp = spots.get(key); if (sp.ch) engrave(b, sp.ch, sp.x, sp.y, sp.size, 0, 'serif', 800); }
      return;
    }
    const yes = spots.get('YES'), no = spots.get('NO'), bye = spots.get('BYE');
    engrave(b, 'YES', yes.x, yes.y, yes.size, 0, 'serif', 800);
    engrave(b, 'NO', no.x, no.y, no.size, 0, 'serif', 800);
    engrave(b, 'GOOD BYE', bye.x, bye.y, bye.size, 0, 'serif', 800);
    sun(b, ox + 82 * s, oy + 62 * s, 40 * s);
    moon(b, ox + 918 * s, oy + 62 * s, 38 * s);
    engrave(b, 'SPIRIT BOARD', L.cx, oy + 48 * s, 28 * s, 0, 'serif', 800);
    if (s > 0.45) engrave(b, 'the mystifying oracle of product decisions', L.cx, oy + 84 * s, 17 * s, 0, 'serif', 600);
    b.strokeStyle = INK;
    b.lineWidth = Math.max(1, 1.6 * s);
    for (const dx of [-1, 1]) { // little rules either side of GOOD BYE
      b.beginPath();
      b.moveTo(bye.x + dx * 115 * s, bye.y);
      b.lineTo(bye.x + dx * 300 * s, bye.y);
      b.stroke();
      flourish(b, bye.x + dx * 305 * s, bye.y, 6 * s);
    }
  }

  function sun(g, x, y, r) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = INK;
    g.fillStyle = INK;
    g.lineWidth = Math.max(1, r * 0.07);
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      const l = i % 2 ? 1.45 : 1.75;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12);
      g.lineTo(Math.cos(a) * r * l, Math.sin(a) * r * l);
      g.stroke();
    }
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    // a smug face
    g.beginPath(); g.ellipse(-r * 0.35, -r * 0.18, r * 0.12, r * 0.07, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(r * 0.35, -r * 0.18, r * 0.12, r * 0.07, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(0, r * 0.12, r * 0.45, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    g.restore();
  }

  function moon(g, x, y, r) {
    g.save();
    g.translate(x, y);
    g.fillStyle = INK;
    g.beginPath();
    g.arc(0, 0, r, Math.PI * 0.35, Math.PI * 1.65, false);
    g.arc(r * 0.45, -r * 0.05, r * 0.82, Math.PI * 1.5, Math.PI * 0.5, true);
    g.fill();
    for (const [sx, sy, ss] of [[r * 1.2, -r * 0.9, 0.22], [r * 1.5, r * 0.3, 0.16], [r * 0.9, r * 1.1, 0.12]]) flourish(g, sx, sy, r * ss);
    g.fillStyle = '#c99d60'; // a sleepy eye on the crescent
    g.beginPath(); g.ellipse(-r * 0.5, -r * 0.15, r * 0.12, r * 0.04, 0.3, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // ── what the spirits say ───────────────────────────────────────────────────

  const letters = (t) => [...t.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()];

  function tidy(label) {
    const words = label.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').trim().split(/\s+/);
    let out = '';
    for (const w of words) {
      if ((out + ' ' + w).trim().length > MAX) return out ? `${out} ETC` : `${w.slice(0, MAX - 4)} ETC`;
      out = `${out} ${w}`.trim();
    }
    return out || 'YES';
  }

  function quip() {
    if (!quipBag.length) quipBag = k.shuffle(QUIPS);
    if (ctx.cardTime > 150 && k.chance(0.5)) return 'STILL WAITING';
    return quipBag.pop();
  }

  const go = (key, o = {}) => queue.push({ kind: 'go', key, dwell: 0.3, ...o });
  const spell = (text) => {
    queue.push({ kind: 'clear' });
    let prev = null;
    for (const ch of letters(text)) {
      if (ch === ' ') queue.push({ kind: 'space' });
      else go(ch, { write: ch, tap: ch === prev });
      prev = ch;
    }
  };
  const rest = (sec) => queue.push({ kind: 'rest', dur: sec });

  // A message plan for whatever is on the front card.
  function plan() {
    queue = [];
    act = null;
    const q = ctx.question;
    if (ctx.front === 'done') {
      spell('FAREWELL'); go('BYE', { dwell: 1.4, write: '' }); rest(6);
      spell('ONE MORE QUESTION'); go('NO', { dwell: 1 }); rest(8);
      return;
    }
    if (!q) {
      rest(2.5); spell(ctx.agent === 'listening' ? 'WE HEAR YOU' : 'THE AGENT IS WRITING'); rest(4);
      spell('PATIENCE'); rest(3); spell('BOO'); rest(6);
      return;
    }
    if (q.revising) { spell('YOU AGAIN'); rest(2); }
    rest(1.4);
    if (!q.options.length) { spell('SPEAK'); rest(2); spell('WE ARE LISTENING'); rest(5); spell(quip()); rest(6); return; }
    if (!q.recommended.length) { spell('UNCLEAR'); rest(1.5); go('NO', { dwell: 0.9 }); rest(4); spell(quip()); rest(6); return; }
    for (const [i, label] of q.recommended.entries()) {
      if (i) { spell('AND'); rest(0.8); }
      spell(tidy(label));
      go('YES', { dwell: 1.4, tap: true });
      rest(3.5);
    }
    spell(quip()); rest(7);
  }

  function next() {
    if (!queue.length) plan();
    act = queue.shift();
    act.t = 0;
    if (act.kind === 'go') {
      const sp = spots.get(act.key);
      if (!sp) return next();
      act.from = [pl.x, pl.y];
      act.to = [sp.x + k.rand(-3, 3) * L.s * 3, sp.y + k.rand(-3, 3) * L.s * 3];
      const d = Math.hypot(act.to[0] - pl.x, act.to[1] - pl.y);
      act.dur = act.fast ? 0.32 : k.clamp(0.24 + d / (1000 * Math.max(L.s, 0.3)), 0.28, 1.1);
      act.bend = k.rand(-0.22, 0.22) * d;
      act.landed = false;
      if (act.tap) act.dur += 0.15;
    } else if (act.kind === 'clear') {
      if (said.length) { saidFade = 0.999; act.dur = 0.5; } else act.dur = 0;
    } else if (act.kind === 'space') {
      said.push({ ch: ' ', at: time });
      act.dur = 0.35;
    } else if (act.kind === 'rest') {
      act.home = spots.get('REST');
      act.ph = k.rand(0, 6);
    }
  }

  function step(dt) {
    if (!L) return;
    if (!act) next();
    act.t += dt;
    if (act.kind === 'go') {
      const p = Math.min(1, act.t / act.dur);
      const e = k.ease.inOutCubic(p);
      const [x0, y0] = act.from, [x1, y1] = act.to;
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
      const bulge = Math.sin(Math.PI * e) * act.bend;
      const nx = x0 + dx * e - (dy / d) * bulge, ny = y0 + dy * e + (dx / d) * bulge;
      pl.vx = dt ? (nx - pl.x) / dt : 0;
      pl.vy = dt ? (ny - pl.y) / dt : 0;
      pl.x = nx; pl.y = ny;
      pl.lift = act.tap ? Math.sin(Math.PI * p) * 0.6 : 0;
      if (p >= 1 && !act.landed) {
        act.landed = true;
        pl.on = act.key;
        if (act.write !== undefined) said.push({ ch: act.write, at: time });
        else if (act.key === 'YES' || act.key === 'NO') said.push({ ch: ` · ${act.key}`, at: time, loud: true });
        k.sfx.tone({ type: 'triangle', freq: 120, to: 90, dur: 0.08, gain: 0.05 });
        if (act.key === 'YES' && act.tap) k.sfx.tone({ type: 'sine', freq: 330, to: 315, dur: 1.6, gain: 0.04, vibrato: { rate: 5, depth: 6 } });
      }
      if (p >= 1) {
        // dwell: a tiny ghostly circle around the letter
        const dw = act.t - act.dur;
        const r = 2.4 * L.s * 3 * Math.min(1, dw * 3);
        pl.x = x1 + Math.sin(dw * 9) * r;
        pl.y = y1 + Math.cos(dw * 9) * r * 0.6;
        if (dw >= act.dwell) { pl.on = null; act = null; }
      }
    } else if (act.kind === 'rest') {
      pl.on = null;
      const h = act.home;
      const R = 70 * L.s * 3;
      const a = act.t * 0.55 + act.ph;
      const tx = h.x + Math.sin(a) * R * 1.4, ty = h.y + Math.sin(a * 2) * R * 0.35;
      const f = Math.min(1, dt * 1.6);
      pl.vx = dt ? (tx - pl.x) * f / dt : 0;
      pl.vy = dt ? (ty - pl.y) * f / dt : 0;
      pl.x += (tx - pl.x) * f;
      pl.y += (ty - pl.y) * f;
      pl.lift = 0;
      if (act.t >= act.dur) act = null;
    } else {
      if (act.kind === 'clear' && saidFade < 1) {
        saidFade = Math.max(0, 1 - act.t / 0.5);
        if (act.t >= 0.5) { said = []; saidFade = 1; }
      }
      if (act.t >= act.dur) act = null;
    }
    const target = Math.atan2(pl.x - L.cx, L.pivot - pl.y) * 0.8 + k.clamp(pl.vx / 2600, -0.12, 0.12);
    pl.rot += (target - pl.rot) * Math.min(1, dt * 6);
  }

  // ── drawing ────────────────────────────────────────────────────────────────

  function planchette(x, y, rot, lift) {
    const s = Math.max(L.s, 0.22) * 1.05;
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    const shape = () => {
      c.beginPath();
      c.moveTo(0, -78 * s);
      c.bezierCurveTo(28 * s, -60 * s, 72 * s, -8 * s, 74 * s, 34 * s);
      c.bezierCurveTo(76 * s, 82 * s, 30 * s, 104 * s, 0, 96 * s);
      c.bezierCurveTo(-30 * s, 104 * s, -76 * s, 82 * s, -74 * s, 34 * s);
      c.bezierCurveTo(-72 * s, -8 * s, -28 * s, -60 * s, 0, -78 * s);
      c.closePath();
    };
    // shadow on the board (a cached blurred sprite), further away when it lifts
    if (shadow?.s !== s || shadow.d !== cv.dpr) shadow = shadowSprite(s, shape);
    c.globalAlpha = 1 - lift * 0.35;
    c.drawImage(shadow.el, (6 + lift * 10) * s - shadow.ox, (12 + lift * 16) * s - shadow.oy, shadow.w, shadow.h);
    c.globalAlpha = 1;
    c.scale(1 + lift * 0.06, 1 + lift * 0.06);
    shape();
    const g = c.createLinearGradient(-60 * s, -70 * s, 60 * s, 100 * s);
    g.addColorStop(0, '#5b3218');
    g.addColorStop(0.5, '#3a1d0c');
    g.addColorStop(1, '#241106');
    c.fillStyle = g;
    c.fill();
    c.save();
    c.clip();
    c.strokeStyle = 'rgba(255,200,140,.07)';
    c.lineWidth = 1.2 * s;
    for (let i = -6; i < 8; i++) { c.beginPath(); c.moveTo(-90 * s, i * 16 * s); c.bezierCurveTo(-30 * s, (i * 16 + 8) * s, 30 * s, (i * 16 - 8) * s, 90 * s, (i * 16 + 4) * s); c.stroke(); }
    c.restore();
    shape();
    c.lineWidth = 3 * s;
    c.strokeStyle = '#c9a25a';
    c.stroke();
    c.lineWidth = 1 * s;
    c.strokeStyle = 'rgba(255,240,200,.35)';
    shape();
    c.stroke();
    // eye and stars on the body
    c.fillStyle = '#c9a25a';
    c.font = k.font(15 * s, 400, 'serif');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('✦', -34 * s, 52 * s);
    c.fillText('✦', 34 * s, 52 * s);
    c.save();
    c.translate(0, 62 * s);
    c.strokeStyle = '#c9a25a';
    c.lineWidth = 1.6 * s;
    c.beginPath();
    c.moveTo(-15 * s, 0); c.quadraticCurveTo(0, -11 * s, 15 * s, 0); c.quadraticCurveTo(0, 11 * s, -15 * s, 0);
    c.stroke();
    c.beginPath(); c.arc(0, 0, 4.5 * s, 0, Math.PI * 2); c.fillStyle = '#c9a25a'; c.fill();
    c.restore();
    // two ghostly fingertips: somebody is definitely pushing it
    c.save();
    c.shadowColor = 'rgba(190,255,235,.9)';
    c.shadowBlur = 14 * s;
    c.fillStyle = 'rgba(225,255,245,.2)';
    for (const dx of [-1, 1]) {
      c.beginPath();
      c.ellipse(dx * 30 * s, 22 * s + Math.sin(time * 2 + dx) * 1.5 * s, 11 * s, 15 * s, dx * 0.35, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    // the lens: a brass ring with a magnified view of the board underneath
    const R = 26 * s;
    c.save();
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.clip();
    c.rotate(-rot);
    const z = 1.45, R2 = R / z + 2, d = base.dpr;
    c.scale(z, z);
    c.drawImage(base.el, (x - R2) * d, (y - R2) * d, R2 * 2 * d, R2 * 2 * d, -R2, -R2, R2 * 2, R2 * 2);
    c.restore();
    const lg = c.createRadialGradient(-R * 0.4, -R * 0.4, 1, 0, 0, R);
    lg.addColorStop(0, 'rgba(255,255,255,.35)');
    lg.addColorStop(0.35, 'rgba(255,255,255,.04)');
    lg.addColorStop(1, 'rgba(120,180,170,.18)');
    c.fillStyle = lg;
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
    c.lineWidth = 5 * s;
    c.strokeStyle = '#b08840';
    c.stroke();
    c.lineWidth = 1.5 * s;
    c.strokeStyle = '#f3dc9c';
    c.beginPath(); c.arc(0, 0, R + 1.5 * s, Math.PI * 1.1, Math.PI * 1.7); c.stroke();
    c.restore();
  }

  function glowAt(sp, a) {
    if (!sp || !sp.ch) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const r = sp.size * 1.6;
    const g = c.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r);
    g.addColorStop(0, `rgba(170,255,225,${0.35 * a})`);
    g.addColorStop(1, 'rgba(170,255,225,0)');
    c.fillStyle = g;
    c.fillRect(sp.x - r, sp.y - r, r * 2, r * 2);
    c.restore();
  }

  // The message burns itself into the board: each letter lands white-hot, cools to scorched ink, smokes.
  // It's laid out (cut to fit, each letter measured) only when a letter lands or the space changes.
  let inked = null; // { said, n, size, w, chars: [{ ch, at, dx, w }] }
  function transcript(t) {
    if (!said.length) return;
    const size = k.clamp(scribe.w / 28, 15, 26);
    c.save();
    c.textBaseline = 'middle';
    c.font = k.font(size, 800, 'serif');
    c.letterSpacing = `${Math.round(size * 0.2)}px`;
    if (inked?.said !== said || inked.n !== said.length || inked.size !== size || inked.w !== scribe.w) {
      let chars = said.flatMap((l) => [...l.ch].map((ch) => ({ ch, at: l.at })));
      const width = (cs) => c.measureText(cs.map((x) => x.ch).join('')).width;
      let cut = false;
      while (chars.length > 1 && width(chars) > scribe.w) { chars = chars.slice(1); cut = true; }
      if (cut) chars.unshift({ ch: '…', at: -9 });
      let dx = -width(chars) / 2;
      for (const l of chars) { l.dx = dx; l.w = c.measureText(l.ch).width; dx += l.w; }
      inked = { said, n: said.length, size, w: scribe.w, chars };
    }
    const { chars } = inked;
    for (let i = 0; i < chars.length; i++) {
      const { ch, at, w } = chars[i];
      const x = scribe.x + chars[i].dx;
      const age = time - at;
      const heat = k.clamp(1 - age / 1.1);
      const pop = k.clamp(age / 0.18);
      const y = scribe.y + (k.reduced ? 0 : Math.sin(t * 1.1 + i * 0.6) * 0.6);
      c.globalAlpha = saidFade * pop;
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,225,170,.4)';
      c.fillText(ch, x + 0.8, y + 1.2);
      c.fillStyle = '#1e0c03';
      c.fillText(ch, x, y);
      if (heat > 0) {
        c.globalAlpha = saidFade * heat * pop;
        c.shadowColor = 'rgba(255,120,20,.95)';
        c.shadowBlur = 18 * heat;
        c.fillStyle = heat > 0.6 ? '#fff4c8' : '#ff9a2e';
        c.fillText(ch, x, y);
        if (ch.trim() && blob) { // a wisp of smoke
          c.shadowBlur = 0;
          c.globalAlpha = saidFade * heat * 0.35;
          const r = size * (1.6 - heat);
          c.drawImage(blob, x + w / 2 - r / 2 + Math.sin(age * 6) * 3, y - size * 0.5 - (1 - heat) * size * 1.6 - r / 2, r, r);
        }
      }
    }
    c.restore();
  }

  function makeFog() {
    const s = document.createElement('canvas');
    s.width = s.height = 128;
    const g = s.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(225,255,245,.9)');
    rg.addColorStop(0.5, 'rgba(225,255,245,.3)');
    rg.addColorStop(1, 'rgba(225,255,245,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
    blob = s;
    fog = Array.from({ length: 7 }, (_, i) => ({ x: k.rand(0, 1), y: k.rand(0.35, 1), r: k.rand(160, 320), v: k.rand(0.006, 0.016) * (i % 2 ? 1 : -1), a: k.rand(0.04, 0.08), ph: k.rand(0, 6) }));
  }

  // Candlelight from both bottom corners: drawn once per resize, flickered with CSS opacity (cheap).
  const light = k.canvas({ dpr: 1, style: 'opacity:.8' });
  light.resized = () => {
    const g = light.ctx, r = Math.max(light.w, light.h) * 0.62;
    g.clearRect(0, 0, light.w, light.h);
    for (const x of [0, light.w]) {
      const gr = g.createRadialGradient(x, light.h, 0, x, light.h, r);
      gr.addColorStop(0, 'rgba(255,150,50,.2)');
      gr.addColorStop(0.5, 'rgba(255,110,30,.06)');
      gr.addColorStop(1, 'rgba(255,100,20,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, light.w, light.h);
    }
  };
  light.resized();
  function candles(t) {
    if (!k.reduced) light.el.style.opacity = k.clamp(0.8 + Math.sin(t * 13) * 0.07 + Math.sin(t * 7.3) * 0.1 + Math.sin(t * 23) * 0.05 - gust * 0.4, 0.2, 1).toFixed(3);
  }

  function shadowSprite(s, shape) {
    const pad = 20 * s + 8, w = 150 * s + pad * 2, h = 190 * s + pad * 2, d = cv.dpr;
    const el = document.createElement('canvas');
    el.width = Math.ceil(w * d); el.height = Math.ceil(h * d);
    const g = el.getContext('2d');
    g.scale(d, d);
    g.filter = `blur(${6 * s}px)`;
    g.translate(pad + 75 * s, pad + 78 * s);
    const keep = c;
    c = g; // reuse the planchette path
    shape();
    c = keep;
    g.fillStyle = 'rgba(30,12,0,.42)';
    g.fill();
    return { el, s, d, ox: pad + 75 * s, oy: pad + 78 * s, w, h };
  }

  function draw(dt, t) {
    time = t;
    gust = Math.max(0, gust - dt * 0.8);
    if (!k.reduced) step(dt);
    c.clearRect(0, 0, cv.w, cv.h);
    candles(t);
    if (!L || L.s < 0.12) { transcript(t); return; }
    c.save();
    c.globalCompositeOperation = 'source-over';
    for (const f of fog) {
      f.x += f.v * dt * (1 + gust * 6);
      if (f.x > 1.3) f.x = -0.3; else if (f.x < -0.3) f.x = 1.3;
      const x = L.gap.x + f.x * L.gap.w, y = L.gap.y + f.y * L.gap.h + Math.sin(t * 0.4 + f.ph) * 20;
      c.globalAlpha = f.a * (1 + gust);
      c.drawImage(blob, x - f.r, y - f.r * 0.5, f.r * 2, f.r);
    }
    c.restore();
    if (pl.on) glowAt(spots.get(pl.on), 1);
    const bob = k.reduced ? 0 : Math.sin(t * 1.7) * 0.6;
    planchette(pl.x, pl.y + bob, pl.rot, pl.lift);
    transcript(t);
  }

  // Reduced motion: the board mid-seance. Planchette on YES, the whole message spelled out.
  function still() {
    if (!L) return;
    const q = ctx.question;
    const msg = ctx.front === 'done' ? 'FAREWELL' : !q ? 'PATIENCE' : !q.options.length ? 'SPEAK' : q.recommended.length ? tidy(q.recommended[0]) : 'UNCLEAR';
    said = [...msg].map((ch) => ({ ch, at: -9 }));
    saidFade = 1;
    const key = ctx.front === 'done' ? 'BYE' : q?.recommended.length ? 'YES' : !q || !q.options.length ? 'REST' : 'NO';
    const sp = spots.get(key);
    Object.assign(pl, { x: sp.x, y: sp.y, on: key === 'REST' ? null : key, lift: 0 });
    pl.rot = Math.atan2(pl.x - L.cx, L.pivot - pl.y) * 0.8;
  }

  makeFog();
  base.resized = (w, h, { dprOnly } = {}) => { if (dprOnly) return paint(); layout(); if (k.reduced) still(); };
  layout();
  if (k.reduced) still();
  // The card can settle after a hook (entry animations don't fire resize events): follow it.
  let cardSig = '';
  const settle = () => { const r = k.rect(k.ui.card()); const sg = r ? [r.left, r.top, r.width, r.height].map(Math.round).join() : ''; if (sg === cardSig) return; cardSig = sg; layout(); if (k.reduced) { still(); loop.redraw(); } };
  k.every(700, settle);
  const loop = k.loop(draw, { still: 0 });

  return {
    question() {
      layout();
      k.after(450, layout);
      if (k.reduced) { still(); return; }
      gust = 1;
      if (time - answeredAt < 3) return; // let the answer reaction finish, then plan() picks up the new card
      queue = [{ kind: 'clear' }];
      act = null;
    },
    layout() {
      layout();
      if (k.reduced) still();
    },
    status() {
      if (!ctx.question && !k.reduced) { queue = []; act = null; }
    },
    answer(a) {
      answeredAt = time;
      if (k.reduced) return;
      queue = [{ kind: 'clear' }];
      act = null;
      if (a.tookRec || !a.hasRec) { go('YES', { fast: true, dwell: 0.25, write: 'YES' }); go('REST', { fast: true, dwell: 0 }); go('YES', { fast: true, dwell: 0.3, write: ' YES' }); }
      else { go('NO', { fast: true, dwell: 0.6, write: 'YOUR FUNERAL' }); }
      rest(1.5);
      gust = 1.4;
      k.sfx.whoosh({ pitch: 0.5, gain: 0.4 });
    },
    keystroke() {
      gust = Math.min(1, gust + 0.08);
    },
  };
}
