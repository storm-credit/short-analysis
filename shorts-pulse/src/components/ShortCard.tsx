'use client';

import { ShortVideo } from '@/types';
import { formatNumber, timeAgo } from '@/lib/utils';
import { getTier } from '@/lib/scoring';
import { Eye, Heart, Clock } from 'lucide-react';

interface ShortCardProps {
  video: ShortVideo;
  onClick: (video: ShortVideo) => void;
}

export default function ShortCard({ video, onClick }: ShortCardProps) {
  const tier = video.tier || getTier(video.viralityScore);

  return (
    <div className="short-card" onClick={() => onClick(video)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={video.thumbnail}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover"
      />

      {/* Score Badge */}
      <div
        className={`absolute top-3 right-3 flex flex-col items-center px-2.5 py-1.5 rounded-[14px] backdrop-blur-2xl text-white font-bold z-[2] ${tier.css}`}
      >
        <span className="text-lg leading-none">{video.viralityScore}</span>
        <span className="text-[8px] tracking-[0.08em] uppercase mt-0.5">{tier.label}</span>
      </div>

      {/* Overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-3.5 pb-3.5 pt-16 bg-gradient-to-t from-black/75 to-transparent text-white z-[1]">
        <div className="text-[11px] font-medium opacity-80 mb-1 truncate">{video.channelTitle}</div>
        <div className="text-[13px] font-semibold leading-tight line-clamp-2 mb-2">{video.title}</div>
        <div className="flex gap-2.5 text-[11px] opacity-85">
          <span className="flex items-center gap-1"><Eye size={11} /> {formatNumber(video.viewCount)}</span>
          <span className="flex items-center gap-1"><Heart size={11} /> {formatNumber(video.likeCount)}</span>
          <span className="flex items-center gap-1"><Clock size={11} /> {timeAgo(video.publishedAt)}</span>
        </div>
      </div>
    </div>
  );
}
