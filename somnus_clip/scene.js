/* «Somnus Files» — cyberpunk × dream lyric video (procedural, Canvas).
 * Every frame is a pure function of time: window.renderFrame(t).  ?ar=16x9 | 9x16 */
(() => {
const Q = new URLSearchParams(location.search), PORT = Q.get('ar') === '9x16';
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = PORT ? 1080 : 1920, H = PORT ? 1920 : 1080; cv.width = W; cv.height = H;
const S = Math.min(W, H) / 1080, FPS = 30, DUR = 214.8;
const D = window.AUDIO, LY = window.LYRICS;

// ───────── helpers ─────────
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const eOut = k => 1 - Math.pow(1 - clamp(k), 3), eIn = k => Math.pow(clamp(k), 3), eIO = k => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const win = (t, a, b, fi = 0.3, fo = 0.3) => ss(a, a + fi, t) * (1 - ss(b - fo, b, t));
const PI = Math.PI, TAU = 2 * PI;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
function rnd(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function A(k, t) { const a = D[k]; return a[clamp(Math.floor(t * FPS), 0, a.length - 1)] || 0; }
function As(k, t, w = 3) { let s = 0; for (let i = -w; i <= w; i++) s += A(k, t + i / FPS); return s / (2 * w + 1); }
function lastIdx(arr, t) { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
const pulse = (arr, t, d) => { const i = lastIdx(arr, t); return i < 0 ? 0 : Math.exp(-(t - arr[i]) * d); };
const BEATS = D.beats, KICKS = D.kicks;
const beat = (t, d = 8) => pulse(BEATS, t, d), kick = (t, d = 11) => pulse(KICKS, t, d);
const MAG = '255,43,214', CYAN = '46,242,255', RED = '255,30,60', VIO = '150,80,255', AMBER = '255,190,90', WHITE = '255,255,255';

// ───────── textures ─────────
function glowSprite(c, size = 128) { const k = mk(size, size), x = k.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(0.25, `rgba(${c},0.4)`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(0, 0, size, size); return k; }
const SPR = { mag: glowSprite(MAG), cyan: glowSprite(CYAN), red: glowSprite(RED), vio: glowSprite(VIO), white: glowSprite(WHITE), amber: glowSprite(AMBER) };
function spr(s, x, y, r, a) { if (a <= 0.003 || r < 0.5) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1; }
const GRAIN = [0, 1, 2].map(k => { const c = mk(256, 256), x = c.getContext('2d'), d = x.createImageData(256, 256), R = rnd(70 + k); for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return ctx.createPattern(c, 'repeat'); });
const SCAN = (() => { const c = mk(4, 4), x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, 4, 1.3); return ctx.createPattern(c, 'repeat'); })();
const VIGN = (() => { const c = mk(W, H), x = c.getContext('2d'), g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)'); x.fillStyle = g; x.fillRect(0, 0, W, H); return c; })();
const BUF = mk(W, H), BX = BUF.getContext('2d'), BUF2 = mk(W, H), BX2 = BUF2.getContext('2d');
const SMOKE = (() => { const w = 1024, c = mk(w, w), x = c.getContext('2d'), R = rnd(9); for (let i = 0; i < 200; i++) { const cx = R() * w, cy = R() * w, r = 60 + R() * 220, s = [SPR.mag, SPR.vio, SPR.cyan][Math.floor(R() * 3)]; x.globalAlpha = 0.04 + R() * 0.05; for (const dx of [-w, 0, w]) for (const dy of [-w, 0, w]) x.drawImage(s, cx + dx - r, cy + dy - r, 2 * r, 2 * r); } return c; })();
function smoke(t, a, sp = 20, sc = 1.5) { const pat = ctx.createPattern(SMOKE, 'repeat'); pat.setTransform(new DOMMatrix().scale(sc * S).translate(t * sp, -t * sp * 0.4)); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = a; ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function bg(c1, c2, c3) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); g.addColorStop(0.6, c2); g.addColorStop(1, c3 || c2); ctx.fillStyle = g; ctx.fillRect(-W, -H, W * 3, H * 3); }
function radial(x, y, r, inner) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, inner); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.globalCompositeOperation = 'source-over'; }

// ───────── red threads ─────────
function threads(t, n, o = {}) {
  const { seed = 1, alpha = 1, width = 3, col = RED, cx = W / 2, cy = H / 2, span = 1, tighten = 0 } = o;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a0 = hash(seed + i) * TAU + t * 0.05 * (i % 2 ? 1 : -1), a1 = a0 + PI * (0.6 + 0.8 * hash(seed * 3 + i));
    const R = Math.max(W, H) * 0.75 * span;
    const p0 = [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], p3 = [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R];
    const k1 = [cx + noise1(t * 0.4 + i * 3) * W * 0.4 * (1 - tighten), cy + noise1(t * 0.35 + i * 5 + 9) * H * 0.4 * (1 - tighten)];
    const k2 = [cx + noise1(t * 0.3 + i * 7 + 2) * W * 0.4 * (1 - tighten), cy + noise1(t * 0.45 + i * 11 + 4) * H * 0.4 * (1 - tighten)];
    for (const [lw, a] of [[width * 5, 0.12], [width * 2, 0.35], [width * 0.7, 1]]) {
      ctx.strokeStyle = `rgba(${col},${a * alpha})`; ctx.lineWidth = lw * S; ctx.beginPath(); ctx.moveTo(...p0); ctx.bezierCurveTo(...k1, ...k2, ...p3); ctx.stroke();
    }
  }
  ctx.restore();
}
function connect(points, t, alpha = 1) { // evidence-board strings between points
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (hash(i * 7 + j * 13) < 0.45) continue;
    const [a, b] = [points[i], points[j]], sag = 60 * S + noise1(t + i + j) * 30 * S;
    ctx.strokeStyle = `rgba(${RED},${0.8 * alpha})`; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(...a); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag, ...b); ctx.stroke();
  }
  for (const p of points) { spr(SPR.red, p[0], p[1], 18 * S, alpha); ctx.fillStyle = `rgba(255,220,220,${alpha})`; ctx.beginPath(); ctx.arc(p[0], p[1], 5 * S, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ───────── silhouettes (original designs) ─────────
function smoothPath(P, pts) { const n = pts.length; P.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2); for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; P.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } P.closePath(); }
const SIL = {
  detective: (() => { const P = new Path2D(); // trench-coat detective, collar up, hands in pockets
    P.ellipse(0, -90, 7, 8.5, 0, 0, TAU);
    const hair = [[-8, -90], [-11, -96], [-7, -96], [-7, -102], [-3, -98], [0, -105], [3, -99], [7, -103], [7, -97], [11, -98], [8, -89], [8, -94], [-8, -94]];
    P.moveTo(...hair[0]); hair.forEach(p => P.lineTo(...p)); P.closePath();
    const coat = [[-3.5, -82], [3.5, -82], [4, -80], [9, -80.5], [16, -77], [18.5, -72], [19.5, -60], [20.5, -47], [19, -41], [18.5, -36], [21, -24], [23, -12], [8, -10.5], [7.5, -1.5], [11, -0.5], [11, 0], [2.6, 0], [3, -11], [-3, -11], [-2.6, 0], [-11, 0], [-11, -0.5], [-7.5, -1.5], [-8, -10.5], [-23, -12], [-21, -24], [-18.5, -36], [-19, -41], [-20.5, -47], [-19.5, -60], [-18.5, -72], [-16, -77], [-9, -80.5], [-4, -80]];
    P.moveTo(...coat[0]); coat.forEach(p => P.lineTo(...p)); P.closePath();
    return P; })(),
  girl: (() => { const P = new Path2D(); // short-haired girl, arms crossed, skirt
    smoothPath(P, [[-8, -88], [-10, -97], [-4, -104], [4, -104], [10, -97], [9, -88], [11, -84], [6, -80], [3, -78], [11, -74], [13, -62], [16, -56], [10, -52], [12, -44], [18, -32], [10, -30], [7, -30], [6, 0], [2, 0], [1, -28], [-1, -28], [-2, 0], [-6, 0], [-7, -30], [-18, -32], [-12, -44], [-10, -52], [-16, -56], [-13, -62], [-11, -74], [-3, -78], [-6, -80], [-11, -84]]);
    return P; })(),
  idol: (() => { const P = new Path2D(); // idol with twin tails, mic raised, one leg up
    smoothPath(P, [[-7, -90], [-9, -98], [-3, -103], [4, -103], [9, -97], [8, -90], [14, -92], [22, -80], [20, -62], [16, -70], [12, -82], [7, -80], [11, -76], [18, -86], [22, -96], [25, -94], [20, -82], [13, -68], [12, -55], [16, -36], [6, -34], [10, -18], [18, -16], [18, -12], [6, -14], [2, -32], [-2, -32], [-3, 0], [-7, 0], [-8, -34], [-16, -36], [-11, -55], [-12, -68], [-18, -62], [-20, -80], [-14, -92]]);
    return P; })(),
  boss: (() => { const P = new Path2D(); // broad figure, arm thrown out
    smoothPath(P, [[-8, -90], [-9, -100], [0, -105], [9, -100], [8, -90], [5, -83], [20, -79], [30, -84], [42, -82], [42, -77], [28, -74], [22, -66], [22, -30], [12, -28], [12, 0], [4, 0], [3, -26], [-3, -26], [-4, 0], [-12, 0], [-12, -28], [-22, -30], [-24, -58], [-26, -74], [-20, -80], [-5, -83]]);
    return P; })(),
  ai: (() => { const P = new Path2D(); // slim AI partner in a bodysuit, hand on hip, finger pointing
    smoothPath(P, [[-7, -89], [-9, -96], [-6, -103], [3, -104], [9, -98], [9, -91], [6, -86], [3, -82], [10, -79], [14, -70], [22, -62], [30, -66], [31, -63], [22, -56], [13, -60], [11, -50], [9, -40], [10, -30], [7, 0], [3, 0], [2, -28], [-1, -28], [-3, 0], [-7, 0], [-9, -32], [-12, -42], [-18, -46], [-14, -52], [-10, -50], [-11, -70], [-10, -79], [-3, -82], [-6, -86]]);
    return P; })(),
  doll: (() => { const P = new Path2D(); P.ellipse(0, -70, 16, 15, 0, 0, TAU); smoothPath(P, [[-10, -56], [10, -56], [14, -40], [22, -14], [12, -10], [6, 0], [2, 0], [2, -10], [-2, -10], [-2, 0], [-6, 0], [-12, -10], [-22, -14], [-14, -40]]); return P; })(),
};
function silhouette(name, x, y, hgt, o = {}) {
  const s = hgt / 100;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip || 1), s); if (o.rot) ctx.rotate(o.rot);
  ctx.globalAlpha = o.alpha ?? 1;
  if (o.holo) { // hologram: outline + scanlines
    ctx.save(); ctx.clip(SIL[name]); ctx.fillStyle = `rgba(${o.holo},0.12)`; ctx.fillRect(-60, -120, 120, 130);
    ctx.fillStyle = `rgba(${o.holo},0.35)`; for (let yy = -120; yy < 10; yy += 2.2) ctx.fillRect(-60, yy + (o.t || 0) * 6 % 2.2, 120, 0.6); ctx.restore();
    ctx.shadowColor = `rgb(${o.holo})`; ctx.shadowBlur = 30 * S; ctx.strokeStyle = `rgba(${o.holo},1)`; ctx.lineWidth = 1.4 / s * S * 2.2; ctx.stroke(SIL[name]);
  } else {
    if (o.rim) { ctx.shadowColor = o.rim; ctx.shadowBlur = 40 * S; }
    ctx.fillStyle = o.fill || '#05030a'; ctx.fill(SIL[name]); ctx.shadowBlur = 0;
    if (o.rimLine) { ctx.strokeStyle = o.rimLine; ctx.lineWidth = 1.2; ctx.stroke(SIL[name]); }
  }
  if (name === 'detective' && o.eye !== 0) { // the artificial eye (viewer's right)
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
    const ex = 3, ey = -91; ctx.drawImage(SPR.cyan, ex - 9, ey - 9, 18, 18); ctx.strokeStyle = `rgba(${CYAN},1)`; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, TAU); ctx.stroke(); ctx.drawImage(SPR.white, ex - 1.5, ey - 1.5, 3, 3);
  }
  if (name === 'detective' && o.smoke) { // cigarette ember + smoke
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(SPR.amber, -10.5, -86.5, 5, 5);
    for (let i = 0; i < 8; i++) { const a = ((o.t || 0) * 0.4 + i / 8) % 1; ctx.globalAlpha = (1 - a) * 0.25; ctx.drawImage(SPR.white, -8 + Math.sin(a * 6 + i) * 4 * a - a * 6, -88 - a * 40, 6 + a * 18, 6 + a * 18); }
  }
  if (name === 'idol') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; ctx.drawImage(SPR.mag, 20, -100, 10, 10); }
  ctx.restore();
}

