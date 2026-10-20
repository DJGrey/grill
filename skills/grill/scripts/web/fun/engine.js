// Fun mode: backgrounds behind the grill UI and little games on top of it.
// app.js imports this only once fun mode is switched on, so with it off none of fun/ loads or runs.
// Scenes live in bg/<id>.js and game/<id>.js. The contract for writing one is in README.md.

import { scenes, byId } from './registry.js';
import { makeKit, setSound, syncAudio, audioState, rng, plain } from './kit.js';

const $ = (s, r = document) => r.querySelector(s);
const R = rng();
const reducedMQ = matchMedia('(prefers-reduced-motion: reduce)');
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const KEY = { fun: 'grill:fun', sound: 'grill:fun:sound', bag: (k) => `grill:fun:bag:${k}`, stats: (slug) => `grill:fun:stats:${slug || '_'}` };
// Anything read back is checked with `ok`: a value of the wrong shape (edited by hand, left by an
// older version) is treated as missing.
const store = {
  get(k, fallback, ok = () => true) {
    try { const v = localStorage.getItem(k); const x = v === null ? fallback : JSON.parse(v); return ok(x) ? x : fallback; } catch { return fallback; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isTrue = (v) => v === true;
const now = () => performance.now();
const IDLE_GAME_S = 20; // a random game may start after this long on a card without typing
const WAIT_GAME_S = 3; // …or this long on the "agent working" card
const EAGER_GAME_S = 4; // …or this long on a card, when the game has waited a card already
const GAME_ODDS = 0.2; // chance a new card rolls a random game. The third card without one always does.
const ANSWER_HOLD = 1200; // ms the old background keeps after you answer, to react before the swap
const SLOW_MS = 1000 / 45; // a background averaging slower frames than this…
const SLOW_WINDOW = 3000; // …over this long gets its canvas DPR stepped down (2 → 1.5 → 1)
const DPR_STEPS = [1.5, 1];

let host; // app.js internals: { S, derive, focusAnswer }
let on = false;
let want = false; // what fun mode was last asked to be: a toggle during startup flips this, not `on`
let ready;
let forced = null; // from ?fun=bg:<id>,game:<id>
let available = null; // { bg: Set, game: Set } of files that exist, from the server
const missing = new Set();
const mods = new Map();
let L = null; // layers while on
let epoch = 0; // bumped on every enable and disable, so a mount that finishes late knows it's stale
const offs = [];
let soundOn = store.get(KEY.sound, false, isTrue);

let bg = null; // the mounted background
let bgFor = null; // question id it was picked for
let bgToken = 0;
const games = new Map(); // id → mounted game (null while loading)

const T = { answeredAt: -1e9, swapTimer: 0, cardSince: now(), lastKey: now() - 60e3, typing: false, typingTimer: 0, frontId: null, qSig: '', decSig: null, notes: null, lastGame: null, layoutTimer: 0, unsettled: 0, settle: 0 };
const sched = { armed: false, carried: false, dry: 0, quiet: false, block: 0, idleRolled: false, tick: 0 };
const pointer = { x: -1, y: -1, down: false, active: false, at: 0 };
const touch = { y: 0, v: 0, at: 0, raf: 0 };
let stats = { n: {}, meta: {} };
let statsKey = null;

// ── what scenes see ────────────────────────────────────────────────────────

const ctx = {
  front: 'waiting', // 'question' | 'waiting' | 'done'
  question: null,
  doc: { title: '', slug: '', summary: '' },
  decisions: [],
  answers: [],
  lastAnswer: null,
  notes: 0,
  agent: 'working', // 'working' | 'listening' | 'done' | 'offline'
  progress: { answered: 0, total: 0, ratio: 0 },
  recRate: null,
  stats: stats.n,
  forced: false,
  get cardTime() { return (now() - T.cardSince) / 1000; },
  get typing() { return T.typing; },
  get idle() { return (now() - T.lastKey) / 1000; },
  get answerEmpty() { return !$('#stack .card.front textarea')?.value.trim(); },
  get reduced() { return reducedMQ.matches; },
  get dark() { return darkMQ.matches; },
  get sound() { return soundOn; },
};

const plainBlock = (md = '') => plain(md
  .replace(/(```|~~~)[\s\S]*?\1/g, ' ')
  .split('\n')
  .filter((l) => !/^\s*\|/.test(l) && !/^\s*>\s*\[!/.test(l))
  .map((l) => l.replace(/^\s*(#+|[-*+]|\d+[.)]|>)\s*/, ''))
  .join(' '));
const picksOf = (a) => (a ? (a.choices?.length ? a.choices : a.choice ? [a.choice] : []) : []);

// ── boot, on and off ───────────────────────────────────────────────────────

export function boot(h) {
  host = h;
  // ?fun=1 turns fun mode on for this page load. ?fun=bg:<id>,game:<id> also pins those scenes
  // and stops the scheduler, for testing. &loop=0 stops a forced game from restarting.
  const p = new URLSearchParams(location.search);
  const param = p.get('fun'); // ?fun=0 keeps it off for this load, whatever was saved
  const urlOn = param !== null && param !== '0';
  for (const part of (p.get('fun') || '').split(',')) {
    const [kind, id] = part.split(':');
    if ((kind === 'bg' || kind === 'game') && id) (forced ||= { loop: p.get('loop') !== '0' })[kind] = id;
  }
  ctx.forced = !!forced;
  ready = fetch('/api/fun').then((r) => (r.ok ? r.json() : null)).then((j) => {
    const names = (a) => new Set(Array.isArray(a) ? a.filter((x) => typeof x === 'string') : []);
    if (isObj(j)) available = { bg: names(j.bg), game: names(j.game) };
  }).catch(() => {});
  const sound = $('#fun-sound');
  sound?.addEventListener('click', () => setSoundPref(!soundOn));
  sound?.setAttribute('aria-pressed', soundOn);
  window.__fun = debug;
  if (urlOn || (param !== '0' && store.get(KEY.fun, false, isTrue))) set(true, { persist: false });
  return { set, toggle: () => set(!want), render: sync, answered };
}

// Calls that overlap (a toggle while it's still starting up) settle on the last one asked for.
async function set(next, { persist = true } = {}) {
  want = next;
  if (persist) store.set(KEY.fun, next);
  await Promise.all([ready, next && styles(true)]);
  if (want !== next || next === on) {
    if (!on && !want) styles(false);
    return;
  }
  try {
    next ? enable() : disable();
  } catch (err) { console.warn(`[fun] switching ${next ? 'on' : 'off'} threw:`, err); }
}

// fun.css is only in the page while fun mode is on.
const sheet = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('./fun.css', import.meta.url).href });
let sheetLoaded = null;
function styles(add) {
  if (!add) { sheet.remove(); sheetLoaded = null; return null; }
  if (!sheet.isConnected) {
    sheetLoaded = new Promise((res) => { sheet.onload = sheet.onerror = res; });
    document.head.append(sheet);
  }
  return sheetLoaded;
}

function enable() {
  on = true;
  epoch++;
  document.body.classList.add('fun');
  $('#fun-toggle')?.setAttribute('aria-checked', 'true');
  const div = (cls, parent = document.body) => parent.appendChild(Object.assign(document.createElement('div'), { className: cls }));
  L = { bg: div('fun-layer fun-bg-layer'), games: div('fun-layer fun-game-layer'), hud: div('fun-hud'), toasts: div('fun-toasts') };
  document.body.prepend(L.bg);
  // The stage lets the pointer through to the background, so scrolling it needs a hand: the wheel and
  // touch drags over the background scroll it, and its scrollbar takes the pointer back while hovered.
  listen(L.bg, 'wheel', (e) => $('#stage')?.scrollBy({ top: e.deltaY * (e.deltaMode === 1 ? 16 : 1) }), { passive: true });
  listen(L.bg, 'touchstart', onTouch, { passive: true });
  listen(L.bg, 'touchmove', onTouch, { passive: true });
  listen(L.bg, 'touchend', onTouch, { passive: true });
  listen(window, 'pointermove', scrollbarHover, { passive: true });
  listen(L.bg, 'pointerdown', () => document.body.classList.remove('notes-open'));
  // Clicking a scene or a game never takes focus away from the answer box.
  for (const layer of [L.bg, L.games]) listen(layer, 'mousedown', (e) => e.preventDefault());
  listen(window, 'pointermove', (e) => Object.assign(pointer, { x: e.clientX, y: e.clientY, active: true, at: now() }), { passive: true, capture: true });
  listen(window, 'pointerdown', (e) => Object.assign(pointer, { x: e.clientX, y: e.clientY, down: true, active: true }), { passive: true, capture: true });
  listen(window, 'pointerup', () => { pointer.down = false; }, { passive: true, capture: true });
  listen(window, 'keydown', onKey, { capture: true });
  listen(document, 'focusin', (e) => { if (K.owner && isField(e.target)) loseKeys(); });
  listen(document, 'input', onInput, { capture: true });
  listen(document, 'visibilitychange', () => {
    syncAudio(); // no sound from a hidden tab
    if (!document.hidden) everyScene((s) => s.kit._wake());
    watch();
  });
  listen(reducedMQ, 'change', () => { if (bg) setBg(bg.id, bgFor); });
  // layout(): the card moved or changed size (new card, scroll, window resize), debounced. And once
  // more when the card stack stops animating (see settle()).
  const relayout = () => { clearTimeout(T.layoutTimer); T.layoutTimer = setTimeout(layoutNow, 120); };
  listen(window, 'resize', relayout);
  listen($('#stage'), 'scroll', relayout, { passive: true });
  const ro = new ResizeObserver(relayout);
  ro.observe($('#stack'));
  offs.push(() => { ro.disconnect(); clearTimeout(T.layoutTimer); T.unsettled = 0; cancelAnimationFrame(touch.raf); document.body.classList.remove('fun-scrollbar'); });
  setSound(soundOn);
  T.frontId = null;
  T.qSig = '';
  T.decSig = null;
  T.notes = null;
  sync('enable');
  measureBar();
  if (forced?.bg) setBg(forced.bg);
  else if (!forced) setBg(pickBg(), T.frontId);
  if (forced?.game) play(forced.game);
  if (!forced) for (const s of scenes) if (s.trigger === 'always') play(s.id);
  if (!forced) {
    newCard(ctx.front === 'waiting');
    sched.tick = setInterval(schedTick, 1000);
  }
  hud();
}

function disable() {
  on = false;
  epoch++;
  bgToken++;
  watch();
  clearInterval(sched.tick);
  clearTimeout(T.swapTimer);
  for (const s of games.values()) if (s) { clearTimeout(s.cap); destroy(s); }
  games.clear();
  if (bg) destroy(bg);
  bg = null;
  bgFor = null;
  while (offs.length) offs.pop()();
  clearTimeout(T.typingTimer);
  releaseKeys();
  setCursor(null, null, true);
  for (const el of Object.values(L || {})) el.remove();
  L = null;
  $('.fun-done')?.remove();
  setSound(false);
  document.body.classList.remove('fun');
  if (!document.body.classList.length) document.body.removeAttribute('class');
  $('#fun-toggle')?.setAttribute('aria-checked', 'false');
  styles(false);
}

function listen(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  offs.push(() => target.removeEventListener(type, fn, opts));
}

function setSoundPref(v) {
  soundOn = v;
  store.set(KEY.sound, v);
  $('#fun-sound')?.setAttribute('aria-pressed', v);
  if (on) setSound(v);
  broadcast('sound', v);
  if (v && on) toast('Sound on');
}

// ── following the app ──────────────────────────────────────────────────────

function sync(reason = 'sync', D = host.derive()) {
  if (!on) return;
  const { S } = host;
  if (S.doc && KEY.stats(S.doc.slug) !== statsKey) loadStats(S.doc.slug);
  ctx.doc = { title: plain(S.doc?.title || ''), slug: S.doc?.slug || '', summary: plain(S.doc?.summary || '') };

  ctx.answers = D.qs.filter((q) => D.answers.has(q.id)).map((q) => {
    const a = D.answers.get(q.id);
    const picks = picksOf(a);
    const recs = q.options.filter((o) => o.recommended).map((o) => o.label);
    return { id: q.id, title: plain(q.title), picks: picks.map(plain), custom: a.custom || '', tookRec: picks.some((p) => recs.includes(p)), hasRec: recs.length > 0, revision: !!a.revision, at: a.at };
  });
  const rated = ctx.answers.filter((a) => a.hasRec);
  ctx.recRate = rated.length ? rated.filter((a) => a.tookRec).length / rated.length : null;
  ctx.progress = { answered: ctx.answers.length, total: D.qs.length, ratio: D.qs.length ? ctx.answers.length / D.qs.length : 0 };

  const decSig = JSON.stringify(D.decisions);
  if (decSig !== T.decSig) {
    const first = T.decSig === null;
    T.decSig = decSig;
    ctx.decisions = D.decisions.map((d) => ({ n: d.n, text: plain(d.text), id: d.id }));
    if (!first) broadcast('decisions');
  }
  if (T.notes !== null && D.notes.length > T.notes) { bump('notes', D.notes.length - T.notes); broadcast('event', 'note', { count: D.notes.length }); }
  T.notes = D.notes.length;
  ctx.notes = D.notes.length;

  const agent = S.offline ? 'offline' : D.done ? 'done' : S.listening ? 'listening' : 'working';
  if (agent !== ctx.agent) { ctx.agent = agent; broadcast('status'); }

  const q = D.qs.find((x) => x.id === D.frontId);
  const front = q ? 'question' : D.frontId === '__done' ? 'done' : 'waiting';
  const question = q && {
    id: q.id,
    title: plain(q.title),
    tag: q.tag,
    n: D.qs.indexOf(q) + 1,
    total: D.qs.length,
    multi: q.multi,
    revising: D.answers.has(q.id),
    context: plainBlock(q.context).slice(0, 600),
    options: q.options.map((o) => ({ label: plain(o.label), description: plain(o.description), recommended: o.recommended })),
    recommended: q.options.filter((o) => o.recommended).map((o) => plain(o.label)),
  };
  const frontChanged = D.frontId !== T.frontId;
  if (frontChanged) { T.frontId = D.frontId; T.cardSince = now(); }
  const qSig = JSON.stringify([front, question]);
  if (qSig !== T.qSig) {
    T.qSig = qSig;
    ctx.front = front;
    ctx.question = question;
    // A new question on the front card gets a new background. Revisiting one doesn't. Right after
    // an answer the old background gets a moment to react to it first, and no more hooks.
    const moved = frontChanged && !['pin', 'unpin', 'enable'].includes(reason);
    if (moved && q && q.id !== bgFor) {
      newCard();
      if (!forced) {
        bgFor = q.id;
        if (bg) bg.leaving = true;
        clearTimeout(T.swapTimer);
        T.swapTimer = setTimeout(() => setBg(pickBg(), q.id), Math.max(0, T.answeredAt + ANSWER_HOLD - now()));
      }
    } else if (moved && front === 'waiting') newCard(true);
    broadcast('question');
  }
  if (reason === 'pin' || reason === 'unpin') broadcast('event', reason, { id: T.frontId });
  doneCard();
  settle();
}

function layoutNow() {
  clearTimeout(T.layoutTimer);
  measureBar();
  broadcast('layout');
}

// ── scrolling the stage ────────────────────────────────────────────────────

// Where the stage's scrollbar is (or would be: overlay scrollbars take no width), if it scrolls.
function measureBar() {
  const st = $('#stage');
  const r = st?.getBoundingClientRect();
  T.bar = st && st.scrollHeight > st.clientHeight ? { left: r.right - Math.max(14, st.offsetWidth - st.clientWidth), right: r.right, top: r.top, bottom: r.bottom } : null;
}

// Hovering the scrollbar gives the stage the pointer back, so you can drag it (kept while you do).
function scrollbarHover(e) {
  if (e.pointerType !== 'mouse' || e.buttons) return;
  const b = T.bar;
  document.body.classList.toggle('fun-scrollbar', !!b && e.clientX >= b.left && e.clientX < b.right && e.clientY >= b.top && e.clientY < b.bottom);
}

// Touch drags on the background scroll the stage, and glide on a little after you let go. A scene
// that wants a drag for itself calls preventDefault() on the touchmove.
function onTouch(e) {
  const st = $('#stage');
  cancelAnimationFrame(touch.raf);
  if (!st || e.defaultPrevented || e.touches.length > 1) return;
  const t = now();
  if (e.type === 'touchstart') { Object.assign(touch, { y: e.touches[0].clientY, v: 0, at: t }); return; }
  if (e.type === 'touchmove') {
    const y = e.touches[0].clientY;
    st.scrollBy(0, touch.y - y);
    Object.assign(touch, { v: (touch.y - y) / Math.max(1, t - touch.at), y, at: t }); // px per ms
    return;
  }
  if (e.touches.length || ctx.reduced || t - touch.at > 100 || Math.abs(touch.v) < 0.05) return;
  let last = t;
  const glide = () => {
    const n = now();
    touch.v *= 0.95 ** ((n - last) / 16.7);
    st.scrollBy(0, touch.v * (n - last));
    last = n;
    if (Math.abs(touch.v) > 0.02) touch.raf = requestAnimationFrame(glide);
  };
  touch.raf = requestAnimationFrame(glide);
}

// The new card slides in (and the queued cards peeking above it shift) after question() has already
// gone out, without resizing anything. So when the stack is animating, wait for it to stop, then
// send layout() once more.
function settle() {
  const stack = $('#stack');
  if (!on || !stack) return;
  const token = ++T.settle;
  const busy = [...stack.children]
    .flatMap((el) => [el, el.firstElementChild, el.querySelector(':scope > .card-inner > .q-body')])
    .filter(Boolean)
    .flatMap((el) => el.getAnimations())
    .filter((a) => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime));
  if (!busy.length || (T.unsettled && now() - T.unsettled > 3000)) {
    if (T.unsettled) { T.unsettled = 0; layoutNow(); }
    return;
  }
  T.unsettled ||= now();
  Promise.race([Promise.all(busy.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 1500))])
    .then(() => token === T.settle && settle());
}

// ── scenes ─────────────────────────────────────────────────────────────────

function load(kind, id) {
  const key = `${kind}/${id}`;
  if (missing.has(key) || (available && !available[kind].has(id)) || !byId.has(`${kind}:${id}`)) return Promise.resolve(null);
  if (!mods.has(key)) {
    mods.set(key, import(`./${key}.js`).then((m) => {
      if (typeof m.default !== 'function') throw new Error('default export must be a function (k, ctx) => hooks');
      return m.default;
    }).catch((err) => {
      missing.add(key);
      console.warn(`[fun] skipped ${key}:`, err);
      return null;
    }));
  }
  return mods.get(key);
}

async function mount(kind, id) {
  const ep = epoch;
  const fn = await load(kind, id);
  if (!fn || !on || ep !== epoch) return null;
  const root = Object.assign(document.createElement('div'), { className: `fun-scene fun-${kind}` });
  root.dataset.scene = id;
  (kind === 'bg' ? L.bg : L.games).append(root);
  const s = { id, kind, root, hooks: {}, dead: false, meta: byId.get(`${kind}:${id}`) };
  s.kit = makeKit({
    root, kind, id, pointer,
    reduced: reducedMQ.matches,
    fail: (err) => fail(s, err),
    end: () => kind === 'game' && endGame(s),
    score: bump,
    toast,
    keys: {
      safe: keySafe,
      grab: (fn, o) => grabKeys(s, fn, o),
      release: (onlyMine) => (!onlyMine || K.owner === s) && releaseKeys(),
    },
    cursor: (v) => setCursor(s, v),
  });
  if (kind === 'bg' && dprCaps.has(id)) s.kit._dpr(dprCaps.get(id));
  try {
    s.hooks = (await fn(s.kit, ctx)) || {};
  } catch (err) {
    fail(s, err);
  }
  if (s.dead || !on || ep !== epoch) { destroy(s); return null; }
  return s;
}

function destroy(s, keepFrame) {
  if (!s || s.dead) return;
  s.dead = true;
  try { s.hooks.unmount?.(); } catch (err) { console.warn(`[fun] ${s.kind}/${s.id} unmount threw:`, err); }
  s.kit._destroy(keepFrame);
}

function fail(s, err) {
  console.warn(`[fun] ${s.kind}/${s.id} threw, so it was removed:`, err);
  if (bg === s) bg = null;
  if (games.get(s.id) === s) endGame(s);
  destroy(s);
}

function everyScene(fn) {
  if (bg) fn(bg);
  for (const s of games.values()) if (s) fn(s);
}

// broadcast('answer', a) calls hooks.answer(a) on every mounted scene. A trailing { except } skips one.
function broadcast(hook, ...args) {
  const last = args.at(-1);
  const except = last && typeof last === 'object' && 'except' in last ? (args.pop(), last.except) : null;
  everyScene((s) => {
    if (s === except || s.dead || s.leaving || typeof s.hooks[hook] !== 'function') return;
    try {
      s.hooks[hook](...args);
    } catch (err) { fail(s, err); return; }
    // Reduced motion: a fresh still frame after a change, at most one a frame. Not for keystrokes:
    // a scene that shows those calls k.redraw() itself.
    if (s.kit.reduced && hook !== 'keystroke') s.kit.redraw();
  });
}

// ── backgrounds ────────────────────────────────────────────────────────────

const ids = (kind, filter = () => true) => scenes.filter((s) => s.kind === kind && filter(s)).map((s) => s.id)
  .filter((id) => !missing.has(`${kind}/${id}`) && (!available || available[kind].has(id)));

// Shuffled bags in localStorage: you see every scene once before any repeats. When nothing left in
// the bag fits right now, the next round is dealt behind the leftovers, so they still come first.
function draw(kind, pool, ok = () => true) {
  if (!pool.length) return null;
  let bag = [...new Set(store.get(KEY.bag(kind), [], Array.isArray))].filter((id) => pool.includes(id));
  let i = bag.findIndex(ok);
  if (i < 0) {
    bag = [...bag, ...R.shuffle(pool.filter((id) => !bag.includes(id)))];
    i = bag.findIndex(ok);
  }
  const [id = null] = i >= 0 ? bag.splice(i, 1) : [];
  store.set(KEY.bag(kind), bag);
  return id;
}

const pickBg = (not = bg?.id) => { const pool = ids('bg'); return draw('bg', pool, (id) => pool.length < 2 || id !== not); };

// The old scene is unmounted straight away, but its last frame stays on screen while the new one
// fades in over it. So it's a crossfade with only one live scene.
async function setBg(id, forQuestion = null) {
  const token = ++bgToken;
  bgFor = forQuestion;
  const old = bg;
  bg = null;
  watch();
  let frozen = null;
  if (old) {
    destroy(old, !ctx.reduced);
    if (!ctx.reduced) {
      frozen = old.root;
      frozen.style.pointerEvents = 'none';
    }
  }
  const drop = (fade) => {
    if (!frozen) return;
    const f = frozen;
    frozen = null;
    if (!fade) { f.remove(); return; }
    f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.finally(() => f.remove());
  };
  for (let tries = 0; id && tries < 6 && token === bgToken && on; tries++) {
    const s = await mount('bg', id);
    if (token !== bgToken || !on) { destroy(s); drop(false); return; }
    if (s) {
      bg = s;
      watch();
      if (ctx.reduced) return drop(false);
      s.root.animate([{ opacity: 0, transform: 'scale(1.02)' }, { opacity: 1, transform: 'none' }], { duration: 750, easing: 'cubic-bezier(.33,0,.2,1)' })
        .finished.finally(() => drop(false));
      return;
    }
    id = forced ? null : pickBg(old?.id); // that one didn't load: try the next in the bag
  }
  drop(true);
}

// ── games ──────────────────────────────────────────────────────────────────

async function play(id) {
  const meta = byId.get(`game:${id}`);
  if (!on || !meta || games.has(id)) return false;
  const ep = epoch;
  games.set(id, null);
  const s = await mount('game', id);
  if (ep !== epoch) { destroy(s); return false; } // fun mode went off (and maybe on again) meanwhile
  if (!s) { games.delete(id); return false; }
  games.set(id, s);
  if (meta.trigger === 'random') T.lastGame = id;
  if (meta.trigger !== 'always') {
    bump('games');
    broadcast('event', 'game', { id, phase: 'start' }, { except: s });
    if (!meta.passive && !forced) s.cap = setTimeout(() => endGame(s), Math.max(20000, (meta.ms || 8000) * 3));
  }
  return true;
}

function endGame(s, how) {
  if (!s || s.ended) return;
  s.ended = true;
  clearTimeout(s.cap);
  if (games.get(s.id) === s) games.delete(s.id);
  if (K.owner === s) releaseKeys();
  if (how === 'esc' && !s.dead && !ctx.reduced) {
    s.dead = true; // stop hooks now, clean up after a quick fade
    s.root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).finished.finally(() => { s.dead = false; destroy(s); });
  } else destroy(s);
  broadcast('event', 'game', { id: s.id, phase: 'end' });
  if (on && forced?.game === s.id && forced.loop && how !== 'esc') {
    setTimeout(() => on && !games.has(s.id) && play(s.id), 1500);
  }
}

// Random games: about one card in four, never on two cards running, and always by the third card
// without one. A card rolls when it arrives (the "agent working" card at better odds) and again once
// you've sat on it idle for a while. A game that rolled waits for a calm moment: on the "agent
// working" card, or after a while idle on a question. If that moment never came, it starts soon after
// the next card lands instead. Never while you type.
function roll(p) {
  if (!sched.quiet && !sched.armed && R.chance(p)) sched.armed = true;
}

function newCard(waiting = false) {
  if (sched.armed) sched.carried = true;
  sched.idleRolled = false;
  sched.quiet = sched.block > 0;
  if (sched.quiet) { sched.block--; return; }
  if (waiting) roll(0.6);
  else roll(++sched.dry >= 3 ? 1 : GAME_ODDS);
}

function schedTick() {
  if (document.hidden || ctx.reduced) return;
  const calm = !T.typing && ctx.idle > 3;
  const waiting = ctx.front === 'waiting' && ctx.agent === 'working';
  const asking = ctx.front === 'question';
  const idle = (asking || waiting) && ctx.cardTime > IDLE_GAME_S && ctx.idle > 5;
  if (idle && !sched.idleRolled) { sched.idleRolled = true; roll(GAME_ODDS); }
  if (!sched.armed || !calm) return;
  const eager = sched.carried || sched.dry >= 3;
  if (!(waiting ? ctx.cardTime > WAIT_GAME_S : asking && (idle || (eager && ctx.cardTime > EAGER_GAME_S)))) return;
  if ([...games.values()].some((s) => !s || (s.meta.trigger === 'random' && !s.meta.passive))) return;
  Object.assign(sched, { armed: false, carried: false, dry: 0, quiet: true, block: 1 }); // nothing more on this card or the next
  fire();
}

async function fire(tries = 4) {
  const pool = ids('game', (s) => s.trigger === 'random');
  const id = draw('game', pool, (x) => !games.has(x) && (x !== T.lastGame || pool.length < 2) && (!byId.get(`game:${x}`).keys || keySafe()));
  if (id && !(await play(id)) && tries > 1) fire(tries - 1);
}

function answered(e, q) {
  if (!on) return;
  const picks = picksOf(e);
  const recs = q.options.filter((o) => o.recommended).map((o) => o.label);
  const a = {
    id: q.id,
    title: plain(q.title),
    picks: picks.map(plain),
    custom: e.custom || '',
    tookRec: picks.some((p) => recs.includes(p)),
    hasRec: recs.length > 0,
    revision: !!e.revision,
    seconds: Math.round(ctx.cardTime * 10) / 10,
  };
  ctx.lastAnswer = a;
  T.answeredAt = now();
  bump('answers');
  if (a.hasRec) {
    if (a.tookRec) bump('recs');
    setStat('streak', a.tookRec ? (stats.n.streak || 0) + 1 : 0);
    setStat('bestStreak', Math.max(stats.n.bestStreak || 0, stats.n.streak));
  }
  if (a.revision) bump('revisions');
  setStat('fastest', Math.min(stats.n.fastest ?? Infinity, a.seconds));
  setStat('slowest', Math.max(stats.n.slowest ?? 0, a.seconds));
  broadcast('answer', a);
  const celebrate = scenes.filter((s) => s.kind === 'game' && s.trigger === 'answer').map((s) => s.id);
  if (forced) { if (celebrate.includes(forced.game)) play(forced.game); } else if (!ctx.reduced && R.chance(0.34)) {
    const id = draw('game-answer', ids('game', (s) => s.trigger === 'answer'));
    if (id) play(id);
  }
}

// ── keyboard ───────────────────────────────────────────────────────────────

const K = { owner: null, fn: null, keys: null, onLost: null, prev: null };
const isField = (el) => /^(TEXTAREA|INPUT)$/.test(el?.tagName);

function keySafe() {
  const a = document.activeElement;
  return !(isField(a) && a.value.trim()) && ctx.answerEmpty && ctx.idle > 3 && !T.typing;
}

function grabKeys(s, fn, { keys, onLost } = {}) {
  if (K.owner && K.owner !== s) return false;
  if (K.owner !== s && !keySafe()) return false;
  Object.assign(K, { owner: s, fn, keys: keys ? new Set(keys) : null, onLost });
  if (!K.prev) K.prev = document.activeElement;
  if (isField(document.activeElement)) document.activeElement.blur();
  return true;
}

// Focus goes back where it was, unless something else took it meanwhile. If that was the body, or a
// card that has since left, it goes to the answer box.
function releaseKeys() {
  if (!K.owner) return;
  const prev = K.prev;
  Object.assign(K, { owner: null, fn: null, keys: null, onLost: null, prev: null });
  const a = document.activeElement;
  if (a && a !== document.body) return;
  if (prev?.isConnected && prev !== document.body && !prev.closest('.card:not(.front)')) prev.focus({ preventScroll: true });
  else host.focusAnswer();
}

function loseKeys() {
  const lost = K.onLost;
  releaseKeys();
  lost?.();
}

function onKey(e) {
  T.lastKey = now();
  if (e.key === 'Escape') {
    const running = [...games.values()].filter((s) => s && s.meta.trigger !== 'always');
    if (running.length) {
      e.preventDefault();
      e.stopImmediatePropagation();
      running.forEach((s) => endGame(s, 'esc'));
    }
    return;
  }
  if (!K.owner || /^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) return;
  if (!e.metaKey && !e.ctrlKey && !e.altKey && (!K.keys || K.keys.has(e.key))) {
    e.preventDefault();
    e.stopImmediatePropagation();
    K.fn(e);
    return;
  }
  // Any other key means you want the keyboard back. Give it back before this key lands.
  loseKeys();
  refire(e);
}

// The key that ended a grab was aimed at the page (the box was blurred), so the answer box's own
// keydown handlers (Enter sends, ↑↓ and 1-9 pick) would never see it. Typed text is fine, as the
// browser inserts it wherever focus is by then. So the box gets a copy of the keydown in place of
// the original: every listener sees the key exactly once, with the box as its target, and the
// original's default action (the typed character) is cancelled only if the copy's was.
function refire(e) {
  const to = document.activeElement;
  if (!e.isTrusted || !to || to === e.target || to === document.body) return;
  e.stopImmediatePropagation();
  const copy = new KeyboardEvent('keydown', {
    key: e.key, code: e.code, location: e.location, repeat: e.repeat, isComposing: e.isComposing,
    ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
    bubbles: true, cancelable: true, composed: true,
  });
  to.dispatchEvent(copy);
  if (copy.defaultPrevented) e.preventDefault();
}

function onInput(e) {
  if (!/^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;
  T.lastKey = now();
  if (!T.typing) { T.typing = true; broadcast('typing', true); }
  broadcast('keystroke');
  clearTimeout(T.typingTimer);
  T.typingTimer = setTimeout(() => { T.typing = false; broadcast('typing', false); }, 1500);
}

// ── cursor, toasts, stats, HUD ─────────────────────────────────────────────

// Scenes' cursors stack: the latest one shows, and clearing yours only removes yours, so the one
// under it (or none) comes back.
const cursors = []; // [{ s, value }]
function setCursor(s, value, clearAll) {
  if (clearAll) cursors.length = 0;
  const i = cursors.findIndex((c) => c.s === s);
  if (i >= 0) cursors.splice(i, 1);
  if (value != null && !clearAll) cursors.push({ s, value });
  const html = document.documentElement;
  const top = cursors.at(-1);
  if (top) {
    html.style.setProperty('--fun-cursor', top.value);
    html.classList.add('fun-cursor');
    return;
  }
  html.classList.remove('fun-cursor');
  html.style.removeProperty('--fun-cursor');
  for (const a of ['class', 'style']) if (html.getAttribute(a) === '') html.removeAttribute(a);
}

function toast(text, { icon = '', ms = 2600 } = {}) {
  if (!L) return;
  const t = Object.assign(document.createElement('div'), { className: 'fun-toast' });
  if (icon) t.append(Object.assign(document.createElement('i'), { textContent: icon }));
  t.append(document.createTextNode(text));
  L.toasts.append(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

// Stats live per grill. Anything counted before the doc arrived is added to that grill's.
function loadStats(slug) {
  const early = statsKey ? null : stats;
  statsKey = KEY.stats(slug);
  const s = store.get(statsKey, {}, isObj);
  stats = { n: {}, meta: {} };
  if (isObj(s.n)) for (const [key, v] of Object.entries(s.n)) if (Number.isFinite(v)) stats.n[key] = v;
  if (isObj(s.meta)) {
    for (const [key, m] of Object.entries(s.meta)) if (isObj(m)) stats.meta[key] = Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === 'string'));
  }
  if (early) {
    for (const [key, v] of Object.entries(early.n)) if (!/^(streak|bestStreak|fastest|slowest)$/.test(key)) stats.n[key] = (stats.n[key] || 0) + v;
    for (const [key, m] of Object.entries(early.meta)) stats.meta[key] = { ...stats.meta[key], ...m };
    if (Object.keys(early.n).length) saveStats();
  }
  ctx.stats = stats.n;
  hud();
}

const saveStats = () => statsKey && store.set(statsKey, stats);

function setStat(key, value) {
  stats.n[key] = value;
  saveStats();
}

function bump(key, by = 1, meta) {
  stats.n[key] = (stats.n[key] || 0) + by;
  if (meta && Object.keys(meta).length) stats.meta[key] = { ...stats.meta[key], ...meta };
  saveStats();
  if (stats.meta[key]?.icon) hud(key);
  broadcast('event', 'stat', { key, value: stats.n[key], by });
  return stats.n[key];
}

function hud(changed) {
  if (!L) return;
  const items = Object.entries(stats.meta).filter(([k, m]) => typeof m.icon === 'string' && m.icon && stats.n[k] > 0);
  L.hud.classList.toggle('on', items.length > 0);
  for (const el of [...L.hud.children]) if (!items.some(([k]) => k === el.dataset.k)) el.remove();
  for (const [k, m] of items) {
    let el = L.hud.querySelector(`[data-k="${CSS.escape(k)}"]`);
    if (!el) {
      el = Object.assign(document.createElement('span'), { title: m.label || k });
      el.dataset.k = k;
      el.innerHTML = '<i></i><b></b>';
      L.hud.append(el);
    }
    el.firstChild.textContent = m.icon;
    el.lastChild.textContent = stats.n[k].toLocaleString();
    if (k === changed && !ctx.reduced) el.animate([{ transform: 'scale(1.25)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.3,1.4,.6,1)' });
  }
}

// "You shot 4 pigeons, popped 212 bubbles and took the recommendation 80% of the time."
function funLine() {
  const parts = Object.entries(stats.meta)
    .filter(([k, m]) => typeof m.says === 'string' && m.says && stats.n[k] > 0)
    .map(([k, m]) => m.says.replace(/\{n\}/g, stats.n[k].toLocaleString()).replace(/\{s\}/g, stats.n[k] === 1 ? '' : 's'));
  if (ctx.recRate !== null) parts.push(`took the recommendation ${Math.round(ctx.recRate * 100)}% of the time`);
  if (!parts.length) return '';
  return `You ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}.`;
}

function doneCard() {
  const card = $('#stack .card.front[data-id="__done"] .card-inner');
  if (!card) return;
  const line = funLine();
  let p = $('.fun-done', card);
  if (!line) { p?.remove(); return; }
  if (!p) {
    p = Object.assign(document.createElement('p'), { className: 'fun-done' });
    card.querySelector('p')?.after(p);
  }
  if (p.textContent !== line) p.textContent = line;
}

// ── frame-time watchdog ────────────────────────────────────────────────────
// Some canvas backgrounds are heavy on some machines. While one is up, the frame rate is measured
// (only while the tab is visible, no random game is running, and the card isn't being swapped). If
// it averages well under 50fps over a few seconds, every canvas in that scene drops to the next DPR
// step, quietly, and the scene keeps that cap for the rest of the page's life. Long frames (a hidden
// tab, a GC pause) are skipped, not counted.

const dprCaps = new Map(); // bg id → DPR cap it earned here
const W = { raf: 0, last: 0, sum: 0, n: 0, from: 0, fps: null };

function watch() {
  cancelAnimationFrame(W.raf);
  Object.assign(W, { raf: 0, last: 0, sum: 0, n: 0, from: now() + 1500, fps: null });
  if (on && bg && !ctx.reduced && !document.hidden && bg.kit._dprNow() > 1) W.raf = requestAnimationFrame(watchFrame);
}

function watchFrame(ts) {
  if (!on || !bg || document.hidden) return;
  W.raf = requestAnimationFrame(watchFrame);
  const dt = W.last ? ts - W.last : 0;
  W.last = ts;
  const busy = [...games.values()].some((s) => !s || (!s.meta.passive && s.meta.trigger !== 'always'));
  if (ts < W.from || busy || !dt || dt > 250) { W.sum = W.n = 0; return; }
  W.sum += dt;
  W.n++;
  if (W.sum < SLOW_WINDOW) return;
  W.fps = Math.round(1000 / (W.sum / W.n));
  const slow = W.sum / W.n > SLOW_MS;
  W.sum = W.n = 0;
  if (!slow) return;
  const cur = bg.kit._dprNow();
  const cap = DPR_STEPS.find((d) => d < cur - 0.01);
  if (!cap) { cancelAnimationFrame(W.raf); return; }
  dprCaps.set(bg.id, cap);
  bg.kit._dpr(cap);
  if (bg.kit.reduced) bg.kit._redraw();
  watch(); // a fresh window, after a moment to settle at the new size
}

// ── for testing from the console or shot.mjs --eval ────────────────────────

const debug = {
  play: (id) => (ready.then(() => play(id))),
  bg: (id) => ready.then(() => setBg(id, T.frontId)),
  end: () => { for (const s of [...games.values()]) endGame(s); return 'ended'; },
  fire: () => ready.then(() => fire()), // what the scheduler would start now: next random game in the bag
  answer: (a = {}) => broadcast('answer', { id: ctx.question?.id || 'test', title: ctx.question?.title || 'Test', picks: ctx.question?.recommended || [], custom: '', tookRec: true, hasRec: true, revision: false, seconds: 12, ...a }),
  emit: (hook, ...args) => broadcast(hook, ...args),
  dpr: (cap) => { if (!bg) return null; dprCaps.set(bg.id, cap); bg.kit._dpr(cap); watch(); return bg.kit._dprNow(); },
  get fps() { return W.fps; }, // the watchdog's last measured window
  reset: () => { for (const k of Object.keys(localStorage)) if (k.startsWith('grill:fun:')) localStorage.removeItem(k); stats = { n: {}, meta: {} }; ctx.stats = stats.n; dprCaps.clear(); hud(); return 'reset'; },
  get ctx() { return ctx; },
  get live() { return { bg, games: Object.fromEntries(games) }; }, // the mounted scenes: { id, kit, hooks, root }
  get state() {
    return { on, bg: bg?.id || null, dpr: bg?.kit._dprNow() ?? null, dprCaps: Object.fromEntries(dprCaps), games: [...games.keys()], sched: { ...sched }, cursors: cursors.map((c) => c.s.id), audio: audioState(), missing: [...missing], available: available && { bg: [...available.bg], game: [...available.game] }, stats };
  },
};
