import type { App } from './app';
import type { CabinScene, CabinView } from '../world/CabinScene';
import type { LaunchInit } from '../world/LaunchScene';
import { CANDIDATES } from '../story/candidates';
import { itemsOf, jettisonOk, spareValvePlan } from '../story/cargo';
import { pickSpeaker, resolveRole } from '../story/resolver';
import { iGa } from '../story/josa';
import { formatClock } from '../core/state';
import { infoPanel, perspectivePanel, tabPanel } from '../ui/panels';
import { Explore } from './explore';
import { applyOnce, reflect } from './common';
import { talkLines } from './c2';
import { TALK } from '../story/talk';
import { C3_MAP, C3_SEATS, C3_SPOTS } from '../art/maps';
import { NPC_LOOKS } from '../art/look';
import { scalePanel, jettisonPicker, type Voice } from '../ui/scale';
import { wiringGame, type Sensor } from '../ui/wiring';
import { ignitionGame } from '../ui/ignition';
import { h, pxImg, toast } from '../ui/dom';
import { portraitURL } from '../art/sprites';
import { itemURL } from '../art/items';
import { CHAPTER_TITLE, isCandidateId, type CandidateId, type SpeakerId } from '../shared/ids';

const OPPS = ['C3-O01', 'C3-O02', 'C3-O03', 'C3-O04', 'C3-O05'];

type VoiceDef = { who: CandidateId; text: string }[];
const VOICES: Record<string, { support: VoiceDef; supportFallback: [SpeakerId, string]; worry: VoiceDef; worryFallback: [SpeakerId, string] }> = {
  boram: {
    support: [{ who: 'jio', text: '보람 씨가 원해요. 저라도 그랬을 거예요.' }, { who: 'harin', text: '보람 씨 얼굴, 이미 정한 얼굴이야.' }],
    supportFallback: ['boram', '어차피 난 남아. 마지막으로 쓸모 있게 해 줘.'],
    worry: [{ who: 'seojin', text: '남는 사람한테 위험을 넘기는 거야.' }, { who: 'dodam', text: '그 갠트리엔 재가 쌓여 있어요.' }],
    worryFallback: ['dam', '...밖은 지금 위험해.'],
  },
  spare: {
    support: [{ who: 'taeo', text: '밸브 바꾸는 건 순서대로 하면 돼.' }, { who: 'jio', text: '예비 밸브면 확실해요, 아마도!' }],
    supportFallback: ['noknok', '예비 밸브 전환 절차는 제가 알아요!'],
    worry: [{ who: 'dodam', text: '덜어 낼 짐 안에는 사람이 들어 있어요.' }, { who: 'woojoo', text: '화성에서 더 필요할 걸 지금 쓰는 거잖아.' }, { who: 'harin', text: '맡긴 물건까지 내려놓게 될 수도 있어.' }],
    worryFallback: ['dam', '짐이나 예비품 하나는 내려놓아야 해.'],
  },
  recal: {
    support: [{ who: 'taeo', text: '처음부터 다시 재면 돼. 자, 순서대로.' }, { who: 'seojin', text: '숫자가 맞을 때까지 기다리자.' }],
    supportFallback: ['dam', '시간을 들이면 확실해져.'],
    worry: [{ who: 'harin', text: '창이 좁아지면 많이 흔들린대.' }, { who: 'woojoo', text: '흔들리면... 아니, 녹차 말고 사람이 걱정이야.' }],
    worryFallback: ['noknok', '창이 좁아지면 선체에 무리가 가요.'],
  },
};

