// Lofi beats to decide to. A rainy night window over a desk: the cat sleeps, the mug steams, the
// record spins, the neon buzzes and a sticky note on the glass holds this question.

const SKY = [[0, '#14122e'], [0.45, '#2a2252'], [0.78, '#58397a'], [1, '#b0607c']];
const CSS = `
.lofi-note{position:absolute;box-sizing:border-box;padding:12px 13px 14px;background:linear-gradient(170deg,#fff6a8,#ffe873 70%,#f5d95c);color:#3b3424;font:500 14px/1.22 "Bradley Hand","Segoe Print","Chalkboard SE","Comic Sans MS",cursive;box-shadow:0 10px 18px rgba(10,5,30,.45),0 1px 2px rgba(0,0,0,.3);transform-origin:50% 0;border-radius:1px 1px 3px 14px/1px 1px 3px 6px}
.lofi-note:before{content:"";position:absolute;left:30%;right:30%;top:-7px;height:14px;background:rgba(255,255,255,.38);box-shadow:0 1px 2px rgba(0,0,0,.12);transform:rotate(-2deg)}
.lofi-note b{display:block;font-weight:700;margin-bottom:5px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.lofi-note div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.lofi-note i{font-style:normal;display:inline-block;width:1.1em}
.lofi-note .ck{color:#c2361f;font-weight:700}
.lofi-note small{display:block;margin-top:6px;font-size:12px;opacity:.7}
.lofi-note.mini small,.lofi-note.mini div:nth-of-type(n+3){display:none}
`;

