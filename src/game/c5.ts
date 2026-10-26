import type { App } from './app';
import { Explore, type Spot } from './explore';
import { applyOnce, askFork, crewPick, infoTabs, reflect, requestPanel, sacrificeStep } from './common';
import { aliveCrew } from '../story/sacrifice';
import { talkLines } from './c2';
import type { BunkerScene } from '../world/BunkerScene';
import type { StageScene } from '../world/StageScene';
import { CANDIDATES } from '../story/candidates';
import { E, C5_GUST, C5_SITE } from '../story/effects';
import { resolveRole } from '../story/resolver';
import { iGa } from '../story/josa';
import { TALK } from '../story/talk';
import { simpleList } from '../ui/mini';
import { descentGame, landingMap } from '../ui/descent';
import { scalePanel, type Voice } from '../ui/scale';
import { h, clear } from '../ui/dom';
import type { ModalHandle } from '../ui/panels';
import { portraitURL } from '../art/sprites';
import { NPC_LOOKS } from '../art/look';
import { C5_MAP, C5_SPOTS } from '../art/maps';
import { CHAPTER_TITLE, isCandidateId, type CandidateId, type SpeakerId } from '../shared/ids';

const OPPS = ['C5-O01', 'C5-O02', 'C5-O03', 'C5-O04', 'C5-O05'];
const DIST: Record<string, number> = { alpha: 300, beta: 4200, gamma: 1800 };
/** 도보 체크포인트(지도 x좌표): 표지판·사고·대열 요청·지구 쪽 바라보기 */
const CP = [
  { id: 'cp1', x: 300, y: 170, label: '표지판 1' },
  { id: 'cp2', x: 520, y: 176, label: '미끄러운 비탈' },
  { id: 'cp3', x: 690, y: 170, label: '표지판 2' },
  { id: 'cp4', x: 860, y: 176, label: '언덕 마루' },
] as const;

/** C5 · TOUCHDOWN — 착륙선(지도·저울 5·강하·돌풍) → 우주복 점검 → 화성 표면 도보 → 제로돔 에어록 */
export class C5Flow {
  private readonly app: App;
  private explore: Explore | null = null;
  private scene: BunkerScene | null = null;
  private unsub: (() => void) | null = null;
  private poll: number | undefined;

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

  start(): void {
    this.unsub = this.app.mission.subscribe(() => this.hud());
    this.hud();
    if (!this.has('c5_landed')) {
      this.app.startScene('stage', {
        kind: 'ship', crew: aliveCrew(this.m), playerLook: this.app.playerLook(), reduced: this.app.reduced, props: {},
        onReady: (s: StageScene) => void this.approach(s),
      });
      this.app.hud.show(true);
    } else this.surface();
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
    window.clearInterval(this.poll);
    this.explore?.stop();
  }

  private hud(): void {
    if (this.m.chapter !== 'C5') return;
    this.app.hud.setTop(`C5 · ${CHAPTER_TITLE.C5}`, null);
    this.app.hud.setResources(this.m.resources);
    this.app.hud.setObjectives('붉은 행성에 첫발', [
      { text: '착륙지 정하기', done: typeof this.m.flags.c5_site === 'string' },
      { text: '강하와 착륙', done: this.has('c5_landed') },
      { text: '우주복 점검', done: this.has('c5_suited') },
      { text: `제로돔 에어록까지 걷기 (${this.distance().toLocaleString()}m)`, done: this.has('c5_done'), spot: CP.find((cp) => !this.has(`c5_${cp.id}`))?.id ?? 'airlock' },
    ]);
  }

  private distance(): number {
    return (DIST[String(this.m.flags.c5_site ?? 'beta')] ?? 300) + (this.m.flags.c5_gust === 'divert' ? 1500 : 0);
  }

  private voice(list: { who: CandidateId; text: string }[], fb: [SpeakerId, string]): Voice {
    const hit = list.find((v) => aliveCrew(this.m).includes(v.who));
    const [who, text] = hit ? [hit.who as SpeakerId, hit.text] : fb;
    const info = this.app.speaker(who);
    return { name: info.name, portrait: info.look ? portraitURL(info.look, 'worry') : info.icon ?? null, text };
  }

