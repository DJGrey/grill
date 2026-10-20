// Googly eyes stuck to the question card. They wobble after your cursor, watch you type, keep
// glancing at the ★ option, dilate when you hover it, and fall off when the next question arrives.

const CSS = `
.gg { position: absolute; border-radius: 50%; pointer-events: none; z-index: 6; box-sizing: border-box;
  background: radial-gradient(circle at 36% 30%, #fff 0 30%, #f4f4f1 58%, #d5d5cf 100%);
  border: 1px solid rgba(0,0,0,.28);
  box-shadow: 0 2px 3px rgba(0,0,0,.3), 0 6px 14px -4px rgba(0,0,0,.35), inset 0 -2px 4px rgba(0,0,0,.12); }
.gg.big { pointer-events: auto; cursor: pointer; }
.gg i { position: absolute; left: 50%; top: 50%; border-radius: 50%; will-change: transform;
  background: radial-gradient(circle at 38% 34%, #3a3a3a 0, #0b0b0b 55%, #000 100%); }
.gg b { position: absolute; left: 17%; top: 11%; width: 34%; height: 20%; border-radius: 50%; transform: rotate(-28deg);
  background: radial-gradient(ellipse at center, rgba(255,255,255,.95), rgba(255,255,255,0) 70%); }
.gg-fall { position: fixed; z-index: 1; pointer-events: none; }
`;

// Where the eyes go, in card coordinates. Seeded per card so revisiting looks the same.
const LAYOUTS = [
  (W) => [{ x: W * 0.8, y: -6, d: 46 }, { x: W * 0.8 + 44, y: -2, d: 38 }], // peeking over the top edge
  (W) => [{ x: 8, y: 6, d: 62 }], // one big eye on the corner
  (W) => [{ x: W - 4, y: 44, d: 40 }, { x: W - 2, y: 86, d: 34 }], // sideways, on the right edge
  (W) => [{ x: W * 0.5 - 22, y: -8, d: 40 }, { x: W * 0.5 + 22, y: -8, d: 40 }], // dead centre, top
];

