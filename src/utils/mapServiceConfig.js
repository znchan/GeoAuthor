/**
 * Map provider configuration.
 *
 * The legacy tokens below are the development credentials used by the
 * GeoAuthor prototype. They are checked into the repository so the project
 * can be cloned and run without any setup, but they are intentionally low
 * privilege and rate-limited. For local development against your own quotas
 * (or when self-hosting an open-source fork) override them via the
 * environment variables documented in `.env.example`.
 */

export const LEGACY_MAPBOX_ACCESS_TOKEN =
  'pk.eyJ1IjoiYWJlaWlpaTc1MzMiLCJhIjoiY21pNWR5YjZ0MThnczJpczB4ajI4OGEzOCJ9.DnjH5NL6XoynxTDbzVBpMA';
export const LEGACY_AMAP_KEY = '190a5649aef2a75e503a582a78b7512a';

export const MAPBOX_ACCESS_TOKEN =
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || LEGACY_MAPBOX_ACCESS_TOKEN;
export const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || LEGACY_AMAP_KEY;

/**
 * Mapbox style URLs ordered to match the numeric ids used elsewhere in the
 * application (see `BackendMsgs.get_mapbackground`).
 *
 * 0: light, 1: dark, 2: satellite, 3: streets, 4: outdoors.
 */
export const MAPBOX_STYLES = [
  'mapbox://styles/mapbox/light-v10',
  'mapbox://styles/mapbox/dark-v11',
  'mapbox://styles/mapbox/satellite-v9',
  'mapbox://styles/mapbox/streets-v12',
  'mapbox://styles/mapbox/outdoors-v12',
];

/**
 * Default zoom level used when a backend `scope_level` is detected.
 * Keys come from the `text2json` contract; do not rename them.
 */
export const LEVEL_MAP = {
  country: 2,
  state: 4,
  province: 4,
  county: 6,
  city: 8,
  district: 10,
  city_metro: 8,
};

/**
 * Mapping of well-known English country names to their ISO 3166-1 alpha-2
 * codes. Used to constrain reverse geocoding results to a country when the
 * detected scope level is `country`.
 */
export const COUNTRY_CODE_MAP = {
  China: 'CN',
  'United States': 'US',
  'the United States': 'US',
  'the USA': 'US',
  'United Kingdom': 'GB',
  Japan: 'JP',
  Germany: 'DE',
  France: 'FR',
  Italy: 'IT',
  Spain: 'ES',
  Canada: 'CA',
  Australia: 'AU',
  India: 'IN',
  Russia: 'RU',
  Brazil: 'BR',
  England: 'GB',
  'South Korea': 'KR',
  Mexico: 'MX',
};
