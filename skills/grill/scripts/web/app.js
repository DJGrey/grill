import { parseGrill } from './parse.mjs';
import { markdown, inline, esc, hydrateDiagrams } from './md.mjs';
import { bindChartHover } from './chart.mjs';

const $ = (s, r = document) => r.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = (ms) => (reduced ? 1 : ms);
const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
const EASE_POP = 'cubic-bezier(.3,1.25,.6,1)';
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const cid = () => Math.random().toString(36).slice(2, 10);
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

const ICON = {
  star: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.6l2.47 5.2 5.7.68-4.2 3.92 1.1 5.64L10 14.24l-5.07 2.8 1.1-5.64-4.2-3.92 5.7-.68z"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle class="check-bg" cx="8" cy="8" r="7.5"/><path d="M4.8 8.2l2.1 2.1 4.3-4.5" fill="none" stroke="var(--card)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  send: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3.5M3.5 8 8 3.5 12.5 8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  logo: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor"/><path d="M9 12h14M9 16h14M9 20h14" stroke="var(--bg)" stroke-width="2.6" stroke-linecap="round"/></svg>',
  tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

// ── state ──────────────────────────────────────────────────────────────────

const S = {
  src: null,
  doc: null,
  events: [],
  delivered: 0,
  listening: false,
  connected: false,
  offline: false, // disconnected for longer than a blip, so the header says so
  optimistic: new Map(), // cid → event not yet echoed by the server. Doubles as the outbox.
  sendError: null, // HTTP status of the last failed send (0 for no response), while sends are failing
  pinned: null, // question the user clicked into from the list
  front: null, // id on the front card ('__waiting' | '__done' | question id)
  frontSig: '',
  drafts: new Map(), // question id → { text, picks: Set<label> }
  firstPaint: true,
};

function derive() {
  const echoed = new Set(S.events.map((e) => e.cid).filter(Boolean));
  for (const k of S.optimistic.keys()) if (echoed.has(k)) S.optimistic.delete(k);
  saveOutbox();
  const events = [...S.events, ...S.optimistic.values()];
  const answers = new Map();
  const notes = [];
  for (const e of events) (e.type === 'answer' ? answers.set(e.id, e) : notes.push(e));
  const qs = (S.doc?.questions || []).filter((q) => q.status !== 'skipped');
  const queue = qs.filter((q) => !answers.has(q.id));
  const done = S.doc?.status === 'done' && !queue.length;
  if (S.pinned && !qs.some((q) => q.id === S.pinned)) S.pinned = null;
  const frontId = S.pinned || queue[0]?.id || (done ? '__done' : '__waiting');
  // The agent's decision log. Lines tagged {#id} belong to a question, the rest came from notes.
  const decisions = S.doc?.decisions || [];
  const decisionFor = new Map(decisions.filter((d) => d.id).map((d) => [d.id, d]));
  const loose = decisions.filter((d) => !d.id || !qs.some((q) => q.id === d.id));
  return { answers, notes, qs, queue, done, frontId, decisions, decisionFor, loose };
}

function draft(q, D) {
  if (!S.drafts.has(q.id)) {
    const prev = D?.answers.get(q.id);
    const picks = new Set(prev ? (prev.choices?.length ? prev.choices : prev.choice ? [prev.choice] : []) : []);
    S.drafts.set(q.id, { text: sessionStorage.getItem(`grill:${q.id}`) ?? prev?.custom ?? '', picks });
  }
  return S.drafts.get(q.id);
}

const picksOf = (a) => (a ? (a.choices?.length ? a.choices : a.choice ? [a.choice] : []) : []);
function answerText(a) {
  const picks = picksOf(a);
  return [picks.join(', '), a.custom].filter(Boolean).join(' · ');
}

// ── render ─────────────────────────────────────────────────────────────────

function render(reason = 'sync') {
  const D = derive();
  renderHead(D);
  renderList(D);
  renderNotes(D);
  renderStage(D, reason);
  S.firstPaint = false;
  if (fun) funSafe(() => fun.render(reason, D));
}

function renderHead(D) {
  const total = D.qs.length;
  const decided = D.qs.filter((q) => D.answers.has(q.id)).length;
  const unsent = S.optimistic.size;
  const status = S.offline ? ['offline', unsent ? `Reconnecting · ${unsent} to send` : 'Reconnecting…']
    : unsent && (S.sendError === 401 || S.sendError === 403) ? ['offline', `Preview signed out · reload to send ${unsent}`]
    : unsent && S.sendError !== null ? ['offline', `Retrying · ${unsent} to send`]
    : D.done ? ['done', 'Complete']
      : S.listening ? ['listening', 'Agent listening']
        : ['thinking', 'Agent working…'];
  const head = $('#head');
  const sig = JSON.stringify([S.doc?.title, S.doc?.slug, S.doc?.summary, S.doc?.intro, status, decided, total]);
  if (head._sig === sig) return;
  const briefOpen = head.querySelector('.brief')?.open;
  head._sig = sig;
  head.innerHTML = `
    <div class="brand">
      <span class="logo">${ICON.logo}Grill</span>
      <span class="agent ${status[0]}"><i></i>${status[1]}</span>
    </div>
    <h1 class="doc-title">${esc(S.doc?.title || 'Grill')}</h1>
    ${S.doc?.slug ? `<div class="doc-slug">${esc(S.doc.slug)}</div>` : ''}
    ${S.doc?.summary ? `<p class="doc-summary">${inline(S.doc.summary)}</p>` : ''}
    ${S.doc?.intro ? `<details class="brief"${briefOpen ? ' open' : ''}><summary>Brief</summary><div class="md">${markdown(S.doc.intro)}</div></details>` : ''}
    <div class="progress"><div class="track"><div class="fill" style="--p:${total ? decided / total : 0}"></div></div><span>${decided}/${total}</span></div>`;
  document.title = `${decided}/${total} · ${S.doc?.title || 'Grill'}`;
  hydrateDiagrams(head);
}

function rowHTML(q, i, D) {
  const a = D.answers.get(q.id);
  const tookRec = picksOf(a).some((p) => q.options.find((o) => o.label === p)?.recommended);
  const mark = a ? ICON.check : `<span>${i + 1}</span>`;
  const d = a && D.decisionFor.get(q.id);
  const sub = a
    ? `<span class="row-answer">${d?.n ? `<span class="row-d">D${d.n}</span>` : ''}${d ? inline(d.text) : esc(answerText(a))}${tookRec ? '<span class="star">★</span>' : ''}</span>`
    : q.tag ? `<span class="row-answer">${esc(q.tag)}</span>` : '';
  return `<span class="row-mark">${mark}</span><span class="row-text"><span class="row-title">${inline(q.title)}</span>${sub}</span>`;
}

function renderList(D) {
  const list = $('#decisions');
  const existing = new Map([...list.children].map((el) => [el.dataset.id, el]));
  const items = D.qs.map((q, i) => {
    const a = D.answers.get(q.id);
    const state = a ? 'decided' : q.id === D.frontId ? 'current' : 'queued';
    const cls = ['row', state];
    if (q.id === D.frontId && a) cls.push('current');
    if (a && a.seq <= S.delivered) cls.push('delivered');
    return { id: q.id, cls: cls.join(' '), html: rowHTML(q, i, D) };
  });
  if (!D.queue.length && !D.done && S.doc) {
    items.push({ id: '__pending', cls: 'row pending', html: `<span class="row-mark"><span>${D.qs.length + 1}</span></span><span class="row-text"><span class="row-title shimmer">${D.qs.length ? 'Next question…' : 'First question…'}</span></span>` });
  }
  items.forEach((it, idx) => {
    let el = existing.get(it.id);
    const isNew = !el;
    if (isNew) {
      el = document.createElement('li');
      el.dataset.id = it.id;
    }
    existing.delete(it.id);
    const keep = ['landing', 'flash'].filter((c) => el.classList.contains(c));
    el.className = [it.cls, ...keep].join(' ');
    if (el._html !== it.html) { el.innerHTML = it.html; el._html = it.html; }
    if (list.children[idx] !== el) list.insertBefore(el, list.children[idx] || null);
    if (isNew && !S.firstPaint) el.animate([{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], { duration: T(260), easing: EASE_OUT });
  });
  for (const el of existing.values()) el.remove();
  renderExtras(D);
}

function renderExtras(D) {
  const box = $('#extras');
  const html = [
    D.loose.length ? `<section class="extra"><h3>Also decided</h3><ul>${D.loose.map((d) => `<li>${d.n ? `<span class="row-d">D${d.n}</span>` : ''}${inline(d.text)}</li>`).join('')}</ul></section>` : '',
    S.doc?.parked.length ? `<section class="extra parked"><h3>Parked</h3><ul>${S.doc.parked.map((p) => `<li>${inline(p)}</li>`).join('')}</ul></section>` : '',
  ].join('');
  if (box._html !== html) { box.innerHTML = html; box._html = html; }
}

function renderFound() {
  const box = $('#found');
  const src = S.doc?.found || '';
  if (box._src === src) return;
  const had = box._src;
  box._src = src;
  box.hidden = !src;
  box.innerHTML = src ? `<h3>From the agent</h3><div class="md">${markdown(src)}</div>` : '';
  hydrateDiagrams(box);
  if (had !== undefined && src && !S.firstPaint) box.animate([{ background: cssVar('--flash') }, { background: 'transparent' }], { duration: T(1200), easing: 'ease-out' });
}

function renderNotes(D) {
  renderFound();
  const ul = $('#notes');
  const notes = [...D.notes].reverse();
  $('#notes-count').textContent = notes.length || '';
  if (!notes.length) { ul.innerHTML = '<li class="notes-empty">Nothing yet. Notes reach the agent with your next answer, or immediately while it’s listening.</li>'; return; }
  ul.querySelector('.notes-empty')?.remove();
  const existing = new Map([...ul.children].map((el) => [el.dataset.key, el]));
  notes.forEach((n, idx) => {
    const key = n.cid || `s${n.seq}`;
    let el = existing.get(key);
    const isNew = !el;
    if (isNew) { el = document.createElement('li'); el.className = 'note'; el.dataset.key = key; }
    existing.delete(key);
    const st = n.seq === Infinity ? (S.offline ? ['queued', 'Sends when reconnected'] : ['sending', 'Sending…']) : n.seq <= S.delivered ? ['delivered', 'Delivered'] : S.listening ? ['sending', 'Delivering…'] : ['queued', 'Queued for agent'];
    const q = n.during && S.doc?.questions.find((x) => x.id === n.during);
    const time = new Date(n.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const html = `<div class="note-text">${esc(n.text)}</div><div class="note-meta ${st[0]}"><i class="dot"></i><span>${st[1]} · ${time}</span>${q ? `<span class="on">· ${esc(q.title)}</span>` : ''}</div>`;
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
    if (ul.children[idx] !== el) ul.insertBefore(el, ul.children[idx] || null);
    if (isNew && !S.firstPaint) el.animate([{ opacity: 0, transform: 'translateY(-8px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: T(300), easing: EASE_OUT });
  });
  for (const el of existing.values()) el.remove();
}

// ── cards ──────────────────────────────────────────────────────────────────

function questionBodyHTML(q, D) {
  const n = D.qs.indexOf(q) + 1;
  const a = D.answers.get(q.id);
  const deps = q.depends.map((id) => D.qs.find((x) => x.id === id)?.title).filter(Boolean);
  const d = draft(q, D);
  return `
    <header class="q-meta">
      <span class="q-num">${n}<span> / ${D.qs.length}</span></span>
      ${q.tag ? `<span class="chip">${esc(q.tag)}</span>` : ''}
      ${a ? `<span class="q-revising">Revising · was <b>${esc(answerText(a))}</b></span>`
        : deps.length ? `<span class="q-dep">Builds on <b>${deps.map(esc).join(', ')}</b></span>` : ''}
    </header>
    <h2 class="q-title">${inline(q.title)}</h2>
    <div class="q-context md">${q.context ? markdown(q.context) : ''}</div>
    ${q.options.length ? `<div class="q-options${q.multi ? ' q-multi' : ''}" role="${q.multi ? 'group' : 'radiogroup'}">
      ${q.options.map((o, i) => `
        <button type="button" class="opt${d.picks.has(o.label) ? ' sel' : ''}${o.recommended ? ' rec' : ''}" data-label="${esc(o.label)}" role="${q.multi ? 'checkbox' : 'radio'}" aria-checked="${d.picks.has(o.label)}">
          <span class="opt-key">${i < 9 ? i + 1 : ''}</span>
          <span class="opt-main"><span class="opt-label">${inline(o.label)}</span>${o.description ? `<span class="opt-desc">${inline(o.description).replace(/\n/g, '<br>')}</span>` : ''}</span>
          ${o.recommended ? `<span class="opt-rec" title="Recommended">${ICON.star}Recommended</span>` : '<span></span>'}
        </button>`).join('')}
    </div>` : ''}
    ${q.optionsNote ? `<div class="q-optnote md">${markdown(q.optionsNote)}</div>` : ''}`;
}

function buildCard(id, D) {
  const el = document.createElement('article');
  el.className = 'card front';
  el.dataset.id = id;
  const q = D.qs.find((x) => x.id === id);
  if (q) {
    const d = draft(q, D);
    el.innerHTML = `<div class="card-inner">
      <div class="q-body">${questionBodyHTML(q, D)}</div>
      <div class="q-answer">
        <textarea rows="1" spellcheck="true"></textarea>
        <button type="button" class="send" aria-label="Submit answer">${ICON.send}</button>
      </div>
      <div class="q-hints"></div>
    </div>`;
    const ta = $('textarea', el);
    ta.value = d.text;
    ta.addEventListener('input', () => {
      d.text = ta.value;
      if (d.text) sessionStorage.setItem(`grill:${q.id}`, d.text); else sessionStorage.removeItem(`grill:${q.id}`);
      autosize(ta);
      updateHints(el, q);
    });
    ta.addEventListener('keydown', (e) => onAnswerKey(e, q, el));
    requestAnimationFrame(() => autosize(ta));
    updateHints(el, q);
  } else if (id === '__done') {
    el.innerHTML = `<div class="card-inner state">
      <div class="done-mark">${ICON.tick}</div>
      <h2>Every decision is made</h2>
      <p>${D.decisions.length ? `${D.decisions.length} decision${D.decisions.length === 1 ? '' : 's'} in the log` : `${D.answers.size} answer${D.answers.size === 1 ? '' : 's'}`}${S.doc.parked.length ? `, ${S.doc.parked.length} parked` : ''}. The agent takes it from here.</p>
      <ol class="done-list">${D.decisions.length
        ? D.decisions.map((d) => `<li class="log"><span>${d.n ? `D${d.n}` : ''}</span><b>${inline(d.text)}</b></li>`).join('')
        : D.qs.map((x) => `<li><span>${esc(x.title)}</span><b>${esc(answerText(D.answers.get(x.id) || {}) || 'Open')}</b></li>`).join('')}</ol>
      <button class="btn copy" type="button">Copy as markdown</button>
    </div>`;
  } else {
    const first = !D.qs.length;
    el.innerHTML = `<div class="card-inner state">
      <div class="orb"><i></i><i></i><i></i></div>
      <h2>${first ? 'Preparing the first question' : 'Thinking about what to ask next'}</h2>
      <p>${S.listening ? 'The agent is listening. Add a note if there’s anything it should know.'
        : first ? 'The agent is reading your plan and writing questions.'
          : 'Your answers are with the agent. The next question will slide in when it’s ready.'}</p>
      <div class="skeleton"><i></i><i></i><i></i></div>
      <div class="hint-line">Add context while you wait <kbd>${isMac ? '⌘' : 'Ctrl'}</kbd><kbd>J</kbd></div>
    </div>`;
  }
  return el;
}

function frontSig(id, D) {
  const q = D.qs.find((x) => x.id === id);
  if (q) return JSON.stringify([q, D.qs.length, D.qs.indexOf(q), D.answers.get(q.id)?.seq, q.depends.map((x) => D.answers.has(x))]);
  if (id === '__done') return JSON.stringify([D.decisions, S.doc?.parked, [...D.answers.values()].map((a) => [a.id, answerText(a)])]);
  return JSON.stringify([id, S.listening, D.qs.length]);
}

function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight}px`;
}

const recommended = (q) => q.options.filter((o) => o.recommended).map((o) => o.label).slice(0, q.multi ? undefined : 1);

function updateHints(card, q) {
  const d = S.drafts.get(q.id);
  const ta = $('textarea', card);
  const rec = recommended(q);
  const picks = q.options.filter((o) => d.picks.has(o.label)).map((o) => o.label);
  const text = d.text.trim();
  ta.placeholder = picks.length ? 'Add a comment (optional)…' : q.options.length ? 'Or write your own answer…' : 'Write your answer…';
  let primary;
  if (picks.length) primary = `<kbd>↵</kbd> choose <b>${esc(picks.join(', '))}</b>${text ? ' with comment' : ''}`;
  else if (text) primary = '<kbd>↵</kbd> send custom answer';
  else if (rec.length) primary = `<kbd>↵</kbd> accept <span class="star">★</span> <b>${esc(rec.join(', '))}</b>`;
  else primary = 'Pick an option or type an answer';
  const keys = [];
  const n = Math.min(9, q.options.length);
  if (n) keys.push(`<kbd>${n > 1 ? `1-${n}` : '1'}</kbd> ${q.multi ? 'toggle' : 'choose'}`);
  keys.push('<kbd>⇧↵</kbd> new line');
  if (S.pinned) keys.push('<kbd>esc</kbd> back');
  $('.q-hints', card).innerHTML = `<span class="primary">${primary}</span><span>${keys.join(' ')}</span>`;
  $('.send', card).disabled = !(picks.length || text || rec.length);
}

function syncOptions(card, q) {
  const d = S.drafts.get(q.id);
  card.querySelectorAll('.opt').forEach((b) => {
    const on = d.picks.has(b.dataset.label);
    b.classList.toggle('sel', on);
    b.setAttribute('aria-checked', on);
  });
  updateHints(card, q);
}

// 1-9 pick an option while the answer box is empty. Once you've typed, digits are just text.
// Alt+1-9 picks even mid-sentence.
function pickByNumber(e, q, card) {
  const n = /^(Digit|Numpad)[1-9]$/.test(e.code) ? Number(e.code.slice(-1)) : /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
  if (!n || e.metaKey || e.ctrlKey || e.isComposing) return false;
  const ta = $('textarea', card);
  if (!e.altKey && ta?.value.trim()) return false;
  const o = q.options[n - 1];
  if (!o) return false;
  e.preventDefault();
  if (q.multi) togglePick(q, o.label, card);
  else { S.drafts.get(q.id).picks = new Set([o.label]); syncOptions(card, q); }
  card.querySelectorAll('.opt')[n - 1]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  focusAnswer(card);
  return true;
}

function togglePick(q, label, card) {
  const d = S.drafts.get(q.id);
  if (q.multi) d.picks.has(label) ? d.picks.delete(label) : d.picks.add(label);
  else d.picks = d.picks.has(label) ? new Set() : new Set([label]);
  syncOptions(card, q);
}

function onAnswerKey(e, q, card) {
  const ta = e.currentTarget;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    submit(q, card);
    return;
  }
  if (pickByNumber(e, q, card)) return;
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !q.multi && q.options.length && !ta.value.includes('\n')) {
    e.preventDefault();
    const d = S.drafts.get(q.id);
    const cur = q.options.findIndex((o) => d.picks.has(o.label));
    const start = cur < 0 ? (e.key === 'ArrowDown' ? -1 : q.options.length) : cur;
    const next = (start + (e.key === 'ArrowDown' ? 1 : -1) + q.options.length) % q.options.length;
    d.picks = new Set([q.options[next].label]);
    syncOptions(card, q);
    card.querySelectorAll('.opt')[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function submit(q, card) {
  const D = derive();
  const d = draft(q, D);
  let picks = q.options.filter((o) => d.picks.has(o.label)).map((o) => o.label);
  const text = d.text.trim();
  if (!picks.length && !text) {
    picks = recommended(q);
    if (!picks.length) { shake(card); return; }
  }
  const e = {
    type: 'answer', cid: cid(), id: q.id, title: q.title,
    choice: q.multi ? null : picks[0] || null,
    choices: q.multi ? picks : undefined,
    custom: text, revision: D.answers.has(q.id), at: new Date().toISOString(), seq: Infinity,
  };
  S.drafts.delete(q.id);
  sessionStorage.removeItem(`grill:${q.id}`);
  S.pinned = null;
  enqueue(e);
  if (fun) funSafe(() => fun.answered(e, q));
  render('submit');
}

function shake(card) {
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

// ── stage transitions ──────────────────────────────────────────────────────

function renderStage(D, reason) {
  const stack = $('#stack');
  const id = D.frontId;
  const sig = frontSig(id, D);
  const current = stack.querySelector('.card.front');
  const q = D.qs.find((x) => x.id === id);

  if (current && S.front === id) {
    if (sig !== S.frontSig) {
      S.frontSig = sig;
      if (q) {
        const body = $('.q-body', current);
        body.innerHTML = questionBodyHTML(q, D);
        updateHints(current, q);
        body.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: T(300) });
        hydrateDiagrams(body);
      } else {
        current.replaceChildren(...buildCard(id, D).childNodes);
      }
    } else if (q) updateHints(current, q);
    updateGhosts(D);
    return;
  }

  const oldId = S.front;
  S.front = id;
  S.frontSig = sig;
  const next = buildCard(id, D);

  if (current) {
    current.classList.remove('front');
    current.getAnimations({ subtree: true }).forEach((a) => { if (Number.isFinite(a.effect?.getComputedTiming().endTime)) a.finish(); });
    if (D.answers.has(oldId)) flyToRow(current, oldId);
    else if (D.qs.some((x) => x.id === oldId)) sink(current);
    else dissolve(current);
  }

  stack.append(next);
  updateGhosts(D);
  $('#stage').scrollTo({ top: 0, behavior: 'instant' });
  if (reason === 'pin' && D.answers.has(id)) riseFromRow(next, id);
  else promote(next, S.firstPaint ? 120 : 30);
  hydrateDiagrams(next);
  focusAnswer(next);
}

function focusAnswer(card = $('#stack .card.front')) {
  const ta = card && $('textarea', card);
  if (!ta) return;
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

function updateGhosts(D) {
  const isQ = D.qs.some((x) => x.id === D.frontId);
  const behind = isQ ? D.queue.filter((x) => x.id !== D.frontId).length : 0;
  $('#stack .g1').classList.toggle('on', behind >= 1);
  $('#stack .g2').classList.toggle('on', behind >= 2);
}

// The next card starts where the first ghost sits, then steps forward.
function promote(el, delay = 30) {
  el.animate([
    { transform: 'translateY(-11px) scale(.955)', backgroundColor: cssVar('--ghost-1'), opacity: 0.6 },
    { transform: 'none', backgroundColor: cssVar('--card'), opacity: 1 },
  ], { duration: T(440), delay: T(delay), easing: EASE_POP, fill: 'backwards' });
  el.firstElementChild.animate([
    { opacity: 0, transform: 'translateY(6px)' },
    { opacity: 1, transform: 'none' },
  ], { duration: T(320), delay: T(delay + 110), easing: EASE_OUT, fill: 'backwards' });
}

// The answered card collapses into its row in the decision list.
function flyToRow(el, id) {
  const row = $(`#decisions [data-id="${CSS.escape(id)}"]`);
  if (!row || reduced) return dissolve(el);
  row.scrollIntoView({ block: 'nearest' });
  const r0 = el.getBoundingClientRect();
  const r1 = row.getBoundingClientRect();
  Object.assign(el.style, { left: `${r0.left}px`, top: `${r0.top}px`, width: `${r0.width}px`, height: `${r0.height}px` });
  el.firstElementChild.style.width = `${r0.width}px`; // don't reflow text while the box shrinks
  el.classList.add('flying');
  document.body.append(el);
  row.classList.add('landing');

  el.firstElementChild.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: T(130), easing: 'ease-out', fill: 'forwards' });
  const dur = T(520);
  const flight = el.animate([
    { left: `${r0.left}px`, top: `${r0.top}px`, width: `${r0.width}px`, height: `${r0.height}px`, borderRadius: '18px' },
    { left: `${r1.left}px`, top: `${r1.top}px`, width: `${r1.width}px`, height: `${r1.height}px`, borderRadius: '8px' },
  ], { duration: dur, easing: EASE_OUT, fill: 'forwards' });
  el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: T(160), delay: dur * 0.62, fill: 'forwards' });
  // A no-op animation as the timer, so landing stays in sync with the flight's clock.
  row.animate([], { duration: dur * 0.55 }).finished.then(() => {
    row.classList.remove('landing', 'flash');
    void row.offsetWidth;
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 900);
  });
  flight.finished.then(() => el.remove(), () => el.remove());
}

