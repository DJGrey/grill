// Fortune cookie. One drops into the space by the card. Click it to crack it open and read a
// fortune about the question in front of you. Leave it alone and it gets impatient.

const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Liberation Serif", serif';
const W = 150, HT = 96; // cookie size in its own units
const CRUMBS = ['#e9a94a', '#d18a2c', '#f4c977', '#b8701d'];

const TAGS = {
  architecture: 'You will soon rewrite something you swore you would never touch again.',
  risk: 'The edge case you forgot is thinking about you too.',
  scope: 'Scope creep approaches. It has brought friends.',
  ux: 'A user will click the wrong button. It will be the one you are designing right now.',
  rollout: 'Ship on a Friday and you shall know fear.',
  discovery: 'The answer is in a spreadsheet nobody has shared with you yet.',
  setup: 'Naming things is hard. You will rename this twice.',
  data: 'A migration is in your future. It will take longer than the estimate.',
};

function fortunes(k, ctx) {
  const q = ctx.question;
  const clip = (s, n = 44) => `“${k.clip(s, n)}”`;
  const out = [];
  if (ctx.front === 'done') {
    const n = ctx.answers.length;
    out.push(`You made ${n} decision${n === 1 ? '' : 's'} today. At least ${Math.max(1, Math.ceil(n * 0.7))} of them were good.`, 'The grill is over. The pull request has only just begun.', 'You will forget why you chose this. Luckily, someone wrote it all down.');
  } else if (!q) {
    out.push('The agent is thinking about you right now. Mostly about edge cases.', 'Your next question will be harder. Drink some water.', 'Good things come to those who wait for the agent.', 'A question is coming. It has a recommended answer. You will ignore it.');
  } else {
    const rec = q.recommended[0];
    const other = q.options.find((o) => !o.recommended)?.label;
    if (rec) out.push(`You will choose ${clip(rec)}. You will be smug about it for days.`, `A wise person once picked ${clip(rec, 36)}. They got promoted. Results not typical.`, 'The ★ is not a suggestion. It is a prophecy.');
    if (other) out.push(`${clip(other)} is a trap. Your future self says hi.`, `Beware ${clip(other, 36)}. It has the eyes of a refactor.`);
    if (!q.options.length) out.push('The answer you seek is not among the options. There are no options. Type something.');
    if (q.multi) out.push('You will be asked to pick several things. You will pick all of them.');
    if (q.revising) out.push('You have been here before. You will be here again.');
    const left = q.total - q.n;
    out.push(left > 0 ? `${left} more question${left === 1 ? '' : 's'} stand${left === 1 ? 's' : ''} between you and lunch.` : 'This is the last question. Probably. The agent says that every time.');
    const tag = TAGS[(q.tag || '').toLowerCase()];
    if (tag) out.push(tag);
    if (ctx.cardTime > 90) out.push(`You have looked at question ${q.n} for ${Math.round(ctx.cardTime / 60)} minute${Math.round(ctx.cardTime / 60) === 1 ? '' : 's'}. The cookie sees all.`);
    out.push(`Help! I am trapped in a fortune cookie factory writing ${(q.tag || 'product').toLowerCase()} decisions.`);
  }
  if (ctx.recRate !== null && ctx.answers.length >= 3) {
    const pc = Math.round(ctx.recRate * 100);
    out.push(pc >= 70 ? `You take the ★ ${pc}% of the time. The ★ is flattered.` : `You ignore the ★ ${100 - pc}% of the time. It has stopped taking it personally.`);
  }
  const d = ctx.decisions.filter((x) => x.n).at(-1);
  if (d) out.push(`D${d.n}, ${clip(d.text, 40)}, will come back to haunt you. Fondly.`);
  return out;
}

// Lucky numbers, mostly lifted from the question itself.
function lucky(k, ctx) {
  const q = ctx.question;
  const text = q ? [q.title, q.context, ...q.options.map((o) => `${o.label} ${o.description}`)].join(' ') : ctx.doc.summary;
  const nums = [...new Set((text.match(/\d[\d,.]*k?/gi) || []).map((s) => s.replace(/[,.]$/, '')).filter((s) => s.length <= 6))];
  if (q) nums.push(String(q.n), String(q.total));
  const out = [...new Set(k.shuffle(nums))].slice(0, 4);
  while (out.length < 6) { const n = String(k.int(1, 49)); if (!out.includes(n)) out.push(n); }
  return k.shuffle(out);
}

