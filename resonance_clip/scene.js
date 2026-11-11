/* «Резонанс последствий» — procedural cyberpunk lyric video.
 * Every frame is a pure function of time: window.renderFrame(t).
 * ?ar=16x9 (1920x1080, default) | ?ar=9x16 (1080x1920, TikTok/Shorts). */
(() => {
const Q = new URLSearchParams(location.search), PORT = Q.get('ar') === '9x16';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = PORT ? 1080 : 1920, H = PORT ? 1920 : 1080; cv.width = W; cv.height = H;
const S = Math.min(W, H) / 1080, FPS = 30;
const D = window.AUDIO, LY = window.LYRICS;

// ───────── helpers ─────────
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const eOut = k => 1 - Math.pow(1 - clamp(k), 3), eIn = k => Math.pow(clamp(k), 3);
const win = (t, a, b, fi = 0.2, fo = 0.2) => ss(a, a + fi, t) * (1 - ss(b - fo, b, t));
const PI = Math.PI, TAU = 2 * PI;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
function rnd(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function A(k, t) { const a = D[k]; return a[clamp(Math.floor(t * FPS), 0, a.length - 1)] || 0; }
function As(k, t, w = 3) { let s = 0; for (let i = -w; i <= w; i++) s += A(k, t + i / FPS); return s / (2 * w + 1); }
function lastIdx(arr, t) { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
const pulse = (arr, t, d) => { const i = lastIdx(arr, t); return i < 0 ? 0 : Math.exp(-(t - arr[i]) * d); };
const BEATS = D.beats, KICKS = D.strong;
const beat = (t, d = 8) => pulse(BEATS, t, d), kick = (t, d = 10) => pulse(KICKS, t, d);
const RED = '255,36,64', CYAN = '24,240,255', WHITE = '255,255,255', MAG = '255,40,200';
const GLY = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ0123456789#$%&@*<>/\\|=+?!';

// ───────── textures ─────────
function glowSprite(c, size = 128) {
  const k = mk(size, size), x = k.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(0.25, `rgba(${c},0.4)`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(0, 0, size, size); return k;
}
const SPR = { red: glowSprite(RED), cyan: glowSprite(CYAN), white: glowSprite(WHITE), mag: glowSprite(MAG), orange: glowSprite('255,140,60') };
function spr(s, x, y, r, a) { if (a <= 0.003 || r < 0.5) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1; }
const GRAIN = [0, 1, 2, 3].map(k => { const c = mk(256, 256), x = c.getContext('2d'), d = x.createImageData(256, 256), R = rnd(50 + k); for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return ctx.createPattern(c, 'repeat'); });
const SCAN = (() => { const c = mk(4, 4), x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, 0, 4, 1.4); return ctx.createPattern(c, 'repeat'); })();
const VIGN = (() => { const c = mk(W, H), x = c.getContext('2d'), g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); x.fillStyle = g; x.fillRect(0, 0, W, H); return c; })();
const BUF = mk(W, H), BX = BUF.getContext('2d'), BUF2 = mk(W, H), BX2 = BUF2.getContext('2d'), SMALL = mk(Math.ceil(W / 16), Math.ceil(H / 16)), SX = SMALL.getContext('2d');

function bg(c1, c2, c3) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); g.addColorStop(0.6, c2); g.addColorStop(1, c3 || c2); ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3); }
function radial(x, y, r, inner, mode = 'lighter') { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, inner); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalCompositeOperation = mode; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.globalCompositeOperation = 'source-over'; }
function particles(t, o = {}) {
  const { n = 80, seed = 1, speed = 60, life = 6, size = 2.5, col = RED, spr: sp = SPR.red, x0 = 0, x1 = W, up = 1, alpha = 1 } = o;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const L = life * (0.5 + hash(seed + i * 1.3)), tt = t + hash(seed * 3 + i) * L, cy = Math.floor(tt / L), age = tt - cy * L;
    const x = x0 + (x1 - x0) * hash(i * 7 + cy * 3 + seed) + Math.sin(age + i) * 20 * S, y = (up > 0 ? H + 20 : -20) - up * age * speed * S * (0.5 + hash(i * 5 + seed));
    const a = Math.sin(PI * age / L) * alpha; spr(sp, x, y, size * 5 * S, a * 0.5); ctx.globalAlpha = clamp(a); ctx.fillStyle = `rgb(${col})`; ctx.fillRect(x - size * S / 2, y - size * S / 2, size * S, size * S);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function cracks(cx, cy, seed, prog, n = 10, col = `rgba(${RED},0.9)`, len = 900) {
  if (prog <= 0) return; ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.shadowColor = col; ctx.shadowBlur = 20 * S;
  for (let i = 0; i < n; i++) {
    let a = i / n * TAU + hash(seed + i) * 0.6, x = cx, y = cy; const L = (0.4 + hash(seed + i * 3) * 0.6) * len * S * eOut(prog);
    ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.moveTo(x, y);
    for (let d = 0; d < L; d += 40 * S) { a += (hash(seed + i * 11 + d) - 0.5) * 0.7; x += Math.cos(a) * 40 * S; y += Math.sin(a) * 40 * S; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
}

// ───────── environments ─────────
const CITY = [0, 1, 2].map(L => { const R = rnd(10 + L), a = []; let x = -200; while (x < W + 2400) { const w = (50 + R() * 140) * S * (1 + L * 0.4), h = (180 + R() * 520) * S * (0.6 + L * 0.3); a.push({ x, w, h, ant: R() < 0.4, broken: R(), sd: R() * 999 }); x += w + R() * 20 * S; } return a; });
function city(t, pan, o = {}) {
  const sky = o.sky || ['#12020a', '#5a0716', '#a3122a'];
  bg(...sky);
  if (o.sun) { const sy = lerp(H * 0.95, H * 0.62, o.sun); radial(W / 2, sy, 1300 * S, `rgba(255,150,90,${0.55 * o.sun})`); spr(SPR.orange, W / 2, sy, 600 * S, o.sun); spr(SPR.white, W / 2, sy, 140 * S, o.sun); }
  const cols = o.cols || ['#2a0610', '#16030a', '#070205'], hs = o.hs || 1;
  for (let L = 0; L < 3; L++) {
    const par = 0.25 + L * 0.35, base = H * (0.95 - (2 - L) * 0.05 * hs);
    ctx.fillStyle = cols[L];
    for (const b of CITY[L]) {
      const x = ((b.x - pan * par) % (W + 2400) + W + 2400) % (W + 2400) - 300; if (x > W + 50 || x + b.w < -50) continue;
      const top = base - b.h * hs;
      ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x, top);
      if (o.ruined && b.broken < 0.7) { for (let k = 1; k <= 5; k++) ctx.lineTo(x + b.w * k / 5, top + (hash(b.sd + k) - 0.3) * 60 * S); }
      else ctx.lineTo(x + b.w, top);
      ctx.lineTo(x + b.w, H); ctx.fill();
      if (b.ant && !o.ruined) ctx.fillRect(x + b.w * 0.5, top - 60 * S, 3 * S, 60 * S);
      if (L > 0 && o.windows !== 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let r = 0; r < b.h / (28 * S) - 1; r++) for (let c = 0; c < b.w / (18 * S) - 1; c++) {
          const h = hash(b.sd + r * 13 + c * 7); if (h < 0.78) continue;
          const fl = hash(b.sd + r + c + Math.floor(t * 3 + h * 9)) > 0.1 ? 1 : 0.2;
          ctx.fillStyle = `rgba(${h > 0.93 ? CYAN : RED},${(0.25 + L * 0.2) * fl * (o.windows ?? 1)})`; ctx.fillRect(x + 6 * S + c * 18 * S, top + 14 * S + r * 28 * S, 8 * S, 12 * S);
        }
        ctx.restore(); ctx.fillStyle = cols[L];
      }
    }
  }
}
function rain(t, a = 0.35, col = '190,200,255') {
  ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = 1.2 * S; ctx.beginPath();
  for (let i = 0; i < 160; i++) { const x = ((hash(i) * W + t * 120 * S) % W), y = ((hash(i * 3) * H + t * 1900 * S * (0.7 + hash(i * 7) * 0.6)) % (H + 100)) - 50; ctx.moveTo(x, y); ctx.lineTo(x - 6 * S, y + 40 * S); }
  ctx.stroke();
}
function eye(x, y, r, t, open, look, inten = 1) {
  ctx.save(); ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter'; spr(SPR.red, 0, 0, r * 2.2, 0.35 * inten); ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = `rgba(${RED},${0.75 * inten})`; ctx.lineWidth = 3 * S;
  for (let k = 0; k < 24; k++) { const a0 = k / 24 * TAU + t * 0.3; ctx.beginPath(); ctx.arc(0, 0, r * 1.35, a0, a0 + TAU / 24 * 0.6); ctx.stroke(); }
  ctx.setLineDash([4 * S, 10 * S]); ctx.beginPath(); ctx.arc(0, 0, r * 1.18, -t * 0.5, -t * 0.5 + TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); ctx.scale(1, Math.max(0.02, open));
  const P = new Path2D(); P.moveTo(-r, 0); P.quadraticCurveTo(0, -r * 0.85, r, 0); P.quadraticCurveTo(0, r * 0.85, -r, 0);
  ctx.fillStyle = '#120205'; ctx.fill(P); ctx.save(); ctx.clip(P);
  const ix = look[0] * r * 0.35, iy = look[1] * r * 0.2, g = ctx.createRadialGradient(ix, iy, 0, ix, iy, r * 0.5);
  g.addColorStop(0, '#ff6a7a'); g.addColorStop(0.5, '#d0102c'); g.addColorStop(1, '#3a0008'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ix, iy, r * 0.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,180,190,0.35)'; ctx.lineWidth = 1.5 * S; for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * r * 0.16, iy + Math.sin(a) * r * 0.16); ctx.lineTo(ix + Math.cos(a) * r * 0.48, iy + Math.sin(a) * r * 0.48); ctx.stroke(); }
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ix, iy, r * 0.07, r * 0.36, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(ix + r * 0.15, iy - r * 0.15, r * 0.05, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = `rgba(${RED},1)`; ctx.lineWidth = 4 * S; ctx.shadowColor = `rgb(${RED})`; ctx.shadowBlur = 25 * S; ctx.stroke(P);
  ctx.restore(); ctx.restore();
}
function cerberus(t, inten = 1, wake = 1) {
  bg('#050003', '#12020a', '#050003');
  hexGrid(t, `rgba(${RED},0.07)`);
  const R = (PORT ? 150 : 170) * S, pos = PORT ? [[W / 2, H * 0.3, 1.25], [W * 0.27, H * 0.5, 1], [W * 0.73, H * 0.5, 1]] : [[W / 2, H * 0.34, 1.2], [W * 0.27, H * 0.52, 1], [W * 0.73, H * 0.52, 1]];
  pos.forEach(([x, y, s], i) => {
    const blink = 1 - Math.pow(Math.max(0, Math.sin(t * 0.7 + i * 2.1)), 60), open = wake * blink * (0.9 + 0.1 * beat(t));
    const look = [noise1(t * 0.5 + i * 7), noise1(t * 0.4 + i * 3)];
    // scanning beam
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const a = PI / 2 + Math.sin(t * 0.8 + i * 2) * 0.7, L = H * 1.2;
    const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L); g.addColorStop(0, `rgba(${RED},${0.25 * wake * inten})`); g.addColorStop(1, `rgba(${RED},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a - 0.12) * L, y + Math.sin(a - 0.12) * L); ctx.lineTo(x + Math.cos(a + 0.12) * L, y + Math.sin(a + 0.12) * L); ctx.fill(); ctx.restore();
    eye(x, y, R * s, t + i, open, look, inten);
  });
}
function hexGrid(t, col) {
  const r = 38 * S, hgt = r * Math.sqrt(3); ctx.strokeStyle = col; ctx.lineWidth = 1.2 * S; ctx.beginPath();
  for (let row = -1; row < H / hgt + 1; row++) for (let c = -1; c < W / (r * 1.5) + 1; c++) {
    const x = c * r * 1.5, y = row * hgt + (c % 2 ? hgt / 2 : 0) + (t * 12 * S) % hgt;
    for (let k = 0; k <= 6; k++) { const a = k / 6 * TAU, px = x + Math.cos(a) * r * 0.92, py = y + Math.sin(a) * r * 0.92; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  }
  ctx.stroke();
}
function core(t, inten = 1, palette = [RED, CYAN]) {
  bg('#030004', '#0a0210', '#030004');
  const cx = W / 2, cy = H / 2, k = kick(t), m = Math.min(W, H);
  radial(cx, cy, m * (0.6 + 0.15 * k) * inten, `rgba(${palette[0]},${0.35 * inten})`);
  ctx.save(); ctx.translate(cx, cy); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) { // rays
    const a = i / 40 * TAU + t * 0.05, l = m * (0.4 + 0.5 * hash(i)) * inten, w = 0.01 + 0.02 * hash(i * 3);
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l); g.addColorStop(0, `rgba(${palette[i % 2]},${0.18 * inten})`); g.addColorStop(1, `rgba(${palette[i % 2]},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - w) * l, Math.sin(a - w) * l); ctx.lineTo(Math.cos(a + w) * l, Math.sin(a + w) * l); ctx.fill();
  }
  for (let r = 0; r < 7; r++) {
    const rad = (90 + r * 62) * S * (1 + 0.06 * k) * (0.8 + 0.2 * inten), segs = 6 + r * 3, rot = t * (0.4 + r * 0.12) * (r % 2 ? -1 : 1);
    ctx.strokeStyle = `rgba(${palette[r % 2]},${(0.85 - r * 0.08) * inten})`; ctx.lineWidth = (r % 3 === 0 ? 7 : 3) * S;
    for (let s = 0; s < segs; s++) { const a0 = rot + s / segs * TAU; ctx.beginPath(); ctx.arc(0, 0, rad, a0, a0 + TAU / segs * (0.55 + 0.3 * hash(r * 9 + s))); ctx.stroke(); }
    if (r % 2 === 0) for (let s = 0; s < 60; s++) { const a = s / 60 * TAU - rot * 0.5; ctx.lineWidth = 1.5 * S; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (rad + 8 * S), Math.sin(a) * (rad + 8 * S)); ctx.lineTo(Math.cos(a) * (rad + (s % 5 ? 14 : 26) * S), Math.sin(a) * (rad + (s % 5 ? 14 : 26) * S)); ctx.stroke(); }
  }
  spr(SPR.white, 0, 0, (60 + 50 * k) * S * inten, 1); spr(SPR[palette[0] === RED ? 'red' : 'cyan'], 0, 0, 300 * S * inten, 0.8);
  for (let i = 0; i < 70; i++) { // particles flung outward
    const L = 1.6, tt = t + hash(i) * L, age = (tt % L) / L, a = hash(i * 3 + Math.floor(tt / L)) * TAU, d = age * m * 0.75;
    spr(i % 3 ? SPR.red : SPR.cyan, Math.cos(a) * d, Math.sin(a) * d, 6 * S, (1 - age) * inten);
  }
  ctx.restore();
}
function tunnel(t, speed, pal = [CYAN, RED], roll = 0) {
  bg('#000', '#03020a', '#000');
  const cx = W / 2 + Math.sin(t * 0.7) * 60 * S, cy = H / 2 + Math.cos(t * 0.5) * 40 * S, N = 18, off = (t * speed) % 1;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(roll + Math.sin(t * 0.3) * 0.1); ctx.globalCompositeOperation = 'lighter';
  for (let k = N; k >= 1; k--) {
    const z = (k - off) * 0.6, s = 1 / z, w = W * 0.7 * s, h = H * 0.7 * s, a = clamp(1 - z / N) * 0.9, col = pal[(k + Math.floor(t * speed)) % 2];
    ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = Math.max(1, 6 * S * s); ctx.strokeRect(-w / 2, -h / 2, w, h);
    if (k % 3 === 0) { ctx.strokeStyle = `rgba(${col},${a * 0.3})`; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 1; i < 6; i++) { ctx.moveTo(-w / 2 + w * i / 6, -h / 2); ctx.lineTo(-w / 2 + w * i / 6, -h / 2 - 2); } ctx.stroke(); }
  }
  ctx.strokeStyle = `rgba(${pal[0]},0.25)`; ctx.lineWidth = 1.5 * S; ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(0, 0); ctx.lineTo(sx * W, sy * H); }
  for (let i = -6; i <= 6; i++) { ctx.moveTo(0, 0); ctx.lineTo(i * W / 6, H); ctx.moveTo(0, 0); ctx.lineTo(i * W / 6, -H); }
  ctx.stroke();
  for (let i = 0; i < 90; i++) { // streaks
    const a = hash(i) * TAU, z = ((hash(i * 3) - t * speed * 0.25) % 1 + 1) % 1, d0 = (1 - z) * Math.max(W, H) * 0.7, d1 = d0 * 1.25;
    ctx.strokeStyle = `rgba(${pal[i % 2]},${(1 - z) * 0.8})`; ctx.lineWidth = 2 * S * (1 - z); ctx.beginPath(); ctx.moveTo(Math.cos(a) * d0, Math.sin(a) * d0); ctx.lineTo(Math.cos(a) * d1, Math.sin(a) * d1); ctx.stroke();
  }
  spr(SPR.white, 0, 0, 90 * S, 0.8); ctx.restore();
}
function glyphRain(t, cols = [RED, CYAN], a = 1) {
  const cw = 26 * S, nc = Math.ceil(W / cw); ctx.font = `700 ${22 * S}px Mono`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let c = 0; c < nc; c++) {
    const sp = (220 + 380 * hash(c * 3.3)) * S, len = 8 + Math.floor(hash(c * 7.7) * 18), head = ((t * sp + hash(c) * H * 2) % (H + len * cw)), col = cols[c % 5 === 0 ? 1 : 0];
    for (let r = 0; r < len; r++) {
      const y = head - r * cw; if (y < -cw || y > H) continue;
      const ch = GLY[Math.floor(hash(c * 13 + Math.floor(y / cw) * 7 + Math.floor(t * 8 + c)) * GLY.length)];
      ctx.fillStyle = r === 0 ? `rgba(255,255,255,${a})` : `rgba(${col},${a * (1 - r / len) * 0.85})`; ctx.fillText(ch, c * cw + cw / 2, y);
    }
  }
}
function hazard(y, h, t, a = 1) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, h); ctx.clip(); ctx.fillStyle = `rgba(20,0,0,${a})`; ctx.fillRect(0, y, W, h);
  ctx.fillStyle = `rgba(${RED},${a})`; const sw = 40 * S, off = (t * 120 * S) % (sw * 2);
  for (let x = -sw * 2 - h; x < W + h; x += sw * 2) { ctx.beginPath(); ctx.moveTo(x + off, y + h); ctx.lineTo(x + off + sw, y + h); ctx.lineTo(x + off + sw + h, y); ctx.lineTo(x + off + h, y); ctx.fill(); }
  ctx.restore();
}

