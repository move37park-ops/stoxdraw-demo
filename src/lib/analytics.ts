export type AnalyticsEvent =
  | 'page_view'
  | 'canvas_first_touch'
  | 'canvas_completed'
  | 'forecast_locked'
  | 'share_clicked'
  | 'share_landing'
  | 'duel_started'
  | 'result_viewed'
  | 'signup_nudge_clicked'
  | 'round_changed'
  | 'ticker_switched'
  | 'community_post_created'
  | 'community_tab_switched';

interface EventPayload {
  [key: string]: unknown;
}

interface AnalyticsWindow {
  posthog?: { capture: (name: string, data?: unknown) => void };
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  clarity?: (...args: unknown[]) => void;
  __opAnalyticsEnvInit?: boolean;
}

function ensureEnvAnalyticsBootstrapped(win: AnalyticsWindow): void {
  if (win.__opAnalyticsEnvInit) return;
  win.__opAnalyticsEnvInit = true;

  const envGaId = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();
  if (envGaId && typeof win.gtag === 'function') {
    const existing = document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${encodeURIComponent(envGaId)}"]`);
    if (!existing) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(envGaId)}`;
      document.head.appendChild(script);
      win.gtag('config', envGaId, { send_page_view: false });
    }
  }

  const envClarityId = (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined)?.trim();
  if (envClarityId) {
    const existing = document.querySelector(`script[src*="clarity.ms/tag/${encodeURIComponent(envClarityId)}"]`);
    if (!existing) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.clarity.ms/tag/${encodeURIComponent(envClarityId)}`;
      document.head.appendChild(script);
    }
  }
}

/**
 * 어댑터 교체형 Analytics 추상화 레이어 (GA4 gtag + Microsoft Clarity + PostHog + dataLayer)
 */
export function track(event: AnalyticsEvent, payload?: EventPayload): void {
  if (typeof window === 'undefined') return;

  const timestamp = new Date().toISOString();
  const enhancedPayload = {
    ...payload,
    timestamp,
    path: window.location.pathname,
  };

  if (import.meta.env.DEV) {
    console.debug(`[Analytics Track] ${event}`, enhancedPayload);
  }

  try {
    const win = window as unknown as AnalyticsWindow;
    ensureEnvAnalyticsBootstrapped(win);

    if (typeof win.gtag === 'function') {
      win.gtag('event', event, enhancedPayload);
    }
    if (typeof win.clarity === 'function') {
      win.clarity('event', event);
    }
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

export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined') return;

  const pageTitle = title ?? document.title;
  try {
    const win = window as unknown as AnalyticsWindow;
    ensureEnvAnalyticsBootstrapped(win);

    if (typeof win.gtag === 'function') {
      win.gtag('event', 'page_view', {
        page_path: path,
        page_title: pageTitle,
        page_location: window.location.href,
      });
    }
    if (typeof win.clarity === 'function') {
      win.clarity('set', 'page', path);
    }
    if (Array.isArray(win.dataLayer)) {
      win.dataLayer.push({
        event: 'page_view',
        page_path: path,
        page_title: pageTitle,
      });
    }
  } catch {
    // Analytics error should never break user interactions
  }
}
