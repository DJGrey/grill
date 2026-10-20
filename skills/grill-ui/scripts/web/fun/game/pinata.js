// Piñata. A paper donkey swings down on a rope. Your cursor is a stick: whack it five times and
// it bursts, raining sweets. Dawdle and it gets hauled back up.

const STICK = (a) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><g transform='rotate(${a} 20 20)'><rect x='17' y='2' width='6' height='36' rx='3' fill='#8a5a2b' stroke='#3b2410' stroke-width='1.5'/><path d='M17 26h6M17 30h6M17 34h6' stroke='#ff4d8d' stroke-width='2.4'/><rect x='18.5' y='3.5' width='1.6' height='20' rx='.8' fill='#c48a52'/></g></svg>`)}") 20 6, pointer`;
const STRIPES = ['#ff4d8d', '#ffb627', '#2ec4b6', '#9b5de5', '#ff6b35', '#00bbf9', '#f15bb5', '#fee440'];
const INK = '#4a2340';
const HITS = 5;
const WHACKS = ['WHACK!', 'BONK!', 'THWACK!', 'POW!', 'SMACK!', 'OOF!'];
const ENDINGS = [
  'It was full of edge cases.',
  'Inside: 23 sweets and a TODO.',
  'No donkeys were harmed. Several were bonked.',
  'Contents: candy, confetti and one strong opinion.',
  'Turns out it was load-bearing.',
  'Scope: delivered. Piñata: not.',
];
const SW = 240, SH = 260; // sprite box, in piñata units, origin at its centre

// The answer box and the options, padded: the donkey, its swing, the sweets and the words all stay off them.
function keepOut(k, pad = 14) {
  const rs = [k.ui.answer()?.parentElement, ...k.ui.options().map((o) => o.el)].map((el) => k.rect(el)).filter(Boolean);
  if (!rs.length) return null;
  return { l: Math.min(...rs.map((r) => r.left)) - pad, t: Math.min(...rs.map((r) => r.top)) - pad, r: Math.max(...rs.map((r) => r.right)) + pad, b: Math.max(...rs.map((r) => r.bottom)) + pad };
}
const inZone = (Z, x, y) => !!Z && x > Z.l && x < Z.r && y > Z.t && y < Z.b;
const overlaps = (Z, l, t, r, b) => !!Z && l < Z.r && r > Z.l && t < Z.b && b > Z.t;