const SENSOR_INFO: Record<Sensor, { S: string[]; N: string[] }> = {
  A: { S: ['센서 A (밸브 V1 구간) 압력 101.3kPa', '변화율 0.0kPa/분', '마지막 교정: 3일 전'], N: ['그래프가 평평하다 → 이 구간은 새지 않는 것 같다', '가설: A는 기준선으로 쓸 수 있다'] },
  B: { S: ['센서 B (밸브 V1 하류) 압력 99.8~102.6kPa 사이로 튐', '변화율 들쭉날쭉', '배선 커넥터 외부 노출'], N: ['그래프가 튀기만 하고 평균은 그대로다 → 진짜 누설이 아닐 수도', '가설: 재가 낀 배선이 잡음을 만든다'] },
  C: { S: ['센서 C (밸브 V2 구간) 압력 101.1kPa', '변화율 -0.02kPa/분, 40초마다 짧은 하강', '경보 등급: 낮음'], N: ['조용하지만 꾸준히 내려간다 → 작게 새고 있을지도', '가설: V2 밀봉이 미세하게 떠 있다'] },
};

/** C3 · IGNITION — 기밀 밸브 진단, 저울 3, 점화, 발사 컷신, 상승 */
export class C3Flow {
  private readonly app: App;
  private scene: CabinScene | null = null;
  private unsub: (() => void) | null = null;
  private mode: 'plan' | 'flow' = 'flow';
  private variant: 'standard' | 'cross' = 'standard';
  private comm = false;
  private launchUi: HTMLElement | null = null;
  private explore: Explore | null = null;

  constructor(app: App) {
    this.app = app;
  }

  private get m() {
    return this.app.mission.state;
  }

  private flag(key: string, value: string | number | boolean = true): void {
    this.app.mission.dispatch({ type: 'flag', key, value });
  }

  private tick(min = 1): void {
    this.app.mission.dispatch({ type: 'tick', minutes: min });
  }

  start(): void {
    this.unsub = this.app.mission.subscribe(() => this.refreshHud());
    if (this.m.fsm === 'c3_preflight' && this.m.flags.c3_seated !== true) this.exploreCabin();
    else this.startCabin(this.m.fsm === 'c3_ascent' ? 'space' : 'ground');
  }

  /** 착석 전 객실 탐색: 좌석을 찾아가며 동료와 짧게 이야기한다(서사, 비채점) */
  private exploreCabin(): void {
    const crew = this.m.crewIds;
    const seatOf = (i: number): { x: number; y: number } => C3_SEATS[i];
    const stand = (i: number): { x: number; y: number } => ({ x: seatOf(i).x + (i % 3 === 2 ? -22 : 22), y: seatOf(i).y + 22 });
    const ex = new Explore(this.app, {
      map: C3_MAP,
      start: C3_SPOTS.start,
      actors: () => [
        { id: 'dam', look: NPC_LOOKS.dam, x: stand(1).x, y: stand(1).y, name: '담' },
        ...crew.map((id, i) => ({ id, look: CANDIDATES[id].look, x: stand(i + 2).x, y: stand(i + 2).y, name: CANDIDATES[id].name })),
      ],
      spots: () => [
        { id: 'dam', ...stand(1), r: 24, label: '담', verb: '이야기하기' },
        ...crew.map((id, i) => ({ id, ...stand(i + 2), r: 24, label: CANDIDATES[id].name, verb: '이야기하기' })),
        { id: 'window', ...C3_SPOTS.window, r: 30, label: '관측창', verb: '바라보기', tag: true },
        { id: 'console', ...C3_SPOTS.console, r: 30, label: '출발 체크리스트', verb: '확인하기', tag: true },
        { id: 'seat', x: seatOf(0).x, y: seatOf(0).y + 18, r: 24, label: '내 좌석', verb: '앉기', tag: true },
      ],
      onInteract: async (id) => {
        if (id === 'seat') { await this.sit(ex, crew); return; }
        if (id === 'window') {
          await this.app.say([{ who: 'narrator', text: '관측창 밖으로 재가 눈처럼 내린다. 붉은 하늘 아래 갠트리가 검게 서 있다.' }, { who: 'thought', text: '여기가 지구에서 보는 마지막 하늘일지도 모른다.' }]);
          return;
        }
        if (id === 'console') {
          await infoPanel(this.app.modals, '출발 체크리스트', ['좌석 6석 · 벨트 자동 점검 완료', '수하물실 봉인: 정상', '기밀 밸브 V1·V2: 점검 대기', '발사 창: T-00:14:00부터'], '닫기');
          return;
        }
        if (isCandidateId(id) || id === 'dam') {
          const key = `talk_c3_${id}`;
          const list = TALK.C3[id] ?? [];
          await this.app.say(talkLines(id, this.m.flags[key] === true ? list.slice(-1) : list));
          this.flag(key);
        }
      },
      onReady: () => void ex.run(async () => {
        if (this.m.flags.c3_cabin_intro !== true) {
          await this.app.say([
            { who: 'dam', text: '각자 자리로. 좌석 번호는 벨트에 적혀 있어.' },
            ...talkLines('noknok', TALK.C3.noknok ?? []),
          ]);
          this.flag('c3_cabin_intro');
          await reflect(this.app, 'C3');
        }
      }),
    });
    this.explore = ex;
    ex.start();
    this.refreshHud();
  }

