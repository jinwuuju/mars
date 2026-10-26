import type { App } from './app';
import { Explore, type Spot } from './explore';
import { react } from './gags';
import { applyOnce, askFork, chemistryPairs, infoTabs, markSeen, reflect, requestPanel } from './common';
import { talkLines } from './c2';
import type { BunkerScene } from '../world/BunkerScene';
import { CANDIDATES } from '../story/candidates';
import { E, C4_ARK, C4_VIDEO } from '../story/effects';
import { LETTERS, LETTER_PRIORITY } from '../story/content';
import { pickSpeaker } from '../story/resolver';
import { unselectedOf } from '../story/roster';
import { TALK } from '../story/talk';
import { pipePuzzle, simpleList } from '../ui/mini';
import { infoPanel } from '../ui/panels';
import { scalePanel, type Voice } from '../ui/scale';
import { portraitURL } from '../art/sprites';
import { NPC_LOOKS } from '../art/look';
import { C4_MAP, C4_SPOTS } from '../art/maps';
import { CHAPTER_TITLE, isCandidateId, type CandidateId, type SpeakerId } from '../shared/ids';

const OPPS = ['C4-O01', 'C4-O02', 'C4-O03', 'C4-O04', 'C4-O05'];

/** C4 · DAY 189 — 몽타주, 생활 모듈 탐색, 물 회수 수리, 자유 시간, 지구의 늦은 영상, 아크-04 구조 신호(저울 4) */
export class C4Flow {
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
    const crew = this.m.crewIds;
    this.unsub = this.app.mission.subscribe(() => this.hud());
    this.explore = new Explore(this.app, {
      map: C4_MAP,
      start: C4_SPOTS.start,
      actors: () => [
        ...crew.map((id, i) => ({ id, look: CANDIDATES[id].look, x: C4_SPOTS.crew[i].x, y: C4_SPOTS.crew[i].y, name: CANDIDATES[id].name })),
        { id: 'dam', look: NPC_LOOKS.dam, x: C4_SPOTS.dam.x, y: C4_SPOTS.dam.y, facing: 'left' as const, name: '담' },
      ],
      spots: () => this.spots(),
      onInteract: (id) => this.interact(id),
      onReady: (s) => { this.scene = s; void this.explore?.run(() => this.resume()); },
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
    if (this.m.chapter !== 'C4') return;
    this.app.hud.setTop(`C4 · ${CHAPTER_TITLE.C4}`, null);
    this.app.hud.setResources(this.m.resources);
    this.app.hud.setObjectives('대답 없는 지구', [
      { text: '물 회수 장치 수리', done: this.has('c4_repaired'), spot: 'panel' },
      { text: '식탁에서 자유 시간', done: this.has('ask_c4-free'), spot: 'galley' },
      { text: '통신 단말에서 지구 영상', done: this.has('c4_video'), spot: 'comms' },
      { text: '구조 신호에 답하기', done: this.has('c4_ark') },
      { text: '조종석의 담에게 가서 착륙 준비', done: this.has('c4_done'), spot: 'dam' },
    ]);
  }

  private spots(): Spot[] {
    const crew = this.m.crewIds;
    const repaired = this.has('c4_repaired');
    return [
      ...crew.map((id, i) => ({ id, ...C4_SPOTS.crew[i], r: 26, label: CANDIDATES[id].name, verb: '이야기하기' })),
      { id: 'dam', ...C4_SPOTS.dam, r: 26, label: this.has('c4_ark') ? '조종석의 담' : '담', verb: this.has('c4_ark') ? '착륙 준비하기' : '이야기하기' },
      { id: 'panel', ...C4_SPOTS.panel, r: 32, label: '물 회수 장치', verb: repaired ? '살펴보기' : '수리하기', tag: true },
      { id: 'galley', ...C4_SPOTS.galley, r: 34, label: '식탁', verb: '앉기', tag: true },
      { id: 'comms', ...C4_SPOTS.comms, r: 30, label: '통신 단말', verb: '확인하기', tag: true },
      { id: 'hydro', ...C4_SPOTS.hydro, r: 32, label: '수경 화분', verb: '들여다보기', tag: true },
      { id: 'window', ...C4_SPOTS.window, r: 30, label: '관측창', verb: '바라보기', tag: true },
      { id: 'med', ...C4_SPOTS.med, r: 24, label: '의료함', verb: '열어 보기' },
      { id: 'pods', ...C4_SPOTS.pods, r: 30, label: '수면 캡슐', verb: '살펴보기' },
    ];
  }

  private voice(list: { who: CandidateId; text: string }[], fb: [SpeakerId, string]): Voice {
    const hit = list.find((v) => this.m.crewIds.includes(v.who));
    const [who, text] = hit ? [hit.who as SpeakerId, hit.text] : fb;
    const info = this.app.speaker(who);
    return { name: info.name, portrait: info.look ? portraitURL(info.look, 'worry') : info.icon ?? null, text };
  }

  private async resume(): Promise<void> {
    const app = this.app;
    const crew = this.m.crewIds;
    if (!this.has('c4_montage')) {
      const pairs = chemistryPairs(app, 1, 'c4-montage');
      await app.say([
        { who: 'narrator', text: '1일째. 창밖의 지구가 손톱만 해진다.' },
        ...(crew.includes('woojoo') ? [{ who: 'narrator' as const, text: '자막: 남은 녹차 3봉.' }] : []),
        ...pairs.flatMap(([a, la, b, lb]) => [{ who: a, text: la }, { who: b, text: lb }]),
        { who: 'narrator', text: '100일째. 누군가의 생일에 건조 케이크에 초 대신 손전등을 켠다.' },
        { who: 'narrator', text: '189일째.' },
      ]);
      this.flag('c4_montage');
    }
    await reflect(app, 'C4');
    if (!this.has('c4_alarm')) {
      this.scene?.shake(300, 0.003);
      await app.say([
        { who: 'noknok', text: '녹녹! 물 회수 효율 저하! 환기 경고는 금방 돌아왔고, 문제는 물 회수 회로 하나예요.' },
        { who: 'noknok', text: '오른쪽 벽의 물 회수 장치로 가 주세요!' },
      ]);
      OPPS.forEach((id) => app.openOpp(id));
      this.flag('c4_alarm');
    }
    if (this.has('c4_repaired') && !this.has('ask_c4-shift')) await this.shiftRequest();
    if (this.has('c4_video') && !this.has('c4_ark')) await this.arkSignal();
  }

  private async interact(id: string): Promise<void> {
    const app = this.app;
    if (id === 'dam' && this.has('c4_ark')) { await this.finish(); return; }
    if (isCandidateId(id) || id === 'dam') {
      const key = `talk_c4_${id}`;
      const list = TALK.C4[id] ?? [];
      await app.say(talkLines(id, this.has(key) ? list.slice(-1) : list));
      this.flag(key);
      return;
    }
    switch (id) {
      case 'panel': if (!this.has('c4_repaired')) await this.repair(); else await infoPanel(app.modals, '물 회수 장치', ['회수율 정상 범위', this.has('c3_backup_used') ? '우회 회로로 운전 중(예비 밸브 없음)' : '주 회로 운전 중'], '닫기'); return;
      case 'galley': await this.freeTime(); return;
      case 'comms': await this.video(); return;
      case 'hydro': await this.hydro(); return;
      case 'window':
        await app.say([{ who: 'narrator', text: '별빛 사이로, 지구는 이제 파란 점 하나다.' }, { who: 'thought', text: '저기 누군가는 아직 하늘을 올려다보고 있을까.' }]);
        return;
      case 'med':
        await infoPanel(app.modals, '의료함', ['진통제·붕대·수면 보조제', this.m.crewIds.includes('seojin') ? '서진의 손글씨 메모: 꺼낸 사람은 이름 적기.' : '사용 기록 칸이 비어 있다.'], '닫기');
        return;
      case 'pods':
        await app.say([{ who: 'narrator', text: '수면 캡슐마다 작은 사진이나 쪽지가 붙어 있다.' }]);
        return;
      default:
    }
  }

  private async repair(): Promise<void> {
    const app = this.app;
    const crew = this.m.crewIds;
    const taeo = crew.includes('taeo');
    const notebook = this.m.inventoryIds.includes('legacy_notebook');
    if (taeo && this.scene?.hasActor('taeo')) {
      const p = this.scene.playerPos();
      await this.scene.walkActor('taeo', p.x - 28, p.y, 900);
      this.scene.faceTowardPlayer('taeo');
    }
    await app.say(taeo
      ? [{ who: 'taeo', text: '그건 내 숙제였어. 알려진 결함을 못 고치고 보냈거든.' }, { who: 'taeo', text: '앞쪽 관 두 개는 내가 맞춰 둘게. 자, 순서대로.' }]
      : notebook
        ? [{ who: 'noknok', text: "태오 씨 정비 수첩에 이 회로 메모가 있어요. '필터 앞 밸브부터 봐.'" }]
        : [{ who: 'dam', text: '정비 담당이 없으니 하나하나 같이 보자. 필터까지 직접 돌려야 할 거야.' }, { who: 'noknok', text: '제가 안내할게요! 한 단계 더 걸리지만 할 수 있어요.' }]);
    const jp = await askFork(app, { opp: 'C4-O03', dim: 'JP', optionSetId: 'c4-plan', scene: 'C4 수리를 시작할 때', line: { who: 'noknok', text: '수리를 어떻게 시작할까요?' }, plus: '작업표 먼저', minus: '하면서 정하기' });
    if (jp === 'plus') await simpleList(app.modals, '작업표', ['1. 필터 앞 밸브 확인', '2. 관로 연결', '3. 압력 확인'], '이대로 시작');
    else if (jp === 'minus') await app.say([{ who: 'noknok', text: '좋아요, 보면서 정해요!' }]);
    const v = await askFork(app, { opp: 'C4-O02', dim: 'O', optionSetId: 'c4-route', scene: 'C4 수리 경로를 고를 때', line: { who: 'noknok', text: '관로는 어느 쪽으로 돌릴까요? 둘 다 타일 수가 같아요.' }, plus: '새 경로 시험', minus: '검증된 표준 우회로' });
    await pipePuzzle(app.modals, {
      variant: (v ?? app.forkMemo('c4-route')) === 'plus' ? 'new' : 'standard',
      preSolved: taeo ? 2 : 0,
      extraTile: !taeo && !notebook,
      hint: taeo ? '태오가 앞쪽 관 두 개를 맞춰 두었어요.' : notebook ? "정비 수첩: '필터 앞 밸브부터 봐.'" : '필터(F) 타일도 직접 돌려야 해요.',
      onLog: () => void infoTabs(app, {
        opp: 'C4-O01', setId: 'c4-log', title: '물 회수 장치 기록', scene: 'C4 장치 기록을 열었을 때',
        sLabel: '장치 이력 로그', sLines: ['회수율 92% → 61% (최근 9일)', '필터 앞 밸브 개폐 오류 3회', '마지막 정비: 출발 전'],
        nLabel: '효율 추세·예측', nLines: ['이대로면 40일 뒤 회수율 30%대', '가설: 밸브가 반쯤 닫힌 채 걸려 있다', '우회 관로로 돌리면 바로 회복될 가능성'],
      }),
    });
    const c = await askFork(app, { opp: 'C4-O03', dim: 'C', optionSetId: 'c4-pressure', scene: 'C4 수리 뒤 압력 확인', line: { who: 'noknok', text: '압력 자동 확인 완료! 정상 범위예요.' }, plus: '수동으로 한 번 더 확인', minus: '자동 압력 확인 결과 수용' });
    if (c === 'plus') await simpleList(app.modals, '압력 점검표', ['입구 압력 정상', '필터 통과 압력 정상', '출구 압력 정상'], '확인했어요');
    else if (c === 'minus') await app.say([{ who: 'noknok', text: '좋아요! 기록해 둘게요.' }]);
    applyOnce(app, 'c4repair', E.c4Repair(this.has('c3_backup_used')));
    this.flag('c4_repaired'); // 효과와 완료 표시를 함께 남긴다(대사 도중 새로고침해도 수리를 처음부터 다시 하지 않는다)
    await app.say([
      { who: 'noknok', text: '물이 다시 돈다! 회수 효율 회복.' },
      ...(this.has('c3_backup_used') ? [{ who: 'noknok' as const, text: '예비 밸브가 없어서 우회 회로로 돌렸어요. 효율이 조금 낮아요.' }] : []),
      ...(taeo ? [{ who: 'taeo' as const, text: '...숙제 하나 끝.', expr: 'relief' as const }] : []),
    ]);
    await this.shiftRequest();
  }

  private async shiftRequest(): Promise<void> {
    const who = pickSpeaker('c4Shift', this.m.crewIds);
    if (!this.has('ask_c4-shift') && this.scene?.hasActor(who)) {
      const p = this.scene.playerPos();
      await this.scene.walkActor(who, p.x + (p.x > 280 ? -30 : 30), p.y - 4, 900);
      this.scene.faceTowardPlayer(who);
    }
    await requestPanel(this.app, {
      opp: 'C4-O05', setId: 'c4-shift', slot: 'c4Shift', title: '교대 요청', scene: 'C4 교대 요청',
      request: '이번 주 야간 교대, 낮 교대랑 바꿔도 될까? 요즘 잠을 못 자서.',
      tLabel: '작업 부하 수치 보기', tLines: ['야간·주간 작업량은 같다(각 4시간)', '바꿔도 전체 일정은 그대로'],
      fLabel: '승무원 메모 보기', fLines: ['요즘 잠들기 어렵다고 적었다.', '다른 승무원: 어느 교대든 괜찮다고 적었다.'],
      adjust: '요청대로 교대 바꾸기', keep: '지금 교대 유지하고 이유 설명하기',
      adjustReply: '고마워. 오늘은 좀 잘 수 있겠다.', keepReason: '이번 주는 야간 장비 점검이 몰려 있어서요. 다음 주엔 꼭 바꿔요.',
    });
    if (!this.has('c4_free_hint')) {
      await this.app.say([{ who: 'noknok', text: '수리 끝! 자유 시간이 한 칸 생겼어요. 식탁으로 와요.' }]);
      this.flag('c4_free_hint');
    }
  }

  private async freeTime(): Promise<void> {
    const app = this.app;
    if (!this.has('c4_repaired')) { await app.say([{ who: 'noknok', text: '물 회수 장치부터 고쳐야 해요!' }]); return; }
    if (this.has('ask_c4-free')) { await app.say([{ who: 'narrator', text: '식탁 위에 카드 몇 장과 연필 자국이 남아 있다.' }]); return; }
    const crew = this.m.crewIds;
    const so = await askFork(app, { opp: 'C4-O04', dim: 'E', optionSetId: 'c4-free', scene: 'C4 자유 시간', line: { who: 'noknok', text: '자유 시간이에요! 어떻게 보낼까요?' }, plus: '동료들과 즉석 카드놀이', minus: '혼자 관측창에서 별 스케치' });
    if (so === 'plus') await app.say([{ who: pickSpeaker('c4Talk', crew), text: '이번 판은 내가 이긴다. ...아니면 말고.' }]);
    else if (so === 'minus') await app.say([{ who: 'narrator', text: '관측창 앞에 앉아 별을 하나씩 그린다. 지구는 이제 작은 점이다.' }]);
    OPPS.forEach((oid) => app.closeOpp(oid));
    await app.say([{ who: 'noknok', text: '통신 단말에 새 데이터가 들어왔어요. 지구에서요!' }]);
  }

  private async video(): Promise<void> {
    const app = this.app;
    const crew = this.m.crewIds;
    if (!this.has('ask_c4-free')) { await app.say([{ who: 'noknok', text: '아직 새 데이터가 없어요. 중계 위성이 조용하네요.' }]); return; }
    if (this.has('c4_video')) { await app.say([{ who: 'narrator', text: '단말 화면에 마지막 학교 종 장면이 멈춰 있다.' }]); return; }
    await app.say([
      { who: 'noknok', text: '지구에서 영상이 왔어요. 중계 위성 고장으로 11일 늦게 도착한, 이미 지난 시간의 기록이에요.' },
    ]);
    // 새로고침으로 다시 들어와도 이미 고른 답을 쓴다(효과는 applyOnce로 한 번만, 선택 기록도 바뀌지 않는다)
    const prevVid = this.m.flags.c4_video_choice;
    const vid = typeof prevVid === 'string' ? prevVid : await app.choose({ who: 'noknok', text: '어떻게 볼까요?' }, [
      { id: 'together', label: '모두 함께 재생' }, { id: 'archive', label: '기록 보관해 두고 나중에' }, { id: 'alone', label: '각자 혼자 보기' },
    ]);
    applyOnce(app, 'c4video', E.c4Video(vid as (typeof C4_VIDEO)[number]));
    this.flag('c4_video_choice', vid);
    react(this.scene, crew, 'video', vid);
    const out = unselectedOf(crew);
    const writer = LETTER_PRIORITY.find((c) => out.includes(c)) ?? out[0];
    this.flag('letter_from', writer);
    markSeen(app, 'letters_seen', [writer]);
    await app.say([
      vid === 'together' ? { who: 'narrator', text: '모두 단말 앞에 모인다. 누군가 조명을 낮춘다.' } : vid === 'archive' ? { who: 'narrator', text: '도담이 저장 버튼을 누르려다, 첫 장면만 함께 본다.' } : { who: 'narrator', text: '각자 헤드폰을 쓴다. 같은 영상, 다른 표정.' },
      { who: 'narrator', text: "대피소의 마지막 학교 종. 아이가 화면을 보며 묻는다. '화성엔 비가 와요?'" },
      { who: writer, text: LETTERS[writer] },
      { who: 'noknok', text: '화성에 비가 오냐고요? ...우린 먼저 지붕부터 만들어야 할 것 같은데요.' },
    ]);
    this.flag('c4_video');
    await this.arkSignal();
  }

  private async arkSignal(): Promise<void> {
    const app = this.app;
    if (this.has('c4_ark')) return;
    // 이미 고른 뒤 새로고침했다면 신호·대화·저울을 다시 열지 않는다(선택 기록과 적용된 효과가 어긋나지 않게)
    const prevArk = this.m.flags.c4_ark_choice;
    if (typeof prevArk !== 'string') {
    this.scene?.shake(250, 0.003);
    await app.say([
      { who: 'broadcast', text: '같은 버퍼에 섞인 구조 요청. ...오빠, 듣고 있지? 생명유지 장치 효율 41%. 우린 셋이야.' },
      { who: 'noknok', text: '아크-04, 2주 먼저 떠난 3인 선발대예요. 주엔진 고장으로 이번엔 화성에 못 들어가고, 약 26개월 뒤에야 다시 가까워져요. 지금은 우리와 며칠 거리예요.' },
      { who: 'narrator', text: '담이 굳는다. 손목의 04 팔찌를 꽉 쥔다.' },
    ]);
    const talk = await app.choose({ who: 'narrator', text: '담은 아무 말이 없다.' }, [{ id: 'talk', label: '담에게 말 걸기' }, { id: 'stay', label: '조용히 곁에 있기' }]);
    await app.say(talk === 'talk'
      ? [{ who: 'dam', text: '이 팔찌? 04. 아크-04. 담희, 내 동생이야. 떠나기 전에 똑같은 걸 하나씩 나눠 꼈어.' }, { who: 'dam', text: '이 결정에서 난 빠질게. 지금 내 판단은 못 믿겠어.' }]
      : [{ who: 'narrator', text: '한참 뒤, 담이 팔찌를 보여 준다. 04.' }, { who: 'dam', text: '...내 동생이 저기 있어. 이 결정에서 난 빠질게.' }]);
    }
    const choice = typeof prevArk === 'string' ? prevArk : await scalePanel(app.modals, {
      title: '저울 · 구조 신호',
      subtitle: '어떤 선택도 아크-04의 생사를 확정하지 않는다. 무엇으로 값을 치를까? (성격 결과에 쓰이지 않아요)',
      options: [
        { id: 'supply', title: '보급 캡슐 사출', desc: '물과 산소 캔들을 담은 캡슐을 쏘아 보낸다.', cost: '대가: 물 -20, 산소 -15', support: this.voice([{ who: 'seojin', text: '두고 가는 건 이제 못 해.' }, { who: 'harin', text: '담 아저씨 얼굴 봤어?' }], ['noknok', '캡슐 궤도는 계산할 수 있어요.']), worry: this.voice([{ who: 'taeo', text: '숫자부터. 그건 우리 여유를 깎아.' }, { who: 'woojoo', text: '물이 줄면 화분도...' }], ['dam', '...우리 몫이 줄어.']) },
        { id: 'rendezvous', title: '궤도 수정 랑데부', desc: '궤도를 바꿔 직접 다가가 물자를 옮기고, 30초 동안 얼굴을 본다.', cost: '대가: 연료 여유(협곡 착륙지 포기), 도착 3일 지연 식량 -10', support: this.voice([{ who: 'harin', text: '담 아저씨 얼굴 봤어?' }, { who: 'dodam', text: '어떤 선택이든 기록은 남길게요. 이 30초도요.' }], ['noknok', '랑데부 궤도도 계산할 수 있어요.']), worry: this.voice([{ who: 'woojoo', text: '그건 식량이...' }, { who: 'jio', text: '연료가 빠듯해져요, 아마도.' }], ['dam', '연료가 줄면 착륙지가 하나 사라져.']) },
        { id: 'relay', title: '신호 중계 + 항로 데이터 전송', desc: 'MIRROR에 신호를 중계하고 우리 항로 데이터를 보낸다. 그들의 이후는 우리 손을 떠난다.', cost: '대가: 그들이 지는 불확실성', support: this.voice([{ who: 'jio', text: 'MIRROR가 계산해 줄 거예요, 아마도!' }, { who: 'taeo', text: '우리가 버텨야 그들도 받아 줄 곳이 생겨.' }], ['noknok', '중계는 바로 할 수 있어요.']), worry: this.voice([{ who: 'seojin', text: '데이터만 보내고 끝이야?' }, { who: 'dodam', text: '목소리에 데이터로 답하는 거네요.' }], ['dam', '...그것만으로 버틸 수 있을까.']) },
      ],
    });
    applyOnce(app, 'c4ark', E.c4Ark(choice as (typeof C4_ARK)[number]));
    this.flag('c4_ark_choice', choice);
    react(this.scene, this.m.crewIds, 'ark', choice);
    await app.say(choice === 'supply'
      ? [{ who: 'narrator', text: '캡슐이 작은 빛이 되어 멀어진다.' }, { who: 'dam', text: '...고마워.' }]
      : choice === 'rendezvous'
        ? [{ who: 'narrator', text: '사흘 뒤. 화면에 담과 똑같은 팔찌를 찬 손이 보인다.' }, { who: 'broadcast', text: '오빠! ...보여? 나 괜찮아. 진짜야.' }, { who: 'dam', text: '30초면 충분해. ...아니, 하나도 안 충분해.' }]
        : [{ who: 'noknok', text: '중계 완료. 항로 데이터 전송 완료.' }, { who: 'dam', text: '...MIRROR가 잘 계산해 주길.' }]);
    this.flag('c4_ark');
    await app.say([{ who: 'noknok', text: '착륙 준비는 조종석에서 할 수 있어요. 담 씨한테 가 봐요.' }]);
  }

  private async hydro(): Promise<void> {
    const app = this.app;
    if (this.has('c4_ark') && !this.has('c4_quiet')) {
      await app.say([{ who: 'narrator', text: '화분 잎을 손가락으로 세어 본다. 하나, 둘, 셋.' }, { who: 'thought', text: '189일 동안 이만큼 자랐다.' }]);
      this.flag('c4_quiet');
      return;
    }
    await app.say(this.m.crewIds.includes('woojoo')
      ? [{ who: 'narrator', text: '상추 옆, 작은 흙더미에 이름표가 꽂혀 있다. \'차나무(희망)\'.' }]
      : [{ who: 'narrator', text: '상추와 콩잎이 조명 아래서 천천히 흔들린다.' }]);
  }

  private async finish(): Promise<void> {
    const app = this.app;
    if (!this.has('c4_quiet')) {
      await app.say([{ who: 'narrator', text: '떠나기 전, 수경 화분 잎을 손가락으로 세어 본다. 하나, 둘, 셋.' }]);
      this.flag('c4_quiet');
    }
    await app.say([{ who: 'dam', text: '화성 접근 궤도 진입까지 열흘. 착륙 준비를 시작하자.' }]);
    OPPS.forEach((oid) => app.closeOpp(oid)); // 자유 시간 도중 새로고침해 아직 안 닫혔을 수 있다(이미 닫혔으면 아무 일도 없다)
    this.flag('c4_done');
    app.mission.dispatch({ type: 'goto', fsm: 'c5_play' });
    void app.beginChapter(5);
  }
}
