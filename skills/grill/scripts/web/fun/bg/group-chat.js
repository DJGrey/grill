// Group chat. A giant phone on the wall running the one group chat with Mum, the team and your
// ex in it. They react to the question, to how long you take, to your answers, and your ex
// starts typing whenever you do.

const PEOPLE = {
  mum: { name: 'Mum', color: '#c2255c', bg: 'linear-gradient(135deg,#ffc9de,#ff8fab)', emoji: '🌸', init: 'M' },
  team: { name: 'the team', color: '#1971c2', bg: 'linear-gradient(135deg,#a5d8ff,#4dabf7)', emoji: '🚀', init: 'T' },
  ex: { name: 'your ex', color: '#d9480f', bg: 'linear-gradient(135deg,#ffd8a8,#ff922b)', emoji: '🙃', init: 'X' },
};

const DOODLE = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><g fill='none' stroke='#8a7a62' stroke-opacity='.11' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M20 30c0-6 8-9 11-3 3-6 11-3 11 3 0 7-11 13-11 13s-11-6-11-13z'/><path d='M100 20h30a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6h-18l-8 7v-7h-4a6 6 0 0 1-6-6V26a6 6 0 0 1 6-6z'/><circle cx='60' cy='95' r='12'/><path d='M55 92h.1M65 92h.1M55 99c3 3 7 3 10 0'/><path d='M120 100l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z'/><path d='M18 120l14 14M32 120l-14 14'/><path d='M80 140c6-8 14-8 20 0'/><path d='M140 70a8 8 0 1 1-8-8'/></g></svg>`)}")`;

