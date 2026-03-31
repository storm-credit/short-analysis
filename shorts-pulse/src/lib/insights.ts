import { ShortVideo, KeywordTrend, HookPattern, ContentIdea } from '@/types';
import { CATEGORY_MAP } from './constants';
import { hoursAge } from './utils';

// 불용어 (stopwords) — 확장
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'up', 'about', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'it', 'its', 'this',
  'that', 'these', 'those', 'he', 'she', 'they', 'we', 'you', 'i', 'me',
  'my', 'your', 'his', 'her', 'our', 'their', 'and', 'but', 'or', 'not',
  'no', 'so', 'if', 'just', 'all', 'very', 'too', 'also', 'as', 'than',
  'then', 'when', 'what', 'how', 'who', 'which', 'where', 'why',
  'shorts', 'short', 'video', 'new', 'now', 'get', 'got', 'one', 'two',
  'like', 'go', 'going', 'make', 'making', 'see', 'look', 'know',
  'de', 'la', 'el', 'en', 'le', 'les', 'un', 'une', 'des', 'du',
  'really', 'ever', 'even', 'much', 'many', 'more', 'most', 'only',
  'thing', 'things', 'way', 'day', 'time', 'people', 'world',
  'first', 'last', 'every', 'part', 'real', 'big', 'little', 'full',
]);

// ==========================================
// TF-IDF 키워드 추출 (v3)
// ==========================================

interface TokenInfo {
  token: string;
  score: number;
  title: string;
  views: number;
  isBigram: boolean;
}

/**
 * 제목에서 토큰 추출 (유니그램 + 바이그램)
 */
function tokenizeTitle(title: string): { unigrams: string[]; bigrams: string[] } {
  const cleaned = title
    .replace(/[^\w\sㄱ-ㅎ가-힣\-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .map((w) => w.toLowerCase());

  const unigrams = words.filter((w) => !STOPWORDS.has(w) && w.length >= 3);

  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i], w2 = words[i + 1];
    if (STOPWORDS.has(w1) || STOPWORDS.has(w2)) continue;
    if (w1.length < 2 || w2.length < 2) continue;
    bigrams.push(`${w1} ${w2}`);
  }

  return { unigrams, bigrams };
}

/**
 * TF-IDF 기반 트렌딩 키워드 추출
 *
 * 개선사항 (v2 → v3):
 * - TF-IDF: 단순 빈도 → 문서 빈도 역수 가중 (고유한 키워드 우선)
 * - 성과 가중: 고바이럴 영상의 키워드에 더 높은 점수
 * - 태그 활용: YouTube 태그에서 구체적 주제 추출 (가중치 2x)
 * - 바이그램 부스트: 2단어 구문에 1.8x 가중치
 * - 조회수 가중 TF: 많이 본 영상의 키워드가 더 중요
 */
