/**
 * KuroStream — Anime Web Application
 * Powered by AniList GraphQL API (Ultra Fast & Reliable)
 * Video Server: https://animeg-flixcloud.ytbro8326.workers.dev/?mal_id={id}&ep={ep}&lang={sub|dub}
 */

(function () {
  'use strict';

  // API & Stream Config
  const CONFIG = {
    STREAM_BASE_URL: 'https://animeg-flixcloud.ytbro8326.workers.dev/',
    ANILIST_API_URL: 'https://graphql.anilist.co',
    CACHE_KEY_PREFIX: 'kuro_anilist_',
    WATCHLIST_STORAGE_KEY: 'kuro_watchlist_v3',
    HISTORY_STORAGE_KEY: 'kuro_history_v3',
    DEFAULT_MAL_ID: 1735, // Naruto: Shippuuden
    DEFAULT_EP: 250,
    DEFAULT_LANG: 'dub'
  };

  // Application State
  const state = {
    currentMalId: null,
    currentEp: 1,
    currentLang: 'dub',
    currentAnimeData: null,
    totalEpisodes: 12,
    activeChunkIndex: 0,
    watchlist: [],
    history: []
  };

  // DOM Elements
  const DOM = {
    navbar: document.getElementById('mainNavbar'),
    logoBtn: document.getElementById('logoBtn'),
    searchInput: document.getElementById('searchInput'),
    searchContainer: document.getElementById('searchContainer'),
    searchDropdown: document.getElementById('searchDropdown'),
    searchLoader: document.getElementById('searchLoader'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    mobileSearchToggleBtn: document.getElementById('mobileSearchToggleBtn'),

    // Mobile Navigation Drawer & Bottom Bar
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    mobileNavDrawer: document.getElementById('mobileNavDrawer'),
    mobileNavOverlay: document.getElementById('mobileNavOverlay'),
    closeMobileNavBtn: document.getElementById('closeMobileNavBtn'),
    drawerQuickIdBtn: document.getElementById('drawerQuickIdBtn'),
    mobileDrawerWatchlistCount: document.getElementById('mobileDrawerWatchlistCount'),
    bottomNavWatchlistBadge: document.getElementById('bottomNavWatchlistBadge'),
    mobileBottomNav: document.getElementById('mobileBottomNav'),
    
    // Player
    playerSection: document.getElementById('playerSection'),
    videoContainer: document.getElementById('videoContainer'),
    animeIframe: document.getElementById('animeIframe'),
    iframeLoader: document.getElementById('iframeLoader'),
    serverUrlText: document.getElementById('serverUrlText'),
    playerAnimeTitle: document.getElementById('playerAnimeTitle'),
    playerEpBadge: document.getElementById('playerEpBadge'),
    playerLangBadge: document.getElementById('playerLangBadge'),
    backToHomeBtn: document.getElementById('backToHomeBtn'),
    reloadPlayerBtn: document.getElementById('reloadPlayerBtn'),
    theaterModeBtn: document.getElementById('theaterModeBtn'),
    shareStreamBtn: document.getElementById('shareStreamBtn'),
    bookmarkBtn: document.getElementById('bookmarkBtn'),
    langSubBtn: document.getElementById('langSubBtn'),
    langDubBtn: document.getElementById('langDubBtn'),
    prevEpBtn: document.getElementById('prevEpBtn'),
    nextEpBtn: document.getElementById('nextEpBtn'),
    quickEpInput: document.getElementById('quickEpInput'),
    quickEpGoBtn: document.getElementById('quickEpGoBtn'),
    totalEpLabel: document.getElementById('totalEpLabel'),
    episodesGrid: document.getElementById('episodesGrid'),
    epChunksBar: document.getElementById('epChunksBar'),
    epSelectorCount: document.getElementById('epSelectorCount'),
    epSearchFilter: document.getElementById('epSearchFilter'),
    
    // Anime Meta
    detailPoster: document.getElementById('detailPoster'),
    detailTitle: document.getElementById('detailTitle'),
    detailTitleJp: document.getElementById('detailTitleJp'),
    detailScore: document.getElementById('detailScore'),
    detailType: document.getElementById('detailType'),
    detailStatus: document.getElementById('detailStatus'),
    detailYear: document.getElementById('detailYear'),
    detailRating: document.getElementById('detailRating'),
    detailMalId: document.getElementById('detailMalId'),
    detailEpisodes: document.getElementById('detailEpisodes'),
    detailStudios: document.getElementById('detailStudios'),
    detailDuration: document.getElementById('detailDuration'),
    detailGenres: document.getElementById('detailGenres'),
    detailSynopsis: document.getElementById('detailSynopsis'),
    malProfileLink: document.getElementById('malProfileLink'),
    
    // Sections & Grids
    trendingGrid: document.getElementById('trendingGrid'),
    topRatedGrid: document.getElementById('topRatedGrid'),
    searchResultsSection: document.getElementById('searchResultsSection'),
    searchResultsGrid: document.getElementById('searchResultsGrid'),
    searchQueryLabel: document.getElementById('searchQueryLabel'),
    closeSearchResultsBtn: document.getElementById('closeSearchResultsBtn'),
    continueWatchingSection: document.getElementById('continueWatchingSection'),
    continueWatchingGrid: document.getElementById('continueWatchingGrid'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    watchlistSection: document.getElementById('watchlist'),
    watchlistGrid: document.getElementById('watchlistGrid'),
    watchlistCount: document.getElementById('watchlistCount'),
    genreChips: document.getElementById('genreChips'),
    
    // Modals
    quickModal: document.getElementById('quickModal'),
    quickIdBtn: document.getElementById('quickIdBtn'),
    closeQuickModal: document.getElementById('closeQuickModal'),
    cancelQuickModal: document.getElementById('cancelQuickModal'),
    launchDirectStream: document.getElementById('launchDirectStream'),
    directMalId: document.getElementById('directMalId'),
    directEp: document.getElementById('directEp'),
    directLang: document.getElementById('directLang'),
    toastContainer: document.getElementById('toastContainer')
  };

  /* ==========================================================================
     Helper Utilities & Local Storage
     ========================================================================== */
  
  function showToast(message, icon = 'fa-check-circle') {
    if (!DOM.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid ${icon} highlight-cyan"></i> <span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function loadStorage(key, fallback = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  /* ==========================================================================
     AniList GraphQL API Client (Fast, No Rate Limits)
     ========================================================================== */

  async function executeGraphQL(query, variables = {}) {
    const cacheKey = CONFIG.CACHE_KEY_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify({ query, variables })))).replace(/=/g, '');
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
          return parsed.data;
        }
      } catch (e) {}
    }

    try {
      const response = await fetch(CONFIG.ANILIST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        throw new Error(`GraphQL Error: ${response.status}`);
      }

      const result = await response.json();
      if (result && result.data) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: result.data
          }));
        } catch (e) {}
        return result.data;
      }
      return null;
    } catch (err) {
      console.warn('AniList GraphQL request failed:', err);
      return null;
    }
  }

  /**
   * Format AniList media item into standard KuroStream anime object
   */
  function normalizeAniListAnime(media) {
    if (!media) return null;
    const malId = media.idMal || media.id;
    const title = media.title ? (media.title.english || media.title.romaji || media.title.native) : `Anime #${malId}`;
    const score = media.averageScore ? (media.averageScore / 10).toFixed(1) : (media.score ? media.score.toFixed(1) : 'N/A');
    const poster = (media.coverImage && (media.coverImage.extraLarge || media.coverImage.large || media.coverImage.medium))
      || (media.images && media.images.webp && media.images.webp.large_image_url)
      || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400';

    const studiosList = media.studios && media.studios.nodes && media.studios.nodes.length 
      ? media.studios.nodes.map(s => s.name).join(', ') 
      : 'Animation Studio';

    let totalAiredEpisodes = media.episodes || null;
    const isAiring = media.status === 'RELEASING' || media.status === 'AIRING' || !media.status;

    if (media.nextAiringEpisode && media.nextAiringEpisode.episode) {
      totalAiredEpisodes = media.nextAiringEpisode.episode - 1;
    }

    return {
      mal_id: malId,
      anilist_id: media.id,
      title: title,
      title_japanese: media.title ? media.title.native : '',
      score: score,
      episodes: totalAiredEpisodes,
      isAiring: isAiring,
      nextEpisode: media.nextAiringEpisode ? media.nextAiringEpisode.episode : null,
      year: media.seasonYear || media.year || '2024',
      type: media.format || 'TV',
      status: media.status === 'RELEASING' ? 'Airing' : (media.status === 'FINISHED' ? 'Finished' : (media.status || 'Finished')),
      rating: 'PG-13',
      synopsis: stripHtml(media.description) || 'Watch this anime in HD with SUB and DUB.',
      poster: poster,
      bannerImage: media.bannerImage || '',
      genres: media.genres || ['Action', 'Fantasy'],
      studios: studiosList,
      duration: media.duration ? `${media.duration} min/ep` : '24 min/ep'
    };
  }

  async function getAnimeDetails(malId) {
    malId = Number(malId);
    const query = `
      query ($idMal: Int) {
        Media (idMal: $idMal, type: ANIME) {
          id
          idMal
          title { romaji english native }
          description
          episodes
          nextAiringEpisode { episode timeUntilAiring }
          averageScore
          bannerImage
          coverImage { extraLarge large medium }
          genres
          studios(isMain: true) { nodes { name } }
          status
          seasonYear
          format
          duration
        }
      }
    `;

    const res = await executeGraphQL(query, { idMal: malId });
    if (res && res.Media) {
      return normalizeAniListAnime(res.Media);
    }

    // Fallback if MAL ID wasn't directly matched
    return {
      mal_id: malId,
      title: `Anime #${malId}`,
      title_japanese: '',
      score: '8.0',
      episodes: 24,
      isAiring: false,
      year: '2024',
      type: 'TV',
      status: 'Finished',
      rating: 'PG-13',
      synopsis: 'Streaming directly from video server with MyAnimeList ID mapping.',
      poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400',
      bannerImage: '',
      genres: ['Anime', 'Action'],
      studios: 'Animation Studio',
      duration: '24 min/ep'
    };
  }

  async function fetchTrendingAnime() {
    const query = `
      query {
        Page (page: 1, perPage: 12) {
          media (type: ANIME, sort: TRENDING_DESC, isAdult: false) {
            id
            idMal
            title { romaji english native }
            coverImage { extraLarge large medium }
            bannerImage
            averageScore
            episodes
            nextAiringEpisode { episode }
            format
            status
            seasonYear
            genres
          }
        }
      }
    `;
    const res = await executeGraphQL(query);
    if (res && res.Page && res.Page.media) {
      return res.Page.media.map(normalizeAniListAnime);
    }
    return [];
  }

  async function fetchTopRatedAnime() {
    const query = `
      query {
        Page (page: 1, perPage: 12) {
          media (type: ANIME, sort: SCORE_DESC, isAdult: false) {
            id
            idMal
            title { romaji english native }
            coverImage { extraLarge large medium }
            bannerImage
            averageScore
            episodes
            nextAiringEpisode { episode }
            format
            status
            seasonYear
            genres
          }
        }
      }
    `;
    const res = await executeGraphQL(query);
    if (res && res.Page && res.Page.media) {
      return res.Page.media.map(normalizeAniListAnime);
    }
    return [];
  }

  async function searchAnime(searchText) {
    if (!searchText || searchText.trim().length < 2) return [];
    const query = `
      query ($search: String) {
        Page (page: 1, perPage: 16) {
          media (type: ANIME, search: $search, isAdult: false) {
            id
            idMal
            title { romaji english native }
            coverImage { extraLarge large medium }
            averageScore
            episodes
            nextAiringEpisode { episode }
            format
            status
            seasonYear
            genres
          }
        }
      }
    `;
    const res = await executeGraphQL(query, { search: searchText.trim() });
    if (res && res.Page && res.Page.media) {
      return res.Page.media.map(normalizeAniListAnime);
    }
    return [];
  }

  async function fetchAnimeByGenre(genreName) {
    if (!genreName) return fetchTrendingAnime();
    const query = `
      query ($genre: String) {
        Page (page: 1, perPage: 12) {
          media (type: ANIME, genre: $genre, sort: POPULARITY_DESC, isAdult: false) {
            id
            idMal
            title { romaji english native }
            coverImage { extraLarge large medium }
            averageScore
            episodes
            nextAiringEpisode { episode }
            format
            status
            seasonYear
            genres
          }
        }
      }
    `;
    const res = await executeGraphQL(query, { genre: genreName });
    if (res && res.Page && res.Page.media) {
      return res.Page.media.map(normalizeAniListAnime);
    }
    return [];
  }

  /* ==========================================================================
     Streaming Player Core Logic
     ========================================================================== */

  /**
   * Load Anime Stream into the Iframe
   */
  async function loadStream(malId, episode = 1, lang = 'dub', shouldScroll = true) {
    malId = Number(malId) || CONFIG.DEFAULT_MAL_ID;
    episode = Math.max(1, Number(episode) || 1);
    lang = (lang === 'sub' || lang === 'dub') ? lang : 'dub';

    state.currentMalId = malId;
    state.currentEp = episode;
    state.currentLang = lang;

    // Show Player Section
    DOM.playerSection.classList.remove('hidden');

    // Update Player UI Badges
    DOM.playerEpBadge.textContent = `EP ${episode}`;
    DOM.playerLangBadge.textContent = lang.toUpperCase();
    DOM.quickEpInput.value = episode;

    // Set Active Sub/Dub buttons
    DOM.langDubBtn.classList.toggle('active', lang === 'dub');
    DOM.langSubBtn.classList.toggle('active', lang === 'sub');

    // Build the clean stream iframe URL:
    const streamUrl = `${CONFIG.STREAM_BASE_URL}?mal_id=${malId}&ep=${episode}&lang=${lang}`;
    
    // Update iframe placeholder loader
    DOM.iframeLoader.classList.remove('hidden');
    DOM.serverUrlText.textContent = streamUrl;

    DOM.animeIframe.onload = () => {
      DOM.iframeLoader.classList.add('hidden');
    };

    DOM.animeIframe.src = streamUrl;

    // Sync URL hash / query parameters for bookmarking & sharing
    updateUrlParams(malId, episode, lang);

    // Scroll to player smoothly (optimized for mobile full-screen viewing)
    if (shouldScroll) {
      const scrollTarget = DOM.videoContainer || DOM.playerSection;
      scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Fetch Full Anime Metadata
    renderLoadingAnimeDetails(malId);
    const anime = await getAnimeDetails(malId);
    state.currentAnimeData = anime;
    renderAnimeDetails(anime, episode);

    // Save to Watch History
    saveWatchHistory(anime, episode, lang);
  }

  function updateUrlParams(malId, ep, lang) {
    const params = new URLSearchParams(window.location.search);
    params.set('mal_id', malId);
    params.set('ep', ep);
    params.set('lang', lang);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({ malId, ep, lang }, '', newUrl);
  }

  function renderLoadingAnimeDetails(malId) {
    DOM.playerAnimeTitle.textContent = `Anime #${malId}`;
    DOM.detailTitle.textContent = 'Loading anime details...';
    DOM.detailSynopsis.textContent = 'Fetching metadata from AniList database...';
  }

  function renderAnimeDetails(anime, currentEp) {
    if (!anime) return;

    DOM.playerAnimeTitle.textContent = anime.title || `Anime #${anime.mal_id}`;
    DOM.detailTitle.textContent = anime.title || 'Untitled Anime';
    DOM.detailTitleJp.textContent = anime.title_japanese || '';
    DOM.detailScore.innerHTML = `<i class="fa-solid fa-star"></i> ${anime.score || 'N/A'}`;
    DOM.detailType.textContent = anime.type || 'TV';
    DOM.detailStatus.textContent = anime.status || 'Finished';
    DOM.detailYear.textContent = anime.year || '2024';
    DOM.detailRating.textContent = anime.rating || 'PG-13';
    DOM.detailMalId.textContent = anime.mal_id;
    
    const totalEps = anime.episodes || Math.max(currentEp, 1);
    state.totalEpisodes = totalEps;
    
    if (anime.isAiring) {
      DOM.detailEpisodes.textContent = `${totalEps} Episodes Aired (Ongoing)`;
      DOM.detailStatus.textContent = 'Airing';
      DOM.totalEpLabel.textContent = `/ ${totalEps}`;
      DOM.epSelectorCount.textContent = `${totalEps} Eps Aired`;
    } else {
      DOM.detailEpisodes.textContent = `${totalEps} Episodes`;
      DOM.detailStatus.textContent = anime.status || 'Finished';
      DOM.totalEpLabel.textContent = `/ ${totalEps}`;
      DOM.epSelectorCount.textContent = `${totalEps} Total Eps`;
    }

    // Studio & Duration
    DOM.detailStudios.textContent = anime.studios || 'Studio';
    DOM.detailDuration.textContent = anime.duration || '24 min/ep';

    // Poster Image
    DOM.detailPoster.src = anime.poster;

    // Genres Tags
    DOM.detailGenres.innerHTML = '';
    if (anime.genres && anime.genres.length) {
      anime.genres.forEach(g => {
        const tag = document.createElement('span');
        tag.className = 'genre-tag';
        tag.textContent = typeof g === 'string' ? g : g.name;
        DOM.detailGenres.appendChild(tag);
      });
    }

    // Synopsis
    DOM.detailSynopsis.textContent = anime.synopsis || 'No synopsis available.';

    // External MAL Link
    DOM.malProfileLink.href = `https://myanimelist.net/anime/${anime.mal_id}`;

    // Render Episode Selector Buttons
    renderEpisodeSelector(totalEps, currentEp);

    // Update Bookmark status icon
    updateBookmarkButtonState(anime.mal_id);
  }

  /**
   * Render Episode Selector with Chunking for Long Anime
   */
  function renderEpisodeSelector(total, currentEp) {
    const CHUNK_SIZE = 100;
    DOM.epChunksBar.innerHTML = '';
    DOM.episodesGrid.innerHTML = '';

    const numChunks = Math.ceil(total / CHUNK_SIZE);
    state.activeChunkIndex = Math.floor((currentEp - 1) / CHUNK_SIZE);

    if (numChunks > 1) {
      DOM.epChunksBar.style.display = 'flex';
      for (let i = 0; i < numChunks; i++) {
        const start = i * CHUNK_SIZE + 1;
        const end = Math.min((i + 1) * CHUNK_SIZE, total);
        const chunkBtn = document.createElement('button');
        chunkBtn.className = `ep-chunk-btn ${i === state.activeChunkIndex ? 'active' : ''}`;
        chunkBtn.textContent = `${start}-${end}`;
        chunkBtn.addEventListener('click', () => {
          document.querySelectorAll('.ep-chunk-btn').forEach(b => b.classList.remove('active'));
          chunkBtn.classList.add('active');
          state.activeChunkIndex = i;
          renderEpisodeGridChunk(start, end, currentEp);
        });
        DOM.epChunksBar.appendChild(chunkBtn);
      }
    } else {
      DOM.epChunksBar.style.display = 'none';
    }

    const startEp = state.activeChunkIndex * CHUNK_SIZE + 1;
    const endEp = Math.min((state.activeChunkIndex + 1) * CHUNK_SIZE, total);
    renderEpisodeGridChunk(startEp, endEp, currentEp);
  }

  function renderEpisodeGridChunk(start, end, activeEp) {
    DOM.episodesGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let ep = start; ep <= end; ep++) {
      const epBtn = document.createElement('button');
      epBtn.className = `ep-btn ${ep === Number(activeEp) ? 'active' : ''}`;
      epBtn.textContent = `EP ${ep}`;
      epBtn.dataset.ep = ep;
      epBtn.addEventListener('click', () => {
        loadStream(state.currentMalId, ep, state.currentLang, false);
      });
      fragment.appendChild(epBtn);
    }
    DOM.episodesGrid.appendChild(fragment);

    // Scroll active episode into view in the grid
    const activeBtn = DOM.episodesGrid.querySelector('.ep-btn.active');
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ==========================================================================
     Watch History & Watchlist (Local Storage)
     ========================================================================== */

  function saveWatchHistory(anime, ep, lang) {
    if (!anime || !anime.mal_id) return;
    let history = loadStorage(CONFIG.HISTORY_STORAGE_KEY, []);
    
    // Remove if already exists
    history = history.filter(item => item.mal_id !== anime.mal_id);

    history.unshift({
      mal_id: anime.mal_id,
      title: anime.title || `Anime #${anime.mal_id}`,
      ep: ep,
      lang: lang,
      poster: anime.poster || '',
      totalEps: anime.episodes || '?',
      timestamp: Date.now()
    });

    if (history.length > 20) history = history.slice(0, 20);
    saveStorage(CONFIG.HISTORY_STORAGE_KEY, history);
    state.history = history;
    renderContinueWatching();
  }

  function renderContinueWatching() {
    const history = loadStorage(CONFIG.HISTORY_STORAGE_KEY, []);
    state.history = history;

    if (history.length === 0) {
      DOM.continueWatchingSection.classList.add('hidden');
      return;
    }

    DOM.continueWatchingSection.classList.remove('hidden');
    DOM.continueWatchingGrid.innerHTML = '';

    history.forEach(item => {
      const card = document.createElement('div');
      card.className = 'anime-card';
      card.innerHTML = `
        <div class="card-poster-wrapper">
          <img src="${item.poster}" alt="${item.title}" class="card-poster" loading="lazy">
          <div class="card-badges">
            <span class="card-score"><i class="fa-solid fa-clock"></i> Ep ${item.ep}</span>
            <span class="card-eps">${(item.lang || 'dub').toUpperCase()}</span>
          </div>
          <div class="card-play-overlay">
            <div class="play-btn-circle"><i class="fa-solid fa-play"></i></div>
          </div>
        </div>
        <div class="card-info">
          <h3 class="card-title">${item.title}</h3>
          <div class="card-subtext">
            <span>Resume Ep ${item.ep} (${(item.lang || 'dub').toUpperCase()})</span>
            <span class="highlight-cyan"><i class="fa-solid fa-circle-play"></i></span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        loadStream(item.mal_id, item.ep, item.lang || 'dub');
      });
      DOM.continueWatchingGrid.appendChild(card);
    });
  }

  function toggleWatchlist(anime) {
    if (!anime) return;
    let watchlist = loadStorage(CONFIG.WATCHLIST_STORAGE_KEY, []);
    const existsIndex = watchlist.findIndex(item => item.mal_id === anime.mal_id);

    if (existsIndex > -1) {
      watchlist.splice(existsIndex, 1);
      showToast(`Removed "${anime.title}" from Watchlist`, 'fa-trash');
    } else {
      watchlist.unshift({
        mal_id: anime.mal_id,
        title: anime.title,
        score: anime.score || 'N/A',
        episodes: anime.episodes || '?',
        poster: anime.poster || '',
        addedAt: Date.now()
      });
      showToast(`Saved "${anime.title}" to Watchlist!`, 'fa-bookmark');
    }

    saveStorage(CONFIG.WATCHLIST_STORAGE_KEY, watchlist);
    state.watchlist = watchlist;
    updateBookmarkButtonState(anime.mal_id);
    renderWatchlist();
  }

  function updateBookmarkButtonState(malId) {
    const watchlist = loadStorage(CONFIG.WATCHLIST_STORAGE_KEY, []);
    const isSaved = watchlist.some(item => item.mal_id === Number(malId));
    if (DOM.bookmarkBtn) {
      DOM.bookmarkBtn.innerHTML = isSaved ? '<i class="fa-solid fa-bookmark highlight-pink"></i>' : '<i class="fa-regular fa-bookmark"></i>';
      DOM.bookmarkBtn.title = isSaved ? 'Remove from Watchlist' : 'Add to Watchlist';
    }
    syncWatchlistBadges(watchlist.length);
  }

  function syncWatchlistBadges(count) {
    if (DOM.watchlistCount) DOM.watchlistCount.textContent = count;
    if (DOM.mobileDrawerWatchlistCount) DOM.mobileDrawerWatchlistCount.textContent = count;
    if (DOM.bottomNavWatchlistBadge) {
      DOM.bottomNavWatchlistBadge.textContent = count;
      DOM.bottomNavWatchlistBadge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  function renderWatchlist() {
    const watchlist = loadStorage(CONFIG.WATCHLIST_STORAGE_KEY, []);
    state.watchlist = watchlist;
    syncWatchlistBadges(watchlist.length);

    if (watchlist.length === 0) {
      DOM.watchlistGrid.innerHTML = `
        <div class="empty-state">
          <i class="fa-regular fa-bookmark"></i>
          <p>Your watchlist is empty! Browse anime and click the bookmark button to save them here.</p>
        </div>
      `;
      return;
    }

    DOM.watchlistGrid.innerHTML = '';
    watchlist.forEach(anime => {
      const card = createAnimeCardElement(anime, (a) => loadStream(a.mal_id, 1, 'dub'));
      DOM.watchlistGrid.appendChild(card);
    });
  }

  /* ==========================================================================
     Anime Card UI Builders
     ========================================================================== */

  function createAnimeCardElement(anime, onClick) {
    const card = document.createElement('div');
    card.className = 'anime-card';

    const poster = anime.poster || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400';
    const score = anime.score || 'N/A';
    const epCount = anime.episodes ? `${anime.episodes} EPS` : 'AIRING';
    const type = anime.type || 'TV';
    const year = anime.year || '';

    card.innerHTML = `
      <div class="card-poster-wrapper">
        <img src="${poster}" alt="${anime.title}" class="card-poster" loading="lazy">
        <div class="card-badges">
          <span class="card-score"><i class="fa-solid fa-star"></i> ${score}</span>
          <span class="card-eps">${epCount}</span>
        </div>
        <div class="card-play-overlay">
          <div class="play-btn-circle"><i class="fa-solid fa-play"></i></div>
        </div>
      </div>
      <div class="card-info">
        <h3 class="card-title" title="${anime.title}">${anime.title}</h3>
        <div class="card-subtext">
          <span>${type} ${year ? '• ' + year : ''}</span>
          <span class="highlight-pink"><i class="fa-solid fa-circle-play"></i> Play (DUB)</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      if (onClick) onClick(anime);
      else loadStream(anime.mal_id, 1, 'dub');
    });

    return card;
  }

  function renderGrid(container, animeList) {
    container.innerHTML = '';
    if (!animeList || animeList.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No anime found.</p></div>';
      return;
    }
    animeList.forEach(anime => {
      const card = createAnimeCardElement(anime, (a) => loadStream(a.mal_id, 1, 'dub'));
      container.appendChild(card);
    });
  }

  /* ==========================================================================
     Live Search Autocomplete & Results
     ========================================================================== */

  let searchDebounceTimeout = null;

  function initSearch() {
    DOM.searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      DOM.clearSearchBtn.style.display = query ? 'block' : 'none';

      clearTimeout(searchDebounceTimeout);
      if (query.length < 2) {
        DOM.searchDropdown.classList.remove('show');
        DOM.searchLoader.style.display = 'none';
        return;
      }

      DOM.searchLoader.style.display = 'block';
      searchDebounceTimeout = setTimeout(async () => {
        const results = await searchAnime(query);
        DOM.searchLoader.style.display = 'none';
        renderSearchDropdown(results, query);
      }, 300);
    });

    DOM.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = DOM.searchInput.value.trim();
        if (query) {
          DOM.searchDropdown.classList.remove('show');
          DOM.searchContainer.classList.remove('mobile-active');
          performFullSearch(query);
        }
      }
    });

    DOM.clearSearchBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      DOM.clearSearchBtn.style.display = 'none';
      DOM.searchDropdown.classList.remove('show');
      DOM.searchInput.focus();
    });

    // Mobile search toggle button
    if (DOM.mobileSearchToggleBtn) {
      DOM.mobileSearchToggleBtn.addEventListener('click', () => {
        DOM.searchContainer.classList.toggle('mobile-active');
        if (DOM.searchContainer.classList.contains('mobile-active')) {
          DOM.searchInput.focus();
        }
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!DOM.searchInput.contains(e.target) && 
          !DOM.searchDropdown.contains(e.target) && 
          (!DOM.mobileSearchToggleBtn || !DOM.mobileSearchToggleBtn.contains(e.target))) {
        DOM.searchDropdown.classList.remove('show');
        if (window.innerWidth <= 540) {
          DOM.searchContainer.classList.remove('mobile-active');
        }
      }
    });

    DOM.closeSearchResultsBtn.addEventListener('click', () => {
      DOM.searchResultsSection.classList.add('hidden');
    });
  }

  function renderSearchDropdown(results, query) {
    if (!results || results.length === 0) {
      DOM.searchDropdown.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: var(--text-dim); font-size: 0.85rem;">
          No anime found matching "${query}".
        </div>
      `;
      DOM.searchDropdown.classList.add('show');
      return;
    }

    DOM.searchDropdown.innerHTML = '';
    const slice = results.slice(0, 6);

    slice.forEach(anime => {
      const item = document.createElement('div');
      item.className = 'search-item';

      item.innerHTML = `
        <img src="${anime.poster}" alt="${anime.title}" class="search-item-thumb">
        <div class="search-item-info">
          <div class="search-item-title">${anime.title}</div>
          <div class="search-item-meta">
            <span class="search-item-score"><i class="fa-solid fa-star"></i> ${anime.score || 'N/A'}</span>
            <span>${anime.type || 'TV'}</span>
            <span>${anime.episodes ? anime.episodes + ' eps' : 'Airing'}</span>
          </div>
        </div>
      `;
      item.addEventListener('click', () => {
        DOM.searchDropdown.classList.remove('show');
        DOM.searchContainer.classList.remove('mobile-active');
        DOM.searchInput.value = '';
        DOM.clearSearchBtn.style.display = 'none';
        loadStream(anime.mal_id, 1, 'dub');
      });
      DOM.searchDropdown.appendChild(item);
    });

    const viewAll = document.createElement('div');
    viewAll.className = 'search-item';
    viewAll.style.justifyContent = 'center';
    viewAll.style.color = 'var(--accent-cyan)';
    viewAll.style.fontWeight = '700';
    viewAll.innerHTML = `<i class="fa-solid fa-arrow-right"></i> View all results for "${query}"`;
    viewAll.addEventListener('click', () => {
      DOM.searchDropdown.classList.remove('show');
      DOM.searchContainer.classList.remove('mobile-active');
      performFullSearch(query);
    });
    DOM.searchDropdown.appendChild(viewAll);

    DOM.searchDropdown.classList.add('show');
  }

  async function performFullSearch(query) {
    DOM.searchQueryLabel.textContent = `"${query}"`;
    DOM.searchResultsSection.classList.remove('hidden');
    DOM.searchResultsGrid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
    DOM.searchResultsSection.scrollIntoView({ behavior: 'smooth' });

    const results = await searchAnime(query);
    renderGrid(DOM.searchResultsGrid, results);
  }

  /* ==========================================================================
     Event Listeners & Unified Navigation Synchronization
     ========================================================================== */

  function initEventListeners() {
    function closePlayerAndGoHome() {
      DOM.playerSection.classList.add('hidden');
      DOM.animeIframe.src = '';
      DOM.searchResultsSection.classList.add('hidden');
      window.history.replaceState({}, '', window.location.pathname);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Back to home button
    DOM.backToHomeBtn.addEventListener('click', closePlayerAndGoHome);

    // Logo click -> go to home
    DOM.logoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closePlayerAndGoHome();
      setActiveNavTarget('home');
    });

    // Sub / Dub toggles (Default DUB)
    DOM.langDubBtn.addEventListener('click', () => {
      if (state.currentLang !== 'dub') {
        loadStream(state.currentMalId, state.currentEp, 'dub', false);
        showToast('Switched to English DUB', 'fa-microphone-lines');
      }
    });

    DOM.langSubBtn.addEventListener('click', () => {
      if (state.currentLang !== 'sub') {
        loadStream(state.currentMalId, state.currentEp, 'sub', false);
        showToast('Switched to Japanese SUB', 'fa-closed-captioning');
      }
    });

    // Episode Next / Prev buttons
    DOM.prevEpBtn.addEventListener('click', () => {
      if (state.currentEp > 1) {
        loadStream(state.currentMalId, state.currentEp - 1, state.currentLang, false);
      } else {
        showToast('Already at Episode 1', 'fa-info-circle');
      }
    });

    DOM.nextEpBtn.addEventListener('click', () => {
      const maxEp = state.totalEpisodes || 9999;
      if (state.currentEp < maxEp) {
        loadStream(state.currentMalId, state.currentEp + 1, state.currentLang, false);
      } else {
        showToast('Reached the latest episode', 'fa-info-circle');
      }
    });

    // Quick Episode Jump Input
    DOM.quickEpGoBtn.addEventListener('click', () => {
      const ep = parseInt(DOM.quickEpInput.value, 10);
      if (ep && ep >= 1) {
        loadStream(state.currentMalId, ep, state.currentLang, false);
      }
    });

    DOM.quickEpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        DOM.quickEpGoBtn.click();
      }
    });

    // Mini Episode filter inside episode selector
    DOM.epSearchFilter.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const ep = parseInt(DOM.epSearchFilter.value, 10);
        if (ep && ep >= 1) {
          loadStream(state.currentMalId, ep, state.currentLang, false);
          DOM.epSearchFilter.value = '';
        }
      }
    });

    // Player Actions
    DOM.reloadPlayerBtn.addEventListener('click', () => {
      const src = DOM.animeIframe.src;
      DOM.iframeLoader.classList.remove('hidden');
      DOM.animeIframe.src = '';
      setTimeout(() => {
        DOM.animeIframe.src = src;
      }, 100);
      showToast('Reloading video stream...', 'fa-rotate-right');
    });

    DOM.theaterModeBtn.addEventListener('click', () => {
      document.body.classList.toggle('theater-mode');
      if (DOM.playerSection) DOM.playerSection.classList.toggle('player-enlarged');
      const isTheater = document.body.classList.contains('theater-mode') || (DOM.playerSection && DOM.playerSection.classList.contains('player-enlarged'));
      DOM.theaterModeBtn.innerHTML = isTheater ? '<i class="fa-solid fa-compress"></i>' : '<i class="fa-solid fa-expand"></i>';
      showToast(isTheater ? 'Big Cinema Player Mode ON' : 'Standard Player Mode', isTheater ? 'fa-compress' : 'fa-expand');
    });

    DOM.shareStreamBtn.addEventListener('click', () => {
      const shareUrl = window.location.href;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Shareable anime link copied to clipboard!', 'fa-copy');
      }).catch(() => {
        showToast(`URL: ${shareUrl}`, 'fa-link');
      });
    });

    DOM.bookmarkBtn.addEventListener('click', () => {
      if (state.currentAnimeData) {
        toggleWatchlist(state.currentAnimeData);
      }
    });

    // Clear History Button
    DOM.clearHistoryBtn.addEventListener('click', () => {
      saveStorage(CONFIG.HISTORY_STORAGE_KEY, []);
      renderContinueWatching();
      showToast('Watch history cleared', 'fa-trash');
    });

    // Quick MAL ID Modal Handlers
    function openQuickModal() {
      DOM.quickModal.classList.add('show');
      closeMobileDrawer();
    }
    DOM.quickIdBtn.addEventListener('click', openQuickModal);
    if (DOM.drawerQuickIdBtn) DOM.drawerQuickIdBtn.addEventListener('click', openQuickModal);
    DOM.closeQuickModal.addEventListener('click', () => DOM.quickModal.classList.remove('show'));
    DOM.cancelQuickModal.addEventListener('click', () => DOM.quickModal.classList.remove('show'));

    DOM.launchDirectStream.addEventListener('click', () => {
      const id = parseInt(DOM.directMalId.value, 10);
      const ep = parseInt(DOM.directEp.value, 10) || 1;
      const lang = DOM.directLang.value;

      if (!id) {
        alert('Please enter a valid MyAnimeList ID.');
        return;
      }
      DOM.quickModal.classList.remove('show');
      loadStream(id, ep, lang);
    });

    // Quick chips in modal
    document.querySelectorAll('.badge-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.mal;
        const ep = btn.dataset.ep;
        const lang = btn.dataset.lang || 'dub';
        DOM.quickModal.classList.remove('show');
        loadStream(id, ep, lang);
      });
    });

    // Genre Chips Filter
    DOM.genreChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        DOM.genreChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const genreName = chip.dataset.genre || chip.textContent.trim();
        const finalGenre = genreName === 'All Genres' ? '' : genreName;
        DOM.trendingGrid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
        const data = await fetchAnimeByGenre(finalGenre);
        renderGrid(DOM.trendingGrid, data);
      });
    });

    // ==========================================================
    // Mobile Drawer Open / Close Logic
    // ==========================================================
    function openMobileDrawer() {
      DOM.mobileNavDrawer.classList.add('show');
      DOM.mobileNavOverlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    }

    function closeMobileDrawer() {
      DOM.mobileNavDrawer.classList.remove('show');
      DOM.mobileNavOverlay.classList.remove('show');
      document.body.style.overflow = '';
    }

    if (DOM.mobileMenuBtn) DOM.mobileMenuBtn.addEventListener('click', openMobileDrawer);
    if (DOM.closeMobileNavBtn) DOM.closeMobileNavBtn.addEventListener('click', closeMobileDrawer);
    if (DOM.mobileNavOverlay) DOM.mobileNavOverlay.addEventListener('click', closeMobileDrawer);

    // ==========================================================
    // Universal Navigation Synchronizer (Desktop, Drawer & Bottom Bar)
    // ==========================================================
    function setActiveNavTarget(target) {
      // Synchronize Desktop Navbar
      document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.nav === target);
      });

      // Synchronize Mobile Drawer Links
      document.querySelectorAll('.mobile-nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.nav === target);
      });

      // Synchronize Mobile Bottom Nav Items
      document.querySelectorAll('.bottom-nav-item').forEach(l => {
        l.classList.toggle('active', l.dataset.nav === target);
      });

      // Execute action for target
      if (target === 'home') {
        closePlayerAndGoHome();
      } else if (target === 'watchlist') {
        DOM.watchlistSection.classList.remove('hidden');
        renderWatchlist();
        DOM.watchlistSection.scrollIntoView({ behavior: 'smooth' });
      } else if (target === 'trending') {
        const trendingSection = document.getElementById('trending');
        if (trendingSection) trendingSection.scrollIntoView({ behavior: 'smooth' });
      } else if (target === 'top') {
        const topSection = document.getElementById('top-rated');
        if (topSection) topSection.scrollIntoView({ behavior: 'smooth' });
      } else if (target === 'genres') {
        const genresSection = document.getElementById('genres');
        if (genresSection) genresSection.scrollIntoView({ behavior: 'smooth' });
      }
    }

    // Attach listeners to all nav elements
    document.querySelectorAll('.nav-link, .mobile-nav-link, .bottom-nav-item').forEach(link => {
      link.addEventListener('click', (e) => {
        const target = link.dataset.nav;
        if (target) {
          e.preventDefault();
          setActiveNavTarget(target);
          closeMobileDrawer();
        }
      });
    });
  }

  /* ==========================================================================
     Initial App Startup & URL Parameter Parsing
     ========================================================================== */

  async function initApp() {
    initSearch();
    initEventListeners();
    renderContinueWatching();
    renderWatchlist();

    // Check if URL contains direct query params
    const urlParams = new URLSearchParams(window.location.search);
    const paramMalId = urlParams.get('mal_id') || urlParams.get('id');
    const paramEp = urlParams.get('ep') || urlParams.get('episode');
    const paramLang = urlParams.get('lang') || urlParams.get('audio');

    if (paramMalId) {
      const id = parseInt(paramMalId, 10);
      const ep = paramEp ? parseInt(paramEp, 10) : 1;
      const lang = (paramLang === 'sub' || paramLang === 'dub') ? paramLang : 'dub';
      loadStream(id, ep, lang);
    } else {
      DOM.playerSection.classList.add('hidden');
      DOM.animeIframe.src = '';
    }

    // Load Trending and Top Rated sections concurrently via AniList GraphQL
    const [trending, topRated] = await Promise.all([
      fetchTrendingAnime(),
      fetchTopRatedAnime()
    ]);

    renderGrid(DOM.trendingGrid, trending);
    renderGrid(DOM.topRatedGrid, topRated);
  }

  // Expose global controller
  window.app = {
    loadStream,
    toggleWatchlist,
    showToast
  };

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
