import { makeCanvas } from './sprites';

/** 지구 지하 발사장 (오리지널 절차 생성 배경, 40x26 타일 = 640x416px) */
export const BUNKER_W = 640;
export const BUNKER_H = 416;

export type Rect = [number, number, number, number];

export const BUNKER_COLLIDERS: Rect[] = [
  [0, 0, 640, 66],
  [0, 0, 16, 416],
  [624, 0, 16, 416],
  [0, 400, 640, 16],
  [40, 318, 70, 10],
  [130, 318, 70, 10],
  [566, 70, 52, 20],
  [554, 66, 4, 84],
  [554, 182, 4, 30],
  [554, 212, 70, 4],
  [460, 104, 40, 14],
  [228, 286, 26, 18],
  [26, 70, 36, 10],
];

export const SPOTS = {
  playerStart: { x: 320, y: 236 },
  board: { x: 320, y: 82 },
  notice: { x: 496, y: 82 },
  quiet: { x: 44, y: 92 },
  control: { x: 590, y: 132 },
  hatch: { x: 604, y: 380 },
  crate: { x: 241, y: 312 },
  locker: { x: 480, y: 126 },
  dam: { x: 360, y: 104 },
} as const;

export const CANDIDATE_SPOTS = {
  harin: { x: 82, y: 168 },
  taeo: { x: 136, y: 148 },
  seojin: { x: 188, y: 178 },
  woojoo: { x: 74, y: 232 },
  dodam: { x: 130, y: 248 },
  jio: { x: 186, y: 240 },
} as const;

export const CITIZEN_SPOTS: { x: number; y: number }[] = [
  { x: 280, y: 352 }, { x: 304, y: 366 }, { x: 352, y: 350 }, { x: 386, y: 370 },
  { x: 424, y: 348 }, { x: 466, y: 364 }, { x: 512, y: 350 }, { x: 70, y: 372 },
];

