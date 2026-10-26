import type { App } from './app';
import { farewellGag } from './gags';
import type { BunkerScene, Interactable } from '../world/BunkerScene';
import { CANDIDATE_SPOTS, CITIZEN_SPOTS, SPOTS } from '../art/bunker';
import { NPC_LOOKS, citizenLook } from '../art/look';
import { portraitURL } from '../art/sprites';
import { CANDIDATES, MIRROR_RECOMMENDATION, SKILL_KEYS, SKILL_LABEL, type SkillKey } from '../story/candidates';
import { CANDIDATE_IDS, CHAPTER_TITLE, type CandidateId } from '../shared/ids';
import { seatedIds, unselectedOf } from '../story/roster';
import { pickSpeaker } from '../story/resolver';
import { eunNeun } from '../story/josa';
import { formatClock } from '../core/state';
import { confirmPanel, infoPanel, lines, perspectivePanel, tabPanel, type ModalHandle } from '../ui/panels';
import { openRoster } from '../ui/roster';
import { clear, h, pxImg, toast } from '../ui/dom';

/** 명단 확정 때 닫는 기회. O03(ORDER)은 좌석 단계의 점검 포크까지 열려 있다. */
const C1_LOCK_CLOSE = ['C1-O01', 'C1-O02', 'C1-O04'] as const;
const QUIET_LINES = [
  '창밖의 재가 천천히 내린다. 숨을 한 번 고른다.',
  '유리에 비친 얼굴이 낯설다. ...괜찮아, 아직은.',
  '멀리서 경보가 울린다. 여기서는 조금 작게 들린다.',
];
const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/** C1 · LAST FOUR — 튜토리얼, 6명 중 4명 선발, 권고 반전, 작별과 유산, 좌석 점검·요청, 출발 */
export class C1Flow {
  private readonly app: App;
  private scene: BunkerScene | null = null;
  private criteria: SkillKey[] = [];
  private readonly tutorial = new Set<string>();
  private readonly asked = new Map<CandidateId, number>();
  private quietCount = 0;
  private roster: ModalHandle | null = null;
  private busy = false;
  private firstFullRunning = false;
  private unsub: (() => void) | null = null;

  constructor(app: App) {
    this.app = app;
  }

  start(): void {
    this.unsub = this.app.mission.subscribe(() => this.refreshHud());
    this.app.debug.interact = (id) => void this.interact(id);
    this.app.debug.ready = () => this.scene !== null && !this.busy;
    this.app.debug.actors = () => this.scene?.actorIds() ?? [];
    this.app.startBunker({
      isBlocked: () => this.app.isBlocked() || this.busy,
      onNearest: (it) => this.app.hud.setPrompt(it, it ? () => void this.interact(it.id) : null),
      onInteract: (id) => void this.interact(id),
      onReady: (scene) => {
        this.scene = scene;
        this.populate();
        void this.resume();
      },
    }, SPOTS.playerStart);
  }

  dispose(): void {
    this.app.debug.interact = undefined;
    this.app.debug.ready = undefined;
    this.app.debug.actors = undefined;
    this.unsub?.();
    this.unsub = null;
    this.roster?.close();
    this.roster = null;
  }

  private get m() {
    return this.app.mission.state;
  }

  private flag(key: string, value: string | number | boolean = true): void {
    this.app.mission.dispatch({ type: 'flag', key, value });
  }

  private tick(minutes: number): void {
    this.app.mission.dispatch({ type: 'tick', minutes });
  }

  private names(ids: readonly CandidateId[]): string {
    return ids.map((id) => CANDIDATES[id].name).join(' · ');
  }

  private populate(): void {
    const s = this.scene;
    if (!s) return;
    CANDIDATE_IDS.forEach((id) => {
      const p = CANDIDATE_SPOTS[id];
      s.addActor(id, CANDIDATES[id].look, p.x, p.y, 'down', CANDIDATES[id].name);
    });
    s.addActor('dam', NPC_LOOKS.dam, SPOTS.dam.x, SPOTS.dam.y, 'down', '담');
    s.addActor('boram', NPC_LOOKS.boram, SPOTS.control.x, SPOTS.control.y, 'left', '보람');
    CITIZEN_SPOTS.forEach((p, i) => s.addActor(`cit${i}`, citizenLook(i), p.x, p.y, i % 2 ? 'left' : 'down'));
    s.addLabel(320, 66, '탑승판 · ARK-06 남은 좌석 4', 'spot board');
    s.addLabel(44, 68, '조용한 창가', 'spot');
    s.addLabel(496, 68, '의료·기술 게시판', 'spot');
    s.addLabel(590, 108, '관제실', 'spot');
    s.addLabel(606, 350, '탑승구', 'spot');
  }

