/**
 * ============================================================================
 *  ani · Unified Multi-Server Stream Player — Cloudflare Worker
 *  Providers: MegaPlay · FlixCloud · AniSnatch · AnimeGG · AniDB
 *
 *  Routes:
 *    GET  /                        → Responsive Multi-Server Player HTML
 *    GET  /:malId/:ep[/:lang]      → Direct Deep Link to Player HTML
 *    GET  /m3u8?url=               → SWR HLS manifest proxy (rewrites playlists, keys, & segments)
 *    GET  /segment?url=            → Cached HLS segment proxy (Range headers & MIME fixes)
 *    GET  /txt?url=                → Text manifest proxy
 *    GET  /proxy?url=&referer=     → Universal CORS & byte-range media stream proxy
 *    GET  /api/merged              → Unified Multi-Server Stream Extractor API (?mal_id=&ep=&provider=&lang=)
 *    GET  /api/streams             → MegaPlay live extractor API (?mal_id=&ep=&lang=)
 *    GET  /api/cached              → MegaPlay DB cached lookup API (?mal_id=&ep=)
 *    GET  /api/sources             → MegaPlay raw sources API (?id=)
 *    GET  /api/anisnatch           → AniSnatch database extractor API (?mal_id=&ep=&lang=)
 *    GET  /api/flixcloud           → FlixCloud extractor API (?mal_id=&ep=&lang=)
 *    GET  /api/animegg             → AnimeGG extractor API (?mal_id=&ep=&lang=)
 *    GET  /api/anidb               → AniDB extractor API (?mal_id=&ep=&lang=)
 *    GET  /api/health              → Health check endpoint
 *    OPTIONS *                     → CORS preflight
 * ============================================================================
 */

/* ─── Global Constants ─── */
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MEGAPLAY_REFERER  = 'https://megaplay.buzz/';
const MEGAPLAY_ORIGIN   = 'https://megaplay.buzz';
const FLIXCLOUD_REFERER = 'https://flixcloud.cc/';
const ANIMEGG_REFERER   = 'https://www.animegg.org/';
const ANISNATCH_REFERER = 'https://anisnatch.top/';
const ANIDB_BASE        = 'https://anidb.app';
const ANIDB_REFERER     = 'https://anidb.app/';

const SEGMENT_CACHE_TTL      = 60 * 60 * 6; // 6 hours
const PLAYLIST_CACHE_TTL     = 2;          // 2 seconds
const PLAYLIST_SWR_WINDOW    = 4;          // 4 seconds
const PREFETCH_SEGMENT_COUNT = 6;
const PREFETCH_CONCURRENCY   = 6;

const MEGAPLAY_DB_URL =
  'https://raw.githubusercontent.com/donkarboy/megaplay-extractor-updated/refs/heads/main/streams/megaplay_stream.json';

const ANISNATCH_JSON_BASE =
  'https://raw.githubusercontent.com/donkarboy/anisantch_top/refs/heads/main/';
const ANISNATCH_JSON_FILES = Array.from({ length: 15 }, (_, i) =>
  i === 0 ? 'streams.json' : `streams_${i + 1}.json`
);
const ANISNATCH_Q_TIERS = [480, 720, 1080, 360];

const ANIMEGG_PREEXTRACTED_URL =
  'https://raw.githubusercontent.com/ytbro8326-sudo/animegg_streams-extractor/refs/heads/main/output/animegg_streams.json';
const ANIMEGG_DATASET_URLS = [
  'https://raw.githubusercontent.com/dokkarrr/final_animgeg_embed-scraper/refs/heads/main/output/animegg_series.json',
  'https://raw.githubusercontent.com/dokkarrr/final_animgeg_embed-scraper/refs/heads/main/output/animegg_series2.json',
  'https://raw.githubusercontent.com/dokkarrr/final_animgeg_embed-scraper/refs/heads/main/output/animegg_series3.json',
  'https://raw.githubusercontent.com/dokkarrr/final_animgeg_embed-scraper/refs/heads/main/output/animegg_series4.json',
  'https://raw.githubusercontent.com/dokkarrr/final_animgeg_embed-scraper/refs/heads/main/output/animegg_series5.json',
  'https://raw.githubusercontent.com/dokkarrr/final_animgeg_embed-scraper/refs/heads/main/output/animegg_series6.json'
];

const REANIME_FLIX_API = 'https://reanime.to/api/flix';

// ═══════════════════════════════════════════════════════════════════════════════
//  FRONTEND HTML (Responsive Multi-Server Player with Right-Side Panel)
// ═══════════════════════════════════════════════════════════════════════════════
const HTML = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>ani · Multi-Server Anime Player</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"><\/script>
    <style>
        *,
        *::before,
        *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        :root {
            --bg-base: #09090f;
            --bg-topbar: #101018;
            --bg-card: #161622;
            --bg-card-hover: #1e1e30;
            --bg-card-active: #242240;
            --border: #212132;
            --border-hover: #363650;
            --border-active: #7c6dfa;
            --accent: #7c6dfa;
            --accent-hover: #6a5be0;
            --accent-glow: rgba(124, 109, 250, 0.28);
            --text-main: #f2f2fa;
            --text-sub: #8c8ca4;
            --text-muted: #5c5c74;
            --green: #34d399;
            --green-glow: rgba(52, 211, 153, 0.2);
            --cyan: #38bdf8;
            --cyan-glow: rgba(56, 189, 248, 0.2);
            --pink: #f472b6;
            --pink-glow: rgba(244, 114, 182, 0.2);
            --orange: #fb923c;
            --orange-glow: rgba(251, 146, 60, 0.2);
        }

        html,
        body {
            width: 100%;
            height: 100%;
            background: var(--bg-base);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            color: var(--text-main);
            overflow: hidden;
            -webkit-tap-highlight-color: transparent;
        }

        #app {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
            position: relative;
        }

        /* ── COMPACT TOPBAR ─────────────────────────────────── */
        #topbar {
            position: relative;
            display: flex;
            align-items: center;
            padding: 4px 10px;
            min-height: 38px;
            background: var(--bg-topbar);
            border-bottom: 1px solid var(--border);
            flex-shrink: 0;
            z-index: 50;
        }

        #topbar-inner {
            display: flex;
            align-items: center;
            gap: 7px;
            flex-wrap: wrap;
            width: 100%;
            max-height: 500px;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            transition: max-height .28s cubic-bezier(0.4, 0, 0.2, 1), padding .28s ease, opacity .2s ease;
            padding: 1px 0;
        }

        #topbar-inner.collapsed {
            max-height: 0;
            padding: 0;
            overflow: hidden;
            opacity: 0;
            pointer-events: none;
        }

        /* ── BRAND LOGO (ani) ───────────────────────────────── */
        .brand {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            cursor: pointer;
            user-select: none;
            flex-shrink: 0;
            padding-right: 4px;
            text-decoration: none;
        }

        .brand-text {
            font-size: 13px;
            font-weight: 800;
            letter-spacing: -0.04em;
            text-transform: lowercase;
            background: linear-gradient(135deg, #a78bfa 0%, #7c6dfa 50%, #f472b6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .brand-dot {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: var(--pink);
            display: inline-block;
            box-shadow: 0 0 6px var(--pink);
        }

        /* ── FIELD GROUPS (MAL ID & EP) ─────────────────────── */
        .field-group {
            display: flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
        }

        .field-group label {
            font-size: 10px;
            font-weight: 700;
            color: var(--text-sub);
            text-transform: uppercase;
            letter-spacing: .05em;
            white-space: nowrap;
        }

        .field-group input {
            width: 54px;
            height: 26px;
            padding: 2px 6px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 5px;
            color: var(--text-main);
            font-size: 11.5px;
            font-weight: 600;
            font-family: 'JetBrains Mono', monospace;
            outline: none;
            transition: border-color .15s, box-shadow .15s;
            text-align: center;
        }

        .field-group input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-glow);
        }

        /* ── COMPACT SEGMENTED GROUPS ───────────────────────── */
        .segmented-group {
            display: flex;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 6px;
            overflow: hidden;
            flex-shrink: 0;
            height: 26px;
        }

        .segmented-group button {
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 600;
            border: none;
            background: transparent;
            color: var(--text-sub);
            cursor: pointer;
            transition: background .15s, color .15s;
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .segmented-group button:hover {
            color: var(--text-main);
            background: rgba(255, 255, 255, 0.04);
        }

        .segmented-group button.active {
            background: var(--accent);
            color: #fff;
            box-shadow: 0 1px 4px var(--accent-glow);
        }

        /* ── AUTO-NEXT COMPACT ──────────────────────────────── */
        #autonext-wrap {
            display: flex;
            align-items: center;
            gap: 5px;
            flex-shrink: 0;
        }

        #autonext-wrap span {
            font-size: 10px;
            font-weight: 600;
            color: var(--text-sub);
            text-transform: uppercase;
            letter-spacing: .05em;
            white-space: nowrap;
        }

        .switch {
            position: relative;
            width: 28px;
            height: 16px;
            flex-shrink: 0;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            inset: 0;
            background: var(--border);
            border-radius: 16px;
            cursor: pointer;
            transition: background .2s;
        }

        .slider::before {
            content: '';
            position: absolute;
            width: 12px;
            height: 12px;
            left: 2px;
            top: 2px;
            background: #fff;
            border-radius: 50%;
            transition: transform .2s;
        }

        .switch input:checked+.slider {
            background: var(--accent);
        }

        .switch input:checked+.slider::before {
            transform: translateX(12px);
        }

        /* ── CONTROL BUTTONS ────────────────────────────────── */
        .ctrl-btns {
            display: flex;
            gap: 5px;
            align-items: center;
            flex-wrap: wrap;
        }

        .bar-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 2px 8px;
            height: 26px;
            min-height: 26px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg-card);
            font-size: 11px;
            font-weight: 600;
            color: var(--text-sub);
            cursor: pointer;
            white-space: nowrap;
            transition: all .15s;
        }

        .bar-btn:active {
            transform: scale(.96);
        }

        .bar-btn:hover {
            background: var(--bg-card-hover);
            border-color: var(--border-hover);
            color: var(--text-main);
        }

        #btn-go {
            background: var(--accent);
            color: #fff;
            font-weight: 700;
            border-color: var(--accent);
            box-shadow: 0 1px 8px var(--accent-glow);
            padding: 2px 10px;
        }

        #btn-go:hover {
            background: var(--accent-hover);
            border-color: var(--accent-hover);
        }

        #extract-spinner {
            display: none;
            align-items: center;
            gap: 5px;
            color: #c4b5fd;
            font-size: 11px;
            font-weight: 600;
            background: rgba(167, 139, 250, 0.1);
            padding: 3px 8px;
            height: 26px;
            border-radius: 6px;
            border: 1px solid rgba(167, 139, 250, 0.25);
        }

        #stream-source-badge {
            display: none;
            align-items: center;
            gap: 4px;
            padding: 2px 7px;
            height: 24px;
            border-radius: 5px;
            font-size: 10.5px;
            font-weight: 700;
            white-space: nowrap;
        }

        #stream-source-badge.show {
            display: inline-flex;
        }

        #stream-source-badge.megaplay {
            background: rgba(34, 197, 94, 0.12);
            color: #4ade80;
            border: 1px solid rgba(34, 197, 94, 0.25);
        }

        #stream-source-badge.flixcloud {
            background: rgba(56, 189, 248, 0.12);
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.25);
        }

        #stream-source-badge.anisnatch {
            background: rgba(244, 114, 182, 0.12);
            color: #f472b6;
            border: 1px solid rgba(244, 114, 182, 0.25);
        }

        #stream-source-badge.animegg {
            background: rgba(167, 139, 250, 0.12);
            color: #c4b5fd;
            border: 1px solid rgba(167, 139, 250, 0.25);
        }

        #stream-source-badge.anidb {
            background: rgba(251, 146, 60, 0.12);
            color: #fb923c;
            border: 1px solid rgba(251, 146, 60, 0.25);
        }

        /* ── SERVERS TOGGLE BUTTON ──────────────────────────── */
        #srv-wrap {
            position: relative;
            margin-left: auto;
            flex-shrink: 0;
        }

        #srv-toggle-btn {
            display: none;
            align-items: center;
            gap: 5px;
            padding: 2px 9px;
            height: 26px;
            min-height: 26px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text-sub);
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all .15s;
            white-space: nowrap;
        }

        #srv-toggle-btn.show {
            display: inline-flex;
        }

        #srv-toggle-btn:hover,
        #srv-toggle-btn.open {
            border-color: var(--accent);
            color: #fff;
            background: var(--accent-glow);
            box-shadow: 0 0 10px var(--accent-glow);
        }

        /* ── RIGHT-SIDE SERVER PANEL & BACKDROP ─────────────── */
        #server-modal-backdrop {
            display: none;
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 80;
            cursor: pointer;
            transition: opacity .2s ease;
        }

        #server-modal-backdrop.visible {
            display: block;
        }

        #server-panel {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            transform: translateX(100%);
            opacity: 0;
            pointer-events: none;
            z-index: 90;
            background: rgba(14, 14, 22, 0.97);
            border-left: 1px solid var(--border);
            padding: 16px 14px;
            width: 380px;
            max-width: min(92vw, 420px);
            height: 100%;
            box-shadow: -15px 0 45px rgba(0, 0, 0, .85);
            display: flex;
            flex-direction: column;
            gap: 10px;
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            transition: transform .26s cubic-bezier(0.16, 1, 0.3, 1), opacity .2s ease;
        }

        #server-panel.visible {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(0);
        }

        .sp-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--border);
            padding-bottom: 8px;
            flex-shrink: 0;
        }

        .sp-title-wrap {
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--accent);
        }

        .sp-title {
            font-size: 13px;
            font-weight: 700;
            color: var(--text-main);
            letter-spacing: .02em;
            text-transform: uppercase;
        }

        .sp-badge-count {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 10px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--accent);
        }

        #sp-close {
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-muted);
            font-size: 12px;
            cursor: pointer;
            line-height: 1;
            width: 24px;
            height: 24px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all .15s;
        }

        #sp-close:hover {
            color: var(--text-main);
            border-color: var(--border-hover);
            background: var(--bg-card-hover);
        }

        /* ── PROVIDER FILTER TABS ───────────────────────────── */
        #provider-row {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
            padding: 3px;
            background: var(--bg-base);
            border-radius: 8px;
            border: 1px solid var(--border);
            flex-shrink: 0;
        }

        .prov-pill {
            padding: 4px 9px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            background: transparent;
            border: none;
            color: var(--text-sub);
            cursor: pointer;
            transition: all .15s;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .prov-pill:hover {
            color: var(--text-main);
            background: var(--bg-card);
        }

        .prov-pill.active {
            background: var(--accent);
            color: #fff;
            box-shadow: 0 1px 6px var(--accent-glow);
        }

        .prov-pill-count {
            font-size: 10px;
            opacity: 0.8;
            font-weight: 700;
        }

        /* ── SUB-FILTER (LANG & QUALITY) ────────────────────── */
        #filter-subrow {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
            flex-wrap: wrap;
            flex-shrink: 0;
        }

        #quality-row {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        }

        .q-pill {
            padding: 2px 7px;
            border-radius: 5px;
            font-size: 10.5px;
            font-weight: 600;
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-sub);
            cursor: pointer;
            transition: all .15s;
        }

        .q-pill:hover {
            border-color: var(--accent);
            color: var(--text-main);
        }

        .q-pill.active {
            background: var(--accent-glow);
            border-color: var(--accent);
            color: #fff;
        }

        .q-pill.unavail {
            opacity: 0.35;
            cursor: not-allowed;
        }

        /* ── SERVER CARDS LIST ──────────────────────────────── */
        #server-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex: 1;
            overflow-y: auto;
            padding-right: 3px;
        }

        #server-list::-webkit-scrollbar {
            width: 5px;
        }

        #server-list::-webkit-scrollbar-track {
            background: transparent;
        }

        #server-list::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 5px;
        }

        .srv-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-sub);
            cursor: pointer;
            transition: all .15s;
            text-align: left;
            position: relative;
            flex-shrink: 0;
        }

        .srv-card:hover {
            background: var(--bg-card-hover);
            color: var(--text-main);
            border-color: var(--border-hover);
            transform: translateX(-2px);
        }

        .srv-card.active {
            background: var(--bg-card-active);
            border-color: var(--accent);
            color: #fff;
            box-shadow: 0 0 0 1px var(--accent-glow), 0 4px 14px rgba(0, 0, 0, 0.4);
        }

        .srv-card-left {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }

        .srv-prov-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        .srv-prov-dot.megaplay { background: var(--green); box-shadow: 0 0 7px var(--green-glow); }
        .srv-prov-dot.flixcloud { background: var(--cyan); box-shadow: 0 0 7px var(--cyan-glow); }
        .srv-prov-dot.anisnatch { background: var(--pink); box-shadow: 0 0 7px var(--pink-glow); }
        .srv-prov-dot.animegg { background: #c4b5fd; box-shadow: 0 0 7px rgba(196, 181, 253, 0.35); }
        .srv-prov-dot.anidb { background: var(--orange); box-shadow: 0 0 7px var(--orange-glow); }

        .srv-name-col {
            display: flex;
            flex-direction: column;
            gap: 1px;
            min-width: 0;
        }

        .srv-name {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-main);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .srv-subinfo {
            font-size: 10px;
            font-weight: 500;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .srv-card-right {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
        }

        .srv-pill {
            font-size: 10px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 4px;
            line-height: 15px;
        }

        .srv-pill.hls {
            background: rgba(52, 211, 153, 0.12);
            color: #34d399;
            border: 1px solid rgba(52, 211, 153, 0.25);
        }

        .srv-pill.embed {
            background: rgba(167, 139, 250, 0.12);
            color: #c4b5fd;
            border: 1px solid rgba(167, 139, 250, 0.25);
        }

        .srv-pill.quality {
            background: var(--bg-base);
            border: 1px solid var(--border);
            color: var(--text-sub);
        }

        .srv-card.active .srv-pill.quality {
            border-color: var(--accent);
            color: #c4b5fd;
        }

        .srv-pill.dub {
            background: rgba(251, 146, 60, 0.12);
            color: #fb923c;
            border: 1px solid rgba(251, 146, 60, 0.25);
        }

        .srv-pill.sub {
            background: rgba(56, 189, 248, 0.12);
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.25);
        }

        .srv-active-check {
            font-size: 12px;
            color: var(--accent);
            display: none;
            margin-left: 2px;
            font-weight: 800;
        }

        .srv-card.active .srv-active-check {
            display: inline-block;
        }

        #sp-loading {
            display: flex;
            align-items: center;
            gap: 7px;
            color: var(--text-sub);
            font-size: 11.5px;
            padding: 12px 0;
            justify-content: center;
        }

        .spin {
            width: 13px;
            height: 13px;
            border: 2px solid var(--border);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin .7s linear infinite;
            flex-shrink: 0;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        #sp-error {
            color: #f87171;
            font-size: 11px;
            padding: 4px 0;
            text-align: center;
        }

        /* ── PLAYER SECTION ─────────────────────────────────── */
        #player-wrap {
            flex: 1;
            position: relative;
            background: #000;
            overflow: hidden;
            width: 100%;
            height: 100%;
        }

        #player-wrap iframe,
        #player-wrap video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            border: 0;
            z-index: 1;
            object-fit: contain;
        }

        #placeholder {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            color: var(--text-muted);
            z-index: 0;
            padding: 20px;
            text-align: center;
        }

        #placeholder svg {
            opacity: .35;
            color: var(--accent);
        }

        #placeholder p {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-sub);
        }

        #placeholder .hint {
            font-size: 11.5px;
            color: var(--text-muted);
        }

        #toggle-bar-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            z-index: 20;
            width: 32px;
            height: 32px;
            background: rgba(16, 16, 24, 0.85);
            border: 1px solid var(--border);
            border-radius: 7px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(8px);
            transition: background .15s, border-color .15s;
        }

        #toggle-bar-btn:hover {
            background: var(--bg-card-hover);
            border-color: var(--accent);
        }

        #toggle-bar-btn svg {
            display: block;
            transition: transform .25s ease;
            color: var(--text-sub);
        }

        #toggle-bar-btn.open svg {
            transform: rotate(180deg);
        }

        /* ── AUTO-NEXT OVERLAY ──────────────────────────────── */
        #autonext-overlay {
            display: none;
            position: absolute;
            bottom: 24px;
            right: 24px;
            background: rgba(14, 14, 22, .94);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 12px 18px;
            min-width: 200px;
            z-index: 30;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
        }

        .an-title {
            font-size: 10px;
            color: var(--text-sub);
            text-transform: uppercase;
            letter-spacing: .07em;
            margin-bottom: 4px;
            font-weight: 700;
        }

        .an-ep {
            font-size: 14px;
            font-weight: 700;
            color: var(--text-main);
            margin-bottom: 8px;
        }

        #an-bar-bg {
            width: 100%;
            height: 3px;
            background: var(--border);
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 8px;
        }

        #an-bar {
            height: 100%;
            width: 100%;
            background: var(--accent);
            border-radius: 3px;
            transform-origin: left;
            transition: transform linear;
        }

        .an-btns {
            display: flex;
            gap: 6px;
        }

        .an-btns button {
            flex: 1;
            padding: 5px 0;
            border: none;
            border-radius: 5px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: background .15s;
        }

        #an-btn-now { background: var(--accent); color: #fff; }
        #an-btn-now:hover { background: var(--accent-hover); }
        #an-btn-cancel { background: var(--bg-card); color: var(--text-sub); border: 1px solid var(--border); }
        #an-btn-cancel:hover { background: var(--border); color: var(--text-main); }

        /* ── RESPONSIVE MEDIA QUERIES ───────────────────────── */
        @media (max-width: 768px) {
            #topbar {
                padding: 4px 8px;
            }

            #topbar-inner {
                gap: 6px 5px;
                max-height: 600px;
                padding: 4px 1px;
            }

            #srv-wrap {
                margin-left: 0;
            }

            #server-panel {
                width: 100%;
                max-width: 100%;
                min-width: 100%;
                border-left: none;
                box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.85);
            }

            #autonext-overlay {
                bottom: 10px;
                left: 10px;
                right: 10px;
                min-width: auto;
                padding: 10px 14px;
            }
        }
    </style>
