// Mission control. A green-screen flight director's loop: every option gets polled GO or NO GO by a
// controller, a countdown restarts with each question (and holds at zero while you think), and
// answering is a launch.

const GREEN = '#3dff8f';
const DIM = 'rgba(61,255,143,.38)';
const AMBER = '#ffb21e';
const RED = '#ff4135';
const CRT = '#021009';
const DESKS = ['RETRO', 'FIDO', 'GUIDO', 'EECOM', 'GNC', 'TELMU', 'INCO', 'CONTROL'];
const STATIONS = [[0.2, 0.36, 'GOLDSTONE'], [0.47, 0.33, 'MADRID'], [0.84, 0.7, 'CANBERRA'], [0.3, 0.62, 'LOCALHOST'], [0.62, 0.5, 'STAGING']];
// very rough continents, in map units (x 0..1, y 0..1)
const LAND = [
  [[0.05, 0.22], [0.14, 0.15], [0.27, 0.14], [0.33, 0.2], [0.29, 0.3], [0.25, 0.37], [0.22, 0.45], [0.19, 0.43], [0.14, 0.36], [0.08, 0.3]],
  [[0.24, 0.5], [0.3, 0.5], [0.35, 0.58], [0.33, 0.7], [0.29, 0.82], [0.27, 0.82], [0.26, 0.68], [0.23, 0.58]],
  [[0.45, 0.2], [0.53, 0.16], [0.56, 0.24], [0.52, 0.3], [0.47, 0.3]],
  [[0.45, 0.36], [0.53, 0.34], [0.6, 0.42], [0.58, 0.55], [0.54, 0.68], [0.5, 0.68], [0.48, 0.52], [0.44, 0.45]],
  [[0.55, 0.14], [0.7, 0.1], [0.88, 0.14], [0.93, 0.22], [0.86, 0.3], [0.8, 0.4], [0.74, 0.44], [0.68, 0.38], [0.6, 0.34], [0.56, 0.26]],
  [[0.8, 0.62], [0.88, 0.6], [0.92, 0.68], [0.88, 0.75], [0.81, 0.72]],
];

