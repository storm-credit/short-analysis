'use client';

import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { RegionCode } from '@/types';

interface HeroProps {
  currentDate: string;
  currentRegion: RegionCode;
  onDateChange: (date: string) => void;
  onRegionChange: (region: RegionCode) => void;
  onRefresh: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
}

const regions: { code: RegionCode; label: string }[] = [
  { code: 'US', label: '🇺🇸 US' },
  { code: 'GB', label: '🇬🇧 UK' },
  { code: 'AU', label: '🇦🇺 AU' },
  { code: 'CA', label: '🇨🇦 CA' },
];

export default function Hero({
  currentDate,
  currentRegion,
  onDateChange,
  onRegionChange,
  onRefresh,
  onPrevDay,
  onNextDay,
}: HeroProps) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <section
      id="hero"
      className="hero-gradient-bg relative min-h-[60vh] flex flex-col items-center justify-center text-center px-6 pt-28 pb-16"
    >
      <p className="text-sm font-semibold tracking-[0.06em] uppercase text-[#FF2D55] mb-3 relative z-10">
        YouTube Shorts
      </p>
      <h1 className="hero-title mb-4 relative z-10">Trending Now.</h1>
      <p className="text-[clamp(1rem,2vw,1.35rem)] text-[#86868B] font-normal max-w-[580px] leading-relaxed relative z-10">
        Discover the most viral YouTube Shorts across premium CPM markets.
        Real-time virality scoring powered by intelligent algorithms.
      </p>

      <div className="flex items-center gap-3 mt-10 flex-wrap justify-center relative z-10">
        {/* Date Picker */}
        <div className="pill-control flex items-center">
          <button onClick={onPrevDay} className="pill-btn !px-2.5 !py-2">
            <ChevronLeft size={14} />
          </button>
          <input
            type="date"
            value={currentDate}
            max={today}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-transparent border-none font-sans text-[13px] font-medium text-[#1D1D1F] dark:text-[#F5F5F7] px-1 py-2 outline-none cursor-pointer dark:[color-scheme:dark]"
          />
          <button onClick={onNextDay} className="pill-btn !px-2.5 !py-2">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Region Selector */}
        <div className="pill-control">
          {regions.map((r) => (
            <button
              key={r.code}
              onClick={() => onRegionChange(r.code)}
              className={`pill-btn ${currentRegion === r.code ? 'active' : ''}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="px-5 py-2.5 rounded-full text-[13px] font-medium bg-[#0071E3] text-white shadow-[0_2px_8px_rgba(0,113,227,0.3)] hover:bg-[#0077ED] hover:scale-[1.02] active:scale-[0.98] transition-all duration-250 flex items-center gap-1.5"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
    </section>
  );
}
