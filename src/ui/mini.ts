import { h, clear } from './dom';
import { lines, type ModalHandle, type ModalHost } from './panels';

/** 공용: 녹녹이 도움 버튼(막힘 방지, 측정과 무관) */
const assistBtn = (f: () => void): HTMLElement => h('button', { class: 'btn assist', type: 'button', onClick: f }, '녹녹이에게 맡기기');
// 쉬운 퍼즐: 한 번 틀리면 정답(다음 단계)이 반짝인다. 틀려도 처음부터 다시 하지 않는다.

// ---------- C4 관로 퍼즐 ----------
type Side = 0 | 1 | 2 | 3; // 위 오른 아래 왼
interface PipeCell { r: number; c: number; need: Side[]; fixed?: boolean; filter?: boolean }
const ROUTES: Record<'standard' | 'new', PipeCell[]> = {
  standard: [
    { r: 1, c: 0, need: [3, 1] }, { r: 1, c: 1, need: [3, 2] }, { r: 2, c: 1, need: [0, 1] }, { r: 2, c: 2, need: [3, 1], fixed: true, filter: true },
    { r: 2, c: 3, need: [3, 0] }, { r: 1, c: 3, need: [2, 1] }, { r: 1, c: 4, need: [3, 1] },
  ],
  new: [
    { r: 1, c: 0, need: [3, 0] }, { r: 0, c: 0, need: [2, 1] }, { r: 0, c: 1, need: [3, 1] }, { r: 0, c: 2, need: [3, 1], fixed: true, filter: true },
    { r: 0, c: 3, need: [3, 2] }, { r: 1, c: 3, need: [0, 1] }, { r: 1, c: 4, need: [3, 1] },
  ],
};
const rot = (sides: Side[], r: number): Side[] => sides.map((s) => ((s + r) % 4) as Side);
const same = (a: Side[], b: Side[]): boolean => a.length === b.length && a.every((x) => b.includes(x));
const isStraight = (need: Side[]): boolean => (need[0] + 2) % 4 === need[1];
const baseOf = (need: Side[]): Side[] => (isStraight(need) ? [3, 1] : [0, 1]);

