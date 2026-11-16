import { Link } from 'react-router-dom';
import { STUDIO_TIME_STEPS } from '../domain/demoClock';
import { useI18n } from '../lib/i18nCore';
import { track } from '../lib/analytics';

interface FooterProps {
  currentDateStr: string;
  onDateChange: (newDate: string) => void;
}

const STEP_CODE_EN: Record<string, string> = {
  '오늘': 'Today',
  '2일 뒤': '+2D',
  '4일 뒤': '+4D',
  '7일 만기': '+7D Final',
};

const STEP_LABEL_EN: Record<string, string> = {
  '예측 입력': 'Forecast Input',
  '초반 추적': 'Early Track',
  '중반 추적': 'Mid Track',
  '만기 정산': 'Final Settle',
};

export function Footer({ currentDateStr, onDateChange }: FooterProps) {
  const { locale, t } = useI18n();

  return (
    <footer
      className="w-full"
      style={{
        backgroundColor: 'var(--op-canvas)',
        borderTop: '1px solid var(--op-line)',
      }}
    >
      <div className="w-full px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[13px]" style={{ color: 'var(--op-ink-2)' }}>
          <span className="inline-flex items-center gap-2 font-medium" style={{ color: 'var(--op-ink)' }}>
            <span
              className="w-2 h-2 rounded-[2px]"
              style={{ backgroundColor: 'var(--op-orange)' }}
              aria-hidden="true"
            />
            Orange Paths
          </span>
          <span style={{ color: 'var(--op-line-strong)' }}>·</span>
          <Link
            to="/docs"
            className="hover:text-[var(--op-ink)] transition-colors"
            style={{ color: 'var(--op-ink-2)' }}
          >
            {t('상세 규칙 (Docs)', 'Docs')}
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="op-mono text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
            {t('시점', 'Clock')}
          </span>
          <div className="op-seg" role="group" aria-label={t('결과 미리보기 시점 선택', 'Select preview time')}>
            {STUDIO_TIME_STEPS.map(step => {
              const active = step.date === currentDateStr;
              const codeText = locale === 'en' ? (STEP_CODE_EN[step.code] ?? step.code) : step.code;
              const labelText = locale === 'en' ? (STEP_LABEL_EN[step.label] ?? step.label) : step.label;
              return (
                <button
                  key={step.date}
                  type="button"
                  data-active={active}
                  aria-pressed={active}
                  onClick={() => {
                    track('round_changed', { targetDate: step.date, code: step.code });
                    onDateChange(step.date);
                  }}
                  className="op-seg-btn"
                  title={`${codeText} (${labelText} · ${step.date})`}
                >
                  {codeText}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
