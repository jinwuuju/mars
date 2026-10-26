import { describe, expect, it } from 'vitest';
import { DAM_GRIEF, GRIEF, LAST_WORDS, MEMORY, REMEMBER, SAC_CHAPTERS, SACRIFICE } from '../src/story/sacrifice';
import { CANDIDATE_IDS } from '../src/shared/ids';
import { CANDIDATES } from '../src/story/candidates';

describe('작별 장면: 모든 동료·모든 분기에 원인·결과·회상·반응이 있다', () => {
  it('여섯 명 모두 마지막 말·회상·반응 대사가 있고, 반응에는 떠난 사람 이름이나 감정이 담긴다', () => {
    for (const id of CANDIDATE_IDS) {
      expect(LAST_WORDS[id].low.length).toBeGreaterThan(0);
      expect(MEMORY[id].startsWith('회상 —')).toBe(true);
      expect(GRIEF[id]('테스트').length).toBeGreaterThan(5);
    }
  });

  it('위기 설명은 앞 장의 선택에 따라 원인이 달라진다(인과)', () => {
    const c5 = (gust: string): string => SACRIFICE.C5.setup({ c5_gust: gust }).map((l) => l.text).join(' ');
    expect(c5('divert')).toContain('선회');
    expect(c5('pod')).toContain('포드');
    const c6 = (used: boolean): string => SACRIFICE.C6.setup({ c3_backup_used: used }).map((l) => l.text).join(' ');
    expect(c6(true)).toContain('3장');
    expect(c6(false)).not.toContain('3장');
    const c7 = (t: string): string => SACRIFICE.C7.setup({ c7_target: t }).map((l) => l.text).join(' ');
    expect(c7('ice')).toContain('얼음 지대');
    expect(c7('ilkkun')).toContain('일꾼-3');
    expect(c7('third')).toContain('짐');
  });

  it('떠난 뒤의 서술은 돌아오지 못한다는 결과를 분명히 말한다', () => {
    for (const ch of SAC_CHAPTERS) {
      for (const id of CANDIDATE_IDS) {
        const name = CANDIDATES[id].name;
        const after = SACRIFICE[ch].after(name).join(' ');
        expect(after).toContain(name);
        expect(after).toMatch(/모른다|열리지|돌아오지|몫이다/);
        expect(DAM_GRIEF[ch](name)).toContain(name);
        expect(REMEMBER[ch](name)).toContain(name);
      }
    }
  });

  it('이름 뒤 조사가 받침에 맞는다(하린이 / 태오가)', () => {
    expect(SACRIFICE.C7.after('하린').join(' ')).toContain('하린이');
    expect(SACRIFICE.C7.after('태오').join(' ')).toContain('태오가');
    expect(DAM_GRIEF.C6('태오')).toContain('태오가');
  });
});
