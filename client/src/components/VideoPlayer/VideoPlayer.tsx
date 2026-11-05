import Hls from 'hls.js';
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  FastForward,
  Maximize2,
  Pause,
  Play,
  Rewind,
  Settings,
  SkipForward,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { isBackKey, isEnterKey, isPlayPauseKey, TVKeys } from '../../navigation/tizenKeys.js';
import { getStreamQualities } from '../../services/api.js';
import { storage } from '../../services/storage.js';
import {
  MediaItem,
  StreamEpisode,
  StreamQuality,
  StreamTranslation,
} from '../../types/index.js';

interface VideoPlayerProps {
  media: MediaItem;
  initialStreamUrl?: string;
  embedUrl?: string;
  initialQualities: StreamQuality[];
  translations: StreamTranslation[];
  selectedTranslation: StreamTranslation;
  currentSeason?: number;
  currentEpisode?: StreamEpisode;
  initialTime?: number;
  onClose: () => void;
  onNextEpisode?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  media,
  initialStreamUrl = '',
  embedUrl,
  initialQualities,
  translations,
  selectedTranslation,
  currentSeason,
  currentEpisode,
  initialTime = 0,
  onClose,
  onNextEpisode,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Check if we have a direct stream (.m3u8 / .mp4 / extracted qualities) to bypass iframes completely
  const hasDirectStream = Boolean(
    (initialQualities &&
      initialQualities.length > 0 &&
      initialQualities.some(
        (q) => q.url?.includes('.m3u8') || q.url?.includes('.mp4') || q.proxiedUrl?.includes('.m3u8')
      )) ||
      (initialStreamUrl &&
        (initialStreamUrl.includes('.m3u8') || initialStreamUrl.includes('.mp4'))) ||
      (currentEpisode?.qualities && currentEpisode.qualities.length > 0)
  );

