import { expect, type Page } from '@playwright/test';
import { simulateRun, type RunChoices } from '../src/story/economy';
import type { CandidateId } from '../src/shared/ids';
import './support';

/**
 * 실제로 플레이한 판의 선택을 30,000판 시뮬레이션과 같은 함수(simulateRun)에 넣어
 * 엔딩·자원·최종 짐이 게임과 정확히 같은지 확인한다(게임과 시뮬레이션의 규칙 불일치 검출).
 */
export async function expectSimMatches(page: Page): Promise<void> {
  const st = await page.evaluate(() => window.__mle.state());
  const f = st.flags as Record<string, string | number | boolean>;
  const j = <T>(k: string): T => JSON.parse(String(f[k])) as T;
  const choices: RunChoices = {
    crew: st.crewIds as CandidateId[],
    cargo: j<string[]>('c2_cargo'),
    c3: f.c3_fix as RunChoices['c3'],
    c4video: f.c4_video_choice as RunChoices['c4video'],
    c4ark: f.c4_ark_choice as RunChoices['c4ark'],
    c5site: f.c5_site as RunChoices['c5site'],
    c5gust: f.c5_gust as RunChoices['c5gust'],
    c6: j<[number, number, number, number]>('c6_alloc'),
    c7: f.c7_target as RunChoices['c7'],
    c7eva: f.c7_eva === 'yes',
    c8method: f.c8_method as RunChoices['c8method'],
    c8door: f.c8_door as RunChoices['c8door'],
    c8answer: f.c8_answer as RunChoices['c8answer'],
    jettison: typeof f.c3_jettison === 'string' ? j<string[]>('c3_jettison') : undefined,
    lostC5: typeof f.lost_C5 === 'string' ? (f.lost_C5 as CandidateId) : undefined,
  };
  const sim = simulateRun(choices);
  expect(sim.ending, '엔딩이 시뮬레이션과 같다').toBe(f.ending);
  for (const [k, v] of Object.entries(sim.resources)) expect(st.resources[k as keyof typeof st.resources], `자원 ${k}`).toBeCloseTo(v, 6);
  expect([...sim.cargoFinal].sort(), '최종 짐').toEqual([...st.inventoryIds].sort());
}
