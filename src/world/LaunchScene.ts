import Phaser from 'phaser';
import { NPC_LOOKS } from '../art/look';
import { FRAME, makeCanvas } from '../art/sprites';
import { shipCanvas } from '../art/items';
import { paintEarth } from '../art/space';
import { ensureCanvas, ensureChar, ensureDot, fitZoom } from './chars';

export interface LaunchInit {
  reduced: boolean;
  /** 저울 3에서 보람의 수동 리셋을 골랐으면 갠트리 위에 보람이 보인다 */
  boram: boolean;
  /** 자체 재보정으로 좁은 창에 떠나면 더 심하게 흔들린다 */
  rough: boolean;
  onCaption(text: string | null): void;
  onDone(): void;
}

const W = 240;
const H = 900;
const PAD_Y = 860;

function paintSky(): HTMLCanvasElement {
  const { c, g } = makeCanvas(W, H);
  const stops: [number, string][] = [[0, '#05060C'], [180, '#0B1024'], [330, '#171D34'], [460, '#2E1D3A'], [560, '#4A1B2A'], [660, '#6E2630'], [760, '#933A33'], [840, '#B5583C']];
  for (let i = 0; i < stops.length; i += 1) {
    const [y, col] = stops[i];
    const y2 = i + 1 < stops.length ? stops[i + 1][0] : H;
    g.fillStyle = col;
    g.fillRect(0, y, W, y2 - y);
  }
  for (let i = 0; i < 160; i += 1) {
    g.fillStyle = i % 5 === 0 ? '#FFF4DA' : '#8A93B8';
    g.fillRect((i * 53) % W, (i * 29) % 360, 1, 1);
  }
  for (let i = 0; i < 18; i += 1) {
    g.fillStyle = i % 2 ? '#5B4652' : '#6A535E';
    g.fillRect(((i * 41) % W) - 20, 560 + (i % 5) * 9, 70, 10);
  }
  g.fillStyle = '#2A1A24';
  g.fillRect(0, PAD_Y, W, H - PAD_Y);
  g.fillRect(20, PAD_Y - 20, 50, 20);
  g.fillStyle = '#5A6488';
  g.fillRect(96, PAD_Y - 4, 48, 4);
  g.fillStyle = '#3D4766';
  g.fillRect(140, PAD_Y - 64, 4, 64);
  g.fillRect(150, PAD_Y - 64, 4, 64);
  for (let y = PAD_Y - 64; y < PAD_Y; y += 8) g.fillRect(140, y, 14, 1);
  g.fillRect(128, PAD_Y - 48, 16, 2);
  return c;
}

/** 외부 발사 컷신: 카운트다운 → 점화(불꽃·연기·흔들림) → 상승(재구름 통과) → 우주에서 본 지구. 언제든 건너뛸 수 있다. */
export class LaunchScene extends Phaser.Scene {
  private init0!: LaunchInit;
  private finished = false;
  private timers: Phaser.Time.TimerEvent[] = [];

  constructor() {
    super('launch');
  }

  init(data: LaunchInit): void {
    this.init0 = data;
    this.finished = false;
    this.timers = [];
  }

