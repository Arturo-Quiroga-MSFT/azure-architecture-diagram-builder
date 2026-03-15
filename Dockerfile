# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for Azure OpenAI credentials
ARG VITE_AZURE_OPENAI_ENDPOINT
ARG VITE_AZURE_OPENAI_API_KEY
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT51
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT52
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT54
ARG VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST
ARG VITE_SPEECH_REGION
# Set environment variables for build
ENV VITE_AZURE_OPENAI_ENDPOINT=$VITE_AZURE_OPENAI_ENDPOINT
ENV VITE_AZURE_OPENAI_API_KEY=$VITE_AZURE_OPENAI_API_KEY
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT51=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT51
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT52=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT52
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT54=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT54
ENV VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK=$VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST=$VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST
ENV VITE_SPEECH_REGION=$VITE_SPEECH_REGION

# App Insights connection string workaround:
# The connection string contains semicolons (e.g. "InstrumentationKey=...;IngestionEndpoint=...")
# which cannot be passed via `az acr build --build-arg` because ACR Tasks interprets them
# as shell command separators. Instead, the deploy script (scripts/update_aca.sh) extracts
# the value into .env.appinsights, which is COPY'd here and sourced at build time.
# The glob pattern (appinsights*) ensures the build doesn't fail if the file is absent.
# .env.build  — written by scripts/azd-prepackage.sh before 'azd package';
#               contains all VITE_* vars as KEY=VALUE lines.
# .env.appinsights — App Insights connection string workaround (see below).
# Both globs are optional so the build doesn't fail in environments that
# don't create them (e.g. direct docker build with --build-arg).
COPY .env.build* .env.appinsights* ./

# Build the app — source the optional env files first so their values are
# available to Vite, then fall back to the ARG/ENV values set above.
RUN if [ -f .env.build ]; then \
      export $(grep -v '^#' .env.build | grep -v '^\s*$' | xargs); \
    fi && \
    if [ -f .env.appinsights ]; then \
      export $(cat .env.appinsights) && echo "App Insights: $VITE_APPINSIGHTS_CONNECTION_STRING" | cut -c1-60; \
    fi && npm run build

# Production stage
FROM nginx:alpine

# Install Node.js for the speech token server (uses DefaultAzureCredential / managed identity)
RUN apk add --no-cache nodejs npm

# Set up the speech token server
WORKDIR /srv/token-server
COPY server/package.json ./
RUN npm install --omit=dev
COPY server/token-server.js ./

# Copy static build output
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/Azure_Public_Service_Icons /usr/share/nginx/html/Azure_Public_Service_Icons
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Startup: token server in background + nginx in foreground
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
