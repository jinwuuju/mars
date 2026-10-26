import type { App } from './app';
import { Explore, type Spot } from './explore';
import { react } from './gags';
import { applyOnce, askFork, infoTabs, reflect, rememberLost, requestPanel, sacrificeStep } from './common';
import { iGa } from '../story/josa';
import { aliveCrew } from '../story/sacrifice';
import { talkLines } from './c2';
import type { BunkerScene } from '../world/BunkerScene';
import { CANDIDATES } from '../story/candidates';
import { E, C7_TARGET, podItems } from '../story/effects';
import { pickSpeaker } from '../story/resolver';
import { TALK } from '../story/talk';
import { gridRoute, orderPuzzle, simpleList } from '../ui/mini';
import { ignitionGame } from '../ui/ignition';
import { layerMap } from '../ui/layerMap';
import { scalePanel, type Voice } from '../ui/scale';
import { portraitURL } from '../art/sprites';
import { NPC_LOOKS } from '../art/look';
import { C7_MAP, C7_SPOTS } from '../art/maps';
import { CHAPTER_TITLE, isCandidateId, type CandidateId, type SpeakerId } from '../shared/ids';

const OPPS = ['C7-O01', 'C7-O02', 'C7-O03', 'C7-O04', 'C7-O05'];
const TARGET_CELL: Record<string, string> = { ice: '0,3', ilkkun: '0,1', third: '1,3' };
const GUIDE: Record<string, string[]> = {
  ice: ['2,0', '2,1', '2,2', '2,3', '1,3', '0,3'],
  ilkkun: ['2,0', '1,0', '0,0', '0,1'],
  third: ['2,0', '2,1', '2,2', '2,3', '1,3'],
};

/** C7 · BELOW THE RED — 로버 격납고 탐색, 탐사 지도(레이어), 저울 7, 로버 경로, 시추, 정수 체인 */
export class C7Flow {
  private readonly app: App;
  private explore: Explore | null = null;
  private scene: BunkerScene | null = null;
  private unsub: (() => void) | null = null;

  constructor(app: App) {
    this.app = app;
  }

  private get m() {
    return this.app.mission.state;
  }

  private flag(key: string, value: string | number | boolean = true): void {
    this.app.mission.dispatch({ type: 'flag', key, value });
  }

  private has(key: string): boolean {
    return this.m.flags[key] === true;
  }

  private get target(): string | null {
    return typeof this.m.flags.c7_target === 'string' ? this.m.flags.c7_target : null;
  }

  private get pod(): boolean {
    return podItems(this.m.flags).length > 0;
  }

  start(): void {
    const crew = aliveCrew(this.m);
    this.unsub = this.app.mission.subscribe(() => this.hud());
    this.explore = new Explore(this.app, {
      map: C7_MAP,
      start: C7_SPOTS.start,
      actors: () => [
        ...crew.map((id, i) => ({ id, look: CANDIDATES[id].look, x: C7_SPOTS.crew[i].x, y: C7_SPOTS.crew[i].y, name: CANDIDATES[id].name })),
        { id: 'dam', look: NPC_LOOKS.dam, x: C7_SPOTS.dam.x, y: C7_SPOTS.dam.y, name: '담' },
      ],
      spots: () => this.spots(),
      onInteract: (id) => this.interact(id),
      onReady: (s) => {
        this.scene = s;
        if (this.m.flags.ilkkun === true) s.addProp('ilkkun', 150, 206, 18, 10, 0xc9a43a);
        if (this.has('c7_drilled') && this.target !== 'ilkkun') s.addProp('ice', 100, 228, 10, 8, 0xcfeff0);
        void this.explore?.run(async () => {
          await this.intro();
          // 정수 직후 새로고침했다면 물 배분 요청부터 이어 간다(공용실 문은 그 요청이 끝나야 열린다)
          if (this.has('c7_purified') && !this.has('ask_c7-water')) await this.waterRequest();
        });
      },
    });
    this.explore.start();
    this.hud();
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
    this.explore?.stop();
  }

