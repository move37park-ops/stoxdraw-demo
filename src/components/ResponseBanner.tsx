import { Link } from 'react-router-dom';
import { CornerDownRight } from 'lucide-react';

interface ResponseBannerProps {
  parentAuthorHandle?: string;
  parentId: string;
}

export function ResponseBanner({ parentAuthorHandle, parentId }: ResponseBannerProps) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#71767b] mb-2.5 pl-0.5">
      <CornerDownRight size={13} className="text-[#38bdf8]" />
      <span>
        <Link
          to={`/f/${parentId}`}
          onClick={(e) => e.stopPropagation()}
          style={{ color: '#38bdf8', fontWeight: 600 }}
        >
          @{parentAuthorHandle || '예측가'}
        </Link>
        님의 Forecast에 대한 응답
      </span>
    </div>
  );
}
