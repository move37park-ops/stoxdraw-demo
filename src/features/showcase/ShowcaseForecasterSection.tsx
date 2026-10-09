import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { SEED_USERS } from '../../data/seed';

export function ShowcaseForecasterSection() {
  const navigate = useNavigate();

  const topUsers = [
    {
      ...SEED_USERS[0],
      score: 89.2,
      accuracy: '89%',
      specialty: '빅테크 & 반도체 변곡점',
      bgGradient: 'from-blue-600/20 via-sky-500/10 to-transparent',
    },
    {
      ...SEED_USERS[1],
      score: 84.7,
      accuracy: '84%',
      specialty: '퀀트 모멘텀 & 변동성',
      bgGradient: 'from-emerald-600/20 via-teal-500/10 to-transparent',
    },
    {
      ...SEED_USERS[2],
      score: 81.5,
      accuracy: '81%',
      specialty: 'AI 슈퍼사이클 장기 궤적',
      bgGradient: 'from-purple-600/20 via-indigo-500/10 to-transparent',
    },
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 mb-16">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            검증된 탑 포캐스터
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            수십 번의 예측과 결과를 통해 증명된 최고의 예측가들과 그들의 트랙 레코드
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/leaderboard')}
          className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <span>리더보드 전체보기</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* 3-Column Profile Cards (Matches photo cards in user's image) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {topUsers.map((user, idx) => (
          <div
            key={user.id}
            onClick={() => navigate(`/u/${user.handle}`)}
            className="group relative rounded-2xl bg-white dark:bg-[#0e1017] border border-zinc-200/90 dark:border-zinc-800 p-6 flex flex-col justify-between hover:shadow-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 cursor-pointer overflow-hidden"
          >
            {/* Top Rank Badge */}
            <div className="flex items-center justify-between mb-4">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                RANK #{idx + 1}
              </span>
              <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                Score {user.score}
              </span>
            </div>

            {/* Profile Avatar & Info */}
            <div className="flex items-center gap-3.5 mb-4">
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700 group-hover:scale-105 transition-transform"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-zinc-900 dark:text-white text-base">
                    {user.name}
                  </h3>
                  <CheckCircle2 size={15} className="text-sky-500 flex-shrink-0" />
                </div>
                <div className="text-xs text-zinc-400 font-mono">@{user.handle}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
                  {user.specialty}
                </div>
              </div>
            </div>

            {/* Bio */}
            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-5 leading-relaxed">
              {user.bio}
            </p>

            {/* Bottom Stats & Profile Link */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-3 text-zinc-500">
                <span>검증 완료 <strong className="text-zinc-900 dark:text-white">{user.completedCount}회</strong></span>
                <span>적중률 <strong className="text-emerald-600 dark:text-emerald-400">{user.accuracy}</strong></span>
              </div>

              <span className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white flex items-center gap-0.5 font-sans font-medium transition">
                <span>기록 보기</span>
                <ArrowRight size={12} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
