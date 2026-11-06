import type { MarketBar, MarketLandmark } from '../domain/types';
import { formatDateStr, parseDateStr } from '../domain/tradingCalendar';
import { getNextCalendarDays } from '../domain/interpolation';

export const BTC_TICKER = 'BTC/USDT';
export const BTC_DAILY_VOLATILITY = 0.032;
export const DEFAULT_BASE_DATE = '2026-10-02';

export interface ReplayScenario {
  id: string;
  code: string;
  title: string;
  revealTitle: string;
  subtitle: string;
  difficulty: 'NORMAL' | 'HARD' | 'EXPERT';
  marketHint: string;
  contextCues: { label: string; value: string }[];
  revealTakeaway: string;
  baseDate: string;
  basePrice: number;
  evalDates: string[];
  historyBars: MarketBar[]; // 과거 6개월(180일) 일봉 (블라인드 퀴즈에서 노출)
  futureBars: MarketBar[];  // 향후 20일 실제 일봉 (제출 즉시 1초 만에 공개)
}

function createSeededRandom(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAST_HISTORY_DAYS = 185; // 약 6개월 일봉 (baseDate 포함 185봉)

const REALISTIC_BTC_210_OHLC: [number, number, number, number][] = [
  [80905.53, 82850.00, 80731.14, 81447.01],
  [81447.01, 81708.32, 79500.00, 80006.00],
  [80006.00, 80500.00, 79181.48, 80193.17],
  [80193.18, 81080.00, 80129.85, 80678.40],
  [80678.41, 82479.32, 80279.77, 82210.07],
  [82210.07, 82380.00, 80462.97, 81745.65],
  [81745.66, 81788.00, 79843.59, 80504.47],
  [80504.47, 81324.64, 78754.65, 79313.61],
  [79313.61, 82048.13, 78922.00, 81089.99],
  [81090.00, 81664.45, 78659.00, 79113.21],
  [79113.20, 79227.77, 77640.00, 78148.05],
  [78148.05, 78599.99, 76735.16, 77457.67],
  [77457.67, 77800.00, 76051.00, 77001.87],
  [77001.88, 77414.62, 76144.71, 76834.36],
  [76834.36, 77853.04, 76516.74, 77552.23],
  [77552.24, 78200.00, 76719.47, 77615.52],
  [77615.52, 77900.00, 75359.18, 75539.50],
  [75539.50, 77404.18, 74289.60, 76752.01],
  [76752.00, 77543.15, 76108.00, 77064.96],
  [77064.96, 77905.52, 76914.25, 77322.01],
  [77322.01, 78080.00, 75677.97, 75930.01],
  [75930.01, 76174.15, 74243.99, 74449.30],
  [74449.31, 74590.77, 72582.82, 73617.51],
  [73617.52, 74514.10, 72512.49, 73460.78],
  [73460.78, 74143.76, 73216.00, 73884.38],
  [73884.38, 74275.66, 73400.00, 73674.39],
  [73674.39, 74092.00, 70686.68, 71408.90],
  [71408.90, 71408.90, 66193.00, 66760.83],
  [66760.84, 67516.00, 64092.49, 64142.75],
  [64142.75, 64764.32, 61383.56, 63885.99],
  [63885.99, 63978.00, 59130.91, 61056.47],
  [61056.47, 61530.05, 59500.00, 60884.62],
  [60884.62, 64234.68, 60746.00, 63332.01],
  [63332.01, 64200.00, 62408.00, 63085.99],
  [63086.00, 63526.01, 60780.00, 61730.00],
  [61730.00, 62857.99, 60755.00, 61510.99],
  [61510.99, 63933.02, 61510.99, 63625.99],
  [63626.00, 64394.44, 62829.81, 63580.01],
  [63580.00, 64762.77, 63418.66, 64458.01],
  [64458.01, 65800.00, 63678.83, 65746.45],
  [65746.45, 67292.15, 65354.00, 66328.74],
  [66328.74, 66992.00, 65360.92, 65675.01],
  [65675.02, 66445.93, 63915.77, 64509.40],
  [64509.40, 64806.00, 62272.07, 62958.01],
  [62958.01, 63666.00, 62316.44, 63543.91],
  [63543.90, 64388.00, 63184.21, 64298.01],
  [64298.01, 64588.00, 63270.00, 63311.99],
  [63312.00, 65622.83, 63312.00, 64020.01],
  [64020.01, 64275.38, 61938.00, 62734.57],
  [62734.57, 63239.06, 59102.70, 61077.99],
  [61078.00, 61962.40, 58115.01, 59794.00],
  [59794.64, 60759.99, 58337.00, 60097.27],
  [60097.27, 60941.17, 59855.16, 60029.00],
  [60029.01, 60545.01, 58905.00, 59577.01],
  [59577.01, 60780.57, 58900.01, 60260.21],
  [60260.20, 60276.54, 58201.00, 58624.71],
  [58624.71, 61334.00, 57800.19, 60024.00],
  [60024.00, 62200.00, 59588.00, 61560.00],
  [61560.00, 62979.86, 61248.86, 62583.26],
  [62583.26, 63461.99, 62328.24, 63144.01],
  [63144.01, 63999.00, 62436.59, 63650.00],
  [63650.01, 64700.00, 61306.84, 64042.02],
  [64042.93, 64314.00, 62671.39, 63363.99],
  [63364.00, 63761.99, 61544.56, 62290.00],
  [62290.01, 63500.00, 61705.29, 63230.00],
  [63230.01, 64692.83, 62926.01, 64161.72],
  [64161.72, 64504.11, 63819.00, 63819.00],
  [63819.01, 64290.11, 63640.83, 63780.00],
  [63780.00, 64425.00, 61824.97, 62334.52],
  [62334.52, 65100.00, 62272.20, 65043.98],
  [65043.99, 65600.00, 64485.00, 64756.28],
  [64756.28, 64997.52, 63748.74, 63830.20],
  [63830.20, 64387.99, 62537.56, 63931.67],
  [63931.67, 64865.00, 63886.65, 64834.22],
  [64834.21, 64967.25, 64280.00, 64722.54],
  [64722.55, 65799.00, 63100.00, 65255.51],
  [65255.51, 66956.15, 65148.75, 66556.16],
  [66556.15, 66739.89, 65553.67, 66114.49],
  [66114.50, 66313.14, 64650.00, 65098.97],
  [65098.98, 65808.59, 63739.75, 64139.99],
  [64140.00, 64475.28, 63810.00, 64375.00],
  [64375.01, 65577.00, 64293.81, 65399.99],
  [65400.00, 65744.60, 63605.56, 63755.86],
  [63755.86, 64100.00, 62742.47, 63915.00],
  [63915.00, 64744.81, 63267.34, 63984.28],
  [63984.29, 65176.60, 63603.92, 64780.02],
  [64780.03, 65409.56, 62466.00, 62887.88],
  [62887.88, 63150.00, 62275.00, 62823.64],
  [62823.65, 63796.33, 62806.58, 63570.00],
  [63570.01, 64080.00, 62300.00, 63520.00],
  [63520.00, 64549.16, 63322.01, 64106.56],
  [64106.55, 65025.22, 63880.00, 64665.23],
  [64665.24, 64999.00, 64172.00, 64323.61],
  [64323.61, 65390.99, 64166.00, 64923.19],
  [64923.20, 65192.54, 64784.19, 64962.60],
  [64962.60, 65474.46, 64730.08, 64901.59],
  [64901.59, 65391.14, 63806.27, 63970.01],
  [63970.01, 64515.43, 63238.00, 63600.00],
  [63600.01, 64500.00, 63310.34, 63479.99],
  [63479.99, 64010.00, 62802.27, 63490.86],
  [63490.86, 63617.45, 62535.24, 63043.56],
  [63043.56, 63187.98, 62920.00, 63086.01],
  [63086.01, 63390.00, 62716.00, 62900.00],
  [62900.00, 64610.01, 62751.10, 64532.10],
  [64532.11, 65058.81, 64027.85, 64725.42],
  [64725.42, 70000.00, 64166.00, 69334.79],
  [69334.78, 73400.00, 68902.22, 73025.15],
  [73027.02, 79500.00, 73027.02, 78338.03],
  [78338.03, 78828.15, 76500.00, 77074.93],
  [77074.94, 78052.85, 75545.67, 77734.00],
  [77734.00, 80000.00, 76670.01, 78992.75],
  [78992.76, 81272.62, 77851.00, 78539.14],
  [78539.13, 79251.60, 77632.58, 79023.75],
  [79023.75, 80848.74, 78546.13, 80249.58],
  [80249.59, 81478.87, 76888.00, 77845.87],
  [77845.88, 78330.00, 77382.37, 78230.00],
  [78230.00, 79400.00, 77000.00, 77682.00],
  [77682.00, 79250.00, 77392.00, 78581.29],
  [78581.30, 79220.61, 76420.00, 77439.00],
  [77439.01, 77792.00, 76264.00, 77340.01],
  [77340.01, 82300.00, 76968.00, 81270.37],
  [81270.37, 81427.75, 78660.00, 79660.77],
  [79660.77, 80200.00, 79442.00, 79831.75],
  [79831.75, 80559.99, 79233.00, 80341.83],
  [80341.83, 80443.99, 78680.00, 79112.01],
  [79112.00, 79485.00, 77620.01, 78455.80],
  [78455.80, 79760.00, 77770.00, 78306.43],
  [78306.43, 78564.39, 76464.00, 76568.72],
  [76568.73, 79890.00, 76046.58, 77225.70],
  [77225.71, 77505.67, 77059.75, 77278.73],
  [77278.73, 77450.00, 76500.00, 76842.01],
  [76842.01, 79600.00, 76388.72, 78189.21],
  [78189.20, 78250.46, 74967.97, 75644.48],
  [75644.48, 76560.76, 75064.82, 76206.01],
  [76206.00, 77179.47, 76000.00, 76417.01],
  [76417.01, 81400.00, 76296.00, 80883.87],
  [80883.86, 81951.00, 80844.58, 81249.99],
  [81249.99, 81497.33, 80126.04, 81178.00],
  [81178.01, 87395.67, 80850.22, 86620.00],
  [86620.01, 86717.60, 85114.00, 86208.56],
  [86208.57, 87278.54, 83500.01, 84397.60],
  [84397.60, 84942.45, 82874.93, 84410.24],
  [84410.24, 85255.00, 83183.00, 84099.99],
  [84100.00, 84473.58, 83798.00, 84433.10],
  [84433.11, 85159.03, 84132.00, 84472.00],
  [84472.01, 84999.00, 82563.00, 83500.01],
  [83500.01, 84563.99, 82775.94, 83663.66],
  [83663.66, 85649.95, 82956.11, 83623.60],
  [83623.59, 85273.65, 83186.00, 84880.05],
  [84880.05, 87220.00, 83888.00, 84518.01],
  [84518.00, 85037.63, 84456.02, 84753.56],
  [84753.57, 86800.00, 84719.99, 86530.00],
  [86530.00, 86999.11, 84972.01, 85766.87],
  [85766.87, 86698.99, 85136.11, 85549.93],
  [85549.94, 85598.22, 82787.25, 83321.81],
  [83321.81, 83521.15, 80393.56, 81754.45],
  [81754.46, 83528.98, 81603.52, 82635.55],
  [82635.56, 83173.29, 82545.82, 82988.36],
  [82988.35, 84199.00, 82804.65, 83773.12],
  [83773.12, 84352.00, 81750.09, 81850.00],
  [81850.01, 84168.00, 81033.66, 83169.00],
  [83169.01, 84146.72, 81444.42, 81682.01],
  [81682.02, 82634.30, 79800.00, 82245.93],
  [82245.93, 82940.81, 80809.25, 81615.64],
  [81615.91, 81770.01, 80819.66, 81491.04],
  [81491.04, 82295.47, 80684.36, 82116.00],
  [82116.00, 83158.00, 81748.85, 81938.40],
  [81938.39, 83439.00, 81200.00, 83028.15],
  [83028.14, 84898.00, 82635.32, 84093.42],
  [84093.42, 84377.21, 80939.54, 81416.09],
  [81416.09, 82060.88, 80513.00, 81189.43],
  [81189.44, 81213.64, 79220.74, 80888.16],
  [80888.15, 81033.69, 79845.86, 80154.09],
  [80154.09, 80844.70, 79368.67, 80150.56],
  [80150.56, 81300.00, 79506.00, 80909.77],
  [80909.77, 81823.00, 80397.14, 81343.50],
  [81343.51, 81971.00, 77910.00, 77991.89],
  [77991.89, 78804.01, 76325.98, 77368.77],
  [77368.76, 77796.01, 77114.01, 77582.02],
  [77582.02, 78422.23, 77517.20, 78354.00],
  [78354.01, 78878.01, 76705.00, 76816.00],
  [76816.01, 78063.30, 76388.88, 77453.86],
  [77453.85, 81196.01, 75736.38, 80504.01],
  [80504.01, 80918.01, 75208.42, 76088.01],
  [76088.01, 76416.24, 74888.00, 75897.47],
  [75897.47, 77115.47, 75290.29, 76808.24],
  [76808.24, 78659.93, 76577.82, 78190.79],
  [78190.79, 78894.51, 77333.04, 77721.65],
  [77721.65, 79124.13, 77410.76, 78887.47],
  [78887.47, 80552.31, 78650.81, 79518.57],
  [79518.57, 79757.13, 77539.67, 78007.72],
  [78007.72, 78319.75, 75761.88, 76915.61],
  [76915.61, 77686.69, 76377.20, 77300.19],
  [77300.19, 79237.79, 77145.59, 79000.79],
  [79000.79, 80747.10, 78684.79, 80185.80],
  [80185.80, 81231.43, 79865.06, 80827.29],
  [80827.29, 81312.25, 79459.04, 80099.84],
  [80099.84, 81948.23, 79939.64, 81621.74],
  [81621.74, 84167.03, 81376.87, 83499.04],
  [83499.04, 84417.53, 82499.98, 82914.55],
  [82914.55, 83829.10, 82582.89, 83412.04],
  [83412.04, 83745.69, 81752.14, 82577.92],
  [82577.92, 83986.04, 82330.19, 83651.43],
  [83651.43, 84910.72, 83400.48, 84404.29],
  [84404.29, 85079.52, 83814.48, 84151.08],
  [84151.08, 85079.27, 83814.48, 84655.99],
  [84655.99, 85163.93, 83811.55, 84232.71],
  [84232.71, 85330.76, 83980.01, 84990.80],
  [84990.80, 85757.41, 84650.84, 85330.76],
  [85330.76, 85929.10, 84989.44, 85586.75],
];

/**
 * 실제 시장 일봉 구조를 반영한 210일 BTC/USDT OHLC 시계열 (과거 185일 + 미래 25일)
 * 기준일(2026-10-02, index 184) 종가 = $75,897.47
 */
function buildDeterministicBtcBars(): MarketBar[] {
  const baseDate = parseDateStr(DEFAULT_BASE_DATE);
  const baseIdx = PAST_HISTORY_DAYS - 1; // 184 ("2026-10-02")

  return REALISTIC_BTC_210_OHLC.map((ohlc, idx) => {
    const offset = idx - baseIdx;
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offset);
    return {
      date: formatDateStr(d),
      open: ohlc[0],
      high: ohlc[1],
      low: ohlc[2],
      close: ohlc[3],
    };
  });
}

