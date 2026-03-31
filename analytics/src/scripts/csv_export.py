from __future__ import annotations
import csv
import sqlite3
from pathlib import Path


def export_video_metrics(db_path: str = "data/metrics.db", out_dir: str = "data") -> str:
    """video_metrics 테이블을 CSV로 내보내기."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM video_metrics ORDER BY collected_at DESC").fetchall()

    if not rows:
        print("[export] No data to export.")
        return ""

    Path(out_dir).mkdir(exist_ok=True)
    out_path = f"{out_dir}/video_metrics.csv"

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        for row in rows:
            writer.writerow(dict(row))

    print(f"[export] {len(rows)} rows → {out_path}")
    return out_path


def export_thumbnail_candidates(db_path: str = "data/metrics.db", out_dir: str = "data") -> str:
    """thumbnail_candidates 테이블을 CSV로 내보내기."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM thumbnail_candidates ORDER BY created_at DESC").fetchall()

    if not rows:
        print("[export] No thumbnail data to export.")
        return ""

    Path(out_dir).mkdir(exist_ok=True)
    out_path = f"{out_dir}/thumbnail_candidates.csv"

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        for row in rows:
            writer.writerow(dict(row))

    print(f"[export] {len(rows)} rows → {out_path}")
    return out_path


def main():
    export_video_metrics()
    export_thumbnail_candidates()


if __name__ == "__main__":
    main()
