import { expect, type Page } from '@playwright/test';
import type { CandidateId } from '../src/shared/ids';
import { FOLLOWUPS } from '../src/analytics/followup';
import './support';

export async function boot(page: Page, reduced = true): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  (page as unknown as { __errors: string[] }).__errors = errors;
  await page.addInitScript((r) => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.clear();
      localStorage.setItem('mirror:last-earth:settings:v2', JSON.stringify({ textScale: 1, reducedMotion: r, intensity: 1, puzzles: 'manual' }));
      sessionStorage.setItem('e2e-init', '1');
    }
  }, reduced);
  await page.goto('/?e2e=1');
  await expect(page.getByRole('button', { name: '마지막 배에 타기' })).toBeVisible();
  return errors;
}

/** '다음'을 누르며 진행하다가 선택지가 나오거나 settleMs 동안 아무 일도 없으면 멈춘다. */
export async function drain(page: Page, settleMs = 300): Promise<void> {
  const deadline = Date.now() + 40_000;
  let idle = 0;
  while (Date.now() < deadline) {
    const next = page.locator('#dialogue .dlg-next');
    if (await next.isVisible().catch(() => false)) { await next.click(); idle = 0; continue; }
    // 생각의 시간(정답 없는 질문)은 자동 테스트에서 첫 답으로 넘긴다
    const reflectBtn = page.locator('#dialogue .btn.choice.reflect, #dialogue .btn.choice.free');
    if (await reflectBtn.count()) { await reflectBtn.first().click(); idle = 0; continue; }
    if (await page.locator('#dialogue .btn.choice').count()) return;
    if (idle >= settleMs) return;
    await page.waitForTimeout(50);
    idle += 50;
  }
  throw new Error('drain timeout');
}

export async function choose(page: Page, text: string): Promise<void> {
  await drain(page);
  const b = page.locator('#dialogue .btn.choice', { hasText: text }).first();
  await b.waitFor();
  await b.click();
}

export async function idle(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector('#dialogue.show') && !document.querySelector('#modal.show') && window.__mle?.ready());
}

export async function interact(page: Page, id: string): Promise<void> {
  await idle(page);
  await page.evaluate((i) => window.__mle.interact(i), id);
}

const FOLLOWUP_PLUS = new Set(Object.values(FOLLOWUPS).flat().map((q) => q.plus));

/** 결과지 직전 추가 질문에 답한다. 버튼 위치가 판마다 섞여도 같은 답이 되도록 항상 + 쪽 문구를 고른다. 답한 수를 돌려준다 */
export async function answerFollowups(page: Page): Promise<number> {
  const deadline = Date.now() + 30_000;
  let n = 0;
  while (Date.now() < deadline) {
    if (await page.locator('#screen .paper-card.results').count()) return n;
    const choices = page.locator('.followup-modal .fu-choice');
    if (await choices.count()) {
      const texts = (await choices.allTextContents()).map((t) => t.trim());
      expect(texts.filter((t) => FOLLOWUP_PLUS.has(t)), '추가 질문에는 + 쪽 답이 정확히 하나').toHaveLength(1);
      await choices.nth(texts.findIndex((t) => FOLLOWUP_PLUS.has(t))).click();
      n += 1;
      continue;
    }
    await page.waitForTimeout(100);
  }
  throw new Error('결과지가 열리지 않았다');
}

export async function modalButton(page: Page, name: string): Promise<void> {
  await page.locator('#modal .modal-card').last().getByRole('button', { name, exact: true }).first().click();
}

