import Phaser from 'phaser';
import type { Look } from '../art/look';
import { buildNoknokSheet, buildSheet, FRAME, FRAME_COUNT, FRAME_H, FRAME_W } from '../art/sprites';
import { BUNKER_COLLIDERS, BUNKER_H, BUNKER_W, HATCH_LIGHT, paintBunker } from '../art/bunker';

export type Facing = 'down' | 'up' | 'left' | 'right';

export interface Interactable {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
  verb: string;
}

export interface BunkerHooks {
  isBlocked(): boolean;
  onNearest(it: Interactable | null): void;
  onInteract(id: string): void;
  onReady(scene: BunkerScene): void;
}

/** 걸어 다닐 수 있는 지도 한 장. C1 발사장이 기본값이고, C2~C8도 같은 장면 클래스를 쓴다. */
export interface MapDef {
  key: string;
  w: number;
  h: number;
  paint: () => HTMLCanvasElement;
  colliders: readonly (readonly [number, number, number, number])[];
  ambient: 'ash' | 'dust' | 'none';
  beacons?: readonly number[];
  hatch?: { x: number; y: number };
  /** 화성 표면: 모두 헬멧을 쓰고, 낮은 중력으로 걸음이 통통 튄다 */
  suits?: boolean;
  /** 녹녹이 대신 따라다닐 것이 없으면 false */
  zoomBase?: number;
}

export const BUNKER_MAP: MapDef = {
  key: 'bunker-bg', w: BUNKER_W, h: BUNKER_H, paint: paintBunker, colliders: BUNKER_COLLIDERS,
  ambient: 'ash', beacons: [120, 520], hatch: HATCH_LIGHT,
};

export interface BunkerInit {
  hooks: BunkerHooks;
  playerLook: Look;
  reducedMotion: boolean;
  labelsEl: HTMLElement;
  start: { x: number; y: number };
  map?: MapDef;
  /** 지금 할 일의 지점 id(HUD가 정한다). 이 지점이 상호작용 목록에 있으면 지도 위에서 반짝인다 */
  focus?: () => string | null;
}

interface Label {
  x: number;
  y: number;
  el: HTMLElement;
  follow?: string;
}

/** 걷는 속도(플레이 시간 단축을 위해 74 → 100) */
const SPEED = 100;

export class BunkerScene extends Phaser.Scene {
  private hooks!: BunkerHooks;
  private playerLook!: Look;
  private reduced = false;
  private labelsEl!: HTMLElement;
  private startPos = { x: 320, y: 236 };
  private player!: Phaser.Physics.Arcade.Sprite;
  private noknok!: Phaser.GameObjects.Sprite;
  private readonly actors = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly shadows = new Map<Phaser.GameObjects.Sprite, Phaser.GameObjects.Ellipse>();
  private readonly sparks = new Map<string, Phaser.GameObjects.Image>();
  private readonly props = new Map<string, Phaser.GameObjects.GameObject>();
  private noknokPin: { x: number; y: number; angle: number } | null = null;
  private items: Interactable[] = [];
  private nearest: Interactable | null = null;
  private target: { x: number; y: number; id?: string } | null = null;
  private lastDist = Number.POSITIVE_INFINITY;
  private stuck = 0;
  private facing: Facing = 'up';
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private labels: Label[] = [];
  private hatchLight: Phaser.GameObjects.Rectangle | null = null;
  private map: MapDef = BUNKER_MAP;
  private readonly helmets = new Map<Phaser.GameObjects.Sprite, Phaser.GameObjects.Ellipse>();
  private cutscene = false;
  private focusOf: () => string | null = () => null;
  private focusMark: Phaser.GameObjects.Container | null = null;
  private focusKey = '';
  /** 재미 연출 트윈(걷기 시작하면 멈춘다. 숨쉬기 트윈은 건드리지 않는다) */
  private readonly gagTw = new Map<Phaser.GameObjects.Sprite, Phaser.Tweens.Tween[]>();
  private wasBlocked = false;

