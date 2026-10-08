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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
        <Lock size={11} />
        확정됨
      </span>
    );
  }

  if (status === 'LIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        진행 중
      </span>
    );
  }

  if (status === 'RESOLVED') {
    if (hit !== false) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/15 text-[#38bdf8] border border-sky-500/30">
          <CheckCircle2 size={12} className="text-[#38bdf8]" />
          {label || '적중'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
        <XCircle size={12} className="text-zinc-400" />
        빗나감
      </span>
    );
  }

  return null;
}