// ───────── text ─────────
const F = { unb: s => `800 ${s}px Unb`, unbL: s => `400 ${s}px UnbL`, gl: s => `${s}px Glitch`, russo: s => `${s}px Russo`, mono: s => `700 ${s}px Mono` };
function fit(str, font, size, maxW, ls = 0) { ctx.font = font(size); ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(str).width; return w > maxW ? size * maxW / w : size; }
function txt(str, x, y, o = {}) {
  ctx.save(); ctx.font = o.font; ctx.letterSpacing = (o.ls || 0) + 'px'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
  ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.sc) ctx.scale(o.sc, o.sc);
  const a = clamp(o.alpha ?? 1);
  if (o.rgb) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.8; ctx.fillStyle = `rgb(${CYAN})`; ctx.fillText(str, -o.rgb, 0); ctx.fillStyle = `rgb(${RED})`; ctx.fillText(str, o.rgb, o.rgb * 0.2); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = a;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = (o.blur || 30) * S; }
  if (o.stroke) { ctx.lineWidth = o.lw || 6 * S; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, 0, 0); }
  ctx.fillStyle = o.fill || '#fff'; ctx.fillText(str, 0, 0); ctx.restore();
}
function scramble(str, revealed, t, seed = 0) { // decoded prefix + random glyph tail
  let out = ''; const step = Math.floor(t * 24);
  for (let i = 0; i < str.length; i++) { const c = str[i]; if (i < revealed || c === ' ') out += c; else if (i < revealed + 4) out += GLY[Math.floor(hash(step * 3.1 + i * 7.3 + seed) * GLY.length)]; else out += ' '; }
  return out;
}

