import type { CandidateId } from '../shared/ids';
import { iGa, waGwa } from './josa';

/**
 * 결과지 콘텐츠 (design/05_RESULTS_AND_POSTGAME_v2.md 원문 그대로).
 * 강점·놓치기 쉬운 것·팁은 05 §0 원칙(양쪽 모두 긍정 프레임)에 맞춰 작성.
 */
export interface TypeInfo { name: string; line: string; job: string; strength: string; blind: string; tip: string }

export const TYPE_INFO: Record<string, TypeInfo> = {
  ISTJ: { name: '새벽 정비사형 인간', line: '같은 순서로, 매일, 빠짐없이', job: '생명유지 장치 정기 점검', strength: '약속한 점검을 빠짐없이 지키고 기록으로 남겨요.', blind: '절차에 없는 새 신호는 조금 늦게 받아들일 수 있어요.', tip: '바뀐 상황을 체크리스트 한 줄로 바꿔 건네면 금방 받아들여요.' },
  ISFJ: { name: '산소 지킴이형 인간', line: '보이지 않는 곳에서 숨 쉴 공기를 지킨다', job: '재고·돌봄 담당', strength: '누가 무엇이 부족한지 먼저 알아채고 조용히 채워요.', blind: '자기 몫의 피로는 말하지 않고 쌓아 두기 쉬워요.', tip: '고맙다는 말과 함께 "오늘은 쉬어도 돼"를 분명히 말해 주세요.' },
  INFJ: { name: '등대지기형 인간', line: '멀리 있는 사람에게도 빛이 닿게', job: '공동체 방향과 기록', strength: '흩어진 사정을 엮어 공동체가 갈 방향을 그려요.', blind: '마음속으로 결론을 내리고 말로 꺼내지 않을 때가 있어요.', tip: '회의 전에 생각을 정리할 시간을 주면 깊은 제안이 나와요.' },
  INTJ: { name: '궤도 설계자형 인간', line: '7개월 뒤의 위치를 오늘 계산한다', job: '장기 자원 계획', strength: '몇 달 뒤의 병목을 오늘 계산해 미리 대비해요.', blind: '계획의 이유를 다 설명하지 않아 동료가 따라오기 어려울 수 있어요.', tip: '계획의 "왜"를 한 문장으로 나눠 달라고 부탁해 보세요.' },
  ISTP: { name: '현장 해결사형 인간', line: '말보다 렌치가 먼저 움직인다', job: '고장 현장 대응', strength: '고장 난 자리에서 손이 먼저 원인을 찾아요.', blind: '고친 과정을 기록으로 남기는 일은 건너뛰기 쉬워요.', tip: '긴 회의보다 현장에서 같이 보며 이야기하는 게 빨라요.' },
  ISFP: { name: '화성 스케치가형 인간', line: '붉은 모래에서 색을 찾아낸다', job: '거주 공간 꾸미기, 관찰 기록', strength: '작은 변화와 아름다움을 관찰해 공간을 살 만하게 만들어요.', blind: '갈등이 생기면 조용히 물러서 의견이 묻히기 쉬워요.', tip: '의견을 물을 때 "하나만 골라 줘"처럼 부담을 줄여 주세요.' },
  INFP: { name: '기억 정원사형 인간', line: '사라진 것의 이름을 새싹 옆에 꽂는다', job: '기록 보존, 이야기', strength: '사라진 것의 의미를 지키며 모두가 왜 여기 있는지 기억하게 해요.', blind: '의미를 붙잡다 마감이 밀릴 때가 있어요.', tip: '일의 의미를 먼저 나누면 놀라운 집중력을 보여요.' },
  INTP: { name: '이상 신호 해독가형 인간', line: '센서가 틀린 건지 세상이 바뀐 건지 묻는다', job: '원인 분석', strength: '이상한 신호의 원인을 끝까지 파고들어요.', blind: '분석이 끝나기 전엔 결론을 미루기 쉬워요.', tip: '"지금까지 알아낸 것"을 중간에 나눠 달라고 해 보세요.' },
  ESTP: { name: '강하 파일럿형 인간', line: '흔들리는 순간에 손이 먼저 반응한다', job: '외부 활동, 긴급 조작', strength: '흔들리는 순간 빠르게 판단하고 직접 움직여요.', blind: '긴 준비 과정에는 금방 지루해질 수 있어요.', tip: '긴급 대응 역할을 맡기면 가장 빛나요.' },
  ESFP: { name: '착륙장 불꽃형 인간', line: '도착한 자리를 금방 축제로 만든다', job: '사기·분위기', strength: '힘든 날에도 분위기를 살려 모두가 버티게 해요.', blind: '먼 계획의 세부는 놓치기 쉬워요.', tip: '오늘 할 일 하나를 함께 정해 주면 끝까지 해내요.' },
  ENFP: { name: '붉은 하늘 탐험가형 인간', line: '가 보지 않은 언덕 너머가 궁금하다', job: '탐사 기획', strength: '가능성을 찾아내고 사람들을 들뜨게 해요.', blind: '새 아이디어가 많아 마무리가 흩어질 수 있어요.', tip: '아이디어 중 하나를 고르게 도와주면 큰 힘이 돼요.' },
  ENTP: { name: '플랜B 발명가형 인간', line: '안 되는 이유 옆에 되는 방법을 그린다', job: '대안 설계', strength: '막힌 길 옆에 다른 길을 금방 그려 내요.', blind: '반복 업무는 지루해하며 미루기 쉬워요.', tip: '"다른 방법은 없을까?"를 맡기면 즐겁게 풀어요.' },
  ESTJ: { name: '관제실 지휘관형 인간', line: '모두가 제 위치에 있을 때 안심한다', job: '업무 배치, 운영', strength: '모두의 위치와 일정을 정리해 혼란을 줄여요.', blind: '정해진 방식 밖의 의견은 늦게 들을 수 있어요.', tip: '새 제안은 실행 계획과 함께 가져가면 잘 받아들여요.' },
  ESFJ: { name: '첫 저녁 식탁형 인간', line: '모두가 한 테이블에 앉게 만든다', job: '공동생활 조율', strength: '빠진 사람 없이 모두를 한자리에 모으고 챙겨요.', blind: '모두를 맞추다 자기 의견을 뒤로 미루기 쉬워요.', tip: '"당신 생각은?"을 꼭 따로 물어봐 주세요.' },
  ENFJ: { name: '돔의 목소리형 인간', line: '흩어진 마음을 하나의 약속으로 묶는다', job: '회의 진행, 헌장', strength: '흩어진 마음을 모아 함께 지킬 약속으로 만들어요.', blind: '모두의 기대를 혼자 짊어지기 쉬워요.', tip: '진행을 나눠 맡자고 제안하면 오래 함께 갈 수 있어요.' },
  ENTJ: { name: '개척 함장형 인간', line: '길이 없으면 길을 정하고 앞장선다', job: '위기 지휘', strength: '길이 없을 때 방향을 정하고 앞장서요.', blind: '속도를 내다 뒤처진 사람을 놓칠 수 있어요.', tip: '결정 전에 반대 의견 하나를 들어 보자고 제안해 보세요.' },
};

