# AADB Physical Architecture Studio — production image.
# Multi-stage: build the SPA + server, then run a slim Node 22 runtime.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx vite build && npx tsc -p tsconfig.server.json

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist-server/server/index.js"]
