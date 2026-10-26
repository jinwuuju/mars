import type { App } from './app';
import type { StageKind, StageScene } from '../world/StageScene';
import type { Objective } from '../ui/hud';
import { CHAPTER_TITLE, type ChapterId } from '../shared/ids';

/** C4~C8 공통 뼈대: 무대 장면 시작, HUD, 플래그 */
export abstract class ChapterFlow {
  protected readonly app: App;
  protected scene: StageScene | null = null;
  private unsub: (() => void) | null = null;

  constructor(app: App) {
    this.app = app;
  }

  protected get m() {
    return this.app.mission.state;
  }

  protected flag(key: string, value: string | number | boolean = true): void {
    this.app.mission.dispatch({ type: 'flag', key, value });
  }

  protected has(key: string): boolean {
    return this.m.flags[key] === true;
  }

  protected stage(kind: StageKind, props: Record<string, boolean>, then: () => Promise<void>): void {
    this.app.startScene('stage', {
      kind, crew: this.m.crewIds, playerLook: this.app.playerLook(), reduced: this.app.reduced, props,
      onReady: (s: StageScene) => { this.scene = s; void then(); },
    });
    this.app.hud.show(true);
  }

  start(): void {
    this.unsub = this.app.mission.subscribe(() => this.hud());
    this.hud();
    this.begin();
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
  }

  protected top(ch: ChapterId, title: string, items: Objective[]): void {
    if (this.m.chapter !== ch) return;
    this.app.hud.setTop(`${ch} · ${CHAPTER_TITLE[ch]}`, null);
    this.app.hud.setResources(this.m.resources);
    this.app.hud.setObjectives(title, items);
  }

  protected abstract begin(): void;
  protected abstract hud(): void;
}
