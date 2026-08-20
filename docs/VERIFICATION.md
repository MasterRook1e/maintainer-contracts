# Public verification record

This record documents reproducible public checks without presenting maintainer-owned dogfooding as independent adoption.

## Cross-repository composite-action verification

`MasterRook1e/miniapp-packguard` pull request #16 exercised the immutable Maintainer Contracts action from a separate public repository.

The first run against `0.1.1` failed while GitHub loaded `action.yml`. The failure exposed unsupported expression syntax in top-level action input metadata. That defect was fixed in `0.1.2`, and a regression test was added before re-running the consumer workflow.

The clean re-run against commit `602c3e16b8bbb81d69ee02d270a2d620b7216156` completed with:

- Maintainer contracts run #41: success
- MiniApp PackGuard CI run #47: success
- composite-action smoke run #47: success
- repository self-audit run #9: success
- CodeQL run #24: success

The consumer PR was then moved out of draft and squash-merged after all five checks passed.

## Package verification boundary

The repository release gate verifies:

- syntax and whitespace checks
- focused parser, policy, GitHub API, action-manifest, reporter, and self-policy tests
- deterministic fixture evaluation
- npm package allowlist inspection
- installation, CLI execution, report validation, and library import from the exact generated tarball

The package is not yet published to npm. No download count or independent third-party user count is claimed.

## Security boundary

The consumer workflow uses the ordinary `pull_request` event, read-only permissions, policy from the trusted base commit, and an explicitly supplied `github.token`. The action fetches changed-file and commit metadata through authenticated GET requests and does not execute source from the proposed change.
