export type Registry = "npm" | "pypi";

export type Verdict = "SAFE" | "SUSPICIOUS" | "HALLUCINATED";

export interface PackageMetadata {
  name: string;
  registry: Registry;
  exists: boolean;
  firstPublishedAt: string | null;
  latestVersion: string | null;
  versionCount: number;
  versions: string[];
  description: string | null;
  license: string | null;
  repositoryUrl: string | null;
  maintainers: string[];
  downloadsLastWeek: number | null;
}

export interface CheckResult {
  name: string;
  registry: Registry;
  verdict: Verdict;
  score: number;
  reasons: string[];
  metadata: PackageMetadata | null;
  checkedAt: string;
}

export interface TyposquatMatch {
  target: string;
  distance: number;
  kind: "separator" | "plural" | "transposition" | "edit-distance-1" | "edit-distance-2";
}
