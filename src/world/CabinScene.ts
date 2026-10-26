import Phaser from 'phaser';
import type { Look } from '../art/look';
import { NPC_LOOKS } from '../art/look';
import { FRAME, makeCanvas } from '../art/sprites';
import { seatCanvas } from '../art/items';
import { paintEarth } from '../art/space';
import { CANDIDATES } from '../story/candidates';
import type { CandidateId } from '../shared/ids';
import { ensureCanvas, ensureChar, ensureDot, ensureNoknok, fitZoom } from './chars';

export type CabinView = 'ground' | 'space';

export interface CabinInit {
  crew: CandidateId[];
  playerLook: Look;
  reduced: boolean;
  view: CabinView;
  onReady(scene: CabinScene): void;
}

const W = 320;
const H = 210;
const VIEW = { x: 70, y: 14, w: 180, h: 60 };

/** 객실 벽: 앞쪽 큰 관측창 자리는 투명으로 비워 바깥 레이어가 보이게 한다. 창가·통로 구분이 없는 2열 좌석 구조. */
function paintCabin(): HTMLCanvasElement {
  const { c, g } = makeCanvas(W, H);
  const R = (x: number, y: number, w: number, h: number, col: string): void => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  R(0, 0, W, H, '#EDE4CE');
  for (let x = 0; x < W; x += 32) { R(x, 0, 1, 96, '#D8CDB2'); R(x + 1, 0, 1, 96, '#F7F0DF'); }
  R(0, 92, W, 4, '#283044');
  R(0, 96, W, 2, '#96D9BC');
  for (let y = 98; y < H; y += 14) for (let x = 0; x < W; x += 14) R(x, y, 14, 14, (x + y) % 28 ? '#3B4466' : '#404A6E');
  R(VIEW.x - 6, VIEW.y - 6, VIEW.w + 12, VIEW.h + 12, '#283044');
  R(VIEW.x - 3, VIEW.y - 3, VIEW.w + 6, VIEW.h + 6, '#5A6488');
  g.clearRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
  for (let x = VIEW.x + 45; x < VIEW.x + VIEW.w; x += 45) R(x - 1, VIEW.y, 2, VIEW.h, '#5A6488');
  R(20, 30, 36, 50, '#283044');
  R(24, 34, 28, 42, '#1D2B44');
  R(264, 30, 36, 50, '#283044');
  R(268, 34, 28, 42, '#1D2B44');
  R(0, 188, W, 22, '#283044');
  R(40, 192, 240, 12, '#1D2B44');
  return c;
}

function paintGroundView(): HTMLCanvasElement {
  const { c, g } = makeCanvas(VIEW.w, VIEW.h);
  const bands = ['#2E1424', '#4A1B2A', '#6E2630', '#933A33', '#B5583C'];
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 12, VIEW.w, 12); });
  g.fillStyle = '#2A1A24';
  g.fillRect(0, 50, VIEW.w, 10);
  g.fillRect(120, 14, 4, 40);
  for (let y = 16; y < 50; y += 6) g.fillRect(116, y, 12, 1);
  return c;
}

function paintSpaceView(): HTMLCanvasElement {
  const { c, g } = makeCanvas(VIEW.w, VIEW.h);
  g.fillStyle = '#05060C';
  g.fillRect(0, 0, VIEW.w, VIEW.h);
  for (let i = 0; i < 90; i += 1) {
    g.fillStyle = i % 6 === 0 ? '#FFF4DA' : i % 3 === 0 ? '#96D9BC' : '#8A93B8';
    g.fillRect((i * 37) % VIEW.w, (i * 17) % (VIEW.h - 18), 1, 1);
  }
  const earth = paintEarth(128);
  g.drawImage(earth, 0, 0, 128, 128, VIEW.w / 2 - 128, 36, 256, 256);
  return c;
}

