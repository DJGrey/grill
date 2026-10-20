// Trading floor. Every option is a stock. The ★ one rockets to the moon on a live candlestick
// chart, the rest drift, a watchlist and a ticker tape scroll past, and answering rings the bell.

const BG = '#060a11';
const UP = '#1fe07a';
const DOWN = '#ff4d5e';
const INK = '#d9e4f2';
const MUTED = '#6d7d94';
const LINES = ['#ffb020', '#5aa9ff', '#c38bff', '#ff7ac6', '#3fe0d0'];
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'for', 'in', 'on', 'and', 'or', 'them', 'they', 'it', 'are', 'is', 'be', 'by', 'with', 'each', 'where', 'what', 'as', 'at', 'we', 'our', 'your', 'only', 'just']);
const FILLER = [['COFE', 'Coffee futures', 3.2], ['MTNG', 'Meetings Inc', -2.1], ['YAK', 'Yak Shaving Ltd', 0.4], ['BKLG', 'The Backlog', 1.7], ['SLEP', 'Sleep', -4.4], ['TDBT', 'Tech Debt Holdings', 2.6], ['VIBE', 'Vibes', 0.9], ['JIRA', 'Ticket Systems', -1.2]];
const CANDLE = 0.85; // seconds per candle
const KNEE = Math.log(5), CAP = Math.log(25); // past 5x (or a fifth) of the opening price a trend runs out of steam, gone by 25x, so a long session stays on the chart

