// The grill. A top-down barbecue: sausages, corn and skewers cook on the grate, the flames grow the
// longer you sit on a card, smoke drifts up and the chef's order ticket keeps score. Answers flip the food.

const BAR = 30; // grate pitch, so grill marks line up with the bars
const MEAT = [[0, [222, 132, 124]], [0.25, [205, 112, 80]], [0.55, [168, 80, 40]], [0.8, [112, 52, 26]], [1, [58, 32, 22]], [1.25, [26, 20, 18]]];
const CORN = [[0, [250, 222, 102]], [0.45, [240, 196, 70]], [0.8, [196, 140, 46]], [1.1, [92, 62, 30]], [1.3, [40, 30, 22]]];
const LEVELS = [[0.34, 'RARE'], [0.5, 'MEDIUM'], [0.72, 'JUST RIGHT'], [0.92, 'WELL DONE'], [1.12, 'CHARCOAL'], [9, 'CREMATED']];
const BURNT = 1.6; // doneness stops here: nothing looks any different past it
const MAX_PUFFS = 140, MAX_FLAMES = 520;
const QUIPS = [
  [20, 'Fresh on the grill.'],
  [60, 'Smells amazing. No rush.'],
  [120, 'Chef suggests the ★. Chef always suggests the ★.'],
  [180, 'Getting a bit crispy over here.'],
  [240, 'The sausages have started asking questions.'],
  [360, 'Smoke alarm says: just pick one.'],
  [1e9, 'This is charcoal now. You are the grill.'],
];

const mix = (stops, d) => {
  let i = 1;
  while (i < stops.length - 1 && d > stops[i][0]) i++;
  const [d0, a] = stops[i - 1], [d1, b] = stops[i];
  const t = Math.min(1, Math.max(0, (d - d0) / (d1 - d0)));
  return a.map((v, j) => v + (b[j] - v) * t);
};
const rgb = (c, f = 1, a = 1) => `rgba(${c.map((v) => Math.round(Math.min(255, v * f))).join(',')},${a})`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const CSS = `
.bbq-t{position:absolute;width:212px;padding:14px 15px 18px;box-sizing:border-box;background:#fbf7ec;color:#2b2622;font:500 11.5px/1.35 ui-monospace,"SF Mono",Menlo,Consolas,monospace;border-radius:2px 2px 0 0;box-shadow:0 14px 28px rgba(0,0,0,.55),0 2px 4px rgba(0,0,0,.4);transform-origin:50% -10px;transition:left .5s cubic-bezier(.2,.8,.2,1),top .5s cubic-bezier(.2,.8,.2,1);
  background-image:repeating-linear-gradient(0deg,transparent 0 17px,rgba(80,120,170,.07) 17px 18px);
  -webkit-mask:linear-gradient(#000,#000) top/100% calc(100% - 6px) no-repeat,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/10px 6px repeat-x;
  mask:linear-gradient(#000,#000) top/100% calc(100% - 6px) no-repeat,conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/10px 6px repeat-x}
.bbq-clip{position:absolute;left:50%;top:-11px;width:46px;height:16px;margin-left:-23px;border-radius:3px 3px 2px 2px;background:linear-gradient(#c9ccd1,#7d8289 55%,#5b6066);box-shadow:0 2px 3px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.6)}
.bbq-clip:after{content:"";position:absolute;left:8px;right:8px;top:-7px;height:8px;border:2px solid #9aa0a7;border-bottom:0;border-radius:6px 6px 0 0}
.bbq-hd{display:flex;justify-content:space-between;font-weight:800;font-size:12.5px;letter-spacing:.06em}
.bbq-tag{margin-top:1px;color:#8a7f72;font-size:10px;letter-spacing:.14em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bbq-q{margin:7px 0 6px;font:700 13px/1.28 ui-sans-serif,-apple-system,"Segoe UI",sans-serif;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.bbq-o{margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#4a433c}
.bbq-o.rec{color:#b3261e;font-weight:700}
.bbq-hr{margin:8px 0 7px;border-top:1.5px dashed #b9ad9c}
.bbq-row{display:flex;justify-content:space-between;align-items:center;font-weight:700;letter-spacing:.05em}
.bbq-m{display:flex;gap:3px;margin:6px 0 2px}
.bbq-m i{flex:1;height:7px;border-radius:1px;background:#e4dccd}
.bbq-lv{font-size:10px;letter-spacing:.12em;font-weight:800}
.bbq-quip{margin-top:7px;font:italic 500 12px/1.3 "Bradley Hand","Segoe Print","Chalkboard SE","Comic Sans MS",cursive;color:#3c4f9a}
.bbq-stamp{position:absolute;left:50%;top:44%;padding:3px 10px;border:3px solid #c62a1f;border-radius:4px;color:#c62a1f;font:900 22px/1 Impact,"Arial Black",sans-serif;letter-spacing:.08em;white-space:nowrap;transform:translate(-50%,-50%) rotate(-14deg);opacity:0;mix-blend-mode:multiply;pointer-events:none}
.bbq-t.small .bbq-opts,.bbq-t.tiny .bbq-quip,.bbq-t.tiny .bbq-tag,.bbq-t.tiny .bbq-hr{display:none}.bbq-t.tiny .bbq-q{-webkit-line-clamp:2;margin:4px 0 6px}
`;