  const [currentEmbedUrl, setCurrentEmbedUrl] = useState<string | null>(() => {
    if (hasDirectStream) return null;
    return (
      selectedTranslation.embedUrl ||
      embedUrl ||
      (initialStreamUrl &&
      !initialStreamUrl.includes('.m3u8') &&
      !initialStreamUrl.includes('.mp4')
        ? initialStreamUrl
        : null)
    );
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(initialTime);
  const [duration, setDuration] = useState<number>(0);
  const [buffered, setBuffered] = useState<number>(0);
  const [showOSD, setShowOSD] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<'quality' | 'voiceover'>('quality');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [focusArea, setFocusArea] = useState<'tabs' | 'list'>('list');

  // Smart TV Autoplay Direct Gesture & Watchdog State
  const [showDirectPlay, setShowDirectPlay] = useState<boolean>(false);
  const [failoverToast, setFailoverToast] = useState<string | null>(null);
  const directPlayTimerRef = useRef<any>(null);
  const stallSecondsRef = useRef<number>(0);
  const lastTimeTrackRef = useRef<number>(initialTime);

  // Qualities list with Auto option
  const prepareQualities = (rawQualities: StreamQuality[]): StreamQuality[] => {
    if (!rawQualities || rawQualities.length === 0) return [];
    const hasAuto = rawQualities.some((q) => q.quality === ('Auto' as any));
    if (!hasAuto && rawQualities[0]?.url) {
      return [
        {
          quality: 'Auto' as any,
          url: rawQualities[0].url,
          proxiedUrl: rawQualities[0].proxiedUrl,
        },
        ...rawQualities,
      ];
    }
    return rawQualities;
  };

  const effectiveInitialQualities =
    initialQualities && initialQualities.length > 0
      ? initialQualities
      : currentEpisode?.qualities || [];

  const [qualities, setQualities] = useState<StreamQuality[]>(() =>
    prepareQualities(effectiveInitialQualities)
  );

  const [activeQuality, setActiveQuality] = useState<string>(() => {
    const defaultQ =
      effectiveInitialQualities.find((q) => q.quality === '1080p')?.quality ||
      effectiveInitialQualities.find((q) => q.quality === '720p')?.quality ||
      effectiveInitialQualities[0]?.quality ||
      'Auto';
    return defaultQ;
  });

  const [activeTranslation, setActiveTranslation] =
    useState<StreamTranslation>(selectedTranslation);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const osdTimerRef = useRef<any>(null);

  // Auto-hide OSD after 4.5 seconds of inactivity
  const resetOsdTimer = () => {
    setShowOSD(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      if (!showSettings) {
        setShowOSD(false);
      }
    }, 4500);
  };

  // Direct Play gesture unlock (Smart TV Autoplay policy & AudioContext)
  const handleDirectPlay = () => {
    setShowDirectPlay(false);
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctx.resume();
      }
    } catch (_) {}

    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((err) => console.warn('Direct play error:', err));
    }
  };

  // Attach Stream to HTML5 Video or HLS.js
  const loadStream = (url: string, startTime = 0) => {
    const video = videoRef.current;
    if (!video || !url) return;

    setIsLoading(true);
    setShowDirectPlay(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported() && url.includes('.m3u8')) {
      const hls = new Hls({
        enableWorker: false, // Maximum compatibility on older WebKit / Tizen 3.0
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        maxBufferSize: 25 * 1024 * 1024,
        lowLatencyMode: false,
        backBufferLength: 30,
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        if (startTime > 0) {
          video.currentTime = startTime;
        }
        video.play().catch(() => {
          // Autoplay was blocked by browser policy -> show direct play button
          setShowDirectPlay(true);
        });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn('[HLS Error] Fatal:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else {
      // Native video playback
      video.src = url;
      video.onloadedmetadata = () => {
        setIsLoading(false);
        if (startTime > 0) {
          video.currentTime = startTime;
        }
        video.play().catch(() => {
          setShowDirectPlay(true);
        });
      };
    }
  };

  // 3-second Direct Play button timer for Smart TV Autoplay unlock
  useEffect(() => {
    if (directPlayTimerRef.current) clearTimeout(directPlayTimerRef.current);

    if (isLoading && !currentEmbedUrl) {
      directPlayTimerRef.current = setTimeout(() => {
        if (isLoading) {
          setShowDirectPlay(true);
        }
      }, 3000);
    } else {
      setShowDirectPlay(false);
    }

    return () => {
      if (directPlayTimerRef.current) clearTimeout(directPlayTimerRef.current);
    };
  }, [isLoading, currentEmbedUrl]);

  // 6-second Watchdog Timeout (Auto-failover to next balancer)
  useEffect(() => {
    stallSecondsRef.current = 0;
    const interval = setInterval(() => {
      if (!currentEmbedUrl && videoRef.current) {
        const cur = videoRef.current.currentTime;
        const stalled =
          isLoading || (isPlaying && cur === lastTimeTrackRef.current && cur > 0);

        if (stalled) {
          stallSecondsRef.current += 1;
          if (stallSecondsRef.current >= 6) {
            stallSecondsRef.current = 0;
            if (translations && translations.length > 1) {
              const curIdx = translations.findIndex((t) => t.id === activeTranslation.id);
              const nextIdx = (curIdx + 1) % translations.length;
              const nextTrans = translations[nextIdx];
              setFailoverToast(`Буферизация... Переключение на плеер: ${nextTrans.name}`);
              setTimeout(() => setFailoverToast(null), 4000);
              handleTranslationSelect(nextTrans);
            }
          }
        } else {
          stallSecondsRef.current = 0;
          lastTimeTrackRef.current = cur;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, isPlaying, currentEmbedUrl, translations, activeTranslation]);

  // Initial stream load
  useEffect(() => {
    if (!currentEmbedUrl) {
      const streamToLoad =
        qualities.find((q) => q.quality === activeQuality)?.proxiedUrl ||
        qualities.find((q) => q.quality === activeQuality)?.url ||
        initialStreamUrl ||
        currentEpisode?.qualities?.[0]?.url;

      if (streamToLoad) {
        loadStream(streamToLoad, initialTime);
      }
    }
    resetOsdTimer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (osdTimerRef.current) {
        clearTimeout(osdTimerRef.current);
      }
      if (directPlayTimerRef.current) {
        clearTimeout(directPlayTimerRef.current);
      }
    };
  }, []);

  // Periodic Watch Progress Save
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (videoRef.current && duration > 0) {
        storage.saveProgress({
          mediaId: media.id,
          type: media.type,
          title: media.title,
          poster: media.poster,
          currentTime: videoRef.current.currentTime,
          duration,
          updatedAt: Date.now(),
          translatorId: activeTranslation.id,
          translatorName: activeTranslation.name,
          provider: activeTranslation.provider,
          season: currentSeason,
          episode: currentEpisode?.episode,
        });
      }
    }, 5000);

    return () => clearInterval(saveInterval);
  }, [media, duration, activeTranslation, currentSeason, currentEpisode]);

  // Quality switch (preserves exact currentTime)
  const handleQualitySelect = (quality: StreamQuality) => {
    if (quality.quality === activeQuality) {
      setShowSettings(false);
      resetOsdTimer();
      return;
    }

    const time = videoRef.current?.currentTime || 0;
    setActiveQuality(quality.quality);

    // If Hls.js is active and changing level
    if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
      if (quality.quality === ('Auto' as any)) {
        hlsRef.current.currentLevel = -1; // Auto adaptive
      } else {
        const heightTarget = parseInt(quality.quality, 10);
        const lvlIdx = hlsRef.current.levels.findIndex(
          (lvl) => lvl.height === heightTarget || Math.abs(lvl.height - heightTarget) < 50
        );
        if (lvlIdx !== -1) {
          hlsRef.current.currentLevel = lvlIdx;
        } else {
          loadStream(quality.proxiedUrl || quality.url, time);
        }
      }
    } else {
      loadStream(quality.proxiedUrl || quality.url, time);
    }

    setShowSettings(false);
    resetOsdTimer();
  };

  // Voiceover switch (fetches new qualities & preserves currentTime)
  const handleTranslationSelect = async (translation: StreamTranslation) => {
    if (translation.id === activeTranslation.id) {
      setShowSettings(false);
      resetOsdTimer();
      return;
    }

    setActiveTranslation(translation);

    // Prioritize direct qualities if available to avoid iframe ads
    let directQualities = translation.qualities;
    if (
      (!directQualities || directQualities.length === 0) &&
      media.type === 'tv' &&
      currentEpisode?.qualities &&
      currentEpisode.qualities.length > 0
    ) {
      directQualities = currentEpisode.qualities;
    }

    if (directQualities && directQualities.length > 0) {
      setCurrentEmbedUrl(null);
      setIsLoading(true);
      const time = videoRef.current?.currentTime || 0;
      const prepared = prepareQualities(directQualities);
      setQualities(prepared);
      const match =
        prepared.find((q) => q.quality === activeQuality) ||
        prepared.find((q) => q.quality === '1080p') ||
        prepared[0];
      loadStream(match.proxiedUrl || match.url, time);
      setShowSettings(false);
      resetOsdTimer();
      return;
    }

    // If this translation is an embed balancer player
    if (translation.embedUrl) {
      let finalUrl = translation.embedUrl;
      if (media.type === 'tv' && currentSeason && currentEpisode) {
        const cleanUrl = finalUrl.split('?')[0];
        const audioMatch = finalUrl.match(/[?&]audio=([^&]+)/);
        const audioQuery = audioMatch ? `&audio=${audioMatch[1]}` : '';
        finalUrl = `${cleanUrl}?season=${currentSeason}&episode=${currentEpisode.episode}${audioQuery}`;
      }
      setCurrentEmbedUrl(finalUrl);
      setShowSettings(false);
      resetOsdTimer();
      return;
    }

    setCurrentEmbedUrl(null);
    setIsLoading(true);
    const time = videoRef.current?.currentTime || 0;

    // Fetch from backend for provider
    const newQualities = await getStreamQualities({
      provider: translation.provider,
      translatorId: translation.id,
      mediaId: translation.rawMeta?.movieId || translation.id,
      season: currentSeason,
      episode: currentEpisode?.episode,
    });

    if (newQualities.length > 0) {
      const prepared = prepareQualities(newQualities);
      setQualities(prepared);
      const match =
        prepared.find((q) => q.quality === activeQuality) ||
        prepared.find((q) => q.quality === '1080p') ||
        prepared[0];
      loadStream(match.proxiedUrl || match.url, time);
    } else {
      setIsLoading(false);
    }

    setShowSettings(false);
    resetOsdTimer();
  };

  // Remote Control and Keyboard Navigation Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Back Button / Escape
      if (isBackKey(e) || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();

        if (showSettings) {
          setShowSettings(false);
          resetOsdTimer();
          return;
        }

        // Save progress before exit
        if (videoRef.current && duration > 0) {
          storage.saveProgress({
            mediaId: media.id,
            type: media.type,
            title: media.title,
            poster: media.poster,
            currentTime: videoRef.current.currentTime,
            duration,
            updatedAt: Date.now(),
            translatorId: activeTranslation.id,
            translatorName: activeTranslation.name,
            provider: activeTranslation.provider,
            season: currentSeason,
            episode: currentEpisode?.episode,
          });
        }
        onClose();
        return;
      }

      // 2. Navigation INSIDE Settings Modal
      if (showSettings) {
        const currentListLength =
          settingsTab === 'quality' ? qualities.length : translations.length;

        // Left / Right Arrow: Switch tabs
        if (e.keyCode === TVKeys.LEFT) {
          e.preventDefault();
          setSettingsTab('quality');
          setFocusedIndex(0);
          return;
        }
        if (e.keyCode === TVKeys.RIGHT) {
          e.preventDefault();
          setSettingsTab('voiceover');
          setFocusedIndex(0);
          return;
        }

        // Down Arrow: Move down list
        if (e.keyCode === TVKeys.DOWN) {
          e.preventDefault();
          setFocusArea('list');
          setFocusedIndex((prev) => (prev + 1 < currentListLength ? prev + 1 : 0));
          return;
        }

        // Up Arrow: Move up list
        if (e.keyCode === TVKeys.UP) {
          e.preventDefault();
          setFocusArea('list');
          setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : currentListLength - 1));
          return;
        }

        // Enter: Select focused item
        if (isEnterKey(e)) {
          e.preventDefault();
          if (settingsTab === 'quality') {
            const selectedQ = qualities[focusedIndex];
            if (selectedQ) handleQualitySelect(selectedQ);
          } else {
            const selectedT = translations[focusedIndex];
            if (selectedT) handleTranslationSelect(selectedT);
          }
          return;
        }

        return;
      }

      // Smart TV Autoplay Unlock: Enter or Play starts playback
      if (showDirectPlay && (isEnterKey(e) || isPlayPauseKey(e))) {
        e.preventDefault();
        handleDirectPlay();
        return;
      }

      // 3. Navigation IN VIDEO PLAYER
      const video = videoRef.current;
      if (!video) return;

      // Play / Pause Toggle
      if (isPlayPauseKey(e)) {
        e.preventDefault();
        if (video.paused) {
          video.play();
          setIsPlaying(true);
        } else {
          video.pause();
          setIsPlaying(false);
        }
        resetOsdTimer();
        return;
      }

      // Fast-forward 15s (Right Arrow or MediaFastForward)
      if (e.keyCode === TVKeys.RIGHT || e.keyCode === TVKeys.FAST_FORWARD) {
        e.preventDefault();
        video.currentTime = Math.min(duration, video.currentTime + 15);
        resetOsdTimer();
        return;
      }

      // Rewind 15s (Left Arrow or MediaRewind)
      if (e.keyCode === TVKeys.LEFT || e.keyCode === TVKeys.REWIND) {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 15);
        resetOsdTimer();
        return;
      }

      // Open Settings (ArrowUp)
      if (e.keyCode === TVKeys.UP) {
        e.preventDefault();
        setShowSettings(true);
        setFocusArea('list');
        setFocusedIndex(0);
        setShowOSD(true);
        return;
      }

      // Toggle / Show OSD (ArrowDown or Enter)
      if (e.keyCode === TVKeys.DOWN || isEnterKey(e)) {
        e.preventDefault();
        if (!showOSD) {
          resetOsdTimer();
        } else {
          if (video.paused) {
            video.play();
            setIsPlaying(true);
          } else {
            video.pause();
            setIsPlaying(false);
          }
          resetOsdTimer();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showSettings,
    settingsTab,
    focusedIndex,
    qualities,
    translations,
    showOSD,
    showDirectPlay,
    duration,
    activeTranslation,
    activeQuality,
    currentSeason,
    currentEpisode,
  ]);

  // Video Time and Duration Handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.buffered.length > 0) {
        setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (onNextEpisode) {
      onNextEpisode();
    }
  };

  // Format seconds to HH:MM:SS or MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden select-none">
      {currentEmbedUrl ? (
        <div className="relative w-full h-full bg-black flex flex-col">
          {/* Top Liquid Glass Navigation Header */}
          <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between p-6 lg:p-8 bg-gradient-to-b from-black/95 via-black/50 to-transparent pointer-events-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="liquid-glass-btn btn-spring flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-white text-sm font-bold shadow-xl cursor-pointer"
              >
                <ArrowLeft size={18} />
                <span>Назад (ESC)</span>
              </button>
              <div>
                <h2 className="text-xl font-black text-white drop-shadow-md">{media.title}</h2>
                <div className="flex items-center gap-2.5 mt-1">
                  <span className="liquid-glass px-3 py-1 rounded-xl text-tv-cyan font-bold text-xs border border-tv-cyan/30">
                    {activeTranslation.name}
                  </span>
                  {currentSeason && currentEpisode && (
                    <span className="liquid-glass-accent px-2.5 py-0.5 rounded-lg text-black font-black text-xs">
                      S{currentSeason} • E{currentEpisode.episode}
                    </span>
                  )}
                  <span className="liquid-glass px-2.5 py-0.5 rounded-lg text-yellow-300 font-black text-xs border border-yellow-400/30">
                    Full HD 1080p
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Source Switcher Carousel */}
            {translations.length > 1 && (
              <div className="liquid-glass p-1.5 rounded-2xl flex items-center gap-2 border border-white/10 max-w-xl overflow-x-auto scrollbar-none">
                {translations.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTranslationSelect(t)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap btn-spring cursor-pointer ${
                      t.id === activeTranslation.id
                        ? 'liquid-glass-accent text-black font-black shadow-lg scale-102'
                        : 'liquid-glass-btn text-gray-300 hover:text-white'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clean Fullscreen Responsive Iframe with Strict Ad-Bypass Sandboxing */}
          <iframe
            key={currentEmbedUrl}
            src={currentEmbedUrl}
            className="w-full h-full border-0 flex-1 video-embed-frame"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <>
          {/* HTML5 Video Element with TV Autoplay & PlaysInline */}
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onWaiting={() => setIsLoading(true)}
            onPlaying={() => {
              setIsLoading(false);
              setShowDirectPlay(false);
            }}
            playsInline
            webkit-playsinline="true"
            autoPlay
            preload="auto"
          />

      {/* Failover Toast Notification */}
      {failoverToast && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 animate-fadeIn pointer-events-none">
          <div className="liquid-glass px-6 py-3 rounded-2xl border border-tv-cyan/50 shadow-[0_0_25px_rgba(0,210,255,0.4)] flex items-center gap-3 text-white text-sm font-black">
            <Sparkles size={18} className="text-tv-cyan animate-pulse" />
            <span>{failoverToast}</span>
          </div>
        </div>
      )}

      {/* Direct Play Button (Unlocks Smart TV Autoplay & AudioContext after 3s stall) */}
      {showDirectPlay && !showSettings && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 backdrop-blur-md animate-fadeIn">
          <button
            onClick={handleDirectPlay}
            className="px-10 py-5 rounded-3xl liquid-glass-accent text-white font-black text-2xl flex items-center gap-4 shadow-[0_0_40px_rgba(229,9,20,0.6)] cursor-pointer hover:scale-105 active:scale-95 transition-all outline-none border-2 border-white/30 hover:border-tv-cyan"
            autoFocus
          >
            <Play size={32} fill="currentColor" />
            <span>Смотреть</span>
          </button>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-2xl z-30 pointer-events-none">
          <div className="liquid-glass p-8 rounded-3xl border border-white/20 shadow-liquidGlass flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-tv-cyan/30 border-t-tv-cyan rounded-full animate-spin"></div>
              <Sparkles size={20} className="absolute inset-0 m-auto text-tv-cyan animate-pulse" />
            </div>
            <div className="text-center">
              <div className="text-white font-black text-lg tracking-wider drop-shadow-md">
                Загрузка фильма...
              </div>
              <div className="text-xs text-tv-cyan font-bold tracking-widest uppercase mt-1">
                VARAHOVBA CINEMA 4K
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OSD Overlay */}
      {showOSD && !showSettings && (
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-12 bg-gradient-to-t from-black/95 via-black/20 to-black/85 transition-opacity duration-300">
          {/* Top Bar: Title, Back button & Remote Key Hints */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <button
                onClick={onClose}
                className="liquid-glass-btn btn-spring flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-white text-sm font-bold cursor-pointer transition-all shadow-xl"
              >
                <ArrowLeft size={18} />
                <span>Назад (ESC)</span>
              </button>
              <div>
                <h2 className="text-2xl font-black text-white drop-shadow-md tracking-tight">{media.title}</h2>
                <div className="flex items-center gap-3 text-sm text-tv-muted font-semibold mt-1">
                  {currentSeason && currentEpisode && (
                    <span className="px-3 py-1 rounded-xl liquid-glass-accent text-black font-black text-xs uppercase tracking-wider">
                      S{currentSeason} • E{currentEpisode.episode}: {currentEpisode.title}
                    </span>
                  )}
                  <span className="liquid-glass px-3 py-1 rounded-xl text-white text-xs font-semibold border border-white/10">
                    Озвучка: <span className="text-tv-cyan font-bold">{activeTranslation.name}</span>
                  </span>
                  <span className="liquid-glass px-3 py-1 rounded-xl text-yellow-300 text-xs font-black border border-yellow-400/30">
                    {activeQuality}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="liquid-glass flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-white/20 text-xs font-black tracking-wider text-tv-cyan shadow-lg">
                <Sparkles size={14} className="text-tv-cyan animate-pulse" />
                <span>VARAHOVBA CINEMA</span>
              </div>
              <div className="liquid-glass flex items-center gap-4 text-xs font-semibold text-gray-300 px-5 py-2.5 rounded-2xl border border-white/10 shadow-xl">
                <span>▲ Настройки</span>
                <span>◄ / ► 15 сек</span>
                <span>⏎ Пауза</span>
                <span>⮌ Выход</span>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Timeline Progress & Controls */}
          <div className="flex flex-col gap-4">
            {/* Timeline Progress Bar */}
            <div className="relative w-full h-3.5 liquid-glass rounded-full overflow-hidden shadow-inner cursor-pointer border border-white/10">
              {/* Buffer Bar */}
              <div
                className="absolute top-0 left-0 h-full bg-white/20 transition-all duration-300"
                style={{ width: `${bufferPercent}%` }}
              />
              {/* Played Bar */}
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-tv-cyan to-tv-cyanGlow transition-all duration-150 shadow-[0_0_15px_rgba(0,210,255,0.7)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Time Indicators & Bottom Action Row */}
            <div className="flex items-center justify-between text-base font-semibold">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    const video = videoRef.current;
                    if (!video) return;
                    if (video.paused) {
                      video.play();
                      setIsPlaying(true);
                    } else {
                      video.pause();
                      setIsPlaying(false);
                    }
                    resetOsdTimer();
                  }}
                  className="liquid-glass-accent btn-spring w-12 h-12 rounded-full text-black flex items-center justify-center cursor-pointer shadow-[0_0_25px_rgba(0,210,255,0.5)] transition-transform"
                >
                  {isPlaying ? (
                    <Pause size={20} fill="currentColor" />
                  ) : (
                    <Play fill="currentColor" size={20} className="ml-0.5" />
                  )}
                </button>
                <div className="liquid-glass px-4 py-2 rounded-xl flex items-center gap-2 text-white font-mono text-sm border border-white/10">
                  <span className="text-tv-cyan font-bold">{formatTime(currentTime)}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-gray-400">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {onNextEpisode && (
                  <button
                    onClick={onNextEpisode}
                    className="liquid-glass-btn btn-spring flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-sm font-bold cursor-pointer shadow-md"
                  >
                    <SkipForward size={18} />
                    <span>Следующая серия</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowSettings(true);
                    setFocusArea('list');
                    setFocusedIndex(0);
                  }}
                  className="liquid-glass-btn btn-spring flex items-center gap-2.5 px-6 py-2.5 rounded-2xl text-tv-cyan hover:text-white border border-tv-cyan/40 hover:border-tv-cyan text-sm font-black cursor-pointer shadow-lg transition-all"
                >
                  <Settings size={18} />
                  <span>Качество и звук (▲)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-Player Settings Modal (Audio & Quality) - z-50 overlay */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-2xl p-8 animate-fadeIn">
          <div className="w-[700px] liquid-glass border border-white/20 rounded-3xl p-8 shadow-liquidGlass flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl liquid-glass flex items-center justify-center text-tv-cyan shadow-sm">
                    <Settings size={22} />
                  </div>
                  <span>Параметры воспроизведения</span>
                </h3>
                <p className="text-xs text-tv-cyan/80 font-bold uppercase tracking-widest mt-1 ml-13">
                  VARAHOVBA CINEMA ENGINE
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSettings(false);
                  resetOsdTimer();
                }}
                className="liquid-glass-btn btn-spring flex items-center gap-1.5 px-4 py-2 rounded-xl text-gray-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <X size={16} />
                <span>Закрыть (ESC)</span>
              </button>
            </div>

            {/* Tab switchers: Left/Right to change tab */}
            <div className="flex gap-3 p-1.5 liquid-glass rounded-2xl border border-white/10">
              <button
                onClick={() => {
                  setSettingsTab('quality');
                  setFocusedIndex(0);
                }}
                className={`flex-1 py-3.5 rounded-xl font-black text-sm btn-spring transition-all cursor-pointer ${
                  settingsTab === 'quality'
                    ? 'liquid-glass-accent text-black shadow-lg'
                    : 'liquid-glass-btn text-gray-400 hover:text-white'
                }`}
              >
                Качество видео ({activeQuality})
              </button>
              <button
                onClick={() => {
                  setSettingsTab('voiceover');
                  setFocusedIndex(0);
                }}
                className={`flex-1 py-3.5 rounded-xl font-black text-sm btn-spring transition-all cursor-pointer ${
                  settingsTab === 'voiceover'
                    ? 'liquid-glass-accent text-black shadow-lg'
                    : 'liquid-glass-btn text-gray-400 hover:text-white'
                }`}
              >
                Озвучка ({activeTranslation.name})
              </button>
            </div>

            {/* Quality List */}
            {settingsTab === 'quality' && (
              <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-2 tv-scroll">
                {qualities.map((q, idx) => {
                  const isSelected = q.quality === activeQuality;
                  const isFocused = focusedIndex === idx;
                  return (
                    <button
                      key={q.quality}
                      onClick={() => handleQualitySelect(q)}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={`btn-spring py-3.5 px-5 rounded-2xl text-left font-bold text-base flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'liquid-glass-accent text-black font-black shadow-[0_0_25px_rgba(0,210,255,0.4)] scale-[1.02]'
                          : isFocused
                          ? 'liquid-glass-btn text-white border-tv-cyan ring-2 ring-tv-cyan/60 scale-[1.01]'
                          : 'liquid-glass-btn text-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {q.quality === 'Auto' ? '⚡ Автоматическое (HLS Auto)' : q.quality}
                        </span>
                      </div>
                      {isSelected && <Check size={20} className="stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Voiceover List */}
            {settingsTab === 'voiceover' && (
              <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-2 tv-scroll">
                {translations.map((t, idx) => {
                  const isSelected = t.id === activeTranslation.id;
                  const isFocused = focusedIndex === idx;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleTranslationSelect(t)}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={`btn-spring py-3.5 px-5 rounded-2xl text-left font-bold text-base flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'liquid-glass-accent text-black font-black shadow-[0_0_25px_rgba(0,210,255,0.4)] scale-[1.02]'
                          : isFocused
                          ? 'liquid-glass-btn text-white border-tv-cyan ring-2 ring-tv-cyan/60 scale-[1.01]'
                          : 'liquid-glass-btn text-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-black/40 text-gray-300 uppercase font-black tracking-wider border border-white/10">
                          {t.provider}
                        </span>
                        <span>{t.name}</span>
                      </div>
                      {isSelected && <Check size={20} className="stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Remote Navigation Hint */}
            <div className="flex items-center justify-between text-xs font-semibold text-gray-400 border-t border-white/10 pt-4">
              <span>◄ / ► Переключение вкладки</span>
              <span>▲ / ▼ Выбор</span>
              <span>⏎ Применить</span>
              <span>⮌ Закрыть</span>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