export function extractKeywords(shorts: ShortVideo[]): KeywordTrend[] {
  if (shorts.length === 0) return [];

  const totalDocs = shorts.length;

  // Step 1: 문서별 토큰 수집 + 문서 빈도(DF) 계산
  const docFreq = new Map<string, number>(); // 키워드가 몇 개 문서에 등장하는지
  const tokenData = new Map<string, {
    count: number;
    scores: number[];
    views: number[];
    titles: string[];
    isBigram: boolean;
    totalTF: number; // 조회수 가중 TF 합계
  }>();

  shorts.forEach((v) => {
    const { unigrams, bigrams } = tokenizeTitle(v.title);
    const seenInDoc = new Set<string>();

    // 바이그램 처리
    bigrams.forEach((bg) => {
      if (!seenInDoc.has(bg)) {
        seenInDoc.add(bg);
        docFreq.set(bg, (docFreq.get(bg) || 0) + 1);
      }
      const existing = tokenData.get(bg) || {
        count: 0, scores: [], views: [], titles: [], isBigram: true, totalTF: 0,
      };
      existing.count++;
      existing.scores.push(v.viralityScore);
      existing.views.push(v.viewCount);
      if (existing.titles.length < 3) existing.titles.push(v.title);
      // 조회수 가중 TF: log(views) 기반
      existing.totalTF += Math.log10(Math.max(v.viewCount, 1));
      tokenData.set(bg, existing);
    });

    // 유니그램 처리
    unigrams.forEach((word) => {
      if (!seenInDoc.has(word)) {
        seenInDoc.add(word);
        docFreq.set(word, (docFreq.get(word) || 0) + 1);
      }
      const existing = tokenData.get(word) || {
        count: 0, scores: [], views: [], titles: [], isBigram: false, totalTF: 0,
      };
      existing.count++;
      existing.scores.push(v.viralityScore);
      existing.views.push(v.viewCount);
      if (existing.titles.length < 3) existing.titles.push(v.title);
      existing.totalTF += Math.log10(Math.max(v.viewCount, 1));
      tokenData.set(word, existing);
    });

    // 태그 처리 (구체적 주제 → 가중치 2x)
    v.tags.forEach((tag) => {
      const t = tag.toLowerCase().trim();
      if (t.length < 2 || STOPWORDS.has(t)) return;
      if (!seenInDoc.has(t)) {
        seenInDoc.add(t);
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }
      const existing = tokenData.get(t) || {
        count: 0, scores: [], views: [], titles: [], isBigram: t.includes(' '), totalTF: 0,
      };
      existing.count += 2; // 태그는 2x 가중
      existing.scores.push(v.viralityScore);
      existing.views.push(v.viewCount);
      if (existing.titles.length < 3) existing.titles.push(v.title);
      existing.totalTF += Math.log10(Math.max(v.viewCount, 1)) * 2;
      tokenData.set(t, existing);
    });
  });

  // Step 2: TF-IDF 점수 계산
  const results = Array.from(tokenData.entries())
    .filter(([, data]) => data.count >= 2) // 최소 2회 등장
    .map(([keyword, data]) => {
      const df = docFreq.get(keyword) || 1;
      const idf = Math.log(totalDocs / df); // 역문서 빈도

      // 성과 가중 평균: 높은 바이럴 점수를 가진 영상의 키워드가 더 중요
      const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const performanceWeight = 1 + (avgScore / 100); // 1.0 ~ 2.0

      // 바이그램 부스트 (더 구체적)
      const bigramBoost = data.isBigram ? 1.8 : 1.0;

      // 최종 TF-IDF 점수
      const tfidf = data.totalTF * idf * performanceWeight * bigramBoost;

      return {
        keyword,
        count: data.count, // 태그 2x 가중 포함
        avgScore: Math.round(avgScore),
        examples: data.titles,
        tfidf,
        avgViews: Math.round(data.views.reduce((a, b) => a + b, 0) / data.views.length),
      };
    })
    .sort((a, b) => b.tfidf - a.tfidf)
    .slice(0, 20);

  return results.map(({ tfidf: _, avgViews: __, ...rest }) => rest);
}

