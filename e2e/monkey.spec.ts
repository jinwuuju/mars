import { test, expect, type Page, type Locator } from '@playwright/test';
import { mulberry32 } from '../src/shared/rng';
import { expectSimMatches } from './sim';
import './support';

const EXPLORE_IDS = ['board', 'board', 'board', 'quiet', 'notice', 'dam', 'boram', 'hatch', 'harin', 'taeo', 'seojin', 'woojoo', 'dodam', 'jio'];
const pick = <T>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];

interface Ctx { rosterOps: number; cargoOps: number; cancelled: boolean; scaleCancelled: boolean; worldActs: number; visits: Map<string, number>; reloads: number; escapes: number }

async function clickFirst(loc: Locator): Promise<boolean> {
  try {
    const n = await loc.count();
    for (let i = 0; i < n; i += 1) {
      const b = loc.nth(i);
      if (await b.isVisible({ timeout: 500 }) && await b.isEnabled({ timeout: 500 })) { await b.click({ timeout: 2000 }); return true; }
    }
  } catch {
    // 화면이 바뀌는 순간(요소가 사라짐)의 경합은 게임 오류가 아니다
  }
  return false;
}

/** 무작위 플레이 봇: 화면에 보이는 것만 보고 무작위로 누른다. */
async function step(page: Page, r: () => number, ctx: Ctx): Promise<'done' | 'go'> {
  if (await page.locator('#screen .paper-card.results').count()) return 'done';
  // 아무 때나(대사·저울·미니게임 도중 포함) 새로고침 후 이어하기: 저장·재개가 선택과 효과를 어긋나게 하지 않는지
  if (ctx.reloads < 5 && r() < 0.006) {
    ctx.reloads += 1;
    await page.waitForTimeout(300);
    await page.reload();
    await page.getByRole('button', { name: '이어하기' }).click({ timeout: 10_000 });
    return 'go';
  }
  const card = page.locator('#screen .chapter-card');
  if (await card.count()) { await card.click().catch(() => undefined); return 'go'; }
  const next = page.locator('#dialogue .dlg-next');
  if (await next.isVisible().catch(() => false)) { await next.click(); return 'go'; }
  const choices = page.locator('#dialogue .btn.choice');
  const n = await choices.count();
  if (n > 0) {
    const labels = await choices.allTextContents();
    let idx = Math.floor(r() * n);
    const bye = labels.findIndex((l) => l.includes('그만 이야기하기') || l.includes('괜찮아요'));
    if (bye >= 0 && r() < 0.45) idx = bye;
    await choices.nth(idx).click();
    return 'go';
  }
  const skip = page.locator('.launch-skip');
  if (await skip.count()) { if (r() < 0.3) await skip.click().catch(() => undefined); else await page.waitForTimeout(200); return 'go'; }
  const modal = page.locator('#modal .modal-card').last();
  if (await modal.count()) {
    // 가끔 Esc: 닫을 수 있는 창은 완료 처리와 함께 닫히고, 닫을 수 없는 창은 그대로여야 한다(멈추면 봇이 끝까지 못 간다)
    if (r() < 0.06) { ctx.escapes += 1; await page.keyboard.press('Escape'); return 'go'; }
    if (await modal.locator('.roster').count()) {
      const st = await page.evaluate(() => window.__mle.state());
      const seated = st.seats.filter((x) => x !== null) as string[];
      const full = seated.length === 4;
      ctx.rosterOps += 1;
      if (full && (ctx.rosterOps > 14 || r() < 0.3)) { await modal.getByRole('button', { name: '명단 확정' }).click(); return 'go'; }
      const ids = ['harin', 'taeo', 'seojin', 'woojoo', 'dodam', 'jio'];
      const free = ids.filter((i) => !seated.includes(i));
      const roll = r();
      if ((ctx.rosterOps > 14 || roll < 0.4) && !full && free.length) { await modal.locator(`.cand-card[data-id='${pick(r, free)}']`).getByRole('button', { name: '앉히기' }).click(); return 'go'; }
      if (roll < 0.52 && seated.length) { await modal.locator(`.cand-card[data-id='${pick(r, seated)}']`).getByRole('button', { name: '내리기' }).click(); return 'go'; }
      if (roll < 0.64) { await modal.locator(`.cand-card[data-id='${pick(r, ids)}'] .cand-pick`).click(); await modal.locator('.seat.slot').nth(Math.floor(r() * 4)).click(); return 'go'; }
      if (roll < 0.74) { await modal.locator('.save-row').nth(Math.floor(r() * 3)).getByRole('button', { name: '저장' }).click(); return 'go'; }
      if (roll < 0.82) { await clickFirst(modal.locator('.save-row').nth(Math.floor(r() * 3)).getByRole('button', { name: '불러오기' })); return 'go'; }
      if (roll < 0.9) { await modal.locator('.cand-card').nth(Math.floor(r() * 6)).getByRole('button', { name: '기록 보기' }).click(); return 'go'; }
      if (roll < 0.95 && ctx.rosterOps < 14) { await modal.getByRole('button', { name: '닫고 둘러보기' }).click(); return 'go'; }
      if (!full && free.length) await modal.locator(`.cand-card[data-id='${free[0]}']`).getByRole('button', { name: '앉히기' }).click();
      return 'go';
    }
    if (await modal.locator('.cargo').count()) {
      ctx.cargoOps += 1;
      const ready = modal.getByRole('button', { name: '봉인 준비' });
      if (await ready.isEnabled() && (ctx.cargoOps > 16 || r() < 0.2)) { await ready.click(); return 'go'; }
      const roll = r();
      if (ctx.cargoOps > 16) {
        const outs = modal.locator('.cargo-item.packed').getByRole('button', { name: '빼기' });
        if (await outs.count()) { await outs.first().click(); return 'go'; }
      }
      if (roll < 0.5) {
        const btns = modal.locator('.cargo-item:not(.packed) .ci-actions button', { hasText: '칸' });
        const c = await btns.count();
        if (c) { await btns.nth(Math.floor(r() * c)).click(); return 'go'; }
      }
      if (roll < 0.65) { const outs = modal.getByRole('button', { name: '빼기' }); const c = await outs.count(); if (c) { await outs.nth(Math.floor(r() * c)).click(); return 'go'; } }
      if (roll < 0.75) { await clickFirst(modal.getByRole('button', { name: '자동 균형 제안' })); return 'go'; }
      if (roll < 0.85) { const d = modal.getByRole('button', { name: '자세히' }); await d.nth(Math.floor(r() * (await d.count()))).click(); return 'go'; }
      if (await ready.isEnabled()) await ready.click();
      return 'go';
    }
    if (await modal.locator('.wiring').count()) {
      const w = modal.locator('.wiring');
      if (r() < 0.2 && await clickFirst(w.getByRole('button', { name: '녹녹이에게 맡기기' }))) return 'go';
      if (r() < 0.08) { await clickFirst(w.getByRole('button', { name: '정보' })); return 'go'; }
      if (await clickFirst(w.locator('.order button'))) return 'go';
      for (let i = 0; i < 3; i += 1) {
        const row = w.locator('.wire-row').nth(i);
        if (!(await row.locator('button.on').count())) { await row.getByRole('button', { name: `포트 ${1 + Math.floor(r() * 4)}` }).click(); return 'go'; }
      }
      if (await clickFirst(w.getByRole('button', { name: '다음 테스트' }))) return 'go';
      if (await clickFirst(w.locator('button', { hasText: '실행' }))) return 'go';
      if (await clickFirst(w.locator('button', { hasText: '결과 메모' }))) return 'go';
      if (await clickFirst(w.getByRole('button', { name: '진단 완료' }))) return 'go';
      for (let i = 0; i < 3; i += 1) await w.locator('.wire-row').nth(i).getByRole('button', { name: `포트 ${i + 1}` }).click();
      return 'go';
    }
    if (await modal.locator('.scale-grid').count()) {
      const btns = modal.locator('.scale-card button:not([disabled])');
      await btns.nth(Math.floor(r() * (await btns.count()))).click();
      return 'go';
    }
    if (await modal.locator('.pipes').count()) {
      const tiles = modal.locator('.pipe:not([disabled])');
      const c = await tiles.count();
      if (c && r() < 0.7) await tiles.nth(Math.floor(r() * c)).click();
      else if (r() < 0.1) await clickFirst(modal.getByRole('button', { name: '장치 기록 보기' }));
      else await clickFirst(modal.getByRole('button', { name: '녹녹이에게 맡기기' }));
      return 'go';
    }
    if (await modal.locator('.order-puzzle').count()) {
      const ch = modal.locator('.choices button:not([disabled])');
      const c = await ch.count();
      if (c && r() < 0.7) await ch.nth(Math.floor(r() * c)).click();
      else await clickFirst(modal.getByRole('button', { name: '녹녹이에게 맡기기' }));
      return 'go';
    }
    if (await modal.locator('.pick').count()) {
      const roll = r();
      if (roll < 0.4) await modal.locator('.sys').nth(Math.floor(r() * 4)).click();
      else if (roll < 0.6) await clickFirst(modal.getByRole('button', { name: '이 계통이 원인' }));
      else if (roll < 0.7) await clickFirst(modal.getByRole('button', { name: '계기 자료' }));
      else await clickFirst(modal.getByRole('button', { name: '녹녹이에게 맡기기' }));
      return 'go';
    }
    if (await modal.locator('.tokens').count()) {
      const ok = modal.getByRole('button', { name: '이 배분으로 확정' });
      if (await ok.isEnabled() && r() < 0.5) { await ok.click(); return 'go'; }
      const plus = modal.locator('.socket button:not([disabled])');
      const c = await plus.count();
      if (c && r() < 0.7) await plus.nth(Math.floor(r() * c)).click();
      else await modal.getByRole('button', { name: '고르게 나누기' }).click();
      return 'go';
    }
    if (await modal.locator('.route').count()) {
      const cells = modal.locator('.cell:not([disabled])');
      const c = await cells.count();
      if (c && r() < 0.6) await cells.nth(Math.floor(r() * c)).click();
      else if (r() < 0.3) await clickFirst(modal.getByRole('button', { name: '되돌리기' }));
      else await clickFirst(modal.getByRole('button', { name: '녹녹이에게 맡기기' }));
      return 'go';
    }
    if (await modal.locator('.landing').count()) {
      const roll = r();
      if (roll < 0.4) await modal.locator('.site-mk').nth(Math.floor(r() * 3)).click();
      else if (roll < 0.5) await clickFirst(modal.getByRole('button', { name: '자료 2탭 열기' }));
      else await modal.getByRole('button', { name: '후보 비교 끝' }).click();
      return 'go';
    }
    if (await modal.locator('.descent').count()) {
      if (r() < 0.6) await clickFirst(modal.getByRole('button', { name: '녹녹이에게 맡기기' }));
      else await clickFirst(modal.locator('.descent button'));
      return 'go';
    }
    if (await modal.locator('.suit').count()) {
      const door = modal.getByRole('button', { name: '에어록 열기' });
      if (await door.isEnabled()) { await door.click(); return 'go'; }
      await clickFirst(modal.locator('.suit button:not(.on)'));
      return 'go';
    }
    if (await modal.locator('.layer-map').count()) {
      const roll = r();
      if (roll < 0.4) await modal.locator('.layer-map .row button').nth(Math.floor(r() * 4)).click();
      else if (roll < 0.5) await clickFirst(modal.getByRole('button', { name: '자료 2탭 열기' }));
      else await modal.getByRole('button', { name: '목적지 정하러 가기' }).click();
      return 'go';
    }
    if (await modal.locator('.shift').count()) {
      const ok = modal.getByRole('button', { name: '근무표 확정' });
      if (await ok.isEnabled() && r() < 0.5) { await ok.click(); return 'go'; }
      const b = modal.locator('.shift-table button');
      const c = await b.count();
      if (c && r() < 0.6) await b.nth(Math.floor(r() * c)).click();
      else await modal.getByRole('button', { name: '녹녹이에게 맡기기' }).click();
      return 'go';
    }
    if (await modal.locator('input.input').count()) {
      await modal.locator('input.input').fill(pick(r, ['첫새벽', '', '붉은 아침', '아주아주긴정착지이름입니다아']));
      await modal.getByRole('button', { name: '이 이름으로' }).click();
      return 'go';
    }
    if (await modal.locator('.jettison').count()) {
      const go = modal.getByRole('button', { name: '투하' });
      if (await go.isEnabled()) { await go.click(); return 'go'; }
      const it = modal.locator('.jet-item:not(.on)');
      if (await it.count()) await it.nth(Math.floor(r() * (await it.count()))).click();
      return 'go';
    }
    if (await modal.locator('.ignition').count()) {
      if (r() < 0.5) await modal.getByRole('button', { name: '녹녹이에게 맡기기' }).click();
      else await clickFirst(modal.getByRole('button', { name: '한 번 밀기' }));
      return 'go';
    }
    if (await modal.locator('.chips').count()) {
      const chips = modal.locator('.chips button');
      const c = await chips.count();
      for (let i = 0; i < 1 + Math.floor(r() * 3); i += 1) await chips.nth(Math.floor(r() * c)).click();
      await modal.getByRole('button', { name: '완료' }).click();
      return 'go';
    }
    if (await modal.locator('.fu-choices').count()) {
      const b = modal.locator('.fu-choice');
      await b.nth(Math.floor(r() * (await b.count()))).click();
      return 'go';
    }
    if (await modal.locator('.sac-grid').count()) {
      const b = modal.locator('button');
      await b.nth(Math.floor(r() * (await b.count()))).click();
      return 'go';
    }
    if (await modal.locator('.request').count()) {
      const tabs = modal.locator('.tabs button');
      for (let i = 0; i < Math.floor(r() * 3); i += 1) await tabs.nth(Math.floor(r() * 2)).click();
      await modal.locator('.choices button').nth(Math.floor(r() * 2)).click();
      return 'go';
    }
    const title = (await modal.locator('h2').textContent()) ?? '';
    if (title.includes('명단 확정')) {
      if (!ctx.cancelled && r() < 0.35) { ctx.cancelled = true; await modal.getByRole('button', { name: '다시 살펴보기' }).click(); }
      else await modal.getByRole('button', { name: '확정', exact: true }).click();
      return 'go';
    }
    if (title.includes('되돌릴 수 없어요')) {
      if (!ctx.scaleCancelled && r() < 0.35) { ctx.scaleCancelled = true; await modal.getByRole('button', { name: '다시 생각하기' }).click(); }
      else await modal.getByRole('button', { name: '이 길로 확정' }).click();
      return 'go';
    }
    if (title.includes('마지막 12킬로그램') && await modal.getByRole('button', { name: '봉인', exact: true }).count()) {
      if (r() < 0.3) await modal.getByRole('button', { name: '다시 고르기' }).click();
      else await modal.getByRole('button', { name: '봉인', exact: true }).click();
      return 'go';
    }
    const tabs = modal.locator('.tabs button');
    const tn = await tabs.count();
    for (let i = 0; i < (tn ? 1 + Math.floor(r() * 2) : 0); i += 1) await tabs.nth(Math.floor(r() * tn)).click();
    await modal.locator('.modal-foot button').last().click();
    return 'go';
  }
  const ready = await page.evaluate(() => Boolean(window.__mle?.ready()));
  const st = await page.evaluate(() => window.__mle.state());
  if (st.fsm === 'c1_tutorial' && ready) {
    await page.evaluate((id) => window.__mle.interact(id), pick(r, ['t-crate', 't-locker', 't-citizen']));
  } else if (st.fsm === 'c1_explore' && ready) {
    ctx.worldActs += 1;
    await page.evaluate((x) => window.__mle.interact(x), ctx.worldActs > 25 ? 'board' : pick(r, EXPLORE_IDS));
  } else if (ready) {
    const spots = await page.evaluate(() => window.__mle.spots());
    const talkIds = ['harin', 'taeo', 'seojin', 'woojoo', 'dodam', 'jio', 'dam'];
    const work = spots.filter((s) => !talkIds.includes(s));
    ctx.worldActs += 1;
    const pool = work.length && r() < 0.75 ? work : spots;
    if (pool.length) {
      // 덜 가 본 곳을 우선(같으면 무작위): 할 일 지점이 끝나면 방문 수가 늘어 자연히 다음 지점으로 넘어간다
      const min = Math.min(...pool.map((x) => ctx.visits.get(`${st.fsm}:${x}`) ?? 0));
      const cand = pool.filter((x) => (ctx.visits.get(`${st.fsm}:${x}`) ?? 0) === min);
      const id = pick(r, cand);
      ctx.visits.set(`${st.fsm}:${id}`, min + 1);
      await page.evaluate((x) => window.__mle.interact(x), id);
    }
    else await page.waitForTimeout(60);
  } else {
    await page.waitForTimeout(60);
  }
  return 'go';
}

