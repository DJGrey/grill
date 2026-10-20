// Inline SVG charts for ```chart blocks. Spec (JSON):
//   { "type": "bar" | "hbar" | "line" | "stats",
//     "title": "...", "subtitle": "...", "unit": "ms",
//     "x": ["A", "B"], "series": [{ "name": "p95", "values": [1, 2] }],
//     "data": { "A": 1, "B": 2 },            // shorthand for one series
//     "highlight": "B",                       // emphasise one category (bar / hbar)
//     "items": [{ "label", "value", "delta", "good": "up" | "down" }]  // stats }
// Colors are CSS custom properties (--s1…--s8) so light/dark is handled in styles.css.

import { esc } from './md.mjs';

const W = 600;

function parseSpec(src) {
  const cleaned = src.replace(/,\s*([}\]])/g, '$1'); // tolerate trailing commas
  const spec = JSON.parse(cleaned);
  if (spec.data && !spec.series) {
    spec.x = Object.keys(spec.data);
    spec.series = [{ name: spec.title || '', values: Object.values(spec.data) }];
  }
  if (!spec.series && spec.values) spec.series = [{ name: spec.title || '', values: spec.values }];
  spec.x ||= spec.labels || [];
  spec.series ||= [];
  spec.type = (spec.type || 'bar').toLowerCase();
  return spec;
}

export const compact = (n) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${+(n / 1e3).toFixed(1)}K`;
  if (a >= 1000) return n.toLocaleString();
  return `${+n.toFixed(Math.abs(n) < 10 && n % 1 ? 2 : 1)}`;
};
const fmt = (n, unit) => `${compact(n)}${unit ? (unit.length <= 2 || unit === 'ms' ? unit : ` ${unit}`) : ''}`;

function niceTicks(min, max, count = 4) {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

// Column / bar with a 4px rounded data-end, square at the baseline.
function roundedBar(x, y, w, h, horizontal) {
  const r = Math.min(4, horizontal ? w / 2 : h / 2, horizontal ? h / 2 : w / 2);
  if (h <= 0 || w <= 0) return '';
  if (horizontal) return `M${x},${y}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - r}z`;
  return `M${x},${y + h}v-${h - r}a${r},${r} 0 0 1 ${r},-${r}h${w - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - r}z`;
}

const color = (i) => `var(--s${(i % 8) + 1})`;

function legend(series) {
  if (series.length < 2) return '';
  return `<div class="legend">${series.map((s, i) => `<span><i style="background:${color(i)}"></i>${esc(s.name || `Series ${i + 1}`)}</span>`).join('')}</div>`;
}

function tipFor(spec, xi) {
  const rows = spec.series.map((s, i) => `<div class="tip-row"><i style="background:${color(i)}"></i>${esc(s.name || spec.title || '')}<b>${esc(fmt(s.values[xi] ?? 0, spec.unit))}</b></div>`);
  return esc(`<div class="tip-title">${esc(String(spec.x[xi]))}</div>${rows.join('')}`);
}

function bar(spec) {
  const H = 220, padL = 40, padR = 8, padT = 16, padB = 28;
  const all = spec.series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(...all));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - ticks[0]) / (ticks.at(-1) - ticks[0]));
  const band = (W - padL - padR) / spec.x.length;
  const n = spec.series.length;
  const bw = Math.min(24, (band * 0.7 - (n - 1) * 2) / n);
  const groupW = n * bw + (n - 1) * 2;
  const hl = spec.highlight;
  let marks = '';
  spec.x.forEach((label, xi) => {
    const gx = padL + band * xi + (band - groupW) / 2;
    spec.series.forEach((s, si) => {
      const v = s.values[xi] ?? 0;
      const top = y(Math.max(v, 0)), bottom = y(Math.min(v, 0));
      const fill = hl !== undefined && n === 1 && label !== hl ? 'var(--mark-muted)' : color(si);
      marks += `<path d="${roundedBar(gx + si * (bw + 2), top, bw, bottom - top)}" fill="${fill}"/>`;
    });
    if (n === 1) {
      const v = spec.series[0].values[xi] ?? 0;
      if (hl === undefined || label === hl) marks += `<text class="val" x="${gx + bw / 2}" y="${y(Math.max(v, 0)) - 6}" text-anchor="middle">${esc(fmt(v, spec.unit))}</text>`;
    }
    marks += `<text class="axis" x="${padL + band * xi + band / 2}" y="${H - 8}" text-anchor="middle">${esc(String(label))}</text>`;
    marks += `<rect class="hit" x="${padL + band * xi}" y="${padT}" width="${band}" height="${H - padT - padB}" data-tip="${tipFor(spec, xi)}"/>`;
  });
  const grid = ticks.map((t) => `<line class="${t === 0 ? 'base' : 'grid'}" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="axis tick" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${esc(compact(t))}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${grid}${marks}</svg>`;
}

function hbar(spec) {
  const row = 30, padT = 4, labelW = Math.min(180, 12 + 7 * Math.max(...spec.x.map((l) => String(l).length)));
  const n = spec.series.length;
  const bh = Math.min(n === 1 ? 18 : 12, (row - 8) / n);
  const H = padT * 2 + row * spec.x.length;
  const max = Math.max(...spec.series.flatMap((s) => s.values), 0) || 1;
  const valW = 16 + 7 * Math.max(...spec.series.flatMap((s) => s.values.map((v) => fmt(v, spec.unit).length)));
  const x = (v) => (Math.max(v, 0) / max) * (W - labelW - valW);
  const hl = spec.highlight;
  let marks = `<line class="base" x1="${labelW}" x2="${labelW}" y1="${padT}" y2="${H - padT}"/>`;
  spec.x.forEach((label, xi) => {
    const top = padT + row * xi + (row - (n * bh + (n - 1) * 2)) / 2;
    const dim = hl !== undefined && n === 1 && label !== hl;
    marks += `<text class="axis${dim ? '' : ' strong'}" x="${labelW - 10}" y="${padT + row * xi + row / 2 + 4}" text-anchor="end">${esc(String(label))}</text>`;
    spec.series.forEach((s, si) => {
      const v = s.values[xi] ?? 0;
      marks += `<path d="${roundedBar(labelW, top + si * (bh + 2), x(v), bh, true)}" fill="${dim ? 'var(--mark-muted)' : color(si)}"/>`;
      if (n === 1) marks += `<text class="val" x="${labelW + x(v) + 6}" y="${top + bh / 2 + 4}">${esc(fmt(v, spec.unit))}</text>`;
    });
    marks += `<rect class="hit" x="0" y="${padT + row * xi}" width="${W}" height="${row}" data-tip="${tipFor(spec, xi)}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${marks}</svg>`;
}