  // ---------- 착륙선 ----------
  private async approach(stage: StageScene): Promise<void> {
    const app = this.app;
    await app.say([
      { who: 'narrator', text: '창밖이 붉게 커진다. 화성이다.' },
      { who: 'mirror', text: 'MIRROR입니다. 환영합니다. 정정. ...반갑습니다.' },
      { who: 'noknok', text: '저도 반가워요! ...저한테 한 말은 아니죠?' },
      this.m.flags.c4_ark_choice === 'supply'
        ? { who: 'mirror', text: '보급 캡슐로 물과 산소를 나눠 주셨군요. 그만큼 착륙 뒤 여유가 적습니다. 아크-04는 캡슐을 받았다고 답했습니다.' }
        : this.m.flags.c4_ark_choice === 'rendezvous'
          ? { who: 'mirror', text: '랑데부로 연료를 써서 도착이 3일 늦었고, 협곡 착륙장은 갈 수 없습니다. 담 씨의 팔찌와 같은 번호를, 저도 봤습니다.' }
          : { who: 'mirror', text: '보내 주신 항로 데이터로 아크-04의 궤도를 다시 계산하고 있습니다. 답은 아직 없습니다.' },
      { who: 'mirror', text: '참고로 탑승 추첨 기록에 서명 없는 수정 시도가 1회 있습니다. 정정. 지금 중요한 얘기는 아닙니다.' },
    ]);
    await reflect(app, 'C5');
    OPPS.forEach((id) => app.openOpp(id));
    const fuel = this.m.resources.fuelMargin;
    if (typeof this.m.flags.c5_site !== 'string') {
      await landingMap(app.modals, {
        sites: [
          { id: 'alpha', name: 'α MIRROR 지정 착륙장', dist: '300m (준비된 도로)', slope: '3°', note: '지형 자료가 16년 전 기준이다.', x: 128, y: 62 },
          { id: 'beta', name: 'β 평원', dist: '4.2km (도보 + 보조 수레)', slope: '1°', note: '가장 평탄하고, 지금 센서가 안전하다고 본다.', x: 60, y: 140 },
          { id: 'gamma', name: 'γ 협곡 가장자리', dist: '1.8km', slope: '7°', note: '얼음 신호가 강한 지대와 가깝다.', x: 205, y: 100, disabled: fuel < 2 ? '랑데부로 연료 여유가 줄어 이번에는 갈 수 없어요.' : undefined },
        ],
        onData: () => void infoTabs(app, {
          opp: 'C5-O01', setId: 'c5-sites', title: '착륙 후보 자료', scene: 'C5 착륙 후보 자료를 열었을 때',
          sLabel: '고도·경사 원자료', sLines: ['α 착륙장: 경사 3° · 돔까지 300m · 지형 자료 16년 전', 'β 평원: 경사 1° · 돔까지 4.2km', 'γ 협곡 가장자리: 경사 7° · 돔까지 1.8km'],
          nLabel: '지형 변화 시나리오', nLines: ['α: 16년 사이 바위가 굴러왔을 가능성', 'β: 가장 안전하지만 긴 도보', 'γ: 얼음 신호가 강한 지대와 가깝다'],
        }),
      });
      const jp = await askFork(app, { opp: 'C5-O03', dim: 'JP', optionSetId: 'c5-plan', scene: 'C5 강하를 준비할 때', line: { who: 'dam', text: '강하 준비. 어떻게 할까?' }, plus: '강하 단계 계획 먼저', minus: '상황 보며 조정' });
      if (jp === 'plus') await simpleList(app.modals, '강하 단계표', ['1. 대기권 진입 자세', '2. 낙하산 전개', '3. 역추진 착지'], '이대로');
      else if (jp === 'minus') await app.say([{ who: 'dam', text: '좋아, 흐름 보면서 맞추자.' }]);
      await askFork(app, { opp: 'C5-O02', dim: 'O', optionSetId: 'c5-profile', scene: 'C5 강하 프로파일을 고를 때', line: { who: 'noknok', text: '강하 프로파일은요? 난이도는 같아요.' }, plus: '맞춤 프로파일 시험', minus: '표준 프로파일' });
      await app.say([
        { who: 'mirror', text: 'α를 권합니다. 저는 이곳을 16년 동안 준비했어요.' },
        { who: 'dam', text: '...16년 전 지도야. 지금 센서는 β가 제일 안전하다고 하고.' },
      ]);
      const site = await scalePanel(app.modals, {
        title: '저울 · 어디에 내려앉을까',
        subtitle: '모든 후보는 돔까지 이어진다. 무엇을 믿고, 무엇을 치를까? (성격 결과에 쓰이지 않아요)',
        options: [
          { id: 'alpha', title: 'α MIRROR 지정 착륙장', desc: '돔까지 300m, 준비된 도로. 지형 자료는 16년 전 기준.', cost: '대가: 착륙 다리 손상, 착륙선 전지 회수 불가(전력 -10)', support: this.voice([{ who: 'jio', text: 'MIRROR가 16년을 준비했대요!' }, { who: 'dodam', text: '기다려 온 쪽을 믿어 보고 싶어요.' }], ['mirror', '이곳은 준비되어 있습니다.']), worry: this.voice([{ who: 'taeo', text: '16년 전 지도로 내려가는 거야.' }, { who: 'seojin', text: '숫자가 오래됐어.' }], ['dam', '바위가 굴러왔을 수도 있어.']) },
          { id: 'beta', title: 'β 평원', desc: '가장 평탄하고 지금 센서가 안전하다고 본다. 돔까지 4.2km를 걸어야 한다.', cost: '대가: 긴 도보(산소 -8)', support: this.voice([{ who: 'seojin', text: '지금 숫자가 제일 안전해.' }, { who: 'taeo', text: '평평한 데가 최고야.' }], ['dam', '조종사로선 β가 편해.']), worry: this.voice([{ who: 'harin', text: '4km를 우주복으로 걸어야 해.' }, { who: 'woojoo', text: '보온병이 그만큼 버틸까...' }], ['noknok', '표지판을 아주 많이 만들어야 해요.']) },
          { id: 'gamma', title: 'γ 협곡 가장자리', desc: '돔까지 1.8km, 경사가 있다. 얼음 신호가 강한 지대와 가깝다.', cost: '대가: 착륙 충격(선체 -5)', support: this.voice([{ who: 'woojoo', text: '물이 가까운 게 최고야!' }, { who: 'jio', text: '나중에 탐사가 쉬워져요!' }], ['noknok', '얼음 지대가 가까워요!']), worry: this.voice([{ who: 'seojin', text: '경사가 7도야.' }, { who: 'dodam', text: '흔들릴 것 같아요.' }], ['dam', '경사 착륙은 거칠어.']), disabled: fuel < 2 ? '랑데부로 연료 여유가 줄어 이번에는 협곡까지 갈 수 없어요.' : undefined },
        ],
      });
      applyOnce(app, 'c5site', E.c5Site(site as (typeof C5_SITE)[number], fuel));
      if (site !== 'alpha') stage.shake(200, 0.002);
      await app.say(site === 'alpha' ? [{ who: 'mirror', text: '감사합니다. 착륙장을 밝혀 둘게요.' }, { who: 'dam', text: '좋아, 내려간다.' }] : [{ who: 'narrator', text: 'MIRROR의 도트 얼굴이 잠깐 흔들린다.' }, { who: 'mirror', text: '...정정. 존중합니다.' }]);
    }
    const c = await askFork(app, { opp: 'C5-O03', dim: 'C', optionSetId: 'c5-check', scene: 'C5 착륙 직전 점검', line: { who: 'noknok', text: '착륙 체크 끝! 모두 정상이에요.' }, plus: '한 번 더 재검토', minus: '체크 결과로 바로 강하' });
    if (c === 'plus') await simpleList(app.modals, '착륙 재검토', ['낙하산 전개 고도 정상', '역추진 연료 정상', '좌석 벨트 정상'], '확인했어요');
    else if (c === 'minus') await app.say([{ who: 'noknok', text: '강하 시작!' }]);
    stage.shake(400, 0.004);
    await descentGame(app.modals, { reduced: app.reduced, gusty: this.m.flags.c5_site === 'gamma' });
    if (typeof this.m.flags.c5_gust !== 'string') {
      stage.shake(600, 0.008);
      const g = await app.choose({ who: 'dam', text: '돌풍이다! 안전 여유를 지키려면 둘 중 하나야.' }, [
        { id: 'pod', label: this.m.inventoryIds.length ? '화물 포드 분리 (낙하산으로 3km 밖에 따로 착지, 나중에 회수 가능)' : '화물 포드 분리 (실은 짐이 없어 빈 포드만 떨어진다)' },
        { id: 'divert', label: '대체 지점으로 선회 (도보 1.5km 추가, 산소 -8)' },
      ]);
      const hadCargo = this.m.inventoryIds.length > 0;
      applyOnce(app, 'c5gust', E.c5Gust(g as (typeof C5_GUST)[number]));
      if (g === 'pod') {
        this.flag('pod_items', JSON.stringify(this.m.inventoryIds));
        app.mission.dispatch({ type: 'setInventory', items: [] });
      }
      // 선택·짐 이동·완료 표시를 한 번에 남긴 뒤 대사를 보여 준다.
      // 예전에는 대사 뒤에 c5_gust를 남겨서, 대사 도중 새로고침하면 빈 인벤토리로 pod_items를 덮어써 짐이 사라졌다.
      this.flag('c5_gust', g);
      if (g === 'pod') await app.say([{ who: 'noknok', text: hadCargo ? '포드가 낙하산을 펴고 멀어져요. 짐은 나중에 찾으러 가야 해요.' : '빈 포드가 낙하산을 펴고 멀어져요. 실은 짐이 없어서 찾으러 갈 필요는 없어요.' }]);
    }
    await app.say([{ who: 'narrator', text: '쿵. 착륙선이 붉은 땅에 앉는다.' }, { who: 'dam', text: '...도착.' }]);
    this.flag('c5_landed');
    this.surface();
  }

