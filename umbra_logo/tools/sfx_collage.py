"""Sound for the character-collage version: slam hits for every character,
then the regular logo sound shifted to start at OFF - LSTART.
usage: python3 sfx_collage.py intro|outro logo_sfx.wav out.wav"""
import sys, wave, numpy as np
from scipy.signal import butter, sosfilt
SR = 48000; OFF, LSTART = 2.3, 0.2
SLAMS = [0.15, 0.37, 0.59, 0.81, 1.03, 1.25, 1.47]; ENTER = 0.16
with wave.open(sys.argv[2]) as w: logo = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, 2) / 32768
shift = int((OFF - LSTART) * SR); N = shift + len(logo); t = np.arange(N) / SR
out = np.zeros((N, 2)); out[shift:] += logo
rng = np.random.default_rng(3); noise = rng.standard_normal(N)
f = lambda x, lo, hi: sosfilt(butter(2, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
hp = lambda x, c: sosfilt(butter(2, c, 'highpass', fs=SR, output='sos'), x)
for i, s in enumerate(SLAMS):
    hit, hero = s + ENTER, i == len(SLAMS) - 1
    w0 = np.clip((t - s) / ENTER, 0, 1) ** 2 * (t >= s) * (t < hit)                       # whoosh in
    whoosh = f(noise, 600, 6000) * w0 * 0.35
    a = np.clip(t - hit, 0, None); on = t >= hit
    thump = np.sin(2 * np.pi * np.cumsum(np.where(on, 45 + 90 * np.exp(-a * 25), 0)) / SR) * np.exp(-a * (5 if hero else 11)) * on * (1.0 if hero else 0.7)
    snap = hp(noise, 2500) * np.exp(-a * 60) * on * 0.5
    crush = np.round(f(noise, 400, 5000) * 3) / 3 * ((t >= hit) & (t < hit + 0.06)) * 0.18
    pan = -0.7 + 1.4 * (i % 2)
    mono = whoosh + thump + snap + crush
    out[:, 0] += mono * (1 - max(0, pan) * 0.6); out[:, 1] += mono * (1 + min(0, pan) * 0.6)
# low riser through the collage, ducking into the logo
rise = f(noise, 80, 400) * np.clip(t / 2.0, 0, 1) ** 2 * (t < OFF) * 0.18
out += rise[:, None]
out = np.tanh(out * 1.2) / np.tanh(1.2); out *= 0.89 / np.abs(out).max()
with wave.open(sys.argv[3], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype('<i2').tobytes())
print('wrote', sys.argv[3], round(N / SR, 2), 's')
