import { createContext, useContext } from 'react';

export type Locale = 'ko' | 'en';

export const LANG_STORAGE_KEY = 'op_lang';

export const HAS_KOREAN_REGEX = /[\uAC00-\uD7A3]/;
export const TRANSLATABLE_ATTRS = ['aria-label', 'title', 'placeholder'] as const;
export type TranslatableAttr = (typeof TRANSLATABLE_ATTRS)[number];

export interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: (ko: string, en: string) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'ko';
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'ko') return saved;
  } catch {
    // ignore storage errors
  }
  return 'ko';
}

const KO_TO_EN_EXACT: Record<string, string> = {
  // Tier titles
  '다이아몬드': 'DIAMOND',
  '플래티넘': 'PLATINUM',
  '골드': 'GOLD',
  '실버': 'SILVER',
  '브론즈': 'BRONZE',
  '다이아': 'DIAMOND',

  // Scenario & regime labels
  '꾸준한 상승': 'Steady Rally',
  '조정 후 반등': 'Dip & Rally',
  '반등 후 하락': 'Rally & Fade',
  '꾸준한 하락': 'Steady Slide',
  '눌림목 돌파': 'Pullback Breakout',
  '고점 후 조정': 'Peak & Pullback',
  '상승 우세': 'Bullish Tilt',
  '조정·눌림 우세': 'Pullback Tilt',
  '팽팽한 분기': 'Balanced Split',
  '상승 쏠림 주의': 'Crowded Bullish',
  '하락 쏠림 주의': 'Crowded Bearish',
  '양방향 균형': 'Two-Way Balance',
  '컨센서스 동조': 'Consensus Aligned',
  '역발상 예측': 'Contrarian Call',
  '컨센서스 이탈': 'Off-Consensus',

  // Demo clock steps
  '오늘': 'Today',
  '2일 뒤': '+2D',
  '4일 뒤': '+4D',
  '7일 만기': '+7D Final',
  '예측 입력': 'Forecast Input',
  '초반 추적': 'Early Track',
  '중반 추적': 'Mid Track',
  '만기 정산': 'Final Settle',

  // Phases
  '초입': 'Early',
  '중반': 'Mid',
  '후반': 'Late',
  '초입 (1주차)': 'Early (Week 1)',
  '중반 (2주차)': 'Mid (Week 2)',
  '후반 (3주차)': 'Late (Week 3)',

  // Market levels
  '상단 저항선': 'Resistance Wall',
  '고수 평균선': 'Top-Tier Avg',
  '단기 지지선': 'Short-Term Support',
  '상단 매물대 저항 (Orderbook Wall)': 'Resistance Wall (Orderbook)',
  '상위 1% 고수 평균 목표선 (Top Tier)': 'Top 1% Forecaster Target',
  '단기 지지 구간 (20D EMA Support)': 'Short-Term Support (20D EMA)',
  '기준가': 'Anchor',

  // PathCanvas UI
  '비트코인, 시장은 어디를 보고 있을까요?': 'Where does the market see Bitcoin heading?',
  '7일 뒤 비트코인, 시장은 어디를 보고 있을까요?': 'Where does the market see Bitcoin in 7 days?',
  '예측 궤적 · 시장 중앙값 · 실제 일봉 비교': 'Forecast Path · Market Median · Actual Closes',
  '고수·평균선': 'Top / Avg',
  '초기본': 'v1 Initial',
  '라인': 'Line',
  '캔들': 'Candles',
  '시간축 줌 및 초기화': 'Time axis zoom and reset',
  '기간 넓히기 (축소 · 차트 스크롤 다운)': 'Widen range (Zoom out · Scroll down)',
  '기간 축소': 'Zoom out',
  '차트 위에서 마우스 휠 스크롤로 기간(10D~240D)을 자유롭게 조절할 수 있습니다':
    'Scroll mouse wheel on the chart to adjust visible history (7D-240D)',
  '기간 좁히기 (확대 · 차트 스크롤 업)': 'Narrow range (Zoom in · Scroll up)',
  '기간 확대': 'Zoom in',
  '줌 초기화 (21D)': 'Reset zoom (21D)',
  '줌(21D) 및 경로 초기화': 'Reset zoom (21D) and path',
  '초기화': 'Reset',
  '시장평균': 'Crowd Avg',
  '오늘(D-0) 오른쪽 차트 영역을 클릭해 예상 경로를 그리세요':
    'Click the future chart area to the right of Today (D-0) to plot your path',
  '만기선(D+7)까지 연결하거나 우측 시나리오를 선택하세요':
    'Connect through the D+7 expiry line or pick a preset on the right',
  'D+7 만기선을 클릭해 완성': 'Click the D+7 expiry line to complete',

  // DeepReport UI
  '포지션 배분 & 핵심 가격대': 'Position Allocation & Key Levels',
  '고티어 그룹 평균': 'Top-Tier Cohort Avg',
  '상위 10% 고수 평균': 'Top-Tier Cohort Avg',
  '집단 눌림목 지지선': 'Consensus Dip Support',
  '미입력 (차트 클릭 또는 상단 시나리오 선택)': 'Not entered (click chart or pick a scenario)',
  '샘플 경로 불러오기': 'Load Sample Path',
  '7일 집단 경로 해설': '7D Consensus Path Commentary',
  '세부 지표': 'Detailed Metrics',
  '우세 파동 시나리오': 'Dominant Pattern',
  '집단 변곡점 구간': 'Cohort Pivot Window',
  '최대 의견 분열일': 'Peak Divergence Day',
  '고티어 vs 일반 괴리': 'Top-Tier vs Crowd Spread',
  '상위 10% vs 일반 괴리': 'Top-Tier vs Crowd Spread',
  '참여 표본 · 내 기대 손익비': 'Cohort Size · My Expected R:R',
  '참여자 중앙값': 'Crowd Median',
  '고티어 목표가': 'Top-Tier Target',
  '상위 10% 목표가': 'Top-Tier Target',
  '차트 데이터가 충분하지 않습니다.': 'Not enough chart data available.',
  '내 예측': 'My Forecast',
  '고티어 그룹': 'Top-Tier Cohort',
  '상위 10% 고수': 'Top-Tier Cohort',
  '참여자 평균': 'Crowd Average',
  '예측 구간 (P15–P85)': 'Range (P15-P85)',
  '클릭 시 목표가 반영': 'Click to apply target price',
  '나': 'ME',
  '고티어': 'TOP TIER',
  '상위10%': 'TOP TIER',
  '평균': 'AVG',

  // OverviewReport UI
  '7일 예상 경로를 제출하면 고티어 궤적과 분위수 리포트가 열립니다.':
    'Submit your 7D forecast path to unlock Top-Tier trajectories and quantile distribution intelligence.',

  // CompactForecastCard
  '비교중': 'Overlaid',
  '오버레이': 'Overlay',
  '예측 ↗': 'Predict ↗',
  '추천': 'Like',
  '상세 보기 ↗': 'View Details ↗',

  // DetailPage
  '예측을 찾을 수 없습니다.': 'Forecast not found.',
  '예측 화면으로 돌아가기': 'Back to Predict',
  '뒤로': 'Back',
  '정산 완료': 'Settled',
  '진행 중': 'Live',
  '공유 카드': 'Share Card',
  '예측 요약 및 채점 성적표': 'Forecast Summary & Scorecard',
  '예측 목표 수익률': 'Forecast Target Return',
  '실제 진행 수익률': 'Actual Return',
  '점수': 'Score',
  '집계 대기 (D-0)': 'Pending (D-0)',
  '평판 LP 변동': 'Reputation LP Delta',
  '경로 (50)': 'Path (50)',
  '형태 (25)': 'Shape (25)',
  '목표 (25)': 'Target (25)',
  '수정 이력': 'Revision History',
  '제출 순서 기록': 'Submission Log',
  '최초 제출': 'Initial',
  '수정본': 'Revision',
  '구간': 'Day',
  '일자': 'Date',
  '보간 예측가': 'Projected Price',
  '예측 등락': 'Projected %',
  '실제 종가': 'Actual Close',
  '오차율': 'Abs Error',
  '미도래': 'Pending',

  // Profile / Seed defaults
  '로컬 세션 예측자': 'Local Session Forecaster',
  '이 브라우저에 저장된 제출 기록입니다.': 'Submissions saved in this browser session.',
  '구글 애널리스트': 'Google Analyst',
  '카카오 애널리스트': 'Kakao Analyst',

  // JSX split sentence fragments in DeepReport / OverviewReport / DetailPage
  '핵심 반등 피벗 D+': 'Key bounce pivot D+',
  ') · 일반 참여자 평균 대비 ': ') · vs Crowd Avg ',
  '강세 예측자 경로 내 최대 허용 낙폭 평균 $': 'Bulls avg max drawdown $',
  ') · 지정가 분할 매수 대기 구간': ') · Scaled limit-buy zone',
  "파동 유형 '": "Pattern '",
  "' · 기대 손익비 1 : ": "' · Expected R:R 1 : ",
  ' · 7일 경로를 그리면 손익비와 분위수 진단이 즉시 계산됩니다.':
    ' · Draw a 7D path to calculate R:R and percentile diagnostics.',
  '상위 10% 고수 그룹은 D+': 'Top 10% smart-money cohort anchors on D+',
  ') 부근을 단기 저점 피벗으로 삼아 만기 목표가 $': ') as a short-term pivot low, targeting $',
  '를 제시하고 있습니다.': ' at expiry.',
  '상승을 전망한 참여자들도 경로 도중 평균 $': 'Bullish participants also price in an interim pullback averaging $',
  ') 수준의 눌림목을 반영하고 있어, 하단 지지 구간(P15 $':
    '), highlighting lower support defense around (P15 $',
  ') 방어 여부를 확인하는 접근이 유리합니다.': ').',
  '목표 $': 'Target $',
  '참여 ': '',
  '명 집계 중 · 7일 변동성 기준 진폭 ±': ' participants · 7D vol band ±',
  ' (마감 ': ' (Closes in ',
};

