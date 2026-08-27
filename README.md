# Luluvdo Media Downloader & Uploader (GitHub Action & CLI)

Multi-threaded media downloader and uploader for **Luluvdo / LuluStream** powered by `yt-dlp`, `aria2c`, and GitHub Actions.

---

## 📁 Repository Structure

```
.
├── .github/
│   └── workflows/
│       └── luluvdo_downloader_uploader.yml       # Luluvdo GitHub Action
├── luluvodo/
│   ├── .github/workflows/
│   │   └── luluvdo_downloader_uploader.yml
│   ├── luluvdo_uploader.py                      # Multi-fragment downloader & uploader
│   ├── luluvdooapiinfo.txt                      # API reference documentation
│   ├── README.md                                # Platform documentation
│   └── requirements.txt                         # Dependencies
├── README.md
└── requirements.txt
```

---

## 🚀 Running via GitHub Actions

1. Go to the **Actions** tab in this GitHub repository.
2. Select **Download & Local Upload to Luluvdo** on the left sidebar.
3. Click **Run workflow** and fill in:
   - **`media_url`** *(required)*: The direct media link or `.m3u8` stream.
   - **`upload_mode`** *(default: `local`)*: Choose `local` (download to runner & upload) or `remote`.
   - **`custom_filename`** *(optional)*: E.g., `video.mp4`.
   - **`folder_id`** *(optional)*: Target folder ID.
   - **`user_agent`** *(optional)*: Custom User-Agent header if required by protected streams.
4. Click **Run workflow**.

---

## 💻 Running Locally (CLI)

```bash
cd luluvodo
pip install -r requirements.txt

# Download and upload local mode
python luluvdo_uploader.py --url "<STREAM_OR_VIDEO_URL>"

# Remote upload mode (direct URL to Luluvdo API)
python luluvdo_uploader.py --url "<VIDEO_URL>" --mode remote
```
