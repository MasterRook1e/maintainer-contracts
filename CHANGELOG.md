# Changelog

## Unreleased

- preserve previous filenames in GitHub, local Git, and explicit JSON rename evidence
- evaluate path and label contracts against both sides of a rename without double-counting file statistics
- parse NUL-delimited Git numstat records for Unicode, tab/newline filenames, binaries, and renames
- resolve range refs to commit IDs and disable external diff/textconv helpers during local inspection
- add negative, policy, fixture/API, and real-Git rename regression coverage; document report compatibility in `docs/RENAMED_FILES.md`

## 0.1.2

- fixed an invalid expression in composite-action input metadata that prevented GitHub from loading the action
- added a regression test that rejects unsupported expression syntax in top-level action metadata
- verified that API tokens are supplied explicitly by callers and only forwarded through the action environment

## 0.1.1

- added authenticated GitHub API evidence acquisition for pull-request files and commits
- added bounded pagination, request timeouts, and fail-closed changed-file completeness checks
- kept tokens out of command-line arguments, reports, and API error bodies
- added public library export and focused API, pagination, token-safety, and completeness tests
- removed an unreachable duplicate evaluator and its omitted failing test
- removed duplicate issue forms, a temporary upload probe, and a broken redundant workflow
- documented trusted-base checkout and fork-safe action integration
- retained clean packed-tarball consumer verification on every supported CI platform

## 0.1.0

- initial dependency-free CLI and library API
- Markdown section and checklist parser
- path-aware sections, labels, patterns, and checklist requirements
- title, commit, placeholder, linked-pattern, and PR-size rules
- GitHub event normalization and local Git range inspection
- console, JSON, Markdown, and workflow-annotation reporters
- composite GitHub Action and three-platform CI
