import type { Accessory, Look } from './look';

/** 절차적 오리지널 도트 스프라이트. 외부 이미지 없이 코드만으로 재현된다. */
export const INK = '#1E2336';
const EYE = '#232338';
const WHITE = '#FFFFFF';
const BLUSH = '#F29C93';
const MOUTH = '#A85A55';

export class Pix {
  readonly w: number;
  readonly h: number;
  private readonly px: (string | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Array<string | null>(w * h).fill(null);
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }

  set(x: number, y: number, c: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) this.set(i, j, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string, keep?: (x: number, y: number) => boolean): void {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y += 1) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x += 1) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!keep || keep(x, y))) this.set(x, y, c);
      }
    }
  }

  /** 비어 있는 픽셀 중 채워진 이웃이 있는 곳에 1px 외곽선 */
  outline(c: string): void {
    const add: number[] = [];
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        if (this.get(x, y) !== null) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push(y * this.w + x);
      }
    }
    for (const i of add) this.px[i] = c;
  }

  paint(ctx: CanvasRenderingContext2D, ox: number, oy: number, flip = false): void {
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        const c = this.get(x, y);
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + (flip ? this.w - 1 - x : x), oy + y, 1, 1);
      }
    }
  }
}

export type Dir = 'down' | 'up' | 'side';
export type Expr = 'neutral' | 'worry' | 'relief' | 'joy';

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

function inHair(x: number, y: number): boolean {
  const dx = (x + 0.5 - 12) / 8.7;
  const dy = (y + 0.5 - 11) / 8.2;
  return dx * dx + dy * dy <= 1;
}

function drawLegs(p: Pix, L: Look, dir: Dir, step: 0 | 1 | 2): void {
  if (dir === 'side') {
    const a = step === 1 ? 1 : step === 2 ? -1 : 0;
    p.rect(10 - a, 27, 2, 3, L.pants);
    p.rect(9 - a, 30, 3, 1, L.shoes);
    p.rect(13 + a, 27, 2, 3, L.pants);
    p.rect(12 + a, 30, 3, 1, L.shoes);
    return;
  }
  const lUp = step === 1 ? 1 : 0;
  const rUp = step === 2 ? 1 : 0;
  p.rect(8, 27, 3, 3 - lUp, L.pants);
  p.rect(8, 30 - lUp, 3, 1, L.shoes);
  p.rect(13, 27, 3, 3 - rUp, L.pants);
  p.rect(13, 30 - rUp, 3, 1, L.shoes);
}

function drawBody(p: Pix, L: Look, dir: Dir, step: 0 | 1 | 2): void {
  if (dir === 'side') {
    p.rect(8, 19, 8, 8, L.outfit);
    p.rect(14, 19, 2, 8, L.outfitDark);
    const swing = step === 1 ? -1 : step === 2 ? 1 : 0;
    p.rect(11 + swing, 20, 2, 5, L.outfitDark);
    p.rect(11 + swing, 25, 2, 1, L.skin);
    return;
  }
  p.rect(7, 19, 10, 8, L.outfit);
  p.rect(15, 20, 2, 7, L.outfitDark);
  p.rect(7, 26, 10, 1, L.outfitDark);
  const aL = step === 1 ? 1 : 0;
  const aR = step === 2 ? 1 : 0;
  p.rect(5, 20 + aL, 2, 5, L.outfit);
  p.rect(5, 25 + aL, 2, 1, L.skin);
  p.rect(17, 20 + aR, 2, 5, L.outfitDark);
  p.rect(17, 25 + aR, 2, 1, L.skin);
}

