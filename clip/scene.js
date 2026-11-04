/* Procedural music video renderer.
 * Everything is a pure function of time t (seconds) so frames can be rendered
 * in any order / in parallel. window.renderFrame(t) draws one 1920x1080 frame. */
(() => {
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const W = 1920, H = 1080, FPS = 30;
const D = window.AUDIO, LY = window.LYRICS;

// ───────────────────────── math helpers ─────────────────────────
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const eOut = k => 1 - Math.pow(1 - clamp(k), 3);
const eIn = k => Math.pow(clamp(k), 3);
const win = (t, a, b, fi = 0.3, fo = 0.3) => ss(a, a + fi, t) * (1 - ss(b - fo, b, t));
const PI = Math.PI, TAU = PI * 2;
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function rnd(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }

// ───────────────────────── audio helpers ─────────────────────────
function A(key, t) { const a = D[key]; return a[clamp(Math.floor(t * FPS), 0, a.length - 1)] || 0; }
function As(key, t, w = 3) { let s = 0; for (let k = -w; k <= w; k++) s += A(key, t + k / FPS); return s / (2 * w + 1); }
function lastIdx(arr, t) { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
function pulse(arr, t, decay = 6) { const i = lastIdx(arr, t); return i < 0 ? 0 : Math.exp(-(t - arr[i]) * decay); }
const BEATS = D.beats, KICKS = D.strong;
const beat = (t, d = 7) => pulse(BEATS, t, d);
const kick = (t, d = 9) => pulse(KICKS, t, d);
const beatIdx = t => lastIdx(BEATS, t);

// ───────────────────────── sprites / textures ─────────────────────────
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function glowSprite(r, g, b, size = 128, core = 0.25) {
  const c = mk(size, size), x = c.getContext('2d');
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(core, `rgba(${r},${g},${b},0.42)`);
  gr.addColorStop(0.6, `rgba(${r},${g},${b},0.08)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, size, size); return c;
}
const GL = {
  ember: glowSprite(255, 120, 30), white: glowSprite(255, 244, 225), blue: glowSprite(110, 170, 255),
  gold: glowSprite(255, 196, 90), red: glowSprite(255, 40, 18), grey: glowSprite(160, 160, 170, 128, 0.4),
  soft: glowSprite(255, 150, 60, 256, 0.1), cyan: glowSprite(150, 230, 255),
};
function glow(spr, x, y, r, a = 1) { if (a <= 0.003 || r <= 0.5) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r); }

const FOG = (() => {
  const w = 2048, h = 1024, c = mk(w, h), x = c.getContext('2d'), R = rnd(7);
  for (let i = 0; i < 260; i++) {
    const cx = R() * w, cy = h * 0.15 + R() * h * 0.8, r = 90 + R() * 280;
    x.globalAlpha = 0.04 + R() * 0.07;
    for (const dx of [-w, 0, w]) x.drawImage(GL.grey, cx + dx - r, cy - r * 0.6, 2 * r, 1.2 * r);
  }
  return c;
})();
function fog(t, speed, alpha, y0 = 0, hh = H, mode = 'screen') {
  if (alpha <= 0) return;
  const off = (((t * speed) % 2048) + 2048) % 2048;
  ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha;
  ctx.drawImage(FOG, -off, y0, 2048, hh); ctx.drawImage(FOG, 2048 - off, y0, 2048, hh);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
const GRAIN = [0, 1, 2, 3].map(k => {
  const c = mk(256, 256), x = c.getContext('2d'), d = x.createImageData(256, 256), R = rnd(99 + k);
  for (let i = 0; i < d.data.length; i += 4) { const v = R() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); return ctx.createPattern(c, 'repeat');
});
const VIGN = (() => {
  const c = mk(W, H), x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.92)');
  x.fillStyle = g; x.fillRect(0, 0, W, H); return c;
})();
const BUF = mk(W, H), BX = BUF.getContext('2d');
const BUF2 = mk(W, H), BX2 = BUF2.getContext('2d');

// ───────────────────────── generic drawing ─────────────────────────
function bg(c1, c2, c3) {
  const g = ctx.createLinearGradient(0, -100, 0, H + 100);
  g.addColorStop(0, c1); g.addColorStop(0.55, c2); g.addColorStop(1, c3 || c2);
  ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, H + 400);
}
function radial(x, y, r, inner, outer = 'rgba(0,0,0,0)', mode = 'source-over') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.globalCompositeOperation = mode; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.globalCompositeOperation = 'source-over';
}
function embers(t, o = {}) {
  const { n = 150, seed = 1, speed = 110, life = 6, size = 3, alpha = 1, spr = GL.ember, x0 = -100, x1 = W + 100,
    y0 = H + 30, wind = 0, spread = 0, core = '255,210,140', yr = 0 } = o;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const L = life * (0.55 + 0.9 * hash(seed * 13.7 + i));
    const tt = t + hash(seed * 7.3 + i * 3.1) * L, cyc = Math.floor(tt / L), age = tt - cyc * L;
    const h1 = hash(i * 17.3 + cyc * 91.7 + seed), h2 = hash(i * 5.1 + cyc * 13.9 + seed * 3), h3 = hash(i * 2.7 + cyc * 7.1 + seed * 5);
    const x = x0 + (x1 - x0) * h1 + wind * age + (h3 - 0.5) * spread * age + Math.sin(age * (1 + h2 * 2) + i) * (15 + 35 * h2);
    const y = y0 + yr * h3 - age * speed * (0.6 + 0.8 * h2);
    const a = Math.sin(PI * age / L) * alpha * (0.55 + 0.45 * Math.sin(age * 9 + i));
    if (a <= 0.01) continue;
    const s = size * (0.5 + h2 * 1.1);
    glow(spr, x, y, s * 5, a * 0.55);
    ctx.globalAlpha = clamp(a); ctx.fillStyle = `rgb(${core})`; ctx.fillRect(x - s / 2, y - s / 2, s, s);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function fire(x, y, s, t, inten = 1, seed = 0) {
  if (inten <= 0.01) return;
  ctx.globalCompositeOperation = 'lighter';
  glow(GL.soft, x, y - 60 * s, 420 * s * Math.sqrt(inten), 0.45 * clamp(inten));
  const n = 70;
  for (let i = 0; i < n; i++) {
    const L = 0.7 + hash(i + seed) * 0.7, tt = t + hash(i * 3 + seed) * L, cyc = Math.floor(tt / L), age = (tt - cyc * L) / L;
    const hx = hash(i * 7 + cyc * 3.3 + seed);
    const xo = (hx - 0.5) * 95 * s * (1 - age * 0.7) + noise1(t * 3 + i) * 14 * s * age;
    const yy = y - age * 230 * s * inten * (0.6 + 0.7 * hash(i * 11 + seed));
    const r = (1 - age * 0.85) * 52 * s * (0.6 + 0.6 * hash(i * 13 + seed)) * Math.sqrt(inten);
    const spr = age < 0.22 ? GL.white : age < 0.55 ? GL.gold : GL.ember;
    glow(spr, x + xo, yy, r, (1 - age) * 0.42);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}
function rays(cx, cy, t, n, len, alpha, color = '255,190,110', spin = 0.02, width = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(cx, cy);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + t * spin + hash(i) * 0.4, w = (0.012 + 0.04 * hash(i * 3)) * width;
    const l = len * (0.45 + 0.55 * hash(i * 7)) * (0.85 + 0.15 * Math.sin(t * 1.3 + i));
    const al = alpha * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 2.1)));
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l);
    g.addColorStop(0, `rgba(${color},${al})`); g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - w) * l, Math.sin(a - w) * l); ctx.lineTo(Math.cos(a + w) * l, Math.sin(a + w) * l); ctx.fill();
  }
  ctx.restore();
}
function bolt(x1, y1, x2, y2, seed, wdt = 6, alpha = 1, col = '170,210,255') {
  if (alpha <= 0.01) return;
  let pts = [[x1, y1], [x2, y2]];
  const len = Math.hypot(x2 - x1, y2 - y1);
  for (let it = 0, amp = len * 0.18; it < 6; it++, amp *= 0.55) {
    const np = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1, o = (hash(seed + it * 31 + i * 7.7) - 0.5) * amp;
      np.push([(ax + bx) / 2 + nx / nl * o, (ay + by) / 2 + ny / nl * o], pts[i + 1]);
    }
    pts = np;
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [lw, a, c] of [[wdt * 6, 0.12, col], [wdt * 2.5, 0.35, col], [wdt * 0.8, 1, '255,255,255']]) {
    ctx.strokeStyle = `rgba(${c},${a * alpha})`; ctx.lineWidth = lw; ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  }
  ctx.restore();
}
function cracks(cx, cy, seed, prog, n = 14, col = 'rgba(255,240,230,0.9)') {
  if (prog <= 0) return;
  ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    let a = i / n * TAU + hash(seed + i) * 0.5, x = cx, y = cy;
    const L = (500 + hash(seed + i * 3) * 900) * eOut(prog);
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y);
    for (let d = 0; d < L; d += 60) {
      a += (hash(seed + i * 11 + d) - 0.5) * 0.6; x += Math.cos(a) * 60; y += Math.sin(a) * 60; ctx.lineTo(x, y);
      if (hash(seed + i + d * 0.37) > 0.8) { ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a + 1) * 70, y + Math.sin(a + 1) * 70); ctx.moveTo(x, y); }
    }
    ctx.stroke();
  }
  ctx.restore();
}
function shockwave(x, y, age, maxR, col = '255,200,140', lw = 18, yScale = 0.35) {
  if (age < 0 || age > 1.2) return;
  const k = eOut(age / 1.2);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(${col},${(1 - k) * 0.8})`;
  ctx.lineWidth = lw * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(x, y, maxR * k, maxR * k * yScale, 0, 0, TAU); ctx.stroke(); ctx.restore();
}
function slash(x1, y1, x2, y2, age, wdt = 40, col = '255,255,255') {
  if (age < 0 || age > 0.5) return;
  const k = eOut(age / 0.12), fade = 1 - clamp((age - 0.1) / 0.4);
  const mx = lerp(x1, x2, k), my = lerp(y1, y2, k), nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [w, a] of [[wdt * 3, 0.15], [wdt, 0.6], [wdt * 0.3, 1]]) {
    ctx.fillStyle = `rgba(${col},${a * fade})`; ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + mx) / 2 + nx / nl * w, (y1 + my) / 2 + ny / nl * w, mx, my);
    ctx.quadraticCurveTo((x1 + mx) / 2 + nx / nl * w * 0.3, (y1 + my) / 2 + ny / nl * w * 0.3, x1, y1); ctx.fill();
  }
  ctx.restore();
}

// ───────────────────────── characters (original silhouettes) ─────────────────────────
function knight(x, y, s, o = {}) {
  if (o.rim && !o._solid) { knightBody(x, y, s, o); knightBody(x, y, s, { ...o, rim: null, _solid: true }); return; }
  knightBody(x, y, s, o);
}
function knightBody(x, y, s, o = {}) {
  const pose = o.pose || 'stand', sw = o.sway || 0, fill = o.fill || '#070504';
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(s * (o.flip || 1), s);
  ctx.globalAlpha = o.alpha ?? 1; ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.rim) { ctx.shadowColor = o.rim; ctx.shadowBlur = o.rimBlur || 30; }
  const kn = pose === 'kneel', dy = kn ? 22 : 0;
  const P = new Path2D();
  // cape
  P.moveTo(-15, -74 + dy); P.bezierCurveTo(-24, -50 + dy, -28 + sw * 0.5, -22, -27 + sw, -2);
  for (let k = 0; k <= 8; k++) P.lineTo(-27 + sw + k * 6.5, k % 2 ? -9 : -1 - hash(k) * 3);
  P.bezierCurveTo(24, -20, 22, -50 + dy, 15, -74 + dy); P.closePath();
  // legs
  if (kn) { P.moveTo(-20, 0); P.lineTo(-20, -6); P.lineTo(-8, -22); P.lineTo(6, -22); P.lineTo(8, -8); P.lineTo(19, -6); P.lineTo(19, 0); P.closePath(); }
  else {
    P.moveTo(-14, 0); P.lineTo(-11, -44); P.lineTo(-2, -44); P.lineTo(-2, 0); P.closePath();
    P.moveTo(14, 0); P.lineTo(11, -44); P.lineTo(2, -44); P.lineTo(2, 0); P.closePath();
  }
  // tabard, torso, helmet
  P.moveTo(-13, -48 + dy); P.lineTo(13, -48 + dy); P.lineTo(17, -27 + dy); P.lineTo(-17, -27 + dy); P.closePath();
  P.moveTo(-16, -77 + dy); P.lineTo(16, -77 + dy); P.lineTo(12, -46 + dy); P.lineTo(-12, -46 + dy); P.closePath();
  P.moveTo(-17, -71 + dy); P.ellipse(-17, -73 + dy, 9, 6.5, -0.2, 0, TAU);
  P.moveTo(26, -73 + dy); P.ellipse(17, -73 + dy, 9, 6.5, 0.2, 0, TAU);
  P.moveTo(-7, -80 + dy); P.lineTo(-7, -94 + dy); P.quadraticCurveTo(-7, -104 + dy, 0, -104 + dy); P.quadraticCurveTo(7, -104 + dy, 7, -94 + dy); P.lineTo(7, -80 + dy); P.closePath();
  // shield
  if (!o.noShield) { P.moveTo(-33, -70 + dy); P.lineTo(-12, -70 + dy); P.lineTo(-12, -52 + dy); P.quadraticCurveTo(-14, -40 + dy, -22.5, -33 + dy); P.quadraticCurveTo(-31, -40 + dy, -33, -52 + dy); P.closePath(); }
  ctx.fill(P);
  ctx.lineWidth = 7; ctx.beginPath();
  if (pose === 'raise') { ctx.moveTo(16, -72); ctx.lineTo(25, -88); ctx.lineTo(26, -104); }
  else { ctx.moveTo(16, -72 + dy); ctx.lineTo(21, -58 + dy); ctx.lineTo(22, -47 + dy); }
  ctx.moveTo(-16, -72 + dy); ctx.lineTo(-21, -62 + dy); ctx.stroke();
  // sword
  if (!o.noSword) {
    const S = new Path2D();
    if (pose === 'raise') {
      S.moveTo(24.6, -106); S.lineTo(27.4, -106); S.lineTo(31, -170); S.lineTo(28.8, -176); S.lineTo(27, -170); S.closePath();
      S.rect(18, -106, 16, 3); S.rect(24.8, -100, 2.4, 7);
    } else {
      const sy = dy;
      S.moveTo(20.6, -44 + sy); S.lineTo(23.4, -44 + sy); S.lineTo(23.2, 1); S.lineTo(22, 5); S.lineTo(20.8, 1); S.closePath();
      S.rect(15.5, -47 + sy, 13, 3); S.rect(20.8, -54 + sy, 2.4, 7);
    }
    ctx.fill(S);
    if (o.blade) { ctx.shadowBlur = 0; ctx.fillStyle = o.blade; ctx.fill(S); }
  }
  ctx.restore();
}
function mage(x, y, s, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip || 1), s); ctx.globalAlpha = o.alpha ?? 1;
  ctx.fillStyle = o.fill || '#9cc8ff'; ctx.strokeStyle = ctx.fillStyle;
  if (o.rim) { ctx.shadowColor = o.rim; ctx.shadowBlur = 40; }
  const P = new Path2D(), sw = Math.sin(t * 6) * 3;
  P.moveTo(-22 + sw, 0); P.lineTo(-12, -60); P.lineTo(12, -60); P.lineTo(22 + sw, 0); P.closePath();
  P.moveTo(-16, -58); P.lineTo(16, -58); P.lineTo(9, -78); P.lineTo(-9, -78); P.closePath();
  P.moveTo(-10, -80); P.lineTo(10, -80); P.lineTo(4 + sw, -118); P.lineTo(2, -104); P.closePath();
  P.ellipse(0, -80, 19, 4, 0, 0, TAU);
  ctx.fill(P);
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, 4); ctx.lineTo(-24, -96); ctx.stroke();
  if (o.flag) { // a white flag on the staff
    const f = new Path2D(); f.moveTo(-24, -96);
    for (let k = 0; k <= 6; k++) f.lineTo(-24 - k * 6, -96 + Math.sin(t * 9 + k) * 3);
    for (let k = 6; k >= 0; k--) f.lineTo(-24 - k * 6, -78 + Math.sin(t * 9 + k) * 3);
    ctx.fillStyle = '#ffffff'; ctx.fill(f);
  }
  ctx.restore();
}
function hollow(x, y, s, t, ph, dead = 0, fill = '#0b0807') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(dead * 1.45); ctx.globalAlpha = 1 - dead * 0.85;
  ctx.strokeStyle = fill; ctx.fillStyle = fill; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const sw = Math.sin(t * 2.2 + ph) * 4;
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-2, -36); ctx.moveTo(6, 0); ctx.lineTo(2, -36); ctx.stroke();
  ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(0, -36); ctx.quadraticCurveTo(2, -55, -6 + sw * 0.4, -66); ctx.stroke();
  ctx.beginPath(); ctx.arc(-9 + sw * 0.5, -72, 6.5, 0, TAU); ctx.fill();
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-6, -62); ctx.lineTo(-14 + sw, -44); ctx.lineTo(-13 + sw, -30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4, -60); ctx.lineTo(4 + sw * 0.5, -44); ctx.lineTo(2, -32); ctx.stroke();
  ctx.restore();
}
function demon(x, y, s, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s * (1 + Math.sin(t * 1.6) * 0.012));
  ctx.fillStyle = o.fill || '#0b0605'; ctx.strokeStyle = ctx.fillStyle; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.rim) { ctx.shadowColor = o.rim; ctx.shadowBlur = 50; }
  const P = new Path2D(), wf = Math.sin(t * 2) * 4;
  for (const m of [-1, 1]) {
    P.moveTo(m * 20, -88); P.lineTo(m * 78, -132 + wf); P.lineTo(m * 66, -110); P.lineTo(m * 96, -104 + wf); P.lineTo(m * 64, -92);
    P.lineTo(m * 86, -76 + wf); P.lineTo(m * 36, -74); P.closePath();
    P.moveTo(m * 7, -108); P.bezierCurveTo(m * 20, -114, m * 32, -124, m * 28, -138); P.bezierCurveTo(m * 22, -126, m * 14, -120, m * 2, -112); P.closePath();
  }
  P.moveTo(-40, 0); P.lineTo(-36, -26); P.bezierCurveTo(-64, -40, -64, -82, -38, -94); P.bezierCurveTo(-20, -106, 20, -106, 38, -94);
  P.bezierCurveTo(64, -82, 64, -40, 36, -26); P.lineTo(40, 0); P.lineTo(20, 0); P.lineTo(16, -20); P.lineTo(-16, -20); P.lineTo(-20, 0); P.closePath();
  P.moveTo(12, -102); P.arc(0, -102, 12, 0, TAU);
  P.moveTo(-8, -98); P.lineTo(0, -84); P.lineTo(8, -98); P.closePath();
  ctx.fill(P);
  ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(-44, -84); ctx.lineTo(-62, -52); ctx.lineTo(-60, -18); ctx.stroke();
  ctx.save(); ctx.translate(44, -84); ctx.rotate(o.arm || 0);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, 34); ctx.stroke();
  const C = new Path2D(); C.moveTo(-6, 30); C.lineTo(8, 30); C.lineTo(20, 104); C.lineTo(-14, 104); C.closePath();
  for (let k = 0; k < 4; k++) { C.moveTo(15, 50 + k * 14); C.lineTo(26, 54 + k * 14); C.lineTo(16, 58 + k * 14); C.closePath(); }
  ctx.fill(C); ctx.restore();
  ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'lighter';
  const ea = o.eyes ?? 1;
  glow(GL.red, -5, -104, 9, 0.9 * ea); glow(GL.red, 5, -104, 9, 0.9 * ea);
  glow(GL.white, -5, -104, 1.6, ea); glow(GL.white, 5, -104, 1.6, ea);
  ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function lancer(x, y, s, t, o = {}) { // slim golden spear knight (abstract)
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = o.fill || '#120c04'; ctx.strokeStyle = ctx.fillStyle;
  if (o.rim) { ctx.shadowColor = o.rim; ctx.shadowBlur = 40; }
  ctx.restore();
  knight(x, y, s * 1.15, { fill: o.fill || '#120c04', rim: o.rim, noShield: true, noSword: true, sway: Math.sin(t * 3) * 4 });
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = o.fill || '#120c04'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  if (o.rim) { ctx.shadowColor = o.rim; ctx.shadowBlur = 30; }
  const a = o.spear ?? -0.5;
  ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-10, -40); ctx.lineTo(10, -210); ctx.stroke();
  ctx.fillStyle = o.fill || '#120c04'; ctx.beginPath(); ctx.moveTo(6, -205); ctx.lineTo(16, -248); ctx.lineTo(14, -205); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function brute(x, y, s, t, o = {}) { // huge heavy hammer knight (abstract)
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = o.fill || '#0d0705'; ctx.strokeStyle = ctx.fillStyle; ctx.lineCap = 'round';
  if (o.rim) { ctx.shadowColor = o.rim; ctx.shadowBlur = 50; }
  const P = new Path2D();
  P.ellipse(0, -60, 48, 46, 0, 0, TAU); P.moveTo(-34, 0); P.rect(-36, -28, 24, 28); P.rect(12, -28, 24, 28);
  P.moveTo(14, -112); P.arc(0, -112, 14, 0, TAU); P.ellipse(-46, -92, 18, 13, 0, 0, TAU); P.ellipse(46, -92, 18, 13, 0, 0, TAU);
  ctx.fill(P);
  ctx.save(); ctx.translate(48, -88); ctx.rotate(o.hammer ?? 0.4);
  ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -120); ctx.stroke();
  ctx.fillRect(-38, -165, 76, 50); ctx.restore();
  ctx.restore();
}
function archer(x, y, s, t, o = {}) {
  knight(x, y, s, { fill: o.fill, rim: o.rim, noShield: true, noSword: true, flip: o.flip || 1 });
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip || 1), s); ctx.strokeStyle = o.fill || '#0a0806'; ctx.lineWidth = 3;
  if (o.rim) { ctx.shadowColor = o.rim; ctx.shadowBlur = 25; }
  ctx.beginPath(); ctx.arc(-40, -66, 60, -1.05, 1.05); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-40 + 60 * Math.cos(-1.05), -66 + 60 * Math.sin(-1.05)); ctx.lineTo(-10 + (o.draw || 0) * 14, -66);
  ctx.lineTo(-40 + 60 * Math.cos(1.05), -66 + 60 * Math.sin(1.05)); ctx.stroke(); ctx.restore();
}
function gamepad(x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(o.rot || 0);
  const P = new Path2D();
  P.moveTo(-60, -30); P.bezierCurveTo(-30, -42, 30, -42, 60, -30); P.bezierCurveTo(88, -20, 104, 40, 92, 58);
  P.bezierCurveTo(80, 74, 58, 60, 44, 34); P.lineTo(-44, 34); P.bezierCurveTo(-58, 60, -80, 74, -92, 58); P.bezierCurveTo(-104, 40, -88, -20, -60, -30); P.closePath();
  ctx.fillStyle = '#0c0a09'; ctx.shadowColor = o.rim || 'rgba(255,60,30,0.9)'; ctx.shadowBlur = 40; ctx.fill(P); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,120,80,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(P);
  ctx.fillStyle = 'rgba(255,90,60,0.85)';
  for (const [bx, by] of [[52, -12], [64, 0], [52, 12], [40, 0]]) { ctx.beginPath(); ctx.arc(bx, by, 4.5, 0, TAU); ctx.fill(); }
  ctx.fillRect(-58, -4, 26, 8); ctx.fillRect(-49, -13, 8, 26);
  for (const sx of [-22, 22]) { ctx.beginPath(); ctx.arc(sx, 14, 10, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function flask(x, y, s, level, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const P = new Path2D(); P.moveTo(-8, -60); P.lineTo(8, -60); P.lineTo(8, -40); P.bezierCurveTo(36, -30, 40, 20, 0, 30); P.bezierCurveTo(-40, 20, -36, -30, -8, -40); P.closePath();
  ctx.save(); ctx.clip(P);
  const top = lerp(30, -38, clamp(level)) + Math.sin(t * 8) * 1.5;
  ctx.fillStyle = 'rgba(255,140,30,0.95)'; ctx.fillRect(-40, top, 80, 80);
  ctx.globalCompositeOperation = 'lighter'; glow(GL.ember, 0, 0, 60, level * 0.8); ctx.restore();
  ctx.strokeStyle = 'rgba(230,220,200,0.8)'; ctx.lineWidth = 2.5; ctx.stroke(P);
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-10, -70, 20, 12);
  ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function humanity(x, y, r, t, a = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const ang = t * (1.5 + hash(i) * 2) + i * 0.7, rr = r * (1.05 + 0.5 * hash(i * 3) + 0.2 * Math.sin(t * 3 + i));
    glow(GL.white, x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.9, r * 0.35, 0.35 * a);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${0.6 * a})`; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}
function summonSign(x, y, r, t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.3); ctx.globalCompositeOperation = 'lighter';
  glow(GL.gold, 0, 0, r * 1.6, 0.5 * a);
  ctx.strokeStyle = `rgba(255,215,130,${a})`; ctx.lineWidth = 4;
  for (const rr of [r, r * 0.8, r * 0.45]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); }
  ctx.rotate(t * 0.6);
  for (let i = 0; i < 24; i++) { const an = i / 24 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * 0.8, Math.sin(an) * r * 0.8); ctx.lineTo(Math.cos(an + 0.08) * r, Math.sin(an + 0.08) * r); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha = 1;
}

// ───────────────────────── environments ─────────────────────────
function corridor(t, z, opt = {}) {
  const vx = W / 2 + (opt.vx || 0), vy = H * 0.46;
  bg('#030406', '#0b0d12', '#050506');
  radial(vx, vy, 700, `rgba(120,140,170,${opt.light ?? 0.35})`, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'lighter'; glow(GL.white, vx, vy, 160, (opt.light ?? 0.35) * 0.8); ctx.globalCompositeOperation = 'source-over';
  const N = 16, off = z % 1;
  for (let k = N; k >= 1; k--) {
    const zz = k - off; if (zz < 0.18) continue;
    const p = 1 / zz, f = clamp(1 - zz / N), shade = Math.round(4 + 26 * (1 - f) * 0.9);
    const col = `rgb(${shade},${shade + 2},${shade + 6})`;
    ctx.fillStyle = col; ctx.strokeStyle = col;
    for (const sd of [-1, 1]) {
      const x = vx + sd * 520 * p, w = 110 * p, top = vy - 640 * p, bot = vy + 560 * p;
      ctx.fillRect(x - w / 2, top, w, bot - top);
      ctx.fillRect(x - w * 0.7, top - 20 * p, w * 1.4, 30 * p);
    }
    ctx.lineWidth = 46 * p; ctx.beginPath();
    ctx.moveTo(vx - 520 * p, vy - 640 * p); ctx.quadraticCurveTo(vx, vy - 1200 * p, vx + 520 * p, vy - 640 * p); ctx.stroke();
    if (opt.torches && k % 2 === 0) {
      ctx.globalCompositeOperation = 'lighter';
      const fl = 0.75 + 0.25 * noise1(t * 8 + k);
      for (const sd of [-1, 1]) glow(GL.ember, vx + sd * 455 * p, vy - 120 * p, 120 * p * fl, f * 0.9 * opt.torches);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  const g = ctx.createLinearGradient(0, vy, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = g; ctx.fillRect(0, vy, W, H - vy);
}
const CITY = [0, 1, 2, 3].map(L => {
  const R = rnd(100 + L * 17), arr = []; let x = -900;
  while (x < W + 4200) {
    const w = (60 + R() * 150) * (1 + L * 0.35), h = (120 + R() * 300) * (0.5 + L * 0.22);
    arr.push({ x, w, h, sp: R() < 0.75, sph: w * (0.9 + R() * 1.6), win: 1 + Math.floor(R() * 4), sd: R() * 1000, br: R() < 0.5 });
    x += w * (0.65 + R() * 0.7);
  }
  return arr;
});
function city(t, panX, panY, cols, baseY, winAlpha = 0.8, winCol = '255,200,110') {
  for (let L = 0; L < 4; L++) {
    const par = 0.18 + L * 0.32, ox = -panX * par, oy = panY * par, base = baseY + L * 55;
    ctx.fillStyle = cols[L]; ctx.strokeStyle = cols[L];
    const arr = CITY[L];
    for (let i = 0; i < arr.length; i++) {
      const b = arr[i], bx = b.x + ox; if (bx > W + 400 || bx + b.w < -400) continue;
      const top = base + oy - b.h;
      ctx.fillRect(bx, top, b.w, b.h + 900);
      ctx.beginPath();
      if (b.sp) { ctx.moveTo(bx + b.w * 0.25, top); ctx.lineTo(bx + b.w / 2, top - b.sph); ctx.lineTo(bx + b.w * 0.75, top); }
      for (const px of [0, 1]) { const cx = bx + px * b.w; ctx.moveTo(cx - 9, top); ctx.lineTo(cx, top - b.w * 0.5); ctx.lineTo(cx + 9, top); }
      ctx.fill();
      if (L === 3 && b.br && i + 1 < arr.length) { // flying buttress / narrow bridge
        const nb = arr[i + 1], nx = nb.x + ox; ctx.lineWidth = 16; ctx.beginPath();
        ctx.moveTo(bx + b.w, top + 60); ctx.quadraticCurveTo((bx + b.w + nx) / 2, top - 40, nx, base + oy - nb.h + 80); ctx.stroke();
      }
      if (L < 3 && winAlpha > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${winCol},${winAlpha * (0.25 + L * 0.2)})`;
        const ww = b.w / (b.win * 2 + 1);
        for (let k = 0; k < b.win; k++) for (let r = 0; r < 3; r++) {
          if (hash(b.sd + k * 7 + r * 13) < 0.45) continue;
          const wx = bx + ww * (1 + k * 2), wy = top + 40 + r * 90;
          ctx.beginPath(); ctx.moveTo(wx, wy + 50); ctx.lineTo(wx, wy + 12); ctx.quadraticCurveTo(wx + ww / 2, wy - 6, wx + ww, wy + 12); ctx.lineTo(wx + ww, wy + 50); ctx.fill();
        }
        ctx.restore(); ctx.fillStyle = cols[L];
      }
    }
  }
}
function goldSky(t, sunY = H * 0.55, inten = 1) {
  bg('#1c1030', '#c4622a', '#f3c477');
  radial(W * 0.62, sunY, 900, `rgba(255,220,150,${0.75 * inten})`, 'rgba(255,140,60,0)', 'lighter');
  ctx.globalCompositeOperation = 'lighter'; glow(GL.white, W * 0.62, sunY, 150, inten); ctx.globalCompositeOperation = 'source-over';
}
function stoneArena(t) {
  bg('#0b0405', '#24100b', '#120806');
  radial(W / 2, -100, 1100, 'rgba(255,120,60,0.22)', 'rgba(0,0,0,0)', 'lighter');
  ctx.strokeStyle = 'rgba(255,140,90,0.06)'; ctx.lineWidth = 2;
  for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 30, H * 0.62); ctx.lineTo(W / 2 + i * 260, H + 50); ctx.stroke(); }
  for (let j = 0; j < 8; j++) { const y = H * 0.62 + Math.pow(j / 8, 2) * H * 0.45; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.fillStyle = '#080404';
  for (let i = 0; i < 7; i++) { const x = i * 330 - 90; ctx.fillRect(x, 0, 70, H * 0.66); ctx.fillRect(x - 15, H * 0.6, 100, 30); }
}