function line(spec) {
  const H = 220, padL = 40, padR = 56, padT = 16, padB = 28;
  const all = spec.series.flatMap((s) => s.values);
  const ticks = niceTicks(Math.min(0, ...all), Math.max(...all));
  const y = (v) => padT + (H - padT - padB) * (1 - (v - ticks[0]) / (ticks.at(-1) - ticks[0]));
  const step = (W - padL - padR) / Math.max(1, spec.x.length - 1);
  const x = (i) => padL + step * i;
  let out = ticks.map((t) => `<line class="${t === 0 ? 'base' : 'grid'}" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="axis tick" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${esc(compact(t))}</text>`).join('');
  const every = Math.ceil(spec.x.length / 8);
  spec.x.forEach((l, i) => { if (i % every === 0 || i === spec.x.length - 1) out += `<text class="axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(String(l))}</text>`; });
  spec.series.forEach((s, si) => {
    const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    if (spec.series.length === 1) out += `<polygon points="${x(0)},${y(Math.max(ticks[0], 0))} ${pts} ${x(s.values.length - 1)},${y(Math.max(ticks[0], 0))}" fill="${color(si)}" opacity="0.1"/>`;
    out += `<polyline points="${pts}" fill="none" stroke="${color(si)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const li = s.values.length - 1;
    out += `<circle class="dot" cx="${x(li)}" cy="${y(s.values[li])}" r="4" fill="${color(si)}"/>`;
    out += `<text class="val" x="${x(li) + 8}" y="${y(s.values[li]) + 4}">${esc(fmt(s.values[li], spec.unit))}</text>`;
  });
  out += `<line class="guide" x1="0" x2="0" y1="${padT}" y2="${H - padB}"/>`;
  spec.x.forEach((_, i) => { out += `<rect class="hit" data-gx="${x(i)}" x="${x(i) - step / 2}" y="${padT}" width="${step}" height="${H - padT - padB}" data-tip="${tipFor(spec, i)}"/>`; });
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${out}</svg>`;
}

function stats(spec) {
  return `<div class="stats">${(spec.items || []).map((it) => {
    const d = it.delta;
    let delta = '';
    if (d !== undefined && d !== null && d !== '') {
      const num = typeof d === 'number' ? d : parseFloat(d);
      const up = num > 0;
      const good = it.good === 'down' ? !up : up;
      const txt = typeof d === 'number' ? `${up ? '+' : ''}${d}${it.deltaUnit || ''}` : String(d);
      delta = `<span class="delta ${num === 0 || Number.isNaN(num) ? '' : good ? 'good' : 'bad'}">${esc(txt)}</span>`;
    }
    return `<div class="stat"><div class="stat-label">${esc(it.label || '')}</div><div class="stat-value">${esc(typeof it.value === 'number' ? compact(it.value) : String(it.value ?? ''))}${it.unit ? `<small>${esc(it.unit)}</small>` : ''}</div>${delta}${it.note ? `<div class="stat-note">${esc(it.note)}</div>` : ''}</div>`;
  }).join('')}</div>`;
}

export function renderChart(src) {
  let spec;
  try { spec = parseSpec(src); } catch (e) {
    return `<pre class="code chart-error"><code>chart: ${esc(e.message)}\n\n${esc(src)}</code></pre>`;
  }
  const body = spec.type === 'stats' ? stats(spec) : spec.type === 'hbar' ? hbar(spec) : spec.type === 'line' ? line(spec) : bar(spec);
  const head = spec.title || spec.subtitle
    ? `<figcaption>${spec.title ? `<span class="chart-title">${esc(spec.title)}</span>` : ''}${spec.subtitle ? `<span class="chart-sub">${esc(spec.subtitle)}</span>` : ''}</figcaption>` : '';
  return `<figure class="chart chart-${esc(spec.type)}">${spec.type === 'stats' ? '' : head}${body}${legend(spec.type === 'stats' ? [] : spec.series)}</figure>`;
}

// One tooltip for the whole page; marks carry their tooltip HTML in data-tip.
export function bindChartHover(root) {
  const tip = document.createElement('div');
  tip.className = 'tip';
  document.body.appendChild(tip);
  root.addEventListener('pointerover', (e) => {
    const hit = e.target.closest?.('[data-tip]');
    if (!hit) return;
    tip.innerHTML = hit.dataset.tip;
    tip.classList.add('on');
    const guide = hit.closest('svg')?.querySelector('.guide');
    if (guide && hit.dataset.gx) { guide.setAttribute('x1', hit.dataset.gx); guide.setAttribute('x2', hit.dataset.gx); guide.classList.add('on'); }
    hit.closest('figure')?.classList.add('hovering');
    hit.classList.add('on');
  });
  root.addEventListener('pointermove', (e) => {
    if (!tip.classList.contains('on')) return;
    const r = tip.getBoundingClientRect();
    const left = Math.min(innerWidth - r.width - 8, e.clientX + 14);
    const top = e.clientY - r.height - 12 < 8 ? e.clientY + 16 : e.clientY - r.height - 12;
    tip.style.transform = `translate(${left}px, ${top}px)`;
  });
  root.addEventListener('pointerout', (e) => {
    const hit = e.target.closest?.('[data-tip]');
    if (!hit) return;
    tip.classList.remove('on');
    hit.classList.remove('on');
    hit.closest('figure')?.classList.remove('hovering');
    hit.closest('svg')?.querySelector('.guide')?.classList.remove('on');
  });
}