  private refreshHud(): void {
    const m = this.m;
    if (!m.fsm.startsWith('c1_')) return;
    this.app.hud.setTop(`C1 · ${CHAPTER_TITLE.C1}`, formatClock(m.narrativeClock));
    if (m.fsm === 'c1_tutorial') {
      this.app.hud.setObjectives('준비', [{ text: `녹녹이의 충전 케이블 찾기 (${this.tutorial.size}/3)`, done: false, spot: ['t-crate', 't-locker', 't-citizen'].find((x) => !this.tutorial.has(x)) }]);
    } else if (m.fsm === 'c1_explore') {
      this.app.hud.setObjectives('후보 여섯 명의 기록을 읽고, 탑승할 네 사람을 직접 선택하세요', [
        { text: '탑승판 열기', done: m.flags.c1_board_opened === true, spot: 'board' },
        { text: `후보 만나 보기 ${m.met.length}/6 (선택)`, done: m.met.length === 6, optional: true },
        { text: `좌석 채우기 ${m.crewIds.length}/4`, done: m.crewIds.length === 4, spot: 'board' },
        { text: '명단 확정', done: m.crewLocked, spot: 'board' },
      ]);
    } else {
      this.app.hud.setObjectives('출발 준비', [
        { text: '남겨진 사람들과 인사', done: m.fsm !== 'c1_farewell' },
        { text: '좌석 점검과 배치 확인', done: m.flags.c1_seated === true },
        { text: '탑승구로', done: false, spot: 'hatch' },
      ]);
    }
  }

  private async resume(): Promise<void> {
    this.refreshHud();
    const fsm = this.m.fsm;
    if (fsm === 'c1_tutorial') await this.tutorialIntro();
    else if (fsm === 'c1_explore') {
      if (this.m.flags.c1_intro === true) this.setExplore();
      else await this.damIntro();
    } else if (fsm === 'c1_farewell') await this.farewell();
    else if (fsm === 'c1_seating') await this.seating();
    else if (fsm === 'c1_depart') await this.depart();
  }

  // ---------- 튜토리얼 (비채점 연습) ----------

  private tutorialItems(): Interactable[] {
    const all: Interactable[] = [
      { id: 't-crate', x: SPOTS.crate.x, y: SPOTS.crate.y, r: 26, label: '짐 더미', verb: '살펴보기' },
      { id: 't-locker', x: SPOTS.locker.x, y: SPOTS.locker.y, r: 26, label: '보급 사물함', verb: '열어 보기' },
      { id: 't-citizen', x: CITIZEN_SPOTS[0].x, y: CITIZEN_SPOTS[0].y + 4, r: 24, label: '시민', verb: '말 걸기' },
    ];
    return all.filter((i) => !this.tutorial.has(i.id));
  }

  private setTutorial(): void {
    const s = this.scene;
    if (!s) return;
    const items = this.tutorialItems();
    s.setInteractables(items);
    for (const id of ['t-crate', 't-locker', 't-citizen']) {
      const it = items.find((i) => i.id === id);
      s.setSpark(id, it?.x ?? 0, (it?.y ?? 0) - 30, Boolean(it));
    }
    this.refreshHud();
  }

  private async tutorialIntro(): Promise<void> {
    this.setTutorial();
    await this.app.say([
      { who: 'noknok', text: '녹녹! 노크 노크! 드디어 찾았다, 시민 대표님! 저는 녹녹이예요. 원래 대피소 찻집의 녹차 AI였는데, 지금은 점검 드론 몸에 들어와 있어요.', expr: 'joy' },
      { who: 'noknok', text: '그런데 큰일이에요. 제 충전 케이블이 사라졌어요! 반짝이는 곳 세 군데를 살펴봐 주실래요?' },
      { who: 'noknok', text: '방향키나 WASD로 걷거나, 가고 싶은 곳을 눌러요. 가까이 가면 E 키나 화면 아래 버튼으로 살펴볼 수 있어요.' },
      { who: 'noknok', text: '참! 퍼즐이 귀찮으면 [녹녹이에게 맡기기]를 누르세요. 제가 대신 풀고 바로 넘어가요. 대사가 길면 [⏩ 대화 넘기기]로 한 번에 넘겨도 돼요!', expr: 'joy' },
    ]);
  }

