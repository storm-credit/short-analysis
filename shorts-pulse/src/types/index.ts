export interface ShortVideo {
  id: string;
  title: string;
  channelTitle: string;
  channelId: string;
  thumbnail: string;
  publishedAt: string;
  categoryId: string;
  tags: string[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSec: number;
  subscriberCount: number;
  topicTag: string;
  isShort: boolean;
  engagementRate: number;
  viewsPerHour: number;
  viralityScore: number;
  tier: TierInfo | null;
  scoreBreakdown: ScoreBreakdown | null;
  rawMetrics: RawMetrics | null;
}

export interface TierInfo {
  label: string;
  css: string;
  icon: string;
  color: string;
}

export interface ScoreBreakdown {
  velocity: number;
  engagement: number;
  interaction: number;
  viralCoefficient: number;
  recency: number;
  categoryOutperformance: number;
}

export interface RawMetrics {
  viewsPerHour: number;
  likeRatio: string;
  commentRatio: string;
  viralCoeff: string;
  hoursAge: number;
}

export interface RegionInfo {
  code: string;
  name: string;
  flag: string;
  avgCPM: number;
}

export interface CategoryBenchmark {
  medianViews: number;
  avgVPH: number;
  medianVPH: number;
}

export type SortKey = 'viralityScore' | 'viewCount' | 'viewsPerHour' | 'engagementRate';
export type ViewMode = 'grid' | 'list';
export type RegionCode = 'US' | 'GB' | 'AU' | 'CA' | 'KR' | 'NO' | 'DE' | 'CH' | 'JP' | 'FR';
export type TabId = 'trending' | 'analytics' | 'regional' | 'insights' | 'settings';

export interface KeywordTrend {
  keyword: string;
  count: number;
  avgScore: number;
  examples: string[];
}

export interface HookPattern {
  pattern: string;
  description: string;
  count: number;
  avgScore: number;
  examples: { title: string; score: number }[];
}

export interface ContentIdea {
  hook: string;
  topic: string;
  style: string;
  reason: string;
}
