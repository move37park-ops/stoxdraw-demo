import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { useI18n } from '../../lib/i18nCore';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GuideModal({ isOpen, onClose }: GuideModalProps) {
  if (!isOpen) return null;
  return <GuideModalDialog onClose={onClose} />;
}

function GuideChartFrame({
  t,
  expiryActive = false,
  footerLeft,
  children,
}: {
  t: (ko: string, en: string) => string;
  expiryActive?: boolean;
  footerLeft?: ReactNode;
  children: ReactNode;
}) {
  return (
    <svg viewBox="0 0 420 190" className="w-full h-[196px]" fill="none" aria-hidden="true">
      <rect
        x="0.5"
        y="0.5"
        width="419"
        height="189"
        rx="2"
        fill="var(--op-panel)"
        stroke="var(--op-line)"
      />
      <rect x="132" y="1" width="287" height="156" fill="var(--op-canvas)" fillOpacity="0.55" />

      <line x1="16" y1="52" x2="404" y2="52" stroke="var(--op-chart-grid)" strokeDasharray="2 4" />
      <line x1="16" y1="98" x2="404" y2="98" stroke="var(--op-chart-grid)" strokeDasharray="2 4" />
      <line x1="16" y1="142" x2="404" y2="142" stroke="var(--op-chart-grid)" strokeDasharray="2 4" />

      <line x1="132" y1="16" x2="132" y2="156" stroke="var(--op-line-strong)" strokeDasharray="3 3" />
      <line
        x1="352"
        y1="16"
        x2="352"
        y2="156"
        stroke={expiryActive ? 'var(--op-orange)' : 'var(--op-line-strong)'}
        strokeOpacity={expiryActive ? 0.5 : 0.65}
        strokeDasharray="4 3"
      />

      {/* Shared Past Price Curve Leading to D-0 */}
      <polyline
        points="22,114 48,104 72,112 98,86 116,96 132,92"
        stroke="var(--op-ink)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="132" cy="92" r="4" fill="var(--op-ink)" />

      {children}

      {footerLeft}
      <text x="132" y="176" textAnchor="middle" fill="var(--op-ink-2)" fontSize="10.5" fontWeight="600" fontFamily="var(--font-mono)">
        D-0
      </text>
      <text
        x="352"
        y="176"
        textAnchor="middle"
        fill={expiryActive ? 'var(--op-orange)' : 'var(--op-ink-3)'}
        fontSize="10.5"
        fontWeight="600"
        fontFamily="var(--font-mono)"
      >
        {t('D+7 만기', 'D+7 Expiry')}
      </text>
    </svg>
  );
}

function StepVisualDraw({ t }: { t: (ko: string, en: string) => string }) {
  return (
    <GuideChartFrame t={t} expiryActive>
      <path
        d="M 132 92 L 190 118 L 268 68 L 352 44"
        pathLength={100}
        stroke="var(--op-orange)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="op-anim-stroke"
      />

      <circle
        cx="190"
        cy="118"
        r="5.5"
        fill="var(--op-canvas)"
        stroke="var(--op-orange)"
        strokeWidth="2.4"
        className="op-anim-dot-1"
      />
      <circle
        cx="268"
        cy="68"
        r="5.5"
        fill="var(--op-canvas)"
        stroke="var(--op-orange)"
        strokeWidth="2.4"
        className="op-anim-dot-2"
      />
      <circle
        cx="352"
        cy="44"
        r="6"
        fill="var(--op-orange)"
        className="op-anim-dot-3"
      />

      <g className="op-anim-cursor">
        <circle cx="0" cy="0" r="11" stroke="var(--op-orange)" strokeOpacity="0.35" strokeWidth="1.5" />
        <circle cx="0" cy="0" r="4" fill="var(--op-ink)" />
      </g>
    </GuideChartFrame>
  );
}

