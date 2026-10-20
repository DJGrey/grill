// Achievements. Runs the whole time fun mode is on, watches how you grill, and pops a games-console
// toast with a chime when you earn one. Each fires once per grill.

// Score keys the scenes use (k.score). TOYS are things you did; GAMES are the ones a round of a game adds to.
const GAMES = ['balloons', 'boops', 'bugs', 'eggs', 'fortunes', 'geese', 'moles', 'pigeons', 'pinatas'];
const TOYS = [...GAMES, 'bubbles', 'cats', 'corners', 'sand'];
const at = (key, n) => (e, s) => e.type === 'stat' && (s.stats[key] || 0) >= n;
const FAM = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const H = 74; // toast height
const HOLD = 3400;

const TROPHY = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" fill="currentColor" fill-opacity=".22"/><path d="M7 6H4.5a.5.5 0 0 0-.5.5C4 9 5.5 11 8 11.2M17 6h2.5a.5.5 0 0 1 .5.5C20 9 18.5 11 16 11.2M12 14v3.5M8.5 20.5h7M9.5 17.5h5l.5 3h-6l.5-3Z"/></svg>`;

// id, points, title, description, test(ev, s). `covers` lists smaller ones it makes redundant.
// ev: { type: 'answer'|'stat'|'note'|'question'|'status'|'tick'|'keys'|'game', … }. s: helpers and counters.
const LIST = [
  ['first', 10, 'Hello, decision', 'Answered your first question.', (e, s) => e.type === 'answer' && !e.a.revision && e.answered === 1],
  ['rec3', 10, 'Hat trick', 'Took the recommendation 3 times in a row.', (e, s) => e.type === 'answer' && s.stats.streak >= 3],
  ['rec5', 25, "Teacher's pet", 'Took the recommendation 5 times in a row.', (e, s) => e.type === 'answer' && s.stats.streak >= 5, ['rec3']],
  ['rec10', 50, 'Is the agent driving?', 'Took the recommendation 10 times in a row.', (e, s) => e.type === 'answer' && s.stats.streak >= 10, ['rec3', 'rec5'], 'rare'],
  ['rebel', 10, 'Rebel without a cause', 'Ignored the ★ for the first time. It noticed.', (e) => e.type === 'answer' && e.a.hasRec && !e.a.tookRec],
  ['rebel3', 25, 'Contrarian', 'Went against the recommendation 3 times. On principle.', (e, s) => e.type === 'answer' && s.n.rebels >= 3, ['rebel']],
  ['fast', 10, 'Speedrunner', 'Answered in under 3 seconds. Did you read it? Don\'t answer that.', (e) => e.type === 'answer' && !e.a.revision && e.a.seconds < 3],
  ['fast3', 25, 'Any% decision', 'Three answers in a row, under 10 seconds each.', (e, s) => e.type === 'answer' && s.n.quick >= 3],
  ['burst', 25, 'Caffeinated', 'Answered 5 questions in 2 minutes.', (e, s) => e.type === 'answer' && s.n.times.filter((t) => Date.now() - t < 120e3).length >= 5],
  ['slow', 10, 'Deep thinker', 'Spent over 3 minutes on one question.', (e) => e.type === 'answer' && e.a.seconds >= 180],
  ['stare', 25, 'Staring contest', '5 minutes on one card without typing. The agent blinked first.', (e, s) => e.type === 'tick' && s.ctx.front === 'question' && s.ctx.cardTime > 300 && s.ctx.idle > 300],
  ['wait', 10, 'Patience of a saint', 'Watched the agent think for a whole minute.', (e, s) => e.type === 'tick' && s.ctx.front === 'waiting' && s.ctx.agent === 'working' && s.ctx.cardTime > 60],
  ['revise', 10, 'Second thoughts', 'Changed an answer. Growth.', (e) => e.type === 'answer' && e.a.revision],
  ['revise3', 25, 'Flip-flop', 'Changed 3 answers. Commitment issues?', (e, s) => e.type === 'answer' && s.stats.revisions >= 3, ['revise']],
  ['dejavu', 5, 'Déjà vu', 'Went back to a question you already answered.', (e) => e.type === 'question' && e.back],
  ['note', 10, 'Dear diary', 'Sent the agent a note.', (e) => e.type === 'note'],
  ['note5', 25, 'Backseat driver', 'Sent the agent 5 notes. It\'s taking notes on your notes.', (e, s) => e.type === 'note' && s.ctx.notes >= 5, ['note']],
  ['custom', 10, 'Write-in candidate', 'Ignored every option and wrote your own.', (e) => e.type === 'answer' && !!e.a.custom && !e.a.picks.length],
  ['essay', 25, 'War and peace', 'Over 500 keystrokes on one card. The agent is going to need a minute.', (e, s) => e.type === 'keys' && s.keys >= 500],
  ['both', 10, 'Why not both?', 'Picked more than one option.', (e) => e.type === 'answer' && e.a.picks.length >= 2],
  ['all', 25, 'All of the above', 'Picked every single option. Decisive, technically.', (e) => e.type === 'answer' && e.opts >= 3 && e.a.picks.length >= e.opts, ['both']],
  ['hobson', 5, "Hobson's choice", 'Took the only option on offer. Bold.', (e) => e.type === 'answer' && e.opts === 1 && e.a.picks.length === 1],
  ['night', 10, 'Night owl', 'Answered a question after midnight. Go to bed.', (e) => e.type === 'answer' && new Date().getHours() < 5],
  ['early', 10, 'Early bird', 'Answered a question before 7am. Who hurt you?', (e) => e.type === 'answer' && [5, 6].includes(new Date().getHours())],
  ['weekend', 10, 'Weekend warrior', 'Grilling on a weekend. Respect, and also why.', (e) => e.type === 'answer' && [0, 6].includes(new Date().getDay())],
  ['half', 10, "Livin' on a prayer", 'Halfway through the grill.', (e, s) => e.type === 'answer' && s.ctx.progress.total >= 4 && e.answered / s.ctx.progress.total >= 0.5 && e.answered < s.ctx.progress.total],
  ['ten', 10, 'Double digits', 'Answered 10 questions.', (e) => e.type === 'answer' && e.answered >= 10],
  ['marathon', 25, 'Marathon', 'Half an hour in the grill. Hydrate.', (e, s) => e.type === 'tick' && Date.now() - s.since > 30 * 60e3],
  ['done', 50, 'Well done', 'Survived the grill. Cooked: well done.', (e, s) => s.ctx.front === 'done' || s.ctx.agent === 'done'],
  ['yes', 100, 'Suspiciously agreeable', 'Finished the grill taking every single recommendation.', (e, s) => (s.ctx.front === 'done' || s.ctx.agent === 'done') && s.ctx.recRate === 1 && s.ctx.answers.filter((a) => a.hasRec).length >= 3, null, 'rare'],
  ['chaos', 100, 'Agent of chaos', 'Finished the grill without taking one recommendation.', (e, s) => (s.ctx.front === 'done' || s.ctx.agent === 'done') && s.ctx.recRate === 0 && s.ctx.answers.filter((a) => a.hasRec).length >= 3, null, 'rare'],
  ['games3', 10, 'Easily distracted', 'Played 3 fun-mode games. You came here to make decisions.', (e, s) => e.type === 'game' && s.stats.games >= 3],
  ['pigeons', 25, 'Clay-more', 'Shot 5 clay pigeons. The others have been warned.', at('pigeons', 5)],
  ['pinata', 10, 'Sugar rush', 'Destroyed a piñata. It had it coming.', at('pinatas', 1)],
  ['fortune', 10, 'Fortune favours the hungry', 'Cracked 3 fortune cookies.', at('fortunes', 3)],
  ['unicorns', 10, 'Unicorn whisperer', 'Five unicorn sightings. Statistically impossible.', at('unicorns', 5)],
  ['bubbles100', 10, 'Bubble trouble', 'Popped 100 bubbles. Somewhere, a parcel arrived unprotected.', at('bubbles', 100)],
  ['bubbles1000', 50, 'Fragile: this way up', 'Popped 1,000 bubbles. Nothing you own will ever arrive broken again.', at('bubbles', 1000), ['bubbles100'], 'rare'],
  ['stubborn', 25, 'Unstoppable force', 'Popped the bubble that refused to pop. It respects you now.', at('stubborn', 1)],
  ['corner', 50, 'It touched the corner', 'Saw the logo hit the corner exactly. Tell your grandchildren.', at('corners', 1), null, 'rare'],
  ['swiped', 10, 'You were warned', 'Got swiped by a cat. The ears were back the whole time.', at('swiped', 1)],
  ['cats', 10, 'Cat person', 'Petted 3 cats. Productivity down, serotonin up.', at('cats', 3)],
  ['goose', 10, 'Peace was never an option', 'Shooed the goose. It will remember this.', at('geese', 1)],
  ['moles', 10, 'Whack-a-decision', 'Bonked 5 moles. Settled decisions stay settled.', at('moles', 5)],
  ['bug', 10, 'Closed as fixed', 'Squashed a bug. Nobody wrote a regression test.', at('bugs', 1)],
  ['bugs', 25, 'Zero known issues', 'Squashed every bug, sequel included. QA would like a word.', at('infestations', 1), ['bug']],
  ['egg', 10, 'Snack break', 'Ate the egg. The snake is full. Back to work.', at('eggs', 1)],
  ['sand', 25, 'Zen master', 'Raked 100 metres of sand. The question is still there. You are at peace with it.', at('sand', 100)],
  ['boops', 10, 'Boop de boop', 'Booped the googly eyes 10 times. They saw it coming.', at('boops', 10)],
  ['balloons', 10, 'Scope police', 'Popped 10 scope-creep balloons. v1 might actually ship.', at('balloons', 10)],
  ['hyper', 25, 'Hyperfixation', 'Hit 25 in one fun-mode game. The questions miss you.', (e) => e.type === 'stat' && GAMES.includes(e.key) && e.value >= 25],
  ['gold', 50, 'Procrastination: Gold', '200 things popped, bonked, petted or raked. The grill can wait.', (e, s) => e.type === 'stat' && TOYS.reduce((n, key) => n + (+s.stats[key] || 0), 0) >= 200, null, 'rare'],
  ['meta', 5, 'Achievement unlocked', 'Unlocked 10 achievements. This is one of them.', at('achievements', 10)],
].map(([id, pts, title, desc, test, covers, tier]) => ({ id, pts, title, desc, test, covers: covers || [], tier }));

