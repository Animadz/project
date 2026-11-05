/* Anime-style action animatic — a reference to rebuild in Source Filmmaker.
 * Real 3D: a colour-coded mannequin (orange = RIGHT side, blue = LEFT side), a sword, a scarf,
 * and a camera with position / target / FOV / roll. 24 fps. Character is animated "on twos"
 * (pose updates every 2nd frame), the camera moves on ones — the classic anime contrast.
 * window.renderFrame(frame) draws one frame. ?mode=annotated | clean | sheet */
(() => {
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = 1920, H = 1080, FPS = 24, TOTAL = 312;
const MODE = new URLSearchParams(location.search).get('mode') || 'annotated';

// ───────── math ─────────
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const eOut = k => 1 - Math.pow(1 - clamp(k), 3), eIn = k => Math.pow(clamp(k), 3);
const eIO = k => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const EASE = { lin: k => k, out: eOut, in: eIn, smooth: eIO, hold: () => 0 };
const PI = Math.PI, TAU = 2 * PI, D2R = PI / 180;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]), norm = a => mul(a, 1 / (len(a) || 1));
const vlerp = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const mRx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const mRy = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const mRz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mm = (A, B) => { const r = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r.push(A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]); return r; };
const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];

// ───────── poses ─────────
// limbs: [pitch1, out1, pitch2, out2] — pitch: 0 = down, 90 = forward, 180 = up, -90 = back; out = away from the body.
// sw = sword direction from the right hand [pitch, out]. lean/twist/bend = spine, head = [down, turn].
const POSES = {
  IDLE: { lean: 8, twist: -20, bend: 0, head: [5, 15], rA: [25, 15, 80, 5], lA: [20, 15, 75, -35], rL: [20, 6, -2, 4], lL: [-15, 6, -30, 4], sw: [70, 5] },
  ANTIC: { lean: 30, twist: -55, bend: -5, head: [-10, 50], rA: [-60, 45, -50, 55], lA: [80, -10, 95, -20], rL: [65, 8, -5, 5], lL: [-50, 8, -85, 5], sw: [-80, 50] },
  DASH: { lean: 50, twist: -10, bend: 0, head: [-40, 5], rA: [-75, 20, -90, 25], lA: [-60, 20, -80, 15], rL: [70, 4, 15, 4], lL: [-55, 4, -110, 4], sw: [-115, 15] },
  DASH2: { lean: 42, twist: 15, bend: 0, head: [-35, -10], rA: [95, 5, 100, 0], lA: [-70, 25, -90, 20], rL: [-60, 4, -105, 4], lL: [75, 4, 10, 4], sw: [95, 0] },
  SLIDE: { lean: 20, twist: -30, bend: 8, head: [-10, 25], rA: [-20, 75, -10, 85], lA: [70, 35, 85, 20], rL: [70, 15, 0, 10], lL: [-30, 40, -75, 40], sw: [-30, 85] },
  STRIKE_START: { lean: -15, twist: -10, bend: 0, head: [-5, 8], rA: [165, 8, 200, 0], lA: [160, -8, 195, 5], rL: [35, 8, 0, 5], lL: [-30, 8, -60, 5], sw: [250, 0] },
  STRIKE_END: { lean: 50, twist: -25, bend: 0, head: [-25, 20], rA: [70, -15, 45, -25], lA: [65, -25, 40, -35], rL: [80, 10, -5, 6], lL: [-50, 10, -95, 6], sw: [25, -30] },
  HSLASH_PREP: { lean: 15, twist: -70, bend: 0, head: [0, 65], rA: [90, 70, 90, 95], lA: [80, -35, 85, -70], rL: [10, 30, -5, 30], lL: [-10, 30, -20, 30], sw: [90, 120] },
  HSLASH_END: { lean: 20, twist: 75, bend: 0, head: [0, -60], rA: [90, -60, 90, -95], lA: [-30, 60, -50, 70], rL: [10, 30, -5, 30], lL: [-10, 30, -20, 30], sw: [90, -130] },
  CROUCH: { lean: 35, twist: -15, bend: 0, head: [-25, 10], rA: [10, 30, 30, 40], lA: [20, 25, 10, 0], rL: [80, 10, -10, 8], lL: [80, 10, -10, 8], sw: [40, 60] },
  UPPER: { lean: -20, twist: 20, bend: 0, head: [-30, -10], rA: [170, 0, 175, 0], lA: [-60, 30, -80, 35], rL: [90, 0, 0, 0], lL: [0, 0, 0, 0], sw: [178, 0] },
  TUCK: { lean: 60, twist: 0, bend: 0, head: [-20, 0], rA: [80, 10, 130, 0], lA: [80, -10, 130, 0], rL: [110, 5, -20, 5], lL: [105, 5, -25, 5], sw: [130, 0] },
  LANDING: { lean: 45, twist: 0, bend: 0, head: [-35, 10], rA: [-50, 70, -60, 80], lA: [5, -10, 0, 0], rL: [90, 12, 0, 8], lL: [-5, 10, -90, 10], sw: [-60, 80] },
  FINAL: { lean: 3, twist: 0, bend: 0, head: [-3, 0], rA: [10, 30, 25, 45], lA: [0, 12, 5, 10], rL: [2, 8, 0, 5], lL: [-2, 8, -3, 5], sw: [40, 70] },
};
POSES.IDLE_DOWN = { ...POSES.IDLE, head: [40, 10] };
const POSE_RU = { IDLE: 'Боевая стойка', IDLE_DOWN: 'Стойка, голова опущена', ANTIC: 'Замах (сжатие)', DASH: 'Рывок A', DASH2: 'Рывок B', SLIDE: 'Занос', STRIKE_START: 'Меч над головой', STRIKE_END: 'Удар — конец', HSLASH_PREP: 'Замах вбок', HSLASH_END: 'Горизонтальный удар', CROUCH: 'Присед', UPPER: 'Апперкот', TUCK: 'Группировка (сальто)', LANDING: 'Приземление', FINAL: 'Финальная поза' };
function lerpPose(A, B, k) {
  const r = {};
  for (const key in A) r[key] = Array.isArray(A[key]) ? A[key].map((v, i) => lerp(v, B[key][i], k)) : lerp(A[key], B[key], k);
  return r;
}