/** 물 회수 회로: 타일을 눌러 돌려서 입구(왼쪽)부터 필터를 거쳐 출구(오른쪽)까지 잇는다. 두 경로는 타일 수가 같다. */
export function pipePuzzle(host: ModalHost, opts: { variant: 'standard' | 'new'; onLog?: () => void; preSolved?: number; extraTile?: boolean; hint?: string }): Promise<void> {
  return new Promise((resolve) => {
    const route = ROUTES[opts.variant];
    const cells: { r: number; c: number; base: Side[]; rot: number; need?: Side[]; fixed?: boolean; filter?: boolean }[] = [];
    for (let r = 0; r < 3; r += 1) for (let c = 0; c < 5; c += 1) {
      const p = route.find((x) => x.r === r && x.c === c);
      if (p) {
        const base = baseOf(p.need);
        let good = 0;
        for (let k = 0; k < 4; k += 1) if (same(rot(base, k), p.need)) { good = k; break; }
        const fixed = p.fixed && !opts.extraTile;
        cells.push({ r, c, base, rot: fixed ? good : (good + 1 + ((r + c) % 2)) % 4, need: p.need, fixed, filter: p.filter });
      } else {
        cells.push({ r, c, base: (r + c) % 2 ? [3, 1] : [0, 1], rot: (r * 3 + c) % 4 });
      }
    }
    // 태오의 고백(1단계 단축): 경로 앞쪽 타일 몇 개를 미리 맞춰 둔다
    let pre = opts.preSolved ?? 0;
    for (const p of route) {
      if (pre <= 0) break;
      const x = cells.find((cc) => cc.r === p.r && cc.c === p.c);
      if (!x || x.fixed || !x.need) continue;
      for (let k = 0; k < 4; k += 1) if (same(rot(x.base, k), x.need)) { x.rot = k; break; }
      x.fixed = true;
      pre -= 1;
    }
    const solved = (): boolean => cells.every((x) => !x.need || same(rot(x.base, x.rot), x.need));
    const body = h('div', { class: 'pipes' });
    let handle: ModalHandle | null = null;
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      window.setTimeout(() => { handle?.close(); resolve(); }, 450);
    };
    const render = (): void => {
      clear(body);
      const ok = solved();
      const grid = h('div', { class: `pipe-grid${ok ? ' solved' : ''}`, role: 'grid', 'aria-label': '관로 퍼즐' });
      cells.forEach((x, i) => {
        const sides = rot(x.base, x.rot);
        const good = x.need ? same(sides, x.need) : false;
        const t = h('button', {
          class: `pipe${x.need ? ' path' : ''}${good ? ' good' : ''}${x.filter ? ' filter' : ''}`, type: 'button',
          'aria-label': `${x.r + 1}행 ${x.c + 1}열 관 ${x.fixed ? '(고정)' : '(누르면 회전)'}`, disabled: Boolean(x.fixed) || ok,
          onClick: () => { cells[i].rot = (cells[i].rot + 1) % 4; render(); if (solved()) finish(); },
        }, ...sides.map((s) => h('i', { class: `arm a${s}` })), x.filter ? h('b', {}, 'F') : '');
        grid.append(t);
      });
      body.append(
        h('p', { class: 'subtitle' }, '타일을 눌러 돌려 왼쪽 입구에서 필터(F)를 지나 오른쪽 출구까지 물길을 이으세요.'),
        opts.hint ? h('p', { class: 'hint' }, opts.hint) : '',
        h('div', { class: 'pipe-wrap' }, h('span', { class: 'pipe-in' }, '입구 →'), grid, h('span', { class: 'pipe-out' }, '→ 출구')),
        h('p', { class: 'muted small', 'aria-live': 'polite' }, ok ? '물이 다시 돈다!' : `맞춘 관: ${cells.filter((x) => x.need && same(rot(x.base, x.rot), x.need)).length}/${route.length}`),
      );
    };
    render();
    handle = host.open({
      title: '물 회수 회로 수리', body, cls: 'wide pipe-modal', closable: false,
      footer: h('div', { class: 'row' },
        opts.onLog ? h('button', { class: 'btn info-opp', type: 'button', onClick: () => opts.onLog?.() }, '장치 기록 보기') : '',
        assistBtn(() => { cells.forEach((x) => { if (x.need) { for (let k = 0; k < 4; k += 1) if (same(rot(x.base, k), x.need)) { x.rot = k; break; } } }); render(); finish(); })),
    });
  });
}

// ---------- 순서 퍼즐 ----------
export function orderPuzzle(host: ModalHost, opts: { title: string; intro: string; items: { id: string; label: string }[]; correct: string[]; hint: string }): Promise<number> {
  return new Promise((resolve) => {
    let seq: string[] = [];
    let mistakes = 0;
    let nudge = false;
    const body = h('div', { class: 'order-puzzle' });
    const note = h('p', { class: 'ig-note', 'aria-live': 'polite' });
    let handle: ModalHandle | null = null;
    const done = (): void => { handle?.close(); resolve(mistakes); };
    const render = (): void => {
      clear(body);
      body.append(
        h('p', {}, opts.intro),
        h('ol', { class: 'seq' }, ...seq.map((id) => h('li', {}, opts.items.find((x) => x.id === id)?.label ?? id))),
        h('div', { class: 'choices' }, ...opts.items.map((it) => h('button', {
          class: `btn small${nudge && it.id === opts.correct[seq.length] ? ' nudge' : ''}`, type: 'button', disabled: seq.includes(it.id),
          onClick: () => {
            // 틀린 단계는 받지 않고 알려 주기만 한다(맞춘 단계는 그대로 남는다)
            if (it.id !== opts.correct[seq.length]) {
              mistakes += 1;
              nudge = true;
              note.textContent = opts.hint;
              render();
              return;
            }
            seq = [...seq, it.id];
            nudge = false;
            note.textContent = '';
            if (seq.length === opts.correct.length) { render(); window.setTimeout(done, 300); return; }
            render();
          },
        }, it.label))),
        note,
      );
    };
    render();
    handle = host.open({ title: opts.title, body, closable: false, footer: h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onClick: () => { seq = []; render(); } }, '처음부터'),
      assistBtn(() => { seq = [...opts.correct]; render(); window.setTimeout(done, 300); })) });
  });
}

