from __future__ import annotations
import sqlite3
from pathlib import Path


class MetricsDB:
    def __init__(self, db_path: str = "data/metrics.db") -> None:
        Path("data").mkdir(exist_ok=True)
        self.conn = sqlite3.connect(db_path)
        self._init_tables()

    def _init_tables(self) -> None:
        self.conn.execute("""
        CREATE TABLE IF NOT EXISTS video_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            -- 채널 식별
            channel_name TEXT NOT NULL,
            video_id TEXT NOT NULL,
            language TEXT,

            -- 콘텐츠 메타
            title TEXT,
            topic_id TEXT,
            title_variant TEXT,
            thumbnail_variant TEXT,
            format_type TEXT DEFAULT 'shorts',
            duration_seconds INTEGER,

            -- 분석용 플래그
            is_question_title INTEGER DEFAULT 0,
            has_number_in_title INTEGER DEFAULT 0,
            upload_hour INTEGER,
            manual_label TEXT,

            -- 타임스탬프
            published_at TEXT,
            collected_at TEXT DEFAULT CURRENT_TIMESTAMP,

            -- 성과 지표
            views INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            comments INTEGER DEFAULT 0,
            average_view_duration REAL DEFAULT 0,
            average_view_percentage REAL DEFAULT 0,

            UNIQUE(channel_name, video_id, collected_at)
        )
        """)
        self.conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_channel ON video_metrics(channel_name)
        """)
        self.conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_topic ON video_metrics(topic_id)
        """)
        self.conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_format ON video_metrics(format_type)
        """)
        self.conn.commit()

    def insert_video_metric(self, row: dict) -> None:
        self.conn.execute("""
        INSERT OR REPLACE INTO video_metrics (
            channel_name, video_id, language,
            title, topic_id, title_variant, thumbnail_variant,
            format_type, duration_seconds,
            is_question_title, has_number_in_title, upload_hour, manual_label,
            published_at,
            views, likes, comments,
            average_view_duration, average_view_percentage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row["channel_name"],
            row["video_id"],
            row.get("language"),
            row.get("title"),
            row.get("topic_id"),
            row.get("title_variant"),
            row.get("thumbnail_variant"),
            row.get("format_type", "shorts"),
            row.get("duration_seconds"),
            row.get("is_question_title", 0),
            row.get("has_number_in_title", 0),
            row.get("upload_hour"),
            row.get("manual_label"),
            row.get("published_at"),
            row.get("views", 0),
            row.get("likes", 0),
            row.get("comments", 0),
            row.get("average_view_duration", 0),
            row.get("average_view_percentage", 0),
        ))
        self.conn.commit()