const cachedBtcBars: MarketBar[] = buildDeterministicBtcBars();
const liveSyncStatus: "synced" | "fallback" | "loading" = "synced";
const marketListeners = new Set<() => void>();

export function getBtcSyncStatus(): "synced" | "fallback" | "loading" {
  return liveSyncStatus;
}

export function subscribeBtcMarket(cb: () => void): () => void {
  marketListeners.add(cb);
  return () => marketListeners.delete(cb);
}

function notifyMarketListeners() {
  marketListeners.forEach(cb => cb());
}

export async function syncBinanceBtcDailyBars(): Promise<MarketBar[]> {
  return cachedBtcBars;
}

export function getBtcHistoryBars(): MarketBar[] {
  return cachedBtcBars;
}

export function getCurrentBtcPrice(asOfDate: string = DEFAULT_BASE_DATE): number {
  const bars = getBtcHistoryBars();
  const match = bars.find(b => b.date === asOfDate);
  if (match) return match.close;
  const earlier = bars.filter(b => b.date <= asOfDate);
  if (earlier.length > 0) return earlier[earlier.length - 1].close;
  return bars[0].close;
}

export function getBtcLandmarks(basePrice: number): MarketLandmark[] {
  const roundPrice = (p: number) => parseFloat(p.toFixed(2));
  return [
    {
      id: 'lm_resistance',
      label: '상단 매물대 저항 (Orderbook Wall)',
      shortLabel: '상단 저항선',
      category: 'resistance',
      price: roundPrice(basePrice * 1.085),
      changePct: 8.5,
      benchmarkElo: 1750,
    },
    {
      id: 'lm_consensus',
      label: '상위 1% 고수 평균 목표선 (Top Tier)',
      shortLabel: '고수 평균선',
      category: 'consensus',
      price: roundPrice(basePrice * 1.052),
      changePct: 5.2,
      benchmarkElo: 1650,
    },
    {
      id: 'lm_support',
      label: '단기 지지 구간 (20D EMA Support)',
      shortLabel: '단기 지지선',
      category: 'support',
      price: roundPrice(basePrice * 0.945),
      changePct: -5.5,
      benchmarkElo: 1450,
    },
  ];
}

