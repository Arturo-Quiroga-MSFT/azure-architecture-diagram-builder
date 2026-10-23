#!/bin/bash
# Narration via Azure AI Speech (HD voices). Keyless: an Entra token for the Speech resource
# (your identity needs the "Cognitive Services Speech User" role on it).
# Usage: narrate.sh <episode-dir>. Writes <episode>/narr/<cue>.wav (24 kHz mono); a cue is only
# re-synthesized when its text or the voice changed (hash in narr/<cue>.sha). ONLY=<glob> limits the cues.
# Settings (environment or demo-videos/.env): SPEECH_RESOURCE_ID, SPEECH_REGION, optional AZURE_CONFIG_DIR.
set -euo pipefail
source "$(dirname "$0")/config.sh"
: "${SPEECH_RESOURCE_ID:?Set SPEECH_RESOURCE_ID (ARM id of the Speech resource) in demo-videos/.env}"
: "${SPEECH_REGION:?Set SPEECH_REGION (e.g. westus2) in demo-videos/.env}"
cd "$1"; mkdir -p narr
VOICE="${VOICE:-$(python3 -c "import json;print(json.load(open('episode.json')).get('voice','en-US-Andrew:DragonHDLatestNeural'))")}"
TOKEN=""
python3 -c "import json;[print(n+'\t'+t) for n,t in json.load(open('narration.json'))]" | while IFS=$'\t' read -r name text; do
  [[ -n "${ONLY:-}" && "$name" != $ONLY ]] && continue
  h="$(printf '%s|%s' "$VOICE" "$text" | shasum | cut -c1-16)"
  [[ -f "narr/$name.wav" && "$(cat "narr/$name.sha" 2>/dev/null)" == "$h" ]] && continue
  [[ -n "$TOKEN" ]] || TOKEN="$(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv)"
  curl -sS --fail -X POST "https://$SPEECH_REGION.tts.speech.microsoft.com/cognitiveservices/v1" \
    -H "Authorization: Bearer aad#$SPEECH_RESOURCE_ID#$TOKEN" -H "Content-Type: application/ssml+xml" \
    -H "X-Microsoft-OutputFormat: riff-24khz-16bit-mono-pcm" -H "User-Agent: aadb-demo-videos" \
    --data-binary "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='$VOICE'>$text</voice></speak>" \
    -o "narr/$name.wav"
  echo "$h" > "narr/$name.sha"
  printf '  %-14s %5.1fs\n' "$name" "$(python3 -c "import wave,sys;w=wave.open(sys.argv[1]);print(w.getnframes()/w.getframerate())" "narr/$name.wav")"
done
