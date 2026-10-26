import { h, clear, pxImg } from './dom';
import type { ModalHandle, ModalHost } from './panels';
import type { FollowUpAnswer } from '../analytics/followup';
import type { Dim } from '../analytics/opportunities';
import { noknokURL } from '../art/sprites';

interface Q { id: string; dim: Dim; prompt: string; plus: string; minus: string }

/**
 * 결과지 직전 추가 질문. 플레이 기록만으로 정하지 못한 축만 묻는다.
 * 두 선택지는 모두 괜찮은 답이고, 위치는 판마다 섞인다(order). 닫을 수 없다(답해야 결과가 정해진다).
 */
export function followupPanel(host: ModalHost, qs: readonly Q[], order: (key: string) => number[], onAnswer: (a: FollowUpAnswer) => void): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    let handle: ModalHandle | null = null;
    const body = h('div', { class: 'followup' });
    const render = (): void => {
      clear(body);
      if (i >= qs.length) { handle?.close(); resolve(); return; }
      const q = qs[i];
      const opts: { pole: 1 | -1; label: string }[] = [{ pole: 1, label: q.plus }, { pole: -1, label: q.minus }];
      const shown = order(`followup-${q.id}`).map((k) => opts[k]);
      body.append(
        i === 0 ? h('div', { class: 'fu-intro' }, pxImg(noknokURL(), '녹녹이', 'icon'),
          h('p', {}, `녹녹: 기록만으로는 아직 반반인 곳이 있어요. 결과를 정하려고 ${qs.length}개만 더 물어볼게요. 정답은 없어요. 평소의 나와 더 가까운 쪽을 골라 주세요.`)) : '',
        h('p', { class: 'fu-progress muted small' }, `추가 질문 ${i + 1} / ${qs.length}`),
        h('p', { class: 'fu-prompt' }, q.prompt),
        h('div', { class: 'fu-choices' }, ...shown.map((o, pos) => h('button', {
          class: 'btn choice fu-choice', type: 'button',
          onClick: () => { onAnswer({ qid: q.id, dim: q.dim, pole: o.pole, displayPosition: pos }); i += 1; render(); },
        }, o.label))),
      );
      body.querySelector<HTMLButtonElement>('.fu-choice')?.focus({ preventScroll: true });
    };
    handle = host.open({ title: '녹녹이의 추가 질문', body, cls: 'followup-modal', closable: false });
    render();
  });
}
