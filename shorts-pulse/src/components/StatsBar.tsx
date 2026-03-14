'use client';

import { useMemo } from 'react';
import { ShortVideo } from '@/types';
import { formatNumber } from '@/lib/utils';
import { CATEGORY_MAP } from '@/lib/constants';

interface StatsBarProps {
  shorts: ShortVideo[];
}

export default function StatsBar({ shorts }: StatsBarProps) {
  const { avgScore, avgVPH, topCategory } = useMemo(() => {
    if (shorts.length === 0) return { avgScore: 0, avgVPH: 0, topCategory: '--' };

    const avgS = Math.round(shorts.reduce((s, v) => s + v.viralityScore, 0) / shorts.length);
    const avgV = Math.round(shorts.reduce((s, v) => s + v.viewsPerHour, 0) / shorts.length);

    const counts: Record<string, number> = {};
    shorts.forEach((v) => {
      const cat = CATEGORY_MAP[v.categoryId] || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const topCat = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '--';

    return { avgScore: avgS, avgVPH: avgV, topCategory: topCat };
  }, [shorts]);

  const stats = [
    { value: shorts.length.toString(), label: '트렌딩', color: '#FF2D55' },
    { value: avgScore.toString(), label: '바이럴 점수', color: '#0071E3' },
    { value: topCategory, label: '인기 카테고리', color: '#FF9500' },
    { value: formatNumber(avgVPH), label: '시간당 조회', color: '#AF52DE' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-[1080px] mx-auto px-4">
      {stats.map((s, i) => (
        <div key={i} className="glass-card px-5 py-4 flex items-center gap-3">
          <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: s.color }} />
          <div className="min-w-0">
            <div className="text-[22px] font-bold tracking-tight leading-tight truncate">{s.value}</div>
            <div className="text-[12px] text-[#86868B] font-medium">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
