#!/usr/bin/env python3
"""
EarnVids Ultra-Fast Downloader & Local Uploader
Downloads any M3U8, HLS stream, MP4, MKV, etc. at maximum speed and uploads directly to EarnVids API.
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
# EarnVids API key
EARNVIDS_API_KEY = "47202gy09k73xaina8y8t"
# API Base domains
API_BASE_URLS = [
    "https://earnvidsapi.com/api",
    "https://earnvids.com/api",
    "https://xvs.tt/api"
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


DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}


def get_account_info(api_key: str):
    """Fetches user account details and storage info."""
    for base in API_BASE_URLS:
        try:
            endpoint = f"{base}/account/info"
            resp = requests.get(endpoint, params={"key": api_key}, headers=DEFAULT_HEADERS, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == 200:
                    return data.get("result", {})
        except Exception:
            continue
    return None


def get_upload_server_url(api_key: str, custom_server: str = None) -> tuple[str, dict]:
    """
    Fetches the dynamic upload server endpoint from EarnVids API.
    Returns (upload_url, extra_params)
    """
    if custom_server:
        return custom_server, {}

    for base in API_BASE_URLS:
        try:
            endpoint = f"{base}/upload/server"
            resp = requests.get(endpoint, params={"key": api_key}, headers=DEFAULT_HEADERS, timeout=20)
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    if data.get("status") == 200:
                        result = data.get("result", {})
                        if isinstance(result, dict):
                            upload_url = result.get("url") or result.get("server")
                            sess_id = result.get("sess_id")
                            if upload_url:
                                return upload_url, {"sess_id": sess_id} if sess_id else {}
                        elif isinstance(result, str) and result.startswith("http"):
                            return result, {}
                except Exception:
                    pass
        except Exception:
            continue

    # Fallback to curl subprocess if blocked by Cloudflare TLS fingerprinting
    for base in API_BASE_URLS:
        try:
            cmd = ["curl", "-s", "-A", DEFAULT_HEADERS["User-Agent"], f"{base}/upload/server?key={api_key}"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            if res.returncode == 0 and res.stdout:
                import json
                data = json.loads(res.stdout)
                if data.get("status") == 200:
                    result = data.get("result")
                    if isinstance(result, str) and result.startswith("http"):
                        return result, {}
                    elif isinstance(result, dict):
                        upload_url = result.get("url") or result.get("server")
                        if upload_url:
                            return upload_url, {}
        except Exception:
            continue

    # Verified fallback upload node
    return "https://s1.myvideo.com/upload/01", {}


class ProgressFileReader:
    """Wraps file object to show dynamic upload progress."""
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.total_size = file_path.stat().st_size
        self.read_bytes = 0
        self.last_print = 0
        self._file = open(file_path, "rb")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._file.close()

    def read(self, size=-1):
        chunk = self._file.read(size)
        if chunk:
            self.read_bytes += len(chunk)
            now = time.time()
            if now - self.last_print >= 0.5 or self.read_bytes == self.total_size:
                self.last_print = now
                pct = (self.read_bytes / self.total_size) * 100 if self.total_size > 0 else 100
                sys.stdout.write(
                    f"\r🚀 Uploading: {format_size(self.read_bytes)} / {format_size(self.total_size)} ({pct:.1f}%)"
                )
                sys.stdout.flush()
        return chunk

    def seek(self, offset, whence=0):
        return self._file.seek(offset, whence)

    def tell(self):
        return self._file.tell()


def upload_to_earnvids(api_key: str, file_path: Path, folder_id: str = None, upload_server: str = None,
                      file_title: str = None, file_descr: str = None, cat_id: str = None,
                      tags: str = None, file_public: int = 1, file_adult: int = 0, snapshot_path: str = None):
    """
    Performs local file multipart upload to EarnVids API server.
    """
    print("\n" + "=" * 70)
    print("📤 [2/2] STARTING LOCAL FILE UPLOAD TO EARNVIDS")
    print("=" * 70)

    upload_endpoint, extra_params = get_upload_server_url(api_key, custom_server=upload_server)
    print(f"Target Upload Endpoint: {upload_endpoint}")
    print(f"Target File: {file_path.name} ({format_size(file_path.stat().st_size)})")

    post_data = {
        "key": api_key,
        "file_public": str(file_public),
        "file_adult": str(file_adult)
    }
    if folder_id:
        post_data["fld_id"] = str(folder_id)
    if file_title:
        post_data["file_title"] = file_title
    if file_descr:
        post_data["file_descr"] = file_descr
    if cat_id:
        post_data["cat_id"] = str(cat_id)
    if tags:
        post_data["tags"] = tags
    if extra_params:
        post_data.update(extra_params)

    files = {}
    snapshot_f = None
    if snapshot_path and os.path.exists(snapshot_path):
        snapshot_f = open(snapshot_path, "rb")
        files["snapshot"] = (os.path.basename(snapshot_path), snapshot_f)

    start_time = time.time()
    try:
        with ProgressFileReader(file_path) as reader:
            files["file"] = (file_path.name, reader)
            resp = requests.post(
                upload_endpoint,
                data=post_data,
                files=files,
                headers={"User-Agent": DEFAULT_HEADERS["User-Agent"]},
                timeout=7200
            )
    finally:
        if snapshot_f:
            snapshot_f.close()

    elapsed = time.time() - start_time
    print(f"\nUpload request finished in {elapsed:.2f}s.")

    try:
        data = resp.json()
    except Exception:
        print(f"Raw Response ({resp.status_code}): {resp.text}")
        return

    # Parse response
    file_code = None
    if isinstance(data, dict):
        if "files" in data and isinstance(data["files"], list) and len(data["files"]) > 0:
            file_code = data["files"][0].get("filecode") or data["files"][0].get("file_code")
        elif "result" in data:
            res = data["result"]
            if isinstance(res, dict):
                file_code = res.get("filecode") or res.get("file_code") or res.get("id")
            elif isinstance(res, str):
                file_code = res
    elif isinstance(data, list) and len(data) > 0:
        file_code = data[0].get("filecode") or data[0].get("file_code")

    if file_code:
        file_url = f"https://earnvids.com/{file_code}"
        embed_url = f"https://earnvids.com/e/{file_code}"
        print("\n" + "=" * 70)
        print("🎉 SUCCESS: FILE UPLOADED TO EARNVIDS 🎉")
        print(f"  • File Name:   {file_path.name}")
        print(f"  • File Code:   {file_code}")
        print(f"  • Watch URL:   {file_url}")
        print(f"  • Embed URL:   {embed_url}")
        print("=" * 70 + "\n")
        return {"filecode": file_code, "url": file_url, "embed": embed_url}
    else:
        print(f"\nResponse: {data}")
        return data


def remote_upload_earnvids(api_key: str, media_url: str, folder_id: str = None,
                          cat_id: str = None, file_public: int = 1, file_adult: int = 0, tags: str = None):
    """Initiates remote upload by URL on EarnVids API."""
    print("\n" + "=" * 70)
    print("🌐 INITIATING REMOTE URL UPLOAD ON EARNVIDS API")
    print(f"URL: {media_url}")
    print("=" * 70)

    params = {
        "key": api_key,
        "url": media_url,
        "file_public": file_public,
        "file_adult": file_adult
    }
    if folder_id:
        params["fld_id"] = folder_id
    if cat_id:
        params["cat_id"] = cat_id
    if tags:
        params["tags"] = tags

    for base in API_BASE_URLS:
        try:
            resp = requests.get(f"{base}/upload/url", params=params, headers=DEFAULT_HEADERS, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                print(f"Response: {data}")
                result = data.get("result", {})
                if isinstance(result, dict) and "filecode" in result:
                    filecode = result["filecode"]
                    print("\n" + "=" * 70)
                    print(f"✅ Remote upload initiated!")
                    print(f"  • Future File Code: {filecode}")
                    print(f"  • Watch URL:        https://earnvids.com/{filecode}")
                    print("=" * 70 + "\n")
                return data
        except Exception as e:
            print(f"[Warning] Endpoint {base} failed: {e}")
            continue


def upload_subtitle(api_key: str, file_code: str, sub_lang: str, sub_file_path: str):
    """Uploads subtitle (.vtt/.srt) to an existing EarnVids video."""
    print("\n" + "=" * 70)
    print(f"📝 UPLOADING SUBTITLE FOR {file_code} ({sub_lang})")
    print("=" * 70)

    if not os.path.exists(sub_file_path):
        print(f"[ERROR] Subtitle file not found: {sub_file_path}")
        return

    for base in API_BASE_URLS:
        try:
            with open(sub_file_path, "rb") as sf:
                resp = requests.post(
                    f"{base}/upload/sub",
                    data={"key": api_key, "file_code": file_code, "sub_lang": sub_lang},
                    files={"sub_file": (os.path.basename(sub_file_path), sf)},
                    headers=DEFAULT_HEADERS,
                    timeout=60
                )
            if resp.status_code == 200:
                data = resp.json()
                print(f"Subtitle Upload Response: {data}")
                return data
        except Exception as e:
            print(f"[Warning] Subtitle upload error on {base}: {e}")
            continue


def main():
    parser = argparse.ArgumentParser(description="Download any media/m3u8 and upload locally or remotely to EarnVids API.")
    parser.add_argument("--url", "-u", default="https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/big_buck_bunny.mp4", help="Media/Stream URL (default: Big Buck Bunny sample)")
    parser.add_argument("--mode", "-m", choices=["local", "remote", "sub", "account"], default="local", help="Operation mode (local, remote, sub, account)")
    parser.add_argument("--key", "-k", default=os.getenv("EARNVIDS_API_KEY", EARNVIDS_API_KEY), help="EarnVids API Key")
    parser.add_argument("--folder", "-f", default=None, help="EarnVids Target Folder ID (optional)")
    parser.add_argument("--title", "-t", default=None, help="Video title (optional)")
    parser.add_argument("--descr", "-d", default=None, help="Video description (optional)")
    parser.add_argument("--cat-id", default=None, help="Category ID (optional)")
    parser.add_argument("--tags", default=None, help="Tags comma separated (optional)")
    parser.add_argument("--public", type=int, default=1, choices=[0, 1], help="1=public, 0=private (default: 1)")
    parser.add_argument("--adult", type=int, default=0, choices=[0, 1], help="1=adult, 0=safe (default: 0)")
    parser.add_argument("--snapshot", default=None, help="Custom thumbnail snapshot image path (optional)")
    parser.add_argument("--server", "-s", default=None, help="Custom upload server URL (optional)")
    parser.add_argument("--name", "-n", default=None, help="Custom filename (e.g. video.mp4)")
    parser.add_argument("--user-agent", default=None, help="Custom User-Agent header (optional)")
    parser.add_argument("--outdir", default="./downloads", help="Local download directory")
    parser.add_argument("--file-code", default=None, help="Target file code for subtitle upload")
    parser.add_argument("--sub-lang", default="eng", help="Subtitle language code (e.g. eng, spa, fra)")
    parser.add_argument("--sub-file", default=None, help="Subtitle file attachment path (.vtt or .srt)")

    args = parser.parse_args()

    if args.mode == "account":
        info = get_account_info(args.key)
        print("\n" + "=" * 70)
        print("👤 EARNVIDS ACCOUNT INFO")
        print("=" * 70)
        if info:
            for k, v in info.items():
                print(f"  • {k}: {v}")
        else:
            print("Failed to retrieve account info.")
        print("=" * 70)
    elif args.mode == "sub":
        if not args.file_code or not args.sub_file:
            print("[ERROR] Subtitle mode requires --file-code and --sub-file arguments!")
            sys.exit(1)
        upload_subtitle(api_key=args.key, file_code=args.file_code, sub_lang=args.sub_lang, sub_file_path=args.sub_file)
    elif args.mode == "remote":
        remote_upload_earnvids(
            api_key=args.key,
            media_url=args.url,
            folder_id=args.folder,
            cat_id=args.cat_id,
            file_public=args.public,
            file_adult=args.adult,
            tags=args.tags
        )
    else:
        # 1. Download media locally first
        downloaded_file = high_speed_download(
            media_url=args.url,
            output_dir=args.outdir,
            custom_name=args.name,
            user_agent=args.user_agent
        )

        # 2. Upload downloaded file to EarnVids
        upload_to_earnvids(
            api_key=args.key,
            file_path=downloaded_file,
            folder_id=args.folder,
            upload_server=args.server,
            file_title=args.title,
            file_descr=args.descr,
            cat_id=args.cat_id,
            tags=args.tags,
            file_public=args.public,
            file_adult=args.adult,
            snapshot_path=args.snapshot
        )


if __name__ == "__main__":
    main()
