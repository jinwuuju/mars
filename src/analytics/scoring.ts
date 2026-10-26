import { PRESSURE, type ChapterId } from '../shared/ids';
import { OPPORTUNITIES, type Dim } from './opportunities';
import type { ActKind, MeasureEvent, MeasurementState } from './measurement';
import { FOLLOWUPS, followupSum } from './followup';

/**
 * 사전 등록된 채점 규칙 (design/03_MEASUREMENT_v2.md §3~§7).
 * 입력은 MeasurementState 하나뿐이다. 승선 명단·이야기 상태는 구조적으로 들어올 수 없다.
 */
export const CAPS: Record<ActKind, number> = { fork: Number.POSITIVE_INFINITY, tab: 3, hotspot: 2 };
export const LETTER_THRESHOLD = 0.25;
export const CLOSEST_THRESHOLD = 0.05;
export const TIE_THRESHOLD = 0.1;
export const STRONG_P = 0.1;
/** 차원마다 장당 기회가 1개뿐이라 '기회 4개'는 곧 '장 4개'다. 실제 기준이 드러나도록 4로 둔다(동작은 예전 3장·4기회와 같다). */
export const MIN_CHAPTERS = 4;
export const MIN_OPPORTUNITIES = 4;

export function toIndex(m: number): number {
  return Math.round(50 + 50 * m);
}

/** 한 기회에서 한 차원의 특징값 f = (W+ - W-) / (W+ + W-). 행위가 없으면 null. */
export function extractFeature(events: readonly MeasureEvent[], opportunityId: string, dim: Dim): number | null {
  const used = { plus: { fork: 0, tab: 0, hotspot: 0 }, minus: { fork: 0, tab: 0, hotspot: 0 } };
  let plus = 0;
  let minus = 0;
  for (const e of events) {
    if (e.opportunityId !== opportunityId || e.dim !== dim) continue;
    const side = e.pole === 1 ? used.plus : used.minus;
    const w = Math.max(0, Math.min(e.weight, CAPS[e.kind] - side[e.kind]));
    side[e.kind] += w;
    if (e.pole === 1) plus += w;
    else minus += w;
  }
  const total = plus + minus;
  return total === 0 ? null : (plus - minus) / total;
}

export interface ChapterValue {
  chapter: ChapterId;
  opportunityId: string;
  value: number;
  weight: number;
}

export function chapterValues(m: MeasurementState, dim: Dim): ChapterValue[] {
  const out: ChapterValue[] = [];
  for (const o of OPPORTUNITIES) {
    if (!o.scored || !o.dims.includes(dim)) continue;
    const r = m.opportunities[o.id];
    if (!r || r.status !== 'observed') continue;
    const v = extractFeature(m.events, o.id, dim);
    if (v === null) continue;
    out.push({ chapter: o.chapter, opportunityId: o.id, value: v, weight: o.chapterWeight });
  }
  return out;
}

function weightedMean(values: readonly ChapterValue[]): number | null {
  let s = 0;
  let w = 0;
  for (const v of values) {
    s += v.value * v.weight;
    w += v.weight;
  }
  return w === 0 ? null : s / w;
}

export type Strength = 0 | 1 | 2 | 3;

/** 80% 양측 구간용 t 분위수(자유도 1~8, 그 이상은 1.383) */
const T80 = [3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397];
export const SD_FLOOR = 0.35;

export function interval80(values: readonly ChapterValue[], m: number): [number, number] | null {
  if (values.length < 2) return null;
  const sw = values.reduce((a, v) => a + v.weight, 0);
  const sw2 = values.reduce((a, v) => a + v.weight * v.weight, 0);
  const nEff = (sw * sw) / sw2;
  const variance = values.reduce((a, v) => a + v.weight * (v.value - m) ** 2, 0) / sw;
  const sd = Math.max(Math.sqrt(variance * (values.length / (values.length - 1))), SD_FLOOR);
  const df = values.length - 1;
  const t = df <= T80.length ? T80[df - 1] : 1.383;
  const half = (t * sd) / Math.sqrt(nEff);
  return [Math.max(-1, m - half), Math.min(1, m + half)];
}