/** 05 §5: 이미 세상을 떠난 인물만, 알려진 일하는 방식만 비교 */
export const FIGURES: Record<string, { name: string; hook: string }> = {
  ISTJ: { name: '허준', hook: '흩어진 의서를 모아 『동의보감』으로 체계화했다' },
  ISFJ: { name: '플로렌스 나이팅게일', hook: '야전 병원의 돌봄과 사망 원인 통계를 함께 기록했다' },
  INFJ: { name: '레이첼 카슨', hook: '오랜 관찰 끝에 『침묵의 봄』으로 환경 위험을 알렸다' },
  INTJ: { name: '요하네스 케플러', hook: '화성 관측 자료를 수년간 계산해 행성의 타원 궤도를 찾았다' },
  ISTP: { name: '장영실', hook: '자동 물시계 자격루 같은 장치를 손으로 만들어 냈다' },
  ISFP: { name: '이중섭', hook: '담뱃갑 은박지에도 그림을 새겼다' },
  INFP: { name: '윤동주', hook: '조용히 쓴 시들이 『하늘과 바람과 별과 시』로 남았다' },
  INTP: { name: '리처드 파인만', hook: '챌린저호 사고 조사에서 얼음물 한 컵으로 원인을 보여 줬다' },
  ESTP: { name: '척 예거', hook: '1947년 시험 비행에서 처음으로 음속을 돌파했다' },
  ESFP: { name: '유리 가가린', hook: '첫 유인 우주 비행 뒤 웃는 얼굴로 세계를 만났다' },
  ENFP: { name: '아멜리아 에어하트', hook: '여성 최초로 대서양 단독 횡단 비행에 성공했다' },
  ENTP: { name: '레오나르도 다빈치', hook: '비행 기계부터 해부도까지 노트에 그려 시험했다' },
  ESTJ: { name: '이순신', hook: '『난중일기』에 남은 철저한 준비와 현장 지휘' },
  ESFJ: { name: '김만덕', hook: '제주 대기근 때 재산으로 곡식을 사 굶주린 이웃을 구했다' },
  ENFJ: { name: '칼 세이건', hook: '『코스모스』로 우주를 모두의 언어로 나눴다' },
  ENTJ: { name: '어니스트 섀클턴', hook: '남극에서 배를 잃고도 인듀어런스호 대원 전원을 데리고 돌아왔다' },
};