export default function missionControl(k, ctx) {
  const base = k.canvas({ alpha: false });
  const cv = k.canvas();
  const c = cv.ctx;
  k.el('div', { style: 'position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 1px, transparent 1px 3px),radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, rgba(0,0,0,.65))' });

  let G = null;
  let lines = []; // the loop transcript: { who, text, status, start, rec }
  let typedAt = 0; // scene time the poll started
  let now = 0;
  let keys = 0;
  let launch = null; // { t, tookRec }
  let answered = null;
  let lastBeep = -1;
  const born = performance.now();

  const fmt = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, Math.floor(s % 60)].map((n) => String(n).padStart(2, '0')).join(':');
  const up = (s) => k.plain(s || '').toUpperCase();
  const tMinus = () => 60 - ctx.cardTime;

  // ── the loop ─────────────────────────────────────────────────────────

  function poll() {
    const q = ctx.question;
    const L = [];
    if (ctx.front === 'done') {
      L.push({ who: 'FLIGHT', text: 'FINAL POLL. ALL DECISIONS.', head: true });
      const ds = ctx.decisions.length ? ctx.decisions : ctx.answers.map((a, i) => ({ n: i + 1, text: a.picks[0] || a.custom || a.title }));
      ds.forEach((d, i) => L.push({ who: `D${d.n ?? i + 1}`, text: up(d.text), status: 'GO' }));
      L.push({ who: 'CAPCOM', text: 'SPLASHDOWN CONFIRMED. NICE FLYING, DEVELOPER.', chat: true });
      L.push({ who: 'FLIGHT', text: 'THE AGENT HAS THE CONN. MISSION COMPLETE.', chat: true });
      return L;
    }
    if (!q) {
      const listening = ctx.agent === 'listening';
      L.push({ who: 'FLIGHT', text: 'ALL STATIONS, STAND BY.', head: true });
      ['RETRO', 'FIDO', 'GUIDO'].forEach((who) => L.push({ who, text: 'AWAITING FIRST QUESTION', status: 'STBY' }));
      L.push({ who: 'CAPCOM', text: listening ? 'THE AGENT IS LISTENING. GO AHEAD, DEVELOPER.' : 'AGENT IS READING THE PLAN. HOLDING.', chat: true });
      L.push({ who: 'EECOM', text: 'COFFEE PRESSURE NOMINAL.', chat: true });
      return L;
    }
    L.push({ who: 'FLIGHT', text: `GO/NO-GO FOR Q${q.n}: ${up(q.title)}`, head: true });
    if (!q.options.length) {
      L.push({ who: 'RETRO', text: 'WRITE-IN TRAJECTORY', status: 'STBY' });
      L.push({ who: 'CAPCOM', text: 'DEVELOPER, WE NEED YOUR WORDS. IN YOUR OWN TIME.', chat: true });
      return L;
    }
    const recs = q.recommended.length;
    q.options.forEach((o, i) => L.push({ who: DESKS[i % DESKS.length], text: up(o.label), status: answered ? (answered.picks.includes(o.label) ? 'GO' : 'SCRUB') : !recs ? 'STBY' : o.recommended ? 'GO' : 'NO GO', rec: o.recommended }));
    const rec = q.options.find((o) => o.recommended);
    L.push({ who: 'FLIGHT', text: rec ? `WE ARE GO FOR ${up(rec.label)}${recs > 1 ? ` +${recs - 1}` : ''}.` : 'NO CONSENSUS. DEVELOPER HAS THE CALL.', chat: true });
    L.push({ who: 'CAPCOM', text: q.multi ? 'DEVELOPER, YOU ARE GO FOR MULTIPLE ANSWERS.' : 'DEVELOPER, YOU ARE GO FOR ANSWER.', chat: true, live: true });
    return L;
  }

  // CAPCOM's last word changes as the clock runs
  function chatter() {
    const q = ctx.question;
    if (!q || ctx.front !== 'question') return null;
    if (answered) return answered.tookRec ? 'WE HAVE LIFTOFF. THE TOWER IS CLEAR.' : answered.picks.length ? 'TRAJECTORY UNEXPECTED. FLIGHT SAYS WE WILL ALLOW IT.' : 'COPY. DEVELOPER IS IMPROVISING.';
    const t = tMinus();
    if (t > 10) return null;
    if (t > 0) return `T-MINUS ${Math.ceil(t)}…`;
    if (ctx.typing) return 'DEVELOPER IS TYPING. HOLD, HOLD, HOLD.';
    if (t > -60) return 'HOLDING AT T-ZERO. DEVELOPER STILL DECIDING.';
    if (t > -180) return ['SURGEON REPORTS DEVELOPER HEART RATE ELEVATED.', 'HOLDING. SOMEBODY GET THE DEVELOPER A SANDWICH.'][Math.floor(-t / 30) % 2];
    return 'HOLDING. THIS IS NOW THE LONGEST HOLD IN PROGRAM HISTORY.';
  }

  function restart() {
    lines = poll();
    typedAt = now + 0.3;
    let t = typedAt;
    for (const l of lines) { l.start = t; t += Math.min(0.8, 0.15 + (l.who.length + l.text.length) / 110); }
  }

  // ── layout ───────────────────────────────────────────────────────────

  function layout() {
    const sp = k.space();
    const st = sp.stage;
    const bottom = sp.gaps.find((g) => g.where === 'bottom' || g.where === 'all');
    const top = sp.gaps.find((g) => g.where === 'top');
    let clockTop = top && top.h >= 54 ? { x: st.x, y: top.y, w: st.width, h: top.h } : null;
    let panel = null;
    if (bottom && bottom.h >= 84) {
      const m = st.width < 700 ? 14 : 22;
      let y = bottom.y + 4, h = bottom.h - 18;
      if (!clockTop && h >= 220) { // the big clock goes above the loop instead
        clockTop = { x: st.x, y: bottom.y, w: st.width, h: 64 };
        y += 64; h -= 64;
      }
      const want = (poll().length + 1) * 20 + 30;
      const ph = Math.min(h, Math.max(150, want), 230);
      panel = { x: st.x + m, y: y + Math.max(0, (h - ph) / 2), w: st.width - m * 2, h: ph };
    }
    let tele = null;
    if (panel && panel.w >= 640 && panel.h >= 150) {
      tele = { x: panel.x + panel.w - 210, y: panel.y, w: 210, h: panel.h };
      panel = { ...panel, w: panel.w - 222 };
    }
    G = { st, clockTop, panel, tele, vw: sp.vw, vh: sp.vh };
    drawBase();
  }

  function drawBase() {
    const b = base.ctx;
    const W = base.w, H = base.h;
    b.fillStyle = '#010604';
    b.fillRect(0, 0, W, H);
    // the big wall map
    const mx = W * 0.02, my = H * 0.04, mw = W * 0.96, mh = H * 0.86;
    b.strokeStyle = 'rgba(61,255,143,.08)';
    b.lineWidth = 1;
    for (let i = 0; i <= 12; i++) { const x = mx + (mw * i) / 12; b.beginPath(); b.moveTo(x, my); b.lineTo(x, my + mh); b.stroke(); }
    for (let i = 0; i <= 6; i++) { const y = my + (mh * i) / 6; b.beginPath(); b.moveTo(mx, y); b.lineTo(mx + mw, y); b.stroke(); }
    b.fillStyle = 'rgba(61,255,143,.045)';
    b.strokeStyle = 'rgba(61,255,143,.16)';
    for (const poly of LAND) {
      b.beginPath();
      poly.forEach(([x, y], i) => (i ? b.lineTo(mx + x * mw, my + y * mh) : b.moveTo(mx + x * mw, my + y * mh)));
      b.closePath();
      b.fill();
      b.stroke();
    }
    b.font = k.font(10, 600, 'mono');
    for (const [x, y, name] of STATIONS) {
      b.fillStyle = 'rgba(255,178,30,.55)';
      b.fillRect(mx + x * mw - 2, my + y * mh - 2, 4, 4);
      b.fillText(name, mx + x * mw + 6, my + y * mh + 3);
    }
    G && Object.assign(G, { map: { mx, my, mw, mh } });
  }
  base.resized = () => { drawBase(); };

  // ── drawing helpers ──────────────────────────────────────────────────

  function glowText(text, x, y, color, blur = 6) {
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = blur;
    c.fillText(text, x, y);
    c.shadowBlur = 0;
  }

  function countdown(cx, cy, h) {
    const q = ctx.question;
    let digits = '--:--:--', label = 'HOLD', color = AMBER, blink = false;
    if (launch) { digits = fmt(launch.t); label = 'LIFTOFF'; color = GREEN; }
    else if (ctx.front === 'done') { digits = fmt((performance.now() - born) / 1000); label = 'SPLASHDOWN'; color = GREEN; }
    else if (q) {
      const t = tMinus();
      digits = fmt(Math.max(0, Math.ceil(t)));
      if (t <= 0) { label = 'HOLDING'; color = RED; blink = true; } else label = t <= 10 ? 'FINAL COUNT' : 'COUNTING';
    } else blink = true;
    const prefix = launch || ctx.front === 'done' ? 'T+' : 'T−';
    c.textBaseline = 'middle';
    c.font = k.font(Math.round(h * 1.1), 700, 'mono');
    const dw = c.measureText(digits).width;
    c.font = k.font(Math.round(h * 0.6), 800, 'mono');
    const pw = c.measureText(prefix).width + h * 0.2;
    const x = cx - (pw + dw) / 2;
    glowText(prefix, x, cy + h * 0.05, color, 10);
    c.font = k.font(Math.round(h * 1.1), 700, 'mono');
    c.fillStyle = 'rgba(255,140,40,.08)'; // the unlit segments behind the digits
    c.fillText(digits.replace(/[0-9-]/g, '8'), x + pw, cy);
    glowText(digits, x + pw, cy, color, 14);
    if (!blink || k.reduced || Math.floor(now * 2) % 2 === 0) {
      c.font = k.font(Math.max(10, Math.round(h * 0.26)), 800, 'mono');
      const lw = c.measureText(label).width;
      glowText(label, cx - lw / 2, cy + h * 0.5 + Math.max(8, h * 0.22), color, 6);
    }
  }

  function panelFrame(r, title) {
    c.fillStyle = '#121714';
    c.beginPath(); c.roundRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 10); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.06)';
    c.stroke();
    const g = c.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 10, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.7);
    g.addColorStop(0, '#04210f');
    g.addColorStop(1, CRT);
    c.fillStyle = g;
    c.beginPath(); c.roundRect(r.x, r.y, r.w, r.h, 7); c.fill();
    c.font = k.font(9, 800);
    c.fillStyle = 'rgba(200,220,210,.45)';
    c.fillText(title, r.x + 4, r.y - 1 + 0);
  }

  function drawLoop() {
    const r = G.panel;
    if (!r) return;
    panelFrame(r, '');
    const lh = r.h < 140 ? 17 : 20;
    const fs = lh < 20 ? 12 : 13;
    const pad = 14;
    const cap = Math.floor((r.h - pad * 1.4) / lh);
    let L = lines;
    const extra = chatter();
    if (extra) L = [...L.filter((l) => !l.live), { who: 'CAPCOM', text: extra, chat: true, start: -1, hot: true }];
    if (L.length > cap) { // keep the header, the ★ calls and the latest chatter
      const keep = new Set([L[0], ...L.filter((l) => l.rec), L[L.length - 1]]);
      let room = cap - keep.size;
      L = L.filter((l) => keep.has(l) || room-- > 0).slice(0, cap);
    }
    c.textBaseline = 'middle';
    c.save();
    c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    let clockW = 0;
    if (!G.clockTop) { // no room above the card: a small countdown in the corner of the loop
      const q = ctx.question, t = tMinus();
      const txt = launch ? 'LIFTOFF' : ctx.front === 'done' ? 'SPLASHDOWN' : !q ? 'T−HOLD' : t > 0 ? `T−${fmt(Math.ceil(t))}` : 'T−0 HOLDING';
      c.font = k.font(fs, 800, 'mono');
      clockW = c.measureText(txt).width + 16;
      const hold = q && t <= 0 && !launch;
      if (!hold || k.reduced || Math.floor(now * 2) % 2 === 0) glowText(txt, r.x + r.w - pad - clockW + 16, r.y + pad + lh / 2 - 4, hold ? RED : AMBER, 8);
    }
    c.font = k.font(fs, 600, 'mono');
    const cw = c.measureText('M').width;
    const whoW = cw * 8;
    L.forEach((l, i) => {
      const y = r.y + pad + i * lh + lh / 2 - 4;
      const age = l.start < 0 ? 99 : now - l.start;
      if (age < 0) return;
      const statusW = l.status ? cw * 7 + 10 : 0;
      const room = Math.floor((r.w - pad * 2 - whoW - statusW - cw) / cw);
      const full = l.head ? k.clip(l.text, Math.floor((r.w - pad * 2 - clockW) / cw) - l.who.length - 2) : k.clip(l.text, Math.max(4, room));
      const n = k.reduced ? 999 : Math.floor(age * 90);
      const color = l.head ? AMBER : l.hot ? (tMinus() <= 0 && !answered ? RED : GREEN) : l.chat ? GREEN : l.rec ? GREEN : DIM.replace('.38', '.75');
      const who = l.head ? `${l.who}:` : l.who;
      glowText(who.slice(0, n), r.x + pad, y, l.head ? AMBER : DIM, 4);
      const body = full.slice(0, Math.max(0, n - who.length));
      const bx = r.x + pad + (l.head ? (who.length + 1) * cw : whoW);
      glowText(body, bx, y, color, l.rec || l.hot ? 7 : 4);
      const done = n >= who.length + full.length;
      if (!done) { // the cursor
        c.fillStyle = GREEN;
        c.fillRect(bx + c.measureText(body).width + 1, y - fs * 0.5, cw * 0.7, fs);
        return;
      }
      if (l.status) {
        const sx = r.x + r.w - pad - statusW + 10;
        c.fillStyle = DIM.replace('.38', '.3');
        const lead = Math.max(0, Math.floor((sx - bx - c.measureText(full).width - 8) / cw));
        c.fillText('.'.repeat(lead), bx + c.measureText(full).width + 4, y);
        const col = l.status === 'GO' ? GREEN : l.status === 'STBY' ? AMBER : RED;
        const lit = k.reduced || now - l.start > (who.length + full.length) / 90 + 0.2;
        c.fillStyle = lit ? col : 'rgba(255,255,255,.06)';
        c.shadowColor = col;
        c.shadowBlur = lit ? 12 : 0;
        c.beginPath(); c.roundRect(sx, y - lh * 0.4, statusW - 10, lh * 0.8, 3); c.fill();
        c.shadowBlur = 0;
        c.fillStyle = '#021006';
        c.font = k.font(fs - 2, 900, 'mono');
        const tw = c.measureText(l.status).width;
        c.fillText(l.status, sx + (statusW - 10 - tw) / 2, y + 0.5);
        c.font = k.font(fs, 600, 'mono');
        if (!l.clunk) { l.clunk = true; k.sfx.blip({ pitch: l.status === 'GO' ? 1 : 0.6, gain: 0.5 }); }
      }
    });
    c.restore();
  }

  function drawTele() {
    const r = G.tele;
    if (!r) return;
    panelFrame(r, '');
    const q = ctx.question;
    const s = ctx.stats || {};
    const rows = [
      ['CARD TIME', q ? fmt(ctx.cardTime) : '--:--:--', q ? Math.min(1, ctx.cardTime / 120) : 0],
      ['KEYSTROKES', String(keys).padStart(4, '0'), Math.min(1, keys / 200)],
      ['★ TAKEN', ctx.recRate == null ? '---' : `${Math.round(ctx.recRate * 100)}%`, ctx.recRate ?? 0],
      ['PROGRESS', `${ctx.progress?.answered ?? 0}/${ctx.progress?.total ?? 0}`, ctx.progress?.ratio ?? 0],
      ['STREAK', String(s.streak || 0), Math.min(1, (s.streak || 0) / 5)],
      ['AGENT', up(ctx.agent || 'offline'), ctx.agent === 'working' ? 0.5 + Math.sin(now * 3) * 0.3 : ctx.agent === 'listening' ? 1 : 0.1],
    ];
    if (r.h < 180) rows.splice(4, 1); // no room for the streak
    const lh = Math.min(30, (r.h - 20) / rows.length);
    c.textBaseline = 'middle';
    rows.forEach(([label, val, p], i) => {
      const y = r.y + 12 + i * lh + lh / 2;
      c.font = k.font(9, 700, 'mono');
      glowText(label, r.x + 12, y - 5, DIM, 3);
      c.font = k.font(13, 700, 'mono');
      const w = c.measureText(val).width;
      glowText(val, r.x + r.w - 12 - w, y - 1, label === 'CARD TIME' && tMinus() <= 0 && q && !answered ? RED : GREEN, 6);
      c.fillStyle = 'rgba(61,255,143,.1)';
      c.fillRect(r.x + 12, y + 6, r.w - 24 - w - 10, 3);
      c.fillStyle = GREEN;
      c.fillRect(r.x + 12, y + 6, (r.w - 24 - w - 10) * k.clamp(p), 3);
    });
  }

  function drawTrack() { // the spacecraft goes round the wall map
    const m = G.map;
    if (!m) return;
    const speed = 0.012 * (1 + (ctx.progress?.ratio || 0) * 2);
    const head = (now * speed) % 1;
    c.lineWidth = 1.5;
    for (let orbit = 0; orbit < 3; orbit++) {
      c.strokeStyle = orbit ? 'rgba(61,255,143,.16)' : 'rgba(61,255,143,.45)';
      c.beginPath();
      for (let i = 0; i <= 120; i++) {
        const u = i / 120;
        if (!orbit && u > head) break;
        const x = m.mx + u * m.mw, y = m.my + m.mh * (0.5 - 0.3 * Math.sin((u + orbit * 0.17) * Math.PI * 2 * 1.3));
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
    const x = m.mx + head * m.mw, y = m.my + m.mh * (0.5 - 0.3 * Math.sin(head * Math.PI * 2 * 1.3));
    const blink = k.reduced || Math.sin(now * 8) > 0;
    c.fillStyle = blink ? AMBER : GREEN;
    c.shadowColor = AMBER;
    c.shadowBlur = 12;
    c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 6, y); c.lineTo(x, y + 6); c.lineTo(x - 6, y); c.closePath(); c.fill();
    c.shadowBlur = 0;
    c.font = k.font(10, 700, 'mono');
    c.fillStyle = 'rgba(255,178,30,.8)';
    c.fillText(ctx.question ? `GRILL-${ctx.question.n}` : 'GRILL-0', x + 10, y - 8);
  }

  function drawLaunch(dt) {
    if (!launch) return;
    launch.t += dt;
    const r = G.panel || G.st;
    const t = launch.t;
    const x = r.x + r.w * 0.5;
    const ground = r.y + r.h + 10;
    const rise = t < 0.25 ? 0 : (t - 0.25) ** 2 * 420;
    const y = ground - rise;
    // smoke
    for (const p of launch.smoke) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 26; p.a -= dt * 0.35;
      if (p.a <= 0) continue;
      c.fillStyle = `rgba(210,225,215,${p.a})`;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill();
    }
    if (t < 2.4 && launch.smoke.length < 160) for (let i = 0; i < 4; i++) launch.smoke.push({ x: x + k.rand(-6, 6), y: y + 10, vx: k.rand(-160, 160), vy: k.rand(-20, 30) + (rise > 30 ? 60 : 0), r: k.rand(5, 10), a: 0.5 });
    if (y < -80) return;
    c.save();
    c.translate(x, y);
    // flame
    const fl = 30 + Math.random() * 14;
    const fg = c.createLinearGradient(0, 0, 0, fl);
    fg.addColorStop(0, '#fffbe0'); fg.addColorStop(0.35, '#ffb21e'); fg.addColorStop(1, 'rgba(255,65,53,0)');
    c.fillStyle = fg;
    c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(0, fl * 1.4, 6, 0); c.closePath(); c.fill();
    // the stack: white with black roll bands, a nose and fins
    c.fillStyle = '#eef2ef';
    c.fillRect(-7, -64, 14, 64);
    c.fillStyle = '#111';
    c.fillRect(-7, -14, 14, 4); c.fillRect(-7, -40, 14, 3); c.fillRect(-7, -64, 7, 10);
    c.fillStyle = '#eef2ef';
    c.beginPath(); c.moveTo(-5, -64); c.lineTo(0, -84); c.lineTo(5, -64); c.closePath(); c.fill();
    c.fillStyle = '#d33';
    c.fillRect(-1, -92, 2, 9);
    c.fillStyle = '#9aa';
    c.beginPath(); c.moveTo(-7, -10); c.lineTo(-13, 2); c.lineTo(-7, 0); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(7, -10); c.lineTo(13, 2); c.lineTo(7, 0); c.closePath(); c.fill();
    c.restore();
  }

  layout();
  restart();

  k.loop((dt) => {
    now += dt;
    c.clearRect(0, 0, cv.w, cv.h);
    drawTrack();
    if (G.clockTop) countdown(G.clockTop.x + G.clockTop.w / 2, G.clockTop.y + G.clockTop.h / 2 - 7, Math.min(34, G.clockTop.h * 0.45));
    drawLoop();
    drawTele();
    drawLaunch(dt);
    // the last ten seconds beep
    const t = tMinus();
    if (ctx.front === 'question' && !answered && t > 0 && t <= 10 && Math.ceil(t) !== lastBeep) {
      lastBeep = Math.ceil(t);
      k.sfx.tone({ type: 'square', freq: 1000, dur: 0.07, gain: 0.025 });
    }
  }, { still: 4 });

  return {
    question() {
      answered = null;
      launch = null;
      lastBeep = -1;
      layout();
      restart();
      k.sfx.tone({ type: 'sine', freq: 1400, to: 1100, dur: 0.18, gain: 0.04 }); // the loop's "quindar" tone
    },
    layout,
    status() { if (!ctx.question) restart(); },
    decisions() { if (ctx.front === 'done') restart(); },
    keystroke() { keys++; },
    answer(a) {
      answered = a;
      lines = poll().map((l) => ({ ...l, start: -1, clunk: true }));
      if (!k.reduced) launch = { t: 0, smoke: [] };
      k.sfx.noise({ dur: 1.6, color: 'pink', filter: 'lowpass', freq: 300, to: 900, gain: 0.35, attack: 0.15 });
      k.sfx.thud({ gain: 0.6, pitch: 0.7 });
    },
  };
}
