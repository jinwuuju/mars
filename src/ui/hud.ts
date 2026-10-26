import { h, clear } from './dom';
import type { Interactable } from '../world/BunkerScene';
import type { Resources } from '../core/state';

export interface Objective {
  text: string;
  done: boolean;
  /** 이 항목이 '지금 할 일'일 때 지도 위에서 반짝일 지점 id */
  spot?: string;
  /** 선택 항목: '지금 할 일'로 고르지 않는다 */
  optional?: boolean;
}

const RES_LABELS: [keyof Resources, string][] = [
  ['oxygenReserve', '산소'], ['water', '물'], ['food', '식량'], ['power', '전력'], ['habitatIntegrity', '선체'],
];

/** 상단 상황 바(장 · 서사 시계 · 자원) + 상단 반투명 할 일 카드 + 하단 상호작용 버튼 */
export class Hud {
  private readonly root: HTMLElement;
  private readonly top: HTMLElement;
  private readonly quest: HTMLElement;
  private readonly prompt: HTMLElement;
  /** 항상 보이는 '지금 할 일' 한 줄 */
  private readonly now: HTMLElement;
  private nowKey = '';
  /** 지금 할 일의 지점 id(걷는 지도가 읽어서 반짝이는 표식을 띄운다) */
  focusSpot: string | null = null;
  onFocusChange: (() => void) | null = null;
  private promptAction: (() => void) | null = null;
  private onMenu: () => void = () => undefined;
  private chapter = '';
  private clock: string | null = null;
  private res: Resources | null = null;
  private prevRes: Resources | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.top = h('div', { class: 'hud-top' });
    // 넓은 화면에서는 펼친 채로, 휴대폰에서는 접힌 채로 시작한다(눌러서 펼치기).
    this.quest = h('details', { class: 'hud-quest', open: window.innerWidth > 760 });
    this.prompt = h('div', { class: 'hud-prompt' });
    this.now = h('div', { class: 'hud-now', role: 'status', 'aria-live': 'polite' });
    this.root.append(this.top, this.now, this.quest, this.prompt);
  }

  show(on: boolean): void {
    this.root.classList.toggle('show', on);
  }

  setMenuHandler(f: () => void): void {
    this.onMenu = f;
  }

  setTop(chapter: string, clock: string | null): void {
    this.chapter = chapter;
    this.clock = clock;
    this.renderTop();
  }

  /** 자원 표시(게임 속 추상 단위). null이면 숨긴다. 값이 바뀌면 잠깐 반짝인다. */
  setResources(r: Resources | null): void {
    this.prevRes = this.res;
    this.res = r;
    this.renderTop();
  }

  private renderTop(): void {
    clear(this.top);
    const parts: Node[] = [h('div', { class: 'chip chapter' }, this.chapter)];
    if (this.clock) parts.push(h('div', { class: 'chip clock', title: '이야기 속 시계예요. 실제 시간 제한은 없어요.' }, this.clock));
    if (this.res) {
      const r = this.res;
      const p = this.prevRes;
      parts.push(h('div', { class: 'chip res', title: '게임 속 추상 단위예요(0~100).' },
        ...RES_LABELS.map(([k, label]) => h('span', { class: p && p[k] !== r[k] ? 'changed' : '' }, `${label} ${Math.round(r[k])}`))));
    }
    parts.push(h('button', { class: 'btn tiny menu', type: 'button', 'aria-label': '메뉴', onClick: () => this.onMenu() }, '메뉴'));
    this.top.append(...parts);
  }

  setObjectives(title: string, items: Objective[]): void {
    // 지금 할 일 = 아직 안 한 첫 필수 항목(선택 항목은 건너뛴다)
    const cur = items.find((o) => !o.done && !o.optional) ?? null;
    clear(this.quest);
    this.quest.append(
      h('summary', {}, title),
      h('ul', {}, ...items.map((o) => h('li', { class: o.done ? 'done' : o === cur ? 'now' : o.optional ? 'opt' : '' }, o.done ? '✓ ' : o === cur ? '✦ ' : '○ ', o.text))),
    );
    this.setNow(cur ? cur.text : null, cur?.spot ?? null);
  }

  /** '✦ 지금 ○○' 한 줄을 갱신한다. 할 일이 바뀌면 한 번 크게 반짝인다(숫자만 바뀐 경우는 제외). */
  private setNow(text: string | null, spot: string | null): void {
    const key = text ? text.replace(/[0-9.,/]+/g, '#') : '';
    const fresh = key !== '' && key !== this.nowKey;
    this.nowKey = key;
    clear(this.now);
    if (text) {
      this.now.append(h('span', { class: 'now-in' },
        h('span', { class: 'now-spark', 'aria-hidden': 'true' }, '✦'),
        h('b', {}, '지금'),
        h('span', { class: 'now-text' }, text),
        spot ? h('small', {}, '· 반짝이는 곳으로') : ''));
      this.now.classList.add('show');
      if (fresh) {
        this.now.classList.remove('fresh');
        void this.now.offsetWidth; // 애니메이션을 처음부터 다시
        this.now.classList.add('fresh');
      }
    } else {
      this.now.classList.remove('show', 'fresh');
    }
    if (spot !== this.focusSpot) {
      this.focusSpot = spot;
      this.onFocusChange?.();
    }
  }

  setPrompt(it: Interactable | null, action: (() => void) | null): void {
    clear(this.prompt);
    this.promptAction = it ? action : null;
    if (!it || !action) { this.prompt.classList.remove('show'); return; }
    this.prompt.append(h('button', { class: 'btn primary prompt-btn', type: 'button', onClick: () => action() },
      h('kbd', {}, 'E'), ` ${it.verb} — ${it.label}`));
    this.prompt.classList.add('show');
  }

  triggerPrompt(): boolean {
    if (!this.promptAction) return false;
    this.promptAction();
    return true;
  }
}