export type CrewKey = CandidateId | 'dam';
/** 05 §4: 게임 속 설정으로 고정된 작업 스타일 */
export const CREW_TYPE: Record<CrewKey, string> = { harin: 'ESFJ', taeo: 'ISTJ', seojin: 'ESTJ', woojoo: 'ENFP', dodam: 'INFJ', jio: 'ENTP', dam: 'ISTP' };
export const CREW_NAME: Record<CrewKey, string> = { harin: '하린', taeo: '태오', seojin: '서진', woojoo: '진우주', dodam: '도담', jio: '지오', dam: '담' };
export const CREW_CATCH: Record<CrewKey, string> = { harin: '괜찮아, 괜찮아', taeo: '자, 순서대로', seojin: '숫자부터 보자', woojoo: '일단 심어 보자', dodam: '기록해 둘게요', jio: '아마도!', dam: '조종간부터 잡자' };

const WAY: Record<string, string> = { E: '사람들과 나누며 정리하기', I: '혼자 조용히 정리하기', S: '확인된 사실부터 보기', N: '가능성부터 보기', T: '수치부터 재기', F: '사람의 사정부터 듣기', J: '계획부터 세우기', P: '하면서 정하기' };
const GIFT: Record<string, string> = { E: '다른 시선', I: '생각을 다지는 시간', S: '확실한 발판', N: '큰 그림', T: '영향의 크기를 재는 저울', F: '놓치기 쉬운 사정', J: '안전망', P: '흐름에 맞추는 유연함' };
const TOPIC = ['쉬는 방식', '자료를 읽는 순서', '결정 직전', '첫 주의 작업'];

/** 플레이어 축 글자(정해지지 않은 축은 null)와 승무원 유형을 비교한 이유 문장 */
export function crewReasons(crew: CrewKey, player: (string | null)[]): { match: number; known: number; lines: string[] } {
  const t = CREW_TYPE[crew];
  const name = CREW_NAME[crew];
  let match = 0;
  let known = 0;
  const lines: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const p = player[i];
    if (!p) continue;
    known += 1;
    if (p === t[i]) {
      match += 1;
      lines.push(`${waGwa(name)} 당신은 둘 다 '${WAY[p]}' 쪽이라 ${TOPIC[i]}에서 손발이 맞아요.`);
    } else {
      lines.push(`${name}의 '${CREW_CATCH[crew]}'와 당신의 '${WAY[p]}'는 ${TOPIC[i]}에서 부딪힐 수 있어요. 대신 ${name}의 '${WAY[t[i]]}'는 당신에게 ${iGa(GIFT[t[i]])} 돼요.`);
    }
  }
  return { match, known, lines };
}

const flip = (t: string, idx: number[]): string => t.split('').map((ch, i) => (idx.includes(i) ? ({ E: 'I', I: 'E', S: 'N', N: 'S', T: 'F', F: 'T', J: 'P', P: 'J' } as Record<string, string>)[ch] : ch)).join('');