  private async sit(ex: Explore, crew: readonly CandidateId[]): Promise<void> {
    const s = ex.scene;
    if (s) {
      await s.walkActor('player', C3_SEATS[0].x, C3_SEATS[0].y + 4, 700);
      await Promise.all([s.walkActor('dam', C3_SEATS[1].x, C3_SEATS[1].y + 4, 900), ...crew.map((id, i) => s.walkActor(id, C3_SEATS[i + 2].x, C3_SEATS[i + 2].y + 4, 900))]);
      ['player', 'dam', ...crew].forEach((id) => s.face(id, 'up'));
      await this.app.say([{ who: 'narrator', text: '딸깍. 여섯 개의 벨트가 차례로 잠긴다.' }]);
      await s.fadeOut(500);
    }
    this.flag('c3_seated');
    ex.stop();
    this.explore = null;
    this.startCabin('ground');
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
    this.explore?.stop();
    this.explore = null;
    this.launchUi?.remove();
    this.launchUi = null;
  }

  private startCabin(view: CabinView): void {
    this.app.startScene('cabin', {
      crew: this.m.crewIds, playerLook: this.app.playerLook(), reduced: this.app.reduced, view,
      onReady: (s: CabinScene) => { this.scene = s; void this.resume(); },
    });
    this.app.hud.show(true);
    this.refreshHud();
  }

  private refreshHud(): void {
    const m = this.m;
    if (!m.fsm.startsWith('c3')) return;
    this.app.hud.setTop(`C3 · ${CHAPTER_TITLE.C3}`, m.fsm === 'c3_ascent' ? null : formatClock(m.narrativeClock));
    this.app.hud.setResources(m.resources);
    this.app.hud.setObjectives('지구의 마지막 창', [
      { text: '내 좌석에 앉기', done: m.flags.c3_seated === true, spot: 'seat' },
      { text: '기밀 밸브 진단', done: m.flags.c3_diagnosed === true },
      { text: '안전 기준을 채울 길 고르기', done: typeof m.flags.c3_fix === 'string' },
      { text: '점화와 상승', done: m.flags.c3_launched === true },
    ]);
  }

  private async resume(): Promise<void> {
    const fsm = this.m.fsm;
    if (fsm === 'c3_preflight') await this.preflight();
    else if (fsm === 'c3_diagnose') await this.diagnose();
    else if (fsm === 'c3_scale') await this.scaleStep();
    else if (fsm === 'c3_ignition') await this.ignition();
    else if (fsm === 'c3_ascent') await this.ascent();
  }

