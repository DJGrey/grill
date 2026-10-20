// Unicorn. You answer, and a unicorn gallops across the screen trailing a rainbow, with a word
// about what you picked. Now and then it's a narwhal, a yeti or a llama instead.

const RAINBOW = ['#ff4d6d', '#ff9f1c', '#ffd23f', '#3bceac', '#3a9bdc', '#9b5de5'];
const INK = '#3d2c5e';
const DUR = 2.4; // seconds to cross

const CAST = {
  unicorn: { odds: 0.82, speech: {
    rec: ['Took the ★. Majestic.', 'Recommended AND radiant', 'Textbook. Sparkly textbook.', 'Agreed. Galloping on.'],
    rebel: ['Off-script. Iconic.', 'The ★ was a suggestion', 'Bold pick, bestie', 'Rebel unicorn approves'],
    custom: ['Wrote your own. Legend.', 'Freestyle! Neigh-ce.'],
    revision: ['Changed your mind? Valid.', 'Second thoughts are magic too'],
    fast: ['Fast! Gotta gallop.', 'Decisive. Hooves out.'],
    slow: ['Worth the wait', 'Took your time. Majestic.'],
    plain: ['Neigh-cely done', 'Decided! Off I trot.', 'Another one! Wheee'],
  } },
  narwhal: { odds: 0.06, rare: 'A wild narwhal appeared. The unicorn of the sea, on land, briefly.', icon: '🐳', speech: { plain: ['Unicorn of the sea, reporting', 'Wrong habitat. Right answer.', 'Tusk-tastic choice'] } },
  yeti: { odds: 0.06, rare: 'Rare sighting: a yeti. Nobody will believe you.', icon: '❄️', speech: { plain: ['Abominably good choice', 'YETI APPROVES', 'Snow problem'] } },
  llama: { odds: 0.06, rare: 'A llama turned up. Nobody knows why.', icon: '🦙', speech: { plain: ['No probllama!', 'Llama-zing pick', 'Alpaca my bags, done'] } },
};

// The answer box and the options, padded: the run, the rainbow and the bubble all stay off them.
function keepOut(k, pad = 14) {
  const rs = [k.ui.answer()?.parentElement, ...k.ui.options().map((o) => o.el)].map((el) => k.rect(el)).filter(Boolean);
  if (!rs.length) return null;
  return { l: Math.min(...rs.map((r) => r.left)) - pad, t: Math.min(...rs.map((r) => r.top)) - pad, r: Math.max(...rs.map((r) => r.right)) + pad, b: Math.max(...rs.map((r) => r.bottom)) + pad };
}
const TOP = 135, BOT = 90, ARC = 50; // reach above and below its middle (horn, hooves, a yeti's arms), and the leap, at scale 1

