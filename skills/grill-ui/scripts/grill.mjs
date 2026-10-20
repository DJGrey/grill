#!/usr/bin/env node
// grill: the browser UI for grill sessions. Zero dependencies, Node 18+.
//
//   node grill.mjs open    <grill.md>          start the UI (if needed) and open it in the browser
//   node grill.mjs wait    <grill.md>          block until the user answers or adds a note, print it
//   node grill.mjs status  <grill.md>          list decided / queued questions
//   node grill.mjs summary <grill.md>          print the decision log
//   node grill.mjs move    <grill.md> <new.md> move the file (and its state) without breaking the open UI
//   node grill.mjs stop    <grill.md>          stop the UI server
//   node grill.mjs serve   <grill.md>          run the server in the foreground
//
// The agent owns <grill.md>. The server owns the sidecar state dir (.<name>.state/),
// so the two never write the same file.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseGrill } from './web/parse.mjs';

const SELF = fileURLToPath(import.meta.url);
const WEB = path.join(path.dirname(SELF), 'web');

const [cmd, fileArg, ...rest] = process.argv.slice(2);
const positional = rest.filter((a) => !a.startsWith('--'));
const flags = parseFlags(rest);

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const m = args[i].match(/^--([\w-]+)(?:=(.*))?$/);
    if (!m) continue;
    if (m[2] !== undefined) out[m[1]] = m[2];
    else if (args[i + 1] && !args[i + 1].startsWith('--')) out[m[1]] = args[++i];
    else out[m[1]] = true;
  }
  return out;
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (!cmd || !fileArg || cmd === 'help' || cmd === '--help') {
  die(fs.readFileSync(SELF, 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}

// Paths are mutable so a running server can follow a `move`.
let FILE, STATE, P;
function setFile(f) {
  FILE = path.resolve(f);
  STATE = path.join(path.dirname(FILE), `.${path.basename(FILE, '.md')}.state`);
  P = {
    events: path.join(STATE, 'events.jsonl'),
    cursor: path.join(STATE, 'cursor'),
    listening: path.join(STATE, 'listening.json'),
    server: path.join(STATE, 'server.json'),
    log: path.join(STATE, 'server.log'),
    port: path.join(STATE, 'port'), // kept after shutdown, so a restart reuses it and open tabs reconnect
  };
}
setFile(fileArg);

// ── state helpers ──────────────────────────────────────────────────────────

const read = (p, fallback = '') => { try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; } };
const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

function readEvents() {
  return read(P.events).split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}
const readCursor = () => Number(read(P.cursor, '0').trim()) || 0;
function isListening() {
  const l = readJSON(P.listening);
  return !!(l && alive(l.pid));
}
function readDoc() {
  if (!fs.existsSync(FILE)) die(`No grill file at ${FILE}. Write it first.`);
  return parseGrill(read(FILE));
}

function latestAnswers(events) {
  const m = new Map();
  for (const e of events) if (e.type === 'answer') m.set(e.id, e);
  return m;
}
const active = (doc) => doc.questions.filter((q) => q.status !== 'skipped');
const queued = (doc, answers) => active(doc).filter((q) => !answers.has(q.id));
const picksOf = (a) => (a.choices?.length ? a.choices : a.choice ? [a.choice] : []);

// ── formatting for the agent ───────────────────────────────────────────────

function formatAnswer(e, doc) {
  const q = doc.questions.find((x) => x.id === e.id);
  const title = q?.title || e.title || e.id;
  const lines = [`### ${e.revision ? 'Revised' : 'Answered'}: ${title}  \`#${e.id}\``];
  const picks = picksOf(e);
  const recs = q?.options.filter((o) => o.recommended).map((o) => o.label) || [];
  if (picks.length) {
    lines.push(`**Choice:** ${picks.map((p) => (recs.includes(p) ? `${p} (your ★ recommendation)` : p)).join(', ')}`);
    const rejected = recs.filter((r) => !picks.includes(r));
    if (rejected.length) lines.push(`_Did not take your recommendation (${rejected.join(', ')})._`);
  }
  if (e.custom) lines.push(picks.length ? `**Their words:** "${e.custom}"` : `**Custom answer:** "${e.custom}"`);
  if (e.revision) lines.push('_This changes an earlier decision. Update its D line and re-check anything that depends on it._');
  return lines.join('\n');
}

function formatNote(e, doc) {
  const q = e.during && doc.questions.find((x) => x.id === e.during);
  return `### Note${q ? ` (written while on "${q.title}")` : ''}\n${e.text}`;
}

function formatState(doc, answers) {
  const out = [];
  const logged = new Set(doc.decisions.map((d) => d.id).filter(Boolean));
  const unlogged = [...answers.keys()].filter((id) => !logged.has(id) && doc.questions.some((q) => q.id === id));
  if (unlogged.length) out.push(`Log these in "Decisions so far" (one D line each, ending in {#id}): ${unlogged.map((id) => `\`#${id}\``).join(', ')}.`);
  if (doc.status === 'done') out.push('Session is marked `status: done`.');
  else {
    const q = queued(doc, answers);
    if (!q.length) out.push('**Frontier empty in the UI. The user is waiting on you.** Write the next questions now, or set `status: done` if the tree is resolved and nothing is parked.');
    else out.push(`Still queued in the UI: ${q.map((x) => `\`#${x.id}\``).join(', ')}. Don't change these. Mark one \`status: skipped\` only if this input made it moot.`);
  }
  return out.join('\n\n');
}

