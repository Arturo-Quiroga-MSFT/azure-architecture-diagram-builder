#!/bin/bash
# Seller turns for Episode 4 (Azure AI Speech, keyless). 24 kHz mono WAV for Voice Live.
# Uses SPEECH_RESOURCE_ID and SPEECH_REGION from the environment or demo-videos/.env.
set -euo pipefail
source "$(dirname "$0")/../../../../engine/config.sh"
: "${SPEECH_RESOURCE_ID:?Set SPEECH_RESOURCE_ID in demo-videos/.env}"
: "${SPEECH_REGION:?Set SPEECH_REGION in demo-videos/.env}"
cd "$(dirname "$0")"
VOICE="${VOICE:-en-US-BrianMultilingualNeural}"
REGION="$SPEECH_REGION"
RID="$SPEECH_RESOURCE_ID"
TOKEN="$(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken -o tsv)"
python3 - "$VOICE" "$REGION" "$RID" "$TOKEN" <<'PY'
import json, sys, urllib.request
voice, region, rid, token = sys.argv[1:]
for name, text in json.load(open('turns.json')):
    ssml = f"<speak version='1.0' xml:lang='en-US'><voice name='{voice}'>{text}</voice></speak>"
    req = urllib.request.Request(f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1', data=ssml.encode(), headers={
        'Authorization': f'Bearer aad#{rid}#{token}', 'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm', 'User-Agent': 'aadb-demo-videos'})
    data = urllib.request.urlopen(req).read()
    open(f'{name}.wav', 'wb').write(data)
    print(f'  {name}.wav {(len(data) - 44) / 48000:.1f}s')
PY