export default function unicorn(k, ctx) {
  const cv = k.canvas();
  const c = cv.ctx;
  const trail = k.canvas({ dpr: 1 }); // the rainbow, faded a little every frame
  trail.el.remove();
  const tc = trail.ctx;

  // Who shows up. Forced test runs go through the whole cast in turn.
  const names = Object.keys(CAST);
  let who;
  let dir = k.chance(0.5) ? 1 : -1;
  if (ctx.forced) {
    const i = k.load('turn', 0);
    k.save('turn', i + 1);
    who = names[i % names.length];
    dir = Math.floor(i / names.length) % 2 ? -1 : 1;
  } else {
    let r = k.rand();
    who = names.find((n) => (r -= CAST[n].odds) < 0) || 'unicorn';
  }
  const cast = CAST[who];
  const a = ctx.lastAnswer;
  const mood = !a ? 'plain'
    : a.revision ? 'revision'
    : a.custom && !a.picks.length ? 'custom'
    : a.seconds < 4 ? 'fast'
    : a.seconds > 120 ? 'slow'
    : a.hasRec ? (a.tookRec ? 'rec' : 'rebel')
    : 'plain';
  const line = k.pick(cast.speech[mood] || cast.speech.plain);
  if (cast.rare) k.toast(cast.rare, { icon: cast.icon, ms: 3200 });
  k.score('unicorns', 1, { icon: '🦄', label: 'Unicorn sightings', says: 'saw {n} unicorn{s}' });

  let S = k.clamp(Math.min(k.vh / 820, k.vw / 1100), 0.7, 1.15);
  // The lane it gallops along. With an answer box on screen: the strip under it, else the strip above it, flattening
  // the leap and then shrinking the creature to fit. It never crosses the answer box or the options.
  function lane(s) {
    const Z = keepOut(k);
    if (!Z) {
      const sp = k.space(), card = sp.card;
      const bottom = sp.gaps.find((g) => g.where === 'bottom' && g.h > 170 * s);
      return { s, arc: ARC * s, t: 0, b: k.vh, y0: bottom ? bottom.y + bottom.h * 0.6 : card ? Math.min(k.vh - 110 * s, card.top + card.height * 0.62) : k.vh * 0.6 };
    }
    const fit = (t, b) => {
      const room = b - t - 8;
      const sc = Math.min(s, room / (TOP + BOT));
      const arc = k.clamp(room - (TOP + BOT) * sc, 0, ARC * sc);
      return { s: sc, arc, t, b, y0: t + 4 + (TOP * sc + arc) + (room - (TOP + BOT) * sc - arc) / 2 };
    };
    const [under, over] = [fit(Z.b, k.vh), fit(0, Z.t)];
    return under.s >= Math.min(s * 0.8, 0.56) || under.s >= over.s ? under : over;
  }
  let L = lane(S);
  S = L.s;
  const sp = { y0: L.y0, arc: L.arc }; // eased toward L if the card moves under it mid-run
  if (S < 0.34) { // nowhere to run that isn't your answer: just the line, as a toast
    k.toast(line, { icon: cast.icon || '🦄', ms: 2400 });
    k.after(10, k.end);
    return {};
  }
  const x0 = dir > 0 ? -170 * S : k.vw + 170 * S;
  const x1 = dir > 0 ? k.vw + 220 * S : -220 * S;
  const sparkles = [];
  const puffs = [];
  let prev = null;
  let stride = 0;
  let lastStep = 0;
  let pos = { x: x0, y: sp.y0, rot: 0, bob: 0 };

  if (k.sfx.on) {
    k.sfx.whoosh({ pitch: 0.9, gain: 0.5, pan: -dir * 0.7 });
    [0, 4, 7, 12, 16].forEach((st, i) => k.sfx.tone({ type: 'triangle', freq: 784 * 2 ** (st / 12), dur: 0.5, gain: 0.05, delay: 0.25 + i * 0.07 }));
  }

  // ── drawing helpers, all in the creature's own space: facing right, body centre at 0,0 ──

  const outlined = (path, fill, lw = 3) => {
    c.beginPath();
    path();
    c.lineWidth = lw;
    c.strokeStyle = INK;
    c.stroke();
    c.fillStyle = fill;
    c.fill();
  };
  const ell = (x, y, rx, ry, r = 0) => () => c.ellipse(x, y, rx, ry, r, 0, Math.PI * 2);
  // Several shapes with one outline round the lot: stroke them all fat, then fill them all.
  const union = (parts, fill) => {
    c.lineJoin = 'round';
    for (const [pass, lw] of [['stroke', 6], ['fill', 0]]) for (const part of parts) {
      c.beginPath();
      part();
      if (pass === 'stroke') { c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); } else { c.fillStyle = fill; c.fill(); }
    }
  };

  function limb(x, y, l1, l2, a1, a2, w, fill, hoof, far) {
    const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
    const fx = kx + Math.sin(a1 + a2) * l2, fy = ky + Math.cos(a1 + a2) * l2;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const [lw, col] of [[w + 5, INK], [w, far ? shade(fill) : fill]]) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(kx, ky);
      c.lineTo(fx, fy);
      c.lineWidth = lw;
      c.strokeStyle = col;
      c.stroke();
    }
    if (hoof) {
      c.save();
      c.translate(fx, fy);
      c.rotate(-(a1 + a2));
      outlined(() => c.roundRect(-w * 0.62, -2, w * 1.24, w * 0.7, [2, 2, 4, 4]), far ? shade(hoof) : hoof, 2.5);
      c.restore();
    }
    return [fx, fy];
  }
  const shade = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(v * 0.82).toString(16).padStart(2, '0');
    return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
  };

  // Gallop: hind left, hind right, front left, front right.
  const legs = (p, list) => list.map(([x, y, off, front, far], i) => {
    const s = Math.sin(p + off);
    const lift = Math.max(0, Math.cos(p + off));
    return { x, y, a1: (front ? 0.62 : 0.5) * s, a2: front ? -1.1 * lift : 0.85 * lift, far, i };
  });

  // Locks of rainbow hair, waving: chains of shrinking dots, outlined then filled. [x, y, length, angle]
  function strands(points, flow, t, width, wave) {
    const N = 20;
    const locks = points.map(([x, y, len, ang], i) => {
      const w = Math.sin(t * 14 + i * 0.9) * wave;
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len + w;
      const mx = (x + ex) / 2 + flow + Math.sin(ang) * w, my = (y + ey) / 2 - w;
      return Array.from({ length: N + 1 }, (_, j) => {
        const u = j / N;
        return [(1 - u) ** 2 * x + 2 * (1 - u) * u * mx + u * u * ex, (1 - u) ** 2 * y + 2 * (1 - u) * u * my + u * u * ey, (width / 2) * (1 - u * 0.5)];
      });
    });
    c.fillStyle = INK;
    for (const pts of locks) for (const [x, y, r] of pts) { c.beginPath(); c.arc(x, y, r + 2.5, 0, Math.PI * 2); c.fill(); }
    locks.forEach((pts, i) => {
      c.fillStyle = RAINBOW[i % RAINBOW.length];
      for (const [x, y, r] of pts) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = 'rgba(255,255,255,.5)';
      c.lineWidth = 1.6;
      c.lineCap = 'round';
      c.beginPath();
      pts.slice(1, -3).forEach(([x, y, r], j) => (j ? c.lineTo(x, y - r * 0.4) : c.moveTo(x, y - r * 0.4)));
      c.stroke();
    });
  }

  function horn(x, y, x2, y2, w) {
    const ang = Math.atan2(y2 - y, x2 - x);
    const len = Math.hypot(x2 - x, y2 - y);
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    const g = c.createLinearGradient(0, -w, 0, w);
    g.addColorStop(0, '#fff6c2');
    g.addColorStop(0.5, '#ffd23f');
    g.addColorStop(1, '#e8a317');
    outlined(() => { c.moveTo(0, -w); c.lineTo(len, 0); c.lineTo(0, w); c.closePath(); }, g, 2.5);
    c.strokeStyle = 'rgba(160,90,0,.55)';
    c.lineWidth = 1.6;
    for (let i = 1; i < 5; i++) {
      const fx = (i / 5) * len, hw = w * (1 - i / 5);
      c.beginPath();
      c.moveTo(fx - 4, -hw);
      c.lineTo(fx + 3, hw);
      c.stroke();
    }
    c.restore();
  }

  function eye(x, y, r = 5) {
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(x + r * 0.25, y - r * 0.4, r * 0.32, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.lineCap = 'round';
    for (const d of [-0.5, 0.1]) {
      c.beginPath();
      c.moveTo(x + d * r, y - r * 0.9);
      c.lineTo(x + d * r * 1.6 - 2, y - r * 1.6);
      c.stroke();
    }
  }
  const blush = (x, y, r = 7) => {
    c.fillStyle = 'rgba(255,120,170,.45)';
    c.beginPath();
    c.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
    c.fill();
  };

  function fluff(x, y, rx, ry, n, r, fill) {
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
    });
    c.fillStyle = INK;
    for (const [px, py] of pts) { c.beginPath(); c.arc(px, py, r + 2.5, 0, Math.PI * 2); c.fill(); }
    c.beginPath();
    c.ellipse(x, y, rx + 1.5, ry + 1.5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = fill;
    for (const [px, py] of pts) { c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill(); }
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }

  const DRAW = {
    unicorn(p, t) {
      const L = legs(p, [[-28, 10, 0, false, true], [-34, 12, 0.55, false, false], [30, 12, 2.5, true, true], [24, 14, 3.05, true, false]]);
      const leg = (l) => limb(l.x, l.y, 24, 24, l.a1, l.a2, 13, '#ffffff', '#c3a9ff', l.far);
      L.filter((l) => l.far).forEach(leg);
      strands([[-44, -14, 40, Math.PI * 0.92], [-46, -8, 50, Math.PI * 0.98], [-46, -2, 52, Math.PI * 1.04], [-45, 4, 46, Math.PI * 1.1], [-43, 9, 36, Math.PI * 1.16], [-44, -18, 30, Math.PI * 0.86]], 10, t, 12, 7);
      const nod = Math.sin(p) * 0.05;
      const body = c.createLinearGradient(0, -90, 0, 32);
      body.addColorStop(0, '#ffffff');
      body.addColorStop(0.7, '#fbf8ff');
      body.addColorStop(1, '#e6dcff');
      union([
        ell(0, 0, 50, 29),
        () => { c.moveTo(12, -22); c.bezierCurveTo(28, -36, 44, -56, 54, -70); c.lineTo(80, -48); c.bezierCurveTo(70, -30, 62, -4, 36, 22); c.closePath(); },
        () => { c.save(); c.translate(68, -60); c.rotate(nod); c.ellipse(0, 0, 20, 17, 0.1, 0, Math.PI * 2); c.moveTo(36, 12); c.ellipse(20, 12, 16, 12, 0.35, 0, Math.PI * 2); c.moveTo(-8, -12); c.lineTo(-6, -36); c.lineTo(6, -15); c.restore(); },
      ], body);
      L.filter((l) => !l.far).forEach(leg);
      c.save();
      c.translate(68, -60);
      c.rotate(nod);
      c.fillStyle = '#ffb3d1';
      c.beginPath(); c.moveTo(-5, -15); c.lineTo(-5, -29); c.lineTo(2, -16); c.fill();
      c.fillStyle = INK;
      c.beginPath(); c.ellipse(29, 10, 2, 3, 0.3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = INK; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.arc(22, 15, 7, 0.35, 1.45); c.stroke();
      eye(6, -1, 6);
      blush(15, 9, 6);
      horn(4, -15, 20, -56, 7);
      c.restore();
      strands([[22, -26, 26, Math.PI * 0.86], [30, -36, 30, Math.PI * 0.84], [38, -46, 34, Math.PI * 0.86], [46, -56, 36, Math.PI * 0.88], [54, -66, 34, Math.PI * 0.9], [61, -74, 24, Math.PI * 0.92]], -10, t + 0.5, 12, 5);
    },
    llama(p, t) {
      const L = legs(p, [[-26, 12, 0, false, true], [-32, 14, 0.55, false, false], [28, 14, 2.5, true, true], [22, 14, 3.05, true, false]]);
      const leg = (l) => limb(l.x, l.y, 24, 26, l.a1 * 0.85, l.a2 * 0.8, 10, '#f1e2c4', '#6b4a2b', l.far);
      L.filter((l) => l.far).forEach(leg);
      fluff(-50, -6, 6, 8, 5, 6, '#f6ead3'); // tail
      fluff(0, 0, 44, 24, 16, 8, '#f6ead3');
      L.filter((l) => !l.far).forEach(leg);
      // the blanket
      c.save();
      c.beginPath();
      c.roundRect(-26, -30, 50, 34, 6);
      c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.clip();
      ['#e63946', '#ffb703', '#2a9d8f', '#ff70a6', '#3a86ff', '#e63946'].forEach((col, i) => { c.fillStyle = col; c.fillRect(-26, -30 + i * 6, 50, 6); });
      c.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-22 + i * 8, -12); c.lineTo(-18 + i * 8, -16); c.lineTo(-14 + i * 8, -12); c.lineTo(-18 + i * 8, -8); c.fill(); }
      c.restore();
      ['#ff70a6', '#ffb703', '#2a9d8f'].forEach((col, i) => { c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(-20 + i * 20, 8, 4, 0, Math.PI * 2); c.fill(); c.stroke(); });
      // neck and head
      c.save();
      c.translate(30, -14);
      c.rotate(Math.sin(p * 2) * 0.04);
      fluff(4, -30, 12, 32, 12, 6, '#f6ead3');
      c.translate(8, -66);
      for (const [x, r, col] of [[-6, -0.2, '#ff70a6'], [6, 0.25, '#2a9d8f']]) {
        c.save(); c.translate(x, -12); c.rotate(r);
        outlined(ell(0, -8, 5, 12), '#efdfc0', 2.5);
        c.fillStyle = col; c.strokeStyle = INK; c.lineWidth = 2;
        c.beginPath(); c.arc(0, -22, 5, 0, Math.PI * 2); c.fill(); c.stroke();
        c.restore();
      }
      outlined(() => { c.ellipse(0, 0, 15, 14, 0, 0, Math.PI * 2); c.moveTo(30, 6); c.ellipse(16, 6, 14, 10, 0, 0, Math.PI * 2); }, '#efdfc0');
      c.fillStyle = '#efdfc0';
      c.beginPath(); c.ellipse(6, 3, 12, 10, 0, 0, Math.PI * 2); c.fill();
      fluff(-2, -12, 8, 3, 5, 4, '#f6ead3');
      eye(4, -1, 4.5);
      blush(12, 7, 5);
      c.strokeStyle = INK; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(25, 4); c.lineTo(28, 7); c.lineTo(25, 10); c.stroke(); // the smug llama mouth
      c.beginPath(); c.moveTo(22, 12); c.quadraticCurveTo(26, 15, 29, 11); c.stroke();
      c.restore();
    },
    yeti(p, t) {
      const run = Math.sin(p);
      const flail = Math.sin(p * 2);
      const leg = (s, far) => {
        limb(-6, 28, 18, 18, 0.75 * s, 0.9 * Math.max(0, -s), 17, far ? '#dfe6f2' : '#f4f7fc', null, far);
        foot(-6, 28, 0.75 * s, 0.9 * Math.max(0, -s), far);
      };
      leg(run, true);
      limb(-4, -20, 20, 20, Math.PI - 0.25 - flail * 0.3, -0.35, 14, '#dfe6f2', null, true); // arms up, flailing with joy
      fluff(0, 0, 30, 38, 18, 9, '#f4f7fc');
      leg(-run, false);
      outlined(ell(15, -12, 15, 15), '#8fb3dc', 3);
      c.fillStyle = '#f4f7fc';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(5 + i * 7, -26, 5.5, 0, Math.PI * 2); c.fill(); }
      eye(10, -15, 3.6);
      eye(22, -15, 3.6);
      c.fillStyle = INK;
      c.beginPath(); c.moveTo(7, -7); c.quadraticCurveTo(17, 10, 28, -7); c.closePath(); c.fill();
      c.fillStyle = '#ff7a9c';
      c.beginPath(); c.ellipse(17, -1, 5, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      for (const x of [10, 16, 22]) { c.beginPath(); c.moveTo(x, -7); c.lineTo(x + 2.5, -3); c.lineTo(x + 5, -7); c.fill(); }
      limb(-10, -10, 20, 20, Math.PI + 0.3 + flail * 0.3, 0.35, 14, '#f4f7fc', null, false);
    },
    narwhal(p, t) {
      // flukes flap, flippers paddle
      c.save();
      c.translate(-58, 2);
      c.rotate(Math.sin(t * 12) * 0.35);
      const g = '#6f9fca';
      outlined(() => { c.moveTo(4, 0); c.bezierCurveTo(-10, -4, -26, -22, -30, -16); c.bezierCurveTo(-28, -4, -20, 0, -14, 0); c.bezierCurveTo(-20, 0, -28, 4, -30, 16); c.bezierCurveTo(-26, 22, -10, 4, 4, 0); }, g, 3);
      c.restore();
      const body = c.createLinearGradient(0, -26, 0, 26);
      body.addColorStop(0, '#7fb0dc');
      body.addColorStop(0.6, '#5d8fbf');
      body.addColorStop(1, '#4a77a8');
      outlined(() => {
        c.moveTo(56, 2);
        c.bezierCurveTo(56, -26, 20, -30, -10, -22);
        c.bezierCurveTo(-36, -16, -54, -6, -62, 2);
        c.bezierCurveTo(-50, 10, -30, 22, 0, 24);
        c.bezierCurveTo(30, 26, 56, 22, 56, 2);
      }, body);
      c.save();
      c.beginPath(); c.moveTo(56, 2); c.bezierCurveTo(56, 20, 30, 26, 0, 24); c.bezierCurveTo(-20, 22, -40, 14, -50, 8); c.bezierCurveTo(-20, 10, 20, 12, 56, 2); c.fillStyle = '#d9e9f6'; c.fill();
      c.restore();
      c.fillStyle = 'rgba(40,70,110,.35)';
      for (const [x, y, r] of [[-10, -14, 4], [6, -18, 3], [-24, -8, 3], [18, -12, 2.5], [-36, -4, 2.5], [-2, -6, 2]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
      c.save();
      c.translate(14, 14);
      c.rotate(0.5 + Math.sin(t * 10) * 0.4);
      outlined(ell(0, 8, 6, 12), '#5d8fbf', 2.5);
      c.restore();
      horn(52, -6, 132, -22, 5.5);
      eye(34, -6, 5);
      blush(44, 4, 6);
      c.strokeStyle = INK; c.lineWidth = 2; c.lineCap = 'round';
      c.beginPath(); c.arc(48, 6, 5, 0.4, 1.7); c.stroke();
    },
  };

  function foot(x, y, a1, a2, far) {
    const fx = x + Math.sin(a1) * 20 + Math.sin(a1 + a2) * 20, fy = y + Math.cos(a1) * 20 + Math.cos(a1 + a2) * 20;
    outlined(ell(fx + 6, fy + 2, 13, 6), far ? '#6e8db8' : '#8fb3dc', 2.5);
  }

  function star4(x, y, r, a, col) {
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.fillStyle = col;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? r * 0.28 : r;
      c.lineTo(Math.cos((i * Math.PI) / 4) * rr, Math.sin((i * Math.PI) / 4) * rr);
    }
    c.fill();
    c.restore();
  }

  // Above its head. If that would reach the answer box (or off the screen), out in front of its face instead.
  function bubble(text, x, y, alpha, pop, head) {
    c.save();
    c.font = k.font(19, 800, 'sans');
    const max = Math.min(340, k.vw * 0.5);
    const shown = k.ellipsize(c, text, max);
    const w = c.measureText(shown).width + 30, h = 40;
    const side = y - h < L.t + 4;
    let bx = k.clamp(x - w / 2, 10, k.vw - w - 10), by = Math.max(10, y - h);
    if (side) {
      bx = k.clamp(head.x + dir * (60 * S + 14) - (dir > 0 ? 0 : w), 10, k.vw - w - 10);
      by = k.clamp(head.y - h / 2, L.t + 4, L.b - h - 4);
    }
    const ox = side ? (dir > 0 ? bx : bx + w) : bx + w / 2, oy = side ? by + h / 2 : by + h;
    c.globalAlpha = alpha;
    c.translate(ox, oy);
    c.scale(pop, pop);
    c.translate(-ox, -oy);
    c.fillStyle = 'rgba(30,10,60,.2)';
    c.beginPath(); c.roundRect(bx + 3, by + 5, w, h, 20); c.fill();
    c.beginPath();
    c.roundRect(bx, by, w, h, 20);
    if (side) { // a tail pointing back at the mouth
      const ex = dir > 0 ? bx + 1 : bx + w - 1;
      c.moveTo(ex, by + h / 2 - 8);
      c.lineTo(ex - dir * 14, by + h / 2 + 8);
      c.lineTo(ex, by + h / 2 + 6);
    } else {
      const tx = k.clamp(x, bx + 22, bx + w - 22);
      c.moveTo(tx - 9, by + h - 1);
      c.lineTo(tx - dir * 4, by + h + 14);
      c.lineTo(tx + 9, by + h - 1);
    }
    c.fillStyle = '#fff';
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.stroke();
    c.fill();
    const g = c.createLinearGradient(bx, 0, bx + w, 0);
    RAINBOW.forEach((col, i) => g.addColorStop(i / (RAINBOW.length - 1), col));
    c.fillStyle = INK;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(shown, bx + w / 2, by + h / 2 + 1);
    c.fillStyle = g;
    c.fillRect(bx + 16, by + h - 7, w - 32, 3);
    c.restore();
  }

  const BAND = 8 * S;
  k.loop((dt, t) => {
    const prog = k.reduced ? 0.56 : Math.min(1, t / DUR);
    const swim = who === 'narwhal';
    stride += dt * (swim ? 1 : 19);
    sp.y0 += (L.y0 - sp.y0) * Math.min(1, dt * 10);
    sp.arc += (L.arc - sp.arc) * Math.min(1, dt * 10);
    const y0 = sp.y0;
    const x = k.lerp(x0, x1, prog);
    const arc = Math.sin(prog * Math.PI) * sp.arc;
    const bob = swim ? Math.sin(t * 6) * 26 * S : -Math.abs(Math.sin(stride / 2)) * 10 * S;
    const y = y0 - arc + bob;
    const vy = (y - pos.y) / Math.max(dt, 1e-3);
    pos = { x, y, rot: swim ? k.clamp(Math.atan2(vy, Math.abs(x1 - x0) / DUR) * 0.8, -0.5, 0.5) * dir : -Math.cos(stride) * 0.05 };

    // rainbow from just behind the body
    const tailX = x - dir * 48 * S, tailY = y + (swim ? 0 : 6 * S);
    tc.save();
    tc.globalCompositeOperation = 'destination-out';
    tc.fillStyle = `rgba(0,0,0,${k.reduced ? 0 : Math.min(1, dt * 1.7)})`;
    tc.fillRect(0, 0, trail.w, trail.h);
    tc.restore();
    if (k.reduced && !prev) prev = { x: x0, y: y0 };
    if (prev) {
      tc.lineCap = 'round';
      const steps = k.reduced ? 40 : 1;
      for (let s = 0; s < steps; s++) {
        const f0 = s / steps, f1 = (s + 1) / steps;
        const ax = k.reduced ? k.lerp(x0, tailX, f0) : prev.x, bx = k.reduced ? k.lerp(x0, tailX, f1) : tailX;
        const ay = k.reduced ? y0 - Math.sin(k.lerp(0, prog, f0) * Math.PI) * sp.arc + Math.sin(f0 * 14) * 6 : prev.y;
        const by = k.reduced ? y0 - Math.sin(k.lerp(0, prog, f1) * Math.PI) * sp.arc + Math.sin(f1 * 14) * 6 : tailY;
        RAINBOW.forEach((col, i) => {
          const o = (i - 2.5) * BAND;
          tc.strokeStyle = col;
          tc.lineWidth = BAND + 1;
          tc.globalAlpha = k.reduced ? 0.25 + 0.75 * f1 : 1;
          tc.beginPath();
          tc.moveTo(ax, ay + o);
          tc.lineTo(bx, by + o);
          tc.stroke();
        });
      }
      tc.globalAlpha = 1;
    }
    prev = { x: tailX, y: tailY };
    if (dt && prog < 1 && k.chance(0.7)) sparkles.push({ x: tailX - dir * k.rand(0, 60), y: tailY + k.rand(-30, 30) * S, age: 0, life: k.rand(0.5, 1), r: k.rand(4, 10) * S, a: k.rand(0, 1) });
    if (k.reduced && !sparkles.length) for (let i = 0; i < 18; i++) sparkles.push({ x: k.lerp(x0, x, i / 18), y: y0 + k.rand(-50, 40) * S - Math.sin((i / 18) * prog * Math.PI) * sp.arc, age: 0.3, life: 1, r: k.rand(5, 10) * S, a: k.rand(0, 1) });
    if (!swim && dt && stride - lastStep > Math.PI) {
      lastStep = stride;
      puffs.push({ x: x - dir * 10 * S, y: y0 - arc + 50 * S, age: 0 });
      if (k.sfx.on) [0, 0.09].forEach((d) => k.sfx.clack({ pitch: k.rand(0.45, 0.6), gain: 0.25, delay: d, pan: k.clamp((x / k.vw) * 2 - 1, -1, 1) }));
    }

    c.clearRect(0, 0, cv.w, cv.h);
    c.drawImage(trail.el, 0, 0, cv.w, cv.h);
    for (let i = puffs.length - 1; i >= 0; i--) {
      const f = puffs[i];
      f.age += dt;
      if (f.age > 0.6) { puffs.splice(i, 1); continue; }
      const q = f.age / 0.6;
      c.globalAlpha = Math.min(1, (1 - q) * 2.5);
      [[-12, 8, '#ffd9f2'], [0, 11, '#fff3c9'], [12, 7, '#d9e8ff']].forEach(([ox, r, col]) => {
        c.fillStyle = col;
        c.beginPath(); c.arc(f.x + ox * S * (1 + q), f.y - q * 10, r * S * (0.5 + q * 0.8) * (1 - q * 0.6), 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1;
    }
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.age += dt;
      if (s.age > s.life) { sparkles.splice(i, 1); continue; }
      const q = s.age / s.life;
      star4(s.x, s.y - q * 10, s.r * Math.sin(q * Math.PI), s.a + q * 2, i % 3 ? '#fff8c4' : '#ffffff');
    }

    c.save();
    c.translate(x, y);
    const z = who === 'yeti' ? 1.2 : 1;
    c.scale(dir * S * z, S * z);
    c.rotate(pos.rot);
    c.shadowColor = 'rgba(40,20,80,.25)';
    c.shadowBlur = 0;
    DRAW[who](stride, t);
    c.restore();

    // speech bubble rides above the head
    const bt = (prog - 0.12) / 0.7;
    if (bt > 0 && bt < 1) {
      const a = Math.min(1, bt * 6, (1 - bt) * 6);
      const pop = 0.6 + k.ease.outBack(Math.min(1, bt * 5)) * 0.4;
      const head = { x: x + dir * ({ narwhal: 50, yeti: 20, llama: 50 }[who] || 75) * S, y: y - ({ narwhal: 0, yeti: 25, llama: 75 }[who] || 60) * S };
      bubble(line, x + dir * 40 * S, y - ({ narwhal: 50, yeti: 100, llama: 150 }[who] || 130) * S, a, pop, head);
    }
    if (t > DUR + 0.9 && !k.reduced) k.end();
  }, { still: 0.1 });

  if (k.reduced) k.after(2600, k.end);

  return {
    layout() { // the next card slid in (or the window changed): swerve to a lane that's still clear
      L = lane(S);
      S = Math.min(S, L.s);
      if (S < 0.34) { // the new lane is too tight for anything readable: it bows out, the line goes in a toast
        k.toast(line, { icon: cast.icon || '🦄', ms: 2400 });
        k.end();
      }
    },
  };
}
