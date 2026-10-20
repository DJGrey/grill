// Whack-a-mole. Holes open up in the decision rows on the left and moles in little ties pop out
// holding signs that relitigate your decisions ("per my last mole"). The cursor is a mallet.
// Bonk five before they get through, then a verdict, then it ends itself.

const LINES = ['but what if…', 'quick q', 'circling back', 'hot take:', 'small nit', "let's revisit", "devil's advocate", '+1 to reopen', 'actually…', 'is it though?', 'can we sync?', 'what about AI?', 'one more thing', 'have we A/B tested?', 'step back a sec', 'thoughts?'];
const DUCK = ['noted', 'will follow up', 'k', 'see you at the retro', 'parking this', 'ok but'];
const CHEERS = ['BONK!', 'BONK!', 'THWACK', 'DECIDED.', 'NOPE', 'OVERRULED'];
const VERDICT = [
  ['0 / 5', 'Every decision is back on the table.'],
  ['1 / 5', 'The moles are now the steering committee.'],
  ['2 / 5', 'The moles have scheduled a retro.'],
  ['3 / 5', "Two got through. They've started a thread."],
  ['4 / 5', 'One got through. Expect a calendar invite.'],
  ['5 / 5', 'Decisions defended. Meeting cancelled.'],
];
const GOAL = 5;
const PLAY = 9; // seconds of moles
const FUR = ['#7b5a43', '#6e4f3b', '#86634a'];

