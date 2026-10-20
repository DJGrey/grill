// Departures board. A split-flap airport board where each option is a flight: the ★ one is
// BOARDING, the rest are DELAYED. The flaps clatter when the question changes and an LED sign
// makes the announcements.

const ORDER = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-:/&\'?!';
const COL = { white: '#f3efe2', yellow: '#ffcb3d', green: '#58f08a', amber: '#ffa83a', red: '#ff5b4d', grey: '#8d8b86' };
const HOUSING = '#0b0b0d';
const FILLER = [
  ['LEGACY CODE', 'DELAYED', 'amber'], ['TECH DEBT', 'DELAYED', 'amber'], ['FRIDAY DEPLOY', 'CANCELLED', 'red'],
  ['PROD', 'ON TIME', 'white'], ['STAGING', 'DEPARTED', 'grey'], ['THE BACKLOG', 'DELAYED', 'amber'],
  ['BIKESHED', 'GATE CLOSED', 'grey'], ['YAK SHAVING', 'ON TIME', 'white'], ['REWRITE IN RUST', 'DELAYED', 'amber'],
  ['MERGE CONFLICT', 'SEE AGENT', 'amber'], ['LOCALHOST', 'DEPARTED', 'grey'], ['SCOPE CREEP', 'BOARDING', 'green'],
  ['THE MONOLITH', 'CANCELLED', 'red'], ['MICROSERVICES', 'DELAYED', 'amber'], ['INBOX ZERO', 'CANCELLED', 'red'],
  ['Q4 ROADMAP', 'DELAYED', 'amber'], ['THE CLOUD', 'ON TIME', 'white'], ['NULL ISLAND', 'DIVERTED', 'amber'],
  ['STANDUP', 'DEPARTED', 'grey'], ['POSTMORTEM', 'ON TIME', 'white'], ['V2', 'DELAYED', 'amber'],
  ['ONE MORE MEETING', 'BOARDING', 'green'], ['HACKER NEWS', 'DIVERTED', 'amber'], ['THE WIKI', 'CANCELLED', 'red'],
];
const AIRLINES = ['KX', 'ZZ', 'YK', 'QA', 'BS', 'JS', 'DB'];
const STEP = 0.05; // seconds per flap

