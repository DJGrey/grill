// Cat wall. Cats peek in from every edge (the screen, the panels, the card) and stare at the ★
// option. Move towards one and it ducks. Creep up slowly and you can pet it. The orange one with
// the notched ear doesn't duck: it swipes. One cat holds a sign with its opinion on the question.

const COATS = {
  orange: { fur: '#e8913a', dark: '#b55f1d', light: '#f8cf98', eye: '#9ccf3c', stripes: true },
  black: { fur: '#29262d', dark: '#16141a', light: '#3d3942', eye: '#f2c230', inner: '#7a4a55' },
  grey: { fur: '#8f959d', dark: '#62686f', light: '#c3c8cd', eye: '#e6b93c', stripes: true },
  white: { fur: '#f5f2ec', dark: '#d8d0c4', light: '#ffffff', eye: '#6fb7e8', eye2: '#e2b23a' },
  brown: { fur: '#8c6b4b', dark: '#5a4029', light: '#bb9a7a', eye: '#b6d65a', stripes: true },
  calico: { fur: '#f5f0e6', dark: '#d6ccbd', light: '#ffffff', eye: '#d9a43a', patches: ['#e48a3c', '#2c2a2e'] },
  tuxedo: { fur: '#2a272c', dark: '#151317', light: '#3e3a40', eye: '#a8d34a', muzzle: '#f5f2ec', inner: '#7a4a55' },
  siamese: { fur: '#efe3cf', dark: '#cdbda2', light: '#fbf4e8', eye: '#4f9be0', mask: '#5b4335' },
};
const ORDER = ['black', 'white', 'grey', 'brown', 'tuxedo', 'siamese', 'black', 'grey'];
const HISS = ['MINE.', 'no.', '*hiss*', 'no touch.', 'ACK', 'try it.'];
const PURR = ['prrrr', 'mrrp', 'purr', '♥'];

