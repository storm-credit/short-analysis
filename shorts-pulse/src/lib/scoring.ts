import { ShortVideo, TierInfo, CategoryBenchmark, ScoreBreakdown, RawMetrics } from '@/types';
import { SCORE_WEIGHTS } from './constants';
import { hoursAge } from './utils';

/**
 * Virality Score Algorithm v3
 *
 * 개선사항 (v2 → v3):
 * - VPH 정규화: mean → median 기반 (이상치에 안정적)
 * - 구독자 0 채널: 패널티 → 바이럴 부스트 (구독자 없이 조회수 = 강한 바이럴 신호)
 * - 참여도 가중치: 20% → 25% (Shorts에서 참여도가 더 중요)
 * - 댓글 계수: 75 → 150 (Shorts에서 댓글은 매우 희귀 → 가치 높음)
 * - 최소 경과시간: 0.1h → 0.5h (30분 미만 영상 VPH 과대평가 방지)
 * - Recency 반감기: 48h → 24h (일일 트래킹에 적합)
 * - 소프트 캡: Math.min(100) → 로그 스케일 (상위 영상 간 변별력 유지)
 *
 * Weights (v3):
 *   Velocity (30%)
 *   Engagement Quality (25%)   ← 20→25%
 *   Audience Interaction (10%) ← 15→10% (가중치 engagement으로 이동)
 *   Viral Coefficient (15%)
 *   Recency Boost (10%)
 *   Category Outperformance (10%)
 */
const VELOCITY_MULTIPLIER = 50;
const ENGAGEMENT_MULTIPLIER = 20;
const INTERACTION_MULTIPLIER = 150;   // 75→150 (댓글 희소성 반영)
const VIRAL_COEFF_MULTIPLIER = 10;
const VIRAL_COEFF_NO_SUBS = 80;       // 구독자 0인 채널의 바이럴 부스트 점수
const CATEGORY_MULTIPLIER = 25;
const RECENCY_HALFLIFE_HOURS = 24;    // 48→24 (일일 트래킹에 적합)
const MIN_HOURS_AGE = 0.5;            // 0.1→0.5 (30분 미만 VPH 과대평가 방지)

/**
 * 소프트 캡 — 100을 넘어도 점진적으로 감쇠 (하드 캡 대신 로그 스케일)
 * softCap(50) = 50, softCap(100) = 100, softCap(200) ≈ 130, softCap(500) ≈ 170
 */
function softCap(score: number, cap: number = 100): number {
  if (score <= cap) return score;
  // 100 이상은 로그 스케일로 압축 (상위 변별력 유지)
  return cap + (cap * 0.5) * Math.log2(score / cap);
}

