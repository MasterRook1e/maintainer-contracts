import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { normalizeRelative } from "./util.mjs";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString("utf8"));
      else reject(new Error(`${command} exited ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`));
    });
  });
}

export function normalizePullRequestEvent(event) {
  const pr = event?.pull_request || event?.pullRequest || event || {};
  return {
    number: Number(pr.number || event?.number || 0),
    title: String(pr.title || ""),
    body: String(pr.body || ""),
    draft: Boolean(pr.draft),
    author: String(pr.user?.login || pr.author || ""),
    labels: (pr.labels || []).map((label) => String(label?.name ?? label)),
    baseSha: String(pr.base?.sha || event?.baseSha || ""),
    headSha: String(pr.head?.sha || event?.headSha || ""),
    baseRef: String(pr.base?.ref || event?.baseRef || ""),
    headRef: String(pr.head?.ref || event?.headRef || ""),
    additions: Number(pr.additions || event?.additions || 0),
    deletions: Number(pr.deletions || event?.deletions || 0),
    changedFiles: Number(pr.changed_files || event?.changedFiles || 0)
  };
}

export async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(path.resolve(filePath), "utf8"));
}

function parseNumstat(text) {
  const files = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const [added, deleted, ...rest] = line.split("\t");
    const filePath = rest.join("\t");
    files.push({
      path: normalizeRelative(filePath),
      additions: added === "-" ? 0 : Number(added || 0),
      deletions: deleted === "-" ? 0 : Number(deleted || 0),
      binary: added === "-" || deleted === "-"
    });
  }
  return files;
}

export async function inspectGitRange({ gitRoot, baseSha, headSha = "HEAD" }) {
  if (!baseSha) throw new Error("base SHA is required for Git range inspection");
  const root = path.resolve(gitRoot || process.cwd());
  const numstat = await run("git", ["-C", root, "diff", "--numstat", `${baseSha}...${headSha}`]);
  const log = await run("git", ["-C", root, "log", "--format=%H%x09%s", `${baseSha}..${headSha}`]);
  const files = parseNumstat(numstat);
  const commits = log.split(/\r?\n/).filter(Boolean).map((line) => {
    const [sha, ...subject] = line.split("\t");
    return { sha, message: subject.join("\t") };
  });
  return { files, commits };
}

export async function loadInputs(options) {
  const event = options.event ? await readJsonFile(options.event) : {};
  const pullRequest = normalizePullRequestEvent(event);
  let files = options.files ? await readJsonFile(options.files) : null;
  let commits = options.commits ? await readJsonFile(options.commits) : null;
  if ((!files || !commits) && options.gitRoot && pullRequest.baseSha) {
    const inspected = await inspectGitRange({ gitRoot: options.gitRoot, baseSha: pullRequest.baseSha, headSha: pullRequest.headSha || "HEAD" });
    files ??= inspected.files;
    commits ??= inspected.commits;
  }
  files = (files || []).map((file) => typeof file === "string"
    ? { path: normalizeRelative(file), additions: 0, deletions: 0, binary: false }
    : { path: normalizeRelative(file.path || file.filename), additions: Number(file.additions || 0), deletions: Number(file.deletions || 0), binary: Boolean(file.binary) });
  commits = (commits || []).map((commit) => typeof commit === "string" ? { sha: "", message: commit } : { sha: String(commit.sha || ""), message: String(commit.message || commit.subject || "") });
  if (!pullRequest.changedFiles) pullRequest.changedFiles = files.length;
  if (!pullRequest.additions) pullRequest.additions = files.reduce((sum, file) => sum + file.additions, 0);
  if (!pullRequest.deletions) pullRequest.deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  return { pullRequest, files, commits, rawEvent: event };
}