</head>

<body>
    <div id="app">
        <div id="topbar">
            <div id="topbar-inner">
                <a href="/" class="brand" title="ani">
                    <span class="brand-text">ani</span>
                    <span class="brand-dot"></span>
                </a>

                <div class="field-group">
                    <label>MAL</label>
                    <input id="inp-mal" type="number" placeholder="20" min="1">
                </div>
                <div class="field-group">
                    <label>Ep</label>
                    <input id="inp-ep" type="number" placeholder="1" min="1">
                </div>

                <!-- Provider Switcher -->
                <div class="segmented-group" id="prov-toggle">
                    <button id="btn-prov-all" onclick="setProvider('all')">ALL</button>
                    <button id="btn-prov-megaplay" class="active" onclick="setProvider('megaplay')">MegaPlay</button>
                    <button id="btn-prov-flixcloud" onclick="setProvider('flixcloud')">FlixCloud</button>
                    <button id="btn-prov-anisnatch" onclick="setProvider('anisnatch')">AniSnatch</button>
                    <button id="btn-prov-animegg" onclick="setProvider('animegg')">AnimeGG</button>
                    <button id="btn-prov-anidb" onclick="setProvider('anidb')">AniDB</button>
                </div>

                <!-- Language Switcher -->
                <div class="segmented-group" id="lang-toggle">
                    <button id="btn-dub" class="active" onclick="setLang('dub')">DUB</button>
                    <button id="btn-sub" onclick="setLang('sub')">SUB</button>
                </div>

                <div id="autonext-wrap">
                    <span>Auto</span>
                    <label class="switch" title="Auto-play next episode">
                        <input type="checkbox" id="chk-autonext" checked>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="ctrl-btns">
                    <button class="bar-btn" id="btn-prev-bar" onclick="goPrevEp()" title="Previous episode">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                        Prev
                    </button>
                    <button class="bar-btn" id="btn-go" onclick="loadPlayer()">&#9654; Play</button>
                    <button class="bar-btn" id="btn-next-bar" onclick="goNextEp()" title="Next episode">
                        Next
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                    <div id="extract-spinner">
                        <div class="spin"></div>
                        <span id="extract-status-text">Loading...</span>
                    </div>
                    <div id="stream-source-badge">
                        <span id="source-label">&#8212;</span>
                    </div>
                </div>

                <div id="srv-wrap">
                    <button id="srv-toggle-btn" onclick="toggleServerPanel()">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="3" width="20" height="4" rx="1" />
                            <rect x="2" y="10" width="20" height="4" rx="1" />
                            <rect x="2" y="17" width="20" height="4" rx="1" />
                        </svg>
                        Servers
                    </button>
                </div>
            </div>
        </div>

        <div id="player-wrap">
            <button id="toggle-bar-btn" class="open" onclick="toggleBar()" title="Toggle controls">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#aaa" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 8 11 13 6" />
                </svg>
            </button>

            <div id="placeholder">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                </svg>
                <p>Ready to stream</p>
                <p class="hint">Enter MAL ID &amp; Episode, then press Play</p>
            </div>

            <video id="videoPlayer" controls autoplay playsinline webkit-playsinline style="display:none;"></video>
            <iframe id="player-iframe" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen style="display:none;"></iframe>

            <!-- Right-Side Server Panel & Backdrop -->
            <div id="server-modal-backdrop" onclick="closeServerPanel()"></div>
            <div id="server-panel">
                <div class="sp-header">
                    <div class="sp-title-wrap">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="3" width="20" height="4" rx="1" />
                            <rect x="2" y="10" width="20" height="4" rx="1" />
                            <rect x="2" y="17" width="20" height="4" rx="1" />
                        </svg>
                        <span class="sp-title">Servers</span>
                        <span class="sp-badge-count" id="sp-count-badge">0 Available</span>
                    </div>
                    <button id="sp-close" onclick="closeServerPanel()" title="Close">&#10005;</button>
                </div>
                <div id="provider-row">
                    <button class="prov-pill" onclick="filterProviderPanel('all')">All <span class="prov-pill-count" id="pc-all"></span></button>
                    <button class="prov-pill active" onclick="filterProviderPanel('megaplay')">MegaPlay <span class="prov-pill-count" id="pc-megaplay"></span></button>
                    <button class="prov-pill" onclick="filterProviderPanel('flixcloud')">FlixCloud <span class="prov-pill-count" id="pc-flixcloud"></span></button>
                    <button class="prov-pill" onclick="filterProviderPanel('anisnatch')">AniSnatch <span class="prov-pill-count" id="pc-anisnatch"></span></button>
                    <button class="prov-pill" onclick="filterProviderPanel('animegg')">AnimeGG <span class="prov-pill-count" id="pc-animegg"></span></button>
                    <button class="prov-pill" onclick="filterProviderPanel('anidb')">AniDB <span class="prov-pill-count" id="pc-anidb"></span></button>
                </div>
                <div id="filter-subrow">
                    <div id="quality-row"></div>
                </div>
                <div id="sp-loading" style="display:none">
                    <div class="spin"></div> Fetching available servers&#8230;
                </div>
                <div id="sp-error" style="display:none"></div>
                <div id="server-list"></div>
            </div>

            <div id="autonext-overlay">
                <div class="an-title">Up next</div>
                <div class="an-ep" id="an-ep-label">Episode &#8212;</div>
                <div id="an-bar-bg">
                    <div id="an-bar"></div>
                </div>
                <div class="an-btns">
                    <button id="an-btn-now" onclick="goNextNow()">Play Now</button>
                    <button id="an-btn-cancel" onclick="cancelAutoNext()">Cancel</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Global State
        let hlsInstance = null;
        let currentLang = 'dub';
        let currentProvider = 'megaplay';
        let currentPanelProviderFilter = 'megaplay';
        let autoNextTimer = null;
        let activeServerStream = null;
        let allExtractedStreams = [];
        let cachedMalId = null;
        let cachedEp = null;
        let _fetchToken = 0;
        const COUNTDOWN_S = 10;
        const streamCache = new Map();

        // ─── Proxy Helpers ─────────────────────────────────────────────────────────
        function getOrigin() {
            return (typeof window !== 'undefined' && window.location.origin && window.location.protocol.startsWith('http'))
                ? window.location.origin
                : '';
        }

        function getProxyUrl(url, referer, type) {
            if (!url) return '';
            const origin = getOrigin();
            if (url.startsWith('/m3u8') || url.startsWith('/segment') || url.startsWith('/proxy') || url.startsWith('/txt')) {
                return origin + url;
            }
            if (origin && url.startsWith(origin)) {
                return url;
            }

            referer = referer || (url.includes('flixcloud') ? 'https://flixcloud.cc/' : (url.includes('megaplay') ? 'https://megaplay.buzz/' : (url.includes('anisnatch') ? 'https://anisnatch.top/' : (url.includes('anidb') ? 'https://anidb.app/' : 'https://www.animegg.org/'))));
            if (type === 'm3u8' || url.includes('.m3u8') || url.includes('urlset/master')) {
                return origin + '/m3u8?url=' + encodeURIComponent(url) + '&ref=' + encodeURIComponent(referer);
            }
            return origin + '/proxy?url=' + encodeURIComponent(url) + '&referer=' + encodeURIComponent(referer);
        }

        function formatFlixcloudUrl(url, lang) {
            if (!url) return '';
            const audioTrack = (lang === 'sub' || lang === 's-sub' || lang === 'raw') ? '2' : '1';
            const params = 'autoPlay=true&skI=false&skO=false&a=' + audioTrack;
            let cleanUrl = url.replace(/([?&])(autoPlay|skI|skO|a)=[^&]*/gi, '').replace(/&+/g, '&').replace(/[?&]+$/, '');
            const sep = cleanUrl.includes('?') ? '&' : '?';
            return cleanUrl + sep + params;
        }

        // ─── Unified Multi-Provider Aggregator ────────────────────────────────────
        async function getMergedStreams(malId, epNum, provider = 'all') {
            const cacheKey = malId + '_' + epNum + '_' + provider;
            if (streamCache.has(cacheKey)) return await streamCache.get(cacheKey);

            const fetchPromise = (async () => {
                const origin = getOrigin();
                try {
                    const res = await fetch(origin + '/api/merged?mal_id=' + encodeURIComponent(malId) + '&ep=' + encodeURIComponent(epNum) + '&provider=' + encodeURIComponent(provider) + '&lang=both');
                    if (res.ok) {
                        const data = await res.json();
                        if (data.status === 'success' && Array.isArray(data.streams) && data.streams.length) {
                            return {
                                status: 'success',
                                malId: parseInt(malId, 10),
                                episode: parseInt(epNum, 10),
                                results: {
                                    stream_url: data.streams[0].url,
                                    streams: data.streams
                                }
                            };
                        }
                    }
                } catch (e) { }

                throw new Error('No streams found for MAL ID ' + malId + ' Episode ' + epNum);
            })();

            streamCache.set(cacheKey, fetchPromise);
            return await fetchPromise;
        }

        // ─── Player UI Logic ──────────────────────────────────────────────────────
        function setProvider(prov) {
            currentProvider = prov;
            currentPanelProviderFilter = prov;
            document.querySelectorAll('#prov-toggle button').forEach(b => {
                b.classList.toggle('active', b.id === 'btn-prov-' + prov);
            });

            const malId = String(document.getElementById('inp-mal').value).trim();
            const ep = String(document.getElementById('inp-ep').value).trim();
            if (malId && ep) showPlayer(malId, ep, currentLang);
        }

        function setLang(lang) {
            currentLang = lang;
            document.getElementById('btn-dub').classList.toggle('active', lang === 'dub');
            document.getElementById('btn-sub').classList.toggle('active', lang === 'sub');

            const malId = String(document.getElementById('inp-mal').value).trim();
            const ep = String(document.getElementById('inp-ep').value).trim();

            if (allExtractedStreams && allExtractedStreams.length > 0 && cachedMalId === malId && cachedEp === ep) {
                const best = getBestStream(allExtractedStreams, lang, currentProvider);
                if (best) {
                    playStream(best);
                    renderServerPanel(allExtractedStreams);
                } else {
                    showPlayer(malId, ep, lang);
                }
            } else if (malId && ep) {
                showPlayer(malId, ep, lang);
            }
        }

        function getBestStream(streams, preferredLang = 'dub', preferredProv = 'all') {
            if (!streams || streams.length === 0) return null;

            let filtered = streams;
            if (preferredProv !== 'all') {
                const provOnly = streams.filter(s => s.provider === preferredProv);
                if (provOnly.length > 0) filtered = provOnly;
            }

            // Check if AniSnatch provider is active or available in filtered list
            const isAniSnatch = (preferredProv === 'anisnatch') || (filtered.length > 0 && filtered.some(s => s.provider === 'anisnatch'));

            // Priority: For AniSnatch, 480p is default priority (AniSnatch · AllanimeHD 480p) instead of 1080p
            const priority = isAniSnatch
                ? ['480p', '720p', '1080p', '360p', 'HD-1', 'HD-2', 'Master', 'Direct', 'HD', 'Embed']
                : ['1080p', '720p', 'HD-1', 'HD-2', '480p', '360p', 'Master', 'Direct', 'HD', 'Embed'];

            const prefStreams = filtered.filter(s => s.lang === preferredLang);
            if (prefStreams.length > 0) {
                // If anisnatch server is available, default directly to AllanimeHD 480p
                if (isAniSnatch) {
                    const anisnatch480 = prefStreams.find(s => s.provider === 'anisnatch' && ((s.quality === '480p') || (s.server || '').includes('480p')));
                    if (anisnatch480) return anisnatch480;
                }

                for (const res of priority) {
                    const found = prefStreams.find(s => (s.quality || s.server || '').includes(res));
                    if (found) return found;
                }
                return prefStreams[0];
            }

            const altLang = preferredLang === 'dub' ? 'sub' : 'dub';
            const altStreams = filtered.filter(s => s.lang === altLang);
            if (altStreams.length > 0) {
                if (isAniSnatch) {
                    const anisnatch480 = altStreams.find(s => s.provider === 'anisnatch' && ((s.quality === '480p') || (s.server || '').includes('480p')));
                    if (anisnatch480) return anisnatch480;
                }

                for (const res of priority) {
                    const found = altStreams.find(s => (s.quality || s.server || '').includes(res));
                    if (found) return found;
                }
                return altStreams[0];
            }

            for (const res of priority) {
                const found = filtered.find(s => (s.quality || s.server || '').includes(res));
                if (found) return found;
            }
            return filtered[0];
        }

        function playStream(stream) {
            activeServerStream = stream;
            const placeholder = document.getElementById('placeholder');
            const video = document.getElementById('videoPlayer');
            const iframe = document.getElementById('player-iframe');
            const badge = document.getElementById('stream-source-badge');
            const label = document.getElementById('source-label');

            placeholder.style.display = 'none';
            if (!stream) return;

            // Sync server panel provider filter to current playing provider if set to that or all
            if (stream.provider) {
                if (currentProvider !== 'all') {
                    currentPanelProviderFilter = currentProvider;
                } else if (currentPanelProviderFilter !== 'all' && currentPanelProviderFilter !== stream.provider) {
                    currentPanelProviderFilter = stream.provider;
                }
            }

            if (badge && label) {
                badge.className = 'show ' + (stream.provider || 'megaplay');
                const provLabel = stream.provider === 'megaplay' ? '⚡ MegaPlay' :
                                  stream.provider === 'flixcloud' ? '🎬 FlixCloud' :
                                  stream.provider === 'anisnatch' ? '🎌 AniSnatch' :
                                  stream.provider === 'animegg' ? '✨ AnimeGG' : '📺 AniDB';
                label.textContent = provLabel + ' · ' + (stream.quality || 'HD') + ' (' + (stream.lang ? stream.lang.toUpperCase() : 'MULTI') + ')';
            }

            if (stream.type === 'iframe') {
                video.style.display = 'none';
                video.pause();
                let embedUrl = stream.url;
                if (stream.provider === 'flixcloud') {
                    embedUrl = formatFlixcloudUrl(stream.rawUrl || stream.url, stream.lang || currentLang);
                }
                iframe.src = embedUrl;
                iframe.style.display = 'block';
                return;
            }

            iframe.style.display = 'none';
            iframe.src = 'about:blank';
            video.style.display = 'block';

            let streamUrl = stream.url;
            if (!streamUrl.startsWith('http') && !streamUrl.startsWith('/')) {
                streamUrl = getProxyUrl(stream.url, null, stream.type);
            } else if (stream.provider === 'animegg' && !streamUrl.includes('/proxy') && !streamUrl.includes('/m3u8')) {
                streamUrl = getProxyUrl(stream.url, 'https://www.animegg.org/', stream.type);
            }

            if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

            const isHls = stream.type === 'm3u8' || streamUrl.includes('.m3u8') || (stream.rawUrl && stream.rawUrl.includes('.m3u8'));

            if (isHls) {
                if (Hls.isSupported()) {
                    hlsInstance = new Hls({
                        maxBufferLength: 30,
                        maxMaxBufferLength: 60,
                        enableWorker: true,
                    });
                    hlsInstance.loadSource(streamUrl);
                    hlsInstance.attachMedia(video);
                    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                        video.play().catch(() => { video.muted = true; video.play(); });
                    });
                    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                        if (data.fatal) {
                            switch (data.type) {
                                case Hls.ErrorTypes.NETWORK_ERROR:
                                    hlsInstance.startLoad();
                                    break;
                                case Hls.ErrorTypes.MEDIA_ERROR:
                                    hlsInstance.recoverMediaError();
                                    break;
                                default:
                                    hlsInstance.destroy();
                                    break;
                            }
                        }
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = streamUrl;
                    video.play().catch(() => { video.muted = true; video.play(); });
                }
            } else {
                video.src = streamUrl;
                video.play().catch(() => { video.muted = true; video.play(); });
            }

            video.onended = () => {
                const malId = document.getElementById('inp-mal').value.trim();
                const ep = document.getElementById('inp-ep').value.trim();
                if (malId && ep) triggerAutoNext(malId, ep, currentLang);
            };
        }

        function filterProviderPanel(prov) {
            currentPanelProviderFilter = prov;
            renderServerPanel(allExtractedStreams);
        }

        function cleanServerTitle(serverName, provider) {
            let name = (serverName || '').trim();
            name = name.replace(/^(MegaPlay|FlixCloud|AniSnatch|AnimeGG|AniDB)\s*[·•-]\s*/i, '');
            name = name.replace(/\\s*\\((DUB|SUB|1080p|720p|480p|360p|Multi-Lang|HD|Master|Direct|Embed)\\)/gi, '');
            name = name.replace(/\\b(DUB|SUB)\\b/gi, '').trim();
            if (!name) name = provider ? (provider.charAt(0).toUpperCase() + provider.slice(1)) : 'Server';
            return name;
        }

        function renderServerPanel(streams) {
            const qRow = document.getElementById('quality-row');
            const srvList = document.getElementById('server-list');
            const spLoad = document.getElementById('sp-loading');
            const spErr = document.getElementById('sp-error');
            const srvBtn = document.getElementById('srv-toggle-btn');
            const countBadge = document.getElementById('sp-count-badge');

            spLoad.style.display = 'none';
            spErr.style.display = 'none';
            qRow.innerHTML = '';
            srvList.innerHTML = '';

            const allStreams = streams || [];

            // Update Provider counts
            const counts = { all: allStreams.length, megaplay: 0, flixcloud: 0, anisnatch: 0, animegg: 0, anidb: 0 };
            allStreams.forEach(s => {
                if (s.provider && counts[s.provider] !== undefined) counts[s.provider]++;
            });

            for (const [k, v] of Object.entries(counts)) {
                const el = document.getElementById('pc-' + k);
                if (el) el.textContent = v ? '(' + v + ')' : '';
            }

            // Sync provider pills active class
            document.querySelectorAll('#provider-row .prov-pill').forEach(p => {
                p.classList.toggle('active', p.getAttribute('onclick').includes("'" + currentPanelProviderFilter + "'"));
            });

            let filteredStreams = allStreams;
            if (currentPanelProviderFilter !== 'all') {
                filteredStreams = filteredStreams.filter(s => s.provider === currentPanelProviderFilter);
            }

            if (countBadge) countBadge.textContent = filteredStreams.length + ' Available';

            if (!filteredStreams || !filteredStreams.length) {
                spErr.style.display = 'block';
                spErr.textContent = 'No servers found for this filter.';
                if (srvBtn) srvBtn.innerHTML = 'Servers (0)';
                return;
            }

            // Quality filter pills
            const qualSet = new Set(['1080p', '720p', 'HD-1', 'HD-2', '480p', '360p', 'Master', 'Direct']);
            filteredStreams.forEach(s => { if (s.quality) qualSet.add(s.quality); });

            Array.from(qualSet).forEach(q => {
                let matchingStream = filteredStreams.find(s => s.lang === currentLang && ((s.quality || '').includes(q) || (s.server || '').includes(q)));
                if (!matchingStream) {
                    matchingStream = filteredStreams.find(s => (s.quality || '').includes(q) || (s.server || '').includes(q));
                }

                const pill = document.createElement('button');
                const isActive = (matchingStream && activeServerStream === matchingStream);
                pill.className = 'q-pill' + (isActive ? ' active' : '') + (matchingStream ? '' : ' unavail');
                pill.textContent = q;
                if (matchingStream) {
                    pill.onclick = () => {
                        document.querySelectorAll('.q-pill').forEach(p => p.classList.remove('active'));
                        pill.classList.add('active');
                        playStream(matchingStream);
                        if (matchingStream.lang) {
                            currentLang = matchingStream.lang;
                            document.getElementById('btn-dub').classList.toggle('active', currentLang === 'dub');
                            document.getElementById('btn-sub').classList.toggle('active', currentLang === 'sub');
                        }
                        renderServerPanel(allExtractedStreams);
                        setTimeout(() => { closeServerPanel(); }, 250);
                    };
                }
                qRow.appendChild(pill);
            });

            // Sort streams so currently preferred language is at top
            const sortedStreams = [...filteredStreams].sort((a, b) => {
                if (a.lang === currentLang && b.lang !== currentLang) return -1;
                if (a.lang !== currentLang && b.lang === currentLang) return 1;
                return 0;
            });

            sortedStreams.forEach((st, idx) => {
                const card = document.createElement('div');
                const isCurrentActive = (activeServerStream === st || (!activeServerStream && idx === 0));
                card.className = 'srv-card' + (isCurrentActive ? ' active' : '');

                const prov = st.provider || 'megaplay';
                const cleanName = cleanServerTitle(st.server, prov);
                const streamKind = st.type === 'm3u8' ? 'HLS Direct' : (st.type === 'iframe' ? 'Embed Player' : 'MP4 Direct');

                card.innerHTML =
                    '<div class="srv-card-left">' +
                        '<span class="srv-prov-dot ' + prov + '"></span>' +
                        '<div class="srv-name-col">' +
                            '<span class="srv-name">' + cleanName + '</span>' +
                            '<span class="srv-subinfo">' +
                                '<span>' + prov.toUpperCase() + '</span> · <span>' + streamKind + '</span>' +
                            '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="srv-card-right">' +
                        (st.quality ? '<span class="srv-pill quality">' + st.quality + '</span>' : '') +
                        (st.lang ? '<span class="srv-pill ' + st.lang + '">' + st.lang.toUpperCase() + '</span>' : '') +
                        '<span class="srv-active-check">✓</span>' +
                    '</div>';

                card.onclick = () => {
                    document.querySelectorAll('.srv-card').forEach(b => b.classList.remove('active'));
                    card.classList.add('active');
                    playStream(st);
                    if (st.lang) {
                        currentLang = st.lang;
                        document.getElementById('btn-dub').classList.toggle('active', currentLang === 'dub');
                        document.getElementById('btn-sub').classList.toggle('active', currentLang === 'sub');
                    }
                    renderServerPanel(allExtractedStreams);
                    setTimeout(() => { closeServerPanel(); }, 250);
                };

                srvList.appendChild(card);
            });

            if (srvBtn) {
                const activeRes = activeServerStream ? ((activeServerStream.quality || '') + ' ' + (activeServerStream.lang ? activeServerStream.lang.toUpperCase() : '')) : '';
                srvBtn.innerHTML = 'Servers (' + (activeRes.trim() ? activeRes.trim() : filteredStreams.length + ' Streams') + ')';
            }
        }

        async function showPlayer(malId, ep, lang = 'dub') {
            cancelAutoNext();
            currentLang = lang;
            const myToken = ++_fetchToken;

            document.getElementById('inp-mal').value = malId;
            document.getElementById('inp-ep').value = ep;
            document.getElementById('btn-dub').classList.toggle('active', lang === 'dub');
            document.getElementById('btn-sub').classList.toggle('active', lang === 'sub');

            document.title = 'ani · MAL ' + malId + ' · Ep ' + ep + ' · ' + lang.toUpperCase();

            // Update URL without reloading
            if (window.history.pushState) {
                const newUrl = window.location.pathname.startsWith('/') && window.location.pathname.length > 1
                    ? '/' + malId + '/' + ep + '/' + lang
                    : '?mal_id=' + malId + '&ep=' + ep + '&lang=' + lang;
                window.history.replaceState({ malId, ep, lang }, document.title, newUrl);
            }

            const spinner = document.getElementById('extract-spinner');
            if (spinner) spinner.style.display = 'inline-flex';

            document.getElementById('srv-toggle-btn').classList.add('show');
            document.getElementById('quality-row').innerHTML = '';
            document.getElementById('server-list').innerHTML = '';
            document.getElementById('sp-error').style.display = 'none';
            document.getElementById('sp-loading').style.display = 'flex';

            try {
                const data = await getMergedStreams(malId, ep, currentProvider);
                if (myToken !== _fetchToken) return;

                document.getElementById('sp-loading').style.display = 'none';

                const streams = data.results.streams || [];
                allExtractedStreams = streams;
                cachedMalId = String(malId);
                cachedEp = String(ep);

                if (streams.length > 0) {
                    const best = getBestStream(streams, lang, currentProvider);
                    if (currentProvider !== 'all') {
                        currentPanelProviderFilter = currentProvider;
                    } else if (best && best.provider) {
                        currentPanelProviderFilter = best.provider;
                    }
                    playStream(best);
                    renderServerPanel(streams);
                } else {
                    document.getElementById('sp-error').style.display = 'block';
                    document.getElementById('sp-error').textContent = 'No streams found for MAL ' + malId + ' Ep ' + ep;
                }
            } catch (err) {
                if (myToken !== _fetchToken) return;
                document.getElementById('sp-loading').style.display = 'none';
                document.getElementById('sp-error').style.display = 'block';
                document.getElementById('sp-error').textContent = 'Error: ' + err.message;
            } finally {
                if (myToken === _fetchToken && spinner) {
                    spinner.style.display = 'none';
                }
            }
        }

        function loadPlayer() {
            const malId = document.getElementById('inp-mal').value.trim();
            const ep = document.getElementById('inp-ep').value.trim();
            if (!malId || !ep) { alert('Please enter both MAL ID and episode number.'); return; }
            showPlayer(malId, ep, currentLang);
        }

        function goPrevEp() {
            const malId = document.getElementById('inp-mal').value.trim();
            const ep = parseInt(document.getElementById('inp-ep').value.trim(), 10);
            if (!malId || isNaN(ep) || ep <= 1) return;
            showPlayer(malId, ep - 1, currentLang);
        }

        function goNextEp() {
            const malId = document.getElementById('inp-mal').value.trim();
            const ep = parseInt(document.getElementById('inp-ep').value.trim(), 10);
            if (!malId || isNaN(ep)) return;
            showPlayer(malId, ep + 1, currentLang);
        }

        function triggerAutoNext(malId, ep, lang) {
            if (!document.getElementById('chk-autonext').checked) return;
            const nextEp = parseInt(ep, 10) + 1;
            document.getElementById('an-ep-label').textContent = 'Episode ' + nextEp;
            const overlay = document.getElementById('autonext-overlay');
            const bar = document.getElementById('an-bar');
            overlay.style.display = 'block';
            bar.style.transition = 'none';
            bar.style.transform = 'scaleX(1)';
            bar.getBoundingClientRect();
            bar.style.transition = 'transform ' + COUNTDOWN_S + 's linear';
            bar.style.transform = 'scaleX(0)';
            let remaining = COUNTDOWN_S;
            autoNextTimer = setInterval(() => { if (--remaining <= 0) goNextNow(); }, 1000);
        }

        function goNextNow() {
            cancelAutoNext();
            const malId = document.getElementById('inp-mal').value.trim();
            const ep = parseInt(document.getElementById('inp-ep').value.trim(), 10);
            if (!malId || isNaN(ep)) return;
            showPlayer(malId, ep + 1, currentLang);
        }

        function cancelAutoNext() {
            clearInterval(autoNextTimer);
            autoNextTimer = null;
            const overlay = document.getElementById('autonext-overlay');
            if (overlay) overlay.style.display = 'none';
        }

        function toggleBar() {
            const inner = document.getElementById('topbar-inner');
            const btn = document.getElementById('toggle-bar-btn');
            const isCollapsed = inner.classList.toggle('collapsed');
            btn.classList.toggle('open', !isCollapsed);
        }

        function toggleServerPanel(forceState) {
            const panel = document.getElementById('server-panel');
            const backdrop = document.getElementById('server-modal-backdrop');
            const btn = document.getElementById('srv-toggle-btn');
            const isVisible = (typeof forceState === 'boolean') ? forceState : !panel.classList.contains('visible');

            panel.classList.toggle('visible', isVisible);
            if (backdrop) backdrop.classList.toggle('visible', isVisible);
            if (btn) btn.classList.toggle('open', isVisible);
        }

        function closeServerPanel() {
            toggleServerPanel(false);
        }

        function openServerPanel() {
            toggleServerPanel(true);
        }

        function parseParamsFromUrl() {
            const path = window.location.pathname;
            const search = window.location.search;
            const hash = window.location.hash;

            const pathMatch = path.match(/\\/(\\d+)\\/(\\d+)(?:\\/(dub|sub))?\\/?$/i);
            if (pathMatch) return { malId: pathMatch[1], epNum: pathMatch[2], lang: pathMatch[3] || 'dub' };

            const queryDirectMatch = search.match(/\\?(\\d+)[\\/&](\\d+)(?:[\\/&](dub|sub))?/i);
            if (queryDirectMatch) return { malId: queryDirectMatch[1], epNum: queryDirectMatch[2], lang: queryDirectMatch[3] || 'dub' };

            const searchParams = new URLSearchParams(search);
            const qMal = searchParams.get('mal_id') || searchParams.get('malId') || searchParams.get('id');
            const qEp = searchParams.get('ep') || searchParams.get('ep_num') || searchParams.get('episode');
            const qLang = searchParams.get('lang') || searchParams.get('type');
            const qProv = searchParams.get('provider') || searchParams.get('server');
            if (qProv && ['all', 'megaplay', 'flixcloud', 'anisnatch', 'animegg', 'anidb'].includes(qProv.toLowerCase())) {
                currentProvider = qProv.toLowerCase();
                currentPanelProviderFilter = qProv.toLowerCase();
                document.querySelectorAll('#prov-toggle button').forEach(b => {
                    b.classList.toggle('active', b.id === 'btn-prov-' + currentProvider);
                });
            }
            if (qMal && qEp) return { malId: qMal, epNum: qEp, lang: qLang || 'dub' };

            const hashMatch = hash.match(/#\\/?(\\d+)[\\/&](\\d+)(?:[\\/&](dub|sub))?/i);
            if (hashMatch) return { malId: hashMatch[1], epNum: hashMatch[2], lang: hashMatch[3] || 'dub' };

            return null;
        }

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeServerPanel();
                cancelAutoNext();
                return;
            }
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                if (e.key === 'Enter') loadPlayer();
                return;
            }
            if (e.key === 'ArrowLeft' && (e.ctrlKey || e.altKey)) {
                goPrevEp();
            } else if (e.key === 'ArrowRight' && (e.ctrlKey || e.altKey)) {
                goNextEp();
            } else if (e.key === '[' ) {
                goPrevEp();
            } else if (e.key === ']' ) {
                goNextEp();
            }
        });

        window.addEventListener('DOMContentLoaded', () => {
            const params = parseParamsFromUrl();
            if (params) {
                showPlayer(params.malId, params.epNum, params.lang);
            }
        });
    <\/script>
