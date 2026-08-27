#!/usr/bin/env python3
"""
Streamtape Ultra-Fast Downloader & Local / Remote Uploader
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

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


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
    has_ytdlp = shutil.which("yt-dlp") is not None
    start_time = time.time()

    if has_aria2 and has_ytdlp:
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

    if not has_aria2 and has_ytdlp:
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
        try:
            subprocess.run(cmd_native, check=True)
        except Exception as e:
            print(f"[Warning] yt-dlp failed: {e}")

    # Fallback to direct HTTP download if yt-dlp was not available or failed
    files = [f for f in Path(output_dir).iterdir() if f.is_file() and not f.name.startswith(".")]
    if not files:
        print("[Engine] Direct HTTP streaming fallback download...")
        target_filename = custom_name if custom_name else media_url.split("?")[0].split("/")[-1] or "video.mp4"
        if not ("." in target_filename):
            target_filename += ".mp4"
        out_file_path = out_dir_path / target_filename
        
        headers = {"User-Agent": user_agent or DEFAULT_HEADERS["User-Agent"]}
        resp = requests.get(media_url, headers=headers, stream=True, timeout=60)
        resp.raise_for_status()
        total_len = int(resp.headers.get("content-length", 0))
        downloaded = 0
        with open(out_file_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total_len > 0:
                        pct = (downloaded / total_len) * 100
                        sys.stdout.write(f"\r📥 Downloading: {format_size(downloaded)} / {format_size(total_len)} ({pct:.1f}%)")
                    else:
                        sys.stdout.write(f"\r📥 Downloading: {format_size(downloaded)}")
                    sys.stdout.flush()
        print()
        files = [out_file_path]

    elapsed = time.time() - start_time

    # Locate downloaded file in output directory
    downloaded_file = max(files, key=lambda p: p.stat().st_mtime)
    file_size = downloaded_file.stat().st_size

    print("\n✅ [DOWNLOAD COMPLETE]")
    print(f"  • Filename: {downloaded_file.name}")
    print(f"  • Filesize: {format_size(file_size)} ({file_size} bytes)")
    print(f"  • Download Duration: {elapsed:.2f}s")
    return downloaded_file


def get_account_info(login: str, key: str):
    """Fetches user account details from Streamtape API."""
    params = {"login": login, "key": key}
    try:
        resp = requests.get(f"{API_BASE}/account/info", params=params, headers=DEFAULT_HEADERS, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to fetch account info: {e}")
        return None


def get_upload_url(login: str, key: str, folder_id: str = None) -> str:
    """Gets the target upload server endpoint from Streamtape API."""
    params = {"login": login, "key": key}
    if folder_id:
        params["folder"] = folder_id

    resp = requests.get(f"{API_BASE}/file/ul", params=params, headers=DEFAULT_HEADERS, timeout=30)
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
        resp = requests.post(upload_endpoint, files=files, headers={"User-Agent": DEFAULT_HEADERS["User-Agent"]}, timeout=7200)

    elapsed = time.time() - start_time
    print(f"\nUpload request finished in {elapsed:.2f}s.")

    try:
        data = resp.json()
    except Exception:
        print(f"Raw Response: {resp.text}")
        return None

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
        return data


def remote_upload_streamtape(login: str, key: str, media_url: str, folder_id: str = None, name: str = None):
    """Initiates remote upload by URL on Streamtape API."""
    print("\n" + "=" * 70)
    print("🌐 INITIATING REMOTE URL UPLOAD ON STREAMTAPE API")
    print(f"URL: {media_url}")
    print("=" * 70)

    params = {
        "login": login,
        "key": key,
        "url": media_url
    }
    if folder_id:
        params["folder"] = folder_id
    if name:
        params["name"] = name

    try:
        resp = requests.get(f"{API_BASE}/remotedl/add", params=params, headers=DEFAULT_HEADERS, timeout=30)
        data = resp.json()
        print(f"Response: {data}")
        if data.get("status") == 200:
            result = data.get("result", {})
            remote_id = result.get("id")
            print("\n" + "=" * 70)
            print("✅ REMOTE UPLOAD JOB STARTED")
            print(f"  • Remote Task ID: {remote_id}")
            print("=" * 70 + "\n")
        return data
    except Exception as e:
        print(f"[ERROR] Remote upload failed: {e}")
        return None


def get_remote_upload_status(login: str, key: str, remote_id: str = None):
    """Gets status of remote upload tasks on Streamtape."""
    params = {"login": login, "key": key}
    if remote_id:
        params["id"] = remote_id
    try:
        resp = requests.get(f"{API_BASE}/remotedl/status", params=params, headers=DEFAULT_HEADERS, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to get remote status: {e}")
        return None


def list_files(login: str, key: str, folder_id: str = None):
    """Lists files and folders on Streamtape."""
    params = {"login": login, "key": key}
    if folder_id:
        params["folder"] = folder_id
    try:
        resp = requests.get(f"{API_BASE}/file/listfolder", params=params, headers=DEFAULT_HEADERS, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to list files: {e}")
        return None


def get_file_info(login: str, key: str, file_id: str):
    """Gets info about a specific file on Streamtape."""
    params = {"login": login, "key": key, "file": file_id}
    try:
        resp = requests.get(f"{API_BASE}/file/info", params=params, headers=DEFAULT_HEADERS, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to get file info: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Download any media/m3u8 and upload locally or remotely to Streamtape API.")
    parser.add_argument("--url", "-u", default="https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/big_buck_bunny.mp4", help="Media/Stream URL (default: Big Buck Bunny sample)")
    parser.add_argument("--mode", "-m", choices=["local", "remote", "account", "list", "info", "remote-status"], default="local", help="Operation mode (default: local)")
    parser.add_argument("--login", "-l", default=os.getenv("STREAMTAPE_LOGIN", STREAMTAPE_LOGIN), help="Streamtape API Login")
    parser.add_argument("--key", "-k", default=os.getenv("STREAMTAPE_KEY", STREAMTAPE_KEY), help="Streamtape API Key")
    parser.add_argument("--folder", "-f", default=None, help="Streamtape Target Folder ID (optional)")
    parser.add_argument("--name", "-n", default=None, help="Custom filename (e.g. video.mp4)")
    parser.add_argument("--file-id", default=None, help="File ID for info mode")
    parser.add_argument("--task-id", default=None, help="Remote task ID for remote-status mode")
    parser.add_argument("--user-agent", default=None, help="Custom User-Agent header (optional)")
    parser.add_argument("--outdir", default="./downloads", help="Local download directory")

    args = parser.parse_args()

    if args.mode == "account":
        res = get_account_info(args.login, args.key)
        print("\n" + "=" * 70)
        print("👤 STREAMTAPE ACCOUNT INFO")
        print("=" * 70)
        if res and res.get("status") == 200:
            result = res.get("result", {})
            for k, v in result.items():
                print(f"  • {k}: {v}")
        else:
            print(f"Failed to fetch account info: {res}")
        print("=" * 70)

    elif args.mode == "list":
        res = list_files(args.login, args.key, folder_id=args.folder)
        print("\n" + "=" * 70)
        print("📁 STREAMTAPE FILES & FOLDERS")
        print("=" * 70)
        if res and res.get("status") == 200:
            result = res.get("result", {})
            files = result.get("files", [])
            folders = result.get("folders", [])
            print(f"Folders ({len(folders)}):")
            for fld in folders:
                print(f"  📁 [{fld.get('id')}] {fld.get('name')}")
            print(f"\nFiles ({len(files)}):")
            for fil in files:
                print(f"  📄 [{fil.get('id')}] {fil.get('name')} ({format_size(fil.get('size', 0))})")
                print(f"     Link: {fil.get('link')}")
        else:
            print(f"Failed to list: {res}")
        print("=" * 70)

    elif args.mode == "info":
        if not args.file_id:
            print("[ERROR] --file-id is required for info mode.")
            sys.exit(1)
        res = get_file_info(args.login, args.key, args.file_id)
        print(f"File info: {res}")

    elif args.mode == "remote-status":
        res = get_remote_upload_status(args.login, args.key, remote_id=args.task_id)
        print(f"Remote Status: {res}")

    elif args.mode == "remote":
        remote_upload_streamtape(
            login=args.login,
            key=args.key,
            media_url=args.url,
            folder_id=args.folder,
            name=args.name
        )

    else:
        # Default: Local download + upload
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
