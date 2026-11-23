import topNpm from "../data/top-npm.json" with { type: "json" };
import topPypi from "../data/top-pypi.json" with { type: "json" };
import { fetchPackageMetadata } from "./registry.js";
import { findTyposquat } from "./typosquat.js";
import type { CheckResult, PackageMetadata, Registry, Verdict } from "./types.js";

const SUSPICIOUS_SCORE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const TOP_NAMES: Record<Registry, string[]> = {
  npm: (topNpm as { names: string[] }).names,
  pypi: (topPypi as { names: string[] }).names,
};

function ageInDays(firstPublishedAt: string | null, now: Date): number | null {
  if (!firstPublishedAt) return null;
  const first = new Date(firstPublishedAt).getTime();
  if (Number.isNaN(first)) return null;
  return Math.floor((now.getTime() - first) / DAY_MS);
}

export function scorePackage(
  metadata: PackageMetadata,
  requestedVersion?: string,
  now: Date = new Date(),
): { verdict: Verdict; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (!metadata.exists) {
    const match = findTyposquat(metadata.name, TOP_NAMES[metadata.registry]);
    reasons.push(`not found in the ${metadata.registry} registry`);
    if (match) {
      reasons.push(
        `closely resembles ${match.target} (${match.kind}, edit distance ${match.distance})`,
      );
      return { verdict: "SUSPICIOUS", score: 75, reasons };
    }
    return { verdict: "HALLUCINATED", score: 100, reasons };
  }

  const age = ageInDays(metadata.firstPublishedAt, now);
  if (age !== null) {
    if (age < 7) {
      score += 35;
      reasons.push(`first published ${age} days ago`);
    } else if (age < 30) {
      score += 25;
      reasons.push(`first published ${age} days ago`);
    } else if (age < 90) {
      score += 12;
      reasons.push(`first published ${age} days ago`);
    } else if (age < 365) {
      score += 5;
      reasons.push(`first published ${age} days ago`);
    }
  }

  if (metadata.downloadsLastWeek !== null) {
    const downloads = metadata.downloadsLastWeek;
    if (downloads < 100) {
      score += 20;
      reasons.push(`only ${downloads} downloads in the last week`);
    } else if (downloads < 1000) {
      score += 12;
      reasons.push(`only ${downloads} downloads in the last week`);
    } else if (downloads < 10000) {
      score += 5;
      reasons.push(`only ${downloads} downloads in the last week`);
    }
  }

  if (!metadata.repositoryUrl) {
    score += 15;
    reasons.push("no repository URL listed");
  }
  if (!metadata.description) {
    score += 5;
    reasons.push("no description");
  }
  if (!metadata.license) {
    score += 5;
    reasons.push("no license declared");
  }
  if (metadata.versionCount === 1) {
    score += 10;
    reasons.push("only one version published");
  } else if (metadata.versionCount <= 3) {
    score += 5;
    reasons.push(`only ${metadata.versionCount} versions published`);
  }
  if (metadata.maintainers.length === 1) {
    score += 3;
    reasons.push("single maintainer");
  }

  if (requestedVersion && !metadata.versions.includes(requestedVersion)) {
    score += 30;
    reasons.push(`version ${requestedVersion} is not published`);
  }

  const match = findTyposquat(metadata.name, TOP_NAMES[metadata.registry]);
  if (match) {
    if (match.distance <= 1) {
      score += 50;
      reasons.push(
        `closely resembles ${match.target} (${match.kind}, edit distance ${match.distance})`,
      );
    } else {
      score += 25;
      reasons.push(
        `resembles ${match.target} (${match.kind}, edit distance ${match.distance})`,
      );
    }
  }

  if (score > 100) score = 100;
  const verdict = score >= SUSPICIOUS_SCORE ? "SUSPICIOUS" : "SAFE";
  if (verdict === "SAFE") reasons.push("no risk signals found");
  return { verdict, score, reasons };
}

export async function checkPackage(
  name: string,
  registry: Registry,
  requestedVersion?: string,
): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  const metadata = await fetchPackageMetadata(name, registry);
  const { verdict, score, reasons } = scorePackage(
    metadata,
    requestedVersion,
    new Date(checkedAt),
  );
  return { name, registry, verdict, score, reasons, metadata, checkedAt };
}
