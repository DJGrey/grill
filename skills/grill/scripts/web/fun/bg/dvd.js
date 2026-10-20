// Bouncing logo. The old DVD-player screensaver: a "GRILL" logo drifts around the space under the
// card, changing colour at every wall. Now and then it nails a corner exactly: confetti, a CORNER
// banner, a point on the scoreboard. A little readout keeps count of the near misses and how long
// you've spent watching instead of deciding.

const COLORS = ['#ff3b3b', '#ffb000', '#ffee00', '#35e06b', '#18d4ff', '#4c6bff', '#c04dff', '#ff4fb8', '#ffffff'];
const CHEERS = ['CORNER!', 'IT HIT THE CORNER', 'WE ALL SAW THAT', 'EXACTLY THE CORNER', 'FRAME THIS MOMENT'];
const SPEED = 120; // px/s, as slow and hypnotic as the original
const CLOSE = 22; // a bounce this close to the other wall is a near miss

export default function dvd(k, ctx) {
  const cv = k.canvas();
  const c = cv.ctx;
  k.el('div', { style: 'position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 3px),radial-gradient(ellipse 80% 70% at 50% 50%, transparent 50%, rgba(0,0,0,.7))' });

  let box = null, W = 160, H = 80;
  const p = { x: 0, y: 0, vx: SPEED, vy: SPEED * 0.72 };
  let color = 0, boost = 0, banner = null, near = null, lastCorner = -1e9, clock = 0;
  const stat = { bounces: 0, near: 0, corners: k.load('corners', 0) };
  const sprites = new Map();
  let disc = '';

  const discText = () => (ctx.front === 'done' ? 'THE END' : !ctx.question ? 'LOADING' : (ctx.question.tag || 'DECISION').toUpperCase());

  // The logo is drawn once in white, then tinted per colour and cached.
  function sprite(col) {
    const key = `${col}|${W}|${disc}`;
    if (sprites.has(key)) return sprites.get(key);
    const e = document.createElement('canvas');
    e.width = Math.ceil(W * cv.dpr); e.height = Math.ceil(H * cv.dpr);
    const g = e.getContext('2d');
    g.scale(cv.dpr, cv.dpr);
    g.fillStyle = '#fff';
    g.save(); // GRILL, wide and leaning
    g.translate(W / 2, H * 0.47);
    g.transform(1.32, 0, -0.22, 1, 0, 0);
    g.font = k.font(H * 0.56, 900, 'display');
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const tw = g.measureText('GRILL').width;
    if (tw * 1.32 > W * 0.96) g.font = k.font(H * 0.56 * (W * 0.96) / (tw * 1.32), 900, 'display');
    g.fillText('GRILL', 0, 0);
    g.restore();
    // the disc, with its label knocked out
    g.beginPath();
    g.ellipse(W / 2, H * 0.73, W * 0.46, H * 0.15, 0, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    const f = k.fit(g, disc, W * 0.62, { size: H * 0.17, min: 6, weight: 800, family: 'sans' });
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.translate(W / 2, H * 0.735);
    g.scale(1.15, 1);
    g.fillText(f.text.split('').join(' '), 0, 0);
    g.restore();
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = col;
    g.fillRect(0, 0, W, H);
    sprites.set(key, e);
    return e;
  }

  function layout() {
    const sp = k.space();
    const fit = (g) => {
      const w = k.clamp(Math.min(g.w * 0.26, g.h * 1.15), 0, 190);
      return w >= 96 && g.h >= w * 0.5 * 1.35 && g.w >= w * 1.6 ? w : 0;
    };
    const g = sp.gaps.find(fit);
    const st = sp.stage;
    const b = g ? { x: g.x + 8, y: g.y + 6, w: g.w - 16, h: g.h - 12 } : { x: st.x, y: st.y, w: st.width, h: st.height };
    const nw = g ? fit(g) : k.clamp(st.width * 0.2, 110, 190);
    const old = box;
    box = b;
    if (nw !== W) { W = nw; H = Math.round(W * 0.5); sprites.clear(); }
    if (!old) {
      const r = k.rng(`${ctx.question?.id || ctx.front}dvd`);
      p.x = box.x + r.rand(0.1, 0.7) * (box.w - W);
      p.y = box.y + r.rand(0.1, 0.7) * (box.h - H);
      p.vx = SPEED * (r.chance(0.5) ? 1 : -1);
      p.vy = SPEED * r.rand(0.6, 0.85) * (r.chance(0.5) ? 1 : -1);
    }
    p.x = k.clamp(p.x, box.x, box.x + box.w - W);
    p.y = k.clamp(p.y, box.y, box.y + box.h - H);
  }

  // Every so often, quietly bend the path so the next wall hit is a corner. Nobody will notice.
  function aim() {
    const dx = p.vx > 0 ? box.x + box.w - W - p.x : p.x - box.x;
    const dy = p.vy > 0 ? box.y + box.h - H - p.y : p.y - box.y;
    const tx = dx / Math.abs(p.vx), ty = dy / Math.abs(p.vy);
    const miss = Math.abs(tx - ty) * SPEED;
    const due = clock - lastCorner > 60;
    if (miss > Math.min(box.w, box.h) * 0.45 || !(due ? k.chance(0.4) : k.chance(0.02))) return;
    const ratio = ty / tx; // make ty equal tx by scaling vy, or tx equal ty by scaling vx
    if (ratio > 0.78 && ratio < 1.28) p.vy *= ratio;
    else if (1 / ratio > 0.78 && 1 / ratio < 1.28) p.vx /= ratio;
  }

  function corner(cx, cy) {
    lastCorner = clock;
    stat.corners++;
    k.save('corners', stat.corners);
    k.score('corners', 1, { icon: '📀', label: 'Perfect corners', says: 'watched the logo hit {n} perfect corner{s}' });
    banner = { text: k.pick(CHEERS), age: 0 };
    const ang = Math.atan2(box.y + box.h / 2 - cy, box.x + box.w / 2 - cx);
    k.burst(cx, cy, { n: 90, angle: ang, spread: 1.4, speed: 760, shape: 'confetti', size: 10, life: 2.4 });
    k.burst(cx, cy, { n: 24, angle: ang, spread: 1.2, speed: 520, shape: 'star', size: 9, colors: ['#ffee00', '#ffffff', COLORS[color]] });
    k.sfx.tada();
    k.sfx.cheer({ gain: 0.7, delay: 0.1 });
  }

  function move(dt) {
    const s = 1 + boost * 1.5;
    p.x += p.vx * s * dt;
    p.y += p.vy * s * dt;
    const L = box.x, R = box.x + box.w - W, T = box.y, B = box.y + box.h - H;
    let hx = false, hy = false;
    if (p.x <= L || p.x >= R) { p.x = k.clamp(p.x, L, R); p.vx = -p.vx; hx = true; }
    if (p.y <= T || p.y >= B) { p.y = k.clamp(p.y, T, B); p.vy = -p.vy; hy = true; }
    if (!hx && !hy) return;
    stat.bounces++;
    if (clock - lastCorner < 0.4) return; // the second wall of a corner we just celebrated
    color = (color + 1 + k.int(0, COLORS.length - 3)) % COLORS.length;
    const edgeX = Math.min(p.x - L, R - p.x), edgeY = Math.min(p.y - T, B - p.y);
    const gap = hx ? edgeY : edgeX;
    if ((hx && hy) || gap < 3) corner(p.x <= L + 2 ? box.x : box.x + box.w, p.y <= T + 2 ? box.y : box.y + box.h);
    else {
      if (gap < CLOSE) { stat.near++; near = { age: 0, text: `${Math.round(gap)}px. SO CLOSE.` }; k.sfx.tone({ freq: 330, to: 220, dur: 0.35, gain: 0.05 }); } else k.sfx.blip({ gain: 0.25, pitch: 0.7 });
      aim();
    }
  }

  function readout() {
    const secs = Math.floor(ctx.cardTime);
    const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const ago = stat.corners && lastCorner > 0 ? `${Math.floor(clock - lastCorner)}s ago` : stat.corners ? 'before this card' : 'never';
    const parts = ctx.front === 'done'
      ? [`corners: ${stat.corners}`, `near misses: ${stat.near}`, 'decisions: all of them']
      : [`corners: ${stat.corners}`, `near misses: ${stat.near}`, `last corner: ${ago}`, `time spent watching: ${mm}`];
    c.save();
    c.font = k.font(11, 600, 'mono');
    c.fillStyle = 'rgba(255,255,255,.4)';
    c.textBaseline = 'top';
    c.textAlign = 'right';
    let text = parts.join('  ·  ');
    while (parts.length > 2 && c.measureText(text).width > box.w - 16) { parts.splice(2, 1); text = parts.join('  ·  '); }
    c.fillText(k.ellipsize(c, text, box.w - 16), box.x + box.w - 4, box.y + 4);
    c.restore();
  }

  function overlays(dt) {
    if (near) {
      near.age += dt;
      if (near.age > 1.6) near = null;
      else {
        c.save();
        c.globalAlpha = k.clamp((1.6 - near.age) * 2);
        c.font = k.font(13, 800, 'mono');
        c.fillStyle = '#fff';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const y = p.y + H / 2 + (p.y + H / 2 < box.y + box.h / 2 ? H * 0.9 : -H * 0.9);
        c.fillText(near.text, k.clamp(p.x + W / 2, box.x + 80, box.x + box.w - 80), y - near.age * 14);
        c.restore();
      }
    }
    if (banner) {
      banner.age += dt;
      const a = banner.age;
      if (a > 2.6 && !k.reduced) { banner = null; return; }
      const sIn = k.ease.outBack(k.clamp(a / 0.45));
      const f = k.fit(c, banner.text, box.w - 30, { size: Math.min(64, box.h * 0.4), min: 18, weight: 900, family: 'display' });
      c.save();
      c.translate(box.x + box.w / 2, box.y + box.h / 2);
      c.rotate(-0.06 + Math.sin(a * 10) * 0.02 * (1 - k.clamp(a)));
      c.scale(sIn, sIn);
      c.globalAlpha = k.clamp((2.6 - a) * 2.5);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 8;
      c.lineJoin = 'round';
      c.strokeStyle = '#000';
      c.strokeText(f.text, 0, 0);
      const g = c.createLinearGradient(-f.size * 3, 0, f.size * 3, 0);
      COLORS.slice(0, 7).forEach((col, i) => g.addColorStop(i / 6, col));
      c.fillStyle = g;
      c.fillText(f.text, 0, 0);
      c.restore();
    }
  }

  cv.resized = (w, h, { dprOnly } = {}) => (dprOnly ? sprites.clear() : layout());
  disc = discText();
  layout();

  if (k.reduced) { // the still: a hair's breadth from the corner, forever
    p.x = box.x + box.w - W - 3;
    p.y = box.y + box.h - H;
    near = { age: 0, text: '3px. SO CLOSE.' };
  }

  k.on(k.root, 'pointerdown', (e) => {
    if (e.clientX < p.x || e.clientX > p.x + W || e.clientY < p.y || e.clientY > p.y + H) return;
    p.vx = Math.sign(p.x + W / 2 - e.clientX || 1) * SPEED;
    p.vy = Math.sign(p.y + H / 2 - e.clientY || 1) * SPEED * k.rand(0.6, 0.9);
    boost = 0.6;
    k.sfx.boing({ gain: 0.6 });
    k.toast('Hey. No touching the logo.', { icon: '📀', ms: 1800 });
  });

  k.loop((dt) => {
    clock += dt;
    boost = Math.max(0, boost - dt * 0.5);
    if (!k.reduced) move(dt);
    c.clearRect(0, 0, cv.w, cv.h);
    c.fillStyle = '#000';
    c.fillRect(0, 0, cv.w, cv.h);
    readout();
    c.drawImage(sprite(COLORS[color]), p.x, p.y, W, H);
    overlays(dt);
  }, { still: 0.05 });

  const refresh = () => { const d = discText(); if (d !== disc) { disc = d; sprites.clear(); } layout(); };

  return {
    question: refresh,
    layout,
    status: refresh,
    answer() { boost = 1; color = (color + 3) % COLORS.length; k.sfx.whoosh({ gain: 0.4 }); },
  };
}