const KO_TO_EN_PATTERNS: Array<{ pattern: RegExp; replace: (...args: string[]) => string }> = [
  // DeepReport callout strings
  {
    pattern: /^상승 쏠림\((\d+)%\) 구간 · P25 지지 확인 후 분할 접근$/,
    replace: (_, pct) => `Bullish crowding (${pct}%) · Watch P25 support before scaling in`,
  },
  {
    pattern: /^약세 쏠림\((\d+)%\) · D\+(\d+) 반등 돌파 주시$/,
    replace: (_, pct, day) => `Bearish crowding (${pct}%) · Watch D+${day} bounce breakout`,
  },
  {
    pattern: /^상위 10%가 평균 대비 \+([\d.]+)%p 강세 포지션$/,
    replace: (_, spread) => `Top 10% positioned +${spread}%p more bullish than crowd`,
  },
  {
    pattern: /^박스권 균형 장세 · D\+(\d+) 방향성 확정 주시$/,
    replace: (_, day) => `Balanced range · Watch D+${day} for directional confirmation`,
  },
  {
    pattern: /^상위 (\d+)% · 강세측$/,
    replace: (_, pct) => `Top ${pct}% · Bullish`,
  },
  {
    pattern: /^하위 (\d+)% · 약세측$/,
    replace: (_, pct) => `Bottom ${pct}% · Bearish`,
  },
  {
    pattern: /^하위 (\d+)% · 보수적$/,
    replace: (_, pct) => `Bottom ${pct}% · Conservative`,
  },
  {
    pattern: /^BTC\/USDT 향후 (\d+)일 목표가 ([\d,$]+) \(([^)]+)\) 시나리오$/,
    replace: (_, days, price, pct) => `BTC/USDT ${days}D scenario targeting ${price} (${pct})`,
  },
  {
    pattern: /^표본 (\d+)명 · (\d+)일 만기$/,
    replace: (_, n, d) => `${n} samples · ${d}D expiry`,
  },
  {
    pattern: /^강세 시나리오 (\d+)%$/,
    replace: (_, pct) => `Bullish scenarios ${pct}%`,
  },
  {
    pattern: /^약세 시나리오 (\d+)%$/,
    replace: (_, pct) => `Bearish scenarios ${pct}%`,
  },
  {
    pattern: /^강세 (\d+)% 대 약세 (\d+)%$/,
    replace: (_, b, r) => `${b}% bullish vs ${r}% bearish`,
  },
  {
    pattern: /^지지 P15 (\$[\d,]+)$/,
    replace: (_, p) => `Support P15 ${p}`,
  },
  {
    pattern: /^저항 P85 (\$[\d,]+)$/,
    replace: (_, p) => `Resistance P85 ${p}`,
  },
  {
    pattern: /^내 (\d+)일 예측 경로$/,
    replace: (_, d) => `My ${d}D Forecast Path`,
  },
  {
    pattern: /^(\d+)일 집단 경로 해설$/,
    replace: (_, d) => `${d}D Crowd Path Commentary`,
  },
  {
    pattern: /^상승 (\d+)%$/,
    replace: (_, pct) => `Bullish ${pct}%`,
  },
  {
    pattern: /^저점 D\+(\d+) → 고점 D\+(\d+)$/,
    replace: (_, lowD, highD) => `Low D+${lowD} -> High D+${highD}`,
  },
  {
    pattern: /^D\+(\d+) \(격차 ([\d.]+)%p\)$/,
    replace: (_, day, gap) => `D+${day} (Spread ${gap}%p)`,
  },
  {
    pattern: /^격차 ([\d.]+)%p$/,
    replace: (_, gap) => `Spread ${gap}%p`,
  },
  {
    pattern: /^(\d+)명 · R:R 1 : ([\d.]+)$/,
    replace: (_, n, rr) => `${n} samples · R:R 1 : ${rr}`,
  },
  {
    pattern: /^(\d+)명 · 내 경로 미입력$/,
    replace: (_, n) => `${n} samples · No path yet`,
  },
  {
    pattern: /^(\d+)일 컨센서스 궤적 맵 \(D-0 ~ D\+(\d+)\)$/,
    replace: (_, d1, d2) => `${d1}D Consensus Trajectory Map (D-0 ~ D+${d2})`,
  },
  {
    pattern: /^참여자 (\d+)명 기준$/,
    replace: (_, n) => `Based on ${n} participants`,
  },
  {
    pattern: /^(\d+)일 경로 컨센서스 및 매매 타이밍 맵$/,
    replace: (_, d) => `${d}D path consensus and entry timing map`,
  },
  {
    pattern: /^분기 D\+(\d+)$/,
    replace: (_, d) => `Split D+${d}`,
  },
  {
    pattern: /^(.+) 오버레이 제거$/,
    replace: (_, h) => `Remove ${h} overlay`,
  },
  {
    pattern: /^가격대별 (\d+)일 경유 · 만기 분포$/,
    replace: (_, d) => `${d}D Path Touch & Expiry Distribution`,
  },
  {
    pattern: /^경유 (\d+)% · (\d+)%$/,
    replace: (_, touch, share) => `Touch ${touch}% · ${share}%`,
  },
  // Split fragment suffixes
  {
    pattern: /^(.+) \((\d+)% · (\d+)명\)$/,
    replace: (_, label, pct, n) => `${translateKoToEn(label)} (${pct}% · ${n})`,
  },
  // PathCanvas
  {
    pattern: /^자석 · (.+)$/,
    replace: (_, label) => `Snap · ${translateKoToEn(label)}`,
  },
  {
    pattern: /^(\d+)일 고점$/,
    replace: (_, d) => `${d}D High`,
  },
  {
    pattern: /^(\d+)일 저점$/,
    replace: (_, d) => `${d}D Low`,
  },
  {
    pattern: /^시 (\$[\d,]+)$/,
    replace: (_, p) => `O ${p}`,
  },
  {
    pattern: /^고 (\$[\d,]+)$/,
    replace: (_, p) => `H ${p}`,
  },
  {
    pattern: /^저 (\$[\d,]+)$/,
    replace: (_, p) => `L ${p}`,
  },
  {
    pattern: /^종 (\$[\d,]+)$/,
    replace: (_, p) => `C ${p}`,
  },
  {
    pattern: /^BTC\/USDT (\d+)일 시계열 인터랙티브 예측 차트$/,
    replace: (_, d) => `BTC/USDT ${d}D Interactive Forecast Chart`,
  },
  {
    pattern: /^만기선\(D\+(\d+)\)까지 연결하거나 우측 시나리오를 선택하세요$/,
    replace: (_, d) => `Connect through the D+${d} expiry line or select a preset on the right`,
  },
  {
    pattern: /^D\+(\d+) 만기선을 클릭해 완성$/,
    replace: (_, d) => `Click the D+${d} expiry line to complete`,
  },
  {
    pattern: /^목표 (.+)$/,
    replace: (_, pct) => `Target ${pct}`,
  },
  {
    pattern: /^실제 (.+)$/,
    replace: (_, pct) => `Actual ${pct}`,
  },
  // DetailPage & CompactForecastCard
  {
    pattern: /^기준일: (.+)$/,
    replace: (_, d) => `Base Date: ${d}`,
  },
  {
    pattern: /^@([^\s]+) · ([A-Z/]+) (\d+)일 예측$/,
    replace: (_, handle, ticker, days) => `@${handle} · ${ticker} ${days}D Forecast`,
  },
  {
    pattern: /^추천 \((\d+)\)$/,
    replace: (_, n) => `Like (${n})`,
  },
  {
    pattern: /^([\d.]+)점 \(등급 ([A-Z]+)\)$/,
    replace: (_, score, grade) => `${score} pts (Grade ${grade})`,
  },
  {
    pattern: /^저장: (.+)$/,
    replace: (_, ts) => `Saved: ${ts}`,
  },
  {
    pattern: /^([\d.]+)점$/,
    replace: (_, s) => `${s} pts`,
  },
  // Dates & Relative Times (format.ts)
  {
    pattern: /^(\d+)월 (\d+)일$/,
    replace: (_, m, d) => `${m}/${d}`,
  },
  {
    pattern: /^방금 전$/,
    replace: () => 'just now',
  },
  {
    pattern: /^(\d+)분 전$/,
    replace: (_, m) => `${m}m ago`,
  },
  {
    pattern: /^(\d+)시간 전$/,
    replace: (_, h) => `${h}h ago`,
  },
  {
    pattern: /^(\d+)일 전$/,
    replace: (_, d) => `${d}d ago`,
  },
  // Tier prefix/exact fallback in compound strings like "다이아몬드 (DIAMOND · 1890 LP)"
  {
    pattern: /^(다이아몬드|플래티넘|골드|실버|브론즈)(.*)$/,
    replace: (_, tier, rest) => `${KO_TO_EN_EXACT[tier] ?? tier}${translateKoToEn(rest)}`,
  },
];

