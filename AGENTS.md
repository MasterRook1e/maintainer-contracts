# Agent Instructions

Read `README.md`, `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, and `CONTRIBUTING.md` before modifying the project.

Hard boundaries:

- do not execute repository source or JavaScript configuration
- do not add network calls to the core policy path
- keep Git subprocesses shell-free
- escape GitHub workflow commands
- preserve deterministic finding IDs and ordering
- keep generic defaults free of private or organization-specific terminology
- add tests for every new rule type

Run `npm run verify` before proposing a merge.
