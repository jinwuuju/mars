import { test, expect } from '@playwright/test';
import { allRosters, unselectedOf } from '../src/story/roster';
import { CANDIDATES } from '../src/story/candidates';
import type { Report } from '../src/analytics/scoring';
import type { CandidateId } from '../src/shared/ids';
import {
  boot, choose, diagnoseC3, doC2, doTutorial, drain, finishC1, finishC2, interact, modalButton, openBoard, pack,
  scaleAndLaunch, seatAndConfirm, startC2, startRun,
} from './flow';
import { playLate, type LateOpts } from './late';
import { expectSimMatches } from './sim';
import './support';

const SHOTS = 'docs/screens';
const nameOf = (id: CandidateId): string => CANDIDATES[id].name;
const FIXES = ['boram', 'spare', 'recal'] as const;
const FIXED = ['담', '녹녹이', '보람', 'MIRROR'];
const ALL_OPPS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'].flatMap((c) => [1, 2, 3, 4, 5].map((n) => `${c}-O0${n}`));

const LATE_A: LateOpts = { plus: true, info: true, adjust: false, video: 'together', ark: 'supply', site: 'gamma', gust: 'pod', power: 'oxygen', target: 'third', eva: true, method: 'consensus', vote: 'conditional', answer: 2, name: '첫새벽', sac: 'first' };
const LATE_B: LateOpts = { plus: false, info: false, adjust: true, video: 'archive', ark: 'rendezvous', site: 'beta', gust: 'divert', power: 'even', target: 'ilkkun', eva: false, method: 'roles', vote: 'accept', answer: 0, name: '붉은 아침', sac: 'lot' };
const LATE_C: LateOpts = { plus: true, info: false, adjust: true, video: 'alone', ark: 'relay', site: 'alpha', gust: 'divert', power: 'even', target: 'ice', eva: true, method: 'expert', vote: 'notNow', answer: 1, name: '녹차밭', sac: 'me' };
const LATES = [LATE_A, LATE_B, LATE_C];

