import { contextFromGitHubEvent } from './event.mjs';

const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

async function requestJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'maintainer-contracts'
    }
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`GitHub API request failed (${response.status}): ${detail || response.statusText}`);
  }
  return response.json();
}

async function paginate(baseUrl, token, fetchImpl, maxPages) {
  const values = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const batch = await requestJson(`${baseUrl}${separator}per_page=100&page=${page}`, token, fetchImpl);
    if (!Array.isArray(batch)) throw new Error('GitHub API pagination endpoint returned a non-array response.');
    values.push(...batch);
    if (batch.length < 100) return values;
  }
  throw new Error(`GitHub API pagination exceeded ${maxPages} pages; refusing to evaluate incomplete metadata.`);
}

export async function enrichGitHubContext(event, {
  repository,
  token,
  apiUrl = 'https://api.github.com',
  fetchImpl = globalThis.fetch,
  maxPages = 30
} = {}) {
  if (!REPOSITORY.test(repository ?? '')) throw new Error('repository must use owner/name format.');
  if (!token) throw new Error('A GitHub token is required for metadata enrichment.');
  if (typeof fetchImpl !== 'function') throw new Error('A Fetch API implementation is required.');

  const pullNumber = event.pull_request?.number ?? event.number;
  if (!Number.isSafeInteger(pullNumber) || pullNumber <= 0) {
    throw new Error('The GitHub event does not identify a pull request number.');
  }

  const encodedRepository = repository.split('/').map(encodeURIComponent).join('/');
  const root = `${apiUrl.replace(/\/$/, '')}/repos/${encodedRepository}/pulls/${pullNumber}`;
  const [files, commits] = await Promise.all([
    paginate(`${root}/files`, token, fetchImpl, maxPages),
    paginate(`${root}/commits`, token, fetchImpl, maxPages)
  ]);

  const context = contextFromGitHubEvent(event);
  context.files = files.map((file) => file.filename).filter((value) => typeof value === 'string');
  context.commits = commits
    .map((entry) => entry.commit?.message?.split(/\r?\n/, 1)[0]?.trim())
    .filter(Boolean);
  context.stats.filesChanged = context.files.length;
  return context;
}