// ───────── lyrics ─────────
const ST = {};
const set = (st, ...ranges) => ranges.forEach(r => { if (Array.isArray(r)) for (let i = r[0]; i <= r[1]; i++) ST[i] = st; else ST[r] = st; });
set('whisper', [1, 5]); set('decode', [7, 10], [99, 106]); set('term', [12, 15]); set('shout', [17, 19], [69, 76], [167, 169]);
set('sys', [21, 23], [152, 156]); set('rap', [26, 41], [78, 97]); set('fast', [43, 50]); set('duo', [52, 58]);
set('chorus', [60, 67], [117, 124], [158, 165]); set('call', [108, 115]); set('brk', [126, 132], 136); set('count', [133, 135]);
set('hymn', [138, 141]); set('quiet', [144, 146], [148, 150]); set('final', 170);
const LINES = LY.map((l, i) => ({ ...l, i })).filter(l => ST[l.i] && !l.t.startsWith('['));
LINES.forEach((L, k) => {
  if (L.e <= L.s) L.e = LINES[k + 1] ? LINES[k + 1].s : L.s + 3;
  const st = ST[L.i], dur = L.e - L.s;
  let words = L.t.split(/\s+/).filter(Boolean);
  if (st === 'shout' || st === 'final') words = L.t.replace(/«|»/g, '').split(/[\s-]+/).filter(Boolean);
  const span = dur > 4 ? Math.min(dur * 0.55, 2.8) : dur * 0.85;
  const wts = words.map(w => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.5), tot = wts.reduce((a, b) => a + b, 0);
  let acc = 0; L.words = words.map((w, j) => { const r = { w, t: L.s + acc / tot * span }; acc += wts[j]; return r; });
});
const isCaps = w => { const c = w.replace(/[^\p{L}]/gu, ''); return c.length >= 2 && c === c.toUpperCase(); };
function curWord(L, t) { let c = null; for (const w of L.words) if (t >= w.t) c = w; return c; }
function revealCount(L, t) { const span = L.words.length ? (L.words[L.words.length - 1].t - L.s) + 0.3 : 0.5; return Math.floor(clamp((t - L.s) / Math.max(0.2, span)) * L.t.length); }

