import { h, clear, pxImg } from './dom';
import type { ModalHandle, ModalHost } from './panels';
import { itemURL } from '../art/items';
import { portraitURL } from '../art/sprites';
import { CANDIDATES } from '../story/candidates';
import { autoBalance, BAY_DIFF, BAY_LIMIT, CARGO_LIMIT, checkLayout, REQUESTS, totalKg, type CargoItem } from '../story/cargo';
import { iGa } from '../story/josa';
import type { CandidateId } from '../shared/ids';

export interface CargoLayout { left: string[]; right: string[] }

export interface CargoBoardDeps {
  crew: CandidateId[];
  pool: CargoItem[];
  layout: CargoLayout;
  /** O02 표준 적재 가이드: 칸마다 권장 위치 표시만 바뀐다(물품 선택에는 영향 없음) */
  guide: boolean;
  /** J 경로의 목록 메모: 표시만 바뀐다 */
  memo: string[];
  notify: (msg: string) => void;
  onChange: (layout: CargoLayout) => void;
  onDetails: (item: CargoItem) => void;
  onReady: (layout: CargoLayout) => void;
  /** 적재안 슬롯 3개(바이블 C2-3). 저장·불러오기는 서사 편의 기능이며 측정하지 않는다 */
  slots?: { get: () => (CargoLayout | null)[]; set: (i: number, l: CargoLayout) => void };
  /** 보드를 닫고 수하물실을 둘러보기(짐 선택은 초안으로 남는다) */
  onClose?: () => void;
}

