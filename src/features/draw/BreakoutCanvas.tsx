import { useState } from 'react';
import type { BreakoutTarget } from '../../domain/types';
import { formatCurrency, formatPct } from '../../domain/format';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface BreakoutCanvasProps {
  basePrice: number;
  value?: BreakoutTarget;
  onChange: (target: BreakoutTarget) => void;
}

export function BreakoutCanvas({
  basePrice,
  value = { direction: 'up', price: Math.round(basePrice * 1.05 * 100) / 100 },
  onChange,
}: BreakoutCanvasProps) {
  const [direction, setDirection] = useState<'up' | 'down'>(value.direction);
  const [price, setPrice] = useState<number>(value.price);

  const handleDirection = (dir: 'up' | 'down') => {
    setDirection(dir);
    const newPrice = dir === 'up'
      ? Math.round(basePrice * 1.06 * 10) / 10
      : Math.round(basePrice * 0.94 * 10) / 10;
    setPrice(newPrice);
    onChange({ direction: dir, price: newPrice });
  };

  const handlePriceChange = (newPrice: number) => {
    setPrice(newPrice);
    onChange({ direction, price: newPrice });
  };

  const pct = ((price - basePrice) / basePrice) * 100;

  return (
    <div className="w-full p-4 rounded-2xl bg-[#090a0d] border border-[#1f222b]">
      {/* 1. Direction Toggle Buttons (§15 Direction) */}
      <label className="text-xs text-[#71767b] block mb-2 font-medium">돌파 방향 선택</label>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          type="button"
          onClick={() => handleDirection('up')}
          className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition border ${
            direction === 'up'
              ? 'bg-blue-600 text-white border-blue-500 shadow-md'
              : 'bg-[#14161f] text-[#9aa0a6] border-[#222530] hover:text-white'
          }`}
        >
          <TrendingUp size={18} />
          ↑ 넘는다 (상향 돌파)
        </button>

        <button
          type="button"
          onClick={() => handleDirection('down')}
          className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition border ${
            direction === 'down'
              ? 'bg-rose-600 text-white border-rose-500 shadow-md'
              : 'bg-[#14161f] text-[#9aa0a6] border-[#222530] hover:text-white'
          }`}
        >
          <TrendingDown size={18} />
          ↓ 하회한다 (하향 돌파)
        </button>
      </div>

      {/* 2. Target Price Display & Slider (§15 Price) */}
      <div className="p-4 rounded-xl bg-[#11131a] border border-[#202430] text-center mb-4">
        <span className="text-xs text-[#71767b] block mb-1">목표 돌파 가격</span>
        <div className="text-3xl font-bold font-mono text-white mb-1">
          {formatCurrency(price)}
        </div>
        <div className={`text-xs font-mono font-semibold ${pct >= 0 ? 'text-[#38bdf8]' : 'text-[#f43f5e]'}`}>
          기준가 대비 {formatPct(pct)}
        </div>
      </div>

      <div className="px-2">
        <input
          type="range"
          min={Math.round(basePrice * 0.7)}
          max={Math.round(basePrice * 1.3)}
          step={0.5}
          value={price}
          onChange={(e) => handlePriceChange(parseFloat(e.target.value))}
          className="w-full accent-[#38bdf8] cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-[#71767b] mt-1 font-mono">
          <span>${(basePrice * 0.7).toFixed(1)}</span>
          <span>기준: ${basePrice.toFixed(2)}</span>
          <span>${(basePrice * 1.3).toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
