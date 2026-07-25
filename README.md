# Geometry Jump — PVZ Edition

Веб-игра в стиле Geometry Dash со скинами Plants vs Zombies, редактором уровней, аккаунтами и общими уровнями.

## Локальный запуск

```bash
npm install
npm start
```

Открой [http://127.0.0.1:5173](http://127.0.0.1:5173). Без `TURSO_*` данные пишутся в `server/data/accounts.json`.

## Онлайн / офлайн

Клиент проверяет `GET /api/health`. Если сервер недоступен:

- кнопка **Играть офлайн** (гостевой профиль в `localStorage`);
- прогресс и свои уровни — локально;
- блок «Уровни игроков», лайки и рейтинг скрыты.

## Бесплатный бэкенд (Render + Turso)

1. Создай БД на [Turso](https://turso.tech/) (free) и получи `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
2. Задеплой Web Service на [Render](https://render.com/) (free):
   - Build: `npm install`
   - Start: `node server/index.js`
   - Env: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, опционально `CORS_ALLOW_ALL=1`
3. Можно использовать [`render.yaml`](render.yaml) (Blueprint).
4. В APK укажи URL сервиса через `scripts/build-www.js` / `API_BASE` (см. ниже).

### Ограничения free-тарифов

- Render «засыпает» после простоя — первый запрос может занять 30–60 с; клиент покажет загрузку или уйдёт в офлайн по таймауту.
- Turso / Render free имеют квоты; для хобби-проекта обычно достаточно.
- Debug APK не для Google Play (нужна release-подпись).

## Android APK (Capacitor)

Требуются Node, **JDK 17** (Capacitor 6), Android SDK (Android Studio).

```bash
# URL API для APK (Render). Без переменной — пустой API_BASE (только офлайн / same-origin).
export GJ_API_BASE="https://your-service.onrender.com"
export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || echo /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home)"

npm install
npm run build:www
npx cap add android   # только первый раз, если нет папки android/
npm run apk:debug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

Установка: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`

Debug APK не для публикации в Play Store (нужна release-подпись).
