# Build stage
FROM node:20-alpine AS build

WORKDIR /app

ARG NPM_REGISTRY=https://packagefeedproxy.microsoft.io/npm/
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY
ENV NPM_CONFIG_REPLACE_REGISTRY_HOST=always
ENV NODE_OPTIONS=--max-old-space-size=4096

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build arguments for Azure OpenAI configuration.
# NOTE: The API key is intentionally NOT a build arg. Azure OpenAI calls are
# proxied server-side by the token server (server/token-server.js) using managed
# identity, so the key must never be embedded in the client bundle. Set
# AZURE_OPENAI_ENDPOINT (and optionally AZURE_OPENAI_API_KEY) as RUNTIME env on
# the container instead.
ARG VITE_AZURE_OPENAI_ENDPOINT
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT61SOL
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT6SOL
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT6LUNA
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT6ASTRA
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT56SOL
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT56TERRA
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GPT56LUNA
ARG VITE_AZURE_OPENAI_DEPLOYMENT_CLAUDE_OPUS_55
ARG VITE_AZURE_OPENAI_DEPLOYMENT_CLAUDE_SONNET_55
ARG VITE_AZURE_OPENAI_DEPLOYMENT_MAI_THINKING_1
ARG VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK_V4_PRO
ARG VITE_AZURE_OPENAI_DEPLOYMENT_GROK47
ARG VITE_AZURE_OPENAI_DEPLOYMENT_MISTRALLARGE3
ARG VITE_AZURE_OPENAI_DEPLOYMENT_KIMIK26
ARG VITE_SPEECH_REGION
ARG VITE_AVATAR_CHARACTER
ARG VITE_AVATAR_STYLE
ARG VITE_AVATAR_VOICE
ARG VITE_AVATAR_CUSTOM_CHARACTER
ARG VITE_AVATAR_CUSTOM_STYLE
ARG VITE_AVATAR_CUSTOM_PHOTO_MODEL
ARG VITE_AVATAR_CUSTOM_VOICE
ARG VITE_AVATAR_CUSTOM_BUILTIN_VOICE
ARG VITE_AVATAR_CUSTOM_LABEL
# Delegated (per-user) Entra sign-in for "Import from Azure". Only CLIENT_ID is
# required to activate delegated mode; AUTHORITY/ARM_SCOPE match code defaults.
# VITE_AZURE_AD_REDIRECT_URI is intentionally NOT built in — the code defaults
# to window.location.origin so the deployed host is used automatically.
ARG VITE_AZURE_AD_CLIENT_ID
ARG VITE_AZURE_AD_AUTHORITY
ARG VITE_ARM_SCOPE
ARG VITE_ENABLE_ADOPTION_IMPACT=false
ARG VITE_ENABLE_VOICE_LIVE=false
# Video tour media (videos.json + episodes) published by demo-videos/engine/publish-web.sh; defaults to /media/videos.
ARG VITE_VIDEO_BASE_URL
ARG LOAD_ENV_BUILD=true
# Set environment variables for build
ENV VITE_AZURE_OPENAI_ENDPOINT=$VITE_AZURE_OPENAI_ENDPOINT
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT61SOL=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT61SOL
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT6SOL=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT6SOL
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT6LUNA=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT6LUNA
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT6ASTRA=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT6ASTRA
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT56SOL=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT56SOL
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT56TERRA=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT56TERRA
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GPT56LUNA=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT56LUNA
ENV VITE_AZURE_OPENAI_DEPLOYMENT_CLAUDE_OPUS_55=$VITE_AZURE_OPENAI_DEPLOYMENT_CLAUDE_OPUS_55
ENV VITE_AZURE_OPENAI_DEPLOYMENT_CLAUDE_SONNET_55=$VITE_AZURE_OPENAI_DEPLOYMENT_CLAUDE_SONNET_55
ENV VITE_AZURE_OPENAI_DEPLOYMENT_MAI_THINKING_1=$VITE_AZURE_OPENAI_DEPLOYMENT_MAI_THINKING_1
ENV VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK_V4_PRO=$VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK_V4_PRO
ENV VITE_AZURE_OPENAI_DEPLOYMENT_GROK47=$VITE_AZURE_OPENAI_DEPLOYMENT_GROK47
ENV VITE_AZURE_OPENAI_DEPLOYMENT_MISTRALLARGE3=$VITE_AZURE_OPENAI_DEPLOYMENT_MISTRALLARGE3
ENV VITE_AZURE_OPENAI_DEPLOYMENT_KIMIK26=$VITE_AZURE_OPENAI_DEPLOYMENT_KIMIK26
ENV VITE_SPEECH_REGION=$VITE_SPEECH_REGION
ENV VITE_AVATAR_CHARACTER=$VITE_AVATAR_CHARACTER
ENV VITE_AVATAR_STYLE=$VITE_AVATAR_STYLE
ENV VITE_AVATAR_VOICE=$VITE_AVATAR_VOICE
ENV VITE_AVATAR_CUSTOM_CHARACTER=$VITE_AVATAR_CUSTOM_CHARACTER
ENV VITE_AVATAR_CUSTOM_STYLE=$VITE_AVATAR_CUSTOM_STYLE
ENV VITE_AVATAR_CUSTOM_PHOTO_MODEL=$VITE_AVATAR_CUSTOM_PHOTO_MODEL
ENV VITE_AVATAR_CUSTOM_VOICE=$VITE_AVATAR_CUSTOM_VOICE
ENV VITE_AVATAR_CUSTOM_BUILTIN_VOICE=$VITE_AVATAR_CUSTOM_BUILTIN_VOICE
ENV VITE_AVATAR_CUSTOM_LABEL=$VITE_AVATAR_CUSTOM_LABEL
ENV VITE_AZURE_AD_CLIENT_ID=$VITE_AZURE_AD_CLIENT_ID
ENV VITE_AZURE_AD_AUTHORITY=$VITE_AZURE_AD_AUTHORITY
ENV VITE_ARM_SCOPE=$VITE_ARM_SCOPE
ENV VITE_ENABLE_ADOPTION_IMPACT=$VITE_ENABLE_ADOPTION_IMPACT
ENV VITE_ENABLE_VOICE_LIVE=$VITE_ENABLE_VOICE_LIVE
ENV VITE_VIDEO_BASE_URL=$VITE_VIDEO_BASE_URL

