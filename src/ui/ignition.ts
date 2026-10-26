import { h, clear } from './dom';
import type { ModalHandle, ModalHost } from './panels';

/**
 * 점화 미니게임: 3단 추력 바늘을 초록 띠 안에 유지한다. 실패는 없다.
 * 띠 밖에 오래 있으면 녹녹이가 자동으로 잡아 준다. 움직임 줄이기 모드에서는 버튼을 누를 때만 한 칸씩 움직인다.
 * 성공·속도·도움 사용은 측정에 쓰지 않는다.
 */
export function ignitionGame(host: ModalHost, opts: { reduced: boolean; rough: boolean; onShake?: (stage: number) => void; title?: string; holdLabel?: string; stageHint?: string }): Promise<{ assisted: boolean }> {
  return new Promise((resolve) => {
    const BANDS: [number, number][] = [[38, 62], [48, 72], [58, 82]];
    let stage = 0;
    let needle = 18;
    let progress = 0;
    let out = 0;
    let holding = false;
    let assisting = false;
    let assisted = false;
    let finished = false;
    let raf = 0;
    let last = performance.now();
    const band = h('div', { class: 'ig-band' });
    const needleEl = h('div', { class: 'ig-needle' });
    const meter = h('div', { class: 'ig-meter', role: 'img', 'aria-label': '추력 계기' }, band, needleEl);
    const prog = h('div', { class: 'ig-progress' }, h('i', {}));
    const stageText = h('p', { class: 'ig-stage', 'aria-live': 'polite' });
    const note = h('p', { class: 'ig-note', 'aria-live': 'polite' });
    const dots = h('div', { class: 'ig-dots' });
    let handle: ModalHandle | null = null;

    const render = (): void => {
      const [lo, hi] = BANDS[stage];
      band.style.bottom = `${lo}%`;
      band.style.height = `${hi - lo}%`;
      needleEl.style.bottom = `${needle}%`;
      needleEl.classList.toggle('in', needle >= lo && needle <= hi);
      (prog.firstChild as HTMLElement).style.width = `${Math.round(Math.min(1, progress) * 100)}%`;
      stageText.textContent = `${stage + 1}단계 / 3 — ${opts.stageHint ?? '바늘을 초록 띠 안에 두세요'}`;
      clear(dots);
      for (let i = 0; i < 3; i += 1) dots.append(h('i', { class: i < stage ? 'done' : i === stage ? 'now' : '' }));
    };

    const finish = (): void => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keyup', keyUp);
      handle?.close();
      resolve({ assisted });
    };

    const nextStage = (): void => {
      stage += 1;
      progress = 0;
      out = 0;
      assisting = false;
      note.textContent = stage < 3 ? '좋아요! 다음 단계로 추력을 올려요.' : '';
      if (stage >= 3) { finish(); return; }
      opts.onShake?.(stage);
      render();
    };

    const tick = (t: number): void => {
      if (finished) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const [lo, hi] = BANDS[stage];
      const center = (lo + hi) / 2;
      if (assisting) needle += (center - needle) * Math.min(1, dt * 4);
      else needle += (holding ? 46 : -34) * dt + (Math.random() - 0.5) * (opts.rough ? 70 : 34) * dt;
      needle = Math.max(0, Math.min(100, needle));
      if (needle >= lo && needle <= hi) { progress += dt / 2.2; out = 0; }
      else {
        out += dt;
        if (out > 5 && !assisting) { assisting = true; assisted = true; note.textContent = '녹녹이: 제가 잡을게요!'; }
      }
      if (progress >= 1) nextStage();
      render();
      raf = requestAnimationFrame(tick);
    };

    const step = (delta: number): void => {
      if (finished) return;
      needle = Math.max(0, Math.min(100, needle + delta));
      const [lo, hi] = BANDS[stage];
      if (needle >= lo && needle <= hi) progress += 0.34;
      if (progress >= 1) nextStage();
      if (!finished) render();
    };

    const keyUp = (e: KeyboardEvent): void => { if (e.key === ' ' || e.key === 'Enter') holding = false; };
    const holdBtn = h('button', { class: 'btn primary big ig-hold', type: 'button' }, opts.reduced ? '한 번 밀기' : opts.holdLabel ?? '추력 올리기 (누르고 있기)');
    if (opts.reduced) {
      holdBtn.addEventListener('click', () => step(12));
    } else {
      holdBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); holding = true; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => holdBtn.addEventListener(ev, () => { holding = false; }));
      holdBtn.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); holding = true; } });
      window.addEventListener('keyup', keyUp);
    }
    const easeBtn = opts.reduced ? h('button', { class: 'btn', type: 'button', onClick: () => step(-10) }, '살짝 놓기') : null;
    const assistBtn = h('button', {
      class: 'btn assist', type: 'button',
      onClick: () => { assisted = true; note.textContent = '녹녹이: 맡겨 주세요! 녹녹!'; window.setTimeout(finish, opts.reduced ? 0 : 700); },
    }, '녹녹이에게 맡기기');

    handle = host.open({
      title: opts.title ?? '점화 — 3단 추력',
      cls: 'ignition-modal',
      closable: false,
      body: h('div', { class: 'ignition' },
        h('div', { class: 'ig-left' }, meter),
        h('div', { class: 'ig-right' }, stageText, dots, prog, note,
          h('p', { class: 'muted small' }, '실패는 없어요. 어렵다면 녹녹이에게 맡겨도 이야기는 똑같이 이어져요.')),
      ),
      footer: h('div', { class: 'row' }, assistBtn, easeBtn, holdBtn),
    });
    render();
    opts.onShake?.(0);
    if (!opts.reduced) raf = requestAnimationFrame((t) => { last = t; tick(t); });
  });
}
