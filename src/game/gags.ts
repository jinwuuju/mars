import type { App } from './app';
import type { BunkerScene } from '../world/BunkerScene';
import type { CandidateId } from '../shared/ids';

/**
 * 재미 연출(웃음 포인트). 모두 이야기 연출일 뿐 플래그·자원·점수·엔딩에 아무것도 남기지 않는다.
 * 움직임 줄이기에서는 장면 쪽 함수가 애니메이션을 생략하고 기호만 잠깐 보여 준다.
 */

/** C1 작별: 남겨진 사람의 마지막 소동, 또는 숨겨 둔 본색. 웃음 뒤에는 원래의 진심 어린 작별이 이어진다. */
export async function farewellGag(app: App, s: BunkerScene, u: CandidateId): Promise<void> {
  const p = s.posOf(u);
  switch (u) {
    case 'harin':
      void s.spin(u, 2);
      s.emote(u, '💢');
      await app.say([
        { who: 'narrator', text: '하린이 갑자기 붉은 머플러를 올가미처럼 빙빙 돌린다.' },
        { who: 'harin', text: '나 안 내려! 이 배에 묶여서라도 갈 거야!', expr: 'worry' },
      ]);
      s.emote(u, '😅');
      await app.say([{ who: 'harin', text: '...는 농담이고. 머플러가 풀려서 그래. 진짜야.', expr: 'joy' }]);
      return;
    case 'taeo':
      s.emote(u, '‼');
      void s.hop(u, 3);
      await app.say([
        { who: 'narrator', text: '태오가 렌치를 번쩍 치켜든다.' },
        { who: 'taeo', text: '잠깐! 필터 하나만! 딱 하나만 더 점검하고 내릴게!' },
        { who: 'boram', text: '태오 씨, 그 필터 오늘만 세 번 점검하셨어요.' },
      ]);
      s.emote(u, '😤');
      await app.say([{ who: 'taeo', text: '...네 번째가 제일 중요한 법이야.' }]);
      return;
    case 'seojin':
      void s.hop(u, 3);
      s.emote(u, '🩹');
      await app.say([
        { who: 'narrator', text: '서진이 붕대를 풀어 자기 몸을 칭칭 감기 시작한다.' },
        { who: 'seojin', text: '난 사람이 아니라 의료 화물이야. 의료 화물은 실어야 하잖아.' },
        { who: 'dam', text: '...화물 태그가 없는데.' },
      ]);
      s.emote(u, '😏');
      await app.say([{ who: 'seojin', text: '쳇. 숫자로 확인하는 사람은 못 속이네.', expr: 'joy' }]);
      return;
    case 'woojoo':
      if (p) s.burst(p.x, p.y, ['🍵', '🍃']);
      void s.hop(u, 2);
      await app.say([
        { who: 'narrator', text: '진우주가 초록 보온병을 번쩍 들고 외친다.' },
        { who: 'woojoo', text: '녹차 없는 화성은 화성이 아니다! 녹차에게 자리를!', expr: 'joy' },
        { who: 'noknok', text: '저, 저는 녹차를 못 마시는데요?! 그 자리 저 주시면 안 돼요?' },
      ]);
      return;
    case 'dodam':
      if (p) s.burst(p.x, p.y, ['♪', '♫']);
      s.shake(400, 0.003);
      await app.say([
        { who: 'narrator', text: '도담이 헤드폰을 벗더니, 숨을 크게 들이마신다.' },
        { who: 'dodam', text: '아아아~ 떠나는 이들이여~ 지구의 노래를~ 잊지 마오~♪', expr: 'joy' },
        { who: 'narrator', text: '발사장 유리창이 미세하게 떨린다. 아무도 도담이 이렇게 노래를 잘하는 줄 몰랐다.' },
      ]);
      return;
    case 'jio':
      s.emote(u, '🤖');
      void s.spin(u, 1);
      await app.say([
        { who: 'narrator', text: '지오 어깨 위의 로봇 삽이 혼자 뛰어내려 탑승구 쪽으로 질주한다.' },
        { who: 'jio', text: '삽아! 너라도, 너라도 타! 넌 짐이 아니라 승객이야!', expr: 'worry' },
        { who: 'dam', text: '...0.8킬로그램. 규정상 안 돼.' },
      ]);
      s.emote(u, '😭');
      await app.say([{ who: 'jio', text: '알아요. 그냥 한번 해 보고 싶었어요.', expr: 'relief' }]);
      return;
    default:
  }
}

type Scene = BunkerScene | null | undefined;

/** 여럿이 같은 기호를 띄우며 폴짝 */
export function cheer(s: Scene, ids: readonly string[], symbol: string): void {
  if (!s) return;
  ids.forEach((id, i) => {
    if (id !== 'player' && !s.hasActor(id)) return;
    s.emote(id, symbol);
    if (id !== 'player') void s.hop(id, 1 + (i % 2));
  });
}

/** 선택 직후 짧은 리액션(이야기 연출 전용: 어디에도 기록하지 않고 결과에 반영하지 않는다) */
export function react(s: Scene, crew: readonly CandidateId[], kind: string, value: string): void {
  if (!s) return;
  const all = [...crew, 'dam'];
  const burstAt = (id: string, chars: string[], n = 10): void => { const p = s.posOf(id); if (p) s.burst(p.x, p.y, chars, n); };
  switch (`${kind}:${value}`) {
    case 'cargo:tea': cheer(s, ['woojoo'], '🍵'); break;
    case 'cargo:empty': s.emote('player', '🫥'); break;
    case 'cargo:full': cheer(s, crew, '💪'); break;
    case 'video:together': cheer(s, all, '♪'); break;
    case 'video:archive': s.emote('player', '💾'); break;
    case 'video:alone': s.emote('player', '…'); break;
    case 'ark:supply': cheer(s, crew, '📦'); burstAt('player', ['📦', '✨'], 8); break;
    case 'ark:rendezvous': s.emote('dam', '💗'); void s.spin('dam', 1); break;
    case 'ark:relay': s.emote('player', '📡'); break;
    case 'power:o2': cheer(s, all, '💨'); break;
    case 'power:seed': cheer(s, crew, '🌱'); break;
    case 'power:archive': cheer(s, crew, '📚'); break;
    case 'power:heat': cheer(s, all, '🔥'); break;
    case 'power:even': cheer(s, all, '⚖'); break;
    case 'target:ice': cheer(s, crew, '🧊'); break;
    case 'target:ilkkun': cheer(s, all, '🤖'); break;
    case 'target:third': cheer(s, crew, '🎒'); break;
    case 'target:near': cheer(s, crew, '💧'); break;
    case 'door:accept': cheer(s, all, '🎉'); burstAt('player', ['🎉', '✨', '🎊'], 12); break;
    case 'door:conditional': cheer(s, all, '🤝'); break;
    case 'door:notNow': s.emote('dam', '😶'); cheer(s, crew, '🚪'); break;
    default:
  }
}