  private async tutorialStep(id: string): Promise<void> {
    if (id === 't-crate') {
      await tabPanel(this.app.modals, {
        title: '짐 더미',
        subtitle: '연습: 기록 창 보는 법',
        tabs: [
          { key: 'A', label: '적혀 있는 것', lines: ['라벨: 3구역 담요 12장, 물통 4개.', '충전 케이블은 보이지 않는다.'] },
          { key: 'B', label: '떠오르는 것', lines: ['누군가 이 담요를 덮고 잠들었겠지.', '케이블은... 여기 없을 것 같다.'] },
        ],
        order: [0, 1],
        note: '이런 기록 창은 두 탭 중 하나를 먼저 골라야 내용이 보여요. 어느 쪽부터 봐도 괜찮아요. (연습이라 기록하지 않아요)',
      });
    } else if (id === 't-locker') {
      await this.app.choose({ who: 'noknok', text: '녹녹! 어느 칸부터 열어 볼까요?' }, [{ id: 'u', label: '위 칸부터' }, { id: 'd', label: '아래 칸부터' }]);
      await this.app.say([{ who: 'noknok', text: '...없네요! 이렇게 방식을 고르는 순간이 종종 있어요. 어느 쪽이든 괜찮아요. 녹차를 80도로 우리든 70도로 우리든 다 녹차인 것처럼요.' }]);
    } else if (id === 't-citizen') {
      const c = await this.app.choose({ who: 'citizen', text: '대표님이세요? ...힘내요. 우린 괜찮아요.' }, [{ id: 'hi', label: '인사하기' }, { id: 'ask', label: '케이블 본 적 있는지 묻기' }]);
      await this.app.say([{ who: 'citizen', text: c === 'hi' ? '고마워요. 꼭 좋은 사람들을 태워 줘요.' : '케이블이요? 아까 그 찻잔처럼 생긴 드론이 자꾸 뚜껑을 들썩이던데요.' }]);
    }
    this.tutorial.add(id);
    this.setTutorial();
    if (this.tutorial.size >= 3) await this.finishTutorial();
  }

  private async finishTutorial(): Promise<void> {
    await this.app.say([
      { who: 'noknok', text: '...어? 찻잎 칸이 따뜻한데요. ...여기 있었네요. 오류인가 봐요.', expr: 'joy' },
      { who: 'noknok', text: '고마워요, 대표님. 이제 진짜 일을 하러 가요. 조종사 담 씨가 기다리고 있어요.' },
    ]);
    this.app.mission.dispatch({ type: 'goto', fsm: 'c1_explore' });
    await this.damIntro();
  }

  // ---------- 탐색 ----------

  private async damIntro(): Promise<void> {
    this.scene?.setInteractables([]);
    this.scene?.faceTowardPlayer('dam');
    await this.app.say([
      { who: 'dam', text: '엔진은 준비됐어. 하지만 출발 전 마지막 탑승 명단은 당신이 확정해야 해.' },
      { who: 'thought', text: '난 그냥 평범한 사람인데... 사람을 고르라고?', expr: 'worry' },
      { who: 'noknok', text: '이 선택은 이야기를 바꾸지만, 당신이 좋은 사람인지 판단하지 않아요.' },
      { who: 'dam', text: '탑승판은 위쪽 벽에 있어. 후보 여섯 명은 왼쪽 대기실에 있고.' },
    ]);
    ['C1-O01', 'C1-O02', 'C1-O03', 'C1-O04'].forEach((id) => this.app.openOpp(id));
    this.flag('c1_intro');
    this.setExplore();
  }

  private setExplore(): void {
    const s = this.scene;
    if (!s) return;
    const items: Interactable[] = [
      { id: 'board', x: SPOTS.board.x, y: SPOTS.board.y, r: 30, label: '탑승판', verb: '열기' },
      { id: 'notice', x: SPOTS.notice.x, y: SPOTS.notice.y, r: 28, label: '의료·기술 게시판', verb: '읽기' },
      { id: 'quiet', x: SPOTS.quiet.x, y: SPOTS.quiet.y, r: 24, label: '조용한 창가', verb: '혼자 생각하기' },
      { id: 'boram', x: SPOTS.control.x, y: SPOTS.control.y + 6, r: 24, label: '보람', verb: '말 걸기' },
      { id: 'dam', x: SPOTS.dam.x, y: SPOTS.dam.y + 4, r: 22, label: '담', verb: '말 걸기' },
      { id: 'hatch', x: SPOTS.hatch.x - 10, y: SPOTS.hatch.y - 6, r: 26, label: '탑승구', verb: '살펴보기' },
      ...CANDIDATE_IDS.map((id): Interactable => ({ id, x: CANDIDATE_SPOTS[id].x, y: CANDIDATE_SPOTS[id].y + 4, r: 22, label: CANDIDATES[id].name, verb: '말 걸기' })),
    ];
    s.setInteractables(items);
    this.refreshHud();
  }

