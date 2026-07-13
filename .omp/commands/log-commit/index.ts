/**
 * /log-commit — Interactive Captain's Log + commit workflow.
 *
 * Replaces the markdown-based prompt-template with a native TypeScript
 * command that analyses git changes, evaluates Captain's Log eligibility,
 * and guides the user through multi-commit grouping interactively.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { CustomCommand, CustomCommandAPI } from "@oh-my-pi/pi-coding-agent";
import type { HookCommandContext } from "@oh-my-pi/pi-coding-agent";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CaptainsLogEntry {
  id: string;
  timestamp: string;
  concern: "design" | "architecture" | "code" | "validation" | "pivot";
  tags: string[];
  milestone: string;
  files_affected: string[];
  summary: {
    decision_made: string;
    options_considered: string[];
    difficulties_encountered: string;
    reversals_and_refactors: string;
    key_takeaway: string;
  };
  meta: {
    confidence_score: number;
  };
}

interface CaptainsLogFile {
  entries: CaptainsLogEntry[];
}

interface GitFile {
  status: string;
  path: string;
}

interface CommitGroup {
  files: string[];
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain tags & concern values from AGENTS.md
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_TAGS = ["gameplay-loop", "ui-ux", "networking", "state-machine", "hosting"];
const STATUS_TAGS = ["milestone", "refactor", "bug-hunt", "playtest-insight", "pivot"];
const CONCERN_VALUES = ["design", "architecture", "code", "validation", "pivot"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function todaySlug(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function isoNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function gitFiles(api: CustomCommandAPI): Promise<GitFile[]> {
  const r = await api.exec("git", ["status", "--porcelain"], { cwd: api.cwd });
  if (r.code !== 0 || !r.stdout.trim()) return [];
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2).trim(),
      path: line.slice(3),
    }));
}

async function gitDiffStat(api: CustomCommandAPI, cached: boolean): Promise<string> {
  const args = cached ? ["diff", "--cached", "--stat"] : ["diff", "--stat"];
  const r = await api.exec("git", args, { cwd: api.cwd });
  return r.code === 0 ? r.stdout.trim() : "";
}

async function gitDiff(api: CustomCommandAPI, cached: boolean): Promise<string> {
  const args = cached ? ["diff", "--cached"] : ["diff"];
  const r = await api.exec("git", args, { cwd: api.cwd });
  return r.code === 0 ? r.stdout : "";
}

function loadCaptainsLog(cwd: string): CaptainsLogFile {
  const logPath = path.join(cwd, ".context", "captains_log.json");
  try {
    const raw = fs.readFileSync(logPath, "utf-8");
    const entries = JSON.parse(raw);
    return { entries: Array.isArray(entries) ? entries : [] };
  } catch {
    return { entries: [] };
  }
}

function saveCaptainsLog(cwd: string, log: CaptainsLogFile): void {
  const logPath = path.join(cwd, ".context", "captains_log.json");
  fs.writeFileSync(logPath, JSON.stringify(log.entries, null, 2) + "\n", "utf-8");
}

function loadAgentsMd(cwd: string): string {
  const p = path.join(cwd, "AGENTS.md");
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trigger-condition evaluation
// ─────────────────────────────────────────────────────────────────────────────

interface ChangeGroup {
  concern: (typeof CONCERN_VALUES)[number];
  reasoning: string;
  files: string[];
  milestone: string;
}

/**
 * Heuristic: scan changed files and diff to decide if changes are "significant"
 * enough for a Captain's Log entry per the AGENTS.md trigger conditions.
 */
