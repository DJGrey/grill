# Grill file format

The grill file is `.context/<slug>/grill.md`. You (the agent) write it. The grill UI renders it live, and your saves show up in my browser within a moment. I never edit the file. My answers and notes go to a separate state folder that the server owns.

See [example.md](example.md) for a complete file.

## Layout

```
---                         frontmatter: title, slug, summary, status, updated
brief                       anything before the first `## `
## What I found             reserved: findings and replies to my notes
## Q1. Question? {#id}      one section per question, in the order I should answer them
## Q2. ...
## Parked                   reserved: ideas for later, with your best guess
## Decisions so far         reserved: the decision log, one D line per decision
```

Sections are identified by heading, so their order in the file doesn't matter. Keep to the order above so the file reads well for anyone (or any agent) who reads it later.

## Frontmatter

| Key | Meaning |
|---|---|
| `title` | Shown at the top of the sidebar. |
| `slug` | Shown under the title. |
| `summary` | One line under the title. |
| `status` | `active`, or `done` to end the session. The UI shows the decision log on a done card once nothing is queued. |
| `updated` | Date of the last edit. For later readers. |

## Brief

Everything between the frontmatter and the first `## ` heading. The UI shows it in a "Brief" disclosure in the sidebar. It can hold markdown and a small Mermaid diagram of the plan.

## Questions

````markdown
## Q4. Where should invoices be generated? {#invoice-gen}
tag: Architecture
depends: owner

Context: markdown, tables, ```chart, ```mermaid, callouts.

### Options
- ★ **Async worker.** Takes invoicing off the request path. Recommended because ...
- **Keep inline.** No new moving parts, but the PDF render alone is ~180ms.

Optional muted note shown under the options.
````

| Part | Rule |
|---|---|
| `## Q<n>. Title {#id}` | One question. `Q<n>.` is stripped for display. Always set `{#id}`, because answers and D lines are keyed by it. |
| Meta lines | Optional, directly under the heading: `tag:`, `depends:`, `status:`, `multi:`. No other keys are read as meta. |
| `tag:` | A short category chip on the card. |
| `depends:` | Comma-separated ids. The card shows "Builds on …" with their titles. |
| `status: skipped` | Hides a queued question that an answer made moot. Never delete questions. |
| `multi: true` | Checkboxes instead of a single choice. You can star several options. |
| Context | Everything between the meta lines and `### Options`. |
| `### Options` | A list. Each item is `**Label.** Description.` Indented lines continue the description. `**Label** — description` also parses. |
| ★ | Marks your recommendation. Enter on an empty answer box accepts it, so every question needs one. `⭐`, `(recommended)` and `[recommended]` also work. |

**What I can answer.** I can pick an option, or pick one and type a comment ("their words"), or type my own answer and pick nothing, or press Enter to accept the ★. I can also click a decided question in the sidebar to revise it. That arrives as a **revised** answer.

## Context blocks

All standard markdown works: paragraphs, bold, code, links, lists, task lists, tables, block quotes, fenced code and `---`.

**Callouts**

```markdown
> [!WARNING] Annual plans renew on the 1st
> 9,800 subscriptions renew on Jan 1.
```

Kinds are `NOTE`, `TIP`, `IMPORTANT`, `WARNING` and `CAUTION` (or `RISK`).

**Diagrams.** A ` ```mermaid ` fence. Mermaid loads from a CDN on first use. If the machine is offline, the source is shown instead.

**Charts.** A ` ```chart ` fence containing JSON. Trailing commas are fine.

| `type` | Use for | Data |
|---|---|---|
| `bar` | Comparing a few values. Grouped bars for 2+ series. | `data`, or `x` + `series` |
| `hbar` | Comparing options with long labels | `data`, or `x` + `series` |
| `line` | Change over time | `x` + `series` |
| `stats` | 2 to 4 headline numbers | `items` |

```json
{
  "type": "line",
  "title": "Failed invoices per week",
  "subtitle": "optional",
  "unit": "ms",
  "x": ["W1", "W2", "W3"],
  "series": [
    { "name": "Card declined", "values": [210, 190, 230] },
    { "name": "Tax error", "values": [12, 8, 15] }
  ]
}
```

- `data: { "A": 1, "B": 2 }` is shorthand for one series.
- `highlight: "B"` (on `bar` and `hbar` with one series) colours that bar and greys out the rest. Use it to point at the option you recommend.
- `stats` items are `{ "label", "value", "unit"?, "delta"?, "good": "up" | "down", "note"? }`. `delta` is a number or a string like `"+38% QoQ"`. `good` decides whether a rise shows green or red.
- One unit per chart. Two measures with different scales get two charts, never a second axis.

## What I found

```markdown
## What I found

- Invoices are rendered by `InvoicePdf#render`, which takes 180ms at p95.
- You asked whether SQS supports FIFO per customer. It does, with message groups.
```

Shown at the top of my Notes panel as "From the agent", and it flashes when it changes. Rewrite it freely. Keep it to what matters for the questions that are still open.

## Parked

```markdown
## Parked

- Bulk export of invoices. My guess is a separate feature after launch.
```

Shown at the bottom of the sidebar.

## Decisions so far

```markdown
## Decisions so far

- D1. Call the feature `billing-extraction`. {#slug}
- D2. The new billing squad owns the service. ("only after Maya signs off staffing") {#owner}
- D3. Card-declined failures go to the daily digest, not the pager.
```

- One line per decision, numbered in the order they were made. A revision keeps its number.
- Put my exact words in quotes and brackets whenever I typed more than picking your option.
- End with `{#question-id}` when it answers a question. The sidebar then shows the D line under that question in place of my raw answer. Lines without an id came from notes and show under "Also decided".

## State the server owns

`.context/<slug>/.grill.state/` sits next to the file and is never written by you.

| File | Holds |
|---|---|
| `events.jsonl` | Answers and notes, in order. The latest answer to a question wins. |
| `cursor` | The last event `wait` handed to you. |
| `listening.json` | Exists while a `wait` is running. The UI shows "Agent listening" then. |
| `server.json` | The running server's pid, port and url. |
| `server.log` | The server's errors. Look here if the UI keeps dropping. |

An answer event looks like this. With `multi: true`, `choices: [...]` replaces `choice`.

```json
{"seq":3,"type":"answer","id":"invoice-gen","choice":"Async worker","custom":"use SQS","revision":false,"at":"…"}
```
