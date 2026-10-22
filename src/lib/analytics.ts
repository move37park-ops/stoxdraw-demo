export type AnalyticsEvent =
  | 'canvas_first_touch'
  | 'canvas_completed'
  | 'forecast_locked'
  | 'share_clicked'
  | 'share_landing'
  | 'duel_started'
  | 'result_viewed'
  | 'signup_nudge_clicked'
  | 'round_changed'
  | 'ticker_switched';

interface EventPayload {
  [key: string]: unknown;
}

/**
 * 어댑터 교체형 Analytics 추상화 레이어 (Phase 1: 콘솔 & 로컬 로그 / Phase 2: PostHog / GA4)
 */
export function track(event: AnalyticsEvent, payload?: EventPayload): void {
  if (typeof window === 'undefined') return;

  const timestamp = new Date().toISOString();
  const enhancedPayload = {
    ...payload,
    timestamp,
    path: window.location.pathname,
  };

  // 개발 및 디버그 모드에서 로깅
  if (import.meta.env.DEV) {
    console.debug(`[Analytics Track] 🎯 ${event}`, enhancedPayload);
  }

  // 외부 연동 윈도우 객체(예: dataLayer, posthog)가 있을 경우 안전하게 전달
  try {
    const win = window as unknown as {
      posthog?: { capture: (name: string, data?: unknown) => void };
      dataLayer?: unknown[];
    };
    if (win.posthog && typeof win.posthog.capture === 'function') {
      win.posthog.capture(event, enhancedPayload);
    }
    if (Array.isArray(win.dataLayer)) {
      win.dataLayer.push({ event, ...enhancedPayload });
    }
  } catch {
    // Analytics error should never break user interactions
  }
}
