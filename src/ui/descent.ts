import { h, clear } from './dom';
import type { ModalHandle, ModalHost } from './panels';

/**
 * C5 강하: 고도가 내려갈수록 좁아지는 안전 원뿔 안에 착륙선을 유지한다(좌우 자세 + 추력).
 * 실패 없음: 원뿔 밖에 4초 이상 있으면 녹녹이가 자세를 잡아 준다. 움직임 줄이기면 누를 때만 한 틱 진행.
 */
export function descentGame(host: ModalHost, opts: { reduced: boolean; gusty: boolean }): Promise<{ assisted: boolean }> {
  return new Promise((resolve) => {
    const W = 220;
    const H = 260;
    let x = 0.5;
    let vx = 0;
    let alt = 1;
    let vy = 0.06;
    let out = 0;
    let assisted = false;
    let assisting = false;
    let finished = false;
    let landing = false;
    let raf = 0;
    let last = performance.now();
    const input = { left: false, right: false, thrust: false };
    const cv = h('canvas', { width: String(W), height: String(H), class: 'descent-cv', role: 'img', 'aria-label': '강하 화면: 착륙선과 안전 원뿔' }) as HTMLCanvasElement;
    const status = h('p', { class: 'ig-stage', 'aria-live': 'polite' });
    const note = h('p', { class: 'ig-note', 'aria-live': 'polite' });
    let handle: ModalHandle | null = null;
    const coneHalf = (a: number): number => 0.08 + a * 0.32;
    const inCone = (): boolean => Math.abs(x - 0.5) <= coneHalf(alt);

    const draw = (): void => {
      const g = cv.getContext('2d');
      if (!g) return;
      g.fillStyle = '#E8B08F'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#C27A57'; g.fillRect(0, H - 30, W, 30);
      g.fillStyle = 'rgba(150,217,188,0.35)';
      g.beginPath(); g.moveTo(W * (0.5 - coneHalf(1)), 0); g.lineTo(W * (0.5 + coneHalf(1)), 0); g.lineTo(W * (0.5 + coneHalf(0)), H - 30); g.lineTo(W * (0.5 - coneHalf(0)), H - 30); g.closePath(); g.fill();
      g.fillStyle = '#FFD47B'; g.fillRect(W * 0.5 - 14, H - 32, 28, 3);
      const ly = (1 - alt) * (H - 60) + 10;
      const lx = x * W;
      g.fillStyle = '#283044'; g.fillRect(lx - 9, ly - 1, 18, 14);
      g.fillStyle = '#FFF4DA'; g.fillRect(lx - 7, ly + 1, 14, 10);
      g.fillStyle = '#96D9BC'; g.fillRect(lx - 3, ly + 3, 6, 4);
      g.fillStyle = '#5A6488'; g.fillRect(lx - 9, ly + 13, 3, 5); g.fillRect(lx + 6, ly + 13, 3, 5);
      if (input.thrust || assisting) { g.fillStyle = '#F48B70'; g.fillRect(lx - 3, ly + 14, 6, 6 + Math.random() * 4); }
      status.textContent = `고도 ${Math.round(alt * 1200)}m · ${inCone() ? '안전 원뿔 안' : '원뿔 밖 — 자세를 바로잡아요'}`;
    };

    const finish = (): void => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      handle?.close();
      resolve({ assisted });
    };

    const physics = (dt: number): void => {
      const wind = (opts.gusty ? 0.16 : 0.09) * Math.sin(performance.now() / 700) + (Math.random() - 0.5) * 0.05;
      if (assisting) { vx += (0.5 - x) * 1.6 * dt; vx *= 0.9; }
      else vx += ((input.right ? 0.55 : 0) - (input.left ? 0.55 : 0) + wind) * dt;
      vx = Math.max(-0.35, Math.min(0.35, vx * 0.985));
      x = Math.max(0, Math.min(1, x + vx * dt));
      const target = input.thrust || assisting ? 0.035 : 0.09;
      vy += (target - vy) * Math.min(1, dt * 2);
      alt = Math.max(0, alt - vy * dt);
      if (inCone()) out = 0;
      else {
        out += dt;
        if (out > 4 && !assisting) { assisting = true; assisted = true; note.textContent = '녹녹이: 제가 잡을게요!'; }
      }
      if (alt <= 0 && !landing) {
        landing = true;
        note.textContent = '착지! 녹녹!';
        draw();
        cancelAnimationFrame(raf);
        window.setTimeout(finish, opts.reduced ? 0 : 500);
      }
    };

    const loop = (t: number): void => {
      if (finished || landing) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      physics(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    const step = (dir: 'left' | 'right' | 'thrust' | 'wait'): void => {
      if (finished || landing) return;
      input.left = dir === 'left';
      input.right = dir === 'right';
      input.thrust = dir === 'thrust';
      for (let i = 0; i < 6; i += 1) physics(0.05);
      input.left = false; input.right = false; input.thrust = false;
      if (!finished) draw();
    };

    const kd = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft' || e.key === 'a') input.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') input.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') { input.thrust = true; e.preventDefault(); }
    };
    const ku = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft' || e.key === 'a') input.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') input.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') input.thrust = false;
    };

    const hold = (label: string, key: 'left' | 'right' | 'thrust'): HTMLElement => {
      const b = h('button', { class: 'btn ig-hold', type: 'button' }, label);
      if (opts.reduced) b.addEventListener('click', () => step(key));
      else {
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); input[key] = true; });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => { input[key] = false; }));
      }
      return b;
    };

    const controls = h('div', { class: 'row' }, hold('◀ 왼쪽 자세', 'left'), hold(opts.reduced ? '역추진 한 번' : '역추진 (누르고 있기)', 'thrust'), hold('오른쪽 자세 ▶', 'right'),
      opts.reduced ? h('button', { class: 'btn', type: 'button', onClick: () => step('wait') }, '기다리기') : '');
    handle = host.open({
      title: '강하 — 자세 제어',
      cls: 'ignition-modal',
      closable: false,
      body: h('div', { class: 'descent' }, cv, h('div', {}, status, note, h('p', { class: 'muted small' }, '방향키·스페이스로도 조종할 수 있어요. 실패는 없어요.'), controls)),
      footer: h('button', { class: 'btn assist', type: 'button', onClick: () => { assisted = true; note.textContent = '녹녹이: 맡겨 주세요!'; assisting = true; if (opts.reduced) { alt = 0; finish(); } else window.setTimeout(() => { alt = 0.001; }, 900); } }, '녹녹이에게 맡기기'),
    });
    clear(note);
    draw();
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    if (!opts.reduced) raf = requestAnimationFrame((t) => { last = t; loop(t); });
  });
}

