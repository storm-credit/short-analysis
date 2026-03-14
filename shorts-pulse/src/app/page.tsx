'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShortVideo, RegionCode, TabId } from '@/types';
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
import Insights from '@/components/Insights';
import LoadingOverlay from '@/components/LoadingOverlay';
import DetailModal from '@/components/DetailModal';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('trending');
  const [currentRegion, setCurrentRegion] = useState<RegionCode>('US');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [shortsData, setShortsData] = useState<Record<string, ShortVideo[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('로딩 중...');
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
          showToast(`${currentDate} 캐시 데이터 표시 중`);
          setLoading(false);
          return;
        } else {
          setShortsData({});
          showToast(`${currentDate} 데이터 없음. 첫 사용일부터 매일 기록됩니다.`);
          setLoading(false);
          return;
        }
      }

      const apiKeys = loadApiKeys();

      if (apiKeys.length === 0) {
        const mockData: Record<string, ShortVideo[]> = {};
        Object.keys(REGIONS).forEach((code) => {
          mockData[code] = generateMockShorts(Math.floor(Math.random() * 12) + 8);
        });
        setShortsData(mockData);
        showToast('데모 모드 — 설정에서 YouTube API 키를 추가하세요');
      } else {
        const regionCodes = Object.keys(REGIONS);
        const result = await fetchAllRegions(regionCodes, setLoadingText, currentRegion);

        regionCodes.forEach((code) => {
          saveSnapshot(currentDate, code, result.shortsOnly[code] || []);
        });

        setShortsData(result.shortsOnly);
        const totalShorts = Object.values(result.shortsOnly).reduce((s, arr) => s + arr.length, 0);
        showToast(`${regionCodes.length}개 지역에서 ${totalShorts}개 쇼츠 로드 완료`);
      }
    } catch (error) {
      console.error('Load error:', error);
      showToast('오류: ' + (error as Error).message);
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
    <div className="min-h-screen bg-black">
      {/* Fixed Header: Nav + Hero */}
      <div className="section-dark">
        <FloatingNav activeTab={activeTab} onTabChange={setActiveTab} />
        <Hero
          currentDate={currentDate}
          currentRegion={currentRegion}
          onDateChange={handleDateChange}
          onRegionChange={setCurrentRegion}
          onRefresh={handleRefresh}
          onPrevDay={handlePrevDay}
          onNextDay={handleNextDay}
        />
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'trending' && (
          <div className="section-light py-10 md:py-16">
            <StatsBar shorts={currentShorts} />
            <div className="mt-12">
              <Dashboard
                shorts={currentShorts}
                currentRegion={currentRegion}
                currentDate={currentDate}
              />
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="section-dark py-10 md:py-16">
            <Charts shorts={currentShorts} />
          </div>
        )}

        {activeTab === 'regional' && (
          <div className="section-light py-10 md:py-16">
            <RegionalComparison
              shortsData={shortsData}
              onVideoClick={setSelectedRegionalVideo}
            />
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="section-light py-10 md:py-16">
            <Insights shorts={currentShorts} allRegionShorts={shortsData} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="section-gray py-10 md:py-16">
            <Settings onKeysChanged={loadData} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="section-dark">
        <footer className="text-center py-12 px-6 text-[#86868B] text-[13px] border-t border-white/[0.06]">
          <p className="font-medium">Shorts Pulse</p>
          <p className="mt-2 opacity-60">YouTube Shorts 트렌딩 대시보드 · 바이럴 점수 알고리즘</p>
        </footer>
      </div>

      <LoadingOverlay show={loading} text={loadingText} />

      {/* Toast */}
      <div
        className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl bg-[#F5F5F7] text-[#1D1D1F] text-sm font-medium z-[100000] shadow-xl pointer-events-none transition-transform duration-400 ${
          toast ? 'translate-y-0' : 'translate-y-[120px]'
        }`}
      >
        {toast}
      </div>

      {/* Regional detail modal */}
      {selectedRegionalVideo && (
        <DetailModal video={selectedRegionalVideo} onClose={() => setSelectedRegionalVideo(null)} />
      )}
    </div>
  );
}
