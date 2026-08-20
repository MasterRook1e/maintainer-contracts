import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const SEVERITY_RANK = Object.freeze({ note: 0, warning: 1, error: 2 });

export function normalizeSeverity(value, fallback = "error") {
  return Object.hasOwn(SEVERITY_RANK, value) ? value : fallback;
}

export function shouldFail(findings, failLevel) {
  if (failLevel === "off") return false;
  const threshold = SEVERITY_RANK[normalizeSeverity(failLevel, "error")];
  return findings.some((finding) => SEVERITY_RANK[finding.severity] >= threshold);
}

export function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject(value[key])]));
}

export function stableStringify(value, space = 2) {
  return `${JSON.stringify(stableObject(value), null, space)}\n`;
}

export function fingerprint(parts) {
  return crypto.createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 24);
}

export function makeFinding({ ruleId, severity, message, path: findingPath = null, section = null, details = {}, help = null }) {
  const normalized = normalizeSeverity(severity, "error");
  return {
    ruleId,
    severity: normalized,
    message,
    path: findingPath,
    section,
    details,
    help,
    fingerprint: fingerprint([ruleId, normalized, findingPath || "", section || "", message])
  };
}

export function toPosix(value) {
  return String(value).replace(/\\/g, "/");
}

export function normalizeRelative(value) {
  const normalized = path.posix.normalize(toPosix(value || "."));
  return normalized === "." ? "" : normalized.replace(/^\.\//, "");
}

export function escapeWorkflowCommand(value) {
  return String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

export function escapeMarkdown(value) {
  return String(value).replace(/([|\\])/g, "\\$1").replace(/\r?\n/g, " ");
}

export async function writeTextAtomic(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporary, content, "utf8");
  await fs.rename(temporary, filePath);
}

export function asStringArray(value, label) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map(String);
}

export function normalizeHeading(value) {
  return String(value)
    .replace(/[`*_~]/g, "")
    .replace(/\s+#+\s*$/, "")
    .trim()
    .toLocaleLowerCase("en-US");
}
