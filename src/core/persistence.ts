import { isCandidateId } from '../shared/ids';
import type { MeasurementState } from '../analytics/measurement';
import { FSM_STATES, INITIAL_RESOURCES, type MissionState } from './state';

export const SAVE_KEY = 'mirror:last-earth:save:v2';
export const SETTINGS_KEY = 'mirror:last-earth:settings:v2';
/** 엔딩 갤러리: 여러 판에 걸쳐 본 엔딩 목록. '기록 삭제' 때 함께 지운다. */
export const GALLERY_KEY = 'mirror:last-earth:gallery:v1';
const ENDINGS = ['dawn', 'memory', 'together', 'rebuild'];

export function loadGallery(storage: StorageLike): string[] {
  try {
    const raw = storage.getItem(GALLERY_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && ENDINGS.includes(x)) : [];
  } catch {
    return [];
  }
}

export function addToGallery(storage: StorageLike, ending: string): string[] {
  const cur = loadGallery(storage);
  if (!ENDINGS.includes(ending) || cur.includes(ending)) return cur;
  const next = [...cur, ending];
  try { storage.setItem(GALLERY_KEY, JSON.stringify(next)); } catch { /* 저장 불가 환경 */ }
  return next;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveBundle {
  schemaVersion: 2;
  savedAt: number;
  mission: MissionState;
  measure: MeasurementState;
  /** 포크 답의 화면 기억(선택 항목). 분석을 끈 판에서는 비어 있다 */
  ui?: Record<string, string>;
}

export type LoadResult =
  | { ok: true; bundle: SaveBundle }
  | { ok: false; reason: 'empty' | 'corrupt' | 'oldVersion' | 'invalid'; detail?: string };

export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
}

/** localStorage를 쓸 수 없으면(예: 일부 file:// 환경) 메모리 저장으로 대체한다. */
export function safeStorage(): { storage: StorageLike; persistent: boolean } {
  try {
    const ls = globalThis.localStorage;
    const probe = 'mirror:last-earth:probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { storage: ls, persistent: true };
  } catch {
    return { storage: memoryStorage(), persistent: false };
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validateBundle(x: unknown): string | null {
  if (!isObj(x)) return 'not-object';
  if (x.schemaVersion !== 2) return 'schema';
  const m = x.mission;
  const me = x.measure;
  if (!isObj(m) || !isObj(me)) return 'parts';
  if (m.schemaVersion !== 2 || typeof m.runId !== 'string' || !isNum(m.runSeed)) return 'mission-head';
  if (typeof m.fsm !== 'string' || !(FSM_STATES as readonly string[]).includes(m.fsm)) return 'fsm';
  if (!Array.isArray(m.seats) || m.seats.length !== 4) return 'seats';
  const seated = m.seats.filter((s) => s !== null);
  if (!seated.every(isCandidateId) || new Set(seated).size !== seated.length) return 'seats-ids';
  if (!Array.isArray(m.crewIds) || !m.crewIds.every(isCandidateId) || new Set(m.crewIds).size !== m.crewIds.length || m.crewIds.length > 4) return 'crew';
  if (typeof m.crewLocked !== 'boolean') return 'locked';
  if (m.crewLocked && m.crewIds.length !== 4) return 'crew-locked-size';
  if (!m.crewIds.every((c) => seated.includes(c)) || m.crewIds.length !== seated.length) return 'crew-seat-mismatch';
  if (!isObj(m.resources) || !Object.keys(INITIAL_RESOURCES).every((k) => isNum((m.resources as Record<string, unknown>)[k]))) return 'resources';
  if (!isObj(m.flags) || !isObj(m.player) || !Array.isArray(m.met) || !Array.isArray(m.savedRosters)) return 'misc';
  if (!isNum(m.narrativeClock)) return 'clock';
  if (!Array.isArray(m.inventoryIds) || !m.inventoryIds.every((x) => typeof x === 'string')) return 'inventory';
  if (!Array.isArray(m.legacyItemIds) || !m.legacyItemIds.every((x) => typeof x === 'string')) return 'legacy';
  if (!Object.values(m.flags).every((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) return 'flags';
  if (typeof m.player.name !== 'string' || !isNum(m.player.look)) return 'player';
  if (me.schemaVersion !== 2 || typeof me.analysisOptIn !== 'boolean' || !Array.isArray(me.events) || !isObj(me.opportunities)) return 'measure';
  if (me.followups !== undefined && !(Array.isArray(me.followups) && me.followups.every((f) => isObj(f) && typeof f.qid === 'string' && typeof f.dim === 'string' && (f.pole === 1 || f.pole === -1)))) return 'measure-followups';
  if (!isNum(me.seq) || !Object.values(me.opportunities).every((o) => isObj(o) && typeof o.status === 'string' && typeof o.locked === 'boolean')) return 'measure-opps';
  if (!me.events.every((e) => isObj(e) && typeof e.opportunityId === 'string' && typeof e.dim === 'string' && typeof e.kind === 'string' && (e.pole === 1 || e.pole === -1) && isNum(e.weight))) return 'measure-events';
  if (x.ui !== undefined && (!isObj(x.ui) || !Object.values(x.ui).every((v) => typeof v === 'string'))) return 'ui';
  return null;
}

export function saveGame(storage: StorageLike, mission: MissionState, measure: MeasurementState, ui: Record<string, string> = {}): boolean {
  const bundle: SaveBundle = { schemaVersion: 2, savedAt: Date.now(), mission, measure, ui };
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(bundle));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: StorageLike): LoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (raw === null) return { ok: false, reason: 'empty' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (isObj(parsed) && parsed.schemaVersion !== 2) return { ok: false, reason: 'oldVersion' };
  const err = validateBundle(parsed);
  if (err) return { ok: false, reason: 'invalid', detail: err };
  return { ok: true, bundle: parsed as unknown as SaveBundle };
}

export function clearSave(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
    storage.removeItem(GALLERY_KEY);
  } catch {
    /* 무시 */
  }
}

export interface Settings {
  textScale: 0 | 1 | 2;
  reducedMotion: boolean;
  intensity: 0 | 1 | 2;
  /** 퍼즐: manual = 직접 풀기(기본, 쉬운 난이도) · auto = 녹녹이에게 맡기기(자동 진행) */
  puzzles: 'auto' | 'manual';
}

export function defaultSettings(): Settings {
  const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { textScale: 1, reducedMotion: prefersReduced, intensity: 1, puzzles: 'manual' };
}

export function loadSettings(storage: StorageLike): Settings {
  const d = defaultSettings();
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return d;
    const p: unknown = JSON.parse(raw);
    if (!isObj(p)) return d;
    return {
      textScale: p.textScale === 0 || p.textScale === 2 ? p.textScale : 1,
      reducedMotion: typeof p.reducedMotion === 'boolean' ? p.reducedMotion : d.reducedMotion,
      intensity: p.intensity === 0 || p.intensity === 2 ? p.intensity : 1,
      puzzles: p.puzzles === 'auto' ? 'auto' : p.puzzles === 'manual' ? 'manual' : d.puzzles,
    };
  } catch {
    return d;
  }
}

export function saveSettings(storage: StorageLike, s: Settings): void {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* 무시 */
  }
}