  private async interact(id: string): Promise<void> {
    if (this.busy || this.app.isBlocked()) return;
    this.busy = true;
    this.app.hud.setPrompt(null, null);
    try {
      const fsm = this.m.fsm;
      if (fsm === 'c1_tutorial') { await this.tutorialStep(id); return; }
      if (fsm !== 'c1_explore') return;
      if (id === 'board') await this.openBoard();
      else if (id === 'notice') await this.notice();
      else if (id === 'quiet') await this.quietWindow();
      else if (id === 'boram') await this.app.say([
        { who: 'boram', text: '서두르지 마. 시계는 내가 볼게. 넌 사람을 봐.' },
        { who: 'boram', text: '...나? 난 여기 남아. 누군가는 문을 닫아야 하잖아.' },
      ]);
      else if (id === 'dam') await this.damMenu();
      else if (id === 'hatch') await this.app.say([{ who: 'noknok', text: '명단이 확정되면 이 탑승구가 열려요.' }]);
      else if ((CANDIDATE_IDS as readonly string[]).includes(id)) await this.talk(id as CandidateId);
    } finally {
      this.busy = false;
    }
  }

  private async notice(): Promise<void> {
    await infoPanel(this.app.modals, 'ARK-06 기본 임무 조건 (게임 속 가상 설정)', [
      '좌석: 총 6석. 조종사 담과 시민 대표는 고정, 남은 4석을 후보 6명 중에서 정한다.',
      '항해: 약 7개월. 도착지는 로봇이 16년 동안 조립한 소형 밀폐 기지 제로돔.',
      '필수 생명유지 물자는 이미 기본 탑재되어 있다.',
      '누구를 태우든 여정은 이어진다. 빠진 전문성은 로봇·예비 장비·더 긴 절차로 대신한다.',
      '실제 화성은 지구보다 훨씬 살기 어렵다. 이 계획은 극한 상황을 가정한 이야기다.',
    ]);
  }

  private async damMenu(): Promise<void> {
    this.scene?.faceTowardPlayer('dam');
    const c = await this.app.choose({ who: 'dam', text: '다음 한 가지만. 뭐가 필요해?' }, [
      { id: 'band', label: '손목의 팔찌에 대해 묻기' },
      { id: 'rule', label: '규칙 다시 듣기' },
      { id: 'bye', label: '괜찮아요' },
    ]);
    if (c === 'band') {
      this.flag('c1_asked_band');
      await this.app.say([{ who: 'dam', text: '이거? ...04. 행운 번호야.' }, { who: 'narrator', text: '담은 팔찌를 소매 안으로 밀어 넣는다.' }]);
    } else if (c === 'rule') {
      await this.app.say([{ who: 'dam', text: '네 자리, 여섯 사람. 누구를 고르든 우리는 출발해. 빠진 기술은 로봇이랑 예비 장비로 버틴다.' }]);
    }
  }

  private async quietWindow(): Promise<void> {
    await this.app.say([{ who: 'narrator', text: QUIET_LINES[this.quietCount % QUIET_LINES.length] }]);
    this.app.recordAct({
      opportunityId: 'C1-O04', dim: 'E', kind: 'hotspot', pole: -1, actKey: `quiet:${this.quietCount}`,
      displayPosition: 0, optionSetId: 'c1-hotspots', label: '조용한 창가에서 혼자 생각하기', otherLabel: '후보들에게 더 묻기', scene: 'C1 대기실',
    });
    this.quietCount += 1;
    this.tick(5);
  }

