import React, { useEffect, useState } from 'react';
import { AlertCircle, Bookmark, BookmarkCheck, Check, Play, Sparkles, X } from 'lucide-react';
import { TVButton } from '../components/TVButton.js';
import { isBackKey } from '../navigation/tizenKeys.js';
import {
  extractStreams,
  fetchSeriesStructure,
  getMovieDetails,
  getStreamQualities,
  getTvDetails,
} from '../services/api.js';
import { storage } from '../services/storage.js';
import {
  ExtractionResult,
  MediaItem,
  StreamEpisode,
  StreamQuality,
  StreamSeason,
  StreamTranslation,
  WatchProgress,
} from '../types/index.js';

interface DetailsPageProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  onPlay: (params: {
    media: MediaItem;
    streamUrl: string;
    embedUrl?: string;
    qualities: StreamQuality[];
    translations: StreamTranslation[];
    selectedTranslation: StreamTranslation;
    currentSeason?: number;
    currentEpisode?: StreamEpisode;
    initialTime?: number;
  }) => void;
  onBack: () => void;
}

export const DetailsPage: React.FC<DetailsPageProps> = ({
  mediaId,
  mediaType,
  onPlay,
  onBack,
}) => {
  const [details, setDetails] = useState<MediaItem | null>(null);
  const [extractions, setExtractions] = useState<ExtractionResult | null>(null);
  const [selectedTranslation, setSelectedTranslation] = useState<StreamTranslation | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonsData, setSeasonsData] = useState<StreamSeason[]>([]);

  const [isFavorite, setIsFavorite] = useState<boolean>(() => storage.isFavorite(mediaId));
  const [savedProgress, setSavedProgress] = useState<WatchProgress | null>(() =>
    storage.getProgress(mediaId)
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  // Trigger modal slide-in animation
  useEffect(() => {
    const timer = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Listen for Escape / Back keys inside modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isBackKey(e) || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  // Load details & sources
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const item =
          mediaType === 'movie'
            ? await getMovieDetails(mediaId)
            : await getTvDetails(mediaId);

        setDetails(item);

        // Fetch stream extractions from balancers
        setIsExtracting(true);
        const ext = await extractStreams({
          title: item.title,
          originalTitle: item.originalTitle,
          year: item.year || undefined,
          imdbId: item.imdbId,
          kinopoiskId: item.kinopoiskId,
          type: item.type,
          mediaItem: item,
        });

        setExtractions(ext);

        if (ext && ext.translations.length > 0) {
          const defaultTrans = ext.translations[0];
          setSelectedTranslation(defaultTrans);

          if (item.type === 'tv' && defaultTrans.seasons && defaultTrans.seasons.length > 0) {
            setSeasonsData(defaultTrans.seasons);
          } else if (item.type === 'tv' && item.seasons && item.seasons.length > 0) {
            const fallbackSeasons: StreamSeason[] = item.seasons.map((s) => ({
              season: s.seasonNumber,
              episodes: Array.from({ length: s.episodeCount || 10 }, (_, i) => ({
                id: `${s.seasonNumber}_${i + 1}`,
                episode: i + 1,
                title: `Серия ${i + 1}`,
              })),
            }));
            setSeasonsData(fallbackSeasons);
          }
        }
      } catch (err) {
        console.error('Failed to load title details:', err);
      } finally {
        setIsLoading(false);
        setIsExtracting(false);
      }
    }

    load();
  }, [mediaId, mediaType]);

  // Handle Translation change
  const handleSelectTranslation = async (trans: StreamTranslation) => {
    setSelectedTranslation(trans);

    // If TV series and seasons are not loaded for this translation, fetch them
    if (details?.type === 'tv') {
      if (trans.seasons && trans.seasons.length > 0) {
        setSeasonsData(trans.seasons);
      } else {
        const seasons = await fetchSeriesStructure(
          trans.provider,
          trans.id,
          trans.rawMeta?.movieId || trans.id
        );
        if (seasons && seasons.length > 0) {
          setSeasonsData(seasons);
        }
      }
    }
  };

  // Launch Player with real streams or embed players
  const startWatching = async (seasonNum?: number, episodeObj?: StreamEpisode) => {
    if (!details) return;

    const sNum = seasonNum !== undefined ? seasonNum : savedProgress?.season || 1;
    const epObj =
      episodeObj ||
      seasonsData.find((s) => s.season === sNum)?.episodes[0] || {
        id: `${sNum}_1`,
        episode: savedProgress?.episode || 1,
      };

    let activeTrans = selectedTranslation;
    if (!activeTrans && extractions && extractions.translations.length > 0) {
      activeTrans = extractions.translations[0];
    }

    if (!activeTrans) {
      showToast('Поиск доступных источников... Пожалуйста, подождите пару секунд.');
      return;
    }

    // Build embedUrl with season & episode if TV series
    let embedUrl = activeTrans.embedUrl;
    if (embedUrl && details.type === 'tv') {
      const cleanUrl = embedUrl.split('?')[0];
      const audioMatch = embedUrl.match(/[?&]audio=([^&]+)/);
      const audioQuery = audioMatch ? `&audio=${audioMatch[1]}` : '';
      embedUrl = `${cleanUrl}?season=${sNum}&episode=${epObj.episode}${audioQuery}`;
    }

    let qualities: StreamQuality[] = [];

    if (details.type === 'movie' && activeTrans.qualities && activeTrans.qualities.length > 0) {
      qualities = activeTrans.qualities;
    } else if (details.type === 'tv' && epObj.qualities && epObj.qualities.length > 0) {
      qualities = epObj.qualities;
    } else if (!embedUrl) {
      try {
        qualities = await getStreamQualities({
          provider: activeTrans.provider,
          translatorId: activeTrans.id,
          mediaId: activeTrans.rawMeta?.movieId || activeTrans.id,
          season: details.type === 'tv' ? sNum : undefined,
          episode: details.type === 'tv' ? epObj.episode : undefined,
        });
      } catch (err) {
        console.warn('Failed to get direct stream qualities:', err);
      }
    }

    const defaultQuality =
      qualities.find((q) => q.quality === '1080p') ||
      qualities.find((q) => q.quality === '720p') ||
      qualities[0];

    const streamUrl = defaultQuality?.proxiedUrl || defaultQuality?.url || embedUrl || '';
    const resumeTime = savedProgress?.currentTime || 0;

    onPlay({
      media: details,
      streamUrl,
      embedUrl,
      qualities,
      translations:
        extractions && extractions.translations.length > 0
          ? extractions.translations
          : [activeTrans],
      selectedTranslation: activeTrans,
      currentSeason: details.type === 'tv' ? sNum : undefined,
      currentEpisode: details.type === 'tv' ? epObj : undefined,
      initialTime: resumeTime,
    });
  };

  const handleToggleFavorite = () => {
    const newState = storage.toggleFavorite(mediaId);
    setIsFavorite(newState);
  };

  const currentEpisodes =
    seasonsData.find((s) => s.season === selectedSeason)?.episodes || [];

  return (
    <div
      onClick={onBack}
      className={`fixed inset-0 z-50 flex items-center justify-center p-6 lg:p-10 bg-black/85 backdrop-blur-2xl transition-all duration-400 ease-out ${
        isMounted ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Liquid Glass Toast Notification */}
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-fadeIn pointer-events-auto">
          <div className="liquid-glass px-6 py-3.5 rounded-2xl border border-white/20 shadow-liquidGlass flex items-center gap-3 text-white text-sm font-bold backdrop-blur-2xl">
            <AlertCircle className="text-tv-cyan flex-shrink-0" size={20} />
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-gray-400 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      {/* Modal Container in Liquid Glass */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: isMounted ? 1 : 0,
          transform: isMounted ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(30px)',
        }}
        className="w-full max-w-6xl max-h-[92vh] overflow-y-auto liquid-glass rounded-[32px] p-8 lg:p-10 shadow-2xl relative scrollbar-none flex flex-col gap-8 border border-white/20"
      >
        {/* Floating Close Button in Liquid Glass */}
        <button
          onClick={onBack}
          className="absolute top-6 right-6 z-30 flex items-center gap-2 px-5 py-2.5 rounded-2xl liquid-glass-btn hover:border-tv-cyan text-gray-200 hover:text-white transition-all text-sm font-black cursor-pointer shadow-lg hover:scale-105 btn-spring"
        >
          <X size={18} />
          <span>Закрыть (ESC)</span>
        </button>

        {isLoading || !details ? (
          <div className="h-96 flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 border-4 border-tv-cyan border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-300 font-bold text-base tracking-wide">
              Загрузка информации о фильме...
            </span>
          </div>
        ) : (
          <>
            {/* Hero / Header Section */}
            <div className="relative rounded-3xl overflow-hidden p-6 lg:p-8 liquid-glass-card flex flex-col md:flex-row gap-8 border border-white/15">
              {/* Ken Burns Atmospheric Animated Backdrop */}
              {details.backdrop && (
                <img
                  src={details.backdrop}
                  alt={details.title}
                  className="absolute inset-0 w-full h-full object-cover object-top opacity-30 pointer-events-none ken-burns"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/75 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#070b14] via-[#070b14]/60 to-transparent pointer-events-none" />

              {/* Poster with Glass Frame */}
              <div className="relative z-10 w-56 flex-shrink-0 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl bg-[#0a0f1d] border border-white/20">
                {details.poster ? (
                  <img
                    src={details.poster}
                    alt={details.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-medium">
                    Нет постера
                  </div>
                )}
              </div>

              {/* Title & Info */}
              <div className="relative z-10 flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1 rounded-full bg-tv-accent text-white text-xs font-black uppercase tracking-wider shadow-md">
                    {details.type === 'tv' ? 'Сериал' : 'Фильм'}
                  </span>
                  {details.rating > 0 && (
                    <span className="text-yellow-400 font-black text-sm px-2.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 shadow-sm">
                      ★ {details.rating}
                    </span>
                  )}
                  {details.year && (
                    <span className="text-gray-300 text-sm font-bold">{details.year}</span>
                  )}
                  {details.runtime && (
                    <span className="text-tv-muted text-sm font-semibold">{details.runtime} мин.</span>
                  )}
                </div>

                <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight drop-shadow-md">
                  {details.title}
                </h1>

                {details.originalTitle && (
                  <p className="text-tv-muted text-base italic font-medium">{details.originalTitle}</p>
                )}

                {details.genres && details.genres.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {details.genres.map((g) => (
                      <span
                        key={g}
                        className="px-3.5 py-1 rounded-full liquid-glass border border-white/10 text-xs text-gray-200 font-semibold"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-gray-300 text-sm lg:text-base leading-relaxed line-clamp-4 max-w-3xl drop-shadow">
                  {details.overview || 'Описание фильма пока отсутствует.'}
                </p>

                {/* Action Buttons */}
                <div className="flex items-center gap-4 pt-4">
                  <TVButton
                    focusKey="btn-details-watch"
                    zone="details-actions"
                    autoFocus
                    onClick={() => startWatching()}
                    className="font-black text-base lg:text-lg px-9 shadow-2xl"
                  >
                    <Play fill="currentColor" size={22} />
                    <span>
                      {savedProgress && savedProgress.currentTime > 30
                        ? `Продолжить (${Math.round(savedProgress.currentTime / 60)} мин)`
                        : 'Смотреть онлайн'}
                    </span>
                  </TVButton>

                  <TVButton
                    focusKey="btn-details-fav"
                    zone="details-actions"
                    variant="secondary"
                    onClick={handleToggleFavorite}
                  >
                    {isFavorite ? (
                      <>
                        <BookmarkCheck className="text-tv-cyan" size={20} />
                        <span>В избранном</span>
                      </>
                    ) : (
                      <>
                        <Bookmark size={20} />
                        <span>В избранное</span>
                      </>
                    )}
                  </TVButton>
                </div>
              </div>
            </div>

            {/* Voiceovers / Translations Selector in Liquid Glass */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-5 rounded-full bg-tv-cyan shadow-[0_0_8px_#00d1ff]" />
                  <h3 className="text-xl font-black text-white tracking-wide">
                    Выбор озвучки / перевода
                  </h3>
                </div>
                {isExtracting && (
                  <span className="text-xs text-tv-cyan font-bold animate-pulse flex items-center gap-1.5">
                    <Sparkles size={14} />
                    <span>Поиск источников...</span>
                  </span>
                )}
              </div>

              {extractions && extractions.translations.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto py-2 scrollbar-none items-center">
                  {extractions.translations.map((trans) => {
                    const isSelected = selectedTranslation?.id === trans.id;
                    return (
                      <button
                        key={`${trans.provider}-${trans.id}`}
                        onClick={() => handleSelectTranslation(trans)}
                        className={`px-5 py-3 rounded-2xl flex-shrink-0 text-sm font-bold transition-all duration-300 cursor-pointer border btn-spring ${
                          isSelected
                            ? 'liquid-glass-active text-white scale-[1.04] font-black shadow-lg shadow-cyan-500/25'
                            : 'liquid-glass-btn text-gray-200 hover:text-white hover:border-white/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-black/40 text-gray-300 uppercase font-black tracking-wider">
                            {trans.provider}
                          </span>
                          <span>{trans.name}</span>
                          {isSelected && <Check size={16} className="text-tv-cyan stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5 liquid-glass rounded-2xl text-tv-muted text-sm font-medium border border-white/10">
                  {isExtracting
                    ? 'Ищем доступные источники и озвучки в балансерах...'
                    : 'Источники видео не найдены для данного тайтла.'}
                </div>
              )}
            </div>

            {/* TV Series Seasons & Episodes Picker */}
            {details.type === 'tv' && (
              <div className="space-y-4">
                {/* Seasons Tabs */}
                {seasonsData.length > 0 && (
                  <div className="flex gap-3 overflow-x-auto py-1 scrollbar-none">
                    {seasonsData.map((s) => (
                      <button
                        key={s.season}
                        onClick={() => setSelectedSeason(s.season)}
                        className={`px-6 py-2.5 rounded-2xl text-sm font-black transition-all cursor-pointer border btn-spring ${
                          selectedSeason === s.season
                            ? 'liquid-glass-active text-white shadow-lg scale-105'
                            : 'liquid-glass-btn text-gray-300 hover:text-white'
                        }`}
                      >
                        Сезон {s.season}
                      </button>
                    ))}
                  </div>
                )}

                {/* Episodes Grid */}
                <div className="space-y-3">
                  <h4 className="text-lg font-black text-white">Список серий</h4>
                  {currentEpisodes.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                      {currentEpisodes.map((ep) => (
                        <button
                          key={ep.id}
                          onClick={() => startWatching(selectedSeason, ep)}
                          className="p-4 rounded-2xl liquid-glass-card hover:border-tv-cyan text-left transition-all duration-300 hover:scale-[1.03] group cursor-pointer border border-white/15 btn-spring"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-white text-sm group-hover:text-tv-cyan transition-colors">
                              {ep.episode} серия
                            </span>
                            <Play
                              size={16}
                              className="text-gray-400 group-hover:text-tv-cyan transition-colors"
                            />
                          </div>
                          {ep.title && ep.title !== `Серия ${ep.episode}` && (
                            <p className="text-xs text-tv-muted mt-1.5 truncate font-medium">
                              {ep.title}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 liquid-glass rounded-2xl text-tv-muted text-sm border border-white/10">
                      Серии для выбранного сезона готовы к просмотру.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cast list */}
            {details.cast && details.cast.length > 0 && (
              <div className="space-y-3 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-5 rounded-full bg-violet-400 shadow-[0_0_8px_#a78bfa]" />
                  <h3 className="text-xl font-black text-white tracking-wide">В главных ролях</h3>
                </div>
                <div className="flex gap-4 overflow-x-auto py-2 scrollbar-none">
                  {details.cast.map((actor) => (
                    <div
                      key={actor.id}
                      className="w-28 flex-shrink-0 liquid-glass-card p-3 rounded-2xl text-center space-y-2 border border-white/10"
                    >
                      <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-gray-800 border border-white/20">
                        {actor.photo ? (
                          <img
                            src={actor.photo}
                            alt={actor.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-bold">
                            Фото
                          </div>
                        )}
                      </div>
                      <div>
                        <h5 className="font-black text-xs text-white truncate">{actor.name}</h5>
                        <p className="text-[10px] text-tv-muted truncate font-medium">{actor.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
