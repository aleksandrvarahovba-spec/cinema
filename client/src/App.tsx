import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { VideoPlayer } from './components/VideoPlayer/VideoPlayer.js';
import { isBackKey, registerTizenKeys } from './navigation/tizenKeys.js';
import { CatalogPage } from './pages/CatalogPage.js';
import { DetailsPage } from './pages/DetailsPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { HomePage } from './pages/HomePage.js';
import { SearchPage } from './pages/SearchPage.js';
import { extractStreams, getStreamQualities } from './services/api.js';
import { storage } from './services/storage.js';
import {
  MediaItem,
  ScreenType,
  StreamEpisode,
  StreamQuality,
  StreamTranslation,
} from './types/index.js';

interface ActivePlayerState {
  media: MediaItem;
  streamUrl: string;
  embedUrl?: string;
  qualities: StreamQuality[];
  translations: StreamTranslation[];
  selectedTranslation: StreamTranslation;
  currentSeason?: number;
  currentEpisode?: StreamEpisode;
  initialTime?: number;
}

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(null);
  const [playerState, setPlayerState] = useState<ActivePlayerState | null>(null);

  // Initialize hardware keys for Samsung Tizen OS
  useEffect(() => {
    registerTizenKeys();
  }, []);

  // Global Return / Back Button Handler
  useEffect(() => {
    const handleGlobalBack = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        // If player is open, player handles its own back key
        if (playerState) return;

        e.preventDefault();

        if (activeMedia) {
          setActiveMedia(null);
        } else if (currentScreen !== 'home') {
          setCurrentScreen('home');
        } else {
          if (typeof window !== 'undefined' && (window as any).tizen?.application) {
            try {
              (window as any).tizen.application.getCurrentApplication().exit();
            } catch {}
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalBack);
    return () => window.removeEventListener('keydown', handleGlobalBack);
  }, [playerState, activeMedia, currentScreen]);

  const handleSelectMedia = (item: MediaItem) => {
    setActiveMedia(item);
  };

  const handlePlayDirect = async (item: MediaItem, resumeTime = 0) => {
    try {
      const ext = await extractStreams({
        title: item.title,
        originalTitle: item.originalTitle,
        year: item.year || undefined,
        imdbId: item.imdbId,
        kinopoiskId: item.kinopoiskId,
        type: item.type,
        mediaItem: item,
      });

      if (!ext || !ext.translations || ext.translations.length === 0) {
        setActiveMedia(item);
        return;
      }

      const translations = ext.translations;
      const defaultTrans = translations[0];

      let qualities: StreamQuality[] = [];
      let currentSeason: number | undefined;
      let currentEpisode: StreamEpisode | undefined;

      // Extract direct .m3u8 qualities for movies or series
      if (item.type === 'tv') {
        const savedProgress = storage.getProgress(item.id);
        const sNum = savedProgress?.season || 1;
        const epNum = savedProgress?.episode || 1;
        currentSeason = sNum;

        const transSeason =
          defaultTrans.seasons?.find((s) => s.season === sNum) ||
          defaultTrans.seasons?.[0];
        const transEp =
          transSeason?.episodes?.find((e) => e.episode === epNum) ||
          transSeason?.episodes?.[0];

        if (transEp) {
          currentEpisode = transEp;
          if (transEp.qualities && transEp.qualities.length > 0) {
            qualities = transEp.qualities;
          }
        }
      } else if (defaultTrans.qualities && defaultTrans.qualities.length > 0) {
        qualities = defaultTrans.qualities;
      }

      if (qualities.length === 0 && !defaultTrans.embedUrl) {
        try {
          qualities = await getStreamQualities({
            provider: defaultTrans.provider,
            translatorId: defaultTrans.id,
            mediaId: defaultTrans.rawMeta?.movieId || defaultTrans.id,
            season: item.type === 'tv' ? currentSeason : undefined,
            episode: item.type === 'tv' ? currentEpisode?.episode : undefined,
          });
        } catch (err) {
          console.warn('Direct stream fetch failed:', err);
        }
      }

      const matchQ =
        qualities.find((q: StreamQuality) => q.quality === '1080p') ||
        qualities.find((q: StreamQuality) => q.quality === '720p') ||
        qualities[0];

      const streamUrl = matchQ?.proxiedUrl || matchQ?.url || defaultTrans.embedUrl || '';
      // If direct stream qualities exist, embedUrl is undefined to guarantee 100% ad-free native video playback
      const embedUrl = qualities.length > 0 ? undefined : defaultTrans.embedUrl;

      setPlayerState({
        media: item,
        streamUrl,
        embedUrl,
        qualities,
        translations,
        selectedTranslation: defaultTrans,
        currentSeason,
        currentEpisode: currentEpisode ? { ...currentEpisode, qualities } : undefined,
        initialTime: resumeTime,
      });
    } catch (err) {
      console.error('Failed to direct play, opening details modal:', err);
      setActiveMedia(item);
    }
  };

  const handleNextEpisode = async () => {
    if (!playerState || !playerState.currentEpisode || !playerState.currentSeason) return;

    const nextEpNum = playerState.currentEpisode.episode + 1;
    const translation = playerState.selectedTranslation;

    let newQualities: StreamQuality[] = [];
    try {
      newQualities = await getStreamQualities({
        provider: translation.provider,
        translatorId: translation.id,
        mediaId: translation.rawMeta?.movieId || translation.id,
        season: playerState.currentSeason,
        episode: nextEpNum,
      });
    } catch (err) {
      console.warn('Failed to load next episode stream:', err);
    }

    if (!newQualities || newQualities.length === 0) return;

    const matchQ =
      newQualities.find((q: StreamQuality) => q.quality === '1080p') ||
      newQualities.find((q: StreamQuality) => q.quality === '720p') ||
      newQualities[0];

    setPlayerState({
      ...playerState,
      streamUrl: matchQ.proxiedUrl || matchQ.url,
      qualities: newQualities,
      currentEpisode: {
        id: `${playerState.currentSeason}_${nextEpNum}`,
        episode: nextEpNum,
        title: `Серия ${nextEpNum}`,
      },
      initialTime: 0,
    });
  };

  return (
    <div
      className="relative flex w-full h-full overflow-hidden bg-[#06090e] text-white font-tv select-none"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Dynamic Atmospheric Ambient Background (Fluid Glow Orbs for Liquid Glass Refraction) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none z-0"
        style={{ width: '100%', height: '100%', overflow: 'hidden', contain: 'strict' }}
      >
        {/* Deep Cyan Orb */}
        <div className="absolute top-0 left-[20%] w-[500px] h-[500px] rounded-full bg-cyan-600/15 blur-[120px]" />
        {/* Violet / Indigo Orb */}
        <div className="absolute top-[40%] right-[10%] w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[130px]" />
        {/* Deep Blue / Fuchsia Orb */}
        <div className="absolute bottom-0 left-[30%] w-[500px] h-[500px] rounded-full bg-blue-700/15 blur-[120px]" />
        {/* Fine Grain / Vignette Overlay */}
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/40 to-black/80" />
      </div>

      {/* Sidebar Navigation: 280px Liquid Glass, NEVER overlaps main content */}
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={(screen) => {
          setActiveMedia(null);
          setCurrentScreen(screen);
        }}
      />

      {/* Main Content Area: Independent scroll with screen transition animation */}
      <main
        key={currentScreen}
        className={`flex-1 h-full min-w-0 scrollbar-none relative z-10 screen-transition box-border ${
          currentScreen === 'search' ? 'overflow-hidden p-0' : 'overflow-y-auto px-12 py-9'
        }`}
        style={{
          flex: '1 1 0%',
          height: '100%',
          maxHeight: '100vh',
          overflowY: currentScreen === 'search' ? 'hidden' : 'auto',
          overflowX: 'hidden',
        }}
      >
        {currentScreen === 'home' && (
          <HomePage
            onSelectMedia={handleSelectMedia}
            onPlayDirect={handlePlayDirect}
          />
        )}
        {currentScreen === 'movies' && (
          <CatalogPage type="movie" onSelectMedia={handleSelectMedia} />
        )}
        {currentScreen === 'tv' && (
          <CatalogPage type="tv" onSelectMedia={handleSelectMedia} />
        )}
        {currentScreen === 'search' && (
          <SearchPage onSelectMedia={handleSelectMedia} />
        )}
        {currentScreen === 'history' && (
          <HistoryPage
            onPlayDirect={handlePlayDirect}
            onSelectMedia={handleSelectMedia}
          />
        )}
      </main>

      {/* Animated Modal Details View */}
      {activeMedia && (
        <DetailsPage
          mediaId={activeMedia.id}
          mediaType={activeMedia.type}
          onPlay={(params) => setPlayerState(params)}
          onBack={() => setActiveMedia(null)}
        />
      )}

      {/* Fullscreen Video Player */}
      {playerState && (
        <VideoPlayer
          media={playerState.media}
          initialStreamUrl={playerState.streamUrl}
          embedUrl={playerState.embedUrl}
          initialQualities={playerState.qualities}
          translations={playerState.translations}
          selectedTranslation={playerState.selectedTranslation}
          currentSeason={playerState.currentSeason}
          currentEpisode={playerState.currentEpisode}
          initialTime={playerState.initialTime}
          onClose={() => setPlayerState(null)}
          onNextEpisode={
            playerState.currentEpisode && playerState.currentSeason
              ? handleNextEpisode
              : undefined
          }
        />
      )}
    </div>
  );
};
