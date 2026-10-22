import { X } from 'lucide-react';
import { loginWithProvider, getOrCreateAnonId } from '../../data/session';
import { repository } from '../../data/localRepository';

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.78)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-sm rounded-[8px] overflow-hidden"
        style={{
          backgroundColor: 'var(--v-canvas)',
          boxShadow: 'var(--v-shadow-stack)',
        }}
      >
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--v-canvas-soft)',
            borderBottom: '1px solid var(--v-hairline)',
          }}
        >
          <span className="v-body-sm-strong" style={{ color: 'var(--v-ink)' }}>
            Connect forecaster identity
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{ color: 'var(--v-mute)' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="v-body-sm" style={{ color: 'var(--v-body)' }}>
            Bind your local 5-day trajectory deployments to a verified profile and persist your quantitative Elo standing across devices.
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleLogin('google')}
              className="v-btn-primary w-full"
            >
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => handleLogin('kakao')}
              className="v-btn-secondary w-full h-9"
            >
              Continue with Kakao
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
