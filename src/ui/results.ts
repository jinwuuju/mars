import { h, clear, pxImg } from './dom';
import type { MissionState } from '../core/state';
import type { MeasurementState, MeasureEvent } from '../analytics/measurement';
import { AXES, AXIS_LETTERS, toIndex, type Axis, type DimResult, type Report } from '../analytics/scoring';
import { CREW_NAME, CREW_TYPE, crewReasons, DIM_NAME, FIGURES, INTERP, OFFICIAL_NOTE, TF_NOTE, TYPE_INFO, typeCompat, type CrewKey } from '../story/typeinfo';
import { CANDIDATES } from '../story/candidates';
import { CHEMISTRY, DOOR_LABEL, LETTERS, type Door } from '../story/content';
import { itemsOf } from '../story/cargo';
import { iGa } from '../story/josa';
import { unselectedOf } from '../story/roster';
import { ENDING_TEXT } from '../game/c8';
import { REFLECTIONS } from '../story/reflect';
import type { EndingId } from '../story/effects';
import { CANDIDATE_IDS, CHAPTER_IDS, CHAPTER_TITLE, PRESSURE, type CandidateId, type ChapterId } from '../shared/ids';
import { chapterArtURL, domeWindowCanvas } from '../art/vignettes';
import { noknokURL, portraitURL } from '../art/sprites';
import { mirrorURL } from '../art/items';
import { NPC_LOOKS, PLAYER_LOOKS } from '../art/look';

export interface ResultsDeps {
  mission: MissionState;
  measure: MeasurementState;
  report: Report;
  gallery: string[];
  onTitle: () => void;
  onWipe: () => void;
  onReplay: () => void;
}

// ---------- 공통 계산 ----------
const DOTS = ['', '●', '●●', '●●●'];
const CERT = ['', '약한 경향', '경향', '뚜렷함'];
const REAL = (l: string): boolean => l !== '?' && l !== 'X';
const pct = (m: number): number => Math.round(toIndex(m));

export function letterLabel(r: Report['axes'][Axis]): string {
  if (r.byFollowup) return '추가 질문으로 정함';
  if (r.letter === '?') return '근거 부족';
  if (r.letter === 'X') return '거의 동률';
  return CERT[r.certainty] || '약한 경향';
}

/** 궁합·인물 비교용 축 글자: 정해진 글자 → 가까운 쪽 → 없음 */
export function playerAxisLetters(rep: Report): (string | null)[] {
  return AXES.map((a) => (REAL(rep.axes[a].letter) ? rep.axes[a].letter : rep.axes[a].closest));
}

/** 표지에 보여 줄 유형: 한 유형 / 두 유형 사이 / 근거 부족 */
export function typeView(rep: Report): { types: string[]; mode: 'one' | 'between' | 'open' } {
  if (rep.type.closest) return { types: [rep.type.closest], mode: 'one' };
  if (rep.type.candidates.length === 2) return { types: rep.type.candidates, mode: 'between' };
  return { types: [], mode: 'open' };
}

const rangeText = (d: DimResult): string => {
  if (d.resolvedBy === 'followup' && d.index !== null) return `추가 질문으로 정함 · 중심 ${Math.round(d.index)}`;
  if (d.m === null) return '근거 부족';
  const c = pct(d.m);
  if (!d.interval) return `중심 ${c}`;
  return `대략 ${pct(d.interval[0])}~${pct(d.interval[1])} 사이, 중심 ${c}`;
};

function bar(d: DimResult, left: string, right: string): HTMLElement {
  const fu = d.resolvedBy === 'followup' && d.index !== null;
  const c = fu ? Math.round(d.index as number) : d.m === null ? null : pct(d.m);
  const r = !fu && d.interval ? [pct(d.interval[0]), pct(d.interval[1])] : null;
  return h('div', { class: 'rbar', role: 'img', 'aria-label': `${left}에서 ${right} 사이 막대: ${rangeText(d)}` },
    h('span', { class: 'rb-l' }, left),
    h('div', { class: 'rb-track' },
      h('i', { class: 'rb-mid' }),
      r ? h('i', { class: 'rb-range', style: { left: `${r[0]}%`, width: `${Math.max(2, r[1] - r[0])}%` } }) : '',
      c !== null ? h('b', { class: 'rb-dot', style: { left: `${c}%` } }) : ''),
    h('span', { class: 'rb-r' }, right));
}

const primaryEvents = (ms: MeasurementState): MeasureEvent[] => ms.events.filter((e) => !e.secondary && e.weight > 0);
const evidence = (ms: MeasurementState, dim: string, pole: 1 | -1): MeasureEvent[] => primaryEvents(ms).filter((e) => e.dim === dim && e.pole === pole);

function asker(e: MeasureEvent): HTMLElement {
  const who = e.askedBy ?? 'self';
  if (who === 'noknok') return h('span', { class: 'asker' }, pxImg(noknokURL(), '녹녹이', 'mini'), '녹녹이가 물었을 때');
  if (who === 'mirror') return h('span', { class: 'asker' }, pxImg(mirrorURL(), 'MIRROR', 'mini'), 'MIRROR가 물었을 때');
  if (who === 'dam') return h('span', { class: 'asker' }, pxImg(portraitURL(NPC_LOOKS.dam), '담', 'mini'), '담이 물었을 때');
  if (who === 'crew') return h('span', { class: 'asker' }, '동료가 부탁했을 때');
  return h('span', { class: 'asker' }, '스스로 자료를 열었을 때');
}