</body>

</html>`;

// ═══════════════════════════════════════════════════════════════════════════════
//  WORKER ENTRY POINT (Cloudflare Worker fetch)
// ═══════════════════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
    try {
      const url      = new URL(request.url);
      const pathname = url.pathname;
      const method   = request.method;

      if (method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      // Check for direct deep-link path: /:malId/:ep or /:malId/:ep/:lang
      if (/^\/\d+\/\d+(\/(?:dub|sub))?\/?$/i.test(pathname)) {
        return handleHome(url);
      }

      switch (pathname) {
        case '/':
        case '/index.html':
        case '/play':        return handleHome(url);
        case '/m3u8':        return handlePlaylist(request, url, ctx);
        case '/segment':     return handleSegment(request, url, ctx);
        case '/txt':         return handleTxt(request, url, ctx);
        case '/proxy':       return handleProxy(request, url);
        case '/api/merged':
        case '/api/all':     return handleApiMerged(request, url, ctx);
        case '/api/streams': return handleApiMegaPlay(request, url, ctx);
        case '/api/sources': return handleApiSources(request, url);
        case '/api/cached':  return handleApiCached(request, url);
        case '/api/anisnatch':
        case '/api/anisantch':
        case '/api/anisnacht': return handleApiAniSnatch(request, url);
        case '/api/flixcloud':
        case '/api/flix':      return handleApiFlixCloud(request, url);
        case '/api/animegg':   return handleApiAnimeGG(request, url);
        case '/api/anidb':
        case '/api/anidbapp':  return handleApiAniDB(request, url);
        case '/api/health':    return handleApiHealth(request, url);
        default:             return textResponse('Not found.', 404);
      }
    } catch (err) {
      return textResponse(`Worker error: ${err.message || err}`, 500);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MEGAPLAY DATABASE & LIVE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

let _megaplayDbCache = null;
async function fetchMegaPlayDatabase() {
  if (_megaplayDbCache) return _megaplayDbCache;
  const resp = await fetch(MEGAPLAY_DB_URL, {
    headers: { 'User-Agent': DEFAULT_UA, 'Accept': 'application/json' },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!resp.ok) throw new Error(`MegaPlay DB fetch HTTP ${resp.status}`);
  _megaplayDbCache = await resp.json();
  return _megaplayDbCache;
}

async function lookupMegaPlayDatabase(malId, epNum, workerOrigin) {
  let data;
  try { data = await fetchMegaPlayDatabase(); }
  catch (e) { return null; }
  if (!data || typeof data !== 'object') return null;

  const mid = String(malId).trim();
  const ep  = String(epNum).trim();
  const topLevel = data.entries ?? data;
  const animeObj = topLevel[mid];
  if (!animeObj || typeof animeObj !== 'object') return null;

  const keyRe = new RegExp(`^ep[-_]${ep}[-_](sub|dub)[-_](\\d+)$`, 'i');
  const streams = [];

  for (const [key, rawUrl] of Object.entries(animeObj)) {
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('http')) continue;
    const m = key.match(keyRe);
    if (!m) continue;

    const lang      = m[1].toLowerCase();
    const streamNum = parseInt(m[2], 10);
    const isMaster  = rawUrl.toLowerCase().includes('master.m3u8');

    streams.push({
      provider: 'megaplay',
      server: `MegaPlay · DB ${lang.toUpperCase()} ${streamNum} (${isMaster ? 'Master' : 'Direct'})`,
      url: buildProxyUrl(workerOrigin, 'm3u8', rawUrl, [['ref', MEGAPLAY_REFERER]]),
      rawUrl,
      type: 'm3u8',
      quality: isMaster ? 'Master' : 'Direct',
      lang,
      streamNum,
      source: 'cached',
    });
  }

  if (!streams.length) return null;

  streams.sort((a, b) => {
    if (a.lang !== b.lang) return a.lang === 'dub' ? -1 : 1;
    return a.streamNum - b.streamNum;
  });

  return streams;
}

async function megaFetch(url, extraHeaders = {}) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': DEFAULT_UA,
      'Referer': MEGAPLAY_REFERER,
      'Origin': MEGAPLAY_ORIGIN,
      'Accept': 'text/html,application/xhtml+xml,application/json,*/*;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'X-Requested-With': 'XMLHttpRequest',
      ...extraHeaders,
    },
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`);
  return resp;
}

