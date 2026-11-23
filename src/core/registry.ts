import type { PackageMetadata, Registry } from "./types.js";

const TIMEOUT_MS = 15000;

async function fetchJson(url: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return { status: 404, body: null };
  if (!response.ok) {
    throw new Error(`registry request failed with HTTP ${response.status} for ${url}`);
  }
  return { status: response.status, body: await response.json() };
}

function npmMetadata(name: string, body: Record<string, unknown>): PackageMetadata {
  const versions = (body["versions"] as Record<string, unknown>) ?? {};
  const time = (body["time"] as Record<string, string>) ?? {};
  const distTags = (body["dist-tags"] as Record<string, string>) ?? {};
  const repository = body["repository"] as { url?: string } | string | undefined;
  const maintainers = (body["maintainers"] as Array<{ name?: string }>) ?? [];
  const repositoryUrl =
    typeof repository === "string"
      ? repository
      : (repository?.url ?? null);
  return {
    name,
    registry: "npm",
    exists: true,
    firstPublishedAt: time["created"] ?? null,
    latestVersion: distTags["latest"] ?? null,
    versionCount: Object.keys(versions).length,
    versions: Object.keys(versions),
    description: (body["description"] as string | undefined) ?? null,
    license: (body["license"] as string | undefined) ?? null,
    repositoryUrl,
    maintainers: maintainers
      .map((m) => m.name)
      .filter((n): n is string => typeof n === "string"),
    downloadsLastWeek: null,
  };
}

async function npmDownloads(name: string): Promise<number | null> {
  try {
    const { body } = await fetchJson(
      `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`,
    );
    const downloads = (body as { downloads?: unknown })?.downloads;
    return typeof downloads === "number" ? downloads : null;
  } catch {
    return null;
  }
}

function pypiMetadata(name: string, body: Record<string, unknown>): PackageMetadata {
  const info = (body["info"] as Record<string, unknown>) ?? {};
  const releases = (body["releases"] as Record<string, Array<{ upload_time?: string }>>) ?? {};
  const projectUrls = (info["project_urls"] as Record<string, string> | null) ?? null;
  let firstPublishedAt: string | null = null;
  for (const files of Object.values(releases)) {
    for (const file of files) {
      const at = file.upload_time;
      if (at && (!firstPublishedAt || at < firstPublishedAt)) firstPublishedAt = at;
    }
  }
  let repositoryUrl: string | null = null;
  if (projectUrls) {
    for (const [key, value] of Object.entries(projectUrls)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes("source") || lowerKey.includes("repository") || lowerKey.includes("code")) {
        repositoryUrl = value;
        break;
      }
    }
    if (!repositoryUrl) {
      for (const value of Object.values(projectUrls)) {
        if (value.includes("github.com") || value.includes("gitlab.com")) {
          repositoryUrl = value;
          break;
        }
      }
    }
    if (!repositoryUrl) repositoryUrl = projectUrls["Homepage"] ?? null;
  }
  const maintainers: string[] = [];
  const author = info["author"] as string | undefined;
  const maintainer = info["maintainer"] as string | undefined;
  if (maintainer) maintainers.push(maintainer);
  else if (author) maintainers.push(author);
  const versionCount = Object.keys(releases).length;
  return {
    name,
    registry: "pypi",
    exists: true,
    firstPublishedAt,
    latestVersion: (info["version"] as string | undefined) ?? null,
    versionCount,
    versions: Object.keys(releases),
    description: (info["summary"] as string | undefined) ?? null,
    license: (info["license"] as string | undefined) ?? null,
    repositoryUrl,
    maintainers,
    downloadsLastWeek: null,
  };
}

export async function fetchPackageMetadata(
  name: string,
  registry: Registry,
): Promise<PackageMetadata> {
  if (registry === "npm") {
    const { status, body } = await fetchJson(
      `https://registry.npmjs.org/${encodeURIComponent(name)}`,
    );
    if (status === 404 || body === null) {
      return {
        name,
        registry,
        exists: false,
        firstPublishedAt: null,
        latestVersion: null,
        versionCount: 0,
        versions: [],
        description: null,
        license: null,
        repositoryUrl: null,
        maintainers: [],
        downloadsLastWeek: null,
      };
    }
    const metadata = npmMetadata(name, body as Record<string, unknown>);
    metadata.downloadsLastWeek = await npmDownloads(name);
    return metadata;
  }

  const { status, body } = await fetchJson(
    `https://pypi.org/pypi/${encodeURIComponent(name)}/json`,
  );
  if (status === 404 || body === null) {
    return {
      name,
      registry,
      exists: false,
      firstPublishedAt: null,
      latestVersion: null,
      versionCount: 0,
      versions: [],
      description: null,
      license: null,
      repositoryUrl: null,
      maintainers: [],
      downloadsLastWeek: null,
    };
  }
  return pypiMetadata(name, body as Record<string, unknown>);
}
