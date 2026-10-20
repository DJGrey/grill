// Goose. Waddles in, honks, bites the Notes panel and tugs it halfway off screen, then leaves.
// Click it to shoo it. Whatever it moved springs back, also on Esc or when fun mode goes off.

const INK = '#2b2d33';
const BEAK = '#ff9a1f', BEAK_D = '#e0700c', LEG = '#f7931e', LEG_D = '#d9730c';
const TUGS = 4;
const HEAD = 1.22; // head scale: a bigger head is a more expressive menace
const TUG_S = 0.56;
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';

// The answer box and the options, padded: the goose never stands, walks or honks over them.
function keepOut(k, pad = 14) {
  const rs = [k.ui.answer()?.parentElement, ...k.ui.options().map((o) => o.el)].map((el) => k.rect(el)).filter(Boolean);
  if (!rs.length) return null;
  return { l: Math.min(...rs.map((r) => r.left)) - pad, t: Math.min(...rs.map((r) => r.top)) - pad, r: Math.max(...rs.map((r) => r.right)) + pad, b: Math.max(...rs.map((r) => r.bottom)) + pad };
}
const inside = (Z, x, y) => !!Z && x > Z.l && x < Z.r && y > Z.t && y < Z.b;
const overlaps = (Z, l, t, r, b) => !!Z && l < Z.r && r > Z.l && t < Z.b && b > Z.t;