/**
 * Practice 모드 (리플레이 랩)용 5개 기출 블라인드 시나리오 생성
 */
function buildScenarioBars(
  seed: number,
  baseDateStr: string,
  basePrice: number,
  pastDailyReturns: number[],
  futureDailyReturns: number[]
): { historyBars: MarketBar[]; futureBars: MarketBar[]; evalDates: string[] } {
  const rand = createSeededRandom(seed);
  const baseDate = parseDateStr(baseDateStr);
  const scenarioHistoryCount = 180; // 과거 6개월(180일) 일봉

  // 과거 180일 날짜 (baseDate 포함 총 180봉)
  const pastDates: string[] = [];
  for (let offset = -(scenarioHistoryCount - 1); offset <= 0; offset++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offset);
    pastDates.push(formatDateStr(d));
  }

  const evalDates = getNextCalendarDays(baseDateStr, 20);

  // 과거 180일 종가 역산 (최근 구간은 시나리오 고유 패턴, 이전 구간은 6개월 추세 파동)
  const pastCloses: number[] = new Array(scenarioHistoryCount).fill(basePrice);
  pastCloses[scenarioHistoryCount - 1] = basePrice;
  for (let i = scenarioHistoryCount - 2; i >= 0; i--) {
    const recentIdx = i - (scenarioHistoryCount - 1 - pastDailyReturns.length);
    const daysAgo = scenarioHistoryCount - 1 - i;
    const macroWave =
      Math.sin((daysAgo + seed) / 17) * 0.0042 +
      Math.cos((daysAgo + seed) / 35) * 0.003 +
      (rand() - 0.49) * 0.022;
    const r = recentIdx >= 0 ? (pastDailyReturns[recentIdx] ?? macroWave) : macroWave;
    pastCloses[i] = parseFloat((pastCloses[i + 1] / (1 + r)).toFixed(2));
  }

  const historyBars: MarketBar[] = pastDates.map((date, idx) => {
    const close = pastCloses[idx];
    const open = idx > 0 ? pastCloses[idx - 1] : close * 0.99;
    const high = Math.max(open, close) + close * (0.005 + rand() * 0.01);
    const low = Math.min(open, close) - close * (0.005 + rand() * 0.01);
    return {
      date,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    };
  });

  // 미래 20일 실제 종가 계산
  const futureBars: MarketBar[] = [];
  let prevClose = basePrice;
  for (let i = 0; i < 20; i++) {
    const r = futureDailyReturns[i] ?? 0;
    const close = parseFloat((prevClose * (1 + r)).toFixed(2));
    const open = prevClose;
    const high = Math.max(open, close) + close * (0.005 + rand() * 0.01);
    const low = Math.min(open, close) - close * (0.005 + rand() * 0.01);
    futureBars.push({
      date: evalDates[i],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close,
    });
    prevClose = close;
  }

  return { historyBars, futureBars, evalDates };
}

