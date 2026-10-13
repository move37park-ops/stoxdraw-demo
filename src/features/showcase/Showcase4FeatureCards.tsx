import { NavLink } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function Showcase4FeatureCards() {
  const features = [
    {
      id: 'drawing',
      title: '차트 드로잉 엔진',
      description: '마우스와 터치로 5일 뒤 목표가와 궤적을 직관적으로 스케치',
      path: '/arena',
      linkText: '엔진 체험하기',
      // Card 1: Soft lilac/pink card with geometric wireframe
      headerBg: 'bg-[#f5e6ea]',
      renderGraphic: () => (
        <svg viewBox="0 0 100 80" className="w-16 h-12 stroke-zinc-900 fill-none" strokeWidth="1.5">
          <circle cx="30" cy="50" r="14" />
          <circle cx="70" cy="50" r="14" />
          <path d="M 30 50 L 50 30 L 70 50 M 50 30 L 40 18 H 60" />
        </svg>
      ),
    },
    {
      id: 'consensus',
      title: '실시간 군집 합의 AI',
      description: '수천 명의 예측 궤적을 집계하여 신뢰 구간과 컨센서스 밴드 도출',
      path: '/arena',
      linkText: '컨센서스 보기',
      // Card 2: Electric blue card with 4 white squares
      headerBg: 'bg-[#0055ff]',
      renderGraphic: () => (
        <div className="grid grid-cols-2 gap-2">
          <div className="w-3.5 h-3.5 bg-white rounded-sm" />
          <div className="w-3.5 h-3.5 bg-white rounded-sm" />
          <div className="w-3.5 h-3.5 bg-white rounded-sm" />
          <div className="w-3.5 h-3.5 bg-white rounded-sm" />
        </div>
      ),
    },
    {
      id: 'scoring',
      title: '정밀 스코어링 시스템',
      description: '실제 시장 종가와의 오차율을 자동 계산하여 공정한 스코어 부여',
      path: '/arena',
      linkText: '평가 기준 보기',
      // Card 3: Warm yellow/orange gradient
      headerBg: 'bg-gradient-to-br from-[#ffd280] via-[#ff9472] to-[#ff6b6b]',
      renderGraphic: () => (
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/40" />
      ),
    },
    {
      id: 'record',
      title: '검증 가능한 레코드북',
      description: '수정 불가능한 타임스탬프와 함께 개인 트랙 레코드를 영구 보존',
      path: '/record',
      linkText: '기록 살펴보기',
      // Card 4: Cool mint/emerald gradient
      headerBg: 'bg-gradient-to-br from-[#38ef7d] to-[#11998e]',
      renderGraphic: () => (
        <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur-sm border border-white/40" />
      ),
    },
  ];

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-16 sm:py-24">
      {/* Section Header */}
      <div className="mb-8 text-left">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          STOXDRAW의 핵심 기능
        </h2>
      </div>

      {/* 4 Cards Grid (matching reference) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
        {features.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className="group flex flex-col justify-between rounded-2xl overflow-hidden border border-white/10 bg-[#0d0d10] hover:border-white/25 transition-all duration-200"
          >
            {/* Visual Thumbnail */}
            <div className={`w-full aspect-[4/3] ${item.headerBg} flex items-center justify-center p-4 relative overflow-hidden`}>
              {item.renderGraphic()}
            </div>

            {/* Content text below */}
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="type-h3 text-white mb-2 font-semibold">
                  {item.title}
                </h3>
                <p className="type-caption text-zinc-400 leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium group-hover:text-white transition-colors pt-2 border-t border-white/5">
                <span>{item.linkText}</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </NavLink>
        ))}
      </div>

      {/* Centered Flat Dark Pill Button below 4 cards */}
      <div className="text-center">
        <NavLink
          to="/arena"
          className="btn-flat-dark px-6 py-2.5 text-xs sm:text-sm font-medium"
        >
          더 보기
        </NavLink>
      </div>
    </section>
  );
}
