import type { Dim } from './opportunities';

/**
 * 추가 질문(2026-10-26): 플레이 기록만으로 축 글자가 '근거 부족(?)'이거나 '거의 동률(X)'이면,
 * 결과지 직전에 짧은 상황 질문으로 글자를 정한다. 두 선택지는 모두 괜찮은 답이다(정답 없음).
 * plus = 그 차원의 +극(E·N·F·J·개방·성실·친화 쪽).
 * 행동 관찰과 섞지 않고 따로 기록하며, 결과지에 '추가 질문으로 정함'을 표시한다.
 */
export interface FollowUpQ { id: string; dim: Dim; prompt: string; plus: string; minus: string }

export const FOLLOWUPS: Record<Dim, FollowUpQ[]> = {
  E: [
    { id: 'E1', dim: 'E', prompt: '돔의 쉬는 날. 어떻게 보낼까요?', plus: '공용실에서 다 같이 보드게임', minus: '내 방에서 조용히 책 한 권' },
    { id: 'E2', dim: 'E', prompt: '새 작업 방법이 떠올랐어요. 먼저 어떻게 할까요?', plus: '바로 동료에게 말하며 정리한다', minus: '혼자 충분히 다듬은 뒤 말한다' },
    { id: 'E3', dim: 'E', prompt: '긴 근무가 끝났어요. 힘을 되찾는 방법은?', plus: '식탁에서 수다 떨기', minus: '관측창 앞에서 혼자 쉬기' },
  ],
  SN: [
    { id: 'S1', dim: 'SN', prompt: '처음 보는 화성 장비 설명서를 받았어요. 어디부터 볼까요?', plus: '이 장비로 뭘 할 수 있을지 큰 그림', minus: '버튼 하나하나의 정확한 기능' },
    { id: 'S2', dim: 'SN', prompt: '내일 탐사 보고를 들을 때 더 궁금한 것은?', plus: '그 결과가 앞으로 뜻하는 것', minus: '정확히 무엇을 측정했는지' },
    { id: 'S3', dim: 'SN', prompt: '돔 벽에 붙일 기록을 쓴다면?', plus: '오늘 떠오른 생각과 가능성', minus: '오늘 실제로 한 일과 수치' },
  ],
  TF: [
    { id: 'T1', dim: 'TF', prompt: '동료가 실수로 물을 쏟았어요. 먼저 하는 말은?', plus: '괜찮아? 다친 데는 없어?', minus: '얼마나 쏟았는지부터 재 보자' },
    { id: 'T2', dim: 'TF', prompt: '규칙을 정할 때 더 중요한 것은?', plus: '모두가 납득하고 마음이 편한지', minus: '예외 없이 일관되게 적용되는지' },
    { id: 'T3', dim: 'TF', prompt: '동료의 계획에 허점이 보여요. 어떻게 말할까요?', plus: '애쓴 점부터 말하고 조심스럽게', minus: '허점을 바로 짚고 고칠 방법을' },
  ],
  JP: [
    { id: 'J1', dim: 'JP', prompt: '다음 주 근무표, 언제 정할까요?', plus: '오늘 미리 다 정해 둔다', minus: '그때그때 상황 보며 정한다' },
    { id: 'J2', dim: 'JP', prompt: '탐사를 떠나기 전 짐 싸기는?', plus: '목록을 먼저 쓰고 체크하며', minus: '필요해 보이는 걸 담으며' },
    { id: 'J3', dim: 'JP', prompt: '할 일이 세 개 생겼어요.', plus: '순서를 정하고 하나씩 끝낸다', minus: '손에 잡히는 것부터 오가며 한다' },
  ],
  O: [
    { id: 'O1', dim: 'O', prompt: '돔 식당 새 메뉴를 정해요.', plus: '처음 보는 화성 작물 실험 요리', minus: '모두 아는 익숙한 요리' },
    { id: 'O2', dim: 'O', prompt: '고장 난 장비를 고칠 방법은?', plus: '안 해 본 새로운 방법 시도', minus: '검증된 표준 절차대로' },
    { id: 'O3', dim: 'O', prompt: '자유 시간이 생겼어요.', plus: '해 본 적 없는 취미에 도전', minus: '좋아하는 익숙한 취미' },
  ],
  C: [
    { id: 'C1', dim: 'C', prompt: '자동 점검이 \u201c정상\u201d이라고 해요.', plus: '그래도 직접 한 번 더 확인', minus: '결과를 믿고 다음 일로' },
    { id: 'C2', dim: 'C', prompt: '공용 공구함을 쓰고 나서는?', plus: '제자리에 하나하나 정리', minus: '다음 사람이 쓸 테니 대충 두기' },
    { id: 'C3', dim: 'C', prompt: '마감이 일주일 남은 일이 있어요.', plus: '오늘부터 조금씩 해 둔다', minus: '집중이 붙는 막판에 몰아서' },
  ],
  A: [
    { id: 'A1', dim: 'A', prompt: '동료가 근무 시간을 바꿔 달래요. 내 일정도 빠듯해요.', plus: '사정이 있겠지, 바꿔 준다', minus: '내 사정을 설명하고 그대로 둔다' },
    { id: 'A2', dim: 'A', prompt: '회의에서 내 의견이 소수예요.', plus: '분위기를 위해 다수 쪽에 맞춘다', minus: '끝까지 내 의견을 말한다' },
    { id: 'A3', dim: 'A', prompt: '마지막 남은 간식 하나.', plus: '먼저 양보한다', minus: '공정하게 가위바위보' },
  ],
};

export interface FollowUpAnswer { qid: string; dim: Dim; pole: 1 | -1; displayPosition: number }

/** 추가 질문 답의 합(+1/-1)과 개수 */
export function followupSum(answers: readonly FollowUpAnswer[] | undefined, dim: Dim): { n: number; sum: number } {
  const xs = (answers ?? []).filter((a) => a.dim === dim);
  return { n: xs.length, sum: xs.reduce((s, a) => s + a.pole, 0) };
}