function drawHelmet(p: Pix, L: Look, dir: Dir): void {
  const C = L.hat ?? '#FFD447';
  const Cd = '#C9952A';
  for (let y = 0; y <= 9; y += 1) for (let x = 0; x < 24; x += 1) if (inHair(x, y) && y <= 8) p.set(x, y, x >= 15 ? Cd : C);
  if (dir === 'side') p.rect(1, 9, 12, 1, Cd);
  else p.rect(3, 9, 18, 1, Cd);
  if (dir === 'down') {
    p.rect(4, 10, 2, 2, L.hair);
    p.rect(18, 10, 2, 2, L.hair);
    p.set(12, 5, L.accent);
    p.set(11, 5, L.accent);
  } else if (dir === 'up') {
    for (let y = 10; y <= 15; y += 1) for (let x = 0; x < 24; x += 1) if (inHair(x, y)) p.set(x, y, L.hair);
  } else {
    for (let y = 10; y <= 15; y += 1) for (let x = 13; x < 24; x += 1) if (inHair(x, y)) p.set(x, y, L.hair);
    p.set(7, 5, L.accent);
  }
}

function drawHair(p: Pix, L: Look, dir: Dir): void {
  if (L.style === 'helmet') {
    drawHelmet(p, L, dir);
    return;
  }
  const H = L.hair;
  const D = L.hairDark;
  const cap = L.style === 'neat' ? 8 : 9;
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 24; x += 1) {
      if (!inHair(x, y)) continue;
      if (dir === 'up') {
        if (y <= 18) p.set(x, y, y >= 15 ? D : H);
      } else if (dir === 'side') {
        if (y <= cap || (x >= 12 && y <= 16)) p.set(x, y, x >= 16 && y >= 11 ? D : H);
      } else if (y <= cap) {
        p.set(x, y, H);
      }
    }
  }
  if (L.style === 'beanie') {
    const hat = L.hat ?? '#4F8A45';
    for (let y = 0; y <= 8; y += 1) for (let x = 0; x < 24; x += 1) if (inHair(x, y) && y <= 7) p.set(x, y, hat);
    for (let x = 0; x < 24; x += 1) if (inHair(x, 8)) p.set(x, 8, '#3C6B34');
  }
  const put = (xs: number[], y: number, c = H): void => xs.forEach((x) => p.set(x, y, c));
  if (dir === 'side') {
    put(range(4, 8), 9);
    put(range(4, 6), 10);
    return;
  }
  if (dir === 'up') return;
  switch (L.style) {
    case 'short':
    case 'pony':
      put(range(4, 19).filter((x) => x % 4 !== 1), 10);
      for (let y = 10; y <= 13; y += 1) { put([3, 4], y); put([19, 20], y); }
      break;
    case 'neat':
      put([...range(4, 9), ...range(14, 19)], 9);
      put([4, 5, 18, 19], 10);
      put([3, 4, 19, 20], 11);
      break;
    case 'bob':
      put(range(4, 19).filter((x) => x !== 11 && x !== 12), 10);
      put([4, 5, 6, 17, 18, 19], 11);
      for (let y = 11; y <= 17; y += 1) { put([3, 4], y, y > 14 ? D : H); put([19, 20], y, y > 14 ? D : H); }
      break;
    case 'twin':
      put(range(4, 19).filter((x) => x % 3 !== 0), 10);
      for (let y = 10; y <= 14; y += 1) { put([3, 4], y); put([19, 20], y); }
      break;
    case 'messy':
      put([6, 9, 10, 14, 15, 17], 2);
      put([5, 8, 13, 18], 3);
      put([5, 6, 7, 9, 10, 13, 14, 16, 17, 18], 10);
      put([4, 6, 17, 19], 11);
      for (let y = 10; y <= 12; y += 1) { put([3], y); put([20], y); }
      break;
    case 'beanie':
      put([4, 5, 6, 17, 18, 19], 9);
      put([3, 4, 19, 20], 10);
      put([3, 4, 19, 20], 11);
      break;
    default:
      break;
  }
}

function has(L: Look, a: Accessory): boolean {
  return L.acc.includes(a);
}

