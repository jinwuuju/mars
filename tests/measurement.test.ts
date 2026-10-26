import { describe, expect, it } from 'vitest';
import { createMeasurement, measureReducer, type ActInput, type MeasurementState } from '../src/analytics/measurement';
import { buildReport, extractFeature, scoreAxis, scoreDim } from '../src/analytics/scoring';
import { OPPORTUNITIES, oppId, type Dim } from '../src/analytics/opportunities';
import { CHAPTER_IDS, type ChapterId } from '../src/shared/ids';

const act = (opportunityId: string, dim: Dim, pole: 1 | -1, actKey: string, kind: ActInput['kind'] = 'fork', displayPosition = 0): ActInput => ({
  opportunityId, dim, kind, pole, actKey, displayPosition, optionSetId: actKey, label: 'x',
});

function run(steps: Array<{ type: 'open' | 'close'; id: string } | { type: 'act'; act: ActInput }>, optIn = true): MeasurementState {
  return steps.reduce((s, a) => measureReducer(s, a), createMeasurement(optIn));
}

describe('관찰 기회 정의', () => {
  it('48개 = 장마다 6개, 채점 40 + STORY 8', () => {
    expect(OPPORTUNITIES).toHaveLength(48);
    expect(OPPORTUNITIES.filter((o) => o.scored)).toHaveLength(40);
    expect(OPPORTUNITIES.filter((o) => !o.scored)).toHaveLength(8);
    CHAPTER_IDS.forEach((c) => expect(OPPORTUNITIES.filter((o) => o.chapter === c)).toHaveLength(6));
  });

  it('N(신경성) 차원은 어디에도 없다', () => {
    OPPORTUNITIES.forEach((o) => expect(o.dims as string[]).not.toContain('N'));
  });
});

describe('기록 규칙', () => {
  const O = oppId('C3', 'VARIANT');

  it('분석 끄기면 이벤트를 만들지 않는다', () => {
    const s = run([{ type: 'open', id: O }, { type: 'act', act: act(O, 'O', 1, 'k') }], false);
    expect(s.events).toHaveLength(0);
  });

  it('열리지 않은 기회(unavailable)에는 기록하지 않는다', () => {
    const s = run([{ type: 'act', act: act(O, 'O', 1, 'k') }]);
    expect(s.events).toHaveLength(0);
  });

  it('같은 actKey는 한 번만 기록된다 (중복 클릭·새로고침)', () => {
    const s = run([{ type: 'open', id: O }, { type: 'act', act: act(O, 'O', 1, 'k') }, { type: 'act', act: act(O, 'O', -1, 'k') }]);
    expect(s.events).toHaveLength(1);
    expect(s.duplicates).toBe(1);
  });

  it('닫힌 기회에는 더 기록되지 않는다', () => {
    const s = run([{ type: 'open', id: O }, { type: 'close', id: O }, { type: 'act', act: act(O, 'O', 1, 'k') }]);
    expect(s.events).toHaveLength(0);
    expect(s.opportunities[O].status).toBe('skipped');
  });

  it('STORY 기회에는 어떤 행위도 기록되지 않는다', () => {
    const S = oppId('C1', 'STORY');
    const s = run([{ type: 'open', id: S }, { type: 'act', act: act(S, 'O', 1, 'k') }]);
    expect(s.events).toHaveLength(0);
  });

  it('기회의 차원이 아닌 행위는 기록되지 않는다', () => {
    const s = run([{ type: 'open', id: O }, { type: 'act', act: act(O, 'E', 1, 'k') }]);
    expect(s.events).toHaveLength(0);
  });
});

