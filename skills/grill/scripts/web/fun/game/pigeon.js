// Clay pigeon. "PULL!", and a clay arcs across the screen. The cursor is a crosshair: click to
// shatter it. Three clays a round, then a verdict, then it ends itself.

const CROSSHAIR = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><g fill='none' stroke-linecap='round'><circle cx='16' cy='16' r='10' stroke='#000' stroke-opacity='.5' stroke-width='4'/><path d='M16 2v8M16 22v8M2 16h8M22 16h8' stroke='#000' stroke-opacity='.5' stroke-width='4'/><circle cx='16' cy='16' r='10' stroke='#fff' stroke-width='2'/><path d='M16 2v8M16 22v8M2 16h8M22 16h8' stroke='#fff' stroke-width='2'/></g><circle cx='16' cy='16' r='2.2' fill='#ff3b30'/></svg>`)}") 16 16, crosshair`;
const CLAY = ['#ff7a2a', '#f2601a', '#ffa45c', '#3a2a20'];
const ROUND = [0.9, 2.7, 4.5]; // launch times, seconds
const R = 24; // clay radius
const HIT = 44; // generous: it's moving and you're answering questions
const NEAR = 110; // misses this close are still yours, so they don't click the UI underneath (unless it's your answer)
const CHEERS = ['SMASH!', 'CLAY-MORE!', 'PULVERISED', 'NICE SHOT', 'BOOM', 'DUST'];
const VERDICT = [
  ['0 / 3', 'The clays have unionised.'],
  ['1 / 3', 'The clays send their regards.'],
  ['2 / 3', 'One got away. It will tell the others.'],
  ['3 / 3', 'Dead eye. No real pigeons were harmed.'],
];

// The answer box (with its send button) and the options: a click there is always yours, never a shot.
function keepOut(k, pad = 14) {
  const rs = [k.ui.answer()?.parentElement, ...k.ui.options().map((o) => o.el)].map((el) => k.rect(el)).filter(Boolean);
  if (!rs.length) return null;
  return { l: Math.min(...rs.map((r) => r.left)) - pad, t: Math.min(...rs.map((r) => r.top)) - pad, r: Math.max(...rs.map((r) => r.right)) + pad, b: Math.max(...rs.map((r) => r.bottom)) + pad };
}
const inside = (Z, x, y) => !!Z && x > Z.l && x < Z.r && y > Z.t && y < Z.b;

