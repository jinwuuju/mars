import Phaser from 'phaser';
import type { Look } from '../art/look';
import { buildNoknokSheet, buildSheet, FRAME, FRAME_COUNT, FRAME_H, FRAME_W } from '../art/sprites';

/** 여러 장면이 공유하는 캐릭터 텍스처·애니메이션 생성기 (텍스처와 애니메이션은 전역이라 한 번만 만든다) */
export function ensureChar(scene: Phaser.Scene, key: string, look: Look): void {
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.addCanvas(key, buildSheet(look));
    if (tex) for (let i = 0; i < FRAME_COUNT; i += 1) tex.add(i, 0, i * FRAME_W, 0, FRAME_W, FRAME_H);
  }
  const mk = (name: string, frames: readonly number[]): void => {
    const k = `${key}-${name}`;
    if (scene.anims.exists(k)) return;
    scene.anims.create({ key: k, frames: [frames[1], frames[0], frames[2], frames[0]].map((f) => ({ key, frame: f })), frameRate: 7, repeat: -1 });
  };
  mk('down', FRAME.down);
  mk('up', FRAME.up);
  mk('side', FRAME.side);
}

export function ensureNoknok(scene: Phaser.Scene): void {
  if (scene.textures.exists('noknok')) return;
  const tex = scene.textures.addCanvas('noknok', buildNoknokSheet());
  if (tex) { tex.add(0, 0, 0, 0, 16, 16); tex.add(1, 0, 16, 0, 16, 16); }
}

export function ensureCanvas(scene: Phaser.Scene, key: string, make: () => HTMLCanvasElement): void {
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, make());
}

export function ensureDot(scene: Phaser.Scene, key: string, color: number, size: number, round = false): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(color, 1);
  if (round) g.fillCircle(size / 2, size / 2, size / 2);
  else g.fillRect(0, 0, size, size);
  g.generateTexture(key, size, size);
  g.destroy();
}

export function fitZoom(scene: Phaser.Scene, w: number, h: number, min = 1, max = 4): number {
  return Math.max(min, Math.min(max, Math.floor(Math.min(scene.scale.width / w, scene.scale.height / h))));
}
