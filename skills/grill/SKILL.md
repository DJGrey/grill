---
name: grill
description: Interview the user relentlessly about a plan, design or feature until every branch of the decision tree is settled. Questions appear in a browser UI (one card at a time, with context, charts and a starred recommendation), not in chat. It ends with a decision log. Use when the user wants to stress-test a plan, get grilled on a design, or says "grill me".
---

# Grill

Interview me until we reach a shared understanding. Map the plan as a **design tree**. Every decision branches into the decisions that hang off it. Resolve them one by one in the grill UI, not in chat.

The UI is a local web page. I answer one card at a time. The decisions list is on the left, the current question is in the middle, and a Notes panel on the right lets me add context whenever I like. You write the questions into a markdown file. The page renders it live, and my answers come back to you through `wait`.

Write everything I read (questions, options, "What I found", the decision log and chat) in plain, direct language. Short sentences, everyday words, and a one-clause explanation for any term I might not know. No filler. Lead with what changes for the people who use the thing.

`GRILL` below means `node <this skill's folder>/scripts/grill.mjs`. Use the absolute path so the command matches the permission rule `install.sh` sets up. It needs Node 18 or newer and nothing else.

## Setup (once, at the start)

1. **Pick the slug.** Propose a short kebab-case slug from the topic (`bulk-invoice-approval`). Use it right away. Asking me to confirm it is the first question.
2. **Make the folder** `.context/<slug>/` at the repo root (`git rev-parse --show-toplevel`). If you're not in a git repo, use `.context/<slug>/` in the current directory.
3. **Keep it out of git.** Run `git check-ignore -q .context/x`. If that fails, append `.context/` to the file `git rev-parse --git-path info/exclude` prints. That's a local ignore list, so the repo's `.gitignore` stays untouched.
4. **Create the grill file** `.context/<slug>/grill.md` from [templates/grill-file.md](templates/grill-file.md). Fill in the frontmatter and the brief only. No questions yet.
5. **Open the UI straight away**, before any research: `GRILL open .context/<slug>/grill.md`. My browser shows the brief and a "Preparing the first question" card while you work. On a cloud machine with no screen (like a Conductor cloud workspace), `open` shares the UI at the workspace preview URL instead and prints that link. Post the link it prints, and mention once that the "fun" switch in the sidebar footer (⌘⇧F) turns on fun mode: silly backgrounds and little games, off by default.
6. Read [references/format.md](references/format.md) once for the full file format: options, charts, diagrams and callouts.

## The loop

1. **Find the facts first.** Finding facts is your job, never mine. If a question needs a fact from the codebase, docs, tools or history, look it up. Fan out subagents for wide searches if your tool has them. **Write a question only once every lookup it depends on has come back.** A card must never change while I'm looking at it.
2. **Compute the frontier.** That's every open decision whose prerequisites are settled. Write **the whole frontier** into the file, in the order I should answer it. A question that depends on another open question waits until that one is answered.
3. **Write each question** as a `## Q<n>. <question?> {#id}` section. Number questions across the whole session.
   - Give the context in a few short lines. Use a table, a ` ```chart ` or a ` ```mermaid ` diagram when it makes the trade-off concrete faster than prose.
   - Write 2 to 4 options under `### Options`, each `**Label.** One line on what it costs or changes.`
   - **Star your recommendation** with ★ and give the reason in its description. Every question gets a ★, because Enter accepts it. If there's only one sensible answer, write that as a single ★ option, and I can type something else.
   - Set `depends:` to the ids it builds on, so the card shows "Builds on…".
4. **Wait for me.** Run `GRILL wait .context/<slug>/grill.md`. In Claude Code, run it with `run_in_background: true` so you're woken when I answer. Elsewhere, run it in the foreground with a 10-minute timeout. If the UI isn't running, or stops while you wait, `wait` restarts it on the same port, so my open page reconnects by itself. If it prints "timed out", run it again.
5. **Read what came back.** `wait` returns as soon as I answer a card or send a note. More cards may still be queued.
   - Picking your ★ with no comment accepts your recommendation. Anything else is my answer, even if it's only partial. "Their words" is a comment I typed alongside a choice. Treat it as part of the answer.
   - **Log every answer** in `## Decisions so far` as one line: `D<n>. <the decision> ("<my words, if I typed any>") {#question-id}`. The sidebar shows these lines in place of my raw answers, so I can see you understood. `wait` lists any answers you haven't logged yet.
   - A **note** counts as an answer too. If it settles something, log it as a D line with no `{#id}`. If it raises a question back at you, answer it under `## What I found`, which shows up in my Notes panel. If it's an idea that needs a later decision, add it to `## Parked` with your best guess.
   - A **revised** answer means I went back and changed a decision. Update that D line, keeping its number, and re-check everything downstream of it.
6. **Grow the frontier.** For each answer, work out which decisions it unlocks. Find their facts, then append them as new questions. **Never edit a question that's still queued.** If an answer makes a queued question moot, set `status: skipped` on it rather than deleting it.
7. Go back to step 4. Keep the queue ahead of me where you can, so the next card is ready the moment I answer. When `wait` says the frontier is empty, I'm looking at a "thinking" card. Write the next questions before anything slow.

Don't post questions or round summaries in chat. Post the UI link once at the start, with the file path, then stay quiet until the grill is done or you're blocked.

## Finishing

The grill is done when the frontier is empty and nothing is parked. Every branch has been visited, and nothing is silently assumed.

1. Make sure every answer has a D line. Then set `status: done` in the frontmatter. The UI shows the decision log on a done card.
2. Paste the output of `GRILL summary <file>` into chat with a link to the file. The decision log is the summary.
3. If the topic is something to build, offer the next step (a plan, a spec, or starting the build), using the decision log as the source.
4. Stop the UI with `GRILL stop <file>`.

Don't act on the decisions until I confirm we share the full picture.

## If I rename the slug

If I change the slug in Q1, move everything with `GRILL move .context/<old>/grill.md .context/<new>/grill.md`. The open page follows the move. Then update `slug:` in the frontmatter, and log the decision.

## Other commands

- `GRILL status <file>` lists answered, queued and skipped questions, and how many events are undelivered.
- `GRILL summary <file>` prints the decision log and the parked list.