// ---------- 계통 진단 고르기 ----------
export function pickPuzzle(host: ModalHost, opts: { title: string; intro: string; cards: { id: string; label: string; gauge: string; detail: string }[]; answer: string; hint: string; extra?: HTMLElement }): Promise<void> {
  return new Promise((resolve) => {
    let sel: string | null = null;
    let nudge = false;
    const note = h('p', { class: 'ig-note', 'aria-live': 'polite' });
    const body = h('div', { class: 'pick' });
    let handle: ModalHandle | null = null;
    const render = (): void => {
      clear(body);
      body.append(h('p', {}, opts.intro), opts.extra ?? '',
        h('div', { class: 'sys-grid' }, ...opts.cards.map((c) => h('button', {
          class: `sys${sel === c.id ? ' on' : ''}${nudge && c.id === opts.answer ? ' nudge' : ''}`, type: 'button', 'aria-pressed': String(sel === c.id), onClick: () => { sel = c.id; render(); },
        }, h('b', {}, c.label), h('span', {}, c.gauge), sel === c.id ? h('small', {}, c.detail) : ''))), note);
    };
    const decide = (): void => {
      if (sel === opts.answer) { handle?.close(); resolve(); return; }
      nudge = true;
      render();
      note.textContent = opts.hint;
    };
    render();
    handle = host.open({ title: opts.title, body, closable: false, footer: h('div', { class: 'row' },
      assistBtn(() => { sel = opts.answer; render(); window.setTimeout(decide, 250); }),
      h('button', { class: 'btn primary', type: 'button', onClick: decide }, '이 계통이 원인')) });
  });
}

// ---------- 전력 토큰 보드 (저울) ----------
export function tokenBoard(host: ModalHost, opts: { title: string; intro: string; sockets: { id: string; label: string; keep: string; lose: string }[]; total: number; max: number }): Promise<number[]> {
  return new Promise((resolve) => {
    const alloc = opts.sockets.map(() => 0);
    const body = h('div', { class: 'tokens' });
    const confirm = h('button', { class: 'btn primary', type: 'button' }, '이 배분으로 확정');
    let handle: ModalHandle | null = null;
    const left = (): number => opts.total - alloc.reduce((a, b) => a + b, 0);
    const render = (): void => {
      clear(body);
      body.append(
        h('p', {}, opts.intro),
        h('div', { class: 'lock-row' }, '🔒 생명유지 최소치 — 고정(조정 불가)'),
        h('p', { class: 'tok-left', 'aria-live': 'polite' }, `남은 토큰 ${left()} / ${opts.total}`),
        ...opts.sockets.map((s, i) => h('div', { class: 'socket' },
          h('b', {}, s.label),
          h('div', { class: 'tok-dots' }, ...Array.from({ length: opts.max }, (_, k) => h('i', { class: k < alloc[i] ? 'on' : '' }))),
          h('button', { class: 'btn tiny', type: 'button', 'aria-label': `${s.label} 토큰 빼기`, disabled: alloc[i] === 0, onClick: () => { alloc[i] -= 1; render(); } }, '−'),
          h('button', { class: 'btn tiny', type: 'button', 'aria-label': `${s.label} 토큰 더하기`, disabled: alloc[i] >= opts.max || left() === 0, onClick: () => { alloc[i] += 1; render(); } }, '+'),
          h('small', {}, alloc[i] >= opts.max ? s.keep : s.lose))),
      );
      confirm.toggleAttribute('disabled', left() !== 0);
    };
    confirm.addEventListener('click', () => { handle?.close(); resolve([...alloc]); });
    render();
    handle = host.open({ title: opts.title, body, cls: 'wide', closable: false, footer: h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onClick: () => { alloc.fill(0); let t = opts.total; for (let i = 0; t > 0; i = (i + 1) % alloc.length) { if (alloc[i] < opts.max) { alloc[i] += 1; t -= 1; } } render(); } }, '고르게 나누기'),
      confirm) });
  });
}

