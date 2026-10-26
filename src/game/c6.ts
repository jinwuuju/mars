import type { App } from './app';
import { Explore, type Spot } from './explore';
import { react } from './gags';
import { applyOnce, askFork, infoTabs, reflect, rememberLost, requestPanel, sacrificeStep } from './common';
import { aliveCrew } from '../story/sacrifice';
import { talkLines } from './c2';
import type { BunkerScene } from '../world/BunkerScene';
import { CANDIDATES } from '../story/candidates';
import { c6Context, E } from '../story/effects';
import { pickSpeaker } from '../story/resolver';
import { iGa } from '../story/josa';
import { TALK } from '../story/talk';
import { orderPuzzle, pickPuzzle, simpleList, tokenBoard } from '../ui/mini';
import { infoPanel } from '../ui/panels';
import { h } from '../ui/dom';
import { NPC_LOOKS } from '../art/look';
import { C6_MAP, C6_SPOTS } from '../art/maps';
import { CHAPTER_TITLE, isCandidateId, type CandidateId } from '../shared/ids';

const OPPS = ['C6-O01', 'C6-O02', 'C6-O03', 'C6-O04', 'C6-O05'];
const SEQ = {
  standard: { items: [{ id: 'purge', label: '정화(퍼지)' }, { id: 'heat', label: '전해 스택 예열' }, { id: 'start', label: '전해 시작' }, { id: 'check', label: '출력 확인' }], correct: ['purge', 'heat', 'start', 'check'] },
  alt: { items: [{ id: 'heat', label: '스택 예열' }, { id: 'purge', label: '저압 정화' }, { id: 'low', label: '저출력 전해 시작' }, { id: 'check', label: '출력 확인' }], correct: ['heat', 'purge', 'low', 'check'] },
};

/** C6 · ZERO DOME — 돔 다섯 구역 탐색, 계통 진단, MIRROR의 고백(반전), 72시간 전력 저울, 산소 모듈 재시동 */
export class C6Flow {
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

