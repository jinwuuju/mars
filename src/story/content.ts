import type { CandidateId } from '../shared/ids';

/** 케미 15쌍 (STORY_BIBLE·GAME_SYSTEMS §7). 키는 CANDIDATE_IDS 순서로 정렬한 'a+b' */
export const CHEMISTRY: Record<string, [CandidateId, string, CandidateId, string]> = {
  'harin+taeo': ['harin', '소매가 다 해졌잖아요. 이리 줘 봐요.', 'taeo', '이거 30년 입은 거야. ...살살 꿰매.'],
  'harin+seojin': ['harin', '응급 키트에 이름표 달아 줄게. 바느질로.', 'seojin', '손으로 쓴 라벨보다 훨씬 예쁘다. 숫자는 내가 쓸게.'],
  'harin+woojoo': ['woojoo', '이 머플러 실, 화분 지지대로 딱인데!', 'harin', '...한 가닥만이야. 진짜 한 가닥.'],
  'harin+dodam': ['dodam', '대피소 아이들 이름을 천에 수놓으면 오래 남을 거예요.', 'harin', '좋아. 한 글자씩, 천천히.'],
  'harin+jio': ['harin', '삽한테 조끼 하나 만들어 줄까?', 'jio', '삽이 좋아해요! ...아마도!'],
  'taeo+seojin': ['taeo', '숫자부터 보—', 'seojin', '—자. 지금 내가 먼저 말했어.'],
  'taeo+woojoo': ['woojoo', '흙도 필터야! 아니, 찻잎도 필터야!', 'taeo', '...그건 맞는 말이라 할 말이 없네.'],
  'taeo+dodam': ['dodam', '정비하는 순서를 녹음해도 될까요? 정비 구술사예요.', 'taeo', '자, 순서대로. 첫째, 겁먹지 말 것.'],
  'taeo+jio': ['jio', '로봇이 더 빨라요!', 'taeo', '렌치는 배터리가 안 닳아. ...같이 고치자.'],
  'seojin+woojoo': ['woojoo', '화성 첫 녹차 시음회! 한 잔씩!', 'seojin', '카페인 양부터 재고 마셔. 숫자부터 보자.'],
  'seojin+dodam': ['dodam', '선생님 심장 소리, 녹음해도 돼요? 살아 있다는 기록으로요.', 'seojin', '...좀 빨리 뛰고 있을 텐데. 괜찮아.'],
  'seojin+jio': ['jio', '손 베였어요. 로봇은 안 다치는데...', 'seojin', '로봇 말고 너. 이리 와.'],
  'woojoo+dodam': ['woojoo', '이 화분 이름은 \'부산\'이야. 저건 \'대전\'.', 'dodam', '기록해 둘게요. 화성 최초의 도시 이름들.'],
  'woojoo+jio': ['jio', '자동 물주기 로봇 완성! ...어?', 'woojoo', '물난리잖아! 녹차 티백 다 젖었어!'],
  'dodam+jio': ['jio', '삽에 아이들 노래를 넣었어요.', 'dodam', '...삽이 노래를 하네요. 음정은 기록하지 않을게요.'],
};

/** 탑승하지 못한 사람이 지구 영상 끝에 남긴 음성 편지 (하린 우선) */
export const LETTERS: Record<CandidateId, string> = {
  harin: '나야. 잘 도착했지? 여기는 괜찮아, 괜찮아. ...밥 꼭 챙겨 먹어.',
  taeo: '필터는 매주 봐. 사람도. ...그거면 돼.',
  seojin: '아프면 말해. 거기서도 그게 규칙이야.',
  woojoo: '녹차는 꼭 80도로 우려. 싹이 나면 이름은 내가 지은 걸로 해 줘.',
  dodam: '아이들이 인사해요. 들려요? ...들리면 됐어요.',
  jio: '삽 잘 있죠? 머리 두 번 두드리는 거 잊지 마요.',
};
export const LETTER_PRIORITY: CandidateId[] = ['harin', 'dodam', 'woojoo', 'seojin', 'taeo', 'jio'];

/** C8 문(門) 질문에 대한 입장 (승선자만 발언) */
export type Door = 'accept' | 'conditional' | 'notNow';
export const DOOR_POSITION: Record<CandidateId, { pos: Door | 'follow'; line: string }> = {
  seojin: { pos: 'accept', line: '누굴 두고 가는 게 제일 무서워.' },
  dodam: { pos: 'accept', line: '기록과 사람은 같이 살아야 해요.' },
  taeo: { pos: 'conditional', line: '숫자부터. 확장 모듈이 먼저야.' },
  woojoo: { pos: 'conditional', line: '식량 생산이 증명되면.' },
  jio: { pos: 'conditional', line: '로봇으로 돔을 넓히면 가능해요, 아마도!' },
  harin: { pos: 'follow', line: '그날 네가 고민한 걸, 그 사람들도 지금 하고 있겠지.' },
};
export const DOOR_LABEL: Record<Door, string> = { accept: '받아들인다', conditional: '조건부로 받는다(확장 모듈 완성 시)', notNow: '지금은 받지 않는다' };
