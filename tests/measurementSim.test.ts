import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createMeasurement, measureReducer, type ActInput, type MeasureAction, type MeasurementState } from '../src/analytics/measurement';
import { AXES, AXIS_LETTERS, buildReport, scoreDim, type Axis } from '../src/analytics/scoring';
import { oppId, type Dim, type Family } from '../src/analytics/opportunities';
import { CHAPTER_IDS } from '../src/shared/ids';
import { mulberry32 } from '../src/shared/rng';

const root = fileURLToPath(new URL('..', import.meta.url));
const DIMS: Dim[] = ['O', 'C', 'E', 'A', 'SN', 'TF', 'JP'];
const AXIS_DIM: Record<Axis, Dim> = { EI: 'E', SN: 'SN', TF: 'TF', JP: 'JP' };
type Kind = 'normal' | 'firstButton' | 'disengaged';
interface Agent { q: Record<Dim, number>; kind: Kind }
const FAMS: Family[] = ['INFO', 'VARIANT', 'ORDER', 'SOCIAL', 'PERSPECTIVE'];

/** 설계(03_MEASUREMENT_v2)대로 8장 40개 기회를 플레이하는 합성 플레이어 */
function play(agent: Agent, seed: number): MeasurementState {
  const r = mulberry32(seed);
  let s = createMeasurement(true);
  const d = (a: MeasureAction): void => { s = measureReducer(s, a); };
  let k = 0;
  const act = (opp: string, dim: Dim, kind: ActInput['kind'], p: number, secondary = false): void => {
    const order: (1 | -1)[] = r() < 0.5 ? [1, -1] : [-1, 1];
    let pole: 1 | -1;
    if (agent.kind === 'firstButton') pole = order[0];
    else pole = r() < p ? 1 : -1;
    k += 1;
    d({ type: 'act', act: { opportunityId: opp, dim, kind, pole, actKey: `k${k}`, displayPosition: order.indexOf(pole), optionSetId: `${opp}#${k}`, label: 'sim', secondary } });
  };
  const engaged = agent.kind !== 'disengaged';
  for (const ch of CHAPTER_IDS) {
    const [I, V, O, S, P] = FAMS.map((f) => oppId(ch, f));
    [I, V, O, S, P].forEach((id) => d({ type: 'open', id }));
    const panels = engaged ? (ch === 'C1' ? 1 + Math.floor(r() * 4) : Math.floor(r() * 3)) : 0;
    for (let i = 0; i < panels; i += 1) {
      act(I, 'SN', 'tab', agent.q.SN);
      if (r() < 0.3) act(I, 'SN', 'tab', 0.5, true);
    }
    act(V, 'O', 'fork', agent.q.O);
    act(O, 'C', 'fork', agent.q.C);
    act(O, 'JP', 'fork', agent.q.JP);
    if (ch !== 'C1') act(S, 'E', 'fork', agent.q.E);
    const hs = engaged ? Math.floor(r() * 3) : 0;
    for (let i = 0; i < hs; i += 1) act(S, 'E', 'hotspot', agent.q.E);
    act(P, 'A', 'fork', agent.q.A);
    if (engaged && r() < 0.7) {
      act(P, 'TF', 'tab', agent.q.TF);
      if (r() < 0.3) act(P, 'TF', 'tab', 0.5, true);
    }
    [I, V, O, S, P].forEach((id) => d({ type: 'close', id }));
  }
  return s;
}

function corr(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}

const R = mulberry32(777);
const qAll = (f: () => number): Record<Dim, number> => Object.fromEntries(DIMS.map((d) => [d, f()])) as Record<Dim, number>;

const IDEAL = Array.from({ length: 2000 }, () => ({ q: qAll(() => 0.1 + 0.8 * R()), kind: 'normal' as Kind }));
const idealStates = IDEAL.map((a, i) => play(a, 1000 + i));
const EXTREME = Array.from({ length: 1000 }, () => ({ q: qAll(() => (R() < 0.5 ? 0.15 : 0.85)), kind: 'normal' as Kind }));
const extremeStates = EXTREME.map((a, i) => play(a, 5000 + i));
const RANDOM = Array.from({ length: 2000 }, () => ({ q: qAll(() => 0.5), kind: 'normal' as Kind }));
const randomStates = RANDOM.map((a, i) => play(a, 9000 + i));
const FIRST = Array.from({ length: 500 }, () => ({ q: qAll(() => 0.5), kind: 'firstButton' as Kind }));
const firstStates = FIRST.map((a, i) => play(a, 20000 + i));
const LAZY = Array.from({ length: 300 }, () => ({ q: qAll(() => 0.1 + 0.8 * R()), kind: 'disengaged' as Kind }));
const lazyStates = LAZY.map((a, i) => play(a, 30000 + i));