  // ---------- 우주복 점검 ----------
  private suitCheck(): Promise<void> {
    return new Promise((resolve) => {
      const parts = [
        { id: 'helmet', label: '헬멧 잠금' }, { id: 'gloves', label: '장갑 밀폐' }, { id: 'tank', label: '산소 탱크 연결' }, { id: 'radio', label: '무전 확인' },
      ];
      const on = new Set<string>();
      const body = h('div', { class: 'suit' });
      const door = h('button', { class: 'btn primary', type: 'button' }, '에어록 열기');
      let handle: ModalHandle | null = null;
      const draw = (): void => {
        clear(body);
        body.append(
          h('p', {}, '바깥 대기는 아주 희박하고 대부분 이산화탄소예요. 네 항목을 모두 확인해야 문이 열려요.'),
          h('div', { class: 'choices' }, ...parts.map((p) => h('button', {
            class: `btn${on.has(p.id) ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on.has(p.id)),
            onClick: () => { if (on.has(p.id)) on.delete(p.id); else on.add(p.id); draw(); },
          }, `${on.has(p.id) ? '✓ ' : ''}${p.label}`))),
          h('p', { class: 'warn small' }, on.has('helmet') ? '' : '헬멧이 잠기지 않으면 문이 열리지 않아요.'),
        );
        door.toggleAttribute('disabled', on.size < parts.length);
      };
      door.addEventListener('click', () => { handle?.close(); resolve(); });
      draw();
      handle = this.app.modals.open({ title: '에어록 우주복 점검', body, footer: door, closable: false });
    });
  }

  // ---------- 화성 표면 도보 ----------
  private surface(): void {
    const crew = aliveCrew(this.m);
    const behind = (i: number, x: number, y: number): { x: number; y: number } => ({ x: x - 34 - (i % 2) * 22 - Math.floor(i / 2) * 22, y: y + ((i % 3) - 1) * 14 });
    this.explore = new Explore(this.app, {
      map: C5_MAP,
      start: C5_SPOTS.start,
      actors: () => [
        { id: 'dam', look: NPC_LOOKS.dam, ...behind(0, C5_SPOTS.start.x + 40, C5_SPOTS.start.y), name: '담' },
        ...crew.map((id, i) => ({ id, look: CANDIDATES[id].look, ...behind(i + 1, C5_SPOTS.start.x + 40, C5_SPOTS.start.y), name: CANDIDATES[id].name })),
      ],
      spots: () => this.surfaceSpots(),
      onInteract: (id) => this.surfaceInteract(id),
      onReady: (s) => {
        this.scene = s;
        const d = this.distance();
        s.addLabel(CP[0].x, CP[0].y - 30, `[집까지 ${Math.round(d * 0.7).toLocaleString()}m]`, 'spot');
        s.addLabel(CP[2].x, CP[2].y - 30, `[집까지 ${Math.round(d * 0.25).toLocaleString()}m]`, 'spot');
        void this.explore?.run(() => this.surfaceIntro());
      },
    });
    this.explore.start();
    this.poll = window.setInterval(() => void this.checkpoints(), 250);
  }

  private surfaceSpots(): Spot[] {
    const crew = aliveCrew(this.m);
    const pos = (id: string, fb: { x: number; y: number }): { x: number; y: number } => this.scene?.actorPos(id) ?? fb;
    return [
      { id: 'dam', ...pos('dam', C5_SPOTS.start), r: 24, label: '담', verb: '이야기하기' },
      ...crew.map((id) => ({ id, ...pos(id, C5_SPOTS.start), r: 24, label: CANDIDATES[id].name, verb: '이야기하기' })),
      { id: 'lander', ...C5_SPOTS.lander, r: 34, label: '착륙선', verb: '돌아보기' },
      ...CP.map((cp, i) => ({ id: cp.id, x: cp.x, y: cp.y, r: 36, label: cp.label, verb: '살펴보기', tag: i % 2 === 1, when: () => !this.has(`c5_${cp.id}`) && (i === 0 || this.has(`c5_${CP[i - 1].id}`)) })),
      { id: 'airlock', ...C5_SPOTS.airlock, r: 40, label: '제로돔 에어록', verb: '들어가기', tag: true, when: () => this.has('c5_cp4') },
    ];
  }

  private async surfaceIntro(): Promise<void> {
    const app = this.app;
    if (!this.has('c5_suited')) {
      await this.suitCheck();
      this.flag('c5_suited');
      await app.say([
        { who: 'noknok', text: '헬멧 확인! 여기 대기는 아주 희박하고 대부분 이산화탄소예요. 헬멧은 절대 벗으면 안 돼요!' },
        { who: 'noknok', text: '중력은 지구의 38%라서 걸음이 통통 튈 거예요.' },
        { who: 'dam', text: '밖에 사람도 없고, 나무도 없고, 바다가 없네.' },
        { who: 'noknok', text: `저는 나무는 못 만들지만... 표지판은 만들 수 있어요! [집까지 ${this.distance().toLocaleString()}m]` },
        ...(this.distance() > 2000 ? [{ who: 'noknok' as const, text: '...표지판을 더 만들어야겠어요.' }] : []),
      ]);
    }
    // 희생: 착륙선에 남을 사람(이야기 전용, 결과에 반영하지 않는다)
    await sacrificeStep(app, 'C5', this.scene, C5_SPOTS.lander);
    OPPS.forEach((id) => app.openOpp(id));
  }

  private async checkpoints(): Promise<void> {
    const s = this.scene;
    if (!s || !this.explore || this.app.isBlocked() || !this.app.debug.ready?.()) return;
    const p = s.playerPos();
    const next = CP.find((cp, i) => !this.has(`c5_${cp.id}`) && (i === 0 || this.has(`c5_${CP[i - 1].id}`)));
    if (next && p.x >= next.x - 10) await this.explore.run(() => this.cpEvent(next.id));
  }

  private async follow(): Promise<void> {
    const s = this.scene;
    if (!s) return;
    const p = s.playerPos();
    const ids = ['dam', ...aliveCrew(this.m)];
    await Promise.all(ids.map((id, i) => s.walkActor(id, Math.max(30, p.x - 34 - (i % 2) * 22 - Math.floor(i / 2) * 22), p.y + ((i % 3) - 1) * 14, 900)));
    ids.forEach((id) => s.face(id, 'right'));
  }

  private async cpEvent(id: string): Promise<void> {
    const app = this.app;
    const crew = aliveCrew(this.m);
    const s = this.scene;
    const cp = CP.find((c) => c.id === id);
    if (!cp || this.has(`c5_${id}`)) return;
    if (s && s.playerPos().x < cp.x - 10) await s.walkActor('player', cp.x, cp.y, 800);
    await this.follow();
    if (id === 'cp1') {
      await app.say([{ who: 'narrator', text: `표지판: [집까지 ${Math.round(this.distance() * 0.7).toLocaleString()}m]` }]);
      const so = await askFork(app, { opp: 'C5-O04', dim: 'E', optionSetId: 'c5-walk', scene: 'C5 우주복 도보 중', line: { who: 'noknok', text: '걷는 동안 어떻게 할까요?' }, plus: '팀 채널로 풍경 이야기', minus: '개인 기록에 혼자 메모' });
      if (so === 'plus') await app.say([{ who: 'dam', text: '저 언덕 봐. 지구에선 못 보던 색이야.' }, { who: 'narrator', text: '헬멧 너머로 웃음이 섞인 숨소리가 들린다.' }]);
      else if (so === 'minus') await app.say([{ who: 'narrator', text: '개인 기록: 첫날, 하늘은 살구색.' }, { who: 'narrator', text: '발밑의 먼지가 천천히 가라앉는다.' }]);
    } else if (id === 'cp2') {
      const hurt = crewPick(app, 'c5-injury');
      const medic = resolveRole('medic', crew);
      const inv = this.m.inventoryIds;
      s?.shake(200, 0.003);
      const steps: { who: SpeakerId | 'narrator'; text: string }[] = medic === 'seojin'
        ? [{ who: 'seojin', text: '발목 삐었어. 고정하면 걸을 수 있어. 숫자부터 보자, 통증 몇 점?' }]
        : medic === 'harin'
          ? [{ who: 'harin', text: '대피소에서 응급물품 정리하던 순서 기억나. 이걸로 고정하자.' }]
          : inv.includes('legacy_medcards')
            ? [{ who: 'noknok', text: '서진 씨가 남긴 응급 카드 3번! 발목 고정법이에요.' }]
            : inv.includes('sewing') || inv.includes('legacy_muffler')
              ? [{ who: 'noknok', text: '녹녹이 매뉴얼 12쪽! 보수 키트로 우주복 무릎을 덧대고, 발목은 구급킷으로 고정해요.' }]
              : [{ who: 'dam', text: '기본 구급킷밖에 없어. 한 단계씩 하자.' }, { who: 'narrator', text: '붕대를 감고, 부목을 대고, 한 번 더 감는다.' }];
      await app.say([{ who: 'narrator', text: `${iGa(CANDIDATES[hurt].name)} 미끄러져 발목을 삔다.` }, ...steps, { who: hurt, text: '괜찮아. 걸을 수 있어.', expr: 'relief' }]);
    } else if (id === 'cp3') {
      await app.say([{ who: 'narrator', text: `표지판: [집까지 ${Math.round(this.distance() * 0.25).toLocaleString()}m]` }]);
      await requestPanel(app, {
        opp: 'C5-O05', setId: 'c5-formation', slot: 'c5Formation', title: '대열 요청', scene: 'C5 도보 대열 요청',
        request: '나 맨 뒤에서 걸어도 될까? 사진을 좀 찍고 싶어서.',
        tLabel: '이동 동선 수치 보기', tLines: ['지금 대열: 도착 예상 시간 같음', '맨 뒤로 바꿔도 도착 시간 차이 없음'],
        fLabel: '승무원 메모 보기', fLines: ['첫 화성 풍경을 기록하고 싶다고 적었다.', '다른 승무원: 어느 대열이든 괜찮다고 적었다.'],
        adjust: '요청대로 대열 바꾸기', keep: '지금 대열 유지하고 이유 설명하기',
        adjustReply: '고마워. 이 사진, 나중에 돔 벽에 붙일게.', keepReason: '맨 뒤는 무전 중계 위치라 지금은 담 씨가 맡아야 해요. 도착하면 사진 시간 드릴게요.',
      });
    } else if (id === 'cp4') {
      crew.forEach((c) => s?.face(c, 'left'));
      s?.face('dam', 'left');
      await app.say([
        { who: 'narrator', text: '언덕 마루에서 모두가 잠깐 멈춘다. 헬멧 너머로, 같은 방향을 본다.' },
        { who: 'narrator', text: '지구 쪽. 보이지 않는 작은 점.' },
      ]);
      await app.say([{ who: 'noknok', text: '에어록이 보여요! 조금만 더!' }]);
    }
    this.flag(`c5_${id}`);
  }

  private async surfaceInteract(id: string): Promise<void> {
    const app = this.app;
    if (CP.some((c) => c.id === id)) { await this.cpEvent(id); return; }
    if (id === 'lander') { await app.say([{ who: 'narrator', text: this.m.flags.c5_site === 'alpha' ? '착륙 다리 하나가 바위에 걸려 휘어 있다.' : '착륙선이 먼지 속에 조용히 서 있다.' }]); return; }
    if (id === 'airlock') { await this.arrive(); return; }
    if (isCandidateId(id) || id === 'dam') {
      const key = `talk_c5_${id}`;
      const list = TALK.C5[id] ?? [];
      await app.say(talkLines(id, this.has(key) ? list.slice(-1) : list));
      if (id === 'woojoo' && !this.has(key)) await app.say(talkLines('noknok', TALK.C5.noknok ?? []));
      this.flag(key);
    }
  }

  private async arrive(): Promise<void> {
    const app = this.app;
    await app.say([
      { who: 'narrator', text: '제로돔 에어록이 열린다. 거울 같은 패널이 켜지고, 도트 얼굴이 처음으로 웃는다.' },
      { who: 'mirror', text: '...어서 오세요.' },
    ]);
    OPPS.forEach((oid) => app.closeOpp(oid));
    this.flag('c5_done');
    window.clearInterval(this.poll);
    app.mission.dispatch({ type: 'goto', fsm: 'c6_play' });
    void app.beginChapter(6);
  }
}
