import { CHAPTER_IDS, PRESSURE, type ChapterId, type PressureTag } from '../shared/ids';

/** 관찰 기회 패밀리 (design/04_BEHAVIOR_MATRIX_v2.csv) */
export type Family = 'INFO' | 'VARIANT' | 'ORDER' | 'SOCIAL' | 'PERSPECTIVE' | 'STORY';
/** 채점 차원. EI는 E와 같은 근거를 쓰므로 별도 차원으로 두지 않는다(결과 화면에 공개). N은 v1에서 측정하지 않는다. */
export type Dim = 'O' | 'C' | 'E' | 'A' | 'SN' | 'TF' | 'JP';

export const FAMILY_ORDER: readonly Family[] = ['INFO', 'VARIANT', 'ORDER', 'SOCIAL', 'PERSPECTIVE', 'STORY'];
export const FAMILY_DIMS: Record<Family, Dim[]> = {
  INFO: ['SN'],
  VARIANT: ['O'],
  ORDER: ['C', 'JP'],
  SOCIAL: ['E'],
  PERSPECTIVE: ['A', 'TF'],
  STORY: [],
};

export interface Opportunity {
  id: string;
  chapter: ChapterId;
  family: Family;
  title: string;
  pressure: PressureTag;
  chapterWeight: number;
  dims: Dim[];
  scored: boolean;
}

type Six = [string, string, string, string, string, string];
const TITLES: Record<ChapterId, Six> = {
  C1: ['후보 기록 2탭 열람', '첫 편성 직후 방식 포크', '기준표 포크 + 탑승 직전 좌석 벨트 점검 포크', '더 묻기 vs 조용한 창가', '좌석 배치 요청', '4명 확정·작별·유산'],
  C2: ['물품 2탭 열람', '적재 방식(표준 가이드 vs 직접)', '담기 계획 + 봉인 후 고정 점검', '봉인 뒤 숨 고르기', '고정끈 요청(봉인 후)', '봉인(최종 짐·유산 수용)'],
  C3: ['센서 자료 2탭', '검증 절차 포크', '진단 순서 + 자동 진단 확인', '교신 vs 집중 모드', '점검 위치 요청', '수리 경로 저울·발사'],
  C4: ['장치 이력 2탭', '관로 경로 포크', '작업표 + 압력 확인', '자유 시간 1칸', '교대 요청', '지구 영상 처리·구조 신호 저울'],
  C5: ['착륙지 자료 2탭', '강하 프로파일 포크', '강하 계획 + 착륙 전 재검토', 'EVA 도보 중 대화', '대열 요청', '착륙지 저울·돌풍 대응'],
  C6: ['계기 2탭', '재시동 시퀀스 포크', '역할표 + 자동 점검', '설명하며 함께 vs 혼자 패널', '근무 순번 요청', '72시간 전력 저울·재시동'],
  C7: ['지질 레이어 2탭', '로버 경로 포크', '탐사 계획 + 경사 체크', '무전 상의 vs 혼자 운전', '물 배분 요청', '탐사 목적지 저울·정수'],
  C8: ['장부 2탭', '규칙 초안 포크', '업무표 작성 + 재점검', '의견 묻기 vs 혼자 다듬기', '회의 진행 요청', '결정 방식·문·대답·이름'],
};

export const OPPORTUNITIES: readonly Opportunity[] = CHAPTER_IDS.flatMap((chapter) =>
  FAMILY_ORDER.map((family, i): Opportunity => ({
    id: `${chapter}-O0${i + 1}`,
    chapter,
    family,
    title: TITLES[chapter][i],
    pressure: PRESSURE[chapter],
    chapterWeight: family === 'STORY' ? 0 : chapter === 'C1' ? 0.5 : 1,
    dims: FAMILY_DIMS[family],
    scored: family !== 'STORY',
  })),
);

export const OPPORTUNITY_BY_ID: ReadonlyMap<string, Opportunity> = new Map(OPPORTUNITIES.map((o) => [o.id, o]));

export function oppId(chapter: ChapterId, family: Family): string {
  return `${chapter}-O0${FAMILY_ORDER.indexOf(family) + 1}`;
}
