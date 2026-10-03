# Rename-aware review evidence

Moving a file out of a sensitive directory still changes that directory's contract.
Path and label rules now match both the destination and previous pathname of a rename.
Matched paths are deduplicated and sorted; a rename still counts as one changed file and
its additions/deletions are counted only once.

## Evidence sources

- GitHub mode retains `previous_filename` as optional `previousPath` in file reports.
- JSON fixtures accept `previousPath` or GitHub's `previous_filename` alongside the current
  `path` or `filename`. A record explicitly marked `status: renamed` must include its old path.
- Local Git mode reads `git diff --numstat -z --find-renames`, including the separate old/new
  NUL-delimited fields. UTF-8 filenames containing tabs or newlines are not split into rows.

For example, moving `src/auth/session.txt` to `docs/session.txt` still activates a rule
matching `src/auth/**`. Moving it in the opposite direction activates the same rule.
Malformed rename records and invalid non-finite or negative diff counts fail as input errors.

Local Git refs resolve to commit object IDs before range construction. Diff inspection
uses argument arrays, disables external diff and textconv helpers, and does not execute the
changed source. No new token, network, or workflow permission is introduced.

## Compatibility and limits

Policy configuration and existing finding IDs are unchanged. File reports gain an optional
`previousPath`; triggered-rule path lists can now include source paths as well as destinations.
A previously passing PR may require additional evidence when it moves sensitive files away.
These changes are recorded under Unreleased, not retroactively added to old release tags.

The tool relies on the chosen evidence source to identify renames. A fixture which omits
both rename status and the old path cannot be inferred to be a rename. If Git classifies a
heavily rewritten move as delete/add instead, both ordinary changed paths are still checked.
This verifies required review evidence, not whether the moved code is safe.
