import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function Showcase4FeatureCards() {
  const navigate = useNavigate();

  const cards = [
    {
      id: 'arena',
      title: '아레나',
      description: '종목별 군중 컨센서스와 대결 궤적 겹쳐보기',
      badge: 'Arena',
      path: '/arena',
      gradient: 'from-amber-400 via-orange-500 to-rose-500',
      textColor: 'text-orange-300',
    },
    {
      id: 'feed',
      title: '피드',
      description: '실시간 참여자들의 예측 궤적 타임라인',
      badge: 'Feed',
      path: '/stream',
      gradient: 'from-sky-400 via-blue-500 to-indigo-600',
      textColor: 'text-sky-300',
    },
    {
      id: 'leaderboard',
      title: '리더보드',
      description: '실제 주가 대조로 검증된 상위 포캐스터 랭킹',
      badge: 'Leaderboard',
      path: '/leaderboard',
      gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
      textColor: 'text-emerald-300',
    },
    {
      id: 'record',
      title: '트랙 레코드',
      description: '시간이 지나면 100% 투명하게 채점되는 성적표',
      badge: 'Track Record',
      path: '/stream?tab=results',
      gradient: 'from-pink-400 via-rose-500 to-purple-600',
      textColor: 'text-pink-300',
    },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-20">
      <div className="mb-10 text-center">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
          핵심 탐색
        </h2>
        <p className="text-sm text-zinc-400">
          STOXDRAW 플랫폼의 4가지 주요 기능
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => navigate(card.path)}
            className="group rounded-3xl bg-[#0c0e14] border border-white/10 hover:border-white/25 overflow-hidden transition-all duration-300 cursor-pointer flex flex-col justify-between hover:shadow-2xl hover:scale-[1.02]"
          >
            {/* Visual Thumbnail (Matching the 4 colored illustrations in reference) */}
            <div className={`w-full aspect-[4/3] bg-gradient-to-br ${card.gradient} p-5 flex flex-col justify-between text-white relative overflow-hidden`}>
              {/* Subtle glass badge */}
              <div className="flex items-center justify-between z-10">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-black/30 backdrop-blur-md">
                  {card.badge}
                </span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </div>

              {/* Minimalist illustration geometry */}
              <div className="relative z-10 mt-auto">
                <div className="h-1 w-12 bg-white/60 rounded-full mb-2" />
                <div className="h-1 w-20 bg-white/40 rounded-full" />
              </div>

              {/* Soft overlay */}
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
            </div>

            {/* Content text below illustration */}
            <div className="p-5">
              <h3 className="font-bold text-base text-white mb-1 group-hover:text-emerald-400 transition-colors">
                {card.title}
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {card.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
