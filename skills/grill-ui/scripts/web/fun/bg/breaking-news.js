// Breaking news. A 24-hour news channel covering your grill: a red BREAKING NEWS lower third about
// the developer still deciding, a viewer poll, and a ticker scrolling past every decision so far.

const CSS = `
.bn-top{position:absolute;display:flex;align-items:center;gap:10px;font:800 13px/1 "Helvetica Neue",Arial,"Liberation Sans",sans-serif;color:#fff;letter-spacing:.04em}
.bn-logo{display:flex;align-items:stretch;height:30px;border-radius:3px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.4)}
.bn-logo b{display:grid;place-items:center;padding:0 9px;background:linear-gradient(#e8202a,#a30d16);font:italic 900 18px/1 "Helvetica Neue",Arial,sans-serif;letter-spacing:-.02em}
.bn-logo span{display:grid;place-items:center;padding:0 9px;background:linear-gradient(#ffffff,#d9dee8);color:#0b1f4d;font-size:10px;letter-spacing:.12em}
.bn-live{display:flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:3px;background:rgba(0,0,0,.45);font-size:11px;letter-spacing:.14em}
.bn-live i{width:8px;height:8px;border-radius:50%;background:#ff2d36;box-shadow:0 0 8px #ff2d36}
.bn-clock{margin-left:auto;font-variant-numeric:tabular-nums;opacity:.85;font-size:12px}
.bn-l3{position:absolute;display:flex;flex-direction:column;filter:drop-shadow(0 10px 24px rgba(0,0,0,.45))}
.bn-row{display:flex;align-items:stretch;overflow:hidden}
.bn-tab{position:relative;flex:none;display:grid;place-items:center;padding:0 16px;background:linear-gradient(#f0242e,#b50f19 60%,#9c0b14);color:#fff;font:italic 900 var(--tab,20px)/1 "Helvetica Neue",Arial,"Liberation Sans",sans-serif;letter-spacing:-.01em;text-transform:uppercase;white-space:nowrap;overflow:hidden}
.bn-tab.just{background:linear-gradient(#ffd23a,#f0a400);color:#2a1600}
.bn-glint{position:absolute;inset:-10px auto -10px 0;width:38px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);transform:translateX(-80px) skewX(-20deg)}
.bn-head{flex:1;min-width:0;display:flex;align-items:center;padding:0 16px;background:linear-gradient(#ffffff,#e3e7ef);color:#0a1a40;font:800 var(--head,24px)/1.1 "Helvetica Neue",Arial,"Liberation Sans",sans-serif;letter-spacing:-.015em;text-transform:uppercase;white-space:nowrap;overflow:hidden}
.bn-head span{overflow:hidden;text-overflow:ellipsis}
.bn-head.two{white-space:normal}
.bn-head.two span{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.bn-sub{display:flex;align-items:center;gap:12px;height:30px;padding:0 16px;background:linear-gradient(#11306f,#0a1f4d);color:#fff;font:700 13px/1 "Helvetica Neue",Arial,"Liberation Sans",sans-serif;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap;overflow:hidden}
.bn-sub span{overflow:hidden;text-overflow:ellipsis}
.bn-sub em{flex:none;font-style:normal;color:#ffd23a}
.bn-tick{position:absolute;display:flex;height:32px;overflow:hidden;background:#05102b;border-top:2px solid #e8202a;font:700 14px/32px "Helvetica Neue",Arial,"Liberation Sans",sans-serif;color:#f4f6fb;text-transform:uppercase;letter-spacing:.02em}
.bn-tick b{flex:none;z-index:1;padding:0 12px;background:#ffd23a;color:#05102b;font-weight:900;box-shadow:6px 0 12px #05102b}
.bn-track{white-space:nowrap;will-change:transform}
.bn-track s{display:inline-block;width:8px;height:8px;margin:0 16px 2px;background:#e8202a;text-decoration:none;vertical-align:middle}
.bn-poll{position:absolute;padding:10px 12px 12px;background:linear-gradient(rgba(10,31,77,.94),rgba(5,16,43,.94));border-left:4px solid #e8202a;color:#fff;font:700 12px/1.2 "Helvetica Neue",Arial,"Liberation Sans",sans-serif;text-transform:uppercase;letter-spacing:.03em;box-shadow:0 10px 24px rgba(0,0,0,.4)}
.bn-poll h4{margin:0 0 8px;font-size:11px;letter-spacing:.12em;color:#ffd23a}
.bn-bar{display:grid;grid-template-columns:1fr 40px;align-items:center;gap:8px;margin-top:6px}
.bn-bar div{position:relative;height:18px;background:rgba(255,255,255,.08);overflow:hidden}
.bn-bar i{position:absolute;inset:0 auto 0 0;width:100%;background:linear-gradient(90deg,#2c5fd6,#4f86ff);transform-origin:left}
.bn-bar.rec i{background:linear-gradient(90deg,#d0141e,#ff4049)}
.bn-bar span{position:relative;display:block;padding:0 6px;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
.bn-bar em{font-style:normal;text-align:right;font-variant-numeric:tabular-nums}
`;

