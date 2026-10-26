import { h, clear, pxImg } from './dom';
import type { ModalHandle, ModalHost } from './panels';
import { portraitURL } from '../art/sprites';
import { PLAYER_LOOKS, NPC_LOOKS } from '../art/look';
import { CANDIDATE_IDS, type CandidateId } from '../shared/ids';
import { CANDIDATES, MIRROR_RECOMMENDATION, SKILL_KEYS, SKILL_LABEL, type SkillKey } from '../story/candidates';
import { canLock, SEAT_COUNT, seatedIds } from '../story/roster';
import type { MissionAction, MissionState } from '../core/state';

export interface RosterDeps {
  mission: () => MissionState;
  dispatch: (a: MissionAction) => void;
  subscribe: (f: () => void) => () => void;
  fill: (t: string) => string;
  criteria: () => SkillKey[];
  recoVisible: () => boolean;
  onDossier: (id: CandidateId) => void;
  onFirstFull: () => void;
  onConfirm: () => void;
  onReco: () => void;
  onClose: () => void;
}

/** C1 탑승 명단 보드: 6명 카드 → 4좌석 (드래그 · 탭 · 키보드) */
export function openRoster(host: ModalHost, deps: RosterDeps): ModalHandle {
  let picked: CandidateId | null = null;
  const body = h('div', { class: 'roster' });
  const footer = h('div', { class: 'row' });
  let handle: ModalHandle | null = null;
  let wasFull = canLock(deps.mission().seats);

  const close = (): void => {
    unsub();
    handle?.close();
    deps.onClose();
  };

  const render = (): void => {
    const m = deps.mission();
    const seats = m.seats;
    const seated = seatedIds(seats);
    clear(body);
    clear(footer);

    const cards = CANDIDATE_IDS.map((id) => {
      const c = CANDIDATES[id];
      const isSeated = seated.includes(id);
      const card = h('article', {
        class: `cand-card${isSeated ? ' seated' : ''}${picked === id ? ' picked' : ''}`,
        draggable: 'true',
        'data-id': id,
      },
        h('button', {
          class: 'cand-pick', type: 'button', 'aria-pressed': String(picked === id),
          'aria-label': `${c.name} 선택해서 좌석에 놓기`,
          onClick: () => { picked = picked === id ? null : id; render(); },
        }, pxImg(portraitURL(c.look, isSeated ? 'relief' : 'neutral'), c.name, 'portrait')),
        h('div', { class: 'cand-meta' }, h('b', {}, c.name), h('span', {}, ` ${c.age} · ${c.role}`)),
        h('p', { class: 'cand-quote' }, deps.fill(c.quote)),
        h('div', { class: 'skills' }, ...SKILL_KEYS.map((k) =>
          h('span', { class: 'skill', title: `${SKILL_LABEL[k]} ${c.skills[k]}` }, SKILL_LABEL[k], h('i', { class: `pips p${c.skills[k]}` })))),
        h('div', { class: 'cand-actions' },
          h('button', { class: 'btn small', type: 'button', onClick: () => deps.onDossier(id) }, '기록 보기'),
          isSeated
            ? h('button', { class: 'btn small', type: 'button', onClick: () => deps.dispatch({ type: 'unassign', id }) }, '내리기')
            : h('button', { class: 'btn small primary', type: 'button', disabled: seated.length >= SEAT_COUNT, onClick: () => deps.dispatch({ type: 'assign', id }) }, '앉히기'),
        ),
        isSeated ? h('span', { class: 'badge' }, '좌석 배정됨') : null,
      );
      card.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/plain', id); });
      return card;
    });

    const slotEls = seats.map((sid, i) => {
      const c = sid ? CANDIDATES[sid] : null;
      const slot = h('button', { class: `seat slot${c ? ' filled' : ''}`, type: 'button', 'aria-label': c ? `${i + 1}번 좌석: ${c.name}` : `${i + 1}번 좌석 비어 있음` },
        h('span', { class: 'seat-no' }, String(i + 1)),
        c ? pxImg(portraitURL(c.look, 'relief'), c.name, 'mini') : h('span', { class: 'seat-empty' }, '빈 좌석'),
        c ? h('span', { class: 'seat-name' }, c.name) : null,
      );
      slot.addEventListener('click', () => {
        if (picked) { deps.dispatch({ type: 'assign', id: picked, slot: i }); picked = null; render(); }
        else if (sid) { picked = sid; render(); }
      });
      slot.addEventListener('dragover', (e) => e.preventDefault());
      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        const id = e.dataTransfer?.getData('text/plain');
        if (id && (CANDIDATE_IDS as readonly string[]).includes(id)) deps.dispatch({ type: 'assign', id: id as CandidateId, slot: i });
      });
      return slot;
    });

    const sums = SKILL_KEYS.map((k) => ({ k, v: seated.reduce((a, id) => a + CANDIDATES[id].skills[k], 0) }));
    const crit = deps.criteria();
    const reco = deps.recoVisible();

    body.append(
      h('div', { class: 'roster-head' },
        h('p', {}, '후보 여섯 명 가운데 네 명을 고르세요. 카드를 좌석으로 끌거나, 얼굴을 누른 뒤 좌석을 누르세요.'),
        h('p', { class: 'muted small' }, '누구를 고르든 여정은 이어지고, 이 선택은 성격 결과에 쓰이지 않아요.'),
      ),
      h('div', { class: 'roster-grid' },
        h('section', { class: 'cands', 'aria-label': '후보' }, ...cards),
        h('aside', { class: 'seats', 'aria-label': '아크-06 좌석' },
          h('div', { class: 'seat fixed' }, pxImg(portraitURL(NPC_LOOKS.dam), '담', 'mini'), h('span', {}, '담 · 조종사 (고정)')),
          h('div', { class: 'seat fixed' }, pxImg(portraitURL(PLAYER_LOOKS[m.player.look] ?? PLAYER_LOOKS[0]), m.player.name, 'mini'), h('span', {}, `${m.player.name} · 시민 대표 (고정)`)),
          ...slotEls,
          h('p', { class: 'seat-count', 'aria-live': 'polite' }, `선택 ${seated.length} / 4 · 남은 후보 ${6 - seated.length}`),
          h('div', { class: 'radar' }, h('b', {}, '팀 역량 (이야기 정보)'), ...sums.map(({ k, v }) =>
            h('div', { class: 'bar' }, h('span', {}, SKILL_LABEL[k]), h('i', { style: { width: `${Math.round((v / 12) * 100)}%` } }), h('em', {}, String(v))))),
          crit.length ? h('p', { class: 'criteria' }, `나의 기준: ${crit.map((k) => SKILL_LABEL[k]).join(' · ')}`) : null,
          h('div', { class: 'saves' }, h('b', {}, '편성안 저장'), ...[0, 1, 2].map((i) => {
            const saved = m.savedRosters[i];
            return h('div', { class: 'save-row' },
              h('span', {}, `${i + 1}. ${saved && saved.length ? saved.map((id) => CANDIDATES[id].name).join('·') : '비어 있음'}`),
              h('button', { class: 'btn tiny', type: 'button', onClick: () => deps.dispatch({ type: 'saveRoster', slot: i }) }, '저장'),
              h('button', { class: 'btn tiny', type: 'button', disabled: !saved, onClick: () => deps.dispatch({ type: 'loadRoster', slot: i }) }, '불러오기'),
            );
          })),
          reco ? h('div', { class: 'reco' },
            h('b', {}, 'MIRROR 지구 중계 노드 권고'),
            h('p', {}, `${MIRROR_RECOMMENDATION.crew.map((id) => CANDIDATES[id].name).join(' · ')} — 생존 기대 지수 ${MIRROR_RECOMMENDATION.index}`),
            h('button', { class: 'btn tiny', type: 'button', onClick: () => deps.onReco() }, '권고 근거 보기'),
          ) : null,
        ),
      ),
    );

    footer.append(
      h('button', { class: 'btn', type: 'button', onClick: close }, '닫고 둘러보기'),
      h('button', { class: 'btn primary', type: 'button', disabled: !canLock(seats), onClick: () => { unsub(); handle?.close(); deps.onConfirm(); } }, '명단 확정'),
    );
  };

  const unsub = deps.subscribe(() => {
    render();
    const full = canLock(deps.mission().seats);
    if (full && !wasFull) deps.onFirstFull();
    wasFull = full;
  });
  render();
  handle = host.open({ title: 'ARK-06 탑승 명단 · 남은 좌석 4', body, footer, cls: 'wide', onEscape: close });
  return handle;
}
