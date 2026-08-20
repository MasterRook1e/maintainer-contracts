# Maintainer Contracts

A dependency-free policy-as-code engine for pull-request descriptions, changed paths, labels, checklists, commit subjects, and review-size thresholds.

It is built for maintainers who want review evidence to scale with the risk of a change. A documentation-only pull request should not need the same contract as authentication, schema, release, or public API changes.

## Core idea

```text
pull_request event + local Git range + declarative policy
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
- GitHub pull-request event normalization
- local `git diff --numstat` and commit-range inspection
- GitHub workflow annotations and action outputs
- deterministic JSON and Markdown reports
- no runtime dependencies and no network calls

## Quick start

```bash
npm install --save-dev maintainer-contracts
npx maintainer-contracts init
```

Add a pull-request workflow:

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: MasterRook1e/maintainer-contracts@v0
        with:
          config: maintainer-contracts.config.json
```

`fetch-depth: 0` is required when the action must inspect changed files and commit subjects from the base/head range.

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

```bash
maintainer-contracts check \
  --event event.json \
  --git-root . \
  --config maintainer-contracts.config.json
```

For deterministic offline tests, supply changed files and commits explicitly:

```bash
maintainer-contracts check \
  --event examples/event.json \
  --files examples/files.json \
  --commits examples/commits.json \
  --config examples/maintainer-contracts.config.json \
  --format json
```

## Reports and outputs

```bash
maintainer-contracts check --event "$GITHUB_EVENT_PATH" --git-root . --report-dir .maintainer-contracts
```

This writes `report.json` and `report.md`. In GitHub Actions, the action also exposes:

- `passed`
- `errors`
- `warnings`

## AI-assisted development

The tool does not decide whether AI use is good or bad. It lets a repository require a transparent `AI assistance` section, evidence of human review, or extra checks for paths where AI-generated changes carry more risk.

The default configuration does not require AI disclosure. The generated example does, because maintainers should choose that policy deliberately.

## Security model

The CLI parses Markdown/JSON and invokes `git` with argument arrays. It does not execute repository source, evaluate JavaScript configuration, call the GitHub API, or send event data over the network.

## Status

`0.1.0` is an initial public-ready implementation with tests, a JSON Schema, composite GitHub Action, path-aware rules, local Git evidence, and a three-platform Node.js CI matrix. It has not yet been published to npm.

## License

MIT.
