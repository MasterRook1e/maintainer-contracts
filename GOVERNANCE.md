# Governance

Maintainer Contracts is currently maintained by `@MasterRook1e` under a lightweight maintainer model.

## Decision process

Small fixes are accepted through reviewed pull requests. Changes to evaluation semantics, context schemas, security boundaries, or exit codes require a design issue before implementation. Path rules remain additive so a specialized contract cannot weaken global repository policy.

## Triage priorities

Security and false-pass defects have highest priority, followed by false failures, GitHub compatibility, documentation, and new policy features. Requests that embed one organization's private workflow are generalized before acceptance.

## Releases

A release requires passing cross-platform CI, parser and GitHub-enrichment tests, package smoke testing, changelog updates, and a review of the policy-engine threat model.

## Maintainer growth

Consistent contributors may receive triage or review responsibility after demonstrating careful handling of untrusted pull-request input and backward compatibility.