// A revisited decision grows out of its row back into the card slot.
function riseFromRow(el, id) {
  const row = $(`#decisions [data-id="${CSS.escape(id)}"]`);
  if (!row || reduced) return promote(el);
  const r0 = row.getBoundingClientRect();
  const r1 = el.getBoundingClientRect();
  const pill = document.createElement('div');
  pill.className = 'pill';
  document.body.append(pill);
  const dur = T(440);
  pill.animate([
    { left: `${r0.left}px`, top: `${r0.top}px`, width: `${r0.width}px`, height: `${r0.height}px`, borderRadius: '8px', opacity: 0.4 },
    { left: `${r1.left}px`, top: `${r1.top}px`, width: `${r1.width}px`, height: `${r1.height}px`, borderRadius: '18px', opacity: 1 },
  ], { duration: dur, easing: EASE_OUT, fill: 'forwards' }).finished.then(() => pill.remove());
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T(120), delay: dur * 0.8, fill: 'backwards' });
  el.firstElementChild.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: T(260), delay: dur * 0.8, easing: EASE_OUT, fill: 'backwards' });
}

// An unanswered card steps back into the stack.
function sink(el) {
  el.classList.add('leaving');
  el.animate([
    { transform: 'none', opacity: 1 },
    { transform: 'translateY(-11px) scale(.955)', opacity: 0 },
  ], { duration: T(320), easing: EASE_OUT, fill: 'forwards' }).finished.then(() => el.remove(), () => el.remove());
}

