// Small markdown renderer: just what question context needs.
// Fenced ```chart and ```mermaid blocks are handed to the chart / diagram renderers.

import { renderChart } from './chart.mjs';

export const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function inline(src) {
  const codes = [];
  let s = esc(src).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?!\s)(.+?)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => /^(https?:|mailto:|#|\/)/.test(href.replace(/&amp;/g, '&'))
      ? `<a href="${href}" target="_blank" rel="noopener">${t}</a>` : t)
    .replace(/(^|\s)(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

const CALLOUTS = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'important', WARNING: 'warning', CAUTION: 'caution', RISK: 'caution' };

export function markdown(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const isBlockStart = (l) => /^(\s*(```|~~~)|#{1,6}\s|>|\s*([-*+]|\d+[.)])\s|\s*(---|\*\*\*)\s*$|\|)/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    const fence = line.match(/^\s*(```+|~~~+)\s*([\w-]*)\s*(.*)$/);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      const lang = fence[2].toLowerCase();
      const code = body.join('\n');
      if (lang === 'chart') out.push(renderChart(code));
      else if (lang === 'mermaid') out.push(`<figure class="diagram"><pre class="mermaid">${esc(code)}</pre></figure>`);
      else out.push(`<pre class="code"${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(code)}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(6, Math.max(3, h[1].length + 1)); // keep context headings below the card title
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    if (line.startsWith('>')) {
      const body = [];
      while (i < lines.length && lines[i].startsWith('>')) body.push(lines[i++].replace(/^>\s?/, ''));
      const c = body[0]?.match(/^\[!(\w+)\]\s*(.*)$/);
      if (c && CALLOUTS[c[1].toUpperCase()]) {
        const kind = CALLOUTS[c[1].toUpperCase()];
        const title = c[2] || c[1][0] + c[1].slice(1).toLowerCase();
        out.push(`<aside class="callout ${kind}"><div class="callout-title">${inline(title)}</div>${markdown(body.slice(1).join('\n'))}</aside>`);
      } else out.push(`<blockquote>${markdown(body.join('\n'))}</blockquote>`);
      continue;
    }

    if (line.trim().startsWith('|') && lines[i + 1]?.match(/^\s*\|?\s*:?-{2,}/)) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) => (c.endsWith(':') ? (c.startsWith(':') ? 'center' : 'right') : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      const td = (tag, c, j) => `<${tag}${align[j] ? ` style="text-align:${align[j]}"` : ''}>${inline(c)}</${tag}>`;
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c, j) => td('th', c, j)).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, j) => td('td', c, j)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[2]);
      const base = li[1].length;
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (m && m[1].length === base) { items.push([m[3]]); i++; continue; }
        if (lines[i].trim() && (/^\s+/.test(lines[i]) && lines[i].match(/^\s*/)[0].length > base)) { items.at(-1).push(lines[i].slice(base + 2)); i++; continue; }
        if (!lines[i].trim() && lines[i + 1]?.match(/^(\s*)([-*+]|\d+[.)])\s+/)?.[1].length >= base) { i++; continue; }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map(([first, ...more]) => {
        const task = first.match(/^\[([ xX])\]\s+(.*)$/);
        const head = task ? `<span class="task ${task[1] === ' ' ? '' : 'done'}"></span>${inline(task[2])}` : inline(first);
        return `<li>${head}${more.length ? markdown(more.join('\n')) : ''}</li>`;
      }).join('')}</${tag}>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i]))) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

// Mermaid is loaded lazily, only when a diagram is on screen.
let mermaidReady;
export async function hydrateDiagrams(root) {
  const nodes = [...root.querySelectorAll('pre.mermaid:not([data-done])')];
  if (!nodes.length) return;
  mermaidReady ||= import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then((m) => {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    m.default.initialize({
      startOnLoad: false,
      theme: 'base',
      fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      themeVariables: dark
        ? { background: 'transparent', primaryColor: '#232322', primaryBorderColor: '#3a3a38', primaryTextColor: '#f0efec', lineColor: '#6b6a66', fontSize: '13px' }
        : { background: 'transparent', primaryColor: '#f6f6f4', primaryBorderColor: '#dcdbd5', primaryTextColor: '#0b0b0b', lineColor: '#a3a29c', fontSize: '13px' },
    });
    return m.default;
  }).catch(() => null);
  const mermaid = await mermaidReady;
  for (const n of nodes) {
    n.dataset.done = '1';
    if (!mermaid) { n.classList.add('offline'); continue; }
    try {
      const { svg } = await mermaid.render(`m${Math.random().toString(36).slice(2)}`, n.textContent);
      n.outerHTML = `<div class="mermaid-svg">${svg}</div>`;
    } catch { n.classList.add('error'); }
  }
}
