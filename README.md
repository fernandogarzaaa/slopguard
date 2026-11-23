# slopguard

A guard against slopsquatting. It checks a package name against the live registry before you install it.

Slopsquatting is the attack where a language model invents a package name that does not exist, an attacker registers that name with malicious code, and a user or an autonomous agent installs it. The attacker exploits no bug in your code. The model just has to be wrong, and you have to install what it suggested.

slopguard checks the name first. It queries the live npm or PyPI registry and reports a verdict.

## Verdicts

- SAFE. The package exists and shows no risk signals.
- SUSPICIOUS. The package exists but looks risky, or it does not exist and closely resembles a popular package.
- HALLUCINATED. The package does not exist in the registry.

Every verdict carries a 0-100 risk score and reasons. A verdict is always computed from a live registry response. slopguard never invents one.

## Signals

The score comes from live registry data only.

- The package does not exist in the registry.
- Age in days since first publish.
- Download counts, where the registry exposes them (npm only).
- Repository URL present or missing.
- Description and license present or missing.
- Version count.
- Maintainer count.
- Typosquat similarity to the top 200 npm and top 200 PyPI packages. Edit distance 1-2 and confusable patterns such as hyphen versus underscore, pluralization, and letter swaps all count.

The top package lists live in `src/data/top-npm.json` and `src/data/top-pypi.json`. Each file notes its source. The npm list comes from the npms.io search API ranked by score. The PyPI list comes from the top PyPI packages by 30-day downloads.

## CLI

```sh
npm run build
node dist/cli/index.js check express
node dist/cli/index.js check expres
node dist/cli/index.js check requests --registry pypi
node dist/cli/index.js check express@4.18.2
node dist/cli/index.js scan package.json
node dist/cli/index.js scan requirements.txt
```

Options: `--registry npm|pypi` pins the registry. Without it, `check` tries npm first and falls back to PyPI when npm has no record. `--json` prints the full result as JSON.

Exit codes: 0 SAFE, 1 SUSPICIOUS, 2 HALLUCINATED, 3 usage or network error.

## MCP server

The same engine is exposed as a stdio MCP server. It reuses the core, it does not duplicate the logic.

```sh
node dist/mcp/index.js
```

Tools:

- `check_package`. Arguments: `name`, optional `registry`, optional `version`. Returns the verdict, score, and reasons.
- `scan_dependencies`. Arguments: `names`, `registry`. Returns one verdict per package.

Example client configuration for Claude Code or any MCP client:

```json
{
  "mcpServers": {
    "slopguard": {
      "command": "node",
      "args": ["/path/to/slopguard/dist/mcp/index.js"]
    }
  }
}
```

## Development

```sh
npm install
npm run build
npm test
npx tsc --noEmit
```

Tests use vitest. Unit tests use fixed fixtures. Integration tests hit the live registries.