export default function breakingNews(k, ctx) {
  const cv = k.canvas({ dpr: 1, alpha: false });
  const c = cv.ctx;
  k.el('style', { text: CSS });
  const top = k.el('div', { class: 'bn-top', html: '<div class="bn-logo"><b>GNN</b><span>GRILL NEWS NETWORK</span></div><div class="bn-live"><i></i>LIVE</div><div class="bn-clock"></div>' });
  const live = top.querySelector('.bn-live i');
  const clockEl = top.querySelector('.bn-clock');
  const poll = k.el('div', { class: 'bn-poll' });
  const l3 = k.el('div', { class: 'bn-l3', html: '<div class="bn-row"><div class="bn-tab"><span>Breaking news</span><div class="bn-glint"></div></div><div class="bn-head"><span></span></div></div><div class="bn-sub"><em></em><span></span></div>' });
  const tab = l3.querySelector('.bn-tab');
  const tabText = tab.querySelector('span');
  const glint = tab.querySelector('.bn-glint');
  const head = l3.querySelector('.bn-head');
  const headText = head.querySelector('span');
  const sub = l3.querySelector('.bn-sub');
  const tick = k.el('div', { class: 'bn-tick', html: '<b>GNN</b><div class="bn-track"></div>' });
  const track = tick.querySelector('.bn-track');
  const meter = document.createElement('canvas').getContext('2d');

  let L = null; // layout
  let answered = null;
  let subI = 0;
  let tickX = 0;
  let tickW = 1;
  let story = '';

  const up = (s) => k.plain(s || '').toUpperCase();
  const q = () => ctx.question;
  const recLabel = () => q()?.options.find((o) => o.recommended)?.label;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const quote = (s, n = 60) => `“${k.clip(k.plain(s), n)}”`;

  // ── the copy ───────────────────────────────────────────────────────────

  function headline() {
    const Q = q();
    if (ctx.front === 'done') {
      const n = ctx.decisions.length || ctx.answers.length;
      return ['Breaking news', `It's over: ${n ? `${n} decision${n === 1 ? '' : 's'} made` : 'all decisions made'}. Developer seen leaving the grill`];
    }
    if (!Q) return ctx.agent === 'listening'
      ? ['Developing', 'Agent now listening. Developer urged to say something']
      : ['Developing', 'Agent seen preparing questions. More at 11'];
    if (answered) {
      const pick = answered.picks[0];
      if (answered.custom && !pick) return ['Just in', 'Developer writes own answer. “We did not see this coming,” say analysts'];
      const secs = Math.max(1, Math.round(answered.seconds));
      if (answered.seconds && answered.seconds < 8) return ['Just in', `Developer decides in ${secs} second${secs === 1 ? '' : 's'}. Critics: “didn't even read it”`];
      if (answered.tookRec) return ['Just in', `Developer takes the recommendation: ${quote(pick, 50)}. Nation exhales`];
      if (!answered.hasRec) return ['Just in', `Developer goes with ${quote(pick, 50)}. Agent had no comment`];
      return ['Just in', `Shock as developer ignores the ★ and picks ${quote(pick, 50)}`];
    }
    if (Q.revising) return ['U-turn', `Developer revisits ${quote(Q.title, 70)}. Sources: “having second thoughts”`];
    const t = ctx.cardTime;
    if (t > 180) return ['Breaking news', `Day ${Math.floor(t / 60)} of the stand-off over ${quote(Q.title, 50)}`];
    if (t > 75) return ['Breaking news', `Developer enters minute ${Math.floor(t / 60) + 1} of deliberation. Family asks for privacy`];
    if (!Q.options.length) return ['Breaking news', `Developer asked for own words on ${quote(Q.title, 60)}. Words not yet found`];
    return ['Breaking news', `Local developer still deciding on ${quote(Q.title, 90)}`];
  }

  function subs() {
    const Q = q();
    const rate = ctx.recRate == null ? null : Math.round(ctx.recRate * 100);
    if (ctx.front === 'done') return [
      ['Recap', rate == null ? 'All decisions now in the log' : `Recommendation taken ${rate}% of the time`],
      ['Exclusive', 'Agent “takes it from here”'],
      ['Weather', 'Clear skies ahead. Some scattered pull requests'],
    ];
    if (!Q) return [
      ['Live', 'Questions expected within minutes'],
      ['Analysis', 'What will the agent ask? Our panel speculates'],
      ['Traffic', 'Heavy congestion in the context window'],
    ];
    if (answered) return [['Live', 'Agent reacting. Next question expected shortly'], ['Markets', answered.tookRec ? '★ recommendations up sharply' : 'Gut instinct rallies on the news']];
    const other = Q.options.find((o) => !o.recommended);
    const rec = recLabel();
    return [
      [`Q${Q.n} of ${Q.total}`, Q.tag ? `${Q.tag} desk reporting` : 'Live from the grill'],
      rec ? ['Sources', `Agent quietly backing ${quote(rec, 48)}`] : ['Sources', 'Agent declines to comment'],
      ['On card', `${mmss(ctx.cardTime)} and counting`],
      other ? ['Insiders', `${quote(other.label, 44)} not ruled out`] : ['Insiders', 'Answer box remains empty'],
      ...(Q.multi ? [['Exclusive', 'More than one answer allowed, officials confirm']] : []),
    ];
  }

  function tickerItems() {
    const ds = ctx.decisions.map((d) => `${d.n ? `D${d.n}: ` : ''}${up(d.text)}`);
    const rate = ctx.recRate == null ? null : Math.round(ctx.recRate * 100);
    const s = ctx.stats || {};
    return [
      ...(ds.length ? ds : ['NO DECISIONS YET. EXPERTS BAFFLED']),
      rate == null ? 'MARKETS: RECOMMENDATIONS FLAT IN EARLY TRADING' : `MARKETS: ★ TAKEN ${rate}% OF THE TIME`,
      `SPORTS: AGENT ${s.recs || 0}, DEVELOPER'S GUT ${Math.max(0, (s.answers || 0) - (s.recs || 0))}`,
      'WEATHER: 100% CHANCE OF FOLLOW-UP QUESTIONS',
      ctx.notes ? `NOTES DESK: ${ctx.notes} NOTE${ctx.notes > 1 ? 'S' : ''} PASSED TO THE AGENT` : 'NOTES DESK: QUIET',
      `${up(ctx.doc?.title || 'THE PLAN')}: STORY CONTINUES`,
    ];
  }

  // ── DOM updates ────────────────────────────────────────────────────────

  // One line as big as fits, or two smaller lines on the full lower third, then an ellipsis.
  function fitHead(text) {
    const width = (s) => { meter.font = `800 ${s}px "Helvetica Neue", Arial, "Liberation Sans", sans-serif`; return meter.measureText(text.toUpperCase()).width; };
    let s = L.head, two = false;
    while (s > 17 && width(s) > L.headW) s--;
    if (width(s) > L.headW && L.two) {
      two = true;
      s = L.twoMax;
      while (s > 13 && width(s) > L.headW * 1.85) s--;
    }
    head.classList.toggle('two', two);
    head.style.setProperty('--head', `${s}px`);
  }

  function setHead(intro) {
    const [label, text] = headline();
    const key = label + text;
    if (key === story && !intro) return;
    story = key;
    tabText.textContent = label;
    tab.classList.toggle('just', label === 'Just in' || label === 'U-turn');
    headText.textContent = text;
    if (L) fitHead(text);
    if (k.reduced) return;
    if (intro) { // the full swoosh: tab flies in, bar wipes open, text rises
      k.animate(tab, [{ transform: 'translateX(-110%)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1.15)' });
      k.animate(head, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 520, delay: 220, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'backwards' });
      k.animate(headText, [{ transform: 'translateY(110%)' }, { transform: 'none' }], { duration: 380, delay: 560, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      k.animate(sub, [{ transform: 'translateY(-100%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 360, delay: 700, easing: 'ease-out', fill: 'backwards' });
    } else {
      k.animate(headText, [{ transform: 'translateY(-110%)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    k.animate(glint, [{ transform: 'translateX(-80px) skewX(-20deg)' }, { transform: 'translateX(320px) skewX(-20deg)' }], { duration: 700, delay: intro ? 500 : 0, easing: 'ease-in-out' });
  }

  function setSub(animate) {
    const all = subs();
    const [label, text] = all[subI % all.length];
    sub.querySelector('em').textContent = label;
    sub.querySelector('span').textContent = text;
    if (animate && !k.reduced) k.animate(sub, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 380, easing: 'cubic-bezier(.6,0,.2,1)' });
  }

  function setTicker() {
    const items = tickerItems();
    const html = items.map((t) => `<span>${t.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m])}</span><s></s>`).join('');
    track.innerHTML = html + html;
    tickW = track.scrollWidth / 2 || 1;
  }

  // What the viewers think, by state of the grill: [question, [[label, %, ★]…]]
  function pollData() {
    const Q = q();
    if (ctx.front === 'done') return ['Did they make the right calls?', [['Yes', 58, true], ['Ask again tomorrow', 30], ['What is a grill', 12]]];
    if (!Q) return ['How many questions will there be?', [['A few', 21], ['A lot', 33], ['Yes', 46, true]]];
    if (answered) return null;
    if (Q.options.length < 2) return ['What will they write?', [['Something thoughtful', 41, true], ['“idk”', 17], ['A whole essay', 42]]];
    const r = k.rng(`${Q.id}:poll`);
    let w = Q.options.map((o) => (o.recommended ? r.rand(3, 5) : r.rand(0.6, 2)));
    const sum = w.reduce((a, b) => a + b, 0);
    w = w.map((x) => Math.round((x / sum) * 100));
    w[0] += 100 - w.reduce((a, b) => a + b, 0);
    return ['What should they pick?', Q.options.map((o, i) => [`${o.recommended ? '★ ' : ''}${k.plain(o.label)}`, w[i], o.recommended])];
  }

  function setPoll() {
    const data = L?.poll && pollData();
    if (!data) { poll.style.display = 'none'; return; }
    const [title, rows] = data;
    const shown = rows.slice(0, L.pollRows);
    poll.style.display = '';
    poll.style.top = `${L.l3y - 16 - (36 + 24 * shown.length)}px`;
    poll.innerHTML = `<h4></h4>${shown.map(([, n, rec]) => `<div class="bn-bar${rec ? ' rec' : ''}"><div><i style="transform:scaleX(${n / 100})"></i><span></span></div><em>${n}%</em></div>`).join('')}`;
    poll.querySelector('h4').textContent = `Viewer poll: ${title}`;
    poll.querySelectorAll('.bn-bar span').forEach((s, i) => { s.textContent = shown[i][0]; });
    if (!k.reduced) poll.querySelectorAll('.bn-bar i').forEach((el, i) => k.animate(el, [{ transform: 'scaleX(0)' }, { transform: `scaleX(${shown[i][1] / 100})` }], { duration: 900, delay: 900 + i * 120, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  }

  // ── layout ─────────────────────────────────────────────────────────────

  function layout() {
    const sp = k.space();
    const st = sp.stage;
    const bottom = sp.gaps.find((g) => g.where === 'bottom' || g.where === 'all');
    const topGap = sp.gaps.find((g) => g.where === 'top');
    const pad = st.width < 700 ? 16 : 24;
    const x = st.x + pad, w = st.width - pad * 2;
    const bh = bottom ? bottom.h : 0;
    const mode = bh >= 150 ? 'full' : bh >= 94 ? 'compact' : bh >= 44 ? 'ticker' : 'none';
    const tickH = 32;
    Object.assign(tick.style, { left: `${st.x}px`, width: `${st.width}px`, top: `${st.bottom - tickH}px`, display: mode === 'none' ? 'none' : '' });
    const rowH = mode === 'full' ? 54 : 44;
    const tabSize = mode === 'full' ? 21 : 16;
    const l3h = rowH + (mode === 'full' ? 30 : 0);
    let ly = st.bottom - tickH - 14 - l3h;
    let show = mode === 'full' || mode === 'compact';
    if (!show && topGap && topGap.h >= 56) { show = true; ly = topGap.y + (topGap.h - 44) / 2; }
    const compact = mode !== 'full';
    Object.assign(l3.style, { left: `${x}px`, width: `${w}px`, top: `${ly}px`, display: show ? '' : 'none' });
    l3.querySelector('.bn-row').style.height = `${rowH}px`;
    sub.style.display = compact ? 'none' : '';
    tab.style.setProperty('--tab', `${compact ? 16 : tabSize}px`);
    meter.font = `italic 900 ${compact ? 16 : tabSize}px "Helvetica Neue", Arial, sans-serif`;
    const tabW = meter.measureText('BREAKING NEWS').width + 32;
    const headSize = compact ? 22 : 28;
    const pollRows = Math.min(4, Math.floor((ly - (bottom?.y ?? 0) - 52) / 24));
    const pollOn = mode === 'full' && pollRows >= 2 && w >= 380;
    L = { headW: w - tabW - 32, head: headSize, two: true, twoMax: compact ? 17 : 22, poll: pollOn, pollRows, l3y: ly };
    if (pollOn) Object.assign(poll.style, { left: `${x}px`, width: `${Math.min(420, w * 0.62)}px` });
    // the channel bug goes in the gap above the card
    const showTop = topGap && topGap.h >= 40 && !(show && mode !== 'full' && mode !== 'compact');
    Object.assign(top.style, { left: `${x}px`, top: `${topGap ? topGap.y + (topGap.h - 30) / 2 : 0}px`, display: showTop ? '' : 'none' });
    L.topX = x; L.topW = w;
    clockRoom(sp);
    fitHead(headline()[1]);
  }

  // the clock stops short of the score HUD and the narrow-window Notes button
  function clockRoom(sp = k.space()) {
    const right = Math.min(L.topX + L.topW, ...[sp.hud, k.rect(document.getElementById('notes-toggle'))].filter(Boolean).map((r) => r.left - 12));
    top.style.width = `${right - L.topX}px`;
    clockEl.style.display = right - L.topX < 360 ? 'none' : '';
  }

  // ── the studio ─────────────────────────────────────────────────────────

  function studio(t) {
    const W = cv.w, H = cv.h;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#071740');
    g.addColorStop(0.55, '#0b2766');
    g.addColorStop(1, '#040c26');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // light beams sweeping the studio
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = Math.sin(t * 0.25 + i * 1.7) * 0.35 + (i - 1.5) * 0.35;
      const x0 = W * (0.15 + i * 0.23);
      c.save();
      c.translate(x0, -40);
      c.rotate(a);
      const bg = c.createLinearGradient(0, 0, 0, H * 1.1);
      bg.addColorStop(0, `rgba(${i % 2 ? '90,150,255' : '255,70,90'},.16)`);
      bg.addColorStop(1, 'rgba(40,80,200,0)');
      c.fillStyle = bg;
      c.beginPath();
      c.moveTo(-8, 0); c.lineTo(8, 0); c.lineTo(W * 0.12, H * 1.1); c.lineTo(-W * 0.12, H * 1.1); c.closePath();
      c.fill();
      c.restore();
    }
    // the spinning globe, centred on the stage so its rim glows around the card
    const st = L?.stage || { x: 0, y: 0, width: W, height: H };
    const cx = st.x + st.width / 2, cy = st.y + st.height * 0.48, R = Math.min(st.width * 0.62, H * 0.62);
    const halo = c.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25);
    halo.addColorStop(0, 'rgba(60,120,255,.18)');
    halo.addColorStop(1, 'rgba(60,120,255,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, W, H);
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(140,190,255,.22)';
    const rot = t * 0.12;
    const tilt = 0.35;
    const proj = (lat, lon) => {
      const x = Math.cos(lat) * Math.sin(lon + rot), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon + rot);
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      return [cx + x * R, cy - y2 * R, z2];
    };
    const line = (pts) => {
      c.beginPath();
      let on = false;
      for (const [x, y, z] of pts) {
        if (z < 0) { on = false; continue; }
        if (on) c.lineTo(x, y); else { c.moveTo(x, y); on = true; }
      }
      c.stroke();
    };
    for (let lat = -75; lat <= 75; lat += 15) line(Array.from({ length: 49 }, (_, i) => proj(lat * Math.PI / 180, i / 48 * Math.PI * 2)));
    for (let lon = 0; lon < 360; lon += 15) line(Array.from({ length: 25 }, (_, i) => proj((i / 24 - 0.5) * Math.PI, lon * Math.PI / 180)));
    c.strokeStyle = 'rgba(160,205,255,.35)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
    // broadcast rings
    c.strokeStyle = 'rgba(255,60,80,.25)';
    c.lineWidth = 3;
    c.setLineDash([R * 0.3, R * 0.15]);
    c.beginPath(); c.arc(cx, cy, R * 1.12, t * 0.3, t * 0.3 + 5.4); c.stroke();
    c.strokeStyle = 'rgba(120,180,255,.2)';
    c.setLineDash([4, 10]);
    c.beginPath(); c.arc(cx, cy, R * 1.22, -t * 0.2, -t * 0.2 + 6); c.stroke();
    c.setLineDash([]);
    c.globalCompositeOperation = 'source-over';
    // a floor sheen under everything
    const f = c.createLinearGradient(0, H * 0.7, 0, H);
    f.addColorStop(0, 'rgba(0,0,0,0)');
    f.addColorStop(1, 'rgba(0,4,20,.6)');
    c.fillStyle = f;
    c.fillRect(0, H * 0.7, W, H * 0.3);
  }

  function relayout() {
    layout();
    L.stage = k.space().stage;
    setPoll();
  }

  relayout();
  setHead(true);
  setSub(false);
  setTicker();

  let pulse = 0;
  k.loop((dt, t) => {
    studio(t);
    if (!k.reduced) {
      tickX = (tickX + dt * 85) % tickW;
      track.style.transform = `translateX(${-tickX}px)`;
      pulse += dt;
      live.style.opacity = 0.45 + 0.55 * Math.abs(Math.cos(pulse * 2.4));
    }
  }, { still: 0.5 });

  const clock = () => { const d = new Date(); clockEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} GT`; };
  clock();
  k.every(1000, () => {
    clock();
    setHead(false); // the headline escalates as you take longer
    if (ctx.question && !answered && Math.floor(ctx.cardTime) % 5 === 4) { subI++; setSub(true); }
  });

  const sting = () => { // dun, dun, DUNNN
    [[392, 0], [392, 0.16], [523.3, 0.32]].forEach(([freq, delay], i) => {
      k.sfx.tone({ type: 'sawtooth', freq, dur: i === 2 ? 0.9 : 0.12, gain: 0.06, delay, filter: 'lowpass', freqF: 1600, q: 0.7 });
      k.sfx.tone({ type: 'triangle', freq: freq / 2, dur: i === 2 ? 0.9 : 0.12, gain: 0.08, delay });
    });
    k.sfx.whoosh({ gain: 0.4, pitch: 0.8 });
  };

  return {
    question() {
      answered = null;
      subI = 0;
      relayout();
      setHead(true);
      setSub(false);
      setTicker();
      sting();
    },
    layout() {
      relayout();
      tickW = track.scrollWidth / 2 || 1;
    },
    status() { if (!ctx.question) { setHead(false); setSub(true); } },
    decisions() { setTicker(); },
    event(name) {
      if (name === 'note' || name === 'stat') setTicker();
      if (name === 'stat' && L) clockRoom();
    },
    answer(a) {
      answered = a;
      setHead(true);
      subI = 0;
      setSub(true);
      setPoll();
      setTicker();
      k.sfx.tone({ type: 'sine', freq: 880, dur: 0.15, gain: 0.06 });
      k.sfx.tone({ type: 'sine', freq: 1318.5, dur: 0.4, gain: 0.05, delay: 0.12 });
    },
  };
}
