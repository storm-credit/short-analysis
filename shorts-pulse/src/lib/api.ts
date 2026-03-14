import { ShortVideo, CategoryBenchmark } from '@/types';
import { SHORTS_MAX_DURATION, CACHE_EXPIRY_HOURS, STORAGE_KEYS } from './constants';
import { parseDurationToSeconds, getThumbnail, hoursAge } from './utils';
import { calculateViralityScore, buildCategoryBenchmarks, getTier } from './scoring';

// ==========================================
// API Key Management
// ==========================================
let apiKeys: string[] = [];
let currentKeyIndex = 0;

export function loadApiKeys(): string[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEYS.API_KEYS);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      apiKeys = Array.isArray(parsed) ? parsed : [stored];
    } catch {
      apiKeys = [];
    }
  } else {
    const old = localStorage.getItem('yt_api_key');
    if (old) apiKeys = [old];
  }
  apiKeys = apiKeys.filter((k) => k && k.trim());
  return apiKeys;
}

export function saveApiKeys(keys: string[]): void {
  apiKeys = keys.filter((k) => k && k.trim());
  localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(apiKeys));
}

export function getApiKeyCount(): number {
  return apiKeys.length;
}

// ==========================================
// Fetch with Fallback (Key Rotation)
// ==========================================
async function fetchWithFallback(urlBuilder: (key: string) => string): Promise<Record<string, unknown>> {
  if (apiKeys.length === 0) throw new Error('No API keys configured');
  const maxRetries = apiKeys.length;
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    const idx = (currentKeyIndex + i) % apiKeys.length;
    const url = urlBuilder(apiKeys[idx]);
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok) {
        currentKeyIndex = idx;
        return json;
      }
      if (json.error && (res.status === 403 || json.error.code === 403)) {
        console.warn(`Key ${idx} quota exceeded. Rotating...`);
        continue;
      }
      if (json.error) throw new Error(json.error.message);
      return json;
    } catch (err) {
      lastError = err as Error;
      if ((err as Error).message?.includes('Failed to fetch')) continue;
      throw err;
    }
  }
  throw new Error(`All API keys exhausted. Last error: ${lastError?.message}`);
}

// ==========================================
// Cache
// ==========================================
function cacheGet(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if ((Date.now() - timestamp) / 3600000 > CACHE_EXPIRY_HOURS) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function cacheSet(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // quota exceeded
  }
}

export function saveSnapshot(date: string, region: string, shorts: ShortVideo[]): void {
  const key = `${STORAGE_KEYS.SNAPSHOT_PREFIX}${date}_${region}`;
  try {
    localStorage.setItem(key, JSON.stringify(shorts));
  } catch { /* ok */ }
}

export function getSnapshot(date: string, region: string): ShortVideo[] | null {
  const key = `${STORAGE_KEYS.SNAPSHOT_PREFIX}${date}_${region}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCache(): void {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(STORAGE_KEYS.CACHE_PREFIX) || key.startsWith(STORAGE_KEYS.SNAPSHOT_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}

export function clearTrendingCache(): void {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(STORAGE_KEYS.CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
}

// ==========================================
// API Calls
// ==========================================
async function fetchTrending(regionCode: string): Promise<Record<string, unknown>> {
  const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}${regionCode}_trending`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const json = await fetchWithFallback(
    (key) =>
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${regionCode}&maxResults=50&key=${key}`
  );
  cacheSet(cacheKey, json);
  return json;
}

async function fetchChannelSubscribers(channelIds: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(channelIds)];
  const subMap: Record<string, number> = {};
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    try {
      const json = await fetchWithFallback(
        (key) =>
          `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${batch.join(',')}&key=${key}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (json as any).items;
      if (items) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items.forEach((ch: any) => {
          subMap[ch.id] = parseInt(ch.statistics.subscriberCount) || 0;
        });
      }
    } catch (e) {
      console.warn('Channel fetch error:', e);
    }
  }
  return subMap;
}

// ==========================================
// Process Videos
// ==========================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processVideos(apiResponse: any, subMap: Record<string, number>): ShortVideo[] {
  if (!apiResponse?.items) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return apiResponse.items.map((item: any) => {
    const s = item.snippet;
    const st = item.statistics;
    const dur = parseDurationToSeconds(item.contentDetails?.duration);
    return {
      id: item.id,
      title: s.title,
      channelTitle: s.channelTitle,
      channelId: s.channelId,
      thumbnail: getThumbnail(s),
      publishedAt: s.publishedAt,
      categoryId: s.categoryId,
      tags: s.tags || [],
      viewCount: parseInt(st?.viewCount) || 0,
      likeCount: parseInt(st?.likeCount) || 0,
      commentCount: parseInt(st?.commentCount) || 0,
      durationSec: dur,
      subscriberCount: subMap[s.channelId] || 0,
      isShort: dur <= SHORTS_MAX_DURATION,
      engagementRate: 0,
      viewsPerHour: 0,
      viralityScore: 0,
      tier: null,
      scoreBreakdown: null,
      rawMetrics: null,
    };
  });
}

