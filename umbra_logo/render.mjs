// Render the Umbra01 logo animation with headless Chromium + ffmpeg.
//   node render.mjs --stills 0.6,1.2,2.05 --v intro --out dir/
//   node render.mjs --video out.mp4 --v intro|outro [--audio sfx.wav] [--fps 60]
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = {}; process.argv.slice(2).forEach((v, i, a) => { if (v.startsWith('--')) args[v.slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true; });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]); const p = path.join(ROOT, rel === '/' ? 'index.html' : rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const URL = `http://127.0.0.1:${server.address().port}/index.html?v=${args.v || 'intro'}`;
const browser = await chromium.launch();
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(URL); await page.evaluate(() => window.ready); return page;
}
const grab = (page, t, q = 0.94) => page.evaluate(([t, q]) => { window.renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', q).split(',')[1]; }, [t, q]);

if (args.stills) {
  const out = args.out || path.join(ROOT, 'stills'); fs.mkdirSync(out, { recursive: true });
  const page = await newPage();
  for (const s of String(args.stills).split(',')) { const t = parseFloat(s), t0 = Date.now(); fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(5, '0')}.jpg`), Buffer.from(await grab(page, t, 0.9), 'base64')); console.log(`t=${t} ${Date.now() - t0}ms`); }
} else {
  const page0 = await newPage(); const dur = await page0.evaluate(() => window.DURATION); await page0.close();
  const fps = parseInt(args.fps || 60), total = Math.round(dur * fps), workers = parseInt(args.workers || 4);
  const out = path.resolve(args.video), tmp = out + '.parts'; fs.mkdirSync(tmp, { recursive: true });
  const per = Math.ceil(total / workers);
  const segs = await Promise.all([...Array(workers).keys()].map(async w => {
    const a = w * per, b = Math.min(total, a + per), seg = path.join(tmp, `seg${w}.mp4`); if (a >= b) return null;
    const page = await newPage();
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) { const buf = Buffer.from(await grab(page, f / fps), 'base64'); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); return seg;
  }));
  const list = path.join(tmp, 'list.txt'); fs.writeFileSync(list, segs.filter(Boolean).map(s => `file '${s}'`).join('\n'));
  const mux = ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
  if (args.audio) mux.push('-i', path.resolve(args.audio), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
  mux.push('-c:v', 'copy', '-movflags', '+faststart', out);
  await new Promise((res, rej) => spawn('ffmpeg', mux, { stdio: 'inherit' }).on('close', c => c ? rej(new Error('mux failed')) : res()));
  fs.rmSync(tmp, { recursive: true, force: true }); console.log('wrote', out);
}
await browser.close(); server.close();
