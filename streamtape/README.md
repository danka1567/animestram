# Streamtape Video Downloader & Uploader

Ultra-fast multi-threaded media downloader and uploader for **Streamtape** powered by `yt-dlp`, `aria2c` (16 parallel threads), and GitHub Actions / CLI.

---

## 📁 Directory Structure

```
streamtape/
├── .github/workflows/
│   └── streamtape_downloader_uploader.yml # Streamtape GitHub Action
├── streamtape_uploader.py                # High-speed downloader & local/remote uploader
├── streamtapeapiinfo.txt                 # Streamtape API documentation & account details
├── requirements.txt                      # Dependencies (requests, yt-dlp)
└── README.md                             # Documentation
```

---

## 🔑 Authentication & Configuration

The script includes the hardcoded API credentials:
- **API Login**: `59484016637a23331603`
- **API Key**: `lgWOyYK90XC7xLd`
- **Base URL**: `https://api.streamtape.com`

You can also override the API credentials via environment variables `STREAMTAPE_LOGIN` and `STREAMTAPE_KEY` or `--login` and `--key` CLI arguments.

---

## 💻 Running Locally (CLI)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Check Account Info
```bash
python streamtape_uploader.py --mode account
```

### 3. High Speed Download & Local Upload
Downloads any HLS / M3U8 / MP4 stream locally with 16 parallel threads and uploads to Streamtape:
```bash
python streamtape_uploader.py --url "https://example.com/video.m3u8" --name "my_video.mp4"
```

### 4. Direct Remote Upload (Server-to-Server)
Queues video URLs directly on Streamtape's servers:
```bash
python streamtape_uploader.py --mode remote --url "https://cdn.example.com/video.mp4" --name "my_video.mp4"
```

### 5. List Files & Folders
```bash
python streamtape_uploader.py --mode list
```

---

## 🚀 Running via GitHub Actions

1. Go to the **Actions** tab in your GitHub repository.
2. Select **Download & Local Upload to Streamtape**.
3. Click **Run workflow**, enter your `media_url` and optional parameters (name, folder ID).
4. Click **Run** to execute download and upload automatically on GitHub cloud runners.
