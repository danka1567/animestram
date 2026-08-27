# Luluvdo / LuluStream Media Downloader & Local Uploader (GitHub Action)

This workflow runs on GitHub Actions to download any media format (`.m3u8` / HLS, `.mp4`, `.mkv`, `.avi`, web streams) at **maximum speeds** using multi-connection engines (`yt-dlp` + `aria2c` with 16 parallel threads), and uploads it directly to Luluvdo / LuluStream via the API.

---

## 🚀 Features

- **Maximum Download Speed**: Multi-threaded downloader using `yt-dlp` & `aria2c` (16 parallel connections & 16 concurrent fragments for HLS/M3U8).
- **Hardcoded API Credentials**: Preconfigured with your Luluvdo API key.
- **Default Mode**: **Local file upload** (`local`) — Downloads the media to the runner disk and POSTs via multipart form data (`file_0=@...`) to the active upload server endpoint.
- **Alternative Mode**: **Remote upload** (`remote`) — Sends the remote download URL directly to Luluvdo API via `/api/upload/url`.

---

## 🎯 How to Run the Workflow

1. Go to the **Actions** tab in this GitHub repository.
2. Select **Download & Local Upload to Luluvdo** on the left sidebar.
3. Click **Run workflow** and fill in:
   - **`media_url`** *(required)*: The direct media link or `.m3u8` stream.
   - **`upload_mode`** *(default: `local`)*: Choose `local` (default) or `remote`.
   - **`custom_filename`** *(optional)*: E.g., `video.mp4`.
   - **`folder_id`** *(optional)*: Target folder ID.
   - **`user_agent`** *(optional)*: Custom User-Agent header if required by protected streams.
4. Click **Run workflow**.
