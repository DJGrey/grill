// Desk assistant. A googly-eyed stapler pops up in the corner: "It looks like you're making a
// decision. Would you like help?" Pick for me makes it point at the ★ option (it never picks it
// for you). It can also staple something, or go and sulk in the drawer.

const CSS = `
.stp-wrap { position: absolute; right: 22px; bottom: 12px; width: 212px; height: 200px; pointer-events: none; transform-origin: 100% 100%; }
.stp-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: auto; cursor: pointer; }
.stp-bubble {
  position: absolute; right: 40px; bottom: 178px; width: max-content; min-width: 168px; max-width: 276px; box-sizing: border-box; padding: 13px 15px 12px;
  background: #ffffe1; color: #111; border: 1px solid #1b1b1b; border-radius: 12px; pointer-events: auto;
  font: 400 13px/1.42 ui-sans-serif, -apple-system, "Segoe UI", "Noto Sans", sans-serif; text-align: left;
  box-shadow: 3px 4px 0 rgba(0,0,0,.18), 0 18px 40px -12px rgba(0,0,0,.45); transform-origin: 78% 100%;
}
.stp-bubble::after, .stp-bubble::before { content: ""; position: absolute; right: 92px; bottom: -15px; border: 15px solid transparent; border-bottom: 0; border-right: 0; border-top-color: #1b1b1b; }
.stp-bubble::after { bottom: -13px; right: 93px; border-width: 13px 0 0 13px; border-top-color: #ffffe1; }
.stp-bubble p { margin: 0; }
.stp-bubble .stp-t1 { font-weight: 650; }
.stp-bubble .stp-t2 { margin-top: 3px; }
.stp-bubble b { font-weight: 650; }
.stp-choices { margin-top: 9px; display: grid; gap: 3px; }
.stp-choices button {
  appearance: none; border: 0; background: none; padding: 3px 4px 3px 2px; margin: 0 -4px 0 -2px; border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; gap: 8px; font: inherit; color: #0b2a8f; text-align: left;
}
.stp-choices button:hover { background: rgba(10,40,160,.08); text-decoration: underline; }
.stp-choices button i { flex: none; width: 11px; height: 11px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #cfe3ff 0 18%, #3d7bf0 45%, #0b3aa8 100%); box-shadow: 0 0 0 1px rgba(0,0,0,.35); }
.stp-tip { display: flex; align-items: center; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,.12); font-size: 11.5px; color: #444; cursor: pointer; user-select: none; }
.stp-tip span { width: 11px; height: 11px; border: 1px solid #555; background: #fff; display: grid; place-items: center; font-size: 10px; line-height: 1; border-radius: 2px; }
.stp-ring { position: fixed; pointer-events: none; border-radius: 16px; box-shadow: 0 0 0 3px #ffd23f, 0 0 0 5px rgba(0,0,0,.55), 0 0 28px 6px rgba(255,210,63,.55); }
.stp-arrows { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.stp-label { position: fixed; pointer-events: none; padding: 3px 9px 4px; border-radius: 7px; background: #ffd23f; color: #111; border: 1px solid #111; font: 700 12px/1.2 ui-sans-serif, -apple-system, "Segoe UI", sans-serif; white-space: nowrap; box-shadow: 2px 2px 0 rgba(0,0,0,.3); transform: rotate(-3deg); }
.stp-staple { position: absolute; width: 46px; height: 16px; pointer-events: none; z-index: 5; }
.stp-staple svg { display: block; width: 100%; height: 100%; }
.stp-left { right: auto; left: 10px; bottom: 50px; transform-origin: 0 100%; }
.stp-left .stp-svg { transform: scaleX(-1); }
.stp-left .stp-bubble { right: auto; left: 22px; max-width: 240px; transform-origin: 22% 100%; }
.stp-left .stp-bubble::before { right: auto; left: 92px; border-width: 15px 15px 0 0; border-color: #1b1b1b transparent transparent; }
.stp-left .stp-bubble::after { right: auto; left: 93px; border-width: 13px 13px 0 0; border-color: #ffffe1 transparent transparent; }
.stp-brow { filter: drop-shadow(0 0 1.2px rgba(255,255,255,.75)); }
.stp-side .stp-bubble { right: 196px; bottom: 54px; transform-origin: 100% 80%; }
.stp-side .stp-bubble::before { right: -16px; bottom: 34px; border: 10px solid transparent; border-right: 0; border-left: 16px solid #1b1b1b; }
.stp-side .stp-bubble::after { right: -14px; bottom: 35px; border: 9px solid transparent; border-right: 0; border-left: 14px solid #ffffe1; }
`;

