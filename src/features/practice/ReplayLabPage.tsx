import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Polyline20DCanvas } from '../studio/Polyline20DCanvas';
import {
  BTC_TICKER,
  BTC_DAILY_VOLATILITY,
  REPLAY_SCENARIOS,
  syncReplayScenariosFromBinance,
  subscribeBtcMarket,
} from '../../data/btcMarket';
import { buildInterpolatedTrajectory } from '../../domain/interpolation';
import { calculateForecastScore } from '../../domain/scoring';
import { repository } from '../../data/localRepository';
import { formatPct } from '../../domain/format';
import type { AnchorPoint, PracticeAttempt, ScoreBreakdown } from '../../domain/types';

const SCENARIO_SHORT_TITLES: Record<string, string> = {
  replay_2024_etf_breakout: 'ETF 수렴 구간',
  replay_2024_halving_whipsaw: '제4차 반감기',
  replay_2024_yen_carry_crash: '8월 급락 직후',
  replay_2024_nov_ath_breakout: '장기 상단 저항',
};

function buildNeutralAnchors(basePrice: number): AnchorPoint[] {
  return [{ day: 20, price: basePrice }];
}

function buildDiagnosticMessage(
  score: ScoreBreakdown,
  userChangePct: number,
  actualChangePct: number
): string {
  if (!score.directionHit) {
    return `최종 20일 방향성(내 예측 ${formatPct(userChangePct)} vs 실제 ${formatPct(actualChangePct)})이 반대로 엇갈려 방향 점수(30점 만점)와 목표가 점수에서 큰 감점이 발생했습니다.`;
  }
  const pathRatio = score.pathScore / 50;
  const targetRatio = score.targetScore / 20;
  if (pathRatio >= 0.78 && targetRatio >= 0.75) {
    return '초·중반 변곡점 궤적과 D+20 최종 목표가 모두 실제 일봉 흐름을 정교하게 포착했습니다.';
  }
  if (pathRatio < targetRatio) {
    return '최종 방향과 목표가는 근접했으나, D+5~D+14 중반 구간의 눌림·돌파 변곡점 궤적에서 오차가 발생해 경로 점수(50점 만점)가 감점되었습니다.';
  }
  return '중반까지의 추세 흐름은 잘 따라갔으나, 후반부 변동폭(D+20 최종 종가) 추정에서 오차가 발생해 목표 점수가 감점되었습니다.';
}

