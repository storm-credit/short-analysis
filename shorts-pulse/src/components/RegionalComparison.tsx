'use client';

import { ShortVideo } from '@/types';
import { REGIONS } from '@/lib/constants';
import { formatNumber } from '@/lib/utils';
import { getTier } from '@/lib/scoring';
import { useReveal } from '@/lib/hooks';

interface RegionalComparisonProps {
  shortsData: Record<string, ShortVideo[]>;
  onVideoClick: (video: ShortVideo) => void;
}

export default function RegionalComparison({ shortsData, onVideoClick }: RegionalComparisonProps) {
  const ref = useReveal();

  return (
    <section id="regional" ref={ref} className="reveal max-w-[1200px] mx-auto px-6 pb-24">
      <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight mb-2">Regional Comparison</h2>
      <p className="text-[17px] text-[#86868B] mb-10">Top shorts across high-CPM markets</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(REGIONS).map(([code, info]) => {
          const shorts = (shortsData[code] || [])
            .sort((a, b) => b.viralityScore - a.viralityScore)
            .slice(0, 5);

          return (
            <div key={code} className="glass-card p-5">
              {/* Region Header */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                <span className="text-2xl">{info.flag}</span>
                <span className="font-semibold text-[15px] flex-1">{info.name}</span>
                <span className="text-xs text-[#34C759] font-semibold">~${info.avgCPM} CPM</span>
              </div>

              {/* Top Items */}
              {shorts.length === 0 ? (
                <div className="text-center py-5 text-[#86868B] text-[13px]">No shorts data</div>
              ) : (
                shorts.map((v) => {
                  const tier = v.tier || getTier(v.viralityScore);
                  return (
                    <div
                      key={v.id}
                      className="flex gap-2.5 items-center py-2 border-b border-black/[0.03] dark:border-white/[0.04] last:border-0 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg transition-colors"
                      onClick={() => onVideoClick(v)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={v.thumbnail}
                        alt=""
                        loading="lazy"
                        className="w-10 h-[72px] rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{v.title}</div>
                        <div className="text-[11px] text-[#86868B]">{formatNumber(v.viewCount)} views</div>
                      </div>
                      <div
                        className="text-sm font-bold min-w-[32px] text-center"
                        style={{ color: tier.color }}
                      >
                        {v.viralityScore}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
