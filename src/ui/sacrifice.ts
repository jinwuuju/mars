import { h, pxImg } from './dom';
import { confirmPanel, type ModalHandle, type ModalHost } from './panels';
import { portraitURL } from '../art/sprites';
import { CANDIDATES } from '../story/candidates';
import { eulReul } from '../story/josa';
import type { CandidateId } from '../shared/ids';

export type SacPick = CandidateId | 'lot' | 'me';

/** 희생 선택 창: 남은 동료 카드(♥ 라포) + 제비뽑기 + 내가 가겠다. 고른 뒤 한 번 더 확인한다(되돌릴 수 없다). */
export function sacrificePanel(host: ModalHost, o: { title: string; ask: string; people: { id: CandidateId; rapport: number }[] }): Promise<SacPick> {
  return new Promise((resolve) => {
    let handle: ModalHandle | null = null;
    const pick = async (p: SacPick, question: string): Promise<void> => {
      const ok = await confirmPanel(host, { title: '되돌릴 수 없는 선택', body: h('p', {}, question), confirmLabel: '보낸다', cancelLabel: '다시 생각' });
      if (!ok) return;
      handle?.close();
      resolve(p);
    };
    const cards = o.people.map(({ id, rapport }) => {
      const c = CANDIDATES[id];
      return h('div', { class: 'sac-card', 'data-id': id },
        pxImg(portraitURL(c.look, 'worry'), c.name, 'mini'),
        h('b', {}, c.name),
        h('span', { class: 'hearts', 'aria-label': `라포 ${rapport}` }, rapport ? '♥'.repeat(Math.min(rapport, 8)) : '♡'),
        h('small', {}, c.role),
        h('button', { class: 'btn small danger', type: 'button', onClick: () => void pick(id, `${eulReul(c.name)} 보낼까요? 되돌릴 수 없어요.`) }, '보낸다'));
    });
    handle = host.open({
      title: o.title, cls: 'wide sacrifice', closable: false,
      body: h('div', {},
        h('p', { class: 'subtitle' }, `${o.ask} ♥는 함께 나눈 대화예요. 이 선택은 성격 결과에 쓰이지 않아요.`),
        h('div', { class: 'sac-grid' }, ...cards),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onClick: () => void pick('lot', '제비뽑기로 정할까요? 누가 뽑혀도 되돌릴 수 없어요.') }, '제비뽑기'),
          h('button', { class: 'btn', type: 'button', onClick: () => void pick('me', '내가 가겠다고 말할까요?') }, '내가 가겠다'))),
    });
  });
}
