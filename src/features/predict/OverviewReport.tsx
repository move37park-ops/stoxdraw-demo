import { useMemo } from 'react';
import { computeMarketOverview } from '../../domain/report';
import type { MarketBar } from '../../domain/types';
import { useI18n } from '../../lib/i18nCore';

interface OverviewReportProps {
  basePrice: number;
  baseDate: string;
  expiryDate: string;
  historyBars: MarketBar[];
}

export function OverviewReport({
  basePrice,
  baseDate,
  expiryDate,
  historyBars,
}: OverviewReportProps) {
  const { t } = useI18n();
  const overview = useMemo(() => computeMarketOverview(historyBars, 7), [historyBars]);

  const lowUsd = Math.round(basePrice * (1 - overview.expectedMove20dPct / 100));
  const highUsd = Math.round(basePrice * (1 + overview.expectedMove20dPct / 100));

  return (
    <div
      className="px-4 sm:px-6 py-5"
      style={{ backgroundColor: 'var(--op-canvas)' }}
    >
      <div
        className="p-4 rounded-[2px] flex flex-wrap items-center justify-between gap-4"
        style={{
          backgroundColor: 'var(--op-panel)',
          border: '1px solid var(--op-line-strong)',
        }}
      >
        <div className="space-y-1">
          <div className="op-mono text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
            {t('7일 실현변동성 ±1σ 범위', '7D Realized Vol ±1σ Range')} · {baseDate.slice(5)}–{expiryDate.slice(5)}
          </div>
          <div className="op-mono text-[15px] font-semibold" style={{ color: 'var(--op-ink)' }}>
            ${lowUsd.toLocaleString('en-US')} – ${highUsd.toLocaleString('en-US')}{' '}
            <span className="text-[12.5px] font-medium" style={{ color: 'var(--op-orange)' }}>
              (±{overview.expectedMove20dPct.toFixed(1)}%)
            </span>
          </div>
        </div>

        <p className="text-[12.5px] max-w-[460px]" style={{ color: 'var(--op-ink-2)' }}>
          {t(
            '경로를 확정 제출하면 가려져 있던 일별 분위수 밴드(P15–P85)와 고티어 중앙 궤적이 즉시 열립니다.',
            'Lock in your 7D path to unlock crowd quantile bands (P15–P85) and Top-Tier median paths.'
          )}
        </p>
      </div>
    </div>
  );
}
