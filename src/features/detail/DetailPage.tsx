import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ThumbsUp } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getStockHistory, STOCKS } from '../../data/market';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { aggregateCrowd } from '../../domain/crowd';
import { buildDailySettlementRows, computeForecastDigest } from '../../domain/audit';
import {
  calculateEloProjection,
  DEFAULT_ELO,
  formatSignedLp,
  getEloTierInfo,
} from '../../domain/elo';
import { SplitHorizonCanvas } from '../studio/SplitHorizonCanvas';
import { ShareTicketModal } from '../../components/ShareTicketModal';
import type { Forecast } from '../../domain/types';

const DIFFICULTY_EN_MAP: Record<string, string> = {
  '컨센서스 동조': 'Consensus aligned',
  '컨센서스 이탈': 'Consensus divergence',
  '역발상 예측': 'Contrarian call',
};

interface DetailPageProps {
  currentDateStr: string;
  onDateChange?: (date: string) => void;
}

export function DetailPage({ currentDateStr, onDateChange }: DetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [forecast, setForecast] = useState<Forecast | undefined>(() =>
    id ? repository.getForecast(id) : undefined
  );
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [, setLikeTick] = useState(0);

  const reloadData = useCallback(() => {
    if (!id) return;
    setForecast(repository.getForecast(id));
  }, [id]);

  useEffect(() => {
    reloadData();
    const unsub = repository.subscribe(reloadData);
    return () => unsub();
  }, [reloadData, currentDateStr]);

  if (!forecast) {
    return (
      <div className="p-16 text-center space-y-4">
        <p className="v-heading-16" style={{ color: 'var(--v-ink)' }}>
          Prediction receipt not found.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="v-btn-primary"
        >
          Return to Studio
        </button>
      </div>
    );
  }

  const author = forecast.authorId ? repository.getUser(forecast.authorId) : null;
  const authorHandle = author
    ? author.handle
    : `guest_${forecast.anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'user'}`;
  const authorElo = author?.elo ?? DEFAULT_ELO;

  const isLiked = repository.isLiked(forecast.id);
  const likesCount = repository.getLikesCount(forecast.id);
  const status = deriveForecastStatus(forecast, currentDateStr);
  const stockBars = getStockHistory(forecast.ticker);
  const stockMeta = STOCKS.find(s => s.ticker === forecast.ticker) || STOCKS[0];
  const visibleBars = stockBars.filter(b => b.date <= currentDateStr);

  const allForecasts = repository.listFeed('all', currentDateStr);
  const tickerForecasts = allForecasts.filter(f => f.ticker === forecast.ticker);
  const crowd = aggregateCrowd(
    allForecasts,
    forecast.ticker,
    forecast.horizon,
    forecast.mode
  );

  const result = resolveForecast(forecast, visibleBars, crowd.consensusChangePct);
  const settledElo = result.eloSettlement
    ? authorElo + result.eloSettlement.deltaLp
    : authorElo;
  const authorTier = getEloTierInfo(settledElo);

  const eloProjection = useMemo(
    () =>
      calculateEloProjection(
        result.forecastChangePct,
        crowd.consensusChangePct,
        stockMeta.volatility
      ),
    [result.forecastChangePct, crowd.consensusChangePct, stockMeta.volatility]
  );

  const settlementRows = useMemo(
    () => buildDailySettlementRows(forecast, stockBars, currentDateStr),
    [forecast, stockBars, currentDateStr]
  );

  const digestHash = useMemo(() => computeForecastDigest(forecast), [forecast]);

  const draftPrices = useMemo(() => {
    if (forecast.path && forecast.path.length > 0) {
      return forecast.path.map(p => p.price);
    }
    return forecast.evalDates.map(() => forecast.basePrice);
  }, [forecast]);

  const finalPrice = draftPrices[draftPrices.length - 1] ?? forecast.basePrice;
  const isBull = result.forecastChangePct >= 0;
  const crowdPct = crowd.consensusChangePct ?? 0;
  const difficultyEn =
    DIFFICULTY_EN_MAP[eloProjection.difficultyLabel] ||
    eloProjection.difficultyLabel;

  return (
    <div className="w-full">
      {/* Top Action & Receipt Verification Bar */}
      <div
        className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-3"
        style={{
          backgroundColor: 'var(--v-canvas-soft)',
          borderBottom: '1px solid var(--v-hairline)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="v-btn-secondary"
          >
            ← Back
          </button>
          <span className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
            receipt: {digestHash}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onDateChange && status !== 'RESOLVED' && (
            <button
              type="button"
              onClick={() =>
                onDateChange(
                  forecast.evalDates[forecast.evalDates.length - 1] ||
                    '2026-10-09'
                )
              }
              className="v-btn-secondary v-mono"
            >
              Simulate D+5 settlement →
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              repository.toggleLike(forecast.id);
              setLikeTick(t => t + 1);
            }}
            className="v-btn-secondary"
            style={{ color: isLiked ? 'var(--v-ink)' : 'var(--v-mute)' }}
          >
            <ThumbsUp size={12} />
            <span>Like</span>
            {likesCount > 0 && <span className="v-kbd">{likesCount}</span>}
          </button>

          <button
            type="button"
            onClick={() => navigate(`/studio/${forecast.ticker}`)}
            className="v-btn-secondary"
          >
            Open ${forecast.ticker} Studio ↗
          </button>

          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            className="v-btn-primary"
          >
            Export verified receipt
          </button>
        </div>
      </div>

      {/* ZONE 1: Receipt Masthead Band */}
      <div
        className="relative grid grid-cols-1 lg:grid-cols-12"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair" style={{ bottom: -6, left: -6 }} />
        <span className="v-crosshair" style={{ bottom: -6, right: -6 }} />

        <div
          className="lg:col-span-7 p-5 flex flex-col justify-between gap-3 min-w-0"
          style={{ borderRight: '1px solid var(--v-hairline)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => author && navigate(`/u/${author.handle}`)}
                className="v-mono text-sm font-semibold hover:underline"
                style={{ color: 'var(--v-ink)' }}
              >
                @{authorHandle}
              </button>
              <span
                className="v-caption-mono px-2 py-0.5 rounded-[4px]"
                style={{
                  backgroundColor: 'var(--v-canvas-soft-2)',
                  boxShadow: 'var(--v-shadow-border)',
                  color: 'var(--v-body)',
                }}
              >
                {authorTier.tier} · {settledElo} LP
              </span>
              <span className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
                locked {forecast.baseDate}
              </span>
            </div>

            <div className="flex items-center gap-2 v-mono text-xs">
              <span
                className="px-2 py-0.5 rounded-[4px]"
                style={{
                  backgroundColor: 'var(--v-canvas-soft)',
                  boxShadow: 'var(--v-shadow-border)',
                  color: 'var(--v-ink)',
                }}
              >
                ${forecast.ticker} · Anchor ${forecast.basePrice.toFixed(2)}
              </span>
              <span
                className="px-2 py-0.5 rounded-[4px] v-caption-mono"
                style={{
                  backgroundColor:
                    status === 'RESOLVED'
                      ? 'var(--v-link-soft)'
                      : 'var(--v-bull-soft)',
                  color:
                    status === 'RESOLVED' ? 'var(--v-link)' : 'var(--v-bull)',
                }}
              >
                {status}
              </span>
            </div>
          </div>

          <h1 className="v-display-md" style={{ color: 'var(--v-ink)' }}>
            {forecast.comment || `${forecast.ticker} 5-day trajectory deployment`}
          </h1>
        </div>

        {/* Right 5 Cols: Flush 3-Column Receipt Telemetry Strip */}
        <div className="lg:col-span-5 grid grid-cols-3 min-w-0">
          <div
            className="p-4 sm:p-5 flex flex-col justify-between min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              D+5 target
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: isBull ? 'var(--v-bull)' : 'var(--v-bear)' }}
              >
                {isBull ? '+' : ''}
                {result.forecastChangePct.toFixed(2)}%
              </p>
              <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                ${finalPrice.toFixed(2)}
              </p>
            </div>
          </div>

          <div
            className="p-4 sm:p-5 flex flex-col justify-between min-w-0"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              Crowd median
            </span>
            <div className="mt-2">
              <p
                className="v-mono text-xl font-semibold tracking-tight"
                style={{ color: 'var(--v-ink)' }}
              >
                {crowdPct >= 0 ? '+' : ''}
                {crowdPct.toFixed(2)}%
              </p>
              <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                {difficultyEn}
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 flex flex-col justify-between min-w-0">
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              {result.eloSettlement ? 'Elo settled' : 'Elo stake'}
            </span>
            <div className="mt-2">
              {result.eloSettlement ? (
                <>
                  <p
                    className="v-mono text-xl font-semibold tracking-tight"
                    style={{
                      color:
                        result.eloSettlement.deltaLp >= 0
                          ? 'var(--v-bull)'
                          : 'var(--v-bear)',
                    }}
                  >
                    {formatSignedLp(result.eloSettlement.deltaLp)}
                  </p>
                  <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                    {result.score
                      ? `${result.score.total.toFixed(1)} pts · Grade ${result.score.grade}`
                      : 'Settled'}
                  </p>
                </>
              ) : (
                <>
                  <p className="v-mono text-lg font-semibold tracking-tight">
                    <span style={{ color: 'var(--v-bull)' }}>
                      +{eloProjection.expectedWinLp}
                    </span>
                    <span style={{ color: 'var(--v-dim)' }}> / </span>
                    <span style={{ color: 'var(--v-bear)' }}>
                      {eloProjection.expectedLossLp}
                    </span>
                  </p>
                  <p className="v-caption-mono mt-0.5" style={{ color: 'var(--v-mute)' }}>
                    Hit prob E = {Math.round(eloProjection.expectedProbability * 100)}%
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ZONE 2: Unified Split-Horizon Verification Canvas */}
      <div style={{ borderBottom: '1px solid var(--v-hairline)' }}>
        <SplitHorizonCanvas
          ticker={forecast.ticker}
          baseDate={forecast.baseDate}
          basePrice={forecast.basePrice}
          evalDates={forecast.evalDates}
          currentDateStr={currentDateStr}
          draftPrices={draftPrices}
          onChangeDraftPrices={() => {}}
          lockedForecast={forecast}
          onExitLockedView={() => navigate(`/studio/${forecast.ticker}`)}
          allTickerForecasts={tickerForecasts}
          overlaidRivals={[]}
          onRemoveOverlay={() => {}}
          onClearOverlays={() => {}}
          duelTarget={null}
          onCancelDuel={() => {}}
        />
      </div>

      {/* ZONE 3: Full-Width Semantic Daily Settlement Audit Table */}
      <div>
        <div
          className="px-5 py-2.5 flex flex-wrap items-center justify-between gap-2"
          style={{
            backgroundColor: 'var(--v-canvas-soft)',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <span className="v-caption-mono uppercase" style={{ color: 'var(--v-ink)' }}>
            Daily close settlement ledger ({currentDateStr})
          </span>
          <span className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
            rules:v1 · hybrid-100pt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="v-audit-table">
            <thead>
              <tr>
                <th scope="col">Slot</th>
                <th scope="col">Date</th>
                <th scope="col" className="v-numeric">
                  Weight (w_t)
                </th>
                <th scope="col" className="v-numeric">
                  Forecast close
                </th>
                <th scope="col" className="v-numeric">
                  Forecast delta
                </th>
                <th scope="col" className="v-numeric">
                  Observed close
                </th>
                <th scope="col" className="v-numeric">
                  Observed delta
                </th>
                <th scope="col" className="v-numeric">
                  Abs error
                </th>
                <th scope="col">Direction</th>
              </tr>
            </thead>
            <tbody>
              {settlementRows.map(row => (
                <tr key={row.slot}>
                  <th scope="row" className="v-mono font-medium">
                    {row.slot}
                  </th>
                  <td className="v-mono">{row.date}</td>
                  <td className="v-numeric">{row.weight}.0x</td>
                  <td className="v-numeric">${row.forecastPrice.toFixed(2)}</td>
                  <td
                    className="v-numeric"
                    style={{
                      color:
                        row.forecastChangePct >= 0
                          ? 'var(--v-bull)'
                          : 'var(--v-bear)',
                    }}
                  >
                    {row.forecastChangePct >= 0 ? '+' : ''}
                    {row.forecastChangePct.toFixed(2)}%
                  </td>
                  <td className="v-numeric">
                    {row.actualClose !== null
                      ? `$${row.actualClose.toFixed(2)}`
                      : 'Pending'}
                  </td>
                  <td
                    className="v-numeric"
                    style={{
                      color:
                        row.actualChangePct === null
                          ? 'var(--v-mute)'
                          : row.actualChangePct >= 0
                          ? 'var(--v-bull)'
                          : 'var(--v-bear)',
                    }}
                  >
                    {row.actualChangePct !== null
                      ? `${row.actualChangePct >= 0 ? '+' : ''}${row.actualChangePct.toFixed(
                          2
                        )}%`
                      : 'Pending'}
                  </td>
                  <td className="v-numeric">
                    {row.absErrorPct !== null
                      ? `${row.absErrorPct.toFixed(2)}%`
                      : 'Pending'}
                  </td>
                  <td>
                    {row.directionMatch === null ? (
                      <span
                        className="v-caption-mono"
                        style={{ color: 'var(--v-mute)' }}
                      >
                        Unsettled
                      </span>
                    ) : row.directionMatch ? (
                      <span
                        className="v-caption-mono"
                        style={{ color: 'var(--v-bull)' }}
                      >
                        Matched
                      </span>
                    ) : (
                      <span
                        className="v-caption-mono"
                        style={{ color: 'var(--v-bear)' }}
                      >
                        Diverged
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ShareTicketModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        forecast={forecast}
        authorHandle={authorHandle}
        crowdPath={crowd.consensusPath}
        crowdChangePct={crowd.consensusChangePct}
        authorElo={settledElo}
      />
    </div>
  );
}

export default DetailPage;