  private async preflight(): Promise<void> {
    await this.app.say([
      { who: 'noknok', text: '녹녹! 출발 전에 제가 마지막 체크... 앗, 저도 체크 받아야 하나?' },
      { who: 'dam', text: '좌석 벨트 확인. 엔진 예열 시작.' },
    ]);
    this.scene?.setAlarm(true);
    this.scene?.shake(300, 0.003);
    await this.app.say([
      { who: 'broadcast', text: '경보: 기밀 밸브 신호 불일치. 센서 A 정상 · 센서 B 누설 · 센서 C 간헐.' },
      { who: 'dam', text: '여기서 실수하면 돌아갈 땅이 없어.' },
      { who: 'noknok', text: '실제 누설인지 센서 오류인지 아직 몰라요. 같이 진단해요.' },
    ]);
    this.tick(1);
    this.app.mission.dispatch({ type: 'goto', fsm: 'c3_diagnose' });
    await this.diagnose();
  }

  private async sensorInfo(s: Sensor): Promise<void> {
    await tabPanel(this.app.modals, {
      title: `센서 ${s}`,
      tabs: [{ key: 'S', label: '센서 원자료', lines: SENSOR_INFO[s].S }, { key: 'N', label: '추세 그래프·가설', lines: SENSOR_INFO[s].N }],
      order: this.app.order(`c3-sensor-${s}`, 2),
      onPick: (key, pos, first) => this.app.recordAct({
        opportunityId: 'C3-O01', dim: 'SN', kind: 'tab', pole: key === 'N' ? 1 : -1,
        actKey: first ? `sensor:${s}:first` : `sensor:${s}:${key}:more`, secondary: !first,
        displayPosition: pos, optionSetId: 'c3-sensor', label: key === 'N' ? '추세 그래프·가설 탭 먼저' : '센서 원자료 탭 먼저',
        otherLabel: key === 'N' ? '센서 원자료 탭' : '추세 그래프·가설 탭', scene: 'C3 센서 정보를 열었을 때',
      }),
    });
  }

