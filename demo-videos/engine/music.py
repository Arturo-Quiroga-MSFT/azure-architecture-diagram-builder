"""Original synthesized scores for the AADB video series (no samples, no licensing).

render(preset, total, reveals=(), rate=48000) -> float32 array (n, 2), peak ~0.9.
Presets: drive (118 bpm, upbeat corporate), lift (104 bpm, piano-led optimistic),
pulse (124 bpm, energetic sidechain), ambient (the original slow film score feel).
Song shape: intro, groove with A/B variations every 8 bars, a 2-bar break + riser before
each reveal and a hit on it, and an outro that drops the drums.
"""
import numpy as np
from scipy.signal import butter, sosfilt

RNG = np.random.default_rng(11)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def _hp(x, f, rate, order=2):
    return sosfilt(butter(order, f, 'hp', fs=rate, output='sos'), x)


def _lp(x, f, rate, order=2):
    return sosfilt(butter(order, f, 'lp', fs=rate, output='sos'), x)


def _bp(x, lo, hi, rate):
    return sosfilt(butter(2, [lo, hi], 'bp', fs=rate, output='sos'), x)


class Score:
    def __init__(self, total, rate):
        self.rate, self.n = rate, int(total * rate)
        self.buf = np.zeros((self.n, 2), np.float32)

    def add(self, at, x, gain=1.0, pan=0.0):
        i = int(at * self.rate)
        if i >= self.n or i + len(x) <= 0:
            return
        if i < 0:
            x, i = x[-i:], 0
        x = x[: self.n - i] * gain
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.buf[i:i + len(x), 0] += (x * l * 1.414).astype(np.float32)
        self.buf[i:i + len(x), 1] += (x * r * 1.414).astype(np.float32)


# ── Instruments (mono generators) ─────────────────────────────────────────────
def kick(rate, punch=1.0):
    t = np.arange(int(0.42 * rate)) / rate
    f = 46 + 110 * np.exp(-t * 28)
    body = np.sin(2 * np.pi * np.cumsum(f) / rate) * np.exp(-t * 7.5)
    click = RNG.standard_normal(len(t)) * np.exp(-t * 400) * 0.25
    return np.tanh((body + click) * 1.6 * punch) * 0.9


def clap(rate):
    t = np.arange(int(0.3 * rate)) / rate
    env = sum(np.exp(-np.clip(t - d, 0, None) * 90) * (t >= d) for d in (0, 0.011, 0.022)) + 0.6 * np.exp(-t * 18)
    return _bp(RNG.standard_normal(len(t)), 900, 4500, rate) * env * 0.9


def hat(rate, open_=False):
    t = np.arange(int((0.35 if open_ else 0.06) * rate)) / rate
    return _hp(RNG.standard_normal(len(t)), 7000, rate) * np.exp(-t * (11 if open_ else 70)) * 0.5


def shaker(rate):
    t = np.arange(int(0.09 * rate)) / rate
    env = np.sin(np.pi * np.clip(t / 0.09, 0, 1)) ** 2
    return _hp(RNG.standard_normal(len(t)), 5000, rate) * env * 0.35


def saw(f, t, harm=14, bright=1.0):
    k = np.arange(1, harm + 1)[:, None]
    amp = (1 / k) * np.exp(-(k - 1) * (0.35 / max(bright, 0.05)))
    amp[(k[:, 0] * f) > 16000] = 0
    return (amp * np.sin(2 * np.pi * k * f * t)).sum(0)


def bass(f, dur, rate):
    t = np.arange(int(dur * rate)) / rate
    env = np.minimum(1, t / 0.005) * np.exp(-t * 3.2)
    bright = 0.25 + 1.6 * np.exp(-t * 14)
    x = saw(f, t, 10, bright=bright.mean()) * 0.55 + np.sin(2 * np.pi * f * t) * 0.8
    return np.tanh(x * env * 1.4) * 0.7


