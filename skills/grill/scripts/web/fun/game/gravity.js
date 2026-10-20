// Gravity off. The sidebar flickers, then everything in it (title, progress, every decision row)
// drops out of the panel, tumbles to the floor, bounces and piles up. A beat later it all floats
// back home. The real rows are only hidden while their copies fall, so nothing in the app moves.

const G = 2600; // px/s²
const FLOOR_PAD = 3;
const BIN = 4; // px per heightmap column
const COPY = ['color', 'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing', 'textTransform', 'display', 'alignItems', 'justifyContent', 'gap', 'gridTemplateColumns', 'padding', 'textAlign', 'whiteSpace'];
const END = [
  'Gravity restored. Your decisions are fine. Probably.',
  'All decisions accounted for. One is slightly dented.',
  'Gravity back on. Please don’t tell the agent.',
  'Everything’s back where it was. Nobody saw that.',
];

// The answer box and the options, padded: nothing falls through, lands on or piles up over them.
function keepOut(k, pad = 14) {
  const rs = [k.ui.answer()?.parentElement, ...k.ui.options().map((o) => o.el)].map((el) => k.rect(el)).filter(Boolean);
  if (!rs.length) return null;
  return { l: Math.min(...rs.map((r) => r.left)) - pad, t: Math.min(...rs.map((r) => r.top)) - pad, r: Math.max(...rs.map((r) => r.right)) + pad, b: Math.max(...rs.map((r) => r.bottom)) + pad };
}
const overlaps = (Z, l, t, r, b) => !!Z && l < Z.r && r > Z.l && t < Z.b && b > Z.t;