// ───────────────────────── text ─────────────────────────
const FONTS = {
  csc: s => `700 ${s}px CSC`, cgi: s => `italic 600 ${s}px CGI`, russo: s => `${s}px Russo`,
};
function text(str, x, y, o = {}) {
  ctx.save(); ctx.font = o.font || FONTS.csc(80); ctx.letterSpacing = (o.ls || 0) + 'px';
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = clamp(o.alpha ?? 1);
  ctx.translate(x, y); if (o.scale) ctx.scale(o.scale, o.scale); if (o.rot) ctx.rotate(o.rot);
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 30; }
  if (o.stroke) { ctx.lineWidth = o.lw || 8; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, 0, 0); }
  ctx.fillStyle = o.fill || '#fff'; ctx.fillText(str, 0, 0);
  ctx.restore();
}
function banner(str, a, o = {}) {
  if (a <= 0.003) return;
  const bh = o.bh || 250, cy = o.y || H / 2;
  ctx.save(); ctx.globalAlpha = clamp(a);
  const g = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, `rgba(0,0,0,${o.band ?? 0.75})`); g.addColorStop(0.7, `rgba(0,0,0,${o.band ?? 0.75})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, cy - bh / 2, W, bh); ctx.restore();
  text(str, W / 2, cy + 6, { font: o.font || FONTS.csc(150), ls: o.ls ?? 10, fill: o.fill || '#9c1209', alpha: a, scale: o.scale || 1, glow: o.glow, blur: o.blur || 40 });
}

// ───────────────────────── lyrics engine ─────────────────────────
const STYLE = {};
const setStyle = (idx, st) => idx.forEach(i => STYLE[i] = st);
setStyle([1], 'credit'); setStyle([2, 4], 'title');
setStyle([6, 7, 8, 9, 10, 11, 12, 13, 25, 26, 27, 28, 30, 31, 32, 34, 35, 36, 37, 38, 39, 40, 41, 44, 45, 46, 49, 50, 51, 52], 'rap');
setStyle([15, 16, 58], 'whisper'); setStyle([18, 19, 20, 21, 22, 23, 60, 61, 62, 63, 64, 65], 'chorus');
setStyle([29], 'snova'); setStyle([42, 47, 48, 54], 'scream'); setStyle([55, 56, 57], 'rage');
const LINES = LY.map((l, i) => ({ ...l, i })).filter(l => STYLE[l.i]);
LINES.forEach((L, k) => {
  if (L.e <= L.s) L.e = LINES[k + 1] ? LINES[k + 1].s : L.s + 3;
  const words = L.t.split(/\s+/).filter(Boolean), dur = L.e - L.s;
  const span = dur > 5 ? Math.min(dur * 0.55, 3.2) : dur * 0.82;
  const wts = words.map(w => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.2), tot = wts.reduce((a, b) => a + b, 0);
  let acc = 0; L.words = words.map((w, j) => { const r = { w, t: L.s + acc / tot * span }; acc += wts[j]; return r; });
});
const lineByIdx = i => LINES.find(l => l.i === i);
const isEmph = w => { const c = w.replace(/[^\p{L}]/gu, ''); return (c.length >= 2 && c === c.toUpperCase() && /\p{Lu}/u.test(c)) || /!!!/.test(w); };
const STY = {
  credit: { font: FONTS.cgi(58), ls: 4, y: H / 2, fill: '#d6cdbd', emph: '#d6cdbd', slam: 0, glow: 'rgba(255,170,90,0.35)' },
  title: { font: FONTS.csc(70), ls: 4, y: H * 0.74, fill: '#f2e6cc', emph: '#ffc65a', slam: 0.25, glow: 'rgba(255,120,30,0.8)' },
  rap: { font: FONTS.russo(62), ls: 1, y: H * 0.83, fill: '#f6f1ea', emph: '#ff8a2a', slam: 0.7, stroke: 'rgba(0,0,0,0.85)' },
  rage: { font: FONTS.russo(70), ls: 1, y: H * 0.8, fill: '#ffe0d6', emph: '#ff2a12', slam: 1, stroke: 'rgba(20,0,0,0.9)', jit: 6 },
  chorus: { font: FONTS.cgi(78), ls: 1, y: H * 0.82, fill: '#fff3dc', emph: '#ffc860', slam: 0.3, glow: 'rgba(255,120,30,0.9)', stroke: 'rgba(30,10,0,0.6)' },
  whisper: { font: FONTS.cgi(62), ls: 2, y: H * 0.8, fill: '#ddd4c8', emph: '#ffb060', slam: 0, glow: 'rgba(255,150,80,0.4)' },
  scream: { font: FONTS.russo(130), ls: 2, y: H * 0.5, fill: '#ff2a12', emph: '#ff2a12', slam: 1.4, stroke: '#000', jit: 14, glow: 'rgba(255,0,0,0.8)' },
  snova: { font: FONTS.csc(120), ls: 8, y: H * 0.5, fill: '#b3150c', emph: '#b3150c', slam: 1, glow: 'rgba(255,0,0,0.6)' },
};
function drawLyrics(t) {
  for (const L of LINES) {
    if (t < L.s - 0.05 || t > L.e + 0.25) continue;
    const st = STY[STYLE[L.i]], out = 1 - ss(L.e - 0.08, L.e + 0.22, t);
    if (out <= 0) continue;
    if (STYLE[L.i] === 'snova') { // one huge word at a time
      let cur = null; for (const w of L.words) if (t >= w.t) cur = w;
      if (!cur) continue; const k = clamp((t - cur.t) / 0.12);
      text(cur.w.replace('.', ''), W / 2, st.y, { font: st.font, ls: st.ls, fill: st.fill, scale: lerp(1.5, 1, eOut(k)), glow: st.glow, blur: 40, alpha: out });
      continue;
    }
    ctx.save(); ctx.font = st.font; ctx.letterSpacing = st.ls + 'px';
    const sp = ctx.measureText(' ').width + 6, wsz = L.words.map(w => ctx.measureText(w.w).width);
    const maxW = W * 0.86, rows = [[]]; let rw = 0;
    L.words.forEach((w, j) => { if (rw + wsz[j] > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; } rows[rows.length - 1].push(j); rw += wsz[j] + sp; });
    const lh = parseInt(st.font.match(/(\d+)px/)[1]) * 1.15;
    rows.forEach((row, r) => {
      const tw = row.reduce((a, j) => a + wsz[j], 0) + sp * (row.length - 1);
      let x = W / 2 - tw / 2; const y = st.y + (r - (rows.length - 1) / 2) * lh - (rows.length > 1 && st.y > H * 0.7 ? lh * 0.4 : 0);
      for (const j of row) {
        const w = L.words[j], k = clamp((t - w.t) / (st.slam ? 0.14 : 0.45));
        if (k > 0) {
          const em = isEmph(w.w), sc = lerp(1 + st.slam * (em ? 1.2 : 0.6), 1, eOut(k));
          const jx = st.jit ? noise1(t * 25 + j * 3) * st.jit : 0, jy = st.jit ? noise1(t * 23 + j * 7 + 50) * st.jit : 0;
          const rise = st.slam ? 0 : (1 - eOut(k)) * 18;
          text(w.w, x + wsz[j] / 2 + jx, y + jy + rise, {
            font: st.font, ls: st.ls, fill: em ? st.emph : st.fill, alpha: Math.min(k * 1.5, 1) * out,
            scale: sc, glow: em ? (st.glow || 'rgba(255,90,20,0.9)') : st.glow, blur: em ? 34 : 22, stroke: st.stroke, lw: STYLE[L.i] === 'scream' ? 14 : 9,
          });
        }
        x += wsz[j] + sp;
      }
    });
    ctx.restore();
  }
}
function wordTime(idx, re) { const L = lineByIdx(idx); const w = L.words.find(w => re.test(w.w)); return w ? w.t : L.s; }

// ───────────────────────── timeline & scenes ─────────────────────────
const T_YOUDIED = wordTime(28, /YOU/);
const SNOVA = lineByIdx(29).words.map(w => w.t);
const T_OBLOM = wordTime(13, /обломался/);
const HITS = [ // [time, strength, color]
  [7.9, 1, '255,150,60'], [25.21, 0.8, '255,255,255'], [56.89, 1.4, '255,170,80'], [T_YOUDIED, 1.2, '255,40,20'],
  ...SNOVA.map(s => [s, 0.6, '255,30,10']), [101.6, 1.2, '255,255,255'], [103.25, 0.8, '255,220,150'], [123.27, 1, '255,60,30'],
  [125.58, 0.6, '160,200,255'], [126.6, 0.8, '160,200,255'], [135.72, 0.9, '255,40,20'], [137.79, 0.9, '255,220,140'], [148.25, 1, '255,30,10'],
  [155.82, 0.8, '255,30,10'], [162.45, 1.5, '255,200,120'], [178.4, 1.2, '255,230,170'], [T_OBLOM, 1, '255,60,40'], [82.98, 0.7, '255,120,80'],
];
function flashAmt(t) { let r = 0, c = '255,255,255', best = 0; for (const [h, s, col] of HITS) { if (t >= h && t < h + 2) { const v = s * Math.exp(-(t - h) * 5); r += v; if (v > best) { best = v; c = col; } } } return [r, c]; }

// ── 0 · intro: credits, name in fire, DARK SOULS
function sIntro(t) {
  bg('#020202', '#060404', '#0a0503');
  const lit = ss(5, 7.9, t);
  radial(W / 2, H * 0.55, 900, `rgba(255,90,20,${0.08 + lit * 0.25})`, 'rgba(0,0,0,0)', 'lighter');
  fog(t, 25, 0.25 + lit * 0.2);
  embers(t, { n: 30 + Math.floor(lit * 120), seed: 3, speed: 70 + lit * 80, alpha: 0.4 + lit * 0.6 });
  if (t > 7.6) {
    const k = ss(7.85, 8.1, t), a = k * (1 - ss(10.6, 12, t)), sc = 1 + (t - 7.9) * 0.012;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    glow(GL.soft, W / 2, H * 0.42, 900, 0.5 * a * (0.8 + 0.2 * noise1(t * 6)));
    ctx.restore();
    text('DARK SOULS', W / 2, H * 0.42, { font: FONTS.csc(210), ls: 34, fill: '#fff0d8', glow: 'rgba(255,110,20,1)', blur: 60, alpha: a, scale: sc * lerp(1.3, 1, eOut((t - 7.9) / 0.35)) });
    text('DARK SOULS', W / 2, H * 0.42, { font: FONTS.csc(210), ls: 34, fill: 'rgba(255,170,80,0.35)', alpha: a * kick(t, 4), scale: sc * 1.03 });
    embers(t, { n: 120, seed: 11, speed: 140, x0: W * 0.2, x1: W * 0.8, y0: H * 0.5, yr: 60, alpha: a, size: 3.5 });
  }
}
// ── 1 · descent through the asylum
function sCorridor(t) {
  const lt = t - 12, b = ss(12, 25, t);
  corridor(t, lt * (0.6 + b * 1.6) + 2 * eIn(lt / 13), { light: 0.25 + 0.4 * b, torches: 0.5 + b });
  fog(t, 40, 0.3);
  // knight walks into the light
  const ka = ss(17, 19.5, t), ks = lerp(1.1, 3.6, eIn((t - 17) / 8.2));
  if (ka > 0) knight(W / 2 + Math.sin(t * 3) * 3, H * 0.46 + 70 * ks, ks, { alpha: ka, rim: 'rgba(160,190,255,0.8)', sway: Math.sin(t * 2) * 3 });
  embers(t, { n: 80, seed: 5, speed: 90, alpha: 0.4 + b * 0.6, wind: -10 });
  rays(W / 2, H * 0.46, t, 22, 1300, 0.07 + 0.1 * b, '180,200,255', 0.01);
}
// ── 2 · verse 1: class select, gear, hollows, the illusion breaks
function card(x, y, w, h, label, icon, a, hi, t, burn = 0) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
  ctx.fillStyle = 'rgba(14,10,8,0.92)'; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = hi ? '#ffc65a' : 'rgba(200,170,120,0.6)'; ctx.lineWidth = hi ? 5 : 2;
  if (hi) { ctx.shadowColor = 'rgba(255,150,40,0.9)'; ctx.shadowBlur = 40; }
  ctx.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24); ctx.shadowBlur = 0;
  ctx.restore();
  ctx.save(); ctx.globalAlpha = a; icon(x, y - 40); ctx.restore();
  text(label, x, y + h / 2 - 70, { font: FONTS.csc(44), ls: 6, fill: hi ? '#ffd890' : '#cbbca4', alpha: a });
  if (burn > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 18; i++) glow(GL.ember, x - w / 2 + hash(i) * w, y + h / 2 - burn * h * hash(i * 3), 90, burn * 0.6); ctx.restore();
    ctx.save(); ctx.globalAlpha = burn * 0.85; ctx.fillStyle = '#000'; ctx.fillRect(x - w / 2, y + h / 2 - burn * h, w, burn * h); ctx.restore();
  }
}
const ICON = {
  sword: (x, y) => { ctx.save(); ctx.translate(x, y); ctx.rotate(-0.6); ctx.fillStyle = '#e9e2d4'; ctx.fillRect(-5, -120, 10, 170); ctx.beginPath(); ctx.moveTo(-5, -120); ctx.lineTo(0, -140); ctx.lineTo(5, -120); ctx.fill(); ctx.fillStyle = '#c99a4a'; ctx.fillRect(-32, 46, 64, 9); ctx.fillRect(-4, 55, 8, 36); ctx.restore(); },
  staff: (x, y) => { ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#a7865c'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 100); ctx.lineTo(0, -80); ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; glow(GL.blue, 0, -100, 70, 0.9); glow(GL.white, 0, -100, 18, 1); ctx.restore(); },
  dagger: (x, y) => { ctx.save(); ctx.translate(x, y); ctx.rotate(0.5); ctx.fillStyle = '#d8d0c6'; ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(0, -90); ctx.lineTo(8, 10); ctx.fill(); ctx.fillStyle = '#6b4b2a'; ctx.fillRect(-22, 10, 44, 8); ctx.fillRect(-4, 18, 8, 40); ctx.restore(); },
  shield: (x, y) => { ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#7a5a34'; ctx.strokeStyle = '#d7b779'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-80, -90); ctx.lineTo(80, -90); ctx.lineTo(80, 0); ctx.quadraticCurveTo(70, 70, 0, 110); ctx.quadraticCurveTo(-70, 70, -80, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); },
  armor: (x, y) => { ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#5d5953'; ctx.strokeStyle = '#c9c1b3'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-90, -90); ctx.lineTo(90, -90); ctx.lineTo(70, 90); ctx.lineTo(-70, 90); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -90); ctx.lineTo(0, 90); ctx.stroke(); ctx.restore(); },
};
function sVerse1(t) {
  bg('#070405', '#140a08', '#0a0605');
  radial(W / 2, H * 0.4, 1000, `rgba(255,100,40,${0.12 + 0.1 * beat(t)})`, 'rgba(0,0,0,0)', 'lighter');
  fog(t, 60, 0.22);
  if (t < 30.08) { // class select
    const cls = [['ВОИН', ICON.sword], ['МАГ', ICON.staff], ['РАЗБОЙНИК', ICON.dagger]];
    const hiIdx = t < 27.6 ? beatIdx(t) % 3 : 1;
    cls.forEach(([lab, ic], i) => {
      const enter = eOut((t - 25.21 - i * 0.2) / 0.35), x = W / 2 + (i - 1) * 470, y = H * 0.45 + (1 - enter) * 600;
      const mageZoom = i === 1 ? ss(27.6, 28.2, t) : 0, fade = i !== 1 ? 1 - ss(27.6, 28, t) * 0.75 : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(1 + mageZoom * 0.25, 1 + mageZoom * 0.25); ctx.translate(-x, -y);
      card(x, y, 380, 560, lab, ic, enter * fade, i === hiIdx, t, i === 1 ? ss(28.8, 30, t) : 0);
      ctx.restore();
      if (i === 1 && t > 27.6) { // crossed out
        const k1 = ss(28.0, 28.15, t), k2 = ss(28.4, 28.55, t);
        ctx.save(); ctx.strokeStyle = '#d91b0b'; ctx.lineWidth = 26; ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(255,0,0,0.8)'; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.moveTo(x - 200, y - 280); ctx.lineTo(x - 200 + 400 * k1, y - 280 + 560 * k1);
        if (k2 > 0) { ctx.moveTo(x + 200, y - 280); ctx.lineTo(x + 200 - 400 * k2, y - 280 + 560 * k2); } ctx.stroke(); ctx.restore();
      }
    });
  } else if (t < 32.63) { // gear slams in on beats
    const items = [[ICON.sword, 30.08, -420], [ICON.shield, 30.9, 0], [ICON.armor, 31.75, 420]];
    items.forEach(([ic, t0, dx]) => {
      const k = (t - t0) / 0.18; if (k < 0) return;
      const sc = lerp(3, 1.4, eOut(k)), x = W / 2 + dx, y = H * 0.42;
      ctx.save(); ctx.globalAlpha = clamp(k * 2); ctx.translate(x, y); ctx.scale(sc, sc); ic(0, 0); ctx.restore();
      shockwave(x, y + 160, t - t0, 500, '255,200,140', 14, 0.25);
    });
  } else if (t < 35.19) { // the warrior
    rays(W / 2, H * 0.5, t, 30, 1400, 0.16 + 0.1 * beat(t), '255,150,70', 0.05);
    const k = eOut((t - 32.63) / 0.4);
    knight(W / 2, H * 0.98, lerp(9, 7, k), { rim: 'rgba(255,120,40,1)', rimBlur: 50, sway: Math.sin(t * 2) * 4, blade: 'rgba(230,220,200,0.25)' });
    embers(t, { n: 120, seed: 21, speed: 160, size: 3.5 });
  } else { // hollows: easy mode... until it isn't
    const pan = (t - 35.19) * 60, crash = ss(T_OBLOM - 0.05, T_OBLOM + 0.1, t);
    ctx.fillStyle = '#0a0605'; ctx.fillRect(-100, H * 0.84, W + 200, H);
    const hb = BEATS.filter(b => b > 35.4 && b < 42.6);
    for (let i = 0; i < 9; i++) {
      const kt = hb[i] ?? 99, dead = ss(kt, kt + 0.35, t), x = 760 + i * 135 - pan * 0.4;
      hollow(x, H * 0.85, 2.2, t, i * 1.7, dead);
      if (t > kt && t < kt + 0.5) slash(x - 160, H * 0.85 - 260, x + 120, H * 0.85 - 40, t - kt, 34, '255,240,220');
    }
    const lunge = hb.reduce((m, b) => Math.max(m, Math.exp(-(t - b) * 10) * (t >= b)), 0);
    knight(420 + lunge * 60 - pan * 0.1 + crash * 0, H * 0.85, 2.6, { rim: 'rgba(255,120,40,0.7)', rot: -crash * 1.4, alpha: 1 - crash * 0.3 });
    embers(t, { n: 60, seed: 9, speed: 80 });
    if (t > T_OBLOM) {
      ctx.fillStyle = `rgba(90,0,0,${0.35 * crash})`; ctx.fillRect(0, 0, W, H);
      cracks(W * 0.55, H * 0.45, 77, (t - T_OBLOM) / 0.25, 16);
    }
  }
}
// ── 3 · pre-chorus: a flicker in the dark
function sPre(t) {
  const k = (t - 45.4) / 11.49;
  bg('#000', '#030203', '#050303');
  fog(t, 20, 0.18);
  const fx = W / 2, fy = H * 0.66, sc = lerp(0.12, 0.6, eIn(k));
  const flick = 0.55 + 0.45 * noise1(t * 7) * noise1(t * 3.1 + 9);
  radial(fx, fy, 1300 * sc + 200, `rgba(255,110,30,${0.18 * flick + 0.25 * k})`, 'rgba(0,0,0,0)', 'lighter');
  fire(fx, fy, sc, t, 0.35 + 0.25 * flick + k * 0.2);
  const kx = lerp(W / 2 - 40, W / 2 - 110, k), ks = lerp(5.5, 3.2, eOut(k));
  knight(kx, H * 1.06, ks, { fill: '#020101', rim: `rgba(255,120,40,${0.3 + 0.5 * k})`, sway: Math.sin(t * 1.5) * 3, alpha: ss(46, 47.5, t) });
  embers(t, { n: 30 + Math.floor(k * 60), seed: 15, speed: 60, x0: fx - 300, x1: fx + 300, y0: fy, spread: 30, alpha: 0.5 + k * 0.5 });
  if (t > 55.5) { ctx.fillStyle = `rgba(0,0,0,${ss(55.5, 56.85, t) * 0.92})`; ctx.fillRect(0, 0, W, H); }
}
// ── 4 · chorus: BONFIRE LIT
function bonfireScene(t, inten, o = {}) {
  bg('#080403', '#1d0c06', '#0d0604');
  const fx = W / 2 + (o.fx || 0), fy = H * 0.78;
  radial(fx, fy - 120, 1600, `rgba(255,110,30,${0.32 * inten})`, 'rgba(0,0,0,0)', 'lighter');
  rays(fx, fy - 150, t, 34, 1700, 0.12 * inten + 0.08 * beat(t) * inten, '255,160,70', 0.03);
  ctx.fillStyle = '#0a0403'; ctx.beginPath(); ctx.ellipse(fx, H + 200, W * 0.9, 330, 0, 0, TAU); ctx.fill();
  // ash pile + sword
  ctx.fillStyle = '#140805'; ctx.beginPath(); ctx.ellipse(fx, fy + 6, 120, 26, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(fx + 6, fy - 4); ctx.rotate(0.08); ctx.fillStyle = '#1a100a'; ctx.fillRect(-6, -200, 12, 200); ctx.fillRect(-30, -205, 60, 10); ctx.fillRect(-5, -250, 10, 45); ctx.restore();
  fire(fx, fy, 1.4 * (o.scale || 1), t, inten * (1 + 0.15 * kick(t)));
  embers(t, { n: Math.floor(140 * clamp(inten, 0.3, 2)), seed: 31, speed: 180, x0: fx - 120, x1: fx + 120, y0: fy - 40, spread: 160, life: 5, size: 3.2, alpha: clamp(inten) });
  fog(t, 30, 0.15);
}
function sChorus(t) {
  const ign = eOut((t - 56.89) / 0.6), inten = ign * (t < 73.4 ? 1 : lerp(1, 1.6, ss(73.4, 76, t)));
  const push = 1 + 0.04 * ss(56.89, 82.98, t);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(push, push); ctx.translate(-W / 2, -H / 2);
  bonfireScene(t, inten);
  // knight: kneels → dies → rises → stands → sword up
  const kx = W / 2 + 330, ky = H * 0.86;
  let pose = 'kneel', rot = 0, alpha = 1, rim = 'rgba(255,130,50,0.95)';
  if (t > 61.5 && t < 63.6) { pose = 'stand'; rot = -eIn((t - 61.6) / 0.7) * PI / 2; alpha = 1 - ss(62.4, 63.2, t); }
  else if (t >= 63.6 && t < 73.4) { pose = 'stand'; alpha = ss(63.6, 64.6, t); }
  else if (t >= 73.4) { pose = t > 75.3 ? 'raise' : 'stand'; }
  if (t > 63.4 && t < 65) embers(t, { n: 80, seed: 41, speed: -120, x0: kx - 60, x1: kx + 60, y0: ky - 500, life: 1.2, alpha: 1 - ss(64.4, 65, t) });
  knight(kx, ky, 3.6, { pose, rot, alpha, rim, rimBlur: 40, flip: -1, sway: Math.sin(t * 2) * 3 });
  if (t > 62.2 && t < 63.6) embers(t, { n: 90, seed: 43, speed: 200, x0: kx - 220, x1: kx + 40, y0: ky - 60, life: 1.5, alpha: 1 - ss(63, 63.6, t) });
  if (t > 67.66 && t < 74) { // humanity rises
    const k = (t - 67.66) / 5.7; humanity(kx - 40 - k * 200, ky - 420 - k * 280, 26 + k * 18, t, win(t, 67.66, 74, 0.4, 0.8));
  }
  ctx.restore();
  banner('BONFIRE LIT', win(t, 57.0, 60.6, 0.25, 0.6), { fill: '#ffd27a', glow: 'rgba(255,140,40,0.9)', font: FONTS.csc(130), y: H * 0.28, band: 0.35, scale: 1 + (t - 57) * 0.01 });
  banner('HUMANITY RESTORED', win(t, 67.7, 72.6, 0.25, 0.6), { fill: '#f6f2ea', glow: 'rgba(255,255,255,0.6)', font: FONTS.csc(104), y: H * 0.28, band: 0.35, scale: 1 + (t - 67.7) * 0.008 });
}
// ── 5 · verse 2: the boss
function sBoss(t) {
  const slowmo = t > 97.26 && t < 99.89, ta = slowmo ? 97.26 + (t - 97.26) * 0.3 : t;
  stoneArena(ta);
  if (slowmo) { ctx.fillStyle = 'rgba(40,70,120,0.25)'; ctx.globalCompositeOperation = 'color'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  const raise = ss(90.3, 91.9, t), down = ss(T_YOUDIED - 0.12, T_YOUDIED, t);
  let arm = lerp(0.3 + Math.sin(ta * 1.2) * 0.15, -2.7, raise); arm = lerp(arm, 0.9, down);
  const hit = 101.6, struck = ss(hit, hit + 0.05, t);
  if (!(t > 93.43 && t < 97.26)) {
    demon(W * 0.58, H * 0.8, 4.0 + ss(82.98, 92, t) * 0.7, ta, { arm, rim: struck ? 'rgba(255,255,255,0.9)' : 'rgba(255,60,20,0.5)', fill: struck ? lerp(0, 1, 0) && '#000' : '#0b0605' });
    if (t > T_YOUDIED && t < T_YOUDIED + 1.2) shockwave(W * 0.5, H * 0.86, t - T_YOUDIED, 1200, '255,90,40', 30);
    if (t > hit) { // light breaking through the demon
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) bolt(W * 0.56, H * 0.45, W * 0.56 + Math.cos(i * 0.8) * 500, H * 0.45 + Math.sin(i * 0.8) * 400, i * 9 + 3, 3, 1 - ss(hit + 0.3, hit + 1.6, t), '255,230,190');
      ctx.restore();
    }
    // the knight: rolling ×500
    let kx = W * 0.3, ky = H * 0.93, rot = 0, trail = 0;
    if (t < 87.93) { const bi = beatIdx(t), ph = clamp((t - BEATS[bi]) / 0.3); kx = W * 0.3 + ((bi % 2) ? 1 : -1) * lerp(160, -160, eOut(ph)); rot = (1 - eOut(ph)) * TAU * ((bi % 2) ? -1 : 1); trail = 1 - ph; }
    else if (t < 90.16) { kx = W * 0.12 + noise1(t * 30) * 6; }
    else if (t > 99.89) { const ph = clamp((t - 100.4) / 0.4); kx = lerp(W * 0.3, W * 0.48, eOut(ph)); rot = (1 - eOut(ph)) * -TAU * (ph > 0); trail = ph > 0 && ph < 1 ? 1 - ph : 0; }
    const dead = ss(T_YOUDIED, T_YOUDIED + 0.6, t) * (t < 93.43);
    for (let g = 3; g >= 1 && trail > 0; g--) knight(kx + g * 40 * trail, ky, 2.3, { alpha: 0.18 * trail, rim: 'rgba(255,140,60,0.5)', rot });
    knight(kx, ky, 2.3, { rim: slowmo ? 'rgba(140,190,255,0.9)' : 'rgba(255,140,60,0.8)', rot: rot - dead * PI / 2, alpha: 1 - dead * 0.6, flip: 1, pose: 'stand' });
    if (slowmo) { // reading the pattern
      const k = (t - 97.26) / 2.63;
      ctx.save(); ctx.setLineDash([18, 14]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(150,200,255,0.85)';
      ctx.beginPath(); ctx.arc(W * 0.6, H * 0.35, 420, PI * 0.55, PI * (0.55 + 0.6 * k)); ctx.stroke();
      ctx.setLineDash([]); ctx.beginPath(); ctx.arc(kx, ky - 120, lerp(240, 60, k), 0, TAU); ctx.stroke();
      text('→', kx + 170, ky - 120, { font: FONTS.russo(90), fill: 'rgba(170,215,255,0.9)', alpha: ss(98.5, 99, t) });
      ctx.restore();
    }
    if (t > 101.4 && t < 102.3) slash(W * 0.15, H * 0.9, W * 0.92, H * 0.12, t - hit, 70, '255,250,240');
    // HUD
    if (t < 87.93) { const n = Math.min(500, Math.floor(eIn((t - 82.98) / 4.9) * 500)); text(`ПЕРЕКАТ ×${n}`, 70, 130, { font: FONTS.russo(46), align: 'left', fill: '#ffcf8a', stroke: '#000', lw: 6 }); }
    if (t > 87.93 && t < 90.16) { flask(W * 0.76, H * 0.48, 4, 1 - ss(88.1, 89.4, t), t); text('ЭСТУС: 0', W * 0.76, H * 0.75, { font: FONTS.russo(56), fill: '#ff9a3a', alpha: ss(89.3, 89.5, t), stroke: '#000', lw: 6 }); }
  } else { // 'снова' and the controller
    bg('#000', '#050000', '#000');
    if (t > 94.71) {
      const sh = (1 + 2 * kick(t)) * 14;
      gamepad(W / 2 + noise1(t * 40) * sh, H * 0.47 + noise1(t * 37 + 3) * sh, 4.6, { rot: noise1(t * 30) * 0.04 });
      cracks(W / 2, H * 0.47, 21, (t - 95.5) / 1.2, 10, 'rgba(255,90,60,0.7)');
    }
  }
  if (t > T_YOUDIED && t < 93.43) {
    ctx.fillStyle = `rgba(0,0,0,${0.55 * ss(T_YOUDIED, T_YOUDIED + 0.4, t)})`; ctx.fillRect(0, 0, W, H);
    banner('YOU DIED', ss(T_YOUDIED + 0.05, T_YOUDIED + 0.5, t), { scale: 1 + (t - T_YOUDIED) * 0.04, glow: 'rgba(120,0,0,0.6)' });
  }
}
// ── 6 · bridge: the golden city
function sAnor(t) {
  const lt = t - 103.25;
  let panX = lt * 90, panY = 0, rot = 0;
  if (t < 107.95) panY = lerp(700, 0, eOut(lt / 4.7));
  if (t > 107.95 && t < 112.82) panX += (t - 107.95) * 300;
  if (t >= 112.82) panX += 4.87 * 300;
  if (t > 117.93 && t < 123.27) { panY = -((t - 117.93) * 900) % 1400; rot = Math.sin((t - 117.93) * 0.9) * 0.18; }
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(rot); ctx.scale(1 + Math.abs(rot), 1 + Math.abs(rot)); ctx.translate(-W / 2, -H / 2);
  goldSky(t, H * 0.55 - panY * 0.1);
  rays(W * 0.62, H * 0.55 - panY * 0.1, t, 28, 1800, 0.12 + 0.08 * beat(t), '255,215,150', 0.015);
  fog(t, 50, 0.22, H * 0.3, H * 0.8);
  city(t, panX, panY, ['#b8774a', '#7d4630', '#40241b', '#160c09'], H * 0.7, 0.9);
  // archers & arrows
  if (t > 112.82 && t < 118.2) {
    const a = ss(112.82, 113.3, t);
    archer(W * 0.18, H * 0.5, 2.6 * a, t, { fill: '#160c08', rim: 'rgba(255,220,160,0.7)', draw: beat(t) });
    archer(W * 0.86, H * 0.42, 2.2 * a, t, { fill: '#160c08', rim: 'rgba(255,220,160,0.7)', flip: -1, draw: beat(t) });
    for (const b of BEATS.filter(b => b > 113 && b < 118.2)) {
      const age = t - b; if (age < 0 || age > 0.5) continue;
      const fromL = Math.round(b * 10) % 2, k = age / 0.5, sx = fromL ? W * 0.2 : W * 0.84, sy = fromL ? H * 0.38 : H * 0.3;
      const ex = W * 0.5 + (hash(b) - 0.5) * 300, ey = H * 0.82, x = lerp(sx, ex, k), y = lerp(sy, ey, k);
      ctx.save(); ctx.strokeStyle = 'rgba(255,240,210,0.95)'; ctx.lineWidth = 4; ctx.shadowColor = 'rgba(255,220,150,1)'; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (ex - sx) * 0.12, y - (ey - sy) * 0.12); ctx.stroke(); ctx.restore();
    }
  }
  ctx.restore();
  // the knight on narrow ledges / falling
  if (t > 107.95 && t < 117.93) {
    const fall = ss(111.4, 112.6, t), run = Math.sin(t * 14) * 4;
    const kx = W * 0.42, ky = H * 0.8 + eIn(fall) * 700 + (t > 112.82 ? 0 : 0);
    if (t < 112.82) knight(kx, ky + Math.abs(run), 2.2, { rim: 'rgba(255,210,140,0.8)', rot: fall * 2.4, sway: run });
    else knight(W * 0.5, H * 0.84, 2.0, { rim: 'rgba(255,210,140,0.8)', sway: Math.sin(t * 3) * 3 });
    if (t < 112.6) { ctx.fillStyle = '#120a07'; ctx.fillRect(kx - 400 - (t - 107.95) * 300 % 200, H * 0.8, 520, 40); }
  }
  if (t > 117.93 && t < 123.27) knight(W / 2 + Math.sin(t * 2) * 120, H * 0.5 + Math.sin(t * 5) * 60, 2.4, { rim: 'rgba(255,210,140,0.9)', rot: t * 4 });
  embers(t, { n: 70, seed: 51, speed: 60, spr: GL.gold, core: '255,240,200', wind: 30, alpha: 0.7 });
  if (t > 123.27) { ctx.fillStyle = `rgba(120,0,0,${0.4 * (1 - ss(123.27, 125.5, t)) + 0.2})`; ctx.globalCompositeOperation = 'multiply'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
}
// ── 7 · rap break: the useless phantom
function sPhantom(t) {
  bg('#05060c', '#0d1220', '#07080d');
  radial(W / 2, H * 0.3, 1200, 'rgba(110,150,255,0.14)', 'rgba(0,0,0,0)', 'lighter');
  ctx.fillStyle = '#05060a';
  for (let i = 0; i < 6; i++) { const x = i * 380 + 60, h = 300 + hash(i) * 300; ctx.fillRect(x, H * 0.78 - h, 90, h); ctx.beginPath(); ctx.arc(x + 45 + 190, H * 0.78 - h + 20, 190, PI, 0); ctx.lineWidth = 40; ctx.strokeStyle = '#05060a'; ctx.stroke(); }
  ctx.fillRect(0, H * 0.78, W, H);
  fog(t, 70, 0.25);
  const cx = W / 2, cy = H * 0.8;
  summonSign(cx + 260, cy, 200, t, win(t, 125.58, 127.2, 0.3, 0.5));
  const ph = ss(126.5, 126.9, t) * (1 - ss(135.9, 137.5, t));
  let mx = cx + 260, my = cy, flip = 1;
  if (t > 130.37) { const a = (t - 130.37) * 3.2; mx = cx + Math.cos(a) * 520; my = cy + Math.sin(a) * 30 - 10; flip = Math.sin(a) > 0 ? -1 : 1; }
  if (ph > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (t > 130.37) for (let g = 1; g <= 5; g++) { const a = (t - g * 0.05 - 130.37) * 3.2; mage(cx + Math.cos(a) * 520, cy + Math.sin(a) * 30 - 10, 2.6, t, { alpha: 0.12 * ph, fill: '#6fa8ff', flip }); }
    mage(mx, my, 2.6, t, { alpha: 0.75 * ph, fill: '#8cc0ff', rim: 'rgba(120,180,255,1)', flag: t > 127.9, flip });
    glow(GL.blue, mx, my - 150, 260, 0.35 * ph); ctx.restore();
    if (t > 135.9) embers(t, { n: 80, seed: 61, speed: 160, spr: GL.blue, core: '200,230,255', x0: mx - 80, x1: mx + 80, y0: my - 100, life: 1.6, alpha: 1 - ss(136.5, 137.7, t) });
  }
  // the player, swarmed
  const struggle = t > 132.69 ? noise1(t * 20) * 14 : 0;
  knight(cx - 140 + struggle, cy, 3.2, { rim: 'rgba(255,140,60,0.8)', sway: Math.sin(t * 3) * 3 });
  if (t > 132.69) for (let i = 0; i < 5; i++) hollow(cx - 520 + i * 90 + Math.sin(t * 3 + i) * 20, cy, 3, t, i, 0, '#020203');
  // REC overlay — the phantom is filming
  if (t > 130.37 && t < 135.9) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4;
    for (const [x, y, sx, sy] of [[90, 90, 1, 1], [W - 90, 90, -1, 1], [90, H - 90, 1, -1], [W - 90, H - 90, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * 60); ctx.lineTo(x, y); ctx.lineTo(x + sx * 60, y); ctx.stroke(); }
    if (Math.floor(t * 2) % 2) { ctx.fillStyle = '#ff2a12'; ctx.beginPath(); ctx.arc(150, 150, 16, 0, TAU); ctx.fill(); }
    ctx.restore();
    text('REC', 185, 152, { font: FONTS.russo(40), align: 'left', fill: '#fff' });
    const s = t - 130.37; text(`00:00:${String(Math.floor(s)).padStart(2, '0')}:${String(Math.floor((s % 1) * 30)).padStart(2, '0')}`, W - 140, 152, { font: FONTS.russo(36), align: 'right', fill: '#fff' });
  }
}
// ── 8 · the deadly duo
function sDuo(t) {
  const close = ss(145.45, 148.2, t), split = W / 2 + Math.sin(t * 1.3) * 40;
  const gap = lerp(140, 0, close) * 0 + 0;
  // left: gold & lightning
  ctx.save(); ctx.beginPath(); ctx.moveTo(-50, -50); ctx.lineTo(split + 200 - close * 120 - gap, -50); ctx.lineTo(split - 200 - close * 120 - gap, H + 50); ctx.lineTo(-50, H + 50); ctx.clip();
  bg('#2b1a08', '#7a5418', '#2a1806'); radial(W * 0.25, H * 0.3, 900, 'rgba(255,220,120,0.35)', 'rgba(0,0,0,0)', 'lighter');
  lancer(W * 0.27 + close * 220, H * 0.92, 3.4, t, { rim: 'rgba(255,220,120,1)', spear: -0.35 + kick(t) * 0.25 });
  for (const b of BEATS.filter(b => b > 137.7 && b < 148.3)) { const age = t - b; if (age >= 0 && age < 0.35) bolt(W * (0.1 + hash(b) * 0.3), -20, W * (0.2 + hash(b * 3) * 0.25), H * 0.9, Math.floor(b * 100), 5, 1 - age / 0.35, '255,230,140'); }
  ctx.restore();
  // right: dark heavy hammer
  ctx.save(); ctx.beginPath(); ctx.moveTo(split + 200 + close * 120 + gap, -50); ctx.lineTo(W + 50, -50); ctx.lineTo(W + 50, H + 50); ctx.lineTo(split - 200 + close * 120 + gap, H + 50); ctx.clip();
  bg('#0a0302', '#2a0d06', '#140603'); radial(W * 0.75, H * 0.9, 900, 'rgba(255,90,30,0.3)', 'rgba(0,0,0,0)', 'lighter');
  const kb = KICKS.filter(k => k > 137.7 && k < 148.3), ki = lastIdx(kb, t), kage = ki >= 0 ? t - kb[ki] : 9;
  const hammer = kage < 0.12 ? lerp(-1.1, 1.3, kage / 0.12) : lerp(1.3, -1.1, ss(0.12, 0.6, kage));
  brute(W * 0.74 - close * 220, H * 0.92, 3.6, t, { rim: 'rgba(255,90,30,0.9)', hammer });
  if (kage < 1.2) shockwave(W * 0.6 - close * 220, H * 0.94, kage, 900, '255,120,50', 24);
  embers(t, { n: 60, seed: 71, speed: 120, x0: W * 0.5, x1: W });
  ctx.restore();
  // seam
  ctx.save(); ctx.strokeStyle = `rgba(255,240,210,${0.6 + 0.4 * beat(t)})`; ctx.lineWidth = 6; ctx.shadowColor = '#fff'; ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.moveTo(split + 200 - close * 120, -50); ctx.lineTo(split - 200 - close * 120, H + 50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(split + 200 + close * 120, -50); ctx.lineTo(split - 200 + close * 120, H + 50); ctx.stroke(); ctx.restore();
  if (close > 0) { knight(W / 2, H * 0.93, 1.6, { fill: '#000', rim: `rgba(255,40,20,${close})` }); ctx.fillStyle = `rgba(160,0,0,${0.25 * close * beat(t)})`; ctx.fillRect(0, 0, W, H); }
  if (t > 142.9 && t < 145.45) { const age = t - 142.9; bolt(-50, H * 0.2, W + 50, H * 0.6, 777, 9, 1 - ss(0.1, 0.6, age), '255,230,150'); }
}
// ── 9 · rage at the creator, then a quiet promise
function sRage(t) {
  if (t < 159.81) {
    const inten = 0.7 + 0.3 * ss(155.8, 157, t) - 0.5 * ss(158.6, 159.8, t);
    bg('#120000', '#300303', '#0a0000');
    ctx.save(); ctx.translate(W / 2, H / 2);
    for (let i = 12; i >= 1; i--) { // tunnel of gothic arches
      const z = ((i - (t * 2.2) % 1) / 12), s = 1 / (z + 0.05) * 0.12;
      ctx.save(); ctx.rotate(t * 0.15 * (i % 2 ? 1 : -1) + i * 0.1); ctx.scale(s, s);
      ctx.strokeStyle = `rgba(${200 + 55 * (1 - z)},${30 * (1 - z)},10,${(1 - z) * 0.7 * inten})`; ctx.lineWidth = 14 / s * 0.5;
      ctx.beginPath(); ctx.moveTo(-500, 600); ctx.lineTo(-500, -100); ctx.quadraticCurveTo(-500, -600, 0, -800); ctx.quadraticCurveTo(500, -600, 500, -100); ctx.lineTo(500, 600); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    for (const b of BEATS.filter(b => b > 148.2 && b < 159.8)) { const age = t - b; if (age >= 0 && age < 0.25) bolt(W * hash(b), -20, W * hash(b * 7), H + 20, Math.floor(b * 77), 4, (1 - age / 0.25) * inten, '255,60,30'); }
    embers(t, { n: 160, seed: 81, speed: 300, spr: GL.red, core: '255,120,90', wind: 0, alpha: inten, life: 3 });
    radial(W / 2, H / 2, 900, `rgba(255,20,0,${0.15 + 0.2 * kick(t)})`, 'rgba(0,0,0,0)', 'lighter');
  } else {
    bg('#000', '#020101', '#000');
    const k = (t - 159.81) / 2.64;
    ctx.globalCompositeOperation = 'lighter'; glow(GL.ember, W / 2, H * 0.55 - k * 120, 40, 0.8); glow(GL.white, W / 2, H * 0.55 - k * 120, 5, 1); ctx.globalCompositeOperation = 'source-over';
  }
}
// ── 10 · final chorus: dawn over the abyss
function sFinal(t) {
  const lt = t - 162.45, rise = eOut(lt / 20), inten = eOut(lt / 0.6) * (1 + 0.5 * ss(178.4, 180, t));
  const sunY = lerp(H * 0.8, H * 0.38, rise);
  bg('#120a18', lerp(0, 1, 1) && '#9a4a22', '#f0b062');
  radial(W / 2, sunY, 1500, `rgba(255,200,120,${0.6 * inten})`, 'rgba(255,120,40,0)', 'lighter');
  ctx.globalCompositeOperation = 'lighter'; glow(GL.white, W / 2, sunY, 220 + 40 * beat(t), 1); ctx.globalCompositeOperation = 'source-over';
  rays(W / 2, sunY, t, 40, 2200, (0.16 + 0.1 * beat(t)) * inten, '255,220,160', 0.025, 1.4);
  city(t, lt * 30, 0, ['#9a5a3a', '#6a3626', '#3a1c14', '#1a0c08'], H * 0.78, 0.5);
  fog(t, 40, 0.25, H * 0.4, H * 0.7);
  // cliff
  ctx.fillStyle = '#070302'; ctx.beginPath(); ctx.moveTo(-50, H + 50); ctx.lineTo(-50, H * 0.83); ctx.lineTo(W * 0.3, H * 0.8); ctx.lineTo(W * 0.62, H * 0.84); ctx.lineTo(W * 0.66, H * 0.9); ctx.lineTo(W * 0.7, H + 50); ctx.closePath(); ctx.fill();
  fire(W * 0.22, H * 0.82, 1.0, t, inten * (1 + 0.2 * kick(t)), 5);
  let pose = 'stand', alpha = 1;
  if (t > 167.79 && t < 170.27) { alpha = 1 - ss(168.0, 168.6, t) + ss(169.1, 169.9, t); }
  if (t > 178.4) pose = 'raise';
  const kx = W * 0.5, ky = H * 0.84;
  knight(kx, ky, 3.4, { pose, alpha: clamp(alpha), rim: 'rgba(255,220,160,1)', rimBlur: 45, sway: Math.sin(t * 2) * 5, blade: pose === 'raise' ? 'rgba(255,240,210,0.6)' : null });
  if (t > 167.9 && t < 170.2) { const conv = ss(169.0, 169.9, t); embers(t, { n: 120, seed: 91, speed: conv ? -40 : 160, x0: kx - 140, x1: kx + 140, y0: ky - 160, life: 1.4, alpha: 1 }); }
  if (pose === 'raise') { ctx.globalCompositeOperation = 'lighter'; const gx = kx + 29 * 3.4, gy = ky - 174 * 3.4; glow(GL.white, gx, gy, 140 + 60 * beat(t), 0.9); rays(gx, gy, t, 6, 400, 0.5, '255,255,240', 0.2, 0.4); ctx.globalCompositeOperation = 'source-over'; }
  embers(t, { n: 220, seed: 95, speed: 200, size: 3.4, wind: 40, alpha: inten, life: 5 });
  if (t > 173.14 && t < 178.6) humanity(kx - 260, ky - 520 - (t - 173.14) * 60, 34, t, win(t, 173.14, 178.6, 0.4, 0.8));
  banner('BONFIRE LIT', win(t, 162.6, 165.8, 0.2, 0.6), { fill: '#ffe2a0', glow: 'rgba(255,170,60,1)', font: FONTS.csc(140), y: H * 0.24, band: 0.3, scale: 1 + (t - 162.6) * 0.012 });
  banner('HUMANITY RESTORED', win(t, 173.2, 177.6, 0.25, 0.6), { fill: '#fffaf0', glow: 'rgba(255,255,255,0.7)', font: FONTS.csc(104), y: H * 0.24, band: 0.3 });
}
// ── 11 · outro
function sOutro(t) {
  const dim = 1 - ss(187.66, 189.5, t) * 0.75, dawn = ss(199, 201, t) * (1 - ss(201.5, 201.8, t)) + ss(203.06, 205, t) * (1 - ss(209, 211.5, t));
  bonfireScene(t, (0.5 * dim + 0.6 * dawn) * (1 - ss(210, 212.5, t)), { scale: 0.8 });
  knight(W / 2 + 330, H * 0.86, 3.6, { pose: 'kneel', flip: -1, rim: `rgba(255,140,60,${0.4 + dawn * 0.5})`, alpha: 1 - ss(209, 211.5, t) });
  ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - dawn)})`; ctx.fillRect(0, 0, W, H);
  if (dawn > 0) rays(W / 2, H * 0.6, t, 30, 1800, 0.15 * dawn, '255,215,150', 0.02);
  const YD = [[187.9, 192.6, 0.95], [193.0, 198.8, 0.7], [201.6, 202.3, 0.9], [202.4, 203.0, 0.9]];
  for (const [a, b, m] of YD) banner('YOU DIED', win(t, a, b, b - a > 2 ? 1 : 0.08, b - a > 2 ? 1.2 : 0.15) * m, { scale: 1 + (t - a) * 0.012, glow: 'rgba(120,0,0,0.6)' });
  banner('VICTORY ACHIEVED', win(t, 199.0, 201.5, 0.4, 0.3), { fill: '#f2cc6e', glow: 'rgba(255,190,80,0.8)', font: FONTS.csc(120), ls: 8 });
  banner('VICTORY ACHIEVED', win(t, 203.06, 211.2, 0.6, 1.6), { fill: '#f2cc6e', glow: 'rgba(255,190,80,0.8)', font: FONTS.csc(120), ls: 8, scale: 1 + (t - 203) * 0.006 });
  if (t > 211) { ctx.globalCompositeOperation = 'lighter'; glow(GL.ember, W / 2, H * 0.74, 30, 1 - ss(212, 213, t)); ctx.globalCompositeOperation = 'source-over'; }
}

