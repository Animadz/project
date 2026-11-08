/* Umbra01 — animated logo (TikTok 9:16, 1080x1920, 60 fps).
 * "Umbra" is painted stroke-by-stroke using a precomputed stroke-order time map,
 * then "01" slams in. Everything is a pure function of time t -> renderFrame(t).
 * ?v=intro (ends with a glitch-out, 4.2 s) | ?v=outro (holds, fades, 6 s) */
(() => {
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = 1080, H = 1920;
const V = new URLSearchParams(location.search).get('v') || 'intro';
const DUR = V === 'intro' ? 4.2 : 6.0;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const eOut = k => 1 - Math.pow(1 - clamp(k), 3), eIn = k => Math.pow(clamp(k), 3);
const eIO = k => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const PI = Math.PI, TAU = 2 * PI;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
function rnd(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ───────── timeline ─────────
const TL = { bgIn: 0.5, swash0: 0.22, swash1: 0.7, write0: 0.48, write1: 1.86, g01: 1.62, impact: 2.0, sweep0: 2.35, sweep1: 2.9, flick: 3.16, glitch0: 3.62, glitch1: 4.12 };
const WRITE_DUR = TL.write1 - TL.write0;
const writeT = t => { const k = clamp((t - TL.write0) / WRITE_DUR); return k < 0.08 ? 0.5 * k * k / 0.08 : k > 0.92 ? 1 - 0.5 * (1 - k) * (1 - k) / 0.08 : k; };

// ───────── layout ─────────
const TX0 = 82, TY0 = 690;              // top-left of the "Umbra" time map
const O1 = { x: 830, y: 1112, rot: -0.1, size: 196 };
const FLOOR = 1235;                     // reflection line

// ───────── assets (filled in by init) ─────────
let TM, TMD, PATH, TW, TH, MASK, MASKD, HOT, HOTD, TXC, TXX, GLOW, GLX, DRIPS = [];
const BUF = mk(W, H), BX = BUF.getContext('2d'), BUF2 = mk(W, H), BX2 = BUF2.getContext('2d');

function glowSprite(r, g, b, size = 128) {
  const c = mk(size, size), x = c.getContext('2d'), gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(0.25, `rgba(${r},${g},${b},0.4)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, size, size); return c;
}
const SPR = { violet: glowSprite(170, 90, 255), pink: glowSprite(255, 90, 210), white: glowSprite(255, 240, 255), cyan: glowSprite(110, 220, 255), soft: glowSprite(150, 80, 255, 256) };
function spr(s, x, y, r, a) { if (a <= 0.003) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r); }

const SMOKE = (() => { // tileable purple smoke texture
  const w = 1024, h = 1024, c = mk(w, h), x = c.getContext('2d'), R = rnd(11);
  for (let i = 0; i < 230; i++) {
    const cx = R() * w, cy = R() * h, r = 60 + R() * 230, s = [SPR.violet, SPR.pink, SPR.soft][Math.floor(R() * 3)];
    x.globalAlpha = 0.035 + R() * 0.06;
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) x.drawImage(s, cx + dx - r, cy + dy - r, 2 * r, 2 * r);
  }
  return c;
})();
function smoke(t, sp, a, sc, dir) {
  const off = (((t * sp) % 1024) + 1024) % 1024;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = a;
  const pat = ctx.createPattern(SMOKE, 'repeat'); pat.setTransform(new DOMMatrix().scale(sc).translate(dir * off, -off * 0.35));
  ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); ctx.restore();
}
const GRAIN = [0, 1, 2].map(k => {
  const c = mk(256, 256), x = c.getContext('2d'), d = x.createImageData(256, 256), R = rnd(77 + k);
  for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return ctx.createPattern(c, 'repeat');
});
const VIGN = (() => {
  const c = mk(W, H), x = c.getContext('2d'), g = x.createRadialGradient(W / 2, H * 0.47, W * 0.35, W / 2, H * 0.47, H * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.88)'); x.fillStyle = g; x.fillRect(0, 0, W, H); return c;
})();

// paint swash behind the logo: a dry-brush stroke with bristle streaks
const SWASH = (() => {
  const w = 1080, h = 520, c = mk(w, h), x = c.getContext('2d'), R = rnd(5);
  const x0 = 30, x1 = 1060, cy = h / 2, N = 180, top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, X = lerp(x0, x1, u), mid = cy + Math.sin(u * PI * 1.1 - 0.3) * 26;
    const th = 290 * (u < 0.06 ? Math.sqrt(u / 0.06) : 1 - 0.8 * Math.pow((u - 0.06) / 0.94, 2.4)) * (1 + 0.08 * noise1(u * 14));
    top.push([X + (R() - 0.5) * 6, mid - th / 2 + (R() - 0.5) * 9]); bot.push([X + (R() - 0.5) * 6, mid + th / 2 + (R() - 0.5) * 9]);
  }
  const P = new Path2D(); top.forEach((p, i) => i ? P.lineTo(...p) : P.moveTo(...p)); [...bot].reverse().forEach(p => P.lineTo(...p)); P.closePath();
  x.save(); x.clip(P);
  const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#3a0f73'); g.addColorStop(0.5, '#5a1aa6'); g.addColorStop(1, '#43128a');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { // bristle streaks
    const y = cy + (R() - 0.5) * 300, l = 200 + R() * 800, sx = x0 + R() * (x1 - x0 - l * 0.4);
    x.strokeStyle = R() < 0.5 ? `rgba(200,110,255,${0.12 + R() * 0.25})` : `rgba(14,3,32,${0.2 + R() * 0.35})`;
    x.lineWidth = 0.6 + R() * 2.4; x.beginPath(); x.moveTo(sx, y);
    for (let k = 1; k <= 8; k++) x.lineTo(sx + l * k / 8, y + Math.sin((sx + l * k / 8) / w * PI * 1.1 - 0.3) * 4 + (R() - 0.5) * 2); x.stroke();
  }
  x.globalCompositeOperation = 'destination-out'; // dry-brush gaps toward the tail
  for (let i = 0; i < 70; i++) { const y = cy + (R() - 0.5) * 200; x.lineWidth = 1 + R() * 4; x.strokeStyle = `rgba(0,0,0,${0.5 + R() * 0.5})`; x.beginPath(); x.moveTo(x0 + 520 + R() * 380, y); x.lineTo(x1 + 20, y + (R() - 0.5) * 8); x.stroke(); }
  x.restore();
  x.strokeStyle = 'rgba(255,110,220,0.7)'; x.lineWidth = 3; x.beginPath(); top.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.stroke();
  x.strokeStyle = 'rgba(140,70,255,0.25)'; x.beginPath(); bot.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.stroke();
  return c;
})();
const SWASH_TMP = mk(1080, 520), SWX = SWASH_TMP.getContext('2d');

const SPLAT = (() => { const R = rnd(91), a = []; for (let i = 0; i < 34; i++) { const ang = R() * TAU, d = 60 + Math.pow(R(), 0.7) * 380, side = R() < 0.5 ? 120 : 960; a.push({ x: side + Math.cos(ang) * d * 0.6, y: 900 + Math.sin(ang) * d * 0.45, r: 2 + Math.pow(R(), 3) * 9, ang, el: 1 + R() * 2.5, del: R() * 0.07, col: R() < 0.6 ? '#b45cff' : '#ff5ad2' }); } return a; })();

async function init() {
  await document.fonts.load('700 100px Chakra', '01#$');
  PATH = await (await fetch('data/path.json')).json();
  const img = new Image(); img.src = 'data/timemap.png'; await img.decode();
  TW = img.width; TH = img.height;
  TM = mk(TW, TH); const tx = TM.getContext('2d', { willReadFrequently: true }); tx.drawImage(img, 0, 0);
  // the PNG stores straight (non-premultiplied) data; read it back raw
  TMD = tx.getImageData(0, 0, TW, TH).data;
  MASK = mk(TW, TH); MASKD = MASK.getContext('2d').createImageData(TW, TH);
  HOT = mk(TW, TH); HOTD = HOT.getContext('2d').createImageData(TW, TH);
  TXC = mk(TW, TH); TXX = TXC.getContext('2d');
  GLOW = mk(Math.ceil(TW / 4) + 40, Math.ceil(TH / 4) + 40); GLX = GLOW.getContext('2d');
  // drips: below the lowest ink of a few columns
  for (const fx of [0.28, 0.49, 0.71]) {
    const x = Math.floor(TW * fx); let yb = -1, tb = 0;
    for (let y = TH - 1; y >= 0; y--) { const i = (y * TW + x) * 4; if (TMD[i + 3] > 200) { yb = y; tb = (TMD[i] * 256 + TMD[i + 1]) / 65535; break; } }
    if (yb > 0) DRIPS.push({ x: TX0 + x, y: TY0 + yb - 2, t0: TL.write0 + tb * WRITE_DUR + 0.25, len: 40 + hash(fx * 9) * 70 });
  }
  return true;
}

// ───────── per-frame text mask ─────────
function buildMask(T) {
  const s = TMD, m = MASKD.data, h = HOTD.data, n = TW * TH;
  for (let i = 0; i < n; i++) {
    const j = i * 4, a = s[j + 3];
    if (a === 0) { m[j + 3] = 0; h[j + 3] = 0; continue; }
    const d = T - (s[j] * 256 + s[j + 1]) / 65535;
    if (d <= 0) { m[j + 3] = 0; h[j + 3] = 0; continue; }
    const al = Math.min(1, d / 0.01) * a;
    m[j] = m[j + 1] = m[j + 2] = 255; m[j + 3] = al;
    h[j] = 255; h[j + 1] = 235; h[j + 2] = 255; h[j + 3] = al * Math.exp(-d / 0.05);
  }
  MASK.getContext('2d').putImageData(MASKD, 0, 0); HOT.getContext('2d').putImageData(HOTD, 0, 0);
}
function buildText(T, t) {
  buildMask(T);
  TXX.globalCompositeOperation = 'source-over'; TXX.globalAlpha = 1; TXX.clearRect(0, 0, TW, TH);
  const g = TXX.createLinearGradient(0, 0, TW, TH * 0.6);
  g.addColorStop(0, '#b77bff'); g.addColorStop(0.45, '#ff8ee6'); g.addColorStop(1, '#a874ff');
  TXX.fillStyle = g; TXX.fillRect(0, 0, TW, TH);
  TXX.globalAlpha = 0.18; TXX.fillStyle = GRAIN[0]; TXX.globalCompositeOperation = 'multiply'; TXX.fillRect(0, 0, TW, TH); // paint texture
  TXX.globalAlpha = 1; TXX.globalCompositeOperation = 'destination-in'; TXX.drawImage(MASK, 0, 0);
  TXX.globalCompositeOperation = 'lighter'; TXX.drawImage(HOT, 0, 0); TXX.globalAlpha = 0.35; TXX.drawImage(MASK, 0, 0); TXX.globalAlpha = 1;
  // glow source: tinted, quarter resolution
  GLX.globalCompositeOperation = 'source-over'; GLX.clearRect(0, 0, GLOW.width, GLOW.height);
  GLX.drawImage(TXC, 20, 20, TW / 4, TH / 4);
  GLX.globalCompositeOperation = 'source-in'; const gg = GLX.createLinearGradient(0, 0, GLOW.width, 0);
  gg.addColorStop(0, '#8a3cff'); gg.addColorStop(0.5, '#ff3fc8'); gg.addColorStop(1, '#9b4dff'); GLX.fillStyle = gg; GLX.fillRect(0, 0, GLOW.width, GLOW.height);
}
function drawGlow(x, y, blurPx, alpha) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.filter = `blur(${blurPx}px)`;
  ctx.drawImage(GLOW, x - 80, y - 80, GLOW.width * 4, GLOW.height * 4); ctx.restore();
}

// ───────── scene pieces ─────────
function background(t) {
  const g = ctx.createRadialGradient(W / 2, H * 0.44, 50, W / 2, H * 0.48, H * 0.8);
  g.addColorStop(0, '#2a0f52'); g.addColorStop(0.45, '#12062b'); g.addColorStop(1, '#030108');
  ctx.fillStyle = g; ctx.fillRect(-100, -100, W + 200, H + 200);
  smoke(t, 18, 0.55, 1.6, 1); smoke(t, 11, 0.35, 2.4, -1);
  // volumetric beams from above
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const a = -0.35 + i * 0.17 + Math.sin(t * 0.6 + i * 1.7) * 0.05, bx = W * (0.2 + i * 0.15), w = 60 + 50 * hash(i);
    const gr = ctx.createLinearGradient(bx, -100, bx + Math.sin(a) * 1500, 1400);
    gr.addColorStop(0, `rgba(${i % 2 ? '255,80,210' : '150,80,255'},${0.09 + 0.04 * Math.sin(t * 1.3 + i)})`); gr.addColorStop(1, 'rgba(120,60,255,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(bx - w * 0.2, -100); ctx.lineTo(bx + w * 0.2, -100);
    ctx.lineTo(bx + Math.sin(a) * 1500 + w * 2, 1400); ctx.lineTo(bx + Math.sin(a) * 1500 - w * 2, 1400); ctx.closePath(); ctx.fill();
  }
  // bokeh
  for (let i = 0; i < 46; i++) {
    const z = 0.3 + hash(i * 3) * 0.7, y = ((hash(i * 7) * H - t * 40 * z) % H + H) % H, x = hash(i) * W + Math.sin(t * 0.7 + i) * 20 * z;
    spr([SPR.violet, SPR.pink, SPR.cyan][i % 3], x, y, (8 + 40 * (1 - z)) * (i % 7 === 0 ? 2 : 1), (0.18 + 0.4 * z) * (0.6 + 0.4 * Math.sin(t * 2 + i)));
  }
  ctx.restore();
  // floor glow line
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const fl = ctx.createLinearGradient(0, 0, W, 0); fl.addColorStop(0, 'rgba(160,80,255,0)'); fl.addColorStop(0.5, 'rgba(220,120,255,0.55)'); fl.addColorStop(1, 'rgba(160,80,255,0)');
  ctx.fillStyle = fl; ctx.fillRect(0, FLOOR - 1, W, 2);
  spr(SPR.soft, W / 2, FLOOR, 420, 0.25); ctx.restore();
}
function swash(t) {
  const k = eOut((t - TL.swash0) / (TL.swash1 - TL.swash0)); if (k <= 0) return;
  SWX.globalCompositeOperation = 'copy'; SWX.drawImage(SWASH, 0, 0);
  SWX.globalCompositeOperation = 'destination-in';
  const xw = lerp(-80, 1180, k), g = SWX.createLinearGradient(xw - 120, 0, xw, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  SWX.fillStyle = g; SWX.fillRect(0, 0, 1080, 520);
  ctx.save(); ctx.translate(W / 2, TY0 + TH * 0.6); ctx.rotate(-0.09); ctx.scale(lerp(0.96, 1, k), 1);
  ctx.globalAlpha = 0.9; ctx.drawImage(SWASH_TMP, -540, -260); ctx.restore();
  if (k < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const yy = TY0 + TH * 0.6 - Math.sin(-0.09) * (xw - 540); spr(SPR.pink, xw - 40, yy, 140, 0.5 * (1 - k)); ctx.restore(); }
}
function penTip(T, t) {
  if (T <= 0 || T >= 1 || t > TL.write1 + 0.05) return;
  const P = PATH.path; let lo = 0, hi = P.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P[m][0] <= T) lo = m; else hi = m - 1; }
  const [, px, py] = P[lo], x = TX0 + px, y = TY0 + py;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  spr(SPR.pink, x, y, 90, 0.6); spr(SPR.white, x, y, 26, 1); spr(SPR.violet, x, y, 200, 0.25);
  // embers shed along the recent path
  for (let k = lo; k > Math.max(0, lo - 90); k -= 3) {
    const [pt, ex, ey] = P[k], age = (T - pt) * WRITE_DUR; if (age > 0.7) break;
    const hx = hash(k * 1.3), hy = hash(k * 2.7);
    const qx = TX0 + ex + (hx - 0.5) * 160 * age, qy = TY0 + ey - 60 * age * (0.5 + hy) + 200 * age * age;
    spr(hx > 0.5 ? SPR.pink : SPR.violet, qx, qy, 10 + 6 * hy, (1 - age / 0.7) * 0.9);
  }
  ctx.restore();
}
function drips(t) {
  ctx.save();
  for (const d of DRIPS) {
    const k = eOut((t - d.t0) / 1.3); if (k <= 0) continue;
    const L = d.len * k, g = ctx.createLinearGradient(0, d.y, 0, d.y + L);
    g.addColorStop(0, '#e2b8ff'); g.addColorStop(1, '#ff7fe0');
    ctx.fillStyle = g; ctx.shadowColor = 'rgba(200,80,255,0.9)'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.moveTo(d.x - 5, d.y); ctx.quadraticCurveTo(d.x - 3, d.y + L * 0.6, d.x - 2.5, d.y + L); ctx.arc(d.x, d.y + L, 5 + 2 * k, PI, 0, true);
    ctx.quadraticCurveTo(d.x + 3, d.y + L * 0.6, d.x + 5, d.y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// ── "01": glitch decode → BANG → residual ripple ──
const O1W = 560, O1H = 300, O1C = mk(O1W, O1H), O1X = O1C.getContext('2d'), O1T = mk(O1W, O1H), O1TX = O1T.getContext('2d');
const SCR = '01ABCDEFHKMNPRSTUVXYZ#$%&@*/<>[]=+?!7394';
function glyphs01(t) {
  if (t >= TL.impact) return '01';
  const step = Math.floor(t * 24), lock = [TL.impact - 0.09, TL.impact];
  return [0, 1].map(i => t >= lock[i] ? '01'[i] : hash(step * 7.3 + i * 13) < 0.22 ? '01'[i] : SCR[Math.floor(hash(step * 3.1 + i * 5.7) * SCR.length)]).join('');
}
function paint01(str, glow, scan) {
  O1X.setTransform(1, 0, 0, 1, 0, 0); O1X.globalCompositeOperation = 'source-over'; O1X.globalAlpha = 1; O1X.clearRect(0, 0, O1W, O1H);
  O1X.font = `700 ${O1.size}px Chakra`; O1X.textAlign = 'center'; O1X.textBaseline = 'middle'; O1X.letterSpacing = '12px';
  O1X.shadowColor = 'rgba(255,60,200,1)'; O1X.shadowBlur = 42 * glow;
  const g = O1X.createLinearGradient(0, O1H / 2 - O1.size / 2, 0, O1H / 2 + O1.size / 2); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ff9ae6');
  O1X.fillStyle = g; O1X.fillText(str, O1W / 2, O1H / 2);
  O1X.shadowBlur = 0; O1X.lineWidth = 2; O1X.strokeStyle = 'rgba(255,255,255,0.7)'; O1X.strokeText(str, O1W / 2, O1H / 2);
  if (scan > 0.02) { O1X.globalCompositeOperation = 'destination-out'; O1X.fillStyle = `rgba(0,0,0,${0.55 * scan})`; for (let y = 0; y < O1H; y += 4) O1X.fillRect(0, y, O1W, 1.6); }
}
function tint(col) { O1TX.globalCompositeOperation = 'copy'; O1TX.drawImage(O1C, 0, 0); O1TX.globalCompositeOperation = 'source-in'; O1TX.fillStyle = col; O1TX.fillRect(0, 0, O1W, O1H); return O1T; }
function state01(t) {
  if (t < TL.g01) return null;
  const ia = t - TL.impact, step = Math.floor(t * 30);
  if (ia < 0) { // decoding: flicker, scramble, heavy RGB split and slices
    const k = (t - TL.g01) / (TL.impact - TL.g01), on = hash(step * 1.37) < 0.3 + 0.6 * k;
    return { str: glyphs01(t), alpha: on ? 0.5 + 0.5 * hash(step * 2.1) : 0.07, rgb: 10 + 28 * hash(step * 4.3), slices: 1.1 - 0.4 * k, ripple: 4, sx: 1 + (hash(step * 5.9) - 0.5) * 0.6 * (1 - k), glow: 0.55, scan: 1, step };
  }
  const micro = ia > 0.6 && (t * 1.25) % 1 < 0.07 ? 1 : 0; // a tiny glitch every 0.8 s
  return { str: '01', alpha: 1, rgb: 16 * Math.exp(-ia * 8) + 1.6 + micro * 9, slices: (ia < 0.1 ? 0.9 : 0) + micro * 0.5, ripple: 12 * Math.exp(-ia * 3.2) + 1.1, sx: 1 + 0.14 * Math.exp(-ia * 22), glow: 1, scan: 0.8 * Math.exp(-ia * 3) + 0.12, step };
}
function drawZeroOne(t, alpha = 1, refl = false) {
  const S = state01(t); if (!S) return;
  paint01(S.str, S.glow * (refl ? 0.3 : 1), refl ? 0 : S.scan);
  ctx.save(); ctx.translate(O1.x, O1.y); ctx.rotate(O1.rot); ctx.scale(S.sx, 1 / Math.sqrt(S.sx));
  const a = alpha * S.alpha;
  if (!refl && S.rgb > 0.5) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.75;
    ctx.drawImage(tint('#2fd8ff'), -O1W / 2 - S.rgb, -O1H / 2);
    ctx.drawImage(tint('#ff2fb4'), -O1W / 2 + S.rgb, -O1H / 2 + S.rgb * 0.15);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = a; const sh = 5;
  for (let y = 0; y < O1H; y += sh) { // strips: ripple wave + glitch slice offsets
    let dx = S.ripple * Math.sin(y * 0.085 + t * 24);
    if (S.slices > 0 && hash(S.step * 11.7 + Math.floor(y / 15) * 0.37) < 0.2 * S.slices) dx += (hash(S.step * 3.3 + Math.floor(y / 15)) - 0.5) * 130 * S.slices;
    ctx.drawImage(O1C, 0, y, O1W, sh, -O1W / 2 + dx, -O1H / 2 + y, O1W, sh);
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function impactFX(t) {
  const age = t - TL.impact; if (age < 0) return;
  ctx.save();
  for (const s of SPLAT) { // paint splatter
    const k = eOut((age - s.del) / 0.12); if (k <= 0) continue;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang); ctx.fillStyle = s.col; ctx.globalAlpha = 0.85;
    ctx.shadowColor = s.col; ctx.shadowBlur = 14; ctx.beginPath(); ctx.ellipse(0, 0, s.r * s.el * k, s.r * k, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.globalCompositeOperation = 'lighter';
  if (age < 1.2) {
    for (let i = 0; i < 90; i++) { // sparks
      const ang = hash(i * 1.7) * TAU, v = 300 + 900 * hash(i * 3.1), life = 0.4 + 0.7 * hash(i * 5.3); if (age > life) continue;
      const x = O1.x + Math.cos(ang) * v * age, y = O1.y + Math.sin(ang) * v * age * 0.7 + 600 * age * age;
      const a = 1 - age / life; ctx.strokeStyle = `rgba(255,${180 + 70 * hash(i)},255,${a})`; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang) * v * 0.03, y - Math.sin(ang) * v * 0.021); ctx.stroke();
    }
    for (const [d, w, c] of [[0, 12, '255,100,220'], [0.05, 5, '170,100,255']]) { // shockwaves (start outside the digits)
      const k = lerp(0.45, 1, eOut((age - d) / 0.55)); if (age < d || k >= 0.999) continue;
      ctx.strokeStyle = `rgba(${c},${(1 - k) * 1.6})`; ctx.lineWidth = w * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(O1.x, O1.y, 620 * k, 240 * k, O1.rot, 0, TAU); ctx.stroke();
    }
    spr(SPR.white, O1.x, O1.y, 300, Math.exp(-age * 10)); spr(SPR.pink, O1.x, O1.y, 700, 0.6 * Math.exp(-age * 5));
  }
  ctx.restore();
}
function sweep(t) { // specular light sweep across the logo
  const k = (t - TL.sweep0) / (TL.sweep1 - TL.sweep0); if (k <= 0 || k >= 1) return;
  BX.setTransform(1, 0, 0, 1, 0, 0); BX.globalCompositeOperation = 'copy'; BX.globalAlpha = 1;
  BX.drawImage(TXC, TX0, TY0);
  BX.globalCompositeOperation = 'source-over'; paint01('01', 0, 0); BX.save(); BX.translate(O1.x, O1.y); BX.rotate(O1.rot); BX.drawImage(O1C, -O1W / 2, -O1H / 2); BX.restore();
  BX.globalCompositeOperation = 'source-in';
  const x = lerp(-300, W + 300, eIO(k)), g = BX.createLinearGradient(x - 160, 0, x + 160, 300);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  BX.fillStyle = g; BX.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(BUF, 0, 0); ctx.restore();
}
function reflection(t, textAlpha) {
  ctx.save(); ctx.translate(0, FLOOR * 2); ctx.scale(1, -1); ctx.globalAlpha = 0.11 * textAlpha;
  ctx.drawImage(TXC, TX0, TY0); drawZeroOne(t, 0.12 * textAlpha, true); ctx.restore();
  const g = ctx.createLinearGradient(0, FLOOR, 0, FLOOR + 420); g.addColorStop(0, 'rgba(5,2,12,0)'); g.addColorStop(1, 'rgba(5,2,12,0.88)');
  ctx.fillStyle = g; ctx.fillRect(-100, FLOOR, W + 200, H);
}
function rgbSplit(amt) {
  if (amt < 0.5) return;
  BX.setTransform(1, 0, 0, 1, 0, 0); BX.globalAlpha = 1; BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0);
  BX2.globalCompositeOperation = 'copy'; BX2.drawImage(BUF, 0, 0); BX2.globalCompositeOperation = 'multiply'; BX2.fillStyle = '#ff0000'; BX2.fillRect(0, 0, W, H);
  BX.globalCompositeOperation = 'multiply'; BX.fillStyle = '#00ffff'; BX.fillRect(0, 0, W, H);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(BUF, -amt, 0);
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(BUF2, amt, 0); ctx.restore();
}
function glitchSlices(t, amt) {
  if (amt < 0.02) return;
  BX.setTransform(1, 0, 0, 1, 0, 0); BX.globalAlpha = 1; BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0);
  const f = Math.floor(t * 30), n = Math.floor(5 + amt * 16);
  for (let i = 0; i < n; i++) { const y = hash(f * 13 + i) * H, h = 8 + hash(f * 7 + i * 3) * 120 * amt, dx = (hash(f * 3 + i * 11) - 0.5) * 260 * amt; ctx.drawImage(BUF, 0, y, W, h, dx, y, W, h); }
}

// ───────── frame ─────────
window.renderFrame = function (t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.shadowBlur = 0;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const ia = t - TL.impact, shake = ia > 0 ? 22 * Math.exp(-ia * 9) : 0;
  const zoom = 1 + 0.05 * eIO(t / DUR) + (ia > 0 ? 0.03 * Math.exp(-ia * 7) : 0);
  ctx.save(); ctx.translate(W / 2 + noise1(t * 40) * shake, H / 2 + noise1(t * 37 + 9) * shake); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
  background(t);
  swash(t);
  const T = writeT(t);
  let flick = 1; if (t > TL.flick && t < TL.flick + 0.05) flick = 0.35; else if (t > TL.flick + 0.1 && t < TL.flick + 0.13) flick = 0.55;
  buildText(T, t);
  reflection(t, flick);
  const pulse = 0.85 + 0.15 * Math.sin(t * 5);
  drawGlow(TX0, TY0, 26, 1.0 * flick * pulse); drawGlow(TX0, TY0, 7, 1.0 * flick); drawGlow(TX0, TY0, 2, 0.5 * flick);
  ctx.globalAlpha = flick; ctx.drawImage(TXC, TX0, TY0); ctx.globalAlpha = 1;
  drips(t);
  penTip(T, t);
  impactFX(t);
  drawZeroOne(t, flick);
  sweep(t);
  ctx.restore();
  if (ia > 0 && ia < 0.25) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(200,90,255,${0.35 * Math.exp(-ia * 22)})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  let split = ia > 0 ? 18 * Math.exp(-ia * 10) : 0, gl = 0;
  if (V === 'intro' && t > TL.glitch0) { const k = (t - TL.glitch0) / (TL.glitch1 - TL.glitch0); split += 30 * k; gl = clamp(k * 1.4); }
  if (t > TL.flick && t < TL.flick + 0.06) gl = Math.max(gl, 0.3);
  if (ia > 0 && ia < 0.1) gl = Math.max(gl, 0.55);  // the BANG glitches the whole logo for a few frames
  rgbSplit(split); glitchSlices(t, gl);
  if (V === 'intro' && t > TL.glitch1 - 0.18) { // CRT switch-off
    const k = clamp((t - (TL.glitch1 - 0.18)) / 0.18);
    BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const sy = Math.max(0.004, 1 - eIn(k)); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1 + k * 0.2, sy); ctx.drawImage(BUF, -W / 2, -H / 2); ctx.restore();
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(230,180,255,${k})`; ctx.fillRect(0, H / 2 - 2, W, 4); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(VIGN, 0, 0);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.06; ctx.fillStyle = GRAIN[Math.floor(t * 30) % 3];
  ctx.save(); ctx.translate(Math.floor(hash(Math.floor(t * 30)) * 256), 0); ctx.fillRect(-256, 0, W + 512, H); ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const fade = Math.max(1 - ss(0, TL.bgIn, t), V === 'intro' ? ss(TL.glitch1, DUR, t) : ss(5.25, 6.0, t));
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
};
window.DURATION = DUR; window.FPS = 60;
window.ready = init();
})();
