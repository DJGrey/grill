// Sports broadcast. Night match, floodlights, a pitch-side LED scoreboard with the live score
// (RECOMMENDED vs YOUR GUT), a commentator on the marquee and a crowd that does the wave.

// 5x7 LED font, ASCII 32..95, five column bytes per glyph (bit 0 is the top row)
const FONT = '0000000000 00005f0000 0007000700 147f147f14 242a7f2a12 2313086462 3649552250 0005030000 001c224100 0041221c00 082a1c2a08 08083e0808 0050300000 0808080808 0060600000 2010080402 3e5149453e 00427f4000 4261514946 2141454b31 1814127f10 2745454539 3c4a494930 0171090503 3649494936 064949291e 0036360000 0056360000 0008142241 1414141414 4122140800 0201510906 324979413e 7e1111117e 7f49494936 3e41414122 7f4141221c 7f49494941 7f09090101 3e41415132 7f0808087f 00417f4100 2040413f01 7f08142241 7f40404040 7f0204027f 7f0408107f 3e4141413e 7f09090906 3e4151215e 7f09192946 4649494931 01017f0101 3f4040403f 1f2040201f 7f2018207f 6314081463 0304780403 6151494543 00007f4141 0204081020 41417f0000 0402010204 4040404040'
  .split(' ').map((h) => [0, 2, 4, 6, 8].map((i) => parseInt(h.slice(i, i + 2), 16)));
const STAR = [0x48, 0x38, 0x1e, 0x38, 0x48];
const glyphOf = (ch) => (ch === '★' ? STAR : FONT[ch.toUpperCase().charCodeAt(0) - 32] || FONT[0]);
const COLS = 184, ROWS = 46;
const C = { rec: '#ffc22e', gut: '#ff4a3d', mid: '#5ff1ff', text: '#fff1b8', dim: '#7a6a3a', white: '#ffffff', green: '#5dff7a' };
const SKIN = ['#f1c7a1', '#e0a77e', '#c68863', '#9a6142', '#6e4530', '#f6d5b8', '#b97a55'];
const HAIR = ['#2b1d14', '#5a3a1e', '#111', '#c9a15a', '#8b3a1a', '#d8d2c8', '#3b2a20'];
const SIGNS = ['HI MUM', '★ OR BUST', 'PICK 1', 'GUT FEELINGS FC', 'SHIP IT', 'IS IT DNS?', 'TRUST THE ★', 'WE ❤ ADRs', 'BORING IS GOOD', 'PIVOT!'];

