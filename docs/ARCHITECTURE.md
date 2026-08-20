# Architecture

Maintainer Contracts uses four explicit layers.

1. **Evidence acquisition** normalizes a GitHub pull-request event and, when requested, obtains changed paths, additions/deletions, and commit subjects from a local Git range.
2. **Markdown parsing** creates section and checklist evidence while ignoring fenced code and HTML comments.
3. **Policy evaluation** applies global rules, path rules, label rules, commit rules, and review-size thresholds.
4. **Reporting** emits deterministic console, JSON, Markdown, and GitHub workflow annotations.

## Why local Git instead of GitHub API calls?

The action already has a checked-out repository. Local Git avoids additional API permissions, token handling, pagination, rate limits, and fork-specific authentication behavior. It also keeps the core CLI useful in other CI systems.

## Rule activation

Path and label rules first compute matching changed files. A rule that does not match emits no findings and imposes no additional burden. Triggered rules are included in the report so reviewers can understand why evidence was required.

## Non-goals

The project does not approve a pull request, infer security correctness, score developers, call language models, or replace human review. It checks that the repository's declared review contract is satisfied by available evidence.
