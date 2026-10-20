// Courtroom sketch. Pencil and pastel on cream paper: a judge with a gavel, Exhibit A on an easel
// and a jury of twelve rubber ducks. "The court will now hear question 7." The judge gets
// impatient the longer you take, and the ducks react to your answer.

const LEAD = 'rgba(38,36,46,.82)';
const DUCKS = ['plain', 'glasses', 'bow', 'plain', 'hat', 'plain', 'glasses', 'plain', 'bow', 'plain', 'plain', 'hat'];
const W = 720, H = 240; // the design box, scaled into the biggest gap

const off = (w, h, dpr) => {
  const el = document.createElement('canvas');
  el.width = Math.max(1, Math.ceil(w * dpr));
  el.height = Math.max(1, Math.ceil(h * dpr));
  const g = el.getContext('2d');
  g.scale(dpr, dpr);
  return { el, g };
};

// Pencil helpers: every stroke drawn twice with a little wobble, hatching clipped to a shape.
function pencil(g, R) {
  const j = (v, a) => v + R.rand(-a, a);
  const P = {
    line(x1, y1, x2, y2, { w = 1.2, col = LEAD, passes = 2, wob = 1 } = {}) {
      g.strokeStyle = col; g.lineCap = 'round';
      for (let p = 0; p < passes; p++) {
        g.lineWidth = w * R.rand(0.6, 1.1);
        g.beginPath(); g.moveTo(j(x1, wob), j(y1, wob));
        g.quadraticCurveTo((x1 + x2) / 2 + R.rand(-wob, wob) * 1.6, (y1 + y2) / 2 + R.rand(-wob, wob) * 1.6, j(x2, wob), j(y2, wob));
        g.stroke();
      }
    },
    poly(pts, o, closed = true) { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) P.line(...pts[i], ...pts[(i + 1) % pts.length], o); },
    rect(x, y, w, h, o) { P.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o); },
    oval(cx, cy, rx, ry, { w = 1.2, col = LEAD, passes = 2, wob = 0.06, from = 0, to = Math.PI * 2 } = {}) {
      g.strokeStyle = col; g.lineCap = 'round';
      for (let p = 0; p < passes; p++) {
        g.lineWidth = w * R.rand(0.6, 1.1);
        const k0 = R.rand(6), n = 28, f = R.rand(-0.15, 0.15);
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = from + (to - from) * (i / n) + f, r = 1 + Math.sin(i * 0.9 + k0) * wob;
          i ? g.lineTo(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r) : g.moveTo(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r);
        }
        g.stroke();
      }
    },
    // pastel: a soft wash, then strokes in one direction, clipped to the shape
    hatch(shape, [bx, by, bw, bh], { col = LEAD, gap = 4, angle = -0.9, w = 0.8, wash = null, alpha = 1 } = {}) {
      g.save(); g.beginPath(); shape(); g.clip();
      if (wash) { g.fillStyle = wash; g.fillRect(bx, by, bw, bh); }
      g.globalAlpha = alpha; g.strokeStyle = col; g.lineCap = 'round';
      const d = Math.hypot(bw, bh), cx = bx + bw / 2, cy = by + bh / 2, ca = Math.cos(angle), sa = Math.sin(angle);
      for (let t = -d / 2; t < d / 2; t += gap * R.rand(0.7, 1.3)) {
        g.lineWidth = w * R.rand(0.5, 1.2);
        const x0 = cx + t * -sa, y0 = cy + t * ca;
        g.beginPath(); g.moveTo(x0 - ca * d / 2 * R.rand(0.6, 1), y0 - sa * d / 2 * R.rand(0.6, 1)); g.lineTo(x0 + ca * d / 2 * R.rand(0.6, 1), y0 + sa * d / 2 * R.rand(0.6, 1)); g.stroke();
      }
      g.restore();
    },
  };
  return P;
}