// The answer box and the options, padded: the cookie, its crumbs and the slip all stay off them.
function keepOut(k, pad = 14) {
  const rs = [k.ui.answer()?.parentElement, ...k.ui.options().map((o) => o.el)].map((el) => k.rect(el)).filter(Boolean);
  if (!rs.length) return null;
  return { l: Math.min(...rs.map((r) => r.left)) - pad, t: Math.min(...rs.map((r) => r.top)) - pad, r: Math.max(...rs.map((r) => r.right)) + pad, b: Math.max(...rs.map((r) => r.bottom)) + pad };
}
const inside = (Z, x, y) => !!Z && x > Z.l && x < Z.r && y > Z.t && y < Z.b;
const overlaps = (Z, l, t, r, b) => !!Z && l < Z.r && r > Z.l && t < Z.b && b > Z.t;

export default function fortune(k, ctx) {
  const cv = k.canvas();
  const c = cv.ctx;
  const line = k.pick(fortunes(k, ctx));
  const nums = lucky(k, ctx);

  // Where it lands: the roomiest space beside the card, else over the sidebar or Notes, else the strip of card under
  // the answer box, else the strip above the options. Never on the answer box or the options.
  const sp = k.space();
  const Z = keepOut(k);
  const card = sp.card;
  const panels = [sp.side, sp.notes].filter((r) => r && r.width >= 200 && r.right <= k.vw + 1 && r.left >= -1).map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
  const strip = (y, b) => card && b - y >= 120 && { x: card.left, y, w: card.width, h: b - y };
  const gap = sp.gaps.find((g) => g.h >= 210 && g.w >= 340)
    || panels.sort((a, b) => b.w * b.h - a.w * a.h)[0]
    || sp.gaps.find((g) => g.where !== 'top' && g.h >= 140 && g.w >= 300)
    || (Z ? strip(Z.b, k.vh) || strip(Math.max(0, card.top), Z.t) : null);
  const R = gap || { x: 0, y: 0, w: k.vw, h: k.vh };
  const S = gap ? k.clamp(Math.min(gap.h / 280, gap.w / 420), 0.5, 1.1) : 0.9;
  const low = R.y + R.h - HT * 0.62 * S - 30; // leave room for the hint under it
  const home = gap
    ? { x: gap.x + gap.w / 2, y: Math.max(R.y + HT * 0.5 * S + 6, Math.min(gap.y + gap.h * (gap.where === 'top' ? 0.5 : 0.6), gap.y + gap.h - 60 * S - 30, low)) }
    : { x: (card ? card.left + card.width / 2 : k.vw / 2), y: card ? k.clamp(card.top + card.height * 0.55, 160, k.vh - 140) : k.vh / 2 };
  // Dropping in from the top would pass through the answer box: it tumbles in from the nearest side instead.
  const from = !overlaps(Z, home.x - W * 0.55 * S, -200, home.x + W * 0.55 * S, home.y + HT * 0.6 * S) ? 0 : home.x < k.vw / 2 ? -1 : 1;
  const ck = { x: from ? (from < 0 ? -W * S : k.vw + W * S) : home.x, y: from ? home.y : -120, rot: -0.5, sx: 1, sy: 1 };
  let state = 'drop'; // drop → idle → cracked → out
  let landed = 0; // when it hit the ground
  let wobble = 0;
  let halves = null;
  let hover = false;
  let impatient = false;

  // Draw the cookie once, big, to an offscreen canvas. The halves are drawn from it, clipped.
  const sprite = document.createElement('canvas');
  const SD = 2 * S;
  sprite.width = Math.ceil((W + 40) * SD);
  sprite.height = Math.ceil((HT + 40) * SD);
  drawCookie(sprite.getContext('2d'));

  // Front-on fortune cookie: a thick golden arch, horns down, the hollow fold showing underneath.
  function cookiePath(g) {
    g.beginPath();
    g.moveTo(-W / 2 + 4, HT / 2 - 14);
    g.bezierCurveTo(-W / 2 - 6, -12, -40, -HT / 2, 0, -HT / 2);
    g.bezierCurveTo(40, -HT / 2, W / 2 + 6, -12, W / 2 - 4, HT / 2 - 14);
    g.bezierCurveTo(W / 2 - 6, HT / 2 - 2, W / 2 - 26, HT / 2 + 2, W / 2 - 32, HT / 2 - 8); // right horn tip
    g.bezierCurveTo(W / 2 - 44, 2, 22, 4, 0, 6); // inner arch
    g.bezierCurveTo(-22, 4, -W / 2 + 44, 2, -W / 2 + 32, HT / 2 - 8);
    g.bezierCurveTo(-W / 2 + 26, HT / 2 + 2, -W / 2 + 6, HT / 2 - 2, -W / 2 + 4, HT / 2 - 14);
    g.closePath();
  }

  function drawCookie(g) {
    g.scale(SD, SD);
    g.translate((W + 40) / 2, (HT + 40) / 2);
    // the hollow, then the fortune poking out of it
    const hollow = g.createLinearGradient(0, 4, 0, HT / 2 + 6);
    hollow.addColorStop(0, '#5e3006');
    hollow.addColorStop(1, '#a8661a');
    g.fillStyle = hollow;
    g.beginPath();
    g.ellipse(0, HT / 2 - 16, W / 2 - 36, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(6, HT / 2 - 6);
    g.rotate(0.22);
    g.fillStyle = '#fffdf4';
    g.strokeStyle = 'rgba(90,50,0,.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.rect(-22, -6, 54, 13);
    g.fill();
    g.stroke();
    g.fillStyle = '#c0392b';
    for (const [x, w] of [[-4, 14], [13, 12]]) g.fillRect(x, -0.5, w, 1.6);
    g.restore();
    g.save();
    cookiePath(g);
    const body = g.createRadialGradient(-26, -30, 6, 0, -4, W * 0.62);
    body.addColorStop(0, '#fde7b4');
    body.addColorStop(0.4, '#f2c063');
    body.addColorStop(0.8, '#de9a36');
    body.addColorStop(1, '#b8711c');
    g.fillStyle = body;
    g.fill();
    g.clip();
    const edge = g.createRadialGradient(0, -6, W * 0.24, 0, -6, W * 0.6);
    edge.addColorStop(0, 'rgba(160,80,0,0)');
    edge.addColorStop(1, 'rgba(140,70,0,.42)');
    g.fillStyle = edge;
    g.fillRect(-W, -HT, W * 2, HT * 2);
    g.strokeStyle = 'rgba(255,236,190,.7)'; // light catching the thickness of the inner edge
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(W / 2 - 34, HT / 2 - 10);
    g.bezierCurveTo(W / 2 - 46, 6, 22, 8, 0, 10);
    g.bezierCurveTo(-22, 8, -W / 2 + 46, 6, -W / 2 + 34, HT / 2 - 10);
    g.stroke();
    const r = k.rng(7);
    g.fillStyle = 'rgba(150,85,20,.3)';
    for (let i = 0; i < 46; i++) { g.beginPath(); g.arc(r.rand(-W / 2, W / 2), r.rand(-HT / 2, HT / 2), r.rand(0.6, 1.6), 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(130,65,5,.5)'; // the crease
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, -HT / 2 + 4);
    g.bezierCurveTo(5, -26, -4, -10, 0, 5);
    g.stroke();
    g.fillStyle = 'rgba(255,250,232,.6)';
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.ellipse(sx * 28, -30, 18, 6.5, sx * -0.4, 0, Math.PI * 2);
      g.fill();
    }
    cookiePath(g);
    g.strokeStyle = '#8a4f10';
    g.lineWidth = 2.5;
    g.lineJoin = 'round';
    g.stroke();
  }

  function blit(x, y, rot, sx, sy, clip) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(sx * S, sy * S);
    if (clip) { c.beginPath(); clip(); c.clip(); }
    c.drawImage(sprite, -(W + 40) / 2, -(HT + 40) / 2, W + 40, HT + 40);
    c.restore();
  }

  // the break: a jagged line down the crease
  const jag = [[0, -60], [5, -30], [-4, -14], [6, 2], [-5, 18], [4, 34], [0, 70]];
  const halfClip = (side) => () => {
    c.moveTo(side * 200, -100);
    c.lineTo(jag[0][0], -100);
    jag.forEach(([x, y]) => c.lineTo(x, y));
    c.lineTo(side * 200, 100);
    c.closePath();
  };

  function shadow(x, y, w, a) {
    c.fillStyle = `rgba(40,20,0,${0.22 * a})`;
    c.beginPath();
    c.ellipse(x, y, w, w * 0.16, 0, 0, Math.PI * 2);
    c.fill();
  }

  function crack(auto) {
    if (state !== 'idle' && state !== 'drop') return;
    state = 'cracked';
    k.cursor(null);
    const ang = ck.rot;
    halves = [-1, 1].map((side) => ({ side, x: ck.x, y: ck.y, rot: ang, vx: side * k.rand(150, 210), vy: -k.rand(260, 330), vr: side * k.rand(2.5, 4), a: 1 }));
    const spray = Math.min(1, R.w / 440, R.h / 260); // a tight spot gets a smaller crunch, so crumbs stay off your answer
    k.burst(ck.x, ck.y, { shape: 'dot', n: 26, colors: CRUMBS, speed: 380 * spray, gravity: 1300, size: 5, life: 1.2, spread: Math.PI * 1.4 });
    k.burst(ck.x, ck.y, { shape: 'shard', n: 10, colors: CRUMBS, speed: 300 * spray, gravity: 1300, size: 8, spin: 18, life: 1.2 });
    if (k.sfx.on) {
      for (let i = 0; i < 5; i++) k.sfx.noise({ dur: 0.03 + k.rand(0.05), filter: 'bandpass', freq: k.rand(1200, 3200), q: 3, gain: 0.35, delay: i * 0.025 + k.rand(0.015) });
      k.sfx.noise({ dur: 0.35, filter: 'highpass', freq: 3500, gain: 0.1, delay: 0.12, color: 'pink' }); // paper
      k.sfx.chime({ gain: 0.45, delay: 0.25 });
    }
    k.score('fortunes', 1, { icon: '🥠', label: 'Fortune cookies', says: 'cracked {n} fortune cookie{s}' });
    k.after(120, () => showSlip(auto));
  }

  function showSlip(auto) {
    const maxW = Math.min(440, k.vw - 40, gap ? gap.w - 20 : 440);
    const left = k.clamp(ck.x - maxW / 2, Math.max(10, R.x + 4), Math.min(k.vw - maxW - 10, R.x + R.w - maxW - 4));
    const slip = k.el('div', { style: {
      position: 'absolute', left: `${left}px`, top: '0px', width: `${maxW}px`, boxSizing: 'border-box',
      padding: '14px 22px 11px', background: 'linear-gradient(180deg,#fffef8,#fbf6e6)', color: '#b3261e', textAlign: 'center',
      borderRadius: '2px', boxShadow: '0 1px 0 rgba(0,0,0,.06), 0 12px 28px -10px rgba(60,30,0,.45), 0 2px 6px rgba(60,30,0,.18)',
      transformOrigin: '50% 50%', pointerEvents: 'none', visibility: 'hidden',
    } });
    k.el('div', { text: line, style: { font: `italic 500 ${maxW < 360 ? 15 : 17}px/1.32 ${SERIF}`, textWrap: 'balance' } }, slip);
    k.el('div', { text: `Lucky numbers  ${nums.join('  ')}`, style: { marginTop: '8px', font: '600 10.5px/1 ui-monospace, Menlo, Consolas, monospace', letterSpacing: '.08em', color: '#3b5aa8', textTransform: 'uppercase' } }, slip);
    if (auto) k.el('div', { text: '(it got impatient and cracked itself)', style: { marginTop: '7px', font: `italic 11.5px/1 ${SERIF}`, color: '#9a7a50' } }, slip);
    const h = slip.offsetHeight;
    // it pops out of the cookie and rises a little, staying in its spot and off the answer box
    const start = ck.y - 34 * S - 10;
    let top = k.clamp(start - 70 * S, R.y + 4, Math.max(R.y + 4, R.y + R.h - h - 4));
    if (overlaps(Z, left, top, left + maxW, top + h)) top = Z.b + h + 6 <= k.vh ? Z.b + 4 : Math.max(4, Z.t - h - 4);
    const lift = start - top;
    Object.assign(slip.style, { top: `${top}px`, visibility: '' });
    k.animate(slip, [
      { transform: `translateY(${lift}px) scale(.08, .3) rotate(-8deg)`, opacity: 0 },
      { transform: `translateY(${lift * 0.3}px) scale(.35, .9) rotate(-4deg)`, opacity: 1, offset: 0.35 },
      { transform: 'translateY(0) scale(1.04, 1) rotate(-1.5deg)', opacity: 1, offset: 0.8 },
      { transform: 'translateY(0) scale(1) rotate(-1.5deg)', opacity: 1 },
    ], { duration: 700, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
    const read = k.clamp(2600 + line.length * 32, 3800, 6200);
    k.after(read, () => {
      k.animate(slip, [{ transform: 'rotate(-1.5deg)', opacity: 1 }, { transform: 'scale(.94) rotate(4deg)', opacity: 0 }], { duration: 450, easing: 'ease-in', fill: 'forwards' });
      state = 'out';
      k.after(500, k.end);
    });
  }

  k.on(window, 'pointerdown', (e) => {
    if (e.button !== 0 || (state !== 'idle' && state !== 'drop')) return;
    if (Math.hypot((e.clientX - ck.x) / (W * 0.55 * S), (e.clientY - ck.y) / (HT * 0.6 * S)) > 1) return;
    if (inside(keepOut(k, 0), e.clientX, e.clientY)) return; // a click on your answer is yours
    k.consume(e);
    crack(false);
  }, { capture: true });

  k.sfx.whoosh({ pitch: 0.7, gain: 0.35 });
  k.loop((dt, t) => {
    c.clearRect(0, 0, cv.w, cv.h);
    if (state === 'drop') {
      const p = Math.min(1, t / 0.75);
      if (from) { // tumbling in from the side, with a couple of hops
        ck.x = k.lerp(from < 0 ? -W * S : k.vw + W * S, home.x, k.ease.outCubic(p));
        ck.y = home.y - Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) * 22 * S;
        ck.rot = k.lerp(from * 6.5, 0.06, k.ease.outCubic(p));
      } else {
        ck.y = k.lerp(-120, home.y, k.ease.outBounce(p));
        ck.rot = k.lerp(-0.5, 0.06, k.ease.outCubic(p));
      }
      if (p >= 1) {
        state = 'idle';
        k.sfx.thud({ pitch: 1.8, gain: 0.35 });
        landed = t;
      }
    }
    if (state === 'idle') {
      const it = t - landed;
      wobble = Math.max(0, wobble - dt * 3);
      if (it % 1.6 < dt && it > 0.8) wobble = 1; // a little "pick me" wiggle now and then
      if (it > 6.5 && !impatient) { impatient = true; wobble = 2.4; k.sfx.boing({ pitch: 1.4, gain: 0.3 }); }
      if (impatient && it > 7.3) crack(true);
      ck.rot = 0.06 + Math.sin(it * 22) * 0.07 * Math.min(1, wobble);
      const sq = Math.sin(it * 22) * 0.03 * Math.min(1, wobble);
      ck.sx = 1 + sq;
      ck.sy = 1 - sq;
      const over = Math.hypot((k.pointer.x - ck.x) / (W * 0.55 * S), (k.pointer.y - ck.y) / (HT * 0.6 * S)) <= 1;
      if (over !== hover) { hover = over; k.cursor(over ? 'pointer' : null); }
    }
    const ground = home.y + HT * 0.52 * S;
    if (state === 'drop' || state === 'idle') {
      const lift = Math.max(0, ground - (ck.y + HT * 0.5 * S));
      shadow(ck.x, ground, W * 0.44 * S * (1 - Math.min(0.6, lift / 400)), 1 - Math.min(0.8, lift / 400));
      blit(ck.x, ck.y, ck.rot, ck.sx * (hover ? 1.04 : 1), ck.sy * (hover ? 1.04 : 1));
      if (state === 'idle' && t - landed > 0.3) hint(t - landed);
    } else if (halves) {
      for (const h of halves) {
        h.vy += 1500 * dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.rot += h.vr * dt;
        if (h.y > ground - 20 * S && h.vy > 0) { h.y = ground - 20 * S; h.vy *= -0.32; h.vx *= 0.6; h.vr *= 0.5; }
        const lo = R.x + W * 0.3 * S, hi = R.x + R.w - W * 0.3 * S; // the halves stay in the cookie's spot
        if ((h.x < lo && h.vx < 0) || (h.x > hi && h.vx > 0)) h.vx *= -0.5;
        if (state === 'out') h.a = Math.max(0, h.a - dt * 3);
        c.globalAlpha = h.a;
        shadow(h.x, ground, W * 0.22 * S, h.a);
        blit(h.x + h.side * 8, h.y, h.rot, 1, 1, halfClip(h.side));
        c.globalAlpha = 1;
      }
    }
  }, { still: 1 });

  function hint(it) {
    const label = impatient ? 'ugh, fine' : 'click to crack';
    c.save();
    c.globalAlpha = Math.min(1, (it - 0.3) * 3) * 0.92;
    c.font = k.font(12, 650);
    const w = c.measureText(label).width + 20;
    const y = Math.min(ck.y + HT * 0.62 * S + 16, k.vh - 16);
    c.fillStyle = 'rgba(20,14,6,.78)';
    c.beginPath();
    c.roundRect(ck.x - w / 2, y - 11, w, 22, 11);
    c.fill();
    c.fillStyle = '#fff3d6';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, ck.x, y + 0.5);
    c.restore();
  }

  // Reduced motion never runs this game, but a forced test still should: crack it straight away.
  if (k.reduced) { state = 'idle'; ck.y = home.y; ck.rot = 0.06; crack(false); }
}
