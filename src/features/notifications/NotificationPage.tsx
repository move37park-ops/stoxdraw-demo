import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CornerDownRight, MessageSquare, CheckCircle2 } from 'lucide-react';
import { repository } from '../../data/localRepository';
import { getCurrentUser } from '../../data/session';
import { formatRelativeTime } from '../../domain/format';
import type { Notification } from '../../domain/types';

export function NotificationPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifs = () => {
    if (currentUser) {
      setNotifications(repository.listNotifications(currentUser.id));
    } else {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifs();
    const unsub = repository.subscribe(loadNotifs);
    return () => unsub();
  }, [currentUser]);

  const handleNotificationClick = (n: Notification) => {
    repository.markNotificationRead(n.id);
    navigate(`/f/${n.forecastId}`);
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-2">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white mb-6 transition"
      >
        <ArrowLeft size={16} />
        <span>돌아가기</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="text-xs font-medium text-zinc-400 tracking-wider mb-1">
          알림 · 실시간 궤적 반응
        </div>
        <h1 className="type-h2 text-white font-bold tracking-tight mb-1">
          알림
        </h1>
        <p className="type-caption text-zinc-400">
          내 예측에 달린 YOUR DRAW 궤적 대결, 댓글, 검증 완료 결과를 실시간으로 확인하세요.
        </p>
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {notifications.length > 0 ? (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                !n.read
                  ? 'bg-[#121218] border-white/20 shadow-none'
                  : 'bg-[#0d0d10] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {n.type === 'response' && (
                  <div className="w-8 h-8 rounded-full bg-[#181822] text-[#DFC15D] border border-white/10 flex items-center justify-center">
                    <CornerDownRight size={15} />
                  </div>
                )}
                {n.type === 'comment' && (
                  <div className="w-8 h-8 rounded-full bg-[#181822] text-zinc-200 border border-white/10 flex items-center justify-center">
                    <MessageSquare size={14} />
                  </div>
                )}
                {n.type === 'resolved' && (
                  <div className="w-8 h-8 rounded-full bg-[#181822] text-[#DFC15D] border border-white/10 flex items-center justify-center">
                    <CheckCircle2 size={15} />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-white">
                    {n.type === 'response' ? '새로운 YOUR DRAW 궤적 대결' : n.type === 'comment' ? '새 댓글' : '예측 검증 완료'}
                  </span>
                  <span className="text-zinc-400 font-mono text-[11px]">{formatRelativeTime(n.createdAt)}</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-2.5">
                  {n.message}
                </p>
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-[11px] font-mono font-bold text-zinc-300 border border-white/10">
                    ${n.ticker}
                  </span>
                </div>
              </div>

              {!n.read && (
                <div className="w-2 h-2 rounded-full bg-[#DFC15D] mt-2 flex-shrink-0" />
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-20 px-4 rounded-2xl bg-[#0d0d10] border border-white/10">
            <Bell size={28} className="mx-auto mb-2 text-zinc-500 opacity-60" />
            <p className="text-sm text-zinc-400">새로운 알림이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