# App Insights connection string workaround:
# The connection string contains semicolons (e.g. "InstrumentationKey=...;IngestionEndpoint=...")
# which cannot be passed via `az acr build --build-arg` because ACR Tasks interprets them
# as shell command separators. Instead, the deploy script (scripts/production/deploy-webapp.sh) extracts
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
RUN if [ "$LOAD_ENV_BUILD" = "true" ] && [ -f .env.build ]; then \
      export $(grep -v '^#' .env.build | grep -v '^\s*$' | xargs); \
    fi && \
    if [ -f .env.appinsights ]; then \
      export $(cat .env.appinsights); \
    fi && npm run build

# Production stage
FROM nginx:alpine

ARG NPM_REGISTRY=https://packagefeedproxy.microsoft.io/npm/
ARG ENABLE_ADOPTION_IMPACT=false
ENV NPM_CONFIG_REGISTRY=$NPM_REGISTRY
ENV NPM_CONFIG_REPLACE_REGISTRY_HOST=always
ENV ENABLE_ADOPTION_IMPACT=$ENABLE_ADOPTION_IMPACT

# Install Node.js for the speech/OpenAI token server.
RUN apk add --no-cache nodejs npm

# Bicep CLI for the Deployment Guide compile check (/api/bicep/build).
# Pinned release and checksum; self-contained musl build.
ARG BICEP_VERSION=v0.48.1
ARG BICEP_SHA256=fbea904a81e17267757c08909ad3bac82fa96d4d164d1bd07bf0fa8fd9b7b982
RUN apk add --no-cache libstdc++ libgcc \
    && wget -q -O /usr/local/bin/bicep "https://github.com/Azure/bicep/releases/download/${BICEP_VERSION}/bicep-linux-musl-x64" \
    && echo "${BICEP_SHA256}  /usr/local/bin/bicep" | sha256sum -c - \
    && chmod +x /usr/local/bin/bicep
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 BICEP_PATH=/usr/local/bin/bicep

# Set up the speech token server
WORKDIR /srv/token-server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/token-server.js ./
COPY server/instrumentation.js ./
COPY server/voice-live-relay.js ./
COPY server/bicep-check.js ./
COPY server/impact-routes.js server/impact-records.js ./
RUN if [ "$ENABLE_ADOPTION_IMPACT" != "true" ]; then rm -f impact-routes.js impact-records.js; fi

# Copy static build output
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/Azure_Public_Service_Icons /usr/share/nginx/html/Azure_Public_Service_Icons
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx-security-headers.conf /etc/nginx/aadb-security-headers.conf

# Startup: token server in background, nginx in foreground.
COPY start.sh /start.sh
# Strip any CR (CRLF) that a Windows checkout may have introduced, then mark
# executable — a CRLF shebang makes the container report "/start.sh: not found".
RUN sed -i 's/\r$//' /start.sh && chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
