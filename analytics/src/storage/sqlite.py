from __future__ import annotations
import sqlite3
from pathlib import Path


class MetricsDB:
    def __init__(self, db_path: str = "data/metrics.db") -> None:
        Path("data").mkdir(exist_ok=True)
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_tables()

    def _init_tables(self) -> None:
        self.conn.execute("""
        CREATE TABLE IF NOT EXISTS video_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_name TEXT NOT NULL,
            video_id TEXT NOT NULL,
            title TEXT,
            published_at TEXT,
            views INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            comments INTEGER DEFAULT 0,
            average_view_duration REAL DEFAULT 0,
            average_view_percentage REAL DEFAULT 0,
            collected_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """)

        self.conn.execute("""
        CREATE TABLE IF NOT EXISTS video_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_name TEXT NOT NULL,
            video_id TEXT NOT NULL UNIQUE,
            topic_id TEXT,
            title_variant TEXT,
            thumbnail_variant TEXT,
            format_type TEXT,
            language TEXT,
            manual_label TEXT,
            notes TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """)

        self.conn.commit()

    def insert_video_metric(self, row: dict) -> None:
        self.conn.execute("""
        INSERT INTO video_metrics (
            channel_name, video_id, title, published_at,
            views, likes, comments,
            average_view_duration, average_view_percentage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row["channel_name"],
            row["video_id"],
            row.get("title"),
            row.get("published_at"),
            row.get("views", 0),
            row.get("likes", 0),
            row.get("comments", 0),
            row.get("average_view_duration", 0),
            row.get("average_view_percentage", 0),
        ))
        self.conn.commit()

    def upsert_video_metadata(self, row: dict) -> None:
        self.conn.execute("""
        INSERT INTO video_metadata (
            channel_name, video_id, topic_id, title_variant, thumbnail_variant,
            format_type, language, manual_label, notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(video_id) DO UPDATE SET
            channel_name=excluded.channel_name,
            topic_id=excluded.topic_id,
            title_variant=excluded.title_variant,
            thumbnail_variant=excluded.thumbnail_variant,
            format_type=excluded.format_type,
            language=excluded.language,
            manual_label=excluded.manual_label,
            notes=excluded.notes,
            updated_at=CURRENT_TIMESTAMP
        """, (
            row["channel_name"],
            row["video_id"],
            row.get("topic_id"),
            row.get("title_variant"),
            row.get("thumbnail_variant"),
            row.get("format_type"),
            row.get("language"),
            row.get("manual_label"),
            row.get("notes"),
        ))
        self.conn.commit()

    def get_video_metadata(self, video_id: str) -> dict | None:
        cur = self.conn.execute("""
            SELECT channel_name, video_id, topic_id, title_variant, thumbnail_variant,
                   format_type, language, manual_label, notes, updated_at
            FROM video_metadata
            WHERE video_id = ?
        """, (video_id,))
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)

    def merge_video_row(self, metric_row: dict) -> dict:
        meta_row = self.get_video_metadata(metric_row["video_id"]) or {}

        return {
            "channel_name": metric_row["channel_name"],
            "video_id": metric_row["video_id"],
            "title": metric_row.get("title"),
            "published_at": metric_row.get("published_at"),
            "views": metric_row.get("views", 0),
            "likes": metric_row.get("likes", 0),
            "comments": metric_row.get("comments", 0),
            "average_view_duration": metric_row.get("average_view_duration", 0),
            "average_view_percentage": metric_row.get("average_view_percentage", 0),
            "topic_id": meta_row.get("topic_id"),
            "title_variant": meta_row.get("title_variant"),
            "thumbnail_variant": meta_row.get("thumbnail_variant"),
            "format_type": meta_row.get("format_type"),
            "language": meta_row.get("language"),
            "manual_label": meta_row.get("manual_label"),
            "notes": meta_row.get("notes"),
        }

    def list_merged_videos(self) -> list[dict]:
        cur = self.conn.execute("""
            SELECT
                vm.channel_name,
                vm.video_id,
                vm.title,
                vm.published_at,
                vm.views,
                vm.likes,
                vm.comments,
                vm.average_view_duration,
                vm.average_view_percentage,
                md.topic_id,
                md.title_variant,
                md.thumbnail_variant,
                md.format_type,
                md.language,
                md.manual_label,
                md.notes
            FROM video_metrics vm
            LEFT JOIN video_metadata md
              ON vm.video_id = md.video_id
            ORDER BY vm.collected_at DESC
        """)
        return [dict(row) for row in cur.fetchall()]