  private hud(): void {
    if (this.m.chapter !== 'C7') return;
    this.app.hud.setTop(`C7 · ${CHAPTER_TITLE.C7}`, null);
    this.app.hud.setResources(this.m.resources);
    this.app.hud.setObjectives('얼음 아래의 물', [
      { text: '탐사 단말에서 목적지 정하기', done: this.target !== null, spot: 'terminal' },
      { text: '로버 탐사', done: this.has('c7_drilled'), spot: 'rover' },
      { text: '정수 장치에서 첫 물 만들기', done: this.has('c7_purified'), spot: 'purifier' },
      { text: '공용실로', done: this.has('c7_done'), spot: 'airlock' },
    ]);
  }

  private spots(): Spot[] {
    const crew = aliveCrew(this.m);
    return [
      ...crew.map((id, i) => ({ id, ...C7_SPOTS.crew[i], r: 26, label: CANDIDATES[id].name, verb: '이야기하기' })),
      { id: 'dam', ...C7_SPOTS.dam, r: 26, label: '담', verb: '이야기하기' },
      { id: 'terminal', ...C7_SPOTS.terminal, r: 32, label: '탐사 단말', verb: this.target ? '살펴보기' : '지도 열기', tag: true },
      { id: 'rover', ...C7_SPOTS.rover, r: 36, label: '탐사 로버', verb: this.target && !this.has('c7_drilled') ? '출발하기' : '살펴보기', tag: true },
      { id: 'bench', ...C7_SPOTS.bench, r: 30, label: '샘플 작업대', verb: '살펴보기', tag: true },
      { id: 'purifier', ...C7_SPOTS.purifier, r: 32, label: '정수 장치', verb: this.has('c7_drilled') && !this.has('c7_purified') ? '정수하기' : '살펴보기', tag: true },
      { id: 'airlock', ...C7_SPOTS.airlock, r: 30, label: '공용실 문', verb: '들어가기', tag: true, when: () => this.has('ask_c7-water') },
    ];
  }

  private voice(list: { who: CandidateId; text: string }[], fb: [SpeakerId, string]): Voice {
    const hit = list.find((v) => aliveCrew(this.m).includes(v.who));
    const [who, text] = hit ? [hit.who as SpeakerId, hit.text] : fb;
    const info = this.app.speaker(who);
    return { name: info.name, portrait: info.look ? portraitURL(info.look, 'worry') : info.icon ?? null, text };
  }

  private async intro(): Promise<void> {
    await rememberLost(this.app, 'C6');
    if (this.has('c7_intro')) return;
    await this.app.say([
      { who: 'mirror', text: '물 회수는 정상입니다. 하지만 장기적으로는 부족합니다. 물 확보 지수가 낮아요.' },
      this.m.flags.c4_ark_choice === 'supply'
        ? { who: 'mirror', text: '4장에서 보급 캡슐로 물을 나눠 준 만큼 저장량이 빠듯합니다. 이번 탐사가 그 몫을 메워야 합니다.' }
        : { who: 'mirror', text: '돔의 재활용만으로는 여섯 명분을 오래 못 버팁니다. 땅 밑의 얼음이 필요합니다.' },
      { who: 'mirror', text: '로버 배터리는 이번 솔에 장거리 한 번 분량입니다. 탐사 단말에서 지도를 보세요.' },
    ]);
    OPPS.forEach((id) => this.app.openOpp(id));
    this.flag('c7_intro');
    await reflect(this.app, 'C7');
  }