test('C1~C8 전체 흐름 + 결과지: 데스크톱, 스크린샷, 측정 기록 검증', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await boot(page);
  await page.screenshot({ path: `${SHOTS}/desktop-01-title.png` });
  await startRun(page);
  await page.screenshot({ path: `${SHOTS}/desktop-02-bunker-tutorial.png` });
  await doTutorial(page);
  await interact(page, 'harin');
  await drain(page);
  await choose(page, '더 묻기');
  await choose(page, '기록 보기');
  await page.getByRole('button', { name: '가능성 분석' }).click();
  await modalButton(page, '닫기');
  await choose(page, '그만 이야기하기');
  await interact(page, 'quiet');
  await drain(page);
  await openBoard(page, 'plan');
  await page.screenshot({ path: `${SHOTS}/desktop-03-roster.png` });
  await seatAndConfirm(page, ['harin', 'taeo', 'seojin', 'woojoo'], 'try');
  await finishC1(page, 'check', 'F', 'keep');
  await doC2(page, {
    jp: 'plan', pack: 'guide', items: [['parts', 'L'], ['teabag', 'R'], ['photo', 'R'], ['legacy_voices', 'R']], details: 'legacy_voices', talk: true, strapInfo: 'T', strap: 'adjust', hold: 'check', shot: `${SHOTS}/desktop-04-cargo.png`,
    explore: async (p) => {
      expect((await p.evaluate(() => window.__mle.actors())).sort()).toEqual(['dam', 'harin', 'seojin', 'taeo', 'woojoo']);
      await p.screenshot({ path: `${SHOTS}/desktop-04a-cargo-hold.png` });
      await interact(p, 'woojoo');
      await drain(p);
      await interact(p, 'legacy');
      await expect(p.locator('#modal .modal-card').last()).toContainText('도담');
      await modalButton(p, '닫기');
    },
  });
  await diagnoseC3(page, { jp: 'plan', variant: 'cross', comm: true, panelInfo: 'F', panel: 'adjust', sensorInfo: 'C', auto: 'manual', fix: 'spare', shot: `${SHOTS}/desktop-05-wiring.png` });
  await scaleAndLaunch(page, 'spare', `${SHOTS}/desktop-06-scale.png`);
  const { names } = await playLate(page, { ...LATE_A, shots: `${SHOTS}/desktop` });
  names.forEach((n) => expect(['하린', '태오', '서진', '진우주', ...FIXED]).toContain(n));
  await expect(page.locator('#screen .res-letters')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/desktop-90-results.png` });
  for (const tab of ['선택의 순간', 'MBTI 상세', '빅파이브 상세', '상황별 나', '유형 프로필', '궁합', '나와 닮은 인물', '저울 다시보기 · 기록실']) {
    await page.locator('.res-tabs').getByRole('tab', { name: tab }).click();
    await expect(page.locator('.res-body')).not.toBeEmpty();
  }
  await page.locator('.res-tabs').getByRole('tab', { name: '선택의 순간' }).click();
  await expect(page.locator('.tl-ch')).toHaveCount(8);
  await expect(page.locator('.tl-ch .moment').first()).toContainText('이 행동이 뜻하는 것');
  await page.screenshot({ path: `${SHOTS}/desktop-92-results-moments.png` });
  await page.locator('.res-tabs').getByRole('tab', { name: '궁합' }).click();
  const myCode = (await page.locator('.res-body code.code').textContent()) ?? '';
  expect(myCode).toMatch(/^ML-[0-9A-Z]{4}-[EIX?][NSX?][FTX?][JPX?]$/);
  await page.locator('.res-body input.input').fill(myCode);
  await page.locator('.res-body').getByRole('button', { name: '비교하기' }).click();
  await expect(page.locator('.friend-out')).toContainText('둘이 아크-06에 탔다면');
  await page.locator('.res-tabs').getByRole('tab', { name: '저울 다시보기 · 기록실' }).click();
  await expect(page.locator('.scale-table tbody tr')).toHaveCount(8);
  await expect(page.locator('.res-body .thoughts li')).toHaveCount(7);
  await expect(page.locator('.gallery .g-item.got')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/desktop-93-results-archive.png` });
  await expectSimMatches(page);
  await page.locator('.res-tabs').getByRole('tab', { name: 'MBTI' }).click();
  await page.screenshot({ path: `${SHOTS}/desktop-91-results-mbti.png` });

  const st = await page.evaluate(() => window.__mle.state());
  expect(st.fsm).toBe('results');
  expect(['dawn', 'memory', 'together', 'rebuild']).toContain(st.flags.ending);
  expect(st.flags.c8_name).toBe('첫새벽');
  expect(['C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'].filter((c) => typeof st.flags[`reflect_${c}`] === 'string'), '생각의 시간 7번').toHaveLength(7);
  expect(['C5', 'C6', 'C7'].filter((c) => typeof st.flags[`lost_${c}`] === 'string'), '희생 3번').toHaveLength(3);
  expect(st.flags.twist_done, '마지막 반전').toBe(true);
  expect(st.flags.pod_recovered).toBe(true);
  expect(st.inventoryIds.sort()).toEqual(['legacy_voices', 'photo', 'teabag']);
  const ms = await page.evaluate(() => window.__mle.measure());
  ALL_OPPS.forEach((o) => expect(ms.opportunities[o].locked).toBe(true));
  const seen = new Set(ms.events.map((e) => e.opportunityId));
  ALL_OPPS.forEach((o) => expect(seen.has(o)).toBe(true));
  for (const e of ms.events) {
    expect(e.opportunityId.endsWith('O06')).toBe(false);
    for (const id of Object.keys(CANDIDATES) as CandidateId[]) expect(e.label.includes(nameOf(id))).toBe(false);
  }
  const rep = await page.evaluate(() => window.__mle.report());
  expect(rep.axes.JP.dim.validChapters).toBe(8);
  expect(errors).toEqual([]);
});

