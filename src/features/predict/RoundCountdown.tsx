import { useEffect, useState } from 'react';
import { getCountdownRemaining } from '../../domain/round';

interface RoundCountdownProps {
  cutoffAt: string;
  className?: string;
}

export function RoundCountdown({ cutoffAt, className }: RoundCountdownProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(c => c + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cutoffAt]);

  void tick;
  const { formatted } = getCountdownRemaining(cutoffAt);
  return <span className={className}>{formatted}</span>;
}