  private async interact(id: string): Promise<void> {
    const app = this.app;
    if (isCandidateId(id) || id === 'dam') {
      const key = `talk_c7_${id}`;
      const list = TALK.C7[id] ?? [];
      await app.say(talkLines(id, this.has(key) ? list.slice(-1) : list));
      this.flag(key);
      return;
    }
    switch (id) {
      case 'terminal': if (!this.target) await this.chooseTarget(); else await app.say([{ who: 'narrator', text: '지도 위, 일꾼-3의 심박 신호가 37분마다 한 번 깜박인다.' }]); return;
      case 'rover': if (this.target && !this.has('c7_drilled')) await this.drive(); else await app.say([{ who: 'narrator', text: this.target ? '로버 바퀴에 붉은 먼지가 잔뜩 묻어 있다.' : '로버가 충전 중이다. 목적지를 먼저 정해야 한다.' }]); return;
      case 'bench': await app.say([{ who: 'narrator', text: this.has('c7_drilled') && this.target !== 'ilkkun' ? '작업대 위 얼음 샘플이 크리스털처럼 반짝인다.' : '빈 샘플 용기들이 줄지어 있다.' }]); return;
      case 'purifier': if (this.has('c7_drilled') && !this.has('c7_purified')) await this.purify(); else if (this.has('c7_purified') && !this.has('ask_c7-water')) await this.waterRequest(); else await app.say([{ who: 'narrator', text: '정수 장치의 필터 칸이 비어 있다.' }]); return;
      case 'airlock': await this.finish(); return;
      default:
    }
  }

  private async chooseTarget(): Promise<void> {
    const app = this.app;
    const podList = podItems(this.m.flags);
    const pod = podList.length > 0;
    await layerMap(app.modals, {
      thirdLabel: pod ? '포드' : '근거리',
      onData: () => void infoTabs(app, {
        opp: 'C7-O01', setId: 'c7-layers', title: '지질 레이어', scene: 'C7 지질 레이어 자료',
        sLabel: '레이어 원값', sLines: ['레이더 반사: 얼음 지대 0.95 (가장 강함)', '경사: 중앙 협곡 0.9 (급경사)', '일꾼-3 심박 신호: 37분마다 1회'],
        nLabel: '얼음 분포 추정 모델', nLines: ['모델: 얼음 확률 70~85% — 가능성이지 확정이 아니다', '시나리오: 1.5m 아래 얼음층이 있다면 수년치 물', '일꾼-3의 저장 장치에 16년 공사 기록이 남아 있을 수 있다'],
      }),
    });
    await app.say([
      { who: 'mirror', text: '...일꾼-3은 제 공사 동료였어요. 2년 전 폭풍에 멈췄어요. 그 아이를 데려와 줄 수 있나요?' },
      { who: 'dam', text: '로버 배터리로는 한 곳만 갈 수 있어.' },
    ]);
    const third = pod
      ? { id: 'third', title: '화물 포드 회수', desc: 'C5에서 분리한 화물 포드를 찾아 짐을 되찾는다. 모두가 가방을 여는 장면.', cost: '대가: 얼음 탐사 기회와 일꾼-3', support: this.voice([{ who: 'harin', text: '그 짐 안에 우리가 고른 게 다 있어.' }, { who: 'dodam', text: '맡긴 물건들을 되찾아요.' }], ['noknok', '포드 위치는 알아요!']), worry: this.voice([{ who: 'taeo', text: '물이 먼저야.' }, { who: 'woojoo', text: '얼음은...?' }], ['dam', '물은 다음으로 미뤄야 해.']) }
      : { id: 'third', title: '근거리 저신호 얼음 지대', desc: '가깝고 안전하지만 얼음 신호가 약한 지대.', cost: '대가: 적은 물 확보', support: this.voice([{ who: 'seojin', text: '안전한 쪽부터.' }, { who: 'taeo', text: '가까우면 실수도 적어.' }], ['dam', '로버를 아끼는 길이야.']), worry: this.voice([{ who: 'woojoo', text: '물이 조금밖에 안 나오면...' }, { who: 'jio', text: '일꾼-3은요?' }], ['noknok', '물이 적을 수 있어요.']) };
    const target = await scalePanel(app.modals, {
      title: '저울 · 얼음이냐 메아리냐',
      subtitle: '로버는 한 곳만 갈 수 있다. 무엇을 데려오고, 무엇을 두고 올까? (성격 결과에 쓰이지 않아요)',
      options: [
        { id: 'ice', title: '고신호 얼음 지대', desc: '얼음 확률이 높은 먼 지대. 물을 확보할 가장 큰 기회.', cost: '대가: 일꾼-3과 그 기록', support: this.voice([{ who: 'taeo', text: '물이 있어야 다 있어.' }, { who: 'woojoo', text: '물이면 밭이 생겨!' }], ['dam', '살아남는 데엔 물이 먼저야.']), worry: this.voice([{ who: 'jio', text: '일꾼-3은 MIRROR의 친구였어요.' }, { who: 'dodam', text: '그 기록은 영영 묻혀요.' }], ['noknok', '선배님이 슬퍼할 거예요.']) },
        { id: 'ilkkun', title: '일꾼-3 회수', desc: '멈춘 건설 로봇을 데려온다. 드릴 헤드와 16년 건설 기록, MIRROR의 동료. 근처에서 얼음도 조금 얻는다.', cost: '대가: 큰 물 확보 기회', support: this.voice([{ who: 'jio', text: '저 로봇, 데려와야 해요.' }, { who: 'dodam', text: '기록이 살아 있어요.' }], ['mirror', '...부탁드려요.']), worry: this.voice([{ who: 'taeo', text: '물보다 로봇이 먼저야?' }, { who: 'seojin', text: '물 숫자가 모자라.' }], ['dam', '물은 조금밖에 못 얻어.']) },
        third,
      ],
    });
    const crew = aliveCrew(this.m);
    const eva = await app.choose({ who: 'dam', text: '로버만 보낼까, 사람이 같이 갈까? 같이 가면 돌아오는 길에 한 곳을 더 들를 수 있어. 대신 식량이 들고, 많이 지칠 거야.' }, [
      { id: 'no', label: '로버만 보내기' }, { id: 'yes', label: '사람이 동행하기' },
    ]);
    // 목적지와 동행을 다 고른 뒤 한 번에 확정한다. 예전에는 동행 질문 도중 새로고침하면 동행 선택이 영영 빠졌다.
    applyOnce(app, 'c7target', E.c7Target(target as (typeof C7_TARGET)[number], { gamma: this.m.flags.c5_site === 'gamma', pod }));
    if (target === 'third' && pod) app.mission.dispatch({ type: 'setInventory', items: [...this.m.inventoryIds, ...podList.filter((i) => !this.m.inventoryIds.includes(i))] });
    this.flag('c7_target', target);
    react(this.scene, crew, 'target', target === 'third' ? (pod ? 'third' : 'near') : target);
    applyOnce(app, 'c7eva', E.c7Eva(eva === 'yes'));
    this.flag('c7_eva', eva);
    await app.say([
      ...(crew.includes('jio') ? [{ who: 'jio' as const, text: '제가 만든 로버가 먼저 가요. 사람은 두 번째로.' }] : []),
      target === 'ilkkun' ? { who: 'mirror', text: '고맙습니다. ...정정. 정말 고맙습니다.' } : { who: 'mirror', text: '알겠습니다. 그 아이 신호는 계속 듣고 있을게요.' },
      { who: 'noknok', text: '로버에서 출발해요!' },
    ]);
  }

