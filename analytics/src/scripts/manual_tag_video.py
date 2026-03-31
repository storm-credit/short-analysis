"""수동 메타데이터 태깅 스크립트.

사용법:
  python -m src.scripts.manual_tag_video \\
    --video-id abc123 \\
    --channel wonderdrop \\
    --topic lightning_001 \\
    --title-variant B \\
    --thumb-variant C \\
    --format shorts_science \\
    --label success \\
    --notes "dramatic thumbnail selected"
"""
from __future__ import annotations
import argparse

from src.storage.sqlite import MetricsDB


def main():
    parser = argparse.ArgumentParser(description="수동 메타데이터 태깅")
    parser.add_argument("--video-id", required=True)
    parser.add_argument("--channel", required=True)
    parser.add_argument("--topic", default=None)
    parser.add_argument("--title-variant", default=None)
    parser.add_argument("--thumb-variant", default=None)
    parser.add_argument("--format", default=None, dest="format_type")
    parser.add_argument("--lang", default=None)
    parser.add_argument("--label", default=None)
    parser.add_argument("--notes", default=None)
    args = parser.parse_args()

    db = MetricsDB("data/metrics.db")
    db.upsert_video_metadata({
        "channel_name": args.channel,
        "video_id": args.video_id,
        "topic_id": args.topic,
        "title_variant": args.title_variant,
        "thumbnail_variant": args.thumb_variant,
        "format_type": args.format_type,
        "language": args.lang,
        "manual_label": args.label,
        "notes": args.notes,
    })

    print(f"[tagged] {args.video_id} → topic={args.topic} thumb={args.thumb_variant} label={args.label}")

    # 확인
    meta = db.get_video_metadata(args.video_id)
    if meta:
        print(f"[stored] {meta}")


if __name__ == "__main__":
    main()
