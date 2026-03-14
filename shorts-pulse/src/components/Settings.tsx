'use client';

import { useState, useEffect } from 'react';
import { loadApiKeys, saveApiKeys, clearCache, getApiKeyCount } from '@/lib/api';
import { CircleCheck, CircleAlert, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

interface SettingsProps {
  onKeysChanged: () => void;
}

export default function Settings({ onKeysChanged }: SettingsProps) {
  const [keys, setKeys] = useState<string[]>(['']);
  const [keyCount, setKeyCount] = useState(0);
  const [toast, setToast] = useState('');
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const stored = loadApiKeys();
    if (stored.length > 0) {
      setKeys(stored);
    }
    setKeyCount(stored.length);
  }, []);

  const handleSave = () => {
    const validKeys = keys.filter((k) => k.trim());
    saveApiKeys(validKeys);
    setKeyCount(getApiKeyCount());
    setToast(`${validKeys.length}개 API 키 저장됨 — 병렬 로테이션 활성`);
    setTimeout(() => setToast(''), 3000);
    onKeysChanged();
  };

  const handleClearCache = () => {
    clearCache();
    setToast('캐시 삭제됨');
    setTimeout(() => setToast(''), 3000);
  };

  const addKey = () => {
    setKeys([...keys, '']);
  };

  const removeKey = (index: number) => {
    if (keys.length <= 1) return;
    setKeys(keys.filter((_, i) => i !== index));
  };

  const updateKey = (index: number, value: string) => {
    const updated = [...keys];
    updated[index] = value;
    setKeys(updated);
  };

  const toggleShow = (index: number) => {
    setShowKeys({ ...showKeys, [index]: !showKeys[index] });
  };

  const validCount = keys.filter((k) => k.trim()).length;
  // 12쿼리 × 10지역 = 120 search = 12,000 units per key
  const estimatedQuota = validCount * 10000;

  return (
    <section className="max-w-[1080px] mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="section-headline">설정</h2>
        <p className="section-subheadline">API 키 관리 · 병렬 로테이션</p>
      </div>

      <div className="glass-card p-8 max-w-[600px] mx-auto">
        {/* 상태 표시 */}
        <div
          className="mb-5 px-4 py-3 rounded-xl text-[13px] font-medium flex items-center gap-2"
          style={{
            background: keyCount > 0 ? 'rgba(52,199,89,0.08)' : 'rgba(255,149,0,0.08)',
            color: keyCount > 0 ? '#34C759' : '#FF9500',
          }}
        >
          {keyCount > 0 ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
          {keyCount > 0
            ? `${keyCount}개 API 키 활성 — 일일 예상 quota ${estimatedQuota.toLocaleString()} units`
            : 'API 키 없음 — 데모 모드로 실행 중'}
        </div>

        {/* Quota 안내 */}
        <div className="mb-5 px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 text-[12px] text-[#86868B]">
          <p className="font-medium mb-1">Quota 안내</p>
          <p>키 1개 = 일일 10,000 units · 검색 1회 = 100 units</p>
          <p>12개 주제 × 10개국 = ~8,800 units/회</p>
          <p className="mt-1 text-[#0071E3] font-medium">
            키 {validCount}개 → 새로고침 약 {validCount > 0 ? Math.floor(estimatedQuota / 8800) : 0}회 가능
          </p>
        </div>

        {/* 키 목록 */}
        <div className="space-y-3 mb-5">
          {keys.map((key, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 relative">
                <label className="block text-[11px] font-medium text-[#86868B] mb-1">
                  API 키 {i + 1} {i === 0 ? '(메인)' : ''}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type={showKeys[i] ? 'text' : 'password'}
                    value={key}
                    onChange={(e) => updateKey(i, e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 dark:border-white/10 font-sans text-sm bg-white/60 dark:bg-[rgb(44,44,46)]/60 dark:text-[#F5F5F7] outline-none focus:border-[#0071E3] transition-colors font-mono"
                  />
                  <button
                    onClick={() => toggleShow(i)}
                    className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#86868B]"
                    title={showKeys[i] ? '숨기기' : '보기'}
                  >
                    {showKeys[i] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  {keys.length > 1 && (
                    <button
                      onClick={() => removeKey(i)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[#FF3B30]"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 키 추가 버튼 */}
        <button
          onClick={addKey}
          className="w-full py-2.5 rounded-xl border border-dashed border-black/10 dark:border-white/10 text-[13px] font-medium text-[#86868B] hover:text-[#0071E3] hover:border-[#0071E3] transition-colors flex items-center justify-center gap-1.5 mb-5"
        >
          <Plus size={14} />
          API 키 추가
        </button>

        {/* 저장/삭제 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-full bg-[#0071E3] text-white font-medium text-sm hover:bg-[#0077ED] transition-all"
          >
            키 저장
          </button>
          <button
            onClick={handleClearCache}
            className="px-6 py-2.5 rounded-full bg-[#86868B] text-white font-medium text-sm hover:bg-[#6E6E73] transition-all"
          >
            캐시 삭제
          </button>
        </div>

        {toast && (
          <div className="mt-4 text-sm font-medium text-[#34C759]">{toast}</div>
        )}
      </div>
    </section>
  );
}
