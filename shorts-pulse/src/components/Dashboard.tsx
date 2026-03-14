'use client';

import { useState, useMemo } from 'react';
import { ShortVideo, SortKey, ViewMode } from '@/types';
import { REGIONS, QA_STYLE_KEYWORDS } from '@/lib/constants';
import ShortCard from './ShortCard';
import ShortListItem from './ShortListItem';
import DetailModal from './DetailModal';
import { LayoutGrid, List, Film } from 'lucide-react';

interface DashboardProps {
  shorts: ShortVideo[];
  currentRegion: string;
  currentDate: string;
}

type CategoryFilter = 'all' | 'qa-style' | string;

function isQAStyle(video: ShortVideo): boolean {
  const title = video.title.toLowerCase();
  return QA_STYLE_KEYWORDS.some((kw) => title.includes(kw.toLowerCase()));
}

export default function Dashboard({ shorts, currentRegion, currentDate }: DashboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('viralityScore');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedVideo, setSelectedVideo] = useState<ShortVideo | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  // 주제별 카테고리 (검색 쿼리 기반 topicTag 사용)
  const availableTopics = useMemo(() => {
    const topicCounts = new Map<string, number>();
    shorts.forEach((v) => {
      const tag = v.topicTag || '기타';
      topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
    });
    return Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count);
  }, [shorts]);

  const filtered = useMemo(() => {
    let result = shorts;
    if (categoryFilter === 'qa-style') {
      result = shorts.filter(isQAStyle);
    } else if (categoryFilter !== 'all') {
      result = shorts.filter((v) => v.topicTag === categoryFilter);
    }
    return [...result].sort((a, b) => {
      const va = (a[sortKey] as number) ?? 0;
      const vb = (b[sortKey] as number) ?? 0;
      return vb - va;
    });
  }, [shorts, sortKey, categoryFilter]);

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'viralityScore', label: '바이럴' },
    { key: 'viewCount', label: '조회수' },
    { key: 'viewsPerHour', label: '속도' },
    { key: 'engagementRate', label: '참여도' },
  ];

  const regionName = REGIONS[currentRegion]?.name || currentRegion;
  const qaCount = shorts.filter(isQAStyle).length;

  return (
    <section className="max-w-[1080px] mx-auto px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <h2 className="section-headline">인기 쇼츠</h2>
        <p className="section-subheadline">
          {regionName}에서 트렌딩 중인 {filtered.length}개 쇼츠 · {currentDate}
        </p>
      </div>

      {/* Sort + View Controls */}
      <div className="flex gap-2 items-center justify-center mb-4 flex-wrap">
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

      {/* Category Filter */}
      <div className="flex gap-1.5 items-center justify-center mb-10 flex-wrap">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
            categoryFilter === 'all'
              ? 'bg-[#0071E3] text-white'
              : 'bg-black/[0.04] text-[#86868B] hover:bg-black/[0.08]'
          }`}
        >
          전체 ({shorts.length})
        </button>
        <button
          onClick={() => setCategoryFilter('qa-style')}
          className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
            categoryFilter === 'qa-style'
              ? 'bg-[#FF9500] text-white'
              : 'bg-black/[0.04] text-[#86868B] hover:bg-black/[0.08]'
          }`}
        >
          Q&A/비교형 ({qaCount})
        </button>
        {availableTopics.map(({ topic, count }) => (
          <button
            key={topic}
            onClick={() => setCategoryFilter(topic)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
              categoryFilter === topic
                ? 'bg-[#1D1D1F] text-white'
                : 'bg-black/[0.04] text-[#86868B] hover:bg-black/[0.08]'
            }`}
          >
            {topic} ({count})
          </button>
        ))}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[#86868B]">
          <Film size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-[17px] font-medium">
            {categoryFilter === 'qa-style' ? 'Q&A/비교형 쇼츠가 없습니다' : '트렌딩 쇼츠가 없습니다'}
          </p>
          <p className="text-sm mt-2">다른 필터나 지역을 선택해보세요</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {filtered.map((v) => (
            <ShortCard key={v.id} video={v} onClick={setSelectedVideo} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((v, i) => (
            <ShortListItem key={v.id} video={v} rank={i + 1} onClick={setSelectedVideo} />
          ))}
        </div>
      )}

      {selectedVideo && (
        <DetailModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
      )}
    </section>
  );
}
