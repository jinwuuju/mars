import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CREW_TYPE, crewReasons, FIGURES, INTERP, TYPE_INFO, typeCompat } from '../src/story/typeinfo';
import { decodeFriend } from '../src/ui/results';

const doc = readFileSync(join(__dirname, '..', 'design', '05_RESULTS_AND_POSTGAME_v2.md'), 'utf8');
const TYPES = ['ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP', 'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'];

describe('결과지 데이터가 05 설계 문서 원문과 일치한다', () => {
  it('유형 이름·한 줄·맡기 좋은 일 16개가 문서 표와 같다', () => {
    for (const t of TYPES) {
      const i = TYPE_INFO[t];
      expect(doc).toContain(`| ${t} | ${i.name} | ${i.line} | ${i.job} |`);
    }
  });
  it('닮은 역사 인물 16명이 문서 표와 같다', () => {
    for (const t of TYPES) expect(doc).toContain(`| ${t} | ${FIGURES[t].name} | ${FIGURES[t].hook} |`);
  });
  it('승무원 작업 스타일이 문서와 같다', () => {
    const s = Object.entries(CREW_TYPE).map(([k, v]) => ({ harin: '하린', taeo: '태오', seojin: '서진', woojoo: '진우주', dodam: '도담', jio: '지오', dam: '담' } as Record<string, string>)[k] + ' ' + v);
    s.forEach((x) => expect(doc).toContain(x));
  });
  it('해석 문장(의미·반대쪽도 괜찮은 이유)이 문서 표에 있다', () => {
    for (const v of Object.values(INTERP)) {
      for (const side of [v.plus, v.minus]) {
        expect(doc).toContain(side.meaning);
        expect(doc).toContain(side.other);
      }
    }
  });
});

describe('궁합 규칙 (05 §4)', () => {
  it('INTJ: 편한 짝 ENTJ·INFJ / 배울 게 많은 짝 ISFJ·ESFJ / 부딪히기 쉬운 짝 INTP·ENTP', () => {
    expect(typeCompat('INTJ')).toEqual({ easy: ['ENTJ', 'INFJ'], learn: ['ISFJ', 'ESFJ'], clash: ['INTP', 'ENTP'] });
  });
  it('모든 유형에서 짝은 서로 다르고 자기 자신이 아니며 16유형 안에 있다', () => {
    for (const t of TYPES) {
      const c = typeCompat(t);
      const all = [...c.easy, ...c.learn, ...c.clash];
      expect(new Set(all).size).toBe(6);
      all.forEach((x) => { expect(TYPES).toContain(x); expect(x).not.toBe(t); });
      c.easy.concat(c.learn).forEach((x) => expect(x[3]).toBe(t[3]));
      c.clash.forEach((x) => expect(x[3]).not.toBe(t[3]));
    }
  });
  it('동료 궁합: 일치 수와 이유 문장(말버릇 포함)', () => {
    expect(crewReasons('woojoo', ['E', 'N', 'F', 'P']).match).toBe(4);
    const r = crewReasons('taeo', ['E', 'N', 'F', 'P']);
    expect(r.match).toBe(0);
    expect(r.lines.join(' ')).toContain('자, 순서대로');
    expect(crewReasons('dam', [null, null, null, null]).known).toBe(0);
    expect(crewReasons('harin', ['E', null, 'F', null])).toMatchObject({ match: 2, known: 2 });
  });
});

describe('친구 결과 코드 (예: ML-7Q2K-INTJ)', () => {
  it('문서 예시 형식을 읽는다', () => {
    const v = decodeFriend('ML-7Q2K-INTJ');
    expect(v?.type).toBe('INTJ');
    expect(v?.m).toHaveLength(4);
    v?.m.forEach((x) => { expect(x).not.toBeNull(); expect(Math.abs(x as number)).toBeLessThanOrEqual(1); });
  });
  it('근거 부족 축(0)과 X·? 글자를 허용하고, 형식이 틀리면 null', () => {
    const v = decodeFriend('ml-0i0z-X?FP');
    expect(v?.m[0]).toBeNull();
    expect(v?.m[1]).toBeCloseTo(0, 5);
    expect(v?.m[3]).toBeCloseTo(1, 5);
    expect(v?.type).toBe('X?FP');
    expect(decodeFriend('MLE1-aaaaaaa')).toBeNull();
    expect(decodeFriend('ML-7Q2K-ABCD')).toBeNull();
  });
});