export default function pigeon(k) {
  const cv = k.canvas();
  const c = cv.ctx;
  const clays = []; // { x, y, vx, vy, g, age, spin, trail, done }
  const fx = []; // short-lived drawings: callouts and muzzle rings { kind, x, y, age, life, … }
  let hits = 0;
  let launched = 0;
  let shake = 0;
  let verdictAt = 0;

  k.cursor(CROSSHAIR);
  k.toast('Clay pigeon. Click to shoot, Esc to skip.', { icon: '🎯', ms: 2200 });

  function launch() {
    const left = launched % 2 === 0;
    const { vw, vh } = k;
    const x0 = left ? -30 : vw + 30;
    const y0 = vh * k.rand(0.6, 0.82);
    const xa = vw * k.rand(0.38, 0.62);
    const ya = vh * k.rand(0.12, 0.3);
    const ta = k.rand(1, 1.2); // seconds to the top of the arc
    const vy = (-2 * (y0 - ya)) / ta;
    clays.push({ x: x0, y: y0, vx: (xa - x0) / ta, vy, g: -vy / ta, age: 0, spin: k.rand(9, 14) * (left ? 1 : -1), trail: [], done: false });
    launched++;
    k.sfx.thud({ pitch: 1.6, gain: 0.5 });
    k.sfx.whoosh({ pitch: 1.3, gain: 0.6, pan: left ? -0.6 : 0.6 });
  }

  function say(text, x, y, o = {}) {
    fx.push({ kind: 'text', text, x, y, age: 0, life: o.life ?? 0.9, size: o.size ?? 34, fill: o.fill ?? '#ffd23f', rot: o.rot ?? k.rand(-0.15, 0.15), rise: o.rise ?? 60 });
  }

  function shoot(e) {
    if (e.button !== 0 || verdictAt) return;
    const x = e.clientX, y = e.clientY;
    if (inside(keepOut(k, 0), x, y)) return; // a click on your answer is yours
    k.sfx.shot({ pitch: k.rand(0.92, 1.08) });
    fx.push({ kind: 'ring', x, y, age: 0, life: 0.18 });
    const live = clays.filter((p) => !p.done);
    const target = live.map((p) => [p, Math.hypot(p.x - x, p.y - y)]).sort((a, b) => a[1] - b[1])[0];
    if (target && target[1] < HIT) {
      const [p] = target;
      p.done = true;
      hits++;
      shake = 1;
      k.consume(e);
      k.sfx.shatter({ delay: 0.015 });
      k.burst(p.x, p.y, { shape: 'shard', n: 20, colors: CLAY, speed: 560, gravity: 1400, drag: 0.5, spin: 20, size: 10, life: 1.4 });
      k.burst(p.x, p.y, { shape: 'dot', n: 16, colors: ['rgba(255,196,140,.55)', 'rgba(214,170,128,.5)', 'rgba(255,230,200,.5)'], speed: 170, gravity: -40, drag: 3, size: 9, life: 1, grow: true });
      say(k.pick(CHEERS), p.x, p.y - 30);
      k.score('pigeons', 1, { icon: '🎯', label: 'Clay pigeons', says: 'shot {n} clay pigeon{s}' });
    } else if (target && target[1] < NEAR) {
      k.consume(e);
      k.burst(x, y, { shape: 'dot', n: 8, colors: ['rgba(120,120,120,.45)'], speed: 90, gravity: -30, drag: 3, size: 6, life: 0.7, grow: true });
      say(k.pick(['MISS', 'SO CLOSE', 'NOPE']), x, y - 24, { fill: '#ffffff', size: 22, life: 0.7, rise: 30 });
    }
  }

  function drawClay(p) {
    const tilt = 0.42 + Math.sin(p.age * p.spin) * 0.12; // the disc wobbles as it spins
    const ang = Math.atan2(p.vy, p.vx) * 0.25;
    for (let i = 0; i < p.trail.length; i++) { // motion smear
      const [tx, ty] = p.trail[i];
      c.globalAlpha = (i + 1) / p.trail.length * 0.18;
      c.fillStyle = CLAY[0];
      c.beginPath();
      c.ellipse(tx, ty, R * 0.95, R * tilt, ang, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(ang);
    c.fillStyle = 'rgba(0,0,0,.18)'; // soft shadow, so it reads on light and dark
    c.beginPath();
    c.ellipse(3, R * tilt + 7, R * 0.9, R * tilt * 0.45, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2b1d14'; // underside rim
    c.beginPath();
    c.ellipse(0, R * tilt * 0.32, R, R * tilt, 0, 0, Math.PI * 2);
    c.fill();
    const top = c.createRadialGradient(-R * 0.35, -R * tilt * 0.6, 2, 0, 0, R * 1.1);
    top.addColorStop(0, '#ffb070');
    top.addColorStop(0.55, CLAY[0]);
    top.addColorStop(1, '#c8440c');
    c.fillStyle = top;
    c.beginPath();
    c.ellipse(0, 0, R, R * tilt, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(90,30,0,.35)'; // the ridges on a real clay
    c.lineWidth = 1.2;
    for (const f of [0.78, 0.52]) {
      c.beginPath();
      c.ellipse(0, -R * tilt * (1 - f) * 0.35, R * f, R * tilt * f, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,.45)';
    c.beginPath();
    c.ellipse(-R * 0.3, -R * tilt * 0.45, R * 0.32, R * tilt * 0.18, -0.3, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Chunky comic lettering: dark outline, drop shadow, bright fill.
  function comic(text, x, y, size, fill, rot = 0, alpha = 1, scale = 1) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(scale, scale);
    c.globalAlpha = alpha;
    c.font = k.font(size, 900, 'display');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size * 0.18;
    c.strokeStyle = 'rgba(0,0,0,.3)';
    c.strokeText(text, 3, 4);
    c.strokeStyle = '#1b1206';
    c.strokeText(text, 0, 0);
    c.fillStyle = fill;
    c.fillText(text, 0, 0);
    c.restore();
  }

  k.on(window, 'pointerdown', shoot, { capture: true });

  k.loop((dt, t) => {
    c.clearRect(0, 0, cv.w, cv.h);
    c.save();
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 5);
      c.translate(k.rand(-6, 6) * shake, k.rand(-6, 6) * shake);
    }

    // PULL! a beat before each launch, from the side the clay will come from
    const next = ROUND[launched];
    if (next !== undefined && t >= next - 0.45 && !fx.some((f) => f.pull === launched)) {
      const left = launched % 2 === 0;
      fx.push({ kind: 'pull', pull: launched, x: left ? 150 : k.vw - 150, y: k.vh - 120, age: 0, life: 0.9, rot: left ? -0.14 : 0.14 });
    }
    if (next !== undefined && t >= next) launch();

    for (const p of clays) {
      if (p.done) continue;
      p.age += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.trail.push([p.x, p.y]);
      if (p.trail.length > 5) p.trail.shift();
      if (p.y > k.vh + 60 || p.x < -80 || p.x > k.vw + 80) {
        p.done = true;
        say('ESCAPED', k.clamp(p.x, 90, k.vw - 90), k.clamp(p.y, 60, k.vh - 160), { fill: '#e6e6e6', size: 20, life: 1.1, rise: 20, rot: 0 });
      }
      drawClay(p);
    }

    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.age += dt;
      const p = f.age / f.life;
      if (p >= 1) { fx.splice(i, 1); continue; }
      if (f.kind === 'ring') {
        c.strokeStyle = `rgba(255,250,220,${1 - p})`;
        c.lineWidth = 3 * (1 - p) + 0.5;
        c.beginPath();
        c.arc(f.x, f.y, 6 + p * 26, 0, Math.PI * 2);
        c.stroke();
      } else if (f.kind === 'pull') {
        const pop = k.ease.outBack(Math.min(1, f.age / 0.22));
        comic('PULL!', f.x, f.y, 64, '#ffffff', f.rot, Math.min(1, (1 - p) * 3), 0.4 + pop * 0.6);
      } else {
        const pop = k.ease.outBack(Math.min(1, f.age / 0.18));
        comic(f.text, f.x, f.y - k.ease.outCubic(p) * f.rise, f.size, f.fill, f.rot, Math.min(1, (1 - p) * 2.5), 0.5 + pop * 0.5);
      }
    }

    // the verdict once every clay is shattered or gone
    if (launched === ROUND.length && clays.every((p) => p.done) && !verdictAt) {
      verdictAt = t;
      k.cursor(null);
      if (hits === 3) k.sfx.tada(); else k.sfx.blip({ pitch: 0.5 + hits * 0.25 });
      if (hits === 3) k.burst(k.vw / 2, k.vh * 0.42, { n: 70, speed: 700, shape: 'mix', life: 1.8 });
      k.after(2300, k.end);
    }
    if (verdictAt) {
      const vt = t - verdictAt;
      const a = Math.min(1, vt * 4) * Math.min(1, (2.3 - vt) * 3);
      const [big, small] = VERDICT[hits];
      const x = k.vw / 2, y = k.vh * 0.42;
      c.font = k.font(26, 900, 'display');
      const w = Math.max(320, c.measureText(small).width + 70);
      c.save(); // a dark plate, so the verdict reads over the card in both themes
      c.translate(x, y + 30);
      c.rotate(-0.04);
      c.globalAlpha = a * 0.8;
      c.fillStyle = '#121212';
      c.beginPath();
      c.roundRect(-w / 2, -95, w, 180, 26);
      c.fill();
      c.restore();
      comic(big, x, y, 96, hits === 3 ? '#ffd23f' : '#ffffff', -0.04, a, 0.6 + k.ease.outBack(Math.min(1, vt / 0.3)) * 0.4);
      comic(small, x, y + 74, 26, '#ffffff', -0.04, a * Math.min(1, Math.max(0, (vt - 0.25) * 4)));
    }
    c.restore();
  }, { still: 0 });
}
