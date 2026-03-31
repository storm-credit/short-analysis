import { RegionInfo } from '@/types';

// Shorts RPM ($/1000뷰) — 국가별 Shorts 광고 수익 분배 추정치 (2025)
// lang: YouTube Search API relevanceLanguage (해당 언어 콘텐츠 우선)
export const REGIONS: Record<string, RegionInfo> = {
  US: { code: 'US', name: '미국', flag: '🇺🇸', avgCPM: 0.08, lang: 'en' },
  JP: { code: 'JP', name: '일본', flag: '🇯🇵', avgCPM: 0.04, lang: 'ja' },
  KR: { code: 'KR', name: '한국', flag: '🇰🇷', avgCPM: 0.03, lang: 'ko' },
  ES: { code: 'ES', name: '스페인', flag: '🇪🇸', avgCPM: 0.04, lang: 'es' },
  BR: { code: 'BR', name: '브라질', flag: '🇧🇷', avgCPM: 0.02, lang: 'pt' },
  DE: { code: 'DE', name: '독일', flag: '🇩🇪', avgCPM: 0.06, lang: 'de' },
  FR: { code: 'FR', name: '프랑스', flag: '🇫🇷', avgCPM: 0.04, lang: 'fr' },
  MX: { code: 'MX', name: '멕시코', flag: '🇲🇽', avgCPM: 0.02, lang: 'es' },
  GB: { code: 'GB', name: '영국', flag: '🇬🇧', avgCPM: 0.07, lang: 'en' },
  AU: { code: 'AU', name: '호주', flag: '🇦🇺', avgCPM: 0.07, lang: 'en' },
  CA: { code: 'CA', name: '캐나다', flag: '🇨🇦', avgCPM: 0.06, lang: 'en' },
  NO: { code: 'NO', name: '노르웨이', flag: '🇳🇴', avgCPM: 0.09, lang: 'no' },
  CH: { code: 'CH', name: '스위스', flag: '🇨🇭', avgCPM: 0.08, lang: 'de' },
};

export const CATEGORY_MAP: Record<string, string> = {
  '1': '영화/애니',
  '2': '자동차',
  '10': '음악',
  '15': '동물',
  '17': '스포츠',
  '19': '여행',
  '20': '게임',
  '22': '일상/블로그',
  '23': '코미디',
  '24': '엔터테인먼트',
  '25': '뉴스/정치',
  '26': '노하우/스타일',
  '27': '교육',
  '28': '과학/테크',
  '29': '비영리',
};

// AskAnything 스타일과 관련 높은 카테고리
export const ASKANYTHING_CATEGORIES = ['27', '28', '22', '24', '26'];

// 비교/Q&A 스타일 감지 키워드
export const QA_STYLE_KEYWORDS = [
  'vs', 'versus', 'which', 'what', 'why', 'how', 'did you know',
  'compare', 'better', 'best', 'worst', 'top', 'ranking',
  '왜', '어떻게', '뭐가', '비교', '최고', '최악',
  '알고 계셨', '몰랐던', '차이', 'difference', 'truth',
  'secret', 'fact', 'myth', 'real reason', 'actually',
];

export const SHORTS_MAX_DURATION = 180; // YouTube Shorts 최대 3분 (2024년 확장)
export const CACHE_EXPIRY_HOURS = 2;

export const STORAGE_KEYS = {
  API_KEYS: 'yt_api_keys',
  DARK_MODE: 'darkMode',
  CACHE_PREFIX: 'shorts_cache_',
  SNAPSHOT_PREFIX: 'shorts_snap_',
};

// v4: Shorts 특성 반영 — 참여도↑, 속도↓ (Shorts는 알고리즘 추천 비중이 높아 engagement이 핵심 지표)
export const SCORE_WEIGHTS = {
  velocity: 0.25,            // 30→25% (Shorts는 추천 기반이라 속도 덜 중요)
  engagement: 0.30,          // 25→30% (좋아요 비율이 Shorts 알고리즘 핵심)
  interaction: 0.10,
  viralCoefficient: 0.15,
  recency: 0.10,
  categoryOutperformance: 0.10,
};