// ───────── character tracks (global frames) ─────────
// [frame, pose, interpolation to next key, label]
const CH = [
  [0, 'IDLE_DOWN', 'hold', 'Стойка, голова опущена'],
  [18, 'IDLE_DOWN', 'out', ''],
  [20, 'IDLE', 'hold', 'Голова резко вверх: 2 кадра'],
  [32, 'IDLE', 'out', ''],
  [36, 'ANTIC', 'hold', 'ЗАМАХ: держать 20 кадров + дрожь'],
  [56, 'DASH', 'hold', 'РЫВОК: исчез, остался шлейф'],
  [74, 'DASH2', 'hold', 'Рывок 2: новая поза'],
  [86, 'SLIDE', 'hold', 'Рывок 3: занос'],
  [100, 'DASH', 'hold', 'Рывок 4'],
  [112, 'STRIKE_START', 'hold', 'Меч над головой: держать 6'],
  [118, 'STRIKE_START', 'lin', ''],
  [122, 'STRIKE_END', 'hold', 'УДАР: конечная поза'],
  [178, 'HSLASH_PREP', 'hold', 'Замах вбок: держать 6'],
  [184, 'HSLASH_PREP', 'lin', ''],
  [188, 'HSLASH_END', 'hold', 'Удар 1: горизонтальный'],
  [194, 'CROUCH', 'hold', 'Присед перед прыжком'],
  [198, 'CROUCH', 'lin', ''],
  [202, 'UPPER', 'hold', 'Удар 2: апперкот + прыжок'],
  [210, 'TUCK', 'hold', 'Сальто: вращение на двойках'],
  [226, 'TUCK', 'out', ''],
  [228, 'STRIKE_START', 'hold', 'Пик прыжка: замах'],
  [236, 'STRIKE_START', 'lin', ''],
  [240, 'LANDING', 'hold', 'ПРИЗЕМЛЕНИЕ: удар об землю'],
  [276, 'LANDING', 'smooth', 'Встаёт: плавно, 12 кадров'],
  [288, 'FINAL', 'hold', 'Финальная поза'],
];
// root: [frame, {x,y,z,pitch,air,hidden}, interpolation]
const RT = [
  [0, { z: 0 }, 'hold'],
  [56, { z: 0, hidden: 1 }, 'hold'],
  [60, { z: 6 }, 'lin'],
  [72, { z: 7.5, hidden: 1 }, 'hold'],
  [74, { z: 11 }, 'lin'],
  [84, { z: 12.5, hidden: 1 }, 'hold'],
  [86, { z: 16 }, 'lin'],
  [98, { z: 17.5, hidden: 1 }, 'hold'],
  [100, { z: 21 }, 'lin'],
  [111, { z: 22.2 }, 'hold'],
  [112, { z: 22.5 }, 'hold'],
  [118, { z: 22.5 }, 'out'],
  [122, { z: 23.6 }, 'hold'],
  [178, { z: 24 }, 'hold'],
  [198, { z: 24 }, 'out'],
  [204, { z: 24.1, y: 1.2, air: 1 }, 'out'],
  [210, { z: 24.3, y: 1.8, air: 1 }, 'lin'],
  [226, { z: 25, y: 2.8, air: 1, pitch: 360 }, 'out'],
  [228, { z: 25.2, y: 3.0, air: 1, pitch: 360 }, 'hold'],
  [234, { z: 25.2, y: 3.0, air: 1 }, 'hold'],
  [236, { z: 25.2, y: 3.0, air: 1 }, 'in'],
  [240, { z: 25.5, y: 0 }, 'hold'],
];
const rootDef = r => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, air: 0, hidden: 0, ...r });
function track(keys, f, isPose) {
  let i = keys.length - 1; while (i > 0 && keys[i][0] > f) i--;
  const a = keys[i], b = keys[i + 1];
  const A = isPose ? POSES[a[1]] : rootDef(a[1]);
  if (!b || a[2] === 'hold' || f <= a[0]) return { v: A, key: a, k: 0, i };
  const B = isPose ? POSES[b[1]] : rootDef(b[1]), k = EASE[a[2]]((f - a[0]) / (b[0] - a[0]));
  if (isPose) return { v: lerpPose(A, B, k), key: a, k, i };
  const r = { ...A }; for (const n of ['x', 'y', 'z', 'yaw', 'pitch', 'roll']) r[n] = lerp(A[n], B[n], k);
  return { v: r, key: a, k, i };
}
const twos = f => f - (f % 2);
function charAt(f, onOnes = false) {
  const g = onOnes ? f : twos(f);
  const p = track(CH, g, true).v, r = track(RT, g, false).v;
  if (g >= 36 && g < 56) { r.x += noise1(g * 1.7) * 0.012; r.z += noise1(g * 1.3 + 9) * 0.012; } // tension tremble
  if (g >= 240 && g < 276) p.lean += Math.sin(g * 0.25) * 1.5; // moving hold: breathing
  return { pose: p, root: r };
}

// ───────── forward kinematics ─────────
function dirPO(p, o, sgn) { p *= D2R; o *= D2R; const c = Math.cos(o), s = Math.sin(o); return [s * sgn, -Math.cos(p) * c, Math.sin(p) * c]; }
function fk(P, R) {
  const Mr = mm(mRy(R.yaw * D2R), mm(mRx(R.pitch * D2R), mRz(R.roll * D2R)));
  const pel = [R.x, R.y + 1.0, R.z];
  const Mp = mm(Mr, mRy(P.twist * 0.25 * D2R));
  const Mc = mm(Mr, mm(mRy(P.twist * D2R), mm(mRx(P.lean * D2R), mRz(P.bend * D2R))));
  const Mh = mm(Mc, mm(mRy(P.head[1] * D2R), mRx(P.head[0] * D2R)));
  const at = (b, M, v) => add(b, mv(M, v));
  const limb = (b, M, a, sgn, l1, l2) => { const j = at(b, M, mul(dirPO(a[0], a[1], sgn), l1)); return [j, at(j, M, mul(dirPO(a[2], a[3], sgn), l2))]; };
  const J = { pel, chest: at(pel, Mc, [0, 0.38, 0]), neck: at(pel, Mc, [0, 0.6, 0]) };
  J.head = at(J.neck, Mh, [0, 0.15, 0]); J.face = mv(Mh, [0, 0, 1]);
  J.shR = at(pel, Mc, [-0.21, 0.55, 0]); J.shL = at(pel, Mc, [0.21, 0.55, 0]);
  [J.elR, J.haR] = limb(J.shR, Mc, P.rA, -1, 0.3, 0.28); [J.elL, J.haL] = limb(J.shL, Mc, P.lA, 1, 0.3, 0.28);
  J.hipR = at(pel, Mp, [-0.11, -0.04, 0]); J.hipL = at(pel, Mp, [0.11, -0.04, 0]);
  [J.knR, J.ftR] = limb(J.hipR, Mp, P.rL, -1, 0.46, 0.46); [J.knL, J.ftL] = limb(J.hipL, Mp, P.lL, 1, 0.46, 0.46);
  const sd = mv(Mc, dirPO(P.sw[0], P.sw[1], -1));
  J.tip = add(J.haR, mul(sd, 1.05)); J.pom = add(J.haR, mul(sd, -0.16)); J.guard = add(J.haR, mul(sd, 0.02));
  J.guardN = norm(cross(sd, mv(Mc, [0, 0, 1])));
  if (!R.air) {
    const m = Math.min(J.ftR[1], J.ftL[1], J.knR[1] - 0.06, J.knL[1] - 0.06, J.haL[1] - 0.04), dy = R.y - m;
    for (const k in J) if (!['face', 'guardN'].includes(k)) J[k] = [J[k][0], J[k][1] + dy, J[k][2]];
  }
  return J;
}
const jointsAt = (f, onOnes) => { const c = charAt(f, onOnes); return { J: fk(c.pose, c.root), root: c.root }; };

