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
    { id: 'report', num: '05', label: t('집단 전망 비교 및 운영 원칙', 'Crowd Comparison & Principles') },
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
      desc: t(
        `원하는 날짜와 가격에 예측 지점을 추가합니다 (최대 ${MAX_ANCHORS}개). 주요 가격대에서는 자석 스냅(Snap)이 작동하며, D+7 종료 지점까지 연결되면 제출 버튼이 활성화됩니다.`,
        `Adds an anchor point at the chosen day and price (max ${MAX_ANCHORS}). Snap alignment assists key levels, and reaching D+7 enables submission.`
      ),
    },
    {
      key: t('지점 드래그 · 삭제', 'Drag & Delete'),
      scope: t('주황색 예측 지점 · 상단 툴바', 'Orange anchors · Canvas toolbar'),
      desc: t(
        '지점을 드래그해 날짜와 가격을 실시간 이동하고, 선택 상태에서 상단 D+N 삭제 · 지우기 버튼이나 방향키 · Delete · Backspace로 미세 조정 및 삭제할 수 있습니다.',
        'Drag points across days and prices, or select an anchor to fine-tune with arrow keys and remove via toolbar buttons or Delete/Backspace.'
      ),
    },
    {
      key: t('기간 줌 · 가격축 배율', 'Time Zoom & Y-Scale'),
      scope: t('차트 영역 · 우측 가격축', 'Plot area · Right Y-axis'),
      desc: t(
        '마우스 휠 또는 상단 "- / 21D / + / 초기화" 버튼으로 과거 표시 기간(7D~240D)을 조절하고, 우측 가격축을 스크롤·드래그(더블클릭 초기화)해 세로 배율을 조절할 수 있습니다.',
        'Use the mouse wheel or top "- / 21D / + / Reset" buttons to adjust lookback (7D–240D), and scroll/drag/double-click the right price axis to scale vertical amplitude.'
      ),
    },
    {
      key: t('빠른 예시 프리셋', 'Quick Presets'),
      scope: t('우측 제출 패널', 'Right TicketPanel'),
      desc: t(
        '하락 후 반등, 눌림 후 돌파, 고점 후 하락 3가지 대표 경로를 불러온 뒤 원하는 지점만 수정해 빠르게 예측을 제출할 수 있습니다.',
        'Load one of 3 canonical paths (Dip & Rally, Pullback Breakout, Peak & Pullback) and adjust anchor points before submitting.'
      ),
    },
    {
      key: t('일간 라운드 이동 · 겹쳐 보기', 'Round Nav & Overlay'),
      scope: t('상단 날짜 바 · 하단 참여자 표', 'Header nav · Participants table'),
      desc: t(
        '상단 날짜 이동 바(← 이전 / 다음 → / Today)로 최근 15개 일간 라운드의 진행 및 확정 결과를 조회하고, 하단 참여자 표에서 최대 3명의 경로를 차트에 겹쳐 비교할 수 있습니다.',
        'Browse recent 15 rolling daily rounds in the header bar (← Prev / Next → / Today) and overlay up to 3 peer paths on the chart from the participants table.'
      ),
    },
  ];

  const faqs = [
    {
      q: t('이미 예측을 제출했는데 예측 경로를 수정할 수 있나요?', 'Can I edit my forecast path after submitting?'),
      a: t(
        '아니요. 제출 즉시 집단 중앙 경로(Crowd Path)와 참여자 예측이 공개되므로 후행 편승(따라 그리기)을 막기 위해 라운드당 1회 제출 후 수정 불가 원칙을 적용합니다. 매일 새로운 7일 예측 라운드가 열리므로 새 전망은 다음 라운드에서 제출하실 수 있습니다.',
        'No. Because the Crowd Path and peer forecasts unlock immediately upon submission, each round permits one locked submission to prevent hindsight copying. Fresh 7-day rounds open daily.'
      ),
    },
    {
      q: t('왜 제출 전에는 다른 참여자의 예측을 볼 수 없나요?', 'Why are other participants hidden before I submit?'),
      a: t(
        '군집 편향(먼저 공개된 다수 의견이나 다른 참여자의 경로를 그대로 따라 그리는 현상)을 막기 위한 블라인드 규칙입니다. 내 예측 경로를 1회 제출하면 즉시 집단 중앙 경로(Crowd Path), 상승·하락 비중, 참여자별 경로 겹쳐 보기가 열립니다.',
        'Blind Mode prevents herding bias before forming your own forecast. Submitting your forecast immediately reveals the Crowd Path, Bullish/Bearish split, and peer path overlays.'
      ),
    },
    {
      q: t('7일을 기다리지 않고 채점이나 과거 라운드 결과를 확인하려면 어떻게 하나요?', 'How can I test scoring or inspect settled results without waiting 7 days?'),
      a: t(
        '상단 날짜 이동 바에서 과거 일자(← 이전)를 선택하면 추적 중인 라운드(TRACKING 1/7~6/7)와 최종 평가 완료 라운드(EVALUATED 7/7)의 실제 BTC 종가 대비 점수와 LP 변동을 바로 확인할 수 있습니다. 또한 상단 메뉴 "연습하기(/practice)"에서는 날짜와 가격을 가린 무작위 과거 7일 구간으로 즉시 블라인드 연습 및 100점 채점을 반복해 볼 수 있습니다.',
        'Select earlier daily rounds in the header navigator (← Prev) to inspect TRACKING (1/7–6/7) and EVALUATED (7/7) rounds with real BTC closes and LP settlements. You can also visit Practice (/practice) for instant blind 7-day historical replay scoring.'
      ),
    },
    {
      q: t('로그인하지 않아도 예측과 점수 확인이 가능한가요?', 'Do I need an account to draw and test my score?'),
      a: t(
        '아니요. 게스트(guest_xxxx) 상태로도 예측 경로 그리기, 제출, 집단 중앙 경로 열람, 일간 라운드 결과 확인, 블라인드 연습을 모두 체험할 수 있으며, 상단 연결 버튼으로 계정을 연동하면 현재 브라우저 기록이 계정에 연결됩니다.',
        'No. Guest sessions can draw paths, submit forecasts, unlock Crowd Path comparisons, inspect round results, and run blind practice immediately. Connecting an account links your browser history to your handle.'
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
                'Orange Paths는 7일 뒤 상승·하락만 고르는 이진 선택이 아니라, 오늘(D0)부터 예측 종료일(D+7)까지의 가격 흐름을 차트에 직접 그리는 실전 7일 예측(/)과 과거 구간 블라인드 연습(/practice)을 제공합니다.',
                'Instead of binary up/down bets, Orange Paths provides both Live 7-Day Forecasting (/)—drawing expected pullbacks, breakouts, and D+7 targets on the chart—and Blind Historical Practice (/practice).'
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  phase: 'OPEN',
                  title: t('1. 예측 경로 그리기 및 블라인드 제출', '1. Draw & Blind Submit'),
                  desc: t(
                    'D0 오른쪽 미래 영역에 최대 5개 예측 지점을 추가해 D+7 종료 지점까지 연결하고 제출합니다. 제출 전에는 타 참여자 경로가 비공개로 유지됩니다.',
                    'Add up to 5 anchor points in the future zone to reach D+7 and submit. Peer forecasts remain hidden until submission.'
                  ),
                },
                {
                  phase: 'COMPARE · TRACKING',
                  title: t('2. 집단 전망 비교 및 일별 추적 (1/7~6/7)', '2. Compare & Daily Tracking'),
                  desc: t(
                    '제출 즉시 차트의 집단 중앙 경로(Crowd Path), 상승·하락 비중, 참여자 목록(최대 3명 차트 겹쳐 보기)이 열리며, 매일 BTC 종가가 확정될 때마다 중간 점수와 현재 1위가 갱신됩니다.',
                    'Unlocks the in-chart Crowd Path, Bullish/Bearish split, and peer path overlays (up to 3) right after submission; interim scores and round leader update daily with BTC closes.'
                  ),
                },
                {
                  phase: 'EVALUATED 7/7',
                  title: t('3. D+7 최종 평가 및 LP 정산', '3. D+7 Evaluation & LP'),
                  desc: t(
                    '7일 종가가 모두 확정되면 100점 정량 예측 점수(경로 50 · 흐름 25 · 가격·방향 25)와 등급(S~F)이 확정되고, 라운드 상대 순위에 따라 -32 LP ~ +32 LP가 반영됩니다.',
                    'After all 7 daily closes settle, your 0–100 Forecast Score (50 path · 25 shape · 25 price/dir), S–F Grade, and -32 to +32 LP delta finalize.'
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
                {t('집단 전망 비교 및 운영 원칙', 'Crowd Comparison & Principles')}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  title: t('블라인드 제출 원칙 (Blind Mode before Submit)', 'Blind Mode Before Submission'),
                  desc: t(
                    '현재 라운드에 내 예측 경로를 제출하기 전까지는 다른 참여자의 목표가, 수익률, 한 줄 메모, 차트 경로가 가려져 군집 편향 없이 독립적인 전망을 세울 수 있습니다.',
                    'Peer D+7 targets, memos, and chart paths stay masked until you lock your own forecast in an open round, protecting independent judgment.'
                  ),
                },
                {
                  title: t('집단 중앙 경로 및 상승·하락 비중 (Crowd Path & Split)', 'Crowd Path & Bullish/Bearish Split'),
                  desc: t(
                    '제출 즉시 차트 위에 참여자들의 일별 중앙값 경로(Crowd Path)가 파란색 점선으로 표시되고, 우측 비교 패널에 전체 상승 전망 vs 하락 전망 비율이 공개됩니다.',
                    'Submitting unlocks the Crowd Path (blue dashed daily median trajectory) directly on the chart alongside overall Bullish vs. Bearish shares.'
                  ),
                },
                {
                  title: t('참여자 예측 비교 및 최대 3명 겹쳐 보기', 'Participants Table & Rival Overlays (Up to 3)'),
                  desc: t(
                    '하단 참여자 예측 현황 표에서 점수·수익률·예측자 등급을 확인하고, 관심 있는 참여자 최대 3명의 경로를 내 예측 차트 위에 겹쳐 비교할 수 있습니다.',
                    'Inspect scores, returns, and forecaster tiers in the Participants table, and overlay up to 3 peer forecast paths simultaneously on your chart.'
                  ),
                },
                {
                  title: t('검증 해시 기록 및 공유 카드 (Hash & Share Card)', 'Verification Hash & Share Card'),
                  desc: t(
                    '제출 시점의 예측 데이터와 함께 검증용 해시값이 기록되며, 공유 카드 이미지 생성 및 URL 페이로드(/f/:id?p=...)를 통해 내 예측 경로와 성적을 바로 공유할 수 있습니다.',
                    'Each locked forecast records a verification hash and provides a Share Card PNG plus serverless URL payload (/f/:id?p=...) to share and clone paths.'
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