  private async talk(id: CandidateId): Promise<void> {
    const c = CANDIDATES[id];
    this.scene?.faceTowardPlayer(id);
    if (!this.m.met.includes(id)) {
      this.app.mission.dispatch({ type: 'meet', id });
      this.tick(10);
      await this.app.say([{ who: id, text: c.greet }, { who: id, text: c.quote, expr: 'worry' }]);
      if (id === 'woojoo') {
        await this.app.say([
          { who: 'noknok', text: '녹녹! 녹차 AI로서 인정합니다. 보온 상태 완벽, 우린 온도 약 80도. ...저는 마실 수 없지만요. 오류인가 봐요.' },
          { who: 'woojoo', text: '드디어 말이 통하는 상대가 나타났어! ...근데 못 마신다고? 그럼 내가 두 배로 마실게.', expr: 'joy' },
        ]);
      }
      await this.checkTwist(false);
    }
    for (;;) {
      const n = this.asked.get(id) ?? 0;
      const choices = [
        ...(n < c.asks.length ? [{ id: 'ask', label: `더 묻기: ${c.asks[n].q}` }] : []),
        { id: 'dossier', label: '기록 보기' },
        { id: 'bye', label: '그만 이야기하기' },
      ];
      const pick = await this.app.choose({ who: id, text: `(${eunNeun(c.name)} ${c.idle}.)` }, choices);
      if (pick === 'ask') {
        await this.app.say([{ who: 'thought', text: c.asks[n].q }, { who: id, text: c.asks[n].a }]);
        this.app.recordAct({
          opportunityId: 'C1-O04', dim: 'E', kind: 'hotspot', pole: 1, actKey: `ask:${id}:${n}`,
          displayPosition: 0, optionSetId: 'c1-hotspots', label: '후보에게 더 묻기', otherLabel: '조용한 창가에서 혼자 생각하기', scene: 'C1 대기실',
        });
        this.asked.set(id, n + 1);
        this.tick(5);
      } else if (pick === 'dossier') {
        await this.dossier(id);
      } else {
        break;
      }
    }
  }

  private async dossier(id: CandidateId): Promise<void> {
    const c = CANDIDATES[id];
    this.tick(5);
    await tabPanel(this.app.modals, {
      title: `${c.name}의 기록`,
      subtitle: `${c.age}세 · ${c.role}`,
      tabs: [
        { key: 'S', label: '실측 기록', lines: [...c.facts.map((t) => this.app.fill(t)), `추천인 증언 — ${this.app.fill(c.testimony)}`] },
        { key: 'N', label: '가능성 분석', lines: [...c.possibilities.map((t) => this.app.fill(t)), `본인 음성메모 — ${this.app.fill(c.voiceMemo)}`] },
      ],
      order: this.app.order(`c1-dossier-${id}`, 2),
      onPick: (key, pos, first) => this.app.recordAct({
        opportunityId: 'C1-O01', dim: 'SN', kind: 'tab', pole: key === 'N' ? 1 : -1,
        actKey: first ? `dossier:${id}:first` : `dossier:${id}:${key}:more`, secondary: !first,
        displayPosition: pos, optionSetId: 'c1-dossier', label: key === 'N' ? '가능성 분석 탭 먼저' : '실측 기록 탭 먼저',
        otherLabel: key === 'N' ? '실측 기록 탭' : '가능성 분석 탭', scene: 'C1 후보 기록을 열었을 때',
      }),
    });
  }

  private async checkTwist(force: boolean): Promise<void> {
    const m = this.m;
    if (m.flags.c1_reco === true) return;
    if (!force && m.met.length < 3) return;
    this.flag('c1_reco');
    await this.app.say([
      { who: 'broadcast', text: '제로돔 MIRROR 지구 중계 노드 — 최적 편성 권고를 수신했습니다.' },
      { who: 'broadcast', text: `권고: ${this.names(MIRROR_RECOMMENDATION.crew)}. 생존 기대 지수 ${MIRROR_RECOMMENDATION.index}.` },
      { who: 'dam', text: '...화성 기지 모델의 권고안이야. 하린이랑 도담은 빠져 있네. 참고만 해, 결정은 당신 몫이야.' },
    ]);
  }

  private async recoPanel(): Promise<void> {
    await infoPanel(this.app.modals, 'MIRROR 권고 근거', [
      `권고 편성: ${this.names(MIRROR_RECOMMENDATION.crew)}`,
      `생존 기대 지수: ${MIRROR_RECOMMENDATION.index} (게임 속 가상 계산)`,
      `계산한 것: ${MIRROR_RECOMMENDATION.counted.join(' / ')}`,
      `계산하지 않은 것: ${MIRROR_RECOMMENDATION.notCounted.join(', ')}`,
      '지구에 남은 중계 노드가 16년 전 기지 계획 모델로 계산한 값이에요. 이 권고를 따를지 말지는 성격 결과에 쓰이지 않아요.',
    ]);
  }

