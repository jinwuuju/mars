export type Child = Node | string | null | undefined | false;
type Attrs = Record<string, unknown>;

/** 작은 DOM 헬퍼. 모든 UI 텍스트는 캔버스가 아니라 DOM으로 렌더링한다. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function pxImg(src: string, alt: string, cls = ''): HTMLImageElement {
  return h('img', { src, alt, class: `px ${cls}`.trim(), draggable: 'false' });
}

let toastTimer: number | undefined;
export function toast(root: HTMLElement, text: string, ms = 3200): void {
  clear(root);
  root.append(h('div', { class: 'toast-card' }, text));
  root.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => root.classList.remove('show'), ms);
}
