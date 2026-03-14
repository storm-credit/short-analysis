'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function FloatingNav() {
  const [activeSection, setActiveSection] = useState('hero');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored === 'true') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }

    const handleScroll = () => {
      const sections = ['hero', 'dashboard', 'analytics', 'regional', 'settings'];
      const scrollPos = window.scrollY + 120;
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el && scrollPos >= el.offsetTop && scrollPos < el.offsetTop + el.offsetHeight) {
          setActiveSection(id);
          break;
        }
      }
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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navItems = [
    { id: 'hero', label: '🔥 Trending' },
    { id: 'analytics', label: '📊 Analytics' },
    { id: 'regional', label: '🌍 Regions' },
    { id: 'settings', label: '⚙️' },
  ];

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] glass rounded-full px-1.5 py-1.5 flex gap-0.5 shadow-lg">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollTo(item.id)}
          className={`px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-300 whitespace-nowrap ${
            activeSection === item.id
              ? 'bg-[#1D1D1F] text-white dark:bg-[#F5F5F7] dark:text-[#1D1D1F]'
              : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] dark:hover:text-[#F5F5F7] dark:hover:bg-white/[0.06]'
          }`}
        >
          {item.label}
        </button>
      ))}
      <button
        onClick={toggleDark}
        className="px-3 py-2 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04] dark:hover:text-[#F5F5F7] dark:hover:bg-white/[0.06] transition-all duration-300"
        title="Toggle Dark Mode"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </nav>
  );
}
