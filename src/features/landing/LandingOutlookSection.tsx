import { NavLink } from 'react-router-dom';
import { TrendingUp, Users, Target, ArrowRight, ShieldCheck } from 'lucide-react';

interface OutlookCardData {
  id: string;
  ticker: string;
  name: string;
  category: string;
  categoryStyle: string;
  currentValue: string;
  changePct: string;
  isPositive: boolean;
  consensusBull: number;
  consensusBear: number;
  targetValue: string;
  participants: number;
  bestPredictor: string;
  chartPath: string;
  chartStrokeColor: string;
  consensusArea: string;
  arenaLink: string;
  drawLink: string;
}

const OUTLOOK_ITEMS: OutlookCardData[] = [
  {
    id: 'sp500',
    ticker: 'S&P 500',
    name: '미국 대형주 벤치마크 지수',
    category: 'INDEX',
    categoryStyle: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    currentValue: '5,751.12',
    changePct: '+0.42%',
    isPositive: true,
    consensusBull: 68,
    consensusBear: 32,
    targetValue: '5,820.00 (+1.20%)',
    participants: 1420,
    bestPredictor: '@macro_quant',
    chartPath: 'M 0 60 C 50 55, 90 45, 140 48 C 190 52, 230 30, 280 25 C 330 20, 360 22, 400 18',
    chartStrokeColor: '#10b981',
    consensusArea: 'M 0 60 C 50 48, 90 35, 140 38 C 190 40, 230 18, 280 14 C 330 10, 360 12, 400 8 L 400 32 C 360 36, 330 34, 280 38 C 230 44, 190 62, 140 60 C 90 58, 50 68, 0 65 Z',
    arenaLink: '/arena/AAPL',
    drawLink: '/draw',
  },
  {
    id: 'bitcoin',
    ticker: 'BITCOIN',
    name: '글로벌 디지털 자산 벤치마크',
    category: 'CRYPTO',
    categoryStyle: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    currentValue: '$63,850.00',
    changePct: '+2.15%',
    isPositive: true,
    consensusBull: 74,
    consensusBear: 26,
    targetValue: '$67,400.00 (+5.56%)',
    participants: 2890,
    bestPredictor: '@satoshi_trader',
    chartPath: 'M 0 70 C 45 78, 80 50, 130 52 C 180 55, 220 28, 270 20 C 320 12, 360 25, 400 10',
    chartStrokeColor: '#f59e0b',
    consensusArea: 'M 0 70 C 45 62, 80 35, 130 36 C 180 38, 220 12, 270 6 C 320 2, 360 12, 400 2 L 400 26 C 360 38, 320 28, 270 34 C 220 44, 180 72, 130 68 C 80 66, 45 88, 0 78 Z',
    arenaLink: '/arena/TSLA',
    drawLink: '/draw',
  },
];

