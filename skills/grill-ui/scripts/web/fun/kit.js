// The toolkit every fun-mode scene gets as `k`. Anything made through it (elements, listeners,
// timers, loops, sounds, inline styles, cursors, grabbed keys) is undone when the scene unmounts.
// See README.md for the contract.

const DPR_MAX = 2;
const HAD_STYLE = Symbol('had a style attribute');
const STILL_STEPS = 12; // reduced motion: a loop's `still` seconds are simulated in at most this many frames
const now = () => performance.now();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ── fonts, maths, randomness (also exported for scenes that want them at module level) ─────────

export const FONTS = {
  sans: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Liberation Serif", serif',
  display: 'Impact, "Arial Black", "Helvetica Neue", "Liberation Sans", sans-serif',
  hand: '"Bradley Hand", "Segoe Print", "Chalkboard SE", "Comic Sans MS", cursive',
  emoji: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
};

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) ** 2,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  inCubic: (t) => t ** 3,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  inBack: (t) => 2.70158 * t ** 3 - 1.70158 * t * t,
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// rng() uses Math.random. rng(seed) is repeatable (mulberry32); a string seed is hashed first.
export function rng(seed) {
  let s = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  const next = seed === undefined ? Math.random : () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    rand: (a = 1, b) => (b === undefined ? next() * a : a + next() * (b - a)),
    int: (a, b) => Math.floor(r.rand(a, b + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    shuffle: (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
  };
  return r;
}

// ── text ───────────────────────────────────────────────────────────────────

// Markdown to plain text, for drawing titles and labels.
export const plain = (s = '') => String(s)
  .replace(/`([^`]*)`/g, '$1')
  .replace(/\*\*(.+?)\*\*/g, '$1')
  .replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1$2')
  .replace(/(^|[^\w_])_(?!\s)(.+?)_(?!\w)/g, '$1$2')
  .replace(/~~(.+?)~~/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

export const font = (size, weight = 600, family = 'sans') => `${weight} ${size}px ${FONTS[family] || family}`;

export function clip(text, n) {
  const t = String(text ?? '');
  return t.length <= n ? t : `${t.slice(0, Math.max(1, n - 1)).trimEnd().replace(/[,.;:–-]$/, '')}…`;
}

export function ellipsize(c, text, maxW) {
  const t = String(text ?? '');
  if (c.measureText(t).width <= maxW) return t;
  let lo = 0, hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (c.measureText(`${t.slice(0, mid).trimEnd()}…`).width <= maxW) lo = mid; else hi = mid - 1;
  }
  return lo ? `${t.slice(0, lo).trimEnd().replace(/[,.;:–-]$/, '')}…` : '…';
}

// Shrinks the font from `size` towards `min` until the text fits, then ellipsizes. Leaves c.font set.
export function fit(c, text, maxW, { size = 24, min = 10, weight = 600, family = 'sans' } = {}) {
  let s = size;
  c.font = font(s, weight, family);
  while (s > min && c.measureText(text).width > maxW) {
    s = Math.max(min, Math.floor(s * 0.92));
    c.font = font(s, weight, family);
  }
  return { text: ellipsize(c, text, maxW), size: s, font: c.font };
}

// Word-wraps to lines no wider than maxW. The last allowed line is ellipsized if text is left over.
export function wrap(c, text, maxW, maxLines = Infinity) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    while (c.measureText(w).width > maxW && w.length > 1) { // a word wider than the line: hard break it
      let n = w.length - 1;
      while (n > 1 && c.measureText(w.slice(0, n)).width > maxW) n--;
      if (line) { lines.push(line); line = ''; }
      lines.push(w.slice(0, n));
      w = w.slice(n);
    }
    const next = line ? `${line} ${w}` : w;
    if (c.measureText(next).width <= maxW) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const rest = lines.slice(maxLines - 1).join(' ');
    lines.length = maxLines - 1;
    lines.push(ellipsize(c, rest, maxW));
  }
  return lines;
}

// Whether the system has a glyph for `ch` (emoji, katakana…), so you can pick a fallback.
const glyphCache = new Map();
export function canRender(ch, family = 'sans') {
  const key = `${family}|${ch}`;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  c.canvas.width = c.canvas.height = 32;
  const draw = (s) => {
    c.clearRect(0, 0, 32, 32);
    c.font = font(24, 400, family);
    c.textBaseline = 'middle';
    c.fillText(s, 2, 16);
    return c.getImageData(0, 0, 32, 32).data.join();
  };
  const ok = draw(ch) !== draw('\u{10FFFD}') && draw(ch) !== draw('');
  glyphCache.set(key, ok);
  return ok;
}

// ── sound: WebAudio synth, shared by every scene, silent unless sound is on ───────────────

const A = { on: false, ctx: null, out: null, buffers: {}, timer: 0 };

export function setSound(on) {
  A.on = on;
  if (on) audio();
  if (A.out) A.out.gain.setTargetAtTime(on ? 0.8 : 0, A.ctx.currentTime, 0.02);
  clearTimeout(A.timer);
  A.timer = setTimeout(syncAudio, on ? 0 : 150); // after the fade out
}

// The shared AudioContext only runs while sound is on and the tab is visible. Suspending it pauses
// every voice, ambient loops included, and resuming carries on where they were.
export function syncAudio() {
  if (!A.ctx) return;
  const run = A.on && !document.hidden;
  if (run && A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
  else if (!run && A.ctx.state === 'running') A.ctx.suspend().catch(() => {});
}

export const audioState = () => A.ctx?.state || 'none';

function audio() {
  if (!A.on || document.hidden) return null; // nothing new starts in a hidden tab
  if (!A.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    A.ctx = new AC();
    const comp = A.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 8;
    A.out = A.ctx.createGain();
    A.out.gain.value = 0.8;
    A.out.connect(comp).connect(A.ctx.destination);
  }
  if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
  return A.ctx;
}

function buffer(kind) {
  if (A.buffers[kind]) return A.buffers[kind];
  const ac = A.ctx;
  const len = ac.sampleRate * 2;
  const b = ac.createBuffer(1, len, ac.sampleRate);
  const d = b.getChannelData(0);
  if (kind === 'crackle') { // hiss with random pops, for sizzles and fires
    let pop = 0;
    for (let i = 0; i < len; i++) {
      if (Math.random() < 0.0009) pop = 0.6 + Math.random() * 0.4;
      pop *= 0.992;
      d[i] = (Math.random() * 2 - 1) * (0.12 + pop);
    }
  } else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  } else for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return (A.buffers[kind] = b);
}

const NOOP = { stop() {}, gain: null };

function voice(src, o, bin) {
  const ac = A.ctx;
  const t0 = ac.currentTime + (o.delay || 0);
  const dur = o.dur ?? 0.2;
  const peak = o.gain ?? 0.2;
  const attack = o.attack ?? 0.004;
  let node = src;
  if (o.filter) {
    const f = ac.createBiquadFilter();
    f.type = o.filter;
    f.frequency.setValueAtTime(o.freqF ?? 1000, t0);
    if (o.toF && Number.isFinite(dur)) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.toF), t0 + dur);
    f.Q.value = o.q ?? 1;
    node = node.connect(f);
  }
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  if (Number.isFinite(dur)) g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, attack + 0.01));
  node = node.connect(g);
  if (o.pan) {
    const p = ac.createStereoPanner();
    p.pan.value = clamp(o.pan, -1, 1);
    node = node.connect(p);
  }
  node.connect(A.out);
  src.start(t0);
  if (Number.isFinite(dur)) src.stop(t0 + dur + 0.05);
  const h = {
    gain: g.gain,
    stop(fade = 0.08) {
      try {
        const t = ac.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, Math.max(0.005, fade / 3));
        src.stop(t + fade);
      } catch {}
    },
  };
  bin.add(h);
  src.onended = () => { bin.delete(h); try { g.disconnect(); } catch {} };
  return h;
}

// tone({ type, freq, to, dur, gain, attack, delay, pan, filter, freqF, toF, q, vibrato: { rate, depth } })
function tone(o, bin) {
  const ac = audio();
  if (!ac) return NOOP;
  const osc = ac.createOscillator();
  const t0 = ac.currentTime + (o.delay || 0);
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.freq ?? 440, t0);
  if (o.to && Number.isFinite(o.dur ?? 0.2)) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + (o.dur ?? 0.2));
  if (o.vibrato) {
    const lfo = ac.createOscillator();
    const amt = ac.createGain();
    lfo.frequency.value = o.vibrato.rate ?? 6;
    amt.gain.value = o.vibrato.depth ?? 10;
    lfo.connect(amt).connect(osc.frequency);
    lfo.start(t0);
    if (Number.isFinite(o.dur ?? 0.2)) lfo.stop(t0 + (o.dur ?? 0.2) + 0.05);
    osc.addEventListener('ended', () => { try { lfo.stop(); } catch {} });
  }
  return voice(osc, o, bin);
}

// noise({ dur, gain, color: 'white'|'pink'|'crackle', filter, freq, to, q, attack, delay, pan, rate })
function noise(o, bin) {
  const ac = audio();
  if (!ac) return NOOP;
  const src = ac.createBufferSource();
  src.buffer = buffer(o.color || 'white');
  src.loop = true;
  src.loopStart = Math.random();
  src.playbackRate.value = o.rate ?? 1;
  return voice(src, { filter: 'bandpass', ...o, freqF: o.freq ?? 1200, toF: o.to }, bin);
}

// Presets. Each takes { gain = 1, pitch = 1, delay = 0, pan = 0 } and is a no-op while sound is off.
const PRESETS = {
  pop: (t, n, p, g) => {
    t({ freq: 620 * p, to: 170 * p, dur: 0.09, gain: 0.32 * g });
    n({ dur: 0.03, filter: 'highpass', freq: 2600, gain: 0.12 * g });
  },
  shot: (t, n, p, g) => {
    n({ dur: 0.05, filter: 'highpass', freq: 3500, gain: 0.5 * g, attack: 0.001 });
    n({ dur: 0.55, filter: 'lowpass', freq: 2400 * p, to: 160, q: 0.7, gain: 0.95 * g, attack: 0.002 });
    t({ freq: 120 * p, to: 38, dur: 0.3, gain: 0.7 * g, attack: 0.002 });
  },
  shatter: (t, n, p, g) => {
    for (let i = 0; i < 7; i++) n({ dur: 0.03 + Math.random() * 0.06, filter: 'bandpass', freq: (2500 + Math.random() * 4500) * p, q: 9, gain: 0.35 * g, delay: Math.random() * 0.14 });
    n({ dur: 0.3, filter: 'highpass', freq: 4000, gain: 0.12 * g });
  },
  whoosh: (t, n, p, g) => n({ dur: 0.5, filter: 'bandpass', freq: 280 * p, to: 2600 * p, q: 1.4, gain: 0.45 * g, attack: 0.18, color: 'pink' }),
  chime: (t, n, p, g) => [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
    t({ freq: f * p, dur: 1.3, gain: 0.11 * g, delay: i * 0.075 });
    t({ freq: f * p * 2.01, dur: 0.5, gain: 0.025 * g, delay: i * 0.075 });
  }),
  honk: (t, n, p, g) => [0, 0.2].forEach((d) => t({ type: 'sawtooth', freq: 392 * p, to: 330 * p, dur: 0.17, gain: 0.3 * g, delay: d, filter: 'bandpass', freqF: 1000, q: 1.6, vibrato: { rate: 30, depth: 18 } })),
  blip: (t, n, p, g) => t({ type: 'square', freq: 880 * p, dur: 0.06, gain: 0.08 * g }),
  clack: (t, n, p, g) => {
    n({ dur: 0.025, filter: 'bandpass', freq: 1900 * p, q: 3, gain: 0.5 * g, attack: 0.001 });
    t({ type: 'square', freq: 150 * p, dur: 0.02, gain: 0.06 * g });
  },
  sizzle: (t, n, p, g, o) => n({ dur: o.dur ?? 1.2, color: 'crackle', filter: 'highpass', freq: 3200 * p, q: 0.5, gain: 0.22 * g, attack: 0.08 }),
  cheer: (t, n, p, g) => {
    [520, 1150, 2500].forEach((f, i) => n({ dur: 1.8, color: 'pink', filter: 'bandpass', freq: f * p, q: 1.2, gain: [0.5, 0.35, 0.18][i] * g, attack: 0.35 }));
    for (let i = 0; i < 6; i++) t({ type: 'triangle', freq: (420 + Math.random() * 260) * p, to: (800 + Math.random() * 400) * p, dur: 0.45, gain: 0.03 * g, delay: 0.15 + Math.random() * 0.8, vibrato: { rate: 7, depth: 25 } });
  },
  boing: (t, n, p, g) => t({ freq: 160 * p, to: 520 * p, dur: 0.38, gain: 0.3 * g, vibrato: { rate: 18, depth: 40 } }),
  splat: (t, n, p, g) => {
    n({ dur: 0.28, filter: 'lowpass', freq: 1200 * p, to: 180, gain: 0.7 * g, color: 'pink' });
    t({ freq: 170 * p, to: 55, dur: 0.14, gain: 0.4 * g });
  },
  thud: (t, n, p, g) => {
    t({ freq: 95 * p, to: 42, dur: 0.22, gain: 0.7 * g, attack: 0.002 });
    n({ dur: 0.08, filter: 'lowpass', freq: 500, gain: 0.3 * g });
  },
  coin: (t, n, p, g) => {
    t({ type: 'square', freq: 988 * p, dur: 0.08, gain: 0.07 * g });
    t({ type: 'square', freq: 1319 * p, dur: 0.32, gain: 0.07 * g, delay: 0.075 });
  },
  tada: (t, n, p, g) => [523.3, 659.3, 784, 1046.5].forEach((f, i) => t({ type: 'sawtooth', freq: f * p, dur: i === 3 ? 0.9 : 0.16, gain: 0.07 * g, delay: i * 0.09, filter: 'lowpass', freqF: 2600, q: 0.8 })),
};

function makeSfx(bin) {
  const sfx = {
    get on() { return A.on; },
    tone: (o = {}) => tone(o, bin),
    noise: (o = {}) => noise(o, bin),
  };
  for (const [name, fn] of Object.entries(PRESETS)) {
    sfx[name] = (o = {}) => {
      if (!audio()) return;
      const shift = (x) => ({ ...x, delay: (x.delay || 0) + (o.delay || 0), pan: x.pan ?? o.pan });
      return fn((x) => tone(shift(x), bin), (x) => noise(shift(x), bin), o.pitch ?? 1, o.gain ?? 1, o);
    };
  }
  return sfx;
}

// ── the kit ────────────────────────────────────────────────────────────────

// env comes from the engine: { root, kind, id, reduced, pointer, fail, end, score, toast, keys, cursor }
export function makeKit(env) {
  const { root } = env;
  // Disposers, run newest first at unmount. Each one drops out of the set once it's spent (a timer
  // fired, a listener removed, an animation finished), so long-lived scenes don't pile them up.
  const bin = new Set();
  const disposer = (fn) => { const d = () => { bin.delete(d); fn(); }; bin.add(d); return d; };
  // Elements to remove at unmount, held weakly: anything still in the page is reachable and gets
  // removed, anything the scene dropped is garbage collected instead of kept alive here.
  const made = new Set();
  let pruneAt = 256;
  const track = (e) => {
    made.add(new WeakRef(e));
    if (made.size < pruneAt) return;
    for (const r of made) if (!r.deref()) made.delete(r);
    pruneAt = Math.max(256, made.size * 2);
  };
  const styled = new Map(); // element → { prop: [value, priority] } to restore
  const loops = new Set();
  const voices = new Set();
  const canvases = new Set(); // their fit functions, to refit when the DPR cap changes
  let dprCap = DPR_MAX; // the engine lowers this for a background that runs slow (see engine.js)
  let alive = true;

  const guard = (fn) => (...args) => {
    if (!alive) return;
    try { return fn(...args); } catch (err) { env.fail(err); }
  };

  const k = {
    id: env.id,
    kind: env.kind,
    root,
    reduced: env.reduced,
    get alive() { return alive; },
    get vw() { return innerWidth; },
    get vh() { return innerHeight; },
    pointer: env.pointer,

    // DOM
    el(tag = 'div', props = {}, parent = root) {
      const e = tag.startsWith('svg:') ? document.createElementNS('http://www.w3.org/2000/svg', tag.slice(4)) : document.createElement(tag);
      for (const [key, v] of Object.entries(props)) {
        if (v === undefined || v === null) continue;
        if (key === 'class') e.setAttribute('class', v);
        else if (key === 'style') {
          if (typeof v === 'string') e.style.cssText = v;
          else for (const [p, val] of Object.entries(v)) p.startsWith('--') ? e.style.setProperty(p, val) : (e.style[p] = val);
        } else if (key === 'text') e.textContent = v;
        else if (key === 'html') e.innerHTML = v;
        else if (key === 'on') for (const [t, f] of Object.entries(v)) k.on(e, t, f);
        else e.setAttribute(key, v);
      }
      track(e);
      if (parent) parent.append(e);
      return e;
    },
    html(markup, parent = root) {
      const t = document.createElement('template');
      t.innerHTML = markup.trim();
      const e = t.content.firstElementChild;
      track(e);
      if (parent) parent.append(e);
      return e;
    },
    style(el, css) {
      if (!el) return;
      if (!styled.has(el)) styled.set(el, { [HAD_STYLE]: el.hasAttribute('style') });
      const saved = styled.get(el);
      for (const [p, v] of Object.entries(css)) {
        const prop = p.startsWith('--') ? p : p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        if (!(prop in saved)) saved[prop] = [el.style.getPropertyValue(prop), el.style.getPropertyPriority(prop)];
        if (v === null || v === undefined) el.style.removeProperty(prop); else el.style.setProperty(prop, String(v));
      }
    },
    animate(el, frames, opts = {}) {
      const o = typeof opts === 'number' ? { duration: opts } : opts;
      const a = el.animate(frames, env.reduced ? { ...o, duration: 1, delay: 0, iterations: 1 } : o);
      const d = disposer(() => a.cancel());
      // A finished animation with no fill has nothing left to undo. One that holds its end state
      // (fill forwards, say on the Notes panel) is cancelled at unmount, unless the browser replaced it.
      const forget = () => bin.delete(d);
      a.addEventListener('cancel', forget);
      a.addEventListener('remove', forget);
      if (!/forwards|both/.test(o.fill || '')) a.addEventListener('finish', forget);
      return a;
    },

    // events and time
    on(target, type, fn, opts) {
      const h = guard(fn);
      target.addEventListener(type, h, opts);
      return disposer(() => target.removeEventListener(type, h, opts));
    },
    after(ms, fn) {
      const g = guard(fn);
      const id = setTimeout(() => { bin.delete(stop); g(); }, ms);
      const stop = disposer(() => clearTimeout(id));
      return stop;
    },
    every(ms, fn) {
      const id = setInterval(guard(fn), ms);
      return disposer(() => clearInterval(id));
    },
    // Resolves after ms. Never resolves once the scene has unmounted, so `await k.wait()` sequences just stop.
    wait: (ms) => new Promise((res) => k.after(ms, res)),
    loop(fn, { still = 2 } = {}) {
      const L = { raf: 0, last: 0, t: 0, on: false };
      const run = (dt) => { try { fn(dt, L.t); } catch (err) { L.stop(); env.fail(err); } };
      const frame = (ts) => {
        if (!alive || !L.on) return;
        L.raf = requestAnimationFrame(frame);
        const dt = L.last ? Math.min((ts - L.last) / 1000, 0.05) : 1 / 60;
        L.last = ts;
        L.t += dt;
        run(dt);
      };
      L.wake = () => { cancelAnimationFrame(L.raf); L.last = 0; if (L.on && !document.hidden && !env.reduced) L.raf = requestAnimationFrame(frame); };
      L.redraw = () => run(0);
      L.start = () => {
        if (L.on || !alive) return L;
        L.on = true;
        if (env.reduced) { // one settled still frame instead of motion: `still` seconds in a few big steps
          const steps = Math.min(STILL_STEPS, Math.round(still * 60));
          for (let i = 0; i < steps && alive; i++) { L.t += still / steps; run(still / steps); }
          if (!steps) run(0);
          return L;
        }
        L.wake();
        return L;
      };
      L.stop = () => { L.on = false; cancelAnimationFrame(L.raf); return L; };
      loops.add(L);
      return L.start();
    },
    tween(ms, fn, e = ease.outCubic) {
      return new Promise((res) => {
        if (env.reduced || ms <= 0) { guard(fn)(1); res(); return; }
        const t0 = now();
        const L = k.loop(() => {
          const p = clamp((now() - t0) / ms);
          fn(e(p), p);
          if (p >= 1) { L.stop(); loops.delete(L); res(); }
        });
      });
    },

    // canvas: full layer by default, auto-resized, DPR capped. Draw in CSS pixels.
    canvas({ parent = root, dpr = 2, w, h, alpha = true, style = '' } = {}) {
      const fixed = w !== undefined && h !== undefined;
      const el = k.el('canvas', { style: fixed ? style : `position:absolute;inset:0;width:100%;height:100%;${style}` }, parent);
      const c = el.getContext('2d', { alpha });
      const cv = { el, ctx: c, w: 0, h: 0, dpr: 1, resized: null };
      const fitTo = () => {
        const r = Math.min(window.devicePixelRatio || 1, dpr, dprCap);
        const W = fixed ? w : innerWidth, H = fixed ? h : innerHeight;
        if (W === cv.w && H === cv.h && r === cv.dpr) return;
        // Only the DPR changed (zoom, or the engine's watchdog): carry the picture over, so a layer
        // drawn once doesn't go blank or flash before `resized` repaints it.
        let snap = null;
        if (W === cv.w && H === cv.h && el.width > 1) {
          snap = document.createElement('canvas');
          snap.width = el.width;
          snap.height = el.height;
          snap.getContext('2d').drawImage(el, 0, 0);
        }
        Object.assign(cv, { w: W, h: H, dpr: r });
        el.width = Math.max(1, Math.round(W * r));
        el.height = Math.max(1, Math.round(H * r));
        if (fixed) Object.assign(el.style, { width: `${W}px`, height: `${H}px` });
        if (snap) c.drawImage(snap, 0, 0, el.width, el.height);
        c.setTransform(r, 0, 0, r, 0, 0);
        if (cv.resized) guard(cv.resized)(W, H, { dprOnly: !!snap });
        if (env.reduced) for (const L of loops) if (L.on) L.redraw();
      };
      fitTo.cv = cv;
      fitTo();
      canvases.add(fitTo);
      if (!fixed) k.on(window, 'resize', fitTo);
      return cv;
    },

    // particles: confetti, sparks, shards… drawn on a canvas made on first use, on top of the scene
    burst(x, y, o = {}) {
      if (env.reduced) return;
      fx ||= makeFx();
      fx.add(x, y, o);
    },

    // text
    plain,
    font,
    fit,
    ellipsize,
    wrap,
    clip,
    canRender,

    // maths and randomness
    ...rng(),
    rng,
    hash,
    ease,
    clamp,
    lerp,

    // sound
    sfx: makeSfx(voices),

    // the grill UI
    ui: {
      card: () => $('#stack .card.front'),
      answer: () => $('#stack .card.front textarea'),
      options: () => $$('#stack .card.front .opt').map((el) => ({
        el, label: plain(el.dataset.label), recommended: el.classList.contains('rec'), selected: el.classList.contains('sel'), rect: el.getBoundingClientRect(),
      })),
      rows: () => $$('#decisions .row:not(.pending)').map((el) => ({
        el, id: el.dataset.id, title: $('.row-title', el)?.textContent || '', decided: el.classList.contains('decided'), current: el.classList.contains('current'), rect: el.getBoundingClientRect(),
      })),
      side: () => $('aside.side'),
      notes: () => $('aside.notes'),
      stage: () => $('#stage'),
    },
    rect(el) {
      if (!el || !el.isConnected) return null;
      const r = el.getBoundingClientRect();
      return r.width && r.height && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight ? r : null;
    },
    // Where the scene is actually visible: the stage minus the card stack, as gaps sorted biggest
    // first. `stack` is the front card plus the queued cards peeking out above it.
    space() {
      const vw = innerWidth, vh = innerHeight;
      const stage = k.rect(k.ui.stage()) || new DOMRect(0, 0, vw, vh);
      const c = k.rect(k.ui.card());
      let top = c?.top;
      if (c) for (const g of $$('#stack .ghost.on')) { const r = k.rect(g); if (r) top = Math.min(top, r.top); }
      const stack = c && new DOMRect(c.left, top, c.width, c.bottom - top);
      const cardTop = c && Math.min(c.top - 30, top - 12);
      const card = c && new DOMRect(c.left - 16, cardTop, c.width + 32, c.bottom + 16 - cardTop);
      const gaps = [];
      const add = (where, x, y, w, h) => { if (w > 8 && h > 8) gaps.push({ where, x, y, w, h }); };
      if (card) {
        const top = Math.max(stage.top, Math.min(card.top, stage.bottom));
        const bottom = Math.min(stage.bottom, Math.max(card.bottom, stage.top));
        add('top', stage.left, stage.top, stage.width, top - stage.top);
        add('bottom', stage.left, bottom, stage.width, stage.bottom - bottom);
        add('left', stage.left, stage.top, card.left - stage.left, stage.height);
        add('right', card.right, stage.top, stage.right - card.right, stage.height);
      } else add('all', stage.left, stage.top, stage.width, stage.height);
      gaps.sort((a, b) => b.w * b.h - a.w * a.h);
      return { vw, vh, stage, card: c, stack, side: k.rect(k.ui.side()), notes: k.rect(k.ui.notes()), hud: k.rect($('.fun-hud.on')), gaps };
    },

    // input
    cursor(value) {
      env.cursor(value);
      cursorSet = value != null;
    },
    // Call from a pointerdown you handled (a hit) so the UI underneath doesn't also get the click.
    consume(e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const kill = (ev) => { ev.preventDefault(); ev.stopImmediatePropagation(); };
      let offs = [];
      const done = () => { offs.forEach((f) => f()); offs = []; };
      offs.push(k.on(window, 'click', () => setTimeout(done), { capture: true }));
      offs = offs.concat(['mousedown', 'mouseup', 'click', 'dblclick', 'pointerup'].map((t) => k.on(window, t, kill, { capture: true })));
      k.after(600, done);
    },
    keySafe: () => env.keys.safe(),
    grabKeys(onKey, opts = {}) { return env.keys.grab(guard(onKey), { ...opts, onLost: opts.onLost && guard(opts.onLost) }); },
    releaseKeys: () => env.keys.release(true), // only ever your own grab

    // scores, toasts, storage, ending
    score: (key, by = 1, meta = {}) => env.score(key, by, meta),
    toast: (text, opts = {}) => env.toast(text, opts),
    // A stored value of a different type from `fallback` (hand-edited, or from an older version of
    // the scene) comes back as `fallback`.
    load(key, fallback) {
      try {
        const v = localStorage.getItem(`grill:fun:${env.kind}:${env.id}:${key}`);
        if (v === null) return fallback;
        const x = JSON.parse(v);
        const kind = (y) => (y === null ? 'null' : Array.isArray(y) ? 'array' : typeof y);
        return fallback == null || kind(x) === kind(fallback) ? x : fallback;
      } catch { return fallback; }
    },
    save(key, value) {
      try { localStorage.setItem(`grill:fun:${env.kind}:${env.id}:${key}`, JSON.stringify(value)); } catch {}
    },
    end: () => env.end(),
    // Under reduced motion: draw a fresh still frame soon (a dt = 0 frame of every running loop, at
    // most one per animation frame). The engine already asks for one after every hook but keystroke().
    redraw() {
      if (!env.reduced || redrawRaf || !alive) return;
      redrawRaf = requestAnimationFrame(() => { redrawRaf = 0; if (alive) k._redraw(); });
    },
  };
  let cursorSet = false;
  let redrawRaf = 0;
  let fx = null;

  function makeFx() {
    const cv = k.canvas();
    const c = cv.ctx;
    const ps = [];
    let L = null;
    const shard = (n = 3 + ((Math.random() * 2) | 0)) => Array.from({ length: n }, (_, i) => {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.8;
      const r = 0.45 + Math.random() * 0.55;
      return [Math.cos(ang) * r, Math.sin(ang) * r];
    });
    const draw = (dt) => {
      c.clearRect(0, 0, cv.w, cv.h);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.age += dt;
        if (p.age >= p.life) { ps.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        p.vx *= 1 - p.drag * dt;
        p.vy *= 1 - p.drag * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        const life = p.age / p.life;
        c.save();
        c.globalAlpha = p.fade ? Math.min(1, (1 - life) * 2.2) : 1;
        c.translate(p.x, p.y);
        if (p.shape === 'spark') {
          c.rotate(Math.atan2(p.vy, p.vx));
          c.fillStyle = p.color;
          const len = Math.min(28, Math.hypot(p.vx, p.vy) * 0.035 + 2) * p.size / 3;
          c.fillRect(-len, -p.size / 4, len, p.size / 2);
        } else {
          c.rotate(p.rot);
          const flip = Math.cos(p.age * p.flip + p.phase);
          if (p.shape === 'confetti') {
            c.scale(1, flip);
            c.fillStyle = p.color;
            c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          } else if (p.shape === 'shard') {
            c.scale(flip, 1);
            c.fillStyle = p.color;
            c.beginPath();
            p.pts.forEach(([px, py], j) => (j ? c.lineTo(px * p.size, py * p.size) : c.moveTo(px * p.size, py * p.size)));
            c.fill();
            if (flip < 0) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fill(); }
          } else if (p.shape === 'star') {
            c.fillStyle = p.color;
            c.beginPath();
            for (let j = 0; j < 10; j++) {
              const r = j % 2 ? p.size * 0.42 : p.size;
              c.lineTo(Math.cos((j * Math.PI) / 5 - Math.PI / 2) * r, Math.sin((j * Math.PI) / 5 - Math.PI / 2) * r);
            }
            c.fill();
          } else if (p.shape === 'dot') {
            c.fillStyle = p.color;
            c.beginPath();
            c.arc(0, 0, p.size * (p.grow ? 0.4 + life * 1.2 : 0.5), 0, Math.PI * 2);
            c.fill();
          } else { // any other string: a glyph or emoji
            c.font = font(p.size * 2, 400, 'emoji');
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(p.shape, 0, 0);
          }
        }
        c.restore();
      }
      if (!ps.length) L.stop();
    };
    return {
      add(x, y, o) {
        const n = o.n ?? 24;
        const colors = o.colors || ['#ff5e5b', '#ffd23f', '#3bceac', '#4d9de0', '#e15fed', '#ffffff'];
        const spread = o.spread ?? Math.PI * 2;
        const angle = o.angle ?? -Math.PI / 2;
        const shape = o.shape || 'confetti';
        for (let i = 0; i < n; i++) {
          const a = angle + (Math.random() - 0.5) * spread;
          const v = (o.speed ?? 420) * (0.35 + Math.random() * 0.65);
          ps.push({
            x: x + (Math.random() - 0.5) * (o.jitter ?? 0), y: y + (Math.random() - 0.5) * (o.jitter ?? 0),
            vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            gravity: o.gravity ?? 900, drag: o.drag ?? 1.2,
            rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * (o.spin ?? 14),
            flip: 6 + Math.random() * 10, phase: Math.random() * 6.28,
            size: (o.size ?? 8) * (0.6 + Math.random() * 0.8),
            color: colors[(Math.random() * colors.length) | 0],
            life: (o.life ?? 1.6) * (0.6 + Math.random() * 0.4), age: 0, fade: o.fade !== false,
            shape: shape === 'mix' ? ['confetti', 'star', 'dot'][i % 3] : shape, pts: shape === 'shard' ? shard() : null, grow: o.grow,
          });
        }
        if (!L) L = k.loop(draw);
        else if (!L.on) L.start();
      },
    };
  }

  // keep: leave the root's last frame on screen (no longer live) so the engine can crossfade it out
  k._destroy = (keep = false) => {
    if (!alive) return;
    alive = false;
    cancelAnimationFrame(redrawRaf);
    for (const L of loops) L.stop();
    for (const v of voices) v.stop(0.03);
    for (const d of [...bin].reverse()) { try { d(); } catch {} }
    for (const [el, saved] of styled) {
      for (const [prop, [v, prio]] of Object.entries(saved)) v ? el.style.setProperty(prop, v, prio) : el.style.removeProperty(prop);
      if (!el.style.length && !saved[HAD_STYLE]) el.removeAttribute('style');
    }
    for (const r of made) { const e = r.deref(); if (e && (!keep || !root.contains(e))) e.remove(); }
    made.clear();
    canvases.clear();
    if (cursorSet) env.cursor(null);
    env.keys.release(true);
    if (!keep) root.remove();
  };
  k._wake = () => { for (const L of loops) if (L.on) L.wake(); };
  k._redraw = () => { for (const L of loops) if (L.on) L.redraw(); };
  // The engine's frame-time watchdog: cap every canvas's DPR (refits them, which calls `resized`),
  // and read the highest DPR any of them is drawing at now.
  k._dpr = (cap) => { dprCap = Math.min(DPR_MAX, cap); if (alive) for (const fit of canvases) fit(); };
  k._dprNow = () => Math.max(0, ...[...canvases].map((fit) => fit.cv.dpr));
  return k;
}