export default function tradingFloor(k, ctx) {
  const base = k.canvas({ alpha: false });
  const cv = k.canvas();
  const c = cv.ctx;

  let stocks = [];
  let G = null; // layout
  let clock = 0; // time into the current candle
  let tape = null; // { sprite, w, off }
  let stamp = null; // { text, sub, color, t }
  let pulse = 0; // volume from your keystrokes
  let answered = null;

  const mono = (s, w = 600) => k.font(s, w, 'mono');
  const big = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${(v / 1e3).toFixed(1)}K` : null);
  const pct = (v) => `${v >= 0 ? '+' : '−'}${big(Math.abs(v)) || Math.abs(v).toFixed(Math.abs(v) >= 1000 ? 0 : 1)}%`;
  const money = (v) => big(v) || (v >= 1000 ? v.toFixed(0) : v.toFixed(2));

  // "One ApprovalPolicy service" → OAS, "Webhook" → WEBH
  function symbol(label, taken) {
    const words = k.plain(label).replace(/[^A-Za-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
    const sig = words.filter((w) => !STOP.has(w.toLowerCase()));
    const ws = sig.length ? sig : words.length ? words : ['YOU'];
    let s = ws.length === 1 ? ws[0].slice(0, 4) : ws.slice(0, 4).map((w) => w[0]).join('');
    if (s.length < 3) s = (ws[0].slice(0, 4 - s.length + 1) + s.slice(1)).slice(0, 4);
    s = s.toUpperCase();
    let out = s, n = 2;
    while (taken.has(out)) out = s.slice(0, 3) + n++;
    taken.add(out);
    return out;
  }

  function stock(sym, name, { rec = false, drift, seed, color }) {
    const r = k.rng(`${seed}:${sym}`);
    const st = { sym, name, rec, drift, vol: 0.011, color, price0: r.rand(18, 420), candles: [], kick: 0 };
    let p = st.price0;
    for (let i = 0; i < 90; i++) {
      const o = p;
      p *= 1 + st.drift * (0.4 + i / 90) + r.rand(-1, 1) * st.vol * 1.4;
      st.candles.push({ o, c: p, h: Math.max(o, p) * (1 + r.rand(0, st.vol)), l: Math.min(o, p) * (1 - r.rand(0, st.vol)) });
    }
    return st;
  }

  function build() {
    const q = ctx.question;
    const taken = new Set();
    const seed = q?.id || ctx.front;
    if (ctx.front === 'done') {
      const ds = ctx.decisions.length ? ctx.decisions : ctx.answers.map((a) => ({ text: a.picks[0] || a.custom || a.title }));
      stocks = ds.slice(0, 5).map((d, i) => stock(symbol(d.text, taken), k.plain(d.text), { rec: i === 0, drift: 0.006 + i * 0.001, seed, color: i ? LINES[(i - 1) % LINES.length] : UP }));
      if (!stocks.length) stocks = [stock('GRIL', 'The grill', { rec: true, drift: 0.01, seed, color: UP })];
    } else if (!q) {
      stocks = [stock('AGNT', 'The agent (thinking)', { rec: true, drift: 0.0004, seed, color: UP }), stock('QSTN', 'Questions, pending', { drift: 0.001, seed, color: LINES[0] })];
    } else if (!q.options.length) {
      stocks = [stock('YOU', 'Your own words', { rec: true, drift: 0.003, seed, color: UP }), stock('IDK', '“idk”', { drift: -0.004, seed, color: LINES[0] })];
      stocks[0].vol = 0.03;
    } else {
      const recs = q.options.filter((o) => o.recommended);
      const order = [...recs, ...q.options.filter((o) => !o.recommended)];
      stocks = order.slice(0, 6).map((o, i) => stock(symbol(o.label, taken), k.plain(o.label) || `Option ${q.options.indexOf(o) + 1}`, {
        rec: o.recommended || (!recs.length && i === 0), seed,
        drift: o.recommended ? 0.009 + i * 0.001 : recs.length ? k.rng(`${seed}${o.label}`).rand(-0.005, 0.0005) : k.rng(`${seed}${o.label}`).rand(-0.002, 0.004),
        color: o.recommended ? (i ? '#7dffb6' : UP) : LINES[(i - recs.length) % LINES.length],
      }));
      if (!recs.length) stocks[0].color = LINES[4];
    }
    for (const s of stocks) s.vol0 = s.vol;
    buildTape();
  }

  const lead = () => stocks[0];
  const last = (s) => s.candles[s.candles.length - 1];
  const change = (s) => (last(s).c / s.price0 - 1) * 100;

  // ── one market tick ──────────────────────────────────────────────────

  function tick(dt) {
    const slow = ctx.front === 'question' && ctx.cardTime > 60;
    for (const s of stocks) {
      const cd = last(s);
      s.vol = s.vol0 * (slow ? 1.8 : 1) * (1 + pulse * 0.8);
      const jig = (Math.random() * 2 - 1) * s.vol * Math.sqrt(dt / CANDLE) * 1.6;
      const kick = s.kick * Math.min(1, dt * 4);
      s.kick -= kick;
      const lr = Math.log(cd.c / s.price0); // past the knee the drift fades out, past the cap a gentle pull brings it back
      const drift = s.drift * (Math.sign(s.drift) === Math.sign(lr) ? k.clamp((CAP - Math.abs(lr)) / (CAP - KNEE)) : 1) - Math.sign(lr) * Math.max(0, Math.abs(lr) - CAP) * 0.02;
      cd.c *= 1 + drift * (dt / CANDLE) + jig + kick;
      cd.h = Math.max(cd.h, cd.c);
      cd.l = Math.min(cd.l, cd.c);
    }
    clock += dt;
    if (clock >= CANDLE) {
      clock -= CANDLE;
      for (const s of stocks) {
        const p = last(s).c;
        s.candles.push({ o: p, c: p, h: p, l: p });
        if (s.candles.length > 400) s.candles.shift();
      }
      buildTape();
    }
  }

  // ── layout ───────────────────────────────────────────────────────────

  function layout() {
    const sp = k.space();
    const st = sp.stage;
    const bottom = sp.gaps.find((g) => g.where === 'bottom' || g.where === 'all');
    const top = sp.gaps.find((g) => g.where === 'top');
    const tapeH = 26;
    const tapeIn = top && top.h >= tapeH + 8 ? { x: st.x, y: Math.round(top.y + (top.h - tapeH) / 2), w: st.width, h: tapeH } : null;
    const room = bottom ? bottom.h - (tapeIn ? 0 : tapeH + 8) : 0;
    const area = room >= 110 ? { x: st.x + 22, y: bottom.y + 6, w: st.width - 44, h: room - 22 } : null;
    const tp = tapeIn || (bottom && bottom.h >= tapeH + 4 ? { x: st.x, y: bottom.y + bottom.h - tapeH - 4, w: st.width, h: tapeH } : null);
    let chart = area, list = null;
    if (area && area.w >= 620 && area.h >= 150) {
      const lw = Math.min(300, Math.round(area.w * 0.38));
      chart = { ...area, w: area.w - lw - 18 };
      list = { x: area.x + area.w - lw, y: area.y, w: lw, h: area.h };
    }
    G = { st, chart, list, tape: tp, vw: sp.vw, vh: sp.vh };
    buildTape();
    drawBase();
  }

  function drawBase() {
    const b = base.ctx;
    const W = base.w, H = base.h;
    b.fillStyle = BG;
    b.fillRect(0, 0, W, H);
    const glow = b.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, W * 0.7);
    glow.addColorStop(0, 'rgba(30,70,120,.35)');
    glow.addColorStop(1, 'rgba(30,70,120,0)');
    b.fillStyle = glow;
    b.fillRect(0, 0, W, H);
    b.strokeStyle = 'rgba(120,160,220,.07)';
    b.lineWidth = 1;
    for (let x = 0.5; x < W; x += 48) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H); b.stroke(); }
    for (let y = 0.5; y < H; y += 48) { b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
    if (!G) return;
    for (const r of [G.chart, G.list]) {
      if (!r) continue;
      b.fillStyle = 'rgba(10,17,28,.82)';
      b.strokeStyle = 'rgba(120,160,220,.16)';
      b.beginPath(); b.roundRect(r.x - 10, r.y - 4, r.w + 20, r.h + 8, 8); b.fill(); b.stroke();
    }
    if (G.tape) {
      b.fillStyle = '#03060b';
      b.fillRect(G.tape.x, G.tape.y, G.tape.w, G.tape.h);
      b.fillStyle = 'rgba(255,255,255,.06)';
      b.fillRect(G.tape.x, G.tape.y, G.tape.w, 1);
      b.fillRect(G.tape.x, G.tape.y + G.tape.h - 1, G.tape.w, 1);
    }
  }
  base.resized = drawBase;
  cv.resized = () => { if (tape && G) buildTape(); }; // the tape strip is baked at cv.dpr; its scroll position stays

  // The tape is pre-drawn into a strip and re-drawn once a candle, then just scrolled.
  function buildTape() {
    if (!G?.tape) { tape = null; return; }
    const items = [...stocks.map((s) => [s.rec ? `★${s.sym}` : s.sym, last(s).c, change(s)]), ...FILLER.map(([sym, , d], i) => [sym, 10 + (k.hash(sym) % 300) + Math.sin(Date.now() / 7000 + i) * 3, d + Math.sin(Date.now() / 5000 + i * 2) * 0.6])];
    const g = (tape?.sprite || document.createElement('canvas')).getContext('2d');
    g.font = mono(13, 700);
    const parts = items.map(([sym, p, d]) => ({ sym, p: money(p), d: `${d >= 0 ? '▲' : '▼'} ${pct(d)}`, up: d >= 0 }));
    const widths = parts.map((it) => g.measureText(`${it.sym} ${it.p} ${it.d}`).width + 42);
    const w = Math.ceil(widths.reduce((a, b) => a + b, 0));
    const d = cv.dpr;
    const s = tape?.sprite || document.createElement('canvas');
    const sw = Math.ceil(w * d), sh = Math.ceil(G.tape.h * d);
    if (s.width !== sw || s.height !== sh) { s.width = sw; s.height = sh; }
    const sg = s.getContext('2d');
    sg.setTransform(d, 0, 0, d, 0, 0);
    sg.clearRect(0, 0, w, G.tape.h);
    sg.font = mono(13, 700);
    sg.textBaseline = 'middle';
    let x = 14;
    const y = G.tape.h / 2 + 1;
    parts.forEach((it, i) => {
      sg.fillStyle = it.sym.startsWith('★') ? '#ffd23f' : INK;
      sg.fillText(it.sym, x, y);
      x += sg.measureText(`${it.sym} `).width;
      sg.fillStyle = '#9fb0c7';
      sg.fillText(it.p, x, y);
      x += sg.measureText(`${it.p} `).width;
      sg.fillStyle = it.up ? UP : DOWN;
      sg.fillText(it.d, x, y);
      x = parts.slice(0, i + 1).reduce((a, _, j) => a + widths[j], 14);
    });
    tape = { sprite: s, w, off: tape?.off || 0 };
  }

  // ── drawing ──────────────────────────────────────────────────────────

  function rocket(x, y, ang, t) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.scale(1.5, 1.5);
    const fl = 10 + Math.sin(t * 40) * 3 + Math.random() * 3;
    const fg = c.createLinearGradient(-8, 0, -8 - fl, 0);
    fg.addColorStop(0, '#fff6c2'); fg.addColorStop(0.4, '#ffb020'); fg.addColorStop(1, 'rgba(255,60,40,0)');
    c.fillStyle = fg;
    c.beginPath(); c.moveTo(-7, -3.5); c.quadraticCurveTo(-8 - fl, 0, -7, 3.5); c.closePath(); c.fill();
    c.fillStyle = '#e8424f'; // fins
    c.beginPath(); c.moveTo(-6, -4); c.lineTo(-10, -8); c.lineTo(-3, -4); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-6, 4); c.lineTo(-10, 8); c.lineTo(-3, 4); c.closePath(); c.fill();
    c.fillStyle = '#f4f6fb';
    c.beginPath(); c.moveTo(-7, -4.5); c.lineTo(5, -4.5); c.quadraticCurveTo(13, -2, 14, 0); c.quadraticCurveTo(13, 2, 5, 4.5); c.lineTo(-7, 4.5); c.closePath(); c.fill();
    c.fillStyle = '#e8424f';
    c.beginPath(); c.moveTo(8, -3.6); c.quadraticCurveTo(13, -2, 14, 0); c.quadraticCurveTo(13, 2, 8, 3.6); c.closePath(); c.fill();
    c.fillStyle = '#3d8bff';
    c.strokeStyle = '#9aa7b8';
    c.lineWidth = 1;
    c.beginPath(); c.arc(1.5, 0, 2.2, 0, 7); c.fill(); c.stroke();
    c.restore();
  }

  function moon(x, y, r) {
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
    g.addColorStop(0, '#fbf6e4'); g.addColorStop(1, '#c9c2a8');
    c.fillStyle = 'rgba(255,248,210,.12)';
    c.beginPath(); c.arc(x, y, r * 1.8, 0, 7); c.fill();
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.fillStyle = 'rgba(150,140,110,.45)';
    for (const [dx, dy, rr] of [[-0.35, -0.2, 0.22], [0.3, 0.25, 0.16], [0.1, -0.45, 0.1], [-0.1, 0.45, 0.12]]) { c.beginPath(); c.arc(x + dx * r, y + dy * r, rr * r, 0, 7); c.fill(); }
  }

  function drawChart(t) {
    const r = G.chart;
    if (!r) return;
    const s0 = lead();
    // header: symbol, name, price, change
    const hy = r.y + 14;
    c.textBaseline = 'middle';
    c.font = mono(15, 800);
    c.fillStyle = INK;
    const symW = c.measureText(`$${s0.sym}`).width;
    c.fillText(`$${s0.sym}`, r.x, hy);
    const ch = change(s0);
    const right = `${money(last(s0).c)}  ${ch >= 0 ? '▲' : '▼'} ${pct(ch)}`;
    c.font = mono(13, 700);
    const rw = c.measureText(right).width;
    c.fillStyle = ch >= 0 ? UP : DOWN;
    c.fillText(right, r.x + r.w - rw, hy);
    const tag = ctx.front === 'done' ? 'CLOSING BELL' : !ctx.question ? 'PRE-MARKET' : answered ? (answered.tookRec || !answered.hasRec ? 'FILLED' : 'HALTED') : s0.rec && ctx.question.recommended.length ? '★ STRONG BUY' : 'HOLD';
    c.font = k.font(10, 800);
    const tw = c.measureText(tag).width + 12;
    const nameW = r.w - symW - rw - tw - 34;
    c.fillStyle = tag === 'HALTED' ? DOWN : tag === '★ STRONG BUY' || tag === 'FILLED' ? '#ffd23f' : MUTED;
    c.beginPath(); c.roundRect(r.x + symW + 10, hy - 8, tw, 16, 3); c.fill();
    c.fillStyle = BG;
    c.fillText(tag, r.x + symW + 16, hy + 0.5);
    if (nameW > 40) {
      c.font = k.font(12, 500);
      c.fillStyle = MUTED;
      c.fillText(k.ellipsize(c, s0.name, nameW), r.x + symW + tw + 18, hy);
    }
    // the plot, everything as % change from the left edge so options compare
    const px = r.x, py = r.y + 32, pw = r.w - 46, ph = r.h - 32 - 18;
    if (ph < 30) return;
    const step = pw > 420 ? 9 : 7;
    const n = Math.floor(pw / step);
    const frac = clock / CANDLE;
    const view = stocks.map((s) => s.candles.slice(-n - 1));
    const baseOf = view.map((v) => v[0].o);
    let lo = Infinity, hi = -Infinity;
    view.forEach((v, i) => v.forEach((cd, j) => {
      const b = baseOf[i];
      if (i === 0) { lo = Math.min(lo, cd.l / b); hi = Math.max(hi, cd.h / b); } else { lo = Math.min(lo, cd.c / b); hi = Math.max(hi, cd.c / b); }
    }));
    G.lo = G.lo == null ? lo : k.lerp(G.lo, lo, 0.08);
    G.hi = G.hi == null ? hi : k.lerp(G.hi, hi, 0.08);
    const span = Math.max(0.02, G.hi - G.lo);
    const top = s0.rec && ctx.question?.recommended.length && !answered ? 0.68 : 0.86; // headroom for the moon
    const y = (v) => py + ph - ((v - G.lo) / span) * ph * top - ph * 0.07;
    const xAt = (j, len) => px + pw - (len - 1 - j + frac) * step - step / 2;
    // grid and axis
    c.font = mono(10, 500);
    c.textBaseline = 'middle';
    for (let i = 0; i <= 3; i++) {
      const v = G.lo + span * i / 3;
      const yy = y(v);
      c.strokeStyle = 'rgba(120,160,220,.1)';
      c.beginPath(); c.moveTo(px, yy); c.lineTo(px + pw, yy); c.stroke();
      c.fillStyle = MUTED;
      c.textAlign = 'right';
      c.fillText(pct((v - 1) * 100), px + pw - 4, yy - 7);
      c.textAlign = 'left';
    }
    c.save();
    c.beginPath(); c.rect(px, py - 4, pw, ph + 8); c.clip();
    // the moon, top right, where the ★ is headed
    if (s0.rec && ctx.question?.recommended.length && !answered && ph > 90) moon(px + pw - 30, py + 20, 14);
    // the others as lines
    for (let i = view.length - 1; i >= 1; i--) {
      const v = view[i], s = stocks[i];
      c.strokeStyle = s.color;
      c.lineWidth = 1.6;
      c.globalAlpha = 0.85;
      c.beginPath();
      v.forEach((cd, j) => { const X = xAt(j, v.length), Y = y(cd.c / baseOf[i]); j ? c.lineTo(X, Y) : c.moveTo(X, Y); });
      c.stroke();
      c.globalAlpha = 1;
    }
    // the lead as candles
    const v0 = view[0];
    v0.forEach((cd, j) => {
      const X = xAt(j, v0.length);
      const upC = cd.c >= cd.o;
      c.strokeStyle = c.fillStyle = upC ? UP : DOWN;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(Math.round(X) + 0.5, y(cd.h / baseOf[0])); c.lineTo(Math.round(X) + 0.5, y(cd.l / baseOf[0])); c.stroke();
      const y1 = y(cd.o / baseOf[0]), y2 = y(cd.c / baseOf[0]);
      c.fillRect(Math.round(X - step * 0.32), Math.min(y1, y2), Math.max(2, Math.round(step * 0.64)), Math.max(1, Math.abs(y2 - y1)));
    });
    // volume (your typing)
    c.fillStyle = 'rgba(90,169,255,.18)';
    v0.forEach((cd, j) => {
      const vh = Math.min(ph * 0.14, Math.abs(cd.h - cd.l) / cd.o * 500 * (j === v0.length - 1 ? 1 + pulse * 3 : 1));
      c.fillRect(Math.round(xAt(j, v0.length) - step * 0.32), py + ph - vh, Math.max(2, Math.round(step * 0.64)), vh);
    });
    c.restore();
    // labels at the end of each line
    c.font = mono(10, 800);
    const tags = stocks.map((s, i) => ({ s, Y: y(last(s).c / baseOf[i]) })).sort((a, b) => a.Y - b.Y);
    for (let i = 1; i < tags.length; i++) tags[i].Y = Math.max(tags[i].Y, tags[i - 1].Y + 15);
    for (const { s, Y } of tags) {
      const w = c.measureText(s.sym).width + 8;
      c.fillStyle = s.rec ? UP : s.color;
      c.beginPath(); c.roundRect(px + pw + 4, Math.min(py + ph, Y) - 7, w, 14, 3); c.fill();
      c.fillStyle = BG;
      c.fillText(s.sym, px + pw + 8, Math.min(py + ph, Y) + 0.5);
    }
    // the rocket rides the ★ candle
    if (s0.rec && ctx.question?.recommended.length || ctx.front === 'done') {
      const a = v0[v0.length - 4] || v0[0], b = last(s0);
      const X = xAt(v0.length - 1, v0.length) + 6, Y = y(b.c / baseOf[0]) - 6;
      const ang = Math.atan2(y(b.c / baseOf[0]) - y(a.c / baseOf[0]), step * 3);
      if (!answered || answered.tookRec) rocket(Math.min(X, px + pw - 6), Math.max(py + 6, Y), Math.max(-1.3, Math.min(0.2, ang)), t);
    }
  }

  function drawList() {
    const r = G.list;
    if (!r) return;
    c.textBaseline = 'middle';
    c.font = k.font(10, 800);
    c.fillStyle = MUTED;
    c.fillText(ctx.front === 'done' ? 'PORTFOLIO' : 'WATCHLIST', r.x, r.y + 14);
    c.textAlign = 'right';
    c.fillText(ctx.front === 'done' ? 'CLOSED' : !ctx.question ? 'PRE-MKT' : 'LIVE', r.x + r.w, r.y + 14);
    c.textAlign = 'left';
    const rowH = 30;
    const rows = Math.floor((r.h - 32) / rowH);
    const all = [...stocks, ...FILLER.map(([sym, name, d]) => ({ sym, name, filler: d }))].slice(0, rows);
    all.forEach((s, i) => {
      const yy = r.y + 32 + i * rowH + rowH / 2;
      c.strokeStyle = 'rgba(120,160,220,.1)';
      c.beginPath(); c.moveTo(r.x, yy - rowH / 2); c.lineTo(r.x + r.w, yy - rowH / 2); c.stroke();
      const d = s.filler ?? change(s);
      const price = s.filler != null ? 10 + (k.hash(s.sym) % 300) : last(s).c;
      c.font = mono(12, 800);
      c.fillStyle = s.rec ? '#ffd23f' : s.filler != null ? '#9fb0c7' : INK;
      c.fillText(`${s.rec ? '★' : ''}${s.sym}`, r.x, yy - 5);
      const sx = r.x + r.w - 62 - 110;
      const spark = !s.filler && s.candles && sx > r.x + 60;
      c.font = k.font(10, 500);
      c.fillStyle = MUTED;
      c.fillText(k.ellipsize(c, s.name, (spark ? sx : r.x + r.w - 130) - r.x - 8), r.x, yy + 8);
      // pill
      const txt = pct(d);
      c.font = mono(11, 800);
      const pw = 62;
      c.fillStyle = d >= 0 ? 'rgba(31,224,122,.16)' : 'rgba(255,77,94,.16)';
      c.beginPath(); c.roundRect(r.x + r.w - pw, yy - 9, pw, 18, 4); c.fill();
      c.fillStyle = d >= 0 ? UP : DOWN;
      c.textAlign = 'right';
      c.fillText(txt, r.x + r.w - 6, yy + 0.5);
      c.fillStyle = INK;
      c.font = mono(11, 600);
      c.fillText(money(price), r.x + r.w - pw - 10, yy + 0.5);
      c.textAlign = 'left';
      // sparkline
      if (spark) {
        const sp = s.candles.slice(-30);
        const mn = Math.min(...sp.map((q) => q.c)), mx = Math.max(...sp.map((q) => q.c));
        {
          c.strokeStyle = d >= 0 ? UP : DOWN;
          c.lineWidth = 1.2;
          c.beginPath();
          sp.forEach((q, j) => { const X = sx + (j / 29) * 36, Y = yy + 7 - ((q.c - mn) / (mx - mn || 1)) * 14; j ? c.lineTo(X, Y) : c.moveTo(X, Y); });
          c.stroke();
        }
      }
    });
  }

  // a faint giant chart of the lead stock across the whole floor, so it glows through the panels
  function drawWall() {
    const s = lead();
    const v = s.candles.slice(-80);
    const mn = Math.min(...v.map((q) => q.l)), mx = Math.max(...v.map((q) => q.h));
    const W = cv.w, H = cv.h;
    const X = (j) => ((j + 1 - clock / CANDLE) / (v.length - 1)) * W * 1.05 - W * 0.02;
    const Y = (p) => H * 0.92 - ((p - mn) / (mx - mn || 1)) * H * 0.75;
    c.beginPath();
    v.forEach((q, j) => (j ? c.lineTo(X(j), Y(q.c)) : c.moveTo(X(j), Y(q.c))));
    c.lineTo(W * 1.1, H); c.lineTo(0, H); c.closePath();
    const g = c.createLinearGradient(0, H * 0.2, 0, H);
    const col = change(s) >= 0 ? '31,224,122' : '255,77,94';
    g.addColorStop(0, `rgba(${col},.16)`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = `rgba(${col},.35)`;
    c.lineWidth = 2;
    c.beginPath();
    v.forEach((q, j) => (j ? c.lineTo(X(j), Y(q.c)) : c.moveTo(X(j), Y(q.c))));
    c.stroke();
  }

  function drawTape(dt) {
    if (!tape || !G.tape) return;
    const T = G.tape;
    if (!k.reduced) tape.off = (tape.off + dt * 60) % tape.w;
    c.save();
    c.beginPath(); c.rect(T.x, T.y, T.w, T.h); c.clip();
    const sw = tape.sprite.width, sh = tape.sprite.height;
    for (let x = T.x - tape.off; x < T.x + T.w; x += tape.w) c.drawImage(tape.sprite, 0, 0, sw, sh, x, T.y, tape.w, T.h);
    const fade = (x0, x1) => { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#03060b'); g.addColorStop(1, 'rgba(3,6,11,0)'); c.fillStyle = g; c.fillRect(Math.min(x0, x1), T.y, Math.abs(x1 - x0), T.h); };
    fade(T.x, T.x + 30);
    fade(T.x + T.w, T.x + T.w - 30);
    c.restore();
  }

  function drawStamp(dt) {
    if (!stamp || !G.chart) return;
    stamp.t += dt;
    const p = k.reduced ? 1 : k.clamp(stamp.t / 0.35);
    const s = 1 + (1 - k.ease.outBack(p)) * 1.4;
    const r = G.chart;
    c.save();
    c.translate(r.x + r.w * 0.45, r.y + r.h * 0.55);
    c.rotate(-0.12);
    c.scale(s, s);
    c.globalAlpha = Math.min(1, p * 1.5);
    k.fit(c, stamp.text, r.w * 0.72, { size: 44, min: 18, weight: 900, family: 'display' });
    const w = c.measureText(stamp.text).width;
    c.strokeStyle = stamp.color;
    c.lineWidth = 4;
    c.beginPath(); c.roundRect(-w / 2 - 14, -30, w + 28, 60 + (stamp.sub ? 18 : 0), 6); c.stroke();
    c.fillStyle = stamp.color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(stamp.text, 0, 0);
    if (stamp.sub) { c.font = k.font(12, 800); c.fillText(stamp.sub, 0, 30); }
    c.restore();
  }

  build();
  layout();

  k.loop((dt, t) => {
    if (!k.reduced) tick(dt);
    pulse = Math.max(0, pulse - dt * 1.5);
    c.clearRect(0, 0, cv.w, cv.h);
    drawWall();
    drawChart(t);
    drawList();
    drawTape(dt);
    drawStamp(dt);
  }, { still: 0.1 });

  return {
    question() {
      answered = null;
      stamp = null;
      G = null;
      build();
      layout();
      k.sfx.blip({ pitch: 1.5, gain: 0.6 });
    },
    layout,
    status() { if (!ctx.question) build(); },
    decisions() { if (ctx.front === 'done') build(); },
    keystroke() { pulse = Math.min(1.5, pulse + 0.25); },
    answer(a) {
      answered = a;
      for (const s of stocks) {
        const picked = a.picks.includes(s.name) || (!a.picks.length && s === lead());
        if (picked) { s.kick = 0.14; s.drift = 0.02; } else if (s.rec && !a.tookRec) { s.kick = -0.22; s.drift = -0.02; } else s.drift = -0.006;
      }
      if (a.tookRec) stamp = { text: 'SOLD!', sub: 'TO THE ★, AT MARKET', color: UP, t: 0 };
      else if (a.picks.length && !a.hasRec) stamp = { text: 'BOUGHT!', sub: 'NO ★ TO FOLLOW. YOUR CALL', color: UP, t: 0 };
      else if (a.picks.length) stamp = { text: 'CIRCUIT BREAKER', sub: '★ IN FREEFALL. BOLD.', color: DOWN, t: 0 };
      else stamp = { text: 'OFF-BOOK TRADE', sub: 'WRITE-IN POSITION OPENED', color: '#ffd23f', t: 0 };
      const r = G.chart || G.st;
      if (r) k.burst(r.x + r.w * 0.45, r.y + (r.h || 200) * 0.5, { shape: '$', n: 26, colors: a.tookRec ? [UP, '#7dffb6', '#ffd23f'] : [DOWN, '#ffb020'], speed: 380, size: 16, life: 1.4 });
      k.sfx.chime({ pitch: 0.5, gain: 0.7 }); // the bell
      k.sfx.coin({ delay: 0.15, gain: 0.6 });
    },
  };
}
