import { h, clear, pxImg } from './dom';
import { confirmPanel, type ModalHandle, type ModalHost } from './panels';

export interface Voice { name: string; portrait: string | null; text: string }

export interface ScaleOption {
  id: string;
  title: string;
  desc: string;
  cost: string;
  support: Voice;
  worry: Voice;
  /** 이 선택지를 고를 수 없는 이유(예: 연료 부족). 있으면 버튼이 비활성화된다 */
  disabled?: string;
}

/** 저울(딜레마) 화면: 모든 길이 안전 기준을 채우고, 각자 다른 값을 치른다. 비채점. */
export function scalePanel(host: ModalHost, opts: { title: string; subtitle: string; options: ScaleOption[] }): Promise<string> {
  return new Promise((resolve) => {
    let handle: ModalHandle | null = null;
    const voice = (v: Voice, kind: 'support' | 'worry'): HTMLElement =>
      h('div', { class: `voice ${kind}` }, v.portrait ? pxImg(v.portrait, v.name, 'mini') : null,
        h('p', {}, h('b', {}, `${kind === 'support' ? '지지' : '우려'} · ${v.name}`), h('br', {}), v.text));
    const cards = opts.options.map((o) => h('article', { class: 'scale-card', 'data-id': o.id },
      h('h3', {}, o.title),
      h('p', {}, o.desc),
      h('p', { class: 'cost' }, o.cost),
      voice(o.support, 'support'),
      voice(o.worry, 'worry'),
      o.disabled ? h('p', { class: 'muted small' }, o.disabled) : '',
      h('button', {
        class: 'btn primary', type: 'button', disabled: Boolean(o.disabled),
        onClick: async () => {
          const ok = await confirmPanel(host, {
            title: '되돌릴 수 없어요',
            body: h('p', {}, `이 길로 갈까요: ${o.title}. 안전 기준은 어느 길로든 채워져요. 이 선택은 성격 결과에 쓰이지 않아요.`),
            confirmLabel: '이 길로 확정',
            cancelLabel: '다시 생각하기',
          });
          if (!ok) return;
          handle?.close();
          resolve(o.id);
        },
      }, '이 길로'),
    ));
    handle = host.open({
      title: opts.title,
      cls: 'wide scale',
      closable: false,
      body: h('div', {}, h('p', { class: 'subtitle' }, opts.subtitle), h('div', { class: 'scale-grid' }, ...cards)),
    });
  });
}

export interface PickItem { id: string; name: string; kg: number; icon: string; note?: string }

/** 투하할 짐 고르기: 필요한 무게 이상을 골라야 확정할 수 있다 */
export function jettisonPicker(host: ModalHost, opts: { items: PickItem[]; needKg: number; title: string; intro: string }): Promise<string[]> {
  return new Promise((resolve) => {
    const chosen = new Set<string>();
    const body = h('div', { class: 'jettison' });
    let handle: ModalHandle | null = null;
    const confirmBtn = h('button', { class: 'btn primary', type: 'button' }, '투하');
    const draw = (): void => {
      clear(body);
      const sum = opts.items.filter((i) => chosen.has(i.id)).reduce((a, i) => a + i.kg, 0);
      body.append(
        h('p', {}, opts.intro),
        h('p', { class: 'jet-sum', 'aria-live': 'polite' }, `고른 무게 ${sum.toFixed(1)}kg / 필요 ${opts.needKg.toFixed(1)}kg`),
        h('div', { class: 'jet-list' }, ...opts.items.map((i) => h('button', {
          class: `btn jet-item${chosen.has(i.id) ? ' on' : ''}`, type: 'button', 'aria-pressed': String(chosen.has(i.id)), 'data-id': i.id,
          onClick: () => { if (chosen.has(i.id)) chosen.delete(i.id); else chosen.add(i.id); draw(); },
        }, pxImg(i.icon, i.name, 'item'), ` ${i.name} · ${i.kg}kg`, i.note ? h('small', {}, ` (${i.note})`) : null))),
      );
      confirmBtn.toggleAttribute('disabled', sum + 1e-9 < opts.needKg);
    };
    confirmBtn.addEventListener('click', () => { handle?.close(); resolve([...chosen]); });
    draw();
    handle = host.open({ title: opts.title, body, footer: confirmBtn, closable: false });
  });
}
