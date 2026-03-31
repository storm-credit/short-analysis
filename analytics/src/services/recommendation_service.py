from __future__ import annotations

from src.storage.sqlite import MetricsDB


class RecommendationService:
    def __init__(self, db: MetricsDB) -> None:
        self.db = db

    def top_videos_by_views(self, channel_name: str, limit: int = 5) -> list[dict]:
        """채널별 상위 조회수 영상."""
        cur = self.db.conn.execute("""
            SELECT vm.title, vm.views, vm.average_view_percentage,
                   md.thumbnail_variant, md.title_variant, md.format_type
            FROM video_metrics vm
            LEFT JOIN video_metadata md ON vm.video_id = md.video_id
            WHERE vm.channel_name = ?
            ORDER BY vm.views DESC
            LIMIT ?
        """, (channel_name, limit))
        return [dict(row) for row in cur.fetchall()]

    def top_videos_by_avr(self, channel_name: str, limit: int = 5) -> list[dict]:
        """채널별 상위 평균조회율 영상."""
        cur = self.db.conn.execute("""
            SELECT vm.title, vm.views, vm.average_view_percentage,
                   md.thumbnail_variant, md.title_variant, md.format_type
            FROM video_metrics vm
            LEFT JOIN video_metadata md ON vm.video_id = md.video_id
            WHERE vm.channel_name = ?
            ORDER BY vm.average_view_percentage DESC
            LIMIT ?
        """, (channel_name, limit))
        return [dict(row) for row in cur.fetchall()]

    def thumbnail_variant_performance(self, channel_name: str) -> list[dict]:
        """썸네일 variant별 평균 성과."""
        cur = self.db.conn.execute("""
            SELECT
                md.thumbnail_variant,
                COUNT(*) AS count,
                AVG(vm.views) AS avg_views,
                AVG(vm.average_view_percentage) AS avg_avr
            FROM video_metrics vm
            JOIN video_metadata md ON vm.video_id = md.video_id
            WHERE vm.channel_name = ?
                AND md.thumbnail_variant IS NOT NULL
            GROUP BY md.thumbnail_variant
            ORDER BY avg_avr DESC
        """, (channel_name,))
        return [dict(row) for row in cur.fetchall()]

    def title_variant_performance(self, channel_name: str) -> list[dict]:
        """제목 variant별 평균 성과."""
        cur = self.db.conn.execute("""
            SELECT
                md.title_variant,
                COUNT(*) AS count,
                AVG(vm.views) AS avg_views,
                AVG(vm.average_view_percentage) AS avg_avr
            FROM video_metrics vm
            JOIN video_metadata md ON vm.video_id = md.video_id
            WHERE vm.channel_name = ?
                AND md.title_variant IS NOT NULL
            GROUP BY md.title_variant
            ORDER BY avg_avr DESC
        """, (channel_name,))
        return [dict(row) for row in cur.fetchall()]

    def format_type_performance(self, channel_name: str) -> list[dict]:
        """포맷 타입별 평균 성과."""
        cur = self.db.conn.execute("""
            SELECT
                md.format_type,
                COUNT(*) AS count,
                AVG(vm.views) AS avg_views,
                AVG(vm.average_view_percentage) AS avg_avr
            FROM video_metrics vm
            JOIN video_metadata md ON vm.video_id = md.video_id
            WHERE vm.channel_name = ?
                AND md.format_type IS NOT NULL
            GROUP BY md.format_type
            ORDER BY avg_avr DESC
        """, (channel_name,))
        return [dict(row) for row in cur.fetchall()]
