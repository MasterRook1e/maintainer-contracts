# Changelog

## Unreleased

- Added a clean packed-tarball consumer test that validates the npm file allowlist,
  installs the generated package into a temporary repository, runs the installed CLI, and
  imports the installed library API on every supported CI platform.

## 0.1.0

- initial dependency-free CLI and library API
- Markdown section and checklist parser
- path-aware sections, labels, patterns, and checklist requirements
- title, commit, placeholder, linked-pattern, and PR-size rules
- GitHub event normalization and local Git range inspection
- console, JSON, Markdown, and workflow-annotation reporters
- composite GitHub Action and three-platform CI