export function LandingOutlookSection() {
  return (
    <section className="w-full py-16 sm:py-24 bg-black border-b border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header: OUTLOOK (부제목 앞 점 제거, 시각적 안정감) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 pb-4 border-b border-white/10">
          <div>
            <div className="type-caption font-mono tracking-wider text-zinc-400 uppercase mb-1.5">
              MARKET SENTIMENT & 5D CONSENSUS
            </div>
            <h2 className="type-h2 text-white">
              OUTLOOK
            </h2>
          </div>
          <p className="type-body text-zinc-400 max-w-md">
            전 세계 포캐스터들이 집단지성으로 제시한 실시간 5거래일 전망과 합의 구간
          </p>
        </div>

        {/* 2-Column Grid: Left S&P 500, Right BITCOIN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {OUTLOOK_ITEMS.map((item) => (
            <div
              key={item.id}
              className="relative rounded-3xl border border-white/10 bg-[#0c0c10] p-6 sm:p-8 flex flex-col justify-between overflow-hidden group hover:border-white/20 transition-all duration-300"
            >
              <div>
                {/* Header: Ticker & Live Price */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    {/* 카테고리별 시각적 구분을 위한 전용 뱃지 컬러 (INDEX: Blue, CRYPTO: Amber) */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${item.categoryStyle}`}>
                        {item.category}
                      </span>
                      <span className="type-caption text-zinc-400">{item.name}</span>
                    </div>
                    <h3 className="type-h3 text-white">
                      {item.ticker}
                    </h3>
                  </div>

                  <div className="text-right">
                    <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                      {item.currentValue}
                    </div>
                    {/* 상승/수익 식별 컬러 (맑은 에메랄드) */}
                    <div className="type-caption font-semibold font-mono text-emerald-400 flex items-center justify-end gap-1">
                      <TrendingUp size={14} />
                      <span>{item.changePct}</span>
                    </div>
                  </div>
                </div>

                {/* 5-Day Consensus Bar (상승: Emerald, 하락: Rose로 직관적 전달) */}
                <div className="mb-6 bg-zinc-900/80 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-between type-caption font-mono mb-2">
                    <span className="text-emerald-400 font-medium">
                      상승 전망 {item.consensusBull}%
                    </span>
                    <span className="text-rose-400/90 font-medium">
                      하락 전망 {item.consensusBear}%
                    </span>
                  </div>
                  {/* Semantic Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500 rounded-l-full"
                      style={{ width: `${item.consensusBull}%` }}
                    />
                    <div
                      className="h-full bg-rose-500/80 rounded-r-full"
                      style={{ width: `${item.consensusBear}%` }}
                    />
                  </div>
                </div>

                {/* Trajectory Sparkline Graphic */}
                <div className="relative w-full h-32 sm:h-36 bg-zinc-950/60 rounded-2xl border border-white/5 p-4 mb-6 overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between type-caption font-mono text-zinc-400 z-10">
                    <span className="text-zinc-300 font-medium">
                      5D Consensus Trajectory
                    </span>
                    <span className="text-zinc-500">Day 1 → Day 5</span>
                  </div>

                  {/* SVG Trajectory Graphic */}
                  <div className="absolute inset-x-2 inset-y-3 flex items-center justify-center">
                    <svg
                      viewBox="0 0 400 80"
                      className="w-full h-full overflow-visible preserve-3d"
                    >
                      <defs>
                        <linearGradient id={`grad-${item.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor={item.chartStrokeColor} stopOpacity="0.18" />
                          <stop offset="100%" stopColor={item.chartStrokeColor} stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Consensus Area */}
                      <path
                        d={item.consensusArea}
                        fill={`url(#grad-${item.id})`}
                      />

                      {/* Dashed Base Price Line */}
                      <line
                        x1="0"
                        y1="60"
                        x2="400"
                        y2="60"
                        stroke="rgba(255,255,255,0.12)"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />

                      {/* Trajectory Line with Distinct Item Color */}
                      <path
                        d={item.chartPath}
                        fill="none"
                        stroke={item.chartStrokeColor}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />

                      {/* Endpoint Circle */}
                      <circle cx="400" cy="18" r="3.5" fill={item.chartStrokeColor} />
                    </svg>
                  </div>

                  <div className="flex items-center justify-between type-caption font-mono text-zinc-400 z-10 pt-2 border-t border-white/5">
                    <span>현재 기준가</span>
                    <span className="text-white font-medium">목표 합의: {item.targetValue}</span>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-300">
                      <Users size={16} />
                    </div>
                    <div>
                      <div className="type-caption text-zinc-400 font-mono text-[13px]">참여 포캐스터</div>
                      <div className="type-caption font-bold text-white font-mono text-sm">
                        {item.participants.toLocaleString()}명
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-300">
                      <Target size={16} />
                    </div>
                    <div>
                      <div className="type-caption text-zinc-400 font-mono text-[13px]">탑 트레이더</div>
                      <div className="type-caption font-bold text-zinc-200 font-mono text-sm truncate max-w-[90px]">
                        {item.bestPredictor}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                <NavLink
                  to={item.drawLink}
                  className="flex-1 py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm text-center transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>{item.ticker} 궤적 그리기</span>
                  <ArrowRight size={14} />
                </NavLink>

                <NavLink
                  to={item.arenaLink}
                  className="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium text-sm text-center border border-white/10 transition"
                  title="아레나에서 전체 궤적 비교"
                >
                  배틀 보기
                </NavLink>
              </div>

            </div>
          ))}
        </div>

        {/* Trust badge footer */}
        <div className="mt-8 flex items-center justify-center gap-2 type-caption text-zinc-400 font-mono">
          <ShieldCheck size={14} className="text-zinc-400" />
          <span>모든 컨센서스는 타임스탬프가 인증된 실제 유저 궤적 데이터로 산출됩니다.</span>
        </div>

      </div>
    </section>
  );
}
