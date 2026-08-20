import { escapeMarkdown, escapeWorkflowCommand, stableStringify } from "./util.mjs";

export function renderConsole(result) {
  const lines = [
    `Maintainer Contracts ${result.tool.version}`,
    `PR #${result.pullRequest.number || "?"}: ${result.pullRequest.title || "[untitled]"}`,
    `Files: ${result.pullRequest.changedFiles} | +${result.pullRequest.additions} -${result.pullRequest.deletions}`,
    `Findings: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s), ${result.summary.notes} note(s)`
  ];
  if (result.skipped) lines.push("Draft policy: skipped");
  if (result.triggered.pathRules.length) {
    lines.push(`Triggered path rules: ${result.triggered.pathRules.map((rule) => rule.name).join(", ")}`);
  }
  if (result.findings.length) {
    lines.push("");
    for (const finding of result.findings) {
      lines.push(`${finding.severity.toUpperCase().padEnd(7)} ${finding.ruleId}${finding.section ? ` [${finding.section}]` : ""}: ${finding.message}`);
    }
  }
  lines.push("", result.summary.passed ? "PASS" : "FAIL");
  return `${lines.join("\n")}\n`;
}

export function renderJson(result) {
  return stableStringify(result);
}

export function renderMarkdown(result) {
  const lines = [
    "# Maintainer Contracts report",
    "",
    `**Status:** ${result.summary.passed ? "PASS" : "FAIL"}`,
    "",
    "| Metric | Value |",
    "|---|---:|",
    `| Changed files | ${result.pullRequest.changedFiles} |`,
    `| Additions | ${result.pullRequest.additions} |`,
    `| Deletions | ${result.pullRequest.deletions} |`,
    `| Errors | ${result.summary.errors} |`,
    `| Warnings | ${result.summary.warnings} |`,
    `| Notes | ${result.summary.notes} |`,
    "",
    "## Findings",
    ""
  ];
  if (!result.findings.length) lines.push("No findings.");
  else {
    lines.push("| Severity | Rule | Section | Message |", "|---|---|---|---|");
    for (const finding of result.findings) {
      lines.push(`| ${finding.severity} | \`${escapeMarkdown(finding.ruleId)}\` | ${escapeMarkdown(finding.section || "")} | ${escapeMarkdown(finding.message)} |`);
    }
  }
  if (result.triggered.pathRules.length) {
    lines.push("", "## Triggered path rules", "");
    for (const rule of result.triggered.pathRules) lines.push(`- **${escapeMarkdown(rule.name)}:** ${rule.paths.map((item) => `\`${escapeMarkdown(item)}\``).join(", ")}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function renderGitHubAnnotations(result) {
  return result.findings.map((finding) => {
    const command = finding.severity === "error" ? "error" : finding.severity === "warning" ? "warning" : "notice";
    const title = escapeWorkflowCommand(`${finding.ruleId}${finding.section ? ` · ${finding.section}` : ""}`);
    return `::${command} title=${title}::${escapeWorkflowCommand(finding.message)}`;
  }).join("\n") + (result.findings.length ? "\n" : "");
}

export function renderReport(result, format) {
  if (format === "json") return renderJson(result);
  if (format === "markdown" || format === "md") return renderMarkdown(result);
  if (format === "github") return renderGitHubAnnotations(result);
  return renderConsole(result);
}