export const REPLAY_SCENARIOS: ReplayScenario[] = [
  (() => {
    const baseDate = '2024-02-05';
    const basePrice = 42658;
    // 2023년 8월 ~ 2024년 2월: $26k~$30k 횡보 후 10월~1월 현물 ETF 기대감 상승($46k) 및 1월 말 $39.5k 조정 후 $42.6k 수렴
    const recent29Returns = [
      0.032, -0.014, 0.008, -0.006, -0.068, -0.004, 0.021, -0.019, -0.002, -0.028,
      0.004, -0.038, 0.007, 0.003, 0.045, 0.005, -0.012, 0.014, 0.002, -0.011,
      0.015, 0.002, 0.001, -0.009, -0.011,
    ];
    // 2024-02-06 ~ 2024-02-25 실제 20일 돌파 궤적 ($42,658 -> $51,730, +21.3%)
    const future20Returns = [
      0.010, 0.029, 0.022, 0.041, 0.013,
      0.011, 0.034, -0.004, 0.042, 0.003,
      0.005, -0.009, 0.011, -0.007, 0.009,
      -0.008, -0.011, -0.012, 0.016, 0.004,
    ];
    const { historyBars, futureBars, evalDates } = buildScenarioBars(
      20240205,
      baseDate,
      basePrice,
      recent29Returns,
      future20Returns
    );
    return {
      id: 'replay_2024_etf_breakout',
      code: '2024.02',
      title: '현물 ETF 승인 직후 매물 소화 및 수렴 구간',
      revealTitle: '기관 ETF 순유입 전환 & $51.7K 돌파 (+21.3%)',
      subtitle: '2024년 2월 5일 기준 · 과거 6개월 실제 일봉',
      difficulty: 'NORMAL',
      marketHint: '2024년 1월 현물 ETF 승인 직후 차익실현 매물로 $39K까지 눌렸다가 $42.6K 부근에서 2주간 변동성이 수축된 시점입니다.',
      contextCues: [
        { label: '주요 가격대', value: '직전 고점 저항 $46.0K · 조정 저점 지지 $39.5K' },
        { label: '차트 구조', value: '20일 이동평균선($42.1K) 안착 후 일봉 변동폭 축소' },
        { label: '당시 시장 배경', value: '현물 ETF 상장 3주 차, 초기 환매 물량과 신규 유입세 경합' },
      ],
      revealTakeaway: '2024년 2월 6일부터 기관 현물 ETF 순유입이 본격화되며 D+10에 $52K를 돌파했고, 후반 10일간 $51K~52K 고가권 지지 테스트를 거쳐 +21.3% 상승 마감했습니다.',
      baseDate,
      basePrice,
      evalDates,
      historyBars,
      futureBars,
    };
  })(),
  (() => {
    const baseDate = '2024-04-19';
    const basePrice = 63818;
    // 2024년 3월 $73K 신고가 경신 후 4월 중순 반감기 직전 $61K~$71K 박스권 조정
    const recent29Returns = [
      -0.025, 0.042, 0.048, -0.005, 0.012, -0.014, 0.021, -0.003, -0.052, 0.008,
      0.015, 0.024, 0.032, -0.036, 0.022, -0.011, -0.048, -0.029, -0.028, 0.005,
      -0.039, 0.036, 0.004,
    ];
    // 2024-04-20 ~ 2024-05-09 실제 반감기 직후 20일 궤적 (초반 $66.8k 반등 -> D+11 $56.8k 투매 -> $63.0k 회복)
    const future20Returns = [
      0.018, -0.001, 0.029, -0.006, -0.032,
      0.003, -0.011, -0.005, -0.004, 0.011,
      -0.050, -0.038, 0.015, 0.064, 0.016,
      0.002, -0.013, -0.014, -0.018, 0.029,
    ];
    const { historyBars, futureBars, evalDates } = buildScenarioBars(
      20240419,
      baseDate,
      basePrice,
      recent29Returns,
      future20Returns
    );
    return {
      id: 'replay_2024_halving_whipsaw',
      code: '2024.04',
      title: '제4차 반감기 당일 고점 박스권 변곡점',
      revealTitle: '초반 $66.8K 반등 후 $58K 조정 및 회복 (-1.2%)',
      subtitle: '2024년 4월 19일 기준 · 과거 6개월 실제 일봉',
      difficulty: 'HARD',
      marketHint: '2024년 3월 $73K 신고가 달성 이후 고점이 낮아지는 박스권($61K~$71K) 안에서 네 번째 반감기 당일을 맞이한 시점입니다.',
      contextCues: [
        { label: '주요 가격대', value: '박스권 상단 저항 $71.0K · 하단 지지 $61.0K' },
        { label: '차트 구조', value: '20일 이동평균선 하향 돌파 후 $63.8K 단기 반등 시도' },
        { label: '당시 시장 배경', value: '4월 19일 제4차 반감기 도래 및 중동 지정학적 변동성 확대' },
      ],
      revealTakeaway: '반감기 직후 D+3까지 $66.8K로 소폭 반등했으나 차익 매물이 출회되며 D+12에 $58K 초반까지 밀렸고, 이후 저가 매수세 유입으로 D+20에 기준가 부근($63.0K)을 회복했습니다.',
      baseDate,
      basePrice,
      evalDates,
      historyBars,
      futureBars,
    };
  })(),
  (() => {
    const baseDate = '2024-08-05';
    const basePrice = 54018;
    // 2024년 7월 말 $68K에서 8월 초 엔 캐리 청산 쇼크로 5일 연속 급락해 $54K에 도달한 시점
    const recent29Returns = [
      0.012, 0.038, 0.021, 0.004, -0.011, 0.042, -0.006, 0.009, -0.021, -0.005,
      0.031, 0.006, -0.024, -0.008, -0.022, 0.011, -0.058, -0.016, -0.042, -0.072,
    ];
    // 2024-08-06 ~ 2024-08-25 실제 20일 V자 반등 및 횡보 후 $64.2K 마감 (+18.9%)
    const future20Returns = [
      0.037, -0.016, 0.119, -0.014, 0.001,
      -0.035, 0.010, 0.021, -0.031, -0.020,
      0.023, 0.009, -0.017, 0.018, -0.007,
      0.036, -0.013, 0.061, 0.002, 0.001,
    ];
    const { historyBars, futureBars, evalDates } = buildScenarioBars(
      20240805,
      baseDate,
      basePrice,
      recent29Returns,
      future20Returns
    );
    return {
      id: 'replay_2024_yen_carry_crash',
      code: '2024.08',
      title: '8월 글로벌 증시 쇼크 & 단기 급락 직후 구간',
      revealTitle: 'D+3 기술적 급반등 및 쌍바닥 확인 후 회복 (+18.9%)',
      subtitle: '2024년 8월 5일 기준 · 과거 6개월 실제 일봉',
      difficulty: 'HARD',
      marketHint: '7월 말 $68K 부근에서 엔 캐리 청산 쇼크로 닷새 만에 $54K까지 급락한 2024년 8월 5일 종가 시점입니다.',
      contextCues: [
        { label: '주요 가격대', value: '급락 전 매물대 $62.0K~$65.0K · 당일 종가 $54.0K' },
        { label: '차트 구조', value: '20일 이동평균선 대비 -15% 이상 단기 과매도 이격 발생' },
        { label: '당시 시장 배경', value: '일본 금리 인상발 엔 캐리 청산 및 레버리지 대규모 강제청산 직후' },
      ],
      revealTakeaway: '패닉셀 직후 D+3 만에 $61.7K로 강하게 기술적 반등한 뒤, 중반부 $57.5K 재차 지지 확인(쌍바닥)을 거치며 D+20에 $64.2K(+18.9%)까지 회복했습니다.',
      baseDate,
      basePrice,
      evalDates,
      historyBars,
      futureBars,
    };
  })(),
  (() => {
    const baseDate = '2024-11-05';
    const basePrice = 69359;
    // 2024년 10월 $60K -> $72K 상승 후 미 대선 직전 $67K~$69K 눌림목
    const recent29Returns = [
      0.024, 0.018, -0.006, 0.015, 0.009, -0.019, 0.011, 0.038, 0.026, -0.005,
      -0.018, -0.021, -0.011, 0.022,
    ];
    // 2024-11-06 ~ 2024-11-25 실제 신고가 랠리 ($69,359 -> $93,100+, +34.2%)
    const future20Returns = [
      0.090, 0.004, 0.008, 0.003, 0.048,
      0.102, -0.009, 0.029, -0.035, 0.042,
      -0.006, -0.008, 0.007, 0.019, 0.022,
      0.044, 0.006, -0.012, 0.003, -0.048,
    ];
    const { historyBars, futureBars, evalDates } = buildScenarioBars(
      20241105,
      baseDate,
      basePrice,
      recent29Returns,
      future20Returns
    );
    return {
      id: 'replay_2024_nov_ath_breakout',
      code: '2024.11',
      title: '7개월 장기 채널 상단 저항 및 눌림목 구간',
      revealTitle: '7개월 박스권 상단 돌파 & $90K+ 신고가 랠리 (+34.2%)',
      subtitle: '2024년 11월 5일 기준 · 과거 6개월 실제 일봉',
      difficulty: 'EXPERT',
      marketHint: '2024년 3월 고점 이후 7개월간 이어진 장기 조정 채널 상단($72K)을 테스트한 뒤 $69.3K로 눌린 시점입니다.',
      contextCues: [
        { label: '주요 가격대', value: '장기 전고점 저항 $72.0K~$73.7K · 단기 지지 $67.0K' },
        { label: '차트 구조', value: '10월 상승 추세선 및 20일 이동평균선($68.5K) 위 지지 유지' },
        { label: '당시 시장 배경', value: '미국 대선 이벤트 당일, 7개월간의 장기 매물대 소화 막바지' },
      ],
      revealTakeaway: '기준일 직후 D+1에 +9% 장대양봉으로 7개월 박스권을 돌파한 뒤, D+6에 $88K, D+16에 $98K 부근까지 가속 상승하며 20일 만에 +34% 이상의 강세장을 기록했습니다.',
      baseDate,
      basePrice,
      evalDates,
      historyBars,
      futureBars,
    };
  })(),
];