def pluck(f, dur, rate, bright=1.4):
    t = np.arange(int(dur * rate)) / rate
    k = np.arange(1, 10)[:, None]
    amp = (1 / k ** 1.2) * np.exp(-t[None, :] * (3 + k * 2.2 / bright))
    return (amp * np.sin(2 * np.pi * k * f * t)).sum(0) * np.minimum(1, t / 0.002) * 0.6


def piano(f, dur, rate, vel=1.0):
    t = np.arange(int(dur * rate)) / rate
    x = np.zeros_like(t)
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + 0.0004 * k * k)
        if fk > 15000:
            break
        x += (vel ** (k * 0.4)) / k ** 1.1 * np.sin(2 * np.pi * fk * t) * np.exp(-t * (0.9 + 0.45 * k))
    return x * np.minimum(1, t / 0.003) * 0.55


def pad(freqs, dur, rate, attack=0.6, cutoff=2400):
    t = np.arange(int(dur * rate)) / rate
    x = sum(saw(f * d, t, 10, 0.8) for f in freqs for d in (0.997, 1.0, 1.004)) / (3 * len(freqs))
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / 0.4)
    return _lp(x, cutoff, rate) * env


def riser(dur, rate):
    t = np.arange(int(dur * rate)) / rate
    k = t / dur
    noise = RNG.standard_normal(len(t))
    swept = np.zeros_like(noise)
    for a, b in ((0, .25), (.25, .5), (.5, .75), (.75, 1.0)):
        m = (k >= a) & (k < b)
        swept[m] = _hp(noise, 300 + 6000 * a, rate)[m]
    tone = np.sin(2 * np.pi * np.cumsum(220 + 1600 * k ** 2) / rate)
    return (swept * 0.5 + tone * 0.25) * k ** 2.2


def crash(rate):
    t = np.arange(int(2.6 * rate)) / rate
    return _hp(RNG.standard_normal(len(t)), 4000, rate) * np.exp(-t * 1.6) * 0.45 + \
        np.sin(2 * np.pi * 50 * t) * np.exp(-t * 2.5) * 0.8


# ── Presets ──────────────────────────────────────────────────────────────────
PRESETS = {
    'drive': dict(bpm=118, prog=[(62, [62, 66, 69]), (57, [61, 64, 69]), (59, [62, 66, 71]), (55, [62, 67, 71])],
                  lead='pluck', drums='four', keys='pad'),
    'lift': dict(bpm=104, prog=[(60, [60, 64, 67]), (55, [59, 62, 67]), (57, [60, 64, 69]), (53, [57, 60, 65])],
                 lead='piano', drums='light', keys='piano'),
    'pulse': dict(bpm=124, prog=[(52, [55, 59, 64]), (48, [55, 60, 64]), (55, [59, 62, 67]), (50, [57, 62, 66])],
                  lead='pluck', drums='four', keys='pump'),
    'ambient': dict(bpm=66, prog=[(57, [57, 60, 64]), (53, [57, 60, 65]), (48, [55, 60, 64]), (55, [55, 59, 62])],
                    lead='pluck', drums='none', keys='pad'),
}


