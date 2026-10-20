// LinkedIn-ish feed. Thought leaders post about your question in the space under the card, the
// feed scrolls on every so often, likes climb, and the notification badge never stops.

const EMOJI = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

const PEOPLE = {
  chad: { name: 'Chad Synergy', deg: '3rd+', head: 'Chief Visionary Officer | 3x Founder | Keynote Speaker | Ex-Unicorn | Disrupting disruption', av: '😎', bg: 'linear-gradient(135deg,#ffd43b,#f08c00)' },
  brenda: { name: 'Brenda Pivot', deg: '2nd', head: '★ Top Voice in Thought Leadership | I help founders 10x their alignment', av: '🦄', bg: 'linear-gradient(135deg,#eebefa,#9c36b5)' },
  kyle: { name: 'Kyle Grindset', deg: '3rd+', head: 'Founder @ Stealth | Ex-Stealth | Up at 4am so you don’t have to', av: '💪', bg: 'linear-gradient(135deg,#ffa8a8,#e03131)' },
  priya: { name: 'Priya Roadmap', deg: '2nd', head: 'VP of Circling Back at Synergy Corp | Let’s take this offline', av: '📈', bg: 'linear-gradient(135deg,#96f2d7,#0ca678)' },
  rob: { name: 'Recruiter Rob', deg: '3rd+', head: 'Talent Rockstar 🎸 | Hiring 10x engineers for 1x salaries', av: '🎯', bg: 'linear-gradient(135deg,#a5d8ff,#1c7ed6)' },
  agent: { name: 'Grill Agent', deg: 'Bot', head: 'Asking the hard questions since this morning | Open to feedback (not really)', av: '🔥', bg: 'linear-gradient(135deg,#ffe066,#fa5252)' },
  ad: { name: 'Deciding™ Enterprise', deg: '', head: 'Promoted', av: '🤝', bg: 'linear-gradient(135deg,#dee2e6,#868e96)' },
  you: { name: 'You', deg: '1st', head: 'Decision Maker', av: '🙂', bg: 'linear-gradient(135deg,#d0bfff,#5f3dc4)' },
};

