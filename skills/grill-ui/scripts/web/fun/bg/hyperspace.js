// Hyperspace. Stars stream out from behind the card, faster the further you are through the grill.
// Answering punches it to lightspeed. Space junk drifts past now and then and the ship's computer
// calls it out. While the agent works, the hyperdrive is "being fixed". At the end you arrive.

const DEBRIS = [
  ['🦆', 'rubber duck', 'It has seen your code.'], ['🛋', 'sofa', 'Someone was moving.'], ['☕', 'coffee', 'Still warm.'],
  ['🧦', 'one sock', 'The other is in another galaxy.'], ['🚽', 'toilet', 'Do not ask.'], ['🐄', 'cow', 'Over the moon, apparently.'],
  ['🍕', 'pizza slice', 'Pineapple. Disputed.'], ['📎', 'paperclip', 'It wants to help.'], [null, 'TODO note', 'Not ours. Probably.'],
  ['🧇', 'waffle', 'Like the last meeting.'], ['🎸', 'guitar', 'From a band you have not heard of.'],
];
const IDLE_LINES = (q, warp) => [
  `Warp ${warp}. Each answer adds speed.`,
  'Passengers are reminded the ★ is the fastest route.',
  'Please keep your decisions inside the vehicle.',
  q && q.total - q.n > 0 ? `${q.total - q.n} more question${q.total - q.n === 1 ? '' : 's'} to Done.` : 'Approaching Done.',
  'Do not panic. Bring a towel.',
];

