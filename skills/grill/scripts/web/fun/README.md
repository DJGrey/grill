# Fun mode: writing a scene

Fun mode puts a **background** behind the grill UI (a new one each time a new question reaches the front card) and now and then a **game** on top of it. The engine does the mounting, scheduling, toggles, HUD, stats and cleanup. You write one file:

- `bg/<id>.js` for a background, `game/<id>.js` for a game, plus one entry for it in `registry.js` (kind, name, trigger). Leave `engine.js`, `kit.js`, `fun.css`, the app files and other scenes alone unless that's the point of your change.
- Copy the patterns in the two reference scenes: `bg/matrix.js` (canvas, content-aware text, reduced motion) and `game/pigeon.js` (pointer, consume, score, sfx, burst, ending itself).

## The module

```js
// One line saying what it is.
export default function myScene(k, ctx) {
  // set up: make elements and canvases through k, start loops last
  return {               // every hook is optional
    question() {},       // the front card changed: new or revisited question, waiting card, done card
    answer(a) {},        // you submitted an answer in this tab (a is below)
    decisions() {},      // the agent's decision log changed (ctx.decisions)
    status() {},         // agent status changed (ctx.agent)
    layout() {},         // the card moved or resized (new card, scroll, window resize), and once more when the card stack stops animating. Debounced.
    typing(on) {},       // started (true) or stopped (false, after 1.5s) typing in any box
    keystroke() {},      // one input event in any box. You never get the text.
    sound(on) {},        // the sound toggle changed
    event(name, data) {},// anything else: 'note', 'stat' {key, value, by}, 'pin'/'unpin' {id}, 'game' {id, phase: 'start'|'end'}
    unmount() {},        // rarely needed: the kit already cleans up everything made through it
  };
}
```

Mount may be `async` (to await something short), but return promptly: don't `await` your whole game in it. If it or any hook throws, the engine removes your scene (with a `[fun]` console warning) and carries on.

**Lifecycle.** A background is mounted when its question reaches the front (with `ctx` already describing it), gets hooks while that question and any waiting or done card after it are up, and is unmounted when the next new question arrives. When that happens right after an answer, you get `answer(a)` and then 1.2s with no more hooks to react (a wave, a shake), before the swap. Swaps are a crossfade: your scene is fully unmounted, then its last frame fades out under the next one. Revisiting an old question from the sidebar doesn't swap: you get `question()` with `ctx.question.revising` true. A game is mounted by the scheduler (or on an answer), and lives until it calls `k.end()`, the user presses Esc, fun mode is turned off, or it runs past 3x its registry `ms` (min 20s). Passive games (`googly`, `cat`) have no time cap. The scheduler starts a random game on about one card in four (always by the third card without one, never on two cards running, never while you type), at a calm moment: a few seconds into the "agent working" card, after ~20s idle on a question, or a few seconds into the next card if the last one never had a calm moment. So expect to be mounted on the waiting card (`ctx.front === 'waiting'`, no `ctx.question`) as well as on a question.

## `ctx` (live, read it when you need it, don't keep copies)

| Field | |
|---|---|
| `front` | `'question'`, `'waiting'` (agent working or listening, no card) or `'done'` |
| `question` | `null` unless `front === 'question'`. `{ id, title, tag, n, total, multi, revising, context, options: [{ label, description, recommended }], recommended: [labels] }`. All plain text (markdown stripped). `context` is up to 600 chars. `options` may be empty. Titles and labels can be very long. |
| `decisions` | `[{ n, text, id }]`, the D lines. `n` can be null. |
| `answers` | `[{ id, title, picks, custom, tookRec, hasRec, revision, at }]`, latest answer per question |
| `lastAnswer` | the last `answer(a)` payload or null: `{ id, title, picks, custom, tookRec, hasRec, revision, seconds }` |
| `agent` | `'working'`, `'listening'`, `'done'` or `'offline'` |
| `progress` | `{ answered, total, ratio }` |
| `recRate` | share of answers that took the ★ (0..1), or null |
| `notes` | how many notes were sent |
| `cardTime` | seconds on the current front card |
| `typing`, `idle`, `answerEmpty` | typing right now, seconds since the last key, answer box empty |
| `stats` | this grill's counters: your scores plus `answers`, `recs`, `streak`, `bestStreak`, `revisions`, `notes`, `games`, `fastest`, `slowest` (seconds) |
| `doc` | `{ title, slug, summary }` |
| `reduced`, `dark`, `sound`, `forced` | reduced motion, dark theme, sound on, mounted by a `?fun=` test param |

