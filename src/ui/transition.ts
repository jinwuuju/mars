import { h, clear } from './dom';

/** 장 제목 카드: 원형으로 열리고(iris) 닫히는 전환. 누르거나 Enter로 바로 넘길 수 있다. */
export function chapterCard(root: HTMLElement, opts: { no: number; en: string; ko: string; reduced: boolean }): Promise<void> {
  return new Promise((resolve) => {
    clear(root);
    root.className = 'show card';
    const card = h('div', { class: `chapter-card${opts.reduced ? ' still' : ''}`, role: 'dialog', 'aria-label': `${opts.no}장 ${opts.ko}` },
      h('div', { class: 'cc-stars', 'aria-hidden': 'true' }),
      h('p', { class: 'cc-no' }, `${opts.no}장`),
      h('h2', { class: 'cc-en' }, ...opts.en.split('').map((ch, i) => h('span', { style: { animationDelay: `${0.25 + i * 0.035}s` } }, ch))),
      h('p', { class: 'cc-ko' }, opts.ko),
      h('p', { class: 'cc-hint' }, '누르거나 Enter로 계속'),
    );
    root.append(card);
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      card.classList.add('out');
      window.setTimeout(() => { clear(root); root.className = ''; resolve(); }, opts.reduced ? 0 : 420);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (['Enter', ' ', 'e', 'E', 'Escape'].includes(e.key)) { e.preventDefault(); finish(); }
    };
    card.addEventListener('click', finish);
    document.addEventListener('keydown', onKey);
    const timer = window.setTimeout(finish, opts.reduced ? 1200 : 2200);
  });
}
