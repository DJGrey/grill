// Conspiracy wall. Basement wallpaper, one bare bulb, newspaper clippings, and your decisions on
// index cards, all tied to the current question with red string. "IT ALL CONNECTS." Names and
// numbers from your decisions get circled and questioned ("WHO IS PRIYA??").

const RED = '#c1121f';
const HEADLINES = [
  'LOCAL DEV SAYS "QUICK QUESTION"', 'MEETING COULD HAVE BEEN EMAIL, SOURCES SAY', 'BACKLOG GROWS 400% OVERNIGHT', 'AREA MAN REFACTORS AGAIN',
  'JIRA TICKET FOUND ALIVE AFTER 3 YEARS', 'SPRINT ENDS. NOBODY KNOWS WHY', 'ROADMAP "MOSTLY VIBES", INSIDER CLAIMS', 'WHO MOVED THE DEADLINE?',
  'STANDUP RUNS 45 MINUTES', 'EXCLUSIVE: "IT WORKS ON MY MACHINE"', 'PM SEEN NEAR WHITEBOARD', 'THE DUCK KNEW',
];
const SCRAWL = ['coincidence??', 'WAKE UP', 'follow the ★', 'they KNOW', 'not a drill', 'ask the duck', 'WHY NOW?', '?!?'];
const WHEN = /^(January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/;
const STOP = new Set(['The', 'A', 'An', 'Only', 'Call', 'Batches', 'Approval', 'All', 'One', 'Use', 'Keep', 'Make', 'Ship', 'Finance', 'If', 'When', 'We', 'It', 'This', 'That', 'Any', 'No', 'Yes', 'Each', 'Every', 'Both']);

const off = (w, h, dpr) => {
  const el = document.createElement('canvas');
  el.width = Math.max(1, Math.ceil(w * dpr));
  el.height = Math.max(1, Math.ceil(h * dpr));
  const g = el.getContext('2d');
  g.scale(dpr, dpr);
  return { el, g };
};

export default function conspiracy(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  let wall = null;
  let cards = []; // { spr, x, y, w, h, rot, kind, pin, age, delay }
  let strings = []; // { a, b, phase, delay, age } a/b: points {x, y} or card refs
  let hub = null; // where every string goes
  let circle = null; // red marker ring being drawn around the hub
  let hudAt; // the score HUD's left edge the top scrawls were placed for
  let scrawls = []; // { text, x, y, rot, size, age, delay, color }
  let clock = 0; // seconds since the wall went up: a relayout re-pins everything at this point of the intro

  // ── text helpers ──
  function lines(g, text, w, max) { return k.wrap(g, text, w, max); }
  function typed(g, text, x, y, w, h, { size = 13, min = 8, weight = 600, family = 'mono', color = '#1d1d1d', lh = 1.25 } = {}) {
    let s = size, ls;
    for (;;) {
      g.font = k.font(s, weight, family);
      ls = lines(g, text, w, Math.max(1, Math.floor(h / (s * lh))));
      if ((ls.length * s * lh <= h && !ls.at(-1)?.endsWith('…')) || s <= min) break;
      s -= 1;
    }
    Object.assign(g, { fillStyle: color, textAlign: 'left', textBaseline: 'top' });
    ls.forEach((l, i) => g.fillText(l, x, y + i * s * lh));
    return ls.length * s * lh;
  }

  // Names and numbers in the decisions, for the scribbles.
  function suspects() {
    const out = [];
    for (const d of ctx.decisions) {
      for (const m of d.text.matchAll(/\$\d[\d,.]*\s?[kKmM]?|\b\d+(?:\.\d+)?%/g)) out.push(`FOLLOW THE ${m[0].toUpperCase().replace(/\s/g, '')}`);
      for (const m of d.text.matchAll(/(?:^|[^.!?]\s)([A-Z][a-z]{2,})\b/g)) if (!STOP.has(m[1])) out.push(`${WHEN.test(m[1]) ? 'WHY' : 'WHO IS'} ${m[1].toUpperCase()}??`);
    }
    return [...new Set(out)];
  }

  // ── sprites ──
  // `remake` redraws it at the current DPR (same picture: anything random comes from its own seed).
  function sprite(w, h, draw, shadow = 0.5) {
    const m = 20;
    const remake = () => {
      const { el, g } = off(w + m * 2, h + m * 2, cv.dpr);
      g.translate(m, m);
      g.save(); g.shadowColor = `rgba(0,0,0,${shadow})`; g.shadowBlur = 12; g.shadowOffsetY = 6; g.shadowOffsetX = 2;
      g.fillStyle = '#000'; g.fillRect(2, 2, w - 4, h - 4); g.restore();
      draw(g, w, h);
      return { el, m, w: w + m * 2, h: h + m * 2, remake };
    };
    return remake();
  }

  function indexCard(d, w, h) {
    return sprite(w, h, (g) => {
      g.fillStyle = '#fbfaf3'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(70,120,210,.35)'; g.lineWidth = 1;
      for (let y = 30; y < h; y += 15) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.strokeStyle = 'rgba(220,60,60,.5)'; g.beginPath(); g.moveTo(0, 24); g.lineTo(w, 24); g.stroke();
      Object.assign(g, { font: k.font(19, 800, 'hand'), fillStyle: RED, textAlign: 'left', textBaseline: 'middle' });
      g.fillText(d.label, 10, 13);
      typed(g, d.text, 10, 30, w - 20, h - 36, { size: Math.min(13, w / 13), min: 8 });
    });
  }

  function caseFile(q, w, h) {
    return sprite(w, h, (g) => {
      g.font = k.font(11, 800, 'mono');
      const tw = Math.min(w * 0.7, g.measureText(q.head).width + 26);
      g.save(); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 6; g.shadowOffsetY = 2; // the folder tab
      g.fillStyle = '#d9b676'; g.beginPath(); g.moveTo(0, 2); g.lineTo(4, -15); g.lineTo(tw - 6, -15); g.lineTo(tw, 2); g.fill(); g.restore();
      Object.assign(g, { fillStyle: '#5b3d12', textAlign: 'left', textBaseline: 'middle' });
      g.fillText(q.head, 12, -6);
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#e9c98c'); gr.addColorStop(1, '#d4ad6a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(120,80,30,.1)'; g.fillRect(0, 0, w, 3);
      if (q.tag) { Object.assign(g, { font: k.font(10, 700, 'mono'), fillStyle: 'rgba(91,61,18,.7)', textAlign: 'left' }); g.fillText(`RE: ${q.tag}`, 12, 24); }
      typed(g, q.title, 12, q.tag ? 36 : 22, w - 24, h - (q.tag ? 44 : 30) - 16, { size: Math.min(17, w / 13), min: 9, weight: 800, color: '#20160a' });
      g.save(); g.translate(w - 58, h - 20); g.rotate(-0.14); // stamp
      Object.assign(g, { font: k.font(13, 900, 'display'), strokeStyle: 'rgba(193,18,31,.75)', fillStyle: 'rgba(193,18,31,.75)', lineWidth: 2, textAlign: 'center', textBaseline: 'middle' });
      const sw = g.measureText(q.stamp).width + 14;
      g.strokeRect(-sw / 2, -11, sw, 22); g.fillText(q.stamp, 0, 1);
      g.restore();
    }, 0.6);
  }

  function clipping(text, w, h, R0) {
    const seed = R0.int(0, 1e9);
    return sprite(w, h, (g) => {
      const R = k.rng(seed);
      g.fillStyle = '#ebe6d9'; g.beginPath(); g.moveTo(0, 0);
      for (let x = 0; x <= w; x += 7) g.lineTo(x, R.rand(-1.5, 1.5));
      for (let y = 0; y <= h; y += 7) g.lineTo(w + R.rand(-1.5, 1.5), y);
      for (let x = w; x >= 0; x -= 7) g.lineTo(x, h + R.rand(-1.5, 1.5));
      g.closePath(); g.fill();
      const used = typed(g, text, 8, 8, w - 16, h * 0.45, { size: 16, min: 9, weight: 900, family: 'serif', color: '#111', lh: 1.1 });
      g.fillStyle = 'rgba(0,0,0,.28)';
      const cols = w > 150 ? 2 : 1, cw = (w - 16 - (cols - 1) * 8) / cols;
      for (let ci = 0; ci < cols; ci++) for (let y = used + 16; y < h - 8; y += 5) g.fillRect(8 + ci * (cw + 8), y, cw * (y > h - 14 && ci === cols - 1 ? 0.5 : R.rand(0.85, 1)), 2);
    }, 0.45);
  }

  function photo(w, R0) {
    const h = w * 1.18, seed = R0.int(0, 1e9);
    return sprite(w, h, (g) => {
      const R = k.rng(seed);
      g.fillStyle = '#f2efe6'; g.fillRect(0, 0, w, h);
      const iw = w - 12;
      const gr = g.createLinearGradient(0, 6, 0, 6 + iw);
      gr.addColorStop(0, '#4b5563'); gr.addColorStop(1, '#1f2937');
      g.fillStyle = gr; g.fillRect(6, 6, iw, iw);
      g.fillStyle = '#0b0f14'; // a figure, of course blurry
      g.beginPath(); g.arc(w / 2 + R.rand(-8, 8), 6 + iw * 0.42, iw * 0.15, 0, 7); g.fill();
      g.beginPath(); g.ellipse(w / 2, 6 + iw * 1.02, iw * 0.32, iw * 0.42, 0, Math.PI, 0); g.fill();
      Object.assign(g, { font: k.font(iw * 0.3, 900, 'hand'), fillStyle: RED, textAlign: 'center', textBaseline: 'middle' });
      g.fillText('?', w / 2 + iw * 0.25, 6 + iw * 0.3);
      Object.assign(g, { font: k.font(Math.max(10, w * 0.12), 700, 'hand'), fillStyle: '#222' });
      g.fillText(R.pick(['the PM?', 'him again', 'who??', 'Tuesday', 'the duck']), w / 2, h - (h - iw - 6) / 2);
    }, 0.5);
  }

  function sticky(text, w) {
    return sprite(w, w, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, w);
      gr.addColorStop(0, '#fff176'); gr.addColorStop(1, '#f9d94a');
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
      g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, 0, w, w * 0.14);
      const words = text.split(' ');
      Object.assign(g, { font: k.font(w * 0.2, 900, 'hand'), fillStyle: '#1a1a1a', textAlign: 'center', textBaseline: 'middle' });
      words.forEach((wd, i) => g.fillText(wd, w / 2, w * 0.56 + (i - (words.length - 1) / 2) * w * 0.22));
      g.strokeStyle = RED; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(w * 0.18, w * 0.88); g.quadraticCurveTo(w * 0.5, w * 0.82, w * 0.84, w * 0.9); g.stroke();
    }, 0.4);
  }

  // ── the wall ──
  function makeWall() {
    const { el, g } = off(cv.w, cv.h, 1);
    const R = k.rng(23);
    g.fillStyle = '#5d6148'; g.fillRect(0, 0, cv.w, cv.h);
    for (let x = 0; x < cv.w; x += 46) { // faded stripes
      g.fillStyle = 'rgba(255,240,200,.05)'; g.fillRect(x, 0, 23, cv.h);
      g.fillStyle = 'rgba(40,40,20,.12)'; g.fillRect(x + 22, 0, 2, cv.h);
    }
    for (let x = 12; x < cv.w; x += 46) for (let y = 14; y < cv.h; y += 40) { // little fleur motif
      g.fillStyle = 'rgba(230,220,170,.07)'; g.beginPath(); g.arc(x + ((y / 40) % 2) * 23, y, 4, 0, 7); g.fill();
    }
    for (let i = 0; i < 14; i++) { // water stains
      const x = R.rand(cv.w), y = R.rand(cv.h), r = R.rand(40, 160);
      const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      gr.addColorStop(0, 'rgba(80,60,20,0)'); gr.addColorStop(0.85, 'rgba(80,60,20,.08)'); gr.addColorStop(1, 'rgba(80,60,20,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < cv.w * cv.h / 300; i++) { g.fillStyle = `rgba(0,0,0,${R.rand(0.03, 0.1)})`; g.fillRect(R.rand(cv.w), R.rand(cv.h), 1.5, 1.5); }
    return el;
  }

  function scrawl(g, s) {
    g.save(); g.translate(s.x, s.y); g.rotate(s.rot);
    Object.assign(g, { font: k.font(s.size, 800, 'hand'), fillStyle: s.color, textAlign: 'center', textBaseline: 'middle' });
    g.fillText(s.text, 0, 0);
    g.restore();
  }

  // ── layout ──
  function build(animate) {
    wall ||= makeWall();
    const sp = k.space();
    const R = k.rng(`${ctx.question?.id || ctx.front}:${ctx.decisions.length}`);
    const q = ctx.question;
    if (animate) clock = 0;
    const age = k.reduced ? 9 : clock;
    cards = []; strings = []; scrawls = [];
    const add = (cd) => { cd.age = age; cd.thunk = age - (cd.delay || 0) >= 0.35; cards.push(cd); return cd; };
    const ds = ctx.decisions.map((d, i) => ({ key: `d:${d.id || d.n || i}:${d.text.slice(0, 20)}`, label: `D${d.n ?? i + 1}`, text: d.text }));
    const sus = suspects();
    const deck = R.shuffle(HEADLINES);
    let hi = 0;
    const headline = () => deck[hi++ % deck.length];

    const gap = sp.gaps.find((g) => g.where !== 'top' && g.w >= 300 && g.h >= 110);
    const visible = [];
    hub = null;
    if (gap) {
      const qw = Math.min(270, gap.w * 0.36), qh = Math.min(gap.h - 40, 150, qw * 0.6);
      const hx = gap.x + gap.w / 2, hy = gap.y + gap.h / 2 + 6;
      const head = q ? `CASE Q${q.n}/${q.total}` : ctx.front === 'done' ? 'CASE CLOSED' : 'CASE ???';
      const nd = ctx.decisions.length || ctx.answers.length;
      const info = ctx.front === 'done'
        ? { head, tag: 'FINAL', title: `${nd > 1 ? `${nd} decisions` : nd ? 'One decision' : 'Every decision'}. One truth. It was all connected.`, stamp: 'SOLVED' }
        : q ? { head, tag: k.clip((q.tag || '').toUpperCase(), 14), title: q.title, stamp: 'UNRESOLVED' }
          : { head, tag: 'PENDING', title: ctx.agent === 'listening' ? 'The agent is listening. Act natural.' : 'What is the agent writing in there?', stamp: 'REDACTED' };
      hub = add({ key: `q:${q?.id || ctx.front}`, kind: 'q', spr: caseFile(info, qw, qh), x: hx, y: hy, w: qw, h: qh, rot: R.rand(-0.03, 0.03), delay: 0.1 });
      const side = (gap.w - qw) / 2 - 30;
      const dw = Math.min(200, side - 10);
      let dh = Math.min(112, dw * 0.6);
      if (dw >= 110) {
        const rows = gap.h >= 2 * 80 + 50 ? 2 : 1;
        dh = Math.min(dh, rows === 2 ? (gap.h - 50) / 2 : gap.h - 30);
        const slots = [];
        for (let r = 0; r < rows; r++) for (const s of [-1, 1]) slots.push({ x: hx + s * (qw / 2 + 20 + side / 2), y: rows === 1 ? hy : gap.y + 20 + dh / 2 + r * (dh + 16) + (gap.h - 40 - dh * 2 - 16) / 2 });
        slots.sort((a, b) => a.y - b.y || a.x - b.x);
        const items = ds.length ? ds.slice(-slots.length) : [];
        slots.forEach((s, i) => {
          const d = items[i];
          const cd = d
            ? { key: d.key, kind: 'd', spr: indexCard(d, dw, dh), w: dw, h: dh }
            : { key: `c:${i}:${R.int(0, 1e6)}`, kind: 'c', spr: clipping(headline(), dw, dh, R), w: dw, h: dh };
          visible.push(add({ ...cd, x: s.x + R.rand(-6, 6), y: s.y + R.rand(-3, 3), rot: R.rand(-0.045, 0.045), delay: 0.3 + i * 0.12 }));
        });
      }
      const st = Math.min(84, qh * 0.62);
      add({ key: 'sticky', kind: 's', spr: sticky(ctx.front === 'done' ? 'I WAS RIGHT' : 'IT ALL CONNECTS', st), x: hx + qw / 2 - st * 0.42, y: hy - qh / 2 - st * 0.02, w: st, h: st, rot: 0.1, delay: 0.9, nostring: true });
    }
    if (!hub) { // no room under the card: everything is strung to the card itself
      const cr = sp.card;
      const p = cr ? { x: cr.left + cr.width / 2, y: cr.bottom - 30 } : { x: cv.w / 2, y: cv.h / 2 };
      hub = { x: p.x, y: p.y, w: 0, h: 0, rot: 0, pin: true };
    }
    // the rest of the wall: older decisions and clippings outside the gaps (blurred under the panels)
    const taken = [...cards, ...(sp.card ? [{ x: sp.card.left + sp.card.width / 2, y: sp.card.top + sp.card.height / 2, w: sp.card.width + 20, h: sp.card.height + 20 }] : [])];
    const clash = (x, y, w, h) => taken.some((t) => Math.abs(t.x - x) < (t.w + w) / 2 + 14 && Math.abs(t.y - y) < (t.h + h) / 2 + 14);
    const rest = ds.filter((d) => !visible.some((v) => v.key === d.key));
    const extras = [...rest.map((d) => ({ d })), ...Array.from({ length: 10 }, () => ({}))];
    let tries = 0;
    for (const ex of extras) {
      for (; tries < 400; tries++) {
        const kind = ex.d ? 'd' : R.pick(['c', 'c', 'p']);
        const w = kind === 'p' ? R.rand(84, 110) : R.rand(150, 200), h = kind === 'p' ? w * 1.18 : w * 0.62;
        const x = R.rand(w / 2, cv.w - w / 2), y = R.rand(h / 2, cv.h - h / 2);
        if (clash(x, y, w, h)) continue;
        const spr = kind === 'd' ? indexCard(ex.d, w, h) : kind === 'p' ? photo(w, R) : clipping(headline(), w, h, R);
        const cd = add({ key: ex.d?.key || `x:${tries}`, kind, spr, x, y, w, h, rot: R.rand(-0.12, 0.12), delay: 0, far: true });
        taken.push(cd);
        break;
      }
    }
    // strings: every card to the hub, plus a few between clippings
    const far = cards.filter((cd) => cd.far);
    cards.forEach((cd, i) => {
      if (cd === hub || cd.nostring) return;
      if (cd.kind === 'd' || !cd.far || R.chance(0.5)) strings.push({ a: cd, b: hub, phase: R.rand(6), delay: (cd.delay || 0) + 0.35 + i * 0.03, age });
    });
    for (let i = 0; i < Math.min(4, far.length - 1); i++) strings.push({ a: far[i], b: far[(i + 3) % far.length], phase: R.rand(6), delay: 0, age: 9 });
    for (const s of strings) s.twang = s.age - s.delay >= 0.5;
    // scribbles: in the top gap and around the hub
    const words = [...sus, ...R.shuffle(SCRAWL)];
    const top = sp.gaps.find((g) => g.where === 'top' && g.h >= 30 && g.w >= 200);
    if (top) scrawls.push({ text: words[0], x: top.x + top.w * R.rand(0.25, 0.4), y: top.y + top.h / 2 + 2, rot: R.rand(-0.06, 0.04), size: Math.min(24, top.h * 0.5), color: RED, delay: 1.2 });
    if (top && words[1]) {
      const size = Math.min(20, top.h * 0.42);
      c.font = k.font(size, 800, 'hand');
      const room = sp.hud ? sp.hud.left - 14 - c.measureText(words[1]).width / 2 : Infinity; // clear of the score HUD
      scrawls.push({ text: words[1], x: Math.min(top.x + top.w * R.rand(0.68, 0.8), room), y: top.y + top.h / 2 + 2, rot: R.rand(-0.04, 0.08), size, color: '#f2efe6', delay: 1.5 });
    }
    hudAt = sp.hud?.left;
    if (gap && hub.spr && gap.h > hub.h + 70) scrawls.push({ text: words[2] || '?!', x: hub.x - hub.w * 0.15, y: hub.y + hub.h / 2 + 22, rot: -0.04, size: 17, color: '#f2efe6', delay: 1.8 });
    for (const s of scrawls) s.age = age;
    if (animate) circle = null;
  }

  function pinXY(cd) { return cd.spr ? { x: cd.x + Math.sin(cd.rot) * (cd.h / 2 - 8), y: cd.y - Math.cos(cd.rot) * (cd.h / 2 - 8) } : { x: cd.x, y: cd.y }; }

  function drawPin(x, y, col = RED) {
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(x + 3, y + 4, 5, 3.5, 0.4, 0, 7); c.fill();
    const gr = c.createRadialGradient(x - 1.5, y - 2, 0.5, x, y, 6);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, col); gr.addColorStop(1, '#3a0508');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, 5.5, 0, 7); c.fill();
  }

  function drawString(s, t, dt) {
    s.age += dt;
    const p = k.clamp((s.age - s.delay) / 0.5);
    if (p <= 0) return;
    if (!s.twang && p >= 1 && s.delay > 0.1) { s.twang = true; k.sfx.tone({ type: 'triangle', freq: k.rand(180, 260), to: 150, dur: 0.18, gain: 0.05 }); }
    const A = pinXY(s.a), B = pinXY(s.b);
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    const sag = Math.min(60, len * 0.08 + 6) * (1 - (1 - p) * 0.8) + Math.sin(t * 0.9 + s.phase) * 2.5;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 + sag;
    const e = k.ease.outCubic(p);
    const qx = (u) => (1 - u) ** 2 * A.x + 2 * (1 - u) * u * mx + u * u * B.x;
    const qy = (u) => (1 - u) ** 2 * A.y + 2 * (1 - u) * u * my + u * u * B.y;
    const path = (dx, dy) => { c.beginPath(); c.moveTo(A.x + dx, A.y + dy); for (let i = 1; i <= 24; i++) { const u = (i / 24) * e; c.lineTo(qx(u) + dx, qy(u) + dy); } };
    c.lineCap = 'round';
    path(2, 4); c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 2.2; c.stroke();
    path(0, 0); c.strokeStyle = '#a10d18'; c.lineWidth = 2.2; c.stroke();
    path(-0.4, -0.6); c.strokeStyle = 'rgba(255,110,110,.45)'; c.lineWidth = 0.8; c.stroke();
  }

  function drawCard(cd, dt) {
    cd.age += dt;
    const p = k.clamp((cd.age - (cd.delay || 0)) / 0.35);
    if (p <= 0) return false;
    if (!cd.thunk && p >= 1 && cd.delay) { cd.thunk = true; k.sfx.clack({ pitch: k.rand(0.55, 0.75), gain: 0.4 }); }
    const s = 1 + (1 - k.ease.outBack(p)) * 0.12;
    c.save(); c.translate(cd.x, cd.y - (1 - p) * 16); c.rotate(cd.rot); c.scale(s, s); c.globalAlpha = k.clamp(p * 2);
    c.drawImage(cd.spr.el, -cd.w / 2 - cd.spr.m, -cd.h / 2 - cd.spr.m, cd.spr.w, cd.spr.h);
    c.restore();
    return true;
  }

  // The red marker ring around the case file, scrawled on after you answer.
  function drawCircle(dt) {
    if (!circle || !hub?.spr) return;
    circle.age += dt;
    const p = k.ease.inOutQuad(k.clamp(circle.age / 0.7));
    const rx = hub.w * 0.58, ry = hub.h * 0.64;
    c.save(); c.translate(hub.x, hub.y); c.rotate(-0.06);
    c.strokeStyle = 'rgba(214,20,32,.85)'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i <= 60 * p; i++) { const a = -2.2 + (i / 60) * Math.PI * 2.25, w = 1 + Math.sin(i * 0.7) * 0.02 + i * 0.0015; i ? c.lineTo(Math.cos(a) * rx * w, Math.sin(a) * ry * w) : c.moveTo(Math.cos(a) * rx * w, Math.sin(a) * ry * w); }
    c.stroke();
    c.restore();
  }

  cv.resized = (w, h, { dprOnly } = {}) => {
    if (dprOnly) { for (const cd of cards) if (cd.spr) cd.spr = cd.spr.remake(); return; } // the wall is 1x, the rest keeps going
    wall = null;
    build(false);
  };
  build(!k.reduced);

  k.loop((dt, t) => {
    clock += dt;
    c.drawImage(wall, 0, 0, cv.w, cv.h);
    for (const s of strings) if (s.a.far) drawString(s, t, dt); // strings from far away go under the near cards
    for (const cd of cards) drawCard(cd, dt);
    drawCircle(dt);
    for (const s of strings) if (!s.a.far) drawString(s, t, dt);
    for (const cd of cards) if (!cd.nostring && cd.age > (cd.delay || 0)) { const p = pinXY(cd); drawPin(p.x, p.y, cd.kind === 'q' ? '#1d4ed8' : RED); }
    if (hub && !hub.spr) drawPin(hub.x, hub.y, '#1d4ed8');
    for (const s of scrawls) {
      s.age += dt;
      const p = k.clamp((s.age - s.delay) / 0.4);
      if (p <= 0) continue;
      c.globalAlpha = p;
      scrawl(c, s);
      c.globalAlpha = 1;
    }
    // one bare bulb, swinging a little
    const lx = cv.w * 0.5 + Math.sin(t * 0.6) * cv.w * 0.04, ly = -40;
    const gr = c.createRadialGradient(lx, ly + cv.h * 0.35, 40, lx, ly + cv.h * 0.4, Math.max(cv.w, cv.h) * 0.8);
    gr.addColorStop(0, 'rgba(255,220,150,.12)'); gr.addColorStop(0.45, 'rgba(0,0,0,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.62)');
    c.fillStyle = gr; c.fillRect(0, 0, cv.w, cv.h);
  }, { still: 3 });

  return {
    question() { build(!k.reduced); },
    layout() { build(false); },
    event(name) { if (name === 'stat' && k.space().hud?.left !== hudAt) build(false); },
    status() { if (ctx.front === 'waiting') build(false); },
    decisions() { build(!k.reduced); },
    answer(a) {
      circle = { age: k.reduced ? 9 : 0 };
      k.sfx.noise({ dur: 0.5, filter: 'bandpass', freq: 3000, q: 2, gain: 0.08 }); // marker squeak
      const text = !a.picks?.length ? 'THEY WANT US TO WRITE IT' : a.tookRec ? 'I KNEW IT' : a.hasRec ? 'THEY DON\'T WANT YOU TO KNOW' : 'CONFIRMED';
      if (hub?.spr) scrawls.push({ text, x: hub.x, y: hub.y - hub.h / 2 - 20, rot: -0.05, size: 22, color: '#ff3b3b', delay: 0.5, age: k.reduced ? 9 : 0 });
    },
  };
}
