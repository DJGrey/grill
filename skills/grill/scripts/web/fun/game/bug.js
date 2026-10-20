// Bug on the card. A jewel beetle wanders in, stops to read your question, and runs if your cursor
// gets close. Swat it for a splat, a RESOLVED stamp and "1 bug fixed". Let it go and it ships.

const SWATTER = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M15.5 15.5L29 29' stroke='#000' stroke-opacity='.55' stroke-width='5' stroke-linecap='round'/><path d='M15.5 15.5L29 29' stroke='#f2c14e' stroke-width='2.6' stroke-linecap='round'/><rect x='2' y='2' width='16' height='16' rx='4' fill='#e8473b' stroke='#000' stroke-opacity='.6' stroke-width='1.6'/><path d='M6 3v14M10 3v14M14 3v14M3 6h14M3 10h14M3 14h14' stroke='#8f1d14' stroke-width='1' stroke-opacity='.7'/><circle cx='10' cy='10' r='1.6' fill='#fff'/></svg>`)}") 10 10, crosshair`;
const HIT = 30;
const NEAR = 64; // misses this close are still swats, not clicks on the card underneath (unless it's your answer)
const SPOOK = 105; // the bug bolts when the cursor gets this close
const GOO = ['#c6dd4f', '#a9c43a', '#e3ef7c', '#8aa62c'];
const FIXED = [
  '{n} fixed. Ship it.',
  '{n} fixed. No tests were written.',
  '{n} fixed. Works on my machine.',
  '{n} fixed. Closing as resolved.',
  '{n} fixed. Root cause: legs.',
];
const SPLATS = ['SPLAT!', 'THWACK!', 'SQUISH!', 'FIXED!'];
const MISSES = ['WHIFF', 'MISSED', 'TOO SLOW', 'NOPE'];

// The answer box (with its send button) and the options: a click there is always yours, and the bug walks round them.
function keepOut(k, pad = 14) {
  const rs = [k.ui.answer()?.parentElement, ...k.ui.options().map((o) => o.el)].map((el) => k.rect(el)).filter(Boolean);
  if (!rs.length) return null;
  return { l: Math.min(...rs.map((r) => r.left)) - pad, t: Math.min(...rs.map((r) => r.top)) - pad, r: Math.max(...rs.map((r) => r.right)) + pad, b: Math.max(...rs.map((r) => r.bottom)) + pad };
}
const inside = (Z, x, y) => !!Z && x > Z.l && x < Z.r && y > Z.t && y < Z.b;