// ---------- 로버 경로 ----------
export function gridRoute(host: ModalHost, opts: { cols: number; rows: number; slopes: string[]; start: string; target: string; battery: number; guide: string[] | null; title: string; onInfo?: () => void }): Promise<number> {
  return new Promise((resolve) => {
    let path = [opts.start];
    const body = h('div', { class: 'route' });
    const note = h('p', { class: 'ig-note', 'aria-live': 'polite' });
    let handle: ModalHandle | null = null;
    const key = (r: number, c: number): string => `${r},${c}`;
    const adj = (a: string, b: string): boolean => { const [r1, c1] = a.split(',').map(Number); const [r2, c2] = b.split(',').map(Number); return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; };
    const done = (): void => { handle?.close(); resolve(path.length - 1); };
    const render = (): void => {
      clear(body);
      const cur = path[path.length - 1];
      const nextGuide = opts.guide ? opts.guide[path.length] : null;
      const grid = h('div', { class: 'route-grid', style: { gridTemplateColumns: `repeat(${opts.cols}, 1fr)` } });
      for (let r = 0; r < opts.rows; r += 1) for (let c = 0; c < opts.cols; c += 1) {
        const k = key(r, c);
        const slope = opts.slopes.includes(k);
        const can = !slope && adj(cur, k) && !path.includes(k) && path.length - 1 < opts.battery;
        grid.append(h('button', {
          class: `cell${slope ? ' slope' : ''}${path.includes(k) ? ' walked' : ''}${k === cur ? ' rover' : ''}${k === opts.target ? ' target' : ''}${k === nextGuide ? ' guide' : ''}`,
          type: 'button', disabled: !can, 'aria-label': `${r + 1}행 ${c + 1}열${slope ? ' 급경사' : ''}${k === opts.target ? ' 목표' : ''}`,
          onClick: () => { path = [...path, k]; if (k === opts.target) { render(); window.setTimeout(done, 300); return; } render(); },
        }, k === cur ? '▲' : k === opts.target ? '◎' : slope ? '⛰' : ''));
      }
      body.append(h('p', {}, opts.guide ? 'MIRROR 표준 경로: 반짝이는 칸을 차례로 누르세요.' : '인접한 칸을 눌러 경로를 직접 설계하세요. 급경사(⛰)는 지날 수 없어요.'),
        grid, h('p', { class: 'muted small' }, `배터리 ${opts.battery - (path.length - 1)} 칸 남음`), note);
    };
    const best = (): string[] => {
      const q: string[][] = [[opts.start]];
      const seen = new Set([opts.start]);
      while (q.length) {
        const p = q.shift() as string[];
        const cur = p[p.length - 1];
        if (cur === opts.target) return p;
        const [r, c] = cur.split(',').map(Number);
        for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
          const k = key(r + dr, c + dc);
          if (r + dr < 0 || c + dc < 0 || r + dr >= opts.rows || c + dc >= opts.cols || seen.has(k) || opts.slopes.includes(k)) continue;
          seen.add(k);
          q.push([...p, k]);
        }
      }
      return [opts.start];
    };
    render();
    handle = host.open({ title: opts.title, body, cls: 'route-modal', closable: false, footer: h('div', { class: 'row' },
      opts.onInfo ? h('button', { class: 'btn', type: 'button', onClick: () => opts.onInfo?.() }, '지질 레이어 자료') : '',
      h('button', { class: 'btn', type: 'button', onClick: () => { path = [opts.start]; note.textContent = ''; render(); } }, '되돌리기'),
      assistBtn(() => { path = best(); render(); window.setTimeout(done, 300); })) });
  });
}

export function simpleList(host: ModalHost, title: string, items: string[], label = '계속'): Promise<void> {
  return new Promise((resolve) => {
    let handle: ModalHandle | null = null;
    const done = (): void => { handle?.close(); resolve(); };
    // Esc로 닫을 때도 같은 완료 처리를 한다. 창만 닫고 resolve하지 않으면 기다리던 흐름이 영원히 멈춘다.
    handle = host.open({ title, body: lines(items), footer: h('button', { class: 'btn primary', type: 'button', onClick: done }, label), onEscape: done });
  });
}
