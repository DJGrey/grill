// Cat. Peeks over the top edge of the card, hops up, walks to the corner, turns round, kneads and
// lies down with its tail hanging over the side. It stays until you pet it (stroke it with the
// pointer), then stretches and leaves. Watches your cursor, flicks an ear when you type, dozes off.

const INK0 = '#2b2d33';
const COATS = [
  { base: '#f4a259', dark: '#d9762f', light: '#fff1df', iris: '#a8c94a', stripes: true },
  { base: '#a5aeb8', dark: '#6f7984', light: '#f3f5f7', iris: '#e4c449', stripes: true },
  { base: '#34373d', dark: '#34373d', light: '#ffffff', iris: '#9bd36a', stripes: false, whisk: 'rgba(255,255,255,.85)', ink: '#6b707a' },
  { base: '#ecd3a8', dark: '#cfa66a', light: '#fff8ec', iris: '#6fb3d9', stripes: true },
];
const NAMES = ['Biscuit', 'Mochi', 'Pickle', 'Beans', 'Noodle', 'Toast', 'Sir Pounce', 'Admiral Whiskers', 'Meatball', 'Professor Fluff'];
const W = 380, H = 290, OX = 190, OY = 215; // canvas size, and where the card's edge point sits on it

export default function cat(k) {
  const coat = k.pick(COATS);
  const INK = coat.ink || INK0; // the black cat gets a lighter outline, so it reads on dark backgrounds
  const name = k.pick(NAMES);
  const cv = k.canvas({ w: W, h: H, style: 'position:absolute;left:0;top:0;will-change:transform' });
  const c = cv.ctx;
  const P = { x: 0, y: 0, side: 1, s: 1, ok: false }; // the anchor: just inside the card's top corner
  const cat = { dx: 0, dy: 0, face: 1, spin: 1, pose: 'walk', step: 0, clip: true, look: [0, 0], lookT: [0, 0], blink: 0, ear: [0, 0], wide: 0, yawn: 0, happy: 0, breathe: 0, tail: 0, knead: 0, stretch: 0, sleep: 0, oneEye: 0, bump: 0 };
  let state = k.reduced ? 'lie' : 'wait';
  let st = 0; // time in state
  let t = 0;
  let pet = 0, petAt = -9, petting = false, hover = false, purr = null;
  let idleAt = 0, nextIdle = k.rand(5, 9);
  let quietAt = 0; // since when nobody has bothered it (pets, boops, a submit, waking it): 28s of that and it dozes off
  let lastPt = null;
  const bits = []; // hearts, z's and words floating up, in canvas coordinates
  const go = (s) => { state = s; st = 0; };

  // The card's corner, measured on a new card, layout and scroll (not every frame). anchor() eases towards it.
  let R = null;
  function measure() {
    const r = k.rect(k.ui.card());
    const g = r && k.rect(document.querySelector('#stack .ghost.g2'));
    R = r && { left: r.left, right: r.right, top: r.top, peek: g && g.top < r.top && g.top > r.top - 40 ? r.top - g.top : 0 }; // peek out from behind the whole stack
  }
  function anchor(first) {
    const r = R;
    if (!r) { P.ok = false; return; }
    if (first) { // the right corner, unless something sits there (the Notes button on narrow windows)
      const nb = k.rect(document.getElementById('notes-toggle'));
      P.side = nb && nb.left < r.right + 10 && nb.bottom > r.top - 90 ? -1 : 1;
    }
    const s = k.clamp((r.top - 4) / 74, 0.62, 1);
    const x = P.side > 0 ? r.right - 58 * s : r.left + 58 * s;
    P.peek = r.peek;
    if (!P.ok || first || Math.hypot(x - P.x, r.top - P.y) > 300) Object.assign(P, { x, y: r.top, s });
    else { P.x += (x - P.x) * 0.35; P.y += (r.top - P.y) * 0.35; P.s = s; } // follow the card as it moves
    P.ok = true;
  }
  measure();
  anchor(true);
  k.on(window, 'scroll', measure, { capture: true, passive: true });
  const S = () => P.s;
  const peekX = () => -P.side * 112 * S();

  if (state === 'lie') { cat.pose = 'lie'; cat.face = -P.side; cat.clip = false; }
  else { cat.dx = peekX(); cat.dy = 60; cat.face = P.side; }

  // ── input: stroke it to pet it, click to boop ──
  const local = (x, y) => {
    const sx = cat.face < 0 ? 1 : -1;
    return [(x - (P.x + cat.dx)) / (S() * sx), (y - (P.y + cat.dy)) / S()];
  };
  const over = (x, y) => {
    if (!P.ok || !['lie', 'knead'].includes(state)) return false;
    const [lx, ly] = local(x, y);
    return lx > -62 && lx < 54 && ly > -66 && ly < 8;
  };
  k.on(window, 'pointerdown', (e) => {
    if (e.button !== 0 || !over(e.clientX, e.clientY)) return;
    k.consume(e);
    if (k.reduced) return leave();
    pet += 160 * S();
    cat.wide = 0.8;
    cat.sleep = 0;
    quietAt = t;
    say('boop', 0, -78, { size: 15 });
    k.sfx.tone({ type: 'triangle', freq: 620, to: 900, dur: 0.12, gain: 0.08 });
    for (let i = 0; i < 2; i++) heart();
  }, { capture: true });

  function say(text, lx, ly, o = {}) {
    const sx = cat.face < 0 ? 1 : -1;
    bits.push({ kind: 'word', text, x: OX + cat.dx + lx * S() * sx, y: OY + cat.dy + ly * S(), age: 0, life: o.life ?? 1.1, size: (o.size ?? 16) * S(), rise: o.rise ?? 22, rot: k.rand(-0.15, 0.15) });
  }
  function heart() {
    const sx = cat.face < 0 ? 1 : -1;
    bits.push({ kind: 'heart', x: OX + cat.dx + k.rand(-40, 10) * S() * sx, y: OY + cat.dy - k.rand(48, 66) * S(), vx: k.rand(-14, 14), age: 0, life: k.rand(1.1, 1.5), size: k.rand(7, 11) * S(), sway: k.rand(6.28) });
  }
  function zed() {
    const sx = cat.face < 0 ? 1 : -1;
    bits.push({ kind: 'z', x: OX + cat.dx - 30 * S() * sx, y: OY + cat.dy - 62 * S(), vx: -sx * 10, age: 0, life: 2.4, size: k.rand(11, 16) * S(), sway: k.rand(6.28) });
  }

  function purring(on) {
    if (on && !purr) purr = k.sfx.tone({ type: 'sawtooth', freq: 26, dur: Infinity, gain: 0.16, filter: 'lowpass', freqF: 340, q: 0.7, attack: 0.25, vibrato: { rate: 0.55, depth: 3 } });
    if (!on && purr) { purr.stop?.(0.35); purr = null; }
  }

  function leave() {
    if (['stretch', 'away', 'dive', 'gone'].includes(state)) return;
    purring(false);
    k.score('cats', 1, { icon: '🐈', label: 'Cats petted', says: 'petted {n} cat{s}' });
    if (k.reduced) { k.toast(`${name} accepted the pets and left.`, { icon: '🐈' }); k.end(); return; }
    for (let i = 0; i < 5; i++) heart();
    go('stretch');
  }

  // ── behaviour ──
  function update(dt) {
    t += dt;
    st += dt;
    anchor(false);
    const s = S();
    cat.blink = Math.max(0, cat.blink - dt * 5);
    cat.wide = Math.max(0, cat.wide - dt * 1.4);
    cat.bump *= Math.exp(-dt * 7);
    cat.ear = cat.ear.map((e) => e * Math.exp(-dt * 9));
    cat.tail += dt;
    if (cat.flick) cat.flick = Math.max(0, cat.flick - dt * 1.6);
    cat.breathe += dt * (cat.sleep > 0.5 ? 1.3 : 2.1);
    // eyes follow the pointer, or the answer box after a keystroke
    if (k.pointer.active) {
      const sx = cat.face < 0 ? 1 : -1;
      const hx = P.x + cat.dx - 34 * s * sx, hy = P.y + cat.dy - 36 * s;
      const a = Math.atan2(k.pointer.y - hy, k.pointer.x - hx), d = Math.min(1, Math.hypot(k.pointer.x - hx, k.pointer.y - hy) / 120);
      if (cat.lookHold > 0) cat.lookHold -= dt; else cat.lookT = [Math.cos(a) * 1.8 * d, Math.sin(a) * 1.5 * d];
    }
    cat.look = cat.look.map((v, i) => v + (cat.lookT[i] - v) * Math.min(1, dt * 10));

    if (state === 'wait') { if (st > 0.2) go('peek'); }
    else if (state === 'peek') { // ears, then eyes, over the edge. A suspicious look. Then up.
      cat.pose = 'head';
      const rise = k.ease.outBack(Math.min(1, st / 0.55));
      const top = -4 * s - (P.peek || 0);
      cat.dy = k.lerp(40 * s, top, rise);
      if (st > 0.7 && st < 0.72 + dt) { cat.blink = 1; }
      if (st > 1.0 && !cat.mrrp) { cat.mrrp = true; say('mrrp?', 10, -70, { size: 15 }); k.sfx.tone({ type: 'triangle', freq: 520, to: 760, dur: 0.16, gain: 0.07, vibrato: { rate: 30, depth: 30 } }); cat.ear[1] = 1; }
      if (st > 1.55) cat.dy = k.lerp(top, top + 10 * s, Math.min(1, (st - 1.55) / 0.15)); // crouch
      if (st > 1.75) { cat.pose = 'walk'; cat.dy = 50 * s; go('hop'); k.sfx.whoosh({ pitch: 1.8, gain: 0.25 }); }
    } else if (state === 'hop') {
      const p = Math.min(1, st / 0.42);
      cat.dy = (k.lerp(50, 0, p) - Math.sin(p * Math.PI) * 34) * s;
      cat.hop = 1 - Math.sin(p * Math.PI) * 0.6;
      if (p >= 1) { cat.dy = 0; cat.clip = false; cat.hop = 0; cat.squash = 1; k.sfx.thud({ pitch: 2.4, gain: 0.25 }); go('walk'); }
    } else if (state === 'walk') {
      cat.squash = Math.max(0, (cat.squash || 0) - dt * 5);
      const target = 0;
      const v = 78 * s * Math.min(1, st * 3);
      const d = target - cat.dx;
      cat.dx += Math.sign(d) * Math.min(Math.abs(d), v * dt);
      cat.step += v * dt / (30 * s) * Math.PI;
      if (Math.abs(target - cat.dx) < 0.5) go('circle');
    } else if (state === 'circle') { // the obligatory turn on the spot before lying down
      const p = Math.min(1, st / 0.75);
      cat.spin = Math.cos(p * Math.PI * 3);
      cat.step += dt * 9;
      if (p >= 1) { cat.spin = 1; cat.face = -P.side; cat.pose = 'lie'; cat.squash = 0.8; go('knead'); }
    } else if (state === 'knead') {
      cat.squash = Math.max(0, (cat.squash || 0) - dt * 4);
      cat.knead = Math.min(1, st * 4) * (st < 1.5 ? 1 : Math.max(0, 1 - (st - 1.5) * 4));
      cat.happy = Math.min(1, st * 3);
      if (st > 1.75) { cat.happy = 0; idleAt = quietAt = t; go('lie'); }
    } else if (state === 'lie') {
      cat.pose = 'lie';
      if (!petting && t - idleAt > nextIdle && cat.sleep < 0.5) { // little idle things
        idleAt = t;
        nextIdle = k.rand(5, 11);
        const what = k.pick(['blink', 'blink', 'yawn', 'ear', 'tail', 'look']);
        if (what === 'blink') cat.slow = 1; // a slow blink: cat for "I trust you"
        else if (what === 'yawn') cat.yawnT = 0;
        else if (what === 'ear') cat.ear[k.int(0, 1)] = 1;
        else if (what === 'tail') cat.flick = 1;
        else { cat.lookT = [k.rand(-1.8, 1.8), k.rand(-1, 1)]; cat.lookHold = 1.2; }
      }
      if (cat.slow !== undefined) { cat.slow += dt; if (cat.slow > 2.2) cat.slow = undefined; }
      if (cat.yawnT !== undefined) { cat.yawnT += dt; cat.yawn = Math.sin(Math.min(1, cat.yawnT / 1.5) * Math.PI); if (cat.yawnT > 1.5) { cat.yawnT = undefined; cat.yawn = 0; } }
      // dozing: after a while with nobody around, eyes shut and z's float up. Come close and one eye opens.
      const near = k.pointer.active && Math.hypot(k.pointer.x - P.x, k.pointer.y - P.y) < 150 * s;
      if (!petting && t - Math.max(petAt, quietAt) > 28 && !near) cat.sleep = Math.min(1, cat.sleep + dt * 0.8);
      if (cat.sleep > 0.5) {
        if (k.chance(dt * 0.7)) zed();
        if (near) { cat.oneEye = Math.min(1, cat.oneEye + dt * 4); cat.sleepNear = (cat.sleepNear || 0) + dt; if (cat.sleepNear > 1.4) { cat.sleep = 0; cat.oneEye = 0; cat.sleepNear = 0; idleAt = quietAt = t; } }
        else { cat.oneEye = Math.max(0, cat.oneEye - dt * 3); cat.sleepNear = 0; }
      } else if (cat.sleep > 0 && !near) cat.sleep = Math.min(1, cat.sleep + dt * 0.8);
      else cat.sleep = 0;
    } else if (state === 'stretch') { // up, big stretch, then off
      cat.pose = 'walk';
      cat.happy = 0;
      cat.stretch = Math.sin(Math.min(1, st / 1.1) * Math.PI);
      cat.yawn = st < 1.1 ? Math.sin(Math.min(1, st / 1.1) * Math.PI) * 0.8 : 0;
      if (st > 1.15) { cat.stretch = 0; cat.face = -P.side; go('away'); }
    } else if (state === 'away') {
      const v = 95 * s * Math.min(1, st * 3);
      cat.dx -= P.side * v * dt;
      cat.step += v * dt / (30 * s) * Math.PI;
      if (Math.abs(cat.dx - peekX() * 0.75) < 2 || -P.side * (cat.dx - peekX() * 0.75) > 0) { cat.clip = true; go('dive'); k.sfx.whoosh({ pitch: 1.5, gain: 0.2 }); }
    } else if (state === 'dive') { // hops down behind the card
      const p = Math.min(1, st / 0.45);
      cat.dy = (-Math.sin(p * Math.PI) * 24 + p * p * 90) * s;
      cat.dx -= P.side * 60 * s * dt;
      cat.hop = 1 - Math.sin(p * Math.PI) * 0.6;
      if (p >= 1) {
        go('gone');
        k.toast(k.pick([`${name} accepted the pets and left.`, `${name} has left. They'll be back. They always come back.`, `${name} got what they came for.`, `${name} has places to be.`]), { icon: '🐈', ms: 2600 });
        k.after(400, k.end);
      }
    }

    // petting: stroke it
    if (lastPt && k.pointer.active) {
      const moved = Math.min(50, Math.hypot(k.pointer.x - lastPt[0], k.pointer.y - lastPt[1]));
      if (moved > 0.5 && over(k.pointer.x, k.pointer.y) && over(...lastPt)) {
        pet += moved;
        petAt = t;
        cat.sleep = 0;
        cat.oneEye = 0;
      }
    }
    lastPt = [k.pointer.x, k.pointer.y];
    const was = petting;
    petting = t - petAt < 0.35 && ['lie', 'knead'].includes(state);
    if (petting !== was) purring(petting);
    if (petting) {
      cat.happy = Math.min(1, cat.happy + dt * 6);
      if (k.chance(dt * 3.2)) heart();
      if (k.chance(dt * 0.6)) say(k.pick(['prrrr', 'prrr…', 'purr']), -20, -80, { size: 14, life: 1.2 });
      if (pet > 1000 * s) leave();
    } else if (state === 'lie') cat.happy = Math.max(0, cat.happy - dt * 3);
    const h = over(k.pointer.x, k.pointer.y) && k.pointer.active;
    if (h !== hover) { hover = h; grab(h); }
  }

  // A grab hand over the cat, unless another game's cursor is up (the pigeon's crosshair). Only ever clears its own.
  let grabbing = false;
  function grab(on) {
    if (on && !grabbing && !document.documentElement.classList.contains('fun-cursor')) { k.cursor('grab'); grabbing = true; }
    else if (!on && grabbing) { grabbing = false; k.cursor(null); }
  }

  // ── drawing (the cat's own frame: facing left, standing on y = 0, scale 1) ──
  const fillStroke = (fill, lw = 2.2) => { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); };

  function head(x, y, sc = 1, tilt = 0) {
    c.save();
    c.translate(x, y);
    c.rotate(tilt);
    c.scale(sc, sc);
    for (const i of [0, 1]) { // ears
      const m = i ? 1 : -1;
      c.save();
      c.translate(m * 11, -11);
      c.rotate(m * (cat.ear[i] * 0.45 + (cat.happy > 0.5 ? 0.18 : 0)) + m * cat.wide * -0.1);
      c.beginPath(); c.moveTo(m * -7, 5); c.lineTo(m * 6, -19); c.lineTo(m * 9, 0); c.closePath();
      c.lineJoin = 'round';
      fillStroke(coat.base);
      c.beginPath(); c.moveTo(m * -3, 2); c.lineTo(m * 5, -13); c.lineTo(m * 6, 0); c.closePath();
      c.fillStyle = '#f7a8b8'; c.fill();
      c.restore();
    }
    c.beginPath(); // face: wide, with cheek fluff
    c.moveTo(-21, -2);
    c.bezierCurveTo(-22, -21, 22, -21, 21, -2);
    c.bezierCurveTo(25, 4, 23, 9, 19, 11);
    c.lineTo(21, 13);
    c.bezierCurveTo(14, 19, 5, 20, 0, 20);
    c.bezierCurveTo(-5, 20, -14, 19, -21, 13);
    c.lineTo(-19, 11);
    c.bezierCurveTo(-23, 9, -25, 4, -21, -2);
    c.closePath();
    c.lineJoin = 'round';
    fillStroke(coat.base);
    if (coat.stripes) { // the tabby M
      c.strokeStyle = coat.dark; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-5, -15); c.lineTo(-4, -9); c.moveTo(0, -16); c.lineTo(0, -10); c.moveTo(5, -15); c.lineTo(4, -9);
      c.moveTo(-21, 2); c.lineTo(-16, 3); c.moveTo(21, 2); c.lineTo(16, 3); c.stroke();
    }
    c.fillStyle = coat.light; // muzzle
    c.beginPath(); c.ellipse(-4.5, 8, 6.5, 5, 0, 0, Math.PI * 2); c.ellipse(4.5, 8, 6.5, 5, 0, 0, Math.PI * 2); c.fill();
    if (cat.happy > 0.3 || cat.blush) { c.fillStyle = 'rgba(255,120,150,.4)'; c.beginPath(); c.ellipse(-13, 6, 4, 2.4, 0, 0, Math.PI * 2); c.ellipse(13, 6, 4, 2.4, 0, 0, Math.PI * 2); c.fill(); }

    // eyes: open and tracking, slow blink, happy ^ ^, asleep (one may peek)
    const slow = cat.slow !== undefined ? Math.sin(Math.min(1, cat.slow / 2.2) * Math.PI) : 0;
    const shut = Math.max(cat.blink, slow * 0.92, cat.yawn > 0.3 ? 1 : 0);
    for (const i of [0, 1]) {
      const ex = i ? 8 : -8, ey = -2;
      const asleep = cat.sleep > 0.5 && !(i === 0 && cat.oneEye > 0.5);
      c.lineCap = 'round';
      if (cat.happy > 0.5 && !asleep) {
        c.strokeStyle = INK; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(ex - 4.5, ey + 1.5); c.quadraticCurveTo(ex, ey - 5, ex + 4.5, ey + 1.5); c.stroke();
      } else if (asleep || shut > 0.85) {
        c.strokeStyle = INK; c.lineWidth = 2;
        c.beginPath(); c.moveTo(ex - 4.5, ey); c.quadraticCurveTo(ex, ey + 3.5, ex + 4.5, ey); c.stroke();
      } else {
        const ry = 5.4 * (1 - shut) * (1 + cat.wide * 0.15);
        c.beginPath(); c.ellipse(ex, ey, 4.6 + cat.wide * 0.6, ry, 0, 0, Math.PI * 2);
        fillStroke(coat.iris, 1.6);
        c.save(); c.clip();
        c.fillStyle = '#111';
        c.beginPath(); c.ellipse(ex + cat.look[0], ey + cat.look[1], 1.7 + cat.wide * 2 + (cat.sleep > 0 ? 0.6 : 0), 4.4, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(ex + cat.look[0] - 1.3, ey + cat.look[1] - 2, 1.2, 0, Math.PI * 2); c.fill();
        c.restore();
        if (slow > 0.1 || cat.sleep > 0.5) { // heavy lids
          c.fillStyle = coat.base;
          c.beginPath(); c.rect(ex - 6, ey - 7, 12, 7 * Math.max(slow, 0.6)); c.fill();
          c.strokeStyle = INK; c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(ex - 4.8, ey - 7 + 7 * Math.max(slow, 0.6)); c.lineTo(ex + 4.8, ey - 7 + 7 * Math.max(slow, 0.6)); c.stroke();
        }
      }
    }
    // nose, mouth (or yawn), whiskers
    if (cat.yawn > 0.15) {
      const y = cat.yawn;
      c.beginPath(); c.ellipse(0, 11 + y * 2, 4 + y * 3, 2 + y * 6, 0, 0, Math.PI * 2);
      fillStroke('#6b1f2a', 1.6);
      c.fillStyle = '#ff8fa3';
      c.beginPath(); c.ellipse(0, 13 + y * 6, 3 + y * 2, 1.5 + y * 2, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      for (const m of [-1, 1]) { c.beginPath(); c.moveTo(m * (2 + y * 2), 8 + y * 0.5); c.lineTo(m * (3.5 + y * 2), 8 + y * 0.5); c.lineTo(m * (2.7 + y * 2), 11 + y); c.fill(); }
    }
    c.beginPath(); c.moveTo(-2.8, 3.6); c.lineTo(2.8, 3.6); c.lineTo(0, 6.6); c.closePath();
    c.fillStyle = '#f08aa0'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke();
    if (cat.yawn <= 0.15) {
      c.lineWidth = 1.4; c.strokeStyle = INK; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 6.6); c.quadraticCurveTo(-0.6, 9.6, -4, 9);
      c.moveTo(0, 6.6); c.quadraticCurveTo(0.6, 9.6, 4, 9); c.stroke();
    }
    c.strokeStyle = coat.whisk || 'rgba(43,45,51,.55)';
    c.lineWidth = 1;
    const wt = petting ? Math.sin(t * 18) * 1.2 : 0;
    for (const m of [-1, 1]) for (const [dy, ty] of [[6, 2], [8, 8], [10, 13]]) {
      c.beginPath(); c.moveTo(m * 10, dy); c.quadraticCurveTo(m * 22, ty - 1 + wt, m * 31, ty + 1 + wt); c.stroke();
    }
    if (cat.wide > 0.4) { // !
      c.font = k.font(16, 900, 'display'); c.textAlign = 'center'; c.fillStyle = '#ff4d4d'; c.strokeStyle = '#fff'; c.lineWidth = 3;
      c.strokeText('!', 18, -30); c.fillText('!', 18, -30);
    }
    c.restore();
  }

  function tailHanging() { // from the rump, over the card's corner and down its side
    const sway = Math.sin(cat.tail * 1.3) * 4 + (cat.flick ? Math.sin(cat.flick * 18) * 7 * cat.flick : 0);
    const tip = [62 + sway, 50];
    const path = () => { c.beginPath(); c.moveTo(34, -12); c.bezierCurveTo(56, -16, 62, 0, 60, 18); c.quadraticCurveTo(58 + sway * 0.4, 36, tip[0], tip[1]); };
    c.lineCap = 'round';
    path(); c.lineWidth = 13; c.strokeStyle = INK; c.stroke();
    path(); c.lineWidth = 8.6; c.strokeStyle = coat.base; c.stroke();
    if (coat.stripes) {
      c.save(); path(); c.lineWidth = 8.6; c.setLineDash([3.5, 7]); c.strokeStyle = coat.dark; c.stroke(); c.restore();
    }
  }

  function tailUp() { // walking: a question mark
    const sway = Math.sin(cat.tail * 3) * 4;
    const path = () => { c.beginPath(); c.moveTo(34, -44); c.bezierCurveTo(52, -48, 50 + sway, -78, 46 + sway, -88); c.quadraticCurveTo(43 + sway, -95, 37 + sway * 1.3, -92); };
    c.lineCap = 'round';
    path(); c.lineWidth = 12.5; c.strokeStyle = INK; c.stroke();
    path(); c.lineWidth = 8.2; c.strokeStyle = coat.base; c.stroke();
    if (coat.stripes) { c.save(); path(); c.lineWidth = 8.2; c.setLineDash([3.5, 7]); c.strokeStyle = coat.dark; c.stroke(); c.restore(); }
  }

  function legs(far) {
    const amp = state === 'walk' || state === 'away' || state === 'circle' ? 1 : 0;
    const tuck = cat.hop || 0;
    for (const [hx, ph, front] of far ? [[-14, Math.PI, true], [24, 0, false]] : [[-24, 0, true], [32, Math.PI, false]]) {
      const sw = Math.sin(cat.step + ph) * 8 * amp;
      const lift = Math.max(0, Math.cos(cat.step + ph)) * 4 * amp;
      const low = front ? cat.stretch * 13 : -cat.stretch * 4;
      const top = front ? -30 + low : -30;
      const footY = -2 - lift - (1 - tuck) * 0 - (cat.hop ? (1 - tuck) * 14 : 0);
      const fx = hx + sw + (front ? -cat.stretch * 24 : cat.stretch * 3);
      c.lineCap = 'round';
      c.strokeStyle = INK; c.lineWidth = 11.5;
      c.beginPath(); c.moveTo(hx, top); c.lineTo(fx, footY); c.stroke();
      c.strokeStyle = far ? coat.dark : coat.base; c.lineWidth = 7.5;
      c.beginPath(); c.moveTo(hx, top); c.lineTo(fx, footY); c.stroke();
      c.beginPath(); c.ellipse(fx - 1.5, footY + 0.5, 6, 3.6, 0, 0, Math.PI * 2);
      fillStroke(far ? coat.dark : coat.light, 1.8);
    }
  }

  function drawWalk() {
    const sq = cat.squash || 0;
    c.save();
    c.scale(1 + sq * 0.12, 1 - sq * 0.12);
    tailUp();
    legs(true);
    c.save(); // body, tilted into a stretch: front down, bum up
    c.translate(0, -36);
    c.rotate(-cat.stretch * 0.24);
    c.beginPath(); c.ellipse(0, 0, 40, 16.5, 0, 0, Math.PI * 2);
    fillStroke(coat.base);
    c.save(); c.clip();
    c.fillStyle = coat.light; c.beginPath(); c.ellipse(-6, 14, 30, 9, 0, 0, Math.PI * 2); c.fill();
    if (coat.stripes) {
      c.strokeStyle = coat.dark; c.lineWidth = 3.4; c.lineCap = 'round';
      for (const x of [-8, 4, 16, 27]) { c.beginPath(); c.moveTo(x, -17); c.quadraticCurveTo(x + 4, -10, x + 2, -4); c.stroke(); }
    }
    c.restore();
    c.restore();
    legs(false);
    head(-38 - cat.stretch * 8, -52 + cat.stretch * 18, 0.94, -cat.stretch * 0.12);
    c.restore();
  }

  function drawLie() {
    const sq = cat.squash || 0;
    const br = Math.sin(cat.breathe) * 0.028;
    tailHanging();
    c.save();
    c.scale(1 + sq * 0.1, 1 - sq * 0.14 + br);
    c.beginPath(); // the loaf
    c.moveTo(-36, 0);
    c.lineTo(34, 0);
    c.bezierCurveTo(50, 0, 54, -28, 36, -36);
    c.bezierCurveTo(18, -44, -16, -44, -34, -32);
    c.bezierCurveTo(-44, -24, -46, -4, -36, 0);
    c.closePath();
    c.lineJoin = 'round';
    fillStroke(coat.base);
    c.save(); c.clip();
    c.fillStyle = coat.light; c.beginPath(); c.ellipse(-36, -12, 12, 16, 0, 0, Math.PI * 2); c.fill(); // bib
    if (coat.stripes) {
      c.strokeStyle = coat.dark; c.lineWidth = 3.6; c.lineCap = 'round';
      for (const x of [-6, 6, 18, 30]) { c.beginPath(); c.moveTo(x, -44); c.quadraticCurveTo(x + 5, -36, x + 3, -27); c.stroke(); }
    }
    c.restore();
    c.strokeStyle = 'rgba(43,45,51,.5)'; c.lineWidth = 1.6; // haunch
    c.beginPath(); c.moveTo(16, -1); c.bezierCurveTo(14, -20, 36, -26, 43, -12); c.stroke();
    c.restore();
    for (const [x, i] of [[-42, 0], [-29, 1]]) { // front paws, kneading
      const up = cat.knead ? Math.max(0, Math.sin(t * 9 + i * Math.PI)) * 5 * cat.knead : 0;
      c.beginPath(); c.ellipse(x, -4 - up, 8, 5, 0, 0, Math.PI * 2);
      fillStroke(coat.light, 1.8);
      c.strokeStyle = 'rgba(43,45,51,.45)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x - 3, -6 - up); c.lineTo(x - 3, -2 - up); c.moveTo(x + 1, -6.5 - up); c.lineTo(x + 1, -2 - up); c.stroke();
    }
    const tilt = petting ? Math.sin(t * 3) * 0.12 - 0.08 : 0;
    head(-34, -36 - br * 30 - (cat.knead ? 3 : 0), 1, tilt);
  }

  function drawHead() { head(0, -14, 0.94); }

  function drawBits(dt) {
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.age += dt;
      const p = b.age / b.life;
      if (p >= 1) { bits.splice(i, 1); continue; }
      const a = Math.min(1, (1 - p) * 3) * Math.min(1, b.age * 8);
      c.save();
      c.globalAlpha = a;
      if (b.kind === 'heart') {
        c.translate(b.x + b.vx * b.age + Math.sin(b.age * 4 + b.sway) * 5, b.y - k.ease.outCubic(p) * 60 * S());
        const s = b.size * (0.6 + k.ease.outBack(Math.min(1, b.age / 0.25)) * 0.4) / 10;
        c.scale(s, s);
        c.beginPath();
        c.moveTo(0, 9); c.bezierCurveTo(-14, 0, -10, -11, 0, -5); c.bezierCurveTo(10, -11, 14, 0, 0, 9);
        c.fillStyle = '#ff5d8f'; c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#7a1f3d'; c.stroke();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-4.5, -3.5, 2.2, 1.4, -0.6, 0, Math.PI * 2); c.fill();
      } else {
        const x = b.x + (b.vx || 0) * b.age + (b.kind === 'z' ? Math.sin(b.age * 2 + b.sway) * 6 : 0);
        const y = b.y - k.ease.outCubic(p) * (b.kind === 'z' ? 46 * S() : b.rise);
        c.translate(x, y);
        c.rotate(b.rot || -0.2);
        c.font = b.kind === 'z' ? k.font(b.size * (0.7 + p * 0.5), 800, 'hand') : k.font(b.size, 800, 'hand');
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.95)';
        const txt = b.kind === 'z' ? 'z' : b.text;
        c.strokeText(txt, 0, 0);
        c.fillStyle = INK; c.fillText(txt, 0, 0);
      }
      c.restore();
    }
  }

  // Only touch the DOM when it changes, and while it's fast asleep (just breathing and z's) draw at a quarter of the rate.
  let shown = null, moved = '', owed = 0;
  k.loop((dt) => {
    update(dt);
    if (P.ok !== shown) { shown = P.ok; cv.el.style.visibility = P.ok ? '' : 'hidden'; }
    if (!P.ok) return;
    const tf = `translate3d(${(P.x - OX).toFixed(1)}px, ${(P.y - OY).toFixed(1)}px, 0)`;
    if (tf !== moved) { moved = tf; cv.el.style.transform = tf; }
    owed += dt;
    const dozing = state === 'lie' && cat.sleep >= 1 && cat.oneEye <= 0 && !petting && !hover && !bits.some((b) => b.kind !== 'z');
    if (dozing && dt > 0 && owed < 1 / 15) return;
    dt = owed;
    owed = 0;
    c.clearRect(0, 0, W, H);
    c.save();
    if (cat.clip) { c.beginPath(); c.rect(0, 0, W, OY - (state === 'peek' ? P.peek || 0 : 0)); c.clip(); }
    c.translate(OX + cat.dx, OY + cat.dy - cat.bump * 10 * S());
    const sx = (cat.face < 0 ? 1 : -1) * cat.spin;
    c.scale(S() * sx, S());
    if (cat.pose === 'head') drawHead();
    else if (cat.pose === 'lie') drawLie();
    else drawWalk();
    c.restore();
    drawBits(dt);
  }, { still: 0 });

  return {
    question() { measure(); anchor(false); },
    layout() { measure(); anchor(false); },
    keystroke() { // an ear swivels towards the noise, the eyes check the answer box
      if (state !== 'lie' || cat.sleep > 0.5) return;
      if (k.chance(0.35)) cat.ear[k.int(0, 1)] = 1;
      const a = k.rect(k.ui.answer());
      if (a) { cat.lookT = [Math.sign(a.left + a.width / 2 - P.x) * 1.4, 1.4]; cat.lookHold = 0.9; }
    },
    answer() { // startled by the submit
      if (!['lie', 'knead'].includes(state)) return;
      cat.wide = 1; cat.bump = 1; cat.sleep = 0; cat.oneEye = 0; cat.ear = [1, 1];
      quietAt = t;
      k.sfx.tone({ type: 'triangle', freq: 700, to: 1100, dur: 0.09, gain: 0.06 });
    },
    unmount() { purring(false); },
  };
}
