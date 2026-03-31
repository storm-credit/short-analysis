from __future__ import annotations
from datetime import date, timedelta

from src.clients.youtube_data_client import YouTubeDataClient
from src.clients.youtube_analytics_client import YouTubeAnalyticsClient


class VideoMetricsService:
    def collect_recent_metrics(self, channel_name: str, channel_config: dict) -> list[dict]:
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

            analytics = analytics_client.get_video_metrics(
                video_id=video_id,
                start_date=start_date.isoformat(),
                end_date=end_date.isoformat(),
            )

            results.append({
                "channel_name": channel_name,
                "video_id": video_id,
                "title": snippet.get("title", ""),
                "published_at": snippet.get("publishedAt", ""),
                "views": int(stats.get("viewCount", analytics["views"] or 0)),
                "likes": int(stats.get("likeCount", analytics["likes"] or 0)),
                "comments": int(stats.get("commentCount", analytics["comments"] or 0)),
                "average_view_duration": float(analytics["average_view_duration"]),
                "average_view_percentage": float(analytics["average_view_percentage"]),
            })

        return results
