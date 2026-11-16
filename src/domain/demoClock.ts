export interface TimeWarpStep {
  date: string;
  code: string;
  label: string;
  phase: 'OPEN' | 'LIVE' | 'RESOLVED';
}

export const STUDIO_TIME_STEPS: TimeWarpStep[] = [
  { date: '2026-10-02', code: '오늘', label: '예측 입력', phase: 'OPEN' },
  { date: '2026-10-04', code: '2일 뒤', label: '초반 추적', phase: 'LIVE' },
  { date: '2026-10-06', code: '4일 뒤', label: '중반 추적', phase: 'LIVE' },
  { date: '2026-10-09', code: '7일 만기', label: '만기 정산', phase: 'RESOLVED' },
];