  private async drive(): Promise<void> {
    const app = this.app;
    const crew = aliveCrew(this.m);
    const target = this.target ?? 'ice';
    const jp = await askFork(app, { opp: 'C7-O03', dim: 'JP', optionSetId: 'c7-plan', scene: 'C7 탐사를 시작할 때', line: { who: 'noknok', text: '탐사를 어떻게 시작할까요?' }, plus: '탐사 계획서 먼저', minus: '가면서 판단' });
    if (jp === 'plus') await simpleList(app.modals, '탐사 계획서', ['1. 경로 확정', '2. 경사 점검', '3. 시추·회수', '4. 귀환'], '이대로');
    else if (jp === 'minus') await app.say([{ who: 'noknok', text: '좋아요, 보면서 가요!' }]);
    const v = await askFork(app, { opp: 'C7-O02', dim: 'O', optionSetId: 'c7-route', scene: 'C7 로버 경로를 정할 때', line: { who: 'mirror', text: '경로를 정하세요. 표준 경로와 직접 설계는 걸리는 시간이 같습니다.' }, plus: '직접 새 경로 설계', minus: 'MIRROR 표준 경로' });
    const so = await askFork(app, { opp: 'C7-O04', dim: 'E', optionSetId: 'c7-drive', scene: 'C7 로버 운전 중', line: { who: 'noknok', text: '운전하는 동안은요?' }, plus: '동료와 무전으로 상의하며 운전', minus: '혼자 조용히 운전' });
    if (so === 'plus') await app.say([{ who: pickSpeaker('c4Talk', crew), text: '왼쪽 바위 조심해! ...아, 이미 피했구나.' }, { who: 'narrator', text: '무전기 너머로 안도의 웃음.' }]);
    else if (so === 'minus') await app.say([{ who: 'narrator', text: '바퀴 소리와 숨소리만 들린다.' }, { who: 'narrator', text: '붉은 지평선이 천천히 다가온다.' }]);
    await gridRoute(app.modals, {
      title: '로버 경로 (턴제 격자, 배터리 7칸)', cols: 4, rows: 3, slopes: ['1,1', '0,2'], start: '2,0', target: TARGET_CELL[target] ?? '1,3', battery: 7,
      guide: (v ?? app.forkMemo('c7-route')) === 'plus' ? null : GUIDE[target] ?? GUIDE.third,
    });
    if (crew.includes('jio')) await app.say([{ who: 'narrator', text: '로버 경고등이 깜빡인다.' }, { who: 'jio', text: '괜찮아요, 아마도... 아니, 이번엔 경고를 믿을게요.' }]);
    const c = await askFork(app, { opp: 'C7-O03', dim: 'C', optionSetId: 'c7-slope', scene: 'C7 시추 전 경사 점검', line: { who: 'noknok', text: '자동 경사 체크 완료! 시추 가능해요.' }, plus: '수동으로 한 번 더 확인', minus: '자동 경사 체크 수용' });
    if (c === 'plus') await simpleList(app.modals, '경사 점검', ['로버 기울기 4° (기준 이하)', '바퀴 고정 정상'], '확인했어요');
    else if (c === 'minus') await app.say([{ who: 'noknok', text: '시추 시작!' }]);
    if (target === 'ilkkun') {
      await app.say([{ who: 'narrator', text: '모래 속에서 노란 로봇이 끌려 나온다. 다리 여섯 개 중 넷이 움직인다.' }, { who: 'narrator', text: '삑... 삑...' }]);
    } else {
      await ignitionGame(app.modals, { reduced: app.reduced, rough: false, title: '시추 — 토크·온도', holdLabel: '드릴 누르기', stageHint: '바늘을 초록 띠 안에 (너무 세면 과열)', onShake: () => this.scene?.shake(300, 0.003) });
      await app.say(target === 'third' && this.m.flags.pod_recovered === true
        ? [{ who: 'narrator', text: '찌그러진 화물 포드 안에서 봉인된 짐이 그대로 나온다. 모두가 가방을 연다.' }, { who: 'noknok', text: '하나도 안 깨졌어요!' }]
        : [{ who: 'narrator', text: '드릴 끝에 하얀 가루가 묻어 나온다. 얼음이다.' }, ...talkLines('noknok', TALK.C7.noknok ?? [])]);
    }
    this.flag('c7_drilled');
    if (target === 'ilkkun') {
      this.scene?.addProp('ilkkun', 150, 206, 18, 10, 0xc9a43a);
      await app.say([{ who: 'mirror', text: '...일꾼-3. 다시 만나서 반가워요.' }, { who: 'narrator', text: 'MIRROR의 도트 얼굴이 웃는다.' }, { who: 'noknok', text: '저한테도 형이 생겼어요.' }]);
    } else {
      this.scene?.addProp('ice', 100, 228, 10, 8, 0xcfeff0);
      await app.say([{ who: 'mirror', text: '괜찮아요. 저 아이는 기다리는 걸 잘해요.' }, { who: 'narrator', text: '지도 위 심박 신호는 계속 깜박인다.' }]);
    }
    // 희생: 돌아오는 길, 윈치를 붙잡을 사람(이야기 전용)
    await sacrificeStep(app, 'C7', this.scene, C7_SPOTS.rover);
    const lost7 = this.m.flags.lost_C7;
    await app.say([typeof lost7 === 'string' && lost7 in CANDIDATES
      ? { who: 'noknok', text: `...정수 장치로 가요. ${iGa(CANDIDATES[lost7 as CandidateId].name)} 지켜 준 얼음이에요. 마실 수 있는 물로 만들어야 해요.` }
      : { who: 'noknok', text: '정수 장치로 가요. 얼음을 찾았다고 바로 마실 수 있는 건 아니에요!' }]);
  }

