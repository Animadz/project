// Render the clip: headless Chromium draws each frame (scene.js), ffmpeg encodes.
// Usage:
//   node render.mjs --stills 8.5,30,60 --out stills/          # PNG/JPEG stills for review
//   node render.mjs --audio track.m4a --out clip.mp4 [--workers 4] [--from 0 --to 213.04] [--crf 20]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]) : a), []));
const FPS = 30;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const URL = `http://127.0.0.1:${server.address().port}/index.html`;
const browser = await chromium.launch({ args: ['--disable-web-security', '--force-color-profile=srgb'] });

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(URL);
  await page.evaluate(() => window.ready);
  return page;
}
const grab = (page, t, q = 0.93) => page.evaluate(([t, q]) => { window.renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', q).split(',')[1]; }, [t, q]);

if (args.stills) {
  const out = args.out || path.join(ROOT, 'stills'); fs.mkdirSync(out, { recursive: true });
  const page = await newPage();
  for (const s of String(args.stills).split(',')) {
    const t = parseFloat(s), t0 = Date.now();
    const b64 = await grab(page, t, 0.85);
    fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(7, '0')}.jpg`), Buffer.from(b64, 'base64'));
    console.log(`still ${t}s  ${Date.now() - t0}ms`);
  }
} else {
  const duration = await (await newPage()).evaluate(() => window.DURATION);
  const from = parseFloat(args.from ?? 0), to = parseFloat(args.to ?? duration);
  const workers = parseInt(args.workers ?? 4), crf = String(args.crf ?? 20);
  const out = path.resolve(args.out || 'clip.mp4'), tmp = out + '.parts'; fs.mkdirSync(tmp, { recursive: true });
  const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS), per = Math.ceil((f1 - f0) / workers);
  let done = 0; const tStart = Date.now();
  const segs = await Promise.all([...Array(workers).keys()].map(async w => {
    const a = f0 + w * per, b = Math.min(f1, a + per), seg = path.join(tmp, `seg${w}.mp4`);
    if (a >= b) return null;
    const page = await newPage();
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const buf = Buffer.from(await grab(page, f / FPS), 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 150 === 0) { const el = (Date.now() - tStart) / 1000; console.log(`${done}/${f1 - f0} frames  ${el.toFixed(0)}s  eta ${((f1 - f0 - done) * el / done).toFixed(0)}s`); }
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    return seg;
  }));
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.filter(Boolean).map(s => `file '${s}'`).join('\n'));
  const mux = ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (args.audio) mux.push('-ss', String(from), '-t', String(to - from), '-i', path.resolve(args.audio), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k');
  mux.push('-c:v', 'copy', '-movflags', '+faststart', '-shortest', out);
  await new Promise((res, rej) => spawn('ffmpeg', mux, { stdio: 'inherit' }).on('close', c => c ? rej(new Error('mux failed')) : res()));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${out} in ${((Date.now() - tStart) / 1000).toFixed(0)}s`);
}
await browser.close(); server.close();
