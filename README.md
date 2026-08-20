# Maintainer Contracts

[![CI](https://github.com/MasterRook1e/maintainer-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/MasterRook1e/maintainer-contracts/actions/workflows/ci.yml)
[![Action smoke test](https://github.com/MasterRook1e/maintainer-contracts/actions/workflows/example.yml/badge.svg)](https://github.com/MasterRook1e/maintainer-contracts/actions/workflows/example.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A dependency-free policy-as-code engine for pull-request descriptions, changed paths, labels, checklists, commit subjects, and review-size thresholds.

It is built for maintainers who want review evidence to scale with the risk of a change. A documentation-only pull request should not need the same contract as authentication, schema, release, or public API changes.

## Core idea

```text
pull_request event + GitHub API / local Git / explicit fixtures
                              |
                              v
                  normalized review evidence
                              |
              +---------------+---------------+
              |               |               |
          PR sections     path rules      commit rules
              |               |               |
              +---------------+---------------+
                              |
                              v
               console / JSON / Markdown / annotations
```

## Features

- Markdown section parsing that ignores fenced code and HTML comments
- required sections with minimum meaningful content
- required checked items and checklist counts
- forbidden template placeholders
- required body patterns such as linked issues
- path-aware requirements for sections, labels, patterns, and checked evidence
- independent label rules
- commit-subject contracts
- PR title and review-size thresholds
- complete GitHub pull-request file and commit pagination
- fail-closed evidence-count validation
- local `git diff --numstat` and commit-range inspection
- deterministic fixtures for offline and cross-CI use
- GitHub workflow annotations and action outputs
- deterministic JSON and Markdown reports
- no runtime package dependencies

## Secure GitHub Action setup

Use the ordinary `pull_request` event, read-only permissions, and policy from the trusted base revision:

```yaml
name: Pull request contracts

on:
  pull_request:
    types: [opened, edited, synchronize, reopened, labeled, unlabeled]

permissions:
  contents: read
  pull-requests: read

jobs:
  contracts:
    runs-on: ubuntu-latest
    steps:
      - name: Check out trusted base policy
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.base.sha }}

      - name: Evaluate review contract
        uses: MasterRook1e/maintainer-contracts@v0
        with:
          config: maintainer-contracts.config.json
          token: ${{ github.token }}
```

The action obtains changed-file statistics and commit subjects from the GitHub API. It never executes source from the pull-request branch. The `v0` branch tracks compatible 0.x action releases; security-sensitive consumers may pin an immutable commit SHA.

See [docs/GITHUB_INTEGRATION.md](docs/GITHUB_INTEGRATION.md) for the threat boundary and fork-safe setup.

## Path-aware policy example

```json
{
  "version": 1,
  "requiredSections": [
    { "heading": "Summary", "minChars": 40 },
    { "heading": "Validation", "minChars": 10 }
  ],
  "pathRules": [
    {
      "name": "security-sensitive-change",
      "paths": ["**/auth/**", "**/security/**", "**/*permission*"],
      "requireSections": [
        { "heading": "Security impact", "minChars": 30 }
      ],
      "requireAnyLabels": ["security-reviewed", "security-not-applicable"],
      "requireCheckedTexts": ["Threat model reviewed"],
      "severity": "error"
    },
    {
      "name": "public-api-change",
      "paths": ["src/public/**", "packages/*/src/index.*", "**/schemas/**"],
      "requireSections": [
        { "heading": "Compatibility", "minChars": 30 }
      ],
      "requireCheckedTexts": ["Compatibility impact documented"],
      "severity": "error"
    }
  ]
}
```

Only matching paths trigger these additional requirements.

## Local use

Install and generate an example policy:

```bash
npm install --save-dev maintainer-contracts
npx maintainer-contracts init
```

Inspect a local base/head range:

```bash
maintainer-contracts check \
  --event event.json \
  --git-root . \
  --config maintainer-contracts.config.json
```

Fetch complete evidence directly from GitHub without placing the token on the command line:

```bash
GITHUB_TOKEN=... maintainer-contracts check \
  --event event.json \
  --github-api \
  --github-repository owner/repository \
  --config maintainer-contracts.config.json
```

For deterministic offline tests, supply files and commits explicitly:

```bash
maintainer-contracts check \
  --event examples/event.json \
  --files examples/files.json \
  --commits examples/commits.json \
  --config examples/maintainer-contracts.config.json \
  --format json
```

## Evidence guarantees

GitHub API mode:

- follows pagination for files and commits
- fails closed when the configured page ceiling is exceeded
- compares the fetched file count with `pull_request.changed_files`
- uses a per-request timeout
- keeps the token in the Authorization header only
- omits response bodies from API errors to avoid accidental secret reflection

Local Git and explicit-fixture modes remain network-free.

## Reports and outputs

```bash
maintainer-contracts check --event "$GITHUB_EVENT_PATH" --github-api --report-dir .maintainer-contracts
```

This writes `report.json` and `report.md`. In GitHub Actions, the action also exposes:

- `passed`
- `errors`
- `warnings`

## AI-assisted development

The tool does not decide whether AI use is good or bad. It lets a repository require a transparent `AI assistance` section, evidence of human review, or extra checks for paths where AI-generated changes carry more risk.

The default configuration does not require AI disclosure. The generated example does, because maintainers should choose that policy deliberately.

## Public dogfooding and adoption evidence

The action is exercised against deterministic fixtures and real pull-request events in public repositories. Current integrations are recorded in [docs/ADOPTION.md](docs/ADOPTION.md).

All currently recorded integrations are maintained by the same GitHub owner. They demonstrate public dogfooding and cross-repository use, not independent external adoption. No npm download count or third-party user count is claimed before verifiable evidence exists.

## Status

`0.1.2` fixes composite-action manifest loading, adds a regression test for top-level metadata expressions, and retains the authenticated, paginated, fail-closed evidence pipeline introduced in `0.1.1`. The package has not yet been published to npm.

## License

MIT.
