import { makeCanvas } from './sprites';
import type { MapDef } from '../world/BunkerScene';

type G = CanvasRenderingContext2D;
type Box = readonly [number, number, number, number];
const R = (g: G, x: number, y: number, w: number, h: number, c: string): void => { g.fillStyle = c; g.fillRect(x, y, w, h); };
/** 테두리 있는 가구 상자 */
const box = (g: G, x: number, y: number, w: number, h: number, fill: string, top?: string): void => {
  R(g, x, y, w, h, '#283044');
  R(g, x + 2, y + 2, w - 4, h - 4, fill);
  if (top) R(g, x + 2, y + 2, w - 4, 4, top);
};
const plates = (g: G, y0: number, w: number, h: number, a: string, b: string, line: string, step = 20): void => {
  for (let y = y0; y < h; y += step) for (let x = 0; x < w; x += step) { R(g, x, y, step, step, (x + y) % (step * 2) ? a : b); R(g, x, y, step, 1, line); }
};
const stars = (g: G, x: number, y: number, w: number, h: number, n: number): void => {
  R(g, x, y, w, h, '#05060C');
  for (let i = 0; i < n; i += 1) R(g, x + ((i * 37) % w), y + ((i * 17) % h), 1, 1, i % 4 ? '#8A93B8' : '#FFF4DA');
};
const circleWin = (g: G, cx: number, cy: number, r: number, inner: (g: G) => void): void => {
  g.fillStyle = '#283044'; g.beginPath(); g.arc(cx, cy, r + 4, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip(); inner(g); g.restore();
};
const wallBand = (g: G, w: number, h: number, base: string, seam: string, light: string): void => {
  R(g, 0, 0, w, h, base);
  for (let x = 0; x < w; x += 40) { R(g, x, 0, 1, h, seam); R(g, x + 1, 0, 1, h, light); }
  R(g, 0, h - 4, w, 4, '#283044');
};

// ---------- C2 수하물실 ----------
export const C2_W = 480;
export const C2_H = 300;
export const C2_SPOTS = {
  rackL: { x: 95, y: 158 }, rackR: { x: 385, y: 158 }, conveyor: { x: 240, y: 212 }, legacy: { x: 62, y: 270 },
  console: { x: 418, y: 270 }, hatch: { x: 240, y: 90 }, crew: [{ x: 178, y: 142 }, { x: 302, y: 142 }, { x: 132, y: 228 }, { x: 348, y: 228 }], dam: { x: 240, y: 112 }, start: { x: 240, y: 284 },
} as const;
const C2_COLL: Box[] = [[0, 0, 480, 74], [30, 84, 130, 64], [320, 84, 130, 64], [150, 176, 180, 22], [40, 232, 44, 30], [396, 232, 44, 30]];
function paintC2(): HTMLCanvasElement {
  const { c, g } = makeCanvas(C2_W, C2_H);
  wallBand(g, C2_W, 74, '#E3DAC3', '#C9BFA6', '#F2EADA');
  R(g, 0, 6, C2_W, 3, '#96D9BC');
  plates(g, 74, C2_W, C2_H, '#454E70', '#4A5478', '#5A6488');
  box(g, 212, 18, 56, 56, '#B9B19A');
  for (let y = 22; y < 70; y += 10) R(g, 216, y, 48, 4, (y / 10) % 2 ? '#C9A43A' : '#283044');
  for (const x0 of [30, 320]) {
    box(g, x0, 84, 130, 64, '#3D4766');
    for (const y of [100, 120, 140]) R(g, x0 + 4, y, 122, 3, '#8A93B8');
  }
  box(g, 150, 176, 180, 22, '#2C3249');
  for (let x = 154; x < 326; x += 12) R(g, x, 180, 6, 14, '#5A6488');
  box(g, 40, 232, 44, 30, '#B98A5A', '#D4A86A');
  R(g, 58, 240, 8, 6, '#E9D9B2');
  box(g, 396, 232, 44, 30, '#5A6488', '#96D9BC');
  R(g, 404, 246, 6, 4, '#FFD47B'); R(g, 416, 246, 6, 4, '#96D9BC'); R(g, 428, 246, 6, 4, '#F48B70');
  R(g, 222, 150, 36, 3, '#FFD47B');
  return c;
}
export const C2_MAP: MapDef = { key: 'map-c2', w: C2_W, h: C2_H, paint: paintC2, colliders: C2_COLL, ambient: 'none' };

// ---------- C3 객실(착석 전) ----------
export const C3_W = 400;
export const C3_H = 280;
export const C3_SEATS = [{ x: 130, y: 122 }, { x: 200, y: 122 }, { x: 270, y: 122 }, { x: 130, y: 184 }, { x: 200, y: 184 }, { x: 270, y: 184 }];
export const C3_SPOTS = { window: { x: 200, y: 80 }, console: { x: 200, y: 228 }, hatch: { x: 372, y: 200 }, start: { x: 360, y: 214 } } as const;
const C3_COLL: Box[] = [[0, 0, 400, 66], [40, 244, 320, 36], ...C3_SEATS.map((s) => [s.x - 12, s.y - 6, 24, 12] as Box)];
function paintC3(): HTMLCanvasElement {
  const { c, g } = makeCanvas(C3_W, C3_H);
  wallBand(g, C3_W, 66, '#EDE4CE', '#D8CDB2', '#F7F0DF');
  R(g, 96, 6, 208, 52, '#283044');
  ['#2E1424', '#4A1B2A', '#6E2630', '#933A33'].forEach((col, i) => R(g, 100, 10 + i * 11, 200, 11, col));
  R(g, 190, 22, 4, 32, '#2A1A24');
  plates(g, 66, C3_W, C3_H, '#3B4466', '#404A6E', '#4A5478', 14);
  for (const s of C3_SEATS) { box(g, s.x - 12, s.y - 16, 24, 22, '#3D5E78', '#547E9D'); R(g, s.x - 9, s.y - 8, 18, 2, '#96D9BC'); }
  box(g, 40, 244, 320, 36, '#1D2B44');
  for (let i = 0; i < 9; i += 1) R(g, 60 + i * 34, 254, 8, 5, i % 3 ? '#96D9BC' : '#FFD47B');
  box(g, 362, 120, 30, 60, '#B9B19A');
  return c;
}
export const C3_MAP: MapDef = { key: 'map-c3', w: C3_W, h: C3_H, paint: paintC3, colliders: C3_COLL, ambient: 'none' };

// ---------- C4 생활 모듈(189일째) ----------
export const C4_W = 560;
export const C4_H = 320;
export const C4_SPOTS = {
  hydro: { x: 90, y: 154 }, galley: { x: 280, y: 228 }, panel: { x: 504, y: 164 }, comms: { x: 66, y: 244 }, pods: { x: 486, y: 234 },
  window: { x: 280, y: 86 }, med: { x: 350, y: 132 }, dam: { x: 528, y: 290 },
  crew: [{ x: 120, y: 182 }, { x: 236, y: 160 }, { x: 330, y: 250 }, { x: 420, y: 150 }], start: { x: 280, y: 290 },
} as const;
const C4_COLL: Box[] = [[0, 0, 560, 82], [30, 100, 120, 40], [230, 172, 100, 44], [478, 100, 64, 52], [30, 254, 70, 40], [430, 246, 110, 54], [330, 90, 40, 30]];
function paintC4(): HTMLCanvasElement {
  const { c, g } = makeCanvas(C4_W, C4_H);
  wallBand(g, C4_W, 82, '#EDE4CE', '#D8CDB2', '#F7F0DF');
  for (const cx of [110, 450]) circleWin(g, cx, 40, 24, (gg) => stars(gg, cx - 24, 16, 48, 48, 30));
  R(g, 226, 10, 108, 60, '#283044');
  stars(g, 230, 14, 100, 52, 50);
  R(g, 276, 34, 3, 3, '#6FC3F0');
  plates(g, 82, C4_W, C4_H, '#3B4466', '#404A6E', '#4A5478', 16);
  box(g, 30, 100, 120, 40, '#6B4128', '#8C5A3A');
  for (let i = 0; i < 9; i += 1) { R(g, 40 + i * 12, 104, 3, 10, '#3E7A34'); R(g, 37 + i * 12, 102, 4, 3, '#6FBF5A'); }
  box(g, 230, 172, 100, 44, '#B98A5A', '#D4A86A');
  R(g, 262, 186, 10, 8, '#FFF4DA'); R(g, 290, 190, 12, 6, '#F48B70');
  box(g, 478, 100, 64, 52, '#5A6488', '#96D9BC');
  for (let i = 0; i < 4; i += 1) R(g, 486 + i * 13, 120, 8, 22, '#6FC3F0');
  box(g, 30, 254, 70, 40, '#1D2B44', '#2F4A62');
  R(g, 38, 262, 54, 22, '#6FC3F0');
  box(g, 430, 246, 110, 54, '#3D5E78');
  for (let i = 0; i < 3; i += 1) R(g, 436 + i * 34, 252, 30, 42, '#547E9D');
  box(g, 330, 90, 40, 30, '#FFFFFF');
  R(g, 347, 96, 6, 18, '#E0503F'); R(g, 341, 102, 18, 6, '#E0503F');
  for (const [x, y, col] of [[180, 120, '#FFD47B'], [400, 200, '#96D9BC'], [160, 250, '#F48B70']] as [number, number, string][]) R(g, x, y, 6, 4, col);
  return c;
}
export const C4_MAP: MapDef = { key: 'map-c4', w: C4_W, h: C4_H, paint: paintC4, colliders: C4_COLL, ambient: 'none' };

// ---------- C5 착륙지 → 제로돔 도보 ----------
export const C5_W = 1000;
export const C5_H = 260;
export const C5_SPOTS = { lander: { x: 70, y: 186 }, airlock: { x: 912, y: 160 }, earthRock: { x: 600, y: 120 }, start: { x: 120, y: 176 } } as const;
const C5_COLL: Box[] = [[0, 0, 1000, 74], [36, 112, 64, 62], [930, 96, 70, 96], [220, 150, 30, 20], [420, 100, 40, 26], [560, 196, 36, 22], [700, 132, 30, 22], [820, 206, 40, 20]];
function paintC5(): HTMLCanvasElement {
  const { c, g } = makeCanvas(C5_W, C5_H);
  ['#F0C4A4', '#E8B08F', '#E2A383', '#D99573'].forEach((col, i) => R(g, 0, i * 18, C5_W, 18, col));
  g.fillStyle = '#9E6680';
  for (const [x0, w, hgt] of [[0, 180, 30], [260, 220, 40], [560, 160, 26], [760, 240, 36]]) { g.beginPath(); g.moveTo(x0, 74); g.lineTo(x0 + w / 2, 74 - hgt); g.lineTo(x0 + w, 74); g.fill(); }
  R(g, 0, 74, C5_W, 186, '#C27A57');
  for (let i = 0; i < 160; i += 1) R(g, (i * 53) % C5_W, 80 + ((i * 29) % 176), 2 + (i % 3), 1 + (i % 2), i % 3 ? '#A8664A' : '#D48B66');
  R(g, 100, 168, 830, 14, '#D9A07E');
  for (const [x, y, w, hh] of C5_COLL.slice(3)) { box(g, x, y, w, hh, '#8C5A3A', '#A8664A'); }
  box(g, 36, 112, 64, 62, '#FFF4DA', '#E3D6B4');
  R(g, 44, 120, 10, 10, '#96D9BC'); R(g, 30, 160, 10, 14, '#5A6488'); R(g, 96, 160, 10, 14, '#5A6488');
  g.fillStyle = '#F6E2BC'; g.beginPath(); g.arc(980, 150, 70, Math.PI * 0.5, Math.PI * 1.5); g.fill();
  box(g, 930, 128, 40, 64, '#DDE7F0', '#9FD8E8');
  R(g, 600, 100, 2, 2, '#9FD8E8');
  return c;
}
export const C5_MAP: MapDef = { key: 'map-c5', w: C5_W, h: C5_H, paint: paintC5, colliders: C5_COLL, ambient: 'dust', suits: true };

// ---------- C6 제로돔 내부 ----------
export const C6_W = 640;
export const C6_H = 360;
export const C6_SPOTS = {
  o2: { x: 96, y: 162 }, farm: { x: 100, y: 240 }, vault: { x: 544, y: 162 }, archive: { x: 544, y: 240 }, med: { x: 320, y: 282 }, mirror: { x: 320, y: 144 },
  crew: [{ x: 160, y: 130 }, { x: 470, y: 130 }, { x: 170, y: 300 }, { x: 470, y: 300 }], dam: { x: 260, y: 200 }, start: { x: 320, y: 230 },
} as const;
const C6_COLL: Box[] = [[0, 0, 640, 72], [40, 92, 112, 60], [40, 252, 122, 72], [488, 92, 112, 60], [488, 252, 112, 72], [280, 296, 80, 40], [290, 100, 60, 30]];
function paintC6(): HTMLCanvasElement {
  const { c, g } = makeCanvas(C6_W, C6_H);
  R(g, 0, 0, C6_W, C6_H, '#FFF1D6');
  g.fillStyle = '#F6E2BC'; g.beginPath(); g.arc(320, 72, 300, Math.PI, 0); g.fill();
  for (let a = 0; a < 9; a += 1) R(g, 40 + a * 70, 0, 2, 72, '#E3C99A');
  R(g, 0, 68, C6_W, 4, '#96D9BC');
  plates(g, 72, C6_W, C6_H, '#E9DFC8', '#E3D8BE', '#D8CDB2', 24);
  R(g, 20, 80, 160, 90, 'rgba(111,195,240,0.18)'); R(g, 20, 230, 160, 110, 'rgba(111,191,90,0.18)');
  R(g, 460, 80, 160, 90, 'rgba(159,216,232,0.22)'); R(g, 460, 230, 160, 110, 'rgba(142,108,192,0.16)'); R(g, 250, 270, 140, 80, 'rgba(224,80,63,0.12)');
  box(g, 40, 92, 112, 60, '#DDE7F0', '#6FC3F0');
  for (let i = 0; i < 4; i += 1) R(g, 50 + i * 24, 110, 14, 34, '#9FD8E8');
  box(g, 40, 252, 122, 72, '#6B4128', '#8C5A3A');
  for (let i = 0; i < 10; i += 1) { R(g, 48 + i * 11, 258, 3, 12, '#3E7A34'); R(g, 46 + i * 11, 256, 6, 3, '#6FBF5A'); }
  box(g, 488, 92, 112, 60, '#CFEFF0', '#9FD8E8');
  for (let i = 0; i < 3; i += 1) R(g, 498 + i * 34, 104, 26, 40, '#E9F3FA');
  box(g, 488, 252, 112, 72, '#3D4766', '#8E6CC0');
  for (let i = 0; i < 4; i += 1) for (let j = 0; j < 3; j += 1) R(g, 496 + i * 26, 268 + j * 16, 18, 4, j % 2 ? '#96D9BC' : '#FFD47B');
  box(g, 280, 296, 80, 40, '#FFFFFF', '#F4F4F7');
  R(g, 316, 304, 6, 18, '#E0503F'); R(g, 310, 310, 18, 6, '#E0503F');
  box(g, 284, 10, 72, 52, '#DDE7F0');
  R(g, 296, 20, 48, 32, '#9FD8E8'); R(g, 306, 30, 6, 5, '#3D5E78'); R(g, 326, 30, 6, 5, '#3D5E78'); R(g, 312, 44, 16, 2, '#3D5E78');
  box(g, 290, 100, 60, 30, '#5A6488', '#96D9BC');
  return c;
}
export const C6_MAP: MapDef = { key: 'map-c6', w: C6_W, h: C6_H, paint: paintC6, colliders: C6_COLL, ambient: 'none' };

// ---------- C7 로버 격납고 ----------
export const C7_W = 560;
export const C7_H = 300;
export const C7_SPOTS = {
  terminal: { x: 96, y: 150 }, rover: { x: 424, y: 206 }, bench: { x: 100, y: 222 }, purifier: { x: 284, y: 236 }, airlock: { x: 520, y: 150 },
  crew: [{ x: 180, y: 140 }, { x: 330, y: 140 }, { x: 190, y: 262 }, { x: 360, y: 270 }], dam: { x: 470, y: 270 }, start: { x: 280, y: 180 },
} as const;
const C7_COLL: Box[] = [[0, 0, 560, 74], [380, 150, 90, 44], [60, 100, 72, 40], [60, 236, 84, 36], [240, 252, 90, 40], [520, 80, 40, 60]];
function paintC7(): HTMLCanvasElement {
  const { c, g } = makeCanvas(C7_W, C7_H);
  wallBand(g, C7_W, 74, '#E6D3AE', '#D4BF96', '#F2E4C6');
  plates(g, 74, C7_W, C7_H, '#B88A6A', '#C0927A', '#A8664A', 20);
  box(g, 380, 150, 90, 44, '#E9F3EF', '#CFEFF0');
  for (const dx of [394, 452]) { g.fillStyle = '#283044'; g.beginPath(); g.arc(dx, 196, 9, 0, Math.PI * 2); g.fill(); }
  box(g, 60, 100, 72, 40, '#1D2B44', '#2F4A62');
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 4; j += 1) R(g, 68 + j * 15, 108 + i * 9, 12, 7, (i + j) % 3 === 0 ? '#6FC3F0' : '#9E6680');
  box(g, 60, 236, 84, 36, '#DDE7F0', '#F4F4F7');
  box(g, 240, 252, 90, 40, '#5A6488', '#96D9BC');
  for (let i = 0; i < 5; i += 1) R(g, 250 + i * 16, 266, 10, 18, i % 2 ? '#CFEFF0' : '#9FD8E8');
  box(g, 520, 80, 40, 60, '#B9B19A');
  for (let y = 84; y < 136; y += 10) R(g, 524, y, 32, 4, (y / 10) % 2 ? '#C9A43A' : '#283044');
  return c;
}
export const C7_MAP: MapDef = { key: 'map-c7', w: C7_W, h: C7_H, paint: paintC7, colliders: C7_COLL, ambient: 'none' };

