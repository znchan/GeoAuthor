# GeoAuthor

## Project Layout

```
GeoAuthor/
├── docs/                       # Frontend / backend contract docs
├── public/                     # Static assets and demo geojson/test data
├── src/
│   ├── App.vue                 # Top-level layout, global event wiring
│   ├── main.js                 # Vue app bootstrap
│   ├── assets/                 # Images, icons, base styles
│   ├── components/
│   │   ├── Row.vue             # Per-card layout (illustration + text + map)
│   │   ├── IllustrationCard.vue
│   │   ├── TextBlock.vue       # Quill-based article editor
│   │   └── MapDisplay.vue      # Mapbox-based renderer + tools
│   └── utils/
│       ├── BackendMsgs.js      # Backend client (mock-first, axios contracts)
│       ├── BasicMapTools.js    # Geocoding, route building, low-level map IO
│       ├── MapTools.js         # High-level orchestration on top of the above
│       ├── Store.js            # Per-card in-memory stores for map objects
│       ├── EventBus.js         # Lightweight pub/sub
│       ├── illustrationConfig.js
│       ├── mapDisplayConfig.js
│       └── mapServiceConfig.js # Map providers, tokens, scope levels
├── eslint.config.js
├── .prettierrc.json
├── .editorconfig
└── vite.config.js
```

## Architecture Overview

- **Components** communicate primarily through a small in-house pub/sub bus
  (`src/utils/EventBus.js`). Most events are scoped per article card via the
  `cardId` suffix (e.g. `update-prompt-${cardId}`). The full list of channels
  is documented in [`docs/frontend-contracts.md`](docs/frontend-contracts.md).
- **Stores** in `src/utils/Store.js` (`PointStore`, `LineStore`, `AreaStore`,
  `NumericalStore`, `CategoricalStore`) hold normalised records keyed by
  `cardId`. The record fields and category labels mirror the `text2json`
  contract.
- **Backend integration** lives entirely in `src/utils/BackendMsgs.js`. Each
  helper currently returns mock data so the UI can run offline; the live
  axios branch documents the request/response shape that a real backend should
  honour. See `docs/backend-contract.md`.

## Getting Started

### Requirements

- Node.js `^20.19.0 || >=22.12.0`
- npm 10+

### Install

```sh
npm install
```

### Development

```sh
npm run dev
```

The dev server listens on every interface (`0.0.0.0`) so it can be reached from
mobile devices and tunneling tools. Use `VITE_DEV_ALLOWED_HOSTS` to whitelist
extra hostnames (see below).

### Production Build

```sh
npm run build
npm run preview
```

### Code Quality

```sh
npm run format        # Prettier --write on src/ and root files
npm run format:check  # Prettier --check
npm run lint          # ESLint
npm run lint:fix      # ESLint --fix
```

`.editorconfig`, `.prettierrc.json`, and `eslint.config.js` are checked in so
contributors get consistent results regardless of their editor configuration.

## Configuration

Copy `.env.example` to `.env.local` to override defaults locally:

```sh
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `VITE_BACKEND_API_URL` | Base URL for the backend service. The frontend uses mock responses by default; the URL is consumed when the live axios branches are reached. |
| `VITE_MAPBOX_ACCESS_TOKEN` | Optional Mapbox token. When omitted, the prototype falls back to the legacy development token in `mapServiceConfig.js`. |
| `VITE_AMAP_KEY` | Optional Amap/Gaode key, used when geocoding inside China. Falls back to the legacy development key. |
| `VITE_DEV_ALLOWED_HOSTS` | Comma-separated host list for the Vite dev server (e.g. `.ngrok-free.dev,my-tunnel.ngrok-free.dev`). |

`.env.local` is git-ignored. Do not commit personal API keys.

## Backend Contract

`src/utils/BackendMsgs.js` is the source of truth for backend integration. The
helpers prefer mock/stub data so GeoAuthor can run without a backend, but the
axios branches show the intended wire contract. When refactoring:

- Do not rename endpoint paths, request fields, or response keys without
  versioning the contract.
- Keep mock/stub defaults so contributors can run the app offline.
- Keep `text2json` category keys (`marker`, `dot`, `other icon`, `trajectory`,
  `line`, `direction`, `regular shape`, `irregular area`) aligned with
  `src/utils/Store.js` and the renderer.

Function names are exported in both `snake_case` (legacy) and `camelCase`
(preferred for new code). See `docs/backend-contract.md` for the full
endpoint table.

## Map Service Notes

GeoAuthor mixes Mapbox, OpenStreetMap Nominatim, and Amap/Gaode in different
search and geometry flows. When changing geocoding or routing code, retest:

- article parsing into map objects
- map scope detection and view fitting
- marker, line, trajectory, and area rendering
- style edits from the illustration panel

## Recommended Browser Setup

Chromium-based browsers with Vue DevTools are recommended during development.
Firefox also works with Vue DevTools installed.

## Icons

GeoAuthor uses [Bootstrap Icons](https://icons.getbootstrap.com/).

## Contributing

Issues and pull requests are welcome. Before opening a PR:

1. Run `npm run format` and `npm run lint` and resolve any reported problems.
2. Run `npm run build` to ensure the production bundle still compiles.
3. If you touch the backend integration, also update
   `docs/backend-contract.md`.
4. If you add or rename an event bus channel, update
   `docs/frontend-contracts.md`.

## License

Licensing terms have not yet been finalised. Until a license file is added,
all rights are reserved by the original authors.