  private pickCriteria(): Promise<void> {
    return new Promise((resolve) => {
      const chosen = new Set<SkillKey>();
      const box = h('div', { class: 'chips', role: 'group', 'aria-label': '기준' });
      const draw = (): void => {
        clear(box);
        SKILL_KEYS.forEach((k) => box.append(h('button', {
          class: `btn small${chosen.has(k) ? ' primary' : ''}`, type: 'button', 'aria-pressed': String(chosen.has(k)),
          onClick: () => { if (chosen.has(k)) chosen.delete(k); else if (chosen.size < 3) chosen.add(k); draw(); },
        }, SKILL_LABEL[k])));
      };
      draw();
      let handle: ModalHandle | null = null;
      const done = (): void => { this.criteria = [...chosen]; handle?.close(); resolve(); };
      handle = this.app.modals.open({
        title: '나의 탑승 기준표',
        body: h('div', {}, h('p', {}, '중요하게 볼 기준을 세 개까지 골라 보세요. 탑승판에 메모로 붙어요.'), box),
        footer: h('button', { class: 'btn primary', type: 'button', onClick: done }, '완료'),
        onEscape: done,
      });
    });
  }

  private async openBoard(): Promise<void> {
    if (this.m.flags.c1_board_opened !== true) {
      const id = await this.app.fork({
        opp: 'C1-O03', dim: 'JP', optionSetId: 'c1-start-mode', scene: 'C1 탑승판을 처음 열었을 때',
        line: { who: 'noknok', text: '명단을 어떻게 시작할까요? 어느 쪽이든 괜찮아요.' },
        options: [
          { id: 'plan', label: '기준표 먼저 만들기', pole: 1 },
          { id: 'people', label: '사람부터 만나 보며 정하기', pole: -1 },
        ],
      });
      this.flag('c1_board_opened');
      if (id === 'plan') await this.pickCriteria();
      else await this.app.say([{ who: 'noknok', text: '좋아요! 대기실에서 후보들을 만나 보고, 언제든 탑승판으로 돌아오세요.' }]);
    }
    this.showRoster();
  }

  private showRoster(): void {
    this.roster = openRoster(this.app.modals, {
      mission: () => this.app.mission.state,
      dispatch: (a) => {
        this.app.mission.dispatch(a);
        if (a.type === 'assign') this.tick(5);
      },
      subscribe: (f) => this.app.mission.subscribe(() => f()),
      fill: (t) => this.app.fill(t),
      criteria: () => this.criteria,
      recoVisible: () => this.app.mission.state.flags.c1_reco === true,
      onDossier: (id) => void this.dossier(id),
      onFirstFull: () => void this.firstFull(),
      onConfirm: () => { this.roster = null; void this.confirmFlow(); },
      onReco: () => void this.recoPanel(),
      onClose: () => { this.roster = null; },
    });
  }

  private async firstFull(): Promise<void> {
    if (this.m.flags.c1_first_full === true || this.firstFullRunning) return;
    this.firstFullRunning = true;
    try {
      const id = await this.app.fork({
        opp: 'C1-O02', dim: 'O', optionSetId: 'c1-variant', scene: 'C1 처음으로 네 자리를 다 채웠을 때',
        line: { who: 'noknok', text: '네 자리가 처음으로 다 찼어요! 이제 어떻게 할까요?' },
        options: [
          { id: 'try', label: '다른 조합도 시험해 보기', pole: 1 },
          { id: 'review', label: '이 편성으로 검토 단계로', pole: -1 },
        ],
      });
      this.flag('c1_first_full');
      await this.app.say([{
        who: 'noknok',
        text: id === 'try'
          ? '오른쪽 편성안 칸에 지금 조합을 저장해 두고, 다른 사람을 앉혀 볼 수 있어요.'
          : '좋아요. 오른쪽 팀 역량 막대를 보면서 확정 전에 한 번 더 살펴봐요.',
      }]);
      await this.checkTwist(true);
    } finally {
      this.firstFullRunning = false;
    }
  }

