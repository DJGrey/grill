// Matrix rain. Every few seconds the columns line up to spell this question's options in the
// empty space under the card, hold, then melt back into the rain.

const KANA = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
const LATIN = 'ABCDEFHKMNTXZ';
const DIGITS = '0123456789:.=*+<>¦';
const CW = 14; // column width in CSS px
const CH = 18; // row height
const PAD = 7; // glow room around each glyph sprite
const STYLE = { // fill, glow, blur
  lock: ['#86ffad', 'rgba(60,255,130,.9)', 8],
  rec: ['#f4fff7', 'rgba(140,255,180,1)', 14],
  flash: ['#ffffff', 'rgba(210,255,225,1)', 18],
};

export default function matrix(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  const glyphs = [...(k.canRender('ｱ', 'mono') ? KANA : LATIN) + DIGITS];
  k.el('div', { style: 'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 90% 80% at 50% 45%, transparent 45%, rgba(0,0,0,.6)),repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 1px, transparent 1px 3px)' });

  let cols, rows, glyph, bright, drops, atlas;
  const sprites = new Map();
  let words = []; // letters spelled out by the rain: { ch, col, row, rec, lock, glitch, melt }
  let phase = 'rain';
  let phaseT = 0;
  let nextAt = 1.6;
  let surge = 0;
  let term = null; // the "Wake up…" line: { x, y, lines, i, chars, hold }

  // Each rain glyph, mirrored like the film, pre-drawn twice: trail green and a white-hot head.
  function buildAtlas() {
    const sz = CH + PAD * 2;
    const a = document.createElement('canvas');
    a.width = Math.ceil(sz * cv.dpr) * glyphs.length;
    a.height = Math.ceil(sz * cv.dpr) * 2;
    const g = a.getContext('2d');
    g.scale(cv.dpr, cv.dpr);
    g.font = k.font(14, 500, 'mono');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const step = Math.ceil(sz * cv.dpr) / cv.dpr;
    glyphs.forEach((ch, i) => [['#1fdc66', 'rgba(30,220,100,.55)', 5], ['#e9fff0', 'rgba(130,255,175,.95)', 12]].forEach(([fill, glow, blur], row) => {
      g.save();
      g.translate(i * step + sz / 2, row * step + sz / 2 + 1);
      g.scale(-1, 1);
      Object.assign(g, { fillStyle: fill, shadowColor: glow, shadowBlur: blur });
      g.fillText(ch, 0, 0);
      g.restore();
    }));
    return { a, s: Math.ceil(sz * cv.dpr), sz };
  }

  function sprite(ch, kind) {
    const key = kind + ch;
    if (!sprites.has(key)) {
      const sz = CH + PAD * 2;
      const s = document.createElement('canvas');
      s.width = s.height = Math.ceil(sz * cv.dpr);
      const g = s.getContext('2d');
      g.scale(cv.dpr, cv.dpr);
      const [fill, glow, blur] = STYLE[kind];
      Object.assign(g, { font: k.font(16, 700, 'mono'), textAlign: 'center', textBaseline: 'middle', fillStyle: fill, shadowColor: glow, shadowBlur: blur });
      g.fillText(ch, sz / 2, sz / 2 + 1);
      sprites.set(key, s);
    }
    return sprites.get(key);
  }

  function spawn(d, anywhere) {
    d.depth = k.rand(0.4, 1); // far columns are dimmer and slower
    d.speed = k.lerp(5, 19, d.depth) * k.rand(0.85, 1.15);
    d.decay = d.speed / k.rand(9, 26); // brightness lost per second, so trails are 9-26 cells long
    d.y = anywhere ? k.rand(-rows, rows) : -k.rand(1, rows * 0.6);
    d.row = Math.floor(d.y);
    return d;
  }

  function grid() {
    cols = Math.ceil(cv.w / CW);
    rows = Math.ceil(cv.h / CH) + 1;
    glyph = Uint8Array.from({ length: cols * rows }, () => k.int(0, glyphs.length - 1));
    bright = new Float32Array(cols * rows);
    drops = Array.from({ length: cols }, () => spawn({}, true));
    atlas = buildAtlas();
    sprites.clear();
    placeTerm();
    if (k.reduced) { settle(); layout(); }
  }

  // Reduced motion: the rain as it would be after a few seconds of falling, worked out directly
  // (each trail fades behind its head) instead of simulating every frame.
  function settle(secs = 3) {
    drops.forEach((d, x) => {
      d.y += d.speed * secs;
      if (d.y - d.speed / d.decay > rows) return spawn(d);
      d.row = Math.floor(d.y);
      for (let j = 0; ; j++) {
        const b = 1 - (j * d.decay) / d.speed, y = d.row - j;
        if (b <= 0 || y < 0 || j > d.speed * secs) break; // a trail only reaches back to where it started
        if (y < rows) bright[y * cols + x] = b;
      }
    });
  }

  // What the rain spells, by state of the grill.
  function lines() {
    const q = ctx.question;
    if (ctx.front === 'done') { const n = ctx.decisions.length || ctx.answers.length; return [{ text: 'YOU ARE THE ONE' }, { text: `${n} DECISION${n === 1 ? '' : 'S'}. ZERO SPOONS.` }]; }
    if (!q) return [{ text: 'THE AGENT IS THINKING' }, { text: 'FOLLOW THE WHITE RABBIT' }];
    if (!q.options.length) return [{ text: 'THERE ARE NO OPTIONS' }, { text: 'THERE IS NO SPOON' }];
    return q.options.map((o) => ({ text: `${o.recommended ? '★ ' : ''}${o.label.toUpperCase()}`, rec: o.recommended }));
  }

  function termLines() {
    const q = ctx.question;
    if (ctx.front === 'done') return ['Wake up, developer…', 'The grill is over. There is no spoon.', 'You are the one.'];
    if (!q) return ['Wake up, developer…', ctx.agent === 'listening' ? 'The agent is listening.' : 'The agent has you.', 'Knock, knock.'];
    return ['Wake up, developer…', `The grill has you. Question ${q.n} of ${q.total}.`, q.recommended.length ? 'Follow the white rabbit. It has a ★ on it.' : 'Follow the white rabbit.', 'Knock, knock.'];
  }

  function where() {
    const sp = k.space();
    const top = sp.gaps.find((g) => g.where === 'top' && g.h >= 26);
    return { x: (top || sp.stage).x + 22, y: top ? top.y + Math.min(top.h / 2, 34) : sp.stage.y + 22 };
  }

  function placeTerm() {
    term = { ...where(), lines: termLines(), i: k.reduced ? 1 : 0, chars: 0, hold: 0 };
    if (k.reduced) term.chars = term.lines[1].length;
  }

  // Place the words in the biggest visible gap around the card, snapped to the rain's grid.
  function layout() {
    words = [];
    const sp = k.space();
    const gap = sp.gaps.find((g) => g.where !== 'top' && g.w >= CW * 14 && g.h >= CH * 3);
    if (!gap) return;
    const ls = lines();
    const gcols = Math.floor(gap.w / CW) - 2;
    const grows = Math.floor(gap.h / CH) - 1;
    const step = grows >= ls.length * 2 ? 2 : 1;
    const n = Math.min(ls.length, Math.floor((grows - 1) / step) + 1);
    const texts = ls.slice(0, n).map((l) => ({ ...l, text: [...k.clip(l.text, gcols)] }));
    const width = Math.max(...texts.map((l) => l.text.length));
    const c0 = Math.round((gap.x + gap.w / 2) / CW - width / 2);
    const r0 = Math.round((gap.y + gap.h / 2) / CH - ((n - 1) * step + 1) / 2);
    texts.forEach((l, i) => l.text.forEach((ch, j) => {
      if (ch !== ' ') words.push({ ch, col: c0 + j, row: r0 + i * step, rec: l.rec, lock: k.reduced ? -9 : null, glitch: 0, melt: null });
    }));
    if (k.reduced) phase = 'hold';
  }

  // Send one fast drop down every column that has a letter, so the rain "writes" them.
  function form() {
    layout();
    if (!words.length) return false;
    const firstRow = new Map();
    for (const w of words) firstRow.set(w.col, Math.min(firstRow.get(w.col) ?? Infinity, w.row));
    for (const [col, row] of firstRow) {
      const d = drops[col];
      if (!d) continue;
      Object.assign(d, { y: row - k.rand(4, 16), speed: k.rand(20, 32), depth: 1 });
      d.decay = d.speed / 14;
      d.row = Math.floor(d.y);
    }
    return true;
  }

  function melt() {
    if (!words.length) return;
    phase = 'melt';
    phaseT = 0;
    for (const w of words) w.melt = { delay: k.rand(0, 0.7), kicked: false };
  }

  cv.resized = (w, h, { dprOnly } = {}) => {
    if (!dprOnly) return grid();
    atlas = buildAtlas(); // same rain, sprites redrawn at the new DPR
    sprites.clear();
  };
  grid();

  k.loop((dt, t) => {
    // the rain
    surge = Math.max(0, surge - dt * 0.9);
    const boost = 1 + surge * 2.2;
    for (let x = 0; x < cols; x++) {
      const d = drops[x];
      d.y += d.speed * boost * dt;
      const to = Math.floor(d.y);
      for (let y = Math.max(0, d.row + 1); y <= to && y < rows; y++) {
        const i = y * cols + x;
        bright[i] = 1;
        glyph[i] = (Math.random() * glyphs.length) | 0;
      }
      d.row = to;
      if (d.y - d.speed / d.decay > rows) spawn(d);
    }
    for (let n = (cols * rows * 0.003) | 0; n > 0; n--) glyph[(Math.random() * glyph.length) | 0] = (Math.random() * glyphs.length) | 0;

    c.fillStyle = '#010804';
    c.fillRect(0, 0, cv.w, cv.h);
    const { a, s, sz } = atlas;
    for (let x = 0; x < cols; x++) {
      const d = drops[x];
      const fade = d.decay * dt;
      for (let y = 0; y < rows; y++) {
        const i = y * cols + x;
        let b = bright[i];
        if (b <= 0) continue;
        b = bright[i] = Math.max(0, b - fade);
        if (b < 0.03) continue;
        c.globalAlpha = b * b * d.depth;
        c.drawImage(a, glyph[i] * s, 0, s, s, x * CW - (sz - CW) / 2, y * CH - PAD, sz, sz);
      }
      if (d.row >= 0 && d.row < rows) {
        c.globalAlpha = 0.25 + d.depth * 0.75;
        c.drawImage(a, glyph[d.row * cols + x] * s, s, s, s, x * CW - (sz - CW) / 2, d.row * CH - PAD, sz, sz);
      }
    }
    c.globalAlpha = 1;

    // the words
    phaseT += dt;
    if (phase === 'rain' && phaseT > nextAt) {
      phaseT = 0;
      if (form()) phase = 'form';
    }
    if (phase === 'form') {
      for (const w of words) if (w.lock === null && ((drops[w.col]?.row ?? Infinity) >= w.row || phaseT > 2.6)) w.lock = t;
      if (words.every((w) => w.lock !== null)) { phase = 'hold'; phaseT = 0; }
    }
    if (phase === 'hold' && phaseT > 3.6 && !k.reduced) melt();
    if (phase === 'melt' && words.every((w) => phaseT > w.melt.delay + 1.2)) {
      words = [];
      phase = 'rain';
      phaseT = 0;
      nextAt = k.rand(2.4, 4.2);
    }
    for (const w of words) {
      if (w.lock === null) continue;
      const x = w.col * CW, y = w.row * CH;
      let alpha = 1, drop = 0, stretch = 1;
      if (w.melt) {
        const mt = phaseT - w.melt.delay;
        if (mt > 0) {
          if (!w.melt.kicked) { // the letter turns back into rain: its column carries on down from here
            w.melt.kicked = true;
            const d = drops[w.col];
            if (d) Object.assign(d, { y: w.row, row: w.row, speed: k.rand(12, 18), depth: 1, decay: 1.1 });
          }
          drop = 380 * mt * mt;
          stretch = 1 + mt * 2.4;
          alpha = Math.max(0, 1 - mt / 1.1);
        }
      }
      if (alpha <= 0) continue;
      c.globalAlpha = alpha * 0.85;
      c.fillStyle = '#010804';
      c.fillRect(x - 1, y + drop * 0.3, CW + 2, CH);
      if (w.glitch > 0) w.glitch -= dt;
      else if (phase === 'hold' && Math.random() < dt * 0.25) w.glitch = 0.07;
      c.save();
      c.translate(x + CW / 2, y + drop);
      c.scale(1, stretch);
      c.globalAlpha = alpha;
      if (w.glitch > 0) c.drawImage(a, ((t * 37 + w.col) % glyphs.length | 0) * s, 0, s, s, -sz / 2, -PAD, sz, sz);
      else {
        const pulse = w.rec ? 0.85 + Math.sin(t * 3) * 0.15 : 1;
        c.globalAlpha = alpha * pulse;
        c.drawImage(sprite(w.ch, w.rec ? 'rec' : 'lock'), -sz / 2, -PAD, sz, sz);
        const flash = 1 - (t - w.lock) / 0.4;
        if (flash > 0) { c.globalAlpha = alpha * flash; c.drawImage(sprite(w.ch, 'flash'), -sz / 2, -PAD, sz, sz); }
      }
      c.restore();
    }
    c.globalAlpha = 1;

    // "Wake up, developer…" typed out at the top, one line at a time
    if (term) {
      const line = term.lines[term.i % term.lines.length];
      if (!k.reduced) {
        if (term.hold > 0) {
          term.hold -= dt;
          if (term.hold <= 0) term.erasing = true;
        } else if (term.erasing) {
          term.chars -= dt * 70;
          if (term.chars <= 0) { term.chars = 0; term.erasing = false; term.i++; term.hold = -0.6; }
        } else if (term.hold < 0) term.hold = Math.min(0, term.hold + dt);
        else {
          term.chars = Math.min(line.length, term.chars + dt * k.rand(10, 30));
          if (term.chars >= line.length) term.hold = 2.8;
        }
      }
      const shown = line.slice(0, Math.floor(term.chars));
      c.font = k.font(13, 500, 'mono');
      c.textBaseline = 'middle';
      c.shadowColor = 'rgba(60,255,130,.8)';
      c.shadowBlur = 8;
      c.fillStyle = '#7dffa3';
      c.fillText(shown, term.x, term.y);
      if (k.reduced || Math.floor(t * 2.2) % 2 === 0) {
        const w = c.measureText(shown).width;
        c.fillRect(term.x + w + 3, term.y - 7, 8, 14);
      }
      c.shadowBlur = 0;
    }
  }, { still: 0.05 });

  return {
    question() {
      if (k.reduced) { placeTerm(); layout(); return; }
      term = null;
      k.after(450, placeTerm); // once the new card has settled
      if (phase === 'form' || phase === 'hold') melt();
      else if (phase === 'rain') nextAt = Math.min(nextAt, phaseT + 1.2);
    },
    layout() {
      if (k.reduced) { placeTerm(); layout(); } else if (term) Object.assign(term, where());
    },
    status() {
      if (!ctx.question && term) term.lines = termLines();
    },
    answer() {
      surge = 1;
    },
    keystroke() {
      const d = drops[k.int(0, cols - 1)];
      Object.assign(d, { y: -1, row: -2, speed: k.rand(24, 34), depth: 1, decay: 1.6 });
    },
  };
}