function drawLine(L, t) {
  const st = ST[L.i], lt = t - L.s, out = 1 - ss(L.e - 0.06, L.e + 0.18, t), M = W * 0.88;
  if (out <= 0) return;
  if (st === 'whisper') {
    const n = revealCount(L, t), str = scramble(L.t, n, t, L.i), sz = fit(L.t, F.unbL, 52 * S, M, 12 * S);
    txt(str, W / 2 + noise1(t * 9) * 3 * S, H / 2, { font: F.unbL(sz), ls: 12 * S, fill: '#d8f6ff', glow: `rgba(${CYAN},0.8)`, alpha: out * (0.75 + 0.25 * noise1(t * 20)) });
  } else if (st === 'decode' || st === 'fast') {
    const n = revealCount(L, t), str = scramble(L.t, n, t, L.i), sz = fit(L.t, F.unb, (st === 'fast' ? 60 : 64) * S, M, 2 * S), y = H * (PORT ? 0.72 : 0.76);
    txt(str, W / 2, y, { font: F.unb(sz), ls: 2 * S, fill: '#ffffff', glow: `rgba(${st === 'fast' ? CYAN : RED},0.9)`, alpha: out, rgb: lt < 0.15 ? 8 * S : 0 });
    ctx.fillStyle = `rgba(${st === 'fast' ? CYAN : RED},${0.8 * out})`; ctx.fillRect(W / 2 - M / 2 * clamp(lt / 0.4), y + sz * 0.75, M * clamp(lt / 0.4), 3 * S);
  } else if (st === 'term') {
    const idx = LINES.indexOf(L), prev = LINES.slice(Math.max(0, idx - 3), idx).filter(p => ST[p.i] === 'term' && t - p.e < 6);
    const x = W * (PORT ? 0.07 : 0.1), y0 = H * (PORT ? 0.72 : 0.7), sz = (PORT ? 40 : 46) * S, lh = sz * 1.4;
    panelBox(x - 24 * S, y0 - lh * 3.6, W * (PORT ? 0.86 : 0.62), lh * 4.4, out);
    prev.forEach((p, k) => txt('> ' + p.t, x, y0 - (prev.length - k) * lh, { font: F.mono(fit('> ' + p.t, F.mono, sz, W * (PORT ? 0.82 : 0.58))), align: 'left', fill: 'rgba(125,252,255,0.45)', alpha: out }));
    const n = Math.min(L.t.length, Math.floor(lt * 26)), s = '> ' + L.t.slice(0, n) + (Math.floor(t * 3) % 2 ? '█' : ' ');
    txt(s, x, y0, { font: F.mono(fit('> ' + L.t + '█', F.mono, sz, W * (PORT ? 0.82 : 0.58))), align: 'left', fill: '#7dfcff', glow: `rgba(${CYAN},0.8)`, blur: 14, alpha: out });
  } else if (st === 'shout' || st === 'count' || st === 'brk' || st === 'final') {
    const w = curWord(L, t); if (!w) return; const age = t - w.t, wi = L.words.indexOf(w);
    let str = w.w.replace(/[—]/g, ''), font = st === 'brk' && wi % 2 === 0 && L.i % 2 ? F.gl : F.unb;
    let sz = fit(str, font, (st === 'count' ? 520 : st === 'final' ? 170 : 210) * S, W * 0.9, 4 * S);
    let x = W / 2, y = H / 2;
    if (st === 'brk') { x += (hash(L.i * 3) - 0.5) * W * 0.25; y += (hash(L.i * 7) - 0.5) * H * 0.3; }
    if (st === 'final') { const all = L.words.map(q => q.w).join(' '); sz = fit(all, F.unb, 170 * S, W * 0.9, 4 * S); str = L.words.filter(q => q.t <= t).map(q => q.w).join(' '); }
    const sc = lerp(1.6, 1, eOut(age / 0.12)), col = st === 'count' || L.i % 2 ? '#ff2440' : '#ffffff';
    txt(str, x + noise1(t * 30) * 8 * S * kick(t), y, { font: font(sz), ls: 4 * S, fill: col, sc, rgb: (10 + 20 * Math.exp(-age * 10)) * S, stroke: 'rgba(0,0,0,0.6)', lw: 8 * S, glow: `rgba(${col === '#ffffff' ? CYAN : RED},0.7)`, alpha: out });
  } else if (st === 'sys') {
    sysBox(L, t, out);
  } else if (st === 'rap') {
    const vis = L.words.filter(w => t >= w.t), M2 = W * 0.9, y = H * (PORT ? 0.74 : 0.8); if (!vis.length) return;
    const last = vis[vis.length - 1], la = t - last.t;
    const gsz = fit(last.w, F.unb, 300 * S, W * 0.95); // ghost word behind
    txt(last.w.toUpperCase(), W / 2, H * 0.42, { font: F.unb(gsz), fill: 'rgba(0,0,0,0)', stroke: `rgba(${RED},${0.35 * Math.exp(-la * 2) * out})`, lw: 2 * S, sc: lerp(1.15, 1, eOut(la / 0.2)) });
    ctx.font = F.russo(66 * S); ctx.letterSpacing = '0px';
    const ws = L.words.map(w => ctx.measureText(w.w).width), sp = 18 * S, rows = [[]]; let rw = 0;
    L.words.forEach((w, j) => { if (rw + ws[j] > M2 && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(j); rw += ws[j] + sp; });
    rows.forEach((row, r) => {
      const tw = row.reduce((a, j) => a + ws[j], 0) + sp * (row.length - 1); let x = W / 2 - tw / 2; const yy = y + (r - (rows.length - 1) / 2) * 80 * S;
      for (const j of row) {
        const w = L.words[j], a = t - w.t; if (a >= 0) {
          const em = isCaps(w.w) || /!/.test(w.w), gl = a < 0.07 ? (hash(j + L.i) - 0.5) * 40 * S : 0;
          txt(w.w, x + ws[j] / 2 + gl, yy, { font: F.russo(66 * S), fill: em ? '#ff2440' : '#fff', sc: lerp(1.5, 1, eOut(a / 0.1)), rot: (j % 2 ? 1 : -1) * 0.03 * Math.exp(-a * 8), stroke: '#000', lw: 8 * S, rgb: a < 0.12 ? 6 * S : 0, alpha: out });
        }
        x += ws[j] + sp;
      }
    });
  } else if (st === 'duo') {
    const left = (L.i % 2) === 0, str = L.t.replace('— ', ''), sz = fit(str, F.unb, 110 * S, W * 0.86), k = eOut(lt / 0.12);
    txt(str, left ? lerp(-W * 0.3, W * 0.07, k) : lerp(W * 1.3, W * 0.93, k), H * (left ? 0.42 : 0.58), { font: F.unb(sz), align: left ? 'left' : 'right', fill: left ? '#7dfcff' : '#ff2440', rgb: (1 - k) * 30 * S + 3 * S, glow: `rgba(${left ? CYAN : RED},0.8)`, alpha: out });
  } else if (st === 'chorus') {
    const vis = L.words.filter(w => t >= w.t); if (!vis.length) return;
    const str = L.t, M3 = W * 0.92, y = H * (PORT ? 0.66 : 0.7);
    let sz = PORT ? 104 * S : fit(str, F.unb, 104 * S, M3, 2 * S);
    ctx.font = F.unb(sz); ctx.letterSpacing = 2 * S + 'px';
    let sp = ctx.measureText(' ').width, ws = L.words.map(w => ctx.measureText(w.w).width);
    if (PORT && Math.max(...ws) > M3) { const f = M3 / Math.max(...ws); sz *= f; ws = ws.map(v => v * f); sp *= f; }
    const rows = [[]]; let rw = 0;
    L.words.forEach((w, j) => { if (rw + ws[j] > M3 && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(j); rw += ws[j] + sp; });
    rows.forEach((row, r) => {
      const tw = row.reduce((a, j) => a + ws[j], 0) + sp * (row.length - 1); let x = W / 2 - tw / 2; const yy = y + (r - (rows.length - 1) / 2) * sz * 1.15;
      for (const j of row) { const w = L.words[j], a = t - w.t; if (a >= 0) { const em = isCaps(w.w); txt(w.w, x + ws[j] / 2, yy, { font: F.unb(sz), ls: 2 * S, fill: em ? '#ff2440' : '#fff', sc: lerp(em ? 1.35 : 1.2, 1, eOut(a / 0.1)), rgb: (em ? 10 : 4) * S * Math.exp(-a * 6) + 2 * S, stroke: '#000', lw: 7 * S, glow: em ? `rgba(${RED},0.9)` : null, alpha: out }); } x += ws[j] + sp; }
    });
    const big = [...vis].reverse().find(w => isCaps(w.w)); // giant echo of the shouted word
    if (big) { const a = t - big.t, bs = fit(big.w, F.unb, 260 * S, W * 0.95); txt(big.w.replace(/[!,—]/g, ''), W / 2, H * (PORT ? 0.38 : 0.36), { font: F.unb(bs), fill: `rgba(255,36,64,${0.16 * Math.exp(-a * 1.5) * out})`, sc: lerp(1.3, 1, eOut(a / 0.2)) }); }
  } else if (st === 'call') {
    const ans = isCaps(L.t), str = L.t.replace('— ', '');
    if (ans) { const sz = fit(str, F.unb, 200 * S, W * 0.9); txt(str, W / 2, H / 2, { font: F.unb(sz), fill: '#ff2440', sc: lerp(1.6, 1, eOut(lt / 0.12)), rgb: 14 * S, stroke: '#000', lw: 8 * S, glow: `rgba(${RED},0.8)`, alpha: out }); }
    else txt(scramble(str, Math.floor(lt * 30), t), W / 2, H * 0.3, { font: F.mono(70 * S), fill: '#7dfcff', glow: `rgba(${CYAN},0.8)`, alpha: out });
  } else if (st === 'hymn') {
    const sz = fit(L.t, F.unb, 120 * S, W * 0.8, 10 * S), k = clamp(lt / Math.max(0.3, L.e - L.s));
    txt(L.t, W / 2, H * (PORT ? 0.72 : 0.78), { font: F.unb(sz), ls: 10 * S, fill: '#fff6e8', glow: 'rgba(255,190,120,0.9)', blur: 40, sc: 1 + 0.06 * k, alpha: out * ss(L.s, L.s + 0.3, t) });
  } else if (st === 'quiet') {
    const sz = fit(L.t, F.unbL, 54 * S, M, 4 * S);
    txt(L.t, W / 2, H * 0.62, { font: F.unbL(sz), ls: 4 * S, fill: '#f4ecff', glow: 'rgba(255,200,170,0.5)', blur: 20, alpha: out * ss(L.s, L.s + 0.8, t) });
  }
}
function panelBox(x, y, w, h, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,10,14,0.72)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = `rgba(${CYAN},0.7)`; ctx.lineWidth = 2 * S; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = `rgba(${CYAN},0.9)`; ctx.fillRect(x, y, w * 0.25, 4 * S); ctx.font = F.mono(16 * S); ctx.textBaseline = 'top'; ctx.fillText('CERBERUS://TERMINAL', x + 12 * S, y + 10 * S); ctx.restore();
}
function sysBox(L, t, out) {
  const lt = t - L.s, warn = /WARNING|CRITICAL|COLLAPSE|DENIED/.test(L.t), col = warn || /CERBERUS|TARGETS/.test(L.t) ? RED : CYAN;
  const bw = W * (PORT ? 0.9 : 0.66), sz = fit(L.t, F.mono, (PORT ? 64 : 76) * S, bw * 0.86), bh = sz * 2.6, x = W / 2 - bw / 2, y = H / 2 - bh / 2;
  const open = eOut(lt / 0.15), blink = warn && Math.floor(t * 4) % 2 ? 0.55 : 1;
  ctx.save(); ctx.globalAlpha = out; ctx.translate(W / 2, H / 2); ctx.scale(1, open); ctx.translate(-W / 2, -H / 2);
  ctx.fillStyle = 'rgba(12,0,4,0.85)'; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = `rgba(${col},${blink})`; ctx.lineWidth = 3 * S; ctx.strokeRect(x, y, bw, bh);
  ctx.restore();
  if (open > 0.9) {
    hazardMini(x, y, 22 * S, bh, t, out); hazardMini(x + bw - 22 * S, y, 22 * S, bh, t, out);
    txt(`⚠ ${warn ? 'ALERT' : 'SYSTEM'} // CERBERUS`, x + 40 * S, y + 22 * S, { font: F.mono(18 * S), align: 'left', fill: `rgb(${col})`, alpha: out });
    const n = Math.min(L.t.length, Math.floor(lt * 40));
    txt(L.t.slice(0, n), W / 2, y + bh * 0.58, { font: F.mono(sz), fill: '#fff', glow: `rgba(${col},0.9)`, blur: 20, alpha: out * blink, rgb: 3 * S });
  }
}
function hazardMini(x, y, w, h, t, a) { ctx.save(); ctx.globalAlpha = a; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = `rgb(${RED})`; for (let k = -2; k < h / (14 * S) + 2; k++) { const yy = y + k * 28 * S + (t * 60 * S) % (28 * S); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy - w); ctx.lineTo(x + w, yy - w + 12 * S); ctx.lineTo(x, yy + 12 * S); ctx.fill(); } ctx.restore(); }