const CSS = `
.gc { position:absolute; inset:0; overflow:hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "Noto Sans", sans-serif;
  background: radial-gradient(ellipse 70% 60% at 50% 30%, rgba(255,250,235,.55), transparent 70%), repeating-linear-gradient(90deg, #b9cbb4 0 34px, #b2c5ad 34px 68px); }
.gc::after { content:''; position:absolute; inset:0; background: radial-gradient(ellipse 120% 90% at 50% 40%, transparent 50%, rgba(40,50,35,.35)); pointer-events:none; }
.gc-shelf { position:absolute; height:14px; border-radius:3px; background:linear-gradient(#a47148,#7c5130); box-shadow:0 10px 18px -6px rgba(0,0,0,.45); }
.gc-frame { position:absolute; border:10px solid #f3eee4; border-radius:3px; box-shadow:0 0 0 2px #c8bda8, 0 14px 28px -10px rgba(0,0,0,.5); }
.gc-phone { position:absolute; border-radius:50px; background:#111; padding:10px; z-index:1;
  box-shadow: 0 0 0 2px #3a3a3c, 0 0 0 5px #1b1b1d, 0 40px 80px -20px rgba(0,0,0,.6), 0 18px 30px -12px rgba(0,0,0,.45); }
.gc-phone::before { content:''; position:absolute; left:-4px; top:150px; width:3px; height:70px; border-radius:2px; background:#2b2b2d; box-shadow: 0 90px 0 #2b2b2d; }
.gc-screen { position:relative; width:100%; height:100%; border-radius:40px; overflow:hidden; background:#efe7dd ${DOODLE}; }
.gc-head { position:absolute; left:0; right:0; top:0; height:44px; display:flex; align-items:center; gap:10px; padding:0 18px;
  background:rgba(247,243,236,.92); backdrop-filter: blur(12px); border-bottom:1px solid rgba(0,0,0,.08); z-index:3; }
.gc-back { color:#0a7cff; font-size:15px; font-weight:500; display:flex; align-items:center; gap:2px; min-width:44px; }
.gc-back b { font-size:26px; font-weight:300; line-height:1; margin-top:-3px; }
.gc-back span { background:#0a7cff; color:#fff; border-radius:10px; font-size:11.5px; font-weight:700; padding:1px 6px; transition: transform .25s; }
.gc-stack { display:flex; }
.gc-stack .gc-av { width:26px; height:26px; font-size:13px; margin-left:-9px; border:2px solid #f7f3ec; font-size:15px; }
.gc-stack .gc-av:first-child { margin-left:0; }
.gc-title { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:14.5px; color:#6b6b6b; }
.gc-title b { color:#111; font-weight:650; }
.gc-icons { display:flex; gap:16px; color:#0a7cff; }
.gc-icons svg { width:22px; height:22px; }
.gc-thread { position:absolute; left:0; right:0; display:flex; flex-direction:column; justify-content:flex-end; gap:3px; padding:0 14px; }
.gc-row { display:flex; align-items:flex-end; gap:7px; max-width:100%; flex:none; }
.gc-row.out { justify-content:flex-end; }
.gc-av { flex:none; width:28px; height:28px; border-radius:50%; display:grid; place-items:center; font-size:14px; font-weight:700; color:#fff; box-shadow:inset 0 0 0 1px rgba(0,0,0,.06); }
.gc-av.ghost { visibility:hidden; }
.gc-col { display:flex; flex-direction:column; min-width:0; max-width:min(72%, 420px); }
.gc-name { font-size:11.5px; font-weight:600; margin:6px 0 2px 12px; }
.gc-bub { position:relative; padding:7px 12px 8px; border-radius:18px; font-size:14.5px; line-height:1.3; color:#111; background:#fff;
  box-shadow:0 1px 1px rgba(0,0,0,.12); overflow-wrap:anywhere; transform-origin: 0 100%; }
.gc-row.in .gc-bub.tail { border-bottom-left-radius:5px; }
.gc-row.out .gc-bub { background:linear-gradient(#1a8dff,#0a7cff); color:#fff; max-width:min(72%, 420px); transform-origin:100% 100%; }
.gc-row.out .gc-bub.tail { border-bottom-right-radius:5px; }
.gc-react { position:absolute; top:-14px; display:flex; gap:2px; }
.gc-row.in .gc-react { right:-16px; } .gc-row.out .gc-react { left:-18px; }
.gc-react i { font-style:normal; font-size:13px; width:26px; height:26px; border-radius:50%; display:grid; place-items:center; background:#e9e9eb; border:2px solid #efe7dd; box-shadow:0 1px 2px rgba(0,0,0,.2); }
.gc-row.out .gc-react i { background:#0a7cff; }
.gc-receipt { align-self:flex-end; font-size:11px; color:#7a7366; margin:1px 4px 4px; font-weight:500; }
.gc-sys { align-self:center; text-align:center; font-size:11.5px; color:#6f6858; margin:8px 20px 4px; line-height:1.35; max-width:85%; }
.gc-sys b { color:#4a4436; font-weight:600; }
.gc-typing { display:flex; gap:4px; padding:12px 14px; }
.gc-typing i { width:8px; height:8px; border-radius:50%; background:#9a9a9f; animation: gc-dot 1.2s infinite ease-in-out; }
.gc-typing i:nth-child(2) { animation-delay:.15s; } .gc-typing i:nth-child(3) { animation-delay:.3s; }
@keyframes gc-dot { 0%,60%,100% { transform:translateY(0); opacity:.5 } 30% { transform:translateY(-4px); opacity:1 } }
.gc.still .gc-typing i { animation:none; opacity:.5; } .gc.still .gc-typing i:nth-child(2) { opacity:1; transform:translateY(-3px); }
.gc-compose { position:absolute; left:0; right:0; bottom:0; height:62px; display:flex; align-items:center; gap:10px; padding:0 16px 8px;
  background:rgba(247,243,236,.94); border-top:1px solid rgba(0,0,0,.08); z-index:3; }
.gc-plus { width:30px; height:30px; border-radius:50%; background:#e3ddd2; color:#6b6458; display:grid; place-items:center; font-size:21px; font-weight:300; }
.gc-field { flex:1; height:34px; border-radius:17px; border:1px solid #d3cbbd; background:#fff; display:flex; align-items:center; padding:0 14px; color:#9b958a; font-size:14px; white-space:nowrap; overflow:hidden; }
.gc-banner { position:absolute; z-index:4; display:flex; gap:10px; align-items:center; padding:9px 14px; border-radius:16px;
  background:rgba(250,248,244,.94); backdrop-filter: blur(16px); box-shadow:0 10px 30px -8px rgba(0,0,0,.35); font-size:13px; color:#111; line-height:1.25; }
.gc-banner small { color:#6b6b6b; display:block; font-size:11.5px; }
.gc-banner .gc-av { width:30px; height:30px; }
`;

