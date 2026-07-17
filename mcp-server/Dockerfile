# Standalone MCP server image — decoupled from the web app (own Container App / FQDN).
#
# IMPORTANT: the build context MUST be the repository root, because the MCP
# build's sync scripts read the web app's data as the single source of truth:
#   - src/data/serviceIconMapping.ts        (icon map + categories)
#   - src/data/pricing/regions/**           (distilled to a pricing sidecar)
#   - Azure_Public_Service_Icons/Icons/**   (official glyphs, embedded as data URIs)
#
# Build locally:
#   docker build -f mcp-server/Dockerfile -t aadb-mcp .
# (azd builds it via the 'mcp' service in azure.yaml with docker.context: ".")

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app/mcp-server

# Install deps first for better layer caching.
COPY mcp-server/package*.json ./
RUN npm ci

# MCP server sources.
COPY mcp-server/tsconfig.json ./
COPY mcp-server/src ./src
COPY mcp-server/scripts ./scripts

# Web-app data the prebuild sync scripts read (resolved as <repoRoot>/src/data
# and <repoRoot>/Azure_Public_Service_Icons — i.e. /app/... here).
COPY src/data /app/src/data
COPY Azure_Public_Service_Icons /app/Azure_Public_Service_Icons

# Runs prebuild (sync:icons + sync:pricing) then tsc, and copies the generated
# sidecars into dist/.
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /srv/mcp-server

ENV NODE_ENV=production \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=3030 \
    MCP_HTTP_PATH=/mcp

# Production dependencies only.
COPY mcp-server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled server + generated icon/pricing sidecars.
COPY --from=build /app/mcp-server/dist ./dist

EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:3030/healthz" >/dev/null 2>&1 || exit 1

# Streamable-HTTP transport on 0.0.0.0:3030 (/mcp), health at /healthz.
CMD ["node", "dist/index.js", "--http"]
