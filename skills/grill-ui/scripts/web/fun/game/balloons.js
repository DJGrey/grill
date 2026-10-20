// Balloons. Scope creep floats up from the bottom of the screen: each balloon carries a tag with a
// feature nobody asked for ("dark mode", "rewrite in Rust", and this question's other options).
// The cursor's a pin. Pop them before they float off into v1, then a verdict, then it ends itself.

const PIN = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M3 3l17 17' stroke='#000' stroke-opacity='.35' stroke-width='4' stroke-linecap='round'/><path d='M3 3l17 17' stroke='#d9dde2' stroke-width='2' stroke-linecap='round'/><path d='M4 4l15 15' stroke='#fff' stroke-width='.8' stroke-linecap='round'/><circle cx='22' cy='22' r='6.5' fill='#000' fill-opacity='.3'/><circle cx='21.5' cy='21.5' r='6' fill='#ff3b5c'/><circle cx='19.5' cy='19.5' r='2' fill='#fff' fill-opacity='.75'/></svg>`)}") 3 3, crosshair`;
const SCOPE = ['dark mode', 'SSO', 'AI chatbot', 'CSV export', 'mobile app', 'blockchain', 'Slack bot', 'one more field', 'microservices', 'custom themes', 'v2 API', 'Gantt chart', 'offline mode', 'gamification', 'a dashboard', 'PDF export', 'emoji reactions', 'an admin panel', 'i18n', 'a chatbot for the chatbot'];
const BIG = 'rewrite in Rust';
const COLORS = [ // base, light, dark
  ['#ff3b4e', '#ff9aa4', '#a3081b'],
  ['#ffb000', '#ffe08a', '#b86e00'],
  ['#2f80ff', '#9cc4ff', '#0b3d9c'],
  ['#21b573', '#8be8bd', '#0a6b40'],
  ['#ff5fb4', '#ffb8de', '#a8186a'],
  ['#9b5cff', '#cfb2ff', '#5223a8'],
  ['#ff7a1a', '#ffc18f', '#a8440a'],
  ['#14b8c4', '#8ae8ee', '#07707a'],
];
const N = 10;
const LINKS = 7, LINK = 10; // string: points and spacing
const CHEERS = ['POP!', 'POP!', 'DESCOPED', 'NOT IN V1', 'BACKLOG\'D', 'NOPE', 'WONTFIX'];

