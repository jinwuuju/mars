import Phaser from 'phaser';
import { Store } from '../core/store';
import { createMission, missionReducer, type FsmState, type MissionAction, type MissionState } from '../core/state';
import { createMeasurement, measureReducer, type ActInput, type MeasureAction, type MeasurementState } from '../analytics/measurement';
import type { Dim } from '../analytics/opportunities';
import { buildReport, followupNeeds } from '../analytics/scoring';
import { followupPanel } from '../ui/followup';
import { addToGallery, clearSave, loadGame, loadSettings, safeStorage, saveGame, saveSettings, type Settings, type StorageLike } from '../core/persistence';
import { DialogueBox, type Choice, type Line, type SpeakerInfo } from '../ui/dialogue';
import { ModalHost, confirmPanel, type ModalHandle } from '../ui/panels';
import { Hud } from '../ui/hud';
import { aboutPanel, runPrologue, settingsPanel, showConsent, showSetup, showTitle } from '../ui/screens';
import { chapterCard } from '../ui/transition';
import { clear, h, toast } from '../ui/dom';
import { TitleScene } from '../world/TitleScene';
import { BunkerScene, BUNKER_MAP, type BunkerHooks, type MapDef } from '../world/BunkerScene';
import { CabinScene } from '../world/CabinScene';
import { LaunchScene } from '../world/LaunchScene';
import { StageScene } from '../world/StageScene';
import { showResults } from '../ui/results';
import { CANDIDATES, fillText } from '../story/candidates';
import { NPC_LOOKS, PLAYER_LOOKS, citizenLook, type Look } from '../art/look';
import { noknokURL } from '../art/sprites';
import { mirrorURL } from '../art/items';
import { isCandidateId } from '../shared/ids';
import { rapport } from '../story/sacrifice';
import { waGwa } from '../story/josa';
import { newRunId, newSeed, seededOrder } from '../shared/rng';
import { C1Flow } from './c1';
import { C2Flow } from './c2';
import { C3Flow } from './c3';
import { C4Flow } from './c4';
import { C5Flow } from './c5';
import { C6Flow } from './c6';
import { C7Flow } from './c7';
import { C8Flow } from './c8';

const CARDS: Record<number, [string, string]> = {
  4: ['DAY 189', '대답 없는 지구'],
  5: ['TOUCHDOWN', '붉은 행성에 첫발'],
  6: ['ZERO DOME', '산소가 줄어든다'],
  7: ['BELOW THE RED', '얼음 아래의 물'],
  8: ['FIRST SOL', '우리가 만들 첫 번째 규칙'],
};
const FLOWS = { 4: C4Flow, 5: C5Flow, 6: C6Flow, 7: C7Flow, 8: C8Flow } as const;

export interface ForkOption {
  id: string;
  label: string;
  pole: 1 | -1;
}

export interface ForkSpec {
  opp: string;
  dim: Dim;
  optionSetId: string;
  line: Line;
  options: ForkOption[];
  scene: string;
}

type ElKey = 'app' | 'game' | 'labels' | 'hud' | 'screen' | 'dialogue' | 'modal' | 'toast';
const NO_SAVE_STATES: FsmState[] = ['title', 'consent', 'setup'];
const WORLD_SCENES = ['title', 'bunker', 'cabin', 'launch', 'stage'] as const;
export type WorldKey = (typeof WORLD_SCENES)[number];

export class App {
  readonly storage: StorageLike;
  readonly persistent: boolean;
  settings: Settings;
  readonly mission: Store<MissionState, MissionAction>;
  readonly measure: Store<MeasurementState, MeasureAction>;
  readonly el: Record<ElKey, HTMLElement>;
  readonly dialogue: DialogueBox;
  readonly modals: ModalHost;
  readonly hud: Hud;
  private game: Phaser.Game | null = null;
  private saveTimer: number | undefined;
  private readonly alarm: HTMLElement;
  private flowCleanup: (() => void) | null = null;
  /**
   * 포크에서 고른 답의 화면 기억: 새로고침 뒤 같은 미니게임 변형을 보여 주는 데만 쓴다.
   * 이야기 상태·자원·점수에는 쓰지 않으며, 분석을 끈 판에서는 저장하지 않는다(기록을 만들지 않는다는 약속).
   */
  private ui: Record<string, string> = {};
  /** 자동 테스트 전용 훅. 개발 서버·e2e 모드 빌드에서 주소에 ?e2e=1이 있을 때만 window.__mle로 노출된다(배포 빌드에는 없다). */
  readonly debug: { interact?: (id: string) => void; ready?: () => boolean; actors?: () => string[]; spots?: () => string[] } = {};

