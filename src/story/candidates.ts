import type { CandidateId } from '../shared/ids';
import { NPC_LOOKS, type Look } from '../art/look';

export type SkillKey = 'repair' | 'medic' | 'grow' | 'archive' | 'robot' | 'heart';
export const SKILL_KEYS: readonly SkillKey[] = ['repair', 'medic', 'grow', 'archive', 'robot', 'heart'];
export const SKILL_LABEL: Record<SkillKey, string> = {
  repair: '정비', medic: '의료', grow: '재배', archive: '기록', robot: '로봇', heart: '마음',
};

export interface LegacyItem { id: string; name: string; kg: number; line: string }

export interface Candidate {
  id: CandidateId;
  name: string;
  age: number;
  role: string;
  quote: string;
  idle: string;
  skills: Record<SkillKey, number>;
  look: Look;
  /** 실측 기록 탭 (S) */
  facts: string[];
  /** 가능성 분석 탭 (N) */
  possibilities: string[];
  testimony: string;
  voiceMemo: string;
  greet: string;
  asks: { q: string; a: string }[];
  farewell: string;
  legacy: LegacyItem;
}

/** 텍스트 토큰: {player} 이름, {relWord} 동생/오랜 친구, {relBecause} 동생이라서/친구라서 */
export const CANDIDATES: Record<CandidateId, Candidate> = {
  harin: {
    id: 'harin', name: '하린', age: 29, role: '대피소 생활물자 담당',
    quote: '나도 탈 수 있을까? ...아니, 내 얼굴 보고 결정하진 마. 네가 나중에 견딜 수 있게 결정해.',
    idle: '머플러를 자꾸 매만진다',
    skills: { repair: 1, medic: 1, grow: 1, archive: 1, robot: 0, heart: 3 },
    look: NPC_LOOKS.harin,
    facts: ['대피소 3구역 생활물자 배분 14개월 담당', '재봉·수선 작업 기록 1,200건 이상', '응급물품 재고 정리 담당 (의료 면허 없음)', '시민 대표와의 관계: {relWord}'],
    possibilities: ['좁은 선내에서 옷·장비 수선과 생활 정리를 맡을 수 있다', '갈등이 생길 때 분위기를 누그러뜨리는 역할을 할 가능성', '정식 의료·공학 훈련은 없어 전문 작업은 보조 수준일 수 있다'],
    testimony: '자치회 기록: 배급 줄이 길어지면 하린이 먼저 줄 끝으로 가서 사람들 이름을 불렀다.',
    voiceMemo: '자치회가 날 추천한 건 {relBecause}가 아니야. 그래도 다들 그렇게 볼 거야.',
    greet: '{player}, 괜찮아, 괜찮아. ...나보다 네 얼굴이 더 안 좋다.',
    asks: [
      { q: '화성에 가면 뭘 하고 싶어?', a: '구멍 난 거 꿰매기. 옷이든, 마음이든. ...웃지 마.' },
      { q: '만약 못 타게 되면?', a: '그건 네가 정할 일이야. 난 네가 정한 걸 원망하지 않을 거야. 약속.' },
    ],
    farewell: '내 이름을 지운 게 아니라, 네가 네 사람을 살리기로 한 거잖아. 가.',
    legacy: { id: 'legacy_muffler', name: '붉은 머플러 + 수선 키트', kg: 1.5, line: '추울 거야. 이번엔 네 목에 둘러.' },
  },
  taeo: {
    id: 'taeo', name: '태오', age: 52, role: '공기·물 순환 설비 기사',
    quote: '우주선엔 멋진 조종대보다 고장 안 나는 필터가 중요해.',
    idle: '렌치를 천으로 닦고 또 닦는다',
    skills: { repair: 3, medic: 0, grow: 1, archive: 1, robot: 1, heart: 1 },
    look: NPC_LOOKS.taeo,
    facts: ['공기·물 순환 설비 현장 경력 28년', '아크 계열 물 회수 장치 설계팀 참여', '선외 작업 자격 없음 · 실내 설비 전문'],
    possibilities: ['기지 생명유지 설비가 고장 나면 가장 빠른 진단을 기대할 수 있다', '처음 보는 장치에는 익숙해질 시간이 필요할 수 있다', '자기 방식이 확고해 새로운 절차와 부딪힐 가능성'],
    testimony: '동료 증언: 태오 씨는 매일 같은 순서로 필터를 봐요. 한 번도 건너뛴 적이 없어요.',
    voiceMemo: '아크-06 물 회수 장치... 내가 손본 거야. 다 고치고 보냈어야 했는데.',
    greet: '자, 순서대로. 뭐가 궁금해?',
    asks: [
      { q: '화성 기지에서 제일 걱정되는 건요?', a: '산소는 만드는 거고, 물은 되찾는 거야. 둘 다 기계가 하지. 기계는 언젠가 아파.' },
      { q: '왜 이 일을 하셨어요?', a: '고장 난 걸 고치면 조용해지거든. 그 조용함이 좋아.' },
    ],
    farewell: '...순서대로 하면 돼. 너도, 나도.',
    legacy: { id: 'legacy_notebook', name: '손때 묻은 정비 수첩', kg: 0.5, line: '필터는 매주 봐. ...사람도.' },
  },
  seojin: {
    id: 'seojin', name: '서진', age: 38, role: '응급의학 종사자',
    quote: '모든 사람을 구할 수는 없어도, 누구도 혼자 아프게 두고 싶진 않아.',
    idle: '파우치 속 붕대를 다시 접는다',
    skills: { repair: 0, medic: 3, grow: 0, archive: 1, robot: 0, heart: 2 },
    look: NPC_LOOKS.seojin,
    facts: ['응급실 근무 11년', '재난 현장 응급처치 지휘 경험', '우주 의학 정식 훈련 없음'],
    possibilities: ['부상·질병 상황에서 대응 속도를 크게 높일 수 있다', '보급품을 넉넉히 쓰는 편이라 물자 조율이 필요할 수 있다', '수치를 먼저 보는 습관이 위기 판단에 도움이 될 가능성'],
    testimony: '병원 동료: 서진 선생님은 마지막 날까지 남은 환자 명단을 손으로 다시 썼어요.',
    voiceMemo: '그날 이후로... 누굴 두고 가는 게 제일 무서워.',
    greet: '숫자부터 보자. 너 오늘 물은 마셨어?',
    asks: [
      { q: '우주에서 다치면 어떡해요?', a: '뼈는 우주에서도 붙어. 느리게 붙을 뿐이지. 그 시간을 같이 버텨 주는 게 내 일이야.' },
      { q: '무섭지 않아요?', a: '무서워. 그래서 숫자를 봐. 숫자는 겁을 줄여 주거든.' },
    ],
    farewell: '...괜찮아. 여기도 아픈 사람은 있으니까.',
    legacy: { id: 'legacy_medcards', name: '응급 카드 묶음 + 진통 패치', kg: 1, line: '아프면 참지 말고 말해. 그게 규칙이야. 내가 못 지킨 규칙이라 너한테 주는 거야.' },
  },
  woojoo: {
    id: 'woojoo', name: '진우주', age: 27, role: '폐쇄형 재배시설 연구원 · 녹차 애호가',
    quote: '흙이 없어도 먹을 건 만들 수 있어. 하지만 처음부터 성공할 거란 보장은 없어. ...일단 녹차 한 잔 하고 생각할래?',
    idle: '초록 보온병의 녹차를 홀짝이며 화분에 물을 한 방울씩 준다',
    skills: { repair: 1, medic: 0, grow: 3, archive: 1, robot: 1, heart: 1 },
    look: NPC_LOOKS.woojoo,
    facts: ['폐쇄형 수경 재배 실험 5년', '지하 농장 수확량 개선 프로젝트 참여', '실험 승인 절차 위반 경고 1회', '개인 소지품 신고서: 녹차 티백 214봉 (자진 신고, 비고란에 하트 표시)'],
    possibilities: ['돔 농장을 가장 빨리 가동할 가능성', '새 환경에서 시도를 즐기지만 실패 데이터가 쌓일 시간이 필요하다', '식량 계획을 장기적으로 바꿀 아이디어를 낼 가능성', '화성 최초의 차나무 재배를 시도할 가능성 (본인 주장)'],
    testimony: '연구소장: 진우주는 실패한 화분에도 이름을 붙여요. 그리고 회의 때마다 녹차를 돌려요. 거절하면 조금 슬퍼해요.',
    voiceMemo: '...승인 안 받은 씨앗이 있어. 감자 하나, 그리고 차나무 씨앗 한 줌. 화성에서도 녹차는 마셔야지.',
    greet: '실험해 보자! ...아, 인사부터. 안녕! 녹차 마실래? 아직 따뜻해.',
    asks: [
      { q: '화성에서 감자가 자랄까요?', a: '흙은 없지만 물과 빛과 인내심이 있으면... 아마? 실험해 보자! 감자 다음은 차나무야.' },
      { q: '왜 그렇게 녹차를 좋아해요?', a: '쓴맛 다음에 단맛이 와. 실패 다음에 성공이 오는 것처럼. ...사실 그냥 맛있어서야.' },
    ],
    farewell: '싹 나면 나한테 알려 줘. ...못 들어도, 알려 줘.',
    legacy: { id: 'legacy_seeds', name: '실험 씨앗 봉투 + 차나무 씨앗', kg: 0.5, line: '싹이 안 나도 네 탓 아니야. 화성 탓이야. ...녹차 싹이 나면, 첫 잔은 나 대신 마셔 줘.' },
  },
  dodam: {
    id: 'dodam', name: '도담', age: 34, role: '교사 · 지구 기록 보존 담당',
    quote: '생존은 심장이 뛰는 일이고, 삶은 기억할 게 있는 일이잖아.',
    idle: '아이에게 헤드폰을 씌워 주고 있다',
    skills: { repair: 0, medic: 0, grow: 1, archive: 3, robot: 1, heart: 2 },
    look: NPC_LOOKS.dodam,
    facts: ['초등 교사 9년', '지구 디지털 기록 보존 프로젝트 지역 책임자', '보존 장비 운영에 큰 저장 공간과 전력이 필요'],
    possibilities: ['공동체의 기억과 문화를 이어 갈 가능성', '긴 고립 속에서 수업과 이야기로 사기를 지킬 수 있다', '기록 장비가 자원을 많이 요구해 우선순위 갈등이 생길 가능성'],
    testimony: '대피소 아이: 도담 선생님 헤드폰에서 우리 목소리가 나와요.',
    voiceMemo: '아이들 마지막 수업을 녹음했어요. 아무도 안 들으면... 그건 없어지는 거예요.',
    greet: '기록해 둘게요. 오늘 당신이 무엇을 물었는지도.',
    asks: [
      { q: '왜 기록이 중요해요?', a: '우리가 누구였는지 모르면, 화성에서 누가 될지도 모르니까요.' },
      { q: '제일 남기고 싶은 건요?', a: '시끄러운 쉬는 시간이요. 그게 제일 먼저 사라지거든요.' },
    ],
    farewell: '...기록해 둘게요. 당신이 오늘 고민했다는 것도.',
    legacy: { id: 'legacy_voices', name: '목소리 드라이브', kg: 1, line: '들어 줄 사람이 있으면, 그 목소리들은 아직 살아 있는 거예요.' },
  },
  jio: {
    id: 'jio', name: '지오', age: 32, role: '원격 로봇 · 드론 운영자',
    quote: '사람 대신 위험한 데 들어갈 수 있는 로봇이 있으면, 그걸 먼저 보내자.',
    idle: '어깨 위 로봇 삽과 장난을 친다',
    skills: { repair: 2, medic: 0, grow: 0, archive: 1, robot: 3, heart: 1 },
    look: NPC_LOOKS.jio,
    facts: ['원격 구조 드론 운영 7년', '소형 탐사 로봇 개조·정비 가능', '장비 손실 사고 보고 1회'],
    possibilities: ['위험한 바깥 작업을 로봇으로 대신할 가능성', '경고를 낙관적으로 볼 때가 있어 확인 절차가 필요할 수 있다', '기지 건설 로봇들과 빨리 친해질 가능성'],
    testimony: '구조대 동료: 지오는 로봇한테 먼저 인사해요. 이상하죠? 근데 로봇이 덜 고장 나요.',
    voiceMemo: '...경고등을 무시했던 날이 있어요. 다시는 안 그러려고요. 아마도.',
    greet: '괜찮아요, 아마도! 삽, 인사해.',
    asks: [
      { q: '로봇이 사람보다 나아요?', a: '아뇨! 로봇은 먼저 가는 거고, 사람은 돌아올 곳을 만드는 거예요.' },
      { q: '삽은 뭐예요?', a: '제 첫 로봇이요. 말은 안 듣는데 길은 잘 찾아요.' },
    ],
    farewell: '먼저 가요. 저는... 여기서 로봇들 정리하고 있을게요.',
    legacy: { id: 'legacy_sap', name: '소형 로봇 삽', kg: 2, line: '말 안 들으면 머리를 두 번 두드려요. ...저 대신 먼저 가 보라고 해요.' },
  },
};

/** MIRROR 지구 중계 노드의 '최적 편성 권고' (C1 중반 반전, 비채점) */
export const MIRROR_RECOMMENDATION: { crew: CandidateId[]; index: string; counted: string[]; notCounted: string[] } = {
  crew: ['taeo', 'seojin', 'woojoo', 'jio'],
  index: '0.71',
  counted: ['정비·의료·재배·로봇 역량 합계를 최대로', '선외·설비 위험 대응 시간을 최소로'],
  notCounted: ['기억', '관계', '사기'],
};

export interface TextCtx { player: string; relation: 'sibling' | 'friend' }

export function fillText(text: string, ctx: TextCtx): string {
  return text
    .split('{player}').join(ctx.player)
    .split('{relWord}').join(ctx.relation === 'sibling' ? '동생' : '오랜 친구')
    .split('{relBecause}').join(ctx.relation === 'sibling' ? '동생이라서' : '친구라서');
}