  private async diagnose(): Promise<void> {
    const crew = this.m.crewIds;
    this.scene?.setAlarm(true);
    OPPS.forEach((id) => this.app.openOpp(id));
    // 새로고침 뒤에도 이미 고른 진행 방식으로 미니게임을 보여 준다(화면 기억일 뿐, 이야기 상태·점수와 무관)
    const memo = (k: string): string | null => this.app.forkMemo(k);
    this.mode = memo('c3-diag-mode') === 'plan' ? 'plan' : 'flow';
    this.variant = memo('c3-verify') === 'cross' ? 'cross' : 'standard';
    this.comm = memo('c3-comm') === 'comm';
    if (this.m.flags.c3_jp_asked !== true) {
      const id = await this.app.fork({
        opp: 'C3-O03', dim: 'JP', optionSetId: 'c3-diag-mode', scene: 'C3 진단을 시작할 때',
        line: { who: 'noknok', text: '진단을 어떻게 시작할까요?' },
        options: [{ id: 'plan', label: '진단 순서표 먼저', pole: 1 }, { id: 'flow', label: '연결하며 보기', pole: -1 }],
      });
      this.mode = id === 'plan' ? 'plan' : 'flow';
      this.flag('c3_jp_asked');
      this.tick(1);
    }
    if (this.m.flags.c3_var_asked !== true) {
      const id = await this.app.fork({
        opp: 'C3-O02', dim: 'O', optionSetId: 'c3-verify', scene: 'C3 검증 절차를 고를 때',
        line: { who: 'noknok', text: '검증 절차는요? 둘 다 같은 단서를 같은 횟수로 보여 줘요.' },
        options: [{ id: 'standard', label: '표준 3단계 점검', pole: -1 }, { id: 'cross', label: '교차 검증 새 방식', pole: 1 }],
      });
      this.variant = id === 'cross' ? 'cross' : 'standard';
      this.flag('c3_var_asked');
    }
    if (this.m.flags.c3_comm_asked !== true) {
      const id = await this.app.fork({
        opp: 'C3-O04', dim: 'E', optionSetId: 'c3-comm', scene: 'C3 진단 중 소통 방식',
        line: { who: 'noknok', text: '진단하는 동안 소통은 어떻게 할까요?' },
        options: [{ id: 'comm', label: '승무원과 교신하며 진단', pole: 1 }, { id: 'solo', label: '헤드셋 집중 모드로 혼자', pole: -1 }],
      });
      this.comm = id === 'comm';
      this.flag('c3_comm_asked');
    }
    if (this.m.flags.c3_panel_asked !== true) {
      const who = pickSpeaker('c3PanelRequest', crew);
      const info = this.app.speaker(who);
      const d = await perspectivePanel(this.app.modals, {
        title: '점검 패널 요청',
        portrait: info.look ? pxImg(portraitURL(info.look, 'worry'), info.name, 'mini') : null,
        who: info.name,
        request: 'B 패널 말고 C 패널 맡아도 될까? B 경고음을 계속 들으니까 손이 떨려서.',
        info: [
          { key: 'T', label: '작업 부하 수치 보기', lines: ['B 패널 확인 항목 4개, C 패널 3개', '누가 어느 패널을 맡든 진단 시간은 같아요.', '두 배치 모두 안전 기준을 만족해요.'] },
          { key: 'F', label: '승무원 상태 메모 보기', lines: [`${info.name}: 경고음에 예민해서 손이 떨린다고 적었다.`, '다른 승무원: 어느 패널이든 괜찮다고 적었다.', '두 배치 모두 안전 기준을 만족해요.'] },
        ],
        infoOrder: this.app.order('c3-panel-info', 2),
        decisions: [{ id: 'adjust', label: '요청대로 재배치하기' }, { id: 'keep', label: '현재 배치 유지하고 이유 설명하기' }],
        decisionOrder: this.app.order('c3-panel-decision', 2),
        onInfo: (key, pos, first) => this.app.recordAct({
          opportunityId: 'C3-O05', dim: 'TF', kind: 'tab', pole: key === 'F' ? 1 : -1,
          actKey: first ? 'panel-info:first' : `panel-info:${key}:more`, secondary: !first,
          displayPosition: pos, optionSetId: 'c3-panel-info', label: key === 'F' ? '승무원 상태 메모 먼저' : '작업 부하 수치 먼저',
          otherLabel: key === 'F' ? '작업 부하 수치' : '승무원 상태 메모', scene: 'C3 점검 패널 요청',
        }),
        onDecide: (id, pos) => this.app.recordAct({
          opportunityId: 'C3-O05', dim: 'A', kind: 'fork', pole: id === 'adjust' ? 1 : -1, actKey: 'fork:c3-panel',
          displayPosition: pos, optionSetId: 'c3-panel-decision', label: id === 'adjust' ? '요청대로 재배치' : '현재 배치 유지하고 이유 설명',
          otherLabel: id === 'adjust' ? '현재 배치 유지하고 이유 설명' : '요청대로 재배치', scene: 'C3 점검 패널 요청',
        }),
      });
      if (d === 'adjust') await this.app.say([{ who, text: '고마워. C 패널은 조용해서 좀 낫다.', expr: 'relief' }]);
      else await this.app.say([{ who: 'dam', text: 'B 패널 항목이 네가 제일 익숙한 쪽이야. 경고음은 내가 줄일게.' }, { who, text: '아, 그런 이유면 할 수 있어.', expr: 'relief' }]);
      this.flag('c3_panel_asked');
    }
    await wiringGame(this.app.modals, { mode: this.mode, variant: this.variant, reduced: this.app.reduced, onSensorInfo: (s) => this.sensorInfo(s) });
    this.tick(2);
    if (this.comm) {
      const who = pickSpeaker('c3Comment', crew);
      await this.app.say([
        { who, text: isCandidateId(who) && (who === 'taeo' || who === 'jio') ? (who === 'taeo' ? '저 B 잡음, 배선에 재가 낀 모양이야. 근데 C가 더 신경 쓰여.' : 'C가 조용히 떨어지는 게 더 수상해요, 아마도!') : 'B는 시끄럽기만 하고, C는 조용히 떨어지네.' },
        { who: 'dam', text: '좋아, 다들 같은 걸 보고 있어.' },
      ]);
    } else {
      await this.app.say([
        { who: 'narrator', text: '헤드셋 너머 경보음이 멀어진다. 파형만 보인다.' },
        { who: 'narrator', text: 'B는 시끄럽게 튀고, C는 조용히 가라앉는다.' },
      ]);
    }
    let accepted = this.app.forkMemo('c3-auto-check') !== 'manual';
    if (this.m.flags.c3_c_asked !== true) {
      const id = await this.app.fork({
        opp: 'C3-O03', dim: 'C', optionSetId: 'c3-auto-check', scene: 'C3 자동 진단 결과를 받았을 때',
        line: { who: 'noknok', text: '자동 진단 완료! 센서 B 배선 오염으로 보여요. 누설은 아니래요.' },
        options: [{ id: 'accept', label: '자동 진단 결과 그대로 수용', pole: -1 }, { id: 'manual', label: '수동 재측정', pole: 1 }],
      });
      accepted = id === 'accept';
      this.flag('c3_c_asked');
    }
    await this.app.say([
      accepted
        ? { who: 'noknok', text: 'B 배선을 정리했어요. 경보가 꺼... 어? C 구간 압력이 아직 조금씩 떨어져요.' }
        : { who: 'narrator', text: '재측정 결과: B는 배선 오염, C 구간은 실제 미세 누설.' },
      { who: 'dam', text: '원인은 둘이야. 시끄러운 경보는 가짜였고, 조용한 쪽이 진짜였어.' },
      { who: 'noknok', text: '밸브 V2 미세 누설. 이대로는 발사 안전 기준을 못 채워요.' },
      { who: 'narrator', text: '밀봉 링 틈에 초록 부스러기가 끼어 있다. ...먼지겠지.' },
    ]);
    OPPS.forEach((id) => this.app.closeOpp(id));
    this.flag('c3_diagnosed');
    this.app.mission.dispatch({ type: 'goto', fsm: 'c3_scale' });
    await this.scaleStep();
  }

