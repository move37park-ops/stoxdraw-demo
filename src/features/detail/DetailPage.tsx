import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ThumbsUp,
  Share2,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getStockHistory } from '../../data/market';
import { BTC_DAILY_VOLATILITY } from '../../data/btcMarket';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecastsWithCohort, resolveForecast } from '../../domain/resolution';
import { calculateRealizedDailyVolatility } from '../../domain/scoring';
import { decodeForecastSharePayload, type DecodedSharedForecast } from '../../domain/sharePayload';
import { aggregateCrowd, computeConsensusBand } from '../../domain/crowd';
import { buildDailySettlementRows } from '../../domain/audit';
import {
  calculateEloProjection,
  DEFAULT_ELO,
  formatSignedLp,
  getEloTierInfo,
} from '../../domain/elo';
import { formatPct } from '../../domain/format';
import { PathCanvas } from '../predict/PathCanvas';
import { ShareTicketModal } from '../../components/ShareTicketModal';
import { track } from '../../lib/analytics';
import { localizeDataText, useI18n } from '../../lib/i18nCore';
import type { AnchorPoint, Forecast } from '../../domain/types';

interface DetailPageProps {
  currentDateStr: string;
  onDateChange?: (date: string) => void;
}

export function DetailPage({ currentDateStr }: DetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale, t } = useI18n();

  const sharedFallback = useMemo(
    () => decodeForecastSharePayload(searchParams.get('p'), id),
    [searchParams, id]
  );

  const [repoTick, setRepoTick] = useState(0);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [, setLikeTick] = useState(0);

  useEffect(() => {
    const unsub = repository.subscribe(() => setRepoTick(c => c + 1));
    return () => unsub();
  }, []);

  const rawForecast = useMemo<DecodedSharedForecast | undefined>(() => {
    void repoTick;
    if (!id) return undefined;
    return (repository.getForecast(id) as DecodedSharedForecast | undefined) ?? sharedFallback ?? undefined;
  }, [id, sharedFallback, repoTick]);

  const rawId = rawForecast?.id;
  const rawTicker = rawForecast?.ticker;
  useEffect(() => {
    if (rawId && rawTicker) {
      track('result_viewed', { forecastId: rawId, ticker: rawTicker });
    }
  }, [rawId, rawTicker]);

  // 해당 예측 라운드의 주요 마일스톤 스텝 구성 (7일 또는 레거시 20일 자동 대응)
  const roundTimeSteps = useMemo(() => {
    if (!rawForecast) return [];
    const evals = rawForecast.evalDates || [];
    if (evals.length <= 7) {
      return [
        { code: 'D-0', date: rawForecast.baseDate },
        { code: 'D+2', date: evals[1] || rawForecast.baseDate },
        { code: 'D+4', date: evals[3] || rawForecast.baseDate },
        { code: `D+${evals.length || 7}`, date: evals[evals.length - 1] || rawForecast.baseDate },
      ];
    }
    return [
      { code: 'D-0', date: rawForecast.baseDate },
      { code: 'D+5', date: evals[4] || rawForecast.baseDate },
      { code: 'D+10', date: evals[9] || rawForecast.baseDate },
      { code: `D+${evals.length}`, date: evals[evals.length - 1] || rawForecast.baseDate },
    ];
  }, [rawForecast]);

  const [manualViewSelection, setManualViewSelection] = useState<{
    forecastId?: string;
    baseDate: string;
    date: string;
  } | null>(null);

  const viewDateStr = useMemo(() => {
    if (!rawForecast) return currentDateStr;
    if (
      manualViewSelection &&
      manualViewSelection.forecastId === rawForecast.id &&
      manualViewSelection.baseDate === currentDateStr
    ) {
      return manualViewSelection.date;
    }
    const lastEval = rawForecast.evalDates?.[rawForecast.evalDates.length - 1];
    if (currentDateStr > rawForecast.baseDate) return currentDateStr;
    return lastEval || currentDateStr;
  }, [rawForecast, currentDateStr, manualViewSelection]);

  const stockBars = useMemo(
    () => (rawForecast ? getStockHistory(rawForecast.ticker) : []),
    [rawForecast]
  );
  const historyBars = useMemo(
    () =>
      rawForecast
        ? stockBars.filter(b => b.date <= rawForecast.baseDate).slice(-245)
        : [],
    [rawForecast, stockBars]
  );

  // D-0 마지막 일봉 종가와 예측 시작 기준가(basePrice)를 1:1로 동기화하여 궤적 시작점이 항상 D-0 라인/캔들에 정확히 맞닿도록 보정
  const actualD0Close =
    historyBars.length > 0
      ? historyBars[historyBars.length - 1].close
      : rawForecast?.basePrice ?? 0;

  const forecast: Forecast | null = useMemo(() => {
    if (!rawForecast) return null;
    const scale =
      rawForecast.basePrice > 0 ? actualD0Close / rawForecast.basePrice : 1;
    if (Math.abs(scale - 1) < 1e-5) return rawForecast;
    return {
      ...rawForecast,
      basePrice: actualD0Close,
      anchors: rawForecast.anchors?.map(a => ({
        day: a.day,
        price: parseFloat((a.price * scale).toFixed(2)),
      })),
      path: rawForecast.path?.map(p => ({
        date: p.date,
        price: parseFloat((p.price * scale).toFixed(2)),
      })),
      versions: rawForecast.versions?.map(v => ({
        ...v,
        anchors: v.anchors.map(a => ({
          day: a.day,
          price: parseFloat((a.price * scale).toFixed(2)),
        })),
        prices: v.prices.map(p => parseFloat((p * scale).toFixed(2))),
      })),
    };
  }, [rawForecast, actualD0Close]);

  if (!forecast) {
    return (
      <div className="p-16 text-center space-y-4">
        <p className="v-heading-16" style={{ color: 'var(--op-ink)' }}>
          {t('예측을 찾을 수 없습니다.', 'Forecast not found.')}
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="op-btn-primary"
        >
          {t('예측 화면으로 돌아가기', 'Back to Predict')}
        </button>
      </div>
    );
  }

  const author = forecast.authorId
    ? repository.getUser(forecast.authorId)
    : null;
  const authorHandle = author
    ? author.handle
    : rawForecast?.sharedAuthorHandle
    ? rawForecast.sharedAuthorHandle
    : `guest_${forecast.anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'user'}`;
  const authorElo = author?.elo ?? rawForecast?.sharedAuthorElo ?? DEFAULT_ELO;

  const isLiked = repository.isLiked(forecast.id);
  const likesCount = repository.getLikesCount(forecast.id);
  const status = deriveForecastStatus(forecast, viewDateStr);
  const visibleBars = stockBars.filter(b => b.date <= viewDateStr);

  const barMap = new Map(stockBars.map(b => [b.date, b]));
  const actualFutureBars = forecast.evalDates.map(d => {
    if (viewDateStr > forecast.baseDate && d <= viewDateStr) {
      return barMap.get(d) || null;
    }
    return null;
  });

  const allForecasts = repository.listFeed('all', viewDateStr);
  const sameRoundForecasts = allForecasts
    .filter(
      f => f.ticker === forecast.ticker && f.baseDate === forecast.baseDate
    )
    .map(f => {
      if (f.basePrice <= 0 || Math.abs(actualD0Close / f.basePrice - 1) < 1e-5) {
        return f;
      }
      const s = actualD0Close / f.basePrice;
      return {
        ...f,
        basePrice: actualD0Close,
        anchors: f.anchors?.map(a => ({
          day: a.day,
          price: parseFloat((a.price * s).toFixed(2)),
        })),
        path: f.path?.map(p => ({
          date: p.date,
          price: parseFloat((p.price * s).toFixed(2)),
        })),
      };
    });

  const crowd = aggregateCrowd(
    sameRoundForecasts,
    forecast.ticker,
    forecast.horizon,
    forecast.mode
  );

  const cohortPool = sameRoundForecasts.some(f => f.id === forecast.id)
    ? sameRoundForecasts
    : [...sameRoundForecasts, forecast];
  const userEloMap: Record<string, number> = {};
  repository.listAllUsers().forEach(u => {
    userEloMap[u.id] = u.elo ?? DEFAULT_ELO;
  });

  const cohortResults = resolveForecastsWithCohort(cohortPool, visibleBars, userEloMap);
  const consensusBand = computeConsensusBand(
    cohortPool,
    forecast.evalDates,
    forecast.basePrice,
    undefined,
    userEloMap
  );
  const result =
    cohortResults.get(forecast.id) ??
    resolveForecast(forecast, visibleBars, crowd.consensusChangePct);

  const settledElo = result.eloSettlement
    ? authorElo + result.eloSettlement.deltaLp
    : authorElo;
  const authorTier = getEloTierInfo(settledElo);

  const realizedVol = calculateRealizedDailyVolatility(
    historyBars.map(b => b.close),
    BTC_DAILY_VOLATILITY
  );
  const cohortMeanElo =
    cohortPool.length > 0
      ? cohortPool.reduce(
          (sum, f) => sum + (userEloMap[f.authorId || ''] ?? DEFAULT_ELO),
          0
        ) / cohortPool.length
      : DEFAULT_ELO;

  const eloProjection = calculateEloProjection(
    result.forecastChangePct,
    crowd.consensusChangePct,
    realizedVol,
    forecast.evalDates.length,
    locale,
    authorElo,
    cohortMeanElo
  );

  const settlementRows = buildDailySettlementRows(
    forecast,
    stockBars,
    viewDateStr
  );

  const displayAnchors: AnchorPoint[] = (() => {
    if (forecast.anchors && forecast.anchors.length > 0) {
      return forecast.anchors;
    }
    const pts = forecast.path || [];
    if (pts.length > 0) {
      return [{ day: pts.length, price: pts[pts.length - 1].price }];
    }
    return [{ day: forecast.evalDates?.length || 7, price: forecast.basePrice }];
  })();

  const initialVersion =
    forecast.versions && forecast.versions.length > 1
      ? forecast.versions[0]
      : null;

  const boxStyle = {
    backgroundColor: 'var(--op-canvas)',
    border: '1px solid var(--op-line-strong)',
    borderRadius: '2px',
  } as const;

  return (
    <div className="px-4 sm:px-6 pt-4 pb-6 space-y-4 op-view-enter" style={{ backgroundColor: 'var(--op-canvas)' }}>
      {/* Box 1: Top Receipt Masthead Band */}
      <section
        className="p-5 flex flex-wrap items-center justify-between gap-4"
        style={boxStyle}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="v-btn-secondary h-7 px-2 text-xs rounded-[2px]"
            >
              <ArrowLeft size={12} />
              {t('뒤로', 'Back')}
            </button>
            <span
              className="v-caption-mono px-2 py-0.5 rounded-[2px]"
              style={{
                backgroundColor: 'var(--op-panel)',
                border: '1px solid var(--op-line)',
                color: 'var(--v-mute)',
              }}
            >
              {status === 'RESOLVED'
                ? t('정산 완료', 'Settled')
                : status === 'LIVE'
                ? t('진행 중', 'Live')
                : status}
            </span>
            <span
              className="v-caption-mono"
              style={{ color: 'var(--v-mute)' }}
            >
              {t('기준일:', 'Base Date:')} {forecast.baseDate}
            </span>
          </div>

          <h1 className="v-display-md" style={{ color: 'var(--v-ink)' }}>
            @{authorHandle} · {forecast.ticker}{' '}
            {t(`${forecast.evalDates.length}일 예측`, `${forecast.evalDates.length}D Forecast`)}
          </h1>
          <p className="v-caption" style={{ color: 'var(--v-body)' }}>
            {localizeDataText(forecast.comment, locale)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 mr-1">
            {roundTimeSteps.map(s => {
              const isSelected = s.date === viewDateStr;
              return (
                <button
                  key={s.code}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() =>
                    setManualViewSelection({
                      forecastId: forecast.id,
                      baseDate: currentDateStr,
                      date: s.date,
                    })
                  }
                  className="v-btn-secondary h-7 px-2 text-[11px] rounded-[2px]"
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--v-primary)'
                      : 'var(--op-canvas)',
                    color: isSelected
                      ? 'var(--v-on-primary)'
                      : 'var(--v-ink)',
                  }}
                >
                  {s.code}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-pressed={isLiked}
            onClick={() => {
              repository.toggleLike(forecast.id);
              setLikeTick(c => c + 1);
            }}
            className="v-btn-secondary h-8 px-3 text-xs rounded-[2px]"
            style={{
              color: isLiked ? 'var(--v-link)' : 'var(--v-ink)',
            }}
          >
            <ThumbsUp size={12} />
            {t(`추천 (${likesCount})`, `Like (${likesCount})`)}
          </button>

          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            className="v-btn-primary h-8 px-3 text-xs font-semibold rounded-[2px]"
          >
            <Share2 size={12} />
            {t('공유 카드', 'Share Card')}
          </button>
        </div>
      </section>

      {/* Box 2: Canvas Replay View */}
      <section className="overflow-hidden" style={boxStyle}>
        <PathCanvas
          mode="live"
          ticker={forecast.ticker}
          baseDate={forecast.baseDate}
          basePrice={forecast.basePrice}
          evalDates={forecast.evalDates}
          historyBars={historyBars}
          actualFutureBars={actualFutureBars}
          anchors={displayAnchors}
          onChangeAnchors={() => {}}
          readOnly
          isConsensusUnlocked
          consensusBand={consensusBand}
          allForecasts={sameRoundForecasts}
          initialVersion={initialVersion}
          headerSubtitle={t(
            '예측 궤적 · 시장 중앙값 · 실제 일봉 비교',
            'Forecast Path · Market Median · Actual Closes'
          )}
        />
      </section>

      {/* Box 3 & 4: 12-Col Bento Grid (5 Cols Summary + Version Boxes | 7 Cols Daily Audit Table Box) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left 5 Cols */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          {/* Sub-box A: Scorecard */}
          <div className="overflow-hidden divide-y divide-[var(--v-hairline)]" style={boxStyle}>
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ backgroundColor: 'var(--op-panel)' }}
            >
              <span
                className="v-body-sm-strong flex items-center gap-1.5"
                style={{ color: 'var(--v-ink)' }}
              >
                <ShieldCheck size={14} style={{ color: 'var(--v-bull)' }} />
                {t('예측 요약 및 채점 성적표', 'Forecast Summary & Scorecard')}
              </span>
              <span
                className="v-caption-mono px-2 py-0.5 rounded-[2px] inline-flex items-center gap-1.5"
                style={{
                  backgroundColor: 'var(--op-canvas)',
                  border: '1px solid var(--op-line-strong)',
                  color: 'var(--v-ink)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-[1.5px] flex-shrink-0"
                  style={{ backgroundColor: authorTier.accentHex }}
                />
                <span className="font-semibold" style={{ color: authorTier.accentHex }}>
                  {locale === 'en' ? authorTier.title : authorTier.krTitle}
                </span>
                <span>({settledElo.toLocaleString('en-US')} LP)</span>
              </span>
            </div>

            <div className="grid grid-cols-2 divide-x divide-[var(--v-hairline)]">
              <div className="p-4">
                <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                  {t('예측 목표 수익률', 'Target Return')}
                </p>
                <p
                  className="v-mono text-lg font-bold mt-0.5"
                  style={{
                    color:
                      result.forecastChangePct >= 0
                        ? 'var(--v-bull)'
                        : 'var(--v-bear)',
                  }}
                >
                  {formatPct(result.forecastChangePct)}
                </p>
              </div>
              <div className="p-4">
                <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                  {t('실제 진행 수익률', 'Realized Return')}
                </p>
                <p
                  className="v-mono text-lg font-bold mt-0.5"
                  style={{
                    color:
                      result.actualChangePct >= 0
                        ? 'var(--v-bull)'
                        : 'var(--v-bear)',
                  }}
                >
                  {formatPct(result.actualChangePct)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-[var(--v-hairline)]">
              <div className="p-4">
                <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                  {t('점수', 'Score')}
                </p>
                <p
                  className="v-mono text-lg font-bold mt-0.5"
                  style={{ color: 'var(--v-link)' }}
                >
                  {result.score
                    ? t(
                        `${result.score.total}점 (등급 ${result.score.grade})`,
                        `${result.score.total} pts (Grade ${result.score.grade})`
                      )
                    : t('집계 대기 (D-0)', 'Pending Settlement (D-0)')}
                </p>
              </div>
              <div className="p-4">
                <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                  {t('평판 LP 변동', 'Reputation LP Delta')}
                </p>
                <p
                  className="v-mono text-lg font-bold mt-0.5"
                  style={{
                    color: result.eloSettlement
                      ? result.eloSettlement.deltaLp >= 0
                        ? 'var(--v-bull)'
                        : 'var(--v-bear)'
                      : 'var(--v-ink)',
                  }}
                >
                  {result.eloSettlement
                    ? formatSignedLp(result.eloSettlement.deltaLp)
                    : `+${eloProjection.expectedWinLp} / ${eloProjection.expectedLossLp} LP`}
                </p>
              </div>
            </div>

            {result.score && (
              <div
                className="grid grid-cols-3 divide-x divide-[var(--v-hairline)]"
                style={{ backgroundColor: 'var(--op-panel)' }}
              >
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between v-caption-mono text-xs">
                    <span style={{ color: 'var(--v-mute)' }}>{t('경로 (50)', 'Path (50)')}</span>
                    <strong style={{ color: 'var(--v-ink)' }}>
                      {result.score.pathScore}
                    </strong>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-[1px] overflow-hidden"
                    style={{ backgroundColor: 'var(--op-canvas)' }}
                  >
                    <div
                      className="h-full rounded-[1px]"
                      style={{
                        width: `${(result.score.pathScore / 50) * 100}%`,
                        backgroundColor: 'var(--v-bull)',
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between v-caption-mono text-xs">
                    <span style={{ color: 'var(--v-mute)' }}>{t('형태 (25)', 'Shape (25)')}</span>
                    <strong style={{ color: 'var(--v-ink)' }}>
                      {result.score.directionScore}
                    </strong>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-[1px] overflow-hidden"
                    style={{ backgroundColor: 'var(--op-canvas)' }}
                  >
                    <div
                      className="h-full rounded-[1px]"
                      style={{
                        width: `${(result.score.directionScore / 25) * 100}%`,
                        backgroundColor: 'var(--v-link)',
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between v-caption-mono text-xs">
                    <span style={{ color: 'var(--v-mute)' }}>{t('목표 (25)', 'Target (25)')}</span>
                    <strong style={{ color: 'var(--v-ink)' }}>
                      {result.score.targetScore}
                    </strong>
                  </div>
                  <div
                    className="w-full h-1.5 rounded-[1px] overflow-hidden"
                    style={{ backgroundColor: 'var(--op-canvas)' }}
                  >
                    <div
                      className="h-full rounded-[1px]"
                      style={{
                        width: `${(result.score.targetScore / 25) * 100}%`,
                        backgroundColor: 'var(--v-warning)',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 7 Cols: Boxed Daily Audit Matrix */}
        <div className="lg:col-span-7 overflow-hidden min-w-0" style={boxStyle}>
          <div className="overflow-x-auto">
          <table className="v-audit-table">
            <thead>
              <tr>
                <th>{t('구간', 'Day')}</th>
                <th>{t('일자', 'Date')}</th>
                <th className="v-numeric">{t('보간 예측가', 'Projected')}</th>
                <th className="v-numeric">{t('예측 등락', 'Forecast %')}</th>
                <th className="v-numeric">{t('실제 종가', 'Actual Close')}</th>
                <th className="v-numeric">{t('오차율', 'Error %')}</th>
              </tr>
            </thead>
            <tbody>
              {settlementRows.map(row => (
                <tr key={row.slot}>
                  <td className="v-mono font-semibold">{row.slot}</td>
                  <td className="v-mono" style={{ color: 'var(--v-mute)' }}>
                    {row.date}
                  </td>
                  <td className="v-numeric font-semibold">
                    ${row.forecastPrice.toLocaleString('en-US')}
                  </td>
                  <td
                    className="v-numeric"
                    style={{
                      color:
                        row.forecastChangePct >= 0
                          ? 'var(--v-bull)'
                          : 'var(--v-bear)',
                    }}
                  >
                    {formatPct(row.forecastChangePct)}
                  </td>
                  <td className="v-numeric">
                    {row.actualClose !== null
                      ? `$${row.actualClose.toLocaleString('en-US')}`
                      : t('미도래', 'Pending')}
                  </td>
                  <td className="v-numeric">
                    {row.absErrorPct !== null
                      ? `${row.absErrorPct.toFixed(2)}%`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <ShareTicketModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        forecast={forecast}
        authorHandle={authorHandle}
        crowdPath={crowd.consensusPath}
        crowdChangePct={crowd.consensusChangePct}
        scoreTotal={result.score?.total}
        scoreGrade={result.score?.grade}
        eloDeltaLp={result.eloSettlement?.deltaLp}
        authorElo={settledElo}
      />
    </div>
  );
}
export default DetailPage;