const CSS = `
.li { position:absolute; inset:0; overflow:hidden; background:#f4f2ee; color:rgba(0,0,0,.9);
  font-family:-apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", sans-serif; }
.li-nav { position:absolute; left:0; right:0; top:0; height:52px; background:#fff; border-bottom:1px solid #e8e6e1; z-index:2; }
.li-navin { position:absolute; top:0; height:52px; display:flex; align-items:center; gap:6px; }
.li-logo { flex:none; width:34px; height:34px; border-radius:4px; background:#0a66c2; color:#fff; font:800 19px/34px system-ui, sans-serif; text-align:center; letter-spacing:-1px; }
.li-search { flex:1 1 220px; min-width:0; height:34px; border-radius:4px; background:#edf3f8; display:flex; align-items:center; gap:8px; padding:0 10px; color:#666; font-size:14px; white-space:nowrap; overflow:hidden; margin-right:10px; }
.li-search svg { flex:none; width:16px; height:16px; }
.li-ico { position:relative; flex:none; width:72px; display:flex; flex-direction:column; align-items:center; color:#666; font-size:12px; gap:1px; }
.li-ico svg { width:24px; height:24px; }
.li-ico.on { color:#191919; } .li-ico.on::after { content:''; position:absolute; bottom:-8px; left:6px; right:6px; height:2px; background:#191919; }
.li-badge { position:absolute; top:-4px; left:40px; background:#cb112d; color:#fff; font-size:11px; font-weight:700; border-radius:10px; padding:1px 5px; border:2px solid #fff; font-variant-numeric:tabular-nums; }
.li-side { position:absolute; background:#fff; border-radius:8px; border:1px solid #e0dfdc; overflow:hidden; }
.li-feed { position:absolute; top:0; display:flex; flex-direction:column; gap:8px; will-change:transform; }
.li-post { background:#fff; border-radius:8px; border:1px solid #e0dfdc; box-shadow:0 0 0 1px rgba(0,0,0,.02); flex:none; }
.li-hd { display:flex; gap:8px; padding:12px 16px 0; align-items:flex-start; }
.li-av { flex:none; width:48px; height:48px; border-radius:50%; display:grid; place-items:center; font-size:24px; color:#fff; font-weight:700; }
.li-av.sq { border-radius:4px; }
.li-who { flex:1; min-width:0; line-height:1.3; }
.li-who b { font-size:14px; font-weight:600; }
.li-who b span { color:#666; font-weight:400; }
.li-who div { font-size:12px; color:#666; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.li-follow { flex:none; color:#0a66c2; font-weight:600; font-size:14px; padding:4px 8px; }
.li-body { padding:8px 16px 4px; font-size:14px; line-height:20px; white-space:pre-line; position:relative; overflow:hidden; }
.li-more { position:absolute; right:16px; bottom:4px; background:linear-gradient(90deg, transparent, #fff 24px); padding-left:30px; color:#666; }
.li-cta { margin:6px 16px 4px; display:flex; justify-content:space-between; align-items:center; background:#eef3f8; border-radius:4px; padding:8px 12px; font-size:13px; font-weight:600; }
.li-cta span { border:1px solid #0a66c2; color:#0a66c2; border-radius:16px; padding:3px 14px; }
.li-soc { display:flex; align-items:center; gap:4px; margin:4px 16px 0; padding:6px 0 8px; border-bottom:1px solid #e8e6e1; font-size:12px; color:#666; font-variant-numeric:tabular-nums; position:relative; }
.li-rx { display:flex; } .li-rx i { font-style:normal; width:18px; height:18px; border-radius:50%; display:grid; place-items:center; font-size:10px; margin-left:-4px; border:1.5px solid #fff; font-family:${EMOJI}; }
.li-rx i:first-child { margin-left:0; }
.li-soc .r { margin-left:auto; }
.li-act { display:flex; justify-content:space-around; padding:2px 8px 4px; }
.li-act div { display:flex; align-items:center; gap:6px; padding:10px 8px; color:#5e5e5e; font-weight:600; font-size:14px; border-radius:4px; cursor:pointer; }
.li-act div:hover { background:#f3f2ef; }
.li-act div.liked { color:#0a66c2; }
.li-act svg { width:20px; height:20px; }
.li-float { position:absolute; font-size:16px; pointer-events:none; font-family:${EMOJI}; }
.li-new { position:absolute; z-index:3; background:#0a66c2; color:#fff; font-size:14px; font-weight:600; border-radius:16px; padding:6px 16px; box-shadow:0 4px 12px rgba(10,102,194,.4); display:flex; gap:6px; align-items:center; }
.li.compact .li-hd { padding-top:8px; } .li.compact .li-av { width:36px; height:36px; font-size:18px; } .li.compact .li-who div:nth-child(3) { display:none; }
`;

const svg = (d) => `<svg viewBox="0 0 24 24" fill="currentColor">${d}</svg>`;
const I = {
  search: svg('<path d="M14.6 13.2a6.5 6.5 0 1 0-1.4 1.4l5.1 5.1 1.4-1.4zM9.5 14a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/>'),
  home: svg('<path d="M23 9v2h-2v7a3 3 0 0 1-3 3h-4v-6h-4v6H6a3 3 0 0 1-3-3v-7H1V9l11-7z"/>'),
  net: svg('<path d="M12 16v6H3v-6a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3zm5.5-3A3.5 3.5 0 1 0 14 9.5a3.5 3.5 0 0 0 3.5 3.5zm1 2h-2a2.5 2.5 0 0 0-2.5 2.5V22h7v-4.5a2.5 2.5 0 0 0-2.5-2.5zM7.5 2A4.5 4.5 0 1 0 12 6.5 4.5 4.5 0 0 0 7.5 2z"/>'),
  jobs: svg('<path d="M17 6V5a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3v1H2v4a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V6zM9 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9zm10 9a4 4 0 0 0 3-1.38V17a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-4.38A4 4 0 0 0 5 14z"/>'),
  msg: svg('<path d="M16 4H8a7 7 0 0 0 0 14h4v4l8.16-5.39A6.78 6.78 0 0 0 23 11a7 7 0 0 0-7-7zm-8 8.25A1.25 1.25 0 1 1 9.25 11 1.25 1.25 0 0 1 8 12.25zm4 0A1.25 1.25 0 1 1 13.25 11 1.25 1.25 0 0 1 12 12.25zm4 0A1.25 1.25 0 1 1 17.25 11 1.25 1.25 0 0 1 16 12.25z"/>'),
  bell: svg('<path d="M22 19h-8.28a2 2 0 1 1-3.44 0H2v-1a4.52 4.52 0 0 1 1.17-2.83l1-1.17h15.7l1 1.17A4.42 4.42 0 0 1 22 18zM18.21 7.44A6.27 6.27 0 0 0 12 2a6.27 6.27 0 0 0-6.21 5.44L5 13h14z"/>'),
  like: svg('<path d="M19.46 11l-3.91-3.91a7 7 0 0 1-1.69-2.74l-.49-1.47A2.76 2.76 0 0 0 10.76 1 2.75 2.75 0 0 0 8 3.74v1.12a9.19 9.19 0 0 0 .46 2.85L8.89 9H4.12A2.12 2.12 0 0 0 2 11.12a2.16 2.16 0 0 0 .92 1.76A2.11 2.11 0 0 0 2 14.62a2.14 2.14 0 0 0 1.28 2 2 2 0 0 0-.28 1 2.12 2.12 0 0 0 2 2.12v.14A2.12 2.12 0 0 0 7.12 22h7.49a8.08 8.08 0 0 0 3.58-.84l.31-.16H21V11z"/>'),
  comment: svg('<path d="M7 9h10v1H7zm0 4h7v-1H7zm16-2a6.78 6.78 0 0 1-2.84 5.61L12 22v-4H8A7 7 0 0 1 8 4h8a7 7 0 0 1 7 7zm-2 0a5 5 0 0 0-5-5H8a5 5 0 0 0 0 10h6v2.28L19 15a4.79 4.79 0 0 0 2-4z"/>'),
  repost: svg('<path d="M13.96 5H6c-.55 0-1 .45-1 1v10H3V6c0-1.66 1.34-3 3-3h7.96L12 0h2.37L17 4l-2.63 4H12zM15 23H12.63L10 19l2.63-4H15l-1.96 3H18c.55 0 1-.45 1-1V7h2v10c0 1.66-1.34 3-3 3h-4.96z"/>'),
  send: svg('<path d="M21 3L0 10l7.66 4.26L16 8l-6.26 8.34L14 24z"/>'),
};

