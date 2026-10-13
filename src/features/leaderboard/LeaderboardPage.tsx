import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { SEED_USERS } from '../../data/seed';

interface LeaderboardPageProps {
  currentDateStr: string;
}

interface LeaderboardUser {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string;
  bio?: string;
  rank: number;
  score: number;
  accuracy: string;
  verifiedCount: number;
  totalCount: number;
  avgMae: string;
  specialty: string;
  category: string;
}

const LEADERBOARD_DATA: LeaderboardUser[] = [
  {
    ...SEED_USERS[0],
    rank: 1,
    score: 89.2,
    accuracy: '89.2%',
    verifiedCount: 11,
    totalCount: 14,
    avgMae: '±3.1%',
    specialty: '빅테크 & 반도체 변곡점',
    category: 'tech',
  },
  {
    ...SEED_USERS[1],
    rank: 2,
    score: 84.7,
    accuracy: '84.7%',
    verifiedCount: 19,
    totalCount: 22,
    avgMae: '±4.4%',
    specialty: '퀀트 모멘텀 & 변동성',
    category: 'momentum',
  },
  {
    ...SEED_USERS[2],
    rank: 3,
    score: 81.5,
    accuracy: '81.5%',
    verifiedCount: 7,
    totalCount: 9,
    avgMae: '±5.2%',
    specialty: 'AI 슈퍼사이클 장기 궤적',
    category: 'tech',
  },
  {
    ...SEED_USERS[3],
    rank: 4,
    score: 78.4,
    accuracy: '78.4%',
    verifiedCount: 15,
    totalCount: 18,
    avgMae: '±6.0%',
    specialty: '금리 & 유동성 매크로 스윙',
    category: 'macro',
  },
];

export function LeaderboardPage({ currentDateStr: _currentDateStr }: LeaderboardPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'tech' | 'momentum' | 'macro'>('all');

  const filtered = activeTab === 'all'
    ? LEADERBOARD_DATA
    : LEADERBOARD_DATA.filter(u => u.category === activeTab);

  const top3 = LEADERBOARD_DATA.slice(0, 3);

  return (
    <div className="w-full">
      {/* 1. Header Banner (OpenAI Style) */}
      <div className="mb-10 text-center sm:text-left">
        <div className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">
          명예의 전당 · 검증된 포캐스터 랭킹
        </div>
        <h1 className="type-h1 text-white font-bold tracking-tight mb-2">
          리더보드
        </h1>
        <p className="type-body text-zinc-400 max-w-2xl">
          실제 시장 가격과 100% 대조 검증된 상위 포캐스터들의 적중률과 성적표입니다.
          모든 기록은 조작 없이 영구 보존됩니다.
        </p>
      </div>

      {/* 2. Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
        {top3.map((user) => (
          <div
            key={user.id}
            onClick={() => navigate(`/u/${user.handle}`)}
            className={`group rounded-2xl p-6 border transition-all duration-200 cursor-pointer flex flex-col justify-between bg-[#0d0d10] ${
              user.rank === 1
                ? 'border-white/30'
                : 'border-white/10 hover:border-white/20'
            }`}
          >
            <div>
              {/* Badge & Rank */}
              <div className="flex items-center justify-between mb-5">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#C5A059]/15 text-[#DFC15D] border border-[#C5A059]/30 font-mono">
                  RANK #{user.rank}
                </span>

                <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-[#DFC15D]">
                  <span>Score {user.score}</span>
                </div>
              </div>

              {/* User info */}
              <div className="flex items-center gap-3.5 mb-4">
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/10"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-base text-white group-hover:text-[#DFC15D] transition-colors">
                      {user.name}
                    </span>
                    <CheckCircle2 size={15} className="text-[#DFC15D]" />
                  </div>
                  <span className="text-xs text-zinc-400">
                    @{user.handle}
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                {user.bio}
              </p>
            </div>

            {/* Stats Footer */}
            <div className="pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[11px] text-zinc-400 font-medium">적중률</div>
                <div className="text-sm font-bold text-[#DFC15D] font-mono mt-0.5">
                  {user.accuracy}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400 font-medium">검증 기록</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {user.verifiedCount}건
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400 font-medium">평균 오차</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {user.avgMae}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto">
        {[
          { id: 'all', label: '전체 랭킹' },
          { id: 'tech', label: '빅테크 & AI' },
          { id: 'momentum', label: '퀀트 모멘텀' },
          { id: 'macro', label: '매크로 스윙' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'bg-white text-black'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Full Table */}
      <div className="bg-[#0d0d10] border border-white/10 rounded-2xl overflow-hidden shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#141418] text-zinc-400 text-xs uppercase border-b border-white/10">
              <tr>
                <th className="py-4 px-6">순위</th>
                <th className="py-4 px-6">포캐스터</th>
                <th className="py-4 px-6">전문 분야</th>
                <th className="py-4 px-6 text-center">검증 완료</th>
                <th className="py-4 px-6 text-center">평균 오차율</th>
                <th className="py-4 px-6 text-right">종합 점수</th>
                <th className="py-4 px-6 text-right">프로필</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => navigate(`/u/${user.handle}`)}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition cursor-pointer"
                >
                  <td className="py-4 px-6 font-mono font-bold text-[#DFC15D]">
                    #{user.rank}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover border border-white/10"
                      />
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1">
                          <span>{user.name}</span>
                          <CheckCircle2 size={13} className="text-[#DFC15D]" />
                        </div>
                        <div className="text-xs text-zinc-400">
                          @{user.handle}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-xs text-zinc-400 font-medium">
                    {user.specialty}
                  </td>
                  <td className="py-4 px-6 text-center text-xs text-zinc-300">
                    {user.verifiedCount}건
                  </td>
                  <td className="py-4 px-6 text-center text-xs text-zinc-300">
                    {user.avgMae}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className="font-bold font-mono text-[#DFC15D] text-sm">
                      {user.score}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-white transition">
                      <span>보기</span>
                      <ArrowRight size={13} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