export default function lofi(k, ctx) {
  const sky = k.canvas({ alpha: false });
  const wet = k.canvas({ dpr: 1 }); // rain, flickering windows, sliding drops
  const room = k.canvas(); // window frame, desk, static props
  const fx = k.canvas(); // the cat, steam, record, glow, neon
  k.el('style', { text: CSS });
  const note = k.el('div', { class: 'lofi-note' });
  const music = k.canRender('♪', 'sans');

  let G = null; // geometry
  let rain = [], drops = [], trails = [], flick = [], zs = [], notes = [], bubble = null, ghost = null;
  let awake = 0, wake = 0, ear = 0, tail = 0, neonOff = 0, ghostAt = 14;
  let sign = null;
  let picked = null;
  let beat = null;

  // ── layout ────────────────────────────────────────────────────────────────

  function layout() {
    const sp = k.space();
    const gap = sp.gaps.find((g) => g.where === 'bottom' && g.h > 90) || sp.gaps.find((g) => g.where === 'all') || { x: sp.stage.x, y: sp.vh - 160, w: sp.stage.width, h: 160 };
    const top = sp.gaps.find((g) => g.where === 'top');
    const s = Math.max(0.55, Math.min(1.1, gap.h / 260, gap.w / 760));
    const deskTop = gap.y + gap.h - Math.max(52, 92 * s);
    const at = (f) => gap.x + gap.w * f;
    G = {
      s, gap, top, vw: sp.vw, vh: sp.vh, deskTop, deskFront: deskTop + 44 * s,
      win: { x0: sp.vw * 0.025, x1: sp.vw * 0.975, y0: -20, y1: deskTop - 12 * s },
      lamp: at(0.09), mug: at(0.24), clock: at(0.335), cat: at(0.5), rec: at(0.75), books: at(0.93),
      moon: { x: (top ? top.x + top.w - 70 : sp.vw * 0.8), y: top ? Math.min(34, top.h * 0.55) : 50 },
      mull: [sp.vw * 0.34, sp.vw * 0.69],
    };
    G.feet = G.deskTop + 26 * s;
    if (gap.w < 700) Object.assign(G, { clock: -999, mug: at(0.2), books: at(0.94) });
    drawSky(sky.w, sky.h);
    drawRoom(room.w, room.h);
    makeSign();
    seedWet();
    placeNote();
  }

  // ── static layers ─────────────────────────────────────────────────────────

  function drawSky(w, h) {
    if (!G) return;
    const c = sky.ctx;
    const r = k.rng(42);
    const g = c.createLinearGradient(0, 0, 0, G.win.y1);
    SKY.forEach(([o, col]) => g.addColorStop(o, col));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const m = G.moon; // moon, through haze
    const mg = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, 140);
    mg.addColorStop(0, 'rgba(255,230,250,.35)');
    mg.addColorStop(1, 'rgba(255,230,250,0)');
    c.fillStyle = mg;
    c.fillRect(m.x - 140, m.y - 140, 280, 280);
    c.fillStyle = '#fbeff5';
    c.beginPath(); c.arc(m.x, m.y, 15, 0, 6.28); c.fill();
    c.fillStyle = SKY[0][1];
    c.beginPath(); c.arc(m.x + 7, m.y - 4, 13, 0, 6.28); c.fill();
    G.lit = [];
    const base = G.win.y1;
    const layers = [
      { col: '#3a2c5e', hmin: 0.18, hmax: 0.42, wmin: 40, wmax: 90, lit: 0.06, win: 'rgba(255,200,170,.3)' },
      { col: '#241c42', hmin: 0.12, hmax: 0.34, wmin: 50, wmax: 120, lit: 0.1, win: 'rgba(255,205,120,.55)' },
      { col: '#16122b', hmin: 0.06, hmax: 0.2, wmin: 70, wmax: 160, lit: 0.14, win: 'rgba(255,214,130,.85)' },
    ];
    const H = Math.max(260, base - 40);
    layers.forEach((L, li) => {
      for (let x = -20; x < w + 20;) {
        const bw = r.rand(L.wmin, L.wmax), bh = r.rand(L.hmin, L.hmax) * H + (li === 0 ? H * 0.25 : li === 1 ? H * 0.12 : 0);
        const y = base - bh;
        c.fillStyle = L.col;
        c.fillRect(x, y, bw, bh + 4);
        if (r.chance(0.25)) c.fillRect(x + bw * 0.3, y - 14, bw * 0.4, 14); // roof box
        if (li === 0 && r.chance(0.2)) { G.antenna = { x: x + bw / 2, y: y - 40 }; c.fillRect(x + bw / 2 - 1, y - 40, 2, 40); }
        const ws = li === 2 ? 9 : li === 1 ? 7 : 5;
        for (let wy = y + ws; wy < base - ws; wy += ws * 1.9) {
          for (let wx = x + ws * 0.8; wx < x + bw - ws; wx += ws * 1.7) {
            if (!r.chance(L.lit)) continue;
            const tv = r.chance(0.12);
            c.fillStyle = tv ? 'rgba(150,200,255,.7)' : L.win;
            c.fillRect(wx, wy, ws, ws * 1.15);
            if (li > 0 && wy > G.gap.y - 20) G.lit.push({ x: wx, y: wy, w: ws, h: ws * 1.15, c: tv ? 'rgba(150,200,255,.7)' : L.win });
          }
        }
        x += bw + r.rand(-6, 14);
      }
    });
    const haze = c.createLinearGradient(0, base - 120, 0, base);
    haze.addColorStop(0, 'rgba(200,110,150,0)');
    haze.addColorStop(1, 'rgba(200,110,150,.28)');
    c.fillStyle = haze;
    c.fillRect(0, base - 120, w, 120);
    for (let i = 0; i < (w * h) / 2600; i++) drop(c, r.rand(w), r.rand(base), r.rand(1, 3.6), r.rand(0.5, 1));
  }

  function drop(c, x, y, rad, a = 1) {
    c.fillStyle = `rgba(20,14,40,${0.28 * a})`;
    c.beginPath(); c.ellipse(x, y + rad * 0.25, rad, rad * 1.08, 0, 0, 6.28); c.fill();
    c.fillStyle = `rgba(230,210,255,${0.16 * a})`;
    c.beginPath(); c.ellipse(x, y, rad * 0.86, rad * 0.95, 0, 0, 6.28); c.fill();
    c.fillStyle = `rgba(255,255,255,${0.75 * a})`;
    c.beginPath(); c.arc(x - rad * 0.3, y - rad * 0.35, Math.max(0.5, rad * 0.28), 0, 6.28); c.fill();
  }

  function drawRoom(w, h) {
    if (!G) return;
    const c = room.ctx;
    const { s, win, deskTop, deskFront } = G;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#1f1828'; // wall around the window
    c.fillRect(0, 0, win.x0, h);
    c.fillRect(win.x1, 0, w - win.x1, h);
    const wood = (x, y, ww, hh, light) => {
      const g = c.createLinearGradient(x, y, x + ww, y + hh);
      g.addColorStop(0, light ? '#5c3d2e' : '#3a2620');
      g.addColorStop(1, light ? '#43291f' : '#2a1b16');
      c.fillStyle = g;
      c.fillRect(x, y, ww, hh);
    };
    const fw = 16 * s;
    wood(win.x0 - fw, 0, fw, deskTop, true);
    wood(win.x1, 0, fw, deskTop, true);
    for (const mx of G.mull) {
      wood(mx - fw * 0.4, 0, fw * 0.8, win.y1, true);
      c.fillStyle = 'rgba(255,210,170,.12)';
      c.fillRect(mx - fw * 0.4, 0, 2, win.y1);
    }
    wood(0, win.y1 - 3, w, 10 * s + 3, true); // sill
    c.fillStyle = 'rgba(255,220,180,.2)';
    c.fillRect(0, win.y1 - 3, w, 1.5);
    // desk top, in perspective, and its front edge
    const dg = c.createLinearGradient(0, deskTop, 0, deskFront);
    dg.addColorStop(0, '#5a3a2a');
    dg.addColorStop(1, '#8a5d40');
    c.fillStyle = dg;
    c.fillRect(0, deskTop, w, deskFront - deskTop);
    const r = k.rng(9);
    c.strokeStyle = 'rgba(40,20,10,.22)';
    c.lineWidth = 1;
    for (let i = 0; i < 9; i++) { // grain
      const y = deskTop + r.rand(4, deskFront - deskTop - 2);
      c.beginPath(); c.moveTo(0, y);
      for (let x = 0; x <= w; x += 80) c.lineTo(x, y + Math.sin(x * 0.01 + i) * 1.5);
      c.stroke();
    }
    const fg = c.createLinearGradient(0, deskFront, 0, h);
    fg.addColorStop(0, '#4a2e20');
    fg.addColorStop(1, '#22140f');
    c.fillStyle = fg;
    c.fillRect(0, deskFront, w, h - deskFront);
    c.fillStyle = 'rgba(255,214,170,.35)';
    c.fillRect(0, deskFront, w, 1.5);
    books(c);
    lampBase(c);
  }

  function books(c) {
    const { s, feet } = G;
    const x = G.books;
    c.save();
    c.translate(x, feet);
    c.scale(s, s);
    const stack = [['#6f8f7a', 92, 15], ['#c98a8f', 84, 13], ['#3e4d7a', 98, 17]];
    let y = 0;
    stack.forEach(([col, bw, bh], i) => {
      const off = [-4, 6, -2][i];
      y -= bh;
      c.fillStyle = col;
      c.beginPath(); c.roundRect(-bw / 2 + off, y, bw, bh, 2); c.fill();
      c.fillStyle = '#efe4cc'; // pages
      c.fillRect(-bw / 2 + off + 4, y + 2.5, bw - 6, bh - 5);
      c.fillStyle = 'rgba(0,0,0,.12)';
      for (let l = y + 4; l < y + bh - 3; l += 2.2) c.fillRect(-bw / 2 + off + 4, l, bw - 6, 0.6);
      c.fillStyle = col;
      c.fillRect(-bw / 2 + off, y, 6, bh);
      c.fillStyle = 'rgba(255,255,255,.18)';
      c.fillRect(-bw / 2 + off, y, bw, 1.5);
    });
    // plant on top: terracotta pot and trailing pothos
    c.translate(4, y);
    c.fillStyle = '#b4583a';
    c.beginPath(); c.moveTo(-18, -30); c.lineTo(18, -30); c.lineTo(14, 0); c.lineTo(-14, 0); c.closePath(); c.fill();
    c.fillStyle = '#c96a48';
    c.fillRect(-20, -34, 40, 7);
    c.fillStyle = 'rgba(0,0,0,.18)';
    c.fillRect(-14, -27, 28, 3);
    const r = k.rng(4);
    const leaf = (lx, ly, a, sz, col) => {
      c.save(); c.translate(lx, ly); c.rotate(a);
      c.fillStyle = col;
      c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(sz * 0.7, -sz * 0.4, sz * 0.6, -sz * 1.1, 0, -sz * 1.3); c.bezierCurveTo(-sz * 0.6, -sz * 1.1, -sz * 0.7, -sz * 0.4, 0, 0); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(0, -1); c.lineTo(0, -sz * 1.1); c.stroke();
      c.restore();
    };
    c.strokeStyle = '#3d6b3a'; c.lineWidth = 1.6;
    for (const [dir, len] of [[-1, 70], [1, 92], [1, 50]]) { // vines trailing over the books
      c.beginPath(); c.moveTo(dir * 10, -32);
      c.bezierCurveTo(dir * 30, -30, dir * 40, -5, dir * 36, len - 40); c.stroke();
      for (let i = 0; i < 6; i++) {
        const u = i / 6;
        leaf(dir * (10 + 30 * u), -32 + u * (len - 8), dir * (0.8 + r.rand(-0.4, 0.4)) + Math.PI * 0.85 * (u > 0.3 ? 1 : 0), r.rand(7, 10), r.pick(['#4f8a46', '#5f9e4f', '#6fae5a']));
      }
    }
    for (let i = 0; i < 9; i++) leaf(r.rand(-12, 12), -34, r.rand(-1.2, 1.2), r.rand(9, 13), r.pick(['#4f8a46', '#5f9e4f', '#77b860']));
    c.restore();
  }

  function lampBase(c) {
    const { s, feet } = G;
    c.save();
    c.translate(G.lamp, feet);
    c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.ellipse(4, 2, 34, 6, 0, 0, 6.28); c.fill();
    const bg = c.createLinearGradient(-30, 0, 30, 0);
    bg.addColorStop(0, '#2b4a43'); bg.addColorStop(0.4, '#4f7c70'); bg.addColorStop(1, '#203a34');
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(0, -5, 30, 8, 0, 0, 6.28); c.fill();
    c.fillRect(-30, -5, 60, 4);
    c.strokeStyle = '#335a51'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -8); c.lineTo(-18, -120); c.lineTo(40, -168); c.stroke();
    c.fillStyle = '#4f7c70';
    for (const [jx, jy] of [[0, -8], [-18, -120]]) { c.beginPath(); c.arc(jx, jy, 5, 0, 6.28); c.fill(); }
    // shade, pointing down at the desk
    c.translate(40, -168);
    c.rotate(0.5);
    const sg = c.createLinearGradient(-30, 0, 30, 0);
    sg.addColorStop(0, '#2b4a43'); sg.addColorStop(0.45, '#5d8f81'); sg.addColorStop(1, '#203a34');
    c.fillStyle = sg;
    c.beginPath(); c.moveTo(-10, -8); c.lineTo(10, -8); c.lineTo(32, 34); c.lineTo(-32, 34); c.closePath(); c.fill();
    c.fillStyle = '#fff3c8';
    c.beginPath(); c.ellipse(0, 34, 32, 6, 0, 0, 6.28); c.fill();
    c.restore();
    G.bulb = { x: G.lamp + (40 + Math.sin(0.5) * -34) * s, y: feet + (-168 + Math.cos(0.5) * 34) * s };
  }

  // ── the neon sign ─────────────────────────────────────────────────────────

  function makeSign() {
    const top = G.top && G.top.h >= 34 ? G.top : null;
    const size = top ? Math.min(28, top.h * 0.52) : 20 * G.s;
    const parts = [['♪ ', '#7ef3ff', '#20c8ff'], ['lofi beats to ', '#ffd6f6', '#ff4fd8'], ['decide', '#ffd6f6', '#ff4fd8'], [' to', '#ffd6f6', '#ff4fd8']];
    if (!music) parts.shift();
    const dpr = fx.dpr;
    const meas = document.createElement('canvas').getContext('2d');
    meas.font = k.font(size, 700, 'hand');
    const pad = 24;
    const ws = parts.map(([t]) => meas.measureText(t).width);
    const W = ws.reduce((a, b) => a + b, 0);
    const spr = parts.map(([t, fill, glow], i) => {
      const e = document.createElement('canvas');
      e.width = Math.ceil((ws[i] + pad * 2) * dpr); e.height = Math.ceil((size * 1.6 + pad * 2) * dpr);
      const g = e.getContext('2d');
      g.scale(dpr, dpr);
      g.font = k.font(size, 700, 'hand');
      g.textBaseline = 'middle';
      g.fillStyle = fill;
      g.shadowColor = glow;
      for (const b of [22, 10, 3]) { g.shadowBlur = b * dpr; g.fillText(t, pad, pad + size * 0.8); }
      return { e, w: ws[i] + pad * 2, h: size * 1.6 + pad * 2, dx: ws.slice(0, i).reduce((a, b) => a + b, 0) - pad };
    });
    const x = top ? top.x + (top.w - W) / 2 : G.gap.x + 30;
    const y = top ? top.y + top.h / 2 - size * 0.8 : G.gap.y + 10;
    sign = { spr, x, y, W, size, flick: music ? 2 : 1, cx: x + W / 2, cy: y + size * 0.8, dpr };
  }

  // ── the sticky note ───────────────────────────────────────────────────────

  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[ch]};`);

  function renderNote() {
    const q = ctx.question;
    let html;
    if (q) {
      const has = (o) => picked?.includes(o.label);
      const opts = q.options.slice(0, 3).map((o) => `<div>${has(o) ? '<i class="ck">☑</i>' : '<i>☐</i>'}${esc(o.label)}${o.recommended ? ' ★' : ''}</div>`).join('');
      html = `<b>${q.n}. ${esc(q.title)}</b>${opts || `<div><i>✎</i>no options. vibes only.</div>`}${q.options.length > 3 ? `<div><i></i>+${q.options.length - 3} more…</div>` : ''}`;
    } else if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      html = `<b>done ✓</b><div>${n} decision${n === 1 ? '' : 's'} made</div><div>the cat approves</div><small>nap time</small>`;
    } else {
      html = `<b>agent is ${ctx.agent === 'listening' ? 'listening' : 'thinking'}…</b><div>so is the cat</div><small>(the cat is asleep)</small>`;
    }
    note.innerHTML = html;
  }

  function placeNote() {
    renderNote();
    const { gap, s } = G;
    const w = Math.round(Math.min(210, Math.max(150, gap.w * 0.26)));
    note.style.width = `${w}px`;
    note.classList.remove('mini');
    const x = Math.min(gap.x + gap.w * 0.63, gap.x + gap.w - w - 14);
    const maxH = G.deskTop - 58 * s - (gap.y + 14);
    note.style.left = `${x}px`;
    note.style.top = `${gap.y + 14}px`;
    if (note.offsetHeight > maxH) note.classList.add('mini');
    note.style.display = note.offsetHeight > maxH + 8 || gap.w < 480 ? 'none' : '';
    note.style.transform = `rotate(${((k.hash(String(ctx.question?.id || ctx.front)) % 40) - 20) / 10}deg)`;
  }

  // ── weather ───────────────────────────────────────────────────────────────

  function seedWet() {
    const { vw, vh } = G;
    rain = Array.from({ length: Math.round((vw * vh) / 7000) }, () => ({ x: k.rand(vw), y: k.rand(vh), l: k.rand(14, 34), v: k.rand(700, 1000), a: k.rand(0.18, 0.42) }));
    drops = [];
    trails = [];
    flick = k.shuffle(G.lit || []).slice(0, 10).map((w) => ({ ...w, on: true, next: k.rand(2, 14) }));
  }

  function slider() {
    const { win, vw } = G;
    return { x: k.rand(vw), y: k.rand(-10, win.y1 * 0.7), r: k.rand(2.6, 4.6), v: 0, last: 0 };
  }

  // ── the props that move ───────────────────────────────────────────────────

  function drawCat(c, t) {
    const { s, feet } = G;
    const br = Math.sin(t * 1.6);
    c.save();
    c.translate(G.cat, feet);
    c.scale(s * 1.05, s * 1.05);
    c.fillStyle = 'rgba(15,8,20,.4)';
    c.beginPath(); c.ellipse(-6, 1, 94, 8, 0, 0, 6.28); c.fill();
    c.save();
    c.scale(1, 1 + br * 0.03);
    const body = new Path2D('M-86 0 C-100 -34 -72 -68 -22 -68 C24 -68 58 -54 64 -26 L64 0 Z');
    const bg = c.createLinearGradient(0, -68, 0, 0);
    bg.addColorStop(0, '#f4a85c'); bg.addColorStop(0.55, '#de8240'); bg.addColorStop(1, '#a95a26');
    c.fillStyle = bg;
    c.fill(body);
    c.save();
    c.clip(body);
    c.strokeStyle = 'rgba(150,72,24,.55)';
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = -70 + i * 22;
      c.lineWidth = 7 - Math.abs(i - 2.5);
      c.beginPath(); c.moveTo(x - 6, -72); c.quadraticCurveTo(x + 6, -54, x + 2, -34); c.stroke();
    }
    const lit = c.createRadialGradient(-70, -70, 4, -60, -50, 90);
    lit.addColorStop(0, 'rgba(255,230,170,.45)');
    lit.addColorStop(1, 'rgba(255,230,170,0)');
    c.fillStyle = lit;
    c.fillRect(-100, -80, 170, 90);
    c.strokeStyle = 'rgba(120,60,20,.35)'; // the haunch
    c.lineWidth = 2;
    c.beginPath(); c.arc(-46, -14, 30, Math.PI * 1.05, Math.PI * 1.75); c.stroke();
    c.restore();
    c.restore();
    // tail, curled round the front, the tip twitching
    const tw = Math.sin(t * 2.2) * 3 + tail * Math.sin(t * 16) * 8;
    c.lineCap = 'round';
    c.strokeStyle = '#d57a38';
    c.lineWidth = 15;
    c.beginPath(); c.moveTo(-84, -10); c.quadraticCurveTo(-82, 6, -36, 3); c.quadraticCurveTo(-4, 1, 6 + tw * 0.4, -8 + tw); c.stroke();
    c.strokeStyle = '#a85a24';
    c.lineWidth = 15;
    c.beginPath(); c.moveTo(-2, 0.5 + tw * 0.4); c.quadraticCurveTo(2, -2 + tw * 0.6, 6 + tw * 0.4, -8 + tw); c.stroke();
    c.strokeStyle = 'rgba(150,72,24,.5)';
    c.lineWidth = 4;
    for (const u of [-64, -44]) { c.beginPath(); c.moveTo(u, -3); c.lineTo(u + 3, 9); c.stroke(); }
    // front paws
    c.fillStyle = '#f8dcb6';
    for (const px of [36, 64]) { c.beginPath(); c.ellipse(px, -5, 12, 6.5, 0, 0, 6.28); c.fill(); }
    // head, resting on the paws
    c.save();
    c.translate(54, -26 - wake * 9);
    c.rotate(-0.06 - wake * 0.12);
    const earL = new Path2D('M-25 -8 L-20 -40 L-3 -20 Z');
    const earR = new Path2D('M5 -21 L22 -39 L27 -6 Z');
    c.fillStyle = '#d97c3c';
    c.fill(earL);
    c.save();
    c.translate(16, -20);
    c.rotate(ear * 0.5);
    c.translate(-16, 20);
    c.fill(earR);
    c.fillStyle = '#f2a6a0';
    c.beginPath(); c.moveTo(9, -21); c.lineTo(20, -33); c.lineTo(23, -11); c.fill();
    c.restore();
    c.fillStyle = '#f2a6a0';
    c.beginPath(); c.moveTo(-21, -10); c.lineTo(-18, -33); c.lineTo(-7, -20); c.fill();
    const hg = c.createRadialGradient(-8, -12, 4, 0, 0, 34);
    hg.addColorStop(0, '#f6b068'); hg.addColorStop(1, '#d27434');
    c.fillStyle = hg;
    c.beginPath(); c.ellipse(0, 0, 31, 24, 0, 0, 6.28); c.fill();
    c.fillStyle = '#d27434'; // cheek fluff
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 26, 4); c.lineTo(sx * 36, 9); c.lineTo(sx * 27, 12); c.fill(); }
    c.strokeStyle = 'rgba(150,72,24,.6)';
    c.lineWidth = 2.2;
    for (const fx2 of [-6, 0, 6]) { c.beginPath(); c.moveTo(fx2, -23); c.lineTo(fx2 * 1.2, -14); c.stroke(); }
    c.fillStyle = '#fbe3c4';
    c.beginPath(); c.ellipse(0, 9, 15, 10, 0, 0, 6.28); c.fill();
    c.fillStyle = '#e57f86';
    c.beginPath(); c.moveTo(-3.5, 3); c.lineTo(3.5, 3); c.lineTo(0, 7); c.fill();
    c.strokeStyle = '#7a3e22';
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, 7); c.quadraticCurveTo(-3, 11, -6, 9); c.moveTo(0, 7); c.quadraticCurveTo(3, 11, 6, 9); c.stroke();
    if (wake > 0.5) { // one judgemental look
      for (const ex of [-12, 12]) {
        c.fillStyle = '#b8e06a';
        c.beginPath(); c.ellipse(ex, -4, 6, 4.6 * Math.min(1, (wake - 0.5) * 3), 0, 0, 6.28); c.fill();
        c.fillStyle = '#1b1b10';
        c.beginPath(); c.ellipse(ex, -4, 1.3, 4 * Math.min(1, (wake - 0.5) * 3), 0, 0, 6.28); c.fill();
      }
    } else {
      c.strokeStyle = '#5a2c14';
      c.lineWidth = 2;
      for (const ex of [-12, 12]) { c.beginPath(); c.arc(ex, -6, 6, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
    }
    c.strokeStyle = 'rgba(255,245,230,.6)';
    c.lineWidth = 0.8;
    for (const sx of [-1, 1]) for (const dy of [-1, 3]) { c.beginPath(); c.moveTo(sx * 12, 8 + dy * 0.5); c.lineTo(sx * 40, 4 + dy * 2); c.stroke(); }
    c.restore();
    c.restore();
    G.head = { x: G.cat + 54 * s, y: feet - 56 * s };
  }

  function drawMug(c, t) {
    const { s, feet } = G;
    c.save();
    c.translate(G.mug, feet);
    c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.ellipse(4, 1, 30, 5, 0, 0, 6.28); c.fill();
    c.strokeStyle = '#d6c7b6'; c.lineWidth = 7;
    c.beginPath(); c.arc(24, -28, 13, -1.2, 1.2); c.stroke();
    const mg = c.createLinearGradient(-24, 0, 24, 0);
    mg.addColorStop(0, '#cdbdab'); mg.addColorStop(0.35, '#f5ece0'); mg.addColorStop(1, '#a8988a');
    c.fillStyle = mg;
    c.beginPath(); c.moveTo(-23, -54); c.lineTo(23, -54); c.lineTo(21, -4); c.quadraticCurveTo(21, 0, 15, 0); c.lineTo(-15, 0); c.quadraticCurveTo(-21, 0, -21, -4); c.closePath(); c.fill();
    c.fillStyle = '#e58a9a'; // a little heart
    c.beginPath(); c.moveTo(-2, -22); c.bezierCurveTo(-12, -30, -6, -38, -2, -32); c.bezierCurveTo(2, -38, 8, -30, -2, -22); c.fill();
    c.fillStyle = '#efe5d8';
    c.beginPath(); c.ellipse(0, -54, 23, 5.5, 0, 0, 6.28); c.fill();
    c.fillStyle = '#4a2a18';
    c.beginPath(); c.ellipse(0, -53.5, 19.5, 4, 0, 0, 6.28); c.fill();
    c.fillStyle = 'rgba(255,220,180,.35)';
    c.beginPath(); c.ellipse(-6, -54.5, 7, 1.3, 0, 0, 6.28); c.fill();
    c.restore();
    // steam: three wisps, drawn as fading ribbons
    const x0 = G.mug, y0 = feet - 58 * s;
    c.lineCap = 'round';
    for (let w = 0; w < 3; w++) {
      const ph = w * 2.1;
      let px = x0 + (w - 1) * 8 * s, py = y0;
      for (let i = 1; i <= 26; i++) {
        const u = i / 26;
        const nx = x0 + (w - 1) * 8 * s + Math.sin(u * 5 - t * 1.6 + ph) * (2 + u * 16) * s + u * 10 * s;
        const ny = y0 - u * 100 * s;
        c.strokeStyle = `rgba(255,245,240,${0.22 * Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.sin(t * 0.7 + ph))})`;
        c.lineWidth = (3 + u * 6) * s;
        c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
        px = nx; py = ny;
      }
    }
  }

  function drawClock(c) {
    if (G.clock < 0) return;
    const { s, feet } = G;
    c.save();
    c.translate(G.clock, feet);
    c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.ellipse(0, 1, 30, 4, 0, 0, 6.28); c.fill();
    c.fillStyle = '#2d2a33';
    c.beginPath(); c.roundRect(-28, -30, 56, 30, 6); c.fill();
    c.fillStyle = '#120f14';
    c.beginPath(); c.roundRect(-23, -25, 46, 19, 3); c.fill();
    const d = new Date();
    c.font = k.font(14, 700, 'mono');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ff6a4d';
    c.shadowColor = '#ff3b1f';
    c.shadowBlur = 6;
    c.fillText(`${String(d.getHours()).padStart(2, '0')}${d.getSeconds() % 2 || k.reduced ? ':' : ' '}${String(d.getMinutes()).padStart(2, '0')}`, 0, -15);
    c.shadowBlur = 0;
    c.restore();
  }

  function drawRecord(c, t) {
    const { s, feet } = G;
    c.save();
    c.translate(G.rec, feet);
    c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.beginPath(); c.ellipse(4, 1, 80, 6, 0, 0, 6.28); c.fill();
    c.fillStyle = '#6b3f26'; // front
    c.beginPath(); c.roundRect(-74, -22, 148, 22, 3); c.fill();
    c.fillStyle = '#8a5434'; // lid surface
    c.beginPath(); c.moveTo(-74, -22); c.lineTo(74, -22); c.lineTo(66, -40); c.lineTo(-66, -40); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,220,180,.25)';
    c.fillRect(-74, -22, 148, 1.2);
    for (const kx of [44, 58]) { c.fillStyle = '#d8c9b0'; c.beginPath(); c.arc(kx, -11, 4, 0, 6.28); c.fill(); }
    c.fillStyle = '#ffb347';
    c.beginPath(); c.arc(-58, -11, 2.2, 0, 6.28); c.fill();
    c.fillStyle = '#111';
    c.beginPath(); c.ellipse(-8, -31, 50, 8.5, 0, 0, 6.28); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.07)';
    c.lineWidth = 0.7;
    for (let r = 14; r < 48; r += 4) { c.beginPath(); c.ellipse(-8, -31, r, r * 0.17, 0, 0, 6.28); c.stroke(); }
    const a = t * 3.5; // the sheen going round says it's spinning
    c.strokeStyle = 'rgba(255,255,255,.28)';
    c.lineWidth = 3;
    c.beginPath(); c.ellipse(-8, -31, 36, 6.1, 0, a, a + 0.6); c.stroke();
    c.beginPath(); c.ellipse(-8, -31, 36, 6.1, 0, a + Math.PI, a + Math.PI + 0.6); c.stroke();
    c.fillStyle = '#e0485a';
    c.beginPath(); c.ellipse(-8, -31, 13, 2.4, 0, 0, 6.28); c.fill();
    c.strokeStyle = '#cfd3d8'; // tonearm
    c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(58, -36); c.lineTo(52, -33); c.lineTo(24, -29); c.stroke();
    c.fillStyle = '#9aa0a7';
    c.beginPath(); c.arc(58, -36, 4, 0, 6.28); c.fill();
    c.restore();
  }

  function step(dt, t) {
    if (!G) return;
    const { s } = G;
    // outside: rain, windows going on and off, the antenna blinking
    const w = wet.ctx;
    w.clearRect(0, 0, wet.w, wet.h);
    for (const f of flick) {
      f.next -= dt;
      if (f.next <= 0) { f.on = !f.on; f.next = f.on ? k.rand(6, 20) : k.rand(2, 8); }
      if (!f.on) { w.fillStyle = '#1b1636'; w.fillRect(f.x - 0.5, f.y - 0.5, f.w + 1, f.h + 1); }
    }
    if (G.antenna && Math.sin(t * 2.4) > 0.6) {
      w.fillStyle = 'rgba(255,60,60,.9)';
      w.beginPath(); w.arc(G.antenna.x, G.antenna.y, 2, 0, 6.28); w.fill();
    }
    w.strokeStyle = 'rgba(190,200,255,1)';
    w.lineWidth = 1;
    for (const d of rain) {
      d.y += d.v * dt; d.x += d.v * 0.12 * dt;
      if (d.y > G.win.y1) { d.y = k.rand(-60, 0); d.x = k.rand(-50, G.vw); }
      w.globalAlpha = d.a;
      w.beginPath(); w.moveTo(d.x, d.y); w.lineTo(d.x - d.l * 0.12, d.y - d.l); w.stroke();
    }
    w.globalAlpha = 1;
    // drops sliding down the glass, stick-slip, leaving a trail
    if (!k.reduced && drops.length < 14 && Math.random() < dt * 1.2) drops.push(slider());
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (Math.random() < dt * 1.6) d.v = k.rand(50, 260);
      d.v *= 1 - dt * 2.5;
      d.y += d.v * dt;
      d.x += Math.sin(d.y * 0.05) * dt * 6;
      if (d.y - d.last > 7 && d.v > 20) { trails.push({ x: d.x + k.rand(-1, 1), y: d.y - d.r, r: d.r * k.rand(0.25, 0.45), age: 0 }); d.last = d.y; }
      if (d.y > G.win.y1 + 4) { drops.splice(i, 1); continue; }
      drop(w, d.x, d.y, d.r);
    }
    for (let i = trails.length - 1; i >= 0; i--) {
      const d = trails[i];
      d.age += dt;
      if (d.age > 9) { trails.splice(i, 1); continue; }
      drop(w, d.x, d.y, d.r, 1 - d.age / 9);
    }

    // inside
    const c = fx.ctx;
    c.clearRect(0, 0, fx.w, fx.h);
    c.globalCompositeOperation = 'lighter'; // lamplight
    const b = G.bulb;
    const lg = c.createRadialGradient(b.x + 30 * s, G.feet, 10, b.x + 30 * s, G.feet, 260 * s);
    lg.addColorStop(0, 'rgba(255,190,110,.32)');
    lg.addColorStop(1, 'rgba(255,190,110,0)');
    c.fillStyle = lg;
    c.fillRect(b.x - 300 * s, G.feet - 300 * s, 600 * s, 400 * s);
    const cone = c.createLinearGradient(0, b.y, 0, G.feet);
    cone.addColorStop(0, 'rgba(255,220,150,.22)');
    cone.addColorStop(1, 'rgba(255,220,150,0)');
    c.fillStyle = cone;
    c.beginPath(); c.moveTo(b.x - 18 * s, b.y); c.lineTo(b.x + 22 * s, b.y - 8 * s); c.lineTo(b.x + 130 * s, G.feet); c.lineTo(b.x - 70 * s, G.feet); c.closePath(); c.fill();
    if (sign) { // neon wash on the glass behind it
      const ng = c.createRadialGradient(sign.cx, sign.cy, 4, sign.cx, sign.cy, sign.W * 0.6);
      ng.addColorStop(0, `rgba(255,80,210,${neonOff > 0 ? 0.08 : 0.16})`);
      ng.addColorStop(1, 'rgba(255,80,210,0)');
      c.fillStyle = ng;
      c.fillRect(sign.cx - sign.W, sign.cy - sign.W * 0.6, sign.W * 2, sign.W * 1.2);
    }
    c.globalCompositeOperation = 'source-over';

    if (awake > 0) awake -= dt;
    else wake = Math.max(0, wake - dt * 1.6);
    ear = Math.max(0, ear - dt * 5);
    tail = Math.max(0, tail - dt * 0.8);
    drawMug(c, t);
    drawClock(c);
    drawRecord(c, t);
    drawCat(c, t);

    // the cat's z's, or a speech bubble when it wakes
    if (!k.reduced && wake < 0.1 && Math.random() < dt * 0.7) zs.push({ age: 0, x: G.head.x + 18 * s, y: G.head.y - 6 * s, dx: k.rand(10, 26) });
    if (k.reduced && !zs.length) zs.push({ age: 1.2, x: G.head.x + 18 * s, y: G.head.y - 6 * s, dx: 16 }, { age: 2.4, x: G.head.x + 18 * s, y: G.head.y - 6 * s, dx: 22 });
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      z.age += dt;
      if (z.age > 3.4) { zs.splice(i, 1); continue; }
      const u = z.age / 3.4;
      c.globalAlpha = Math.sin(Math.PI * u) * 0.9;
      c.font = k.font((10 + u * 12) * s, 700, 'hand');
      c.fillStyle = '#f3e9ff';
      c.fillText('z', z.x + u * z.dx * s + Math.sin(z.age * 2) * 4, z.y - u * 70 * s);
    }
    c.globalAlpha = 1;
    // music notes off the record
    if (!k.reduced && Math.random() < dt * 0.9) notes.push({ age: 0, x: G.rec - 8 * s, y: G.feet - 46 * s, dx: k.rand(-30, 30), g: k.pick(music ? ['♪', '♫', '♪'] : ['•']) });
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      n.age += dt;
      if (n.age > 3) { notes.splice(i, 1); continue; }
      const u = n.age / 3;
      c.globalAlpha = Math.sin(Math.PI * u) * 0.75;
      c.font = k.font(15 * s, 600, 'sans');
      c.fillStyle = '#ffd2f2';
      c.fillText(n.g, n.x + u * n.dx * s + Math.sin(n.age * 3) * 5, n.y - u * 80 * s);
    }
    c.globalAlpha = 1;
    // every so often the steam spells something
    ghostAt -= dt;
    if (!k.reduced && ghostAt <= 0 && !ghost) { ghost = { age: 0, ch: ctx.question?.recommended.length ? k.pick(['?', '★', '?']) : '?' }; ghostAt = k.rand(16, 26); }
    if (ghost) {
      ghost.age += dt;
      const u = ghost.age / 3.2;
      if (u >= 1) ghost = null;
      else {
        c.save();
        c.globalAlpha = Math.sin(Math.PI * u) * 0.45;
        c.font = k.font(38 * s, 700, 'serif');
        c.fillStyle = 'rgba(255,248,240,.9)';
        c.shadowColor = '#fff';
        c.shadowBlur = 12;
        c.translate(G.mug + Math.sin(u * 6) * 3, G.feet - 100 * s - u * 40 * s);
        c.scale(1 + u * 0.4, 1 + u * 0.25);
        c.fillText(ghost.ch, 0, 0);
        c.restore();
      }
    }
    if (bubble) {
      bubble.age += dt;
      if (bubble.age > 2.2) bubble = null;
      else {
        const a = Math.min(1, bubble.age * 6, (2.2 - bubble.age) * 4);
        c.save();
        c.globalAlpha = a;
        c.font = k.font(13 * Math.max(0.8, s), 700, 'hand');
        const tw = c.measureText(bubble.text).width + 18;
        const bx = G.head.x + 10 * s, by = G.head.y - 26 * s;
        c.fillStyle = '#fffaf2';
        c.beginPath(); c.roundRect(bx, by - 26, tw, 24, 12); c.fill();
        c.beginPath(); c.moveTo(bx + 8, by - 4); c.lineTo(bx + 2, by + 6); c.lineTo(bx + 18, by - 4); c.fill();
        c.fillStyle = '#3a2c40';
        c.textAlign = 'left';
        c.fillText(bubble.text, bx + 9, by - 13.5);
        c.restore();
      }
    }

    // neon, with a buzzy word
    if (sign) {
      neonOff -= dt;
      if (!k.reduced && neonOff < -k.rand(5, 30) * 0.2 && Math.random() < dt * 0.15) {
        neonOff = k.rand(0.3, 0.9);
        k.sfx.tone({ type: 'sawtooth', freq: 120, dur: 0.2, gain: 0.015, filter: 'lowpass', freqF: 700 });
      }
      sign.spr.forEach((p, i) => {
        const off = i === sign.flick && neonOff > 0 && Math.sin(t * 60) > -0.2;
        c.globalAlpha = off ? 0.18 : 1;
        c.drawImage(p.e, sign.x + p.dx, sign.y - 24, p.w, p.h);
      });
      c.globalAlpha = 1;
    }
  }

  // ── sound: rain, crackle and a very quiet four-chord loop ─────────────────

  const CHORDS = [[174.6, 220, 261.6, 329.6], [164.8, 196, 246.9, 293.7], [146.8, 174.6, 220, 261.6], [130.8, 164.8, 196, 246.9]];
  function sound(on) {
    beat?.forEach((b) => b.stop?.(0.6));
    beat = null;
    if (!on) return;
    let n = 0;
    const tick = () => {
      if (n % 4 === 0) CHORDS[(n / 4) % 4].forEach((f, i) => k.sfx.tone({ type: 'triangle', freq: f * 2, dur: 3, gain: 0.016, attack: 0.08, delay: i * 0.03, filter: 'lowpass', freqF: 1200, vibrato: { rate: 0.6, depth: 1.5 } }));
      if (n % 2 === 0) k.sfx.tone({ freq: 90, to: 45, dur: 0.18, gain: 0.08 });
      else k.sfx.noise({ dur: 0.05, filter: 'highpass', freq: 6000, gain: 0.025 });
      n++;
    };
    beat = [
      k.sfx.noise({ dur: Infinity, color: 'pink', filter: 'lowpass', freq: 900, gain: 0.03, attack: 1 }),
      k.sfx.noise({ dur: Infinity, color: 'crackle', filter: 'highpass', freq: 2500, gain: 0.012, attack: 1 }),
      { stop: k.every(800, tick) },
    ];
    tick();
  }

  sky.resized = drawSky;
  room.resized = drawRoom;
  fx.resized = () => { if (sign && sign.dpr !== fx.dpr) makeSign(); }; // the neon, crisp at the new DPR
  layout();
  k.loop(step, { still: 3 });
  if (k.sfx.on) sound(true);

  const settle = () => { layout(); k.after(500, layout); };
  return {
    question() { picked = null; settle(); },
    layout,
    status() { if (!ctx.question) renderNote(); },
    decisions() { if (ctx.front === 'done') renderNote(); },
    answer(a) {
      picked = a.picks || [];
      renderNote();
      wake = 1;
      awake = 1.8;
      zs = [];
      bubble = { age: 0, text: a.custom && !a.picks?.length ? 'mrrp?' : a.tookRec ? 'purr. approved.' : a.hasRec ? 'bold choice.' : 'mrrp.' };
      k.sfx.tone({ type: 'triangle', freq: 520, to: 760, dur: 0.25, gain: 0.05, vibrato: { rate: 9, depth: 30 } });
    },
    keystroke() { ear = 1; if (Math.random() < 0.15) tail = 1; },
    sound,
  };
}