// ───────── camera ─────────
let CAM = null;
function setCam(pos, target, fov, roll) {
  const fw = norm(sub(target, pos)); let rt = norm(cross(fw, [0, 1, 0])); let up = cross(rt, fw);
  const r = roll * D2R, c = Math.cos(r), s = Math.sin(r);
  [rt, up] = [add(mul(rt, c), mul(up, s)), add(mul(up, c), mul(rt, -s))];
  CAM = { pos, target, fov, roll, fw, rt, up, focal: (H / 2) / Math.tan(fov * D2R / 2) };
}
const NEAR = 0.08;
const toCam = p => { const d = sub(p, CAM.pos); return [dot(d, CAM.rt), dot(d, CAM.up), dot(d, CAM.fw)]; };
const proj = c => [W / 2 + c[0] / c[2] * CAM.focal, H / 2 - c[1] / c[2] * CAM.focal];
function clipSeg(a, b) {
  if (a[2] < NEAR && b[2] < NEAR) return null;
  if (a[2] < NEAR) a = vlerp(a, b, (NEAR - a[2]) / (b[2] - a[2]));
  else if (b[2] < NEAR) b = vlerp(b, a, (NEAR - b[2]) / (a[2] - b[2]));
  return [a, b];
}
function clipPoly(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ai = a[2] >= NEAR, bi = b[2] >= NEAR;
    if (ai) out.push(a);
    if (ai !== bi) out.push(vlerp(a, b, (NEAR - a[2]) / (b[2] - a[2])));
  }
  return out;
}

// ───────── palette (normal / impact frames) ─────────
let PAL;
const PAL_N = { outline: '#0c0e16', torso: '#e6e0d2', R: '#e8613a', L: '#3f80dc', head: '#f3eee4', visor: '#15171f', blade: '#eaf6ff', hilt: '#c49a45', scarf: '#d92b35', pillar: '#2a2540', rock: '#1d1a2b', ghost: 'rgba(120,220,255,0.28)' };
const PAL_A = { outline: '#000', torso: '#000', R: '#000', L: '#000', head: '#000', visor: '#000', blade: '#000', hilt: '#000', scarf: '#000', pillar: '#000', rock: '#000', ghost: 'rgba(0,0,0,0.3)' };
const PAL_B = { outline: '#fff', torso: '#fff', R: '#fff', L: '#fff', head: '#fff', visor: '#fff', blade: '#fff', hilt: '#fff', scarf: '#fff', pillar: '#fff', rock: '#fff', ghost: 'rgba(255,255,255,0.3)' };

// ───────── drawing primitives ─────────
let DRAW = [];
function capsule(a, b, r, col, ol = 5, alpha = 1) {
  const s = clipSeg(toCam(a), toCam(b)); if (!s) return;
  const z = (s[0][2] + s[1][2]) / 2, w = 2 * r * CAM.focal / z, pa = proj(s[0]), pb = proj(s[1]);
  DRAW.push({ z, f: () => {
    ctx.globalAlpha = alpha; ctx.lineCap = 'round';
    if (ol) { ctx.strokeStyle = PAL.outline; ctx.lineWidth = w + ol * 2; ctx.beginPath(); ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.stroke(); }
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.stroke(); ctx.globalAlpha = 1;
  } });
}
function ball(p, r, col, ol = 5, extra) {
  const c = toCam(p); if (c[2] < NEAR) return;
  const pr = r * CAM.focal / c[2], pp = proj(c);
  DRAW.push({ z: c[2] - 0.01, f: () => {
    ctx.fillStyle = PAL.outline; ctx.beginPath(); ctx.arc(pp[0], pp[1], pr + ol, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pp[0], pp[1], pr, 0, TAU); ctx.fill(); if (extra) extra(pp, pr);
  } });
}
function flush() { DRAW.sort((a, b) => b.z - a.z); for (const d of DRAW) d.f(); DRAW = []; }
function line3(a, b, col, w = 2) { const s = clipSeg(toCam(a), toCam(b)); if (!s) return; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...proj(s[0])); ctx.lineTo(...proj(s[1])); ctx.stroke(); }
function poly3(pts, fill) { const c = clipPoly(pts.map(toCam)); if (c.length < 3) return; ctx.fillStyle = fill; ctx.beginPath(); c.forEach((p, i) => { const q = proj(p); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); ctx.fill(); }
function glowAt(x, y, r, col, a) { if (a <= 0) return; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }

// ───────── world ─────────
function world(f, impact) {
  if (impact === 'A') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); return; }
  if (impact === 'B') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-CAM.roll * D2R);
  const hy = -Math.tan(Math.asin(clamp(CAM.fw[1], -0.99, 0.99))) * CAM.focal; // horizon height (screen, roll-free)
  const g = ctx.createLinearGradient(0, hy - 900, 0, hy + 10);
  g.addColorStop(0, '#1b1838'); g.addColorStop(0.6, '#5a3a62'); g.addColorStop(0.92, '#e48a5a'); g.addColorStop(1, '#ffc07a');
  ctx.fillStyle = g; ctx.fillRect(-W * 1.5, -H * 3, W * 3, H * 6); ctx.restore();
  // sun
  const sc = toCam(add(CAM.pos, mul(norm([0.25, 0.12, 1]), 500)));
  if (sc[2] > 0) { const [x, y] = proj(sc); glowAt(x, y, 520, '255,190,120', 0.55); glowAt(x, y, 70, '255,245,220', 1); }
  poly3([[-300, 0, -300], [300, 0, -300], [300, 0, 400], [-300, 0, 400]], '#2a2236');
  ctx.globalAlpha = 0.55;
  for (let x = -20; x <= 20; x += 2) line3([x, 0, -20], [x, 0, 90], x === 0 ? '#8a6aa0' : '#463a58', x === 0 ? 3 : 1.5);
  for (let z = -20; z <= 90; z += 2) line3([-20, 0, z], [20, 0, z], z % 10 === 0 ? '#7a5c8e' : '#463a58', z % 10 === 0 ? 3 : 1.5);
  ctx.globalAlpha = 1;
  for (let z = -6; z <= 70; z += 5) { capsule([-4.6, 0, z], [-4.6, 6, z], 0.38, PAL.pillar, 3); if (z % 10 === 4 || z % 10 === -6) capsule([4.8, 0, z + 2], [4.8, 4, z + 2], 0.35, PAL.pillar, 3); }
  for (let z = 3; z <= 60; z += 7) capsule([3.2, 0.2, z], [3.2, 0.5, z + 0.3], 0.45, PAL.rock, 3);
}