export default function gravity(k) {
  const side = k.ui.side();
  const sr = k.rect(side);
  if (k.reduced || !sr || sr.width < 120) { k.after(10, k.end); return; } // nothing to drop (or no motion)

  const scroll = side.querySelector('.side-scroll');
  const vr = k.rect(scroll) || sr;
  const hide = ['#head', '#decisions', '#extras', '.side-foot > span:not(.fun-switch)'].flatMap((s) => [...document.querySelectorAll(s)]);
  const items = [...document.querySelectorAll('#head > *, #decisions > .row, #extras > .extra, .side-foot > span:not(.fun-switch)')]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => {
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > k.vh) return false;
      if (scroll?.contains(el) && (r.bottom < vr.top + 4 || r.top > vr.bottom - 4)) return false; // scrolled out of view
      return getComputedStyle(el).visibility !== 'hidden';
    });
  if (!items.length) { k.after(10, k.end); return; }

  const cv = k.canvas();
  const c = cv.ctx;
  const layer = k.el('div', { style: 'position:absolute;inset:0;pointer-events:none' });
  const bodies = items.map(({ el, r }, i) => {
    const cs = getComputedStyle(el);
    const box = k.el('div', { style: `position:absolute;left:0;top:0;width:${r.width}px;height:${r.height}px;will-change:transform;border-radius:8px;transition:background-color .25s, box-shadow .25s` }, layer);
    const copy = el.cloneNode(true);
    copy.removeAttribute('id');
    copy.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
    for (const p of COPY) copy.style[p] = cs[p];
    Object.assign(copy.style, { margin: '0', width: '100%', height: '100%', boxSizing: 'border-box', pointerEvents: 'none', transition: 'none', animation: 'none' });
    box.append(copy);
    return {
      el, box, i, w: r.width, h: r.height,
      x: r.left + r.width / 2, y: r.top + r.height / 2, a: 0,
      vx: 0, vy: 0, va: 0, rest: false, bounces: 0, aim: 0,
      home: () => { const h = el.isConnected && el.getBoundingClientRect(); return h && h.width ? { x: h.left + h.width / 2, y: h.top + h.height / 2 } : { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    };
  });
  for (const el of hide) k.style(el, { visibility: 'hidden' });

  // the pile: a heightmap of the floor, one column every BIN px
  let cols = [];
  const resetFloor = () => { cols = new Float32Array(Math.ceil(k.vw / BIN) + 2).fill(k.vh - FLOOR_PAD); };
  resetFloor();
  const ext = (b, a = b.a) => [Math.abs(b.w / 2 * Math.cos(a)) + Math.abs(b.h / 2 * Math.sin(a)), Math.abs(b.w / 2 * Math.sin(a)) + Math.abs(b.h / 2 * Math.cos(a))];
  const span = (x, hx) => [Math.max(0, Math.floor((x - hx) / BIN)), Math.min(cols.length - 1, Math.ceil((x + hx) / BIN))];
  
  let Z = null;
  let phase = 'flicker';
  let pt = 0;
  let words = [];
  let thuds = 0;
  let first = true;
  const byY = [...bodies]; // sorted in place each frame

  const tile = (b, on) => {
    b.box.style.background = on ? 'var(--card)' : '';
    b.box.style.boxShadow = on ? '0 0 0 4px var(--card), 0 10px 22px -10px rgba(0,0,0,.45), 0 0 0 5px color-mix(in srgb, var(--ink) 10%, transparent)' : '';
  };

  function drop() {
    phase = 'fall';
    pt = 0;
    k.sfx.clack({ pitch: 0.6, gain: 1.2 });
    k.sfx.tone({ type: 'triangle', freq: 520, to: 70, dur: 0.7, gain: 0.07 });
    Z = keepOut(k);
    if (Z) plan();
    else { // aim each one at its own slot along the whole floor, so they land as a scattered heap, not a tower
      const slots = k.shuffle(bodies.map((_, i) => (i + 0.5) / bodies.length));
      for (const b of bodies) {
        const lo = b.w / 2 + 8, hi = k.vw - b.w / 2 - 8;
        aim(b, lo + (hi - lo) * slots[b.i] + k.rand(-20, 20), k.vh - 30);
      }
    }
    for (const b of bodies) tile(b, true);
  }

  function aim(b, to, y) {
    b.vy = k.rand(-260, -60);
    const fall = (-b.vy + Math.sqrt(b.vy * b.vy + 2 * G * Math.max(40, y - b.y))) / G;
    b.vx = (to - b.x) / fall;
    b.va = k.rand(-3.2, 3.2);
  }

  // With an answer box on screen every row gets its spot up front, so nothing falls through it, lands on it or
  // piles up over it. Some tumble down beside it (straight out of the sidebar). The rest hit the floor and skid
  // underneath it and beyond, never stacked higher than just under its bottom edge. Each takes the lowest spot left.
  function plan() {
    const P = Float32Array.from(cols);
    const floorY = k.vh - FLOOR_PAD;
    const ceil = Z.b + 16;
    const topAt = (x, w) => { const [i0, i1] = span(x, w / 2); let m = Infinity; for (let i = i0; i <= i1; i++) m = Math.min(m, P[i]); return m; };
    for (const b of k.shuffle(bodies)) {
      const ranges = [[b.w / 2 + 4, Z.l - b.w / 2 - b.h / 2 - 6, false]];
      if (floorY - b.h > ceil) ranges.push([Z.l + b.w / 2, k.vw - b.w / 2 - 4, true]);
      let best = null;
      for (const [lo, hi, skid] of ranges) {
        if (hi < lo) continue;
        for (let n = 0; n < 16; n++) {
          const x = lo + (hi - lo) * (n + k.rand()) / 16;
          const top = topAt(x, b.w) - b.h;
          if (skid && x - b.w / 2 < Z.r && top < ceil) continue;
          const score = top + k.rand(0, 14);
          if (!best || score > best.score) best = { x, top, skid, score };
        }
      }
      best ||= { x: b.x, top: topAt(b.x, b.w) - b.h, skid: false }; // nowhere better: straight down where it was
      const [i0, i1] = span(best.x, b.w / 2);
      for (let i = i0; i <= i1; i++) P[i] = Math.min(P[i], best.top);
      b.skid = best.skid;
      b.wall = Z.l - 4; // the ones that tumble beside it bounce off an invisible wall rather than drift under it
      if (b.skid) { // straight down, then a skid along the floor
        b.tx = best.x;
        b.ty = best.top + b.h / 2;
        b.vy = k.rand(-200, -60);
        b.vx = 0;
        b.va = k.rand(-3.2, 3.2);
      } else {
        b.hold = k.rand(0.26, 0.4); // a beat later, once the skidders have cleared the floor
        aim(b, best.x, best.top + b.h / 2);
      }
    }
  }

  // a skidder hit the floor: slap flat (maybe upside down), skid to its spot with a couple of hops, climb onto the heap
  function skid(b, dt) {
    const floorY = k.vh - FLOOR_PAD;
    if (!b.sk) {
      const flat = Math.round(b.a / Math.PI) * Math.PI;
      const fallen = Math.max(0, b.y - b.y0);
      b.sk = { t: 0, x: b.x, a: b.a, flat, D: 0.55 + Math.abs(b.tx - b.x) / 1500, hop: Math.max(0, Math.min(fallen * 0.08, floorY - b.h - Z.b - 6, 34)) };
      noise(b, Math.min(1600, b.vy));
      b.vx = b.vy = b.va = 0;
    }
    const s = b.sk;
    s.t += dt;
    const p = Math.min(1, s.t / s.D);
    const q = k.clamp((p - 0.15) / 0.85);
    b.a = k.lerp(s.a, s.flat, k.ease.outCubic(Math.min(1, p / 0.15))) + Math.sin(q * 12) * 0.05 * (1 - q);
    b.x = k.lerp(s.x, b.tx, k.ease.outCubic(q));
    const hop = Math.abs(Math.sin(q * Math.PI * 2)) * s.hop * (1 - q);
    const base = floorY - ext(b)[1];
    b.y = k.lerp(base, b.ty, k.ease.inOutQuad(k.clamp((q - 0.6) / 0.4))) - hop;
    if (p >= 1) {
      b.rest = true;
      b.restY = b.ty;
      b.aim = s.flat + k.rand(-0.03, 0.03);
      const [i0, i1] = span(b.x, b.w / 2);
      for (let i = i0; i <= i1; i++) cols[i] = Math.min(cols[i], b.ty - b.h / 2);
      k.sfx.thud({ pitch: k.clamp(160 / b.h, 0.8, 3), gain: 0.3, pan: k.clamp(b.x / k.vw * 2 - 1, -1, 1) });
    }
  }

  // a word that would land on the answer box shifts to the nearest clear spot
  function dodge(x, y, hw, hh) {
    if (!overlaps(Z, x - hw, y - hh, x + hw, y + hh)) return [x, y];
    const spots = [[x, Z.b + hh + 2], [Z.l - hw - 2, y], [Z.r + hw + 2, y], [x, Z.t - hh - 2]]
      .filter(([px, py]) => px - hw >= 0 && px + hw <= k.vw && py - hh >= 0 && py + hh <= k.vh)
      .sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
    return spots[0] || [x, Z.t - hh - 2];
  }

  // the (rotated) box's corners, x0 y0 … x3 y3, into one reused array
  const CORNER = [-1, -1, 1, -1, 1, 1, -1, 1];
  const Q = new Float64Array(8);
  function corners(b) {
    const cs = Math.cos(b.a), sn = Math.sin(b.a), dx = b.w / 2, dy = b.h / 2;
    for (let i = 0; i < 4; i++) {
      const u = CORNER[i * 2] * dx, v = CORNER[i * 2 + 1] * dy;
      Q[i * 2] = b.x + u * cs - v * sn;
      Q[i * 2 + 1] = b.y + u * sn + v * cs;
    }
  }
  // the lowest point of those corners' outline at column x, or -Infinity if it doesn't cover x
  function bottomAt(x) {
    let m = -Infinity;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const x1 = Q[i * 2], y1 = Q[i * 2 + 1], x2 = Q[j * 2], y2 = Q[j * 2 + 1];
      if ((x < Math.min(x1, x2)) || (x > Math.max(x1, x2)) || x1 === x2) continue;
      m = Math.max(m, y1 + (y2 - y1) * (x - x1) / (x2 - x1));
    }
    return m;
  }
  // how far the box sinks into the pile (positive = overlapping)
  function sink(b) {
    const [hx] = ext(b);
    const [i0, i1] = span(b.x, hx);
    corners(b);
    let m = -Infinity;
    for (let i = i0; i <= i1; i++) m = Math.max(m, bottomAt(i * BIN + BIN / 2) - cols[i]);
    return m;
  }

  function land(b) {
    const pen = sink(b);
    if (pen < 0) return false;
    b.y -= pen;
    const hit = b.vy;
    if (hit > 260 && b.bounces < 2) { // bounce, a little less each time, with a kick of spin
      b.bounces++;
      b.vy = -hit * (b.bounces === 1 ? 0.34 : 0.2);
      b.vx *= 0.55;
      b.va = b.va * 0.4 + k.rand(-2.5, 2.5);
      noise(b, hit);
      return true;
    }
    // come to rest lying along whatever is underneath: sample the pile under both ends
    const half = b.w / 2 * 0.8;
    const at = (x) => cols[k.clamp(Math.round(x / BIN), 0, cols.length - 1)];
    b.aim = k.clamp(Math.atan2(at(b.x + half) - at(b.x - half), half * 2), -0.2, 0.2) + k.rand(-0.03, 0.03);
    const t = Math.tan(b.aim), off = b.h / 2 / Math.cos(b.aim), hx = b.w / 2 * Math.cos(b.aim);
    const [i0, i1] = span(b.x, hx);
    let y = Infinity;
    for (let i = i0; i <= i1; i++) y = Math.min(y, cols[i] - ((i * BIN + BIN / 2 - b.x) * t + off));
    b.restY = y;
    for (let i = i0; i <= i1; i++) cols[i] = Math.min(cols[i], y + (i * BIN + BIN / 2 - b.x) * t - off + 1);
    b.rest = true;
    b.vx = b.vy = b.va = 0;
    if (hit > 90) noise(b, hit);
    return true;
  }

  function noise(b, hit) {
    if (thuds > 9) return;
    thuds++;
    k.after(90, () => thuds--);
    const g = k.clamp(hit / 1400, 0.15, 1);
    k.sfx.thud({ pitch: k.clamp(160 / b.h, 0.8, 3), gain: g * 0.8, pan: k.clamp(b.x / k.vw * 2 - 1, -1, 1) });
    k.sfx.clack({ pitch: k.rand(0.7, 1.3), gain: g * 0.6 });
    if (first) {
      first = false;
      words.push({ text: k.pick(['CLATTER', 'CRASH', 'KA-THUNK', 'BONK']), x: b.x, y: k.vh - 120, age: 0, life: 1.1, size: 48, rot: k.rand(-0.14, 0.08) });
    }
    k.burst(b.x, b.y + b.h / 2, { shape: 'dot', n: 6, colors: ['rgba(150,150,150,.45)', 'rgba(190,190,190,.4)'], speed: 120, gravity: -30, drag: 3, size: 7, life: 0.6, grow: true, spread: Math.PI, angle: -Math.PI / 2 });
  }

  async function float() {
    phase = 'float';
    k.sfx.tone({ type: 'sine', freq: 180, to: 760, dur: 1.4, gain: 0.06, vibrato: { rate: 7, depth: 18 } });
    words.push({ text: k.pick(['…', 'uh', 'whoops']), x: k.clamp(bodies[0].x, 120, k.vw - 120), y: k.vh - 170, age: 0, life: 1, size: 30, rot: -0.06, white: true });
    const order = [...bodies].sort((p, q) => p.i - q.i);
    for (const b of bodies) b.to = b.home(); // read once, up front (and again on layout), not every frame
    await Promise.all(order.map(async (b, n) => {
      await k.wait(n * 45);
      if (Z && b.x + b.w / 2 > Z.l - 4) { // under it or past it: slide back out along the floor first
        const from = b.x, x = Math.min(b.to.x, Z.l - b.w / 2 - b.h / 2 - 6);
        await k.tween(380 + Math.abs(from - x) * 0.45, (e) => { b.x = k.lerp(from, x, e); }, k.ease.inOutCubic);
      }
      const from = { x: b.x, y: b.y, a: b.a };
      const wob = k.rand(6.28);
      await k.tween(1050, (e, raw) => {
        const lift = Math.sin(raw * Math.PI) * 40; // up and over, like it's being reeled in
        b.x = k.lerp(from.x, b.to.x, e);
        b.y = k.lerp(from.y, b.to.y, e) - lift;
        b.a = k.lerp(from.a, 0, e) + Math.sin(raw * 9 + wob) * 0.06 * (1 - raw);
        if (raw > 0.82) tile(b, false);
      }, k.ease.inOutCubic);
      b.x = b.to.x; b.y = b.to.y; b.a = 0;
    }));
    k.sfx.chime({ gain: 0.6, pitch: 0.75 });
    phase = 'done';
    k.toast(k.pick(END), { icon: '🪐', ms: 2600 });
    k.end();
  }

  k.loop((dt) => {
    pt += dt;
    if (phase === 'flicker') { // the panel shudders, the copies jitter in place
      for (const b of bodies) {
        b.a = Math.sin(pt * 70 + b.i * 2.1) * 0.025 * Math.min(1, pt * 4);
        b.dx = Math.sin(pt * 55 + b.i) * 1.5;
      }
      if (pt > 0.42) { for (const b of bodies) b.dx = 0; drop(); }
    } else if (phase === 'fall') {
      // lowest first, so the ones underneath are already on the floor when the next one arrives
      for (const b of byY.sort((p, q) => q.y - p.y)) {
        if (b.rest) { b.a += (b.aim - b.a) * Math.min(1, dt * 18); b.y += (b.restY - b.y) * Math.min(1, dt * 18); continue; }
        if (b.hold > 0) { b.hold -= dt; continue; }
        b.y0 ??= b.y;
        if (b.sk || (b.skid && b.y + ext(b)[1] >= k.vh - FLOOR_PAD && b.vy > 0)) { skid(b, dt); continue; }
        b.vy += G * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.a += b.va * dt;
        const [hx] = ext(b);
        const right = b.wall && !b.skid ? b.wall : k.vw - 2;
        if (b.x + hx > right) { b.x = right - hx; b.vx = -Math.abs(b.vx) * 0.4; }
        if (b.x - hx < 2) { b.x = 2 + hx; b.vx = Math.abs(b.vx) * 0.4; }
        if (!b.skid) land(b);
      }
      if ((bodies.every((b) => b.rest) && pt > 1.2) || pt > 2.6) { phase = 'pile'; pt = 0; }
    } else if (phase === 'pile') {
      for (const b of bodies) if (b.rest) { b.a += (b.aim - b.a) * Math.min(1, dt * 18); b.y += (b.restY - b.y) * Math.min(1, dt * 18); } else if (b.sk) skid(b, dt);
      if (pt > 0.75) float();
    }
    for (const b of bodies) b.box.style.transform = `translate(${(b.x - b.w / 2 + (b.dx || 0)).toFixed(1)}px, ${(b.y - b.h / 2).toFixed(1)}px) rotate(${b.a.toFixed(4)}rad)`;

    c.clearRect(0, 0, cv.w, cv.h);
    words = words.filter((w) => (w.age += dt) < w.life);
    for (const w of words) {
      const p = w.age / w.life;
      const pop = k.ease.outBack(Math.min(1, w.age / 0.16));
      c.save();
      c.font = k.font(w.size, 900, 'display');
      c.translate(...dodge(k.clamp(w.x, 140, k.vw - 140), w.y - p * 30, c.measureText(w.text).width / 2 + w.size * 0.3, w.size * 0.75));
      c.rotate(w.rot);
      c.scale(0.4 + pop * 0.6, 0.4 + pop * 0.6);
      c.globalAlpha = Math.min(1, (1 - p) * 3);
      c.font = k.font(w.size, 900, 'display');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = w.size * 0.2;
      c.strokeStyle = 'rgba(0,0,0,.3)';
      c.strokeText(w.text, 3, 4);
      c.strokeStyle = '#1b1206';
      c.strokeText(w.text, 0, 0);
      c.fillStyle = w.white ? '#fff' : '#ffd23f';
      c.fillText(w.text, 0, 0);
      c.restore();
    }
  }, { still: 0 });

  return {
    layout() { // the window changed size mid-fall: rebuild the floor and let the pile settle again
      if (phase === 'float') for (const b of bodies) b.to = b.home();
      if (phase !== 'fall' || cols.length === Math.ceil(k.vw / BIN) + 2) return;
      resetFloor();
      for (const b of bodies) if (b.rest) { b.rest = false; b.bounces = 2; }
    },
    unmount() { // ended early: fade the real ones back in rather than popping
      if (phase === 'done') return;
      for (const el of hide) if (el.isConnected) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    },
  };
}
