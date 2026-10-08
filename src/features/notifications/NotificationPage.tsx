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
    <div className="w-full pb-20">
      {/* Top Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-black/85 backdrop-blur-md border-b border-[#1b1e26]">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-full text-[#71767b] hover:text-white transition"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-white text-[15px]">알림</span>
      </div>

      <div>
        {notifications.length > 0 ? (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-4 border-b border-[#1b1e26] hover:bg-[#0c0d12] cursor-pointer transition flex items-start gap-3 ${
                !n.read ? 'bg-[#0f1118]/70' : ''
              }`}
            >
              <div className="mt-0.5">
                {n.type === 'response' && (
                  <div className="w-7 h-7 rounded-full bg-blue-500/10 text-[#38bdf8] flex items-center justify-center">
                    <CornerDownRight size={15} />
                  </div>
                )}
                {n.type === 'comment' && (
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <MessageSquare size={14} />
                  </div>
                )}
                {n.type === 'resolved' && (
                  <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <CheckCircle2 size={15} />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-white">
                    {n.type === 'response' ? '새로운 Forecast 응답' : n.type === 'comment' ? '새 댓글' : '예측 검증 완료'}
                  </span>
                  <span className="text-[#71767b]">{formatRelativeTime(n.createdAt)}</span>
                </div>
                <p className="text-[13px] text-[#c4c7cf] leading-relaxed">
                  {n.message}
                </p>
                <div className="mt-1.5">
                  <span className="px-2 py-0.5 rounded bg-[#181a24] text-[11px] font-mono text-[#9aa0a6] border border-[#272b38]">
                    {n.ticker}
                  </span>
                </div>
              </div>

              {!n.read && (
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
              )}
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-[#71767b]">
            <Bell size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">새로운 알림이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
