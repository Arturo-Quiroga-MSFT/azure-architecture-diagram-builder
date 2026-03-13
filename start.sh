#!/bin/sh
# Start the speech token server in the background, then run nginx in the foreground.
# If AZURE_SPEECH_REGION is not set the token server logs a warning and /api/speech-token
# returns 503 — the avatar "Present" button is simply hidden in that case.
node /srv/token-server/token-server.js &
nginx -g "daemon off;"