export default function balloons(k, ctx) {
  const cv = k.canvas();
  const c = cv.ctx;
  const others = (ctx.question?.options || []).filter((o) => !o.recommended).map((o) => k.clip(o.label, 22));
  const labels = [...k.shuffle(others).slice(0, 2), ...k.shuffle(SCOPE)];
  const order = k.shuffle([...labels.slice(0, N - 1), BIG]);
  const list = []; // live balloons
  const debris = []; // falling strings and tags
  const fx = []; // floating words
  const escaped = [];
  let popped = 0, spawned = 0, t = 0, verdictAt = 0, lastLane = -1;
  let verdictX = 0; // the verdict sits over the card: measured when it starts and on layout, not every frame
  const centre = () => { const r = k.rect(k.ui.card()); verdictX = r ? r.left + r.width / 2 : k.vw / 2; };
  const lanes = 7;

  const crab = k.canRender('🦀', 'emoji');
  if (!k.reduced) k.cursor(PIN);
  k.toast(k.reduced ? 'Scope creep, floating into v1.' : 'Scope creep! Pop it before it floats into v1.', { icon: '🎈', ms: 2400 });

  function spawn() {
    const label = order[spawned];
    const big = label === BIG;
    let lane;
    do lane = k.int(0, lanes - 1); while (lane === lastLane);
    lastLane = lane;
    const x = k.vw * (0.07 + (0.86 * (lane + k.rand(0.15, 0.85))) / lanes);
    const rx = big ? 44 : k.rand(29, 36);
    const b = {
      label, big, x0: x, x, y: k.vh + rx * 1.3 + 20, rx, ry: rx * 1.17,
      vy: -(big ? 120 : k.rand(170, 230)) * Math.min(1.25, Math.max(0.8, k.vh / 900)),
      amp: k.rand(10, 26), f: k.rand(1.1, 1.9), ph: k.rand(0, 6.28), tilt: 0, age: 0,
      col: COLORS[spawned % COLORS.length], pts: [],
    };
    for (let i = 0; i < LINKS; i++) b.pts.push({ x, y: b.y + b.ry + 6 + i * LINK, px: x, py: b.y + b.ry + 6 + i * LINK });
    list.push(b);
    spawned++;
  }

  // ── input ──
  k.on(window, 'pointerdown', (e) => {
    if (e.button !== 0 || verdictAt || k.reduced) return;
    const x = e.clientX, y = e.clientY;
    for (let i = list.length - 1; i >= 0; i--) { // top-most first
      const b = list[i];
      const dx = (x - b.x) / (b.rx + 5), dy = (y - b.y) / (b.ry + 5);
      if (dx * dx + dy * dy > 1) continue;
      k.consume(e);
      pop(b, i);
      return;
    }
  }, { capture: true });

  function pop(b, i) {
    list.splice(i, 1);
    popped++;
    k.sfx.pop({ pitch: b.big ? 0.6 : k.rand(0.85, 1.25), gain: 1.2 });
    k.sfx.noise({ dur: 0.06, filter: 'highpass', freq: 1800, gain: 0.25 });
    k.burst(b.x, b.y, { shape: 'shard', n: b.big ? 22 : 14, colors: [b.col[0], b.col[2], b.col[1]], speed: b.big ? 520 : 420, gravity: 1000, drag: 1.4, spin: 18, size: b.big ? 12 : 9, life: 1.1 });
    k.burst(b.x, b.y, { shape: 'confetti', n: 10, colors: ['#ffffff', b.col[1]], speed: 260, gravity: 500, size: 6, life: 0.9 });
    say(b.big ? 'NOT TODAY, RUST' : k.pick(CHEERS), b.x, b.y - b.ry * 0.3, { size: b.big ? 30 : 32 });
    debris.push({ pts: b.pts.map((p) => ({ ...p, py: p.py + 2 })), label: b.label, age: 0 });
    k.score('balloons', 1, { icon: '🎈', label: 'Scope creep popped', says: 'popped {n} scope-creep balloon{s}' });
  }

  function say(text, x, y, o = {}) {
    fx.push({ text, x: k.clamp(x, 80, k.vw - 80), y: k.clamp(y, 50, k.vh - 40), age: 0, life: o.life ?? 0.8, size: o.size ?? 32, fill: o.fill ?? '#ffffff', rot: o.rot ?? k.rand(-0.16, 0.16), rise: o.rise ?? 50, kind: o.kind || 'comic' });
  }

  // ── drawing ──
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

  function string(pts, alpha = 1) {
    c.globalAlpha = alpha;
    c.strokeStyle = 'rgba(120,120,120,.9)';
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) c.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
    c.lineTo(pts.at(-1).x, pts.at(-1).y);
    c.stroke();
    c.globalAlpha = 1;
  }

  function tag(label, pts, alpha = 1, spin = 0) {
    const a = pts.at(-1), b = pts.at(-2);
    const ang = (Math.atan2(a.y - b.y, a.x - b.x) - Math.PI / 2) * 0.6 + spin;
    c.save();
    c.globalAlpha = alpha;
    c.translate(a.x, a.y);
    c.rotate(ang);
    c.font = k.font(13, 700, 'hand');
    const text = k.ellipsize(c, label, 150);
    const w = c.measureText(text).width + 22, h = 22;
    c.fillStyle = 'rgba(0,0,0,.18)';
    c.beginPath(); c.roundRect(-w / 2 + 2, 4, w, h, 4); c.fill();
    c.fillStyle = '#fffaf0';
    c.strokeStyle = '#d6c7a6';
    c.lineWidth = 1;
    c.beginPath(); // a luggage tag, clipped corners at the top
    c.moveTo(-w / 2 + 6, 1); c.lineTo(w / 2 - 6, 1); c.lineTo(w / 2, 7); c.lineTo(w / 2, 1 + h); c.lineTo(-w / 2, 1 + h); c.lineTo(-w / 2, 7); c.closePath();
    c.fill(); c.stroke();
    c.fillStyle = '#c9b48a';
    c.beginPath(); c.arc(0, 6, 1.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a3020';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 0, 15);
    c.restore();
  }

  function balloon(b) {
    const { rx, ry, col } = b;
    c.save();
    c.translate(b.x, b.y);
    c.rotate(b.tilt);
    c.fillStyle = 'rgba(0,0,0,.06)'; // a soft shadow on whatever's behind
    c.beginPath(); c.ellipse(6, 10, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(-rx * 0.35, -ry * 0.42, rx * 0.08, 0, 0, ry * 1.15);
    g.addColorStop(0, col[1]);
    g.addColorStop(0.42, col[0]);
    g.addColorStop(1, col[2]);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, ry);
    c.bezierCurveTo(rx * 1.3, ry * 0.6, rx * 1.12, -ry, 0, -ry);
    c.bezierCurveTo(-rx * 1.12, -ry, -rx * 1.3, ry * 0.6, 0, ry);
    c.fill();
    c.fillStyle = col[2]; // the knot
    c.beginPath(); c.moveTo(-2.5, ry - 1); c.lineTo(2.5, ry - 1); c.lineTo(4.5, ry + 6); c.lineTo(-4.5, ry + 6); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; // shine
    c.beginPath(); c.ellipse(-rx * 0.4, -ry * 0.42, rx * 0.17, ry * 0.3, 0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.beginPath(); c.ellipse(-rx * 0.12, -ry * 0.78, rx * 0.07, ry * 0.06, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.1)'; // rim light on the far side
    c.beginPath(); c.ellipse(rx * 0.5, ry * 0.3, rx * 0.22, ry * 0.4, -0.4, 0, Math.PI * 2); c.fill();
    if (b.big) { // the heavy one has a crab on it
      c.font = k.font(crab ? rx * 0.62 : rx * 0.5, 900, crab ? 'emoji' : 'display');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.fillText(crab ? '🦀' : 'RS', 0, 2);
    }
    c.restore();
  }

  function rope(pts, ax, ay, dt, weight = 1) { // verlet string hanging from (ax, ay)
    pts[0].x = ax; pts[0].y = ay;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * 0.94, vy = (p.y - p.py) * 0.94;
      p.px = p.x; p.py = p.y;
      p.x += vx + Math.sin(t * 2.3 + i * 0.7 + ax * 0.01) * 70 * weight * dt * dt * i;
      p.y += vy + (i === pts.length - 1 ? 1100 * weight : 500) * dt * dt;
    }
    for (let n = 0; n < 4; n++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const diff = (d - LINK) / d;
        if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; } else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
      pts[0].x = ax; pts[0].y = ay;
    }
  }

  k.loop((dt) => {
    t += dt;
    c.clearRect(0, 0, cv.w, cv.h);
    if (spawned < N && t > 0.35 + spawned * 0.62) spawn();

    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      b.age += dt;
      b.y += b.vy * dt * (1 + Math.min(0.35, b.age * 0.08)); // they speed up a little as they go
      const sway = Math.sin(b.age * b.f + b.ph);
      b.x = b.x0 + sway * b.amp;
      b.tilt = Math.cos(b.age * b.f + b.ph) * 0.1;
      rope(b.pts, b.x - Math.sin(b.tilt) * b.ry, b.y + Math.cos(b.tilt) * (b.ry + 5), dt);
      if (b.pts.at(-1).y < -40) {
        list.splice(i, 1);
        escaped.push(b.label);
        k.sfx.tone({ freq: 600, to: 1500, dur: 0.3, gain: 0.03 });
        const row = fx.filter((f) => f.kind === 'gone').length % 3;
        fx.push({ kind: 'gone', text: `“${k.clip(b.label, 24)}” is in v1 now`, x: b.x, y: 34 + row * 34, age: 0, life: 1.8, rise: -14 });
      }
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.age += dt;
      const top = d.pts[0];
      top.py = top.y; top.y += (180 + d.age * 900) * dt; // the string's free now and falls
      rope(d.pts, top.x, top.y, dt, 0.6);
      if (d.age > 1.1) { debris.splice(i, 1); continue; }
      const a = Math.min(1, (1.1 - d.age) * 3);
      string(d.pts, a);
      tag(d.label, d.pts, a, Math.sin(d.age * 14) * 0.25 * (1 - d.age));
    }
    for (const b of list) { string(b.pts); tag(b.label, b.pts); }
    for (const b of list) balloon(b);

    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.age += dt;
      const p = f.age / f.life;
      if (p >= 1) { fx.splice(i, 1); continue; }
      const a = Math.min(1, (1 - p) * 3, f.age * 8);
      if (f.kind === 'gone') {
        c.save();
        c.globalAlpha = a;
        c.font = k.font(12.5, 650);
        const w = c.measureText(f.text).width + 34;
        const x = k.clamp(f.x, w / 2 + 10, k.vw - w / 2 - 10);
        const y = f.y - k.ease.outCubic(Math.min(1, f.age * 3)) * f.rise;
        c.shadowColor = 'rgba(0,0,0,.3)';
        c.shadowBlur = 12;
        c.shadowOffsetY = 4;
        c.fillStyle = ctx.dark ? '#f2f2f2' : 'rgba(14,14,14,.86)';
        c.beginPath(); c.roundRect(x - w / 2, y - 13, w, 26, 13); c.fill();
        c.shadowColor = 'transparent';
        c.fillStyle = '#ff4d5e';
        c.beginPath(); c.arc(x - w / 2 + 14, y, 3.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = ctx.dark ? '#141414' : '#fff';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(f.text, x - w / 2 + 24, y + 0.5);
        c.restore();
      } else comic(f.text, f.x, f.y - k.ease.outCubic(p) * f.rise, f.size, f.fill, f.rot, a, 0.5 + k.ease.outBack(Math.min(1, f.age / 0.16)) * 0.5);
    }

    if (spawned === N && !list.length && !verdictAt && !k.reduced) {
      verdictAt = t;
      centre();
      k.cursor(null);
      if (!escaped.length) { k.sfx.tada(); k.burst(k.vw / 2, k.vh * 0.42, { n: 70, speed: 700, shape: 'mix', life: 1.8 }); } else k.sfx.blip({ pitch: 0.6 });
      k.after(2700, k.end);
    }
    if (verdictAt) {
      const vt = t - verdictAt;
      const a = Math.min(1, vt * 4) * Math.min(1, (2.7 - vt) * 3);
      const e = escaped.length;
      const small = !e ? 'Scope: contained. Ship it.'
        : !popped ? 'You let it all in. Product is thrilled.'
          : e === 1 ? `“${k.clip(escaped[0], 20)}” got away. It's in v1 now.`
            : e < 4 ? `${e} features got away. The sprint is full.` : `${e} features got away. See you in Q3.`;
      const x = verdictX, y = k.vh * 0.42;
      c.font = k.font(26, 900, 'display');
      const w = Math.min(k.vw - 24, Math.max(320, c.measureText(small).width + 70));
      c.save();
      c.translate(x, y + 30);
      c.rotate(-0.04);
      c.globalAlpha = a * (ctx.dark ? 0.94 : 0.82);
      c.fillStyle = '#121212';
      c.beginPath(); c.roundRect(-w / 2, -95, w, 180, 26); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.14)'; // so it lifts off a dark UI too
      c.lineWidth = 1.5;
      c.stroke();
      c.restore();
      comic(`${popped} / ${N}`, x, y, 96, !e ? '#ffd23f' : '#ffffff', -0.04, a, 0.6 + k.ease.outBack(Math.min(1, vt / 0.3)) * 0.4);
      comic(small, x, y + 74, k.fit(c, small, w - 40, { size: 26, min: 16, weight: 900, family: 'display' }).size, '#ffffff', -0.04, a * k.clamp((vt - 0.25) * 4));
    }
  }, { still: 2.4 });

  if (k.reduced) k.after(3500, k.end);

  return {
    layout() { if (verdictAt) centre(); },
  };
}