  create(): void {
    const d = this.init0;
    ensureCanvas(this, 'launch-sky', paintSky);
    ensureCanvas(this, 'ship-tall', shipCanvas);
    ensureCanvas(this, 'earth', () => paintEarth(128));
    ensureDot(this, 'flame', 0xffb347, 3);
    ensureDot(this, 'smoke', 0x9a9ba6, 8, true);
    this.add.image(0, 0, 'launch-sky').setOrigin(0, 0);
    const ship = this.add.image(120, PAD_Y - 4, 'ship-tall').setOrigin(0.5, 1).setDepth(10);
    if (d.boram) {
      ensureChar(this, 'npc-boram', NPC_LOOKS.boram);
      const b = this.add.sprite(147, PAD_Y - 64, 'npc-boram', FRAME.down[0]).setOrigin(0.5, 1).setScale(0.5).setDepth(11);
      if (!d.reduced) this.tweens.add({ targets: b, angle: { from: -6, to: 6 }, duration: 300, yoyo: true, repeat: -1 });
    }
    const cam = this.cameras.main;
    cam.setZoom(fitZoom(this, W, 180, 1, 4));
    cam.setBounds(0, 0, W, H);
    cam.centerOn(120, PAD_Y - 60);

    const at = (ms: number, f: () => void): void => { this.timers.push(this.time.delayedCall(ms, f)); };
    if (d.reduced) {
      d.onCaption('점화 — 아크-06이 발사대를 떠난다');
      at(1500, () => { cam.centerOn(120, 520); ship.setY(560); d.onCaption('재구름을 뚫고 올라간다'); });
      at(3000, () => this.spaceView('아크-06, 지구 궤도 이탈'));
      at(4800, () => this.finish());
      return;
    }

    const flame = this.add.particles(0, 0, 'flame', {
      speedY: { min: 60, max: 120 }, speedX: { min: -14, max: 14 }, lifespan: { min: 250, max: 520 },
      scale: { start: 1.2, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xffd47b, 0xf48b70, 0xffffff], frequency: 18, quantity: 2, emitting: false,
    }).setDepth(9);
    flame.startFollow(ship, 0, 0);
    const smoke = this.add.particles(120, PAD_Y - 2, 'smoke', {
      speedX: { min: -70, max: 70 }, speedY: { min: -18, max: 4 }, lifespan: 1800,
      scale: { start: 0.6, end: 3 }, alpha: { start: 0.7, end: 0 }, frequency: 40, quantity: 2, emitting: false,
    }).setDepth(8);

    d.onCaption('3');
    at(700, () => d.onCaption('2'));
    at(1400, () => d.onCaption('1'));
    at(2100, () => {
      d.onCaption('점화!');
      flame.start();
      smoke.start();
      cam.shake(1800, d.rough ? 0.012 : 0.006);
    });
    at(3000, () => {
      d.onCaption(null);
      this.tweens.add({ targets: ship, y: 140, duration: 6000, ease: 'Cubic.easeIn' });
      cam.startFollow(ship, false, 0.2, 0.2, 0, 40);
    });
    at(4300, () => smoke.stop());
    at(6200, () => { d.onCaption('재구름을 뚫고'); if (d.rough) cam.shake(900, 0.01); });
    at(8200, () => d.onCaption(null));
    at(9000, () => {
      flame.stop();
      cam.fadeOut(400, 5, 6, 12);
      cam.once('camerafadeoutcomplete', () => { this.spaceView('아크-06, 지구 궤도 이탈'); cam.fadeIn(500, 5, 6, 12); });
    });
    at(12400, () => this.finish());
  }

  private spaceView(caption: string): void {
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.setBounds(0, 0, 4000, 4000);
    const ox = 2000;
    const oy = 2000;
    this.add.rectangle(ox, oy, 600, 600, 0x05060c).setDepth(50);
    for (let i = 0; i < 70; i += 1) this.add.rectangle(ox - 150 + ((i * 47) % 300), oy - 100 + ((i * 31) % 150), 1, 1, i % 4 ? 0x8a93b8 : 0xfff4da).setDepth(51);
    this.add.image(ox, oy + 150, 'earth').setScale(2.6).setDepth(52);
    const ark = this.add.image(ox - 20, oy + 10, 'ship-tall').setScale(0.35).setAngle(40).setDepth(53);
    cam.centerOn(ox, oy + 20);
    if (!this.init0.reduced) this.tweens.add({ targets: ark, x: ox + 60, y: oy - 60, scale: 0.15, duration: 3200, ease: 'Sine.easeIn' });
    this.init0.onCaption(caption);
  }

  /** 건너뛰기 또는 끝 */
  finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.timers.forEach((t) => t.remove(false));
    this.init0.onCaption(null);
    this.init0.onDone();
  }
}