const EMOJI = "font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
const ICON_VIDEO = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="6" width="14" height="12" rx="3"/><path d="M17 10.5l5-3v9l-5-3z"/></svg>';
const ICON_CALL = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>';

export default function groupChat(k, ctx) {
  k.el('style', { text: CSS });
  const root = k.el('div', { class: k.reduced ? 'gc still' : 'gc' });
  const decor = [
    k.el('div', { class: 'gc-frame', style: 'background:linear-gradient(160deg,#ffd8a8,#f783ac 60%,#845ef7)' }, root),
    k.el('div', { class: 'gc-frame', style: 'background:linear-gradient(200deg,#99e9f2,#3bc9db 50%,#2b8a3e)' }, root),
    k.el('div', { class: 'gc-shelf' }, root),
  ];
  const phone = k.el('div', { class: 'gc-phone' }, root);
  const screen = k.el('div', { class: 'gc-screen' }, phone);
  const thread = k.el('div', { class: 'gc-thread' }, screen);
  const av = (who) => {
    const p = PEOPLE[who];
    const e = k.canRender(p.emoji, 'emoji');
    return `<div class="gc-av" style="background:${p.bg};${e ? EMOJI : ''}">${e ? p.emoji : p.init}</div>`;
  };
  const head = k.html(`<div class="gc-head">
    <div class="gc-back"><b>‹</b><span>12</span></div>
    <div class="gc-stack">${av('mum')}${av('team')}${av('ex')}</div>
    <div class="gc-title"><b></b> · Mum, the team, your ex, you</div>
    <div class="gc-icons">${ICON_CALL}${ICON_VIDEO}</div></div>`, screen);
  const groupName = head.querySelector('.gc-title b');
  const unread = head.querySelector('.gc-back span');
  const compose = k.html('<div class="gc-compose"><div class="gc-plus">+</div><div class="gc-field">Message the group chat</div></div>', screen);
  const field = compose.querySelector('.gc-field');

  let unreadN = 12;
  let last = null; // the last row: { who, bub, el }
  let typingRow = null;
  let banner = null;
  let gapH = 300;
  let queue = Promise.resolve();
  let epoch = 0; // bumped when the card changes, so stale queued chatter is dropped
  let lastDecisions = ctx.decisions.length;
  let fired = new Set();
  let name = 'the group chat 🔥';

  const wclip = (s, n) => (s.length <= n ? s : `${s.slice(0, n).replace(/\s+\S*$/, '')}…`);
  const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const rec = () => ctx.question?.recommended[0];
  const other = () => ctx.question?.options.find((o) => !o.recommended)?.label;
  const clipT = (s, n) => k.clip(k.plain(s), n);

  function setName(n) {
    name = n;
    groupName.textContent = n;
  }

  function trim() {
    const rows = thread.children;
    while (rows.length > 40) rows[0].remove();
  }

  function grow(el) {
    if (k.reduced) return;
    const h = el.offsetHeight;
    k.animate(el, [{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const b = el.querySelector('.gc-bub');
    if (b) k.animate(b, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  function stopTyping() {
    if (typingRow) { typingRow.remove(); typingRow = null; }
  }

  function row(who, html, { pop = true } = {}) {
    stopTyping();
    const out = who === 'you';
    const same = last && last.who === who && last.el.isConnected;
    if (same && !out) { // group with the previous bubble: drop its tail and avatar
      last.bub.classList.remove('tail');
      last.el.querySelector('.gc-av')?.classList.add('ghost');
    }
    if (same && out) last.bub.classList.remove('tail');
    thread.querySelectorAll('.gc-receipt').forEach((r) => out && r.remove());
    const el = k.html(out
      ? `<div class="gc-row out"><div class="gc-bub tail"></div></div>`
      : `<div class="gc-row in">${av(who)}<div class="gc-col">${same ? '' : `<div class="gc-name" style="color:${PEOPLE[who].color}">${PEOPLE[who].name}</div>`}<div class="gc-bub tail"></div></div></div>`, thread);
    const bub = el.querySelector('.gc-bub');
    bub.innerHTML = html;
    last = { who, bub, el };
    trim();
    if (pop) grow(el);
    return last;
  }

  function sys(html) {
    const el = k.el('div', { class: 'gc-sys', html }, thread);
    last = null;
    if (!k.reduced) grow(el);
    trim();
  }

  function react(m, emoji) {
    if (!m?.bub.isConnected) return;
    let r = m.bub.querySelector('.gc-react');
    if (!r) r = k.el('div', { class: 'gc-react' }, m.bub);
    if (r.children.length >= 3) return;
    const i = k.el('i', { text: emoji }, r);
    if (!k.reduced) k.animate(i, [{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'scale(1.3)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
    k.sfx.tone({ type: 'sine', freq: 1500, to: 1900, dur: 0.06, gain: 0.05 });
  }

  function typing(who) {
    stopTyping();
    const el = k.html(`<div class="gc-row in">${av(who)}<div class="gc-col"><div class="gc-name" style="color:${PEOPLE[who].color}">${PEOPLE[who].name}</div><div class="gc-bub tail gc-typing"><i></i><i></i><i></i></div></div></div>`, thread);
    typingRow = el;
    grow(el);
  }

  // When the bottom gap is too short to read the thread, new messages also drop in as banners up top.
  function notify(who, text) {
    if (gapH >= 120 || k.reduced) return;
    const sp = k.space();
    const top = sp.gaps.find((g) => g.where === 'top' && g.h >= 40);
    if (!top) return;
    banner?.remove();
    const p = PEOPLE[who];
    const w = Math.min(420, top.w - 24);
    const b = banner = k.html(`<div class="gc-banner">${av(who)}<div style="min-width:0"><small>${esc(name)} · ${p.name}</small><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${text}</div></div></div>`, root);
    Object.assign(b.style, { left: `${top.x + (top.w - w) / 2}px`, width: `${w}px`, top: `${top.y + Math.max(4, (top.h - 52) / 2)}px` });
    k.animate(b, [{ transform: 'translateY(-80px)' }, { transform: 'translateY(0)' }], { duration: 420, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    k.after(3800, () => k.animate(b, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-30px)' }], { duration: 300, fill: 'forwards' }));
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);

  // say() queues a message: who types for a moment (longer for longer texts), then it lands.
  function say(who, text, { wait = 600, then } = {}) {
    const e = epoch;
    queue = queue.then(async () => {
      if (e !== epoch) return;
      if (k.reduced) { const m = who === 'sys' ? sys(text) : row(who, esc(text), { pop: false }); then?.(m); return; }
      await k.wait(wait);
      if (e !== epoch) return;
      if (who === 'sys') { sys(text); then?.(); return; }
      typing(who);
      const mine = typingRow;
      await k.wait(Math.min(2600, 500 + text.length * 28));
      if (e !== epoch) { if (typingRow === mine) stopTyping(); return; } // never someone else's dots
      const m = row(who, esc(text));
      unreadN++;
      unread.textContent = unreadN;
      k.animate(unread, [{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 250 });
      k.sfx.tone({ type: 'sine', freq: who === 'mum' ? 1320 : who === 'ex' ? 990 : 1175, to: who === 'ex' ? 880 : 1760, dur: 0.12, gain: 0.07 });
      notify(who, esc(text));
      then?.(m);
    });
  }

  function history() {
    const prev = ctx.answers.filter((a) => a.id !== ctx.question?.id).slice(-2);
    sys(`<b>Mum</b> added <b>your ex</b> to the group by accident`);
    for (const a of prev) {
      const m = row('you', esc(k.clip(a.picks.join(', ') || a.custom || 'ok', 60)), { pop: false });
      react(m, a.tookRec ? '❤️' : '❓');
      if (a.tookRec) react(m, '👍');
      row(a.tookRec ? 'mum' : 'ex', esc(a.tookRec ? 'well done love x' : 'interesting choice'), { pop: false });
    }
  }

  function opener() {
    const q = ctx.question;
    const t = [];
    if (ctx.front === 'done') {
      say('sys', '<b>Mum</b> named the group <b>my clever child 🎓</b>', { wait: 300, then: () => setName('my clever child 🎓') });
      say('mum', 'all done?? come for dinner sunday x');
      say('team', '🚢🚢🚢 shipping it');
      say('ex', 'proud of you. not in a weird way', { wait: 1400 });
      return;
    }
    if (!q) {
      say('team', 'agent is cooking 👨‍🍳', { wait: 300 });
      say('mum', 'is the computer still thinking. should i turn it off and on again');
      say('ex', 'some of us know what it’s like to wait for an answer', { wait: 2400 });
      return;
    }
    if (q.revising) {
      say('ex', `going back to q${q.n}? some of us know how that feels`, { wait: 300 });
      return;
    }
    const short = wclip(k.plain(q.title).replace(/\?$/, ''), 42);
    say('sys', `<b>the team</b> named the group <b>${esc(clipT(q.title, 30))}</b>`, { wait: 200, then: () => setName(clipT(q.title, 30)) });
    t.push(['team', q.title.length > 90 ? `q${q.n} is ${q.title.split(' ').length} words long. tl;dr?` : `q${q.n} of ${q.total} just dropped 👀`]);
    if (!q.options.length) t.push(['mum', 'there are no buttons on this one. do you just type? i’ll ask your brother']);
    else if (q.tag && k.chance(0.5)) t.push(['mum', `what does ${q.tag.toLowerCase()} mean love`]);
    else t.push(['mum', `good luck with “${lc(short)}” today. thinking of you lol`], ['mum', 'lol means lots of love x']);
    if (q.multi) t.push(['ex', 'you can pick more than one? sounds familiar 🙃']);
    else if (other()) t.push(['ex', `bet you pick “${lc(k.clip(other(), 40))}”. you always do`]);
    else t.push(['ex', 'you always took forever to answer questions']);
    if (rec() && k.chance(0.6)) t.push(['team', `fwiw the ★ says ${k.clip(rec(), 50)}`]);
    t.forEach(([who, text], i) => say(who, text, { wait: i ? k.rand(500, 1400) : 700 }));
  }

  // Idle chatter, by how long you've been looking at this card.
  const NAG = [
    [16, () => ['mum', 'have u picked yet']],
    [28, () => ['mum', rec() ? 'pick the recommended one x' : 'pick whichever one your father would pick x']],
    [48, () => ['team', 'no rush 🙂']],
    [51, () => ['team', '(there is a rush)']],
    [80, () => ['ex', 'u up?']],
    [115, () => ['sys', '📞 Missed video call from <b>Mum</b>']],
    [150, () => ['mum', 'I’M CALLING YOUR FATHER']],
    [210, () => ['team', 'standup is in 5 btw']],
    [300, () => ['ex', 'still thinking about it huh. some things never change']],
  ];

  function nag() {
    const q = ctx.question;
    if (ctx.front !== 'question' || !q || q.revising || ctx.answers.some((a) => a.id === q.id)) return;
    for (const [s, f] of NAG) {
      if (ctx.cardTime >= s && !fired.has(s)) {
        fired.add(s);
        const [who, text] = f();
        say(who, text, { wait: 0 });
      }
    }
  }

  // keep the call buttons clear of the score HUD
  function fitHead(sp) {
    const r = k.rect(head);
    head.style.paddingRight = r && sp.hud && sp.hud.bottom > r.top && sp.hud.left < r.right ? `${Math.max(18, r.right - sp.hud.left + 10)}px` : '';
  }

  function layout() {
    const sp = k.space();
    const st = sp.stage;
    const narrow = st.width < 700;
    const w = Math.min(st.width - (narrow ? 16 : 24), 860);
    const x = st.left + (st.width - w) / 2;
    Object.assign(phone.style, { left: `${x}px`, top: '6px', width: `${w}px`, height: `${sp.vh - 12}px` });
    fitHead(sp);
    const bottom = sp.gaps.find((g) => g.where === 'bottom');
    gapH = sp.card ? (bottom ? bottom.h - 70 : 0) : sp.vh;
    Object.assign(thread.style, { bottom: '68px', padding: `0 ${narrow ? 10 : 16}px` });
    // wall decor peeks out from under the frosted panels
    const L = sp.side ? sp.side.right : st.left;
    const R = sp.notes ? sp.notes.left : st.right;
    Object.assign(decor[0].style, { left: `${Math.max(20, L - 190)}px`, top: `${sp.vh * 0.18}px`, width: '120px', height: '150px', transform: 'rotate(-3deg)' });
    Object.assign(decor[1].style, { left: `${R + 60}px`, top: `${sp.vh * 0.12}px`, width: '170px', height: '120px', transform: 'rotate(2deg)' });
    Object.assign(decor[2].style, { left: `${R + 40}px`, top: `${sp.vh * 0.62}px`, width: '240px' });
  }

  function answer(a) {
    epoch++;
    queue = Promise.resolve();
    stopTyping();
    const text = [a.picks.join(', '), a.custom].filter(Boolean).join(', ') || 'ok';
    const m = row('you', esc(k.clip(text, 90)));
    k.sfx.whoosh({ pitch: 2.2, gain: 0.25 });
    const rc = k.el('div', { class: 'gc-receipt', text: 'Delivered' }, thread);
    k.after(500, () => { rc.textContent = 'Read by Mum, the team'; });
    k.after(1500, () => { rc.textContent = 'Read by Mum, the team · Seen by your ex'; });
    if (a.tookRec) {
      k.after(250, () => react(m, '❤️'));
      k.after(550, () => react(m, '👍'));
      say('mum', k.pick(['that’s my clever child ❤️ x', 'so proud. telling everyone at church', 'see i told you x']), { wait: 150 });
      say('ex', k.pick(['oh so NOW you can commit', 'wow. you took the recommendation. growth']), { wait: 900 });
      say('team', '🚢');
    } else if (a.hasRec) {
      k.after(250, () => react(m, '‼️'));
      k.after(600, () => react(m, '❓'));
      say('mum', 'did u pick the recommended one', { wait: 150 });
      say('mum', 'it had a star on it love', { wait: 900 });
      say('team', 'bold. respect. reverting it tomorrow');
      say('ex', 'you never listened to recommendations either');
    } else {
      k.after(300, () => react(m, '👍'));
      say('team', 'noted 📝', { wait: 150 });
      say('mum', 'very good x');
    }
    if (a.custom?.length > 60) say('ex', 'wow paragraphs. you never wrote me paragraphs');
    if (a.revision) say('ex', 'changing your mind again? shocking');
    if (a.seconds < 6) say('team', 'speedrun any% 🏃');
    else if (a.seconds > 150) say('mum', 'FINALLY');
  }

  function fresh() {
    fired = new Set();
    stopTyping();
    opener();
  }

  layout();
  history();
  if (k.reduced) { // the still: the conversation already had, punchline included
    setName(ctx.question ? clipT(ctx.question.title, 30) : 'the group chat 🔥');
    opener();
    if (ctx.question && !ctx.question.revising) {
      say('mum', 'have u picked yet');
      say('mum', rec() ? 'did u pick the recommended one' : 'pick whichever one your father would pick x');
      queue.then(() => typing('ex'));
    }
  } else {
    setName('the group chat 🔥');
    opener();
    k.every(1000, nag);
  }

  return {
    question() { layout(); if (ctx.front !== 'question' || !ctx.answers.some((a) => a.id === ctx.question?.id) || ctx.question.revising) fresh(); },
    answer,
    layout,
    event(name) { if (name === 'stat') fitHead(k.space()); },
    status() {
      if (ctx.front === 'waiting' && ctx.agent === 'listening') say('team', 'it’s listening. say something nice', { wait: 200 });
    },
    decisions() {
      const d = ctx.decisions;
      if (d.length > lastDecisions) {
        const n = d[d.length - 1];
        say('sys', `<b>the team</b> pinned 📌 <b>${n.n ? `D${n.n}` : 'a decision'}</b>: ${esc(k.clip(n.text, 60))}`, { wait: 200 });
      }
      lastDecisions = d.length;
    },
    typing(on) {
      if (k.reduced) return;
      field.textContent = on ? 'You are typing somewhere else…' : 'Message the group chat';
      if (on) k.after(500, () => { if (ctx.typing && !typingRow) typing('ex'); });
      else if (typingRow) {
        stopTyping();
        if (k.chance(0.25)) say('ex', k.pick(['nvm', 'actually forget it', 'nothing x', 'no wait']), { wait: 0 });
      }
    },
  };
}
