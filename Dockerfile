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
ARG VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST
# Set environment variables for build
ENV VITE_AZURE_OPENAI_ENDPOINT=$VITE_AZURE_OPENAI_ENDPOINT
ENV VITE_AZURE_OPENAI_API_KEY=$VITE_AZURE_OPENAI_API_KEY
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT51=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT51
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT52=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT52
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX
ENV VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK=$VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST=$VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST

# App Insights connection string workaround:
# The connection string contains semicolons (e.g. "InstrumentationKey=...;IngestionEndpoint=...")
# which cannot be passed via `az acr build --build-arg` because ACR Tasks interprets them
# as shell command separators. Instead, the deploy script (scripts/update_aca.sh) extracts
# the value into .env.appinsights, which is COPY'd here and sourced at build time.
# The glob pattern (appinsights*) ensures the build doesn't fail if the file is absent.
COPY .env.appinsights* ./

# Build the app (source App Insights env if present, then build)
RUN if [ -f .env.appinsights ]; then \
      export $(cat .env.appinsights) && echo "App Insights: $VITE_APPINSIGHTS_CONNECTION_STRING" | cut -c1-60; \
    fi && npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/Azure_Public_Service_Icons /usr/share/nginx/html/Azure_Public_Service_Icons
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
