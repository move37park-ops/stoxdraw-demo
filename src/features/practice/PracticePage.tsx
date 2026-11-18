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
import {
  analyzeAttemptCalibration,
  extractPracticeMetrics,
} from '../../domain/practiceStats';
import { formatPct } from '../../domain/format';
import { localizeDataText, useI18n } from '../../lib/i18nCore';
import type { AnchorPoint, ScoreBreakdown } from '../../domain/types';

const PRACTICE_HORIZON = 7;

export function PracticePage() {
  const { locale, t } = useI18n();
  const [, setMarketTick] = useState(0);
  const [scenario, setScenario] = useState<ReplayScenario>(() => createRandomReplayScenario());
  const [seenRandomDates, setSeenRandomDates] = useState<string[]>([]);
  const [blindEnabled, setBlindEnabled] = useState(true);
  const [anchors, setAnchors] = useState<AnchorPoint[]>([]);
  const [revealedScore, setRevealedScore] = useState<ScoreBreakdown | null>(null);

  const isRevealed = revealedScore !== null;
  const isChartBlind = blindEnabled && !isRevealed;
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
      // Promote untouched initial draw to the 1,000D Binance pool once loaded
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

  const calibration = useMemo(() => {
    if (!isRevealed || predictedPct === null) return null;
    return analyzeAttemptCalibration(
      predictedPct,
      actualEndPct,
      metrics.realizedVol,
      PRACTICE_HORIZON
    );
  }, [isRevealed, predictedPct, actualEndPct, metrics.realizedVol]);

  const diffLabel =
    scenario.difficulty === 'NORMAL'
      ? t('보통', 'NORMAL')
      : scenario.difficulty === 'HARD'
        ? t('어려움', 'HARD')
        : t('전문가', 'EXPERT');

  return (
    <div
      className="px-4 sm:px-6 pt-3 pb-6 space-y-3 op-view-enter"
      style={{ backgroundColor: 'var(--op-canvas)' }}
    >
      {/* Compact Semi-Header Workbench Bar (symmetric with /) */}
      <header
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pb-2.5"
        style={{ borderBottom: '1px solid var(--op-line)' }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
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

            <div className="flex items-baseline gap-2 op-mono">
              <span
                className={
                  isChartBlind
                    ? 'text-[13px] font-semibold'
                    : 'text-[15.5px] font-semibold'
                }
                style={{ color: 'var(--op-ink)' }}
              >
                {isChartBlind
                  ? t('과거 시점 비공개', 'Blind Chart')
                  : `$${scenario.basePrice.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
              </span>
            </div>
          </div>

          <p className="text-[12px] leading-snug" style={{ color: 'var(--op-ink-2)' }}>
            <span className="font-medium" style={{ color: 'var(--op-ink)' }}>
              {t('블라인드 연습', 'Blind Practice')}
            </span>
            <span className="mx-1.5" style={{ color: 'var(--op-ink-3)' }}>·</span>
            {t(
              '과거 차트로 7일 예측을 연습하며 평판 점수(LP)와 무관하게 즉시 평가됩니다.',
              'Practice predicting 7-day paths on hidden historical charts with instant unranked evaluation.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap op-mono text-[11.5px] flex-shrink-0">
          <button
            type="button"
            aria-pressed={blindEnabled}
            onClick={() => setBlindEnabled(b => !b)}
            className="h-7 px-2.5 rounded-[2px] cursor-pointer transition-colors"
            style={{
              backgroundColor: blindEnabled ? 'var(--op-orange-soft)' : 'var(--op-panel)',
              border: blindEnabled
                ? '1px solid var(--op-orange)'
                : '1px solid var(--op-line-strong)',
              color: blindEnabled ? 'var(--op-orange)' : 'var(--op-ink-2)',
            }}
          >
            {blindEnabled
              ? t('블라인드 ON', 'Blind ON')
              : t('블라인드 OFF', 'Blind OFF')}
          </button>

          <button
            type="button"
            onClick={handleDrawRandom}
            className="op-btn-ghost h-7 px-2.5 text-[11.5px]"
          >
            <Shuffle size={12} />
            <span>{t('다른 구간으로 연습', 'Try Another Scenario')}</span>
          </button>
        </div>
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
            showMA20
            showVolume
            headerSubtitle={
              isChartBlind
                ? t('20일 이동평균선(점선) · 거래량 · 변동성 참고', 'MA20 (dashed) · Volume · Volatility cues')
                : localizeDataText(scenario.subtitle, locale)
            }
          />
        </div>

        {/* Right Telemetry / Feedback Panel */}
        <aside
          className="lg:col-span-4 rounded-[2px] p-4 flex flex-col justify-between gap-4"
          style={{
            backgroundColor: 'var(--op-panel)',
            border: '1px solid var(--op-line-strong)',
          }}
        >
          <div className="space-y-3">
            <div>
              <div className="op-mono text-[11px]" style={{ color: 'var(--op-orange)' }}>
                {isRevealed
                  ? `${scenario.code} · ${t('과거 연습', 'PRACTICE')} · ${diffLabel}`
                  : isChartBlind
                    ? t('블라인드 연습', 'BLIND PRACTICE')
                    : `${scenario.code} · ${t('과거 연습', 'PRACTICE')}`}
              </div>
              <h2 className="text-[15px] font-semibold mt-0.5" style={{ color: 'var(--op-ink)' }}>
                {isRevealed
                  ? localizeDataText(scenario.revealTitle, locale)
                  : isChartBlind
                    ? localizeDataText(scenario.blindLabel, locale)
                    : localizeDataText(scenario.title, locale)}
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                {isRevealed
                  ? localizeDataText(scenario.revealTakeaway, locale)
                  : isChartBlind
                    ? t(
                        '과거 시장의 미래를 맞혀보세요. 날짜와 가격을 숨긴 차트에서 20일선, 거래량, ±1σ 변동폭을 참고해 7일 예측 경로를 그려보세요.',
                        'Predict what happened next. Dates and prices are hidden — draw a 7-day forecast path using MA20, volume, and ±1σ volatility.'
                      )
                    : localizeDataText(scenario.marketHint, locale)}
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
                <div className="px-3 py-2 flex items-center justify-between">
                  <span style={{ color: 'var(--op-ink-3)' }}>{t('일간 변동성 (σ)', 'Daily Volatility (σ)')}</span>
                  <span style={{ color: 'var(--op-ink)' }}>{(metrics.realizedVol * 100).toFixed(2)}%</span>
                </div>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span style={{ color: 'var(--op-ink-3)' }}>{t('7일 예상 변동폭 (±1σ)', '7D 1σ Range')}</span>
                  <span style={{ color: 'var(--op-orange)' }}>±{metrics.expected7dBandPct.toFixed(1)}%</span>
                </div>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span style={{ color: 'var(--op-ink-3)' }}>{t('20일 고점 / 저점', '20D High / Low')}</span>
                  <span style={{ color: 'var(--op-ink-2)' }}>
                    +{metrics.range20dHighPct}% / {metrics.range20dLowPct}%
                  </span>
                </div>
                <div className="px-3 py-2 flex items-center justify-between">
                  <span style={{ color: 'var(--op-ink-3)' }}>{t('20일선 이격률', 'vs 20D MA')}</span>
                  <span style={{ color: metrics.ma20DeviationPct >= 0 ? 'var(--op-bull)' : 'var(--op-bear)' }}>
                    {formatPct(metrics.ma20DeviationPct)}
                  </span>
                </div>
                {metrics.volumeRatio !== null && (
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span style={{ color: 'var(--op-ink-3)' }}>{t('최근 3일 거래량 (20일 대비)', '3D Vol vs 20D Avg')}</span>
                    <span style={{ color: metrics.volumeRatio >= 1.3 ? 'var(--op-orange)' : 'var(--op-ink-2)' }}>
                      {metrics.volumeRatio.toFixed(2)}x
                    </span>
                  </div>
                )}
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
                        {t('실제 가격 경로', 'Actual')}:{' '}
                        <strong style={{ color: actualEndPct >= 0 ? 'var(--op-bull)' : 'var(--op-bear)' }}>
                          {formatPct(actualEndPct)}
                        </strong>
                      </div>
                      <div style={{ color: 'var(--op-ink-3)' }}>
                        {t('내 예측 경로', 'Yours')}: {predictedPct !== null ? formatPct(predictedPct) : '-'}
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

                  {calibration && (
                    <div
                      className="px-3 py-2 rounded-[2px] text-[11.5px] space-y-0.5"
                      style={{
                        backgroundColor: 'var(--op-canvas)',
                        border: '1px solid var(--op-line)',
                        color: 'var(--op-ink-2)',
                      }}
                    >
                      <div className="op-mono flex items-center justify-between text-[11px]">
                        <span style={{ color: 'var(--op-ink-3)' }}>
                          {t(`실제 기준일: ${scenario.baseDate}`, `Evaluated: ${scenario.baseDate}`)}
                        </span>
                        <span style={{ color: 'var(--op-ink-2)' }}>
                          {calibration.zMagnitude.toFixed(1)}σ / ±{calibration.expectedBandPct}%
                        </span>
                      </div>
                      <div
                        className="font-medium"
                        style={{
                          color:
                            calibration.bias === 'calibrated'
                              ? 'var(--op-bull)'
                              : 'var(--op-orange)',
                        }}
                      >
                        {calibration.bias === 'overextended'
                          ? t(
                              '변동성 대비 과도한 목표 — ±1σ 범위 안으로 목표 폭 조정 권장',
                              'Overextended vs σ — pull target range closer to 1σ'
                            )
                          : calibration.bias === 'flat'
                            ? t(
                                '추세가 너무 완만함 — 차트 흐름에 맞춘 방향성 반영 권장',
                                'Too flat vs regime σ — express clearer move'
                              )
                            : t(
                                '변동성 ±1σ 범위 안에서 균형 있게 설정된 목표',
                                'Balanced target calibration within regime 1σ'
                              )}
                      </div>
                    </div>
                  )}
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
