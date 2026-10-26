import { h, clear } from './dom';
import type { ModalHandle, ModalHost } from './panels';

export type Sensor = 'A' | 'B' | 'C';
type Wave = 'flat' | 'noise' | 'dip' | 'mixed';
interface TestDef { id: string; label: string; wave: Wave; text: string }

/** 두 검증 방식은 같은 단서(B는 배선 잡음, C 구간은 실제 미세 누설)를 같은 횟수로 보여 준다. */
const TESTS: Record<'standard' | 'cross', TestDef[]> = {
  standard: [
    { id: 'A', label: '센서 A 단독 측정', wave: 'flat', text: 'A: 압력이 일정하다. 정상.' },
    { id: 'B', label: '센서 B 단독 측정', wave: 'noise', text: 'B: 값이 들쭉날쭉 튄다. 배선 잡음 같은 모양.' },
    { id: 'C', label: '센서 C 단독 측정', wave: 'dip', text: 'C: 아주 조금씩, 주기적으로 압력이 떨어진다.' },
  ],
  cross: [
    { id: 'AB', label: 'A ↔ B 교차 비교', wave: 'noise', text: 'A와 B는 같은 배관인데 B만 튄다 → B 배선 문제 의심.' },
    { id: 'BC', label: 'B ↔ C 교차 비교', wave: 'mixed', text: 'B와 C의 패턴이 다르다 → 원인이 하나가 아닐 수 있다.' },
    { id: 'CA', label: 'C ↔ A 교차 비교', wave: 'dip', text: 'C 구간에서만 압력이 조금씩 샌다 → 밸브 V2 미세 누설 의심.' },
  ],
};

function drawWave(canvas: HTMLCanvasElement, wave: Wave, animate: boolean): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const W = canvas.width;
  const H = canvas.height;
  const y = (x: number): number => {
    const t = x / W;
    switch (wave) {
      case 'flat': return H * 0.5 + Math.sin(x * 0.4) * 0.6;
      case 'noise': return H * 0.5 + Math.sin(x * 1.7) * 7 + Math.sin(x * 0.53) * 5;
      case 'dip': return H * 0.35 + t * H * 0.3 + (x % 40 < 6 ? 6 : 0);
      default: return H * 0.5 + (x < W / 2 ? Math.sin(x * 1.7) * 6 : t * 10 - 4);
    }
  };
  let upto = animate ? 0 : W;
  const paint = (): void => {
    g.fillStyle = '#0F1A2E';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#1D2B44';
    for (let gx = 0; gx < W; gx += 20) g.fillRect(gx, 0, 1, H);
    g.fillStyle = wave === 'flat' ? '#96D9BC' : wave === 'dip' ? '#F48B70' : '#FFD47B';
    for (let x = 0; x < upto; x += 1) g.fillRect(x, Math.round(y(x)), 2, 2);
    if (upto < W) { upto += 8; requestAnimationFrame(paint); }
  };
  paint();
}

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export interface WiringOpts {
  mode: 'plan' | 'flow';
  variant: 'standard' | 'cross';
  reduced: boolean;
  onSensorInfo: (s: Sensor) => void | Promise<void>;
}

/**
 * 기밀 밸브 진단: 센서 3개를 진단 버스 포트에 연결하고 라인 테스트를 한다.
 * 계획 먼저(순서표 3 + 연결 3 + 다음 3 + 완료 1)와 하면서(연결 3 + 실행 3 + 메모 3 + 완료 1)는 조작 수가 같다.
 */
