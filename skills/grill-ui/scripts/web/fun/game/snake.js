// Snake. A pocket LCD phone slides in with a snake and one egg. ← or → takes control, arrows steer,
// eat the egg, done. It only borrows the keyboard while the answer box is empty and you've stopped
// typing, and gives it straight back on any other key, any click, or focus moving to a text box.
// Ignore it and the snake gets bored and eats the egg itself. Dawdle and the egg hatches.

const FONT = { // 3x5 pixel font (M, N and W are 4 wide), rows top to bottom
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '10011111111110011001', N: '10011101101110011001', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '10011001111111111001', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', '!': '010010010000010', '?': '110001010000010', '.': '000000000000010', "'": '010010000000000',
  '-': '000000111000000', ':': '000010000010000', '/': '001001010100100', '←': '010110111110010', '→': '010011111011010',
  '↑': '010111111010010', '↓': '010010111111010', ' ': '000000000000000',
};
const COLS = 24, ROWS = 11; // playfield, in cells of 4x4 LCD pixels
const LW = COLS * 4 + 4, LH = ROWS * 4 + 12; // whole LCD: header, 1px frame and 1px gap round the field
const FX = 2, FY = 10; // where the field starts
const HEAD = ['1110', '1011', '1111', '1110']; // facing right, eye at (1,1)
const GULP = ['1101', '1010', '1100', '1110']; // mouth open: there's an egg right in front of it
const EGG = ['0110', '1111', '1101', '1111', '0110'];
const CHICK = ['001100', '001011', '111110', '011100'];
const LEGS = ['010100', '001000'];
const DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const ARROWS = Object.keys(DIRS);
const BORED = 5; // seconds of no input before it does it itself
const WOBBLE = 9, HATCH = 12; // seconds: the egg starts to wobble, then hatches
const LCD = { bg: '#c3d29a', ghost: 'rgba(60,80,30,.07)', ink: '#1d2914', shadow: 'rgba(29,41,20,.2)' };
const ATE = [
  'Egg eaten. The question is still there, sadly.',
  'Delicious. Now back to the hard part.',
  'The snake thanks you. The question does not.',
  'Nutritious. 10/10, would slither again.',
];