  private async purify(): Promise<void> {
    const app = this.app;
    await sacrificeStep(app, 'C7', this.scene, C7_SPOTS.rover); // 시추 직후 새로고침했다면 여기서 이어 간다(이미 정했으면 아무 일도 없다)
    const crew = aliveCrew(this.m);
    if (crew.includes('woojoo')) await app.say([{ who: 'woojoo', text: '첫 물로 녹차 우리면 안 돼?' }, { who: 'noknok', text: '수질 검사부터요! 얼음물엔 먼지랑 과염소산염 같은 불순물이 있어요.' }]);
    else await app.say([{ who: 'noknok', text: '얼음물엔 먼지랑 과염소산염 같은 불순물이 있어요. 거르고 검사해야 마실 수 있어요.' }]);
    const hasFilter = this.m.inventoryIds.includes('filter');
    const steps = hasFilter
      ? [{ id: 'melt', label: '얼음 녹이기' }, { id: 'settle', label: '먼지 침전' }, { id: 'filter', label: '정수 필터(과염소산염 포함)' }, { id: 'test', label: '수질 검사' }, { id: 'store', label: '저장' }]
      : [{ id: 'melt', label: '얼음 녹이기' }, { id: 'settle', label: '먼지 침전' }, { id: 'cloth', label: '천으로 1차 거르기' }, { id: 'chem', label: '과염소산염 제거' }, { id: 'test', label: '수질 검사' }, { id: 'store', label: '저장' }];
    if (hasFilter) await app.say([{ who: 'noknok', text: '가져온 정수 필터 덕분에 한 단계를 줄였어요!' }]);
    await orderPuzzle(app.modals, { title: '첫 물 정수', intro: '정수 단계를 순서대로 누르세요.', items: [...steps].reverse(), correct: steps.map((s) => s.id), hint: '녹녹이: 검사는 거른 다음에, 저장은 맨 마지막에요!' });
    this.flag('c7_purified');
    await this.waterRequest();
  }

