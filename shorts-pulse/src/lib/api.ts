import { ShortVideo, CategoryBenchmark } from '@/types';
import { SHORTS_MAX_DURATION, CACHE_EXPIRY_HOURS, STORAGE_KEYS, REGIONS } from './constants';
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
/** 주제별 검색 쿼리 — 각 쿼리에 topicTag 부여 */
const TOPIC_QUERIES = [
  { query: 'did you know amazing facts shorts', topic: '상식/팩트' },
  { query: 'vs comparison which is better shorts', topic: '비교/VS' },
  { query: 'why how science explained shorts', topic: '과학/교육' },
  { query: 'top ranking best worst shorts', topic: '랭킹/순위' },
  { query: 'animals nature wildlife amazing shorts', topic: '동물/자연' },
  { query: 'space universe cosmos planet shorts', topic: '우주/SF' },
  { query: 'history what happened explained shorts', topic: '역사' },
  { query: 'human body health medical facts shorts', topic: '건강/인체' },
  { query: 'psychology mind brain behavior shorts', topic: '심리/뇌과학' },
  { query: 'country culture world difference shorts', topic: '문화/세계' },
  { query: 'food nutrition cooking myth shorts', topic: '음식/영양' },
  { query: 'technology AI robot future shorts', topic: '테크/AI' },
];

interface ShortsResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  /** videoId → topicTag 매핑 */
  topicMap: Record<string, string>;
}

async function fetchShorts(regionCode: string): Promise<ShortsResult> {
  const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}${regionCode}_shorts_v4`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached as unknown as ShortsResult;

  const maxPerQuery = 25;
  const lang = REGIONS[regionCode]?.lang || 'en';

  // Step 1: 12개 주제별 병렬 검색 (relevanceLanguage로 해당 언어 콘텐츠 우선)
  const searchResults = await Promise.all(
    TOPIC_QUERIES.map((tq) =>
      fetchWithFallback(
        (key) =>
          `https://www.googleapis.com/youtube/v3/search?part=id&type=video&videoDuration=short&order=viewCount&regionCode=${regionCode}&relevanceLanguage=${lang}&publishedAfter=${getRecentDate()}&q=${encodeURIComponent(tq.query)}&maxResults=${maxPerQuery}&key=${key}`
      ).catch(() => ({ items: [] }))
    )
  );

  // videoId → topicTag 매핑 (첫 번째 검색 쿼리의 topic이 우선)
  const topicMap: Record<string, string> = {};
  const idSet = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  searchResults.forEach((res: any, qi: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res.items || []).forEach((item: any) => {
      const vid = item.id?.videoId;
      if (vid) {
        idSet.add(vid);
        if (!topicMap[vid]) topicMap[vid] = TOPIC_QUERIES[qi].topic;
      }
    });
  });

  if (idSet.size === 0) {
    const empty = { items: [], topicMap: {} };
    cacheSet(cacheKey, empty);
    return empty;
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

  const result: ShortsResult = { items: allItems, topicMap };
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
function processVideos(apiResponse: any, subMap: Record<string, number>, topicMap?: Record<string, string>): ShortVideo[] {
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
      topicTag: topicMap?.[item.id] || '기타',
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

/** 광고/공식 채널 필터 — 선전성 콘텐츠 제외 */
const SPAM_KEYWORDS = [
  'official', 'mv', 'music video', 'trailer', 'teaser', 'promo',
  '공식', '뮤직비디오', '예고편', '광고', 'commercial', 'ad ',
  'sponsored', '#ad', 'VEVO',
];

function isSpamOrPromo(video: ShortVideo): boolean {
  const t = video.title.toLowerCase();
  const ch = video.channelTitle.toLowerCase();
  return SPAM_KEYWORDS.some((kw) => t.includes(kw.toLowerCase()) || ch.includes(kw.toLowerCase()));
}

/**
 * 단일 지역 쇼츠 검색 — 선택한 지역만 검색해서 쿼터 절약
 * 12쿼리 × 1지역 = 12 search calls = 1,200 units (10지역 대비 90% 절약)
 */
export async function fetchRegionShorts(
  regionCode: string,
  onProgress?: (msg: string) => void,
): Promise<ShortVideo[]> {
  onProgress?.(`${regionCode} 지역 쇼츠 검색 중...`);

  // Shorts 검색 + 트렌딩 병렬 실행
  const [shortsResult, trendingResult] = await Promise.all([
    fetchShorts(regionCode).catch((e) => {
      console.warn(`Shorts fetch failed ${regionCode}:`, e);
      return { items: [], topicMap: {} } as ShortsResult;
    }),
    fetchTrending(regionCode).catch((e) => {
      console.warn(`Trending fetch failed ${regionCode}:`, e);
      return { items: [] };
    }),
  ]);

  // 채널 구독자 수집
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems = [...(shortsResult.items || []), ...((trendingResult as any).items || [])];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelIds = [...new Set(allItems.map((i: any) => i.snippet?.channelId).filter(Boolean))] as string[];

  onProgress?.('채널 데이터 분석 중...');
  const subMap = await fetchChannelSubscribers(channelIds);

  onProgress?.('바이럴 점수 계산 중...');

  // Shorts 처리 (topicTag 포함)
  const shortsProcessed = processVideos({ items: shortsResult.items }, subMap, shortsResult.topicMap);
  const shorts = shortsProcessed.filter((v) => v.durationSec <= SHORTS_MAX_DURATION);

  // 트렌딩에서 Shorts 추출 (중복 제거)
  const trendingProcessed = processVideos(trendingResult, subMap);
  const shortsFromTrending = filterShorts(trendingProcessed);
  const existingIds = new Set(shorts.map((v) => v.id));
  shortsFromTrending.forEach((v) => {
    if (!existingIds.has(v.id)) shorts.push(v);
  });

  // 벤치마크 → 점수 계산
  const benchmarks = buildCategoryBenchmarks([...trendingProcessed, ...shortsProcessed]);
  const scored = enrichWithScores(shorts, benchmarks);

  // 광고/공식 콘텐츠 필터링
  return scored.filter((v) => !isSpamOrPromo(v));
}

/** 여러 지역 한번에 (지역 비교용) */
export async function fetchAllRegions(
  regionCodes: string[],
  onProgress?: (msg: string) => void,
): Promise<FetchResult> {
  onProgress?.(`${regionCodes.length}개 지역에서 쇼츠 검색 중...`);

  const shortsOnly: Record<string, ShortVideo[]> = {};
  const allTrending: Record<string, ShortVideo[]> = {};

  for (const code of regionCodes) {
    onProgress?.(`${code} 지역 검색 중...`);
    try {
      shortsOnly[code] = await fetchRegionShorts(code);
    } catch (e) {
      console.warn(`Failed: ${code}`, e);
      shortsOnly[code] = [];
    }
    allTrending[code] = []; // 지역 비교에서는 트렌딩 불필요
  }

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
      topicTag: ['상식/팩트', '비교/VS', '과학/교육', '동물/자연', '우주/SF', '건강/인체', '심리/뇌과학'][i % 7],
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
