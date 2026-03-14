import { ShortVideo, TierInfo, CategoryBenchmark, ScoreBreakdown, RawMetrics } from '@/types';
import { SCORE_WEIGHTS } from './constants';
import { hoursAge } from './utils';

export function calculateViralityScore(
  video: ShortVideo,
  catBench?: CategoryBenchmark
): { total: number; breakdown: ScoreBreakdown; raw: RawMetrics } {
  const h = hoursAge(video.publishedAt);
  const w = SCORE_WEIGHTS;

  const vph = h < 0.5 ? video.viewCount : video.viewCount / h;
  const catAvgVPH = catBench?.avgVPH || 5000;
  const velocityScore = Math.min(100, (vph / catAvgVPH) * 50);

  const likeRatio = video.viewCount > 0 ? (video.likeCount / video.viewCount) * 100 : 0;
  const engagementScore = Math.min(100, likeRatio * 20);

  const commentRatio = video.viewCount > 0 ? (video.commentCount / video.viewCount) * 100 : 0;
  const interactionScore = Math.min(100, commentRatio * 200);

  const viralCoeff = video.subscriberCount > 0 ? video.viewCount / video.subscriberCount : 1;
  const viralScore = Math.min(100, viralCoeff * 10);

  const recencyScore = Math.max(0, 100 * Math.exp(-h / 48));

  const catMedian = catBench?.medianViews || 100000;
  const catScore = Math.min(100, (video.viewCount / catMedian) * 25);

  const total = Math.round(
    velocityScore * w.velocity +
    engagementScore * w.engagement +
    interactionScore * w.interaction +
    viralScore * w.viralCoefficient +
    recencyScore * w.recency +
    catScore * w.categoryOutperformance
  );

  return {
    total: Math.min(100, total),
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
      hoursAge: Math.round(h),
    },
  };
}

export function buildCategoryBenchmarks(videos: ShortVideo[]): Record<string, CategoryBenchmark> {
  const cats: Record<string, { views: number[]; vphs: number[] }> = {};
  videos.forEach((v) => {
    const c = v.categoryId || 'other';
    if (!cats[c]) cats[c] = { views: [], vphs: [] };
    const h = hoursAge(v.publishedAt);
    cats[c].views.push(v.viewCount);
    cats[c].vphs.push(h < 0.5 ? v.viewCount : v.viewCount / h);
  });

  const benchmarks: Record<string, CategoryBenchmark> = {};
  Object.entries(cats).forEach(([cat, d]) => {
    const sorted = [...d.views].sort((a, b) => a - b);
    benchmarks[cat] = {
      medianViews: sorted[Math.floor(sorted.length / 2)] || 0,
      avgVPH: d.vphs.reduce((a, b) => a + b, 0) / d.vphs.length || 1,
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
