# Video Upload & Download APIs (GitHub Actions & CLI)

Multi-threaded media downloaders and uploaders for **Luluvdo / LuluStream** and **EarnVids** powered by `yt-dlp`, `aria2c` (16 parallel threads), and GitHub Actions.

---

## 📁 Platforms & Directory Structure

```
.
├── .github/
│   └── workflows/
│       ├── luluvdo_downloader_uploader.yml       # Luluvdo GitHub Action
│       └── earnvids_downloader_uploader.yml       # EarnVids GitHub Action
├── earnvids/
│   ├── .github/workflows/
│   │   └── earnvids_downloader_uploader.yml
│   ├── earnvids_uploader.py                      # Multi-fragment downloader & uploader
│   ├── earnvidsapiinfo.txt                       # EarnVids API documentation
│   ├── README.md                                 # Standalone repo docs
│   └── requirements.txt
├── luluvodo/
│   ├── .github/workflows/
│   │   └── luluvdo_downloader_uploader.yml
│   ├── luluvdo_uploader.py                       # Multi-fragment downloader & uploader
│   ├── luluvdooapiinfo.txt                       # Luluvdo API documentation
│   ├── README.md                                 # Standalone repo docs
│   └── requirements.txt
├── README.md
└── requirements.txt
```

---

## 🚀 Running via GitHub Actions

### 1. EarnVids Uploader
1. Go to the **Actions** tab in this GitHub repository (or [`danka1567/earnvids`](https://github.com/danka1567/earnvids)).
2. Select **Download & Local Upload to EarnVids**.
3. Click **Run workflow** and enter your `media_url` and desired metadata.

### 2. Luluvdo Uploader
1. Go to the **Actions** tab.
2. Select **Download & Local Upload to Luluvdo**.
3. Click **Run workflow** and enter your `media_url`.

---

## 💻 Running Locally (CLI)

### EarnVids
```bash
cd earnvids
pip install -r requirements.txt

# Check account info
python earnvids_uploader.py --mode account

# High speed download and upload
python earnvids_uploader.py --url "<STREAM_OR_VIDEO_URL>" --title "My Video"
```

### Luluvdo
```bash
cd luluvodo
pip install -r requirements.txt

# High speed download and upload
python luluvdo_uploader.py --url "<STREAM_OR_VIDEO_URL>"
```
