// Ransom note. Under a desk lamp, the question is glued onto a sheet one magazine letter at a time,
// crooked, with a demand underneath. The magazines on the desk have holes where the letters were.
// The scissors snip while you type. Answering gets a reply glued on.

const STYLES = [ // paper, ink, family, weight, extra
  ['#ffffff', '#111', 'serif', 800, ''],
  ['#ffffff', '#c1121f', 'display', 900, ''],
  ['#111111', '#ffffff', 'sans', 900, ''],
  ['#f4e04d', '#111', 'sans', 900, ''],
  ['#e63946', '#ffffff', 'display', 900, ''],
  ['#2a7de1', '#ffffff', 'sans', 800, 'italic'],
  ['#e9e4d8', '#222', 'serif', 700, 'italic'],
  ['#ff8fab', '#3a0ca3', 'serif', 900, ''],
  ['#7bd389', '#0b3d20', 'display', 900, ''],
  ['#fefae0', '#111', 'mono', 800, ''],
  ['#ffffff', '#111', 'hand', 700, ''],
  ['#ffb703', '#111', 'serif', 900, ''],
  ['#1d3557', '#f1faee', 'serif', 800, ''],
  ['#f1faee', '#e63946', 'sans', 900, 'italic'],
];
const MAGS = [['VOGUISH', '#d62828'], ['TECH WEEKLY', '#1d4ed8'], ['CAT FANCIER', '#7c3aed'], ['GARDEN TODAY', '#2d6a4f'], ['YACHTING', '#0e7490'], ['BEIGE', '#a16207']];

const off = (w, h, dpr) => {
  const el = document.createElement('canvas');
  el.width = Math.max(1, Math.ceil(w * dpr));
  el.height = Math.max(1, Math.ceil(h * dpr));
  const g = el.getContext('2d');
  g.scale(dpr, dpr);
  return { el, g };
};

