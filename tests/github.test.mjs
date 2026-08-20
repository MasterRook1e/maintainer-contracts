import test from "node:test";
import assert from "node:assert/strict";
import { fetchPullRequestEvidence } from "../src/github.mjs";

function response(value, { status = 200, statusText = "OK", link = "" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get(name) {
        return String(name).toLowerCase() === "link" ? link : null;
      }
    },
    async json() {
      return value;
    }
  };
}

test("GitHub evidence fetches all file and commit pages", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const parsed = new URL(url);
    const page = Number(parsed.searchParams.get("page"));
    if (parsed.pathname.endsWith("/files")) {
      if (page === 1) {
        return response(
          [{ filename: "src/index.mjs", additions: 12, deletions: 2 }],
          { link: '<https://api.github.com/next>; rel="next"' },
        );
      }
      return response([{ filename: "README.md", additions: 3, deletions: 0 }]);
    }
    if (page === 1) {
      return response([
        { sha: "abc", commit: { message: "feat: add API evidence\n\nDetails" } }
      ]);
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const evidence = await fetchPullRequestEvidence({
    repository: "owner/repo",
    pullNumber: 17,
    token: "secret-token",
    fetchImpl
  });

  assert.deepEqual(evidence.files, [
    { path: "src/index.mjs", additions: 12, deletions: 2, binary: false },
    { path: "README.md", additions: 3, deletions: 0, binary: false }
  ]);
  assert.deepEqual(evidence.commits, [
    { sha: "abc", message: "feat: add API evidence" }
  ]);
  assert.equal(requests.length, 3);
  assert.ok(requests.every((request) => request.options.headers.Authorization === "Bearer secret-token"));
  assert.ok(requests.every((request) => request.options.signal instanceof AbortSignal));
});

test("GitHub evidence rejects unsafe or incomplete inputs", async () => {
  await assert.rejects(
    fetchPullRequestEvidence({ repository: "bad", pullNumber: 1, token: "token" }),
    /owner\/name/,
  );
  await assert.rejects(
    fetchPullRequestEvidence({ repository: "owner/repo", pullNumber: 1 }),
    /GITHUB_TOKEN/,
  );
  await assert.rejects(
    fetchPullRequestEvidence({
      repository: "owner/repo",
      pullNumber: 1,
      token: "token",
      apiUrl: "file:///tmp/api"
    }),
    /http or https/,
  );
});

test("GitHub API failures do not include response bodies or tokens", async () => {
  const token = "top-secret-token";
  await assert.rejects(
    fetchPullRequestEvidence({
      repository: "owner/repo",
      pullNumber: 1,
      token,
      fetchImpl: async () => response(
        { token },
        { status: 403, statusText: "Forbidden" },
      )
    }),
    (error) => {
      assert.match(error.message, /403 Forbidden/);
      assert.doesNotMatch(error.message, /top-secret-token/);
      return true;
    },
  );
});

test("GitHub pagination fails closed at the configured page limit", async () => {
  await assert.rejects(
    fetchPullRequestEvidence({
      repository: "owner/repo",
      pullNumber: 1,
      token: "token",
      maxPages: 1,
      fetchImpl: async () => response(
        Array.from({ length: 100 }, (_, index) => ({
          filename: `src/${index}.mjs`,
          additions: 1,
          deletions: 0,
          sha: String(index),
          commit: { message: `feat: commit ${index}` }
        })),
        { link: '<https://api.github.com/next>; rel="next"' },
      )
    }),
    /refusing to evaluate incomplete evidence/,
  );
});
