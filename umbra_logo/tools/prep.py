"""Build the stroke-order 'time map' for the handwritten logo.
Renders the word, skeletonizes it, measures geodesic distance along the skeleton from the
start of each stroke, and gives every ink pixel the time of its nearest skeleton pixel.
Output: data/timemap.png (16-bit time in R/G, alpha = ink), data/path.json (pen-tip points)."""
import json, sys, numpy as np
from collections import deque
from PIL import Image, ImageDraw, ImageFont
from skimage.morphology import skeletonize
from scipy import ndimage

word, font, size = sys.argv[1], sys.argv[2], int(sys.argv[3])
F = ImageFont.truetype(font, size)
l, t, r, b = F.getbbox(word); pad = 30
W, H = r - l + pad * 2, b - t + pad * 2
img = Image.new('L', (W, H), 0); ImageDraw.Draw(img).text((pad - l, pad - t), word, font=F, fill=255)
ink = np.array(img) > 110
sk = skeletonize(ink)
lab, n = ndimage.label(sk, structure=np.ones((3, 3)))
comps = sorted(range(1, n + 1), key=lambda c: np.argwhere(lab == c)[:, 1].min())
T = np.full(sk.shape, -1.0); offset = 0.0
N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
for c in comps:
    pts = np.argwhere(lab == c)
    if len(pts) < 8: continue
    S = set(map(tuple, pts))
    deg = {p: sum((p[0] + dy, p[1] + dx) in S for dy, dx in N8) for p in S}
    ends = [p for p in S if deg[p] == 1] or list(S)
    start = min(ends, key=lambda p: (p[1] - 0.6 * (H - p[0])))     # left-most (and higher) end starts the stroke
    dist = {start: 0.0}; q = deque([start])
    while q:                                                          # BFS geodesic distance (8-connected)
        p = q.popleft()
        for dy, dx in N8:
            nb = (p[0] + dy, p[1] + dx)
            if nb in S and nb not in dist: dist[nb] = dist[p] + (1.414 if dy and dx else 1.0); q.append(nb)
    L = max(dist.values())
    for p, d in dist.items(): T[p] = offset + d
    offset += L + 40                                                  # small pen-lift pause between strokes
tot = T.max()
T[T >= 0] /= tot
# every ink pixel takes the time of its nearest skeleton pixel
idx = ndimage.distance_transform_edt(T < 0, return_distances=False, return_indices=True)
TM = T[idx[0], idx[1]]; TM[~ink] = 0
v = np.clip(TM * 65535, 0, 65535).astype(np.uint32)
alpha = (np.array(img).astype(np.float32))
rgba = np.zeros((H, W, 4), np.uint8); rgba[..., 0] = v >> 8; rgba[..., 1] = v & 255; rgba[..., 3] = alpha.astype(np.uint8)
Image.fromarray(rgba, 'RGBA').save('data/timemap.png')
sp = np.argwhere(T >= 0); order = np.argsort(T[sp[:, 0], sp[:, 1]])
path = [[round(float(T[y, x]), 4), int(x), int(y)] for y, x in sp[order][::3]]
json.dump({'w': W, 'h': H, 'path': path}, open('data/path.json', 'w'))
print('size', W, H, 'strokes', len(comps), 'path pts', len(path))
# preview: colour by time
prev = np.zeros((H, W, 3), np.uint8); m = ink
prev[m, 0] = (255 * TM[m]).astype(np.uint8); prev[m, 2] = (255 * (1 - TM[m])).astype(np.uint8); prev[m, 1] = 60
prev[sk] = [255, 255, 255]
Image.fromarray(prev).save(sys.argv[4] if len(sys.argv) > 4 else 'data/timemap_preview.png')
