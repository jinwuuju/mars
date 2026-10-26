export type Listener<S> = (next: S, prev: S) => void;

/** 아주 작은 단방향 스토어. 모든 변경은 순수 리듀서를 거친다. */
export class Store<S, A> {
  private current: S;
  private readonly listeners = new Set<Listener<S>>();
  private readonly reducer: (s: S, a: A) => S;

  constructor(reducer: (s: S, a: A) => S, initial: S) {
    this.reducer = reducer;
    this.current = initial;
  }

  get state(): S {
    return this.current;
  }

  dispatch(action: A): void {
    const prev = this.current;
    const next = this.reducer(prev, action);
    if (next === prev) return;
    this.current = next;
    this.listeners.forEach((l) => l(next, prev));
  }

  replace(next: S): void {
    const prev = this.current;
    this.current = next;
    this.listeners.forEach((l) => l(next, prev));
  }

  subscribe(l: Listener<S>): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
}
