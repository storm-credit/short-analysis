'use client';

import { useState, useEffect } from 'react';
import { loadApiKeys, saveApiKeys, clearCache, getApiKeyCount } from '@/lib/api';
import { useReveal } from '@/lib/hooks';
import { CircleCheck, CircleAlert } from 'lucide-react';

interface SettingsProps {
  onKeysChanged: () => void;
}

export default function Settings({ onKeysChanged }: SettingsProps) {
  const ref = useReveal();
  const [key1, setKey1] = useState('');
  const [key2, setKey2] = useState('');
  const [keyCount, setKeyCount] = useState(0);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const keys = loadApiKeys();
    if (keys[0]) setKey1(keys[0]);
    if (keys[1]) setKey2(keys[1]);
    setKeyCount(keys.length);
  }, []);

  const handleSave = () => {
    const keys = [key1, key2].filter((k) => k.trim());
    saveApiKeys(keys);
    setKeyCount(getApiKeyCount());
    setToast(`${keys.length} API key(s) saved`);
    setTimeout(() => setToast(''), 3000);
    onKeysChanged();
  };

  const handleClearCache = () => {
    clearCache();
    setToast('Cache cleared');
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <section id="settings" ref={ref} className="reveal max-w-[1200px] mx-auto px-6 pb-24">
      <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight mb-2">Settings</h2>
      <p className="text-[17px] text-[#86868B] mb-10">Manage your API keys</p>

      <div className="glass-card p-8 max-w-[600px]">
        {/* Status */}
        <div
          className="mb-5 px-4 py-3 rounded-xl text-[13px] font-medium flex items-center gap-2"
          style={{
            background: keyCount > 0 ? 'rgba(52,199,89,0.08)' : 'rgba(255,149,0,0.08)',
            color: keyCount > 0 ? '#34C759' : '#FF9500',
          }}
        >
          {keyCount > 0 ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
          {keyCount > 0
            ? `${keyCount} API key(s) configured`
            : 'No API keys — running in demo mode'}
        </div>

        <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">YouTube API Key</label>
        <input
          type="password"
          value={key1}
          onChange={(e) => setKey1(e.target.value)}
          placeholder="AIzaSy..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 font-sans text-sm bg-white/60 dark:bg-[rgb(44,44,46)]/60 dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-colors mb-4"
        />

        <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">YouTube API Key 2 (optional backup)</label>
        <input
          type="password"
          value={key2}
          onChange={(e) => setKey2(e.target.value)}
          placeholder="AIzaSy... (fallback key)"
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 font-sans text-sm bg-white/60 dark:bg-[rgb(44,44,46)]/60 dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-colors mb-5"
        />

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-full bg-[#0071E3] text-white font-medium text-sm hover:bg-[#0077ED] transition-all"
          >
            Save Keys
          </button>
          <button
            onClick={handleClearCache}
            className="px-6 py-2.5 rounded-full bg-[#86868B] text-white font-medium text-sm hover:bg-[#6E6E73] transition-all"
          >
            Clear Cache
          </button>
        </div>

        {toast && (
          <div className="mt-4 text-sm font-medium text-[#34C759]">{toast}</div>
        )}
      </div>
    </section>
  );
}
