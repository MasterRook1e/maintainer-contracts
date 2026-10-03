import { matchesAny } from "./glob.mjs";
import { normalizeRelative } from "./util.mjs";

function filePath(value) {
  if (typeof value !== "string" || !value || value.includes("\0")) {
    throw new Error("changed-file evidence requires a non-empty path without NUL");
  }
  const normalized = normalizeRelative(value);
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) ||
      normalized === ".." || normalized.startsWith("../")) {
    throw new Error("changed-file evidence requires a repository-relative path");
  }
  return normalized;
}

function count(value) {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error("changed-file statistics must be non-negative safe integers");
  }
  return number;
}

/** Retain both identities of a rename without counting one file twice. */
export function normalizeChangedFile(file) {
  const entry = typeof file === "string" ? { path: file } : file;
  if (!entry || typeof entry !== "object") throw new Error("invalid changed-file evidence");
  const previous = entry.previousPath ?? entry.previous_filename;
  if (entry.status === "renamed" && !previous) {
    throw new Error("renamed file evidence requires its previous path");
  }
  return {
    path: filePath(entry.path ?? entry.filename),
    additions: count(entry.additions),
    deletions: count(entry.deletions),
    binary: Boolean(entry.binary),
    ...(previous != null ? { previousPath: filePath(previous) } : {})
  };
}

/** Git --numstat -z uses an empty pathname followed by two paths for renames. */
export function parseNumstatZ(text) {
  if (typeof text !== "string") throw new Error("numstat output must be text");
  if (!text) return [];
  if (!text.endsWith("\0")) throw new Error("truncated NUL-delimited numstat evidence");
  const records = text.slice(0, -1).split("\0");
  const files = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const first = record.indexOf("\t");
    const second = record.indexOf("\t", first + 1);
    if (first < 1 || second < first + 2) throw new Error("malformed numstat record");
    const added = record.slice(0, first);
    const deleted = record.slice(first + 1, second);
    if (!/^(?:[0-9]+|-)$/.test(added) || !/^(?:[0-9]+|-)$/.test(deleted) ||
        (added === "-") !== (deleted === "-")) throw new Error("malformed numstat counts");
    let name = record.slice(second + 1);
    let previousPath;
    if (!name) {
      previousPath = records[++index];
      name = records[++index];
      if (!previousPath || !name) throw new Error("truncated numstat rename evidence");
    }
    files.push(normalizeChangedFile({
      path: name,
      previousPath,
      additions: added === "-" ? 0 : count(added),
      deletions: deleted === "-" ? 0 : count(deleted),
      binary: added === "-"
    }));
  }
  return files;
}

export function matchingChangedPaths(files, patterns) {
  const paths = new Set();
  for (const file of files) {
    for (const candidate of [file.path, file.previousPath, file.previous_filename]) {
      if (typeof candidate === "string" && matchesAny(candidate, patterns)) paths.add(candidate);
    }
  }
  return [...paths].sort();
}
