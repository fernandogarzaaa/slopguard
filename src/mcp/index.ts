import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkPackage } from "../core/index.js";
import type { CheckResult, Registry } from "../core/index.js";

const server = new McpServer({
  name: "slopguard",
  version: "0.1.0",
});

function resultText(result: CheckResult): string {
  const lines = [
    `${result.verdict} ${result.name} (${result.registry}) score ${result.score}`,
    ...result.reasons.map((reason) => `- ${reason}`),
  ];
  return lines.join("\n");
}

server.tool(
  "check_package",
  "Check one package name against the live registry. Returns a verdict of SAFE, SUSPICIOUS, or HALLUCINATED with a risk score and reasons.",
  {
    name: z.string().describe("Package name, for example express or requests."),
    registry: z
      .enum(["npm", "pypi"])
      .optional()
      .describe("Registry to check. Omit to auto-detect: npm first, then PyPI when npm has no record."),
    version: z.string().optional().describe("Exact version to check, for example 4.18.2."),
  },
  async ({ name, registry, version }) => {
    let result: CheckResult;
    if (registry) {
      result = await checkPackage(name, registry as Registry, version);
    } else {
      const npmResult = await checkPackage(name, "npm", version);
      if (npmResult.verdict !== "HALLUCINATED") {
        result = npmResult;
      } else {
        const pypiResult = await checkPackage(name, "pypi", version);
        result = pypiResult.metadata?.exists ? pypiResult : npmResult;
      }
    }
    return {
      content: [{ type: "text", text: resultText(result) }],
      structuredContent: result as unknown as Record<string, unknown>,
    };
  },
);

server.tool(
  "scan_dependencies",
  "Check a list of package names against the live registry. Returns one verdict per package.",
  {
    names: z
      .array(z.string())
      .describe("Package names to check, for example [\"express\", \"react\"]."),
    registry: z
      .enum(["npm", "pypi"])
      .describe("Registry to check. Use npm for package.json dependencies and pypi for requirements.txt."),
  },
  async ({ names, registry }) => {
    const results: CheckResult[] = [];
    for (const name of names) {
      results.push(await checkPackage(name, registry as Registry));
    }
    return {
      content: [
        { type: "text", text: results.map((r) => resultText(r)).join("\n") },
      ],
      structuredContent: { results: results as unknown as Record<string, unknown>[] },
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`slopguard MCP server failed to start: ${message}`);
  process.exit(1);
});
