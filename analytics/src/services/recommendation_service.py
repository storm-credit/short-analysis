from __future__ import annotations
import sqlite3
from pathlib import Path


class RecommendationService:
    """DB 기반 간단 추천 규칙 엔진."""

    def __init__(self, db_path: str = "data/metrics.db") -> None:
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    def best_thumbnail_style(self, channel_name: str, limit: int = 5) -> list[dict]:
        """채널별 썸네일 스타일 성과 비교."""
        rows = self.conn.execute("""
        SELECT
            tc.style_label,
            COUNT(*) AS uses,
            AVG(vm.views) AS avg_views,
            AVG(vm.average_view_percentage) AS avg_avr,
            AVG(vm.likes) AS avg_likes
        FROM video_metrics vm
        JOIN thumbnail_candidates tc
            ON vm.topic_id = tc.topic_id
            AND vm.channel_name = tc.channel_name
            AND vm.thumbnail_variant = tc.variant_code
            AND tc.selected = 1
        WHERE vm.channel_name = ?
            AND tc.style_label IS NOT NULL
        GROUP BY tc.style_label
        HAVING uses >= 2
        ORDER BY avg_avr DESC
        LIMIT ?
        """, (channel_name, limit)).fetchall()
        return [dict(r) for r in rows]

    def best_title_style(self, channel_name: str) -> dict:
        """질문형 vs 일반 제목 성과 비교."""
        rows = self.conn.execute("""
        SELECT
            is_question_title,
            COUNT(*) AS count,
            AVG(views) AS avg_views,
            AVG(average_view_percentage) AS avg_avr
        FROM video_metrics
        WHERE channel_name = ?
        GROUP BY is_question_title
        """, (channel_name,)).fetchall()

        result = {}
        for r in rows:
            key = "question" if r["is_question_title"] else "statement"
            result[key] = {
                "count": r["count"],
                "avg_views": round(r["avg_views"] or 0, 1),
                "avg_avr": round(r["avg_avr"] or 0, 1),
            }
        return result

    def best_upload_hour(self, channel_name: str) -> list[dict]:
        """업로드 시간대별 성과."""
        rows = self.conn.execute("""
        SELECT
            upload_hour,
            COUNT(*) AS count,
            AVG(views) AS avg_views,
            AVG(average_view_percentage) AS avg_avr
        FROM video_metrics
        WHERE channel_name = ? AND upload_hour IS NOT NULL
        GROUP BY upload_hour
        HAVING count >= 2
        ORDER BY avg_avr DESC
        LIMIT 5
        """, (channel_name,)).fetchall()
        return [dict(r) for r in rows]

    def best_topic_category(self, channel_name: str) -> list[dict]:
        """주제 카테고리별 성과."""
        rows = self.conn.execute("""
        SELECT
            tr.topic_category,
            COUNT(*) AS count,
            AVG(vm.views) AS avg_views,
            AVG(vm.average_view_percentage) AS avg_avr,
            AVG(vm.likes) AS avg_likes
        FROM video_metrics vm
        JOIN topic_runs tr ON vm.topic_id = tr.topic_id
        WHERE vm.channel_name = ?
            AND tr.topic_category IS NOT NULL
        GROUP BY tr.topic_category
        HAVING count >= 2
        ORDER BY avg_avr DESC
        """, (channel_name,)).fetchall()
        return [dict(r) for r in rows]

    def channel_summary(self, channel_name: str) -> dict:
        """채널 종합 요약."""
        return {
            "channel": channel_name,
            "thumbnail_styles": self.best_thumbnail_style(channel_name),
            "title_style": self.best_title_style(channel_name),
            "upload_hours": self.best_upload_hour(channel_name),
            "topic_categories": self.best_topic_category(channel_name),
        }

    def all_channels_summary(self) -> list[dict]:
        """전체 채널 요약."""
        channels = self.conn.execute(
            "SELECT DISTINCT channel_name FROM video_metrics"
        ).fetchall()
        return [self.channel_summary(r["channel_name"]) for r in channels]