export default function snake(k, ctx) {
  const wrapd = (d, n) => ((d % n) + n + n / 2) % n - n / 2; // shortest signed distance on a wrapping axis
  let P = 3; // CSS px per LCD pixel
  let wrap, lip, cv, c, ghost;
  let body = [], dir = [1, 0], turns = [], egg = null, lumps = [];
  let mode = 'demo'; // demo → auto | play → out
  let t = 0, tick = 0, since = 0, holding = false, leaving = false, ended = false;
  let outcome = null; // { big, small, at }
  let chick = null, shell = null;
  let eggs = ctx.stats.eggs || 0;

  // ── layout: the phone goes in the biggest empty spot it fits, else over the Notes panel, else in front ──
  function place(fixed) {
    const need = (p) => ({ w: LW * p + 28, h: LH * p + 46 });
    const sp = k.space();
    const spots = [...sp.gaps.filter((g) => g.where === 'top' || g.where === 'bottom' || g.where === 'all'), ...sp.gaps];
    for (const p of fixed ? [fixed] : [4, 3]) {
      const g = spots.find((s) => s.w >= need(p).w + 24 && s.h >= need(p).h + 16);
      if (g) return { p, x: g.x + (g.w - need(p).w) / 2, y: g.y + (g.h - need(p).h) / 2 + (g.where === 'top' ? 4 : -4) };
    }
    for (const r of [sp.notes, sp.side]) {
      if (!r) continue;
      const p = (fixed ? [fixed] : [3, 2]).find((q) => r.width >= need(q).w + 24 && r.height >= need(q).h + 40);
      if (p) return { p, x: r.left + (r.width - need(p).w) / 2, y: r.top + (r.height - need(p).h) * 0.55 };
    }
    const p = fixed || (sp.vw >= 520 ? 3 : 2);
    const box = sp.card || sp.stage;
    return { p, x: box.left + (box.width - need(p).w) / 2, y: Math.min(sp.vh - need(p).h - 16, box.top + box.height * 0.5 - need(p).h / 2) };
  }

  function build() {
    const at = place();
    P = at.p;
    wrap = k.el('div', { style: `position:absolute;left:${Math.round(at.x)}px;top:${Math.round(at.y)}px;padding:20px 14px 0;border-radius:24px 24px 30px 30px;background:linear-gradient(160deg,#4a4f57 0%,#2c3036 38%,#1b1d21 100%);box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 -2px 0 rgba(0,0,0,.4) inset,0 0 0 1px rgba(0,0,0,.55),0 22px 50px -12px rgba(0,0,0,.6),0 6px 14px -6px rgba(0,0,0,.45);transform-origin:50% 100%` });
    k.el('div', { style: 'position:absolute;top:8px;left:50%;width:46px;height:5px;margin-left:-23px;border-radius:3px;background:repeating-linear-gradient(90deg,#0d0e10 0 4px,#3a3e45 4px 6px);box-shadow:0 1px 0 rgba(255,255,255,.08)' }, wrap);
    k.el('div', { style: 'position:absolute;top:6px;right:18px;width:5px;height:5px;border-radius:50%;background:#7dff8a;box-shadow:0 0 6px #5dff70' }, wrap);
    const screen = k.el('div', { style: `position:relative;width:${LW * P}px;height:${LH * P}px;border-radius:5px;overflow:hidden;box-shadow:0 0 0 3px #15171a,0 0 0 4px rgba(255,255,255,.07)` }, wrap);
    cv = k.canvas({ w: LW * P, h: LH * P, parent: screen, style: 'display:block' });
    c = cv.ctx;
    k.el('div', { style: 'position:absolute;inset:0;pointer-events:none;border-radius:5px;background:linear-gradient(125deg,rgba(255,255,255,.22) 0%,rgba(255,255,255,0) 38%),radial-gradient(ellipse at 50% 120%,rgba(0,0,0,.12),transparent 60%);box-shadow:inset 0 2px 6px rgba(0,0,0,.35)' }, screen);
    lip = k.el('div', { style: `min-height:26px;box-sizing:border-box;padding:7px 4px 8px;width:${LW * P}px;text-align:center;font:${k.font(11, 600)};line-height:1.3;letter-spacing:.01em;color:#c9ced6;text-shadow:0 1px 0 rgba(0,0,0,.6);text-wrap:balance` }, wrap);
    // the unlit pixel grid, drawn once
    ghost = document.createElement('canvas');
    ghost.width = Math.round(LW * P * cv.dpr);
    ghost.height = Math.round(LH * P * cv.dpr);
    const g = ghost.getContext('2d');
    g.scale(cv.dpr, cv.dpr);
    g.fillStyle = LCD.bg;
    g.fillRect(0, 0, LW * P, LH * P);
    g.fillStyle = LCD.ghost;
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) g.fillRect(x * P, y * P, P - gap(), P - gap());
  }
  const gap = () => (cv.dpr >= 2 ? 0.5 : P >= 4 ? 1 : 0);
  const say = (s) => { if (lip.textContent !== s) lip.textContent = s; };

  // ── pixels ──
  let px = [];
  const dot = (x, y) => px.push(x, y);
  const sprite = (rows, x, y, flip = false) => rows.forEach((r, j) => [...r].forEach((b, i) => b === '1' && dot(x + (flip ? r.length - 1 - i : i), y + j)));
  const glyph = (ch) => FONT[ch] || FONT['?'];
  const text = (s, x, y, scale = 1) => {
    for (const ch of s.toUpperCase()) {
      const f = glyph(ch), w = f.length / 5;
      for (let i = 0; i < f.length; i++) if (f[i] === '1') for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) dot(x + (i % w) * scale + a, y + ((i / w) | 0) * scale + b);
      x += (w + 1) * scale;
    }
  };
  const tw = (s, scale = 1) => [...s.toUpperCase()].reduce((n, ch) => n + (glyph(ch).length / 5 + 1) * scale, 0) - scale;

  function cellDots(x, y, rows, d) { // a 4x4 sprite drawn facing direction d
    const ox = FX + x * 4, oy = FY + y * 4;
    rows.forEach((r, ly) => [...r].forEach((b, lx) => {
      if (b !== '1') return;
      const [wx, wy] = d[0] === 1 ? [lx, ly] : d[0] === -1 ? [3 - lx, ly] : d[1] === 1 ? [3 - ly, lx] : [ly, 3 - lx];
      dot(ox + wx, oy + wy);
    }));
  }

  function drawSnake() {
    body.forEach((s, i) => {
      if (i === 0) {
        const ahead = egg && !egg.gone && [1, 2].some((n) => (s.x + dir[0] * n + COLS) % COLS === egg.x && (s.y + dir[1] * n + ROWS) % ROWS === egg.y);
        cellDots(s.x, s.y, ahead ? GULP : HEAD, dir);
        return;
      }
      const ox = FX + s.x * 4, oy = FY + s.y * 4;
      if (lumps.includes(i)) { // the egg on its way down: a bulge
        for (let a = -1; a < 4; a++) for (let b = -1; b < 4; b++) if (!((a === -1 || a === 3) && (b === -1 || b === 3))) dot(ox + a, oy + b);
        return;
      }
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (!(i === body.length - 1 && a !== 1 && b !== 1)) dot(ox + a, oy + b);
      for (const n of [body[i - 1], body[i + 1]]) { // bridge the 1px gap to the next segment
        if (!n) continue;
        const dx = wrapd(n.x - s.x, COLS), dy = wrapd(n.y - s.y, ROWS);
        if (dx > 0) for (let b = 0; b < 3; b++) dot(ox + 3, oy + b);
        if (dy > 0) for (let a = 0; a < 3; a++) dot(ox + a, oy + 3);
      }
    });
  }

  function paint() {
    c.drawImage(ghost, 0, 0, LW * P, LH * P);
    const s = P - gap();
    c.fillStyle = LCD.shadow;
    for (let i = 0; i < px.length; i += 2) c.fillRect(px[i] * P + P * 0.45, px[i + 1] * P + P * 0.45, s, s);
    c.fillStyle = LCD.ink;
    for (let i = 0; i < px.length; i += 2) c.fillRect(px[i] * P, px[i + 1] * P, s, s);
  }

  // ── the game ──
  function reset() {
    const row = k.int(2, ROWS - 3);
    body = Array.from({ length: 6 }, (_, i) => ({ x: 8 - i, y: row }));
    dir = [1, 0];
    let ex, ey;
    do { ex = k.int(1, COLS - 2); ey = k.int(1, ROWS - 2); } while (Math.abs(ey - row) < 2 || Math.abs(ex - 8) < 4);
    egg = { x: ex, y: ey };
  }

  function steer(d) {
    const last = turns.at(-1) || dir;
    if ((d[0] && d[0] === -last[0]) || (d[1] && d[1] === -last[1]) || (d[0] === last[0] && d[1] === last[1])) return;
    if (turns.length < 2) turns.push(d);
  }

  function autopilot() { // greedy, wrap-aware, never into itself
    const h = body[0];
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter((d) => !(d[0] === -dir[0] && d[1] === -dir[1]));
    const free = (d) => !body.slice(0, -1).some((s) => s.x === (h.x + d[0] + COLS) % COLS && s.y === (h.y + d[1] + ROWS) % ROWS);
    const far = (d) => Math.abs(wrapd(egg.x - h.x - d[0], COLS)) + Math.abs(wrapd(egg.y - h.y - d[1], ROWS));
    const same = (d) => (d[0] === dir[0] && d[1] === dir[1] ? -0.1 : 0);
    const best = opts.filter(free).sort((a, b) => far(a) + same(a) - far(b) - same(b))[0];
    if (best) dir = best;
  }

  function step() {
    if (turns.length) dir = turns.shift();
    if (mode === 'auto') autopilot();
    const h = body[0];
    const nx = (h.x + dir[0] + COLS) % COLS, ny = (h.y + dir[1] + ROWS) % ROWS;
    if (mode === 'play' && body.slice(0, -1).some((s) => s.x === nx && s.y === ny)) return finish('bit');
    body.unshift({ x: nx, y: ny });
    lumps = lumps.map((i) => i + 1);
    const swallowed = lumps.includes(body.length);
    lumps = lumps.filter((i) => i < body.length);
    if (!swallowed) body.pop(); // the snake grows once the egg reaches its tail
    if (egg && !egg.gone && nx === egg.x && ny === egg.y) {
      egg.gone = true;
      lumps.push(0);
      finish(mode === 'play' ? 'ate' : 'auto');
    }
    if (mode !== 'out') k.sfx.tone({ type: 'square', freq: 1480, dur: 0.012, gain: 0.012 });
  }

  function finish(how) {
    if (mode === 'out') return;
    const was = mode;
    mode = 'out';
    give();
    const fast = t - since < 3.2 && was === 'play';
    if (how === 'ate') {
      eggs = k.score('eggs', 1, { icon: '🥚', label: 'Snake eggs', says: 'fed a snake {n} egg{s}' });
      outcome = { big: 'YUM!', small: fast ? 'SPEEDRUN' : `EGGS ${eggs}`, line: fast ? 'Speedrun. Now answer the question that fast.' : k.pick(ATE) };
      k.sfx.coin();
      if (fast) k.sfx.tada({ delay: 0.15, gain: 0.7 });
    } else if (how === 'auto') {
      outcome = { big: 'MINE.', small: 'NOM', line: 'You didn\'t steer, so it took the obvious option. Relatable.' };
      k.sfx.coin({ pitch: 0.8 });
    } else if (how === 'hatch') {
      outcome = { big: 'PEEP', small: 'IT HATCHED', line: 'Too slow. The egg grew up and moved out.' };
      k.sfx.tone({ type: 'square', freq: 2200, to: 2900, dur: 0.06, gain: 0.04 });
      k.sfx.tone({ type: 'square', freq: 2400, to: 3200, dur: 0.06, gain: 0.04, delay: 0.12 });
    } else {
      outcome = { big: 'GAME', small: 'OVER', line: 'You bit your own tail. Happens to the best grills.' };
      k.sfx.thud({ pitch: 1.4 });
      k.sfx.tone({ type: 'square', freq: 440, to: 110, dur: 0.5, gain: 0.05, delay: 0.08 });
    }
    outcome.at = t;
    k.after(how === 'bit' ? 2600 : 3000, leave);
  }

  // ── the keyboard: borrow it politely, give it back at the first sign you want it ──
  function onKey(e) {
    const d = DIRS[e.key];
    if (!d || mode === 'out') return;
    if (mode !== 'play') {
      mode = 'play';
      since = t;
      tick = 0.06;
      k.grabKeys(onKey, { keys: ARROWS, onLost: lost }); // now you're playing, up and down steer too
      k.sfx.blip({ pitch: 1.5 });
    }
    steer(d);
  }
  // The engine has already given the keyboard back, and handed that key on to the answer box.
  function lost() { holding = false; leave(true); }
  function give() {
    if (!holding) return;
    holding = false;
    k.releaseKeys();
  }

  function leave(fast) {
    if (leaving) return;
    leaving = true;
    give();
    if (!wrap) { done(); return; }
    k.animate(wrap, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px) scale(.94)' }], { duration: fast ? 160 : 320, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).finished.then(done, done);
  }
  function done() { if (!ended) { ended = true; k.end(); } }

  // You click anything, focus a box or start typing: it's your keyboard, the snake goes.
  k.on(window, 'pointerdown', () => leave(true), { capture: true });
  k.on(document, 'focusin', (e) => { if (holding && /^(TEXTAREA|INPUT)$/.test(e.target.tagName)) leave(true); });

  function start() {
    holding = !k.reduced;
    build();
    reset();
    if (k.reduced) { // a still: the snake is napping round its egg
      body = [[9, 5], [9, 6], [9, 7], [10, 7], [11, 7], [12, 7], [13, 7], [13, 6], [13, 5], [13, 4], [13, 3], [12, 3], [11, 3], [10, 3], [9, 3], [8, 3], [7, 3]].map(([x, y]) => ({ x, y }));
      dir = [0, -1];
      egg = { x: 11, y: 5 };
      say('Shh. The snake is napping. Any key and it goes.');
    }
    k.animate(wrap, [{ opacity: 0, transform: 'translateY(24px) scale(.92) rotate(-2deg)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    k.sfx.tone({ type: 'square', freq: 660, dur: 0.07, gain: 0.04 });
    k.sfx.tone({ type: 'square', freq: 990, dur: 0.12, gain: 0.04, delay: 0.08 });
    k.loop(frame, { still: 0 });
  }

  function frame(dt) {
    t += dt;
    if (mode === 'demo' && t > BORED) { mode = 'auto'; k.sfx.blip({ pitch: 0.7 }); }
    if (mode === 'play' && !outcome && t - since > HATCH) {
      egg.gone = true;
      chick = { x: FX + egg.x * 4 - 1, y: FY + egg.y * 4, t: 0 };
      shell = { x: FX + egg.x * 4, y: FY + egg.y * 4 };
      finish('hatch');
    }
    if (!k.reduced && (mode !== 'out' || (t - outcome.at < 1.2 && outcome.big !== 'GAME'))) { // after eating it keeps going a moment, so you see the gulp go down
      tick -= dt;
      while (tick <= 0) { step(); tick += mode === 'play' ? 0.115 : mode === 'auto' ? 0.13 : 0.16; }
    }

    px = [];
    for (let x = 0; x < LW; x++) { dot(x, FY - 2); dot(x, LH - 1); }
    for (let y = FY - 2; y < LH; y++) { dot(0, y); dot(LW - 1, y); }
    text(String(eggs).padStart(4, '0'), 1, 1);
    const blink = (t % 0.9) < 0.6;
    const right = k.reduced ? 'NAPPING' : mode === 'demo' ? (blink ? '← → TO PLAY' : '') : mode === 'auto' && !outcome ? "FINE. I'LL DO IT" : mode === 'play' && t - since > WOBBLE && !outcome ? (blink ? 'HATCHING!' : '') : mode === 'play' && t - since < 1 ? 'GO!' : '';
    if (right) text(right, LW - 1 - tw(right), 1);

    if (!(outcome?.big === 'GAME' && t - outcome.at < 1.1 && (t * 6) % 1 < 0.5)) drawSnake(); // Nokia blinks the snake when it dies
    if (egg && !egg.gone) {
      const wob = mode === 'play' && t - since > WOBBLE ? (Math.floor(t * (t - since > HATCH - 1.2 ? 14 : 7)) % 2 ? 1 : -1) : 0;
      sprite(EGG, FX + egg.x * 4 + wob, FY + egg.y * 4 - 1);
    }
    if (shell) { sprite(['1001', '0110'], shell.x, shell.y + 2); }
    if (chick) {
      chick.t += dt;
      chick.x += dt * 22;
      if (chick.x < LW - 2) sprite([...CHICK, LEGS[Math.floor(chick.t * 10) % 2]], Math.round(chick.x), chick.y - 1);
    }

    if (outcome) { // a framed box in the middle of the field, the snake hidden behind it
      const reveal = t - outcome.at - (outcome.big === 'MINE.' || outcome.big === 'YUM!' ? 0.9 : 0.25);
      if (reveal > 0) {
        const bw = Math.max(tw(outcome.big, 2), tw(outcome.small)) + 10, bh = 23;
        const bx = Math.round((LW - bw) / 2), by = FY + Math.round((ROWS * 4 - bh) / 2);
        const kept = [];
        for (let i = 0; i < px.length; i += 2) if (px[i] < bx || px[i] >= bx + bw || px[i + 1] < by || px[i + 1] >= by + bh) kept.push(px[i], px[i + 1]);
        px = kept;
        for (let x = bx; x < bx + bw; x++) { dot(x, by); dot(x, by + bh - 1); }
        for (let y = by; y < by + bh; y++) { dot(bx, y); dot(bx + bw - 1, y); }
        if (reveal > 0.08) text(outcome.big, Math.round((LW - tw(outcome.big, 2)) / 2), by + 3, 2);
        if (reveal > 0.35) text(outcome.small, Math.round((LW - tw(outcome.small)) / 2), by + 15);
      }
      if (reveal > 0.35) say(outcome.line);
    } else if (!k.reduced) say(mode === 'play' ? 'Arrows steer. Eat the egg.' : '← → to play. Any other key gives the keyboard back.');
    paint();
  }

  // Wait for the card to stop moving (so the phone lands in a real gap), then until it's safe to
  // borrow the keyboard (empty answer, not typing). If it never is, never show up.
  (async () => {
    let last = '';
    for (let i = 0; i < 12; i++) {
      const r = k.rect(k.ui.card());
      const sig = r ? `${Math.round(r.top)},${Math.round(r.height)},${Math.round(r.left)}` : '';
      if (r && sig === last) break;
      last = sig;
      await k.wait(120);
    }
    if (k.reduced) return start();
    const grab = () => k.keySafe() && k.grabKeys(onKey, { keys: ['ArrowLeft', 'ArrowRight'], onLost: lost });
    for (let i = 0; i < 12; i++) {
      if (leaving) return;
      if (grab()) return start();
      await k.wait(300);
    }
    done();
  })();
  if (k.reduced) k.after(3500, leave);

  return {
    typing(on) { if (on) leave(true); },
    layout() { // the card settled or moved: slide out of its way
      if (!wrap || leaving) return;
      const at = place(P);
      const [x0, y0] = [parseFloat(wrap.style.left), parseFloat(wrap.style.top)];
      const [x, y] = [Math.round(at.x), Math.round(at.y)];
      if (Math.hypot(x - x0, y - y0) < 4) return;
      Object.assign(wrap.style, { left: `${x}px`, top: `${y}px` });
      k.animate(wrap, [{ translate: `${x0 - x}px ${y0 - y}px` }, { translate: '0 0' }], { duration: 380, easing: 'cubic-bezier(.3,1.2,.5,1)' });
    },
  };
}
