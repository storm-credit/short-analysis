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
      // 429 (rate limit) 등 일시적 에러도 다음 키 시도
      if (json.error && (res.status === 429 || res.status >= 500)) {
        console.warn(`Key ${idx} error ${res.status}. Rotating...`);
        continue;
      }
      if (json.error) throw new Error(json.error.message);
    } catch (err) {
      lastError = err as Error;
      // 네트워크 에러 또는 타임아웃 → 다음 키 시도
      const msg = (err as Error).message || '';
      if (msg.includes('Failed to fetch') || msg.includes('aborted') || msg.includes('network')) continue;
      // 그 외 복구 불가능한 에러 → 즉시 throw
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
/** 영어권 기본 쿼리 */
const TOPIC_QUERIES_EN = [
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

/** 지역별 현지 언어 쿼리 — 해당 언어로 검색해야 인도 콘텐츠 안 섞임 */
const TOPIC_QUERIES_LOCALIZED: Record<string, { query: string; topic: string }[]> = {
  KR: [
    // 넓은 인기 검색어 — '쇼츠' 제거로 검색 범위 확대
    { query: '알고보면 몰랐던 사실 #shorts', topic: '상식/팩트' },
    { query: '이거 실화 레전드 ㄷㄷ', topic: '상식/팩트' },
    { query: 'vs 비교 대결 어떤게 나을까', topic: '비교/VS' },
    { query: '왜 과학적으로 설명 알려드림', topic: '과학/교육' },
    { query: 'TOP 순위 랭킹 1위', topic: '랭킹/순위' },
    { query: '귀여운 동물 강아지 고양이 반응', topic: '동물/자연' },
    { query: '우주 지구 행성 미스터리', topic: '우주/SF' },
    { query: '역사 한국사 조선 사건', topic: '역사' },
    { query: '건강 다이어트 운동 습관', topic: '건강/인체' },
    { query: '심리테스트 성격 MBTI 심리', topic: '심리/뇌과학' },
    { query: '나라별 문화 차이 한국 외국', topic: '문화/세계' },
    { query: '맛집 레시피 음식 먹방', topic: '음식/영양' },
    { query: 'AI 챗GPT 기술 미래', topic: '테크/AI' },
    { query: '꿀팁 생활 해킹 알아두면', topic: '꿀팁/생활' },
    { query: '충격 반전 소름 결말', topic: '엔터/반전' },
    { query: '돈 재테크 주식 부동산 경제', topic: '경제/재테크' },
  ],
  JP: [
    { query: '知らなかった事実 雑学 ショート', topic: '상식/팩트' },
    { query: '比較 対決 どっちがいい ショート', topic: '비교/VS' },
    { query: 'なぜ 科学 解説 ショート', topic: '과학/교육' },
    { query: 'ランキング トップ 最高 最悪 ショート', topic: '랭킹/순위' },
    { query: '動物 自然 野生 すごい ショート', topic: '동물/자연' },
    { query: '宇宙 惑星 銀河 ショート', topic: '우주/SF' },
    { query: '歴史 事件 戦争 ショート', topic: '역사' },
    { query: '健康 人体 医学 ショート', topic: '건강/인체' },
    { query: '心理 脳科学 行動 ショート', topic: '심리/뇌과학' },
    { query: '国 文化 違い 世界 ショート', topic: '문화/세계' },
    { query: '食べ物 栄養 料理 ショート', topic: '음식/영양' },
    { query: '技術 AI ロボット 未来 ショート', topic: '테크/AI' },
  ],
  ES: [
    { query: 'sabías que datos curiosos shorts', topic: '상식/팩트' },
    { query: 'versus comparación cuál es mejor shorts', topic: '비교/VS' },
    { query: 'por qué cómo ciencia explicado shorts', topic: '과학/교육' },
    { query: 'ranking top mejor peor shorts', topic: '랭킹/순위' },
    { query: 'animales naturaleza salvaje shorts', topic: '동물/자연' },
    { query: 'espacio universo planetas shorts', topic: '우주/SF' },
    { query: 'historia qué pasó explicado shorts', topic: '역사' },
    { query: 'cuerpo humano salud datos shorts', topic: '건강/인체' },
    { query: 'psicología mente cerebro shorts', topic: '심리/뇌과학' },
    { query: 'países cultura mundo diferencias shorts', topic: '문화/세계' },
    { query: 'comida nutrición cocina mitos shorts', topic: '음식/영양' },
    { query: 'tecnología inteligencia artificial futuro shorts', topic: '테크/AI' },
  ],
  BR: [
    { query: 'você sabia fatos curiosos shorts', topic: '상식/팩트' },
    { query: 'versus comparação qual melhor shorts', topic: '비교/VS' },
    { query: 'por que como ciência explicado shorts', topic: '과학/교육' },
    { query: 'ranking top melhor pior shorts', topic: '랭킹/순위' },
    { query: 'animais natureza selvagem shorts', topic: '동물/자연' },
    { query: 'espaço universo planetas shorts', topic: '우주/SF' },
    { query: 'história o que aconteceu shorts', topic: '역사' },
    { query: 'corpo humano saúde fatos shorts', topic: '건강/인체' },
    { query: 'psicologia mente cérebro shorts', topic: '심리/뇌과학' },
    { query: 'países cultura mundo diferenças shorts', topic: '문화/세계' },
    { query: 'comida nutrição culinária shorts', topic: '음식/영양' },
    { query: 'tecnologia IA robô futuro shorts', topic: '테크/AI' },
  ],
  DE: [
    { query: 'wusstest du erstaunliche fakten shorts', topic: '상식/팩트' },
    { query: 'vergleich was ist besser shorts', topic: '비교/VS' },
    { query: 'warum wie wissenschaft erklärt shorts', topic: '과학/교육' },
    { query: 'ranking top beste schlechteste shorts', topic: '랭킹/순위' },
    { query: 'tiere natur wildtiere shorts', topic: '동물/자연' },
    { query: 'weltraum universum planeten shorts', topic: '우주/SF' },
    { query: 'geschichte was ist passiert shorts', topic: '역사' },
    { query: 'körper gesundheit medizin fakten shorts', topic: '건강/인체' },
    { query: 'psychologie gehirn verhalten shorts', topic: '심리/뇌과학' },
    { query: 'länder kultur welt unterschiede shorts', topic: '문화/세계' },
    { query: 'essen ernährung kochen shorts', topic: '음식/영양' },
    { query: 'technologie KI roboter zukunft shorts', topic: '테크/AI' },
  ],
  FR: [
    { query: 'saviez-vous faits incroyables shorts', topic: '상식/팩트' },
    { query: 'versus comparaison lequel est mieux shorts', topic: '비교/VS' },
    { query: 'pourquoi comment science expliqué shorts', topic: '과학/교육' },
    { query: 'classement top meilleur pire shorts', topic: '랭킹/순위' },
    { query: 'animaux nature sauvage shorts', topic: '동물/자연' },
    { query: 'espace univers planètes shorts', topic: '우주/SF' },
    { query: 'histoire que s est passé shorts', topic: '역사' },
    { query: 'corps humain santé faits shorts', topic: '건강/인체' },
    { query: 'psychologie cerveau comportement shorts', topic: '심리/뇌과학' },
    { query: 'pays culture monde différences shorts', topic: '문화/세계' },
    { query: 'nourriture nutrition cuisine shorts', topic: '음식/영양' },
    { query: 'technologie IA robot futur shorts', topic: '테크/AI' },
  ],
};

/** MX(멕시코)는 ES(스페인)와 동일 스페인어, CH(스위스)는 DE(독일)과 동일 독일어 */
const LOCALIZED_ALIASES: Record<string, string> = { MX: 'ES', CH: 'DE' };

/** regionCode에 맞는 쿼리 반환 */
function getTopicQueries(regionCode: string): { query: string; topic: string }[] {
  const alias = LOCALIZED_ALIASES[regionCode] || regionCode;
  return TOPIC_QUERIES_LOCALIZED[alias] || TOPIC_QUERIES_EN;
}

/** 비라틴 문자 감지 — 인도(힌디/타밀 등), 아랍, 태국 콘텐츠 필터 */
const NON_TARGET_SCRIPTS = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0600-\u06FF\u0E00-\u0E7F]/;

/** 해당 지역에서 허용하는 문자 스크립트 (이 문자가 있으면 통과) */
const ALLOWED_SCRIPTS: Record<string, RegExp> = {
  KR: /[\uAC00-\uD7AF\u3130-\u318F]/,     // 한글
  JP: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/, // 히라가나+가타카나+한자
};

/** 선택 지역과 무관한 콘텐츠인지 판별 */
function isIrrelevantRegion(video: ShortVideo, regionCode: string): boolean {
  const text = video.title + ' ' + video.channelTitle;
  // 힌디/아랍/태국 등 비대상 문자가 포함되면 필터링
  if (NON_TARGET_SCRIPTS.test(text)) return true;
  // 해당 지역 전용 문자가 있으면 OK (KR→한글, JP→일본어)
  const allowed = ALLOWED_SCRIPTS[regionCode];
  if (allowed && !allowed.test(text)) {
    // 영어만 있는 콘텐츠는 허용 (한국/일본에서도 영어 쇼츠 존재)
  }
  return false;
}

interface ShortsResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  /** videoId → topicTag 매핑 */
  topicMap: Record<string, string>;
}

async function fetchShorts(regionCode: string): Promise<ShortsResult> {
  const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}${regionCode}_shorts_v6`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached as unknown as ShortsResult;

  const queries = getTopicQueries(regionCode);
  const maxPerQuery = 30;
  const lang = REGIONS[regionCode]?.lang || 'en';

  // Step 1: 지역 언어별 쿼리로 검색 (한국→한국어, 일본→일본어, 영어권→영어)
  const searchResults = await Promise.all(
    queries.map((tq) =>
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
        if (!topicMap[vid]) topicMap[vid] = queries[qi].topic;
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

/** 최근 7일 이내 발행된 영상만 검색 (3일→7일: 바이럴 쇼츠는 보통 2~5일 내 폭발) */
function getRecentDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
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

  // 광고/공식 콘텐츠 + 비대상 지역 콘텐츠 필터링
  return scored.filter((v) => !isSpamOrPromo(v) && !isIrrelevantRegion(v, regionCode));
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
