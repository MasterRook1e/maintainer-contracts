import fs from "node:fs/promises";
import path from "node:path";
import { asStringArray, normalizeSeverity } from "./util.mjs";

export const DEFAULT_CONFIG = Object.freeze({
  version: 1,
  failLevel: "error",
  skipDrafts: false,
  title: {
    pattern: null,
    maxLength: 100,
    severity: "warning"
  },
  requiredSections: [
    { heading: "Summary", minChars: 40, severity: "error" },
    { heading: "Validation", minChars: 10, severity: "error" }
  ],
  checkboxes: [
    { section: "Validation", minChecked: 1, severity: "error" }
  ],
  forbiddenPlaceholders: [
    { pattern: "\\b(?:TODO|TBD|FIXME)\\b", flags: "i", severity: "warning", message: "PR body contains an unresolved placeholder." },
    { pattern: "Describe (?:what|the)|List anything|Explain why", flags: "i", severity: "warning", message: "PR body still contains template instruction text." }
  ],
  requiredPatterns: [],
  pathRules: [],
  labelRules: [],
  commitRules: {
    enabled: true,
    pattern: "^(?:feat|fix|docs|test|refactor|perf|build|ci|chore)(?:\\([^)]+\\))?!?: .+",
    maxSubjectLength: 100,
    ignoreMerges: true,
    severity: "error"
  },
  sizeRules: {
    maxFiles: { limit: 100, severity: "warning" },
    maxAdditions: { limit: 3000, severity: "warning" },
    maxDeletions: { limit: 3000, severity: "warning" }
  },
  aiDisclosure: {
    section: "AI assistance",
    required: false,
    minChars: 10,
    severity: "warning"
  }
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeObject(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return override ?? base;
  const output = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
  for (const [key, value] of Object.entries(override)) {
    output[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeObject(output[key], value)
      : value;
  }
  return output;
}

function normalizeSection(rule, label) {
  if (!rule || typeof rule !== "object" || !rule.heading) throw new Error(`${label} requires heading`);
  return {
    heading: String(rule.heading),
    minChars: Math.max(0, Number(rule.minChars || 0)),
    severity: normalizeSeverity(rule.severity, "error")
  };
}

function normalizePattern(rule, label) {
  if (typeof rule === "string") return { pattern: rule, flags: "i", severity: "error", message: label };
  if (!rule || typeof rule !== "object" || !rule.pattern) throw new Error(`${label} requires pattern`);
  return {
    name: rule.name ? String(rule.name) : null,
    pattern: String(rule.pattern),
    flags: String(rule.flags || "i"),
    severity: normalizeSeverity(rule.severity, "error"),
    message: String(rule.message || label)
  };
}

function normalizeLimit(value, fallbackLimit, fallbackSeverity = "warning") {
  if (value == null) return { limit: fallbackLimit, severity: fallbackSeverity };
  if (typeof value === "number") return { limit: value, severity: fallbackSeverity };
  return { limit: Number(value.limit), severity: normalizeSeverity(value.severity, fallbackSeverity) };
}

export function normalizeConfig(input) {
  const config = mergeObject(clone(DEFAULT_CONFIG), input || {});
  if (config.version !== 1) throw new Error(`unsupported config version: ${config.version}`);
  config.failLevel = config.failLevel === "off" ? "off" : normalizeSeverity(config.failLevel, "error");
  config.title.severity = normalizeSeverity(config.title.severity, "warning");
  config.title.maxLength = Math.max(1, Number(config.title.maxLength || 100));
  config.requiredSections = (config.requiredSections || []).map((rule, index) => normalizeSection(rule, `requiredSections[${index}]`));
  config.checkboxes = (config.checkboxes || []).map((rule, index) => {
    if (!rule?.section) throw new Error(`checkboxes[${index}] requires section`);
    return {
      section: String(rule.section),
      minChecked: Math.max(0, Number(rule.minChecked || 0)),
      requiredTexts: asStringArray(rule.requiredTexts, `checkboxes[${index}].requiredTexts`),
      severity: normalizeSeverity(rule.severity, "error")
    };
  });
  config.forbiddenPlaceholders = (config.forbiddenPlaceholders || []).map((rule, index) => normalizePattern(rule, `forbiddenPlaceholders[${index}]`));
  config.requiredPatterns = (config.requiredPatterns || []).map((rule, index) => normalizePattern(rule, `requiredPatterns[${index}]`));
  config.pathRules = (config.pathRules || []).map((rule, index) => {
    if (!rule?.name) throw new Error(`pathRules[${index}] requires name`);
    return {
      name: String(rule.name),
      paths: asStringArray(rule.paths, `pathRules[${index}].paths`),
      requireSections: (rule.requireSections || []).map((section, sectionIndex) => normalizeSection(section, `pathRules[${index}].requireSections[${sectionIndex}]`)),
      requireLabels: asStringArray(rule.requireLabels, `pathRules[${index}].requireLabels`),
      requireAnyLabels: asStringArray(rule.requireAnyLabels, `pathRules[${index}].requireAnyLabels`),
      requirePatterns: (rule.requirePatterns || []).map((pattern, patternIndex) => normalizePattern(pattern, `pathRules[${index}].requirePatterns[${patternIndex}]`)),
      requireCheckedTexts: asStringArray(rule.requireCheckedTexts, `pathRules[${index}].requireCheckedTexts`),
      severity: normalizeSeverity(rule.severity, "error")
    };
  });
  config.labelRules = (config.labelRules || []).map((rule, index) => ({
    name: String(rule?.name || `label-rule-${index + 1}`),
    paths: asStringArray(rule.paths, `labelRules[${index}].paths`),
    requireLabels: asStringArray(rule.requireLabels, `labelRules[${index}].requireLabels`),
    requireAnyLabels: asStringArray(rule.requireAnyLabels, `labelRules[${index}].requireAnyLabels`),
    severity: normalizeSeverity(rule.severity, "warning")
  }));
  config.commitRules.severity = normalizeSeverity(config.commitRules.severity, "error");
  config.commitRules.maxSubjectLength = Math.max(1, Number(config.commitRules.maxSubjectLength || 100));
  config.sizeRules.maxFiles = normalizeLimit(config.sizeRules.maxFiles, 100);
  config.sizeRules.maxAdditions = normalizeLimit(config.sizeRules.maxAdditions, 3000);
  config.sizeRules.maxDeletions = normalizeLimit(config.sizeRules.maxDeletions, 3000);
  config.aiDisclosure.severity = normalizeSeverity(config.aiDisclosure.severity, "warning");
  config.aiDisclosure.minChars = Math.max(0, Number(config.aiDisclosure.minChars || 0));
  return config;
}

export async function loadConfig({ projectRoot = process.cwd(), configPath = null }) {
  const root = path.resolve(projectRoot);
  let source = {};
  let resolved = null;
  if (configPath) {
    resolved = path.resolve(root, configPath);
    source = JSON.parse(await fs.readFile(resolved, "utf8"));
  } else {
    for (const candidate of ["maintainer-contracts.config.json", ".maintainer-contracts.json"]) {
      try {
        resolved = path.join(root, candidate);
        source = JSON.parse(await fs.readFile(resolved, "utf8"));
        break;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        resolved = null;
      }
    }
  }
  return { projectRoot: root, configPath: resolved, config: normalizeConfig(source) };
}

export function createExampleConfig() {
  return {
    version: 1,
    title: {
      pattern: "^(?:feat|fix|docs|test|refactor|perf|build|ci|chore)(?:\\([^)]+\\))?!?: .+",
      maxLength: 100,
      severity: "warning"
    },
    requiredSections: [
      { heading: "Summary", minChars: 40, severity: "error" },
      { heading: "Validation", minChars: 10, severity: "error" },
      { heading: "AI assistance", minChars: 10, severity: "warning" }
    ],
    checkboxes: [
      { section: "Validation", minChecked: 1, severity: "error" }
    ],
    requiredPatterns: [
      { name: "linked issue", pattern: "(?:Closes|Fixes|Resolves)\\s+#\\d+", flags: "i", severity: "warning", message: "Link a tracked issue with Closes/Fixes/Resolves #number." }
    ],
    pathRules: [
      {
        name: "security-sensitive-change",
        paths: ["**/auth/**", "**/security/**", "**/*secret*", "**/*permission*"],
        requireSections: [{ heading: "Security impact", minChars: 30 }],
        requireAnyLabels: ["security-reviewed", "security-not-applicable"],
        requireCheckedTexts: ["Threat model reviewed"],
        severity: "error"
      },
      {
        name: "public-api-change",
        paths: ["src/public/**", "packages/*/src/index.*", "**/schemas/**"],
        requireSections: [{ heading: "Compatibility", minChars: 30 }],
        requireCheckedTexts: ["Compatibility impact documented"],
        severity: "error"
      }
    ],
    commitRules: {
      enabled: true,
      pattern: "^(?:feat|fix|docs|test|refactor|perf|build|ci|chore)(?:\\([^)]+\\))?!?: .+",
      maxSubjectLength: 100,
      ignoreMerges: true,
      severity: "error"
    },
    failLevel: "error"
  };
}