export async function startRun(page: Page, analysis = true): Promise<void> {
  await page.getByRole('button', { name: '마지막 배에 타기' }).click();
  await page.getByRole('button', { name: analysis ? '행동 분석 켜고 시작' : '분석 없이 플레이' }).click();
  await page.getByRole('button', { name: '발사장으로' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.waitForFunction(() => window.__mle?.ready());
  await drain(page);
}

export async function doTutorial(page: Page): Promise<void> {
  await interact(page, 't-crate');
  await page.getByRole('button', { name: '적혀 있는 것' }).click();
  await modalButton(page, '닫기');
  await interact(page, 't-locker');
  await choose(page, '위 칸부터');
  await drain(page);
  await interact(page, 't-citizen');
  await choose(page, '인사하기');
  await drain(page, 700);
  await page.waitForFunction(() => window.__mle.state().flags.c1_intro === true);
  await expectCanWalk(page, 'C1', false);
}

export async function openBoard(page: Page, mode: 'plan' | 'people'): Promise<void> {
  await interact(page, 'board');
  await choose(page, mode === 'plan' ? '기준표 먼저 만들기' : '사람부터 만나 보며 정하기');
  if (mode === 'plan') {
    await page.locator('#modal .chips').getByRole('button', { name: '정비' }).click();
    await modalButton(page, '완료');
  } else {
    await drain(page);
  }
  await expect(page.locator('.roster')).toBeVisible();
}

export async function seatAndConfirm(page: Page, roster: CandidateId[], variant: 'try' | 'review'): Promise<void> {
  for (const id of roster) await page.locator(`.cand-card[data-id='${id}']`).getByRole('button', { name: '앉히기' }).click();
  await choose(page, variant === 'try' ? '다른 조합도 시험해 보기' : '이 편성으로 검토 단계로');
  await drain(page, 700);
  await page.getByRole('button', { name: '명단 확정' }).click();
  await drain(page);
  await modalButton(page, '확정');
}

/** C1 작별 → 좌석 점검 → 좌석 요청 → 출발 → C2 제목 카드 직전까지. 좌석 요청자 이름을 돌려준다. */
export async function finishC1(page: Page, check: 'go' | 'check', info: 'T' | 'F' | null, decision: 'adjust' | 'keep', shot?: string): Promise<string> {
  await drain(page, 900);
  await modalButton(page, '계속');
  await choose(page, check === 'go' ? '자동 점검 결과로 바로 진행' : '벨트 상태 내가 한 번 더 확인');
  if (check === 'check') await modalButton(page, '확인했어요');
  else await drain(page);
  const panel = page.locator('.perspective');
  await panel.waitFor();
  const requester = (await panel.locator('.request b').textContent()) ?? '';
  if (info) await panel.getByRole('button', { name: info === 'T' ? '좌석 균형 수치 보기' : '승무원 요청 메모 보기' }).click();
  if (shot) await page.screenshot({ path: shot });
  await panel.getByRole('button', { name: decision === 'adjust' ? '요청대로 좌석 조정하기' : '기본 배치 유지하고 이유 설명하기' }).click();
  await drain(page, 1500);
  return requester.trim();
}

/** 장 제목 카드를 넘긴다. 움직임 줄이기 모드에서는 카드가 스스로 넘어갈 수 있어서, 다음 대사가 먼저 보이면 그대로 진행한다. */
export async function skipCard(page: Page, chapter?: string): Promise<void> {
  const card = page.locator('#screen .chapter-card');
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await card.count()) {
      await card.click({ timeout: 1500 }).catch(() => undefined);
      await card.waitFor({ state: 'detached', timeout: 5000 }).catch(() => undefined);
      return;
    }
    if (await page.locator('#dialogue.show').count()) return;
    if (chapter && (await page.evaluate((c) => window.__mle.state().fsm.startsWith(c) && window.__mle.ready(), chapter))) return;
    await page.waitForTimeout(50);
  }
  const errs = (page as unknown as { __errors?: string[] }).__errors ?? [];
  const st = await page.evaluate(() => ({ fsm: window.__mle.state().fsm, flags: Object.keys(window.__mle.state().flags).slice(-8) })).catch(() => null);
  throw new Error(`chapter card timeout · ${JSON.stringify(st)} · ${errs.join(' | ')}`);
}

export interface C2Opts {
  jp: 'plan' | 'flow';
  pack: 'guide' | 'own';
  items: [string, 'L' | 'R'][];
  details?: string;
  talk: boolean;
  strapInfo: 'T' | 'F' | null;
  strap: 'adjust' | 'keep';
  hold: 'go' | 'check';
  shot?: string;
  /** 이륙 전 고정 점검(수동)의 점검표가 떠 있을 때 새로고침한다(소프트락 회귀) */
  reloadAtHold?: boolean;
  /** 인트로 뒤, 컨베이어로 가기 전에 할 탐색 */
  explore?: (page: Page) => Promise<void>;
}

