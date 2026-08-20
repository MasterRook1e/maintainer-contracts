import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateContract } from '../src/evaluate.mjs';
import { checkedItems, parseSections } from '../src/markdown.mjs';
import { contextFromGitHubEvent } from '../src/event.mjs';

const policy = {
  requiredSections: [{ name: 'Summary', minLength: 10 }, 'Testing'],
  forbiddenPlaceholders: ['Describe what changed'],
  requiredCheckedItems: ['npm test'],
  minimumCheckedItems: 1,
  titlePattern: { pattern: '^(feat|fix|docs|chore)(\\(.+\\))?: .+' },
  commitPattern: { pattern: '^(feat|fix|docs|chore|test|refactor)(\\(.+\\))?: .+' },
  limits: { filesChanged: 20, changedLines: 500 },
  pathRules: [{
    id: 'security-review',
    include: ['src/security/**', 'src/auth/**'],
    require: { requiredSections: ['Security impact'], requiredLabels: ['security-review'] }
  }]
};

const good = {
  number: 7,
  title: 'feat: add policy engine',
  body: '## Summary\nA complete policy engine.\n\n## Testing\n- [x] npm test\n',
  labels: [],
  files: ['src/index.mjs'],
  commits: ['feat: add policy engine'],
  stats: { filesChanged: 2, additions: 30, deletions: 2, changedLines: 32 }
};

test('markdown parser ignores headings inside code fences and comments', () => {
  const sections = parseSections('<!-- ## Hidden -->\n## Summary\ntext\n```md\n## Fake\n```');
  assert.equal(sections.has('hidden'), false);
  assert.equal(sections.has('fake'), false);
  assert.equal(sections.get('summary'), 'text');
});

test('checked items only includes checked boxes', () => {
  assert.deepEqual(checkedItems('- [x] one\n- [ ] two'), ['one']);
});

test('valid pull request passes', () => {
  assert.equal(evaluateContract(good, policy).passed, true);
});

test('missing sections placeholders and malformed metadata fail', () => {
  const result = evaluateContract({ ...good, title: 'bad', body: 'Describe what changed', commits: ['oops'] }, policy);
  assert.equal(result.passed, false);
  assert.ok(result.findings.some((entry) => entry.rule === 'body.required-section'));
  assert.ok(result.findings.some((entry) => entry.rule === 'body.placeholder'));
  assert.ok(result.findings.some((entry) => entry.rule === 'title.pattern'));
  assert.ok(result.findings.some((entry) => entry.rule === 'commit.pattern'));
});

test('path rules activate only for matching files', () => {
  const result = evaluateContract({ ...good, files: ['src/security/token.mjs'] }, policy);
  assert.deepEqual(result.activatedRules, ['security-review']);
  assert.ok(result.findings.some((entry) => entry.rule === 'body.required-section' && entry.section === 'Security impact'));
  assert.ok(result.findings.some((entry) => entry.rule === 'labels.required'));
});

test('size limits are enforced', () => {
  const result = evaluateContract({ ...good, stats: { filesChanged: 30, additions: 500, deletions: 100, changedLines: 600 } }, policy);
  assert.ok(result.findings.some((entry) => entry.rule === 'limits.filesChanged'));
  assert.ok(result.findings.some((entry) => entry.rule === 'limits.changedLines'));
});

test('GitHub event normalizer is deterministic', () => {
  const context = contextFromGitHubEvent({
    number: 4,
    pull_request: { title: 'docs: x', body: 'body', labels: [{ name: 'docs' }], changed_files: 1, additions: 2, deletions: 1 },
    files: ['README.md'],
    commits: ['docs: x']
  });
  assert.equal(context.number, 4);
  assert.deepEqual(context.labels, ['docs']);
  assert.equal(context.stats.changedLines, 3);
});
