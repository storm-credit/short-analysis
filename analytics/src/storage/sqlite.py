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
            channel_name TEXT NOT NULL,
            video_id TEXT NOT NULL,
            topic_id TEXT,
            title TEXT,
            title_variant TEXT,
            thumbnail_variant TEXT,
            format_type TEXT,
            language TEXT,
            published_at TEXT,
            upload_hour INTEGER,
            duration_seconds INTEGER,
            is_question_title INTEGER DEFAULT 0,
            has_number_in_title INTEGER DEFAULT 0,
            views INTEGER DEFAULT 0,
            likes INTEGER DEFAULT 0,
            comments INTEGER DEFAULT 0,
            average_view_duration REAL DEFAULT 0,
            average_view_percentage REAL DEFAULT 0,
            manual_label TEXT,
            collected_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """)

        self.conn.execute("""
        CREATE TABLE IF NOT EXISTS thumbnail_candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic_id TEXT NOT NULL,
            channel_name TEXT NOT NULL,
            variant_code TEXT NOT NULL,
            image_path TEXT,
            prompt_text TEXT,
            style_label TEXT,
            selected INTEGER DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """)

        self.conn.execute("""
        CREATE TABLE IF NOT EXISTS topic_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic_id TEXT NOT NULL UNIQUE,
            channel_name TEXT NOT NULL,
            topic TEXT NOT NULL,
            topic_category TEXT,
            language TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
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

        # 인덱스
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_vmd_video ON video_metadata(video_id)")
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_vm_channel ON video_metrics(channel_name)")
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_vm_topic ON video_metrics(topic_id)")
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_vm_format ON video_metrics(format_type)")
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_tc_topic ON thumbnail_candidates(topic_id)")
        self.conn.execute("CREATE INDEX IF NOT EXISTS idx_tr_channel ON topic_runs(channel_name)")
        self.conn.commit()

    def insert_topic_run(self, row: dict) -> None:
        self.conn.execute("""
        INSERT OR IGNORE INTO topic_runs (
            topic_id, channel_name, topic, topic_category, language
        ) VALUES (?, ?, ?, ?, ?)
        """, (
            row["topic_id"],
            row["channel_name"],
            row["topic"],
            row.get("topic_category"),
            row.get("language"),
        ))
        self.conn.commit()

    def insert_thumbnail_candidate(self, row: dict) -> None:
        self.conn.execute("""
        INSERT INTO thumbnail_candidates (
            topic_id, channel_name, variant_code, image_path,
            prompt_text, style_label, selected, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row["topic_id"],
            row["channel_name"],
            row["variant_code"],
            row.get("image_path"),
            row.get("prompt_text"),
            row.get("style_label"),
            row.get("selected", 0),
            row.get("notes"),
        ))
        self.conn.commit()

    def insert_video_metric(self, row: dict) -> None:
        self.conn.execute("""
        INSERT INTO video_metrics (
            channel_name, video_id, topic_id, title, title_variant,
            thumbnail_variant, format_type, language, published_at,
            upload_hour, duration_seconds, is_question_title,
            has_number_in_title, views, likes, comments,
            average_view_duration, average_view_percentage, manual_label
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            row["channel_name"],
            row["video_id"],
            row.get("topic_id"),
            row.get("title"),
            row.get("title_variant"),
            row.get("thumbnail_variant"),
            row.get("format_type"),
            row.get("language"),
            row.get("published_at"),
            row.get("upload_hour"),
            row.get("duration_seconds"),
            row.get("is_question_title", 0),
            row.get("has_number_in_title", 0),
            row.get("views", 0),
            row.get("likes", 0),
            row.get("comments", 0),
            row.get("average_view_duration", 0),
            row.get("average_view_percentage", 0),
            row.get("manual_label"),
        ))
        self.conn.commit()

    def upsert_video_metadata(self, row: dict) -> None:
        """수동 메타데이터 저장/갱신 (video_id 기준 UPSERT)."""
        self.conn.execute("""
        INSERT INTO video_metadata (
            channel_name, video_id, topic_id, title_variant,
            thumbnail_variant, format_type, language, manual_label, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(video_id) DO UPDATE SET
            topic_id = excluded.topic_id,
            title_variant = excluded.title_variant,
            thumbnail_variant = excluded.thumbnail_variant,
            format_type = excluded.format_type,
            language = excluded.language,
            manual_label = excluded.manual_label,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP
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
        """video_id로 수동 메타데이터 조회."""
        cur = self.conn.execute("""
        SELECT topic_id, title_variant, thumbnail_variant,
               format_type, language, manual_label, notes
        FROM video_metadata WHERE video_id = ?
        """, (video_id,))
        row = cur.fetchone()
        if not row:
            return None
        return {
            "topic_id": row[0],
            "title_variant": row[1],
            "thumbnail_variant": row[2],
            "format_type": row[3],
            "language": row[4],
            "manual_label": row[5],
            "notes": row[6],
        }
