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
      currentSeason &&
      currentEpisode
    ) {
      const sObj = translation.seasons?.find((s) => s.season === currentSeason);
      const epObj = sObj?.episodes?.find((e) => e.episode === currentEpisode.episode);
      if (epObj?.qualities && epObj.qualities.length > 0) {
        directQualities = epObj.qualities;
      } else if (currentEpisode?.qualities && currentEpisode.qualities.length > 0) {
        directQualities = currentEpisode.qualities;
      }
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
    <div className="fixed inset-0 z-50 bg-[#000000] flex items-center justify-center overflow-hidden select-none">
      {currentEmbedUrl ? (
        <div className="relative w-full h-full bg-[#000000] flex flex-col">
          {/* Top Apple Glass Navigation Header */}
          <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between p-6 lg:p-8 bg-gradient-to-b from-black/95 via-black/60 to-transparent pointer-events-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.1] hover:bg-white/[0.2] border border-white/15 text-white text-sm font-semibold shadow-xl cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <ArrowLeft size={18} />
                <span>Назад (ESC)</span>
              </button>
              <div>
                <h2 className="text-xl font-bold text-white drop-shadow-md">{media.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-3 py-0.5 rounded-full bg-white/[0.08] text-white/80 font-medium text-xs border border-white/12">
                    {activeTranslation.name}
                  </span>
                  {currentSeason && currentEpisode && (
                    <span className="px-2.5 py-0.5 rounded-full bg-white text-black font-bold text-xs">
                      S{currentSeason} • E{currentEpisode.episode}
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-black/60 text-yellow-300 font-bold text-xs border border-white/10">
                    Full HD
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Source Switcher Carousel in Apple Capsule Style */}
            {translations.length > 1 && (
              <div className="p-1 rounded-full bg-white/[0.08] border border-white/12 flex items-center gap-1.5 max-w-xl overflow-x-auto scrollbar-none shadow-xl">
                {translations.map((t, idx) => (
                  <button
                    key={t.id}
                    onClick={() => handleTranslationSelect(t)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      t.id === activeTranslation.id
                        ? 'bg-white text-black font-bold shadow-md scale-102'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Плеер {idx + 1}: {t.name.split('(')[0].trim() || t.provider}
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
          <div className="px-6 py-3 rounded-full bg-white/[0.12] backdrop-blur-2xl border border-white/20 shadow-2xl flex items-center gap-3 text-white text-sm font-semibold">
            <Sparkles size={16} className="text-white/80 animate-pulse" />
            <span>{failoverToast}</span>
          </div>
        </div>
      )}

      {/* Direct Play Button (Unlocks Smart TV Autoplay & AudioContext after 3s stall) */}
      {showDirectPlay && !showSettings && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fadeIn">
          <button
            onClick={handleDirectPlay}
            className="px-10 py-4 rounded-full bg-white text-black font-bold text-xl flex items-center gap-3 shadow-[0_10px_35px_rgba(255,255,255,0.3)] cursor-pointer hover:scale-105 active:scale-95 transition-all outline-none"
            autoFocus
          >
            <Play size={24} fill="currentColor" />
            <span>Смотреть</span>
          </button>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-2xl z-30 pointer-events-none">
          <div className="p-8 rounded-[28px] bg-white/[0.05] border border-white/15 shadow-2xl flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
              <Sparkles size={18} className="absolute inset-0 m-auto text-white/60" />
            </div>
            <div className="text-center">
              <div className="text-white font-bold text-base tracking-wide">
                Загрузка потока...
              </div>
              <div className="text-xs text-white/50 font-semibold tracking-widest uppercase mt-1">
                OS CINEMA
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OSD Overlay */}
      {showOSD && !showSettings && (
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-10 lg:p-12 bg-gradient-to-t from-black/95 via-transparent to-black/85 transition-opacity duration-300 pointer-events-none">
          {/* Top Bar: Title, Back button, Quick Switcher & Hints */}
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-5">
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.1] hover:bg-white/[0.2] border border-white/15 text-white text-sm font-semibold shadow-xl cursor-pointer transition-all hover:scale-105 active:scale-95"
              >
                <ArrowLeft size={18} />
                <span>Назад (ESC)</span>
              </button>
              <div>
                <h2 className="text-2xl font-bold text-white drop-shadow-md tracking-tight">{media.title}</h2>
                <div className="flex items-center gap-2.5 text-sm text-white/60 font-medium mt-1">
                  {currentSeason && currentEpisode && (
                    <span className="px-2.5 py-0.5 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider">
                      S{currentSeason} • E{currentEpisode.episode}: {currentEpisode.title}
                    </span>
                  )}
                  <span className="px-3 py-0.5 rounded-full bg-white/[0.08] text-white text-xs font-semibold border border-white/10">
                    Озвучка: <span className="text-white font-bold">{activeTranslation.name}</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-black/60 text-yellow-300 text-xs font-bold border border-white/10">
                    {activeQuality}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Source Switcher Carousel in Apple Style */}
            {translations.length > 1 && (
              <div className="p-1 rounded-full bg-white/[0.08] border border-white/12 flex items-center gap-1.5 max-w-md overflow-x-auto scrollbar-none shadow-xl">
                {translations.map((t, idx) => (
                  <button
                    key={t.id}
                    onClick={() => handleTranslationSelect(t)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      t.id === activeTranslation.id
                        ? 'bg-white text-black font-bold shadow-md scale-102'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Плеер {idx + 1}: {t.name.split('(')[0].trim() || t.provider}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/15 text-xs font-bold tracking-wider text-white shadow-lg">
                <Sparkles size={13} className="text-white/70" />
                <span>OS CINEMA</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-white/60 px-4 py-2 rounded-full bg-white/[0.06] border border-white/10">
                <span>▲ Настройки</span>
                <span>◄ / ► 15 сек</span>
                <span>⏎ Пауза</span>
                <span>⮌ Выход</span>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Timeline Progress & Controls */}
          <div className="flex flex-col gap-4 pointer-events-auto">
            {/* Timeline Progress Bar in Apple Minimal White Style */}
            <div className="relative w-full h-2 bg-white/20 rounded-full overflow-hidden shadow-inner cursor-pointer">
              {/* Buffer Bar */}
              <div
                className="absolute top-0 left-0 h-full bg-white/30 transition-all duration-300"
                style={{ width: `${bufferPercent}%` }}
              />
              {/* Played Bar */}
              <div
                className="absolute top-0 left-0 h-full bg-white transition-all duration-150"
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
                  className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-transform"
                >
                  {isPlaying ? (
                    <Pause size={20} fill="currentColor" />
                  ) : (
                    <Play fill="currentColor" size={20} className="ml-0.5" />
                  )}
                </button>
                <div className="px-4 py-1.5 rounded-full bg-white/[0.08] flex items-center gap-2 text-white font-mono text-xs border border-white/10">
                  <span className="text-white font-bold">{formatTime(currentTime)}</span>
                  <span className="text-white/30">/</span>
                  <span className="text-white/60">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {onNextEpisode && (
                  <button
                    onClick={onNextEpisode}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/15 text-white text-sm font-semibold cursor-pointer shadow-md transition-all"
                  >
                    <SkipForward size={16} />
                    <span>Следующая серия</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowSettings(true);
                    setFocusArea('list');
                    setFocusedIndex(0);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/15 text-white text-sm font-semibold cursor-pointer shadow-lg transition-all"
                >
                  <Settings size={16} />
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
          <div className="w-[640px] bg-[#121216]/95 border border-white/15 rounded-[30px] p-8 shadow-2xl flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white shadow-sm">
                    <Settings size={20} />
                  </div>
                  <span>Параметры воспроизведения</span>
                </h3>
                <p className="text-xs text-white/50 font-semibold uppercase tracking-widest mt-1 ml-13">
                  OS CINEMA ENGINE
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSettings(false);
                  resetOsdTimer();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/12 text-white/70 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <X size={15} />
                <span>Закрыть (ESC)</span>
              </button>
            </div>

            {/* Tab switchers in Apple Capsule Style */}
            <div className="flex gap-2 p-1.5 rounded-full bg-white/[0.06] border border-white/10">
              <button
                onClick={() => {
                  setSettingsTab('quality');
                  setFocusedIndex(0);
                }}
                className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all cursor-pointer ${
                  settingsTab === 'quality'
                    ? 'bg-white text-black shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Качество видео ({activeQuality})
              </button>
              <button
                onClick={() => {
                  setSettingsTab('voiceover');
                  setFocusedIndex(0);
                }}
                className={`flex-1 py-2.5 rounded-full font-bold text-sm transition-all cursor-pointer ${
                  settingsTab === 'voiceover'
                    ? 'bg-white text-black shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Озвучка ({activeTranslation.name})
              </button>
            </div>

            {/* Quality List */}
            {settingsTab === 'quality' && (
              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-2 tv-scroll">
                {qualities.map((q, idx) => {
                  const isSelected = q.quality === activeQuality;
                  const isFocused = focusedIndex === idx;
                  return (
                    <button
                      key={q.quality}
                      onClick={() => handleQualitySelect(q)}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={`py-3 px-5 rounded-2xl text-left font-semibold text-sm flex items-center justify-between transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-white text-black font-bold shadow-md border-white'
                          : isFocused
                          ? 'bg-white/[0.18] text-white border-white/60 scale-[1.01]'
                          : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/90 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">
                          {q.quality === 'Auto' ? '⚡ Автоматическое (HLS Auto)' : q.quality}
                        </span>
                      </div>
                      {isSelected && <Check size={18} className="stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Voiceover List */}
            {settingsTab === 'voiceover' && (
              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-2 tv-scroll">
                {translations.map((t, idx) => {
                  const isSelected = t.id === activeTranslation.id;
                  const isFocused = focusedIndex === idx;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleTranslationSelect(t)}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={`py-3 px-5 rounded-2xl text-left font-semibold text-sm flex items-center justify-between transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-white text-black font-bold shadow-md border-white'
                          : isFocused
                          ? 'bg-white/[0.18] text-white border-white/60 scale-[1.01]'
                          : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/90 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                          isSelected ? 'bg-black/15 text-black border-black/20' : 'bg-white/10 text-white/70 border-white/10'
                        }`}>
                          {t.provider}
                        </span>
                        <span>{t.name}</span>
                      </div>
                      {isSelected && <Check size={18} className="stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Remote Navigation Hint */}
            <div className="flex items-center justify-between text-xs font-medium text-white/50 border-t border-white/10 pt-4">
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