// ───────── sections ─────────
const SEC = [
  { s: 0, e: 28.8, name: 'INIT', bg: t => { bg('#000', '#020104', '#000'); hexGrid(t, `rgba(${CYAN},0.04)`); const k = ss(6, 18.3, t); cracks(W / 2, H / 2, 3, k, 12, `rgba(${RED},0.9)`, 700); spr(SPR.red, W / 2, H / 2, 300 * S * k, 0.5 * k); particles(t, { n: 30, seed: 2, speed: 30, alpha: 0.5 }); titleCard(t); }, gl: 0.25, hud: 0.4, en: 0.3 },
  { s: 28.8, e: 35.585, name: 'RUINS', bg: t => { city(t, t * 40 * S, { ruined: true }); rain(t); particles(t, { n: 60, seed: 4, speed: -40, up: -1, col: '255,140,120', spr: SPR.orange, alpha: 0.6 }); }, gl: 0.3, hud: 0.6, en: 0.5 },
  { s: 35.585, e: 44.04, name: 'CERBERUS', bg: t => cerberus(t, 1, ss(35.585, 36.8, t)), gl: 0.4, hud: 1, en: 0.6 },
  { s: 44.04, e: 50.82, name: 'RESONANCE', bg: t => core(t, 0.6 + 0.4 * ss(44, 50.8, t)), gl: 0.7, hud: 1, en: 1 },
  { s: 50.82, e: 64.31, name: 'SYSTEM', bg: t => { cerberus(t, 1 + ss(54, 64, t), 1); if (t > 54.26) { ctx.fillStyle = `rgba(${RED},${0.15 * ss(54.3, 64, t) * (Math.floor(t * 4) % 2)})`; ctx.fillRect(0, 0, W, H); } }, gl: 0.5, hud: 1, en: 0.7 },
  { s: 64.31, e: 91.28, name: 'OVERDRIVE', bg: t => tunnel(t, 2.4 * (143.55 / 120)), gl: 1, hud: 1, en: 1.2 },
  { s: 91.28, e: 111.7, name: 'FREQUENCY', bg: t => { city(t, t * 120 * S, { sky: ['#000206', '#04101c', '#081a2a'], cols: ['#020a12', '#01060c', '#000306'] }); glyphRain(t, [CYAN, RED], 0.55); }, gl: 0.8, hud: 1, en: 1 },
  { s: 111.7, e: 119.76, name: 'OVERLOAD', bg: t => { core(t, 0.5 + 0.7 * ss(111.7, 119.7, t), [CYAN, RED]); }, gl: 0.9, hud: 1, en: 1.2 },
  { s: 119.76, e: 147.13, name: 'OVERDRIVE', bg: t => { core(t, 1.2); if (t > 134) cracks(W / 2, H / 2, 41, (t - 134) / 2, 14); }, gl: 1, hud: 1, en: 1.3 },
  { s: 147.13, e: 175.21, name: 'GLITCH FLOW', bg: t => { tunnel(t, 3.0, [RED, MAG], t * 0.05); if (Math.floor(t * 143.55 / 60) % 8 >= 6) glyphRain(t, [RED, WHITE], 0.4); }, gl: 1.2, hud: 1, en: 1.3 },
  { s: 175.21, e: 201.3, name: 'MUTATION', bg: t => { city(t, t * 30 * S, { sky: ['#0a0010', '#2a0638', '#5a0c3a'], cols: ['#1a0420', '#0e0214', '#05010a'] }); cerberusGhost(t); }, gl: 0.6, hud: 0.8, en: 0.8 },
  { s: 201.3, e: 211.04, name: 'IDENTITY', bg: t => core(t, 0.9, [RED, WHITE]), gl: 1, hud: 1, en: 1.2 },
  { s: 211.04, e: 231.7, name: 'NO CONTROL', bg: t => { if (Math.floor(t * 143.55 / 60 / 4) % 2) tunnel(t, 3.2); else core(t, 1.3); }, gl: 1.2, hud: 1, en: 1.4 },
  { s: 231.7, e: 238.48, name: 'BREAKDOWN', bg: t => { bg('#000', '#050000', '#000'); glyphRain(t, [RED, RED], 0.35); }, gl: 1.5, hud: 1, en: 1.4 },
  { s: 238.48, e: 269.04, name: 'RESURGERE', bg: t => { core(t, 1.1, ['255,170,90', RED]); ringText(t); }, gl: 0.6, hud: 0.7, en: 1.1 },
  { s: 269.04, e: 299.84, name: 'DAWN', bg: t => { const k = ss(282, 296, t); city(t, t * 12 * S, { ruined: true, windows: 0, sky: ['#0a0818', k > 0.5 ? '#4a2a50' : '#1c1030', k > 0.3 ? '#e08a56' : '#3a1a34'], cols: ['#2a1626', '#160a16', '#07030a'], sun: Math.max(k, 0.25), hs: 0.55 }); particles(t, { n: 50, seed: 8, speed: -25, up: -1, col: '220,200,200', spr: SPR.white, alpha: 0.4 }); }, gl: 0.05, hud: 0.15, en: 0.2 },
  { s: 299.84, e: 313, name: 'CRITICAL', bg: t => { core(t, 0.8 + 0.5 * ss(300, 313, t)); cracks(W / 2, H / 2, 77, (t - 300) / 12, 16); hazard(0, 70 * S, t, 1); hazard(H - 70 * S, 70 * S, t, 1); ctx.fillStyle = `rgba(${RED},${0.22 * (Math.floor(t * 2.4) % 2)})`; ctx.fillRect(0, 0, W, H); }, gl: 1.1, hud: 1, en: 1.2 },
  { s: 313, e: 330.24, name: 'COLLAPSE', bg: t => { if (Math.floor(t * 143.55 / 60 / 2) % 2) tunnel(t, 3.4, [RED, WHITE]); else core(t, 1.5); cracks(W / 2, H / 2, 91, 1, 18); }, gl: 1.4, hud: 1, en: 1.5 },
  { s: 330.24, e: 999, name: 'RESONANT', bg: t => { core(t, 1.4 * (1 - ss(345, 348.5, t)) + 0.01); outroCard(t); }, gl: 1.0, hud: 0.8, en: 1.3 },
];
function cerberusGhost(t) { ctx.save(); ctx.globalAlpha = 0.35; ctx.translate(0, -H * 0.05); cerberusEyesOnly(t); ctx.restore(); }
function cerberusEyesOnly(t) { const R = 120 * S; [[W / 2, H * 0.28], [W * 0.3, H * 0.4], [W * 0.7, H * 0.4]].forEach(([x, y], i) => eye(x, y, R, t + i, 0.8, [noise1(t * 0.5 + i), 0], 0.8)); }
function ringText(t) {
  const r = Math.min(W, H) * 0.42, str = ' RESONARE · RESURGERE ·'.repeat(2); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(t * 0.08); ctx.font = F.unb(30 * S); ctx.fillStyle = 'rgba(255,220,180,0.55)'; ctx.textAlign = 'center';
  for (let i = 0; i < str.length; i++) { ctx.save(); ctx.rotate(i / str.length * TAU); ctx.fillText(str[i], 0, -r); ctx.restore(); } ctx.restore();
}
function titleCard(t) {
  const a = win(t, 18.3, 28.6, 0.3, 0.6); if (a <= 0) return;
  const t1 = 'РЕЗОНАНС', t2 = 'ПОСЛЕДСТВИЙ', n = Math.floor((t - 18.3) * 14);
  const s1 = fit(t1, F.unb, 190 * S, W * 0.86, 10 * S), s2 = fit(t2, F.unb, 120 * S, W * 0.86, 14 * S);
  txt(scramble(t1, n, t, 1), W / 2, H * 0.44, { font: F.unb(s1), ls: 10 * S, fill: '#fff', rgb: (4 + 10 * kick(t)) * S, glow: `rgba(${RED},0.9)`, alpha: a });
  txt(scramble(t2, n - 4, t, 2), W / 2, H * 0.44 + s1 * 0.95, { font: F.unb(s2), ls: 14 * S, fill: '#ff2440', glow: `rgba(${RED},0.9)`, alpha: a });
  txt('UMBRA01', W / 2, H * 0.44 + s1 * 0.95 + s2 * 1.1, { font: F.mono(30 * S), ls: 16 * S, fill: '#7dfcff', alpha: a * ss(21, 22, t) });
}
function outroCard(t) {
  const a = ss(345.2, 346, t) * (1 - ss(348.3, 349, t)); if (a <= 0) return;
  const s1 = fit('РЕЗОНАНС ПОСЛЕДСТВИЙ', F.unb, 110 * S, W * 0.9, 6 * S);
  txt('РЕЗОНАНС ПОСЛЕДСТВИЙ', W / 2, H / 2, { font: F.unb(s1), ls: 6 * S, fill: '#fff', glow: `rgba(${RED},0.9)`, rgb: 4 * S, alpha: a });
  txt('UMBRA01', W / 2, H / 2 + s1 * 1.2, { font: F.mono(30 * S), ls: 16 * S, fill: '#7dfcff', alpha: a });
}

