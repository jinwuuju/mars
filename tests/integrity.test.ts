import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { OPPORTUNITIES } from '../src/analytics/opportunities';
import { allRosters, unselectedOf } from '../src/story/roster';
import { pickSpeaker, resolveRole, ROLE_PRIORITY, SLOT_PRIORITY, type Role, type SlotId } from '../src/story/resolver';
import { clearSave, loadGame, memoryStorage, saveGame, SAVE_KEY } from '../src/core/persistence';
import { createMission, missionReducer, type MissionState } from '../src/core/state';
import { createMeasurement } from '../src/analytics/measurement';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('구조적 격리: 측정 모듈은 이야기 상태를 import하지 않는다', () => {
  it('src/analytics/*.ts 의 import 대상은 shared 와 analytics 뿐이다', () => {
    const dir = join(root, 'src', 'analytics');
    for (const f of readdirSync(dir)) {
      const text = readFileSync(join(dir, f), 'utf8');
      const imports = [...text.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      imports.forEach((p) => expect(p.startsWith('./') || p.startsWith('../shared/')).toBe(true));
    }
  });
});

describe('BEHAVIOR_MATRIX_v2.csv 와 코드 정의가 일치한다', () => {
  it('48개 ID와 패밀리가 같다', () => {
    const csv = readFileSync(join(root, 'design', '04_BEHAVIOR_MATRIX_v2.csv'), 'utf8').trim().split(/[\r\n]+/).slice(1);
    expect(csv).toHaveLength(48);
    csv.forEach((line, i) => {
      const cols = line.split(',');
      expect(cols[1]).toBe(OPPORTUNITIES[i].id);
      expect(cols[2]).toBe(OPPORTUNITIES[i].family);
    });
  });
});

describe('15편성 화자 해석: 미선발자는 절대 말하지 않는다', () => {
  it('모든 대사 슬롯과 역할에서', () => {
    for (const crew of allRosters()) {
      const out = unselectedOf(crew);
      (Object.keys(SLOT_PRIORITY) as SlotId[]).forEach((slot) => {
        const sp = pickSpeaker(slot, crew);
        expect(out as string[]).not.toContain(sp);
        expect(sp === 'dam' || (crew as string[]).includes(sp)).toBe(true);
      });
      (Object.keys(ROLE_PRIORITY) as Role[]).forEach((role) => {
        const r = resolveRole(role, crew);
        if (r !== null) expect(crew).toContain(r);
      });
    }
  });
});

describe('저장·불러오기', () => {
  const player = { name: '테스트', look: 0, relation: 'friend' as const };

  it('저장한 상태를 그대로 불러온다', () => {
    const st = memoryStorage();
    let m: MissionState = { ...createMission('r', 7, player), fsm: 'c1_explore' };
    m = missionReducer(m, { type: 'assign', id: 'jio' });
    expect(saveGame(st, m, createMeasurement(true))).toBe(true);
    const r = loadGame(st);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bundle.mission.crewIds).toEqual(['jio']);
  });

  it('깨진 JSON, 구버전, 규칙 위반 세이브를 거부한다', () => {
    const st = memoryStorage();
    expect(loadGame(st)).toEqual({ ok: false, reason: 'empty' });
    st.setItem(SAVE_KEY, '{oops');
    expect(loadGame(st).ok).toBe(false);
    st.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 1, festival: true }));
    const old = loadGame(st);
    expect(old.ok === false && old.reason).toBe('oldVersion');
    const m = { ...createMission('r', 7, player), crewLocked: true, crewIds: ['harin'] };
    st.setItem(SAVE_KEY, JSON.stringify({ schemaVersion: 2, savedAt: 0, mission: m, measure: createMeasurement(true) }));
    const bad = loadGame(st);
    expect(bad.ok === false && bad.reason).toBe('invalid');
    clearSave(st);
    expect(loadGame(st)).toEqual({ ok: false, reason: 'empty' });
  });
});
