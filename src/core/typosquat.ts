import type { TyposquatMatch } from "./types.js";

export function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid: number[][] = [];
  for (let i = 0; i < rows; i++) {
    grid.push(new Array<number>(cols).fill(0));
    grid[i]![0] = i;
  }
  for (let j = 0; j < cols; j++) {
    grid[0]![j] = j;
  }
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      grid[i]![j] = Math.min(
        grid[i - 1]![j]! + 1,
        grid[i]![j - 1]! + 1,
        grid[i - 1]![j - 1]! + cost,
      );
    }
  }
  return grid[a.length]![b.length]!;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[-_.]/g, "");
}

function isTransposition(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let first = -1;
  let second = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (first === -1) first = i;
      else if (second === -1) second = i;
      else return false;
    }
  }
  if (first === -1 || second === -1) return false;
  if (second !== first + 1) return false;
  return a[first] === b[second] && a[second] === b[first];
}

function isPluralVariant(a: string, b: string): boolean {
  return a === b + "s" || b === a + "s";
}

export function findTyposquat(
  name: string,
  candidates: string[],
): TyposquatMatch | null {
  const lower = name.toLowerCase();
  const normalized = normalize(name);
  let best: TyposquatMatch | null = null;

  for (const candidate of candidates) {
    const target = candidate.toLowerCase();
    if (target === lower) continue;
    if (normalize(candidate) === normalized) {
      return { target: candidate, distance: 0, kind: "separator" };
    }
    if (isPluralVariant(lower, target)) {
      const match: TyposquatMatch = { target: candidate, distance: 1, kind: "plural" };
      if (!best || match.distance < best.distance) best = match;
      continue;
    }
    if (isTransposition(lower, target)) {
      const match: TyposquatMatch = { target: candidate, distance: 1, kind: "transposition" };
      if (!best || match.distance < best.distance) best = match;
      continue;
    }
    const distance = levenshtein(lower, target);
    if (distance === 1) {
      const match: TyposquatMatch = { target: candidate, distance, kind: "edit-distance-1" };
      if (!best || match.distance < best.distance) best = match;
    } else if (distance === 2) {
      const match: TyposquatMatch = { target: candidate, distance, kind: "edit-distance-2" };
      if (!best) best = match;
    }
  }

  return best;
}
