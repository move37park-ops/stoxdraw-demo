import type { AnchorPoint, Forecast } from './types';
import { buildInterpolatedTrajectory } from './interpolation';
import { computeForecastDigest } from './audit';

interface CompactForecastPayload {
  id: string;
  tk: string;
  bd: string;
  bp: number;
  ed: string[];
  an: AnchorPoint[];
  cm: string;
  la: string;
  ah?: string;
  ae?: number;
}

export interface DecodedSharedForecast extends Forecast {
  sharedAuthorHandle?: string;
  sharedAuthorElo?: number;
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * 백엔드 DB 없이도 다른 브라우저/기기에서 예측 티켓을 복원할 수 있도록 URL-안전 컴팩트 페이로드로 직렬화합니다.
 */
export function encodeForecastSharePayload(
  forecast: Forecast,
  authorMeta?: { handle?: string | null; elo?: number | null }
): string {
  const anchors =
    forecast.anchors && forecast.anchors.length > 0
      ? forecast.anchors
      : (forecast.path || []).map((pt, idx) => ({ day: idx + 1, price: pt.price }));

  const compact: CompactForecastPayload = {
    id: forecast.id,
    tk: forecast.ticker,
    bd: forecast.baseDate,
    bp: parseFloat(forecast.basePrice.toFixed(2)),
    ed: forecast.evalDates,
    an: anchors.map((a) => ({ day: a.day, price: parseFloat(a.price.toFixed(2)) })),
    cm: forecast.comment.slice(0, 180),
    la: forecast.lockedAt,
    ...(authorMeta?.handle ? { ah: authorMeta.handle.slice(0, 40) } : {}),
    ...(typeof authorMeta?.elo === 'number' && Number.isFinite(authorMeta.elo)
      ? { ae: Math.round(authorMeta.elo) }
      : {}),
  };
  return toBase64Url(JSON.stringify(compact));
}

/**
 * 공유 URL 쿼리 파라미터(`?p=...`)로부터 Forecast 객체를 안전하게 역직렬화합니다.
 */
export function decodeForecastSharePayload(
  encoded: string | null | undefined,
  fallbackId?: string
): DecodedSharedForecast | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Partial<CompactForecastPayload>;
    if (
      !parsed ||
      typeof parsed.bp !== 'number' ||
      !Number.isFinite(parsed.bp) ||
      typeof parsed.bd !== 'string' ||
      !Array.isArray(parsed.ed) ||
      parsed.ed.length === 0 ||
      !Array.isArray(parsed.an) ||
      parsed.an.length === 0
    ) {
      return null;
    }

    const interp = buildInterpolatedTrajectory(parsed.bp, parsed.ed, parsed.an);
    const forecast: DecodedSharedForecast = {
      id: parsed.id || fallbackId || 'shared_forecast',
      authorId: null,
      anonId: 'shared_link',
      ticker: parsed.tk || 'BTC/USDT',
      horizon: parsed.ed.length <= 7 ? '7D' : '20D',
      mode: 'path',
      comment: typeof parsed.cm === 'string' ? parsed.cm : '',
      basePrice: parsed.bp,
      baseDate: parsed.bd,
      evalDates: parsed.ed,
      anchors: parsed.an,
      path: interp.path,
      pathPct: interp.pathPct,
      lockedAt: typeof parsed.la === 'string' ? parsed.la : new Date().toISOString(),
      rulesVersion: 'v1',
      ...(typeof parsed.ah === 'string' && parsed.ah.trim()
        ? { sharedAuthorHandle: parsed.ah.trim() }
        : {}),
      ...(typeof parsed.ae === 'number' && Number.isFinite(parsed.ae)
        ? { sharedAuthorElo: Math.round(parsed.ae) }
        : {}),
    };
    const digest = computeForecastDigest(forecast);
    forecast.versions = [
      {
        version: 1,
        createdAt: forecast.lockedAt,
        anchors: parsed.an,
        prices: interp.prices,
        comment: forecast.comment,
        digestHash: digest,
      },
    ];
    return forecast;
  } catch {
    return null;
  }
}
