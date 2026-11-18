import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18nCore';

export function Footer() {
  const { t } = useI18n();

  return (
    <footer
      className="w-full"
      style={{
        backgroundColor: 'var(--op-canvas)',
        borderTop: '1px solid var(--op-line)',
      }}
    >
      <div className="w-full px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-[13px]" style={{ color: 'var(--op-ink-2)' }}>
          <span className="inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--op-ink)' }}>
            <span
              className="w-2 h-2 rounded-[2px]"
              style={{ backgroundColor: 'var(--op-orange)' }}
              aria-hidden="true"
            />
            Orange Paths
          </span>
          <span style={{ color: 'var(--op-line-strong)' }}>·</span>
          <span className="op-mono text-[11.5px]" style={{ color: 'var(--op-ink-3)' }}>
            Predict. Compare. Prove.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
          <span className="op-mono text-[11px] hidden sm:inline" style={{ color: 'var(--op-ink-3)' }}>
            {t('BTC/USDT 일간 7일 예측 네트워크', 'BTC/USDT Daily 7D Forecasting Network')}
          </span>
          <span className="hidden sm:inline" style={{ color: 'var(--op-line-strong)' }}>
            ·
          </span>
          <Link
            to="/docs"
            className="hover:text-[var(--op-ink)] transition-colors"
            style={{ color: 'var(--op-ink-2)' }}
          >
            {t('평가 및 이용 규칙', 'Scoring & Rules')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
