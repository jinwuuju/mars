import { test, expect } from '@playwright/test';
import { boot, diagnoseC3, doC2, doTutorial, finishC1, openBoard, seatAndConfirm, startRun } from './flow';
import './support';

/** 2026-10-26: 플레이 시간 단축 — 대화 넘기기 버튼과 녹녹이에게 맡기기 안내 */
test('빠른 진행: 대화 넘기기로 남은 줄을 한 번에 넘기고, 튜토리얼은 그대로 이어진다', async ({ page }) => {
  const errors = await boot(page);
  await page.getByRole('button', { name: '마지막 배에 타기' }).click();
  await page.getByRole('button', { name: '행동 분석 켜고 시작' }).click();
  await page.getByRole('button', { name: '발사장으로' }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.waitForFunction(() => window.__mle?.ready());
  await page.locator('#dialogue .dlg-next').waitFor();
  // 여러 줄짜리 대화: 남은 줄 수가 보이고, 누르면 그 묶음이 한 번에 끝난다
  let skipped = 0;
  for (let i = 0; i < 20; i += 1) {
    const skip = page.locator('#dialogue .dlg-skip');
    if (await skip.isVisible().catch(() => false)) {
      await expect(skip).toHaveText(/대화 넘기기 \(\d+\)/);
      await skip.click();
      skipped += 1;
      continue;
    }
    const next = page.locator('#dialogue .dlg-next');
    if (await next.isVisible().catch(() => false)) { await next.click(); continue; }
    if (await page.locator('#dialogue .btn.choice').count()) break;
    await page.waitForTimeout(150);
    if (!(await page.locator('#dialogue.show').count())) break;
  }
  expect(skipped, '대화 넘기기를 한 번 이상 눌렀다').toBeGreaterThan(0);
  await doTutorial(page);
  // 선택지 창에는 넘기기 버튼이 없다(고르는 순간은 건너뛰지 않는다)
  expect(await page.locator('#dialogue .dlg-foot.choices .dlg-skip').count()).toBe(0);
  expect(errors).toEqual([]);
});

/**
 * 2026-10-26 재점검: 기본값(퍼즐 자동 진행)에서 자료 열람 버튼이 든 퍼즐 창을 녹녹이가 바로 닫아 버리면
 * 그 장의 S/N 관찰 기회가 사라진다(시뮬레이션: S/N 근거 부족 4.6% → 42%). 이런 창은 자동으로 닫지 않아야 한다.
 */
test('자동 진행 모드: 자료 버튼이 있는 C3 진단 창은 저절로 닫히지 않고, 자료를 열면 S/N 관찰이 기록된다', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await boot(page);
  await page.evaluate(() => localStorage.setItem('mirror:last-earth:settings:v2', JSON.stringify({ textScale: 1, reducedMotion: true, intensity: 1, puzzles: 'auto' })));
  await page.reload();
  await startRun(page);
  await doTutorial(page);
  await openBoard(page, 'people');
  await seatAndConfirm(page, ['harin', 'taeo', 'seojin', 'jio'], 'review');
  await finishC1(page, 'go', null, 'keep');
  await doC2(page, { jp: 'flow', pack: 'own', items: [], talk: false, strapInfo: null, strap: 'keep', hold: 'go' });
  const before = (await page.evaluate(() => window.__mle.measure())).events.filter((a: { opportunityId: string }) => a.opportunityId === 'C3-O01').length;
  // diagnoseC3가 진단 창을 기다렸다가 센서 정보를 열고, 녹녹이에게 맡긴 뒤 진단 완료를 누른다(창이 저절로 닫히면 여기서 실패)
  await diagnoseC3(page, { jp: 'flow', variant: 'standard', comm: false, panelInfo: null, panel: 'keep', sensorInfo: 'B', auto: 'accept', fix: 'spare', assist: true });
  const after = (await page.evaluate(() => window.__mle.measure())).events.filter((a: { opportunityId: string }) => a.opportunityId === 'C3-O01').length;
  expect(after, 'C3 센서 자료 열람이 측정에 기록된다').toBeGreaterThan(before);
  expect(errors).toEqual([]);
});