export default function goose(k, ctx) {
  const cv = k.canvas();
  const c = cv.ctx;
  let S = k.clamp(k.vh / 860, 0.8, 1.12);
  const icon = k.canRender('🪿', 'emoji') ? '🪿' : '🦢';
  const GH = 168, GW = 104; // how far it reaches above its feet (head up, mid-honk) and to either side, at scale 1
  let Z = keepOut(k);

  // what it steals: the Notes panel (unless you're writing a note), else the sidebar, else nothing
  let T = (() => {
    const notes = k.ui.notes(), side = k.ui.side();
    const nr = k.rect(notes), sr = k.rect(side);
    const writing = notes?.contains(document.activeElement);
    if (nr && nr.width > 220 && nr.left < k.vw - 200 && !writing) return { el: notes, dir: 1, edge: nr.left, w: nr.width, name: 'notes' };
    if (sr && sr.width > 160) return { el: side, dir: -1, edge: sr.right, w: sr.width, name: 'sidebar' };
    return null;
  })();
  // a tug that would put it over the answer box (it never should, but windows are odd shapes) isn't worth it
  if (T) {
    const a = T.edge + T.dir * 152 * S, b = T.dir > 0 ? k.vw : 0;
    if (overlaps(Z, Math.min(a, b) - GW * S, k.vh - (14 + GH) * S, Math.max(a, b) + GW * S, k.vh)) T = null;
  }

  // Nothing to steal: it strolls in, honks at you and leaves. Find a lane that keeps it off the answer box:
  // under it, beside it, a smaller goose under it, or stood on top of the options like they're a shelf.
  function plan(shrink) {
    const low = (s) => k.vh - 14 * s;
    if (!Z || low(S) - GH * S >= Z.b) return { f: low(S), x: k.vw * 0.55, dir: 1 };
    const s2 = (k.vh - Z.b) / (GH + 14);
    if (shrink && s2 >= 0.62) { S = Math.min(S, s2); return { f: low(S), x: k.vw * 0.55, dir: 1 }; }
    const room = [[k.vw - Z.r, 1, Z.r], [Z.l, -1, 0]].sort((a, b) => b[0] - a[0])[0];
    if (room[0] >= 2 * GW * S + 12) return { f: low(S), x: room[2] + room[0] / 2, dir: room[1] };
    if (Z.t - 2 - GH * S >= 4) return { f: Z.t - 2, x: k.clamp(k.vw * 0.55, Z.l + GW * S, Z.r - GW * S), dir: 1 };
    return null;
  }
  let lane = T ? null : plan(true);
  if (!T && !lane) { // no room anywhere that isn't your answer: it peers in, thinks better of it
    k.toast('A goose looked in, saw you were busy, and left. This time.', { icon, ms: 2600 });
    k.after(10, k.end);
    return {};
  }
  const dir = T ? T.dir : lane.dir; // which way the panel goes, and the side the goose comes from
  const pull = T ? Math.round(T.w * 0.5) : 0;
  const reach = 100 * S;

  const g = { x: dir > 0 ? k.vw + 120 * S : -120 * S, face: -dir, walk: 0, phase: 0, neck: 0, raise: 0, beak: 0, flap: 0, lean: 0, grip: false, alarm: 0, spin: 1 };
  const P = { off: 0, rot: 0, dy: 0 }; // the panel
  const fx = []; // comic words
  const feathers = [];
  let phase = T ? 'in' : 'stroll';
  let pt = 0; // time in phase
  let tug = 0;
  let hover = false;
  let back = null; // the panel's spring home, once started

  const floor = () => (lane ? lane.f : k.vh - 14 * S);
  const tipX = () => (T ? T.edge + P.off + dir * 6 * S : 0);
  const stopX = () => (T ? tipX() + dir * (reach + 46 * S) : lane.x);
  const go = (p) => { phase = p; pt = 0; };

  function panel() {
    if (!T) return;
    const moved = Math.abs(P.off) > 0.3 || Math.abs(P.rot) > 0.01;
    k.style(T.el, { transform: moved ? `translate(${P.off.toFixed(1)}px, ${P.dy.toFixed(1)}px) rotate(${P.rot.toFixed(2)}deg)` : null, transition: moved ? 'none' : null, willChange: moved ? 'transform' : null });
  }

  function home(ms = 650) {
    if (!T || back) return back;
    const from = P.off;
    if (Math.abs(from) < 0.5) return (back = Promise.resolve());
    k.sfx.whoosh({ pitch: 0.8, gain: 0.5, pan: dir * 0.6 });
    return (back = k.tween(ms, (e) => { P.off = from * (1 - e); P.rot = 0; P.dy = 0; panel(); }, k.ease.outBack));
  }

  function say(text, x, y, o = {}) {
    fx.push({ text, x, y, age: 0, life: o.life ?? 0.9, size: (o.size ?? 40) * S, fill: o.fill ?? '#ffffff', rot: o.rot ?? k.rand(-0.16, 0.16), rise: o.rise ?? 34 });
  }

  function featherPuff(x, y, n) {
    for (let i = 0; i < n; i++) feathers.push({ x: x + k.rand(-20, 20) * S, y: y + k.rand(-14, 14) * S, vx: k.rand(-120, 120), vy: k.rand(-220, -60), rot: k.rand(6.28), vr: k.rand(-4, 4), age: 0, life: k.rand(1.6, 2.6), sway: k.rand(6.28), s: k.rand(0.7, 1.15) * S });
  }

  // head position in the goose's own frame (facing left, feet at 0,0, scale 1)
  const sx = () => (g.face < 0 ? 1 : -1);
  const toLocal = (x, y) => [(x - g.x) / (S * sx()), (y - floor()) / S];
  function head() {
    if (g.grip && T) {
      const [lx, ly] = toLocal(tipX(), floor() - 86 * S);
      return { x: lx + 33 * HEAD, y: ly - 1.5 * HEAD, a: 0 };
    }
    const n = g.neck, r = g.raise;
    return { x: k.lerp(-46, -94, n) - r * 4, y: k.lerp(-124, -88, n) - r * 10 + Math.sin(g.phase * 2) * 2 * g.walk, a: r * 0.45 - n * 0.05 };
  }

  function hit(x, y) { // generous: body, neck and head
    const [lx, ly] = toLocal(x, y);
    const h = head();
    return ((lx - 10) / 70) ** 2 + ((ly + 56) / 44) ** 2 < 1 || Math.hypot(lx - h.x, ly - h.y) < 30 || Math.hypot(lx - (h.x - 34) / 2, ly - (h.y - 72) / 2) < 30;
  }

  function shoo(e) {
    if (e.button !== 0 || !['in', 'honk', 'lunge', 'tug', 'release', 'stroll'].includes(phase)) return;
    if (!hit(e.clientX, e.clientY) || inside(keepOut(k, 0), e.clientX, e.clientY)) return; // a click on your answer is yours
    k.consume(e);
    g.grip = false;
    g.alarm = 1;
    g.beak = 1;
    k.sfx.honk({ pitch: 1.35, gain: 0.9 });
    k.sfx.whoosh({ pitch: 1.6, gain: 0.5 });
    featherPuff(g.x, floor() - 70 * S, 14);
    say(k.pick(['HONK?!', 'HONK!?', 'H O N K']), g.x - g.face * 10 * S, floor() - 160 * S, { size: 46, fill: '#ffd23f' });
    const n = (ctx.stats.geese || 0) + 1;
    k.score('geese', 1, { icon, label: 'Geese shooed', says: n === 1 ? 'shooed {n} goose' : 'shooed {n} geese' });
    home(520);
    go('flee');
  }
  k.on(window, 'pointerdown', shoo, { capture: true });

  function step(dt, speed) {
    const d = speed * dt;
    g.x += d * g.face;
    g.phase += (d / (46 * S)) * Math.PI * 2;
    return d;
  }

  function update(dt) {
    pt += dt;
    const f = floor();
    if (phase === 'in' || phase === 'stroll') {
      g.walk = Math.min(1, g.walk + dt * 4);
      const target = stopX();
      step(dt, 235 * S);
      if ((target - g.x) * g.face <= 0) { g.x = target; go('honk'); k.sfx.honk({ pan: dir * 0.4 }); }
    } else if (phase === 'honk') {
      g.walk = Math.max(0, g.walk - dt * 6);
      g.raise = k.ease.outBack(Math.min(1, pt / 0.18)) * (pt < 0.6 ? 1 : Math.max(0, 1 - (pt - 0.6) / 0.2));
      g.beak = pt < 0.6 ? Math.abs(Math.sin(pt * Math.PI / 0.2)) : 0;
      if (pt > 0.05 && !fx.some((x) => x.honk)) {
        const h = head();
        say('HONK', g.x + (h.x - 20) * S * sx(), f + (h.y - 46) * S, { size: 48, rot: -0.12 * g.face, life: 1 });
        fx.at(-1).honk = true;
      }
      if (pt > 0.85) { if (T) go('lunge'); else go('turn'); }
    } else if (phase === 'lunge') {
      const p = Math.min(1, pt / 0.32);
      g.neck = k.ease.outBack(p);
      g.beak = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      g.x = tipX() + dir * (reach + 46 * S * (1 - k.ease.outCubic(p)));
      if (p >= 1) {
        g.grip = true;
        g.beak = 0;
        k.sfx.clack({ pitch: 0.7, gain: 1.4 });
        k.sfx.thud({ pitch: 1.8, gain: 0.4 });
        P.rot = dir * 0.6;
        k.toast(`A goose has your ${T.name}. Click it to shoo.`, { icon, ms: 2400 });
        go('tug');
      }
    } else if (phase === 'tug') {
      const p = pt / TUG_S;
      const base = tug * (pull / TUGS);
      if (p < 0.55) { // strain: lean back, wings out, the neck stretches
        const e = k.ease.inOutQuad(p / 0.55);
        g.lean = e * 0.16;
        g.flap = e * 0.75;
        g.x = tipX() + dir * (reach + e * 34 * S);
        g.walk = 0.35;
        g.phase += dt * 22;
        P.off = dir * base;
        if (!g.said && p > 0.25) {
          g.said = true;
          const h = head();
          say(k.pick(['mmf!', 'hrrk', 'mmph!', 'nngh']), g.x + (h.x - 10) * S * sx(), f + (h.y - 40) * S, { size: 22, life: 0.6, rise: 18 });
        }
      } else { // yank: the panel lurches, the goose stumbles back with it
        const e = k.ease.outBack(Math.min(1, (p - 0.55) / 0.3));
        if (!g.yanked) {
          g.yanked = true;
          k.sfx.thud({ pitch: 1.4 + tug * 0.1, gain: 0.45 });
          k.sfx.noise({ dur: 0.16, filter: 'bandpass', freq: 900, to: 400, q: 1.5, gain: 0.08 });
          featherPuff(g.x + dir * 20 * S, f - 80 * S, 2);
        }
        P.off = dir * (base + e * (pull / TUGS));
        P.rot = dir * (0.9 - e * 0.5) * Math.sin(Math.min(1, (p - 0.55) / 0.45) * Math.PI);
        P.dy = -Math.sin(Math.min(1, (p - 0.55) / 0.3) * Math.PI) * 3;
        g.lean = 0.16 * (1 - e);
        g.flap = 0.75 * (1 - e);
        g.x = tipX() + dir * (reach + (1 - Math.min(1, e)) * 34 * S);
      }
      if (p >= 1) {
        tug++;
        g.said = g.yanked = false;
        pt = 0;
        if (tug >= TUGS) {
          P.rot = 0; P.dy = 0;
          g.grip = false;
          go('release');
          k.sfx.honk({ pitch: 1.12, gain: 1, pan: dir * 0.5 });
        }
      }
    } else if (phase === 'release') {
      g.neck = Math.max(0, 1 - pt / 0.25);
      g.raise = Math.min(1, pt / 0.15);
      g.flap = Math.abs(Math.sin(pt * 13)) * (pt < 0.5 ? 1 : 0);
      g.beak = pt < 0.45 ? Math.abs(Math.sin(pt * 14)) : 0;
      if (!g.said) {
        g.said = true;
        say(k.pick(['HONK.', 'HONK!', 'HONK HONK']), g.x - dir * 10 * S, f - 175 * S, { size: 58, fill: '#ffd23f', life: 1.1, rise: 40 });
      }
      if (pt > 0.75) { g.said = false; go('turn'); }
    } else if (phase === 'turn') {
      g.raise = Math.max(0, g.raise - dt * 5);
      g.flap = 0;
      g.spin = Math.cos(Math.min(1, pt / 0.24) * Math.PI);
      if (pt >= 0.24) { g.face = dir; g.spin = 1; go('out'); }
    } else if (phase === 'out') {
      g.walk = Math.min(1, g.walk + dt * 4);
      step(dt, 290 * S);
      if (Math.floor(pt * 3) !== Math.floor((pt - dt) * 3) && k.chance(0.5)) k.sfx.tone({ type: 'triangle', freq: 210, to: 110, dur: 0.05, gain: 0.05, pan: dir * 0.5 });
      if (offscreen()) go(T ? 'linger' : 'gone');
    } else if (phase === 'flee') {
      if (pt < 0.12) { g.spin = Math.cos((pt / 0.12) * Math.PI); return; }
      g.face = dir;
      g.spin = 1;
      g.neck = 0.7;
      g.raise = 0;
      g.lean = -0.1;
      g.walk = 1;
      g.flap = 0.4 + Math.abs(Math.sin(pt * 26)) * 0.6;
      g.beak = Math.abs(Math.sin(pt * 9));
      step(dt, 820 * S);
      if (k.chance(dt * 10)) featherPuff(g.x, f - 60 * S, 1);
      if (offscreen() && !g.done) {
        g.done = true;
        k.toast(k.pick(['Goose shooed. It will remember this.', 'Goose shooed. It knows where you live.', 'Goose shooed. For now.']), { icon, ms: 2400 });
        Promise.resolve(home()).then(() => k.after(900, k.end));
      }
    } else if (phase === 'linger') {
      if (pt > 0.55 && !back) {
        k.toast(k.pick(['Notes recovered. Goose still at large.', 'Panel returned. The goose kept a corner.', 'Notes back. Nobody saw anything.']), { icon: '🗂️', ms: 2400 });
        home(700).then(() => k.after(500, k.end));
      }
    } else if (phase === 'gone') {
      k.end();
    }
    if (g.alarm) g.alarm = Math.max(0, g.alarm - dt * 0.4);
  }
  const offscreen = () => (dir > 0 ? g.x > k.vw + 140 * S : g.x < -140 * S);

  // ── drawing ──
  function poly(pts) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); }
  function rot([x, y], a, [px, py]) {
    const cs = Math.cos(a), sn = Math.sin(a);
    return [px + (x - px) * cs - (y - py) * sn, py + (x - px) * sn + (y - py) * cs];
  }

  function wing(side) { // side 0 = near, 1 = far
    c.save();
    c.translate(-16, -70);
    c.rotate(-g.flap * (1.45 + side * 0.15) + side * 0.06);
    c.scale(1, 1 - g.flap * 0.15);
    c.beginPath();
    c.moveTo(-6, 2);
    c.bezierCurveTo(10, -18, 52, -18, 92, 0);
    c.quadraticCurveTo(84, 4, 77, 6);
    c.quadraticCurveTo(82, 9, 84, 12);
    c.quadraticCurveTo(74, 12, 66, 12);
    c.quadraticCurveTo(70, 16, 71, 19);
    c.quadraticCurveTo(60, 17, 52, 17);
    c.quadraticCurveTo(55, 21, 55, 24);
    c.quadraticCurveTo(42, 21, 32, 20);
    c.quadraticCurveTo(12, 19, -6, 2);
    c.fillStyle = side ? '#d4d9e1' : '#eef1f5';
    c.fill();
    c.lineWidth = 2.2;
    c.strokeStyle = INK;
    c.stroke();
    c.lineWidth = 1.3;
    c.strokeStyle = 'rgba(43,45,51,.45)';
    c.beginPath();
    c.moveTo(20, 5); c.quadraticCurveTo(44, 0, 74, 5);
    c.moveTo(28, 12); c.quadraticCurveTo(46, 8, 64, 11);
    c.stroke();
    c.restore();
  }

  function leg(hx, ph, back) {
    const lift = Math.max(0, -Math.cos(ph)) * 8 * g.walk;
    const fx0 = hx + Math.sin(ph) * 13 * g.walk;
    c.strokeStyle = INK;
    c.lineCap = 'round';
    c.lineWidth = 7.5;
    c.beginPath(); c.moveTo(hx, -32); c.lineTo(fx0, -lift - 3); c.stroke();
    c.strokeStyle = back ? LEG_D : LEG;
    c.lineWidth = 4.5;
    c.beginPath(); c.moveTo(hx, -32); c.lineTo(fx0, -lift - 3); c.stroke();
    c.beginPath();
    c.moveTo(fx0 + 4, -lift - 1);
    c.lineTo(fx0 - 16, -lift + 1);
    c.quadraticCurveTo(fx0 - 12, -lift - 7, fx0 + 1, -lift - 5);
    c.closePath();
    c.fillStyle = back ? LEG_D : LEG;
    c.fill();
    c.lineWidth = 1.8;
    c.strokeStyle = INK;
    c.lineJoin = 'round';
    c.stroke();
  }

  function drawGoose() {
    const f = floor();
    const h = head();
    c.save();
    c.translate(g.x, f);
    c.scale(S * sx() * g.spin, S);

    c.fillStyle = 'rgba(0,0,0,.2)'; // ground shadow
    c.beginPath(); c.ellipse(6, 1, 50, 6.5, 0, 0, Math.PI * 2); c.fill();

    leg(16, g.phase + Math.PI, true);
    leg(-4, g.phase, false);

    const bob = -Math.abs(Math.cos(g.phase)) * 3 * g.walk;
    const tilt = Math.sin(g.phase) * 0.07 * g.walk + g.lean;
    const pivot = [6, -34];
    const B = rot([-34, -72 + bob], tilt, pivot);
    const Bin = rot([-24, -62 + bob], tilt, pivot);
    const n = g.grip ? 1 : g.neck;
    const C1 = [B[0] - 14 - n * 6, B[1] - 18 + n * 2];
    const C2 = [h.x + k.lerp(10, 26, n), h.y + k.lerp(22, 4, n)];
    const neck = (w, col, from) => {
      c.strokeStyle = col;
      c.lineWidth = w;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(...from); c.bezierCurveTo(...C1, ...C2, h.x, h.y); c.stroke();
    };
    const headShape = (grow, col) => {
      c.save();
      c.translate(h.x, h.y);
      c.rotate(h.a);
      c.scale(HEAD, HEAD);
      c.fillStyle = col;
      c.beginPath(); c.ellipse(0, 0, 15.5 + grow, 13 + grow, -0.15, 0, Math.PI * 2); c.fill();
      c.restore();
    };

    if (g.flap > 0.05) { c.save(); c.translate(0, bob); c.translate(...pivot); c.rotate(tilt); c.translate(-pivot[0], -pivot[1]); c.translate(6, -4); wing(1); c.restore(); }
    neck(26.5, INK, B); // outline first, so the white bits merge into one shape
    headShape(2.4, INK);

    c.save(); // body
    c.translate(0, bob);
    c.translate(...pivot); c.rotate(tilt); c.translate(-pivot[0], -pivot[1]);
    c.beginPath();
    c.moveTo(-40, -72);
    c.bezierCurveTo(-60, -64, -58, -38, -32, -31);
    c.bezierCurveTo(-6, -24, 32, -27, 50, -40);
    c.bezierCurveTo(60, -47, 70, -60, 80, -76);
    c.bezierCurveTo(66, -74, 54, -76, 42, -80);
    c.bezierCurveTo(16, -92, -18, -88, -40, -72);
    const body = c.createLinearGradient(0, -92, 0, -26);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.6, '#f6f7f9');
    body.addColorStop(1, '#d9dde4');
    c.fillStyle = body;
    c.fill();
    c.lineWidth = 2.4;
    c.strokeStyle = INK;
    c.lineJoin = 'round';
    c.stroke();
    c.strokeStyle = 'rgba(43,45,51,.35)'; // tail feathers
    c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(60, -66); c.lineTo(72, -72); c.moveTo(56, -60); c.lineTo(68, -64); c.stroke();
    c.restore();

    neck(21, '#ffffff', Bin);
    headShape(0, '#ffffff');
    c.save(); c.translate(0, bob); c.translate(...pivot); c.rotate(tilt); c.translate(-pivot[0], -pivot[1]); wing(0); c.restore();

    // head details: beak, eye, cross eyebrow
    c.save();
    c.translate(h.x, h.y);
    c.rotate(h.a);
    c.scale(HEAD, HEAD);
    const open = g.beak * 0.55;
    if (open > 0.05) {
      c.fillStyle = '#5a1418';
      poly([[-10, -1], [-28, 1], ...[[-28, 4]].map((p) => rot(p, -open, [-10, 3])), [-10, 6]]);
      c.fill();
    }
    c.save(); // lower mandible, with the goose's horrible little tongue teeth
    c.translate(-10, 3); c.rotate(-open); c.translate(10, -3);
    c.beginPath();
    c.moveTo(-10, 2); c.quadraticCurveTo(-21, 4, -29, 4); c.lineTo(-29, 6.5); c.quadraticCurveTo(-20, 10, -10, 8.5); c.closePath();
    c.fillStyle = BEAK_D; c.fill();
    c.lineWidth = 1.8; c.strokeStyle = INK; c.stroke();
    if (open > 0.2) {
      c.fillStyle = '#ff8fa0';
      c.beginPath(); c.moveTo(-11, 2.5); c.quadraticCurveTo(-18, 3, -23, 3.5); c.lineTo(-11, 5); c.fill();
      c.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) { const x = -12 - i * 2.8; poly([[x, 2.6], [x - 1.4, 0.6], [x - 2.6, 2.8]]); c.fill(); }
    }
    c.restore();
    c.beginPath(); // upper mandible
    c.moveTo(-10, -5.5); c.quadraticCurveTo(-26, -6, -34, 1.5); c.lineTo(-31.5, 3.5); c.quadraticCurveTo(-21, 1.5, -10, 3.5); c.closePath();
    c.fillStyle = BEAK; c.fill();
    c.lineWidth = 1.9; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
    c.fillStyle = '#c4560a';
    c.beginPath(); c.ellipse(-31, 1.2, 2.6, 2, 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(43,45,51,.6)';
    c.beginPath(); c.ellipse(-18, -2.6, 1.6, 0.9, -0.1, 0, Math.PI * 2); c.fill();
    const wide = g.alarm > 0.1;
    if (wide) { c.fillStyle = '#fff'; c.beginPath(); c.arc(-3, -4, 5.2, 0, Math.PI * 2); c.fill(); c.lineWidth = 1.4; c.strokeStyle = INK; c.stroke(); }
    c.fillStyle = INK;
    c.beginPath(); c.arc(-3.5, -4, wide ? 2.4 : 3.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(-4.6, -5.2, 1.1, 0, Math.PI * 2); c.fill();
    c.strokeStyle = INK; // the eyebrow geese don't have but definitely should
    c.lineWidth = 2.8;
    c.lineCap = 'round';
    c.beginPath();
    if (wide) { c.moveTo(4, -12.5); c.lineTo(-9, -12); } else { c.moveTo(5, -11.5); c.lineTo(-9, -6.8); }
    c.stroke();
    c.restore();

    if (g.grip) { // grip strain marks at the beak
      c.strokeStyle = 'rgba(43,45,51,.55)';
      c.lineWidth = 1.6;
      const [tx, ty] = [h.x - 31 * HEAD, h.y + 3 * HEAD];
      for (const a of [-0.9, 0, 0.9]) { c.beginPath(); c.moveTo(tx + Math.cos(a + Math.PI) * 9, ty + Math.sin(a + Math.PI) * 9); c.lineTo(tx + Math.cos(a + Math.PI) * 15, ty + Math.sin(a + Math.PI) * 15); c.stroke(); }
    }
    c.restore();
  }

  function drawFeathers(dt) {
    for (let i = feathers.length - 1; i >= 0; i--) {
      const p = feathers[i];
      p.age += dt;
      if (p.age > p.life) { feathers.splice(i, 1); continue; }
      p.vy += 160 * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.6 * dt;
      p.x += (p.vx + Math.sin(p.age * 5 + p.sway) * 40) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      c.save();
      c.globalAlpha = Math.min(1, (p.life - p.age) * 2);
      c.translate(p.x, p.y);
      c.rotate(p.rot + Math.sin(p.age * 5 + p.sway) * 0.6);
      c.scale(p.s, p.s);
      c.beginPath();
      c.moveTo(-9, 0); c.quadraticCurveTo(0, -5, 9, 0); c.quadraticCurveTo(0, 4, -9, 0);
      c.fillStyle = '#fff'; c.fill();
      c.lineWidth = 1; c.strokeStyle = 'rgba(43,45,51,.7)'; c.stroke();
      c.beginPath(); c.moveTo(-11, 0.5); c.lineTo(7, 0); c.stroke();
      c.restore();
    }
  }

  function comic(text, x, y, size, fill, r = 0, alpha = 1, scale = 1) {
    c.save();
    c.translate(x, y);
    c.rotate(r);
    c.scale(scale, scale);
    c.globalAlpha = alpha;
    c.font = k.font(size, 900, 'display');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size * 0.2;
    c.strokeStyle = 'rgba(0,0,0,.3)';
    c.strokeText(text, 3, 4);
    c.strokeStyle = '#1b1206';
    c.strokeText(text, 0, 0);
    c.fillStyle = fill;
    c.fillText(text, 0, 0);
    c.restore();
  }

  function drawWords(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const w = fx[i];
      w.age += dt;
      const p = w.age / w.life;
      if (p >= 1) { fx.splice(i, 1); continue; }
      const pop = k.ease.outBack(Math.min(1, w.age / 0.16));
      c.font = k.font(w.size, 900, 'display');
      const half = c.measureText(w.text).width / 2 + w.size * 0.3;
      const [x, y] = dodge(k.clamp(w.x, half + 8, k.vw - half - 8), w.y - k.ease.outCubic(p) * w.rise, half, w.size * 0.75);
      comic(w.text, x, y, w.size, w.fill, w.rot, Math.min(1, (1 - p) * 3), 0.4 + pop * 0.6);
    }
  }

  // a word that would land on the answer box shifts to the nearest clear spot (usually beside the goose)
  function dodge(x, y, hw, hh) {
    if (!overlaps(Z, x - hw, y - hh, x + hw, y + hh)) return [x, y];
    const spots = [[x, Z.t - hh - 2], [x, Z.b + hh + 2], [Z.l - hw - 2, y], [Z.r + hw + 2, y]]
      .filter(([px, py]) => px - hw >= 0 && px + hw <= k.vw && py - hh >= 0 && py + hh <= k.vh)
      .sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
    return spots[0] || [x, Z.t - hh - 2];
  }

  k.loop((dt) => {
    update(dt);
    if (T && !back) panel();
    c.clearRect(0, 0, cv.w, cv.h);
    if (!offscreen() || phase === 'in' || phase === 'stroll') drawGoose();
    drawFeathers(dt);
    drawWords(dt);
    const over = k.pointer.active && phase !== 'flee' && phase !== 'out' && hit(k.pointer.x, k.pointer.y);
    if (over !== hover) { hover = over; k.cursor(over ? 'pointer' : null); }
  }, { still: 0 });

  return {
    layout() { // the panel moved under us (resize): re-measure its resting edge
      Z = keepOut(k);
      if (lane) { // the card moved (it slid in, scrolled or resized): find a new lane while still walking in, else bolt if it's in the way
        const next = phase === 'stroll' && plan(true);
        if (next && next.dir === lane.dir) lane = next;
        else if (overlaps(Z, g.x - GW * S, lane.f - GH * S, g.x + GW * S, lane.f)) k.end();
      }
      if (!T) return;
      const r = k.rect(T.el);
      if (r) T.edge = (dir > 0 ? r.left : r.right) - P.off;
    },
    unmount() { // ended early (Esc, fun off): spring the panel home instead of snapping it
      if (!T || Math.abs(P.off) < 0.5) return;
      T.el.animate([{ transform: `translate(${P.off}px, ${P.dy}px) rotate(${P.rot}deg)` }, { transform: 'none' }], { duration: k.reduced ? 1 : 520, easing: SPRING });
    },
  };
}
