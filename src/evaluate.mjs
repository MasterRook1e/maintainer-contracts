import { matchesAny } from './glob.mjs';
import { checkedItems, parseSections, stripCodeFences } from './markdown.mjs';

const finding = (rule, message, data = {}) => ({ rule, level: 'error', message, ...data });

function testPattern(value, pattern, flags = '') {
  try {
    return new RegExp(pattern, flags).test(value ?? '');
  } catch (error) {
    throw new Error(`Invalid regular expression ${pattern}: ${error.message}`);
  }
}

function evaluateBodyRules(context, policy, findings) {
  const body = context.body ?? '';
  const clean = stripCodeFences(body);
  const sections = parseSections(body);
  const checks = checkedItems(body);

  for (const rule of policy.requiredSections ?? []) {
    const name = typeof rule === 'string' ? rule : rule.name;
    const minimum = typeof rule === 'string' ? 1 : (rule.minLength ?? 1);
    const content = sections.get(name.toLowerCase());
    if (content === undefined) {
      findings.push(finding('body.required-section', `Missing required section: ${name}`, { section: name }));
    } else if (content.replace(/\s+/g, ' ').trim().length < minimum) {
      findings.push(finding('body.section-length', `${name} must contain at least ${minimum} non-whitespace characters.`, { section: name }));
    }
  }

  for (const placeholder of policy.forbiddenPlaceholders ?? []) {
    if (clean.toLowerCase().includes(String(placeholder).toLowerCase())) {
      findings.push(finding('body.placeholder', `PR body still contains placeholder text: ${placeholder}`));
    }
  }

  for (const required of policy.requiredCheckedItems ?? []) {
    if (!checks.some((item) => item.toLowerCase().includes(required.toLowerCase()))) {
      findings.push(finding('body.required-check', `Required checklist item is not checked: ${required}`));
    }
  }
  if ((policy.minimumCheckedItems ?? 0) > checks.length) {
    findings.push(finding('body.minimum-checks', `At least ${policy.minimumCheckedItems} checklist items must be checked; found ${checks.length}.`));
  }

  for (const rule of policy.bodyPatterns ?? []) {
    if (!testPattern(clean, rule.pattern, rule.flags)) {
      findings.push(finding(rule.id ?? 'body.pattern', rule.message ?? `PR body must match ${rule.pattern}.`));
    }
  }
}

function evaluateMetadata(context, policy, findings) {
  if (policy.titlePattern && !testPattern(context.title, policy.titlePattern.pattern, policy.titlePattern.flags)) {
    findings.push(finding('title.pattern', policy.titlePattern.message ?? 'Pull request title does not match policy.'));
  }

  const labels = new Set((context.labels ?? []).map((label) => label.toLowerCase()));
  for (const label of policy.requiredLabels ?? []) {
    if (!labels.has(label.toLowerCase())) findings.push(finding('labels.required', `Missing required label: ${label}`, { label }));
  }

  for (const commit of context.commits ?? []) {
    if (policy.commitPattern && !testPattern(commit, policy.commitPattern.pattern, policy.commitPattern.flags)) {
      findings.push(finding('commit.pattern', policy.commitPattern.message ?? `Commit subject does not match policy: ${commit}`, { commit }));
    }
  }

  const stats = context.stats ?? {};
  for (const [key, label] of [['filesChanged', 'changed files'], ['additions', 'additions'], ['deletions', 'deletions'], ['changedLines', 'changed lines']]) {
    const limit = policy.limits?.[key];
    if (limit !== undefined && (stats[key] ?? 0) > limit) {
      findings.push(finding(`limits.${key}`, `Pull request has ${stats[key]} ${label}; limit is ${limit}.`, {
        actual: stats[key],
        limit
      }));
    }
  }
}

function mergeRules(base, extra) {
  const arrayKeys = ['requiredSections', 'forbiddenPlaceholders', 'requiredCheckedItems', 'bodyPatterns', 'requiredLabels'];
  const result = { ...base, ...extra, limits: { ...(base.limits ?? {}), ...(extra.limits ?? {}) } };
  for (const key of arrayKeys) result[key] = [...(base[key] ?? []), ...(extra[key] ?? [])];
  return result;
}

export function evaluateContract(context, policy) {
  const findings = [];
  let effective = policy;
  const activatedRules = [];

  for (const pathRule of policy.pathRules ?? []) {
    const include = pathRule.include ?? ['**'];
    const exclude = pathRule.exclude ?? [];
    const matched = (context.files ?? []).some((file) => matchesAny(file, include) && !matchesAny(file, exclude));
    if (matched) {
      activatedRules.push(pathRule.id ?? 'unnamed-path-rule');
      effective = mergeRules(effective, pathRule.require ?? {});
    }
  }

  evaluateBodyRules(context, effective, findings);
  evaluateMetadata(context, effective, findings);
  return {
    schemaVersion: 1,
    passed: findings.length === 0,
    activatedRules,
    findings,
    context: { number: context.number ?? null, title: context.title ?? '', files: context.files ?? [] }
  };
}
