import { CANDIDATE_IDS, type CandidateId } from '../shared/ids';
import type { MissionState } from '../core/state';
import { iGa } from './josa';

/**
 * 희생(이야기 전용): C5·C6·C7 위기마다 남은 동료 중 한 명이 떠난다.
 * 누가 떠났는지는 이야기 플래그(lost_C5 …)로만 남고 성격 점수·자원·엔딩에는 쓰지 않는다(SCIENCE_AND_ETHICS).
 * crewIds는 '승선 명단(기록)'으로 그대로 두고, 지금 함께 있는 사람은 aliveCrew로 구한다.
 */
export const SAC_CHAPTERS = ['C5', 'C6', 'C7'] as const;
export type SacChapter = (typeof SAC_CHAPTERS)[number];

export function lostCrew(m: Pick<MissionState, 'flags'>): CandidateId[] {
  return SAC_CHAPTERS.map((c) => m.flags[`lost_${c}`]).filter((x): x is CandidateId => typeof x === 'string' && (CANDIDATE_IDS as readonly string[]).includes(x));
}

export function aliveCrew(m: Pick<MissionState, 'crewIds' | 'flags'>): CandidateId[] {
  const lost = lostCrew(m);
  return m.crewIds.filter((c) => !lost.includes(c));
}

/** 라포: 탑승 전 만남 1 + 장마다 처음 나눈 대화 1 (대화는 채점하지 않는 서사 행동이다) */
export function rapport(m: Pick<MissionState, 'met' | 'flags'>, id: CandidateId): number {
  let n = m.met.includes(id) ? 1 : 0;
  for (let c = 2; c <= 8; c += 1) if (m.flags[`talk_c${c}_${id}`] === true) n += 1;
  return n;
}

type Flags = Record<string, string | number | boolean>;

export interface SacrificeDef {
  title: string;
  /** 위기 설명. 앞 장의 선택이 이 위기를 만들었다는 인과를 먼저 보여 준다 */
  setup: (f: Flags) => { who: string; text: string }[];
  ask: string;
  after: (name: string) => string[];
}

export const SACRIFICE: Record<SacChapter, SacrificeDef> = {
  C5: {
    title: '희생 · 착륙선에 남을 사람',
    setup: (f) => [
      f.c5_gust === 'divert'
        ? { who: 'noknok', text: '큰일이에요! 돌풍을 피해 선회하며 거칠게 내려앉을 때 산소 탱크에 금이 갔어요. 게다가 선회로 돔까지 길이 1.5km 늘었어요.' }
        : { who: 'noknok', text: '큰일이에요! 돌풍 속에서 화물 포드를 떼어 낸 반동으로 착륙선이 크게 흔들렸어요. 그때 산소 탱크에 금이 갔어요.' },
      { who: 'noknok', text: '남은 산소로는 한 명이 빠져야 나머지가 돔까지 걸어갈 수 있어요.' },
      { who: 'dam', text: '한 명은 착륙선에 남아 비상 신호기를 지켜야 해. 착륙선 산소는 한 사람이 구조를 기다릴 만큼뿐이야. 구조가 올지는... 모르겠어.' },
    ],
    ask: '누가 착륙선에 남을까?',
    after: (n) => [`${iGa(n)} 착륙선 문 안쪽에서 손을 흔든다. 헬멧 너머 얼굴은 보이지 않는다.`, '비상 신호기의 빨간 불이 깜박이기 시작한다. 다시 만날 수 있을지는, 아무도 모른다.', '붉은 먼지 위로 발자국이 한 줄 줄어든 채 이어진다.'],
  },
  C6: {
    title: '희생 · 산소 모듈실에 들어갈 사람',
    setup: (f) => [
      f.c3_backup_used === true
        ? { who: 'mirror', text: '자동 밸브를 대신할 예비 밸브가 없습니다. 3장에서 우주선 누설을 막는 데 썼습니다.' }
        : { who: 'mirror', text: '예비 밸브는 있지만 16년 전 규격이라 이 모듈에 맞지 않습니다.' },
      { who: 'mirror', text: '그래서 재시동하려면 산소 모듈실 안에서 누군가 수동 밸브를 끝까지 붙잡고 있어야 합니다.' },
      { who: 'noknok', text: '재시동 순간 모듈실 기압이 무너지면서 문이 잠겨요. 안에 들어간 사람은... 나올 수 없어요.' },
    ],
    ask: '누가 산소 모듈실에 들어갈까?',
    after: (n) => [`${iGa(n)} 모듈실 문 앞에서 한 번 웃고 들어간다.`, '문이 닫힌다. 안쪽 계기에 「수동 밸브 고정」 불이 켜진다. 이제 재시동은 바깥에 남은 사람들의 몫이다.'],
  },
  C7: {
    title: '희생 · 윈치를 붙잡을 사람',
    setup: (f) => [
      f.c7_target === 'ice'
        ? { who: 'narrator', text: '얼음 지대로 가는 길은 지질 레이어가 경고한 대로 가장 가팔랐다. 돌아오는 비탈에서 로버가 미끄러진다.' }
        : f.c7_target === 'ilkkun'
          ? { who: 'narrator', text: '일꾼-3을 매단 로버는 생각보다 무겁다. 돌아오는 비탈에서 로버가 미끄러진다.' }
          : { who: 'narrator', text: '짐을 가득 싣고 돌아오는 길, 해가 지며 비탈이 얼어붙는다. 로버가 미끄러진다.' },
      { who: 'narrator', text: '바퀴 하나가 크레바스 가장자리에 걸렸다.' },
      { who: 'dam', text: '윈치를 붙잡고 버틸 사람이 하나 필요해. 버티는 사람은... 같이 못 올라와.' },
    ],
    ask: '누가 윈치를 붙잡을까?',
    after: (n) => [`${iGa(n)} 윈치 손잡이를 감아쥔다. 「가. 뒤돌아보지 말고.」`, '로버가 비탈을 빠져나온다. 무전기에서 숨소리가 한 번 들리고, 조용해진다.', `${iGa(n)} 돌아오지 못했다.`],
  },
};

