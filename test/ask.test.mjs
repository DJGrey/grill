// Run with: node --test test/*.test.mjs
// Covers asking the agent from a card: the parser, the /api/ask endpoint, and what `wait` and
// `status` tell the agent.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseGrill } from '../skills/grill-ui/scripts/web/parse.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GRILL = path.join(ROOT, 'skills/grill-ui/scripts/grill.mjs');
const EXAMPLE = path.join(ROOT, 'skills/grill-ui/references/example.md');
const env = { ...process.env, GRILL_NO_BROWSER: '1', GRILL_NO_PREVIEW: '1' };
const run = (...args) => execFileSync(process.execPath, [GRILL, ...args], { encoding: 'utf8', env });

test('parser reads `## Answers` into replies keyed by ask number', () => {
  const doc = parseGrill([
    '## Q1. Pick one? {#pick}', '', '### Options', '- ★ **A.** Yes.',
    '## Answers', '', 'Ignored intro.', '',
    '### A1', 'First answer.', '',
    '### A3 about the pager', '```md', '### A9 inside a fence is not a heading', '```',
    '### A4', '',
    '## Decisions so far', '- D1. Took A. {#pick}',
  ].join('\n'));
  assert.equal(doc.questions.length, 1, 'Answers is not a question');
  assert.equal(doc.replies[1], 'First answer.');
  assert.match(doc.replies[3], /A9 inside a fence/);
  assert.equal(doc.replies[9], undefined);
  assert.equal(doc.replies[4], undefined, 'empty blocks are not answers yet');
  assert.equal(doc.decisions.length, 1);
});

test('parser gives an empty replies map when there is no Answers section', () => {
  assert.deepEqual(parseGrill(fs.readFileSync(EXAMPLE, 'utf8')).replies, {});
});

let dir, file, url;
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grill-test-'));
  file = path.join(dir, 'grill.md');
  fs.copyFileSync(EXAMPLE, file);
  url = run('open', file, '--no-open').match(/Grill UI: (\S+)/)[1];
});
after(() => {
  try { run('stop', file); } catch {}
  fs.rmSync(dir, { recursive: true, force: true });
});

const post = (p, body) => fetch(new URL(p, url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('asks get their own numbers, repeats are ignored, empty ones are turned down', async () => {
  const a1 = await (await post('api/ask', { cid: 'c1', id: 'owner', text: '  How big is the billing squad?  ' })).json();
  assert.equal(a1.type, 'ask');
  assert.equal(a1.n, 1);
  assert.equal(a1.id, 'owner');
  assert.equal(a1.text, 'How big is the billing squad?');

  await post('api/note', { cid: 'c2', text: 'A note in between.' });
  const again = await (await post('api/ask', { cid: 'c1', id: 'owner', text: 'How big is the billing squad?' })).json();
  assert.equal(again.seq, a1.seq, 'the same cid is the same ask');
  const a2 = await (await post('api/ask', { cid: 'c3', id: 'paging', text: 'What pages today?' })).json();
  assert.equal(a2.n, 2, 'notes do not use up ask numbers');

  const empty = await post('api/ask', { cid: 'c4', id: 'owner', text: '   ' });
  assert.equal(empty.status, 400);
  assert.equal((await empty.json()).grill, 'rejected');
});

test('wait hands asks to the agent and says to answer them first', () => {
  const out = run('wait', file, '--timeout', '5');
  assert.match(out, /### Asked A1, on "Who owns the billing service after extraction\?"  `#owner`/);
  assert.match(out, /> How big is the billing squad\?/);
  assert.match(out, /### Note\nA note in between\./);
  assert.match(out, /### Asked A2, on "Which invoice failures should page someone\?"/);
  assert.match(out, /\*\*Answer these first\*\* under `## Answers` \(one `### A<n>` block each\): A1, A2\./);
});

test('status lists unanswered asks until the agent answers them', () => {
  assert.match(run('status', file), /Unanswered questions from the user: A1, A2/);
  fs.appendFileSync(file, '\n## Answers\n\n### A1\nFour people.\n');
  assert.match(run('status', file), /Unanswered questions from the user: A2$/m);
  fs.appendFileSync(file, '\n### A2\nOnly card declines over 5%.\n');
  assert.doesNotMatch(run('status', file), /Unanswered/);
});

test('the stream carries the answers to the page', async () => {
  const res = await fetch(new URL('api/stream', url));
  const reader = res.body.getReader();
  let buf = '';
  while (!buf.includes('\n\ndata: {') || !buf.slice(buf.indexOf('data: {')).includes('\n\n')) buf += new TextDecoder().decode((await reader.read()).value);
  await reader.cancel();
  const snap = JSON.parse(buf.slice(buf.indexOf('data: {') + 6).split('\n\n')[0]);
  assert.deepEqual(parseGrill(snap.src).replies, { 1: 'Four people.', 2: 'Only card declines over 5%.' });
  assert.equal(snap.events.filter((e) => e.type === 'ask').length, 2);
});
