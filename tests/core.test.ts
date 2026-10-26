import { describe, expect, it } from 'vitest';
import { allRosters, assignSeat, canLock, emptySeats, seatedIds, unassignSeat, unselectedOf } from '../src/story/roster';
import { createMission, missionReducer, CLOCK_FLOOR, type MissionState } from '../src/core/state';
import { CANDIDATES } from '../src/story/candidates';

const player = { name: '테스트', look: 0, relation: 'sibling' as const };
const fresh = (): MissionState => ({ ...createMission('run', 1, player), fsm: 'c1_explore' });

describe('승선 명단 (6명 중 정확히 4명)', () => {
  it('6C4 = 15가지 조합이 모두 다르고 4명이다', () => {
    const r = allRosters();
    expect(r).toHaveLength(15);
    expect(new Set(r.map((x) => x.join(','))).size).toBe(15);
    r.forEach((x) => expect(new Set(x).size).toBe(4));
  });

  it('0~3명일 때는 확정할 수 없다', () => {
    let seats = emptySeats();
    expect(canLock(seats)).toBe(false);
    (['harin', 'taeo', 'seojin'] as const).forEach((id) => {
      seats = assignSeat(seats, id);
      expect(canLock(seats)).toBe(false);
    });
    seats = assignSeat(seats, 'jio');
    expect(canLock(seats)).toBe(true);
  });

  it('5번째 배정은 빈 자리가 없으면 무시된다', () => {
    let seats = emptySeats();
    (['harin', 'taeo', 'seojin', 'woojoo'] as const).forEach((id) => { seats = assignSeat(seats, id); });
    expect(assignSeat(seats, 'jio')).toBe(seats);
  });

  it('같은 사람을 두 번 앉힐 수 없고, 자리 지정 시 맞바꾼다', () => {
    let seats = assignSeat(emptySeats(), 'harin', 0);
    seats = assignSeat(seats, 'taeo', 1);
    seats = assignSeat(seats, 'harin', 1);
    expect(seats.slice(0, 2)).toEqual(['taeo', 'harin']);
    expect(seatedIds(assignSeat(seats, 'harin'))).toEqual(['taeo', 'harin']);
  });

  it('점유된 자리에 새 사람을 지정하면 교체된다', () => {
    let seats = assignSeat(emptySeats(), 'harin', 2);
    seats = assignSeat(seats, 'dodam', 2);
    expect(seatedIds(seats)).toEqual(['dodam']);
  });

  it('내리기(취소)가 동작한다', () => {
    const seats = unassignSeat(assignSeat(emptySeats(), 'jio'), 'jio');
    expect(seatedIds(seats)).toEqual([]);
  });

  it('미선발 2명을 정확히 계산한다', () => {
    expect(unselectedOf(['harin', 'taeo', 'seojin', 'woojoo'])).toEqual(['dodam', 'jio']);
  });
});

describe('MissionState 리듀서', () => {
  it('4명이 차지 않으면 lockCrew는 무시된다', () => {
    let s = fresh();
    s = missionReducer(s, { type: 'assign', id: 'harin' });
    expect(missionReducer(s, { type: 'lockCrew' }).crewLocked).toBe(false);
  });

  it('확정 후에는 명단을 바꿀 수 없고 유산 2개가 생긴다', () => {
    let s = fresh();
    (['harin', 'taeo', 'seojin', 'woojoo'] as const).forEach((id) => { s = missionReducer(s, { type: 'assign', id }); });
    s = missionReducer(s, { type: 'lockCrew' });
    expect(s.crewLocked).toBe(true);
    expect(s.crewIds).toEqual(['harin', 'taeo', 'seojin', 'woojoo']);
    expect(s.legacyItemIds).toEqual([CANDIDATES.dodam.legacy.id, CANDIDATES.jio.legacy.id]);
    const after = missionReducer(missionReducer(s, { type: 'unassign', id: 'harin' }), { type: 'assign', id: 'jio', slot: 0 });
    expect(after.crewIds).toEqual(s.crewIds);
  });

  it('15개 조합 모두 확정 가능하고 crewIds가 정확히 일치한다', () => {
    for (const roster of allRosters()) {
      let s = fresh();
      roster.forEach((id) => { s = missionReducer(s, { type: 'assign', id }); });
      s = missionReducer(s, { type: 'lockCrew' });
      expect(s.crewLocked).toBe(true);
      expect([...s.crewIds].sort()).toEqual([...roster].sort());
      expect(s.legacyItemIds).toHaveLength(2);
    }
  });

  it('작별 장면은 명단 확정 전에는 들어갈 수 없다', () => {
    const s = fresh();
    expect(missionReducer(s, { type: 'goto', fsm: 'c1_farewell' }).fsm).toBe('c1_explore');
  });

  it('FSM은 정해진 다음 상태로만 이동한다 (건너뛰기·되돌아가기 금지)', () => {
    let s = { ...createMission('run', 1, player), fsm: 'c1_tutorial' as const } as MissionState;
    expect(missionReducer(s, { type: 'goto', fsm: 'c1_seating' }).fsm).toBe('c1_tutorial');
    s = missionReducer(s, { type: 'goto', fsm: 'c1_explore' });
    expect(s.fsm).toBe('c1_explore');
    expect(missionReducer(s, { type: 'goto', fsm: 'c1_tutorial' }).fsm).toBe('c1_explore');
  });

  it('서사 시계는 바닥값 아래로 내려가지 않는다 (실시간 실패 판정 없음)', () => {
    let s = fresh();
    for (let i = 0; i < 100; i += 1) s = missionReducer(s, { type: 'tick', minutes: 30 });
    expect(s.narrativeClock).toBe(CLOCK_FLOOR);
  });

  it('저장 슬롯에 편성을 저장하고 불러올 수 있다', () => {
    let s = fresh();
    (['dodam', 'jio'] as const).forEach((id) => { s = missionReducer(s, { type: 'assign', id }); });
    s = missionReducer(s, { type: 'saveRoster', slot: 1 });
    s = missionReducer(s, { type: 'unassign', id: 'dodam' });
    s = missionReducer(s, { type: 'loadRoster', slot: 1 });
    expect(s.crewIds).toEqual(['dodam', 'jio']);
  });
});