## The kit, `k`

Everything here is cleaned up for you at unmount: elements, listeners, timers, loops, sounds, inline styles you set on UI elements, the cursor and grabbed keys.

**DOM**
- `k.root`: your full-viewport layer (`position: absolute; inset: 0`). Backgrounds sit behind the UI, games on top.
- `k.el(tag, { class, style, text, html, on: { click }, ...attrs }, parent = k.root)`. `style` is a string or object (custom props OK). `'svg:circle'` makes SVG elements. Elements made with a parent outside `k.root` (say, the card) are removed too.
- `k.html(markup, parent = k.root)`: first element of a markup string (handy for inline SVG).
- `k.style(el, { prop: value })`: temporarily style a UI element (`transform` on the Notes panel, rows…). Restored at unmount, and an element that had no `style` attribute is left without one. Never style the textarea, and don't set `el.style` on UI elements directly (it isn't undone).
- `k.animate(el, keyframes, opts)`: `el.animate`, collapsed to 1ms under reduced motion, cancelled at unmount.

**Time**
- `k.loop((dt, t) => {}, { still = 2 })` returns `{ start, stop, redraw }`. RAF, `dt` in seconds capped at 0.05 (and can be 0), pauses while the tab is hidden. Start loops at the end of setup.
- Under reduced motion a loop never animates (not even after the tab comes back). At start it simulates `still` seconds in **at most 12 frames**, so `dt` is up to `still / 12` there (0.18s for `still: 2.2`): anything that integrates (springs, damping like `v *= 1 - k * dt`, collisions) must clamp or sub-step, or jump straight to its end state when `k.reduced`. Keep `still` to what the punchline needs. After that it draws one `dt = 0` frame after every hook except `keystroke()` (at most one per animation frame) and on resize. `k.redraw()` asks for one of those yourself (say from `keystroke()` or a `k.every` clock); it's a no-op without reduced motion. `L.redraw()` draws synchronously, so don't call it per keystroke.
- `k.after(ms, fn)`, `k.every(ms, fn)`: return a cancel function. `await k.wait(ms)` never resolves after unmount, so async sequences just stop.
- `k.tween(ms, (eased, raw) => {}, ease = k.ease.outCubic)`: a promise.
- `k.ease.{linear, inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic, inBack, outBack, outElastic, outBounce}`, `k.clamp(v, a = 0, b = 1)`, `k.lerp(a, b, t)`.

**Canvas and particles**
- `k.canvas({ dpr = 2, alpha = true, parent, style })` returns `cv = { el, ctx, w, h, dpr, resized }`. Full viewport, auto-resized, DPR capped at 2, the context is pre-scaled so you draw in CSS px. Resizing clears it (and resets context state like `font`): if you don't redraw every frame, set `cv.resized = (w, h, { dprOnly }) => …`. `k.canvas({ w, h, parent })` makes a fixed-size one instead. Pass `dpr: 1` for heavy full-screen effects.
- `cv.dpr` can change while you're mounted (browser zoom, or the engine's frame-time watchdog, below). Then `resized` is called with the same `w, h` and `dprOnly: true`, and the old picture is carried over scaled. On `dprOnly`, rebuild anything pre-rendered at `cv.dpr` (sprites, atlases), but don't re-layout or re-randomise: keep your state (blob positions, rain, popped bubbles, raked sand). A sprite you read with source-rect maths (`drawImage(s, sx * d, …)`) must use the DPR it was built at, not the live `cv.dpr`.
- `k.burst(x, y, { n = 24, shape, colors, speed = 420, angle, spread, gravity = 900, drag, spin, size = 8, life = 1.6, grow })`. Shapes: `'confetti'`, `'star'`, `'dot'`, `'spark'`, `'shard'`, `'mix'`, or any glyph or emoji string. Drawn on its own canvas on top of your scene. A no-op under reduced motion.

