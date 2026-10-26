import { describe, expect, it } from 'vitest';
import { createMeasurement, measureReducer, type MeasureAction, type MeasurementState } from '../src/analytics/measurement';
import { buildReport, followupNeeds, scoreAxis } from '../src/analytics/scoring';
import { oppId, type Dim, type Family } from '../src/analytics/opportunities';
import { CHAPTER_IDS } from '../src/shared/ids';

const FAM: Record<Dim, Family> = { SN: 'INFO', O: 'VARIANT', C: 'ORDER', JP: 'ORDER', E: 'SOCIAL', A: 'PERSPECTIVE', TF: 'PERSPECTIVE' };

/** dims마다 장별 극(pole)을 정해 행동 기록을 만든다. null이면 그 장에서는 행동 없음 */
function build(plan: Partial<Record<Dim, (1 | -1 | null)[]>>, optIn = true): MeasurementState {
  let s = createMeasurement(optIn);
  const d = (a: MeasureAction): void => { s = measureReducer(s, a); };
  let k = 0;
  CHAPTER_IDS.forEach((ch, ci) => {
    for (const [dim, poles] of Object.entries(plan) as [Dim, (1 | -1 | null)[]][]) {
      const id = oppId(ch, FAM[dim]);
      d({ type: 'open', id });
      const pole = poles[ci];
      if (pole === null || pole === undefined) continue;
      k += 1;
      const kind = dim === 'SN' || dim === 'TF' ? 'tab' : 'fork';
      d({ type: 'act', act: { opportunityId: id, dim, kind, pole, actKey: `k${k}`, displayPosition: k % 2, optionSetId: `${id}#${dim}`, label: 't' } });
    }
  });
  return s;
}
const all = (p: 1 | -1): (1 | -1)[] => CHAPTER_IDS.map(() => p);
const answer = (s: MeasurementState, pole: 1 | -1): MeasurementState => {
  let out = s;
  followupNeeds(s).forEach((q, i) => { out = measureReducer(out, { type: 'followup', answer: { qid: q.id, dim: q.dim, pole, displayPosition: i % 2 } }); });
  return out;
};

describe('추가 질문: 결과에 근거 부족(?)·동률(X)을 남기지 않는다', () => {
  // E·JP·O·C·A는 뚜렷, SN은 행동 없음(근거 부족), TF는 2개 장만(기준 미달)
  const base = build({ E: all(1), JP: all(-1), O: all(1), C: all(1), A: all(-1), TF: [1, 1, null, null, null, null, null, null] });

  it('근거 부족 축은 3문항씩 묻는다', () => {
    expect(scoreAxis(base, 'SN').letter).toBe('?');
    expect(scoreAxis(base, 'TF').letter).toBe('?');
    const needs = followupNeeds(base);
    expect(needs.filter((q) => q.dim === 'SN')).toHaveLength(3);
    expect(needs.filter((q) => q.dim === 'TF')).toHaveLength(3);
    expect(needs.filter((q) => q.dim === 'E' || q.dim === 'JP' || q.dim === 'O' || q.dim === 'C' || q.dim === 'A')).toHaveLength(0);
  });

  it('답하면 모든 축 글자가 정해지고 유형이 하나로 나온다', () => {
    const done = answer(base, 1);
    expect(followupNeeds(done)).toHaveLength(0);
    const rep = buildReport(done);
    expect(rep.axes.SN.letter).toBe('N');
    expect(rep.axes.SN.byFollowup).toBe(true);
    expect(rep.axes.TF.letter).toBe('F');
    expect(rep.type.strict).not.toMatch(/[?X]/);
    expect(rep.type.closest).toBe(rep.type.strict);
    expect(rep.axes.EI.byFollowup).toBe(false);
  });

  it('반대로 답하면 반대 글자가 나온다(질문의 극 방향 확인)', () => {
    const rep = buildReport(answer(base, -1));
    expect(rep.axes.SN.letter).toBe('S');
    expect(rep.axes.TF.letter).toBe('T');
  });

  it('거의 동률(X) 축은 1문항으로 정한다', () => {
    const tie = build({ E: all(1), JP: all(1), O: all(1), C: all(1), A: all(1), TF: all(1), SN: [1, -1, 1, -1, 1, -1, 1, -1] });
    expect(scoreAxis(tie, 'SN').letter).toBe('X');
    const needs = followupNeeds(tie);
    expect(needs.map((q) => q.dim)).toEqual(['SN']);
    expect(buildReport(answer(tie, -1)).axes.SN.letter).toBe('S');
  });

  it('빅파이브 O·C·A가 기준 미달이면 추가 질문으로 지수를 정한다', () => {
    const s = build({ E: all(1), JP: all(1), SN: all(1), TF: all(1), O: [1, null, null, null, null, null, null, null] });
    const needs = followupNeeds(s);
    expect(needs.filter((q) => q.dim === 'O')).toHaveLength(3);
    const rep = buildReport(answer(s, 1));
    for (const k of ['O', 'C', 'A'] as const) {
      expect(rep.bigFive[k].resolvedBy).toBe('followup');
      expect(rep.bigFive[k].index).not.toBeNull();
    }
  });

  it('관찰이 20개 미만이어도 추가 질문을 마치면 결과를 보류하지 않는다', () => {
    const thin = build({ JP: [1, 1, 1, 1, null, null, null, null] });
    expect(buildReport(thin).quality.withheld).toBe(true);
    const rep = buildReport(answer(thin, 1));
    expect(rep.quality.withheld).toBe(false);
    expect(rep.type.strict).not.toMatch(/[?X]/);
  });

  it('분석을 끈 판에서는 묻지도 기록하지도 않는다', () => {
    const off = build({}, false);
    expect(followupNeeds(off)).toHaveLength(0);
    const s = measureReducer(off, { type: 'followup', answer: { qid: 'S1', dim: 'SN', pole: 1, displayPosition: 0 } });
    expect(s.followups ?? []).toHaveLength(0);
  });

  it('같은 문항을 두 번 답해도 한 번만 센다', () => {
    let s = base;
    for (let i = 0; i < 2; i += 1) s = measureReducer(s, { type: 'followup', answer: { qid: 'S1', dim: 'SN', pole: 1, displayPosition: 0 } });
    expect((s.followups ?? []).filter((a) => a.qid === 'S1')).toHaveLength(1);
  });
});
