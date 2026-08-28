# KuroStream — Anime Streaming Web App

A modern, responsive anime streaming web client with MyAnimeList (MAL) data integration and FlixCloud video streaming server.

## 🚀 Live Demo
- **Website**: [https://danka1567.github.io/animestram/](https://danka1567.github.io/animestram/)
- **Direct Stream Example**: [https://danka1567.github.io/animestram/?mal_id=1735&ep=250&lang=dub](https://danka1567.github.io/animestram/?mal_id=1735&ep=250&lang=dub)

---

## ⚡ Features

- **FlixCloud Video Stream Iframe**: Seamlessly embeds and streams episodes with `?mal_id={id}&ep={ep}&lang={sub|dub}`.
- **SUB & DUB Switcher**: Instant switching between Japanese audio with subtitles and English dubbing.
- **Episode Navigator**: Next/Prev episode buttons, episode number input jump, and paginated selector tabs for 1000+ episode series (e.g. One Piece, Naruto).
- **MyAnimeList API (Jikan v4)**:
  - Live debounce search with autocomplete preview cards.
  - Seasonal trending and all-time top-rated anime grids.
  - Genre filter chips (Action, Adventure, Fantasy, Romance, Sci-Fi, etc.).
  - Direct MAL ID stream loader modal.
- **Local Storage Persistence**:
  - "Continue Watching" history with auto-resume.
  - "Watchlist" bookmarks.
- **Deep Linking**: Shareable URL parameters (`?mal_id=1735&ep=250&lang=dub`).

---

## 📂 Project Structure

```text
├── index.html        # Main HTML layout & video player
├── style.css         # Cyberpunk neon dark theme styling
├── app.js            # Jikan API client, stream controller & state
└── README.md         # Documentation
```

---

## 🛠️ Deploy to GitHub Pages

1. In your GitHub repository, go to **Settings** → **Pages**.
2. Set Source to **Deploy from a branch**.
3. Select **main** branch and `/ (root)` folder, then click **Save**.
4. Your website will be available at `https://<username>.github.io/animestram/`.
