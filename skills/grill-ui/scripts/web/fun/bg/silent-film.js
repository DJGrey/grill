// Silent film. A flickering sepia melodrama at 18 frames a second: the villain twirls his moustache,
// the recommended option is tied to the tracks, and the train gets closer the longer you take.
// Cuts to title cards that narrate the question.

const FPS = 18;
const INK = '#16110c';
const PALE = '#ece2cb';
const CREAM = '#f3ead5';
const ROMAN = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const roman = (n) => { let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s || 'O'; };
const TRAIN_S = 150; // seconds on the card until the train arrives (and politely waits)

export default function silentFilm(k, ctx) {
  const cv = k.canvas({ alpha: false });
  const c = cv.ctx;
  const quote = (s, n = 60) => `“${k.clip(s, n)}”`;

  // ── stock: grain tiles, vignette, steam puff ──────────────────────────────
  const grain = [0, 1, 2].map(() => {
    const g = document.createElement('canvas');
    g.width = g.height = 180;
    const x = g.getContext('2d');
    const img = x.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random();
      const light = v > 0.5;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 20;
      img.data[i + 3] = Math.random() < 0.55 ? Math.abs(v - 0.5) * 110 : 0;
    }
    x.putImageData(img, 0, 0);
    return c.createPattern(g, 'repeat');
  });
  const puff = (() => {
    const p = document.createElement('canvas');
    p.width = p.height = 64;
    const x = p.getContext('2d');
    const r = x.createRadialGradient(32, 32, 4, 32, 32, 32);
    r.addColorStop(0, 'rgba(246,238,222,.95)');
    r.addColorStop(0.55, 'rgba(226,214,192,.6)');
    r.addColorStop(1, 'rgba(210,198,176,0)');
    x.fillStyle = r;
    x.fillRect(0, 0, 64, 64);
    return p;
  })();
  let vignette = null;
  let backdrop = null;

  // ── layout ────────────────────────────────────────────────────────────────
  let L = null; // { panel, B, s, TY, cx, HY }
  function measure() {
    const sp = k.space();
    const B = sp.gaps.find((g) => g.where === 'bottom' && g.h >= 70 && g.w >= 220);
    const panel = (B && B.h >= 96 && B) || sp.gaps.find((g) => g.w >= 240 && g.h >= 70) || null;
    const stage = sp.stage;
    const plateH = B && k.reduced ? (B.h < 150 ? B.h - 10 : Math.min(B.h * 0.36, 86)) : 0;
    const s = !B ? 0.7 : plateH ? k.clamp((B.h - plateH - 30) / 160, 0.45, 1.25) : k.clamp(B.h / 225, 0.55, 1.25);
    const TY = !B ? sp.vh - 34 : plateH ? B.y + B.h - Math.max(14, 22 * s) : B.y + B.h - Math.max(26, B.h * 0.2);
    const cx = B ? B.x + B.w / 2 : stage.x + stage.width / 2;
    L = { panel, B, s, TY, cx, plateH, HY: TY - 92 * s, stage };
    paintBackdrop();
    paintVignette();
  }

  function paintVignette() {
    vignette = document.createElement('canvas');
    vignette.width = 320;
    vignette.height = 200;
    const x = vignette.getContext('2d');
    const r = x.createRadialGradient(160, 100, 40, 160, 100, 205);
    r.addColorStop(0, 'rgba(20,12,4,0)');
    r.addColorStop(0.6, 'rgba(20,12,4,.18)');
    r.addColorStop(1, 'rgba(10,6,2,.85)');
    x.fillStyle = r;
    x.fillRect(0, 0, 320, 200);
  }

  // The painted set: sky, hills, telegraph poles and the railway, drawn once per layout.
  function paintBackdrop() {
    const { s, TY, HY } = L;
    const W = cv.w, H = cv.h;
    backdrop = document.createElement('canvas');
    backdrop.width = Math.round(W * cv.dpr);
    backdrop.height = Math.round(H * cv.dpr);
    const b = backdrop.getContext('2d');
    b.scale(cv.dpr, cv.dpr);
    const R = k.rng('silent-set');
    const sky = b.createLinearGradient(0, 0, 0, HY + 20);
    sky.addColorStop(0, '#cdbd9c');
    sky.addColorStop(0.7, '#e3d6bb');
    sky.addColorStop(1, '#ebe0c8');
    b.fillStyle = sky;
    b.fillRect(0, 0, W, H);
    // painted clouds
    for (let i = 0; i < 9; i++) {
      const x = R.rand(W), y = R.rand(HY * 0.15, HY * 0.8), w = R.rand(90, 220);
      b.fillStyle = 'rgba(247,240,226,.55)';
      for (let j = 0; j < 5; j++) {
        b.beginPath();
        b.ellipse(x + (j - 2) * w * 0.2, y + R.rand(-6, 6), w * R.rand(0.16, 0.26), w * R.rand(0.07, 0.12), 0, 0, Math.PI * 2);
        b.fill();
      }
    }
    // far and near hills
    const hills = (base, amp, col, seed) => {
      const r = k.rng(seed);
      const ph = [r.rand(6), r.rand(6), r.rand(6)];
      b.fillStyle = col;
      b.beginPath();
      b.moveTo(0, H);
      for (let x = 0; x <= W + 10; x += 10) b.lineTo(x, base - amp * (0.55 + 0.3 * Math.sin(x / 210 + ph[0]) + 0.17 * Math.sin(x / 83 + ph[1]) + 0.06 * Math.sin(x / 31 + ph[2])));
      b.lineTo(W, H);
      b.fill();
    };
    hills(HY + 6, 70 * s, '#b8a888', 'far');
    hills(HY + 18, 38 * s, '#9f8f70', 'near');
    // ground
    const gr = b.createLinearGradient(0, HY, 0, H);
    gr.addColorStop(0, '#8d7d60');
    gr.addColorStop(1, '#6d5f48');
    b.fillStyle = gr;
    b.fillRect(0, HY + 14, W, H);
    b.strokeStyle = 'rgba(40,30,20,.35)';
    b.lineWidth = 1;
    for (let i = 0; i < W / 5; i++) { // grass tufts
      const x = R.rand(W), y = R.rand(HY + 22, H), h = R.rand(3, 8) * s;
      b.beginPath();
      b.moveTo(x - 2, y); b.lineTo(x - 3, y - h);
      b.moveTo(x, y); b.lineTo(x + 0.5, y - h * 1.2);
      b.moveTo(x + 2, y); b.lineTo(x + 4, y - h);
      b.stroke();
    }
    // telegraph poles and sagging wires
    const gap = 210 * s, py = TY - 16 * s, ph = 112 * s;
    b.strokeStyle = '#3c3126';
    for (let x = (L.cx % gap) - gap; x < W + gap; x += gap) {
      b.lineWidth = 3.2 * s;
      b.beginPath(); b.moveTo(x, py); b.lineTo(x, py - ph); b.stroke();
      b.lineWidth = 2.4 * s;
      b.beginPath(); b.moveTo(x - 14 * s, py - ph + 8 * s); b.lineTo(x + 14 * s, py - ph + 8 * s); b.stroke();
      b.lineWidth = 0.8;
      for (const dx of [-11, 11]) {
        b.beginPath();
        b.moveTo(x + dx * s, py - ph + 7 * s);
        b.quadraticCurveTo(x + gap / 2 + dx * s, py - ph + 26 * s, x + gap + dx * s, py - ph + 7 * s);
        b.stroke();
      }
    }
    // gravel bed, sleepers, rails
    b.fillStyle = '#5b4d3b';
    b.fillRect(0, TY - 3 * s, W, 12 * s);
    b.fillStyle = 'rgba(0,0,0,.18)';
    b.fillRect(0, TY + 9 * s, W, 3 * s);
    for (let x = -10; x < W + 20; x += 17 * s) {
      b.fillStyle = '#3d3226';
      b.beginPath();
      b.moveTo(x, TY + 5 * s); b.lineTo(x + 9 * s, TY + 5 * s); b.lineTo(x + 12 * s, TY - 3 * s); b.lineTo(x + 4 * s, TY - 3 * s);
      b.fill();
    }
    b.fillStyle = '#2a221a';
    b.fillRect(0, TY - 6 * s, W, 2.6 * s);
    b.fillRect(0, TY - 1 * s, W, 3.2 * s);
    b.fillStyle = 'rgba(240,230,210,.5)';
    b.fillRect(0, TY - 1 * s, W, 0.8);
  }

  // ── the cast ──────────────────────────────────────────────────────────────
  const line = (pts, w, col = INK) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.stroke();
  };
  const disc = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const shadow = (x, y, rx) => { c.fillStyle = 'rgba(20,12,4,.28)'; c.beginPath(); c.ellipse(x, y, rx, rx * 0.18, 0, 0, Math.PI * 2); c.fill(); };

  // The villain, facing right. pose: 'twirl' | 'walk' | 'cackle' | 'fist' | 'bow' | 'watch'
  function villain(x, y, s, f, pose, dir = 1) {
    c.save();
    c.translate(x, y);
    shadow(0, 0, 26 * s);
    c.scale(s * dir, s);
    const walk = pose === 'walk' ? Math.sin(f * 0.9) : 0;
    const bob = pose === 'cackle' ? Math.abs(Math.sin(f * 1.4)) * 3 : pose === 'walk' ? Math.abs(walk) * 2 : Math.sin(f * 0.35);
    line([-5, -44, -7 - walk * 9, -3], 7);
    line([5, -44, 7 + walk * 9, -3], 7);
    c.fillStyle = INK;
    c.beginPath(); c.ellipse(-5 - walk * 9, -2, 7, 3, 0, 0, Math.PI * 2); c.ellipse(9 + walk * 9, -2, 7, 3, 0, 0, Math.PI * 2); c.fill();
    c.translate(0, -44 - bob);
    if (pose === 'bow') c.rotate(Math.max(0, Math.sin(f * 0.22)) * 0.85);
    // cape
    const fl = Math.sin(f * 0.6) * 2;
    c.fillStyle = INK;
    c.beginPath();
    c.moveTo(-12, -40); c.lineTo(12, -40);
    c.quadraticCurveTo(20, -12, 22 + fl, 6);
    c.lineTo(-27 - fl, 8);
    c.quadraticCurveTo(-24, -14, -12, -40);
    c.fill();
    c.fillStyle = '#d8ccb2';
    c.beginPath(); c.moveTo(-3, -40); c.lineTo(5, -40); c.lineTo(2, -24); c.fill();
    const head = pose === 'cackle' ? -0.35 : pose === 'fist' ? 0.1 : 0;
    // arm behind
    if (pose !== 'bow') line([-6, -36, -14, -22, -6, -16], 5.5, '#0d0906');
    c.save();
    c.translate(2, -44);
    c.rotate(head);
    // head, hat, face
    disc(0, -6, 11, '#d9c9a8');
    c.fillStyle = '#b9a685';
    c.beginPath(); c.arc(0, -6, 11, Math.PI * 0.6, Math.PI * 1.25); c.fill();
    c.fillStyle = INK;
    c.beginPath(); c.ellipse(0, -14, 17, 3.4, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-10, -15); c.lineTo(-11, -43); c.lineTo(11, -43); c.lineTo(10, -15); c.fill();
    c.fillStyle = '#5c4f3f';
    c.fillRect(-10.5, -21, 21, 3);
    line([2, -12, 9, -9.5], 2);
    disc(7, -7.5, 1.6, INK);
    c.fillStyle = '#d9c9a8';
    c.beginPath(); c.moveTo(10, -8); c.quadraticCurveTo(16, -4, 10, -2); c.fill();
    // the moustache
    c.strokeStyle = INK; c.lineWidth = 2.6; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(9, 0); c.bezierCurveTo(14, 1, 20, 0, 21, -5); c.arc(18.5, -5, 2.5, 0, -Math.PI * 1.2, true);
    c.moveTo(9, 0); c.bezierCurveTo(4, 1, -1, -1, -1, -5); c.arc(1.5, -5, 2.5, Math.PI, Math.PI * 2.2, false);
    c.stroke();
    if (pose === 'cackle') { c.fillStyle = INK; c.beginPath(); c.ellipse(9, 4, 3, 2.4, 0, 0, Math.PI * 2); c.fill(); }
    c.restore();
    // front arm
    if (pose === 'twirl') {
      const a = f * 0.75;
      const hx = 22 + Math.cos(a) * 3.5, hy = -50 + Math.sin(a) * 3;
      line([6, -36, 18, -30, hx, hy], 5.5);
      disc(hx, hy, 3.4, '#d9c9a8');
    } else if (pose === 'cackle') {
      line([6, -36, 16, -22, 22, -28], 5.5);
      disc(22, -29, 3.4, '#d9c9a8');
    } else if (pose === 'fist') {
      const sh = Math.sin(f * 2.2) * 4;
      line([6, -36, 14, -50, 14 + sh, -64], 5.5);
      disc(14 + sh, -66, 4.4, '#d9c9a8');
    } else if (pose === 'watch') {
      line([6, -36, 14, -26, 22, -30], 5.5);
      disc(24, -31, 4.2, '#cbbd9a');
      c.strokeStyle = INK; c.lineWidth = 1;
      c.beginPath(); c.arc(24, -31, 4.2, 0, Math.PI * 2); c.moveTo(24, -31); c.lineTo(24 + Math.cos(f * 0.5) * 3, -31 + Math.sin(f * 0.5) * 3); c.stroke();
      line([24, -35, 12, -40], 0.7, '#8a7a5c');
    } else if (pose === 'bow') {
      line([6, -36, 20, -20, 30, -12], 5.5);
      disc(30, -12, 3.4, '#d9c9a8');
    } else {
      line([6, -36, 9 + walk * 8, -18], 5.5);
    }
    c.restore();
  }

  // The recommended option, tied to the tracks, head towards the train. Kicks a lot.
  function damsel(x, y, s, f, calm) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    const wig = calm ? 0 : Math.sin(f * 1.3);
    // hair spilling over the rail
    c.fillStyle = '#2b2118';
    c.beginPath();
    c.moveTo(44, -24); c.bezierCurveTo(62, -24, 66, -8, 70 + wig * 2, 2); c.bezierCurveTo(60, -2, 52, 0, 40, -6); c.fill();
    // boots
    const kick = calm ? 0 : Math.sin(f * 1.7);
    c.save(); c.translate(-50, -12); c.rotate(-0.4 - Math.max(0, kick) * 0.7);
    c.fillStyle = INK; c.beginPath(); c.ellipse(-6, 0, 7, 3.5, 0, 0, Math.PI * 2); c.fill(); c.restore();
    c.save(); c.translate(-52, -8); c.rotate(-0.1 - Math.max(0, -kick) * 0.8);
    c.fillStyle = INK; c.beginPath(); c.ellipse(-7, 0, 7, 3.5, 0, 0, Math.PI * 2); c.fill(); c.restore();
    // dress
    c.fillStyle = PALE;
    c.strokeStyle = '#3b2f22';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(-50, -18); c.quadraticCurveTo(-10, -26 - wig, 26, -24);
    c.quadraticCurveTo(34, -20, 32, -10);
    c.lineTo(-50, -6);
    c.closePath(); c.fill(); c.stroke();
    c.beginPath();
    for (let i = 0; i < 4; i++) c.arc(-50, -8 - i * 3.2, 2, -Math.PI / 2, Math.PI / 2, true);
    c.stroke();
    // ropes
    for (const rx of [-32, -10, 14]) {
      line([rx - 2, -25, rx + 2, -6], 2.6, '#4a3b29');
      line([rx - 1.4, -24, rx + 1.4, -7], 0.8, '#c9b48e');
    }
    disc(-6, -27 - wig, 2.5, '#4a3b29');
    // head, lifted in horror, facing us
    c.save();
    c.translate(41, -19);
    c.rotate(calm ? 0 : -0.15 + wig * 0.1);
    c.fillStyle = '#2b2118';
    c.beginPath(); c.ellipse(4, 1, 11, 10.5, 0, 0, Math.PI * 2); c.fill();
    disc(0, 0, 8.6, '#e6d8ba');
    c.beginPath(); c.arc(0, -1, 9.2, Math.PI * 1.05, Math.PI * 1.95); c.fillStyle = '#2b2118'; c.fill();
    disc(-6.5, -6.5, 3.2, '#2b2118'); disc(6.5, -6.5, 3.2, '#2b2118');
    disc(-3, 0.5, 1.4, INK); disc(3, 0.5, 1.4, INK);
    line([-4.8, -3.6, -1.5, -2.6], 0.9); line([4.8, -3.6, 1.5, -2.6], 0.9);
    c.fillStyle = '#3b1f14';
    c.beginPath(); c.ellipse(0, 4.6, 1.7, calm ? 0.6 : 2.3, 0, 0, Math.PI * 2); c.fill();
    disc(-5, 3, 1.6, 'rgba(160,110,90,.35)'); disc(5, 3, 1.6, 'rgba(160,110,90,.35)');
    c.restore();
    c.restore();
  }

  // Standing up for the curtain call.
  function damselStanding(x, y, s, f) {
    c.save();
    c.translate(x, y);
    shadow(0, 0, 22 * s);
    c.scale(s, s);
    const dip = Math.max(0, Math.sin(f * 0.22 + 0.6)) * 7;
    c.translate(0, dip);
    c.fillStyle = PALE; c.strokeStyle = '#3b2f22'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-7, -56); c.lineTo(7, -56); c.quadraticCurveTo(10, -30, 22, -3 - dip); c.lineTo(-22, -3 - dip); c.quadraticCurveTo(-10, -30, -7, -56); c.fill(); c.stroke();
    c.beginPath(); for (let i = -20; i < 20; i += 5) c.arc(i + 2.5, -3 - dip, 2.5, Math.PI, 0, true); c.stroke();
    line([-6, -52, -15, -36, -18, -12 - dip], 3.5, '#e2d3b4');
    line([6, -52, 15, -36, 18, -12 - dip], 3.5, '#e2d3b4');
    disc(0, -66, 9, '#e2d3b4');
    c.fillStyle = '#2b2118';
    c.beginPath(); c.arc(0, -67, 9.6, Math.PI * 1.02, Math.PI * 1.98); c.fill();
    disc(0, -78, 5, '#2b2118');
    disc(-3, -65, 1.1, INK); disc(3, -65, 1.1, INK);
    line([-2.5, -61, 0, -60, 2.5, -61], 1);
    c.restore();
  }

  // The sign stuck in the ballast next to her: what she is. Fitted once per text and scale.
  let signFit = null;
  function sign(x, y, s, text) {
    c.save();
    c.translate(x, y);
    if (signFit?.text !== text || signFit.s !== s) {
      const fit = k.fit(c, text, 150 * s, { size: 13 * s, min: 9 * s, weight: 700, family: 'hand' });
      signFit = { text, s, fit, tw: c.measureText(fit.text).width };
    }
    const { fit, tw } = signFit;
    c.font = fit.font;
    const w = Math.max(54 * s, tw + 18 * s), h = 24 * s;
    line([0, 0, 0, -62 * s], 3.4 * s, '#3c3126');
    c.rotate(-0.04);
    c.fillStyle = 'rgba(20,12,4,.3)';
    c.fillRect(-w / 2 + 2, -64 * s - h + 3, w, h);
    c.fillStyle = '#cdbb98';
    c.fillRect(-w / 2, -64 * s - h, w, h);
    c.strokeStyle = '#4a3b29'; c.lineWidth = 1.2;
    c.strokeRect(-w / 2, -64 * s - h, w, h);
    c.fillStyle = '#21180f';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(fit.text, 0, -64 * s - h / 2 + 1);
    c.restore();
  }

  // A steam locomotive facing left, front of the cowcatcher at x.
  function train(x, y, s, f, moving, waving) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    shadow(85, 2, 90);
    // headlamp beam
    const beam = c.createLinearGradient(16, 0, -140, 0);
    beam.addColorStop(0, 'rgba(255,250,232,.42)');
    beam.addColorStop(1, 'rgba(255,250,232,0)');
    c.fillStyle = beam;
    c.beginPath(); c.moveTo(16, -76); c.lineTo(-140, -98); c.lineTo(-140, -40); c.lineTo(16, -68); c.fill();
    c.fillStyle = INK;
    // cowcatcher
    c.beginPath(); c.moveTo(-2, -2); c.lineTo(20, -28); c.lineTo(20, -2); c.fill();
    c.strokeStyle = '#5a4c3b'; c.lineWidth = 1;
    for (let i = 4; i < 20; i += 4) { c.beginPath(); c.moveTo(i, -2); c.lineTo(i + 3, -2 - (i + 3) * 1.18); c.stroke(); }
    // boiler, dome, stack, cab
    c.fillStyle = INK;
    c.beginPath(); c.roundRect(14, -64, 108, 36, [14, 0, 0, 14]); c.fill();
    c.beginPath(); c.arc(76, -64, 9, Math.PI, 0); c.fill();
    c.beginPath(); c.moveTo(27, -64); c.lineTo(22, -98); c.lineTo(46, -98); c.lineTo(39, -64); c.fill();
    c.fillRect(20, -102, 28, 5);
    c.fillRect(116, -94, 56, 66);
    c.fillRect(110, -100, 66, 7);
    c.fillStyle = '#5c4e3c';
    c.fillRect(16, -62, 104, 2.4);
    for (const bx of [48, 96]) c.fillRect(bx, -64, 2.2, 36);
    c.fillStyle = '#e9dcbc';
    c.fillRect(128, -86, 22, 22);
    // engineer in the window
    disc(140, -72, 6, '#1d1610');
    c.fillStyle = '#1d1610'; c.fillRect(133, -80, 14, 4);
    if (waving) line([146, -70, 154, -82, 158 + Math.sin(f * 1.6) * 5, -94], 3, '#1d1610');
    // lamp
    c.fillStyle = INK; c.fillRect(12, -80, 13, 12);
    disc(14, -74, 4.5, '#fffbe8');
    // frame and wheels
    c.fillStyle = INK; c.fillRect(14, -30, 160, 9);
    const rot = moving ? f * 0.9 : 0;
    const wheel = (wx, r) => {
      disc(wx, -r - 1, r, INK);
      c.strokeStyle = '#6d5e4a'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(wx, -r - 1, r - 2, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 6; i++) {
        const a = rot + (i * Math.PI) / 3;
        c.beginPath(); c.moveTo(wx, -r - 1); c.lineTo(wx + Math.cos(a) * (r - 2), -r - 1 + Math.sin(a) * (r - 2)); c.stroke();
      }
      disc(wx, -r - 1, 2.4, '#8a7a5c');
    };
    wheel(30, 8);
    for (const wx of [66, 102, 138]) wheel(wx, 15);
    const cr = 8;
    line([66 + Math.cos(rot) * cr, -16 + Math.sin(rot) * cr, 138 + Math.cos(rot) * cr, -16 + Math.sin(rot) * cr], 3, '#8a7a5c');
    c.restore();
  }

  // ── title cards ───────────────────────────────────────────────────────────
  function ornament(P, a = 1) {
    if (P.h < 76) { // too small for the full frame: one fine rule
      c.globalAlpha = a; c.strokeStyle = '#d9cbac'; c.lineWidth = 1;
      c.strokeRect(P.x + 4, P.y + 4, P.w - 8, P.h - 8);
      c.globalAlpha = 1;
      return;
    }
    const x0 = P.x + 10, y0 = P.y + 8, x1 = P.x + P.w - 10, y1 = P.y + P.h - 8;
    c.globalAlpha = a;
    c.strokeStyle = '#d9cbac';
    c.lineWidth = 2;
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.lineWidth = 0.8;
    c.strokeRect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12);
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      c.save(); c.translate(cx, cy); c.scale(sx, sy);
      c.fillStyle = '#d9cbac';
      c.beginPath(); c.moveTo(6, 6); c.lineTo(15, 6); c.lineTo(6, 15); c.fill();
      c.lineWidth = 1;
      c.beginPath(); c.arc(6, 6, 18, 0, Math.PI / 2); c.stroke();
      c.beginPath(); c.arc(6, 6, 24, 0.15, Math.PI / 2 - 0.15); c.stroke();
      c.restore();
    }
    const mid = (x0 + x1) / 2;
    for (const yy of [y0, y1]) {
      c.fillStyle = '#120d08';
      c.fillRect(mid - 26, yy - 3, 52, 6);
      c.fillStyle = '#d9cbac';
      c.beginPath(); c.moveTo(mid - 7, yy); c.lineTo(mid, yy - 4); c.lineTo(mid + 7, yy); c.lineTo(mid, yy + 4); c.fill();
      disc(mid - 16, yy, 1.8, '#d9cbac'); disc(mid + 16, yy, 1.8, '#d9cbac');
    }
    c.globalAlpha = 1;
  }

  // Lays the words out to fit the panel. big: capitals, small: italic, by: attribution.
  function titleText(P, card, inset = 64) {
    const pad = 44, maxW = Math.min(P.w - pad * 2, 640), maxH = P.h - inset;
    const cxm = P.x + P.w / 2;
    let big = Math.min(46, P.h * 0.24), small = Math.min(25, P.h * 0.14);
    let blines, slines, total;
    for (let i = 0; i < 12; i++) {
      c.font = k.font(big, 700, 'serif');
      c.letterSpacing = `${Math.round(big * 0.08)}px`;
      blines = card.big ? k.wrap(c, card.big, maxW, 2) : [];
      c.letterSpacing = '0px';
      c.font = `italic ${k.font(small, 500, 'serif')}`;
      slines = card.small ? k.wrap(c, card.small, maxW, small < 16 ? 4 : 3) : [];
      total = blines.length * big * 1.12 + slines.length * small * 1.3 + (blines.length && slines.length ? small * 0.6 : 0) + (card.by ? small * 1.4 : 0);
      if (total <= maxH) break;
      big *= 0.9; small = Math.max(11, small * 0.92);
    }
    let y = P.y + P.h / 2 - total / 2;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillStyle = CREAM;
    c.shadowColor = 'rgba(255,240,200,.35)';
    c.shadowBlur = 6;
    c.font = k.font(big, 700, 'serif');
    c.letterSpacing = `${Math.round(big * 0.08)}px`;
    for (const l of blines) { c.fillText(l, cxm, y); y += big * 1.12; }
    c.letterSpacing = '0px';
    if (blines.length && slines.length) y += small * 0.6;
    c.font = `italic ${k.font(small, 500, 'serif')}`;
    for (const l of slines) { c.fillText(l, cxm, y); y += small * 1.3; }
    if (card.by) {
      c.font = k.font(small * 0.72, 600, 'serif');
      c.letterSpacing = '2px';
      c.fillStyle = '#b9ab8c';
      c.fillText(card.by, cxm, y + small * 0.5);
      c.letterSpacing = '0px';
    }
    c.shadowBlur = 0;
  }

  // ── the script ────────────────────────────────────────────────────────────
  const opts = () => ctx.question?.options || [];
  const rec = () => opts().find((o) => o.recommended);
  const rogue = () => opts().find((o) => !o.recommended);
  const mins = (t) => (t < 90 ? `${Math.round(t)} SECONDS` : `${Math.round(t / 60)} MINUTES`);

  function cards() {
    const q = ctx.question;
    if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      return [
        { big: 'THE END', small: `${n} decision${n === 1 ? ' was' : 's were'} made. No developers were harmed in the making of this grill.` },
        { big: 'THE CAST', small: 'The Villain · The Recommended Option · A Reasonable Train · and You, as The Developer' },
        { small: 'Please exit through the lobby. Mind the popcorn.' },
      ];
    }
    if (!q) return [
      { big: 'MEANWHILE,', small: 'THE AGENT DELIBERATES.' },
      { small: ctx.agent === 'listening' ? 'The agent cups a hand to its ear. It is listening.' : 'It reads the codebase by candlelight.' },
      { big: 'INTERMISSION', small: 'The villain has nobody to tie to anything. He is beside himself.' },
      { small: 'The pianist plays something ominous in D minor.' },
    ];
    const r = rec(), o = rogue(), list = [];
    if (r) list.push({ small: `“Help! Somebody pick ‘${k.clip(r.label, 48)}’!”`, by: 'THE RECOMMENDED OPTION, PLEADING' });
    if (o) list.push({ small: `“Choose ‘${k.clip(o.label, 48)}’, my dear developer. Think of the savings…”`, by: 'THE VILLAIN, TWIRLING' });
    if (!opts().length) list.push({ big: 'NO OPTIONS!', small: 'What devilry is this? The developer must write their own ending.' });
    if (q.multi) list.push({ big: 'A RESCUE FOR SEVERAL', small: 'More than one may be saved today. This is a progressive picture.' });
    list.push({ big: 'MEANWHILE,', small: ctx.cardTime > 45 ? `${mins(ctx.cardTime)} PASS. THE AUDIENCE GROWS RESTLESS.` : 'THE AGENT DELIBERATES. AND WAITS.' });
    if (q.total > 1) list.push({ small: `${q.total - q.n ? `${q.total - q.n} more reel${q.total - q.n === 1 ? '' : 's'} to go.` : 'The final reel!'} The pianist cracks his knuckles.` });
    return list;
  }

  const chapter = () => {
    const q = ctx.question;
    if (!q) return null;
    if (q.revising) return { big: 'A FLASHBACK.', small: `We return to Chapter ${roman(q.n)}: ${quote(q.title, 90)}` };
    return { big: `CHAPTER ${roman(q.n)}.`, small: `In which our hero must decide: ${quote(q.title, 110)}` };
  };

  let seg = null; // { kind: 'card'|'pic', card, t, dur, iris }
  let ci = 0;
  let pending = [];
  let picNext = false;
  let answerCard = null, answeredAt = 0;
  let trainArrived = false;
  let typedCard = false;

  function next(first) {
    if (first) {
      ci = 0; pending = []; answerCard = null; trainArrived = false; typedCard = false;
      const ch = ctx.front === 'question' ? chapter() : cards()[0];
      if (ctx.front !== 'question') ci = 1;
      seg = { kind: 'card', card: ch, t: 0, dur: dur(ch), iris: true };
      picNext = true;
      piano(ch);
      return;
    }
    if (picNext) {
      seg = { kind: 'pic', t: 0, dur: k.rand(6.5, 8.5), iris: k.chance(0.4) };
      picNext = false;
      return;
    }
    const list = cards();
    const card = pending.shift() || list[ci++ % list.length];
    seg = { kind: 'card', card, t: 0, dur: dur(card) };
    picNext = true;
    piano(card);
  }
  const dur = (card) => k.clamp(2.6 + ((card.big || '').length + (card.small || '').length) * 0.035, 3.4, 6.5);

  // ── sound: a quiet projector and a honky-tonk pianist ─────────────────────
  let hum = null;
  const sound = (on) => { // and none in a hidden tab
    hum?.stop(0.3);
    hum = on && !document.hidden ? k.sfx.noise({ dur: Infinity, color: 'crackle', filter: 'bandpass', freq: 2400, q: 0.6, gain: 0.018, attack: 0.6 }) : null;
  };
  const key = (n, d = 0, len = 0.7, g = 0.06) => {
    const f = 440 * 2 ** ((n - 69) / 12);
    k.sfx.tone({ type: 'triangle', freq: f, dur: len, gain: g, delay: d, attack: 0.004 });
    k.sfx.tone({ type: 'triangle', freq: f * 1.006, dur: len * 0.8, gain: g * 0.6, delay: d, attack: 0.004 });
  };
  function piano(card) {
    if (!k.sfx.on || !card) return;
    const big = card.big || '';
    if (/SAVED|THE END/.test(big)) [60, 64, 67, 72].forEach((n, i) => key(n, i * 0.09, i === 3 ? 1.2 : 0.4));
    else if (/CURSES|TWIST/.test(big)) [63, 62, 61, 60].forEach((n, i) => key(n - 12, i * 0.16, 0.5, 0.07));
    else if (/VILLAIN/.test(card.by || '')) for (let i = 0; i < 8; i++) key([57, 60, 63, 66][i % 4] - 12, i * 0.06, 0.18, 0.04);
    else [[67, 0], [64, 0.14], [65, 0.28], [62, 0.42]].forEach(([n, d]) => key(n, d, 0.35, 0.04));
  }
  const whistle = () => {
    [0, 0.42].forEach((d) => [523, 659, 784].forEach((f) => k.sfx.tone({ type: 'sine', freq: f * 0.75, dur: 0.34, gain: 0.025, delay: d, attack: 0.04, vibrato: { rate: 9, depth: 4 } })));
  };

  // ── projector ─────────────────────────────────────────────────────────────
  const steam = [];
  let acc = 0, f = 0, wx = 0, wy = 0, flick = 0;
  let scratches = [];
  let burnAt = k.rand(14, 24), slipAt = k.rand(30, 50), slip = 0;

  function trainX() {
    const { cx, s } = L;
    const start = L.stage.x + L.stage.width + 10 * s;
    const stop = cx + 105 * s;
    if (ctx.front === 'done') return stop + 70 * s;
    if (!ctx.question) return start - 120 * s;
    const p = k.reduced ? 0.78 : k.clamp(ctx.cardTime / TRAIN_S);
    return k.lerp(start, stop, k.ease.outQuad(p));
  }

  function picture(dt) {
    const { s, TY, cx } = L;
    c.drawImage(backdrop, 0, 0, cv.w, cv.h);
    const tx = trainX();
    const moving = ctx.question && !k.reduced && ctx.cardTime < TRAIN_S;
    // steam out of the stack
    if (dt > 0) {
      const rate = moving ? 7 : 2.6;
      if (Math.random() < rate * (1 / FPS) * 3) steam.push({ x: tx + 34 * s, y: TY - 100 * s, r: 8 * s, vx: moving ? 26 : 6, vy: -k.rand(18, 34), life: 0, max: k.rand(2, 3.4) });
      for (const p of steam) { p.life += 1 / FPS; p.x += p.vx * (1 / FPS); p.y += p.vy * (1 / FPS); p.r += 10 * s * (1 / FPS); }
      for (let i = steam.length - 1; i >= 0; i--) if (steam[i].life > steam[i].max) steam.splice(i, 1);
    }
    if (ctx.front === 'done') {
      villain(cx - 70 * s, TY - 4 * s, s, f, 'bow');
      damselStanding(cx + 10 * s, TY - 4 * s, s, f);
      train(tx, TY - 4 * s, s, f, false, true);
    } else if (!ctx.question) {
      const span = 220 * s, p = (f / FPS) * 0.12;
      const ph = (p % 2 + 2) % 2;
      const vxp = cx - 150 * s + (ph < 1 ? ph : 2 - ph) * span;
      const watch = Math.floor(p * 2) % 3 === 2;
      sign(cx + 40 * s, TY - 8 * s, s, ctx.agent === 'listening' ? 'BACK SOON. LISTENING.' : 'INTERMISSION');
      villain(vxp, TY - 4 * s, s, f, watch ? 'watch' : 'walk', watch ? 1 : ph < 1 ? 1 : -1);
      train(tx, TY - 4 * s, s, f, false);
    } else {
      const r = rec();
      const pose = answerCard ? (ctx.lastAnswer?.tookRec ? 'fist' : 'cackle') : Math.floor(f / (FPS * 3)) % 3 === 2 ? 'cackle' : 'twirl';
      sign(cx + 72 * s, TY - 8 * s, s, r ? `★ ${r.label}` : opts().length ? opts()[0].label : 'WRITE-IN CANDIDATE');
      villain(cx - 160 * s, TY - 4 * s, s, f, pose);
      damsel(cx - 2 * s, TY - 2 * s, s * 1.25, f);
      train(tx, TY - 4 * s, s, f, moving);
    }
    for (const p of steam) {
      c.globalAlpha = Math.min(1, (1 - p.life / p.max) * 1.4) * 0.9;
      c.drawImage(puff, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    c.globalAlpha = 1;
  }

  // An inset title plate over the picture (reduced motion: the still frame needs its punchline).
  function plate(card) {
    const B = L.B || L.panel;
    if (!B) return;
    const h = L.plateH || Math.min(B.h * 0.36, 86), w = Math.min(B.w - 30, 560);
    const P = { x: B.x + (B.w - w) / 2, y: B.y + 8, w, h };
    c.fillStyle = '#120d08';
    c.fillRect(P.x, P.y, P.w, P.h);
    ornament(P, 0.9);
    titleText(P, card, P.h < 76 ? 12 : 30);
  }

  function iris(r, ox, oy) {
    c.fillStyle = '#0a0705';
    c.beginPath();
    c.rect(0, 0, cv.w, cv.h);
    c.arc(ox, oy, Math.max(0, r), 0, Math.PI * 2, true);
    c.fill('evenodd');
  }

  function frame(dt) {
    const { panel } = L;
    c.save();
    c.translate(wx, wy + slip);
    if (seg.kind === 'pic' || k.reduced) {
      picture(dt);
      if (k.reduced) plate(answerCard || stillCard());
    } else {
      c.fillStyle = '#120d08';
      c.fillRect(-20, -20, cv.w + 40, cv.h + 40);
      if (panel) { ornament(panel); titleText(panel, seg.card); }
    }
    if (seg.iris && !k.reduced) {
      const p = k.clamp(seg.t / 1.1);
      const ox = L.B ? L.cx : cv.w / 2, oy = L.B ? L.B.y + L.B.h / 2 : cv.h / 2;
      iris(k.ease.inOutQuad(p) * Math.hypot(cv.w, cv.h), ox, oy);
    }
    c.restore();
    if (slip) { c.fillStyle = '#050302'; c.fillRect(0, slip - 14, cv.w, 14); }
    // the film itself: grain, dust, hairs, scratches, flicker, vignette
    c.save();
    c.translate(k.rand(180), k.rand(180));
    c.fillStyle = grain[f % 3];
    c.globalAlpha = 0.5;
    c.fillRect(-180, -180, cv.w + 360, cv.h + 360);
    c.restore();
    c.globalAlpha = 1;
    for (const sc of scratches) {
      c.strokeStyle = sc.dark ? 'rgba(25,15,5,.5)' : 'rgba(250,244,228,.55)';
      c.lineWidth = sc.w;
      c.beginPath(); c.moveTo(sc.x, 0);
      c.bezierCurveTo(sc.x + sc.bend, cv.h * 0.3, sc.x - sc.bend, cv.h * 0.7, sc.x + sc.bend * 0.5, cv.h);
      c.stroke();
    }
    const dust = k.reduced ? 5 : k.int(0, 4);
    for (let i = 0; i < dust; i++) {
      const x = k.rand(cv.w), y = k.rand(cv.h), light = k.chance(0.35);
      c.fillStyle = c.strokeStyle = light ? 'rgba(250,244,228,.75)' : 'rgba(15,9,4,.7)';
      if (k.chance(0.3)) { // a hair in the gate
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, y);
        c.bezierCurveTo(x + k.rand(-30, 30), y + k.rand(-30, 30), x + k.rand(-40, 40), y + k.rand(-40, 40), x + k.rand(-50, 50), y + k.rand(-20, 20));
        c.stroke();
      } else {
        c.beginPath(); c.ellipse(x, y, k.rand(1, 3.5), k.rand(1, 2.5), k.rand(3), 0, Math.PI * 2); c.fill();
      }
    }
    if (burn > 0) { // the cue mark, top right of the frame
      const bx = cv.w - Math.max(60, cv.w * 0.07), by = 64;
      const g = c.createRadialGradient(bx, by, 2, bx, by, 15);
      g.addColorStop(0, 'rgba(255,248,230,.9)'); g.addColorStop(0.7, 'rgba(60,40,20,.6)'); g.addColorStop(1, 'rgba(20,10,0,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(bx, by, 15, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = flick > 0 ? `rgba(255,246,225,${flick})` : `rgba(10,6,2,${-flick})`;
    c.fillRect(0, 0, cv.w, cv.h);
    c.drawImage(vignette, 0, 0, cv.w, cv.h);
  }
  let burn = 0;

  const stillCard = () => {
    if (ctx.front === 'done') return { big: 'THE END', small: 'No developers were harmed in the making of this grill.' };
    if (!ctx.question) return { big: 'MEANWHILE,', small: 'THE AGENT DELIBERATES.' };
    const r = rec();
    return r ? { small: `“Help! Somebody pick ‘${k.clip(r.label, 44)}’!”`, by: 'THE RECOMMENDED OPTION, PLEADING' } : { big: 'NO OPTIONS!', small: 'The developer must write their own ending.' };
  };

  cv.resized = (w, h, { dprOnly } = {}) => (dprOnly ? paintBackdrop() : measure());
  measure();
  next(true);
  if (ctx.sound) sound(true);
  k.on(document, 'visibilitychange', () => sound(k.sfx.on));

  const lp = k.loop((dt) => {
    if (dt > 0) {
      seg.t += dt;
      if (seg.t >= seg.dur) { answerCard = null; next(); }
      acc += dt;
      if (acc < 1 / FPS) return;
      acc %= 1 / FPS;
      f++;
      // gate weave, flicker, scratches, the odd cue mark and frame slip
      wx = k.rand(-0.6, 0.6); wy = k.rand(-1.3, 1.3);
      flick = k.chance(0.04) ? k.rand(0.05, 0.1) : -k.rand(0, 0.09);
      scratches = scratches.filter((sc) => (sc.life -= 1) > 0);
      for (const sc of scratches) sc.x += sc.drift;
      if (k.chance(0.06)) scratches.push({ x: k.rand(cv.w), w: k.rand(0.6, 1.6), life: k.int(4, 26), drift: k.rand(-1.5, 1.5), bend: k.rand(-6, 6), dark: k.chance(0.3) });
      const tt = f / FPS;
      burn = tt > burnAt && tt < burnAt + 0.25 ? 1 : 0;
      if (tt > burnAt + 0.25) burnAt = tt + k.rand(18, 30);
      slip = tt > slipAt && tt < slipAt + 0.12 ? cv.h * 0.06 : 0;
      if (tt > slipAt + 0.12) slipAt = tt + k.rand(35, 60);
      // the train arrives, and waits
      if (ctx.question && !trainArrived && ctx.cardTime >= TRAIN_S) {
        trainArrived = true;
        pending.unshift({ big: 'THE TRAIN, BEING A REASONABLE TRAIN,', small: 'WAITS.' });
        whistle();
      }
    } else { wx = wy = slip = 0; flick = -0.03; f = 30; }
    frame(dt);
  }, { still: 1.6 });

  return {
    question() {
      if (k.reduced) { answerCard = null; return lp.redraw(); }
      const hold = answerCard ? 1700 - (performance.now() - answeredAt) : 0; // let SAVED! be read
      const go = () => { next(true); if (ctx.question && !ctx.question.revising) whistle(); };
      hold > 0 ? k.after(hold, go) : go();
    },
    layout() { measure(); },
    status() { if (!ctx.question && ctx.front !== 'done') pending = []; },
    answer(a) {
      const pick = a.picks?.[0] || a.custom || 'something';
      answerCard = a.tookRec ? { big: 'SAVED!', small: `The developer chose ${quote(pick, 50)}. The villain is foiled again.` }
        : a.picks?.length ? { big: 'CURSES!', small: `${quote(pick, 50)}?! The villain cannot believe his luck.` }
          : { big: 'A TWIST!', small: 'The developer wrote their own ending. The critics are baffled.' };
      seg = { kind: 'card', card: answerCard, t: 0, dur: 4.5 };
      answeredAt = performance.now();
      picNext = true;
      piano(answerCard);
    },
    typing(on) {
      if (on && !typedCard && ctx.question) {
        typedCard = true;
        pending.unshift({ big: 'THE DEVELOPER TYPES', small: 'with the fury of a thousand telegraphs.' });
      }
    },
    sound,
  };
}