function StepVisualUnlock({ t }: { t: (ko: string, en: string) => string }) {
  return (
    <GuideChartFrame
      t={t}
      footerLeft={
        <g className="op-anim-band">
          <line x1="176" y1="172.5" x2="190" y2="172.5" stroke="var(--op-orange)" strokeWidth="2.4" />
          <text x="195" y="176" fill="var(--op-ink)" fontSize="10" fontFamily="var(--font-mono)">
            {t('내 경로', 'Mine')}
          </text>
          <line x1="244" y1="172.5" x2="258" y2="172.5" stroke="var(--op-smart)" strokeWidth="2.4" />
          <text x="263" y="176" fill="var(--op-smart)" fontSize="10" fontFamily="var(--font-mono)">
            {t('고티어', 'Top-Tier')}
          </text>
        </g>
      }
    >
      {/* Quantile Consensus Band + Distinct Crowd Median & Top-Tier Curves */}
      <polygon
        points="132,92 190,70 268,54 352,26 352,88 268,108 190,126"
        fill="var(--op-smart)"
        fillOpacity="0.14"
        className="op-anim-band"
      />
      <path
        d="M 132 92 L 190 98 L 268 88 L 352 76"
        pathLength={100}
        stroke="var(--op-crowd)"
        strokeWidth="1.7"
        strokeDasharray="4 3"
        className="op-anim-band"
      />
      <path
        d="M 132 92 L 190 78 L 268 96 L 352 30"
        pathLength={100}
        stroke="var(--op-smart)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="op-anim-delayed-stroke"
      />

      {/* Same User Orange Path & Pivots from Step 1 */}
      <path
        d="M 132 92 L 190 118 L 268 68 L 352 44"
        stroke="var(--op-orange)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="190" cy="118" r="4" fill="var(--op-canvas)" stroke="var(--op-orange)" strokeWidth="2" />
      <circle cx="268" cy="68" r="4" fill="var(--op-canvas)" stroke="var(--op-orange)" strokeWidth="2" />
      <circle cx="352" cy="44" r="5" fill="var(--op-orange)" />

      {/* Blind Guard Veil Clearing After Submit */}
      <g className="op-anim-veil">
        <rect x="200" y="24" width="188" height="30" rx="2" fill="var(--op-raised)" stroke="var(--op-line-strong)" />
        <text x="294" y="43" textAnchor="middle" fill="var(--op-ink-2)" fontSize="10.5" fontWeight="600" fontFamily="var(--font-mono)">
          {t('제출 시 컨센서스 공개', 'Locks -> Unlocks Peers')}
        </text>
      </g>
    </GuideChartFrame>
  );
}

function StepVisualSettle({ t }: { t: (ko: string, en: string) => string }) {
  return (
    <GuideChartFrame
      t={t}
      footerLeft={
        <g>
          <line x1="176" y1="172.5" x2="190" y2="172.5" stroke="var(--op-orange)" strokeWidth="2" strokeDasharray="3 2" />
          <text x="195" y="176" fill="var(--op-orange)" fontSize="10" fontWeight="600" fontFamily="var(--font-mono)">
            {t('내 예측', 'Mine')}
          </text>
          <line x1="244" y1="172.5" x2="258" y2="172.5" stroke="var(--op-bull)" strokeWidth="2.4" />
          <text x="263" y="176" fill="var(--op-bull)" fontSize="10" fontWeight="600" fontFamily="var(--font-mono)">
            {t('실제 종가', 'Actual')}
          </text>
        </g>
      }
    >
      {/* Same User Orange Path (Dashed Reference) */}
      <path
        d="M 132 92 L 190 118 L 268 68 L 352 44"
        stroke="var(--op-orange)"
        strokeWidth="2.2"
        strokeDasharray="4 3"
        strokeOpacity="0.88"
        strokeLinejoin="round"
      />
      <circle cx="352" cy="44" r="4" fill="var(--op-orange)" />

      {/* Realized Actual Close Sweep (Natural Daily Volatility vs Forecast) */}
      <path
        d="M 132 92 L 162 104 L 190 130 L 228 98 L 268 84 L 310 50 L 352 36"
        pathLength={100}
        stroke="var(--op-bull)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="op-anim-stroke"
      />
      <circle cx="352" cy="36" r="5" fill="var(--op-bull)" className="op-anim-dot-3" />

      {/* Score & LP Pill Revealed Above Past Zone */}
      <g className="op-anim-score-card">
        <rect
          x="18"
          y="16"
          width="176"
          height="50"
          rx="2"
          fill="var(--op-canvas)"
          stroke="var(--op-line-strong)"
        />
        <text x="30" y="35" fill="var(--op-ink)" fontSize="13" fontWeight="700" fontFamily="var(--font-mono)">
          88.4{t('점', ' pts')} · <tspan fill="var(--op-bull)">+24 LP</tspan>
        </text>
        <rect x="30" y="46" width="150" height="5.5" rx="1" fill="var(--op-raised)" />
        <rect x="30" y="46" width="122" height="5.5" rx="1" fill="var(--op-bull)" className="op-anim-bar-fill" />
      </g>
    </GuideChartFrame>
  );
}

function GuideModalDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const handleClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const inside =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!inside) {
          dialog.close();
        }
      };
      dialog.addEventListener('click', handleClick);
      return () => dialog.removeEventListener('click', handleClick);
    }
  }, []);

  const handleDismiss = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    } else {
      onClose();
    }
  };

  const steps = [
    {
      num: '01',
      title: t('차트 위에 7일 흐름을 직접 그리세요', 'Sketch your 7-day price path directly on the chart'),
      desc: t(
        '오늘(D-0) 오른쪽 차트를 클릭해 변곡점을 찍고, D+7 만기선까지 선을 이어 완성합니다.',
        'Click right of D-0 to place pivot anchors and connect your trajectory to the D+7 expiry line.'
      ),
      visual: <StepVisualDraw t={t} />,
    },
    {
      num: '02',
      title: t('제출하는 순간, 시장의 시선이 열립니다', 'Lock once to unlock crowd & top-tier views'),
      desc: t(
        '제출 전에는 타인 예측이 가려집니다. 1회 확정 즉시 참여자 평균과 고티어 경로를 비교할 수 있습니다.',
        'Peer forecasts stay hidden beforehand. Submitting one immutable path reveals crowd medians and Top-Tier curves.'
      ),
      visual: <StepVisualUnlock t={t} />,
    },
    {
      num: '03',
      title: t('실제 종가와 비교해 점수와 티어를 올리세요', 'Settle against actual closes for score & Elo'),
      desc: t(
        '7일간 실제 BTC 종가 기준으로 100점 정밀도(경로 50 · 형태 25 · 종가 25)와 코호트 LP가 정산됩니다.',
        'Scored out of 100 (50 path · 25 shape · 25 target) against realized closes for zero-bias cohort LP.'
      ),
      visual: <StepVisualSettle t={t} />,
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <dialog
      ref={dialogRef}
      className="w-[calc(100vw-2rem)] max-w-xl"
      aria-labelledby="guide-modal-title"
      {...({ closedby: 'any' } as any)}
      onClose={onClose}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' && step < steps.length - 1) {
          setStep(s => s + 1);
        } else if (e.key === 'ArrowLeft' && step > 0) {
          setStep(s => s - 1);
        }
      }}
    >
      <div
        className="w-full overflow-hidden rounded-[2px]"
        style={{
          backgroundColor: 'var(--op-canvas)',
          border: '1px solid var(--op-line-strong)',
          boxShadow: 'var(--op-shadow-stack)',
        }}
      >
        {/* Top Stepper Bar */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-4"
          style={{
            backgroundColor: 'var(--op-panel)',
            borderBottom: '1px solid var(--op-line)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="op-mono text-[11.5px] font-semibold" style={{ color: 'var(--op-orange)' }}>
              {current.num} / 0{steps.length}
            </span>
            <div className="flex items-center gap-1.5" role="tablist" aria-label={t('가이드 단계', 'Guide steps')}>
              {steps.map((s, idx) => {
                const active = idx === step;
                return (
                  <button
                    key={s.num}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={t(`${idx + 1}단계`, `Step ${idx + 1}`)}
                    onClick={() => setStep(idx)}
                    className="h-1.5 rounded-full transition-all duration-200 cursor-pointer"
                    style={{
                      width: active ? '22px' : '8px',
                      backgroundColor: active ? 'var(--op-orange)' : 'var(--op-line-strong)',
                    }}
                  />
                );
              })}
            </div>
          </div>

          <button
            type="button"
            autoFocus
            onClick={handleDismiss}
            className="w-8 h-8 flex items-center justify-center rounded-[2px] transition-colors hover:bg-[var(--op-raised)]"
            style={{ color: 'var(--op-ink-3)' }}
            aria-label={t('가이드 닫기', 'Close guide')}
          >
            <X size={15} />
          </button>
        </div>

        {/* Single-Concept Spacious Stage */}
        <div key={step} className="p-6 space-y-5 op-guide-step-enter">
          <div className="space-y-1.5">
            <h2
              id="guide-modal-title"
              className="text-[19px] sm:text-[20px] font-bold tracking-tight leading-snug"
              style={{ color: 'var(--op-ink)' }}
            >
              {current.title}
            </h2>
            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
              {current.desc}
            </p>
          </div>

          {current.visual}
        </div>

        {/* Step Navigation Footer */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-3"
          style={{
            backgroundColor: 'var(--op-panel)',
            borderTop: '1px solid var(--op-line)',
          }}
        >
          <div className="flex items-center gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(s => Math.max(0, s - 1))}
                className="op-btn-ghost h-9 px-3.5 text-[13px]"
              >
                <ArrowLeft size={13} />
                {t('이전', 'Back')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  handleDismiss();
                  navigate('/docs');
                }}
                className="op-mono text-[12px] hover:underline cursor-pointer"
                style={{ color: 'var(--op-ink-3)' }}
              >
                {t('상세 규칙 →', 'Full Docs →')}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (isLast) {
                handleDismiss();
              } else {
                setStep(s => s + 1);
              }
            }}
            className="op-btn-primary h-9 px-5 text-[13px]"
          >
            <span>{isLast ? t('직접 그려보기', 'Start Drawing') : t('다음', 'Next')}</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </dialog>
  );
}
