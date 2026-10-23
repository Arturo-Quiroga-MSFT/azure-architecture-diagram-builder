"""Soundtrack, captions and cut list for one episode. Usage: mix.py <episode-dir>
Reads out/timeline.json + narr/*.wav + episode.json; writes out/audio.wav (stereo),
out/filter.txt (ffmpeg cut list: trim the loading phase, speed up waits) and out/captions.srt."""
import base64, json, sys, wave, os
import numpy as np
from music import render, duck

RATE, FF = 48000, 6
D = sys.argv[1]
ep = json.load(open(f'{D}/episode.json'))
tl = json.load(open(f'{D}/out/timeline.json'))
off = tl['videoOffset']
# Each sped-up wait runs at FF x, or faster when it has a `max` on-screen length.
segs = sorted((s['a'], s['b'], max(FF, (s['b'] - s['a']) / s['max']) if s.get('max') else FF) for s in tl['ff'])


def remap(t):
    out = t
    for a, b, k in segs:
        if t >= b: out -= (b - a) * (1 - 1 / k)
        elif t > a: out -= (t - a) * (1 - 1 / k)
    return out


total = remap(tl['end']) + 0.5
n = int(total * RATE)


def load(name):
    return load_file(f'{D}/narr/{name}.wav')


def load_file(path):
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        sr = w.getframerate()
    return np.interp(np.arange(int(len(x) * RATE / sr)) * sr / RATE, np.arange(len(x)), x).astype(np.float32)


voice = np.zeros(n, np.float32)
active = np.zeros(n, np.float32)
srt = []
for k, c in enumerate(tl['narr']):
    x = load(c['name']); at = remap(c['at']); i = int(at * RATE); x = x[: max(0, n - i)]
    voice[i:i + len(x)] += x
    active[max(0, i - RATE // 4): i + len(x) + RATE // 4] = 1
    srt.append((at, at + len(x) / RATE, c.get('text', '')))

def lay(at, x):
    at = remap(at); i = int(at * RATE); x = x[: max(0, n - i)]
    voice[i:i + len(x)] += x
    active[max(0, i - RATE // 4): i + len(x) + RATE // 4] = 1


for c in tl.get('audio', []):
    lay(c['at'], load_file(c['file']))
for c in tl.get('pcm', []):
    x = np.frombuffer(base64.b64decode(c['b64']), np.int16).astype(np.float32) / 32768
    lay(c['at'], np.interp(np.arange(int(len(x) * RATE / 24000)) * 24000 / RATE, np.arange(len(x)), x).astype(np.float32))
for c in tl.get('captions', []):
    srt.append((remap(c['at']), remap(c['end']), c['text']))
srt.sort()

reveals = [remap(r) for r in tl.get('reveals', [])]
music = render(ep.get('music', 'drive'), total, reveals=reveals, rate=RATE)
music = duck(music, active, RATE, depth=ep.get('duck', 0.62)) * ep.get('musicLevel', 0.42)
mix = music + voice[:, None] * 0.95
mix /= max(1.0, np.abs(mix).max() / 0.97)
with wave.open(f'{D}/out/audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())


def ts(s):
    ms = int(round(s * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); sec, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{sec:02},{ms:03}'


def chunks(text, a, b, maxlen=84):
    words, lines, cur = text.split(), [], ''
    for wd in words:
        if len(cur) + len(wd) + 1 > maxlen and cur: lines.append(cur); cur = wd
        else: cur = f'{cur} {wd}'.strip()
    if cur: lines.append(cur)
    pairs = [' \n'.join(lines[i:i + 2]).replace(' \n', '\n') for i in range(0, len(lines), 2)]
    total_chars = sum(len(p) for p in pairs) or 1; t = a
    for p in pairs:
        d = (b - a) * len(p) / total_chars; yield t, t + d, p; t += d


with open(f'{D}/out/captions.srt', 'w') as fh:
    k = 1
    for a, b, text in srt:
        for x, y, p in chunks(text, a, b):
            fh.write(f'{k}\n{ts(x)} --> {ts(y)}\n{p}\n\n'); k += 1

parts, cur = [], 0.0
for a, b, k in segs:
    parts += [(cur, a, 1), (a, b, round(k, 3))]; cur = b
parts.append((cur, tl['end'], 1))
f, labels = [], []
for i, (a, b, k) in enumerate(parts):
    f.append(f"[0:v]trim=start={a + off:.3f}:end={b + off:.3f},setpts=(PTS-STARTPTS)/{k}[v{i}]"); labels.append(f'[v{i}]')
f.append(''.join(labels) + f'concat=n={len(parts)}:v=1:a=0,fps=30,fade=t=in:st=0:d=0.8,fade=t=out:st={total - 1.2:.2f}:d=1.2[v]')
open(f'{D}/out/filter.txt', 'w').write(';'.join(f))
json.dump({'total': total, 'reveals': reveals}, open(f'{D}/out/cut.json', 'w'))
print(f'{ep["output"]}: {total:.1f}s (recorded {tl["end"]:.1f}s), sped-up waits {len(segs)}, reveals {[round(r, 1) for r in reveals]}')
