import Phaser from 'phaser';
import { paintArk, paintEarth, paintMars } from '../art/space';
import { buildNoknokSheet } from '../art/sprites';

export interface TitleInit {
  reducedMotion: boolean;
}

function addSheet(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, fw: number, fh: number, frames: number): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.addCanvas(key, canvas);
  if (!tex) return;
  for (let i = 0; i < frames; i += 1) tex.add(i, 0, i * fw, 0, fw, fh);
}

/** 타이틀: 재로 덮인 지구, 작은 붉은 화성, 그 사이를 나는 아크-06, 떠다니는 녹녹이 */
export class TitleScene extends Phaser.Scene {
  private reduced = false;

  constructor() {
    super('title');
  }

  init(data: Partial<TitleInit>): void {
    this.reduced = Boolean(data.reducedMotion);
  }

  create(): void {
    addSheet(this, 'earth', paintEarth(128), 128, 128, 1);
    addSheet(this, 'mars', paintMars(36), 36, 36, 1);
    addSheet(this, 'ark', paintArk(), 20, 9, 2);
    addSheet(this, 'noknok', buildNoknokSheet(), 16, 16, 2);

    const g = this.add.graphics();
    for (let i = 0; i < 420; i += 1) {
      const x = ((i * 977) % 1100) - 390;
      const y = ((i * 613) % 900) - 350;
      const b = i % 7 === 0 ? 0xfff4da : i % 3 === 0 ? 0x96d9bc : 0x8a93b8;
      g.fillStyle(b, i % 5 === 0 ? 1 : 0.6);
      g.fillRect(x, y, i % 11 === 0 ? 2 : 1, 1);
    }

    this.add.image(96, 116, 'earth');
    this.add.image(268, 50, 'mars');

    const ark = this.add.sprite(160, 92, 'ark', 0);
    const noknok = this.add.sprite(252, 150, 'noknok', 0);

    if (!this.reduced) {
      let flame = 0;
      this.time.addEvent({ delay: 160, loop: true, callback: () => { flame = 1 - flame; ark.setFrame(flame); } });
      this.tweens.add({ targets: ark, x: 236, y: 64, duration: 9000, repeat: -1, ease: 'Sine.easeInOut', yoyo: false });
      this.tweens.add({ targets: noknok, y: 144, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.time.addEvent({ delay: 2600, loop: true, callback: () => noknok.setFrame(1) });
      this.time.addEvent({ delay: 2600, startAt: 2400, loop: true, callback: () => noknok.setFrame(0) });
      for (let i = 0; i < 3; i += 1) {
        const fx = this.add.circle(60 + i * 26, 70 + i * 30, 2, 0xf48b70, 0);
        this.tweens.add({ targets: fx, alpha: { from: 0, to: 0.9 }, scale: { from: 0.5, to: 2.2 }, duration: 600, delay: i * 1700, yoyo: true, repeat: -1, repeatDelay: 4200 });
      }
    }

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const zoom = Math.max(1, Math.min(4, Math.floor(Math.min(w / 330, h / 230))));
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn(170, w < h ? 128 : 104);
  }
}
