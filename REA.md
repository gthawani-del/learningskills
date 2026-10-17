# REA workspace

This repository is the destination for app investigations and independently built features using [morluto/rea](https://github.com/morluto/rea).

## Reproduce the connection

Requirements: Node.js 22.19+ (22.x), 24.11+ (24.x), or 26+, npm, and procps-compatible ps on Linux.

```bash
npx -y rea-agents@6.5.0 setup --client codex --dry-run
npx -y rea-agents@6.5.0 setup --client codex
```

Review the proposed configuration and workflow paths, complete setup, then restart Codex. Setup registers the pinned MCP command `npx -y rea-agents@6.5.0 mcp`.

For static JavaScript/Electron analysis without waiting for MCP discovery:

```bash
npx -y rea-agents@6.5.0 analyze-javascript-application /absolute/path/to/app --json
```

See the [official installation guide](https://github.com/morluto/rea/blob/main/docs/installation.md) for providers and readiness diagnostics.

## Verified setup state

- GitHub connection for gthawani-del can read morluto/rea and write this repository.
- REA 6.5.0 CLI was downloaded and its help command ran successfully in the working environment.
- Codex MCP registration was applied; setup reported registration state `aligned`.
- Full setup remains incomplete: the bundled workflow could not be installed because the personal skills directory is on a read-only filesystem.
- This running session has not loaded REA MCP tools. Restart and verify discovery before claiming MCP analysis works.
- Native providers are not configured. No target app has been analyzed yet.

## Investigation workflow

Provide an app URL or local artifact and the exact feature to reproduce. Record the target version and question, retain evidence and limitations, derive a behavior specification, then implement and test the feature here.

Suggested layout once a target is selected:

- `investigations/<app>/<feature>/`: findings, evidence references, unknowns and acceptance criteria.
- `apps/<implementation>/`: working feature and its run instructions.

Keep credentials, private captures and proprietary app bundles out of this public repository. Findings should distinguish observed behavior from inferred implementation.
