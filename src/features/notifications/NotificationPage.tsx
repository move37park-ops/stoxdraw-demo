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
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white mb-6 transition"
      >
        <ArrowLeft size={16} />
        <span>돌아가기</span>
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-1">
          알림
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500">
          내 예측에 달린 반박선(Duel), 댓글, 검증 완료 결과를 확인하세요.
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
                  ? 'bg-sky-50/60 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800 shadow-sm'
                  : 'bg-white dark:bg-[#0e1017] border-zinc-200/90 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {n.type === 'response' && (
                  <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <CornerDownRight size={16} />
                  </div>
                )}
                {n.type === 'comment' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <MessageSquare size={15} />
                  </div>
                )}
                {n.type === 'resolved' && (
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <CheckCircle2 size={16} />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-zinc-900 dark:text-white">
                    {n.type === 'response' ? '새로운 반박 궤적 (Duel)' : n.type === 'comment' ? '새 댓글' : '예측 검증 완료'}
                  </span>
                  <span className="text-zinc-400 font-mono text-[11px]">{formatRelativeTime(n.createdAt)}</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed mb-2">
                  {n.message}
                </p>
                <div>
                  <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    ${n.ticker}
                  </span>
                </div>
              </div>

              {!n.read && (
                <div className="w-2.5 h-2.5 rounded-full bg-sky-500 mt-2 flex-shrink-0" />
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-20 px-4 rounded-3xl bg-white dark:bg-[#0e1017] border border-zinc-200/80 dark:border-zinc-800">
            <Bell size={28} className="mx-auto mb-2 text-zinc-400 opacity-50" />
            <p className="text-sm text-zinc-500">새로운 알림이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
