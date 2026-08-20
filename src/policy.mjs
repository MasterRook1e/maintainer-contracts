import { compileGlobs, matchesAny } from "./glob.mjs";
import { parseMarkdown } from "./markdown.mjs";
import { makeFinding, normalizeHeading, shouldFail } from "./util.mjs";
import { REPORT_SCHEMA_VERSION, TOOL_NAME, TOOL_VERSION } from "./version.mjs";

function compilePattern(rule) {
  try {
    return new RegExp(rule.pattern, rule.flags);
  } catch (error) {
    throw new Error(`invalid regex ${rule.pattern}: ${error.message}`);
  }
}

function sectionFindings(markdown, rules, rulePrefix = "section") {
  const findings = [];
  for (const rule of rules) {
    const section = markdown.getSection(rule.heading);
    const id = normalizeHeading(rule.heading).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "required";
    if (!section) {
      findings.push(makeFinding({
        ruleId: `${rulePrefix}-missing-${id}`,
        severity: rule.severity,
        section: rule.heading,
        message: `Required section is missing: ${rule.heading}.`
      }));
    } else if (section.content.replace(/\s+/g, " ").trim().length < rule.minChars) {
      findings.push(makeFinding({
        ruleId: `${rulePrefix}-too-short-${id}`,
        severity: rule.severity,
        section: rule.heading,
        message: `Section ${rule.heading} must contain at least ${rule.minChars} non-instruction characters.`,
        details: { actualChars: section.content.length, minimumChars: rule.minChars, line: section.startLine }
      }));
    }
  }
  return findings;
}

function checkboxFindings(markdown, rules) {
  const findings = [];
  for (const rule of rules) {
    const section = markdown.getSection(rule.section);
    if (!section) continue;
    if (section.checked.length < rule.minChecked) {
      findings.push(makeFinding({
        ruleId: "checkbox-minimum",
        severity: rule.severity,
        section: rule.section,
        message: `Section ${rule.section} requires at least ${rule.minChecked} checked item(s).`,
        details: { checked: section.checked.length, minimum: rule.minChecked }
      }));
    }
    const checked = new Set(section.checked.map((item) => normalizeHeading(item.text)));
    for (const required of rule.requiredTexts) {
      if (!checked.has(normalizeHeading(required))) {
        findings.push(makeFinding({
          ruleId: "checkbox-required-text",
          severity: rule.severity,
          section: rule.section,
          message: `Required checkbox is not checked: ${required}.`
        }));
      }
    }
  }
  return findings;
}

