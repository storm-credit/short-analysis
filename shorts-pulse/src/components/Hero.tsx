'use client';

import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { RegionCode } from '@/types';
import { REGIONS } from '@/lib/constants';

interface HeroProps {
  currentDate: string;
  currentRegion: RegionCode;
  onDateChange: (date: string) => void;
  onRegionChange: (region: RegionCode) => void;
  onRefresh: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
}

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
  const regionInfo = REGIONS[currentRegion];

  return (
    <section className="relative pt-16 pb-6 flex flex-col items-center text-center px-4">
      {/* Compact controls row */}
      <div className="flex items-center gap-2 flex-wrap justify-center relative z-10">
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
            className="bg-transparent border-none font-sans text-[13px] font-medium text-[#F5F5F7] px-1 py-2 outline-none cursor-pointer [color-scheme:dark]"
          />
          <button onClick={onNextDay} className="pill-btn !px-2.5 !py-2">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Region Selector — dropdown for 10 regions */}
        <div className="pill-control flex items-center">
          <select
            value={currentRegion}
            onChange={(e) => onRegionChange(e.target.value as RegionCode)}
            className="bg-transparent border-none font-sans text-[13px] font-medium text-[#F5F5F7] px-3 py-2 outline-none cursor-pointer appearance-none [color-scheme:dark]"
          >
            {Object.entries(REGIONS).map(([code, info]) => (
              <option key={code} value={code} className="bg-[#1C1C1E] text-[#F5F5F7]">
                {info.flag} {info.name} (RPM ${info.avgCPM})
              </option>
            ))}
          </select>
          <span className="text-[#A1A1A6] text-[11px] font-medium pr-3 whitespace-nowrap">
            {regionInfo?.flag} RPM ${regionInfo?.avgCPM}
          </span>
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="px-4 py-2 rounded-full text-[13px] font-medium bg-[#0071E3] text-white shadow-[0_2px_12px_rgba(0,113,227,0.4)] hover:bg-[#0077ED] hover:scale-[1.02] active:scale-[0.98] transition-all duration-250 flex items-center gap-1.5"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </section>
  );
}
