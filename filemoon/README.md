# FileMoon Video Downloader & Uploader

Ultra-fast multi-threaded media downloader and uploader for **FileMoon** powered by `yt-dlp`, `aria2c` (16 parallel threads), and GitHub Actions / CLI.

---

## 📁 Directory Structure

```
filemoon/
├── .github/workflows/
│   └── filemoon_downloader_uploader.yml   # FileMoon GitHub Action
├── filemoon_uploader.py                  # High-speed downloader & local/remote uploader
├── filemoonapiinfo.txt                   # FileMoon API documentation & account details
├── requirements.txt                      # Dependencies (requests, yt-dlp)
└── README.md                             # Documentation
```

---

## 🔑 Authentication & Configuration

The script includes the hardcoded API token:
- **API Token**: `71|LtVJvuDc9cj9e6VDKd40XBbh1FQYfEJ22JbqCPtc`
- **Base URL**: `https://filemoon.org/api/v1`

You can also override the API token via the environment variable `FILEMOON_API_KEY` or `--key` CLI argument.

---

## 💻 Running Locally (CLI)

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Check Account Info
```bash
python filemoon_uploader.py --mode account
```

### 3. High Speed Download & Local Upload
Downloads any HLS / M3U8 / MP4 stream locally with 16 parallel threads and uploads to FileMoon:
```bash
python filemoon_uploader.py --url "https://example.com/video.m3u8" --name "my_video.mp4"
```

### 4. Direct Remote Upload (Server-to-Server)
Queues video URLs directly on FileMoon's servers:
```bash
python filemoon_uploader.py --mode remote --url "https://cdn.example.com/video.mp4" --name "my_video.mp4"
```

### 5. List Files
```bash
python filemoon_uploader.py --mode list
```

### 6. Get File Info & Conversion / HLS Status
```bash
python filemoon_uploader.py --mode info --file-id <FILE_ID>
python filemoon_uploader.py --mode status --file-id <FILE_ID>
```

### 7. Update File Details
```bash
python filemoon_uploader.py --mode update --file-id <FILE_ID> --name "New Title" --descr "Description"
```

### 8. Delete File
```bash
python filemoon_uploader.py --mode delete --file-id <FILE_ID>
```

---

## 🚀 Running via GitHub Actions

1. Go to the **Actions** tab in your GitHub repository.
2. Select **Download & Local Upload to FileMoon**.
3. Click **Run workflow**, enter your `media_url` and optional metadata (name, folder ID, visibility).
4. Click **Run** to execute download and upload automatically on GitHub cloud runners.
