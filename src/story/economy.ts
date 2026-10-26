import type { CandidateId } from '../shared/ids';
import { INITIAL_RESOURCES, type Resources } from '../core/state';
import { cargoPool, defaultJettison, itemsOf, jettisonOk, spareValvePlan, type AffKey } from './cargo';
import { applyDeltaTo, applyFloors, c6Context, cargoAff, E, endingOf, type Effect } from './effects';

export { BASE_ITEMS, cargoPool, canStow } from './cargo';
export type { Aff, AffKey, CargoItem } from './cargo';

/**
 * C2~C8 서사 경제 모델. C2·C3의 짐·예비 밸브 규칙은 게임 화면과 같은 함수(story/cargo.ts)를 쓴다.
 * 성격 점수와는 완전히 무관하다.
 */
export type EndingId = 'dawn' | 'memory' | 'together' | 'rebuild';

/** 저울 선택지의 가치 통화(지배 전략 검사용) */
export type Currency =
  | 'power' | 'oxygen' | 'water' | 'food' | 'habitat' | 'trust' | 'archive' | 'seeds' | 'cargo' | 'fuel'
  | 'time' | 'safety' | 'othersRisk' | 'othersHope' | 'relation' | 'futureWater' | 'systemTrust';

export interface DilemmaOption { id: string; label: string; costs: Currency[]; gains: Currency[] }

export const DILEMMAS: Record<string, DilemmaOption[]> = {
  C3: [
    { id: 'boram', label: '보람의 수동 리셋', costs: ['othersRisk'], gains: ['time', 'cargo'] },
    { id: 'spare', label: '예비 밸브 전환', costs: ['cargo', 'water'], gains: ['time', 'safety'] },
    { id: 'recal', label: '자체 재보정 후 대기', costs: ['habitat', 'time'], gains: ['cargo', 'safety'] },
  ],
  C4: [
    { id: 'supply', label: '보급 캡슐 사출', costs: ['water', 'oxygen'], gains: ['othersHope'] },
    { id: 'rendezvous', label: '궤도 수정 랑데부', costs: ['fuel', 'food'], gains: ['othersHope', 'relation'] },
    { id: 'relay', label: '신호 중계', costs: ['othersRisk'], gains: ['archive'] },
  ],
  C5: [
    { id: 'alpha', label: 'MIRROR 지정 착륙장', costs: ['power'], gains: ['time', 'systemTrust'] },
    { id: 'beta', label: '평원', costs: ['oxygen'], gains: ['safety'] },
    { id: 'gamma', label: '협곡 가장자리', costs: ['habitat', 'fuel'], gains: ['futureWater'] },
  ],
  C5gust: [
    { id: 'pod', label: '화물 포드 분리', costs: ['cargo'], gains: ['oxygen'] },
    { id: 'divert', label: '대체 지점으로 선회', costs: ['oxygen'], gains: ['cargo'] },
  ],
  C7: [
    { id: 'ice', label: '고신호 얼음 지대', costs: ['relation', 'time'], gains: ['water'] },
    { id: 'ilkkun', label: '일꾼-3 회수', costs: ['water'], gains: ['archive', 'relation'] },
    { id: 'third', label: '화물 포드 회수 / 근거리 얼음', costs: ['water', 'relation'], gains: ['cargo', 'safety'] },
  ],
  C8: [
    { id: 'accept', label: '받아들인다', costs: ['food', 'water'], gains: ['othersHope', 'relation'] },
    { id: 'conditional', label: '조건부', costs: ['time'], gains: ['safety', 'othersHope'] },
    { id: 'notNow', label: '지금은 받지 않는다', costs: ['othersRisk'], gains: ['safety', 'food'] },
  ],
};

/** a가 b를 지배하는가: 비용이 b의 부분집합이고 이득이 b의 상위집합이며 둘이 같지 않음 */
export function dominates(a: DilemmaOption, b: DilemmaOption): boolean {
  const sub = a.costs.every((c) => b.costs.includes(c));
  const sup = b.gains.every((g) => a.gains.includes(g));
  const same = a.costs.length === b.costs.length && a.gains.length === b.gains.length;
  return sub && sup && !same;
}