export default function courtroom(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  let paper = null, paperKey = ''; // baked once per window size: scrolling and new cards don't touch it
  let box = null; // { x, y, s }: where the design box sits on screen
  let layers = null; // sprites for the parts drawn over the judge and the ducks
  let ducks = [];
  let duckSprites = null;
  let top = null; // case caption in the top gap
  let bubble = null; // { text, age, spr }
  let gavel = { a: -0.35, bang: -1 };
  let mood = { kind: 'idle', age: 0 };
  let lastLine = '';

  // ── the paper and the room around everything (baked) ──
  function makePaper() {
    const stage = k.rect(k.ui.stage()) || { left: cv.w * 0.22, right: cv.w * 0.78 };
    const { el, g } = off(cv.w, cv.h, 1);
    const R = k.rng(5);
    const P = pencil(g, R);
    g.fillStyle = '#f1ead9'; g.fillRect(0, 0, cv.w, cv.h);
    for (let i = 0; i < cv.w * cv.h / 90; i++) { g.fillStyle = R.chance(0.5) ? 'rgba(120,100,70,.06)' : 'rgba(255,255,255,.35)'; g.fillRect(R.rand(cv.w), R.rand(cv.h), R.rand(1, 2.5), 1); }
    // wall panelling and wainscot, loose
    P.hatch(() => g.rect(0, 0, cv.w, cv.h * 0.62), [0, 0, cv.w, cv.h * 0.62], { col: 'rgba(90,110,140,.11)', gap: 9, angle: -1.1, w: 1.2, wash: 'rgba(130,150,180,.1)' });
    for (let x = 30; x < cv.w; x += 150) P.rect(x, cv.h * 0.1, 110, cv.h * 0.44, { col: 'rgba(60,60,80,.35)', w: 1, wob: 2 });
    P.hatch(() => g.rect(0, cv.h * 0.62, cv.w, cv.h * 0.38), [0, cv.h * 0.62, cv.w, cv.h * 0.38], { col: 'rgba(120,70,30,.12)', gap: 7, angle: -0.3, w: 1.2, wash: 'rgba(170,110,60,.12)' });
    P.line(0, cv.h * 0.62, cv.w, cv.h * 0.62, { w: 2, wob: 3 });
    // gallery: rows of heads at the edges, the public
    for (let row = 0; row < 3; row++) for (let x = 20 + row * 18; x < cv.w; x += 46) {
      const y = cv.h * (0.7 + row * 0.1);
      if (x > stage.left - 10 && x < stage.right + 10) continue;
      P.hatch(() => g.arc(x, y, 14, 0, 7), [x - 14, y - 14, 28, 28], { col: R.pick(['rgba(60,40,30,.5)', 'rgba(120,80,40,.5)', 'rgba(30,30,30,.55)', 'rgba(200,160,90,.5)']), gap: 2.5, angle: R.rand(-1, 1) });
      P.oval(x, y, 14, 15, { w: 0.9 });
      P.hatch(() => g.ellipse(x, y + 34, 24, 20, 0, Math.PI, 0), [x - 24, y + 14, 48, 22], { col: R.pick(['rgba(40,60,120,.4)', 'rgba(120,40,40,.4)', 'rgba(60,60,60,.4)']), gap: 3, angle: -0.6 });
    }
    return el;
  }

  // ── sprites in design units, rendered at screen scale ──
  function layer(x, y, w, h, draw, seed) {
    const s = box.s;
    const { el, g } = off(w * s, h * s, cv.dpr);
    g.scale(s, s); g.translate(-x, -y);
    draw(g, pencil(g, k.rng(seed)));
    return { el, x, y, w, h };
  }

  function duckSprite(kind, quack, sleep) {
    const u = 35, s = box.s;
    const { el, g } = off(u * 1.6 * s, u * 1.5 * s, cv.dpr);
    g.scale(s, s); g.translate(u * 0.85, u * 0.95);
    const P = pencil(g, k.rng(kind + quack));
    const body = () => { g.ellipse(0, 0, u * 0.48, u * 0.32, 0, 0, 7); g.moveTo(u * 0.35, -u * 0.1); g.lineTo(u * 0.62, -u * 0.38); g.lineTo(u * 0.48, 0.05 * u); };
    P.hatch(body, [-u, -u, u * 2, u * 1.4], { col: 'rgba(230,170,0,.55)', gap: 2.6, angle: -0.8, wash: 'rgba(255,214,60,.75)' });
    P.oval(0, 0, u * 0.48, u * 0.32, { w: 1.1 });
    P.poly([[u * 0.36, -u * 0.12], [u * 0.62, -u * 0.38], [u * 0.47, 0]], { w: 1 }, false);
    P.oval(u * 0.05, u * 0.02, u * 0.24, u * 0.13, { w: 0.8, from: 0.2, to: 2.6 }); // wing
    const hx = -u * 0.3, hy = -u * 0.42, hr = u * 0.22;
    P.hatch(() => g.arc(hx, hy, hr, 0, 7), [hx - hr, hy - hr, hr * 2, hr * 2], { col: 'rgba(230,170,0,.5)', gap: 2.4, angle: 0.8, wash: 'rgba(255,214,60,.8)' });
    P.oval(hx, hy, hr, hr, { w: 1.1 });
    const beak = (dy, rot) => { g.save(); g.translate(hx - hr * 0.9, hy + hr * 0.25 + dy); g.rotate(rot); g.beginPath(); g.ellipse(-u * 0.1, 0, u * 0.14, u * 0.055, 0, 0, 7); g.fillStyle = 'rgba(245,120,30,.9)'; g.fill(); g.restore(); };
    if (quack) { beak(-u * 0.04, 0.25); beak(u * 0.05, -0.3); } else beak(0, 0);
    g.fillStyle = LEAD;
    if (sleep) P.line(hx - hr * 0.55, hy - hr * 0.15, hx - hr * 0.15, hy - hr * 0.1, { w: 1.2, wob: 0.3 });
    else { g.beginPath(); g.arc(hx - hr * 0.35, hy - hr * 0.2, u * 0.035, 0, 7); g.fill(); }
    if (kind === 'glasses') { P.oval(hx - hr * 0.35, hy - hr * 0.2, u * 0.08, u * 0.07, { w: 0.9 }); P.line(hx - hr * 0.2, hy - hr * 0.25, hx + hr * 0.3, hy - hr * 0.35, { w: 0.8, passes: 1 }); }
    if (kind === 'bow') { g.fillStyle = 'rgba(200,30,50,.85)'; g.beginPath(); g.moveTo(hx + hr * 0.3, hy + hr * 1.05); g.lineTo(hx + hr * 0.95, hy + hr * 0.75); g.lineTo(hx + hr * 0.95, hy + hr * 1.35); g.closePath(); g.moveTo(hx + hr * 0.3, hy + hr * 1.05); g.lineTo(hx - hr * 0.35, hy + hr * 0.75); g.lineTo(hx - hr * 0.35, hy + hr * 1.35); g.fill(); }
    if (kind === 'hat') { g.fillStyle = 'rgba(30,30,40,.85)'; g.fillRect(hx - hr * 0.55, hy - hr * 1.65, hr * 1.1, hr * 0.85); g.fillRect(hx - hr * 0.9, hy - hr * 0.85, hr * 1.8, hr * 0.18); }
    return { el, w: u * 1.6, h: u * 1.5, ox: u * 0.85, oy: u * 0.95 };
  }

  function judgeSprite() {
    return layer(60, 20, 150, 120, (g, P) => {
      const x = 130, y = 72;
      // robe shoulders
      const robe = () => { g.moveTo(x - 62, 140); g.quadraticCurveTo(x - 58, y + 22, x, y + 22); g.quadraticCurveTo(x + 58, y + 22, x + 62, 140); g.closePath(); };
      P.hatch(robe, [x - 70, y, 140, 80], { col: 'rgba(20,20,28,.8)', gap: 2.2, angle: -1.2, wash: 'rgba(30,30,40,.55)', w: 1.1 });
      P.line(x - 10, y + 24, x, y + 60, { col: 'rgba(255,255,255,.7)', w: 1.2 }); P.line(x + 10, y + 24, x, y + 60, { col: 'rgba(255,255,255,.7)', w: 1.2 });
      // face
      P.hatch(() => g.ellipse(x, y, 19, 23, 0, 0, 7), [x - 20, y - 24, 40, 48], { col: 'rgba(200,120,90,.35)', gap: 2.5, angle: 0.6, wash: 'rgba(240,190,160,.6)' });
      P.oval(x, y, 19, 23, { w: 1.2 });
      P.line(x - 12, y - 8, x - 3, y - 5, { w: 1.6 }); P.line(x + 12, y - 8, x + 3, y - 5, { w: 1.6 }); // stern brows
      P.oval(x - 7, y - 1, 5, 4, { w: 0.9 }); P.oval(x + 7, y - 1, 5, 4, { w: 0.9 }); P.line(x - 2, y - 1, x + 2, y - 1, { w: 0.8, passes: 1 });
      g.fillStyle = LEAD; g.beginPath(); g.arc(x - 7, y - 1, 1.3, 0, 7); g.arc(x + 7, y - 1, 1.3, 0, 7); g.fill();
      P.line(x - 6, y + 12, x + 6, y + 12, { w: 1.3 });
      // the wig: white curls
      for (const [cx, cy, r] of [[x - 22, y - 2, 7], [x - 23, y + 10, 7], [x - 21, y + 22, 7], [x + 22, y - 2, 7], [x + 23, y + 10, 7], [x + 21, y + 22, 7], [x - 14, y - 20, 9], [x, y - 25, 10], [x + 14, y - 20, 9]]) {
        P.hatch(() => g.arc(cx, cy, r, 0, 7), [cx - r, cy - r, r * 2, r * 2], { col: 'rgba(150,150,160,.5)', gap: 2.4, angle: 1, wash: 'rgba(252,252,248,.95)' });
        P.oval(cx, cy, r, r, { w: 0.9, wob: 0.12 });
      }
    }, 'judge');
  }

  function benchSprite() {
    return layer(0, 112, 262, 128, (g, P) => {
      const panel = () => g.rect(8, 120, 246, 120);
      g.fillStyle = '#e9d9bf'; g.fillRect(8, 120, 246, 120); g.fillRect(2, 112, 258, 12);
      P.hatch(panel, [8, 120, 246, 120], { col: 'rgba(110,60,25,.6)', gap: 3, angle: -0.25, wash: 'rgba(160,100,50,.5)', w: 1.1 });
      P.hatch(() => g.rect(2, 112, 258, 12), [2, 112, 258, 12], { col: 'rgba(90,50,20,.7)', gap: 2, angle: 0.1, wash: 'rgba(130,80,40,.6)' });
      P.rect(8, 120, 246, 120, { w: 1.3 }); P.rect(2, 112, 258, 12, { w: 1.2 });
      for (const x of [30, 100, 170]) P.rect(x, 140, 62, 80, { w: 0.8, col: 'rgba(60,30,10,.6)' });
      g.fillStyle = 'rgba(214,180,90,.95)'; g.fillRect(84, 150, 94, 22); P.rect(84, 150, 94, 22, { w: 0.9 }); // nameplate
      Object.assign(g, { font: k.font(11, 800, 'serif'), fillStyle: '#3a2a10', textAlign: 'center', textBaseline: 'middle' });
      g.fillText('HON. A. GENT', 131, 161.5);
    }, 'bench');
  }

  function easelSprite(text) {
    return layer(270, 76, 160, 164, (g, P) => {
      P.line(300, 240, 330, 92, { w: 2.2 }); P.line(400, 240, 370, 92, { w: 2.2 }); P.line(350, 240, 350, 100, { w: 1.6 });
      g.save(); g.translate(350, 140); g.rotate(-0.02);
      const pad = () => g.rect(-62, -52, 124, 96);
      P.hatch(pad, [-62, -52, 124, 96], { col: 'rgba(200,200,190,.4)', gap: 6, angle: -0.5, wash: 'rgba(255,255,252,.95)' });
      P.rect(-62, -52, 124, 96, { w: 1.2 });
      Object.assign(g, { font: k.font(12, 900, 'serif'), fillStyle: 'rgba(180,30,40,.9)', textAlign: 'center', textBaseline: 'middle' });
      g.fillText('EXHIBIT A', 0, -38);
      P.line(-34, -29, 34, -29, { col: 'rgba(180,30,40,.8)', w: 1, passes: 1 });
      let sz = 15, lines;
      for (; sz >= 8; sz--) { g.font = k.font(sz, 700, 'hand'); lines = k.wrap(g, text, 108, Math.floor(66 / (sz * 1.15))); if (!lines.at(-1)?.endsWith('…') && lines.length * sz * 1.15 <= 66) break; }
      g.fillStyle = '#1d2a6b';
      lines.forEach((l, i) => g.fillText(l, 0, -18 + (66 - lines.length * sz * 1.15) / 2 + sz * 1.15 * (i + 0.5)));
      g.restore();
    }, `easel${text}`);
  }

  function juryLayers() {
    const back = layer(440, 104, 280, 136, (g, P) => {
      P.hatch(() => g.rect(446, 108, 268, 132), [446, 108, 268, 132], { col: 'rgba(110,60,25,.35)', gap: 5, angle: -1.2, wash: 'rgba(150,95,50,.25)' });
      P.rect(446, 108, 268, 132, { w: 1, col: 'rgba(60,30,10,.5)' });
    }, 'jb');
    const rail = layer(440, 140, 280, 22, (g, P) => {
      g.fillStyle = '#e9d9bf'; g.fillRect(446, 146, 268, 14);
      P.hatch(() => g.rect(446, 146, 268, 14), [446, 146, 268, 14], { col: 'rgba(100,55,20,.7)', gap: 2, angle: 0.15, wash: 'rgba(150,95,50,.75)' });
      P.rect(446, 146, 268, 14, { w: 1.1 });
    }, 'jr');
    const front = layer(436, 188, 284, 52, (g, P) => {
      g.fillStyle = '#e9d9bf'; g.fillRect(442, 194, 276, 46); g.fillRect(438, 190, 284, 8);
      P.hatch(() => g.rect(442, 194, 276, 46), [442, 194, 276, 46], { col: 'rgba(110,60,25,.6)', gap: 3, angle: -0.25, wash: 'rgba(160,100,50,.55)', w: 1.1 });
      P.rect(442, 194, 276, 46, { w: 1.3 });
      P.hatch(() => g.rect(438, 190, 284, 8), [438, 190, 284, 8], { col: 'rgba(90,50,20,.7)', gap: 2, angle: 0.1, wash: 'rgba(130,80,40,.6)' });
      Object.assign(g, { font: k.font(10, 800, 'serif'), fillStyle: 'rgba(60,35,10,.85)', textAlign: 'center', textBaseline: 'middle' });
      g.fillText('J U R Y', 580, 220);
    }, 'jf');
    return { back, rail, front };
  }

  function bubbleSprite(text) {
    const s = box.s, R = k.rng(text);
    const { g: m } = off(1, 1, 1);
    let sz = 15, lines;
    for (; sz >= 10; sz--) { m.font = k.font(sz, 700, 'hand'); lines = k.wrap(m, text, 210, 2); if (!lines.at(-1)?.endsWith('…')) break; }
    const tw = Math.max(...lines.map((l) => m.measureText(l).width)) + 28, th = lines.length * sz * 1.2 + 18;
    const { el, g } = off((tw + 20) * s, (th + 30) * s, cv.dpr);
    g.scale(s, s); g.translate(10, 4);
    const P = pencil(g, R);
    g.fillStyle = 'rgba(255,253,245,.92)';
    g.beginPath(); g.ellipse(tw / 2, th / 2, tw / 2 + 4, th / 2 + 2, 0, 0, 7); g.fill();
    P.oval(tw / 2, th / 2, tw / 2 + 4, th / 2 + 2, { w: 1.2, wob: 0.03 });
    g.beginPath(); g.moveTo(14, th * 0.7); g.lineTo(-6, th + 20); g.lineTo(34, th * 0.85); g.fill();
    P.line(14, th * 0.72, -6, th + 20, { w: 1 }); P.line(-6, th + 20, 32, th * 0.9, { w: 1 });
    Object.assign(g, { font: k.font(sz, 700, 'hand'), fillStyle: '#1f1d2a', textAlign: 'center', textBaseline: 'middle' });
    lines.forEach((l, i) => g.fillText(l, tw / 2, 9 + sz * 1.2 * (i + 0.5)));
    return { el, w: tw + 20, h: th + 30 };
  }

  // ── what's said ──
  function judgeLine() {
    const q = ctx.question;
    if (ctx.front === 'done') {
      const r = ctx.recRate;
      return `Case closed. The jury finds you ${r === null ? 'DECISIVE' : r >= 0.8 ? 'REASONABLE' : r <= 0.3 ? 'A MAVERICK' : 'DECISIVE'}.`;
    }
    if (!q) return ctx.agent === 'listening' ? 'The court is listening.' : 'The court is in recess.';
    const t = ctx.cardTime;
    if (mood.kind === 'answered') return mood.line;
    if (t > 150) return 'Juror four has fallen asleep.';
    if (t > 70) return 'The jury is getting restless.';
    if (t > 25) return 'Take your time, counsel.';
    if (q.revising) return `The court will revisit question ${q.n}. Again.`;
    if (!q.options.length) return 'The witness may speak freely.';
    return `The court will now hear question ${q.n}.`;
  }

  function exhibitText() {
    const q = ctx.question;
    if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      return n ? `${n} decision${n === 1 ? '' : 's'}, signed` : 'All decisions, signed';
    }
    if (!q) return 'To be determined';
    if (!q.options.length) return '(intentionally left blank)';
    return q.recommended[0] ? `★ ${q.recommended[0]}` : q.options[0].label || '(unlabelled)';
  }

  function caseTitle() {
    const q = ctx.question;
    if (ctx.front === 'done') return `THE PEOPLE v. ${ctx.doc.title || 'THE BACKLOG'}: THE VERDICT`;
    if (!q) return `THE PEOPLE v. ${ctx.doc.title || 'THE BACKLOG'}`;
    return `THE PEOPLE v. “${q.title}”`;
  }

  function build() {
    const st = k.rect(k.ui.stage());
    const key = `${cv.w}x${cv.h}:${Math.round(st?.left ?? -1)},${Math.round(st?.right ?? -1)}`;
    if (key !== paperKey) { paperKey = key; paper = makePaper(); }
    const sp = k.space();
    const gap = sp.gaps.find((g) => g.where === 'bottom' && g.w >= 300) || sp.gaps.find((g) => g.where !== 'top' && g.w >= 300) || sp.gaps[0];
    if (!gap) { box = null; return; }
    const s = k.clamp(Math.min((gap.w - 24) / W, (gap.h - 12) / H), 0.55, 1.35);
    const peek = (gap.h - 12) / H < 0.55;
    box = { s, x: gap.x + (gap.w - W * s) / 2, y: gap.y + gap.h - H * s - (peek || gap.y + gap.h < cv.h - 4 ? 0 : Math.min(30, (gap.h - H * s) / 2)) };
    sprites();
    const tg = sp.gaps.find((g) => g.where === 'top' && g.h >= 28 && g.w >= 240);
    top = tg && { x: tg.x, y: tg.y, w: tg.w, h: tg.h, r: Math.min(tg.x + tg.w, sp.hud ? sp.hud.left + 8 : Infinity) }; // r: clear of the score HUD
    lastLine = '';
  }

  // Everything pre-rendered at box.s and cv.dpr. Ducks, gavel, mood and the bubble's age stay put.
  function sprites() {
    const static_ = layer(0, 0, W, H, (g, P) => {
      const tbl = () => g.rect(250, 214, 200, 26); // the counsel table edge, just a hint
      P.hatch(tbl, [250, 214, 200, 26], { col: 'rgba(110,60,25,.45)', gap: 3, angle: -0.2, wash: 'rgba(160,100,50,.3)' });
      P.line(250, 214, 450, 214, { w: 1.2 });
    }, 'static');
    layers = { static_, judge: judgeSprite(), bench: benchSprite(), easel: easelSprite(exhibitText()), ...juryLayers() };
    duckSprites = Object.fromEntries(['plain', 'glasses', 'bow', 'hat'].flatMap((kd) => [[kd, duckSprite(kd, false, false)], [`${kd}:q`, duckSprite(kd, true, false)], [`${kd}:z`, duckSprite(kd, false, true)]]));
    if (!ducks.length) ducks = DUCKS.map((kind, i) => ({ kind, row: i < 6 ? 0 : 1, x: i < 6 ? 470 + i * 44 : 490 + (i - 6) * 44, phase: k.rand(6), quack: 0, jump: 0, fall: 0, look: 0 }));
    if (bubble) bubble.spr = bubbleSprite(bubble.text);
  }

  function say(text) {
    if (!box || text === lastLine) return;
    lastLine = text;
    bubble = { text, spr: bubbleSprite(text), age: k.reduced ? 9 : 0 };
  }

  function bang(n = 2) {
    gavel.bang = 0; gavel.n = n;
  }

  function drawDuck(d, dt, t) {
    const asleep = ctx.front === 'waiting' || (ctx.cardTime > 150 && d === ducks[3]) || (ctx.front === 'question' && ctx.cardTime > 70 && d.kind === 'hat');
    d.quack = Math.max(0, d.quack - dt);
    if (!asleep && !k.reduced && mood.kind === 'idle' && k.chance(dt * 0.04)) { d.quack = 0.35; k.sfx.tone({ type: 'sawtooth', freq: 520, to: 380, dur: 0.12, gain: 0.03, filter: 'bandpass', freqF: 1200, q: 3 }); }
    const restless = ctx.front === 'question' && ctx.cardTime > 70 && mood.kind !== 'answered';
    const bob = asleep ? Math.sin(t * 1.2 + d.phase) * 0.6 : Math.sin(t * (restless ? 7 : 2.2) + d.phase) * (restless ? 2 : 1.2);
    let jy = 0, rot = 0;
    if (mood.kind === 'answered' && mood.cheer) jy = -Math.abs(Math.sin((mood.age * 9) + d.phase)) * 12 * Math.max(0, 1 - mood.age / 2.2);
    if (mood.kind === 'answered' && !mood.cheer && d === ducks[8]) rot = k.ease.outBounce(k.clamp((mood.age - 0.4) / 0.6)) * -1.45; // one faints
    const x = d.x, y = (d.row ? 196 : 146) + bob + jy;
    const spr = duckSprites[`${d.kind}${asleep ? ':z' : d.quack > 0 || (mood.kind === 'answered' && mood.cheer && mood.age < 1.5) ? ':q' : ''}`];
    c.save(); c.translate(x, y - 6); c.rotate(rot);
    if (ctx.typing && !asleep) c.scale(-1, 1); // they turn to watch you type
    c.drawImage(spr.el, -spr.ox, -spr.oy, spr.w, spr.h);
    c.restore();
    if (asleep && !k.reduced ? Math.sin(t * 1.5 + d.phase) > 0.2 : asleep) {
      c.font = k.font(10, 700, 'hand'); c.fillStyle = 'rgba(40,40,60,.6)';
      c.fillText('z', x - 6 + Math.sin(t + d.phase) * 2, y - 40 - ((t * 6 + d.phase * 4) % 10)); c.fillText('Z', x + 2, y - 48);
    }
    if (mood.kind === 'answered' && !mood.cheer && mood.age < 2.5 && d !== ducks[8]) { c.font = k.font(14, 900, 'hand'); c.fillStyle = 'rgba(200,30,40,.85)'; c.fillText('!', x - 8, y - 44); }
  }

  function drawGavel(dt) {
    const gx = 172, gy = 108; // shoulder
    if (gavel.bang >= 0) {
      gavel.bang += dt;
      const p = gavel.bang % 0.42;
      gavel.a = p < 0.24 ? k.lerp(-0.35, -1.15, k.ease.outCubic(p / 0.24)) : k.lerp(-1.15, 0.45, k.ease.inCubic(k.clamp((p - 0.24) / 0.1)));
      if (p >= 0.34 && !gavel.hit) { gavel.hit = true; k.sfx.thud({ gain: 0.9, pitch: 1.3 }); k.sfx.clack({ pitch: 0.5, gain: 0.6 }); gavel.flash = 0.18; }
      if (p < 0.2) gavel.hit = false;
      if (gavel.bang > 0.42 * gavel.n) { gavel.bang = -1; gavel.a = -0.35; }
    }
    c.save(); c.translate(gx, gy); c.rotate(gavel.a);
    c.strokeStyle = 'rgba(20,20,28,.85)'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(30, 4); c.stroke(); // sleeve
    c.fillStyle = 'rgba(240,190,160,.95)'; c.beginPath(); c.arc(34, 4, 5, 0, 7); c.fill();
    c.strokeStyle = 'rgba(110,60,25,.95)'; c.lineWidth = 3; c.beginPath(); c.moveTo(34, 4); c.lineTo(34, -26); c.stroke(); // handle
    c.fillStyle = 'rgba(120,65,25,.95)'; c.strokeStyle = LEAD; c.lineWidth = 1;
    c.beginPath(); c.roundRect(22, -38, 24, 13, 3); c.fill(); c.stroke();
    c.restore();
    if (gavel.flash > 0) { // impact lines
      gavel.flash -= dt;
      c.strokeStyle = LEAD; c.lineWidth = 1.4;
      for (const [a, b, e, f] of [[178, 104, 172, 92], [196, 102, 202, 90], [204, 112, 216, 108], [170, 112, 158, 108]]) { c.beginPath(); c.moveTo(a, b); c.lineTo(e, f); c.stroke(); }
    }
  }

  function drawClock(x, y, r) {
    const d = new Date();
    c.fillStyle = 'rgba(255,253,245,.9)'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = LEAD; c.lineWidth = 1.6; c.stroke();
    const hand = (a, len, w) => { c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len); c.stroke(); };
    hand(((d.getHours() % 12) + d.getMinutes() / 60) * (Math.PI / 6), r * 0.5, 2);
    hand((d.getMinutes() + d.getSeconds() / 60) * (Math.PI / 30), r * 0.75, 1.3);
    c.strokeStyle = 'rgba(190,30,40,.8)'; hand(d.getSeconds() * (Math.PI / 30), r * 0.8, 0.8);
  }

  cv.resized = (w, h, { dprOnly } = {}) => { if (!dprOnly) build(); else if (box) sprites(); };
  build();
  say(judgeLine());

  k.loop((dt, t) => {
    c.drawImage(paper, 0, 0, cv.w, cv.h);
    if (top) { // the case name, and the clock with the real time on it
      const cr = Math.min(16, top.h * 0.32);
      drawClock(top.x + 22 + cr, top.y + top.h / 2, cr);
      const tx = top.x + 22 + cr * 2 + 16;
      const f = k.fit(c, caseTitle(), top.r - tx - 20, { size: 18, min: 11, weight: 700, family: 'hand' });
      Object.assign(c, { fillStyle: '#2a2633', textAlign: 'left', textBaseline: 'middle' });
      c.fillText(f.text, tx, top.y + top.h / 2 + 1);
    }
    if (!box) return;
    mood.age += dt;
    if (mood.kind === 'answered' && mood.age > 4.5) mood = { kind: 'idle', age: 0 };
    if (!k.reduced && Math.floor(t * 2) % 2 === 0) say(judgeLine()); // time-based lines, checked twice a second
    c.save(); c.translate(box.x, box.y); c.scale(box.s, box.s);
    const L = layers;
    const blit = (l) => c.drawImage(l.el, l.x, l.y, l.w, l.h);
    blit(L.static_);
    blit(L.back);
    for (const d of ducks) if (d.row === 0) drawDuck(d, dt, t);
    blit(L.rail);
    for (const d of ducks) if (d.row === 1) drawDuck(d, dt, t);
    blit(L.front);
    blit(L.easel);
    if (ctx.front !== 'waiting') { // the judge, unless it's a recess
      const lean = ctx.front === 'question' && ctx.cardTime > 70 ? Math.sin(t * 0.8) * 2 : 0;
      c.save(); c.translate(lean, 0); blit(L.judge); c.restore();
      drawGavel(dt);
    } else {
      Object.assign(c, { font: k.font(13, 700, 'hand'), fillStyle: 'rgba(40,36,50,.7)', textAlign: 'center' });
      c.fillText('(back in 5)', 130, 100);
    }
    blit(L.bench);
    if (bubble) {
      bubble.age += dt;
      const p = k.ease.outBack(k.clamp(bubble.age / 0.3));
      c.save(); c.translate(168, 6 + bubble.spr.h); c.scale(p, p); c.globalAlpha = k.clamp(bubble.age * 5);
      c.drawImage(bubble.spr.el, -10, -bubble.spr.h, bubble.spr.w, bubble.spr.h);
      c.restore();
    }
    c.restore();
  }, { still: 2 });

  return {
    question() {
      mood = { kind: 'idle', age: 0 };
      if (box) layers.easel = easelSprite(exhibitText());
      say(judgeLine());
      if (ctx.front === 'question' && !k.reduced) bang(1);
    },
    layout() { build(); say(judgeLine()); },
    event(name) { if (name === 'stat' && top) { const h = k.space().hud; top.r = Math.min(top.x + top.w, h ? h.left + 8 : Infinity); } },
    status() { if (ctx.front !== 'question') say(judgeLine()); },
    decisions() { if (ctx.front === 'done' && box) { layers.easel = easelSprite(exhibitText()); say(judgeLine()); } },
    answer(a) {
      const cheer = !!a.tookRec || (!a.hasRec && !!a.picks?.length);
      const line = !a.picks?.length ? 'Unusual. The court will allow it.' : a.tookRec ? 'Sustained! The ducks agree.' : a.hasRec ? 'Objection noted. Bold, counsel.' : 'So ordered.';
      mood = { kind: 'answered', age: 0, cheer, line };
      say(line);
      if (!k.reduced) bang(3);
      if (cheer) { k.sfx.cheer({ gain: 0.4, pitch: 1.6 }); if (box) k.burst(box.x + 580 * box.s, box.y + 140 * box.s, { n: 30, shape: 'mix', speed: 380 }); } else k.sfx.boing({ pitch: 0.6, gain: 0.4 });
    },
  };
}
