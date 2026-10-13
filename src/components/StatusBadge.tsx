import type { ForecastStatus } from '../domain/types';
import { Lock, CheckCircle2, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: ForecastStatus;
  directionHit?: boolean;
  isHit?: boolean;
  label?: string;
}

export function StatusBadge({ status, directionHit, isHit, label }: StatusBadgeProps) {
  const hit = isHit !== undefined ? isHit : directionHit;

  if (status === 'LOCKED') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-900 text-zinc-400 border border-white/10">
        <Lock size={10} />
        확정됨
      </span>
    );
  }

  if (status === 'LIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        진행 중
      </span>
    );
  }

  if (status === 'RESOLVED') {
    if (hit !== false) {
      return (
        /* 월가 샴페인 골드 적중 뱃지 */
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#C5A059]/10 text-[#DFC15D] border border-[#C5A059]/25 font-mono">
          <CheckCircle2 size={11} className="text-[#DFC15D]" />
          {label || '적중'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-900 text-zinc-400 border border-white/10">
        <XCircle size={11} className="text-zinc-400" />
        빗나감
      </span>
    );
  }

  return null;
}
