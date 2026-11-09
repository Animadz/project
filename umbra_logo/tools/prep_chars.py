"""Prepare character cut-outs (from rembg/isnet-anime) for the collage:
crop to the alpha bbox, remove stray props, soften the hard bottom edge."""
import sys, os, json, numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
ERASE = {'c1': [(1035, 0, 1320, 400)]}          # (x0,y0,x1,y1) regions to clear: the street pole in shot 1
meta = {}
for i in range(1, 8):
    n = f'c{i}'; im = np.array(Image.open(os.path.join(src, n + '.png')).convert('RGBA')).astype(np.float32)
    for x0, y0, x1, y1 in ERASE.get(n, []): im[y0:y1, x0:x1, 3] = 0
    a = im[..., 3]; ys, xs = np.where(a > 20)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    im = im[y0:y1, x0:x1]; h = im.shape[0]
    fade = np.clip((h - np.arange(h)) / (h * 0.16), 0, 1) ** 1.5   # bottom 16% fades out
    im[..., 3] *= fade[:, None]
    Image.fromarray(im.clip(0, 255).astype(np.uint8)).save(os.path.join(dst, n + '.png'))
    meta[n] = {'w': int(im.shape[1]), 'h': int(h)}; print(n, meta[n])
json.dump(meta, open(os.path.join(dst, 'chars.json'), 'w'))