export function translateKoToEn(raw: string): string {
  if (!raw || !HAS_KOREAN_REGEX.test(raw)) return raw;

  const leadingWs = raw.match(/^\s*/)?.[0] ?? '';
  const trailingWs = raw.match(/\s*$/)?.[0] ?? '';
  const collapsed = raw.trim().replace(/\s+/g, ' ');

  if (!collapsed) return raw;

  const exact = KO_TO_EN_EXACT[collapsed];
  if (exact !== undefined) {
    if (exact === '') return '';
    return `${leadingWs ? ' ' : ''}${exact}${trailingWs ? ' ' : ''}`;
  }

  for (const { pattern, replace } of KO_TO_EN_PATTERNS) {
    const match = collapsed.match(pattern);
    if (match) {
      const converted = collapsed.replace(pattern, replace as (...args: any[]) => string);
      return `${leadingWs ? ' ' : ''}${converted}${trailingWs ? ' ' : ''}`;
    }
  }

  // Fallback token replacement inside longer un-enumerated Korean phrases
  let result = collapsed
    .replace(/만기 목표가/g, 'expiry target')
    .replace(/예측 경로/g, 'forecast path')
    .replace(/기준일/g, 'Base Date')
    .replace(/기준가/g, 'Anchor')
    .replace(/지정가/g, 'limit price')
    .replace(/눌림목/g, 'pullback')
    .replace(/돌파/g, 'breakout')
    .replace(/반등/g, 'rebound')
    .replace(/조정/g, 'pullback')
    .replace(/상승/g, 'upside')
    .replace(/하락/g, 'downside')
    .replace(/다이아몬드/g, 'DIAMOND')
    .replace(/플래티넘/g, 'PLATINUM')
    .replace(/골드/g, 'GOLD')
    .replace(/실버/g, 'SILVER')
    .replace(/브론즈/g, 'BRONZE');

  if (result !== collapsed) {
    return `${leadingWs ? ' ' : ''}${result}${trailingWs ? ' ' : ''}`;
  }
  return raw;
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

export function shouldSkipTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  return SKIP_TAGS.has(parent.tagName);
}