function decodeSourcesResponse(text) {
  const t = text.trim();
  // 1. Plain JSON
  try { return JSON.parse(t); } catch (_) { }

  // 2a. Standard base64
  try {
    const padded = t + '='.repeat((4 - (t.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (_) { }

  // 2b. URL-safe base64
  try {
    const safe = t.replace(/-/g, '+').replace(/_/g, '/');
    const padded = safe + '='.repeat((4 - (safe.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch (_) { }

  // 3. Hex-encoded UTF-8
  try {
    if (/^[0-9a-f]+$/i.test(t) && t.length % 2 === 0) {
      const bytes = new Uint8Array(t.match(/.{1,2}/g).map(b => parseInt(b, 16)));
      return JSON.parse(new TextDecoder().decode(bytes));
    }
  } catch (_) { }

  return null;
}

async function megaFetchRawSources(fileId) {
  const url = `https://megaplay.buzz/stream/getSources?id=${encodeURIComponent(fileId)}`;
  const resp = await megaFetch(url, { Accept: 'application/json, */*' });
  const text = await resp.text();
  const data = decodeSourcesResponse(text);
  if (!data) throw new Error(`Could not decode MegaPlay sources response`);
  return data;
}

async function megaParseMaster(masterUrl) {
  const resp = await megaFetch(masterUrl);
  const text = await resp.text();
  const base = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
  const lines = text.split(/\r?\n/);
  const variants = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
    const resM = line.match(/RESOLUTION=(\d+x\d+)/i);
    const res = resM ? resM[1] : 'HD';
    let q = 'HD';
    if (/1920|1080/.test(res)) q = '1080p';
    else if (/1280|720/.test(res)) q = '720p';
    else if (/854|480/.test(res)) q = '480p';
    else if (/640|360/.test(res)) q = '360p';
    const next = lines[i + 1]?.trim();
    if (next && !next.startsWith('#')) {
      variants.push({ quality: q, url: next.startsWith('http') ? next : base + next });
      i++;
    }
  }
  return variants;
}

async function extractFileId(html, lang) {
  let m = html.match(/data-id=["'](\d+)["']/i);
  if (m) return m[1];
  m = html.match(/data-file-id=["'](\d+)["']/i);
  if (m) return m[1];
  m = html.match(/(?:fileId|file_id|streamId|stream_id)\s*[=:]\s*["']?(\d+)["']?/i);
  if (m) return m[1];
  m = html.match(/getSources\?id=(\d+)/i);
  if (m) return m[1];
  m = html.match(/(?:iframe[^>]*src|src=)["'][^"']*\/(?:e|embed)\/(\d+)/i);
  if (m) return m[1];

  throw new Error(`data-id not found for lang=${lang}`);
}

async function megaExtractLang(malId, epNum, lang, workerOrigin) {
  const pageUrl = `https://megaplay.buzz/stream/mal/${malId}/${epNum}/${lang}?autostart=true`;
  const pageResp = await megaFetch(pageUrl);
  const html = await pageResp.text();

  const fileId = await extractFileId(html, lang);
  const data = await megaFetchRawSources(fileId);

  if (!data.sources?.file) throw new Error(`No sources.file for lang=${lang}`);
  const masterUrl = data.sources.file;

  let variants = [];
  try { variants = await megaParseMaster(masterUrl); } catch (_) { }

  const streams = [];
  variants.forEach((v, idx) => {
    streams.push({
      provider: 'megaplay',
      server: `MegaPlay · Live ${lang.toUpperCase()} ${idx + 1} (${v.quality})`,
      url: buildProxyUrl(workerOrigin, 'm3u8', v.url, [['ref', MEGAPLAY_REFERER]]),
      rawUrl: v.url,
      type: 'm3u8',
      quality: v.quality,
      lang,
      streamNum: idx + 1,
      source: 'megaplay',
      intro: data.intro,
      outro: data.outro,
    });
  });

  streams.push({
    provider: 'megaplay',
    server: `MegaPlay · Live ${lang.toUpperCase()} Master`,
    url: buildProxyUrl(workerOrigin, 'm3u8', masterUrl, [['ref', MEGAPLAY_REFERER]]),
    rawUrl: masterUrl,
    type: 'm3u8',
    quality: 'Master',
    lang,
    streamNum: variants.length + 1,
    source: 'megaplay',
    intro: data.intro,
    outro: data.outro,
  });

  return streams;
}

async function getMegaPlayAllStreams(malId, epNum, workerOrigin, requestedLang = 'both') {
  // 1. Database first
  try {
    const cached = await lookupMegaPlayDatabase(malId, epNum, workerOrigin);
    if (cached && cached.length) {
      if (requestedLang !== 'both') {
        const filtered = cached.filter(s => s.lang === requestedLang.toLowerCase());
        if (filtered.length) return filtered;
      }
      return cached;
    }
  } catch (_) { }

  // 2. Live extraction
  const langs = requestedLang === 'both' ? ['dub', 'sub'] : [requestedLang.toLowerCase()];
  const streams = [];
  await Promise.allSettled(
    langs.map(async (l) => {
      try {
        const res = await megaExtractLang(malId, epNum, l, workerOrigin);
        streams.push(...res);
      } catch (_) { }
    })
  );
  return streams;
}

async function handleApiMegaPlay(request, url, ctx) {
  const malId = url.searchParams.get('mal_id') || url.searchParams.get('id');
  const ep    = url.searchParams.get('ep') || url.searchParams.get('episode');
  const lang  = (url.searchParams.get('lang') || 'both').toLowerCase();
  if (!malId || !ep)
    return jsonResponse({ error: 'Missing mal_id and/or ep params' }, 400);

  const streams = await getMegaPlayAllStreams(malId, ep, url.origin, lang);
  if (!streams.length)
    return jsonResponse({ error: 'No MegaPlay streams found' }, 404);

  return jsonResponse({
    status: 'success',
    provider: 'megaplay',
    mal_id: parseInt(malId, 10),
    episode: parseInt(ep, 10),
    streams
  });
}

async function handleApiSources(request, url) {
  const id = url.searchParams.get('id');
  if (!id) return jsonResponse({ error: 'Missing id param' }, 400);
  try { return jsonResponse(await megaFetchRawSources(id)); }
  catch (err) { return jsonResponse({ error: err.message }, 502); }
}

async function handleApiCached(request, url) {
  const malId = url.searchParams.get('mal_id') || url.searchParams.get('id');
  const ep    = url.searchParams.get('ep') || url.searchParams.get('episode');
  if (!malId || !ep)
    return jsonResponse({ error: 'Missing mal_id and/or ep params' }, 400);

  const streams = await lookupMegaPlayDatabase(malId, ep, url.origin);
  if (!streams)
    return jsonResponse({ status: 'miss', mal_id: parseInt(malId, 10), episode: parseInt(ep, 10), streams: [] });

  return jsonResponse({ status: 'hit', mal_id: parseInt(malId, 10), episode: parseInt(ep, 10), streams });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ANISNATCH EXTRACTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

let _workerAniSnatchCache = null;
let _workerAniSnatchPromise = null;

async function fetchAniSnatchDatabase() {
  if (_workerAniSnatchCache && _workerAniSnatchCache.length) return _workerAniSnatchCache;
  if (_workerAniSnatchPromise) return _workerAniSnatchPromise;

  _workerAniSnatchPromise = Promise.all(
    ANISNATCH_JSON_FILES.map(f =>
      fetch(ANISNATCH_JSON_BASE + f, {
        headers: { 'User-Agent': DEFAULT_UA, 'Accept': 'application/json' },
        cf: { cacheTtl: 3600, cacheEverything: true }
      }).then(r => r.ok ? r.json() : []).catch(() => [])
    )
  ).then(res => {
    _workerAniSnatchCache = res.flat().filter(Boolean);
    _workerAniSnatchPromise = null;
    return _workerAniSnatchCache;
  });

  return _workerAniSnatchPromise;
}

async function lookupAniSnatchStreams(malId, epNum, workerOrigin, requestedLang = 'both') {
  const all = await fetchAniSnatchDatabase();
  if (!all || !all.length) return [];

  const mid = String(malId).trim();
  const ep  = String(epNum).trim();
  const langs = (requestedLang === 'both' || !requestedLang) ? ['dub', 'sub'] : [requestedLang.toLowerCase()];
  const streams = [];

  for (const lang of langs) {
    const key = `${mid}/${ep}==${lang}`;
    const altKey = `${mid}/${ep}==${lang === 'dub' ? 'sub' : 'dub'}`;
    const entry = all.find(e => e.mal_id_with_ep_and_stream_type === key) ||
                  (requestedLang === 'both' ? null : all.find(e => e.mal_id_with_ep_and_stream_type === altKey));

    if (!entry) continue;

    // 1. Allanime HLS Stream (Master / Variants)
    for (const q of ANISNATCH_Q_TIERS) {
      const qUrl = entry[`allanime_${q}`];
      if (qUrl) {
        streams.push({
          provider: 'anisnatch',
          server: `AniSnatch · AllanimeHD ${lang.toUpperCase()} (${q}p)`,
          url: buildProxyUrl(workerOrigin, 'm3u8', qUrl, [['ref', ANISNATCH_REFERER]]),
          rawUrl: qUrl,
          type: 'm3u8',
          quality: `${q}p`,
          lang: lang,
          source: 'anisnatch'
        });
      }
    }

    // 2. AniVibe
    if (entry.anivibe) {
      streams.push({
        provider: 'anisnatch',
        server: `AniSnatch · AniVibe (${lang.toUpperCase()})`,
        url: entry.anivibe,
        rawUrl: entry.anivibe,
        type: 'iframe',
        quality: 'HD',
        lang: lang,
        source: 'anisnatch'
      });
    }

    // 3. OkCDN
    const okRaw = entry.okcdn || entry.okcdn_iframe;
    if (okRaw) {
      streams.push({
        provider: 'anisnatch',
        server: `AniSnatch · OkCDN (${lang.toUpperCase()})`,
        url: okRaw,
        rawUrl: okRaw,
        type: 'iframe',
        quality: 'HD',
        lang: lang,
        source: 'anisnatch'
      });
    }

    // 4. AniCDN
    const cdnRaw = entry.anicdn_iframe || entry.anicdn;
    if (cdnRaw) {
      const m = cdnRaw.match(/\/anicdn\/([^\/]+)/);
      const cdnUrl = m ? `https://as-cdn21.top/video/${m[1]}` : cdnRaw;
      streams.push({
        provider: 'anisnatch',
        server: `AniSnatch · AniCDN (${lang.toUpperCase()})`,
        url: cdnUrl,
        rawUrl: cdnUrl,
        type: 'iframe',
        quality: 'Multi-Lang',
        lang: lang,
        source: 'anisnatch'
      });
    }
  }

  return streams;
}

async function handleApiAniSnatch(request, url) {
  const malId = url.searchParams.get('mal_id') || url.searchParams.get('id');
  const ep    = url.searchParams.get('ep') || url.searchParams.get('episode');
  const lang  = url.searchParams.get('lang') || 'both';

  if (!malId || !ep) {
    return jsonResponse({ error: 'Missing mal_id and/or ep params' }, 400);
  }

  try {
    const streams = await lookupAniSnatchStreams(malId, ep, url.origin, lang);
    return jsonResponse({
      status: streams.length ? 'success' : 'miss',
      provider: 'anisnatch',
      mal_id: parseInt(malId, 10),
      episode: parseInt(ep, 10),
      lang: lang,
      streams: streams
    });
  } catch (err) {
    return jsonResponse({ error: `AniSnatch extraction failed: ${err.message}` }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FLIXCLOUD EXTRACTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

const _anilistIdCache = new Map();

async function resolveAnilistId(malId) {
  const key = String(malId);
  if (_anilistIdCache.has(key)) return _anilistIdCache.get(key);

  // Try ani.zip first
  try {
    const res = await fetch(`https://api.ani.zip/mappings?mal_id=${malId}`, {
      headers: { 'User-Agent': DEFAULT_UA },
      cf: { cacheTtl: 86400, cacheEverything: true }
    });
    if (res.ok) {
      const data = await res.json();
      const aid = data?.mappings?.anilist_id;
      if (aid) {
        const idInt = parseInt(aid, 10);
        _anilistIdCache.set(key, idInt);
        return idInt;
      }
    }
  } catch (_) { }

  // Fallback AniList GraphQL
  try {
    const query = 'query ($malId: Int) { Media(idMal: $malId, type: ANIME) { id } }';
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': DEFAULT_UA },
      body: JSON.stringify({ query, variables: { malId: parseInt(malId, 10) } }),
      cf: { cacheTtl: 86400, cacheEverything: true }
    });
    if (res.ok) {
      const data = await res.json();
      const aid = data?.data?.Media?.id;
      if (aid) {
        const idInt = parseInt(aid, 10);
        _anilistIdCache.set(key, idInt);
        return idInt;
      }
    }
  } catch (_) { }

  return parseInt(malId, 10);
}

function formatFlixUrl(url, lang) {
  if (!url) return '';
  const audioTrack = (lang === 'sub' || lang === 's-sub' || lang === 'raw') ? '2' : '1';
  const params = `autoPlay=true&skI=false&skO=false&a=${audioTrack}`;
  let cleanUrl = url.replace(/([?&])(autoPlay|skI|skO|a)=[^&]*/gi, '').replace(/&+/g, '&').replace(/[?&]+$/, '');
  const sep = cleanUrl.includes('?') ? '&' : '?';
  return cleanUrl + sep + params;
}

async function lookupFlixCloudStreams(malId, epNum, requestedLang = 'both') {
  const anilistId = await resolveAnilistId(malId);
  const streams = [];

  // Primary: ReAnime Flix API
  try {
    const reUrl = `${REANIME_FLIX_API}/${anilistId}/${epNum}`;
    const res = await fetch(reUrl, {
      headers: { 'User-Agent': DEFAULT_UA, 'Referer': FLIXCLOUD_REFERER },
      cf: { cacheTtl: 1800, cacheEverything: true }
    });
    if (res.ok) {
      const body = await res.json();
      if (body?.success && Array.isArray(body.servers)) {
        for (const s of body.servers) {
          const link = s.dataLink;
          if (!link) continue;

          const rawType = (s.dataType || '').toLowerCase();
          const lang = rawType.includes('dub') ? 'dub' : 'sub';
          if (requestedLang !== 'both' && requestedLang.toLowerCase() !== lang) continue;

          const srvName = s.serverName || 'HD-1';
          const embedUrl = formatFlixUrl(link, lang);

          streams.push({
            provider: 'flixcloud',
            id: s.$id || `${srvName}-${lang}`,
            server: `FlixCloud · ${srvName} (${lang.toUpperCase()})`,
            url: embedUrl,
            rawUrl: link,
            type: 'iframe',
            quality: srvName,
            lang: lang,
            source: 'flixcloud'
          });
        }
      }
    }
  } catch (_) { }

  // Secondary: LunarAnime Fallback
  if (streams.length === 0) {
    try {
      const lunaUrl = `https://api.lunaranime.ru/api/3rdprovider?anilist=${anilistId}&episode=${epNum}&autoplay=true`;
      const res = await fetch(lunaUrl, {
        headers: { 'User-Agent': DEFAULT_UA },
        cf: { cacheTtl: 1800, cacheEverything: true }
      });
      if (res.ok) {
        const body = await res.json();
        const entries = (body?.data || []).filter(e => (e.player_url || '').includes('flixcloud.cc'));
        for (const entry of entries) {
          const lang = (entry.audio || '').toLowerCase().includes('dub') ? 'dub' : 'sub';
          if (requestedLang !== 'both' && requestedLang.toLowerCase() !== lang) continue;

          const srvName = entry.server || 'HD';
          const embedUrl = formatFlixUrl(entry.player_url, lang);

          streams.push({
            provider: 'flixcloud',
            id: `luna-${srvName}-${lang}`,
            server: `FlixCloud · ${srvName} (${lang.toUpperCase()})`,
            url: embedUrl,
            rawUrl: entry.player_url,
            type: 'iframe',
            quality: srvName,
            lang: lang,
            source: 'flixcloud'
          });
        }
      }
    } catch (_) { }
  }

  return streams;
}

async function handleApiFlixCloud(request, url) {
  const malId = url.searchParams.get('mal_id') || url.searchParams.get('id');
  const ep    = url.searchParams.get('ep') || url.searchParams.get('episode');
  const lang  = url.searchParams.get('lang') || 'both';

  if (!malId || !ep) {
    return jsonResponse({ error: 'Missing mal_id and/or ep params' }, 400);
  }

  try {
    const streams = await lookupFlixCloudStreams(malId, ep, lang);
    return jsonResponse({
      status: streams.length ? 'success' : 'miss',
      provider: 'flixcloud',
      mal_id: parseInt(malId, 10),
      episode: parseInt(ep, 10),
      lang: lang,
      streams: streams
    });
  } catch (err) {
    return jsonResponse({ error: `FlixCloud extraction failed: ${err.message}` }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ANIMEGG EXTRACTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

let _animeggDbCache = null;
let _animeggDatasetCache = null;

async function fetchAnimeGGDatabase() {
  if (_animeggDbCache) return _animeggDbCache;
  try {
    const res = await fetch(ANIMEGG_PREEXTRACTED_URL, {
      headers: { 'User-Agent': DEFAULT_UA },
      cf: { cacheTtl: 3600, cacheEverything: true }
    });
    if (res.ok) {
      _animeggDbCache = await res.json();
      return _animeggDbCache;
    }
  } catch (_) { }
  return [];
}

async function fetchAnimeGGDatasets() {
  if (_animeggDatasetCache) return _animeggDatasetCache;
  try {
    const promises = ANIMEGG_DATASET_URLS.map(u =>
      fetch(u, {
        headers: { 'User-Agent': DEFAULT_UA },
        cf: { cacheTtl: 3600, cacheEverything: true }
      }).then(r => r.ok ? r.json() : []).catch(() => [])
    );
    const results = await Promise.all(promises);
    _animeggDatasetCache = results.flat();
    return _animeggDatasetCache;
  } catch (_) {
    return [];
  }
}

async function lookupAnimeGGStreams(malId, epNum, workerOrigin, requestedLang = 'both') {
  const streams = [];
  const preData = await fetchAnimeGGDatabase();
  const entry = (preData || []).find(item => String(item.mal_id) === String(malId));

  if (entry) {
    const epInt = parseInt(epNum, 10);
    const resolutions = ['1080p', '720p', '480p', '360p'];
    const langs = requestedLang === 'both' ? ['dub', 'sub'] : [requestedLang.toLowerCase()];

    for (const lang of langs) {
      for (const res of resolutions) {
        const key = `${lang}_ep_${epInt}_${res}`;
        const mp4Url = entry[key];
        if (mp4Url) {
          streams.push({
            provider: 'animegg',
            server: `AnimeGG · ${lang.toUpperCase()} (${res})`,
            url: buildProxyUrl(workerOrigin, 'proxy', mp4Url, [['referer', ANIMEGG_REFERER]]),
            rawUrl: mp4Url,
            type: 'mp4',
            quality: res,
            lang: lang,
            source: 'db'
          });
        }
      }
    }
  }

  if (streams.length === 0) {
    const datasets = await fetchAnimeGGDatasets();
    const animeEntry = datasets.find(item => item.mal_id === parseInt(malId, 10));
    if (animeEntry) {
      const matchingEp = (animeEntry.episodes || []).find(ep => ep.ep === parseInt(epNum, 10));
      if (matchingEp) {
        if (matchingEp.dub && (requestedLang === 'both' || requestedLang.toLowerCase() === 'dub')) {
          streams.push({
            provider: 'animegg',
            server: 'AnimeGG · DUB (Embed)',
            url: matchingEp.dub,
            rawUrl: matchingEp.dub,
            type: 'iframe',
            quality: 'Embed',
            lang: 'dub',
            source: 'live'
          });
        }
        if (matchingEp.sub && (requestedLang === 'both' || requestedLang.toLowerCase() === 'sub')) {
          streams.push({
            provider: 'animegg',
            server: 'AnimeGG · SUB (Embed)',
            url: matchingEp.sub,
            rawUrl: matchingEp.sub,
            type: 'iframe',
            quality: 'Embed',
            lang: 'sub',
            source: 'live'
          });
        }
      }
    }
  }

  return streams;
}

async function handleApiAnimeGG(request, url) {
  const malId = url.searchParams.get('mal_id') || url.searchParams.get('id');
  const ep    = url.searchParams.get('ep') || url.searchParams.get('episode');
  const lang  = url.searchParams.get('lang') || 'both';

  if (!malId || !ep) {
    return jsonResponse({ error: 'Missing mal_id and/or ep params' }, 400);
  }

  try {
    const streams = await lookupAnimeGGStreams(malId, ep, url.origin, lang);
    return jsonResponse({
      status: streams.length ? 'success' : 'miss',
      provider: 'animegg',
      mal_id: parseInt(malId, 10),
      episode: parseInt(ep, 10),
      lang: lang,
      streams: streams
    });
  } catch (err) {
    return jsonResponse({ error: `AnimeGG extraction failed: ${err.message}` }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ANIDB EXTRACTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

const WORKER_PROXY_FALLBACK = 'https://old-sun-d12a.andruilsyestems.workers.dev';
const _anidbSeriesCache = new Map();
const _anidbMediaCache  = new Map();

async function anidbFetch(targetUrl, referer = `${ANIDB_BASE}/`, isXhr = false) {
  try {
    const headers = {
      'User-Agent': DEFAULT_UA,
      'Referer': referer,
      'Accept': isXhr ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    };
    if (isXhr) headers['X-Requested-With'] = 'XMLHttpRequest';
    const res = await fetch(targetUrl, {
      headers,
      cf: { cacheTtl: 3600, cacheEverything: true }
    });
    if (res.ok) return await res.text();
  } catch (_) {}

  // Fallback to proxy worker if blocked outside CF edge
  try {
    const proxyEndpoint = `${WORKER_PROXY_FALLBACK}/?url=${encodeURIComponent(targetUrl)}&ref=${encodeURIComponent(referer)}${isXhr ? '&xhr=1' : ''}`;
    const pRes = await fetch(proxyEndpoint);
    if (pRes.ok) return await pRes.text();
  } catch (_) {}

  return '';
}

async function anidbFetchJson(targetUrl, referer = `${ANIDB_BASE}/`) {
  const text = await anidbFetch(targetUrl, referer, true);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function decodeEntities(s = '') {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .trim();
}

function stripTags(htmlStr = '') {
  if (!htmlStr) return '';
  return decodeEntities(htmlStr.replace(/<[^>]*>/g, ''));
}

function attr(tagStr, name) {
  const m = tagStr.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'));
  return m ? m[1] : '';
}

async function resolveAnimeMeta(identifier) {
  const raw = String(identifier).trim();
  const meta = {
    malId: null,
    anilistId: null,
    anidbId: null,
    titles: new Set()
  };

  if (!raw) return meta;

  if (/^\d+$/.test(raw)) {
    const numId = parseInt(raw, 10);
    meta.malId = numId;

    // 1. Check ani.zip mapping by mal_id
    try {
      const res = await fetch(`https://api.ani.zip/mappings?mal_id=${numId}`, {
        headers: { 'User-Agent': DEFAULT_UA },
        cf: { cacheTtl: 86400, cacheEverything: true }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.mappings?.anilist_id) meta.anilistId = parseInt(data.mappings.anilist_id, 10);
        if (data.mappings?.anidb_id) meta.anidbId = parseInt(data.mappings.anidb_id, 10);
        if (data.titles) {
          for (const v of Object.values(data.titles)) {
            if (typeof v === 'string' && v.trim()) meta.titles.add(v.trim());
          }
        }
      }
    } catch (_) {}

    // 2. Check ani.zip mapping by anilist_id
    if (!meta.titles.size) {
      try {
        const res = await fetch(`https://api.ani.zip/mappings?anilist_id=${numId}`, {
          headers: { 'User-Agent': DEFAULT_UA },
          cf: { cacheTtl: 86400, cacheEverything: true }
        });
        if (res.ok) {
          const data = await res.json();
          meta.anilistId = numId;
          if (data.mappings?.mal_id) meta.malId = parseInt(data.mappings.mal_id, 10);
          if (data.mappings?.anidb_id) meta.anidbId = parseInt(data.mappings.anidb_id, 10);
          if (data.titles) {
            for (const v of Object.values(data.titles)) {
              if (typeof v === 'string' && v.trim()) meta.titles.add(v.trim());
            }
          }
        }
      } catch (_) {}
    }

    // 3. Fallback to Jikan MAL API
    if (!meta.titles.size && meta.malId) {
      try {
        const jRes = await fetch(`https://api.jikan.moe/v4/anime/${meta.malId}`, {
          headers: { 'User-Agent': DEFAULT_UA },
          cf: { cacheTtl: 86400, cacheEverything: true }
        });
        if (jRes.ok) {
          const jData = await jRes.json();
          const d = jData?.data;
          if (d?.title) meta.titles.add(d.title);
          if (d?.title_english) meta.titles.add(d.title_english);
          if (d?.title_japanese) meta.titles.add(d.title_japanese);
          if (Array.isArray(d?.titles)) {
            d.titles.forEach(t => t.title && meta.titles.add(t.title));
          }
        }
      } catch (_) {}
    }

    // 4. Try AniList GraphQL
    if (meta.anilistId || meta.malId) {
      const aid = meta.anilistId;
      const media = await getAniListMedia(aid, meta.malId);
      if (media) {
        if (!meta.anilistId && media.id) meta.anilistId = media.id;
        if (!meta.malId && media.idMal) meta.malId = media.idMal;
        buildAniDBTitles(media).forEach(t => meta.titles.add(t));
      }
    }
  } else {
    // Non-numeric query (Title search)
    meta.titles.add(raw);
    try {
      const q = `query ($search: String) { Media(search: $search, type: ANIME) { id idMal title { english romaji native } synonyms } }`;
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': DEFAULT_UA },
        body: JSON.stringify({ query: q, variables: { search: raw } }),
        cf: { cacheTtl: 86400, cacheEverything: true }
      });
      if (res.ok) {
        const d = await res.json();
        const media = d?.data?.Media;
        if (media) {
          meta.anilistId = media.id;
          meta.malId = media.idMal;
          buildAniDBTitles(media).forEach(t => meta.titles.add(t));
        }
      }
    } catch (_) {}
  }

  return meta;
}

async function getAniListMedia(anilistId, malId = null) {
  const aid = Number(anilistId);
  if (aid && _anidbMediaCache.has(aid)) return _anidbMediaCache.get(aid);

  const query = `query ($id: Int, $idMal: Int) { Media (id: $id, idMal: $idMal, type: ANIME) { id idMal title { english romaji native } status format episodes seasonYear synonyms bannerImage coverImage { extraLarge large } } }`;
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': DEFAULT_UA },
      body: JSON.stringify({ query, variables: { id: aid || undefined, idMal: malId ? Number(malId) : undefined } }),
      cf: { cacheTtl: 86400, cacheEverything: true }
    });
    if (res.ok) {
      const data = await res.json();
      const media = data?.data?.Media || null;
      if (media && aid) _anidbMediaCache.set(aid, media);
      return media;
    }
  } catch (_) {}
  return null;
}

function buildAniDBTitles(media) {
  const titles = [];
  if (media?.title) {
    for (const k of ['english', 'romaji', 'native']) {
      if (media.title[k]) titles.push(media.title[k]);
    }
  }
  if (Array.isArray(media?.synonyms)) {
    for (const syn of media.synonyms) {
      if (syn) titles.push(syn);
    }
  }
  return [...new Set(titles)].filter(t => typeof t === 'string' && t.trim().length > 0);
}

async function searchAniDB(query) {
  const html = await anidbFetch(`${ANIDB_BASE}/search/suggestions?q=${encodeURIComponent(query)}`, `${ANIDB_BASE}/home`, true);
  const results = [];
  for (const m of html.matchAll(/<a\b[^>]*data-search-item\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const tag = m[0].match(/<a\b[^>]*>/i)?.[0] ?? '';
    const href = attr(tag, 'href');
    const path = href.startsWith('http') ? new URL(href).pathname : href;
    const slug = path.match(/^\/anime\/([^/?#]+)/)?.[1];
    if (!slug) continue;
    const titleRaw = m[0].match(/<p\b[^>]*class=["'][^"']*text-sm[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
    const metaRaw = m[0].match(/<p\b[^>]*class=["'][^"']*text-xs[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
    const title = stripTags(titleRaw);
    const meta = stripTags(metaRaw);
    const siteId = Number(slug.match(/-(\d+)$/)?.[1]);
    results.push({ slug, title: title || slug.replace(/-/g, ' '), meta, siteId });
  }
  if (results.length) return results;

  const browseHtml = await anidbFetch(`${ANIDB_BASE}/browse?q=${encodeURIComponent(query)}`, `${ANIDB_BASE}/home`, false);
  const seen = new Set();
  for (const m of browseHtml.matchAll(/<a\b[^>]*href=["'](?:https:\/\/anidb\.app)?\/anime\/([^"']+)["'][^>]*class=["'][^"']*\banime-card\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    const cardHtml = m[0];
    const tMatch = cardHtml.match(/title=["']([^"']+)["']/i) || cardHtml.match(/alt=["']([^"']+)["']/i);
    const title = stripTags(tMatch?.[1] ?? '') || slug.replace(/-/g, ' ');
    const siteId = Number(slug.match(/-(\d+)$/)?.[1]);
    results.push({ slug, title, meta: '', siteId });
  }
  return results;
}

function parseAniDBExternalIds(htmlStr) {
  return {
    anilistId: Number(htmlStr.match(/https:\/\/anilist\.co\/anime\/(\d+)/i)?.[1]) || null,
    malId: Number(htmlStr.match(/https:\/\/myanimelist\.net\/anime\/(\d+)/i)?.[1]) || null,
    anidbId: Number(htmlStr.match(/https:\/\/anidb\.net\/anime\/(\d+)/i)?.[1]) || null,
    kitsuId: Number(htmlStr.match(/https:\/\/kitsu\.app\/anime\/(\d+)/i)?.[1]) || null,
  };
}

async function resolveAniDBSeries(meta) {
  const cacheKey = `anidb:series:${meta.malId || meta.anilistId || Array.from(meta.titles)[0]}`;
  if (_anidbSeriesCache.has(cacheKey)) return _anidbSeriesCache.get(cacheKey);

  const titles = Array.from(meta.titles);
  const queries = new Set();

  for (const title of titles.slice(0, 5)) {
    queries.add(title);
    const words = title.trim().split(/\s+/);
    if (words.length > 4) queries.add(words.slice(0, 4).join(' '));
  }

  const candidates = new Map();
  await Promise.all(Array.from(queries).slice(0, 6).filter(q => q.length >= 2).map(async (q) => {
    try {
      const res = await searchAniDB(q);
      for (const r of res) {
        if (!candidates.has(r.slug)) candidates.set(r.slug, r);
      }
    } catch (_) {}
  }));

  for (const candidate of candidates.values()) {
    const html = await anidbFetch(`${ANIDB_BASE}/anime/${candidate.slug}`, `${ANIDB_BASE}/home`, false);
    if (!html) continue;

    const ids = parseAniDBExternalIds(html);
    const pageTitleMatch = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    const data = {
      slug: candidate.slug,
      siteId: candidate.siteId || Number(candidate.slug.match(/-(\d+)$/)?.[1]),
      title: stripTags(pageTitleMatch) || candidate.title,
      ...ids
    };

    if (meta.anilistId && ids.anilistId === meta.anilistId) {
      data.matchType = 'anilist';
      data.matchScore = 1;
      _anidbSeriesCache.set(cacheKey, data);
      return data;
    }

    if (meta.malId && ids.malId === meta.malId) {
      data.matchType = 'mal';
      data.matchScore = 0.95;
      _anidbSeriesCache.set(cacheKey, data);
      return data;
    }

    if (meta.anidbId && ids.anidbId === meta.anidbId) {
      data.matchType = 'anidb';
      data.matchScore = 0.9;
      _anidbSeriesCache.set(cacheKey, data);
      return data;
    }
  }

  // If first candidate matched directly
  if (candidates.size > 0) {
    const first = Array.from(candidates.values())[0];
    const data = {
      slug: first.slug,
      siteId: first.siteId || Number(first.slug.match(/-(\d+)$/)?.[1]),
      title: first.title,
      matchType: 'fuzzy',
      matchScore: 0.7
    };
    _anidbSeriesCache.set(cacheKey, data);
    return data;
  }

  return null;
}

async function fetchAniDBProviderEpisodes(siteId) {
  const data = await anidbFetchJson(`${ANIDB_BASE}/api/frontend/anime/${siteId}/episodes`, `${ANIDB_BASE}/anime/${siteId}`);
  return Array.isArray(data?.episodes) ? data.episodes : [];
}

async function fetchAniDBLanguages(episodeId, seriesSlug) {
  const data = await anidbFetchJson(`${ANIDB_BASE}/api/frontend/episode/${episodeId}/languages`, `${ANIDB_BASE}/anime/${seriesSlug}`);
  return Array.isArray(data?.languages) ? data.languages : [];
}

function extractAniDBHls(htmlStr) {
  const patterns = [
    /file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
    /sources\s*:\s*\[\s*\{[^}]*file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
    /["'](https?:\/\/[^"']+\/master\.m3u8[^"']*)["']/i,
    /["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i,
  ];
  for (const pattern of patterns) {
    const m = htmlStr.match(pattern);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

async function lookupAniDBStreams(identifier, epNum, workerOrigin, requestedLang = 'both') {
  const meta = await resolveAnimeMeta(identifier);
  const series = await resolveAniDBSeries(meta);
  if (!series || !series.siteId) return [];

  const episodes = await fetchAniDBProviderEpisodes(series.siteId);
  const cleanEp = parseInt(String(epNum).replace(/\D+/g, ''), 10) || 1;
  const episode = episodes.find(e => parseInt(e.number, 10) === cleanEp);
  if (!episode || !episode.id) return [];

  const languages = await fetchAniDBLanguages(episode.id, series.slug);
  if (!languages.length) return [];

  const audStr = String(requestedLang || 'both').toLowerCase();
  const audiosToFetch = audStr === 'sub' ? ['sub'] : (audStr === 'dub' ? ['dub'] : ['dub', 'sub']);

  const streams = [];

  for (const aud of audiosToFetch) {
    const preferred = aud === 'sub' ? ['jpn', 'ja', 'japanese'] : ['eng', 'en', 'english'];
    const language = languages.find(l => preferred.includes(String(l.code ?? '').toLowerCase()))
                  || languages.find(l => preferred.includes(String(l.name ?? '').toLowerCase()))
                  || null;

    if (!language || !language.embed_url) continue;

    const embedUrl = decodeEntities(language.embed_url);
    let hlsUrl = null;
    let embedOrigin = ANIDB_REFERER;

    try {
      embedOrigin = new URL(embedUrl).origin + '/';
      const html = await anidbFetch(embedUrl, ANIDB_REFERER, false);
      if (html) {
        hlsUrl = extractAniDBHls(html);
      }
    } catch (_) {}

    if (hlsUrl) {
      streams.push({
        provider: 'anidb',
        server: `AniDB · ${aud.toUpperCase()} (HLS Master)`,
        url: buildProxyUrl(workerOrigin, 'm3u8', hlsUrl, [['ref', embedOrigin]]),
        rawUrl: hlsUrl,
        embedUrl: embedUrl,
        type: 'm3u8',
        quality: 'Master',
        lang: aud,
        source: 'anidb'
      });
    }

    streams.push({
      provider: 'anidb',
      server: `AniDB · ${aud.toUpperCase()} (Embed)`,
      url: embedUrl,
      rawUrl: embedUrl,
      type: 'iframe',
      quality: 'Embed',
      lang: aud,
      source: 'anidb'
    });
  }

  return streams;
}

async function handleApiAniDB(request, url) {
  const malId = url.searchParams.get('mal_id') || url.searchParams.get('id') || url.searchParams.get('anilist_id') || url.searchParams.get('q');
  const ep    = url.searchParams.get('ep') || url.searchParams.get('episode') || '1';
  const lang  = url.searchParams.get('lang') || 'both';

  if (!malId) {
    return jsonResponse({ error: 'Missing mal_id and/or ep params' }, 400);
  }

  try {
    const streams = await lookupAniDBStreams(malId, ep, url.origin, lang);
    return jsonResponse({
      status: streams.length ? 'success' : 'miss',
      provider: 'anidb',
      mal_id: parseInt(malId, 10) || malId,
      episode: parseInt(ep, 10) || 1,
      lang: lang,
      streams: streams
    });
  } catch (err) {
    return jsonResponse({ error: `AniDB extraction failed: ${err.message}` }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UNIFIED MULTI-PROVIDER AGGREGATOR ENDPOINT (/api/merged)
// ═══════════════════════════════════════════════════════════════════════════════

async function handleApiMerged(request, url, ctx) {
  const malId    = url.searchParams.get('mal_id') || url.searchParams.get('id');
  const ep       = url.searchParams.get('ep') || url.searchParams.get('episode');
  const provider = (url.searchParams.get('provider') || 'all').toLowerCase();
  const lang     = (url.searchParams.get('lang') || 'both').toLowerCase();

  if (!malId || !ep) {
    return jsonResponse({ error: 'Missing mal_id and/or ep query params' }, 400);
  }

  let megaplayList = [];
  let flixList = [];
  let anisnatchList = [];
  let animeggList = [];
  let anidbList = [];

  const tasks = [];
  if (provider === 'all' || provider === 'megaplay') {
    tasks.push(getMegaPlayAllStreams(malId, ep, url.origin, lang).then(res => { megaplayList = res; }).catch(() => {}));
  }
  if (provider === 'all' || provider === 'flixcloud') {
    tasks.push(lookupFlixCloudStreams(malId, ep, lang).then(res => { flixList = res; }).catch(() => {}));
  }
  if (provider === 'all' || provider === 'anisnatch') {
    tasks.push(lookupAniSnatchStreams(malId, ep, url.origin, lang).then(res => { anisnatchList = res; }).catch(() => {}));
  }
  if (provider === 'all' || provider === 'animegg') {
    tasks.push(lookupAnimeGGStreams(malId, ep, url.origin, lang).then(res => { animeggList = res; }).catch(() => {}));
  }
  if (provider === 'all' || provider === 'anidb') {
    tasks.push(lookupAniDBStreams(malId, ep, url.origin, lang).then(res => { anidbList = res; }).catch(() => {}));
  }

  await Promise.all(tasks);

  const combined = [].concat(megaplayList, flixList, anisnatchList, animeggList, anidbList);

  if (!combined.length) {
    return jsonResponse({
      status: 'miss',
      mal_id: parseInt(malId, 10),
      episode: parseInt(ep, 10),
      provider,
      streams: []
    }, 404);
  }

  return jsonResponse({
    status: 'success',
    mal_id: parseInt(malId, 10),
    episode: parseInt(ep, 10),
    provider,
    count: combined.length,
    streams: combined
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HEALTH CHECK ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════

async function handleApiHealth(request, url) {
  const checks = {};
  try {
    const db = await fetchMegaPlayDatabase();
    const count = Object.keys(db?.entries ?? db ?? {}).length;
    checks.megaplay_database = { ok: true, entries: count };
  } catch (e) {
    checks.megaplay_database = { ok: false, error: e.message };
  }

  try {
    const ani = await fetchAniSnatchDatabase();
    checks.anisnatch_database = { ok: true, entries: ani.length };
  } catch (e) {
    checks.anisnatch_database = { ok: false, error: e.message };
  }

  try {
    const resp = await megaFetch('https://megaplay.buzz/', {});
    checks.megaplay_live = { ok: resp.ok, status: resp.status };
  } catch (e) {
    checks.megaplay_live = { ok: false, error: e.message };
  }

  try {
    const resp = await fetch('https://anidb.app/home', {
      headers: { 'User-Agent': DEFAULT_UA },
      cf: { cacheTtl: 300 }
    });
    checks.anidb_live = { ok: resp.ok, status: resp.status };
  } catch (e) {
    checks.anidb_live = { ok: false, error: e.message };
  }

  const allOk = Object.values(checks).some(c => c.ok);
  return jsonResponse({
    healthy: allOk,
    providers: ['megaplay', 'flixcloud', 'anisnatch', 'animegg', 'anidb'],
    checks
  }, allOk ? 200 : 502);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HLS REVERSE PROXY (PLAYLIST / SEGMENT / TXT)
// ═══════════════════════════════════════════════════════════════════════════════

function handleHome(url) { return htmlResponse(HTML); }

async function handlePlaylist(request, url, ctx) {
  const target = url.searchParams.get('url');
  if (!target) return textResponse('Missing "url" query parameter.', 400);
  const upstreamHeaders = buildUpstreamHeaders(url.searchParams);
  const passthrough = passthroughParams(url.searchParams);
  const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
  const swrKey = new Request(swrCacheKeyUrl(target, upstreamHeaders), { headers: upstreamHeaders });

  if (cache) {
    const hit = await cache.match(swrKey);
    if (hit) {
      const age = Date.now() - Number(hit.headers.get('X-Cached-At') || 0);
      if (age < PLAYLIST_SWR_WINDOW * 1000) {
        if (age > PLAYLIST_CACHE_TTL * 1000 && ctx?.waitUntil)
          ctx.waitUntil(refreshPlaylist(target, url.origin, upstreamHeaders, passthrough, swrKey, cache, ctx).catch(() => {}));
        const h = new Headers(hit.headers); applyCors(h); h.set('X-Cache-Status', 'HIT-SWR');
        return new Response(hit.body, { status: 200, headers: h });
      }
    }
  }

  const { response, error } = await refreshPlaylist(target, url.origin, upstreamHeaders, passthrough, swrKey, cache, ctx);
  return error || response;
}

async function refreshPlaylist(target, workerOrigin, upstreamHeaders, passthrough, swrKey, cache, ctx) {
  let up;
  try {
    up = await fetch(target, {
      headers: upstreamHeaders, redirect: 'follow',
      cf: { cacheTtl: PLAYLIST_CACHE_TTL, cacheEverything: false },
    });
  } catch (err) { return { error: textResponse(`Failed to fetch playlist: ${err.message}`, 502) }; }
  if (!up.ok) return { error: textResponse(`Upstream ${up.status}`, up.status) };

  const bodyText = await up.text();
  const segmentUrls = [];
  const rewritten = rewritePlaylist(bodyText, target, workerOrigin, passthrough, segmentUrls);
  const headers = corsHeaders();
  headers.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
  headers.set('Cache-Control', `public, max-age=${PLAYLIST_CACHE_TTL}`);
  headers.set('X-Cache-Status', 'MISS');
  headers.set('X-Cached-At', String(Date.now()));
  const response = new Response(rewritten, { status: 200, headers });

  if (cache && ctx?.waitUntil) {
    ctx.waitUntil(cache.put(swrKey, response.clone()));
    if (segmentUrls.length)
      ctx.waitUntil(prefetchSegments(segmentUrls.slice(0, PREFETCH_SEGMENT_COUNT), upstreamHeaders));
  }
  return { response: response.clone() };
}

function swrCacheKeyUrl(target, headers) {
  try {
    const u = new URL(target);
    u.searchParams.set('__ref', headers.get('Referer') || '');
    u.searchParams.set('__ua', headers.get('User-Agent') || '');
    return u.toString();
  } catch {
    return target;
  }
}

async function handleSegment(request, url, ctx) {
  const target = url.searchParams.get('url');
  if (!target) return textResponse('Missing "url" query parameter.', 400);
  const upstreamHeaders = buildUpstreamHeaders(url.searchParams);
  const range = request.headers.get('Range');
  if (range) upstreamHeaders.set('Range', range);
  const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
  const cacheKey = new Request(target, { headers: upstreamHeaders });

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const h = new Headers(cached.headers); applyCors(h);
      return new Response(cached.body, { status: cached.status, headers: h });
    }
  }

  let up;
  try {
    up = await fetch(target, {
      headers: upstreamHeaders, redirect: 'follow',
      cf: { cacheTtl: SEGMENT_CACHE_TTL, cacheEverything: true },
    });
  } catch (err) { return textResponse(`Failed to fetch segment: ${err.message}`, 502); }

  const h = new Headers(up.headers); applyCors(h);

  // Set correct binary / video MIME type for video segments (even if named .jpg or .html)
  const inferredMime = guessContentType(target);
  const existingMime = (h.get('Content-Type') || '').toLowerCase();
  if (!existingMime || existingMime.includes('text/html') || existingMime.includes('image/')) {
    h.set('Content-Type', inferredMime);
  }

  h.set('Cache-Control', `public, max-age=${SEGMENT_CACHE_TTL}`);
  h.set('Accept-Ranges', 'bytes');
  const result = new Response(up.body, { status: up.status, statusText: up.statusText, headers: h });
  if (cache && ctx?.waitUntil && up.status === 200 && !range) ctx.waitUntil(cache.put(cacheKey, result.clone()));
  return result;
}

async function handleTxt(request, url, ctx) {
  const target = url.searchParams.get('url');
  if (!target) return textResponse('Missing "url" query parameter.', 400);
  const upstreamHeaders = buildUpstreamHeaders(url.searchParams);
  const passthrough = passthroughParams(url.searchParams);
  let up;
  try { up = await fetch(target, { headers: upstreamHeaders, redirect: 'follow' }); }
  catch (err) { return textResponse(`Failed to fetch txt: ${err.message}`, 502); }
  if (!up.ok) return textResponse(`Upstream ${up.status}`, up.status);
  const bodyText = await up.text();
  const trimmed = bodyText.trim();
  const headers = corsHeaders();
  if (trimmed.startsWith('#EXTM3U') || trimmed.includes('#EXT-X-')) {
    const segmentUrls = [];
    const rewritten = rewritePlaylist(bodyText, target, url.origin, passthrough, segmentUrls);
    if (segmentUrls.length && ctx?.waitUntil)
      ctx.waitUntil(prefetchSegments(segmentUrls.slice(0, PREFETCH_SEGMENT_COUNT), upstreamHeaders));
    headers.set('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    return new Response(rewritten, { status: 200, headers });
  }
  const lines = trimmed.split(/\r?\n/).map(line =>
    line.replace(/(https?:\/\/[^\s,"]+)/g, m => buildProxyUrl(url.origin, classifyUri(m), m, passthrough))
  );
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response(lines.join('\n'), { status: 200, headers });
}

function rewritePlaylist(text, baseUrl, workerOrigin, passthrough, collectSegmentUrls) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], t = line.trim();
    if (t === '') { out.push(line); continue; }
    if (t.startsWith('#')) {
      if (/URI="([^"]+)"/.test(t)) {
        out.push(t.replace(/URI="([^"]+)"/, (_, uri) => {
          const abs = resolveUrl(uri, baseUrl);
          const kind = tagImpliesPlaylist(t) ? 'm3u8' : classifyUri(abs);
          if (kind === 'segment' && collectSegmentUrls) collectSegmentUrls.push(abs);
          return `URI="${buildProxyUrl(workerOrigin, kind, abs, passthrough)}"`;
        }));
      } else { out.push(line); }
      continue;
    }
    const abs = resolveUrl(t, baseUrl);
    const kind = classifyUri(abs);
    if (kind === 'segment' && collectSegmentUrls) collectSegmentUrls.push(abs);
    out.push(buildProxyUrl(workerOrigin, kind, abs, passthrough));
  }
  return out.join('\n');
}

function tagImpliesPlaylist(tag) {
  return tag.startsWith('#EXT-X-MEDIA') || tag.startsWith('#EXT-X-I-FRAME-STREAM-INF');
}

function classifyUri(uri) {
  const c = uri.split('?')[0].split('#')[0].toLowerCase();
  if (c.endsWith('.m3u8') || c.endsWith('.m3u')) return 'm3u8';
  if (/type=m3u8|format=m3u8|\.m3u8($|&)|urlset\/master/.test(uri.toLowerCase())) return 'm3u8';
  return 'segment';
}

function buildProxyUrl(workerOrigin, kind, absoluteUrl, passthrough = []) {
  const u = new URL(kind === 'm3u8' ? '/m3u8' : (kind === 'proxy' ? '/proxy' : '/segment'), workerOrigin);
  u.searchParams.set('url', absoluteUrl);
  for (const [k, v] of passthrough) u.searchParams.set(k, v);
  return u.toString();
}

function resolveUrl(rel, base) {
  try { return new URL(rel, base).toString(); } catch { return rel; }
}

async function prefetchSegments(urls, upstreamHeaders) {
  const cache = (typeof caches !== 'undefined' && caches.default) ? caches.default : null;
  if (!cache) return;
  const unique = [...new Set(urls)];
  let cursor = 0;
  async function worker() {
    while (cursor < unique.length) {
      const target = unique[cursor++];
      const cacheKey = new Request(target, { headers: upstreamHeaders });
      try {
        if (await cache.match(cacheKey)) continue;
        const resp = await fetch(target, { headers: upstreamHeaders, cf: { cacheTtl: SEGMENT_CACHE_TTL, cacheEverything: true } });
        if (resp.status === 200) {
          const h = new Headers(resp.headers);
          const mime = guessContentType(target);
          h.set('Content-Type', mime);
          h.set('Cache-Control', `public, max-age=${SEGMENT_CACHE_TTL}`);
          h.set('Accept-Ranges', 'bytes');
          await cache.put(cacheKey, new Response(resp.body, { status: 200, headers: h }));
        }
      } catch (_) { }
    }
  }
  await Promise.allSettled(Array.from({ length: Math.min(PREFETCH_CONCURRENCY, unique.length) }, () => worker()));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GENERAL PROXY (/proxy) FOR MP4 / IFRAMES / FETCH
// ═══════════════════════════════════════════════════════════════════════════════

async function handleProxy(request, parsedUrl) {
  const targetRaw = parsedUrl.searchParams.get('url');
  let referer     = parsedUrl.searchParams.get('referer') || parsedUrl.searchParams.get('ref');

  if (!targetRaw) return jsonError(400, 'Missing ?url= parameter');

  if (!referer) {
    if (targetRaw.includes('flixcloud')) referer = FLIXCLOUD_REFERER;
    else if (targetRaw.includes('megaplay') || targetRaw.includes('watching.onl')) referer = MEGAPLAY_REFERER;
    else if (targetRaw.includes('anisnatch')) referer = ANISNATCH_REFERER;
    else if (targetRaw.includes('anidb')) referer = ANIDB_REFERER;
    else referer = ANIMEGG_REFERER;
  }

  let target;
  try {
    target = new URL(targetRaw);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error('bad protocol');
  } catch {
    return jsonError(400, 'Invalid target URL: ' + targetRaw);
  }

  const upHeaders = buildBrowserHeaders(request, referer);
  const range = request.headers.get('Range');
  if (range) upHeaders.set('Range', range);

  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: upHeaders,
      redirect: 'follow',
    });
  } catch (err) {
    return jsonError(502, 'Upstream fetch failed: ' + err.message);
  }

  const resHeaders = new Headers(corsHeaders());
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag', 'cache-control']) {
    const v = upstream.headers.get(h);
    if (v) resHeaders.set(h, v);
  }

  return new Response(upstream.body, {
    status:  upstream.status,
    headers: resHeaders,
  });
}

function buildBrowserHeaders(originalRequest, referer) {
  let origin = ANIMEGG_REFERER;
  try { origin = new URL(referer).origin; } catch {}

  return new Headers({
    'User-Agent': DEFAULT_UA,
    'Referer':    referer,
    'Origin':     origin,
    'Accept':     originalRequest.headers.get('Accept') || '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control':   'no-cache',
    'Pragma':          'no-cache',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const PASSTHROUGH_KEYS = ['ref', 'org', 'origin', 'ua', 'cookie'];
function passthroughParams(sp) {
  const entries = [];
  for (const key of PASSTHROUGH_KEYS) { const v = sp.get(key); if (v) entries.push([key, v]); }
  if (!sp.get('ref')) entries.push(['ref', MEGAPLAY_REFERER]);
  return entries;
}

function buildUpstreamHeaders(sp) {
  const h = new Headers();
  h.set('User-Agent', sp.get('ua') ? safeDecode(sp.get('ua')) : DEFAULT_UA);
  h.set('Referer', safeDecode(sp.get('ref') || MEGAPLAY_REFERER));
  const org = sp.get('org') || sp.get('origin');
  if (org) h.set('Origin', safeDecode(org));
  const cookie = sp.get('cookie');
  if (cookie) h.set('Cookie', safeDecode(cookie));
  h.set('Accept', '*/*');
  return h;
}

function safeDecode(v) { try { return decodeURIComponent(v); } catch { return v; } }

function corsHeaders() {
  const h = new Headers();
  applyCors(h);
  return h;
}

function applyCors(h) {
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  h.set('Access-Control-Allow-Headers', '*');
  h.set('Access-Control-Expose-Headers', '*');
  h.delete('Content-Security-Policy');
  h.delete('X-Frame-Options');
}

function textResponse(msg, status = 200) {
  const h = corsHeaders();
  h.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response(msg, { status, headers: h });
}

function htmlResponse(html, status = 200) {
  const h = corsHeaders();
  h.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(html, { status, headers: h });
}

function jsonResponse(obj, status = 200) {
  const h = corsHeaders();
  h.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(obj, null, 2), { status, headers: h });
}

function jsonError(status, message) {
  return jsonResponse({ error: message }, status);
}

function guessContentType(url) {
  const c = url.split('?')[0].toLowerCase();
  if (c.endsWith('.ts')) return 'video/mp2t';
  if (c.endsWith('.m4s')) return 'video/iso.segment';
  if (c.endsWith('.mp4')) return 'video/mp4';
  if (c.endsWith('.key') || c.endsWith('.bin')) return 'application/octet-stream';
  if (c.endsWith('.vtt')) return 'text/vtt';
  if (c.endsWith('.aac')) return 'audio/aac';
  // MegaPlay and other scrapers mask TS segments as .jpg, .html, .png, .jpeg
  if (c.includes('seg-') || c.includes('/segment') || c.endsWith('.jpg') || c.endsWith('.png') || c.endsWith('.html') || c.endsWith('.jpeg')) {
    return 'video/mp2t';
  }
  return 'video/mp2t';
}