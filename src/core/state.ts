import { CANDIDATE_IDS, isCandidateId, type CandidateId, type ChapterId } from '../shared/ids';
import { assignSeat, canLock, emptySeats, seatedIds, unassignSeat, unselectedOf, type Seats } from '../story/roster';
import { CANDIDATES } from '../story/candidates';
import { canStow, cargoPool, itemsOf } from '../story/cargo';
import { applyDeltaTo, applyFloors, type Effect } from '../story/effects';

/** 명시적 챕터 FSM: 타이틀 → 동의 → 설정 → 프롤로그 → C1~C8 → 결과지 */
export const FSM_STATES = [
  'title', 'consent', 'setup', 'prologue',
  'c1_tutorial', 'c1_explore', 'c1_farewell', 'c1_seating', 'c1_depart',
  'c2_cargo', 'c2_sealed',
  'c3_preflight', 'c3_diagnose', 'c3_scale', 'c3_ignition', 'c3_ascent',
  'c4_play', 'c5_play', 'c6_play', 'c7_play', 'c8_play', 'results',
] as const;
export type FsmState = (typeof FSM_STATES)[number];

export interface Resources {
  power: number;
  oxygenReserve: number;
  water: number;
  food: number;
  trust: number;
  archive: number;
  habitatIntegrity: number;
  seedVault: number;
  waterSecurity: number;
  fuelMargin: number;
}

export const INITIAL_RESOURCES: Resources = {
  power: 65, oxygenReserve: 70, water: 60, food: 60, trust: 50, archive: 50,
  habitatIntegrity: 70, seedVault: 100, waterSecurity: 30, fuelMargin: 2,
};

export interface PlayerProfile {
  name: string;
  look: number;
  relation: 'sibling' | 'friend';
}

export type FlagValue = string | number | boolean;

export interface MissionState {
  schemaVersion: 2;
  runId: string;
  runSeed: number;
  fsm: FsmState;
  chapter: ChapterId;
  player: PlayerProfile;
  seats: Seats;
  /** 확정 전에는 seats와 같은 구성(0..4명), 확정 후 정확히 4명 */
  crewIds: CandidateId[];
  crewLocked: boolean;
  savedRosters: (CandidateId[] | null)[];
  legacyItemIds: string[];
  inventoryIds: string[];
  resources: Resources;
  /** 서사 시계(분). 실시간으로 줄지 않고 의미 있는 행동마다만 줄며, 바닥값에서 멈춘다. */
  narrativeClock: number;
  flags: Record<string, FlagValue>;
  met: CandidateId[];
  completed: boolean;
}

export type MissionAction =
  | { type: 'newRun'; runId: string; runSeed: number; player: PlayerProfile }
  | { type: 'goto'; fsm: FsmState }
  | { type: 'meet'; id: CandidateId }
  | { type: 'assign'; id: CandidateId; slot?: number }
  | { type: 'unassign'; id: CandidateId }
  | { type: 'saveRoster'; slot: number }
  | { type: 'loadRoster'; slot: number }
  | { type: 'lockCrew' }
  | { type: 'tick'; minutes: number }
  | { type: 'flag'; key: string; value: FlagValue }
  | { type: 'sealCargo'; items: string[] }
  | { type: 'removeItems'; items: string[] }
  | { type: 'applyDelta'; delta: Partial<Resources> }
  | { type: 'setClock'; minutes: number; floor: number }
  | { type: 'applyEffect'; effect: Effect }
  | { type: 'setInventory'; items: string[] };

export const CLOCK_START = 240;
export const CLOCK_FLOOR = 10;

export function createMission(runId: string, runSeed: number, player: PlayerProfile): MissionState {
  return {
    schemaVersion: 2,
    runId,
    runSeed,
    fsm: 'title',
    chapter: 'C1',
    player,
    seats: emptySeats(),
    crewIds: [],
    crewLocked: false,
    savedRosters: [null, null, null],
    legacyItemIds: [],
    inventoryIds: [],
    resources: { ...INITIAL_RESOURCES },
    narrativeClock: CLOCK_START,
    flags: {},
    met: [],
    completed: false,
  };
}

/** 명시적 전이표: 정해진 다음 상태로만 갈 수 있다(건너뛰기·되돌아가기 금지). */
export const FSM_NEXT: Record<FsmState, FsmState[]> = {
  title: ['consent'],
  consent: ['setup'],
  setup: ['prologue'],
  prologue: ['c1_tutorial'],
  c1_tutorial: ['c1_explore'],
  c1_explore: ['c1_farewell'],
  c1_farewell: ['c1_seating'],
  c1_seating: ['c1_depart'],
  c1_depart: ['c2_cargo'],
  c2_cargo: ['c2_sealed'],
  c2_sealed: ['c3_preflight'],
  c3_preflight: ['c3_diagnose'],
  c3_diagnose: ['c3_scale'],
  c3_scale: ['c3_ignition'],
  c3_ignition: ['c3_ascent'],
  c3_ascent: ['c4_play'],
  c4_play: ['c5_play'],
  c5_play: ['c6_play'],
  c6_play: ['c7_play'],
  c7_play: ['c8_play'],
  c8_play: ['results'],
  results: [],
};