export function calculateViralityScore(
  video: ShortVideo,
  catBench?: CategoryBenchmark
): { total: number; breakdown: ScoreBreakdown; raw: RawMetrics } {
  const rawH = hoursAge(video.publishedAt);
  const h = Math.max(rawH, MIN_HOURS_AGE);
  const w = SCORE_WEIGHTS;

  // Factor 1: View Velocity (30%) — median VPH 기반 정규화
  const vph = video.viewCount / h;
  const catAvgVPH = catBench?.medianVPH || catBench?.avgVPH || 5000;
  const velocityRaw = (vph / catAvgVPH) * VELOCITY_MULTIPLIER;
  const velocityScore = softCap(velocityRaw);

  // Factor 2: Engagement Quality (25%) — 좋아요 비율
  const likeRatio = video.viewCount > 0 ? (video.likeCount / video.viewCount) * 100 : 0;
  const engagementRaw = likeRatio * ENGAGEMENT_MULTIPLIER;
  const engagementScore = softCap(engagementRaw);

  // Factor 3: Audience Interaction (10%) — 댓글 비율 (희소성 반영)
  const commentRatio = video.viewCount > 0 ? (video.commentCount / video.viewCount) * 100 : 0;
  const interactionRaw = commentRatio * INTERACTION_MULTIPLIER;
  const interactionScore = softCap(interactionRaw);

  // Factor 4: Viral Coefficient (15%)
  // 구독자 0 = 바이럴 부스트 (채널 인지도 없이 조회수 = 강한 바이럴 신호)
  let viralCoeff: number;
  let viralScore: number;
  if (video.subscriberCount === 0) {
    viralCoeff = 0;
    viralScore = video.viewCount > 1000 ? VIRAL_COEFF_NO_SUBS : 40;
  } else {
    viralCoeff = video.viewCount / video.subscriberCount;
    viralScore = softCap(viralCoeff * VIRAL_COEFF_MULTIPLIER);
  }

  // Factor 5: Recency Boost (10%) — 24시간 반감기
  const recencyScore = Math.max(0, 100 * Math.exp(-h / RECENCY_HALFLIFE_HOURS));

  // Factor 6: Category Outperformance (10%)
  const catMedian = catBench?.medianViews || 100000;
  const catRaw = (video.viewCount / catMedian) * CATEGORY_MULTIPLIER;
  const catScore = softCap(catRaw);

  // Weighted composite
  const total = Math.round(
    velocityScore * w.velocity +
    engagementScore * w.engagement +
    interactionScore * w.interaction +
    viralScore * w.viralCoefficient +
    recencyScore * w.recency +
    catScore * w.categoryOutperformance
  );

  return {
    total: Math.min(100, Math.max(0, total)),
    breakdown: {
      velocity: Math.round(velocityScore),
      engagement: Math.round(engagementScore),
      interaction: Math.round(interactionScore),
      viralCoefficient: Math.round(viralScore),
      recency: Math.round(recencyScore),
      categoryOutperformance: Math.round(catScore),
    },
    raw: {
      viewsPerHour: Math.round(vph),
      likeRatio: likeRatio.toFixed(2),
      commentRatio: commentRatio.toFixed(3),
      viralCoeff: viralCoeff.toFixed(2),
      hoursAge: Math.round(rawH),
    },
  };
}

export function buildCategoryBenchmarks(videos: ShortVideo[]): Record<string, CategoryBenchmark> {
  const cats: Record<string, { views: number[]; vphs: number[] }> = {};
  videos.forEach((v) => {
    const c = v.categoryId || 'other';
    if (!cats[c]) cats[c] = { views: [], vphs: [] };
    const h = Math.max(hoursAge(v.publishedAt), MIN_HOURS_AGE);
    cats[c].views.push(v.viewCount);
    cats[c].vphs.push(v.viewCount / h);
  });

  const benchmarks: Record<string, CategoryBenchmark> = {};
  Object.entries(cats).forEach(([cat, d]) => {
    const sortedViews = [...d.views].sort((a, b) => a - b);
    const sortedVphs = [...d.vphs].sort((a, b) => a - b);
    const medianIdx = Math.floor((sortedViews.length - 1) / 2);
    const medianVphIdx = Math.floor((sortedVphs.length - 1) / 2);
    benchmarks[cat] = {
      medianViews: sortedViews[medianIdx] || 0,
      avgVPH: d.vphs.length > 0
        ? d.vphs.reduce((a, b) => a + b, 0) / d.vphs.length
        : 1,
      medianVPH: sortedVphs[medianVphIdx] || 1,
    };
  });
  return benchmarks;
}

export function getTier(score: number): TierInfo {
  if (score >= 85) return { label: 'VIRAL', css: 'tier-viral', icon: 'Flame', color: '#FF2D55' };
  if (score >= 70) return { label: 'HOT', css: 'tier-hot', icon: 'Zap', color: '#FF9500' };
  if (score >= 50) return { label: 'RISING', css: 'tier-rising', icon: 'TrendingUp', color: '#0071E3' };
  if (score >= 30) return { label: 'WARM', css: 'tier-warm', icon: 'Leaf', color: '#34C759' };
  return { label: 'STABLE', css: 'tier-stable', icon: 'Minus', color: '#8E8E93' };
}