  private voice(def: VoiceDef, fallback: [SpeakerId, string]): Voice {
    const crew = this.m.crewIds;
    const hit = def.find((d) => crew.includes(d.who));
    const [who, text] = hit ? [hit.who as SpeakerId, hit.text] : fallback;
    const info = this.app.speaker(who);
    return { name: info.name, portrait: info.look ? portraitURL(info.look, 'worry') : info.icon ?? null, text };
  }

  private async scaleStep(): Promise<void> {
    this.scene?.setAlarm(true);
    const m = this.m;
    const plan = spareValvePlan(m.inventoryIds, m.crewIds);
    const spareDesc = plan.consume
      ? '실어 온 예비 부품(4kg)으로 V2를 직접 교체한다. 예비 부품은 여기서 다 쓴다.'
      : plan.needKg > 0
        ? `아크의 하나뿐인 예비 밸브 모듈을 쓴다. 추가 연소 때문에 짐을 ${plan.needKg.toFixed(1)}kg 이상 덜어 내야 하고, 화성 가는 길의 물 회수 장치용 예비도 사라진다.`
        : '아크의 하나뿐인 예비 밸브 모듈을 쓴다. 실은 짐이 없어 덜어 낼 것은 없지만, 화성 가는 길의 물 회수 장치용 예비가 사라진다.';
    const choice = await scalePanel(this.app.modals, {
      title: '저울 · 지구의 마지막 창',
      subtitle: '안전 기준은 어느 길로든 채운다. 무엇으로 값을 치를까? (이 선택은 성격 결과에 쓰이지 않아요)',
      options: [
        { id: 'boram', title: '보람의 수동 리셋', desc: '가장 빠르다. 보람이 재가 내리는 갠트리로 나가 밸브를 손으로 다시 앉힌다. 그의 이후는 알 수 없다.', cost: '대가: 남는 사람의 위험', support: this.voice(VOICES.boram.support, VOICES.boram.supportFallback), worry: this.voice(VOICES.boram.worry, VOICES.boram.worryFallback) },
        { id: 'spare', title: '예비 밸브 전환', desc: spareDesc, cost: plan.consume ? '대가: 예비 부품' : '대가: 짐과 앞으로의 물 여유', support: this.voice(VOICES.spare.support, VOICES.spare.supportFallback), worry: this.voice(VOICES.spare.worry, VOICES.spare.worryFallback) },
        { id: 'recal', title: '자체 재보정 후 대기', desc: '센서를 처음부터 다시 맞추고 기다린다. 좁아진 발사 창으로 떠나야 해서 선체가 크게 흔들린다.', cost: '대가: 선체 무결성(-10)과 시간', support: this.voice(VOICES.recal.support, VOICES.recal.supportFallback), worry: this.voice(VOICES.recal.worry, VOICES.recal.worryFallback) },
      ],
    });
    // 대가를 한 번에(동기적으로) 확정하고 c3_fix와 다음 단계까지 남긴 뒤에 대사를 보여 준다.
    // 예전에는 대사를 기다린 뒤 c3_fix를 남겨서, 대사 도중 새로고침하면 저울이 다시 열려 대가를 두 번 치렀다.
    let chosen: string[] = [];
    if (choice === 'spare' && !plan.consume && plan.needKg > 0) {
      const inv = itemsOf(m.crewIds, m.inventoryIds);
      for (;;) {
        chosen = await jettisonPicker(this.app.modals, {
          title: '덜어 낼 짐',
          intro: `추가 연소를 위해 ${plan.needKg.toFixed(1)}kg 이상을 투하해야 해요. 무엇을 내려놓을까요?`,
          needKg: plan.needKg,
          items: inv.map((i) => ({ id: i.id, name: i.name, kg: i.kg, icon: itemURL(i.id), note: i.owner ? `${iGa(CANDIDATES[i.owner].name)} 맡김` : undefined })),
        });
        if (jettisonOk(m.inventoryIds, chosen, m.crewIds)) break;
        toast(this.app.el.toast, '필요한 무게만큼 골라 주세요');
      }
    }
    if (choice === 'spare') {
      if (plan.consume) this.app.mission.dispatch({ type: 'removeItems', items: [plan.consume] });
      else {
        if (chosen.length) {
          this.app.mission.dispatch({ type: 'removeItems', items: chosen });
          this.flag('c3_jettison', JSON.stringify(chosen));
        }
        this.flag('c3_backup_used');
      }
    } else if (choice === 'recal') {
      applyOnce(this.app, 'c3recal', { delta: { habitatIntegrity: -10 } });
      this.tick(6);
    }
    this.flag('c3_fix', choice);
    this.app.mission.dispatch({ type: 'goto', fsm: 'c3_ignition' });
    if (choice === 'boram') {
      await this.app.say([
        { who: 'boram', text: '어차피 난 남아. 마지막으로 쓸모 있게 해 줘.' },
        { who: 'narrator', text: '보람이 안전모 끈을 조이고 탑승구 밖 갠트리로 나간다.' },
        { who: 'dam', text: '...고마워요.' },
      ]);
    } else if (choice === 'spare') {
      await this.app.say([plan.consume
        ? { who: 'noknok', text: '예비 부품 상자 개봉! V2 교체 완료.' }
        : { who: 'noknok', text: '예비 밸브 모듈 장착 완료. 물 회수 장치용 예비는... 이제 없어요.' }]);
    } else {
      await this.app.say([{ who: 'dam', text: '재보정 끝. 창이 좁아졌어. 많이 흔들릴 거야. 꽉 잡아.' }]);
    }
    await this.ignition();
  }