// ───────── character ─────────
function drawChar(J, opt = {}) {
  const P = opt.ghost ? { ...PAL, torso: PAL.ghost, R: PAL.ghost, L: PAL.ghost, head: PAL.ghost, blade: PAL.ghost, hilt: PAL.ghost, scarf: PAL.ghost } : PAL;
  const ol = opt.ghost ? 0 : 5, a = opt.alpha ?? 1;
  capsule(J.pel, J.chest, 0.15, P.torso, ol, a); capsule(J.chest, J.neck, 0.17, P.torso, ol, a);
  capsule(J.shR, J.shL, 0.08, P.torso, ol, a); capsule(J.hipR, J.hipL, 0.11, P.torso, ol, a);
  capsule(J.shR, J.elR, 0.065, P.R, ol, a); capsule(J.elR, J.haR, 0.055, P.R, ol, a);
  capsule(J.shL, J.elL, 0.065, P.L, ol, a); capsule(J.elL, J.haL, 0.055, P.L, ol, a);
  capsule(J.hipR, J.knR, 0.085, P.R, ol, a); capsule(J.knR, J.ftR, 0.07, P.R, ol, a);
  capsule(J.hipL, J.knL, 0.085, P.L, ol, a); capsule(J.knL, J.ftL, 0.07, P.L, ol, a);
  capsule(J.guard, J.tip, 0.025, P.blade, opt.ghost ? 0 : 3, a); capsule(J.pom, J.guard, 0.03, P.hilt, ol ? 3 : 0, a);
  capsule(add(J.guard, mul(J.guardN, 0.12)), add(J.guard, mul(J.guardN, -0.12)), 0.022, P.hilt, ol ? 3 : 0, a);
  if (opt.ghost) { capsule(J.neck, J.head, 0.14, P.head, 0, a); return; }
  const faceP = add(J.head, mul(J.face, 0.11));
  ball(J.head, 0.14, P.head, ol, (pp, pr) => { // visor shows where the head looks
    const fc = toCam(faceP); if (fc[2] < NEAR) return; const fp = proj(fc), hc = toCam(J.head);
    if (fc[2] < hc[2]) { ctx.fillStyle = P.visor; ctx.beginPath(); ctx.ellipse(fp[0], fp[1], pr * 0.55, pr * 0.22, Math.atan2(fp[1] - pp[1], fp[0] - pp[0]) + PI / 2, 0, TAU); ctx.fill(); }
  });
}
function scarf(f) { // secondary motion: follows the neck's past positions (lags 2 frames per segment)
  if (!charVisible(f)) return;
  let prev = jointsAt(f).J.neck; prev = add(prev, [0, -0.02, 0]);
  for (let k = 1; k <= 8; k++) {
    const past = jointsAt(Math.max(0, f - 2 * k)).J.neck, target = add(past, [0.03 * Math.sin(f * 0.3 + k), -0.09 * k - 0.04, -0.045 * k]);
    let d = sub(target, prev); const L = len(d); if (L > 0.17) d = mul(d, 0.17 / L);
    const p = add(prev, d); capsule(prev, p, 0.065 - k * 0.004, PAL.scarf, 3); prev = p;
  }
}
const charVisible = f => !track(RT, twos(f), false).v.hidden;
function swordTrail(f, n = 4, alpha = 0.7) {
  const pts = []; for (let k = 0; k <= n; k++) { const J = jointsAt(f - k, true).J; pts.push([toCam(J.guard), toCam(J.tip)]); }
  if (pts.some(([a, b]) => a[2] < NEAR || b[2] < NEAR)) return 0;
  const speed = len(sub(pts[0][1], pts[n][1])); if (speed < 0.25) return 0;
  ctx.save(); ctx.globalCompositeOperation = PAL === PAL_N ? 'lighter' : 'source-over';
  for (let k = 0; k < n; k++) {
    const [a0, b0] = pts[k], [a1, b1] = pts[k + 1];
    ctx.fillStyle = PAL === PAL_N ? `rgba(200,235,255,${alpha * (1 - k / n)})` : PAL.blade;
    ctx.beginPath(); ctx.moveTo(...proj(a0)); ctx.lineTo(...proj(b0)); ctx.lineTo(...proj(b1)); ctx.lineTo(...proj(a1)); ctx.closePath(); ctx.fill();
  }
  ctx.restore(); return speed;
}
function ghosts(f) { // afterimages while the character is "teleporting"
  const g = twos(f), r = track(RT, g, false); if (!r.v.hidden) return;
  const from = rootDef(r.key[1]), to = rootDef(RT[r.i + 1][1]), k = (g - r.key[0] + 1) / (RT[r.i + 1][0] - r.key[0]);
  const pose = track(CH, Math.max(0, r.key[0] - 2), true).v;
  for (let i = 0; i < 4; i++) {
    const t = clamp(k - i * 0.18); const root = { ...from, z: lerp(from.z, to.z, t), x: lerp(from.x, to.x, t), hidden: 0 };
    drawChar(fk(pose, root), { ghost: true, alpha: 0.9 - i * 0.2 });
  }
  const a = toCam([from.x, 1.1, from.z]), b = toCam([to.x, 1.1, lerp(from.z, to.z, clamp(k))]);
  if (a[2] > NEAR && b[2] > NEAR) for (let i = 0; i < 9; i++) {
    const o = (hash(g * 3 + i) - 0.5) * 1.2, a2 = toCam([from.x, 0.3 + hash(i + g) * 1.6, from.z]), b2 = toCam([to.x, 0.3 + hash(i + g) * 1.6, lerp(from.z, to.z, clamp(k))]);
    if (a2[2] < NEAR || b2[2] < NEAR) continue;
    ctx.strokeStyle = PAL === PAL_N ? 'rgba(220,245,255,0.75)' : PAL.blade; ctx.lineWidth = 3 + o * 2;
    ctx.beginPath(); ctx.moveTo(...proj(a2)); ctx.lineTo(...proj(b2)); ctx.stroke();
  }
}

