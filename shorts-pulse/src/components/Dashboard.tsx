'use client';

import { useState } from 'react';
import { ShortVideo, SortKey, ViewMode } from '@/types';
import { REGIONS } from '@/lib/constants';
import { useReveal } from '@/lib/hooks';
import ShortCard from './ShortCard';
import ShortListItem from './ShortListItem';
import DetailModal from './DetailModal';
import { LayoutGrid, List, Film } from 'lucide-react';

interface DashboardProps {
  shorts: ShortVideo[];
  currentRegion: string;
  currentDate: string;
}

export default function Dashboard({ shorts, currentRegion, currentDate }: DashboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('viralityScore');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedVideo, setSelectedVideo] = useState<ShortVideo | null>(null);
  const ref = useReveal();

  const sorted = [...shorts].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    return (vb as number) - (va as number);
  });

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'viralityScore', label: 'Virality' },
    { key: 'viewCount', label: 'Views' },
    { key: 'viewsPerHour', label: 'Velocity' },
    { key: 'engagementRate', label: 'Engagement' },
  ];

  const regionName = REGIONS[currentRegion]?.name || currentRegion;

  return (
    <section id="dashboard" ref={ref} className="reveal max-w-[1200px] mx-auto px-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight">Top Shorts</h2>
          <p className="text-[17px] text-[#86868B]">
            {shorts.length} shorts from {regionName} trending · {currentDate}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="pill-control">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={`pill-btn ${sortKey === opt.key ? 'active' : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="pill-control">
            <button
              onClick={() => setViewMode('grid')}
              className={`pill-btn !px-3 ${viewMode === 'grid' ? 'active' : ''}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`pill-btn !px-3 ${viewMode === 'list' ? 'active' : ''}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {sorted.length === 0 ? (
        <div className="text-center py-20 text-[#86868B]">
          <Film size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-[17px] font-medium">No shorts found in trending</p>
          <p className="text-sm mt-2">Try a different date or region</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sorted.map((v) => (
            <ShortCard key={v.id} video={v} onClick={setSelectedVideo} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((v, i) => (
            <ShortListItem key={v.id} video={v} rank={i + 1} onClick={setSelectedVideo} />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedVideo && (
        <DetailModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
      )}
    </section>
  );
}