const DATA_KO_TO_EN: Record<string, string> = {
  // Seed user profiles & session names
  '구글 애널리스트': 'Google Analyst',
  '카카오 애널리스트': 'Kakao Analyst',
  '로컬 세션 예측자': 'Local Session Forecaster',
  '5거래일 주가 경로 예측 및 Elo 정산 기록입니다.':
    'Live multi-day price path forecasts and Elo rating ledger.',
  'BTC/USDT 7일 가격 경로 예측 및 Elo 정산 기록입니다.':
    'Live 7D BTC/USDT price path forecasts and Elo rating ledger.',
  '이 브라우저에 저장된 제출 기록입니다.':
    'Forecast submissions stored locally in this browser session.',
  'BTC/USDT 7일 변동성 정규화 경로 모델링 및 파생상품 감마 전환점 추적 (Diamond Tier).':
    '7D volatility-normalized BTC/USDT trajectory modeling and derivatives gamma inflection tracking (Diamond Tier).',
  '현물 ETF 순유입 사이클과 온체인 장기 보유자 물량 소화 기반 7일 추세 작도.':
    '7D trend path modeling grounded in spot ETF net-flow cycles and long-term on-chain holder absorption.',
  '무기한 선물 펀딩비 과열 해소 구간 포착 및 스윙 전환 구간 전문 포캐스터.':
    'Swing-inflection forecaster specializing in perpetual funding-rate resets and deleveraging windows.',
  '글로벌 유동성 지표(M2) 및 달러 인덱스 역상관 기반 비트코인 중기 시나리오.':
    'Medium-horizon Bitcoin scenario modeling built around global M2 liquidity and DXY inverse correlation.',
  '주요 매물대 지지·저항 리테스트 구간 중심의 보수적 리스크 관리.':
    'Conservative risk management focused on key supply-demand support and resistance retests.',
  '리플레이 랩으로 차트 추세 작도를 훈련 중인 크립토 트레이더.':
    'Crypto trader sharpening chart trajectory forecasting in the replay lab.',

  // Seed forecast theses (live, revisions, resolved)
  'D+2 단기 반등(+2.4%) 이후 D+3 레버리지 청산 눌림목(-1.2%)을 거친 뒤, D+5 돌파 및 7일 만기 +6.8% 도달 시나리오.':
    'Short-term bounce at D+2 (+2.4%), leverage flush pullback at D+3 (-1.2%), followed by a D+5 breakout toward +6.8% at D+7 expiry.',
  '[v2 수정] 현물 오더북 매수 벽 강화 확인. D+3 눌림목 지지 이후 7일 목표가를 +6.8%($81.1K)로 상향 조정.':
    '[v2 Revised] Stronger spot bid walls observed. Raising 7D target to +6.8% ($81.1K) following D+3 pullback support.',
  '거래소 보유량 감소세 지속. D+2 반등 후 D+4 짧은 숨고르기(-0.8%)를 거쳐 D+7 +6.5% 안착 전망.':
    'Continued exchange reserve outflows. Expecting a D+2 bounce, brief D+4 pause (-0.8%), and settlement near +6.5% by D+7.',
  '초반 이틀 눌림목(-1.5%) 소화 후 주 후반 완만한 회복 랠리. 7일 목표 +4.6%.':
    'Digesting an early 2-day pullback (-1.5%) before a steady late-week recovery rally targeting +4.6% at D+7.',
  '초반 횡보 이후 주중 매수세 유입으로 7일 만기 +4.2% 계단식 상승 전망.':
    'Early consolidation followed by mid-week spot buying for a stepped climb to +4.2% by D+7.',
  'D+2 기술적 반등(+1.9%) 이후 상단 매물대 저항으로 주 후반 박스권 하단 재차 테스트(-2.8%) 시나리오.':
    'Technical bounce at D+2 (+1.9%) capped by overhead supply, retesting the lower range (-2.8%) late week.',
  '단기 지지선 이탈 후 반등 실패를 예상하는 역발상 숏 관점 (-4.1%).':
    'Contrarian bearish view (-4.1%) expecting a short-term support breakdown and failed bounce.',
  'D+2 소폭 조정(-1.3%) 후 D+5 약보합 반등(+0.4%), 이후 하방 채널 이탈(-4.6%) 궤적 정밀 적중.':
    'Mild D+2 pullback (-1.3%), muted D+5 bounce (+0.4%), followed by a clean channel breakdown (-4.6%).',
  '주중 저항 확인 후 후반 하방 조정 파동(-4.3%) 적중.':
    'Mid-week resistance rejection followed by the late-week downward wave (-4.3%).',
  'D+5 반등 이후 매물대 저항에 따른 하락 전환 적중.':
    'Captured the D+5 bounce rejection at overhead supply and subsequent downturn.',
  '하락 방향성은 적중했으나 낙폭을 다소 보수적으로 산정.':
    'Captured the bearish direction accurately while sizing the drawdown conservatively.',
  '박스권 상단 저항 후 완만한 약세 마감 예측.':
    'Called range-top resistance rejection followed by a modest weak close.',

  // Seed comment & notification
  'D+3 레버리지 청산 눌림목 위치에 동의합니다. 그 구간이 핵심 지지 테스트가 될 듯합니다.':
    'Agree on the D+3 leverage-flush pullback level — that zone looks like the key support test.',
  '님이 회원님의 BTC/USDT 7일 예측 경로에 의견을 남겼습니다.':
    ' commented on your BTC/USDT 7D forecast path.',

  // Practice Replay Scenarios (REPLAY_SCENARIOS)
  '주요 가격대': 'Key Price Levels',
  '차트 구조': 'Chart Structure',
  '당시 시장 배경': 'Market Context',
  '변동성 수축 구간': 'Volatility Compression',
  '고점 박스권 경계': 'Range High Inflection',
  '단기 급락 직후': 'Post-Selloff Bounce Check',
  '전고점 저항 돌파전': 'Breakout Resistance Test',
  '삼중 고점 후 약세 이탈': 'Triple-Top Breakdown',
  '고가권 하단 붕괴 경계': 'High-Range Floor Test',
  '단기 급락 이격': 'Oversold Capitulation',
  '단기 과열 이격': 'Overheated Extension',
  '박스권 변곡 구간': 'Range Inflection',
  '추세 분기 구간': 'Trend Inflection',

  '현물 ETF 승인 직후 매물 소화 및 수렴 구간':
    'Post-ETF Approval Digestion & Tight Consolidation',
  '기관 ETF 순유입 가속 & 7일 만기 $49.9K 돌파 (+17.1%)':
    'Accelerating ETF Inflows & 7D Breakout to $49.9K (+17.1%)',
  '2024년 2월 5일 기준 · 과거 6개월 실제 일봉':
    'As of Feb 5, 2024 · Past 6M Actual Daily Bars',
  '2024년 1월 현물 ETF 승인 직후 차익실현 매물로 $39K까지 눌렸다가 $42.6K 부근에서 2주간 변동성이 수축된 시점입니다.':
    'After pulling back to $39K on post-ETF profit-taking in Jan 2024, BTC compressed for two weeks near $42.6K.',
  '직전 고점 저항 $46.0K · 조정 저점 지지 $39.5K':
    'Prior peak resistance $46.0K · Pullback support $39.5K',
  '20일 이동평균선($42.1K) 안착 후 일봉 변동폭 축소':
    'Tightening daily ranges after reclaiming the 20D MA ($42.1K)',
  '현물 ETF 상장 3주 차, 초기 환매 물량과 신규 유입세 경합':
    'Week 3 of spot ETF trading: early GBTC outflows vs. new inflows',
  '2024년 2월 6일부터 기관 현물 ETF 순유입이 가속화되며 D+4에 $47.2K를 돌파했고, 이어진 매수세로 D+7에 $49.9K(+17.1%) 상승 마감했습니다.':
    'Institutional spot ETF net inflows accelerated from Feb 6, breaking $47.2K by D+4 and settling higher at $49.9K (+17.1% over 7D).',

  '제4차 반감기 당일 고점 박스권 변곡점':
    '4th Halving Day Range Inflection Point',
  '반감기 직후 $66.8K 단기 반등 후 보합권 복귀 (-0.1%)':
    'Post-Halving Bounce to $66.8K & Flat Reversion (-0.1%)',
  '2024년 4월 19일 기준 · 과거 6개월 실제 일봉':
    'As of Apr 19, 2024 · Past 6M Actual Daily Bars',
  '2024년 3월 $73K 신고가 달성 이후 고점이 낮아지는 박스권($61K~$71K) 안에서 네 번째 반감기 당일을 맞이한 시점입니다.':
    'Following the March 2024 $73K ATH, BTC traded in a descending $61K–$71K range entering the 4th halving day.',
  '박스권 상단 저항 $71.0K · 하단 지지 $61.0K':
    'Range resistance $71.0K · Range floor support $61.0K',
  '20일 이동평균선 하향 돌파 후 $63.8K 단기 반등 시도':
    'Attempting short-term bounce near $63.8K after slipping below 20D MA',
  '4월 19일 제4차 반감기 도래 및 중동 지정학적 변동성 확대':
    'Apr 19 4th Bitcoin halving amid elevated Middle East geopolitical volatility',
  '반감기 직후 D+3까지 $66.8K로 반등했으나 차익 매물이 출회되며 D+5에 $64.3K로 밀렸고, D+7 종가는 기준가 부근($63.7K, -0.1%)으로 수렴했습니다.':
    'BTC bounced to $66.8K by D+3 post-halving, pulled back to $64.3K on D+5 profit-taking, and settled flat near $63.7K (-0.1%) on D+7.',

  '8월 글로벌 증시 쇼크 & 단기 급락 직후 구간':
    'August Global Risk-Off Shock & Capitulation Rebound',
  'D+3 기술적 급반등($61.7K) 후 눌림 소화 (+9.8%)':
    'Sharp D+3 Relief Rally ($61.7K) & Consolidation (+9.8%)',
  '2024년 8월 5일 기준 · 과거 6개월 실제 일봉':
    'As of Aug 5, 2024 · Past 6M Actual Daily Bars',
  '7월 말 $68K 부근에서 엔 캐리 청산 쇼크로 닷새 만에 $54K까지 급락한 2024년 8월 5일 종가 시점입니다.':
    'Close of Aug 5, 2024 after the yen-carry unwind drove a 5-day cascade from ~$68K down to $54K.',
  '급락 전 매물대 $62.0K~$65.0K · 당일 종가 $54.0K':
    'Pre-selloff supply $62.0K–$65.0K · Session close $54.0K',
  '20일 이동평균선 대비 -15% 이상 단기 과매도 이격 발생':
    'Stretched over -15% below the 20D MA in short-term capitulation',
  '일본 금리 인상발 엔 캐리 청산 및 레버리지 대규모 강제청산 직후':
    'Immediately following BoJ rate-hike yen carry unwind and mass liquidations',
  '패닉셀 직후 D+3 만에 $61.7K까지 강하게 기술적 반등한 뒤, D+6에 $58.7K 부근 숨고르기를 거쳐 D+7에 $59.3K(+9.8%)를 회복했습니다.':
    'BTC staged a reflex rally to $61.7K by D+3, consolidated near $58.7K on D+6, and settled at $59.3K (+9.8% over 7D).',

  '7개월 장기 채널 상단 저항 및 눌림목 구간':
    '7-Month Channel Breakout Test & Pre-Election Pullback',
  '7개월 박스권 상단 돌파 & $88K 가속 랠리 (+26.6%)':
    '7-Month Range Breakout & $88K Momentum Rally (+26.6%)',
  '2024년 11월 5일 기준 · 과거 6개월 실제 일봉':
    'As of Nov 5, 2024 · Past 6M Actual Daily Bars',
  '2024년 3월 고점 이후 7개월간 이어진 장기 조정 채널 상단($72K)을 테스트한 뒤 $69.3K로 눌린 시점입니다.':
    'After testing the 7-month descending channel cap ($72K) from the March ATH, BTC pulled back to $69.3K.',
  '장기 전고점 저항 $72.0K~$73.7K · 단기 지지 $67.0K':
    'Macro ATH resistance $72.0K–$73.7K · Short-term support $67.0K',
  '10월 상승 추세선 및 20일 이동평균선($68.5K) 위 지지 유지':
    'Holding October ascending trendline and support above the 20D MA ($68.5K)',
  '미국 대선 이벤트 당일, 7개월간의 장기 매물대 소화 막바지':
    'US election day, capping seven months of overhead supply absorption',
  '기준일 직후 D+1에 +9.0% 장대양봉으로 7개월 박스권을 돌파한 뒤, D+6에 $88.6K까지 가속 상승하며 7일 만에 $87.8K(+26.6%)를 기록했습니다.':
    'Broke the 7-month range with a +9.0% candle on D+1 and accelerated to $88.6K by D+6, finishing at $87.8K (+26.6% over 7D).',

  '고점 박스권 이탈 직전 지지선 테스트 구간':
    'Range Floor Breakdown Test Below Triple Resistance',
  '$65K 지지 붕괴 & 7일 연속 하락 조정 (-9.4%)':
    '$65K Support Breakdown & 7D Stairstep Decline (-9.4%)',
  '2024년 6월 17일 기준 · 과거 6개월 실제 일봉':
    'As of Jun 17, 2024 · Past 6M Actual Daily Bars',
  '5월 말~6월 초 $71.5K 돌파를 세 차례 시도했으나 실패한 뒤 20일 이동평균선 아래로 밀리며 하단 지지를 테스트하는 시점입니다.':
    'After three failed breakout attempts near $71.5K in late May–early Jun, BTC slipped under its 20D MA to test lower support.',
  '상단 삼중 저항 $71.5K · 단기 지지 $65.0K':
    'Triple overhead resistance $71.5K · Near-term support $65.0K',
  '20일 이동평균선 하향 이탈 후 고점이 점진적으로 낮아지는 약세 흐름':
    'Lower highs forming below the 20D MA with fading bounce momentum',
  '마운트곡스 상환 예고 및 현물 수급 둔화 경계감 확산':
    'Mt. Gox repayment overhang and cooling spot inflows weighing on bids',
  '지지선 붕괴와 함께 기관·국가 물량 출회 우려가 겹치며 반등 없이 계단식 하락이 이어졌고, D+7에 $60.2K(-9.4%)까지 밀렸습니다.':
    'Support gave way amid distribution fears, driving a stairstep selloff down to $60.2K (-9.4%) by D+7.',

  '장기 고가 박스권 수렴 말기 변곡 구간':
    'Late-Stage High-Range Compression Inflection',
  '하단 붕괴 급락 후 D+7 급반등 휩쏘 (-2.2%)':
    'Floor Breakdown Flush & Sharp D+7 Whipsaw Rebound (-2.2%)',
  '2025년 2월 23일 기준 · 과거 6개월 실제 일봉':
    'As of Feb 23, 2025 · Past 6M Actual Daily Bars',
  '수개월간 $94K~$105K 고가권에 머물며 변동성이 좁아진 상태로, 박스권 하단 지지를 재테스트하는 시점입니다.':
    'Volatility compressed near the lower floor of a multi-month $94K–$105K high range ahead of a breakdown test.',
  '고가 박스 상단 $102K · 핵심 지지선 $94.0K':
    'High-range ceiling $102K · Key range floor support $94.0K',
  '단기 반등 시도가 고점을 넘지 못하며 하단 지지선 압박 누적':
    'Weak bounces failing below prior swing highs while floor pressure builds',
  '관세·매크로 불확실성 속 고점 피로감과 롱 포지션 누적 구간':
    'Macro tariff uncertainty colliding with crowded long positioning near range lows',
  '직후 $94K 지지가 깨지며 D+4까지 -12% 이상 급락했으나, D+7 급반등으로 -2.2% 마감하며 극심한 양방향 변동성을 보였습니다.':
    'Loss of $94K triggered a -12%+ cascade into D+4 before a sharp D+7 squeeze closed at -2.2%.',

  // Seed community posts & comments
  '9월 18일 라운드 복기: D+2 소폭 조정 뒤 채널 이탈 적중':
    'Sep 18 Round Review: Small D+2 Dip Before Channel Breakdown Hit',
  '초반 이틀 변동성 수축 구간에서 과도하게 반등을 그리지 않고 D+5 저항 확인 후 하방 이탈 궤적으로 잡았던 점이 유효했습니다. 형태 유사도 점수(25점)가 전체 총점 차이를 크게 벌렸습니다.':
    'Avoiding an overly aggressive bounce during early volatility compression and plotting the breakdown after D+5 resistance paid off. Shape similarity (25 pts) created most of the lead.',
  '실현 변동성 σ 3%대 수축 구간의 7D 변곡점 배치 기준':
    'Where to Place 7D Inflection Points When Daily Vol Compresses Near 3%',
  '최근 현물 ETF 유출입과 무기한 선물 펀딩비가 모두 중립권으로 내려오면 D+7 단일 종가보다 D+2~D+4 사이 중간 눌림 폭이 경로 점수(50점)를 좌우합니다.':
    'When spot ETF flows and perpetual funding neutralize, interim drawdown across D+2–D+4 matters more to the 50-pt path score than the D+7 close alone.',
  '상승 관점일 때 중간 눌림목을 몇 개 앵커로 나누시나요?':
    'When Plotting a Bullish 7D Path, How Many Interim Anchors Do You Use?',
  '만기 D+7 앵커만 찍어 직선으로 이어도 방향은 맞출 수 있지만, 실전 정산에서는 D+2~D+3 흔들림을 한 번 꺾어주는 편이 경로 점수 방어에 유리할지 의견 궁금합니다.':
    'A single D+7 anchor captures direction, yet adding a shakeout bend around D+2–D+3 may defend path precision in live settlement. Curious how others model it.',
  '강한 추세장이 아니면 보통 D+2 또는 D+3에 눌림목 앵커 1개만 추가해 3~4점 체제로 맞추는 편이 안정적이었습니다.':
    'Outside strong trend breakouts, adding one pullback anchor at D+2 or D+3 for 3–4 total points has been most consistent.',
  'D+5 반등 고점 위치를 거의 일봉 종가 수준으로 맞추신 점이 인상적이었습니다.':
    'Nailing the D+5 relief peak close to the actual daily close was impressive.',
};

