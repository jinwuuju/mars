import { test, expect, type Page } from '@playwright/test';
import { boot, diagnoseC3, doC2, doTutorial, drain, finishC1, modalButton, openBoard, scaleAndLaunch, seatAndConfirm, skipCard, startRun } from './flow';
import { playLate, type LateOpts } from './late';
import { expectSimMatches } from './sim';
import './support';

/** 2026-10-25 2차 점검에서 찾은 버그의 브라우저 회귀 테스트 */
const BASE: LateOpts = { plus: true, info: false, adjust: true, video: 'together', ark: 'supply', site: 'gamma', gust: 'pod', power: 'oxygen', target: 'third', eva: true, method: 'consensus', vote: 'conditional', answer: 2, name: '회귀', sacReload: true };

async function reloadAndContinue(page: Page): Promise<void> {
  await page.waitForTimeout(400); // 자동 저장(200ms 지연)을 기다린다. 새로고침 순간의 pagehide 저장도 따로 있다.
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
}

test('회귀 1: 빈 짐 · C3 재보정 대사 중 새로고침 · 모든 목록 창을 Esc로 닫기 · 빈 포드', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await boot(page);
  await startRun(page);
  await doTutorial(page);
  await openBoard(page, 'people');
  await seatAndConfirm(page, ['harin', 'taeo', 'seojin', 'jio'], 'review');
  await finishC1(page, 'go', null, 'keep');
  await doC2(page, { jp: 'flow', pack: 'own', items: [], talk: false, strapInfo: null, strap: 'keep', hold: 'go' });
  expect((await page.evaluate(() => window.__mle.state())).inventoryIds).toEqual([]);
  await diagnoseC3(page, { jp: 'plan', variant: 'cross', comm: true, panelInfo: null, panel: 'keep', auto: 'manual', fix: 'recal' });
  await page.locator(`.scale .scale-card[data-id='recal']`).getByRole('button', { name: '이 길로' }).click();
  await modalButton(page, '이 길로 확정');
  await page.locator('#dialogue .dlg-next').waitFor();
  expect((await page.evaluate(() => window.__mle.state())).resources.habitatIntegrity).toBe(60);
  await reloadAndContinue(page);
  await page.locator('#dialogue .dlg-next').waitFor();
  await drain(page, 500);
  expect(await page.locator('.scale').count(), '저울이 다시 열리지 않는다').toBe(0);
  await page.getByRole('button', { name: '녹녹이에게 맡기기' }).click();
  const skip = page.locator('.launch-skip');
  await skip.waitFor({ timeout: 10_000 });
  await skip.click();
  await drain(page, 1500);
  const mid = await page.evaluate(() => window.__mle.state());
  expect(mid.resources.habitatIntegrity, '선체 -10은 한 번만').toBe(60);
  expect(mid.flags.c3_fix).toBe('recal');
  await playLate(page, { ...BASE, esc: true });
  const st = await page.evaluate(() => window.__mle.state());
  expect(st.fsm).toBe('results');
  expect(st.flags.c5_gust).toBe('pod');
  expect(st.flags.pod_recovered, '빈 포드는 회수 대상이 아니다').not.toBe(true);
  await expectSimMatches(page);
  expect(errors).toEqual([]);
});

test('회귀 2: C4 구조 신호·C5 돌풍 직후 대사 중 새로고침해도 선택·효과·포드 속 짐이 그대로', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await boot(page);
  await startRun(page);
  await doTutorial(page);
  await openBoard(page, 'people');
  await seatAndConfirm(page, ['taeo', 'woojoo', 'dodam', 'jio'], 'review');
  await finishC1(page, 'go', null, 'adjust');
  await doC2(page, { jp: 'flow', pack: 'own', items: [['photo', 'L'], ['music', 'R']], talk: true, strapInfo: null, strap: 'adjust', hold: 'go' });
  await diagnoseC3(page, { jp: 'flow', variant: 'standard', comm: false, panelInfo: null, panel: 'adjust', auto: 'accept', fix: 'boram' });
  await scaleAndLaunch(page, 'boram');
  await playLate(page, {
    ...BASE, plus: false, ark: 'rendezvous', site: 'beta',
    hooks: {
      afterArk: async (p) => {
        await p.locator('#dialogue .dlg-next').waitFor();
        await reloadAndContinue(p);
        // 새로고침 뒤에는 저울 없이 이미 고른 선택의 후속 대사가 바로 이어져야 한다(대사가 열려 있는 동안은 ready()가 false)
        await p.locator('#dialogue .dlg-next').waitFor();
        await drain(p);
        expect(await p.locator('.scale').count(), '구조 신호 저울이 다시 열리지 않는다').toBe(0);
      },
      afterGust: async (p) => {
        await p.locator('#dialogue .dlg-next').waitFor();
        await reloadAndContinue(p);
        await p.locator('#dialogue.show, .descent').first().waitFor();
        await drain(p);
        await p.locator('.descent').waitFor();
        await modalButton(p, '녹녹이에게 맡기기');
      },
    },
  });
  const st = await page.evaluate(() => window.__mle.state());
  expect(st.flags.c4_ark_choice).toBe('rendezvous');
  expect(st.flags.dam_call).toBe(true);
  expect(st.resources.fuelMargin).toBe(1);
  expect(st.flags.pod_recovered).toBe(true);
  expect([...st.inventoryIds].sort()).toEqual(['music', 'photo']);
  await expectSimMatches(page);
  expect(errors).toEqual([]);
});

