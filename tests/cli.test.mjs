import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const CLI = path.resolve("bin/maintainer-contracts.mjs");

test("init writes example configuration", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "contracts-cli-"));
  try {
    const run = spawnSync(process.execPath, [CLI, "init", "--project-root", root], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    const config = JSON.parse(await fs.readFile(path.join(root, "maintainer-contracts.config.json"), "utf8"));
    assert.equal(config.version, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("check returns one for failing event", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "contracts-cli-"));
  try {
    const eventPath = path.join(root, "event.json");
    const configPath = path.join(root, "maintainer-contracts.config.json");
    await fs.writeFile(eventPath, JSON.stringify({ number: 1, pull_request: { title: "bad", body: "TODO", labels: [] } }));
    await fs.writeFile(configPath, JSON.stringify({ version: 1, requiredPatterns: [] }));
    const run = spawnSync(process.execPath, [CLI, "check", "--project-root", root, "--event", eventPath, "--format", "json"], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.equal(JSON.parse(run.stdout).summary.passed, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