export default function ransomNote(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  const measure = off(1, 1, 1).g;
  let desk = null; // wood, magazines, lamp light: baked per layout
  let note = null; // { sheet, x, y, w, h, rot, letters, age, in }
  let leaving = [];
  let scissors = null; // { x, y, rot, s, snap }
  let scraps = [];
  const fontOf = (st, size) => `${st[4] ? 'italic ' : ''}${k.font(size, st[3], st[2])}`;

  // ── what the note says ──
  function words() {
    const q = ctx.question;
    const say = (title, demand, sign = 'SIGNED, THE AGENT') => ({ title, demand, sign });
    if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      return say('You did everything we asked', `${n} decision${n === 1 ? '' : 's'}. The roadmap will be released unharmed`, 'SIGNED, THE AGENT. PLEASURE DOING BUSINESS');
    }
    if (!q) return say('We have your plan', ctx.agent === 'listening' ? 'Stay by the keyboard. We are listening' : 'Questions will follow. Do not call anyone', 'SIGNED, THE AGENT');
    const title = q.title.length > 110 ? k.clip(q.title.replace(/\s+\S*$/, ''), 108) : q.title;
    const rec = q.recommended[0];
    if (!q.options.length) return say(title, 'Tell us everything. In your own words. No cops', 'SIGNED, THE AGENT');
    if (!rec) return say(title, `Pick one. You have ${q.options.length} option${q.options.length === 1 ? '' : 's'} and no time`, 'SIGNED, THE AGENT');
    return say(title, `Pick "${k.clip(rec, 42)}" and nobody gets hurt`, q.multi ? 'SIGNED, THE AGENT. P.S. PICK SEVERAL' : 'SIGNED, THE AGENT');
  }

  // ── one cut-out letter, as a little sprite with its own jagged edge and shadow ──
  // Sprites carry `remake`, which redraws the same picture at the current DPR (randomness comes from their own seed).
  function clipping(ch, st, size, R0) {
    const seed = R0.int(0, 1e9);
    const remake = () => cut(ch, st, size, k.rng(seed), remake);
    return remake();
  }

  function cut(ch, st, size, R, remake) {
    const f = fontOf(st, size);
    measure.font = f;
    const tw = Math.max(measure.measureText(ch).width, size * 0.35);
    const px = size * R.rand(0.1, 0.22), py = size * R.rand(0.04, 0.16);
    const w = tw + px * 2, h = size * 1.08 + py * 2, m = 6;
    const { el, g } = off(w + m * 2, h + m * 2, cv.dpr);
    g.translate(m, m);
    const pts = [];
    const edge = (x0, y0, x1, y1) => { for (let i = 0; i < 3; i++) { const t = i / 3; pts.push([x0 + (x1 - x0) * t + R.rand(-1.2, 1.2), y0 + (y1 - y0) * t + R.rand(-1.2, 1.2)]); } };
    edge(0, 0, w, 0); edge(w, 0, w, h); edge(w, h, 0, h); edge(0, h, 0, 0);
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 3; g.shadowOffsetX = 1; g.shadowOffsetY = 1.5;
    g.fillStyle = st[0]; g.fill(); g.restore();
    g.save(); g.clip();
    if (R.chance(0.25)) { // magazine halftone
      g.fillStyle = 'rgba(0,0,0,.08)';
      for (let y = 1; y < h; y += 3) for (let x = (y % 2) * 1.5; x < w; x += 3) g.fillRect(x, y, 1, 1);
    }
    if (R.chance(0.15)) { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,.15)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    Object.assign(g, { font: f, fillStyle: st[1], textAlign: 'center', textBaseline: 'middle' });
    g.fillText(ch, w / 2, h / 2 + size * 0.05);
    g.restore();
    return { el, w: w + m * 2, h: h + m * 2, cw: w, ch: h, remake };
  }

  // Lays out title, demand and sign-off at base size S. Returns null if it won't fit in W×H.
  function compose(text, W, H, S, R) {
    const parts = [[text.title, 1, 0.3], [text.demand, 0.66, 0.55], [text.sign, 0.44, 0.85]].filter((p) => p[0]);
    const lines = [];
    let y = 0;
    for (const [str, rel, upper] of parts) {
      const size = Math.max(9, S * rel);
      const glyphs = [...str].map((ch) => {
        const st = R.pick(STYLES);
        const g = /[a-z]/i.test(ch) && R.chance(upper) ? ch.toUpperCase() : ch;
        measure.font = fontOf(st, size);
        return { ch: g, st, size, w: g === ' ' ? size * 0.42 : Math.max(measure.measureText(g).width, size * 0.35) + size * 0.32 };
      });
      const wordsOf = [];
      let cur = [];
      for (const g of glyphs) { if (g.ch === ' ') { if (cur.length) wordsOf.push(cur); cur = []; } else cur.push(g); }
      if (cur.length) wordsOf.push(cur);
      let line = [], lw = 0;
      const flush = () => { if (line.length) { lines.push({ glyphs: line, w: lw, y, size }); y += size * 1.32; } line = []; lw = 0; };
      for (const wd of wordsOf) {
        const ww = wd.reduce((a, g) => a + g.w, 0);
        if (ww > W) return null;
        if (lw && lw + size * 0.42 + ww > W) flush();
        if (lw) { line.push({ ch: ' ', w: size * 0.42 }); lw += size * 0.42; }
        line.push(...wd); lw += ww;
      }
      flush();
      y += size * 0.35;
    }
    return y - S * 0.2 <= H ? { lines, h: y } : null;
  }

  function build(animate) {
    const sp = k.space();
    const gap = sp.gaps.find((g) => g.where !== 'top' && g.w >= 260 && g.h >= 130) || sp.gaps.find((g) => g.where === 'bottom' && g.h >= 40) || sp.gaps[0];
    if (!gap) { note = null; return; }
    const peek = gap.h < 130;
    let w = Math.min(gap.w - 48, 820), h = peek ? 240 : Math.min(gap.h - 34, 460);
    const x = gap.x + gap.w / 2;
    const R = k.rng(`${ctx.question?.id || ctx.front}:${ctx.decisions.length}`);
    const text = words();
    const iw = w - 44, ih = (peek ? Math.max(60, gap.h - 30) : h) - 34;
    let layout = null;
    // biggest letters that fit; on a small sheet the sign-off goes first, then the demand
    const tries = [[text, 20], [{ ...text, sign: '' }, 16], [{ ...text, sign: '' }, 12], [{ title: text.title }, 12], [{ title: k.clip(text.title, 40) }, 12]];
    for (const [t, min] of tries) {
      for (let S = 44; S >= min && !layout; S -= 2) layout = compose(t, iw, ih, S, k.rng(R.int(0, 1e9)));
      if (layout) break;
    }
    layout ||= { lines: [], h: 0 };
    if (!peek && layout.lines.length) { // shrink the sheet to the words
      w = Math.min(w, Math.max(...layout.lines.map((l) => l.w)) + 90);
      h = Math.min(h, Math.max(150, layout.h + 64));
    }
    const y = peek ? gap.y + 14 + h / 2 : gap.y + gap.h / 2 + 4;
    const letters = [];
    let i = 0;
    const top = -h / 2 + 18 + (peek ? 0 : Math.max(0, (h - 34 - layout.h) / 2));
    for (const ln of layout.lines) {
      let lx = -ln.w / 2 + R.rand(-6, 6);
      for (const g of ln.glyphs) {
        if (g.ch !== ' ') {
          const spr = clipping(g.ch, g.st, g.size * R.rand(0.9, 1.12), R);
          letters.push({ spr, x: lx + g.w / 2, y: top + ln.y + ln.size * 0.62 + R.rand(-3, 3), rot: R.rand(-0.16, 0.16), at: 0.5 + i++ * k.clamp(2.2 / layout.lines.reduce((a, l) => a + l.glyphs.length, 0), 0.02, 0.07) });
        }
        lx += g.w;
      }
    }
    const old = note;
    // a relayout keeps the clock: the gluing carries on where it was, and glued letters don't clack again
    note = { sheet: sheet(w, h, R), x, y, w, h, rot: R.rand(-0.025, 0.025), letters, age: animate ? 0 : old ? old.age : 9, extra: old && !animate ? old.extra : null };
    if (animate && old) leaving.push({ ...old, vy: 0, vr: k.rand(-0.4, 0.4), t: 0 });
    const tg = sp.gaps.find((g) => g.where === 'top' && g.h >= 36 && g.w >= 260);
    scissors = tg ? { x: tg.x + tg.w - 110, y: tg.y + tg.h / 2 + 2, rot: -0.25, s: Math.min(1, tg.h / 60), snap: 0 } : { x: x + w / 2 - 30, y: y + Math.min(h, gap.h - 20) / 2 - 18, rot: -2.6, s: 0.9, snap: 0 };
    desk = makeDesk(sp, { x: x - w / 2, y: y - h / 2, w, h }, tg);
    if (k.reduced) note.age = 99;
    for (const L of letters) L.stuck = note.age - L.at >= 0.22;
  }

  // The sheet: cheap paper, a fold, a little crumple, shadow baked in.
  function sheet(w, h, R0) {
    const seed = R0.int(0, 1e9);
    const remake = () => paper(w, h, k.rng(seed), remake);
    return remake();
  }

  function paper(w, h, R, remake) {
    const m = 30;
    const { el, g } = off(w + m * 2, h + m * 2, cv.dpr);
    g.translate(m, m);
    g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 22; g.shadowOffsetY = 10;
    g.fillStyle = '#f3efe4'; g.fillRect(0, 0, w, h); g.restore();
    let gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#fbf8ef'); gr.addColorStop(1, '#e7e0cf');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { // crumple facets
      g.fillStyle = R.chance(0.5) ? 'rgba(255,255,255,.18)' : 'rgba(90,70,40,.05)';
      g.beginPath(); g.moveTo(R.rand(w), R.rand(h)); g.lineTo(R.rand(w), R.rand(h)); g.lineTo(R.rand(w), R.rand(h)); g.fill();
    }
    gr = g.createLinearGradient(0, h * 0.48, 0, h * 0.52); // a fold across the middle
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,.07)'); gr.addColorStop(0.51, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, h * 0.48, w, h * 0.04);
    g.fillStyle = 'rgba(150,110,60,.08)'; // a glue smear or two
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(R.rand(w * 0.1, w * 0.9), R.rand(h * 0.2, h * 0.8), R.rand(30, 80), R.rand(8, 16), R.rand(-0.3, 0.3), 0, 7); g.fill(); }
    return { el, m, w: w + m * 2, h: h + m * 2, remake };
  }

  function makeDesk(sp, paper, tg) {
    const { el, g } = off(cv.w, cv.h, 1);
    const W = cv.w, H = cv.h;
    const R = k.rng(11);
    let gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#4a2e18'); gr.addColorStop(1, '#2a180b');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { // grain
      const y0 = R.rand(-20, H + 20), amp = R.rand(2, 12), fq = R.rand(0.002, 0.008), ph = R.rand(6);
      g.strokeStyle = R.chance(0.5) ? `rgba(20,10,4,${R.rand(0.1, 0.3)})` : `rgba(140,90,50,${R.rand(0.05, 0.14)})`;
      g.lineWidth = R.rand(0.6, 2.4);
      g.beginPath();
      for (let x = -10; x <= W + 10; x += 24) { const yy = y0 + Math.sin(x * fq + ph) * amp + Math.sin(x * fq * 3.1) * amp * 0.3; x < 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
      g.stroke();
    }
    for (let i = 0; i < W / 180; i++) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(i * 180 + R.rand(-4, 4), 0, 2, H); } // planks
    const avoid = (x, y, w, h) => x < paper.x + paper.w + 30 && x + w > paper.x - 30 && y < paper.y + paper.h + 30 && y + h > paper.y - 30;
    const card = sp.card;
    const free = [];
    for (let i = 0; i < 60 && free.length < 9; i++) {
      const w = R.rand(220, 320), h = w * 1.3, x = R.rand(-60, W - w + 60), y = R.rand(-80, H - h + 80);
      if (avoid(x, y, w, h) || (card && x > card.left - 40 && x + w < card.right + 40 && y > card.top - 40 && y + h < card.bottom + 40)) continue;
      if (free.some((f) => Math.abs(f.x - x) < 150 && Math.abs(f.y - y) < 160)) continue;
      free.push({ x, y, w, h });
    }
    for (const mg of free) magazine(g, mg, R);
    gr = g.createRadialGradient(paper.x + paper.w * 0.5, paper.y + paper.h * 0.4, 30, paper.x + paper.w * 0.5, paper.y + paper.h * 0.5, Math.max(W, H) * 0.65); // the lamp
    gr.addColorStop(0, 'rgba(255,214,140,.32)'); gr.addColorStop(0.35, 'rgba(255,190,110,.12)'); gr.addColorStop(0.7, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,.72)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(70,40,15,.35)'; g.lineWidth = 5; // coffee ring
    const cx = paper.x + paper.w + R.rand(10, 60), cy = paper.y + R.rand(0, paper.h);
    g.beginPath(); g.arc(cx, cy, 38, 0.2, 5.8); g.stroke();
    for (let i = 0; i < 26; i++) { // loose scraps and trimmings
      const x = R.rand(W), y = R.rand(H);
      if (avoid(x, y, 20, 20)) continue;
      g.save(); g.translate(x, y); g.rotate(R.rand(6));
      if (R.chance(0.55)) {
        const st = R.pick(STYLES), sz = R.rand(14, 26);
        g.fillStyle = st[0]; g.fillRect(-sz * 0.4, -sz * 0.6, sz * 0.8, sz * 1.15);
        Object.assign(g, { font: fontOf(st, sz), fillStyle: st[1], textAlign: 'center', textBaseline: 'middle' });
        g.fillText(R.pick([...'AEKRSTXQ?!$']), 0, 0);
      } else { g.fillStyle = R.pick(['#f6f1e4', '#e63946', '#f4e04d', '#fff']); g.beginPath(); g.moveTo(0, 0); g.lineTo(R.rand(20, 50), R.rand(-4, 4)); g.lineTo(R.rand(5, 20), R.rand(4, 10)); g.fill(); }
      g.restore();
    }
    if (tg) glueStick(g, tg.x + 40, tg.y + tg.h / 2, Math.min(1, tg.h / 60));
    return el;
  }

  function magazine(g, { x, y, w, h }, R) {
    const [name, col] = R.pick(MAGS);
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(R.rand(-0.35, 0.35));
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 14; g.shadowOffsetY = 6;
    g.fillStyle = '#f6f3ec'; g.fillRect(-w / 2, -h / 2, w, h); g.shadowColor = 'transparent';
    g.fillStyle = col; g.fillRect(-w / 2, -h / 2, w, h * 0.16);
    Object.assign(g, { font: k.font(w * 0.11, 900, 'serif'), fillStyle: '#fff', textAlign: 'left', textBaseline: 'middle' });
    g.fillText(name, -w / 2 + 12, -h / 2 + h * 0.08);
    const gr = g.createLinearGradient(0, -h * 0.3, 0, h * 0.1);
    gr.addColorStop(0, R.pick(['#9ecae1', '#fcbba1', '#c7e9c0', '#dadaeb'])); gr.addColorStop(1, R.pick(['#3182bd', '#de2d26', '#31a354', '#756bb1']));
    g.fillStyle = gr; g.fillRect(-w / 2 + 12, -h / 2 + h * 0.2, w - 24, h * 0.36);
    g.fillStyle = 'rgba(0,0,0,.18)';
    for (let i = 0; i < 9; i++) g.fillRect(-w / 2 + 12, -h / 2 + h * 0.6 + i * h * 0.04, (w - 24) * R.rand(0.5, 1), h * 0.018);
    for (let i = 0; i < R.int(3, 6); i++) { // holes where letters were cut out
      const hw = R.rand(14, 30), hh = R.rand(18, 32), hx = R.rand(-w / 2 + 14, w / 2 - 14 - hw), hy = R.rand(-h / 2 + 10, h / 2 - 10 - hh);
      g.fillStyle = '#2b190c'; g.fillRect(hx, hy, hw, hh);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(hx, hy, hw, 2); g.fillRect(hx, hy, 2, hh);
    }
    g.restore();
  }

  function glueStick(g, x, y, s) {
    g.save(); g.translate(x, y); g.rotate(-0.12); g.scale(s, s);
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
    let gr = g.createLinearGradient(0, -12, 0, 12);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#d9d9d9'); gr.addColorStop(1, '#9a9a9a');
    g.fillStyle = gr; g.beginPath(); g.roundRect(-34, -12, 58, 24, 4); g.fill(); g.shadowColor = 'transparent';
    g.fillStyle = '#7b2cbf'; g.fillRect(-20, -12, 24, 24);
    Object.assign(g, { font: k.font(8, 900, 'sans'), fillStyle: '#fff', textAlign: 'center', textBaseline: 'middle' });
    g.fillText('GLUE', -8, 0);
    gr = g.createLinearGradient(0, -10, 0, 10);
    gr.addColorStop(0, '#fff8e1'); gr.addColorStop(1, '#d8cfb0');
    g.fillStyle = gr; g.beginPath(); g.roundRect(24, -9, 10, 18, 3); g.fill();
    g.restore();
  }

  function drawScissors(s, dt) {
    s.snap = Math.max(0, s.snap - dt * 7);
    const open = 0.08 + (s.snap > 0 ? Math.abs(Math.sin(s.snap * Math.PI)) * 0.4 : 0.25);
    c.save(); c.translate(s.x, s.y); c.rotate(s.rot); c.scale(s.s, s.s);
    c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 8; c.shadowOffsetY = 4;
    for (const side of [-1, 1]) {
      c.save(); c.rotate(side * open);
      const gr = c.createLinearGradient(0, -6, 0, 6);
      gr.addColorStop(0, '#f2f4f7'); gr.addColorStop(0.5, '#a9b0ba'); gr.addColorStop(1, '#6b7280');
      c.fillStyle = gr;
      c.beginPath(); c.moveTo(-4, 0); c.lineTo(70, side * 1.5); c.lineTo(12, side * 7); c.closePath(); c.fill();
      c.fillStyle = '#e11d48';
      c.beginPath(); c.ellipse(-26, side * 10, 17, 10, side * 0.2, 0, 7); c.ellipse(-26, side * 10, 10, 5, side * 0.2, 0, 7, true); c.fill('evenodd');
      c.fillRect(-12, side * 2 - 3, 12, 6);
      c.restore();
    }
    c.shadowColor = 'transparent';
    c.fillStyle = '#444'; c.beginPath(); c.arc(0, 0, 3, 0, 7); c.fill();
    c.restore();
  }

  function drawNote(n, dt) {
    c.save();
    c.translate(n.x, n.y);
    c.rotate(n.rot);
    const inP = k.ease.outCubic(k.clamp(n.age / 0.45));
    c.translate(0, (1 - inP) * (cv.h - n.y + n.h));
    c.drawImage(n.sheet.el, -n.w / 2 - n.sheet.m, -n.h / 2 - n.sheet.m, n.sheet.w, n.sheet.h);
    for (const L of n.letters) {
      const p = (n.age - L.at) / 0.22;
      if (p <= 0) continue;
      if (!L.stuck && p >= 1) { L.stuck = true; if (k.chance(0.3)) k.sfx.clack({ pitch: k.rand(0.45, 0.6), gain: 0.25 }); }
      const e = k.clamp(p);
      c.save();
      c.translate(L.x, L.y - (1 - k.ease.outCubic(e)) * 14);
      c.rotate(L.rot + (1 - e) * 0.5);
      const s = 1 + (1 - k.ease.outBack(e)) * 0.6;
      c.scale(s, s);
      c.globalAlpha = k.clamp(p * 3);
      c.drawImage(L.spr.el, -L.spr.w / 2, -L.spr.h / 2, L.spr.w, L.spr.h);
      c.restore();
    }
    if (n.extra) { // the reply strip, glued on after you answer
      const x = n.extra;
      x.age += dt;
      const p = k.ease.outBack(k.clamp(x.age / 0.35));
      c.save(); c.translate(x.x, x.y); c.rotate(x.rot); c.scale(0.6 + p * 0.4, 0.6 + p * 0.4); c.globalAlpha = k.clamp(x.age * 4);
      c.drawImage(x.spr.el, -x.spr.w / 2, -x.spr.h / 2, x.spr.w, x.spr.h);
      c.restore();
    }
    c.restore();
  }

  // A torn strip with a short reply in cut-out letters, glued over the bottom corner.
  function reply(text) {
    if (!note) return;
    note.extra = { ...strip(text, note.w, note.h), text, on: [note.w, note.h], rot: -0.06, age: k.reduced ? 9 : 0 };
    k.sfx.thud({ gain: 0.5, pitch: 1.4 });
  }

  function strip(text, nw, nh) {
    const R = k.rng(text);
    const size = k.clamp(nh / 9, 13, 22);
    const glyphs = [...text].map((ch) => ({ ch, st: R.pick(STYLES) }));
    const sprs = glyphs.map((g) => (g.ch === ' ' ? null : clipping(g.ch, g.st, size, R)));
    const gw = sprs.reduce((a, s) => a + (s ? s.cw * 0.95 : size * 0.4), 0);
    const w = gw + 30, h = size * 2.1, m = 16;
    const { el, g } = off(w + m * 2, h + m * 2, cv.dpr);
    g.translate(m, m);
    g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
    g.fillStyle = '#fdf6d8';
    g.beginPath(); g.moveTo(0, 0);
    for (let x = 0; x <= w; x += 6) g.lineTo(x, R.rand(-2, 2));
    for (let x = w; x >= 0; x -= 6) g.lineTo(x, h + R.rand(-2, 2));
    g.closePath(); g.fill(); g.restore();
    let x = 15;
    sprs.forEach((s) => {
      if (!s) { x += size * 0.4; return; }
      g.save(); g.translate(x + s.cw * 0.47, h / 2 + R.rand(-2, 2)); g.rotate(R.rand(-0.15, 0.15));
      g.drawImage(s.el, -s.w / 2, -s.h / 2, s.w, s.h); g.restore();
      x += s.cw * 0.95;
    });
    const sw = Math.min(w + m * 2, nw * 0.8);
    const sc = sw / (w + m * 2);
    return { spr: { el, w: (w + m * 2) * sc, h: (h + m * 2) * sc }, x: nw / 2 - sw / 2 + 10, y: nh / 2 - (h * sc) / 2 - 6 };
  }

  // A DPR change: same notes, letters, reply and scissors, just re-cut at the new resolution (the desk is 1x).
  function recut(n) {
    if (!n) return;
    n.sheet = n.sheet.remake();
    for (const L of n.letters) L.spr = L.spr.remake();
    if (n.extra) n.extra.spr = strip(n.extra.text, ...n.extra.on).spr;
  }

  cv.resized = (w, h, { dprOnly } = {}) => {
    if (!dprOnly) return build(false);
    recut(note);
    leaving.forEach(recut);
  };
  build(!k.reduced);
  if (note && !k.reduced) note.age = 0;

  k.loop((dt) => {
    c.drawImage(desk, 0, 0, cv.w, cv.h);
    for (let i = leaving.length - 1; i >= 0; i--) {
      const n = leaving[i];
      n.t += dt; n.vy += 2600 * dt; n.y += n.vy * dt; n.rot += n.vr * dt;
      if (n.y - n.h > cv.h) { leaving.splice(i, 1); continue; }
      drawNote(n, 0);
    }
    if (note) { note.age += dt; drawNote(note, dt); }
    for (let i = scraps.length - 1; i >= 0; i--) {
      const s = scraps[i];
      s.vy += 700 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += s.vr * dt; s.t += dt;
      if (s.t > 1.4) { scraps.splice(i, 1); continue; }
      c.save(); c.translate(s.x, s.y); c.rotate(s.r); c.globalAlpha = k.clamp((1.4 - s.t) * 3);
      c.fillStyle = s.col; c.beginPath(); c.moveTo(0, 0); c.lineTo(s.w, 2); c.lineTo(s.w * 0.3, 6); c.fill();
      c.restore();
    }
    if (scissors) drawScissors(scissors, dt);
    // the lamp breathes, very slightly
    c.fillStyle = `rgba(255,200,120,${0.025 + Math.sin(performance.now() / 900) * 0.012})`;
    c.fillRect(0, 0, cv.w, cv.h);
  }, { still: 4 });

  return {
    question() { scraps = []; build(!k.reduced); },
    layout() { build(false); },
    status() { if (!ctx.question && ctx.front === 'waiting') build(false); },
    decisions() { if (ctx.front === 'done') build(false); },
    keystroke() {
      if (!scissors || k.reduced || scissors.snap > 0.4) return;
      scissors.snap = 1;
      k.sfx.clack({ pitch: k.rand(1.3, 1.6), gain: 0.25 });
      if (k.chance(0.5)) {
        const a = scissors.rot;
        scraps.push({ x: scissors.x + Math.cos(a) * 60 * scissors.s, y: scissors.y + Math.sin(a) * 60 * scissors.s, vx: k.rand(-80, 80), vy: k.rand(-160, -60), r: k.rand(6), vr: k.rand(-8, 8), w: k.rand(8, 16), col: k.pick(STYLES)[0], t: 0 });
      }
    },
    answer(a) {
      if (!a.picks?.length) reply(k.pick(['Interesting. Noted', 'We will be in touch', 'Bold. Very bold']));
      else if (a.tookRec) reply(k.pick(['Good. Nobody got hurt', 'Wise choice', 'Pleasure doing business']));
      else if (a.hasRec) reply(k.pick(['You will regret this', 'Bold. We will be in touch', 'Not what we asked for']));
      else reply('Noted');
    },
  };
}