**Text**
- `k.font(size, weight = 600, family = 'sans')`. Families: `sans`, `mono`, `serif`, `display` (Impact-ish), `hand`, `emoji`. System fonts only.
- `k.fit(ctx2d, text, maxW, { size, min, weight, family })` shrinks then ellipsizes, sets `ctx2d.font`, returns `{ text, size, font }`.
- `k.ellipsize(ctx2d, text, maxW)`, `k.wrap(ctx2d, text, maxW, maxLines)` returns lines, `k.clip(text, nChars)`, `k.plain(markdown)`.
- `k.canRender(char, family)`: false if the system would draw a tofu box (emoji, katakana). Have a fallback.

**Random**: `k.rand(max)` / `k.rand(min, max)`, `k.int(min, max)` inclusive, `k.pick(arr)`, `k.chance(p)`, `k.shuffle(arr)`, `k.rng(seed)` gives the same API, repeatable (seed with `ctx.question.id` so a scene looks the same each time you revisit a card), `k.hash(str)`.

**Sound** (all silent unless the user turned sound on; WebAudio synth, no files)
- Presets: `k.sfx.pop`, `shot`, `shatter`, `whoosh`, `chime`, `honk`, `blip`, `clack`, `sizzle`, `cheer`, `boing`, `splat`, `thud`, `coin`, `tada`. Each takes `{ gain = 1, pitch = 1, delay = 0, pan = 0 }`. `sizzle({ dur: Infinity })` loops and returns a handle with `stop()`.
- Low level: `k.sfx.tone({ type, freq, to, dur, gain, attack, delay, pan, filter, freqF, q, vibrato: { rate, depth } })` and `k.sfx.noise({ dur, gain, color: 'white'|'pink'|'crackle', filter = 'bandpass', freq, to, q, attack, delay, pan, rate })`. Both return `{ stop(fade) }`. `dur: Infinity` holds until `stop()`.
- `k.sfx.on`: whether sound is on. Keep it tasteful: short, quiet, and no ambient loops louder than a whisper.
- A hidden tab is silent: the engine suspends the shared AudioContext (ambient loops pause and carry on when you come back), and new sounds started while hidden are no-ops. You don't need your own `visibilitychange` handling for sound.

**The grill UI**
- `k.space()` returns `{ vw, vh, stage, card, stack, side, notes, hud, gaps }`. `hud` is the score HUD's rect, or null while it isn't showing (see Layers). `card` is the front card's rect, `stack` the card plus the queued cards peeking out above it. `gaps` are the visible parts of the stage around the stack (`where: 'top'|'bottom'|'left'|'right'|'all'`, `x, y, w, h`), biggest first. Put anything people should read there: under the frosted panels it's blurred, and behind the card it's hidden. Recompute in `question()`/`layout()`, not every frame. `question()` arrives while the new card is still sliding in, so its rects are provisional: `layout()` follows once it has landed (and when the peeking cards change), so you don't need your own re-check timers.
- `k.ui.card()`, `k.ui.answer()` (textarea), `k.ui.options()` → `[{ el, label, recommended, selected, rect }]`, `k.ui.rows()` → `[{ el, id, title, decided, current, rect }]`, `k.ui.side()`, `k.ui.notes()`, `k.ui.stage()`. `k.rect(el)` is its on-screen rect or null.
- `k.pointer`: live `{ x, y, down, active }` in viewport px, wherever the pointer is (over the card too).
- `k.cursor(css)`: e.g. a data-URI SVG cursor everywhere. `k.cursor(null)` clears yours. Cursors stack per scene: the latest one set shows, and clearing yours only removes yours, so whatever another scene set underneath (pigeon's crosshair under the cat's grab hand) comes back. Don't try to check or restore other scenes' cursors. Unmount clears yours.
- `k.consume(e)`: call in a `pointerdown` you handled (a hit) so the UI underneath doesn't also get it.
- `k.keySafe()`, `k.grabKeys(onKey, { keys: ['ArrowUp', …], onLost })`, `k.releaseKeys()` (only ever releases your own grab): see the rules.

