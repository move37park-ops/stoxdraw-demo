import { useState, useMemo } from 'react';
import { calculateEloProjection, settleEloRating, formatSignedLp } from '../../domain/elo';
import { calculateForecastScore } from '../../domain/scoring';
import { computeForecastDigest } from '../../domain/audit';
import { getStockHistory, STOCKS } from '../../data/market';
import type { Forecast } from '../../domain/types';

const CATALYST_TAGS = [
  'Earnings',
  'Gamma',
  'Breakout',
  'Mean reversion',
  'Macro',
];

interface TelemetryMintConsoleProps {
  ticker: string;
  baseDate: string;
  basePrice: number;
  evalDates: string[];
  currentDateStr: string;
  draftPrices: number[];
  onChangeDraftPrices: (prices: number[]) => void;
  crowdChangePct?: number;
  lockedForecast: Forecast | null;
  duelTarget: { forecast: Forecast; handle: string } | null;
  onLockForecast: (comment: string) => void;
  onOpenShareModal: (forecast: Forecast) => void;
}

export function TelemetryMintConsole({
  ticker,
  baseDate,
  basePrice,
  evalDates,
  currentDateStr,
  draftPrices,
  onChangeDraftPrices,
  crowdChangePct,
  lockedForecast,
  duelTarget,
  onLockForecast,
  onOpenShareModal,
}: TelemetryMintConsoleProps) {
  const [selectedTag, setSelectedTag] = useState<string>('Breakout');
  const [thesisText, setThesisText] = useState<string>('');

  const stockMeta = STOCKS.find(s => s.ticker === ticker) || STOCKS[0];

  const activePrices = useMemo(() => {
    if (lockedForecast && lockedForecast.path && lockedForecast.path.length > 0) {
      return evalDates.map((d, i) => {
        const pt = lockedForecast.path!.find(p => p.date === d);
        return pt ? pt.price : lockedForecast.path![i]?.price ?? basePrice;
      });
    }
    return draftPrices;
  }, [lockedForecast, draftPrices, evalDates, basePrice]);

  const finalPrice = activePrices[activePrices.length - 1] ?? basePrice;
  const myChangePct =
    basePrice > 0 ? ((finalPrice - basePrice) / basePrice) * 100 : 0;

  const eloProjection = useMemo(
    () =>
      calculateEloProjection(
        myChangePct,
        crowdChangePct,
        stockMeta.volatility
      ),
    [myChangePct, crowdChangePct, stockMeta.volatility]
  );

  const actualCloses = useMemo(() => {
    if (currentDateStr <= baseDate) return [];
    const bars = getStockHistory(ticker);
    const map = new Map(bars.map(b => [b.date, b.close]));
    const closes: number[] = [];
    for (const d of evalDates) {
      if (d <= currentDateStr && map.has(d)) {
        closes.push(map.get(d)!);
      }
    }
    return closes;
  }, [ticker, evalDates, currentDateStr, baseDate]);

  const liveScore = useMemo(() => {
    if (actualCloses.length === 0) return null;
    return calculateForecastScore(
      activePrices,
      actualCloses,
      basePrice,
      stockMeta.volatility
    );
  }, [activePrices, actualCloses, basePrice, stockMeta.volatility]);

  const liveSettlement = useMemo(() => {
    if (!liveScore) return null;
    return settleEloRating(
      liveScore,
      myChangePct,
      crowdChangePct,
      stockMeta.volatility
    );
  }, [liveScore, myChangePct, crowdChangePct, stockMeta.volatility]);

  const digestHash = useMemo(() => {
    if (lockedForecast) {
      return computeForecastDigest(lockedForecast);
    }
    const previewForecast: Forecast = {
      id: 'draft-preview',
      authorId: null,
      anonId: 'preview',
      ticker,
      horizon: '5D',
      mode: 'path',
      comment: thesisText,
      lockedAt: `${baseDate}T13:30:00Z`,
      basePrice,
      baseDate,
      evalDates,
      path: evalDates.map((date, idx) => ({
        date,
        price: activePrices[idx] ?? basePrice,
      })),
      rulesVersion: 'v1',
    };
    return computeForecastDigest(previewForecast);
  }, [lockedForecast, ticker, thesisText, baseDate, basePrice, evalDates, activePrices]);

  const adjustSingleNode = (idx: number, deltaPct: number) => {
    if (lockedForecast) return;
    const next = [...draftPrices];
    const updated = Math.max(
      1,
      parseFloat((next[idx] * (1 + deltaPct / 100)).toFixed(2))
    );
    next[idx] = updated;
    onChangeDraftPrices(next);
  };

  const handleSubmitLock = (e: React.FormEvent) => {
    e.preventDefault();
    const combinedComment = thesisText.trim()
      ? `[${selectedTag}] ${thesisText.trim()}`
      : `[${selectedTag}] ${ticker} 5D target $${finalPrice.toFixed(2)} (${
          myChangePct >= 0 ? '+' : ''
        }${myChangePct.toFixed(2)}%)`;
    onLockForecast(combinedComment);
    setThesisText('');
  };

  const vectorSummary = activePrices
    .map(p => {
      const pct = basePrice > 0 ? ((p - basePrice) / basePrice) * 100 : 0;
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    })
    .join(', ');

  return (
    <aside className="flex flex-col h-full justify-between">
      <div>
        {/* Flush 2-Column Top Telemetry Split (No nested boxes) */}
        <div
          className="grid grid-cols-2"
          style={{ borderBottom: '1px solid var(--v-hairline)' }}
        >
          <div
            className="p-4"
            style={{ borderRight: '1px solid var(--v-hairline)' }}
          >
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              D+5 target
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className="v-mono text-2xl font-semibold tracking-tight"
                style={{ color: 'var(--v-ink)' }}
              >
                ${finalPrice.toFixed(2)}
              </span>
              <span
                className="v-mono text-xs font-medium"
                style={{
                  color: myChangePct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                }}
              >
                {myChangePct >= 0 ? '+' : ''}
                {myChangePct.toFixed(2)}%
              </span>
            </div>
            <p className="v-caption-mono mt-1" style={{ color: 'var(--v-mute)' }}>
              vs crowd {crowdChangePct !== undefined ? `${crowdChangePct >= 0 ? '+' : ''}${crowdChangePct.toFixed(1)}%` : '0.0%'}
            </p>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
                Elo stake
              </span>
              <span className="v-caption-mono" style={{ color: 'var(--v-ink)' }}>
                {eloProjection.difficultyLabel}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span
                className="v-mono text-2xl font-semibold tracking-tight"
                style={{ color: 'var(--v-bull)' }}
              >
                +{eloProjection.expectedWinLp}
              </span>
              <span className="v-mono text-sm" style={{ color: 'var(--v-dim)' }}>
                /
              </span>
              <span
                className="v-mono text-sm font-medium"
                style={{ color: 'var(--v-bear)' }}
              >
                {eloProjection.expectedLossLp} LP
              </span>
            </div>
            <p className="v-caption-mono mt-1" style={{ color: 'var(--v-mute)' }}>
              Hit prob E = {Math.round(eloProjection.expectedProbability * 100)}%
            </p>
          </div>
        </div>

        {/* Live 100-Point Hybrid Score Breakdown (Flush Cell when Time-Warp >= D+1) */}
        {liveScore && liveSettlement && (
          <div
            className="p-4"
            style={{
              backgroundColor: 'var(--v-canvas-soft)',
              borderBottom: '1px solid var(--v-hairline)',
            }}
          >
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <span
                  className="v-caption-mono uppercase"
                  style={{ color: 'var(--v-mute)' }}
                >
                  Hybrid settlement ({actualCloses.length}/5d)
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span
                    className="v-mono text-2xl font-semibold"
                    style={{ color: 'var(--v-ink)' }}
                  >
                    {liveScore.total.toFixed(1)}
                  </span>
                  <span className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
                    / 100 · Grade {liveScore.grade}
                  </span>
                </div>
              </div>
              <span
                className="v-mono text-base font-semibold"
                style={{
                  color:
                    liveSettlement.deltaLp >= 0
                      ? 'var(--v-bull)'
                      : 'var(--v-bear)',
                }}
              >
                {formatSignedLp(liveSettlement.deltaLp)}
              </span>
            </div>

            <div className="space-y-2">
              {[
                {
                  label: 'Path skill',
                  val: liveScore.pathScore,
                  max: 50,
                  color: 'var(--v-link)',
                },
                {
                  label: 'Direction',
                  val: liveScore.directionScore,
                  max: 30,
                  color: 'var(--v-bull)',
                },
                {
                  label: 'Target precision',
                  val: liveScore.targetScore,
                  max: 20,
                  color: 'var(--v-primary)',
                },
              ].map(row => (
                <div key={row.label} className="grid grid-cols-12 items-center gap-2">
                  <span
                    className="col-span-5 v-caption-mono"
                    style={{ color: 'var(--v-body)' }}
                  >
                    {row.label}
                  </span>
                  <div
                    className="col-span-4 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--v-hairline)' }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${(row.val / row.max) * 100}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                  <span
                    className="col-span-3 v-caption-mono text-right"
                    style={{ color: 'var(--v-ink)' }}
                  >
                    {row.val.toFixed(1)}/{row.max}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flush 5-Day Coordinate Matrix (Edge-to-Edge Hairline Rows) */}
        <div style={{ borderBottom: '1px solid var(--v-hairline)' }}>
          <div
            className="px-4 py-2 flex items-center justify-between"
            style={{
              backgroundColor: 'var(--v-canvas-soft)',
              borderBottom: '1px solid var(--v-hairline-subtle)',
            }}
          >
            <span className="v-caption-mono uppercase" style={{ color: 'var(--v-mute)' }}>
              Node vector (D+1..D+5)
            </span>
            <span className="v-caption-mono" style={{ color: 'var(--v-mute)' }}>
              Anchor ${basePrice.toFixed(2)}
            </span>
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--v-hairline-subtle)' }}>
            {evalDates.map((d, idx) => {
              const price = activePrices[idx] ?? basePrice;
              const pct =
                basePrice > 0 ? ((price - basePrice) / basePrice) * 100 : 0;
              const actualClose = actualCloses[idx];

              return (
                <div
                  key={d}
                  className="px-4 py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="v-mono text-xs font-medium w-7"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      D+{idx + 1}
                    </span>
                    <span
                      className="v-caption-mono"
                      style={{ color: 'var(--v-mute)' }}
                    >
                      {d}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className="v-mono text-xs font-medium"
                      style={{ color: 'var(--v-ink)' }}
                    >
                      ${price.toFixed(2)}
                    </span>
                    <span
                      className="v-mono text-xs w-14 text-right"
                      style={{
                        color: pct >= 0 ? 'var(--v-bull)' : 'var(--v-bear)',
                      }}
                    >
                      {pct >= 0 ? '+' : ''}
                      {pct.toFixed(2)}%
                    </span>

                    {!lockedForecast ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => adjustSingleNode(idx, -0.5)}
                          className="w-5 h-5 rounded-[4px] v-mono text-xs flex items-center justify-center"
                          style={{
                            backgroundColor: 'var(--v-canvas-soft)',
                            boxShadow: 'var(--v-shadow-border)',
                            color: 'var(--v-body)',
                          }}
                          title="-0.5%"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustSingleNode(idx, 0.5)}
                          className="w-5 h-5 rounded-[4px] v-mono text-xs flex items-center justify-center"
                          style={{
                            backgroundColor: 'var(--v-canvas-soft)',
                            boxShadow: 'var(--v-shadow-border)',
                            color: 'var(--v-body)',
                          }}
                          title="+0.5%"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      actualClose !== undefined && (
                        <span
                          className="v-caption-mono"
                          style={{ color: 'var(--v-mute)' }}
                        >
                          Act ${actualClose.toFixed(1)}
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Mint / CLI Deployment Cell */}
      <div className="p-4">
        {lockedForecast ? (
          <div className="space-y-3">
            <div
              className="p-3 rounded-[6px] v-caption-mono space-y-1"
              style={{
                backgroundColor: 'var(--v-canvas-soft)',
                boxShadow: 'var(--v-shadow-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--v-mute)' }}>
                  $ stoxdraw verify --id {lockedForecast.id.slice(0, 8)}
                </span>
                <span style={{ color: 'var(--v-bull)' }}>LOCKED</span>
              </div>
              <p className="truncate" style={{ color: 'var(--v-body)' }}>
                thesis: {lockedForecast.comment || 'none'}
              </p>
              <p className="truncate" style={{ color: 'var(--v-ink)' }} title={digestHash}>
                fnv1a: {digestHash}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenShareModal(lockedForecast)}
              className="v-btn-primary w-full"
            >
              Export verified receipt
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitLock} className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {CATALYST_TAGS.map(tag => {
                const active = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className="px-2 py-0.5 rounded-[4px] v-caption-mono transition"
                    style={{
                      backgroundColor: active
                        ? 'var(--v-primary)'
                        : 'var(--v-canvas-soft)',
                      color: active ? 'var(--v-on-primary)' : 'var(--v-mute)',
                      boxShadow: active ? 'none' : 'var(--v-shadow-border)',
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <input
              id="studio-thesis-input"
              type="text"
              maxLength={120}
              value={thesisText}
              onChange={e => setThesisText(e.target.value)}
              placeholder={`Directional thesis for ${ticker} ($${finalPrice.toFixed(2)})...`}
              className="w-full h-8 px-3 rounded-[6px] text-xs outline-none"
              style={{
                backgroundColor: 'var(--v-canvas-soft)',
                boxShadow: 'var(--v-shadow-border)',
                color: 'var(--v-ink)',
              }}
            />

            {/* Authentic Vercel Build/Deployment CLI Log Preview */}
            <div
              className="p-2.5 rounded-[6px] v-caption-mono space-y-0.5"
              style={{
                backgroundColor: 'var(--v-canvas-soft)',
                boxShadow: 'var(--v-shadow-border)',
              }}
            >
              <p style={{ color: 'var(--v-mute)' }}>
                ▲ stoxdraw lock --ticker {ticker} --horizon 5d
              </p>
              <p className="truncate" style={{ color: 'var(--v-body)' }}>
                vector [{vectorSummary}]
              </p>
              <p className="truncate" style={{ color: 'var(--v-dim)' }} title={digestHash}>
                sha/fnv {digestHash.slice(0, 26)}...
              </p>
            </div>

            <button type="submit" className="v-btn-primary w-full">
              {duelTarget
                ? `Deploy counter-draw vs @${duelTarget.handle}`
                : `Deploy immutable ${ticker} trajectory`}
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