function evaluateChanges(
  files: GitFile[],
  _diffStat: string,
  agentsContent: string,
): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  const changedPaths = files.map((f) => f.path);

  // Extract milestone context from AGENTS.md if available
  const milestone = extractMilestone(agentsContent);

  // Check for .context/ files — design/roadmap changes
  const contextFiles = changedPaths.filter(
    (p) =>
      p.includes(".context/") ||
      p === "AGENTS.md",
  );
  if (contextFiles.length > 0) {
    groups.push({
      concern: "design",
      reasoning:
        "Changes to .context/ design files or AGENTS.md indicate milestone or design work.",
      files: contextFiles,
      milestone,
    });
  }

  // Check for architectural files
  const archFiles = changedPaths.filter(
    (p) =>
      p.includes("src/") ||
      p.includes("packages/") ||
      p.includes("architecture") ||
      p.endsWith(".config.ts") ||
      p.endsWith(".config.js"),
  );
  const nonContextArch = archFiles.filter(
    (p) => !contextFiles.includes(p),
  );
  if (nonContextArch.length > 0) {
    groups.push({
      concern: "architecture",
      reasoning: "Source code or architecture files changed.",
      files: nonContextArch,
      milestone,
    });
  }

  // Check for test/validation changes
  const testFiles = changedPaths.filter(
    (p) => p.includes("test") || p.includes("spec") || p.includes("__tests__"),
  );
  if (testFiles.length > 0) {
    groups.push({
      concern: "validation",
      reasoning: "Test files changed — validation or QA milestone.",
      files: testFiles,
      milestone,
    });
  }

  // Everything else as code concern if not yet captured
  const captured = new Set(groups.flatMap((g) => g.files));
  const remainder = changedPaths.filter((p) => !captured.has(p));
  if (remainder.length > 0 && remainder.some((p) => !p.endsWith(".md"))) {
    groups.push({
      concern: "code",
      reasoning: "Implementation changes detected.",
      files: remainder.filter((p) => !p.endsWith(".md")),
      milestone,
    });
  }

  // Detect potential pivot — large .context/ deletions or rewrites
  const hasPivot =
    files.some(
      (f) =>
        (f.status === "D" || f.status.includes("R")) &&
        f.path.includes(".context/"),
    ) || contextFiles.length >= 3;
  if (hasPivot && !groups.some((g) => g.concern === "pivot")) {
    groups.push({
      concern: "pivot",
      reasoning:
        "Significant deletions or restructuring of design files — possible pivot.",
      files: contextFiles,
      milestone,
    });
  }

  return groups;
}

function extractMilestone(agentsContent: string): string {
  // Try to find the current phase from AGENTS.md
  const phaseMatch = agentsContent.match(
    /### Phase \d+:?\s*(.+)/i,
  );
  if (phaseMatch) return phaseMatch[1].trim();
  return "Unknown Milestone";
}

// ─────────────────────────────────────────────────────────────────────────────
// Log entry builder
// ─────────────────────────────────────────────────────────────────────────────

function buildLogEntry(
  group: ChangeGroup,
  context: { log: CaptainsLogFile; milestone: string },
): CaptainsLogEntry {
  const slug = group.concern + "-" + group.files[0]?.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30) || "update";
  return {
    id: `${todaySlug()}-${slug}`,
    timestamp: isoNow(),
    concern: group.concern,
    tags: inferTags(group),
    milestone: group.milestone || context.milestone,
    files_affected: group.files,
    summary: {
      decision_made: `[Pending — describe what was decided or implemented]`,
      options_considered: [],
      difficulties_encountered: "",
      reversals_and_refactors: "",
      key_takeaway: "",
    },
    meta: {
      confidence_score: 3,
    },
  };
}

function inferTags(group: ChangeGroup): string[] {
  const tags: string[] = [];
  if (group.concern === "design") tags.push("gameplay-loop");
  if (group.concern === "architecture") tags.push("state-machine");
  if (group.concern === "code") tags.push("refactor");
  if (group.concern === "validation") tags.push("bug-hunt");
  if (group.concern === "pivot") tags.push("pivot");
  return tags;
}