function summary(doc, answers) {
  const out = [`# ${doc.title}. Decisions`, ''];
  if (doc.decisions.length) out.push(...doc.decisions.map((d) => `- ${d.n ? `D${d.n}. ` : ''}${d.text}`));
  else {
    for (const q of active(doc)) {
      const a = answers.get(q.id);
      const answer = !a ? '_open_' : [picksOf(a).join(', '), a.custom && `("${a.custom}")`].filter(Boolean).join(' ');
      out.push(`- ${q.title} ${answer}`);
    }
  }
  if (doc.parked.length) out.push('', '## Parked', '', ...doc.parked.map((p) => `- ${p.replace(/\n/g, ' ')}`));
  return out.join('\n');
}

// ── commands ───────────────────────────────────────────────────────────────

const commands = { serve, open: openCmd, wait, status, summary: summaryCmd, move, stop };
if (!commands[cmd]) die(`Unknown command "${cmd}". Try: open | wait | status | summary | move | stop | serve`);
commands[cmd]();

function summaryCmd() {
  console.log(summary(readDoc(), latestAnswers(readEvents())));
}

function status() {
  const doc = readDoc();
  const answers = latestAnswers(readEvents());
  const srv = readJSON(P.server);
  console.log(`${doc.title}: ${answers.size}/${active(doc).length} answered, ${doc.decisions.length} decisions logged, ${doc.parked.length} parked`);
  console.log(srv && alive(srv.pid) ? `UI: ${srv.url}` : 'UI: not running (use `open`)');
  for (const q of doc.questions) {
    const mark = q.status === 'skipped' ? '–' : answers.has(q.id) ? '✓' : '○';
    console.log(`  ${mark} #${q.id}  ${q.title}`);
  }
  console.log(`Undelivered events: ${readEvents().filter((e) => e.seq > readCursor()).length}`);
}

