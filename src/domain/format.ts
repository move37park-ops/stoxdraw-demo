export function formatCurrency(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatPct(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatDateShort(dateStr: string, locale: 'ko' | 'en' = 'ko'): string {
  try {
    const [_y, m, d] = dateStr.split('-');
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    return locale === 'en' ? `${month}/${day}` : `${month}월 ${day}일`;
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(isoString: string, locale: 'ko' | 'en' = 'ko'): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return locale === 'en' ? 'just now' : '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return locale === 'en' ? `${diffMin}m ago` : `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return locale === 'en' ? `${diffHour}h ago` : `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return locale === 'en' ? `${diffDay}d ago` : `${diffDay}일 전`;
}