  private async ignition(): Promise<void> {
    const rough = this.m.flags.c3_fix === 'recal';
    this.scene?.setAlarm(false);
    await this.app.say([
      { who: 'dam', text: '점화 준비. 세 단계로 추력을 올린다.' },
      { who: 'noknok', text: '초록 띠 안에 바늘을 유지해 주세요! 어려우면 저한테 맡겨도 돼요. 실패는 없어요.' },
    ]);
    await ignitionGame(this.app.modals, { reduced: this.app.reduced, rough, onShake: (st) => this.scene?.shake(600, (rough ? 0.008 : 0.004) * (st + 1)) });
    this.flag('c3_ignited');
    await this.playLaunch(rough);
    this.app.mission.dispatch({ type: 'goto', fsm: 'c3_ascent' });
    this.startCabin('space');
  }

  private playLaunch(rough: boolean): Promise<void> {
    return new Promise((resolve) => {
      this.app.hud.show(false);
      const caption = h('p', { class: 'launch-caption', 'aria-live': 'polite' });
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        this.launchUi?.remove();
        this.launchUi = null;
        resolve();
      };
      const init: LaunchInit = {
        reduced: this.app.reduced,
        boram: this.m.flags.c3_fix === 'boram',
        rough,
        onCaption: (t) => { caption.textContent = t ?? ''; caption.classList.toggle('show', Boolean(t)); },
        onDone: finish,
      };
      const skip = h('button', { class: 'btn small launch-skip', type: 'button', onClick: finish }, '건너뛰기');
      this.launchUi = h('div', { class: 'launch-ui' }, caption, skip);
      this.app.el.app.append(this.launchUi);
      this.app.startScene('launch', init);
    });
  }

  private async ascent(): Promise<void> {
    const crew = this.m.crewIds;
    this.scene?.setView('space');
    this.app.hud.show(true);
    const lines: { who: SpeakerId | 'narrator' | 'radio' | 'mirror'; text: string; expr?: 'joy' | 'worry' | 'relief' }[] = [];
    if (crew.includes('woojoo')) lines.push({ who: 'woojoo', text: '내 녹차! ...아, 뚜껑 닫혀 있었다.', expr: 'joy' });
    lines.push({ who: pickSpeaker('lastWater', crew), text: '내가 오늘 아침에 마신 물이, 지구의 마지막 물이었네.' });
    const heart = resolveRole('heart', crew);
    lines.push(heart
      ? { who: 'narrator', text: `흔들림이 멎자, ${iGa(CANDIDATES[heart].name)} 말없이 당신의 손을 잡는다.` }
      : { who: 'narrator', text: '흔들림이 멎자, 담이 조종간에서 한 손을 떼어 당신의 어깨를 두드린다.' });
    if (this.m.flags.c3_fix === 'boram') {
      lines.push({ who: 'radio', text: '잘 가요. ...아니, 잘 살아요.' }, { who: 'narrator', text: '잡음. 지상 채널이 닫힌다.' });
    }
    lines.push(
      { who: 'narrator', text: "담이 조종석 화면 구석에서 '아크-04 최종 항로 로그'를 1초 열었다 닫는다." },
      { who: 'mirror', text: 'MIRROR입니다. 환영합니다, 정착민 0명. 정정. 6명.' },
      { who: 'noknok', text: '...방금 MIRROR한테 질투 난 것 같아요. 오류인가 봐요.' },
    );
    await this.app.say(lines);
    this.flag('c3_launched');
    this.app.mission.dispatch({ type: 'goto', fsm: 'c4_play' });
    void this.app.beginChapter(4);
  }
}
