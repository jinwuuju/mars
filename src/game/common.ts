import type { App, ForkSpec } from './app';
import type { Dim } from '../analytics/opportunities';
import type { Effect } from '../story/effects';
import { pickSpeaker, type SlotId } from '../story/resolver';
import { perspectivePanel, tabPanel } from '../ui/panels';
import { pxImg } from '../ui/dom';
import { portraitURL } from '../art/sprites';
import { CHEMISTRY } from '../story/content';
import { CANDIDATE_IDS, type CandidateId, type ChapterId } from '../shared/ids';
import { REFLECTIONS } from '../story/reflect';
import { CANDIDATES } from '../story/candidates';
import { iGa } from '../story/josa';
import { aliveCrew, DAM_GRIEF, GRIEF, LAST_WORDS, MEMORY, rapport, REMEMBER, SACRIFICE, type SacChapter } from '../story/sacrifice';
import { sacrificePanel } from '../ui/sacrifice';
import type { BunkerScene } from '../world/BunkerScene';
import type { Line } from '../ui/dialogue';
import { mulberry32, hashString } from '../shared/rng';

/** 이미 물어본 포크는 다시 묻지 않는다(새로고침 안전). 답은 반환하지만 상태에는 같은 값('asked')만 남긴다(측정 중립성). */
export async function askFork(app: App, spec: Omit<ForkSpec, 'options'> & { plus: string; minus: string }): Promise<'plus' | 'minus' | null> {
  const key = `ask_${spec.optionSetId}`;
  if (app.mission.state.flags[key] === true) return null;
  const id = await app.fork({ ...spec, options: [{ id: 'plus', label: spec.plus, pole: 1 }, { id: 'minus', label: spec.minus, pole: -1 }] });
  app.mission.dispatch({ type: 'flag', key, value: true });
  return id === 'plus' ? 'plus' : 'minus';
}

export async function infoTabs(app: App, o: { opp: string; setId: string; title: string; sLabel: string; sLines: string[]; nLabel: string; nLines: string[]; scene: string }): Promise<void> {
  await tabPanel(app.modals, {
    title: o.title,
    tabs: [{ key: 'S', label: o.sLabel, lines: o.sLines }, { key: 'N', label: o.nLabel, lines: o.nLines }],
    order: app.order(o.setId, 2),
    onPick: (key, pos, first) => app.recordAct({
      opportunityId: o.opp, dim: 'SN' as Dim, kind: 'tab', pole: key === 'N' ? 1 : -1,
      actKey: first ? `${o.setId}:first` : `${o.setId}:${key}:more`, secondary: !first,
      displayPosition: pos, optionSetId: o.setId, label: key === 'N' ? `${o.nLabel} 먼저` : `${o.sLabel} 먼저`,
      otherLabel: key === 'N' ? o.sLabel : o.nLabel, scene: o.scene,
    }),
  });
}

export interface RequestSpec {
  opp: string; setId: string; slot: SlotId; title: string; request: string;
  tLabel: string; tLines: string[]; fLabel: string; fLines: string[];
  adjust: string; keep: string; adjustReply: string; keepReason: string; scene: string;
}

/** 관점 패널(O05): 요청 + 선택 자료 2개 + 동등한 결정 2개. 두 결정 모두 같은 온도로 끝난다. */
export async function requestPanel(app: App, s: RequestSpec): Promise<void> {
  const key = `ask_${s.setId}`;
  if (app.mission.state.flags[key] === true) return;
  const who = pickSpeaker(s.slot, aliveCrew(app.mission.state));
  const info = app.speaker(who);
  const d = await perspectivePanel(app.modals, {
    title: s.title,
    portrait: info.look ? pxImg(portraitURL(info.look, 'worry'), info.name, 'mini') : null,
    who: info.name, request: s.request,
    info: [{ key: 'T', label: s.tLabel, lines: [...s.tLines, '두 선택 모두 안전 기준을 만족해요.'] }, { key: 'F', label: s.fLabel, lines: [`${info.name}: ${s.fLines[0]}`, ...s.fLines.slice(1), '두 선택 모두 안전 기준을 만족해요.'] }],
    infoOrder: app.order(`${s.setId}-info`, 2),
    decisions: [{ id: 'adjust', label: s.adjust }, { id: 'keep', label: s.keep }],
    decisionOrder: app.order(`${s.setId}-decision`, 2),
    onInfo: (k, pos, first) => app.recordAct({
      opportunityId: s.opp, dim: 'TF', kind: 'tab', pole: k === 'F' ? 1 : -1,
      actKey: first ? `${s.setId}-info:first` : `${s.setId}-info:${k}:more`, secondary: !first,
      displayPosition: pos, optionSetId: `${s.setId}-info`, label: k === 'F' ? `${s.fLabel.replace(' 보기', '')} 먼저` : `${s.tLabel.replace(' 보기', '')} 먼저`,
      otherLabel: k === 'F' ? s.tLabel.replace(' 보기', '') : s.fLabel.replace(' 보기', ''), scene: s.scene,
    }),
    onDecide: (id, pos) => app.recordAct({
      opportunityId: s.opp, dim: 'A', kind: 'fork', pole: id === 'adjust' ? 1 : -1, actKey: `fork:${s.setId}`,
      displayPosition: pos, optionSetId: `${s.setId}-decision`, label: id === 'adjust' ? s.adjust : s.keep,
      otherLabel: id === 'adjust' ? s.keep : s.adjust, scene: s.scene,
    }),
  });
  if (d === 'adjust') await app.say([{ who, text: s.adjustReply, expr: 'relief' }]);
  else await app.say([{ who: 'noknok', text: s.keepReason }, { who, text: '아, 그런 이유면 괜찮아.', expr: 'relief' }]);
  app.mission.dispatch({ type: 'flag', key, value: true });
}

