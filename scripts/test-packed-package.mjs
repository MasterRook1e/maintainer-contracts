import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const NPM_CLI = process.env.npm_execpath;
const REQUIRED_PACKAGE_PATHS = new Set([
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "action.yml",
  "bin/maintainer-contracts.mjs",
  "package.json",
  "schemas/config.schema.json",
  "src/index.mjs"
]);

if (!NPM_CLI) {
  throw new Error("npm_execpath is unavailable; run this check through `npm run pack:test`");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited ${result.status}\n${result.stdout || ""}\n${result.stderr || ""}`,
    );
  }
  return result;
}

function runNpm(args, options = {}) {
  return run(process.execPath, [NPM_CLI, ...args], options);
}

function isAllowedPackagePath(packagePath) {
  return ["bin/", "schemas/", "src/"].some((prefix) => packagePath.startsWith(prefix)) ||
    ["LICENSE", "README.md", "SECURITY.md", "action.yml", "package.json"].includes(packagePath);
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "maintainer-contracts-consumer-"));
let tarballPath = null;

try {
  const packed = runNpm(["pack", "--json", "--ignore-scripts"], { cwd: ROOT });
  const metadata = JSON.parse(packed.stdout)[0];
  if (!metadata?.filename || !Array.isArray(metadata.files)) {
    throw new Error("npm pack did not return the expected JSON metadata");
  }

  tarballPath = path.join(ROOT, metadata.filename);
  const packagePaths = metadata.files.map((file) => String(file.path).replace(/\\/g, "/"));
  const unexpected = packagePaths.filter((packagePath) => !isAllowedPackagePath(packagePath));
  if (unexpected.length) {
    throw new Error(`unexpected files in npm package: ${unexpected.join(", ")}`);
  }

  const missing = [...REQUIRED_PACKAGE_PATHS].filter((packagePath) => !packagePaths.includes(packagePath));
  if (missing.length) {
    throw new Error(`required files missing from npm package: ${missing.join(", ")}`);
  }

  const consumerRoot = path.join(tempRoot, "consumer");
  await fs.mkdir(consumerRoot, { recursive: true });
  await fs.writeFile(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify({ name: "maintainer-contracts-packed-consumer", private: true, type: "module" }, null, 2)}\n`,
  );

  const eventPath = path.join(consumerRoot, "event.json");
  const filesPath = path.join(consumerRoot, "files.json");
  const commitsPath = path.join(consumerRoot, "commits.json");
  await fs.writeFile(eventPath, `${JSON.stringify({
    number: 7,
    pull_request: {
      title: "feat: verify installed policy engine",
      body: "## Summary\nThis clean consumer verifies the installed policy engine and its public package boundary.\n\n## Validation\n- [x] Packed consumer executed\n",
      draft: false,
      user: { login: "consumer" },
      labels: [],
      base: { sha: "base", ref: "main" },
      head: { sha: "head", ref: "consumer" }
    }
  }, null, 2)}\n`);
  await fs.writeFile(filesPath, `${JSON.stringify([
    { path: "src/index.mjs", additions: 10, deletions: 1 }
  ], null, 2)}\n`);
  await fs.writeFile(commitsPath, `${JSON.stringify([
    { sha: "abc123", message: "feat: verify installed policy engine" }
  ], null, 2)}\n`);
  await fs.writeFile(
    path.join(consumerRoot, "maintainer-contracts.config.json"),
    `${JSON.stringify({ version: 1, requiredPatterns: [], failLevel: "error" }, null, 2)}\n`,
  );

  runNpm(["install", tarballPath, "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: consumerRoot
  });

  const installedCli = path.join(
    consumerRoot,
    "node_modules",
    "maintainer-contracts",
    "bin",
    "maintainer-contracts.mjs",
  );
  run(process.execPath, [
    installedCli,
    "check",
    "--project-root",
    consumerRoot,
    "--event",
    eventPath,
    "--files",
    filesPath,
    "--commits",
    commitsPath,
    "--config",
    "maintainer-contracts.config.json",
    "--report-dir",
    "reports",
    "--quiet"
  ], { cwd: consumerRoot });

  const report = JSON.parse(await fs.readFile(path.join(consumerRoot, "reports", "report.json"), "utf8"));
  if (!report.summary?.passed || report.tool?.name !== "maintainer-contracts") {
    throw new Error("installed CLI did not produce a passing Maintainer Contracts report");
  }

  run(process.execPath, [
    "--input-type=module",
    "--eval",
    "import { normalizeConfig } from 'maintainer-contracts'; const c = normalizeConfig({ version: 1 }); if (c.version !== 1) process.exit(1);"
  ], { cwd: consumerRoot });

  process.stdout.write(
    `Packed-package consumer passed (${packagePaths.length} files, ${metadata.size} bytes).\n`,
  );
} finally {
  if (tarballPath) await fs.rm(tarballPath, { force: true });
  await fs.rm(tempRoot, { recursive: true, force: true });
}
