import { memo, useState, useRef, useLayoutEffect, type KeyboardEvent } from 'react';
import { OverviewReport } from './OverviewReport';
import { DeepReport } from './DeepReport';
import { ParticipantsTable } from './ParticipantsTable';
import { useI18n } from '../../lib/i18nCore';
import type { DailyConsensusBandPoint } from '../../domain/crowd';
import type { Forecast, MarketBar } from '../../domain/types';
import type { OverlayRival } from './PathCanvas';

interface BottomTabsProps {
  basePrice: number;
  baseDate: string;
  expiryDate: string;
  historyBars: MarketBar[];
  isConsensusUnlocked: boolean;
  myForecast: Forecast | null;
  userPrices: number[];
  forecasts: Forecast[];
  consensusBand: DailyConsensusBandPoint[];
  overlaidRivals: OverlayRival[];
  onToggleOverlay: (forecast: Forecast, handle: string, elo: number) => void;
  onRemoveOverlay: (forecastId: string) => void;
  onNavigateProfile: (handle: string) => void;
  onNavigateDetail: (forecastId: string) => void;
  onSelectTargetPrice: (price: number) => void;
}

type BottomTabId = 'report' | 'participants';

export const BottomTabs = memo(function BottomTabs({
  basePrice,
  baseDate,
  expiryDate,
  historyBars,
  isConsensusUnlocked,
  myForecast,
  userPrices,
  forecasts,
  consensusBand,
  overlaidRivals,
  onToggleOverlay,
  onRemoveOverlay,
  onNavigateProfile,
  onNavigateDetail,
  onSelectTargetPrice,
}: BottomTabsProps) {
  const { locale, t } = useI18n();
  const [activeTab, setActiveTab] = useState<BottomTabId>('report');
  const tabBarRef = useRef<HTMLDivElement>(null);
  const reportTabRef = useRef<HTMLButtonElement>(null);
  const participantsTabRef = useRef<HTMLButtonElement>(null);
  const [tabRect, setTabRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, ready: false });

  useLayoutEffect(() => {
    const syncTabRect = () => {
      const el = activeTab === 'report' ? reportTabRef.current : participantsTabRef.current;
      if (!el) return;
      setTabRect({
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
        ready: el.offsetWidth > 0,
      });
    };

    syncTabRect();
    const bar = tabBarRef.current;
    let observer: ResizeObserver | null = null;
    if (bar && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncTabRect);
      observer.observe(bar);
    }
    window.addEventListener('resize', syncTabRect);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', syncTabRect);
    };
  }, [activeTab, forecasts.length, locale, isConsensusUnlocked]);

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, current: BottomTabId) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next: BottomTabId = current === 'report' ? 'participants' : 'report';
      setActiveTab(next);
      (next === 'report' ? reportTabRef.current : participantsTabRef.current)?.focus();
    }
  };

  return (
    <section
      className="w-full mt-2"
      style={{
        backgroundColor: 'var(--op-canvas)',
        borderTop: '1px solid var(--op-line)',
      }}
    >
      {/* Clean 2-Tab Bar with Flat Pill & Sliding Orange Underline */}
      <div
        className="px-4 sm:px-6 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar"
        style={{
          backgroundColor: 'var(--op-canvas)',
          borderBottom: '1px solid var(--op-line)',
        }}
      >
        <div
          ref={tabBarRef}
          role="tablist"
          aria-label={t('시장 분석 및 참여자 탭', 'Market intelligence and participants tabs')}
          className="relative flex items-center gap-1"
        >
          <span
            aria-hidden="true"
            className="op-sliding-glow"
            style={{
              transform: `translate3d(${tabRect.left}px, ${tabRect.top + 6}px, 0)`,
              width: `${tabRect.width}px`,
              height: `${Math.max(0, tabRect.height - 12)}px`,
              opacity: tabRect.ready ? 1 : 0,
            }}
          />
          <span
            aria-hidden="true"
            className="op-sliding-underline"
            style={{
              transform: `translate3d(${tabRect.left}px, 0, 0)`,
              width: `${tabRect.width}px`,
              opacity: tabRect.ready ? 1 : 0,
            }}
          />

          <button
            ref={reportTabRef}
            id="bottom-tab-report"
            role="tab"
            aria-selected={activeTab === 'report'}
            aria-controls="bottom-tabpanel-report"
            type="button"
            data-active={activeTab === 'report'}
            onClick={() => setActiveTab('report')}
            onKeyDown={e => handleTabKeyDown(e, 'report')}
            className="op-tab relative z-10 whitespace-nowrap"
          >
            <span>
              {isConsensusUnlocked
                ? t('집단 분석 리포트', 'Consensus Report')
                : t('시장 변동성 개요', 'Market Overview')}
            </span>
          </button>

          <button
            ref={participantsTabRef}
            id="bottom-tab-participants"
            role="tab"
            aria-selected={activeTab === 'participants'}
            aria-controls="bottom-tabpanel-participants"
            type="button"
            data-active={activeTab === 'participants'}
            onClick={() => setActiveTab('participants')}
            onKeyDown={e => handleTabKeyDown(e, 'participants')}
            className="op-tab relative z-10 whitespace-nowrap"
          >
            <span>{t('참여자 현황', 'Participants')}</span>
          </button>
        </div>

        <span
          className="text-[12px] hidden sm:inline whitespace-nowrap"
          style={{ color: isConsensusUnlocked ? 'var(--op-bull)' : 'var(--op-ink-3)' }}
        >
          {isConsensusUnlocked
            ? t(
                '제출 완료 · 집단 리포트 및 참여자 궤적 잠금 해제됨',
                'Locked In · Consensus report & peer paths unlocked'
              )
            : t(
                '블라인드 모드 · 경로 제출 후 타인 예측과 분포 리포트가 열립니다',
                'Blind Mode · Submit your path to reveal crowd bands & peer calls'
              )}
        </span>
      </div>

      {/* Tab Body */}
      <div
        key={activeTab}
        role="tabpanel"
        id={activeTab === 'report' ? 'bottom-tabpanel-report' : 'bottom-tabpanel-participants'}
        aria-labelledby={activeTab === 'report' ? 'bottom-tab-report' : 'bottom-tab-participants'}
        className="op-view-enter"
      >
        {activeTab === 'report' &&
          (isConsensusUnlocked ? (
            <DeepReport
              basePrice={basePrice}
              userPrices={userPrices}
              myForecast={myForecast}
              forecasts={forecasts}
              consensusBand={consensusBand}
              overlaidRivals={overlaidRivals}
              isSubmitted={isConsensusUnlocked}
              onRemoveOverlay={onRemoveOverlay}
              onSelectTargetPrice={onSelectTargetPrice}
            />
          ) : (
            <OverviewReport
              basePrice={basePrice}
              baseDate={baseDate}
              expiryDate={expiryDate}
              historyBars={historyBars}
            />
          ))}

        {activeTab === 'participants' && (
          <ParticipantsTable
            forecasts={forecasts}
            isConsensusUnlocked={isConsensusUnlocked}
            myForecastId={myForecast?.id}
            overlaidRivals={overlaidRivals}
            onToggleOverlay={(fc, handle, elo) => {
              if (!isConsensusUnlocked) return;
              onToggleOverlay(fc, handle, elo);
            }}
            onNavigateProfile={onNavigateProfile}
            onNavigateDetail={onNavigateDetail}
          />
        )}
      </div>
    </section>
  );
});
