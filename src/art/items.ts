import { INK, makeCanvas, Pix } from './sprites';

/** 수하물 물품 아이콘 (16x16 오리지널 도트) */
export function drawItem(id: string): Pix {
  const p = new Pix(16, 16);
  switch (id) {
    case 'photo':
      p.rect(2, 3, 12, 10, '#8C5A3A');
      p.rect(3, 4, 10, 8, '#9FD8E8');
      p.rect(3, 9, 10, 3, '#6FBF5A');
      p.rect(7, 7, 2, 3, '#F6C744');
      break;
    case 'music':
      p.rect(2, 4, 12, 9, '#4A4F6B');
      p.ellipse(5.5, 8.5, 2, 2, '#E9F3EF');
      p.ellipse(10.5, 8.5, 2, 2, '#E9F3EF');
      p.rect(4, 5, 8, 1, '#FFD47B');
      break;
    case 'parts':
      p.ellipse(8, 8, 6, 6, '#AEB6C8');
      for (const [x, y] of [[7, 1], [7, 13], [1, 7], [13, 7]]) p.rect(x, y, 2, 2, '#AEB6C8');
      p.ellipse(8, 8, 2.2, 2.2, '#5A6488');
      break;
    case 'seeds':
      p.rect(3, 2, 10, 12, '#F3E7C8');
      p.rect(3, 2, 10, 2, '#D9C9A0');
      p.rect(7, 7, 2, 5, '#3E7A34');
      p.rect(5, 6, 2, 2, '#6FBF5A');
      p.rect(9, 6, 2, 2, '#6FBF5A');
      break;
    case 'games':
      p.rect(2, 4, 12, 9, '#F48B70');
      p.rect(2, 4, 12, 2, '#D96E55');
      p.rect(5, 8, 2, 2, '#FFFFFF');
      p.rect(9, 9, 2, 2, '#FFFFFF');
      break;
    case 'filter':
      p.rect(4, 2, 8, 12, '#96D9BC');
      p.rect(4, 2, 8, 2, '#5A6488');
      p.rect(4, 12, 8, 2, '#5A6488');
      p.rect(6, 5, 1, 6, '#DDF5EA');
      break;
    case 'sewing':
      p.rect(4, 4, 8, 8, '#E0503F');
      p.rect(3, 3, 10, 1, '#B98A5A');
      p.rect(3, 12, 10, 1, '#B98A5A');
      p.rect(13, 2, 1, 10, '#DDE3EE');
      break;
    case 'soil':
      p.rect(4, 3, 8, 11, '#CFEFF0');
      p.rect(4, 8, 8, 6, '#6B4128');
      p.rect(3, 2, 10, 2, '#5A6488');
      p.set(7, 7, '#6FBF5A');
      break;
    case 'teabag':
      p.rect(4, 6, 8, 8, '#8DB860');
      p.rect(4, 6, 8, 1, '#A9CD7E');
      p.rect(8, 2, 1, 4, '#E9F3EF');
      p.rect(7, 1, 3, 2, '#FFF4DA');
      break;
    case 'legacy_muffler':
      p.rect(2, 5, 12, 4, '#E0503F');
      p.rect(9, 9, 3, 5, '#E0503F');
      p.rect(2, 6, 12, 1, '#F07A68');
      break;
    case 'legacy_notebook':
      p.rect(3, 2, 10, 12, '#B96A27');
      p.rect(4, 3, 8, 10, '#FFF4DA');
      p.rect(5, 5, 6, 1, '#A3A3AE');
      p.rect(5, 8, 6, 1, '#A3A3AE');
      break;
    case 'legacy_medcards':
      p.rect(3, 3, 10, 10, '#FFFFFF');
      p.rect(7, 4, 2, 8, '#E0503F');
      p.rect(4, 7, 8, 2, '#E0503F');
      break;
    case 'legacy_seeds':
      p.rect(2, 4, 12, 9, '#E9D9B2');
      p.rect(2, 4, 12, 3, '#D4C090');
      p.rect(7, 8, 2, 3, '#4E8A3A');
      p.rect(6, 7, 1, 1, '#7CC25A');
      p.rect(9, 7, 1, 1, '#7CC25A');
      break;
    case 'legacy_voices':
      p.rect(3, 4, 10, 8, '#8E6CC0');
      p.rect(4, 5, 8, 2, '#B79BE0');
      p.rect(11, 9, 1, 1, '#96D9BC');
      break;
    case 'legacy_sap':
      p.rect(4, 5, 8, 7, '#E9F3EF');
      p.rect(6, 3, 4, 2, '#C9D6D2');
      p.rect(6, 7, 1, 1, '#2FC9C0');
      p.rect(9, 7, 1, 1, '#2FC9C0');
      p.rect(4, 12, 2, 2, '#5A6488');
      p.rect(10, 12, 2, 2, '#5A6488');
      break;
    default:
      p.rect(4, 4, 8, 8, '#B8A27A');
  }
  p.outline(INK);
  return p;
}

