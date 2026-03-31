from __future__ import annotations

from src.services.channel_registry import ChannelRegistry
from src.services.video_metrics_service import VideoMetricsService
from src.storage.sqlite import MetricsDB


def main():
    registry = ChannelRegistry("config/channels.json")
    metrics_service = VideoMetricsService()
    db = MetricsDB("data/metrics.db")

    for channel_name, channel_config in registry.get_all().items():
        print(f"[analyze] collecting: {channel_name}")
        rows = metrics_service.collect_recent_metrics(channel_name, channel_config)

        for row in rows:
            db.insert_video_metric(row)
            print(
                f"  [saved] {row['channel_name']} | {row['video_id']} | "
                f"{row['views']} views | AVR {row['average_view_percentage']:.1f}%"
            )

    # merge 확인
    merged = db.list_merged_videos()
    print(f"\n[summary] {len(merged)} merged records total")


if __name__ == "__main__":
    main()
