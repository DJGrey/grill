// Nature documentary. A savanna at golden hour, filmed through a long lens. The narrator observes
// the developer in its natural habitat, using the real time you've spent on the card. The sun sets
// the longer you take. After a minute and a half, the vultures arrive.

const SKY = [ // p: [top, middle, horizon], ground, silhouette
  [0.3, ['#6f9ccc', '#e9c98a', '#ffdc95'], '#c49a4a', '#4a321c'],
  [0.5, ['#c98a5a', '#f1b46c', '#ffd27e'], '#a87638', '#3a2414'],
  [0.7, ['#4b3a6e', '#d4664c', '#ffad5a'], '#6e4426', '#24140c'],
  [0.88, ['#141b40', '#43305e', '#b35e66'], '#2c2024', '#0f0a0c'],
  [1, ['#050918', '#0f1733', '#2e2546'], '#121018', '#06050a'],
];
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const num = (n) => WORDS[n] || String(n);
const SUN_S = 240; // seconds from golden hour to night

export default function natureDoc(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
  function palette(p) {
    let i = 0;
    while (i < SKY.length - 2 && p > SKY[i + 1][0]) i++;
    const [p0, s0, g0, d0] = SKY[i], [p1, s1, g1, d1] = SKY[i + 1];
    const t = k.clamp((p - p0) / (p1 - p0));
    return { sky: s0.map((col, j) => mix(col, s1[j], t)), ground: mix(g0, g1, t), dark: mix(d0, d1, t) };
  }
  const sprite = (inner, outer, size = 128) => {
    const s = document.createElement('canvas');
    s.width = s.height = size;
    const x = s.getContext('2d');
    const r = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    r.addColorStop(0, inner);
    r.addColorStop(1, outer);
    x.fillStyle = r;
    x.fillRect(0, 0, size, size);
    return s;
  };
  const sunGlow = sprite('rgba(255,236,170,.85)', 'rgba(255,170,80,0)');
  const screenGlow = sprite('rgba(170,225,255,.7)', 'rgba(120,190,255,0)', 64);

  // ── layout ────────────────────────────────────────────────────────────────
  let L, vignette;
  function measure() {
    const sp = k.space();
    const st = sp.stage;
    const B = sp.gaps.find((g) => g.where === 'bottom' && g.h >= 70) || { x: st.x, y: sp.vh - 150, w: st.width, h: 150 };
    const T = sp.gaps.find((g) => g.where === 'top' && g.h >= 26);
    const Hy = B.y + B.h * 0.42;
    const R = k.rng('savanna');
    const s = k.clamp(B.h / 260, 0.55, 1.3);
    const hills = Array.from({ length: 4 }, (_, i) => [R.rand(6), 0.004 + i * 0.006, R.rand(4, 12) * s]);
    const trees = Array.from({ length: 9 }, () => ({ x: R.rand(sp.vw), y: Hy + R.rand(2, 10) * s, s: R.rand(0.25, 0.5) * s, seed: R.int(0, 999) }));
    trees.push({ x: B.x + B.w * 0.12, y: Hy + (B.h * 0.58) * 0.62, s: 1.15 * s, seed: 7, big: true });
    const blades = Array.from({ length: Math.ceil(sp.vw / 9) }, (_, i) => ({ x: i * 9 + R.rand(-4, 4), h: R.rand(16, 38) * s, ph: R.rand(6), lean: R.rand(-0.25, 0.25) }));
    const subTop = B.y + B.h - (B.h < 240 ? 12 : 26) - 2 * k.clamp(B.w / 38, 13, 18) * 1.35 - 6;
    L = { sp, st, B, T, Hy, s, hills, trees, blades, vw: sp.vw, vh: sp.vh, narrow: !sp.notes, hudX: sp.hud ? sp.hud.left - 12 : Infinity,
      dev: { x: B.x + B.w * 0.44, y: Math.max(Hy + 8, Math.min(Hy + (B.y + B.h - Hy) * 0.58, subTop)), h: k.clamp(B.h * 0.36, 36, 96) } };
    vignette = document.createElement('canvas');
    vignette.width = 320; vignette.height = 200;
    const v = vignette.getContext('2d');
    const r = v.createRadialGradient(160, 100, 60, 160, 100, 200);
    r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(10,5,0,.55)');
    v.fillStyle = r; v.fillRect(0, 0, 320, 200);
  }

  // ── the wildlife ──────────────────────────────────────────────────────────
  const blob = (x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); c.fill(); };
  const stroke = (pts, w) => {
    c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.stroke();
  };

  function acacia(tr, col) {
    const R = k.rng(tr.seed);
    const { x, y, s } = tr;
    c.fillStyle = c.strokeStyle = col;
    const top = y - 70 * s;
    stroke([x, y, x + 2 * s, y - 30 * s, x - 14 * s, top + 6 * s], 5 * s);
    stroke([x + 2 * s, y - 30 * s, x + 18 * s, top + 4 * s], 4 * s);
    stroke([x + 2 * s, y - 40 * s, x + 2 * s, top], 3 * s);
    for (let i = 0; i < 7; i++) blob(x + R.rand(-46, 46) * s, top + R.rand(-6, 4) * s, R.rand(18, 30) * s, R.rand(5, 8) * s);
    blob(x, top - 4 * s, 52 * s, 7 * s);
  }

  function giraffe(x, y, s, t, col) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.fillStyle = c.strokeStyle = col;
    const w = t * 2.2;
    for (const [hx, ph] of [[-16, 0], [-12, Math.PI], [14, Math.PI * 0.5], [18, Math.PI * 1.5]]) {
      const sw = Math.sin(w + ph) * 6;
      stroke([hx, -56, hx + sw * 0.5, -30, hx + sw, 0], 3.2);
    }
    blob(0, -60, 23, 11, -0.12);
    const bob = Math.sin(w * 2) * 1.5;
    c.beginPath(); c.moveTo(12, -68); c.lineTo(32, -108 + bob); c.lineTo(38, -104 + bob); c.lineTo(22, -56); c.fill();
    blob(39, -108 + bob, 8, 3.6, 0.45);
    stroke([33, -112 + bob, 32, -118 + bob], 1.4);
    stroke([36, -112 + bob, 36, -118 + bob], 1.4);
    stroke([-22, -62, -27, -44], 1.4);
    c.restore();
  }

  function bird(x, y, s, flap, col) {
    c.strokeStyle = col;
    const f = Math.sin(flap) * 5 * s;
    stroke([x - 8 * s, y - f, x - 3 * s, y - 1 * s, x, y + 1 * s, x + 3 * s, y - 1 * s, x + 8 * s, y - f], 1.6 * s);
  }

  // The subject: hunched over a laptop in the long grass, mug of coffee beside it.
  function developer(t, col, p) {
    const { x, y, h } = L.dev;
    const typing = ctx.typing && ctx.question;
    const lit = ctx.front !== 'done';
    c.fillStyle = 'rgba(0,0,0,.25)';
    blob(x + 0.12 * h, y + 1, 0.42 * h, 0.05 * h);
    if (lit) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.35 + p * 0.65;
      c.drawImage(screenGlow, x - 0.25 * h, y - 0.95 * h, 0.8 * h, 0.8 * h);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    c.fillStyle = c.strokeStyle = col;
    // mug, steaming
    c.fillRect(x - 0.3 * h, y - 0.12 * h, 0.08 * h, 0.12 * h);
    stroke([x - 0.22 * h, y - 0.1 * h, x - 0.18 * h, y - 0.06 * h, x - 0.22 * h, y - 0.03 * h], 0.018 * h);
    c.strokeStyle = 'rgba(255,240,220,.35)';
    for (let i = 0; i < 2; i++) {
      const o = (t * 0.6 + i * 0.5) % 1;
      c.globalAlpha = 1 - o;
      stroke([x - 0.27 * h + i * 0.03 * h, y - 0.14 * h - o * 0.2 * h, x - 0.25 * h + Math.sin(t * 2 + i) * 0.03 * h, y - 0.24 * h - o * 0.2 * h], 0.012 * h);
    }
    c.globalAlpha = 1;
    c.strokeStyle = col;
    // legs, knees up, laptop on the knees
    stroke([x, y - 0.06 * h, x + 0.22 * h, y - 0.3 * h, x + 0.3 * h, y - 0.02 * h], 0.11 * h);
    const hunch = Math.sin(t * 0.4) * 0.01 * h;
    c.beginPath();
    c.moveTo(x - 0.1 * h, y); c.lineTo(x + 0.06 * h, y);
    c.quadraticCurveTo(x + 0.12 * h, y - 0.4 * h, x + 0.07 * h, y - 0.56 * h + hunch);
    c.lineTo(x - 0.05 * h, y - 0.58 * h + hunch);
    c.quadraticCurveTo(x - 0.16 * h, y - 0.36 * h, x - 0.1 * h, y);
    c.fill();
    const hx = x + 0.07 * h, hy = y - 0.66 * h + hunch;
    blob(hx, hy, 0.1 * h, 0.105 * h);
    blob(hx - 0.05 * h, hy - 0.02 * h, 0.08 * h, 0.1 * h); // the hood
    // laptop: keyboard on the knees, lid towards the face
    c.beginPath();
    c.moveTo(x + 0.13 * h, y - 0.33 * h); c.lineTo(x + 0.4 * h, y - 0.3 * h); c.lineTo(x + 0.4 * h, y - 0.28 * h); c.lineTo(x + 0.13 * h, y - 0.31 * h); c.fill();
    c.beginPath();
    c.moveTo(x + 0.4 * h, y - 0.3 * h); c.lineTo(x + 0.45 * h, y - 0.53 * h); c.lineTo(x + 0.425 * h, y - 0.535 * h); c.lineTo(x + 0.38 * h, y - 0.3 * h); c.fill();
    if (lit) { c.strokeStyle = 'rgba(190,230,255,.9)'; stroke([x + 0.38 * h, y - 0.31 * h, x + 0.425 * h, y - 0.52 * h], 0.012 * h); c.strokeStyle = col; }
    // arm: typing, or the slow scratch of the head every so often
    const scratch = !typing && t % 9 > 7.4;
    const tap = typing ? Math.abs(Math.sin(t * 22)) * 0.025 * h : 0;
    if (scratch) {
      const w = Math.sin(t * 14) * 0.02 * h;
      stroke([x + 0.03 * h, y - 0.5 * h, x + 0.16 * h, y - 0.62 * h, hx + 0.02 * h + w, hy - 0.08 * h], 0.06 * h);
    } else stroke([x + 0.03 * h, y - 0.5 * h, x + 0.14 * h, y - 0.36 * h, x + 0.27 * h, y - 0.36 * h - tap], 0.06 * h);
  }

  // ── narration ─────────────────────────────────────────────────────────────
  const opts = () => ctx.question?.options || [];
  function since(sec) {
    const s = Math.round(sec);
    if (s < 60) return `${num(s)} second${s === 1 ? '' : 's'}`;
    const m = Math.round(s / 60);
    return m === 1 ? 'a minute' : `${num(m)} minutes`;
  }
  function lines() {
    const q = ctx.question;
    if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      return [
        'As the sun sets on the savanna, the developer rests.',
        `${num(n)[0].toUpperCase()}${num(n).slice(1)} decision${n === 1 ? '' : 's'}. It will survive another sprint.`,
        ctx.recRate != null ? `It took the recommendation ${Math.round(ctx.recRate * 100)}% of the time. A cautious creature.` : 'A cautious creature.',
        'Next week: the code review. Brutal, but necessary.',
      ];
    }
    if (!q) return [
      'The agent retreats into the long grass to prepare the next question.',
      ctx.agent === 'listening' ? 'Listen. The agent is listening. It can hear the developer thinking.' : 'We wait. The savanna holds its breath.',
      'Somewhere, a meerkat checks the build.',
      'The developer, sensing a lull, refills its coffee.',
    ];
    const recs = opts().filter((o) => o.recommended);
    const left = q.total - q.n;
    const list = [
      q.revising ? `It has returned to an earlier watering hole. Question ${num(q.n)}. Curious.` : 'Here we observe the developer, in its natural habitat.',
      () => `It has been staring at question ${num(q.n)} for ${since(ctx.cardTime)}.`,
    ];
    if (q.title.length > 70) list.push(`“${k.clip(q.title, 60)}” A question as old as the savanna itself.`);
    if (!opts().length) list.push('There are no options here. It must forage for an answer of its own.');
    else if (recs.length) list.push(`The recommended option, “${k.clip(recs[0].label, 46)}”, sits in plain sight.`, 'And yet the developer hesitates.');
    else list.push(`${num(opts().length)[0].toUpperCase()}${num(opts().length).slice(1)} option${opts().length === 1 ? '' : 's'}. None of them starred. A harsh environment.`);
    if (q.multi) list.push('It may take several. A rare luxury on the savanna.');
    list.push(() => (ctx.idle > 25 && !ctx.typing ? `It has not moved for ${since(ctx.idle)}. We must not disturb it.` : 'Remarkable.'));
    list.push(left ? `Behind it, ${num(q.n - 1)} question${q.n === 2 ? '' : 's'}. Ahead, ${num(left)}. The migration is long.` : 'The final question. The watering hole is in sight.');
    list.push(() => (ctx.cardTime > 90 ? 'The vultures have begun to circle.' : 'Extraordinary.'));
    return list;
  }

  let sub = null; // { text, t, dur }
  let li = 0;
  let queue = [];
  let gapT = 0.6;
  let title = { t: 0, dur: 4.2 };
  function say(text, now) {
    if (now) queue.unshift(text); else queue.push(text);
    if (now && sub) sub.t = Math.max(sub.t, sub.dur - 0.25);
  }
  function nextLine() {
    let text = queue.shift();
    if (!text) {
      const list = lines();
      text = list[li++ % list.length];
    }
    text = typeof text === 'function' ? text() : text;
    sub = { text, t: 0, dur: k.clamp(2.4 + text.length * 0.055, 3.6, 7.5) };
  }
  let answeredAt = -1e9;
  const restart = () => {
    li = 0; title = { t: 0, dur: 4.2 };
    if (performance.now() - answeredAt < 2500) return; // let the verdict on the answer finish
    queue = []; sub = null; gapT = 0.9;
  };

  // ── sound: wind in the grass and the odd bird ─────────────────────────────
  let wind = null;
  const sound = (on) => {
    wind?.stop(0.6);
    wind = on ? k.sfx.noise({ dur: Infinity, color: 'pink', filter: 'lowpass', freq: 520, q: 0.4, gain: 0.03, attack: 1.2 }) : null;
  };
  const chirp = () => {
    const f = k.rand(2400, 3600), pan = k.rand(-0.7, 0.7);
    for (let i = 0; i < k.int(2, 4); i++) k.sfx.tone({ freq: f, to: f * k.rand(1.2, 1.5), dur: 0.07, gain: 0.025, delay: i * 0.12, pan });
  };

  // ── drawing ───────────────────────────────────────────────────────────────
  const flock = { x: -100, y: 0, t: 0, next: 4 };

  function sunP() {
    if (ctx.front === 'done') return 0.74;
    if (!ctx.question) return 0.45;
    return k.reduced ? 0.62 : 0.3 + 0.7 * k.clamp(ctx.cardTime / SUN_S);
  }

  function scene(dt, t) {
    const { vw, vh, B, Hy, s, dev } = L;
    const p = sunP();
    const P = palette(p);
    const g = c.createLinearGradient(0, 0, 0, Hy);
    g.addColorStop(0, P.sky[0]); g.addColorStop(0.6, P.sky[1]); g.addColorStop(1, P.sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, vw, Hy + 2);
    // stars come out at dusk
    if (p > 0.78) {
      const R = k.rng('stars');
      c.fillStyle = '#fff';
      for (let i = 0; i < 140; i++) {
        const x = R.rand(vw), y = R.rand(Hy - 10), tw = 0.5 + 0.5 * Math.sin(t * R.rand(1, 3) + i);
        c.globalAlpha = k.clamp((p - 0.78) * 5) * (0.3 + 0.7 * tw) * (1 - y / Hy);
        c.fillRect(x, y, 1.4, 1.4);
      }
      c.globalAlpha = 1;
    }
    // the sun, sinking behind the card and into the horizon
    const sx = B.x + B.w * 0.74;
    const sy = Hy + 6 - (1 - k.clamp((p - 0.3) / 0.58)) * (Hy - B.y + 60);
    const sr = 26 * s;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = k.clamp(1.2 - p);
    c.drawImage(sunGlow, sx - sr * 7, sy - sr * 7, sr * 14, sr * 14);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.save();
    c.beginPath(); c.rect(0, 0, vw, Hy); c.clip();
    c.fillStyle = mix('#fff6d8', '#ff7a3a', k.clamp((p - 0.3) / 0.55));
    blob(sx, sy, sr, sr);
    c.restore();
    // far hills in haze, with the flat-topped mountain
    c.fillStyle = mix('#b07a5a', '#2a2036', k.clamp((p - 0.5) / 0.5));
    c.globalAlpha = 0.55;
    c.beginPath(); c.moveTo(0, Hy);
    const mx = B.x + B.w * 0.3;
    for (let x = 0; x <= vw; x += 8) {
      const m = Math.max(0, 1 - Math.abs(x - mx) / (160 * s));
      let y = Hy - L.hills.reduce((a, [ph, fq, amp]) => a + Math.sin(x * fq + ph) * amp, 0) * 0.6 - 10 * s;
      y -= Math.min(1, m * 1.6) * 52 * s;
      c.lineTo(x, y);
    }
    c.lineTo(vw, Hy); c.fill();
    c.globalAlpha = 1;
    // the plain
    const gg = c.createLinearGradient(0, Hy, 0, vh);
    gg.addColorStop(0, mix('#d9a860', '#201820', k.clamp((p - 0.4) / 0.6)));
    gg.addColorStop(0.25, P.ground);
    gg.addColorStop(1, P.dark);
    c.fillStyle = gg;
    c.fillRect(0, Hy, vw, vh - Hy);
    // far trees, giraffes on the move, the big acacia
    for (const tr of L.trees) if (!tr.big) acacia(tr, P.dark);
    const gw = vw + 400;
    const gx = ((B.x + B.w * 0.62 + 200 + t * 9 * s) % gw) - 200;
    giraffe(gx, Hy + 14 * s, 0.6 * s, t, P.dark);
    giraffe(gx - 70 * s, Hy + 12 * s, 0.45 * s, t + 0.7, P.dark);
    acacia(L.trees.at(-1), P.dark);
    // a flock now and then
    flock.t += dt;
    if (flock.t > flock.next) { Object.assign(flock, { x: -60, y: B.y + k.rand(14, Math.max(20, Hy - B.y - 30)), t: 0, next: k.rand(16, 26) }); if (k.sfx.on) chirp(); }
    flock.x += dt * 40;
    for (let i = 0; i < 5; i++) bird(flock.x - Math.abs(i - 2) * 16 * s, flock.y + Math.abs(i - 2) * 9 * s + (i - 2) * 1, 0.9 * s, t * 9 + i, P.dark);
    // vultures after a minute and a half
    const vul = ctx.question ? k.clamp((ctx.cardTime - 90) / 8) : 0;
    if (vul > 0) {
      c.globalAlpha = vul;
      for (let i = 0; i < 3; i++) {
        const a = t * 0.45 + (i * Math.PI * 2) / 3;
        bird(dev.x + 0.2 * dev.h + Math.cos(a) * 70 * s, Math.max(B.y + 18, dev.y - dev.h * 1.9) + Math.sin(a) * 14 * s, 1.6 * s, Math.sin(t * 0.8 + i) * 0.6 + 0.4, P.dark);
      }
      c.globalAlpha = 1;
    }
    developer(t, P.dark, k.clamp((p - 0.4) / 0.5));
    // foreground grass, swaying
    c.strokeStyle = P.dark;
    c.lineCap = 'round';
    c.lineWidth = 2.2 * s;
    c.beginPath();
    for (const bl of L.blades) {
      const sw = Math.sin(t * 1.3 + bl.ph + bl.x * 0.01) * 4 * s + bl.lean * bl.h;
      c.moveTo(bl.x, vh + 2);
      c.quadraticCurveTo(bl.x + sw * 0.3, vh - bl.h * 0.5, bl.x + sw, vh - bl.h);
    }
    c.stroke();
    c.drawImage(vignette, 0, 0, vw, vh);
  }

  // The camera: corner brackets, REC, timecode, a focus box that hunts, and the subtitles.
  function viewfinder(dt, t) {
    const { st, B, T, dev } = L;
    const x0 = st.x + 14, x1 = st.x + st.width - 14, xr = Math.min(x1 - 10 - (L.narrow ? 96 : 0), L.hudX), y0 = st.y + 12, y1 = st.y + st.height - 12;
    c.strokeStyle = 'rgba(255,255,255,.7)';
    c.lineWidth = 1.5;
    const arm = 22;
    for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      c.beginPath(); c.moveTo(x, y + arm * sy); c.lineTo(x, y); c.lineTo(x + arm * sx, y); c.stroke();
    }
    const ty = T ? T.y + T.h / 2 : B.y + 16;
    c.font = k.font(11, 700, 'mono');
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    const on = k.reduced || Math.floor(t * 1.6) % 2 === 0;
    c.fillStyle = '#ff3b30';
    if (on) blob(x0 + 26, ty, 4.5, 4.5);
    c.fillStyle = 'rgba(255,255,255,.85)';
    const q = ctx.question;
    c.fillText(`REC   PLANET GRILL · ${q ? `EP. ${q.n}${q.tag ? ` · ${q.tag.toUpperCase()}` : ''}` : ctx.front === 'done' ? 'FINALE' : 'B-ROLL'}`, x0 + 36, ty);
    const tc = ctx.cardTime;
    const fr = Math.floor((tc % 1) * 25), sec = Math.floor(tc) % 60, min = Math.floor(tc / 60) % 60, hr = Math.floor(tc / 3600);
    c.textAlign = 'right';
    c.fillText([hr, min, sec, fr].map((v) => String(v).padStart(2, '0')).join(':'), xr, ty);
    c.fillStyle = 'rgba(255,255,255,.6)';
    c.font = k.font(10, 600, 'mono');
    if (T) c.fillText('600mm  f/4  ISO 400  ▮▮▮▯', xr, ty + 15 < T.y + T.h ? ty + 15 : B.y + 14);
    else if (B.h > 110) c.fillText('600mm  f/4  ISO 400  ▮▮▮▯', xr, B.y + 30);
    // focus box on the subject, hunting a little
    const hunt = k.reduced ? 0 : Math.max(0, Math.sin(t * 0.7)) ** 8 * 6;
    const fw = dev.h * 0.95 + hunt, fh = dev.h * 1.0 + hunt;
    const fx = dev.x + 0.08 * dev.h - fw / 2, fy = dev.y - dev.h * 0.82 - hunt / 2;
    c.strokeStyle = `rgba(255,255,255,${0.55 + (hunt ? 0.3 : 0)})`;
    c.lineWidth = 1.2;
    const a = 8;
    for (const [x, y, sx, sy] of [[fx, fy, 1, 1], [fx + fw, fy, -1, 1], [fx, fy + fh, 1, -1], [fx + fw, fy + fh, -1, -1]]) {
      c.beginPath(); c.moveTo(x, y + a * sy); c.lineTo(x, y); c.lineTo(x + a * sx, y); c.stroke();
    }
  }

  function subtitles(dt) {
    const { B } = L;
    if (!k.reduced) {
      if (!sub) { gapT -= dt; if (gapT <= 0) nextLine(); } else {
        sub.t += dt;
        if (sub.t > sub.dur) { sub = null; gapT = queue.length ? 0.2 : 0.9; }
      }
    } else if (!sub) nextLine();
    // the episode title, over the sky, at the start of each question
    if (title.t < title.dur && !k.reduced) {
      title.t += dt;
      const a = Math.min(1, title.t / 0.6, (title.dur - title.t) / 0.8);
      const ty = B.y + Math.min(46, B.h * 0.2);
      c.globalAlpha = Math.max(0, a);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#fff';
      c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 10;
      c.font = k.font(Math.min(30, B.w * 0.05), 300, 'serif');
      c.letterSpacing = '9px';
      c.fillText('PLANET GRILL', B.x + B.w / 2, ty);
      c.letterSpacing = '2px';
      c.font = k.font(12, 600, 'sans');
      const q = ctx.question;
      c.fillText(q ? `EPISODE ${q.n} OF ${q.total}` : ctx.front === 'done' ? 'THE FINALE' : 'WHILE WE WAIT', B.x + B.w / 2, ty + 26);
      c.letterSpacing = '0px';
      c.shadowBlur = 0;
      c.globalAlpha = 1;
    }
    if (!sub) return;
    const a = k.reduced ? 1 : Math.max(0, Math.min(1, sub.t / 0.3, (sub.dur - sub.t) / 0.4));
    const size = k.clamp(B.w / 38, 13, 18);
    c.font = k.font(size, 600, 'sans');
    const lines = k.wrap(c, sub.text, Math.min(B.w - 60, 620), 2);
    const lh = size * 1.35;
    const by = B.y + B.h - (B.h < 240 ? 12 : 26) - lines.length * lh;
    c.globalAlpha = a;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    lines.forEach((l, i) => {
      const w = c.measureText(l).width + 16;
      c.fillStyle = 'rgba(0,0,0,.62)';
      c.fillRect(B.x + B.w / 2 - w / 2, by + i * lh - 2, w, lh);
      c.fillStyle = '#fff';
      c.fillText(l, B.x + B.w / 2, by + i * lh + 1);
    });
    c.globalAlpha = 1;
  }

  measure();
  cv.resized = (w, h, { dprOnly } = {}) => { if (!dprOnly) measure(); }; // no DPR-sized caches
  if (ctx.sound) sound(true);
  if (k.reduced) {
    sub = { text: ctx.question ? `Here we observe the developer. It has been staring at question ${num(ctx.question.n)} for ${since(ctx.cardTime)}.` : lines()[0], t: 0, dur: 99 };
    k.every(15000, () => lp.redraw()); // the narration's clock still ticks, without motion
  }

  const lp = k.loop((dt, t) => {
    if (k.reduced && ctx.question) sub = { text: `Here we observe the developer. It has been staring at question ${num(ctx.question.n)} for ${since(Math.max(3, ctx.cardTime))}.`, t: 0, dur: 99 };
    scene(dt, t);
    viewfinder(dt, t);
    subtitles(dt);
  }, { still: 2 });

  return {
    question() {
      restart();
      if (k.reduced) sub = null;
      lp.redraw();
    },
    layout() { measure(); lp.redraw(); },
    event(name) { if (name === 'stat') { const h = k.space().hud; L.hudX = h ? h.left - 12 : Infinity; lp.redraw(); } },
    status() { if (!ctx.question) { queue = []; } },
    typing(on) {
      if (!ctx.question) return;
      if (on && !queue.length) say(k.chance(0.5) ? 'Listen. It is typing. This is extremely rare footage.' : 'And now, a burst of typing. The herd looks on.', true);
      else if (!on && ctx.answerEmpty) say('It has deleted everything. Back to staring.', true);
    },
    answer(a) {
      const pick = a.picks?.[0];
      say(a.tookRec ? 'And there it is. Like its ancestors before it, it takes the recommendation.'
        : pick ? `A bold choice: “${k.clip(pick, 40)}”. The herd will talk about this for years.`
          : 'It has written an answer of its own. Nature, uh, finds a way.', true);
      answeredAt = performance.now();
      nextLine();
      if (k.sfx.on) [523, 659, 784].forEach((f, i) => k.sfx.tone({ type: 'triangle', freq: f, dur: 1.6, gain: 0.04, delay: i * 0.12, attack: 0.15 }));
    },
    sound,
  };
}
