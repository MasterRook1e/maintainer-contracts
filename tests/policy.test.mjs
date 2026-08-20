import test from "node:test";
import assert from "node:assert/strict";
import { normalizeConfig } from "../src/config.mjs";
import { evaluateContracts } from "../src/policy.mjs";

function input(overrides = {}) {
  return {
    pullRequest: {
      number: 1,
      title: "feat: add useful behavior",
      body: "## Summary\nThis change adds a sufficiently detailed behavior description.\n\n## Validation\n- [x] Tests run\n\n## AI assistance\nUsed for tests and reviewed manually.\n",
      draft: false,
      author: "alice",
      labels: [],
      baseSha: "a",
      headSha: "b",
      additions: 10,
      deletions: 2,
      changedFiles: 1
    },
    files: [{ path: "src/index.js", additions: 10, deletions: 2, binary: false }],
    commits: [{ sha: "1", message: "feat: add useful behavior" }],
    ...overrides
  };
}

test("valid PR passes default contracts", () => {
  const result = evaluateContracts(input(), normalizeConfig({ requiredPatterns: [] }));
  assert.equal(result.summary.passed, true);
  assert.equal(result.findings.length, 0);
});

test("missing section and placeholder are reported", () => {
  const data = input();
  data.pullRequest.body = "## Summary\nTODO\n";
  const result = evaluateContracts(data, normalizeConfig({ requiredPatterns: [] }));
  assert.equal(result.summary.passed, false);
  assert.equal(result.findings.some((finding) => finding.ruleId.includes("validation")), true);
  assert.equal(result.findings.some((finding) => finding.ruleId.startsWith("placeholder-")), true);
});

test("path rules require security evidence only when triggered", () => {
  const cfg = normalizeConfig({
    requiredPatterns: [],
    pathRules: [{
      name: "auth-change",
      paths: ["src/auth/**"],
      requireSections: [{ heading: "Security impact", minChars: 20 }],
      requireAnyLabels: ["security-reviewed", "security-not-applicable"],
      requireCheckedTexts: ["Threat model reviewed"],
      severity: "error"
    }]
  });
  const data = input({ files: [{ path: "src/auth/session.js", additions: 10, deletions: 2 }] });
  const result = evaluateContracts(data, cfg);
  assert.equal(result.summary.passed, false);
  assert.equal(result.triggered.pathRules[0].name, "auth-change");
  assert.equal(result.findings.some((finding) => finding.ruleId === "path-rule-label-one-of"), true);
  assert.equal(result.findings.some((finding) => finding.ruleId === "path-rule-checkbox-required"), true);
});

test("commit subjects are checked independently", () => {
  const data = input({ commits: [{ sha: "1", message: "misc changes" }] });
  const result = evaluateContracts(data, normalizeConfig({ requiredPatterns: [] }));
  assert.equal(result.findings.some((finding) => finding.ruleId === "commit-message-pattern"), true);
});
