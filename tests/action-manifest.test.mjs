import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

async function readActionManifest() {
  return (await fs.readFile(path.join(ROOT, "action.yml"), "utf8")).replace(/\r\n/g, "\n");
}

test("action input metadata does not contain unsupported expressions", async () => {
  const source = await readActionManifest();
  const inputs = source.match(/^inputs:\n([\s\S]*?)^outputs:/m)?.[1];

  assert.ok(inputs, "action.yml must contain an inputs block before outputs");
  assert.doesNotMatch(
    inputs,
    /\$\{\{/,
    "input descriptions and defaults must not contain expression syntax; pass dynamic values from the caller",
  );
});

test("action requires an explicit caller token for GitHub API mode", async () => {
  const source = await readActionManifest();
  assert.match(source, /token:\n(?:.*\n){0,4}\s+default: ""/);
  assert.match(source, /MC_GITHUB_TOKEN: \$\{\{ inputs\.token \}\}/);
});
