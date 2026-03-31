from __future__ import annotations

from src.services.channel_registry import ChannelRegistry
from src.services.video_metrics_service import VideoMetricsService
from src.storage.sqlite import MetricsDB


def merge_video_row(metric_row: dict, meta_row: dict | None) -> dict:
    """자동 수집 데이터 + 수동 메타데이터 병합."""
    meta_row = meta_row or {}
    merged = {**metric_row}
    for key in ("topic_id", "title_variant", "thumbnail_variant",
                "format_type", "language", "manual_label", "notes"):
        if meta_row.get(key) is not None:
            merged[key] = meta_row[key]
    return merged


def main():
    registry = ChannelRegistry("config/channels.json")
    metrics_service = VideoMetricsService()
    db = MetricsDB("data/metrics.db")

    for channel_name, channel_config in registry.get_all().items():
        print(f"[analyze] collecting: {channel_name}")
        rows = metrics_service.collect_recent_metrics(channel_name, channel_config)

        for metric_row in rows:
            # 수동 메타데이터가 있으면 merge
            meta_row = db.get_video_metadata(metric_row["video_id"])
            merged = merge_video_row(metric_row, meta_row)

            db.insert_video_metric(merged)
            print(
                f"  [saved] {merged['channel_name']} | {merged['video_id']} | "
                f"{merged['views']} views | AVR {merged['average_view_percentage']:.1f}%"
                f"{' | topic=' + merged['topic_id'] if merged.get('topic_id') else ''}"
            )

    print("[done] all channels collected.")


if __name__ == "__main__":
    main()
