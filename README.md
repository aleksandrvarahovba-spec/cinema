# VARAHOVBA CINEMA — Smart TV Кинотеатр для Samsung Tizen OS 3.0 (2017) & Web

Полноценное клиент-серверное Smart TV приложение (монорепозиторий) для просмотра любых фильмов и сериалов без рекламы, с выбором всех доступных озвучек и качеств (до 1080p/4K), премиальным дизайном Liquid Glass (Apple iOS / visionOS) и полной адаптацией под Samsung Smart TV 2017 года (модель **UE49MU6100U**, Tizen OS 3.0 / Chromium M47).

---

## 1. Архитектура проекта

```
varahovba-cinema/
├── package.json                   # Корневой package.json (npm workspaces)
├── README.md                      # Инструкция по сборке, запуску и установке
├── server/                        # Backend: Node.js + TypeScript + Fastify
│   ├── .env                       # Переменные окружения (PORT, TMDB, Kodik)
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── config.ts              # Конфигурация портов (process.env.PORT || 3000) и внешних API
│       ├── index.ts               # Точка входа Fastify (CORS origin: '*', trustProxy)
│       ├── extractors/            # Модульная система экстракторов видеопотоков
│       │   ├── types.ts           # Интерфейсы StreamQuality, StreamTranslation
│       │   ├── base.extractor.ts  # Базовый абстрактный класс провайдера
│       │   ├── collaps.extractor.ts # Парсер Collaps (мульти-озвучки, серии, HD)
│       │   ├── hdrezka.extractor.ts # Парсер HDRezka (поиск, озвучки, серии)
│       │   ├── kodik.extractor.ts   # Интеграция с Kodik API
│       │   ├── alloha.extractor.ts  # Заготовка под балансер Alloha
│       │   └── index.ts           # ExtractorManager (параллельный опрос, кэш)
│       ├── routes/
│       │   ├── catalog.routes.ts  # /api/catalog (тренды, фильмы, сериалы TMDB)
│       │   ├── stream.routes.ts   # /api/stream (извлечение потоков и озвучек)
│       │   ├── proxy.routes.ts    # /api/proxy (CORS/Referer m3u8 и ts прокси)
│       │   └── torrserver.routes.ts # /api/torrserver (4K торрент стриминг)
│       ├── services/
│       │   ├── tmdb.service.ts    # TMDB v3 API клиент (русский язык)
│       │   └── id-mapper.service.ts # Маппинг TMDB ID <-> Kinopoisk ID / IMDb
│       └── utils/
│           ├── rezka-decrypt.ts   # Деобфускатор прямых CDN потоков HDRezka
│           └── proxy-stream.ts    # HLS/m3u8 рерайтер чанков и Range-прокси
└── client/                        # Frontend: React + TypeScript + Vite + Tailwind
    ├── index.html                 # 1080p разметка с webapis.js для Tizen
    ├── config.xml                 # Манифест виджета Samsung Tizen Studio
    ├── vite.config.ts             # @vitejs/plugin-legacy (chrome >= 47, base: './')
    ├── tailwind.config.js         # Стили Liquid Glass и Focus Ring под 10-foot TV UI
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── App.tsx                # Корневой контроллер приложения и роутинг
        ├── main.tsx
        ├── index.css              # Стили стекла (.liquid-glass), свечений и физики пружин
        ├── types/                 # Общие TypeScript интерфейсы
        ├── navigation/
        │   ├── tizenKeys.ts       # Коды кнопок пульта ДУ и регистрация в Tizen WebAPIs
        │   ├── SpatialNavigation.ts # Векторный движок навигации стрелками
        │   └── useNavigation.ts   # React-хук для фокусируемых элементов
        ├── components/
        │   ├── Sidebar.tsx        # Боковое меню ТВ со стеклянным логотипом VARAHOVBA
        │   ├── TVCard.tsx         # Карточка тайтла с подсветкой и масштабированием
        │   ├── TVButton.tsx       # Кнопка с чётким фокусным кольцом и бликом
        │   ├── TVKeyboard.tsx     # Экранная виртуальная клавиатура (RU/EN)
        │   └── VideoPlayer/
        │       └── VideoPlayer.tsx # Кастомный плеер с жидким стеклом, OSD и сменой озвучек
        ├── pages/
        │   ├── HomePage.tsx       # Главная страница (Hero + карусели)
        │   ├── CatalogPage.tsx    # Сетка каталога с фильтрацией
        │   ├── SearchPage.tsx     # Экран поиска с экранной клавиатурой
        │   ├── DetailsPage.tsx    # Карточка тайтла, выбор озвучки, сезоны/серии
        │   └── HistoryPage.tsx    # История просмотров с таймкодами из localStorage
        └── services/
            ├── api.ts             # Клиент запросов (VITE_API_URL || 'http://localhost:3000')
            └── storage.ts         # Управление localStorage (история, избранное)
```

---

## 2. Быстрый запуск для разработки (Local Dev)

В корневой директории `tizen-cinema`:

```bash
# Установка зависимостей обоих проектов
npm install

# Запуск Backend (порт 5000)
npm run dev:server

# Запуск Frontend (порт 3000)
npm run dev:client
```

Откройте в браузере: `http://localhost:3000`

---

## 3. Управление с пульта Smart TV (Spatial Navigation)

