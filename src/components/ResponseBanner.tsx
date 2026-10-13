import { Link } from 'react-router-dom';
import { CornerDownRight } from 'lucide-react';

interface ResponseBannerProps {
  parentAuthorHandle?: string;
  parentId: string;
}

export function ResponseBanner({ parentAuthorHandle, parentId }: ResponseBannerProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2.5 pl-0.5">
      <CornerDownRight size={13} className="text-[#DFC15D]" />
      <span>
        <Link
          to={`/f/${parentId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-white hover:text-[#DFC15D] font-semibold transition"
        >
          @{parentAuthorHandle || '예측가'}
        </Link>
        님의 Forecast에 대한 맞불 대결
      </span>
    </div>
  );
}