// ---------- C8 첫 저녁 공용실 ----------
export const C8_W = 520;
export const C8_H = 320;
export const C8_SPOTS = {
  table: { x: 260, y: 236 }, photo: { x: 52, y: 138 }, sprouts: { x: 468, y: 146 }, board: { x: 420, y: 96 }, window: { x: 260, y: 86 },
  seats: [{ x: 196, y: 150 }, { x: 324, y: 150 }, { x: 196, y: 222 }, { x: 324, y: 222 }], dam: { x: 260, y: 136 }, start: { x: 260, y: 296 },
} as const;
const C8_COLL: Box[] = [[0, 0, 520, 80], [200, 160, 120, 56], [20, 88, 64, 40], [436, 94, 64, 40]];
function paintC8(): HTMLCanvasElement {
  const { c, g } = makeCanvas(C8_W, C8_H);
  R(g, 0, 0, C8_W, 80, '#FFF1D6');
  R(g, 156, 8, 208, 56, '#283044');
  ['#3A1F33', '#6E2630', '#B5583C', '#E8B08F'].forEach((col, i) => R(g, 160, 12 + i * 12, 200, 12, col));
  R(g, 256, 20, 2, 2, '#9FD8E8');
  R(g, 0, 76, C8_W, 4, '#96D9BC');
  plates(g, 80, C8_W, C8_H, '#E9DFC8', '#E3D8BE', '#D8CDB2', 20);
  box(g, 380, 18, 84, 46, '#FFF8E8');
  for (let i = 0; i < 3; i += 1) R(g, 388, 28 + i * 10, 60, 2, '#A3A3AE');
  g.fillStyle = '#283044'; g.beginPath(); g.ellipse(260, 188, 64, 32, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#B98A5A'; g.beginPath(); g.ellipse(260, 186, 60, 28, 0, 0, Math.PI * 2); g.fill();
  box(g, 20, 88, 64, 40, '#E9D9B2');
  for (let i = 0; i < 3; i += 1) R(g, 26 + i * 19, 96, 14, 10, ['#9FD8E8', '#F6C744', '#F48B70'][i]);
  box(g, 436, 94, 64, 40, '#8C5A3A', '#6B4128');
  for (let i = 0; i < 4; i += 1) { R(g, 446 + i * 13, 96, 2, 10, '#3E7A34'); R(g, 444 + i * 13, 94, 6, 3, '#6FBF5A'); }
  return c;
}
export const C8_MAP: MapDef = { key: 'map-c8', w: C8_W, h: C8_H, paint: paintC8, colliders: C8_COLL, ambient: 'none' };