const SVG = `<svg class="stp-svg" viewBox="-6 -34 176 166" xmlns="http://www.w3.org/2000/svg" aria-label="A stapler">
<defs>
  <linearGradient id="stp-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a5c"/><stop offset=".45" stop-color="#df2a22"/><stop offset="1" stop-color="#8e1111"/></linearGradient>
  <linearGradient id="stp-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b4f58"/><stop offset="1" stop-color="#17181c"/></linearGradient>
  <linearGradient id="stp-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#9aa3ad"/><stop offset="1" stop-color="#d9dee3"/></linearGradient>
  <radialGradient id="stp-eye" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#f1f1ee"/><stop offset="1" stop-color="#c9c9c4"/></radialGradient>
  <filter id="stp-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
</defs>
<ellipse class="stp-shadow" cx="84" cy="124" rx="74" ry="6" fill="rgba(0,0,0,.35)" filter="url(#stp-soft)"/>
<g class="stp-body">
  <path d="M8 108 Q8 100 16 100 L148 100 Q158 100 158 110 L158 114 Q158 118 152 118 L14 118 Q8 118 8 112 Z" fill="url(#stp-base)"/>
  <rect x="12" y="116" width="144" height="4" rx="2" fill="#0d0d0f"/>
  <path d="M18 101 L150 101" stroke="rgba(255,255,255,.22)" stroke-width="1.2"/>
  <rect x="14" y="96" width="32" height="6" rx="2" fill="url(#stp-chrome)"/>
  <path d="M120 100 L120 76 Q120 68 130 68 L150 68 Q158 68 158 78 L158 100 Z" fill="url(#stp-base)"/>
  <g class="stp-arm">
    <path d="M18 96 L138 90 L138 82 L20 88 Z" fill="url(#stp-chrome)"/>
    <path d="M10 90 Q5 80 15 73 Q24 66 42 65 L138 60 Q155 60 155 73 Q155 84 142 86 L24 94 Q13 95 10 90 Z" fill="url(#stp-red)" stroke="#5e0a0a" stroke-width="1.2"/>
    <path d="M24 70 Q36 67 62 66 L134 63" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>
    <path d="M13 86 Q14 78 22 73" fill="none" stroke="#6d0c0c" stroke-width="2" stroke-linecap="round"/>
    <circle cx="142" cy="78" r="4.2" fill="url(#stp-chrome)" stroke="#333" stroke-width=".8"/>
    <g class="stp-eye" data-r="16"><circle cx="48" cy="52" r="16" fill="url(#stp-eye)" stroke="#1a1a1a" stroke-width="1.6"/><g class="stp-pupil"><circle cx="48" cy="52" r="7.6" fill="#111"/><circle cx="45.6" cy="49.4" r="2.2" fill="#fff" fill-opacity=".85"/></g></g>
    <g class="stp-eye" data-r="13.5"><circle cx="84" cy="50" r="13.5" fill="url(#stp-eye)" stroke="#1a1a1a" stroke-width="1.6"/><g class="stp-pupil"><circle cx="84" cy="50" r="6.4" fill="#111"/><circle cx="82" cy="47.8" r="1.9" fill="#fff" fill-opacity=".85"/></g></g>
    <path class="stp-brow" d="M34 30 Q47 22 61 29" fill="none" stroke="#2a0d0d" stroke-width="4" stroke-linecap="round"/>
    <path class="stp-brow" d="M73 30 Q84 24 96 30" fill="none" stroke="#2a0d0d" stroke-width="4" stroke-linecap="round"/>
  </g>
</g>
</svg>`;

