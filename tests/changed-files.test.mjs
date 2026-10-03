import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeChangedFile, parseNumstatZ, matchingChangedPaths } from "../src/changed-files.mjs";
import { inspectGitRange, loadInputs } from "../src/event.mjs";
import { normalizeConfig } from "../src/config.mjs";
import { evaluateContracts } from "../src/policy.mjs";
import { compileGlobs } from "../src/glob.mjs";

const renamed = { filename: "docs/session.txt", previous_filename: "src/auth/session.txt", status: "renamed", additions: 0, deletions: 0 };

function policyReport(files) {
  return evaluateContracts({
    pullRequest: { title: "refactor: relocate source", body: "", labels: [], draft: false, changedFiles: files.length, additions: 0, deletions: 0 },
    files,
    commits: []
  }, normalizeConfig({
    requiredSections: [], requiredPatterns: [],
    pathRules: [{ name: "auth", paths: ["src/auth/**"], requireSections: [{ heading: "Security impact", minChars: 1 }] }],
    labelRules: [{ name: "auth-label", paths: ["src/auth/**"], requireLabels: ["security-reviewed"] }]
  }));
}

test("renames retain previous paths but do not inflate file counts", () => {
  const file = normalizeChangedFile(renamed);
  assert.equal(file.previousPath, "src/auth/session.txt");
  const report = policyReport([file]);
  assert.equal(report.summary.passed, false);
  assert.deepEqual(report.triggered.pathRules[0].paths, ["src/auth/session.txt"]);
  assert.deepEqual(report.triggered.labelRules[0].paths, ["src/auth/session.txt"]);
  assert.equal(report.pullRequest.changedFiles, 1);
  assert.equal(report.files.length, 1);
  const reverse = normalizeChangedFile({ path: file.previousPath, previousPath: file.path });
  assert.equal(policyReport([reverse]).summary.passed, false);
});

test("matching paths deduplicate and sort both ends of a rename", () => {
  const files = [{ path: "src/auth/z.txt", previousPath: "src/auth/a.txt" }, { path: "src/auth/a.txt" }];
  assert.deepEqual(matchingChangedPaths(files, compileGlobs(["src/auth/**"])), ["src/auth/a.txt", "src/auth/z.txt"]);
  assert.deepEqual(policyReport([{ path: "docs/readme.md" }]).triggered, { pathRules: [], labelRules: [] });
});

test("NUL numstat preserves tabs, newlines and Unicode and decodes renames", () => {
  const parsed = parseNumstatZ("2\t1\tassets/图标\tname\nfile.txt\0-\t-\tbinary.dat\0" + "0\t0\t\0src/auth/a.txt\0docs/a.txt\0");
  assert.equal(parsed[0].path, "assets/图标\tname\nfile.txt");
  assert.equal(parsed[1].binary, true);
  assert.equal(parsed[2].previousPath, "src/auth/a.txt");
  assert.equal(parsed[2].path, "docs/a.txt");
  assert.equal(parsed.length, 3);
  assert.deepEqual(parseNumstatZ(""), []);
});

test("malformed numstat and incomplete rename evidence fail closed", () => {
  for (const input of ["1\t0\ta", "1\t0\t\0old\0", "-1\t0\ta\0", "1e9\t0\ta\0", "-\t0\ta\0", "0\t0\t\0\0new\0", "\0"]) {
    assert.throws(() => parseNumstatZ(input));
  }
  for (const file of [{ ...renamed, previous_filename: undefined }, { path: "../a" }, { path: "a", additions: -1 }, { path: "a", deletions: Infinity }, null]) {
    assert.throws(() => normalizeChangedFile(file));
  }
});

test("GitHub API and explicit fixtures preserve rename evidence through loadInputs", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "contracts-rename-input-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const event = path.join(root, "event.json");
  const files = path.join(root, "files.json");
  const commits = path.join(root, "commits.json");
  await fs.writeFile(event, JSON.stringify({ number: 1, pull_request: { changed_files: 1 } }));
  await fs.writeFile(files, JSON.stringify([renamed]));
  await fs.writeFile(commits, "[]");
  const fetchImpl = async (url) => ({ ok: true, json: async () => url.includes("/files?") ? [renamed] : [], headers: { get: () => null } });
  const api = await loadInputs({ event, githubApi: true, githubRepository: "sample/repository", githubToken: "synthetic", fetchImpl });
  const fixture = await loadInputs({ event, files, commits });
  assert.deepEqual(api.files, fixture.files);
  assert.equal(api.files[0].previousPath, "src/auth/session.txt");
  assert.equal(policyReport(api.files).summary.passed, false);
});

test("real Git inspection preserves rename identities and unusual filenames", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "contracts-rename-git-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "-b", "main");
  git("config", "user.name", "Synthetic Test");
  git("config", "user.email", "test@example.invalid");
  await fs.mkdir(path.join(root, "src/auth"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"));
  await fs.writeFile(path.join(root, renamed.previous_filename), "original unchanged content\n");
  git("add", "."); git("commit", "-m", "test: baseline");
  const base = git("rev-parse", "HEAD");
  git("mv", renamed.previous_filename, renamed.filename);
  const unusual = process.platform === "win32" ? "图标 name.txt" : "图标\tname\nfile.txt";
  await fs.writeFile(path.join(root, unusual), "new content\n");
  git("add", "."); git("commit", "-m", "refactor: move file");
  const actual = await inspectGitRange({ gitRoot: root, baseSha: base });
  assert.equal(actual.files.length, 2);
  assert.equal(actual.files.find((file) => file.path === renamed.filename).previousPath, renamed.previous_filename);
  assert.equal(actual.files.some((file) => file.path === unusual), true);
  assert.equal(policyReport(actual.files).summary.passed, false);
  await assert.rejects(inspectGitRange({ gitRoot: root, baseSha: "--output=not-a-ref" }));
});
