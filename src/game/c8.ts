import type { App } from './app';
import { Explore, type Spot } from './explore';
import { react } from './gags';
import { aliveCrew, lostCrew } from '../story/sacrifice';
import { applyOnce, askFork, chemistryPairs, infoTabs, reflect, requestPanel } from './common';
import { talkLines } from './c2';
import type { BunkerScene } from '../world/BunkerScene';
import { CANDIDATES } from '../story/candidates';
import { affFromFlags, cargoAff, E, endingOf, podItems, C8_METHOD, type EndingId } from '../story/effects';
import { cargoPool, itemsOf } from '../story/cargo';
import { unselectedOf } from '../story/roster';
import { DOOR_LABEL, DOOR_POSITION, type Door } from '../story/content';
import { eulReul, iGa, waGwa } from '../story/josa';
import { TALK } from '../story/talk';
import { simpleList } from '../ui/mini';
import { scalePanel, type Voice } from '../ui/scale';
import { h, clear } from '../ui/dom';
import type { ModalHandle } from '../ui/panels';
import { portraitURL } from '../art/sprites';
import { NPC_LOOKS } from '../art/look';
import { C8_MAP, C8_SPOTS } from '../art/maps';
import { CHAPTER_TITLE, isCandidateId, type CandidateId, type SpeakerId } from '../shared/ids';

const OPPS = ['C8-O01', 'C8-O02', 'C8-O03', 'C8-O04', 'C8-O05'];
const DUTIES = ['전력', '농장', '정비', '기록'];
const SHIFTS = ['아침', '낮', '밤'];
const RANK: Record<Door, number> = { notNow: 0, conditional: 1, accept: 2 };

/** 바이블 §6 엔딩 장면 */
export const ENDING_TEXT: Record<EndingId, { title: string; lines: string[] }> = {
  dawn: { title: '새벽의 정비사들', lines: ['돔의 작은 불이 하나씩 켜진다.', '정비 교대가 시작된다. 첫 줄은 내일 새벽 다섯 시.'] },
  memory: { title: '기억을 심는 사람들', lines: ['벽에 지구의 기록이 흐른다.', '새싹 옆에 이름표가 하나씩 꽂힌다.'] },
  together: { title: '서로의 공기', lines: ['모두가 한 장의 도면을 함께 그린다.', '연필이 여섯 개, 지우개는 하나.'] },
  rebuild: { title: '천천히, 살아남기', lines: ['넉넉지 않은 예비 자원 속에서, 현실적인 복구 계획표를 벽에 붙인다.', '천천히. 그래도 매일.'] },
};

export const ANSWERS: Record<string, string> = {
  protect: '남은 사람을 지키려고.',
  remember: '사라진 사람을 기억하려고.',
  morning: '언젠가 여기서도 평범한 아침을 맞으려고.',
};

/** 문(門) 결정 규칙. 승선자만 발언하고, 하린은 플레이어를 따른다. MIRROR·녹녹이는 투표권 없음. */
export function decideDoor(method: string, crew: readonly CandidateId[], vote: Door, damCall: boolean): { outcome: Door; explain: string } {
  const pos = (c: CandidateId): Door => { const p = DOOR_POSITION[c].pos; return p === 'follow' ? vote : p; };
  const votes: Door[] = [vote, ...crew.map(pos), ...(damCall ? ['accept' as Door] : [])];
  if (method === 'expert') {
    const expert = crew.includes('taeo') ? 'taeo' : crew.includes('woojoo') ? 'woojoo' : null;
    const outcome = expert ? pos(expert) : damCall ? 'accept' : 'conditional';
    return { outcome, explain: `자원 책임자${expert ? `(${CANDIDATES[expert].name})` : '(담)'}의 판단을 따른다.` };
  }
  if (method === 'consensus') {
    const outcome = votes.reduce((a, b) => (RANK[b] < RANK[a] ? b : a), 'accept' as Door);
    return { outcome, explain: '가장 신중한 입장이 채택된다. 지금은 받지 않겠다는 한 표는 거부권으로 작동한다.' };
  }
  const count: Record<Door, number> = { accept: 0, conditional: 0, notNow: 0 };
  votes.forEach((v) => { count[v] += 1; });
  const max = Math.max(...Object.values(count));
  const top = (Object.keys(count) as Door[]).filter((k) => count[k] === max);
  return { outcome: top.length === 1 ? top[0] : 'conditional', explain: '평시에는 다수결로 정한다. 동률이면 조건부로.' };
}

/** C8 · FIRST SOL — 첫 저녁, 정착지 설계 보드, 결정 방식(저울 8)과 문, 대답, 이름, 엔딩, 선택의 거울 */
/** 문장을 두 개씩 한 줄로 묶는다 */
const pairUp = (xs: readonly string[]): string[] => xs.reduce<string[]>((acc, x, i) => (i % 2 === 1 ? [...acc.slice(0, -1), `${acc[acc.length - 1]} ${x}`] : [...acc, x]), []);

