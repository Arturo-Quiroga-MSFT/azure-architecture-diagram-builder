#!/bin/bash
# Final encode for one episode: 1080p30 H.264 + AAC at -16 LUFS, captions sidecar, thumbnail,
# and a contact sheet for review. Usage: encode.sh <episode-dir>
# Writes $OUTPUT_DIR/<output>.mp4 (default demo-videos/videos/), plus captions/ and thumbnails/.
set -euo pipefail
source "$(dirname "$0")/config.sh"
D="$(cd "$1" && pwd)"
FF="$FFMPEG"
NAME="$(python3 -c "import json;print(json.load(open('$D/episode.json'))['output'])")"
mkdir -p "$OUTPUT_DIR/captions" "$OUTPUT_DIR/thumbnails" "$D/review"
OUT="$OUTPUT_DIR/$NAME.mp4"
# Recorded episodes write out/screen.webm; built ones (the trailer) write out/screen.mkv.
SCREEN="$D/out/screen.webm"; [[ -f "$D/out/screen.mkv" ]] && SCREEN="$D/out/screen.mkv"
$FF -y -loglevel error -i "$SCREEN" -i "$D/out/audio.wav" -filter_complex "$(cat "$D/out/filter.txt");[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
  -map '[v]' -map '[a]' -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUT"
cp "$D/out/captions.srt" "$OUTPUT_DIR/captions/$NAME.srt"
THUMB_AT="$(python3 -c "import json;c=json.load(open('$D/out/cut.json'));r=c['reveals'];print(round((r[0]+3) if r else c['total']*0.4,2))")"
$FF -y -loglevel error -ss "$THUMB_AT" -i "$OUT" -frames:v 1 -q:v 2 "$OUTPUT_DIR/thumbnails/$NAME.jpg"
DUR="$("$FFPROBE" -v error -show_entries format=duration -of csv=p=0 "$OUT")"
for i in 0 1 2 3 4 5 6 7 8 9 10 11; do
  $FF -y -loglevel error -ss "$(python3 -c "print(round($DUR*($i+0.5)/12,2))")" -i "$OUT" -frames:v 1 -vf scale=640:-1 "$D/review/f$i.png"
done
$FF -y -loglevel error $(for i in 0 1 2 3 4 5 6 7 8 9 10 11; do printf -- '-i %s ' "$D/review/f$i.png"; done) \
  -filter_complex "xstack=inputs=12:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0|0_h0+h1|w0_h0+h1|w0+w1_h0+h1|0_h0+h1+h2|w0_h0+h1+h2|w0+w1_h0+h1+h2" "$D/review/contact-sheet.png"
rm -f "$D"/review/f*.png
$FF -i "$OUT" -af ebur128 -f null - 2>&1 | awk '/^ +I:/{i=$2} END{printf "%s  %.0fs  %s LUFS\n", "'"$NAME"'", '"$DUR"', i}'