export default function pinata(k, ctx) {
  const cv = k.canvas();
  const c = cv.ctx;
  const S = k.clamp(Math.min(k.vh / 900, k.vw / 1200), 0.72, 1.1);

  // Hang it beside the card if there's room, otherwise over the Notes panel or the sidebar, otherwise over the card
  // but high enough that it (and its swing) never reaches the options.
  const sp = k.space();
  let Z = keepOut(k);
  let Z0 = keepOut(k, 0); // unpadded, for the cursor: refreshed on layout and scroll, not every frame
  const side = sp.gaps.find((g) => (g.where === 'right' || g.where === 'left') && g.w >= 240 * S);
  const panel = [sp.notes, sp.side].find((r) => r && r.width >= 200 && r.left >= -1 && r.right <= sp.vw + 1);
  const ax = side ? side.x + side.w / 2
    : panel ? panel.left + panel.width / 2
    : sp.card ? Math.min(sp.card.right - 110 * S, k.vw - 130 * S) : k.vw * 0.7;
  let hangY = k.clamp(k.vh * 0.36, 200 * S, k.vh - 200 * S);
  // its bounding box (sweeping tail, ears and hooves included) for a rope length and angle
  const BOX = [[-92, -142], [120, -142], [120, 100], [-92, 100]];
  function box(len, th) {
    const ang = -th * 0.9, cs = Math.cos(ang), sn = Math.sin(ang);
    const cx = ax + Math.sin(th) * len - Math.sin(ang) * 30 * S, cy = -30 + Math.cos(th) * len + Math.cos(ang) * 30 * S;
    const xs = BOX.map(([u, v]) => cx + (u * cs - v * sn) * S), ys = BOX.map(([u, v]) => cy + (u * sn + v * cs) * S);
    return [Math.min(...xs) - 4, Math.min(...ys) - 4, Math.max(...xs) + 4, Math.max(...ys) + 4];
  }
  if (overlaps(Z, ...box(hangY - 40 * S, 0))) hangY = Math.max(Z.t - 8 - 70 * S, 150 * S); // shorter rope: hooves clear the options
  const LEN = hangY - 40 * S; // rope length, from the anchor just above the screen
  const P = { len: 0, th: 0, w: 0, squash: 0, shake: 0 };
  const sprite = build();
  const cracks = [];
  const fx = []; // callouts
  const candy = [];
  const pieces = [];
  let hits = 0;
  let phase = 'drop'; // drop → swing → burst | flee
  let phaseAt = 0;
  let clock = 0;
  let swing = 0;
  let verdict = null;

  k.cursor(STICK(-35));
  k.toast(`Piñata! Whack it ${HITS} times. Esc to skip.`, { icon: k.canRender('🪅', 'emoji') ? '🪅' : '🍬', ms: 2200 });
  k.sfx.whoosh({ pitch: 0.6, gain: 0.4 });

  // ── the donkey, drawn once ──

  function build() {
    const D = 2 * S;
    const el = document.createElement('canvas');
    el.width = Math.ceil(SW * D);
    el.height = Math.ceil(SH * D);
    const g = el.getContext('2d');
    g.scale(D, D);
    g.translate(SW / 2, SH / 2 + 30);
    const shape = () => {
      g.beginPath();
      g.roundRect(-62, -30, 116, 60, 28); // body
      g.moveTo(26, -18); g.lineTo(46, -78); g.lineTo(72, -70); g.lineTo(56, -8); g.closePath(); // neck
      g.roundRect(38, -104, 64, 40, [16, 20, 18, 14]); // head
      for (const x of [-46, -24, 14, 34]) g.roundRect(x, 18, 18, 46, 6); // legs
      g.ellipse(48, -116, 7, 17, -0.25, 0, Math.PI * 2); // ears
      g.ellipse(66, -118, 7, 17, 0.2, 0, Math.PI * 2);
    };
    shape();
    g.lineWidth = 7;
    g.lineJoin = 'round';
    g.strokeStyle = INK;
    g.stroke();
    g.save();
    shape();
    g.clip();
    const band = 13;
    for (let y = -140, i = 0; y < 80; y += band, i++) {
      const col = STRIPES[i % STRIPES.length];
      g.fillStyle = col;
      g.fillRect(-90, y, 220, band + 1);
      g.fillStyle = 'rgba(0,0,0,.14)'; // paper fringe: little tongues hanging over the next band
      for (let x = -90; x < 130; x += 4) {
        g.beginPath();
        g.moveTo(x, y + band - 1);
        g.lineTo(x + 2, y + band + 5 + ((x * 7 + i * 3) % 4));
        g.lineTo(x + 3.4, y + band - 1);
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.18)';
      g.fillRect(-90, y, 220, 2);
    }
    const shade = g.createLinearGradient(0, -120, 0, 70); // light from the top
    shade.addColorStop(0, 'rgba(255,255,255,.18)');
    shade.addColorStop(0.6, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(60,0,40,.22)');
    g.fillStyle = shade;
    g.fillRect(-90, -140, 220, 220);
    g.restore();
    // hooves, muzzle, face
    g.fillStyle = INK;
    for (const x of [-46, -24, 14, 34]) { g.beginPath(); g.roundRect(x, 56, 18, 9, [0, 0, 6, 6]); g.fill(); }
    g.fillStyle = '#fff1d6';
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath(); g.roundRect(78, -92, 30, 26, 12); g.fill(); g.stroke();
    g.fillStyle = INK;
    for (const y of [-84, -76]) { g.beginPath(); g.ellipse(100, y + 2, 2, 2.6, 0, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.ellipse(64, -88, 5, 6.5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(65.6, -90.5, 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(58, -96); g.lineTo(70, -98); g.stroke(); // a determined eyebrow
    g.beginPath(); g.arc(96, -72, 6, 0.4, 2.4); g.stroke();
    g.fillStyle = 'rgba(255,90,140,.45)';
    g.beginPath(); g.ellipse(72, -76, 6, 3.5, 0, 0, Math.PI * 2); g.fill();
    // mane: a row of paper tufts down the neck
    ['#fee440', '#ff4d8d', '#00bbf9', '#9b5de5', '#2ec4b6'].forEach((col, i) => {
      g.save();
      g.translate(44 - i * 3.5, -96 + i * 13);
      g.rotate(-0.9);
      g.fillStyle = col;
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(-16, -5); g.lineTo(-12, 1); g.lineTo(-18, 6); g.lineTo(0, 9);
      g.closePath(); g.fill(); g.stroke();
      g.restore();
    });
    return el;
  }

  // the tail: paper streamers that trail the swing
  function tail(t) {
    c.lineCap = 'round';
    ['#ff4d8d', '#fee440', '#00bbf9', '#9b5de5'].forEach((col, i) => {
      const len = 46 + i * 6;
      const sway = Math.sin(t * 5 + i) * 6 - P.w * 14;
      c.beginPath();
      c.moveTo(-60, -10 + i * 3);
      c.bezierCurveTo(-74 + sway * 0.3, 6, -70 + sway, 22, -66 + sway * 1.4, -10 + len);
      c.lineWidth = 7;
      c.strokeStyle = INK;
      c.stroke();
      c.lineWidth = 4;
      c.strokeStyle = col;
      c.stroke();
    });
  }

  // ── where it is ──

  const pivot = () => ({ x: ax, y: -30 });
  function body() {
    const p = pivot();
    const rx = p.x + Math.sin(P.th) * P.len, ry = p.y + Math.cos(P.th) * P.len; // end of the rope
    const ang = -P.th * 0.9;
    return { rx, ry, ang, x: rx - Math.sin(ang) * 30 * S, y: ry + Math.cos(ang) * 30 * S };
  }
  function local(x, y) {
    const b = body();
    const dx = x - b.x, dy = y - b.y;
    const cs = Math.cos(-b.ang), sn = Math.sin(-b.ang);
    return [(dx * cs - dy * sn) / S, (dx * sn + dy * cs) / S];
  }
  const inside = ([lx, ly]) => (lx > -78 && lx < 70 && ly > -48 && ly < 80) || (lx > 30 && lx < 116 && ly > -150 && ly < -40);

  function whack(e) {
    if (e.button !== 0 || phase !== 'swing') return;
    if (inZone(keepOut(k, 0), e.clientX, e.clientY)) return; // a click on your answer is yours
    const L = local(e.clientX, e.clientY);
    k.cursor(STICK(25));
    k.after(130, () => phase !== 'burst' && k.cursor(STICK(-35)));
    if (!inside(L)) return;
    k.consume(e);
    hits++;
    const b = body();
    const dir = e.clientX < b.x ? 1 : -1;
    P.w += dir * k.rand(1.2, 1.5);
    P.squash = 1;
    P.shake = 1;
    cracks.push(crackAt(L));
    k.burst(e.clientX, e.clientY, { shape: 'confetti', n: 16, colors: STRIPES, speed: 360, gravity: 450, drag: 2, spread: Math.PI * 1.2, size: 9, life: 1.3 });
    k.sfx.thud({ pitch: 1.1 + hits * 0.08, gain: 0.8 });
    k.sfx.noise({ dur: 0.12, filter: 'highpass', freq: 2800, gain: 0.25, color: 'pink' });
    fx.length = 0;
    if (hits >= HITS) return burst();
    fx.push({ text: k.pick(WHACKS), x: e.clientX, y: e.clientY - 30, age: 0, life: 0.8, size: 38, rot: k.rand(-0.25, 0.25) });
    fx.push({ text: `${HITS - hits} more`, x: e.clientX + dir * -10, y: e.clientY + 18, age: 0, life: 0.8, size: 18, rot: 0, fill: '#ffffff' });
  }

  function crackAt([lx, ly]) {
    const pts = [[lx, ly]];
    let a = k.rand(Math.PI * 2);
    for (let i = 0; i < 4; i++) { a += k.rand(-0.9, 0.9); const [px, py] = pts.at(-1); pts.push([px + Math.cos(a) * k.rand(8, 16), py + Math.sin(a) * k.rand(8, 16)]); }
    return pts;
  }

  function burst() {
    phase = 'burst';
    phaseAt = clock;
    k.cursor(null);
    const b = body();
    // the donkey breaks into three bits
    const cuts = [-80, -20, 40, 130];
    for (let i = 0; i < 3; i++) {
      pieces.push({ x: b.x, y: b.y, ang: b.ang, vx: (i - 1) * k.rand(160, 240) + P.w * 60, vy: -k.rand(250, 420), vr: (i - 1 || k.pick([-1, 1])) * k.rand(2, 4), x0: cuts[i], x1: cuts[i + 1], seed: i });
    }
    for (let i = 0; i < 46; i++) {
      const a = -Math.PI / 2 + k.rand(-1.4, 1.4);
      const v = k.rand(280, 760);
      candy.push({ x: b.x + k.rand(-30, 30), y: b.y + k.rand(-20, 20), vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: k.rand(6.3), vr: k.rand(-9, 9), kind: k.pick(['wrap', 'wrap', 'wrap', 'pop', 'star', 'choc']), col: k.pick(STRIPES), size: k.rand(0.85, 1.25), rest: 0 });
    }
    // up and out like a firework, then a slow flutter, so the confetti doesn't rain onto your answer
    k.burst(b.x, b.y, { shape: 'star', n: 30, colors: ['#fee440', '#ffffff', '#ffb627'], speed: 700, gravity: 300, drag: 2.2, spread: Math.PI * 1.1, size: 10, life: 1.6 });
    k.burst(b.x, b.y, { shape: 'confetti', n: 60, colors: STRIPES, speed: 820, gravity: 300, drag: 2.2, spread: Math.PI * 1.1, size: 10, life: 2 });
    k.sfx.pop({ pitch: 0.5, gain: 1 });
    k.sfx.shatter({ pitch: 0.4, gain: 0.5 });
    k.sfx.cheer({ gain: 0.7, delay: 0.1 });
    k.sfx.tada({ delay: 0.25 });
    for (let i = 0; i < 6; i++) k.sfx.coin({ gain: 0.4, pitch: k.rand(0.9, 1.3), delay: 0.35 + i * 0.09 });
    k.score('pinatas', 1, { icon: '🍭', label: 'Piñatas', says: 'smashed {n} piñata{s}' });
    verdict = { at: clock, big: k.pick(['SUGAR RUSH!', '¡PIÑATA!', 'DESTROYED', 'CANDY GET!']), small: k.pick(ENDINGS) };
    k.after(3200, k.end);
  }

  function flee() {
    phase = 'flee';
    phaseAt = clock;
    k.cursor(null);
    k.sfx.whoosh({ pitch: 1.2, gain: 0.4 });
    fx.push({ text: 'IT GOT AWAY', x: ax, y: hangY + 70 * S, age: 0, life: 1.4, size: 30, rot: -0.05, fill: '#ffffff' });
    k.after(1400, k.end);
  }

  k.on(window, 'pointerdown', whack, { capture: true });
  k.on(window, 'scroll', () => { Z0 = keepOut(k, 0); }, { capture: true, passive: true });

  // a word or a sign that would land on the answer box shifts to the nearest clear spot
  function dodge(x, y, hw, hh) {
    if (!overlaps(Z, x - hw, y - hh, x + hw, y + hh)) return [x, y];
    const spots = [[x, Z.t - hh - 4], [Z.l - hw - 4, y], [Z.r + hw + 4, y], [x, Z.b + hh + 4]]
      .filter(([px, py]) => px - hw >= 0 && px + hw <= k.vw && py - hh >= 0 && py + hh <= k.vh)
      .sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
    return spots[0] || [x, Z.t - hh - 4];
  }
  // sweets and bits of donkey bounce off the top of the options and skitter off the nearest edge
  function collide(p, r) {
    if (!overlaps(Z, p.x - r, p.y - r, p.x + r, p.y + r)) return;
    const pen = { t: p.y + r - Z.t, b: Z.b - (p.y - r), l: p.x + r - Z.l, r: Z.r - (p.x - r) };
    const m = Math.min(pen.t, pen.b, pen.l, pen.r);
    if (m === pen.t) { p.y = Z.t - r; p.vy = -Math.abs(p.vy) * 0.35; p.vx += (p.x < (Z.l + Z.r) / 2 ? -1 : 1) * 260; }
    else if (m === pen.b) { p.y = Z.b + r; p.vy = Math.abs(p.vy) * 0.3; }
    else if (m === pen.l) { p.x = Z.l - r; p.vx = -Math.abs(p.vx) * 0.6; }
    else { p.x = Z.r + r; p.vx = Math.abs(p.vx) * 0.6; }
  }

  // ── sweets ──

  function drawCandy(p) {
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    c.scale(p.size * S, p.size * S);
    c.lineWidth = 2;
    c.strokeStyle = INK;
    c.lineJoin = 'round';
    if (p.kind === 'wrap') {
      c.fillStyle = p.col;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 8, 0); c.lineTo(s * 17, -7); c.lineTo(s * 15, 0); c.lineTo(s * 17, 7); c.closePath(); c.fill(); c.stroke(); }
      c.beginPath(); c.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(-4, -6); c.lineTo(2, 6); c.stroke();
    } else if (p.kind === 'pop') {
      c.strokeStyle = '#f4efe6'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 6); c.lineTo(0, 26); c.stroke();
      c.fillStyle = p.col; c.strokeStyle = INK; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.beginPath(); for (let a = 0; a < 9; a += 0.3) c.lineTo(Math.cos(a) * a * 0.95, Math.sin(a) * a * 0.95); c.stroke();
    } else if (p.kind === 'star') {
      c.fillStyle = '#fee440';
      c.beginPath();
      for (let j = 0; j < 10; j++) { const r = j % 2 ? 5 : 12; c.lineTo(Math.cos((j * Math.PI) / 5 - Math.PI / 2) * r, Math.sin((j * Math.PI) / 5 - Math.PI / 2) * r); }
      c.closePath(); c.fill(); c.stroke();
    } else {
      c.fillStyle = '#6b3a1e';
      c.beginPath(); c.roundRect(-11, -7, 22, 14, 2); c.fill(); c.stroke();
      c.fillStyle = p.col;
      c.fillRect(-5, -7, 10, 14);
      c.strokeRect(-5, -7, 10, 14);
    }
    c.restore();
  }

  function comic(text, x, y, size, fill, rot = 0, alpha = 1, scale = 1) {
    c.save();
    c.font = k.font(size, 900, 'display');
    [x, y] = dodge(x, y, c.measureText(text).width / 2 + size * 0.3, size * 0.75);
    c.translate(x, y);
    c.rotate(rot);
    c.scale(scale, scale);
    c.globalAlpha = alpha;
    c.font = k.font(size, 900, 'display');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = Math.max(3.5, size * 0.16);
    c.strokeStyle = 'rgba(0,0,0,.3)';
    c.strokeText(text, 3, 4);
    c.strokeStyle = INK;
    c.strokeText(text, 0, 0);
    c.fillStyle = fill;
    c.fillText(text, 0, 0);
    c.restore();
  }

  function rope(b, alpha = 1) {
    const p = pivot();
    c.globalAlpha = alpha;
    c.strokeStyle = '#7a5a3a';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.quadraticCurveTo((p.x + b.rx) / 2 + P.w * 6, (p.y + b.ry) / 2, b.rx, b.ry);
    c.stroke();
    c.strokeStyle = 'rgba(255,240,210,.5)';
    c.lineWidth = 1;
    c.setLineDash([3, 4]);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
  }

  let stick = true;
  k.loop((dt, t) => {
    clock = t;
    if (phase === 'swing') { // over your answer the cursor is a cursor, not a stick
      const off = inZone(Z0, k.pointer.x, k.pointer.y);
      if (off === stick) { stick = !off; k.cursor(stick ? STICK(-35) : null); }
    }
    c.clearRect(0, 0, cv.w, cv.h);
    c.save();
    if (P.shake > 0) {
      P.shake = Math.max(0, P.shake - dt * 6);
      c.translate(k.rand(-4, 4) * P.shake, k.rand(-4, 4) * P.shake);
    }
    const was = { len: P.len, th: P.th };
    if (phase === 'drop') {
      const p = Math.min(1, t / 0.9);
      P.len = LEN * k.ease.outBack(p);
      P.th = Math.sin(t * 7) * 0.12 * (1 - p);
      if (p >= 1) { phase = 'swing'; phaseAt = t; P.w = 0.6; k.sfx.boing({ pitch: 0.8, gain: 0.35 }); }
    } else if (phase === 'swing' || phase === 'flee') {
      P.w += (-11 * Math.sin(P.th) - 0.9 * P.w) * dt; // pendulum, gently damped
      P.th += P.w * dt;
      swing += dt;
      if (phase === 'swing' && t - phaseAt > 9) flee();
      if (phase === 'flee') P.len = LEN * (1 - k.ease.inBack(Math.min(1, (t - phaseAt) / 0.8)));
    }
    if (phase !== 'burst' && overlaps(Z, ...box(P.len, P.th))) { // it bonks off the card edge rather than swing into your answer
      if (Math.abs(P.w) > 0.6) k.sfx.thud({ pitch: 1.6, gain: 0.25 });
      P.len = Math.min(P.len, was.len);
      P.th = was.th;
      P.w = -P.w * 0.45;
      P.squash = Math.max(P.squash, 0.4);
    }
    P.squash = Math.max(0, P.squash - dt * 5);

    if (phase !== 'burst') {
      const b = body();
      rope(b);
      c.save();
      c.translate(b.x, b.y);
      c.rotate(b.ang);
      const sq = Math.sin(P.squash * Math.PI) * 0.12;
      c.scale(S * (1 + sq), S * (1 - sq));
      tail(t);
      c.drawImage(sprite, -SW / 2, -SH / 2 - 30, SW, SH);
      c.strokeStyle = INK; // damage so far
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      for (const cr of cracks) { c.beginPath(); cr.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
      c.restore();
      if (phase === 'swing' && !hits && t - phaseAt < 2.4) { // a nudge
        c.globalAlpha = Math.min(1, (t - phaseAt) * 3, (2.4 - (t - phaseAt)) * 2);
        const below = !overlaps(Z, b.x - 80, b.y + 90 * S, b.x + 80, b.y + 120 * S);
        comic(`HIT ME ×${HITS}`, b.x, below ? b.y + 105 * S : b.y - 160 * S, 20, '#fee440', -0.04);
        c.globalAlpha = 1;
      }
    } else {
      const bt = t - phaseAt;
      const b = { rx: pivot().x + Math.sin(P.th) * P.len, ry: pivot().y + Math.cos(P.th) * P.len };
      rope(b, Math.max(0, 1 - bt * 1.5));
      for (const p of pieces) {
        p.vy += 1500 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.ang += p.vr * dt;
        collide(p, 110 * S);
        c.save();
        c.globalAlpha = k.clamp(1.3 - bt * 1.3);
        c.translate(p.x, p.y);
        c.rotate(p.ang);
        c.scale(S, S);
        c.beginPath();
        c.moveTo(p.x0, -150);
        for (let y = -150; y <= 90; y += 20) c.lineTo((y / 20) % 2 ? p.x1 + 6 : p.x1 - 6, y);
        c.lineTo(p.x0, 90);
        c.clip();
        c.drawImage(sprite, -SW / 2, -SH / 2 - 30, SW, SH);
        c.restore();
      }
    }

    const floor = k.vh - 14;
    for (let i = candy.length - 1; i >= 0; i--) {
      const p = candy[i];
      p.vy += 1600 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > floor) { p.y = floor; p.vy *= -0.38; p.vx *= 0.7; p.vr *= 0.6; if (Math.abs(p.vy) < 60) p.vy = 0; }
      if (p.x < 10 || p.x > k.vw - 10) p.vx *= -0.6;
      collide(p, 24 * p.size * S);
      c.globalAlpha = phase === 'burst' ? Math.min(1, (3.1 - (t - phaseAt)) * 2) : 1;
      drawCandy(p);
      c.globalAlpha = 1;
    }

    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.age += dt;
      const p = f.age / f.life;
      if (p >= 1) { fx.splice(i, 1); continue; }
      const pop = k.ease.outBack(Math.min(1, f.age / 0.16));
      comic(f.text, f.x, f.y - k.ease.outCubic(p) * 40, f.size, f.fill || '#fee440', f.rot, Math.min(1, (1 - p) * 3), 0.5 + pop * 0.5);
    }

    if (verdict) {
      const vt = t - verdict.at;
      const a = Math.min(1, vt * 4, (3.1 - vt) * 3);
      c.font = k.font(22, 900, 'display');
      const w = Math.max(340, c.measureText(verdict.small).width + 70);
      const [x, cy] = dodge(sp.stage.left + sp.stage.width / 2, k.vh * 0.4 + 22, w / 2 + 8, 86);
      const y = cy - 22;
      c.save();
      c.translate(x, y + 26);
      c.rotate(-0.04);
      c.globalAlpha = Math.max(0, a) * 0.9;
      c.fillStyle = '#1a0f1a';
      c.beginPath();
      c.roundRect(-w / 2, -84, w, 160, 26);
      c.fill();
      c.restore();
      comic(verdict.big, x, y, 72, '#fee440', -0.04, Math.max(0, a), 0.6 + k.ease.outBack(Math.min(1, vt / 0.3)) * 0.4);
      comic(verdict.small, x, y + 64, 22, '#ffffff', -0.04, Math.max(0, a) * k.clamp((vt - 0.25) * 4));
    }
    c.restore();
  }, { still: 1.2 });

  // Reduced motion: no swinging. A forced test gets it hanging there, already won.
  if (k.reduced) k.after(1500, k.end);

  return {
    layout() { // the card moved: if the options are now where it hangs, it gets hauled back up
      Z = keepOut(k);
      Z0 = keepOut(k, 0);
      if (phase === 'swing' && overlaps(Z, ...box(P.len, P.th))) flee();
    },
  };
}