function patternFindings(markdown, rules, mode, prefix) {
  const findings = [];
  for (const rule of rules) {
    const matched = compilePattern(rule).test(markdown.visibleText);
    if ((mode === "required" && !matched) || (mode === "forbidden" && matched)) {
      findings.push(makeFinding({
        ruleId: `${prefix}-${rule.name || "pattern"}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        severity: rule.severity,
        message: rule.message,
        details: { pattern: rule.pattern, mode }
      }));
    }
  }
  return findings;
}

function labelFindings(labels, required, requiredAny, severity, prefix, details = {}) {
  const findings = [];
  const actual = new Set(labels.map((label) => normalizeHeading(label)));
  for (const label of required) {
    if (!actual.has(normalizeHeading(label))) {
      findings.push(makeFinding({
        ruleId: `${prefix}-label-required`,
        severity,
        message: `Required label is missing: ${label}.`,
        details: { ...details, required: label, actual: labels }
      }));
    }
  }
  if (requiredAny.length && !requiredAny.some((label) => actual.has(normalizeHeading(label)))) {
    findings.push(makeFinding({
      ruleId: `${prefix}-label-one-of`,
      severity,
      message: `At least one label is required: ${requiredAny.join(", ")}.`,
      details: { ...details, requiredAny, actual: labels }
    }));
  }
  return findings;
}

function checkedTextFindings(markdown, texts, severity, ruleName) {
  if (!texts.length) return [];
  const checked = new Set(markdown.sections.flatMap((section) => section.checked.map((item) => normalizeHeading(item.text))));
  return texts.filter((text) => !checked.has(normalizeHeading(text))).map((text) => makeFinding({
    ruleId: "path-rule-checkbox-required",
    severity,
    message: `Triggered rule ${ruleName} requires checked item: ${text}.`,
    details: { rule: ruleName, required: text }
  }));
}

function evaluatePathRules(markdown, input, config) {
  const findings = [];
  const triggered = [];
  for (const rule of config.pathRules) {
    const patterns = compileGlobs(rule.paths);
    const matchingFiles = input.files.filter((file) => matchesAny(file.path, patterns));
    if (!matchingFiles.length) continue;
    triggered.push({ name: rule.name, paths: matchingFiles.map((file) => file.path) });
    findings.push(...sectionFindings(markdown, rule.requireSections.map((section) => ({ ...section, severity: section.severity || rule.severity })), "path-section"));
    findings.push(...labelFindings(input.pullRequest.labels, rule.requireLabels, rule.requireAnyLabels, rule.severity, "path-rule", { rule: rule.name, matchingFiles: matchingFiles.map((file) => file.path) }));
    findings.push(...checkedTextFindings(markdown, rule.requireCheckedTexts, rule.severity, rule.name));
    findings.push(...patternFindings(markdown, rule.requirePatterns.map((pattern) => ({ ...pattern, severity: pattern.severity || rule.severity })), "required", `path-rule-${rule.name}`));
  }
  return { findings, triggered };
}

function evaluateLabelRules(input, config) {
  const findings = [];
  const triggered = [];
  for (const rule of config.labelRules) {
    const patterns = compileGlobs(rule.paths);
    const matchingFiles = input.files.filter((file) => matchesAny(file.path, patterns));
    if (!matchingFiles.length) continue;
    triggered.push({ name: rule.name, paths: matchingFiles.map((file) => file.path) });
    findings.push(...labelFindings(input.pullRequest.labels, rule.requireLabels, rule.requireAnyLabels, rule.severity, "label-rule", { rule: rule.name }));
  }
  return { findings, triggered };
}

function evaluateCommits(commits, config) {
  if (!config.enabled) return [];
  const pattern = new RegExp(config.pattern);
  const findings = [];
  for (const commit of commits) {
    if (config.ignoreMerges && /^Merge\b/.test(commit.message)) continue;
    if (!pattern.test(commit.message)) {
      findings.push(makeFinding({
        ruleId: "commit-message-pattern",
        severity: config.severity,
        message: `Commit subject does not match the configured contract: ${commit.message}`,
        details: { sha: commit.sha, pattern: config.pattern }
      }));
    }
    if (commit.message.length > config.maxSubjectLength) {
      findings.push(makeFinding({
        ruleId: "commit-message-length",
        severity: config.severity,
        message: `Commit subject is ${commit.message.length} characters; limit is ${config.maxSubjectLength}.`,
        details: { sha: commit.sha, subject: commit.message }
      }));
    }
  }
  return findings;
}

function evaluateSize(input, config) {
  const findings = [];
  for (const [name, actual, ruleId] of [
    ["Changed files", input.pullRequest.changedFiles, "pr-size-files"],
    ["Additions", input.pullRequest.additions, "pr-size-additions"],
    ["Deletions", input.pullRequest.deletions, "pr-size-deletions"]
  ]) {
    const key = ruleId.endsWith("files") ? "maxFiles" : ruleId.endsWith("additions") ? "maxAdditions" : "maxDeletions";
    const limit = config[key];
    if (actual > limit.limit) findings.push(makeFinding({
      ruleId,
      severity: limit.severity,
      message: `${name} is ${actual}; configured review threshold is ${limit.limit}.`,
      details: { actual, limit: limit.limit }
    }));
  }
  return findings;
}

export function evaluateContracts(input, config) {
  const started = performance.now();
  const markdown = parseMarkdown(input.pullRequest.body);
  let findings = [];
  const skipped = config.skipDrafts && input.pullRequest.draft;
  const triggered = { pathRules: [], labelRules: [] };
  if (!skipped) {
    if (config.title.pattern && !(new RegExp(config.title.pattern)).test(input.pullRequest.title)) {
      findings.push(makeFinding({
        ruleId: "pr-title-pattern",
        severity: config.title.severity,
        message: "Pull request title does not match the configured pattern.",
        details: { title: input.pullRequest.title, pattern: config.title.pattern }
      }));
    }
    if (input.pullRequest.title.length > config.title.maxLength) {
      findings.push(makeFinding({
        ruleId: "pr-title-length",
        severity: config.title.severity,
        message: `Pull request title is ${input.pullRequest.title.length} characters; limit is ${config.title.maxLength}.`
      }));
    }
    findings.push(...sectionFindings(markdown, config.requiredSections));
    findings.push(...checkboxFindings(markdown, config.checkboxes));
    findings.push(...patternFindings(markdown, config.forbiddenPlaceholders, "forbidden", "placeholder"));
    findings.push(...patternFindings(markdown, config.requiredPatterns, "required", "required"));
    const paths = evaluatePathRules(markdown, input, config);
    findings.push(...paths.findings);
    triggered.pathRules = paths.triggered;
    const labels = evaluateLabelRules(input, config);
    findings.push(...labels.findings);
    triggered.labelRules = labels.triggered;
    findings.push(...evaluateCommits(input.commits, config.commitRules));
    findings.push(...evaluateSize(input, config.sizeRules));
    if (config.aiDisclosure.required) {
      findings.push(...sectionFindings(markdown, [{ heading: config.aiDisclosure.section, minChars: config.aiDisclosure.minChars, severity: config.aiDisclosure.severity }], "ai-disclosure"));
    }
  }
  const deduplicated = [...new Map(findings.map((finding) => [finding.fingerprint, finding])).values()];
  deduplicated.sort((a, b) => {
    const rank = { error: 0, warning: 1, note: 2 };
    return rank[a.severity] - rank[b.severity] || a.ruleId.localeCompare(b.ruleId, "en") || a.message.localeCompare(b.message, "en");
  });
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    tool: { name: TOOL_NAME, version: TOOL_VERSION },
    generatedAt: new Date().toISOString(),
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    pullRequest: input.pullRequest,
    files: input.files,
    commits: input.commits,
    triggered,
    skipped,
    findings: deduplicated,
    summary: {
      errors: deduplicated.filter((finding) => finding.severity === "error").length,
      warnings: deduplicated.filter((finding) => finding.severity === "warning").length,
      notes: deduplicated.filter((finding) => finding.severity === "note").length,
      passed: skipped || !shouldFail(deduplicated, config.failLevel),
      failLevel: config.failLevel
    }
  };
}
