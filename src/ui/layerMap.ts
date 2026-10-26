import { h, clear } from './dom';
import type { ModalHandle, ModalHost } from './panels';

type Layer = 'thermal' | 'radar' | 'slope' | 'dist';
const LAYERS: { id: Layer; label: string }[] = [
  { id: 'thermal', label: '지표 열관성' }, { id: 'radar', label: '레이더 반사' }, { id: 'slope', label: '경사' }, { id: 'dist', label: '거리' },
];
/** 3행×4열. 값은 0~1(게임 속 추상값). 얼음 지대(0,3), 일꾼-3 신호(0,1), 세 번째 지점(1,3) */
const V: Record<Layer, number[][]> = {
  thermal: [[0.3, 0.5, 0.4, 0.9], [0.2, 0.3, 0.5, 0.6], [0.1, 0.2, 0.3, 0.4]],
  radar: [[0.2, 0.4, 0.3, 0.95], [0.1, 0.2, 0.3, 0.5], [0.1, 0.1, 0.2, 0.3]],
  slope: [[0.2, 0.3, 0.9, 0.3], [0.3, 0.9, 0.4, 0.2], [0.1, 0.2, 0.2, 0.2]],
  dist: [[0.6, 0.7, 0.8, 1.0], [0.4, 0.5, 0.7, 0.8], [0.0, 0.2, 0.4, 0.6]],
};
const MARK: Record<string, string> = { '0,3': '얼음?', '0,1': '일꾼-3', '1,3': '세 번째', '2,0': '돔' };

/** C7 MIRROR 탐사 지도: 레이어를 켜고 끄며 3x4 격자를 비교한다(얼음은 '가능성'이지 확정이 아니다) */
export function layerMap(host: ModalHost, opts: { onData: () => void; thirdLabel: string }): Promise<void> {
  return new Promise((resolve) => {
    let layer: Layer = 'radar';
    const body = h('div', { class: 'layer-map' });
    let handle: ModalHandle | null = null;
    const render = (): void => {
      clear(body);
      const grid = h('div', { class: 'lm-grid', role: 'grid', 'aria-label': `탐사 지도: ${LAYERS.find((l) => l.id === layer)?.label}` });
      for (let r = 0; r < 3; r += 1) for (let c = 0; c < 4; c += 1) {
        const v = V[layer][r][c];
        const k = `${r},${c}`;
        const mark = k === '1,3' ? opts.thirdLabel : MARK[k];
        grid.append(h('div', { class: 'lm-cell', role: 'gridcell', style: { background: `rgba(${layer === 'slope' ? '158,102,128' : layer === 'dist' ? '84,126,157' : '111,195,240'}, ${0.15 + v * 0.8})` } },
          h('small', {}, v.toFixed(2)), mark ? h('b', {}, mark) : ''));
      }
      body.append(
        h('p', {}, '레이어를 바꿔 보세요. 얼음 지대는 "가능성"이지 확정이 아니에요.'),
        h('div', { class: 'row' }, ...LAYERS.map((l) => h('button', { class: `btn tiny${layer === l.id ? ' on' : ''}`, type: 'button', 'aria-pressed': String(layer === l.id), onClick: () => { layer = l.id; render(); } }, l.label))),
        grid,
      );
    };
    render();
    handle = host.open({
      title: 'MIRROR 탐사 지도', body, cls: 'wide', closable: false,
      footer: h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onClick: () => opts.onData() }, '자료 2탭 열기'),
        h('button', { class: 'btn primary', type: 'button', onClick: () => { handle?.close(); resolve(); } }, '목적지 정하러 가기')),
    });
  });
}
