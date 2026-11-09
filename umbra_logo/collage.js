/* Character collage intro for the Umbra01 logo (?c=1).
 * Phase A (0 → OFF): the characters slam in from every side on a rhythm — glitch, flash, paint swash, neon rim.
 * Then they sink into the background (blurred, darkened, drifting) and the logo plays over them. */
(() => {
if (new URLSearchParams(location.search).get('c') !== '1') return;
const L = window.LOGO, { ctx, W, H, hash, noise1, clamp, lerp, ss, eOut, eIn, eIO, mk, spr, SPR } = L;
const OFF = 2.3;          // logo starts here
const LSTART = 0.2;       // ...from this point of its own timeline (skips its fade-in)
const DUR = OFF + L.DUR - LSTART;
const PI = Math.PI, TAU = 2 * PI;

// slam order, resting place (centre x,y), display height, rotation, entry direction, depth
const CH = [
  { n: 'c5', t0: 0.15, x: 540, y: 360, h: 640, rot: -0.04, from: [0, -1], z: 0, sw: '#7b2cff' },
  { n: 'c2', t0: 0.37, x: 250, y: 900, h: 860, rot: 0.06, from: [-1, 0], z: 1, sw: '#ff3fb4' },
  { n: 'c6', t0: 0.59, x: 830, y: 860, h: 820, rot: -0.07, from: [1, 0], z: 2, sw: '#5a3cff' },
  { n: 'c1', t0: 0.81, x: 380, y: 1560, h: 760, rot: -0.05, from: [-1, 1], z: 3, sw: '#c03cff' },
  { n: 'c3', t0: 1.03, x: 800, y: 1520, h: 820, rot: 0.06, from: [1, 1], z: 4, sw: '#ff3fb4' },
  { n: 'c4', t0: 1.25, x: 230, y: 420, h: 640, rot: 0.08, from: [-1, -1], z: 5, sw: '#8a3cff' },
  { n: 'c7', t0: 1.47, x: 560, y: 1080, h: 980, rot: 0, from: [0, 0], z: 6, sw: '#ff5ad2', hero: true },
];
const ENTER = 0.16, SLAMS = CH.map(c => c.t0 + ENTER);

// pre-rendered looks for each character
function tinted(img, w, h, col, blur = 0, pad = 0) {
  const c = mk(w + pad * 2, h + pad * 2), x = c.getContext('2d');
  if (blur) x.filter = `blur(${blur}px)`; x.drawImage(img, pad, pad, w, h); x.filter = 'none';
  x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c;
}
async function load() {
  const meta = await (await fetch('chars/chars.json')).json();
  for (const c of CH) {
    const img = new Image(); img.src = `chars/${c.n}.png`; await img.decode();
    const sc = c.h / meta[c.n].h, w = Math.round(meta[c.n].w * sc), h = c.h; c.w = w;
    // graded: purple-leaning grade, contrast kept
    const g = mk(w, h), gx = g.getContext('2d'); gx.filter = 'contrast(1.08) saturate(1.1)'; gx.drawImage(img, 0, 0, w, h); gx.filter = 'none';
    gx.globalCompositeOperation = 'multiply'; gx.fillStyle = '#e2c4ff'; gx.fillRect(0, 0, w, h);
    gx.globalCompositeOperation = 'soft-light'; const gr = gx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ff4fd0'); gr.addColorStop(1, '#5a2cff'); gx.globalAlpha = 0.45; gx.fillStyle = gr; gx.fillRect(0, 0, w, h);
    gx.globalAlpha = 1; gx.globalCompositeOperation = 'destination-in'; gx.drawImage(img, 0, 0, w, h);
    c.graded = g;
    // background look: blurred, darker, more purple
    const b = mk(w + 40, h + 40), bx = b.getContext('2d'); bx.filter = 'blur(6px) brightness(0.62) saturate(0.9)'; bx.drawImage(g, 20, 20); bx.filter = 'none';
    bx.globalCompositeOperation = 'source-atop'; bx.fillStyle = 'rgba(70,20,140,0.25)'; bx.fillRect(0, 0, w + 40, h + 40);
    c.bg = b;
    const sw = mk(1080, 520), sx = sw.getContext('2d'); sx.drawImage(L.SWASH, 0, 0); sx.globalCompositeOperation = 'source-atop'; sx.globalAlpha = 0.55; sx.fillStyle = c.sw; sx.fillRect(0, 0, 1080, 520); c.swash = sw;
    c.glow = tinted(img, w, h, c.sw, 18, 40);           // neon rim (blurred silhouette)
    c.white = tinted(img, w, h, '#ffffff');
    c.cyan = tinted(img, w, h, '#2fd8ff'); c.pink = tinted(img, w, h, '#ff2fb4');
  }
  CH.sort((a, b) => a.z - b.z);
  return true;
}

// placement over time (entry, drift, push-back into the background)
function place(c, T) {
  const k = eOut((T - c.t0) / ENTER), d = 900;
  let x = c.x + c.from[0] * d * (1 - k), y = c.y + c.from[1] * d * (1 - k), s = 1;
  if (c.hero) s = lerp(1.55, 1, k);
  const after = Math.max(0, T - c.t0 - ENTER);
  x += Math.sin(after * 0.6 + c.z) * 10 * (1 + c.z * 0.2); y += Math.cos(after * 0.5 + c.z * 2) * 8;
  s *= 1 + 0.025 * Math.min(after, 2);
  const back = ss(1.95, OFF + 0.1, T);                         // sink into the background
  s *= lerp(1, c.hero ? 0.86 : 0.93, back);
  x = lerp(x, W / 2 + (x - W / 2) * 1.04, back);
  if (T > OFF) { const tt = T - OFF; x += Math.sin(tt * 0.4 + c.z * 1.3) * 18; y += Math.cos(tt * 0.33 + c.z) * 14 - tt * 6 * (c.z % 3 - 1); }
  return { x, y, s, k, back, land: T - (c.t0 + ENTER) };
}
function drawSwash(c, P, T) { // a paint stroke behind each character
  const k = eOut((P.land + 0.05) / 0.22); if (k <= 0) return;
  const a = (1 - P.back) * 0.85; if (a <= 0.01) return;
  ctx.save(); ctx.translate(P.x, P.y + c.h * 0.08); ctx.rotate(c.rot * 3 + (c.z % 2 ? 0.25 : -0.25)); ctx.scale(P.s * c.w / 900 * 1.35, P.s * c.h / 900);
  ctx.beginPath(); ctx.rect(-540, -260, 1080 * k, 520); ctx.clip();
  ctx.globalAlpha = a; ctx.drawImage(c.swash, -540, -260);
  ctx.restore();
}
function drawChar(c, T, bgState) {
  if (T < c.t0) return;
  const P = place(c, T), back = bgState ? 1 : P.back;
  ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(c.rot); ctx.scale(P.s, P.s);
  const w = c.w, h = c.h, X = -w / 2, Y = -h / 2;
  if (P.k < 1) for (let g = 1; g <= 3; g++) { // motion trail while entering
    ctx.globalAlpha = 0.18; ctx.drawImage(c.graded, X - c.from[0] * 120 * g * (1 - P.k), Y - c.from[1] * 120 * g * (1 - P.k), w, h);
  }
  const live = 1 - back;
  if (live > 0.01) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.85 * live * (0.8 + 0.2 * Math.sin(T * 6 + c.z)); ctx.drawImage(c.glow, X - 40, Y - 40);
    ctx.globalCompositeOperation = 'source-over';
    const rgb = P.land > 0 ? 22 * Math.exp(-P.land * 14) : 14 * (1 - P.k);
    if (rgb > 0.6) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * live; ctx.drawImage(c.cyan, X - rgb, Y); ctx.drawImage(c.pink, X + rgb, Y + rgb * 0.2); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = live; ctx.drawImage(c.graded, X, Y, w, h);
    if (P.land > 0 && P.land < 0.15) { ctx.globalAlpha = (1 - P.land / 0.15) * 0.9; ctx.drawImage(c.white, X, Y); } // impact flash
  }
  if (back > 0.01) { ctx.globalAlpha = back; ctx.drawImage(c.bg, X - 20, Y - 20); }
  ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function speedBurst(T) { // radial speed lines right after each slam
  let a = 0, idx = -1; SLAMS.forEach((s, i) => { const d = T - s; if (d >= 0 && d < 0.18) { a = 1 - d / 0.18; idx = i; } });
  if (a <= 0) return; const c = CH.find(c => c.t0 + ENTER === SLAMS[idx]) || CH[0], P = place(c, T);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,220,255,${0.55 * a})`;
  for (let i = 0; i < 50; i++) { const an = hash(idx * 31 + i) * TAU, r0 = 260 + hash(i * 7 + idx) * 300, r1 = r0 + 300 + hash(i) * 600; ctx.lineWidth = 1 + 3 * hash(i * 3 + idx); ctx.beginPath(); ctx.moveTo(P.x + Math.cos(an) * r0, P.y + Math.sin(an) * r0); ctx.lineTo(P.x + Math.cos(an) * r1, P.y + Math.sin(an) * r1); ctx.stroke(); }
  ctx.restore();
}
function charsLayer(T, bgState) { for (const c of CH) drawChar(c, T, bgState); }

function phaseA(T) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  let hit = 0; for (const s of SLAMS) if (T >= s) hit = Math.max(hit, Math.exp(-(T - s) * 12) * (s === SLAMS[SLAMS.length - 1] ? 1.6 : 1));
  const shake = 16 * hit, zoom = 1.02 + 0.03 * hit;
  ctx.save(); ctx.translate(W / 2 + noise1(T * 41) * shake, H / 2 + noise1(T * 37 + 5) * shake); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
  L.background(T - OFF + LSTART);   // same clock as the logo phase → seamless hand-off
  for (const c of CH) if (T >= c.t0) drawSwash(c, place(c, T), T);
  charsLayer(T, false);
  speedBurst(T);
  ctx.restore();
  // whole-frame punch: purple flash + RGB split + glitch slices on every slam
  if (hit > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(170,70,255,${0.18 * hit})`; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  L.rgbSplit(10 * hit + (T > 1.95 ? 6 * ss(1.95, OFF, T) : 0));
  L.glitchSlices(T, 0.35 * hit + (T > 2.05 ? 0.5 * ss(2.05, OFF, T) : 0));
  ctx.drawImage(L.VIGN, 0, 0);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.06; ctx.fillStyle = L.GRAIN[Math.floor(T * 30) % 3]; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const fin = 1 - ss(0, 0.15, T); if (fin > 0) { ctx.fillStyle = `rgba(0,0,0,${fin})`; ctx.fillRect(0, 0, W, H); }
}
window.renderFrame = function (T) {
  if (T < OFF) return phaseA(T);
  const lt = T - OFF + LSTART;
  L.renderLogo(lt, () => {
    charsLayer(T, true);
    // the logo's BANG ripples through the background characters
    const ia = lt - L.TL.impact;
    if (ia > 0 && ia < 0.3) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * (1 - ia / 0.3); charsLayer(T, true); ctx.restore(); }
    ctx.fillStyle = 'rgba(10,3,24,0.14)'; ctx.fillRect(-100, -100, W + 200, H + 200); // keep the logo readable
  }, true);
};
window.DURATION = DUR;
window.COLLAGE = { OFF, LSTART, SLAMS };
const base = window.ready;
window.ready = base.then(load);
})();
