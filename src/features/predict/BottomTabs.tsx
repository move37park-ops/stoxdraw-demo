import { memo } from 'react';
import { Lock } from 'lucide-react';
import { ParticipantsTable } from './ParticipantsTable';
import { BTC_DAILY_VOLATILITY } from '../../data/btcMarket';
import { useI18n } from '../../lib/i18nCore';
import type { DailyConsensusBandPoint } from '../../domain/crowd';
import type { Forecast, MarketBar } from '../../domain/types';
import type { OverlayRival } from './PathCanvas';

interface BottomTabsProps {
  basePrice?: number;
  baseDate?: string;
  expiryDate?: string;
  historyBars?: MarketBar[];
  roundStatus?: 'OPEN' | 'LIVE' | 'RESOLVED';
  isConsensusUnlocked: boolean;
  myForecast: Forecast | null;
  userPrices?: number[];
  forecasts: Forecast[];
  consensusBand?: DailyConsensusBandPoint[];
  overlaidRivals: OverlayRival[];
  settledCloses?: number[];
  realizedDailyVol?: number;
  settledCount?: number;
  actualLatestPrice?: number | null;
  actualLatestChangePct?: number | null;
  avgRoundScore?: number | null;
  leaderHandle?: string | null;
  onToggleOverlay: (forecast: Forecast, handle: string, elo: number) => void;
  onRemoveOverlay: (forecastId: string) => void;
  onNavigateProfile: (handle: string) => void;
  onNavigateDetail: (forecastId: string) => void;
  onSelectTargetPrice?: (price: number) => void;
}

const EMPTY_CLOSES: number[] = [];

export const BottomTabs = memo(function BottomTabs({
  roundStatus = 'OPEN',
  isConsensusUnlocked,
  myForecast,
  forecasts,
  overlaidRivals,
  settledCloses = EMPTY_CLOSES,
  realizedDailyVol = BTC_DAILY_VOLATILITY,
  onToggleOverlay,
  onRemoveOverlay,
  onNavigateProfile,
  onNavigateDetail,
}: BottomTabsProps) {
  const { t } = useI18n();

  return (
    <section
      className="w-full mt-2"
      style={{
        backgroundColor: 'var(--op-canvas)',
        borderTop: '1px solid var(--op-line)',
      }}
    >
      {/* Single Compact Header Bar Above Participant Table */}
      <div
        className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3"
        style={{
          backgroundColor: 'var(--op-canvas)',
          borderBottom: '1px solid var(--op-line)',
        }}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--op-ink)' }}>
            {t(`참여자 예측 현황 (${forecasts.length}명)`, `Participants (${forecasts.length})`)}
          </h2>

          {overlaidRivals.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {overlaidRivals.map(r => (
                <span
                  key={r.forecast.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] op-mono text-[11px]"
                  style={{
                    backgroundColor: 'var(--op-panel)',
                    border: '1px solid var(--op-line-strong)',
                    color: 'var(--op-ink)',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-[1px]"
                    style={{ backgroundColor: r.colorVar }}
                    aria-hidden="true"
                  />
                  @{r.authorHandle}
                  <button
                    type="button"
                    onClick={() => onRemoveOverlay(r.forecast.id)}
                    className="ml-0.5 hover:opacity-75 cursor-pointer"
                    aria-label={t(
                      `${r.authorHandle} 경로 겹쳐 보기 해제`,
                      `Remove ${r.authorHandle} overlay`
                    )}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <span
          className="text-[12px] inline-flex items-center gap-1.5"
          style={{
            color:
              roundStatus === 'OPEN' && !isConsensusUnlocked
                ? 'var(--op-ink-3)'
                : 'var(--op-ink-2)',
          }}
        >
          {roundStatus === 'OPEN' && !isConsensusUnlocked ? (
            <>
              <Lock size={11} aria-hidden="true" />
              {t('블라인드 모드 · 내 예측 제출 후 공개', 'Blind Mode · Unlocks after submission')}
            </>
          ) : (
            t('차트에 최대 3명까지 경로 겹쳐 보기 가능', 'Overlay up to 3 paths on the chart')
          )}
        </span>
      </div>

      <div className="p-4 sm:p-6" style={{ backgroundColor: 'var(--op-canvas)' }}>
        <ParticipantsTable
          forecasts={forecasts}
          isConsensusUnlocked={isConsensusUnlocked}
          roundStatus={roundStatus}
          settledCloses={settledCloses}
          realizedDailyVol={realizedDailyVol}
          myForecastId={myForecast?.id}
          overlaidRivals={overlaidRivals}
          onToggleOverlay={(fc, handle, elo) => {
            if (!isConsensusUnlocked) return;
            onToggleOverlay(fc, handle, elo);
          }}
          onNavigateProfile={onNavigateProfile}
          onNavigateDetail={onNavigateDetail}
        />
      </div>
    </section>
  );
});