  private async confirmFlow(): Promise<void> {
    this.busy = true;
    try {
      if (this.m.flags.c1_dam_wait !== true) {
        this.flag('c1_dam_wait');
        await this.app.say([{ who: 'dam', text: '결정을 미룰 수는 있어. 하지만 그게 결정하지 않아도 된다는 뜻은 아니야.' }]);
      }
      const crew = seatedIds(this.m.seats);
      const out = unselectedOf(crew);
      const ok = await confirmPanel(this.app.modals, {
        title: '명단 확정',
        body: h('div', {}, h('p', {}, '확정하면 되돌릴 수 없어요.'), lines([
          `탑승: 담(조종사), ${this.m.player.name}(시민 대표), ${this.names(crew)}`,
          `탑승하지 못하는 두 사람: ${this.names(out)}`,
        ])),
        confirmLabel: '확정',
        cancelLabel: '다시 살펴보기',
      });
      if (!ok) { this.showRoster(); return; }
      this.app.mission.dispatch({ type: 'lockCrew' });
      if (!this.m.crewLocked) { toast(this.app.el.toast, '네 자리를 모두 채워야 확정할 수 있어요'); this.showRoster(); return; }
      C1_LOCK_CLOSE.forEach((oid) => this.app.closeOpp(oid));
      this.tick(20);
      this.app.mission.dispatch({ type: 'goto', fsm: 'c1_farewell' });
    } finally {
      this.busy = false;
    }
    if (this.m.fsm === 'c1_farewell') await this.farewell();
  }

  // ---------- 작별 · 좌석 · 출발 ----------

  private async farewell(): Promise<void> {
    const s = this.scene;
    if (!s) return;
    this.busy = true;
    s.setCutscene(true);
    s.setInteractables([]);
    this.refreshHud();
    const crew = this.m.crewIds;
    const out = unselectedOf(crew);
    if (crew.includes('harin')) {
      await this.app.say([{ who: out[0], text: '하린, 잘 부탁해.' }, { who: 'harin', text: '...응. 꼭.', expr: 'worry' }]);
    } else {
      await this.app.say([{ who: 'narrator', text: '하린이 말없이 고개를 끄덕인다.' }]);
    }
    for (const [i, u] of out.entries()) {
      const pp = s.playerPos();
      await s.walkActor(u, pp.x + (i === 0 ? -22 : 22), pp.y - 2, 1300);
      s.faceTowardPlayer(u);
      // 재미 연출: 남겨진 사람의 마지막 소동·숨은 본색(이야기 연출 전용, 어디에도 기록하지 않는다)
      await farewellGag(this.app, s, u);
      const c = CANDIDATES[u];
      await this.app.say([{ who: u, text: c.farewell, expr: 'worry' }, { who: u, text: c.legacy.line, expr: 'relief' }]);
      toast(this.app.el.toast, `받은 물건: ${c.legacy.name} (${c.legacy.kg}kg) · 다음 장의 짐 후보가 돼요`);
    }
    await infoPanel(this.app.modals, '탑승 기록', [
      `아크-06 탑승: 담(조종사), ${this.m.player.name}(시민 대표), ${this.names(crew)}`,
      `탑승하지 못한 두 사람: ${this.names(out)}`,
      `남겨진 물건: ${out.map((u) => CANDIDATES[u].legacy.name).join(', ')}`,
      '그들의 이후는 알 수 없어요.',
    ], '계속');
    this.busy = false;
    this.app.mission.dispatch({ type: 'goto', fsm: 'c1_seating' });
    await this.seating();
  }

