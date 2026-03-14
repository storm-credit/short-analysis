'use client';

import { ShortVideo } from '@/types';
import { REGIONS } from '@/lib/constants';
import { formatNumber } from '@/lib/utils';
import { getTier } from '@/lib/scoring';

interface RegionalComparisonProps {
  shortsData: Record<string, ShortVideo[]>;
  onVideoClick: (video: ShortVideo) => void;
}

export default function RegionalComparison({ shortsData, onVideoClick }: RegionalComparisonProps) {
  return (
    <section className="max-w-[1080px] mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="section-headline">지역 비교</h2>
        <p className="section-subheadline">고단가 CPM 시장 TOP 쇼츠</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Object.entries(REGIONS).map(([code, info]) => {
          const shorts = (shortsData[code] || [])
            .sort((a, b) => b.viralityScore - a.viralityScore)
            .slice(0, 5);

          return (
            <div key={code} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                <span className="text-2xl">{info.flag}</span>
                <span className="font-semibold text-[15px] flex-1">{info.name}</span>
                <span className="text-xs text-[#34C759] font-semibold">RPM ${info.avgCPM}</span>
              </div>

              {shorts.length === 0 ? (
                <div className="text-center py-5 text-[#86868B] text-[13px]">데이터 없음</div>
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
                        <div className="text-[11px] text-[#86868B]">{formatNumber(v.viewCount)} 조회</div>
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
