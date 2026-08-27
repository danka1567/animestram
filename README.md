# Media Downloader & Uploader (GitHub Actions & CLI)

Multi-threaded media downloader and uploader for **Luluvdo** and **Streamtape** powered by `yt-dlp`, `aria2c`, and GitHub Actions.

---

## 📁 Repository Structure

```
.
├── .github/
│   └── workflows/
│       ├── luluvdo_downloader_uploader.yml       # Luluvdo GitHub Action
│       └── streamtape_downloader_uploader.yml   # Streamtape GitHub Action
├── luluvodo/
│   ├── luluvdo_uploader.py                      # Luluvdo CLI uploader script
│   ├── luluvdooapiinfo.txt                      # Luluvdo API reference
│   ├── README.md                                # Luluvdo documentation
│   └── requirements.txt
├── streamtape/
│   ├── streamtape_uploader.py                   # Streamtape CLI uploader script
│   ├── README.md                                # Streamtape documentation
│   └── requirements.txt
└── requirements.txt
```

---

## 🚀 Running via GitHub Actions

1. Go to the **Actions** tab in this repository.
2. Select your desired workflow on the left:
   - **Download & Local Upload to Luluvdo**
   - **Download & Local Upload to Streamtape**
3. Click **Run workflow** and provide:
   - `media_url` *(required)*: Direct video URL or M3U8/HLS stream URL.
   - `custom_filename` *(optional)*: E.g., `video.mp4`.
   - `folder_id` *(optional)*: Target folder ID.
   - `upload_mode` *(optional, for Luluvdo)*: `local` (default) or `remote`.
   - `user_agent` *(optional)*: Custom User-Agent header for protected streams.
4. Click **Run workflow**.