// ───────── FX ─────────
function speedLines(f, amt, cx = W / 2, cy = H / 2, col) {
  if (amt <= 0) return; const g = twos(f), n = Math.floor(70 * amt);
  ctx.save(); ctx.strokeStyle = col || (PAL === PAL_A ? '#000' : 'rgba(255,255,255,0.75)');
  for (let i = 0; i < n; i++) {
    const a = hash(g * 7 + i) * TAU, r0 = (0.33 + 0.35 * hash(g + i * 3)) * W * 0.6, r1 = W * 1.2;
    ctx.lineWidth = 1 + 5 * hash(i * 5 + g); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
  }
  ctx.restore();
}
function streaks(f, amt, ang = 0) {
  if (amt <= 0) return; const g = twos(f);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(ang); ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 40 * amt; i++) { const y = (hash(g * 5 + i) - 0.5) * H * 1.4, x = (hash(g * 11 + i * 3) - 0.5) * W * 1.6, l = 200 + 600 * hash(i + g); ctx.lineWidth = 1 + 3 * hash(i * 7); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y); ctx.stroke(); }
  ctx.restore();
}
function dust(pos, age, n = 26, spd = 1.6) {
  if (age < 0 || age > 1.2) return;
  for (let i = 0; i < n; i++) {
    const a = hash(i * 3.3) * TAU, v = spd * (0.5 + hash(i * 7.1));
    const p = add(pos, [Math.cos(a) * v * eOut(age), 0.1 + hash(i) * 0.8 * eOut(age), Math.sin(a) * v * eOut(age)]);
    const c = toCam(p); if (c[2] < NEAR) continue; const q = proj(c), r = (0.1 + 0.18 * age) * CAM.focal / c[2];
    ctx.fillStyle = `rgba(230,210,200,${0.45 * (1 - age / 1.2)})`; ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, TAU); ctx.fill();
  }
}
function ring(pos, rad, a, col = '255,230,200', w = 8) {
  if (a <= 0) return; ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = w; ctx.beginPath(); let first = true;
  for (let i = 0; i <= 48; i++) { const t = i / 48 * TAU, c = toCam(add(pos, [Math.cos(t) * rad, 0, Math.sin(t) * rad])); if (c[2] < NEAR) { first = true; continue; } const q = proj(c); first ? ctx.moveTo(...q) : ctx.lineTo(...q); first = false; }
  ctx.stroke();
}
function sparks(f, center, n = 40, amp = 1.8, col = '255,220,160') {
  for (let i = 0; i < n; i++) {
    const p = add(center, [(hash(i) - 0.5) * amp * 2 + Math.sin(f * 0.02 + i) * 0.2, (hash(i * 3) - 0.3) * amp + f * 0.004 * hash(i * 5), (hash(i * 7) - 0.5) * amp * 2]);
    const c = toCam(p); if (c[2] < NEAR) continue; const q = proj(c); glowAt(q[0], q[1], 0.06 * CAM.focal / c[2], col, 0.9);
  }
}