export interface RunChoices {
  crew: CandidateId[];
  cargo: string[];
  c3: 'boram' | 'spare' | 'recal';
  c4video: 'together' | 'archive' | 'alone';
  c4ark: 'supply' | 'rendezvous' | 'relay';
  c5site: 'alpha' | 'beta' | 'gamma';
  c5gust: 'pod' | 'divert';
  /** 72시간 전력 토큰 [산소 재시동, 종자 냉각, 기록 서버, 거주 난방], 각 0~3, 합 6 */
  c6: [number, number, number, number];
  c7: 'ice' | 'ilkkun' | 'third';
  c7eva: boolean;
  c8method: 'expert' | 'consensus' | 'roles';
  c8door: 'accept' | 'conditional' | 'notNow';
  c8answer: 'protect' | 'remember' | 'morning';
  /** C3 예비 밸브 전환 때 플레이어가 실제로 고른 투하 목록(없거나 규칙에 안 맞으면 기본 순서) */
  jettison?: string[];
  /** C5에서 떠난 동료(C6 보존 도움 조건에서 뺀다. 희생은 그 밖의 수치에 영향이 없다) */
  lostC5?: CandidateId;
}

export interface RunResult {
  resources: Resources;
  aff: Record<AffKey, number>;
  scores: Record<AffKey, number>;
  reserveDrop: number;
  ending: EndingId;
  emergencies: string[];
  cargoFinal: string[];
  gammaAllowed: boolean;
}

export { FLOORS, REBUILD_DROP } from './effects';

export function c6Allocations(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let o = 0; o <= 3; o += 1) for (let s = 0; s <= 3; s += 1) for (let a = 0; a <= 3; a += 1) {
    const h = 6 - o - s - a;
    if (h >= 0 && h <= 3) out.push([o, s, a, h]);
  }
  return out;
}

export function simulateRun(ch: RunChoices): RunResult {
  let r: Resources = { ...INITIAL_RESOURCES };
  const aff: Record<AffKey, number> = { dawn: 0, memory: 0, together: 0 };
  const emergencies: string[] = [];
  let cargo = ch.cargo.filter((id) => cargoPool(ch.crew).some((p) => p.id === id));
  let pod: string[] = [];
  let gamma = false;
  const apply = (step: string, eff: Effect): void => {
    r = applyDeltaTo(r, eff.delta);
    for (const [k, v] of Object.entries(eff.aff ?? {}) as [AffKey, number][]) aff[k] += v;
    const f = applyFloors(r);
    r = f.r;
    f.hit.forEach((h) => emergencies.push(`${step}:${h}`));
    if (eff.flags?.c5_site === 'gamma') gamma = true;
  };

  // C3 점화 (게임과 같은 규칙: story/cargo.ts spareValvePlan)
  let backupUsed = false;
  if (ch.c3 === 'spare') {
    const plan = spareValvePlan(cargo, ch.crew);
    if (plan.consume) cargo = cargo.filter((c) => c !== plan.consume);
    else {
      const drop = ch.jettison && jettisonOk(cargo, ch.jettison, ch.crew) ? ch.jettison : defaultJettison(cargo, ch.crew);
      cargo = cargo.filter((c) => !drop.includes(c));
      backupUsed = true;
    }
  } else if (ch.c3 === 'recal') apply('C3', { delta: { habitatIntegrity: -10 } });

  // C4
  apply('C4', E.c4Repair(backupUsed));
  apply('C4', E.c4Video(ch.c4video));
  apply('C4', E.c4Ark(ch.c4ark));
  // C5
  const gammaAllowed = r.fuelMargin >= 2;
  apply('C5', E.c5Site(ch.c5site, r.fuelMargin));
  apply('C5', E.c5Gust(ch.c5gust));
  if (ch.c5gust === 'pod') { pod = cargo; cargo = []; }
  // C6
  apply('C6-crisis', E.c6Crisis());
  apply('C6', E.c6Power(ch.c6, c6Context(cargo, ch.crew.filter((c) => c !== ch.lostC5))));
  // C7
  apply('C7', E.c7Target(ch.c7, { gamma, pod: pod.length > 0 }));
  if (ch.c7 === 'third' && pod.length > 0) cargo = [...cargo, ...pod];
  apply('C7', E.c7Eva(ch.c7eva));
  // C8 (마지막 대답은 엔딩 종류를 바꾸지 않는다)
  apply('C8', E.c8Method(ch.c8method));
  apply('C8', E.c8Door(ch.c8door));
  const ca = cargoAff(itemsOf(ch.crew, cargo));
  (Object.keys(aff) as AffKey[]).forEach((k) => { aff[k] += ca[k] ?? 0; });
  const res = endingOf(r, aff);
  return { resources: r, aff, scores: res.scores, reserveDrop: res.drop, ending: res.ending, emergencies, cargoFinal: cargo, gammaAllowed };
}
