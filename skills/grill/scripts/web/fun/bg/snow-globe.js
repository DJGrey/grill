// Snow globe. You're inside a giant one: a tiny town at the bottom, snow settling on the roofs, the
// ground and the top of the card. Every answer shakes it, and the townsfolk have had enough.

const HOUSES = ['#b5403a', '#3f7f86', '#d4a53a', '#8a78b5', '#e2d3b4', '#5b8a4f', '#c46f4a'];
const COL = 3; // heightmap column width
const GRUMBLES = {
  rec: ['fine. good pick.', 'every. single. answer.', 'we were SLEEPING', 'not again'],
  off: ['bold. still rude.', 'who keeps doing that', 'we were SLEEPING', 'not again'],
  poke: ['hey!', 'stop tapping the glass', 'we can see you'],
};

export default function snowGlobe(k, ctx) {
  const room = k.canvas({ alpha: false });
  const wrap = k.el('div', { style: 'position:absolute;inset:0;will-change:transform' });
  const inner = k.canvas({ parent: wrap });
  const snow = k.canvas({ parent: wrap });
  const glass = k.canvas({ parent: wrap });
  const pileCv = k.canvas();
  const flake = (() => {
    const e = document.createElement('canvas');
    e.width = e.height = 16;
    const g = e.getContext('2d');
    const rg = g.createRadialGradient(8, 8, 0, 8, 8, 8);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.45, 'rgba(255,255,255,.85)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 16, 16);
    return e;
  })();

  let G = null;
  let flakes = [];
  let ground = null, pile = null, pileTop = null, pileDirty = true;
  let energy = 1, shakeT = 9, shakeP = 0;
  let smoke = [], bubble = null;
  let head = { off: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, rest: false };
  const R = k.rng('snowglobe');

  // ── geometry ──────────────────────────────────────────────────────────────

  function layout() {
    const sp = k.space();
    const gap = sp.gaps.find((g) => g.where === 'bottom' && g.h > 90) || { x: sp.stage.x, y: sp.vh - 150, w: sp.stage.width, h: 150 };
    const s = Math.max(0.55, Math.min(1.1, gap.h / 270));
    const hb = Math.max(52, Math.min(92, gap.h * 0.33));
    const baseTop = sp.vh - hb;
    const cx = sp.stage.x + sp.stage.width / 2;
    const halfW = Math.min(gap.w * 0.38, 360);
    const Rr = Math.max(sp.vw, sp.vh) * 0.64;
    const cy = baseTop - Math.sqrt(Rr * Rr - halfW * halfW);
    const groundY = baseTop - Math.max(14, 34 * s);
    G = { sp, gap, s, hb, baseTop, cx, cy, R: Rr, halfW, groundY, vw: sp.vw, vh: sp.vh };
    G.cols = Math.ceil(sp.vw / COL) + 1;
    if (!ground || ground.length !== G.cols) ground = new Float32Array(G.cols).fill(3 * s);
    buildTown();
    buildPile();
    drawRoom(room.w, room.h);
    drawInner(inner.w, inner.h);
    drawGlass(glass.w, glass.h);
  }

  // the ground: a soft hill along the bottom of the globe
  const hill = (x) => {
    const u = (x - G.cx) / (G.halfW * 1.25);
    return G.groundY - Math.max(0, 1 - u * u) * 14 * G.s - Math.sin(x * 0.013) * 3 * G.s;
  };
  const insideAt = (y) => { const d = y - G.cy; return d > G.R ? 0 : Math.sqrt(G.R * G.R - d * d); };

  function buildTown() {
    const r = k.rng(`town${Math.round(G.halfW)}`);
    const { s, cx, halfW } = G;
    const span = halfW * 0.86;
    G.houses = [];
    G.trees = [];
    let x = cx - span;
    let i = 0;
    while (x < cx + span) {
      const church = i === 2;
      const w = (church ? 46 : r.rand(36, 56)) * s;
      const h = (church ? 52 : r.rand(26, 40)) * s;
      const rh = (church ? 22 : r.rand(16, 24)) * s;
      if (r.chance(0.45) && !church) {
        const th = r.rand(34, 58) * s;
        G.trees.push({ x: x + 10 * s, h: th, w: th * 0.55 });
        x += th * 0.5;
      }
      const hx = x + w / 2;
      G.houses.push({ x: hx, w, h, rh, col: church ? '#e8dcc4' : r.pick(HOUSES), church, chim: !church && r.chance(0.6), wins: Array.from({ length: church ? 1 : r.int(2, 3) }, () => ({ lit: r.chance(0.35), next: r.rand(4, 30) })), cap: 2 * s });
      x += w + r.rand(6, 18) * s;
      i++;
    }
    const yard = G.houses.filter((h) => !h.church).sort((a, b) => Math.abs(a.x - cx + 30 * s) - Math.abs(b.x - cx + 30 * s))[0]; // one plot is a front yard with a snowman
    G.houses.splice(G.houses.indexOf(yard), 1);
    G.snowman = { x: yard.x, s };
    for (const h of G.houses) h.y = hill(h.x);
    for (const t of G.trees) t.y = hill(t.x);
    G.lamp = { x: G.houses[1] ? G.houses[1].x + G.houses[1].w / 2 + 10 * s : cx, y: 0 };
    G.lamp.y = hill(G.lamp.x);
    G.snowman.y = hill(G.snowman.x);
    if (!head.off) Object.assign(head, { rest: false });
  }

  // Snow lands on the top edge of the card stack (the cards peeking out behind the front one too).
  function tops() {
    const front = k.rect(k.ui.card());
    const t = new Float32Array(G.cols).fill(Infinity);
    if (!front) return t;
    const cards = [...document.querySelectorAll('#stack .ghost.on')].map((e) => k.rect(e)).filter((r) => r && r.bottom >= front.top - 1 && r.top <= front.top);
    for (const rc of [front, ...cards]) {
      for (let c = Math.ceil((rc.left + 14) / COL); c <= Math.floor((rc.right - 14) / COL); c++) if (c >= 0 && c < G.cols) t[c] = Math.min(t[c], Math.round(rc.top));
    }
    return t;
  }

  function buildPile() {
    const t = tops();
    if (pileTop && pile && pileTop.length === t.length && t.every((v, i) => v === pileTop[i])) return;
    if (pile && pileTop && !k.reduced) { // what was on the old edge slides off as loose snow
      for (let c = 0; c < pile.length; c++) if (pile[c] > 1.5 && pileTop[c] < Infinity && Math.random() < 0.6) revive(c * COL, pileTop[c] - pile[c], k.rand(-40, 40), k.rand(-30, 10));
    }
    pileTop = t;
    pile = new Float32Array(G.cols);
    if (k.reduced) { // a still frame: already snowed on
      for (let c = 0; c < pile.length; c++) if (pileTop[c] < Infinity) pile[c] = 7 + Math.sin(c * 0.21) * 2.5 + Math.sin(c * 0.05) * 3;
      drawPile();
    }
    pileDirty = true;
  }

  // ── static drawing ────────────────────────────────────────────────────────

  function drawRoom(w, h) {
    if (!G) return;
    const c = room.ctx;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#20162a');
    g.addColorStop(1, '#3a2230');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.025)';
    for (let x = 0; x < w; x += 46) c.fillRect(x, 0, 18, h);
    const r = k.rng(3);
    for (let i = 0; i < 40; i++) { // fairy lights, out of focus
      const x = r.rand(w), y = r.rand(h * 0.35, h), rad = r.rand(14, 40);
      const col = r.pick(['255,190,90', '255,120,120', '140,220,255', '255,230,160', '190,255,170']);
      const bg = c.createRadialGradient(x, y, 0, x, y, rad);
      bg.addColorStop(0, `rgba(${col},.32)`);
      bg.addColorStop(0.7, `rgba(${col},.12)`);
      bg.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = bg;
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    c.fillStyle = '#2a1712'; // the shelf it sits on
    c.fillRect(0, h - 18, w, 18);
    c.fillStyle = 'rgba(255,200,150,.18)';
    c.fillRect(0, h - 18, w, 1.5);
  }

  const circle = (c) => { c.beginPath(); c.arc(G.cx, G.cy, G.R, 0, Math.PI * 2); };

  function drawInner(w, h) {
    if (!G) return;
    const c = inner.ctx;
    const { s, cx, cy, R: Rr } = G;
    c.clearRect(0, 0, w, h);
    c.save();
    circle(c);
    c.clip();
    const sky = c.createLinearGradient(0, 0, 0, G.baseTop);
    sky.addColorStop(0, '#0b1d3a');
    sky.addColorStop(0.55, '#1d3f6b');
    sky.addColorStop(0.85, '#4f78a8');
    sky.addColorStop(1, '#a9c6e4');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    const r = k.rng(8);
    for (let i = 0; i < 120; i++) { // stars
      c.fillStyle = `rgba(255,255,255,${r.rand(0.2, 0.8)})`;
      c.fillRect(r.rand(w), r.rand(G.baseTop * 0.75), r.rand(0.8, 1.8), r.rand(0.8, 1.8));
    }
    // distant snowy hills
    c.fillStyle = '#c7d8ec';
    c.beginPath();
    c.moveTo(0, G.groundY);
    for (let x = 0; x <= w; x += 20) c.lineTo(x, G.groundY - 22 * s - Math.sin(x * 0.006 + 1) * 14 * s - Math.sin(x * 0.017) * 5 * s);
    c.lineTo(w, h); c.lineTo(0, h); c.closePath();
    c.fill();
    // the town
    for (const t of G.trees) tree(c, t.x - 30 * s, hill(t.x - 30 * s) - 8 * s, t.h * 0.6, t.w * 0.6, '#5b7d8f');
    for (const hs of G.houses) house(c, hs);
    for (const t of G.trees) tree(c, t.x, t.y + 2, t.h, t.w, '#1d5a45');
    // lamp post
    const L = G.lamp;
    c.strokeStyle = '#26303a';
    c.lineWidth = 3 * s;
    c.beginPath(); c.moveTo(L.x, L.y + 2); c.lineTo(L.x, L.y - 40 * s); c.stroke();
    c.fillStyle = '#26303a';
    c.fillRect(L.x - 5 * s, L.y - 48 * s, 10 * s, 9 * s);
    c.fillStyle = '#ffe6a6';
    c.fillRect(L.x - 3.5 * s, L.y - 46.5 * s, 7 * s, 6 * s);
    // ground in front
    const gg = c.createLinearGradient(0, G.groundY - 20 * s, 0, h);
    gg.addColorStop(0, '#f4f8ff');
    gg.addColorStop(1, '#bcd0e8');
    c.fillStyle = gg;
    c.beginPath();
    c.moveTo(0, hill(0));
    for (let x = 0; x <= w; x += 6) c.lineTo(x, hill(x));
    c.lineTo(w, h); c.lineTo(0, h); c.closePath();
    c.fill();
    c.restore();
    // edge of the glass: darker towards the rim
    const rim = c.createRadialGradient(cx, cy, Rr * 0.82, cx, cy, Rr);
    rim.addColorStop(0, 'rgba(8,20,40,0)');
    rim.addColorStop(1, 'rgba(8,20,40,.45)');
    c.save(); circle(c); c.clip();
    c.fillStyle = rim;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  function tree(c, x, y, h, w, col) {
    for (let i = 0; i < 3; i++) {
      const ty = y - h * (0.18 + i * 0.27), tw = w * (1 - i * 0.25);
      c.fillStyle = col;
      c.beginPath(); c.moveTo(x - tw / 2, ty + h * 0.2); c.lineTo(x, ty - h * 0.3); c.lineTo(x + tw / 2, ty + h * 0.2); c.closePath(); c.fill();
      c.fillStyle = 'rgba(250,252,255,.92)';
      c.beginPath(); c.moveTo(x - tw * 0.22, ty - h * 0.06); c.lineTo(x, ty - h * 0.3); c.lineTo(x + tw * 0.22, ty - h * 0.06); c.quadraticCurveTo(x, ty - h * 0.0, x - tw * 0.22, ty - h * 0.06); c.fill();
    }
    c.fillStyle = '#4a3222';
    c.fillRect(x - 2, y - h * 0.12, 4, h * 0.12);
  }

  function house(c, hs) {
    const { x, y, w, h, rh, col } = hs;
    const s = G.s;
    const left = x - w / 2;
    c.fillStyle = 'rgba(30,50,80,.25)';
    c.fillRect(left + 3, y - h + 3, w, h);
    const hg = c.createLinearGradient(left, 0, left + w, 0);
    hg.addColorStop(0, col);
    hg.addColorStop(1, shade(col, 0.72));
    c.fillStyle = hg;
    c.fillRect(left, y - h, w, h + 2);
    if (hs.chim) {
      c.fillStyle = '#7a3a2a';
      c.fillRect(left + w * 0.68, y - h - rh * 0.9, 7 * s, rh * 0.75);
      hs.chimTop = { x: left + w * 0.68 + 3.5 * s, y: y - h - rh * 0.9 };
    }
    c.fillStyle = '#5a3a3a';
    c.beginPath(); c.moveTo(left - 5 * s, y - h + 1); c.lineTo(x, y - h - rh); c.lineTo(left + w + 5 * s, y - h + 1); c.closePath(); c.fill();
    if (hs.church) {
      c.fillStyle = col;
      c.fillRect(x - 8 * s, y - h - rh - 26 * s, 16 * s, 30 * s);
      c.fillStyle = '#5a3a3a';
      c.beginPath(); c.moveTo(x - 11 * s, y - h - rh - 25 * s); c.lineTo(x, y - h - rh - 50 * s); c.lineTo(x + 11 * s, y - h - rh - 25 * s); c.fill();
      c.fillStyle = '#e8c35a';
      c.fillRect(x - 0.8 * s, y - h - rh - 60 * s, 1.6 * s, 10 * s);
      c.fillRect(x - 4 * s, y - h - rh - 57 * s, 8 * s, 1.6 * s);
      hs.round = { x, y: y - h - rh - 12 * s };
    }
    c.fillStyle = '#4a2c22'; // door
    c.beginPath(); c.roundRect(x - 5 * s, y - 14 * s, 10 * s, 14 * s, [4 * s, 4 * s, 0, 0]); c.fill();
    hs.winRects = hs.wins.map((_, i) => {
      const n = hs.wins.length;
      const wx = hs.church ? x - 6 * s : left + (w / (n + 1)) * (i + 1) - 4 * s + (i === Math.floor(n / 2) && n === 3 ? 0 : 0);
      return { x: wx, y: hs.church ? y - h + 8 * s : y - h + 7 * s, w: hs.church ? 12 * s : 8 * s, h: hs.church ? 16 * s : 9 * s };
    }).filter((wr) => Math.abs(wr.x + wr.w / 2 - x) > 7 * s || hs.church);
    for (const wr of hs.winRects) { c.fillStyle = '#2a2f45'; c.fillRect(wr.x, wr.y, wr.w, wr.h); }
    hs.roof = { x0: left - 5 * s, x1: left + w + 5 * s, y0: y - h + 1, peak: y - h - rh };
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f)).join(',')})`;
  }

  function drawGlass(w, h) {
    if (!G) return;
    const c = glass.ctx;
    const { cx, cy, R: Rr, baseTop, hb, halfW } = G;
    c.clearRect(0, 0, w, h);
    c.save();
    circle(c);
    c.clip();
    c.lineCap = 'round';
    for (const [lw, a] of [[90, 0.05], [50, 0.06], [18, 0.08]]) { // the big soft reflection, top left
      c.strokeStyle = `rgba(255,255,255,${a})`;
      c.lineWidth = lw;
      c.beginPath(); c.arc(cx, cy, Rr * 0.9, Math.PI * 1.08, Math.PI * 1.42); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,.12)';
    c.lineWidth = 26;
    c.beginPath(); c.arc(cx, cy, Rr * 0.88, Math.PI * 1.5, Math.PI * 1.62); c.stroke();
    for (let i = 0; i < 24; i++) { // a sharp glint low on the right
      const a0 = Math.PI * (0.06 + i * 0.012);
      c.strokeStyle = `rgba(255,255,255,${0.55 * Math.sin((i / 23) * Math.PI)})`;
      c.lineWidth = 3;
      c.beginPath(); c.arc(cx, cy, Rr * 0.975, a0, a0 + Math.PI * 0.012); c.stroke();
    }
    c.restore();
    c.strokeStyle = 'rgba(220,235,255,.35)';
    c.lineWidth = 2;
    circle(c);
    c.stroke();
    // the base
    const tw = halfW * 2 + 40, bw = tw * 1.1;
    const wood = c.createLinearGradient(0, baseTop, 0, h);
    wood.addColorStop(0, '#6a3322');
    wood.addColorStop(0.5, '#4a2216');
    wood.addColorStop(1, '#2c130c');
    c.fillStyle = wood;
    c.beginPath();
    c.moveTo(cx - tw / 2, baseTop + 6);
    c.lineTo(cx + tw / 2, baseTop + 6);
    c.lineTo(cx + bw / 2, h + 2);
    c.lineTo(cx - bw / 2, h + 2);
    c.closePath();
    c.fill();
    const sheen = c.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    sheen.addColorStop(0, 'rgba(0,0,0,.35)');
    sheen.addColorStop(0.3, 'rgba(255,220,190,.12)');
    sheen.addColorStop(0.7, 'rgba(0,0,0,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,.4)');
    c.fillStyle = sheen;
    c.fill();
    const gold = c.createLinearGradient(0, baseTop - 4, 0, baseTop + 12);
    gold.addColorStop(0, '#f6dc8c');
    gold.addColorStop(0.5, '#c9993f');
    gold.addColorStop(1, '#7d5a1f');
    c.fillStyle = gold; // collar where the glass meets the base
    c.beginPath(); c.ellipse(cx, baseTop + 4, tw / 2 + 4, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,240,200,.6)';
    c.fillRect(cx - tw / 2 + 20, baseTop - 1, tw - 40, 1.2);
    // brass plaque
    const pw = Math.min(tw * 0.62, 400), ph = Math.min(hb - 22, 64);
    const px = cx - pw / 2, py = baseTop + 16 + (hb - 22 - ph) / 2;
    const pg = c.createLinearGradient(px, py, px + pw, py + ph);
    pg.addColorStop(0, '#f1d27c');
    pg.addColorStop(0.45, '#c99a42');
    pg.addColorStop(0.55, '#e6c46e');
    pg.addColorStop(1, '#a57a2c');
    c.fillStyle = 'rgba(0,0,0,.4)';
    c.beginPath(); c.roundRect(px + 1, py + 2, pw, ph, 5); c.fill();
    c.fillStyle = pg;
    c.beginPath(); c.roundRect(px, py, pw, ph, 5); c.fill();
    c.strokeStyle = 'rgba(90,60,15,.6)';
    c.lineWidth = 1;
    c.beginPath(); c.roundRect(px + 3.5, py + 3.5, pw - 7, ph - 7, 3); c.stroke();
    for (const sx of [px + 9, px + pw - 9]) { c.fillStyle = '#8a6424'; c.beginPath(); c.arc(sx, py + ph / 2, 2.2, 0, 7); c.fill(); }
    const lines = plaque();
    const big = ph > 46;
    const rows = big ? lines : lines.slice(0, 2);
    const sizes = big ? [9, 17, 11] : [8, Math.min(15, ph * 0.36)];
    const fams = [['sans', 700], ['serif', 800], ['serif', 500]];
    const total = rows.reduce((a, _, i) => a + sizes[i] * 1.25, 0);
    let y = py + ph / 2 - total / 2;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    rows.forEach((t, i) => {
      const f = k.fit(c, t, pw - 34, { size: sizes[i], min: i === 2 ? 10 : 7, weight: fams[i][1], family: fams[i][0] });
      if (i === 2) c.font = `italic ${c.font}`;
      c.fillStyle = 'rgba(255,245,210,.55)';
      c.fillText(f.text, cx, y + 1);
      c.fillStyle = '#4a3410';
      c.fillText(f.text, cx, y);
      y += sizes[i] * 1.25;
    });
  }

  function plaque() {
    const q = ctx.question;
    if (q) return ['G R E E T I N G S   F R O M', `QUESTION ${q.n}`, q.title];
    if (ctx.front === 'done') { const n = ctx.decisions.length || ctx.answers.length; return ['G R E E T I N G S   F R O M', 'DONEVILLE', `Population: ${n} decision${n === 1 ? '' : 's'}`]; }
    return ['G R E E T I N G S   F R O M', 'THE WAITING ROOM', ctx.agent === 'listening' ? 'The agent is listening' : 'The agent is writing questions'];
  }

  // ── snow ──────────────────────────────────────────────────────────────────

  function newFlake() {
    return { x: 0, y: 0, vx: 0, vy: 0, r: k.rand(1.2, 3.6), ph: k.rand(100), on: false };
  }
  function revive(x, y, vx = 0, vy = 0) {
    const f = flakes.find((q) => !q.on);
    if (!f) return;
    Object.assign(f, { x, y, vx, vy, on: true });
  }

  function seedSnow() {
    const n = Math.round(Math.min(900, (G.vw * G.vh) / 1700));
    flakes = Array.from({ length: n }, newFlake);
    for (const f of flakes) if (Math.random() < 0.8) Object.assign(f, { on: true, x: k.rand(G.vw), y: k.rand(-20, G.baseTop), vy: k.rand(10, 30) });
  }

  const col = (x) => Math.max(0, Math.min(G.cols - 1, Math.round(x / COL)));
  function addTo(arr, c0, a, cap) {
    for (let d = -2; d <= 2; d++) {
      const c = c0 + d;
      if (c < 0 || c >= arr.length) continue;
      arr[c] = Math.min(cap, arr[c] + a * [0.25, 0.6, 1, 0.6, 0.25][d + 2]);
    }
  }
  function slump(arr, from = 0, to = arr.length - 1) {
    for (let c = from; c < to; c++) {
      const d = arr[c] - arr[c + 1];
      if (Math.abs(d) > 1.6) { const m = d * 0.25; arr[c] -= m; arr[c + 1] += m; }
    }
  }

  function shake(power, why) {
    if (k.reduced) return;
    shakeT = 0;
    shakeP = power;
    energy = Math.min(1, energy + power);
    for (const f of flakes) if (f.on) { f.vx += k.rand(-1, 1) * 380 * power; f.vy += k.rand(-1.2, 0.2) * 380 * power; }
    // the settled snow is thrown back up
    for (let c = 0; c < ground.length; c++) {
      const lift = ground[c] * 0.75 * power;
      if (lift > 0.5 && Math.random() < 0.7) revive(c * COL, hill(c * COL) - ground[c], k.rand(-200, 200) * power, k.rand(-420, -120) * power);
      ground[c] -= lift;
    }
    for (const hs of G.houses) hs.cap = Math.max(2 * G.s, hs.cap * (1 - 0.8 * power));
    if (power > 0.6 && !head.off) {
      Object.assign(head, { off: true, rest: false, x: G.snowman.x, y: G.snowman.y - 44 * G.snowman.s, vx: k.pick([-1, 1]) * k.rand(60, 120), vy: -k.rand(160, 240), vr: k.rand(-8, 8), rot: 0 });
    }
    for (const hs of G.houses) for (const w of hs.wins) { w.lit = true; w.next = k.rand(4, 26); } // everyone's awake now
    const lines = why === 'poke' ? GRUMBLES.poke : why === 'rec' ? GRUMBLES.rec : GRUMBLES.off;
    const hs = k.pick(G.houses.filter((h) => h.x > G.gap.x + 60 && h.x < G.gap.x + G.gap.w - 60)) || G.houses[0];
    if (hs) k.after(why === 'poke' ? 150 : 350, () => { bubble = { x: hs.x, y: hs.y - hs.h - hs.rh, text: head.off && why !== 'poke' && Math.random() < 0.5 ? 'MY SNOWMAN' : k.pick(lines), age: 0 }; });
    k.sfx.whoosh({ gain: 0.35 * power, pitch: 0.8 });
    k.sfx.noise({ dur: 0.9, color: 'pink', filter: 'bandpass', freq: 3000, q: 0.8, gain: 0.05 * power, attack: 0.05 });
    [1568, 1318.5, 1046.5, 1174.7, 1318.5].forEach((f, i) => k.sfx.tone({ freq: f, dur: 0.6, gain: 0.04, delay: 0.25 + i * 0.16 })); // a music box, of course
  }

  function step(dt, t) {
    if (!G) return;
    const { s } = G;
    // shake the whole globe
    shakeT += dt;
    const sd = shakeT < 1.1 ? (1 - shakeT / 1.1) ** 2 * shakeP : 0;
    wrap.style.transform = sd > 0.001 ? `translate(${Math.sin(shakeT * 34) * 16 * sd}px,${Math.cos(shakeT * 27) * 7 * sd}px) rotate(${Math.sin(shakeT * 21) * 1.2 * sd}deg)` : '';
    energy = Math.max(0, energy - dt / 40);
    const swirl = 6 + energy * 90;

    for (const f of flakes) {
      if (!f.on) continue;
      const vt = (12 + f.r * 7) * (1 - energy * 0.4);
      const wind = Math.sin(t * 0.6 + f.y * 0.009 + f.ph) * swirl + Math.cos(t * 0.37 + f.x * 0.006) * swirl * 0.6;
      f.vx += (wind - f.vx) * Math.min(1, dt * 1.4);
      f.vy += (vt - f.vy) * Math.min(1, dt * 1.1);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < -10) f.x += G.vw + 20;
      if (f.x > G.vw + 10) f.x -= G.vw + 20;
      if (f.y < -40) f.vy = Math.abs(f.vy);
      const c = col(f.x);
      if (f.vy > 0 && pileTop[c] < Infinity && f.y >= pileTop[c] - pile[c] && f.y < pileTop[c] + 12) {
        f.on = false;
        addTo(pile, c, f.r * 0.5, 24);
        pileDirty = true;
        continue;
      }
      let land = false;
      for (const hs of G.houses) {
        const rf = hs.roof;
        if (f.x > rf.x0 && f.x < rf.x1 && f.y > rf.peak && f.y < rf.y0) {
          const u = Math.abs(f.x - hs.x) / ((rf.x1 - rf.x0) / 2);
          if (f.y >= rf.peak + (rf.y0 - rf.peak) * u - hs.cap) { hs.cap = Math.min(7 * s, hs.cap + 0.05 * f.r); land = true; break; }
        }
      }
      if (!land && f.y >= hill(f.x) - ground[c]) { addTo(ground, c, f.r * 0.3, 16 * s); land = true; }
      if (land) f.on = false;
    }
    // a trickle keeps falling from the top of the glass, even when it's calm
    if (!k.reduced && Math.random() < dt * (4 + energy * 10)) revive(k.rand(G.vw), -10, 0, 10);
    slump(ground);
    if (pileDirty) slump(pile);

    const c = snow.ctx;
    c.clearRect(0, 0, snow.w, snow.h);
    c.save();
    circle(c);
    c.clip();
    // snow lying on the ground and roofs
    c.fillStyle = '#fbfdff';
    c.beginPath();
    const x0 = Math.max(0, G.cx - G.R), x1 = Math.min(G.vw, G.cx + G.R);
    c.moveTo(x0, hill(x0));
    for (let x = x0; x <= x1; x += COL) c.lineTo(x, hill(x) - ground[col(x)]);
    for (let x = x1; x >= x0; x -= 12) c.lineTo(x, hill(x) + 2);
    c.closePath();
    c.fill();
    for (const hs of G.houses) {
      const rf = hs.roof;
      const cap = hs.cap;
      c.fillStyle = '#f7fbff';
      c.beginPath();
      c.moveTo(rf.x0 - 1, rf.y0 + 1);
      c.lineTo(hs.x, rf.peak - cap);
      c.lineTo(rf.x1 + 1, rf.y0 + 1);
      c.lineTo(rf.x1 - 3, rf.y0 + 1 + cap * 0.6);
      c.quadraticCurveTo(hs.x, rf.peak + cap * 0.9 + 3, rf.x0 + 3, rf.y0 + 1 + cap * 0.6);
      c.closePath();
      c.fill();
      // windows: they wake up when you shake the globe, then go back to bed one by one
      for (let i = 0; i < hs.winRects.length; i++) {
        const w = hs.wins[i];
        w.next -= dt;
        if (w.next <= 0 && !k.reduced) { w.lit = energy > 0.5 ? true : Math.random() < 0.3; w.next = k.rand(6, 30); }
        const wr = hs.winRects[i];
        if (!w.lit) continue;
        c.fillStyle = '#ffd77a';
        c.fillRect(wr.x, wr.y, wr.w, wr.h);
        c.fillStyle = 'rgba(120,70,30,.55)';
        c.fillRect(wr.x + wr.w / 2 - 0.5, wr.y, 1, wr.h);
        c.fillRect(wr.x, wr.y + wr.h / 2 - 0.5, wr.w, 1);
      }
      if (hs.chimTop && !k.reduced && Math.random() < dt * 1.5) smoke.push({ x: hs.chimTop.x, y: hs.chimTop.y, age: 0, r: 3 * s });
    }
    c.globalCompositeOperation = 'lighter'; // lamp and window glow
    const L = G.lamp;
    const lg = c.createRadialGradient(L.x, L.y - 43 * s, 0, L.x, L.y - 43 * s, 40 * s);
    lg.addColorStop(0, 'rgba(255,220,140,.55)');
    lg.addColorStop(1, 'rgba(255,220,140,0)');
    c.fillStyle = lg;
    c.fillRect(L.x - 40 * s, L.y - 83 * s, 80 * s, 80 * s);
    c.globalCompositeOperation = 'source-over';
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.age += dt;
      if (p.age > 3) { smoke.splice(i, 1); continue; }
      c.fillStyle = `rgba(220,228,240,${0.35 * (1 - p.age / 3)})`;
      c.beginPath(); c.arc(p.x + Math.sin(p.age * 2) * 3 + p.age * 6, p.y - p.age * 16 * s, p.r + p.age * 3 * s, 0, 7); c.fill();
    }
    snowman(c, dt);
    for (const f of flakes) {
      if (!f.on) continue;
      const d = f.r * 2.2;
      c.globalAlpha = 0.6 + f.r * 0.1;
      c.drawImage(flake, f.x - d / 2, f.y - d / 2, d, d);
    }
    c.globalAlpha = 1;
    if (bubble) {
      bubble.age += dt;
      if (bubble.age > 2.8) bubble = null;
      else {
        c.font = k.font(Math.max(11, 13 * s), 700, 'hand');
        const tw = c.measureText(bubble.text).width + 16;
        const a = Math.min(1, bubble.age * 8, (2.8 - bubble.age) * 4);
        const bx = Math.min(Math.max(bubble.x - tw / 2, G.gap.x + 6), G.gap.x + G.gap.w - tw - 6), by = Math.max(G.gap.y + 4, bubble.y - 34);
        c.globalAlpha = a;
        c.fillStyle = '#fffdf7';
        c.beginPath(); c.roundRect(bx, by, tw, 22, 11); c.fill();
        c.beginPath(); c.moveTo(bubble.x - 4, by + 21); c.lineTo(bubble.x, by + 30); c.lineTo(bubble.x + 6, by + 21); c.fill();
        c.fillStyle = '#2b2a3a';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(bubble.text, bx + tw / 2, by + 11.5);
        c.globalAlpha = 1;
      }
    }
    c.restore();
    if (pileDirty) drawPile();
  }

  function snowman(c, dt) {
    const m = G.snowman;
    const s = m.s;
    const { x, y } = m;
    c.save();
    c.fillStyle = 'rgba(40,60,90,.2)';
    c.beginPath(); c.ellipse(x + 3, y, 16 * s, 3.5 * s, 0, 0, 7); c.fill();
    const ball = (bx, by, r) => {
      const g = c.createRadialGradient(bx - r * 0.4, by - r * 0.4, 1, bx, by, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#c9d8ea');
      c.fillStyle = g;
      c.beginPath(); c.arc(bx, by, r, 0, 7); c.fill();
    };
    ball(x, y - 12 * s, 13 * s);
    ball(x, y - 31 * s, 9.5 * s);
    c.strokeStyle = '#5a3a24';
    c.lineWidth = 1.6 * s;
    c.beginPath(); c.moveTo(x - 8 * s, y - 31 * s); c.lineTo(x - 22 * s, y - 40 * s); c.moveTo(x + 8 * s, y - 31 * s); c.lineTo(x + 21 * s, y - 44 * s); c.lineTo(x + 25 * s, y - 47 * s); c.stroke();
    c.fillStyle = '#d23a3a'; // scarf
    c.fillRect(x - 8 * s, y - 40 * s, 16 * s, 3.5 * s);
    c.fillRect(x + 3 * s, y - 40 * s, 3.5 * s, 10 * s);
    for (const by of [-34, -28, -14]) { c.fillStyle = '#222'; c.beginPath(); c.arc(x, y + by * s, 1.3 * s, 0, 7); c.fill(); }
    // the head: on, or knocked off and lying in the snow
    let hx = x, hy = y - 48 * s, rot = 0;
    if (head.off) {
      if (!head.rest) {
        head.vy += 600 * dt;
        head.x += head.vx * dt;
        head.y += head.vy * dt;
        head.rot += head.vr * dt;
        const gy = hill(head.x) - 6 * s;
        if (head.y >= gy) { head.y = gy; head.rest = true; head.rot = Math.PI * 0.5 * Math.sign(head.vx); k.sfx.thud({ gain: 0.15, pitch: 1.6 }); }
      }
      hx = head.x; hy = head.y; rot = head.rot;
    }
    c.translate(hx, hy);
    c.rotate(rot);
    ball(0, 0, 7 * s);
    c.fillStyle = '#222';
    for (const ex of [-2.5, 2.5]) { c.beginPath(); c.arc(ex * s, -1.5 * s, 1 * s, 0, 7); c.fill(); }
    c.fillStyle = '#f08a2a';
    c.beginPath(); c.moveTo(0, 0.5 * s); c.lineTo(9 * s, 2 * s); c.lineTo(0, 2.6 * s); c.fill();
    c.fillStyle = '#2b2b33'; // hat
    c.fillRect(-7 * s, -7 * s, 14 * s, 2 * s);
    c.fillRect(-4.5 * s, -14 * s, 9 * s, 7.5 * s);
    c.restore();
  }

  function drawPile() {
    pileDirty = false;
    const c = pileCv.ctx;
    c.clearRect(0, 0, pileCv.w, pileCv.h);
    c.fillStyle = '#fbfdff';
    c.shadowColor = 'rgba(20,40,80,.35)';
    c.shadowBlur = 4;
    c.shadowOffsetY = 1;
    for (let i = 0; i < G.cols;) { // one shape per run of columns sitting on the same card edge
      if (pileTop[i] === Infinity) { i++; continue; }
      const top = pileTop[i];
      let j = i;
      while (j + 1 < G.cols && pileTop[j + 1] === top) j++;
      c.beginPath();
      c.moveTo(i * COL - 1, top + 1);
      for (let q = i; q <= j; q++) c.lineTo(q * COL, top - pile[q]);
      c.lineTo(j * COL + 1, top + 1);
      c.closePath();
      c.fill();
      i = j + 1;
    }
    c.shadowColor = 'transparent';
  }

  inner.resized = drawInner;
  glass.resized = drawGlass;
  room.resized = drawRoom;
  pileCv.resized = () => { pileDirty = true; };
  layout();
  seedSnow();
  if (k.reduced) { // a still frame: snow on everything, a few flakes mid-air
    for (let c = 0; c < ground.length; c++) ground[c] = 8 * G.s + Math.sin(c * 0.3) * 1.5;
    for (const hs of G.houses) hs.cap = 5 * G.s;
    energy = 0.2;
  }
  k.loop(step, { still: 2 });
  k.on(k.root, 'pointerdown', () => shake(0.35, 'poke'));
  k.every(700, () => G && buildPile()); // the stack's peeking cards come and go without a resize

  return {
    question() {
      if (head.off && ctx.question) Object.assign(head, { off: false });
      layout();
      k.after(500, layout);
      k.after(1100, layout);
    },
    layout,
    status() { if (!ctx.question) drawGlass(glass.w, glass.h); },
    decisions() { if (ctx.front === 'done') drawGlass(glass.w, glass.h); },
    answer(a) { shake(1, a.tookRec ? 'rec' : 'off'); },
  };
}