// ───────── shots ─────────
const smoothRoot = (f, win = 10) => { let s = [0, 0, 0]; for (let k = 0; k < win; k++) { const r = track(RT, Math.max(0, f - k), false).v; s = add(s, [r.x, r.y, r.z]); } return mul(s, 1 / win); };
const SH = [
  { name: 'Затишье', f0: 0, f1: 30, move: 'Медленный наезд на лицо',
    notes: ['Камера плавно едет к лицу, FOV 32→24.', 'Голова поднимается рывком за 2 кадра (18→20).', 'Контраст: камера плавная, персонаж статичен.'],
    cam: f => { const k = eIO(f / 29); return [vlerp([0.5, 1.6, 2.9], [0.25, 1.68, 1.9], k), [0, 1.62, 0], lerp(32, 24, k), 0]; },
    fx: f => ({ flash: f >= 20 && f < 24 ? 0.25 : 0 }) },
  { name: 'Замах', f0: 30, f1: 54, move: 'Нижний ракурс, наклон горизонта 12°',
    notes: ['Камера у самой земли (0.25 м), смотрит снизу вверх.', 'Переход в замах за 4 кадра (32→36), дальше держать позу.', 'В удержании: дрожь ±1 см на двойках.'],
    cam: f => { const k = eIO((f - 30) / 24); return [vlerp([2.4, 0.25, 2.2], [1.9, 0.22, 1.7], k), [0, 1.1, 0.3], lerp(48, 40, k), 12]; },
    fx: f => ({ shake: f > 36 ? 0.004 : 0 }) },
  { name: 'Рывок', f0: 54, f1: 64, move: 'WHIP PAN: поворот ~80° за 4 кадра',
    notes: ['Камера стоит на месте и только поворачивается.', 'Кадр 56: персонаж исчезает, остаются шлейф и пыль.', 'Поворот 56→60, к кадру 60 он уже в 6 м впереди.'],
    cam: f => { const k = eIO((f - 56) / 4); return [[-2.8, 1.3, 2.5], vlerp([0, 1.0, 0.2], [0, 1.0, 8.5], k), 45, lerp(0, -10, k)]; },
    fx: f => ({ speed: f >= 56 ? 1 : 0, dust: [[0, 0, 0], 56] }) },
  { name: 'Перемещение рывками', f0: 64, f1: 112, move: 'Слежение сбоку с отставанием',
    notes: ['Каждый рывок: поза держится ~10 кадров, скользит вперёд,', 'потом 2 кадра пусто (шлейф) и сразу новая поза на 3–4 м дальше.', 'Камера = среднее положение за 10 кадров: отстаёт и догоняет.'],
    cam: f => { const b = smoothRoot(f); return [add(b, [5.2, 1.2, -1.0]), add(b, [0, 1.0, 1.6]), 38, -4 + 3 * Math.sin(f * 0.08)]; },
    fx: f => ({ streak: 0.6, dust: [[0, 0, 11], 74], dust2: [[0, 0, 16], 86], dust3: [[0, 0, 21], 100] }) },
  { name: 'Удар в камеру', f0: 112, f1: 130, move: 'Сверхширокий угол FOV 95→105',
    notes: ['Камера в 2 м перед персонажем, FOV 95: перспектива ломается.', 'Кадр 120: SMEAR (промежуточная поза + шлейф меча).', 'Кадры 122–125: IMPACT (белый/чёрный), затем тряска.'],
    cam: f => { const k = ss(122, 126, f); return [vlerp([0.6, 0.9, 25.6], [0.7, 0.95, 26.0], k), [0, 1.35, 23], lerp(95, 105, eOut((f - 122) / 3)), 14]; },
    fx: f => ({ impact: f >= 122 && f < 124 ? 'A' : f >= 124 && f < 126 ? 'B' : null, shake: f >= 122 ? 0.12 * Math.exp(-(f - 122) / 4) : 0, flash: f >= 126 && f < 128 ? 0.4 : 0, trail: 1 }) },
  { name: 'Заморозка + облёт', f0: 130, f1: 178, move: 'Орбита 180° вокруг замершего героя',
    notes: ['Персонаж НЕ двигается: стоп-кадр в позе удара.', 'Камера облетает 180° за 48 кадров (ease in-out).', 'Искры висят в воздухе: время остановилось.'],
    cam: f => { const k = eIO((f - 130) / 48), a = lerp(0.35, PI + 0.35, k), c = [0, 1.1, 23.6]; return [add(c, [Math.sin(a) * 4.3, lerp(0.7, 0.2, k), Math.cos(a) * 4.3]), c, 38, lerp(0, 8, k)]; },
    fx: f => ({ freeze: 1 }) },
  { name: 'Комбо 1: горизонтальный удар', f0: 178, f1: 194, move: 'Голландский угол +20°',
    notes: ['Замах держать 6 кадров, удар за 4 (184→188).', 'Кадр 186: SMEAR, широкая дуга меча.', 'Короткий шот, склейка сразу после удара.'],
    cam: f => { const k = eIO((f - 178) / 16); return [vlerp([2.6, 1.5, 26.8], [2.2, 1.4, 26.2], k), [0, 1.2, 24], 50, 20]; },
    fx: f => ({ shake: f >= 188 ? 0.06 * Math.exp(-(f - 188) / 3) : 0, flash: f >= 188 && f < 190 ? 0.35 : 0, trail: 1 }) },
  { name: 'Комбо 2: апперкот', f0: 194, f1: 210, move: 'Камера с пола, наклон −15°, тилт вверх',
    notes: ['Присед 4 кадра (сжатие перед прыжком).', 'Кадр 200: SMEAR, удар вверх с отрывом от земли.', 'Камера поворачивается вверх вслед за героем.'],
    cam: f => { const y = track(RT, f, false).v.y; return [[1.2, 0.15, 26.5], [0, 1.0 + y * 0.9, 24.1], 60, -15]; },
    fx: f => ({ speed: f >= 202 ? 0.7 : 0, trail: 1 }) },
  { name: 'Комбо 3: сальто', f0: 210, f1: 234, move: 'Облёт снизу-сбоку, крен 10°→−5°',
    notes: ['Вращение на 360° за 16 кадров, на двойках = 8 фаз.', 'Именно двойки делают вращение «аниме-рваным».', 'Кадр 228: пик прыжка, замах для приземления.'],
    cam: f => { const k = eIO((f - 210) / 24), y = track(RT, f, false).v.y, a = lerp(0.3, 1.0, k); return [[Math.cos(a) * 4.2, y + 0.4, 25 - Math.sin(a) * 4.2], [0, y + 1.0, 25], 45, lerp(10, -5, k)]; },
    fx: f => ({ speed: 0.8, cx: 0 }) },
  { name: 'Приземление', f0: 234, f1: 270, move: 'Низко сзади-сбоку, затем отъезд',
    notes: ['Падение с 3 м за 4 кадра (ease in): удар в землю на кадре 240.', 'Кадры 240–241 IMPACT, ударная волна, пыль, тряска.', 'После: «живое удержание» (дыхание), шарф оседает.'],
    cam: f => { const k = eIO((f - 246) / 24), y = track(RT, f, false).v.y; return [vlerp([1.7, 0.45, 22.3], [2.6, 1.5, 20.8], k), [0, lerp(1.0 + y * 0.8, 0.8, ss(236, 240, f)), 25.5], 55, 6]; },
    fx: f => ({ impact: f >= 240 && f < 242 ? 'A' : null, shake: f >= 240 ? 0.14 * Math.exp(-(f - 240) / 5) : 0, flash: f >= 242 && f < 244 ? 0.4 : 0, ring: [[0, 0.03, 25.5], 240], dust: [[0, 0, 25.5], 240] }) },
  { name: 'Финал', f0: 270, f1: 312, move: 'Медленный отъезд из-за спины',
    notes: ['Встаёт плавно (12 кадров): после экшена контраст покоя.', 'Камера отъезжает и поднимается за спиной.', 'Кадр 292: запоздалый взрыв вдалеке, вспышка, затемнение.'],
    cam: f => { const k = eIO((f - 270) / 42); return [vlerp([0.6, 1.5, 22.8], [1.0, 2.4, 19.5], k), [0, 1.6, 33], 45, 0]; },
    fx: f => ({ boom: 292, flash: f >= 292 && f < 296 ? 0.5 * (1 - (f - 292) / 4) : 0 }) },
];
SH.forEach((s, i) => s.n = i + 1);
const shotAt = f => SH.find(s => f >= s.f0 && f < s.f1) || SH[SH.length - 1];

// ───────── events for annotations ─────────
const EVENTS = [
  [20, 'ГОЛОВА: РЫВОК 2 КАДРА', '#ffd166'], [56, 'ИСЧЕЗ: ШЛЕЙФ', '#7fdcff'], [72, 'ИСЧЕЗ', '#7fdcff'], [84, 'ИСЧЕЗ', '#7fdcff'], [98, 'ИСЧЕЗ', '#7fdcff'],
  [120, 'SMEAR: 1 ПОЗА', '#7fdcff'], [122, 'IMPACT A: БЕЛЫЙ', '#ffffff'], [124, 'IMPACT B: ЧЁРНЫЙ', '#ffffff'], [130, 'ЗАМОРОЗКА', '#a0e0ff'],
  [186, 'SMEAR', '#7fdcff'], [188, 'УДАР', '#ff7b54'], [200, 'SMEAR', '#7fdcff'], [202, 'УДАР + ПРЫЖОК', '#ff7b54'],
  [238, 'SMEAR: ПАДЕНИЕ', '#7fdcff'], [240, 'IMPACT: ЗЕМЛЯ', '#ffffff'], [292, 'ВЗРЫВ', '#ffd166'],
];