const SCENES = [
  { s: 0, e: 12, f: sIntro, shake: 0.2 }, { s: 12, e: 25.21, f: sCorridor, shake: 0.3 }, { s: 25.21, e: 45.4, f: sVerse1, shake: 1 },
  { s: 45.4, e: 56.89, f: sPre, shake: 0.15 }, { s: 56.89, e: 82.98, f: sChorus, shake: 0.7 }, { s: 82.98, e: 103.25, f: sBoss, shake: 1.1 },
  { s: 103.25, e: 125.58, f: sAnor, shake: 0.7 }, { s: 125.58, e: 137.79, f: sPhantom, shake: 1 }, { s: 137.79, e: 148.25, f: sDuo, shake: 1.3 },
  { s: 148.25, e: 162.45, f: sRage, shake: 1.8 }, { s: 162.45, e: 187.66, f: sFinal, shake: 0.9 }, { s: 187.66, e: 999, f: sOutro, shake: 0.1 },
];
const SCREAMS = [[123.27, 125.58], [132.69, 135.72], [135.72, 137.79], [148.25, 159.81]];

// ───────────────────────── post FX ─────────────────────────
function rgbSplit(amt) {
  if (amt < 0.5) return;
  BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0);
  BX2.globalCompositeOperation = 'copy'; BX2.drawImage(BUF, 0, 0); BX2.globalCompositeOperation = 'multiply'; BX2.fillStyle = '#ff0000'; BX2.fillRect(0, 0, W, H);
  BX.globalCompositeOperation = 'multiply'; BX.fillStyle = '#00ffff'; BX.fillRect(0, 0, W, H);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(BUF, -amt, 0);
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(BUF2, amt, 0); ctx.restore();
}
function glitch(t, amt) {
  if (amt < 0.05) return;
  BX.globalCompositeOperation = 'copy'; BX.drawImage(cv, 0, 0);
  const f = Math.floor(t * 15), n = Math.floor(4 + amt * 10);
  for (let i = 0; i < n; i++) {
    const y = hash(f * 13 + i) * H, h = 10 + hash(f * 7 + i * 3) * 90 * amt, dx = (hash(f * 3 + i * 11) - 0.5) * 220 * amt;
    ctx.drawImage(BUF, 0, y, W, h, dx, y, W, h);
  }
}