for (const seed of [11, 22, 33, 44, 55, 66, 77, 88]) {
  test(`무작위 플레이 봇 #${seed}: C1~C8 완주 + 결과지 + 상태·측정 불변식`, async ({ page }) => {
    test.setTimeout(900_000);
    page.setDefaultTimeout(4000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    // 짝수 시드는 퍼즐 직접 풀기, 홀수 시드는 기본값(녹녹이가 대신 풀기)
    await page.addInitScript((auto) => {
      if (!sessionStorage.getItem('e2e-init')) {
        localStorage.clear();
        localStorage.setItem('mirror:last-earth:settings:v2', JSON.stringify({ textScale: 1, reducedMotion: true, intensity: 1, puzzles: auto ? 'auto' : 'manual' }));
        sessionStorage.setItem('e2e-init', '1');
      }
    }, seed % 2 === 1);
    await page.goto('/?e2e=1');
    const r = mulberry32(seed);
    await page.getByRole('button', { name: '마지막 배에 타기' }).click();
    await page.getByRole('button', { name: r() < 0.8 ? '행동 분석 켜고 시작' : '분석 없이 플레이' }).click();
    if (r() < 0.5) await page.getByRole('button', { name: '하린은 나의 오랜 친구' }).click();
    await page.getByRole('button', { name: '발사장으로' }).click();
    await page.getByRole('button', { name: '건너뛰기' }).click();
    const ctx: Ctx = { rosterOps: 0, cargoOps: 0, cancelled: false, scaleCancelled: false, worldActs: 0, visits: new Map(), reloads: 0, escapes: 0 };
    let done = false;
    let races = 0;
    for (let i = 0; i < 9000 && !done; i += 1) {
      try {
        done = (await step(page, r, ctx)) === 'done';
      } catch (e) {
        // 클릭하려던 요소가 그 순간 사라지는 UI 경합. 게임 오류(pageerror·console.error)는 따로 수집해 마지막에 검사한다.
        races += 1;
        if (races > 300) throw e;
      }
    }
    expect(done).toBe(true);

    const st = await page.evaluate(() => window.__mle.state());
    expect(st.fsm).toBe('results');
    const repF = await page.evaluate(() => window.__mle.report());
    const msr = await page.evaluate(() => window.__mle.measure());
    if (msr.analysisOptIn && !repF.quality.positionBias) expect(repF.type.strict, '결과 글자에 ?·X가 없다').not.toMatch(/[?X]/);
    expect(['dawn', 'memory', 'together', 'rebuild']).toContain(st.flags.ending);
    expect(String(st.flags.c8_name).length).toBeGreaterThan(0);
    expect(String(st.flags.c8_name).length).toBeLessThanOrEqual(12);
    for (const k of ['oxygenReserve', 'water', 'food', 'power'] as const) expect(st.resources[k]).toBeGreaterThanOrEqual(15);
    expect(st.crewLocked).toBe(true);
    expect(new Set(st.crewIds).size).toBe(4);
    expect(st.legacyItemIds).toHaveLength(2);
    expect(['boram', 'spare', 'recal']).toContain(st.flags.c3_fix);
    expect(st.resources.habitatIntegrity).toBeGreaterThanOrEqual(0);

    const ms = await page.evaluate(() => window.__mle.measure());
    const allowed = new Set(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'].flatMap((c) => [1, 2, 3, 4, 5].map((k) => `${c}-O0${k}`)));
    const forkKeys = new Set<string>();
    for (const e of ms.events) {
      expect(allowed.has(e.opportunityId)).toBe(true);
      expect([0, 1]).toContain(e.displayPosition);
      if (e.kind === 'fork') { expect(forkKeys.has(e.optionSetId)).toBe(false); forkKeys.add(e.optionSetId); }
      if (e.secondary) expect(e.weight).toBe(0);
    }
    if (ms.analysisOptIn) for (const id of allowed) expect(ms.opportunities[id].locked).toBe(true);
    const rep = await page.evaluate(() => window.__mle.report());
    for (const d of Object.values(rep.bigFive)) if (d.m !== null) expect(Number.isNaN(d.m)).toBe(false);
    expect(rep.neuroticism).toBe('insufficient');
    // 무작위 경로(새로고침·Esc 포함)에서도 게임 결과가 30,000판 시뮬레이션과 같은 규칙인지
    await expectSimMatches(page);
    console.log(`MONKEY #${seed} reloads=${ctx.reloads} escapes=${ctx.escapes} races=${races} ending=${String(st.flags.ending)} c3=${String(st.flags.c3_fix)} ark=${String(st.flags.c4_ark_choice)} gust=${String(st.flags.c5_gust)} c7=${String(st.flags.c7_target)} optIn=${ms.analysisOptIn} puzzles=${seed % 2 === 1 ? 'auto' : 'manual'}`);
    expect(errors).toEqual([]);
  });
}