const itemCache = new Map<string, string>();
export function itemURL(id: string): string {
  const hit = itemCache.get(id);
  if (hit) return hit;
  const { c, g } = makeCanvas(16, 16);
  drawItem(id).paint(g, 0, 0);
  const url = c.toDataURL();
  itemCache.set(id, url);
  return url;
}

export function itemCanvas(id: string): HTMLCanvasElement {
  const { c, g } = makeCanvas(16, 16);
  drawItem(id).paint(g, 0, 0);
  return c;
}

/** 아크-06 좌석 등받이 (등 쪽에서 본 모습, 20x16) */
export function seatCanvas(): HTMLCanvasElement {
  const p = new Pix(20, 16);
  p.rect(2, 2, 16, 13, '#3D5E78');
  p.rect(4, 0, 12, 3, '#547E9D');
  p.rect(3, 4, 14, 1, '#96D9BC');
  p.rect(9, 6, 2, 8, '#2F4A62');
  p.outline(INK);
  const { c, g } = makeCanvas(20, 16);
  p.paint(g, 0, 0);
  return c;
}

/** 발사 장면용 세로형 아크-06 (16x40) */
export function shipCanvas(): HTMLCanvasElement {
  const p = new Pix(16, 40);
  p.ellipse(8, 7, 4.5, 7, '#FFF4DA');
  p.rect(4, 7, 8, 26, '#FFF4DA');
  p.rect(10, 7, 2, 26, '#E3D6B4');
  p.rect(4, 14, 8, 2, '#283044');
  p.rect(4, 26, 8, 2, '#283044');
  p.ellipse(8, 10, 1.6, 1.6, '#96D9BC');
  p.rect(1, 27, 3, 8, '#547E9D');
  p.rect(12, 27, 3, 8, '#547E9D');
  p.rect(5, 33, 6, 3, '#5A6488');
  p.outline(INK);
  const { c, g } = makeCanvas(16, 40);
  p.paint(g, 0, 0);
  return c;
}

/** MIRROR: 둥근 거울 패널 위의 도트 얼굴 (16x16) */
export function mirrorURL(): string {
  const p = new Pix(16, 16);
  p.ellipse(8, 8, 7, 7, '#C9D6E8');
  p.ellipse(8, 8, 5.5, 5.5, '#E9F3FA');
  p.rect(5, 7, 2, 2, '#3D5E78');
  p.rect(9, 7, 2, 2, '#3D5E78');
  p.rect(6, 11, 4, 1, '#3D5E78');
  p.set(4, 4, '#FFFFFF');
  p.set(5, 3, '#FFFFFF');
  p.outline(INK);
  const { c, g } = makeCanvas(16, 16);
  p.paint(g, 0, 0);
  return c.toDataURL();
}