function dissolve(el) {
  el.classList.add('leaving');
  el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: T(200), easing: 'ease-out', fill: 'forwards' })
    .finished.then(() => el.remove(), () => el.remove());
}

// ── notes ──────────────────────────────────────────────────────────────────

const noteBox = $('#note-box');
function sendNote() {
  const text = noteBox.value.trim();
  if (!text) return;
  const D = derive();
  const e = { type: 'note', cid: cid(), text, during: D.qs.some((q) => q.id === D.frontId) ? D.frontId : null, at: new Date().toISOString(), seq: Infinity };
  noteBox.value = '';
  sessionStorage.removeItem('grill:__note');
  autosize(noteBox);
  syncNoteButton();
  enqueue(e);
  render();
  // Back to answering. The note is visible in the list, so there's nothing left to do here.
  document.body.classList.remove('notes-open');
  focusAnswer();
}
noteBox.value = sessionStorage.getItem('grill:__note') || '';
noteBox.addEventListener('input', () => { sessionStorage.setItem('grill:__note', noteBox.value); autosize(noteBox); syncNoteButton(); });
noteBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendNote(); }
  if (e.key === 'Escape') { e.preventDefault(); document.body.classList.remove('notes-open'); focusAnswer(); }
});
$('#compose').addEventListener('submit', (e) => { e.preventDefault(); sendNote(); });
const syncNoteButton = () => { $('#compose button').disabled = !noteBox.value.trim(); };
syncNoteButton();

