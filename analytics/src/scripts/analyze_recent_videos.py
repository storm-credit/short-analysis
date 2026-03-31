from __future__ import annotations
import re
from datetime import datetime

from src.services.channel_registry import ChannelRegistry
from src.services.video_metrics_service import VideoMetricsService
from src.storage.sqlite import MetricsDB

# 제목에 숫자 포함 여부
HAS_NUMBER = re.compile(r'\d+')
# Q&A/질문형 제목 패턴
QUESTION_PATTERNS = re.compile(
    r'(왜|어떻게|뭐가|몰랐|알고|vs|versus|which|what|why|how|did you know|\?)',
    re.IGNORECASE,
)


def detect_title_flags(title: str) -> dict:
    return {
        "is_question_title": 1 if QUESTION_PATTERNS.search(title) else 0,
        "has_number_in_title": 1 if HAS_NUMBER.search(title) else 0,
    }


def parse_upload_hour(published_at: str) -> int | None:
    try:
        return datetime.fromisoformat(published_at.replace("Z", "+00:00")).hour
    except (ValueError, AttributeError):
        return None


def main():
    registry = ChannelRegistry("config/channels.json")
    metrics_service = VideoMetricsService()
    db = MetricsDB("data/metrics.db")

    for channel_name, channel_config in registry.get_all().items():
        print(f"[analyze] collecting: {channel_name}")
        rows = metrics_service.collect_recent_metrics(channel_name, channel_config)

        for row in rows:
            # 자동 플래그 추가
            title = row.get("title", "")
            flags = detect_title_flags(title)
            row.update(flags)
            row["upload_hour"] = parse_upload_hour(row.get("published_at", ""))
            row["language"] = channel_config.get("language", "")

            db.insert_video_metric(row)
            print(
                f"  [saved] {row['channel_name']} | {row['video_id']} | "
                f"{row['views']} views | AVR {row['average_view_percentage']:.1f}%"
            )

    print("[done] all channels collected.")


if __name__ == "__main__":
    main()
