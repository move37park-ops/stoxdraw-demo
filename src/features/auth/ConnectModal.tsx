import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { loginWithProvider, getOrCreateAnonId } from '../../data/session';
import { repository } from '../../data/localRepository';
import { useI18n } from '../../lib/i18nCore';

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ConnectModal({ isOpen, onClose, onSuccess }: ConnectModalProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
    }
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const handleClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isDialogContent) {
          dialog.close();
        }
      };
      dialog.addEventListener('click', handleClick);
      return () => dialog.removeEventListener('click', handleClick);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    } else {
      onClose();
    }
  };

  const handleLogin = (provider: 'google' | 'kakao') => {
    const user = loginWithProvider(provider);
    const anonId = getOrCreateAnonId();
    repository.claimAnonymous(anonId, user.id);
    if (onSuccess) onSuccess();
    handleDismiss();
  };

  return (
    <dialog
      ref={dialogRef}
      className="w-[calc(100vw-2rem)] max-w-sm"
      aria-labelledby="connect-modal-title"
      {...({ closedby: 'any' } as any)}
      onClose={onClose}
    >
      <div
        className="relative w-full rounded-[2px] overflow-hidden"
        style={{
          backgroundColor: 'var(--op-canvas)',
          border: '1px solid var(--op-line-strong)',
          boxShadow: 'var(--op-shadow-stack)',
        }}
      >
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--op-panel)',
            borderBottom: '1px solid var(--op-line)',
          }}
        >
          <h2 id="connect-modal-title" className="text-[13.5px] font-medium" style={{ color: 'var(--op-ink)' }}>
            {t('프로필 연결', 'Connect Profile')}
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            className="h-8 w-8 rounded-[2px] inline-flex items-center justify-center hover:bg-[var(--op-raised)] transition-colors"
            style={{ color: 'var(--op-ink-3)' }}
            aria-label={t('프로필 연결 창 닫기', 'Close profile connection dialog')}
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--op-ink-2)' }}>
            {t(
              '이 브라우저의 예측 기록과 평판 점수(LP)를 계정에 연결합니다.',
              'Link forecast history and LP saved in this browser to your account.'
            )}
          </p>

          <div className="space-y-2">
            <button
              type="button"
              autoFocus
              onClick={() => handleLogin('google')}
              className="v-btn-primary w-full"
            >
              {t('Google 계정으로 계속하기', 'Continue with Google')}
            </button>

            <button
              type="button"
              onClick={() => handleLogin('kakao')}
              className="v-btn-secondary w-full h-9"
            >
              {t('Kakao 계정으로 계속하기', 'Continue with Kakao')}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
