"""OAuth 토큰 생성 스크립트.

사용법:
  1. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성
     - 유형: 데스크톱 앱
     - 다운로드 → client_secret.json

  2. 실행:
     python -m src.scripts.setup_oauth --channel askanything --client-secret client_secret.json

  3. 브라우저에서 Google 로그인 → 채널 선택 → 권한 승인

  4. secrets/askanything_token.json 자동 생성됨

필요한 OAuth 스코프:
  - youtube.readonly (영상 목록 조회)
  - yt-analytics.readonly (Analytics 데이터 조회)
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]


def main():
    parser = argparse.ArgumentParser(description="OAuth 토큰 생성")
    parser.add_argument("--channel", required=True, help="채널 이름 (config/channels.json 키)")
    parser.add_argument("--client-secret", required=True, help="Google OAuth client_secret.json 경로")
    args = parser.parse_args()

    # channels.json에서 token_file 경로 확인
    channels = json.loads(Path("config/channels.json").read_text(encoding="utf-8"))
    if args.channel not in channels:
        print(f"[error] '{args.channel}' not in config/channels.json")
        print(f"  available: {list(channels.keys())}")
        return

    token_file = channels[args.channel]["token_file"]
    Path(token_file).parent.mkdir(parents=True, exist_ok=True)

    # 이미 토큰이 있으면 확인
    if Path(token_file).exists():
        print(f"[info] 기존 토큰 발견: {token_file}")
        existing = json.loads(Path(token_file).read_text(encoding="utf-8"))
        creds = Credentials(
            token=existing["token"],
            refresh_token=existing.get("refresh_token"),
            token_uri=existing["token_uri"],
            client_id=existing["client_id"],
            client_secret=existing["client_secret"],
            scopes=existing["scopes"],
        )
        if creds.valid:
            print("[info] 토큰이 유효합니다. 새로 발급하려면 기존 파일을 삭제하세요.")
            return
        print("[info] 토큰 만료됨. 새로 발급합니다.")

    # OAuth 플로우 실행
    print(f"[oauth] {args.channel} 채널 인증 시작...")
    print("[oauth] 브라우저가 열립니다. 채널 소유 Google 계정으로 로그인하세요.")

    flow = InstalledAppFlow.from_client_secrets_file(args.client_secret, SCOPES)
    creds = flow.run_local_server(port=0)

    # 토큰 저장
    payload = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes) if creds.scopes else SCOPES,
    }
    Path(token_file).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"[done] 토큰 저장됨: {token_file}")
    print(f"  채널: {args.channel}")
    print(f"  스코프: {SCOPES}")


if __name__ == "__main__":
    main()
