"""Synthesize the logo sound design (48 kHz stereo WAV), synced to the timeline in logo.js.
usage: python3 sfx.py intro|outro out.wav"""
import sys, wave, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
SR = 48000
V = sys.argv[1]; DUR = 4.2 if V == 'intro' else 6.0
N = int(SR * DUR); t = np.arange(N) / SR
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
def env(a, b, att=0.01, rel=0.1):
    e = np.clip((t - a) / att, 0, 1) * np.clip((b - t) / rel, 0, 1); e[(t < a) | (t > b)] = 0; return e
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f): return sosfilt(butter(2, f, 'lowpass', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'highpass', fs=SR, output='sos'), x)
def add(x, pan=0.0, g=1.0):
    global L, R; L += x * g * (1 - max(0, pan)); R += x * g * (1 + min(0, pan))
noise = rng.standard_normal(N)
# dark pad: minor chord, slow swell (C#m-ish) with detuned saws, low-passed
pad = np.zeros(N)
for f in [69.3, 103.8, 138.6, 164.8, 207.7]:
    for d in [-0.4, 0.4]:
        ph = 2 * np.pi * (f + d) * t; pad += (2 * ((ph / (2 * np.pi)) % 1) - 1) * 0.05
pad = lp(pad, 900) * np.clip(t / 1.2, 0, 1) * np.clip((DUR - t) / (0.6 if V == 'intro' else 1.2), 0, 1)
if V == 'intro': pad *= np.where(t > 3.62, np.clip(1 - (t - 3.62) / 0.5, 0, 1), 1)
add(pad, 0, 0.9)
# riser into the stroke + swash whoosh
rise = bp(noise, 400, 5000) * np.clip(t / 0.5, 0, 1) ** 2 * env(0, 0.6, 0.01, 0.12) * 0.25
add(rise, -0.2)
sw = noise.copy(); sw = bp(sw, 300, 3000) * env(0.2, 0.75, 0.05, 0.3) * 0.35
add(sw, 0.3)
# brush strokes while writing: band noise modulated by stroke rhythm, panned left→right
w0, w1 = 0.48, 1.86
k = np.clip((t - w0) / (w1 - w0), 0, 1)
mod = (0.55 + 0.45 * np.abs(np.sin(2 * np.pi * 3.2 * (t - w0)))) * env(w0, w1 + 0.05, 0.03, 0.12)
brush = bp(noise, 1500, 7000) * mod * 0.22 + bp(noise, 250, 900) * mod * 0.12
L += brush * (1 - 0.6 * k); R += brush * (0.4 + 0.6 * k)   # pans left -> right with the pen
# sparkle ticks on the pen tip
for i in range(26):
    tt = w0 + (w1 - w0) * i / 26 + rng.random() * 0.03; f = 2500 + rng.random() * 3000
    e = np.exp(-np.clip(t - tt, 0, None) * 60) * (t >= tt)
    add(np.sin(2 * np.pi * f * t) * e * 0.05, pan=-0.8 + 1.6 * i / 26)
# pre-impact reverse whoosh + impact (sub drop, transient, noise burst) + reverb tail
imp = 2.0
# glitch decode of "01" (1.62–2.0): bit-crushed crackle + random digital blips, one per scramble step
g0 = 1.62; gk = np.clip((t - g0) / (imp - g0), 0, 1) * (t >= g0) * (t < imp)
step = np.floor(t * 30); gate = (np.sin(step * 12.9898) * 43758.5453 % 1) < 0.35 + 0.6 * gk
crackle = np.round(hp(noise, 1500) * 3) / 3 * gate * gk * 0.28
blip_f = 600 + 2400 * (np.sin(np.floor(t * 24) * 78.233) * 43758.5453 % 1)
blips = np.sign(np.sin(2 * np.pi * np.cumsum(blip_f) / SR)) * gate * gk * 0.06
add(lp(crackle + blips, 9000), 0.35)
# tiny glitch ticks after the hit (every 0.8 s, matches the visual micro-glitch)
for tk in np.arange(0.8, DUR, 0.8):
    if tk - imp > 0.6:
        e = ((t >= tk) & (t < tk + 0.07)).astype(float)
        add(np.round(hp(noise, 2500) * 2) / 2 * e * 0.07, 0.3)
ti = np.clip(t - imp, 0, None); on = (t >= imp)
sub = np.sin(2 * np.pi * np.cumsum(np.where(on, 38 + 52 * np.exp(-ti * 9), 0)) / SR) * np.exp(-ti * 2.6) * on * 0.9
click = hp(noise, 2000) * np.exp(-ti * 70) * on * 0.6
burst = bp(noise, 150, 4000) * np.exp(-ti * 9) * on * 0.45
hit = sub + click + burst
ir = rng.standard_normal(int(SR * 1.6)) * np.exp(-np.arange(int(SR * 1.6)) / SR * 3.2); ir = lp(ir, 5000) * 0.03
tail = fftconvolve(hit, ir)[:N]
add(hit, 0); L += tail; R += np.roll(tail, 500)
# shimmer on the light sweep
for f, d in [(1318.5, 0), (1975.5, 0.04), (2637, 0.08), (3951, 0.12)]:
    ts = 2.38 + d; e = np.exp(-np.clip(t - ts, 0, None) * 3.5) * (t >= ts)
    add(np.sin(2 * np.pi * f * t) * e * 0.06, pan=(d - 0.06) * 8)
# neon flicker buzz
fl = 3.16; buzz = np.sign(np.sin(2 * np.pi * 120 * t)) * (env(fl, fl + 0.05, 0.002, 0.01) + env(fl + 0.1, fl + 0.13, 0.002, 0.01)) * 0.12
add(lp(buzz, 3000), 0.1)
if V == 'intro':  # glitch-out: chopped, bit-crushed noise + tape stop
    g0, g1 = 3.62, 4.12
    chop = (np.floor(t * 40) % 2) * env(g0, g1, 0.01, 0.05)
    crushed = np.round(bp(noise, 300, 6000) * 4) / 4
    add(crushed * chop * 0.25, 0)
    stop = np.sin(2 * np.pi * np.cumsum(np.where(t > 3.85, 220 * np.clip(1 - (t - 3.85) / 0.27, 0, 1), 0)) / SR) * env(3.85, 4.12, 0.01, 0.05) * 0.3
    add(stop, 0)
else:  # outro: soft final chime and fade
    for f, d in [(659.3, 0), (987.8, 0.06), (1318.5, 0.12)]:
        ts = 4.6 + d; e = np.exp(-np.clip(t - ts, 0, None) * 1.6) * (t >= ts)
        add(np.sin(2 * np.pi * f * t) * e * 0.07, 0)
fade_in = np.clip(t / 0.05, 0, 1); L *= fade_in; R *= fade_in
mix = np.stack([L, R], 1); mix = np.tanh(mix * 1.3) / np.tanh(1.3)   # gentle saturation / glue
mix *= 0.89 / np.abs(mix).max()
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[2], DUR, 's')