export class CabinScene extends Phaser.Scene {
  private init0!: CabinInit;
  private outside!: Phaser.GameObjects.Image;
  private ash: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private alarm!: Phaser.GameObjects.Rectangle;
  private alarmTween: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('cabin');
  }

  init(data: CabinInit): void {
    this.init0 = data;
    this.ash = null;
    this.alarmTween = null;
  }

  create(): void {
    const d = this.init0;
    ensureCanvas(this, 'out-ground', paintGroundView);
    ensureCanvas(this, 'out-space', paintSpaceView);
    ensureCanvas(this, 'cabin-wall', paintCabin);
    ensureCanvas(this, 'seat', seatCanvas);
    ensureDot(this, 'ash', 0xd6d0d4, 1);
    this.outside = this.add.image(VIEW.x, VIEW.y, d.view === 'ground' ? 'out-ground' : 'out-space').setOrigin(0, 0).setDepth(-200);
    this.add.image(0, 0, 'cabin-wall').setOrigin(0, 0).setDepth(-100);
    this.setView(d.view);

    const seats: { key: string; look: Look; x: number; y: number }[] = [
      { key: 'player', look: d.playerLook, x: 112, y: 132 },
      { key: 'npc-dam', look: NPC_LOOKS.dam, x: 160, y: 132 },
      ...d.crew.map((id, i) => ({ key: `npc-${id}`, look: CANDIDATES[id].look, x: [208, 112, 160, 208][i], y: i === 0 ? 132 : 174 })),
    ];
    for (const s of seats) {
      ensureChar(this, s.key, s.look);
      const spr = this.add.sprite(s.x, s.y - 2, s.key, FRAME.up[0]).setOrigin(0.5, 1).setDepth(s.y);
      if (!d.reduced) this.tweens.add({ targets: spr, y: s.y - 3, duration: 1100 + (s.x % 5) * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.image(s.x, s.y + 6, 'seat').setOrigin(0.5, 1).setDepth(s.y + 1);
    }
    ensureNoknok(this);
    const n = this.add.sprite(80, 118, 'noknok', 0).setDepth(300);
    if (!d.reduced) this.tweens.add({ targets: n, y: 113, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    for (let i = 0; i < 8; i += 1) {
      const l = this.add.rectangle(56 + i * 30, 198, 6, 4, i % 3 === 0 ? 0xffd47b : 0x96d9bc).setDepth(400);
      if (!d.reduced) this.tweens.add({ targets: l, alpha: 0.3, duration: 500 + i * 110, yoyo: true, repeat: -1 });
    }
    this.alarm = this.add.rectangle(0, 0, W, H, 0xf48b70, 1).setOrigin(0, 0).setDepth(1000).setAlpha(0);

    const cam = this.cameras.main;
    const fit = (): void => { cam.setZoom(fitZoom(this, W, H)); cam.centerOn(W / 2, H / 2); };
    fit();
    this.scale.on('resize', fit);
    this.events.once('shutdown', () => this.scale.off('resize', fit));
    cam.fadeIn(d.reduced ? 0 : 600, 5, 6, 12);
    d.onReady(this);
  }

  setView(view: CabinView): void {
    this.outside.setTexture(view === 'ground' ? 'out-ground' : 'out-space');
    if (view === 'ground' && !this.ash && !this.init0.reduced) {
      this.ash = this.add.particles(0, 0, 'ash', {
        x: { min: VIEW.x, max: VIEW.x + VIEW.w }, y: VIEW.y, lifespan: 3200,
        speedY: { min: 5, max: 9 }, speedX: { min: -2, max: 2 }, frequency: 110, alpha: { start: 0.9, end: 0.1 },
      }).setDepth(-150);
    }
    if (view === 'space' && this.ash) { this.ash.destroy(); this.ash = null; }
  }

  setAlarm(on: boolean): void {
    this.alarmTween?.stop();
    this.alarmTween = null;
    if (!on) { this.alarm.setAlpha(0); return; }
    if (this.init0.reduced) { this.alarm.setAlpha(0.08); return; }
    this.alarm.setAlpha(0);
    this.alarmTween = this.tweens.add({ targets: this.alarm, alpha: 0.16, duration: 650, yoyo: true, repeat: -1 });
  }

  shake(ms: number, strength: number): void {
    if (!this.init0.reduced) this.cameras.main.shake(ms, strength);
  }
}
