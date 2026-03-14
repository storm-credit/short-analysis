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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
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

/**
 * Q&A/교육형 Shorts 검색 — AskAnything 스타일
 *
 * 검색 전략:
 * - 12개 주제 카테고리 쿼리를 병렬로 검색
 * - 각 쿼리별 maxResults=30 → 중복 제거 후 합산
 * - 일반 인기 쇼츠(연예/음악)가 아닌, 지식/비교/Q&A 콘텐츠 위주
 *
 * Quota: 12쿼리 × 10지역 = 120 search = 12,000 units
 * → 선택 지역만 전체 검색, 나머지는 핵심 4개만 검색
 */
const CORE_QUERIES = [
  'did you know amazing facts',             // 상식/놀라운 사실
  'vs comparison which is better',           // A vs B 비교형
  'why how science explained',               // 과학/교육
  'top ranking best worst',                  // 랭킹/순위형
];

const EXTENDED_QUERIES = [
  'animals nature wildlife amazing',         // 동물/자연
  'space universe aliens planet',            // 우주/SF
  'history what happened explained',         // 역사/시사
  'human body health facts',                 // 인체/건강
  'psychology mind brain facts',             // 심리/상식
  'country culture difference compare',      // 나라별 차이/비교
  'food nutrition myth truth',               // 음식/건강 상식
  'technology AI future invention',          // 테크/미래
];

async function fetchShorts(regionCode: string, useExtended: boolean = false): Promise<Record<string, unknown>> {
  const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}${regionCode}_shorts`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // 선택 지역 = 12개 전체 쿼리, 나머지 = 4개 핵심 쿼리 (quota 절약)
  const queries = useExtended ? [...CORE_QUERIES, ...EXTENDED_QUERIES] : CORE_QUERIES;
  const maxPerQuery = useExtended ? 30 : 25;

  // Step 1: Q&A 쿼리 병렬 검색
  const searchResults = await Promise.all(
    queries.map((q) =>
      fetchWithFallback(
        (key) =>
          `https://www.googleapis.com/youtube/v3/search?part=id&type=video&videoDuration=short&order=viewCount&regionCode=${regionCode}&publishedAfter=${getRecentDate()}&q=${encodeURIComponent(q)}&maxResults=${maxPerQuery}&key=${key}`
      ).catch(() => ({ items: [] }))
    )
  );

  // 중복 제거 후 videoId 수집
  const idSet = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchResults.forEach((res: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res.items || []).forEach((item: any) => {
      const vid = item.id?.videoId;
      if (vid) idSet.add(vid);
    });
  });

  const videoIds = Array.from(idSet).join(',');
  if (!videoIds) {
    cacheSet(cacheKey, { items: [] });
    return { items: [] };
  }

  // Step 2: Videos API로 상세 데이터 (50개씩 배치)
  const idArray = Array.from(idSet);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allItems: any[] = [];
  for (let i = 0; i < idArray.length; i += 50) {
    const batch = idArray.slice(i, i + 50).join(',');
    const json = await fetchWithFallback(
      (key) =>
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${batch}&key=${key}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allItems = allItems.concat((json as any).items || []);
  }

  const result = { items: allItems };
  cacheSet(cacheKey, result);
  return result;
}

/** 최근 3일 이내 발행된 영상만 검색 */
function getRecentDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return d.toISOString();
}

/** 기존 트렌딩 (일반 영상) — 벤치마크용으로 유지 */
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
  onProgress?: (msg: string) => void,
  focusRegion?: string
): Promise<FetchResult> {
  const focus = focusRegion || regionCodes[0];

  // Quota 최적화: 선택 지역은 확장 검색(12쿼리), 나머지는 핵심만(4쿼리)
  // 트렌딩(mostPopular)는 1 unit이므로 전 지역 가능
  onProgress?.(`${regionCodes.length}개 지역에서 쇼츠 검색 중...`);

  const [shortsResults, trendingResults] = await Promise.all([
    // Shorts: 순차적으로 (선택 지역 먼저, 캐시 있으면 빠르게 통과)
    (async () => {
      const results: Record<string, unknown>[] = [];
      for (const code of regionCodes) {
        try {
          results.push(await fetchShorts(code, code === focus));
        } catch (e) {
          console.warn(`Failed to fetch shorts ${code}:`, e);
          results.push({ items: [] });
        }
      }
      return results;
    })(),
    Promise.all(
      regionCodes.map((code) =>
        fetchTrending(code).catch((e) => {
          console.warn(`Failed to fetch trending ${code}:`, e);
          return { items: [] };
        })
      )
    ),
  ]);

  // Collect channel IDs from both sources
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems = [...shortsResults, ...trendingResults].flatMap((r: any) => r.items || []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelIds = [...new Set(allItems.map((i: any) => i.snippet?.channelId).filter(Boolean))] as string[];

  onProgress?.('채널 데이터 분석 중...');
  const subMap = await fetchChannelSubscribers(channelIds);

  onProgress?.('바이럴 점수 계산 중...');

  const shortsOnly: Record<string, ShortVideo[]> = {};
  const allTrending: Record<string, ShortVideo[]> = {};

  regionCodes.forEach((code, i) => {
    // 트렌딩 데이터 (벤치마크 기준)
    const trendingProcessed = processVideos(trendingResults[i], subMap);
    allTrending[code] = trendingProcessed;

    // Shorts 데이터 (Search API 결과)
    const shortsProcessed = processVideos(shortsResults[i], subMap);
    // 3분(180초) 이하만 필터
    const shorts = shortsProcessed.filter((v) => v.durationSec <= SHORTS_MAX_DURATION);

    // 트렌딩에서도 Shorts 추출 (중복 제거)
    const shortsFromTrending = filterShorts(trendingProcessed);
    const existingIds = new Set(shorts.map((v) => v.id));
    shortsFromTrending.forEach((v) => {
      if (!existingIds.has(v.id)) shorts.push(v);
    });

    const benchmarks = buildCategoryBenchmarks([...trendingProcessed, ...shortsProcessed]);
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
    'Why Do We Dream? The Real Science 🧠', '$1 vs $1000 Challenge!',
    'How AI Actually Works — Explained Simply', 'Testing the IMPOSSIBLE Challenge',
    'iPhone vs Samsung — Which is BEST?', 'The Secret Nobody Tells You 🤫',
    'Why Japan is Different from Korea?', 'Top 5 Hidden Tricks You Didn\'t Know 🎯',
    'Did You Know This About Space? 🚀', 'How To Go VIRAL in 2024 📈',
    'Which Country Pays More? Compare!', 'The Truth About Social Media 😱',
    'Best Productivity Hack Ever', 'What Happens If You Stop Eating Sugar?',
    'Ranking Fast Food — Worst to Best', 'Why Nobody Talks About This...',
  ];
  const cats = ['27', '28', '22', '24', '26', '20', '23'];
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
      tags: ['shorts', 'trending', 'viral'],
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