export interface DimResult {
  dim: Dim;
  m: number | null;
  index: number | null;
  validChapters: number;
  validOpportunities: number;
  meetsThreshold: boolean;
  /** 장 하나씩 빼고 다시 계산한 최소~최대: 부호 안정성 판단용(불확실성 구간이 아님) */
  loco: [number, number] | null;
  /** 결과지에 보여 줄 80% 범위(m 단위): 장별 값의 표준오차, t 분포, 표준편차 하한 0.35 */
  interval: [number, number] | null;
  consistency: number | null;
  strength: Strength;
  pressure: { H: number | null; L: number | null; nH: number; nL: number; differs: boolean | null };
  values: ChapterValue[];
  /** 무엇으로 정했는지: 행동 기록 / 추가 질문(행동 근거가 기준에 못 미쳐 추가 질문으로 보충) / 아직 없음 */
  resolvedBy: 'behavior' | 'followup' | null;
}

/** 추가 질문 답을 m 단위로: 답이 한쪽으로 다 모여도 ±0.6까지만(짧은 자기 보고라 행동 근거보다 약하게) */
const FOLLOWUP_SCALE = 0.6;

export function scoreDim(state: MeasurementState, dim: Dim): DimResult {
  const values = chapterValues(state, dim);
  const m = weightedMean(values);
  const validChapters = new Set(values.map((v) => v.chapter)).size;
  const validOpportunities = values.length;
  const meetsThreshold = validChapters >= MIN_CHAPTERS && validOpportunities >= MIN_OPPORTUNITIES;
  let loco: [number, number] | null = null;
  if (values.length >= 2) {
    const means = values
      .map((_, i) => weightedMean(values.filter((__, j) => j !== i)))
      .filter((x): x is number => x !== null);
    if (means.length > 0) loco = [Math.min(...means), Math.max(...means)];
  }
  let consistency: number | null = null;
  if (m !== null && values.length > 0) {
    const same = values.filter((v) => Math.sign(v.value) === Math.sign(m) && v.value !== 0).length;
    consistency = same / values.length;
  }
  let strength: Strength = 0;
  if (meetsThreshold && m !== null) {
    const width = loco ? toIndex(loco[1]) - toIndex(loco[0]) : 100;
    if (validChapters >= 7 && (consistency ?? 0) >= 0.75 && width <= 20) strength = 3;
    else if (validChapters >= 5) strength = 2;
    else strength = 1;
  }
  const hv = values.filter((v) => PRESSURE[v.chapter] === 'H');
  const lv = values.filter((v) => PRESSURE[v.chapter] === 'L');
  const H = weightedMean(hv);
  const L = weightedMean(lv);
  const enough = hv.length >= 3 && lv.length >= 3 && H !== null && L !== null;
  // 행동 근거가 기준에 못 미치면 추가 질문으로 보충한다(행동 m이 있으면 반반 섞는다)
  const fu = followupSum(state.followups, dim);
  let resolvedBy: DimResult['resolvedBy'] = meetsThreshold && m !== null ? 'behavior' : null;
  let index = meetsThreshold && m !== null ? toIndex(m) : null;
  if (!meetsThreshold && fu.n > 0) {
    const mf = (fu.sum / fu.n) * FOLLOWUP_SCALE;
    index = toIndex(m === null ? mf : (m + mf) / 2);
    resolvedBy = 'followup';
  }
  return {
    dim,
    m,
    index,
    resolvedBy,
    validChapters,
    validOpportunities,
    meetsThreshold,
    loco,
    interval: m === null ? null : interval80(values, m),
    consistency,
    strength,
    pressure: { H, L, nH: hv.length, nL: lv.length, differs: enough ? Math.abs((H as number) - (L as number)) >= 0.5 : null },
    values,
  };
}

export type Axis = 'EI' | 'SN' | 'TF' | 'JP';
export const AXES: readonly Axis[] = ['EI', 'SN', 'TF', 'JP'];
const AXIS_SOURCE: Record<Axis, Dim> = { EI: 'E', SN: 'SN', TF: 'TF', JP: 'JP' };
/** [+극 글자, -극 글자] */
export const AXIS_LETTERS: Record<Axis, [string, string]> = { EI: ['E', 'I'], SN: ['N', 'S'], TF: ['F', 'T'], JP: ['J', 'P'] };