// ───────── dream props ─────────
function mechEye(x, y, r, t, open = 1, o = {}) {
  ctx.save(); ctx.translate(x, y);
  radial(0, 0, r * 2.3, `rgba(${o.col || CYAN},0.25)`);
  ctx.strokeStyle = `rgba(${CYAN},0.7)`; ctx.lineWidth = 2 * S;
  for (let k = 0; k < 3; k++) { ctx.setLineDash([(6 + k * 8) * S, (10 + k * 4) * S]); ctx.beginPath(); ctx.arc(0, 0, r * (1.25 + k * 0.17), t * (k % 2 ? -0.4 : 0.3), t * (k % 2 ? -0.4 : 0.3) + TAU); ctx.stroke(); }
  ctx.setLineDash([]);
  for (let i = 0; i < 72; i++) { const a = i / 72 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12); ctx.lineTo(Math.cos(a) * r * (i % 6 ? 1.16 : 1.22), Math.sin(a) * r * (i % 6 ? 1.16 : 1.22)); ctx.stroke(); }
  ctx.save(); ctx.scale(1, Math.max(0.02, open));
  const P = new Path2D(); P.moveTo(-r, 0); P.quadraticCurveTo(0, -r * 0.9, r, 0); P.quadraticCurveTo(0, r * 0.9, -r, 0);
  ctx.fillStyle = '#04060c'; ctx.fill(P); ctx.save(); ctx.clip(P);
  const lx = noise1(t * 0.5) * r * 0.2, ly = noise1(t * 0.4 + 5) * r * 0.08, ir = r * 0.5;
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, ir); g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, `rgb(${CYAN})`); g.addColorStop(0.6, '#0a5a8a'); g.addColorStop(1, '#03101c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, ir, 0, TAU); ctx.fill();
  const ap = lerp(0.12, 0.42, o.aperture ?? (0.5 + 0.5 * Math.sin(t * 2))); // aperture blades
  ctx.fillStyle = 'rgba(2,6,14,0.92)'; ctx.strokeStyle = `rgba(${CYAN},0.8)`; ctx.lineWidth = 1.5 * S;
  for (let b = 0; b < 8; b++) { const a = b / 8 * TAU + t * 0.6; ctx.beginPath(); ctx.moveTo(lx + Math.cos(a) * ir, ly + Math.sin(a) * ir); ctx.lineTo(lx + Math.cos(a + 0.9) * ir * ap * 1.3, ly + Math.sin(a + 0.9) * ir * ap * 1.3); ctx.lineTo(lx + Math.cos(a + 0.8) * ir, ly + Math.sin(a + 0.8) * ir); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = `rgba(${o.pupil || RED},1)`; ctx.beginPath(); ctx.arc(lx, ly, ir * ap * 0.55, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; spr(SPR.white, lx - ir * 0.3, ly - ir * 0.3, ir * 0.2, 0.9);
  ctx.restore();
  ctx.strokeStyle = `rgba(${MAG},1)`; ctx.lineWidth = 4 * S; ctx.shadowColor = `rgb(${MAG})`; ctx.shadowBlur = 30 * S; ctx.stroke(P); ctx.restore(); ctx.restore();
}
function door(x, y, w, h, open, t, col = AMBER) {
  ctx.save(); ctx.translate(x, y);
  if (open > 0) { const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, `rgba(${col},${0.9 * open})`); g.addColorStop(1, `rgba(255,255,255,${open})`); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h, w, h); ctx.globalCompositeOperation = 'lighter'; spr(SPR.amber, 0, -h / 2, h * 0.9 * open, 0.6 * open); ctx.globalCompositeOperation = 'source-over'; }
  ctx.fillStyle = '#0a0612'; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2 + w * open * 0.85, -h * 0.04 * open); ctx.lineTo(-w / 2 + w * open * 0.85, -h * (1 + 0.04 * open)); ctx.lineTo(-w / 2, -h); ctx.closePath();
  if (open < 1) { ctx.fillRect(-w / 2 + w * open * 0.85, -h, w * (1 - open * 0.85), h); }
  ctx.fill();
  ctx.strokeStyle = `rgba(${MAG},0.9)`; ctx.lineWidth = 3 * S; ctx.shadowColor = `rgb(${MAG})`; ctx.shadowBlur = 20 * S; ctx.strokeRect(-w / 2, -h, w, h); ctx.restore();
}
function clock(x, y, r, t, alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha; ctx.strokeStyle = `rgba(${AMBER},0.9)`; ctx.lineWidth = 3 * S; ctx.shadowColor = `rgb(${AMBER})`; ctx.shadowBlur = 15 * S;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); ctx.stroke(); }
  const hA = -t * 0.8 - PI / 2, mA = -t * 6 - PI / 2; // hands run backwards
  ctx.lineWidth = 5 * S; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(hA) * r * 0.5, Math.sin(hA) * r * 0.5); ctx.stroke();
  ctx.lineWidth = 3 * S; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(mA) * r * 0.8, Math.sin(mA) * r * 0.8); ctx.stroke(); ctx.restore();
}
function stairs(t, alpha = 1) { // endless staircase going nowhere
  const step = 70 * S, rise = 46 * S, off = (t * 1.2) % 1;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.5 + Math.sin(t * 0.2) * 0.1); ctx.globalAlpha = alpha;
  for (let i = -12; i < 14; i++) {
    const k = i - off, x = k * step, y = -k * rise;
    ctx.fillStyle = 'rgba(20,10,40,0.85)'; ctx.fillRect(x, y, step, rise * 3);
    ctx.strokeStyle = `rgba(${i % 4 === 0 ? MAG : VIO},0.9)`; ctx.lineWidth = 2.5 * S; ctx.beginPath(); ctx.moveTo(x, y + rise); ctx.lineTo(x, y); ctx.lineTo(x + step, y); ctx.stroke();
  }
  ctx.restore();
}
function padlock(x, y, s, t, breakT) {
  const age = t - breakT;
  if (age < 0) {
    ctx.save(); ctx.translate(x + noise1(t * 30) * 4 * S * clamp(t - breakT + 3, 0, 3), y); ctx.scale(s, s);
    ctx.strokeStyle = `rgba(${RED},1)`; ctx.lineWidth = 12; ctx.shadowColor = `rgb(${RED})`; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(0, -60, 45, PI, 0); ctx.lineTo(45, -20); ctx.moveTo(-45, -60); ctx.lineTo(-45, -20); ctx.stroke();
    ctx.fillStyle = '#1a0408'; ctx.fillRect(-70, -25, 140, 110); ctx.strokeRect(-70, -25, 140, 110);
    ctx.fillStyle = `rgb(${RED})`; ctx.beginPath(); ctx.arc(0, 18, 14, 0, TAU); ctx.fill(); ctx.fillRect(-5, 18, 10, 34);
    ctx.restore();
  } else if (age < 1.5) { // shattered pieces
    for (let i = 0; i < 26; i++) {
      const a = hash(i) * TAU, v = (300 + 700 * hash(i * 3)) * S, px = x + Math.cos(a) * v * age, py = y + Math.sin(a) * v * age + 900 * S * age * age;
      ctx.save(); ctx.translate(px, py); ctx.rotate(age * 8 * (hash(i * 5) - 0.5)); ctx.globalAlpha = 1 - age / 1.5; ctx.fillStyle = `rgb(${i % 3 ? RED : '255,200,200'})`;
      ctx.fillRect(-12 * s * 4, -6 * s * 4, (8 + 20 * hash(i * 7)) * s * 4, (6 + 14 * hash(i * 9)) * s * 4); ctx.restore();
    }
  }
}
const CITY = (() => { const R = rnd(31), a = []; let x = -200; while (x < 4000) { const w = 40 + R() * 140, h = 120 + R() * 520; a.push({ x, w, h, sd: R() * 999 }); x += w + R() * 14; } return a; })();
function skyline(t, pan, baseY, flip, alpha = 1, col = '#07040e') {
  ctx.save(); ctx.globalAlpha = alpha; if (flip) { ctx.translate(0, H); ctx.scale(1, -1); }
  for (const b of CITY) {
    const x = ((b.x * S - pan) % (4000 * S) + 4000 * S) % (4000 * S) - 200 * S; if (x > W + 20 || x + b.w * S < -20) continue;
    const top = baseY - b.h * S; ctx.fillStyle = col; ctx.fillRect(x, top, b.w * S, H);
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < b.h / 26; r++) for (let c = 0; c < b.w / 16 - 1; c++) { const h = hash(b.sd + r * 13 + c * 7); if (h < 0.8) continue; ctx.fillStyle = `rgba(${h > 0.95 ? CYAN : h > 0.88 ? MAG : AMBER},0.5)`; ctx.fillRect(x + (4 + c * 16) * S, top + (10 + r * 26) * S, 7 * S, 10 * S); }
    if (hash(b.sd) > 0.82) { ctx.fillStyle = `rgba(${hash(b.sd * 3) > 0.5 ? MAG : CYAN},0.85)`; ctx.fillRect(x + b.w * S * 0.3, top + 30 * S, 14 * S, Math.min(b.h, 200) * S * 0.6); }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}
