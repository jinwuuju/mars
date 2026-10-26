import { makeCanvas } from './sprites';

function hash2(x: number, y: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** 재로 덮인 푸른 지구 (가상의 2087년, 극적으로 표현한 SF 연출). 행성은 폭발하지 않는다. */
export function paintEarth(size = 128): HTMLCanvasElement {
  const { c, g } = makeCanvas(size, size);
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let col: string | null = null;
      if (d <= r) {
        const n = noise(x / 11, y / 11, 1) * 0.7 + noise(x / 5, y / 5, 2) * 0.3;
        const land = n > 0.56;
        col = land ? '#5E7C5A' : '#3F6E9A';
        if (n > 0.5 && n < 0.53) col = '#5684AE';
        const ash = noise(x / 8, y / 8, 3) * 0.75 + noise(x / 3, y / 3, 4) * 0.25;
        if (ash > 0.62) col = '#868893';
        else if (ash > 0.55 && (x + y) % 2 === 0) col = '#9A9BA6';
        const light = -(dx * 0.7 + dy * 0.35) / r;
        if (light < -0.5) col = (x + y) % 3 === 0 ? '#22304A' : '#1A2338';
        else if (light < -0.25 && (x + y) % 2 === 0) col = '#2A3A58';
        if (hash2(x >> 2, y >> 2, 9) > 0.986 && light > -0.3) col = '#F48B70';
        if (d > r - 1.2) col = '#8FB8D8';
      } else if (d <= r + 1.5) {
        col = '#3A5F86';
      }
      if (col) {
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  return c;
}

export function paintMars(size = 36): HTMLCanvasElement {
  const { c, g } = makeCanvas(size, size);
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) continue;
      let col = noise(x / 4, y / 4, 5) > 0.55 ? '#B86F55' : '#D99573';
      if (dy < -r * 0.78) col = '#F3E6DA';
      const light = -(dx * 0.6 + dy * 0.3) / r;
      if (light < -0.45) col = (x + y) % 2 === 0 ? '#9E6680' : '#7E4F66';
      if (d > r - 1) col = '#E8B08F';
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** 아크-06 미니 도트 (20x9, 2프레임: 불꽃 깜박임) */
export function paintArk(): HTMLCanvasElement {
  const { c, g } = makeCanvas(40, 9);
  for (let f = 0; f < 2; f += 1) {
    const o = f * 20;
    const R = (x: number, y: number, w: number, h: number, col: string): void => { g.fillStyle = col; g.fillRect(o + x, y, w, h); };
    R(5, 3, 11, 3, '#FFF4DA');
    R(5, 6, 11, 1, '#C9B98F');
    R(16, 4, 2, 2, '#FFF4DA');
    R(18, 4, 1, 1, '#E9D9B2');
    R(10, 4, 2, 1, '#96D9BC');
    R(13, 4, 1, 1, '#96D9BC');
    R(6, 2, 4, 1, '#283044');
    R(6, 7, 4, 1, '#283044');
    R(4, 3, 1, 4, '#283044');
    R(1 + f, 4, 3 - f, 2, '#F48B70');
    R(2, 4, 2, 1, '#FFD47B');
  }
  return c;
}