**Scores, toasts, storage, ending**
- `k.score(key, by = 1, { icon, label, says })` adds to this grill's stats and returns the total. With `icon` it shows in the HUD. `says` goes in the done-card sentence: `'popped {n} bubble{s}'` → "You popped 212 bubbles and took the recommendation 80% of the time." Pass the meta on every call.
- `k.toast(text, { icon, ms = 2600 })`: a small toast at the top of the stage.
- `k.load(key, fallback)`, `k.save(key, value)`: localStorage, namespaced to your scene. A stored value of a different type from `fallback` (array vs object vs number…) comes back as `fallback`, but still check the inside of anything you load.
- `k.end()`: a game ends itself (do your outro first). Ignored for backgrounds.

## Layers and pointer events

- Backgrounds get pointer events wherever the UI leaves empty space (the stage around the card). The card, panels and buttons still get theirs. Listen on `k.root` or your canvas. Wheel over your scene scrolls the stage, and clicking it closes the Notes drawer, as before.
- Touch drags over a background scroll the stage too (the layer has `touch-action: pinch-zoom`). To keep a drag for yourself (raking sand), call `e.preventDefault()` in a non-passive `touchmove` listener. While the stage scrolls, its right-hand ~14px (the scrollbar) belongs to the stage whenever the mouse is over it, so don't put anything clickable there.
- Games sit above everything with `pointer-events: none`. Set `pointer-events: auto` on the elements that should be clickable (a cat, a piñata). For "click anywhere" games, listen on `window` with `{ capture: true }`, hit-test yourself, and `k.consume(e)` only clicks you claim, so a miss on an option still picks it.
- Mousedown on either layer never moves focus, so clicking your scene doesn't steal the answer box.
- The score HUD sits at the top right of the stage (left of the Notes button under 1241px wide), above everything. Keep labels and clocks out of `k.space().hud` when it's showing. Toasts are top centre.
- Things that should travel with the card (googly eyes, a cat on its corner) can be made with `k.el(…, k.ui.card())`. The card is replaced when the question changes, so re-attach in `question()`.

## Hard rules