/** 05 §4 16유형 궁합(재미용 협업 규칙). 축 순서: 0 E/I, 1 S/N, 2 T/F, 3 J/P */
export function typeCompat(t: string): { easy: string[]; learn: string[]; clash: string[] } {
  return {
    easy: [flip(t, [0]), flip(t, [2])],
    learn: [flip(t, [1, 2]), flip(t, [0, 1, 2])],
    clash: [flip(t, [3]), flip(t, [0, 3])],
  };
}

/** 05 §2 해석 문장 */
export interface Interp { meaning: string; other: string }
export const INTERP: Record<string, { plus: Interp; minus: Interp; indicator: string }> = {
  SN: { indicator: 'MBTI S/N (정보 수집)', plus: { meaning: "숫자 하나보다 흐름과 '앞으로 어떻게 될지'를 먼저 보려는 쪽 (N)", other: '실측부터 보는 건 확실한 발판 위에서 생각하는 방식' }, minus: { meaning: '지금 확인된 사실을 먼저 손에 쥐려는 쪽 (S)', other: '가능성부터 보는 건 큰 그림으로 방향을 잡는 방식' } },
  O: { indicator: '빅파이브 개방성', plus: { meaning: '검증된 길이 있어도 다른 길을 한 번 시험해 보는 쪽 (O+)', other: '표준 절차를 고르는 건 에너지를 정말 중요한 곳에 아끼는 방식' }, minus: { meaning: '이미 잘 작동하는 방법을 믿고 쓰는 쪽 (O−)', other: '새 방식은 뜻밖의 개선을 찾는 방식' } },
  C: { indicator: '빅파이브 성실성', plus: { meaning: "'괜찮다'는 확인이 있어도 내 눈으로 한 번 더 보는 쪽 (C+)", other: '믿을 만한 확인을 믿는 건 효율을 아끼는 방식' }, minus: { meaning: '신뢰할 근거가 있으면 다음 단계로 넘어가는 쪽 (C−)', other: '재점검은 작은 오류를 잡는 방식' } },
  JP: { indicator: 'MBTI J/P (생활 방식)', plus: { meaning: '순서를 정해 두고 움직일 때 편한 쪽 (J)', other: '하면서 정하는 건 상황 변화에 빨리 맞추는 방식' }, minus: { meaning: '일단 손을 대 보고 흐름을 보며 고르는 쪽 (P)', other: '계획 먼저는 헤매는 시간을 줄이는 방식' } },
  E: { indicator: 'MBTI E/I · 빅파이브 외향성', plus: { meaning: '생각을 사람들과 나누며 정리하는 쪽 (E)', other: '혼자 정리하는 건 생각을 깊게 다지는 방식' }, minus: { meaning: '조용히 혼자 정리하며 힘을 모으는 쪽 (I)', other: '함께하는 건 다른 시선을 빨리 얻는 방식' } },
  A: { indicator: '빅파이브 우호성', plus: { meaning: '상대의 사정을 내 계획에 맞춰 넣는 쪽 (A+)', other: '원안 유지와 설명은 기준을 분명히 지키는 방식' }, minus: { meaning: '이유를 설명하고 기준을 지키는 쪽 (A−)', other: '조정은 관계의 마찰을 줄이는 방식' } },
  TF: { indicator: 'MBTI T/F (판단 근거)', plus: { meaning: "결정 전에 '누가 어떻게 느끼는지'부터 확인하는 쪽 (F)", other: '수치 먼저는 영향의 크기부터 재는 방식' }, minus: { meaning: "결정 전에 '얼마나, 어디에 영향이 가는지'부터 재는 쪽 (T)", other: '사람 먼저는 놓치기 쉬운 사정을 먼저 듣는 방식' } },
};
export const TF_NOTE = "T/F 해석은 '결정할 때 먼저 찾아본 정보의 종류'일 뿐, 감정과 논리 중 무엇이 낫다는 뜻이 아니에요.";

export const DIM_NAME: Record<string, string> = { O: '개방성', C: '성실성', E: '외향성', A: '우호성', N: '신경성(정서 안정성)' };
export const OFFICIAL_NOTE = '공식 MBTI® 검사가 아니라 게임 속 행동으로 추정한 비공식 결과예요.';
