// Meme board. A corkboard of polaroids: classic meme layouts, redrawn from scratch and captioned
// with this question's options. The ★ always gets the approving panel. The two-buttons guy sweats
// harder the longer you take, and your answer gets stamped.

const INK = '#2a1d12';
const PINS = ['#e63946', '#2a9df4', '#ffb703', '#43aa8b', '#9b5de5', '#f15bb5'];
const NOTES = ['#ffe873', '#ffb3c7', '#b8f0a8', '#a8dcff', '#ffd08a'];
const SCRIBBLES = ['ship it?', 'TODO: decide', 'ask the duck', '★ = trust me', 'LGTM', 'no meetings\non wed', "it's fine", 'meme review\n3pm', 'bigger brain\npls', "DON'T PANIC", 'v2 maybe', 'who wrote\nthis?', 'sweat less', 'one more\nquestion', 'vibes ✓'];
const CAPTIONS = {
  buttons: ['me, every question', 'Q{n} be like', 'decisions, decisions', 'no pressure'],
  nahyeah: ['the ★ never misses', 'chef knows best', 'Q{n}, as a meme', 'correct opinion'],
  brain: ['galaxy brain', 'ascension', 'brain gains', 'big think energy'],
  changemind: ['nobody has', "he's been there all day", 'still waiting', 'go on, try'],
};

const off = (w, h, dpr) => {
  const el = document.createElement('canvas');
  el.width = Math.ceil(w * dpr);
  el.height = Math.ceil(h * dpr);
  const g = el.getContext('2d');
  g.scale(dpr, dpr);
  return { el, g };
};