export interface AxisResult {
  axis: Axis;
  /** 가까운 쪽 글자. 거의 동률이면 X, 근거 부족이면 ? */
  letter: string;
  /** 가장 가까운 쪽(결과지 콘텐츠용). 거의 0이거나 자료가 없으면 null */
  closest: string | null;
  /** 글자 확실도: 0 없음(?, X) · 1 약함 · 2 보통 · 3 강함 */
  certainty: Strength;
  /** 장별 부호의 양측 부호 검정 p값 (참고용) */
  signP: number | null;
  dim: DimResult;
  /** 플레이 기록으로는 정하지 못해 추가 질문으로 정했다 */
  byFollowup: boolean;
}

/** 이항(p=0.5) 양측 부호 검정 */
export function signTestP(pos: number, neg: number): number {
  const n = pos + neg;
  if (n === 0) return 1;
  const lo = Math.min(pos, neg);
  let comb = 1;
  let sum = 0;
  for (let i = 0; i <= lo; i += 1) {
    if (i > 0) comb = (comb * (n - i + 1)) / i;
    sum += comb;
  }
  return Math.min(1, (2 * sum) / 2 ** n);
}

/**
 * 확실도 규칙 (2026-10-25 시뮬레이션 반영):
 * - 근거 임계 미달 → '?'
 * - |m| < 0.10 → 'X' (거의 동률)
 * - 그 외 가까운 쪽 글자 + 확실도 1(약함)
 * - |m| ≥ 0.25 이고 장 하나를 빼도 부호가 같으면 확실도 2(보통)
 * - 확실도 2 + 유효 장 6개 이상 + 장별 부호 검정 p ≤ 0.10 이면 확실도 3(강함)
 */
export function scoreAxis(state: MeasurementState, axis: Axis): AxisResult {
  const dim = scoreDim(state, AXIS_SOURCE[axis]);
  const [plus, minus] = AXIS_LETTERS[axis];
  let letter = '?';
  let certainty: Strength = 0;
  let signP: number | null = null;
  if (dim.meetsThreshold && dim.m !== null) {
    const pos = dim.values.filter((v) => v.value > 0).length;
    const neg = dim.values.filter((v) => v.value < 0).length;
    signP = signTestP(pos, neg);
    if (Math.abs(dim.m) < TIE_THRESHOLD) {
      letter = 'X';
    } else {
      letter = dim.m > 0 ? plus : minus;
      certainty = 1;
      const locoSame = dim.loco ? (dim.m > 0 ? dim.loco[0] > 0 : dim.loco[1] < 0) : false;
      if (Math.abs(dim.m) >= LETTER_THRESHOLD && locoSame) certainty = 2;
      if (certainty === 2 && dim.validChapters >= 6 && signP <= STRONG_P) certainty = 3;
    }
  }
  let closest = dim.m === null || Math.abs(dim.m) < CLOSEST_THRESHOLD ? null : dim.m > 0 ? plus : minus;
  // 근거 부족(?)·거의 동률(X)이면 추가 질문으로 정한다. 문항 수가 홀수(3 또는 1)라 합이 0이 되지 않는다
  let byFollowup = false;
  const fu = followupSum(state.followups, AXIS_SOURCE[axis]);
  if ((letter === '?' || letter === 'X') && fu.n > 0) {
    const s = fu.sum !== 0 ? fu.sum : (dim.m ?? 0);
    if (s !== 0) {
      letter = s > 0 ? plus : minus;
      closest = letter;
      certainty = 1;
      byFollowup = true;
    }
  }
  return { axis, letter, closest, certainty, signP, dim, byFollowup };
}

export interface QualityReport {
  forks: number;
  firstPositionRate: number | null;
  positionBias: boolean;
  validOpportunities: number;
  withheld: boolean;
}

