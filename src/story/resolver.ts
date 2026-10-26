import type { CandidateId, SpeakerId } from '../shared/ids';

/** 역할 해석 (STORY_BIBLE v2 §3-3). 누가 없어도 막히지 않는다. */
export type Role = 'repair' | 'medic' | 'grow' | 'archive' | 'robot' | 'heart';

export const ROLE_PRIORITY: Record<Role, CandidateId[]> = {
  repair: ['taeo', 'jio'],
  medic: ['seojin', 'harin'],
  grow: ['woojoo', 'harin', 'dodam'],
  archive: ['dodam', 'harin'],
  robot: ['jio', 'taeo'],
  heart: ['harin', 'dodam', 'seojin'],
};

export function resolveRole(role: Role, crew: readonly CandidateId[]): CandidateId | null {
  return ROLE_PRIORITY[role].find((c) => crew.includes(c)) ?? null;
}

/** 대사 슬롯별 화자 우선순위. 승선자 중 첫 사람, 없으면 고정 인물. */
export const SLOT_PRIORITY = {
  c1SeatRequest: ['seojin', 'dodam', 'jio', 'woojoo', 'taeo', 'harin'],
  c1KeepRequestReply: ['seojin', 'dodam', 'jio', 'woojoo', 'taeo', 'harin'],
  lastWater: ['harin', 'woojoo', 'taeo', 'dodam', 'seojin', 'jio'],
  c2BagTalk: ['woojoo', 'harin', 'jio', 'dodam', 'taeo', 'seojin'],
  c2StrapRequest: ['dodam', 'harin', 'woojoo', 'seojin', 'jio', 'taeo'],
  c3PanelRequest: ['harin', 'dodam', 'woojoo', 'jio', 'seojin', 'taeo'],
  c3Comment: ['taeo', 'jio', 'seojin', 'woojoo', 'harin', 'dodam'],
  c4Shift: ['jio', 'woojoo', 'harin', 'taeo', 'dodam', 'seojin'],
  c5Formation: ['dodam', 'woojoo', 'jio', 'harin', 'seojin', 'taeo'],
  c6Shift: ['taeo', 'seojin', 'dodam', 'jio', 'harin', 'woojoo'],
  c7Water: ['woojoo', 'seojin', 'harin', 'dodam', 'taeo', 'jio'],
  c8Meeting: ['dodam', 'jio', 'harin', 'taeo', 'woojoo', 'seojin'],
  c4Talk: ['harin', 'woojoo', 'jio', 'dodam', 'seojin', 'taeo'],
} satisfies Record<string, CandidateId[]>;

export type SlotId = keyof typeof SLOT_PRIORITY;

export function pickSpeaker(slot: SlotId, crew: readonly CandidateId[], fallback: SpeakerId = 'dam'): SpeakerId {
  const list: readonly CandidateId[] = SLOT_PRIORITY[slot];
  return list.find((c) => crew.includes(c)) ?? fallback;
}