// ---------- 친구 코드 (05 §4: 예 ML-7Q2K-INTJ) ----------
const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function friendCode(rep: Report): string {
  const q = AXES.map((a) => { const m = rep.axes[a].dim.m; return m === null ? '0' : B36[1 + Math.round(((m + 1) / 2) * 34)]; }).join('');
  return `ML-${q}-${rep.type.strict}`;
}
export function decodeFriend(code: string): { m: (number | null)[]; type: string } | null {
  const x = /^ML-([0-9A-Z]{4})-([EIX?][NSX?][FTX?][JPX?])$/i.exec(code.trim().toUpperCase());
  if (!x) return null;
  const m = x[1].split('').map((ch) => { const v = B36.indexOf(ch); return v <= 0 ? null : ((v - 1) / 34) * 2 - 1; });
  return { m, type: x[2] };
}

// ---------- 공유 카드 (05 §7) ----------
function shareCard(rep: Report, mm: MissionState, ms: MeasurementState): void {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#171D34';
  g.fillRect(0, 0, 1080, 1350);
  g.fillStyle = '#FFF4DA';
  for (let i = 0; i < 140; i += 1) g.fillRect((i * 97) % 1080, (i * 61) % 520, 3, 3);
  g.fillStyle = '#96D9BC';
  g.font = 'bold 44px sans-serif';
  g.fillText('MIRROR: LAST EARTH', 70, 110);
  const look = PLAYER_LOOKS[mm.player.look] ?? PLAYER_LOOKS[0];
  g.drawImage(domeWindowCanvas(look, 6), 700, 150);
  const tv = typeView(rep);
  g.font = 'bold 150px sans-serif';
  AXES.forEach((a, i) => {
    const r = rep.axes[a];
    g.fillStyle = REAL(r.letter) ? '#F48B70' : '#8A93B8';
    g.fillText(r.letter, 70 + i * 140, 330);
    g.font = '34px sans-serif';
    g.fillStyle = '#FFD47B';
    g.fillText(REAL(r.letter) ? DOTS[r.certainty] : r.letter === 'X' ? '동률' : '부족', 80 + i * 140, 385);
    g.font = 'bold 150px sans-serif';
  });
  g.fillStyle = '#FFF4DA';
  g.font = 'bold 54px sans-serif';
  const name = tv.mode === 'one' ? TYPE_INFO[tv.types[0]]?.name ?? '' : tv.mode === 'between' ? `${TYPE_INFO[tv.types[0]].name.replace(' 인간', '')} ↔ ${TYPE_INFO[tv.types[1]].name.replace(' 인간', '')}` : '아직 한 유형으로 좁히지 않았어요';
  g.fillText(name, 70, 520);
  g.font = '36px sans-serif';
  g.fillStyle = '#CFE6D8';
  const top = primaryEvents(ms).filter((e) => e.kind === 'fork').slice(-2);
  top.forEach((e, i) => g.fillText(`• ${e.scene ?? ''}: ${e.label}`.slice(0, 40), 70, 640 + i * 60));
  const end = ENDING_TEXT[mm.flags.ending as EndingId];
  g.fillStyle = '#FFD47B';
  g.fillText(`${String(mm.flags.c8_name ?? '')} · ${end ? end.title : ''}`, 70, 820);
  g.fillStyle = '#8A93B8';
  g.font = '30px sans-serif';
  g.fillText('비공식·탐색적 결과 — 공식 MBTI® 검사가 아니에요.', 70, 1240);
  g.fillText('게임 속 선택 패턴을 보여 주는 재미용 결과예요.', 70, 1285);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = 'mirror-last-earth-result.png';
  a.click();
}

