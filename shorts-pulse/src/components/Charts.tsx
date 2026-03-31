'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { ShortVideo } from '@/types';
import { CATEGORY_MAP } from '@/lib/constants';
import { formatNumber } from '@/lib/utils';

Chart.register(...registerables);

interface ChartsProps {
  shorts: ShortVideo[];
}

const COLORS = {
  fire: '#FF2D55', ocean: '#0071E3', sunset: '#FF9500',
  green: '#34C759', purple: '#AF52DE', yellow: '#FFCC00',
  pink: '#FF375F', teal: '#5AC8FA', indigo: '#5856D6',
};

function useChart(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  chartRef: React.MutableRefObject<Chart | null>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  deps: unknown[]
) {
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, config);
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function Charts({ shorts }: ChartsProps) {
  const viralityRef = useRef<HTMLCanvasElement>(null);
  const viralityChartRef = useRef<Chart | null>(null);
  const categoryRef = useRef<HTMLCanvasElement>(null);
  const categoryChartRef = useRef<Chart | null>(null);
  const scatterRef = useRef<HTMLCanvasElement>(null);
  const scatterChartRef = useRef<Chart | null>(null);

  const textColor = '#A1A1A6';
  const gridColor = 'rgba(255,255,255,0.06)';

  // Virality Distribution
  const bins = [0, 0, 0, 0, 0];
  shorts.forEach((v) => {
    const idx = Math.min(4, Math.max(0, Math.floor(v.viralityScore / 20)));
    bins[idx]++;
  });

  useChart(viralityRef, viralityChartRef, {
    type: 'bar',
    data: {
      labels: ['0-20', '20-40', '40-60', '60-80', '80-100'],
      datasets: [{
        data: bins,
        backgroundColor: [COLORS.purple, COLORS.ocean, COLORS.teal, COLORS.sunset, COLORS.fire],
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 } },
      },
    },
  }, [shorts]);

  // Category Breakdown
  const catCounts: Record<string, number> = {};
  shorts.forEach((v) => {
    const cat = CATEGORY_MAP[v.categoryId] || '기타';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const colorPalette = Object.values(COLORS);

  useChart(categoryRef, categoryChartRef, {
    type: 'doughnut',
    data: {
      labels: sortedCats.map((s) => s[0]),
      datasets: [{
        data: sortedCats.map((s) => s[1]),
        backgroundColor: sortedCats.map((_, i) => colorPalette[i % colorPalette.length]),
        borderWidth: 0,
        spacing: 2,
      }],
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: { color: textColor, usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } },
        },
      },
    },
  }, [shorts]);

  // Scatter: Views vs Engagement
  const scatterData = shorts.map((v) => ({
    x: v.viewCount,
    y: v.engagementRate,
    label: v.title.substring(0, 30),
    score: v.viralityScore,
  }));

  useChart(scatterRef, scatterChartRef, {
    type: 'scatter',
    data: {
      datasets: [{
        data: scatterData,
        backgroundColor: scatterData.map((d) => {
          if (d.score >= 85) return 'rgba(255,45,85,0.6)';
          if (d.score >= 70) return 'rgba(255,149,0,0.6)';
          if (d.score >= 50) return 'rgba(0,113,227,0.6)';
          return 'rgba(142,142,147,0.4)';
        }),
        pointRadius: scatterData.map((d) => Math.max(4, d.score / 10)),
        pointHoverRadius: 10,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label: (ctx: any) => {
              const d = ctx.raw;
              return `${d.label}... | 조회수: ${formatNumber(d.x)} | 참여: ${d.y.toFixed(2)}% | 점수: ${d.score}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: '조회수', color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor, callback: (v: unknown) => formatNumber(v as number) },
        },
        y: {
          title: { display: true, text: '참여율 %', color: textColor },
          grid: { color: gridColor },
          ticks: { color: textColor },
        },
      },
    },
  }, [shorts]);

  if (shorts.length === 0) return null;

  return (
    <section className="max-w-[1080px] mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="section-headline">분석</h2>
        <p className="section-subheadline">오늘의 트렌딩 쇼츠 인사이트</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass-card p-6">
          <h3 className="text-[15px] font-semibold text-[#A1A1A6] mb-4">바이럴 점수 분포</h3>
          <canvas ref={viralityRef} />
        </div>
        <div className="glass-card p-6">
          <h3 className="text-[15px] font-semibold text-[#A1A1A6] mb-4">카테고리 비율</h3>
          <canvas ref={categoryRef} />
        </div>
        <div className="glass-card p-6 md:col-span-2">
          <h3 className="text-[15px] font-semibold text-[#A1A1A6] mb-4">조회수 vs 참여율</h3>
          <canvas ref={scatterRef} style={{ maxHeight: 360 }} />
        </div>
      </div>
    </section>
  );
}
