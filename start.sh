#!/bin/sh
# Start the web app's background token server, then run nginx in the foreground.
#
# Speech/OpenAI token server (port 3001)
#    If AZURE_SPEECH_REGION is not set the token server logs a warning and
#    /api/speech-token returns 503 — the avatar "Present" button is hidden.
if [ -z "${APP_VERSION:-}" ] && [ -f /usr/share/nginx/html/version.json ]; then
	APP_VERSION="$(node -p "require('/usr/share/nginx/html/version.json').version" 2>/dev/null || true)"
	export APP_VERSION
fi

node /srv/token-server/token-server.js &

nginx -g "daemon off;"
