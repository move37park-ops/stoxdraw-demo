import { useEffect } from 'react';
import { GlobalHeader } from '../../components/GlobalHeader';
import { LandingHero } from './LandingHero';
import { LandingOutlookSection } from './LandingOutlookSection';
import { LandingWhatIsSection } from './LandingWhatIsSection';
import { ShowcaseFooter } from '../showcase/ShowcaseFooter';

interface LandingPageProps {
  currentDateStr: string;
  onDateChange: (date: string) => void;
}

export function LandingPage({
  currentDateStr,
  onDateChange,
}: LandingPageProps) {
  useEffect(() => {
    // 다크 모드 기본 적용
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  return (
    <div className="min-h-screen w-full bg-black text-white selection:bg-[#C5A059] selection:text-black">
      {/* 1. Unified Top Header with STOXDRAW logo, Nav links and Profile Avatar */}
      <GlobalHeader
        currentDateStr={currentDateStr}
        onDateChange={onDateChange}
      />

      <main className="w-full">
        {/* 2. Hero Section: Left typography and Explore + DRAW dual CTA buttons */}
        <LandingHero />

        {/* 3. OUTLOOK Section: 2-column grid for S&P 500 and BITCOIN */}
        <LandingOutlookSection />

        {/* 4. What Is STOXDRAW? Section: Alternating zig-zag visual & text storytelling */}
        <LandingWhatIsSection />
      </main>

      {/* 5. Minimalist Flat Dark Footer */}
      <ShowcaseFooter />
    </div>
  );
}

export default LandingPage;