export default function hyperspace(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  const N = 720;
  const stars = Array.from({ length: N }, () => spawn({}, true));
  let nebula = null;
  let vp = { x: 0, y: 0 }, F = 600, hud = null;
  let v = 0, jump = 0, flash = 0, shake = 0;
  let junk = null, nextJunk = k.rand(5, 9);
  let msg = { lines: [], i: 0, chars: 0, hold: 0, override: null };
  let planet = 0; // arrival, 0..1

  function spawn(s, anywhere) {
    const a = k.rand(Math.PI * 2), r = Math.sqrt(k.rand(0.0004, 1)) * 1.6;
    s.x = Math.cos(a) * r; s.y = Math.sin(a) * r;
    s.z = anywhere ? k.rand(0.05, 1) : k.rand(0.9, 1);
    s.hue = k.chance(0.15) ? k.pick([200, 260, 30]) : 220;
    return s;
  }

  const target = () => (ctx.front === 'done' ? 0.02 : ctx.front === 'waiting' ? 0.035 : 0.12 + (ctx.progress?.ratio || 0) * 0.85);
  const warp = () => (1 + (ctx.progress?.ratio || 0) * 8).toFixed(1);

  function buildNebula() {
    const e = document.createElement('canvas');
    e.width = Math.ceil(cv.w / 2); e.height = Math.ceil(cv.h / 2);
    const g = e.getContext('2d');
    g.scale(0.5, 0.5);
    g.fillStyle = '#02030a';
    g.fillRect(0, 0, cv.w, cv.h);
    const r = k.rng(`neb${ctx.doc?.slug}`);
    for (const [col, n] of [['70,40,160', 3], ['20,90,170', 3], ['170,40,120', 2]]) for (let i = 0; i < n; i++) {
      const x = r.rand(cv.w), y = r.rand(cv.h), R = r.rand(0.25, 0.5) * Math.max(cv.w, cv.h);
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(${col},.22)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, cv.w, cv.h);
    }
    nebula = e;
  }

  function layout() {
    const sp = k.space();
    const card = sp.card, st = sp.stage;
    vp = card ? { x: card.left + card.width / 2, y: card.top + card.height * 0.45 } : { x: st.left + st.width / 2, y: st.top + st.height / 2 };
    F = Math.max(cv.w, cv.h) * 0.42;
    const b = sp.gaps.find((g) => g.where === 'bottom' && g.h >= 74 && g.w >= 300);
    const t = sp.gaps.find((g) => g.where === 'top' && g.h >= 46 && g.w >= 300);
    const g = b || t || sp.gaps[0];
    hud = g && { ...g, at: b ? 'bottom' : t ? 'top' : g.where };
    const nd = ctx.decisions.length || ctx.answers.length;
    msg.lines = ctx.front === 'done' ? [`Arrived. Welcome to planet ${ctx.doc?.slug || 'Done'}.`, `${nd} decision${nd === 1 ? '' : 's'} on board. Mind the gap.`]
      : ctx.front === 'waiting' ? ['Hyperdrive offline. The agent is fixing it.', 'It is mostly hitting it with a spanner.', ctx.agent === 'listening' ? 'The agent is listening. Say something nice.' : 'Please remain in your seat.']
      : IDLE_LINES(ctx.question, warp());
  }

  function say(text) { msg.override = text; msg.chars = 0; msg.hold = 0; }

  function launchJunk() {
    if (!hud || ctx.front !== 'question') return;
    const [emoji, name, quip] = k.pick(DEBRIS);
    const ok = emoji && k.canRender(emoji, 'emoji');
    const gx = hud.x + hud.w * k.rand(0.72, 0.9), gy = hud.y + hud.h * k.rand(0.35, 0.6);
    const dx = gx - vp.x, dy = gy - vp.y;
    const z = 1.6, zHit = 0.5; // world position that projects onto the gap at z = zHit
    junk = { emoji: ok ? emoji : null, name, x: (dx * zHit) / F, y: (dy * zHit) / F, z, rot: k.rand(6.28), spin: k.rand(-2.5, 2.5), said: false, quip };
  }

  cv.resized = (w, h, { dprOnly } = {}) => { if (dprOnly) return; buildNebula(); layout(); }; // the nebula is half-res, DPR-free
  buildNebula();
  layout();
  v = k.reduced ? 0.5 : target();
  if (k.reduced) { launchJunk(); if (junk) junk.z = 0.5; }

  function drawJunk(dt) {
    if (!junk) return;
    if (!k.reduced) { junk.z -= dt * (0.32 + v * 0.4); junk.rot += junk.spin * dt; }
    if (junk.z <= 0.12) { junk = null; return; }
    const sx = vp.x + (junk.x / junk.z) * F, sy = vp.y + (junk.y / junk.z) * F;
    const size = 34 / junk.z;
    if (!junk.said && junk.z < 0.9) { junk.said = true; say(`Object identified: ${junk.name}. ${junk.quip}`); k.sfx.whoosh({ pitch: 1.6, gain: 0.25 }); }
    c.save();
    c.globalAlpha = k.clamp((1.6 - junk.z) * 2);
    c.translate(sx, sy);
    c.rotate(junk.rot);
    if (junk.emoji) {
      c.font = k.font(size, 400, 'emoji');
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(junk.emoji, 0, 0);
    } else { // a sticky note, always drawable
      c.fillStyle = '#ffe66b';
      c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 8;
      c.fillRect(-size / 2, -size / 2, size, size);
      c.shadowBlur = 0;
      c.fillStyle = '#5a4a00';
      c.font = k.font(size * 0.28, 800, 'hand');
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('TODO', 0, 0);
    }
    c.restore();
  }

  function drawPlanet(t) {
    if (planet <= 0 || !hud) return;
    const e = k.ease.outCubic(planet);
    const R = Math.max(24, Math.min(hud.h * 0.3, hud.w * 0.14, 100));
    const x = hud.x + hud.w * 0.76, y = hud.y + hud.h * 0.58 + (1 - e) * R * 1.5;
    c.save();
    const g = c.createRadialGradient(x - R * 0.4, y - R * 0.4, R * 0.1, x, y, R);
    g.addColorStop(0, '#ffd59a'); g.addColorStop(0.5, '#e0703a'); g.addColorStop(1, '#3a0f2a');
    c.globalAlpha = e;
    const ring = (front) => {
      c.strokeStyle = 'rgba(255,220,180,.6)'; c.lineWidth = R * 0.07;
      c.beginPath(); c.ellipse(x, y, R * 1.65, R * 0.3, -0.22, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(255,190,140,.35)'; c.lineWidth = R * 0.04;
      c.beginPath(); c.ellipse(x, y, R * 1.85, R * 0.36, -0.22, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); c.stroke();
    };
    ring(false);
    c.shadowColor = 'rgba(255,150,80,.5)'; c.shadowBlur = 40;
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0;
    ring(true);
    c.font = k.font(11, 700, 'mono');
    c.fillStyle = 'rgba(255,230,200,.9)';
    c.textAlign = 'center';
    c.fillText(`◉ ${k.clip((ctx.doc?.slug || 'done').toUpperCase(), 28)}`, x, y - R - 12);
    c.restore();
  }

  function drawHud(dt, t) {
    if (!hud) return;
    const compact = hud.h < 74;
    const pad = 20;
    const x0 = hud.x + pad, x1 = hud.x + hud.w - pad;
    const y = hud.at === 'top' ? hud.y + hud.h / 2 : hud.y + Math.min(hud.h - 34, 52);
    const cyan = 'rgba(120,220,255,.95)';
    c.save();
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(80,200,255,.8)'; c.shadowBlur = 8;
    // warp readout
    c.fillStyle = cyan;
    c.font = k.font(10, 700, 'mono');
    const label = ctx.front === 'done' ? 'SUBLIGHT' : ctx.front === 'waiting' ? 'HYPERDRIVE' : 'WARP';
    c.fillText(label, x0, y - 12);
    c.font = k.font(24, 800, 'mono');
    const val = ctx.front === 'done' ? '0.0' : ctx.front === 'waiting' ? (Math.floor(t * 2) % 2 ? 'ERR' : '---') : (jump > 0.2 ? '∞' : warp());
    c.fillText(val, x0, y + 9);
    // route: one tick per question
    const total = Math.max(1, ctx.progress?.total || ctx.question?.total || 1);
    const answered = ctx.progress?.answered || 0;
    const bx0 = x0 + 110, bx1 = Math.min(x1, bx0 + Math.max(160, (x1 - bx0) * 0.42));
    const by = y - 4;
    c.strokeStyle = 'rgba(120,220,255,.35)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(bx0, by); c.lineTo(bx1, by); c.stroke();
    for (let i = 0; i <= total; i++) {
      const x = k.lerp(bx0, bx1, i / total);
      const done = i < answered || ctx.front === 'done';
      c.fillStyle = done ? cyan : 'rgba(120,220,255,.3)';
      c.beginPath(); c.arc(x, by, i === total ? 5 : 3, 0, Math.PI * 2); c.fill();
    }
    const shipX = k.lerp(bx0, bx1, ctx.front === 'done' ? 1 : Math.min(answered + 0.5, total) / total);
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(shipX + 7, by); c.lineTo(shipX - 5, by - 5); c.lineTo(shipX - 2, by); c.lineTo(shipX - 5, by + 5); c.closePath(); c.fill();
    c.font = k.font(10, 700, 'mono');
    c.fillStyle = 'rgba(120,220,255,.7)';
    c.fillText('YOU', bx0 - 2, by + 15);
    c.textAlign = 'right';
    c.fillText('DONE', bx1 + 4, by + 15);
    c.textAlign = 'left';
    // the ship's computer, typing
    const mx = compact ? bx1 + 24 : x0;
    const my = compact ? y : y + 40;
    const maxW = x1 - mx;
    if (maxW > 120) {
      const line = msg.override || msg.lines[msg.i % msg.lines.length] || '';
      if (k.reduced) msg.chars = line.length;
      else if (msg.chars < line.length) msg.chars = Math.min(line.length, msg.chars + dt * 38);
      else if ((msg.hold += dt) > 4.2) { msg.override ? (msg.override = null) : msg.i++; msg.chars = 0; msg.hold = 0; }
      c.font = k.font(compact ? 11 : 13, 600, 'mono');
      c.fillStyle = '#d8f4ff';
      const text = k.ellipsize(c, `> ${line.slice(0, Math.floor(msg.chars))}`, maxW - 12);
      c.fillText(text, mx, my);
      if (k.reduced || Math.floor(t * 2.4) % 2 === 0) c.fillRect(mx + c.measureText(text).width + 3, my - 6, 7, 12);
    }
    c.restore();
  }

  k.loop((dt, t) => {
    v = k.lerp(v, target() * (1 + jump * 7), Math.min(1, dt * (jump > 0 ? 4 : 0.8)));
    jump = Math.max(0, jump - dt * 0.7);
    flash = Math.max(0, flash - dt * 2.2);
    shake = Math.max(0, shake - dt * 2);
    if (ctx.front === 'done') planet = Math.min(1, planet + dt * 0.25);
    if (!k.reduced && (nextJunk -= dt) <= 0) { launchJunk(); nextJunk = k.rand(14, 26); }

    c.drawImage(nebula, 0, 0, cv.w, cv.h);
    const ox = shake ? k.rand(-3, 3) * shake : 0, oy = shake ? k.rand(-3, 3) * shake : 0;
    const vx = vp.x + ox, vy = vp.y + oy;
    const streak = k.reduced ? 0.22 : Math.min(0.5, v * 0.09 + jump * 0.25);
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    const B = 4; // buckets by depth: near stars are thicker and brighter
    const paths = Array.from({ length: B }, () => new Path2D());
    for (const s of stars) {
      s.z -= v * dt;
      if (s.z <= 0.02) { spawn(s); continue; }
      const z1 = s.z + streak * (1 - s.z * 0.3);
      const x = vx + (s.x / s.z) * F, y = vy + (s.y / s.z) * F;
      if (x < -50 || x > cv.w + 50 || y < -50 || y > cv.h + 50) { spawn(s); continue; }
      const tx = vx + (s.x / z1) * F, ty = vy + (s.y / z1) * F;
      const b = Math.min(B - 1, Math.floor((1 - s.z) * B));
      paths[b].moveTo(tx, ty);
      paths[b].lineTo(x + 0.01, y);
    }
    for (let b = 0; b < B; b++) {
      const f = (b + 1) / B;
      c.strokeStyle = `rgba(${180 + f * 75},${210 + f * 45},255,${0.25 + f * 0.7})`;
      c.lineWidth = 0.6 + f * f * 2.4;
      c.stroke(paths[b]);
    }
    c.globalCompositeOperation = 'source-over';
    if (flash > 0) { c.fillStyle = `rgba(220,240,255,${flash * 0.55})`; c.fillRect(0, 0, cv.w, cv.h); }
    drawPlanet(t);
    drawJunk(dt);
    drawHud(dt, t);
  }, { still: 1 });

  return {
    question() { layout(); if (!k.reduced) msg.chars = 0; },
    layout,
    status() { layout(); },
    decisions() { layout(); },
    answer() {
      if (!k.reduced) { jump = 1; flash = 1; shake = 1; } // a still frame can't fade a flash or settle a shake
      say(ctx.lastAnswer?.tookRec ? 'Punch it. ★ route confirmed.' : 'Punch it. Off-piste route confirmed.');
      k.sfx.whoosh({ pitch: 0.5, gain: 0.8 });
      k.sfx.tone({ type: 'sawtooth', freq: 55, to: 880, dur: 1, gain: 0.05, filter: 'lowpass', freqF: 1200 });
    },
    keystroke() { if (!k.reduced) v += 0.01; },
  };
}