function formatEntryPreview(entry: CaptainsLogEntry): string {
  const lines = [
    `┌─ Captain's Log Entry ─────────────────────`,
    `│ ID:        ${entry.id}`,
    `│ Timestamp: ${entry.timestamp}`,
    `│ Concern:   ${entry.concern}`,
    `│ Tags:      ${entry.tags.join(", ") || "(none)"}`,
    `│ Milestone: ${entry.milestone}`,
    `│ Files:     ${entry.files_affected.join(", ") || "(none)"}`,
    `│ Summary:   ${entry.summary.decision_made}`,
    `│ Confidence: ${entry.meta.confidence_score}/5`,
    `└───────────────────────────────────────────`,
  ];
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Commit message builder
// ─────────────────────────────────────────────────────────────────────────────

function buildDefaultCommitMessage(
  group: CommitGroup,
  logEntries: CaptainsLogEntry[],
): string {
  const firstFile = group.files[0] || "changes";
  const domain = firstFile.includes(".context/")
    ? "design"
    : firstFile.includes("src/")
      ? "feat"
      : "chore";
  const summary = `${domain}: update ${group.files.length} file(s)`;

  const bodyLines: string[] = [];
  bodyLines.push("");
  for (const f of group.files) {
    bodyLines.push(`- ${f}`);
  }

  const logRefs = logEntries
    .filter((e) => e.files_affected.some((f) => group.files.includes(f)))
    .map((e) => `Captains Log: ${e.id}`);
  if (logRefs.length > 0) {
    bodyLines.push("");
    bodyLines.push(...logRefs);
  }

  return summary + "\n" + bodyLines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main command
// ─────────────────────────────────────────────────────────────────────────────

async function logCommitCommand(
  api: CustomCommandAPI,
  ctx: HookCommandContext,
): Promise<string | undefined> {
  // ── Step 1: Analyse git changes ──────────────────────────────────────
  const files = await gitFiles(api);
  if (files.length === 0) {
    ctx.ui.notify("No changes detected in the working tree.", "warning");
    return;
  }

  const [unstagedStat, stagedStat] = await Promise.all([
    gitDiffStat(api, false),
    gitDiffStat(api, true),
  ]);

  // ── Step 2: Read context ─────────────────────────────────────────────
  const agentsContent = loadAgentsMd(api.cwd);
  const captainsLog = loadCaptainsLog(api.cwd);

  // ── Step 3: Evaluate log-worthiness ───────────────────────────────────
  const changeGroups = evaluateChanges(files, unstagedStat + stagedStat, agentsContent);

  // ── Step 4: Interactive log entry review ──────────────────────────────
  if (changeGroups.length === 0) {
    const skip = await ctx.ui.confirm(
      "No Log Entry",
      "Changes appear to be minor (cosmetic/trivial). No Captain's Log entry recommended. Skip to commit phase?",
    );
    if (!skip) return;
  }

  const approvedEntries: CaptainsLogEntry[] = [];

  for (const group of changeGroups) {
    const entry = buildLogEntry(group, {
      log: captainsLog,
      milestone: extractMilestone(agentsContent),
    });

    // Show entry to user
    ctx.ui.notify(
      `Proposed log entry for concern: ${group.concern}`,
      "info",
    );

    const action = await ctx.ui.select(
      `Review entry: ${entry.concern} — ${group.reasoning}`,
      [
        "Approve as-is",
        "Edit summary fields",
        "Skip this entry",
        "View full preview",
      ],
    );

    if (action === "Skip this entry") continue;

    let currentEntry = { ...entry, summary: { ...entry.summary } };

    if (action === "View full preview") {
      await ctx.ui.editor(
        "Entry Preview",
        formatEntryPreview(currentEntry),
      );
      const proceed = await ctx.ui.confirm(
        "Approve Entry",
        "Approve this entry?",
      );
      if (!proceed) {
        const edit = await ctx.ui.confirm(
          "Edit Instead",
          "Would you like to edit this entry?",
        );
        if (!edit) continue;
      } else {
        approvedEntries.push(currentEntry);
        continue;
      }
    }

    if (action === "Approve as-is") {
      // Go straight to final confirmation
      const confirmed = await ctx.ui.confirm(
        "Confirm Entry",
        `Add this entry to the Captain's Log?\n\n${formatEntryPreview(currentEntry)}`,
      );
      if (confirmed) {
        approvedEntries.push(currentEntry);
      }
      continue;
    }


    // Edit fields interactively (for "Edit summary fields" or post-preview editing)
    currentEntry.summary.decision_made =
      (await ctx.ui.input(
        "Decision made",
        currentEntry.summary.decision_made,
      )) || currentEntry.summary.decision_made;

    const keyTakeaway =
      await ctx.ui.input(
        "Key takeaway (one sentence)",
        currentEntry.summary.key_takeaway,
      );
    if (keyTakeaway !== undefined) {
      currentEntry.summary.key_takeaway = keyTakeaway;
    }

    const confidenceStr = await ctx.ui.input(
      "Confidence score (1-5)",
      String(currentEntry.meta.confidence_score),
    );
    if (confidenceStr !== undefined) {
      const s = Math.max(1, Math.min(5, parseInt(confidenceStr, 10) || 3));
      currentEntry.meta.confidence_score = s;
    }

    const concern = await ctx.ui.select("Concern", [...CONCERN_VALUES]);
    if (concern) {
      currentEntry.concern = concern as CaptainsLogEntry["concern"];
    }

    // Multi-select tags
    const allTags = [...DOMAIN_TAGS, ...STATUS_TAGS];
    const selectedTags: string[] = [];
    let picking = true;
    while (picking) {
      const tag = await ctx.ui.select(
        `Select tags (current: ${selectedTags.join(", ") || "none"})`,
        ["[DONE — stop selecting]", ...allTags],
      );
      if (!tag || tag.startsWith("[DONE")) {
        picking = false;
      } else if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
      }
    }
    if (selectedTags.length > 0) {
      currentEntry.tags = selectedTags;
    }

    // Final approve
    const confirmed = await ctx.ui.confirm(
      "Confirm Entry",
      `Add this entry to the Captain's Log?\n\n${formatEntryPreview(currentEntry)}`,
    );
    if (confirmed) {
      approvedEntries.push(currentEntry);
    }
  }

  // ── Step 5: Write to captains_log.json ───────────────────────────────
  if (approvedEntries.length > 0) {
    const write = await ctx.ui.confirm(
      "Write to Captain's Log",
      `Write ${approvedEntries.length} entry/entries to .context/captains_log.json?`,
    );
    if (write) {
      const log = loadCaptainsLog(api.cwd);
      log.entries.push(...approvedEntries);
      saveCaptainsLog(api.cwd, log);
      ctx.ui.notify(
        `Wrote ${approvedEntries.length} entry/entries to .context/captains_log.json`,
        "info",
      );
    }
  }


  // Stage all if nothing is staged
  const stagedFiles = files.filter((f) => f.status !== "??" && f.status !== " M");
  if (stagedFiles.length === 0) {
    const stageAll = await ctx.ui.confirm(
      "No Staged Files",
      "No files are staged for commit. Stage all changed files?",
    );
    if (stageAll) {
      await api.exec("git", ["add", "-A"], { cwd: api.cwd });
      ctx.ui.notify("Staged all changes.", "info");
    }
  }

  // Present files for grouping
  const commitGroups: CommitGroup[] = [];
  const remainingFiles = new Set(files.map((f) => f.path));

  while (remainingFiles.size > 0) {
    const sorted = [...remainingFiles].sort();
    const pick = await ctx.ui.select(
      `Select files for commit group ${commitGroups.length + 1}`,
      ["[Done — finish grouping]", ...sorted],
    );

    if (!pick || pick.startsWith("[Done")) break;

    // Single-select: pick one file at a time
    const groupFiles: string[] = [pick];
    remainingFiles.delete(pick);

    let addMore = true;
    while (addMore && remainingFiles.size > 0) {
      const more = await ctx.ui.select(
        `Add more files to group? (current: ${groupFiles.join(", ")})`,
        ["[Done — this group is complete]", ...[...remainingFiles].sort()],
      );
      if (!more || more.startsWith("[Done")) {
        addMore = false;
      } else {
        groupFiles.push(more);
        remainingFiles.delete(more);
      }
    }

    const defaultMsg = buildDefaultCommitMessage(
      { files: groupFiles, message: "" },
      approvedEntries,
    );
    const editedMsg = await ctx.ui.editor(
      `Commit message for group (${groupFiles.length} files)`,
      defaultMsg,
      undefined,
      { promptStyle: true },
    );

    if (editedMsg !== undefined && editedMsg.trim()) {
      commitGroups.push({ files: groupFiles, message: editedMsg.trim() });
    }
  }

  // ── Step 7: Execute commits ──────────────────────────────────────────
  if (commitGroups.length === 0) {
    ctx.ui.notify("No commits created.", "warning");
    return;
  }

  const confirmAll = await ctx.ui.confirm(
    "Execute Commits",
    `Create ${commitGroups.length} commit(s)?\n\n` +
      commitGroups
        .map(
          (g, i) =>
            `Commit ${i + 1}: ${g.message.split("\n")[0]}\n  Files: ${g.files.join(", ")}`,
        )
        .join("\n\n"),
  );

  if (!confirmAll) {
    ctx.ui.notify("Commits cancelled.", "warning");
    return;
  }

  for (let i = 0; i < commitGroups.length; i++) {
    const group = commitGroups[i];
    ctx.ui.setStatus(
      "log-commit",
      `Committing group ${i + 1}/${commitGroups.length}...`,
    );

    // Stage files
    const addResult = await api.exec(
      "git",
      ["add", "--", ...group.files],
      { cwd: api.cwd },
    );
    if (addResult.code !== 0) {
      ctx.ui.notify(
        `Failed to stage files for commit ${i + 1}: ${addResult.stderr}`,
        "error",
      );
      return;
    }

    // Commit with multi-line message
    const msgLines = group.message.split("\n");
    const commitArgs = ["commit"];
    for (const line of msgLines) {
      commitArgs.push("-m", line);
    }

    const commitResult = await api.exec("git", commitArgs, { cwd: api.cwd });
    if (commitResult.code !== 0) {
      ctx.ui.notify(
        `Commit ${i + 1} failed: ${commitResult.stderr}`,
        "error",
      );
      return;
    }

    ctx.ui.notify(
      `Commit ${i + 1}/${commitGroups.length}: ${msgLines[0]}`,
      "info",
    );
  }

  ctx.ui.setStatus("log-commit", undefined);
  ctx.ui.notify(
    `${commitGroups.length} commit(s) created successfully. Ready to push.`,
    "info",
  );

  return;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory export
// ─────────────────────────────────────────────────────────────────────────────

const factory = (api: CustomCommandAPI): CustomCommand => ({
  name: "log-commit",
  description:
    "Evaluate changes, draft Captain's Log entries, review commit messages, and commit",
  execute: (args: string[], ctx: HookCommandContext) =>
    logCommitCommand(api, ctx),
});

export default factory;
