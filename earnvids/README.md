# EarnVids Media Downloader & Local Uploader (GitHub Action)

This workflow runs on GitHub Actions to download any media format (`.m3u8` / HLS, `.mp4`, `.mkv`, `.avi`, web streams) at **maximum speeds** using multi-connection engines (`yt-dlp` + `aria2c` with 16 parallel threads), and uploads it directly to EarnVids via the official API.

---

## 🚀 Features

- **Maximum Download Speed**: Multi-threaded downloader using `yt-dlp` & `aria2c` (16 parallel connections & 16 concurrent fragments for HLS/M3U8).
- **Hardcoded API Credentials**: Preconfigured with your EarnVids API key (`47202gy09k73xaina8y8t`).
- **Default Mode**: **Local file upload** (`local`) — Downloads the media to the runner disk and POSTs via multipart form data to the dynamic active EarnVids upload server.
- **Alternative Mode**: **Remote URL upload** (`remote`) — Sends the remote download URL directly to EarnVids API via `/api/upload/url`.
- **Subtitle Upload Support**: Upload subtitle files (`.vtt`, `.srt`) for any video code.
- **Metadata Support**: Customizable video title, description, category, tags, folder ID, and public/adult flags.

---

## 🎯 How to Run the Workflow

1. Go to the **Actions** tab in this GitHub repository.
2. Select **Download & Local Upload to EarnVids** on the left sidebar.
3. Click **Run workflow** and fill in:
   - **`media_url`** *(required)*: The direct media link or `.m3u8` stream.
   - **`upload_mode`** *(default: `local`)*: Choose `local` (default) or `remote`.
   - **`custom_filename`** *(optional)*: E.g., `video.mp4`.
   - **`file_title`** *(optional)*: Custom video title.
   - **`file_descr`** *(optional)*: Video description.
   - **`folder_id`** *(optional)*: Target folder ID (e.g. `25`).
   - **`category_id`** *(optional)*: Category ID (e.g. `5`).
   - **`tags`** *(optional)*: Comma-separated tags.
   - **`is_public`** *(default: `1`)*: 1 for public, 0 for private.
   - **`is_adult`** *(default: `0`)*: 1 for adult, 0 for safe.
   - **`user_agent`** *(optional)*: Custom User-Agent header for protected streams.
4. Click **Run workflow**.

---

## 💻 Local CLI Usage

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Check Account Info
python earnvids_uploader.py --mode account

# 3. Download & Upload Video
python earnvids_uploader.py --url "https://example.com/video.m3u8" --title "My Movie" --public 1

# 4. Remote Upload (API Server will fetch directly)
python earnvids_uploader.py --mode remote --url "https://example.com/video.mp4"
```
