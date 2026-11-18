import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight } from 'lucide-react';
import { DEFAULT_ELO } from '../../domain/elo';
import { DEFAULT_HORIZON_DAYS, MAX_ANCHORS } from '../../domain/interpolation';
import { BTC_DAILY_VOLATILITY } from '../../data/btcMarket';
import { useI18n } from '../../lib/i18nCore';

type SectionId = 'overview' | 'drawing' | 'scoring' | 'elo' | 'report' | 'faq';

const SECTION_IDS: SectionId[] = ['overview', 'drawing', 'scoring', 'elo', 'report', 'faq'];

export function DocsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  const sections: { id: SectionId; num: string; label: string }[] = [
    { id: 'overview', num: '01', label: t('서비스 개요 및 진행 흐름', 'Overview & Core Loop') },
    { id: 'drawing', num: '02', label: t('차트 그리기 및 조작법', 'Chart Drawing & Controls') },
    { id: 'scoring', num: '03', label: t('100점 정량 평가 공식', '100-Point Evaluation Engine') },
    { id: 'elo', num: '04', label: t('평판 점수(LP) 및 등급', 'Reputation LP & Tiers') },
    { id: 'report', num: '05', label: t('집단 전망 지표 및 운영 원칙', 'Crowd Insights & Principles') },
    { id: 'faq', num: '06', label: t('자주 묻는 질문 (FAQ)', 'FAQ') },
  ];

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const elements = SECTION_IDS
      .map(id => document.getElementById(`docs-${id}`))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id.replace('docs-', '') as SectionId;
          setActiveSection(id);
        }
      },
      { rootMargin: '-84px 0px -65% 0px', threshold: 0.05 }
    );

    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    const el = document.getElementById(`docs-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const gradeRows = [
    {
      grade: 'S',
      color: 'var(--op-orange)',
      rule: t('총점 85.0점 이상 및 최종 방향(D+7) 적중', 'Total >= 85.0 & final D+7 direction hit'),
      meaning: t('예측 경로 · 흐름 · 최종 가격 모두 최상위 수준', 'High accuracy across path, shape, and target'),
    },
    {
      grade: 'A',
      color: 'var(--op-bull)',
      rule: t('총점 72.0점 이상', 'Total >= 72.0'),
      meaning: t('주요 흐름과 예측 종료 가격대를 안정적으로 적중', 'Consistent tracking of direction and target zone'),
    },
    {
      grade: 'B',
      color: '#52a8ff',
      rule: t('총점 58.0점 이상', 'Total >= 58.0'),
      meaning: t('변동 없는 기준선 대비 양호한 방향성 확보', 'Solid directional edge over flat baseline'),
    },
    {
      grade: 'C',
      color: 'var(--op-ink-2)',
      rule: t('총점 42.0점 이상', 'Total >= 42.0'),
      meaning: t('부분 구간 일치, 변동폭 또는 타이밍 오차 존재', 'Partial alignment with timing or magnitude error'),
    },
    {
      grade: 'D',
      color: 'var(--op-ink-3)',
      rule: t('총점 25.0점 이상', 'Total >= 25.0'),
      meaning: t('실제 흐름과 상당 부분 차이', 'Material divergence from realized close path'),
    },
    {
      grade: 'F',
      color: 'var(--op-bear)',
      rule: t('총점 25.0점 미만', 'Total < 25.0'),
      meaning: t('방향 역행 및 최종 가격 오차 큼', 'Opposite trend with large terminal error'),
    },
  ];

  const tierRows = [
    { tier: 'DIAMOND', koTier: '다이아몬드', range: '1,800+ LP', color: '#3291ff', note: t('최상위 예측자 등급', 'Top forecaster tier') },
    { tier: 'PLATINUM', koTier: '플래티넘', range: '1,600 – 1,799 LP', color: '#00e599', note: t('장기 고승률 등급', 'High-consistency band') },
    { tier: 'GOLD', koTier: '골드', range: '1,400 – 1,599 LP', color: '#f5a623', note: t('평균 이상 숙련 등급', 'Above-average performance') },
    { tier: 'SILVER', koTier: '실버', range: '1,200 – 1,399 LP', color: '#a1a1aa', note: t(`기본 시작 등급 (${DEFAULT_ELO.toLocaleString()} LP)`, `Starting rating (${DEFAULT_ELO.toLocaleString()} LP)`) },
    { tier: 'BRONZE', koTier: '브론즈', range: '600 – 1,199 LP', color: '#71717a', note: t('입문 및 재도전 등급', 'Entry & calibration band') },
  ];

  const controlRows = [
    {
      key: t('차트 클릭', 'Click Chart'),
      scope: t('D0 오른쪽 미래 영역', 'Right of D0 future zone'),
      desc: t(`원하는 날짜와 가격에 예측 지점을 추가합니다 (최대 ${MAX_ANCHORS}개). D+7 종료 지점까지 연결되면 제출 버튼이 활성화됩니다.`, `Adds an anchor point at the selected day and price (max ${MAX_ANCHORS}). Reaching D+7 enables submission.`),
    },
    {
      key: t('지점 드래그', 'Drag Anchor'),
      scope: t('이미 찍은 주황색 지점', 'Existing orange anchors'),
      desc: t('가격과 날짜를 원하는 위치로 실시간 이동합니다. 같은 날짜로 겹치면 해당 일자 값이 최신 위치로 갱신됩니다.', 'Repositions anchor day and price smoothly. Overlapping the same day replaces that day cleanly.'),
    },
    {
      key: t('스크롤 / 툴바', 'Scroll / Toolbar'),
      scope: t('차트 영역 및 우측 가격축', 'Canvas plot and Y-axis'),
      desc: t('차트 위에서 마우스 휠로 표시 기간(7D~240D)을 즉시 조절하고, 우측 가격축을 스크롤·드래그해 세로 변동폭 배율을 조절할 수 있습니다.', 'Scroll directly on the chart to zoom historical lookback (7D–240D), or scroll and drag the right price axis to adjust vertical scaling.'),
    },
    {
      key: t('선 / 캔들 차트', 'Line / Candles'),
      scope: t('차트 상단 툴바', 'Chart top toolbar'),
      desc: t('과거 일봉을 종가 선 차트 또는 OHLC 캔들 차트로 전환해 추세와 변동폭을 함께 확인할 수 있습니다.', 'Toggles past market bars between close line chart and OHLC candlestick chart.'),
    },
    {
      key: t('예측 경로 예시', 'Preset Paths'),
      scope: t('우측 제출 패널', 'Right submission panel'),
      desc: t('하락 후 반등, 꾸준한 상승 등 대표 흐름을 먼저 불러온 뒤 예측 지점만 미세 조정해 제출할 수 있습니다.', 'Loads canonical forecast curves such as Dip & Rally so you can tweak points directly.'),
    },
  ];

  const faqs = [
    {
      q: t('이미 예측을 제출했는데 예측 경로를 수정할 수 있나요?', 'Can I edit my forecast path after submitting?'),
      a: t(
        '아니요. 집단 전망 범위와 상위 예측자 경로가 즉시 공개되므로 후행 편승(따라 그리기)을 막기 위해 라운드당 1회 제출 후 수정 불가 원칙을 적용합니다. 매일 새로운 7일 예측 라운드가 열리므로 새 전망은 다음 라운드에서 제출하실 수 있습니다.',
        'No. Because crowd insights and top forecaster paths unlock immediately upon submission, each round permits one locked submission to prevent hindsight copying. Fresh 7-day rounds open daily.'
      ),
    },
    {
      q: t('왜 제출 전에는 다른 참여자의 예측을 볼 수 없나요?', 'Why are other participants hidden before I submit?'),
      a: t(
        '군집 편향(먼저 공개된 다수 의견이나 상위 예측자 경로를 그대로 따라 그리는 현상)을 막기 위한 블라인드 규칙입니다. 내 예측 경로를 1회 제출하면 즉시 참여자 분포와 상위 예측자 경로가 열립니다.',
        'Blind Mode prevents herding bias before forming your own forecast. Submitting your forecast immediately reveals crowd distribution and top forecaster paths.'
      ),
    },
    {
      q: t('우측 하단 "시뮬레이션 시점" 버튼은 어떤 기능인가요?', 'What does the bottom-right "Preview Timeline" bar do?'),
      a: t(
        '실제로 7일을 기다리지 않고도 시간이 흐른 상태를 즉시 검증해 보는 시뮬레이션 제어기입니다. 오늘 · 2일 뒤 · 4일 뒤 · 예측 종료를 선택하면 실제 BTC 종가가 차트에 순차 반영되고 일별 예측 점수와 LP 변동 결과를 바로 확인할 수 있습니다.',
        'It simulates progression from Today through +2D, +4D, and +7D End without waiting a full week, plotting realized BTC closes step by step alongside live scores and reputation LP deltas.'
      ),
    },
    {
      q: t('로그인하지 않아도 예측과 점수 확인이 가능한가요?', 'Do I need an account to draw and test my score?'),
      a: t(
        '아니요. 게스트(guest_xxxx) 상태로도 예측 경로 그리기, 제출, 집단 전망 열람 및 점수 계산을 모두 체험할 수 있으며, 상단 연결 버튼으로 계정을 연동하면 현재 브라우저 기록이 계정에 연결됩니다.',
        'No. Guest sessions can draw paths, submit forecasts, unlock reports, and view scores immediately. Connecting an account links your browser history to your handle.'
      ),
    },
  ];

  return (
    <div className="w-full op-view-enter px-4 sm:px-6 py-5 max-w-[1360px] mx-auto space-y-5">
      {/* Page Header Box */}
      <header
        className="p-4 sm:p-5 rounded-[2px] flex flex-wrap items-center justify-between gap-4"
        style={{
          backgroundColor: 'var(--op-panel)',
          border: '1px solid var(--op-line-strong)',
        }}
      >
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="op-kicker" style={{ color: 'var(--op-orange)' }}>
              ORANGE PATHS DOCS
            </span>
            <span
              className="op-mono text-[10.5px] px-1.5 py-0.5 rounded-[2px]"
              style={{
                backgroundColor: 'var(--op-canvas)',
                border: '1px solid var(--op-line)',
                color: 'var(--op-ink-3)',
              }}
            >
              BTC/USDT · {DEFAULT_HORIZON_DAYS}D PROTOCOL
            </span>
          </div>
          <h1 className="text-[20px] sm:text-[22px] font-bold tracking-tight" style={{ color: 'var(--op-ink)' }}>
            {t('평가 및 이용 규칙 가이드', 'Evaluation Rules & Guide')}
          </h1>
          <p className="text-[13.5px] max-w-2xl leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
            {t(
              '7일 비트코인 예측 경로 그리기 방법, 100점 정량 평가 수식, 평판 점수(LP) 산정 및 집단 전망 지표를 정리했습니다.',
              'Reference manual for 7-day BTC forecast path drawing, 100-point evaluation equations, reputation LP updates, and crowd insights.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="op-btn-primary h-9 px-3.5 text-[12.5px]"
          >
            <span>{t('예측하기 화면으로 이동', 'Go to Predict')}</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* Main 12-Col Layout: Sticky Left TOC + Right Technical Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Sticky Sidebar TOC */}
        <aside className="lg:col-span-3 lg:sticky lg:top-[72px]">
          <nav
            aria-label={t('문서 목차', 'Documentation sections')}
            className="p-3 rounded-[2px] space-y-1"
            style={{
              backgroundColor: 'var(--op-panel)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <div
              className="px-2.5 py-1.5 mb-1 flex items-center gap-2 op-kicker"
              style={{ borderBottom: '1px solid var(--op-line)' }}
            >
              <BookOpen size={12} style={{ color: 'var(--op-orange)' }} />
              <span>{t('목차', 'Contents')}</span>
            </div>

            {sections.map(sec => {
              const active = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => scrollToSection(sec.id)}
                  className="w-full text-left px-2.5 py-2 rounded-[2px] flex items-center gap-2 text-[12.5px] transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? 'var(--op-canvas)' : 'transparent',
                    borderLeft: `2px solid ${active ? 'var(--op-orange)' : 'transparent'}`,
                    color: active ? 'var(--op-ink)' : 'var(--op-ink-2)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span
                    className="op-mono text-[11px]"
                    style={{ color: active ? 'var(--op-orange)' : 'var(--op-ink-3)' }}
                  >
                    {sec.num}
                  </span>
                  <span className="truncate">{sec.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Documentation Content */}
        <div className="lg:col-span-9 space-y-5 min-w-0">
          {/* 01. Overview & Lifecycle */}
          <section
            id="docs-overview"
            className="p-5 rounded-[2px] space-y-4 scroll-mt-[72px]"
            style={{
              backgroundColor: 'var(--op-panel)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="op-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[2px]"
                style={{ backgroundColor: 'var(--op-orange-soft)', color: 'var(--op-orange)' }}
              >
                01
              </span>
              <h2 className="text-[16px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                {t('서비스 개요 및 진행 흐름', 'Overview & Core Loop')}
              </h2>
            </div>

            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
              {t(
                'Orange Paths는 7일 뒤 가격이 오를지 내릴지만 고르는 이진 선택이 아니라, 오늘(D0)부터 예측 종료일(D+7)까지 가격이 어떤 경로(눌림, 돌파, 횡보, 반전)로 움직일지 차트에 직접 그리는 7일 가격 예측 플랫폼입니다.',
                'Instead of binary up/down bets, Orange Paths lets you draw your expected 7-day forecast path from D0 to D+7—capturing interim pullbacks, breakouts, and terminal levels.'
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  phase: 'OPEN',
                  title: t('1. 예측 경로 그리기 및 제출', '1. Draw & Blind Submit'),
                  desc: t(
                    'D0 오른쪽 미래 영역에 최대 5개 예측 지점을 추가해 D+7 종료 지점까지 연결하고 제출합니다. 제출 전에는 다른 참여자의 예측이 가려집니다.',
                    'Add up to 5 anchor points in the future zone to reach D+7 and submit. Peer paths stay hidden until submission.'
                  ),
                },
                {
                  phase: 'LIVE',
                  title: t('2. 집단 비교 및 일별 확인', '2. Compare & Track'),
                  desc: t(
                    '제출 즉시 참여자 중앙값과 상위 예측자(1,500 LP 이상 또는 상위 25%) 경로가 열리며, 매일 실제 BTC 종가가 확정될 때마다 현재 예측 점수가 갱신됩니다.',
                    'Crowd median and Top Forecaster (1,500+ LP or top 25%) paths unlock upon submission, and interim scores update with each realized daily BTC close.'
                  ),
                },
                {
                  phase: 'RESOLVED',
                  title: t('3. D+7 예측 평가 및 LP 반영', '3. D+7 Evaluation & LP'),
                  desc: t(
                    '7일 종가가 모두 확정되면 예측 점수(0~100점)와 예측 등급(S~F)이 확정되고, 동일 라운드 상대 순위에 따라 평판 점수(LP)가 반영됩니다.',
                    'After all 7 daily closes settle, your 0–100 Forecast Score, S–F Forecast Grade, and round-relative LP adjustment finalize.'
                  ),
                },
              ].map(card => (
                <div
                  key={card.phase}
                  className="p-3.5 rounded-[2px] space-y-1.5"
                  style={{
                    backgroundColor: 'var(--op-canvas)',
                    border: '1px solid var(--op-line)',
                  }}
                >
                  <span className="op-mono text-[10.5px] font-semibold" style={{ color: 'var(--op-orange)' }}>
                    {card.phase}
                  </span>
                  <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                    {card.title}
                  </h3>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 02. Drawing & Controls */}
          <section
            id="docs-drawing"
            className="p-5 rounded-[2px] space-y-4 scroll-mt-[72px]"
            style={{
              backgroundColor: 'var(--op-panel)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="op-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[2px]"
                style={{ backgroundColor: 'var(--op-orange-soft)', color: 'var(--op-orange)' }}
              >
                02
              </span>
              <h2 className="text-[16px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                {t('차트 그리기 및 조작법', 'Chart Drawing & Controls')}
              </h2>
            </div>

            <div className="overflow-x-auto rounded-[2px]" style={{ border: '1px solid var(--op-line)' }}>
              <table className="v-audit-table">
                <thead>
                  <tr>
                    <th>{t('조작', 'Action')}</th>
                    <th>{t('적용 영역', 'Target Area')}</th>
                    <th>{t('동작 설명', 'Behavior')}</th>
                  </tr>
                </thead>
                <tbody>
                  {controlRows.map(row => (
                    <tr key={row.key}>
                      <td className="font-semibold whitespace-nowrap" style={{ color: 'var(--op-ink)' }}>
                        {row.key}
                      </td>
                      <td className="op-mono text-[12px] whitespace-nowrap" style={{ color: 'var(--op-ink-3)' }}>
                        {row.scope}
                      </td>
                      <td style={{ color: 'var(--op-ink-2)' }}>{row.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 03. 100-Point Scoring Engine */}
          <section
            id="docs-scoring"
            className="p-5 rounded-[2px] space-y-4 scroll-mt-[72px]"
            style={{
              backgroundColor: 'var(--op-panel)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className="op-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[2px]"
                  style={{ backgroundColor: 'var(--op-orange-soft)', color: 'var(--op-orange)' }}
                >
                  03
                </span>
                <h2 className="text-[16px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                  {t('100점 정량 평가 공식', '100-Point Evaluation Engine')}
                </h2>
              </div>
              <span className="op-mono text-[11.5px]" style={{ color: 'var(--op-ink-3)' }}>
                BTC Daily σ = {(BTC_DAILY_VOLATILITY * 100).toFixed(1)}%
              </span>
            </div>

            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
              {t(
                '총점은 경로 정확도(50점), 가격 흐름 유사도(25점), 최종 가격 정확도(15점) + 방향 정확도(최대 10점)를 합산해 0.0~100.0점으로 산출합니다(성적표 UI에서는 후반 두 항목을 "가격·방향 25점"으로 합산 표시). 직전 30일 실현 변동성(σ)으로 오차를 정규화하고 연속 미세 변동 보정을 적용합니다.',
                'Total Forecast Score (0.0–100.0) sums Path Accuracy (50 pts), Shape Fidelity (25 pts), Target Accuracy (15 pts), and Direction Accuracy (up to 10 pts)—combined as Price & Direction (25 pts) on compact scorecards. Errors scale by trailing 30D realized volatility with smooth noise-floor attenuation.'
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                className="p-3.5 rounded-[2px] space-y-1.5"
                style={{ backgroundColor: 'var(--op-canvas)', border: '1px solid var(--op-line)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                    {t('경로 정확도', 'Path Accuracy')}
                  </span>
                  <span className="op-mono text-[12px] font-bold" style={{ color: 'var(--op-orange)' }}>
                    / 50 pts
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                  {t(
                    '매일 예측-실제 로그 오차율을 해당 시점의 누적 실현 변동성(σ√t)으로 정규화하고 시간 가중(t+1)을 적용해 50·exp(-0.6z)로 평가합니다.',
                    'Measures daily log-price error scaled by horizon realized volatility (σ√t) with time weighting (t+1), scored smoothly as 50·exp(-0.6z).'
                  )}
                </p>
              </div>

              <div
                className="p-3.5 rounded-[2px] space-y-1.5"
                style={{ backgroundColor: 'var(--op-canvas)', border: '1px solid var(--op-line)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                    {t('가격 흐름 유사도', 'Shape Fidelity')}
                  </span>
                  <span className="op-mono text-[12px] font-bold" style={{ color: 'var(--op-orange)' }}>
                    / 25 pts
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                  {t(
                    '예측과 실제 일별 로그 수익률 벡터의 코사인 유사도를 계산합니다(최소 0점). 반등·눌림목 흐름이 정확할수록 높으며 일자선 편법에는 미세 변동 보정이 적용됩니다.',
                    'Cosine similarity between predicted and realized daily log-return vectors (clamped >= 0), isolating inflection shape quality while smoothly attenuating flat lines.'
                  )}
                </p>
              </div>

              <div
                className="p-3.5 rounded-[2px] space-y-1.5"
                style={{ backgroundColor: 'var(--op-canvas)', border: '1px solid var(--op-line)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                    {t('최종 가격 정확도', 'Target Accuracy')}
                  </span>
                  <span className="op-mono text-[12px] font-bold" style={{ color: 'var(--op-orange)' }}>
                    / 15 pts
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                  {t(
                    '예측 종료일(D+7) 종가의 로그 오차를 기간 변동성(σ√T)으로 나눈 정밀도 15·exp(-0.85z)로 계산합니다.',
                    'Evaluates terminal D+7 close precision via log-error normalized by period volatility (σ√T) as 15·exp(-0.85z).'
                  )}
                </p>
              </div>

              <div
                className="p-3.5 rounded-[2px] space-y-1.5"
                style={{ backgroundColor: 'var(--op-canvas)', border: '1px solid var(--op-line)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                    {t('방향 정확도', 'Direction Accuracy')}
                  </span>
                  <span className="op-mono text-[12px] font-bold" style={{ color: 'var(--op-orange)' }}>
                    / 10 pts
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                  {t(
                    '최종 상승·하락 방향을 맞히면 0.15·σ√T 대비 변동폭 크기에 비례한 연속 가중치로 최대 10점을 부여합니다.',
                    'Awards up to 10 bonus points when terminal direction matches actual outcome, ramped smoothly against 0.15·σ√T.'
                  )}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[2px]" style={{ border: '1px solid var(--op-line)' }}>
              <table className="v-audit-table">
                <thead>
                  <tr>
                    <th>{t('등급', 'Grade')}</th>
                    <th>{t('달성 기준', 'Qualification')}</th>
                    <th>{t('평가 요약', 'Interpretation')}</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeRows.map(row => (
                    <tr key={row.grade}>
                      <td>
                        <span
                          className="op-mono font-bold text-[12.5px] px-2 py-0.5 rounded-[2px]"
                          style={{
                            backgroundColor: 'var(--op-canvas)',
                            border: '1px solid var(--op-line-strong)',
                            color: row.color,
                          }}
                        >
                          {row.grade}
                        </span>
                      </td>
                      <td className="op-mono text-[12px]" style={{ color: 'var(--op-ink)' }}>
                        {row.rule}
                      </td>
                      <td style={{ color: 'var(--op-ink-2)' }}>{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 04. Elo / LP Settlement & Tiers */}
          <section
            id="docs-elo"
            className="p-5 rounded-[2px] space-y-4 scroll-mt-[72px]"
            style={{
              backgroundColor: 'var(--op-panel)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="op-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[2px]"
                style={{ backgroundColor: 'var(--op-orange-soft)', color: 'var(--op-orange)' }}
              >
                04
              </span>
              <h2 className="text-[16px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                {t('평판 점수(LP) 및 5단계 등급', 'Reputation LP & 5-Tier Ladder')}
              </h2>
            </div>

            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
              {t(
                `모든 계정은 ${DEFAULT_ELO.toLocaleString()} LP(Silver)에서 시작하며 K=40 제로섬 상대 순위 방식을 따릅니다. 기대 순위 E는 참여자 평균 대비 내 LP 차이(Elo 로지스틱 함수)로 산출하고, 실제 라운드 순위 백분위(p)에 따라 -32 LP ~ +32 LP 범위에서 평판 점수가 반영됩니다. (평가 완료 예측 3회 이상부터 정식 순위 반영)`,
                `Every account starts at ${DEFAULT_ELO.toLocaleString()} LP (Silver) under K=40 zero-sum round-relative scoring. Expected percentile E uses an Elo logistic curve against cohort mean LP, updating by -32 LP to +32 LP based on actual round percentile p (3+ evaluated forecasts required for official rank).`
              )}
            </p>

            <div
              className="p-3.5 rounded-[2px] op-mono text-[12px] flex flex-wrap items-center justify-between gap-2"
              style={{
                backgroundColor: 'var(--op-canvas)',
                border: '1px solid var(--op-line)',
                color: 'var(--op-ink-2)',
              }}
            >
              <span>ΔLP = round(40 × (p_round − E_expected))</span>
              <span style={{ color: 'var(--op-ink-3)' }}>
                {t(
                  '집단 내 상대적 예측 성과에 따라 평판 점수(LP) 증감',
                  'LP delta reflects relative forecast rank within each round'
                )}
              </span>
            </div>

            <div className="overflow-x-auto rounded-[2px]" style={{ border: '1px solid var(--op-line)' }}>
              <table className="v-audit-table">
                <thead>
                  <tr>
                    <th>{t('예측자 등급', 'Tier')}</th>
                    <th>{t('평판 구간', 'LP Range')}</th>
                    <th>{t('비고', 'Description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tierRows.map(row => (
                    <tr key={row.tier}>
                      <td>
                        <span className="inline-flex items-center gap-2 font-semibold" style={{ color: row.color }}>
                          <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: row.color }} />
                          <span>{t(`${row.koTier} (${row.tier})`, row.tier)}</span>
                        </span>
                      </td>
                      <td className="op-mono text-[12px]" style={{ color: 'var(--op-ink)' }}>
                        {row.range}
                      </td>
                      <td style={{ color: 'var(--op-ink-2)' }}>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 05. Market Report & Fairness */}
          <section
            id="docs-report"
            className="p-5 rounded-[2px] space-y-4 scroll-mt-[72px]"
            style={{
              backgroundColor: 'var(--op-panel)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="op-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[2px]"
                style={{ backgroundColor: 'var(--op-orange-soft)', color: 'var(--op-orange)' }}
              >
                05
              </span>
              <h2 className="text-[16px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                {t('집단 전망 지표 및 운영 원칙', 'Crowd Insights & Principles')}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  title: t('상위 예측자 중앙 경로 (Top Forecasters Median)', 'Top Forecasters Median'),
                  desc: t(
                    '평판 1,500 LP 이상(또는 해당 라운드 상위 25%) 참여자의 일별 예측 중앙값을 파란색 점선으로 표시해 전체 참여자 중앙값과의 차이를 보여줍니다.',
                    'Displays the daily median path of top forecasters (1,500+ LP or top 25%, blue dashed line) to compare against overall crowd median.'
                  ),
                },
                {
                  title: t('예측 분포 범위 (P25–P75 / P15–P85)', 'Forecast Distribution (P25–P75 / P15–P85)'),
                  desc: t(
                    '전체 제출 경로의 일별 가격 분포 분위수를 기반으로 참여자 예측의 중앙 50%(P25–P75)와 중앙 70%(P15–P85) 범위를 시각화합니다.',
                    'Visualizes the central 50% (P25–P75) and central 70% (P15–P85) quantile ranges across all submitted paths.'
                  ),
                },
                {
                  title: t('예측 분포 상·하단 및 하락 구간', 'Quantile Boundaries & Key Pullback Zone'),
                  desc: t(
                    '참여자들의 예상 경로에서 나타나는 분포 경계(P15·P85)와 주요 하락·반등 예상 구간을 정리해 비교 기준으로 제공합니다.',
                    'Summarizes distribution bounds (P15 and P85) and collective interim pullback windows across submitted forecasts.'
                  ),
                },
                {
                  title: t('예상 변동폭 비율 · 제출 시점 해시 기록', 'Path Range Ratio · Submission Hash Log'),
                  desc: t(
                    '내 예측 경로 내 목표 대비 최저점 비율을 산출하며, 제출 시점의 예측 데이터와 해시값을 함께 기록해 이후 변경 여부를 대조할 수 있습니다.',
                    'Computes drawn upside-to-drawdown ratio and records a timestamped verification hash alongside your submitted forecast data.'
                  ),
                },
              ].map(item => (
                <div
                  key={item.title}
                  className="p-3.5 rounded-[2px] space-y-1.5"
                  style={{ backgroundColor: 'var(--op-canvas)', border: '1px solid var(--op-line)' }}
                >
                  <h3 className="text-[13px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                    {item.title}
                  </h3>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 06. FAQ */}
          <section
            id="docs-faq"
            className="p-5 rounded-[2px] space-y-4 scroll-mt-[72px]"
            style={{
              backgroundColor: 'var(--op-panel)',
              border: '1px solid var(--op-line-strong)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="op-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[2px]"
                style={{ backgroundColor: 'var(--op-orange-soft)', color: 'var(--op-orange)' }}
              >
                06
              </span>
              <h2 className="text-[16px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                {t('자주 묻는 질문 (FAQ)', 'Frequently Asked Questions')}
              </h2>
            </div>

            <div className="space-y-2.5">
              {faqs.map(item => (
                <div
                  key={item.q}
                  className="p-3.5 rounded-[2px] space-y-1.5"
                  style={{ backgroundColor: 'var(--op-canvas)', border: '1px solid var(--op-line)' }}
                >
                  <h3 className="text-[13.5px] font-semibold" style={{ color: 'var(--op-ink)' }}>
                    {item.q}
                  </h3>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
