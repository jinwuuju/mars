import { test, expect, type Page } from '@playwright/test';
import { createMission, type MissionState } from '../src/core/state';
import { createMeasurement, measureReducer, type MeasurementState } from '../src/analytics/measurement';
import { FAMILY_ORDER, oppId, type Dim } from '../src/analytics/opportunities';
import { CHAPTER_IDS, type CandidateId } from '../src/shared/ids';
import { CANDIDATES } from '../src/story/candidates';
import { unselectedOf } from '../src/story/roster';
import { SAVE_KEY, SETTINGS_KEY } from '../src/core/persistence';
import { answerFollowups } from './flow';
import './support';

/** 결과지 화면 분기(위치 편향 · 결과 보류)를 저장 파일 주입으로 직접 검증한다. 완주 없이 결과지만 본다. */
const CREW: CandidateId[] = ['harin', 'taeo', 'seojin', 'woojoo'];

function mission(): MissionState {
  const m = createMission('results-spec', 12345, { name: '테스터', look: 0, relation: 'friend' });
  return {
    ...m, fsm: 'results', chapter: 'C8', seats: [...CREW], crewIds: [...CREW], crewLocked: true,
    legacyItemIds: unselectedOf(CREW).map((c) => CANDIDATES[c].legacy.id), inventoryIds: ['photo'], completed: true,
    flags: {
      c1_seated: true, c2_sealed: true, c2_after_done: true, c2_cargo: JSON.stringify(['photo']), c3_fix: 'boram', c3_launched: true,
      c4_video_choice: 'together', c4_ark_choice: 'relay', c4_done: true, c5_site: 'beta', c5_gust: 'divert', c5_done: true,
      c6_alloc: JSON.stringify([2, 1, 1, 2]), c6_done: true, c7_target: 'ice', c7_eva: 'no', c7_done: true,
      c8_method: 'roles', c8_door: 'conditional', c8_vote: 'conditional', c8_answer: 'morning', c8_name: '편향시험', c8_shift: '[]',
      letter_from: 'dodam', ending: 'dawn', c8_done: true,
    },
  };
}

function measure(biased: boolean, chapters = 8): MeasurementState {
  let s = createMeasurement(true);
  let k = 0;
  const act = (opp: string, dim: Dim, kind: 'fork' | 'tab', pole: 1 | -1): void => {
    k += 1;
    s = measureReducer(s, { type: 'act', act: { opportunityId: opp, dim, kind, pole, actKey: `a${k}`, displayPosition: biased ? 0 : k % 2, optionSetId: `${opp}#${k}`, label: '시험 선택', otherLabel: '다른 선택', scene: '시험 장면' } });
  };
  CHAPTER_IDS.forEach((ch, ci) => {
    const ids = FAMILY_ORDER.slice(0, 5).map((f) => oppId(ch, f));
    ids.forEach((id) => { s = measureReducer(s, { type: 'open', id }); });
    if (ci < chapters) {
      const pole: 1 | -1 = ci % 4 === 3 ? -1 : 1;
      const [I, V, O, S, P] = ids;
      act(I, 'SN', 'tab', pole); act(V, 'O', 'fork', pole); act(O, 'C', 'fork', pole); act(O, 'JP', 'fork', pole);
      act(S, 'E', 'fork', pole); act(P, 'A', 'fork', pole); act(P, 'TF', 'tab', pole);
    }
    ids.forEach((id) => { s = measureReducer(s, { type: 'close', id }); });
  });
  return s;
}

async function openResults(page: Page, ms: MeasurementState): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  const bundle = { schemaVersion: 2, savedAt: Date.now(), mission: mission(), measure: ms, ui: {} };
  await page.addInitScript(([key, skey, save]) => {
    if (!sessionStorage.getItem('res-init')) {
      localStorage.clear();
      localStorage.setItem(skey, JSON.stringify({ textScale: 1, reducedMotion: true, intensity: 1 }));
      localStorage.setItem(key, save);
      sessionStorage.setItem('res-init', '1');
    }
  }, [SAVE_KEY, SETTINGS_KEY, JSON.stringify(bundle)] as const);
  await page.goto('/?e2e=1');
  await page.getByRole('button', { name: '이어하기' }).click();
  await answerFollowups(page);
  await page.locator('#screen .paper-card.results').waitFor();
  return errors;
}

/** 보이는 결과지 탭을 모두 열어 본다(빈 화면·오류 없이 열리는지) */
async function openAllTabs(page: Page): Promise<string[]> {
  const tabs = page.locator('.res-tabs').getByRole('tab');
  const names = await tabs.allTextContents();
  for (const name of names) {
    await page.locator('.res-tabs').getByRole('tab', { name, exact: true }).click();
    await expect(page.locator('.res-body')).not.toBeEmpty();
  }
  return names;
}

for (const biased of [true, false]) {
  test(`결과지: 위치 편향 ${biased ? '있음 → 4글자·유형·이미지 저장·유형 탭을 숨기고 막대를 회색으로' : '없음 → 글자와 유형을 보여 준다'}`, async ({ page }) => {
    const errors = await openResults(page, measure(biased));
    const rep = await page.evaluate(() => window.__mle.report());
    expect(rep.quality.positionBias).toBe(biased);
    expect(rep.quality.withheld).toBe(false);
    const tabs = page.locator('.res-tabs');
    if (biased) {
      await expect(page.locator('.res-letters')).toHaveCount(0);
      await expect(page.locator('.res-body')).toContainText('한쪽 위치에 몰려');
      await expect(page.locator('.res-body.biased')).toHaveCount(1);
      await expect(page.getByRole('button', { name: '이미지 저장' })).toHaveCount(0);
      for (const hidden of ['유형 프로필', '궁합', '나와 닮은 인물']) await expect(tabs.getByRole('tab', { name: hidden })).toHaveCount(0);
      await tabs.getByRole('tab', { name: 'MBTI 상세' }).click();
      await expect(page.locator('.res-body')).toContainText('숨김(위치 편향)');
      await expect(page.locator('.res-body')).toContainText('유형 후보는 숨겼어요');
      expect(await page.locator('.res-body .rb-dot').first().evaluate((el) => getComputedStyle(el).filter)).toContain('grayscale');
    } else {
      await expect(page.locator('.res-letters')).toBeVisible();
      await expect(page.getByRole('button', { name: '이미지 저장' })).toHaveCount(1);
      await expect(tabs.getByRole('tab', { name: '궁합' })).toHaveCount(1);
      await tabs.getByRole('tab', { name: 'MBTI 상세' }).click();
      await expect(page.locator('.res-body')).not.toContainText('숨김(위치 편향)');
    }
    expect((await openAllTabs(page)).length).toBe(biased ? 6 : 9);
    expect(errors).toEqual([]);
  });
}

test('결과지: 관찰이 20개 미만이면 추가 질문으로 모든 글자를 정하고, 9개 탭이 모두 오류 없이 열린다', async ({ page }) => {
  const errors = await openResults(page, measure(false, 3));
  const ms = await page.evaluate(() => window.__mle.measure());
  expect((ms.followups ?? []).length, '추가 질문을 했다').toBeGreaterThan(0);
  const rep = await page.evaluate(() => window.__mle.report());
  expect(rep.quality.withheld).toBe(false);
  expect(rep.type.strict).not.toMatch(/[?X]/);
  await expect(page.locator('.res-letters')).toBeVisible();
  await expect(page.locator('.res-body')).not.toContainText('근거 부족');
  expect((await openAllTabs(page)).length).toBe(9);
  expect(errors).toEqual([]);
});
