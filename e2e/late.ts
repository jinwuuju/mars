import { expect, type Page } from '@playwright/test';
import { answerFollowups, choose, drain, expectCanWalk, interact, modalButton, sacrifice, skipCard } from './flow';
import './support';

export interface LateOpts {
  plus: boolean;          // 모든 포크에서 '+' 쪽(계획·새 방식·함께·직접 확인)을 고를지
  info: boolean;          // 정보 탭을 열지
  adjust: boolean;        // 관점 요청을 들어줄지
  video: 'together' | 'archive' | 'alone';
  ark: 'supply' | 'rendezvous' | 'relay';
  site: 'alpha' | 'beta' | 'gamma';
  gust: 'pod' | 'divert';
  power: 'even' | 'oxygen';
  target: 'ice' | 'ilkkun' | 'third';
  eva: boolean;
  method: 'expert' | 'consensus' | 'roles';
  vote: 'accept' | 'conditional' | 'notNow';
  answer: 0 | 1 | 2;
  name: string;
  shots?: string;
  /** 목록 창(작업표·점검표·서명·회상 등)을 버튼 대신 Esc로 닫는다: Esc로 닫아도 흐름이 멈추지 않는지 */
  esc?: boolean;
  /** 희생 선택 방식(C5·C6·C7) */
  sac?: 'first' | 'lot' | 'me';
  /** C5 작별 대사 도중 새로고침(작별 장면이 다시 나오는지) */
  sacReload?: boolean;
  /** 중간에 끼어들 지점(새로고침 등) */
  hooks?: { afterArk?: (p: Page) => Promise<void>; afterGust?: (p: Page) => Promise<void>; afterPurify?: (p: Page) => Promise<void>; afterDoor?: (p: Page) => Promise<void> };
}

const pick = (o: LateOpts, plus: string, minus: string): string => (o.plus ? plus : minus);

async function request(page: Page, o: LateOpts, tLabel: string, adjust: string, keep: string): Promise<string> {
  await drain(page);
  const panel = page.locator('.perspective');
  await panel.waitFor();
  const who = ((await panel.locator('.request b').textContent()) ?? '').trim();
  if (o.info) await panel.getByRole('button', { name: tLabel }).click();
  await panel.getByRole('button', { name: o.adjust ? adjust : keep }).click();
  return who;
}

async function tab(page: Page, opener: string, label: string): Promise<void> {
  await page.locator('#modal .modal-card').last().getByRole('button', { name: opener }).click();
  await page.locator('.tab-panel').getByRole('button', { name: label }).click();
  await modalButton(page, '닫기');
}

async function scale(page: Page, id: string): Promise<string[]> {
  await drain(page);
  const sc = page.locator('.scale');
  await sc.waitFor();
  const voices = (await sc.locator('.voice b').allTextContents()).map((t) => t.replace(/^(지지|우려) · /, '').trim());
  await sc.locator(`.scale-card[data-id='${id}']`).getByRole('button', { name: '이 길로' }).click();
  await modalButton(page, '이 길로 확정');
  return voices;
}

async function assist(page: Page): Promise<void> {
  await drain(page);
  await modalButton(page, '녹녹이에게 맡기기');
}

