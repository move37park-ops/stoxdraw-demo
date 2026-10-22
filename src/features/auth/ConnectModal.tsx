import { X, Shield } from 'lucide-react';
import { loginWithProvider } from '../../data/session';
import { repository } from '../../data/localRepository';
import { getOrCreateAnonId } from '../../data/session';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ConnectModal({ isOpen, onClose, onSuccess }: ConnectModalProps) {
  if (!isOpen) return null;

  const handleLogin = (provider: 'google' | 'kakao') => {
    const user = loginWithProvider(provider);
    const anonId = getOrCreateAnonId();
    repository.claimAnonymous(anonId, user.id);
    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm rounded-lg bg-zinc-950 border border-zinc-800 p-6 shadow-2xl text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 p-1 rounded-md transition"
        >
          <X size={16} />
        </button>

        <div className="w-10 h-10 rounded-md bg-zinc-900 text-zinc-200 flex items-center justify-center mx-auto mb-3.5 border border-zinc-800">
          <Shield size={18} />
        </div>

        <h3 className="text-lg font-bold text-zinc-100 mb-1.5 tracking-tight">
          예측 기록 및 Elo 보존
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-5">
          방금 그리신 5일 예측을 공개 피드에 등록하고,<br />
          검증 가능한 <span className="text-zinc-200 font-medium">Elo 레코드</span>를 영구히 보존하세요.
        </p>

        <div className="flex flex-col gap-2.5">
          {/* Google */}
          <button
            onClick={() => handleLogin('google')}
            className="w-full py-2.5 px-4 rounded-md bg-white text-black font-medium text-xs flex items-center justify-center gap-2 hover:bg-zinc-200 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Google 계정으로 계속하기</span>
          </button>

          {/* Kakao */}
          <button
            onClick={() => handleLogin('kakao')}
            className="w-full py-2.5 px-4 rounded-md bg-[#FEE500] text-[#000000] font-medium text-xs flex items-center justify-center gap-2 hover:bg-[#ebd300] transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3C6.477 3 2 6.477 2 10.765c0 2.775 1.868 5.207 4.685 6.574-.157.568-.569 2.062-.652 2.385-.103.397.145.391.306.284.126-.084 2.008-1.363 2.815-1.916.912.256 1.869.398 2.846.398 5.523 0 10-3.477 10-7.725S17.523 3 12 3z" />
            </svg>
            <span>카카오 계정으로 계속하기</span>
          </button>

          {/* Later */}
          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            나중에 하기
          </button>
        </div>
      </div>
    </div>
  );
}