function rain(t, a = 0.3) { ctx.strokeStyle = `rgba(200,220,255,${a})`; ctx.lineWidth = 1.2 * S; ctx.beginPath(); for (let i = 0; i < 150; i++) { const x = (hash(i) * W + t * 80 * S) % W, y = ((hash(i * 3) * H + t * 1800 * S * (0.7 + hash(i * 7) * 0.6)) % (H + 100)) - 50; ctx.moveTo(x, y); ctx.lineTo(x - 5 * S, y + 36 * S); } ctx.stroke(); }
function vortex(t, speed, inten = 1) { // falling into the dream
  bg('#020008', '#070214', '#020008');
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.globalCompositeOperation = 'lighter';
  for (let k = 26; k >= 1; k--) {
    const z = (k - (t * speed) % 1) * 0.5, s = 1 / z, r = Math.min(W, H) * 0.32 * s, rot = t * 0.5 + k * 0.22;
    ctx.strokeStyle = `rgba(${k % 3 === 0 ? RED : k % 3 === 1 ? MAG : CYAN},${clamp(1 - z / 13) * 0.8 * inten})`; ctx.lineWidth = Math.max(1, 5 * S * s * 0.5);
    ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = rot + i / 6 * TAU; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke();
  }
  for (let i = 0; i < 80; i++) { const a = hash(i) * TAU + t * 0.3, z = ((hash(i * 3) - t * speed * 0.2) % 1 + 1) % 1, d = (1 - z) * Math.max(W, H) * 0.8; spr(i % 2 ? SPR.mag : SPR.cyan, Math.cos(a) * d, Math.sin(a) * d, (2 + 8 * (1 - z)) * S, (1 - z)); }
  ctx.restore();
  spr(SPR.white, W / 2, H / 2, 120 * S, 0.7 * inten);
}
function kaleido(drawFn, t, n = 6) { // draw scene into buffer, mirror into wedges
  BX.setTransform(1, 0, 0, 1, 0, 0); BX.globalCompositeOperation = 'source-over'; BX.globalAlpha = 1;
  const keep = ctx; drawFn(); BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0); BX.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const R = Math.hypot(W, H) / 2;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(t * 0.15);
  for (let i = 0; i < n; i++) {
    ctx.save(); ctx.rotate(i / n * TAU); if (i % 2) ctx.scale(1, -1);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -PI / n - 0.01, PI / n + 0.01); ctx.closePath(); ctx.clip();
    ctx.drawImage(BUF, -W / 2 + Math.sin(t * 0.3) * 100 * S, -H / 2); ctx.restore();
  }
  ctx.restore();
}
function timer(t, secs, x, y, size, alarm = 0) {
  const m = Math.floor(Math.max(0, secs) / 60), s = Math.floor(Math.max(0, secs) % 60), cs = Math.floor((Math.max(0, secs) % 1) * 100);
  const str = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, red = secs < 60 || alarm;
  txt(str, x, y, { font: F.mono(size), fill: red && Math.floor(t * 4) % 2 ? `rgb(${RED})` : '#ffffff', glow: `rgba(${red ? RED : CYAN},0.9)`, blur: 25, rgb: 3 * S });
  txt(`.${String(cs).padStart(2, '0')}`, x + size * 1.55, y + size * 0.2, { font: F.mono(size * 0.4), fill: `rgba(${CYAN},0.9)` });
  txt('SOMNIUM TIME LIMIT', x, y - size * 0.75, { font: F.mono(size * 0.18), ls: 4 * S, fill: `rgba(${MAG},0.9)` });
}

