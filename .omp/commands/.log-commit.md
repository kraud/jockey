---
name: log-commit
description: Evaluate changes, draft Captain's Log entries, review commit messages, and commit.
---

You are executing the `/log-commit` workflow. Follow this process step by step. Do not skip any step. Do not modify any project file beyond what is explicitly listed unless the user gives clear, explicit confirmation after you ask.

## Goal

When the user is about to make a commit, this workflow ensures that any significant changes are captured as a Captain's Log entry in `.context/captains_log.json`, and that a thoughtful commit message (or messages) is produced and applied.

## Reference: Captain's Log Schema

The log lives at `.context/captains_log.json`. Each entry must follow this structure:

```json
{
  "id": "YYYYMMDD-unique-slug",
  "timestamp": "YYYY-MM-DDTHH:MM:SSZ",
  "concern": "design | architecture | code | validation | pivot",
  "tags": ["domain-tag", "status-tag"],
  "milestone": "Name of the roadmap milestone related to this entry",
  "files_affected": ["path/to/file1", "path/to/file2"],
  "summary": {
    "decision_made": "Clear description of what was chosen or implemented.",
    "options_considered": ["Option A (Pros/Cons)", "Option B (Pros/Cons)"],
    "difficulties_encountered": "Unforeseen roadblocks or technical hurdles.",
    "reversals_and_refactors": "Why a previous approach failed and how the new solution fixes it.",
    "key_takeaway": "A one-sentence summary of the core lesson learned (great for dev logs)."
  },
  "meta": {
    "confidence_score": 1-5
  }
}
```

Entry `id` format: `YYYYMMDD-unique-slug` (e.g. `20260712-websocket-migration`). Timestamp is ISO 8601 UTC.

**Domain Tags:** `gameplay-loop`, `ui-ux`, `networking`, `state-machine`, `hosting`
**Status Tags:** `milestone`, `refactor`, `bug-hunt`, `playtest-insight`, `pivot`

### Trigger Conditions (from AGENTS.md)

Do not log micro-changes (like minor typos or small style tweaks). An entry is strictly required when:
1. A roadmap milestone is reached, defined, or redefined.
2. An architectural or design decision is finalized or explicitly reversed.
3. A significant refactor occurs due to hidden complexities or technical debt.
4. Playtest feedback results in a pivot or concrete shift in project direction.

## Step 1 — Explore Changes

Run `git status` and `git diff --stat` to see what files are staged and/or changed. Run `git diff` and/or `git diff --cached` to inspect the actual content of changes. Read `.context/roadmap.md` and `.context/game_design.md` to understand current milestones and design state. If there is a `.context/captains_log.json`, read its existing entries so you can assess whether new entries are warranted.

## Step 2 — Evaluate & Propose Log Entries

For each logical grouping of changes, evaluate whether a Captain's Log entry is justified per the trigger conditions above. If the changes are purely cosmetic or trivial (`concern: none`), state that no entry is needed and skip to Step 5.

For groupings that do justify an entry, draft the full JSON entry. Use the existing `captains_log.json` entries as a stylistic reference. Present each proposed entry to the user in a clear, formatted way. Explain which trigger condition(s) apply and why.

If there are multiple distinct groupings of changes that warrant separate entries (e.g., unrelated sets of files addressing different concerns), propose each as a separate entry.

## Step 3 — Review & Iterate

Show the proposed entries to the user and ask for their review. Allow them to:
- Approve an entry as-is
- Request changes to specific fields
- Reject an entry entirely
- Ask you to merge multiple entries into one

Iterate until the user explicitly approves the final set of entries.

## Step 4 — Write to captains_log.json

Once approved, read the current `.context/captains_log.json` file, append the new entry (or entries) to the JSON array using the correct format, and write the file. Do NOT modify any other file unless you ask the user first and receive explicit confirmation.

Confirm with the user that the file was updated.

## Step 5 — Propose Commit Message(s)

Based on the changes (and log entries written), draft one or more commit messages. Each commit message should:

- Use conventional commit format if appropriate (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, etc.)
- Have a short summary line (≤50 chars) followed by a blank line and a detailed body
- Reference any related roadmap milestones or context
- If the commit includes Captain's Log changes, include a brief note like `"Captains Log: <entry-id>"` in the body

If you propose multiple commits, clearly specify which files belong in each commit and the order they should be applied.

Present the proposal(s) to the user. Allow them to:
- Approve a message as-is
- Request edits to the subject line, body, or both
- Change which files go in which commit
- Merge or split commits

Iterate until the user explicitly approves the commit message(s).

## Step 6 — Execute Commits

Once the commit message(s) are approved, run `git add` for the appropriate files (all staged changes plus the updated `captains_log.json` if it was modified) and `git commit -m "..."` (or `git commit -m "..." -m "..."` for multi-line messages) for each commit. Commit, but DO NOT push.

Confirm to the user that the commit(s) were made successfully. Suggest what to push, or that they review and push at their convenience.

## Guardrails

- NEVER modify any file other than `.context/captains_log.json` without asking first and getting explicit confirmation.
- NEVER push. Only commit.
- If the user says to skip a step, respect that and continue to the next applicable step.
- If no changes are detected by git, inform the user and stop.
