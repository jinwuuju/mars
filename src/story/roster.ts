import { CANDIDATE_IDS, isCandidateId, type CandidateId } from '../shared/ids';

export const SEAT_COUNT = 4;
export type Seats = (CandidateId | null)[];

export function emptySeats(): Seats {
  return [null, null, null, null];
}

export function seatedIds(seats: Seats): CandidateId[] {
  return seats.filter((s): s is CandidateId => s !== null);
}

/**
 * 좌석 배정. slot이 없으면 첫 빈 좌석. slot이 있으면 그 자리에 앉히고,
 * 이미 다른 자리에 앉아 있던 사람이면 두 자리를 맞바꾼다.
 */
export function assignSeat(seats: Seats, id: CandidateId, slot?: number): Seats {
  const current = seats.indexOf(id);
  if (slot === undefined) {
    if (current !== -1) return seats;
    const empty = seats.indexOf(null);
    if (empty === -1) return seats;
    const next = seats.slice();
    next[empty] = id;
    return next;
  }
  if (!Number.isInteger(slot) || slot < 0 || slot >= SEAT_COUNT || current === slot) return seats;
  const next = seats.slice();
  const occupant = next[slot];
  if (current !== -1) next[current] = occupant;
  next[slot] = id;
  return next;
}

export function unassignSeat(seats: Seats, id: CandidateId): Seats {
  const i = seats.indexOf(id);
  if (i === -1) return seats;
  const next = seats.slice();
  next[i] = null;
  return next;
}

export function canLock(seats: Seats): boolean {
  const ids = seatedIds(seats);
  return seats.length === SEAT_COUNT && ids.length === SEAT_COUNT && new Set(ids).size === SEAT_COUNT && ids.every(isCandidateId);
}

export function unselectedOf(crew: readonly CandidateId[]): CandidateId[] {
  return CANDIDATE_IDS.filter((c) => !crew.includes(c));
}

/** 6C4 = 15가지 승선 조합 */
export function allRosters(): CandidateId[][] {
  const ids = CANDIDATE_IDS;
  const out: CandidateId[][] = [];
  for (let a = 0; a < ids.length; a += 1)
    for (let b = a + 1; b < ids.length; b += 1)
      for (let c = b + 1; c < ids.length; c += 1)
        for (let d = c + 1; d < ids.length; d += 1) out.push([ids[a], ids[b], ids[c], ids[d]]);
  return out;
}