/** 서사 효과를 한 번만 적용한다(새로고침 안전) */
export function applyOnce(app: App, key: string, effect: Effect): void {
  const k = `fx_${key}`;
  if (app.mission.state.flags[k] === true) return;
  app.mission.dispatch({ type: 'applyEffect', effect });
  app.mission.dispatch({ type: 'flag', key: k, value: true });
}

/** 승선 4명 중 시드로 고른 케미 쌍 n개 */
export function chemistryPairs(app: App, n: number, salt: string): [CandidateId, string, CandidateId, string][] {
  const crew = [...aliveCrew(app.mission.state)].sort((a, b) => CANDIDATE_IDS.indexOf(a) - CANDIDATE_IDS.indexOf(b));
  const pairs: string[] = [];
  for (let i = 0; i < crew.length; i += 1) for (let j = i + 1; j < crew.length; j += 1) pairs.push(`${crew[i]}+${crew[j]}`);
  const r = mulberry32((app.mission.state.runSeed ^ hashString(salt)) >>> 0);
  const picked: [CandidateId, string, CandidateId, string][] = [];
  const keys: string[] = [];
  while (picked.length < n && pairs.length) {
    const k = pairs.splice(Math.floor(r() * pairs.length), 1)[0];
    keys.push(k);
    picked.push(CHEMISTRY[k]);
  }
  markSeen(app, 'chem_seen', keys);
  return picked;
}

/** 기록실(케미 앨범·지구 조각)용: 본 장면 키를 서사 플래그에 모은다(측정과 무관) */
export function markSeen(app: App, key: string, add: string[]): void {
  let cur: string[] = [];
  try { const v: unknown = JSON.parse(String(app.mission.state.flags[key] ?? '[]')); if (Array.isArray(v)) cur = v.filter((x): x is string => typeof x === 'string'); } catch { cur = []; }
  const next = [...new Set([...cur, ...add])];
  if (next.length !== cur.length) app.mission.dispatch({ type: 'flag', key, value: JSON.stringify(next) });
}

export function crewPick(app: App, salt: string): CandidateId {
  const crew = aliveCrew(app.mission.state);
  const r = mulberry32((app.mission.state.runSeed ^ hashString(salt)) >>> 0);
  return crew[Math.floor(r() * crew.length)];
}

export { pickSpeaker };

/**
 * 생각의 시간(장마다 한 번): 정답 없는 짧은 철학·윤리 질문.
 * 이야기 플래그로만 남기고 성격 점수·자원·엔딩에는 쓰지 않는다. 이미 답했으면 다시 묻지 않는다(새로고침 안전).
 */
export async function reflect(app: App, ch: ChapterId): Promise<void> {
  const r = REFLECTIONS[ch];
  const key = `reflect_${ch}`;
  if (!r || typeof app.mission.state.flags[key] === 'string') return;
  await app.say([{ who: 'narrator', text: '✦ 생각의 시간 — 정답은 없어요. 고른 생각은 성격 결과에 쓰이지 않아요.' }]);
  const id = await app.dialogue.choose({ who: r.who, text: r.question }, r.options.map((o) => ({ id: o.id, label: o.label })), 'reflect');
  app.mission.dispatch({ type: 'flag', key, value: id });
  const o = r.options.find((x) => x.id === id) ?? r.options[0];
  await app.say([{ who: r.who, text: o.reply }, { who: 'noknok', text: `생각 한 조각: ${r.thought}` }]);
}

/**
 * 희생(C5·C6·C7, 이야기 전용): 남은 동료 중 한 명을 보낸다. 결과를 먼저 남기고(새로고침 안전) 마지막 말과 퇴장을 보여 준다.
 * '내가 가겠다'를 고르면 라포가 가장 높은 동료가 대신 나선다. 성격 점수·자원·엔딩에는 쓰지 않는다.
 */