export function ReplayLabPage() {
  const navigate = useNavigate();

  const [, setMarketTick] = useState(0);
  const [scenarioIdx, setScenarioIdx] = useState<number>(0);
  const scenario = REPLAY_SCENARIOS[scenarioIdx] || REPLAY_SCENARIOS[0];

  const [anchors, setAnchors] = useState<AnchorPoint[]>(() =>
    buildNeutralAnchors(scenario.basePrice)
  );
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>(() =>
    repository.listPracticeAttempts()
  );

  // 실제 과거 Binance 1D 일봉(180일 과거 + 20일 미래) 동기화
  useEffect(() => {
    syncReplayScenariosFromBinance();
    const unsub = subscribeBtcMarket(() => {
      setMarketTick(t => t + 1);
    });
    return () => unsub();
  }, []);

  // 정답 공개 시 D+1 ~ D+20 일봉 캔들이 순차적으로 나타나는 리플레이 애니메이션 (65ms 간격)
  useEffect(() => {
    if (!isRevealed) {
      setRevealedCount(0);
      return;
    }
    const totalDays = scenario.futureBars.length || 20;
    if (revealedCount >= totalDays) return;

    const timer = window.setTimeout(() => {
      setRevealedCount(prev => Math.min(totalDays, prev + 1));
    }, 65);

    return () => window.clearTimeout(timer);
  }, [isRevealed, revealedCount, scenario.futureBars.length]);

  const handleSelectScenario = (idx: number) => {
    const nextScenario = REPLAY_SCENARIOS[idx] || REPLAY_SCENARIOS[0];
    setScenarioIdx(idx);
    setIsRevealed(false);
    setRevealedCount(0);
    setAnchors(buildNeutralAnchors(nextScenario.basePrice));
  };

  const interpolated = useMemo(
    () =>
      buildInterpolatedTrajectory(
        scenario.basePrice,
        scenario.evalDates,
        anchors
      ),
    [scenario.basePrice, scenario.evalDates, anchors]
  );

  const actualCloses = useMemo(
    () => scenario.futureBars.map(b => b.close),
    [scenario.futureBars]
  );

  const visibleFutureBars = useMemo(
    () => (isRevealed ? scenario.futureBars.slice(0, revealedCount) : []),
    [isRevealed, scenario.futureBars, revealedCount]
  );

  const visibleActualCloses = useMemo(
    () => visibleFutureBars.map(b => b.close),
    [visibleFutureBars]
  );

  // 전체 20일 최종 점수 (저장용)
  const finalScoreResult = useMemo(() => {
    return calculateForecastScore(
      interpolated.prices,
      actualCloses,
      scenario.basePrice,
      BTC_DAILY_VOLATILITY
    );
  }, [interpolated.prices, actualCloses, scenario.basePrice]);

  // 애니메이션 진행 중 실시간 점수
  const liveScoreResult = useMemo(() => {
    if (visibleActualCloses.length === 0) return finalScoreResult;
    return calculateForecastScore(
      interpolated.prices,
      visibleActualCloses,
      scenario.basePrice,
      BTC_DAILY_VOLATILITY
    );
  }, [interpolated.prices, visibleActualCloses, scenario.basePrice, finalScoreResult]);

  const handleRevealAndGrade = () => {
    if (isRevealed) return;
    setIsRevealed(true);
    setRevealedCount(1);
    repository.savePracticeAttempt({
      scenarioId: scenario.id,
      scenarioTitle: `${scenario.code} · ${scenario.title}`,
      basePrice: scenario.basePrice,
      anchors,
      forecastPrices: interpolated.prices,
      actualPrices: actualCloses,
      score: finalScoreResult,
    });
    setAttempts(repository.listPracticeAttempts());
  };

  const handleReplayAnimation = () => {
    setRevealedCount(1);
  };

  const handleRetryCurrent = () => {
    setIsRevealed(false);
    setRevealedCount(0);
    setAnchors(buildNeutralAnchors(scenario.basePrice));
  };

  const handleNextScenario = () => {
    const nextIdx = (scenarioIdx + 1) % REPLAY_SCENARIOS.length;
    handleSelectScenario(nextIdx);
  };

  const userEndPrice =
    interpolated.prices[interpolated.prices.length - 1] ?? scenario.basePrice;
  const userChangePct =
    scenario.basePrice > 0
      ? ((userEndPrice - scenario.basePrice) / scenario.basePrice) * 100
      : 0;

  const finalActualEndPrice =
    actualCloses[actualCloses.length - 1] ?? scenario.basePrice;
  const finalActualChangePct =
    scenario.basePrice > 0
      ? ((finalActualEndPrice - scenario.basePrice) / scenario.basePrice) * 100
      : 0;

  const activeActualEndPrice =
    visibleActualCloses.length > 0
      ? visibleActualCloses[visibleActualCloses.length - 1]
      : finalActualEndPrice;
  const activeActualChangePct =
    scenario.basePrice > 0
      ? ((activeActualEndPrice - scenario.basePrice) / scenario.basePrice) * 100
      : 0;

  const isAnimating = isRevealed && revealedCount < scenario.futureBars.length;

  // D+5, D+10, D+20 구간별 오차 복기 행
  const checkpointRows = useMemo(() => {
    const days = [
      { day: 5, label: 'D+5 (초반)' },
      { day: 10, label: 'D+10 (중반)' },
      { day: 20, label: 'D+20 (최종)' },
    ];
    return days.map(({ day, label }) => {
      const idx = day - 1;
      const pred = interpolated.prices[idx] ?? scenario.basePrice;
      const actual =
        revealedCount >= day ? (actualCloses[idx] ?? null) : null;
      const predPct =
        scenario.basePrice > 0
          ? ((pred - scenario.basePrice) / scenario.basePrice) * 100
          : 0;
      const actualPct =
        actual !== null && scenario.basePrice > 0
          ? ((actual - scenario.basePrice) / scenario.basePrice) * 100
          : null;
      const errPct =
        actual !== null && actual > 0
          ? Math.abs(((pred - actual) / actual) * 100)
          : null;
      return {
        day,
        label,
        pred,
        predPct,
        actual,
        actualPct,
        errPct,
      };
    });
  }, [interpolated.prices, actualCloses, revealedCount, scenario.basePrice]);

  const bestByScenario = useMemo(() => {
    const map: Record<string, { score: number; grade: string }> = {};
    for (const att of attempts) {
      const prev = map[att.scenarioId];
      if (!prev || att.score.total > prev.score) {
        map[att.scenarioId] = {
          score: att.score.total,
          grade: att.score.grade,
        };
      }
    }
    return map;
  }, [attempts]);

  const practiceStats = useMemo(() => {
    const clearedCount = Object.keys(bestByScenario).length;
    if (attempts.length === 0) {
      return {
        count: 0,
        avgScore: 0,
        bestScore: 0,
        clearedCount: 0,
      };
    }
    const total = attempts.reduce((acc, a) => acc + a.score.total, 0);
    const best = Math.max(...attempts.map(a => a.score.total));
    return {
      count: attempts.length,
      avgScore: parseFloat((total / attempts.length).toFixed(1)),
      bestScore: best,
      clearedCount,
    };
  }, [attempts, bestByScenario]);

  const gradeAccentColor = (grade: string) => {
    if (grade === 'S' || grade === 'A') return 'var(--v-bull)';
    if (grade === 'B') return 'var(--v-link)';
    if (grade === 'C') return 'var(--v-warning)';
    return 'var(--v-mute)';
  };

  return (
    <div className="w-full relative">
      <span className="v-crosshair -top-[5px] -left-[6px]" aria-hidden="true" />
      <span className="v-crosshair -top-[5px] -right-[6px]" aria-hidden="true" />

      {/* ZONE 1: Compact Practice Header + Segmented Scenario Selector */}
      <section
        className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3"
        style={{
          backgroundColor: 'var(--v-canvas-soft)',
          borderBottom: '1px solid var(--v-hairline)',
        }}
      >
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="v-heading-16 font-bold" style={{ color: 'var(--v-ink)' }}>
              연습 모드
            </h1>
            <span className="v-caption hidden sm:inline" style={{ color: 'var(--v-mute)' }}>
              과거 변곡점 블라인드 학습
            </span>
          </div>

          <div
            className="flex items-center gap-1 p-1 rounded-[6px] overflow-x-auto no-scrollbar"
            style={{
              backgroundColor: 'var(--v-canvas-soft-2)',
              boxShadow: 'var(--v-shadow-border)',
            }}
            role="tablist"
            aria-label="과거 장세 시나리오 선택"
          >
            {REPLAY_SCENARIOS.map((sc, idx) => {
              const active = idx === scenarioIdx;
              const stageBest = bestByScenario[sc.id];
              const shortLabel = SCENARIO_SHORT_TITLES[sc.id] || sc.code;
              return (
                <button
                  key={sc.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelectScenario(idx)}
                  className="px-2.5 py-1 rounded-[4px] text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap"
                  style={{
                    backgroundColor: active
                      ? 'var(--v-primary)'
                      : 'transparent',
                    color: active ? 'var(--v-on-primary)' : 'var(--v-mute)',
                  }}
                >
                  <span className="v-mono font-semibold">{sc.code}</span>
                  <span className="text-[11px]">{shortLabel}</span>
                  {stageBest && (
                    <span
                      className="v-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: active
                          ? 'rgba(0,0,0,0.14)'
                          : 'var(--v-canvas)',
                        color: active
                          ? 'var(--v-on-primary)'
                          : gradeAccentColor(stageBest.grade),
                      }}
                    >
                      {stageBest.score}점
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden md:flex items-center gap-3 v-caption text-xs" style={{ color: 'var(--v-mute)' }}>
            <span>
              완료 <strong className="v-mono" style={{ color: 'var(--v-ink)' }}>{practiceStats.clearedCount}/{REPLAY_SCENARIOS.length}</strong>
            </span>
            <span>·</span>
            <span>
              평균 <strong className="v-mono" style={{ color: 'var(--v-ink)' }}>{practiceStats.avgScore}점</strong>
            </span>
            <span>·</span>
            <span>
              최고 <strong className="v-mono" style={{ color: 'var(--v-bull)' }}>{practiceStats.bestScore}점</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="v-btn-secondary h-7 px-2.5 text-xs font-semibold"
          >
            실전 모드 <ArrowRight size={12} />
          </button>
        </div>
      </section>

      {/* ZONE 2: Main Blind Quiz Canvas + Structured Learning & Diagnostic Console */}
      <section
        className="relative grid grid-cols-1 lg:grid-cols-12"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        {/* Left 8 Cols: Blind Quiz Polyline Canvas */}
        <div
          className="lg:col-span-8 min-w-0"
          style={{ borderRight: '1px solid var(--v-hairline)' }}
        >
          <Polyline20DCanvas
            mode="practice"
            ticker={`${BTC_TICKER} (${scenario.code})`}
            baseDate={scenario.baseDate}
            basePrice={scenario.basePrice}
            evalDates={scenario.evalDates}
            historyBars={scenario.historyBars}
            actualFutureBars={visibleFutureBars}
            scaleFutureBars={isRevealed ? scenario.futureBars : undefined}
            anchors={anchors}
            onChangeAnchors={setAnchors}
            readOnly={isRevealed}
            isConsensusUnlocked={false}
          />
        </div>

        {/* Right 4 Cols: Learning Briefing (Pre-Reveal) & Post-Mortem Audit (Revealed) */}
        <div className="lg:col-span-4 flex flex-col justify-between min-w-0">
          <div className="divide-y divide-[var(--v-hairline)]">
            {/* Cell 1: Scenario Context Briefing */}
            <div className="p-4 sm:p-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="v-caption-mono text-xs font-semibold"
                  style={{ color: 'var(--v-mute)' }}
                >
                  {scenario.code} · 기준일 {scenario.baseDate}
                </span>
                <span
                  className="v-mono text-xs font-semibold"
                  style={{ color: 'var(--v-ink)' }}
                >
                  기준가 ${scenario.basePrice.toLocaleString('en-US')}
                </span>
              </div>

              <h2
                className="v-heading-16 font-bold"
                style={{ color: 'var(--v-ink)' }}
              >
                {isRevealed ? scenario.revealTitle : scenario.title}
              </h2>

              <p className="v-caption leading-relaxed" style={{ color: 'var(--v-body)' }}>
                {scenario.marketHint}
              </p>
            </div>

            {!isRevealed ? (
              <>
                {/* Cell 2 (Pre-Reveal): 3 Structured Market Cues for Chart Reading */}
                <div className="p-4 sm:p-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="v-caption font-semibold"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      당시 차트 판독 단서
                    </span>
                    <span className="v-caption text-[11px]" style={{ color: 'var(--v-mute)' }}>
                      과거 180일 일봉 기준
                    </span>
                  </div>

                  <div className="space-y-2">
                    {scenario.contextCues.map(cue => (
                      <div
                        key={cue.label}
                        className="p-2.5 rounded-[5px] flex flex-col gap-0.5"
                        style={{
                          backgroundColor: 'var(--v-canvas-soft)',
                          boxShadow: 'var(--v-shadow-border)',
                        }}
                      >
                        <span
                          className="v-caption text-[11px] font-semibold"
                          style={{ color: 'var(--v-mute)' }}
                        >
                          {cue.label}
                        </span>
                        <span
                          className="v-caption text-xs"
                          style={{ color: 'var(--v-ink)' }}
                        >
                          {cue.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cell 3 (Pre-Reveal): Current User Draft & 100pt Rubric Guide */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                        내 D+20 목표가
                      </p>
                      <p
                        className="v-mono text-lg font-bold mt-0.5"
                        style={{
                          color:
                            userChangePct > 0
                              ? 'var(--v-bull)'
                              : userChangePct < 0
                              ? 'var(--v-bear)'
                              : 'var(--v-ink)',
                        }}
                      >
                        ${Math.round(userEndPrice).toLocaleString('en-US')} (
                        {formatPct(userChangePct)})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                        작도 변곡점
                      </p>
                      <p
                        className="v-mono text-xs font-semibold mt-0.5"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        {anchors.length} / 4개
                      </p>
                    </div>
                  </div>

                  <div
                    className="p-3 rounded-[5px] space-y-1.5"
                    style={{
                      backgroundColor: 'var(--v-canvas-soft)',
                      boxShadow: 'var(--v-shadow-border)',
                    }}
                  >
                    <p
                      className="v-caption text-[11px] font-semibold"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      100점 정량 채점 기준
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-0.5 v-caption text-[11px]" style={{ color: 'var(--v-mute)' }}>
                      <div>
                        <span className="block font-semibold" style={{ color: 'var(--v-ink)' }}>경로 50점</span>
                        <span>20일 일별 오차</span>
                      </div>
                      <div>
                        <span className="block font-semibold" style={{ color: 'var(--v-ink)' }}>방향 30점</span>
                        <span>추세·등락 일치</span>
                      </div>
                      <div>
                        <span className="block font-semibold" style={{ color: 'var(--v-ink)' }}>목표 20점</span>
                        <span>D+20 종가 정확도</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRevealAndGrade}
                    className="w-full v-btn-primary h-9 text-xs font-semibold"
                  >
                    <Play size={13} />
                    20일 실제 차트 재생 및 채점
                  </button>
                </div>
              </>
            ) : (
              /* Revealed State: 100pt Scorecard + Checkpoint Audit Table + Diagnosis */
              <div className="divide-y divide-[var(--v-hairline)]">
                <div
                  className="p-4 sm:p-5 space-y-3"
                  style={{ backgroundColor: 'var(--v-canvas-soft-2)' }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-1.5 v-caption font-semibold"
                      style={{ color: 'var(--v-bull)' }}
                    >
                      <CheckCircle2 size={13} />
                      {isAnimating
                        ? `실제 일봉 재생 중 (D+${revealedCount}/20)`
                        : '20일 정산 및 채점 완료'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {!isAnimating && (
                        <button
                          type="button"
                          onClick={handleReplayAnimation}
                          className="v-btn-secondary h-6 px-2 text-[11px]"
                          title="20일 캔들 애니메이션 다시 재생"
                        >
                          <Play size={10} />
                          다시 재생
                        </button>
                      )}
                      <span
                        className="v-caption-mono px-2 py-0.5 rounded-[4px] font-bold"
                        style={{
                          backgroundColor: 'var(--v-canvas)',
                          color: gradeAccentColor(liveScoreResult.grade),
                          boxShadow: 'var(--v-shadow-border)',
                        }}
                      >
                        등급 {liveScoreResult.grade}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                        종합 정확도 점수
                      </p>
                      <p
                        className="v-mono text-2xl font-bold"
                        style={{ color: 'var(--v-ink)' }}
                      >
                        {liveScoreResult.total}{' '}
                        <span
                          className="text-xs font-normal"
                          style={{ color: 'var(--v-mute)' }}
                        >
                          / 100
                        </span>
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                        실제 D+{revealedCount || 20} 종가
                      </p>
                      <p
                        className="v-mono text-xs font-bold"
                        style={{
                          color:
                            activeActualChangePct >= 0
                              ? 'var(--v-bull)'
                              : 'var(--v-bear)',
                        }}
                      >
                        ${Math.round(activeActualEndPrice).toLocaleString('en-US')} (
                        {formatPct(activeActualChangePct)})
                      </p>
                    </div>
                  </div>

                  {/* 3-Column Score Breakdown */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div
                      className="p-2 rounded-[4px]"
                      style={{
                        backgroundColor: 'var(--v-canvas)',
                        boxShadow: 'var(--v-shadow-border)',
                      }}
                    >
                      <div className="flex items-center justify-between v-caption text-[11px]">
                        <span style={{ color: 'var(--v-mute)' }}>경로 (50)</span>
                        <span className="v-mono font-bold" style={{ color: 'var(--v-ink)' }}>
                          {liveScoreResult.pathScore}
                        </span>
                      </div>
                      <div
                        className="w-full h-1 mt-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--v-canvas-soft-2)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-150"
                          style={{
                            width: `${Math.min(100, (liveScoreResult.pathScore / 50) * 100)}%`,
                            backgroundColor: 'var(--v-bull)',
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className="p-2 rounded-[4px]"
                      style={{
                        backgroundColor: 'var(--v-canvas)',
                        boxShadow: 'var(--v-shadow-border)',
                      }}
                    >
                      <div className="flex items-center justify-between v-caption text-[11px]">
                        <span style={{ color: 'var(--v-mute)' }}>방향 (30)</span>
                        <span className="v-mono font-bold" style={{ color: 'var(--v-ink)' }}>
                          {liveScoreResult.directionScore}
                        </span>
                      </div>
                      <div
                        className="w-full h-1 mt-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--v-canvas-soft-2)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-150"
                          style={{
                            width: `${Math.min(100, (liveScoreResult.directionScore / 30) * 100)}%`,
                            backgroundColor: 'var(--v-link)',
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className="p-2 rounded-[4px]"
                      style={{
                        backgroundColor: 'var(--v-canvas)',
                        boxShadow: 'var(--v-shadow-border)',
                      }}
                    >
                      <div className="flex items-center justify-between v-caption text-[11px]">
                        <span style={{ color: 'var(--v-mute)' }}>목표 (20)</span>
                        <span className="v-mono font-bold" style={{ color: 'var(--v-ink)' }}>
                          {liveScoreResult.targetScore}
                        </span>
                      </div>
                      <div
                        className="w-full h-1 mt-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--v-canvas-soft-2)' }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-150"
                          style={{
                            width: `${Math.min(100, (liveScoreResult.targetScore / 20) * 100)}%`,
                            backgroundColor: 'var(--v-warning)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkpoint Error Audit Table (D+5 / D+10 / D+20) */}
                <div className="overflow-x-auto">
                  <table className="v-audit-table">
                    <thead>
                      <tr>
                        <th>구간</th>
                        <th className="v-numeric">내 예측가</th>
                        <th className="v-numeric">실제 종가</th>
                        <th className="v-numeric">오차율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkpointRows.map(row => (
                        <tr key={row.day}>
                          <td className="v-mono font-semibold text-xs">{row.label}</td>
                          <td className="v-numeric text-xs">
                            ${Math.round(row.pred).toLocaleString('en-US')}{' '}
                            <span style={{ color: 'var(--v-mute)' }}>
                              ({formatPct(row.predPct)})
                            </span>
                          </td>
                          <td className="v-numeric text-xs font-semibold">
                            {row.actual !== null ? (
                              <>
                                ${Math.round(row.actual).toLocaleString('en-US')}{' '}
                                <span
                                  style={{
                                    color:
                                      (row.actualPct ?? 0) >= 0
                                        ? 'var(--v-bull)'
                                        : 'var(--v-bear)',
                                  }}
                                >
                                  ({formatPct(row.actualPct ?? 0)})
                                </span>
                              </>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td
                            className="v-numeric text-xs font-semibold"
                            style={{
                              color:
                                row.errPct === null
                                  ? 'var(--v-mute)'
                                  : row.errPct <= 3.5
                                  ? 'var(--v-bull)'
                                  : row.errPct >= 8
                                  ? 'var(--v-bear)'
                                  : 'var(--v-ink)',
                            }}
                          >
                            {row.errPct !== null ? `${row.errPct.toFixed(1)}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Diagnostic Feedback & Historical Post-Mortem */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div
                    className="p-3 rounded-[5px] space-y-1"
                    style={{
                      backgroundColor: 'var(--v-canvas-soft)',
                      boxShadow: 'var(--v-shadow-border)',
                    }}
                  >
                    <p
                      className="v-caption text-[11px] font-semibold"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      채점 진단
                    </p>
                    <p className="v-caption text-xs leading-relaxed" style={{ color: 'var(--v-body)' }}>
                      {buildDiagnosticMessage(
                        finalScoreResult,
                        userChangePct,
                        finalActualChangePct
                      )}
                    </p>
                  </div>

                  <p className="v-caption text-xs leading-relaxed" style={{ color: 'var(--v-body)' }}>
                    <strong style={{ color: 'var(--v-ink)' }}>
                      실제 장세 복기:{' '}
                    </strong>
                    {scenario.revealTakeaway}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRetryCurrent}
                      className="flex-1 v-btn-secondary h-8 text-xs"
                    >
                      <RotateCcw size={12} />
                      다시 그리기
                    </button>
                    <button
                      type="button"
                      onClick={handleNextScenario}
                      className="flex-1 v-btn-primary h-8 text-xs font-semibold"
                    >
                      다음 시나리오 <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