export default function achievements(k, ctx) {
  const slug = () => ctx.doc.slug || '_';
  // n is saved across visits. since (for the marathon) is this page load only, so fun mode going off and on keeps it
  const loadN = (sl) => { const { since: _, ...saved } = k.load(`n:${sl}`, {}); return { rebels: 0, quick: 0, times: [], ...saved }; };
  let got = new Set(k.load(`got:${slug()}`, []));
  let n = loadN(slug());
  let since = performance.timeOrigin;
  let mySlug = slug();
  let keys = 0;
  let frontId = ctx.question?.id ?? ctx.front;
  const queue = [];
  let showing = false;

  const sync = () => {
    if (slug() === mySlug) return;
    mySlug = slug();
    got = new Set(k.load(`got:${mySlug}`, []));
    n = loadN(mySlug);
    since = Date.now();
  };
  const saveN = () => k.save(`n:${mySlug}`, n);

  function check(ev) {
    sync();
    const s = { ctx, stats: ctx.stats, n, keys, since };
    const won = LIST.filter((a) => !got.has(a.id) && a.test(ev, s));
    if (!won.length) return;
    const covered = new Set(won.flatMap((a) => a.covers));
    for (const a of won) { got.add(a.id); a.covers.forEach((c) => got.add(c)); }
    k.save(`got:${mySlug}`, [...got]);
    for (const a of won) if (!covered.has(a.id)) unlock(a);
  }

  function unlock(a) {
    queue.push(a);
    if (!showing) next();
  }

  // Where to put it: low in the space under the card, else above it, else the Notes column, else the top.
  function place(w) {
    const sp = k.space();
    const below = sp.gaps.find((g) => g.where === 'bottom' && g.h >= H + 28 && g.w >= 300);
    const above = sp.gaps.find((g) => g.where === 'top' && g.h >= H + 20 && g.w >= 300);
    const cx = sp.stage.left + sp.stage.width / 2;
    if (below) return { x: cx, y: below.y + (below.h - H) * 0.68, w: Math.min(w, below.w - 32) };
    if (above) return { x: cx, y: above.y + (above.h - H) / 2, w: Math.min(w, above.w - 32) };
    if (sp.notes && sp.notes.width >= 320 && sp.notes.left > sp.vw / 2) return { x: sp.notes.left + sp.notes.width / 2, y: sp.vh - H - 28, w: Math.min(w, sp.notes.width - 32) };
    return { x: cx, y: 14, w: Math.min(w, sp.stage.width - 24) };
  }

  async function next() {
    const a = queue.shift();
    if (!a) { showing = false; return; }
    showing = true;
    k.score('achievements', 1, { icon: '🏆', label: 'Achievements', says: 'unlocked {n} achievement{s}' });
    const rare = a.tier === 'rare';
    const pos = place(Math.min(480, k.vw - 32));
    const accent = rare ? ['#fff3b0', '#f2b705', '#a86b00'] : ['#7cf0a8', '#1fb35c', '#0b6b33'];
    const box = k.el('div', { style: { position: 'absolute', left: `${pos.x - pos.w / 2}px`, top: `${pos.y}px`, width: `${pos.w}px`, height: `${H}px`, font: `500 13px/1.25 ${FAM}`, color: '#fff', filter: 'drop-shadow(0 14px 28px rgba(0,0,0,.35)) drop-shadow(0 2px 4px rgba(0,0,0,.25))' } });
    const pill = k.el('div', { style: { position: 'absolute', inset: 0, borderRadius: `${H / 2}px`, overflow: 'hidden', background: 'linear-gradient(180deg,#2b2b2e 0%,#151517 55%,#0d0d0e 100%)', boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.07)` } }, box);
    const shine = k.el('div', { style: { position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(100deg, transparent, rgba(255,255,255,.13), transparent)', transform: 'translateX(-120%) skewX(-18deg)' } }, pill);
    const text = k.el('div', { style: { position: 'absolute', left: `${H + 4}px`, right: '74px', top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', minWidth: 0 } }, pill);
    k.el('div', { text: rare ? 'Rare achievement unlocked' : 'Achievement unlocked', style: { font: `700 10px/1.2 ${FAM}`, letterSpacing: '.12em', textTransform: 'uppercase', color: accent[0], opacity: 0.9 } }, text);
    k.el('div', { text: a.title, style: { font: `700 16px/1.2 ${FAM}`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, text);
    k.el('div', { text: a.desc, style: { fontSize: '12px', lineHeight: 1.22, color: 'rgba(255,255,255,.66)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textWrap: 'pretty' } }, text);
    const pts = k.el('div', { style: { position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '5px', font: `700 15px/1 ${FAM}`, fontVariantNumeric: 'tabular-nums' } }, pill);
    k.el('span', { text: String(a.pts) }, pts);
    k.el('span', { text: 'G', style: { display: 'grid', placeItems: 'center', width: '17px', height: '17px', borderRadius: '50%', border: `1.6px solid ${accent[0]}`, color: accent[0], font: `800 10px/1 ${FAM}` } }, pts);
    const ring = k.el('div', { style: { position: 'absolute', left: '7px', top: '7px', width: `${H - 14}px`, height: `${H - 14}px`, borderRadius: '50%', border: `2px solid ${accent[0]}`, opacity: 0 } }, box);
    const badge = k.el('div', { html: TROPHY, style: { position: 'absolute', left: '7px', top: '7px', width: `${H - 14}px`, height: `${H - 14}px`, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', background: `radial-gradient(circle at 35% 28%, ${accent[0]}, ${accent[1]} 55%, ${accent[2]})`, boxShadow: `inset 0 -3px 6px rgba(0,0,0,.25), inset 0 2px 3px rgba(255,255,255,.45), 0 0 0 3px rgba(13,13,14,1), 0 0 18px ${accent[1]}` } }, box);
    const icon = badge.firstElementChild;
    icon.style.filter = 'drop-shadow(0 1px 1px rgba(0,0,0,.35))';

    const anims = []; // they hold their end states (fill), so they're cancelled with the toast, not left to pile up
    const anim = (...args) => anims.push(k.animate(...args));
    const closed = `inset(0 calc(100% - ${H}px) 0 0 round ${H / 2}px)`;
    const open = `inset(0 0 0 0 round ${H / 2}px)`;
    const E = 'cubic-bezier(.2,.9,.25,1)';
    anim(badge, [{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1.18) rotate(6deg)', offset: 0.6 }, { transform: 'none' }], { duration: 480, easing: 'ease-out', fill: 'both' });
    anim(icon, [{ transform: 'rotate(0)' }, { transform: 'rotate(-14deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'none' }], { duration: 650, delay: 420, fill: 'both' });
    anim(ring, [{ transform: 'scale(.7)', opacity: 0.9 }, { transform: 'scale(1.9)', opacity: 0 }], { duration: 750, delay: 160, easing: 'ease-out', fill: 'both' });
    anim(pill, [{ clipPath: closed }, { clipPath: open }], { duration: 520, delay: 260, easing: E, fill: 'both' });
    anim(text, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 480, easing: E, fill: 'both' });
    anim(pts, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 600, fill: 'both' });
    anim(shine, [{ transform: 'translateX(-120%) skewX(-18deg)' }, { transform: 'translateX(320%) skewX(-18deg)' }], { duration: 1000, delay: 800, easing: 'ease-in-out', fill: 'both' });
    chime(rare);
    if (rare) k.after(450, () => k.burst(pos.x - pos.w / 2 + H / 2, pos.y + H / 2, { shape: 'star', n: 26, colors: ['#ffe17a', '#fff6c9', '#f2b705'], speed: 380, gravity: 500, size: 7, life: 1.3 }));

    await k.wait(queue.length ? HOLD - 1000 : HOLD);
    anim(text, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    anim(pts, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    anim(pill, [{ clipPath: open }, { clipPath: closed }], { duration: 340, delay: 80, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    anim(badge, [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.3 }, { transform: 'scale(0)', opacity: 0 }], { duration: 300, delay: 380, easing: 'ease-in', fill: 'forwards' });
    await k.wait(720);
    for (const x of anims) x.cancel();
    box.remove();
    await k.wait(250);
    next();
  }

  function chime(rare) {
    if (!k.sfx.on) return;
    k.sfx.pop({ pitch: 0.7, gain: 0.5 });
    const notes = rare ? [784, 988, 1175, 1568] : [880, 1319];
    notes.forEach((f, i) => {
      k.sfx.tone({ type: 'sine', freq: f, dur: 0.9, gain: 0.12, delay: 0.12 + i * 0.09 });
      k.sfx.tone({ type: 'triangle', freq: f * 2, dur: 0.35, gain: 0.025, delay: 0.12 + i * 0.09 });
    });
  }

  k.every(5000, () => check({ type: 'tick' }));
  if (ctx.forced) k.after(500, () => unlock({ id: 'test', pts: 5, title: 'Achievement hunter', desc: 'Opened the achievements on purpose. Bold strategy.' }));

  return {
    answer(a) {
      sync();
      n.times = [...n.times.filter((t) => Date.now() - t < 300e3), Date.now()];
      if (!a.revision) n.quick = a.seconds < 10 ? n.quick + 1 : 0;
      if (a.hasRec && !a.tookRec && a.picks.length) n.rebels++;
      saveN();
      check({ type: 'answer', a, opts: ctx.question?.id === a.id ? ctx.question.options.length : 0, answered: ctx.answers.filter((x) => x.id !== a.id).length + 1 });
    },
    question() {
      const id = ctx.question?.id ?? ctx.front;
      const back = id !== frontId && !!ctx.question?.revising && ctx.lastAnswer?.id !== id;
      if (id !== frontId) keys = 0;
      frontId = id;
      check({ type: 'question', back });
    },
    status() { check({ type: 'status' }); },
    keystroke() {
      keys++;
      if (keys === 500) check({ type: 'keys' });
    },
    event(name, data) {
      if (name === 'note') check({ type: 'note' });
      else if (name === 'stat') check({ type: 'stat', ...data });
      else if (name === 'game' && data.phase === 'start') check({ type: 'game', ...data });
    },
  };
}