// ==========================================
// 훅/제목 패턴 분석
// ==========================================
const HOOK_PATTERNS: { pattern: RegExp; name: string; description: string }[] = [
  { pattern: /^(why|왜)\s/i, name: '왜 ~?', description: '궁금증 유발 질문형' },
  { pattern: /^(how|어떻게)\s/i, name: '어떻게 ~?', description: '방법/설명형' },
  { pattern: /^(what|뭐가|무엇)\s/i, name: '무엇이 ~?', description: '정보 탐구형' },
  { pattern: /^(did you know|알고)/i, name: '알고 계셨나요?', description: '놀라운 사실 공유형' },
  { pattern: /\bvs\.?\b/i, name: 'A vs B', description: '비교/대결형' },
  { pattern: /\b(top|best|worst|최고|최악|ranking)\b/i, name: 'TOP/랭킹', description: '순위/평가형' },
  { pattern: /\b(secret|truth|real reason|비밀|진실)\b/i, name: '비밀/진실', description: '숨겨진 정보 공개형' },
  { pattern: /\b(challenge|챌린지|도전)\b/i, name: '챌린지', description: '도전/실험형' },
  { pattern: /\b(hack|trick|tip|꿀팁|노하우)\b/i, name: '꿀팁/핵', description: '유용한 정보형' },
  { pattern: /\b(impossible|unbelievable|incredible|미쳤|대박|충격)\b/i, name: '충격/대박', description: '감탄/충격형' },
  { pattern: /\$[\d,]+\s*vs\s*\$[\d,]+/i, name: '$1 vs $1000', description: '가격 비교형' },
  { pattern: /\b(never|don't|stop|하지마|절대)\b/i, name: '금지/경고', description: '경고/주의형' },
  { pattern: /\b(test|experiment|실험|테스트)\b/i, name: '실험/테스트', description: '실험 검증형' },
  { pattern: /[?？]/, name: '질문형', description: '직접 질문으로 클릭 유도' },
  { pattern: /\b(wait|plot twist|반전|놀랍)\b/i, name: '반전', description: '반전 기대감 유발형' },
];

export function analyzeHookPatterns(shorts: ShortVideo[]): HookPattern[] {
  const results: HookPattern[] = [];

  HOOK_PATTERNS.forEach(({ pattern, name, description }) => {
    const matches = shorts.filter((v) => pattern.test(v.title));
    if (matches.length === 0) return;

    const avgScore = Math.round(
      matches.reduce((s, v) => s + v.viralityScore, 0) / matches.length
    );

    results.push({
      pattern: name,
      description,
      count: matches.length,
      avgScore,
      examples: matches
        .sort((a, b) => b.viralityScore - a.viralityScore)
        .slice(0, 3)
        .map((v) => ({ title: v.title, score: v.viralityScore })),
    });
  });

  return results.sort((a, b) => b.avgScore - a.avgScore);
}

// ==========================================
// 벤치마크 통계 계산
// ==========================================
export interface BenchmarkStats {
  totalShorts: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  avgEngagement: number;
  avgViralityScore: number;
  avgVPH: number;
  topCategory: string;
  topCategoryCount: number;
  qaStyleCount: number;
  qaStyleAvgScore: number;
  avgDuration: number;
}

export function calculateBenchmark(shorts: ShortVideo[]): BenchmarkStats {
  if (shorts.length === 0) {
    return {
      totalShorts: 0, avgViews: 0, avgLikes: 0, avgComments: 0,
      avgEngagement: 0, avgViralityScore: 0, avgVPH: 0,
      topCategory: '--', topCategoryCount: 0,
      qaStyleCount: 0, qaStyleAvgScore: 0, avgDuration: 0,
    };
  }

  const n = shorts.length;
  const sum = (fn: (v: ShortVideo) => number) => shorts.reduce((s, v) => s + fn(v), 0);

  const catCounts: Record<string, number> = {};
  shorts.forEach((v) => {
    const cat = CATEGORY_MAP[v.categoryId] || '기타';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

  const qaShorts = shorts.filter((v) => {
    const title = v.title.toLowerCase();
    return ['vs', 'why', 'how', 'what', '왜', '어떻게', '비교', '?'].some((kw) =>
      title.includes(kw)
    );
  });

  return {
    totalShorts: n,
    avgViews: Math.round(sum((v) => v.viewCount) / n),
    avgLikes: Math.round(sum((v) => v.likeCount) / n),
    avgComments: Math.round(sum((v) => v.commentCount) / n),
    avgEngagement: parseFloat((sum((v) => v.engagementRate) / n).toFixed(2)),
    avgViralityScore: Math.round(sum((v) => v.viralityScore) / n),
    avgVPH: Math.round(sum((v) => v.viewsPerHour) / n),
    topCategory: topCat?.[0] || '--',
    topCategoryCount: topCat?.[1] || 0,
    qaStyleCount: qaShorts.length,
    qaStyleAvgScore: qaShorts.length > 0
      ? Math.round(qaShorts.reduce((s, v) => s + v.viralityScore, 0) / qaShorts.length)
      : 0,
    avgDuration: Math.round(sum((v) => v.durationSec) / n),
  };
}

// ==========================================
// 최적 타이밍/길이 분석
// ==========================================
export interface TimingInsight {
  optimalDuration: { min: number; max: number; avgScore: number };
  peakHours: { hour: number; count: number; avgScore: number }[];
  durationBuckets: { label: string; count: number; avgScore: number; avgViews: number }[];
}

export function analyzeTimingPatterns(shorts: ShortVideo[]): TimingInsight {
  // 시간대별 성과
  const hourBuckets: Record<number, { count: number; scores: number[] }> = {};
  shorts.forEach((v) => {
    const hour = new Date(v.publishedAt).getUTCHours();
    if (!hourBuckets[hour]) hourBuckets[hour] = { count: 0, scores: [] };
    hourBuckets[hour].count++;
    hourBuckets[hour].scores.push(v.viralityScore);
  });

  const peakHours = Object.entries(hourBuckets)
    .map(([h, data]) => ({
      hour: parseInt(h),
      count: data.count,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5);

  // 영상 길이 구간별 성과
  const durBuckets = [
    { label: '~15초', min: 0, max: 15 },
    { label: '16~30초', min: 16, max: 30 },
    { label: '31~60초', min: 31, max: 60 },
    { label: '1~2분', min: 61, max: 120 },
    { label: '2~3분', min: 121, max: 180 },
  ];

  const durationBuckets = durBuckets.map(({ label, min, max }) => {
    const filtered = shorts.filter((v) => v.durationSec >= min && v.durationSec <= max);
    return {
      label,
      count: filtered.length,
      avgScore: filtered.length > 0
        ? Math.round(filtered.reduce((s, v) => s + v.viralityScore, 0) / filtered.length)
        : 0,
      avgViews: filtered.length > 0
        ? Math.round(filtered.reduce((s, v) => s + v.viewCount, 0) / filtered.length)
        : 0,
    };
  });

  // 최적 길이 — 바이럴 점수가 가장 높은 상위 25%의 평균 길이
  const topQuartile = [...shorts]
    .sort((a, b) => b.viralityScore - a.viralityScore)
    .slice(0, Math.max(1, Math.ceil(shorts.length * 0.25)));
  const topDurations = topQuartile.map((v) => v.durationSec).sort((a, b) => a - b);
  const optimalDuration = {
    min: topDurations[0] || 0,
    max: topDurations[topDurations.length - 1] || 60,
    avgScore: Math.round(topQuartile.reduce((s, v) => s + v.viralityScore, 0) / topQuartile.length),
  };

  return { optimalDuration, peakHours, durationBuckets };
}

// ==========================================
// 토픽 클러스터링 — 관련 키워드 그룹화
// ==========================================
export interface TopicCluster {
  name: string;        // 대표 키워드
  keywords: string[];  // 관련 키워드들
  totalCount: number;
  avgScore: number;
  topExample: string;
}

export function clusterTopics(
  shorts: ShortVideo[],
  keywords: KeywordTrend[]
): TopicCluster[] {
  if (keywords.length === 0) return [];

  // 키워드 간 동시 출현(co-occurrence) 기반 클러스터링
  const cooccurrence = new Map<string, Map<string, number>>();
  const kwSet = new Set(keywords.map((k) => k.keyword));

  shorts.forEach((v) => {
    const titleLower = v.title.toLowerCase();
    const present = keywords.filter((kw) => titleLower.includes(kw.keyword));

    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const a = present[i].keyword, b = present[j].keyword;
        if (!cooccurrence.has(a)) cooccurrence.set(a, new Map());
        if (!cooccurrence.has(b)) cooccurrence.set(b, new Map());
        cooccurrence.get(a)!.set(b, (cooccurrence.get(a)!.get(b) || 0) + 1);
        cooccurrence.get(b)!.set(a, (cooccurrence.get(b)!.get(a) || 0) + 1);
      }
    }
  });

  // 그리디 클러스터링: 가장 높은 점수의 키워드부터 시작, 동시 출현이 많은 키워드를 그룹에 추가
  const used = new Set<string>();
  const clusters: TopicCluster[] = [];

  const sortedKw = [...keywords].sort((a, b) => b.avgScore * b.count - a.avgScore * a.count);

  for (const kw of sortedKw) {
    if (used.has(kw.keyword)) continue;
    used.add(kw.keyword);

    const cluster: string[] = [kw.keyword];
    const related = cooccurrence.get(kw.keyword);

    if (related) {
      const sorted = Array.from(related.entries())
        .filter(([k]) => !used.has(k) && kwSet.has(k))
        .sort((a, b) => b[1] - a[1]);

      for (const [relatedKw] of sorted.slice(0, 3)) {
        cluster.push(relatedKw);
        used.add(relatedKw);
      }
    }

    const clusterKws = keywords.filter((k) => cluster.includes(k.keyword));
    const totalCount = clusterKws.reduce((s, k) => s + k.count, 0);
    const avgScore = Math.round(
      clusterKws.reduce((s, k) => s + k.avgScore * k.count, 0) / totalCount
    );

    clusters.push({
      name: kw.keyword,
      keywords: cluster,
      totalCount,
      avgScore,
      topExample: kw.examples[0] || '',
    });

    if (clusters.length >= 8) break;
  }

  return clusters;
}

// ==========================================
// 크로스 리전 트렌드 감지 (v2 — 바이그램 지원)
// ==========================================
export interface CrossRegionTrend {
  keyword: string;
  regions: string[];
  totalCount: number;
  avgScore: number;
}

export function detectCrossRegionTrends(
  allRegionShorts: Record<string, ShortVideo[]>
): CrossRegionTrend[] {
  const keywordRegions = new Map<string, { regions: Set<string>; count: number; scores: number[] }>();

  Object.entries(allRegionShorts).forEach(([region, shorts]) => {
    const regionKeywords = new Set<string>();
    shorts.forEach((v) => {
      const { unigrams, bigrams } = tokenizeTitle(v.title);

      // 바이그램 우선 등록
      bigrams.forEach((bg) => {
        if (!regionKeywords.has(bg)) {
          regionKeywords.add(bg);
          const existing = keywordRegions.get(bg) || { regions: new Set(), count: 0, scores: [] };
          existing.regions.add(region);
          existing.count++;
          existing.scores.push(v.viralityScore);
          keywordRegions.set(bg, existing);
        }
      });

      unigrams.forEach((word) => {
        if (!regionKeywords.has(word)) {
          regionKeywords.add(word);
          const existing = keywordRegions.get(word) || { regions: new Set(), count: 0, scores: [] };
          existing.regions.add(region);
          existing.count++;
          existing.scores.push(v.viralityScore);
          keywordRegions.set(word, existing);
        }
      });
    });
  });

  return Array.from(keywordRegions.entries())
    .filter(([, data]) => data.regions.size >= 2)
    .map(([keyword, data]) => ({
      keyword,
      regions: Array.from(data.regions),
      totalCount: data.count,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
    }))
    .sort((a, b) => {
      // 바이그램 우선 + 지역수 × 점수
      const bigramA = a.keyword.includes(' ') ? 1.5 : 1;
      const bigramB = b.keyword.includes(' ') ? 1.5 : 1;
      return (b.regions.length * b.avgScore * bigramB) - (a.regions.length * a.avgScore * bigramA);
    })
    .slice(0, 10);
}

// ==========================================
// 고성과 제목 구조 분석
// ==========================================
interface TitleStructure {
  type: string;
  example: string;
  score: number;
}

function extractTitleStructures(shorts: ShortVideo[]): TitleStructure[] {
  const top = shorts
    .filter((v) => v.viralityScore >= 40)
    .sort((a, b) => b.viralityScore - a.viralityScore)
    .slice(0, 20);

  const structures: TitleStructure[] = [];

  top.forEach((v) => {
    const title = v.title;

    if (/\bvs\.?\b/i.test(title)) {
      structures.push({ type: '비교형', example: title, score: v.viralityScore });
    }
    if (/^(why|왜|how|어떻게|what|did you know)/i.test(title)) {
      structures.push({ type: '질문형', example: title, score: v.viralityScore });
    }
    if (/\d+/.test(title) && /top|best|worst|ranking|things/i.test(title)) {
      structures.push({ type: '숫자 리스트형', example: title, score: v.viralityScore });
    }
    if (/—|:|\|/.test(title)) {
      structures.push({ type: '이중 구조형', example: title, score: v.viralityScore });
    }
  });

  return structures;
}

// ==========================================
// 콘텐츠 아이디어 생성 (v3 — 데이터 기반)
//
// 개선 (v2 → v3):
// - 랜덤 → 성과 기반 선택: 가장 높은 점수의 훅×키워드 조합 우선
// - 토픽 클러스터 기반 아이디어 (관련 주제 결합)
// - 크로스 리전 바이그램 트렌드 활용
// - AskAnything 스타일 최적화 (비교형, 질문형 우선)
// - 아이디어별 예상 점수 추정
// ==========================================
export function generateContentIdeas(
  shorts: ShortVideo[],
  hookPatterns: HookPattern[],
  keywords: KeywordTrend[],
  allRegionShorts?: Record<string, ShortVideo[]>
): ContentIdea[] {
  const ideas: ContentIdea[] = [];

  // === 소스 1: 훅 패턴 × 키워드 (성과 기반 매칭) ===
  // AskAnything 스타일에 적합한 훅 패턴 우선
  const qaPatterns = ['A vs B', '왜 ~?', '어떻게 ~?', '무엇이 ~?', 'TOP/랭킹', '알고 계셨나요?'];
  const sortedPatterns = [...hookPatterns].sort((a, b) => {
    const aQA = qaPatterns.includes(a.pattern) ? 1.5 : 1;
    const bQA = qaPatterns.includes(b.pattern) ? 1.5 : 1;
    return (b.avgScore * bQA) - (a.avgScore * aQA);
  }).slice(0, 6);

  const topKeywords = keywords.slice(0, 12);

  const hookTemplates: Record<string, string[]> = {
    '왜 ~?': ['왜 {keyword}이(가) 인기일까?', '왜 아무도 {keyword}을(를) 모를까?', '{keyword} — 왜 이게 중요할까?'],
    '어떻게 ~?': ['{keyword} 어떻게 작동할까?', '{keyword} 쉽게 이해하기', '{keyword} — 3분 만에 이해하기'],
    'A vs B': ['{keyword} vs 일반인의 생각', '{keyword} 진짜 vs 가짜', '{keyword} — 어느 쪽이 더 나을까?'],
    '알고 계셨나요?': ['{keyword}에 대해 몰랐던 5가지', '{keyword}의 숨겨진 비밀', '{keyword} — 99%가 모르는 사실'],
    'TOP/랭킹': ['역대 최고의 {keyword} TOP 5', '{keyword} 랭킹 — 1위는?', '{keyword} — 최악부터 최고까지'],
    '비밀/진실': ['{keyword}의 진실 — 아무도 모르는', '{keyword} 비하인드 스토리'],
    '충격/대박': ['{keyword} 결과가 충격적...', '{keyword} 실제로 해봤더니 대박'],
    '질문형': ['{keyword} 정말 효과 있을까?', '{keyword} 해도 될까?'],
    '꿀팁/핵': ['{keyword} 꿀팁 3가지', '{keyword} 이것만 알면 된다'],
    '챌린지': ['{keyword} 챌린지 해봤습니다', '{keyword} 24시간 도전'],
    '무엇이 ~?': ['{keyword} 뭐가 다를까?', '{keyword}의 정체는?'],
    '금지/경고': ['{keyword} 절대 하지 마세요', '{keyword} 이것만은 피하세요'],
    '실험/테스트': ['{keyword} 직접 테스트해봤습니다', '{keyword} 실험 결과는?'],
    '반전': ['{keyword}의 반전 결과...', '{keyword} 예상 밖 결과'],
    '$1 vs $1000': ['저가 vs 고가 {keyword} 비교', '{keyword} 가성비 테스트'],
  };

  // 성과 기반 매칭: 높은 점수 패턴 × 높은 점수 키워드 우선
  const patternKwPairs: { pattern: HookPattern; kw: KeywordTrend; score: number }[] = [];
  sortedPatterns.forEach((pattern) => {
    topKeywords.forEach((kw) => {
      const isQA = qaPatterns.includes(pattern.pattern);
      const combinedScore = (pattern.avgScore + kw.avgScore) / 2 * (isQA ? 1.3 : 1);
      patternKwPairs.push({ pattern, kw, score: combinedScore });
    });
  });

  patternKwPairs
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .forEach(({ pattern, kw }) => {
      const templates = hookTemplates[pattern.pattern] || [`{keyword} — ${pattern.description}`];
      // 가장 점수 높은 템플릿 선택 (첫 번째 = 가장 검증된 구조)
      const template = templates[0];
      ideas.push({
        hook: template.replace('{keyword}', kw.keyword),
        topic: kw.keyword,
        style: pattern.pattern,
        reason: `"${pattern.pattern}" 평균 ${pattern.avgScore}점 · "${kw.keyword}" ${kw.count}회 등장 (평균 ${kw.avgScore}점)`,
      });
    });

  // === 소스 2: 고성과 제목 구조 변형 ===
  const structures = extractTitleStructures(shorts);
  const usedTopics = new Set(ideas.map((i) => i.topic));
  const unusedKeywords = topKeywords.filter((kw) => !usedTopics.has(kw.keyword));

  structures.slice(0, 3).forEach((s) => {
    const kw = unusedKeywords.shift() || topKeywords[0];
    if (!kw) return;
    ideas.push({
      hook: `[${s.type}] ${kw.keyword} — "${s.example}" 스타일`,
      topic: kw.keyword,
      style: s.type,
      reason: `바이럴 ${s.score}점 영상의 "${s.type}" 구조 차용`,
    });
  });

  // === 소스 3: 크로스 리전 트렌드 (바이그램 우선) ===
  if (allRegionShorts) {
    const crossTrends = detectCrossRegionTrends(allRegionShorts);
    crossTrends
      .filter((t) => !usedTopics.has(t.keyword))
      .slice(0, 4)
      .forEach((trend) => {
        const isBigram = trend.keyword.includes(' ');
        ideas.push({
          hook: `${trend.keyword} — ${trend.regions.length}개국 동시 트렌딩${isBigram ? ' (구체적 주제)' : ''}`,
          topic: trend.keyword,
          style: '글로벌 트렌드',
          reason: `${trend.regions.join(', ')}에서 동시 트렌딩 · 평균 ${trend.avgScore}점`,
        });
      });
  }

  // 중복 제거 후 상위 15개
  const seen = new Set<string>();
  return ideas.filter((idea) => {
    const key = idea.topic + idea.style;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 15);
}
