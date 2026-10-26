import type { App } from './app';
import type { BunkerHooks, BunkerScene, Facing, Interactable, MapDef } from '../world/BunkerScene';
import type { Look } from '../art/look';

export interface ActorDef { id: string; look: Look; x: number; y: number; facing?: Facing; name?: string }
export interface Spot extends Interactable {
  /** false면 지금은 상호작용할 수 없다 */
  when?: () => boolean;
  /** 지도 위에 이름표를 띄울지 */
  tag?: boolean;
}

export interface ExploreOpts {
  map: MapDef;
  start: { x: number; y: number };
  actors: () => ActorDef[];
  spots: () => Spot[];
  onInteract: (id: string) => Promise<void>;
  onReady?: (scene: BunkerScene) => void;
  alarm?: boolean;
}

/**
 * C2~C8 공용 탐색 컨트롤러: 걸어 다니며 동료와 이야기하고 물건을 살핀다(C1과 같은 조작).
 * 탐색 대화는 서사이며 측정하지 않는다. 측정은 각 장의 정해진 포크·패널에서만 한다.
 */
export class Explore {
  scene: BunkerScene | null = null;
  private busy = false;
  private readonly app: App;
  private readonly o: ExploreOpts;

  constructor(app: App, o: ExploreOpts) {
    this.app = app;
    this.o = o;
  }

  start(): void {
    const hooks: BunkerHooks = {
      isBlocked: () => this.app.isBlocked() || this.busy,
      onNearest: (it) => this.app.hud.setPrompt(it, it ? () => void this.interact(it.id) : null),
      onInteract: (id) => void this.interact(id),
      onReady: (s) => {
        this.scene = s;
        this.populate();
        this.o.onReady?.(s);
      },
    };
    this.app.startBunker(hooks, this.o.start, this.o.map, this.o.alarm ?? false);
    this.app.debug.interact = (id) => void this.interact(id);
    this.app.debug.ready = () => this.scene !== null && !this.app.isBlocked() && !this.busy;
    this.app.debug.actors = () => this.scene?.actorIds() ?? [];
    this.app.debug.spots = () => this.o.spots().filter((sp) => (sp.when ? sp.when() : true)).map((sp) => sp.id);
  }

  stop(): void {
    this.app.debug.interact = undefined;
    this.app.debug.ready = undefined;
    this.app.debug.actors = undefined;
    this.app.debug.spots = undefined;
    this.app.hud.setPrompt(null, null);
  }

  private populate(): void {
    const s = this.scene;
    if (!s) return;
    for (const a of this.o.actors()) s.addActor(a.id, a.look, a.x, a.y, a.facing ?? 'down', a.name);
    for (const sp of this.o.spots()) if (sp.tag) s.addLabel(sp.x, sp.y - 26, sp.label, 'spot');
    this.refresh();
  }

  /** 상호작용 목록을 다시 계산한다(조건이 바뀌었을 때) */
  refresh(): void {
    this.scene?.setInteractables(this.o.spots().filter((sp) => (sp.when ? sp.when() : true)));
  }

  /** 흐름이 직접 진행하는 동안(컷신·연속 대사) 탐색을 막는다 */
  async run(f: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.app.hud.setPrompt(null, null);
    try {
      await f();
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  async interact(id: string): Promise<void> {
    if (this.busy || this.app.isBlocked()) return;
    const sp = this.o.spots().find((x) => x.id === id);
    if (!sp || (sp.when && !sp.when())) return;
    if (this.scene?.hasActor(id)) this.scene.faceTowardPlayer(id);
    await this.run(() => this.o.onInteract(id));
  }
}
