import type { FlagValue, Resources } from '../core/state';
import type { CandidateId } from '../shared/ids';
import type { Aff, AffKey, CargoItem } from './cargo';

/**
 * C4~C8 서사 효과의 단일 정의. 게임 리듀서(applyEffect)와 경제 시뮬레이션이 같은 함수를 쓴다.
 * 성격 점수와는 완전히 무관하다.
 */
export interface Effect {
  delta?: Partial<Resources>;
  aff?: Aff;
  flags?: Record<string, FlagValue>;
}

export const START: Resources = {
  power: 65, oxygenReserve: 70, water: 60, food: 60, trust: 50, archive: 50,
  habitatIntegrity: 70, seedVault: 100, waterSecurity: 30, fuelMargin: 2,
};
export const FLOORS = { oxygenReserve: 20, water: 15, food: 15, power: 15 } as const;
export const REBUILD_DROP = 38;

export function applyDeltaTo(r: Resources, delta: Partial<Resources> = {}): Resources {
  const out = { ...r };
  for (const [k, v] of Object.entries(delta) as [keyof Resources, number][]) {
    out[k] = k === 'fuelMargin' ? Math.max(0, out[k] + v) : Math.max(0, Math.min(100, out[k] + v));
  }
  return out;
}

/**
 * 바닥값 아래로 내려가면 비상 탱크·비상팩·예비 전지가 개입해 바닥값에서 멈춘다(게임오버 없음).
 * 예전에는 바닥값+5로 올려 '더 크게 잃을수록 더 많이 남는' 역전이 있었다(산소 22에서 -2는 20, -3은 25).
 */
export function applyFloors(r: Resources): { r: Resources; hit: string[] } {
  const out = { ...r };
  const hit: string[] = [];
  for (const [k, f] of Object.entries(FLOORS) as [keyof typeof FLOORS, number][]) {
    if (out[k] < f) { out[k] = f; hit.push(k); }
  }
  return { r: out, hit };
}

export const C4_VIDEO = ['together', 'archive', 'alone'] as const;
export const C4_ARK = ['supply', 'rendezvous', 'relay'] as const;
export const C5_SITE = ['alpha', 'beta', 'gamma'] as const;
export const C5_GUST = ['pod', 'divert'] as const;
export const C7_TARGET = ['ice', 'ilkkun', 'third'] as const;
export const C8_METHOD = ['expert', 'consensus', 'roles'] as const;
export const C8_DOOR = ['accept', 'conditional', 'notNow'] as const;
export const C8_ANSWER = ['protect', 'remember', 'morning'] as const;

export const E = {
  c4Repair: (backupUsed: boolean): Effect => ({ delta: { water: backupUsed ? 5 : 10 } }),
  c4Video: (c: (typeof C4_VIDEO)[number]): Effect =>
    c === 'together' ? { delta: { trust: 5 }, aff: { together: 0.5 } } : c === 'archive' ? { delta: { archive: 3 }, aff: { memory: 0.5 } } : {},
  c4Ark: (c: (typeof C4_ARK)[number]): Effect =>
    c === 'supply' ? { delta: { water: -20, oxygenReserve: -15 }, aff: { together: 1 } }
      : c === 'rendezvous' ? { delta: { fuelMargin: -1, food: -10, trust: 5 }, aff: { together: 0.5 }, flags: { dam_call: true } }
        : { delta: { archive: 5 }, aff: { memory: 0.5 } },
  /** 협곡(γ)은 연료 여유 2 이상일 때만 가능. 불가능하면 평원으로 처리 */
  c5Site: (c: (typeof C5_SITE)[number], fuel: number): Effect => {
    const site = c === 'gamma' && fuel < 2 ? 'beta' : c;
    if (site === 'alpha') return { delta: { power: -10 }, aff: { dawn: 0.5 }, flags: { c5_site: 'alpha' } };
    if (site === 'beta') return { delta: { oxygenReserve: -8 }, flags: { c5_site: 'beta' } };
    return { delta: { habitatIntegrity: -5 }, flags: { c5_site: 'gamma' } };
  },
  c5Gust: (c: (typeof C5_GUST)[number]): Effect => (c === 'pod' ? { flags: { pod_released: true } } : { delta: { oxygenReserve: -8 } }),
  c6Crisis: (): Effect => ({ delta: { oxygenReserve: -20 } }),
  /** 72시간 전력 토큰 [산소, 종자, 기록, 난방], 각 0~3, 합 6 */
  c6Power: (t: [number, number, number, number], ctx: { seedHelp: boolean; archiveHelp: boolean; parts: boolean }): Effect => {
    const [o, s, a, h] = t;
    const seedBase = ctx.seedHelp ? 25 : 40;
    const archiveBase = ctx.archiveHelp ? 15 : 30;
    return {
      delta: {
        oxygenReserve: 5 + (20 * o) / 3,
        seedVault: -(seedBase * (3 - s)) / 3,
        archive: -(archiveBase * (3 - a)) / 3,
        trust: -(10 * (3 - h)) / 3,
        power: ctx.parts ? 5 : 0,
      },
      aff: { dawn: o / 3, memory: (s + a) / 4, together: h / 3 },
    };
  },
  c7Target: (c: (typeof C7_TARGET)[number], ctx: { gamma: boolean; pod: boolean }): Effect => {
    if (c === 'ice') return { delta: { waterSecurity: ctx.gamma ? 50 : 40 }, aff: { dawn: 1 } };
    if (c === 'ilkkun') return { delta: { waterSecurity: 15, archive: 10 }, aff: { memory: 1, together: 0.5 }, flags: { ilkkun: true } };
    if (ctx.pod) return { delta: { trust: 5 }, aff: { together: 1 }, flags: { pod_recovered: true } };
    return { delta: { waterSecurity: 20 }, aff: { dawn: 0.5 } };
  },
  c7Eva: (yes: boolean): Effect => (yes ? { delta: { food: -8, waterSecurity: 10 }, aff: { together: 0.5 } } : {}),
  c8Method: (c: (typeof C8_METHOD)[number]): Effect =>
    c === 'expert' ? { aff: { dawn: 1 } } : c === 'consensus' ? { aff: { together: 1 } } : { aff: { dawn: 0.5, together: 0.5 } },
  c8Door: (c: (typeof C8_DOOR)[number]): Effect =>
    c === 'accept' ? { aff: { together: 0.5 }, delta: { food: -5 } } : c === 'conditional' ? { aff: { dawn: 0.25, together: 0.25 } } : { aff: { dawn: 0.5 } },
};

