// Render the animatic (frames at 24 fps) with headless Chromium + ffmpeg.
//   node render.mjs --stills 0,20,120 --mode annotated --out dir/
//   node render.mjs --video out.mp4 --mode annotated|clean [--workers 4]
//   node render.mjs --shotlist out.md
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = {}; process.argv.slice(2).forEach((v, i, a) => { if (v.startsWith('--')) args[v.slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true; });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]); const p = path.join(ROOT, rel === '/' ? 'index.html' : rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const URL = `http://127.0.0.1:${server.address().port}/index.html?mode=${args.mode || 'annotated'}`;
const browser = await chromium.launch();
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto(URL); await page.evaluate(() => window.ready); return page;
}
const grab = (page, f, q = 0.93) => page.evaluate(([f, q]) => { window.renderFrame(f); return document.getElementById('c').toDataURL('image/jpeg', q).split(',')[1]; }, [f, q]);

if (args.shotlist) {
  const page = await newPage(); fs.writeFileSync(args.shotlist, await page.evaluate(() => window.shotListMarkdown()));
} else if (args.stills) {
  const out = args.out || path.join(ROOT, 'stills'); fs.mkdirSync(out, { recursive: true });
  const page = await newPage();
  const frames = String(args.stills).split(',').flatMap(s => { const [a, b, st] = s.split(':').map(Number); return b === undefined ? [a] : Array.from({ length: Math.floor((b - a) / (st || 1)) + 1 }, (_, i) => a + i * (st || 1)); });
  for (const f of frames) fs.writeFileSync(path.join(out, `f${String(f).padStart(3, '0')}.jpg`), Buffer.from(await grab(page, f, 0.88), 'base64'));
  console.log(`${frames.length} stills -> ${out}`);
} else {
  const total = await (await newPage()).evaluate(() => window.TOTAL);
  const workers = parseInt(args.workers ?? 4), out = path.resolve(args.video), tmp = out + '.parts'; fs.mkdirSync(tmp, { recursive: true });
  const per = Math.ceil(total / workers);
  const segs = await Promise.all([...Array(workers).keys()].map(async w => {
    const a = w * per, b = Math.min(total, a + per), seg = path.join(tmp, `seg${w}.mp4`); if (a >= b) return null;
    const page = await newPage();
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '24', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '24', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) { const buf = Buffer.from(await grab(page, f), 'base64'); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r)); return seg;
  }));
  const list = path.join(tmp, 'list.txt'); fs.writeFileSync(list, segs.filter(Boolean).map(s => `file '${s}'`).join('\n'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', c => c ? rej(new Error('concat failed')) : res()));
  fs.rmSync(tmp, { recursive: true, force: true }); console.log('wrote', out);
}
await browser.close(); server.close();