// ───────── text ─────────
const F = { unb: s => `800 ${s}px Unb`, unbL: s => `400 ${s}px UnbL`, gl: s => `${s}px Glitch`, serif: s => `italic 600 ${s}px Serif`, mono: s => `700 ${s}px Mono` };
function fit(str, font, size, maxW, ls = 0) { ctx.font = font(size); ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(str).width; return w > maxW ? size * maxW / w : size; }
function txt(str, x, y, o = {}) {
  ctx.save(); ctx.font = o.font; ctx.letterSpacing = (o.ls || 0) + 'px'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
  ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.sx || o.sc) ctx.scale((o.sc || 1) * (o.sx || 1), (o.sc || 1) * (o.sy || 1));
  const a = clamp(o.alpha ?? 1);
  if (o.rgb) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.75; ctx.fillStyle = `rgb(${CYAN})`; ctx.fillText(str, -o.rgb, 0); ctx.fillStyle = `rgb(${MAG})`; ctx.fillText(str, o.rgb, o.rgb * 0.3); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = a; if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = (o.blur || 30) * S; }
  if (o.stroke) { ctx.lineWidth = o.lw || 6 * S; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, 0, 0); }
  if (o.fill !== 'none') { ctx.fillStyle = o.fill || '#fff'; ctx.fillText(str, 0, 0); }
  ctx.restore();
}

