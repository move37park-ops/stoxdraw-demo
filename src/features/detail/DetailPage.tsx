import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ThumbsUp,
  Share2,
  ArrowLeft,
  History,
  ShieldCheck,
} from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getStockHistory } from '../../data/market';
import { BTC_DAILY_VOLATILITY } from '../../data/btcMarket';
import { deriveForecastStatus } from '../../domain/lifecycle';
import { resolveForecast } from '../../domain/resolution';
import { aggregateCrowd } from '../../domain/crowd';
import {
  buildDailySettlementRows,
  computeForecastDigest,
} from '../../domain/audit';
import {
  calculateEloProjection,
  DEFAULT_ELO,
  formatSignedLp,
  getEloTierInfo,
} from '../../domain/elo';
import { formatPct } from '../../domain/format';
import { Polyline20DCanvas } from '../studio/Polyline20DCanvas';
import { ShareTicketModal } from '../../components/ShareTicketModal';
import type { AnchorPoint, Forecast } from '../../domain/types';

interface DetailPageProps {
  currentDateStr: string;
  onDateChange?: (date: string) => void;
}

export function DetailPage({ currentDateStr }: DetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [rawForecast, setRawForecast] = useState<Forecast | undefined>(() =>
    id ? repository.getForecast(id) : undefined
  );
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [, setLikeTick] = useState(0);

  const reloadData = useCallback(() => {
    if (!id) return;
    setRawForecast(repository.getForecast(id));
  }, [id]);

  useEffect(() => {
    reloadData();
    const unsub = repository.subscribe(reloadData);
    return () => unsub();
  }, [reloadData, currentDateStr]);

  // 해당 예측 라운드의 D-0, D+5, D+10, D+20 시점 스텝 구성
  const roundTimeSteps = useMemo(() => {
    if (!rawForecast) return [];
    const evals = rawForecast.evalDates || [];
    return [
      { code: 'D-0', date: rawForecast.baseDate },
      { code: 'D+5', date: evals[4] || rawForecast.baseDate },
      { code: 'D+10', date: evals[9] || rawForecast.baseDate },
      { code: 'D+20', date: evals[evals.length - 1] || rawForecast.baseDate },
    ];
  }, [rawForecast]);

  // 상세/궤적 보기 진입 시 기본적으로 20일 정산 완료 시점(D+20) 캔들과 궤적이 함께 보이도록 설정
  const [viewDateStr, setViewDateStr] = useState<string>(() => {
    if (!rawForecast) return currentDateStr;
    const lastEval = rawForecast.evalDates?.[rawForecast.evalDates.length - 1];
    if (currentDateStr > rawForecast.baseDate) return currentDateStr;
    return lastEval || currentDateStr;
  });

  useEffect(() => {
    if (!rawForecast) return;
    const lastEval = rawForecast.evalDates?.[rawForecast.evalDates.length - 1];
    if (currentDateStr > rawForecast.baseDate) {
      setViewDateStr(currentDateStr);
    } else if (lastEval) {
      setViewDateStr(lastEval);
    }
  }, [rawForecast?.id, currentDateStr]);

  if (!rawForecast) {
    return (
      <div className="p-16 text-center space-y-4">
        <p className="v-heading-16" style={{ color: 'var(--v-ink)' }}>
          예측을 찾을 수 없습니다.
        </p>
        <button
          type="button"
          onClick={() => navigate('/studio')}
          className="v-btn-primary"
        >
          실전 모드로 돌아가기
        </button>
      </div>
    );
  }

  const stockBars = getStockHistory(rawForecast.ticker);
  const historyBars = stockBars
    .filter(b => b.date <= rawForecast.baseDate)
    .slice(-180);

  // D-0 마지막 일봉 종가와 예측 시작 기준가(basePrice)를 1:1로 동기화하여 궤적 시작점이 항상 D-0 캔들에 정확히 맞닿도록 보정
  const actualD0Close =
    historyBars.length > 0
      ? historyBars[historyBars.length - 1].close
      : rawForecast.basePrice;
  const priceScale =
    rawForecast.basePrice > 0 ? actualD0Close / rawForecast.basePrice : 1;

  const forecast: Forecast = useMemo(() => {
    if (Math.abs(priceScale - 1) < 1e-5) return rawForecast;
    return {
      ...rawForecast,
      basePrice: actualD0Close,
      anchors: rawForecast.anchors?.map(a => ({
        day: a.day,
        price: parseFloat((a.price * priceScale).toFixed(2)),
      })),
      path: rawForecast.path?.map(p => ({
        date: p.date,
        price: parseFloat((p.price * priceScale).toFixed(2)),
      })),
      versions: rawForecast.versions?.map(v => ({
        ...v,
        anchors: v.anchors.map(a => ({
          day: a.day,
          price: parseFloat((a.price * priceScale).toFixed(2)),
        })),
        prices: v.prices.map(p => parseFloat((p * priceScale).toFixed(2))),
      })),
    };
  }, [rawForecast, actualD0Close, priceScale]);

  const author = forecast.authorId
    ? repository.getUser(forecast.authorId)
    : null;
  const authorHandle = author
    ? author.handle
    : `guest_${forecast.anonId.replace(/^anon[_-]?/i, '').slice(0, 4) || 'user'}`;
  const authorElo = author?.elo ?? DEFAULT_ELO;

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

  const result = resolveForecast(
    forecast,
    visibleBars,
    crowd.consensusChangePct
  );
  const settledElo = result.eloSettlement
    ? authorElo + result.eloSettlement.deltaLp
    : authorElo;
  const authorTier = getEloTierInfo(settledElo);

  const eloProjection = calculateEloProjection(
    result.forecastChangePct,
    crowd.consensusChangePct,
    BTC_DAILY_VOLATILITY,
    forecast.evalDates.length
  );

  const settlementRows = buildDailySettlementRows(
    forecast,
    stockBars,
    viewDateStr
  );

  const digestHash = computeForecastDigest(forecast);

  const displayAnchors: AnchorPoint[] = (() => {
    if (forecast.anchors && forecast.anchors.length > 0) {
      return forecast.anchors;
    }
    const pts = forecast.path || [];
    if (pts.length > 0) {
      return [{ day: pts.length, price: pts[pts.length - 1].price }];
    }
    return [{ day: 20, price: forecast.basePrice }];
  })();

  const initialVersion =
    forecast.versions && forecast.versions.length > 1
      ? forecast.versions[0]
      : null;

  return (
    <div className="w-full relative">
      <span className="v-crosshair -top-[5px] -left-[6px]" aria-hidden="true" />
      <span className="v-crosshair -top-[5px] -right-[6px]" aria-hidden="true" />

      {/* Top Receipt Masthead Band */}
      <section
        className="relative px-5 py-4 flex flex-wrap items-center justify-between gap-4"
        style={{ borderBottom: '1px solid var(--v-hairline)' }}
      >
        <span className="v-crosshair -bottom-[6px] -left-[6px]" aria-hidden="true" />
        <span className="v-crosshair -bottom-[6px] -right-[6px]" aria-hidden="true" />

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="v-btn-secondary h-7 px-2 text-xs"
            >
              <ArrowLeft size={12} />
              뒤로
            </button>
            <span
              className="v-caption-mono px-2 py-0.5 rounded-[4px]"
              style={{
                backgroundColor: 'var(--v-canvas-soft-2)',
                color: 'var(--v-mute)',
              }}
            >
              {status === 'RESOLVED' ? '정산 완료' : status === 'LIVE' ? '진행 중' : status}
            </span>
            <span
              className="v-caption-mono"
              style={{ color: 'var(--v-mute)' }}
            >
              기준일: {forecast.baseDate} · 해시: {digestHash.slice(0, 14)}...
            </span>
          </div>

          <h1 className="v-display-md" style={{ color: 'var(--v-ink)' }}>
            @{authorHandle} · {forecast.ticker} {forecast.evalDates.length}일 예측
          </h1>
          <p className="v-caption" style={{ color: 'var(--v-body)' }}>
            {forecast.comment}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 mr-1">
            {roundTimeSteps.map(s => (
              <button
                key={s.code}
                type="button"
                onClick={() => setViewDateStr(s.date)}
                className="v-btn-secondary h-7 px-2 text-[11px]"
                style={{
                  backgroundColor:
                    s.date === viewDateStr
                      ? 'var(--v-primary)'
                      : 'var(--v-canvas)',
                  color:
                    s.date === viewDateStr
                      ? 'var(--v-on-primary)'
                      : 'var(--v-ink)',
                }}
              >
                {s.code}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              repository.toggleLike(forecast.id);
              setLikeTick(t => t + 1);
            }}
            className="v-btn-secondary h-8 px-3 text-xs"
            style={{
              color: isLiked ? 'var(--v-link)' : 'var(--v-ink)',
            }}
          >
            <ThumbsUp size={12} />
            추천 ({likesCount})
          </button>

          <button
            type="button"
            onClick={() => setIsShareOpen(true)}
            className="v-btn-primary h-8 px-3 text-xs font-semibold"
          >
            <Share2 size={12} />
            공유 카드
          </button>
        </div>
      </section>

      {/* Canvas Replay View */}
      <section style={{ borderBottom: '1px solid var(--v-hairline)' }}>
        <Polyline20DCanvas
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
          allForecasts={sameRoundForecasts}
          initialVersion={initialVersion}
          headerSubtitle="예측 궤적 · 시장 중앙값 · 실제 20일 일봉 비교"
        />
      </section>

      {/* Flush Architectural Grid: Left 5 Cols Version Ledger | Right 7 Cols 20-Day Daily Audit Matrix */}
      <section className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left 5 Cols */}
        <div
          className="lg:col-span-5 divide-y divide-[var(--v-hairline)]"
          style={{ borderRight: '1px solid var(--v-hairline)' }}
        >
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ backgroundColor: 'var(--v-canvas-soft)' }}
          >
            <span
              className="v-body-sm-strong flex items-center gap-1.5"
              style={{ color: 'var(--v-ink)' }}
            >
              <ShieldCheck size={14} style={{ color: 'var(--v-bull)' }} />
              예측 요약 및 채점 성적표
            </span>
            <span
              className="v-caption-mono px-2 py-0.5 rounded-[4px] inline-flex items-center gap-1.5"
              style={{
                backgroundColor: 'var(--v-canvas)',
                boxShadow: 'var(--v-shadow-border)',
                color: 'var(--v-ink)',
              }}
            >
              <span
                className="w-2 h-2 rounded-[1.5px] flex-shrink-0"
                style={{ backgroundColor: authorTier.accentHex }}
              />
              {authorTier.krTitle} ({settledElo.toLocaleString('en-US')} LP)
            </span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-[var(--v-hairline)]">
            <div className="p-4">
              <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                예측 목표 수익률
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
                실제 진행 수익률
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
                점수
              </p>
              <p
                className="v-mono text-lg font-bold mt-0.5"
                style={{ color: 'var(--v-link)' }}
              >
                {result.score
                  ? `${result.score.total}점 (등급 ${result.score.grade})`
                  : '집계 대기 (D-0)'}
              </p>
            </div>
            <div className="p-4">
              <p className="v-caption" style={{ color: 'var(--v-mute)' }}>
                평판 LP 변동
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
              style={{ backgroundColor: 'var(--v-canvas-soft-2)' }}
            >
              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between v-caption-mono text-xs">
                  <span style={{ color: 'var(--v-mute)' }}>경로 (50)</span>
                  <strong style={{ color: 'var(--v-ink)' }}>
                    {result.score.pathScore}
                  </strong>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--v-canvas)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(result.score.pathScore / 50) * 100}%`,
                      backgroundColor: 'var(--v-bull)',
                    }}
                  />
                </div>
              </div>

              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between v-caption-mono text-xs">
                  <span style={{ color: 'var(--v-mute)' }}>방향 (30)</span>
                  <strong style={{ color: 'var(--v-ink)' }}>
                    {result.score.directionScore}
                  </strong>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--v-canvas)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(result.score.directionScore / 30) * 100}%`,
                      backgroundColor: 'var(--v-link)',
                    }}
                  />
                </div>
              </div>

              <div className="p-3 space-y-1">
                <div className="flex items-center justify-between v-caption-mono text-xs">
                  <span style={{ color: 'var(--v-mute)' }}>목표 (20)</span>
                  <strong style={{ color: 'var(--v-ink)' }}>
                    {result.score.targetScore}
                  </strong>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--v-canvas)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(result.score.targetScore / 20) * 100}%`,
                      backgroundColor: 'var(--v-warning)',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Version History Header */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ backgroundColor: 'var(--v-canvas-soft)' }}
          >
            <h3
              className="v-body-sm-strong flex items-center gap-1.5"
              style={{ color: 'var(--v-ink)' }}
            >
              <History size={14} style={{ color: 'var(--v-link)' }} />
              버전 기록
            </h3>
            <span className="v-caption-mono" style={{ color: 'var(--v-dim)' }}>
              Append-only
            </span>
          </div>

          <div className="divide-y divide-[var(--v-hairline-subtle)]">
            {(forecast.versions && forecast.versions.length > 0
              ? forecast.versions
              : [
                  {
                    version: 1,
                    createdAt: forecast.lockedAt,
                    anchors: displayAnchors,
                    prices: (forecast.path || []).map(p => p.price),
                    comment: forecast.comment,
                    digestHash,
                  },
                ]
            ).map(ver => {
              const lastP =
                ver.prices[ver.prices.length - 1] ?? forecast.basePrice;
              const pct =
                forecast.basePrice > 0
                  ? ((lastP - forecast.basePrice) / forecast.basePrice) * 100
                  : 0;
              return (
                <div key={ver.version} className="p-4 space-y-1">
                  <div className="flex items-center justify-between v-caption-mono">
                    <span
                      className="font-semibold"
                      style={{ color: 'var(--v-link)' }}
                    >
                      버전 v{ver.version} (
                      {ver.version === 1 ? '최초' : '수정'})
                    </span>
                    <span style={{ color: 'var(--v-ink)' }}>
                      목표 ${Math.round(lastP).toLocaleString('en-US')} (
                      {formatPct(pct)})
                    </span>
                  </div>
                  <p
                    className="v-caption text-[11px]"
                    style={{ color: 'var(--v-body)' }}
                  >
                    {ver.comment}
                  </p>
                  <p
                    className="v-caption-mono text-xs"
                    style={{ color: 'var(--v-mute)' }}
                  >
                    저장: {ver.createdAt.slice(0, 16).replace('T', ' ')} UTC · 해시:{' '}
                    {ver.digestHash.slice(0, 14)}...
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 7 Cols: 20-Day Daily Audit Matrix */}
        <div className="lg:col-span-7 overflow-x-auto">
          <table className="v-audit-table">
            <thead>
              <tr>
                <th>구간</th>
                <th>일자</th>
                <th className="v-numeric">보간 예측가</th>
                <th className="v-numeric">예측 등락</th>
                <th className="v-numeric">실제 종가</th>
                <th className="v-numeric">오차율</th>
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
                      : '미도래'}
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
