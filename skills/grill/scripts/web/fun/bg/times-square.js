// Times Square at night. Every option gets a billboard under the card (the recommended one gets
// the big screen and the chasing bulbs, one of the others has a dying neon tube that buzzes).
// The news zipper above the card scrolls your question and decisions. Taxis, a crowd filming it.

const NEON = ['#ff3df2', '#22e7ff', '#7dff4a', '#ffb31a', '#ff4466'];
const LED_ON = '#ff6a1f';
const LED_OFF = '#2a0c06';
const TAG = ['NEW!', 'LIMITED TIME', 'AS SEEN ON Q{n}', 'NOW WITH FEWER REGRETS', 'ONE NIGHT ONLY', 'BACK BY POPULAR DEMAND'];
const SMALL = ['*TERMS AND CONDITIONS APPLY', 'ASK YOUR AGENT IF IT’S RIGHT FOR YOU', '*RESULTS MAY VARY', 'NO REFUNDS. NO REGRETS.', 'SIDE EFFECTS INCLUDE REFACTORING'];
const SIDE = [
  ['GRILL', '#ff2d55', '#ffd60a'], ['DECIDE™', '#0a84ff', '#ffffff'], ['★★★', '#1d1d1f', '#ffd60a'], ['OPEN 24/7', '#30d158', '#06210f'],
  ['ASK YOUR AGENT', '#bf5af2', '#ffffff'], ['SALE', '#ff9f0a', '#3a1000'], ['♥ NY', '#ffffff', '#ff2d55'], ['Q&A', '#64d2ff', '#00203a'],
];

// 5x7 LED font, column bytes (bit 0 is the top row), from space to Z, plus ★
const GLYPHS = '0000000000 00005f0000 0007000700 147f147f14 242a7f2a12 2313086462 3649552250 0005030000 001c224100 0041221c00 082a1c2a08 08083e0808 0050300000 0808080808 0060600000 2010080402 3e5149453e 00427f4000 4261514946 2141454b31 1814127f10 2745454539 3c4a494930 0171090503 3649494936 064949291e 0036360000 0056360000 0008142241 1414141414 4122140800 0201510906 324979413e 7e1111117e 7f49494936 3e41414122 7f4141221c 7f49494941 7f09090101 3e41415132 7f0808087f 00417f4100 2040413f01 7f08142241 7f40404040 7f0204027f 7f0408107f 3e4141413e 7f09090906 3e4151215e 7f09192946 4649494931 01017f0101 3f4040403f 1f2040201f 7f2018207f 6314081463 0304780403 6151494543'.split(' ');
const STAR = [0x24, 0x1c, 0x0f, 0x1c, 0x24];
const glyph = (ch) => {
  if (ch === '★') return STAR;
  const ascii = { '“': '"', '”': '"', '’': "'", '‘': "'", '…': '.', '–': '-', '—': '-' }[ch] || ch;
  const hex = GLYPHS[ascii.charCodeAt(0) - 32];
  return hex ? [0, 2, 4, 6, 8].map((i) => parseInt(hex.slice(i, i + 2), 16)) : [0, 0, 0, 0, 0];
};