// ───────── frame ─────────
function renderScene(f, sh) {
  const fx = sh.fx(f);
  let [pos, target, fov, roll] = sh.cam(f);
  if (fx.shake) { const a = fx.shake; pos = add(pos, [noise1(f * 1.7) * a, noise1(f * 1.9 + 5) * a, noise1(f * 2.1 + 9) * a]); roll += noise1(f * 2.3 + 3) * a * 40; }
  setCam(pos, target, fov, roll);
  PAL = fx.impact === 'A' ? PAL_A : fx.impact === 'B' ? PAL_B : PAL_N;
  world(f, fx.impact);
  if (fx.impact) { // impact frames: radial lines from the hit point
    const c = toCam(jointsAt(f).J.chest), [x, y] = c[2] > NEAR ? proj(c) : [W / 2, H / 2];
    speedLines(f, 1.2, x, y, fx.impact === 'A' ? '#000' : '#fff');
  }
  if (fx.dust) for (const d of [fx.dust, fx.dust2, fx.dust3]) if (d) dust(d[0], (f - d[1]) / FPS * 1.6);
  if (fx.ring && f >= fx.ring[1]) { const age = (f - fx.ring[1]) / FPS; ring(fx.ring[0], age * 9, 1 - age * 1.4, '255,230,200', 10); ring(fx.ring[0], age * 5, 1 - age * 1.8, '255,180,120', 5); }
  if (fx.boom && f >= fx.boom) {
    const c = toCam([0, 4, 70]); if (c[2] > NEAR) { const [x, y] = proj(c), age = (f - fx.boom) / FPS; glowAt(x, y, 300 + age * 900, '255,200,140', clamp(1.2 - age * 0.6)); glowAt(x, y, 80 + age * 200, '255,255,240', clamp(1 - age * 0.5)); ring([0, 0.05, 70], age * 25, 1 - age * 0.7, '255,220,170', 6); }
  }
  const freezeF = 129; // during the freeze the character is held on frame 129
  const cf = fx.freeze ? freezeF : f;
  if (charVisible(cf)) { drawChar(jointsAt(cf).J); scarf(cf); }
  ghosts(cf);
  flush();
  if ((fx.trail || fx.freeze) && !fx.impact) swordTrail(fx.freeze ? freezeF - 6 : cf, 4, fx.freeze ? 0.35 : 0.75);
  if (fx.freeze) { sparks(f, [0, 1.2, 23.6]); ctx.fillStyle = 'rgba(60,110,200,0.12)'; ctx.fillRect(0, 0, W, H); }
  if (!fx.impact) { speedLines(f, fx.speed || 0); streaks(f, fx.streak || 0, -0.04); }
  if (fx.flash) { ctx.fillStyle = `rgba(255,250,240,${fx.flash})`; ctx.fillRect(0, 0, W, H); }
  if (!fx.impact) { const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.0); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
  if (f >= 300) { ctx.fillStyle = `rgba(0,0,0,${ss(300, 311, f)})`; ctx.fillRect(0, 0, W, H); }
  return fx;
}