/** C4~C8 + 결과지. 승선자 판단에 쓰도록 요청자·저울 목소리 이름을 모아 돌려준다. */
export async function playLate(page: Page, o: LateOpts): Promise<{ names: string[] }> {
  const names: string[] = [];
  const shot = async (n: string): Promise<void> => { if (o.shots) await page.screenshot({ path: `${o.shots}-${n}.png` }); };
  const closeList = async (label: string): Promise<void> => {
    if (!o.esc) { await modalButton(page, label); return; }
    await page.locator('#modal .modal-card').last().getByRole('button', { name: label, exact: true }).waitFor();
    await page.keyboard.press('Escape');
  };
  // C4 (생활 모듈 탐색)
  await skipCard(page, 'c4');
  await drain(page);
  await expectCanWalk(page, 'C4');
  if (o.info) { await interact(page, 'window'); await drain(page); }
  await interact(page, 'panel');
  await choose(page, pick(o, '작업표 먼저', '하면서 정하기'));
  if (o.plus) await closeList('이대로 시작');
  await choose(page, pick(o, '새 경로 시험', '검증된 표준 우회로'));
  await drain(page);
  await page.locator('.pipes').waitFor();
  if (o.info) await tab(page, '장치 기록 보기', '장치 이력 로그');
  if (o.plus) await page.locator('.pipe.path:not([disabled])').first().click();
  await shot('c4-pipes');
  await modalButton(page, '녹녹이에게 맡기기');
  await choose(page, pick(o, '수동으로 한 번 더 확인', '자동 압력 확인 결과 수용'));
  if (o.plus) await closeList('확인했어요');
  names.push(await request(page, o, '작업 부하 수치 보기', '요청대로 교대 바꾸기', '지금 교대 유지하고 이유 설명하기'));
  await drain(page);
  await interact(page, 'galley');
  await choose(page, pick(o, '동료들과 즉석 카드놀이', '혼자 관측창에서 별 스케치'));
  await drain(page);
  await interact(page, 'comms');
  await choose(page, { together: '모두 함께 재생', archive: '기록 보관해 두고 나중에', alone: '각자 혼자 보기' }[o.video]);
  await choose(page, '담에게 말 걸기');
  names.push(...(await scale(page, o.ark)));
  if (o.hooks?.afterArk) await o.hooks.afterArk(page);
  await drain(page);
  await interact(page, 'dam');
  // C5 (착륙선 → 우주복 점검 → 화성 표면 도보)
  await drain(page);
  await skipCard(page, 'c5');
  await drain(page);
  await page.locator('.landing').waitFor();
  await page.locator('.site-mk').nth(1).click();
  if (o.info) { await modalButton(page, '자료 2탭 열기'); await page.locator('.tab-panel').getByRole('button', { name: '고도·경사 원자료' }).click(); await modalButton(page, '닫기'); }
  await shot('c5-map');
  await modalButton(page, '후보 비교 끝');
  await choose(page, pick(o, '강하 단계 계획 먼저', '상황 보며 조정'));
  if (o.plus) await closeList('이대로');
  await choose(page, pick(o, '맞춤 프로파일 시험', '표준 프로파일'));
  names.push(...(await scale(page, o.site)));
  await choose(page, pick(o, '한 번 더 재검토', '체크 결과로 바로 강하'));
  if (o.plus) await closeList('확인했어요');
  await drain(page);
  await page.locator('.descent').waitFor();
  await shot('c5-descent');
  await modalButton(page, '녹녹이에게 맡기기');
  await choose(page, o.gust === 'pod' ? '화물 포드 분리' : '대체 지점으로 선회');
  if (o.hooks?.afterGust) await o.hooks.afterGust(page);
  await drain(page);
  await page.locator('.suit').waitFor();
  for (const part of ['헬멧 잠금', '장갑 밀폐', '산소 탱크 연결', '무전 확인']) await page.locator('.suit').getByRole('button', { name: part }).click();
  await modalButton(page, '에어록 열기');
  await drain(page);
  await sacrifice(page, o.sac, o.sacReload);
  await expectCanWalk(page, 'C5 화성 표면');
  await shot('c5-eva');
  if (o.info) { await interact(page, 'dam'); await drain(page); }
  await interact(page, 'cp1');
  await choose(page, pick(o, '팀 채널로 풍경 이야기', '개인 기록에 혼자 메모'));
  await drain(page);
  await interact(page, 'cp2');
  await drain(page);
  await interact(page, 'cp3');
  names.push(await request(page, o, '이동 동선 수치 보기', '요청대로 대열 바꾸기', '지금 대열 유지하고 이유 설명하기'));
  await drain(page);
  await interact(page, 'cp4');
  await drain(page);
  await interact(page, 'airlock');
  // C6 (제로돔 다섯 구역)
  await drain(page);
  await skipCard(page, 'c6');
  await drain(page);
  await expectCanWalk(page, 'C6');
  if (o.info) { await interact(page, 'vault'); await drain(page); }
  await interact(page, 'mirror');
  await choose(page, pick(o, '역할표 먼저', '상황 보며 배치'));
  if (o.plus) await closeList('이대로');
  await choose(page, pick(o, '동료에게 설명하며 함께 작업', '혼자 패널 작업'));
  await drain(page);
  await page.locator('.pick').waitFor();
  if (o.info) await tab(page, '계기 자료', '계기 원수치');
  if (o.plus) {
    await page.locator('.sys', { hasText: '전력' }).click();
    await modalButton(page, '이 계통이 원인');
    await page.locator('.sys', { hasText: '산소 생산' }).click();
    await modalButton(page, '이 계통이 원인');
  } else await modalButton(page, '녹녹이에게 맡기기');
  names.push(await request(page, o, '전력·작업 수치 보기', '요청대로 순번 바꾸기', '지금 순번 유지하고 이유 설명하기'));
  await drain(page);
  await page.locator('.tokens').waitFor();
  if (o.power === 'even') await modalButton(page, '고르게 나누기');
  else {
    for (const [label, n] of [['산소 재시동 가속', 3], ['종자 냉각고', 1], ['지구 기록 서버', 1], ['거주 난방', 1]] as [string, number][]) {
      for (let i = 0; i < n; i += 1) await page.getByRole('button', { name: `${label} 토큰 더하기` }).click();
    }
  }
  await shot('c6-power');
  await modalButton(page, '이 배분으로 확정');
  await drain(page);
  await interact(page, 'o2');
  await sacrifice(page, o.sac);
  await choose(page, pick(o, '대안 시퀀스 시뮬레이션', '매뉴얼 표준 시퀀스'));
  await drain(page);
  await page.locator('.order-puzzle').waitFor();
  const seq = o.plus ? ['스택 예열', '저압 정화', '저출력 전해 시작', '출력 확인'] : ['정화(퍼지)', '전해 스택 예열', '전해 시작', '출력 확인'];
  // 쉬운 퍼즐: 일부러 한 번 틀리면 처음부터 다시가 아니라 다음 정답이 반짝인다
  await page.locator('.order-puzzle .choices button', { hasText: seq[1] }).click();
  await expect(page.locator('.order-puzzle .choices button.nudge')).toHaveText(seq[0]);
  await expect(page.locator('#modal .assist-note').last()).toContainText('녹녹이에게 맡기기');
  for (const s of seq) await page.locator('.order-puzzle .choices button', { hasText: s }).click();
  await choose(page, pick(o, '수동으로 다시 확인', 'MIRROR 자동 점검 수용'));
  if (o.plus) await closeList('확인했어요');
  await drain(page);
  await interact(page, 'mirror');
  // C7 (로버 격납고)
  await drain(page);
  await skipCard(page, 'c7');
  await drain(page);
  await expectCanWalk(page, 'C7');
  if (o.info) { await interact(page, 'bench'); await drain(page); }
  await interact(page, 'terminal');
  await page.locator('.layer-map').waitFor();
  await page.locator('.layer-map').getByRole('button', { name: '경사' }).click();
  if (o.info) { await modalButton(page, '자료 2탭 열기'); await page.locator('.tab-panel').getByRole('button', { name: '레이어 원값' }).click(); await modalButton(page, '닫기'); }
  await shot('c7-map');
  await modalButton(page, '목적지 정하러 가기');
  names.push(...(await scale(page, o.target)));
  await choose(page, o.eva ? '사람이 동행하기' : '로버만 보내기');
  await drain(page);
  await interact(page, 'rover');
  await choose(page, pick(o, '탐사 계획서 먼저', '가면서 판단'));
  if (o.plus) await closeList('이대로');
  await choose(page, pick(o, '직접 새 경로 설계', 'MIRROR 표준 경로'));
  await choose(page, pick(o, '동료와 무전으로 상의하며 운전', '혼자 조용히 운전'));
  await drain(page);
  await page.locator('.route').waitFor();
  await shot('c7-route');
  await modalButton(page, '녹녹이에게 맡기기');
  await choose(page, pick(o, '수동으로 한 번 더 확인', '자동 경사 체크 수용'));
  if (o.plus) await closeList('확인했어요');
  if (o.target !== 'ilkkun') await assist(page);
  await drain(page);
  await sacrifice(page, o.sac);
  await interact(page, 'purifier');
  await drain(page);
  await page.locator('.order-puzzle').waitFor();
  await modalButton(page, '녹녹이에게 맡기기');
  if (o.hooks?.afterPurify) await o.hooks.afterPurify(page);
  names.push(await request(page, o, '물 수지 수치 보기', '요청대로 배분 조정하기', '원안 유지하고 이유 설명하기'));
  await drain(page);
  await interact(page, 'airlock');
  // C8 (첫 저녁 공용실)
  await drain(page);
  await skipCard(page, 'c8');
  await drain(page);
  await expectCanWalk(page, 'C8');
  if (o.info) { await interact(page, 'sprouts'); await drain(page); }
  await interact(page, 'board');
  await choose(page, o.info ? '자원 장부 열어 보기' : '바로 시작하기');
  if (o.info) { await page.locator('.tab-panel').getByRole('button', { name: '자원 실측 장부' }).click(); await modalButton(page, '닫기'); }
  await choose(page, pick(o, '초안 여러 개 나란히 비교', '기본 템플릿 하나로 시작'));
  await closeList(o.plus ? '비교 끝' : '이걸로 시작');
  await choose(page, pick(o, '전체 표 먼저 짜기', '한 칸씩 채우며 보기'));
  await page.locator('.shift').waitFor();
  await modalButton(page, '녹녹이에게 맡기기');
  await modalButton(page, '근무표 확정');
  await choose(page, pick(o, '직접 재점검', 'MIRROR 자동 검증 수용'));
  if (o.plus) await closeList('확인했어요');
  await choose(page, pick(o, '동료에게 직접 의견 묻기', '혼자 초안 다듬기'));
  names.push(await request(page, o, '자원 제약 수치 보기', '요청대로 진행 방식 조정하기', '기존 진행 유지하고 이유 설명하기'));
  await drain(page);
  await interact(page, 'table');
  names.push(...(await scale(page, o.method)));
  await choose(page, { accept: '받아들인다', conditional: '조건부로 받는다', notNow: '지금은 받지 않는다' }[o.vote]);
  if (o.hooks?.afterDoor) await o.hooks.afterDoor(page);
  await drain(page);
  const answers = ['남은 사람을 지키려고', '사라진 사람을 기억하려고', '언젠가 여기서도 평범한 아침을'];
  await choose(page, answers[o.answer]);
  const input = page.locator('#modal input.input');
  await input.waitFor();
  await input.fill(o.name);
  await modalButton(page, '이 이름으로');
  await closeList('서명하기');
  await drain(page, 600);
  await shot('c8-ending');
  // 마지막 반전: MIRROR 정밀 로그 → 진우주 등장(정답 없는 선택은 drain이 넘긴다)
  await closeList('...설마');
  await drain(page);
  await closeList('다음');
  await closeList('다음');
  await drain(page, 600);
  await closeList('내가 보여준 선택의 패턴 보기');
  await answerFollowups(page);
  await page.locator('#screen .paper-card.results').waitFor();
  // 결과지에는 근거 부족(?)·동률(X) 글자가 남지 않는다(분석을 켠 판, 위치 편향이 아닐 때)
  const rep = await page.evaluate(() => window.__mle.report());
  const ms = await page.evaluate(() => window.__mle.measure());
  if (ms.analysisOptIn && !rep.quality.positionBias) expect(rep.type.strict, '결과 글자에 ?·X가 없다').not.toMatch(/[?X]/);
  return { names };
}