/** 마지막 말: 라포가 3 이상이면 마음을 나눈 사람의 말, 아니면 짧은 말 */
export const LAST_WORDS: Record<CandidateId, { low: string; high: string }> = {
  harin: { low: '괜찮아, 괜찮아. ...내 몫까지 꿰매 줘.', high: '{player}, 원망 안 한다고 했잖아. 약속은 지킬게. 너도 꼭 살아.' },
  taeo: { low: '필터는 왼쪽부터 점검해. 그거면 돼.', high: '네가 렌치 잡는 거 봤어. 이제 네가 정비사야. ...자, 순서대로.' },
  seojin: { low: '숫자로 보면 이게 맞아. 울지 마.', high: '네 맥박, 아까부터 빨랐어. 이제 천천히 쉬어. 내가 마지막으로 처방하는 거야.' },
  woojoo: { low: '내 보온병... 녹차 식기 전에 마셔.', high: '화성 첫 녹차밭, 네가 이름 붙여 줘. ...그리고 나 잊지 마. 진짜로.' },
  dodam: { low: '기록해 줘요. 내가 여기 있었다고.', high: '내 목소리 녹음해 둔 거 있어요. 힘들 때 들어요. 노래도 들어 있어요.' },
  jio: { low: '삽이 남아 있으면 제 대신 데려가요.', high: '로봇은 겁이 없대요. 근데 저는 좀 무서워요. ...그래도 갈게요, 아마도!' },
};

/** 회상: 떠난 사람과 함께했던 순간(작별 직후 한 줄). 탑승 전 대기실과 발사장에서 실제로 있었던 일에 기대어 쓴다 */
export const MEMORY: Record<CandidateId, string> = {
  harin: '회상 — 대피소 대기실. 하린은 남의 해진 소매부터 꿰매 주고, 자기 머플러 올은 끝내 그대로 두었다.',
  taeo: '회상 — 발사장. 태오는 필터를 세 번 점검하고도 렌치를 놓지 못했다. 「순서대로 하면 돼. 너도, 나도.」',
  seojin: '회상 — 대피소 의무실. 서진은 밤새 다른 사람 맥박을 쟀고, 자기 손목은 한 번도 재지 않았다.',
  woojoo: '회상 — 출발 전날. 진우주는 마지막 녹차 티백을 세고 또 셌다. 「화성 가서 첫 잔은 같이 마시자.」',
  dodam: '회상 — 지구를 떠나던 밤. 도담은 녹음기를 켜 두고 말했다. 「오늘 우리 목소리도 기록이에요.」',
  jio: '회상 — 발사장 구석. 지오는 로봇 삽 머리를 두 번 두드렸다. 「겁나면 이렇게 하는 거예요, 아마도.」',
};

/** 남은 사람의 반응: 떠난 사람 이름을 부르며 한 줄 */
export const GRIEF: Record<CandidateId, (name: string) => string> = {
  harin: (n) => `...${n}, 바보. 끝까지 남 걱정만 하고.`,
  taeo: (n) => `${n} 몫까지 순서대로 할 거야. ...그거밖에 못 해 주네.`,
  seojin: () => '숫자로는 맞는 선택이었어. ...근데 숫자는 하나도 위로가 안 돼.',
  woojoo: (n) => `${n}... 차 한 잔도 같이 못 마셨는데.`,
  dodam: (n) => `기록할게요. ${iGa(n)} 여기 있었다는 거. 오늘 이 시간까지 전부.`,
  jio: () => '로봇은 겁이 없대요. ...사람은 있어요. 저 지금 좀 무서워요.',
};

/** 담의 반응(장마다) */
export const DAM_GRIEF: Record<SacChapter, (name: string) => string> = {
  C5: (n) => `신호기 불이 켜져 있는 한, ${n}도 우리랑 같이 가는 거야. ...걷자.`,
  C6: (n) => `${iGa(n)} 붙잡은 밸브야. 우리가 재시동을 못 하면, 그 손이 헛것이 돼.`,
  C7: (n) => `...${iGa(n)} 끝까지 버텼어. 이 얼음, 한 방울도 허투루 못 써.`,
};

/** 다음 장이 시작될 때 빈자리를 떠올리는 한 줄 */
export const REMEMBER: Record<SacChapter, (name: string) => string> = {
  C5: (n) => `착륙선 쪽 지평선에서 비상 신호기의 빨간 불이 아직 깜박인다. ${n}의 신호다.`,
  C6: (n) => `산소 모듈실 문은 닫힌 채다. 문 옆에 누군가 ${n}의 이름표를 붙여 두었다.`,
  C7: (n) => `로버 윈치에 감긴 줄이 한 뼘 짧다. ${iGa(n)} 끝까지 붙잡고 있던 줄이다. 아무도 새로 감지 않았다.`,
};