/** C2 적재 보드: 12kg, 좌우 칸 각 7kg, 좌우 차 4kg. 드래그 대신 버튼으로 조작(터치·키보드 동일). */
export function openCargoBoard(host: ModalHost, deps: CargoBoardDeps): ModalHandle {
  let layout: CargoLayout = { left: [...deps.layout.left], right: [...deps.layout.right] };
  const byId = (id: string): CargoItem | undefined => deps.pool.find((p) => p.id === id);
  const items = (ids: string[]): CargoItem[] => ids.map(byId).filter((x): x is CargoItem => Boolean(x));
  const body = h('div', { class: 'cargo' });
  const footer = h('div', { class: 'row' });
  const requesters = new Map<string, CandidateId>();
  deps.crew.forEach((c) => requesters.set(REQUESTS[c].item, c));

  const set = (next: CargoLayout): void => {
    layout = next;
    deps.onChange(layout);
    render();
  };

  const add = (id: string, side: 'left' | 'right'): void => {
    const it = byId(id);
    if (!it) return;
    const L = items(layout.left);
    const R = items(layout.right);
    if (totalKg([...L, ...R, it]) > CARGO_LIMIT + 1e-9) { deps.notify(`총 ${CARGO_LIMIT}kg를 넘어서 더 실을 수 없어요`); return; }
    if (totalKg(side === 'left' ? [...L, it] : [...R, it]) > BAY_LIMIT + 1e-9) {
      deps.notify(`${side === 'left' ? '왼쪽' : '오른쪽'} 칸이 ${BAY_LIMIT}kg를 넘어요. 반대쪽에 실어 보세요`);
      return;
    }
    set({ left: side === 'left' ? [...layout.left, id] : layout.left, right: side === 'right' ? [...layout.right, id] : layout.right });
  };

  const remove = (id: string): void => set({ left: layout.left.filter((x) => x !== id), right: layout.right.filter((x) => x !== id) });

  const render = (): void => {
    const L = items(layout.left);
    const R = items(layout.right);
    const st = checkLayout(L, R);
    const tilt = Math.max(-18, Math.min(18, (st.right - st.left) * 3));
    const lighter: 'left' | 'right' = st.left <= st.right ? 'left' : 'right';
    clear(body);
    clear(footer);

    const reqs = deps.crew.map((c) => {
      const r = REQUESTS[c];
      const it = byId(r.item);
      const packed = layout.left.includes(r.item) || layout.right.includes(r.item);
      return h('div', { class: `req${packed ? ' ok' : ''}` },
        pxImg(portraitURL(CANDIDATES[c].look, packed ? 'joy' : 'neutral'), CANDIDATES[c].name, 'mini'),
        h('p', {}, h('b', {}, CANDIDATES[c].name), ` ${r.line}`, h('br', {}), h('small', {}, `요청: ${it?.name ?? r.item}${packed ? ' · 실림' : ''}`)));
    });

    const cards = deps.pool.map((it) => {
      const side = layout.left.includes(it.id) ? 'left' : layout.right.includes(it.id) ? 'right' : null;
      const who = requesters.get(it.id);
      const notes = [
        it.owner ? `${iGa(CANDIDATES[it.owner].name)} 맡긴 물건` : null,
        who ? `${CANDIDATES[who].name} 요청` : null,
      ].filter(Boolean).join(' · ');
      const sideBtn = (s: 'left' | 'right'): HTMLElement => h('button', {
        class: `btn tiny${deps.guide && s === lighter ? ' rec' : ''}`, type: 'button', onClick: () => add(it.id, s),
      }, s === 'left' ? '왼쪽 칸' : '오른쪽 칸', deps.guide && s === lighter ? h('em', {}, ' 권장') : null);
      return h('article', { class: `cargo-item${side ? ' packed' : ''}`, 'data-id': it.id },
        pxImg(itemURL(it.id), it.name, 'item'),
        h('div', { class: 'ci-meta' },
          h('b', {}, it.name),
          h('span', {}, ` ${it.kg}kg · ${it.tag}`),
          deps.memo.includes(it.id) ? h('span', { class: 'memo' }, '목록') : null,
          notes ? h('small', {}, notes) : null),
        h('div', { class: 'ci-actions' },
          h('button', { class: 'btn tiny', type: 'button', onClick: () => deps.onDetails(it) }, '자세히'),
          ...(side
            ? [h('span', { class: 'side' }, side === 'left' ? '왼쪽 칸에 실림' : '오른쪽 칸에 실림'), h('button', { class: 'btn tiny', type: 'button', onClick: () => remove(it.id) }, '빼기')]
            : [sideBtn('left'), sideBtn('right')])));
    });

    const bay = (title: string, list: CargoItem[], kg: number): HTMLElement => h('div', { class: 'bay' },
      h('b', {}, `${title} ${kg.toFixed(1)} / ${BAY_LIMIT}kg`),
      ...list.map((i) => h('span', { class: 'chip-item' }, pxImg(itemURL(i.id), i.name, 'item'), ` ${i.name}`)));

    body.append(
      h('div', { class: 'cargo-head' },
        h('p', {}, `생명유지 필수품은 이미 실려 있어요. 추가로 ${CARGO_LIMIT}kg까지, 좌우 칸은 각 ${BAY_LIMIT}kg 이하, 좌우 차이는 ${BAY_DIFF}kg 이하로 맞춰요.`),
        h('div', { class: 'weigh' },
          h('div', { class: 'wbar' }, h('i', { style: { width: `${Math.min(100, (st.total / CARGO_LIMIT) * 100)}%` } })),
          h('span', {}, `${st.total.toFixed(1)} / ${CARGO_LIMIT}kg`),
          h('div', { class: 'tilt', 'aria-hidden': 'true' }, h('i', { style: { transform: `rotate(${tilt}deg)` } })),
          h('span', { class: `status${st.ok ? ' ok' : ''}`, role: 'status' }, st.ok ? '균형 OK' : st.reason ?? '')),
      ),
      h('div', { class: 'reqs' }, ...reqs),
      h('div', { class: 'cargo-grid' },
        h('section', { class: 'items' }, ...cards),
        h('aside', { class: 'bays' }, bay('왼쪽 칸', L, st.left), bay('오른쪽 칸', R, st.right))),
    );
    if (deps.slots) {
      const saved = deps.slots.get();
      body.append(h('div', { class: 'cargo-slots' }, h('b', {}, '적재안 슬롯'),
        ...[0, 1, 2].map((i) => h('div', { class: 'save-row' },
          h('span', {}, saved[i] ? `${i + 1}번 · ${totalKg(items([...(saved[i] as CargoLayout).left, ...(saved[i] as CargoLayout).right])).toFixed(1)}kg` : `${i + 1}번 · 비어 있음`),
          h('button', { class: 'btn tiny', type: 'button', onClick: () => { deps.slots?.set(i, layout); deps.notify(`${i + 1}번 슬롯에 저장했어요`); render(); } }, '저장'),
          h('button', {
            class: 'btn tiny', type: 'button', disabled: !saved[i],
            onClick: () => { const l = saved[i]; if (l) set({ left: l.left.filter((x) => byId(x)), right: l.right.filter((x) => byId(x)) }); },
          }, '불러오기')))));
    }
    footer.append(
      deps.onClose ? h('button', { class: 'btn', type: 'button', onClick: () => deps.onClose?.() }, '닫고 둘러보기') : '',
      h('button', {
        class: 'btn', type: 'button', disabled: L.length + R.length === 0,
        onClick: () => {
          const res = autoBalance([...L, ...R]);
          if (!res) deps.notify('이 조합은 좌우 균형을 맞출 수 없어요. 물품을 바꿔 보세요.');
          else set(res);
        },
      }, '자동 균형 제안'),
      h('button', { class: 'btn primary', type: 'button', disabled: !st.ok, onClick: () => deps.onReady(layout) }, '봉인 준비'),
    );
  };

  render();
  return host.open({ title: '수하물실 · 마지막 12킬로그램', body, footer, cls: 'wide cargo-modal', closable: false });
}
