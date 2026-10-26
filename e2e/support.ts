import type { MissionState } from '../src/core/state';
import type { MeasurementState } from '../src/analytics/measurement';
import type { Report } from '../src/analytics/scoring';

/** ?e2e=1 일 때만 노출되는 테스트 훅 */
export interface Mle {
  interact(id: string): void;
  ready(): boolean;
  actors(): string[];
  spots(): string[];
  state(): MissionState;
  measure(): MeasurementState;
  report(): Report;
  /** 걷는 지도(bunker 장면)에서 플레이어·인물의 캔버스 기준 화면 좌표 */
  screenOf(id: string): { x: number; y: number } | null;
}

declare global {
  interface Window { __mle: Mle }
}
