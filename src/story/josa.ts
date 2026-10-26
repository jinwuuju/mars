/** 한국어 조사 자동 처리: 받침 유무로 을/를, 이/가, 은/는, 과/와를 고른다. */
function lastChar(word: string): string {
  const t = word.trim();
  return t.charAt(t.length - 1);
}

export function hasBatchim(word: string): boolean {
  const code = lastChar(word).charCodeAt(0);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

export const eulReul = (w: string): string => `${w}${hasBatchim(w) ? '을' : '를'}`;
export const iGa = (w: string): string => `${w}${hasBatchim(w) ? '이' : '가'}`;
export const eunNeun = (w: string): string => `${w}${hasBatchim(w) ? '은' : '는'}`;
export const waGwa = (w: string): string => `${w}${hasBatchim(w) ? '과' : '와'}`;