describe('특징 추출', () => {
  it('행위가 없으면 null (무응답을 반대 성향으로 보지 않는다)', () => {
    expect(extractFeature([], 'C3-O02', 'O')).toBeNull();
  });

  it('탭은 패널마다 처음 고른 쪽만 채점하고, 같은 패널의 두 번째 탭은 근거로만 남긴다', () => {
    const I = oppId('C2', 'INFO');
    const first = act(I, 'SN', 1, 'p1-first', 'tab');
    const second = { ...act(I, 'SN', -1, 'p1-more', 'tab'), secondary: true };
    const s = run([{ type: 'open', id: I }, { type: 'act', act: first }, { type: 'act', act: second }]);
    expect(s.events).toHaveLength(2);
    expect(extractFeature(s.events, I, 'SN')).toBe(1);
    const s2 = run([{ type: 'open', id: I }, { type: 'act', act: first }, { type: 'act', act: act(I, 'SN', 1, 'p2-first', 'tab') }, { type: 'act', act: act(I, 'SN', -1, 'p3-first', 'tab') }]);
    expect(extractFeature(s2.events, I, 'SN')).toBeCloseTo(1 / 3, 5);
  });

  it('두 번째 탭만 있으면 null (근거로만 남고 점수에는 들어가지 않음)', () => {
    const I = oppId('C4', 'INFO');
    const s = run([{ type: 'open', id: I }, { type: 'act', act: { ...act(I, 'SN', 1, 'x', 'tab'), secondary: true } }]);
    expect(extractFeature(s.events, I, 'SN')).toBeNull();
  });

  it('핫스팟은 극마다 상한 2', () => {
    const So = oppId('C1', 'SOCIAL');
    const steps: Array<{ type: 'open'; id: string } | { type: 'act'; act: ActInput }> = [{ type: 'open', id: So }];
    for (let i = 0; i < 5; i += 1) steps.push({ type: 'act', act: act(So, 'E', 1, `h${i}`, 'hotspot') });
    steps.push({ type: 'act', act: act(So, 'E', -1, 'q', 'hotspot') });
    const s = run(steps);
    expect(extractFeature(s.events, So, 'E')).toBeCloseTo((2 - 1) / 3, 5);
  });
});

function playAll(pick: (ch: ChapterId) => 1 | -1, chapters: readonly ChapterId[] = CHAPTER_IDS): MeasurementState {
  let s = createMeasurement(true);
  for (const ch of chapters) {
    const id = oppId(ch, 'ORDER');
    s = measureReducer(s, { type: 'open', id });
    s = measureReducer(s, { type: 'act', act: act(id, 'JP', pick(ch), `${ch}-jp`) });
    s = measureReducer(s, { type: 'close', id });
  }
  return s;
}

describe('집계와 MBTI 글자', () => {
  it('3개 장 미만이면 숫자도 글자도 없다 (?)', () => {
    const s = playAll(() => 1, ['C2', 'C3']);
    expect(scoreDim(s, 'JP').meetsThreshold).toBe(false);
    expect(scoreAxis(s, 'JP').letter).toBe('?');
  });

  it('여러 장에서 일관되면 글자가 나온다', () => {
    const s = playAll(() => 1);
    const r = scoreAxis(s, 'JP');
    expect(r.letter).toBe('J');
    expect(r.certainty).toBe(3);
    expect(r.dim.index).toBe(100);
  });

  it('8장 중 6장만 같은 방향이면 글자는 나오지만 강함(3)은 아니다', () => {
    const s = playAll((ch) => (ch === 'C3' || ch === 'C6' ? -1 : 1));
    const r = scoreAxis(s, 'JP');
    expect(r.letter).toBe('J');
    expect(r.certainty).toBeLessThan(3);
  });

  it('반반이면 X (근소)', () => {
    const s = playAll((ch) => (CHAPTER_IDS.indexOf(ch) % 2 === 0 ? 1 : -1));
    expect(scoreAxis(s, 'JP').letter).toBe('X');
  });

  it('보고서는 N을 항상 판단 자료 부족으로 둔다', () => {
    expect(buildReport(playAll(() => -1)).neuroticism).toBe('insufficient');
  });

  it('같은 행동이면 같은 결과 (결정성)', () => {
    const a = buildReport(playAll(() => -1));
    const b = buildReport(playAll(() => -1));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
