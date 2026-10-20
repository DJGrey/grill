// Parser for grill files. Shared by the browser UI and the Node CLI.
// See ../../references/format.md for the format this understands.

const META_KEYS = new Set(['id', 'tag', 'depends', 'status', 'multi']);
const OPTIONS_HEADING = /^###\s+(options|choices)\s*$/i;
const RECOMMENDED = /(★|⭐|\((?:recommended|rec)\)|\[(?:recommended|rec)\])/i;
const RESERVED = [
  ['found', /^what i found\b/i],
  ['parked', /^parked\b/i],
  ['decisions', /^decisions\b/i],
];

export function slugify(s) {
  return s.toLowerCase().replace(/[`*_~]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'q';
}

function parseFrontmatter(lines) {
  const meta = {};
  if (lines[0]?.trim() !== '---') return { meta, rest: lines };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) return { meta, rest: lines };
  for (const line of lines.slice(1, end)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) meta[m[1].toLowerCase()] = m[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
  }
  return { meta, rest: lines.slice(end + 1) };
}

// Split into sections on `## ` headings, ignoring anything inside code fences.
function splitSections(lines) {
  const sections = [];
  const preamble = [];
  let cur = null;
  let fence = null;
  for (const line of lines) {
    const f = line.match(/^\s*(```+|~~~+)/);
    if (f) fence = fence ? (line.trim().startsWith(fence) ? null : fence) : f[1];
    if (!fence && /^##\s+/.test(line)) {
      cur = { heading: line.replace(/^##\s+/, '').trim(), lines: [] };
      sections.push(cur);
    } else if (cur) cur.lines.push(line);
    else preamble.push(line);
  }
  return { preamble, sections };
}

// Top-level list items, with indented continuation lines folded in.
function listItems(lines) {
  const items = [];
  for (const line of lines) {
    const m = line.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (m) items.push(m[1]);
    else if (items.length && /^\s{2,}\S/.test(line)) items[items.length - 1] += `\n${line.trim()}`;
  }
  return items;
}

function parseOption(text) {
  let t = text.trim();
  const recommended = RECOMMENDED.test(t);
  t = t.replace(RECOMMENDED, '').replace(/\s{2,}/g, ' ').trim();
  let label, description = '';
  const bold = t.match(/^\*\*(.+?)\*\*\s*(?:[—–:-]\s*)?([\s\S]*)$/);
  if (bold) [, label, description] = bold;
  else {
    const split = t.match(/^(.+?)\s+[—–]\s+([\s\S]*)$/) || t.match(/^(.+?)\s+-\s+([\s\S]*)$/) || t.match(/^(.+?[.!?])\s+([\s\S]*)$/);
    if (split) [, label, description] = split;
    else label = t;
  }
  return { label: label.trim().replace(/[.:]$/, ''), description: description.trim(), recommended };
}

function parseOptions(lines) {
  const options = [];
  const notes = [];
  let cur = null;
  let ended = false; // prose after the list closes it
  for (const line of lines) {
    const item = line.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (item && !ended) {
      cur = { raw: [item[1]] };
      options.push(cur);
    } else if (cur && !ended && /^\s{2,}\S/.test(line)) {
      cur.raw.push(line.trim()); // indented continuation of the current option
    } else if (line.trim() === '') {
      if (notes.length) notes.push(line);
    } else {
      if (options.length) ended = true;
      notes.push(line);
    }
  }
  return {
    options: options.map((o) => parseOption(o.raw.join('\n'))),
    optionsNote: notes.join('\n').trim(),
  };
}

function parseQuestion(section, index, seen) {
  let heading = section.heading;
  let id;
  const idMatch = heading.match(/\s*\{#([\w-]+)\}\s*$/);
  if (idMatch) { id = idMatch[1]; heading = heading.slice(0, idMatch.index).trim(); }
  const num = heading.match(/^Q(\d+)[:.)]\s*/i);
  const title = heading.replace(/^Q\d+[:.)]\s*/i, '').trim();

  const lines = [...section.lines];
  const meta = {};
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length) {
    const m = lines[0].match(/^([\w-]+):\s*(.*)$/);
    if (!m || !META_KEYS.has(m[1].toLowerCase())) break;
    meta[m[1].toLowerCase()] = m[2].trim();
    lines.shift();
  }

  const optIdx = lines.findIndex((l) => OPTIONS_HEADING.test(l.trim()));
  const contextLines = optIdx >= 0 ? lines.slice(0, optIdx) : lines;
  const { options, optionsNote } = optIdx >= 0 ? parseOptions(lines.slice(optIdx + 1)) : { options: [], optionsNote: '' };

  id = meta.id || id || slugify(title);
  let unique = id, n = 2;
  while (seen.has(unique)) unique = `${id}-${n++}`;
  seen.add(unique);

  return {
    id: unique,
    index,
    number: num ? Number(num[1]) : null,
    title,
    tag: meta.tag || '',
    depends: meta.depends ? meta.depends.split(/[,\s]+/).map((d) => d.replace(/^#/, '')).filter(Boolean) : [],
    status: (meta.status || 'open').toLowerCase(),
    multi: /^(true|yes|1)$/i.test(meta.multi || ''),
    context: contextLines.join('\n').trim(),
    options,
    optionsNote,
  };
}

// `- D3. The decision. ("your words") {#question-id}`
function parseDecision(text) {
  let t = text.trim();
  let id = null;
  const idMatch = t.match(/\s*\{#([\w-]+)\}\s*$/);
  if (idMatch) { id = idMatch[1]; t = t.slice(0, idMatch.index).trim(); }
  const d = t.match(/^D(\d+)[.:)]?\s+([\s\S]*)$/i);
  return { n: d ? Number(d[1]) : null, text: (d ? d[2] : t).trim(), id };
}

export function parseGrill(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const { meta, rest } = parseFrontmatter(lines);
  const { preamble, sections } = splitSections(rest);
  let intro = preamble.join('\n').trim();
  const h1 = intro.match(/^#\s+(.+)$/m);
  if (h1 && !meta.title) meta.title = h1[1].replace(/^Grill[.:]\s*/i, '').trim();
  if (h1) intro = intro.replace(h1[0], '').trim();

  const seen = new Set();
  const questions = [];
  const reserved = { found: '', parked: [], decisions: [] };
  for (const s of sections) {
    const kind = RESERVED.find(([, re]) => re.test(s.heading))?.[0];
    const body = s.lines.join('\n').trim();
    if (kind === 'found') reserved.found = body;
    else if (kind === 'parked') reserved.parked = listItems(s.lines).filter((t) => !/^nothing\.?$/i.test(t.trim()));
    else if (kind === 'decisions') reserved.decisions = listItems(s.lines).map(parseDecision);
    else questions.push(parseQuestion(s, questions.length, seen));
  }

  return {
    title: meta.title || 'Grill',
    slug: meta.slug || '',
    summary: meta.summary || '',
    status: (meta.status || 'active').toLowerCase(),
    intro,
    questions,
    ...reserved,
  };
}