  private async seating(): Promise<void> {
    this.busy = true;
    this.app.openOpp('C1-O05');
    this.refreshHud();
    const crew = this.m.crewIds;
    if (this.m.flags.c1_belt_checked !== true) {
      const id = await this.app.fork({
        opp: 'C1-O03', dim: 'C', optionSetId: 'c1-belt-check', scene: 'C1 탑승 직전 좌석 점검',
        line: { who: 'noknok', text: '녹녹! 좌석 벨트 여섯 개, 자동 점검 완료! 모두 정상이에요.' },
        options: [
          { id: 'go', label: '자동 점검 결과로 바로 진행', pole: -1 },
          { id: 'check', label: '벨트 상태 내가 한 번 더 확인', pole: 1 },
        ],
      });
      this.flag('c1_belt_checked');
      if (id === 'check') {
        await infoPanel(this.app.modals, '좌석 점검표', [
          '1~6번 좌석 벨트 잠금: 정상',
          '머리 받침 각도: 정상',
          '비상 산소 마스크 위치: 좌석 위 수납함',
          '녹녹이 메모: 이륙 직후에는 뜨거운 음료를 들지 마세요. 녹차 포함.',
        ], '확인했어요');
      } else {
        await this.app.say([{ who: 'noknok', text: '네! 다음으로 넘어갈게요.' }]);
      }
    }
    this.app.closeOpp('C1-O03');
    const who = pickSpeaker('c1SeatRequest', crew);
    const info = this.app.speaker(who);
    const decision = await perspectivePanel(this.app.modals, {
      title: '좌석 배치 요청',
      portrait: info.look ? pxImg(portraitURL(info.look, 'worry'), info.name, 'mini') : null,
      who: info.name,
      request: '저기... 창가 말고 통로 쪽에 앉아도 될까? 이륙할 때 창밖을 보면 마음이 자꾸 흔들릴 것 같아서.',
      info: [
        { key: 'T', label: '좌석 균형 수치 보기', lines: ['기본 배치: 이륙 때 좌우 질량 차 0.4 (허용 1.0 이하)', '요청대로 바꾸면: 좌우 질량 차 0.6 (허용 범위 안)', '두 배치 모두 안전 기준을 만족해요.'] },
        { key: 'F', label: '승무원 요청 메모 보기', lines: [`${info.name}: 창가에서 이륙 장면을 보면 불안해질 것 같다고 적었다.`, '다른 승무원들: 어느 자리든 괜찮다고 적었다.', '두 배치 모두 안전 기준을 만족해요.'] },
      ],
      infoOrder: this.app.order('c1-seat-info', 2),
      decisions: [
        { id: 'adjust', label: '요청대로 좌석 조정하기' },
        { id: 'keep', label: '기본 배치 유지하고 이유 설명하기' },
      ],
      decisionOrder: this.app.order('c1-seat-decision', 2),
      onInfo: (key, pos, first) => this.app.recordAct({
        opportunityId: 'C1-O05', dim: 'TF', kind: 'tab', pole: key === 'F' ? 1 : -1,
        actKey: first ? 'seat-info:first' : `seat-info:${key}:more`, secondary: !first,
        displayPosition: pos, optionSetId: 'c1-seat-info', label: key === 'F' ? '승무원 요청 메모 먼저' : '좌석 균형 수치 먼저',
        otherLabel: key === 'F' ? '좌석 균형 수치' : '승무원 요청 메모', scene: 'C1 좌석 배치 요청',
      }),
      onDecide: (id, pos) => this.app.recordAct({
        opportunityId: 'C1-O05', dim: 'A', kind: 'fork', pole: id === 'adjust' ? 1 : -1, actKey: 'fork:c1-seat',
        displayPosition: pos, optionSetId: 'c1-seat-decision', label: id === 'adjust' ? '요청대로 좌석 조정' : '기본 배치 유지하고 이유 설명',
        otherLabel: id === 'adjust' ? '기본 배치 유지하고 이유 설명' : '요청대로 좌석 조정', scene: 'C1 좌석 배치 요청',
      }),
    });
    if (decision === 'adjust') {
      await this.app.say([{ who, text: '고마워. 이륙할 때 눈 꼭 감고 있을게.', expr: 'relief' }]);
    } else {
      await this.app.say([
        { who: 'dam', text: '기본 배치가 이륙 때 무게 균형이 제일 안정적이라서 그래.' },
        { who, text: '아, 그런 이유면 납득돼. 괜찮아. 창밖은 안 보면 되지.', expr: 'relief' },
      ]);
    }
    this.app.closeOpp('C1-O05');
    this.flag('c1_seated');
    this.busy = false;
    this.app.mission.dispatch({ type: 'goto', fsm: 'c1_depart' });
    await this.depart();
  }

  private async depart(): Promise<void> {
    const s = this.scene;
    if (!s) return;
    this.busy = true;
    s.setCutscene(true);
    s.setInteractables([]);
    s.setHatch(true);
    await this.app.say([
      { who: 'boram', text: '탑승구 연다. ...잘 가.' },
      { who: 'noknok', text: '녹녹! 아크-06 탑승을 시작합니다.' },
    ]);
    const crew = this.m.crewIds;
    await Promise.all(crew.map(async (id, i) => {
      await wait(i * 260);
      await s.walkActor(id, 520, 330 + i * 6, 1500);
      await s.walkActor(id, 600, 384, 900);
      s.removeActor(id);
    }));
    await s.walkActor('dam', 520, 330, 1300);
    await s.walkActor('dam', 600, 384, 800);
    s.removeActor('dam');
    await this.app.say([
      { who: 'narrator', text: '담의 손목에서 낡은 팔찌가 잠깐 반짝인다. 숫자 04. 탑승하지 못한 두 사람이 멀리서 손을 든다.' },
    ]);
    await s.walkActor('player', 520, 330, 1200);
    await s.walkActor('player', 600, 384, 800);
    await s.fadeOut(800);
    this.busy = false;
    this.app.mission.dispatch({ type: 'goto', fsm: 'c2_cargo' });
    void this.app.beginC2();
  }
}
