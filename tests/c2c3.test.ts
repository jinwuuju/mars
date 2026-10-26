import { describe, expect, it } from 'vitest';
import { autoBalance, canStow, cargoPool, checkLayout, defaultJettison, itemsOf, jettisonOk, REQUESTS, spareValvePlan, BAG_TALK } from '../src/story/cargo';
import { createMission, missionReducer, type MissionState } from '../src/core/state';
import { allRosters, unselectedOf } from '../src/story/roster';
import { eulReul, iGa, eunNeun, waGwa } from '../src/story/josa';
import { pickSpeaker } from '../src/story/resolver';
import type { CandidateId } from '../src/shared/ids';

const player = { name: '테스트', look: 0, relation: 'sibling' as const };

function lockedAt(fsm: MissionState['fsm'], crew: CandidateId[] = ['harin', 'taeo', 'seojin', 'woojoo']): MissionState {
  let s: MissionState = { ...createMission('r', 1, player), fsm: 'c1_explore' };
  crew.forEach((id) => { s = missionReducer(s, { type: 'assign', id }); });
  s = missionReducer(s, { type: 'lockCrew' });
  return { ...s, fsm, flags: { ...s.flags, c1_seated: true } };
}

describe('조사 자동 처리', () => {
  it('받침 유무에 맞는 조사', () => {
    expect(eulReul('개인 사진')).toBe('개인 사진을');
    expect(eulReul('목소리 드라이브')).toBe('목소리 드라이브를');
    expect(iGa('하린')).toBe('하린이');
    expect(iGa('진우주')).toBe('진우주가');
    expect(eunNeun('태오')).toBe('태오는');
    expect(waGwa('도담')).toBe('도담과');
  });
});

describe('C2 수하물 규칙', () => {
  it('짐 후보: 기본 8 + (진우주 탑승 시 녹차 티백) + 유산 2', () => {
    expect(cargoPool(['harin', 'taeo', 'seojin', 'woojoo'])).toHaveLength(11);
    expect(cargoPool(['harin', 'taeo', 'seojin', 'dodam'])).toHaveLength(10);
    for (const crew of allRosters()) {
      const pool = cargoPool(crew);
      const legacy = pool.filter((p) => p.owner);
      expect(legacy.map((l) => l.owner).sort()).toEqual([...unselectedOf(crew)].sort());
    }
  });

  it('무게 규칙: 총 12kg, 각 칸 7kg, 좌우 차 4kg (0.1kg 단위)', () => {
    expect(canStow([4])).toBe(true);
    expect(canStow([4, 4, 4])).toBe(false);
    expect(canStow([4, 4, 2, 2])).toBe(true);
    expect(canStow([4, 4, 2, 2, 0.1])).toBe(false);
    expect(checkLayout([{ kg: 4 }, { kg: 3 }], [{ kg: 3 }]).ok).toBe(true);
    expect(checkLayout([{ kg: 4 }, { kg: 4 }], []).reason).toContain('왼쪽');
    expect(checkLayout([{ kg: 4 }, { kg: 1 }], []).reason).toContain('좌우');
  });

  it('자동 균형은 물품 선택을 바꾸지 않고 좌우만 다시 나눈다', () => {
    const items = [{ id: 'parts', kg: 4 }, { id: 'filter', kg: 4 }, { id: 'music', kg: 2 }, { id: 'seeds', kg: 2 }];
    const r = autoBalance(items);
    expect(r).not.toBeNull();
    if (r) {
      expect([...r.left, ...r.right].sort()).toEqual(items.map((i) => i.id).sort());
      const kg = (ids: string[]): { kg: number }[] => ids.map((id) => items.find((i) => i.id === id) as { kg: number });
      expect(checkLayout(kg(r.left), kg(r.right)).ok).toBe(true);
    }
    expect(autoBalance([{ id: 'a', kg: 4 }, { id: 'b', kg: 4 }, { id: 'c', kg: 4 }])).toBeNull();
  });

  it('요청과 짐 이야기는 6명 모두에게 있고, 요청 물품은 그 사람이 탔을 때 후보 목록에 있다', () => {
    for (const crew of allRosters()) {
      const ids = cargoPool(crew).map((p) => p.id);
      crew.forEach((c) => {
        expect(ids).toContain(REQUESTS[c].item);
        expect(BAG_TALK[c].length).toBeGreaterThan(5);
      });
    }
  });

  it('봉인: 규칙 위반·후보 밖 물품·중복·잠금 전은 거부, 올바르면 inventory 저장', () => {
    const s = lockedAt('c2_cargo');
    expect(missionReducer(s, { type: 'sealCargo', items: ['parts', 'filter', 'soil', 'photo', 'teabag'] })).toBe(s);
    expect(missionReducer(s, { type: 'sealCargo', items: ['parts', 'filter', 'games', 'sewing'] })).toBe(s);
    expect(missionReducer(s, { type: 'sealCargo', items: ['legacy_muffler'] })).toBe(s);
    expect(missionReducer(s, { type: 'sealCargo', items: ['photo', 'photo'] })).toBe(s);
    const ok = missionReducer(s, { type: 'sealCargo', items: ['parts', 'photo', 'teabag', 'legacy_voices'] });
    expect(ok.inventoryIds).toEqual(['parts', 'photo', 'teabag', 'legacy_voices']);
    expect(ok.flags.c2_sealed).toBe(true);
    expect(missionReducer(ok, { type: 'sealCargo', items: [] })).toBe(ok);
    const notLocked = { ...createMission('r', 1, player), fsm: 'c2_cargo' as const };
    expect(missionReducer(notLocked, { type: 'sealCargo', items: [] })).toBe(notLocked);
  });
});

