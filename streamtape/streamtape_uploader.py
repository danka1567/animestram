#!/usr/bin/env python3
"""
Streamtape Ultra-Fast Downloader & Local Uploader
Downloads any M3U8, HLS stream, MP4, MKV, etc. at maximum speed and uploads directly to Streamtape API.
"""

import os
import sys
import time
import shutil
import argparse
import requests
import subprocess
from pathlib import Path

# ================= HARDCODED CREDENTIALS =================
STREAMTAPE_LOGIN = "59484016637a23331603"
STREAMTAPE_KEY = "lgWOyYK90XC7xLd"
API_BASE = "https://api.streamtape.com"
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
    out_dir_path = Path(output_dir)
    out_dir_path.mkdir(parents=True, exist_ok=True)

    # Clean previous partial files to prevent fragment collision
    for part_file in out_dir_path.glob("*.part*"):
        try:
            part_file.unlink()
        except Exception:
            pass

    has_ffmpeg = shutil.which("ffmpeg") is not None
    is_m3u8 = ".m3u8" in media_url.lower() or "hls" in media_url.lower()

    if custom_name:
        out_template = custom_name
    elif is_m3u8 and not has_ffmpeg:
        out_template = "%(title)s.ts"
    else:
        out_template = "%(title)s.%(ext)s"

    out_path_template = os.path.join(output_dir, out_template)

    print("\n" + "=" * 70)
    print("⚡ [1/2] STARTING ULTRA-FAST MULTI-THREADED MEDIA DOWNLOAD")
    print(f"URL: {media_url}")
    print("=" * 70)

    has_aria2 = shutil.which("aria2c") is not None
    start_time = time.time()

    if has_aria2:
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

        try:
            print("[Engine] Launching multi-threaded aria2c + yt-dlp pipeline...")
            subprocess.run(cmd_aria2, check=True)
        except Exception as e:
            print(f"[Warning] aria2c engine returned error ({e}). Falling back to native yt-dlp...")
            has_aria2 = False

    if not has_aria2:
        print("[Engine] Using native high-concurrency yt-dlp engine...")
        cmd_native = [
            "yt-dlp",
            "--retries", "10",
            "--fragment-retries", "10",
            "--no-check-certificates",
            "--hls-use-mpegts",
            "-o", out_path_template,
            media_url
        ]
        if user_agent:
            cmd_native.extend(["--user-agent", user_agent])
        subprocess.run(cmd_native, check=True)

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


def get_upload_url(login: str, key: str, folder_id: str = None) -> str:
    """Gets the target upload server endpoint from Streamtape API."""
    params = {
        "login": login,
        "key": key
    }
    if folder_id:
        params["folder"] = folder_id

    resp = requests.get(f"{API_BASE}/file/ul", params=params, timeout=30)
    try:
        data = resp.json()
    except Exception as e:
        print(f"[ERROR] Could not parse JSON from Streamtape API: {resp.text}")
        sys.exit(1)

    if data.get("status") != 200:
        print(f"[ERROR] Failed to obtain Streamtape upload URL: {data.get('msg')} (Status: {data.get('status')})")
        sys.exit(1)

    upload_url = data.get("result", {}).get("url")
    return upload_url


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


def upload_to_streamtape(login: str, key: str, file_path: Path, folder_id: str = None):
    """Performs multipart local file upload to Streamtape API."""
    print("\n" + "=" * 70)
    print("📤 [2/2] STARTING LOCAL FILE UPLOAD TO STREAMTAPE")
    print("=" * 70)

    upload_endpoint = get_upload_url(login, key, folder_id)
    print(f"Upload Endpoint: {upload_endpoint}")
    print(f"Target File: {file_path.name} ({format_size(file_path.stat().st_size)})")

    start_time = time.time()
    with ProgressFileReader(file_path) as reader:
        files = {"file1": (file_path.name, reader)}
        resp = requests.post(upload_endpoint, files=files, timeout=7200)

    elapsed = time.time() - start_time
    print(f"\nUpload request finished in {elapsed:.2f}s.")

    try:
        data = resp.json()
    except Exception:
        print(f"Raw Response: {resp.text}")
        return

    if data.get("status") == 200:
        result = data.get("result", {})
        file_id = result.get("id")
        file_url = result.get("url")
        print("\n" + "=" * 70)
        print("🎉 SUCCESS: FILE UPLOADED TO STREAMTAPE 🎉")
        print(f"  • File Name:   {file_path.name}")
        print(f"  • File ID:     {file_id}")
        print(f"  • Direct Link: {file_url}")
        print("=" * 70 + "\n")
        return result
    else:
        print(f"\n[ERROR] Upload failed with response: {data}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Download any media/m3u8 and upload locally to Streamtape API.")
    parser.add_argument("--url", "-u", required=True, help="Media/Stream URL (M3U8, HLS, MP4, MKV, etc.)")
    parser.add_argument("--login", "-l", default=os.getenv("STREAMTAPE_LOGIN", STREAMTAPE_LOGIN), help="Streamtape API Login")
    parser.add_argument("--key", "-k", default=os.getenv("STREAMTAPE_KEY", STREAMTAPE_KEY), help="Streamtape API Key")
    parser.add_argument("--folder", "-f", default=None, help="Streamtape Target Folder ID (optional)")
    parser.add_argument("--name", "-n", default=None, help="Custom filename (e.g. video.mp4)")
    parser.add_argument("--user-agent", default=None, help="Custom User-Agent header (optional)")
    parser.add_argument("--outdir", default="./downloads", help="Local download directory")

    args = parser.parse_args()

    # 1. Download media locally first
    downloaded_file = high_speed_download(
        media_url=args.url,
        output_dir=args.outdir,
        custom_name=args.name,
        user_agent=args.user_agent
    )

    # 2. Upload downloaded file to Streamtape
    upload_to_streamtape(
        login=args.login,
        key=args.key,
        file_path=downloaded_file,
        folder_id=args.folder
    )


if __name__ == "__main__":
    main()
