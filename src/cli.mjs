import fs from "node:fs/promises";
import path from "node:path";
import { createExampleConfig, loadConfig } from "./config.mjs";
import { loadInputs } from "./event.mjs";
import { evaluateContracts } from "./policy.mjs";
import { renderGitHubAnnotations, renderReport } from "./reporters.mjs";
import { stableStringify, writeTextAtomic } from "./util.mjs";
import { TOOL_VERSION } from "./version.mjs";

const HELP = `maintainer-contracts [check|init] [options]

Commands:
  check                         Evaluate PR contracts (default)
  init                          Write maintainer-contracts.config.json

Inputs:
  --event <path>                GitHub pull_request event JSON
  --files <path>                JSON array of changed file records or paths
  --commits <path>              JSON array of commit records or subjects
  --github-api                  Fetch complete PR file/commit evidence with GITHUB_TOKEN
  --github-repository <owner/name>
  --github-api-url <url>        Defaults to GITHUB_API_URL or api.github.com
  --github-max-pages <number>   Fail closed after this many pages (default: 30)
  --github-timeout-ms <number>  Per-request timeout (default: 15000)
  --git-root <path>             Inspect base...head with local git when API mode is off
  --config <path>               Policy config relative to project root
  --project-root <path>         Repository root (default: cwd)

Output:
  --format <console|json|markdown|github>
  --out <path>
  --report-dir <path>           Write report.json and report.md
  --github-annotations          Emit GitHub workflow commands in addition to report
  --quiet
  --force                       Overwrite config during init
  --version
  --help

GITHUB_TOKEN is read from the environment and is never accepted as a CLI argument.
Exit codes: 0 pass, 1 policy failure, 2 input/configuration/runtime error.
`;

function parseArgs(argv) {
  const options = {
    command: "check",
    format: "console",
    projectRoot: process.cwd(),
    quiet: false,
    force: false,
    githubAnnotations: false,
    githubApi: false
  };
  const args = [...argv];
  if (args[0] && !args[0].startsWith("-")) options.command = args.shift();
  const booleans = new Set([
    "--quiet",
    "--force",
    "--github-api",
    "--github-annotations",
    "--help",
    "--version"
  ]);
  while (args.length) {
    const key = args.shift();
    if (booleans.has(key)) {
      options[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = true;
      continue;
    }
    if (!key?.startsWith("--")) throw new Error(`unexpected argument: ${key}`);
    const value = args.shift();
    if (value == null) throw new Error(`missing value for ${key}`);
    options[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return options;
}

async function initProject(options) {
  const root = path.resolve(options.projectRoot);
  const output = path.resolve(root, options.config || "maintainer-contracts.config.json");
  try {
    if (!options.force) await fs.access(output).then(() => { throw new Error(`${path.basename(output)} already exists; pass --force to overwrite`); });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeTextAtomic(output, stableStringify(createExampleConfig()));
  process.stdout.write(`Wrote ${output}\n`);
}

async function writeOutputs(result, outputFile) {
  if (!outputFile) return;
  const lines = [
    `passed=${result.summary.passed}`,
    `errors=${result.summary.errors}`,
    `warnings=${result.summary.warnings}`,
    `notes=${result.summary.notes}`
  ];
  await fs.appendFile(outputFile, `${lines.join("\n")}\n`, "utf8");
}

export async function runCli(argv) {
  const options = parseArgs(argv);
  if (options.help) return void process.stdout.write(HELP);
  if (options.version) return void process.stdout.write(`${TOOL_VERSION}\n`);
  if (options.command === "init") return initProject(options);
  if (options.command !== "check") throw new Error(`unknown command: ${options.command}`);
  const loaded = await loadConfig({ projectRoot: options.projectRoot, configPath: options.config });
  const input = await loadInputs({
    ...options,
    gitRoot: options.gitRoot ? path.resolve(loaded.projectRoot, options.gitRoot) : null,
    githubRepository: options.githubRepository || process.env.GITHUB_REPOSITORY,
    githubApiUrl: options.githubApiUrl || process.env.GITHUB_API_URL,
    githubToken: process.env.GITHUB_TOKEN,
    githubMaxPages: options.githubMaxPages,
    githubTimeoutMs: options.githubTimeoutMs
  });
  const result = evaluateContracts(input, loaded.config);
  result.evidence = { source: input.evidenceSource };
  const rendered = renderReport(result, options.format);
  if (options.out) await writeTextAtomic(path.resolve(loaded.projectRoot, options.out), rendered);
  if (options.reportDir) {
    const reportDir = path.resolve(loaded.projectRoot, options.reportDir);
    await Promise.all([
      writeTextAtomic(path.join(reportDir, "report.json"), renderReport(result, "json")),
      writeTextAtomic(path.join(reportDir, "report.md"), renderReport(result, "markdown"))
    ]);
  }
  if (!options.quiet) process.stdout.write(rendered);
  if (options.githubAnnotations) process.stdout.write(renderGitHubAnnotations(result));
  await writeOutputs(result, process.env.GITHUB_OUTPUT);
  process.exitCode = result.summary.passed ? 0 : 1;
}
