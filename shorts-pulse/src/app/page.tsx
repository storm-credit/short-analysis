'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShortVideo, RegionCode } from '@/types';
import { REGIONS } from '@/lib/constants';
import {
  loadApiKeys,
  fetchAllRegions,
  generateMockShorts,
  saveSnapshot,
  getSnapshot,
  clearTrendingCache,
} from '@/lib/api';
import FloatingNav from '@/components/FloatingNav';
import Hero from '@/components/Hero';
import StatsBar from '@/components/StatsBar';
import Dashboard from '@/components/Dashboard';
import Charts from '@/components/Charts';
import RegionalComparison from '@/components/RegionalComparison';
import Settings from '@/components/Settings';
import LoadingOverlay from '@/components/LoadingOverlay';
import DetailModal from '@/components/DetailModal';

export default function Home() {
  const [currentRegion, setCurrentRegion] = useState<RegionCode>('US');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [shortsData, setShortsData] = useState<Record<string, ShortVideo[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Loading...');
  const [toast, setToast] = useState('');
  const [selectedRegionalVideo, setSelectedRegionalVideo] = useState<ShortVideo | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const isToday = currentDate === today;

    try {
      if (!isToday) {
        // Check for snapshots
        let hasSnapshot = false;
        const regionCodes = Object.keys(REGIONS);
        const snapData: Record<string, ShortVideo[]> = {};
        regionCodes.forEach((code) => {
          const snap = getSnapshot(currentDate, code);
          if (snap) {
            snapData[code] = snap;
            hasSnapshot = true;
          }
        });
        if (hasSnapshot) {
          setShortsData(snapData);
          showToast(`Showing cached data for ${currentDate}`);
          setLoading(false);
          return;
        } else {
          setShortsData({});
          showToast(`No historical data for ${currentDate}. Data is recorded daily from first use.`);
          setLoading(false);
          return;
        }
      }

      const apiKeys = loadApiKeys();

      if (apiKeys.length === 0) {
        // Demo mode
        const mockData: Record<string, ShortVideo[]> = {};
        Object.keys(REGIONS).forEach((code) => {
          mockData[code] = generateMockShorts(Math.floor(Math.random() * 12) + 8);
        });
        setShortsData(mockData);
        showToast('Demo mode — Add YouTube API keys in Settings for real data');
      } else {
        const regionCodes = Object.keys(REGIONS);
        const result = await fetchAllRegions(regionCodes, setLoadingText);

        // Save snapshots
        regionCodes.forEach((code) => {
          saveSnapshot(currentDate, code, result.shortsOnly[code] || []);
        });

        setShortsData(result.shortsOnly);
        const totalShorts = Object.values(result.shortsOnly).reduce((s, arr) => s + arr.length, 0);
        showToast(`Loaded ${totalShorts} shorts across ${regionCodes.length} regions`);
      }
    } catch (error) {
      console.error('Load error:', error);
      showToast('Error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [currentDate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    clearTrendingCache();
    loadData();
  };

  const handleDateChange = (date: string) => {
    setCurrentDate(date);
  };

  const handlePrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(currentDate);
    const today = new Date();
    d.setDate(d.getDate() + 1);
    if (d > today) return;
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const currentShorts = shortsData[currentRegion] || [];

  return (
    <>
      <FloatingNav />

      <Hero
        currentDate={currentDate}
        currentRegion={currentRegion}
        onDateChange={handleDateChange}
        onRegionChange={setCurrentRegion}
        onRefresh={handleRefresh}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
      />

      <StatsBar shorts={currentShorts} />

      <Dashboard
        shorts={currentShorts}
        currentRegion={currentRegion}
        currentDate={currentDate}
      />

      <Charts shorts={currentShorts} />

      <RegionalComparison
        shortsData={shortsData}
        onVideoClick={setSelectedRegionalVideo}
      />

      <Settings onKeysChanged={loadData} />

      {/* Footer */}
      <footer className="text-center py-10 px-6 text-[#86868B] text-[13px] border-t border-black/[0.04] dark:border-white/[0.06]">
        <p>Shorts Pulse — YouTube Shorts Trending Dashboard</p>
        <p className="mt-1 opacity-70">Built with YouTube Data API v3 · Powered by intelligent virality scoring</p>
      </footer>

      <LoadingOverlay show={loading} text={loadingText} />

      {/* Toast */}
      <div
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl bg-[#1D1D1F] dark:bg-[#F5F5F7] text-white dark:text-[#1D1D1F] text-sm font-medium z-[100000] shadow-xl pointer-events-none transition-transform duration-400 ${
          toast ? 'translate-y-0' : 'translate-y-[120px]'
        }`}
      >
        {toast}
      </div>

      {/* Regional detail modal */}
      {selectedRegionalVideo && (
        <DetailModal video={selectedRegionalVideo} onClose={() => setSelectedRegionalVideo(null)} />
      )}
    </>
  );
}