// ───────── HUD ─────────
function hud(t, sec, lvl) {
  if (lvl <= 0.01) return;
  ctx.save(); ctx.globalAlpha = lvl; const m = 34 * S, L = 60 * S, c = `rgba(${CYAN},0.8)`;
  ctx.strokeStyle = c; ctx.lineWidth = 2.5 * S;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke(); }
  ctx.font = F.mono(17 * S); ctx.fillStyle = c; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillText('CERBERUS-NET // NODE 07', m + 14 * S, m + 12 * S);
  ctx.fillStyle = `rgba(${RED},0.95)`; ctx.fillText(`SECTOR: ${sec.name}`, m + 14 * S, m + 36 * S);
  ctx.textAlign = 'right'; ctx.fillStyle = c;
  const mm = Math.floor(t / 60), sx = (t % 60).toFixed(2).padStart(5, '0');
  ctx.fillText(`T+ ${String(mm).padStart(2, '0')}:${sx}`, W - m - 14 * S, m + 12 * S); ctx.fillText('SYNC 143.5 BPM', W - m - 14 * S, m + 36 * S);
  if (Math.floor(t * 2) % 2) { ctx.fillStyle = `rgb(${RED})`; ctx.beginPath(); ctx.arc(W - m - 190 * S, m + 21 * S, 6 * S, 0, TAU); ctx.fill(); }
  // resonance meter
  const lv = clamp(As('rms', t, 3) * 1.1), segs = 22, mx = W - m - 10 * S, my = H * 0.3, mh = H * 0.4;
  for (let i = 0; i < segs; i++) { const on = i / segs < lv; ctx.fillStyle = on ? (i > segs * 0.75 ? `rgba(${RED},0.95)` : `rgba(${CYAN},0.85)`) : 'rgba(255,255,255,0.08)'; ctx.fillRect(mx - 12 * S, my + mh - (i + 1) * mh / segs + 2 * S, 12 * S, mh / segs - 4 * S); }
  ctx.save(); ctx.translate(mx - 22 * S, my + mh / 2); ctx.rotate(-PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = c; ctx.fillText(`RESONANCE ${Math.round(lv * 100)}%`, 0, -14 * S); ctx.restore();
  // spectrum
  const nb = PORT ? 32 : 56, bw = (W - m * 2 - 120 * S) / nb, by = H - m - 14 * S;
  for (let i = 0; i < nb; i++) { const f = i / nb, base = f < 0.25 ? A('low', t) : f < 0.7 ? A('mid', t) : A('high', t), h = (8 + 70 * base * (0.6 + 0.4 * hash(i + Math.floor(t * 15)))) * S; ctx.fillStyle = f < 0.25 ? `rgba(${RED},0.8)` : `rgba(${CYAN},0.7)`; ctx.fillRect(m + 60 * S + i * bw, by - h, bw * 0.6, h); }
  // hex column
  ctx.textAlign = 'left'; ctx.font = F.mono(14 * S); ctx.fillStyle = `rgba(${CYAN},0.35)`;
  for (let r = 0; r < 14; r++) { const k = Math.floor(t * 8) + r; let s = ''; for (let j = 0; j < 4; j++) s += Math.floor(hash(k * 7 + j) * 65535).toString(16).padStart(4, '0').toUpperCase() + ' '; ctx.fillText(s, m + 14 * S, H * 0.32 + r * 20 * S); }
  ctx.restore();
}

