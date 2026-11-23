export { checkPackage, scorePackage } from "./engine.js";
export { fetchPackageMetadata } from "./registry.js";
export { findTyposquat, levenshtein } from "./typosquat.js";
export type {
  CheckResult,
  PackageMetadata,
  Registry,
  TyposquatMatch,
  Verdict,
} from "./types.js";