export async function sacrificeStep(app: App, ch: SacChapter, scene: BunkerScene | null, exit?: { x: number; y: number }): Promise<void> {
  const key = `lost_${ch}`;
  const prev = app.mission.state.flags[key];
  if (typeof prev === 'string') {
    // 고른 뒤 작별 장면 도중 새로고침했다면 작별을 다시 보여 준다(사람이 말없이 사라지지 않게)
    if (app.mission.state.flags[`${key}_mourned`] !== true && (CANDIDATE_IDS as readonly string[]).includes(prev)) {
      await farewellScene(app, ch, prev as CandidateId, String(app.mission.state.flags[`${key}_how`] ?? 'chosen'), scene, exit);
    }
    return;
  }
  const alive = aliveCrew(app.mission.state);
  if (!alive.length) return;
  const def = SACRIFICE[ch];
  await app.say(def.setup(app.mission.state.flags));
  const pick = await sacrificePanel(app.modals, { title: def.title, ask: def.ask, people: alive.map((id) => ({ id, rapport: rapport(app.mission.state, id) })) });
  const m = app.mission.state;
  const byRapport = [...alive].sort((a, b) => rapport(m, b) - rapport(m, a));
  const lot = alive[Math.floor(mulberry32((m.runSeed ^ hashString(`lot-${ch}`)) >>> 0)() * alive.length)];
  const who: CandidateId = pick === 'lot' ? lot : pick === 'me' ? byRapport[0] : pick;
  app.mission.dispatch({ type: 'flag', key, value: who });
  app.mission.dispatch({ type: 'flag', key: `${key}_how`, value: pick === 'lot' || pick === 'me' ? pick : 'chosen' });
  await farewellScene(app, ch, who, pick === 'lot' || pick === 'me' ? pick : 'chosen', scene, exit);
}

/** 작별 장면: 마지막 말 → 떠나는 모습과 그 결과 → 회상 → 남은 사람들의 반응. [대화 넘기기]를 보여 주지 않는다 */
async function farewellScene(app: App, ch: SacChapter, who: CandidateId, pick: string, scene: BunkerScene | null, exit?: { x: number; y: number }): Promise<void> {
  const m = app.mission.state;
  const def = SACRIFICE[ch];
  const name = CANDIDATES[who].name;
  const lines: Line[] = [];
  if (pick === 'lot') lines.push({ who: 'narrator', text: '제비를 뽑는다. 손이 떨린다.' }, { who: 'narrator', text: `${iGa(name)} 뽑혔다.` });
  if (pick === 'me') lines.push({ who: 'player', text: '내가 갈게.' }, { who, text: '아니. 네가 가면 안 돼. 네가 남아야 다들 버텨.', expr: 'worry' });
  lines.push({ who, text: rapport(m, who) >= 3 ? LAST_WORDS[who].high : LAST_WORDS[who].low, expr: 'relief' });
  await app.say(lines, { noSkip: true });
  if (scene?.hasActor(who)) {
    scene.emote(who, '💔');
    await scene.exitActor(who, exit);
  }
  await app.say(def.after(name).map((text) => ({ who: 'narrator', text })), { noSkip: true });
  // 남은 사람들: 잠깐의 침묵 → 회상 → 두 사람의 반응 → 담 → 나
  const left = aliveCrew(app.mission.state).filter((c) => c !== who);
  const mourners = [...left].sort((a, b) => rapport(m, b) - rapport(m, a)).slice(0, 2);
  await app.say([
    { who: 'narrator', text: '한동안 아무도 말하지 않는다. 헬멧 안에서 숨소리만 크게 들린다.' },
    { who: 'narrator', text: MEMORY[who] },
    ...mourners.map((c): Line => ({ who: c, text: GRIEF[c](name), expr: 'worry' })),
    { who: 'dam', text: DAM_GRIEF[ch](name), expr: 'worry' },
    { who: 'thought', text: pick === 'me' ? `내가 가겠다고 했는데. ...${name}의 마지막 말을 잊지 말자.` : `${name}의 마지막 말을 잊지 말자. 여기서 멈추면, 그 선택이 헛것이 된다.` },
  ], { noSkip: true });
  app.mission.dispatch({ type: 'flag', key: `lost_${ch}_mourned`, value: true });
}

/** 장이 시작될 때 앞 장에서 떠난 사람을 한 번 떠올린다(남은 사람이 너무 초연해 보이지 않게) */
export async function rememberLost(app: App, prevCh: SacChapter): Promise<void> {
  const who = app.mission.state.flags[`lost_${prevCh}`];
  const key = `remember_${prevCh}`;
  if (typeof who !== 'string' || !(CANDIDATE_IDS as readonly string[]).includes(who) || app.mission.state.flags[key] === true) return;
  const name = CANDIDATES[who as CandidateId].name;
  const speaker = aliveCrew(app.mission.state)[0];
  await app.say([
    { who: 'narrator', text: REMEMBER[prevCh](name) },
    ...(speaker ? [{ who: speaker, text: `...${name} 생각 나? 나는 계속 나.`, expr: 'worry' as const }] : []),
    { who: 'noknok', text: `${name}의 자리는 비워 둘게요. 제 기록에서는 아직 같은 팀이에요.` },
  ]);
  app.mission.dispatch({ type: 'flag', key, value: true });
}
