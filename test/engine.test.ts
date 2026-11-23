import { describe, expect, it } from "vitest";
import { scorePackage } from "../src/core/engine.js";
import type { PackageMetadata } from "../src/core/types.js";

const NOW = new Date("2026-11-23T00:00:00.000Z");

function metadata(overrides: Partial<PackageMetadata>): PackageMetadata {
  return {
    name: "some-package",
    registry: "npm",
    exists: true,
    firstPublishedAt: "2015-01-01T00:00:00.000Z",
    latestVersion: "1.0.0",
    versionCount: 42,
    versions: ["1.0.0"],
    description: "A well known package.",
    license: "MIT",
    repositoryUrl: "https://github.com/example/some-package",
    maintainers: ["alice", "bob"],
    downloadsLastWeek: 1000000,
    ...overrides,
  };
}

describe("scorePackage", () => {
  it("scores a healthy old package as SAFE with score 0", () => {
    const result = scorePackage(metadata({}), undefined, NOW);
    expect(result.verdict).toBe("SAFE");
    expect(result.score).toBe(0);
    expect(result.reasons).toContain("no risk signals found");
  });

  it("scores a missing package as HALLUCINATED with score 100", () => {
    const result = scorePackage(
      metadata({ name: "zxqv-halcyon-foobar-123", exists: false, versionCount: 0, versions: [] }),
      undefined,
      NOW,
    );
    expect(result.verdict).toBe("HALLUCINATED");
    expect(result.score).toBe(100);
    expect(result.reasons).toContain("not found in the npm registry");
  });

  it("scores a missing typosquat as SUSPICIOUS and names the target", () => {
    const result = scorePackage(
      metadata({ name: "expres", exists: false, versionCount: 0, versions: [] }),
      undefined,
      NOW,
    );
    expect(result.verdict).toBe("SUSPICIOUS");
    expect(result.score).toBe(75);
    expect(result.reasons.some((r) => r.includes("express"))).toBe(true);
  });

  it("adds points for a package first published days ago", () => {
    const result = scorePackage(
      metadata({
        firstPublishedAt: "2026-11-20T00:00:00.000Z",
        versionCount: 1,
        versions: ["0.1.0"],
        downloadsLastWeek: 50,
        repositoryUrl: null,
        description: null,
        license: null,
        maintainers: ["solo"],
      }),
      undefined,
      NOW,
    );
    expect(result.verdict).toBe("SUSPICIOUS");
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.reasons).toContain("first published 3 days ago");
    expect(result.reasons).toContain("no repository URL listed");
  });

  it("adds points when the requested version is not published", () => {
    const result = scorePackage(metadata({}), "9.9.9", NOW);
    expect(result.reasons).toContain("version 9.9.9 is not published");
    expect(result.score).toBe(30);
    expect(result.verdict).toBe("SAFE");
  });

  it("scores an existing typosquat as SUSPICIOUS", () => {
    const result = scorePackage(
      metadata({ name: "reactt", firstPublishedAt: "2020-01-01T00:00:00.000Z" }),
      undefined,
      NOW,
    );
    expect(result.verdict).toBe("SUSPICIOUS");
    expect(result.reasons.some((r) => r.includes("react"))).toBe(true);
  });

  it("scores a PyPI package without download data on the other signals", () => {
    const result = scorePackage(
      metadata({
        name: "requests",
        registry: "pypi",
        downloadsLastWeek: null,
        firstPublishedAt: "2011-02-13T00:00:00.000Z",
      }),
      undefined,
      NOW,
    );
    expect(result.verdict).toBe("SAFE");
    expect(result.score).toBe(0);
  });
});