  /** 첫 물 배분 요청(관점 패널) → 공용실 문이 열린다. 정수 직후 새로고침해도 여기서 다시 이어진다. */
  private async waterRequest(): Promise<void> {
    const app = this.app;
    await requestPanel(app, {
      opp: 'C7-O05', setId: 'c7-water', slot: 'c7Water', title: '물 배분 요청', scene: 'C7 첫 물 배분 요청',
      request: '첫 물 일부를 재배 실험용으로 먼저 써도 될까? 화분 하나에만.',
      tLabel: '물 수지 수치 보기', tLines: ['오늘 확보량: 식수·재배 모두 안전 총량 안', '어느 쪽에 먼저 써도 내일 계획은 같다'],
      fLabel: '동료 요청 메모 보기', fLines: ['첫 물을 첫 싹에 주고 싶다고 적었다.', '다른 승무원: 순서는 상관없다고 적었다.'],
      adjust: '요청대로 배분 조정하기', keep: '원안 유지하고 이유 설명하기',
      adjustReply: '고마워. 이 화분, 오늘부터 이름 붙여 줄 거야.', keepReason: '첫 물은 수질 기록용으로 식수 탱크에 먼저 넣어야 해요. 두 번째 컵은 화분 거예요.',
    });
    OPPS.forEach((oid) => app.closeOpp(oid));
    await app.say([{ who: 'mirror', text: '공용실에 저녁을 준비해 두었습니다. 정정. 테이블만 준비해 두었습니다.' }]);
  }

  private async finish(): Promise<void> {
    OPPS.forEach((oid) => this.app.closeOpp(oid)); // 이미 닫혔으면 아무 일도 없다
    this.flag('c7_done');
    this.app.mission.dispatch({ type: 'goto', fsm: 'c8_play' });
    void this.app.beginChapter(8);
  }
}
