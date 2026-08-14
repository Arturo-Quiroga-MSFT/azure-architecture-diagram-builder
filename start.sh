#!/bin/sh
# Start the web app's background token server, then run nginx in the foreground.
#
# Speech/OpenAI token server (port 3001)
#    If AZURE_SPEECH_REGION is not set the token server logs a warning and
#    /api/speech-token returns 503 — the avatar "Present" button is hidden.
node /srv/token-server/token-server.js &

nginx -g "daemon off;"