let replayFetchInitiated = false;

/**
 * 연습 모드(REPLAY_SCENARIOS)의 4개 실제 과거 시점(2024.02 / 2024.04 / 2024.08 / 2024.11)에 대해
 * Binance 공개 API에서 실제 과거 180일 + 향후 20일(총 200봉) 1D OHLC 데이터를 로드합니다.
 */
export async function syncReplayScenariosFromBinance(): Promise<void> {
  if (replayFetchInitiated) return;
  replayFetchInitiated = true;

  try {
    await Promise.all(
      REPLAY_SCENARIOS.map(async scenario => {
        const base = parseDateStr(scenario.baseDate);
        const startDate = new Date(
          Date.UTC(base.getFullYear(), base.getMonth(), base.getDate() - 179, 0, 0, 0)
        );
        const startTimeMs = startDate.getTime();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=${startTimeMs}&limit=200`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!res.ok) return;
        const raw: unknown[] = await res.json();
        if (!Array.isArray(raw) || raw.length < 200) return;

        const bars: MarketBar[] = raw.slice(0, 200).map(item => {
          const row = item as [number, string, string, string, string];
          const d = new Date(row[0]);
          const yyyy = d.getUTCFullYear();
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
          const dd = String(d.getUTCDate()).padStart(2, '0');
          return {
            date: `${yyyy}-${mm}-${dd}`,
            open: parseFloat(parseFloat(row[1]).toFixed(2)),
            high: parseFloat(parseFloat(row[2]).toFixed(2)),
            low: parseFloat(parseFloat(row[3]).toFixed(2)),
            close: parseFloat(parseFloat(row[4]).toFixed(2)),
          };
        });

        const historyBars = bars.slice(0, 180);
        const futureBars = bars.slice(180, 200);
        const baseBar = historyBars[historyBars.length - 1];

        scenario.baseDate = baseBar.date;
        scenario.basePrice = baseBar.close;
        scenario.historyBars = historyBars;
        scenario.futureBars = futureBars;
        scenario.evalDates = futureBars.map(b => b.date);
      })
    );
    notifyMarketListeners();
  } catch {
    // 오프라인이거나 요청 제한 시 시드 폴백 유지
  }
}
