# public/geojsons

Locally-bundled GeoJSON and coordinate override data for known places. These
files are served directly from `/geojsons/...` at runtime so the app can render
specific places without a network round-trip to the geocoder.

## Directory layout

- `areas/` — administrative boundary polygons and other area-like GeoJSON files.
- `points/` — point-coordinate overrides and point-cloud demo data.

## Naming convention

```
<iso2-country>-<region>[-<sub-region>].json
```

- `iso2-country` — lowercase ISO 3166-1 alpha-2 code (e.g. `cn`, `us`, `ma`).
- For US files, `region` is the lowercase USPS state code (e.g. `tn`, `tx`, `ny`)
  followed by an optional sub-region.
- Words inside a segment are joined with `-` (kebab-case).

Examples:

| File                                  | Boundary it represents                       |
| ------------------------------------- | -------------------------------------------- |
| `areas/cn-shanghai.json`              | Shanghai municipality (China)                |
| `areas/cn-shanghai-minhang.json`      | Minhang district, Shanghai                   |
| `areas/cn-shanghai-new-districts.json` | Shanghai's "new" outer districts            |
| `areas/us-new-york-state.json`        | New York State                               |
| `areas/us-tn-williamson-county.json`  | Williamson County, Tennessee                 |
| `areas/us-tn-williamson-7-districts.json` | The 7 districts of Williamson County, TN |
| `areas/us-tx-williamson-county.json`  | Williamson County, Texas                     |
| `areas/ma-chichaoua-province.json`    | Chichaoua Province, Morocco                  |

## Special files

- `points/point-coords.json` — manual override map of `address -> [lng, lat]`
  used by `getSavedPointCoordsByAddress` in `src/utils/BasicMapTools.js` for
  places whose geocoded coordinates are unsatisfactory.
- `points/us-nyc-spikes.json` — NYC point cloud used by the bar-map demo.

## Wiring

Lookup of address -> file is centralized in `SavedRegionMap` inside
`src/utils/BasicMapTools.js`. When you add or rename a file here, update that
table (and only that table) accordingly.
