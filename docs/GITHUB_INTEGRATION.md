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
        uses: MasterRook1e/maintainer-contracts@v0
        with:
          config: .github/maintainer-contracts.json
          token: ${{ github.token }}
```

The action uses the token only to read pull-request file and commit metadata. It passes the token through the environment, never places it on the command line, and never writes it to reports.

## Why the base checkout matters

A pull-request author can modify files in their branch. If a workflow loads policy or a local action implementation from that branch, the author can weaken the check in the same pull request. Checking out `github.event.pull_request.base.sha` keeps policy and the local repository boundary under maintainer control.

The action obtains proposed-change metadata from the GitHub API, so it does not need to check out or execute the untrusted head revision.

## Completeness and pagination

The action follows GitHub pagination for both changed files and commits. It fails when:

- a page request fails,
- a request times out,
- the configured page ceiling is exceeded,
- the fetched changed-file count disagrees with the event payload.

Failing closed prevents a large or partially fetched pull request from receiving a misleading passing decision.

## Fork safety

Use the ordinary `pull_request` event with read-only permissions. Do not switch to `pull_request_target` merely to gain secrets, and never combine `pull_request_target` with execution of code from an untrusted head branch.

The automatic `github.token` is sufficient when the caller grants `contents: read` and `pull-requests: read`.

## GitHub Enterprise Server

The composite action forwards `github.api_url`, so GitHub Enterprise Server installations use their own API endpoint automatically.

## Local evaluation

Local Git mode remains available when API access is not desired:

```bash
maintainer-contracts check \
  --event event.json \
  --git-root . \
  --config .github/maintainer-contracts.json
```

For fully deterministic tests, provide explicit JSON evidence:

```bash
maintainer-contracts check \
  --event event.json \
  --files files.json \
  --commits commits.json \
  --config .github/maintainer-contracts.json
```
