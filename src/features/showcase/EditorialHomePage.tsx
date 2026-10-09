import { ShowcaseNav } from './ShowcaseNav';
import { ShowcaseHeroSearch } from './ShowcaseHeroSearch';
import { ShowcaseTickerStrip } from './ShowcaseTickerStrip';
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
      {/* 1. Sticky Nav (Pure Black) */}
      <ShowcaseNav
        currentDateStr={currentDateStr}
        onDateChange={onDateChange}
      />

      <main className="w-full">
        {/* 2. Hero: Glowing pill, Headline, Centered DRAW Button, Floating Chart Showcase */}
        <ShowcaseHeroSearch />

        {/* 3. Quiet Monochrome Ticker Strip (Matches logos bar in reference) */}
        <ShowcaseTickerStrip />

        {/* 4. Storytelling Feature Section (Matches enterprise section in reference) */}
        <ShowcaseStorySpotlight />

        {/* 5. 4 Colorful Feature Cards (Exact match to 4 cards at bottom of reference) */}
        <Showcase4FeatureCards />

        {/* 6. Big Dark CTA Banner (Matches bottom banner in reference) */}
        <ShowcaseBottomCTA />
      </main>

      {/* 7. Clean Black Multi-column Footer */}
      <ShowcaseFooter />
    </div>
  );
}