1. Never change, clear or submit the user's answer or picks. Don't click options for them (the stapler points, it doesn't pick).
2. Never steal keystrokes while they type. Keyboard games call `k.grabKeys` only when `k.keySafe()` is true (the engine also refuses otherwise). Any key you didn't ask for gives the keyboard back and calls `onLost`, and the engine hands that key on to the answer box, so Enter, ↑↓ and 1-9 still work on the first press (don't forward it yourself). Focusing a text box also ends the grab (`onLost`). Release when done (it also happens at unmount); focus goes back to where it was, or to the answer box.
3. Esc ends any game. Don't handle Esc yourself.
4. The card stays readable. Backgrounds never draw over it (they can't: they're under it). Games may cross it briefly.
5. Reduced motion: backgrounds show one still frame that's still funny (use `still` and draw the punchline in it). Random games don't run. Achievement-style toasts may, without motion. Check `k.reduced`.
6. No network: no CDN, image URLs or web fonts. Canvas, SVG, CSS, DOM, emoji and system fonts only. Inline SVG and data URIs are fine.
7. No real meme photos, trademarked characters or logos. Parody names and vibes are fine.
8. Performance: 60fps on a laptop. Cache what you can (pre-render sprites to offscreen canvases, `dpr: 1` for big blurry things). Only create things through `k` so nothing leaks: the engine must be able to cycle every scene without growing memory. Spent timers, removed listeners, finished animations and elements you've removed and dropped are let go as you go, so a long-lived scene can spawn freely.
   As a safety net the engine watches the frame rate while a background is up (tab visible, no random game running, not in the first 1.5s after a mount). If it averages under 45fps over 3s, every canvas in that scene steps down a DPR notch (2 → 1.5 → 1), and the scene keeps that cap for the rest of the page's life. On a 1x screen, or once everything is at 1, it stops watching. This goes through `resized` with `dprOnly` (see the canvas notes), so it's only invisible if your `resized` keeps your state. Don't lean on it: headless Chrome renders in software and trips it on most scenes at 2x.
9. Backgrounds are their own world: they should work behind both light and dark UI, so mostly ignore the theme.
10. Handle: no question yet (waiting card), no options, one to four or more options, very long titles and labels (truncate nicely), the done card, a narrow window.
11. Style: match `app.js` (terse modern JS, ES modules, small helpers, few comments). One self-contained file. The bar is high-fidelity and genuinely funny: easing, timing, shadows, secondary motion, punchline copy. No placeholder art.

## Testing

Run a server on a copy of the example grill file, on its own port:

```sh
mkdir -p /tmp/fun-<id> && cp skills/grill/references/example.md /tmp/fun-<id>/grill.md
node skills/grill/scripts/grill.mjs serve /tmp/fun-<id>/grill.md --port <port> --no-open &
```

For the waiting card, serve a file with no questions yet. For the done card, set `status: done` and answer everything. Answers are saved next to the file in `.grill.state/`. Delete that folder to start over.

URL params:
- `?fun=bg:<id>` turns fun mode on (not saved), mounts that background now and keeps it across questions: answering gives you `answer(a)` then `question()` for the next card, with no swap.
- `?fun=game:<id>` mounts that game now and restarts it 1.5s after it ends (`&loop=0` to stop that). Combine: `?fun=bg:matrix,game:pigeon`. Forced scenes skip the scheduler, so nothing else shows up. Forced games mount even if their trigger wouldn't fire (unicorn, achievements), with `ctx.forced` true: show your thing straight away.
- `?fun=1` turns fun mode on with normal scheduling. `?fun=0` keeps it off for that load (nothing under `fun/` loads), whatever was saved.

From the console or `--eval`: `__fun.play('pigeon')`, `__fun.bg('matrix')`, `__fun.end()`, `__fun.fire()` (what the scheduler would start now), `__fun.answer({ tookRec: false })` (fires your `answer` hook), `__fun.emit('status')`, `__fun.state`, `__fun.ctx`, `__fun.reset()` (clears bags, stats and DPR caps), `__fun.live` (the mounted scenes: `{ bg, games }`, each with `kit` and `hooks`), `__fun.dpr(1.5)` (step the background's canvases now, to test your `dprOnly` path), `__fun.fps` (the watchdog's last measured window), `__fun.state.dpr`. To fake a state, set a field and emit its hook: `__fun.ctx.agent = 'listening'; __fun.emit('status')` (the next sync from the server puts the real value back).

The sandbox's emoji font is from 2020, so newer emoji (🫧, 🪿, 🪅) show as boxes in screenshots but fine on a Mac. Prefer drawing your art, and guard emoji with `k.canRender`.

Check your scene at a few moments, in light and dark, wide and narrow, and with reduced motion on. Fix every `[fun]` warning and console error. Kill your server when you're done.
