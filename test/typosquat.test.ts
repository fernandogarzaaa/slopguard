import { describe, expect, it } from "vitest";
import { findTyposquat, levenshtein } from "../src/core/typosquat.js";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("express", "express")).toBe(0);
  });

  it("returns 1 for a single missing letter", () => {
    expect(levenshtein("expres", "express")).toBe(1);
  });

  it("returns 2 for two edits", () => {
    expect(levenshtein("expres", "expresx")).toBe(1);
    expect(levenshtein("react", "recat")).toBe(2);
  });

  it("returns the full length for an empty string", () => {
    expect(levenshtein("", "react")).toBe(5);
  });
});

describe("findTyposquat", () => {
  const candidates = ["express", "react", "react-dom", "lodash", "requests"];

  it("finds an edit-distance-1 match and names the target", () => {
    const match = findTyposquat("expres", candidates);
    expect(match).not.toBeNull();
    expect(match?.target).toBe("express");
    expect(match?.distance).toBe(1);
    expect(match?.kind).toBe("plural");
  });

  it("finds an extra-letter match", () => {
    const match = findTyposquat("reactt", candidates);
    expect(match?.target).toBe("react");
    expect(match?.distance).toBe(1);
    expect(match?.kind).toBe("edit-distance-1");
  });

  it("finds a transposition", () => {
    const match = findTyposquat("exrpess", candidates);
    expect(match?.target).toBe("express");
    expect(match?.kind).toBe("transposition");
  });

  it("finds a separator variant", () => {
    const match = findTyposquat("react_dom", candidates);
    expect(match?.target).toBe("react-dom");
    expect(match?.kind).toBe("separator");
    expect(match?.distance).toBe(0);
  });

  it("finds a plural variant", () => {
    const match = findTyposquat("request", candidates);
    expect(match?.target).toBe("requests");
    expect(match?.kind).toBe("plural");
  });

  it("finds an edit-distance-2 match", () => {
    const match = findTyposquat("exprezz", candidates);
    expect(match?.target).toBe("express");
    expect(match?.distance).toBe(2);
    expect(match?.kind).toBe("edit-distance-2");
  });

  it("returns null for an exact name", () => {
    expect(findTyposquat("express", candidates)).toBeNull();
  });

  it("returns null for an unrelated name", () => {
    expect(findTyposquat("zxqv-halcyon-foobar-123", candidates)).toBeNull();
  });

  it("prefers the closest candidate", () => {
    const match = findTyposquat("lodas", ["lodash", "axios"]);
    expect(match?.target).toBe("lodash");
  });
});