  constructor() {
    super('bunker');
  }

  init(data: BunkerInit): void {
    this.hooks = data.hooks;
    this.playerLook = data.playerLook;
    this.reduced = data.reducedMotion;
    this.labelsEl = data.labelsEl;
    this.startPos = data.start;
    this.map = data.map ?? BUNKER_MAP;
    this.actors.clear();
    this.shadows.clear();
    this.helmets.clear();
    this.sparks.clear();
    this.labels = [];
    this.items = [];
    this.hatchLight = null;
    // 이 장면 객체는 C1 → C2 → C3 객실 → C4~C8에서 계속 다시 쓰인다(Phaser는 장면을 다시 시작해도 생성자를 다시 부르지 않는다).
    // 이동 상태를 매번 처음으로 돌린다. 예전에는 C1 작별·출발 컷신에서 켠 cutscene이 남아 C2부터 방향키·클릭 이동이 전부 막혔고,
    // 새로고침하면 장면 객체가 새로 만들어져서 풀렸다.
    this.cutscene = false;
    this.target = null;
    this.lastDist = Number.POSITIVE_INFINITY;
    this.stuck = 0;
    this.facing = 'up';
    this.nearest = null;
    this.wasBlocked = false;
    this.focusOf = data.focus ?? (() => null);
    this.focusMark = null;
    this.focusKey = '';
    this.gagTw.clear();
  }

  create(): void {
    const map = this.map;
    if (!this.textures.exists(map.key)) this.textures.addCanvas(map.key, map.paint());
    this.add.image(0, 0, map.key).setOrigin(0, 0).setDepth(-1000);
    this.makeSmallTextures();

    this.ensureChar('player', this.playerLook);
    this.player = this.physics.add.sprite(this.startPos.x, this.startPos.y, 'player', FRAME.up[0]);
    this.player.setOrigin(0.5, 1);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 6);
    body.setOffset(6, 25);
    this.addShadow(this.player);
    if (map.suits) this.addHelmet(this.player);

    const zones = map.colliders.map(([x, y, w, h]) => {
      const z = this.add.zone(x + w / 2, y + h / 2, w, h);
      this.physics.add.existing(z, true);
      return z;
    });
    this.physics.add.collider(this.player, zones);
    this.physics.world.setBounds(0, 0, map.w, map.h);
    body.setCollideWorldBounds(true);

    if (!this.textures.exists('noknok')) {
      const tex = this.textures.addCanvas('noknok', buildNoknokSheet());
      if (tex) { tex.add(0, 0, 0, 0, 16, 16); tex.add(1, 0, 16, 0, 16, 16); }
    }
    this.noknok = this.add.sprite(this.startPos.x + 16, this.startPos.y - 30, 'noknok', 0);

    if (map.hatch) this.hatchLight = this.add.rectangle(map.hatch.x, map.hatch.y, 6, 3, 0xf48b70).setDepth(-500);

