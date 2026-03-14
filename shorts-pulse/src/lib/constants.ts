import { RegionInfo } from '@/types';

export const REGIONS: Record<string, RegionInfo> = {
  US: { code: 'US', name: 'United States', flag: '🇺🇸', avgCPM: 12.50 },
  GB: { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', avgCPM: 10.20 },
  AU: { code: 'AU', name: 'Australia', flag: '🇦🇺', avgCPM: 9.80 },
  CA: { code: 'CA', name: 'Canada', flag: '🇨🇦', avgCPM: 8.50 },
};

export const CATEGORY_MAP: Record<string, string> = {
  '1': 'Film & Animation',
  '2': 'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Tech',
  '29': 'Nonprofits',
};

export const SHORTS_MAX_DURATION = 60;
export const CACHE_EXPIRY_HOURS = 2;

export const STORAGE_KEYS = {
  API_KEYS: 'yt_api_keys',
  DARK_MODE: 'darkMode',
  CACHE_PREFIX: 'shorts_cache_',
  SNAPSHOT_PREFIX: 'shorts_snap_',
};

export const SCORE_WEIGHTS = {
  velocity: 0.30,
  engagement: 0.20,
  interaction: 0.15,
  viralCoefficient: 0.15,
  recency: 0.10,
  categoryOutperformance: 0.10,
};