export function paintBunker(): HTMLCanvasElement {
  const { c, g } = makeCanvas(BUNKER_W, BUNKER_H);
  const R = (x: number, y: number, w: number, h: number, col: string): void => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // 바닥 철판
  for (let ty = 4; ty < 25; ty += 1) {
    for (let tx = 1; tx < 39; tx += 1) {
      const x = tx * 16;
      const y = ty * 16;
      const ctrl = x >= 560 && y < 208;
      R(x, y, 16, 16, ctrl ? ((tx + ty) % 2 ? '#2E3A52' : '#33405A') : (tx + ty) % 2 ? '#363D5A' : '#3B4362');
      R(x, y, 16, 1, '#454E70');
      R(x, y, 1, 16, '#434B6C');
      R(x + 15, y, 1, 16, '#2C3249');
      R(x, y + 15, 16, 1, '#2C3249');
      if ((tx * 7 + ty * 3) % 11 === 0) { R(x + 3, y + 3, 1, 1, '#55608A'); R(x + 12, y + 12, 1, 1, '#55608A'); }
    }
  }
  // 바닥 유도선
  for (let x = 232; x < 560; x += 8) R(x, 214, 4, 2, '#8C7A3E');
  for (let y = 100; y < 214; y += 8) R(318, y, 4, 2, '#8C7A3E');
  // 위쪽 벽과 긴 유리창
  R(0, 0, 640, 66, '#262B42');
  const bands: [number, number, string][] = [[6, 8, '#2E1424'], [14, 8, '#4A1B2A'], [22, 8, '#6E2630'], [30, 8, '#933A33'], [38, 6, '#B5583C']];
  for (const [y, h, col] of bands) R(24, y, 592, h, col);
  // 먼 폐허 실루엣
  let bx = 24;
  let i = 0;
  while (bx < 616) {
    const w = 10 + ((i * 37) % 23);
    const h = 6 + ((i * 53) % 13);
    R(bx, 44 - h, w, h, '#2A1A24');
    if (i % 3 === 0) R(bx + 3, 44 - h + 3, 1, 1, '#E8A04A');
    bx += w + 2 + (i % 4);
    i += 1;
  }
  for (let k = 0; k < 140; k += 1) R(24 + ((k * 97) % 592), 6 + ((k * 31) % 36), 1, 1, '#B9B3B8');
  for (let mx = 24; mx <= 616; mx += 74) R(mx - 1, 4, 3, 42, '#4A5272');
  R(22, 4, 596, 2, '#4A5272');
  R(22, 44, 596, 3, '#4A5272');
  // 창 아래 벽과 경고 띠
  R(0, 47, 640, 19, '#2F3550');
  for (let x = 0; x < 640; x += 8) R(x, 58, 4, 4, '#C9A43A');
  R(0, 62, 640, 4, '#1F2438');
  // 탑승판 (글자는 DOM 라벨로 표시)
  R(250, 2, 140, 58, '#5A6488');
  R(254, 6, 132, 50, '#0F1A2E');
  for (let ly = 12; ly < 30; ly += 6) R(262, ly, 60 + ((ly * 13) % 50), 2, '#3FA9F5');
  for (let s = 0; s < 4; s += 1) { R(270 + s * 26, 36, 18, 14, '#283044'); R(272 + s * 26, 38, 14, 10, '#FFD47B'); }
  // 의료·기술 게시판
  R(446, 48, 100, 18, '#4F5B7E');
  for (let k = 0; k < 6; k += 1) R(450 + k * 16, 51, 11, 12, k % 2 ? '#E9F3EF' : '#FFF4DA');
  // 관제실 칸막이(유리)와 콘솔
  R(554, 66, 4, 84, '#7FA6C8');
  R(554, 182, 4, 30, '#7FA6C8');
  R(554, 212, 70, 4, '#7FA6C8');
  R(566, 70, 52, 20, '#3D4766');
  for (let k = 0; k < 3; k += 1) R(570 + k * 16, 72, 12, 8, k === 1 ? '#F48B70' : '#96D9BC');
  // 조용한 창가: 작은 벤치와 화분
  R(26, 70, 36, 8, '#6B5A4A');
  R(26, 78, 36, 2, '#4A3D32');
  R(14 + 4, 70, 8, 8, '#8C5A3A');
  R(16 + 4, 64, 4, 6, '#6FBF5A');
  R(22, 96, 44, 28, '#3E4A6E');
  // 대기실 벤치
  for (const x of [40, 130]) { R(x, 318, 70, 8, '#6B5A4A'); R(x, 326, 70, 2, '#4A3D32'); }
  // 보급 사물함
  R(460, 100, 40, 18, '#55607F');
  R(462, 102, 17, 14, '#6A7699');
  R(481, 102, 17, 14, '#6A7699');
  // 짐 더미
  R(228, 286, 26, 18, '#8A6A4A');
  R(232, 280, 14, 8, '#A07A52');
  R(240, 290, 2, 6, '#5A4430');
  // 시민 담요
  const blankets = ['#7A5A6A', '#5A6A7A', '#6A7A5A', '#8A6A5A'];
  for (let k = 0; k < 6; k += 1) R(266 + k * 44, 344 + (k % 2) * 12, 30, 14, blankets[k % 4]);
  // 탑승구
  R(588, 352, 36, 48, '#556080');
  for (let y = 354; y < 398; y += 8) R(590, y, 32, 4, '#C9A43A');
  R(596, 362, 20, 30, '#3A4260');
  // 아래쪽 벽
  R(0, 400, 640, 16, '#262B42');
  R(0, 400, 640, 1, '#454E70');
  R(0, 0, 16, 416, '#262B42');
  R(624, 0, 16, 416, '#262B42');
  return c;
}

/** 탑승구 표시등(잠김: 코랄, 열림: 민트) */
export const HATCH_LIGHT = { x: 606, y: 356 };
