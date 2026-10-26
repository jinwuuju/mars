import { CANDIDATE_IDS, type CandidateId } from '../shared/ids';
import { CANDIDATES } from './candidates';
import { eulReul, iGa } from './josa';

/**
 * C2 수하물 규칙과 C3 예비 밸브 규칙. 게임 화면과 경제 시뮬레이션이 같은 함수를 쓴다(규칙 불일치 방지).
 * 무게는 0.1kg 단위 정수로 계산한다(녹차 티백 0.1kg 때문에).
 */
export type AffKey = 'dawn' | 'memory' | 'together';
export type Aff = Partial<Record<AffKey, number>>;
export type ItemTag = '기억' | '기술' | '식량' | '생활' | '약속';

export interface CargoItem {
  id: string;
  name: string;
  kg: number;
  tag: ItemTag;
  aff: Aff;
  /** 실측 정보 탭 (S) */
  facts: string[];
  /** 쓰임 상상 탭 (N) — 기계적 이득 정보는 쓰지 않는다 */
  imagine: string[];
  owner?: CandidateId;
  fragile: boolean;
}

export const BASE_ITEMS: CargoItem[] = [
  { id: 'photo', name: '개인 사진', kg: 1, tag: '기억', aff: { memory: 1 }, fragile: true,
    facts: ['무게 1kg · 종이 사진 12장과 얇은 액자', '방수 비닐 포장', '대피소 벽에 14개월 동안 붙어 있었다'],
    imagine: ['어느 밤, 누군가 이 사진을 보며 웃을지도 모른다', '화성의 벽에도 못 하나는 박을 수 있겠지'] },
  { id: 'music', name: '지구 음악·기록', kg: 2, tag: '기억', aff: { memory: 1 }, fragile: true,
    facts: ['무게 2kg · 오래된 음악 플레이어와 저장 칩 3개', '배터리 교체형', '지구 노래 약 4,000곡과 뉴스 기록'],
    imagine: ['고장 난 밤에도 노래 한 곡은 틀 수 있다', '누군가 처음 듣는 지구 노래를 따라 부를지도'] },
  { id: 'parts', name: '예비 부품', kg: 4, tag: '기술', aff: { dawn: 1 }, fragile: false,
    facts: ['무게 4kg · 밸브·패킹·소형 펌프 부품 세트', '아크 계열 설비와 규격 호환', '방습 상자 포장'],
    imagine: ['한밤중 무언가 멈췄을 때, 이 상자를 여는 장면', '쓸 일이 없으면 가장 좋은 짐'] },
  { id: 'seeds', name: '간이 식물 씨앗', kg: 2, tag: '식량', aff: { memory: 0.5, dawn: 0.5 }, fragile: true,
    facts: ['무게 2kg · 상추·콩·허브 씨앗 봉투 40개', '저온 건조 보관', '발아율 표시 라벨'],
    imagine: ['처음 올라온 초록색 하나를 다 같이 들여다보는 아침', '실패한 화분에도 이름이 붙을지 모른다'] },
  { id: 'games', name: '생활 놀이 상자', kg: 3, tag: '생활', aff: { together: 1 }, fragile: false,
    facts: ['무게 3kg · 보드게임 2개, 카드 한 벌, 공 하나', '종이·나무 재질', '대피소 아이들이 고른 것'],
    imagine: ['긴 항해의 어느 밤, 누군가 카드를 섞는다', '져도 웃게 되는 놀이'] },
  { id: 'filter', name: '소형 정수 필터', kg: 4, tag: '기술', aff: { dawn: 1 }, fragile: false,
    facts: ['무게 4kg · 정수 필터 카트리지 2개', '미세 입자와 불순물을 거른다', '교체 주기 표시창'],
    imagine: ['낯선 물을 마시기 전에 한 번 더 거르는 손', '가장 재미없지만 든든한 짐'] },
  { id: 'sewing', name: '바느질·보수 키트', kg: 2, tag: '생활', aff: { together: 0.5, dawn: 0.5 }, fragile: false,
    facts: ['무게 2kg · 실·바늘·패치·접착 테이프', '우주복 외피 패치 2장 포함', '손바느질 설명서'],
    imagine: ['찢어진 소매를 꿰매며 나누는 수다', '화성에서 처음 고친 것이 옷일지도'] },
  { id: 'soil', name: '지구 토양 샘플', kg: 3, tag: '기억', aff: { memory: 1 }, fragile: true,
    facts: ['무게 3kg · 밀폐 용기에 담긴 지구 흙', '살균 처리 완료', '채취지: 대피소 뒷마당'],
    imagine: ['손바닥에 지구 흙을 올려 보는 순간', '그 흙에서 무언가 자란다면'] },
];