export async function startC2(page: Page, o: Pick<C2Opts, 'jp' | 'pack' | 'explore'>): Promise<void> {
  await skipCard(page, 'c2');
  await drain(page);
  // 지금 할 일 한 줄이 항상 보이고, 지금 할 항목이 목록에서 강조된다
  await expect(page.locator('#hud .hud-now')).toContainText('컨베이어에서 짐 고르기');
  await expect(page.locator('#hud .hud-quest li.now')).toHaveCount(1);
  await expectCanWalk(page, 'C2');
  if (o.explore) await o.explore(page);
  await interact(page, 'conveyor');
  await choose(page, o.jp === 'plan' ? '목록 먼저 정하고 담기' : '담아 보며 정하기');
  if (o.jp === 'plan') {
    await page.locator('#modal .chips button').first().click();
    await modalButton(page, '완료');
  }
  await choose(page, o.pack === 'guide' ? '녹녹이 표준 적재 가이드 따르기' : '빈 칸에서 직접 구성');
  await drain(page);
  await page.locator('.cargo').waitFor();
}

export async function pack(page: Page, items: [string, 'L' | 'R'][]): Promise<void> {
  const board = page.locator('.cargo');
  for (const [id, side] of items) await board.locator(`.cargo-item[data-id='${id}']`).getByRole('button', { name: side === 'L' ? '왼쪽 칸' : '오른쪽 칸' }).click();
}

export async function finishC2(page: Page, o: Omit<C2Opts, 'jp' | 'pack' | 'items'>): Promise<string> {
  const board = page.locator('.cargo');
  if (o.details) {
    await board.locator(`.cargo-item[data-id='${o.details}']`).getByRole('button', { name: '자세히' }).click();
    await page.locator('.tab-panel').getByRole('button', { name: '실측 정보' }).click();
    await modalButton(page, '닫기');
  }
  if (o.shot) await page.screenshot({ path: o.shot });
  await page.getByRole('button', { name: '봉인 준비' }).click();
  await drain(page);
  await interact(page, 'console');
  await drain(page);
  await modalButton(page, '봉인');
  await choose(page, o.talk ? '동료에게 짐 이야기 묻기' : '혼자 정리하며 생각하기');
  await drain(page);
  const panel = page.locator('.perspective');
  await panel.waitFor();
  const who = (await panel.locator('.request b').textContent()) ?? '';
  if (o.strapInfo) await panel.getByRole('button', { name: o.strapInfo === 'T' ? '고정끈 장력 수치 보기' : '동료 요청 메모 보기' }).click();
  await panel.getByRole('button', { name: o.strap === 'adjust' ? '요청대로 한 번 더 감기' : '지금 상태 유지하고 이유 설명하기' }).click();
  await drain(page);
  await interact(page, 'console');
  await choose(page, o.hold === 'go' ? '자동 확인 결과로 바로 이륙 준비' : '수동으로 다시 점검');
  if (o.hold === 'check') {
    if (o.reloadAtHold) {
      await page.locator('#modal .modal-card').last().getByRole('button', { name: '확인했어요', exact: true }).waitFor();
      await page.waitForTimeout(400);
      await page.reload();
      await page.getByRole('button', { name: '이어하기' }).click();
      await page.waitForFunction(() => window.__mle?.ready());
    } else await modalButton(page, '확인했어요');
  }
  await drain(page);
  await interact(page, 'hatch');
  return who.trim();
}

export async function doC2(page: Page, o: C2Opts): Promise<string> {
  await startC2(page, o);
  await pack(page, o.items);
  return finishC2(page, o);
}

export interface C3Opts {
  jp: 'plan' | 'flow';
  variant: 'standard' | 'cross';
  comm: boolean;
  panelInfo: 'T' | 'F' | null;
  panel: 'adjust' | 'keep';
  sensorInfo?: 'A' | 'B' | 'C';
  auto: 'accept' | 'manual';
  fix: 'boram' | 'spare' | 'recal';
  shot?: string;
  explore?: (page: Page) => Promise<void>;
  /** 밸브 진단을 '녹녹이에게 맡기기'로 끝낸다 */
  assist?: boolean;
}

