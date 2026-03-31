"""추천 리포트 출력 스크립트.

사용법:
  python -m src.scripts.print_recommendations
  python -m src.scripts.print_recommendations --channel wonderdrop
"""
from __future__ import annotations
import argparse

from src.storage.sqlite import MetricsDB
from src.services.recommendation_service import RecommendationService


def print_section(title: str, rows: list[dict]) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    if not rows:
        print("  (데이터 없음)")
        return
    for i, row in enumerate(rows, 1):
        parts = []
        for k, v in row.items():
            if v is not None:
                if isinstance(v, float):
                    parts.append(f"{k}={v:.1f}")
                else:
                    parts.append(f"{k}={v}")
        print(f"  {i}. {' | '.join(parts)}")


def main():
    parser = argparse.ArgumentParser(description="추천 리포트")
    parser.add_argument("--channel", default=None, help="특정 채널만 (기본: 전체)")
    args = parser.parse_args()

    db = MetricsDB("data/metrics.db")
    rec = RecommendationService(db)

    # 채널 목록
    if args.channel:
        channels = [args.channel]
    else:
        cur = db.conn.execute("SELECT DISTINCT channel_name FROM video_metrics")
        channels = [r["channel_name"] for r in cur.fetchall()]

    if not channels:
        print("[info] DB에 데이터가 없습니다. analyze_recent_videos.py를 먼저 실행하세요.")
        return

    for ch in channels:
        print(f"\n{'#'*60}")
        print(f"  채널: {ch}")
        print(f"{'#'*60}")

        print_section(f"[{ch}] 조회수 TOP 5", rec.top_videos_by_views(ch))
        print_section(f"[{ch}] 평균조회율 TOP 5", rec.top_videos_by_avr(ch))
        print_section(f"[{ch}] 썸네일 variant 성과", rec.thumbnail_variant_performance(ch))
        print_section(f"[{ch}] 제목 variant 성과", rec.title_variant_performance(ch))
        print_section(f"[{ch}] 포맷 타입 성과", rec.format_type_performance(ch))


if __name__ == "__main__":
    main()