export default function memeBoard(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  let cork = null; // cork texture, per viewport size
  let board = null; // cork + decor, per layout
  let boardAt = null; // what it was baked from, to re-bake at a new DPR
  let items = []; // the pinned memes: { spr, x, y, rot, age, delay, pin, kind, stamp, sweat, look }
  let falling = [];
  let label = '';
  let placedAt = ''; // the gaps the board was laid out for
  const gapsKey = () => k.space().gaps.map((g) => `${g.where}${Math.round(g.x)},${Math.round(g.y)},${Math.round(g.w)},${Math.round(g.h)}`).join('|');

  // ── text ──
  function box(g, text, x, y, w, h, { size = 18, min = 7, weight = 800, family = 'sans', color = '#111', align = 'center', lh = 1.14 } = {}) {
    let s = size, lines;
    for (;;) {
      g.font = k.font(s, weight, family);
      lines = k.wrap(g, text, w, Math.max(1, Math.floor(h / (s * lh))));
      const whole = String(text).split(/\s+/).every((wd) => g.measureText(wd).width <= w);
      if ((whole && lines.length * s * lh <= h && !lines.at(-1)?.endsWith('…')) || s <= min) break;
      s = Math.max(min, Math.floor(s * 0.9));
    }
    Object.assign(g, { fillStyle: color, textAlign: align, textBaseline: 'middle' });
    const ax = align === 'center' ? x + w / 2 : align === 'left' ? x : x + w;
    const top = y + (h - lines.length * s * lh) / 2;
    lines.forEach((l, i) => g.fillText(l, ax, top + s * lh * (i + 0.5)));
  }
  const line = (g, w, color = INK) => Object.assign(g, { lineWidth: w, strokeStyle: color, lineJoin: 'round', lineCap: 'round' });
  const blob = (g, fill, stroke) => { g.fillStyle = fill; g.fill(); if (stroke) g.stroke(); };

  // ── the meme drawings, all original, in image coords ──
  function chef(g, px, py, pw, ph, yes) {
    const u = ph, cx = px + pw * 0.48;
    line(g, u * 0.018);
    g.beginPath(); g.ellipse(cx, py + ph * 1.06, pw * 0.44, ph * 0.3, 0, 0, Math.PI * 2); blob(g, '#fbfbf8', 1); // jacket
    g.fillStyle = INK;
    for (const dx of [-0.07, 0.07]) for (const dy of [0.88, 0.96]) { g.beginPath(); g.arc(cx + dx * u, py + dy * ph, u * 0.016, 0, 7); g.fill(); }
    g.beginPath(); g.rect(cx - u * 0.06, py + ph * 0.62, u * 0.12, ph * 0.16); blob(g, '#e8b58c', 1);
    const hx = cx + (yes ? u * 0.02 : -u * 0.03), hy = py + ph * 0.5, r = u * 0.19;
    g.save(); g.translate(hx, hy); g.rotate(yes ? 0.06 : -0.16);
    g.beginPath(); g.ellipse(yes ? -r * 0.92 : r * 0.92, r * 0.1, r * 0.2, r * 0.26, 0, 0, 7); blob(g, '#e8b58c', 1); // ear
    g.beginPath(); g.ellipse(0, 0, r, r * 1.08, 0, 0, 7); blob(g, '#f1c9a0', 1);
    g.beginPath(); g.ellipse(0, r * 0.75, r * 0.6, r * 0.32, 0, 0, Math.PI); blob(g, 'rgba(60,35,20,.25)'); // stubble
    g.beginPath(); g.rect(-r * 0.92, -r * 1.02, r * 1.84, r * 0.36); blob(g, '#fff', 1); // toque band
    g.beginPath();
    g.arc(-r * 0.55, -r * 1.25, r * 0.5, Math.PI * 0.6, Math.PI * 1.6);
    g.arc(0, -r * 1.62, r * 0.62, Math.PI * 1.1, Math.PI * 1.9);
    g.arc(r * 0.55, -r * 1.25, r * 0.5, Math.PI * 1.4, Math.PI * 0.4);
    g.closePath(); blob(g, '#fff', 1);
    line(g, u * 0.012, 'rgba(0,0,0,.18)');
    g.beginPath(); g.moveTo(-r * 0.2, -r * 1.05); g.quadraticCurveTo(-r * 0.25, -r * 1.5, -r * 0.1, -r * 1.8); g.moveTo(r * 0.25, -r * 1.05); g.quadraticCurveTo(r * 0.3, -r * 1.4, r * 0.45, -r * 1.55); g.stroke();
    line(g, u * 0.016);
    const f = yes ? 1 : -1; // which way the face looks
    if (yes) {
      for (const ex of [0.05, 0.5]) {
        g.beginPath(); g.ellipse(ex * r, -r * 0.12, r * 0.15, r * 0.11, 0, 0, 7); blob(g, '#fff', 1);
        g.beginPath(); g.arc(ex * r + r * 0.06, -r * 0.1, r * 0.06, 0, 7); blob(g, INK);
      }
      g.beginPath(); g.moveTo(-r * 0.08, -r * 0.42); g.quadraticCurveTo(r * 0.05, -r * 0.6, r * 0.2, -r * 0.42); g.stroke(); // raised brow
      g.beginPath(); g.moveTo(r * 0.38, -r * 0.33); g.lineTo(r * 0.66, -r * 0.3); g.stroke();
      g.beginPath(); g.moveTo(r * 0.02, r * 0.38); g.quadraticCurveTo(r * 0.4, r * 0.62, r * 0.72, r * 0.3); g.stroke(); // smirk
    } else {
      for (const ex of [-0.6, -0.15]) { g.beginPath(); g.arc(ex * r, -r * 0.1, r * 0.13, Math.PI * 0.1, Math.PI * 0.9); g.stroke(); }
      g.beginPath(); g.moveTo(-r * 0.78, -r * 0.4); g.lineTo(-r * 0.45, -r * 0.3); g.moveTo(-r * 0.3, -r * 0.3); g.lineTo(0, -r * 0.42); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.62, r * 0.48); g.quadraticCurveTo(-r * 0.4, r * 0.36, -r * 0.18, r * 0.5); g.stroke(); // grimace
    }
    g.beginPath(); g.moveTo(f * r * 0.3, -r * 0.02); g.quadraticCurveTo(f * r * 0.62, r * 0.22, f * r * 0.32, r * 0.24); g.stroke(); // nose
    g.restore();
    line(g, u * 0.018);
    if (yes) { // arm out, finger pointing at the text
      const ax = cx + u * 0.12, ay = py + ph * 0.86, fx = px + pw * 0.92, fy = py + ph * 0.6;
      g.beginPath(); g.moveTo(ax, ay - u * 0.07); g.lineTo(fx - u * 0.12, fy - u * 0.05); g.lineTo(fx - u * 0.12, fy + u * 0.07); g.lineTo(ax, ay + u * 0.08); g.closePath(); blob(g, '#fbfbf8', 1);
      g.beginPath(); g.ellipse(fx - u * 0.08, fy + u * 0.01, u * 0.065, u * 0.06, 0, 0, 7); blob(g, '#f1c9a0', 1);
      g.beginPath(); g.roundRect(fx - u * 0.06, fy - u * 0.035, u * 0.12, u * 0.035, u * 0.017); blob(g, '#f1c9a0', 1);
    } else { // palm up, pushing the text away
      const hx2 = px + pw * 0.86, hy2 = py + ph * 0.44;
      g.beginPath(); g.moveTo(cx + u * 0.12, py + ph); g.lineTo(hx2 - u * 0.03, hy2 + u * 0.1); g.lineTo(hx2 + u * 0.1, hy2 + u * 0.14); g.lineTo(cx + u * 0.3, py + ph); g.closePath(); blob(g, '#fbfbf8', 1);
      for (let i = 0; i < 4; i++) { g.beginPath(); g.roundRect(hx2 - u * 0.06 + i * u * 0.045, hy2 - u * (0.17 - Math.abs(i - 1.4) * 0.02), u * 0.042, u * 0.16, u * 0.02); blob(g, '#f1c9a0', 1); }
      g.beginPath(); g.ellipse(hx2 + u * 0.01, hy2 + u * 0.03, u * 0.1, u * 0.08, 0, 0, 7); blob(g, '#f1c9a0', 1);
      g.beginPath(); g.ellipse(hx2 - u * 0.1, hy2 + u * 0.05, u * 0.03, u * 0.065, -0.6, 0, 7); blob(g, '#f1c9a0', 1);
    }
  }

  const MEMES = {
    nahyeah(g, w, h, d) {
      const cw = w * 0.46, ph = h / 2;
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      [0, 1].forEach((i) => {
        const gr = g.createLinearGradient(0, i * ph, cw, (i + 1) * ph);
        gr.addColorStop(0, '#ffc93c'); gr.addColorStop(1, '#f39a1d');
        g.save(); g.beginPath(); g.rect(0, i * ph, cw, ph); g.clip();
        g.fillStyle = gr; g.fillRect(0, i * ph, cw, ph);
        chef(g, 0, i * ph, cw, ph, i === 1);
        g.restore();
      });
      g.fillStyle = '#222'; g.fillRect(0, ph - 0.5, w, 1); g.fillRect(cw - 0.5, 0, 1, h);
      box(g, d.no, cw + w * 0.04, h * 0.03, w - cw - w * 0.08, ph - h * 0.06, { size: w * 0.08, weight: 700, color: '#555' });
      box(g, d.yes, cw + w * 0.04, ph + h * 0.03, w - cw - w * 0.08, ph - h * 0.06, { size: w * 0.08, weight: 800 });
      g.strokeStyle = 'rgba(200,0,0,.75)'; g.lineWidth = 1.4; // the rejected one gets a scribble through it
      g.beginPath(); g.moveTo(cw + w * 0.05, ph * 0.52); g.lineTo(w - w * 0.05, ph * 0.48); g.stroke();
      return {};
    },

    buttons(g, w, h, d) {
      const ht = h * 0.56;
      g.fillStyle = '#3f4c60'; g.fillRect(0, 0, w, ht);
      g.fillStyle = 'rgba(255,255,255,.05)'; for (let x = 0; x < w; x += w / 9) g.fillRect(x, 0, 1, ht);
      const pr = [w * 0.05, ht * 0.5, w * 0.9, ht * 0.46];
      let gr = g.createLinearGradient(0, pr[1], 0, pr[1] + pr[3]);
      gr.addColorStop(0, '#d5d9df'); gr.addColorStop(1, '#868d97');
      g.fillStyle = gr; g.beginPath(); g.roundRect(...pr, w * 0.03); g.fill();
      line(g, 1.2, 'rgba(0,0,0,.4)'); g.stroke();
      [[0.3, d.a, -0.05], [0.7, d.b, 0.04]].forEach(([fx, text, rot]) => {
        const bx = w * fx, by = ht * 0.78, rx = w * 0.11, ry = w * 0.045;
        g.fillStyle = '#3a3e44'; g.beginPath(); g.ellipse(bx, by + ry * 0.4, rx * 1.18, ry * 1.25, 0, 0, 7); g.fill();
        g.fillStyle = '#9b111e'; g.fillRect(bx - rx, by - ry * 1.2, rx * 2, ry * 1.4); g.beginPath(); g.ellipse(bx, by + ry * 0.2, rx, ry, 0, 0, Math.PI); g.fill();
        gr = g.createRadialGradient(bx - rx * 0.35, by - ry * 1.6, 1, bx, by - ry * 1.2, rx);
        gr.addColorStop(0, '#ff8a8a'); gr.addColorStop(0.4, '#ee2b2b'); gr.addColorStop(1, '#b3121f');
        g.fillStyle = gr; g.beginPath(); g.ellipse(bx, by - ry * 1.2, rx, ry, 0, 0, 7); g.fill();
        g.save(); g.translate(bx, ht * 0.25); g.rotate(rot); // label taped above each button
        const lw = w * 0.42, lh = ht * 0.4;
        g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
        g.fillStyle = '#fdfdf6'; g.fillRect(-lw / 2, -lh / 2, lw, lh); g.shadowColor = 'transparent';
        g.fillStyle = 'rgba(255,240,170,.75)'; g.fillRect(-w * 0.05, -lh / 2 - w * 0.02, w * 0.1, w * 0.04);
        box(g, text, -lw / 2 + 3, -lh / 2 + 2, lw - 6, lh - 4, { size: w * 0.06, weight: 800 });
        g.restore();
      });
      g.fillStyle = '#89b4d8'; g.fillRect(0, ht, w, h - ht); // the sweating guy
      g.fillStyle = '#222'; g.fillRect(0, ht - 0.5, w, 1);
      const hb = h - ht, fx = w * 0.5, fy = ht + hb * 0.6, r = hb * 0.4;
      line(g, w * 0.008);
      g.beginPath(); g.ellipse(fx, fy + r * 1.25, r * 1.5, r * 0.55, 0, 0, 7); blob(g, '#2f5d8a', 1);
      g.beginPath(); g.rect(fx - r * 0.25, fy + r * 0.6, r * 0.5, r * 0.4); blob(g, '#e3b088', 1);
      g.beginPath(); g.ellipse(fx - r * 0.86, fy + r * 0.05, r * 0.14, r * 0.2, 0, 0, 7); blob(g, '#e3b088', 1);
      g.beginPath(); g.ellipse(fx + r * 0.86, fy + r * 0.05, r * 0.14, r * 0.2, 0, 0, 7); blob(g, '#e3b088', 1);
      g.beginPath(); g.ellipse(fx, fy, r * 0.86, r * 0.92, 0, 0, 7); blob(g, '#f1c9a0', 1);
      g.beginPath(); g.moveTo(fx - r * 0.86, fy - r * 0.2); g.bezierCurveTo(fx - r * 0.95, fy - r * 1.15, fx + r * 0.95, fy - r * 1.15, fx + r * 0.86, fy - r * 0.2); g.quadraticCurveTo(fx + r * 0.5, fy - r * 0.62, fx - r * 0.05, fy - r * 0.6); g.quadraticCurveTo(fx - r * 0.55, fy - r * 0.58, fx - r * 0.86, fy - r * 0.2); blob(g, '#4a2f1f', 1);
      const eyes = [[fx - r * 0.32, fy - r * 0.05], [fx + r * 0.32, fy - r * 0.05]];
      for (const [ex, ey] of eyes) { g.beginPath(); g.ellipse(ex, ey, r * 0.2, r * 0.15, 0, 0, 7); blob(g, '#fff', 1); }
      line(g, w * 0.011);
      g.beginPath(); g.moveTo(fx - r * 0.56, fy - r * 0.2); g.lineTo(fx - r * 0.14, fy - r * 0.36); g.moveTo(fx + r * 0.56, fy - r * 0.2); g.lineTo(fx + r * 0.14, fy - r * 0.36); g.stroke(); // worried brows
      line(g, w * 0.007);
      g.beginPath(); g.moveTo(fx, fy + r * 0.05); g.quadraticCurveTo(fx + r * 0.14, fy + r * 0.24, fx - r * 0.04, fy + r * 0.26); g.stroke();
      g.beginPath(); g.roundRect(fx - r * 0.32, fy + r * 0.4, r * 0.64, r * 0.2, r * 0.07); blob(g, '#fff', 1); // teeth, clenched
      g.beginPath(); for (let i = 1; i < 4; i++) { g.moveTo(fx - r * 0.32 + i * r * 0.16, fy + r * 0.4); g.lineTo(fx - r * 0.32 + i * r * 0.16, fy + r * 0.6); } g.moveTo(fx - r * 0.32, fy + r * 0.5); g.lineTo(fx + r * 0.32, fy + r * 0.5); g.stroke();
      line(g, w * 0.008);
      g.beginPath(); g.moveTo(fx - r * 1.05, fy - r * 0.05); g.quadraticCurveTo(fx - r * 0.95, fy - r * 0.62, fx - r * 0.5, fy - r * 0.62); g.lineTo(fx - r * 0.15, fy - r * 0.48); g.quadraticCurveTo(fx - r * 0.55, fy - r * 0.35, fx - r * 0.72, fy + r * 0.05); g.closePath(); blob(g, '#fff', 1); // hanky
      g.fillStyle = 'rgba(220,40,50,.5)'; g.fillRect(fx - r * 0.85, fy - r * 0.5, r * 0.4, r * 0.06); g.fillRect(fx - r * 0.95, fy - r * 0.3, r * 0.3, r * 0.06);
      g.beginPath(); g.ellipse(fx - r * 1.02, fy + r * 0.12, r * 0.2, r * 0.26, -0.3, 0, 7); blob(g, '#f1c9a0', 1); // hand
      g.beginPath(); g.rect(fx - r * 1.32, fy + r * 0.25, r * 0.45, hb); blob(g, '#2f5d8a', 1);
      return { eyes, er: r * 0.2, brow: [fx - r * 0.1, fy - r * 0.62, r * 0.75], clipY: ht };
    },

    brain(g, w, h, d) {
      const n = d.rows.length, rh = h / n, tw = w * 0.52;
      d.rows.forEach((text, i) => {
        const y = i * rh, lv = Math.round((i / (n - 1)) * 3);
        g.fillStyle = '#fff'; g.fillRect(0, y, tw, rh);
        box(g, text, w * 0.03, y + rh * 0.08, tw - w * 0.06, rh * 0.84, { size: w * 0.068, weight: lv === 3 ? 800 : 600 });
        g.save(); g.beginPath(); g.rect(tw, y, w - tw, rh); g.clip();
        const gr = g.createRadialGradient(tw + (w - tw) * 0.55, y + rh * 0.4, 1, tw + (w - tw) * 0.5, y + rh * 0.5, w * 0.4);
        gr.addColorStop(0, ['#1a1a1a', '#1c2433', '#1d3e66', '#6fd2ff'][lv]); gr.addColorStop(1, ['#050505', '#06080e', '#06142a', '#20144a'][lv]);
        g.fillStyle = gr; g.fillRect(tw, y, w - tw, rh);
        const hx = tw + (w - tw) * 0.56, hy = y + rh * 0.58, r = rh * 0.36;
        const bx = hx + r * 0.05, by = hy - r * 0.28, br = r * (0.3 + lv * 0.17);
        if (lv === 3) {
          g.save(); g.translate(bx, by);
          for (let j = 0; j < 18; j++) {
            g.rotate((Math.PI * 2) / 18);
            const rg = g.createLinearGradient(0, 0, w * 0.4, 0);
            rg.addColorStop(0, 'rgba(255,255,255,.85)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = rg; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.4, -w * 0.018); g.lineTo(w * 0.4, w * 0.018); g.fill();
          }
          g.restore();
        }
        if (lv >= 2) for (let j = 0; j < 14; j++) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(tw + ((j * 53) % 97) / 97 * (w - tw), y + ((j * 37) % 89) / 89 * rh, 1.2, 1.2); }
        g.fillStyle = lv === 3 ? 'rgba(255,255,255,.35)' : lv === 2 ? 'rgba(170,215,255,.28)' : 'rgba(170,190,210,.22)';
        g.beginPath(); g.ellipse(hx, hy, r * 0.88, r, 0, 0, 7); g.fill(); // see-through head, facing left
        g.beginPath(); g.moveTo(hx - r * 0.84, hy - r * 0.1); g.lineTo(hx - r * 1.08, hy + r * 0.22); g.lineTo(hx - r * 0.8, hy + r * 0.3); g.fill();
        g.fillRect(hx - r * 0.25, hy + r * 0.8, r * 0.55, rh);
        g.save();
        g.shadowColor = ['transparent', 'rgba(255,120,170,.6)', 'rgba(120,220,255,1)', '#fff'][lv];
        g.shadowBlur = [0, 6, 14, 26][lv];
        g.fillStyle = ['#e98aa0', '#f7a8bf', '#d8f3ff', '#ffffff'][lv];
        g.beginPath();
        for (let j = 0; j < 7; j++) { const a = (j / 7) * Math.PI * 2; g.moveTo(bx + Math.cos(a) * br * 0.45 + br * 0.5, by + Math.sin(a) * br * 0.32); g.arc(bx + Math.cos(a) * br * 0.45, by + Math.sin(a) * br * 0.32, br * 0.5, 0, 7); }
        g.fill();
        g.restore();
        line(g, Math.max(0.8, br * 0.06), ['#a8475f', '#c25a7a', '#5aa8d8', '#9adfff'][lv]);
        g.beginPath();
        for (let j = 0; j < 4; j++) { const yy = by - br * 0.5 + j * br * 0.32; g.moveTo(bx - br * 0.7, yy); g.bezierCurveTo(bx - br * 0.3, yy - br * 0.25, bx + br * 0.1, yy + br * 0.25, bx + br * 0.7, yy - br * 0.05); }
        g.stroke();
        g.restore();
        g.fillStyle = '#111'; g.fillRect(0, y + rh - 0.5, w, 1);
      });
      g.fillStyle = '#111'; g.fillRect(tw - 0.5, 0, 1, h);
      return {};
    },

    changemind(g, w, h, d) {
      let gr = g.createLinearGradient(0, 0, 0, h * 0.55);
      gr.addColorStop(0, '#a9d4f0'); gr.addColorStop(1, '#e4f1f7');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9b79c'; g.fillRect(w * 0.62, h * 0.16, w * 0.4, h * 0.4); // a campus building
      g.fillStyle = '#a8957a'; for (let i = 0; i < 4; i++) g.fillRect(w * (0.66 + i * 0.085), h * 0.22, w * 0.05, h * 0.08);
      for (const [x, y, r] of [[0.08, 0.36, 0.14], [0.22, 0.3, 0.12], [0.55, 0.4, 0.1], [0.95, 0.42, 0.12]]) { g.fillStyle = '#5c9a43'; g.beginPath(); g.arc(w * x, h * y, w * r, 0, 7); g.fill(); }
      g.fillStyle = '#79b85a'; g.fillRect(0, h * 0.5, w, h * 0.5);
      const cx = w * 0.42, r = w * 0.085;
      line(g, w * 0.008);
      g.beginPath(); g.roundRect(cx - w * 0.16, h * 0.42, w * 0.32, h * 0.3, w * 0.06); blob(g, '#2e3f6b', 1);
      g.beginPath(); g.ellipse(cx, h * 0.31, r, r * 1.1, 0, 0, 7); blob(g, '#f1c9a0', 1);
      g.beginPath(); g.ellipse(cx, h * 0.36, r * 0.85, r * 0.65, 0, 0.1, Math.PI - 0.1); blob(g, '#6b4a2f', 1); // beard
      g.beginPath(); g.ellipse(cx, h * 0.245, r * 1.02, r * 0.6, 0, Math.PI, 0); blob(g, '#2f6b4a', 1); // cap
      g.beginPath(); g.ellipse(cx + r * 0.7, h * 0.25, r * 0.7, r * 0.18, 0.05, 0, 7); blob(g, '#24563b', 1);
      g.fillStyle = INK; for (const ex of [-0.35, 0.35]) { g.beginPath(); g.arc(cx + ex * r, h * 0.3, r * 0.1, 0, 7); g.fill(); }
      line(g, w * 0.007); g.beginPath(); g.arc(cx, h * 0.34, r * 0.3, 0.3, Math.PI - 0.3); g.stroke();
      g.fillStyle = '#8a6a48'; g.fillRect(w * 0.06, h * 0.6, w * 0.88, h * 0.04); // table top
      const mx = w * 0.72, my = h * 0.53; // the mug
      line(g, w * 0.006); g.beginPath(); g.roundRect(mx, my, w * 0.07, h * 0.075, 2); blob(g, '#f4f4f4', 1);
      g.beginPath(); g.arc(mx + w * 0.075, my + h * 0.035, w * 0.02, -1.4, 1.4); g.stroke();
      g.save(); g.translate(w * 0.5, h * 0.79); g.rotate(-0.012); // the sign
      const sw = w * 0.8, sh = h * 0.3;
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 5; g.shadowOffsetY = 2;
      g.fillStyle = '#fbfbf7'; g.fillRect(-sw / 2, -sh / 2, sw, sh); g.shadowColor = 'transparent';
      box(g, d.text, -sw / 2 + 5, -sh / 2 + 4, sw - 10, sh * 0.6, { size: w * 0.07, weight: 800 });
      box(g, 'CHANGE MY MIND', -sw / 2 + 5, sh * 0.13, sw - 10, sh * 0.32, { size: w * 0.075, weight: 900, family: 'display' });
      g.restore();
      return { steam: [mx + w * 0.035, my] };
    },
  };

  // ── what goes on the board for this card ──
  function memes() {
    const q = ctx.question;
    const n = q?.n ?? (ctx.front === 'done' ? ctx.progress.total : 0);
    const R = k.rng(q?.id || ctx.front);
    let list;
    if (ctx.front === 'done') {
      const pct = ctx.recRate === null ? null : Math.round(ctx.recRate * 100);
      const count = ctx.decisions.length || ctx.answers.length;
      list = [
        { kind: 'nahyeah', no: 'One more meeting about it', yes: `${count} decision${count === 1 ? '' : 's'} in one sitting` },
        { kind: 'brain', rows: ['Deciding nothing', 'Deciding something', `Deciding ${count} thing${count === 1 ? '' : 's'}`, pct === null ? 'Letting the agent write it all down' : `Taking the ★ ${pct}% of the time`] },
        { kind: 'changemind', text: 'This grill went well' },
      ];
    } else if (!q) {
      list = [
        { kind: 'buttons', a: 'Wait patiently', b: 'Refresh 40 times' },
        { kind: 'nahyeah', no: 'Reading the whole codebase yourself', yes: 'Letting the agent read it' },
        { kind: 'changemind', text: 'The first question is almost ready' },
      ];
    } else if (!q.options.length) {
      list = [
        { kind: 'nahyeah', no: 'Typing "idk"', yes: 'Writing a thoughtful answer' },
        { kind: 'buttons', a: 'Say what you really think', b: 'Say "whatever you think"' },
        { kind: 'brain', rows: ['Looking for the options', 'Realising there are none', 'Writing your own answer'] },
      ];
    } else {
      const opts = q.options.map((o) => o.label);
      const rec = q.recommended[0];
      const others = opts.filter((l) => !q.recommended.includes(l));
      const nah = rec ? { kind: 'nahyeah', no: others.length ? R.pick(others) : 'Overthinking it', yes: rec } : { kind: 'nahyeah', no: 'Picking one of these', yes: 'Writing your own answer' };
      const btn = opts.length >= 2 ? { kind: 'buttons', a: rec || opts[0], b: rec ? R.pick(others.length ? others : opts.filter((l) => l !== rec)) || 'Write my own' : opts[1] } : { kind: 'buttons', a: opts[0], b: 'Write my own' };
      const brain = { kind: 'brain', rows: ['Not answering', ...R.shuffle(others).slice(0, 2), ...(rec ? [rec] : [])].slice(-4) };
      if (brain.rows.length < 3) brain.rows.splice(1, 0, 'Asking for more context');
      const mind = { kind: 'changemind', text: rec ? `${rec} is the answer` : `There is no right answer` };
      list = [btn, nah, R.chance(0.5) || opts.length < 3 ? mind : brain];
      if (opts.length >= 3 && R.chance(0.5)) list[0] = brain;
      if (list[0].kind === list[2].kind) list[2] = mind;
    }
    return list.map((m) => ({ ...m, caption: R.pick(CAPTIONS[m.kind]).replace('{n}', n || '?'), pin: R.pick(PINS) }));
  }

  // Polaroid sprite: frame, the meme, a handwritten caption, the shadow baked in.
  function polaroid(P, m) {
    const pad = 26, fm = P * 0.055, iw = P - 2 * fm, ih = iw, H = fm + ih + P * 0.2;
    const { el, g } = off(P + pad * 2, H + pad * 2, cv.dpr);
    g.translate(pad, pad);
    g.save(); g.shadowColor = 'rgba(40,20,0,.55)'; g.shadowBlur = 16; g.shadowOffsetY = 8; g.shadowOffsetX = 3;
    g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, P, H); g.restore();
    const gr = g.createLinearGradient(0, 0, P, H);
    gr.addColorStop(0, '#fdfbf5'); gr.addColorStop(1, '#e9e3d3');
    g.fillStyle = gr; g.fillRect(0, 0, P, H);
    g.save(); g.beginPath(); g.rect(fm, fm, iw, ih); g.clip(); g.translate(fm, fm);
    const anchors = MEMES[m.kind](g, iw, ih, m);
    const gl = g.createLinearGradient(0, 0, iw, ih); // a little gloss
    gl.addColorStop(0, 'rgba(255,255,255,.16)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, iw, ih);
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.strokeRect(fm + 0.5, fm + 0.5, iw - 1, ih - 1);
    g.save(); g.translate(P / 2, fm + ih + (H - fm - ih) / 2); g.rotate(-0.02);
    const f = k.fit(g, m.caption, P * 0.86, { size: P * 0.085, min: 9, weight: 600, family: 'hand' });
    Object.assign(g, { fillStyle: '#22306e', textAlign: 'center', textBaseline: 'middle' });
    g.fillText(f.text, 0, 0);
    g.restore();
    return { el, w: P + pad * 2, h: H + pad * 2, pad, P, H, fm, iw, ih, anchors };
  }

  // Dymo label tape for the top gap.
  function dymo(g, text, x, y, maxW) {
    const f = k.fit(g, text, maxW - 30, { size: 15, min: 10, weight: 800, family: 'mono' });
    const tw = g.measureText(f.text).width + 30, th = f.size * 1.9;
    g.save(); g.translate(x + tw / 2, y); g.rotate(-0.012);
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 5; g.shadowOffsetY = 2;
    g.fillStyle = '#16161c'; g.beginPath(); g.roundRect(-tw / 2, -th / 2, tw, th, 2); g.fill(); g.shadowColor = 'transparent';
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(-tw / 2, -th / 2, tw, th * 0.3);
    Object.assign(g, { textAlign: 'center', textBaseline: 'middle', font: f.font });
    g.fillStyle = 'rgba(0,0,0,.8)'; g.fillText(f.text, 0.8, 1.2);
    g.fillStyle = '#ecebe6'; g.fillText(f.text, 0, 0);
    g.restore();
  }

  function makeCork() {
    const { el, g } = off(cv.w, cv.h, 1);
    const R = k.rng(7);
    const gr = g.createRadialGradient(cv.w / 2, cv.h * 0.45, 50, cv.w / 2, cv.h / 2, Math.max(cv.w, cv.h) * 0.75);
    gr.addColorStop(0, '#c9965e'); gr.addColorStop(1, '#8f6036');
    g.fillStyle = gr; g.fillRect(0, 0, cv.w, cv.h);
    for (let i = 0, n = (cv.w * cv.h) / 40; i < n; i++) {
      const d = R.next();
      g.fillStyle = d < 0.5 ? `rgba(70,38,12,${R.rand(0.1, 0.35)})` : d < 0.85 ? `rgba(240,200,140,${R.rand(0.08, 0.25)})` : `rgba(30,15,5,${R.rand(0.2, 0.5)})`;
      g.fillRect(R.rand(cv.w), R.rand(cv.h), R.rand(0.8, 2.6), R.rand(0.8, 2.2));
    }
    for (let i = 0; i < 40; i++) { // old pin holes
      g.fillStyle = 'rgba(30,14,4,.55)';
      g.beginPath(); g.arc(R.rand(cv.w), R.rand(cv.h), 1.2, 0, 7); g.fill();
    }
    return el;
  }

  function pinAt(g, x, y, color, s = 1) {
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath(); g.ellipse(x + 4 * s, y + 5 * s, 6 * s, 4 * s, 0.4, 0, 7); g.fill();
    const gr = g.createRadialGradient(x - 2 * s, y - 2.5 * s, 0.5, x, y, 7 * s);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = color; g.beginPath(); g.arc(x, y, 6.5 * s, 0, 7); g.fill();
    g.fillStyle = gr; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
  }

  // Sticky notes, index cards and doodles around the memes. Blurred under the side panels, which is fine.
  function makeBoard(rects, top) {
    cork ||= makeCork();
    const { el, g } = off(cv.w, cv.h, cv.dpr);
    g.drawImage(cork, 0, 0, cv.w, cv.h);
    const R = k.rng(ctx.question?.id || ctx.front);
    const sp = k.space();
    const avoid = [...rects, ...(sp.card ? [{ x: sp.card.left - 10, y: sp.card.top - 10, w: sp.card.width + 20, h: sp.card.height + 20 }] : []), ...(top ? [top] : [])];
    const hit = (x, y, w, h) => avoid.some((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
    const cell = 150;
    for (let gy = -30; gy < cv.h; gy += cell * 0.9) for (let gx = -30; gx < cv.w; gx += cell) {
      const kind = R.pick(['note', 'note', 'note', 'card', 'photo', 'receipt', 'pin']);
      const w = kind === 'card' ? 130 : kind === 'receipt' ? 70 : kind === 'pin' ? 14 : kind === 'photo' ? 92 : 96;
      const h = kind === 'card' ? 84 : kind === 'receipt' ? 130 : kind === 'pin' ? 14 : kind === 'photo' ? 108 : 96;
      const x = gx + R.rand(0, cell - w * 0.6), y = gy + R.rand(0, cell * 0.9 - h * 0.6);
      if (hit(x, y, w, h)) continue;
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(R.rand(-0.12, 0.12));
      g.shadowColor = 'rgba(40,20,0,.45)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
      if (kind === 'pin') { g.shadowColor = 'transparent'; pinAt(g, 0, 0, R.pick(PINS), 0.9); g.restore(); continue; }
      const fill = kind === 'note' ? R.pick(NOTES) : kind === 'photo' ? '#f4f0e6' : '#fbfaf4';
      g.fillStyle = fill; g.fillRect(-w / 2, -h / 2, w, h);
      g.shadowColor = 'transparent';
      if (kind === 'note') {
        g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(-w / 2, -h / 2, w, 14);
        Object.assign(g, { fillStyle: '#2b2b33', textAlign: 'center', textBaseline: 'middle', font: k.font(15, 600, 'hand') });
        const lines = R.pick(SCRIBBLES).split('\n');
        lines.forEach((l, i) => g.fillText(l, 0, 6 + (i - (lines.length - 1) / 2) * 18));
      } else if (kind === 'card') {
        g.strokeStyle = 'rgba(80,120,200,.35)'; g.lineWidth = 1;
        for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(-w / 2, -h / 2 + 10 + i * 13); g.lineTo(w / 2, -h / 2 + 10 + i * 13); g.stroke(); }
        g.strokeStyle = 'rgba(220,60,60,.4)'; g.beginPath(); g.moveTo(-w / 2, -h / 2 + 16); g.lineTo(w / 2, -h / 2 + 16); g.stroke();
        Object.assign(g, { fillStyle: '#2a3a8a', textAlign: 'left', textBaseline: 'alphabetic', font: k.font(13, 600, 'hand') });
        g.fillText(R.pick(['Ideas:', 'Memes to make:', 'Q4 goals:', 'Questions:']), -w / 2 + 8, -h / 2 + 13);
        for (let i = 0; i < 3; i++) g.fillText(R.pick(['- more memes', '- decide stuff', '- ★ ★ ★', '- touch grass', '- ship it', '- ask why x5']), -w / 2 + 10, -h / 2 + 37 + i * 13);
      } else if (kind === 'photo') {
        const ph = R.pick(['sun', 'cat', 'chart', 'star']);
        g.fillStyle = ph === 'star' ? '#222b3d' : ph === 'chart' ? '#f6f6f2' : '#8ec5e8'; g.fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, w - 12);
        const cx = 0, cy = -h / 2 + w / 2;
        if (ph === 'sun') { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(cx + 10, cy - 8, 14, 0, 7); g.fill(); g.fillStyle = '#5ea34a'; g.fillRect(-w / 2 + 6, cy + 14, w - 12, 26); }
        if (ph === 'cat') { g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(cx, cy + 6, 22, 0, 7); g.moveTo(cx - 20, cy - 4); g.lineTo(cx - 14, cy - 26); g.lineTo(cx - 4, cy - 14); g.moveTo(cx + 20, cy - 4); g.lineTo(cx + 14, cy - 26); g.lineTo(cx + 4, cy - 14); g.fill(); g.fillStyle = '#ffd23f'; g.fillRect(cx - 10, cy + 2, 6, 6); g.fillRect(cx + 4, cy + 2, 6, 6); }
        if (ph === 'chart') { g.strokeStyle = '#2a9d55'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 30, cy + 25); g.lineTo(cx - 10, cy + 8); g.lineTo(cx, cy + 15); g.lineTo(cx + 30, cy - 28); g.stroke(); }
        if (ph === 'star') { Object.assign(g, { fillStyle: '#ffd23f', font: k.font(44, 400, 'sans'), textAlign: 'center', textBaseline: 'middle' }); g.fillText('★', cx, cy); }
      } else {
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.setLineDash([2, 3]);
        for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(-w / 2 + 8, -h / 2 + 14 + i * 12); g.lineTo(w / 2 - 8 - (i % 3) * 8, -h / 2 + 14 + i * 12); g.stroke(); }
        g.setLineDash([]);
      }
      if (kind !== 'receipt') pinAt(g, 0, -h / 2 + 8, R.pick(PINS), 0.8);
      else { g.fillStyle = 'rgba(255,240,170,.7)'; g.fillRect(-14, -h / 2 - 5, 28, 12); }
      g.restore();
    }
    if (top) dymo(g, label, top.x, top.y + top.h / 2, top.w);
    return el;
  }

  // Lay the memes out in the visible gaps around the card, as big as fits, then bake the board.
  function place(animate) {
    const sp = k.space();
    placedAt = gapsKey();
    const list = memes();
    const slots = [];
    for (const gap of sp.gaps) {
      if (gap.where === 'top' || slots.length >= 3) continue;
      for (let P = 230; P >= 120; P -= 10) {
        const H = P * 1.15 + 20; // a bottom polaroid may hang off the screen, as long as its picture shows
        if ((gap.where === 'bottom' && gap.y + gap.h >= cv.h - 2 ? P * 0.98 + 18 : H) > gap.h - 20) continue;
        const n = Math.min(3 - slots.length, Math.floor((gap.w - 20) / (P + 26)));
        if (n < 1) continue;
        const span = n * P + (n - 1) * 26;
        const y = gap.y + Math.max(12, (gap.h - H) / 2 + 12);
        for (let i = 0; i < n; i++) slots.push({ x: gap.x + (gap.w - span) / 2 + i * (P + 26) + P / 2, y, P });
        break;
      }
    }
    const low = !slots.length && sp.gaps.find((g) => g.where === 'bottom' && g.h >= 50);
    if (low) { // a tall card: the polaroids peek up from the bottom edge instead
      const P = k.clamp((low.w - 60) / 3.3, 130, 200), n = Math.min(3, Math.floor((low.w - 20) / (P + 26)));
      const span = n * P + (n - 1) * 26;
      for (let i = 0; i < n; i++) slots.push({ x: low.x + (low.w - span) / 2 + i * (P + 26) + P / 2, y: low.y + 10, P });
    }
    // with room for one, show the approve/disapprove meme: the ★ always wins it
    const order = slots.length === 1 ? [list.find((m) => m.kind === 'nahyeah')] : slots.length === 2 ? [list[0], list[1]] : list;
    const R = k.rng(`${ctx.question?.id || ctx.front}:rot`);
    const old = items;
    items = slots.map((s, i) => {
      const m = order[i];
      const spr = polaroid(s.P, m);
      const prev = animate ? null : old.find((o) => o.kind === m.kind);
      // a re-layout keeps each polaroid where it was in its drop-in (and its swing), so the clack still plays
      return { m, kind: m.kind, spr, x: s.x, y: s.y, rot: R.rand(-0.07, 0.07), phase: R.rand(6), age: prev ? prev.age : 0, delay: prev ? prev.delay : animate ? 0.25 + i * 0.16 : 0, landed: prev ? prev.landed : !animate, stamp: prev?.stamp || null, sweat: prev?.sweat || [], seeded: prev?.seeded, wv: prev?.wv, wa: prev?.wa, look: 0, lookT: 0, calm: prev?.calm || 0 };
    });
    if (animate) for (const o of old) falling.push({ ...o, vx: k.rand(-60, 60), vy: k.rand(-160, -60), spin: k.rand(-2, 2) });
    const q = ctx.question;
    label = ctx.front === 'done' ? 'MEME REVIEW · FINAL CUT' : q ? `MEME REVIEW · Q${q.n} OF ${q.total}` : 'MEME REVIEW · LOADING';
    const topGap = sp.gaps.find((g) => g.where === 'top' && g.h >= 34);
    const top = topGap && { x: topGap.x + 18, y: topGap.y + 4, w: Math.min(360, topGap.w - 36), h: topGap.h - 8 };
    const rects = items.map((it) => ({ x: it.x - it.spr.P / 2 - 14, y: it.y - 16, w: it.spr.P + 28, h: it.spr.H + 30 }));
    boardAt = [rects, top];
    board = makeBoard(rects, top);
    if (k.reduced) for (const it of items) { it.landed = true; it.delay = 0; it.age = 9; }
  }

  function stampSprite(text, color) {
    const s = 26;
    const { g } = off(1, 1, 1);
    g.font = k.font(s, 900, 'display');
    const tw = g.measureText(text).width + 26, th = s * 1.6;
    const o = off(tw + 8, th + 8, cv.dpr);
    const x = o.g;
    x.translate(4, 4);
    Object.assign(x, { strokeStyle: color, fillStyle: color, lineWidth: 3.5, font: k.font(s, 900, 'display'), textAlign: 'center', textBaseline: 'middle' });
    x.beginPath(); x.roundRect(0, 0, tw, th, 6); x.stroke();
    x.lineWidth = 1.5; x.beginPath(); x.roundRect(4, 4, tw - 8, th - 8, 4); x.stroke();
    x.fillText(text, tw / 2, th / 2 + 1);
    x.globalCompositeOperation = 'destination-out'; // worn rubber
    const R = k.rng(text);
    for (let i = 0; i < 160; i++) { x.globalAlpha = R.rand(0.3, 1); x.fillRect(R.rand(tw), R.rand(th), R.rand(1, 3), R.rand(1, 2)); }
    return { el: o.el, w: tw + 8, h: th + 8 };
  }

  function stamp(it, text, color) {
    it.stamp = { spr: stampSprite(text, color), text, color, age: k.reduced ? 9 : 0, rot: k.rand(-0.35, -0.15), thud: false };
  }

  // A DPR change only re-bakes the sprites: the memes keep their swing, sweat, stamps and drop-in.
  function rebake() {
    for (const it of [...items, ...falling]) it.spr = polaroid(it.spr.P, it.m);
    for (const it of items) if (it.stamp) it.stamp.spr = stampSprite(it.stamp.text, it.stamp.color);
    board = makeBoard(...boardAt);
  }
  cv.resized = (w, h, { dprOnly } = {}) => { if (dprOnly) return rebake(); cork = null; place(false); };
  place(false);
  if (!k.reduced) for (const it of items) { it.landed = false; it.delay = 0.2 + items.indexOf(it) * 0.16; it.age = 0; }

  function drawItem(it, dt, t) {
    const { spr } = it;
    const p = Math.max(0, it.age - it.delay);
    const e = k.ease.outCubic(k.clamp(p / 0.45));
    if (p <= 0) return;
    if (!it.landed && p > 0.42) { it.landed = true; k.sfx.clack({ pitch: k.rand(0.7, 0.9), gain: 0.7 }); }
    it.wv = (it.wv || 0) + (-60 * (it.wa || 0) - 2.2 * (it.wv || 0)) * dt; // swings on its pin
    it.wa = (it.wa || 0) + it.wv * dt;
    const sway = Math.sin(t * 0.7 + it.phase) * 0.012 + it.wa;
    const lift = (1 - e) * 1;
    c.save();
    c.translate(it.x, it.y - lift * 30);
    c.rotate(it.rot + sway + lift * 0.2);
    c.scale(1 + lift * 0.2, 1 + lift * 0.2);
    c.globalAlpha = e;
    const ox = -spr.P / 2, oy = -spr.fm * 0.55;
    c.drawImage(spr.el, ox - spr.pad, oy - spr.pad, spr.w, spr.h);
    c.translate(ox + spr.fm, oy + spr.fm); // image coords from here
    if (it.kind === 'buttons') drawSweat(it, dt, t);
    if (it.kind === 'changemind' && spr.anchors.steam) drawSteam(spr.anchors.steam, t);
    if (it.stamp) {
      const s = it.stamp;
      s.age += dt;
      const sp = k.clamp(s.age / 0.22);
      if (sp >= 1 && !s.thud) { s.thud = true; k.sfx.thud({ gain: 0.8 }); it.wv = (it.wv || 0) + 1.4; }
      c.save();
      c.translate(spr.iw / 2, spr.ih * 0.55);
      c.rotate(s.rot);
      const sc = (1 + (1 - k.ease.inQuad(sp)) * 1.4) * Math.min(1, (spr.iw * 0.9) / s.spr.w);
      c.scale(sc, sc);
      c.globalAlpha = 0.88 * k.clamp(sp * 2);
      c.drawImage(s.spr.el, -s.spr.w / 2, -s.spr.h / 2, s.spr.w, s.spr.h);
      c.restore();
    }
    c.restore();
    pinAt(c, it.x, it.y - lift * 60 - (1 - e) * 20, it.m.pin, 1 + lift * 0.5);
  }

  // The two-buttons guy: eyes dart between the buttons, sweat beads up faster the longer you take.
  function drawSweat(it, dt, t) {
    const a = it.spr.anchors;
    it.lookT -= dt;
    if (it.lookT <= 0) { it.lookT = k.rand(0.35, 1.2); it.lookTo = it.lookTo === -1 ? 1 : -1; }
    it.look += ((it.calm > 0 ? 0 : it.lookTo || 0) - it.look) * Math.min(1, dt * 14);
    c.fillStyle = INK;
    for (const [ex, ey] of a.eyes) { c.beginPath(); c.arc(ex + it.look * a.er * 0.5, ey - a.er * 0.15, a.er * 0.42, 0, 7); c.fill(); }
    const panic = it.calm > 0 ? 0 : 0.5 + Math.min(4, ctx.cardTime / 15) + (ctx.typing ? 1.5 : 0);
    it.calm = Math.max(0, it.calm - dt);
    const bead = (y = 0) => {
      const [bx, by, bw] = a.brow;
      const max = a.er * k.rand(0.3, 0.45);
      it.sweat.push({ x: bx + k.rand(bw), y: by + k.rand(-2, 6) + y, r: y ? max : 0, v: 0, max });
    };
    if (!it.seeded) { it.seeded = true; for (let i = 0; i < 3; i++) bead(i * a.er * 0.9); }
    if (!k.reduced && k.chance(panic * dt)) bead();
    c.save(); c.beginPath(); c.rect(0, a.clipY, it.spr.iw, it.spr.ih - a.clipY); c.clip();
    for (let i = it.sweat.length - 1; i >= 0; i--) {
      const d = it.sweat[i];
      if (d.r < d.max) d.r = Math.min(d.max, d.r + dt * 3);
      else { d.v += dt * 40; d.y += d.v * dt; }
      if (d.y > it.spr.ih + 10) { it.sweat.splice(i, 1); continue; }
      c.fillStyle = 'rgba(150,215,255,.9)';
      c.beginPath(); c.moveTo(d.x, d.y - d.r * 1.8); c.quadraticCurveTo(d.x + d.r, d.y - d.r * 0.2, d.x, d.y + d.r); c.quadraticCurveTo(d.x - d.r, d.y - d.r * 0.2, d.x, d.y - d.r * 1.8); c.fill();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(d.x - d.r * 0.35, d.y - d.r * 0.4, d.r * 0.3, d.r * 0.5);
    }
    c.restore();
  }

  function drawSteam([x, y], t) {
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.4; c.lineCap = 'round';
    for (let j = 0; j < 2; j++) {
      c.beginPath();
      for (let i = 0; i <= 10; i++) { const yy = y - 2 - i * 1.6; const xx = x - 2 + j * 4 + Math.sin(i * 0.8 - t * 4 + j * 2) * 1.6; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.globalAlpha = 0.5 + Math.sin(t * 2 + j) * 0.3; c.stroke();
    }
    c.globalAlpha = 1;
  }

  k.on(cv.el, 'pointerdown', (e) => { // flick a polaroid and it swings
    const it = items.find((o) => Math.abs(e.clientX - o.x) < o.spr.P / 2 && e.clientY > o.y - 10 && e.clientY < o.y + o.spr.H);
    if (!it) return;
    it.wv = (it.wv || 0) + (e.clientX < it.x ? -1 : 1) * k.rand(2.5, 4);
    k.sfx.clack({ pitch: 0.6, gain: 0.5 });
  });

  k.loop((dt, t) => {
    c.drawImage(board, 0, 0, cv.w, cv.h);
    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.spin * dt;
      if (f.y > cv.h + 100) { falling.splice(i, 1); continue; }
      c.save(); c.translate(f.x, f.y); c.rotate(f.rot);
      c.drawImage(f.spr.el, -f.spr.P / 2 - f.spr.pad, -f.spr.fm * 0.55 - f.spr.pad, f.spr.w, f.spr.h);
      c.restore();
    }
    for (const it of items) { it.age += dt; drawItem(it, dt, t); }
  }, { still: 2 });

  return {
    question() {
      falling = [];
      place(!k.reduced);
    },
    layout() {
      if (gapsKey() !== placedAt) place(false); // the stage stopping scrolling moves nothing: keep the board
    },
    answer(a) {
      const nah = items.find((it) => it.kind === 'nahyeah');
      const btn = items.find((it) => it.kind === 'buttons');
      if (btn) { btn.calm = 9; btn.sweat.forEach((d) => { d.r = d.max; d.v = 80; }); }
      const target = nah || items[0];
      if (!target) return;
      if (!a.picks?.length) stamp(target, 'FREESTYLE', '#1d5fd1');
      else if (a.tookRec) stamp(target, 'APPROVED', '#d0202a');
      else if (a.hasRec) stamp(target, 'BOLD MOVE', '#7a1fd1');
      else stamp(target, 'NOTED', '#d0202a');
    },
    decisions() {
      if (ctx.front === 'done') place(false);
    },
  };
}