function drawAccPre(p: Pix, L: Look, dir: Dir, step: 0 | 1 | 2): void {
  if (has(L, 'muffler')) {
    p.rect(6, 18, 12, 2, L.accent);
    if (dir === 'down') p.rect(14, 20, 2, 4, L.accent);
    else if (dir === 'up') p.rect(8, 20, 2, 5, L.accent);
    else p.rect(15, 20, 2, 3, L.accent);
  }
  if (has(L, 'wrench') && dir !== 'up') {
    const x = dir === 'side' ? 8 : 19;
    p.rect(x, 21, 1, 6, '#AEB6C8');
    p.rect(x - 1, 20, 3, 2, '#AEB6C8');
  }
  if (has(L, 'robot')) {
    const rx = dir === 'side' ? 15 : 18;
    p.rect(rx, 16, 4, 3, '#E9F3EF');
    p.rect(rx + 1, 15, 2, 1, '#C9D6D2');
  }
  if (has(L, 'headphones')) {
    p.rect(7, 2, 10, 1, L.accent);
    p.set(5, 3, L.accent);
    p.set(6, 3, L.accent);
    p.set(17, 3, L.accent);
    p.set(18, 3, L.accent);
    if (dir === 'side') p.rect(12, 10, 3, 4, L.accent);
    else { p.rect(2, 10, 2, 4, L.accent); p.rect(20, 10, 2, 4, L.accent); }
  }
  if (has(L, 'sprout')) {
    p.set(11, 1, '#3E7A34');
    p.set(11, 2, '#3E7A34');
    p.rect(9, 0, 2, 1, '#6FBF5A');
    p.set(10, 1, '#6FBF5A');
    p.rect(12, 0, 2, 1, '#6FBF5A');
    p.set(12, 1, '#6FBF5A');
  }
  if (has(L, 'tea') && dir !== 'up') {
    // 손에서 놓지 않는 초록 녹차 보온병
    const x = dir === 'side' ? 9 : 18;
    p.rect(x, 22, 3, 5, '#5E9E4A');
    p.rect(x, 21, 3, 1, '#E9F3EF');
    p.rect(x, 24, 3, 1, '#3E7A34');
  }
  if (has(L, 'gloves') && dir !== 'side') {
    p.rect(4, 24 + (step === 1 ? 1 : 0), 3, 2, '#566078');
    p.rect(17, 24 + (step === 2 ? 1 : 0), 3, 2, '#566078');
  }
}

function drawAccPost(p: Pix, L: Look, dir: Dir): void {
  if (has(L, 'goggles') && dir !== 'up') {
    if (dir === 'down') { p.rect(4, 8, 16, 1, '#3B3F55'); p.rect(7, 7, 3, 2, '#9FD8E8'); p.rect(14, 7, 3, 2, '#9FD8E8'); }
    else { p.rect(4, 8, 9, 1, '#3B3F55'); p.rect(5, 7, 3, 2, '#9FD8E8'); }
  }
  if (has(L, 'pouch') && dir === 'down') p.rect(14, 23, 3, 3, L.accent);
  if (has(L, 'vest')) p.rect(dir === 'side' ? 8 : 7, 22, dir === 'side' ? 8 : 10, 1, '#F4F4F4');
  if (has(L, 'armband') && dir !== 'up') p.rect(dir === 'side' ? 11 : 5, 21, 2, 1, L.accent);
  if (has(L, 'bag') && dir === 'down') for (let i = 0; i < 7; i += 1) p.set(15 - i, 19 + i, L.accent);
  if (has(L, 'robot') && dir !== 'up') p.set(dir === 'side' ? 16 : 19, 17, '#3FA9F5');
  if (has(L, 'tea') && dir === 'down') { p.set(19, 19, '#DCEFD2'); p.set(20, 18, '#DCEFD2'); }
  if (has(L, 'beard') && dir === 'down') { p.rect(10, 15, 4, 1, L.hair); p.rect(9, 16, 6, 2, L.hair); }
}

