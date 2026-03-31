from __future__ import annotations
import json
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build


class YouTubeAnalyticsClient:
    def __init__(self, token_file: str) -> None:
        self.token_file = token_file
        self.analytics = self._build()

    def _build(self):
        token_data = json.loads(Path(self.token_file).read_text(encoding="utf-8"))
        creds = Credentials(
            token=token_data["token"],
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data["token_uri"],
            client_id=token_data["client_id"],
            client_secret=token_data["client_secret"],
            scopes=token_data["scopes"],
        )

        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            self._save_credentials(creds)

        return build("youtubeAnalytics", "v2", credentials=creds)

    def _save_credentials(self, creds: Credentials) -> None:
        payload = {
            "token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes) if creds.scopes else [],
        }
        Path(self.token_file).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def get_video_metrics(self, video_id: str, start_date: str, end_date: str) -> dict:
        response = self.analytics.reports().query(
            ids="channel==MINE",
            startDate=start_date,
            endDate=end_date,
            metrics="views,averageViewDuration,averageViewPercentage,likes,comments",
            dimensions="video",
            filters=f"video=={video_id}",
        ).execute()

        rows = response.get("rows", [])
        if not rows:
            return {
                "views": 0,
                "average_view_duration": 0,
                "average_view_percentage": 0,
                "likes": 0,
                "comments": 0,
            }

        row = rows[0]
        return {
            "views": row[1],
            "average_view_duration": row[2],
            "average_view_percentage": row[3],
            "likes": row[4],
            "comments": row[5],
        }
