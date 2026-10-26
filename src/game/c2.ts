import type { App } from './app';
import { Explore, type Spot } from './explore';
import { reflect } from './common';
import { react } from './gags';
import type { BunkerScene } from '../world/BunkerScene';
import { CANDIDATES } from '../story/candidates';
import { BAG_TALK, cargoPool, checkLayout, itemsOf, REQUESTS, totalKg, type CargoItem } from '../story/cargo';
import { pickSpeaker } from '../story/resolver';
import { eulReul, iGa } from '../story/josa';
import { unselectedOf } from '../story/roster';
import { TALK } from '../story/talk';
import { openCargoBoard, type CargoLayout } from '../ui/cargoBoard';
import { confirmPanel, infoPanel, lines, perspectivePanel, tabPanel, type ModalHandle } from '../ui/panels';
import { clear, h, pxImg, toast } from '../ui/dom';
import { portraitURL } from '../art/sprites';
import { itemCanvas } from '../art/items';
import { NPC_LOOKS } from '../art/look';
import { C2_MAP, C2_SPOTS } from '../art/maps';
import { CHAPTER_TITLE, isCandidateId, type CandidateId, type SpeakerId } from '../shared/ids';
import type { Line } from '../ui/dialogue';

const OPPS = ['C2-O01', 'C2-O02', 'C2-O03', 'C2-O04', 'C2-O05'];
const RACK = { left: { x: 46, y: 98 }, right: { x: 336, y: 98 } };

/** 탐색 대사 한 묶음을 Line[]으로: '('로 시작하면 행동 묘사 */
export function talkLines(who: SpeakerId, list: readonly string[]): Line[] {
  return list.map((t) => (t.startsWith('(') ? { who: 'narrator', text: t.replace(/^\(|\)$/g, '') } : { who, text: t }));
}