test('회귀 3 (소프트락): C2 고정 점검표 · C7 정수 직후 · C8 문 결정 직후에 새로고침해도 끝까지 간다', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await boot(page);
  await startRun(page);
  await doTutorial(page);
  await openBoard(page, 'people');
  await seatAndConfirm(page, ['harin', 'seojin', 'dodam', 'jio'], 'review');
  await finishC1(page, 'go', null, 'keep');
  await doC2(page, { jp: 'flow', pack: 'own', items: [['parts', 'L'], ['music', 'R']], talk: false, strapInfo: null, strap: 'keep', hold: 'check', reloadAtHold: true });
  await diagnoseC3(page, { jp: 'flow', variant: 'standard', comm: false, panelInfo: null, panel: 'keep', auto: 'accept', fix: 'spare', assist: true });
  await scaleAndLaunch(page, 'spare');
  await playLate(page, {
    ...BASE, ark: 'relay', gust: 'divert', target: 'ice', method: 'roles', vote: 'accept',
    hooks: {
      afterPurify: async (p) => { await p.locator('.perspective').waitFor(); await reloadAndContinue(p); },
      afterDoor: async (p) => { await p.locator('#dialogue .dlg-next').waitFor(); await reloadAndContinue(p); },
    },
  });
  const st = await page.evaluate(() => window.__mle.state());
  expect(st.fsm).toBe('results');
  expect(st.flags.c8_vote).toBe('accept');
  const ms = await page.evaluate(() => window.__mle.measure());
  for (const id of ['C2-O03', 'C7-O05', 'C8-O05']) expect(ms.opportunities[id].locked, id).toBe(true);
  await expectSimMatches(page);
  expect(errors).toEqual([]);
});

test('플레이 중 메뉴에서 행동 분석 끄기: 그때까지의 기록을 지우고, 새로고침 뒤에도 꺼진 채로 이어진다', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await boot(page);
  await startRun(page);
  await doTutorial(page);
  await openBoard(page, 'plan');
  await seatAndConfirm(page, ['harin', 'taeo', 'seojin', 'woojoo'], 'try');
  await finishC1(page, 'check', 'F', 'keep');
  await skipCard(page, 'c2');
  await drain(page);
  await page.waitForFunction(() => window.__mle?.ready());
  const before = await page.evaluate(() => window.__mle.measure());
  expect(before.analysisOptIn).toBe(true);
  expect(before.events.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: '메뉴' }).click();
  await modalButton(page, '행동 분석 끄기');
  await modalButton(page, '끄고 기록 지우기');
  const after = await page.evaluate(() => window.__mle.measure());
  expect(after.analysisOptIn).toBe(false);
  expect(after.events).toHaveLength(0);
  expect(Object.values(after.opportunities).some((o) => o.status === 'observed')).toBe(false);
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  await page.waitForFunction(() => window.__mle?.ready());
  const reloaded = await page.evaluate(() => window.__mle.measure());
  expect(reloaded.analysisOptIn).toBe(false);
  expect(reloaded.events).toHaveLength(0);
  await page.getByRole('button', { name: '메뉴' }).click();
  await expect(page.locator('#modal .modal-card').last().getByRole('button', { name: '행동 분석 끄기' })).toHaveCount(0);
  await modalButton(page, '닫기');
  expect(errors).toEqual([]);
});