const STAPLE = `<svg viewBox="0 0 46 16" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="8.6" r="2.2" fill="rgba(0,0,0,.28)"/><circle cx="41" cy="8.6" r="2.2" fill="rgba(0,0,0,.28)"/><rect x="5" y="7.6" width="36" height="3.6" rx="1.8" fill="rgba(0,0,0,.3)" transform="translate(.6 1.2)"/><rect x="5" y="6.4" width="36" height="3.8" rx="1.9" fill="#8a949d"/><rect x="6" y="6.8" width="34" height="1.4" rx=".7" fill="#eef2f5"/></svg>`;

const HINGE = [142, 78]; // the arm swings open around this, in SVG units

export default function stapler(k, ctx) {
  k.el('style', { text: CSS });
  const arrows = k.el('svg:svg', { class: 'stp-arrows' }); // under the bubble, so the arrow comes out of it
  const wrap = k.el('div', { class: 'stp-wrap' });
  const svg = k.html(SVG, wrap);
  const body = svg.querySelector('.stp-body');
  const arm = svg.querySelector('.stp-arm');
  const brows = [...svg.querySelectorAll('.stp-brow')];
  const eyes = [...svg.querySelectorAll('.stp-eye')].map((el, i) => {
    const white = el.firstElementChild;
    return { el, white, pupil: el.querySelector('.stp-pupil'), R: Number(el.dataset.r), r: i ? 6.4 : 7.6, x: 0, y: 0, vx: 0, vy: 0, cx: Number(white.getAttribute('cx')), cy: Number(white.getAttribute('cy')), k: i ? 120 : 95, d: i ? 7 : 5.5 };
  });
  const bubble = k.el('div', { class: 'stp-bubble' }, wrap);
  bubble.style.visibility = 'hidden';

  const S = { t: 0, talk: 0, chomp: -1, mood: 'happy', lean: 0, leanTo: 0, brow: 0, browTo: -3, enter: 0, leaving: false, look: null, targets: [], asks: 0, busy: false };
  const muted = k.load('muted', 0);
  let L = null;
  // Layout reads, cached: taken at the start of a frame (before any writes) only when something moved, or for a
  // moment while the stapler or its bubble animates. layout(), scroll and anything that changes the bubble ask for one.
  const M = { dirty: true, until: 0.8, me: null, br: null, card: null };
  const remeasure = (secs = 0) => { M.dirty = true; M.until = Math.max(M.until, S.t + secs); };
  function measure() {
    M.dirty = false;
    M.me = k.rect(svg);
    M.br = bubble.getBoundingClientRect();
    M.card = k.rect(k.ui.card());
    for (const t of S.targets) t.r = k.rect(t.el);
  }

  // ── what it says ───────────────────────────────────────────────────────

  const q = () => ctx.question;
  const opening = () => {
    const Q = q();
    if (muted) return ['Welcome back!', 'You said not to show this tip again. I forgot. Would you like help?'];
    if (ctx.front === 'done') return ['It looks like you’ve made every decision!', 'Would you like me to staple them together?'];
    if (ctx.front === 'waiting') return ['It looks like the agent is thinking.', 'Would you like me to staple something while we wait?'];
    if (!ctx.answerEmpty) return ['It looks like you’re writing a letter.', 'Would you like help?'];
    if (Q.revising) return ['It looks like you’re changing your mind.', 'Bold. Would you like help?'];
    if (!Q.options.length) return ['It looks like you have to write this one yourself.', 'Would you like help? I can’t write. I’m a stapler.'];
    if (ctx.cardTime > 60) return ['It looks like you’ve been on this one a while.', 'Would you like help?'];
    if (Q.multi) return ['It looks like you’re picking several things.', 'Would you like help?'];
    if (Q.title.length > 90) return ['It looks like you’re reading a very long question.', 'Would you like help?'];
    return ['It looks like you’re making a decision.', 'Would you like help?'];
  };

  function say(t1, t2 = '', choices = [], tip = false) {
    bubble.replaceChildren();
    bubble.style.visibility = '';
    k.el('p', { class: 'stp-t1', text: t1 }, bubble);
    if (t2) k.el('p', { class: 'stp-t2', html: t2 }, bubble);
    if (choices.length) {
      const box = k.el('div', { class: 'stp-choices' }, bubble);
      for (const [label, fn] of choices) {
        const b = k.el('button', { type: 'button', html: `<i></i><span></span>`, on: { click: (e) => { e.stopPropagation(); k.sfx.blip({ pitch: 1.2, gain: 0.8 }); fn(); } } }, box);
        b.lastChild.textContent = label;
      }
    }
    if (tip) {
      const t = k.el('div', { class: 'stp-tip', html: '<span></span>Don’t show me this tip again' }, bubble);
      k.on(t, 'click', () => {
        t.firstChild.textContent = '✓';
        k.save('muted', muted + 1);
        k.after(350, () => sulk('Noted.', 'I’ll see you next time.'));
      });
    }
    S.talk = S.t + Math.min(2.2, 0.35 + (t1.length + t2.replace(/<[^>]+>/g, '').length) * 0.022);
    k.animate(bubble, [{ opacity: 0, transform: 'translateY(8px) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.6,1)' });
    remeasure(0.3);
    L?.redraw();
  }

  function ask() {
    const Q = q();
    const choices = [];
    if (Q && Q.options.length) choices.push(['Pick for me', pickForMe]);
    choices.push([ctx.front === 'done' ? 'Staple them together' : 'Just staple something', stapleSomething]);
    choices.push(['No thanks, I’ve got this', () => sulk('Fine.', 'I’ll be in the drawer.')]);
    const [t1, t2] = opening();
    say(t1, t2, choices, true);
    place();
    S.browTo = -5;
    const asked = ++S.asks; // ignored for this long and it shows itself out
    k.after(9000, () => { if (asked === S.asks && !S.busy) leave('I’ll just… be over here.', ''); });
  }

  // ── the three answers ──────────────────────────────────────────────────

  function pickForMe() {
    const opts = k.ui.options();
    if (!opts.length) return say('Hm. There’s nothing to pick.', 'I could staple your thoughts together?', [['Go on then', stapleSomething], ['No', () => sulk('Fine.', 'I’ll be in the drawer.')]]);
    const recs = opts.filter((o) => o.recommended);
    const targets = recs.length ? recs : [k.pick(opts)];
    S.busy = true;
    say('Ooh, I know this one.', '');
    S.browTo = -8;
    const t = targets[0].el;
    const sr = k.rect(k.ui.stage());
    const r = t.getBoundingClientRect();
    if (sr && (r.top < sr.top + 10 || r.bottom > sr.bottom - 10)) t.scrollIntoView({ block: 'nearest', behavior: k.reduced ? 'auto' : 'smooth' });
    k.after(650, () => {
      point(targets.map((o) => o.el), recs.length > 0);
      k.sfx.boing({ pitch: 1.4, gain: 0.5 });
      const label = (o) => `<b>${esc(k.clip(o.label, 48))}</b>`;
      if (!recs.length) say('No star on this one.', `Eeny, meeny… ${label(targets[0])}? Don’t quote me. I’m a stapler.`);
      else if (recs.length > 1) say('Those. All of them.', `The ones with the stars. Stapled together, ideally. <i>You</i> click them, though.`);
      else say('That one. The one with the star.', `${label(recs[0])}. But I’m a stapler, so it’s your call.`);
      k.after(3600, () => {
        unpoint();
        leave(k.pick(['Good luck!', 'You’ve got this.', 'Glad I could help!']), '');
      });
    });
  }

  function stapleSomething() {
    S.busy = true;
    say('Hold still…', '');
    S.browTo = -2;
    k.after(500, () => {
      S.chomp = S.t;
      k.sfx.clack({ pitch: 0.7, gain: 1.2 });
      k.sfx.thud({ pitch: 1.8, gain: 0.5, delay: 0.02 });
      k.animate(wrap, [{ transform: 'none' }, { transform: 'translateY(4px) scaleY(.93)' }, { transform: 'none' }], { duration: 200, easing: 'ease-out' });
      remeasure(0.25);
      const card = k.ui.card();
      if (card) {
        const st = k.el('div', { class: 'stp-staple', html: STAPLE, style: { left: '8px', top: '16px', transform: 'rotate(-38deg)' } }, card);
        k.animate(st, [{ transform: 'rotate(-38deg) translateY(-14px) scale(1.4)', opacity: 0 }, { transform: 'rotate(-38deg)', opacity: 1 }], { duration: 140, easing: 'ease-in' });
        k.animate(card, [{ transform: 'none' }, { transform: 'translate(-1px, 2px) rotate(-.15deg)' }, { transform: 'none' }], { duration: 180, easing: 'ease-out' });
      }
      say(ctx.front === 'done' ? 'Stapled. Every decision, together forever.' : 'There. Stapled.', 'Feels more official, doesn’t it?');
      S.browTo = -9;
      k.after(2800, () => leave('Happy to help!', ''));
    });
  }

  function sulk(t1, t2) {
    S.busy = true;
    S.mood = 'sad';
    S.browTo = 4;
    unpoint();
    say(t1, t2);
    k.after(1700, () => leave(null));
  }

  function leave(t1, t2) {
    if (S.leaving) return;
    S.leaving = true;
    if (t1) say(t1, t2);
    k.after(t1 ? 900 : 0, async () => {
      k.animate(bubble, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px) scale(.94)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
      k.sfx.whoosh({ pitch: 0.8, gain: 0.4 });
      remeasure(0.7);
      await k.animate(wrap, [{ transform: 'none' }, { transform: 'translateY(-14px)', offset: 0.3 }, { transform: 'translateY(190px)' }], { duration: 650, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' }).finished.catch(() => {});
      k.end();
    });
  }

  // ── pointing: a ring round the option and a big arrow from the stapler ───────────

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function point(els, star = true) {
    unpoint();
    S.targets = els.slice(0, 4).map((el, i) => {
      const ring = k.el('div', { class: 'stp-ring' });
      const under = k.el('svg:path', { fill: 'none', stroke: 'rgba(0,0,0,.55)', 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, arrows);
      const line = k.el('svg:path', { fill: 'none', stroke: '#ffd23f', 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, arrows);
      const label = i ? null : k.el('div', { class: 'stp-label', text: els.length === 1 ? (star ? 'this one ★' : 'this one?') : els.length === 2 ? 'these two ★' : 'these ★' });
      return { el, ring, under, line, label, lw: label?.offsetWidth || 0, born: S.t + i * 0.18 };
    });
    remeasure();
    S.leanTo = -7;
    L?.redraw();
  }

  function unpoint() {
    for (const t of S.targets) { t.ring.remove(); t.under.remove(); t.line.remove(); t.label?.remove(); }
    S.targets = [];
    S.leanTo = 0;
  }

  function drawPointers() {
    const me = M.me;
    for (const t of S.targets) {
      const r = t.r;
      const vis = r && me;
      for (const e of [t.ring, t.under, t.line, t.label]) if (e) e.style.display = vis ? '' : 'none';
      if (!vis) continue;
      const age = Math.max(0, S.t - t.born);
      const grow = k.reduced ? 1 : k.ease.outBack(Math.min(1, age / 0.35));
      const pulse = k.reduced ? 0 : Math.sin(age * 7) * 2;
      Object.assign(t.ring.style, { left: `${r.left - 6 - pulse}px`, top: `${r.top - 6 - pulse}px`, width: `${r.width + 12 + pulse * 2}px`, height: `${r.height + 12 + pulse * 2}px`, opacity: Math.min(1, age * 5) });
      // Out of the top of the speech bubble, up, then left into the option's right edge.
      const br = M.br;
      const sx = br.width ? br.left + Math.min(70, br.width * 0.3) : me.left + me.width * 0.36, sy = br.width ? br.top + 6 : me.top;
      const ex = mirror ? r.left - 14 : r.right + 14, ey = r.top + r.height / 2;
      const draw = k.reduced ? 1 : k.ease.outCubic(Math.min(1, age / 0.45));
      const mx = mirror ? Math.min(sx, ex - 40) : Math.max(sx, ex + 40), my = Math.min(sy - 20, ey);
      const P = (u) => [(1 - u) ** 2 * sx + 2 * (1 - u) * u * mx + u * u * ex, (1 - u) ** 2 * sy + 2 * (1 - u) * u * my + u * u * ey];
      const n = 24, end = Math.max(0.02, draw);
      let d = '';
      for (let i = 0; i <= n; i++) { const [x, y] = P((i / n) * end); d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
      const [hx, hy] = P(end);
      const [px, py] = P(end - 0.03);
      const a = Math.atan2(hy - py, hx - px);
      const head = (s) => `M${(hx + Math.cos(a + 2.5) * s).toFixed(1)} ${(hy + Math.sin(a + 2.5) * s).toFixed(1)}L${hx.toFixed(1)} ${hy.toFixed(1)}L${(hx + Math.cos(a - 2.5) * s).toFixed(1)} ${(hy + Math.sin(a - 2.5) * s).toFixed(1)}`;
      t.under.setAttribute('d', d + head(17));
      t.line.setAttribute('d', d + head(16));
      if (t.label) {
        const lx = mirror ? r.left - 22 - t.lw : r.right + 22;
        const fits = mirror ? lx > 4 : lx + t.lw < k.vw - 4;
        Object.assign(t.label.style, { left: `${fits ? lx : mirror ? r.left + 8 : r.right - t.lw - 8}px`, top: `${r.top - (fits ? 14 : 30) - grow * 8}px`, opacity: Math.min(1, Math.max(0, (age - 0.3) * 5)) });
      }
    }
  }

  // ── googly eyes that look at what it's thinking about ─────────────────

  function lookAt() {
    if (S.targets.length) { const r = S.targets[0].r; if (r) return [r.right - 40, r.top + r.height / 2]; }
    if (S.mood === 'sad') return [k.vw * 0.6, k.vh * 2];
    if (k.pointer.active) return [k.pointer.x, k.pointer.y];
    const c = M.card;
    return c ? [c.left + c.width / 2, c.top + 80] : [k.vw / 2, k.vh / 2];
  }

  function eyesStep(dt) {
    const me = M.me;
    if (!me) return;
    const sc = me.width / 176;
    const [tx, ty] = lookAt();
    for (const e of eyes) {
      const ex = mirror ? me.right - (e.cx + 6) * sc : me.left + (e.cx + 6) * sc, ey = me.top + (e.cy + 34) * sc;
      const dx = tx - ex, dy = ty - ey;
      const dist = Math.hypot(dx, dy) || 1;
      const max = e.R - e.r - 1.2;
      const gx = (dx / dist) * max * Math.min(1, dist / 60), gy = (dy / dist) * max * Math.min(1, dist / 60) + 1.2;
      if (k.reduced || dt === 0) { e.x = gx; e.y = gy; } else {
        e.vx += ((gx - e.x) * e.k - e.vx * e.d) * dt;
        e.vy += ((gy - e.y) * e.k - e.vy * e.d + 60) * dt; // a little gravity: they're plastic
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const m = Math.hypot(e.x, e.y);
        if (m > max) { // bounce off the rim
          const nx = e.x / m, ny = e.y / m;
          e.x = nx * max; e.y = ny * max;
          const dot = e.vx * nx + e.vy * ny;
          if (dot > 0) { e.vx -= 1.6 * dot * nx; e.vy -= 1.6 * dot * ny; }
        }
      }
      e.pupil.setAttribute('transform', `translate(${(mirror ? -e.x : e.x).toFixed(2)} ${e.y.toFixed(2)})`);
    }
  }

  // ── where it stands: bubble above it, or beside it, whichever covers less of the card ───────

  let mirror = false;
  function place() {
    const sc = k.vh < 700 || k.vw < 700 ? 0.8 : 1;
    const box = (x, bottom, w, h, left) => ({ l: left ? x : k.vw - x - w * sc, r: left ? x + w * sc : k.vw - x, t: k.vh - bottom - h * sc, b: k.vh - bottom });
    const area = (a, r) => (r ? Math.max(0, Math.min(a.r, r.right) - Math.max(a.l, r.left)) * Math.max(0, Math.min(a.b, r.bottom) - Math.max(a.t, r.top)) : 0);
    const card = k.ui.card();
    const hot = [[k.rect(card), 1], [k.rect(card?.querySelector('.q-answer')), 6], [k.rect(card?.querySelector('.q-hints')), 3], ...k.ui.options().map((o) => [o.rect, 2])];
    const bh = bubble.offsetHeight || 190;
    const side = k.rect(k.ui.side());
    const spots = {
      above: [box(22, 12, 212, 200), box(22 + 40 * sc, 12 + 178 * sc, 276, bh)],
      side: [box(22, 12, 212, 200), box(22 + 196 * sc, 12 + 54 * sc, 276, bh)],
      left: [box(10, 50, 212, 200, true), box(10 + 22 * sc, 50 + 178 * sc, 240, bh, true)],
    };
    const cost = (name) => {
      const [me, b] = spots[name];
      const off = b.l < 0 || b.t < 0 || b.r > k.vw || (name === 'left' && (!side || side.width < 230 * sc));
      return hot.reduce((n, [r, w]) => n + (area(me, r) + area(b, r)) * w, 0) + (off ? 1e9 : 0) + (name === 'above' ? 0 : 1);
    };
    const best = Object.keys(spots).sort((a, b) => cost(a) - cost(b))[0];
    wrap.classList.toggle('stp-side', best === 'side');
    wrap.classList.toggle('stp-left', best === 'left');
    mirror = best === 'left';
    k.style(wrap, { scale: sc === 1 ? null : String(sc) });
    remeasure();
  }

  // ── frame ──────────────────────────────────────────────────────────────

  k.on(svg, 'pointerdown', (e) => {
    k.consume(e);
    if (S.leaving) return;
    S.chomp = S.t;
    k.sfx.clack({ pitch: 0.8 });
    for (const ey of eyes) { ey.vx += k.rand(-260, 260); ey.vy += k.rand(-260, 0); }
    if (!S.busy) {
      say(k.pick(['Ow.', 'Please don’t click me.', 'I bite. I’m a stapler.']), '');
      k.after(1100, () => { if (!S.busy && !S.leaving) ask(); });
    }
  });

  k.on(window, 'scroll', () => remeasure(), { capture: true, passive: true }); // a smooth scroll to the ★ moves the target

  L = k.loop((dt) => {
    S.t += dt;
    const t = S.t;
    if (M.dirty || t < M.until) measure();
    S.brow += (S.browTo - S.brow) * Math.min(1, dt * 10 || 1);
    S.lean += (S.leanTo - S.lean) * Math.min(1, dt * 6 || 1);
    let open = 0;
    if (t < S.talk) open = Math.abs(Math.sin(t * 15)) * 9; // the jaw is its mouth
    const since = t - S.chomp;
    if (S.chomp >= 0 && since < 0.35) open = since < 0.12 ? 22 * (since / 0.12) : 22 * (1 - (since - 0.12) / 0.23);
    const bob = k.reduced ? 0 : Math.sin(t * 2.4) * 1.6;
    arm.setAttribute('transform', `rotate(${(open + Math.sin(t * 1.7) * 0.6).toFixed(2)} ${HINGE[0]} ${HINGE[1]})`);
    body.setAttribute('transform', `translate(0 ${bob.toFixed(2)}) rotate(${S.lean.toFixed(2)} 84 118)`);
    brows.forEach((b, i) => b.setAttribute('transform', `translate(0 ${(S.brow + (i ? 0.5 : 0) + (S.mood === 'sad' ? 0 : Math.sin(t * 0.9) * 0.6)).toFixed(2)}) rotate(${S.mood === 'sad' ? (i ? -12 : 12) : (i ? 4 : -4)} ${i ? 84 : 48} 28)`));
    eyesStep(dt);
    drawPointers();
  }, { still: 0.6 });

  // It springs up out of the bottom corner.
  k.sfx.boing({ pitch: 1.1, gain: 0.6 });
  k.animate(wrap, [{ transform: 'translateY(170px) rotate(8deg)' }, { transform: 'translateY(-10px) rotate(-2deg)', offset: 0.6 }, { transform: 'translateY(3px)', offset: 0.8 }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.3,1)' });
  k.after(k.reduced ? 0 : 420, ask);

  return {
    layout() { place(); },
    answer(a) {
      if (S.leaving) return;
      unpoint();
      S.busy = true;
      leave(...(a.hasRec && !a.tookRec ? ['Oh. Not the star.', 'Bold. I respect that.'] : ['Oh! You did it without me.', 'Great. Great.']));
    },
    question() {
      if (S.targets.length && !S.targets.every((x) => x.el.isConnected)) unpoint();
    },
  };
}