window.renderFrame = function (t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const sc = SCENES.find(s => t >= s.s && t < s.e) || SCENES[SCENES.length - 1];
  const scream = SCREAMS.some(([a, b]) => t >= a && t < b);
  const en = As('rms', t, 4), bt = beat(t), kk = kick(t);
  const shakeAmt = sc.shake * (kk * 9 + bt * 5 + en * 3) + (scream ? 10 + 14 * kk : 0) + flashAmt(t)[0] * 18;
  const sx = noise1(t * 31) * shakeAmt, sy = noise1(t * 29 + 100) * shakeAmt, rot = noise1(t * 7 + 40) * shakeAmt * 0.0006;
  const zoom = 1.04 + 0.018 * bt * sc.shake + 0.01 * kk;
  ctx.save(); ctx.translate(W / 2 + sx, H / 2 + sy); ctx.rotate(rot); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
  sc.f(t);
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  // lyrics ride a softer shake
  ctx.save(); ctx.translate(sx * 0.35, sy * 0.35); drawLyrics(t); ctx.restore();
  // flashes
  const [fa, fc] = flashAmt(t);
  if (fa > 0.01) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${fc},${clamp(fa * 0.7)})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  rgbSplit((scream ? 6 + 10 * kk : 0) + fa * 14 + sc.shake * kk * 3);
  glitch(t, (scream ? 0.35 + 0.6 * kk : 0) + (t > 135.72 && t < 137.79 ? 0.5 : 0) + (t > 93.43 && t < 94.71 ? 0.4 : 0));
  // vignette, grain, letterbox, fades
  ctx.drawImage(VIGN, 0, 0);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.05; ctx.fillStyle = GRAIN[Math.floor(t * 12) % 4];
  ctx.save(); ctx.translate(Math.floor(hash(Math.floor(t * 12)) * 256), Math.floor(hash(Math.floor(t * 12) + 5) * 256)); ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 54); ctx.fillRect(0, H - 54, W, 54);
  const fade = Math.max(1 - ss(0, 1.2, t), ss(211.8, 213, t));
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
};
window.DURATION = 213.04;
window.ready = Promise.all([document.fonts.load('70px CSC', 'АаZ'), document.fonts.load('italic 600 70px CGI', 'АаZ'), document.fonts.load('70px Russo', 'АаZ')]).then(() => true);
})();
