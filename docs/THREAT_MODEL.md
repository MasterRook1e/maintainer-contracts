# Threat Model

## Inputs

- pull-request event JSON
- Markdown body and title
- changed paths and numeric diff statistics
- commit subjects
- repository-owned JSON configuration

These inputs may be attacker-controlled in public repositories.

## Defenses

- configuration is JSON, not executable JavaScript
- regular expressions are repository-owned policy, not PR-body input
- subprocesses use argument arrays without a shell
- repository source is never imported or executed
- event data is not sent over the network
- reports do not include file contents
- GitHub workflow commands escape `%`, CR, and LF

## Residual risks

Repository maintainers can configure expensive or pathological regular expressions. Large PR bodies and very large Git histories can consume time and memory. The tool is a CI policy engine, not a sandbox for untrusted repository administrators.
