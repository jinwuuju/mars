import type { ChapterId } from '../shared/ids';
import { OPPORTUNITY_BY_ID, type Dim, type Family } from './opportunities';
import type { FollowUpAnswer } from './followup';

/**
 * 측정 상태. 이야기 상태(MissionState)와 완전히 분리된 별도 스토어다.
 * 승선 명단·소지품·이야기 플래그를 담지 않으며 읽지도 않는다.
 */
export type OppStatus = 'unavailable' | 'eligible' | 'observed' | 'skipped';
export type ActKind = 'fork' | 'tab' | 'hotspot';
export type Pole = 1 | -1;

/** 05 §6: 누가 물었는지(이름 없이 역할만). 선택지 표시용이며 채점에는 쓰지 않는다 */
export type AskedBy = 'noknok' | 'dam' | 'mirror' | 'crew' | 'self';

export interface ActInput {
  opportunityId: string;
  dim: Dim;
  kind: ActKind;
  pole: Pole;
  /** 같은 행위의 재기록(새로고침·중복 클릭)을 막는 키 */
  actKey: string;
  displayPosition: number;
  optionSetId: string;
  /** 표시용(결과지 '선택의 순간 다시보기'). 채점에는 쓰지 않는다. 승선자 이름을 넣지 않는다. */
  label: string;
  otherLabel?: string;
  scene?: string;
  /** 같은 패널에서 두 번째로 연 탭 등 보조 행위: 근거로 보여 주되 채점 가중치는 0 */
  secondary?: boolean;
  askedBy?: AskedBy;
}

export interface MeasureEvent extends ActInput {
  id: string;
  seq: number;
  chapter: ChapterId;
  weight: number;
}

export interface OppRecord {
  id: string;
  status: OppStatus;
  locked: boolean;
}

export interface MeasurementState {
  schemaVersion: 2;
  analysisOptIn: boolean;
  opportunities: Record<string, OppRecord>;
  events: MeasureEvent[];
  seq: number;
  duplicates: number;
  /** 결과지 직전 추가 질문의 답(근거 부족·동률 축만). 예전 저장에는 없을 수 있다 */
  followups?: FollowUpAnswer[];
}

export type MeasureAction =
  | { type: 'setOptIn'; value: boolean }
  | { type: 'open'; id: string }
  | { type: 'act'; act: ActInput }
  | { type: 'close'; id: string }
  | { type: 'reset'; optIn: boolean }
  | { type: 'followup'; answer: FollowUpAnswer };

export function createMeasurement(optIn: boolean): MeasurementState {
  const opportunities: Record<string, OppRecord> = {};
  for (const o of OPPORTUNITY_BY_ID.values()) opportunities[o.id] = { id: o.id, status: 'unavailable', locked: false };
  return { schemaVersion: 2, analysisOptIn: optIn, opportunities, events: [], seq: 0, duplicates: 0, followups: [] };
}

export function openOpportunity(s: MeasurementState, id: string): MeasurementState {
  const r = s.opportunities[id];
  if (!r || r.locked || r.status !== 'unavailable') return s;
  return { ...s, opportunities: { ...s.opportunities, [id]: { ...r, status: 'eligible' } } };
}

function actWeight(a: ActInput, family: Family): number {
  if (a.kind === 'fork') return family === 'SOCIAL' ? 2 : 1;
  if (a.kind === 'hotspot') return 1;
  return a.secondary ? 0 : 1;
}

export function recordAct(s: MeasurementState, a: ActInput): MeasurementState {
  if (!s.analysisOptIn) return s;
  const r = s.opportunities[a.opportunityId];
  const opp = OPPORTUNITY_BY_ID.get(a.opportunityId);
  if (!r || !opp || !opp.scored || !opp.dims.includes(a.dim)) return s;
  if (r.locked || r.status === 'unavailable') return { ...s, duplicates: s.duplicates + 1 };
  if (s.events.some((e) => e.opportunityId === a.opportunityId && e.actKey === a.actKey)) {
    return { ...s, duplicates: s.duplicates + 1 };
  }
  const seq = s.seq + 1;
  const askedBy: AskedBy = a.askedBy ?? (opp.family === 'PERSPECTIVE' ? 'crew' : a.kind === 'fork' ? 'noknok' : 'self');
  const ev: MeasureEvent = { ...a, askedBy, id: `${a.opportunityId}#${seq}`, seq, chapter: opp.chapter, weight: actWeight(a, opp.family) };
  return {
    ...s,
    seq,
    events: [...s.events, ev],
    opportunities: { ...s.opportunities, [a.opportunityId]: { ...r, status: 'observed' } },
  };
}

export function closeOpportunity(s: MeasurementState, id: string): MeasurementState {
  const r = s.opportunities[id];
  if (!r || r.locked) return s;
  const status: OppStatus = r.status === 'eligible' ? 'skipped' : r.status;
  return { ...s, opportunities: { ...s.opportunities, [id]: { ...r, status, locked: true } } };
}

export function measureReducer(s: MeasurementState, a: MeasureAction): MeasurementState {
  switch (a.type) {
    case 'setOptIn':
      if (a.value === s.analysisOptIn) return s;
      // 끄면 기록을 지우고 기회 상태도 처음으로 돌린다('observed'인데 근거가 없는 모순 상태를 남기지 않는다)
      return a.value ? { ...s, analysisOptIn: true } : createMeasurement(false);
    case 'open':
      return openOpportunity(s, a.id);
    case 'act':
      return recordAct(s, a.act);
    case 'close':
      return closeOpportunity(s, a.id);
    case 'reset':
      return createMeasurement(a.optIn);
    case 'followup': {
      if (!s.analysisOptIn) return s;
      const prev = s.followups ?? [];
      if (prev.some((x) => x.qid === a.answer.qid)) return { ...s, duplicates: s.duplicates + 1 };
      return { ...s, followups: [...prev, a.answer] };
    }
    default:
      return s;
  }
}