export default function bbq(k, ctx) {
  const coal = k.canvas({ alpha: false });
  const fire = k.canvas({ dpr: 1 });
  const grate = k.canvas();
  const food = k.canvas();
  const air = k.canvas({ dpr: 1 }); // flare-ups, sparks and smoke
  k.el('style', { text: CSS });
  k.el('div', { style: 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 75% 70% at 50% 50%,transparent 55%,rgba(0,0,0,.55))' });
  const tk = k.el('div', { class: 'bbq-t' });
  const sprites = makeSprites();

  let items = [];
  let glows = [], flames = [];
  let sparks = [], puffs = [], flares = [];
  let cardBox = null;
  let fan = 0; // typing fans the flames
  let sizzle = null;
  let lastSec = -1, lastQuip = '';
  let served = false;
  let lastQ = ctx.question?.id;

  // ── static layers ─────────────────────────────────────────────────────────

  function drawCoal(w, h) {
    const c = coal.ctx;
    const r = k.rng(11);
    c.fillStyle = '#0c0807';
    c.fillRect(0, 0, w, h);
    const n = Math.ceil((w * h) / 800);
    for (let i = 0; i < n; i++) {
      const x = r.rand(-20, w + 20), y = r.rand(-20, h + 20), s = r.rand(18, 34), hot = r.next();
      c.save();
      c.translate(x, y);
      c.rotate(r.rand(6.28));
      const g = c.createRadialGradient(-s * 0.15, -s * 0.15, 1, 0, 0, s * 0.6);
      if (hot > 0.8) {
        g.addColorStop(0, `rgb(240,${90 + hot * 50 | 0},26)`);
        g.addColorStop(0.5, '#8e2408');
        g.addColorStop(1, '#22100b');
      } else {
        g.addColorStop(0, hot > 0.5 ? '#5a3a30' : '#3e3632');
        g.addColorStop(0.6, '#211b19');
        g.addColorStop(1, '#0d0a09');
      }
      c.fillStyle = g;
      c.beginPath();
      c.roundRect(-s / 2, -s * 0.38, s, s * 0.76, s * 0.32);
      c.fill();
      c.fillStyle = `rgba(215,205,195,${hot > 0.8 ? 0.3 : 0.14})`; // ash
      for (let j = 0; j < 5; j++) {
        c.beginPath();
        c.ellipse(r.rand(-s * 0.35, s * 0.3), r.rand(-s * 0.3, s * 0.05), r.rand(2, s * 0.24), r.rand(1.5, s * 0.12), r.rand(3), 0, 6.28);
        c.fill();
      }
      if (hot > 0.88) { // glowing cracks
        c.strokeStyle = 'rgba(255,200,90,.7)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(-s * 0.3, r.rand(-3, 3));
        for (let j = 0; j < 4; j++) c.lineTo(-s * 0.3 + (j + 1) * s * 0.15, r.rand(-s * 0.2, s * 0.2));
        c.stroke();
      }
      c.restore();
    }
  }

  function drawGrate(w, h) {
    const c = grate.ctx;
    const r = k.rng(5);
    c.clearRect(0, 0, w, h);
    for (let y = 140; y < h; y += 320) { // cross supports, under the bars
      c.fillStyle = 'rgba(0,0,0,.45)';
      c.fillRect(0, y + 6, w, 16);
      const g = c.createLinearGradient(0, y - 7, 0, y + 7);
      g.addColorStop(0, '#0e0e0e'); g.addColorStop(0.4, '#55514d'); g.addColorStop(1, '#0d0d0d');
      c.fillStyle = g;
      c.fillRect(0, y - 7, w, 14);
    }
    for (let x = BAR / 2; x < w + BAR; x += BAR) {
      c.fillStyle = 'rgba(0,0,0,.42)';
      c.fillRect(x + 2, 0, 9, h);
    }
    const bar = c.createLinearGradient(-5, 0, 5, 0);
    [[0, '#0b0b0b'], [0.22, '#3b3936'], [0.42, '#9b958d'], [0.55, '#5a5652'], [0.85, '#232120'], [1, '#090909']].forEach(([o, col]) => bar.addColorStop(o, col));
    for (let x = BAR / 2; x < w + BAR; x += BAR) {
      c.save();
      c.translate(x, 0);
      c.fillStyle = bar;
      c.fillRect(-5, 0, 10, h);
      for (let j = 0; j < 6; j++) { // heat tint and old grease
        const y = r.rand(h), l = r.rand(30, 160);
        c.fillStyle = r.pick(['rgba(120,90,200,.14)', 'rgba(200,150,60,.12)', 'rgba(0,0,0,.35)', 'rgba(255,255,255,.06)']);
        c.fillRect(-4, y, 8, l);
      }
      c.restore();
    }
  }

  // ── sprites for fire and smoke ────────────────────────────────────────────

  function makeSprites() {
    const mk = (w, h, fn) => {
      const e = document.createElement('canvas');
      e.width = w; e.height = h;
      fn(e.getContext('2d'), w, h);
      return e;
    };
    const flame = mk(48, 112, (c, w, h) => {
      c.beginPath();
      c.moveTo(w / 2, 0);
      c.bezierCurveTo(w * 0.62, h * 0.3, w, h * 0.5, w * 0.92, h * 0.74);
      c.bezierCurveTo(w * 0.84, h * 0.98, w * 0.16, h * 0.98, w * 0.08, h * 0.74);
      c.bezierCurveTo(0, h * 0.5, w * 0.38, h * 0.3, w / 2, 0);
      const g = c.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, 'rgba(255,240,190,1)');
      g.addColorStop(0.22, 'rgba(255,200,70,1)');
      g.addColorStop(0.5, 'rgba(255,110,20,.9)');
      g.addColorStop(0.8, 'rgba(220,40,10,.55)');
      g.addColorStop(1, 'rgba(160,20,0,0)');
      c.fillStyle = g;
      c.fill();
      const core = c.createRadialGradient(w / 2, h * 0.8, 1, w / 2, h * 0.78, w * 0.4);
      core.addColorStop(0, 'rgba(255,255,230,.9)');
      core.addColorStop(1, 'rgba(255,255,200,0)');
      c.fillStyle = core;
      c.fill();
    });
    const soft = (rgbs) => mk(128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, `rgba(${rgbs},1)`);
      g.addColorStop(0.45, `rgba(${rgbs},.55)`);
      g.addColorStop(1, `rgba(${rgbs},0)`);
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    });
    return { flame, glow: soft('255,96,20'), smoke: soft('205,200,196'), soot: soft('40,34,32') };
  }

  // ── food ──────────────────────────────────────────────────────────────────

  const MAKE = {
    sausage: (r) => ({ len: r.rand(132, 158), th: r.rand(30, 34), bend: r.rand(-4, 4) }),
    corn: (r) => ({ len: r.rand(140, 156), th: 42, bend: 0 }),
    skewer: (r) => ({ len: r.rand(190, 210), th: 28, bend: 0, bits: Array.from({ length: 7 }, () => r.pick(['pepper', 'onion', 'chicken', 'zucchini', 'pepper', 'chicken', 'mushroom'])) }),
  };

  function makeItem(type, x, y, ang, r) {
    const it = { type, ...MAKE[type](r), x, y, tx: x, ty: y, ang, seed: r.int(1, 1e6), flip: -1, glint: [], spr: null };
    const c0 = r.rand(0.2, 0.3);
    it.up = { c: c0, marks: c0 + 0.08, seed: r.int(1, 1e6) }; // the side you see
    it.down = { c: c0 + 0.06, marks: c0 + 0.12, seed: r.int(1, 1e6) };
    it.ph = r.rand(BAR);
    return it;
  }

  // Where the food goes: a cooked-to-order arrangement in the biggest gap, and more food all over
  // the rest of the grill so the frosted panels glow with it.
  function arrange() {
    const sp = k.space();
    cardBox = sp.card && { x: sp.card.left - 30, y: sp.card.top - 40, w: sp.card.width + 60, h: sp.card.height + 70 };
    const r = k.rng(`bbq${ctx.question?.id || ctx.front}`);
    const gap = sp.gaps.find((g) => g.where === 'bottom' && g.h > 110) || sp.gaps[0] || { x: sp.stage.x, y: sp.stage.y, w: sp.stage.width, h: sp.stage.height };
    const tkW = 212;
    const tkX = gap.x + gap.w - tkW - Math.max(18, Math.min(60, gap.w * 0.06));
    placeTicket(tkX, gap);
    const main = { x: gap.x + 10, y: gap.y + 8, w: (tk.style.visibility === 'hidden' ? gap.x + gap.w - 10 : tkX - 20) - gap.x - 10, h: gap.h - 20 };
    const plan = [
      ['sausage', 0.19, 0.2, -0.04], ['sausage', 0.21, 0.52, 0.03], ['sausage', 0.18, 0.84, -0.02],
      ['corn', 0.62, 0.24, 0.05], ['skewer', 0.64, 0.74, -0.03],
    ];
    const scale = Math.max(0.7, Math.min(1.2, main.w / 500, main.h / 200));
    const want = [];
    for (const [type, fx, fy, ang] of plan) {
      const it = MAKE[type](r);
      if (main.w * fx - (it.len * scale) / 2 < -20 || main.w * fx + (it.len * scale) / 2 > main.w + 30) continue;
      want.push({ type, x: main.x + main.w * fx, y: main.y + main.h * fy, ang, scale, main: true });
    }
    const free = (x, y, pad) => !(cardBox && x > cardBox.x - pad && x < cardBox.x + cardBox.w + pad && y > cardBox.y - pad && y < cardBox.y + cardBox.h + pad)
      && !want.some((w) => Math.abs(w.x - x) < 120 && Math.abs(w.y - y) < 46)
      && !(tk.style.visibility !== 'hidden' && x > tkX - 100 && x < tkX + tkW + 100 && y > gap.y && y < gap.y + tk.offsetHeight + 60);
    for (let y = 30; y < sp.vh + 40; y += 76) {
      for (let x = 70 + ((y / 76) % 2) * 90; x < sp.vw + 60; x += 200) {
        const px = x + r.rand(-30, 30), py = y + r.rand(-14, 14);
        if (free(px, py, 70)) want.push({ type: r.pick(['sausage', 'sausage', 'sausage', 'corn', 'skewer']), x: px, y: py, ang: r.rand(-0.1, 0.1), scale: 1 });
      }
    }
    // reuse what's already cooking (so revisits and resizes keep the doneness), make the rest
    const old = items;
    items = want.map((w) => {
      const it = old.find((o) => o.type === w.type && !o.taken && !!o.main === !!w.main) || makeItem(w.type, w.x, w.y, w.ang, r);
      it.taken = true;
      const len = it.len * w.scale;
      const base = BAR / 2 + len / 2 - it.ph * w.scale;
      it.tx = Math.round((w.x - base) / BAR) * BAR + base;
      it.ty = w.y;
      it.ang = w.ang;
      it.scale = w.scale;
      it.main = !!w.main;
      if (!old.includes(it) || k.reduced) { it.x = it.tx; it.y = it.ty; }
      return it;
    });
    for (const it of items) {
      it.taken = false;
      if (ctx.front === 'done') { it.up.c = it.down.c = 0.64; it.up.marks = it.down.marks = 0.9; } // order up: all perfect
    }
    seedFire(sp);
  }

  function seedFire(sp) {
    const r = k.rng(3);
    glows = [];
    flames = [];
    let lit = [];
    for (let i = 0; i < (sp.vw * sp.vh) / 70000; i++) glows.push({ x: r.rand(sp.vw), y: r.rand(sp.vh), s: r.rand(200, 380), f: r.rand(0.6, 1.6), p: r.rand(6.28) });
    const st = sp.stage;
    for (let x = BAR; x < sp.vw; x += BAR) {
      const under = x < st.left || x > st.right; // under the frosted panels: blurred anyway, so fewer
      for (let y = r.rand(10, 40); y < sp.vh + 40; y += r.rand(34, 80) * (under ? 1.8 : 1)) {
        if (cardBox && x > cardBox.x + 20 && x < cardBox.x + cardBox.w - 20 && y > cardBox.y + 40 && y < cardBox.y + cardBox.h - 10) continue;
        lit.push({ x: x + r.rand(-3, 3), y, s: r.rand(0.5, 1.4), w: r.rand(0.8, 1.2), dx: r.rand(-3, 3), th: r.next(), p: r.rand(100), f: r.rand(7, 13), under });
      }
    }
    if (lit.length > MAX_FLAMES) lit = r.shuffle(lit).slice(0, MAX_FLAMES); // big screens: thin the bed out evenly ('lighter' doesn't care about order)
    flames = lit;
  }

  // Each piece of food is pre-drawn to its own sprite and redrawn as it browns.
  function sprite(it) {
    const side = it.up;
    const dpr = food.dpr; // a DPR step (zoom, the watchdog) redraws it crisp at the new one
    if (it.spr && Math.abs(it.spr.c - side.c) < 0.02 && it.spr.side === side && it.spr.dpr === dpr) return it.spr;
    const pad = 60;
    const W = it.len + pad * 2, H = it.th + pad * 2;
    const e = it.spr?.el.width === Math.ceil(W * dpr) ? it.spr.el : document.createElement('canvas');
    e.width = Math.ceil(W * dpr); e.height = Math.ceil(H * dpr);
    const g = e.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, W * dpr / 2, H * dpr / 2);
    g.clearRect(-W, -H, W * 2, H * 2);
    DRAW[it.type](g, it, side, k.rng(side.seed));
    const sh = it.spr?.dpr === dpr ? it.spr.shadow : shadowOf(it, W, H, dpr);
    it.spr = { el: e, c: side.c, side, W, H, shadow: sh, dpr };
    return it.spr;
  }

  function shadowOf(it, W, H, dpr) {
    const e = document.createElement('canvas');
    e.width = Math.ceil(W * dpr); e.height = Math.ceil(H * dpr);
    const g = e.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, W * dpr / 2, H * dpr / 2);
    g.shadowColor = 'rgba(0,0,0,.7)';
    g.shadowBlur = 12 * dpr;
    g.shadowOffsetX = 4000 * dpr;
    g.lineCap = 'round';
    g.lineWidth = it.th * 0.92;
    g.strokeStyle = '#000';
    g.beginPath();
    g.moveTo(-4000 - it.len / 2 + it.th / 2, 0);
    g.quadraticCurveTo(-4000, it.bend * 2, -4000 + it.len / 2 - it.th / 2, 0);
    g.stroke();
    return e;
  }

  const body = (g, it, col, light = 1) => {
    const L = it.len / 2 - it.th / 2, b = it.bend * 2;
    const tube = (wid, dy, style, from = 1) => {
      g.strokeStyle = style;
      g.lineWidth = wid;
      g.beginPath();
      g.moveTo(-L * from, dy + b * (1 - from * from) * 0.5);
      g.quadraticCurveTo(0, b + dy, L * from, dy + b * (1 - from * from) * 0.5);
      g.stroke();
    };
    g.lineCap = 'round';
    tube(it.th, 0, rgb(col, 0.5));
    tube(it.th * 0.84, -it.th * 0.04, rgb(col, 0.82));
    tube(it.th * 0.6, -it.th * 0.08, rgb(col));
    tube(it.th * 0.34, -it.th * 0.14, rgb(col, 1.12 * light));
    return tube;
  };

  const marks = (g, it, side, w = 6) => {
    const a = Math.min(1, Math.max(0, (side.marks - 0.12) * 1.6));
    if (a <= 0) return;
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.lineCap = 'butt';
    for (let u = -it.len / 2 + it.ph; u < it.len / 2 + 4; u += BAR) {
      g.strokeStyle = `rgba(40,16,6,${a * 0.35})`;
      g.lineWidth = w + 6;
      g.beginPath(); g.moveTo(u, -it.th); g.lineTo(u, it.th); g.stroke();
      g.strokeStyle = `rgba(22,10,6,${a * 0.85})`;
      g.lineWidth = w;
      g.beginPath(); g.moveTo(u, -it.th); g.lineTo(u, it.th); g.stroke();
    }
    g.restore();
  };

  const char = (g, it, side, r, n) => { // black blisters once it's overdone
    const a = Math.max(0, side.c - 0.75) * 2.2;
    if (a <= 0) return;
    g.save();
    g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < n; i++) {
      g.fillStyle = `rgba(14,10,8,${Math.min(0.85, a * r.rand(0.4, 1))})`;
      g.beginPath();
      g.ellipse(r.rand(-it.len / 2, it.len / 2), r.rand(-it.th / 2, it.th / 2), r.rand(3, 10) * Math.min(1.6, a + 0.5), r.rand(2, 6), r.rand(3), 0, 6.28);
      g.fill();
    }
    g.restore();
  };

  const DRAW = {
    sausage(g, it, side, r) {
      const col = mix(MEAT, side.c);
      const tube = body(g, it, col);
      g.save(); // pinched ends
      for (const s of [-1, 1]) {
        g.fillStyle = rgb(col, 0.55);
        g.beginPath();
        g.ellipse(s * (it.len / 2 - 1), it.bend * 0.6, 4.5, 3.2, 0, 0, 6.28);
        g.fill();
      }
      g.restore();
      marks(g, it, side);
      char(g, it, side, r, 10);
      g.save();
      g.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 9; i++) { // skin wrinkles
        g.strokeStyle = `rgba(60,20,10,${0.12 + side.c * 0.1})`;
        g.lineWidth = 1;
        const u = r.rand(-it.len / 2.4, it.len / 2.4);
        g.beginPath(); g.moveTo(u, -it.th * 0.42); g.quadraticCurveTo(u + r.rand(-4, 4), 0, u + r.rand(-3, 3), it.th * 0.1); g.stroke();
      }
      g.restore();
      tube(it.th * 0.12, -it.th * 0.25, `rgba(255,236,220,${0.5 * (1 - Math.min(1, side.c) * 0.55)})`, 0.62); // shine
      tube(it.th * 0.05, -it.th * 0.27, `rgba(255,255,255,${0.55 * (1 - Math.min(1, side.c) * 0.5)})`, 0.35);
    },
    corn(g, it, side, r) {
      const col = mix(CORN, side.c);
      const L = it.len / 2;
      g.save(); // husk
      for (const [a, l, w, cc] of [[-0.5, 46, 14, '#a9b45c'], [0.45, 50, 13, '#c3c27a'], [0.05, 58, 15, '#d8cf93']]) {
        g.save();
        g.translate(-L + 10, 0);
        g.rotate(Math.PI + a);
        const hg = g.createLinearGradient(0, -w, 0, w);
        hg.addColorStop(0, rgb([...hexes(cc)], 1.08)); hg.addColorStop(1, rgb([...hexes(cc)], 0.7 - side.c * 0.2));
        g.fillStyle = hg;
        g.beginPath();
        g.moveTo(0, -w / 2);
        g.quadraticCurveTo(l * 0.6, -w * 0.8, l, 0);
        g.quadraticCurveTo(l * 0.6, w * 0.7, 0, w / 2);
        g.fill();
        g.strokeStyle = 'rgba(90,80,30,.35)';
        g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(l * 0.5, -w * 0.12, l - 4, 0); g.stroke();
        g.restore();
      }
      g.restore();
      body(g, it, col, 1.03);
      g.save();
      g.globalCompositeOperation = 'source-atop';
      for (let row = -4; row <= 4; row++) {
        const th = (row / 4.7) * (Math.PI / 2);
        const y = Math.sin(th) * it.th * 0.47;
        const kh = Math.cos(th) * 5.2 + 0.6;
        for (let u = -L + 4 + (row & 1) * 3.5; u < L - 2; u += 7) {
          const burnt = r.next() < Math.max(0, side.c - 0.35) * 0.9;
          const f = (1.1 - Math.abs(row) * 0.07) * (burnt ? 0.45 : 1);
          g.fillStyle = rgb(col, f);
          g.beginPath();
          g.roundRect(u - 3, y - kh / 2, 6, kh, 2);
          g.fill();
          if (row < 0 && !burnt) {
            g.fillStyle = 'rgba(255,255,230,.35)';
            g.fillRect(u - 1.5, y - kh / 2 + 0.5, 2.5, Math.max(0.6, kh * 0.3));
          }
        }
      }
      g.restore();
      marks(g, it, side, 5);
      char(g, it, side, r, 6);
      if (side === it.up && side.c < 0.9) { // a pat of butter, melting
        const s = 13 * (1 - side.c * 0.9);
        g.save();
        g.translate(r.rand(-L * 0.3, L * 0.3), -3);
        g.rotate(0.3);
        g.fillStyle = 'rgba(255,230,120,.55)';
        g.beginPath(); g.ellipse(0, 2, s * 1.3, s * 0.7, 0, 0, 6.28); g.fill();
        g.fillStyle = '#fff3b8';
        g.beginPath(); g.roundRect(-s / 2, -s / 2, s, s * 0.8, 2.5); g.fill();
        g.fillStyle = 'rgba(255,255,255,.8)';
        g.fillRect(-s / 2 + 2, -s / 2 + 1.5, s * 0.4, 1.6);
        g.restore();
      }
    },
    skewer(g, it, side, r) {
      const L = it.len / 2;
      g.lineCap = 'round';
      g.strokeStyle = rgb([196, 152, 98], 1 - side.c * 0.3);
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(-L - 16, 0); g.lineTo(L + 12, 0); g.stroke();
      g.strokeStyle = 'rgba(255,240,210,.5)';
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(-L - 14, -1); g.lineTo(-L + 4, -1); g.stroke();
      const n = it.bits.length;
      const step = (it.len - 10) / n;
      it.bits.forEach((b, i) => {
        const x = -L + 5 + step * (i + 0.5);
        const brown = Math.min(0.85, side.c * 0.75);
        g.save();
        g.translate(x, r.rand(-1.5, 1.5));
        g.rotate(r.rand(-0.25, 0.25));
        const s = step * 0.5 + 1;
        const fill = (base, path) => {
          g.fillStyle = rgb(base, 0.6);
          path(1.0); g.fill();
          g.fillStyle = rgb(base);
          path(0.84, -1.2); g.fill();
          g.fillStyle = `rgba(70,32,12,${brown})`;
          path(1.0); g.fill();
        };
        const box = (rx, ry, rad) => (f, dy = 0) => { g.beginPath(); g.roundRect(-rx * f, -ry * f + dy, rx * 2 * f, ry * 2 * f, rad); };
        const blob = (rx, ry) => (f, dy = 0) => { g.beginPath(); g.ellipse(0, dy, rx * f, ry * f, 0, 0, 6.28); };
        if (b === 'pepper') {
          fill(r.pick([[214, 44, 34], [236, 170, 30], [70, 150, 50]]), box(s, 12, 4));
          g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-s + 3, -9, s * 0.6, 2);
        } else if (b === 'onion') {
          fill([236, 214, 230], box(s * 0.9, 11, 5));
          g.strokeStyle = 'rgba(150,60,130,.55)'; g.lineWidth = 1.2;
          for (const o of [3, 6]) { g.beginPath(); g.roundRect(-s * 0.9 + o, -11 + o, s * 1.8 - o * 2, 22 - o * 2, 4); g.stroke(); }
        } else if (b === 'chicken') {
          fill([232, 196, 150], blob(s * 1.05, 12.5));
        } else if (b === 'zucchini') {
          fill([70, 120, 46], blob(s * 0.75, 12.5));
          g.fillStyle = `rgba(222,232,170,${1 - brown * 0.6})`;
          g.beginPath(); g.ellipse(0, -1, s * 0.5, 9, 0, 0, 6.28); g.fill();
        } else {
          fill([190, 160, 128], (f, dy = 0) => { g.beginPath(); g.ellipse(0, dy, s * 0.95 * f, 12 * f, 0, Math.PI, 0); g.lineTo(s * 0.4 * f, 8 * f + dy); g.lineTo(-s * 0.4 * f, 8 * f + dy); g.closePath(); });
        }
        g.restore();
      });
      marks(g, it, side, 5);
    },
  };
  const hexes = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  // ── the ticket ────────────────────────────────────────────────────────────

  function placeTicket(x, gap) {
    const y = gap.y + (gap.h > 240 ? 26 : 14);
    tk.style.left = `${x}px`;
    tk.style.top = `${y}px`;
    tk.classList.remove('small', 'tiny');
    renderTicket(true);
    const room = gap.y + gap.h - y - 10;
    if (tk.offsetHeight > room) tk.classList.add('small');
    if (tk.offsetHeight > room) tk.classList.add('tiny');
    tk.style.visibility = gap.w < 420 || room < 110 ? 'hidden' : '';
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[ch]};`);

  function level(c) {
    const i = LEVELS.findIndex(([v]) => c < v);
    return i < 0 ? LEVELS.length - 1 : i;
  }

  function renderTicket(full) {
    const q = ctx.question;
    const t = q ? ctx.cardTime : 0;
    const sec = Math.floor(t);
    const avg = items.filter((i) => i.main).reduce((s, i, _, a) => s + (i.up.c + i.down.c) / 2 / a.length, 0) || 0.2;
    const lv = level(avg);
    let quip = QUIPS.find(([s]) => t < s)[1];
    if (q && !q.recommended.length && quip.includes('★')) quip = 'Chef has no opinion. Chef is worried.';
    if (q?.revising) quip = 'Sent back to the kitchen. Fair enough.';
    if (!full && sec === lastSec && quip === lastQuip) return;
    lastSec = sec;
    lastQuip = quip;
    const clock = new Date().toTimeString().slice(0, 5);
    const meter = `<div class="bbq-m">${[0, 1, 2, 3, 4].map((i) => `<i style="${i <= Math.min(4, lv) ? `background:${['#d98b80', '#c06a3c', '#9a4e22', '#5a2f18', '#1e1714'][Math.min(4, lv)]}` : ''}"></i>`).join('')}</div>`;
    let html;
    if (q) {
      const opts = q.options.slice(0, 4).map((o) => `<div class="bbq-o${o.recommended ? ' rec' : ''}">${o.recommended ? '★' : '○'} ${esc(o.label)}</div>`).join('')
        + (q.options.length > 4 ? `<div class="bbq-o">+ ${q.options.length - 4} side${q.options.length === 5 ? '' : 's'}</div>` : '');
      html = `<div class="bbq-hd"><span>${q.revising ? 'REFIRE' : 'ORDER'} #${q.n}</span><span>${clock}</span></div>
        <div class="bbq-tag">${esc((q.tag || 'TABLE').toUpperCase())} · ${q.n} OF ${q.total}</div>
        <div class="bbq-q">${esc(q.title)}</div>
        <div class="bbq-opts">${opts || '<div class="bbq-o">○ chef\'s choice (write it in)</div>'}</div>
        <div class="bbq-hr"></div>
        <div class="bbq-row"><span>ON THE GRILL</span><span>${mmss(t)}</span></div>
        ${meter}<div class="bbq-lv">${LEVELS[lv][1]}</div>
        <div class="bbq-quip">${esc(quip)}</div>`;
    } else if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      const recs = ctx.recRate == null ? '' : ` Chef's picks: ${Math.round(ctx.recRate * 100)}%.`;
      html = `<div class="bbq-hd"><span>ORDER UP</span><span>${clock}</span></div>
        <div class="bbq-tag">${esc(ctx.doc?.title?.toUpperCase() || 'ALL TABLES')}</div>
        <div class="bbq-q">${n ? `${n} decision${n === 1 ? '' : 's'}` : 'Every decision'}, grilled to perfection.</div>
        <div class="bbq-hr"></div>
        <div class="bbq-row"><span>DONENESS</span><span>✓</span></div>
        <div class="bbq-m">${'<i style="background:#9a4e22"></i>'.repeat(5)}</div><div class="bbq-lv">CHEF'S KISS</div>
        <div class="bbq-quip">${esc(`Tips appreciated.${recs}`)}</div>`;
    } else {
      html = `<div class="bbq-hd"><span>ORDER #${(ctx.progress?.answered ?? 0) + 1}</span><span>${clock}</span></div>
        <div class="bbq-tag">${ctx.agent === 'listening' ? 'KITCHEN IS LISTENING' : 'IN THE KITCHEN'}</div>
        <div class="bbq-q">Chef is prepping your next question…</div>
        <div class="bbq-hr"></div>
        <div class="bbq-row"><span>STATUS</span><span>MARINATING</span></div>
        <div class="bbq-quip">Help yourself to a sausage while you wait.</div>`;
    }
    tk.innerHTML = `<div class="bbq-clip"></div>${html}<div class="bbq-stamp"></div>`;
    tk.style.transform = `rotate(${(k.hash(String(q?.id || ctx.front)) % 50) / 10 - 2.5}deg)`;
  }

  // ── motion ────────────────────────────────────────────────────────────────

  // how much a side facing the coals has cooked after t seconds on a card (the heat ramps up over 4 minutes)
  const cooked = (t) => 0.0028 * t + 0.0042 * (t < 240 ? (t * t) / 480 : 120 + t - 240);
  let cookedAt = null;

  const heat = () => (ctx.front === 'question' ? k.clamp(ctx.cardTime / 240) : ctx.front === 'done' ? 0.1 : 0.2);

  function flipAll() {
    items.filter((it) => k.rect(k.ui.stage()) && it.flip < 0).forEach((it, i) => {
      k.after((it.main ? 0 : 300) + i * (it.main ? 110 : 15), () => { it.flip = 0; });
    });
    if (k.reduced) for (const it of items) [it.up, it.down] = [it.down, it.up];
    k.sfx.whoosh({ gain: 0.25, pitch: 1.3 });
  }

  function land(it) {
    for (let i = 0; i < 9; i++) sparks.push({ x: it.x + k.rand(-it.len / 2, it.len / 2) * it.scale, y: it.y + k.rand(-8, 8), vx: k.rand(-60, 60), vy: k.rand(-160, -60), life: k.rand(0.4, 0.9), age: 0, hot: 1 });
    puffs.push(puff(it.x, it.y - 6, 0.16, false));
    if (it.main) k.sfx.sizzle({ dur: 0.7, gain: 0.5, pitch: k.rand(0.9, 1.15) });
  }

  const puff = (x, y, a, dark) => ({ x, y, vx: k.rand(-6, 16), vy: k.rand(-60, -34), r: k.rand(18, 30), grow: k.rand(22, 40), age: 0, life: k.rand(4, 7), a, dark, p: k.rand(6.28) });

  function step(dt, t) {
    const h = heat();
    fan = Math.max(0, fan - dt * 0.8);
    const hot = Math.min(1.2, 0.14 + h * 0.86 + fan * 0.25);

    // fire under the grate
    const f = fire.ctx;
    f.clearRect(0, 0, fire.w, fire.h);
    f.globalCompositeOperation = 'lighter';
    for (const g of glows) {
      f.globalAlpha = (0.16 + hot * 0.3) * (0.65 + 0.35 * Math.sin(t * g.f + g.p));
      f.drawImage(sprites.glow, g.x - g.s / 2, g.y - g.s / 2, g.s, g.s);
    }
    for (const fl of flames) {
      const on = k.clamp((hot - fl.th) * 5);
      if (on <= 0) continue;
      const fl1 = Math.sin(t * fl.f + fl.p) * 0.5 + Math.sin(t * fl.f * 1.7 + fl.p * 2) * 0.3 + Math.sin(t * 3.1 + fl.p) * 0.2;
      const hh = 26 * fl.s * (0.45 + hot * 1.35) * (0.8 + fl1 * 0.22) * on;
      const ww = Math.min(24, 10 + hh * 0.2) * fl.w;
      f.globalAlpha = (0.3 + on * 0.3);
      f.setTransform(1, 0, Math.sin(t * 2.3 + fl.p) * 0.22, 1, fl.x, fl.y);
      f.drawImage(sprites.flame, -ww * 0.65, -hh * 1.12, ww * 1.3, hh * 1.12);
      if (fl.under) continue; // the hot inner tongue: blurred to nothing under the frosted panels
      const h2 = hh * (0.62 + 0.18 * Math.sin(t * fl.f * 1.3 + fl.p * 3));
      f.globalAlpha = 0.5 + on * 0.5;
      f.setTransform(1, 0, Math.sin(t * 3.1 + fl.p * 2) * 0.3, 1, fl.x + fl.dx, fl.y);
      f.drawImage(sprites.flame, -ww * 0.36, -h2, ww * 0.72, h2);
    }
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalAlpha = 1;
    f.globalCompositeOperation = 'source-over';

    // the food
    const c = food.ctx;
    c.clearRect(0, 0, food.w, food.h);
    const T = ctx.front === 'question' ? ctx.cardTime : 0;
    const F = cooked(T);
    const rate = cookedAt === null || F < cookedAt ? 0 : F - cookedAt;
    cookedAt = F;
    for (const it of items) {
      it.x += (it.tx - it.x) * Math.min(1, dt * 6);
      it.y += (it.ty - it.y) * Math.min(1, dt * 6);
      it.down.c = Math.min(BURNT, it.down.c + rate); it.down.marks = Math.min(BURNT, it.down.marks + rate * 1.2);
      it.up.c = Math.min(BURNT, it.up.c + rate * 0.45);
      let sy = 1, lift = 0;
      if (it.flip >= 0) {
        const was = it.flip;
        it.flip = Math.min(1, it.flip + dt / 0.55);
        if (was < 0.5 && it.flip >= 0.5) [it.up, it.down] = [it.down, it.up];
        sy = Math.abs(Math.cos(Math.PI * it.flip));
        lift = Math.sin(Math.PI * it.flip);
        if (it.flip >= 1) { it.flip = -1; land(it); }
      }
      const s = sprite(it);
      const jig = Math.sin(t * 31 + it.seed) * 0.25 * (0.3 + h);
      c.save();
      c.translate(it.x, it.y);
      c.rotate(it.ang);
      c.scale(it.scale, it.scale);
      c.globalAlpha = 1 - lift * 0.5;
      c.drawImage(s.shadow, -s.W / 2 + 3 + lift * 6, -s.H / 2 + 6 + lift * 10, s.W, s.H);
      c.globalAlpha = 1;
      c.translate(0, -lift * 26 + jig);
      c.scale(1 + lift * 0.12, (1 + lift * 0.12) * Math.max(0.04, sy));
      c.drawImage(s.el, -s.W / 2, -s.H / 2, s.W, s.H);
      // sizzle glints: fat spitting on the skin
      if (!k.reduced && Math.random() < dt * (2 + h * 6) && it.flip < 0) it.glint.push({ u: k.rand(-0.4, 0.4) * it.len, v: k.rand(-0.35, 0.1) * it.th, age: 0 });
      for (let i = it.glint.length - 1; i >= 0; i--) {
        const gl = it.glint[i];
        gl.age += dt;
        if (gl.age > 0.35) { it.glint.splice(i, 1); continue; }
        c.fillStyle = `rgba(255,250,235,${(1 - gl.age / 0.35) * 0.8})`;
        c.beginPath(); c.arc(gl.u, gl.v, 1.2 + gl.age * 6, 0, 6.28); c.fill();
      }
      c.restore();
      if (!k.reduced && puffs.length < MAX_PUFFS && Math.random() < dt * (0.4 + h * 1.2 + k.clamp(it.up.c - 0.8, 0, 0.4) * 2) * (it.main ? 1.8 : 0.5)) {
        puffs.push(puff(it.x + k.rand(-0.3, 0.3) * it.len * it.scale, it.y - 8, 0.3 + h * 0.2, it.down.c > 1.05));
      }
      if (h > 0.6 && !k.reduced && it.main && Math.random() < dt * (h - 0.6) * 3) {
        flares.push({ x: it.x + k.rand(-0.35, 0.35) * it.len * it.scale, y: it.y + 6, age: 0, life: k.rand(0.6, 1.3), s: k.rand(0.8, 1.4) });
      }
    }

    // flare-ups, sparks and smoke
    const a = air.ctx;
    a.clearRect(0, 0, air.w, air.h);
    if (!k.reduced && Math.random() < dt * (1 + hot * 9)) {
      const fl = flames[(Math.random() * flames.length) | 0];
      if (fl) sparks.push({ x: fl.x + k.rand(-4, 4), y: fl.y - 10, vx: k.rand(-20, 20), vy: k.rand(-140, -60), life: k.rand(0.8, 1.8), age: 0, hot: k.rand(0.6, 1) });
    }
    a.globalCompositeOperation = 'lighter';
    for (let i = flares.length - 1; i >= 0; i--) {
      const fl = flares[i];
      fl.age += dt;
      if (fl.age > fl.life) { flares.splice(i, 1); continue; }
      const p = fl.age / fl.life;
      const hh = 70 * fl.s * Math.sin(Math.PI * Math.min(1, p * 1.3)) * (0.85 + 0.15 * Math.sin(fl.age * 40));
      a.globalAlpha = 0.85;
      a.drawImage(sprites.flame, fl.x - hh * 0.22, fl.y - hh, hh * 0.44, hh);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age > s.life) { sparks.splice(i, 1); continue; }
      s.vx += Math.sin(s.age * 9 + i) * 40 * dt;
      s.vy -= 30 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const p = 1 - s.age / s.life;
      a.globalAlpha = p * (0.6 + 0.4 * Math.sin(s.age * 50 + i));
      a.fillStyle = s.hot > 0.8 ? '#fff1b0' : '#ffae3a';
      a.fillRect(s.x - 1, s.y - 1, 2.2, 2.2);
    }
    a.globalCompositeOperation = 'source-over';
    if (!k.reduced && puffs.length < MAX_PUFFS && Math.random() < dt * (1 + h * 3)) puffs.push(puff(k.rand(air.w), k.rand(air.h * 0.3, air.h + 40), 0.16 + h * 0.14, h > 0.85 && k.chance(0.5)));
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.age += dt;
      if (p.age > p.life || p.y < -200) { puffs.splice(i, 1); continue; }
      p.x += (p.vx + Math.sin(p.age * 0.9 + p.p) * 10) * dt;
      p.y += p.vy * dt;
      p.r += p.grow * dt;
      const u = p.age / p.life;
      a.globalAlpha = p.a * Math.min(1, u * 5) * (1 - u);
      a.drawImage(p.dark ? sprites.soot : sprites.smoke, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    a.globalAlpha = 1;
    if (!served) renderTicket(false);
  }

  // A still frame: let it cook a while, with smoke and a flare-up or two already in the air. The
  // smoke is aged by hand, so the loop only needs a frame or two to settle.
  function still() {
    for (const it of items) { it.up.c += 0.12 + heat() * 0.4; it.down.c += 0.2 + heat() * 0.5; it.down.marks += 0.2; }
    const S = 2.5; // seconds of drift
    const aged = (p, age) => Object.assign(p, { age: age + S, x: p.x + p.vx * S, y: p.y + p.vy * S, r: p.r + p.grow * S });
    for (let i = 0; i < 26; i++) puffs.push(aged(puff(k.rand(air.w), k.rand(air.h), 0.1, false), k.rand(1, 3)));
    for (const it of items.filter((i) => i.main)) for (let i = 0; i < 2; i++) puffs.push(aged(puff(it.x + k.rand(-40, 40), it.y - k.rand(10, 70), 0.12, false), k.rand(0.6, 2.4)));
  }

  function sound(on) { // a whisper of sizzle, and none at all in a hidden tab
    sizzle?.stop(0.4);
    sizzle = on && !document.hidden ? k.sfx.sizzle({ dur: Infinity, gain: 0.12 }) : null;
  }
  k.on(document, 'visibilitychange', () => sound(k.sfx.on));

  coal.resized = drawCoal;
  grate.resized = drawGrate;
  drawCoal(coal.w, coal.h);
  drawGrate(grate.w, grate.h);
  arrange();
  if (k.reduced) still();
  if (k.sfx.on) sound(true);
  if (k.reduced) tk.style.transition = 'none';
  const L = k.loop(step, { still: 0.05 });
  if (k.reduced) k.every(2000, () => L.redraw()); // no motion, but the ticket clock ticks and the food still browns

  return {
    question() {
      served = false;
      if (ctx.question && !ctx.question.revising && ctx.question.id !== lastQ) items = []; // a new order: fresh food
      lastQ = ctx.question?.id;
      arrange();
      k.after(500, arrange); // again once the new card has settled
      k.after(1100, arrange);
      renderTicket(true);
      if (!k.reduced) k.animate(tk, [{ transform: `${tk.style.transform} translateY(-24px)`, opacity: 0.3 }, { transform: tk.style.transform, opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    },
    layout: arrange,
    status() { if (!ctx.question) renderTicket(true); },
    decisions() { if (ctx.front === 'done') renderTicket(true); },
    answer(a) {
      served = true;
      flipAll();
      fan = 1;
      const st = tk.querySelector('.bbq-stamp');
      if (st) {
        st.textContent = a.custom && !a.picks?.length ? "CHEF'S SPECIAL" : a.tookRec ? 'SERVED ★' : a.hasRec ? 'OFF MENU' : 'SERVED';
        k.animate(st, [{ opacity: 0, transform: 'translate(-50%,-50%) rotate(-14deg) scale(2.2)' }, { opacity: 0.9, transform: 'translate(-50%,-50%) rotate(-14deg) scale(1)' }], { duration: 260, delay: 250, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
        k.sfx.thud({ gain: 0.5, delay: 0.5 });
      }
    },
    keystroke() {
      fan = Math.min(1, fan + 0.05);
      if (!k.reduced && flames.length) {
        const fl = flames[(Math.random() * flames.length) | 0];
        sparks.push({ x: fl.x, y: fl.y - 10, vx: k.rand(-30, 30), vy: k.rand(-180, -90), life: 1.2, age: 0, hot: 1 });
      }
    },
    sound,
  };
}
