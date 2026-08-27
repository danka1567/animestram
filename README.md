# Video Upload & Download APIs (GitHub Actions & CLI)

Multi-threaded media downloaders and uploaders for **FileMoon**, **Luluvdo / LuluStream**, and **EarnVids** powered by `yt-dlp`, `aria2c` (16 parallel threads), and GitHub Actions.

---

## 📁 Platforms & Directory Structure

```
.
├── .github/
│   └── workflows/
│       ├── filemoon_downloader_uploader.yml      # FileMoon GitHub Action
│       ├── luluvdo_downloader_uploader.yml       # Luluvdo GitHub Action
│       └── earnvids_downloader_uploader.yml      # EarnVids GitHub Action
├── filemoon/
│   ├── .github/workflows/
│   │   └── filemoon_downloader_uploader.yml
│   ├── filemoon_uploader.py                      # Multi-fragment downloader & uploader
│   ├── filemoonapiinfo.txt                       # FileMoon API documentation & keys
│   ├── README.md                                 # Standalone repo docs
│   └── requirements.txt
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

### 1. FileMoon Uploader
1. Go to the **Actions** tab.
2. Select **Download & Local Upload to FileMoon**.
3. Click **Run workflow** and enter your `media_url` and parameters.

### 2. EarnVids Uploader
1. Go to the **Actions** tab.
2. Select **Download & Local Upload to EarnVids**.
3. Click **Run workflow** and enter your `media_url` and desired metadata.

### 3. Luluvdo Uploader
1. Go to the **Actions** tab.
2. Select **Download & Local Upload to Luluvdo**.
3. Click **Run workflow** and enter your `media_url`.

---

## 💻 Running Locally (CLI)

### FileMoon
```bash
cd filemoon
pip install -r requirements.txt

# Check account info
python filemoon_uploader.py --mode account

# High speed download and upload
python filemoon_uploader.py --url "<STREAM_OR_VIDEO_URL>" --name "video.mp4"
```

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
