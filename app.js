/**
 * KuroStream — Anime Web Application
 * Integration: MyAnimeList (Jikan v4 REST API) & FlixCloud Streaming Iframe
 * Server: https://animeg-flixcloud.ytbro8326.workers.dev/?mal_id={id}&ep={ep}&lang={sub|dub}
 */

(function () {
  'use strict';

  // API & Stream Config
  const CONFIG = {
    STREAM_BASE_URL: 'https://animeg-flixcloud.ytbro8326.workers.dev/',
    JIKAN_API_BASE: 'https://api.jikan.moe/v4',
    CACHE_KEY_PREFIX: 'kuro_cache_',
    WATCHLIST_STORAGE_KEY: 'kuro_watchlist_v1',
    HISTORY_STORAGE_KEY: 'kuro_history_v1',
    DEFAULT_MAL_ID: 1735, // Naruto: Shippuuden
    DEFAULT_EP: 250,
    DEFAULT_LANG: 'dub'
  };

  // Curated Fallback Anime Data (Guarantees instant load even if Jikan rate limits)
  const FALLBACK_POPULAR = [
    {
      mal_id: 1735,
      title: "Naruto: Shippuuden",
      title_japanese: "NARUTO -ナルト- 疾風伝",
      score: 8.27,
      episodes: 500,
      year: 2007,
      type: "TV",
      status: "Finished Airing",
      rating: "PG-13",
      synopsis: "It has been two and a half years since Naruto Uzumaki left Konohagakure, the Hidden Leaf Village, for intense training following events which fueled his desire to be stronger. Now Akatsuki, the mysterious organization of elite rogue ninja, is closing in on their grand plan.",
      images: {
        webp: {
          image_url: "https://cdn.myanimelist.net/images/anime/1565/111305.webp",
          large_image_url: "https://cdn.myanimelist.net/images/anime/1565/111305l.webp"
        }
      },
      genres: [{ name: "Action" }, { name: "Adventure" }, { name: "Fantasy" }],
      studios: [{ name: "Studio Pierrot" }],
      duration: "23 min per ep"
    },
    {
      mal_id: 52991,
      title: "Sousou no Frieren",
      title_japanese: "葬送のフリーレン",
      score: 9.33,
      episodes: 28,
      year: 2023,
      type: "TV",
      status: "Finished Airing",
      rating: "PG-13",
      synopsis: "During their decade-long quest to defeat the Demon King, the members of the hero's party—Himmel, Heiter, Eisen, and the elf mage Frieren—forged deep bonds while bringing peace to the realm. As an elf, Frieren lives for thousands of years and embarks on a new journey to understand humanity.",
      images: {
        webp: {
          image_url: "https://cdn.myanimelist.net/images/anime/1015/138006.webp",
          large_image_url: "https://cdn.myanimelist.net/images/anime/1015/138006l.webp"
        }
      },
      genres: [{ name: "Adventure" }, { name: "Drama" }, { name: "Fantasy" }],
      studios: [{ name: "Madhouse" }],
      duration: "24 min per ep"
    },
    {
      mal_id: 5114,
      title: "Fullmetal Alchemist: Brotherhood",
      title_japanese: "鋼の錬金術師 FULLMETAL ALCHEMIST",
      score: 9.09,
      episodes: 64,
      year: 2009,
      type: "TV",
      status: "Finished Airing",
      rating: "R - 17+",
      synopsis: "After a horrific alchemy experiment goes wrong in the Elric household, brothers Edward and Alphonse are left in a catastrophic new reality. Disregarding the alchemy prohibition against human transmutation, the boys attempted to bring their recently deceased mother back to life.",
      images: {
        webp: {
          image_url: "https://cdn.myanimelist.net/images/anime/1208/94745.webp",
          large_image_url: "https://cdn.myanimelist.net/images/anime/1208/94745l.webp"
        }
      },
      genres: [{ name: "Action" }, { name: "Adventure" }, { name: "Drama" }, { name: "Fantasy" }],
      studios: [{ name: "Bones" }],
      duration: "24 min per ep"
    },
    {
      mal_id: 38000,
      title: "Kimetsu no Yaiba (Demon Slayer)",
      title_japanese: "鬼滅の刃",
      score: 8.48,
      episodes: 26,
      year: 2019,
      type: "TV",
      status: "Finished Airing",
      rating: "R - 17+",
      synopsis: "Ever since the death of his father, the burden of supporting the family has fallen upon Tanjirou Kamado's shoulders. One day, Tanjirou finds his family slaughtered and his sister Nezuko turned into a demon.",
      images: {
        webp: {
          image_url: "https://cdn.myanimelist.net/images/anime/1286/99889.webp",
          large_image_url: "https://cdn.myanimelist.net/images/anime/1286/99889l.webp"
        }
      },
      genres: [{ name: "Action" }, { name: "Fantasy" }, { name: "Supernatural" }],
      studios: [{ name: "ufotable" }],
      duration: "23 min per ep"
    },
    {
      mal_id: 40748,
      title: "Jujutsu Kaisen",
      title_japanese: "呪術廻戦",
      score: 8.59,
      episodes: 24,
      year: 2020,
      type: "TV",
      status: "Finished Airing",
      rating: "R - 17+",
      synopsis: "Idly indulging in paranormal activities with the Occult Club, high schooler Yuuji Itadori spends his days at either the clubroom or the hospital. However, this leisurely lifestyle takes a turn for the strange when he encounters a cursed item.",
      images: {
        webp: {
          image_url: "https://cdn.myanimelist.net/images/anime/1171/109222.webp",
          large_image_url: "https://cdn.myanimelist.net/images/anime/1171/109222l.webp"
        }
      },
      genres: [{ name: "Action" }, { name: "Fantasy" }, { name: "Supernatural" }],
      studios: [{ name: "MAPPA" }],
      duration: "23 min per ep"
    },
    {
      mal_id: 21,
      title: "One Piece",
      title_japanese: "ONE PIECE",
      score: 8.73,
      episodes: 1120,
      year: 1999,
      type: "TV",
      status: "Currently Airing",
      rating: "PG-13",
      synopsis: "Barely surviving in a barrel after passing through a terrible whirlpool at sea, carefree Monkey D. Luffy ends up aboard a pirate ship. Guided by his childhood hero Red-Haired Shanks, Luffy sets out on his journey to find the legendary One Piece.",
      images: {
        webp: {
          image_url: "https://cdn.myanimelist.net/images/anime/1244/138851.webp",
          large_image_url: "https://cdn.myanimelist.net/images/anime/1244/138851l.webp"
        }
      },
      genres: [{ name: "Action" }, { name: "Adventure" }, { name: "Fantasy" }],
      studios: [{ name: "Toei Animation" }],
      duration: "24 min per ep"
    }
  ];

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
    searchDropdown: document.getElementById('searchDropdown'),
    searchLoader: document.getElementById('searchLoader'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    
    // Player
    playerSection: document.getElementById('playerSection'),
    heroSection: document.getElementById('heroSection'),
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

  /* ==========================================================================
     Jikan API Client (with Cache & Rate-limit Handling)
     ========================================================================== */
  
  async function fetchWithCache(url, cacheMinutes = 30) {
    const cacheKey = CONFIG.CACHE_KEY_PREFIX + btoa(url).replace(/=/g, '');
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < cacheMinutes * 60 * 1000) {
          return parsed.data;
        }
      } catch (e) {}
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
      }
      const json = await res.json();
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          data: json
        }));
      } catch (e) {}
      return json;
    } catch (err) {
      console.warn(`Fetch error for ${url}:`, err);
      return null;
    }
  }

  async function getAnimeDetails(malId) {
    // Check fallback list first for immediate match
    const fallbackMatch = FALLBACK_POPULAR.find(a => a.mal_id === Number(malId));
    
    const url = `${CONFIG.JIKAN_API_BASE}/anime/${malId}/full`;
    const res = await fetchWithCache(url, 60);
    if (res && res.data) {
      return res.data;
    }
    return fallbackMatch || {
      mal_id: Number(malId),
      title: `Anime #${malId}`,
      title_japanese: `Anime (ID: ${malId})`,
      score: 8.0,
      episodes: 24,
      year: new Date().getFullYear(),
      type: 'TV',
      status: 'Airing / Complete',
      rating: 'PG-13',
      synopsis: 'Streaming stream from MyAnimeList database.',
      images: {
        webp: {
          image_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400',
          large_image_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800'
        }
      },
      genres: [{ name: 'Anime' }],
      studios: [{ name: 'Studio' }],
      duration: '24 min'
    };
  }

  async function fetchTrendingAnime() {
    const url = `${CONFIG.JIKAN_API_BASE}/top/anime?filter=airing&limit=12`;
    const res = await fetchWithCache(url, 15);
    return (res && res.data && res.data.length > 0) ? res.data : FALLBACK_POPULAR;
  }

  async function fetchTopRatedAnime() {
    const url = `${CONFIG.JIKAN_API_BASE}/top/anime?limit=12`;
    const res = await fetchWithCache(url, 60);
    return (res && res.data && res.data.length > 0) ? res.data : FALLBACK_POPULAR;
  }

  async function searchAnime(query) {
    if (!query || query.trim().length < 2) return [];
    const url = `${CONFIG.JIKAN_API_BASE}/anime?q=${encodeURIComponent(query)}&limit=16&sfw=true`;
    const res = await fetchWithCache(url, 5);
    return res && res.data ? res.data : [];
  }

  async function fetchAnimeByGenre(genreId) {
    if (!genreId) return fetchTrendingAnime();
    const url = `${CONFIG.JIKAN_API_BASE}/anime?genres=${genreId}&order_by=popularity&sort=asc&limit=12`;
    const res = await fetchWithCache(url, 30);
    return (res && res.data && res.data.length > 0) ? res.data : FALLBACK_POPULAR;
  }

  /* ==========================================================================
     Streaming Player Core Logic
     ========================================================================== */

  /**
   * Load Anime Stream into the Iframe
   * @param {number|string} malId - MyAnimeList ID
   * @param {number|string} episode - Episode Number
   * @param {string} lang - 'sub' or 'dub'
   */
  async function loadStream(malId, episode = 1, lang = 'dub', shouldScroll = true) {
    malId = Number(malId);
    episode = Math.max(1, Number(episode) || 1);
    lang = (lang === 'sub' || lang === 'dub') ? lang : 'dub';

    state.currentMalId = malId;
    state.currentEp = episode;
    state.currentLang = lang;

    // Show Player & Hide Hero
    DOM.playerSection.classList.remove('hidden');
    DOM.heroSection.classList.add('hidden');

    // Update Player UI Badges
    DOM.playerEpBadge.textContent = `EP ${episode}`;
    DOM.playerLangBadge.textContent = lang.toUpperCase();
    DOM.quickEpInput.value = episode;

    // Set Active Sub/Dub buttons
    DOM.langSubBtn.classList.toggle('active', lang === 'sub');
    DOM.langDubBtn.classList.toggle('active', lang === 'dub');

    // Build the specific stream iframe URL
    // Format: https://animeg-flixcloud.ytbro8326.workers.dev/?mal_id=1735&ep=250&lang=dub
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

    // Scroll to player smoothly
    if (shouldScroll) {
      DOM.playerSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Fetch Full Anime Metadata from MAL
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
    DOM.detailTitle.textContent = 'Fetching MyAnimeList details...';
    DOM.detailSynopsis.textContent = 'Please wait while anime data is retrieved from MAL database.';
  }

  function renderAnimeDetails(anime, currentEp) {
    if (!anime) return;

    DOM.playerAnimeTitle.textContent = anime.title || `Anime #${anime.mal_id}`;
    DOM.detailTitle.textContent = anime.title || 'Untitled Anime';
    DOM.detailTitleJp.textContent = anime.title_japanese || anime.title_english || '';
    DOM.detailScore.innerHTML = `<i class="fa-solid fa-star"></i> ${anime.score ? anime.score.toFixed(2) : 'N/A'}`;
    DOM.detailType.textContent = anime.type || 'TV';
    DOM.detailStatus.textContent = anime.status || 'Finished';
    DOM.detailYear.textContent = anime.year || (anime.aired && anime.aired.prop && anime.aired.prop.from ? anime.aired.prop.from.year : 'N/A');
    DOM.detailRating.textContent = anime.rating ? anime.rating.split(' ')[0] : 'PG-13';
    DOM.detailMalId.textContent = anime.mal_id;
    
    // Total episodes count
    const totalEps = anime.episodes || Math.max(currentEp, 24);
    state.totalEpisodes = totalEps;
    DOM.detailEpisodes.textContent = anime.episodes ? `${anime.episodes} Episodes` : `${totalEps}+ (Ongoing)`;
    DOM.totalEpLabel.textContent = anime.episodes ? `/ ${anime.episodes}` : '/ ?';
    DOM.epSelectorCount.textContent = `${totalEps} Total Episodes`;

    // Studio & Duration
    DOM.detailStudios.textContent = anime.studios && anime.studios.length ? anime.studios.map(s => s.name).join(', ') : 'Unknown';
    DOM.detailDuration.textContent = anime.duration || '24 min/ep';

    // Poster Image
    const posterUrl = (anime.images && anime.images.webp && anime.images.webp.large_image_url) 
      || (anime.images && anime.images.jpg && anime.images.jpg.large_image_url) 
      || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400';
    DOM.detailPoster.src = posterUrl;

    // Genres Tags
    DOM.detailGenres.innerHTML = '';
    if (anime.genres && anime.genres.length) {
      anime.genres.forEach(g => {
        const tag = document.createElement('span');
        tag.className = 'genre-tag';
        tag.textContent = g.name;
        DOM.detailGenres.appendChild(tag);
      });
    }

    // Synopsis
    DOM.detailSynopsis.textContent = anime.synopsis || 'No synopsis provided for this anime on MyAnimeList.';

    // External Link
    DOM.malProfileLink.href = anime.url || `https://myanimelist.net/anime/${anime.mal_id}`;

    // Render Episode Selector Buttons
    renderEpisodeSelector(totalEps, currentEp);

    // Update Bookmark status icon
    updateBookmarkButtonState(anime.mal_id);
  }

  /**
   * Render Episode Selector with Chunking for Long Anime (e.g. 500+ episodes)
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
    
    const poster = (anime.images && anime.images.webp && anime.images.webp.image_url) 
      || (anime.images && anime.images.jpg && anime.images.jpg.image_url) || '';

    history.unshift({
      mal_id: anime.mal_id,
      title: anime.title || `Anime #${anime.mal_id}`,
      ep: ep,
      lang: lang,
      poster: poster,
      totalEps: anime.episodes || '?',
      timestamp: Date.now()
    });

    // Keep max 20 items
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
            <span class="card-eps">${item.lang.toUpperCase()}</span>
          </div>
          <div class="card-play-overlay">
            <div class="play-btn-circle"><i class="fa-solid fa-play"></i></div>
          </div>
        </div>
        <div class="card-info">
          <h3 class="card-title">${item.title}</h3>
          <div class="card-subtext">
            <span>Resume Episode ${item.ep}</span>
            <span class="highlight-cyan"><i class="fa-solid fa-circle-play"></i></span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        loadStream(item.mal_id, item.ep, item.lang);
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
      const poster = (anime.images && anime.images.webp && anime.images.webp.image_url) 
        || (anime.images && anime.images.jpg && anime.images.jpg.image_url) || '';
      watchlist.unshift({
        mal_id: anime.mal_id,
        title: anime.title,
        score: anime.score || 'N/A',
        episodes: anime.episodes || '?',
        poster: poster,
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
    DOM.bookmarkBtn.innerHTML = isSaved ? '<i class="fa-solid fa-bookmark highlight-pink"></i>' : '<i class="fa-regular fa-bookmark"></i>';
    DOM.bookmarkBtn.title = isSaved ? 'Remove from Watchlist' : 'Add to Watchlist';
    DOM.watchlistCount.textContent = watchlist.length;
  }

  function renderWatchlist() {
    const watchlist = loadStorage(CONFIG.WATCHLIST_STORAGE_KEY, []);
    state.watchlist = watchlist;
    DOM.watchlistCount.textContent = watchlist.length;

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

    const poster = (anime.images && anime.images.webp && anime.images.webp.large_image_url) 
      || (anime.images && anime.images.jpg && anime.images.jpg.large_image_url)
      || (anime.images && anime.images.webp && anime.images.webp.image_url)
      || anime.poster
      || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400';

    const score = anime.score ? Number(anime.score).toFixed(2) : 'N/A';
    const epCount = anime.episodes ? `${anime.episodes} EPS` : 'AIRING';
    const type = anime.type || 'TV';
    const year = anime.year || (anime.aired && anime.aired.prop && anime.aired.prop.from ? anime.aired.prop.from.year : '');

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
          <span class="highlight-pink"><i class="fa-solid fa-circle-play"></i> Watch</span>
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
      }, 350);
    });

    DOM.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = DOM.searchInput.value.trim();
        if (query) {
          DOM.searchDropdown.classList.remove('show');
          performFullSearch(query);
        }
      }
    });

    DOM.clearSearchBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      DOM.clearSearchBtn.style.display = 'none';
      DOM.searchDropdown.classList.remove('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!DOM.searchInput.contains(e.target) && !DOM.searchDropdown.contains(e.target)) {
        DOM.searchDropdown.classList.remove('show');
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
      const thumb = (anime.images && anime.images.webp && anime.images.webp.image_url) 
        || (anime.images && anime.images.jpg && anime.images.jpg.image_url) || '';

      item.innerHTML = `
        <img src="${thumb}" alt="${anime.title}" class="search-item-thumb">
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
        DOM.searchInput.value = '';
        DOM.clearSearchBtn.style.display = 'none';
        loadStream(anime.mal_id, 1, 'dub');
      });
      DOM.searchDropdown.appendChild(item);
    });

    // "View all results" option
    const viewAll = document.createElement('div');
    viewAll.className = 'search-item';
    viewAll.style.justifyContent = 'center';
    viewAll.style.color = 'var(--accent-cyan)';
    viewAll.style.fontWeight = '700';
    viewAll.innerHTML = `<i class="fa-solid fa-arrow-right"></i> View all results for "${query}"`;
    viewAll.addEventListener('click', () => {
      DOM.searchDropdown.classList.remove('show');
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
     Event Listeners & Controls
     ========================================================================== */

  function initEventListeners() {
    // Back to home button
    DOM.backToHomeBtn.addEventListener('click', () => {
      DOM.playerSection.classList.add('hidden');
      DOM.heroSection.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Logo click -> go to home
    DOM.logoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      DOM.playerSection.classList.add('hidden');
      DOM.heroSection.classList.remove('hidden');
      DOM.searchResultsSection.classList.add('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Sub / Dub toggles
    DOM.langSubBtn.addEventListener('click', () => {
      if (state.currentLang !== 'sub') {
        loadStream(state.currentMalId, state.currentEp, 'sub', false);
        showToast('Switched to Japanese SUB', 'fa-closed-captioning');
      }
    });

    DOM.langDubBtn.addEventListener('click', () => {
      if (state.currentLang !== 'dub') {
        loadStream(state.currentMalId, state.currentEp, 'dub', false);
        showToast('Switched to English DUB', 'fa-microphone-lines');
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
      const isTheater = document.body.classList.contains('theater-mode');
      showToast(isTheater ? 'Theater mode ON' : 'Theater mode OFF', 'fa-expand');
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

    // Quick MAL ID Modal
    DOM.quickIdBtn.addEventListener('click', () => {
      DOM.quickModal.classList.add('show');
    });
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
        const lang = btn.dataset.lang;
        DOM.quickModal.classList.remove('show');
        loadStream(id, ep, lang);
      });
    });

    // Genre Chips Filter
    DOM.genreChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        DOM.genreChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const genreId = chip.dataset.genre;
        DOM.trendingGrid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
        const data = await fetchAnimeByGenre(genreId);
        renderGrid(DOM.trendingGrid, data);
      });
    });

    // Nav Links handling
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const target = link.dataset.nav;
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        if (target === 'watchlist') {
          DOM.watchlistSection.classList.remove('hidden');
          renderWatchlist();
          DOM.watchlistSection.scrollIntoView({ behavior: 'smooth' });
        } else if (target === 'home') {
          DOM.playerSection.classList.add('hidden');
          DOM.heroSection.classList.remove('hidden');
          window.scrollTo({ top: 0, behavior: 'smooth' });
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

    // Check if URL contains direct query params (e.g. ?mal_id=1735&ep=250&lang=dub)
    const urlParams = new URLSearchParams(window.location.search);
    const paramMalId = urlParams.get('mal_id') || urlParams.get('id');
    const paramEp = urlParams.get('ep') || urlParams.get('episode');
    const paramLang = urlParams.get('lang') || urlParams.get('audio');

    if (paramMalId) {
      // Direct stream link detected in URL
      const id = parseInt(paramMalId, 10);
      const ep = parseInt(paramEp, 10) || 1;
      const lang = (paramLang === 'sub' || paramLang === 'dub') ? paramLang : 'dub';
      loadStream(id, ep, lang);
    }

    // Load Trending and Top Rated sections concurrently
    const [trending, topRated] = await Promise.all([
      fetchTrendingAnime(),
      fetchTopRatedAnime()
    ]);

    renderGrid(DOM.trendingGrid, trending);
    renderGrid(DOM.topRatedGrid, topRated);
  }

  // Expose global controller for inline HTML onclick handlers
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