  constructor() {
    const get = (id: string): HTMLElement => {
      const e = document.getElementById(id);
      if (!e) throw new Error(`#${id} 요소가 없어요`);
      return e;
    };
    this.el = { app: get('app'), game: get('game'), labels: get('labels'), hud: get('hud'), screen: get('screen'), dialogue: get('dialogue'), modal: get('modal'), toast: get('toast') };
    const st = safeStorage();
    this.storage = st.storage;
    this.persistent = st.persistent;
    this.settings = loadSettings(this.storage);
    this.mission = new Store(missionReducer, createMission('none', 1, { name: '시민 대표', look: 0, relation: 'sibling' }));
    this.measure = new Store(measureReducer, createMeasurement(false));
    this.modals = new ModalHost(this.el.modal);
    // 퍼즐 자동 진행(기본): 퍼즐 창이 열리면 녹녹이가 대신 풀고, 맡긴 뒤 '완료'를 눌러야 하는 창(밸브 진단·근무표)은 이어서 누른다
    this.modals.onOpen = (card) => {
      if (this.settings.puzzles !== 'auto') return;
      const assist = card.querySelector<HTMLButtonElement>('button.assist');
      if (!assist) return;
      // 자료 열람(S/N 관찰 기회)이 들어 있는 퍼즐 창은 자동으로 닫지 않는다. 닫아 버리면 그 장의 관찰 기회가 사라져
      // 기본 설정 플레이어의 S/N이 근거 부족이 되기 쉽다(시뮬레이션: 4.6% → 42%). 대신 [녹녹이에게 맡기기] 한 번으로 넘긴다.
      if (card.querySelector('.info-opp')) {
        const note = card.querySelector('.assist-note');
        if (note) note.textContent = '자료가 궁금하면 먼저 열어 보세요. 귀찮으면 [녹녹이에게 맡기기] 한 번이면 녹녹이가 풀고 넘어가요.';
        assist.classList.add('nudge');
        return;
      }
      window.setTimeout(() => {
        if (!assist.isConnected || assist.disabled) return;
        assist.click();
        toast(this.el.toast, '녹녹이에게 맡겼어요 · 퍼즐을 자동으로 넘겼어요 (직접 풀려면 메뉴 › 설정 › 퍼즐)');
        window.setTimeout(() => {
          const next = card.querySelector<HTMLButtonElement>('button.auto-next');
          if (card.isConnected && next && !next.disabled) next.click();
        }, this.reduced ? 200 : 700);
      }, this.reduced ? 150 : 350);
    };
    this.dialogue = new DialogueBox(this.el.dialogue, (k) => this.speaker(k), (t) => this.fill(t));
    this.hud = new Hud(this.el.hud);
    this.hud.setMenuHandler(() => this.openMenu());
    // 지금 할 일이 바뀌면 걷는 지도 위의 반짝이는 표식을 옮긴다
    this.hud.onFocusChange = () => {
      if (this.game?.scene.isActive('bunker')) (this.game.scene.getScene('bunker') as BunkerScene).refreshFocus();
    };
    this.alarm = h('div', { id: 'alarm', 'aria-hidden': 'true' });
    this.el.app.insertBefore(this.alarm, this.el.hud);
    this.mission.subscribe(() => this.scheduleSave());
    // 라포: 동료와 장마다 처음 이야기하면 머리 위에 ♥, 지금까지의 라포를 알려 준다(희생 장면의 마지막 말이 달라진다)
    this.mission.subscribe((next, prev) => {
      for (const k of Object.keys(next.flags)) {
        if (!k.startsWith('talk_c') || next.flags[k] !== true || prev.flags[k] === true) continue;
        const id = k.split('_')[2];
        if (!isCandidateId(id)) continue;
        if (this.game?.scene.isActive('bunker')) (this.game.scene.getScene('bunker') as BunkerScene).emote(id, '♥');
        toast(this.el.toast, `${waGwa(CANDIDATES[id].name)} 조금 더 가까워졌어요 ${'♥'.repeat(Math.min(rapport(next, id), 8))}`);
      }
    });
    this.measure.subscribe(() => this.scheduleSave());
    document.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('pagehide', () => this.saveNow());
    this.applySettings();
    if ((import.meta.env.DEV || import.meta.env.MODE === 'e2e') && new URLSearchParams(window.location.search).has('e2e')) {
      (window as unknown as { __mle: unknown }).__mle = {
        interact: (id: string) => this.debug.interact?.(id),
        ready: () => this.debug.ready?.() ?? false,
        actors: () => this.debug.actors?.() ?? [],
        spots: () => this.debug.spots?.() ?? [],
        state: () => this.mission.state,
        measure: () => this.measure.state,
        report: () => buildReport(this.measure.state),
        screenOf: (id: string) => (this.game?.scene.isActive('bunker') ? (this.game.scene.getScene('bunker') as BunkerScene).screenPos(id) : null),
      };
    }
  }