export function canEnter(s: MissionState, fsm: FsmState): boolean {
  if (!FSM_NEXT[s.fsm].includes(fsm)) return false;
  switch (fsm) {
    case 'c1_farewell':
    case 'c1_seating':
    case 'c1_depart':
      return s.crewLocked;
    case 'c2_cargo':
      return s.crewLocked && s.flags.c1_seated === true;
    case 'c2_sealed':
      return s.flags.c2_sealed === true && s.flags.c2_after_done === true;
    case 'c3_scale':
      return s.flags.c3_diagnosed === true;
    case 'c3_ignition':
      return typeof s.flags.c3_fix === 'string';
    case 'c3_ascent':
      return s.flags.c3_ignited === true;
    case 'c4_play':
      return s.flags.c3_launched === true;
    case 'c5_play':
      return s.flags.c4_done === true;
    case 'c6_play':
      return s.flags.c5_done === true;
    case 'c7_play':
      return s.flags.c6_done === true;
    case 'c8_play':
      return s.flags.c7_done === true;
    case 'results':
      return s.flags.c8_done === true;
    default:
      return true;
  }
}

function withSeats(s: MissionState, seats: Seats): MissionState {
  if (seats === s.seats) return s;
  return { ...s, seats, crewIds: seatedIds(seats) };
}

export function missionReducer(s: MissionState, a: MissionAction): MissionState {
  switch (a.type) {
    case 'newRun':
      return { ...createMission(a.runId, a.runSeed, a.player), fsm: 'prologue' };
    case 'goto':
      if (s.fsm === a.fsm || !canEnter(s, a.fsm)) return s;
      return { ...s, fsm: a.fsm, chapter: chapterOf(a.fsm) };
    case 'meet':
      if (!isCandidateId(a.id) || s.met.includes(a.id)) return s;
      return { ...s, met: [...s.met, a.id] };
    case 'assign':
      if (s.crewLocked || !isCandidateId(a.id)) return s;
      return withSeats(s, assignSeat(s.seats, a.id, a.slot));
    case 'unassign':
      if (s.crewLocked) return s;
      return withSeats(s, unassignSeat(s.seats, a.id));
    case 'saveRoster': {
      if (a.slot < 0 || a.slot > 2 || s.crewLocked) return s;
      const saved = s.savedRosters.slice();
      saved[a.slot] = seatedIds(s.seats);
      return { ...s, savedRosters: saved };
    }
    case 'loadRoster': {
      const saved = s.savedRosters[a.slot];
      if (s.crewLocked || !saved) return s;
      const seats = emptySeats();
      saved.forEach((id, i) => { seats[i] = id; });
      return withSeats(s, seats);
    }
    case 'lockCrew': {
      if (s.crewLocked || !canLock(s.seats)) return s;
      const crewIds = seatedIds(s.seats);
      const legacyItemIds = unselectedOf(crewIds).map((c) => CANDIDATES[c].legacy.id);
      return { ...s, crewIds, crewLocked: true, legacyItemIds };
    }
    case 'tick': {
      const floor = typeof s.flags.clock_floor === 'number' ? s.flags.clock_floor : CLOCK_FLOOR;
      const next = Math.max(floor, s.narrativeClock - Math.max(0, a.minutes));
      return next === s.narrativeClock ? s : { ...s, narrativeClock: next };
    }
    case 'setClock':
      return { ...s, narrativeClock: Math.max(a.floor, a.minutes), flags: { ...s.flags, clock_floor: a.floor } };
    case 'sealCargo': {
      if (!s.crewLocked || s.fsm !== 'c2_cargo' || s.flags.c2_sealed === true) return s;
      const pool = cargoPool(s.crewIds).map((p) => p.id);
      if (new Set(a.items).size !== a.items.length || !a.items.every((id) => pool.includes(id))) return s;
      if (!canStow(itemsOf(s.crewIds, a.items).map((i) => i.kg))) return s;
      return { ...s, inventoryIds: [...a.items], flags: { ...s.flags, c2_sealed: true, c2_cargo: JSON.stringify(a.items) } };
    }
    case 'removeItems': {
      if (!a.items.length || !a.items.every((id) => s.inventoryIds.includes(id))) return s;
      return { ...s, inventoryIds: s.inventoryIds.filter((id) => !a.items.includes(id)) };
    }
    case 'applyEffect': {
      const f = applyFloors(applyDeltaTo(s.resources, a.effect.delta));
      const flags = { ...s.flags, ...(a.effect.flags ?? {}) };
      for (const [k, v] of Object.entries(a.effect.aff ?? {})) {
        const key = `aff_${k}`;
        flags[key] = (typeof flags[key] === 'number' ? (flags[key] as number) : 0) + (v ?? 0);
      }
      if (f.hit.length) flags.emergency_count = (typeof flags.emergency_count === 'number' ? flags.emergency_count : 0) + f.hit.length;
      return { ...s, resources: f.r, flags };
    }
    case 'setInventory': {
      const pool = cargoPool(s.crewIds).map((p) => p.id);
      if (!a.items.every((id) => pool.includes(id)) || new Set(a.items).size !== a.items.length) return s;
      return { ...s, inventoryIds: [...a.items] };
    }
    case 'applyDelta': {
      const r = { ...s.resources };
      for (const [k, v] of Object.entries(a.delta) as [keyof Resources, number][]) {
        r[k] = k === 'fuelMargin' ? Math.max(0, r[k] + v) : Math.max(0, Math.min(100, r[k] + v));
      }
      return { ...s, resources: r };
    }
    case 'flag':
      if (s.flags[a.key] === a.value) return s;
      return { ...s, flags: { ...s.flags, [a.key]: a.value } };
    default:
      return s;
  }
}

export function chapterOf(fsm: FsmState): ChapterId {
  if (fsm.startsWith('c2')) return 'C2';
  if (fsm.startsWith('c3')) return 'C3';
  if (fsm.startsWith('c4')) return 'C4';
  if (fsm.startsWith('c5')) return 'C5';
  if (fsm.startsWith('c6')) return 'C6';
  if (fsm.startsWith('c7')) return 'C7';
  if (fsm.startsWith('c8') || fsm === 'results') return 'C8';
  return 'C1';
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `T-${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

export const ALL_CANDIDATES = CANDIDATE_IDS;
