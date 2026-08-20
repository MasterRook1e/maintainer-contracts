# Adoption evidence

This document records only public, verifiable integrations. It deliberately separates maintainer-owned dogfooding from independent external adoption.

## Current public integrations

| Repository | Integration | Evidence | Relationship |
|---|---|---|---|
| `MasterRook1e/maintainer-contracts` | Evaluates pull-request bodies, changed files, labels, paths, and commit subjects using trusted base policy plus authenticated, paginated GitHub metadata | `.github/workflows/maintainer-contracts.yml`, `action.yml`, and `.github/maintainer-contracts.json` on `main` | Self-dogfooding |
| `MasterRook1e/miniapp-packguard` | Enforces path-aware review evidence for public API, CI, action, and input-boundary changes | `.github/workflows/maintainer-contracts.yml` pins `602c3e16b8bbb81d69ee02d270a2d620b7216156` and supplies the read-only repository token | Same maintainer; cross-repository dogfooding |
| `MasterRook1e/ue5-flick-physics` | Enforces review evidence for portable C++, reflected Unreal API, release, and public-boundary changes | `.github/workflows/maintainer-contracts.yml` pins `602c3e16b8bbb81d69ee02d270a2d620b7216156` and loads policy from the trusted base SHA | Same maintainer; cross-repository dogfooding |

## What is not claimed

As of this record:

- no independent third-party integration is claimed
- no npm package download count is claimed because the package is not published
- no star, fork, issue, or contributor count is presented as usage
- no private repository is counted as public adoption evidence

## Adding evidence

A new entry should include a public repository, an exact workflow or configuration path, the version or immutable commit used, and the relationship to the maintainer. Private screenshots, unverified statements, and synthetic download or usage numbers are not acceptable evidence.

Independent maintainers are encouraged to open an issue with a public integration link or a minimal synthetic reproduction. Do not submit credentials, private pull-request events, proprietary source, or contributor performance data.