export interface SiteInfo { id: string; name: string; dist: string; slope: string; note: string; x: number; y: number; disabled?: string }

/** C5 착륙 후보 지도: 세 지점을 눌러 보고, 자료 2탭을 열 수 있다 */
export function landingMap(host: ModalHost, opts: { sites: SiteInfo[]; onData: () => void }): Promise<void> {
  return new Promise((resolve) => {
    let sel = opts.sites[0].id;
    const detail = h('div', { class: 'site-detail', 'aria-live': 'polite' });
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 300 180');
    svg.setAttribute('class', 'site-map');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '착륙 후보 지도');
    const add = (tag: string, a: Record<string, string | number>, text?: string): SVGElement => {
      const el = document.createElementNS(svgNS, tag);
      Object.entries(a).forEach(([k, v]) => el.setAttribute(k, String(v)));
      if (text) el.textContent = text;
      svg.append(el);
      return el;
    };
    add('rect', { x: 0, y: 0, width: 300, height: 180, fill: '#D99573' });
    add('path', { d: 'M0 120 Q60 90 120 110 T240 100 T300 112 L300 180 L0 180 Z', fill: '#C27A57' });
    add('path', { d: 'M180 0 Q200 60 170 120 T190 180', stroke: '#9E6680', 'stroke-width': 14, fill: 'none', opacity: 0.8 });
    add('circle', { cx: 150, cy: 40, r: 14, fill: '#F6E2BC', stroke: '#283044', 'stroke-width': 2 });
    add('text', { x: 150, y: 44, 'text-anchor': 'middle', 'font-size': 8, fill: '#283044' }, '돔');
    const render = (): void => {
      clear(detail);
      const s = opts.sites.find((x) => x.id === sel) ?? opts.sites[0];
      detail.append(h('b', {}, s.name), h('p', {}, `돔까지 ${s.dist} · 경사 ${s.slope}`), h('p', { class: 'small' }, s.note), s.disabled ? h('p', { class: 'warn small' }, s.disabled) : '');
    };
    opts.sites.forEach((s) => {
      const g = add('g', { class: `site-mk${s.disabled ? ' off' : ''}`, tabindex: 0, role: 'button', 'aria-label': s.name });
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', String(s.x)); c.setAttribute('cy', String(s.y)); c.setAttribute('r', '9');
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', String(s.x)); t.setAttribute('y', String(s.y + 3)); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '9');
      t.textContent = s.id === 'alpha' ? 'α' : s.id === 'beta' ? 'β' : 'γ';
      g.append(c, t);
      const pickIt = (): void => { sel = s.id; render(); };
      g.addEventListener('click', pickIt);
      g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') pickIt(); });
    });
    render();
    let handle: ModalHandle | null = null;
    handle = host.open({
      title: '착륙 후보 지도',
      cls: 'wide',
      closable: false,
      body: h('div', { class: 'landing' }, svg, detail, h('p', { class: 'muted small' }, '지점을 눌러 비교하세요. 어디로 내려갈지는 다음 화면에서 정해요.')),
      footer: h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onClick: () => opts.onData() }, '자료 2탭 열기'),
        h('button', { class: 'btn primary', type: 'button', onClick: () => { handle?.close(); resolve(); } }, '후보 비교 끝')),
    });
  });
}