export async function diagnoseC3(page: Page, o: C3Opts): Promise<{ panelRequester: string }> {
  await skipCard(page, 'c3');
  await drain(page);
  await expectCanWalk(page, 'C3 객실');
  if (o.explore) await o.explore(page);
  await interact(page, 'seat');
  await choose(page, o.jp === 'plan' ? '진단 순서표 먼저' : '연결하며 보기');
  await choose(page, o.variant === 'cross' ? '교차 검증 새 방식' : '표준 3단계 점검');
  await choose(page, o.comm ? '승무원과 교신하며 진단' : '헤드셋 집중 모드로 혼자');
  const panel = page.locator('.perspective');
  await panel.waitFor();
  const panelRequester = ((await panel.locator('.request b').textContent()) ?? '').trim();
  if (o.panelInfo) await panel.getByRole('button', { name: o.panelInfo === 'T' ? '작업 부하 수치 보기' : '승무원 상태 메모 보기' }).click();
  await panel.getByRole('button', { name: o.panel === 'adjust' ? '요청대로 재배치하기' : '현재 배치 유지하고 이유 설명하기' }).click();
  await drain(page);
  const w = page.locator('.wiring');
  await w.waitFor();
  await expect(page.locator('#modal .assist-note').last(), '녹녹이에게 맡기기 안내').toContainText('[녹녹이에게 맡기기]');
  if (o.sensorInfo) {
    await w.locator('.wire-row', { hasText: `센서 ${o.sensorInfo}` }).getByRole('button', { name: '정보' }).click();
    await page.locator('.tab-panel').getByRole('button', { name: '센서 원자료' }).click();
    await modalButton(page, '닫기');
  }
  if (o.assist) {
    await expect(w.locator('.wire-next')).toContainText('지금:');
    await w.getByRole('button', { name: '녹녹이에게 맡기기' }).click();
    await expect(w.locator('.wire-next')).toContainText('진단 완료');
  } else {
    if (o.jp === 'plan') for (let i = 0; i < 3; i += 1) await w.locator('.order button:not([disabled])').first().click();
    for (let i = 0; i < 3; i += 1) await w.locator('.wire-row').nth(i).getByRole('button', { name: `포트 ${i + 1}` }).click();
    if (o.jp === 'plan') for (let i = 0; i < 3; i += 1) await w.getByRole('button', { name: '다음 테스트' }).click();
    else {
      for (let i = 0; i < 3; i += 1) await w.locator('.row button:not([disabled])', { hasText: '실행' }).first().click();
      for (let i = 0; i < 3; i += 1) await w.locator('.result button:not([disabled])', { hasText: '결과 메모' }).first().click();
    }
  }
  if (o.shot) await page.screenshot({ path: o.shot });
  await w.getByRole('button', { name: '진단 완료' }).click();
  await choose(page, o.auto === 'accept' ? '자동 진단 결과 그대로 수용' : '수동 재측정');
  await drain(page);
  await page.locator('.scale').waitFor();
  return { panelRequester };
}

export async function scaleAndLaunch(page: Page, fix: C3Opts['fix'], shot?: string): Promise<string[]> {
  const sc = page.locator('.scale');
  const voices = (await sc.locator('.voice b').allTextContents()).map((t) => t.replace(/^(지지|우려) · /, '').trim());
  if (shot) await page.screenshot({ path: shot });
  await sc.locator(`.scale-card[data-id='${fix}']`).getByRole('button', { name: '이 길로' }).click();
  await modalButton(page, '이 길로 확정');
  await drain(page, 500);
  if (await page.locator('.jettison').count()) {
    const items = page.locator('.jettison .jet-item');
    const n = await items.count();
    for (let i = 0; i < n; i += 1) {
      if (await page.locator('#modal .modal-foot button', { hasText: '투하' }).isEnabled()) break;
      await items.nth(i).click();
    }
    await modalButton(page, '투하');
  }
  await drain(page, 500);
  await page.getByRole('button', { name: '녹녹이에게 맡기기' }).click();
  const skip = page.locator('.launch-skip');
  await skip.waitFor({ timeout: 10_000 });
  await skip.click();
  await drain(page, 1500);
  return voices;
}

/**
 * 실제 입력으로 걷는지 확인한다: 방향키를 잠깐 눌러 위치가 바뀌는지, 인물을 클릭하면 그쪽으로 걸어가는지(닿으면 대화).
 * 다른 단계는 __mle.interact로 지점을 바로 부르기 때문에, 이동 입력은 여기서만 검사한다.
 * (2026-10-25: C1 컷신 상태가 남아 C2부터 걷지 못하던 버그를 자동 테스트가 못 잡았던 공백)
 */
