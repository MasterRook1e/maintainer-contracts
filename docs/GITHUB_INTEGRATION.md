# GitHub integration

## Recommended pull-request workflow

Evaluate the pull request against policy from the trusted base commit, not policy supplied by the pull-request branch.

```yaml
name: Pull request contract

on:
  pull_request:
    types: [opened, edited, synchronize, reopened, labeled, unlabeled]

permissions:
  contents: read
  pull-requests: read

jobs:
  contract:
    runs-on: ubuntu-latest
    steps:
      - name: Check out trusted base policy
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.base.sha }}

      - name: Evaluate contract
        uses: MasterRook1e/maintainer-contracts@v0.1.0
        with:
          policy: .github/maintainer-contracts.json
```

The action uses the workflow token only to read changed-file and commit metadata. The token is passed through an environment variable and is not written to reports.

## Why the base checkout matters

A pull-request author can modify files in their branch. If the workflow loads its policy from that branch, the author can weaken or remove the checks in the same pull request. Checking out `github.event.pull_request.base.sha` makes the policy an input controlled by maintainers.

## Fork safety

Use the ordinary `pull_request` event with read-only permissions. Do not switch to `pull_request_target` merely to gain secrets, and never combine `pull_request_target` with execution of code from an untrusted head branch.

## GitHub Enterprise Server

The composite action forwards `github.api_url`, so GitHub Enterprise Server installations use their own API endpoint automatically.

## Local evaluation

Use a normalized context fixture when no GitHub token is available:

```bash
maintainer-contracts \
  --policy .github/maintainer-contracts.json \
  --context context.json \
  --format markdown
```

The context format accepts `title`, `body`, `labels`, `files`, `commits`, and `stats`.
