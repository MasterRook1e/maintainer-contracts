import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../src/config.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

test("repository self-policy is accepted by the public config loader", async () => {
  const loaded = await loadConfig({
    projectRoot: ROOT,
    configPath: ".github/maintainer-contracts.json"
  });

  assert.equal(loaded.config.version, 1);
  assert.equal(loaded.config.failLevel, "error");
  assert.ok(loaded.config.requiredSections.some((rule) => rule.heading === "Public boundary"));
  assert.ok(loaded.config.checkboxes.some((rule) =>
    rule.section === "Validation" &&
    rule.requiredTexts.includes("npm run verify") &&
    rule.requiredTexts.includes("npm pack --dry-run") &&
    rule.requiredTexts.includes("No credentials")
  ));
  assert.ok(loaded.config.pathRules.some((rule) => rule.name === "workflow-or-token-boundary"));
});

test("pull-request template exposes every globally required evidence section", async () => {
  const loaded = await loadConfig({
    projectRoot: ROOT,
    configPath: ".github/maintainer-contracts.json"
  });
  const template = await fs.readFile(path.join(ROOT, ".github/pull_request_template.md"), "utf8");

  for (const section of loaded.config.requiredSections) {
    assert.match(template, new RegExp(`^## ${section.heading}$`, "m"));
  }
  for (const checkbox of loaded.config.checkboxes) {
    for (const text of checkbox.requiredTexts) {
      assert.ok(template.includes(text), `template must include required checkbox text: ${text}`);
    }
  }
});
