/** 게임 전체가 공유하는 원시 식별자. 측정 모듈도 이 파일만 import할 수 있다. */
export type CandidateId = 'harin' | 'taeo' | 'seojin' | 'woojoo' | 'dodam' | 'jio';
export const CANDIDATE_IDS: readonly CandidateId[] = ['harin', 'taeo', 'seojin', 'woojoo', 'dodam', 'jio'];

export type FixedId = 'player' | 'dam' | 'noknok' | 'boram' | 'mirror';
export type SpeakerId = CandidateId | FixedId;

export type ChapterId = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8';
export const CHAPTER_IDS: readonly ChapterId[] = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'];

/** 측정용 압박 태그: 긴박(H) 4장 / 평온(L) 4장 균형 배치 */
export type PressureTag = 'H' | 'L';
export const PRESSURE: Record<ChapterId, PressureTag> = {
  C1: 'H', C2: 'L', C3: 'H', C4: 'L', C5: 'H', C6: 'H', C7: 'L', C8: 'L',
};

export const CHAPTER_TITLE: Record<ChapterId, string> = {
  C1: 'LAST FOUR — 마지막 네 자리',
  C2: 'THE LAST BAG — 마지막 12킬로그램',
  C3: 'IGNITION — 지구의 마지막 창',
  C4: 'DAY 189 — 대답 없는 지구',
  C5: 'TOUCHDOWN — 붉은 행성에 첫발',
  C6: 'ZERO DOME — 산소가 줄어든다',
  C7: 'BELOW THE RED — 얼음 아래의 물',
  C8: 'FIRST SOL — 우리가 만들 첫 번째 규칙',
};

export function isCandidateId(v: unknown): v is CandidateId {
  return typeof v === 'string' && (CANDIDATE_IDS as readonly string[]).includes(v);
}
