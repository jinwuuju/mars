import { h, clear } from './dom';

export interface ModalHandle {
  el: HTMLElement;
  close(): void;
}

interface Entry {
  handle: ModalHandle;
  closable: boolean;
  onEscape?: () => void;
}

/** 모달 스택. Escape는 맨 위의 닫을 수 있는 창만 닫는다. */
export class ModalHost {
  private readonly root: HTMLElement;
  private stack: Entry[] = [];
  /** 창이 열릴 때 부르는 훅(퍼즐 자동 진행 등) */
  onOpen: ((card: HTMLElement) => void) | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  isOpen(): boolean {
    return this.stack.length > 0;
  }

  open(opts: { title: string; body: Node; footer?: Node; cls?: string; closable?: boolean; onEscape?: () => void }): ModalHandle {
    const card = h('section', { class: `modal-card ${opts.cls ?? ''}`.trim(), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title },
      h('header', { class: 'modal-head' }, h('h2', {}, opts.title)),
      h('div', { class: 'modal-body' }, opts.body),
      opts.footer ? h('footer', { class: 'modal-foot' }, opts.footer) : null,
    );
    const wrap = h('div', { class: 'modal-wrap' }, card);
    this.root.append(wrap);
    this.root.classList.add('show');
    const handle: ModalHandle = {
      el: card,
      close: () => {
        wrap.remove();
        this.stack = this.stack.filter((e) => e.handle !== handle);
        if (this.stack.length === 0) this.root.classList.remove('show');
      },
    };
    this.stack.push({ handle, closable: opts.closable ?? true, onEscape: opts.onEscape });
    // '녹녹이에게 맡기기'가 있는 창에는 무엇을 하는 버튼인지 한 줄로 알려 준다(스킵·자동 진행)
    const assist = card.querySelector<HTMLButtonElement>('button.assist');
    if (assist) {
      assist.title = '귀찮으면 누르세요. 녹녹이가 대신 풀고 바로 다음으로 넘어가요.';
      const note = h('p', { class: 'assist-note' }, h('b', {}, '귀찮다면? '), '[녹녹이에게 맡기기]를 누르면 녹녹이가 대신 풀고 바로 다음 이야기로 넘어가요(스킵). 결과·엔딩에는 영향이 없어요.');
      const foot = card.querySelector('.modal-foot');
      if (foot) card.insertBefore(note, foot);
      else card.append(note);
    }
    const first = card.querySelector<HTMLElement>('button, [href], input');
    first?.focus({ preventScroll: true });
    this.onOpen?.(card);
    return handle;
  }

  closeTop(): boolean {
    const top = this.stack[this.stack.length - 1];
    if (!top || !top.closable) return false;
    if (top.onEscape) top.onEscape();
    else top.handle.close();
    return true;
  }

  closeAll(): void {
    [...this.stack].forEach((e) => e.handle.close());
  }
}

export function lines(items: string[]): HTMLElement {
  return h('ul', { class: 'lines' }, ...items.map((t) => h('li', {}, t)));
}

export function infoPanel(host: ModalHost, title: string, body: string[] | Node, closeLabel = '닫기'): Promise<void> {
  return new Promise((resolve) => {
    let handle: ModalHandle | null = null;
    const done = (): void => { handle?.close(); resolve(); };
    handle = host.open({
      title,
      body: Array.isArray(body) ? lines(body) : body,
      footer: h('button', { class: 'btn primary', type: 'button', onClick: done }, closeLabel),
      onEscape: done,
    });
  });
}

export function confirmPanel(host: ModalHost, opts: { title: string; body: Node; confirmLabel: string; cancelLabel: string }): Promise<boolean> {
  return new Promise((resolve) => {
    let handle: ModalHandle | null = null;
    const finish = (v: boolean): void => { handle?.close(); resolve(v); };
    handle = host.open({
      title: opts.title,
      body: opts.body,
      footer: h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onClick: () => finish(false) }, opts.cancelLabel),
        h('button', { class: 'btn primary', type: 'button', onClick: () => finish(true) }, opts.confirmLabel),
      ),
      onEscape: () => finish(false),
    });
  });
}