async function wait() {
  readDoc();
  fs.mkdirSync(STATE, { recursive: true });
  // The UI should always be up while grilling. Bring it back if it died or was never opened.
  let srv = await ensureServer({ openBrowser: true });

  const timeout = Number(flags.timeout ?? 540) * 1000;
  const started = Date.now();
  fs.writeFileSync(P.listening, JSON.stringify({ pid: process.pid, since: new Date().toISOString() }));
  const cleanup = () => { try { if (readJSON(P.listening)?.pid === process.pid) fs.unlinkSync(P.listening); } catch {} };
  process.on('exit', cleanup);
  for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => process.exit(130));

  const fresh = () => readEvents().filter((e) => e.seq > readCursor());
  let pending = fresh();
  let ticks = 0;
  while (!pending.length) {
    if (timeout && Date.now() - started > timeout) {
      console.log('No input yet (timed out). Run `wait` again to keep listening.');
      return;
    }
    await sleep(200);
    // Watchdog. If the server died while we wait, bring it back on the same port so the open page reconnects.
    if (++ticks % 15 === 0 && !(alive(srv.pid) && (await ping(srv.url)))) {
      srv = await ensureServer({ openBrowser: false });
      console.log(`(The grill UI had stopped. Restarted it at ${srv.link})\n`);
    }
    pending = fresh();
  }
  // Small debounce so an answer and a note sent together arrive as one batch.
  await sleep(700);
  pending = fresh();

  const doc = readDoc();
  const answers = latestAnswers(readEvents());
  const blocks = pending.map((e) => (e.type === 'note' ? formatNote(e, doc) : formatAnswer(e, doc)));
  console.log([...blocks, '---', formatState(doc, answers)].join('\n\n'));
  fs.writeFileSync(P.cursor, String(pending.at(-1).seq));
}

async function openCmd() {
  readDoc();
  const srv = await ensureServer({ openBrowser: false });
  if (!flags['no-open']) openBrowser(srv.url);
  const share = await sharePreview(srv.port);
  const url = share?.url || srv.url;
  if (share?.busy) console.log(`The workspace preview URL shows port ${share.busy.port}, so the grill isn't on it. Run \`conductor preview set --port ${srv.port}\` to show it there.`);
  console.log(`Grill UI: ${url}\nNext: write questions into ${path.relative(process.cwd(), FILE)}, then run \`node ${SELF} wait ${path.relative(process.cwd(), FILE)}\`.`);
}

async function move() {
  const to = positional[0];
  if (!to) die('Usage: grill.mjs move <grill.md> <new grill.md>');
  const from = { file: FILE, state: STATE };
  const srv = readJSON(P.server);
  setFile(to);
  if (fs.existsSync(FILE)) die(`${FILE} already exists.`);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.renameSync(from.file, FILE);
  if (fs.existsSync(from.state)) fs.renameSync(from.state, STATE);
  try { fs.rmdirSync(path.dirname(from.file)); } catch {} // drop the old folder if it's now empty
  if (srv && alive(srv.pid)) await post(`${srv.url}api/move`, { file: FILE });
  console.log(`Moved to ${FILE}${srv && alive(srv.pid) ? '. The open UI follows it.' : ''}`);
}

function stop() {
  const srv = readJSON(P.server);
  if (!srv || !alive(srv.pid)) { console.log('UI is not running.'); return; }
  process.kill(srv.pid, 'SIGTERM');
  console.log('Stopped.');
}