$('#stage').addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#notes-toggle')) document.body.classList.remove('notes-open');
});
$('#notes-toggle').addEventListener('click', () => {
  document.body.classList.toggle('notes-open');
  if (document.body.classList.contains('notes-open')) noteBox.focus();
});

// ── global interaction ─────────────────────────────────────────────────────

$('#stack').addEventListener('click', (e) => {
  const card = e.target.closest('.card.front');
  if (!card) return;
  const q = S.doc?.questions.find((x) => x.id === card.dataset.id);
  const opt = e.target.closest('.opt');
  if (opt && q) {
    togglePick(q, opt.dataset.label, card);
    focusAnswer(card);
    if (e.detail === 2 && S.drafts.get(q.id).picks.has(opt.dataset.label)) submit(q, card);
    else if (e.detail === 2) { togglePick(q, opt.dataset.label, card); submit(q, card); }
  } else if (e.target.closest('.send') && q) submit(q, card);
  else if (e.target.closest('.copy')) copySummary();
});

$('#decisions').addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (!row || row.classList.contains('pending')) return;
  const D = derive();
  const id = row.dataset.id;
  if (id === D.frontId) { focusAnswer(); return; }
  S.pinned = id === D.queue[0]?.id && !D.answers.has(id) ? null : id;
  render('pin');
});

