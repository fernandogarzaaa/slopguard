#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { checkPackage } from "../core/index.js";
import type { CheckResult, Registry, Verdict } from "../core/index.js";

const EXIT_SAFE = 0;
const EXIT_SUSPICIOUS = 1;
const EXIT_HALLUCINATED = 2;
const EXIT_ERROR = 3;

const VERDICT_EXIT: Record<Verdict, number> = {
  SAFE: EXIT_SAFE,
  SUSPICIOUS: EXIT_SUSPICIOUS,
  HALLUCINATED: EXIT_HALLUCINATED,
};

function usage(): string {
  return [
    "slopguard checks a package name against the live registry before you install it.",
    "",
    "Usage:",
    "  slopguard check <pkg>[@version] [--registry npm|pypi] [--json]",
    "  slopguard scan <package.json|requirements.txt> [--registry npm|pypi] [--json]",
    "",
    "Exit codes: 0 SAFE, 1 SUSPICIOUS, 2 HALLUCINATED, 3 usage or network error.",
  ].join("\n");
}

function parseNameAndVersion(spec: string): { name: string; version?: string } {
  const at = spec.lastIndexOf("@");
  if (at > 0) {
    return { name: spec.slice(0, at), version: spec.slice(at + 1) };
  }
  return { name: spec };
}

function printResult(result: CheckResult, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result));
    return;
  }
  console.log(`${result.verdict} ${result.name} (${result.registry}) score ${result.score}`);
  for (const reason of result.reasons) {
    console.log(`  - ${reason}`);
  }
}

async function checkWithAutoDetect(
  name: string,
  version: string | undefined,
  registry: Registry | undefined,
): Promise<CheckResult> {
  if (registry) return checkPackage(name, registry, version);
  const npmResult = await checkPackage(name, "npm", version);
  if (npmResult.verdict !== "HALLUCINATED") return npmResult;
  const pypiResult = await checkPackage(name, "pypi", version);
  return pypiResult.metadata?.exists ? pypiResult : npmResult;
}

function parsePackageJson(content: string): string[] {
  const parsed = JSON.parse(content) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return [
    ...Object.keys(parsed.dependencies ?? {}),
    ...Object.keys(parsed.devDependencies ?? {}),
  ];
}

function parseRequirements(content: string): string[] {
  const names: string[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;
    const name = line.split(/[\s=<>~!\[;]/)[0];
    if (name) names.push(name.toLowerCase());
  }
  return names;
}

async function runCheck(args: string[]): Promise<number> {
  let spec: string | undefined;
  let registry: Registry | undefined;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--json") json = true;
    else if (arg === "--registry") {
      const value = args[++i];
      if (value !== "npm" && value !== "pypi") {
        console.error("error: --registry must be npm or pypi");
        return EXIT_ERROR;
      }
      registry = value;
    } else if (arg.startsWith("--registry=")) {
      const value = arg.slice("--registry=".length);
      if (value !== "npm" && value !== "pypi") {
        console.error("error: --registry must be npm or pypi");
        return EXIT_ERROR;
      }
      registry = value;
    } else if (!spec) {
      spec = arg;
    } else {
      console.error(`error: unexpected argument ${arg}`);
      return EXIT_ERROR;
    }
  }
  if (!spec) {
    console.error("error: missing package name");
    console.error(usage());
    return EXIT_ERROR;
  }
  const { name, version } = parseNameAndVersion(spec);
  const result = await checkWithAutoDetect(name, version, registry);
  printResult(result, json);
  return VERDICT_EXIT[result.verdict];
}

async function runScan(args: string[]): Promise<number> {
  let file: string | undefined;
  let registry: Registry | undefined;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--json") json = true;
    else if (arg === "--registry") {
      const value = args[++i];
      if (value !== "npm" && value !== "pypi") {
        console.error("error: --registry must be npm or pypi");
        return EXIT_ERROR;
      }
      registry = value;
    } else if (arg.startsWith("--registry=")) {
      const value = arg.slice("--registry=".length);
      if (value !== "npm" && value !== "pypi") {
        console.error("error: --registry must be npm or pypi");
        return EXIT_ERROR;
      }
      registry = value;
    } else if (!file) {
      file = arg;
    } else {
      console.error(`error: unexpected argument ${arg}`);
      return EXIT_ERROR;
    }
  }
  if (!file) {
    console.error("error: missing file path");
    console.error(usage());
    return EXIT_ERROR;
  }
  const isPackageJson = file.endsWith("package.json");
  const isRequirements = file.endsWith("requirements.txt");
  if (!isPackageJson && !isRequirements && !registry) {
    console.error("error: file must be package.json or requirements.txt, or pass --registry");
    return EXIT_ERROR;
  }
  const effectiveRegistry: Registry =
    registry ?? (isPackageJson ? "npm" : "pypi");
  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch {
    console.error(`error: cannot read ${file}`);
    return EXIT_ERROR;
  }
  let names: string[];
  try {
    names = isPackageJson ? parsePackageJson(content) : parseRequirements(content);
  } catch {
    console.error(`error: cannot parse ${file}`);
    return EXIT_ERROR;
  }
  if (names.length === 0) {
    console.log("no dependencies found");
    return EXIT_SAFE;
  }
  const results: CheckResult[] = [];
  for (const name of names) {
    results.push(await checkPackage(name, effectiveRegistry));
  }
  if (json) {
    console.log(JSON.stringify(results));
  } else {
    for (const result of results) printResult(result, false);
  }
  let worst = EXIT_SAFE;
  for (const result of results) {
    worst = Math.max(worst, VERDICT_EXIT[result.verdict]);
  }
  return worst;
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  try {
    if (command === "check") return await runCheck(rest);
    if (command === "scan") return await runScan(rest);
    if (command === "--help" || command === "-h" || command === "help") {
      console.log(usage());
      return EXIT_SAFE;
    }
    if (command === "--version" || command === "-v") {
      console.log("slopguard 0.1.0");
      return EXIT_SAFE;
    }
    console.error(`error: unknown command ${command ?? ""}`);
    console.error(usage());
    return EXIT_ERROR;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`error: ${message}`);
    return EXIT_ERROR;
  }
}

process.exitCode = await main();
