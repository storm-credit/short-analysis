from __future__ import annotations
import re
from datetime import date, datetime, timedelta

from src.clients.youtube_data_client import YouTubeDataClient
from src.clients.youtube_analytics_client import YouTubeAnalyticsClient

# 질문형 제목 패턴
QUESTION_RE = re.compile(
    r'(왜|어떻게|뭐가|몰랐|알고|vs|versus|which|what|why|how|did you know|\?)',
    re.IGNORECASE,
)
NUMBER_RE = re.compile(r'\d+')


class VideoMetricsService:
    def collect_recent_metrics(self, channel_name: str, channel_config: dict) -> list[dict]:
        """YouTube API에서 최근 영상 성과 자동 수집."""
        token_file = channel_config["token_file"]
        channel_id = channel_config["channel_id"]

        data_client = YouTubeDataClient(token_file)
        analytics_client = YouTubeAnalyticsClient(token_file)

        videos = data_client.list_recent_videos(channel_id=channel_id, max_results=10)

        end_date = date.today()
        start_date = end_date - timedelta(days=28)

        results = []

        for video in videos:
            video_id = video["id"]
            snippet = video["snippet"]
            stats = video.get("statistics", {})
            content = video.get("contentDetails", {})

            analytics = analytics_client.get_video_metrics(
                video_id=video_id,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
            )

            title = snippet.get("title", "")
            published_at = snippet.get("publishedAt", "")

            # 자동 감지 필드
            upload_hour = None
            try:
                upload_hour = datetime.fromisoformat(
                    published_at.replace("Z", "+00:00")
                ).hour
            except (ValueError, AttributeError):
                pass

            duration_str = content.get("duration", "")
            duration_seconds = self._parse_duration(duration_str)

            results.append({
                # YouTube API 자동 수집
                "channel_name": channel_name,
                "video_id": video_id,
                "title": title,
                "published_at": published_at,
                "views": int(stats.get("viewCount", analytics["views"] or 0)),
                "likes": int(stats.get("likeCount", analytics["likes"] or 0)),
                "comments": int(stats.get("commentCount", analytics["comments"] or 0)),
                "average_view_duration": float(analytics["average_view_duration"]),
                "average_view_percentage": float(analytics["average_view_percentage"]),
                # 자동 감지
                "language": channel_config.get("language", ""),
                "upload_hour": upload_hour,
                "duration_seconds": duration_seconds,
                "is_question_title": 1 if QUESTION_RE.search(title) else 0,
                "has_number_in_title": 1 if NUMBER_RE.search(title) else 0,
                # 수동 메타 (나중에 merge)
                "topic_id": None,
                "title_variant": None,
                "thumbnail_variant": None,
                "format_type": None,
                "manual_label": None,
            })

        return results

    def merge_manual_metadata(self, row: dict, metadata: dict) -> dict:
        """자동 수집 데이터에 수동 메타데이터 병합.

        metadata 예시:
        {
            "topic_id": "lightning_001",
            "title_variant": "B",
            "thumbnail_variant": "C",
            "format_type": "shorts_science",
            "manual_label": "success",
        }
        """
        merged = {**row}
        for key in ("topic_id", "title_variant", "thumbnail_variant",
                     "format_type", "manual_label"):
            if key in metadata and metadata[key] is not None:
                merged[key] = metadata[key]
        return merged

    @staticmethod
    def _parse_duration(iso_duration: str) -> int | None:
        """ISO 8601 duration → seconds. 예: PT1M30S → 90"""
        if not iso_duration:
            return None
        m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso_duration)
        if not m:
            return None
        h = int(m.group(1) or 0)
        mins = int(m.group(2) or 0)
        s = int(m.group(3) or 0)
        return h * 3600 + mins * 60 + s
