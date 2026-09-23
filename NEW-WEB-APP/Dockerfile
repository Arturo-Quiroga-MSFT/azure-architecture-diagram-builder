
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts vitest.config.ts index.html ./
COPY shared ./shared
COPY server ./server
COPY src ./src
RUN npm run build

FROM node:22-alpine AS production
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
USER node
EXPOSE 8080
CMD ["node", "dist-server/server/index.js"]