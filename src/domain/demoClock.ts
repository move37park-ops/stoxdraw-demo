export interface TimeWarpStep {
  date: string;
  code: string;
  label: string;
  phase: 'OPEN' | 'LIVE' | 'RESOLVED';
}

export const STUDIO_TIME_STEPS: TimeWarpStep[] = [
  { date: '2026-10-02', code: '오늘', label: '예측 입력', phase: 'OPEN' },
  { date: '2026-10-04', code: '2일 뒤', label: '중간 확인', phase: 'LIVE' },
  { date: '2026-10-06', code: '4일 뒤', label: '중간 확인', phase: 'LIVE' },
  { date: '2026-10-09', code: '예측 종료', label: '평가 완료', phase: 'RESOLVED' },
];