// ───────── lyrics: bottom typewriter line + chaotic fragments ─────────
const SPEAK = {};
let cur = 'DATE';
LY.forEach((l, i) => { if (/Female/.test(l.t) || /Pre-Chorus|Verse 3/.test(l.t)) cur = 'AIBA'; if (/\(Male\)|Verse 1|Verse 2/.test(l.t)) cur = 'DATE'; if (/Chorus - Both|Final Chorus/.test(l.t)) cur = 'BOTH'; SPEAK[i] = cur; });
const LINES = LY.map((l, i) => ({ ...l, i, sp: SPEAK[i] })).filter(l => !l.t.startsWith('[')).map(l => ({ ...l, t: l.t.replace(/\((Fe)?male\)\s*/gi, '') }));
LINES.forEach((L, k) => {
  if (L.e <= L.s) L.e = LINES[k + 1] ? LINES[k + 1].s : L.s + 3;
  const words = L.t.split(/\s+/).filter(Boolean), dur = L.e - L.s, span = dur > 6 ? Math.min(dur * 0.55, 4.5) : dur * 0.88;
  const wts = words.map(w => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.5), tot = wts.reduce((a, b) => a + b, 0);
  let acc = 0; L.words = words.map((w, j) => { const r = { w, t: L.s + acc / tot * span, j }; acc += wts[j]; return r; });
  L.span = span;
});
const FRAG = []; // chaotic fragments spawned from words
const MODES = ['zoom', 'tilt', 'tilt', 'stack', 'mirror', 'outline', 'tilt', 'zoom', 'stretch'];
LINES.forEach(L => L.words.forEach(w => {
  const clean = w.w.replace(/[.,!?…:;«»—]/g, ''); if (!clean) return;
  const chorus = /SOMNUS/.test(L.t), caps = clean.length > 2 && clean === clean.toUpperCase();
  if (!(caps || clean.length >= 5 || chorus || hash(L.i * 7 + w.j) > 0.6)) return;
  const h = hash(L.i * 13.7 + w.j * 3.1);
  FRAG.push({ str: caps ? clean : clean.toUpperCase(), t: w.t, end: Math.min(L.e + 0.6, w.t + 3.5), mode: caps ? 'zoom' : MODES[Math.floor(h * MODES.length)], h, li: L.i, caps });
}));
const COLS = [MAG, CYAN, WHITE, RED, VIO];
const FONTS = [F.unb, F.unb, F.gl, F.serif, F.unbL];
function drawFrag(f, t) {
  const age = t - f.t, life = f.end - f.t; if (age < 0 || age > life) return;
  const out = 1 - ss(life - 0.35, life, age), col = COLS[Math.floor(f.h * 97) % COLS.length], font = f.caps ? F.unb : FONTS[Math.floor(f.h * 53) % FONTS.length];
  const hx = hash(f.h * 31), hy = hash(f.h * 57), rot = (hash(f.h * 91) - 0.5) * 1.1;
  if (f.mode === 'zoom') { // grows to fill the screen and passes through the camera
    const k = age / 0.9, sz = fit(f.str, font, 400 * S, W * 0.92, 4 * S), sc = lerp(0.25, 1.6, eIn(k) * 0.4 + eOut(k) * 0.6);
    txt(f.str, W / 2, H / 2, { font: font(sz), ls: 4 * S, fill: `rgb(${col})`, sc, rot: rot * 0.25, rgb: 8 * S, glow: `rgba(${col},0.8)`, alpha: out * (1 - ss(0.75, 1, k)) * 0.95 });
  } else if (f.mode === 'tilt') {
    const sz = fit(f.str, font, (90 + 90 * hy) * S, W * 0.7), k = eOut(age / 0.18);
    txt(f.str, W * (0.15 + 0.7 * hx) + age * 20 * S, H * (0.15 + 0.55 * hy), { font: font(sz), fill: `rgb(${col})`, rot, sc: lerp(1.8, 1, k), glow: `rgba(${col},0.7)`, rgb: (1 - k) * 20 * S + 2 * S, alpha: out * 0.9 });
  } else if (f.mode === 'stack') { // vertical along a screen edge
    const sz = fit(f.str, font, 120 * S, H * 0.8), x = hx > 0.5 ? W - 90 * S : 90 * S;
    txt(f.str, x, H / 2 + (1 - eOut(age / 0.3)) * H * 0.6 * (hy > 0.5 ? 1 : -1), { font: font(sz), fill: `rgb(${col})`, rot: hx > 0.5 ? PI / 2 : -PI / 2, glow: `rgba(${col},0.8)`, alpha: out * 0.8 });
  } else if (f.mode === 'mirror') {
    const sz = fit(f.str, font, 130 * S, W * 0.8), y = H * (0.25 + 0.4 * hy), k = eOut(age / 0.25);
    txt(f.str, W / 2, y, { font: font(sz), fill: `rgb(${col})`, sx: lerp(0.1, 1, k), glow: `rgba(${col},0.7)`, alpha: out });
    txt(f.str, W / 2, y + sz * 1.05, { font: font(sz), fill: `rgba(${col},0.3)`, sx: lerp(0.1, 1, k), sy: -1, alpha: out });
  } else if (f.mode === 'outline') {
    const sz = fit(f.str, F.unb, 330 * S, W * 0.98);
    txt(f.str, W / 2 + noise1(t + f.h * 9) * 30 * S, H * (0.3 + 0.4 * hy), { font: F.unb(sz), fill: 'none', stroke: `rgba(${col},0.55)`, lw: 2.5 * S, rot: rot * 0.3, sc: 1 + age * 0.05, alpha: out });
  } else if (f.mode === 'stretch') {
    const sz = fit(f.str, F.unb, 160 * S, W * 0.5);
    txt(f.str, W / 2, H * (0.2 + 0.6 * hy), { font: F.unb(sz), fill: `rgba(${col},0.35)`, sx: lerp(4, 2, eOut(age / 0.5)), sy: 0.5, alpha: out });
  }
}
function bottomLine(L, t) {
  const lt = t - L.s, out = 1 - ss(L.e - 0.1, L.e + 0.2, t); if (out <= 0 || lt < 0) return;
  const n = Math.min(L.t.length, Math.floor(clamp(lt / Math.max(0.3, L.span)) * L.t.length) + 1);
  const tag = L.sp === 'AIBA' ? 'AIBA ▸' : L.sp === 'BOTH' ? 'PSYNC ▸' : 'DATE ▸', tc = L.sp === 'AIBA' ? MAG : L.sp === 'BOTH' ? RED : CYAN;
  const maxW = W * (PORT ? 0.84 : 0.8), y = H * (PORT ? 0.86 : 0.88), x0 = W * (PORT ? 0.08 : 0.1);
  let sz = fit(L.t + '█', F.mono, (PORT ? 40 : 40) * S, maxW);
  const lines = []; if (PORT && sz < 30 * S) { const mid = L.t.lastIndexOf(' ', Math.floor(L.t.length / 2) + 4); lines.push(L.t.slice(0, mid), L.t.slice(mid + 1)); sz = Math.max(fit(lines[0] + '█', F.mono, 40 * S, maxW), 1) && Math.min(fit(lines[0] + '█', F.mono, 40 * S, maxW), fit(lines[1] + '█', F.mono, 40 * S, maxW)); } else lines.push(L.t);
  ctx.save(); ctx.globalAlpha = out * 0.75; ctx.fillStyle = 'rgba(4,2,12,0.7)'; ctx.fillRect(x0 - 20 * S, y - sz * 1.6, maxW + 40 * S, sz * (lines.length * 1.35 + 1.4)); ctx.fillStyle = `rgba(${tc},0.9)`; ctx.fillRect(x0 - 20 * S, y - sz * 1.6, 5 * S, sz * (lines.length * 1.35 + 1.4)); ctx.restore();
  txt(tag, x0, y - sz * 0.95, { font: F.mono(sz * 0.55), align: 'left', fill: `rgb(${tc})`, alpha: out, ls: 3 * S });
  let left = n;
  lines.forEach((ln, r) => {
    const show = ln.slice(0, Math.max(0, left)); left -= ln.length + 1;
    const cursor = (left < 0 && left > -ln.length - 2) && Math.floor(t * 3) % 2 ? '█' : '';
    txt(show + cursor, x0, y + r * sz * 1.3, { font: F.mono(sz), align: 'left', fill: '#ffffff', glow: `rgba(${tc},0.7)`, blur: 12, alpha: out });
  });
}