document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    toggleFun();
    return;
  }
  if (mod && e.key.toLowerCase() === 'j') {
    e.preventDefault();
    if (document.activeElement === noteBox) { document.body.classList.remove('notes-open'); focusAnswer(); }
    else { document.body.classList.add('notes-open'); noteBox.focus(); }
    return;
  }
  if (e.key === 'Escape' && S.pinned && document.activeElement !== noteBox) {
    e.preventDefault();
    S.pinned = null;
    render('unpin');
    return;
  }
  const typing = /^(TEXTAREA|INPUT)$/.test(document.activeElement?.tagName);
  if (typing) return;
  const card = $('#stack .card.front');
  const q = card && S.doc?.questions.find((x) => x.id === card.dataset.id);
  if (q && pickByNumber(e, q, card)) return;
  if (!mod && !e.altKey && e.key.length === 1) focusAnswer(); // start typing anywhere
});

// ── fun mode ───────────────────────────────────────────────────────────────
// Backgrounds and little games (fun/). Imported the first time it's switched on, so with it off
// nothing extra loads or runs. Every call into it is fenced off: nothing in there may ever cost an
// answer or stall sending.

let fun = null;
let funLoading = null;
let funTries = 0;
function funSafe(fn) {
  const warn = (err) => console.warn('[fun]', err);
  try {
    const r = fn();
    return typeof r?.catch === 'function' ? r.catch(warn) : r;
  } catch (err) { warn(err); }
}
// The browser remembers a failed import, so a retry asks for a fresh URL.
const loadFun = () => (funLoading ||= import(`./fun/engine.js${funTries++ ? `?try=${funTries}` : ''}`)
  .then((m) => (fun = m.boot({ S, derive, focusAnswer })))
  .catch((err) => { funLoading = null; console.warn('[fun] didn’t load:', err); return null; }));
