# 10_AADB-Everywhere-MCP — storyboard

**Length:** 1:47 · **Recorded on:** production AADB MCP server v2.1.15 and web app v2.1.14 · **Music:** drive · **Narrator:** Andrew HD

A **real, unscripted GitHub Copilot CLI session** against the production AADB MCP server. Copilot runs in a
pseudo-terminal (node-pty) and its live output streams into a terminal window (xterm.js) in the recorded page.
The session is limited to the AADB MCP tools (`--excluded-tools` for shell, file and web tools; custom
instructions off), so the agent works only through MCP. Long model pauses are sped up and labelled.
The agent's answers vary per take: narration stays generic, and the tags read the live scores and cost.

Settings (`demo-videos/.env`): `AADB_MCP_URL`, `AADB_MCP_KEY` (a personal client key), optional `COPILOT_MODEL`.
Requires GitHub Copilot CLI (`copilot`) signed in, and `npm install` in `demo-videos/` (node-pty, xterm.js).

| # | On screen | Narration |
|---|---|---|
| 1 | Cold open: "Your architecture tools, in your agent" with client chips (VS Code, Copilot CLI, Claude, any MCP client) | n01-open |
| 2 | Title card: Episode 10 · "AADB Everywhere" | n02-title |
| 3 | Tools card: the server's tools, listed live with `tools/list` | n03-tools (13 tools) or n03-tools-generic |
| 4 | Setup card: the `.vscode/mcp.json` entry from the README (key prompted, never stored in the file) | n04-connect |
| 5 | Terminal: the prompt is typed; Copilot CLI starts | n05-ask |
| 6 | Validate call; tag shows the live design score | n06-validate |
| 7 | Harden + revalidate; tag shows before → after | n07-harden |
| 8 | Estimate costs + export; tag shows the live cost | n08-cost |
| 9 | Copilot's summary | n09-summary |
| 10 | The exported scene (captured from the session) opens in the web app with **Load diagram** | n10-open |
| 11 | Fit, cost callout, workflow panel | n11-tour |
| 12 | End card | n12-close |

Found while preparing: the MCP `validate_architecture` score deducted every per-service configuration setting, so
any realistic design scored 10/100 before and after hardening. Fixed in v2.1.15 (design score; configuration
settings listed separately).