async function ensureServer({ openBrowser: openIt }) {
  let srv = readJSON(P.server);
  if (srv && alive(srv.pid) && (await ping(srv.url))) return srv;
  fs.mkdirSync(STATE, { recursive: true });
  const args = [SELF, 'serve', FILE, '--no-open'];
  const port = flags.port || read(P.port).trim();
  if (port) args.push('--port', String(port));
  // Log to a file so a crash leaves a trace.
  const log = fs.openSync(P.log, 'a');
  const child = spawn(process.execPath, args, { detached: true, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  child.unref();
  for (let i = 0; i < 50; i++) {
    await sleep(100);
    srv = readJSON(P.server);
    if (srv && srv.pid === child.pid && (await ping(srv.url))) break;
  }
  if (!srv || srv.pid !== child.pid) die(`The grill UI server failed to start. See ${P.log}.`);
  // A restart can land on a new port if the old one was taken, so re-point the preview URL.
  const share = await sharePreview(srv.port);
  srv.link = share?.url || srv.url;
  if (openIt) {
    openBrowser(srv.url);
    console.log(`(Started the grill UI at ${srv.link})\n`);
  }
  return srv;
}

function serve() {
  readDoc();
  fs.mkdirSync(STATE, { recursive: true });
  const clients = new Set();
  // One bad request or file read shouldn't take the UI down. Log it and keep serving.
  const logErr = (what, err) => console.error(`${new Date().toISOString()} ${what}:`, err?.stack || err);
  process.on('uncaughtException', (err) => logErr('uncaught', err));
  process.on('unhandledRejection', (err) => logErr('unhandled rejection', err));

  const snapshot = () => JSON.stringify({
    src: read(FILE),
    events: readEvents(),
    delivered: readCursor(),
    listening: isListening(),
  });
  let last = '';
  const broadcast = () => {
    const s = snapshot();
    if (s === last) return;
    last = s;
    for (const res of clients) res.write(`data: ${s}\n\n`);
  };
  const tryBroadcast = () => { try { broadcast(); } catch (err) { logErr('broadcast', err); } };

  // fs.watch is fast but flaky across editors (atomic renames), so poll as a backstop.
  const watchers = [];
  const watch = () => {
    while (watchers.length) watchers.pop().close();
    for (const dir of [path.dirname(FILE), STATE]) {
      try {
        const w = fs.watch(dir, tryBroadcast);
        w.on('error', () => w.close()); // e.g. the folder moved. The poll below still covers it.
        watchers.push(w);
      } catch {}
    }
  };
  watch();
  setInterval(tryBroadcast, 400);
  // A named event, not a comment, so the page can tell a live connection from a silently dead one.
  setInterval(() => { for (const res of clients) res.write(`event: ping\ndata: ${Date.now()}\n\n`); }, 10000);

  const append = (event) => {
    const events = readEvents();
    // The page retries until it hears back, so the same event can arrive twice.
    const dup = event.cid && events.find((e) => e.cid === event.cid);
    if (dup) return dup;
    const seq = (events.at(-1)?.seq || 0) + 1;
    const e = { seq, at: new Date().toISOString(), ...event };
    fs.appendFileSync(P.events, JSON.stringify(e) + '\n');
    broadcast();
    return e;
  };

  const writeServerFile = (port) => {
    const url = `http://127.0.0.1:${port}/`;
    fs.writeFileSync(P.server, JSON.stringify({ pid: process.pid, port, url }));
    fs.writeFileSync(P.port, String(port));
    return url;
  };

  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      logErr(`${req.method} ${req.url}`, err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/api/stream') {
      // Headers that stop proxies (like Conductor's preview URL) from buffering or compressing the stream.
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      req.socket.setKeepAlive(true);
      req.socket.setNoDelay(true);
      // Padding pushes the first bytes past proxy buffers. retry tells the browser to come back fast.
      res.write(`:${' '.repeat(2048)}\nretry: 1000\n\ndata: ${snapshot()}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      res.on('error', () => clients.delete(res));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ grill: true, file: FILE, pid: process.pid }));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/fun') {
      // Which fun-mode scenes exist, so the page never asks for one that isn't there.
      const list = (dir) => { try { return fs.readdirSync(path.join(WEB, 'fun', dir)).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)); } catch { return []; } };
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ bg: list('bg'), game: list('game') }));
      return;
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      let body = '';
      for await (const chunk of req) body += chunk;
      // Rejections say they came from us. The preview proxy sends its own 4xx (like 401 when
      // its sign-in lapses), and the page must retry those, not drop the answer.
      const reject = (code, error) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify({ grill: 'rejected', error }));
      let data;
      try { data = JSON.parse(body); } catch { reject(400, 'bad json'); return; }
      let out;
      if (url.pathname === '/api/note') {
        out = append({ type: 'note', cid: data.cid, text: String(data.text || '').trim(), during: data.during || null });
      } else if (url.pathname === '/api/answer') {
        out = append({
          type: 'answer',
          cid: data.cid,
          id: String(data.id),
          title: data.title,
          choice: data.choice ?? null,
          choices: Array.isArray(data.choices) ? data.choices : undefined,
          custom: String(data.custom || '').trim(),
          revision: !!data.revision,
        });
      } else if (url.pathname === '/api/move' && data.file) {
        setFile(data.file);
        watch();
        writeServerFile(server.address().port);
        broadcast();
        out = { ok: true };
      } else { reject(404, 'unknown endpoint'); return; }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
      return;
    }
    if (req.method === 'GET') {
      const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
      const p = path.join(WEB, path.normalize(rel));
      if (!p.startsWith(WEB)) { res.writeHead(403).end(); return; }
      fs.readFile(p, (err, buf) => {
        if (err) { res.writeHead(404).end('not found'); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(buf);
      });
      return;
    }
    res.writeHead(405).end();
  }

  // Prefer the requested port. If something else took it, any free port will do.
  server.once('error', (err) => {
    if (err.code !== 'EADDRINUSE' || !flags.port) throw err;
    server.listen(0, '127.0.0.1');
  });
  server.on('listening', () => {
    const url = writeServerFile(server.address().port);
    console.log(`Grill UI: ${url}`);
    if (!flags['no-open']) openBrowser(url);
  });
  server.listen(Number(flags.port) || 0, '127.0.0.1');
  const shutdown = () => { try { if (readJSON(P.server)?.pid === process.pid) fs.unlinkSync(P.server); } catch {} process.exit(0); };
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, shutdown);
  process.on('SIGHUP', () => {}); // outlive the terminal or agent shell that started us
  process.on('exit', () => { try { if (readJSON(P.server)?.pid === process.pid) fs.unlinkSync(P.server); } catch {} });
}

// ── misc ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function ping(url) {
  return probe(new URL('api/health', url)).then((r) => r.status === 200);
}

// Resolves { status, body } for any HTTP answer, or { status: 0 } if nothing is listening.
function probe(url, ms = 1500) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', () => resolve({ status: 0 }));
    req.setTimeout(ms, () => { req.destroy(); resolve({ status: 0 }); });
  });
}

function post(url, body) {
  return new Promise((resolve) => {
    const req = http.request(url, { method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', resolve);
    req.end(JSON.stringify(body));
  });
}

// No display means a cloud machine or a container. A browser opened here would be invisible.
const hasDisplay = () => process.platform !== 'linux' || !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

// On a headless Conductor cloud workspace, the user reaches the UI through the workspace's
// preview URL. Point it at the grill port, unless it's busy showing something else.
// Returns { url } when shared, { busy } when the preview shows another live server, or null.
async function sharePreview(port) {
  if (hasDisplay() || process.env.GRILL_NO_PREVIEW) return null;
  const conductor = (...args) => {
    try { return JSON.parse(execFileSync('conductor', [...args, '--json'], { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] })).preview; } catch { return undefined; }
  };
  const cur = conductor('preview', 'get');
  if (cur === undefined) return null; // no conductor CLI here
  if (cur?.port === port) return { url: cur.url };
  if (cur) {
    const r = await probe(`http://127.0.0.1:${cur.port}/api/health`);
    let other = r.status !== 0;
    try { if (JSON.parse(r.body).file === FILE) other = false; } catch {}
    if (other) return { busy: cur };
  }
  const set = conductor('preview', 'set', '--port', String(port));
  return set?.url ? { url: set.url } : null;
}

function openBrowser(url) {
  if (process.env.GRILL_NO_BROWSER || !hasDisplay()) return; // for tests and headless runs
  const [bin, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  execFile(bin, args, () => {});
}