const toggleFun = () => loadFun().then((f) => f && funSafe(() => f.toggle()));
$('#fun-key').textContent = isMac ? '⌘⇧F' : 'Ctrl⇧F';
$('#fun-toggle').addEventListener('click', toggleFun);
{
  const param = new URLSearchParams(location.search).get('fun'); // ?fun=0 keeps it off for this load
  let saved = false;
  try { saved = localStorage.getItem('grill:fun') === 'true'; } catch {}
  if (param === null ? saved : param !== '0') loadFun();
}

function copySummary() {
  const D = derive();
  const lines = [`# ${S.doc.title}. Decisions`, ''];
  if (D.decisions.length) lines.push(...D.decisions.map((d) => `- ${d.n ? `D${d.n}. ` : ''}${d.text}`));
  else lines.push(...D.qs.map((q) => `- ${q.title} ${answerText(D.answers.get(q.id) || {}) || 'Open'}`));
  if (S.doc.parked.length) lines.push('', '## Parked', '', ...S.doc.parked.map((p) => `- ${p.replace(/\n/g, ' ')}`));
  navigator.clipboard.writeText(lines.join('\n')).then(() => toast('Copied the decision log'));
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2400);
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    // Only the grill server itself can turn an answer down. Any other 4xx came from a proxy on the way.
    const rejected = await res.json().then((b) => b?.grill === 'rejected', () => false);
    throw Object.assign(new Error(res.statusText), { status: res.status, rejected });
  }
  return res.json();
}

