import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mulberry32 } from '../src/shared/rng';
import { allRosters } from '../src/story/roster';
import {
  BASE_ITEMS, DILEMMAS, FLOORS, c6Allocations, canStow, cargoPool, dominates, simulateRun,
  type EndingId, type RunChoices, type RunResult,
} from '../src/story/economy';
import type { CandidateId } from '../src/shared/ids';

const root = fileURLToPath(new URL('..', import.meta.url));
const ENDINGS: EndingId[] = ['dawn', 'memory', 'together', 'rebuild'];
const ALLOC = c6Allocations();

function shuffle<T>(r: () => number, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = <T>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

function randomChoices(r: () => number, crew: CandidateId[]): RunChoices {
  const chosen: { id: string; kg: number }[] = [];
  for (const it of shuffle(r, cargoPool(crew))) {
    if (r() < 0.55 && canStow([...chosen.map((c) => c.kg), it.kg])) chosen.push(it);
  }
  return {
    crew,
    cargo: chosen.map((c) => c.id),
    c3: pick(r, ['boram', 'spare', 'recal'] as const),
    c4video: pick(r, ['together', 'archive', 'alone'] as const),
    c4ark: pick(r, ['supply', 'rendezvous', 'relay'] as const),
    c5site: pick(r, ['alpha', 'beta', 'gamma'] as const),
    c5gust: pick(r, ['pod', 'divert'] as const),
    c6: pick(r, ALLOC),
    c7: pick(r, ['ice', 'ilkkun', 'third'] as const),
    c7eva: r() < 0.5,
    c8method: pick(r, ['expert', 'consensus', 'roles'] as const),
    c8door: pick(r, ['accept', 'conditional', 'notNow'] as const),
    c8answer: pick(r, ['protect', 'remember', 'morning'] as const),
    lostC5: r() < 0.75 ? pick(r, crew) : undefined,
  };
}

const PER_CREW = 2000;
const runs: { ch: RunChoices; res: RunResult }[] = [];
const r = mulberry32(20261025);
for (const crew of allRosters()) for (let i = 0; i < PER_CREW; i += 1) {
  const ch = randomChoices(r, crew);
  runs.push({ ch, res: simulateRun(ch) });
}

function share(list: { res: RunResult }[]): Record<EndingId, number> {
  const out = { dawn: 0, memory: 0, together: 0, rebuild: 0 } as Record<EndingId, number>;
  list.forEach((x) => { out[x.res.ending] += 1; });
  ENDINGS.forEach((e) => { out[e] = list.length ? out[e] / list.length : 0; });
  return out;
}

describe('스토리 경제 시뮬레이션 (C2~C8 서사 수치, 15편성 × 2,000판 = 30,000판)', () => {
  const overall = share(runs);
  const conditional: string[] = [];
  const keys: (keyof RunChoices)[] = ['c3', 'c4video', 'c4ark', 'c5site', 'c5gust', 'c7', 'c8method', 'c8door', 'c8answer'];
  for (const k of keys) {
    const values = [...new Set(runs.map((x) => String(x.ch[k])))];
    for (const v of values) {
      const sub = runs.filter((x) => String(x.ch[k]) === v);
      const sh = share(sub);
      conditional.push(`| ${k}=${v} | ${sub.length} | ${ENDINGS.map((e) => `${(sh[e] * 100).toFixed(1)}%`).join(' | ')} |`);
    }
  }
  const mins = { oxygenReserve: 100, water: 100, food: 100, power: 100, trust: 100, archive: 100, seedVault: 100, waterSecurity: 100 } as Record<string, number>;
  const maxs = { ...mins };
  Object.keys(maxs).forEach((k) => { maxs[k] = 0; });
  const drops = runs.map((x) => x.res.reserveDrop).sort((p, q) => p - q);
  const qt = (p: number): number => drops[Math.min(drops.length - 1, Math.floor(p * drops.length))];
  let emergencyRuns = 0;
  for (const x of runs) {
    for (const k of Object.keys(mins)) {
      const v = (x.res.resources as unknown as Record<string, number>)[k];
      mins[k] = Math.min(mins[k], v);
      maxs[k] = Math.max(maxs[k], v);
    }
    if (x.res.emergencies.length) emergencyRuns += 1;
  }
  const crewTable = allRosters().map((crew) => {
    const sub = runs.filter((x) => x.ch.crew.join() === crew.join());
    const sh = share(sub);
    return `| ${crew.join('+')} | ${ENDINGS.map((e) => `${(sh[e] * 100).toFixed(1)}%`).join(' | ')} |`;
  });
  mkdirSync(join(root, 'docs', 'simulation'), { recursive: true });
  writeFileSync(join(root, 'docs', 'simulation', 'story-economy.md'), [
    '# 스토리 경제 시뮬레이션 결과',
    '',
    `무작위 선택 30,000판 (15편성 × ${PER_CREW}판, 시드 20261025). 성격 점수와 무관한 서사 수치만 다룬다.`,
    '',
    '## 엔딩 분포 (전체)',
    '| 새벽의 정비사들 | 기억을 심는 사람들 | 서로의 공기 | 천천히, 살아남기 |',
    '|---|---|---|---|',
    `| ${ENDINGS.map((e) => `${(overall[e] * 100).toFixed(1)}%`).join(' | ')} |`,
    '',
    '## 선택지별 엔딩 분포 (한 선택이 엔딩을 독점하지 않는지)',
    '| 선택 | 판 수 | dawn | memory | together | rebuild |',
    '|---|---|---|---|---|---|',
    ...conditional,
    '',
    '## 편성별 엔딩 분포',
    '| 편성 | dawn | memory | together | rebuild |',
    '|---|---|---|---|---|',
    ...crewTable,
    '',
    '## 자원 최소·최대 (바닥값 회복 후)',
    ...Object.keys(mins).map((k) => `- ${k}: ${mins[k].toFixed(1)} ~ ${maxs[k].toFixed(1)}`),
    `- 비상 회복(바닥값) 이벤트가 한 번이라도 일어난 판: ${((emergencyRuns / runs.length) * 100).toFixed(1)}%`,
    `- 예비 자원 손실 합(엔딩 D 판정값) 분위수: p50 ${qt(0.5).toFixed(1)}, p75 ${qt(0.75).toFixed(1)}, p80 ${qt(0.8).toFixed(1)}, p90 ${qt(0.9).toFixed(1)}, 최대 ${drops[drops.length - 1].toFixed(1)}`,
  ].join('\n'));

  it('모든 자원이 0~100 안에 있고, 산소·물·식량·전력은 바닥값 아래로 끝나지 않는다', () => {
    for (const x of runs) {
      for (const v of Object.values(x.res.resources)) expect(v).toBeGreaterThanOrEqual(0);
      for (const [k, v] of Object.entries(x.res.resources)) if (k !== 'fuelMargin') expect(v).toBeLessThanOrEqual(100);
      for (const [k, f] of Object.entries(FLOORS)) expect((x.res.resources as unknown as Record<string, number>)[k]).toBeGreaterThanOrEqual(f);
    }
  });

  it('4가지 엔딩이 모두 나오고, 어느 엔딩도 50%를 넘거나 8% 미만이 아니다', () => {
    ENDINGS.forEach((e) => {
      expect(overall[e]).toBeGreaterThanOrEqual(0.08);
      expect(overall[e]).toBeLessThanOrEqual(0.5);
    });
  });

  it('15개 편성 모두에서 4가지 엔딩에 도달할 수 있다 (누가 없어도 막히지 않음)', () => {
    for (const crew of allRosters()) {
      const sh = share(runs.filter((x) => x.ch.crew.join() === crew.join()));
      ENDINGS.forEach((e) => expect(sh[e]).toBeGreaterThan(0));
    }
  });

  it('어떤 단일 선택도 엔딩을 80% 이상 결정하지 않는다', () => {
    for (const k of ['c3', 'c4video', 'c4ark', 'c5site', 'c5gust', 'c7', 'c8method', 'c8door', 'c8answer'] as (keyof RunChoices)[]) {
      for (const v of new Set(runs.map((x) => String(x.ch[k])))) {
        const sh = share(runs.filter((x) => String(x.ch[k]) === v));
        ENDINGS.forEach((e) => expect(sh[e]).toBeLessThan(0.8));
      }
    }
  });

  it('저울마다 지배 전략이 없다 (모든 선택지가 무언가를 치른다)', () => {
    for (const [, opts] of Object.entries(DILEMMAS)) {
      for (const a of opts) {
        expect(a.costs.length).toBeGreaterThan(0);
        for (const b of opts) if (a !== b) expect(dominates(a, b)).toBe(false);
      }
    }
  });

  it('짐: 물품 하나씩은 모두 실을 수 있고, 12kg를 채워도 균형이 안 맞는 조합이 존재함을 확인(퍼즐 요소)', () => {
    BASE_ITEMS.forEach((it) => expect(canStow([it.kg])).toBe(true));
    expect(canStow([4, 4, 4])).toBe(false);
    expect(canStow([4, 4, 2, 2])).toBe(true);
  });

  it('C8의 마지막 대답은 엔딩 종류를 바꾸지 않는다 (연출만 변경)', () => {
    for (const x of runs.slice(0, 3000)) {
      const endings = (['protect', 'remember', 'morning'] as const).map((a) => simulateRun({ ...x.ch, c8answer: a }).ending);
      expect(new Set(endings).size).toBe(1);
    }
  });

  it('경계 경로(빈 짐 · 약속 물건만 · 금방 다 투하되는 짐 · 꽉 찬 짐)에서도 자원 범위와 빈 포드 규칙이 지켜진다', () => {
    // 무작위 생성기로는 빈 짐 판이 30,000판 중 몇 판밖에 안 나와서(빈 포드 버그가 숨어 있던 곳) 경계를 따로 훑는다
    let n = 0;
    for (const crew of allRosters()) {
      const legacy = cargoPool(crew).filter((p) => p.owner).map((p) => p.id);
      const sets: string[][] = [[], legacy, ['photo', 'music'], ['parts', 'filter', 'music', 'photo']];
      for (const cargo of sets) for (const c3 of ['boram', 'spare', 'recal'] as const) for (const c5gust of ['pod', 'divert'] as const) for (const c7 of ['ice', 'ilkkun', 'third'] as const) {
        const ch: RunChoices = { crew, cargo, c3, c4video: 'archive', c4ark: 'supply', c5site: 'alpha', c5gust, c6: [3, 1, 1, 1], c7, c7eva: true, c8method: 'roles', c8door: 'accept', c8answer: 'morning' };
        const res = simulateRun(ch);
        n += 1;
        for (const [k, v] of Object.entries(res.resources)) { expect(v).toBeGreaterThanOrEqual(0); if (k !== 'fuelMargin') expect(v).toBeLessThanOrEqual(100); }
        for (const [k, f] of Object.entries(FLOORS)) expect((res.resources as unknown as Record<string, number>)[k]).toBeGreaterThanOrEqual(f);
        if (c5gust === 'pod' && c7 === 'third') {
          const afterC3 = simulateRun({ ...ch, c5gust: 'divert', c7: 'ice' }).cargoFinal;
          if (afterC3.length === 0) expect(res.resources.waterSecurity).toBe(simulateRun({ ...ch, c5gust: 'divert' }).resources.waterSecurity);
          else expect([...res.cargoFinal].sort()).toEqual([...afterC3].sort());
        }
      }
    }
    expect(n).toBe(15 * 4 * 3 * 2 * 3);
  });

  it('같은 선택이면 같은 결과 (결정성)', () => {
    const x = runs[123];
    expect(JSON.stringify(simulateRun(x.ch))).toBe(JSON.stringify(x.res));
  });
});
