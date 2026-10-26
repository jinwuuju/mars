import { h, clear, pxImg } from './dom';
import { noknokURL, portraitURL, type Expr } from '../art/sprites';
import type { Look } from '../art/look';

export type SpeakerKey = string;

export interface SpeakerInfo {
  name: string;
  look?: Look;
  noknok?: boolean;
  /** 사람이 아닌 화자(녹녹이·MIRROR)의 아이콘 */
  icon?: string;
  cls: string;
}

export interface Line {
  who: SpeakerKey;
  text: string;
  expr?: Expr;
}

export interface Choice {
  id: string;
  label: string;
}

/** 하단 대화창. 한 번에 1~3문장, 초상 + 이름 + 본문. 클릭·Enter·Space·E로 넘긴다. */
export class DialogueBox {
  private readonly root: HTMLElement;
  private readonly info: (k: SpeakerKey) => SpeakerInfo;
  private readonly fill: (t: string) => string;
  private next: (() => void) | null = null;
  private open = false;

  constructor(root: HTMLElement, info: (k: SpeakerKey) => SpeakerInfo, fill: (t: string) => string) {
    this.root = root;
    this.info = info;
    this.fill = fill;
    this.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.advance();
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  /** 다음 줄로 넘김. 넘겼으면 true */
  advance(): boolean {
    if (!this.next) return false;
    const n = this.next;
    this.next = null;
    n();
    return true;
  }

  /** noSkip: 작별처럼 놓치면 안 되는 장면은 [대화 넘기기]를 보여 주지 않는다 */
  async say(lines: Line[], opts: { noSkip?: boolean } = {}): Promise<void> {
    // 건너뛰기: 이 대화 묶음의 남은 줄을 한 번에 넘긴다(선택지는 건너뛰지 않는다). 이야기·점수와 무관한 편의 기능
    let skip = false;
    for (const [i, line] of lines.entries()) {
      if (skip) continue;
      await new Promise<void>((resolve) => {
        const btn = h('button', { class: 'btn small dlg-next', type: 'button', onClick: () => this.advance() }, '다음 ▸');
        const rest = lines.length - i - 1;
        const skipBtn = rest > 0 && !opts.noSkip
          ? h('button', { class: 'btn small ghost dlg-skip', type: 'button', title: '이 대화의 남은 줄을 한 번에 넘겨요', onClick: () => { skip = true; this.advance(); } }, `⏩ 대화 넘기기 (${rest})`)
          : null;
        this.render(line, h('div', { class: 'dlg-foot' }, skipBtn, btn));
        this.next = resolve;
        btn.focus({ preventScroll: true });
      });
    }
    this.hide();
  }

  /** kind: 선택지 버튼에 붙일 추가 클래스(예: 'reflect' = 정답 없는 생각의 시간) */
  choose(line: Line | null, choices: Choice[], kind = ''): Promise<string> {
    return new Promise((resolve) => {
      const buttons = choices.map((c) =>
        h('button', { class: `btn choice${kind ? ` ${kind}` : ''}`, type: 'button', onClick: () => { this.hide(); resolve(c.id); } }, c.label),
      );
      this.render(line ?? { who: 'narrator', text: '' }, h('div', { class: 'dlg-foot choices' }, ...buttons));
      buttons[0]?.focus({ preventScroll: true });
    });
  }

  hide(): void {
    this.open = false;
    this.next = null;
    this.root.classList.remove('show');
    clear(this.root);
  }

  private render(line: Line, foot: HTMLElement): void {
    const info = this.info(line.who);
    clear(this.root);
    const portrait = info.icon
      ? pxImg(info.icon, info.name, `icon ${info.cls}`)
      : info.noknok
      ? pxImg(noknokURL(), info.name, 'noknok')
      : info.look
        ? pxImg(portraitURL(info.look, line.expr ?? 'neutral'), info.name)
        : null;
    this.root.append(
      h('div', { class: `dlg who-${info.cls}`, role: 'dialog', 'aria-live': 'polite' },
        portrait ? h('div', { class: 'dlg-portrait' }, portrait) : null,
        h('div', { class: 'dlg-body' },
          info.name ? h('div', { class: 'dlg-name' }, info.name) : null,
          h('p', { class: 'dlg-text' }, this.fill(line.text)),
          foot,
        ),
      ),
    );
    this.root.classList.add('show');
    this.open = true;
  }
}
