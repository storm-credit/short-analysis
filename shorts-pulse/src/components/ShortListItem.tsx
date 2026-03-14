'use client';

import { ShortVideo } from '@/types';
import { formatNumber, timeAgo } from '@/lib/utils';
import { getTier } from '@/lib/scoring';

interface ShortListItemProps {
  video: ShortVideo;
  rank: number;
  onClick: (video: ShortVideo) => void;
}

export default function ShortListItem({ video, rank, onClick }: ShortListItemProps) {
  const tier = video.tier || getTier(video.viralityScore);

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-2xl glass-card cursor-pointer hover:translate-x-1 transition-all duration-300"
      onClick={() => onClick(video)}
    >
      <div className="text-xl font-bold text-[#86868B] min-w-[32px] text-center">{rank}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={video.thumbnail}
        alt=""
        loading="lazy"
        className="w-14 h-[100px] rounded-[10px] object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold mb-1 truncate">{video.title}</div>
        <div className="text-xs text-[#86868B]">{video.channelTitle} · {timeAgo(video.publishedAt)}</div>
      </div>
      <div className="flex gap-5 text-[13px] text-[#86868B] flex-shrink-0">
        <div>
          <div className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{formatNumber(video.viewCount)}</div>
          <div className="text-[11px]">views</div>
        </div>
        <div>
          <div className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{formatNumber(video.viewsPerHour)}</div>
          <div className="text-[11px]">v/hr</div>
        </div>
        <div>
          <div className="font-semibold" style={{ color: tier.color }}>{video.viralityScore}</div>
          <div className="text-[11px]">{tier.label}</div>
        </div>
      </div>
    </div>
  );
}
