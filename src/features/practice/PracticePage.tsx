import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, ArrowRight, Shuffle } from 'lucide-react';
import { PathCanvas } from '../predict/PathCanvas';
import {
  BTC_DAILY_VOLATILITY,
  createRandomReplayScenario,
  hasRealArchivePool,
  subscribeBtcMarket,
  syncReplayScenariosFromBinance,
  type ReplayScenario,
} from '../../data/btcMarket';
import {
  buildInterpolatedTrajectory,
  isPathComplete,
} from '../../domain/interpolation';
import { calculateForecastScore } from '../../domain/scoring';
import { extractPracticeMetrics } from '../../domain/practiceStats';
import { formatPct } from '../../domain/format';
import { localizeDataText, useI18n } from '../../lib/i18nCore';
import type { AnchorPoint, ScoreBreakdown } from '../../domain/types';

const PRACTICE_HORIZON = 7;

export function PracticePage() {
  const { locale, t } = useI18n();
  const [, setMarketTick] = useState(0);
  const [scenario, setScenario] = useState<ReplayScenario>(() => createRandomReplayScenario());
  const [seenRandomDates, setSeenRandomDates] = useState<string[]>([]);
  const [anchors, setAnchors] = useState<AnchorPoint[]>([]);
  const [revealedScore, setRevealedScore] = useState<ScoreBreakdown | null>(null);

  const isRevealed = revealedScore !== null;
  const isChartBlind = !isRevealed;
  const canUpgradeIdleRef = useRef(true);
  const upgradedArchiveRef = useRef(false);

  useEffect(() => {
    if (anchors.length > 0 || isRevealed) {
      canUpgradeIdleRef.current = false;
    }
  }, [anchors.length, isRevealed]);

  useEffect(() => {
    if (hasRealArchivePool()) {
      upgradedArchiveRef.current = true;
    }
    syncReplayScenariosFromBinance();
    return subscribeBtcMarket(() => {
      if (!upgradedArchiveRef.current && hasRealArchivePool()) {
        upgradedArchiveRef.current = true;
        if (canUpgradeIdleRef.current) {
          const upgraded = createRandomReplayScenario();
          setScenario(upgraded);
          setSeenRandomDates([upgraded.baseDate]);
          return;
        }
      }
      setMarketTick(c => c + 1);
    });
  }, []);

  const evalDates = useMemo(
    () => scenario.evalDates.slice(0, PRACTICE_HORIZON),
    [scenario.evalDates]
  );
  const actualFuture7d = useMemo(
    () => scenario.futureBars.slice(0, PRACTICE_HORIZON),
    [scenario.futureBars]
  );

  const pathCompleted = useMemo(
    () => isPathComplete(anchors, PRACTICE_HORIZON),
    [anchors]
  );

  const interpolated = useMemo(
    () =>
      pathCompleted
        ? buildInterpolatedTrajectory(scenario.basePrice, evalDates, anchors)
        : { prices: [], path: [], pathPct: [] },
    [pathCompleted, scenario.basePrice, evalDates, anchors]
  );

  const metrics = useMemo(
    () => extractPracticeMetrics(scenario.historyBars, BTC_DAILY_VOLATILITY),
    [scenario.historyBars]
  );

  const handleDrawRandom = () => {
    upgradedArchiveRef.current = hasRealArchivePool();
    canUpgradeIdleRef.current = true;
    const next = createRandomReplayScenario([scenario.baseDate, ...seenRandomDates]);
    setScenario(next);
    setSeenRandomDates(prev => [scenario.baseDate, ...prev].slice(0, 12));
    setAnchors([]);
    setRevealedScore(null);
  };

  const handleRevealOutcome = () => {
    if (!pathCompleted || interpolated.prices.length === 0 || isRevealed) return;
    const actualCloses = actualFuture7d.map(b => b.close);
    const score = calculateForecastScore(
      interpolated.prices,
      actualCloses,
      scenario.basePrice,
      metrics.realizedVol
    );
    setRevealedScore(score);
  };

  const handleRetrySame = () => {
    setAnchors([]);
    setRevealedScore(null);
  };

  const predictedTarget =
    interpolated.prices.length > 0
      ? interpolated.prices[interpolated.prices.length - 1]
      : null;
  const predictedPct =
    predictedTarget !== null && scenario.basePrice > 0
      ? ((predictedTarget - scenario.basePrice) / scenario.basePrice) * 100
      : null;

  const actualEndPrice = actualFuture7d[actualFuture7d.length - 1]?.close ?? scenario.basePrice;
  const actualEndPct =
    scenario.basePrice > 0
      ? ((actualEndPrice - scenario.basePrice) / scenario.basePrice) * 100
      : 0;

  return (
    <div
      className="px-4 sm:px-6 pt-3 pb-6 space-y-3 op-view-enter"
      style={{ backgroundColor: 'var(--op-canvas)' }}
    >
      {/* Single Compact Header Bar */}
      <header
        className="flex flex-wrap items-center justify-between gap-3 pb-3"
        style={{ borderBottom: '1px solid var(--op-line)' }}
      >
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2">
            <img
              src="/btc-logo.png"
              alt=""
              width={20}
              height={20}
              className="w-5 h-5 rounded-full flex-shrink-0 object-contain"
              aria-hidden="true"
            />
            <h1
              className="text-[15.5px] font-semibold tracking-tight"
              style={{ color: 'var(--op-ink)' }}
            >
              BTC/USDT
            </h1>
          </div>

          <span
            className="op-mono text-[13.5px] font-semibold"
            style={{ color: isChartBlind ? 'var(--op-orange)' : 'var(--op-ink)' }}
          >
            {isChartBlind
              ? t('블라인드 연습', 'Blind Practice')
              : `$${scenario.basePrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
          </span>
        </div>

        <button
          type="button"
          onClick={handleDrawRandom}
          className="op-btn-ghost h-7 px-2.5 text-[11.5px] op-mono"
        >
          <Shuffle size={12} />
          <span>{t('다른 구간으로 연습', 'New Scenario')}</span>
        </button>
      </header>

      {/* Main 8 + 4 Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div
          className="lg:col-span-8 rounded-[2px] overflow-hidden flex flex-col"
          style={{
            backgroundColor: 'var(--op-canvas)',
            border: '1px solid var(--op-line-strong)',
          }}
        >
          <PathCanvas
            mode="practice"
            ticker="BTC/USDT"
            hideAssetBadge={true}
            baseDate={scenario.baseDate}
            basePrice={scenario.basePrice}
            evalDates={evalDates}
            historyBars={scenario.historyBars}
            actualFutureBars={isRevealed ? actualFuture7d : []}
            scaleFutureBars={isRevealed ? actualFuture7d : undefined}
            anchors={anchors}
            onChangeAnchors={setAnchors}
            readOnly={isRevealed}
            blindMode={isChartBlind}
            showMA20={false}
            showVolume={false}
            headerSubtitle={
              isChartBlind
                ? t('과거 차트 블라인드 연습 · 날짜·가격 비공개', 'Blind Historical Practice')
                : localizeDataText(scenario.subtitle, locale)
            }
          />
        </div>

        {/* Right Context Panel */}
        <aside
          className="lg:col-span-4 rounded-[2px] p-4 flex flex-col justify-between gap-4"
          style={{
            backgroundColor: 'var(--op-panel)',
            border: '1px solid var(--op-line-strong)',
          }}
        >
          <div className="space-y-3.5">
            <div>
              <div className="op-mono text-[10.5px] font-semibold" style={{ color: 'var(--op-orange)' }}>
                {isRevealed
                  ? `${scenario.baseDate} · ${t('결과 확인', 'EVALUATED')}`
                  : t('BLIND PRACTICE', 'BLIND PRACTICE')}
              </div>
              <h2 className="text-[15.5px] font-semibold mt-0.5" style={{ color: 'var(--op-ink)' }}>
                {isRevealed
                  ? localizeDataText(scenario.revealTitle, locale)
                  : localizeDataText(scenario.blindLabel, locale)}
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                {isRevealed
                  ? localizeDataText(scenario.revealTakeaway, locale)
                  : t(
                      '날짜와 가격을 가린 과거 구간입니다. 7일 예측 경로를 그려 즉시 실력을 테스트하세요.',
                      'Dates and prices are hidden. Draw your 7-day forecast path to score immediately.'
                    )}
              </p>
            </div>

            {!isRevealed ? (
              <div
                className="rounded-[2px] divide-y divide-[var(--op-line)] text-[12px] op-mono"
                style={{
                  backgroundColor: 'var(--op-canvas)',
                  border: '1px solid var(--op-line-strong)',
                }}
              >
                <div className="px-3 py-2.5 flex items-center justify-between">
                  <span style={{ color: 'var(--op-ink-3)' }}>{t('과거 20일 고점 / 저점', '20D High / Low')}</span>
                  <span style={{ color: 'var(--op-ink)' }}>
                    +{metrics.range20dHighPct}% / {metrics.range20dLowPct}%
                  </span>
                </div>
                <div className="px-3 py-2.5 flex items-center justify-between">
                  <span style={{ color: 'var(--op-ink-3)' }}>{t('7일 예상 변동폭 (±1σ)', '7D 1σ Range')}</span>
                  <span style={{ color: 'var(--op-orange)' }}>±{metrics.expected7dBandPct.toFixed(1)}%</span>
                </div>
              </div>
            ) : (
              revealedScore && (
                <div className="space-y-2.5">
                  <div
                    className="p-3 rounded-[2px] flex items-center justify-between"
                    style={{
                      backgroundColor: 'var(--op-canvas)',
                      border: '1px solid var(--op-orange)',
                    }}
                  >
                    <div>
                      <div className="text-[11px]" style={{ color: 'var(--op-ink-3)' }}>
                        {t('7일 예측 점수', 'Forecast Score')}
                      </div>
                      <div className="op-mono text-[22px] font-bold" style={{ color: 'var(--op-ink)' }}>
                        {t(`${revealedScore.total.toFixed(1)}점`, `${revealedScore.total.toFixed(1)} pts`)}{' '}
                        <span className="text-[14px]" style={{ color: 'var(--op-orange)' }}>
                          ({t(`${revealedScore.grade}등급`, `Grade ${revealedScore.grade}`)})
                        </span>
                      </div>
                    </div>
                    <div className="text-right op-mono text-[11.5px]">
                      <div style={{ color: 'var(--op-ink-2)' }}>
                        {t('실제', 'Actual')}:{' '}
                        <strong style={{ color: actualEndPct >= 0 ? 'var(--op-bull)' : 'var(--op-bear)' }}>
                          {formatPct(actualEndPct)}
                        </strong>
                      </div>
                      <div style={{ color: 'var(--op-ink-3)' }}>
                        {t('내 예측', 'Yours')}: {predictedPct !== null ? formatPct(predictedPct) : '-'}
                      </div>
                    </div>
                  </div>

                  <div
                    className="grid grid-cols-3 divide-x divide-[var(--op-line)] rounded-[2px] text-center op-mono"
                    style={{
                      backgroundColor: 'var(--op-canvas)',
                      border: '1px solid var(--op-line-strong)',
                    }}
                  >
                    <div className="p-2">
                      <div className="text-[10.5px]" style={{ color: 'var(--op-ink-3)' }}>
                        {t('경로 /50', 'Path /50')}
                      </div>
                      <div className="text-[13px] font-bold mt-0.5" style={{ color: 'var(--op-ink)' }}>
                        {revealedScore.pathScore}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-[10.5px]" style={{ color: 'var(--op-ink-3)' }}>
                        {t('흐름 /25', 'Shape /25')}
                      </div>
                      <div className="text-[13px] font-bold mt-0.5" style={{ color: 'var(--op-ink)' }}>
                        {revealedScore.directionScore}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-[10.5px]" style={{ color: 'var(--op-ink-3)' }}>
                        {t('가격·방향 /25', 'Price·Dir /25')}
                      </div>
                      <div className="text-[13px] font-bold mt-0.5" style={{ color: 'var(--op-ink)' }}>
                        {revealedScore.targetScore}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="pt-2" style={{ borderTop: '1px solid var(--op-line)' }}>
            {!isRevealed ? (
              <button
                type="button"
                disabled={!pathCompleted}
                onClick={handleRevealOutcome}
                className="op-btn-primary w-full h-10 text-[13px]"
              >
                {!pathCompleted
                  ? t(`차트에 ${PRACTICE_HORIZON}일 예측 경로를 완성하세요`, `Complete ${PRACTICE_HORIZON}-day path to evaluate`)
                  : t('제출하고 실제 가격 확인하기', 'Submit & Evaluate Path')}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handleRetrySame}
                  className="op-btn-ghost h-9 text-[12px]"
                >
                  <RotateCcw size={13} />
                  {t('다시 예측하기', 'Retry')}
                </button>
                <button
                  type="button"
                  onClick={handleDrawRandom}
                  className="op-btn-primary h-9 text-[12px]"
                >
                  <span>{t('다음 연습', 'Next Practice')}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
