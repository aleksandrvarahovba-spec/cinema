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

          if (item.type === 'tv') {
            let rawSeasons: StreamSeason[] = [];
            if (defaultTrans.seasons && defaultTrans.seasons.length > 0) {
              rawSeasons = defaultTrans.seasons;
            } else if (item.seasons && item.seasons.length > 0) {
              rawSeasons = item.seasons.map((s) => ({
                season: s.seasonNumber,
                episodes: Array.from({ length: s.episodeCount || 10 }, (_, i) => ({
                  id: `${s.seasonNumber}_${i + 1}`,
                  episode: i + 1,
                  title: `Серия ${i + 1}`,
                })),
              }));
            }

            // Strictly sort seasons and episodes numerically
            const sorted: StreamSeason[] = [...rawSeasons]
              .filter((s) => !isNaN(Number(s.season)) && Number(s.season) > 0)
              .sort((a, b) => Number(a.season) - Number(b.season))
              .map((s) => ({
                ...s,
                season: Number(s.season),
                episodes: [...(s.episodes || [])]
                  .filter((ep) => !isNaN(Number(ep.episode)) && Number(ep.episode) > 0)
                  .sort((a, b) => Number(a.episode) - Number(b.episode))
                  .map((ep) => ({
                    ...ep,
                    episode: Number(ep.episode),
                  })),
              }));

            setSeasonsData(sorted);
            if (sorted.length > 0) {
              const initialSeason =
                savedProgress?.season !== undefined &&
                sorted.some((s) => s.season === savedProgress.season)
                  ? savedProgress.season
                  : sorted[0].season;
              setSelectedSeason(initialSeason);
            }
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
      let rawSeasons: StreamSeason[] = [];
      if (trans.seasons && trans.seasons.length > 0) {
        rawSeasons = trans.seasons;
      } else {
        const seasons = await fetchSeriesStructure(
          trans.provider,
          trans.id,
          trans.rawMeta?.movieId || trans.id
        );
        if (seasons && seasons.length > 0) {
          rawSeasons = seasons;
        }
      }

      if (rawSeasons.length > 0) {
        const sorted: StreamSeason[] = [...rawSeasons]
          .filter((s) => !isNaN(Number(s.season)) && Number(s.season) > 0)
          .sort((a, b) => Number(a.season) - Number(b.season))
          .map((s) => ({
            ...s,
            season: Number(s.season),
            episodes: [...(s.episodes || [])]
              .filter((ep) => !isNaN(Number(ep.episode)) && Number(ep.episode) > 0)
              .sort((a, b) => Number(a.episode) - Number(b.episode))
              .map((ep) => ({
                ...ep,
                episode: Number(ep.episode),
              })),
          }));

        setSeasonsData(sorted);
        if (!sorted.some((s) => s.season === selectedSeason)) {
          setSelectedSeason(sorted[0].season);
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
    } else if (details.type === 'tv') {
      if (epObj.qualities && epObj.qualities.length > 0) {
        qualities = epObj.qualities;
      } else {
        const transSeason = activeTrans.seasons?.find((s) => s.season === sNum);
        const transEp = transSeason?.episodes?.find((e) => e.episode === epObj.episode);
        if (transEp?.qualities && transEp.qualities.length > 0) {
          qualities = transEp.qualities;
        }
      }
    }

    if (qualities.length === 0 && !embedUrl) {
      try {
        qualities = await getStreamQualities({
          provider: activeTrans.provider,
          translatorId: activeTrans.id,
          mediaId: activeTrans.rawMeta?.movieId || activeTrans.id,
          season: (details.type as string) === 'tv' ? sNum : undefined,
          episode: (details.type as string) === 'tv' ? epObj.episode : undefined,
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
      currentEpisode: details.type === 'tv' ? { ...epObj, qualities } : undefined,
      initialTime: resumeTime,
    });
  };

  const handleToggleFavorite = () => {
    const newState = storage.toggleFavorite(mediaId);
    setIsFavorite(newState);
  };

  // Strictly sorted seasons for UI display (1, 2, 3, 4, 5...)
  const sortedSeasons = [...seasonsData]
    .filter((s) => !isNaN(Number(s.season)) && Number(s.season) > 0)
    .sort((a, b) => Number(a.season) - Number(b.season));

  // Strictly sorted episodes for the selected season (1, 2, 3, 4...)
  const currentEpisodes = (
    sortedSeasons.find((s) => s.season === selectedSeason)?.episodes || []
  )
    .slice()
    .filter((ep) => !isNaN(Number(ep.episode)) && Number(ep.episode) > 0)
    .sort((a, b) => Number(a.episode) - Number(b.episode));

  return (
    <div
      onClick={onBack}
      className={`fixed inset-0 z-50 flex items-center justify-center p-6 lg:p-10 bg-black/85 backdrop-blur-2xl transition-all duration-300 ease-out ${
        isMounted ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Dynamic Ambient Blur Backdrop */}
      {details?.backdrop && (
        <div
          className="absolute inset-0 pointer-events-none opacity-25 bg-center bg-cover transition-opacity duration-700"
          style={{
            backgroundImage: `url(${details.backdrop})`,
            filter: 'blur(60px) saturate(180%)',
          }}
        />
      )}

      {/* Toast Notification in Apple Glass */}
      {toastMessage && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-fadeIn pointer-events-auto">
          <div className="apple-glass px-6 py-3.5 rounded-full border border-white/20 shadow-2xl flex items-center gap-3 text-white text-sm font-semibold">
            <AlertCircle className="text-white/80 flex-shrink-0" size={20} />
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-white/50 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Container in Apple TV+ Frosted Glass */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
          opacity: isMounted ? 1 : 0,
          transform: isMounted ? 'scale(1)' : 'scale(0.97)',
        }}
        className="w-full max-w-6xl max-h-[92vh] overflow-y-auto bg-[#0a0a0c]/90 backdrop-blur-3xl rounded-[32px] p-8 lg:p-10 shadow-[0_25px_70px_rgba(0,0,0,0.85)] relative scrollbar-none flex flex-col gap-8 border border-white/12"
      >
        {/* Floating Close Button in Apple Capsule */}
        <button
          onClick={onBack}
          className="absolute top-6 right-6 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/15 text-white/80 hover:text-white transition-all text-sm font-semibold cursor-pointer shadow-lg hover:scale-105 active:scale-95"
        >
          <X size={18} />
          <span>Закрыть (ESC)</span>
        </button>

        {isLoading || !details ? (
          <div className="h-96 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-3 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-white/70 font-medium text-sm tracking-wide">
              Загрузка информации...
            </span>
          </div>
        ) : (
          <>
            {/* Hero / Header Section */}
            <div className="relative rounded-[26px] overflow-hidden p-6 lg:p-8 bg-white/[0.04] border border-white/10 flex flex-col md:flex-row gap-8 shadow-xl">
              {/* Ken Burns Atmospheric Animated Backdrop */}
              {details.backdrop && (
                <img
                  src={details.backdrop}
                  alt={details.title}
                  className="absolute inset-0 w-full h-full object-cover object-top opacity-20 pointer-events-none"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent pointer-events-none" />

              {/* Poster with Subtle Frosted Frame */}
              <div className="relative z-10 w-56 flex-shrink-0 aspect-[2/3] rounded-[18px] overflow-hidden shadow-2xl bg-[#141416] border border-white/15">
                {details.poster ? (
                  <img
                    src={details.poster}
                    alt={details.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/40 font-medium">
                    Нет постера
                  </div>
                )}
              </div>

              {/* Title & Info */}
              <div className="relative z-10 flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1 rounded-full bg-white/15 text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-md border border-white/10">
                    {details.type === 'tv' ? 'Сериал' : 'Фильм'}
                  </span>
                  {details.rating > 0 && (
                    <span className="text-yellow-400 font-bold text-sm px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                      ★ {details.rating}
                    </span>
                  )}
                  {details.year && (
                    <span className="text-white/70 text-sm font-medium">{details.year}</span>
                  )}
                  {details.runtime && (
                    <span className="text-white/50 text-sm font-medium">{details.runtime} мин.</span>
                  )}
                </div>

                <h1 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight drop-shadow-md">
                  {details.title}
                </h1>

                {details.originalTitle && (
                  <p className="text-white/50 text-base italic font-normal">{details.originalTitle}</p>
                )}

                {details.genres && details.genres.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {details.genres.map((g) => (
                      <span
                        key={g}
                        className="px-3 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-xs text-white/80 font-medium"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-white/75 text-sm lg:text-base leading-relaxed line-clamp-4 max-w-3xl">
                  {details.overview || 'Описание тайтла пока отсутствует.'}
                </p>

                {/* Action Buttons */}
                <div className="flex items-center gap-4 pt-4">
                  <TVButton
                    focusKey="btn-details-watch"
                    zone="details-actions"
                    autoFocus
                    onClick={() => startWatching()}
                    className="font-bold text-base lg:text-lg px-8 py-3 rounded-full shadow-2xl"
                  >
                    <Play fill="currentColor" size={20} />
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
                        <BookmarkCheck className="text-white" size={20} />
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

            {/* Voiceovers / Translations Selector in Apple Capsule Style */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-white/70" />
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    Выбор озвучки / перевода
                  </h3>
                </div>
                {isExtracting && (
                  <span className="text-xs text-white/60 font-medium animate-pulse flex items-center gap-1.5">
                    <Sparkles size={14} />
                    <span>Поиск источников...</span>
                  </span>
                )}
              </div>

              {extractions && extractions.translations.length > 0 ? (
                <div className="flex gap-2.5 overflow-x-auto py-2 scrollbar-none items-center">
                  {extractions.translations.map((trans) => {
                    const isSelected = selectedTranslation?.id === trans.id;
                    return (
                      <button
                        key={`${trans.provider}-${trans.id}`}
                        onClick={() => handleSelectTranslation(trans)}
                        className={`px-5 py-2.5 rounded-full flex-shrink-0 text-sm font-semibold transition-all duration-200 cursor-pointer outline-none ${
                          isSelected
                            ? 'bg-white text-black font-bold shadow-[0_4px_20px_rgba(255,255,255,0.35)] scale-[1.02]'
                            : 'bg-white/[0.08] text-white/80 border border-white/12 hover:bg-white/[0.15] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            isSelected ? 'bg-black/15 text-black' : 'bg-white/10 text-white/70'
                          }`}>
                            {trans.provider}
                          </span>
                          <span>{trans.name}</span>
                          {isSelected && <Check size={16} className="stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white/[0.04] text-white/60 text-sm font-medium border border-white/10">
                  {isExtracting
                    ? 'Ищем доступные источники и озвучки...'
                    : 'Источники видео не найдены для данного тайтла.'}
                </div>
              )}
            </div>

            {/* TV Series Seasons & Episodes Picker */}
            {details.type === 'tv' && (
              <div className="space-y-5">
                {/* Strictly Sorted Seasons Tabs (1, 2, 3, 4, 5...) */}
                {sortedSeasons.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 rounded-full bg-white/70" />
                      <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider">
                        Выбор сезона
                      </h4>
                    </div>
                    <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none items-center">
                      {sortedSeasons.map((s) => {
                        const isSelected = selectedSeason === s.season;
                        return (
                          <button
                            key={s.season}
                            onClick={() => setSelectedSeason(s.season)}
                            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer flex-shrink-0 outline-none ${
                              isSelected
                                ? 'bg-white text-black font-bold shadow-[0_4px_20px_rgba(255,255,255,0.35)] scale-[1.02]'
                                : 'bg-white/[0.08] text-white/80 border border-white/12 hover:bg-white/[0.15] hover:text-white'
                            }`}
                          >
                            Сезон {s.season}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Episodes Grid with Strict Numerical Sorting */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-white">Список серий</h4>
                    <span className="text-xs font-medium text-white/50">
                      {currentEpisodes.length} серий
                    </span>
                  </div>
                  {currentEpisodes.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {currentEpisodes.map((ep) => (
                        <button
                          key={ep.id}
                          onClick={() => startWatching(selectedSeason, ep)}
                          className="p-4 rounded-[16px] bg-white/[0.06] hover:bg-white/[0.12] text-left transition-all duration-200 group cursor-pointer border border-white/10 hover:border-white/30 hover:scale-[1.02] outline-none"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-sm group-hover:text-white transition-colors">
                              {ep.episode} серия
                            </span>
                            <Play
                              size={15}
                              className="text-white/40 group-hover:text-white transition-colors"
                            />
                          </div>
                          {ep.title && ep.title !== `Серия ${ep.episode}` && (
                            <p className="text-xs text-white/50 mt-1 truncate font-normal">
                              {ep.title}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-white/[0.04] text-white/60 text-sm border border-white/10">
                      Серии для выбранного сезона готовы к просмотру.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cast list */}
            {details.cast && details.cast.length > 0 && (
              <div className="space-y-3 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 rounded-full bg-white/70" />
                  <h3 className="text-lg font-bold text-white tracking-wide">В главных ролях</h3>
                </div>
                <div className="flex gap-4 overflow-x-auto py-2 scrollbar-none">
                  {details.cast.map((actor) => (
                    <div
                      key={actor.id}
                      className="w-28 flex-shrink-0 bg-white/[0.04] p-3 rounded-2xl text-center space-y-2 border border-white/10"
                    >
                      <div className="w-16 h-16 mx-auto rounded-full overflow-hidden bg-white/10 border border-white/15">
                        {actor.photo ? (
                          <img
                            src={actor.photo}
                            alt={actor.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-white/40 font-medium">
                            Фото
                          </div>
                        )}
                      </div>
                      <div>
                        <h5 className="font-semibold text-xs text-white truncate">{actor.name}</h5>
                        <p className="text-[10px] text-white/50 truncate font-normal">{actor.character}</p>
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