/** 진우주가 탔을 때만 나오는 물품(STORY_BIBLE §9) */
export const TEABAG: CargoItem = {
  id: 'teabag', name: '녹차 티백 한 봉', kg: 0.1, tag: '생활', aff: { together: 0.5 }, fragile: true,
  facts: ['무게 0.1kg · 녹차 티백 20개입', '진우주의 개인 요청', '녹녹이 추천 우림 온도 80도'],
  imagine: ['화성의 어느 저녁, 따뜻한 한 모금', '녹녹이는 여전히 마실 수 없다'],
};

const LEGACY_AFF: Record<CandidateId, Aff> = {
  harin: { together: 1 }, taeo: { dawn: 1 }, seojin: { together: 1 },
  woojoo: { memory: 1 }, dodam: { memory: 1 }, jio: { dawn: 1 },
};

export function legacyItem(c: CandidateId): CargoItem {
  const cand = CANDIDATES[c];
  const facts = [`무게 ${cand.legacy.kg}kg · ${cand.legacy.name}`, `${iGa(cand.name)} 맡긴 물건`, `${cand.name}의 말: ${cand.legacy.line}`];
  if (c === 'woojoo') facts.push('봉투 구석에 녹차 티백 한 봉이 들어 있다');
  return {
    id: cand.legacy.id, name: cand.legacy.name, kg: cand.legacy.kg, tag: '약속', aff: LEGACY_AFF[c], owner: c, fragile: true,
    facts,
    imagine: [`언젠가 이 물건을 보며 ${eulReul(cand.name)} 떠올리는 장면`, '맡긴 사람의 이후는 알 수 없다'],
  };
}

export function cargoPool(crew: readonly CandidateId[]): CargoItem[] {
  const legacy = CANDIDATE_IDS.filter((c) => !crew.includes(c)).map(legacyItem);
  return [...BASE_ITEMS, ...(crew.includes('woojoo') ? [TEABAG] : []), ...legacy];
}

export function itemsOf(crew: readonly CandidateId[], ids: readonly string[]): CargoItem[] {
  const pool = cargoPool(crew);
  return ids.map((id) => pool.find((p) => p.id === id)).filter((x): x is CargoItem => Boolean(x));
}

export const CARGO_LIMIT = 12;
export const BAY_LIMIT = 7;
/** 좌우 차 4kg 이하 (2kg이면 4kg 물품 하나만 싣는 것도 불가능하다는 것을 시뮬레이션으로 발견) */
export const BAY_DIFF = 4;
const T = (kg: number): number => Math.round(kg * 10);

export function totalKg(items: readonly { kg: number }[]): number {
  return items.reduce((a, i) => a + T(i.kg), 0) / 10;
}

export interface LayoutCheck { ok: boolean; reason: string | null; left: number; right: number; total: number }

export function checkLayout(left: readonly { kg: number }[], right: readonly { kg: number }[]): LayoutCheck {
  const l = left.reduce((a, i) => a + T(i.kg), 0);
  const r = right.reduce((a, i) => a + T(i.kg), 0);
  const out = { left: l / 10, right: r / 10, total: (l + r) / 10 };
  if (l + r > T(CARGO_LIMIT)) return { ok: false, reason: `총 ${CARGO_LIMIT}kg를 넘어요`, ...out };
  if (l > T(BAY_LIMIT)) return { ok: false, reason: `왼쪽 칸이 ${BAY_LIMIT}kg를 넘어요`, ...out };
  if (r > T(BAY_LIMIT)) return { ok: false, reason: `오른쪽 칸이 ${BAY_LIMIT}kg를 넘어요`, ...out };
  if (Math.abs(l - r) > T(BAY_DIFF)) return { ok: false, reason: `좌우 차이가 ${BAY_DIFF}kg를 넘어요`, ...out };
  return { ok: true, reason: null, ...out };
}

/** 총 12kg 이하이고 좌우 칸 규칙을 만족하도록 나눌 수 있는가 */
export function canStow(weights: readonly number[]): boolean {
  const w = weights.map(T);
  const total = w.reduce((a, b) => a + b, 0);
  if (total > T(CARGO_LIMIT)) return false;
  let reach = new Set<number>([0]);
  for (const x of w) {
    const next = new Set(reach);
    for (const s of reach) next.add(s + x);
    reach = next;
  }
  for (const l of reach) {
    const r = total - l;
    if (l <= T(BAY_LIMIT) && r <= T(BAY_LIMIT) && Math.abs(l - r) <= T(BAY_DIFF)) return true;
  }
  return false;
}

