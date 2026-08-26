# Streamtape Media Downloader & Uploader (GitHub Action)

This workflow runs on GitHub Actions to download any media format (`.m3u8` / HLS, `.mp4`, `.mkv`, `.avi`, web streams) at **maximum speeds** using multi-connection engines (`yt-dlp` + `aria2c` with 16 parallel threads), and uploads it to Streamtape via the Host API.

---

## 🚀 Features

- **Maximum Download Speed**: Uses `yt-dlp` backed with `aria2c` multi-threading (16 parallel connections/streams, 16 concurrent fragments for HLS/M3U8) leveraging GitHub's multi-gigabit bandwidth.
- **Universal Format Support**: Direct `.mp4`, `.mkv`, `.webm`, `.ts`, `.m3u8` HLS playlists, YouTube/Vimeo/other supported extractor streams.
- **Default Mode**: **Local file upload** (`local`) — Downloads the media to the runner disk and POSTs via multipart form data (`file1=@...`) to the Streamtape upload endpoint.
- **Alternative Mode**: **Remote upload** (`remote`) — Sends the remote download URL directly to Streamtape API via `/remotedl/add`.
- **Customization**: Option to specify target folder IDs, custom output filenames, and custom User-Agents/Headers for protected streams.

---

## ⚙️ Setup Instructions

### 1. Set GitHub Repository Secrets
Go to your GitHub repository:
**Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ **New repository secret**

Add two secrets:
1. `STREAMTAPE_LOGIN`: Your Streamtape API Login (from your Streamtape Account Settings).
2. `STREAMTAPE_KEY`: Your Streamtape API Key / API Password.

---

## 🎯 How to Run the Workflow

1. Go to the **Actions** tab in your GitHub repository.
2. Select **Download & Upload to Streamtape** on the left sidebar.
3. Click **Run workflow** and fill in the input fields:
   - **`media_url`** *(required)*: The direct media link or `.m3u8` stream.
   - **`upload_mode`** *(default: `local`)*: Choose `local` (default) or `remote`.
   - **`custom_filename`** *(optional)*: E.g., `movie.mp4`.
   - **`folder_id`** *(optional)*: Streamtape folder ID to upload into.
   - **`user_agent`** *(optional)*: Custom User-Agent header if needed.
4. Click **Run workflow**.

---

## 📁 File Structure

```
.github/
  └── workflows/
      └── streamtape_downloader_uploader.yml
```