export default function departures(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  const fx = k.canvas();
  const f = fx.ctx;
  k.el('div', { style: 'position:absolute;inset:0;pointer-events:none;background:linear-gradient(172deg, rgba(255,255,255,.07), transparent 28%, transparent 70%, rgba(255,255,255,.03)),radial-gradient(ellipse 80% 70% at 50% 40%, transparent 50%, rgba(0,0,0,.55))' });

  const sprites = new Map();
  const rows = new Map(); // logical row → { cells, lamp, kind } (row 0 is the first flight under the header)
  let G = null; // geometry
  let clock = null; // flap cells for HH:MM
  let led = null; // { sprite, cols, x, y, w, h, pitch, off }
  let plane = null; // a little plane taking off after an answer
  let clackAt = 0;
  let answered = null; // { picks, tookRec, custom }
  let stamp = '';

  const up = (s) => k.plain(s).toUpperCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const dest = (s) => k.clip(up(s), 60); // a label in an announcement: the LED sign is one long sprite
  const pad = (s, n) => [...s.slice(0, n).padEnd(n)];
  const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const flightNo = (s, code = 'GR') => `${code}${100 + (k.hash(s) % 900)}`;

  function sprite(ch, color) {
    const key = color + ch;
    let s = sprites.get(key);
    if (s) return s;
    const { cw, ch: hh } = G;
    const d = cv.dpr;
    s = document.createElement('canvas');
    s.width = Math.ceil(cw * d);
    s.height = Math.ceil(hh * d);
    const g = s.getContext('2d');
    g.scale(d, d);
    const r = Math.max(1.5, cw * 0.12);
    const top = g.createLinearGradient(0, 0, 0, hh / 2);
    top.addColorStop(0, '#34343a');
    top.addColorStop(1, '#25252a');
    const bot = g.createLinearGradient(0, hh / 2, 0, hh);
    bot.addColorStop(0, '#1e1e22');
    bot.addColorStop(1, '#141417');
    g.fillStyle = top;
    g.beginPath(); g.roundRect(0, 0, cw, hh / 2, [r, r, 0, 0]); g.fill();
    g.fillStyle = bot;
    g.beginPath(); g.roundRect(0, hh / 2, cw, hh / 2, [0, 0, r, r]); g.fill();
    g.fillStyle = 'rgba(255,255,255,.07)';
    g.fillRect(0.5, 0.5, cw - 1, 1);
    if (ch !== ' ') {
      g.font = k.font(Math.round(hh * 0.66), 700, ch === '…' ? 'sans' : '"Helvetica Neue", Arial, "Liberation Sans", sans-serif');
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = COL[color];
      g.shadowColor = color === 'green' || color === 'red' ? `${COL[color]}aa` : 'transparent';
      g.shadowBlur = 2;
      g.fillText(ch, cw / 2, hh / 2 + hh * 0.035, cw * 0.92);
    }
    g.fillStyle = '#050506'; // the split
    g.fillRect(0, hh / 2 - 0.6, cw, 1.2);
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(0, hh / 2 - 0.6, 1.2, 1.2);
    g.fillRect(cw - 1.2, hh / 2 - 0.6, 1.2, 1.2);
    sprites.set(key, s);
    return s;
  }

  // Every cell flips through the characters in order on its way to the target, like the real thing.
  function aim(cell, ch, color, delay = 0) {
    if (cell.tgt === ch && cell.tcol === color) return;
    cell.tgt = ch;
    cell.tcol = color;
    if (k.reduced) { cell.cur = ch; cell.col = color; cell.seq = null; return; }
    const L = ORDER.length;
    const ti = ORDER.indexOf(ch), ci = ORDER.indexOf(cell.cur);
    const dist = ti < 0 || ci < 0 ? k.int(5, 12) : (ti - ci + L) % L || L;
    const n = Math.min(dist, k.int(7, 16));
    cell.seq = Array.from({ length: n }, (_, i) => (i === n - 1 ? ch : ORDER[((ti < 0 ? k.int(0, L - 1) : ti) - n + 1 + i + L * 2) % L]));
    cell.wait = Math.max(cell.wait || 0, delay);
    cell.p = 0;
  }

  function cells(n) {
    return Array.from({ length: n }, () => ({ cur: ' ', col: 'white', tgt: ' ', tcol: 'white', seq: null, p: 0, wait: 0, x: 0, y: 0 }));
  }

  // ── what the board says ─────────────────────────────────────────────────

  function flights() {
    const q = ctx.question;
    const t0 = new Date(Math.ceil(Date.now() / 300000) * 300000 + 300000);
    const at = (i) => hhmm(new Date(t0.getTime() + i * 300000));
    if (ctx.front === 'done') {
      const ds = ctx.decisions.length ? ctx.decisions : ctx.answers.map((a, i) => ({ n: i + 1, text: a.picks[0] || a.custom || a.title }));
      return ds.map((d, i) => ({ time: at(-ds.length + i), flight: `D${d.n ?? i + 1}`, dest: d.text, gate: 'D', rem: 'LANDED', col: 'green', lamp: 'green' }));
    }
    if (!q) {
      const listening = ctx.agent === 'listening';
      return [
        { time: at(0), flight: 'GR001', dest: 'FIRST QUESTION', gate: 'Q1', rem: listening ? 'BOARDING' : 'DELAYED', col: listening ? 'green' : 'amber', lamp: listening ? 'green' : 'amber' },
        { time: at(1), flight: 'GR002', dest: 'SECOND QUESTION', gate: 'Q2', rem: 'DELAYED', col: 'amber' },
        { time: at(2), flight: 'GR404', dest: 'THE ANSWER', gate: '?', rem: 'NOT FOUND', col: 'red' },
      ];
    }
    const gate = `Q${q.n ?? ''}`;
    if (!q.options.length) return [{ time: at(0), flight: flightNo(q.id), dest: 'WHEREVER YOU SAY', gate, rem: answered ? 'DEPARTED' : 'WRITE-IN', col: answered ? 'grey' : 'yellow', lamp: answered ? null : 'yellow' }];
    const late = ctx.cardTime;
    return q.options.map((o, i) => {
      const r = { time: at(i), flight: flightNo(q.id + o.label), dest: o.label, gate };
      if (answered) {
        const picked = answered.picks.includes(o.label);
        if (picked) return { ...r, rem: 'DEPARTED', col: 'green', lamp: 'green' };
        if (answered.custom && !answered.picks.length) return { ...r, rem: 'DIVERTED', col: 'amber' };
        return { ...r, rem: o.recommended ? 'GATE CLOSED' : 'CANCELLED', col: o.recommended ? 'grey' : 'red' };
      }
      if (o.recommended) return late > 120 ? { ...r, rem: 'CLOSING NOW', col: 'red', lamp: 'red' } : late > 45 ? { ...r, rem: 'FINAL CALL', col: 'red', lamp: 'red' } : { ...r, rem: 'BOARDING', col: 'green', lamp: 'green' };
      if (!q.recommended.length) return { ...r, rem: 'DELAYED', col: 'amber', lamp: i ? null : 'amber' };
      return late > 120 ? { ...r, rem: 'SEE AGENT', col: 'amber' } : { ...r, rem: 'DELAYED', col: 'amber' };
    });
  }

  function announcement() {
    const q = ctx.question;
    const thanks = 'THANK YOU FOR FLYING GRILL AIRWAYS';
    const n = ctx.decisions.length || ctx.answers.length;
    if (ctx.front === 'done') return [`WELCOME TO DONE. LOCAL TIME ${hhmm(new Date())}`, n > 1 ? `ALL ${n} DECISIONS HAVE LANDED` : n ? 'YOUR DECISION HAS LANDED' : 'ALL DECISIONS HAVE LANDED', 'PLEASE TAKE ALL YOUR CONTEXT WITH YOU WHEN LEAVING THE GRILL', thanks];
    if (!q) return ctx.agent === 'listening'
      ? ['THE AGENT IS LISTENING', 'YOUR FIRST QUESTION WILL BE ANNOUNCED SHORTLY', 'PLEASE HAVE YOUR OPINIONS READY']
      : ['WE APOLOGISE FOR THE DELAY', 'THE AGENT IS READING YOUR PLAN', 'COMPLIMENTARY SNACKS ARE NOT AVAILABLE ON THIS GRILL', 'YOU MAY ADD CONTEXT WHILE YOU WAIT'];
    const gate = `GATE Q${q.n}`;
    if (answered) return answered.tookRec || (!answered.hasRec && answered.picks.length)
      ? ['WHEELS UP', `FLIGHT TO ${dest(answered.picks[0] || '')} HAS DEPARTED ON TIME`, 'THE AGENT IS PREPARING YOUR NEXT QUESTION']
      : !answered.hasRec ? ['THIS FLIGHT HAS BEEN DIVERTED', 'DESTINATION: YOUR OWN WORDS', 'THE AGENT IS PREPARING YOUR NEXT QUESTION']
      : [answered.picks.length ? `UNSCHEDULED DEPARTURE TO ${dest(answered.picks[0])}` : 'THIS FLIGHT HAS BEEN DIVERTED', 'THE RECOMMENDED FLIGHT LEFT WITHOUT YOU', 'BOLD MOVE'];
    const title = `NOW BOARDING AT ${gate}: ${k.clip(up(q.title), 120)}`;
    if (!q.options.length) return [title, 'THIS FLIGHT HAS NO DESTINATION', 'PLEASE WRITE ONE IN THE BOX PROVIDED', thanks];
    const rec = q.options.find((o) => o.recommended);
    const other = q.options.find((o) => !o.recommended);
    const lines = [title];
    if (rec) lines.push(ctx.cardTime > 90 ? `PASSENGER DEVELOPER PLEASE PROCEED TO ${gate} IMMEDIATELY` : `FINAL CALL FOR ${flightNo(q.id + rec.label)} TO ${dest(rec.label)}`);
    else lines.push('NO FLIGHT IS RECOMMENDED TODAY', 'CHOOSE YOUR OWN ADVENTURE');
    if (other) lines.push(`PASSENGERS FOR ${dest(other.label)}: YOUR FLIGHT IS DELAYED UNTIL YOU DECIDE`);
    lines.push('UNATTENDED DECISIONS WILL BE REMOVED AND DESTROYED');
    if (q.multi) lines.push('MULTIPLE DESTINATIONS PERMITTED ON THIS ROUTE');
    return lines;
  }

  // ── layout ─────────────────────────────────────────────────────────────

  function geometry() {
    const sp = k.space();
    const bottom = sp.gaps.find((g) => g.where === 'bottom' || g.where === 'all');
    const top = sp.gaps.find((g) => g.where === 'top');
    const st = sp.stage;
    const W = Math.min(st.width - 36, 1100);
    const cw = Math.round(k.clamp(W / 52, 12, 19));
    const P = cw + 2;
    const ch = Math.round(cw * 1.5);
    const pitch = ch + 8;
    const cgap = Math.round(cw * 0.8);
    let spec = [['time', 5], ['flight', 5], ['dest', 0], ['gate', 3], ['rem', 11]];
    const fixed = (s) => s.reduce((a, [, n]) => a + n * P, 0) + (s.length - 1) * cgap;
    let dest = Math.floor((W - fixed(spec)) / P);
    if (dest < 20) { spec = spec.filter(([key]) => key !== 'time'); dest = Math.floor((W - fixed(spec)) / P); }
    spec = spec.map(([key, n]) => [key, key === 'dest' ? Math.max(4, dest) : n]);
    const bw = fixed(spec);
    const x0 = Math.round(st.x + (st.width - bw) / 2);
    let x = x0;
    const cols = spec.map(([key, n]) => { const col = { key, n, x }; x += n * P + cgap; return col; });
    const headH = Math.round(cw * 2.1) + 30;
    const ledH = Math.round(cw * 1.3);
    // the header and flights go in the gap under the card, the LED sign above it
    const main = bottom && bottom.h >= headH + pitch * 1.5 ? bottom : top && top.h >= headH + pitch * 1.5 ? top : bottom || top || { x: st.x, y: st.y, w: st.width, h: st.height };
    const ledGap = main !== top && top && top.h >= ledH + 14 ? top : null;
    const headY = Math.round(main.y + 14);
    const y0 = headY + headH;
    let ledY = ledGap ? Math.round(ledGap.y + (ledGap.h - ledH) / 2) : null;
    const room = Math.floor((main.y + main.h - y0 - (ledGap ? 0 : ledH + 18)) / pitch);
    if (!ledGap && room >= 1) ledY = Math.round(y0 + room * pitch + 8);
    return { cw, ch, P, pitch, cgap, cols, x0, bw, headY, headH, y0, room: Math.max(0, room), ledY, ledH, sx: st.x, sw: st.width, vw: sp.vw, vh: sp.vh };
  }

  function rowText(r) {
    return Object.fromEntries(G.cols.map(({ key, n }) => [key, pad(key === 'dest' ? k.clip(up(r.dest), n).replace('…', '.') : up(r[key] || ''), n)]));
  }

  function setRow(i, r, delay) {
    let row = rows.get(i);
    if (!row || row.cells.length !== G.cols.reduce((a, c) => a + c.n, 0)) {
      row = { cells: cells(G.cols.reduce((a, c) => a + c.n, 0)) };
      rows.set(i, row);
    }
    row.lamp = r?.lamp || null;
    const text = r ? rowText(r) : null;
    let j = 0;
    G.cols.forEach(({ key, n }) => {
      for (let m = 0; m < n; m++, j++) {
        const color = !r ? 'white' : key === 'rem' ? r.col : key === 'flight' ? 'yellow' : r.dim ? 'grey' : 'white';
        aim(row.cells[j], text ? text[key][m] : ' ', color, delay + j * 0.012 + k.rand(0, 0.18));
      }
    });
  }

  function place() {
    for (const [i, row] of rows) {
      let j = 0;
      G.cols.forEach(({ n, x }) => { for (let m = 0; m < n; m++, j++) Object.assign(row.cells[j], { x: x + m * G.P, y: G.y0 + i * G.pitch }); });
    }
    if (clock) clock.forEach((cl, i) => Object.assign(cl, { x: G.x0 + G.bw - (5 - i) * G.P, y: G.headY + (Math.round(G.cw * 2.1) - G.ch) / 2 }));
  }

  function fill(delay = 0) {
    const fl = flights();
    const visible = Math.max(G.room, fl.length);
    const filler = k.rng(`${ctx.question?.id || ctx.front}:filler`);
    const pool = filler.shuffle(FILLER);
    const t0 = Date.now();
    const from = 0;
    const to = Math.ceil((G.vh - G.y0) / G.pitch);
    for (let i = from; i <= to; i++) {
      if (i >= 0 && i < fl.length) { setRow(i, fl[i], delay + i * 0.1); continue; }
      const [dest, rem, col] = pool[(i + 40) % pool.length];
      const when = new Date(t0 + (i - fl.length + 2) * 420000);
      setRow(i, i >= visible + 2 && k.reduced ? null : { time: hhmm(when), flight: flightNo(dest, filler.pick(AIRLINES)), dest, gate: `${'ABCDEFG'[(k.hash(dest) % 7)]}${k.hash(dest) % 40 + 1}`, rem, col, dim: rem === 'DEPARTED' }, delay + Math.max(0, i) * 0.1);
    }
    for (const i of rows.keys()) if (i < from || i > to) rows.delete(i);
    if (!clock) clock = cells(5);
    [...hhmm(new Date())].forEach((ch, i) => aim(clock[i], ch, 'white', delay));
    place();
    buildLed();
    redrawAll(); // the settled cells (and, under reduced motion, every change: nothing flips into place)
  }

  // The LED sign: text thresholded into dots once, then scrolled a column at a time.
  function buildLed(text = `${announcement().join('   +++   ')}   +++   `) {
    if (G.ledY == null) { led = null; return; }
    const H = 11;
    const t = document.createElement('canvas');
    const g = t.getContext('2d');
    g.font = k.font(H, 700, '"DejaVu Sans Mono", Menlo, monospace');
    const W = Math.ceil(g.measureText(text).width) + 2;
    const pitch = Math.max(2.4, (G.ledH - 4) / (H + 3));
    const d = Math.min(fx.dpr, 32000 / (W * pitch)); // stay under the canvas size limit
    const w = Math.min(G.sw - 40, G.bw);
    if (led && led.text === text && led.pitch === pitch && led.dpr === d) return Object.assign(led, { x: G.sx + (G.sw - w) / 2, y: G.ledY, w }); // same words: keep scrolling
    t.width = W; t.height = H + 3;
    g.font = k.font(H, 700, '"DejaVu Sans Mono", Menlo, monospace');
    g.textBaseline = 'top';
    g.fillStyle = '#fff';
    g.fillText(text, 0, 1);
    const px = g.getImageData(0, 0, W, H + 3).data;
    // One lit dot with its glow, pre-drawn at each eighth of a device pixel and stamped on every lit
    // pixel at whole-pixel positions, so it matches drawing each dot with its own shadowBlur.
    const blur = pitch * 1.4, rd = pitch * 0.38 * d; // shadowBlur is in device pixels
    const half = Math.ceil(rd + blur * 1.5 + 1), Q = 8;
    const dots = [];
    const dot = (qx, qy) => {
      const j = qy * Q + qx;
      if (dots[j]) return dots[j];
      const e = dots[j] = document.createElement('canvas');
      e.width = e.height = half * 2 + 1;
      const dg = e.getContext('2d');
      Object.assign(dg, { fillStyle: '#ffb02e', shadowColor: 'rgba(255,150,30,.9)', shadowBlur: blur });
      dg.beginPath();
      dg.arc(half + qx / Q, half + qy / Q, rd, 0, 7);
      dg.fill();
      return e;
    };
    const s = document.createElement('canvas');
    s.width = Math.ceil(W * pitch * d);
    s.height = Math.ceil((H + 3) * pitch * d);
    const sg = s.getContext('2d');
    for (let y = 0; y < H + 3; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 110) {
      const X = Math.round((x * pitch + pitch / 2) * d * Q), Y = Math.round((y * pitch + pitch / 2) * d * Q);
      sg.drawImage(dot(X % Q, Y % Q), Math.floor(X / Q) - half, Math.floor(Y / Q) - half);
    }
    const off = led && led.text === text ? led.off : k.reduced ? 0 : -w / pitch * 0.25;
    led = { sprite: s, text, cols: W, pitch, x: G.sx + (G.sw - w) / 2, y: G.ledY, w, h: (H + 3) * pitch + 6, off, dpr: d };
  }

  // ── drawing ────────────────────────────────────────────────────────────

  function drawCell(cell) {
    const { cw, ch } = G;
    const { x, y } = cell;
    if (y > cv.h || y + ch < 0) return;
    c.fillStyle = HOUSING;
    c.fillRect(x - 1, y - 1, cw + 2, ch + 3);
    const a = sprite(cell.cur, cell.col);
    if (!cell.seq || cell.wait > 0) { c.drawImage(a, x, y, cw, ch); return; }
    const b = sprite(cell.seq[0], cell.seq.length === 1 ? cell.tcol : cell.col);
    const sw = a.width, half = a.height / 2; // source rects in the sprites' own pixels
    const p = cell.p;
    c.drawImage(b, 0, 0, sw, half, x, y, cw, ch / 2); // next char's top half, behind the falling flap
    c.drawImage(a, 0, half, sw, half, x, y + ch / 2, cw, ch / 2); // current char's bottom half
    const s = Math.cos(p * Math.PI);
    if (s > 0) { // the old top half falls towards you
      const fh = (ch / 2) * s;
      c.drawImage(a, 0, 0, sw, half, x, y + ch / 2 - fh, cw, fh);
      c.fillStyle = `rgba(0,0,0,${(1 - s) * 0.5})`;
      c.fillRect(x, y + ch / 2 - fh, cw, fh);
    } else { // and lands as the new bottom half
      const fh = (ch / 2) * -s;
      c.drawImage(b, 0, half, sw, half, x, y + ch / 2, cw, fh);
      c.fillStyle = `rgba(255,255,255,${(1 + s) * 0.12})`;
      c.fillRect(x, y + ch / 2, cw, fh);
      c.fillStyle = `rgba(0,0,0,${0.35 * (1 + s)})`;
      c.fillRect(x, y + ch / 2 + fh, cw, Math.min(3, ch / 2 - fh));
    }
  }

  function planeIcon(g, x, y, s, color) {
    g.save();
    g.translate(x, y);
    g.scale(s / 24, s / 24);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(21, 15.5); g.lineTo(21, 13.5); g.lineTo(13.5, 9); g.lineTo(13.5, 3.5);
    g.quadraticCurveTo(12, 1, 10.5, 3.5); g.lineTo(10.5, 9); g.lineTo(3, 13.5); g.lineTo(3, 15.5);
    g.lineTo(10.5, 13.2); g.lineTo(10.5, 18.5); g.lineTo(8.5, 20); g.lineTo(8.5, 21.5); g.lineTo(12, 20.5);
    g.lineTo(15.5, 21.5); g.lineTo(15.5, 20); g.lineTo(13.5, 18.5); g.lineTo(13.5, 13.2); g.closePath();
    g.fill();
    g.restore();
  }

  function redrawAll() {
    if (!G) return;
    c.fillStyle = HOUSING;
    c.fillRect(0, 0, cv.w, cv.h);
    // the board's frame, so it reads as a sign hanging in a terminal
    const fx0 = G.x0 - 16, fw = G.bw + 32;
    const g = c.createLinearGradient(0, 0, cv.w, 0);
    g.addColorStop(0, '#16161a'); g.addColorStop(0.5, '#1d1d22'); g.addColorStop(1, '#16161a');
    c.fillStyle = g;
    c.fillRect(0, 0, cv.w, cv.h);
    c.fillStyle = HOUSING;
    c.fillRect(fx0, 0, fw, cv.h);
    c.fillStyle = 'rgba(255,255,255,.05)';
    c.fillRect(fx0 - 2, 0, 2, cv.h);
    c.fillRect(fx0 + fw, 0, 2, cv.h);
    // header: pictogram, title, languages, clock
    const { headY, headH, cw } = G;
    const ic = Math.round(cw * 2.1);
    const iy = headY;
    c.fillStyle = '#ffcb3d';
    c.beginPath(); c.roundRect(G.x0, iy, ic, ic, 4); c.fill();
    planeIcon(c, G.x0 + ic * 0.12, iy + ic * 0.12, ic * 0.76, '#111');
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#f3efe2';
    const tx = G.x0 + ic + 12;
    const room = G.bw - ic - 12 - 5 * G.P - 16;
    const base = iy + ic * 0.5 + cw * 0.5;
    k.fit(c, 'Departures', room, { size: Math.round(cw * 1.5), min: 12, weight: 700 });
    c.fillText('Departures', tx, base);
    const tw = c.measureText('Departures').width + 12;
    c.fillStyle = '#8d8b86';
    c.font = k.font(Math.round(cw * 0.8), 500);
    const sub = k.ellipsize(c, `Départs · Abflüge · Decisions ${ctx.front === 'done' ? 'landed' : ctx.question ? 'pending' : 'delayed'}`, room - tw);
    if (sub.length > 8) c.fillText(sub, tx + tw, base);
    // column titles
    c.font = k.font(Math.max(9, Math.round(cw * 0.6)), 700);
    c.fillStyle = '#7d7a73';
    const names = { time: 'TIME', flight: 'FLIGHT', dest: 'DESTINATION', gate: 'GATE', rem: 'REMARKS' };
    G.cols.forEach(({ key, x }) => c.fillText(names[key], x, G.y0 - 7));
    // rows outside the column block are blank flaps; the board carries on behind the panels
    for (const [, row] of rows) for (const cell of row.cells) drawCell(cell);
    if (clock) clock.forEach(drawCell);
    // LED sign housing
    if (led) {
      c.fillStyle = '#050505';
      c.beginPath(); c.roundRect(led.x - 8, led.y - 5, led.w + 16, led.h + 4, 5); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.06)';
      c.stroke();
      c.fillStyle = 'rgba(255,140,30,.07)';
      for (let x = led.x; x < led.x + led.w; x += led.pitch) for (let y = led.y; y < led.y + led.h - 6; y += led.pitch) c.fillRect(x + led.pitch * 0.3, y + led.pitch * 0.3, led.pitch * 0.4, led.pitch * 0.4);
    }
  }

  function relayout(delay) {
    G = geometry();
    sprites.clear();
    fill(delay);
  }

  cv.resized = (w, h, { dprOnly } = {}) => { // on a DPR change the flaps keep flipping where they were
    if (!dprOnly) return relayout(0);
    sprites.clear();
    redrawAll();
  };
  fx.resized = () => { if (led && led.dpr !== fx.dpr) buildLed(led.text); };
  relayout(0.3);

  k.loop((dt, t) => {
    let flips = 0;
    const tick = (cell) => {
      if (!cell.seq) return;
      if (cell.wait > 0) { cell.wait -= dt; return; }
      cell.p += dt / STEP;
      if (cell.p >= 1) {
        cell.cur = cell.seq.shift();
        if (!cell.seq.length) { cell.seq = null; cell.col = cell.tcol; }
        cell.p = 0;
        flips++;
      }
      drawCell(cell);
    };
    for (const row of rows.values()) row.cells.forEach(tick);
    clock?.forEach(tick);
    if (flips && k.sfx.on && t - clackAt > 0.035) {
      clackAt = t;
      k.sfx.clack({ gain: Math.min(0.5, 0.08 + flips * 0.01), pitch: k.rand(0.8, 1.25), pan: k.rand(-0.4, 0.4) });
    }
    if (clock && !k.reduced && Math.floor(t) !== Math.floor(t - dt)) {
      const now = hhmm(new Date());
      [...now].forEach((ch, i) => aim(clock[i], ch, 'white'));
    }

    f.clearRect(0, 0, fx.w, fx.h);
    // status lamps at the end of each flight row
    const blink = k.reduced || Math.sin(t * 6) > -0.2;
    for (const [i, row] of rows) {
      if (!row.lamp || !row.cells.length) continue;
      const last = row.cells[row.cells.length - 1];
      const x = G.x0 + G.bw + 9, y = last.y + G.ch / 2;
      f.fillStyle = blink ? COL[row.lamp] : '#2a2a2a';
      f.shadowColor = COL[row.lamp];
      f.shadowBlur = blink ? 10 : 0;
      f.beginPath(); f.arc(x, y, 3.2, 0, 7); f.fill();
      f.shadowBlur = 0;
      if (i === 0 && row.lamp !== 'grey' && blink && !k.reduced) { // a soft glow on the boarding row
        f.fillStyle = `${COL[row.lamp]}0d`;
        f.fillRect(G.x0 - 6, last.y - 4, G.bw + 12, G.ch + 8);
      }
    }
    // the clock's colon blinks
    if (clock && !k.reduced && Math.floor(t * 2) % 2) {
      const cl = clock[2];
      f.fillStyle = '#242428';
      f.fillRect(cl.x + G.cw * 0.3, cl.y + G.ch * 0.22, G.cw * 0.4, G.ch * 0.56);
      f.fillStyle = '#050506';
      f.fillRect(cl.x + G.cw * 0.3, cl.y + G.ch / 2 - 0.6, G.cw * 0.4, 1.2);
    }
    // LED announcements, one dot column at a time
    if (led) {
      if (!k.reduced) led.off += dt * 22;
      if (led.off > led.cols) led.off -= led.cols;
      const col = Math.floor(led.off);
      const visible = Math.ceil(led.w / led.pitch);
      f.save();
      f.beginPath(); f.rect(led.x, led.y - 4, led.w, led.h); f.clip();
      for (let start = col; start < col + visible; ) {
        const sc = ((start % led.cols) + led.cols) % led.cols;
        const n = Math.min(led.cols - sc, col + visible - start);
        const dx = led.x + (start - col) * led.pitch;
        if (start < 0) { start = 0; continue; }
        f.drawImage(led.sprite, sc * led.pitch * led.dpr, 0, n * led.pitch * led.dpr, led.sprite.height, dx, led.y, n * led.pitch, led.sprite.height / led.dpr);
        start += n;
      }
      f.restore();
    }
    // wheels up
    if (plane) {
      plane.t += dt;
      const p = plane.t / 2.6;
      if (p >= 1) plane = null;
      else {
        const x = k.lerp(G.sx - 60, G.sx + G.sw + 60, p);
        const y = plane.y - p * p * plane.climb;
        f.save();
        f.translate(x, y);
        f.rotate(Math.PI / 2 - 0.25 - p * 0.3);
        f.globalAlpha = 0.9;
        planeIcon(f, -18, -18, 36, '#f3efe2');
        f.restore();
        for (let i = 1; i < 14; i++) { // contrail
          const q = Math.max(0, p - i * 0.012);
          f.fillStyle = `rgba(255,255,255,${0.16 * (1 - i / 14)})`;
          f.beginPath(); f.arc(k.lerp(G.sx - 60, G.sx + G.sw + 60, q) - 14, plane.y - q * q * plane.climb + 6, 2 + i * 0.4, 0, 7); f.fill();
        }
      }
    }
  }, { still: 0.1 });

  // the "ding-dong" before every airport announcement
  const dingDong = () => [[659.3, 0], [523.3, 0.42]].forEach(([freq, delay]) => {
    k.sfx.tone({ freq, dur: 1.1, gain: 0.08, delay });
    k.sfx.tone({ freq: freq * 2, dur: 0.6, gain: 0.02, delay });
  });

  let lastStage = '';
  const stage = () => `${ctx.front}:${ctx.question?.id}:${answered ? 1 : 0}:${ctx.cardTime > 120 ? 2 : ctx.cardTime > 45 ? 1 : 0}:${ctx.agent}`;
  k.every(1000, () => { // boarding turns into final call while you think
    const s = stage();
    if (s === lastStage) return;
    lastStage = s;
    fill(0);
  });

  return {
    question() {
      answered = null;
      lastStage = stage();
      relayout(0);
      dingDong();
    },
    layout() {
      const prev = G && `${G.y0}:${G.x0}:${G.bw}:${G.room}:${G.ledY}`;
      G = geometry();
      if (prev === `${G.y0}:${G.x0}:${G.bw}:${G.room}:${G.ledY}`) return;
      sprites.clear();
      fill(0);
    },
    status() { if (!ctx.question) fill(0); },
    decisions() { if (ctx.front === 'done') fill(0); },
    answer(a) {
      answered = a;
      fill(0);
      if (!k.reduced) {
        const sp = k.space();
        const top = sp.gaps.find((g) => g.where === 'top');
        plane = { t: 0, y: top ? top.y + top.h * 0.75 : G.headY + 30, climb: top ? top.h * 0.6 : 60 };
      }
      k.sfx.whoosh({ pitch: 0.6, gain: 0.5 });
    },
  };
}