allRosters().forEach((roster, idx) => {
  test(`15편성 완주: ${roster.join('+')} (C3 ${FIXES[idx % 3]}, 후반 시나리오 ${'ABC'[idx % 3]})`, async ({ page }) => {
    test.setTimeout(300_000);
    const errors = await boot(page);
    await startRun(page);
    await doTutorial(page);
    await openBoard(page, 'people');
    await seatAndConfirm(page, roster, 'review');
    const crewNames = roster.map(nameOf);
    const out = unselectedOf(roster).map(nameOf);
    const r1 = await finishC1(page, 'go', null, 'adjust');
    expect(crewNames).toContain(r1);
    const r2 = await doC2(page, { jp: 'flow', pack: 'own', items: [['photo', 'L'], ['music', 'R']], talk: false, strapInfo: null, strap: 'keep', hold: 'go' });
    expect(crewNames).toContain(r2);
    const fix = FIXES[idx % 3];
    const { panelRequester } = await diagnoseC3(page, { jp: 'flow', variant: 'standard', comm: false, panelInfo: null, panel: 'keep', auto: 'accept', fix });
    expect(crewNames).toContain(panelRequester);
    const voices = await scaleAndLaunch(page, fix);
    const late = LATES[idx % 3];
    const { names } = await playLate(page, late);
    [...voices, ...names].forEach((v) => { expect(out).not.toContain(v); expect([...crewNames, ...FIXED]).toContain(v); });
    const st = await page.evaluate(() => window.__mle.state());
    expect(st.fsm).toBe('results');
    expect([...st.crewIds].sort()).toEqual([...roster].sort());
    expect(['dawn', 'memory', 'together', 'rebuild']).toContain(st.flags.ending);
    expect(st.flags.c8_name).toBe(late.name);
    for (const k of ['oxygenReserve', 'water', 'food', 'power'] as const) expect(st.resources[k]).toBeGreaterThanOrEqual(15);
    await page.locator('.res-tabs').getByRole('tab', { name: '저울 다시보기 · 기록실' }).click();
    const recap = (await page.locator('.res-body').textContent()) ?? '';
    out.forEach((n) => expect(recap).toContain(n));
    await expectSimMatches(page);
    expect(errors).toEqual([]);
  });
});

test('같은 행동이면 승선 구성과 무관하게 같은 점수 (C1~C8 전체)', async ({ browser }) => {
  test.setTimeout(420_000);
  const reports: Report[] = [];
  for (const roster of [['harin', 'taeo', 'seojin', 'woojoo'], ['taeo', 'seojin', 'dodam', 'jio']] as CandidateId[][]) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await boot(page);
    await startRun(page);
    await doTutorial(page);
    await interact(page, 'quiet');
    await drain(page);
    await openBoard(page, 'plan');
    await seatAndConfirm(page, roster, 'try');
    await finishC1(page, 'check', 'T', 'adjust');
    await doC2(page, { jp: 'plan', pack: 'own', items: [['photo', 'L'], ['seeds', 'R']], details: 'photo', talk: true, strapInfo: 'F', strap: 'keep', hold: 'check' });
    await diagnoseC3(page, { jp: 'plan', variant: 'cross', comm: true, panelInfo: 'T', panel: 'adjust', sensorInfo: 'B', auto: 'manual', fix: 'recal' });
    await scaleAndLaunch(page, 'recal');
    await playLate(page, { ...LATE_C, info: true });
    reports.push(await page.evaluate(() => window.__mle.report()));
    await page.close();
  }
  const strip = (r: Report): string => JSON.stringify({
    b: Object.fromEntries(Object.entries(r.bigFive).map(([k, v]) => [k, v.m])),
    a: Object.fromEntries(Object.entries(r.axes).map(([k, v]) => [k, [v.dim.m, v.letter, v.certainty]])),
  });
  expect(strip(reports[0])).toBe(strip(reports[1]));
});

test('저장·재개: C2 적재 중, C3 저울 앞, 결과지에서 새로고침해도 이어지고 기록이 중복되지 않는다', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await boot(page);
  await startRun(page);
  await doTutorial(page);
  await openBoard(page, 'people');
  await seatAndConfirm(page, ['harin', 'woojoo', 'dodam', 'jio'], 'review');
  await finishC1(page, 'go', null, 'keep');
  await startC2(page, { jp: 'flow', pack: 'own' });
  await pack(page, [['soil', 'L']]);
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => window.__mle.measure().events.length);
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  await page.waitForFunction(() => window.__mle?.ready());
  expect(await page.evaluate(() => window.__mle.spots())).toContain('conveyor');
  await interact(page, 'conveyor');
  await page.locator('.cargo').waitFor();
  await expect(page.locator(`.cargo-item[data-id='soil']`)).toHaveClass(/packed/);
  expect(await page.evaluate(() => window.__mle.measure().events.length)).toBe(before);
  await pack(page, [['teabag', 'R']]);
  await finishC2(page, { talk: true, strapInfo: null, strap: 'adjust', hold: 'go' });
  await diagnoseC3(page, { jp: 'flow', variant: 'standard', comm: true, panelInfo: null, panel: 'adjust', auto: 'accept', fix: 'boram' });
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  await page.locator('.scale').waitFor();
  await scaleAndLaunch(page, 'boram');
  await playLate(page, LATE_B);
  const evs = await page.evaluate(() => window.__mle.measure().events.length);
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: '이어하기' }).click();
  await page.locator('#screen .paper-card.results').waitFor();
  expect(await page.evaluate(() => window.__mle.measure().events.length)).toBe(evs);
  expect(errors).toEqual([]);
});