/** 지금 실은 물품을 좌우로 다시 나눠 규칙을 만족시키는 배치(물품 선택은 바꾸지 않는다). 없으면 null */
export function autoBalance(items: readonly { id: string; kg: number }[]): { left: string[]; right: string[] } | null {
  const n = items.length;
  let best: { mask: number; diff: number } | null = null;
  for (let mask = 0; mask < 1 << n; mask += 1) {
    const left = items.filter((_, i) => mask & (1 << i));
    const right = items.filter((_, i) => !(mask & (1 << i)));
    const c = checkLayout(left, right);
    if (!c.ok) continue;
    const diff = Math.abs(c.left - c.right);
    if (!best || diff < best.diff - 1e-9) best = { mask, diff };
  }
  if (!best) return null;
  const m = best.mask;
  return {
    left: items.filter((_, i) => m & (1 << i)).map((i) => i.id),
    right: items.filter((_, i) => !(m & (1 << i))).map((i) => i.id),
  };
}

/** 승선자별 요청 (STORY, 들어줄지는 자유) */
export const REQUESTS: Record<CandidateId, { item: string; line: string }> = {
  harin: { item: 'photo', line: '네 사진은 꼭 챙겨. 나중에 보고 싶어질 거야.' },
  taeo: { item: 'parts', line: '부품 상자는 실어 주면 좋겠어. 화성 기계도 언젠가 아파.' },
  seojin: { item: 'sewing', line: '보수 키트는 의료용으로도 써. 상처용 테이프가 들어 있거든.' },
  woojoo: { item: 'teabag', line: '녹차 티백 한 봉(0.1kg)만... 진짜 안 돼? 정말 가벼워!' },
  dodam: { item: 'music', line: '음악·기록 상자, 가능하면 부탁해요. 목소리는 무게가 별로 없잖아요.' },
  jio: { item: 'filter', line: '정수 필터는 어때요? 로봇은 물을 안 마시지만 우리는 마시니까요.' },
};

/** 숨 고르기 때 동료가 하는 짐 이야기 */
export const BAG_TALK: Record<CandidateId, string> = {
  harin: '난 바늘 하나만 주머니에 넣었어. 무게는 안 나가. ...아마.',
  taeo: '렌치는 공용 장비라 이미 실렸대. 다행이지. 그 녀석 없으면 잠이 안 와.',
  seojin: '내 파우치는 의료 키트 안에 같이 들어갔어. 숫자로 확인했어.',
  woojoo: '티백 몇 개는 주머니에... 아, 이것도 무게에 들어가? 들어가면 내가 덜 먹을게.',
  dodam: '헤드폰은 목에 걸고 있으면 짐이 아니래요. 그래서 계속 걸고 있어요.',
  jio: '삽은 제 어깨에 타고 가요. 짐 아니에요. 승객이에요!',
};

export const JETTISON_KG = 3;

/**
 * C3 저울 b(예비 밸브 전환):
 * - 예비 부품을 실었으면 그 부품으로 V2를 직접 교체한다(부품 소모, 투하 없음).
 * - 없으면 아크의 하나뿐인 예비 밸브 모듈을 쓴다: 추가 연소 때문에 짐을 3kg 이상(3kg 미만이면 전부) 덜어 내고,
 *   C4 물 회수 수리에 쓸 예비가 사라진다(flag c3_backup_used). 어떤 경우에도 대가가 있다.
 */
export function spareValvePlan(inventory: readonly string[], crew: readonly CandidateId[]): { consume: string | null; needKg: number } {
  if (inventory.includes('parts')) return { consume: 'parts', needKg: 0 };
  const total = totalKg(itemsOf(crew, inventory));
  return { consume: null, needKg: Math.min(JETTISON_KG, total) };
}

export function jettisonOk(inventory: readonly string[], chosen: readonly string[], crew: readonly CandidateId[]): boolean {
  if (new Set(chosen).size !== chosen.length || !chosen.every((c) => inventory.includes(c))) return false;
  const need = spareValvePlan(inventory, crew).needKg;
  return totalKg(itemsOf(crew, chosen)) + 1e-9 >= need;
}

/** 시뮬레이션용 기본 투하: 뒤에서부터 필요한 무게가 찰 때까지 */
export function defaultJettison(inventory: readonly string[], crew: readonly CandidateId[]): string[] {
  const need = spareValvePlan(inventory, crew).needKg;
  const out: string[] = [];
  let sum = 0;
  for (const it of [...itemsOf(crew, inventory)].reverse()) {
    if (sum + 1e-9 >= need) break;
    out.push(it.id);
    sum += it.kg;
  }
  return out;
}
