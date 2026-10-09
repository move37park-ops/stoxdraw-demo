import { useNavigate } from 'react-router-dom';

const TICKERS = [
  { ticker: 'NVDA', price: '$128.80', change: '+2.4%', isUp: true },
  { ticker: 'TSLA', price: '$248.50', change: '+4.1%', isUp: true },
  { ticker: 'AAPL', price: '$228.00', change: '-0.5%', isUp: false },
  { ticker: 'MSFT', price: '$442.20', change: '+1.1%', isUp: true },
  { ticker: 'PLTR', price: '$42.10', change: '+6.8%', isUp: true },
];

export function ShowcaseTickerStrip() {
  const navigate = useNavigate();

  return (
    <div className="w-full border-y border-white/10 bg-black/60 py-6 my-10">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-6 overflow-x-auto no-scrollbar">
        {TICKERS.map((t) => (
          <div
            key={t.ticker}
            onClick={() => navigate(`/arena?ticker=${t.ticker}`)}
            className="flex items-center gap-3 font-mono text-xs sm:text-sm text-zinc-400 hover:text-white transition cursor-pointer flex-shrink-0"
          >
            <span className="font-bold text-white tracking-wider">${t.ticker}</span>
            <span>{t.price}</span>
            <span className={t.isUp ? 'text-emerald-400' : 'text-rose-400'}>
              {t.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