// ── outbox ─────────────────────────────────────────────────────────────────
// Answers and notes stay in S.optimistic until the server echoes them back. If the
// connection drops, they wait here (and survive a reload) and go out once it's back.
// The server ignores repeats by cid, so resending is safe. Only an explicit rejection from
// the grill server drops one, and then its text goes back in the box so nothing is lost.

const OUTBOX = 'grill:outbox';
function saveOutbox() {
  const pending = [...S.optimistic.values()];
  if (pending.length) sessionStorage.setItem(OUTBOX, JSON.stringify(pending));
  else sessionStorage.removeItem(OUTBOX);
}
function loadOutbox() {
  try {
    for (const e of JSON.parse(sessionStorage.getItem(OUTBOX) || '[]')) S.optimistic.set(e.cid, { ...e, seq: Infinity });
  } catch {}
}

function enqueue(e) {
  S.optimistic.set(e.cid, e);
  saveOutbox();
  flush();
}

let flushing = false;
let flushTimer;
async function flush() {
  if (flushing) return;
  flushing = true;
  clearTimeout(flushTimer);
  let failed = null;
  // In order, one at a time, so the agent reads them in the order you sent them.
  for (const e of [...S.optimistic.values()]) {
    if (!S.optimistic.has(e.cid)) continue;
    const { seq, at, ...body } = e;
    try {
      await post(e.type === 'note' ? '/api/note' : '/api/answer', body);
    } catch (err) {
      if (err.rejected) {
        S.optimistic.delete(e.cid); // the server won't ever take it, so don't loop
        saveOutbox();
        restoreDraft(e);
        toast(e.type === 'note' ? 'The grill server turned that note down. It’s back in the box.' : 'The grill server turned that answer down. It’s back on the card.');
        render();
        continue;
      }
      failed = err.status || 0;
      break;
    }
  }
  flushing = false;
  if (S.sendError !== failed) { S.sendError = failed; render(); }
  if (failed !== null) flushTimer = setTimeout(flush, 2000);
}