export function quality(state: MeasurementState): QualityReport {
  const forks = state.events.filter((e) => e.kind === 'fork');
  const counts = new Map<number, number>();
  for (const f of forks) counts.set(f.displayPosition, (counts.get(f.displayPosition) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  const firstPositionRate = forks.length === 0 ? null : top / forks.length;
  const positionBias = forks.length >= 20 && (firstPositionRate ?? 0) >= 0.85;
  let valid = 0;
  for (const o of OPPORTUNITIES) {
    if (!o.scored || state.opportunities[o.id]?.status !== 'observed') continue;
    if (o.dims.some((d) => extractFeature(state.events, o.id, d) !== null)) valid += 1;
  }
  // 관찰이 20개 미만이어도 추가 질문을 마쳤으면 결과를 보류하지 않는다
  const answered = (state.followups ?? []).length > 0;
  return { forks: forks.length, firstPositionRate, positionBias, validOpportunities: valid, withheld: valid < 20 && !answered };
}

export interface Report {
  bigFive: Record<'O' | 'C' | 'E' | 'A', DimResult>;
  neuroticism: 'insufficient';
  axes: Record<Axis, AxisResult>;
  type: { strict: string; closest: string | null; candidates: string[] };
  quality: QualityReport;
}

/** 가장 가까운 유형 후보(근거 없는 축은 두 글자 모두 후보) */
export function typeCandidates(axes: Record<Axis, AxisResult>): string[] {
  let out = [''];
  for (const axis of AXES) {
    const r = axes[axis];
    // 05 §62: X(거의 동률)·?(근거 부족) 글자는 한쪽으로 단정하지 않고 두 글자 모두 후보로 둔다(가까운 쪽을 앞에)
    const [plus, minus] = AXIS_LETTERS[axis];
    const real = r.letter !== '?' && r.letter !== 'X';
    const options = real ? [r.letter] : r.closest === minus ? [minus, plus] : [plus, minus];
    out = out.flatMap((prefix) => options.map((l) => prefix + l));
  }
  return out;
}

export function buildReport(state: MeasurementState): Report {
  const axes = {
    EI: scoreAxis(state, 'EI'),
    SN: scoreAxis(state, 'SN'),
    TF: scoreAxis(state, 'TF'),
    JP: scoreAxis(state, 'JP'),
  };
  const candidates = typeCandidates(axes);
  return {
    bigFive: { O: scoreDim(state, 'O'), C: scoreDim(state, 'C'), E: scoreDim(state, 'E'), A: scoreDim(state, 'A') },
    neuroticism: 'insufficient',
    axes,
    type: {
      strict: AXES.map((a) => axes[a].letter).join(''),
      closest: candidates.length === 1 ? candidates[0] : null,
      candidates,
    },
    quality: quality(state),
  };
}

/**
 * 결과지 직전에 물어야 할 추가 질문 목록. 이미 답한 문항은 빼고 돌려준다.
 * - MBTI 축이 근거 부족(?)이면 3문항, 거의 동률(X)이면 1문항
 * - 빅파이브 O·C·A가 기준 미달이면 3문항 (E는 EI 축과 같은 근거라 EI에서 함께 정한다)
 * - 분석을 끈 판·첫 버튼만 누르는 패턴(위치 편향)으로 글자를 숨기는 판은 묻지 않는다
 */
export function followupNeeds(state: MeasurementState): { id: string; dim: Dim; prompt: string; plus: string; minus: string }[] {
  if (!state.analysisOptIn) return [];
  const q = quality({ ...state, followups: [] });
  if (q.positionBias) return [];
  const base: MeasurementState = { ...state, followups: [] };
  const want = new Map<Dim, number>();
  for (const axis of AXES) {
    const r = scoreAxis(base, axis);
    if (r.letter === '?') want.set(AXIS_SOURCE[axis], 3);
    else if (r.letter === 'X') want.set(AXIS_SOURCE[axis], 1);
  }
  for (const d of ['O', 'C', 'A'] as const) if (!scoreDim(base, d).meetsThreshold) want.set(d, 3);
  const done = new Set((state.followups ?? []).map((a) => a.qid));
  const out: { id: string; dim: Dim; prompt: string; plus: string; minus: string }[] = [];
  for (const [d, n] of want) for (const fq of FOLLOWUPS[d].slice(0, n)) if (!done.has(fq.id)) out.push(fq);
  return out;
}