// ───────── scenes ─────────
const SOMNUS = [[88.17, 110.35], [169.71, 193.4]];
function somniumSecs(t) { for (const [a, b] of SOMNUS) if (t >= a && t < b) return 360 - (t - a) * (360 / (b - a)); return null; }
function dossier(t, a) {
  bg('#020308', '#050812', '#020308'); smoke(t, 0.25, 10);
  const cx = PORT ? W / 2 : W * 0.3, cy = PORT ? H * 0.38 : H * 0.55, hgt = (PORT ? 900 : 780) * S;
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = `rgba(${CYAN},0.6)`; ctx.lineWidth = 2 * S; ctx.strokeRect(cx - hgt * 0.35, cy - hgt * 0.62, hgt * 0.7, hgt * 1.2);
  ctx.restore();
  silhouette('detective', cx, cy + hgt * 0.55, hgt, { rim: `rgba(${CYAN},0.8)`, fill: '#060a14', alpha: a, smoke: true, t });
  const sy = cy - hgt * 0.6 + ((t * 0.35) % 1) * hgt * 1.2; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${CYAN},${0.3 * a})`; ctx.fillRect(cx - hgt * 0.35, sy, hgt * 0.7, 3 * S); ctx.restore();
  const tx = PORT ? W * 0.1 : W * 0.55, ty = PORT ? H * 0.7 : H * 0.3, items = [['SUBJECT', 'KANAME DATE', 3.6], ['UNIT', 'ABIS // INVESTIGATOR', 5.0], ['LEFT EYE', 'MISSING', 6.6], ['IMPLANT', 'AI-BALL «AIBA»', 9.4], ['STATUS', 'PSYNC READY', 11.5]];
  items.forEach(([k, v, t0], i) => { const n = Math.floor((t - t0) * 30); if (n <= 0) return; txt(k, tx, ty + i * 62 * S, { font: F.mono(20 * S), align: 'left', fill: `rgba(${MAG},0.9)`, alpha: a }); txt(v.slice(0, n), tx + 170 * S, ty + i * 62 * S, { font: F.mono(32 * S), align: 'left', fill: i === 2 ? `rgb(${RED})` : '#fff', glow: `rgba(${CYAN},0.6)`, blur: 10, alpha: a }); });
  if (t > 6.6) { const ex = cx + 3 * hgt / 100, ey = cy + hgt * 0.55 - 91 * hgt / 100; ctx.strokeStyle = `rgba(${RED},${a})`; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.arc(ex, ey, 26 * S, 0, TAU); ctx.moveTo(ex + 26 * S, ey); ctx.lineTo(tx - 20 * S, ty + 2 * 62 * S); ctx.stroke(); }
}
function crime(t) { // Tokyo night, rain, red light, chalk outline
  bg('#04030a', '#0b0614', '#120509'); skyline(t, t * 15 * S, H * 0.62, false, 0.9);
  ctx.fillStyle = '#07050c'; ctx.fillRect(0, H * 0.62, W, H);
  ctx.save(); ctx.translate(W / 2, H * 0.8); ctx.scale(1, 0.32); ctx.strokeStyle = 'rgba(240,240,255,0.75)'; ctx.lineWidth = 6 * S; ctx.setLineDash([22 * S, 10 * S]);
  ctx.stroke(new Path2D(`M ${-260 * S} 0 Q ${-200 * S} ${-120 * S} ${-60 * S} ${-90 * S} L ${20 * S} ${-160 * S} Q ${60 * S} ${-200 * S} ${90 * S} ${-140 * S} L ${60 * S} ${-60 * S} Q ${200 * S} ${-40 * S} ${280 * S} ${40 * S} Q ${160 * S} ${80 * S} ${40 * S} ${40 * S} Q ${-60 * S} ${140 * S} ${-200 * S} ${110 * S} Z`)); ctx.restore();
  radial(W / 2, H * 0.8, 500 * S, `rgba(${RED},${0.35 + 0.2 * Math.sin(t * 6)})`); radial(W * 0.2, H * 0.3, 600 * S, `rgba(60,90,255,${0.25 + 0.2 * Math.sin(t * 6 + PI)})`);
  rain(t, 0.35);
}
function tokyo(t, dream) {
  bg('#03020a', '#0c0518', '#1a0414'); smoke(t, 0.3);
  skyline(t, t * 30 * S, H * 0.7, false, 1);
  if (dream > 0) skyline(t, -t * 20 * S, H * 0.7 * (1 + 0.1 * (1 - dream)), true, dream * 0.9, '#0a0614');
  ctx.fillStyle = 'rgba(8,4,14,0.9)'; ctx.fillRect(0, H * 0.7, W, H);
  for (let i = 0; i < 9; i++) { const x = ((hash(i) * W + t * 60 * S) % (W + 200 * S)) - 100 * S; ctx.fillStyle = `rgba(${i % 2 ? MAG : CYAN},0.06)`; ctx.fillRect(x, H * 0.7, 30 * S, H * 0.3); } // neon reflections
  rain(t, 0.25 * (1 - dream * 0.5));
}
function dreamField(t, inten) { // floating doors, clocks, threads
  const n = 5; for (let i = 0; i < n; i++) {
    const z = 0.5 + hash(i * 3) * 0.8, x = W * (0.1 + 0.8 * hash(i)) + Math.sin(t * 0.3 + i) * 60 * S, y = H * (0.3 + 0.5 * hash(i * 7)) + Math.cos(t * 0.4 + i * 2) * 50 * S;
    const open = clamp(Math.sin(t * 0.8 + i * 1.7) * 0.5 + 0.5 + beat(t) * 0.2);
    if (i % 2) door(x, y, 140 * S * z, 260 * S * z, open * inten, t); else clock(x, y - 100 * S, 80 * S * z, t + i, inten);
  }
}

const SEC = [
  { s: 0, e: 3.43, bg: t => { bg('#000', '#020108', '#000'); smoke(t, 0.15 * ss(1, 3.4, t)); }, gl: 0.1, wob: 0, hud: 0 },
  { s: 3.43, e: 14.2, bg: t => dossier(t, ss(3.43, 4.2, t)), gl: 0.2, wob: 0, hud: 0.6 },
  { s: 14.2, e: 20.4, bg: t => { crime(t); ctx.globalAlpha = 1 - ss(14.2, 15.5, t); dossier(t, 1 - ss(14.2, 15.5, t)); ctx.globalAlpha = 1; }, gl: 0.3, wob: 0, hud: 0.6 },
  { s: 20.4, e: 37.58, bg: t => { vortex(t, 1.6 + 2 * ss(20.4, 22, t), 1); threads(t, 8, { seed: 3, tighten: 0.3 }); titleCard(t); }, gl: 0.8, wob: 0.6, hud: 0.8 },
  { s: 37.58, e: 52.5, bg: t => { tokyo(t, 0); silhouette('detective', W * (PORT ? 0.5 : 0.78), H * 0.98, H * (PORT ? 0.5 : 0.72), { rim: `rgba(${MAG},0.7)`, smoke: true, t }); }, gl: 0.6, wob: 0.05, hud: 1 },
  { s: 52.5, e: 72.37, bg: t => { const d = ss(52.5, 60, t); tokyo(t, d); threads(t, Math.floor(3 + 6 * d), { seed: 9, alpha: 0.4 + 0.6 * d }); if (t > 63.59) dreamField(t, ss(63.59, 66, t)); silhouette('detective', W * (PORT ? 0.5 : 0.22), H * 0.98, H * (PORT ? 0.48 : 0.7), { rim: `rgba(${CYAN},0.8)`, rot: Math.sin(t * 0.5) * 0.05 * d }); }, gl: 0.7, wob: 0.35, hud: 1 },
  { s: 72.37, e: 88.17, bg: t => { bg('#05020c', '#0d0420', '#05020c'); smoke(t, 0.4); const r = Math.min(W, H) * (PORT ? 0.34 : 0.3); mechEye(W / 2, H * (PORT ? 0.36 : 0.45), r, t, ss(72.4, 73.4, t), { aperture: 0.4 + 0.6 * kick(t, 5) }); silhouette('ai', W * (PORT ? 0.5 : 0.8), H * 0.98, H * (PORT ? 0.42 : 0.62), { holo: MAG, t, alpha: ss(73, 74.5, t) }); threads(t, 4, { seed: 13, alpha: 0.6 }); }, gl: 0.5, wob: 0.2, hud: 1 },
  { s: 88.17, e: 110.35, bg: t => { kaleido(() => { tokyo(t, 1); dreamField(t, 1); threads(t, 6, { seed: 17 }); }, t, 6); chorusFigure(t); }, gl: 1, wob: 0.5, hud: 1, timer: true },
  { s: 110.35, e: 122.39, bg: t => gallery(t), gl: 0.8, wob: 0.2, hud: 1 },
  { s: 122.39, e: 134.28, bg: t => { bg('#05020e', '#120626', '#05020e'); smoke(t, 0.35); stairs(t, 1); clock(W * 0.25, H * 0.3, 120 * S, t * 2, 1); clock(W * 0.78, H * 0.62, 90 * S, t * 3 + 2, 1);
      if (t > 125.5) silhouette('doll', W * (PORT ? 0.5 : 0.62), H * 0.66, 260 * S, { rim: `rgba(${RED},0.8)`, alpha: ss(125.5, 126, t) * (1 - ss(128, 128.4, t)) });
      if (t > 128.0) padlock(W / 2, H / 2, 1.6 * S, t, 129.9); if (t > 129.9) { threads(t, 10, { seed: 23, alpha: 1 - ss(131, 134, t) * 0.5, tighten: 0.5 }); radial(W / 2, H / 2, 800 * S, `rgba(255,240,255,${0.6 * Math.exp(-(t - 129.9) * 2)})`); } }, gl: 0.8, wob: 0.6, hud: 1 },
  { s: 134.28, e: 157.74, bg: t => duo(t), gl: 0.6, wob: 0.15, hud: 1 },
  { s: 157.74, e: 169.71, bg: t => { vortex(t, 1.2, 0.7); threads(t, 12, { seed: 29, tighten: 0.6 * ss(160, 169, t) }); door(W / 2, H * 0.78, 300 * S, 560 * S, ss(165.2, 168, t), t); }, gl: 1.1, wob: 0.5, hud: 1 },
  { s: 169.71, e: 193.4, bg: t => { kaleido(() => { vortex(t, 2.2, 1); threads(t, 10, { seed: 31 }); dreamField(t, 1); }, t, 8); chorusFigure(t); }, gl: 1.3, wob: 0.6, hud: 1, timer: true },
  { s: 193.4, e: 999, bg: t => outro(t), gl: 0.5, wob: 0.15, hud: 1 },
];
function chorusFigure(t) { const h = H * (PORT ? 0.48 : 0.7); silhouette('detective', W / 2, H * 0.98, h, { rim: `rgba(${RED},0.9)`, smoke: true, t }); silhouette('ai', W / 2 + h * 0.32, H * 0.98, h * 0.92, { holo: MAG, t, alpha: 0.85 }); }
function gallery(t) { // the cast, connected by red strings on an evidence board
  bg('#06030c', '#100616', '#06030c'); smoke(t, 0.3);
  const g = [[110.35, 'girl', 0.2, MAG], [113.54, 'idol', 0.45, CYAN], [114.9, 'boss', 0.7, AMBER], [117.21, 'mask', 0.85, RED], [120.08, 'detective', 0.5, CYAN]];
  const pts = [];
  g.forEach(([t0, name, fx, col], i) => {
    if (t < t0) return; const k = eOut((t - t0) / 0.3), x = PORT ? W * (0.2 + (i % 3) * 0.3) : W * fx, y = PORT ? H * (0.42 + Math.floor(i / 3) * 0.3) : H * 0.75, h = H * (PORT ? 0.24 : 0.5);
    if (name === 'mask') maskFace(x, y - h * 0.5, h * 0.35, t, k); else silhouette(name, x, y + (1 - k) * 200 * S, h, { rim: `rgba(${col},0.9)`, smoke: name === 'detective', t, alpha: k });
    pts.push([x, y - h * 0.85]);
    if (name === 'boss') for (let p = 0; p < 10; p++) { const a = (t - t0) * 1.4 + p, px = x + Math.cos(a * 1.3 + p) * 160 * S + (t - t0) * 60 * S * (hash(p) - 0.5), py = y - h * 0.7 - 80 * S + ((t - t0) * 90 * S * (0.5 + hash(p * 3))) % (h * 0.8); ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = 'rgba(240,235,220,0.85)'; ctx.fillRect(-28 * S, -36 * S, 56 * S, 72 * S); ctx.restore(); }
  });
  connect(pts, t, 0.9);
}
function maskFace(x, y, r, t, a) { // smiling mask: "smiles by day, cuts by night"
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a; ctx.fillStyle = '#f2ece4'; ctx.shadowColor = `rgb(${RED})`; ctx.shadowBlur = 40 * S;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#000';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * r * 0.3, -r * 0.2, r * 0.16, r * 0.07, sx * 0.3, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#000'; ctx.lineWidth = 6 * S; ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.45, 0.15 * PI, 0.85 * PI); ctx.stroke();
  ctx.strokeStyle = `rgb(${RED})`; ctx.lineWidth = 4 * S; ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.9); ctx.lineTo(-r * 0.6, r * 0.8); ctx.stroke(); ctx.restore();
}
function duo(t) {
  bg('#04030c', '#0a0618', '#04030c'); smoke(t, 0.35);
  const together = ss(151.28, 153, t), h = H * (PORT ? 0.46 : 0.7), dx = lerp(PORT ? 0.3 : 0.32, 0.12, together) * W;
  silhouette('detective', W / 2 - dx, H * 0.98, h, { rim: `rgba(${CYAN},0.9)`, smoke: true, t });
  silhouette('ai', W / 2 + dx, H * 0.98, h * 0.94, { holo: MAG, t, flip: -1 });
  if (t > 140.19 && t < 146.17) timer(t, 3 - (t - 140.19) * 0.5, W / 2, H * 0.22, 110 * S, 1);
  if (t > 146.17 && t < 151.28) { ctx.save(); for (let i = 0; i < 6; i++) { const p = Math.floor(hash(i + Math.floor(t * 6)) * 100); txt(`${p}%`, W * (0.2 + 0.12 * i) + (PORT ? 0 : 0), H * (0.18 + 0.06 * (i % 3)), { font: F.mono(48 * S), fill: i % 2 ? `rgb(${CYAN})` : `rgb(${MAG})`, glow: `rgba(${CYAN},0.6)`, alpha: 0.85 }); } ctx.restore(); }
  if (together > 0) { threads(t, 6, { seed: 41, alpha: together, cx: W / 2, cy: H * 0.55, span: 0.6 }); radial(W / 2, H * 0.6, 700 * S, `rgba(${RED},${0.3 * together})`); }
}
function titleCard(t) {
  const a = win(t, 25.5, 37.3, 0.4, 0.5); if (a <= 0) return;
  const s1 = 'SOMNUS', s2 = 'FILES', sz = fit(s1, F.unb, 260 * S, W * 0.86, 20 * S);
  const g = Math.floor(t * 12);
  txt(s1, W / 2 + (hash(g) - 0.5) * 12 * S * kick(t), H * 0.45, { font: F.unb(sz), ls: 20 * S, fill: '#fff', rgb: (6 + 12 * kick(t)) * S, glow: `rgba(${MAG},0.9)`, alpha: a });
  txt(s2, W / 2, H * 0.45 + sz * 0.95, { font: F.serif(sz * 0.9), ls: 30 * S, fill: `rgb(${RED})`, glow: `rgba(${RED},0.9)`, alpha: a });
  txt('UMBRA01', W / 2, H * 0.45 + sz * 1.75, { font: F.mono(28 * S), ls: 16 * S, fill: `rgb(${CYAN})`, alpha: a * ss(28, 29, t) });
}
function outro(t) {
  bg('#020108', '#060312', '#020108'); smoke(t, 0.25);
  const close = ss(203.3, 205.6, t) * (1 - ss(208, 208.4, t)) + ss(211.8, 213.5, t);
  const r = Math.min(W, H) * 0.3; mechEye(W / 2, H * 0.42, r, t, 1 - clamp(close), { pupil: RED });
  if (t < 203.4) { const n = Math.floor((t - 193.4) * 18); ['PSYNC COMPLETE', 'DATA SAVED ✓', 'CASE FILE #' + (4000 + Math.floor(t * 0)) + ' // ARCHIVED'].forEach((s, i) => txt(s.slice(0, Math.max(0, n - i * 14)), W / 2, H * (PORT ? 0.66 : 0.75) + i * 50 * S, { font: F.mono(36 * S), fill: i ? `rgb(${CYAN})` : '#fff', glow: `rgba(${CYAN},0.8)`, blur: 14 })); }
  if (t > 208 && t < 212) threads(t, 10, { seed: 51, alpha: 1 - ss(211, 212, t) });
  const a = ss(212.2, 212.8, t); if (a > 0) { const sz = fit('SOMNUS FILES', F.unb, 150 * S, W * 0.86, 10 * S); txt('SOMNUS FILES', W / 2, H / 2, { font: F.unb(sz), ls: 10 * S, fill: '#fff', glow: `rgba(${MAG},0.9)`, rgb: 4 * S, alpha: a }); txt('UMBRA01', W / 2, H / 2 + sz, { font: F.mono(28 * S), ls: 16 * S, fill: `rgb(${CYAN})`, alpha: a }); }
}

// ───────── HUD ─────────
function hud(t, sec, lvl) {
  if (lvl <= 0.01) return;
  ctx.save(); ctx.globalAlpha = lvl; const m = 34 * S, L = 54 * S, c = `rgba(${CYAN},0.85)`;
  ctx.strokeStyle = c; ctx.lineWidth = 2.5 * S;
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke(); }
  ctx.font = F.mono(17 * S); ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = c;
  const st = somniumSecs(t) !== null ? 'IN SOMNIUM' : t > 20.4 && t < 37.58 ? 'PSYNC: DIVING' : 'REALITY';
  ctx.fillText('ABIS // PSYNC LINK', m + 14 * S, m + 12 * S); ctx.fillStyle = `rgba(${MAG},0.95)`; ctx.fillText(`STATE: ${st}`, m + 14 * S, m + 36 * S);
  ctx.textAlign = 'right'; ctx.fillStyle = c; const mm = Math.floor(t / 60); ctx.fillText(`REC ${String(mm).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`, W - m - 14 * S, m + 12 * S);
  ctx.fillText(`SYNC ${Math.round(60 + 40 * As('rms', t))}%`, W - m - 14 * S, m + 36 * S);
  // brainwave line
  ctx.strokeStyle = `rgba(${MAG},0.7)`; ctx.lineWidth = 2 * S; ctx.beginPath(); const bw = W * 0.28, bx = W - m - bw, by = m + 80 * S;
  for (let i = 0; i <= 80; i++) { const x = bx + i / 80 * bw, v = Math.sin(i * 0.5 + t * 8) * 0.5 + noise1(i * 0.3 + t * 5) * (0.5 + A('mid', t)); i ? ctx.lineTo(x, by + v * 16 * S) : ctx.moveTo(x, by + v * 16 * S); } ctx.stroke();
  ctx.restore();
  const secs = somniumSecs(t); if (secs !== null) timer(t, secs, W / 2, PORT ? H * 0.11 : H * 0.1, (PORT ? 86 : 70) * S, secs < 30);
}

// ───────── post FX ─────────
function rgbSplit(amt) { if (amt < 0.6) return; BX.setTransform(1, 0, 0, 1, 0, 0); BX.globalAlpha = 1; BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0); BX2.globalCompositeOperation = 'copy'; BX2.drawImage(BUF, 0, 0); BX2.globalCompositeOperation = 'multiply'; BX2.fillStyle = '#ff0000'; BX2.fillRect(0, 0, W, H); BX.globalCompositeOperation = 'multiply'; BX.fillStyle = '#00ffff'; BX.fillRect(0, 0, W, H); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(BUF, -amt, 0); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(BUF2, amt, 0); ctx.restore(); }
function slices(t, amt) { if (amt < 0.04) return; BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0); const f = Math.floor(t * 20), n = Math.floor(3 + amt * 12); for (let i = 0; i < n; i++) { const y = hash(f * 13 + i) * H, h = (6 + hash(f * 7 + i * 3) * 80 * amt) * S, dx = (hash(f * 3 + i * 11) - 0.5) * 260 * amt * S; ctx.drawImage(BUF, 0, y, W, h, dx, y, W, h); } }
function wobble(t, amt) { // dream: liquid horizontal waves
  if (amt < 0.02) return; BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const sh = 6; for (let y = 0; y < H; y += sh) { const dx = Math.sin(y * 0.012 + t * 3) * 18 * S * amt + Math.sin(y * 0.031 - t * 5) * 6 * S * amt; ctx.drawImage(BUF, 0, y, W, sh, dx, y, W, sh); }
}
function zoomBlur(amt) { if (amt < 0.05) return; BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 1; i <= 3; i++) { const s = 1 + i * 0.03 * amt; ctx.globalAlpha = 0.18 * amt; ctx.drawImage(BUF, W / 2 - W * s / 2, H / 2 - H * s / 2, W * s, H * s); } ctx.restore(); }
const HITS = [[20.43, 1.2, 'i'], [37.58, 0.8, 'f'], [52.5, 0.6, 'f'], [72.37, 0.7, 'f'], [88.17, 1.4, 'i'], [110.35, 0.9, 'f'], [129.9, 1.2, 'i'], [134.28, 0.7, 'f'], [157.74, 0.8, 'f'], [169.71, 1.5, 'i'], [193.4, 1, 'f'], [208.05, 1, 'i'], [212.2, 1, 'f']];
function hitAmt(t) { let f = 0, inv = 0; for (const [h, s, k] of HITS) if (t >= h && t < h + 1.5) { f += s * Math.exp(-(t - h) * 6); if (k === 'i' && t - h < 0.07) inv = 1; } return [f, inv]; }

window.renderFrame = function (t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const sec = SEC.find(s => t >= s.s && t < s.e) || SEC[SEC.length - 1];
  const k = kick(t), b = beat(t), [hf, inv] = hitAmt(t), g = sec.gl;
  const shake = (k * 7 * g + hf * 20) * S, zoom = 1.03 + 0.02 * k * g + 0.04 * hf;
  ctx.save(); ctx.translate(W / 2 + noise1(t * 33) * shake, H / 2 + noise1(t * 29 + 7) * shake); ctx.rotate(noise1(t * 7 + 3) * 0.004 * g + Math.sin(t * 0.7) * 0.02 * sec.wob); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
  sec.bg(t);
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  wobble(t, sec.wob * (0.6 + 0.4 * As('rms', t)));
  slices(t, g * 0.5 * k + hf * 0.4);
  hud(t, sec, sec.hud);
  for (const f of FRAG) if (t >= f.t && t < f.end) drawFrag(f, t);
  for (const L of LINES) if (t >= L.s && t < L.e + 0.25) bottomLine(L, t);
  zoomBlur(hf * 0.8 + (sec.wob > 0.4 ? 0.3 * k : 0));
  if (hf > 0.02) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,250,${clamp(hf * 0.4)})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  rgbSplit((2 + 9 * k * g + 18 * hf) * S);
  if (inv) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  ctx.fillStyle = SCAN; ctx.fillRect(0, 0, W, H); ctx.drawImage(VIGN, 0, 0);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.06; ctx.fillStyle = GRAIN[Math.floor(t * 24) % 3]; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const fade = Math.max(1 - ss(0, 1.2, t), ss(214.0, 214.8, t)); if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
};
window.DURATION = DUR;
window.ready = Promise.all(['800 60px Unb', '400 60px UnbL', '60px Glitch', 'italic 600 60px Serif', '700 60px Mono'].map(f => document.fonts.load(f, 'АZ01'))).then(() => true);
})();