function restoreDraft(e) {
  if (e.type === 'note') {
    if (noteBox.value.trim()) return;
    noteBox.value = e.text;
    sessionStorage.setItem('grill:__note', e.text);
    autosize(noteBox);
    syncNoteButton();
    return;
  }
  if (S.drafts.has(e.id) || sessionStorage.getItem(`grill:${e.id}`)) return; // don't clobber newer typing
  S.drafts.set(e.id, { text: e.custom || '', picks: new Set(picksOf(e)) });
  if (e.custom) sessionStorage.setItem(`grill:${e.id}`, e.custom);
}

// ── live connection ────────────────────────────────────────────────────────
// Conductor's preview URL sits behind proxies that drop idle streams, and a plain
// EventSource gives up for good if a reconnect gets a 502. So reconnect by hand,
// with backoff, and treat a stream with no pings for a while as dead.

const conn = { es: null, lastSeen: 0, retryIn: 500, timer: null, offlineTimer: null };

function connect() {
  clearTimeout(conn.timer);
  conn.es?.close();
  const es = new EventSource('/api/stream');
  conn.es = es;
  conn.lastSeen = Date.now();
  const alive = () => {
    conn.lastSeen = Date.now();
    conn.retryIn = 500;
    if (!S.connected) {
      S.connected = true;
      S.offline = false;
      clearTimeout(conn.offlineTimer);
      conn.offlineTimer = null;
      flush();
      render();
    }
  };
  es.addEventListener('ping', alive);
  es.onmessage = (m) => {
    if (es !== conn.es) return;
    alive();
    const data = JSON.parse(m.data);
    if (data.src !== S.src) {
      S.src = data.src;
      try { S.doc = parseGrill(data.src); } catch (err) { console.error(err); }
    }
    S.events = data.events;
    S.delivered = data.delivered;
    S.listening = data.listening;
    render();
  };
  es.onerror = () => {
    if (es !== conn.es) return;
    es.close();
    disconnected();
  };
}

function disconnected() {
  S.connected = false;
  // Only say so if it lasts. Most drops are a proxy recycling the stream and heal in a second.
  if (!S.offline && !conn.offlineTimer) conn.offlineTimer = setTimeout(() => { conn.offlineTimer = null; S.offline = true; render(); }, 2500);
  clearTimeout(conn.timer);
  conn.timer = setTimeout(connect, conn.retryIn);
  conn.retryIn = Math.min(conn.retryIn * 2, 5000);
}

// The server pings every 10s. Silence for 25s means the stream died without telling us.
setInterval(() => {
  if (conn.es && Date.now() - conn.lastSeen > 25000) { conn.es.close(); disconnected(); }
}, 5000);
// Coming back to the tab or back online: try now rather than waiting out the backoff.
const reconnectNow = () => { if (!S.connected) { conn.retryIn = 500; connect(); } };
addEventListener('online', reconnectNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reconnectNow(); });

bindChartHover($('#stack'));
loadOutbox();
render();
connect();
