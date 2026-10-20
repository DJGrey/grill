// Zen garden. Raked sand; your cursor drags the rake. The stones are this question's options
// (the ★ one is the big mossy one), a haiku is written in the sand, and a bamboo deer-scarer
// fills while you think and tips with a tock when you answer.

const TINES = 5;
const TG = 8; // tine gap
const SW = (TINES - 1) * TG + 12; // swath the rake smooths
const HANDLE = 74; // cursor to rake head
const PX_PER_M = 3780; // CSS px in a metre, near enough
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const word = (n) => NUM[n] ?? String(n);
const LAST = ['the sand does not judge', 'breathe in. then decide', 'the agent waits, calmly', 'press enter, little one', 'a rake cannot choose', 'the stones have opinions'];
const MILESTONES = { 1: 'One metre of sand raked. Inner peace: loading.', 5: 'Five metres. The monks are quietly impressed.', 10: 'Ten metres. The question is still there, but calmer.', 25: '25 metres. You have raked a small car park.' };
const STONE_SAYS = ['…', 'the stone is silent', 'the stone is thinking', 'it is a rock', 'ask the ★ one'];

export default function zenGarden(k, ctx) {
  const sand = k.canvas({ alpha: false });
  const sc = sand.ctx;
  const deco = k.canvas(); // stones, plaques, the fountain's frame: redrawn on layout only
  const dc = deco.ctx;
  const fx = k.canvas(); // the rake, the bamboo, water, petals, words
  const c = fx.ctx;
  const icon = k.canRender('🪨', 'emoji') ? '🪨' : '〰️';
  const meta = { icon, label: 'Metres of sand raked', says: 'raked {n} metre{s} of sand' };

  let pattern = null;
  let rocks = []; // { x, y, r, rec, label, sprite }
  let keepOut = null; // Path2D: everything but the stones, so grooves go round them
  let fountain = null; // { x, y } pivot
  let sig = '';
  const head = { on: false, x: 0, y: 0, dx: 0, dy: -1 };
  const last = { x: 0, y: 0, dx: 0, dy: 1 };
  let raked = 0;
  const shishi = { fill: 0.35, a: -0.42, phase: 'fill', t: 0, drops: [], ripples: [] };
  const petals = [];
  const words = [];
  let L = null;

  // ── sand ─────────────────────────────────────────────────────────────────

  function makePattern() {
    const t = document.createElement('canvas');
    const n = Math.round(220 * sand.dpr);
    t.width = t.height = n;
    const g = t.getContext('2d');
    g.fillStyle = '#e7d9b6';
    g.fillRect(0, 0, n, n);
    const r = k.rng(11);
    for (let i = 0; i < n * n / 26; i++) {
      g.fillStyle = r.chance(0.55) ? `rgba(130,100,60,${r.rand(0.05, 0.16)})` : `rgba(255,252,240,${r.rand(0.2, 0.5)})`;
      const s = r.rand(0.6, 1.6) * sand.dpr;
      g.fillRect(r.rand(n), r.rand(n), s, s);
    }
    pattern = sc.createPattern(t, 'repeat');
    pattern.setTransform(new DOMMatrix().scale(1 / sand.dpr));
  }

  // A raked groove: a dark furrow with the light catching its lower lip.
  function groove(g, path, w = 1) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.save();
    g.translate(0.9, 1.1);
    g.strokeStyle = '#f7eedb';
    g.lineWidth = 1.7 * w;
    path(g);
    g.stroke();
    g.restore();
    g.strokeStyle = '#c4ac80';
    g.lineWidth = 2.1 * w;
    path(g);
    g.stroke();
    g.save();
    g.translate(-0.5, -0.6);
    g.strokeStyle = 'rgba(150,120,78,.55)';
    g.lineWidth = 0.9 * w;
    path(g);
    g.stroke();
    g.restore();
  }

  function haiku() {
    const q = ctx.question;
    const r = k.rng(q?.id || ctx.front);
    if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      return [`${word(n)} decision${n === 1 ? '' : 's'} made`.replace(/^./, (m) => m.toUpperCase()), 'like stones in raked sand', 'now go ship the thing'];
    }
    if (!q) return ctx.agent === 'listening'
      ? ['The agent listens', 'the sand listens also', 'say something nice']
      : ['The agent is thinking', 'so is the sand', 'so, perhaps, are you'];
    const rec = q.recommended[0];
    return [
      `Question ${word(q.n)} of ${word(q.total)}`,
      rec ? `“${k.clip(rec, 30)}”, says the stone` : q.options.length ? `${word(q.options.length)} stone${q.options.length === 1 ? '' : 's'}. No star.` : 'no stones here. only sand',
      r.pick(LAST),
    ];
  }

  // The garden as the gardener left it: long parallel lines, rings round every stone, a poem.
  function garden() {
    const W = sand.w, H = sand.h;
    sc.fillStyle = pattern;
    sc.fillRect(0, 0, W, H);
    sc.save();
    if (keepOut) sc.clip(keepOut, 'evenodd');
    groove(sc, (g) => {
      g.beginPath();
      for (let y = 3; y < H + 8; y += TG) {
        for (let x = -10; x <= W + 24; x += 24) {
          const yy = y + Math.sin(x / 260 + y / 900) * 3;
          x < 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
        }
      }
    });
    for (const s of rocks) {
      const R = s.r + 14 + 4 * TG;
      sc.fillStyle = pattern;
      sc.beginPath();
      sc.ellipse(s.x, s.y, R + 4, (R + 4) * 0.72, 0, 0, Math.PI * 2);
      sc.fill();
      groove(sc, (g) => {
        g.beginPath();
        for (let j = 0; j < 5; j++) {
          const rr = s.r + 10 + j * TG;
          g.moveTo(s.x + rr, s.y);
          g.ellipse(s.x, s.y, rr, rr * 0.72, 0, 0, Math.PI * 2);
        }
      });
    }
    sc.restore();
    if (poem) writePoem();
  }

  let poem = null; // { x, y, w, lines, one }
  // One line per haiku line, wrapped if it must be (the syllables were never going to work anyway).
  function writePoem() {
    const { x, y, lines, one } = poem;
    let size = one ? 17 : 20;
    const set = () => { sc.font = `italic ${k.font(size, 500, 'serif')}`; };
    let rows;
    const layout = () => {
      set();
      if (one) {
        const t = lines.join('  /  ');
        while (size > 13 && sc.measureText(t).width > poem.w) { size--; set(); }
        return [{ t: k.ellipsize(sc, t, poem.w), dx: 0 }];
      }
      return lines.flatMap((l, i) => k.wrap(sc, l, poem.w - i * 14 - 16, 2).map((t, j) => ({ t, dx: i * 14 + (j ? 16 : 0) })));
    };
    rows = layout();
    while (!one && rows.length > 4 && size > 16) { size -= 2; rows = layout(); }
    const lh = size * 1.42;
    const w = Math.max(...rows.map((r) => r.dx + sc.measureText(r.t).width));
    const h = rows.length * lh + (poem.tiny ? 8 : 26);
    sc.fillStyle = pattern; // a smoothed patch to write in
    sc.beginPath();
    sc.ellipse(x + w / 2, y + h / 2 - 12, w / 2 + 34, h / 2 + 14, 0, 0, Math.PI * 2);
    sc.fill();
    sc.textBaseline = 'middle';
    rows.forEach(({ t, dx }, i) => {
      const ty = y + i * lh;
      sc.fillStyle = 'rgba(255,250,236,.95)';
      sc.fillText(t, x + dx + 1, ty + 1.3);
      sc.fillStyle = 'rgba(122,92,52,.85)';
      sc.fillText(t, x + dx, ty);
    });
    sc.font = k.font(10.5, 600, 'sans');
    sc.fillStyle = 'rgba(122,92,52,.5)';
    if (!poem.tiny) sc.fillText('(syllables not checked)', x + (one ? 0 : 28), y + rows.length * lh + 2);
  }

  // ── stones and plaques ─────────────────────────────────────────────────

  function stone(r, rec, seed) {
    const rn = k.rng(seed);
    const pad = 22;
    const s = document.createElement('canvas');
    s.width = s.height = Math.ceil((r * 2 + pad * 2) * deco.dpr);
    const g = s.getContext('2d');
    g.scale(deco.dpr, deco.dpr);
    g.translate(r + pad, r + pad);
    const n = 16;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const d = r * rn.rand(0.84, 1.06);
      return [Math.cos(a) * d, Math.sin(a) * d * 0.78 - (Math.sin(a) < 0 ? r * 0.08 : 0)];
    });
    const shape = new Path2D();
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % n];
      const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      i ? shape.quadraticCurveTo(p[0], p[1], m[0], m[1]) : shape.moveTo(m[0], m[1]);
    });
    shape.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    g.save(); // shadow on the sand
    g.filter = `blur(${r * 0.18}px)`;
    g.fillStyle = 'rgba(70,50,20,.38)';
    g.translate(r * 0.16, r * 0.3);
    g.fill(shape);
    g.restore();
    const body = g.createLinearGradient(-r, -r, r * 0.6, r);
    body.addColorStop(0, rec ? '#a7a69b' : '#a3a8ac');
    body.addColorStop(0.5, rec ? '#6f6e64' : '#6c7378');
    body.addColorStop(1, rec ? '#3d3c35' : '#3b4045');
    g.fillStyle = body;
    g.fill(shape);
    g.save();
    g.clip(shape);
    for (let i = 0; i < r * 5; i++) { // speckle
      g.fillStyle = rn.chance(0.5) ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.14)';
      g.fillRect(rn.rand(-r, r), rn.rand(-r, r), rn.rand(0.8, 2), rn.rand(0.8, 2));
    }
    const shade = g.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.2);
    shade.addColorStop(0, 'rgba(255,255,255,.28)');
    shade.addColorStop(0.5, 'rgba(255,255,255,0)');
    shade.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = shade;
    g.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
    const moss = rec ? 26 : rn.int(0, 6); // the ★ stone is the mossy one
    for (let i = 0; i < moss; i++) {
      const a = rn.rand(Math.PI * 1.05, Math.PI * 1.95), d = r * rn.rand(0.1, 0.75);
      g.fillStyle = rn.pick(['#5f7f35', '#4d6c2a', '#789a43', '#3e5a22']);
      g.beginPath();
      g.ellipse(Math.cos(a) * d, Math.sin(a) * d * 0.7 - r * 0.12, rn.rand(2, r * 0.22), rn.rand(1.5, r * 0.13), rn.rand(3), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.18)';
    g.lineWidth = 1.2;
    g.stroke(shape);
    return { el: s, size: r * 2 + pad * 2, dpr: deco.dpr };
  }

  function plaque(g, x, y, text, rec, maxW, side = false) {
    g.font = k.font(11.5, 650, 'sans');
    const lines = k.wrap(g, text, Math.min(maxW, 180) - 16, maxW < 130 ? 3 : 2);
    const w = Math.min(Math.max(...lines.map((l) => g.measureText(l).width)) + 18, Math.max(60, maxW));
    const h = lines.length * 14 + 10;
    g.save();
    g.translate(side ? x + w / 2 : x, side ? y - h / 2 - 4 : y);
    g.rotate((k.hash(text) % 7 - 3) * 0.008);
    g.fillStyle = 'rgba(60,40,15,.28)'; // stake shadow and stake
    g.fillRect(2, h - 2, 4, 16);
    g.fillStyle = '#6d4a26';
    g.fillRect(-2, h - 4, 4, 16);
    g.shadowColor = 'rgba(60,40,15,.35)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 2;
    const wood = g.createLinearGradient(0, 0, 0, h);
    wood.addColorStop(0, '#b98a55');
    wood.addColorStop(1, '#93673a');
    g.fillStyle = wood;
    g.beginPath();
    g.roundRect(-w / 2, 0, w, h, 3);
    g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(70,40,10,.25)';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-w / 2 + 3, 4 + i * h / 3); g.bezierCurveTo(-w / 6, 2 + i * h / 3, w / 6, 7 + i * h / 3, w / 2 - 3, 4 + i * h / 3); g.stroke(); }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, i) => {
      g.fillStyle = 'rgba(255,230,190,.35)';
      g.fillText(l, 0, 10 + i * 14 + 0.8);
      g.fillStyle = rec && i === 0 ? '#2a1606' : '#3a2410';
      g.fillText(l, 0, 10 + i * 14);
    });
    g.restore();
  }

  function items() {
    const q = ctx.question;
    if (ctx.front === 'done') {
      const n = Math.min(7, ctx.decisions.length || ctx.answers.length || 1);
      return Array.from({ length: n }, (_, i) => ({ label: `D${ctx.decisions[i]?.n ?? i + 1}`, rec: false, small: true }));
    }
    if (!q) return [{ label: ctx.agent === 'listening' ? 'the agent (listening)' : 'the agent (thinking)', rec: true }];
    if (!q.options.length) return [{ label: 'no options. only sand.', rec: false }];
    const opts = q.options.slice(0, 5).map((o) => ({ label: o.label, rec: o.recommended }));
    if (q.options.length > 5) opts[4].label = `+${q.options.length - 4} more stones`;
    return opts;
  }

  // Where everything goes: the biggest open gap gets the poem, the stones and, if there's room, the fountain.
  function plan() {
    const sp = k.space();
    const gap = sp.gaps.find((g) => g.where !== 'top' && g.w > 240 && g.h > 110) || sp.gaps.find((g) => g.w > 240 && g.h > 90);
    rocks = [];
    poem = null;
    fountain = null;
    if (!gap) return '';
    const r = k.rng(ctx.question?.id || ctx.front);
    const its = items();
    let x0 = gap.x + 24, x1 = gap.x + gap.w - 24;
    const y0 = gap.y + 10, y1 = gap.y + gap.h - 16;
    const lines = haiku();
    if (gap.w > 620 && gap.h > 190) {
      const pw = Math.min(310, gap.w * 0.36);
      poem = { x: x0 + 14, y: y0 + Math.max(26, (gap.h - 130) * 0.35), w: pw - 40, lines, one: false };
      x0 += pw;
    } else if (gap.h > 150) {
      poem = { x: x0 + 14, y: y0 + 16, w: x1 - x0 - 28, lines, one: true };
    } else { // a short gap is all stones; the poem goes up top if there's room
      const tg = sp.gaps.find((g) => g.where === 'top' && g.h >= 34 && g.w > 300);
      poem = tg ? { x: tg.x + 24, y: tg.y + tg.h / 2 - 2, w: tg.w - 48, lines, one: true, tiny: true } : null;
    }
    const top = poem?.one && !poem.tiny ? y0 + 48 : y0;
    if (gap.w > 720 && gap.h > 210) {
      fountain = { x: x1 - 96, y: top + (y1 - top) * 0.5 };
      x1 -= 160;
    }
    const n = its.length;
    const step = (x1 - x0) / n;
    if (y1 - top < 150) { // a short gap: plaques go beside their stones
      its.forEach((it, i) => {
        const rad = Math.min((y1 - top) / 2 - 8, it.small ? r.rand(11, 15) : it.rec ? 26 : r.rand(15, 21));
        rocks.push({ ...it, side: true, r: rad, x: x0 + step * i + rad + 10, y: (top + y1) / 2 + r.rand(-6, 6), w: step - rad * 2 - 30 });
      });
      return sigOf();
    }
    its.forEach((it, i) => {
      const maxR = Math.max(12, (y1 - top - 56) / 2);
      const rad = Math.min(maxR, it.small ? r.rand(14, 19) : it.rec ? k.clamp(step * 0.3, 20, 38) : k.clamp(step * r.rand(0.16, 0.22), 14, 28));
      const room = y1 - top - rad * 1.6 - 50;
      rocks.push({ ...it, r: rad, x: x0 + step * (i + 0.5) + r.rand(-step, step) * 0.12, y: top + rad + 8 + Math.max(0, room) * r.rand(0.15, 0.75), w: step - 10 });
    });
    return sigOf();
  }

  const sigOf = () => JSON.stringify([rocks.map((s) => [Math.round(s.x / 20), Math.round(s.y / 20), s.label, s.rec]), poem, fountain && [Math.round(fountain.x / 20), Math.round(fountain.y / 20)]]);

  function drawDeco() {
    dc.clearRect(0, 0, deco.w, deco.h);
    for (const s of rocks) {
      if (s.sprite?.dpr !== deco.dpr) s.sprite = stone(s.r, s.rec, `${s.label}${s.r | 0}`);
      dc.drawImage(s.sprite.el, s.x - s.sprite.size / 2, s.y - s.sprite.size / 2, s.sprite.size, s.sprite.size);
    }
    for (const s of rocks) {
      const text = `${s.rec && ctx.question ? '★ ' : ''}${s.label}`;
      if (s.side) plaque(dc, s.x + s.r + 12, s.y, text, s.rec, s.w, true);
      else plaque(dc, s.x, s.y + s.r * 0.78 + 12, text, s.rec, s.w);
    }
    if (fountain) shishiFrame(dc);
  }

  function build() {
    sig = plan();
    keepOut = new Path2D();
    keepOut.rect(-50, -50, sand.w + 100, sand.h + 100);
    for (const s of rocks) {
      keepOut.moveTo(s.x + s.r + 3, s.y);
      keepOut.ellipse(s.x, s.y, s.r + 3, (s.r + 3) * 0.8, 0, 0, Math.PI * 2);
    }
    garden();
    drawDeco();
  }

  // ── the deer scarer (shishi-odoshi) ─────────────────────────────────────

  const pivotOf = () => ({ px: fountain.x - 40, py: fountain.y - 18 });

  function bamboo(g, x0, y0, x1, y1, w, dark) {
    const a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
    g.save();
    g.translate(x0, y0);
    g.rotate(a);
    const grad = g.createLinearGradient(0, -w / 2, 0, w / 2);
    grad.addColorStop(0, dark ? '#86955a' : '#a6c066');
    grad.addColorStop(0.45, dark ? '#5e6e33' : '#6f9236');
    grad.addColorStop(1, dark ? '#3c4920' : '#455f1f');
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(0, -w / 2, len, w, w * 0.25);
    g.fill();
    g.fillStyle = 'rgba(40,55,15,.55)';
    for (let x = len * 0.32; x < len - 6; x += len * 0.36) g.fillRect(x, -w / 2, 2.2, w);
    g.restore();
  }

  function shishiFrame(g) { // the fixed parts: basin, posts, strike stone, spout
    const { x, y } = fountain;
    const { px, py } = pivotOf();
    g.fillStyle = 'rgba(70,50,20,.3)';
    g.beginPath();
    g.ellipse(x + 4, y + 8, 40, 15, 0, 0, Math.PI * 2);
    g.fill();
    const rim = g.createLinearGradient(x - 36, y - 14, x + 36, y + 14);
    rim.addColorStop(0, '#a8aaa6');
    rim.addColorStop(1, '#55585a');
    g.fillStyle = rim;
    g.beginPath();
    g.ellipse(x, y, 36, 15, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1f3a3c';
    g.beginPath();
    g.ellipse(x, y - 1, 28, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(160,210,210,.25)';
    g.beginPath();
    g.ellipse(x - 8, y - 4, 12, 3, -0.1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5d6063'; // strike stone under the closed end
    g.beginPath();
    g.ellipse(px - 30, py + 22, 13, 8, 0, 0, Math.PI * 2);
    g.fill();
    for (const dx of [-7, 7]) bamboo(g, px + dx, py + 36, px + dx, py - 6, 7, true);
    g.fillStyle = 'rgba(70,50,20,.3)';
    g.beginPath();
    g.ellipse(px + 112, py + 44, 12, 4, 0, 0, Math.PI * 2);
    g.fill();
    bamboo(g, px + 108, py + 44, px + 108, py - 74, 15, true); // the post the water comes out of
    bamboo(g, px + 108, py - 62, px + 62, py - 52, 10, false); // spout pipe
    g.fillStyle = '#2b3518';
    g.beginPath();
    g.ellipse(px + 62, py - 52, 3.2, 5.5, -0.4, 0, Math.PI * 2);
    g.fill();
  }

  function shishiStep(dt) {
    const s = shishi;
    s.t += dt;
    if (s.phase === 'fill') {
      s.fill = Math.min(1, s.fill + dt / 11);
      s.a = -0.42 + s.fill * 0.14;
      if (s.fill >= 1) tip();
    } else if (s.phase === 'tip') {
      const p = Math.min(1, s.t / 0.28);
      s.a = k.lerp(s.from, 0.55, k.ease.inQuad(p));
      if (p >= 1) { s.phase = 'pour'; s.t = 0; }
    } else if (s.phase === 'pour') {
      s.fill = Math.max(0, s.fill - dt * 2.4);
      if (k.chance(0.9)) s.drops.push({ x: 0, y: 0, vx: k.rand(40, 90), vy: k.rand(-10, 30), life: 0.6, fresh: true });
      if (s.t > 0.45) { s.phase = 'back'; s.t = 0; }
    } else if (s.phase === 'back') {
      const p = Math.min(1, s.t / 0.42);
      s.a = k.lerp(0.55, -0.42, k.ease.inQuad(p));
      if (p >= 1) {
        s.phase = 'bounce';
        s.t = 0;
        k.sfx.clack({ pitch: 0.42, gain: 1.4 }); // tock
        k.sfx.thud({ pitch: 2.4, gain: 0.35 });
        const { px, py } = pivotOf();
        say('tock', px - 34, py + 2, { size: 15, fill: '#fffaf0', life: 0.9 });
      }
    } else if (s.phase === 'bounce') {
      s.a = -0.42 - Math.sin(Math.min(1, s.t / 0.32) * Math.PI) * 0.06;
      if (s.t > 0.32) { s.phase = 'fill'; s.t = 0; }
    }
  }

  function tip() {
    if (shishi.phase !== 'fill' && shishi.phase !== 'bounce') return;
    Object.assign(shishi, { phase: 'tip', t: 0, from: shishi.a, fill: Math.max(shishi.fill, 0.6) });
  }

  function shishiDraw(dt) {
    const s = shishi;
    const { px, py } = pivotOf();
    const ca = Math.cos(s.a), sa = Math.sin(s.a);
    const at = (d) => [px + ca * d, py + sa * d];
    const [ox, oy] = at(58); // open end
    if (s.phase === 'fill' || s.phase === 'bounce') { // the trickle from the spout
      c.strokeStyle = 'rgba(200,235,240,.75)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(px + 60, py - 50);
      c.quadraticCurveTo(px + 58 + Math.sin(s.t * 13) * 0.8, (py - 50 + oy) / 2, ox - 2, oy - 4);
      c.stroke();
    }
    const [bx, by] = at(-38);
    bamboo(c, bx, by, ox, oy, 13, false);
    c.save(); // the angled cut showing the hollow
    c.translate(ox, oy);
    c.rotate(s.a);
    c.fillStyle = '#d9cf9c';
    c.beginPath();
    c.ellipse(0, 0, 3.5, 6.5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = s.fill > 0.5 ? '#2c5153' : '#3a3220';
    c.beginPath();
    c.ellipse(0.4, 0, 2.3, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.fillStyle = '#2d2a1c'; // pivot pin
    c.beginPath();
    c.arc(px, py, 2.6, 0, Math.PI * 2);
    c.fill();
    for (let i = s.drops.length - 1; i >= 0; i--) { // water pouring into the basin
      const d = s.drops[i];
      if (d.fresh) { d.fresh = false; d.x = ox; d.y = oy; }
      d.life -= dt;
      d.vy += 900 * dt;
      d.x += d.vx * dt * 0.3;
      d.y += d.vy * dt;
      if (d.y > fountain.y - 2 || d.life <= 0) {
        if (k.chance(0.25)) s.ripples.push({ x: d.x, age: 0 });
        s.drops.splice(i, 1);
        continue;
      }
      c.fillStyle = 'rgba(205,238,242,.85)';
      c.beginPath();
      c.arc(d.x, d.y, 1.8, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = s.ripples.length - 1; i >= 0; i--) {
      const r = s.ripples[i];
      r.age += dt;
      if (r.age > 0.9) { s.ripples.splice(i, 1); continue; }
      c.strokeStyle = `rgba(200,235,240,${0.5 * (1 - r.age / 0.9)})`;
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(k.clamp(r.x, fountain.x - 20, fountain.x + 20), fountain.y - 1, 3 + r.age * 18, 1 + r.age * 6, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }

  // ── the rake ────────────────────────────────────────────────────────────

  function rakeTo(x, y) {
    if (!head.on) {
      const d = Math.hypot(last.dx, last.dy) || 1;
      Object.assign(head, { on: true, dx: last.dx / d, dy: last.dy / d });
      head.x = x - head.dx * HANDLE;
      head.y = y - head.dy * HANDLE;
      return;
    }
    let dx = x - head.x, dy = y - head.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const nx = x - dx * HANDLE, ny = y - dy * HANDLE; // the head trails behind the cursor on its handle
    const moved = Math.hypot(nx - head.x, ny - head.y);
    if (moved < 0.6) return;
    const n0 = [-head.dy, head.dx], n1 = [-dy, dx];
    sc.save();
    sc.clip(keepOut, 'evenodd');
    sc.fillStyle = pattern;
    sc.beginPath();
    sc.moveTo(head.x + n0[0] * SW / 2, head.y + n0[1] * SW / 2);
    sc.lineTo(nx + n1[0] * SW / 2, ny + n1[1] * SW / 2);
    sc.lineTo(nx - n1[0] * SW / 2, ny - n1[1] * SW / 2);
    sc.lineTo(head.x - n0[0] * SW / 2, head.y - n0[1] * SW / 2);
    sc.closePath();
    sc.fill();
    groove(sc, (g) => {
      g.beginPath();
      for (let i = 0; i < TINES; i++) {
        const o = (i - (TINES - 1) / 2) * TG;
        g.moveTo(head.x + n0[0] * o, head.y + n0[1] * o);
        g.lineTo(nx + n1[0] * o, ny + n1[1] * o);
      }
    });
    sc.restore();
    for (const p of petals) { // leaves get swept along
      if (p.landed && Math.hypot(p.x - nx, p.y - ny) < SW * 0.6) { p.x += (nx - head.x) * 1.1; p.y += (ny - head.y) * 1.1; p.rot += k.rand(-0.3, 0.3); }
    }
    Object.assign(head, { x: nx, y: ny, dx, dy });
    raked += moved;
    if (raked >= PX_PER_M) {
      raked -= PX_PER_M;
      const total = k.score('sand', 1, meta);
      if (MILESTONES[total]) k.toast(MILESTONES[total], { icon });
    }
    if (k.reduced) L?.redraw();
  }

  function drawRake() {
    if (!head.on) return;
    const { x, y, dx, dy } = head;
    const nx = -dy, ny = dx;
    const hx = x + dx * (HANDLE + 70), hy = y + dy * (HANDLE + 70);
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(60,40,15,.22)'; // shadow
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(x + 7, y + 10);
    c.lineTo(hx + 7, hy + 10);
    c.moveTo(x + nx * (SW / 2 + 3) + 7, y + ny * (SW / 2 + 3) + 10);
    c.lineTo(x - nx * (SW / 2 + 3) + 7, y - ny * (SW / 2 + 3) + 10);
    c.stroke();
    c.strokeStyle = '#3d2a14'; // tines
    c.lineWidth = 2.4;
    c.beginPath();
    for (let i = 0; i < TINES; i++) {
      const o = (i - (TINES - 1) / 2) * TG;
      c.moveTo(x + nx * o, y + ny * o);
      c.lineTo(x + nx * o - dx * 5, y + ny * o - dy * 5);
    }
    c.stroke();
    c.strokeStyle = '#7b5530'; // handle
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(hx, hy);
    c.stroke();
    c.strokeStyle = 'rgba(255,225,170,.45)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(x + nx * -1.2, y + ny * -1.2);
    c.lineTo(hx + nx * -1.2, hy + ny * -1.2);
    c.stroke();
    c.strokeStyle = '#6a4523'; // head bar
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(x + nx * (SW / 2 + 3), y + ny * (SW / 2 + 3));
    c.lineTo(x - nx * (SW / 2 + 3), y - ny * (SW / 2 + 3));
    c.stroke();
    c.strokeStyle = 'rgba(255,220,160,.35)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x + nx * (SW / 2 + 2) + dx * 2, y + ny * (SW / 2 + 2) + dy * 2);
    c.lineTo(x - nx * (SW / 2 + 2) + dx * 2, y - ny * (SW / 2 + 2) + dy * 2);
    c.stroke();
  }

  // ── petals and words ────────────────────────────────────────────────────

  function petal() {
    const sp = k.space();
    const g = k.pick(sp.gaps.filter((x) => x.h > 60)) || sp.gaps[0];
    if (!g) return;
    petals.push({ x: g.x + k.rand(g.w), y: g.y - 20, ty: g.y + k.rand(30, g.h - 10), vx: k.rand(-12, 12), rot: k.rand(6), spin: k.rand(-2, 2), ph: k.rand(6), landed: false, age: 0, hue: k.rand(340, 358) });
    if (petals.length > 14) petals.shift();
  }

  function drawPetal(p) {
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    c.globalAlpha = Math.min(1, (40 - p.age) / 6);
    c.fillStyle = 'rgba(80,50,20,.18)';
    c.beginPath();
    c.ellipse(2, 3, 5, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = `hsl(${p.hue} 70% 86%)`;
    c.beginPath();
    c.moveTo(-5, 0);
    c.quadraticCurveTo(-1, -4.5, 5, -1.2);
    c.lineTo(3.6, 0);
    c.lineTo(5, 1.2);
    c.quadraticCurveTo(-1, 4.5, -5, 0);
    c.fill();
    c.restore();
  }

  function say(text, x, y, o = {}) {
    words.push({ text, x, y, age: 0, life: o.life ?? 1.4, size: o.size ?? 15, fill: o.fill ?? '#fffaf0' });
  }

  // ── input ──────────────────────────────────────────────────────────────

  k.on(window, 'pointermove', (e) => {
    const mx = e.clientX - last.x, my = e.clientY - last.y;
    if (mx || my) Object.assign(last, { dx: last.dx * 0.6 + mx * 0.4, dy: last.dy * 0.6 + my * 0.4 });
    Object.assign(last, { x: e.clientX, y: e.clientY });
  }, { passive: true, capture: true });
  k.on(k.root, 'pointermove', (e) => rakeTo(e.clientX, e.clientY));
  k.on(k.root, 'pointerleave', () => { head.on = false; if (k.reduced) L?.redraw(); });
  k.on(k.root, 'touchmove', (e) => { if (head.on && e.cancelable) e.preventDefault(); }, { passive: false }); // a finger rakes instead of scrolling the stage
  k.on(k.root, 'pointerdown', (e) => {
    const s = rocks.find((r) => Math.hypot(r.x - e.clientX, (r.y - e.clientY) / 0.8) < r.r + 4);
    if (!s) return;
    k.sfx.thud({ pitch: 1.6, gain: 0.4 });
    say(ctx.question && s.rec ? 'yes. this one.' : k.pick(STONE_SAYS), s.x, s.y - s.r - 8, { fill: '#fffaf0' });
  });

  sand.resized = (w, h, { dprOnly } = {}) => { makePattern(); if (!dprOnly) build(); }; // a DPR step keeps the raked sand
  deco.resized = () => drawDeco();
  makePattern();
  build();
  if (k.reduced) for (let i = 0; i < 7; i++) { petal(); const p = petals.at(-1); if (p) Object.assign(p, { y: p.ty, landed: true }); }

  L = k.loop((dt, t) => {
    c.clearRect(0, 0, fx.w, fx.h);
    if (!k.reduced && dt && k.chance(dt / 3.5)) petal();
    for (const p of petals) {
      p.age += dt;
      if (!p.landed) {
        p.y += dt * 34;
        p.x += (p.vx + Math.sin(t * 1.6 + p.ph) * 22) * dt;
        p.rot += p.spin * dt;
        if (p.y >= p.ty) p.landed = true;
      }
      drawPetal(p);
    }
    for (let i = petals.length - 1; i >= 0; i--) if (petals[i].age > 40) petals.splice(i, 1);
    if (fountain) {
      shishiStep(dt);
      shishiDraw(dt);
    }
    drawRake();
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      w.age += dt;
      const p = w.age / w.life;
      if (p >= 1) { words.splice(i, 1); continue; }
      c.globalAlpha = Math.min(1, (1 - p) * 3) * Math.min(1, w.age * 8);
      c.font = `italic ${k.font(w.size, 600, 'serif')}`;
      c.textAlign = 'center';
      c.fillStyle = 'rgba(60,40,15,.5)';
      c.fillText(w.text, w.x + 1, w.y - p * 18 + 1.2);
      c.fillStyle = w.fill;
      c.fillText(w.text, w.x, w.y - p * 18);
      c.globalAlpha = 1;
      c.textAlign = 'left';
    }
  }, { still: 0 });

  const refresh = () => {
    const before = sig;
    if (plan() !== before) build();
  };

  return {
    question() {
      for (const s of rocks) s.sprite = null;
      if (k.reduced) build(); else k.after(450, build);
    },
    layout: refresh,
    status() { if (!ctx.question) build(); },
    decisions() { if (ctx.front === 'done') build(); },
    answer() { tip(); },
  };
}
