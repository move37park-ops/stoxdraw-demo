import { useState, useEffect, useCallback } from 'react';
import { repository } from '../../data/localRepository';
import { ShowcaseNav } from './ShowcaseNav';
import { ShowcaseHeroSearch } from './ShowcaseHeroSearch';
import { ShowcaseBentoGrid } from './ShowcaseBentoGrid';
import { ShowcaseBattleSection } from './ShowcaseBattleSection';
import { ShowcaseForecasterSection } from './ShowcaseForecasterSection';
import { ShowcaseHallOfFame } from './ShowcaseHallOfFame';
import { ShowcaseBottomCTA } from './ShowcaseBottomCTA';
import { ShowcaseFooter } from './ShowcaseFooter';
import type { Forecast } from '../../domain/types';

interface EditorialHomePageProps {
  currentDateStr: string;
  onDateChange: (date: string) => void;
}

export function EditorialHomePage({
  currentDateStr,
  onDateChange,
}: EditorialHomePageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [forecasts, setForecasts] = useState<Forecast[]>(() =>
    repository.listFeed('all', currentDateStr)
  );

  const loadData = useCallback(() => {
    setForecasts(repository.listFeed('all', currentDateStr));
  }, [currentDateStr]);

  useEffect(() => {
    loadData();
    const unsub = repository.subscribe(loadData);
    return () => unsub();
  }, [loadData]);

  const handleTagSelect = (tagQuery: string) => {
    setSearchQuery(tagQuery);
    // Smooth scroll down to the battle section if searching
    const section = document.getElementById('battle-section');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#fbfbfd] dark:bg-[#07080b] text-zinc-900 dark:text-white transition-colors duration-200">
      {/* 1. Sticky Editorial Nav */}
      <ShowcaseNav
        currentDateStr={currentDateStr}
        onDateChange={onDateChange}
      />

      <main className="w-full">
        {/* 2. Headline & Pill Search Bar */}
        <ShowcaseHeroSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onTagSelect={handleTagSelect}
        />

        {/* 3. Hero Bento Grid (Featured Big Battle + Stacked Colorful Cards) */}
        <ShowcaseBentoGrid currentDateStr={currentDateStr} />

        {/* 4. 3-Column Realtime Forecast Battles */}
        <div id="battle-section">
          <ShowcaseBattleSection
            forecasts={forecasts}
            searchFilter={searchQuery}
          />
        </div>

        {/* 5. 3-Column Top Verified Forecasters (Matching photo cards in image) */}
        <ShowcaseForecasterSection />

        {/* 6. 3-Column Hall of Fame (Resolved Predictions) */}
        <ShowcaseHallOfFame currentDateStr={currentDateStr} />

        {/* 7. Big Bottom Call To Action (Matches 'ChatGPT를 시작해보세요' banner) */}
        <ShowcaseBottomCTA />
      </main>

      {/* 8. Multi-column Modern Tech Footer */}
      <ShowcaseFooter />
    </div>
  );
}