function drawFace(p: Pix, L: Look, expr: Expr): void {
  const eyes = [8, 14];
  for (const ex of eyes) {
    if (expr === 'joy') {
      p.set(ex - 1 + (ex === 14 ? 1 : 0), 13, EYE);
      p.set(ex + (ex === 14 ? 1 : 0), 12, EYE);
      p.set(ex + 1 + (ex === 14 ? 1 : 0), 13, EYE);
    } else if (expr === 'relief') {
      p.rect(ex, 13, 2, 1, EYE);
    } else {
      p.rect(ex, 12, 2, 2, EYE);
      p.set(ex, 12, WHITE);
    }
  }
  if (expr === 'worry') {
    p.set(8, 11, EYE); p.set(9, 10, EYE);
    p.set(14, 10, EYE); p.set(15, 11, EYE);
    p.set(19, 8, '#8FD3F4'); p.set(19, 9, '#8FD3F4');
  }
  p.rect(6, 15, 2, 1, BLUSH);
  p.rect(16, 15, 2, 1, BLUSH);
  if (expr === 'joy' || expr === 'relief') { p.set(10, 15, MOUTH); p.set(11, 16, MOUTH); p.set(12, 16, MOUTH); p.set(13, 15, MOUTH); }
  else if (expr === 'worry') { p.rect(11, 16, 2, 2, MOUTH); }
  else { p.rect(11, 16, 2, 1, MOUTH); }
  if (has(L, 'glasses')) {
    const frame = '#2B2B40';
    for (const gx of [7, 13]) {
      p.rect(gx, 11, 4, 1, frame); p.rect(gx, 14, 4, 1, frame);
      p.set(gx, 12, frame); p.set(gx, 13, frame); p.set(gx + 3, 12, frame); p.set(gx + 3, 13, frame);
    }
    p.rect(11, 12, 2, 1, frame);
  }
}

function drawSideFace(p: Pix, expr: Expr): void {
  if (expr === 'joy' || expr === 'relief') p.rect(5, 13, 2, 1, EYE);
  else { p.rect(5, 12, 2, 2, EYE); p.set(5, 12, WHITE); }
  p.rect(7, 15, 2, 1, BLUSH);
  p.set(7, 16, MOUTH);
}

export function drawCharacter(L: Look, dir: Dir, step: 0 | 1 | 2, expr: Expr = 'neutral'): Pix {
  const p = new Pix(24, 32);
  if (L.style === 'twin') {
    if (dir === 'side') p.ellipse(19.5, 15, 2, 3.2, L.hair);
    else { p.ellipse(3.5, 15, 2, 3.2, L.hair); p.ellipse(20.5, 15, 2, 3.2, L.hair); }
  }
  if (L.style === 'pony') {
    if (dir === 'up') p.ellipse(12, 19, 2, 3, L.hair);
    if (dir === 'side') p.ellipse(19, 14, 2, 3.5, L.hair);
  }
  drawLegs(p, L, dir, step);
  drawBody(p, L, dir, step);
  p.ellipse(12, 11, 8, 7.5, L.skin);
  drawHair(p, L, dir);
  drawAccPre(p, L, dir, step);
  p.outline(INK);
  if (dir === 'down') drawFace(p, L, expr);
  if (dir === 'side') drawSideFace(p, expr);
  drawAccPost(p, L, dir);
  if (L.style === 'twin' && dir === 'down') { p.set(3, 12, L.accent); p.set(20, 12, L.accent); }
  return p;
}

