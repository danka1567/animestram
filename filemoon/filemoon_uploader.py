#!/usr/bin/env python3
"""
FileMoon Ultra-Fast Downloader & Local / Remote Uploader
Downloads any M3U8, HLS stream, MP4, MKV, etc. at maximum speed and uploads directly to FileMoon API.
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
# FileMoon Bearer Token / API Key
FILEMOON_API_KEY = "71|LtVJvuDc9cj9e6VDKd40XBbh1FQYfEJ22JbqCPtc"
# FileMoon API Base URL
API_BASE_URL = "https://filemoon.org/api/v1"
# =========================================================

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


def get_auth_headers(api_key: str) -> dict:
    """Returns standard authorization headers for FileMoon API."""
    headers = DEFAULT_HEADERS.copy()
    headers["Authorization"] = f"Bearer {api_key.strip()}"
    return headers


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


def get_account_info(api_key: str):
    """Fetches user account details and storage info from FileMoon."""
    url = f"{API_BASE_URL}/account"
    headers = get_auth_headers(api_key)
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to fetch account info: {e}")
        return None


def list_files(api_key: str, search: str = None, page: int = 1, per_page: int = 25):
    """Fetches paginated list of owned files on FileMoon."""
    url = f"{API_BASE_URL}/files"
    headers = get_auth_headers(api_key)
    params = {"page": page, "per_page": per_page}
    if search:
        params["search"] = search
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to list files: {e}")
        return None


def get_file_info(api_key: str, file_id: str):
    """Fetches info of a specific file on FileMoon."""
    url = f"{API_BASE_URL}/files/{file_id}"
    headers = get_auth_headers(api_key)
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to get file info for {file_id}: {e}")
        return None


def get_file_status(api_key: str, file_id: str):
    """Fetches conversion / HLS status for a file on FileMoon."""
    url = f"{API_BASE_URL}/files/{file_id}/status"
    headers = get_auth_headers(api_key)
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to get file status for {file_id}: {e}")
        return None


def upload_to_filemoon(api_key: str, file_path: Path, visibility: int = 1):
    """
    Performs local file multipart upload directly to FileMoon API.
    """
    print("\n" + "=" * 70)
    print("📤 [2/2] STARTING LOCAL FILE UPLOAD TO FILEMOON")
    print("=" * 70)

    upload_endpoint = f"{API_BASE_URL}/files/upload"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Accept": "application/json",
        "User-Agent": DEFAULT_HEADERS["User-Agent"]
    }
    print(f"Target Upload Endpoint: {upload_endpoint}")
    print(f"Target File: {file_path.name} ({format_size(file_path.stat().st_size)})")

    post_data = {
        "visibility": str(visibility)
    }

    start_time = time.time()
    with ProgressFileReader(file_path) as reader:
        resp = requests.post(
            upload_endpoint,
            data=post_data,
            files={"file": (file_path.name, reader)},
            headers=headers,
            timeout=7200
        )

    elapsed = time.time() - start_time
    print(f"\nUpload request finished in {elapsed:.2f}s.")

    try:
        data = resp.json()
    except Exception:
        print(f"Raw Response ({resp.status_code}): {resp.text}")
        return None

    # Parse response
    if resp.status_code in [200, 201] and data.get("success"):
        file_info = data.get("data", {})
        file_id = file_info.get("id")
        file_name = file_info.get("name") or file_path.name
        urls = file_info.get("urls", {})
        page_url = urls.get("page") or f"https://filemoon.org/{file_id}/file" if file_id else None
        watch_url = urls.get("watch") or f"https://filemoon.org/{file_id}/watch" if file_id else None
        embed_url = urls.get("embed") or f"https://filemoon.org/{file_id}/embed" if file_id else None

        print("\n" + "=" * 70)
        print("🎉 SUCCESS: FILE UPLOADED TO FILEMOON 🎉")
        print(f"  • File Name:   {file_name}")
        print(f"  • File ID:     {file_id}")
        if page_url:
            print(f"  • Page Link:   {page_url}")
        if watch_url:
            print(f"  • Watch Link:  {watch_url}")
        if embed_url:
            print(f"  • Embed Link:  {embed_url}")
        print("=" * 70 + "\n")
        return data
    else:
        print(f"\nResponse: {data}")
        return data


def update_file(api_key: str, file_id: str, name: str = None, description: str = None,
                visibility: bool = None, allow_online_watch: bool = None, password: str = None):
    """Updates metadata of an owned file on FileMoon."""
    url = f"{API_BASE_URL}/files/{file_id}"
    headers = get_auth_headers(api_key)
    headers["Content-Type"] = "application/json"
    
    payload = {}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if visibility is not None:
        payload["visibility"] = visibility
    if allow_online_watch is not None:
        payload["allow_online_watch"] = allow_online_watch
    if password is not None:
        payload["password"] = password

    try:
        resp = requests.patch(url, headers=headers, json=payload, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to update file {file_id}: {e}")
        return None


def delete_file(api_key: str, file_id: str):
    """Permanently deletes an owned file on FileMoon."""
    url = f"{API_BASE_URL}/files/{file_id}"
    headers = get_auth_headers(api_key)
    try:
        resp = requests.delete(url, headers=headers, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to delete file {file_id}: {e}")
        return None


def remote_upload_filemoon(api_key: str, urls: list[str], name: str = None, description: str = None,
                          folder_id: int = None, visibility: bool = True, allow_online_watch: bool = True,
                          password: str = None, blocked_countries: list[str] = None):
    """Queues one or more direct media URLs for remote upload on FileMoon."""
    print("\n" + "=" * 70)
    print("🌐 INITIATING REMOTE UPLOAD JOB ON FILEMOON API")
    print(f"URLs: {urls}")
    print("=" * 70)

    url = f"{API_BASE_URL}/remote-uploads"
    headers = get_auth_headers(api_key)
    headers["Content-Type"] = "application/json"

    payload = {
        "urls": urls,
        "visibility": visibility,
        "allow_online_watch": allow_online_watch
    }
    if name:
        payload["name"] = name
    if description:
        payload["description"] = description
    if folder_id:
        payload["folder_id"] = folder_id
    if password:
        payload["password"] = password
    if blocked_countries:
        payload["blocked_countries"] = blocked_countries

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
        data = resp.json()
        print(f"Response ({resp.status_code}): {data}")
        if data.get("success") and "data" in data:
            print("\n" + "=" * 70)
            print("✅ REMOTE UPLOAD JOB(S) QUEUED SUCCESSFULLY")
            for job in data["data"]:
                print(f"  • Job ID:  {job.get('id')}")
                print(f"  • Host:    {job.get('host')}")
                print(f"  • Name:    {job.get('name')}")
                print(f"  • Status:  {job.get('status')}")
            print("=" * 70 + "\n")
        return data
    except Exception as e:
        print(f"[ERROR] Failed to initiate remote upload: {e}")
        return None


def list_remote_uploads(api_key: str, page: int = 1, per_page: int = 25):
    """Lists remote upload jobs on FileMoon."""
    url = f"{API_BASE_URL}/remote-uploads"
    headers = get_auth_headers(api_key)
    params = {"page": page, "per_page": per_page}
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to list remote upload jobs: {e}")
        return None


def get_remote_upload_status(api_key: str, job_id: str):
    """Gets status of a specific remote upload job."""
    url = f"{API_BASE_URL}/remote-uploads/{job_id}"
    headers = get_auth_headers(api_key)
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to get remote job status for {job_id}: {e}")
        return None


def cancel_remote_upload(api_key: str, job_id: str):
    """Cancels a pending or running remote upload job."""
    url = f"{API_BASE_URL}/remote-uploads/{job_id}/cancel"
    headers = get_auth_headers(api_key)
    try:
        resp = requests.post(url, headers=headers, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to cancel remote job {job_id}: {e}")
        return None


def retry_remote_upload(api_key: str, job_id: str):
    """Retries a failed remote upload job."""
    url = f"{API_BASE_URL}/remote-uploads/{job_id}/retry"
    headers = get_auth_headers(api_key)
    try:
        resp = requests.post(url, headers=headers, timeout=20)
        return resp.json()
    except Exception as e:
        print(f"[ERROR] Failed to retry remote job {job_id}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Download any media/m3u8 and upload locally or remotely to FileMoon API.")
    parser.add_argument("--url", "-u", default="https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/big_buck_bunny.mp4", help="Media/Stream URL (default: Big Buck Bunny sample)")
    parser.add_argument("--mode", "-m", choices=[
        "local", "remote", "account", "list", "info", "status", 
        "update", "delete", "remote-list", "remote-status", "remote-cancel", "remote-retry"
    ], default="local", help="Operation mode (default: local)")
    parser.add_argument("--key", "-k", default=os.getenv("FILEMOON_API_KEY", FILEMOON_API_KEY), help="FileMoon Bearer Token / API Key")
    parser.add_argument("--folder", "-f", type=int, default=None, help="FileMoon Target Folder ID (optional integer)")
    parser.add_argument("--name", "-n", default=None, help="Custom filename or title (e.g. video.mp4)")
    parser.add_argument("--descr", "-d", default=None, help="File description (optional)")
    parser.add_argument("--visibility", type=int, choices=[0, 1], default=1, help="Visibility: 1=public, 0=private (default: 1)")
    parser.add_argument("--allow-watch", type=int, choices=[0, 1], default=1, help="Allow online watch: 1=true, 0=false (default: 1)")
    parser.add_argument("--password", default=None, help="File password protection (optional)")
    parser.add_argument("--blocked-countries", default=None, help="Comma-separated country codes to block (e.g. US,GB)")
    parser.add_argument("--file-id", default=None, help="File ID for info, status, update, or delete")
    parser.add_argument("--job-id", default=None, help="Job UUID for remote-status, remote-cancel, or remote-retry")
    parser.add_argument("--search", "-s", default=None, help="Search query for listing files")
    parser.add_argument("--page", type=int, default=1, help="Page number for pagination (default: 1)")
    parser.add_argument("--per-page", type=int, default=25, help="Results per page (default: 25, max: 100)")
    parser.add_argument("--user-agent", default=None, help="Custom User-Agent header for download (optional)")
    parser.add_argument("--outdir", default="./downloads", help="Local download directory")

    args = parser.parse_args()

    if args.mode == "account":
        res = get_account_info(args.key)
        print("\n" + "=" * 70)
        print("👤 FILEMOON ACCOUNT INFO")
        print("=" * 70)
        if res and res.get("success"):
            data = res.get("data", {})
            for k, v in data.items():
                if k == "storage_bytes":
                    print(f"  • {k}: {v} ({format_size(v)})")
                else:
                    print(f"  • {k}: {v}")
        else:
            print(f"Failed to retrieve account info: {res}")
        print("=" * 70)

    elif args.mode == "list":
        res = list_files(args.key, search=args.search, page=args.page, per_page=args.per_page)
        print("\n" + "=" * 70)
        print("📁 FILEMOON FILES LIST")
        print("=" * 70)
        if res and res.get("success"):
            files = res.get("data", [])
            meta = res.get("meta", {})
            print(f"Total files: {meta.get('total', len(files))} (Page {meta.get('current_page', 1)}/{meta.get('last_page', 1)})\n")
            for f in files:
                print(f"  • [{f.get('id')}] {f.get('name')} ({format_size(f.get('size_bytes', 0))})")
                urls = f.get("urls", {})
                if urls.get("watch"):
                    print(f"    Watch: {urls.get('watch')}")
        else:
            print(f"Failed to list files: {res}")
        print("=" * 70)

    elif args.mode == "info":
        if not args.file_id:
            print("[ERROR] --file-id is required for info mode.")
            sys.exit(1)
        res = get_file_info(args.key, args.file_id)
        print("\n" + "=" * 70)
        print(f"📄 FILE INFO: {args.file_id}")
        print("=" * 70)
        print(res)

    elif args.mode == "status":
        if not args.file_id:
            print("[ERROR] --file-id is required for status mode.")
            sys.exit(1)
        res = get_file_status(args.key, args.file_id)
        print("\n" + "=" * 70)
        print(f"📊 FILE & HLS CONVERSION STATUS: {args.file_id}")
        print("=" * 70)
        print(res)

    elif args.mode == "update":
        if not args.file_id:
            print("[ERROR] --file-id is required for update mode.")
            sys.exit(1)
        res = update_file(
            api_key=args.key,
            file_id=args.file_id,
            name=args.name,
            description=args.descr,
            visibility=bool(args.visibility) if args.visibility is not None else None,
            allow_online_watch=bool(args.allow_watch) if args.allow_watch is not None else None,
            password=args.password
        )
        print(f"Update response: {res}")

    elif args.mode == "delete":
        if not args.file_id:
            print("[ERROR] --file-id is required for delete mode.")
            sys.exit(1)
        res = delete_file(args.key, args.file_id)
        print(f"Delete response: {res}")

    elif args.mode == "remote":
        blocked_list = [c.strip() for c in args.blocked_countries.split(",")] if args.blocked_countries else None
        remote_upload_filemoon(
            api_key=args.key,
            urls=[args.url],
            name=args.name,
            description=args.descr,
            folder_id=args.folder,
            visibility=bool(args.visibility),
            allow_online_watch=bool(args.allow_watch),
            password=args.password,
            blocked_countries=blocked_list
        )

    elif args.mode == "remote-list":
        res = list_remote_uploads(args.key, page=args.page, per_page=args.per_page)
        print(f"Remote Upload Jobs: {res}")

    elif args.mode == "remote-status":
        if not args.job_id:
            print("[ERROR] --job-id is required for remote-status mode.")
            sys.exit(1)
        res = get_remote_upload_status(args.key, args.job_id)
        print(f"Remote Job Status: {res}")

    elif args.mode == "remote-cancel":
        if not args.job_id:
            print("[ERROR] --job-id is required for remote-cancel mode.")
            sys.exit(1)
        res = cancel_remote_upload(args.key, args.job_id)
        print(f"Remote Cancel Response: {res}")

    elif args.mode == "remote-retry":
        if not args.job_id:
            print("[ERROR] --job-id is required for remote-retry mode.")
            sys.exit(1)
        res = retry_remote_upload(args.key, args.job_id)
        print(f"Remote Retry Response: {res}")

    else:
        # Default: Local download + upload
        # 1. Download media locally first
        downloaded_file = high_speed_download(
            media_url=args.url,
            output_dir=args.outdir,
            custom_name=args.name,
            user_agent=args.user_agent
        )

        # 2. Upload downloaded file to FileMoon
        upload_to_filemoon(
            api_key=args.key,
            file_path=downloaded_file,
            visibility=args.visibility
        )


if __name__ == "__main__":
    main()