/** C6 종자·기록 보존 도움 조건 (짐·승선자에서 파생) */
export function c6Context(inventory: readonly string[], crew: readonly CandidateId[]): { seedHelp: boolean; archiveHelp: boolean; parts: boolean } {
  return {
    seedHelp: inventory.includes('seeds') || inventory.includes('legacy_seeds') || crew.includes('woojoo'),
    archiveHelp: inventory.includes('music') || inventory.includes('legacy_voices'),
    parts: inventory.includes('parts'),
  };
}

export function cargoAff(items: readonly CargoItem[]): Aff {
  const out: Record<AffKey, number> = { dawn: 0, memory: 0, together: 0 };
  for (const it of items) for (const [k, v] of Object.entries(it.aff) as [AffKey, number][]) out[k] += v * 0.5;
  return out;
}

export type EndingId = 'dawn' | 'memory' | 'together' | 'rebuild';

export function reserveDrop(r: Resources): number {
  return (START.oxygenReserve - r.oxygenReserve) + (START.water - r.water) + (START.food - r.food) + (START.power - r.power);
}

/** 엔딩 판정(서사 상태만 사용). 동률이면 together → memory → dawn */
export function endingOf(r: Resources, aff: Record<AffKey, number>): { ending: EndingId; scores: Record<AffKey, number>; drop: number } {
  const drop = reserveDrop(r);
  const scores: Record<AffKey, number> = {
    dawn: aff.dawn + ((r.power + r.habitatIntegrity + r.waterSecurity) / 3 - 55) / 15,
    memory: aff.memory + ((r.archive + r.seedVault) / 2 - 60) / 15,
    together: aff.together + (r.trust - 50) / 7.5,
  };
  if (drop >= REBUILD_DROP) return { ending: 'rebuild', scores, drop };
  const order: AffKey[] = ['together', 'memory', 'dawn'];
  const ending = order.reduce((best, k) => (scores[k] > scores[best] + 1e-9 ? k : best), order[0]);
  return { ending, scores, drop };
}

export function affFromFlags(flags: Record<string, FlagValue>): Record<AffKey, number> {
  const n = (k: string): number => (typeof flags[k] === 'number' ? (flags[k] as number) : 0);
  return { dawn: n('aff_dawn'), memory: n('aff_memory'), together: n('aff_together') };
}

/**
 * C5에서 분리했지만 아직 회수하지 않은 화물 포드 속 짐.
 * 비어 있으면 '회수할 포드가 없다'로 본다. 시뮬레이션(economy.ts)의 pod.length > 0과 같은 규칙이다.
 */
export function podItems(flags: Record<string, FlagValue>): string[] {
  if (flags.pod_recovered === true || typeof flags.pod_items !== 'string') return [];
  try {
    const v: unknown = JSON.parse(flags.pod_items);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
