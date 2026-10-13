import { GlobalHeader } from '../../components/GlobalHeader';
import { ShowcaseHeroSearch } from './ShowcaseHeroSearch';
import { ShowcaseStorySpotlight } from './ShowcaseStorySpotlight';
import { Showcase4FeatureCards } from './Showcase4FeatureCards';
import { ShowcaseBottomCTA } from './ShowcaseBottomCTA';
import { ShowcaseFooter } from './ShowcaseFooter';

interface EditorialHomePageProps {
  currentDateStr: string;
  onDateChange: (date: string) => void;
}

export function EditorialHomePage({
  currentDateStr,
  onDateChange,
}: EditorialHomePageProps) {
  return (
    <div className="min-h-screen w-full bg-black text-white transition-colors duration-200">
      {/* 1. Unified Sticky Nav (GlobalHeader) */}
      <GlobalHeader
        currentDateStr={currentDateStr}
        onDateChange={onDateChange}
      />

      <main className="w-full">
        {/* 2. Hero: "소개" Category, Large Title, Subtitle & Featured Card 1 */}
        <ShowcaseHeroSearch />

        {/* 3. Editorial Philosophy Manifesto & Media Photo Sections */}
        <ShowcaseStorySpotlight />

        {/* 4. 4 Colorful Feature Cards with "더 보기" Flat Pill Button */}
        <Showcase4FeatureCards />

        {/* 5. Featured Card 2 (Landscape / Verifiable Ledger) & Dark CTA Banner */}
        <ShowcaseBottomCTA />
      </main>

      {/* 6. Clean Flat Black Multi-column Footer */}
      <ShowcaseFooter />
    </div>
  );
}
