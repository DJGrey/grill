// Slot machine. A casino cabinet with chasing bulbs; three reels spin through this question's
// options and land on the recommended one. Mostly. When they don't, the machine nudges itself.

const GOLD = ['#fff3b0', '#ffd34d', '#c98a12'];
const FRUIT = ['seven', 'cherry', 'bell', 'bar', 'lemon', 'star'];

export default function slotMachine(k, ctx) {
  const bg = k.canvas({ alpha: false });
  const cv = k.canvas();
  const b = bg.ctx, c = cv.ctx;
  let M = null; // layout: { win, reels: [{ x, w }], cellH, lever, msg, marquee, stage }
  let tiles = new Map(); // symbol key → pre-drawn canvas
  let reels = []; // { strip: [keys], pos, from, to, t0, dur, state, bounce }
  let phase = 'idle'; // idle → pull → spin → (nudge) → result
  let phaseT = 0;
  let nextSpin = 1.2;
  let plan = null; // { kind, targets: [key, key, key], banner, sub }
  let banner = { text: 'PULL TO DECIDE', sub: '', at: 0, hot: false };
  let lever = 0; // 0 up … 1 pulled
  let flashAll = 0;
  let time = 0;
  let glow = null;
  let spins = 0;
  let answeredAt = -9;

  // ── what's on the reels ────────────────────────────────────────────────────

  const optKey = (i) => `opt:${i}`;
  function symbols() {
    const q = ctx.question;
    if (ctx.front === 'done') return { items: ['seven', 'cherry', 'bar', 'bell', 'star', 'lemon'], labels: {} };
    if (!q) return { items: ['cherry', 'lemon', 'bar', 'bell', 'seven', 'star'], labels: {} };
    if (!q.options.length) return { items: ['w:YOUR', 'cherry', 'w:OWN', 'bell', 'w:WORDS', 'bar', 'lemon'], labels: {} };
    const labels = {};
    q.options.forEach((o, i) => { labels[optKey(i)] = o.label ? o : { ...o, label: `Option ${i + 1}` }; });
    return { items: q.options.map((_, i) => optKey(i)), labels };
  }

  function strips() {
    const { items } = symbols();
    const r = k.rng(`${ctx.question?.id || ctx.front}`);
    const opts = items.filter((x) => x.startsWith('opt:') || x.startsWith('w:'));
    const fruit = items.filter((x) => !opts.includes(x));
    reels = [0, 1, 2].map((ri) => {
      let strip;
      if (opts.length && fruit.length === 0) { // options interleaved with fruit
        const fr = r.shuffle(FRUIT);
        const base = [];
        const n = Math.max(4, opts.length);
        for (let i = 0; i < n; i++) { base.push(opts[i % opts.length]); base.push(fr[i % fr.length]); }
        strip = ri ? rotate(base, r.int(0, base.length - 1)) : base;
      } else strip = ri ? r.shuffle(items) : [...items];
      const old = reels[ri];
      return { strip, pos: old ? old.pos % strip.length : r.int(0, strip.length - 1), state: 'still', bounce: 0, bt: 9 };
    });
  }
  const rotate = (a, n) => [...a.slice(n), ...a.slice(0, n)];

  // Decide how this spin ends. The house always recommends.
  function decide() {
    const q = ctx.question;
    const sym = symbols();
    const recIdx = q ? q.options.map((o, i) => (o.recommended ? i : -1)).filter((i) => i >= 0) : [];
    if (ctx.front === 'done') { const n = ctx.decisions.length || ctx.answers.length; return { kind: 'jackpot', targets: ['seven', 'seven', 'seven'], banner: 'JACKPOT', sub: `CASHING OUT ${n} DECISION${n === 1 ? '' : 'S'}` }; }
    if (!q) {
      const t = k.shuffle(sym.items).slice(0, 3);
      return { kind: 'miss', targets: t, banner: 'INSERT QUESTION TO PLAY', sub: ctx.agent === 'listening' ? 'THE AGENT IS LISTENING' : 'THE AGENT IS SHUFFLING THE DECK' };
    }
    if (!q.options.length) return { kind: 'jackpot', targets: ['w:YOUR', 'w:OWN', 'w:WORDS'], banner: 'WRITE-IN JACKPOT', sub: 'NO OPTIONS. THE MACHINE IS STUMPED' };
    if (!recIdx.length) {
      const t = optKey(k.int(0, q.options.length - 1));
      return { kind: 'jackpot', targets: [t, t, t], banner: 'THE HOUSE HAS NO OPINION', sub: 'BUT IT LANDED HERE, SO' };
    }
    const rec = optKey(recIdx[spins % recIdx.length]);
    const others = q.options.map((_, i) => optKey(i)).filter((x) => x !== rec && !recIdx.includes(+x.slice(4)));
    const roll = spins === 0 ? 0.3 : Math.random(); // the first spin always shows off the nudge
    const label = sym.labels[rec].label;
    if (roll < 0.14 && others.length) {
      const o = k.pick(others);
      return { kind: 'rebel', targets: [o, o, o], banner: 'ALSO VALID, I GUESS', sub: 'THE HOUSE IS LOOKING INTO IT' };
    }
    if (roll < 0.42) return { kind: 'nudge', targets: [rec, rec, rec], banner: 'JACKPOT', sub: `★ ${label}`, nudge: true };
    return { kind: 'jackpot', targets: [rec, rec, rec], banner: 'JACKPOT', sub: `★ ${label}` };
  }

  // ── tiles ──────────────────────────────────────────────────────────────────

  function tile(key) {
    if (tiles.has(key)) return tiles.get(key);
    const w = M.reelW, h = M.cellH;
    const dpr = bg.dpr;
    const t = document.createElement('canvas');
    t.width = Math.ceil(w * dpr); t.height = Math.ceil(h * dpr);
    const g = t.getContext('2d');
    g.scale(dpr, dpr);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const cx = w / 2, cy = h / 2, u = Math.min(w, h * 1.25);
    if (key.startsWith('opt:')) {
      const o = symbols().labels[key];
      if (o) optionTile(g, o, w, h);
    } else if (key.startsWith('w:')) {
      g.font = k.font(Math.min(h * 0.42, w / (key.length * 0.62)), 900, 'display');
      g.lineJoin = 'round';
      g.lineWidth = 5;
      g.strokeStyle = '#3b0a0a';
      g.strokeText(key.slice(2), cx, cy + 2);
      g.fillStyle = '#e8262b';
      g.fillText(key.slice(2), cx, cy + 2);
    } else drawFruit(g, key, cx, cy, u * 0.42);
    tiles.set(key, t);
    return t;
  }

  function optionTile(g, o, w, h) {
    const pad = Math.max(10, w * 0.07);
    const room = w - pad * 2;
    const head = o.recommended ? 1 : 0;
    const label = k.clip(o.label, 70);
    const maxLines = h > 76 ? 3 : 2;
    let size = k.clamp(h * 0.22, 12, 21), lines;
    for (;;) { // shrink until it fits without an ellipsis, or give up at 11px
      g.font = k.font(size, 800, 'sans');
      lines = k.wrap(g, label, room, maxLines);
      const lh = size * 1.12;
      const fits = !lines.at(-1)?.endsWith('…') && (lines.length + head * 0.7) * lh < h - 8 && lines.every((ln) => g.measureText(ln).width <= room);
      if (fits || size <= 11) break;
      size -= 1;
    }
    const lh = size * 1.12;
    const top = h / 2 - ((lines.length - 1) * lh) / 2 + head * lh * 0.35;
    if (head) {
      g.font = k.font(Math.max(8, size * 0.58), 900, 'sans');
      g.fillStyle = '#b07800';
      g.fillText('★ RECOMMENDED ★', w / 2, top - lh * 0.9);
      g.font = k.font(size, 800, 'sans');
    }
    lines.forEach((ln, i) => {
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.fillText(ln, w / 2, top + i * lh + 1);
      g.fillStyle = o.recommended ? '#1a1206' : '#2a2a35';
      g.fillText(ln, w / 2, top + i * lh);
    });
  }

  function drawFruit(g, key, x, y, r) {
    g.save();
    g.translate(x, y);
    g.shadowColor = 'rgba(0,0,0,.25)';
    g.shadowBlur = r * 0.15;
    g.shadowOffsetY = r * 0.06;
    if (key === 'seven') {
      g.font = `italic 900 ${r * 2.1}px ${k.font(10, 900, 'display').split('px ')[1]}`;
      g.lineJoin = 'round';
      g.lineWidth = r * 0.28;
      g.strokeStyle = '#7a0c0c';
      g.strokeText('7', 0, r * 0.08);
      const gr = g.createLinearGradient(0, -r, 0, r);
      gr.addColorStop(0, '#ff6b5e');
      gr.addColorStop(0.5, '#e8141c');
      gr.addColorStop(1, '#9c0610');
      g.fillStyle = gr;
      g.fillText('7', 0, r * 0.08);
      g.shadowColor = 'transparent';
      g.lineWidth = r * 0.06;
      g.strokeStyle = '#ffd34d';
      g.strokeText('7', 0, r * 0.08);
    } else if (key === 'bar') {
      for (const [dy, s] of [[-0.42, 0.8], [0.42, 0.8]]) {
        g.fillStyle = '#16161c';
        g.beginPath(); g.roundRect(-r * 1.1 * s, dy * r - r * 0.32, r * 2.2 * s, r * 0.64, r * 0.14); g.fill();
        g.shadowColor = 'transparent';
        g.fillStyle = '#fff';
        g.font = k.font(r * 0.46, 900, 'display');
        g.fillText('BAR', 0, dy * r + r * 0.03);
      }
    } else if (key === 'cherry') {
      g.strokeStyle = '#2e7d32';
      g.lineWidth = r * 0.1;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(-r * 0.42, r * 0.2); g.quadraticCurveTo(-r * 0.2, -r * 0.5, r * 0.15, -r * 0.85); g.stroke();
      g.beginPath(); g.moveTo(r * 0.45, r * 0.32); g.quadraticCurveTo(r * 0.35, -r * 0.4, r * 0.15, -r * 0.85); g.stroke();
      g.fillStyle = '#43a047';
      g.beginPath(); g.ellipse(r * 0.42, -r * 0.8, r * 0.36, r * 0.16, -0.5, 0, Math.PI * 2); g.fill();
      for (const [cx, cy] of [[-r * 0.42, r * 0.42], [r * 0.45, r * 0.52]]) {
        const gr = g.createRadialGradient(cx - r * 0.12, cy - r * 0.12, r * 0.04, cx, cy, r * 0.42);
        gr.addColorStop(0, '#ff8a8a');
        gr.addColorStop(0.4, '#e01b2a');
        gr.addColorStop(1, '#7a0010');
        g.fillStyle = gr;
        g.beginPath(); g.arc(cx, cy, r * 0.4, 0, Math.PI * 2); g.fill();
      }
    } else if (key === 'bell') {
      const gr = g.createLinearGradient(-r, 0, r, 0);
      gr.addColorStop(0, '#b97a00');
      gr.addColorStop(0.4, '#ffe066');
      gr.addColorStop(1, '#c48a00');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, -r * 0.9);
      g.bezierCurveTo(r * 0.55, -r * 0.9, r * 0.6, -r * 0.2, r * 0.7, r * 0.35);
      g.quadraticCurveTo(r * 0.8, r * 0.6, r * 0.95, r * 0.62);
      g.lineTo(-r * 0.95, r * 0.62);
      g.quadraticCurveTo(-r * 0.8, r * 0.6, -r * 0.7, r * 0.35);
      g.bezierCurveTo(-r * 0.6, -r * 0.2, -r * 0.55, -r * 0.9, 0, -r * 0.9);
      g.fill();
      g.fillStyle = '#8a5a00';
      g.beginPath(); g.arc(0, r * 0.72, r * 0.18, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(0, -r * 0.95, r * 0.12, 0, Math.PI * 2); g.fill();
    } else if (key === 'lemon') {
      const gr = g.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
      gr.addColorStop(0, '#fff7a8');
      gr.addColorStop(0.6, '#ffd51f');
      gr.addColorStop(1, '#c79a00');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-r * 0.95, 0);
      g.bezierCurveTo(-r * 0.7, -r * 0.75, r * 0.7, -r * 0.75, r * 0.95, 0);
      g.bezierCurveTo(r * 0.7, r * 0.75, -r * 0.7, r * 0.75, -r * 0.95, 0);
      g.fill();
    } else if (key === 'star') {
      const gr = g.createLinearGradient(0, -r, 0, r);
      gr.addColorStop(0, '#fff3b0');
      gr.addColorStop(1, '#e09a00');
      g.fillStyle = gr;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? r * 0.42 : r * 0.95;
        g.lineTo(Math.cos(i * Math.PI / 5 - Math.PI / 2) * rr, Math.sin(i * Math.PI / 5 - Math.PI / 2) * rr);
      }
      g.fill();
    }
    g.restore();
  }

  // ── layout and the cabinet ─────────────────────────────────────────────────

  function layout() {
    const sp = k.space();
    const top = sp.gaps.find((g) => g.where === 'top' && g.h >= 30);
    const gap = sp.gaps.find((g) => g.where !== 'top' && g.w >= 300 && g.h >= 120);
    const old = M && `${M.reelW}x${M.cellH}`;
    M = { stage: sp.stage, marquee: top ? { x: top.x + 16, y: top.y + 6, w: top.w - 32, h: Math.min(top.h - 12, 44) } : null, win: null, hudX: sp.hud ? sp.hud.left - 10 : Infinity };
    if (gap) {
      const leverRoom = gap.w > 560 ? 70 : 0;
      const short = gap.h < 210; // no room for the message box: the banner sits on the window instead
      const msgH = short ? 0 : gap.h > 260 ? 46 : 36;
      const availW = gap.w - 110 - leverRoom;
      const availH = short ? gap.h - 66 : gap.h - msgH - 84;
      const winH = Math.min(availH, availW * 0.36, 230);
      const winW = Math.min(availW, winH * 3.6);
      if (winH >= 64) {
        const x = gap.x + (gap.w - winW - leverRoom) / 2;
        const y = gap.y + 34 + (availH - winH) * 0.4;
        const gutter = Math.max(8, winW * 0.02);
        const reelW = (winW - gutter * 4) / 3;
        M.win = { x, y, w: winW, h: winH };
        M.reelW = Math.floor(reelW);
        M.cellH = Math.floor(winH / 1.9);
        M.reels = [0, 1, 2].map((i) => ({ x: x + gutter + i * (reelW + gutter), w: reelW }));
        M.msg = msgH ? { x, y: y + winH + 14, w: winW, h: msgH } : null;
        M.lever = leverRoom ? { x: x + winW + 46, y: y + winH * 0.55, len: Math.min(winH * 0.9, 120) } : null;
        M.box = { x: x - 34, y: y - 34, w: winW + 68, h: winH + 34 + (msgH ? 14 + msgH + 22 : 34) };
      }
    }
    M.keep = [M.box, M.marquee && { x: M.marquee.x - 12, y: M.marquee.y - 12, w: M.marquee.w + 24, h: M.marquee.h + 24 }, M.lever && { x: M.lever.x - 26, y: M.lever.y - M.lever.len - 26, w: 52, h: M.lever.len + 52 }].filter(Boolean);
    if (old !== (M.win && `${M.reelW}x${M.cellH}`)) tiles = new Map();
    cabinet();
  }

  function cabinet() {
    const W = bg.w, H = bg.h;
    const base = b.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, '#5a0b14');
    base.addColorStop(0.5, '#3a0610');
    base.addColorStop(1, '#22030a');
    b.fillStyle = base;
    b.fillRect(0, 0, W, H);
    // quilted diamonds
    b.save();
    b.strokeStyle = 'rgba(0,0,0,.28)';
    b.lineWidth = 1;
    const s = 46;
    b.beginPath();
    for (let x = -H; x < W + H; x += s) { b.moveTo(x, 0); b.lineTo(x + H, H); b.moveTo(x, H); b.lineTo(x + H, 0); }
    b.stroke();
    b.fillStyle = 'rgba(255,210,120,.18)';
    for (let x = 0; x < W + s; x += s) for (let y = 0; y < H + s; y += s) { b.beginPath(); b.arc(x, y, 1.6, 0, Math.PI * 2); b.fill(); }
    b.restore();
    const shine = b.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, Math.max(W, H) * 0.7);
    shine.addColorStop(0, 'rgba(255,120,120,.16)');
    shine.addColorStop(1, 'rgba(0,0,0,.45)');
    b.fillStyle = shine;
    b.fillRect(0, 0, W, H);
    // gold trim around the stage
    const st = M.stage;
    goldRect(b, st.x + 6, st.y + 6, st.width - 12, st.height - 12, 18, 5);
    if (M.marquee) marquee(b, M.marquee);
    if (M.win) windowFrame(b);
  }

  function goldRect(g, x, y, w, h, r, lw) {
    const gr = g.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, GOLD[0]);
    gr.addColorStop(0.3, GOLD[1]);
    gr.addColorStop(0.6, GOLD[2]);
    gr.addColorStop(1, GOLD[1]);
    g.strokeStyle = gr;
    g.lineWidth = lw;
    g.beginPath(); g.roundRect(x, y, w, h, r); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.35)';
    g.lineWidth = 1;
    g.beginPath(); g.roundRect(x + lw / 2 + 1, y + lw / 2 + 1, w - lw - 2, h - lw - 2, Math.max(0, r - lw / 2)); g.stroke();
  }

  function marquee(g, m) {
    g.save();
    g.fillStyle = '#12020a';
    g.beginPath(); g.roundRect(m.x, m.y, m.w, m.h, 10); g.fill();
    goldRect(g, m.x, m.y, m.w, m.h, 10, 3);
    const size = k.clamp(m.h * 0.56, 14, 26);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = k.font(size, 900, 'display');
    const title = '★ GRILL-O-MATIC ★';
    const sub = 'THE HOUSE ALWAYS RECOMMENDS';
    g.font = k.font(size, 900, 'display');
    const tw = g.measureText(title).width;
    g.font = k.font(size * 0.5, 800, 'sans');
    g.letterSpacing = '2px';
    const sw = g.measureText(sub).width;
    const mw = Math.min(m.w, M.hudX - m.x); // the lettering stays clear of the score HUD
    const both = tw + sw + 30 < mw - 40;
    const x0 = both ? m.x + mw / 2 - (tw + sw + 30) / 2 : m.x + mw / 2 - tw / 2;
    g.letterSpacing = '0px';
    g.font = k.font(size, 900, 'display');
    g.textAlign = 'left';
    g.shadowColor = 'rgba(255,200,60,.9)';
    g.shadowBlur = 12;
    const gr = g.createLinearGradient(0, m.y, 0, m.y + m.h);
    gr.addColorStop(0, '#fff6c2');
    gr.addColorStop(0.55, '#ffcf3f');
    gr.addColorStop(1, '#e08a00');
    g.fillStyle = gr;
    g.fillText(title, x0, m.y + m.h / 2 + 1);
    if (both) {
      g.shadowColor = 'rgba(255,80,120,.9)';
      g.font = k.font(size * 0.5, 800, 'sans');
      g.letterSpacing = '2px';
      g.fillStyle = '#ff9fbf';
      g.fillText(sub, x0 + tw + 30, m.y + m.h / 2 + 1);
    }
    g.restore();
  }

  function windowFrame(g) {
    const { x, y, w, h } = M.win;
    g.save();
    g.shadowColor = 'rgba(0,0,0,.6)';
    g.shadowBlur = 24;
    g.shadowOffsetY = 8;
    g.fillStyle = '#0d0205';
    g.beginPath(); g.roundRect(x - 16, y - 16, w + 32, h + 32, 20); g.fill();
    g.restore();
    goldRect(g, x - 16, y - 16, w + 32, h + 32, 20, 6);
    // reel slots
    for (const r of M.reels) {
      g.fillStyle = '#f7f1e3';
      g.fillRect(r.x, y, r.w, h);
    }
    if (M.msg) {
      const m = M.msg;
      g.fillStyle = '#0d0205';
      g.beginPath(); g.roundRect(m.x, m.y, m.w, m.h, 8); g.fill();
      goldRect(g, m.x, m.y, m.w, m.h, 8, 2);
    }
    if (M.lever) { // the lever's slot in the cabinet
      const L = M.lever;
      g.fillStyle = '#0d0205';
      g.beginPath(); g.roundRect(L.x - 10, L.y - 16, 20, 32, 8); g.fill();
      goldRect(g, L.x - 14, L.y - 20, 28, 40, 10, 2);
    }
  }

  // ── animation ──────────────────────────────────────────────────────────────

  function startSpin() {
    plan = decide();
    spins++;
    phase = 'pull';
    phaseT = 0;
    banner = { text: 'GOOD LUCK', sub: '', at: time, hot: false };
    k.sfx.clack({ pitch: 0.6, gain: 0.5 });
  }

  function launchReels() {
    phase = 'spin';
    phaseT = 0;
    reels.forEach((r, i) => {
      const n = r.strip.length;
      let idx = r.strip.indexOf(plan.targets[i]);
      if (idx < 0) idx = 0;
      if (plan.nudge && i === 2) idx = (idx - 1 + n) % n; // one short. so close.
      const base = Math.ceil(r.pos) + n * (2 + i);
      const to = base + ((idx - base) % n + n) % n;
      Object.assign(r, { from: r.pos, to, t0: time, dur: 1.5 + i * 0.55 + (i === 2 ? 0.5 : 0), state: 'spin', ticked: Math.floor(r.pos) });
    });
    k.sfx.whoosh({ pitch: 0.7, gain: 0.4 });
  }

  // fast at first, then a long, teasing slow-down
  const spinEase = (p) => 1 - (1 - p) ** 3.2;

  function stepReels(dt) {
    for (const [i, r] of reels.entries()) {
      if (r.state === 'spin') {
        const p = k.clamp((time - r.t0) / r.dur);
        r.pos = r.from + (r.to - r.from) * spinEase(p);
        if (Math.floor(r.pos) !== r.ticked) { r.ticked = Math.floor(r.pos); if (p > 0.6) k.sfx.clack({ pitch: 1.4 + i * 0.1, gain: 0.15 }); }
        if (p >= 1) { r.state = 'still'; r.pos = r.to; r.bt = 0; k.sfx.thud({ pitch: 1.4, gain: 0.35 }); }
      } else if (r.state === 'nudge') {
        const p = k.clamp((time - r.t0) / 0.32);
        r.pos = r.from + k.ease.outBack(p);
        if (p >= 1) { r.state = 'still'; r.pos = r.to; r.bt = 0; k.sfx.thud({ pitch: 1.1, gain: 0.5 }); }
      }
      r.bt += dt;
    }
  }

  function step(dt) {
    phaseT += dt;
    lever = phase === 'pull' ? k.ease.inOutQuad(Math.min(1, phaseT / 0.35)) : Math.max(0, lever - dt * 3.5);
    flashAll = Math.max(0, flashAll - dt);
    if (phase === 'idle' && phaseT > nextSpin && M?.win) startSpin();
    if (phase === 'pull' && phaseT > 0.4) launchReels();
    stepReels(dt);
    if (phase === 'spin' && reels.every((r) => r.state === 'still')) {
      if (plan.nudge) {
        phase = 'nudge';
        phaseT = 0;
        banner = { text: 'SO CLOSE…', sub: 'ONE AWAY FROM THE STAR', at: time, hot: false };
        k.sfx.tone({ type: 'triangle', freq: 330, to: 220, dur: 0.4, gain: 0.08 });
      } else result();
    }
    if (phase === 'nudge' && phaseT > 1.1 && reels[2].state === 'still' && !plan.nudged) {
      plan.nudged = true;
      banner = { text: 'NUDGE ▼', sub: 'THE HOUSE ALWAYS RECOMMENDS', at: time, hot: false };
      const r = reels[2];
      Object.assign(r, { state: 'nudge', from: r.pos, to: r.pos + 1, t0: time });
      k.sfx.boing({ pitch: 0.8, gain: 0.4 });
    }
    if (phase === 'nudge' && plan.nudged && reels[2].state === 'still' && phaseT > 1.6) result();
    if (phase === 'result' && phaseT > 5) { phase = 'idle'; phaseT = 0; nextSpin = k.rand(6, 9); }
  }

  function result() {
    phase = 'result';
    phaseT = 0;
    const win = plan.kind === 'jackpot' || plan.kind === 'nudge';
    banner = { text: plan.banner, sub: plan.sub, at: time, hot: win };
    if (win) {
      flashAll = 2.2;
      k.sfx.tada({ gain: 0.6 });
      for (let i = 0; i < 6; i++) k.sfx.coin({ delay: 0.25 + i * 0.09, pitch: 1 + (i % 3) * 0.06, gain: 0.5 });
      if (M?.msg) coins(M.msg.x + M.msg.w / 2, M.msg.y + M.msg.h / 2, 40);
    } else k.sfx.tone({ type: 'sawtooth', freq: 300, to: 150, dur: 0.6, gain: 0.05, filter: 'lowpass', freqF: 900 });
  }

  function coins(x, y, n) {
    k.burst(x, y, { n, shape: 'dot', colors: ['#ffd34d', '#ffe98a', '#e0a200', '#fff3b0'], speed: 760, angle: -Math.PI / 2, spread: 1.4, gravity: 1300, size: 13, life: 1.8, drag: 0.4 });
    k.burst(x, y, { n: Math.round(n / 2), shape: 'star', colors: ['#fff3b0', '#ffd34d'], speed: 600, angle: -Math.PI / 2, spread: 1.8, gravity: 900, size: 9, life: 1.4 });
  }

  // ── drawing ────────────────────────────────────────────────────────────────

  function makeGlow() {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,240,190,1)');
    gr.addColorStop(0.25, 'rgba(255,200,90,.6)');
    gr.addColorStop(1, 'rgba(255,160,40,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    glow = s;
  }

  const inside = (px, py) => (M.keep || []).some((r) => px > r.x && px < r.x + r.w && py > r.y && py < r.y + r.h);
  function bulbs(x, y, w, h, gapPx, t, offset = 0, keep = false) {
    const per = 2 * (w + h);
    const n = Math.floor(per / gapPx);
    const chase = Math.floor(t * (phase === 'spin' ? 18 : 7));
    for (let i = 0; i < n; i++) {
      let d = (i / n) * per, px, py;
      if (d < w) { px = x + d; py = y; } else if ((d -= w) < h) { px = x + w; py = y + d; } else if ((d -= h) < w) { px = x + w - d; py = y + h; } else { d -= w; px = x; py = y + h - d; }
      if (keep && inside(px, py)) continue;
      const on = k.reduced ? i % 2 === 0 : flashAll > 0 ? Math.floor(t * 10) % 2 === 0 : (i + chase + offset) % 3 === 0;
      c.fillStyle = on ? '#fff6d0' : '#6a4210';
      c.beginPath(); c.arc(px, py, 3.2, 0, Math.PI * 2); c.fill();
      if (on) { c.globalCompositeOperation = 'lighter'; c.drawImage(glow, px - 13, py - 13, 26, 26); c.globalCompositeOperation = 'source-over'; }
    }
  }

  function drawReels() {
    const { win, cellH } = M;
    const cy = win.y + win.h / 2;
    for (const [i, r] of reels.entries()) {
      const R = M.reels[i];
      const speed = r.state === 'spin' ? (r.to - r.from) * 3.2 * (1 - k.clamp((time - r.t0) / r.dur)) ** 2.2 / r.dur : 0;
      const bounce = r.state === 'still' && r.bt < 0.6 ? Math.sin(r.bt * 22) * Math.exp(-r.bt * 7) * 0.08 : 0;
      const pos = r.pos + bounce;
      const n = r.strip.length;
      c.save();
      c.beginPath(); c.rect(R.x, win.y, R.w, win.h); c.clip();
      const base = Math.floor(pos);
      for (let d = -2; d <= 2; d++) {
        const idx = base + d;
        const off = idx - pos; // cells above the payline are positive
        const ang = off * 0.62;
        if (Math.abs(ang) > Math.PI / 2) continue;
        const yc = cy - Math.sin(ang) * cellH * 1.55;
        const hh = cellH * Math.cos(ang);
        const tl = tile(r.strip[((idx % n) + n) % n]);
        if (speed > 6) { // motion blur: a smear of faint copies
          const sm = Math.min(speed, 60) * 0.7;
          c.globalAlpha = 0.24;
          for (let s = -2; s <= 2; s++) c.drawImage(tl, R.x, yc - hh / 2 + s * sm / 2, R.w, hh);
          c.globalAlpha = 1;
        } else c.drawImage(tl, R.x, yc - hh / 2, R.w, hh);
      }
      // the drum's curvature: dark top and bottom, a glint in the middle
      const sh = c.createLinearGradient(0, win.y, 0, win.y + win.h);
      sh.addColorStop(0, 'rgba(20,5,0,.75)');
      sh.addColorStop(0.22, 'rgba(20,5,0,.1)');
      sh.addColorStop(0.5, 'rgba(255,255,255,.08)');
      sh.addColorStop(0.78, 'rgba(20,5,0,.1)');
      sh.addColorStop(1, 'rgba(20,5,0,.75)');
      c.fillStyle = sh;
      c.fillRect(R.x, win.y, R.w, win.h);
      c.restore();
      c.fillStyle = 'rgba(0,0,0,.35)';
      c.fillRect(R.x + R.w, win.y, 3, win.h);
    }
    // payline
    const win2 = phase === 'result' && banner.hot;
    const blink = win2 && Math.floor(time * 6) % 2 === 0;
    c.save();
    c.strokeStyle = blink ? '#fff3b0' : 'rgba(230,30,40,.85)';
    c.lineWidth = 2.5;
    c.shadowColor = blink ? 'rgba(255,220,100,1)' : 'rgba(255,40,40,.8)';
    c.shadowBlur = 8;
    c.beginPath(); // the line shows in the gutters only, so it never strikes through a label
    const edges = [win.x - 6, ...M.reels.flatMap((R) => [R.x, R.x + R.w]), win.x + win.w + 6];
    for (let i = 0; i < edges.length; i += 2) { c.moveTo(edges[i], cy); c.lineTo(edges[i + 1], cy); }
    c.stroke();
    c.fillStyle = c.strokeStyle;
    for (const [x, dir] of [[win.x - 14, 1], [win.x + win.w + 14, -1]]) {
      c.beginPath(); c.moveTo(x, cy - 8); c.lineTo(x + dir * 10, cy); c.lineTo(x, cy + 8); c.fill();
    }
    if (win2) { // the winning cells light up
      c.shadowColor = 'rgba(255,200,60,1)';
      c.shadowBlur = 16;
      c.lineWidth = 3;
      c.strokeStyle = blink ? '#fff3b0' : '#ffcf3f';
      for (const R of M.reels) c.strokeRect(R.x + 3, cy - M.cellH / 2 + 3, R.w - 6, M.cellH - 6);
    }
    c.restore();
    // glass reflection over the whole window
    c.save();
    c.globalAlpha = 0.1;
    const gl = c.createLinearGradient(win.x, win.y, win.x + win.w * 0.5, win.y + win.h);
    gl.addColorStop(0, '#fff');
    gl.addColorStop(0.35, 'rgba(255,255,255,0)');
    c.fillStyle = gl;
    c.fillRect(win.x, win.y, win.w, win.h);
    c.restore();
  }

  // Short gap: the banner on a small plate over the bottom of the reels, only while there's news.
  function drawPlate() {
    const age = time - banner.at;
    if (!banner.text || banner.text === 'PULL TO DECIDE' || banner.text === 'GOOD LUCK' || (age > 4 && !k.reduced)) return;
    const { win } = M;
    c.save();
    c.font = k.font(13, 900, 'display');
    const t = k.ellipsize(c, banner.text, win.w - 40);
    const w = c.measureText(t).width + 28;
    c.globalAlpha = k.reduced ? 1 : k.clamp(age * 5) * k.clamp((4 - age) * 3);
    c.fillStyle = 'rgba(13,2,5,.92)';
    c.beginPath(); c.roundRect(win.x + win.w / 2 - w / 2, win.y + win.h - 26, w, 22, 6); c.fill();
    c.strokeStyle = '#ffcf3f';
    c.lineWidth = 1.5;
    c.stroke();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = banner.hot ? '#ffe680' : '#ffd0e0';
    c.shadowColor = banner.hot ? 'rgba(255,200,60,1)' : 'transparent';
    c.shadowBlur = 10;
    c.fillText(t, win.x + win.w / 2, win.y + win.h - 15);
    c.restore();
  }

  function drawMsg(t) {
    if (!M.msg) { drawPlate(); return; }
    const m = M.msg;
    const age = time - banner.at;
    const on = !banner.hot || k.reduced || Math.floor(age * 5) % 2 === 0 || age > 2.4;
    c.save();
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    const side = m.w > 460;
    const room = side ? m.w - 220 : m.w - 20;
    if (side) {
      c.font = k.font(10, 800, 'sans');
      c.fillStyle = '#c9a25a';
      c.fillText('CREDITS', m.x + 55, m.y + m.h / 2 - 8);
      c.fillText('PAID OUT', m.x + m.w - 55, m.y + m.h / 2 - 8);
      c.font = k.font(16, 800, 'mono');
      c.fillStyle = '#ff4d4d';
      c.shadowColor = 'rgba(255,60,60,.8)';
      c.shadowBlur = 8;
      c.fillText(String(ctx.answers.length).padStart(3, '0'), m.x + 55, m.y + m.h / 2 + 8);
      c.fillText(`★${String(ctx.answers.filter((a) => a.tookRec).length).padStart(2, '0')}`, m.x + m.w - 55, m.y + m.h / 2 + 8);
    }
    const two = banner.sub && m.h >= 40;
    if (on) {
      const fit = k.fit(c, banner.text, room, { size: two ? 18 : 15, min: 10, weight: 900, family: 'display' });
      c.font = fit.font;
      c.shadowColor = banner.hot ? 'rgba(255,200,60,1)' : 'rgba(255,120,160,.8)';
      c.shadowBlur = banner.hot ? 16 : 8;
      c.fillStyle = banner.hot ? '#ffe680' : '#ffd0e0';
      c.fillText(fit.text, m.x + m.w / 2, m.y + (two ? m.h * 0.36 : m.h / 2));
    }
    if (two) {
      const fit = k.fit(c, banner.sub, room, { size: 11, min: 9, weight: 700, family: 'sans' });
      c.font = fit.font;
      c.shadowBlur = 0;
      c.fillStyle = '#e8d6b0';
      c.fillText(fit.text, m.x + m.w / 2, m.y + m.h * 0.72);
    }
    c.restore();
  }

  function drawLever() {
    const L = M.lever;
    if (!L) return;
    const a = lever * Math.PI * 0.82;
    const tipY = L.y - Math.cos(a) * L.len;
    const tipX = L.x + Math.sin(a) * 6;
    c.save();
    c.lineCap = 'round';
    const gr = c.createLinearGradient(L.x - 5, 0, L.x + 5, 0);
    gr.addColorStop(0, '#7d8590');
    gr.addColorStop(0.4, '#f4f6f8');
    gr.addColorStop(1, '#5b626b');
    c.strokeStyle = gr;
    c.lineWidth = 9;
    c.beginPath(); c.moveTo(L.x, L.y); c.lineTo(tipX, tipY); c.stroke();
    const r = 15 * (0.85 + 0.15 * Math.abs(Math.cos(a)));
    const bl = c.createRadialGradient(tipX - r * 0.35, tipY - r * 0.35, r * 0.1, tipX, tipY, r);
    bl.addColorStop(0, '#ff9a9a');
    bl.addColorStop(0.45, '#e3121b');
    bl.addColorStop(1, '#6d0008');
    c.fillStyle = bl;
    c.shadowColor = 'rgba(0,0,0,.5)';
    c.shadowBlur = 10;
    c.shadowOffsetY = 4;
    c.beginPath(); c.arc(tipX, tipY, r, 0, Math.PI * 2); c.fill();
    c.restore();
    c.fillStyle = '#c9a25a';
    c.beginPath(); c.arc(L.x, L.y, 7, 0, Math.PI * 2); c.fill();
  }

  function draw(dt, t) {
    time = t;
    if (!k.reduced) step(dt);
    c.clearRect(0, 0, cv.w, cv.h);
    if (!M) return;
    const st = M.stage;
    bulbs(st.x + 18, st.y + 18, st.width - 36, st.height - 36, 30, t, 0, true);
    if (!M.win) return;
    drawReels();
    const box = M.box;
    bulbs(box.x, box.y, box.w, box.h, 26, t, 2);
    drawMsg(t);
    drawLever();
  }

  function still() {
    plan = decide();
    if (plan.nudge) plan = { ...plan, kind: 'jackpot', nudge: false };
    reels.forEach((r, i) => { const idx = r.strip.indexOf(plan.targets[i]); r.pos = idx < 0 ? 0 : idx; r.state = 'still'; r.bt = 9; });
    phase = 'result';
    banner = { text: plan.banner, sub: plan.sub, at: -9, hot: plan.kind === 'jackpot' };
  }

  function fresh() {
    tiles = new Map();
    strips();
    if (k.reduced) { still(); return; }
    // a new question mid-spin lets the spin finish on the old strip; otherwise spin soon
    if (phase === 'idle' || phase === 'result') { phase = 'idle'; phaseT = 0; nextSpin = time - answeredAt < 3 ? 2.4 : 0.9; }
  }

  makeGlow();
  bg.resized = (w, h, { dprOnly } = {}) => { if (!dprOnly) return layout(); tiles = new Map(); cabinet(); };
  layout();
  strips();
  if (k.reduced) still();
  // The card can settle after a hook (entry animations don't fire resize events): follow it.
  let cardSig = '';
  const settle = () => { const r = k.rect(k.ui.card()); const sg = r ? [r.left, r.top, r.width, r.height].map(Math.round).join() : ''; if (sg === cardSig) return; cardSig = sg; layout(); if (k.reduced) loop.redraw(); };
  k.every(700, settle);
  const loop = k.loop(draw, { still: 0 });

  return {
    question() {
      layout();
      k.after(450, layout);
      if (phase === 'spin' || phase === 'pull' || phase === 'nudge') { k.after(4000, fresh); return; }
      fresh();
    },
    layout,
    event(name) {
      if (name !== 'stat' || !M) return;
      const h = k.space().hud, x = h ? h.left - 10 : Infinity;
      if (x !== M.hudX) { M.hudX = x; cabinet(); }
    },
    status() { if (!ctx.question) fresh(); },
    answer(a) {
      answeredAt = time;
      if (k.reduced) return;
      if (a.revision) banner = { text: 'REFUND PROCESSED', sub: 'YOU CHANGED YOUR MIND. THE HOUSE NOTICED', at: time, hot: false };
      else if (a.tookRec || !a.hasRec) {
        banner = { text: 'PAYOUT!', sub: a.tookRec ? 'YOU TOOK THE STAR. THE HOUSE IS PLEASED' : 'NO STAR TO TAKE. PAYING OUT ANYWAY', at: time, hot: true };
        flashAll = 1.6;
        if (M?.msg) coins(M.msg.x + M.msg.w / 2, M.msg.y, 60);
        for (let i = 0; i < 8; i++) k.sfx.coin({ delay: i * 0.08, pitch: 1 + (i % 4) * 0.05, gain: 0.5 });
      } else {
        banner = { text: 'THE HOUSE IS DISAPPOINTED', sub: 'BOLD. NO PAYOUT FOR YOU', at: time, hot: false };
        [392, 370, 349, 330].forEach((f, i) => k.sfx.tone({ type: 'sawtooth', freq: f, to: f * 0.97, dur: i === 3 ? 0.7 : 0.26, gain: 0.05, delay: i * 0.28, filter: 'lowpass', freqF: 1200 }));
      }
      phase = 'result';
      phaseT = 1.5;
    },
  };
}
