# Threat Model

## Inputs

- pull-request event JSON
- Markdown body and title
- changed paths and numeric diff statistics
- commit subjects
- repository-owned JSON configuration
- GitHub API metadata when API mode is enabled

Pull-request-controlled fields are treated as untrusted.

## Trust boundaries

- **Policy boundary:** the recommended workflow loads configuration from the trusted base commit.
- **API boundary:** GitHub API mode sends only authenticated GET requests to the configured GitHub API root.
- **execution boundary:** repository source and configuration are never imported or executed.
- **report boundary:** reports contain metadata and findings, never file contents or token values.

## Defenses

- configuration is JSON, not executable JavaScript
- regular expressions are repository-owned policy, not PR-body input
- subprocesses use argument arrays without a shell
- the GitHub token is accepted through the environment or action input, not a CLI argument
- API errors omit response bodies so a hostile endpoint cannot reflect the Authorization token into logs
- API requests have a timeout and bounded pagination
- fetched file counts are checked against the pull-request event and fail closed on mismatch
- API URLs must be absolute HTTP(S) URLs without embedded credentials
- GitHub workflow commands escape `%`, CR, and LF
- local Git and explicit-fixture modes remain network-free

## Residual risks

Repository maintainers can configure expensive or pathological regular expressions. Very large pull requests can reach the configured API page ceiling and will fail rather than receive a partial decision. A malicious repository administrator can replace trusted policy or grant excessive workflow permissions; the tool cannot defend against the repository owner.

The tool is a CI policy engine, not a sandbox or a substitute for code review.
