"""Render ~26 s previews of music presets with two narration cues on top (as they would sit in a film).
Usage: sample_music.py <out-dir> <narr-dir> <cue-1> <cue-2> <preset> [<preset> ...]
Example: sample_music.py /tmp/music episodes/08-deploy-it/narr n04-generate n14-close drive lift pulse ambient"""
import sys, wave, time
import numpy as np
from music import render, duck

RATE = 48000

def load(name):
    with wave.open(f'{NARR}/{name}.wav') as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768; sr = w.getframerate()
    return np.interp(np.arange(int(len(x) * RATE / sr)) * sr / RATE, np.arange(len(x)), x).astype(np.float32)

out, NARR, CUE1, CUE2 = sys.argv[1:5]
for preset in sys.argv[5:]:
    t = time.time()
    total, reveal = 26.0, 15.0
    m = render(preset, total, reveals=[reveal], rate=RATE)
    n = len(m); voice = np.zeros(n, np.float32); active = np.zeros(n, np.float32)
    for name, at in ((CUE1, 3.0), (CUE2, 17.5)):
        x = load(name); i = int(at * RATE); x = x[: n - i]; voice[i:i + len(x)] += x
        active[max(0, i - RATE // 4): i + len(x) + RATE // 4] = 1
    m = duck(m, active, RATE) * 0.42
    mix = m + voice[:, None] * 0.95
    mix /= max(1.0, np.abs(mix).max() / 0.97)
    with wave.open(f'{out}/{preset}.wav', 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(RATE); w.writeframes((mix * 32767).astype(np.int16).tobytes())
    print(f'{preset}: {time.time() - t:.1f}s')