/** C2 · THE LAST BAG — 수하물실 탐색, 12kg 적재, 봉인(저울 2), 봉인 후 운영 단계 */
export class C2Flow {
  private readonly app: App;
  private explore: Explore | null = null;
  private scene: BunkerScene | null = null;
  private unsub: (() => void) | null = null;
  private guide = false;
  private memo: string[] = [];
  private board: ModalHandle | null = null;
  private ready: CargoLayout | null = null;
  private icons = new Set<string>();

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
    this.unsub = this.app.mission.subscribe(() => this.refreshHud());
    this.explore = new Explore(this.app, {
      map: C2_MAP,
      start: C2_SPOTS.start,
      actors: () => [
        ...crew.map((id, i) => ({ id, look: CANDIDATES[id].look, x: C2_SPOTS.crew[i].x, y: C2_SPOTS.crew[i].y, name: CANDIDATES[id].name })),
        { id: 'dam', look: NPC_LOOKS.dam, x: C2_SPOTS.dam.x, y: C2_SPOTS.dam.y, name: '담' },
      ],
      spots: () => this.spots(),
      onInteract: (id) => this.interact(id),
      onReady: (s) => {
        this.scene = s;
        this.drawCargo();
        void this.explore?.run(() => this.resume());
      },
    });
    this.explore.start();
    this.refreshHud();
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
    this.board?.close();
    this.board = null;
    this.explore?.stop();
  }

  private pool(): CargoItem[] {
    return cargoPool(this.m.crewIds);
  }

  private spots(): Spot[] {
    const crew = this.m.crewIds;
    const sealed = this.has('c2_sealed');
    return [
      ...crew.map((id, i) => ({ id, x: C2_SPOTS.crew[i].x, y: C2_SPOTS.crew[i].y, r: 26, label: CANDIDATES[id].name, verb: '이야기하기' })),
      { id: 'dam', x: C2_SPOTS.dam.x, y: C2_SPOTS.dam.y, r: 26, label: '담', verb: '이야기하기' },
      { id: 'rackL', ...C2_SPOTS.rackL, r: 30, label: '왼쪽 적재함', verb: '살펴보기', tag: true },
      { id: 'rackR', ...C2_SPOTS.rackR, r: 30, label: '오른쪽 적재함', verb: '살펴보기', tag: true },
      { id: 'legacy', ...C2_SPOTS.legacy, r: 28, label: '맡긴 물건 상자', verb: '열어 보기', tag: true },
      { id: 'conveyor', ...C2_SPOTS.conveyor, r: 34, label: '수하물 컨베이어', verb: '짐 고르기', tag: true, when: () => !sealed && this.has('c2_intro') },
      { id: 'console', ...C2_SPOTS.console, r: 28, label: '봉인 콘솔', verb: sealed ? '고정 점검하기' : '봉인하기', tag: true,
        when: () => (!sealed && this.ready !== null) || (sealed && this.has('c2_strap_asked') && !this.has('c2_hold_asked')) },
      { id: 'hatch', ...C2_SPOTS.hatch, r: 30, label: '객실 계단', verb: '올라가기', tag: true, when: () => this.has('c2_after_done') },
    ];
  }

  private draft(): CargoLayout {
    const ids = this.pool().map((p) => p.id);
    try {
      const raw = this.m.flags.c2_draft;
      if (typeof raw !== 'string') return { left: [], right: [] };
      const p = JSON.parse(raw) as Partial<CargoLayout>;
      const seen = new Set<string>();
      const clean = (a: unknown): string[] => (Array.isArray(a) ? a : []).filter((x): x is string => typeof x === 'string' && ids.includes(x) && !seen.has(x) && Boolean(seen.add(x)));
      return { left: clean(p.left), right: clean(p.right) };
    } catch {
      return { left: [], right: [] };
    }
  }

  private slots(): (CargoLayout | null)[] {
    try {
      const v = JSON.parse(String(this.m.flags.c2_slots ?? '[null,null,null]')) as (CargoLayout | null)[];
      return [0, 1, 2].map((i) => v[i] ?? null);
    } catch {
      return [null, null, null];
    }
  }

  /** 선반 위 짐 아이콘과 봉인 셔터 */
  private drawCargo(): void {
    const s = this.scene;
    if (!s) return;
    const sealed = this.has('c2_sealed');
    const layout = sealed ? this.draft() : this.draft();
    const next = new Set<string>();
    (['left', 'right'] as const).forEach((side) => {
      layout[side].slice(0, 10).forEach((id, i) => {
        const pid = `icon-${id}`;
        next.add(pid);
        if (!this.icons.has(pid)) s.addImageProp(pid, RACK[side].x + (i % 5) * 22 + 8, RACK[side].y + Math.floor(i / 5) * 22 + 6, `item-${id}`, () => itemCanvas(id));
      });
    });
    for (const pid of this.icons) if (!next.has(pid)) s.removeProp(pid);
    this.icons = next;
    if (sealed) {
      s.addProp('shutL', 95, 116, 126, 60, 0x8a93b8);
      s.addProp('shutR', 385, 116, 126, 60, 0x8a93b8);
    }
  }

  private refreshHud(): void {
    const m = this.m;
    if (!m.fsm.startsWith('c2')) return;
    this.app.hud.setTop(`C2 · ${CHAPTER_TITLE.C2}`, null);
    this.app.hud.setResources(m.resources);
    const d = this.draft();
    const kg = totalKg(itemsOf(m.crewIds, [...d.left, ...d.right]));
    this.app.hud.setObjectives('마지막 12킬로그램', [
      { text: `컨베이어에서 짐 고르기 ${kg.toFixed(1)}/12kg`, done: this.has('c2_sealed') || this.ready !== null, spot: 'conveyor' },
      { text: '봉인 콘솔에서 봉인', done: this.has('c2_sealed'), spot: 'console' },
      { text: '이륙 전 고정 점검', done: this.has('c2_after_done'), spot: 'console' },
      { text: '객실로 올라가기', done: false, spot: 'hatch' },
    ]);
  }

  private async resume(): Promise<void> {
    if (!this.has('c2_intro')) await this.intro();
    else if (this.has('c2_sealed') && !this.has('c2_strap_asked')) await this.postSeal();
    this.explore?.refresh();
  }

  private async intro(): Promise<void> {
    const out = unselectedOf(this.m.crewIds).map((c) => CANDIDATES[c].name);
    await this.app.say([
      { who: 'dam', text: '여기가 수하물실이야. 생명유지 필수품은 이미 실었어.' },
      { who: 'noknok', text: '녹녹! 추가로 실을 수 있는 건 12킬로그램이에요. 좌우 칸 무게도 맞춰야 하고요.' },
      { who: 'noknok', text: `탑승하지 못한 ${out.join('님과 ')}님이 맡긴 물건도 상자에 있어요.` },
      { who: 'dam', text: '서두를 필요는 없어. 무게중심만 지키면 돼.' },
      { who: 'noknok', text: '동료들한테 부탁도 들어 보고, 준비되면 컨베이어로 오세요!' },
    ]);
    OPPS.forEach((id) => this.app.openOpp(id));
    this.flag('c2_intro');
    await reflect(this.app, 'C2');
  }

  private async interact(id: string): Promise<void> {
    if (isCandidateId(id) || id === 'dam') { await this.talk(id); return; }
    switch (id) {
      case 'rackL':
      case 'rackR': {
        const side = id === 'rackL' ? 'left' : 'right';
        const its = itemsOf(this.m.crewIds, this.draft()[side]);
        await infoPanel(this.app.modals, side === 'left' ? '왼쪽 적재함' : '오른쪽 적재함', [
          `최대 7kg · 지금 ${totalKg(its).toFixed(1)}kg`,
          its.length ? `실린 짐: ${its.map((i) => i.name).join(', ')}` : '아직 비어 있다.',
          side === 'left' ? '벽 쪽이라 조금 서늘하다.' : '컨베이어 쪽이라 손이 잘 닿는다.',
          this.has('c2_sealed') ? '봉인되었다. 화성에 도착할 때까지 열 수 없다.' : '',
        ].filter(Boolean), '닫기');
        return;
      }
      case 'legacy': {
        const out = unselectedOf(this.m.crewIds);
        await infoPanel(this.app.modals, '맡긴 물건 상자', out.flatMap((c) => [
          `${iGa(CANDIDATES[c].name)} 맡긴 것: ${CANDIDATES[c].legacy.name} (${CANDIDATES[c].legacy.kg}kg)`,
          `「${CANDIDATES[c].legacy.line}」`,
        ]).concat(this.m.crewIds.includes('woojoo') ? [] : ['봉투 구석에 녹차 티백 한 봉이 들어 있다.']), '닫기');
        return;
      }
      case 'conveyor': await this.openBoard(); return;
      case 'console': if (this.has('c2_sealed')) await this.holdCheck(); else await this.sealFlow(); return;
      case 'hatch': this.finish(); return;
      default:
    }
  }

  private async talk(id: CandidateId | 'dam'): Promise<void> {
    const key = `talk_c2_${id}`;
    const list = TALK.C2[id] ?? [];
    if (!this.has(key)) {
      await this.app.say(talkLines(id, list));
      this.flag(key);
    } else {
      const again = isCandidateId(id) ? `(${CANDIDATES[id].name}의 요청: ${this.pool().find((p) => p.id === REQUESTS[id].item)?.name ?? ''})` : '(담이 팔찌에서 손을 뗀다)';
      await this.app.say(talkLines(id, [list[list.length - 1] ?? '', again].filter(Boolean)));
    }
  }

  private memoPicker(): Promise<void> {
    return new Promise((resolve) => {
      const chosen = new Set<string>();
      const box = h('div', { class: 'chips' });
      const draw = (): void => {
        clear(box);
        this.pool().forEach((it) => box.append(h('button', {
          class: `btn small${chosen.has(it.id) ? ' primary' : ''}`, type: 'button', 'aria-pressed': String(chosen.has(it.id)),
          onClick: () => { if (chosen.has(it.id)) chosen.delete(it.id); else if (chosen.size < 5) chosen.add(it.id); draw(); },
        }, `${it.name} ${it.kg}kg`)));
      };
      draw();
      let handle: ModalHandle | null = null;
      const done = (): void => { this.memo = [...chosen]; handle?.close(); resolve(); };
      handle = this.app.modals.open({
        title: '짐 목록 메모',
        body: h('div', {}, h('p', {}, '가져가고 싶은 것을 다섯 개까지 적어 보세요. 메모일 뿐이라 실제로 싣지는 않아요.'), box),
        footer: h('button', { class: 'btn primary', type: 'button', onClick: done }, '완료'),
        onEscape: done,
      });
    });
  }

  private async details(it: CargoItem): Promise<void> {
    await tabPanel(this.app.modals, {
      title: it.name,
      subtitle: `${it.kg}kg · ${it.tag}`,
      tabs: [
        { key: 'S', label: '실측 정보', lines: it.facts.map((t) => this.app.fill(t)) },
        { key: 'N', label: '쓰임 상상', lines: it.imagine.map((t) => this.app.fill(t)) },
      ],
      order: this.app.order(`c2-item-${it.id}`, 2),
      onPick: (key, pos, first) => this.app.recordAct({
        opportunityId: 'C2-O01', dim: 'SN', kind: 'tab', pole: key === 'N' ? 1 : -1,
        actKey: first ? `item:${it.id}:first` : `item:${it.id}:${key}:more`, secondary: !first,
        displayPosition: pos, optionSetId: 'c2-item', label: key === 'N' ? '쓰임 상상 탭 먼저' : '실측 정보 탭 먼저',
        otherLabel: key === 'N' ? '실측 정보 탭' : '쓰임 상상 탭', scene: 'C2 물품 정보를 열었을 때',
      }),
    });
  }

  private async openBoard(): Promise<void> {
    if (!this.has('c2_jp_asked')) {
      const id = await this.app.fork({
        opp: 'C2-O03', dim: 'JP', optionSetId: 'c2-start-mode', scene: 'C2 짐을 고르기 시작할 때',
        line: { who: 'noknok', text: '짐을 어떻게 시작할까요? 어느 쪽이든 괜찮아요.' },
        options: [{ id: 'plan', label: '목록 먼저 정하고 담기', pole: 1 }, { id: 'flow', label: '담아 보며 정하기', pole: -1 }],
      });
      this.flag('c2_jp_asked');
      if (id === 'plan') await this.memoPicker();
      else await this.app.say([{ who: 'noknok', text: '좋아요! 담아 보면서 정해요. 언제든 뺄 수 있어요.' }]);
    }
    if (!this.has('c2_var_asked')) {
      const id = await this.app.fork({
        opp: 'C2-O02', dim: 'O', optionSetId: 'c2-pack-mode', scene: 'C2 적재 방식을 정할 때',
        line: { who: 'noknok', text: '적재 방식은요? 짐을 고르는 건 똑같이 자유예요.' },
        options: [{ id: 'guide', label: '녹녹이 표준 적재 가이드 따르기', pole: -1 }, { id: 'own', label: '빈 칸에서 직접 구성', pole: 1 }],
      });
      this.flag('c2_var_asked');
      this.guide = id === 'guide';
      await this.app.say([{ who: 'noknok', text: this.guide ? '칸마다 권장 위치를 표시해 둘게요. 가벼운 쪽으로!' : '알겠어요. 표시 없이 비워 둘게요.' }]);
    }
    await new Promise<void>((resolve) => {
      this.board = openCargoBoard(this.app.modals, {
        crew: this.m.crewIds,
        pool: this.pool(),
        layout: this.draft(),
        guide: this.guide,
        memo: this.memo,
        notify: (msg) => toast(this.app.el.toast, msg),
        onChange: (l) => { this.flag('c2_draft', JSON.stringify(l)); this.ready = null; this.drawCargo(); },
        onDetails: (it) => void this.details(it),
        onReady: (l) => { this.ready = l; this.board?.close(); this.board = null; resolve(); },
        slots: { get: () => this.slots(), set: (i, l) => { const v = this.slots(); v[i] = l; this.flag('c2_slots', JSON.stringify(v)); } },
        onClose: () => { this.board?.close(); this.board = null; resolve(); },
      });
    });
    if (this.ready) await this.app.say([{ who: 'noknok', text: '균형 OK! 봉인 콘솔로 가서 봉인해 주세요.' }]);
    this.refreshHud();
  }

  private async sealFlow(): Promise<void> {
    const layout = this.ready;
    if (!layout) return;
    const ids = [...layout.left, ...layout.right];
    const pool = this.pool();
    const take = itemsOf(this.m.crewIds, ids);
    if (!checkLayout(itemsOf(this.m.crewIds, layout.left), itemsOf(this.m.crewIds, layout.right)).ok) { this.ready = null; return; }
    await this.app.say([
      { who: 'dam', text: '결정됐어? 봉인하면 화성에 도착할 때까지 다시 못 열어.' },
      { who: 'narrator', text: ids.includes('photo') ? '당신은 사진을 한 번 쓰다듬고, 칸 안에 넣는다.' : '당신은 사진을 한 번 쓰다듬고, 대피소 쪽 창틀에 세워 둔다.' },
    ]);
    const leave = pool.filter((p) => !ids.includes(p.id));
    const note = (p: CargoItem): string => (p.owner ? ` — ${iGa(CANDIDATES[p.owner].name)} 맡긴 물건` : '');
    const ok = await confirmPanel(this.app.modals, {
      title: '저울 · 마지막 12킬로그램',
      body: h('div', { class: 'seal-confirm' },
        h('p', {}, '봉인하면 되돌릴 수 없어요. 무엇을 골랐든 성격 결과에는 쓰이지 않아요.'),
        h('h3', {}, `가져가는 것 (${totalKg(take).toFixed(1)}kg)`),
        take.length ? lines(take.map((t) => `${t.name} ${t.kg}kg${note(t)}`)) : h('p', { class: 'muted' }, '아무것도 싣지 않는다'),
        h('h3', {}, '두고 가는 것'),
        leave.length ? lines(leave.map((t) => `${t.name}${note(t)}`)) : h('p', { class: 'muted' }, '없음')),
      confirmLabel: '봉인',
      cancelLabel: '다시 고르기',
    });
    if (!ok) { this.ready = null; await this.app.say([{ who: 'noknok', text: '천천히 다시 골라요. 컨베이어에 있을게요.' }]); return; }
    this.app.mission.dispatch({ type: 'sealCargo', items: ids });
    react(this.scene, this.m.crewIds, 'cargo', ids.includes('teabag') ? 'tea' : ids.length === 0 ? 'empty' : totalKg(itemsOf(this.m.crewIds, ids)) >= 10 ? 'full' : '');
    if (!this.has('c2_sealed')) { toast(this.app.el.toast, '규칙을 다시 확인해 주세요'); this.ready = null; return; }
    this.scene?.shake(200, 0.004);
    this.drawCargo();
    await this.postSeal();
  }

  private async postSeal(): Promise<void> {
    const crew = this.m.crewIds;
    if (!this.has('c2_nap')) {
      this.scene?.pinNoknok({ x: C2_SPOTS.rackR.x, y: 84, angle: 90 });
      await this.app.say([
        { who: 'noknok', text: '저 0.3kg인데요? 저도 들어가도 되죠? ...아, 저는 짐이 아니라고요? 감동이에요.' },
        { who: 'dam', text: '...녹녹이, 내려와. 아직 할 일이 있어.' },
        { who: 'noknok', text: '...어? 봉인 무게가 장부보다 아주 조금 무거워요. 0.1kg쯤? 저울 오차겠죠, 아마.' },
      ]);
      this.scene?.pinNoknok(null);
      this.flag('c2_nap');
    }
    if (!this.has('c2_breath_asked')) {
      const id = await this.app.fork({
        opp: 'C2-O04', dim: 'E', optionSetId: 'c2-breath', scene: 'C2 봉인 뒤 잠깐 쉬는 시간',
        line: { who: 'noknok', text: '이륙 준비까지 조금 남았어요. 잠깐 쉬어 가요.' },
        options: [{ id: 'talk', label: '동료에게 짐 이야기 묻기', pole: 1 }, { id: 'alone', label: '혼자 정리하며 생각하기', pole: -1 }],
      });
      this.flag('c2_breath_asked');
      if (id === 'talk') {
        const who = pickSpeaker('c2BagTalk', crew);
        await this.app.say([
          { who, text: isCandidateId(who) ? BAG_TALK[who] : '다들 주머니 하나씩은 챙겼더라.' },
          { who: 'narrator', text: '잠깐 웃음이 오간다. 수하물실이 조금 덜 차갑다.' },
        ]);
      } else {
        await this.app.say([
          { who: 'narrator', text: '수하물실 구석에 앉아 숨을 고른다.' },
          { who: 'narrator', text: '컨베이어가 멈추고, 아주 잠깐 조용해진다.' },
        ]);
      }
    }
    if (!this.has('c2_strap_asked')) {
      const who = pickSpeaker('c2StrapRequest', crew);
      if (this.scene?.hasActor(who)) {
        const p = this.scene.playerPos();
        await this.scene.walkActor(who, p.x + (p.x < 240 ? 30 : -30), p.y - 6, 900);
        this.scene.faceTowardPlayer(who);
      }
      const info = this.app.speaker(who);
      const inv = itemsOf(crew, this.m.inventoryIds);
      const mine = isCandidateId(who) ? inv.find((i) => i.id === REQUESTS[who].item) : undefined;
      const target = mine ?? inv.find((i) => i.fragile);
      const what = target ? target.name : '내 개인 소지품 주머니';
      const d = await perspectivePanel(this.app.modals, {
        title: '고정끈 요청',
        portrait: info.look ? pxImg(portraitURL(info.look, 'worry'), info.name, 'mini') : null,
        who: info.name,
        request: `${eulReul(what)} 고정한 끈, 한 번 더 감아 줄래? 이륙 때 흔들릴까 봐.`,
        info: [
          { key: 'T', label: '고정끈 장력 수치 보기', lines: ['고정끈 장력: 기준 120 · 현재 135 (기준 이상)', '한 번 더 감으면 140 — 안전 차이는 거의 없어요.', '두 선택 모두 안전 기준을 만족해요.'] },
          { key: 'F', label: '동료 요청 메모 보기', lines: [`${info.name}: 이륙 때 흔들리는 게 걱정된다고 적었다.`, '다른 승무원: 지금 상태로 충분하다고 적었다.', '두 선택 모두 안전 기준을 만족해요.'] },
        ],
        infoOrder: this.app.order('c2-strap-info', 2),
        decisions: [{ id: 'adjust', label: '요청대로 한 번 더 감기' }, { id: 'keep', label: '지금 상태 유지하고 이유 설명하기' }],
        decisionOrder: this.app.order('c2-strap-decision', 2),
        onInfo: (key, pos, first) => this.app.recordAct({
          opportunityId: 'C2-O05', dim: 'TF', kind: 'tab', pole: key === 'F' ? 1 : -1,
          actKey: first ? 'strap-info:first' : `strap-info:${key}:more`, secondary: !first,
          displayPosition: pos, optionSetId: 'c2-strap-info', label: key === 'F' ? '동료 요청 메모 먼저' : '장력 수치 먼저',
          otherLabel: key === 'F' ? '장력 수치' : '동료 요청 메모', scene: 'C2 고정끈 요청',
        }),
        onDecide: (did, pos) => this.app.recordAct({
          opportunityId: 'C2-O05', dim: 'A', kind: 'fork', pole: did === 'adjust' ? 1 : -1, actKey: 'fork:c2-strap',
          displayPosition: pos, optionSetId: 'c2-strap-decision', label: did === 'adjust' ? '요청대로 한 번 더 감기' : '지금 상태 유지하고 이유 설명',
          otherLabel: did === 'adjust' ? '지금 상태 유지하고 이유 설명' : '요청대로 한 번 더 감기', scene: 'C2 고정끈 요청',
        }),
      });
      if (d === 'adjust') await this.app.say([{ who, text: '고마워. 이제 마음 놓고 앉을 수 있겠다.', expr: 'relief' }]);
      else await this.app.say([{ who: 'noknok', text: '장력이 기준보다 높아서 괜찮아요. 대신 출발 직전에 한 번 더 볼게요.' }, { who, text: '아, 그런 이유면 괜찮아.', expr: 'relief' }]);
      this.flag('c2_strap_asked');
      await this.app.say([{ who: 'noknok', text: '마지막으로 봉인 콘솔에서 고정 점검을 해 주세요.' }]);
    }
  }

  private async holdCheck(): Promise<void> {
    if (this.has('c2_hold_asked')) return;
    const id = await this.app.fork({
      opp: 'C2-O03', dim: 'C', optionSetId: 'c2-hold-check', scene: 'C2 이륙 전 고정 점검',
      line: { who: 'noknok', text: '녹녹! 고정 상태 자동 확인 완료! 모두 기준 이상이에요.' },
      options: [{ id: 'go', label: '자동 확인 결과로 바로 이륙 준비', pole: -1 }, { id: 'check', label: '수동으로 다시 점검', pole: 1 }],
    });
    this.flag('c2_hold_asked');
    // 완료 표시를 먼저 남긴다. 예전에는 점검표·대사 뒤에 남겨서, 그 사이 새로고침하면 콘솔(점검 끝)과 계단(완료 전)이 모두 닫혀 진행할 수 없었다.
    this.flag('c2_after_done');
    if (id === 'check') {
      const inv = itemsOf(this.m.crewIds, this.m.inventoryIds);
      await infoPanel(this.app.modals, '수하물실 점검표', [
        `실린 짐: ${inv.length}개 · ${totalKg(inv).toFixed(1)}kg`, '고정끈 장력: 기준 이상', '봉인 잠금: 정상', '녹녹이 메모: 이륙 때 수하물실 문은 열지 마세요.',
      ], '확인했어요');
    } else {
      await this.app.say([{ who: 'noknok', text: '네! 기록해 둘게요.' }]);
    }
    await this.app.say([{ who: 'dam', text: '좋아. 객실로 올라가자. 좌석은 정해져 있어.' }]);
  }

  private finish(): void {
    OPPS.forEach((id) => this.app.closeOpp(id));
    this.app.mission.dispatch({ type: 'goto', fsm: 'c2_sealed' });
    void this.app.beginC3();
  }
}