export default function googly(k, ctx) {
  k.el('style', { text: CSS });
  const eyes = [];
  const falling = [];
  let card = null;
  let startId = ctx.front === 'question' ? ctx.question?.id : null;
  let ended = false;
  const look = { x: 0, y: 0, mode: 'pointer', until: 0, lastMove: -10, px: -1, py: -1, next: 2.5 };
  let T = 0;
  // Layout reads, cached: the options, the ★, the answer box and each eye's rect. Taken at the start of a frame, only
  // after a new card, layout, scroll or typing.
  const M = { dirty: true, opts: [], rec: null, recR: null, ta: null };
  function measure() {
    M.dirty = false;
    M.opts = k.ui.options();
    M.rec = M.opts.find((o) => o.recommended);
    M.recR = M.rec && k.rect(M.rec.el);
    M.ta = k.rect(k.ui.answer());
    for (const e of eyes) e.r = e.el.getBoundingClientRect();
  }

  const key = () => (ctx.front === 'question' ? ctx.question?.id : ctx.front) || 'x';

  function make(spec, i, tiny) {
    const d = spec.d;
    const el = k.el('div', { class: `gg${tiny ? '' : ' big'}` }, null);
    const p = d * (tiny ? 0.52 : 0.46);
    const pupil = k.el('i', { style: { width: `${p}px`, height: `${p}px`, margin: `${-p / 2}px 0 0 ${-p / 2}px` } }, el);
    k.el('b', {}, el);
    Object.assign(el.style, { width: `${d}px`, height: `${d}px` });
    const e = { el, pupil, spec, d, p, tiny, x: 0, y: k.rand(-2, 2), vx: k.rand(-80, 80), vy: k.rand(-80, 80), sx: null, sy: null, svx: 0, svy: 0, size: 1, spin: 0, ang: 0, k: 70 + i * 23 + k.rand(-10, 10), damp: 4 + k.rand(-1, 1.5) };
    if (!tiny) {
      k.on(el, 'pointerdown', (ev) => {
        k.consume(ev);
        k.sfx.boing({ pitch: k.rand(1.1, 1.5), gain: 0.5 });
        for (const o of eyes) { o.spin = 1.4; o.ang = Math.atan2(o.y, o.x); }
        k.score('boops', 1, { label: 'Googly boops', says: 'booped {n} googly eye{s}' });
      });
    }
    return e;
  }

  // Lay the eyes out on whatever card is in front now.
  function attach() {
    const c = k.ui.card();
    if (!c) return;
    const fresh = c !== card;
    card = c;
    const W = c.offsetWidth;
    if (fresh || !eyes.length) {
      for (const e of eyes.splice(0)) e.el.remove();
      const r = k.rng(key());
      const specs = LAYOUTS[r.int(0, LAYOUTS.length - 1)](W);
      specs.forEach((s, i) => eyes.push(make(s, i, false)));
      if (c.querySelector('.send')) [0, 1].forEach((i) => eyes.push(make({ send: i, d: i ? 12 : 13 }, eyes.length, true)));
    }
    position();
  }

  // Layout offsets from the card, so its own transforms (it scales in) don't throw us off.
  function offsetIn(el) {
    let x = 0, y = 0;
    for (let n = el; n && n !== card; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return [x, y];
  }

  function position() {
    if (!card) return;
    const send = card.querySelector('.send');
    for (const e of eyes) {
      if (e.el.parentNode !== card) card.append(e.el);
      let x = e.spec.x, y = e.spec.y;
      if (e.spec.send !== undefined) {
        if (!send) { e.el.style.display = 'none'; continue; }
        const [sx, sy] = offsetIn(send); // a tiny pair sat on top of the send button, peeking over it
        x = sx + send.offsetWidth / 2 + (e.spec.send ? 6.5 : -6.5);
        y = sy + 1;
        e.el.style.display = '';
      }
      Object.assign(e.el.style, { left: `${x - e.d / 2}px`, top: `${y - e.d / 2}px` });
    }
    M.dirty = true;
  }

  // Off they come: each eye drops off the card, bounces and rolls away.
  function fallOff() {
    for (const e of eyes.splice(0)) {
      const r = e.last;
      e.el.remove();
      if (!r || k.reduced) continue;
      const f = k.el('div', { class: 'gg gg-fall', style: { width: `${e.d}px`, height: `${e.d}px`, left: '0', top: '0' } });
      const p = k.el('i', { style: { width: `${e.p}px`, height: `${e.p}px`, margin: `${-e.p / 2}px 0 0 ${-e.p / 2}px` } }, f);
      k.el('b', {}, f);
      falling.push({ f, p, d: e.d, x: r.x, y: r.y, vx: k.rand(-160, 160), vy: k.rand(-260, -80), rot: 0, vr: k.rand(-8, 8), px: e.x, py: e.y, bounces: 0 });
    }
    if (!k.reduced) k.sfx.boing({ pitch: 0.7, gain: 0.35 });
    ended = true;
    k.after(k.reduced ? 0 : 2600, k.end);
  }

  function target(dt) {
    const p = k.pointer;
    if (p.x !== look.px || p.y !== look.py) { look.px = p.x; look.py = p.y; look.lastMove = T; }
    const rec = M.rec;
    // they can't help glancing at the recommended option
    if (rec && T > look.next && look.mode !== 'glance') { look.mode = 'glance'; look.until = T + 1.1; }
    if (look.mode === 'glance' && T > look.until) { look.mode = 'pointer'; look.next = T + k.rand(4, 8); }
    if (ctx.typing) {
      const ta = M.ta;
      if (ta) return [ta.left + Math.min(ta.width * 0.4, 160), ta.top + ta.height / 2];
    }
    const r = M.recR;
    if (look.mode === 'glance' && r) return [r.left + r.width * 0.3, r.top + r.height / 2];
    if (p.active && T - look.lastMove < 4) return [p.x, p.y];
    if (r) return [r.left + r.width * 0.3, r.top + r.height / 2];
    if (T > look.until) { // nothing going on: look around the room
      look.x = k.rand(0, k.vw); look.y = k.rand(0, k.vh); look.until = T + k.rand(0.8, 2.2);
    }
    return [look.x, look.y];
  }

  function hoverSize() {
    const p = k.pointer;
    if (!p.active) return 1;
    for (const o of M.opts) {
      const r = o.rect;
      if (p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) return o.recommended ? 1.32 : 0.72; // smitten, or suspicious
    }
    return 1;
  }

  k.on(window, 'scroll', () => { M.dirty = true; }, { capture: true, passive: true });

  const L = k.loop((dt) => {
    T += dt;
    if (!ended && (!card || !card.isConnected || card !== k.ui.card())) attach();
    else if (!ended && eyes.some((e) => e.el.parentNode !== card)) position();
    if (M.dirty) measure();
    const [tx, ty] = target(dt);
    const want = hoverSize();
    for (const e of eyes) {
      const r = e.r;
      if (!r?.width) continue;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      e.last = { x: r.left, y: r.top };
      const max = (e.d - e.p * e.size) / 2 - 1.5;
      // inertia: when the card jumps, the pupils rattle
      if (e.sx !== null && dt > 0) {
        const vx = (cx - e.sx) / dt, vy = (cy - e.sy) / dt;
        e.vx -= (vx - e.svx) * 0.5;
        e.vy -= (vy - e.svy) * 0.5;
        e.svx = vx; e.svy = vy;
      }
      e.sx = cx; e.sy = cy;
      e.size += (want - e.size) * Math.min(1, dt * 8 || 1);
      if (e.spin > 0) {
        e.spin -= dt;
        e.ang += dt * 22 * Math.min(1, e.spin);
        e.x = Math.cos(e.ang) * max; e.y = Math.sin(e.ang) * max;
        e.vx = e.vy = 0;
      } else {
        const dx = tx - cx, dy = ty - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = max * Math.min(1, dist / (e.d * 2));
        const gx = (dx / dist) * reach, gy = (dy / dist) * reach;
        if (k.reduced || dt === 0) { e.x = gx; e.y = gy; } else {
          e.vx += ((gx - e.x) * e.k - e.vx * e.damp) * dt;
          e.vy += ((gy - e.y) * e.k - e.vy * e.damp + 140) * dt; // a little gravity: they're cheap plastic
          e.x += e.vx * dt;
          e.y += e.vy * dt;
        }
        const m = Math.hypot(e.x, e.y);
        if (m > max) { // clack against the rim
          const nx = e.x / m, ny = e.y / m;
          e.x = nx * max; e.y = ny * max;
          const dot = e.vx * nx + e.vy * ny;
          if (dot > 0) { e.vx -= 1.55 * dot * nx; e.vy -= 1.55 * dot * ny; }
        }
      }
      e.pupil.style.transform = `translate(${e.x.toFixed(2)}px, ${e.y.toFixed(2)}px) scale(${e.size.toFixed(3)})`;
    }
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy += 1800 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      const floor = k.vh - f.d;
      if (f.y > floor) {
        f.y = floor;
        f.vy *= -0.45;
        f.vx = (f.vx + (f.vx >= 0 ? 90 : -90)) * 0.9; // then they roll
        f.vr = f.vx / (f.d / 2);
        if (f.bounces++ < 3) k.sfx.clack({ pitch: 1.6 + f.d / 60, gain: 0.25 });
      }
      f.px += (Math.sin(f.rot * 3) * 6 - f.px) * Math.min(1, dt * 10);
      f.f.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${f.rot}rad)`;
      f.p.style.transform = `translate(${f.px.toFixed(1)}px, ${((f.d - f.d * 0.46) / 2 - 2).toFixed(1)}px)`;
      if (f.x < -80 || f.x > k.vw + 80) { f.f.remove(); falling.splice(i, 1); }
    }
  }, { still: 1 });

  attach();
  k.toast('Googly eyes. They’re watching you decide.', { icon: '👀', ms: 2400 });

  return {
    question() {
      if (ended) return;
      const id = ctx.front === 'question' ? ctx.question?.id : null;
      if (id && startId && id !== startId) return fallOff();
      if (id && !startId) startId = id;
      attach();
      L.redraw();
    },
    layout() { position(); },
    typing() { M.dirty = true; }, // the answer box grows as you type
    keystroke() { for (const e of eyes) { e.vx += k.rand(-40, 40); e.vy += k.rand(-60, 10); } }, // they flinch as you type
    answer(a) {
      for (const e of eyes) { e.vy -= 320; e.vx += k.rand(-200, 200); if (a.tookRec) e.size = 1.4; }
    },
  };
}
