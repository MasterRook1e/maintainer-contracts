import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { inspectGitRange, normalizePullRequestEvent } from "../src/event.mjs";

test("GitHub event normalization extracts PR fields", () => {
  const pr = normalizePullRequestEvent({
    number: 7,
    pull_request: {
      title: "feat: test",
      body: "body",
      draft: true,
      user: { login: "octocat" },
      labels: [{ name: "reviewed" }],
      base: { sha: "a", ref: "main" },
      head: { sha: "b", ref: "feature" }
    }
  });
  assert.equal(pr.number, 7);
  assert.equal(pr.author, "octocat");
  assert.deepEqual(pr.labels, ["reviewed"]);
  assert.equal(pr.draft, true);
});

test("git inspection returns changed files and commit subjects", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "contracts-git-"));
  try {
    spawnSync("git", ["init", "-b", "main"], { cwd: root });
    spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
    spawnSync("git", ["config", "user.name", "Test"], { cwd: root });
    await fs.writeFile(path.join(root, "a.txt"), "a\n");
    spawnSync("git", ["add", "a.txt"], { cwd: root });
    spawnSync("git", ["commit", "-m", "chore: baseline"], { cwd: root });
    const base = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
    await fs.writeFile(path.join(root, "a.txt"), "a\nb\n");
    spawnSync("git", ["add", "a.txt"], { cwd: root });
    spawnSync("git", ["commit", "-m", "feat: update a"], { cwd: root });
    const inspected = await inspectGitRange({ gitRoot: root, baseSha: base });
    assert.equal(inspected.files[0].path, "a.txt");
    assert.equal(inspected.commits[0].message, "feat: update a");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
