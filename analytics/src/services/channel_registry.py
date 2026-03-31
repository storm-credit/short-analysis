from __future__ import annotations
import json
from pathlib import Path


class ChannelRegistry:
    def __init__(self, config_path: str = "config/channels.json") -> None:
        self.config_path = Path(config_path)
        self.channels = json.loads(self.config_path.read_text(encoding="utf-8"))

    def get_all(self) -> dict:
        return self.channels

    def get(self, channel_name: str) -> dict:
        if channel_name not in self.channels:
            raise ValueError(f"Unknown channel: {channel_name}")
        return self.channels[channel_name]
