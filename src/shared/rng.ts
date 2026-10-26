export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** 시드와 키로 0..n-1의 결정적 순열을 만든다 (포크 선택지 표시 순서 역균형). */
export function seededOrder(seed: number, key: string, n: number): number[] {
  const rand = mulberry32((seed ^ hashString(key)) >>> 0);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

export function newRunId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function newSeed(): number {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return a[0];
  }
  return Math.floor(Math.random() * 4294967295);
}
