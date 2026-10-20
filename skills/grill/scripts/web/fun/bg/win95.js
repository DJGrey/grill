// Windows 95 meltdown. A teal desktop where "Are you sure?" popups pile up under the card, each
// one more worried than the last, with your options as the buttons. Then the app stops
// responding and the last popup gets dragged around, smearing that famous trail.

const TEAL = '#008080';
const FACE = '#c0c0c0';
const UI = 'Tahoma, "MS Sans Serif", "Microsoft Sans Serif", Verdana, "DejaVu Sans", Arial, sans-serif';
const f = (s, w = 400) => `${w} ${s}px ${UI}`;

export default function win95(k, ctx) {
  const desk = k.canvas({ alpha: false }); // teal, icons and the trail (only cleared on a refresh)
  const live = k.canvas(); // the popups, the taskbar and the cursor
  const d = desk.ctx, c = live.ctx;

  let wins = []; // { spr, w, h, x, y, title, born, kind }
  let step = 0; // how far the escalation has got for this card
  let nextAt = 0.6;
  let trail = null; // { win, t0, path }
  let wipe = null; // a desktop repaint sweeping down
  let busy = 0; // hourglass time left
  let area = null; // where the cascade goes
  let binFull = 0;
  let flying = []; // papers flying to the bin { x0, y0, x1, y1, t }
  let done = false;
  let clock = 0;
  let sp = k.space();

  // ── drawing helpers ─────────────────────────────────────────────────────

  function bevel(g, x, y, w, h, out = true, deep = true) {
    const [a, b, c2, d2] = out ? ['#ffffff', '#000000', '#dfdfdf', '#808080'] : ['#000000', '#ffffff', '#808080', '#dfdfdf'];
    g.fillStyle = deep ? c2 : a; g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
    g.fillStyle = b; g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
    if (!deep) return;
    g.fillStyle = a; g.fillRect(x + 1, y + 1, w - 2, 1); g.fillRect(x + 1, y + 1, 1, h - 2);
    g.fillStyle = d2; g.fillRect(x + 1, y + h - 2, w - 2, 1); g.fillRect(x + w - 2, y + 1, 1, h - 2);
  }

  function button(g, x, y, w, h, label, def) {
    g.fillStyle = FACE;
    g.fillRect(x, y, w, h);
    if (def) { g.fillStyle = '#000'; g.fillRect(x, y, w, h); g.fillStyle = FACE; g.fillRect(x + 1, y + 1, w - 2, h - 2); bevel(g, x + 1, y + 1, w - 2, h - 2); }
    else bevel(g, x, y, w, h);
    g.fillStyle = '#000';
    g.font = f(11);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(k.ellipsize(g, label, w - 12), x + w / 2, y + h / 2 + 0.5);
    if (def) { // the dotted focus rectangle
      g.fillStyle = '#000';
      for (let i = x + 5; i < x + w - 5; i += 2) { g.fillRect(i, y + 4, 1, 1); g.fillRect(i, y + h - 5, 1, 1); }
      for (let j = y + 5; j < y + h - 5; j += 2) { g.fillRect(x + 4, j, 1, 1); g.fillRect(x + w - 5, j, 1, 1); }
    }
    g.textAlign = 'left';
  }

  function icon(g, kind, x, y) {
    g.save();
    g.translate(x, y);
    g.lineWidth = 1;
    if (kind === '!') {
      g.fillStyle = '#000';
      g.beginPath(); g.moveTo(16, 1); g.lineTo(32, 30); g.lineTo(0, 30); g.closePath(); g.fill();
      g.fillStyle = '#ffff00';
      g.beginPath(); g.moveTo(16, 4); g.lineTo(29.5, 28.5); g.lineTo(2.5, 28.5); g.closePath(); g.fill();
      g.fillStyle = '#000';
      g.fillRect(14.5, 11, 3, 10); g.fillRect(14.5, 23, 3, 3);
    } else if (kind === 'x') {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(18, 18, 15, 0, 7); g.fill();
      g.fillStyle = '#ff0000'; g.beginPath(); g.arc(16, 16, 15, 0, 7); g.fill();
      g.strokeStyle = '#800000'; g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(10, 10); g.lineTo(22, 22); g.moveTo(22, 10); g.lineTo(10, 22); g.stroke();
    } else { // '?' and 'i': a white speech balloon
      g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(18, 16, 15, 13, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.strokeStyle = '#000';
      g.beginPath(); g.ellipse(16, 14, 15, 13, 0, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(8, 24); g.lineTo(5, 32); g.lineTo(15, 26); g.fill();
      g.fillStyle = '#0000ff';
      g.font = f(kind === 'i' ? 18 : 20, 700);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(kind, 16, 15);
      g.textAlign = 'left';
    }
    g.restore();
  }

  // Pre-render a popup to its own canvas: title bar, icon, message, buttons, maybe a progress bar.
  function dialog(spec) {
    const { title, kind = '!', text, buttons = ['OK'], def = 0, progress = null, w = 380 } = spec;
    const m = document.createElement('canvas').getContext('2d');
    m.font = f(11);
    const lines = text.split('\n').flatMap((p) => k.wrap(m, p, w - 80, 4)).slice(0, 5);
    const h = 30 + Math.max(36, lines.length * 15) + (progress ? 26 : 0) + 50;
    const s = document.createElement('canvas');
    const r = desk.dpr;
    s.width = Math.ceil(w * r); s.height = Math.ceil(h * r);
    const g = s.getContext('2d');
    g.scale(r, r);
    g.fillStyle = FACE; g.fillRect(0, 0, w, h);
    bevel(g, 0, 0, w, h);
    const tg = g.createLinearGradient(3, 0, w - 3, 0);
    tg.addColorStop(0, '#000080'); tg.addColorStop(1, '#1084d0');
    g.fillStyle = tg; g.fillRect(3, 3, w - 6, 18);
    g.fillStyle = '#fff'; g.font = f(11, 700); g.textBaseline = 'middle';
    g.fillText(k.ellipsize(g, title, w - 40), 7, 12.5);
    g.fillStyle = FACE; g.fillRect(w - 21, 5, 16, 14); bevel(g, w - 21, 5, 16, 14);
    g.fillStyle = '#000'; g.font = f(11, 700); g.textAlign = 'center'; g.fillText('×', w - 13, 12); g.textAlign = 'left';
    icon(g, kind, 14, 34);
    g.font = f(11); g.fillStyle = '#000'; g.textBaseline = 'top';
    lines.forEach((l, i) => g.fillText(l, 60, 36 + i * 15));
    let y = 30 + Math.max(36, lines.length * 15) + 8;
    if (progress) {
      g.fillStyle = '#fff'; g.fillRect(60, y, w - 80, 16); bevel(g, 60, y, w - 80, 16, false, false);
      g.fillStyle = '#000080';
      const n = Math.floor((w - 86) / 9 * progress);
      for (let i = 0; i < n; i++) g.fillRect(63 + i * 9, y + 3, 7, 10);
      y += 26;
    }
    const bw = Math.min(110, Math.max(75, (w - 24) / buttons.length - 6));
    const total = buttons.length * bw + (buttons.length - 1) * 6;
    buttons.forEach((b, i) => button(g, (w - total) / 2 + i * (bw + 6), y + 6, bw, 23, b, i === def));
    return { spr: s, w, h, title, spec };
  }

  // ── the desktop ─────────────────────────────────────────────────────────

  function deskIcon(g, kind, x, y, label, sel) {
    g.save();
    g.translate(x, y);
    if (kind === 'pc') {
      g.fillStyle = '#c0c0c0'; g.fillRect(4, 2, 26, 20); bevel(g, 4, 2, 26, 20, true, false);
      g.fillStyle = '#008080'; g.fillRect(7, 5, 20, 14);
      g.fillStyle = '#c0c0c0'; g.fillRect(10, 22, 14, 3); g.fillRect(2, 25, 30, 6); bevel(g, 2, 25, 30, 6, true, false);
    } else if (kind === 'bin') {
      g.fillStyle = '#dfdfdf'; g.beginPath(); g.moveTo(6, 6); g.lineTo(28, 6); g.lineTo(25, 31); g.lineTo(9, 31); g.closePath(); g.fill();
      g.strokeStyle = '#404040'; g.stroke();
      g.strokeStyle = '#808080';
      for (let i = 10; i < 26; i += 4) { g.beginPath(); g.moveTo(i, 8); g.lineTo(i + (i - 17) * 0.1, 30); g.stroke(); }
      if (binFull) { // crumpled options poking out
        g.fillStyle = '#fff'; g.strokeStyle = '#404040';
        for (let i = 0; i < Math.min(4, binFull); i++) { g.beginPath(); g.arc(10 + i * 5, 6 - (i % 2) * 3, 5, 0, 7); g.fill(); g.stroke(); }
      }
    } else if (kind === 'doc') {
      g.fillStyle = '#fff'; g.fillRect(8, 2, 20, 28); g.strokeStyle = '#000'; g.strokeRect(8.5, 2.5, 19, 27);
      g.fillStyle = '#000080'; for (let i = 0; i < 5; i++) g.fillRect(11, 8 + i * 4, i === 4 ? 8 : 14, 1);
    } else {
      g.fillStyle = '#c0a000'; g.fillRect(2, 7, 30, 22); g.fillStyle = '#ffff80'; g.fillRect(2, 4, 13, 5); g.fillStyle = '#ffd800'; g.fillRect(2, 10, 30, 19);
      g.strokeStyle = '#806000'; g.strokeRect(2.5, 9.5, 29, 19);
    }
    g.font = f(11); g.textAlign = 'center'; g.textBaseline = 'top';
    const tw = g.measureText(label).width + 4;
    if (sel) { g.fillStyle = '#000080'; g.fillRect(17 - tw / 2, 36, tw, 14); }
    g.fillStyle = '#fff';
    g.fillText(label, 17, 37);
    g.restore();
  }

  function paintDesk() {
    d.fillStyle = TEAL;
    d.fillRect(0, 0, desk.w, desk.h);
    const sp = k.space();
    const icons = [['pc', 'My Computer'], ['doc', 'grill.md'], ['folder', 'Decisions'], ['folder', 'Parked']];
    icons.forEach(([kind, label], i) => deskIcon(d, kind, 22, 18 + i * 76, label, i === 1));
    const R = sp.notes ? sp.notes.left : sp.vw;
    deskIcon(d, 'doc', R + 30, 18, 'README.txt');
    deskIcon(d, 'folder', R + 30, 94, 'New Folder (37)');
    if (ctx.front === 'done') shutdown();
    else if (k.reduced && trail) for (let t = 0; t < 2.6; t += 1 / 30) { const [x, y] = trail.at(t); d.drawImage(trail.win.spr, x, y, trail.win.w, trail.win.h); }
  }

  // "It's now safe to turn off your computer."
  function shutdown() {
    d.fillStyle = '#000';
    d.fillRect(0, 0, desk.w, desk.h);
    const sp = k.space();
    const g = sp.gaps.find((x) => x.where !== 'top' && x.h > 70) || sp.gaps[0] || { x: 0, y: 0, w: desk.w, h: desk.h };
    const size = k.clamp(g.w / 18, 18, 40);
    d.font = f(size, 400);
    d.fillStyle = '#ff8c00';
    d.textAlign = 'center';
    d.textBaseline = 'middle';
    const lines = k.wrap(d, 'It’s now safe to turn off your computer.', g.w - 40, 2);
    lines.forEach((l, i) => d.fillText(l, g.x + g.w / 2, g.y + g.h / 2 + (i - (lines.length - 1) / 2) * size * 1.3 - 10));
    d.font = f(13);
    d.fillStyle = '#b06000';
    d.fillText('(the grill is done. go outside.)', g.x + g.w / 2, g.y + g.h / 2 + lines.length * size * 0.65 + 18);
    d.textAlign = 'left';
  }

  // ── what the popups say ─────────────────────────────────────────────────

  function buttonsFor(q) {
    if (!q || !q.options.length) return { buttons: ['OK', 'Also OK'], def: 0 };
    const opts = q.options.slice(0, 3).map((o) => o.label);
    if (q.options.length > 3) opts[2] = `${q.options.length - 2} more…`;
    return { buttons: opts, def: Math.max(0, q.options.slice(0, 3).findIndex((o) => o.recommended)) };
  }

  function script() {
    const q = ctx.question;
    if (ctx.front === 'done') return [];
    if (!q) {
      return [
        { kind: 'i', title: 'Grill.exe', text: 'Please wait while the agent thinks about your plan…', buttons: ['Cancel'], progress: 0.35 },
        { kind: 'i', title: 'Grill.exe', text: 'Please wait while the agent thinks about your plan…\nTime remaining: 3 minutes', buttons: ['Cancel'], progress: 0.6 },
        { kind: 'i', title: 'Grill.exe', text: 'Please wait while the agent thinks about your plan…\nTime remaining: 4 years', buttons: ['Cancel'], progress: 0.62 },
        { kind: '!', title: 'Grill.exe', text: 'The agent is still thinking.\nPressing Cancel will not help.', buttons: ['Cancel', 'Cancel harder'] },
        { kind: 'i', title: 'Grill.exe', text: 'Please wait…\nTime remaining: 11 seconds', buttons: ['Cancel'], progress: 0.97 },
      ];
    }
    const b = buttonsFor(q);
    const title = k.plain(q.title);
    return [
      { kind: '?', title: `Grill.exe - Question ${q.n} of ${q.total}`, text: q.options.length ? title : `${title}\n\nThis question has no options.`, ...b },
      { kind: '!', title: 'Confirm', text: 'Are you sure?', ...b },
      { kind: '!', title: 'Confirm', text: 'Are you REALLY sure?', ...b },
      { kind: '!', title: 'Confirm Decision', text: 'Are you REALLY REALLY sure?\nThis cannot be undone. Probably.', ...b },
      { kind: 'x', title: 'Grill.exe', text: `Grill.exe has performed an illegal indecision and will be shut down.\n${q.recommended.length ? 'If the problem persists, pick the ★ one.' : 'If the problem persists, just pick one.'}`, buttons: ['Close', 'Details >>'] },
      { kind: 'x', title: 'Grill.exe (Not Responding)', text: `A fatal exception 0E has occurred at 0028:C0FFEE${q.n} in VXD DECIDE(0${q.n}).`, buttons: ['OK'], hang: true },
      { kind: '?', title: 'Grill.exe', text: 'Have you tried turning the question off and on again?', buttons: ['Yes', 'No', 'Help'] },
      { kind: '!', title: 'Low Memory', text: 'Your brain is running low on memory.\nClose some tabs and try again.', buttons: ['OK'] },
    ];
  }

  // ── layout: the cascade lives in the biggest gap that can hold it ───────

  function layout() {
    sp = k.space();
    const ok = sp.gaps.filter((g) => g.where !== 'top' && g.w >= 260 && g.h >= 110);
    const g = ok.find((x) => x.where === 'bottom') || ok[0] || sp.gaps.find((x) => x.where === 'top') || { x: sp.stage.left, y: sp.vh - 200, w: sp.stage.width, h: 170 };
    area = { x: g.x, y: g.y, w: g.w, h: Math.max(110, g.h - 34) }; // 30px of taskbar at the bottom
    area.dw = Math.min(400, area.w - 40);
    paintDesk();
  }

  function spawn(spec) {
    const n = wins.length;
    const dl = dialog({ ...spec, w: area.dw });
    const span = Math.max(1, Math.min(6, Math.floor((area.h - dl.h) / 22) + 1, Math.floor((area.w - dl.w) / 26) + 1));
    const i = n % span;
    const x0 = area.x + Math.max(10, (area.w - dl.w - (span - 1) * 26) / 2);
    const win = { ...dl, kind: spec.kind, x: x0 + i * 26, y: area.y + 6 + i * 22, born: clock, hang: spec.hang };
    wins.push(win);
    if (wins.length > 8) wins.shift();
    if (spec.kind === 'x') {
      k.sfx.tone({ type: 'triangle', freq: 523, dur: 0.5, gain: 0.08 });
      k.sfx.tone({ type: 'triangle', freq: 392, dur: 0.6, gain: 0.08, delay: 0.12 });
    } else k.sfx.tone({ type: 'triangle', freq: spec.kind === '!' ? 880 : 660, to: spec.kind === '!' ? 660 : 880, dur: 0.25, gain: 0.07 });
    return win;
  }

  function startTrail(win) {
    const cx = area.x + area.w / 2 - win.w / 2, cy = area.y + area.h / 2 - win.h / 2;
    const ax = Math.max(20, (area.w - win.w) / 2 - 6), ay = Math.max(10, (area.h - win.h) / 2);
    const ph = k.rand(0, 6);
    trail = { win, t0: clock, at: (t) => [cx + Math.sin(t * 1.15 + ph) * ax, cy + Math.sin(t * 1.9 + ph * 2) * ay] };
    busy = 8;
  }

  function reset(hard) {
    wins = [];
    trail = null;
    step = 0;
    nextAt = clock + 0.5;
    busy = 0;
    if (hard) paintDesk(); else wipe = { y: 0 };
  }

  // Click a popup and it asks whether you're sure about that too.
  k.on(k.root, 'pointerdown', (e) => {
    const hit = [...wins].reverse().find((w) => e.clientX >= w.x && e.clientX <= w.x + w.w && e.clientY >= w.y && e.clientY <= w.y + w.h);
    if (!hit || done) return;
    spawn({ kind: '?', title: 'Confirm', text: k.pick(['Are you sure you want to click that?', 'Clicking here will not choose an option.\nThe real buttons are on the card.', 'Are you sure you’re sure?', 'This popup has been closed.\nPlease close this popup to continue.']), buttons: ['Yes', 'No'] });
  });

  function drawTaskbar() {
    const y = sp.vh - 30;
    c.fillStyle = FACE;
    c.fillRect(0, y, live.w, 30);
    c.fillStyle = '#fff';
    c.fillRect(0, y + 1, live.w, 1);
    c.fillStyle = '#dfdfdf';
    c.fillRect(0, y, live.w, 1);
    const L = sp.stage.left + 4, R = sp.stage.right - 4;
    // Start
    c.fillStyle = FACE; c.fillRect(L, y + 4, 62, 22); bevel(c, L, y + 4, 62, 22);
    c.fillStyle = '#ff5a00'; c.beginPath(); c.moveTo(L + 9, y + 21); c.quadraticCurveTo(L + 6, y + 12, L + 12, y + 8); c.quadraticCurveTo(L + 12, y + 14, L + 16, y + 12); c.quadraticCurveTo(L + 20, y + 17, L + 16, y + 21); c.fill();
    c.fillStyle = '#ffd200'; c.beginPath(); c.arc(L + 12.5, y + 18, 2.6, 0, 7); c.fill();
    c.fillStyle = '#000'; c.font = f(11, 700); c.textBaseline = 'middle'; c.fillText('Start', L + 22, y + 15.5);
    // tray with the clock
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    c.font = f(11);
    const tw = c.measureText(time).width + 36;
    c.fillStyle = FACE; c.fillRect(R - tw, y + 4, tw, 22); bevel(c, R - tw, y + 4, tw, 22, false, false);
    c.fillStyle = '#000'; c.fillText(time, R - tw + 28, y + 15.5);
    c.fillStyle = '#808080'; c.fillRect(R - tw + 7, y + 10, 4, 10); c.fillStyle = '#ffff00'; c.fillRect(R - tw + 13, y + 9, 8, 11); c.fillStyle = '#000'; c.fillRect(R - tw + 16, y + 11, 2, 5); c.fillRect(R - tw + 16, y + 17, 2, 2);
    // one button per popup, squeezed as they pile up
    const room = R - tw - 6 - (L + 68);
    const list = trail ? [trail.win.title] : wins.map((w) => w.title);
    if (!list.length && ctx.question) list.push(`Grill.exe - ${ctx.question.title}`);
    const bw = Math.min(150, room / Math.max(1, list.length) - 3);
    if (bw > 24) list.forEach((t, i) => {
      const x = L + 68 + i * (bw + 3);
      const on = i === list.length - 1;
      c.fillStyle = on ? '#dfdfdf' : FACE; c.fillRect(x, y + 4, bw, 22); bevel(c, x, y + 4, bw, 22, !on);
      if (on) { c.fillStyle = '#fff'; for (let px = x + 2; px < x + bw - 2; px += 2) for (let py = y + 6 + ((px / 2) % 2); py < y + 24; py += 2) c.fillRect(px, py, 1, 1); }
      c.fillStyle = '#000'; c.font = f(11, on ? 700 : 400);
      c.fillText(k.ellipsize(c, t, bw - 10), x + 6, y + 15.5 + (on ? 1 : 0));
    });
  }

  function drawCursor(x, y, hour) {
    c.save();
    c.translate(x, y);
    if (hour) { // hourglass
      c.fillStyle = '#000'; c.fillRect(-1, -1, 14, 3); c.fillRect(-1, 19, 14, 3);
      c.beginPath(); c.moveTo(0, 2); c.lineTo(12, 2); c.lineTo(7, 11); c.lineTo(12, 19); c.lineTo(0, 19); c.lineTo(5, 11); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(2, 3); c.lineTo(10, 3); c.lineTo(6, 10); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(6, 13); c.lineTo(10, 18); c.lineTo(2, 18); c.closePath(); c.fill();
    } else {
      c.fillStyle = '#fff'; c.strokeStyle = '#000';
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 17); c.lineTo(4, 13); c.lineTo(7, 20); c.lineTo(10, 19); c.lineTo(7, 12); c.lineTo(12, 12); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
  }

  function drawFlying(dt) {
    for (let i = flying.length - 1; i >= 0; i--) {
      const p = flying[i];
      p.t += dt / 0.9;
      if (p.t >= 1) { flying.splice(i, 1); continue; }
      const e = k.ease.inOutQuad(p.t);
      const x = k.lerp(p.x0, p.x1, e), y = k.lerp(p.y0, p.y1, e) - Math.sin(p.t * Math.PI) * 40;
      c.fillStyle = '#fff'; c.fillRect(x, y, 12, 15); c.strokeStyle = '#000'; c.strokeRect(x + 0.5, y + 0.5, 11, 14);
      c.fillStyle = '#000080'; c.fillRect(x + 2, y + 4, 8, 1); c.fillRect(x + 2, y + 7, 8, 1); c.fillRect(x + 2, y + 10, 5, 1);
    }
  }

  function answer(a) {
    if (done) return;
    const q = ctx.question;
    const rejected = q ? q.options.filter((o) => !a.picks.includes(o.label)) : [];
    reset(true);
    step = 99; // the card is answered: no more nagging
    const what = rejected.length === 1 ? `'${k.clip(rejected[0].label, 40)}'` : `${rejected.length} options`;
    const w = spawn(rejected.length
      ? { kind: 'i', title: 'Moving…', text: `Moving ${what} to the Recycle Bin`, buttons: ['Cancel'], progress: 0.8 }
      : { kind: 'i', title: 'Grill.exe', text: 'Decision saved to A:\\\nPlease do not remove the floppy disk.', buttons: ['OK'] });
    if (!a.tookRec && a.hasRec) k.after(500, () => spawn({ kind: '!', title: 'Windows', text: 'You did not pick the recommended option.\nWindows is searching for a solution to the problem…', buttons: ['Cancel'], progress: 0.1 }));
    const bin = binSpot();
    for (let i = 0; i < Math.min(5, rejected.length); i++) flying.push({ x0: w.x + 70, y0: w.y + 40, x1: bin.x + 10, y1: bin.y + 6, t: -i * 0.25 });
    k.after(800, () => { binFull += rejected.length; });
    k.sfx.whoosh({ pitch: 1.5, gain: 0.3 });
  }

  function binSpot() {
    return { x: area.x + area.w - 60, y: area.y + area.h - 56 };
  }

  layout();
  // A DPR change keeps the pile, the drag and the smeared trail (carried over by the kit): popups are just
  // re-rendered, and the desktop only repainted if there's no trail on it to lose.
  desk.resized = (w, h, { dprOnly } = {}) => {
    if (!dprOnly) return layout();
    for (const win of new Set([...wins, trail?.win].filter(Boolean))) win.spr = dialog(win.spec).spr;
    if (!wipe && (!trail || k.reduced)) paintDesk();
  };

  const L = k.loop((dt) => {
    clock += dt;
    if (wipe) { // the desktop repaints itself in a band sweeping down, like a hung redraw finally catching up
      wipe.y += dt * desk.h * 2.2;
      d.fillStyle = TEAL;
      d.fillRect(0, wipe.y - desk.h * 2.2 / 60 - 4, desk.w, desk.h * 2.2 / 60 + 8);
      if (wipe.y > desk.h) { wipe = null; paintDesk(); }
    }
    done = ctx.front === 'done';
    const lines = script();
    if (!done && !trail && step < lines.length && clock >= nextAt) {
      const spec = lines[step++];
      const w = spawn(spec);
      nextAt = clock + (step === 1 ? 2.4 : k.rand(2.6, 3.6));
      if (spec.hang) k.after(1600, () => { if (wins.includes(w)) startTrail(w); });
    }
    if (!done && !trail && step >= lines.length && step < 99 && clock > nextAt + 4) { // round two
      reset(false);
      step = 1;
    }
    if (trail) {
      const t = clock - trail.t0;
      const [x, y] = trail.at(t);
      trail.win.x = x; trail.win.y = y;
      if (!k.reduced || t === 0) d.drawImage(trail.win.spr, x, y, trail.win.w, trail.win.h);
      if (t > 7.5) { reset(false); step = 1; nextAt = clock + 1.5; }
    }

    c.clearRect(0, 0, live.w, live.h);
    // the bin, so options have somewhere to go
    if (!done) {
      const b = binSpot();
      deskIcon(c, 'bin', b.x, b.y, binFull ? `Recycle Bin (${binFull})` : 'Recycle Bin', false);
    }
    for (const w of wins) {
      if (trail && w === trail.win) continue;
      const pop = Math.min(1, (clock - w.born) / 0.12);
      if (pop < 1) continue; // Win95 didn't animate. It just appeared, eventually.
      c.drawImage(w.spr, w.x, w.y, w.w, w.h);
    }
    if (trail) {
      const w = trail.win;
      c.drawImage(w.spr, w.x, w.y, w.w, w.h);
      drawCursor(w.x + w.w - 74, w.y + 7, false); // dragging by the title bar, hourglass and all
      drawCursor(w.x + w.w - 58, w.y + 2, true);
    } else if (!done && wins.length && wins.at(-1).kind === 'x') {
      const w = wins.at(-1);
      drawCursor(w.x + w.w - 60, w.y + w.h - 18, true);
    }
    drawFlying(dt);
    if (!done) drawTaskbar();
  }, { still: 0 });

  if (k.reduced) { // the still: a full pile of popups, a smeared trail and the hourglass
    const lines = script();
    lines.slice(0, 5).forEach(spawn);
    if (ctx.question && lines[5]) {
      const w = dialog({ ...lines[5], w: area.dw });
      const win = { ...w, x: area.x, y: area.y, born: -1, kind: 'x' };
      startTrail(win);
      trail.t0 = clock - 2.6;
      paintDesk();
    }
    wins.forEach((w) => { w.born = -1; });
    L.redraw();
  }

  return {
    question() {
      done = ctx.front === 'done';
      layout();
      reset(true);
      nextAt = clock + 0.6;
    },
    layout() {
      layout();
      if (wins.length) { // re-stack the pile in the new space
        const keep = wins;
        wins = [];
        keep.forEach((w) => { const n = wins.length; w.x = area.x + Math.max(10, (area.w - w.w) / 2 - 60) + (n % 5) * 26; w.y = area.y + 6 + (n % 5) * 22; wins.push(w); });
      }
    },
    answer,
    status() { if (!ctx.question) { reset(true); } },
  };
}
