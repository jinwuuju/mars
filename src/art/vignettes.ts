import type { ChapterId } from '../shared/ids';
import type { Look } from './look';
import { buildSheet, FRAME, FRAME_H, FRAME_W, makeCanvas } from './sprites';

type G = CanvasRenderingContext2D;
const W = 64;
const H = 40;
const R = (g: G, x: number, y: number, w: number, h: number, c: string): void => { g.fillStyle = c; g.fillRect(x, y, w, h); };

/** 결과지 '선택의 순간' 타임라인용 장면 그림 (64x40 오리지널 도트) */
export function chapterArtURL(ch: ChapterId): string {
  const { c, g } = makeCanvas(W, H);
  switch (ch) {
    case 'C1':
      R(g, 0, 0, W, H, '#1D2238'); R(g, 0, 30, W, 10, '#3B3F5C');
      R(g, 28, 6, 8, 24, '#FFF4DA'); R(g, 29, 3, 6, 4, '#FFF4DA'); R(g, 28, 14, 8, 2, '#283044');
      R(g, 6, 4, 4, 3, '#F48B70'); R(g, 54, 4, 4, 3, '#F48B70');
      for (let i = 0; i < 4; i += 1) R(g, 8 + i * 13, 24, 4, 6, ['#F6C744', '#E0503F', '#96D9BC', '#8E6CC0'][i]);
      break;
    case 'C2':
      R(g, 0, 0, W, H, '#E3DAC3'); R(g, 0, 30, W, 10, '#454E70');
      R(g, 4, 6, 20, 24, '#5A6488'); R(g, 40, 6, 20, 24, '#5A6488');
      [[6, 10, '#F48B70'], [14, 10, '#96D9BC'], [6, 20, '#FFD47B'], [42, 12, '#8C5A3A'], [50, 20, '#6FBF5A']].forEach(([x, y, col]) => R(g, x as number, y as number, 7, 7, col as string));
      R(g, 26, 32, 12, 4, '#283044');
      break;
    case 'C3':
      R(g, 0, 0, W, 14, '#2E1424'); R(g, 0, 14, W, 12, '#6E2630'); R(g, 0, 26, W, 14, '#933A33');
      R(g, 29, 4, 6, 20, '#FFF4DA'); R(g, 30, 2, 4, 3, '#FFF4DA');
      R(g, 28, 24, 8, 4, '#FFD47B'); R(g, 30, 28, 4, 6, '#F48B70');
      for (let i = 0; i < 6; i += 1) R(g, 16 + i * 6, 34, 6, 4, '#9A9BA6');
      break;
    case 'C4':
      R(g, 0, 0, W, H, '#EDE4CE'); R(g, 0, 32, W, 8, '#404A6E');
      g.fillStyle = '#283044'; g.beginPath(); g.arc(18, 16, 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#05060C'; g.beginPath(); g.arc(18, 16, 10, 0, Math.PI * 2); g.fill();
      R(g, 14, 12, 1, 1, '#FFF4DA'); R(g, 21, 18, 1, 1, '#96D9BC'); R(g, 18, 9, 1, 1, '#FFF4DA');
      R(g, 36, 20, 24, 3, '#6FC3F0'); R(g, 46, 10, 3, 13, '#6FC3F0'); R(g, 44, 18, 7, 7, '#FFD47B');
      break;
    case 'C5':
      R(g, 0, 0, W, 18, '#E8B08F'); R(g, 0, 18, W, 22, '#C27A57');
      R(g, 0, 18, 22, 4, '#9E6680'); R(g, 40, 14, 24, 6, '#9E6680');
      R(g, 28, 22, 8, 12, '#E9F3EF'); g.fillStyle = 'rgba(207,239,240,0.8)'; g.beginPath(); g.arc(32, 20, 5, 0, Math.PI * 2); g.fill();
      R(g, 48, 26, 10, 2, '#FFF4DA');
      break;
    case 'C6':
      R(g, 0, 0, W, H, '#FFF1D6'); g.fillStyle = '#F6E2BC'; g.beginPath(); g.arc(32, 40, 30, Math.PI, 0); g.fill();
      R(g, 24, 6, 16, 12, '#DDE7F0'); R(g, 27, 9, 4, 3, '#3D5E78'); R(g, 33, 9, 4, 3, '#3D5E78'); R(g, 29, 14, 6, 1, '#3D5E78');
      g.fillStyle = '#96D9BC'; [[12, 26], [18, 20], [48, 24]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); });
      R(g, 0, 32, W, 8, '#CFE6D8');
      break;
    case 'C7':
      R(g, 0, 0, W, 16, '#E2A383'); R(g, 0, 16, W, 24, '#C27A57');
      R(g, 8, 22, 22, 8, '#E9F3EF'); R(g, 10, 30, 4, 4, '#283044'); R(g, 24, 30, 4, 4, '#283044');
      R(g, 44, 20, 8, 8, '#CFEFF0'); R(g, 47, 17, 2, 14, '#CFEFF0'); R(g, 41, 23, 14, 2, '#CFEFF0');
      break;
    default:
      R(g, 0, 0, W, H, '#FFF1D6'); R(g, 8, 22, 48, 10, '#B98A5A'); R(g, 8, 32, 4, 8, '#8C5A3A'); R(g, 52, 32, 4, 8, '#8C5A3A');
      R(g, 14, 16, 16, 7, '#FFF8E8'); R(g, 16, 18, 10, 1, '#A3A3AE'); R(g, 16, 20, 8, 1, '#A3A3AE');
      R(g, 40, 18, 6, 5, '#8C5A3A'); R(g, 42, 12, 2, 6, '#3E7A34'); R(g, 39, 11, 4, 2, '#6FBF5A'); R(g, 43, 11, 4, 2, '#6FBF5A');
  }
  g.strokeStyle = '#283044';
  g.lineWidth = 2;
  g.strokeRect(1, 1, W - 2, H - 2);
  return c.toDataURL();
}

/** 돔 창문에 비친 플레이어 (원형 창 + 도트 캐릭터) */
export function domeWindowCanvas(look: Look, scale = 4): HTMLCanvasElement {
  const size = 48;
  const { c, g } = makeCanvas(size * scale, size * scale);
  g.imageSmoothingEnabled = false;
  g.save();
  g.scale(scale, scale);
  g.fillStyle = '#283044'; g.beginPath(); g.arc(24, 24, 23, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1D2B44'; g.beginPath(); g.arc(24, 24, 20, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#C27A57'; g.beginPath(); g.arc(24, 24, 20, 0.15 * Math.PI, 0.85 * Math.PI); g.fill();
  g.fillStyle = '#FFF4DA';
  [[12, 12], [30, 9], [36, 18], [16, 20], [26, 15]].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  g.restore();
  const sheet = buildSheet(look);
  g.drawImage(sheet, FRAME.down[0] * FRAME_W, 0, FRAME_W, FRAME_H, (size * scale) / 2 - (FRAME_W * scale) / 2, (size * scale) / 2 - (FRAME_H * scale) / 2 + scale * 2, FRAME_W * scale, FRAME_H * scale);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath(); g.arc(18 * scale, 16 * scale, 6 * scale, 0, Math.PI * 2); g.fill();
  return c;
}