export default function timesSquare(k, ctx) {
  const city = k.canvas({ alpha: false }); // sky, buildings, side signs: redrawn on layout only
  const cv = k.canvas(); // everything that moves
  const g0 = city.ctx, c = cv.ctx;

  let sp = k.space();
  let boards = []; // { x, y, w, h, spr, alt, pad, rec, broken, sold, flick }
  let zip = null; // { x, y, w, rows, led, bits, cols, off, text }
  let street = { y: 0, h: 0, x0: 0, x1: 0 };
  let crowd = [];
  let taxi = null;
  let taxiAt = 2.5;
  let sideSigns = []; // { x, y, w, h, a, b, phase }
  let steam = [];
  let clock = 0;
  let confettiAt = 0;
  let sold = new Set();
  let news = '';
  let answeredAt = -1e9;

  const glow = (() => { // a soft round glow sprite, for bulbs and headlights
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,240,200,.8)');
    r.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return s;
  })();

  function off(w, h) {
    const s = document.createElement('canvas');
    s.width = Math.ceil(w * city.dpr);
    s.height = Math.ceil(h * city.dpr);
    const g = s.getContext('2d');
    g.scale(city.dpr, city.dpr);
    return [s, g];
  }

  // ── the city ──────────────────────────────────────────────────────────

  function paintCity() {
    const { w, h } = city;
    const g = g0;
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#05030f');
    sky.addColorStop(0.55, '#1a0b33');
    sky.addColorStop(1, '#4a1840');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const R = k.rng('times-square');
    // far buildings behind the card, then near towers at the edges
    for (let x = -20; x < w; x += R.rand(50, 110)) {
      const bw = R.rand(70, 140), bh = h * R.rand(0.45, 0.85);
      g.fillStyle = `hsl(${R.rand(240, 290)},30%,${R.rand(7, 12)}%)`;
      g.fillRect(x, h - bh, bw, bh);
      for (let wy = h - bh + 10; wy < h - 20; wy += 12) for (let wx = x + 6; wx < x + bw - 8; wx += 10) {
        if (R.chance(0.35)) { g.fillStyle = R.chance(0.7) ? 'rgba(255,214,140,.35)' : 'rgba(150,200,255,.3)'; g.fillRect(wx, wy, 5, 6); }
      }
    }
    for (const s of sideSigns) {
      g.fillStyle = '#0b0714';
      g.fillRect(s.x - 10, s.y - 10, s.w + 20, s.h + 20);
    }
    const haze = g.createLinearGradient(0, h * 0.6, 0, h);
    haze.addColorStop(0, 'rgba(255,60,160,0)');
    haze.addColorStop(1, 'rgba(255,90,60,.28)');
    g.fillStyle = haze;
    g.fillRect(0, h * 0.6, w, h * 0.4);
  }

  function sideSprite(text, bg, fg, w, h) {
    const [s, g] = off(w, h);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    const r = k.fit(g, text, w - 24, { size: Math.min(h * 0.6, 90), min: 14, weight: 900, family: 'display' });
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(r.text, w / 2, h / 2 + 2);
    return s;
  }

  function placeSides() {
    sideSigns = [];
    const L = sp.side ? sp.side.right : 0;
    const R = sp.notes ? sp.notes.left : sp.vw;
    const R2 = k.rng('sides');
    const cols = [[10, L - 10], [R + 10, sp.vw - 10]].filter(([a, b]) => b - a > 60);
    let i = 0;
    for (const [a, b] of cols) {
      for (let y = 20; y < sp.vh - 120; i++) {
        const h = R2.rand(110, 200);
        const w = (b - a) * R2.rand(0.7, 1);
        const [t1, bg1, fg1] = SIDE[i % SIDE.length];
        const [t2, bg2, fg2] = SIDE[(i + 3) % SIDE.length];
        const paint = (sg) => Object.assign(sg, { a: sideSprite(t1, bg1, fg1, w, h), b: sideSprite(t2, bg2, fg2, w, h) });
        sideSigns.push(paint({ x: a + R2.rand(0, b - a - w), y, w, h, paint, phase: R2.rand(0, 6) }));
        y += h + R2.rand(24, 50);
      }
    }
  }

  // ── billboards ────────────────────────────────────────────────────────

  function ads() {
    const q = ctx.question;
    if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      return [
        { head: 'HAPPY NEW DECISIONS!', tag: `${n} DECISION${n === 1 ? '' : 'S'} MADE`, small: 'THE BALL HAS DROPPED', rec: true },
        { head: 'THE GRILL IS DONE', tag: 'NOW PLAYING', small: 'GO HOME. GET SOME SLEEP.' },
      ];
    }
    if (!q) return [
      { head: 'YOUR AGENT IS THINKING', tag: 'COMING SOON', small: 'PLEASE STAND BY', rec: true },
      { head: 'THIS SPACE AVAILABLE', tag: 'ADVERTISE HERE', small: 'CALL 1-800-GRILL-ME' },
    ];
    if (!q.options.length) return [
      { head: 'NO OPTIONS. JUST VIBES.', tag: `QUESTION ${q.n}`, small: 'WRITE YOUR OWN. WE BELIEVE IN YOU.', rec: true },
      { head: 'YOUR AD HERE', tag: 'ADVERTISE HERE', small: 'THIS BILLBOARD HAS NO OPTIONS EITHER' },
    ];
    const R = k.rng(q.id);
    const tags = R.shuffle(TAG), smalls = R.shuffle(SMALL);
    return q.options.slice(0, 4).map((o, i) => ({
      head: (o.label || 'THIS SPACE INTENTIONALLY LEFT BLANK').toUpperCase(),
      label: o.label,
      tag: o.recommended ? '★ AGENT’S PICK ★' : tags[i].replace('{n}', q.n),
      small: o.recommended ? '9 OUT OF 10 AGENTS RECOMMEND' : o.description && R.chance(0.5) ? `*${k.clip(o.description, 60).toUpperCase()}` : smalls[i],
      rec: o.recommended,
    }));
  }

  function boardSprite(ad, w, h, color, dropLetter = -1) {
    const pad = 22;
    const [s, g] = off(w + pad * 2, h + pad * 2);
    g.translate(pad, pad);
    const r = Math.min(10, h * 0.08);
    let head = ad.head;
    if (dropLetter >= 0) head = head.slice(0, dropLetter) + ' ' + head.slice(dropLetter + 1);
    // frame
    g.fillStyle = '#121016';
    g.beginPath(); g.roundRect(-4, -4, w + 8, h + 8, r + 3); g.fill();
    if (ad.rec) { // a bright LED screen
      const bg = g.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#ff0f7b');
      bg.addColorStop(1, '#7b2ff7');
      g.fillStyle = bg;
      g.beginPath(); g.roundRect(0, 0, w, h, r); g.fill();
      g.globalAlpha = 0.12; // the pixel grid of a big screen
      g.fillStyle = '#000';
      for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
      for (let x = 0; x < w; x += 3) g.fillRect(x, 0, 1, h);
      g.globalAlpha = 1;
    } else {
      g.fillStyle = '#0d0a14';
      g.beginPath(); g.roundRect(0, 0, w, h, r); g.fill();
      g.shadowColor = color; g.shadowBlur = 14;
      g.strokeStyle = color; g.lineWidth = 3;
      g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, Math.max(2, r - 3)); g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
      g.stroke();
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tagS = k.clamp(h * 0.1, 9, 15);
    const smallS = k.clamp(h * 0.075, 8, 12);
    const headRoom = h - tagS * 2.4 - smallS * 2.4;
    // headline: as big as fits on up to two lines
    let size = Math.min(headRoom / 2.3, 44), lines;
    for (;;) {
      g.font = k.font(size, 900, 'display');
      lines = k.wrap(g, head, w - 28, 2);
      const one = lines.length === 1 && g.measureText(lines[0]).width <= w - 28;
      if ((one && size <= headRoom * 0.75) || (lines.length <= 2 && !lines.at(-1)?.endsWith('…')) || size <= 11) break;
      size -= 1;
    }
    if (lines.length === 1) size = Math.min(size * 1.25, headRoom * 0.7, 52);
    g.font = k.font(size, 900, 'display');
    lines = k.wrap(g, head, w - 28, 2);
    const cy = tagS * 1.5 + 4 + headRoom / 2 + 2;
    const lh = size * 1.08;
    lines.forEach((l, i) => {
      const y = cy + (i - (lines.length - 1) / 2) * lh;
      if (ad.rec) {
        g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
        g.fillStyle = '#fff';
        g.fillText(l, w / 2, y);
        g.shadowColor = 'transparent'; g.shadowOffsetY = 0;
      } else { // neon tube: coloured glow, white-hot core
        g.shadowColor = color; g.shadowBlur = 16;
        g.fillStyle = color;
        g.fillText(l, w / 2, y);
        g.shadowBlur = 6;
        g.fillStyle = 'rgba(255,255,255,.85)';
        g.fillText(l, w / 2, y);
        g.shadowBlur = 0;
      }
    });
    g.font = k.font(tagS, 800, 'sans');
    g.fillStyle = ad.rec ? '#ffe14d' : color;
    g.fillText(k.ellipsize(g, ad.tag, w - 24), w / 2, tagS * 1.1 + 6);
    g.font = k.font(smallS, 600, 'sans');
    g.fillStyle = ad.rec ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.55)';
    g.fillText(k.ellipsize(g, ad.small, w - 24), w / 2, h - smallS * 1.1 - 6);
    return { spr: s, pad };
  }

  function placeBoards() {
    boards = [];
    const list = ads();
    const bottom = sp.gaps.find((x) => x.where === 'bottom' && x.h >= 90);
    const area = bottom || (sp.card ? { x: sp.stage.left, y: sp.vh - 230, w: sp.stage.width, h: 230 } : { x: sp.stage.left, y: sp.vh * 0.45, w: sp.stage.width, h: sp.vh * 0.55 });
    const streetH = k.clamp(area.h * 0.24, 34, 74);
    street = { y: sp.vh - streetH, h: streetH, x0: sp.stage.left, x1: sp.stage.right };
    const top = area.y + 10, bot = Math.min(area.y + area.h, sp.vh) - streetH - 8;
    const h = Math.min(220, bot - top);
    if (h < 50) return;
    const gap = 14;
    const weights = list.map((a) => (a.rec ? 1.45 : 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    const W = Math.min(area.w - 32, 260 * sum + gap * (list.length - 1));
    let x = area.x + (area.w - W) / 2;
    const brokenI = list.findIndex((a) => !a.rec);
    list.forEach((ad, i) => {
      const w = (W - gap * (list.length - 1)) * weights[i] / sum;
      const bh = ad.rec ? h : h * 0.88;
      const y = top + (h - bh);
      const color = NEON[(i + (ctx.question?.n || 0)) % NEON.length];
      const broken = i === brokenI && list.length > 1;
      let drop = -1;
      if (broken) { // the same sign with one letter's tube dead
        const idx = [...ad.head].map((ch, j) => (/[A-Z]/.test(ch) ? j : -1)).filter((j) => j > 0);
        drop = idx.length ? k.pick(idx) : -1;
      }
      const paint = (b) => Object.assign(b, boardSprite(ad, w, bh, color), { alt: broken ? boardSprite(ad, w, bh, color, drop).spr : null });
      boards.push(paint({ x, y, w, h: bh, paint, rec: ad.rec, broken, label: ad.label, flick: 0, mode: 0 }));
      x += w + gap;
    });
  }

  // ── the news zipper ───────────────────────────────────────────────────

  function zipText() {
    const q = ctx.question;
    const D = ctx.decisions.slice(-4).map((d) => `${d.n ? `D${d.n}: ` : ''}${k.clip(d.text, 70)}`);
    const rate = ctx.recRate == null ? '' : `${Math.round(ctx.recRate * 100)}% OF ANSWERS TOOK THE STAR`;
    const t = Math.round(ctx.cardTime);
    let parts;
    const made = ctx.decisions.length || ctx.answers.length;
    if (ctx.front === 'done') parts = ['HAPPY NEW DECISIONS', `${made} DECISION${made === 1 ? '' : 'S'} MADE`, 'THE GRILL IS DONE', rate, ...D];
    else if (!q) parts = ['THE AGENT IS THINKING', 'PLEASE STAND BY', ctx.doc.title, ...D];
    else parts = [news, `BREAKING: LOCAL DEVELOPER STILL DECIDING “${k.clip(q.title, 90)}”`, `QUESTION ${q.n} OF ${q.total}`, t > 20 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} ON THIS CARD AND COUNTING` : '', ...D, rate];
    return `${parts.filter(Boolean).join('   ★   ')}   ★   `.toUpperCase();
  }

  function buildZip() {
    const top = sp.gaps.find((x) => x.where === 'top');
    const avail = top ? top.h - 10 : 40;
    const led = k.clamp(Math.floor((avail - 6) / 9), 2.5, 4.5);
    const text = zipText();
    const chars = [...text];
    const tw = chars.length * 6;
    const bits = new Uint8Array(tw * 9);
    chars.forEach((ch, i) => glyph(ch).forEach((col, j) => {
      for (let r = 0; r < 7; r++) if (col & (1 << r)) bits[(r + 1) * tw + i * 6 + j] = 1;
    }));
    const x = (top || sp.stage).x + 12, w = (top || sp.stage).w - 24;
    const y = top ? top.y + Math.max(4, (top.h - led * 9) / 2 - 2) : 8;
    const old = zip?.off ?? (k.reduced ? 0 : -Math.floor(w / led) + 4);
    zip = { x, y, w, led, bits, cols: tw, off: old, text };
    zipGrid();
  }

  function zipGrid() { // the unlit grid, drawn once
    const { w, led } = zip;
    const [s, g] = off(w + 8, led * 9 + 8);
    g.fillStyle = '#100604';
    g.beginPath(); g.roundRect(0, 0, w + 8, led * 9 + 8, 4); g.fill();
    g.fillStyle = LED_OFF;
    for (let r = 0; r < 9; r++) for (let col = 0; col < Math.floor(w / led); col++) g.fillRect(4 + col * led, 4 + r * led, led - 1, led - 1);
    zip.grid = s;
  }

  function drawZip(dt) {
    if (!zip) return;
    zip.off += dt * 38;
    const n = Math.floor(zip.w / zip.led);
    if (zip.off >= zip.cols) { news = ''; buildZip(); zip.off = -n; } // rebuilt every lap, so the clock and decisions stay current
    c.drawImage(zip.grid, zip.x - 4, zip.y - 4, zip.w + 8, zip.led * 9 + 8);
    c.fillStyle = LED_ON;
    c.shadowColor = 'rgba(255,90,20,.9)';
    c.shadowBlur = 0;
    const o = Math.floor(zip.off);
    for (let col = 0; col < n; col++) {
      const src = o + col;
      if (src < 0 || src >= zip.cols) continue;
      for (let r = 0; r < 9; r++) if (zip.bits[r * zip.cols + src]) c.fillRect(zip.x + col * zip.led, zip.y + r * zip.led, zip.led - 1, zip.led - 1);
    }
    // a soft glow over the lit band
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.18;
    c.fillStyle = '#ff5a14';
    c.fillRect(zip.x - 4, zip.y - 2, zip.w + 8, zip.led * 9 + 4);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  // ── street life ───────────────────────────────────────────────────────

  function placeCrowd() {
    const R = k.rng('crowd');
    crowd = [];
    const w = sp.vw;
    for (let x = -10; x < w + 20; x += R.rand(16, 30)) {
      const s = R.rand(0.75, 1.15) * k.clamp(street.h / 60, 0.6, 1.1);
      crowd.push({ x, s, phone: R.chance(0.3), flash: 0, bob: R.rand(0, 6) });
    }
  }

  function drawCrowd(dt, t) {
    const base = sp.vh + 4;
    for (const p of crowd) {
      const h = 34 * p.s;
      const bob = Math.sin(t * 2 + p.bob) * 0.8;
      c.fillStyle = '#06040b';
      c.beginPath(); c.roundRect(p.x - 13 * p.s, base - h + 14 * p.s + bob, 26 * p.s, h, 10 * p.s); c.fill();
      c.beginPath(); c.arc(p.x, base - h + 6 * p.s + bob, 8 * p.s, 0, 7); c.fill();
      if (p.phone) {
        const px = p.x + 8 * p.s, py = base - h - 8 * p.s + bob;
        c.fillStyle = '#06040b';
        c.fillRect(px - 2, py + 6 * p.s, 3, 10 * p.s);
        c.fillStyle = '#bfe3ff';
        c.fillRect(px - 4 * p.s, py - 3 * p.s, 8 * p.s, 11 * p.s);
        if (!k.reduced && Math.random() < dt * 0.06) p.flash = 1;
        if (p.flash > 0) {
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = p.flash;
          c.drawImage(glow, px - 40, py - 40, 80, 80);
          c.globalAlpha = 1;
          c.globalCompositeOperation = 'source-over';
          p.flash = Math.max(0, p.flash - dt * 6);
        }
      }
    }
  }

  function drawTaxi(dt) {
    if (!taxi) {
      if (clock > taxiAt && !k.reduced) {
        const dir = k.chance(0.5) ? 1 : -1;
        taxi = { x: dir > 0 ? -160 : sp.vw + 160, dir, v: k.rand(220, 320), honked: false };
      }
      if (!k.reduced) return;
      taxi = { x: (sp.stage.left + sp.stage.right) / 2 + 120, dir: 1, v: 0, honked: true };
    }
    taxi.x += taxi.dir * taxi.v * dt;
    if (!taxi.honked && Math.abs(taxi.x - (sp.stage.left + sp.stage.right) / 2) < 60 && k.chance(0.5)) {
      taxi.honked = true;
      k.sfx.tone({ type: 'square', freq: 415, dur: 0.12, gain: 0.04, filter: 'lowpass', freqF: 1400 });
      k.sfx.tone({ type: 'square', freq: 415, dur: 0.18, gain: 0.04, filter: 'lowpass', freqF: 1400, delay: 0.16 });
    }
    if (taxi.x < -200 || taxi.x > sp.vw + 200) { taxi = null; taxiAt = clock + k.rand(5, 10); return; }
    const s = k.clamp(street.h / 88, 0.45, 0.9);
    const x = taxi.x, y = sp.vh - 14 * s;
    c.save();
    c.translate(x, y);
    c.scale(taxi.dir * s, s);
    // headlight beam
    c.globalCompositeOperation = 'lighter';
    const beam = c.createLinearGradient(60, 0, 200, 0);
    beam.addColorStop(0, 'rgba(255,240,180,.35)');
    beam.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = beam;
    c.beginPath(); c.moveTo(62, -22); c.lineTo(220, -40); c.lineTo(220, 4); c.closePath(); c.fill();
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#e8b100';
    c.beginPath(); c.roundRect(-70, -34, 136, 26, 8); c.fill();
    c.fillStyle = '#ffc61a';
    c.beginPath(); c.moveTo(-44, -34); c.lineTo(-30, -54); c.lineTo(26, -54); c.lineTo(44, -34); c.closePath(); c.fill();
    c.fillStyle = '#1b2440';
    c.beginPath(); c.moveTo(-38, -35); c.lineTo(-27, -50); c.lineTo(-3, -50); c.lineTo(-3, -35); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(1, -35); c.lineTo(1, -50); c.lineTo(23, -50); c.lineTo(37, -35); c.closePath(); c.fill();
    c.fillStyle = '#111';
    for (let i = -56; i < 60; i += 10) c.fillRect(i, -23, 5, 4); // the checker stripe
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.arc(-40, -8, 11, 0, 7); c.arc(40, -8, 11, 0, 7); c.fill();
    c.fillStyle = '#777';
    c.beginPath(); c.arc(-40, -8, 4.5, 0, 7); c.arc(40, -8, 4.5, 0, 7); c.fill();
    c.fillStyle = '#fff6c8';
    c.fillRect(61, -30, 5, 6);
    c.fillStyle = '#ff2a2a';
    c.fillRect(-70, -30, 4, 6);
    // the roof ad, advertising the ★ (unflipped so it reads)
    const rec = ctx.question?.recommended[0];
    const ad = rec ? `★ ${k.clip(rec.toUpperCase(), 22)}` : 'OFF DUTY';
    c.scale(taxi.dir, 1);
    c.font = k.font(10, 800, 'sans');
    const tw = c.measureText(ad).width + 14;
    c.fillStyle = '#111';
    c.fillRect(-tw / 2 - 1, -71, tw + 2, 17);
    c.fillStyle = '#fffbe6';
    c.fillRect(-tw / 2, -70, tw, 15);
    c.fillStyle = '#c4001a';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(ad, 0, -62);
    c.restore();
  }

  function drawSteam(dt) {
    if (!k.reduced && Math.random() < dt * 5) steam.push({ x: sp.stage.left + sp.stage.width * 0.2 + k.rand(-8, 8), y: street.y + street.h * 0.55, r: k.rand(10, 18), a: 0, life: k.rand(2.4, 3.6), v: k.rand(18, 30) });
    for (let i = steam.length - 1; i >= 0; i--) {
      const s = steam[i];
      s.a += dt;
      if (s.a > s.life) { steam.splice(i, 1); continue; }
      const p = s.a / s.life;
      s.y -= s.v * dt;
      s.x += Math.sin(s.a * 2 + s.r) * 8 * dt;
      c.globalAlpha = Math.sin(p * Math.PI) * 0.18;
      c.drawImage(glow, s.x - s.r * (1 + p * 2), s.y - s.r * (1 + p * 2), s.r * (2 + p * 4), s.r * (2 + p * 4));
    }
    c.globalAlpha = 1;
  }

  // ── billboards, live ──────────────────────────────────────────────────

  function bulbs(b, t) {
    const step = 14;
    const pts = [];
    const x0 = b.x - 7, y0 = b.y - 7, w = b.w + 14, h = b.h + 14;
    for (let x = 0; x < w; x += step) pts.push([x0 + x, y0], [x0 + w - x, y0 + h]);
    for (let y = 0; y < h; y += step) pts.push([x0 + w, y0 + y], [x0, y0 + h - y]);
    c.globalCompositeOperation = 'lighter';
    pts.forEach(([x, y], i) => {
      const on = (i + Math.floor(t * 8)) % 3 === 0;
      c.globalAlpha = on ? 0.95 : 0.25;
      c.drawImage(glow, x - 9, y - 9, 18, 18);
    });
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  function drawBoards(dt, t) {
    for (const b of boards) {
      let img = b.spr, alpha = 1;
      if (b.broken && !k.reduced) { // a dying tube: mostly on, then a burst of stutters
        b.flick -= dt;
        if (b.flick <= 0) {
          b.mode = b.mode ? 0 : k.chance(0.5) ? 1 : 2;
          b.flick = b.mode ? k.rand(0.04, 0.12) : k.chance(0.25) ? k.rand(0.03, 0.08) : k.rand(0.6, 3);
          if (b.mode) k.sfx.tone({ type: 'sawtooth', freq: 120, dur: 0.08, gain: 0.025, filter: 'lowpass', freqF: 700 });
        }
        if (b.mode === 1) alpha = 0.18;
        if (b.mode === 2) img = b.alt || img;
      } else if (b.broken) img = b.alt || img;
      c.globalAlpha = alpha;
      c.drawImage(img, b.x - b.pad, b.y - b.pad, b.w + b.pad * 2, b.h + b.pad * 2);
      c.globalAlpha = 1;
      if (b.rec) bulbs(b, k.reduced ? 0 : t);
      if (b.label && sold.has(b.label)) stamp(b);
    }
  }

  function stamp(b) {
    c.save();
    c.translate(b.x + b.w / 2, b.y + b.h / 2);
    c.rotate(-0.14);
    const s = k.clamp(b.h * 0.32, 18, 54);
    c.font = k.font(s, 900, 'display');
    const w = c.measureText('SOLD!').width + s * 0.8;
    c.fillStyle = 'rgba(255,255,255,.95)';
    c.strokeStyle = '#e8002a';
    c.lineWidth = Math.max(3, s * 0.1);
    c.beginPath(); c.roundRect(-w / 2, -s * 0.72, w, s * 1.44, 6); c.fill(); c.stroke();
    c.fillStyle = '#e8002a';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('SOLD!', 0, 2);
    c.restore();
  }

  function layout() {
    sp = k.space();
    placeSides();
    paintCity();
    placeBoards();
    buildZip();
    placeCrowd();
  }

  // After an answer, hold the boards (and their SOLD stamps) for a moment before the next card's go up.
  let pending = null;
  function relayout() {
    const wait = 1500 - (performance.now() - answeredAt);
    if (wait <= 0) { sold = new Set(); layout(); return; }
    pending ||= k.after(wait, () => { pending = null; sold = new Set(); layout(); });
  }

  city.resized = (w, h, { dprOnly } = {}) => {
    if (!dprOnly) return layout();
    // same layout, crowd, taxi, zipper and dead tube: just re-render what was baked at the old DPR
    for (const s of sideSigns) s.paint(s);
    for (const b of boards) b.paint(b);
    if (zip) zipGrid();
    paintCity();
  };
  layout();

  k.loop((dt, t) => {
    clock += dt;
    c.clearRect(0, 0, cv.w, cv.h);
    for (const s of sideSigns) { // the panels' frosted glass turns these into colour washes
      const p = k.reduced ? 0 : (Math.sin(t * 0.7 + s.phase) + 1) / 2;
      c.globalAlpha = 1 - p;
      c.drawImage(s.a, s.x, s.y, s.w, s.h);
      c.globalAlpha = p;
      c.drawImage(s.b, s.x, s.y, s.w, s.h);
    }
    c.globalAlpha = 1;
    drawZip(dt);
    drawBoards(dt, t);
    drawSteam(dt);
    drawTaxi(dt);
    drawCrowd(dt, t);
    if (ctx.front === 'done' && !k.reduced && clock > confettiAt) { // New Year's in Times Square
      confettiAt = clock + k.rand(1.2, 2.4);
      const b = boards[0];
      if (b) k.burst(k.rand(b.x, b.x + b.w * 2), b.y - 10, { n: 40, shape: 'confetti', speed: 260, angle: Math.PI / 2, spread: 2.4, gravity: 120, drag: 1.4, life: 3, size: 9 });
    }
  }, { still: 0.5 });

  return {
    question: relayout,
    layout: relayout,
    decisions() { if (zip && zip.off < 0) buildZip(); },
    answer(a) {
      answeredAt = performance.now();
      sold = new Set(a.picks);
      const hits = boards.filter((b) => b.label && sold.has(b.label));
      for (const b of hits) k.burst(b.x + b.w / 2, b.y + b.h / 2, { n: 50, shape: 'mix', speed: 520, life: 1.6 });
      k.sfx.cheer({ gain: 0.5 });
      const what = a.picks.length ? a.picks.map((p) => `“${k.clip(p, 40)}”`).join(' AND ') : 'A WRITE-IN CANDIDATE';
      news = `JUST IN: DEVELOPER PICKS ${what}   ★   ${a.tookRec ? 'AGENT RELIEVED' : a.hasRec ? 'AGENT STUNNED. MARKETS REACT' : 'CROWD GOES MILD'}`;
      buildZip();
      zip.off = -Math.floor(zip.w / zip.led);
    },
  };
}