export async function expectCanWalk(page: Page, label: string, click = true): Promise<void> {
  await idle(page);
  const pos = (): Promise<{ x: number; y: number } | null> => page.evaluate(() => window.__mle.screenOf('player'));
  expect(await pos(), `${label}: 플레이어가 걷는 지도 위에 있다`).not.toBeNull();
  let moved = false;
  for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
    const a = await pos();
    await page.keyboard.down(key);
    await page.waitForTimeout(250);
    await page.keyboard.up(key);
    await page.waitForTimeout(60);
    const b = await pos();
    if (a && b && Math.hypot(b.x - a.x, b.y - a.y) > 3) { moved = true; break; }
  }
  expect(moved, `${label}: 방향키로 걷는다`).toBe(true);
  if (!click) return;
  const box = await page.locator('#game canvas').boundingBox();
  expect(box, `${label}: 캔버스`).not.toBeNull();
  if (!box) return;
  // 클릭할 인물: 화면 안에 있고 그 위에 다른 화면 요소(HUD 등)가 덮여 있지 않은 첫 사람(담 우선)
  const ids = ['dam', ...(await page.evaluate(() => window.__mle.actors())).filter((x) => x !== 'dam')];
  let point: { x: number; y: number } | null = null;
  for (const id of ids) {
    const t = await page.evaluate((x) => window.__mle.screenOf(x), id);
    if (!t || t.x < 8 || t.y < 8 || t.x > box.width - 8 || t.y > box.height - 8) continue;
    const p = { x: box.x + t.x, y: box.y + t.y };
    if (await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', [p.x, p.y] as const)) { point = p; break; }
  }
  expect(point, `${label}: 클릭할 인물이 화면에 보인다`).not.toBeNull();
  if (!point) return;
  let last = await pos();
  let total = 0;
  let still = 0;
  await page.mouse.click(point.x, point.y);
  for (let i = 0; i < 80; i += 1) {
    await page.waitForTimeout(100);
    if (await page.locator('#dialogue.show').count()) break;
    const cur = await pos();
    const d = cur && last ? Math.hypot(cur.x - last.x, cur.y - last.y) : 0;
    total += d;
    still = d < 0.5 ? still + 1 : 0;
    last = cur;
    if (total > 6 && still >= 4) break;
  }
  const talked = (await page.locator('#dialogue.show').count()) > 0;
  expect(total > 6 || talked, `${label}: 클릭한 곳으로 걷는다`).toBe(true);
  await drain(page);
  await idle(page);
}

/** 희생 선택(C5·C6·C7): first = 첫 카드의 사람, lot = 제비뽑기, me = 내가 가겠다. 떠난 사람 id를 돌려준다 */
export async function sacrifice(page: Page, how: 'first' | 'lot' | 'me' = 'first', reloadMid = false): Promise<string> {
  await drain(page);
  const panel = page.locator('.sacrifice');
  await panel.waitFor();
  const before = await page.evaluate(() => ({ ...window.__mle.state().flags }));
  if (how === 'first') await panel.locator('.sac-card').first().getByRole('button', { name: '보낸다' }).click();
  else await panel.getByRole('button', { name: how === 'lot' ? '제비뽑기' : '내가 가겠다' }).click();
  await modalButton(page, '보낸다');
  await page.locator('#dialogue .dlg-next').waitFor();
  await expect(page.locator('#dialogue .dlg-skip'), '작별 장면에는 대화 넘기기가 없다').toHaveCount(0);
  if (reloadMid) {
    // 작별 대사 도중 새로고침: 예전에는 작별 없이 사람이 사라졌다. 이제는 작별 장면을 다시 보여 줘야 한다
    await page.waitForTimeout(400);
    await page.reload();
    await page.getByRole('button', { name: '이어하기' }).click();
    await page.locator('#dialogue .dlg-next').waitFor();
  }
  // 작별 장면을 끝까지 넘기며 회상 한 줄이 나오는지 본다
  const seen: string[] = [];
  const deadline = Date.now() + 30_000;
  let idle = 0;
  while (Date.now() < deadline && idle < 600) {
    const next = page.locator('#dialogue .dlg-next');
    if (await next.isVisible().catch(() => false)) {
      seen.push(((await page.locator('#dialogue .dlg-text').textContent().catch(() => '')) ?? '').trim());
      await next.click();
      idle = 0;
      continue;
    }
    if (await page.locator('#dialogue .btn.choice').count()) break;
    await page.waitForTimeout(50);
    idle += 50;
  }
  expect(seen.some((t) => t.startsWith('회상 —')), '떠난 사람을 회상하는 줄이 나온다').toBe(true);
  await drain(page);
  const after = await page.evaluate(() => window.__mle.state().flags);
  const key = Object.keys(after).find((k) => /^lost_C[567]$/.test(k) && before[k] === undefined) ?? '';
  expect(after[`${key}_mourned`], '작별 장면을 끝까지 봤다').toBe(true);
  return String(after[key] ?? '');
}