export default function linkedin(k, ctx) {
  k.el('style', { text: CSS });
  const root = k.el('div', { class: 'li' });
  const emojiOk = k.canRender('😎', 'emoji');
  const avatar = (p, sq) => `<div class="li-av${sq ? ' sq' : ''}" style="background:${p.bg};${emojiOk ? `font-family:${EMOJI}` : ''}">${emojiOk ? p.av : p.name[0]}</div>`;

  // decorative side cards, frosted over by the panels
  const sideL = k.html(`<div class="li-side" style="width:230px;height:260px"><div style="height:58px;background:linear-gradient(120deg,#a5d8ff,#d0bfff)"></div><div style="width:68px;height:68px;border-radius:50%;margin:-34px auto 8px;border:2px solid #fff;background:${PEOPLE.you.bg}"></div><div style="height:12px;width:60%;margin:10px auto;background:#ddd;border-radius:6px"></div><div style="height:10px;width:80%;margin:8px auto;background:#eee;border-radius:5px"></div></div>`, root);
  const sideR = k.html(`<div class="li-side" style="width:300px;height:340px;padding:14px"><div style="height:12px;width:50%;background:#ccc;border-radius:6px;margin-bottom:18px"></div>${[0, 1, 2].map((i) => `<div style="display:flex;gap:10px;margin-bottom:18px"><div style="width:48px;height:48px;border-radius:50%;background:${Object.values(PEOPLE)[i].bg}"></div><div style="flex:1"><div style="height:10px;width:70%;background:#ddd;border-radius:5px;margin:6px 0"></div><div style="height:22px;width:84px;border:1.5px solid #666;border-radius:12px;margin-top:8px"></div></div></div>`).join('')}</div>`, root);

  const nav = k.el('div', { class: 'li-nav' }, root);
  const navIn = k.html(`<div class="li-navin"><div class="li-logo">Gr</div><div class="li-search">${I.search}<span></span></div>
    <div class="li-ico on">${I.home}<span>Home</span></div><div class="li-ico">${I.net}<span>Network</span></div><div class="li-ico">${I.jobs}<span>Jobs</span></div>
    <div class="li-ico">${I.msg}<span>Messaging</span></div><div class="li-ico">${I.bell}<span>Notifications</span><b class="li-badge">9</b></div></div>`, nav);
  const searchText = navIn.querySelector('.li-search span');
  const badge = navIn.querySelector('.li-badge');
  const feed = k.el('div', { class: 'li-feed' }, root);

  let notif = 9;
  let posts = []; // { el, likes, comments, reposts, countEl, comEl, liked, rate }
  let cur = -1;
  let gap = null;
  let lines = 4;
  let rot = 0;
  let deck = [];

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const q = () => ctx.question;
  const rec = () => q()?.recommended[0];
  const other = () => q()?.options.find((o) => !o.recommended)?.label;
  const T = (s, n = 70) => k.clip(s, n);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const mins = () => { const s = Math.max(1, Math.round(ctx.cardTime)); return s < 90 ? plural(s, 'second') : `${Math.round(s / 60)} minutes`; };
  const docT = () => ctx.doc.title || 'The Plan';
  const tally = (n, w) => `${fmt(n)} ${w}${Math.round(n) === 1 ? '' : 's'}`;

  // The posts. Each returns [who, text, { likes, cta, rx }] or null if it doesn't apply right now.
  const POSTS = {
    grilled: () => q() && ['chad', `I asked an AI to grill me about “${T(q().title, 90)}”\n\nHere’s what it taught me about B2B sales. 🧵\n\nAgree?`, { likes: 1204 }],
    unpopular: () => rec() && other() && ['brenda', `Unpopular opinion: “${T(other(), 50)}” is a leadership smell.\n\nThe best founders I know pick “${T(rec(), 50)}”.\n\nEvery. Single. Time.\n\n♻️ Repost if you agree.`, { likes: 3891 }],
    fourAm: () => q() && ['kyle', `Woke up at 4am.\nCold plunge.\nAnswered question ${q().n} of ${q().total}.\n\nWhat did YOU do before breakfast? 💪`, { likes: 712 }],
    child: () => q() && ['priya', `My 4-year-old asked me “${T(q().title, 70)}”\n\nI cried.\n\nThen I closed a $2M deal. Here’s what it taught me about ${(q().tag || 'leadership').toLowerCase()} 👇`, { likes: 5402 }],
    agent: () => q() && ['agent', `Excited to share that I’ve asked ${plural(ctx.answers.length + 1, 'question')} today! 🎉\n\nOne developer has been looking at question ${q().n} for ${mins()}.\n\nI’m not mad. I’m just thinking. #patience #grill`, { likes: 88 }],
    hiring: () => (rec() || q()?.tag) && ['rob', `🚨 WE’RE HIRING 🚨\n\nSenior ${T(rec() || q().tag, 40)} Engineer\n• 12+ years of experience in ${T(docT(), 40)} (launched last week)\n• Must thrive in ambiguity\n\nComment “INTERESTED” 👇`, { likes: 41 }],
    decided: () => ctx.decisions.length && ['chad', `We just decided: “${T(k.pick(ctx.decisions).text, 80)}”\n\nOld me would have booked six meetings for this.\n\nNew me? One grill. 🔥`, { likes: 2210 }],
    ad: () => q()?.options.length >= 2 && ['ad', `Still torn between “${T(q().options[0].label, 34)}” and “${T(q().options[1].label, 34)}”? 😩\n\nLet Deciding™ Enterprise pick for you. Trusted by 9 out of 10 indecisive teams.`, { likes: 12, cta: 'Book a demo' }],
    multi: () => q()?.multi && ['brenda', `Why choose one?\n\nThe top 1% pick ${q().options.length} options.\n\nThat’s why this question is multi-select. Think about it. 🔥`, { likes: 960 }],
    none: () => q() && !q().options.length && ['chad', 'This question has no options.\n\nNeither did I, in 2009.\n\nToday I run four companies. Think about it.', { likes: 4410 }],
    waiting: () => !q() && ctx.front !== 'done' && ['agent', 'Lessons from thinking really hard about your plan 🧵\n\n1. Read the brief.\n2. Read it again.\n3. Write the perfect question.\n\nAgree?', { likes: 77 }],
    waiting2: () => !q() && ctx.front !== 'done' && ['kyle', 'While the agent thinks, I meditate.\nWhile I meditate, I hustle.\n\nThat’s the difference between us. 💯', { likes: 333 }],
    done: () => ctx.front === 'done' && ['you', `I’m happy to share that I’ve made ${plural(ctx.decisions.length || ctx.answers.length, 'decision')} about ${T(docT(), 50)}! 🎉\n\nThank you to my agent, my team and the ★ for believing in me.\n\n#grateful #shipped`, { likes: 9001, rx: '🎉' }],
    done2: () => ctx.front === 'done' && ['brenda', 'Congratulations on the new decisions! 👏\n\n(I did not read the post.)', { likes: 18 }],
  };

  function makeDeck() {
    const keys = ctx.front === 'done' ? ['done', 'done2'] : !q() ? ['waiting', 'waiting2', 'decided'] : ['grilled', ...k.shuffle(['unpopular', 'fourAm', 'child', 'agent', 'hiring', 'decided', 'ad', 'multi', 'none'])];
    return keys.filter((key) => POSTS[key]());
  }

  function reactionIcons(rx) {
    const set = rx ? [rx, '❤️', '👏'] : ['👍', '❤️', '👏'];
    const bg = ['#378fe9', '#df704d', '#6dae4f'];
    return `<div class="li-rx">${set.map((e, i) => `<i style="background:${bg[i]}">${e}</i>`).join('')}</div>`;
  }

  function addPost([who, text, o = {}]) {
    const p = { ...PEOPLE[who] };
    if (who === 'you') p.head = `Decision Maker at ${T(docT(), 40)}`;
    const likes = o.likes * k.rand(0.8, 1.2);
    const el = k.html(`<div class="li-post"><div class="li-hd">${avatar(p, who === 'ad')}<div class="li-who"><b>${esc(p.name)}${p.deg ? ` <span>· ${p.deg}</span>` : ''}</b><div>${esc(p.head)}</div><div>${who === 'ad' ? 'Promoted' : `${k.int(1, 59)}m · Edited`} · 🌐</div></div>${who === 'you' ? '' : '<div class="li-follow">+ Follow</div>'}</div>
      <div class="li-body">${esc(text)}</div>${o.cta ? `<div class="li-cta">Deciding™ Enterprise<span>${o.cta}</span></div>` : ''}
      <div class="li-soc">${reactionIcons(o.rx)}<span class="n">${fmt(likes)}</span><span class="r"><span class="c">${tally(likes * 0.07, 'comment')}</span> · ${tally(likes * 0.012, 'repost')}</span></div>
      <div class="li-act"><div class="like">${I.like}Like</div><div>${I.comment}Comment</div><div>${I.repost}Repost</div><div>${I.send}Send</div></div></div>`, feed);
    const body = el.querySelector('.li-body');
    const post = { el, body, likes, comments: likes * 0.07, countEl: el.querySelector('.n'), comEl: el.querySelector('.c'), liked: false, rate: o.likes > 1000 ? 30 : o.likes > 100 ? 8 : 2, social: el.querySelector('.li-soc') };
    const likeBtn = el.querySelector('.like');
    k.on(likeBtn, 'pointerdown', (e) => {
      post.liked = !post.liked;
      likeBtn.classList.toggle('liked', post.liked);
      post.likes += post.liked ? 1 : -1;
      if (post.liked) { float(post, '👍'); k.sfx.pop({ pitch: 1.4, gain: 0.5 }); }
      e.preventDefault();
    });
    posts.push(post);
    clampBody(post);
    while (posts.length > 7) posts.shift().el.remove();
    return post;
  }

  function clampBody(p) {
    p.body.style.maxHeight = `${lines * 20 + 12}px`;
    p.el.querySelector('.li-more')?.remove();
    if (p.body.scrollHeight > lines * 20 + 14) k.el('span', { class: 'li-more', text: '…see more' }, p.body).style.top = `${(lines - 1) * 20 + 8}px`;
  }

  function float(p, emoji) {
    if (k.reduced || !p.social.isConnected) return;
    const f = k.el('span', { class: 'li-float', text: emoji }, p.social);
    const x = k.rand(10, 60);
    f.style.left = `${x}px`;
    f.style.top = '0px';
    const a = k.animate(f, [{ transform: 'translate(0,0) scale(.6)', opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: `translate(${k.rand(-20, 20)}px,-70px) scale(1.2)`, opacity: 0 }], { duration: 1400, easing: 'cubic-bezier(.2,.7,.3,1)' });
    a.onfinish = () => f.remove();
  }

  // Line up the current post with the top of the gap under the card.
  function place(animate = true) {
    const p = posts[cur];
    if (!p) return;
    const y = gap ? gap.y + 10 : k.vh - 160;
    const to = y - p.el.offsetTop;
    if (animate && !k.reduced) {
      const from = feed._y ?? to;
      k.animate(feed, [{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }], { duration: 900, easing: 'cubic-bezier(.65,0,.35,1)' });
    }
    feed.style.transform = `translateY(${to}px)`;
    feed._y = to;
  }

  function next(animate = true) {
    if (!deck.length) deck = makeDeck();
    let spec = null;
    while (deck.length && !spec) spec = POSTS[deck.shift()]();
    if (!spec) return;
    addPost(spec);
    cur = posts.length - 1;
    place(animate && cur > 0);
  }

  function fitNav(sp) {
    const st = sp.stage;
    let navW = Math.min(st.width - (sp.notes ? 24 : 130), 760); // leave room for the Notes button when the panel is a drawer
    const left = st.left + (sp.notes ? (st.width - navW) / 2 : 12);
    if (sp.hud) navW = Math.min(navW, sp.hud.left - 10 - left); // and for the score HUD
    Object.assign(navIn.style, { left: `${left}px`, width: `${navW}px` });
    const icons = navIn.querySelectorAll('.li-ico');
    const room = Math.floor((navW - 34 - 160) / 72);
    icons.forEach((e, i) => { e.style.display = i >= icons.length - room || i === icons.length - 1 ? '' : 'none'; });
  }

  function layout() {
    const sp = k.space();
    const st = sp.stage;
    const W = Math.min(560, st.width - 32);
    const x = st.left + (st.width - W) / 2;
    Object.assign(feed.style, { left: `${x}px`, width: `${W}px` });
    fitNav(sp);
    Object.assign(sideL.style, { left: `${Math.max(16, x - 250)}px`, top: '72px' });
    Object.assign(sideR.style, { left: `${x + W + 20}px`, top: '72px' });
    gap = sp.card ? sp.gaps.find((g) => g.where === 'bottom' && g.h >= 90) : { y: Math.max(70, st.top + st.height * 0.3), h: st.height * 0.6 };
    root.classList.toggle('compact', !!gap && gap.h < 200);
    // how many lines of post fit above the fold: the post has ~120px of chrome around its text
    lines = gap ? k.clamp(Math.floor((gap.h - 10 - (gap.h < 200 ? 104 : 124)) / 20), 2, 6) : 4;
    posts.forEach(clampBody);
    place(false);
  }

  let answeredAt = -1e9;
  function fresh() {
    deck = makeDeck();
    searchText.textContent = q() ? k.clip(q().title, 60) : docT();
    const since = performance.now() - answeredAt;
    if (since > 5000) next(); else k.after(5000 - since, () => next()); // let your own post have its moment
  }

  function onAnswer(a) {
    const quoted = a.picks.map((s) => `“${T(s, 40)}”`);
    const pick = quoted.length ? (quoted.length > 1 ? `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1)}` : quoted[0]) : a.custom ? `“${T(a.custom, 60)}”` : 'something';
    const text = a.tookRec
      ? `I’m thrilled to announce that I picked ${pick}. 🎉\n\nGrateful to the ★ for believing in me.\n\n#decisive #blessed`
      : a.hasRec
        ? `Everyone told me to pick the recommended option.\n\nI picked ${pick}.\n\nHere’s what being a disruptor taught me about B2B sales. 🧵`
        : `After ${plural(Math.max(1, Math.round(a.seconds)), 'second')} of deep reflection, I chose ${pick}.\n\nLeadership is lonely. #grill`;
    const p = addPost(['you', text, { likes: a.tookRec ? 240 : 1800, rx: a.tookRec ? '🎉' : '💡' }]);
    p.rate = 60;
    answeredAt = performance.now();
    cur = posts.length - 1;
    place(true);
    k.sfx.chime({ gain: 0.4, pitch: 1.2 });
  }

  layout();
  fresh();

  if (k.reduced) {
    posts.forEach((p) => { p.countEl.textContent = fmt(p.likes); });
  } else {
    k.every(260, () => { // the likes keep coming
      const p = posts[cur];
      if (!p) return;
      if (k.chance(0.55)) {
        p.likes += k.rand(0.2, 1.2) * p.rate * 0.26;
        p.countEl.textContent = fmt(p.likes);
        if (k.chance(0.35)) float(p, k.pick(['👍', '👍', '❤️', '👏', '💡', '🤔']));
      }
      if (k.chance(0.1)) { p.comments += 1; p.comEl.textContent = tally(p.comments, 'comment'); }
    });
    k.every(3200, () => {
      notif += k.int(1, 4);
      badge.textContent = notif > 99 ? '99+' : notif;
      k.animate(badge, [{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    });
    k.every(11000, () => next());
  }

  return {
    question() { layout(); fresh(); },
    answer: onAnswer,
    layout,
    event(name) { if (name === 'stat') fitNav(k.space()); },
    status() { if (!q() && ctx.front === 'waiting') layout(); },
  };
}