  start(): void {
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.el.game,
      pixelArt: true,
      backgroundColor: '#171D34',
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
      scene: [],
    });
    this.game.scene.add('title', TitleScene, false);
    this.game.scene.add('bunker', BunkerScene, false);
    this.game.scene.add('cabin', CabinScene, false);
    this.game.scene.add('launch', LaunchScene, false);
    this.game.scene.add('stage', StageScene, false);
    this.game.events.once('ready', () => this.toTitle());
  }

  get reduced(): boolean {
    return this.settings.reducedMotion;
  }

  playerLook(): Look {
    return PLAYER_LOOKS[this.mission.state.player.look] ?? PLAYER_LOOKS[0];
  }

  // ---------- 공통 유틸 ----------

  fill(text: string): string {
    const p = this.mission.state.player;
    return fillText(text, { player: p.name, relation: p.relation });
  }

  speaker(k: string): SpeakerInfo {
    const p = this.mission.state.player;
    const playerLook = this.playerLook();
    if (isCandidateId(k)) return { name: CANDIDATES[k].name, look: CANDIDATES[k].look, cls: k };
    switch (k) {
      case 'dam': return { name: '담', look: NPC_LOOKS.dam, cls: 'dam' };
      case 'boram': return { name: '보람', look: NPC_LOOKS.boram, cls: 'boram' };
      case 'noknok': return { name: '녹녹이', icon: noknokURL(), cls: 'noknok' };
      case 'mirror': return { name: 'MIRROR', icon: mirrorURL(), cls: 'mirror' };
      case 'player': return { name: p.name, look: playerLook, cls: 'player' };
      case 'thought': return { name: `${p.name} (속말)`, look: playerLook, cls: 'thought' };
      case 'broadcast': return { name: '방송', cls: 'broadcast' };
      case 'radio': return { name: '보람 (무전)', look: NPC_LOOKS.boram, cls: 'broadcast' };
      case 'citizen': return { name: '시민', look: citizenLook(1), cls: 'citizen' };
      default: return { name: '', cls: 'narrator' };
    }
  }

  say(lines: Line[], opts?: { noSkip?: boolean }): Promise<void> {
    return this.dialogue.say(lines, opts);
  }

  choose(line: Line, choices: Choice[]): Promise<string> {
    return this.dialogue.choose(line, choices);
  }

  order(key: string, n: number): number[] {
    return seededOrder(this.mission.state.runSeed, key, n);
  }

  openOpp(id: string): void {
    this.measure.dispatch({ type: 'open', id });
  }

  closeOpp(id: string): void {
    this.measure.dispatch({ type: 'close', id });
  }

  recordAct(act: ActInput): void {
    this.measure.dispatch({ type: 'act', act });
  }

  /** 채점용 포크: 동등한 대안을 시드로 섞어 보여 주고, 화면 위치와 함께 1회만 기록한다. */
  async fork(spec: ForkSpec): Promise<string> {
    const ordered = this.order(spec.optionSetId, spec.options.length).map((i) => spec.options[i]);
    const id = await this.dialogue.choose(spec.line, ordered.map((o) => ({ id: o.id, label: o.label })));
    this.ui = { ...this.ui, [spec.optionSetId]: id };
    const pos = ordered.findIndex((o) => o.id === id);
    const chosen = spec.options.find((o) => o.id === id);
    const other = spec.options.find((o) => o.id !== id);
    if (chosen) {
      this.recordAct({
        opportunityId: spec.opp, dim: spec.dim, kind: 'fork', pole: chosen.pole,
        actKey: `fork:${spec.optionSetId}`, displayPosition: pos, optionSetId: spec.optionSetId,
        label: chosen.label, otherLabel: other?.label, scene: spec.scene,
        askedBy: spec.line.who === 'dam' || spec.line.who === 'mirror' || spec.line.who === 'noknok' ? spec.line.who : isCandidateId(spec.line.who) ? 'crew' : 'self',
      });
    }
    return id;
  }

  /** 이미 답한 포크의 답(화면 변형 복원용). 없으면 null */
  forkMemo(optionSetId: string): string | null {
    return this.ui[optionSetId] ?? null;
  }

  isBlocked(): boolean {
    return this.dialogue.isOpen() || this.modals.isOpen() || this.el.screen.classList.contains('show');
  }

  setFlowCleanup(f: (() => void) | null): void {
    this.flowCleanup?.();
    this.flowCleanup = f;
  }

  // ---------- 저장 ----------

  private scheduleSave(): void {
    if (NO_SAVE_STATES.includes(this.mission.state.fsm)) return;
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), 200);
  }

  saveNow(): boolean {
    if (NO_SAVE_STATES.includes(this.mission.state.fsm)) return false;
    return saveGame(this.storage, this.mission.state, this.measure.state, this.measure.state.analysisOptIn ? this.ui : {});
  }

  // ---------- 설정 ----------

  applySettings(): void {
    const root = document.documentElement;
    root.dataset.text = String(this.settings.textScale);
    root.dataset.intensity = String(this.settings.intensity);
    root.classList.toggle('reduce-motion', this.settings.reducedMotion);
  }

  openSettings(): Promise<void> {
    return settingsPanel(this.modals, this.settings, (s) => {
      this.settings = s;
      saveSettings(this.storage, s);
      this.applySettings();
    });
  }

  private openMenu(): void {
    let handle: ModalHandle | null = null;
    const item = (label: string, f: () => void): HTMLElement => h('button', { class: 'btn', type: 'button', onClick: () => { handle?.close(); f(); } }, label);
    handle = this.modals.open({
      title: '메뉴',
      body: h('div', { class: 'menu-list' },
        item('설정', () => void this.openSettings()),
        item('어떤 게임인가요', () => void aboutPanel(this.modals)),
        item('지금 저장하기', () => {
          const ok = this.saveNow();
          toast(this.el.toast, !ok ? '저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요' : this.persistent ? '이 브라우저에 저장했어요' : '이 탭에만 임시로 저장했어요. 새로고침하면 사라져요');
        }),
        ...(this.measure.state.analysisOptIn ? [item('행동 분석 끄기', () => void this.optOut())] : []),
        item('타이틀로', () => { this.saveNow(); this.toTitle(); }),
        item('기록 삭제', () => void this.wipe()),
      ),
      footer: h('button', { class: 'btn', type: 'button', onClick: () => handle?.close() }, '닫기'),
    });
  }

  /** 플레이 도중 행동 분석 끄기: 지금까지의 행동 기록을 지우고 남은 이야기는 기록 없이 진행한다 */
  async optOut(): Promise<void> {
    const ok = await confirmPanel(this.modals, {
      title: '행동 분석 끄기',
      body: h('p', {}, '지금까지 모은 행동 기록을 지우고, 남은 이야기는 기록 없이 진행해요. 이야기와 엔딩은 달라지지 않아요. 이번 판에서는 다시 켤 수 없어요.'),
      confirmLabel: '끄고 기록 지우기',
      cancelLabel: '취소',
    });
    if (!ok) return;
    this.measure.dispatch({ type: 'setOptIn', value: false });
    this.ui = {};
    this.saveNow();
    toast(this.el.toast, '행동 분석을 끄고 기록을 지웠어요');
  }

  async wipe(): Promise<void> {
    const ok = await confirmPanel(this.modals, {
      title: '기록 삭제',
      body: h('p', {}, '이 브라우저에 저장된 진행 상황과 행동 기록을 모두 지울까요? 되돌릴 수 없어요.'),
      confirmLabel: '모두 지우기',
      cancelLabel: '취소',
    });
    if (!ok) return;
    window.clearTimeout(this.saveTimer);
    clearSave(this.storage);
    this.mission.replace(createMission('none', 1, { name: '시민 대표', look: 0, relation: 'sibling' }));
    this.measure.replace(createMeasurement(false));
    this.ui = {};
    toast(this.el.toast, '기록을 지웠어요');
    this.toTitle();
  }

  // ---------- 키보드 ----------

  private onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (e.key === 'Escape') {
      if (this.modals.closeTop()) e.preventDefault();
      return;
    }
    const act = e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E';
    if (!act) return;
    if (t && t.tagName === 'BUTTON') return;
    if (this.dialogue.isOpen()) {
      if (this.dialogue.advance()) e.preventDefault();
      return;
    }
    if (this.modals.isOpen() || this.el.screen.classList.contains('show')) return;
    if (this.hud.triggerPrompt()) e.preventDefault();
  }

  // ---------- 장면 전환 ----------

  private scenes(): Phaser.Scenes.SceneManager {
    if (!this.game) throw new Error('게임이 아직 시작되지 않았어요');
    return this.game.scene;
  }

  /** 월드 장면 하나만 켠다 */
  startScene(key: WorldKey, data: object): void {
    const sm = this.scenes();
    for (const k of WORLD_SCENES) if (k !== key && (sm.isActive(k) || sm.isPaused(k))) sm.stop(k);
    if (sm.isActive(key)) sm.stop(key);
    clear(this.el.labels);
    sm.start(key, data);
  }

  setAlarm(on: boolean): void {
    this.alarm.classList.toggle('on', on && this.settings.intensity > 0);
  }

  toTitle(): void {
    this.setFlowCleanup(null);
    this.modals.closeAll();
    this.dialogue.hide();
    this.hud.show(false);
    this.hud.setPrompt(null, null);
    this.hud.setResources(null);
    this.setAlarm(false);
    clear(this.el.labels);
    this.startScene('title', { reducedMotion: this.reduced });
    const res = loadGame(this.storage);
    const note = !res.ok && res.reason !== 'empty' ? '이전 버전이거나 손상된 기록이 있어 이어할 수 없어요. 새로 시작하면 정리돼요.' : null;
    showTitle(this.el.screen, {
      canContinue: res.ok,
      saveNote: note,
      persistent: this.persistent,
      onNew: () => this.newGame(),
      onContinue: () => this.continueGame(),
      onAbout: () => void aboutPanel(this.modals),
      onSettings: () => void this.openSettings(),
    });
  }

  private newGame(): void {
    showConsent(this.el.screen, (optIn) => {
      showSetup(this.el.screen, (profile) => {
        this.ui = {};
        this.measure.replace(createMeasurement(optIn));
        this.mission.dispatch({ type: 'newRun', runId: newRunId(), runSeed: newSeed(), player: profile });
        void this.playPrologue();
      });
    });
  }

  private async playPrologue(): Promise<void> {
    const sm = this.scenes();
    if (sm.isActive('title')) sm.stop('title');
    await runPrologue(this.el.screen, this.reduced);
    this.mission.dispatch({ type: 'goto', fsm: 'c1_tutorial' });
    this.startC1();
  }

  private continueGame(): void {
    const r = loadGame(this.storage);
    if (!r.ok) {
      toast(this.el.toast, '이어할 수 있는 기록이 없어요');
      return;
    }
    this.mission.replace(r.bundle.mission);
    this.measure.replace(r.bundle.measure);
    this.ui = r.bundle.ui ?? {};
    clear(this.el.screen);
    this.el.screen.className = '';
    const fsm = this.mission.state.fsm;
    if (fsm === 'prologue') void this.playPrologue();
    else if (fsm.startsWith('c1_')) this.startC1();
    else if (fsm === 'c2_cargo') this.startC2();
    else if (fsm === 'c2_sealed') void this.beginC3();
    else if (fsm.startsWith('c3_')) this.startC3();
    else if (fsm === 'results') this.showResults();
    else {
      const n = Number(fsm.charAt(1));
      if (n >= 4 && n <= 8) this.startChapter(n);
      else this.toTitle();
    }
  }

  private startC1(): void {
    const flow = new C1Flow(this);
    this.setFlowCleanup(() => flow.dispose());
    flow.start();
  }

  private startC2(): void {
    const flow = new C2Flow(this);
    this.setFlowCleanup(() => flow.dispose());
    flow.start();
  }

  private startC3(): void {
    const flow = new C3Flow(this);
    this.setFlowCleanup(() => flow.dispose());
    flow.start();
  }

  private async card(no: number, en: string, ko: string): Promise<void> {
    this.setFlowCleanup(null);
    this.modals.closeAll();
    this.dialogue.hide();
    this.hud.show(false);
    this.hud.setPrompt(null, null);
    this.setAlarm(false);
    clear(this.el.labels);
    await chapterCard(this.el.screen, { no, en, ko, reduced: this.reduced });
  }

  /** C1 → C2 전환 (장 제목 카드) */
  async beginC2(): Promise<void> {
    await this.card(2, 'THE LAST BAG', '마지막 12킬로그램');
    this.startC2();
  }

  /** C2 → C3 전환 (장 제목 카드, 서사 시계 T-00:14:00) */
  async beginC3(): Promise<void> {
    await this.card(3, 'IGNITION', '지구의 마지막 창');
    if (this.mission.state.fsm === 'c2_sealed') {
      this.mission.dispatch({ type: 'goto', fsm: 'c3_preflight' });
      this.mission.dispatch({ type: 'setClock', minutes: 14, floor: 2 });
    }
    this.startC3();
  }

  /** 걸어 다니는 지도 장면(C1 발사장이 기본값). C2~C8은 각자의 지도와 자원 표시를 쓴다 */
  startBunker(hooks: BunkerHooks, start: { x: number; y: number }, map: MapDef = BUNKER_MAP, alarm = true): void {
    clear(this.el.screen);
    this.el.screen.className = '';
    this.startScene('bunker', {
      hooks,
      focus: () => this.hud.focusSpot,
      playerLook: this.playerLook(),
      reducedMotion: this.reduced,
      labelsEl: this.el.labels,
      start,
      map,
    });
    this.hud.show(true);
    this.hud.setResources(map === BUNKER_MAP ? null : this.mission.state.resources);
    this.setAlarm(alarm);
  }

  /** 장 제목 카드 → C4~C8 흐름 시작 */
  async beginChapter(n: number): Promise<void> {
    const c = CARDS[n];
    if (!c) return;
    await this.card(n, c[0], c[1]);
    this.startChapter(n);
  }

  private startChapter(n: number): void {
    const F = FLOWS[n as keyof typeof FLOWS];
    if (!F) return;
    const flow = new F(this);
    this.setFlowCleanup(() => flow.dispose());
    flow.start();
  }

  showResults(): void {
    void this.showResultsAsync();
  }

  private async showResultsAsync(): Promise<void> {
    this.setFlowCleanup(null);
    this.modals.closeAll();
    this.dialogue.hide();
    this.hud.show(false);
    this.hud.setPrompt(null, null);
    this.setAlarm(false);
    clear(this.el.labels);
    this.startScene('title', { reducedMotion: this.reduced });
    // 근거 부족·동률인 축은 결과지 전에 추가 질문으로 정한다(답은 바로 저장되어 새로고침해도 이어진다)
    const needs = followupNeeds(this.measure.state);
    if (needs.length) await followupPanel(this.modals, needs, (key) => this.order(key, 2), (answer) => this.measure.dispatch({ type: 'followup', answer }));
    const ending = this.mission.state.flags.ending;
    const gallery = addToGallery(this.storage, typeof ending === 'string' ? ending : '');
    showResults(this.el.screen, {
      mission: this.mission.state,
      measure: this.measure.state,
      report: buildReport(this.measure.state),
      gallery,
      onTitle: () => this.toTitle(),
      onWipe: () => void this.wipe(),
      onReplay: () => this.replay(),
    });
  }

  /** 결과지의 [다시하기]: 새 판 시작(엔딩 갤러리는 유지, 진행 기록은 새 판이 덮어쓴다) */
  replay(): void {
    this.toTitle();
    this.newGame();
  }
}
