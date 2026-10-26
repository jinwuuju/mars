import Phaser from 'phaser';
import type { Look } from '../art/look';
import { NPC_LOOKS } from '../art/look';
import { FRAME, makeCanvas } from '../art/sprites';
import { CANDIDATES } from '../story/candidates';
import type { CandidateId } from '../shared/ids';
import { ensureCanvas, ensureChar, ensureDot, ensureNoknok, fitZoom } from './chars';

export type StageKind = 'ship' | 'mars' | 'dome';

export interface StageInit {
  kind: StageKind;
  crew: CandidateId[];
  playerLook: Look;
  reduced: boolean;
  props: Record<string, boolean>;
  onReady(scene: StageScene): void;
}

const W = 320;
const H = 200;

function paint(kind: StageKind): HTMLCanvasElement {
  const { c, g } = makeCanvas(W, H);
  const R = (x: number, y: number, w: number, h: number, col: string): void => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (kind === 'ship') {
    R(0, 0, W, H, '#EDE4CE');
    R(0, 120, W, 80, '#404A6E');
    for (let x = 0; x < W; x += 16) R(x, 120, 1, 80, '#3B4466');
    R(0, 116, W, 4, '#283044');
    R(0, 4, W, 3, '#96D9BC');
    for (const cx of [70, 250]) {
      g.fillStyle = '#283044'; g.beginPath(); g.arc(cx, 52, 30, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#05060C'; g.beginPath(); g.arc(cx, 52, 25, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#FFF4DA';
      for (let i = 0; i < 18; i += 1) g.fillRect(cx - 20 + ((i * 13) % 40), 34 + ((i * 7) % 36), 1, 1);
    }
    R(130, 60, 60, 50, '#5A6488');
    R(134, 64, 52, 42, '#3D4766');
    for (let i = 0; i < 3; i += 1) { R(140 + i * 16, 92, 10, 10, '#8C5A3A'); R(143 + i * 16, 84, 4, 8, '#6FBF5A'); }
  } else if (kind === 'mars') {
    const bands = ['#E8B08F', '#E2A383', '#D99573', '#CD8A68'];
    bands.forEach((col, i) => R(0, i * 18, W, 18, col));
    R(0, 72, W, 128, '#C27A57');
    for (let i = 0; i < 40; i += 1) R((i * 37) % W, 80 + ((i * 23) % 110), 6 + (i % 4) * 3, 3 + (i % 3), i % 2 ? '#9E6680' : '#A8664A');
    g.fillStyle = '#9E6680';
    g.beginPath(); g.moveTo(0, 72); g.lineTo(60, 48); g.lineTo(120, 72); g.fill();
    g.beginPath(); g.moveTo(180, 72); g.lineTo(250, 40); g.lineTo(320, 72); g.fill();
    g.fillStyle = '#FFF4DA'; g.beginPath(); g.arc(280, 64, 16, Math.PI, 0); g.fill();
    R(264, 64, 32, 8, '#E9F3EF');
  } else {
    R(0, 0, W, H, '#FFF1D6');
    g.fillStyle = '#F6E2BC'; g.beginPath(); g.arc(160, 130, 190, Math.PI, 0); g.fill();
    for (let a = 0; a < 7; a += 1) { const x = 20 + a * 46; R(x, 10, 2, 110, '#E3C99A'); }
    R(0, 120, W, 80, '#CFE6D8');
    for (let x = 0; x < W; x += 20) R(x, 120, 1, 80, '#B8D5C4');
    R(0, 116, W, 4, '#96D9BC');
    R(20, 70, 50, 46, '#E6D3AE'); R(24, 74, 42, 30, '#6FBF5A');
    for (let i = 0; i < 5; i += 1) R(28 + i * 8, 82 - (i % 2) * 4, 3, 14, '#3E7A34');
    R(250, 72, 50, 44, '#DDE7F0'); R(254, 76, 42, 20, '#9FD8E8');
    R(110, 30, 100, 40, '#FFF8E8'); R(114, 34, 92, 32, '#FFE9A8');
  }
  return c;
}

export class StageScene extends Phaser.Scene {
  private init0!: StageInit;
  private actors: Phaser.GameObjects.Sprite[] = [];
  private helmets: Phaser.GameObjects.Ellipse[] = [];
  private alarm!: Phaser.GameObjects.Rectangle;
  private alarmTween: Phaser.Tweens.Tween | null = null;
  private propObjs = new Map<string, Phaser.GameObjects.GameObject[]>();

  constructor() {
    super('stage');
  }

  init(data: StageInit): void {
    this.init0 = data;
    this.actors = [];
    this.helmets = [];
    this.alarmTween = null;
    this.propObjs = new Map();
  }

  create(): void {
    const d = this.init0;
    ensureCanvas(this, `stage-${d.kind}`, () => paint(d.kind));
    this.add.image(0, 0, `stage-${d.kind}`).setOrigin(0, 0).setDepth(-100);
    ensureDot(this, 'dust', 0xe8b08f, 1);
    if (d.kind === 'mars' && !d.reduced) {
      this.add.particles(0, 0, 'dust', { x: { min: -20, max: 0 }, y: { min: 70, max: 190 }, speedX: { min: 30, max: 70 }, speedY: { min: -5, max: 5 }, lifespan: 6000, frequency: 60, alpha: { start: 0.8, end: 0 } }).setDepth(500);
    }
    const people: { key: string; look: Look }[] = [
      { key: 'player', look: d.playerLook },
      { key: 'npc-dam', look: NPC_LOOKS.dam },
      ...d.crew.map((id) => ({ key: `npc-${id}`, look: CANDIDATES[id].look })),
    ];
    people.forEach((p, i) => {
      ensureChar(this, p.key, p.look);
      const x = 70 + i * 36;
      this.add.ellipse(x, 171, 16, 5, 0x0b0e1a, 0.3).setDepth(1);
      const s = this.add.sprite(x, 172, p.key, FRAME.down[0]).setOrigin(0.5, 1).setDepth(2);
      this.actors.push(s);
      if (!d.reduced) this.tweens.add({ targets: s, scaleY: 0.97, duration: 900 + i * 80, yoyo: true, repeat: -1 });
      if (d.kind === 'mars') {
        const hm = this.add.ellipse(x, 160, 22, 20, 0xcfeff0, 0.45).setStrokeStyle(1, 0x283044).setDepth(3);
        this.helmets.push(hm);
      }
    });
    ensureNoknok(this);
    const n = this.add.sprite(52, 120, 'noknok', 0).setDepth(4);
    if (!d.reduced) this.tweens.add({ targets: n, y: 115, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (d.kind === 'dome') {
      this.add.rectangle(160, 50, 40, 30, 0xdde7f0).setStrokeStyle(2, 0x283044).setDepth(-50);
      const face = this.add.rectangle(160, 50, 22, 18, 0x9fd8e8).setDepth(-49);
      if (!d.reduced) this.tweens.add({ targets: face, alpha: 0.7, duration: 1400, yoyo: true, repeat: -1 });
    }
    Object.entries(d.props).forEach(([k, on]) => this.setProp(k, on));
    this.alarm = this.add.rectangle(0, 0, W, H, 0xf48b70, 1).setOrigin(0, 0).setDepth(1000).setAlpha(0);
    const cam = this.cameras.main;
    const fit = (): void => { cam.setZoom(fitZoom(this, W, H)); cam.centerOn(W / 2, H / 2); };
    fit();
    this.scale.on('resize', fit);
    this.events.once('shutdown', () => this.scale.off('resize', fit));
    cam.fadeIn(d.reduced ? 0 : 500, 23, 29, 52);
    d.onReady(this);
  }

  /** 작은 소품: sprout(새싹) · photo(사진) · ilkkun(일꾼-3) · games(보드게임) · rover(로버) */
  setProp(key: string, on: boolean): void {
    this.propObjs.get(key)?.forEach((o) => o.destroy());
    this.propObjs.delete(key);
    if (!on) return;
    const objs: Phaser.GameObjects.GameObject[] = [];
    if (key === 'sprout') { objs.push(this.add.rectangle(200, 110, 10, 8, 0x8c5a3a).setDepth(5), this.add.rectangle(200, 102, 2, 8, 0x3e7a34).setDepth(5), this.add.rectangle(197, 99, 4, 3, 0x6fbf5a).setDepth(5), this.add.rectangle(203, 99, 4, 3, 0x6fbf5a).setDepth(5)); }
    if (key === 'photo') objs.push(this.add.rectangle(230, 90, 14, 10, 0x9fd8e8).setStrokeStyle(2, 0x8c5a3a).setDepth(5));
    if (key === 'games') objs.push(this.add.rectangle(140, 150, 16, 10, 0xf48b70).setStrokeStyle(1, 0x283044).setDepth(5));
    if (key === 'ilkkun') {
      const body = this.add.rectangle(270, 166, 16, 8, 0xc9a43a).setStrokeStyle(1, 0x283044).setDepth(5);
      const led = this.add.rectangle(276, 164, 2, 2, 0xf48b70).setDepth(6);
      objs.push(body, led);
      for (let i = 0; i < 3; i += 1) objs.push(this.add.rectangle(264 + i * 6, 172, 1, 4, 0x283044).setDepth(5));
      if (!this.init0.reduced) this.tweens.add({ targets: led, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
    }
    if (key === 'rover') {
      objs.push(this.add.rectangle(250, 150, 26, 10, 0xe9f3ef).setStrokeStyle(1, 0x283044).setDepth(5));
      for (const dx of [-9, 9]) objs.push(this.add.circle(250 + dx, 157, 4, 0x283044).setDepth(5));
    }
    this.propObjs.set(key, objs);
  }

  setAlarm(on: boolean): void {
    this.alarmTween?.stop();
    this.alarmTween = null;
    if (!on) { this.alarm.setAlpha(0); return; }
    if (this.init0.reduced) { this.alarm.setAlpha(0.08); return; }
    this.alarmTween = this.tweens.add({ targets: this.alarm, alpha: { from: 0, to: 0.15 }, duration: 650, yoyo: true, repeat: -1 });
  }

  shake(ms = 300, s = 0.004): void {
    if (!this.init0.reduced) this.cameras.main.shake(ms, s);
  }

  /** 모두가 오른쪽으로 걸어간다(EVA 도보, 장면 이동 연출) */
  walk(dx = 40, ms = 1400): Promise<void> {
    if (this.init0.reduced) {
      this.actors.forEach((a, i) => { a.x = Math.min(W - 20, a.x + dx); if (this.helmets[i]) this.helmets[i].x = a.x; });
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.actors.forEach((a, i) => {
        a.setFlipX(true);
        a.anims.play(`${a.texture.key}-side`, true);
        const tx = Math.min(W - 20, a.x + dx);
        this.tweens.add({ targets: a, x: tx, duration: ms, onComplete: () => { a.anims.stop(); a.setFrame(FRAME.down[0]); } });
        if (this.helmets[i]) this.tweens.add({ targets: this.helmets[i], x: tx, duration: ms });
      });
      this.time.delayedCall(ms + 20, () => resolve());
    });
  }
}
