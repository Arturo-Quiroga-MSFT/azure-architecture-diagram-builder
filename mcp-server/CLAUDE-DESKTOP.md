# Claude Desktop integration

This guide connects the local AADB MCP server to Claude Desktop over stdio and
enables `render_diagram` to display an interactive diagram inline as an MCP App.

Azure Foundry resource and model-deployment tooling is documented separately in
[`CLAUDE-DESKTOP-AZURE-FOUNDRY.md`](CLAUDE-DESKTOP-AZURE-FOUNDRY.md). That MCP
server adds tools to Claude Desktop; it does not replace Claude as the host
model.

## Verified result

Local verification on macOS on 2026-08-20 used Claude Desktop `1.32885.1` and
Node.js `v24.18.0`.

- Claude initialized the AADB stdio server and discovered all 13 tools, 3
  prompts, and 4 resources.
- Claude read `ui://azure-diagram-builder/diagram.html` and called
  `render_diagram`.
- A four-service HTML diagram rendered visibly inline with pan, zoom, reset,
  fit, and three labeled connection chips.
- The compact example requested a 420 px app height. The app bounds its inline
  height to 420-720 px based on diagram dimensions.

This evidence covers the local Claude Desktop configuration and the tested
diagram. It does not establish the behavior of the deployed HTTP endpoint or
every Claude Desktop release.

## Prerequisites

1. Install and sign in to Claude Desktop.
2. Install Node.js 20 or newer.
3. Build the MCP server:

   ```bash
   cd mcp-server
   npm install
   npm run build
   ```

The build compiles the server and bundles the MCP App view into
`dist/diagramApp.html`.

## Configure Claude Desktop

On macOS, edit:

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

Merge this server entry into the existing JSON. Preserve any other Claude
preferences or MCP servers already in the file.

```json
{
  "mcpServers": {
    "azure-diagram-builder": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/AZURE-DIAGRAMS/mcp-server/dist/index.js",
        "--stdio"
      ]
    }
  }
}
```

Use an absolute Node path because macOS GUI applications do not reliably inherit
the shell's `PATH`. Find it with `command -v node`. Use the repository's
[`examples/claude-desktop-stdio.json`](examples/claude-desktop-stdio.json) as a
merge template.

Restart Claude Desktop after changing the configuration or rebuilding the MCP
server. Start a new chat when validating changed tool metadata or MCP App
resources because an existing conversation can retain an older tool catalog.

## Smoke test

Use this prompt in a new Claude conversation:

```text
Use azure-diagram-builder render_diagram to create a small interactive HTML
diagram with Front Door, App Service, Key Vault, and Cosmos DB. Give every
connection a descriptive action-oriented label. Display the MCP App inline. Do
not say it rendered unless an interactive diagram is visibly mounted in the
conversation.
```

Expected visible result:

- Four resource cards in a compact inline canvas.
- Three connection lines with readable bordered label chips.
- `+`, `-`, `Reset`, and `Fit` controls.
- No multi-screen vertical whitespace and no label/card overlap.

## How inline rendering works

`render_diagram` remains a normal MCP tool with text and structured fallbacks,
but it also declares:

```text
_meta.ui.resourceUri = ui://azure-diagram-builder/diagram.html
```

The server exposes that URI as `text/html;profile=mcp-app`. An MCP Apps-capable
host reads the UI resource, mounts it in a sandboxed iframe, and sends the tool
result to the app. The app then mounts `structuredContent.content` as HTML or
SVG.

Relevant implementation files:

- `src/index.ts`: tool metadata and `ui://` resource registration.
- `src/diagramAppClient.ts`: MCP App bridge and bounded host sizing.
- `src/diagramApp.html`: single-file app shell.
- `src/htmlRenderer.ts`: interactive diagram, label chips, pan, and zoom.
- `src/layoutEngine.ts`: label-aware layout corridors.
- `scripts/build-diagram-app.mjs`: bundles the browser app during `npm run build`.

Connection labels are required by the `render_diagram` input schema. HTML
renders reserve label corridors and display bordered chips. Presentation and
cost profiles may select representative labels for large diagrams; technical
profile shows every label.

## Troubleshooting

### Claude lists tools but does not render inline

Confirm the built server advertises a UI resource:

```text
render_diagram._meta.ui.resourceUri = ui://azure-diagram-builder/diagram.html
resource mimeType = text/html;profile=mcp-app
```

Then rebuild, fully restart Claude, and use a new chat. Returning raw HTML only
as tool text creates a downloadable artifact but does not instruct Claude to
mount an MCP App.

### Claude cannot start the server

- Use absolute paths for both Node and `dist/index.js`.
- Confirm both files exist.
- Include `--stdio` explicitly.
- Inspect `~/Library/Logs/Claude/mcp-server-azure-diagram-builder.log` and
  `~/Library/Logs/Claude/mcp.log`.

A healthy startup includes `initialize`, `tools/list`, `prompts/list`, and
`resources/list`. An inline render additionally includes `resources/read`
followed by `tools/call`.

### Canvas is extremely tall

Rebuild the current app. The viewer disables generic document auto-resize and
sends one bounded, aspect-aware height request to the host. The previous
auto-resize behavior could make Claude size the iframe to a multi-screen
document.

### Connections have no labels

Current `render_diagram` calls must include a descriptive label on every
connection. Rebuild and restart Claude if its cached schema still treats labels
as optional.

### Labels overlap resource cards

HTML rendering requests label-aware layout corridors, including for small
ungrouped diagrams. Run `npm run test:render-profiles` to exercise the compact
four-node regression case.

## Validation commands

From `mcp-server`:

```bash
npm run test:render-profiles
npm run test:contracts
```

The render-profile suite covers compact label corridors and HTML label chips.
The contract suite covers all tool handlers, MCP Apps metadata, the UI resource,
authentication, prompts, and resources.