export default function moles(k, ctx) {
  const cv = k.canvas();
  const c = cv.ctx;
  const R = k.rng(`${ctx.question?.id || 'moles'}${Date.now()}`);
  const lines = [LINES[0], 'per my last mole', ...k.shuffle(LINES.slice(1))];
  let said = 0;
  let holes = [];
  const fx = []; // floating words { text, x, y, age, life, size, fill, rot, rise, style }
  let bonks = 0, spawned = 0, nextAt = 0.9, t = 0, verdictAt = 0;
  const swing = { t: 9 }; // seconds since the last swing
  let shake = 0;
  let verdictX = 0;
  const centre = () => { const r = k.rect(k.ui.card()); verdictX = r ? r.left + r.width / 2 : k.vw / 2; };

  // Holes go in the decision rows. If the sidebar's hidden (narrow window), they go under the card.
  function dig() {
    const rows = k.ui.rows().filter((r) => r.rect.height > 20 && r.rect.top > 40 && r.rect.bottom < k.vh - 20 && r.rect.left >= -1);
    const pick = rows.length > 6 ? k.shuffle(rows).slice(0, 6) : rows;
    if (pick.length >= 3) {
      holes = pick.map((r, i) => ({ el: r.el, row: r, fx: R.rand(0.42, 0.8), x: 0, y: 0 }));
    } else {
      const sp = k.space();
      const g = sp.gaps.find((x) => x.where === 'bottom' && x.h > 90) || sp.gaps.find((x) => x.w > 260 && x.h > 90) || { x: 0, y: k.vh - 110, w: k.vw, h: 110 };
      const n = Math.max(3, Math.min(5, Math.floor(g.w / 120)));
      holes = Array.from({ length: n }, (_, i) => ({ el: null, x: g.x + g.w * (i + 0.5) / n, y: g.y + Math.min(g.h - 20, g.h * 0.5 + 40) }));
    }
    holes.forEach((h, i) => Object.assign(h, { open: 0, openAt: 0.08 + i * 0.07, mole: null }));
    place();
  }
  // Rows only move on layout or a scroll, so that's when the holes follow them (not every frame).
  function place() {
    for (const h of holes) {
      if (!h.el) continue;
      const r = k.rect(h.el);
      if (!r) { h.gone = true; continue; }
      h.gone = false;
      h.x = r.left + r.width * h.fx;
      h.y = r.bottom - 7;
    }
  }

  function signFor(h) {
    const d = h.row?.decided && ctx.decisions.find((x) => x.id === h.row.id && x.n);
    if (d && R.chance(0.35)) return `re: D${d.n}…`;
    return lines[said++ % lines.length];
  }

  function popUp() {
    const free = holes.filter((h) => !h.mole && !h.gone && h.open >= 1 && h !== popUp.last);
    if (!free.length) return;
    const h = R.pick(free);
    popUp.last = h;
    const p = Math.min(1, spawned / 9);
    h.mole = { state: 'up', t: 0, up: 0, stay: k.lerp(1.35, 0.85, p), sign: signFor(h), fur: R.pick(FUR), tie: R.pick(['#d6453d', '#3f6fd8', '#2f9e6a', '#7a4fd0']), specs: R.chance(0.35), tilt: R.rand(-0.12, 0.12), side: h.x > k.vw - 110 ? -1 : 1 };
    spawned++;
    k.sfx.tone({ freq: 260, to: 560, dur: 0.09, gain: 0.06 });
    k.burst(h.x, h.y, { shape: 'dot', n: 7, colors: ['#6b4a2f', '#8a6440', '#4a3220'], speed: 200, angle: -Math.PI / 2, spread: 2.2, gravity: 1100, size: 4, life: 0.55 });
  }

  // ── input: the mallet ──
  if (!k.reduced) k.cursor('none');
  k.toast(k.reduced ? 'Moles are relitigating your decisions.' : 'Moles are relitigating your decisions. Bonk five.', { icon: '🔨', ms: 2600 });

  k.on(window, 'pointerdown', (e) => {
    if (e.button !== 0 || verdictAt || k.reduced) return;
    const x = e.clientX, y = e.clientY;
    swing.t = 0;
    const hit = holes.find((h) => h.mole && h.mole.state === 'up' && h.mole.up > 0.35 && Math.abs(x - h.x) < 28 && y > h.y - 58 * h.mole.up - 8 && y < h.y + 12);
    if (hit) {
      k.consume(e);
      const m = hit.mole;
      Object.assign(m, { state: 'bonked', t: 0 });
      bonks++;
      shake = 1;
      k.sfx.thud({ pitch: 1.7 });
      k.sfx.tone({ freq: 1500, to: 2300, dur: 0.07, gain: 0.05, delay: 0.03 }); // squeak
      k.sfx.boing({ pitch: 1.9, gain: 0.35, delay: 0.05 });
      k.burst(hit.x, hit.y - 46, { shape: 'star', n: 9, colors: ['#ffd23f', '#fff1a8', '#ffb627'], speed: 300, gravity: 500, size: 7, life: 0.8 });
      say(R.pick(CHEERS), hit.x + 10, hit.y - 74, { fill: '#ffd23f', size: 30 });
      k.score('moles', 1, { icon: '🔨', label: 'Moles bonked', says: 'bonked {n} mole{s}' });
      if (bonks >= GOAL) k.after(500, verdict);
      return;
    }
    const near = holes.find((h) => !h.gone && Math.abs(x - h.x) < 42 && Math.abs(y - h.y + 16) < 38);
    if (near) { // a miss on a hole is still yours, so it doesn't open that question
      k.consume(e);
      k.sfx.thud({ pitch: 0.9, gain: 0.6 });
      k.burst(x, y, { shape: 'dot', n: 8, colors: ['#6b4a2f', '#8a6440'], speed: 160, angle: -Math.PI / 2, spread: 2.4, gravity: 900, size: 4, life: 0.5 });
      say('MISS', x, y - 34, { fill: '#ffffff', size: 18, life: 0.6, rise: 24 });
    }
  }, { capture: true });

  function say(text, x, y, o = {}) {
    fx.push({ text, x: k.clamp(x, 60, k.vw - 60), y, age: 0, life: o.life ?? 0.85, size: o.size ?? 28, fill: o.fill ?? '#ffd23f', rot: o.rot ?? R.rand(-0.18, 0.18), rise: o.rise ?? 46, style: o.style || 'comic' });
  }

  function verdict() {
    if (verdictAt) return;
    verdictAt = t;
    centre();
    k.cursor(null);
    for (const h of holes) if (h.mole && h.mole.state === 'up') Object.assign(h.mole, { state: 'down', t: 0, quiet: true });
    if (bonks >= GOAL) { k.sfx.tada(); k.burst(k.vw / 2, k.vh * 0.42, { n: 60, speed: 650, shape: 'mix', life: 1.7 }); } else k.sfx.blip({ pitch: 0.5 + bonks * 0.15 });
    k.after(2600, k.end);
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

  function holeBack(h, s) {
    c.save();
    c.translate(h.x, h.y);
    c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,.18)';
    c.beginPath(); c.ellipse(0, 4, 36, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#80593a'; // the dirt mound
    c.beginPath(); c.ellipse(0, 1, 34, 11, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9b7049';
    c.beginPath(); c.ellipse(0, -1, 31, 8.5, 0, 0, Math.PI * 2); c.fill();
    const g = c.createRadialGradient(0, 2, 2, 0, 0, 26);
    g.addColorStop(0, '#120a05');
    g.addColorStop(1, '#3a2617');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(0, 0, 24, 6.5, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function holeFront(h, s) { // the near lip, drawn over the mole so it's in the hole, not on it
    c.save();
    c.translate(h.x, h.y);
    c.scale(s, s);
    c.strokeStyle = '#9b7049';
    c.lineWidth = 5;
    c.beginPath(); c.ellipse(0, 0.5, 26, 7.5, 0, 0.08, Math.PI - 0.08); c.stroke();
    c.fillStyle = '#6b4a2f';
    for (const [dx, dy, r] of [[-27, 3, 2.2], [24, 4, 1.8], [-10, 8, 1.6], [14, 8, 2]]) { c.beginPath(); c.arc(dx, dy, r, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }

  function sign(m) {
    c.save();
    c.translate(24 * m.side, -6);
    c.rotate(0.1 * m.side + m.tilt + Math.sin(m.t * 9) * 0.03 * (m.state === 'up' ? 1 : 0));
    c.fillStyle = '#8a5f33';
    c.fillRect(-1.5, -64, 3, 64);
    c.font = k.font(12.5, 700, 'hand');
    const tw = Math.min(118, c.measureText(m.sign).width);
    const w = tw + 16, hgt = 22;
    c.translate(0, -70);
    c.fillStyle = 'rgba(0,0,0,.22)';
    c.beginPath(); c.roundRect(-w / 2 + 2, -hgt / 2 + 3, w, hgt, 3); c.fill();
    c.fillStyle = '#f2d9a6';
    c.strokeStyle = '#a77a45';
    c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(-w / 2, -hgt / 2, w, hgt, 3); c.fill(); c.stroke();
    c.fillStyle = '#3b2a17';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(k.ellipsize(c, m.sign, 118), 0, 1);
    c.restore();
  }

  function mole(h, m) {
    const bonked = m.state === 'bonked';
    const sq = bonked ? 1 - 0.22 * Math.max(0, 1 - m.t * 5) : 1; // squash on impact
    const lift = 58 * m.up;
    c.save();
    c.beginPath(); // only what's above the hole shows
    c.rect(h.x - 160, h.y - 260, 320, 260);
    c.ellipse(h.x, h.y, 23, 6, 0, 0, Math.PI * 2);
    c.clip();
    c.translate(h.x, h.y + 58 - lift);
    c.scale(2 - sq, sq);
    if (!bonked) sign(m);
    // body
    const g = c.createRadialGradient(-7, -40, 4, 0, -24, 34);
    g.addColorStop(0, '#9c7a60');
    g.addColorStop(0.5, m.fur);
    g.addColorStop(1, '#3e2b1f');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-21, 30);
    c.lineTo(-21, -34);
    c.bezierCurveTo(-21, -60, 21, -60, 21, -34);
    c.lineTo(21, 30);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.12)'; // fur tufts
    c.lineWidth = 1.2;
    for (const [x0, y0] of [[-4, -52], [0, -53], [4, -52]]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 * 1.6, y0 - 4); c.stroke(); }
    // belly, tie
    c.fillStyle = 'rgba(240,200,160,.22)';
    c.beginPath(); c.ellipse(0, -2, 13, 16, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f4f1ea'; // shirt collar
    c.beginPath(); c.moveTo(-8, -17); c.lineTo(0, -10); c.lineTo(8, -17); c.lineTo(6, -6); c.lineTo(-6, -6); c.closePath(); c.fill();
    c.fillStyle = m.tie;
    c.beginPath(); c.moveTo(-3, -12); c.lineTo(3, -12); c.lineTo(2, -9); c.lineTo(4, 4); c.lineTo(0, 9); c.lineTo(-4, 4); c.lineTo(-2, -9); c.closePath(); c.fill();
    // muzzle, nose, teeth, whiskers
    c.fillStyle = '#e9b994';
    c.beginPath(); c.ellipse(0, -25, 11.5, 8.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.fillRect(-3.4, -19.5, 3, 5);
    c.fillRect(0.4, -19.5, 3, 5);
    c.strokeStyle = 'rgba(0,0,0,.25)';
    c.lineWidth = 0.8;
    c.strokeRect(-3.4, -19.5, 3, 5);
    c.strokeRect(0.4, -19.5, 3, 5);
    c.fillStyle = '#ff7fa3';
    c.beginPath(); c.ellipse(0, -30, 5.5, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)';
    c.beginPath(); c.ellipse(-1.8, -31.3, 1.8, 1.1, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(40,25,15,.55)';
    c.lineWidth = 0.9;
    for (const s of [-1, 1]) for (const dy of [-2, 2]) { c.beginPath(); c.moveTo(s * 9, -25 + dy * 0.5); c.lineTo(s * 22, -27 + dy * 2.2); c.stroke(); }
    // eyes
    if (bonked) {
      c.strokeStyle = '#1a120c';
      c.lineWidth = 1.8;
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(s * 9 - 3, -41); c.lineTo(s * 9 + 3, -35);
        c.moveTo(s * 9 + 3, -41); c.lineTo(s * 9 - 3, -35);
        c.stroke();
      }
      c.fillStyle = '#f07c8c'; // the bump
      c.beginPath(); c.ellipse(5, -53, 7 * Math.min(1, m.t * 6), 5 * Math.min(1, m.t * 6), 0.2, 0, Math.PI * 2); c.fill();
    } else {
      const look = k.clamp((k.pointer.x - h.x) / 300, -1, 1) * 1.2;
      for (const s of [-1, 1]) {
        c.fillStyle = '#140d08';
        c.beginPath(); c.arc(s * 9 + look, -38, 2.8, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(s * 9 + look - 0.9, -39, 0.9, 0, Math.PI * 2); c.fill();
      }
      if (m.specs) {
        c.strokeStyle = '#151515';
        c.lineWidth = 1.6;
        for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 9, -38, 5.5, 0, Math.PI * 2); c.stroke(); }
        c.beginPath(); c.moveTo(-3.5, -38); c.lineTo(3.5, -38); c.stroke();
      }
      c.strokeStyle = 'rgba(30,18,10,.6)'; // a skeptical eyebrow
      c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(4.5, -46); c.lineTo(13, -48.5); c.stroke();
      c.beginPath(); c.moveTo(-13, -45); c.lineTo(-5, -45.5); c.stroke();
    }
    c.restore();
    if (bonked && m.t < 0.6) { // stars round its head
      for (let i = 0; i < 3; i++) {
        const a = m.t * 9 + (i * Math.PI * 2) / 3;
        star(h.x + Math.cos(a) * 18, h.y - lift - 2 + Math.sin(a) * 5, 4.2, '#ffd23f');
      }
    }
    if (m.up > 0.55 && !bonked) { // paws on the rim
      c.fillStyle = '#e3a988';
      for (const s of [-1, 1]) {
        c.beginPath(); c.ellipse(h.x + s * 15, h.y - 3, 6.5, 4, s * 0.3, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(80,40,20,.5)';
        c.lineWidth = 0.8;
        for (const d of [-2.5, 0, 2.5]) { c.beginPath(); c.moveTo(h.x + s * 15 + d, h.y - 6); c.lineTo(h.x + s * 15 + d, h.y - 3.5); c.stroke(); }
      }
    }
  }

  function star(x, y, r, fill) {
    c.fillStyle = fill;
    c.beginPath();
    for (let j = 0; j < 10; j++) {
      const rr = j % 2 ? r * 0.45 : r;
      c.lineTo(x + Math.cos((j * Math.PI) / 5 - Math.PI / 2) * rr, y + Math.sin((j * Math.PI) / 5 - Math.PI / 2) * rr);
    }
    c.fill();
  }

  function mallet(px, py) {
    const st = swing.t;
    const back = st < 0.06 ? 1 - st / 0.06 : st < 0.14 ? 0 : Math.min(1, (st - 0.14) / 0.22);
    const raise = 0.55 * k.ease.outCubic(back);
    c.save();
    c.translate(px + 40, py + 44); // the grip
    c.rotate(raise);
    c.translate(-40, -44);
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,.16)'; // shadow
    c.lineWidth = 7;
    c.beginPath(); c.moveTo(10, 12); c.lineTo(48, 54); c.stroke();
    c.strokeStyle = '#c99556';
    c.lineWidth = 7;
    c.beginPath(); c.moveTo(4, 4); c.lineTo(42, 46); c.stroke();
    c.strokeStyle = '#8f6131';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(6, 4); c.lineTo(44, 45); c.stroke();
    c.strokeStyle = '#2d2d2d'; // grip tape
    c.lineWidth = 8.5;
    c.beginPath(); c.moveTo(32, 35); c.lineTo(43, 47); c.stroke();
    c.rotate(Math.atan2(44, 40) + Math.PI / 2);
    const head = c.createLinearGradient(0, -13, 0, 13);
    head.addColorStop(0, '#ff6b5e');
    head.addColorStop(0.45, '#e53935');
    head.addColorStop(1, '#a3201b');
    c.fillStyle = head;
    c.beginPath(); c.roundRect(-22, -13, 44, 26, 7); c.fill();
    c.fillStyle = '#f2f2f2';
    for (const x of [-22, 17]) { c.beginPath(); c.roundRect(x, -13, 5, 26, 2); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.beginPath(); c.roundRect(-15, -10, 30, 5, 3); c.fill();
    c.restore();
  }

  k.loop((dt) => {
    t += dt;
    swing.t += dt;
    if (!holes.length) dig();
    c.clearRect(0, 0, cv.w, cv.h);
    c.save();
    if (shake > 0) { shake = Math.max(0, shake - dt * 6); c.translate(R.rand(-3, 3) * shake, R.rand(-3, 3) * shake); }

    if (!verdictAt && t >= nextAt && t < PLAY && bonks < GOAL) {
      if (holes.filter((h) => h.mole && h.mole.state === 'up').length < 3) popUp();
      const live = holes.filter((h) => h.mole && h.mole.state === 'up').length;
      nextAt = t + (live >= 2 ? 0.35 : k.lerp(0.75, 0.42, Math.min(1, spawned / 10)) * R.rand(0.8, 1.2));
    }
    if (!verdictAt && t > PLAY && holes.every((h) => !h.mole)) verdict();

    for (const h of holes) {
      const want = verdictAt && t - verdictAt > 1.6 ? 0 : t > h.openAt ? 1 : 0;
      if (h.open < 1 && want === 1 && h.open === 0) k.burst(h.x, h.y, { shape: 'dot', n: 10, colors: ['#6b4a2f', '#8a6440', '#4a3220'], speed: 240, angle: -Math.PI / 2, spread: 2.4, gravity: 1000, size: 4.5, life: 0.6 });
      h.open = k.clamp(h.open + (want ? dt / 0.28 : -dt / 0.25));
      if (h.gone || h.open <= 0) continue;
      const s = want ? k.ease.outBack(h.open) : h.open;
      holeBack(h, s);
      const m = h.mole;
      if (m) {
        m.t += dt;
        if (m.state === 'up') {
          m.up = k.ease.outBack(Math.min(1, m.t / 0.17));
          if (m.t > m.stay) Object.assign(m, { state: 'down', t: 0 });
        } else if (m.state === 'down') {
          m.up = Math.max(0, 1 - m.t / 0.14);
          if (m.t < dt * 1.5 && !m.quiet) {
            say(R.pick(DUCK), h.x + (h.x > k.vw - 140 ? -110 : 36), h.y - 40, { fill: '#ffffff', size: 13, life: 0.9, rise: 18, rot: 0, style: 'hand' });
            k.sfx.tone({ freq: 520, to: 240, dur: 0.1, gain: 0.04 });
          }
        } else {
          m.up = m.t < 0.45 ? 1 : Math.max(0, 1 - (m.t - 0.45) / 0.18);
        }
        if (m.up <= 0 && m.state !== 'up') h.mole = null;
        else mole(h, m);
      }
      holeFront(h, s);
    }

    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.age += dt;
      const p = f.age / f.life;
      if (p >= 1) { fx.splice(i, 1); continue; }
      const a = Math.min(1, (1 - p) * 2.5);
      if (f.style === 'hand') {
        c.save();
        c.globalAlpha = a;
        c.font = k.font(f.size, 700, 'hand');
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        const w = c.measureText(f.text).width + 14;
        const y = f.y - k.ease.outCubic(p) * f.rise;
        c.fillStyle = 'rgba(20,20,20,.78)';
        c.beginPath(); c.roundRect(f.x - 7, y - 11, w, 22, 11); c.fill();
        c.fillStyle = '#fff';
        c.fillText(f.text, f.x, y + 1);
        c.restore();
      } else comic(f.text, f.x, f.y - k.ease.outCubic(p) * f.rise, f.size, f.fill, f.rot, a, 0.5 + k.ease.outBack(Math.min(1, f.age / 0.16)) * 0.5);
    }
    c.restore();

    if (verdictAt) {
      const vt = t - verdictAt;
      const a = Math.min(1, vt * 4) * Math.min(1, (2.6 - vt) * 3);
      const [big, small] = VERDICT[Math.min(GOAL, bonks)];
      const x = verdictX, y = k.vh * 0.42;
      c.font = k.font(26, 900, 'display');
      const w = Math.max(320, c.measureText(small).width + 70);
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
      comic(big, x, y, 96, bonks >= GOAL ? '#ffd23f' : '#ffffff', -0.04, a, 0.6 + k.ease.outBack(Math.min(1, vt / 0.3)) * 0.4);
      comic(small, x, y + 74, 26, '#ffffff', -0.04, a * k.clamp((vt - 0.25) * 4));
    } else if (k.pointer.active && !k.reduced) mallet(k.pointer.x, k.pointer.y);
  }, { still: 2.2 });

  if (k.reduced) k.after(3500, k.end);

  k.on(window, 'scroll', place, { capture: true, passive: true });

  return {
    layout() { place(); if (verdictAt) centre(); },
    question() { place(); },
    decisions() { place(); },
  };
}