function exportData(rep: Report, ms: MeasurementState, mm: MissionState): void {
  const data = {
    format: 'mirror-last-earth-result-v2',
    note: '플레이어 이름·외형은 포함하지 않아요. 승선자 이름도 측정 기록에는 없어요.',
    code: friendCode(rep),
    axes: Object.fromEntries(AXES.map((a) => [a, { letter: rep.axes[a].letter, certainty: rep.axes[a].certainty, index: rep.axes[a].dim.m === null ? null : pct(rep.axes[a].dim.m), range: rangeText(rep.axes[a].dim) }])),
    bigFive: Object.fromEntries((['O', 'C', 'E', 'A'] as const).map((k) => [k, { index: rep.bigFive[k].index, range: rangeText(rep.bigFive[k]), strength: rep.bigFive[k].strength }])),
    neuroticism: 'not measured',
    ending: mm.flags.ending ?? null,
    events: ms.events.map((e) => ({ chapter: e.chapter, opportunity: e.opportunityId, dim: e.dim, pole: e.pole, weight: e.weight, scene: e.scene, chosen: e.label, notChosen: e.otherLabel, askedBy: e.askedBy })),
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'mirror-last-earth-data.json';
  a.click();
}

// ---------- 저울 다시보기 (비채점) ----------
function scales(mm: MissionState): { ch: string; title: string; chose: string; paid: string }[] {
  const f = mm.flags;
  const nm = (ids: readonly string[]): string => ids.map((i) => CANDIDATES[i as CandidateId]?.name ?? i).join(', ');
  let alloc: number[] = [];
  try { alloc = JSON.parse(String(f.c6_alloc)) as number[]; } catch { alloc = []; }
  const items = itemsOf(mm.crewIds, mm.inventoryIds).map((i) => i.name);
  const fix: Record<string, [string, string]> = { boram: ['보람의 수동 리셋', '남는 사람(보람)이 진 위험'], spare: ['예비 밸브 전환', f.c3_backup_used === true ? '짐 일부와 앞으로의 물 여유' : '예비 부품'], recal: ['자체 재보정 후 대기', '선체 무결성 -10, 거친 이륙'] };
  const ark: Record<string, [string, string]> = { supply: ['보급 캡슐 사출', '물 -20, 산소 -15'], rendezvous: ['궤도 수정 랑데부', '연료 여유(협곡 착륙 포기), 식량 -10'], relay: ['신호 중계 + 항로 데이터', '그들이 지는 불확실성'] };
  const site: Record<string, [string, string]> = { alpha: ['α MIRROR 착륙장', '착륙선 전지 회수 불가(전력 -10)'], beta: ['β 평원', '긴 도보(산소 -8)'], gamma: ['γ 협곡 가장자리', '착륙 충격(선체 -5)'] };
  const tgt: Record<string, [string, string]> = { ice: ['얼음 지대', '일꾼-3과 그 기록'], ilkkun: ['일꾼-3 구조', '큰 물 확보 기회'], third: [f.pod_recovered === true ? '화물 포드 회수' : '가까운 얼음 확률 지대', f.pod_recovered === true ? '얼음 탐사와 일꾼-3' : '적은 물 확보'] };
  const method: Record<string, [string, string]> = { expert: ['전문가 결정', '소수의 목소리'], consensus: ['전원 합의(거부권)', '속도'], roles: ['역할별 책임 + 평시 다수결', '경계를 정하는 다툼'] };
  const pick = (m: Record<string, [string, string]>, k: unknown): [string, string] => m[String(k)] ?? ['―', '―'];
  return [
    { ch: 'C1', title: '마지막 네 자리', chose: `탑승: ${nm(mm.crewIds)}`, paid: `남은 사람: ${nm(unselectedOf(mm.crewIds))}` },
    { ch: 'C2', title: '마지막 12킬로그램', chose: `실은 짐(지금): ${items.join(', ') || '없음'}`, paid: '두고 온 물건과 맡긴 약속' },
    { ch: 'C3', title: '지구의 마지막 창', chose: pick(fix, f.c3_fix)[0], paid: pick(fix, f.c3_fix)[1] },
    { ch: 'C4', title: '대답 없는 지구', chose: pick(ark, f.c4_ark_choice)[0], paid: pick(ark, f.c4_ark_choice)[1] },
    { ch: 'C5', title: '붉은 행성에 첫발', chose: `${pick(site, f.c5_site)[0]} · 돌풍: ${f.c5_gust === 'pod' ? '화물 포드 분리' : '선회'}`, paid: `${pick(site, f.c5_site)[1]}${f.c5_gust === 'pod' ? ', 짐을 잠시 잃음' : ', 산소 -8'}` },
    { ch: 'C6', title: '산소가 줄어든다', chose: alloc.length === 4 ? `전력 토큰 — 산소 ${alloc[0]} · 종자 ${alloc[1]} · 기록 ${alloc[2]} · 난방 ${alloc[3]}` : '―', paid: alloc.length === 4 ? ['종자', '기록', '난방'].filter((_, i) => alloc[i + 1] < 3).map((x) => `${x} 일부`).join(', ') || '산소 회복 속도' : '―' },
    { ch: 'C7', title: '얼음 아래의 물', chose: `${pick(tgt, f.c7_target)[0]} · ${f.c7_eva === 'yes' ? '사람이 동행' : '로버만'}`, paid: `${pick(tgt, f.c7_target)[1]}${f.c7_eva === 'yes' ? ', 식량 -8' : ''}` },
    { ch: 'C8', title: '첫 번째 규칙', chose: `${pick(method, f.c8_method)[0]} → 문: ${DOOR_LABEL[f.c8_door as Door] ?? '―'}`, paid: pick(method, f.c8_method)[1] },
  ];
}

function seenList(mm: MissionState, key: string): string[] {
  try { const v: unknown = JSON.parse(String(mm.flags[key] ?? '[]')); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}

// ---------- 결과지 ----------
export function showResults(root: HTMLElement, d: ResultsDeps): void {
  const { report: rep, mission: mm, measure: ms } = d;
  const off = !ms.analysisOptIn;
  const withheld = rep.quality.withheld;
  // 03 §74: 포크가 한 화면 위치에 85% 이상 몰리면 4글자·유형을 숨기고 지수 막대는 회색으로만 보여 준다
  const biased = !off && !withheld && rep.quality.positionBias;
  const tv = typeView(rep);
  const pl = playerAxisLetters(rep);
  const end = ENDING_TEXT[mm.flags.ending as EndingId];
  const content = h('div', { class: biased ? 'res-body biased' : 'res-body' });
  const tabsDef: [string, string][] = biased
    ? [['cover', '표지'], ['moments', '선택의 순간'], ['mbti', 'MBTI 상세'], ['big5', '빅파이브 상세'], ['situ', '상황별 나'], ['archive', '저울 다시보기 · 기록실']]
    : off
    ? [['cover', '표지'], ['archive', '저울 다시보기 · 기록실']]
    : [['cover', '표지'], ['moments', '선택의 순간'], ['mbti', 'MBTI 상세'], ['big5', '빅파이브 상세'], ['situ', '상황별 나'], ['profile', '유형 프로필'], ['compat', '궁합'], ['alike', '나와 닮은 인물'], ['archive', '저울 다시보기 · 기록실']];
  const nav = h('nav', { class: 'res-tabs', role: 'tablist', 'aria-label': '결과지 탭' });
  const show = (key: string): void => {
    nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.key === key)));
    clear(content);
    content.append(...section(key));
    content.scrollTop = 0;
  };
  tabsDef.forEach(([k, label]) => nav.append(h('button', { class: 'btn small', type: 'button', role: 'tab', 'data-key': k, onClick: () => show(k) }, label)));
  const typeName = (t: string): string => TYPE_INFO[t]?.name ?? t;

  const cover = (): (HTMLElement | string)[] => {
    const look = PLAYER_LOOKS[mm.player.look] ?? PLAYER_LOOKS[0];
    const win = domeWindowCanvas(look, 3);
    win.classList.add('dome-window');
    win.setAttribute('aria-hidden', 'true');
    const head = off
      ? [h('h2', {}, '행동 분석을 끄고 플레이했어요'), h('p', {}, '이야기는 끝까지 같았고, 행동 기록은 하나도 만들지 않았어요. 아래 탭에서 저울과 기록실을 볼 수 있어요.')]
      : withheld
        ? [h('h2', {}, '이번 기록으로는 성향을 말하기 어려워요'), h('p', {}, `유효한 관찰이 ${rep.quality.validOpportunities}개로, 결과를 보여 줄 기준(20개)에 못 미쳐요. 정보 탭을 열거나 동료의 요청에 답하면 관찰이 늘어나요.`)]
        : biased
          ? [h('h2', {}, '선택이 화면의 한쪽 위치에 몰려 있었어요'), h('p', {}, `방식을 고른 ${rep.quality.forks}번 중 ${Math.round((rep.quality.firstPositionRate ?? 0) * 100)}%를 같은 위치에서 골랐어요. 이럴 때는 성향보다 버튼 위치가 결과를 만들 수 있어서 4글자와 유형을 숨겼어요. 상세 탭의 막대는 회색으로, 참고로만 봐 주세요.`)]
          : [
          h('div', { class: 'res-letters' }, ...AXES.map((a) => {
            const r = rep.axes[a];
            return h('div', { class: `res-letter${REAL(r.letter) ? '' : ' weak'}` }, h('b', {}, r.letter), h('small', {}, REAL(r.letter) ? `${DOTS[r.certainty]} ${letterLabel(r)}` : letterLabel(r)));
          })),
          tv.mode === 'one' ? h('h2', { class: 'res-name' }, typeName(tv.types[0]))
            : tv.mode === 'between' ? h('h2', { class: 'res-name' }, `${typeName(tv.types[0]).replace(' 인간', '')} ↔ ${typeName(tv.types[1]).replace(' 인간', '')}`)
              : h('h2', { class: 'res-name' }, '아직 한 유형으로 좁히지 않았어요'),
          h('p', { class: 'res-line' }, tv.mode === 'one' ? `「${TYPE_INFO[tv.types[0]].line}」` : tv.mode === 'between' ? '두 유형 사이에 있어요. 다음 판에서 달라질 수 있어요.' : `근거가 부족한 축이 있어 후보가 ${rep.type.candidates.length}개예요. 더 많은 장면에서 정보를 열거나 요청에 답하면 좁혀져요.`),
        ];
    return [
      h('p', { class: 'res-official' }, OFFICIAL_NOTE),
      h('div', { class: 'res-cover' }, win, h('div', {}, ...head)),
      h('p', { class: 'res-kicker' }, `${String(mm.flags.c8_name ?? '정착지')} · 엔딩: ${end ? end.title : '―'}`),
      h('div', { class: 'row' },
        !off && !withheld && !biased ? h('button', { class: 'btn primary', type: 'button', onClick: () => shareCard(rep, mm, ms) }, '이미지 저장') : '',
        h('button', { class: 'btn', type: 'button', onClick: d.onTitle }, '타이틀로')),
    ];
  };

  const moments = (): HTMLElement[] => CHAPTER_IDS.map((ch: ChapterId) => {
    const list = primaryEvents(ms).filter((e) => e.chapter === ch);
    return h('section', { class: 'tl-ch' },
      h('div', { class: 'tl-head' }, pxImg(chapterArtURL(ch), CHAPTER_TITLE[ch], 'tl-art'), h('div', {}, h('b', {}, ch), h('span', {}, ` ${CHAPTER_TITLE[ch]}`), h('small', {}, PRESSURE[ch] === 'H' ? ' · 긴박한 장' : ' · 평온한 장'))),
      ...(list.length ? list.map((e) => {
        const ip = INTERP[e.dim];
        const side = ip ? (e.pole > 0 ? ip.plus : ip.minus) : null;
        return h('article', { class: 'moment' },
          h('div', { class: 'm-top' }, asker(e), h('small', {}, e.scene ?? '')),
          h('div', { class: 'm-pair' }, h('p', { class: 'chose' }, h('b', {}, '고른 것 '), e.label), e.otherLabel ? h('p', { class: 'not' }, h('b', {}, '고르지 않은 것 '), e.otherLabel) : ''),
          side ? h('p', {}, h('b', {}, '이 행동이 뜻하는 것 '), side.meaning) : '',
          ip ? h('p', { class: 'small' }, h('b', {}, '기록된 지표 '), ip.indicator) : '',
          side ? h('p', { class: 'muted small' }, h('b', {}, '반대쪽을 골랐다면 '), side.other) : '',
          e.dim === 'TF' ? h('p', { class: 'muted small' }, TF_NOTE) : '');
      }) : [h('p', { class: 'muted small' }, '이 장에서는 채점에 쓰인 선택이 없어요. (정보를 열지 않았거나 요청 장면을 지나쳤을 수 있어요.)')]));
  });

  const axisDetail = (a: Axis): HTMLElement => {
    const r = rep.axes[a];
    const [plus, minus] = AXIS_LETTERS[a];
    const src = a === 'EI' ? 'E' : a;
    const ev = (p: 1 | -1): HTMLElement[] => evidence(ms, src, p).slice(0, 4).map((e) => h('li', {}, `${e.chapter} · ${e.label}`));
    return h('section', { class: 'res-axis' },
      h('h3', {}, `${a === 'EI' ? '에너지 방향' : a === 'SN' ? '정보 수집' : a === 'TF' ? '판단 근거' : '생활 방식'} — ${biased ? '숨김(위치 편향)' : `${r.letter} (${letterLabel(r)})`}`),
      bar(r.dim, minus, plus),
      h('p', { class: 'small' }, `${rangeText(r.dim)} · 관찰 ${r.dim.validOpportunities}회 / ${r.dim.validChapters}개 장${r.dim.meetsThreshold ? '' : ' · 기준(4개 장) 미달'}${r.byFollowup ? ' · 추가 질문으로 정함' : ''}`),
      h('div', { class: 'ev-cols' },
        h('div', {}, h('b', {}, `${plus} 쪽 근거`), h('ul', {}, ...(ev(1).length ? ev(1) : [h('li', { class: 'muted' }, '없음')]))),
        h('div', {}, h('b', {}, `${minus} 쪽 근거`), h('ul', {}, ...(ev(-1).length ? ev(-1) : [h('li', { class: 'muted' }, '없음')])))),
      a === 'TF' ? h('p', { class: 'muted small' }, TF_NOTE) : '');
  };

  const big5Card = (k: 'O' | 'C' | 'E' | 'A'): HTMLElement => {
    const r = rep.bigFive[k];
    const side = r.m === null ? 0 : r.m >= 0 ? 1 : -1;
    const pro = side ? evidence(ms, k, side as 1 | -1).slice(0, 3) : [];
    const con = side ? evidence(ms, k, (-side) as 1 | -1).slice(0, 3) : [];
    return h('section', { class: 'b5-card' },
      h('h3', {}, `${DIM_NAME[k]} ${r.index !== null ? Math.round(r.index) : ''}`),
      bar(r, '낮음', '높음'),
      h('p', { class: 'small' }, `${r.meetsThreshold || r.resolvedBy === 'followup' ? rangeText(r) : '근거 부족 — 기준(4개 장)에 못 미쳐요'} · 근거 강도: ${['부족', '약함', '보통', '강함'][r.strength]}`),
      h('div', { class: 'ev-cols' },
        h('div', {}, h('b', {}, '근거'), h('ul', {}, ...(pro.length ? pro.map((e) => h('li', {}, `${e.chapter} · ${e.label}`)) : [h('li', { class: 'muted' }, '없음')]))),
        h('div', {}, h('b', {}, '반대 근거'), h('ul', {}, ...(con.length ? con.map((e) => h('li', {}, `${e.chapter} · ${e.label}`)) : [h('li', { class: 'muted' }, '없음')])))));
  };

  const situ = (): (HTMLElement | string)[] => {
    const WORD: Record<string, [string, string]> = { O: ['새 방식', '검증된 방식'], C: ['직접 재점검', '확인 수용'], E: ['함께', '혼자'], A: ['요청 조정', '원안 유지'], SN: ['가능성 먼저', '실측 먼저'], TF: ['사람 먼저', '수치 먼저'], JP: ['계획 먼저', '하면서 정하기'] };
    const dims: [string, DimResult][] = [['O', rep.bigFive.O], ['C', rep.bigFive.C], ['E', rep.bigFive.E], ['A', rep.bigFive.A], ['SN', rep.axes.SN.dim], ['TF', rep.axes.TF.dim], ['JP', rep.axes.JP.dim]];
    const rows = dims.filter(([, r]) => r.pressure.differs !== null).map(([k, r]) => {
      const w = (m: number): string => (m >= 0 ? WORD[k][0] : WORD[k][1]);
      const H = r.pressure.H as number;
      const L = r.pressure.L as number;
      return h('article', { class: 'moment' }, h('b', {}, INTERP[k]?.indicator ?? k),
        h('p', {}, `긴박한 장(C1·C3·C5·C6)에서는 '${w(H)}' 쪽 (${pct(H)}), 평온한 장(C2·C4·C7·C8)에서는 '${w(L)}' 쪽 (${pct(L)}).`),
        h('p', { class: 'small' }, r.pressure.differs ? '상황에 따라 달라졌어요. 긴박함이 선택 방식을 바꾸는 편이에요.' : '상황이 달라도 비슷했어요.'));
    });
    return [h('p', { class: 'muted' }, '긴박한 장과 평온한 장에서 각각 3번 이상 관찰된 지표만 보여 줘요.'),
      ...(rows.length ? rows : [h('p', {}, '두 상황을 비교할 만큼 근거가 쌓인 지표가 없어요. 이번 판에서는 보여 드리지 않아요.')])];
  };

  const profile = (): (HTMLElement | string)[] => {
    if (!tv.types.length) return [h('p', {}, '아직 한두 유형으로 좁히지 않아 프로필을 보여 드리기 어려워요. MBTI 상세에서 축별 근거를 볼 수 있어요.')];
    return tv.types.map((t) => {
      const i = TYPE_INFO[t];
      return h('section', { class: 'b5-card' }, h('h3', {}, `${t} · ${i.name}`), h('p', { class: 'res-line' }, `「${i.line}」`),
        h('p', {}, h('b', {}, '화성 돔에서 맡기 좋은 일 '), i.job),
        h('p', {}, h('b', {}, '강점 '), i.strength),
        h('p', {}, h('b', {}, '놓치기 쉬운 것 '), i.blind),
        h('p', {}, h('b', {}, '함께 일할 때 팁 '), i.tip));
    }).concat(tv.mode === 'between' ? [h('p', { class: 'muted small' }, '두 유형 사이에 있어 둘 다 보여 드려요.')] : []);
  };

  const compat = (): (HTMLElement | string)[] => {
    const aboard = new Set<string>(mm.crewIds);
    const keys: CrewKey[] = [...CANDIDATE_IDS, 'dam'];
    const scored = keys.map((k) => ({ k, ...crewReasons(k, pl) }));
    const known = scored[0].known;
    const out: (HTMLElement | string)[] = [h('h3', {}, '아크-06 동료 궁합')];
    if (known === 0) out.push(h('p', {}, '축 근거가 없어 동료 궁합을 계산하지 않았어요.'));
    else {
      const best = [...scored].sort((a, b) => b.match - a.match)[0];
      const clash = [...scored].sort((a, b) => a.match - b.match)[0];
      const card = (s: (typeof scored)[number], title: string): HTMLElement => h('article', { class: 'moment' },
        h('b', {}, `${title}: ${CREW_NAME[s.k]} (${CREW_TYPE[s.k]})${s.k !== 'dam' && !aboard.has(s.k) ? ' — 이번엔 함께 떠나지 않은 사람' : ''}`),
        ...s.lines.map((l) => h('p', { class: 'small' }, l)));
      out.push(card(best, '잘 맞는 동료'), card(clash, '부딪히기 쉬운 동료'),
        h('ul', { class: 'crew-list' }, ...scored.map((s) => h('li', {}, `${CREW_NAME[s.k]} ${CREW_TYPE[s.k]} · 글자 일치 ${s.match}/${s.known}${s.k !== 'dam' && !aboard.has(s.k) ? ' · 이번엔 함께 떠나지 않은 사람' : ''}`))),
        h('p', { class: 'muted small' }, '동료의 유형은 게임 속 설정이에요. 부딪히기 쉬운 동료가 오히려 빈칸을 채워 주기도 해요.'));
    }
    out.push(h('h3', {}, '16유형 궁합 (재미용 협업 규칙, 연구로 검증된 궁합이 아니에요)'));
    if (!tv.types.length) out.push(h('p', {}, '유형을 한두 개로 좁힌 뒤에 보여 드려요.'));
    tv.types.forEach((t) => {
      const c = typeCompat(t);
      const row = (label: string, list: string[], why: string): HTMLElement => h('p', {}, h('b', {}, `${label} `), list.map((x) => `${x} ${TYPE_INFO[x].name}`).join(' · '), h('br', {}), h('small', { class: 'muted' }, why));
      out.push(h('article', { class: 'moment' }, h('b', {}, `${t} 기준`),
        row('편한 짝', c.easy, '일의 속도(J/P)와 정보 스타일(S/N)이 같아요.'),
        row('배울 게 많은 짝', c.learn, '속도는 같고 보는 정보와 판단 근거가 달라요.'),
        row('부딪히기 쉬운 짝', c.clash, '일의 속도(J/P)가 달라요. 서로의 속도를 미리 말해 두면 좋아요.')));
    });
    const code = friendCode(rep);
    const res = h('div', { class: 'friend-out', 'aria-live': 'polite' });
    const input = h('input', { class: 'input', type: 'text', placeholder: 'ML-XXXX-XXXX', 'aria-label': '친구 결과 코드' }) as HTMLInputElement;
    const compare = (): void => {
      clear(res);
      const fv = decodeFriend(input.value);
      if (!fv) { res.append(h('p', { class: 'warn' }, '코드 형식이 맞지 않아요. 예: ML-7Q2K-INTJ')); return; }
      AXES.forEach((a, i) => {
        const [plus, minus] = AXIS_LETTERS[a];
        const me = rep.axes[a].dim.m;
        res.append(h('div', { class: 'cmp' }, h('b', {}, `${minus} ↔ ${plus}`),
          h('div', { class: 'rb-track two' },
            me !== null ? h('b', { class: 'rb-dot me', style: { left: `${pct(me)}%` }, title: '나' }) : '',
            fv.m[i] !== null ? h('b', { class: 'rb-dot friend', style: { left: `${pct(fv.m[i] as number)}%` }, title: '친구' }) : '')));
      });
      const myJP = rep.type.strict[3];
      const frJP = fv.type[3];
      const myEI = rep.type.strict[0];
      const frEI = fv.type[0];
      res.append(h('p', {}, '둘이 아크-06에 탔다면: ',
        REAL(myJP) && REAL(frJP) && myJP !== frJP ? '한 명은 작업표를, 한 명은 즉흥을 들고 수하물실에 들어와요. 처음엔 티격태격하지만, 봉인할 즈음엔 둘 다 있어서 다행이라고 말해요. '
          : REAL(myJP) && REAL(frJP) ? '둘은 같은 속도로 짐을 싸요. 수하물실이 조용하고 빨라요. ' : '짐 싸는 속도는 아직 견주기 어려워요. 둘 중 한 명의 J/P 글자가 근거 부족이거나 거의 동률이에요. ',
        REAL(myEI) && REAL(frEI) && myEI !== frEI ? '한 명이 동료들과 수다를 떠는 동안, 다른 한 명은 관측창 앞에서 별을 그려요.' : REAL(myEI) && REAL(frEI) ? '자유 시간이면 둘은 같은 자리에 있어요.' : '자유 시간을 어떻게 보낼지는 아직 알 수 없어요.'));
    };
    out.push(h('h3', {}, '친구와 비교'),
      h('p', {}, '내 결과 코드: ', h('code', { class: 'code' }, code)),
      h('p', { class: 'muted small' }, '이름은 들어가지 않아요. 이 기기 안에서만 비교하고 서버로 보내지 않아요.'),
      h('div', { class: 'row' }, input, h('button', { class: 'btn', type: 'button', onClick: compare }, '비교하기')), res);
    return out;
  };

  const alike = (): (HTMLElement | string)[] => {
    const keys: CrewKey[] = [...CANDIDATE_IDS, 'dam'];
    const scored = keys.map((k) => ({ k, ...crewReasons(k, pl) })).sort((a, b) => b.match - a.match);
    const crewLook = (k: CrewKey): string => portraitURL(k === 'dam' ? NPC_LOOKS.dam : CANDIDATES[k as CandidateId].look, 'joy');
    const out: (HTMLElement | string)[] = [];
    if (scored[0].known > 0) {
      const s = scored[0];
      out.push(h('article', { class: 'moment alike' }, pxImg(crewLook(s.k), CREW_NAME[s.k], 'mini'),
        h('div', {}, h('b', {}, `아크-06 속 닮은 인물: ${CREW_NAME[s.k]}`), h('p', { class: 'small' }, `작업 스타일 ${CREW_TYPE[s.k]} · 글자 ${s.match}/${s.known}개 일치`))));
    }
    if (!tv.types.length) out.push(h('p', {}, '유형을 한두 개로 좁힌 뒤에 역사 인물을 보여 드려요.'));
    tv.types.forEach((t) => {
      const f = FIGURES[t];
      out.push(h('article', { class: 'moment' }, h('b', {}, `${f.name}`), h('p', {}, f.hook), h('p', { class: 'muted small' }, `${TYPE_INFO[t].name}의 일하는 방식과 닮은 기록`)));
    });
    out.push(h('p', { class: 'muted small' }, '이미 세상을 떠난 인물만 골랐어요. 그 사람의 성격 유형을 판정한 것이 아니라, 기록에 남은 일하는 방식이 닮았다는 재미용 연결이에요.'));
    return out;
  };

  const archive = (): (HTMLElement | string)[] => {
    const chem = seenList(mm, 'chem_seen');
    const HOW: Record<string, string> = { chosen: '직접 골랐다', lot: '제비뽑기로 정했다', me: '내가 가겠다고 했지만, 대신 나섰다' };
    const lostItems = (['C5', 'C6', 'C7'] as const).flatMap((ch) => {
      const id = mm.flags[`lost_${ch}`];
      return typeof id === 'string' && id in CANDIDATES ? [h('li', {}, `${ch} · ${CANDIDATES[id as CandidateId].name} — ${HOW[String(mm.flags[`lost_${ch}_how`])] ?? ''}`)] : [];
    });
    const TWIST: Record<string, string> = { jail: '녹차 독점 금지 조항을 만들고 묶어 두었다', forgive: '용서하고 녹차밭을 함께 가꾸기로 했다', noknok: '녹녹이에게 맡겼다' };
    const thoughts = CHAPTER_IDS.flatMap((ch) => {
      const r = REFLECTIONS[ch];
      const o = r?.options.find((x) => x.id === mm.flags[`reflect_${ch}`]);
      return r && o ? [h('li', {}, h('b', {}, `${ch} `), r.question, h('br', {}), `→ ${o.label}`)] : [];
    });
    const letterFrom = mm.flags.letter_from as CandidateId | undefined;
    const earth = [
      ...itemsOf(mm.crewIds, mm.inventoryIds).filter((i) => i.tag === '기억' || i.tag === '약속').map((i) => `${i.name}${i.owner ? ` (${iGa(CANDIDATES[i.owner].name)} 맡김)` : ''}`),
      ...(letterFrom && LETTERS[letterFrom] ? [`${CANDIDATES[letterFrom].name}의 음성 편지`] : []),
      ...(mm.flags.c4_video_choice ? ['지구의 마지막 학교 종소리 영상'] : []),
    ];
    const endings: EndingId[] = ['dawn', 'memory', 'together', 'rebuild'];
    const unseen = {
      chem: 15 - chem.length,
      letters: 6 - (letterFrom ? 1 : 0),
      endings: endings.filter((e) => !d.gallery.includes(e)).length,
      boram: mm.flags.c3_fix === 'boram' ? 0 : 1,
      ilkkun: mm.flags.ilkkun === true ? 0 : 1,
    };
    return [
      h('h3', {}, '8개의 저울 (성격 결과에 하나도 쓰이지 않았어요)'),
      h('table', { class: 'scale-table' }, h('thead', {}, h('tr', {}, h('th', {}, '장'), h('th', {}, '고른 것'), h('th', {}, '치른 값'))),
        h('tbody', {}, ...scales(mm).map((s) => h('tr', {}, h('td', {}, `${s.ch} ${s.title}`), h('td', {}, s.chose), h('td', {}, s.paid))))),
      h('h3', {}, `케미 앨범 (${chem.length}/15)`),
      chem.length ? h('div', { class: 'album' }, ...chem.filter((k) => CHEMISTRY[k]).map((k) => { const [a, la, b, lb] = CHEMISTRY[k]; return h('article', { class: 'moment' }, h('p', { class: 'small' }, `${CANDIDATES[a].name}: ${la}`), h('p', { class: 'small' }, `${CANDIDATES[b].name}: ${lb}`)); })) : h('p', { class: 'muted' }, '아직 모은 장면이 없어요.'),
      h('h3', {}, '지구 조각'),
      earth.length ? h('ul', {}, ...earth.map((x) => h('li', {}, x))) : h('p', { class: 'muted' }, '이번 판에는 지구에서 가져온 기억이 남지 않았어요.'),
      h('h3', {}, '못 본 장면'),
      h('p', {}, `케미 장면 ${unseen.chem}개 · 음성 편지 ${unseen.letters}통 · 엔딩 ${unseen.endings}개${unseen.boram ? ' · 보람의 마지막 무전' : ''}${unseen.ilkkun ? ' · 일꾼-3의 귀환' : ''}`),
      h('h3', {}, '떠난 동료 (이야기 기록 · 점수와 무관)'),
      lostItems.length ? h('ul', { class: 'small lost' }, ...lostItems) : h('p', { class: 'muted small' }, '아무도 떠나지 않았어요.'),
      typeof mm.flags.twist_choice === 'string' ? h('p', { class: 'small' }, h('b', {}, '마지막 반전 · '), `희대의 빌런 진우주 — ${TWIST[mm.flags.twist_choice] ?? ''}`) : '',
      h('h3', {}, '생각의 시간 — 내가 고른 생각 (정답 없음 · 점수와 무관)'),
      thoughts.length ? h('ul', { class: 'small thoughts' }, ...thoughts) : h('p', { class: 'muted small' }, '아직 남긴 생각이 없어요.'),
      h('h3', {}, '엔딩 갤러리'),
      h('div', { class: 'gallery' }, ...endings.map((e) => h('div', { class: `g-item${d.gallery.includes(e) ? ' got' : ''}` }, d.gallery.includes(e) ? ENDING_TEXT[e].title : '???'))),
      h('h3', {}, '규칙표와 한계'),
      h('ul', { class: 'small' },
        h('li', {}, '채점에 쓰는 것: 정보 탭을 연 순서, 방식 고르기, 계획·확인 습관, 함께/혼자, 동료 요청에 답한 방식. 저울(딜레마)과 미니게임 성공 여부는 쓰지 않아요.'),
        h('li', {}, '장마다 같은 종류의 관찰을 한 번씩 모아, 4개 장 이상에서 관찰됐을 때만 지표를 보여 줘요.'),
        h('li', {}, '선택지의 화면 위치는 판마다 섞어요. 방식 고르기 20번 이상 중 한 위치에 85% 이상 몰리면 4글자를 숨기고 경고를 띄워요.'),
        h('li', {}, '범위는 80% 범위예요. 다시 플레이하면 그 안에서 움직일 수 있어요.'),
        h('li', {}, '정서 안정성(신경성)은 측정하지 않아요. 게임 속 긴장은 성격이 아니라 상황이니까요.'),
        h('li', {}, OFFICIAL_NOTE),
        h('li', {}, '기록은 이 브라우저에만 저장되고 서버로 보내지 않아요.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onClick: d.onReplay }, '다시하기'),
        h('button', { class: 'btn', type: 'button', onClick: d.onWipe }, '기록 삭제'),
        !off ? h('button', { class: 'btn', type: 'button', onClick: () => exportData(rep, ms, mm) }, '내보내기') : ''),
    ];
  };

  const section = (key: string): (HTMLElement | string)[] => {
    switch (key) {
      case 'cover': return cover();
      case 'moments': return [h('p', { class: 'muted' }, '채점에 쓰인 선택만 장별로 모았어요. 고른 쪽과 고르지 않은 쪽 모두 같은 결과로 이어졌어요.'), ...moments()];
      case 'mbti': return [...(biased ? [h('p', { class: 'warn' }, '선택이 화면의 한쪽 위치에 몰려 있어 글자와 유형을 숨겼어요. 막대는 참고로만 봐 주세요.')] : []), ...AXES.map(axisDetail), h('p', { class: 'small' }, biased ? '유형 후보는 숨겼어요.' : rep.type.closest ? `가장 가까운 유형: ${rep.type.closest} ${typeName(rep.type.closest)}` : rep.type.candidates.length === 2 ? `두 유형 사이: ${rep.type.candidates.map((t) => `${t} ${typeName(t)}`).join(' ↔ ')}` : `후보 ${rep.type.candidates.length}개 — 근거가 더 필요해요.`)];
      case 'big5': return [...(['O', 'C', 'E', 'A'] as const).map(big5Card), h('section', { class: 'b5-card' }, h('h3', {}, DIM_NAME.N), h('p', {}, '판단 자료 부족 — 이 게임은 정서 안정성을 측정하지 않아요. 재난 속 긴장은 성격이 아니라 상황이에요.'))];
      case 'situ': return situ();
      case 'profile': return profile();
      case 'compat': return compat();
      case 'alike': return alike();
      default: return archive();
    }
  };

  clear(root);
  root.className = 'show';
  root.append(h('div', { class: 'paper-card results', role: 'dialog', 'aria-label': '결과지' },
    h('h2', { class: 'res-title' }, '나의 선택 패턴 — 결과지'), nav, content,
    h('p', { class: 'res-foot' }, OFFICIAL_NOTE)));
  show('cover');
}