export default function sports(k, ctx) {
  const bg = k.canvas({ alpha: false });
  const cv = k.canvas();
  const b = bg.ctx, c = cv.ctx;
  const led = document.createElement('canvas');
  led.width = COLS; led.height = ROWS;
  const g = led.getContext('2d');
  // the LED glow is blurred at 2x LED resolution and scaled up: same soft bloom, a fraction of the pixels
  const GS = 2, GM = 4; // glow px per LED, LED margin for the blur to spread into
  const glow = document.createElement('canvas');
  glow.width = (COLS + GM * 2) * GS; glow.height = (ROWS + GM * 2) * GS;
  const gg = glow.getContext('2d');
  let mask = null; // scoreboard dot mask, sized to the board
  let built = ''; // size the stadium was last painted at
  let SB = null; // scoreboard rect + pitch { x, y, w, h, p }
  let bug = null; // the TV score bug in the top gap
  let fans = [];
  let flashes = [];
  let wave = null; // { x, speed, n }
  let jump = 0;
  let nextWave = 14;
  let marq = { text: '', x: 0, w: 0 };
  let shown = null; // { rec, gut } on the board, lags the real score during a goal
  let goal = null; // { t, who, var }
  let time = 0;
  let lines = [];

  // ── score and commentary ───────────────────────────────────────────────────

  const score = () => {
    const a = ctx.answers || [];
    return { rec: a.filter((x) => x.tookRec).length, gut: a.filter((x) => !x.tookRec).length };
  };
  const mins = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const hes = () => k.pick(["HE'S", "SHE'S", "THEY'RE"]);

  function commentary() {
    const q = ctx.question;
    const st = ctx.stats || {};
    const s = score();
    if (ctx.front === 'done') {
      return [`FULL TIME. RECOMMENDED ${s.rec}, YOUR GUT ${s.gut}.`, `${ctx.decisions.length} DECISION${ctx.decisions.length === 1 ? '' : 'S'} ON THE BOARD. WHAT A GRILL.`, s.rec > s.gut ? 'THE STAR WINS IT. THE GUT WILL BE BACK NEXT SEASON.' : s.gut > s.rec ? 'THE GUT WINS IT! THE RECOMMENDATION IS IN TEARS.' : 'HONOURS EVEN. NOBODY IS HAPPY.', 'THE PLAYERS ARE SWAPPING SHIRTS WITH THE AGENT.'];
    }
    if (!q) {
      return ctx.agent === 'listening'
        ? ['THE AGENT IS LISTENING. SAY SOMETHING NICE.', 'BOTH TEAMS WAITING ON A NOTE FROM THE DUGOUT.']
        : ['PRE-MATCH. THE AGENT IS IN THE TUNNEL WRITING QUESTIONS.', 'KICK-OFF SHORTLY. GET YOUR PIES.', 'THE GROUNDSKEEPER IS MARKDOWN-FORMATTING THE PITCH.'];
    }
    const out = [`QUESTION ${q.n} OF ${q.total}: ${k.clip(q.title, 70).toUpperCase()}`];
    if (q.revising) out.push('BACK TO AN OLD QUESTION. VAR IS INVOLVED.');
    if (q.tag) out.push(`THE ${q.tag.toUpperCase()} ROUND. THIS IS WHERE LEGENDS ARE MADE.`);
    if (!q.options.length) out.push('NO OPTIONS ON THE PITCH. YOU WILL HAVE TO WRITE ONE YOURSELF. BRAVE.');
    else if (q.recommended.length) out.push(`${q.options.length} OPTIONS OUT THERE. ONE OF THEM HAS A STAR ON ITS SHIRT.`);
    else out.push(`${q.options.length} OPTIONS AND NO STAR. ANYONE'S GAME.`);
    if (q.multi) out.push('MULTI-SELECT. YOU CAN PICK MORE THAN ONE. THE RULES ARE UNCLEAR.');
    if (ctx.cardTime > 90) out.push(`${Math.floor(ctx.cardTime / 60)} MINUTE${ctx.cardTime >= 120 ? 'S' : ''} ON THIS ONE. THE CROWD IS GETTING RESTLESS.`);
    if (ctx.recRate !== null && ctx.answers.length >= 2) out.push(`TAKES THE STAR ${Math.round(ctx.recRate * 100)}% OF THE TIME. A CREATURE OF HABIT.`);
    if (st.streak >= 3) out.push(`${st.streak} RECOMMENDATIONS IN A ROW. UNSTOPPABLE.`);
    const who = hes();
    out.push(k.pick([`${who} LOOKING AT THE STAR... ${who} LOOKING AT IT...`, 'YOU COULD NOT SCRIPT THIS.', 'A GAME OF TWO HALVES. AND A TABLE.', 'HI MUM!', 'THE GAFFER WILL BE DELIGHTED.', 'VAR IS CHECKING THE DECISION LOG.']));
    return out;
  }

  function nextLine() {
    if (!lines.length) lines = commentary();
    const text = ctx.typing ? 'HE IS TYPING... HE IS TYPING!' : lines.shift();
    marq = { text, x: COLS, w: text.length * 6 };
  }

  // ── the LED board ──────────────────────────────────────────────────────────

  function text(str, x, y, color, sc = 1) {
    g.fillStyle = color;
    let cx = x;
    for (const ch of str) {
      const cols = glyphOf(ch);
      for (let i = 0; i < 5; i++) for (let r = 0; r < 7; r++) if (cols[i] >> r & 1) g.fillRect(cx + i * sc, y + r * sc, sc, sc);
      cx += 6 * sc;
    }
  }
  const tw = (str, sc = 1) => str.length * 6 * sc - sc;
  const centre = (str, cx, y, color, sc = 1) => text(str, Math.round(cx - tw(str, sc) / 2), y, color, sc);

  function board(dt, t) {
    g.clearRect(0, 0, COLS, ROWS);
    const s = shown || score();
    const q = ctx.question;
    const gt = goal ? t - goal.t : 99;
    if (goal && gt < 2.2) {
      // GOAL!!! full board, flashing, with chasing borders
      const on = Math.floor(gt * 8) % 2 === 0;
      const word = goal.var ? 'VAR' : 'GOAL!';
      const col = goal.who === 'rec' ? C.rec : C.gut;
      if (on || k.reduced) centre(word, COLS / 2, 4, col, 4);
      centre(goal.var ? 'DECISION CHANGED' : goal.who === 'rec' ? 'RECOMMENDED SCORES' : 'THE GUT SCORES!', COLS / 2, 36, on ? C.white : col);
      for (let x = 0; x < COLS; x += 4) {
        const lit = (x / 4 + Math.floor(gt * 20)) % 3 === 0;
        if (lit) { g.fillStyle = col; g.fillRect(x, 0, 2, 1); g.fillRect(COLS - 1 - x, ROWS - 1, 2, 1); }
      }
      return;
    }
    centre('RECOMMENDED', 46, 2, C.rec);
    centre('YOUR GUT', 138, 2, C.gut);
    const flash = goal && gt < 4.2 && Math.floor(gt * 6) % 2 === 0;
    if (!(flash && goal.who === 'rec')) centre(String(s.rec), 46, 12, C.rec, 3);
    if (!(flash && goal.who === 'gut')) centre(String(s.gut), 138, 12, C.gut, 3);
    centre(ctx.front === 'done' ? 'FT' : !q ? 'PRE' : `Q${q.n}/${q.total}`, 92, 11, C.mid, 2);
    centre(ctx.front === 'question' ? mins(ctx.cardTime || 0) : ctx.front === 'done' ? `${ctx.decisions.length} DECISION${ctx.decisions.length === 1 ? '' : 'S'}` : 'KICK-OFF', 92, 28, C.text);
    g.fillStyle = '#3a3320';
    g.fillRect(2, 37, COLS - 4, 1);
    // the commentator
    if (k.reduced) {
      const line = marq.text.length * 6 > COLS - 4 ? `${marq.text.slice(0, Math.floor((COLS - 10) / 6))}…` : marq.text;
      text(line.replace('…', '.'), 2, 39, C.text);
      return;
    }
    marq.x -= dt * 38;
    if (marq.x < -marq.w) nextLine();
    g.save();
    g.beginPath();
    g.rect(0, 38, COLS, 8);
    g.clip();
    text(marq.text, Math.round(marq.x), 39, ctx.typing ? C.green : C.text);
    g.restore();
  }

  function drawBoard(t) {
    if (!SB) return;
    const { x, y, w, h, p } = SB;
    // legs, truss and the casing
    c.save();
    c.fillStyle = '#20252c';
    for (const lx of [x + w * 0.22, x + w * 0.78]) {
      c.fillRect(lx - 7, y + h, 14, cv.h - y - h);
      c.fillStyle = '#2d343d';
      c.fillRect(lx - 7, y + h, 4, cv.h - y - h);
      c.fillStyle = '#20252c';
    }
    c.strokeStyle = '#2b323b';
    c.lineWidth = 3;
    for (let yy = y + h + 18; yy < cv.h; yy += 34) {
      c.beginPath();
      c.moveTo(x + w * 0.22, yy); c.lineTo(x + w * 0.78, yy + 17);
      c.moveTo(x + w * 0.78, yy); c.lineTo(x + w * 0.22, yy + 17);
      c.stroke();
    }
    c.shadowColor = 'rgba(0,0,0,.6)';
    c.shadowBlur = 30;
    c.shadowOffsetY = 10;
    c.fillStyle = '#111418';
    c.beginPath();
    c.roundRect(x - 12, y - 24, w + 24, h + 36, 8);
    c.fill();
    c.shadowColor = 'transparent';
    const rim = c.createLinearGradient(0, y - 24, 0, y + h + 12);
    rim.addColorStop(0, '#3b434d');
    rim.addColorStop(0.08, '#1b1f25');
    rim.addColorStop(1, '#0c0e11');
    c.strokeStyle = rim;
    c.lineWidth = 2;
    c.stroke();
    // sponsor strip
    c.font = k.font(Math.max(9, Math.min(13, p * 3)), 800, 'sans');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#c8ced6';
    c.letterSpacing = '2px';
    c.fillText('GRILL SPORTS NETWORK  ·  PROUDLY SPONSORED BY ★ RECOMMENDATIONS INC', x + w / 2, y - 12);
    c.letterSpacing = '0px';
    c.restore();
    // the LEDs: dim unlit dots, lit blocks punched into dots by the mask, then a soft glow
    c.drawImage(mask.off, x, y, w, h);
    c.imageSmoothingEnabled = false;
    c.drawImage(led, x, y, w, h);
    c.imageSmoothingEnabled = true;
    c.drawImage(mask.on, x, y, w, h);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.55;
    gg.clearRect(0, 0, glow.width, glow.height);
    gg.filter = `blur(${Math.max(2 / p, 1.2) * GS}px)`;
    gg.imageSmoothingEnabled = false;
    gg.drawImage(led, GM * GS, GM * GS, COLS * GS, ROWS * GS);
    gg.filter = 'none';
    c.drawImage(glow, x - GM * p, y - GM * p, w + GM * p * 2, h + GM * p * 2);
    c.globalAlpha = 0.12; // screen sheen
    const sh = c.createLinearGradient(x, y, x + w * 0.6, y + h);
    sh.addColorStop(0, 'rgba(255,255,255,.6)');
    sh.addColorStop(0.4, 'rgba(255,255,255,0)');
    c.fillStyle = sh;
    c.fillRect(x, y, w, h);
    c.restore();
  }

  function makeMask(w, h, p) {
    const mk = (fill) => {
      const m = document.createElement('canvas');
      m.width = Math.ceil(w * bg.dpr); m.height = Math.ceil(h * bg.dpr);
      const x = m.getContext('2d');
      x.scale(bg.dpr, bg.dpr);
      if (fill) {
        x.fillStyle = '#07080a';
        x.fillRect(0, 0, w, h);
        x.globalCompositeOperation = 'destination-out';
      } else x.fillStyle = 'rgba(255,255,255,.06)';
      x.beginPath();
      for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) { x.moveTo((q + 0.5) * p + p * 0.38, (r + 0.5) * p); x.arc((q + 0.5) * p, (r + 0.5) * p, p * 0.38, 0, Math.PI * 2); }
      x.fill();
      if (!fill) { x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#07080a'; x.fillRect(0, 0, w, h); }
      return m;
    };
    return { on: mk(true), off: mk(false), p };
  }

  // ── the stadium ────────────────────────────────────────────────────────────

  function layout() {
    const sp = k.space();
    const W = bg.w, H = bg.h;
    const top = sp.gaps.find((gp) => gp.where === 'top' && gp.h >= 28);
    bug = top ? { x: top.x + 18, y: top.y + Math.min(top.h / 2 + 2, 30) } : null;
    const gap = sp.gaps.find((gp) => gp.where !== 'top' && gp.w >= 300 && gp.h >= 110);
    const crowdH = k.clamp((gap?.where === 'bottom' ? gap.h : H * 0.3) * 0.3, 56, 120);
    SB = null;
    if (gap) {
      const bottom = gap.where === 'bottom' || gap.where === 'all' ? Math.min(gap.y + gap.h, H - crowdH - 22) : gap.y + gap.h - 20;
      const availH = bottom - gap.y - 34;
      const p = Math.min((gap.w - 60) / COLS, availH / ROWS, 5.2);
      if (p >= 1.6) {
        const w = COLS * p, h = ROWS * p;
        SB = { x: Math.round(gap.x + (gap.w - w) / 2), y: Math.round(gap.y + 30 + (availH - h) * 0.35), w, h, p };
        if (!mask || mask.p !== p) mask = makeMask(w, h, p);
      }
    }
    crowd(W, H, crowdH);
    if (built !== `${W}x${H}`) { built = `${W}x${H}`; stadium(W, H); } // scrolling moves the card, not the stadium
  }

  function stadium(W, H) {
    const r = k.rng('stadium');
    const sky = b.createLinearGradient(0, 0, 0, H * 0.5);
    sky.addColorStop(0, '#02040c');
    sky.addColorStop(1, '#0d1a33');
    b.fillStyle = sky;
    b.fillRect(0, 0, W, H);
    // roof and floodlight gantry
    const roofY = H * 0.11;
    b.fillStyle = '#0a0e16';
    b.beginPath();
    b.moveTo(0, roofY + 30); b.quadraticCurveTo(W / 2, roofY - 24, W, roofY + 30); b.lineTo(W, 0); b.lineTo(0, 0);
    b.fill();
    // far stands: tiers of tiny fans
    const s0 = roofY + 26, s1 = H * 0.6;
    for (let i = 0; i < 4; i++) {
      const y0 = k.lerp(s0, s1, i / 4), y1 = k.lerp(s0, s1, (i + 1) / 4);
      const tier = b.createLinearGradient(0, y0, 0, y1);
      tier.addColorStop(0, '#0d1220');
      tier.addColorStop(1, '#161d2e');
      b.fillStyle = tier;
      b.fillRect(0, y0, W, y1 - y0);
      b.fillStyle = 'rgba(255,255,255,.05)';
      b.fillRect(0, y1 - 3, W, 2);
    }
    const cols = ['#c8a03a', '#b33b33', '#d7d7d7', '#3a5a9a', '#b5853a', '#7a2a2a'];
    for (let i = 0; i < W * (s1 - s0) / 70; i++) {
      const y = r.rand(s0 + 4, s1 - 4);
      const d = (y - s0) / (s1 - s0);
      b.globalAlpha = 0.25 + d * 0.4;
      b.fillStyle = r.pick(cols);
      const sz = 1.4 + d * 2;
      b.fillRect(r.rand(0, W), y, sz, sz * 1.3);
    }
    b.globalAlpha = 1;
    // the pitch
    const pY = s1;
    const turf = b.createLinearGradient(0, pY, 0, H);
    turf.addColorStop(0, '#1d5e2a');
    turf.addColorStop(1, '#2f8a3c');
    b.fillStyle = turf;
    b.fillRect(0, pY, W, H - pY);
    for (let i = 0; i < 14; i++) { // mowing stripes in perspective
      if (i % 2) continue;
      const a = (i / 14) * W, bb = ((i + 1) / 14) * W;
      b.fillStyle = 'rgba(255,255,255,.045)';
      b.beginPath();
      b.moveTo(W / 2 + (a - W / 2) * 0.6, pY); b.lineTo(W / 2 + (bb - W / 2) * 0.6, pY);
      b.lineTo(W / 2 + (bb - W / 2) * 1.6, H); b.lineTo(W / 2 + (a - W / 2) * 1.6, H);
      b.fill();
    }
    b.strokeStyle = 'rgba(255,255,255,.55)';
    b.lineWidth = 2;
    b.beginPath(); b.moveTo(0, pY + 14); b.lineTo(W, pY + 14); b.stroke();
    // ad boards along the touchline
    b.fillStyle = '#08090c';
    b.fillRect(0, pY - 16, W, 16);
    b.font = k.font(10, 800, 'sans');
    b.textBaseline = 'middle';
    const ads = ['★ RECOMMENDATIONS INC', 'GUT FEELINGS LTD', 'GRILL-O-ADE', 'ARCHITECTURE DECISION RECORDS', 'BIG TABLE ENERGY'];
    for (let x = 6, i = 0; x < W; i++) {
      const t = ads[i % ads.length];
      b.fillStyle = ['#ffc22e', '#ff4a3d', '#5ff1ff', '#ffffff', '#5dff7a'][i % 5];
      b.fillText(t, x, pY - 8);
      x += b.measureText(t).width + 40;
    }
    // light haze from the floodlights
    for (const lx of [W * 0.1, W * 0.5, W * 0.9]) {
      const hz = b.createRadialGradient(lx, roofY, 0, lx, roofY, H * 0.7);
      hz.addColorStop(0, 'rgba(200,220,255,.18)');
      hz.addColorStop(1, 'rgba(200,220,255,0)');
      b.fillStyle = hz;
      b.fillRect(0, 0, W, H);
    }
    // the lamps
    for (let i = 0; i < 9; i++) {
      const lx = (i + 0.5) * (W / 9);
      const ly = roofY + 20 - Math.sin((i + 0.5) / 9 * Math.PI) * 26;
      b.fillStyle = '#1a2130';
      b.fillRect(lx - 34, ly - 12, 68, 22);
      for (let j = 0; j < 6; j++) for (let kk = 0; kk < 2; kk++) {
        const gx = lx - 26 + j * 10.5, gy = ly - 6 + kk * 10;
        const glow = b.createRadialGradient(gx, gy, 0, gx, gy, 9);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.35, 'rgba(230,240,255,.8)');
        glow.addColorStop(1, 'rgba(200,220,255,0)');
        b.fillStyle = glow;
        b.fillRect(gx - 9, gy - 9, 18, 18);
      }
    }
  }

  function crowd(W, H, crowdH) {
    const r = k.rng(`crowd${Math.round(W)}`);
    fans = [];
    const signed = [];
    const rows = [
      { y: H - crowdH * 0.62, s: 0.8, gap: 30 },
      { y: H - crowdH * 0.3, s: 1, gap: 38 },
      { y: H + 4, s: 1.28, gap: 50 },
    ];
    rows.forEach((row, ri) => {
      for (let x = r.rand(-20, 0); x < W + 30; x += row.gap * r.rand(0.85, 1.15)) {
        const rec = r.chance(0.68);
        fans.push({
          x, y: row.y + r.rand(-3, 3), s: row.s * r.rand(0.9, 1.1), row: ri,
          shirt: rec ? r.pick(['#f2b318', '#ffc93c', '#e0a10e']) : r.pick(['#d93a2f', '#b8261d', '#f05a48']),
          skin: r.pick(SKIN), hair: r.pick(HAIR), ph: r.rand(0, 6), bob: r.rand(1.5, 3.2),
          hat: r.chance(0.25) ? r.pick(['beanie', 'cap']) : null, rec,
          sign: ri > 0 && r.chance(0.16) && signed.every((sx) => Math.abs(sx - x) > 130) && !(SB && x > SB.x - 40 && x < SB.x + SB.w + 40) ? (signed.push(x), r.pick(SIGNS)) : null,
          finger: ri > 0 && r.chance(0.06), jumpPh: r.rand(0, 6), bounce: 0,
        });
      }
    });
  }

  function drawFan(f, t) {
    const s = f.s;
    const wv = wave ? Math.exp(-(((f.x - wave.x) / 110) ** 2)) : 0;
    const jumpy = jump > 0 ? Math.max(0, Math.sin(t * 11 + f.jumpPh)) * jump : 0;
    const lift = wv * 26 * s + jumpy * 14 * s + f.bounce * 10 * s + (k.reduced ? 0 : Math.sin(t * f.bob + f.ph) * 1.2 * s);
    f.bounce = Math.max(0, f.bounce - 0.06);
    const x = f.x, y = f.y - lift;
    const arms = Math.max(wv, jumpy * 0.9, f.finger ? 0.35 : 0, f.sign ? 0.8 : 0);
    // arms first, so they come from behind the shoulders
    if (arms > 0.12) {
      for (const side of [-1, 1]) {
        if (f.finger && side === -1 && arms < 0.6) continue;
        const a = side * k.lerp(2.2, 0.32 + Math.sin(t * 9 + f.ph + side) * 0.08 * wv, arms);
        const sx = x + side * 12 * s, sy = y - 26 * s;
        const len = 30 * s;
        const hx = sx + Math.sin(a) * len, hy = sy - Math.cos(a) * len;
        c.strokeStyle = f.shirt;
        c.lineWidth = 8 * s;
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
        if (f.finger && side === 1) foam(hx, hy, s, a);
        else { c.fillStyle = f.skin; c.beginPath(); c.arc(hx, hy, 4.4 * s, 0, Math.PI * 2); c.fill(); }
      }
    }
    if (f.sign) sign(f, x, y - 74 * s - arms * 6 * s, s, t);
    // body, neck and head
    c.fillStyle = f.shirt;
    c.beginPath();
    c.roundRect(x - 18 * s, y - 30 * s, 36 * s, 60 * s, [14 * s, 14 * s, 0, 0]);
    c.fill();
    c.fillStyle = 'rgba(0,0,0,.18)';
    c.fillRect(x - 18 * s, y - 6 * s, 36 * s, 36 * s);
    if (f.rec && f.row === 2) { c.fillStyle = 'rgba(255,255,255,.85)'; c.font = k.font(11 * s, 900, 'sans'); c.textAlign = 'center'; c.fillText('★', x, y - 10 * s); }
    c.fillStyle = f.skin;
    c.fillRect(x - 4 * s, y - 36 * s, 8 * s, 8 * s);
    c.beginPath();
    c.arc(x, y - 44 * s, 11 * s, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = f.hair;
    if (f.hat === 'beanie') {
      c.fillStyle = f.rec ? '#f2b318' : '#d93a2f';
      c.beginPath(); c.arc(x, y - 46 * s, 11.5 * s, Math.PI, 0); c.fill();
      c.fillStyle = '#fff';
      c.fillRect(x - 11.5 * s, y - 48 * s, 23 * s, 4 * s);
      c.beginPath(); c.arc(x, y - 58 * s, 3.6 * s, 0, Math.PI * 2); c.fill();
    } else if (f.hat === 'cap') {
      c.fillStyle = '#20242c';
      c.beginPath(); c.arc(x, y - 46 * s, 11.3 * s, Math.PI, 0); c.fill();
      c.fillRect(x - 3 * s, y - 49 * s, 16 * s, 3.5 * s);
    } else {
      c.beginPath(); c.arc(x, y - 46 * s, 11.2 * s, Math.PI * 1.02, Math.PI * 1.98); c.fill();
    }
  }

  function foam(x, y, s, a) {
    c.save();
    c.translate(x, y);
    c.rotate(a * 0.4);
    c.fillStyle = '#ffc22e';
    c.strokeStyle = '#b37c00';
    c.lineWidth = 1.5 * s;
    c.beginPath();
    c.roundRect(-9 * s, -12 * s, 18 * s, 20 * s, 5 * s);
    c.roundRect(-3.5 * s, -36 * s, 8 * s, 28 * s, 4 * s);
    c.fill();
    c.stroke();
    c.fillStyle = '#7a4a00';
    c.font = k.font(8 * s, 900, 'sans');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('#1', 0, -1 * s);
    c.restore();
  }

  function sign(f, x, y, s, t) {
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin(t * 1.6 + f.ph) * 0.06);
    c.font = k.font(11 * s, 700, 'hand');
    const w = Math.max(54 * s, c.measureText(f.sign).width + 14 * s), h = 24 * s;
    c.fillStyle = '#6b5032';
    c.fillRect(-w / 2 + 6 * s, 0, 3 * s, 34 * s);
    c.fillRect(w / 2 - 9 * s, 0, 3 * s, 34 * s);
    c.fillStyle = '#fbf7ea';
    c.shadowColor = 'rgba(0,0,0,.35)';
    c.shadowBlur = 4;
    c.fillRect(-w / 2, -h / 2, w, h);
    c.shadowColor = 'transparent';
    c.fillStyle = f.rec ? '#1d3fbf' : '#c2261b';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(f.sign, 0, 1);
    c.restore();
  }

  function drawBug(t) {
    if (!bug) return;
    const s = shown || score();
    const q = ctx.question;
    c.save();
    c.font = k.font(12, 800, 'sans');
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    let x = bug.x;
    const y = bug.y;
    const pill = (txt, bgc, fg, padX = 9, dot) => {
      const w = c.measureText(txt).width + padX * 2 + (dot ? 12 : 0);
      c.fillStyle = bgc;
      c.beginPath(); c.roundRect(x, y - 12, w, 24, 4); c.fill();
      if (dot) { c.fillStyle = Math.floor(t * 1.4) % 2 || k.reduced ? '#fff' : 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(x + padX + 3, y, 3.5, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = fg;
      c.fillText(txt, x + padX + (dot ? 12 : 0), y + 0.5);
      x += w;
    };
    c.shadowColor = 'rgba(0,0,0,.5)';
    c.shadowBlur = 12;
    const gt = goal ? t - goal.t : 99;
    if (gt < 3.2) { // the GOAL sting slides over the bug
      const e = k.ease.outBack(k.clamp(gt / 0.35)) * k.clamp((3.2 - gt) / 0.25);
      const label = goal.var ? 'VAR · DECISION CHANGED' : goal.who === 'rec' ? 'GOAL! ★ RECOMMENDED SCORES' : 'GOAL! YOUR GUT SCORES';
      c.font = k.font(15, 900, 'sans');
      const w = c.measureText(label).width + 28;
      c.globalAlpha = k.clamp(e);
      c.translate(x + w / 2, y);
      c.scale(0.6 + 0.4 * e, 0.6 + 0.4 * e);
      c.fillStyle = goal.who === 'rec' ? '#ffc22e' : '#ff4a3d';
      c.beginPath(); c.roundRect(-w / 2, -16, w, 32, 5); c.fill();
      c.fillStyle = goal.who === 'rec' ? '#1a1200' : '#fff';
      c.textAlign = 'center';
      c.fillText(label, 0, 1);
      c.restore();
      return;
    }
    pill('LIVE', '#d3201b', '#fff', 8, true);
    c.shadowBlur = 0;
    pill('GSN', '#0e1320', '#ffc22e');
    pill(`REC ${s.rec}`, '#f4f4f4', '#141414');
    pill(`${s.gut} GUT`, '#e7e7e7', '#141414');
    pill(ctx.front === 'question' ? `Q${q.n}  ${mins(ctx.cardTime || 0)}` : ctx.front === 'done' ? 'FULL TIME' : 'PRE-MATCH', '#0e1320', '#fff');
    c.restore();
  }

  // ── loop ───────────────────────────────────────────────────────────────────

  function startWave(n = 1) {
    wave = { x: -150, speed: Math.max(700, bg.w * 0.55), n };
    if (k.sfx.on) k.sfx.noise({ dur: 1.8, color: 'pink', filter: 'bandpass', freq: 700, q: 0.9, gain: 0.09, attack: 0.5 });
  }

  function draw(dt, t) {
    time = t;
    c.clearRect(0, 0, cv.w, cv.h);
    if (!k.reduced) {
      if (wave) {
        wave.x += wave.speed * dt;
        if (wave.x > bg.w + 200) wave = wave.n > 1 ? { ...wave, x: -150, n: wave.n - 1 } : null;
      } else if (t > nextWave) {
        startWave();
        const done = ctx.front === 'done';
        nextWave = t + (done ? k.rand(7, 11) : k.rand(22, 34));
        if (done) jump = 0.7;
        else lines.unshift('THE CROWD IS DOING THE WAVE. THEY ARE BORED.');
      }
      jump = Math.max(0, jump - dt * 0.45);
      // camera flashes in the far stands
      if (Math.random() < dt * (3 + jump * 30)) flashes.push({ x: k.rand(0, cv.w), y: k.rand(cv.h * 0.15, cv.h * 0.58), age: 0 });
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.age += dt;
      if (f.age > 0.14) { flashes.splice(i, 1); continue; }
      const a = 1 - f.age / 0.14;
      const gr = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 14);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr;
      c.fillRect(f.x - 14, f.y - 14, 28, 28);
    }
    c.restore();
    if (goal && t - goal.t > 4.4) { goal = null; shown = null; }
    board(dt, t);
    drawBoard(t);
    for (const f of fans) drawFan(f, t);
    drawBug(t);
  }

  function still() {
    wave = { x: bg.w * 0.42, speed: 0, n: 1 };
    marq.text = ctx.front === 'done' ? 'FULL TIME. WHAT A GRILL.' : !ctx.question ? 'KICK-OFF SHORTLY. GET PIES.' : 'THE CROWD IS DOING THE WAVE.';
  }

  bg.resized = (w, h, { dprOnly } = {}) => {
    if (!dprOnly) { built = ''; return layout(); } // a resize cleared the canvas
    if (SB) mask = makeMask(SB.w, SB.h, SB.p);
    stadium(bg.w, bg.h);
  };
  layout();
  nextLine();
  if (k.reduced) still();
  // The card can settle after a hook (entry animations don't fire resize events): follow it.
  let cardSig = '';
  const settle = () => { const r = k.rect(k.ui.card()); const sg = r ? [r.left, r.top, r.width, r.height].map(Math.round).join() : ''; if (sg === cardSig) return; cardSig = sg; layout(); if (k.reduced) { still(); loop.redraw(); } };
  k.every(700, settle);
  const loop = k.loop(draw, { still: 0 });

  return {
    question() {
      layout();
      k.after(450, layout);
      lines = [];
      if (!goal && !k.reduced) nextLine();
      if (k.reduced) still();
    },
    layout,
    status() { lines = []; if (k.reduced) still(); },
    answer(a) {
      const who = a.tookRec ? 'rec' : 'gut';
      const was = score();
      // ctx.answers may already include this answer: keep the board one goal behind until it flashes up
      if (!a.revision && ctx.answers.some((x) => x.id === a.id)) was[who] = Math.max(0, was[who] - 1);
      shown = was;
      goal = { t: k.reduced ? time - 1 : time, who, var: a.revision }; // a still holds the GOAL frame, then settles
      k.after(2200, () => {
        if (!a.revision) shown = { ...was, [who]: Math.max(was[who] + 1, score()[who]) };
        if (k.reduced) { goal = null; shown = null; loop.redraw(); }
      });
      if (k.reduced) return;
      startWave(2);
      jump = 1;
      for (const f of fans) f.bounce = k.rand(0, 0.6);
      lines = [a.revision ? 'VAR HAS OVERTURNED THE DECISION. SCENES.' : who === 'rec' ? 'GOAL! THE RECOMMENDATION FINDS THE NET! TEXTBOOK!' : 'THE GUT SCORES! NOBODY SAW THAT COMING!'];
      nextLine();
      marq.x = COLS * 0.6;
      k.sfx.cheer({ gain: 0.7 });
      k.sfx.tone({ type: 'square', freq: 880, dur: 0.35, gain: 0.05, filter: 'lowpass', freqF: 2000 });
      const col = who === 'rec' ? ['#ffc22e', '#ffffff', '#ffe28a'] : ['#ff4a3d', '#ffffff', '#ffb0a8'];
      k.burst(bg.w * 0.2, bg.h, { n: 50, colors: col, angle: -Math.PI / 2 + 0.3, spread: 0.7, speed: 900, gravity: 500, life: 2.2 });
      k.burst(bg.w * 0.8, bg.h, { n: 50, colors: col, angle: -Math.PI / 2 - 0.3, spread: 0.7, speed: 900, gravity: 500, life: 2.2 });
    },
    typing(on) {
      if (on && !goal && !k.reduced) { marq.text = 'HE IS TYPING... HE IS TYPING!'; marq.w = marq.text.length * 6; marq.x = Math.min(marq.x, COLS); }
    },
    keystroke() {
      const f = fans[k.int(0, fans.length - 1)];
      if (f && !k.reduced) f.bounce = 1;
    },
  };
}
