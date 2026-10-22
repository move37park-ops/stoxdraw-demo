import { useEffect } from 'react';
import { GlobalHeader } from '../../components/GlobalHeader';
import { LandingHero } from './LandingHero';
import { LandingOutlookSection } from './LandingOutlookSection';
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
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }, []);

  return (
    <div className="min-h-screen w-full bg-black text-zinc-100 selection:bg-zinc-800 selection:text-white flex flex-col font-sans">
      <GlobalHeader
        currentDateStr={currentDateStr}
        onDateChange={onDateChange}
      />

      <main className="w-full flex-1">
        <LandingHero currentDateStr={currentDateStr} />
        <LandingOutlookSection currentDateStr={currentDateStr} />
      </main>

      <ShowcaseFooter />
    </div>
  );
}

export default LandingPage;