const DATA_EN_TO_KO: Record<string, string> = Object.fromEntries(
  Object.entries(DATA_KO_TO_EN).map(([ko, en]) => [en, ko])
);

export function localizeDataText(raw: string | null | undefined, locale: Locale): string {
  if (!raw) return raw ?? '';
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  if (locale === 'en') {
    const exact = DATA_KO_TO_EN[trimmed] ?? KO_TO_EN_EXACT[trimmed];
    if (exact !== undefined) return exact;

    // Dynamic auto-generated comment: "BTC/USDT 향후 7일 목표가 $79,541 (+4.80%) 시나리오"
    const koScenario = trimmed.match(
      /^([A-Z0-9/]+) 향후 (\d+)일 목표가 (\$[\d,]+(?:\.\d+)?) \(([^)]+)\) 시나리오$/
    );
    if (koScenario) {
      const [, ticker, days, price, pct] = koScenario;
      return `${ticker} ${days}D scenario targeting ${price} (${pct})`;
    }

    // Dynamic revision prefix: "[v2 수정] ..."
    const koRevision = trimmed.match(/^\[v(\d+)\s*수정\]\s*(.+)$/);
    if (koRevision) {
      const [, ver, rest] = koRevision;
      return `[v${ver} Revised] ${localizeDataText(rest, 'en')}`;
    }

    // Dynamic notifications stored in KO
    const koReply = trimmed.match(/^님이 회원님의 ([A-Z0-9/]+) (\d+)일 시나리오에 맞불 작도를 제출했습니다\.$/);
    if (koReply) {
      return ` submitted a counter-trajectory to your ${koReply[1]} ${koReply[2]}D scenario.`;
    }
    const koComment = trimmed.match(/^님이 회원님의 ([A-Z0-9/]+) 예측에 코멘트를 남겼습니다\.$/);
    if (koComment) {
      return ` commented on your ${koComment[1]} forecast.`;
    }

    // Dynamic Practice Random Scenario patterns
    const koRandomTitle = trimmed.match(/^(\d{4}-\d{2}-\d{2}) 실제 BTC 7일 구간$/);
    if (koRandomTitle) {
      return `Actual BTC 7D · ${koRandomTitle[1]}`;
    }
    const koRandomSub = trimmed.match(/^(\d{4}-\d{2}-\d{2}) 기준 · 과거 실제 일봉$/);
    if (koRandomSub) {
      return `As of ${koRandomSub[1]} · Historical Daily Bars`;
    }
    const koRandomReveal = trimmed.match(
      /^(\d{4}-\d{2}-\d{2}) 기준 · 7일 실제 종가 (\$[\d,]+) \(([^)]+)\)$/
    );
    if (koRandomReveal) {
      return `As of ${koRandomReveal[1]} · Actual D+7 Close ${koRandomReveal[2]} (${koRandomReveal[3]})`;
    }
    const koRandomHint = trimmed.match(
      /^(\d{4}-\d{2}-\d{2}) 종가\((\$[\d,]+)\) 기준 실전 캔들·거래량 구간입니다\.$/
    );
    if (koRandomHint) {
      return `Historical BTC daily OHLCV regime as of ${koRandomHint[1]} (${koRandomHint[2]}).`;
    }
    const koRandomTakeaway = trimmed.match(
      /^(\d{4}-\d{2}-\d{2}) 이후 7거래일간 (\$[\d,]+)에서 (\$[\d,]+)\(([^)]+)\)로 마감했습니다\.$/
    );
    if (koRandomTakeaway) {
      return `Over 7 days from ${koRandomTakeaway[1]}, BTC moved from ${koRandomTakeaway[2]} to ${koRandomTakeaway[3]} (${koRandomTakeaway[4]}).`;
    }

    return HAS_KOREAN_REGEX.test(trimmed) ? translateKoToEn(trimmed) : raw;
  }

  // locale === 'ko'
  const exactKo = DATA_EN_TO_KO[trimmed];
  if (exactKo !== undefined) return exactKo;

  const enRandomTitle = trimmed.match(/^Actual BTC 7D · (\d{4}-\d{2}-\d{2})$/);
  if (enRandomTitle) {
    return `${enRandomTitle[1]} 실제 BTC 7일 구간`;
  }
  const enRandomSub = trimmed.match(/^As of (\d{4}-\d{2}-\d{2}) · Historical Daily Bars$/);
  if (enRandomSub) {
    return `${enRandomSub[1]} 기준 · 과거 실제 일봉`;
  }
  const enRandomReveal = trimmed.match(
    /^As of (\d{4}-\d{2}-\d{2}) · Actual D\+7 Close (\$[\d,]+) \(([^)]+)\)$/
  );
  if (enRandomReveal) {
    return `${enRandomReveal[1]} 기준 · 7일 실제 종가 ${enRandomReveal[2]} (${enRandomReveal[3]})`;
  }
  const enRandomHint = trimmed.match(
    /^Historical BTC daily OHLCV regime as of (\d{4}-\d{2}-\d{2}) \((\$[\d,]+)\)\.$/
  );
  if (enRandomHint) {
    return `${enRandomHint[1]} 종가(${enRandomHint[2]}) 기준 실전 캔들·거래량 구간입니다.`;
  }
  const enRandomTakeaway = trimmed.match(
    /^Over 7 days from (\d{4}-\d{2}-\d{2}), BTC moved from (\$[\d,]+) to (\$[\d,]+) \(([^)]+)\)\.$/
  );
  if (enRandomTakeaway) {
    return `${enRandomTakeaway[1]} 이후 7거래일간 ${enRandomTakeaway[2]}에서 ${enRandomTakeaway[3]}(${enRandomTakeaway[4]})로 마감했습니다.`;
  }

  const enScenario = trimmed.match(
    /^([A-Z0-9/]+) (\d+)D (?:target|scenario targeting) (\$[\d,]+(?:\.\d+)?) \(([^)]+)\)(?: scenario)?$/
  );
  if (enScenario) {
    const [, ticker, days, price, pct] = enScenario;
    return `${ticker} 향후 ${days}일 목표가 ${price} (${pct}) 시나리오`;
  }

  const enRevision = trimmed.match(/^\[v(\d+)\s*Revised\]\s*(.+)$/);
  if (enRevision) {
    const [, ver, rest] = enRevision;
    return `[v${ver} 수정] ${localizeDataText(rest, 'ko')}`;
  }

  return raw;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: 'ko',
      setLocale: () => {},
      toggleLocale: () => {},
      t: (ko: string) => ko,
    };
  }
  return ctx;
}
