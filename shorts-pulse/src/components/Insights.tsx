'use client';

import { useMemo } from 'react';
import { ShortVideo } from '@/types';
import { formatNumber } from '@/lib/utils';
import {
  extractKeywords,
  analyzeHookPatterns,
  calculateBenchmark,
  generateContentIdeas,
  analyzeTimingPatterns,
  clusterTopics,
  BenchmarkStats,
} from '@/lib/insights';
import { TrendingUp, Hash, Target, Lightbulb, BarChart3, MessageSquare, Clock, Layers } from 'lucide-react';

interface InsightsProps {
  shorts: ShortVideo[];
  allRegionShorts: Record<string, ShortVideo[]>;
}

export default function Insights({ shorts, allRegionShorts }: InsightsProps) {
  const allShorts = useMemo(
    () => Object.values(allRegionShorts).flat(),
    [allRegionShorts]
  );

  const keywords = useMemo(() => extractKeywords(allShorts), [allShorts]);
  const hookPatterns = useMemo(() => analyzeHookPatterns(allShorts), [allShorts]);
  const benchmark = useMemo(() => calculateBenchmark(shorts), [shorts]);
  const globalBenchmark = useMemo(() => calculateBenchmark(allShorts), [allShorts]);
  const timing = useMemo(() => analyzeTimingPatterns(allShorts), [allShorts]);
  const clusters = useMemo(() => clusterTopics(allShorts, keywords), [allShorts, keywords]);
  const ideas = useMemo(
    () => generateContentIdeas(allShorts, hookPatterns, keywords, allRegionShorts),
    [allShorts, hookPatterns, keywords, allRegionShorts]
  );

  if (allShorts.length === 0) {
    return (
      <section className="max-w-[1080px] mx-auto px-4">
        <div className="text-center py-20 text-[#86868B]">
          <Lightbulb size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-[17px] font-medium">데이터가 없습니다</p>
          <p className="text-sm mt-2">트렌딩 탭에서 데이터를 먼저 로드하세요</p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1080px] mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="section-headline">인사이트</h2>
        <p className="section-subheadline">
          TF-IDF 기반 키워드 분석 · 성과 가중 콘텐츠 아이디어
        </p>
      </div>

      {/* 벤치마크 비교 */}
      <BenchmarkSection current={benchmark} global={globalBenchmark} />

      {/* 최적 타이밍/길이 분석 */}
      <div className="mt-10">
        <h3 className="text-[18px] font-bold mb-5 flex items-center gap-2">
          <Clock size={20} className="text-[#AF52DE]" />
          최적 타이밍 & 길이
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {timing.durationBuckets.map((bucket) => (
            <div key={bucket.label} className="glass-card px-4 py-3">
              <div className="text-[11px] text-[#86868B] font-medium">{bucket.label}</div>
              <div className="text-[18px] font-bold mt-1">{bucket.count}개</div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-[12px] font-bold"
                  style={{
                    color: bucket.avgScore >= 70 ? '#FF2D55'
                      : bucket.avgScore >= 50 ? '#FF9500'
                      : bucket.avgScore >= 30 ? '#0071E3'
                      : '#86868B',
                  }}
                >
                  {bucket.avgScore}점
                </span>
                <span className="text-[10px] text-[#86868B]">
                  {formatNumber(bucket.avgViews)} 조회
                </span>
              </div>
            </div>
          ))}
        </div>
        {timing.peakHours.length > 0 && (
          <div className="mt-3 glass-card px-4 py-3">
            <div className="text-[11px] text-[#86868B] font-medium mb-2">고성과 업로드 시간 (UTC)</div>
            <div className="flex flex-wrap gap-2">
              {timing.peakHours.map((ph) => (
                <span
                  key={ph.hour}
                  className="px-3 py-1 rounded-full text-[12px] font-bold"
                  style={{
                    background: ph.avgScore >= 60 ? 'rgba(255,45,85,0.1)' : 'rgba(0,113,227,0.1)',
                    color: ph.avgScore >= 60 ? '#FF2D55' : '#0071E3',
                  }}
                >
                  {ph.hour.toString().padStart(2, '0')}:00 ({ph.avgScore}점 · {ph.count}개)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 토픽 클러스터 */}
      {clusters.length > 0 && (
        <div className="mt-10">
          <h3 className="text-[18px] font-bold mb-5 flex items-center gap-2">
            <Layers size={20} className="text-[#5856D6]" />
            토픽 클러스터
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {clusters.map((cluster) => (
              <div key={cluster.name} className="glass-card px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[14px] font-bold">{cluster.name}</span>
                  <span
                    className="text-[12px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      color: cluster.avgScore >= 70 ? '#FF2D55' : cluster.avgScore >= 50 ? '#FF9500' : '#0071E3',
                      background: cluster.avgScore >= 70 ? 'rgba(255,45,85,0.1)' : cluster.avgScore >= 50 ? 'rgba(255,149,0,0.1)' : 'rgba(0,113,227,0.1)',
                    }}
                  >
                    {cluster.avgScore}점
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {cluster.keywords.map((kw) => (
                    <span key={kw} className="px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded text-[11px]">
                      {kw}
                    </span>
                  ))}
                </div>
                <div className="text-[10px] text-[#A1A1A6] truncate">
                  {cluster.topExample}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 트렌딩 키워드 (TF-IDF) */}
      <div className="mt-10">
        <h3 className="text-[18px] font-bold mb-2 flex items-center gap-2">
          <Hash size={20} className="text-[#0071E3]" />
          트렌딩 키워드
        </h3>
        <p className="text-[12px] text-[#86868B] mb-5">TF-IDF 가중 · 바이럴 성과 기반 랭킹</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {keywords.map((kw, i) => (
            <div key={kw.keyword} className="glass-card px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-[#86868B]">#{i + 1}</span>
                <span className="text-[14px] font-bold truncate">{kw.keyword}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#86868B]">
                <span>{kw.count}회</span>
                <span
                  className="font-bold"
                  style={{ color: kw.avgScore >= 70 ? '#FF2D55' : kw.avgScore >= 50 ? '#FF9500' : '#0071E3' }}
                >
                  평균 {kw.avgScore}점
                </span>
              </div>
              <div className="mt-1.5 text-[10px] text-[#A1A1A6] truncate">
                {kw.examples[0]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 훅 패턴 분석 */}
      <div className="mt-10">
        <h3 className="text-[18px] font-bold mb-5 flex items-center gap-2">
          <Target size={20} className="text-[#FF2D55]" />
          바이럴 훅 패턴
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {hookPatterns.slice(0, 8).map((hp) => (
            <div key={hp.pattern} className="glass-card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[15px] font-bold">{hp.pattern}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[#86868B]">{hp.count}개</span>
                  <span
                    className="text-[13px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      color: hp.avgScore >= 70 ? '#FF2D55' : hp.avgScore >= 50 ? '#FF9500' : '#0071E3',
                      background: hp.avgScore >= 70 ? 'rgba(255,45,85,0.1)' : hp.avgScore >= 50 ? 'rgba(255,149,0,0.1)' : 'rgba(0,113,227,0.1)',
                    }}
                  >
                    {hp.avgScore}점
                  </span>
                </div>
              </div>
              <p className="text-[12px] text-[#86868B] mb-3">{hp.description}</p>
              <div className="space-y-1.5">
                {hp.examples.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span
                      className="font-bold min-w-[28px] text-center"
                      style={{ color: ex.score >= 70 ? '#FF2D55' : ex.score >= 50 ? '#FF9500' : '#8E8E93' }}
                    >
                      {ex.score}
                    </span>
                    <span className="text-[#6E6E73] truncate">{ex.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 콘텐츠 아이디어 */}
      <div className="mt-10">
        <h3 className="text-[18px] font-bold mb-2 flex items-center gap-2">
          <Lightbulb size={20} className="text-[#FF9500]" />
          콘텐츠 아이디어
        </h3>
        <p className="text-[12px] text-[#86868B] mb-5">성과 가중 패턴 매칭 · AskAnything 스타일 최적화</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((idea, i) => (
            <div key={i} className="glass-card p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF9500]/10 text-[#FF9500]">
                  {idea.style}
                </span>
              </div>
              <p className="text-[14px] font-bold leading-snug mb-2">{idea.hook}</p>
              <p className="text-[11px] text-[#86868B] mt-auto">{idea.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BenchmarkSection({ current, global }: { current: BenchmarkStats; global: BenchmarkStats }) {
  const metrics = [
    { label: '평균 조회수', current: current.avgViews, global: global.avgViews, format: formatNumber },
    { label: '평균 바이럴 점수', current: current.avgViralityScore, global: global.avgViralityScore, format: (n: number) => n.toString() },
    { label: '평균 참여율', current: current.avgEngagement, global: global.avgEngagement, format: (n: number) => n.toFixed(2) + '%' },
    { label: '시간당 조회', current: current.avgVPH, global: global.avgVPH, format: formatNumber },
    { label: '평균 좋아요', current: current.avgLikes, global: global.avgLikes, format: formatNumber },
    { label: '평균 댓글', current: current.avgComments, global: global.avgComments, format: formatNumber },
  ];

  return (
    <div>
      <h3 className="text-[18px] font-bold mb-5 flex items-center gap-2">
        <BarChart3 size={20} className="text-[#34C759]" />
        현재 지역 vs 글로벌 벤치마크
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((m) => {
          const diff = global.avgViews > 0 && m.global > 0
            ? ((m.current - m.global) / m.global * 100)
            : 0;
          const isPositive = diff >= 0;
          return (
            <div key={m.label} className="glass-card px-4 py-3">
              <div className="text-[11px] text-[#86868B] font-medium mb-1">{m.label}</div>
              <div className="text-[20px] font-bold tracking-tight">{m.format(m.current)}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] text-[#86868B]">글로벌 {m.format(m.global)}</span>
                {diff !== 0 && (
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: isPositive ? '#34C759' : '#FF3B30' }}
                  >
                    {isPositive ? '+' : ''}{diff.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Q&A 스타일 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <MessageSquare size={18} className="text-[#FF9500] flex-shrink-0" />
          <div>
            <div className="text-[11px] text-[#86868B]">Q&A/비교형 쇼츠</div>
            <div className="text-[16px] font-bold">{global.qaStyleCount}개</div>
          </div>
        </div>
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <TrendingUp size={18} className="text-[#0071E3] flex-shrink-0" />
          <div>
            <div className="text-[11px] text-[#86868B]">Q&A형 평균 점수</div>
            <div className="text-[16px] font-bold">{global.qaStyleAvgScore}점</div>
          </div>
        </div>
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <Target size={18} className="text-[#AF52DE] flex-shrink-0" />
          <div>
            <div className="text-[11px] text-[#86868B]">인기 카테고리</div>
            <div className="text-[16px] font-bold truncate">{global.topCategory}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