export interface TabSpec {
  key: string;
  label: string;
  lines: string[];
}

/** 2탭 정보 패널: 두 탭 중 하나를 먼저 골라야 내용이 보인다. 결정에 필요한 정보는 이미 본 화면에 있다. */
export function tabPanel(host: ModalHost, opts: { title: string; subtitle?: string; note?: string; tabs: TabSpec[]; order: number[]; onPick?: (key: string, position: number, first: boolean) => void }): Promise<void> {
  return new Promise((resolve) => {
    const content = h('div', { class: 'tab-content', 'aria-live': 'polite' }, h('p', { class: 'muted' }, '먼저 볼 기록을 골라 주세요.'));
    const ordered = opts.order.map((i) => opts.tabs[i]);
    const buttons: HTMLButtonElement[] = [];
    let picked = false;
    ordered.forEach((tab, pos) => {
      const b = h('button', { class: 'btn tab', type: 'button', 'aria-pressed': 'false' }, tab.label);
      b.addEventListener('click', () => {
        buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        clear(content);
        content.append(lines(tab.lines));
        opts.onPick?.(tab.key, pos, !picked);
        picked = true;
      });
      buttons.push(b);
    });
    let handle: ModalHandle | null = null;
    const done = (): void => { handle?.close(); resolve(); };
    handle = host.open({
      title: opts.title,
      cls: 'tab-panel',
      body: h('div', {},
        opts.subtitle ? h('p', { class: 'subtitle' }, opts.subtitle) : null,
        h('div', { class: 'tabs', role: 'group' }, ...buttons),
        content,
        opts.note ? h('p', { class: 'note' }, opts.note) : null,
      ),
      footer: h('button', { class: 'btn', type: 'button', onClick: done }, '닫기'),
      onEscape: done,
    });
  });
}

/** 관점 패널: 요청 + 선택적 자료 2개 + 동등한 결정 2개 */
export function perspectivePanel(host: ModalHost, opts: {
  title: string;
  portrait?: HTMLElement | null;
  who: string;
  request: string;
  info: TabSpec[];
  infoOrder: number[];
  decisions: { id: string; label: string }[];
  decisionOrder: number[];
  onInfo: (key: string, position: number, first: boolean) => void;
  onDecide: (id: string, position: number) => void;
}): Promise<string> {
  return new Promise((resolve) => {
    const infoBox = h('div', { class: 'tab-content small', 'aria-live': 'polite' }, h('p', { class: 'muted' }, '결정 전에 자료를 볼 수도 있어요. 보지 않아도 괜찮아요.'));
    let infoPicked = false;
    const infoButtons = opts.infoOrder.map((i, pos) => {
      const t = opts.info[i];
      const b = h('button', { class: 'btn tab', type: 'button', 'aria-pressed': 'false' }, t.label);
      b.addEventListener('click', () => {
        infoButtons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        clear(infoBox);
        infoBox.append(lines(t.lines));
        opts.onInfo(t.key, pos, !infoPicked);
        infoPicked = true;
      });
      return b;
    });
    let handle: ModalHandle | null = null;
    const decide = (id: string, pos: number): void => {
      opts.onDecide(id, pos);
      handle?.close();
      resolve(id);
    };
    const decisionButtons = opts.decisionOrder.map((i, pos) => {
      const d = opts.decisions[i];
      return h('button', { class: 'btn choice', type: 'button', onClick: () => decide(d.id, pos) }, d.label);
    });
    handle = host.open({
      title: opts.title,
      cls: 'perspective',
      closable: false,
      body: h('div', {},
        h('div', { class: 'request' }, opts.portrait ?? null, h('div', {}, h('b', {}, opts.who), h('p', {}, opts.request))),
        h('div', { class: 'tabs', role: 'group' }, ...infoButtons),
        infoBox,
        h('p', { class: 'ask' }, '어떻게 할까요? 두 선택 모두 안전 기준을 만족해요.'),
        h('div', { class: 'choices' }, ...decisionButtons),
      ),
    });
  });
}
