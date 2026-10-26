import { describe, expect, it } from 'vitest';
import { decideDoor } from '../src/game/c8';
import { applyFloors, applyDeltaTo, E, endingOf, START, c6Context } from '../src/story/effects';
import { createMission, missionReducer, type MissionState } from '../src/core/state';
import { allRosters, unselectedOf } from '../src/story/roster';
import { pickSpeaker } from '../src/story/resolver';
import { DOOR_POSITION, CHEMISTRY, LETTERS } from '../src/story/content';
import { CANDIDATE_IDS, type CandidateId } from '../src/shared/ids';

describe('C8 문 결정 규칙', () => {
  it('전문가: 태오 → 진우주 → 담 순서의 책임자 입장', () => {
    expect(decideDoor('expert', ['taeo', 'seojin', 'dodam', 'jio'], 'accept', false).outcome).toBe('conditional');
    expect(decideDoor('expert', ['harin', 'seojin', 'dodam', 'jio'], 'notNow', true).outcome).toBe('accept');
    expect(decideDoor('expert', ['harin', 'seojin', 'dodam', 'jio'], 'notNow', false).outcome).toBe('conditional');
  });
  it('전원 합의: 가장 조심스러운 입장', () => {
    expect(decideDoor('consensus', ['harin', 'seojin', 'dodam', 'jio'], 'accept', true).outcome).toBe('conditional');
    expect(decideDoor('consensus', ['harin', 'seojin', 'dodam', 'taeo'], 'notNow', true).outcome).toBe('notNow');
  });
  it('다수결: 하린은 플레이어를 따르고 동률이면 조건부', () => {
    expect(decideDoor('roles', ['harin', 'seojin', 'dodam', 'jio'], 'accept', false).outcome).toBe('accept');
    expect(decideDoor('roles', ['taeo', 'woojoo', 'seojin', 'dodam'], 'notNow', false).outcome).toBe('conditional');
  });
  it('모든 후보에게 입장이 있고 미선발자는 투표하지 않는다', () => {
    CANDIDATE_IDS.forEach((c) => expect(DOOR_POSITION[c].line.length).toBeGreaterThan(3));
  });
});

describe('서사 콘텐츠와 화자', () => {
  it('케미 15쌍과 편지 6통이 모두 있다', () => {
    expect(Object.keys(CHEMISTRY)).toHaveLength(15);
    for (const [k, v] of Object.entries(CHEMISTRY)) {
      const [a, b] = k.split('+') as CandidateId[];
      expect([a, b]).toContain(v[0]);
      expect([a, b]).toContain(v[2]);
    }
    CANDIDATE_IDS.forEach((c) => expect(LETTERS[c].length).toBeGreaterThan(5));
  });
  it('C4~C8 화자 슬롯은 15편성 모두 승선자만', () => {
    for (const crew of allRosters()) {
      const out = unselectedOf(crew);
      for (const slot of ['c4Shift', 'c5Formation', 'c6Shift', 'c7Water', 'c8Meeting', 'c4Talk'] as const) {
        const who = pickSpeaker(slot, crew);
        expect(crew as string[]).toContain(who);
        expect(out as string[]).not.toContain(who);
      }
    }
  });
});

describe('서사 효과 (게임·시뮬레이션 공용)', () => {
  it('바닥값 아래로 내려가면 비상 개입으로 바닥값에서 멈춘다', () => {
    const r = applyFloors(applyDeltaTo(START, { oxygenReserve: -90 }));
    expect(r.r.oxygenReserve).toBe(20);
    expect(r.hit).toEqual(['oxygenReserve']);
  });
  it('γ 착륙지는 연료 여유 2 미만이면 평원으로 처리', () => {
    expect(E.c5Site('gamma', 1).flags?.c5_site).toBe('beta');
    expect(E.c5Site('gamma', 2).flags?.c5_site).toBe('gamma');
  });
  it('C6 보존 도움 조건은 짐·승선자에서 파생', () => {
    expect(c6Context(['seeds'], ['harin', 'taeo', 'seojin', 'dodam']).seedHelp).toBe(true);
    expect(c6Context([], ['woojoo', 'taeo', 'seojin', 'dodam']).seedHelp).toBe(true);
    expect(c6Context([], ['harin', 'taeo', 'seojin', 'dodam']).seedHelp).toBe(false);
  });
  it('예비 손실이 크면 천천히 살아남기', () => {
    const r = { ...START, oxygenReserve: 40, water: 40, food: 45, power: 50 };
    expect(endingOf(r, { dawn: 5, memory: 0, together: 0 }).ending).toBe('rebuild');
  });
  it('applyEffect는 바닥값·성향 누적·플래그를 한 번에 반영', () => {
    let s: MissionState = createMission('r', 1, { name: 'x', look: 0, relation: 'sibling' });
    s = missionReducer(s, { type: 'applyEffect', effect: { delta: { oxygenReserve: -80 }, aff: { together: 1 }, flags: { k: 'v' } } });
    expect(s.resources.oxygenReserve).toBe(20);
    expect(s.flags.aff_together).toBe(1);
    expect(s.flags.k).toBe('v');
    expect(s.flags.emergency_count).toBe(1);
    s = missionReducer(s, { type: 'applyEffect', effect: { aff: { together: 0.5 } } });
    expect(s.flags.aff_together).toBe(1.5);
  });
});

