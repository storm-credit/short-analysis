'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { TabId } from '@/types';

interface FloatingNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'trending', label: '트렌딩' },
  { id: 'analytics', label: '분석' },
  { id: 'regional', label: '지역' },
  { id: 'insights', label: '인사이트' },
  { id: 'settings', label: '설정' },
];

export default function FloatingNav({ activeTab, onTabChange }: FloatingNavProps) {
  const [isDark, setIsDark] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored === 'true') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }

    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('darkMode', String(next));
  };

  return (
    <nav className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] nav-glass ${scrolled ? 'scrolled' : ''} rounded-full px-1.5 py-1.5 flex gap-0.5`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-300 whitespace-nowrap ${
            activeTab === tab.id
              ? 'bg-[#F5F5F7] text-[#1D1D1F]'
              : 'text-[#A1A1A6] hover:text-[#F5F5F7] hover:bg-white/[0.06]'
          }`}
        >
          {tab.label}
        </button>
      ))}
      <button
        onClick={toggleDark}
        className="px-3 py-2 rounded-full text-[#A1A1A6] hover:text-[#F5F5F7] hover:bg-white/[0.06] transition-all duration-300"
        title="다크 모드 전환"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </nav>
  );
}
