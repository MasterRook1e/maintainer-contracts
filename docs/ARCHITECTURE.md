# Architecture

Maintainer Contracts uses four explicit layers.

1. **Evidence acquisition** normalizes a GitHub pull-request event and obtains changed paths, additions/deletions, and commit subjects from one of three interchangeable sources:
   - the authenticated GitHub API,
   - a local Git base/head range,
   - explicit deterministic JSON fixtures.
2. **Markdown parsing** creates section and checklist evidence while ignoring fenced code and HTML comments.
3. **Policy evaluation** applies global rules, path rules, label rules, commit rules, and review-size thresholds.
4. **Reporting** emits deterministic console, JSON, Markdown, and GitHub workflow annotations.

## Evidence-source boundary

Evidence acquisition is deliberately separate from policy evaluation. The evaluator receives one normalized structure regardless of where the evidence originated. This keeps policy behavior deterministic and makes the networked boundary independently testable.

GitHub API mode follows paginated `files` and `commits` endpoints, enforces a page ceiling, applies a request timeout, and checks the fetched file count against the pull-request event. A disagreement is treated as an input failure rather than silently evaluating incomplete evidence.

Local Git mode invokes `git` with argument arrays and never uses a shell. Fixture mode reads JSON only. Neither mode performs network requests.

## Trusted policy, untrusted change

The recommended GitHub workflow checks out the pull request's base SHA. Repository policy is therefore controlled by maintainers rather than by the pull-request branch. The action reads change metadata through the read-only GitHub API and does not execute source from the proposed change.

## Rule activation

Path and label rules first compute matching changed files. A rule that does not match emits no findings and imposes no additional burden. Triggered rules are included in the report so reviewers can understand why evidence was required.

## Non-goals

The project does not approve a pull request, infer security correctness, score developers, call language models, or replace human review. It checks that the repository's declared review contract is satisfied by available evidence.
