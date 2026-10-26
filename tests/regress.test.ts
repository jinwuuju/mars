import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyDeltaTo, applyFloors, FLOORS, podItems, START } from '../src/story/effects';
import { simulateRun, type RunChoices } from '../src/story/economy';
import { allRosters } from '../src/story/roster';
import { createMeasurement, measureReducer, recordAct, type ActInput } from '../src/analytics/measurement';
import { typeCandidates, type Axis, type AxisResult } from '../src/analytics/scoring';
import { createMission, type Resources } from '../src/core/state';
import { loadGame, memoryStorage, saveGame, SAVE_KEY, validateBundle } from '../src/core/persistence';

const SRC = join(__dirname, '..', 'src');
const NL = String.fromCharCode(10);

describe('회귀 테스트 (2026-10-25 2차 점검에서 찾은 버그)', () => {
  it('Promise를 기다리는 모달은 Esc로 닫혀도 흐름이 이어진다: closable:false 또는 onEscape 필수', () => {
    const files = ['ui', 'game'].flatMap((d) => readdirSync(join(SRC, d)).filter((f) => f.endsWith('.ts')).map((f) => join(SRC, d, f)));
    const bad: string[] = [];
    let seen = 0;
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      let i = src.indexOf('.open({');
      while (i !== -1) {
        let depth = 0;
        let j = i + 5;
        for (; j < src.length; j += 1) {
          if (src[j] === '(') depth += 1;
          else if (src[j] === ')') { depth -= 1; if (depth === 0) break; }
        }
        const call = src.slice(i, j + 1);
        seen += 1;
        const menu = call.includes(`title: '메뉴'`);
        if (!menu && !call.includes('closable: false') && !call.includes('onEscape')) bad.push(`${file.slice(SRC.length + 1)}:${src.slice(0, i).split(NL).length}`);
        i = src.indexOf('.open({', j);
      }
    }
    expect(seen).toBeGreaterThan(15);
    expect(bad).toEqual([]);
  });

  it('바닥값 보호는 단조롭다: 더 크게 잃어도 더 많이 남지 않는다', () => {
    for (const k of Object.keys(FLOORS) as (keyof typeof FLOORS)[]) {
      for (let start = FLOORS[k]; start <= FLOORS[k] + 12; start += 1) {
        let prev = Number.POSITIVE_INFINITY;
        for (let loss = 0; loss <= 30; loss += 1) {
          const r: Resources = { ...START };
          r[k] = start;
          const d: Partial<Resources> = {};
          d[k] = -loss;
          const v = applyFloors(applyDeltaTo(r, d)).r[k];
          expect(v).toBeLessThanOrEqual(prev);
          expect(v).toBeGreaterThanOrEqual(FLOORS[k]);
          prev = v;
        }
      }
    }
  });

  it('빈 화물 포드는 회수할 포드로 치지 않는다 (게임·시뮬레이션 같은 규칙)', () => {
    expect(podItems({ pod_items: '[]' })).toEqual([]);
    expect(podItems({ pod_items: JSON.stringify(['photo']) })).toEqual(['photo']);
    expect(podItems({ pod_items: JSON.stringify(['photo']), pod_recovered: true })).toEqual([]);
    expect(podItems({ pod_items: '{oops' })).toEqual([]);
    expect(podItems({})).toEqual([]);
    const base: RunChoices = { crew: allRosters()[0], cargo: [], c3: 'boram', c4video: 'together', c4ark: 'supply', c5site: 'alpha', c5gust: 'pod', c6: [2, 0, 1, 3], c7: 'third', c7eva: true, c8method: 'expert', c8door: 'notNow', c8answer: 'morning' };
    const r = simulateRun(base);
    expect(r.cargoFinal).toEqual([]);
    // 빈 포드면 'third'는 근거리 얼음(물 확보)이다: 포드를 떨어뜨리지 않은 판과 물 확보량이 같다
    expect(r.resources.waterSecurity).toBe(simulateRun({ ...base, c5gust: 'divert' }).resources.waterSecurity);
  });

  it('X·? 글자는 한 유형으로 단정하지 않는다 (05 §62)', () => {
    const ax = (letter: string, closest: string | null): AxisResult => ({ letter, closest }) as unknown as AxisResult;
    const axes: Record<Axis, AxisResult> = { EI: ax('I', 'I'), SN: ax('X', 'N'), TF: ax('T', 'T'), JP: ax('J', 'J') };
    expect(typeCandidates(axes)).toEqual(['INTJ', 'ISTJ']);
    expect(typeCandidates({ ...axes, SN: ax('N', 'N') })).toEqual(['INTJ']);
    expect(typeCandidates({ ...axes, SN: ax('?', 'S'), JP: ax('?', null) })).toEqual(['ISTJ', 'ISTP', 'INTJ', 'INTP']);
  });

  it('분석을 끄면 기록과 기회 상태를 모두 비우고, 이후로는 기록하지 않는다', () => {
    const act = (id: string): ActInput => ({ opportunityId: id, dim: 'O', kind: 'fork', pole: 1, actKey: 'k', displayPosition: 0, optionSetId: 'x', label: 'a' });
    let s = createMeasurement(true);
    s = measureReducer(s, { type: 'open', id: 'C2-O02' });
    s = recordAct(s, act('C2-O02'));
    expect(s.events).toHaveLength(1);
    s = measureReducer(s, { type: 'setOptIn', value: false });
    expect(s.events).toHaveLength(0);
    expect(Object.values(s.opportunities).every((o) => o.status === 'unavailable' && !o.locked)).toBe(true);
    s = measureReducer(s, { type: 'open', id: 'C3-O02' });
    s = recordAct(s, act('C3-O02'));
    expect(s.events).toHaveLength(0);
  });

  it('저장 검증: 자원 키 누락·손상된 측정 기록·잘못된 화면 기억을 거부하고, 화면 기억은 그대로 돌려준다', () => {
    const m = { ...createMission('r', 7, { name: '테스트', look: 0, relation: 'friend' }), fsm: 'c1_explore' as const };
    const ms = createMeasurement(true);
    const st = memoryStorage();
    expect(saveGame(st, m, ms, { 'c3-diag-mode': 'plan' })).toBe(true);
    const ok = loadGame(st);
    expect(ok.ok && ok.bundle.ui).toEqual({ 'c3-diag-mode': 'plan' });
    const bundle = (over: object): unknown => ({ schemaVersion: 2, savedAt: 0, mission: m, measure: ms, ...over });
    const res: Record<string, unknown> = { ...m.resources };
    delete res.water;
    expect(validateBundle(bundle({ mission: { ...m, resources: res } }))).toBe('resources');
    expect(validateBundle(bundle({ mission: { ...m, legacyItemIds: undefined } }))).toBe('legacy');
    expect(validateBundle(bundle({ mission: { ...m, flags: { a: { b: 1 } } } }))).toBe('flags');
    expect(validateBundle(bundle({ measure: { ...ms, events: [{ opportunityId: 'C1-O01', dim: 'SN', kind: 'tab', pole: 2, weight: 1 }] } }))).toBe('measure-events');
    expect(validateBundle(bundle({ ui: { a: 3 } }))).toBe('ui');
    expect(validateBundle(bundle({}))).toBeNull();
    st.setItem(SAVE_KEY, JSON.stringify(bundle({ mission: { ...m, resources: res } })));
    expect(loadGame(st).ok).toBe(false);
  });
});
