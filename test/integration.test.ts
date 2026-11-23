import { describe, expect, it } from "vitest";
import { checkPackage } from "../src/core/index.js";

describe("live registry integration", () => {
  it("scores express on npm as SAFE", async () => {
    const result = await checkPackage("express", "npm");
    expect(result.verdict).toBe("SAFE");
    expect(result.metadata?.exists).toBe(true);
    expect(result.score).toBeLessThan(50);
  }, 30000);

  it("scores react on npm as SAFE", async () => {
    const result = await checkPackage("react", "npm");
    expect(result.verdict).toBe("SAFE");
    expect(result.metadata?.exists).toBe(true);
  }, 30000);

  it("scores a name that exists nowhere as HALLUCINATED", async () => {
    const result = await checkPackage("zxqv-halcyon-foobar-123", "npm");
    expect(result.verdict).toBe("HALLUCINATED");
    expect(result.score).toBe(100);
    expect(result.metadata?.exists).toBe(false);
  }, 30000);

  it("scores the typosquat expres on npm as SUSPICIOUS and names express", async () => {
    const result = await checkPackage("expres", "npm");
    expect(result.verdict).toBe("SUSPICIOUS");
    expect(result.reasons.some((reason) => reason.includes("express"))).toBe(true);
  }, 30000);

  it("scores requests on PyPI as SAFE", async () => {
    const result = await checkPackage("requests", "pypi");
    expect(result.verdict).toBe("SAFE");
    expect(result.metadata?.exists).toBe(true);
  }, 30000);
});