const corrByDim: Record<string, number> = {};
const locoCover: Record<string, number> = {};
const intervalCover: Record<string, number> = {};
const intervalWidth: Record<string, number> = {};
for (const d of DIMS) {
  const xs: number[] = [];
  const ys: number[] = [];
  let cover = 0; let n = 0; let icover = 0; let ni = 0; let width = 0;
  idealStates.forEach((s, i) => {
    const r = scoreDim(s, d);
    if (r.m === null || !r.meetsThreshold) return;
    xs.push(IDEAL[i].q[d]);
    ys.push(r.m);
    const truth = 2 * IDEAL[i].q[d] - 1;
    if (r.loco) { n += 1; if (truth >= r.loco[0] - 1e-9 && truth <= r.loco[1] + 1e-9) cover += 1; }
    if (r.interval) { ni += 1; width += (r.interval[1] - r.interval[0]) * 50; if (truth >= r.interval[0] - 1e-9 && truth <= r.interval[1] + 1e-9) icover += 1; }
  });
  corrByDim[d] = corr(xs, ys);
  locoCover[d] = n ? cover / n : 0;
  intervalCover[d] = ni ? icover / ni : 0;
  intervalWidth[d] = ni ? width / ni : 0;
}

const extremeAcc: Record<string, number> = {};
const extremeStrong: Record<string, number> = {};
const randomStrong: Record<string, number> = {};
const randomAtLeast2: Record<string, number> = {};
const randomX: Record<string, number> = {};
for (const ax of AXES) {
  const d = AXIS_DIM[ax];
  let ok = 0; let strong = 0;
  extremeStates.forEach((s, i) => {
    const rep = buildReport(s).axes[ax];
    const want = EXTREME[i].q[d] > 0.5 ? AXIS_LETTERS[ax][0] : AXIS_LETTERS[ax][1];
    if (rep.closest === want) ok += 1;
    if (rep.certainty === 3) strong += 1;
  });
  extremeAcc[ax] = ok / extremeStates.length;
  extremeStrong[ax] = strong / extremeStates.length;
  let s3 = 0; let s2 = 0; let sx = 0;
  randomStates.forEach((s) => {
    const rep = buildReport(s).axes[ax];
    if (rep.certainty === 3) s3 += 1;
    if (rep.certainty >= 2) s2 += 1;
    if (rep.letter === 'X') sx += 1;
  });
  randomStrong[ax] = s3 / randomStates.length;
  randomAtLeast2[ax] = s2 / randomStates.length;
  randomX[ax] = sx / randomStates.length;
}
const firstFlag = firstStates.filter((s) => buildReport(s).quality.positionBias).length / firstStates.length;
const normalFlag = randomStates.concat(idealStates).filter((s) => buildReport(s).quality.positionBias).length / (randomStates.length + idealStates.length);

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
mkdirSync(join(root, 'docs', 'simulation'), { recursive: true });
writeFileSync(join(root, 'docs', 'simulation', 'measurement.md'), [
  '# 측정 시뮬레이션 결과 (합성 플레이어)',
  '',
  '설계대로 8장·40개 기회를 플레이하는 가상 플레이어로 채점 알고리즘을 점검했다. **이상적인 조건의 알고리즘 회수율**일 뿐, 실제 사람에 대한 타당도가 아니다.',
  '',
  '## 성향 회수 (이상적 플레이어 2,000명, 성향 q ~ U(0.1, 0.9))',
  '| 차원 | 상관 r(q, 지수) | 80% 범위가 실제 성향을 포함한 비율 | 80% 범위 평균 폭(지수 점) | (참고) LOCO 범위 포함률 |',
  '|---|---|---|---|---|',
  ...DIMS.map((d) => `| ${d} | ${corrByDim[d].toFixed(3)} | ${pct(intervalCover[d])} | ±${(intervalWidth[d] / 2).toFixed(1)} | ${pct(locoCover[d])} |`),
  '',
  'LOCO 범위는 실제 성향을 30~40%만 포함해 불확실성 구간으로 쓰면 안 된다는 것을 확인했다. 결과지에는 80% 범위를 쓰고, LOCO는 확실도(부호 안정성) 판단에만 쓴다.',
  '',
  '## MBTI 글자',
  '| 축 | 뚜렷한 성향(q=0.15/0.85) 1,000명 글자 정답률 | 그중 강함(3) 비율 | 무작위 클릭 2,000명 중 강함(3) | 무작위 중 보통 이상(≥2) | 무작위 중 X |',
  '|---|---|---|---|---|---|',
  ...AXES.map((a) => `| ${a} | ${pct(extremeAcc[a])} | ${pct(extremeStrong[a])} | ${pct(randomStrong[a])} | ${pct(randomAtLeast2[a])} | ${pct(randomX[a])} |`),
  '',
  '## 데이터 품질',
  `- 늘 첫 번째 버튼만 누르는 플레이어 500명 중 위치 편향 경고: ${pct(firstFlag)}`,
  `- 보통 플레이어 4,000명 중 잘못된 위치 편향 경고: ${pct(normalFlag)}`,
  '',
  '## 해석',
  '- 무작위로 누르는 사람도 확실도 2(결과지 표기: 경향)의 글자를 40~55% 받는다. 차원당 근거가 8개뿐인 구조의 한계이며, 결과지는 확실도 3만 \'뚜렷함\'으로, 1~2는 \'경향/약한 경향\'으로 표기하고 범위를 함께 보여 줘야 한다.',
  '- \'강함(3)\'은 장별 부호 검정(p ≤ 0.10)을 통과해야 하므로 무작위 클릭에서는 드물다.',
].join('\n'));

