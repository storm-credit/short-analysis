import { RegionInfo } from '@/types';

export const REGIONS: Record<string, RegionInfo> = {
  NO: { code: 'NO', name: '노르웨이', flag: '🇳🇴', avgCPM: 43.00 },
  AU: { code: 'AU', name: '호주', flag: '🇦🇺', avgCPM: 36.00 },
  CH: { code: 'CH', name: '스위스', flag: '🇨🇭', avgCPM: 23.00 },
  GB: { code: 'GB', name: '영국', flag: '🇬🇧', avgCPM: 22.00 },
  DE: { code: 'DE', name: '독일', flag: '🇩🇪', avgCPM: 20.00 },
  US: { code: 'US', name: '미국', flag: '🇺🇸', avgCPM: 13.00 },
  CA: { code: 'CA', name: '캐나다', flag: '🇨🇦', avgCPM: 12.00 },
  FR: { code: 'FR', name: '프랑스', flag: '🇫🇷', avgCPM: 3.90 },
  KR: { code: 'KR', name: '한국', flag: '🇰🇷', avgCPM: 3.50 },
  JP: { code: 'JP', name: '일본', flag: '🇯🇵', avgCPM: 2.90 },
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
  '왜', '어떻게', '뭐가', '비교', '최고', '최악', 'vs',
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

export const SCORE_WEIGHTS = {
  velocity: 0.30,
  engagement: 0.25,       // 20→25% (Shorts에서 참여도 더 중요)
  interaction: 0.10,       // 15→10% (engagement으로 가중치 이동)
  viralCoefficient: 0.15,
  recency: 0.10,
  categoryOutperformance: 0.10,
};