function filterShorts(videos: ShortVideo[]): ShortVideo[] {
  return videos.filter((v) => v.isShort || v.title.toLowerCase().includes('#shorts'));
}

function enrichWithScores(videos: ShortVideo[], benchmarks: Record<string, CategoryBenchmark>): ShortVideo[] {
  videos.forEach((v) => {
    const h = hoursAge(v.publishedAt);
    v.viewsPerHour = h < 0.5 ? v.viewCount : Math.round(v.viewCount / h);
    v.engagementRate = v.viewCount > 0 ? (v.likeCount + v.commentCount) / v.viewCount * 100 : 0;
    const result = calculateViralityScore(v, benchmarks[v.categoryId]);
    v.viralityScore = result.total;
    v.scoreBreakdown = result.breakdown;
    v.rawMetrics = result.raw;
    v.tier = getTier(result.total);
  });
  return videos;
}

// ==========================================
// Main Fetch Function
// ==========================================
export interface FetchResult {
  shortsOnly: Record<string, ShortVideo[]>;
  allTrending: Record<string, ShortVideo[]>;
}

export async function fetchAllRegions(
  regionCodes: string[],
  onProgress?: (msg: string) => void
): Promise<FetchResult> {
  onProgress?.('Fetching trending videos from 4 regions...');

  const results = await Promise.all(
    regionCodes.map((code) =>
      fetchTrending(code).catch((e) => {
        console.warn(`Failed to fetch ${code}:`, e);
        return { items: [] };
      })
    )
  );

  // Collect channel IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems = results.flatMap((r: any) => r.items || []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelIds = [...new Set(allItems.map((i: any) => i.snippet?.channelId).filter(Boolean))] as string[];

  onProgress?.('Analyzing channel data...');
  const subMap = await fetchChannelSubscribers(channelIds);

  onProgress?.('Calculating virality scores...');

  const shortsOnly: Record<string, ShortVideo[]> = {};
  const allTrending: Record<string, ShortVideo[]> = {};

  regionCodes.forEach((code, i) => {
    const processed = processVideos(results[i], subMap);
    const shorts = filterShorts(processed);
    allTrending[code] = processed;

    const benchmarks = buildCategoryBenchmarks(processed);
    shortsOnly[code] = enrichWithScores(shorts, benchmarks);
  });

  return { shortsOnly, allTrending };
}

// ==========================================
// Mock Data
// ==========================================
export function generateMockShorts(count: number): ShortVideo[] {
  const channels = ['MrBeast Shorts', 'Dude Perfect', 'Like Nastya', 'Stokes Twins', 'ZHC', 'Brent Rivera', 'Alan Chikin Chow', 'Ben Azelart', 'Bayashi TV', 'CookingTree'];
  const titles = [
    'You Won\'t Believe What Happened! 😱', 'This Trick Will Blow Your Mind 🤯',
    'I Tried the Viral Trend... 🔥', 'Testing the IMPOSSIBLE Challenge',
    'World Record Attempt Gone Wrong', '$1 vs $1000 Challenge!',
    'When Your Friend Does THIS...', 'Rating Subscriber Ideas 🎯',
    'The Secret Nobody Tells You', 'How To Go VIRAL in 2024 📈',
  ];
  const cats = ['20', '22', '23', '24', '26'];
  const shorts: ShortVideo[] = [];

  for (let i = 0; i < count; i++) {
    const views = Math.floor(Math.random() * 10000000) + 50000;
    const subs = Math.floor(Math.random() * 50000000) + 100000;
    const hoursAgoVal = Math.random() * 72;
    const published = new Date(Date.now() - hoursAgoVal * 3600000).toISOString();

    shorts.push({
      id: 'mock_' + i,
      title: titles[i % titles.length],
      channelTitle: channels[i % channels.length],
      channelId: 'UC_mock_' + i,
      thumbnail: `https://picsum.photos/seed/short${i}/270/480`,
      publishedAt: published,
      categoryId: cats[i % cats.length],
      tags: [],
      viewCount: views,
      likeCount: Math.floor(views * (0.02 + Math.random() * 0.06)),
      commentCount: Math.floor(views * (0.001 + Math.random() * 0.005)),
      durationSec: Math.floor(Math.random() * 55) + 5,
      subscriberCount: subs,
      isShort: true,
      engagementRate: 0,
      viewsPerHour: 0,
      viralityScore: 0,
      tier: null,
      scoreBreakdown: null,
      rawMetrics: null,
    });
  }

  const benchmarks = buildCategoryBenchmarks(shorts);
  return enrichWithScores(shorts, benchmarks);
}