export default function catWall(k, ctx) {
  const wall = k.canvas({ alpha: false });
  const cv = k.canvas();
  const c = cv.ctx;
  const meta = { icon: '🐈', label: 'Cats petted', says: 'petted {n} cat{s}' };
  const swipeMeta = { icon: '🐾', label: 'Swiped by a cat', says: 'took {n} swipe{s} from a cat' };

  let cats = [];
  let frame = null; // the employee-of-the-month portrait
  const words = []; // { text, x, y, age, life, size, fill }
  const hearts = []; // { x, y, vx, vy, age }
  const scratches = []; // { x, y, age }
  const vel = { x: 0, y: 0, px: -1, py: -1 };
  let over = false; // pointer is over the scene, not the card or a panel
  let clock = 0;
  let L = null;
  let signFlip = null; // { text, until }

  // ── the wall ────────────────────────────────────────────────────────────

  function paintWall() {
    const g = wall.ctx, W = wall.w, H = wall.h;
    g.fillStyle = '#86a9a5';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 56) { // wallpaper stripes
      g.fillStyle = 'rgba(255,255,255,.07)';
      g.fillRect(x, 0, 22, H);
      g.fillStyle = 'rgba(40,70,70,.06)';
      g.fillRect(x + 22, 0, 2, H);
    }
    g.fillStyle = 'rgba(255,248,230,.22)'; // little sprigs
    for (let y = 18, row = 0; y < H; y += 46, row++) {
      for (let x = (row % 2) * 28 + 11; x < W; x += 56) {
        g.save();
        g.translate(x, y);
        g.rotate(0.6);
        g.beginPath();
        g.ellipse(0, 0, 4.5, 2, 0, 0, Math.PI * 2);
        g.ellipse(4, -5, 4, 1.8, -1.2, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
    const v = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(10,30,30,.35)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    if (frame) portrait(g);
  }

  function portrait(g) {
    const { x, y, w, h } = frame;
    g.save();
    g.translate(x, y);
    g.rotate(-0.03);
    g.shadowColor = 'rgba(10,30,30,.45)';
    g.shadowBlur = 14;
    g.shadowOffsetY = 6;
    g.fillStyle = '#7a5226';
    g.fillRect(-w / 2, -h / 2, w, h);
    g.shadowColor = 'transparent';
    g.strokeStyle = '#c8954f';
    g.lineWidth = 3;
    g.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
    g.fillStyle = '#f1e6cf';
    g.fillRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 44);
    g.save();
    g.beginPath();
    g.rect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 44);
    g.clip();
    const cat = makeCat({ x: 0, y: -h / 2 + 10 + (h - 40), ang: 0, room: 999, rise: 70 }, 'orange', true);
    Object.assign(cat, { peek: 1, level: 1, tilt: 0.12, s: (w - 20) / 100 });
    cat.x = 0;
    cat.y = h / 2 - 36;
    drawCat(g, cat, { x: 0, y: -400 }); // proud, looking slightly up
    g.restore();
    g.fillStyle = '#d9b25c'; // brass plate
    g.fillRect(-w / 2 + 14, h / 2 - 29, w - 28, 21);
    g.fillStyle = '#4a3410';
    g.font = k.font(7, 800, 'sans');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('EMPLOYEE', 0, h / 2 - 23.5);
    g.fillText('OF THE MONTH', 0, h / 2 - 14.5);
    g.restore();
  }

  // ── where cats can peek from ───────────────────────────────────────────

  // Every edge something can hide behind: the bottom of the screen, the side panels, over the
  // top of the card stack, hanging from the top of the screen or from under the card.
  function spots() {
    const sp = k.space();
    const st = sp.stage;
    const card = sp.card;
    const out = [];
    const add = (x, y, ang, room, pri, kind) => { if (room >= 60) out.push({ x, y, ang, room, pri, kind }); };
    const bottom = card ? st.bottom - card.bottom - 16 : st.height;
    if (card) {
      const ghosts = [...document.querySelectorAll('#stack .ghost.on')].map((e) => e.getBoundingClientRect().top);
      const top = Math.min(card.top, ...ghosts) + 2;
      const roomTop = top - st.top;
      for (const f of [0.18, 0.82]) add(card.left + card.width * f, top, 0, roomTop, 3, 'card-top');
      add(card.left + card.width * 0.5, card.bottom - 1, Math.PI, bottom, 4, 'card-under');
      const sideL = card.left - st.left, sideR = st.right - card.right;
      add(card.left + 1, card.top + card.height * 0.3, -Math.PI / 2, sideL, 2, 'card-side');
      add(card.right - 1, card.top + card.height * 0.62, Math.PI / 2, sideR, 2, 'card-side');
      if (bottom >= 60) {
        const y0 = card.bottom + 16;
        add(st.left, y0 + bottom * 0.55, Math.PI / 2, st.width / 3, 1, 'panel');
        add(st.right, y0 + bottom * 0.4, -Math.PI / 2, st.width / 3, 1, 'panel');
      }
    } else {
      add(st.left, st.top + st.height * 0.75, Math.PI / 2, st.width / 3, 1, 'panel');
      add(st.right, st.top + st.height * 0.7, -Math.PI / 2, st.width / 3, 1, 'panel');
    }
    for (const f of [0.12, 0.88]) add(st.left + st.width * f, st.top, Math.PI, card ? card.top - st.top - 20 : 140, 3, 'top');
    for (const f of [0.15, 0.38, 0.62, 0.85]) add(st.left + st.width * f, st.bottom, 0, bottom, f === 0.38 || f === 0.85 ? 0 : 1, 'bottom');
    return { out, sp, bottom };
  }

  function makeCat(spot, coat, swiper = false) {
    return {
      ...spot,
      coat,
      swiper,
      s: spot.room < 100 ? k.clamp(spot.room / 98, 0.6, 0.85) : 1,
      peek: 0, // 0 hidden … 1 fully up
      want: 1,
      level: k.rand(0.82, 1),
      hideFor: 0,
      blink: 0, nextBlink: k.rand(1, 5),
      ear: [0, 0], earT: 0, flat: 0,
      tilt: k.rand(-0.18, 0.18),
      happy: 0, pet: 0, petCool: 0,
      swipe: null, swipeCool: 0,
      wide: 0,
      enter: k.rand(0, 1.4),
    };
  }

  function place() {
    const { out, sp, bottom } = spots();
    const r = k.rng(ctx.question?.id || ctx.front);
    frame = null;
    const gap = sp.gaps.find((g) => g.where === 'bottom' && g.w > 560 && g.h > 190);
    if (gap) frame = { x: gap.x + gap.w * 0.78, y: gap.y + Math.min(gap.h * 0.4, 100), w: 104, h: 126 };
    const chosen = [];
    const free = (s, d = 125) => chosen.every((o) => Math.hypot(o.x - s.x, o.y - s.y) > d) && (!frame || Math.hypot(frame.x - s.x, frame.y - s.y) > 120);
    // the sign holder: bottom middle, with room for a sign
    let sign = null;
    if (bottom >= 180 && sp.card) {
      sign = { x: sp.card.left + sp.card.width * 0.42, y: sp.stage.bottom, ang: 0, room: bottom, kind: 'sign' };
      chosen.push(sign);
    }
    const pool = r.shuffle(out).sort((a, b) => b.pri - a.pri);
    for (const s of pool) if (chosen.length < 8 && free(s)) chosen.push(s);
    const coats = r.shuffle(ORDER);
    const rank = { bottom: 3, panel: 2, 'card-under': 1 }; // the swiper sits where you can see its paw
    const swiperAt = chosen.filter((s) => rank[s.kind] && s.room >= 90).sort((a, b) => rank[b.kind] - rank[a.kind])[0];
    const prev = cats;
    cats = chosen.map((s, i) => {
      const isSwiper = s === swiperAt;
      const cat = makeCat(s, isSwiper ? 'orange' : s.kind === 'sign' ? 'calico' : coats[i % coats.length], isSwiper);
      cat.sign = s.kind === 'sign';
      cat.rise = cat.sign ? 186 : Math.min(96, (s.room - 4) / cat.s);
      if (cat.sign || isSwiper) cat.level = 1;
      const old = prev.find((o) => Math.hypot(o.x - s.x, o.y - s.y) < 40 && o.coat === cat.coat);
      if (old) Object.assign(cat, { peek: old.peek, enter: 0 });
      if (k.reduced) Object.assign(cat, { peek: 1, enter: 0 });
      return cat;
    });
    if (k.reduced) stillPose();
    paintWall();
  }

  // The still frame for reduced motion: everyone up and staring, the orange one mid-swipe.
  function stillPose() {
    const sw = cats.find((x) => x.swiper);
    if (!sw) return;
    const t = target();
    swipe(sw, { x: k.lerp(head(sw).x, t.x, 0.3), y: k.lerp(head(sw).y, t.y, 0.3) });
    Object.assign(sw.swipe, { ext: 0.9, hit: true });
    sw.flat = 1;
  }

  // ── geometry helpers ───────────────────────────────────────────────────

  const headY = (cat) => k.lerp(64, 64 - cat.rise * cat.level, cat.peek) - (cat.sign ? 0 : 0);
  const toWorld = (cat, lx, ly) => {
    const cs = Math.cos(cat.ang), sn = Math.sin(cat.ang);
    lx *= cat.s; ly *= cat.s;
    return { x: cat.x + lx * cs - ly * sn, y: cat.y + lx * sn + ly * cs };
  };
  const toLocal = (cat, x, y) => {
    const cs = Math.cos(-cat.ang), sn = Math.sin(-cat.ang);
    const dx = x - cat.x, dy = y - cat.y;
    return { x: (dx * cs - dy * sn) / cat.s, y: (dx * sn + dy * cs) / cat.s };
  };
  const head = (cat) => toWorld(cat, 0, headY(cat));

  // What cats stare at: you if you're close, the textarea while you type, otherwise the ★ option.
  // The UI spots are measured once per question/layout, not every frame.
  let gaze = null;
  function measureGaze() {
    const a = k.rect(k.ui.answer()), o = k.ui.options().find((x) => x.recommended), card = k.rect(k.ui.card());
    return {
      answer: a && { x: a.x + a.width / 2, y: a.y + a.height / 2 },
      rec: o && { x: o.rect.x + o.rect.width * 0.3, y: o.rect.y + o.rect.height / 2 },
      card: card ? { x: card.x + card.width / 2, y: card.y + card.height / 3 } : { x: cv.w / 2, y: cv.h / 2 },
    };
  }
  function target() {
    if (k.pointer.active && performance.now() - (k.pointer.at || 0) < 2500) return k.pointer;
    gaze ||= measureGaze();
    return (ctx.typing && gaze.answer) || gaze.rec || gaze.card;
  }

  // ── drawing a cat (local space: the edge is y = 0, outwards is -y) ───────

  function ear(g, side, C, ang, flat, notch) {
    g.save();
    g.translate(side * 21, -18);
    g.rotate(side * (0.32 + flat * 0.9) + ang);
    g.scale(1, 1 - flat * 0.35);
    g.fillStyle = C.fur;
    g.beginPath();
    g.moveTo(-12, 6);
    g.quadraticCurveTo(-6, -18, side * 2, -26);
    if (notch) { // a fighter's ear
      g.lineTo(7, -16);
      g.lineTo(3.5, -12);
      g.lineTo(10, -8);
      g.lineTo(13, 6);
    } else g.quadraticCurveTo(10, -14, 13, 6);
    g.closePath();
    g.fill();
    if (C.mask) { g.fillStyle = C.mask; g.fill(); }
    g.fillStyle = C.inner || '#f0a4ad';
    g.beginPath();
    g.moveTo(-7, 4);
    g.quadraticCurveTo(-3, -11, side * 1.5, -18);
    g.quadraticCurveTo(6, -9, 8, 4);
    g.closePath();
    g.fill();
    g.restore();
  }

  function paw(g, x, y, C, r = 9) {
    g.fillStyle = C.muzzle && C === COATS.tuxedo ? C.muzzle : C.fur;
    g.beginPath();
    g.ellipse(x, y, r * 1.2, r * 0.85, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.28)';
    g.lineWidth = 1.2;
    g.beginPath();
    for (const dx of [-0.4, 0.4]) { g.moveTo(x + dx * r, y - r * 0.75); g.lineTo(x + dx * r, y - r * 0.15); }
    g.stroke();
  }

  function drawCat(g, cat, look) {
    const C = COATS[cat.coat];
    const hy = headY(cat);
    if (hy > 62) return;
    g.save();
    g.translate(cat.x, cat.y);
    g.rotate(cat.ang);
    g.scale(cat.s, cat.s);

    g.fillStyle = 'rgba(15,35,35,.22)'; // soft shadow on the wall
    g.beginPath();
    g.ellipse(4, hy + 8, 40, 34, 0, 0, Math.PI * 2);
    g.rect(-30, hy + 8, 68, 80);
    g.fill();
    g.fillStyle = C.fur; // neck and shoulders, disappearing behind the edge
    g.beginPath();
    g.roundRect(-30, hy + 4, 60, 140, 26);
    g.fill();
    if (C.muzzle) {
      g.fillStyle = C.muzzle;
      g.beginPath();
      g.ellipse(0, hy + 40, 14, 22, 0, 0, Math.PI * 2);
      g.fill();
    }

    if (cat.sign) drawSign(g, cat, hy, C);

    g.save(); // the head
    g.translate(0, hy);
    g.rotate(cat.tilt + Math.sin(clock * 0.7 + cat.x) * 0.03);
    const earAng = cat.ear;
    ear(g, -1, C, earAng[0], cat.flat, false);
    ear(g, 1, C, earAng[1], cat.flat, cat.swiper);
    g.fillStyle = C.fur;
    g.beginPath();
    g.ellipse(0, 0, 36, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath(); // cheek fluff
    g.moveTo(-34, 6);
    g.lineTo(-41, 12);
    g.lineTo(-33, 13);
    g.lineTo(-38, 19);
    g.lineTo(-28, 19);
    g.moveTo(34, 6);
    g.lineTo(41, 12);
    g.lineTo(33, 13);
    g.lineTo(38, 19);
    g.lineTo(28, 19);
    g.fill();
    if (C.patches) {
      g.save();
      g.beginPath();
      g.ellipse(0, 0, 36, 30, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = C.patches[0];
      g.beginPath();
      g.ellipse(-22, -14, 22, 18, 0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = C.patches[1];
      g.beginPath();
      g.ellipse(26, -18, 16, 14, -0.3, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    if (C.mask) {
      const m = g.createRadialGradient(0, 10, 2, 0, 8, 26);
      m.addColorStop(0, C.mask);
      m.addColorStop(1, 'rgba(91,67,53,0)');
      g.fillStyle = m;
      g.beginPath();
      g.ellipse(0, 6, 30, 24, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (C.muzzle) {
      g.fillStyle = C.muzzle;
      g.beginPath();
      g.moveTo(0, -6);
      g.quadraticCurveTo(-18, 6, -16, 22);
      g.quadraticCurveTo(0, 32, 16, 22);
      g.quadraticCurveTo(18, 6, 0, -6);
      g.fill();
    }
    if (C.stripes) {
      g.strokeStyle = C.dark;
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      for (const dx of [-8, 0, 8]) { g.moveTo(dx, -28); g.lineTo(dx * 0.7, -17); }
      g.moveTo(-35, -2); g.lineTo(-27, 0);
      g.moveTo(-35, 4); g.lineTo(-28, 5);
      g.moveTo(35, -2); g.lineTo(27, 0);
      g.moveTo(35, 4); g.lineTo(28, 5);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,.08)';
    g.beginPath();
    g.ellipse(-8, -14, 22, 12, -0.2, 0, Math.PI * 2);
    g.fill();

    // eyes
    let lx = 0, ly = 0;
    if (look) {
      const p = toLocal(cat, look.x, look.y);
      const dx = p.x, dy = p.y - hy;
      const d = Math.hypot(dx, dy) || 1;
      const amt = Math.min(1, d / 60);
      const rot = -(cat.tilt);
      lx = (dx / d) * 3.6 * amt;
      ly = (dy / d) * 3.6 * amt;
      [lx, ly] = [lx * Math.cos(rot) - ly * Math.sin(rot), lx * Math.sin(rot) + ly * Math.cos(rot)];
    }
    for (const side of [-1, 1]) {
      const ex = side * 13.5, ey = -3;
      if (cat.happy > 0) { // ^ ^
        g.strokeStyle = C.dark === '#16141a' || C.dark === '#151317' ? '#0b0a0c' : '#3a2a20';
        g.lineWidth = 2.6;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(ex, ey + 3, 6.5, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
        continue;
      }
      g.fillStyle = side > 0 && C.eye2 ? C.eye2 : C.eye;
      g.beginPath();
      g.ellipse(ex, ey, 9.5 + cat.wide * 1.2, 10 + cat.wide * 1.5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)';
      g.beginPath();
      g.ellipse(ex, ey - 4, 9, 5, 0, Math.PI, Math.PI * 2);
      g.fill();
      const dil = Math.max(cat.wide, cat.swiper && cat.swipeCool > 0 ? 0 : 0);
      g.fillStyle = '#0d0b0c';
      g.beginPath();
      g.ellipse(ex + lx, ey + ly, 2.2 + dil * 4.6, 8 - dil * 1.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(ex + lx - 2.5, ey + ly - 3.5, 2.1, 0, Math.PI * 2);
      g.fill();
      if (cat.blink > 0 || cat.flat > 0.4) { // eyelids: blinks, and a suspicious squint when annoyed
        const lid = Math.max(cat.blink, cat.flat > 0.4 ? 0.45 : 0);
        g.fillStyle = C.mask && 0 ? C.mask : C.fur;
        g.beginPath();
        g.ellipse(ex, ey - 11 + lid * 11, 11, 11 * lid + 0.5, 0, Math.PI, Math.PI * 2);
        g.rect(ex - 11, ey - 12, 22, lid * 11);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,.35)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(ex - 9, ey - 11 + lid * 21);
        g.quadraticCurveTo(ex, ey - 12 + lid * 23, ex + 9, ey - 11 + lid * 21);
        g.stroke();
      }
    }
    // nose, mouth, whiskers
    g.fillStyle = C.inner === '#7a4a55' ? '#5a3a40' : '#e58a96';
    g.beginPath();
    g.moveTo(-4, 8);
    g.lineTo(4, 8);
    g.lineTo(0, 12.5);
    g.closePath();
    g.fill();
    g.strokeStyle = C.inner === '#7a4a55' && !C.muzzle ? 'rgba(255,255,255,.35)' : 'rgba(40,25,20,.55)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(0, 12.5);
    g.lineTo(0, 15);
    if (cat.swipe || cat.flat > 0.5) { g.moveTo(-6, 19); g.quadraticCurveTo(0, 14, 6, 19); } // hiss
    else { g.moveTo(-6, 16); g.quadraticCurveTo(-3, 19, 0, 15); g.quadraticCurveTo(3, 19, 6, 16); }
    g.stroke();
    if (cat.swipe || cat.flat > 0.5) { // fangs
      g.fillStyle = '#fff';
      for (const sx of [-3.5, 3.5]) { g.beginPath(); g.moveTo(sx - 1.4, 16.5); g.lineTo(sx + 1.4, 16.5); g.lineTo(sx, 20); g.fill(); }
    }
    g.strokeStyle = C.fur === '#29262d' || C.fur === '#2a272c' ? 'rgba(255,255,255,.55)' : 'rgba(60,40,30,.45)';
    g.lineWidth = 0.9;
    g.beginPath();
    for (const side of [-1, 1]) for (const [a, b] of [[10, 6], [12, 12], [13, 18]]) {
      g.moveTo(side * 10, a);
      g.quadraticCurveTo(side * 30, a - 1, side * (42 + (b - 6) * 0.4), b + (b - 12) * 0.3);
    }
    g.stroke();
    g.restore(); // head

    // paws on the edge, once it's properly up
    if (cat.peek * cat.level > 0.8 && !cat.sign) {
      const py = Math.max(-4, hy + 28);
      if (!cat.swipe) paw(g, -24, py, C);
      if (!cat.swipe) paw(g, 24, py, C);
    }
    if (cat.swipe) drawArm(g, cat, C, hy);
    g.restore();
  }

  function drawArm(g, cat, C, hy) {
    const sw = cat.swipe;
    const ext = sw.ext;
    const sx = 22, sy = Math.max(-4, hy + 30);
    const tx = k.lerp(sx, sw.lx, ext), ty = k.lerp(sy, sw.ly, ext);
    paw(g, -24, sy, C);
    g.strokeStyle = C.fur;
    g.lineCap = 'round';
    g.lineWidth = 15;
    g.beginPath();
    g.moveTo(sx, sy + 10);
    g.quadraticCurveTo((sx + tx) / 2 + 10, (sy + ty) / 2 + 12, tx, ty);
    g.stroke();
    if (C.stripes) {
      g.strokeStyle = C.dark;
      g.lineWidth = 3;
      g.beginPath();
      for (const f of [0.35, 0.55, 0.75]) {
        const x = k.lerp(sx, tx, f), y = k.lerp(sy, ty, f);
        const a = Math.atan2(ty - sy, tx - sx) + Math.PI / 2;
        g.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6);
        g.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
      }
      g.stroke();
    }
    g.save();
    g.translate(tx, ty);
    g.rotate(Math.atan2(ty - sy, tx - sx) + Math.PI / 2);
    paw(g, 0, 0, C, 10);
    if (ext > 0.5) { // claws out
      g.strokeStyle = '#fffaf0';
      g.lineWidth = 1.8;
      g.beginPath();
      for (const dx of [-7, -2.4, 2.4, 7]) { g.moveTo(dx, -7); g.quadraticCurveTo(dx + 1, -13, dx - 1.5, -15); }
      g.stroke();
    }
    g.restore();
  }

  function signText() {
    if (signFlip && clock < signFlip.until) return signFlip.text;
    const q = ctx.question;
    if (ctx.front === 'done') return ['done?', 'dinner time.'];
    if (!q) return ctx.agent === 'listening' ? ['the agent', 'is listening', '(feed me)'] : ['the agent', 'is thinking', '(feed me)'];
    if (!q.options.length) return ['no options', 'only treats'];
    const i = q.options.findIndex((o) => o.recommended);
    if (i < 0) return ['just pick', 'one. any one.'];
    if (q.multi && q.recommended.length > 1) return [`pick ${q.options.map((o, j) => (o.recommended ? j + 1 : 0)).filter(Boolean).join(' + ')}`, '(the ★ ones)'];
    return [`pick ${i + 1}`, '(the ★ one)'];
  }

  function drawSign(g, cat, hy, C) {
    const lines = signText();
    const w = 128, h = 22 + lines.length * 19;
    const y = hy + 30;
    g.save();
    g.translate(0, y);
    g.rotate(-0.05 + Math.sin(clock * 1.3) * 0.015);
    g.fillStyle = 'rgba(15,35,35,.25)';
    g.fillRect(-w / 2 + 5, 6, w, h);
    g.fillStyle = '#d7b07a'; // cardboard
    g.fillRect(-w / 2, 0, w, h);
    g.fillStyle = 'rgba(120,80,30,.12)';
    for (let x = -w / 2 + 4; x < w / 2; x += 6) g.fillRect(x, 0, 2, h);
    g.strokeStyle = 'rgba(110,70,25,.35)';
    g.lineWidth = 1;
    g.strokeRect(-w / 2 + 0.5, 0.5, w - 1, h - 1);
    g.fillStyle = '#26170c';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, i) => {
      g.font = k.font(i ? 14 : 19, 700, 'hand');
      g.fillText(k.clip(l, 16), 0, 15 + i * 19 + (i ? 2 : 0));
    });
    paw(g, -w / 2 + 6, h * 0.55, C);
    paw(g, w / 2 - 6, h * 0.45, C);
    g.restore();
  }

  // ── behaviour ──────────────────────────────────────────────────────────

  function say(text, x, y, o = {}) {
    words.push({ text, x, y, age: 0, life: o.life ?? 0.9, size: o.size ?? 16, fill: o.fill ?? '#fff' });
  }

  function meow(pitch = 1) {
    k.sfx.tone({ type: 'sawtooth', freq: 520 * pitch, to: 820 * pitch, dur: 0.16, gain: 0.12, filter: 'bandpass', freqF: 1500, q: 2.5 });
    k.sfx.tone({ type: 'sawtooth', freq: 820 * pitch, to: 430 * pitch, dur: 0.32, delay: 0.15, gain: 0.12, filter: 'bandpass', freqF: 1300, q: 2.5, vibrato: { rate: 9, depth: 14 } });
  }

  function pet(cat) {
    if (cat.petCool > 0 || cat.swiper) return;
    cat.happy = 2.2;
    cat.petCool = 3;
    cat.want = 1;
    k.sfx.tone({ type: 'sawtooth', freq: 27, dur: 1.4, gain: 0.3, filter: 'lowpass', freqF: 160, attack: 0.15, vibrato: { rate: 3, depth: 3 } });
    if (k.chance(0.5)) meow(k.rand(1.1, 1.4));
    const h = head(cat);
    for (let i = 0; i < 4; i++) hearts.push({ x: h.x + k.rand(-14, 14), y: h.y - 20, vx: k.rand(-30, 30), vy: k.rand(-80, -50), age: -i * 0.12 });
    say(k.pick(PURR), h.x, h.y - 46, { fill: '#ffe1ec' });
    k.score('cats', 1, meta);
  }

  function duck(cat, hide = k.rand(1.4, 3.2)) {
    if (cat.want === 0) return;
    cat.want = 0;
    cat.hideFor = hide;
    const h = head(cat);
    if (cat.peek > 0.5) say('!', h.x, h.y - 40, { size: 22, life: 0.45, fill: '#fff6c8' });
    k.sfx.whoosh({ pitch: 2.4, gain: 0.12 });
  }

  function swipe(cat, p) {
    const lp = toLocal(cat, p.x, p.y);
    const reach = 150;
    const hy = headY(cat);
    const dx = lp.x - 22, dy = lp.y - (hy + 30);
    const d = Math.hypot(dx, dy) || 1;
    const r = Math.min(reach, d);
    cat.swipe = { t: 0, lx: 22 + (dx / d) * r, ly: hy + 30 + (dy / d) * r, ext: 0, hit: false, aim: { ...p } };
    cat.swipeCool = 1.3;
    k.sfx.whoosh({ pitch: 2.8, gain: 0.3 });
  }

  function stepCat(cat, dt, look, speed) {
    cat.enter = Math.max(0, cat.enter - dt);
    cat.petCool = Math.max(0, cat.petCool - dt);
    cat.swipeCool = Math.max(0, cat.swipeCool - dt);
    cat.happy = Math.max(0, cat.happy - dt);
    cat.wide = Math.max(0, cat.wide - dt * 0.8);
    if (cat.want === 0) {
      cat.hideFor -= dt;
      if (cat.hideFor <= 0) { cat.want = 1; cat.level = k.rand(0.8, 1); cat.tilt = k.rand(-0.22, 0.22); }
    }
    const goal = cat.enter > 0 ? 0 : cat.want;
    cat.peek += (goal - cat.peek) * Math.min(1, dt * (goal < cat.peek ? 16 : 3.2));

    cat.nextBlink -= dt; // blinks, and now and then a slow one (that's a cat saying it likes you)
    if (cat.nextBlink <= 0) { cat.blinkT = 0; cat.slow = k.chance(0.15); cat.nextBlink = k.rand(2, 6); }
    if (cat.blinkT !== undefined) {
      cat.blinkT += dt;
      const len = cat.slow ? 1.1 : 0.16;
      const p = cat.blinkT / len;
      cat.blink = p >= 1 ? 0 : Math.sin(p * Math.PI) ** (cat.slow ? 0.5 : 1);
      if (p >= 1) cat.blinkT = undefined;
    }
    cat.earT -= dt;
    if (cat.earT <= 0) { cat.ear = [k.chance(0.3) ? k.rand(-0.35, 0.1) : 0, k.chance(0.3) ? k.rand(-0.1, 0.35) : 0]; cat.earT = k.rand(0.6, 3); }

    const h = head(cat);
    const p = k.pointer;
    const dist = Math.hypot(p.x - h.x, p.y - h.y);
    const live = p.active && performance.now() - (p.at || 0) < 400;
    if (cat.swiper) {
      cat.flat += ((live && dist < 240 && over ? 1 : 0) - cat.flat) * Math.min(1, dt * 6); // ears back: you've been warned
      if (cat.swipe) {
        const s = cat.swipe;
        s.t += dt;
        s.ext = s.t < 0.11 ? k.ease.outCubic(s.t / 0.11) : s.t < 0.2 ? 1 : Math.max(0, 1 - (s.t - 0.2) / 0.25);
        if (s.t > 0.09 && !s.hit) {
          s.hit = true;
          const tip = toWorld(cat, s.lx, s.ly);
          if (Math.hypot(p.x - tip.x, p.y - tip.y) < 34 * cat.s) {
            scratches.push({ x: p.x, y: p.y, age: 0, rot: k.rand(-0.5, 0.2) });
            say(k.pick(HISS), h.x, h.y - 50, { fill: '#ffd4c4', size: 18, life: 1.1 });
            k.sfx.noise({ dur: 0.4, filter: 'highpass', freq: 3200, gain: 0.12 });
            k.sfx.splat({ pitch: 2.2, gain: 0.25 });
            k.score('swiped', 1, swipeMeta);
          }
        }
        if (s.t > 0.45) cat.swipe = null;
      } else if (live && over && cat.peek > 0.7 && cat.swipeCool <= 0 && dist < 145 * cat.s) swipe(cat, p);
      return;
    }
    if (cat.sign || cat.want === 0 || cat.peek < 0.3) return;
    // towards it, quickly: duck. Slowly over its head: that's petting.
    const toward = dist > 1 ? (vel.x * (h.x - p.x) + vel.y * (h.y - p.y)) / dist : 0;
    if (live && ((dist < 260 && toward > 320) || (dist < 70 && speed > 650))) duck(cat);
    else if (live && dist < 30 * cat.s && over && speed > 15 && speed < 650) {
      cat.pet += dt;
      if (cat.pet > 0.45) { cat.pet = 0; pet(cat); }
    } else cat.pet = Math.max(0, cat.pet - dt);
  }

  // ── input ──────────────────────────────────────────────────────────────

  k.on(k.root, 'pointerenter', () => { over = true; });
  k.on(k.root, 'pointermove', () => { over = true; });
  k.on(k.root, 'pointerleave', () => { over = false; });
  k.on(k.root, 'pointerdown', (e) => {
    const cat = cats.find((x) => x.peek > 0.4 && Math.hypot(head(x).x - e.clientX, head(x).y - e.clientY) < 34 * x.s);
    if (!cat) return;
    if (cat.swiper) swipe(cat, { x: e.clientX, y: e.clientY });
    else if (cat.sign) { meow(0.9); say('mrow?', head(cat).x, head(cat).y - 46); }
    else pet(cat);
  });

  wall.resized = (w, h, { dprOnly } = {}) => (dprOnly ? paintWall() : ((gaze = null), place())); // a DPR step keeps the cats where they are
  place();

  L = k.loop((dt) => {
    clock += dt;
    const p = k.pointer;
    if (vel.px >= 0 && dt) {
      vel.x = k.lerp(vel.x, (p.x - vel.px) / dt, Math.min(1, dt * 14));
      vel.y = k.lerp(vel.y, (p.y - vel.py) / dt, Math.min(1, dt * 14));
    }
    vel.px = p.x;
    vel.py = p.y;
    const speed = Math.hypot(vel.x, vel.y);
    c.clearRect(0, 0, cv.w, cv.h);
    const look = target();
    for (const cat of cats) {
      if (!k.reduced) stepCat(cat, dt, look, speed);
      drawCat(c, cat, cat.happy > 0 ? null : look);
    }
    for (let i = scratches.length - 1; i >= 0; i--) {
      const s = scratches[i];
      s.age += dt;
      if (s.age > 1.6) { scratches.splice(i, 1); continue; }
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.rot);
      c.globalAlpha = Math.min(1, (1.6 - s.age) * 2);
      c.lineCap = 'round';
      const grow = Math.min(1, s.age / 0.08);
      for (const [col, w, o] of [['rgba(120,10,20,.55)', 4.5, 1.5], ['#ff5d6c', 2.6, 0], ['rgba(255,255,255,.6)', 1, -1]]) {
        c.strokeStyle = col;
        c.lineWidth = w;
        c.beginPath();
        for (const dx of [-11, 0, 11]) { c.moveTo(dx - 9 + o, -20 + o); c.lineTo(dx - 9 + 18 * grow + o, -20 + 40 * grow + o); }
        c.stroke();
      }
      c.restore();
    }
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.age += dt;
      if (h.age > 1.3) { hearts.splice(i, 1); continue; }
      if (h.age < 0) continue;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      c.save();
      c.translate(h.x + Math.sin(h.age * 6) * 4, h.y);
      c.globalAlpha = Math.min(1, (1.3 - h.age) * 2);
      const s = 0.5 + k.ease.outBack(Math.min(1, h.age / 0.25)) * 0.5;
      c.scale(s, s);
      c.fillStyle = '#ff6f91';
      c.beginPath();
      c.moveTo(0, 5);
      c.bezierCurveTo(-11, -3, -6, -12, 0, -6);
      c.bezierCurveTo(6, -12, 11, -3, 0, 5);
      c.fill();
      c.restore();
    }
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      w.age += dt;
      const t = w.age / w.life;
      if (t >= 1) { words.splice(i, 1); continue; }
      c.save();
      c.translate(w.x, w.y - k.ease.outCubic(t) * 22);
      const s = 0.6 + k.ease.outBack(Math.min(1, w.age / 0.15)) * 0.4;
      c.scale(s, s);
      c.globalAlpha = Math.min(1, (1 - t) * 3);
      c.font = k.font(w.size, 800, 'sans');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(20,30,30,.75)';
      c.strokeText(w.text, 0, 0);
      c.fillStyle = w.fill;
      c.fillText(w.text, 0, 0);
      c.restore();
    }
  }, { still: 0 });

  const replace = () => { gaze = null; place(); L.redraw(); };

  return {
    question() {
      gaze = null;
      if (k.reduced) { place(); return; }
      for (const cat of cats) if (!cat.sign) duck(cat, 9);
      k.after(450, () => { place(); for (const cat of cats) cat.enter = k.rand(0.2, 1.6); });
    },
    layout: replace,
    status() { if (!ctx.question) L.redraw(); },
    keystroke() {
      const cat = k.pick(cats);
      if (cat) cat.ear = [k.rand(-0.4, 0), k.rand(0, 0.4)];
    },
    // Everyone pops up wide-eyed, the sign has a verdict, then the startled ones duck.
    answer(a) {
      for (const cat of cats) Object.assign(cat, { want: 1, enter: 0, wide: 1.4, level: 1, hideFor: 0 });
      signFlip = { text: a?.tookRec ? ['good human.', '(treat pls)'] : a?.hasRec ? ['bold.', 'very bold.'] : ['noted.', '(by the cat)'], until: clock + 3 };
      meow(1);
      const startled = cats; // not the ones the next card brings
      k.after(700, () => startled.forEach((cat) => !cat.sign && !cat.swiper && k.chance(0.7) && duck(cat, 3)));
    },
  };
}