export default function bug(k, ctx) {
  const cv = k.canvas();
  const c = cv.ctx;
  const bugs = [];
  const fx = []; // splats, stamps and words, all in card-local coords: { kind, x, y, age, life, … }
  const prints = []; // little footprints: [x, y, age]
  let card = k.ui.card();
  let o = { x: 0, y: 0, w: 680, h: 400 }; // the card's rect, refreshed on layout, a new card and scroll
  let fixedThisRound = 0;
  let sequel = false;
  let extras = 0; // squashed sequel bugs
  let outro = 0; // seconds since the last bug was dealt with
  let finished = false;

  const n = (key) => (ctx.stats[key] || 0);
  const box = () => {
    card = k.ui.card() || card;
    const r = k.rect(card);
    if (r) o = { x: r.left, y: r.top, w: r.width, h: r.height };
    else if (!card) o = { x: k.vw * 0.25, y: k.vh * 0.15, w: k.vw * 0.5, h: k.vh * 0.6 };
    return o;
  };

  // Where to wander: the title first (it stops to read it), then somewhere lower, then off an edge.
  function route(scale = 1, from) {
    box();
    const t = k.rect(card?.querySelector('.q-title, h2')) || { left: o.x + 30, top: o.y + 60, width: o.w - 60, height: 30 };
    const ty = t.top - o.y + t.height / 2;
    const left = from ?? k.chance(0.5);
    const inset = Math.min(60, o.w * 0.1);
    // it keeps above the options and the answer box: down to just over them, or along the title if that's all there is
    const Z = keepOut(k);
    const floor = Z && Z.t - o.y < o.h ? Math.max(ty + 8, Z.t - o.y - 20 * scale) : o.h - 24;
    const y = (lo, hi) => k.clamp(k.rand(lo, hi), 24, floor);
    const pts = [
      { x: k.rand(o.w * 0.22, o.w * 0.48), y: Math.min(ty + k.rand(-6, 6), floor), stop: k.rand(0.6, 1.1) },
      { x: k.rand(o.w * 0.5, o.w * 0.78), y: y(ty + 30, o.h * 0.55), stop: k.chance(0.6) ? k.rand(0.25, 0.5) : 0 },
      { x: k.rand(inset, o.w - inset), y: y(o.h * 0.45, o.h * 0.75), stop: 0 },
    ];
    if (!left) for (const p of pts) p.x = o.w - p.x;
    const start = { x: left ? -40 : o.w + 40, y: k.clamp(ty + k.rand(-30, 30), 10, floor) };
    return { x: start.x, y: start.y, ang: left ? 0 : Math.PI, pts, scale, floor };
  }

  function spawn(scale = 1, from) {
    const r = route(scale, from);
    bugs.push({ ...r, i: 0, v: 0, gait: k.rand(6), stop: 0, panic: 0, wiggle: k.rand(6), life: 0, state: 'walk', exit: null, twitch: 0 });
  }

  const pos = (b) => ({ x: o.x + b.x, y: o.y + b.y });
  const off = (b) => b.x < -46 * b.scale || b.x > o.w + 46 * b.scale || b.y < -46 * b.scale || b.y > o.h + 46 * b.scale;

  function exitFor(b) { // the nearest edge, a little past it
    const d = [[b.x, -60, b.y], [o.w - b.x, o.w + 60, b.y]];
    const [, x, y] = d.sort((a, z) => a[0] - z[0])[0];
    return { x, y: k.clamp(y + k.rand(-40, 40), 20, Math.max(20, Math.min(o.h - 20, b.floor))) };
  }

  function step(b, dt) {
    b.life += dt;
    b.twitch = Math.max(0, b.twitch - dt);
    if (b.state === 'flat') { b.flatAt += dt; if (b.flatAt > 2.6) b.state = 'gone'; return; }
    const p = pos(b);
    const near = k.pointer.active ? Math.hypot(k.pointer.x - p.x, k.pointer.y - p.y) : 1e9;
    if (near < SPOOK && b.panic <= 0) { b.panic = 0.7; b.stop = 0; b.twitch = 0.3; }
    b.panic = Math.max(0, b.panic - dt);

    const budget = b.scale < 1 ? 3.5 : 4.8;
    if (b.state === 'walk' && (b.life > budget || b.i >= b.pts.length)) { b.state = 'leave'; b.exit = exitFor(b); }
    const goal = b.state === 'leave' ? b.exit : b.pts[b.i];

    let want = Math.atan2(goal.y - b.y, goal.x - b.x);
    if (b.panic > 0 && near < SPOOK * 1.4) { // run from the cursor, but keep heading roughly where it was going
      const away = Math.atan2(p.y - k.pointer.y, p.x - k.pointer.x);
      want = away + angleTo(away, want) * 0.35;
    }
    want += Math.sin(b.life * 7 + b.wiggle) * 0.35; // insects never walk in a straight line
    b.ang += k.clamp(angleTo(b.ang, want), -dt * (b.panic ? 12 : 5), dt * (b.panic ? 12 : 5));

    if (b.stop > 0) {
      b.stop -= dt;
      b.v = Math.max(0, b.v - dt * 600);
      if (k.chance(dt * 3)) b.twitch = 0.25;
    } else {
      const top = (b.panic ? 300 : b.state === 'leave' ? 175 : 105) * (b.scale < 1 ? 1.4 : 1);
      b.v += (top - b.v) * Math.min(1, dt * (b.panic ? 14 : 5));
    }
    b.x += Math.cos(b.ang) * b.v * dt;
    b.y += Math.sin(b.ang) * b.v * dt;
    b.gait += dt * b.v * 0.42;
    if (b.state === 'walk' && b.panic <= 0) { // keep a fleeing bug on the card
      b.x = k.clamp(b.x, -40, o.w + 40);
      b.y = k.clamp(b.y, 8, o.h - 8);
    }
    if (b.v > 30 && k.chance(dt * 14)) {
      const side = prints.length % 2 ? 1 : -1;
      prints.push([b.x - Math.cos(b.ang) * 8 + Math.cos(b.ang + Math.PI / 2) * side * 5 * b.scale, b.y - Math.sin(b.ang) * 8 + Math.sin(b.ang + Math.PI / 2) * side * 5 * b.scale, 0]);
    }

    if (b.state === 'walk' && Math.hypot(goal.x - b.x, goal.y - b.y) < 14) {
      b.stop = goal.stop || 0;
      if (b.stop) b.twitch = 0.4;
      b.i++;
    }
    if (b.state === 'leave' && off(b)) escaped(b);
  }

  function angleTo(a, b) { return Math.atan2(Math.sin(b - a), Math.cos(b - a)); }

  function escaped(b) {
    b.state = 'gone';
    const ex = k.clamp(b.x, 80, o.w - 80);
    const ey = k.clamp(b.y, 30, o.h - 30);
    say(b.scale < 1 ? 'IN PROD' : 'SHIPPED', ex, ey - 10, { fill: '#ffffff', size: 26, rise: 26, life: 1.3 });
    if (!bugs.some((x) => x.state === 'walk' || x.state === 'leave')) {
      k.toast(b.scale < 1 ? 'They’re in production now.' : 'The bug got away. It’s a feature now.', { icon: '🐛', ms: 2400 });
      k.sfx.blip({ pitch: 0.5 });
    }
  }

  function swat(e) {
    if (e.button !== 0 || finished) return;
    if (inside(keepOut(k, 0), e.clientX, e.clientY)) return; // a click on your answer is yours
    box();
    const live = bugs.filter((b) => b.state === 'walk' || b.state === 'leave');
    const hit = live.map((b) => { const p = pos(b); return [b, Math.hypot(p.x - e.clientX, p.y - e.clientY)]; }).sort((a, z) => a[1] - z[1])[0];
    if (!hit || hit[1] > NEAR + 10) return;
    const [b, d] = hit;
    k.consume(e);
    if (d < HIT * Math.max(0.8, b.scale)) squash(b);
    else {
      b.panic = 1;
      b.twitch = 0.5;
      k.sfx.whoosh({ pitch: 1.8, gain: 0.35 });
      fx.push({ kind: 'whiff', x: e.clientX - o.x, y: e.clientY - o.y, age: 0, life: 0.35 });
      say(k.pick(MISSES), e.clientX - o.x, e.clientY - o.y - 22, { fill: '#ffffff', size: 20, rise: 24, life: 0.7 });
    }
  }

  function squash(b) {
    b.state = 'flat';
    b.flatAt = 0;
    fixedThisRound++;
    const total = k.score('bugs', 1, { icon: '🐞', label: 'Bugs fixed', says: 'fixed {n} bug{s}' });
    if (b.scale < 1 && ++extras === 2) k.score('infestations', 1); // the whole family, sequel included: achievements listens
    const p = pos(b);
    k.sfx.splat();
    k.sfx.thud({ pitch: 1.3, gain: 0.5, delay: 0.32 });
    if (card) k.animate(card, [{ transform: 'none' }, { transform: 'translateY(3px) scale(.997)' }, { transform: 'translateY(-1px)' }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
    k.burst(p.x, p.y, { shape: 'dot', n: 14, colors: GOO, speed: 260, gravity: 300, drag: 4, size: 6, life: 0.6 });
    fx.push({ kind: 'splat', x: b.x, y: b.y, age: 0, life: 2.6, blob: blob(b.scale), rot: k.rand(6) });
    fx.push({ kind: 'stamp', x: b.x + (b.x > o.w - 140 ? -78 : 78) * Math.max(0.8, b.scale), y: b.y - 6, age: -0.32, life: 2.2, rot: k.rand(-0.22, -0.08) });
    const above = b.y > 110;
    say(k.pick(SPLATS), b.x + (b.x > o.w / 2 ? -1 : 1) * 30, b.y + (above ? -52 : 58) * b.scale, { size: 30, rise: above ? 30 : -16 });
    if (k.reduced) { for (const f of fx) f.age = 0.3; k.after(0, () => L.redraw()); k.after(2000, k.end); }
    k.toast(`${k.pick(FIXED).replace('{n}', `${total} bug${total === 1 ? '' : 's'}`)}`, { icon: '🐞', ms: 2200 });
    // Sometimes it brought friends.
    if (!sequel && fixedThisRound === 1 && !k.reduced && k.chance(0.3)) {
      sequel = true;
      k.after(1100, () => {
        const below = o.y + o.h + 50 < k.vh;
        say('There’s never just one.', o.w / 2, below ? o.h + 30 : -18, { fill: '#ffd23f', size: 24, rise: 0, life: 2, rot: -0.03 });
        spawn(0.72, true);
        k.after(380, () => spawn(0.72, false));
      });
    }
  }

  function blob(s) {
    const pts = Array.from({ length: 16 }, (_, i) => [(i / 16) * Math.PI * 2, (24 + k.rand(-6, 9)) * s]);
    const drops = Array.from({ length: k.int(4, 7) }, () => [k.rand(6.28), k.rand(36, 54) * s, k.rand(1.8, 4.5) * s]);
    return { pts, drops };
  }

  function say(text, x, y, o2 = {}) {
    fx.push({ kind: 'text', text, x, y, age: 0, life: o2.life ?? 0.9, size: o2.size ?? 30, fill: o2.fill ?? '#ffd23f', rot: o2.rot ?? k.rand(-0.14, 0.14), rise: o2.rise ?? 44 });
  }

  // ── drawing ──────────────────────────────────────────────────────────────

  // Top-down beetle facing +x. Legs in a tripod gait: three planted while three swing.
  const LEGS = [[7, 4.2, 0.75, -0.95, 0], [2, 5, 0.05, 0.35, Math.PI], [-3, 5, -0.7, 0.9, 0]]; // x, y, tilt, knee bend, phase
  function shell(g) {
    g.beginPath();
    g.moveTo(6, -8.4);
    g.bezierCurveTo(-3, -11.8, -15, -10, -18.5, 0);
    g.bezierCurveTo(-15, 10, -3, 11.8, 6, 8.4);
    g.quadraticCurveTo(7.4, 0, 6, -8.4);
  }

  function drawBug(b) {
    const s = b.scale;
    const flat = b.state === 'flat';
    const stride = flat ? 0 : Math.min(1, b.v / 70);
    c.save();
    if (flat) c.globalAlpha = k.clamp((2.6 - b.flatAt) * 1.6);
    c.translate(o.x + b.x, o.y + b.y);
    c.rotate(b.ang);
    c.scale(s, s);
    if (flat) c.scale(1.15, 1.32);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.shadowColor = 'rgba(0,0,0,.28)';
    c.shadowBlur = 3 * s;
    c.shadowOffsetY = 2 * s;
    const tw = b.twitch > 0 ? Math.sin(b.life * 55) * 0.3 : Math.sin(b.life * 2.6 + b.wiggle) * 0.1;
    // On a dark card the legs get a faint light rim, or they'd vanish.
    const passes = ctx.dark ? [['rgba(235,225,205,.38)', 1.3], [flat ? '#2c2219' : '#16100b', 0]] : [[flat ? '#2c2219' : '#16100b', 0]];
    for (const [ink, rim] of passes) {
      c.strokeStyle = c.fillStyle = ink;
      if (rim) c.shadowColor = 'transparent';
      for (const [ax, ay, tilt, bend, ph] of LEGS) {
        for (const side of [-1, 1]) {
          const swing = Math.sin(b.gait + ph + (side > 0 ? Math.PI : 0)) * 0.38 * stride;
          const t = flat ? tilt * 0.6 : tilt + swing;
          const a1 = side * (Math.PI / 2 - t);
          const a2 = a1 + side * (flat ? bend * 0.25 : bend);
          const x0 = ax, y0 = side * ay;
          const x1 = x0 + Math.cos(a1) * 7.5, y1 = y0 + Math.sin(a1) * 7.5;
          const x2 = x1 + Math.cos(a2) * 8.5, y2 = y1 + Math.sin(a2) * 8.5;
          const x3 = x2 + Math.cos(a2 - side * bend * 0.3) * 3.2, y3 = y2 + Math.sin(a2 - side * bend * 0.3) * 3.2;
          c.lineWidth = 2.6 + rim; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
          c.lineWidth = 1.7 + rim; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
          c.lineWidth = 1 + rim; c.beginPath(); c.moveTo(x2, y2); c.lineTo(x3, y3); c.stroke();
        }
      }
      // antennae: elbowed, clubbed, twitchy when it stops to think
      for (const side of [-1, 1]) {
        const ex = 22, ey = side * (4.4 + tw * 2);
        const tx = 29 + (flat ? 3 : 0) + tw * side * 2, ty = side * (9.5 + tw * 6 + (flat ? 6 : 0));
        c.lineWidth = 1.1 + rim;
        c.beginPath(); c.moveTo(17.5, side * 2.2); c.lineTo(ex, ey); c.quadraticCurveTo(26, ey + side * 1, tx, ty); c.stroke();
        c.beginPath(); c.ellipse(tx, ty, 1.7 + rim / 2, 1.2 + rim / 2, Math.atan2(ty - ey, tx - ex), 0, Math.PI * 2); c.fill();
      }
      c.shadowColor = 'rgba(0,0,0,.28)';
    }
    // head, mandibles, thorax
    c.fillStyle = '#100c09';
    if (ctx.dark) { c.strokeStyle = 'rgba(235,225,205,.38)'; c.lineWidth = 1.3; c.beginPath(); c.ellipse(16, 0, 3.9, 4.1, 0, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = '#16100b';
    c.beginPath(); c.ellipse(16, 0, 3.9, 4.1, 0, 0, Math.PI * 2); c.fill();
    c.lineWidth = 1.2;
    for (const side of [-1, 1]) { c.beginPath(); c.moveTo(18.5, side * 2.2); c.quadraticCurveTo(21.5, side * 2.2, 21, side * 0.4); c.stroke(); }
    const th = c.createLinearGradient(10, -8, 10, 8);
    th.addColorStop(0, flat ? '#29402f' : '#2a6a4c');
    th.addColorStop(0.5, '#0f2a22');
    th.addColorStop(1, flat ? '#262a40' : '#26407a');
    c.fillStyle = th;
    c.beginPath(); c.ellipse(10, 0, 4.6, 7.3, 0, 0, Math.PI * 2); c.fill();
    // wing cases: an iridescent jewel-beetle sheen
    const el = c.createLinearGradient(-6, -11, -2, 11);
    el.addColorStop(0, flat ? '#3d5a34' : '#46c072');
    el.addColorStop(0.32, flat ? '#2a4a3c' : '#1c7a5e');
    el.addColorStop(0.68, flat ? '#2b2c4a' : '#23468a');
    el.addColorStop(1, flat ? '#3a2448' : '#6a2c8a');
    c.fillStyle = el;
    shell(c);
    c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = 'rgba(0,0,0,.6)';
    c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(6.6, 0); c.lineTo(-18.3, 0); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.18)';
    c.lineWidth = 0.6;
    for (const yy of [-6.5, -3.4, 3.4, 6.5]) { c.beginPath(); c.moveTo(4, yy); c.quadraticCurveTo(-8, yy * 1.08, -15, yy * 0.45); c.stroke(); }
    if (flat) { // a crack, and little X eyes
      c.strokeStyle = 'rgba(0,0,0,.6)';
      c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(-2, -10); c.lineTo(-5, -3.5); c.lineTo(-1, 1.5); c.lineTo(-6, 10); c.stroke();
      c.strokeStyle = '#fff';
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(14.8, side * 2 - 1.3); c.lineTo(17.4, side * 2 + 1.3);
        c.moveTo(17.4, side * 2 - 1.3); c.lineTo(14.8, side * 2 + 1.3);
        c.stroke();
      }
    } else {
      c.fillStyle = 'rgba(255,255,255,.6)';
      c.beginPath(); c.ellipse(-3.5, -5, 7.5, 1.5, -0.06, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.22)';
      c.beginPath(); c.ellipse(-6, 4.6, 5.5, 1.1, 0.08, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.45)';
      c.beginPath(); c.ellipse(10.4, -3.6, 2, 1, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(15.6, -2.2, 0.8, 0, Math.PI * 2); c.arc(15.6, 2.2, 0.8, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function drawSplat(f) {
    const a = Math.min(1, (f.life - f.age) * 1.6);
    const grow = k.ease.outBack(Math.min(1, f.age / 0.14));
    c.save();
    c.globalAlpha = a;
    c.translate(o.x + f.x, o.y + f.y);
    c.rotate(f.rot);
    c.scale(grow, grow);
    const g = c.createRadialGradient(-4, -5, 3, 0, 0, 36);
    g.addColorStop(0, '#eef59a');
    g.addColorStop(0.6, '#bcd445');
    g.addColorStop(1, '#86a02a');
    c.fillStyle = g;
    c.beginPath();
    const P = f.blob.pts;
    P.forEach(([ang, r], i) => {
      const [na, nr] = P[(i + 1) % P.length];
      const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      const mx = (x + Math.cos(na) * nr) / 2, my = (y + Math.sin(na) * nr) / 2;
      if (!i) c.moveTo(mx, my); else c.quadraticCurveTo(x, y, mx, my);
    });
    const [a0, r0] = P[0];
    const [a1, r1] = P[1];
    c.quadraticCurveTo(Math.cos(a0) * r0, Math.sin(a0) * r0, (Math.cos(a0) * r0 + Math.cos(a1) * r1) / 2, (Math.sin(a0) * r0 + Math.sin(a1) * r1) / 2);
    c.fill();
    for (const [ang, d, r] of f.blob.drops) {
      c.beginPath();
      c.arc(Math.cos(ang) * d, Math.sin(ang) * d, r, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.5)';
    c.beginPath(); c.ellipse(-6, -7, 5, 2.2, -0.5, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  // The rubber stamp, drawn once: a double border and worn-out speckles.
  const stamp = (() => {
    const S = 2, W = 124, H = 36;
    const cnv = document.createElement('canvas');
    cnv.width = W * S;
    cnv.height = H * S;
    const g = cnv.getContext('2d');
    g.scale(S, S);
    g.translate(W / 2, H / 2);
    g.font = k.font(15, 900, 'display');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const w = Math.min(W - 4, g.measureText('RESOLVED').width + 22);
    g.strokeStyle = g.fillStyle = '#d6332a';
    g.lineWidth = 2.4;
    g.beginPath(); g.roundRect(-w / 2, -14, w, 28, 5); g.stroke();
    g.lineWidth = 1;
    g.beginPath(); g.roundRect(-w / 2 + 3.5, -10.5, w - 7, 21, 3); g.stroke();
    g.fillText('RESOLVED', 0, 1);
    g.globalCompositeOperation = 'destination-out';
    const r = k.rng(7);
    for (let i = 0; i < 22; i++) { g.beginPath(); g.arc(r.rand(-w / 2, w / 2), r.rand(-15, 15), r.rand(0.3, 1.1), 0, Math.PI * 2); g.fill(); }
    return { cnv, W, H };
  })();

  function drawStamp(f) {
    if (f.age < 0) return;
    const t = Math.min(1, f.age / 0.12);
    const sc = 2.2 - k.ease.outCubic(t) * 1.2;
    c.save();
    c.translate(o.x + f.x, o.y + f.y);
    c.rotate(f.rot);
    c.scale(sc, sc);
    c.globalAlpha = Math.min(1, (f.life - f.age) * 1.6) * 0.9 * t;
    c.drawImage(stamp.cnv, -stamp.W / 2, -stamp.H / 2, stamp.W, stamp.H);
    c.restore();
  }

  function comic(text, x, y, size, fill, rot, alpha, scale) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(scale, scale);
    c.globalAlpha = alpha;
    c.font = k.font(size, 900, 'display');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size * 0.2;
    c.strokeStyle = 'rgba(0,0,0,.28)';
    c.strokeText(text, 2, 3);
    c.strokeStyle = '#1b1206';
    c.strokeText(text, 0, 0);
    c.fillStyle = fill;
    c.fillText(text, 0, 0);
    c.restore();
  }

  k.cursor(SWATTER);
  k.on(window, 'pointerdown', swat, { capture: true });
  spawn(1.3);

  k.on(window, 'scroll', box, { capture: true, passive: true });

  const L = k.loop((dt) => {
    c.clearRect(0, 0, cv.w, cv.h);

    c.fillStyle = 'rgba(110,80,50,.4)';
    for (let i = prints.length - 1; i >= 0; i--) {
      const p = prints[i];
      p[2] += dt;
      if (p[2] > 1.4) { prints.splice(i, 1); continue; }
      c.globalAlpha = 1 - p[2] / 1.4;
      c.beginPath(); c.arc(o.x + p[0], o.y + p[1], 1.1, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;

    for (const f of fx) if (f.kind === 'splat') drawSplat(f);
    for (const b of bugs) {
      if (!k.reduced) step(b, dt);
      if (b.state !== 'gone') drawBug(b);
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.age = k.reduced ? Math.max(f.age, 0.3) : f.age + dt;
      if (f.age >= f.life) { fx.splice(i, 1); continue; }
      if (f.kind === 'stamp') drawStamp(f);
      else if (f.kind === 'whiff') {
        const p = f.age / f.life;
        c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`;
        c.lineWidth = 2;
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * Math.PI * 2 + 0.3;
          c.beginPath();
          c.moveTo(o.x + f.x + Math.cos(a) * (8 + p * 14), o.y + f.y + Math.sin(a) * (8 + p * 14));
          c.lineTo(o.x + f.x + Math.cos(a) * (14 + p * 22), o.y + f.y + Math.sin(a) * (14 + p * 22));
          c.stroke();
        }
      } else if (f.kind === 'text') {
        const p = f.age / f.life;
        const pop = k.ease.outBack(Math.min(1, f.age / 0.18));
        comic(f.text, o.x + f.x, o.y + f.y - k.ease.outCubic(p) * f.rise, f.size, f.fill, f.rot, Math.min(1, (1 - p) * 2.5), 0.5 + pop * 0.5);
      }
    }

    const busy = bugs.some((b) => b.state === 'walk' || b.state === 'leave');
    if (!busy && !finished && (!sequel || bugs.length > 1)) {
      outro += dt;
      if (outro > 0.4) k.cursor(null);
      if (outro > 2.2) { finished = true; k.end(); }
    } else outro = 0;
  }, { still: 0 });

  // Reduced motion: it just sits on the title, perfectly still. You can still squash it.
  if (k.reduced) {
    const b = bugs[0];
    Object.assign(b, { x: b.pts[0].x, y: b.pts[0].y, ang: -0.4, v: 0, stop: 1e9 });
    L.redraw();
  }

  return {
    layout() { box(); },
    question() { box(); },
  };
}