// ───────── post FX ─────────
function rgbSplit(amt) {
  if (amt < 0.6) return;
  BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0);
  BX2.globalCompositeOperation = 'copy'; BX2.drawImage(BUF, 0, 0); BX2.globalCompositeOperation = 'multiply'; BX2.fillStyle = '#ff0000'; BX2.fillRect(0, 0, W, H);
  BX.globalCompositeOperation = 'multiply'; BX.fillStyle = '#00ffff'; BX.fillRect(0, 0, W, H);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(BUF, -amt, 0); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(BUF2, amt, 0); ctx.restore();
}
function slices(t, amt) {
  if (amt < 0.04) return; BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0);
  const f = Math.floor(t * 20), n = Math.floor(3 + amt * 12);
  for (let i = 0; i < n; i++) { const y = hash(f * 13 + i) * H, h = (6 + hash(f * 7 + i * 3) * 90 * amt) * S, dx = (hash(f * 3 + i * 11) - 0.5) * 300 * amt * S; ctx.drawImage(BUF, 0, y, W, h, dx, y, W, h); }
}
function blocks(t, amt) {
  if (amt < 0.08) return; BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0);
  const f = Math.floor(t * 15), n = Math.floor(amt * 10);
  for (let i = 0; i < n; i++) { const bw = (60 + hash(f + i * 3) * 260) * S, bh = (30 + hash(f * 5 + i) * 140) * S, sx = hash(f * 7 + i) * (W - bw), sy = hash(f * 11 + i) * (H - bh); ctx.drawImage(BUF, sx, sy, bw, bh, sx + (hash(f + i * 13) - 0.5) * 200 * S, sy + (hash(f * 3 + i * 17) - 0.5) * 60 * S, bw, bh); if (hash(f + i * 19) > 0.6) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${hash(i + f) > 0.5 ? RED : CYAN},0.25)`; ctx.fillRect(sx, sy, bw, bh); ctx.globalCompositeOperation = 'source-over'; } }
}
function pixelate(t, amt) {
  if (amt < 0.1) return; const k = Math.round(lerp(4, 24, amt)), w = Math.ceil(W / k), h = Math.ceil(H / k);
  SX.imageSmoothingEnabled = true; SX.drawImage(cv, 0, 0, w, h); ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 0.85;
  const y0 = hash(Math.floor(t * 10)) * H * 0.6, hh = H * (0.2 + 0.4 * amt); ctx.drawImage(SMALL, 0, y0 / k, w, hh / k, 0, y0, W, hh); ctx.restore();
}
function vhsBand(t, amt) {
  if (amt < 0.05) return; const y = ((t * 0.3) % 1.4 - 0.2) * H, h = 60 * S;
  BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0); ctx.drawImage(BUF, 0, y, W, h, 14 * S * amt, y, W, h);
  ctx.globalAlpha = 0.15 * amt; ctx.fillStyle = GRAIN[1]; ctx.fillRect(0, y, W, h); ctx.globalAlpha = 1;
}
// big moments: [time, strength, kind]
const HITS = [[18.3, 0.6, 'f'], [44.04, 0.8, 'f'], [50.82, 0.7, 'i'], [64.31, 1.5, 'i'], [91.28, 0.8, 'f'], [111.7, 0.7, 'f'], [119.76, 1.4, 'i'], [147.13, 1, 'f'], [201.3, 0.8, 'f'], [211.04, 1.4, 'i'], [238.0, 1.6, 'i'], [238.48, 1, 'f'], [299.84, 0.9, 'f'], [313, 1.6, 'i'], [330.24, 1.2, 'f'], [339.5, 1.3, 'i']];
function hitAmt(t) { let f = 0, inv = 0; for (const [h, s, k] of HITS) if (t >= h && t < h + 1.5) { const v = s * Math.exp(-(t - h) * 6); f += v; if (k === 'i' && t - h < 0.07) inv = 1; } return [f, inv]; }

window.renderFrame = function (t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const sec = SEC.find(s => t >= s.s && t < s.e) || SEC[SEC.length - 1];
  const k = kick(t), b = beat(t), [hf, inv] = hitAmt(t), en = sec.en;
  const shake = (k * 8 + b * 4) * en * S + hf * 22 * S, zoom = 1.03 + 0.025 * k * en + 0.04 * hf;
  ctx.save(); ctx.translate(W / 2 + noise1(t * 33) * shake, H / 2 + noise1(t * 29 + 7) * shake); ctx.rotate(noise1(t * 9 + 3) * shake * 0.0004); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
  sec.bg(t);
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  hud(t, sec, sec.hud * (0.85 + 0.15 * b));
  const g = sec.gl;
  // heavy glitches hit the picture + HUD; the lyrics stay readable on top
  slices(t, g * (0.5 * k + 0.4 * b * (g > 0.9)));
  blocks(t, g > 0.6 ? g * k * 0.9 + hf * 0.8 : 0);
  pixelate(t, (g >= 1 && k > 0.85 && hash(Math.floor(t * 8)) > 0.6) ? 0.7 : hf > 0.8 ? 0.5 : 0);
  vhsBand(t, g * 0.6);
  ctx.save(); ctx.translate(noise1(t * 31) * shake * 0.3, noise1(t * 27 + 4) * shake * 0.3);
  for (const L of LINES) if (t >= L.s - 0.05 && t < L.e + 0.25) drawLine(L, t);
  ctx.restore();
  if (hf > 0.02) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${hf > 1 ? 255 : 200},${hf > 1 ? 255 : 210},${clamp(hf * 0.45)})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  rgbSplit((2 + 7 * k * g + 20 * hf) * S);
  if (hf > 0.5) slices(t, hf * 0.5);   // only the big hits shred the words too
  if (inv) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  ctx.fillStyle = SCAN; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(VIGN, 0, 0);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.07; ctx.fillStyle = GRAIN[Math.floor(t * 24) % 4]; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const fade = Math.max(1 - ss(0, 1.0, t), ss(348.2, 349, t));
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
};
window.DURATION = 349.0;
window.ready = Promise.all(['800 60px Unb', '400 60px UnbL', '60px Glitch', '60px Russo', '700 60px Mono'].map(f => document.fonts.load(f, 'АZ01'))).then(() => true);
})();