// ───────── annotation overlay ─────────
const UI = s => `600 ${s}px Inter, sans-serif`;
function panel(x, y, w, h, a = 0.62) { ctx.fillStyle = `rgba(8,10,18,${a})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); }
function txt(s, x, y, font, col = '#fff', align = 'left') { ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y); }
function tc(f) { return `${String(Math.floor(f / FPS)).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`; }
function minimap(f, sh, x0, y0, w, h) {
  panel(x0, y0, w, h, 0.72);
  const ck = sh.cam(f), cp = ck[0], tg = ck[1], r = track(RT, twos(Math.min(f, sh.f1 - 1)), false).v;
  const pts = []; for (let g = sh.f0; g < sh.f1; g += 2) pts.push(sh.cam(g)[0]);
  const cz = (cp[2] + r.z) / 2, cx = (cp[0] + r.x) / 2;
  let ext = 3; for (const p of pts) ext = Math.max(ext, Math.abs(p[0] - cx), Math.abs(p[2] - cz)); ext = Math.max(ext, Math.abs(r.z - cz) + 1);
  const sc = (Math.min(w, h - 40) / 2 - 18) / ext, mx = x0 + w / 2, my = y0 + 30 + (h - 30) / 2;
  const P = (x, z) => [mx - (x - cx) * sc, my - (z - cz) * sc]; // top view: +z up the map, +x to the left (camera-left)
  ctx.save(); ctx.beginPath(); ctx.rect(x0 + 4, y0 + 34, w - 8, h - 38); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  for (let g = Math.floor((cx - ext * 2) / 2) * 2; g <= cx + ext * 2; g += 2) { ctx.beginPath(); ctx.moveTo(...P(g, cz - ext * 2)); ctx.lineTo(...P(g, cz + ext * 2)); ctx.stroke(); }
  for (let g = Math.floor((cz - ext * 2) / 2) * 2; g <= cz + ext * 2; g += 2) { ctx.beginPath(); ctx.moveTo(...P(cx - ext * 2, g)); ctx.lineTo(...P(cx + ext * 2, g)); ctx.stroke(); }
  ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,209,102,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...P(p[0], p[2])) : ctx.moveTo(...P(p[0], p[2]))); ctx.stroke(); ctx.setLineDash([]);
  const hf = Math.atan(Math.tan(ck[2] * D2R / 2) * 16 / 9), dir = Math.atan2(tg[0] - cp[0], tg[2] - cp[2]), L = ext * 0.9;
  const [px, py] = P(cp[0], cp[2]);
  ctx.fillStyle = 'rgba(255,209,102,0.18)'; ctx.beginPath(); ctx.moveTo(px, py);
  ctx.lineTo(...P(cp[0] + Math.sin(dir - hf) * L, cp[2] + Math.cos(dir - hf) * L)); ctx.lineTo(...P(cp[0] + Math.sin(dir + hf) * L, cp[2] + Math.cos(dir + hf) * L)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU); ctx.fill();
  const [qx, qy] = P(r.x, r.z); ctx.fillStyle = '#e8613a'; ctx.beginPath(); ctx.arc(qx, qy, 9, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx, qy - 22); ctx.stroke();
  ctx.restore();
  txt('ВИД СВЕРХУ', x0 + 16, y0 + 26, UI(18), '#aab');
  txt('● камера', x0 + w - 200, y0 + 26, UI(17), '#ffd166'); txt('● герой', x0 + w - 95, y0 + 26, UI(17), '#e8613a');
}
function annotate(f, sh, fx) {
  const lf = f - sh.f0, cam = CAM;
  // top-left: shot info
  panel(30, 30, 640, 150);
  txt(`ШОТ ${sh.n}/${SH.length}`, 54, 76, UI(22), '#ffd166'); txt(sh.name, 200, 76, UI(30));
  txt(`кадр ${String(f).padStart(3, '0')} / ${TOTAL}`, 54, 118, UI(24), '#dde'); txt(`в шоте: ${String(lf + 1).padStart(2, '0')} из ${sh.f1 - sh.f0}`, 330, 118, UI(24), '#dde');
  txt(`${tc(f)}  ·  24 fps`, 54, 156, UI(20), '#99a');
  const upd = f % 2 === 0;
  ctx.fillStyle = upd ? '#5df08a' : '#334'; ctx.beginPath(); ctx.arc(352, 150, 9, 0, TAU); ctx.fill();
  txt(upd ? 'поза обновилась (двойки)' : 'поза держится (двойки)', 370, 157, UI(19), upd ? '#5df08a' : '#778');
  // top-right: camera
  panel(W - 600, 30, 570, 150);
  txt('КАМЕРА', W - 576, 76, UI(22), '#ffd166'); txt(sh.move, W - 470, 76, UI(22));
  txt(`FOV ${cam.fov.toFixed(0)}°`, W - 576, 118, UI(26)); txt(`крен ${cam.roll.toFixed(0)}°`, W - 430, 118, UI(26)); txt(`высота ${cam.pos[1].toFixed(2)} м`, W - 290, 118, UI(26));
  txt(`позиция (${cam.pos.map(v => v.toFixed(1)).join(', ')})`, W - 576, 156, UI(19), '#99a');
  txt('камера на единицах (плавно)', W - 300, 156, UI(19), '#99a');
  // current key
  const k = track(CH, twos(f), true), key = [...CH].reverse().find(c => c[0] <= twos(f) && c[3]);
  if (key) {
    const next = CH.find(c => c[0] > key[0]), hold = next ? next[0] - key[0] : TOTAL - key[0];
    const fresh = twos(f) === key[0] && !(k.k > 0 && k.k < 1);
    panel(30, H - 330, 760, 92);
    txt(fresh ? '◆ КЛЮЧ' : '◇ поза', 54, H - 284, UI(22), fresh ? '#ff7b54' : '#99a');
    txt(`${POSE_RU[key[1]]}  ·  кадр ${key[0]}  ·  до след. ключа ${hold} к.`, 180, H - 284, UI(22));
    txt(key[3], 54, H - 252, UI(22), '#ffd166');
  }
  // notes
  panel(30, H - 228, 760, 128);
  sh.notes.forEach((n, i) => txt(n, 54, H - 192 + i * 34, UI(22), '#e6e6ee'));
  // event chip
  const ev = EVENTS.find(e => f >= e[0] && f < e[0] + 2);
  if (ev) { ctx.font = '64px Russo'; const tw = ctx.measureText(ev[1]).width; panel(W / 2 - tw / 2 - 30, 210, tw + 60, 100, 0.85); txt(ev[1], W / 2, 284, '64px Russo', ev[2], 'center'); }
  // legend
  panel(W - 600, 200, 570, 54);
  txt('■ правая сторона', W - 576, 236, UI(20), '#e8613a'); txt('■ левая сторона', W - 380, 236, UI(20), '#3f80dc'); txt('▬ шарф', W - 200, 236, UI(20), '#d92b35');
  minimap(f, sh, W - 450, H - 430, 420, 330);
  // timeline
  const tx = 30, tw = W - 60, ty = H - 78, th = 50, X = g => tx + g / TOTAL * tw;
  panel(tx - 10, ty - 10, tw + 20, th + 20, 0.8);
  SH.forEach((s, i) => { ctx.fillStyle = s === sh ? 'rgba(255,209,102,0.35)' : i % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.14)'; ctx.fillRect(X(s.f0), ty, X(s.f1) - X(s.f0) - 2, th); txt(String(s.n), X(s.f0) + 8, ty + 22, UI(17), '#ccd'); });
  for (const c of CH) { const x = X(c[0]); ctx.fillStyle = c[3] ? '#ff7b54' : '#887'; ctx.save(); ctx.translate(x, ty + 37); ctx.rotate(PI / 4); ctx.fillRect(-5, -5, 10, 10); ctx.restore(); }
  for (const e of EVENTS) { ctx.fillStyle = '#7fdcff'; ctx.fillRect(X(e[0]) - 1, ty + 2, 2, 10); }
  ctx.fillStyle = '#fff'; ctx.fillRect(X(f) - 2, ty - 8, 4, th + 16);
}

window.renderFrame = function (f) {
  f = Math.round(clamp(f, 0, TOTAL - 1));
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const sh = shotAt(f), fx = renderScene(f, sh);
  if (MODE === 'annotated') annotate(f, sh, fx);
  if (MODE === 'sheet') { panel(16, 16, 330, 76, 0.75); txt(`кадр ${f}`, 34, 66, UI(40), '#ffd166'); const ev = EVENTS.find(e => f >= e[0] && f < e[0] + 2); if (ev) txt(ev[1], 34, H - 40, '56px Russo', ev[2]); }
};
window.TOTAL = TOTAL; window.SHOTS = SH.map(s => ({ n: s.n, name: s.name, f0: s.f0, f1: s.f1 }));
window.shotListMarkdown = function () {
  let md = '';
  for (const s of SH) {
    const c0 = s.cam(s.f0), c1 = s.cam(s.f1 - 1);
    md += `### Шот ${s.n}. ${s.name} (кадры ${s.f0}–${s.f1 - 1}, ${s.f1 - s.f0} к. = ${((s.f1 - s.f0) / FPS).toFixed(2)} с)\n\n`;
    md += `**Камера:** ${s.move}. FOV ${c0[2].toFixed(0)}° → ${c1[2].toFixed(0)}°, крен ${c0[3].toFixed(0)}° → ${c1[3].toFixed(0)}°, высота ${c0[0][1].toFixed(2)} → ${c1[0][1].toFixed(2)} м.\n\n`;
    md += s.notes.map(n => `- ${n}`).join('\n') + '\n';
    const keys = CH.filter(c => c[0] >= s.f0 && c[0] < s.f1);
    if (keys.length) md += '\n| Кадр | Поза | Переход к следующей | Заметка |\n|---|---|---|---|\n' + keys.map(c => `| ${c[0]} | ${POSE_RU[c[1]]} | ${{ hold: 'держать, потом скачок', out: 'быстро → мягко (ease out)', in: 'мягко → быстро (ease in)', lin: 'ровно', smooth: 'плавно (ease in-out)' }[c[2]]} | ${c[3] || '—'} |`).join('\n') + '\n';
    const ev = EVENTS.filter(e => e[0] >= s.f0 && e[0] < s.f1);
    if (ev.length) md += '\n**События:** ' + ev.map(e => `${e[0]}: ${e[1]}`).join(' · ') + '\n';
    md += '\n';
  }
  return md;
};
window.DURATION = TOTAL / FPS;
window.ready = Promise.all([document.fonts.load('40px Russo', 'АZ'), document.fonts.load(UI(20), 'АZ')]).then(() => true);
})();
