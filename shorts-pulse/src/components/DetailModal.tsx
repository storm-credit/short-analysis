'use client';

import { ShortVideo } from '@/types';
import { formatNumber, timeAgo } from '@/lib/utils';
import { getTier } from '@/lib/scoring';
import { X, Youtube } from 'lucide-react';

interface DetailModalProps {
  video: ShortVideo | null;
  onClose: () => void;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[90px] text-xs text-[#86868B] flex-shrink-0">{label}</div>
      <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full score-bar-fill"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <div className="w-8 text-[13px] font-semibold text-right">{value}</div>
    </div>
  );
}

export default function DetailModal({ video, onClose }: DetailModalProps) {
  if (!video) return null;

  const tier = video.tier || getTier(video.viralityScore);
  const bd = video.scoreBreakdown;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#FBFBFD] dark:bg-[#1C1C1E] rounded-3xl w-full max-w-[800px] max-h-[90vh] overflow-y-auto shadow-[0_40px_100px_rgba(0,0,0,0.25)] p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/[0.06] dark:bg-white/[0.08] text-[#86868B] flex items-center justify-center hover:bg-black/[0.12] transition-all"
        >
          <X size={14} />
        </button>

        <div className="flex gap-6 flex-wrap">
          {/* Thumbnail */}
          <div className="flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnail}
              alt=""
              className="w-[180px] rounded-2xl aspect-[9/16] object-cover shadow-lg"
            />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-[280px]">
            {/* Tier Badge */}
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-white mb-4"
              style={{ background: tier.color }}
            >
              {tier.label} · {video.viralityScore}/100
            </div>

            <h2 className="text-xl font-bold mb-2 leading-tight">{video.title}</h2>
            <p className="text-sm text-[#86868B] mb-5">{video.channelTitle} · {timeAgo(video.publishedAt)}</p>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { value: formatNumber(video.viewCount), label: 'Views' },
                { value: formatNumber(video.likeCount), label: 'Likes' },
                { value: formatNumber(video.viewsPerHour), label: 'Views/hr' },
              ].map((m, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04]">
                  <div className="text-xl font-bold">{m.value}</div>
                  <div className="text-[11px] text-[#86868B]">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Score Breakdown */}
            {bd && (
              <>
                <h3 className="text-[15px] font-semibold mb-3">Score Breakdown</h3>
                <div className="flex flex-col gap-2">
                  <ScoreBar label="Velocity" value={bd.velocity} color="#FF2D55" />
                  <ScoreBar label="Engagement" value={bd.engagement} color="#FF9500" />
                  <ScoreBar label="Interaction" value={bd.interaction} color="#FFCC00" />
                  <ScoreBar label="Viral Coeff" value={bd.viralCoefficient} color="#34C759" />
                  <ScoreBar label="Recency" value={bd.recency} color="#0071E3" />
                  <ScoreBar label="Category" value={bd.categoryOutperformance} color="#AF52DE" />
                </div>
              </>
            )}

            {/* YouTube Link */}
            <div className="mt-5">
              <a
                href={`https://www.youtube.com/shorts/${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#FF0000] text-white text-sm font-medium no-underline hover:bg-[#CC0000] transition-all"
              >
                <Youtube size={16} /> Watch on YouTube
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