  start(): void {
    const crew = aliveCrew(this.m);
    this.unsub = this.app.mission.subscribe(() => this.hud());
    this.explore = new Explore(this.app, {
      map: C6_MAP,
      start: C6_SPOTS.start,
      alarm: !this.has('c6_fixed'),
      actors: () => [
        ...crew.map((id, i) => ({ id, look: CANDIDATES[id].look, x: C6_SPOTS.crew[i].x, y: C6_SPOTS.crew[i].y, name: CANDIDATES[id].name })),
        { id: 'dam', look: NPC_LOOKS.dam, x: C6_SPOTS.dam.x, y: C6_SPOTS.dam.y, name: '담' },
      ],
      spots: () => this.spots(),
      onInteract: (id) => this.interact(id),
      onReady: (s) => { this.scene = s; void this.explore?.run(() => this.intro()); },
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
    if (this.m.chapter !== 'C6') return;
    this.app.hud.setTop(`C6 · ${CHAPTER_TITLE.C6}`, null);
    this.app.hud.setResources(this.m.resources);
    this.app.hud.setObjectives('산소가 줄어든다', [
      { text: 'MIRROR 콘솔에서 계통 진단', done: this.has('c6_diagnosed'), spot: 'mirror' },
      { text: '72시간 전력 배분', done: typeof this.m.flags.c6_alloc === 'string', spot: 'mirror' },
      { text: '산소 모듈실에서 재시동', done: this.has('c6_fixed'), spot: 'o2' },
      { text: 'MIRROR에게 돌아가기', done: this.has('c6_done'), spot: 'mirror' },
    ]);
  }

  private spots(): Spot[] {
    const crew = aliveCrew(this.m);
    const alloc = typeof this.m.flags.c6_alloc === 'string';
    return [
      ...crew.map((id, i) => ({ id, ...C6_SPOTS.crew[i], r: 26, label: CANDIDATES[id].name, verb: '이야기하기' })),
      { id: 'dam', ...C6_SPOTS.dam, r: 26, label: '담', verb: '이야기하기' },
      { id: 'mirror', ...C6_SPOTS.mirror, r: 34, label: 'MIRROR 콘솔', verb: this.has('c6_fixed') ? '인사하기' : alloc ? '살펴보기' : '진단하기', tag: true },
      { id: 'o2', ...C6_SPOTS.o2, r: 34, label: '산소 모듈실', verb: alloc && !this.has('c6_fixed') ? '재시동하기' : '살펴보기', tag: true },
      { id: 'farm', ...C6_SPOTS.farm, r: 34, label: '농장실', verb: '둘러보기', tag: true },
      { id: 'vault', ...C6_SPOTS.vault, r: 34, label: '종자 냉각고', verb: '들여다보기', tag: true },
      { id: 'archive', ...C6_SPOTS.archive, r: 34, label: '기록 서버실', verb: '둘러보기', tag: true },
      { id: 'med', ...C6_SPOTS.med, r: 30, label: '의료 구역', verb: '둘러보기', tag: true },
    ];
  }

  private async intro(): Promise<void> {
    const app = this.app;
    const crew = aliveCrew(this.m);
    if (!this.has('c6_meet')) {
      await app.say([
        { who: 'narrator', text: '살구빛 지하돔. 바깥의 차가운 붉은색과 달리, 안은 따뜻한 빛이다.' },
        { who: 'noknok', text: '선배님...? 아니, 동기?' },
        { who: 'mirror', text: '정정. 저는 2071년식입니다.' },
        { who: 'noknok', text: '...선배님.' },
      ]);
      this.flag('c6_meet');
      await reflect(this.app, 'C6');
    }
    await rememberLost(app, 'C5');
    if (!this.has('c6_crisis_told')) {
      applyOnce(app, 'c6crisis', E.c6Crisis());
      await app.say([
        { who: 'mirror', text: '경보. 산소 보충 모듈 시동 실패. 실내 산소 저장량이 조금씩 줄고 있습니다.' },
        { who: 'noknok', text: 'CO₂를 치우는 것과 산소를 만드는 건 다른 기계예요! 기압 유지도 따로고요.' },
        { who: 'noknok', text: '바닥값 아래로 내려가면 비상 탱크가 자동으로 열려요. 숨 막히는 일은 없어요.' },
        ...(crew.includes('seojin') ? talkLines('seojin', TALK.C6.seojin ?? []) : []),
        ...(crew.includes('taeo') ? talkLines('taeo', TALK.C6.taeo ?? []) : []),
        { who: 'noknok', text: 'MIRROR 콘솔에서 계통 진단을 해요!' },
      ]);
      OPPS.forEach((id) => app.openOpp(id));
      this.flag('c6_crisis_told');
    }
  }

  private async interact(id: string): Promise<void> {
    const app = this.app;
    if (isCandidateId(id) || id === 'dam') {
      if (id === 'harin' && this.has('c6_fixed') && !this.has('c6_quiet')) { await this.quiet(); return; }
      const key = `talk_c6_${id}`;
      const list = TALK.C6[id] ?? [];
      await app.say(talkLines(id, this.has(key) ? list.slice(-1) : list));
      this.flag(key);
      return;
    }
    switch (id) {
      case 'mirror':
        if (this.has('c6_fixed')) await this.finish();
        else if (typeof this.m.flags.c6_alloc === 'string') await app.say([{ who: 'mirror', text: '재시동은 산소 모듈실에서 할 수 있습니다.' }]);
        else await this.diagnose();
        return;
      case 'o2':
        if (typeof this.m.flags.c6_alloc === 'string' && !this.has('c6_fixed')) await this.restart();
        else await infoPanel(app.modals, '산소 모듈실', ['전해 스택 4기', this.has('c6_fixed') ? '산소 생산 12 L/h · 정상' : '명령 무응답 · 정비 기록 2년 공백'], '닫기');
        return;
      case 'farm':
        await app.say([{ who: 'narrator', text: '농장실의 상추가 인공 햇빛 아래 고개를 들고 있다. 흙은 돔 안에서만 쓴다.' }]);
        return;
      case 'vault':
        if (this.has('c6_fixed') && !this.has('c6_quiet')) { await this.quiet(); return; }
        await app.say([{ who: 'narrator', text: '종자 냉각고 창 너머로 작은 봉투 1,200개가 줄지어 있다. 지구 작물 1,200계통.' }]);
        return;
      case 'archive':
        await app.say([{ who: 'narrator', text: '기록 서버실의 불빛이 숨 쉬듯 깜빡인다. 지구의 목소리, 노래, 뉴스.' }]);
        return;
      case 'med':
        await app.say([{ who: 'narrator', text: '의료 구역의 침대 시트가 16년째 반듯하게 접혀 있다.' }]);
        return;
      default:
    }
  }

  private async diagnose(): Promise<void> {
    const app = this.app;
    const crew = aliveCrew(this.m);
    const jp = await askFork(app, { opp: 'C6-O03', dim: 'JP', optionSetId: 'c6-roles', scene: 'C6 수리 역할을 나눌 때', line: { who: 'noknok', text: '역할은 어떻게 나눌까요?' }, plus: '역할표 먼저', minus: '상황 보며 배치' });
    if (jp === 'plus') await simpleList(app.modals, '역할표', crew.map((c, i) => `${CANDIDATES[c].name}: ${['전력 계통', 'CO₂ 제거', '기압 확인', '산소 모듈'][i]}`).concat(['담: 통신·기록']), '이대로');
    else if (jp === 'minus') await app.say([{ who: 'noknok', text: '보면서 손 비는 사람이 맡기로 해요!' }]);
    const so = await askFork(app, { opp: 'C6-O04', dim: 'E', optionSetId: 'c6-work', scene: 'C6 진단 작업 방식', line: { who: 'noknok', text: '진단은 어떻게 할까요?' }, plus: '동료에게 설명하며 함께 작업', minus: '혼자 패널 작업' });
    if (so === 'plus') await app.say([{ who: 'dam', text: '좋아, 네가 읽어 주면 내가 스위치를 볼게.' }, { who: 'narrator', text: '목소리가 오가며 계기를 하나씩 짚는다.' }]);
    else if (so === 'minus') await app.say([{ who: 'narrator', text: '패널 앞에 혼자 앉아 계기를 하나씩 짚는다.' }, { who: 'narrator', text: '경보음 사이로 숫자만 또렷하다.' }]);
    await pickPuzzle(app.modals, {
      title: '생명유지 계통 진단',
      intro: '전력 → 산소 생산 / CO₂ 제거 / 기압 유지. 네 기능은 서로 다른 기계예요. 원인을 찾으세요.',
      extra: h('div', {},
        h('div', { class: 'sys-diagram', 'aria-hidden': 'true' }, h('span', {}, '전력'), h('i', {}, '→'), h('span', {}, '산소 생산'), h('span', {}, 'CO₂ 제거'), h('span', {}, '기압 유지')),
        h('button', { class: 'btn small info-opp', type: 'button', onClick: () => void infoTabs(app, {
          opp: 'C6-O01', setId: 'c6-gauges', title: '계기 자료', scene: 'C6 계기 자료를 열었을 때',
          sLabel: '계기 원수치', sLines: ['전력 공급: 정상 62%', '산소 생산: 0 L/h (명령 무응답)', 'CO₂ 제거: 정상', '기압: 101kPa 정상'],
          nLabel: '추세·고장 가설', nLines: ['산소 저장량이 시간당 조금씩 감소', '가설: 전해 모듈이 오래 정비받지 못해 시동이 걸리지 않는다', '전력·CO₂·기압은 원인이 아닐 가능성이 크다'],
        }) }, '계기 자료')),
      cards: [
        { id: 'power', label: '전력', gauge: '62%', detail: '공급은 정상. 원인 아님.' },
        { id: 'o2', label: '산소 생산', gauge: '0 L/h', detail: '명령에 반응 없음. 정비 기록 2년 공백.' },
        { id: 'co2', label: 'CO₂ 제거', gauge: '정상', detail: '흡착기 작동 중. 원인 아님.' },
        { id: 'press', label: '기압 유지', gauge: '101kPa', detail: '정상. 원인 아님.' },
      ],
      answer: 'o2',
      hint: 'MIRROR: 그 계통은 정상입니다. 반응이 없는 계통을 찾아 보세요.',
    });
    this.flag('c6_diagnosed');
    const who = pickSpeaker('c6Shift', crew);
    if (this.scene?.hasActor(who)) {
      const p = this.scene.playerPos();
      await this.scene.walkActor(who, p.x + 30, p.y + 6, 900);
      this.scene.faceTowardPlayer(who);
    }
    await requestPanel(app, {
      opp: 'C6-O05', setId: 'c6-shift', slot: 'c6Shift', title: '근무 순번 요청', scene: 'C6 근무 순번 요청',
      request: '나 첫 순번 말고 두 번째로 해도 될까? 지금 손이 너무 차가워서.',
      tLabel: '전력·작업 수치 보기', tLines: ['순번마다 작업량 같음(각 30분)', '순서를 바꿔도 재시동 시간은 그대로'],
      fLabel: '승무원 메모 보기', fLines: ['손이 차가워서 잠깐 몸을 녹이고 싶다고 적었다.', '다른 승무원: 어느 순번이든 괜찮다고 적었다.'],
      adjust: '요청대로 순번 바꾸기', keep: '지금 순번 유지하고 이유 설명하기',
      adjustReply: '고마워. 금방 녹이고 올게.', keepReason: '첫 순번 작업이 그 손에 제일 익숙한 장치라서요. 장갑 하나 더 드릴게요.',
    });
    await app.say([
      { who: 'mirror', text: '보고합니다. 2년 동안의 모래폭풍 때, 저는 종자 저장고와 지구 기록 서버를 지키느라 산소 모듈 정비를 건너뛰었습니다.' },
      { who: 'mirror', text: '저는 지구에서 온 것들을 지키라는 명령을 받았어요. 사람이 올 거라는 확신은... 없었어요.' },
      { who: 'dam', text: '...16년 동안 혼자였구나.' },
      { who: 'mirror', text: '그런데 이상합니다. 제가 지킨 종자 목록 중 312봉투의 품종명이 「NOKCHA」로 바뀌어 있습니다. 정정. 지금은 산소가 먼저입니다.' },
    ]);
    const ctx = c6Context(this.m.inventoryIds, crew);
    const alloc = await tokenBoard(app.modals, {
      title: '저울 · 72시간 전력',
      intro: '생명유지 최소치는 이미 고정돼 있어요. 남은 전력 토큰 6개를 나눠요. 한 곳을 완전히 지키려면 3개가 필요해요. (성격 결과에 쓰이지 않아요)',
      total: 6, max: 3,
      sockets: [
        { id: 'o2', label: '산소 재시동 가속', keep: '산소 여유 크게 회복(+25)', lose: '회복이 느려진다(위험이 아니라 여유가 준다)' },
        { id: 'seed', label: '종자 냉각고', keep: '지구 작물 1,200계통 보존', lose: `되돌릴 수 없는 종자 손실 (${ctx.seedHelp ? '가져온 씨앗 덕분에 손실이 줄어든다' : '최대 40'})` },
        { id: 'archive', label: '지구 기록 서버', keep: '지구의 목소리 보존', lose: `기록 손상 (${ctx.archiveHelp ? '가져온 기록 덕분에 손실이 줄어든다' : '최대 30'})` },
        { id: 'heat', label: '거주 난방', keep: '따뜻한 밤', lose: '추운 밤 — 담요를 나눠 덮는다(신뢰 -10까지)' },
      ],
    });
    const t: [number, number, number, number] = [alloc[0], alloc[1], alloc[2], alloc[3]];
    applyOnce(app, 'c6power', E.c6Power(t, ctx));
    this.flag('c6_alloc', JSON.stringify(t));
    react(this.scene, crew, 'power', ['o2', 'seed', 'archive', 'heat'][t.indexOf(3)] ?? 'even');
    await app.say([
      { who: 'mirror', text: '제가 지킨 것을 내려놓으셔도 돼요. 저는... 괜찮아요. 정정. 괜찮을 거예요.' },
      { who: 'noknok', text: '선배님, 이제 혼자 아니에요. 산소 모듈실로 가요!' },
    ]);
  }

  private async restart(): Promise<void> {
    const app = this.app;
    // 희생: 산소 모듈실에 들어갈 사람(이야기 전용, 결과에 반영하지 않는다)
    await sacrificeStep(app, 'C6', this.scene, C6_SPOTS.o2);
    const v = await askFork(app, { opp: 'C6-O02', dim: 'O', optionSetId: 'c6-seq', scene: 'C6 재시동 시퀀스를 고를 때', line: { who: 'mirror', text: '재시동 시퀀스를 고르세요. 두 시퀀스 모두 안전 규정 안에 있습니다.' }, plus: '대안 시퀀스 시뮬레이션', minus: '매뉴얼 표준 시퀀스' });
    const seq = (v ?? app.forkMemo('c6-seq')) === 'plus' ? SEQ.alt : SEQ.standard;
    await orderPuzzle(app.modals, { title: '산소 모듈 재시동', intro: '단계를 올바른 순서대로 누르세요. 틀려도 예비 탱크가 받쳐 줘요.', items: [...seq.items].reverse(), correct: seq.correct, hint: 'MIRROR: 순서가 달라요. 정화나 예열 없이 전해를 시작하면 스택이 상해요. 다시 해 봐요.' });
    const c = await askFork(app, { opp: 'C6-O03', dim: 'C', optionSetId: 'c6-check', scene: 'C6 재시동 뒤 점검', line: { who: 'mirror', text: '자동 점검 완료. 산소 생산 정상.' }, plus: '수동으로 다시 확인', minus: 'MIRROR 자동 점검 수용' });
    if (c === 'plus') await simpleList(app.modals, '재시동 점검표', ['산소 생산 12 L/h', 'CO₂ 제거 정상', '기압 정상'], '확인했어요');
    else if (c === 'minus') await app.say([{ who: 'noknok', text: '선배님 말이면 믿을게요!' }]);
    app.setAlarm(false);
    this.scene?.shake(200, 0.002);
    await app.say([
      { who: 'narrator', text: '낮은 웅웅거림. 산소 모듈이 다시 숨을 쉰다.' },
      ...(typeof this.m.flags.lost_C6 === 'string' && this.m.flags.lost_C6 in CANDIDATES
        ? [{ who: 'narrator' as const, text: `돔 전체에 새 공기가 흐른다. 모듈실 창 너머, ${CANDIDATES[this.m.flags.lost_C6 as CandidateId].name}의 손이 아직 밸브 위에 있다. 문은 다시 열리지 않는다.` }]
        : []),
      ...(this.m.inventoryIds.includes('parts') ? [{ who: 'noknok' as const, text: '예비 부품으로 낡은 밸브까지 바꿨어요. 전력 효율도 올랐어요!' }] : []),
      { who: 'mirror', text: '고맙습니다... 이런 말, 처음 해 봐요.' },
      { who: 'noknok', text: '선배님이랑 저, 둘이 경보 끄는 노래라도 만들까요? ...안 된다고요? 정정, 안 된다고요.' },
    ]);
    OPPS.forEach((oid) => app.closeOpp(oid));
    this.flag('c6_fixed');
    if (!aliveCrew(this.m).includes('harin')) await this.quiet();
    else await app.say([{ who: 'narrator', text: '하린이 아직도 담요를 개고 있다. 쉬지 않으려는 얼굴이다.' }]);
  }

  private async quiet(): Promise<void> {
    const app = this.app;
    const crew = aliveCrew(this.m);
    if (this.has('c6_quiet')) return;
    if (crew.includes('harin')) {
      await app.say([{ who: 'narrator', text: '쉬지 않으려는 하린에게 담요를 건넨다.' }, { who: 'harin', text: '괜찮아, 괜찮아. ...고마워.', expr: 'relief' }]);
    } else {
      const who = crew.includes('woojoo') ? 'woojoo' : crew.includes('dodam') ? 'dodam' : crew[0];
      await app.say([{ who: 'narrator', text: `${iGa(CANDIDATES[who].name)} 종자 냉각고 창에 손을 대 본다.` }, ...(who === 'woojoo' ? [{ who: 'woojoo' as const, text: '여기 차나무 씨앗도 있을까? ...있으면 좋겠다.' }] : [])]);
    }
    this.flag('c6_quiet');
    await app.say([{ who: 'noknok', text: 'MIRROR 선배님한테 인사하고 쉬어요.' }]);
  }

  private async finish(): Promise<void> {
    const app = this.app;
    if (!this.has('c6_quiet')) await this.quiet();
    await app.say([{ who: 'mirror', text: '오늘 밤 돔의 산소는 충분합니다. 정정... 충분하고, 따뜻합니다.' }]);
    OPPS.forEach((oid) => app.closeOpp(oid));
    this.flag('c6_done');
    app.mission.dispatch({ type: 'goto', fsm: 'c7_play' });
    void app.beginChapter(7);
  }
}
