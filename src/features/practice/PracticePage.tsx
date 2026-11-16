import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, ArrowRight, Shuffle } from 'lucide-react';
import { PathCanvas } from '../predict/PathCanvas';
import {
  BTC_DAILY_VOLATILITY,
  REPLAY_SCENARIOS,
  createRandomReplayScenario,
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
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [randomScenario, setRandomScenario] = useState<ReplayScenario | null>(null);
  const [seenRandomDates, setSeenRandomDates] = useState<string[]>([]);
  const [blindEnabled, setBlindEnabled] = useState(true);
  const [anchors, setAnchors] = useState<AnchorPoint[]>([]);
  const [revealedScore, setRevealedScore] = useState<ScoreBreakdown | null>(null);

  useEffect(() => {
    syncReplayScenariosFromBinance();
    return subscribeBtcMarket(() => setMarketTick(c => c + 1));
  }, []);

  const scenario = randomScenario ?? REPLAY_SCENARIOS[selectedIdx] ?? REPLAY_SCENARIOS[0];
  const isRevealed = revealedScore !== null;
  const isChartBlind = blindEnabled && !isRevealed;

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

  const handleSelectScenario = (idx: number) => {
    setRandomScenario(null);
    setSelectedIdx(idx);
    setAnchors([]);
    setRevealedScore(null);
  };

  const handleDrawRandom = () => {
    const next = createRandomReplayScenario([scenario.baseDate, ...seenRandomDates]);
    setRandomScenario(next);
    setSeenRandomDates(prev => [next.baseDate, ...prev].slice(0, 12));
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

  const handleRetryOrNext = (next: boolean) => {
    if (next) {
      if (randomScenario) {
        handleDrawRandom();
        return;
      }
      setSelectedIdx(prev => (prev + 1) % REPLAY_SCENARIOS.length);
    }
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
      {/* Compact 1-Line Workbench Bar (symmetric with /) */}
      <header
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pb-2.5"
        style={{ borderBottom: '1px solid var(--op-line)' }}
      >
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
            <span
              className="op-mono text-[10.5px] font-medium px-1.5 py-0.5 rounded-[2px]"
              style={{
                backgroundColor: 'var(--op-panel)',
                border: '1px solid var(--op-line-strong)',
                color: 'var(--op-ink-2)',
              }}
            >
              {t('7D 리플레이', '7D REPLAY')}
            </span>
          </div>

          <div className="flex items-baseline gap-2 op-mono text-[12.5px]">
            <span className="font-semibold" style={{ color: 'var(--op-ink)' }}>
              {isChartBlind
                ? t('가격·시점 비공개', 'Blind Index')
                : `$${scenario.basePrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
            </span>
            <span style={{ color: 'var(--op-ink-3)' }}>
              · {isChartBlind ? (randomScenario ? t('랜덤 구간', 'Random') : `#0${selectedIdx + 1}`) : scenario.code} · σ {(metrics.realizedVol * 100).toFixed(2)}%
            </span>
          </div>
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
            style={{
              borderColor: randomScenario ? 'var(--op-orange)' : 'var(--op-line-strong)',
              color: randomScenario ? 'var(--op-orange)' : 'var(--op-ink)',
            }}
          >
            <Shuffle size={12} />
            <span>{t('랜덤 실전 구간', 'Random Draw')}</span>
          </button>
        </div>
      </header>

      {/* Balanced 6-Regime Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
        {REPLAY_SCENARIOS.map((sc, idx) => {
          const active = !randomScenario && idx === selectedIdx;
          const showActualTabCopy = !blindEnabled || (active && isRevealed);
          const tabDiff =
            sc.difficulty === 'NORMAL'
              ? t('보통', 'NORMAL')
              : sc.difficulty === 'HARD'
                ? t('어려움', 'HARD')
                : t('전문가', 'EXPERT');
          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => handleSelectScenario(idx)}
              className="px-2.5 py-2 rounded-[2px] text-left transition-colors cursor-pointer"
              style={{
                backgroundColor: active ? 'var(--op-panel)' : 'var(--op-canvas)',
                border: active
                  ? '1px solid var(--op-orange)'
                  : '1px solid var(--op-line-strong)',
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className="op-mono text-[10.5px] font-bold"
                  style={{ color: active ? 'var(--op-orange)' : 'var(--op-ink-3)' }}
                >
                  {showActualTabCopy ? sc.code : `#0${idx + 1}`}
                </span>
                <span className="op-mono text-[10px]" style={{ color: 'var(--op-ink-3)' }}>
                  {tabDiff}
                </span>
              </div>
              <div
                className="mt-0.5 text-[12px] font-semibold line-clamp-1"
                style={{ color: 'var(--op-ink)' }}
              >
                {showActualTabCopy
                  ? localizeDataText(sc.title, locale)
                  : localizeDataText(sc.blindLabel, locale)}
              </div>
            </button>
          );
        })}
      </div>

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
                ? t('20일선(점선) · 거래량 · 변동성 구조 기반 작도', 'MA20 (dashed) · Volume · Blind structure')
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
                {randomScenario
                  ? isRevealed
                    ? `${scenario.code} · ${t('랜덤 실전', 'RANDOM')} · ${diffLabel}`
                    : `${t('랜덤 블라인드', 'RANDOM BLIND')} · ${diffLabel}`
                  : isChartBlind
                    ? `#0${selectedIdx + 1} · ${diffLabel}`
                    : `${scenario.code} · ${diffLabel}`}
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
                        '날짜·가격대 비공개 상태입니다. 20일 이동평균선, 거래량, ±1σ 진폭을 보고 7일 궤적을 그려보세요.',
                        'Dates and price levels are hidden. Draw a 7D path using MA20, volume, and the ±1σ volatility band.'
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
                  <span style={{ color: 'var(--op-ink-3)' }}>{t('7일 기대 진폭 (±1σ)', '7D 1σ Range')}</span>
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
                    <span style={{ color: 'var(--op-ink-3)' }}>{t('최근 3일 거래량 배수', '3D Vol vs 20D Avg')}</span>
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
                        {t('실전 100점 정밀도', '7D Accuracy Score')}
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
                        {t('실제 7일', 'Actual')}:{' '}
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
                        {t('형태 /25', 'Shape /25')}
                      </div>
                      <div className="text-[13px] font-bold mt-0.5" style={{ color: 'var(--op-ink)' }}>
                        {revealedScore.directionScore}
                      </div>
                    </div>
                    <div className="p-2">
                      <div className="text-[10.5px]" style={{ color: 'var(--op-ink-3)' }}>
                        {t('종가 /25', 'Target /25')}
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
                          {t(`실측 정체: ${scenario.baseDate}`, `Revealed: ${scenario.baseDate}`)}
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
                              '변동성 대비 과대 목표 — 1σ 안팎 진폭 조율 필요',
                              'Overextended vs σ — pull target amplitude closer to 1σ'
                            )
                          : calibration.bias === 'flat'
                            ? t(
                                '과도한 수평 작도 — 구조적 방향 탄력 반영 필요',
                                'Too flat vs regime σ — express clearer move'
                              )
                            : t(
                                '변동성 1σ 범위 내 균형 잡힌 진폭 설정',
                                'Balanced target calibration within regime 1σ'
                              )}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--op-line)' }}>
            {!isRevealed ? (
              <button
                type="button"
                disabled={!pathCompleted}
                onClick={handleRevealOutcome}
                className="op-btn-primary w-full h-10 text-[13px]"
              >
                {!pathCompleted
                  ? t(`차트에 ${PRACTICE_HORIZON}일 경로를 완성하세요`, `Complete ${PRACTICE_HORIZON}D path to score`)
                  : t('제출하고 실제 7일 결과 보기', 'Lock & Reveal Actual 7D')}
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleRetryOrNext(false)}
                  className="op-btn-ghost h-9 text-[12px]"
                >
                  <RotateCcw size={13} />
                  {t('다시 그리기', 'Retry')}
                </button>
                <button
                  type="button"
                  onClick={() => handleRetryOrNext(true)}
                  className="op-btn-primary h-9 text-[12px]"
                >
                  <span>
                    {randomScenario ? t('다음 랜덤', 'Next Random') : t('다음 구간', 'Next Case')}
                  </span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}

            <Link
              to="/"
              className="block text-center op-mono text-[11px] pt-0.5 transition-opacity hover:opacity-80"
              style={{ color: 'var(--op-ink-3)' }}
            >
              {t('실전 오늘의 7일 예측 참여하기 →', 'Go to Live 7D Forecast →')}
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
