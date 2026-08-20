import test from "node:test";
import assert from "node:assert/strict";
import { renderGitHubAnnotations, renderMarkdown } from "../src/reporters.mjs";

const result = {
  tool: { name: "maintainer-contracts", version: "0.1.0" },
  pullRequest: { number: 1, title: "test", changedFiles: 1, additions: 1, deletions: 0 },
  summary: { passed: false, errors: 1, warnings: 0, notes: 0 },
  findings: [{ ruleId: "section-missing-summary", severity: "error", section: "Summary", message: "Missing", details: {}, fingerprint: "x" }],
  triggered: { pathRules: [], labelRules: [] },
  skipped: false
};

test("Markdown report lists findings", () => {
  assert.match(renderMarkdown(result), /section-missing-summary/);
});

test("GitHub reporter emits workflow command", () => {
  assert.match(renderGitHubAnnotations(result), /^::error title=/);
});