describe('C3 예비 밸브 규칙 (게임과 시뮬레이션 공용)', () => {
  const crew: CandidateId[] = ['harin', 'taeo', 'seojin', 'woojoo'];
  it('예비 부품이 있으면 부품만 소모하고 투하 없음', () => {
    expect(spareValvePlan(['parts', 'photo'], crew)).toEqual({ consume: 'parts', needKg: 0 });
  });
  it('없으면 3kg 이상 투하, 짐이 3kg 미만이면 전부', () => {
    expect(spareValvePlan(['filter', 'photo'], crew).needKg).toBe(3);
    expect(spareValvePlan(['photo', 'teabag'], crew).needKg).toBeCloseTo(1.1, 5);
    expect(spareValvePlan([], crew).needKg).toBe(0);
    expect(jettisonOk(['filter', 'photo'], ['photo'], crew)).toBe(false);
    expect(jettisonOk(['filter', 'photo'], ['filter'], crew)).toBe(true);
    expect(jettisonOk(['filter'], ['soil'], crew)).toBe(false);
    const d = defaultJettison(['photo', 'music', 'seeds'], crew);
    expect(jettisonOk(['photo', 'music', 'seeds'], d, crew)).toBe(true);
  });
  it('removeItems는 실제로 실은 물품만 뺀다', () => {
    const s = { ...lockedAt('c3_scale'), inventoryIds: ['parts', 'photo'] };
    expect(missionReducer(s, { type: 'removeItems', items: ['parts'] }).inventoryIds).toEqual(['photo']);
    expect(missionReducer(s, { type: 'removeItems', items: ['soil'] })).toBe(s);
  });
});

describe('FSM C2~C3 전이와 조건', () => {
  it('조건을 채워야 다음 단계로 간다', () => {
    let s = lockedAt('c2_cargo');
    expect(missionReducer(s, { type: 'goto', fsm: 'c2_sealed' }).fsm).toBe('c2_cargo');
    s = missionReducer(s, { type: 'sealCargo', items: ['photo'] });
    expect(missionReducer(s, { type: 'goto', fsm: 'c2_sealed' }).fsm).toBe('c2_cargo');
    s = missionReducer(s, { type: 'flag', key: 'c2_after_done', value: true });
    s = missionReducer(s, { type: 'goto', fsm: 'c2_sealed' });
    expect(s.fsm).toBe('c2_sealed');
    expect(s.chapter).toBe('C2');
    s = missionReducer(s, { type: 'goto', fsm: 'c3_preflight' });
    expect(s.chapter).toBe('C3');
    s = missionReducer(s, { type: 'goto', fsm: 'c3_diagnose' });
    expect(missionReducer(s, { type: 'goto', fsm: 'c3_scale' }).fsm).toBe('c3_diagnose');
    s = missionReducer(missionReducer(s, { type: 'flag', key: 'c3_diagnosed', value: true }), { type: 'goto', fsm: 'c3_scale' });
    expect(missionReducer(s, { type: 'goto', fsm: 'c3_ignition' }).fsm).toBe('c3_scale');
    s = missionReducer(missionReducer(s, { type: 'flag', key: 'c3_fix', value: 'recal' }), { type: 'goto', fsm: 'c3_ignition' });
    s = missionReducer(missionReducer(s, { type: 'flag', key: 'c3_ignited', value: true }), { type: 'goto', fsm: 'c3_ascent' });
    s = missionReducer(missionReducer(s, { type: 'flag', key: 'c3_launched', value: true }), { type: 'goto', fsm: 'c4_play' });
    expect(s.fsm).toBe('c4_play');
    expect(s.chapter).toBe('C4');
  });

  it('자원 변화는 0~100 안, 서사 시계는 장마다 바닥값을 가진다', () => {
    let s = lockedAt('c3_scale');
    s = missionReducer(s, { type: 'applyDelta', delta: { habitatIntegrity: -500, power: 999 } });
    expect(s.resources.habitatIntegrity).toBe(0);
    expect(s.resources.power).toBe(100);
    s = missionReducer(s, { type: 'setClock', minutes: 14, floor: 2 });
    for (let i = 0; i < 30; i += 1) s = missionReducer(s, { type: 'tick', minutes: 1 });
    expect(s.narrativeClock).toBe(2);
  });

  it('C2·C3 화자 슬롯은 15편성 모두 승선자만 고른다', () => {
    for (const crew of allRosters()) {
      for (const slot of ['c2BagTalk', 'c2StrapRequest', 'c3PanelRequest', 'c3Comment', 'lastWater'] as const) {
        expect(crew as string[]).toContain(pickSpeaker(slot, crew));
      }
    }
  });

  it('itemsOf는 후보 밖 ID를 무시한다', () => {
    expect(itemsOf(['harin', 'taeo', 'seojin', 'dodam'], ['teabag', 'photo']).map((i) => i.id)).toEqual(['photo']);
  });
});