test('모바일 390x844: 전체 완주, 주요 버튼이 화면 안에 있다', async ({ browser }) => {
  test.setTimeout(300_000);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = await boot(page);
  await page.screenshot({ path: `${SHOTS}/mobile-01-title.png` });
  await startRun(page);
  await doTutorial(page);
  await openBoard(page, 'people');
  for (const id of ['seojin', 'woojoo', 'dodam', 'jio'] as CandidateId[]) {
    const b = page.locator(`.cand-card[data-id='${id}']`).getByRole('button', { name: '앉히기' });
    await b.scrollIntoViewIfNeeded();
    await b.click();
  }
  await choose(page, '이 편성으로 검토 단계로');
  await drain(page, 700);
  const confirm = page.getByRole('button', { name: '명단 확정' });
  const cb = await confirm.boundingBox();
  expect(cb && cb.y + cb.height <= 844 && cb.x >= 0 && cb.x + cb.width <= 390).toBe(true);
  await confirm.click();
  await drain(page);
  await modalButton(page, '확정');
  await finishC1(page, 'go', 'T', 'adjust');
  await startC2(page, { jp: 'flow', pack: 'guide' });
  await pack(page, [['filter', 'L'], ['seeds', 'R'], ['teabag', 'R']]);
  const rb = await page.getByRole('button', { name: '봉인 준비' }).boundingBox();
  expect(rb && rb.y + rb.height <= 844).toBe(true);
  await page.screenshot({ path: `${SHOTS}/mobile-02-cargo.png` });
  await finishC2(page, { talk: false, strapInfo: 'F', strap: 'adjust', hold: 'go' });
  await diagnoseC3(page, { jp: 'flow', variant: 'standard', comm: false, panelInfo: null, panel: 'adjust', auto: 'accept', fix: 'recal', shot: `${SHOTS}/mobile-03-wiring.png` });
  await scaleAndLaunch(page, 'recal', `${SHOTS}/mobile-04-scale.png`);
  await playLate(page, { ...LATE_B, shots: `${SHOTS}/mobile` });
  await page.screenshot({ path: `${SHOTS}/mobile-90-results.png` });
  expect(errors).toEqual([]);
  await page.close();
});

test('분석 끄기: 이야기는 같고 행동 기록은 하나도 만들지 않는다', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await boot(page);
  await startRun(page, false);
  await doTutorial(page);
  await openBoard(page, 'plan');
  await seatAndConfirm(page, ['harin', 'dodam', 'jio', 'taeo'], 'try');
  await finishC1(page, 'check', 'F', 'adjust');
  await doC2(page, { jp: 'plan', pack: 'guide', items: [['parts', 'L'], ['legacy_seeds', 'R']], details: 'parts', talk: true, strapInfo: 'T', strap: 'adjust', hold: 'check' });
  await diagnoseC3(page, { jp: 'plan', variant: 'cross', comm: true, panelInfo: 'F', panel: 'adjust', sensorInfo: 'A', auto: 'manual', fix: 'spare' });
  await scaleAndLaunch(page, 'spare');
  await playLate(page, LATE_A);
  expect(await page.evaluate(() => window.__mle.measure().events.length)).toBe(0);
  await expect(page.locator('#screen .paper-card.results h2').first()).toContainText('결과지');
  await expect(page.locator('.res-body')).toContainText('행동 분석을 끄고');
  expect(errors).toEqual([]);
});
