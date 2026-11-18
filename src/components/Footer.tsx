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
  '예측 종료': '+7D End',
};

const STEP_LABEL_EN: Record<string, string> = {
  '예측 입력': 'Draw Forecast',
  '중간 확인': 'Mid Track',
  '평가 완료': 'Evaluated',
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
            {t('평가 및 이용 규칙', 'Docs')}
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="op-mono text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
            {t('시뮬레이션 시점', 'Preview Timeline')}
          </span>
          <div className="op-seg" role="group" aria-label={t('평가 결과 시뮬레이션 시점 선택', 'Select preview timeline')}>
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