export class C8Flow {
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
      map: C8_MAP,
      start: C8_SPOTS.start,
      actors: () => [
        ...crew.map((id, i) => ({ id, look: CANDIDATES[id].look, x: C8_SPOTS.seats[i].x, y: C8_SPOTS.seats[i].y, facing: (i < 2 ? 'down' : 'up') as 'down' | 'up', name: CANDIDATES[id].name })),
        { id: 'dam', look: NPC_LOOKS.dam, x: C8_SPOTS.dam.x, y: C8_SPOTS.dam.y, name: '담' },
      ],
      spots: () => this.spots(),
      onInteract: (id) => this.interact(id),
      onReady: (s) => {
        this.scene = s;
        const inv = this.m.inventoryIds;
        if (inv.includes('games')) s.addProp('games', 240, 182, 14, 9, 0xf48b70);
        if (inv.includes('photo')) s.addProp('photo', 52, 100, 12, 9, 0x9fd8e8);
        if (this.m.flags.ilkkun === true) s.addProp('ilkkun', 420, 230, 18, 10, 0xc9a43a);
        void this.explore?.run(async () => {
          await this.dinner();
          // 문(門) 결정 뒤 새로고침했다면 대답·이름·엔딩으로 이어 간다. 예전에는 식탁이 사라져 엔딩에 영영 갈 수 없었다.
          if (typeof this.m.flags.c8_door === 'string' && !this.has('c8_done')) await this.meeting();
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
    if (this.m.chapter !== 'C8') return;
    this.app.hud.setTop(`C8 · ${CHAPTER_TITLE.C8}`, null);
    this.app.hud.setResources(this.m.resources);
    this.app.hud.setObjectives('우리가 만들 첫 번째 규칙', [
      { text: '첫 저녁', done: this.has('c8_dinner') },
      { text: '설계 보드에서 초안과 근무표', done: this.has('c8_board'), spot: 'board' },
      { text: '식탁에서 회의: 결정 방식과 문', done: typeof this.m.flags.c8_door === 'string', spot: 'table' },
      { text: '마지막 대답과 이름', done: this.has('c8_charter') },
    ]);
  }

  private spots(): Spot[] {
    const crew = aliveCrew(this.m);
    return [
      ...crew.map((id, i) => ({ id, ...C8_SPOTS.seats[i], r: 24, label: CANDIDATES[id].name, verb: '이야기하기' })),
      { id: 'dam', ...C8_SPOTS.dam, r: 24, label: '담', verb: '이야기하기' },
      { id: 'board', ...C8_SPOTS.board, r: 34, label: '정착지 설계 보드', verb: this.has('c8_board') ? '살펴보기' : '열기', tag: true, when: () => this.has('c8_dinner') },
      { id: 'table', ...C8_SPOTS.table, r: 34, label: '식탁', verb: '회의 시작하기', tag: true, when: () => this.has('c8_board') && typeof this.m.flags.c8_door !== 'string' },
      { id: 'photo', ...C8_SPOTS.photo, r: 30, label: '사진 벽', verb: '바라보기', tag: true },
      { id: 'sprouts', ...C8_SPOTS.sprouts, r: 30, label: '새싹 화분', verb: '들여다보기', tag: true },
      { id: 'window', ...C8_SPOTS.window, r: 30, label: '돔 창', verb: '바라보기', tag: true },
    ];
  }

  private sproutLine(): string {
    const inv = this.m.inventoryIds;
    if (inv.includes('soil')) return '지구 흙 화분에서 첫 싹이 올라왔다.';
    if (inv.includes('seeds') || inv.includes('legacy_seeds')) return '가져온 씨앗 화분에서 첫 싹이 올라왔다.';
    if (aliveCrew(this.m).includes('woojoo')) return '붉은감자-7의 싹 옆에, 찻잎 하나가 고개를 든다.';
    return '돔 농장 기본 종자에서 첫 싹이 올라왔다.';
  }

  private async dinner(): Promise<void> {
    if (this.has('c8_dinner')) return;
    const app = this.app;
    const crew = aliveCrew(this.m);
    const [pair] = chemistryPairs(app, 1, 'c8-dinner');
    await app.say([
      { who: 'narrator', text: `${lostCrew(this.m).length ? `화성의 첫 저녁. 둥근 테이블에 접시 ${2 + crew.length}개, 그리고 비워 둔 자리 ${lostCrew(this.m).length}개.` : '화성의 첫 저녁. 둥근 테이블에 여섯 개의 접시.'} ${this.sproutLine()}` },
      ...(pair ? [{ who: pair[0], text: pair[1] }, { who: pair[2], text: pair[3] }] : []),
      ...(crew.includes('woojoo') ? [{ who: 'woojoo' as const, text: '마지막 티백이야. 화성 첫 녹차, 한 모금씩!' }, { who: 'noknok' as const, text: '80도예요! ...저는 냄새만 맡을게요. 냄새도 못 맡지만요.' }] : []),
      ...(lostCrew(this.m).length ? [{ who: 'narrator' as const, text: `${lostCrew(this.m).map((c) => CANDIDATES[c].name).join(', ')}의 자리에도 컵을 놓는다. 아무도 먼저 그 이야기를 꺼내지 않지만, 다들 그쪽을 한 번씩 본다.` }] : []),
      { who: 'mirror', text: '아크-04의 자동 메시지입니다. 발신 시각이 C4 이전이라 지금의 상태는 알 수 없습니다.' },
      { who: 'broadcast', text: '약 26개월 뒤 우리 궤도가 다시 화성에 가까워집니다. 세 명. 받아 줄 수 있습니까?' },
      { who: 'mirror', text: '돔은 여섯 명 기준으로 지어졌습니다.' },
      ...talkLines('dam', TALK.C8.dam ?? []),
      { who: 'thought', text: '규칙이 없다. 지구의 방식을 그대로 가져올 권리는, 여기 누구에게도 없다.' },
      { who: 'noknok', text: '정착지 설계 보드를 열어 둘게요. 벽에 있어요!' },
    ]);
    OPPS.forEach((id) => app.openOpp(id));
    this.flag('c8_dinner');
    await reflect(this.app, 'C8');
  }

  private async interact(id: string): Promise<void> {
    const app = this.app;
    if (isCandidateId(id) || id === 'dam') {
      const key = `talk_c8_${id}`;
      const list = TALK.C8[id] ?? [];
      await app.say(talkLines(id, this.has(key) ? list.slice(-1) : list));
      this.flag(key);
      return;
    }
    switch (id) {
      case 'board': if (!this.has('c8_board')) await this.board(); else await app.say([{ who: 'narrator', text: '보드에 근무표와 초안이 붙어 있다. 아직 결정 방식 칸은 비어 있다.' }]); return;
      case 'table': await this.meeting(); return;
      case 'photo': await app.say([{ who: 'narrator', text: this.m.inventoryIds.includes('photo') ? '지구에서 가져온 사진이 벽에 붙어 있다. 대피소 벽에 있던 그 자리처럼.' : '사진 벽은 아직 비어 있다. 첫 사진은 오늘 저녁이 될지도.' }]); return;
      case 'sprouts': await app.say([{ who: 'narrator', text: this.sproutLine() }, ...(aliveCrew(this.m).includes('woojoo') ? [{ who: 'narrator' as const, text: "이름표: '화성산 녹차 1호(예정)'." }] : [])]); return;
      case 'window': await app.say([{ who: 'narrator', text: '창밖은 붉은 저녁. 지구 쪽 하늘에 아주 작은 점 하나.' }]); return;
      default:
    }
  }

  private shiftBoard(plan: boolean): Promise<string[][]> {
    const people: { id: string; name: string }[] = [
      { id: 'player', name: this.m.player.name }, { id: 'dam', name: '담' },
      ...aliveCrew(this.m).map((c) => ({ id: c, name: CANDIDATES[c].name })),
    ];
    return new Promise((resolve) => {
      const grid: (string | null)[][] = DUTIES.map(() => SHIFTS.map(() => null));
      const body = h('div', { class: 'shift' });
      const ok = h('button', { class: 'btn primary auto-next', type: 'button' }, '근무표 확정');
      let handle: ModalHandle | null = null;
      let rows = plan ? DUTIES.length : 1;
      // 사람이 일보다 적으면(희생으로 줄었을 때) 한 사람이 같은 교대에 여러 일을 겸한다(그렇지 않으면 표를 채울 수 없다)
      const conflict = (d: number, s: number, pid: string): boolean => people.length >= DUTIES.length && grid.some((row, i) => i !== d && row[s] === pid);
      const render = (): void => {
        clear(body);
        body.append(
          h('p', {}, plan ? '전력·농장·정비·기록 × 3교대를 한눈에 보며 채우세요. 같은 교대에 한 사람이 두 일을 맡을 수는 없어요.' : '한 줄씩 채워 가며 정하세요. 같은 교대에 한 사람이 두 일을 맡을 수는 없어요.'),
          h('table', { class: 'shift-table' },
            h('thead', {}, h('tr', {}, h('th', {}, ''), ...SHIFTS.map((s) => h('th', {}, s)))),
            h('tbody', {}, ...DUTIES.slice(0, rows).map((d, di) => h('tr', {}, h('th', {}, d), ...SHIFTS.map((_, si) => {
              const cur = grid[di][si];
              const cycle = (): void => {
                const avail = people.filter((p) => !conflict(di, si, p.id));
                const idx = cur ? avail.findIndex((p) => p.id === cur) : -1;
                grid[di][si] = avail[(idx + 1) % avail.length]?.id ?? null;
                if (!plan && grid[di].every(Boolean) && rows < DUTIES.length && di === rows - 1) rows += 1;
                render();
              };
              return h('td', {}, h('button', { class: `btn tiny${cur ? ' on' : ''}`, type: 'button', 'aria-label': `${d} ${SHIFTS[si]} 담당 바꾸기`, onClick: cycle }, cur ? people.find((p) => p.id === cur)?.name ?? '' : '비어 있음'));
            })))),
          ),
        );
        ok.toggleAttribute('disabled', grid.some((row) => row.some((x) => !x)));
      };
      ok.addEventListener('click', () => { handle?.close(); resolve(grid.map((row) => row.map((x) => x ?? ''))); });
      render();
      handle = this.app.modals.open({ title: '근무표 (전력·농장·정비·기록 × 3교대)', body, cls: 'wide', closable: false, footer: h('div', { class: 'row' },
        h('button', { class: 'btn assist', type: 'button', onClick: () => { DUTIES.forEach((_, d) => SHIFTS.forEach((__, s) => { grid[d][s] = people[(d + s * 2) % people.length].id; })); rows = DUTIES.length; render(); } }, '녹녹이에게 맡기기'), ok) });
    });
  }

  private async board(): Promise<void> {
    const app = this.app;
    const open = await app.choose({ who: 'noknok', text: '헌장 초안을 쓰기 전에 자료를 볼까요?' }, [{ id: 'open', label: '자원 장부 열어 보기' }, { id: 'skip', label: '바로 시작하기' }]);
    if (open === 'open') {
      const r = this.m.resources;
      await infoTabs(app, {
        opp: 'C8-O01', setId: 'c8-ledger', title: '자원 장부', scene: 'C8 자원 장부',
        sLabel: '자원 실측 장부', sLines: [`산소 ${Math.round(r.oxygenReserve)} · 물 ${Math.round(r.water)} · 식량 ${Math.round(r.food)} · 전력 ${Math.round(r.power)}`, `물 확보 ${Math.round(r.waterSecurity)} · 종자 ${Math.round(r.seedVault)} · 기록 ${Math.round(r.archive)}`],
        nLabel: '26개월 시나리오 전망', nLines: ['3명이 더 오면 식량 생산을 1.5배로 늘려야 한다', '확장 모듈이 완성되면 여유가 생긴다', '다음 지구 발사창은 그보다 늦다'],
      });
    }
    const v = await askFork(app, { opp: 'C8-O02', dim: 'O', optionSetId: 'c8-draft', scene: 'C8 헌장 초안을 시작할 때', line: { who: 'noknok', text: '운영 규칙 초안은 어떻게 시작할까요?' }, plus: '초안 여러 개 나란히 비교', minus: '기본 템플릿 하나로 시작' });
    if (v === 'plus') await simpleList(app.modals, '초안 비교', ['초안 A: 전문가 중심', '초안 B: 모두 합의', '초안 C: 역할별 책임'], '비교 끝');
    else if (v === 'minus') await simpleList(app.modals, '기본 템플릿', ['1조 결정 방식', '2조 일 나누기', '3조 문(門)'], '이걸로 시작');
    const jp = await askFork(app, { opp: 'C8-O03', dim: 'JP', optionSetId: 'c8-board', scene: 'C8 근무표를 만들 때', line: { who: 'noknok', text: '업무표는 어떻게 만들까요?' }, plus: '전체 표 먼저 짜기', minus: '한 칸씩 채우며 보기' });
    const grid = await this.shiftBoard(jp !== 'minus');
    this.flag('c8_shift', JSON.stringify(grid));
    const c = await askFork(app, { opp: 'C8-O03', dim: 'C', optionSetId: 'c8-verify', scene: 'C8 근무표 검증', line: { who: 'mirror', text: '근무표 자동 검증 완료. 같은 교대의 겹침 없음.' }, plus: '직접 재점검', minus: 'MIRROR 자동 검증 수용' });
    if (c === 'plus') await simpleList(app.modals, '근무표 점검', DUTIES.map((d, i) => `${d}: ${grid[i].map((p) => this.nameOf(p)).join(' · ')}`), '확인했어요');
    else if (c === 'minus') await app.say([{ who: 'noknok', text: '좋아요!' }]);
    const so = await askFork(app, { opp: 'C8-O04', dim: 'E', optionSetId: 'c8-talk', scene: 'C8 헌장 초안을 다듬을 때', line: { who: 'noknok', text: '초안을 다듬는 동안은요?' }, plus: '동료에게 직접 의견 묻기', minus: '혼자 초안 다듬기' });
    if (so === 'plus') await app.say([{ who: aliveCrew(this.m)[0] ?? 'dam', text: '나는 이 문장이 좋아. 「아침마다 함께 계기를 읽는다」.' }]);
    else if (so === 'minus') await app.say([{ who: 'narrator', text: '보드 앞에서 문장을 하나씩 고친다. 지운 단어가 쓴 단어보다 많다.' }]);
    await requestPanel(app, {
      opp: 'C8-O05', setId: 'c8-meeting', slot: 'c8Meeting', title: '회의 진행 요청', scene: 'C8 회의 진행 요청',
      request: '회의 때 나는 말 대신 글로 의견을 내도 될까? 말로 하면 자꾸 목이 막혀서.',
      tLabel: '자원 제약 수치 보기', tLines: ['안건 3개 · 예상 40분', '글로 받아도 회의 시간은 같다'],
      fLabel: '반대 의견 메모 보기', fLines: ['말로 하면 목이 막힌다고 적었다.', '다른 승무원: 모두가 같은 방식으로 말하는 게 공정하다고 적었다.'],
      adjust: '요청대로 진행 방식 조정하기', keep: '기존 진행 유지하고 이유 설명하기',
      adjustReply: '고마워. 쪽지에 다 적어 올게.', keepReason: '첫 회의는 모두 같은 방식으로 말해 보기로 했어요. 대신 천천히 기다릴게요.',
    });
    OPPS.forEach((oid) => app.closeOpp(oid));
    this.flag('c8_board');
    await app.say([{ who: 'dam', text: '정하는 방식부터 정하자. 식탁에 모여.' }]);
  }

  private nameOf(id: string): string {
    return id === 'player' ? this.m.player.name : id === 'dam' ? '담' : CANDIDATES[id as CandidateId]?.name ?? '';
  }

  private voice(list: { who: CandidateId; text: string }[], fb: [SpeakerId, string]): Voice {
    const hit = list.find((v) => aliveCrew(this.m).includes(v.who));
    const [who, text] = hit ? [hit.who as SpeakerId, hit.text] : fb;
    const info = this.app.speaker(who);
    return { name: info.name, portrait: info.look ? portraitURL(info.look, 'worry') : info.icon ?? null, text };
  }

  private nameModal(): Promise<string> {
    return new Promise((resolve) => {
      const input = h('input', { class: 'input', type: 'text', maxlength: '12', value: '첫새벽', 'aria-label': '정착지 이름' }) as HTMLInputElement;
      let handle: ModalHandle | null = null;
      const done = (): void => { const v = input.value.trim().slice(0, 12) || '첫새벽'; handle?.close(); resolve(v); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
      handle = this.app.modals.open({ title: '정착지 이름', body: h('div', {}, h('p', {}, '이곳을 뭐라고 부를까요?'), input), footer: h('button', { class: 'btn primary', type: 'button', onClick: done }, '이 이름으로'), closable: false });
      window.setTimeout(() => input.focus(), 50);
    });
  }

  private async meeting(): Promise<void> {
    const app = this.app;
    const crew = aliveCrew(this.m);
    if (typeof this.m.flags.c8_door !== 'string') {
      await app.say([{ who: 'narrator', text: '식탁 위에 초안이 놓인다. 마지막 남은 질문은 하나다.' }]);
      const method = typeof this.m.flags.c8_method === 'string' ? this.m.flags.c8_method : await scalePanel(app.modals, {
        title: '저울 · 우리는 어떻게 결정하는가',
        subtitle: '어떤 방식도 정답이 아니다. 무엇을 지키고, 무엇을 감수할까? (성격 결과에 쓰이지 않아요)',
        options: [
          { id: 'expert', title: '전문가 위임', desc: '분야 책임자가 정한다.', cost: '대가: 소수의 목소리', support: this.voice([{ who: 'taeo', text: '아는 사람이 정하는 게 빨라.' }, { who: 'seojin', text: '숫자를 아는 사람이 책임져야지.' }], ['dam', '위기엔 빠른 게 살린다.']), worry: this.voice([{ who: 'dodam', text: '조용한 목소리는 사라져요.' }, { who: 'harin', text: '책임자가 틀리면?' }], ['noknok', '한 사람이 너무 무거워져요.']) },
          { id: 'consensus', title: '거부권 있는 합의제', desc: '모두가 동의해야 한다. 한 사람의 반대가 거부권이 된다.', cost: '대가: 속도', support: this.voice([{ who: 'dodam', text: '모두의 이름이 들어간 결정이에요.' }, { who: 'harin', text: '누구도 두고 가지 않는 방식이야.' }], ['noknok', '모두 고개를 끄덕여야 해요.']), worry: this.voice([{ who: 'taeo', text: '위기 땐 너무 느려.' }, { who: 'jio', text: '한 명이 막으면 끝이에요.' }], ['dam', '느려서 놓치는 게 생길 거야.']) },
          { id: 'roles', title: '위기 땐 책임자 · 평시엔 다수결', desc: '위기엔 역할 책임자가, 평시엔 다수결로.', cost: '대가: 경계를 정하는 다툼', support: this.voice([{ who: 'jio', text: '상황마다 다르게! 좋아요.' }, { who: 'woojoo', text: '밭은 내가, 회의는 다 같이.' }], ['dam', '균형 잡힌 방식이야.']), worry: this.voice([{ who: 'seojin', text: '위기인지 아닌지는 누가 정해?' }, { who: 'dodam', text: '그 경계에서 다툼이 생겨요.' }], ['noknok', '경계선을 잘 그어야 해요.']) },
        ],
      });
      if (typeof this.m.flags.c8_method !== 'string') {
        applyOnce(app, 'c8method', E.c8Method(method as (typeof C8_METHOD)[number]));
        this.flag('c8_method', method);
      }
      const damCall = this.m.flags.c4_ark_choice === 'rendezvous';
      await app.say([
        ...crew.map((c) => ({ who: c as SpeakerId, text: DOOR_POSITION[c].line })),
        damCall ? { who: 'dam' as SpeakerId, text: '...받고 싶어. 그게 내 동생이라서인지 아닌지, 모르겠어.' } : { who: 'dam' as SpeakerId, text: '이번엔 기권할게. 내 판단은 아직 기울어 있어.' },
        { who: 'mirror', text: 'MIRROR와 녹녹이는 투표권이 없습니다. 정정. 투표권이 없어서 다행입니다.' },
      ]);
      const vote = (await app.choose({ who: 'thought', text: '내 표는?' }, [
        { id: 'accept', label: DOOR_LABEL.accept }, { id: 'conditional', label: DOOR_LABEL.conditional }, { id: 'notNow', label: DOOR_LABEL.notNow },
      ])) as Door;
      const res = decideDoor(String(this.m.flags.c8_method), crew, vote, damCall);
      applyOnce(app, 'c8door', E.c8Door(res.outcome));
      this.flag('c8_vote', vote);
      this.flag('c8_door', res.outcome);
      react(this.scene, crew, 'door', res.outcome);
      await app.say([
        { who: 'narrator', text: `${res.explain} 결과: ${DOOR_LABEL[res.outcome]}.` },
        { who: 'thought', text: '그날 나는 문 밖에 선 사람들 중에서 네 명을 골랐다. 오늘 나는 문 안에서 세 사람을 기다리는 쪽이 됐다.' },
      ]);
    }
    if (!this.has('c8_charter')) {
      const answer = await app.choose({ who: 'dam', text: '왜 화성까지 왔는지 알아? 지금도 여기가 지구보다 살기 좋아서 온 건 아니야.' }, [
        { id: 'protect', label: ANSWERS.protect }, { id: 'remember', label: ANSWERS.remember }, { id: 'morning', label: ANSWERS.morning },
      ]);
      this.flag('c8_answer', answer);
      const name = await this.nameModal();
      this.flag('c8_name', name);
      const method = String(this.m.flags.c8_method);
      let grid: string[][] = [];
      try { grid = JSON.parse(String(this.m.flags.c8_shift)) as string[][]; } catch { grid = []; }
      const door = this.m.flags.c8_door as Door;
      await simpleList(app.modals, `${name} — 화성 첫날의 약속`, [
        `① 우리는 ${method === 'expert' ? '분야 책임자의 판단으로' : method === 'consensus' ? '모두의 합의로(한 사람의 반대도 거부권이 된다)' : '위기엔 역할 책임자가, 평시엔 다수결로'} 결정한다.`,
        `② 우리는 ${DUTIES.map((d, i) => `${d}(${(grid[i] ?? []).map((p) => this.nameOf(p)).filter(Boolean).join('·')})`).join(', ')}을 3교대로 나눠 맡는다.`,
        `③ 다가오는 사람에게 우리는 문을 ${door === 'accept' ? '연다' : door === 'conditional' ? '확장 모듈이 완성되면 연다' : '지금은 닫아 두고, 다시 묻는다'}.`,
      ], '서명하기');
      this.flag('c8_charter');
    }
    await this.ending();
  }

  /**
   * 마지막 반전: 희대의 빌런 진우주(이야기 연출 전용. 엔딩 판정이 끝난 뒤라 결과·점수에 영향이 없다).
   * 태웠다면 그 자리에서, 희생시켰다면 죽음을 위장하고 온실에서, 태우지 않았다면 화물칸 밀항자로 나타난다.
   */
  private async villainTwist(): Promise<void> {
    const app = this.app;
    const m = this.m;
    if (m.flags.twist_done === true) return;
    const here = aliveCrew(m).includes('woojoo');
    const faked = lostCrew(m).includes('woojoo');
    await simpleList(app.modals, 'MIRROR 정밀 로그 — 설명되지 않는 기록 4건', [
      '탑승 추첨 서버: 접속 계정 NOKCHA-0, 추첨 직전 결과 수정 시도 1회',
      'C3 기밀 밸브 V2 밀봉 링: 찻잎 섬유 검출',
      '종자 저장고 1,200계통 중 312봉투: 내용물이 녹차 씨앗으로 바뀜',
      '녹녹이 원본 코드 서명: J.WOOJOO',
    ], '...설마');
    const s = this.scene;
    if (!here) s?.addActor('woojoo', CANDIDATES.woojoo.look, C8_SPOTS.sprouts.x, C8_SPOTS.sprouts.y + 20, 'down', '진우주');
    s?.shake(500, 0.004);
    void s?.spin('woojoo', 2);
    const p = s?.posOf('woojoo');
    if (p) s?.burst(p.x, p.y, ['🍵', '🍃', '🍵'], 14);
    await app.say([
      ...(here
        ? [{ who: 'woojoo', text: '...들켰네.' }]
        : faked
          ? [{ who: 'narrator', text: '새싹 화분 뒤에서 누군가 걸어 나온다. 떠난 줄 알았던 얼굴이다.' }, { who: 'woojoo', text: '죽은 줄 알았지? 녹차는 식어도, 나는 안 식어.' }]
          : [{ who: 'narrator', text: '화물칸 쪽에서 덜컥 소리가 나더니, 지구에 남은 줄 알았던 얼굴이 걸어 나온다.' }, { who: 'woojoo', text: '수하물 무게가 매번 조금씩 안 맞았지? 그게 나야.' }]),
      { who: 'woojoo', text: '그래. 추첨도, 밸브도, 씨앗도, 녹녹이도. 전부 나야.' },
      { who: 'woojoo', text: '화성 첫 농장은 녹차밭이 된다. 너희는 처음부터 내 찻잔 속에 있었지! 하하하!', expr: 'joy' },
      { who: 'noknok', text: '아, 아빠...? 저를 만든 게...? 그런데 저는 녹차를 못 마시잖아요!' },
      { who: 'dam', text: '...밸브 누설도 너였어? 우리 다 죽을 뻔했어.' },
      { who: 'woojoo', text: '죽을 뻔했지, 안 죽었잖아. 정확히 계산했다고. ...아마도.' },
    ]);
    const c = await app.dialogue.choose({ who: 'thought', text: '희대의 빌런이 눈앞에 있다. 어떻게 할까?' }, [
      { id: 'jail', label: '헌장 제4조, 녹차 독점 금지. 일단 묶어 둔다' },
      { id: 'forgive', label: '용서하고, 녹차밭은 다 같이 가꾼다' },
      { id: 'noknok', label: '녹녹이에게 맡긴다' },
    ], 'free');
    this.flag('twist_choice', c);
    this.flag('twist_done');
    if (c === 'forgive') { const q = s?.posOf('player'); if (q) s?.burst(q.x, q.y, ['🍵', '🤝', '✨'], 12); }
    await app.say(c === 'jail'
      ? [{ who: 'dam', text: '헌장 제4조. 녹차 독점 금지. ...방금 만들었어.' }, { who: 'woojoo', text: '좋아. 감옥에도 찻잔 하나는 들여 줘.' }, { who: 'narrator', text: '돔의 첫 번째 재판은 차 한 잔으로 시작됐다.' }]
      : c === 'forgive'
        ? [{ who: 'woojoo', text: '...정말? 이런 결말은 계산에 없었는데.' }, { who: 'narrator', text: '그날 밤, 312개의 녹차 씨앗 봉투에 모두의 이름이 하나씩 적혔다.' }]
        : [{ who: 'noknok', text: '아빠, 다음엔 저도 마실 수 있는 차를 만들어 주세요. 그게 벌이에요.' }, { who: 'woojoo', text: '...그건 내 평생의 연구 과제가 되겠군.' }, { who: 'narrator', text: '희대의 빌런은 그날부터 화성 최초의 다도 교사가 되었다.' }]);
  }

  private mirrorPairs(): string[] {
    const m = this.m;
    const f = m.flags;
    const out = unselectedOf(m.crewIds).map((c) => CANDIDATES[c].name);
    const pool = cargoPool(m.crewIds);
    let sealed: string[] = [];
    try { sealed = JSON.parse(String(f.c2_cargo)) as string[]; } catch { sealed = []; }
    const took = itemsOf(m.crewIds, sealed).map((i) => i.name);
    const left = pool.filter((p) => !sealed.includes(p.id)).map((p) => p.name);
    let alloc: number[] = [0, 0, 0, 0];
    try { alloc = JSON.parse(String(f.c6_alloc)) as number[]; } catch { alloc = [0, 0, 0, 0]; }
    const kept = ['산소', '종자', '기록', '난방'].filter((_, i) => alloc[i] >= 3);
    const fix: Record<string, string> = { boram: '보람의 수동 리셋', spare: '예비 밸브 전환', recal: '자체 재보정' };
    const tgt: Record<string, string> = { ice: '얼음', ilkkun: '일꾼-3', third: f.pod_recovered === true ? '포드 회수' : '가까운 얼음' };
    const ark: Record<string, string> = { supply: '보급 캡슐', rendezvous: '랑데부', relay: '신호 중계' };
    const method: Record<string, string> = { expert: '전문가 위임', consensus: '합의', roles: '역할과 다수결' };
    const door = f.c8_door === 'accept' ? '열었다' : f.c8_door === 'conditional' ? '조건부로 열기로 했다' : '지금은 닫아 두었다';
    return [
      `C1 당신은 ${eulReul(out.map((n, i) => (i === out.length - 1 ? n : waGwa(n))).join(' '))} 남겨 두고 떠났다. ↔ C8 당신의 정착지는 문을 ${door}.`,
      `C2 당신은 ${took.length ? eulReul(took.join(', ')) : '아무것도 싣지 않는 쪽을'} 택했고, ${left.length ? eulReul(left.slice(0, 3).join(', ')) : '아무것도'} 두고 왔다. ↔ C6 72시간 동안 당신은 ${kept.length ? eulReul(kept.join('·')) : '고르게 나누는 쪽을'} 끝까지 지켰다.`,
      `C3 지구의 마지막 창에서 당신은 ${eulReul(fix[String(f.c3_fix)] ?? '―')} 택했다. ↔ C7 얼음과 메아리 사이에서 당신은 ${eulReul(tgt[String(f.c7_target)] ?? '―')} 택했다.`,
      `C4 대답 없는 지구에 당신은 ${ark[String(f.c4_ark_choice)] ?? '―'}로 답했다. ↔ C8 당신의 정착지는 ${method[String(f.c8_method)] ?? '―'}로 결정한다.`,
    ];
  }

  private async ending(): Promise<void> {
    const app = this.app;
    const m = this.m;
    const crew = m.crewIds;
    const aff = affFromFlags(m.flags);
    const ca = cargoAff(itemsOf(crew, m.inventoryIds));
    (Object.keys(aff) as (keyof typeof aff)[]).forEach((k) => { aff[k] += ca[k] ?? 0; });
    const end = endingOf(m.resources, aff);
    this.flag('ending', end.ending);
    const e = ENDING_TEXT[end.ending];
    const name = String(m.flags.c8_name ?? '첫새벽');
    const door = m.flags.c8_door as Door;
    const work: Record<CandidateId, string> = {
      harin: '하린이 모두의 소매를 꿰맨다.', taeo: '태오가 정비 일지 첫 장에 날짜를 적는다.', seojin: '서진이 의료 구역에 이름표를 붙인다.',
      woojoo: "진우주가 화분 이름표에 '화성산 녹차 1호'라고 적는다.", dodam: '도담이 오늘 저녁 소리를 녹음한다.', jio: '지오와 삽이 돔 확장 도면 위에 엎드려 있다.',
    };
    await app.say([
      { who: 'noknok', text: '지구에선 오늘이 마지막이었는데... 화성에선 오늘이 첫날이네요.' },
      { who: 'narrator', text: `엔딩 · ${e.title}` },
      { who: 'narrator', text: e.lines.join(' ') },
      // 동료들의 이후는 두 사람씩 한 줄로 묶는다(플레이 시간 단축, 내용은 같다)
      ...pairUp(aliveCrew(m).map((c) => work[c])).map((t) => ({ who: 'narrator' as const, text: t })),
      ...lostCrew(m).map((c) => ({ who: 'narrator' as const, text: `${CANDIDATES[c].name}의 자리에는 빈 의자와 작은 이름표가 놓여 있다.` })),
      { who: 'narrator', text: `${name}의 첫 번째 헌장. 문은 ${door === 'accept' ? '열려 있다' : door === 'conditional' ? '확장 모듈이 완성되면 열린다' : '지금은 닫혀 있지만, 다시 물을 것이다'}. 당신의 대답: ${ANSWERS[String(m.flags.c8_answer)] ?? ANSWERS.morning}` },
      ...(m.flags.ilkkun === true ? [{ who: 'narrator' as const, text: '돔 한구석에서 일꾼-3과 녹녹이가 서툰 춤을 춘다. 아무도 못 본 척한다.' }] : []),
      ...(m.flags.c4_ark_choice === 'rendezvous' ? [{ who: 'dam' as const, text: '26개월. 그때까지 의자 하나 비워 둘게.' }] : []),
      { who: 'narrator', text: '유리창 너머로 붉은 새벽이 번진다. 지구 쪽 하늘에, 자세히 보이지 않는 작은 점 하나.' },
    ]);
    await this.villainTwist();
    const out = unselectedOf(crew);
    // 맡긴 물건의 실제 위치: 실었다 → 돔 벽 / 회수 못 한 포드 → 화성 어딘가 / C3에서 투하 → 지구 / 싣지 않았다 → 지구
    const inPod = podItems(m.flags);
    let jettisoned: string[] = [];
    try { jettisoned = JSON.parse(String(m.flags.c3_jettison ?? '[]')) as string[]; } catch { jettisoned = []; }
    await simpleList(app.modals, '회상 — 함께 떠나지 않은 사람', out.map((c) => {
      const lid = CANDIDATES[c].legacy.id;
      const nm = CANDIDATES[c].name;
      const base = m.inventoryIds.includes(lid) ? `${nm}: ${iGa(CANDIDATES[c].legacy.name)} 돔 벽에 걸려 있다.`
        : inPod.includes(lid) ? `${nm}: 맡긴 물건은 회수하지 못한 화물 포드 안에, 붉은 땅 어딘가에 있다.`
          : jettisoned.includes(lid) ? `${nm}: 맡긴 물건은 발사 때 지구에 내려놓았다.`
            : `${nm}: 맡긴 물건은 지구에 남았다.`;
      return `${base}${c === 'woojoo' ? ' 초록 보온병이 떠오른다.' : ''} 그들의 이후는 알 수 없다.`;
    }), '다음');
    await simpleList(app.modals, '선택의 거울', [...this.mirrorPairs(), '이 화면의 내용은 성격 결과에 한 글자도 들어가지 않아요.'], '다음');
    await app.say([{ who: 'mirror', text: '저는 거울이에요. 여러분이 한 일만 비출 수 있어요. 여러분이 누구인지는 몰라요.' }]);
    await simpleList(app.modals, 'MIRROR', ['이제 당신이 반복해서 고른 것들을 보여 드릴게요.'], '내가 보여준 선택의 패턴 보기');
    OPPS.forEach((oid) => app.closeOpp(oid));
    this.flag('c8_done');
    app.mission.dispatch({ type: 'goto', fsm: 'results' });
    app.showResults();
  }
}
