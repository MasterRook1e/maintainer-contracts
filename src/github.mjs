const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const API_PROTOCOLS = new Set(["https:", "http:"]);

function normalizePositiveInteger(value, label, fallback) {
  const number = value == null ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return number;
}

function normalizeApiUrl(value) {
  let url;
  try {
    url = new URL(value || "https://api.github.com");
  } catch {
    throw new Error("GitHub API URL must be an absolute URL");
  }
  if (!API_PROTOCOLS.has(url.protocol)) {
    throw new Error("GitHub API URL must use http or https");
  }
  if (url.username || url.password) {
    throw new Error("GitHub API URL must not contain credentials");
  }
  return url.toString().replace(/\/$/, "");
}

function hasNextPage(linkHeader) {
  return String(linkHeader || "")
    .split(",")
    .some((entry) => /;\s*rel="next"\s*$/.test(entry.trim()));
}

async function requestArrayPage(url, { token, fetchImpl, timeoutMs }) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "maintainer-contracts"
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response || typeof response.ok !== "boolean" || typeof response.json !== "function") {
    throw new Error("GitHub API client returned an invalid response object");
  }
  if (!response.ok) {
    const status = Number(response.status || 0);
    const statusText = String(response.statusText || "request failed");
    throw new Error(`GitHub API request failed (${status} ${statusText})`);
  }

  const value = await response.json();
  if (!Array.isArray(value)) {
    throw new Error("GitHub API pagination endpoint returned a non-array response");
  }

  return {
    value,
    hasNext: hasNextPage(response.headers?.get?.("link"))
  };
}

async function paginate(baseUrl, options) {
  const values = [];
  for (let page = 1; page <= options.maxPages; page += 1) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const result = await requestArrayPage(
      `${baseUrl}${separator}per_page=100&page=${page}`,
      options,
    );
    values.push(...result.value);
    if (!result.hasNext && result.value.length < 100) return values;
    if (!result.hasNext) return values;
  }
  throw new Error(
    `GitHub API pagination exceeded ${options.maxPages} pages; refusing to evaluate incomplete evidence`,
  );
}

function firstLine(value) {
  return String(value || "").split(/\r?\n/, 1)[0].trim();
}

/**
 * Fetch complete pull-request file and commit evidence from GitHub.
 *
 * The token is used only in the Authorization header and is never returned,
 * logged, or included in error messages.
 */
export async function fetchPullRequestEvidence({
  repository,
  pullNumber,
  token,
  apiUrl = "https://api.github.com",
  fetchImpl = globalThis.fetch,
  maxPages = 30,
  timeoutMs = 15000
} = {}) {
  if (!REPOSITORY.test(repository || "")) {
    throw new Error("repository must use owner/name format");
  }
  const normalizedPullNumber = normalizePositiveInteger(pullNumber, "pullNumber");
  if (!token) throw new Error("GITHUB_TOKEN is required for GitHub API evidence");
  if (typeof fetchImpl !== "function") throw new Error("A Fetch API implementation is required");

  const normalizedMaxPages = normalizePositiveInteger(maxPages, "maxPages", 30);
  const normalizedTimeoutMs = normalizePositiveInteger(timeoutMs, "timeoutMs", 15000);
  const root = normalizeApiUrl(apiUrl);
  const encodedRepository = repository.split("/").map(encodeURIComponent).join("/");
  const pullRoot = `${root}/repos/${encodedRepository}/pulls/${normalizedPullNumber}`;
  const requestOptions = {
    token,
    fetchImpl,
    maxPages: normalizedMaxPages,
    timeoutMs: normalizedTimeoutMs
  };

  const [fileEntries, commitEntries] = await Promise.all([
    paginate(`${pullRoot}/files`, requestOptions),
    paginate(`${pullRoot}/commits`, requestOptions)
  ]);

  const files = fileEntries.map((entry, index) => {
    const filePath = String(entry?.filename || "");
    if (!filePath) throw new Error(`GitHub file evidence at index ${index} has no filename`);
    return {
      path: filePath,
      additions: Number(entry.additions || 0),
      deletions: Number(entry.deletions || 0),
      binary: false
    };
  });

  const commits = commitEntries.map((entry, index) => {
    const message = firstLine(entry?.commit?.message);
    if (!message) throw new Error(`GitHub commit evidence at index ${index} has no subject`);
    return { sha: String(entry?.sha || ""), message };
  });

  return { files, commits };
}
