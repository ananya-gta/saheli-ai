"""Original background score for the Saheli walkthrough, synthesised from scratch (no samples, no copyright).
Warm Indian-pop feel: tanpura-like drone, soft chord pad, santoor-like plucked melody in the Bhupali (major
pentatonic) scale, a light frame-drum pulse, gentle reverb. 80 bpm, key of D."""
import sys, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 75.0
OUT = sys.argv[2] if len(sys.argv) > 2 else "/home/claude/video/music.wav"
rng = np.random.default_rng(7)
N = int(DUR * SR)
t = np.arange(N) / SR
BPM = 80; BEAT = 60 / BPM; BAR = 4 * BEAT
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def lowpass(x, f, order=2): return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)
def highpass(x, f, order=2): return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)

L = np.zeros(N); R = np.zeros(N)
def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * gain
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)); R[i:j] += s * np.sqrt(0.5 * (1 + pan))

# ---------------- tanpura-like drone (D2 / A2 with buzzing harmonics, slow shimmer)
for m, pan in ((38, -0.3), (45, 0.3), (50, -0.1)):
    f = hz(m); d = np.zeros(N)
    for k in range(1, 9):
        d += np.sin(2 * np.pi * f * k * t + rng.uniform(0, 6.28)) / k ** 1.25 * (1 + 0.35 * np.sin(2 * np.pi * (0.07 + 0.03 * k) * t))
    d = highpass(lowpass(d, 1800), 90)
    add(d, 0, pan, 0.012)

# ---------------- chord pad: D – Bm – G – A, one chord per bar
CHORDS = [[50, 54, 57, 62], [47, 50, 54, 59], [43, 47, 50, 55], [45, 49, 52, 57]]
nbars = int(DUR / BAR) + 2
for b in range(nbars):
    ch = CHORDS[b % 4]; start = b * BAR; length = BAR + 1.2
    n = int(length * SR); tt = np.arange(n) / SR
    env = np.minimum(1, tt / 0.9) * np.minimum(1, (length - tt) / 1.2)
    sig = np.zeros(n)
    for m in ch:
        for det in (-0.06, 0.0, 0.06):                       # gentle chorus
            f = hz(m) * 2 ** (det / 12)
            for k in range(1, 5):
                sig += np.sin(2 * np.pi * f * k * tt + rng.uniform(0, 6.28)) / k ** 1.6
    sig = lowpass(sig * env, 1400) / 12
    add(highpass(sig, 110), start, 0.0, 0.16)

# ---------------- santoor-like plucked melody (Karplus–Strong), Bhupali scale: D E F# A B
def pluck(f, dur=1.6, bright=0.5):
    n = int(dur * SR); p = max(2, int(SR / f))
    buf = rng.uniform(-1, 1, p) * (0.6 + 0.4 * bright); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.996 * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    attack = np.minimum(1, np.arange(n) / (0.002 * SR))
    return highpass(out * attack, 120)
SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81]                 # D4 .. A5, pentatonic
TONES = {0: [62, 66, 69, 74, 78, 81], 1: [62, 66, 71, 74, 78], 2: [62, 71, 74, 78], 3: [64, 69, 76, 81]}
cache = {}
step = BEAT / 2                                               # eighth notes
pattern = [1, 0, 1, 1, 0, 1, 0, 1]                            # syncopated, unhurried
prev = 69
for b in range(nbars):
    if b * BAR > DUR - 2: break
    if b < 1: continue                                        # melody enters after the first bar
    chord_tones = TONES[b % 4]
    for k, on in enumerate(pattern):
        if not on or (b % 8 == 7 and k > 4): continue          # breathe at phrase ends
        cands = [m for m in SCALE if abs(m - prev) <= 7] or SCALE
        weights = np.array([3.0 if m in chord_tones else 1.0 for m in cands]) / np.array([1 + abs(m - prev) / 3 for m in cands])
        m = rng.choice(cands, p=weights / weights.sum()); prev = m
        if m not in cache: cache[m] = pluck(hz(m), 1.8, 0.55)
        vel = 0.75 + 0.25 * (k == 0) + rng.uniform(-0.08, 0.08)
        add(cache[m], b * BAR + k * step + rng.uniform(-0.006, 0.006), rng.uniform(-0.35, 0.35), 0.42 * vel)

# ---------------- light frame-drum pulse (soft low thump on 1, brush on 2 & 4) from bar 2
def thump():
    n = int(0.35 * SR); tt = np.arange(n) / SR
    return np.sin(2 * np.pi * (95 * np.exp(-tt * 9) + 55) * tt) * np.exp(-tt * 11)
def brush():
    n = int(0.18 * SR); tt = np.arange(n) / SR
    return highpass(rng.uniform(-1, 1, n), 3500) * np.exp(-tt * 28)
TH, BR = thump(), brush()
for b in range(2, nbars):
    s0 = b * BAR
    if s0 > DUR - 3: break
    add(TH, s0, 0, 0.07); add(TH * 0.6, s0 + 2.5 * BEAT, 0, 0.05)
    add(BR, s0 + BEAT, 0.25, 0.035); add(BR, s0 + 3 * BEAT, -0.25, 0.035)

# ---------------- reverb, fades, master
ir_n = int(1.9 * SR); ir_t = np.arange(ir_n) / SR
def ir(): return rng.uniform(-1, 1, ir_n) * np.exp(-ir_t * 3.2)
wetL = fftconvolve(L, ir())[:N] * 0.018; wetR = fftconvolve(R, ir())[:N] * 0.018
L, R = highpass(L + wetL, 45), highpass(R + wetR, 45)
fade = np.minimum(1, t / 2.0) * np.minimum(1, (DUR - t) / 3.5)
mix = np.stack([L * fade, R * fade], 1)
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.1) * 0.62             # gentle glue + headroom
wavfile.write(OUT, SR, (mix * 32767).astype(np.int16))
print("music:", OUT, round(DUR, 1), "s")
