#!/usr/bin/env python3
"""
Luluvdo / LuluStream Ultra-Fast Downloader & Local Uploader
Downloads any M3U8, HLS stream, MP4, MKV, etc. at maximum speed and uploads directly to Luluvdo / LuluStream API.
"""

import os
import sys
import time
import argparse
import requests
import subprocess
from pathlib import Path

# ================= HARDCODED CREDENTIALS =================
# Luluvdo / LuluStream API key
LULUVDO_API_KEY = "322439q3cvqe2n5zputjjf"
# API Base domains (prioritizes lulustream.com and luluvdo.com)
API_BASE_URLS = [
    "https://lulustream.com/api",
    "https://luluvdo.com/api"
]
# =========================================================


def format_size(size_bytes):
    """Format bytes into human-readable units."""
    if not size_bytes or size_bytes <= 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)
    while size >= 1024.0 and i < len(units) - 1:
        size /= 1024.0
        i += 1
    return f"{size:.2f} {units[i]}"


def high_speed_download(media_url: str, output_dir: str, custom_name: str = None, user_agent: str = None) -> Path:
    """
    Downloads M3U8 / HLS / MP4 / any stream media using yt-dlp + aria2c 16-thread multi-connection engine.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    out_template = custom_name if custom_name else "%(title)s.%(ext)s"
    out_path_template = os.path.join(output_dir, out_template)

    print("\n" + "=" * 70)
    print("⚡ [1/2] STARTING ULTRA-FAST MULTI-THREADED MEDIA DOWNLOAD")
    print(f"URL: {media_url}")
    print("=" * 70)

    # Multi-connection download engine using aria2c (16 connections) and yt-dlp (16 concurrent HLS fragments)
    cmd_aria2 = [
        "yt-dlp",
        "--downloader", "aria2c",
        "--downloader-args", "aria2c:-x 16 -s 16 -k 1M --max-connection-per-server=16 --min-split-size=1M --optimize-concurrent-downloads=true --file-allocation=none",
        "--concurrent-fragments", "16",
        "--hls-use-mpegts",
        "--retries", "10",
        "--fragment-retries", "10",
        "--no-check-certificates",
        "-o", out_path_template,
        media_url
    ]

    if user_agent:
        cmd_aria2.extend(["--user-agent", user_agent])

    start_time = time.time()
    try:
        print("[Engine] Launching multi-threaded aria2c + yt-dlp pipeline...")
        subprocess.run(cmd_aria2, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"[Warning] aria2c engine unavailable or returned error ({e}).")
        print("[Engine] Falling back to native high-concurrency yt-dlp/ffmpeg engine...")
        cmd_fallback = [
            "yt-dlp",
            "--concurrent-fragments", "16",
            "--retries", "10",
            "--fragment-retries", "10",
            "-o", out_path_template,
            media_url
        ]
        if user_agent:
            cmd_fallback.extend(["--user-agent", user_agent])
        subprocess.run(cmd_fallback, check=True)

    elapsed = time.time() - start_time

    # Locate downloaded file in output directory
    files = [f for f in Path(output_dir).iterdir() if f.is_file() and not f.name.startswith(".")]
    if not files:
        print("[ERROR] No downloaded media file found!")
        sys.exit(1)

    # Select the most recent file
    downloaded_file = max(files, key=lambda p: p.stat().st_mtime)
    file_size = downloaded_file.stat().st_size

    print("\n✅ [DOWNLOAD COMPLETE]")
    print(f"  • Filename: {downloaded_file.name}")
    print(f"  • Filesize: {format_size(file_size)} ({file_size} bytes)")
    print(f"  • Download Duration: {elapsed:.2f}s")
    return downloaded_file


def get_upload_server_url(api_key: str) -> tuple[str, dict]:
    """
    Fetches the upload server endpoint from Luluvdo / LuluStream API.
    Returns (upload_url, extra_params)
    """
    for base in API_BASE_URLS:
        try:
            endpoint = f"{base}/upload/server"
            resp = requests.get(endpoint, params={"key": api_key}, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == 200:
                    result = data.get("result", {})
                    if isinstance(result, dict):
                        upload_url = result.get("url") or result.get("server")
                        sess_id = result.get("sess_id")
                        return upload_url, {"sess_id": sess_id} if sess_id else {}
                    elif isinstance(result, str):
                        return result, {}
                elif "result" in data and isinstance(data["result"], str):
                    return data["result"], {}
        except Exception as e:
            continue

    # Fallback to direct upload endpoint
    return f"https://luluvdo.com/api/upload/server", {}


class ProgressFileReader:
    """Wraps file object to show dynamic upload progress."""
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.total_size = file_path.stat().st_size
        self._file = open(file_path, "rb")
        self.bytes_read = 0
        self.last_print = 0

    def read(self, size=-1):
        chunk = self._file.read(size)
        if chunk:
            self.bytes_read += len(chunk)
            now = time.time()
            if now - self.last_print > 0.5 or self.bytes_read == self.total_size:
                percent = (self.bytes_read / self.total_size) * 100 if self.total_size else 100
                print(f"\r🚀 Uploading: {format_size(self.bytes_read)} / {format_size(self.total_size)} ({percent:.1f}%)", end="", flush=True)
                self.last_print = now
        return chunk

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._file.close()


def upload_to_luluvdo(api_key: str, file_path: Path, folder_id: str = None):
    """
    Performs local file multipart upload to Luluvdo / LuluStream API.
    """
    print("\n" + "=" * 70)
    print("📤 [2/2] STARTING LOCAL FILE UPLOAD TO LULUVDO")
    print("=" * 70)

    upload_endpoint, extra_params = get_upload_server_url(api_key)
    print(f"Target Upload Endpoint: {upload_endpoint}")
    print(f"Target File: {file_path.name} ({format_size(file_path.stat().st_size)})")

    post_data = {
        "key": api_key,
        "utype": "prem"
    }
    if folder_id:
        post_data["fld_id"] = folder_id
        post_data["folder"] = folder_id
    if extra_params:
        post_data.update(extra_params)

    start_time = time.time()
    with ProgressFileReader(file_path) as reader:
        # Standard XFS / Luluvdo accepts file, file_0, or file1
        files = {"file_0": (file_path.name, reader), "file": (file_path.name, reader)}
        resp = requests.post(upload_endpoint, data=post_data, files={"file_0": (file_path.name, reader)}, timeout=7200)

    elapsed = time.time() - start_time
    print(f"\nUpload request finished in {elapsed:.2f}s.")

    try:
        data = resp.json()
    except Exception:
        print(f"Raw Response: {resp.text}")
        return

    if data.get("status") == 200 or (isinstance(data, list) and len(data) > 0 and data[0].get("file_code")):
        result = data.get("result", {}) if isinstance(data, dict) else data[0]
        file_code = result.get("file_code") or result.get("id") or result.get("filecode")
        file_url = result.get("url") or f"https://luluvdo.com/{file_code}"
        print("\n" + "=" * 70)
        print("🎉 SUCCESS: FILE UPLOADED TO LULUVDO 🎉")
        print(f"  • File Name:   {file_path.name}")
        print(f"  • File Code:   {file_code}")
        print(f"  • Direct Link: {file_url}")
        print("=" * 70 + "\n")
        return result
    else:
        print(f"\nResponse: {data}")
        return data


def remote_upload_luluvdo(api_key: str, media_url: str, folder_id: str = None):
    """Initiates remote upload on Luluvdo API."""
    print("\n" + "=" * 70)
    print("🌐 INITIATING REMOTE UPLOAD ON LULUVDO API")
    print(f"URL: {media_url}")
    print("=" * 70)

    params = {
        "key": api_key,
        "url": media_url
    }
    if folder_id:
        params["folder"] = folder_id

    for base in API_BASE_URLS:
        try:
            resp = requests.get(f"{base}/upload/url", params=params, timeout=30)
            data = resp.json()
            print(f"Response: {data}")
            return data
        except Exception:
            continue


def main():
    parser = argparse.ArgumentParser(description="Download any media/m3u8 and upload locally to Luluvdo / LuluStream API.")
    parser.add_argument("--url", "-u", required=True, help="Media/Stream URL (M3U8, HLS, MP4, MKV, etc.)")
    parser.add_argument("--mode", "-m", choices=["local", "remote"], default="local", help="Upload mode (default: local)")
    parser.add_argument("--key", "-k", default=os.getenv("LULUVDO_API_KEY", LULUVDO_API_KEY), help="Luluvdo API Key")
    parser.add_argument("--folder", "-f", default=None, help="Luluvdo Target Folder ID (optional)")
    parser.add_argument("--name", "-n", default=None, help="Custom filename (e.g. video.mp4)")
    parser.add_argument("--user-agent", default=None, help="Custom User-Agent header (optional)")
    parser.add_argument("--outdir", default="./downloads", help="Local download directory")

    args = parser.parse_args()

    if args.mode == "remote":
        remote_upload_luluvdo(api_key=args.key, media_url=args.url, folder_id=args.folder)
    else:
        # 1. Download media locally first
        downloaded_file = high_speed_download(
            media_url=args.url,
            output_dir=args.outdir,
            custom_name=args.name,
            user_agent=args.user_agent
        )

        # 2. Upload downloaded file to Luluvdo
        upload_to_luluvdo(
            api_key=args.key,
            file_path=downloaded_file,
            folder_id=args.folder
        )


if __name__ == "__main__":
    main()