export function wiringGame(host: ModalHost, opts: WiringOpts): Promise<string[]> {
  return new Promise((resolve) => {
    const tests = TESTS[opts.variant];
    const port: Record<Sensor, number | null> = { A: null, B: null, C: null };
    const order: string[] = [];
    const ran = new Set<string>();
    const memo = new Set<string>();
    const log: string[] = [];
    const body = h('div', { class: 'wiring' });
    let handle: ModalHandle | null = null;
    const connected = (): boolean => (['A', 'B', 'C'] as Sensor[]).every((s) => port[s] !== null);
    const orderReady = (): boolean => opts.mode === 'flow' || order.length === tests.length;
    const allDone = (): boolean => ran.size === tests.length && (opts.mode === 'plan' || memo.size === tests.length);

    const assign = (s: Sensor, p: number): void => {
      (['A', 'B', 'C'] as Sensor[]).forEach((o) => { if (o !== s && port[o] === p) port[o] = null; });
      port[s] = p;
      render();
    };

    const run = (t: TestDef): void => {
      if (!connected() || ran.has(t.id)) return;
      ran.add(t.id);
      log.push(t.text);
      render();
    };

    let assistNote = '';
    /** 녹녹이에게 맡기기: 연결·순서·측정·메모를 한 번에 끝내고, 결과(단서)는 화면에 남긴다 */
    const assist = (): void => {
      port.A = 0; port.B = 1; port.C = 2;
      tests.forEach((t) => { if (!order.includes(t.id)) order.push(t.id); });
      tests.forEach((t) => { if (!ran.has(t.id)) { ran.add(t.id); log.push(t.text); } });
      if (opts.mode === 'flow') tests.forEach((t) => memo.add(t.id));
      assistNote = '녹녹이: 연결하고 세 라인을 다 재 봤어요! 아래 결과를 읽어 보고 [진단 완료]를 눌러 주세요.';
      render();
    };

    /** 지금 할 한 가지(맨 위 안내 + 반짝이는 버튼) */
    const next = (): { text: string; key: string } => {
      const free = (['A', 'B', 'C'] as Sensor[]).find((s) => port[s] === null);
      if (free) return { text: `센서 ${free}를 아무 포트에나 연결하세요 (번호는 상관없어요)`, key: `port-${free}` };
      if (!orderReady()) return { text: '순서표에서 테스트를 차례로 눌러 순서를 정하세요', key: 'order' };
      if (ran.size < tests.length) return { text: opts.mode === 'plan' ? '[다음 테스트]를 눌러 차례로 재 보세요' : '[실행] 버튼을 눌러 라인을 재 보세요', key: 'run' };
      if (opts.mode === 'flow' && memo.size < tests.length) return { text: '[결과 메모]를 눌러 결과를 적어 두세요', key: 'memo' };
      return { text: '결과를 읽어 보고 [진단 완료]를 누르세요', key: 'done' };
    };

    const render = (): void => {
      clear(body);
      const n = next();
      const freePort = [0, 1, 2, 3].find((p) => !Object.values(port).includes(p)) ?? 3;
      const svg = svgEl('svg', { viewBox: '0 0 300 170', class: 'wire-svg', role: 'img', 'aria-label': '배선도' });
      (['A', 'B', 'C'] as Sensor[]).forEach((s, i) => {
        const y = 30 + i * 55;
        svg.append(svgEl('circle', { cx: 40, cy: y, r: 9, class: `node s${s}` }));
        const label = svgEl('text', { x: 14, y: y + 4, class: 'wire-label' });
        label.textContent = s;
        svg.append(label);
        const p = port[s];
        if (p !== null) svg.append(svgEl('path', { d: `M49 ${y} C 150 ${y}, 150 ${18 + p * 40}, 251 ${18 + p * 40}`, class: `wire w${s}` }));
      });
      [0, 1, 2, 3].forEach((p) => {
        svg.append(svgEl('rect', { x: 251, y: 10 + p * 40, width: 18, height: 16, rx: 3, class: `port${Object.values(port).includes(p) ? ' used' : ''}` }));
        const t = svgEl('text', { x: 275, y: 22 + p * 40, class: 'wire-label' });
        t.textContent = p === 3 ? '4(예비)' : String(p + 1);
        svg.append(t);
      });

      const rows = (['A', 'B', 'C'] as Sensor[]).map((s) => h('div', { class: 'wire-row' },
        h('b', {}, `센서 ${s}`),
        h('button', { class: 'btn tiny info-opp', type: 'button', onClick: () => void opts.onSensorInfo(s) }, '정보'),
        ...[0, 1, 2, 3].map((p) => h('button', {
          class: `btn tiny${port[s] === p ? ' on' : ''}${n.key === `port-${s}` && p === freePort ? ' hint' : ''}`, type: 'button', 'aria-pressed': String(port[s] === p),
          onClick: () => assign(s, p),
        }, `포트 ${p + 1}`))));

      const nextOrder = tests.find((t) => !order.includes(t.id))?.id;
      const planBox = opts.mode === 'plan' ? h('div', { class: 'order' },
        h('p', {}, '진단 순서표: 실행할 순서대로 누르세요.'),
        h('div', { class: 'row' }, ...tests.map((t) => h('button', {
          class: `btn tiny${order.includes(t.id) ? ' on' : ''}${n.key === 'order' && t.id === nextOrder ? ' hint' : ''}`, type: 'button', disabled: order.includes(t.id),
          onClick: () => { order.push(t.id); render(); },
        }, `${order.includes(t.id) ? `${order.indexOf(t.id) + 1}. ` : ''}${t.label}`)))) : null;

      const nextMemo = tests.find((t) => ran.has(t.id) && !memo.has(t.id))?.id;
      const results = tests.filter((t) => ran.has(t.id)).map((t) => {
        const cv = h('canvas', { width: '220', height: '40', class: 'wave' });
        window.setTimeout(() => drawWave(cv, t.wave, !opts.reduced), 0);
        return h('div', { class: 'result' }, h('b', {}, t.label), cv, h('p', {}, t.text),
          opts.mode === 'flow' ? h('button', {
            class: `btn tiny${memo.has(t.id) ? ' on' : ''}${n.key === 'memo' && t.id === nextMemo ? ' hint' : ''}`, type: 'button', disabled: memo.has(t.id),
            onClick: () => { memo.add(t.id); render(); },
          }, memo.has(t.id) ? '메모함' : '결과 메모') : null);
      });

      const nextRun = tests.find((t) => !ran.has(t.id))?.id;
      const controls = opts.mode === 'plan'
        ? h('div', { class: 'row' }, h('button', {
          class: `btn small primary${n.key === 'run' ? ' hint' : ''}`, type: 'button', disabled: !connected() || !orderReady() || ran.size === tests.length,
          onClick: () => { const nx = order.find((id) => !ran.has(id)); const t = tests.find((x) => x.id === nx); if (t) run(t); },
        }, '다음 테스트'))
        : h('div', { class: 'row' }, ...tests.map((t) => h('button', {
          class: `btn small${n.key === 'run' && t.id === nextRun ? ' hint' : ''}`, type: 'button', disabled: !connected() || ran.has(t.id), onClick: () => run(t),
        }, `${t.label} 실행`)));

      body.append(
        h('div', { class: 'wire-next', role: 'status', 'aria-live': 'polite' }, h('span', { class: 'now-spark', 'aria-hidden': 'true' }, '✦'), h('span', {}, `지금: ${n.text}`)),
        h('p', { class: 'subtitle' }, '센서 세 개를 진단 버스 포트에 연결하고 라인을 재 봐요. 어려우면 녹녹이에게 맡겨도 돼요. 진단 실력은 결과에 쓰이지 않아요.'),
        assistNote ? h('p', { class: 'note' }, assistNote) : '',
        planBox ?? '',
        h('div', { class: 'wire-wrap' }, svg, h('div', { class: 'wire-rows' }, ...rows)),
        controls,
        h('div', { class: 'results', 'aria-live': 'polite' }, ...results),
        h('div', { class: 'row end' },
          h('button', { class: 'btn assist', type: 'button', disabled: allDone(), onClick: assist }, '녹녹이에게 맡기기'),
          h('button', {
            class: `btn primary${n.key === 'done' ? ' hint auto-next' : ''}`, type: 'button', disabled: !allDone(),
            onClick: () => { handle?.close(); resolve(log); },
          }, '진단 완료')),
      );
    };

    render();
    handle = host.open({ title: '기밀 밸브 진단', body, cls: 'wide wiring-modal', closable: false });
  });
}