export const FRAME_W = 24;
export const FRAME_H = 32;
const FRAME_DEFS: { dir: Dir; step: 0 | 1 | 2; expr: Expr }[] = [
  { dir: 'down', step: 0, expr: 'neutral' }, { dir: 'down', step: 1, expr: 'neutral' }, { dir: 'down', step: 2, expr: 'neutral' },
  { dir: 'up', step: 0, expr: 'neutral' }, { dir: 'up', step: 1, expr: 'neutral' }, { dir: 'up', step: 2, expr: 'neutral' },
  { dir: 'side', step: 0, expr: 'neutral' }, { dir: 'side', step: 1, expr: 'neutral' }, { dir: 'side', step: 2, expr: 'neutral' },
  { dir: 'down', step: 0, expr: 'worry' }, { dir: 'down', step: 0, expr: 'relief' }, { dir: 'down', step: 0, expr: 'joy' },
];
export const FRAME = { down: [0, 1, 2], up: [3, 4, 5], side: [6, 7, 8], worry: 9, relief: 10, joy: 11 } as const;
export const FRAME_COUNT = FRAME_DEFS.length;

function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D 캔버스를 만들 수 없어요');
  return { c, g };
}

export function buildSheet(L: Look): HTMLCanvasElement {
  const { c, g } = makeCanvas(FRAME_W * FRAME_COUNT, FRAME_H);
  FRAME_DEFS.forEach((f, i) => drawCharacter(L, f.dir, f.step, f.expr).paint(g, i * FRAME_W, 0));
  return c;
}

const portraitCache = new Map<string, string>();
export function portraitURL(L: Look, expr: Expr = 'neutral'): string {
  const key = JSON.stringify(L) + expr;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  const { c, g } = makeCanvas(FRAME_W, FRAME_H);
  drawCharacter(L, 'down', 0, expr).paint(g, 0, 0);
  const url = c.toDataURL();
  portraitCache.set(key, url);
  return url;
}

/** 안내 드론 녹녹이: 대피소 찻집의 녹차 추천 AI가 점검 드론 몸체에 옮겨 탄 모습. 찻잔 몸통 + 거품 뚜껑 + 찻잎 안테나 (16x16, 2프레임) */
export function drawNoknok(frame: 0 | 1): Pix {
  const p = new Pix(16, 16);
  p.ellipse(8, 9.5, 6, 5, '#8DB860');
  p.ellipse(8, 9.5, 6, 5, '#6E9A45', (_x, y) => y >= 12);
  p.ellipse(8, 6, 5.5, 3, '#E4F0C8');
  p.set(8, 1, '#4E8A3A');
  p.set(8, 2, '#4E8A3A');
  p.rect(9, 0, 2, 1, '#7CC25A');
  p.set(9, 1, '#7CC25A');
  p.rect(6, 1, 2, 1, '#7CC25A');
  p.rect(14, 8, 1, 3, '#6E9A45');
  p.outline(INK);
  const eye = '#2FC9C0';
  if (frame === 1) {
    p.rect(5, 9, 2, 1, eye);
    p.rect(9, 9, 2, 1, eye);
  } else {
    p.rect(5, 8, 2, 2, eye);
    p.rect(9, 8, 2, 2, eye);
    p.set(5, 8, '#C8FFF8');
    p.set(9, 8, '#C8FFF8');
  }
  p.set(4, 11, '#F2A08F');
  p.set(11, 11, '#F2A08F');
  p.rect(7, 11, 2, 1, '#4E6B33');
  p.set(4, 5, WHITE);
  p.set(12, frame === 0 ? 2 : 1, '#F4FAF0');
  p.set(13, frame === 0 ? 1 : 0, '#F4FAF0');
  return p;
}

export function buildNoknokSheet(): HTMLCanvasElement {
  const { c, g } = makeCanvas(32, 16);
  drawNoknok(0).paint(g, 0, 0);
  drawNoknok(1).paint(g, 16, 0);
  return c;
}

let noknokCache: string | null = null;
export function noknokURL(): string {
  if (noknokCache) return noknokCache;
  const { c, g } = makeCanvas(16, 16);
  drawNoknok(0).paint(g, 0, 0);
  noknokCache = c.toDataURL();
  return noknokCache;
}

export { makeCanvas };