def render(preset='drive', total=60.0, reveals=(), rate=48000, outro=True):
    P = PRESETS[preset]
    beat = 60 / P['bpm']
    barlen = 4 * beat
    S = Score(total, rate)
    K, C, HC, HO, SH = kick(rate), clap(rate), hat(rate), hat(rate, True), shaker(rate)
    bars = int(total / barlen) + 1
    reveal_bars = {int(r / barlen) for r in reveals}
    break_bars = {b - j for b in reveal_bars for j in (1, 2) if b - j >= 0}
    out_from = bars - 3 if outro else bars + 1

    for b in range(bars):
        t0 = b * barlen
        root, chord = P['prog'][b % 4]
        sec = 'intro' if b < 4 else 'out' if b >= out_from else 'break' if b in break_bars else 'main'
        var = (b // 8) % 2  # A/B variation every 8 bars
        full = sec == 'main'
        cf = [midi(m) for m in chord]

        # Keys / harmony
        if P['keys'] == 'piano':
            for j, off in enumerate((0, 1.5, 2, 3) if full else (0, 2)):
                for m in chord:
                    S.add(t0 + off * beat, piano(midi(m), 2.2 * beat, rate, 0.9 if j == 0 else 0.7), 0.16, -0.25 + 0.25 * (m % 3))
            S.add(t0, pad(cf, barlen + 0.3, rate, 0.4, 1800), 0.10, 0)
        else:
            p = pad(cf + [cf[0] * 2], barlen + 0.4, rate, 0.35 if full else 0.8, 2600 if full else 1600)
            if P['keys'] == 'pump' and sec in ('main', 'break'):
                tt = np.arange(len(p)) / rate
                p = p * (1 - 0.65 * np.exp(-((tt % beat)) * 7))
            S.add(t0, p, 0.30, -0.35); S.add(t0 + 0.012, p, 0.30, 0.35)

        # Bass
        if sec in ('main',) or (sec == 'intro' and b >= 2 and P['drums'] != 'none'):
            pattern = (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5) if P['bpm'] >= 115 else (0, 1, 1.5, 2, 3, 3.5)
            for o in pattern:
                f = midi(root - 24) * (2 if (o in (1.5, 3.5) and var) else 1)
                S.add(t0 + o * beat, bass(f, beat * 0.48, rate), 0.30, 0)

        # Lead / arpeggio
        if sec != 'out' and (b >= 2 or P['drums'] == 'none'):
            notes = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 24, chord[2] + 12, chord[1] + 12, chord[0] + 24, chord[2] + 12]
            if var:
                notes = notes[::-1]
            step = beat / 2
            for j in range(8):
                if sec == 'break' and j % 2:
                    continue
                f = midi(notes[j])
                gen = piano(f, beat, rate, 0.8) if P['lead'] == 'piano' else pluck(f, beat * 0.9, rate)
                S.add(t0 + j * step, gen, 0.13 if P['lead'] == 'piano' else 0.11, -0.45 if j % 2 else 0.45)

        # Drums
        if P['drums'] != 'none' and sec in ('main', 'intro'):
            if P['drums'] == 'four' and sec == 'main':
                for q in range(4):
                    S.add(t0 + q * beat, K, 0.55)
                    S.add(t0 + (q + 0.5) * beat, HO if var else HC, 0.22 if var else 0.30, 0.25)
                for q in (1, 3):
                    S.add(t0 + q * beat, C, 0.30, -0.1)
                for s16 in range(16):
                    S.add(t0 + s16 * beat / 4, HC, 0.06 + 0.05 * (s16 % 4 == 2), -0.3)
            elif P['drums'] == 'light' and sec == 'main':
                for q in (0, 2):
                    S.add(t0 + q * beat, K, 0.42)
                for q in (1, 3):
                    S.add(t0 + q * beat, C, 0.16, -0.1)
                for s8 in range(8):
                    S.add(t0 + s8 * beat / 2, SH, 0.5 + 0.3 * (s8 % 2), 0.3)
            else:  # intro: hats only, building
                for s8 in range(8):
                    S.add(t0 + s8 * beat / 2, HC, 0.05 + 0.03 * b, 0.25)

    # Risers into reveals, hit on the reveal
    for r in reveals:
        d = min(2 * barlen, r)
        if d > 0.5:
            S.add(r - d, riser(d, rate), 0.30, 0)
        S.add(r, crash(rate), 0.55, 0)
        S.add(r, K, 0.7)

    x = S.buf
    x = np.tanh(x * 1.3) / np.tanh(1.3)  # gentle glue
    fade = np.minimum(1, np.arange(S.n) / (1.0 * rate))
    end = np.clip((S.n - np.arange(S.n)) / (3.5 * rate), 0, 1)
    x *= (fade * end)[:, None]
    return (x / max(1e-6, np.abs(x).max()) * 0.9).astype(np.float32)


def duck(music, active, rate, depth=0.62):
    """Lower the music under narration. active: 0/1 per sample (mono)."""
    k = int(0.3 * rate)
    env = np.convolve(active.astype(np.float32), np.ones(k) / k, mode='same')
    return music * (1 - depth * np.clip(env, 0, 1))[:, None]
