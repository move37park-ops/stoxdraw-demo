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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800">
        <Lock size={10} />
        확정
      </span>
    );
  }

  if (status === 'LIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-900 text-zinc-200 border border-zinc-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        진행 중
      </span>
    );
  }

  if (status === 'RESOLVED') {
    if (hit !== false) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
          <CheckCircle2 size={11} className="text-emerald-400" />
          {label || '적중'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800">
        <XCircle size={11} className="text-zinc-500" />
        빗나감
      </span>
    );
  }

  return null;
}
