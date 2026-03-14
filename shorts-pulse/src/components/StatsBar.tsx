'use client';

import { Flame, Gauge, Trophy, Rocket } from 'lucide-react';
import { ShortVideo } from '@/types';
import { formatNumber } from '@/lib/utils';
import { CATEGORY_MAP } from '@/lib/constants';
import { useReveal } from '@/lib/hooks';

interface StatsBarProps {
  shorts: ShortVideo[];
}

export default function StatsBar({ shorts }: StatsBarProps) {
  const ref = useReveal();

  const avgScore = shorts.length > 0
    ? Math.round(shorts.reduce((s, v) => s + v.viralityScore, 0) / shorts.length)
    : 0;

  const avgVPH = shorts.length > 0
    ? Math.round(shorts.reduce((s, v) => s + v.viewsPerHour, 0) / shorts.length)
    : 0;

  const topCategory = (() => {
    if (shorts.length === 0) return '--';
    const counts: Record<string, number> = {};
    shorts.forEach((v) => {
      const cat = CATEGORY_MAP[v.categoryId] || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '--';
  })();

  const stats = [
    { icon: <Flame size={18} />, gradient: 'gradient-fire', value: shorts.length.toString(), label: 'Trending Shorts' },
    { icon: <Gauge size={18} />, gradient: 'gradient-ocean', value: avgScore.toString(), label: 'Avg Virality Score' },
    { icon: <Trophy size={18} />, gradient: 'gradient-sunset', value: topCategory, label: 'Top Category' },
    { icon: <Rocket size={18} />, gradient: 'gradient-purple', value: formatNumber(avgVPH), label: 'Avg Views/Hour' },
  ];

  return (
    <div ref={ref} className="reveal grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1200px] mx-auto px-6 pb-16">
      {stats.map((s, i) => (
        <div key={i} className="glass-card p-6">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white mb-3.5 ${s.gradient}`}>
            {s.icon}
          </div>
          <div className="text-[28px] font-bold tracking-tight mb-1">{s.value}</div>
          <div className="text-[13px] text-[#86868B]">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