Приложение спроектировано под **10-foot UI** (управление исключительно с пульта без использования мыши):

| Кнопка пульта | Код клавиши | Действие |
|---------------|-------------|----------|
| **Стрелки (▲ ▼ ◄ ►)** | `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` (38, 40, 37, 39) | Перемещение фокуса между карточками, меню, кнопками, клавиатурой |
| **Enter / ОК** | `Enter` (13) | Выбор элемента / Пауза и воспроизведение в плеере |
| **Return / Back** | `10009` (Tizen) / `Escape` / `Backspace` | Возврат на предыдущий экран / Выход из плеера с сохранением таймкода |
| **Влево (◄) в плеере** | `ArrowLeft` / `MediaRewind` (412) | Перемотка назад на 15 секунд |
| **Вправо (►) в плеере** | `ArrowRight` / `MediaFastForward` (417) | Перемотка вперед на 15 секунд |
| **Вверх (▲) в плеере** | `ArrowUp` (38) | Открытие панели настроек (смена озвучки и качества) |
| **Media Play / Pause** | `10252` / `415` / `19` | Управление паузой аппаратными медиа-кнопками пульта |

---

## 4. Сборка для Tizen OS 3.0 и упаковка в `.wgt`

Благодаря `@vitejs/plugin-legacy` бандл автоматически компилируется в синтаксис ES5/ES2015 со всеми полифиллами, совместимыми с движком **Chromium M47 (WebKit 2017)** телевизора UE49MU6100U.

```bash
# Сборка продакшн-бандла клиента
npm run build:client
```

Файлы сборки будут помещены в `client/dist/` вместе с готовым манифестом `config.xml`.

### Упаковка в `.wgt` через Tizen CLI:

1. Установите **Tizen Studio** и **Tizen CLI** с официального сайта Samsung Developer.
2. Создайте сертификат автора и дистрибьютора в Certificate Manager.
3. Выполните команду упаковки:
   ```bash
   tizen package -t wgt -s <Ваш_Профиль_Сертификата> -- client/dist
   ```
4. Полученный файл `TizenCinema.wgt` готов к установке.

### Установка на телевизор Samsung UE49MU6100U:

1. Включите ТВ и откройте раздел `Smart Hub` -> `Приложения` (Apps).
2. На пульте нажмите последовательно цифры: `1` -> `2` -> `3` -> `4` -> `5`.
3. В появившемся окне **Developer Mode** переведите переключатель в **ON** и введите локальный IP-адрес вашего компьютера.
4. Перезагрузите ТВ (удерживайте кнопку включения на пульте 3 секунды).
5. Подключитесь к ТВ через Tizen CLI или Device Manager:
   ```bash
   sdb connect <IP_Адрес_Телевизора>:26101
   ```
6. Установите приложение:
   ```bash
   tizen install -n TizenCinema.wgt -t <Device_ID>
   ```

---

## 5. Возможности бэкенда и обход блокировок / CORS

- **M3U8 Playlist Rewriting:** Эндпоинт `/api/proxy/m3u8` переписывает все чанки `.ts` и ссылки манифеста, пропуская их через бэкенд с подстановкой корректного `Referer` и отдавая ТВ заголовки `Access-Control-Allow-Origin: *`.
- **HTTP Range Streaming:** Эндпоинт `/api/proxy/chunk` поддерживает перемотку (`206 Partial Content`) для прямого стриминга на старый WebKit плеер.
- **Модульность экстракторов:** Легко подключать новые балансеры (Alloha, Collaps, VideoCDN) через наследование от `BaseExtractor`.
- **TorrServer:** Встроенная поддержка проброса торрент-потоков для воспроизведения «тяжелых» 4K HDR раздач без сжатия балансеров.

---

## 6. Автономный облачный деплой 24/7 (Railway / Render + Vercel)

Чтобы кинотеатр работал непрерывно без запущенного домашнего ПК:

### Шаг 1. Деплой Бэкенда (Railway / Render / VPS)
1. Создайте репозиторий на GitHub и отправьте код (см. инструкции Git).
2. Зайдите на [Railway.app](https://railway.app/) или [Render.com](https://render.com/).
3. Нажмите **New Service** -> **GitHub Repo** -> выберите репозиторий.
4. Настройки сервиса:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:** `PORT=3000` (или дефолтный порт платформы).
5. Получите публичный URL сервиса (например, `https://varahovba-cinema-server.up.railway.app`).

### Шаг 2. Деплой Фронтенда (Vercel) или установка на Smart TV
- **Вариант А (Vercel):**
  1. Импортируйте репозиторий на [Vercel](https://vercel.com/).
  2. Выберите **Root Directory:** `client`.
  3. В **Environment Variables** добавьте:
     `VITE_API_URL=https://varahovba-cinema-server.up.railway.app`
  4. Нажмите **Deploy**. Теперь веб-приложение доступно круглосуточно с любого браузера или ТВ через ссылку Vercel.
- **Вариант Б (Сборка виджета .wgt для Smart TV):**
  1. Задайте в `client/.env`:
     `VITE_API_URL=https://varahovba-cinema-server.up.railway.app`
  2. Соберите и упакуйте виджет:
     `npm run build:client`
  3. Установите `.wgt` на телевизор. Телевизор будет напрямую обращаться к облачному серверу через HTTPS/CORS.