describe('측정 시뮬레이션 (합성 플레이어)', () => {
  it('이상적 조건에서 모든 차원의 성향 회수 상관이 0.6 이상', () => {
    DIMS.forEach((d) => expect(corrByDim[d]).toBeGreaterThanOrEqual(0.6));
  });

  it('결과지의 80% 범위는 실제 성향을 70% 이상 포함한다 (과신하지 않는 범위)', () => {
    DIMS.forEach((d) => expect(intervalCover[d]).toBeGreaterThanOrEqual(0.7));
  });

  it('뚜렷한 성향의 플레이어는 가장 가까운 글자가 85% 이상 맞는다', () => {
    AXES.forEach((a) => expect(extremeAcc[a]).toBeGreaterThanOrEqual(0.85));
  });

  it('무작위로 누르는 플레이어가 강함(3) 확실도를 받는 비율은 축마다 12% 이하', () => {
    AXES.forEach((a) => expect(randomStrong[a]).toBeLessThanOrEqual(0.12));
  });

  it('첫 번째 버튼만 누르는 패턴은 95% 이상 경고되고, 보통 플레이어 오경고는 2% 이하', () => {
    expect(firstFlag).toBeGreaterThanOrEqual(0.95);
    expect(normalFlag).toBeLessThanOrEqual(0.02);
  });

  it('선택 행동을 거의 안 하는 플레이어는 SN·TF가 근거 부족(?)으로 나오고 지어내지 않는다', () => {
    lazyStates.forEach((s) => {
      const rep = buildReport(s);
      expect(rep.axes.SN.letter).toBe('?');
      expect(rep.axes.TF.letter).toBe('?');
      expect(rep.neuroticism).toBe('insufficient');
    });
  });

  it('지수는 항상 0~100, m은 -1~1, NaN 없음', () => {
    for (const s of [...idealStates.slice(0, 300), ...randomStates.slice(0, 300)]) {
      const rep = buildReport(s);
      for (const d of Object.values(rep.bigFive)) {
        if (d.index !== null) { expect(d.index).toBeGreaterThanOrEqual(0); expect(d.index).toBeLessThanOrEqual(100); }
        if (d.m !== null) { expect(Number.isNaN(d.m)).toBe(false); expect(Math.abs(d.m)).toBeLessThanOrEqual(1); }
      }
    }
  });
});