    if (!this.reduced && map.ambient === 'dust') {
      this.add.particles(0, 0, 'dust', {
        x: { min: -10, max: 0 }, y: { min: 0, max: map.h }, lifespan: 9000,
        speedX: { min: 30, max: 70 }, speedY: { min: -4, max: 4 }, frequency: 50, alpha: { start: 0.8, end: 0 },
      }).setDepth(9500);
    }
    if (!this.reduced && map.ambient === 'ash') {
      this.add.particles(0, 0, 'ash', {
        x: { min: 24, max: map.w - 24 },
        y: 6,
        lifespan: 3600,
        speedY: { min: 5, max: 9 },
        speedX: { min: -3, max: 3 },
        frequency: 90,
        quantity: 1,
        alpha: { start: 0.9, end: 0.1 },
      }).setDepth(-900);
    }
    if (!this.reduced) {
      for (const bx of map.beacons ?? []) {
        const beacon = this.add.rectangle(bx, 52, 8, 4, 0xf48b70).setDepth(-800);
        this.tweens.add({ targets: beacon, scaleX: 0.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      this.time.addEvent({ delay: 2800, loop: true, callback: () => { this.noknok.setFrame(1); this.time.delayedCall(140, () => this.noknok.setFrame(0)); } });
    } else {
      for (const bx of map.beacons ?? []) this.add.rectangle(bx, 52, 8, 4, 0xf48b70).setDepth(-800);
    }

    const kb = this.input.keyboard;
    this.keys = (kb ? kb.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D' }, false) : {}) as Record<string, Phaser.Input.Keyboard.Key>;

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.hooks.isBlocked() || this.cutscene) return;
      const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const hit = this.items.find((it) => Phaser.Math.Distance.Between(wp.x, wp.y, it.x, it.y - 12) <= 18);
      this.target = hit ? { x: hit.x, y: hit.y, id: hit.id } : { x: wp.x, y: wp.y };
      this.lastDist = Number.POSITIVE_INFINITY;
      this.stuck = 0;
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.w, map.h);
    cam.startFollow(this.player, true, 0.18, 0.18);
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.applyZoom, this);
      this.labels.forEach((l) => l.el.remove());
      this.labels = [];
    });
    cam.fadeIn(this.reduced ? 0 : 600, 23, 29, 52);
    this.hooks.onReady(this);
  }

  private makeSmallTextures(): void {
    if (!this.textures.exists('ash')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xd6d0d4, 1);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture('ash', 1, 1);
      g.destroy();
    }
    if (!this.textures.exists('dust')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xe8b08f, 1);
      g.fillRect(0, 0, 1, 1);
      g.generateTexture('dust', 1, 1);
      g.destroy();
    }
    if (!this.textures.exists('spark')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffd47b, 1);
      g.fillRect(2, 0, 1, 5);
      g.fillRect(0, 2, 5, 1);
      g.fillStyle(0xffffff, 1);
      g.fillRect(2, 2, 1, 1);
      g.generateTexture('spark', 5, 5);
      g.destroy();
    }
  }

  private applyZoom(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const zoom = Math.max(2, Math.min(4, Math.floor(Math.min(w / 300, h / 230))));
    this.cameras.main.setZoom(zoom);
  }

  private ensureChar(key: string, look: Look): void {
    if (!this.textures.exists(key)) {
      const tex = this.textures.addCanvas(key, buildSheet(look));
      if (tex) for (let i = 0; i < FRAME_COUNT; i += 1) tex.add(i, 0, i * FRAME_W, 0, FRAME_W, FRAME_H);
    }
    const mk = (name: string, frames: readonly number[]): void => {
      const k = `${key}-${name}`;
      if (this.anims.exists(k)) return;
      this.anims.create({ key: k, frames: [frames[1], frames[0], frames[2], frames[0]].map((f) => ({ key, frame: f })), frameRate: 7, repeat: -1 });
    };
    mk('down', FRAME.down);
    mk('up', FRAME.up);
    mk('side', FRAME.side);
  }

  private addHelmet(s: Phaser.GameObjects.Sprite): void {
    const e = this.add.ellipse(s.x, s.y - 24, 20, 18, 0xcfeff0, 0.42).setStrokeStyle(1, 0x283044);
    this.helmets.set(s, e);
  }

  private addShadow(s: Phaser.GameObjects.Sprite): void {
    const e = this.add.ellipse(s.x, s.y - 1, 16, 5, 0x0b0e1a, 0.35);
    this.shadows.set(s, e);
  }

  // ---------- 컨트롤러가 쓰는 API ----------

  addActor(id: string, look: Look, x: number, y: number, facing: Facing = 'down', name?: string): void {
    this.ensureChar(`npc-${id}`, look);
    const s = this.add.sprite(x, y, `npc-${id}`, FRAME.down[0]).setOrigin(0.5, 1);
    this.actors.set(id, s);
    this.addShadow(s);
    if (this.map.suits) this.addHelmet(s);
    this.face(id, facing);
    if (!this.reduced) this.tweens.add({ targets: s, scaleY: 0.97, duration: 900 + (x % 7) * 60, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (name) this.addLabel(x, y - 34, name, 'name', id);
  }

  removeActor(id: string): void {
    const s = this.actors.get(id);
    if (!s) return;
    this.shadows.get(s)?.destroy();
    this.shadows.delete(s);
    this.helmets.get(s)?.destroy();
    this.helmets.delete(s);
    s.destroy();
    this.actors.delete(id);
    this.labels = this.labels.filter((l) => {
      if (l.follow === id) { l.el.remove(); return false; }
      return true;
    });
  }

  actorPos(id: string): { x: number; y: number } | null {
    const s = this.actors.get(id);
    return s ? { x: s.x, y: s.y } : null;
  }

  actorIds(): string[] {
    return [...this.actors.keys()];
  }

  hasActor(id: string): boolean {
    return this.actors.has(id);
  }

  face(id: string, facing: Facing): void {
    const s = id === 'player' ? this.player : this.actors.get(id);
    if (!s) return;
    s.anims.stop();
    s.setFlipX(facing === 'right');
    s.setFrame(facing === 'down' ? FRAME.down[0] : facing === 'up' ? FRAME.up[0] : FRAME.side[0]);
  }

  faceTowardPlayer(id: string): void {
    const s = this.actors.get(id);
    if (!s) return;
    const dx = this.player.x - s.x;
    const dy = this.player.y - s.y;
    this.face(id, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
  }

  walkActor(id: string, x: number, y: number, ms = 1200): Promise<void> {
    const s = id === 'player' ? this.player : this.actors.get(id);
    if (!s) return Promise.resolve();
    // 재미 연출(폴짝·빙글)이 아직 돌고 있으면 멈추고 걷는다(두 트윈이 위치를 두고 다투지 않게)
    this.gagTw.get(s)?.forEach((tw) => tw.stop());
    this.gagTw.delete(s);
    s.angle = 0;
    const key = id === 'player' ? 'player' : `npc-${id}`;
    const dx = x - s.x;
    const dy = y - s.y;
    const anim = Math.abs(dx) > Math.abs(dy) ? 'side' : dy < 0 ? 'up' : 'down';
    s.setFlipX(anim === 'side' && dx > 0);
    if (this.reduced) {
      s.setPosition(x, y);
      this.face(id, anim === 'side' ? (dx < 0 ? 'left' : 'right') : anim === 'up' ? 'up' : 'down');
      return Promise.resolve();
    }
    s.anims.play(`${key}-${anim}`, true);
    const body = id === 'player' ? (this.player.body as Phaser.Physics.Arcade.Body) : null;
    if (body) body.enable = false;
    return new Promise((resolve) => {
      this.tweens.add({ targets: s, x, y, duration: ms, onComplete: () => { s.anims.stop(); if (body) { body.enable = true; body.reset(x, y); } resolve(); } });
    });
  }

  setCutscene(on: boolean): void {
    this.cutscene = on;
    if (on) {
      this.target = null;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }
  }

  setInteractables(list: Interactable[]): void {
    this.items = list;
    this.nearest = null;
    this.hooks.onNearest(null);
    this.refreshFocus();
  }

  /** 지금 할 일의 지점을 지도 위에서 반짝여 알려 준다: 통통 튀는 ▼, 퍼지는 고리, 깜박이는 ✦ (움직임 줄이기면 고정) */
  refreshFocus(): void {
    const id = this.focusOf();
    const it = id ? this.items.find((i) => i.id === id) : undefined;
    const key = it ? `${it.id}@${it.x},${it.y}` : '';
    if (key === this.focusKey) return;
    this.focusKey = key;
    this.focusMark?.destroy();
    this.focusMark = null;
    if (!it) return;
    const ring = this.add.ellipse(0, 0, 36, 14).setStrokeStyle(2, 0xffd966, 1);
    const arrow = this.add.text(0, -52, '▼', { fontFamily: 'sans-serif', fontSize: '16px', color: '#FFD966', stroke: '#283044', strokeThickness: 4 }).setOrigin(0.5, 1);
    const spark = this.add.text(11, -62, '✦', { fontFamily: 'sans-serif', fontSize: '11px', color: '#FFF4DA', stroke: '#283044', strokeThickness: 3 }).setOrigin(0.5);
    this.focusMark = this.add.container(it.x, it.y, [ring, arrow, spark]).setDepth(9400);
    if (this.reduced) return;
    this.tweens.add({ targets: arrow, y: -44, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: ring, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 1000, repeat: -1, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: spark, alpha: 0.2, angle: 35, duration: 560, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  setSpark(id: string, x: number, y: number, on: boolean): void {
    const cur = this.sparks.get(id);
    if (!on) { cur?.destroy(); this.sparks.delete(id); return; }
    if (cur) return;
    const sp = this.add.image(x, y, 'spark').setDepth(9000);
    if (!this.reduced) this.tweens.add({ targets: sp, alpha: 0.2, y: y - 2, duration: 600, yoyo: true, repeat: -1 });
    this.sparks.set(id, sp);
  }

  setHatch(open: boolean): void {
    this.hatchLight?.setFillStyle(open ? 0x96d9bc : 0xf48b70);
  }

  /** 카메라 흔들림(움직임 줄이기면 생략) */
  shake(ms = 300, strength = 0.004): void {
    if (!this.reduced) this.cameras.main.shake(ms, strength);
  }

  /** 지도 위 작은 소품(스프라이트 키가 없으면 색 사각형) */
  addProp(id: string, x: number, y: number, w: number, h: number, color: number): void {
    this.removeProp(id);
    const r = this.add.rectangle(x, y, w, h, color).setStrokeStyle(1, 0x283044).setDepth(y);
    this.props.set(id, r);
  }

  removeProp(id: string): void {
    this.props.get(id)?.destroy();
    this.props.delete(id);
  }

  /** 캔버스 그림(물품 아이콘 등)을 지도 위 소품으로 놓는다 */
  addImageProp(id: string, x: number, y: number, key: string, make: () => HTMLCanvasElement, pop = true): void {
    this.removeProp(id);
    if (!this.textures.exists(key)) this.textures.addCanvas(key, make());
    const img = this.add.image(x, y, key).setDepth(y + 1);
    if (pop && !this.reduced) { img.setScale(0.2); this.tweens.add({ targets: img, scale: 1, duration: 260, ease: 'Back.easeOut' }); }
    this.props.set(id, img);
  }

  /** 녹녹이를 특정 위치에 붙잡아 둔다(개그 연출). null이면 다시 플레이어를 따라다닌다 */
  pinNoknok(pos: { x: number; y: number; angle?: number } | null): void {
    this.noknokPin = pos ? { x: pos.x, y: pos.y, angle: pos.angle ?? 0 } : null;
    if (!pos) this.noknok.setAngle(0);
  }

  addLabel(x: number, y: number, text: string, cls = 'spot', follow?: string): void {
    const el = document.createElement('div');
    el.className = `wlabel ${cls}`;
    el.textContent = text;
    this.labelsEl.appendChild(el);
    this.labels.push({ x, y, el, follow });
  }

  playerPos(): { x: number; y: number } {
    return { x: this.player.x, y: this.player.y };
  }

  // ---------- 재미 연출(이야기 연출 전용) ----------

  posOf(id: string): { x: number; y: number } | null {
    const s = id === 'player' ? this.player : this.actors.get(id);
    return s ? { x: s.x, y: s.y } : null;
  }

  private emoteText(x: number, y: number, text: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { fontFamily: 'sans-serif', fontSize: '16px', color: '#FFFFFF', stroke: '#283044', strokeThickness: 4 }).setDepth(9450);
  }

  /** 머리 위에 기호를 잠깐 띄운다 */
  emote(id: string, text: string, ms = 1300): void {
    const s = id === 'player' ? this.player : this.actors.get(id);
    if (!s) return;
    const t = this.emoteText(s.x, s.y - 42, text).setOrigin(0.5, 1);
    if (this.reduced) { this.time.delayedCall(ms, () => t.destroy()); return; }
    t.setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: ms * 0.45, duration: ms * 0.55, ease: 'Sine.easeIn', onComplete: () => t.destroy() });
  }

  /** 폴짝 뛰기(인물만, 움직임 줄이기면 생략) */
  hop(id: string, times = 2): Promise<void> {
    const s = this.actors.get(id);
    if (!s || this.reduced) return Promise.resolve();
    return new Promise((resolve) => {
      this.trackGag(s, this.tweens.add({ targets: s, y: s.y - 10, duration: 130, yoyo: true, repeat: Math.max(0, times - 1), ease: 'Quad.easeOut', onComplete: () => resolve() }));
    });
  }

  /** 제자리에서 빙글(인물만, 움직임 줄이기면 생략) */
  spin(id: string, turns = 1): Promise<void> {
    const s = this.actors.get(id);
    if (!s || this.reduced) return Promise.resolve();
    return new Promise((resolve) => {
      this.trackGag(s, this.tweens.add({ targets: s, angle: 360 * turns, duration: 450 * turns, ease: 'Sine.easeInOut', onComplete: () => { s.angle = 0; resolve(); } }));
    });
  }

  private trackGag(s: Phaser.GameObjects.Sprite, tw: Phaser.Tweens.Tween): void {
    this.gagTw.set(s, [...(this.gagTw.get(s) ?? []), tw]);
  }

  /** 인물이 걸어 나가며 사라진다(희생 연출). 움직임 줄이기면 바로 사라진다 */
  exitActor(id: string, to?: { x: number; y: number }): Promise<void> {
    const s = this.actors.get(id);
    if (!s) return Promise.resolve();
    if (this.reduced) { this.removeActor(id); return Promise.resolve(); }
    const go = to ? this.walkActor(id, to.x, to.y, 900) : Promise.resolve();
    return go.then(() => new Promise<void>((resolve) => {
      this.tweens.add({ targets: s, alpha: 0, duration: 700, onComplete: () => { this.removeActor(id); resolve(); } });
    }));
  }

  /** 기호를 사방으로 흩뿌린다(티백 비, 음표, 색종이) */
  burst(x: number, y: number, chars: string[], n = 10): void {
    if (this.reduced) {
      const t = this.emoteText(x, y - 46, chars.join(' ')).setOrigin(0.5, 1);
      this.time.delayedCall(1100, () => t.destroy());
      return;
    }
    for (let i = 0; i < n; i += 1) {
      const t = this.emoteText(x, y - 24, chars[i % chars.length]).setOrigin(0.5);
      const a = (Math.PI * 2 * i) / n;
      const d = 34 + (i % 3) * 14;
      this.tweens.add({ targets: t, x: x + Math.cos(a) * d, y: y - 30 + Math.sin(a) * d * 0.6, alpha: 0, angle: (i % 2 ? 1 : -1) * 40, duration: 900 + (i % 4) * 140, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
    }
  }

  /** 테스트용: 플레이어나 인물의 화면 좌표(캔버스 기준, 몸통 가운데) */
  screenPos(id: string): { x: number; y: number } | null {
    const s = id === 'player' ? this.player : this.actors.get(id);
    if (!s) return null;
    const cam = this.cameras.main;
    return { x: (s.x - cam.worldView.x) * cam.zoom, y: (s.y - 12 - cam.worldView.y) * cam.zoom };
  }

  fadeOut(ms = 700): Promise<void> {
    return new Promise((resolve) => {
      if (this.reduced) { resolve(); return; }
      this.cameras.main.fadeOut(ms, 23, 29, 52);
      this.cameras.main.once('camerafadeoutcomplete', () => resolve());
    });
  }

  // ---------- 매 프레임 ----------

  update(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const blocked = this.hooks.isBlocked() || this.cutscene;
    let vx = 0;
    let vy = 0;
    if (!blocked) {
      const k = this.keys;
      if (k.left?.isDown || k.a?.isDown) vx -= 1;
      if (k.right?.isDown || k.d?.isDown) vx += 1;
      if (k.up?.isDown || k.w?.isDown) vy -= 1;
      if (k.down?.isDown || k.s?.isDown) vy += 1;
      if (vx !== 0 || vy !== 0) this.target = null;
      else if (this.target) {
        const t = this.target;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, t.x, t.y);
        const item = t.id ? this.items.find((i) => i.id === t.id) : undefined;
        if (item && Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) <= item.r) {
          this.target = null;
          this.hooks.onInteract(item.id);
        } else if (dist < 3) {
          this.target = null;
        } else {
          vx = (t.x - this.player.x) / dist;
          vy = (t.y - this.player.y) / dist;
          if (dist > this.lastDist - 0.15) this.stuck += 1;
          else this.stuck = 0;
          this.lastDist = dist;
          if (this.stuck > 24) {
            this.target = null;
            if (item && Phaser.Math.Distance.Between(this.player.x, this.player.y, item.x, item.y) <= item.r + 26) this.hooks.onInteract(item.id);
          }
        }
      }
    } else {
      this.target = null;
    }
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      body.setVelocity((vx / len) * SPEED, (vy / len) * SPEED);
      this.facing = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
      const anim = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
      this.player.setFlipX(this.facing === 'right');
      if (this.reduced) this.player.setFrame(FRAME[anim][0]);
      else this.player.anims.play(`player-${anim}`, true);
    } else {
      body.setVelocity(0, 0);
      if (this.player.anims.isPlaying && !this.cutscene) {
        this.player.anims.stop();
        const anim = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
        this.player.setFrame(FRAME[anim][0]);
      }
    }

    this.player.setDepth(this.player.y);
    for (const s of this.actors.values()) s.setDepth(s.y);
    for (const [s, e] of this.shadows) e.setPosition(s.x, s.y - 1).setDepth(s.y - 40);
    for (const [s, e] of this.helmets) e.setPosition(s.x, s.y - 24 + (s.originY - 1) * -32).setDepth(s.y + 2);
    if (this.map.suits && !this.reduced) {
      const moving = len > 0;
      this.player.setOrigin(0.5, moving ? 1 + Math.abs(Math.sin(this.time.now / 140)) * 0.12 : 1);
    }
    const kx = this.player.x + (this.facing === 'left' ? 16 : -16);
    const bob = this.reduced ? 0 : Math.sin(this.time.now / 380) * 2;
    const pin = this.noknokPin;
    const tx = pin ? pin.x : kx;
    const ty = pin ? pin.y : this.player.y - 30 + bob;
    this.noknok.x += (tx - this.noknok.x) * (pin && this.reduced ? 1 : 0.08);
    this.noknok.y += (ty - this.noknok.y) * (pin && this.reduced ? 1 : 0.08);
    if (pin) this.noknok.setAngle(this.noknok.angle + (pin.angle - this.noknok.angle) * 0.1);
    this.noknok.setDepth(pin ? pin.y + 40 : this.player.y + 1);

    let best: Interactable | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const it of this.items) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (d <= it.r && d < bestD) { best = it; bestD = d; }
    }
    if (best?.id !== this.nearest?.id || blocked !== this.wasBlocked) {
      this.nearest = best;
      this.wasBlocked = blocked;
      this.hooks.onNearest(blocked ? null : best);
    }

    const cam = this.cameras.main;
    for (const l of this.labels) {
      let x = l.x;
      let y = l.y;
      if (l.follow) {
        const s = this.actors.get(l.follow);
        if (s) { x = s.x; y = s.y - 34; }
      }
      const sx = (x - cam.worldView.x) * cam.zoom;
      const sy = (y - cam.worldView.y) * cam.zoom;
      l.el.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
    }
  }
}
