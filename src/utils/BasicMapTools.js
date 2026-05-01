import mapboxgl from 'mapbox-gl';
import axios from 'axios';
import { PointStore, LineStore, AreaStore } from './Store';
import { ref, isRef } from 'vue';
import * as turf from '@turf/turf';
import { AMAP_KEY, COUNTRY_CODE_MAP, LEVEL_MAP, MAPBOX_ACCESS_TOKEN } from './mapServiceConfig';

export const mapboxAccessToken = ref(MAPBOX_ACCESS_TOKEN);
export { LEVEL_MAP };

const mapScopeMap = ref(new Map()); // cardid -> { scopeName: string, bbox: [minLng, minLat, maxLng, maxLat] }
export const getMapScope = (cardid) => {
  return mapScopeMap.value.get(String(cardid));
};
export const setMapScope = (cardid, mapScope) => {
  mapScopeMap.value.set(String(cardid), mapScope);
};

const map3DModeMap = ref(new Map()); // cardid -> boolean

export const isMap3DMode = (cardid) => {
  return map3DModeMap.value.get(String(cardid)) || false;
};
export const setMap3DMode = (cardid, is3D) => {
  map3DModeMap.value.set(String(cardid), is3D);
};

const countryCodeMap = COUNTRY_CODE_MAP;

const anotherGeocodeAddress = async (cardId, address, bbox = null) => {
  try {
    const scope = getMapScope(cardId);
    if (scope && scope.bbox && !bbox) {
      bbox = scope.bbox;
    }
    address = `${address}, ${scope ? scope.scopeName : ''}`;
    const encodedText = encodeURIComponent(address);
    const scopeCenter = scope && scope.scopeCenter ? scope.scopeCenter : null;
    // 1. Build the base URL. Default to JSON output and limit to one result.
    let url = `https://nominatim.openstreetmap.org/search?q=${encodedText}&format=jsonv2&limit=1`;

    const scopeLevel = scope ? scope.scopeLevel : null;

    // 2. When the scope is a country, filter Nominatim by ISO country code.
    if (scopeLevel === 'country' && countryCodeMap[scope.scopeName]) {
      const countryCode = countryCodeMap[scope.scopeName].toLowerCase();
      url = `https://nominatim.openstreetmap.org/search?q=${encodedText}&format=jsonv2&limit=1&countrycodes=${countryCode}`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MyMapApp/1.0 (zhanhanbeiii@zju.edu.cn)',
      },
    });
    const data = await response.json();
    let pickedAddress = null;
    let candidateAddress = [];
    if (data && data.length > 0) {
      let filtered = data;
      if (bbox) {
        // Filter results by bbox if provided
        const [minLng, minLat, maxLng, maxLat] = bbox;
        filtered = data.filter((feature) => {
          // const [lng, lat] = feature.center;
          const lng = parseFloat(feature.lon);
          const lat = parseFloat(feature.lat);
          return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
        });
      }
      if (address.includes(',')) {
        const parts = address.split(',');
        const counts = filtered.map((feature) => {
          const count = [feature.display_name, feature.name]
            .flatMap((text) => text?.split(','))
            .filter((part) => parts.some((p) => p.trim() === part)).length;
          return { feature, count };
        });

        const maxCount = Math.max(...counts.map((c) => c.count));
        const maxCountFeatures = counts.filter((c) => c.count === maxCount);
        filtered = maxCountFeatures.map((c) => c.feature);
      }
      if (filtered.length > 0) {
        pickedAddress = filtered[0];
        candidateAddress = filtered;
      } else {
        console.error('geocodeAddress no filter match, use original', address, data);
        return null;
      }
      // Reshape Nominatim's response into the Mapbox-style envelope used by callers.
      const newPickedAddress = {
        id: pickedAddress.place_id,
        place_name: pickedAddress.display_name,
        center: [parseFloat(pickedAddress.lon), parseFloat(pickedAddress.lat)],
      };
      const newCandidateAddress = candidateAddress.map((addr) => ({
        id: addr.place_id,
        place_name: addr.display_name,
        center: [parseFloat(addr.lon), parseFloat(addr.lat)],
      }));
      return { pickedAddress: newPickedAddress, candidateAddress: newCandidateAddress };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
};

const oneGeocodeAddress = async (cardId, address, bbox = null) => {
  try {
    const scope = getMapScope(cardId);
    if (scope && scope.bbox && !bbox) {
      bbox = scope.bbox;
    }
    address = `${address}, ${scope ? scope.scopeName : ''}`;
    const encodedText = encodeURIComponent(address);
    const scopeCenter = scope && scope.scopeCenter ? scope.scopeCenter : null;
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedText}.json?access_token=${mapboxAccessToken.value}`;

    const scopeLevel = scope ? scope.scopeLevel : null;
    if (scopeLevel === 'country' && countryCodeMap[scope.scopeName]) {
      url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedText}.json?access_token=${mapboxAccessToken.value}&country=${countryCodeMap[scope.scopeName]}&proximity=${scopeCenter}&types=address,place`;
    }

    const response = await axios.get(url);
    const data = response.data;
    let pickedAddress = null;
    let candidateAddress = [];
    if (data.features && data.features.length > 0) {
      let filtered = data.features;
      if (bbox) {
        // Filter results by bbox if provided
        const [minLng, minLat, maxLng, maxLat] = bbox;
        filtered = data.features.filter((feature) => {
          const [lng, lat] = feature.center;
          return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
        });
      }
      if (address.includes(',')) {
        const parts = address.split(',');
        const counts = filtered.map((feature) => {
          const count = [feature.place_name, feature.matching_place_name, feature.text]
            .flatMap((text) => text?.split(','))
            .filter((part) => parts.some((p) => p.trim() === part)).length;
          return { feature, count };
        });

        const maxCount = Math.max(...counts.map((c) => c.count));
        const maxCountFeatures = counts.filter((c) => c.count === maxCount);
        filtered = maxCountFeatures.map((c) => c.feature);
      }
      if (filtered.length > 0) {
        pickedAddress = filtered[0];
        candidateAddress = filtered;
      } else {
        console.error('geocodeAddress no filter match, use original', address, data.features);
        pickedAddress = data.features[0];
        candidateAddress = data.features;
      }
      return { pickedAddress, candidateAddress };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
};

const amapKey = AMAP_KEY;

const getChinaGeoAddress = async (cardId, address, bbox = null) => {
  try {
    const scope = getMapScope(cardId);

    // 1. Prefer the explicit bbox argument, otherwise inherit from the scope.
    if (scope && scope.bbox && !bbox) {
      bbox = scope.bbox;
    }

    // 2. Build query parameters. Passing `city` to Amap dramatically improves
    //    accuracy when the request lives inside a known administrative area.
    const cityLimit = scope && scope.scopeLevel && scope.scopeLevel === 8 ? scope.scopeName : '';
    const encodedAddress = encodeURIComponent(address);

    // build URL: https://restapi.amap.com/v3/geocode/geo?parameters
    let url = `https://restapi.amap.com/v3/geocode/geo?address=${encodedAddress}&key=${amapKey}`;
    if (cityLimit) {
      url += `&city=${encodeURIComponent(cityLimit)}`;
    }

    const response = await axios.get(url);
    const data = response.data;

    // Amap returns status === '1' on success.
    if (data.status !== '1' || !data.geocodes || data.geocodes.length === 0) {
      console.error('Amap geocoding found no match for address:', address);
      return null;
    }

    // 3. Reshape Amap's response into the Mapbox-style envelope used by callers.
    //    Mapbox exposes features[i].center as [lng, lat]. Amap exposes
    //    geocodes[i].location as the string "lng,lat".
    const results = data.geocodes.map((g) => {
      const [lng, lat] = g.location.split(',').map(Number);
      return {
        ...g,
        center: [lng, lat],
        place_name: g.formatted_address,
        text: g.name || g.formatted_address,
      };
    });

    let pickedAddress = null;
    let candidateAddress = [];

    // 4. Apply the bbox filter (matches the original behaviour from the other
    //    geocoders). NOTE: Amap returns coordinates in GCJ-02.
    let filtered = results;
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox;
      filtered = results.filter((feature) => {
        const [lng, lat] = feature.center;
        return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
      });
    }

    // 5. Pick the final result.
    if (filtered.length > 0) {
      pickedAddress = filtered[0];
      candidateAddress = filtered;
    } else {
      // No bbox match - fall back to the unfiltered top result.
      console.warn(
        'geocodeAddress no filter match within bbox, using original top result',
        address
      );
      pickedAddress = results[0];
      candidateAddress = results;
    }

    return { pickedAddress, candidateAddress };
  } catch (error) {
    console.error('Amap geocoding error:', error);
    return null;
  }
};

const getSavedPointCoordsByAddress = async (address) => {
  try {
    // Read the saved point-coordinate overrides straight from /public via fetch.
    const response = await fetch('/geojsons/points/point-coords.json');
    if (!response.ok) {
      console.warn(`Saved geo JSON not found: ${response.status}`);
      return null;
    }
    const coordsMap = await response.json();
    if (!Object.prototype.hasOwnProperty.call(coordsMap, address)) {
      return null;
    }
    const coords = coordsMap[address];
    return { place_name: address, center: coords };
  } catch (error) {
    console.error('Failed to read or parse saved geo JSON:', error);
    return null;
  }
};

export const geocodeAddress = async (cardId, address, bbox = null) => {
  const savedCoords = await getSavedPointCoordsByAddress(address);
  if (savedCoords) {
    return { pickedAddress: savedCoords, candidateAddress: [savedCoords] };
  }
  if (scopeInChina(cardId, address)) {
    const result = await getChinaGeoAddress(cardId, address, bbox);
    if (result) {
      return result;
    }
  }
  let result = await anotherGeocodeAddress(cardId, address, bbox);

  if (!result) {
    result = await oneGeocodeAddress(cardId, address, bbox);
  }

  if (result) {
    return result;
  }
  return { pickedAddress: null, candidateAddress: [] };
};

export const getGeocodingTypesByZoom = (zoom) => {
  /**
   * Mapbox Geocoding API `types` parameter filters the kinds of results
   * returned. Allowed values: country, region, postcode, district, place,
   * locality, neighborhood, address, poi, poi.landmark.
   *
   * Mapping from zoom level to types:
   *   0-3   - world view  -> country
   *   4-6   - continental -> region, country
   *   7-9   - city        -> place, region, country
   *   10-12 - town/street -> place, district, locality, address
   *   13-15 - addr/POI    -> address, poi, poi.landmark, place
   *   16+   - building    -> poi, poi.landmark, address
   */

  if (zoom >= 16) {
    return ['poi', 'poi.landmark', 'address'];
  } else if (zoom >= 13) {
    return ['poi', 'poi.landmark', 'address', 'place'];
  } else if (zoom >= 10) {
    return ['place', 'district', 'locality', 'address'];
  } else if (zoom >= 5) {
    return ['place', 'region', 'country'];
  } else if (zoom >= 2) {
    return ['region', 'country'];
  } else {
    return ['country'];
  }
};

const anotherReverseGeocode = async (lng, lat, zoom = null) => {
  let types = [];
  if (zoom) {
    types = getGeocodingTypesByZoom(zoom);
  }
  try {
    const typesParam = types.length ? `&types=${types.join(',')}` : '';
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxAccessToken.value}${typesParam}&language=en`;
    const response = await axios.get(url);
    const data = response.data;
    if (data.features && data.features.length > 0) {
      return {
        placeName: data.features[0].place_name || 'Unknown Place',
        address: data.features[0].place_name || '',
        context: data.features[0].context || [],
        coordinates: { lng, lat },
      };
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
  }
  return {
    placeName: 'Unknown Place',
    address: '',
    context: [],
    coordinates: { lng, lat },
  };
};

const scopeInChina = (cardId, display_name = '') => {
  const scope = getMapScope(cardId);
  let isChina =
    (scope && (scope.addressName === 'China' || scope.addressName === '中国')) ||
    display_name.includes('中国') ||
    display_name.includes('China');
  if (scope && !isChina) {
    const scopeBbox = scope.bbox;
    const ChinaBbox = [73.4997347, 8.6650385, 134.7754563, 53.5608154];
    if (
      scopeBbox[0] >= ChinaBbox[0] &&
      scopeBbox[1] >= ChinaBbox[1] &&
      scopeBbox[2] <= ChinaBbox[2] &&
      scopeBbox[3] <= ChinaBbox[3]
    ) {
      isChina = true;
    }
  }
  return isChina;
};

const getAddressNameByZoom = (cardId, zoom, data) => {
  const addr = data.address;
  const display_name = data.display_name;
  if (!zoom) return display_name;
  const scope = getMapScope(cardId);
  const isChina = scopeInChina(cardId, display_name);
  if (isChina) {
    const postcode = addr ? addr.postcode : null;
    const parts = data.display_name.split(', ');
    const cleanParts = parts.filter((part) => {
      if (postcode && part === postcode) return false;
      return true;
    });
    const cleanedAddr = cleanParts.join(', ');
    if (zoom >= 12) {
      // Very detailed: buildings, landmarks, specific addresses.
      return cleanedAddr;
    } else if (zoom >= 10) {
      // Medium: towns, streets, places.
      if (cleanedAddr.split(',').length <= 3) return cleanedAddr;
      return cleanedAddr.split(',').slice(1).join(',');
    } else if (zoom >= 7) {
      if (cleanedAddr.split(',').length <= 4) return cleanedAddr;
      return cleanedAddr.split(',').slice(3).join(',');
    } else if (zoom >= 5) {
      if (cleanedAddr.split(',').length <= 5) return cleanedAddr.split(',').slice(1).join(',');
      return cleanedAddr.split(',').slice(-5).join(',');
    } else if (zoom >= 2) {
      if (cleanedAddr.split(',').length <= 5) return cleanedAddr.split(',').slice(2).join(',');
      return cleanedAddr.split(',').slice(-3).join(',');
    } else {
      return cleanedAddr.split(',').pop();
    }
  } else {
    const componentList = [
      addr.road || addr.pedestrian || addr.footway, // street
      addr.neighbourhood || addr.suburb, // neighbourhood / suburb
      addr.district, // district
      addr.city || addr.town || addr.village, // city / town
      addr.state || addr.province || addr.region, // state / province
      addr.country, // country
    ];
    let components = [];
    if (zoom >= 12) {
      components = componentList;
    } else if (zoom >= 9) {
      components = componentList.slice(1);
    } else if (zoom >= 6) {
      components = componentList.slice(2);
    } else if (zoom >= 2) {
      components = componentList.slice(3);
    } else {
      components = componentList.slice(4);
    }
    const cleanAddress = components.filter((item) => item).join(', ');
    return cleanAddress;
  }
};

/**
 * Reverse geocode coordinates to a human-readable address.
 *
 * NOTE: This function intentionally short-circuits to a fixed Tokyo address
 * for the open-source demo. The live implementation below (Nominatim with
 * Mapbox fallback) is preserved as documentation of the wire contract and
 * is reachable as soon as the early `return` is removed.
 *
 * @param {string} cardId - card scope id (unused by the stub)
 * @param {number} lng
 * @param {number} lat
 * @param {?number} zoom
 * @returns {Promise<{placeName: string, address: any, context: Array, coordinates: {lng:number, lat:number}}>}
 */
export const reverseGeocode = async (cardId, lng, lat, zoom = null) => {
  // eslint-disable-next-line no-unreachable
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`;
    const response = await axios.get(url);
    const data = response.data;
    const addr = data.address;

    if (data.display_name) {
      return {
        placeName: getAddressNameByZoom(cardId, zoom, data) || 'Unknown Place',
        address: addr || '',
        context: data.context || [],
        coordinates: { lng, lat },
      };
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    const result = await anotherReverseGeocode(lng, lat, zoom);
    if (result) {
      return result;
    }
  }
  return {
    placeName: 'Unknown Place',
    address: '',
    context: [],
    coordinates: { lng, lat },
  };
};

const ROUTE_PROFILES = ['driving', 'walking', 'cycling', 'flight'];
export const normalizeProfile = (profile) =>
  ROUTE_PROFILES.includes(profile) ? profile : 'driving';

const buildRouteFeature = (geometry) => ({
  type: 'Feature',
  properties: {},
  geometry,
});

export const buildBoundsFromCoordinates = (coordinates) => {
  if (!coordinates || !coordinates.length || !coordinates[0].length) return null;
  const bounds = new mapboxgl.LngLatBounds(
    [coordinates[0][0], coordinates[0][1]],
    [coordinates[0][0], coordinates[0][1]]
  );
  coordinates.forEach((coord) => {
    if (Array.isArray(coord) && coord.length >= 2) {
      bounds.extend([coord[0], coord[1]]);
    }
  });
  return bounds;
};

export const buildBoundsFromgeojson = (geojson) => {
  if (!geojson) return null;
  const bounds = new mapboxgl.LngLatBounds();
  if (geojson.type === 'Feature') {
    // Feature: pull coordinates out of the inner geometry.
    coordinates = geojson.geometry?.coordinates;
  } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
    // Bare Geometry: use its coordinates directly.
    coordinates = geojson.coordinates;
  } else if (geojson.coordinates) {
    // Fallback: any object that exposes `coordinates`.
    coordinates = geojson.coordinates;
  }

  if (boundingbox) {
    bounds.extend([boundingbox[2], boundingbox[0]]);
    bounds.extend([boundingbox[3], boundingbox[1]]);
  } else {
    coordinates.forEach((coord) => {
      bounds.extend(coord);
    });
  }
  return bounds;
};

export const addPointByCoordinates = (
  mapInstance,
  pointSources,
  type = 0,
  iconImage = null,
  cardId = 'global',
  isWaypoint = null,
  isCategoricalOrNumerical = 'None'
) => {
  if (!mapInstance) return;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  const pointIds = [];
  pointSources.forEach((point, i) => {
    const coord = [point.lng, point.lat];
    const color = point.color || '#FF0000';
    const size = point.size || 6;
    const opacity = point.opacity || 1;
    minLng = Math.min(minLng, coord[0]);
    minLat = Math.min(minLat, coord[1]);
    maxLng = Math.max(maxLng, coord[0]);
    maxLat = Math.max(maxLat, coord[1]);

    const sourceId = `dot-source-${coord[0]}-${coord[1]}-${Date.now()}`;
    const layerId = `dot-layer-${coord[0]}-${coord[1]}-${Date.now()}`;
    if (mapInstance.getLayer(layerId)) {
      removePointByLayerId(mapInstance, cardId, layerId);
    }
    let layerData = null;
    const sourceData = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            lng: coord[0],
            lat: coord[1],
          },
          geometry: {
            type: 'Point',
            coordinates: coord,
          },
        },
      ],
    };
    mapInstance.addSource(sourceId, {
      type: 'geojson',
      data: sourceData,
    });
    [0, 2];
    if (type === 0) {
      // dot
      layerData = {
        id: layerId,
        type: 'circle',
        source: sourceId,
        metadata: { isCustom: true },
        paint: {
          'circle-radius': size,
          'circle-color': color,
          'circle-opacity': opacity,
          // Translucent stroke + slight blur produce a soft "halo" effect.
          'circle-stroke-width': 2,
          'circle-stroke-color': color,
          'circle-stroke-opacity': 0.3,
          'circle-blur': 0.2,
        },
      };
      mapInstance.addLayer(layerData);
    } else if (type === 1) {
      // marker
      layerData = {
        id: layerId,
        type: 'symbol',
        source: sourceId,
        metadata: { isCustom: true },
        layout: {
          'icon-image': 'pin',
          'icon-size': 0.18,
          'icon-anchor': 'bottom',
        },
        paint: {
          'icon-color': color,
        },
      };
      mapInstance.addLayer(layerData);
    } else if (type === 2) {
      // other icon
      layerData = {
        id: layerId,
        type: 'symbol',
        source: sourceId,
        metadata: { isCustom: true },
        layout: {
          'icon-image': iconImage,
          'icon-size': 0.18,
          'icon-anchor': 'center',
        },
      };
      mapInstance.addLayer(layerData);
    } else if (type === 3) {
      // circle with white stroke
      layerData = {
        id: layerId,
        type: 'circle',
        source: sourceId,
        metadata: { isCustom: true },
        paint: {
          'circle-radius': size,
          'circle-color': color,
          'circle-opacity': opacity,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#FFFFFF',
        },
      };
      mapInstance.addLayer(layerData);
    }
    if (isWaypoint !== null) {
      const waypointLayerData = {
        // Suffix `-label` keeps the label layer id unique relative to the marker.
        id: `${layerId}-label`,
        type: 'symbol',
        source: sourceId,
        layout: {
          'text-field': point.addressName || '',
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          // [horizontal, vertical] offset in `em` units. Positive vertical
          // values push the label below the anchor point.
          'text-offset': [0, 0.8],
          // 'top' anchor makes the label appear below the point; use
          // 'bottom' to position it above instead.
          'text-anchor': 'top',
          'text-size': 10,
        },
        metadata: { isCustom: true },
        paint: {
          'text-color': '#333333',
          // White halo keeps labels legible on busy basemaps.
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
          'text-halo-blur': 0.5,
        },
      };
      mapInstance.addLayer(waypointLayerData);
    }

    PointStore.add(cardId, {
      id: layerId,
      sourceId,
      type: type,
      coordinates: { lng: coord[0], lat: coord[1] },
      color: color,
      iconImage: iconImage,
      iconSize: 0.18,
      radius: size,
      addressName: point.addressName,
      isWaypoint: isWaypoint,
      candidateAddress: point.candidateAddress || [],
      candidateIndex: point.candidateIndex ?? 0,
      colorPosition: point.colorPosition || '',
      // One of: 'Categorical', 'Numerical', 'None'.
      isCategoricalOrNumerical: isCategoricalOrNumerical,
    });
    pointIds.push(layerId);
  });

  // Skip the bounds calculation if every point was filtered out or failed
  // to geocode, otherwise mapboxgl would receive invalid bounds.
  if (pointIds.length === 0) {
    return [];
  }

  const bounds = new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
  if (minLng !== maxLng || minLat !== maxLat) {
    mapInstance.fitBounds(bounds, {
      padding: 20,
      duration: 500,
    });
  } else {
    // All points collapse to a single coordinate; just fly to it.
    mapInstance.flyTo({
      center: [minLng, minLat],
      zoom: 10,
      speed: 1.2,
      curve: 1.42,
      essential: true,
    });
  }
  return pointIds;
};

export const addPointByAddress = async (
  mapInstance,
  cardId,
  addressList,
  type = 0,
  iconImage = null,
  bbox = null,
  visualEncoding = null,
  isWaypoint = null,
  isCategoricalOrNumerical = 'None'
) => {
  const points = [];
  const color = visualEncoding && visualEncoding.color ? visualEncoding.color : '#FF0000';
  const position = visualEncoding && visualEncoding.position ? visualEncoding.position : '';
  const size = visualEncoding && visualEncoding.size ? visualEncoding.size : 6;
  for (let i = 0; i < addressList.length; i++) {
    const address = addressList[i];
    const geocodeResult = await geocodeAddress(cardId, address, bbox);
    if (!geocodeResult || !geocodeResult.pickedAddress) {
      console.warn(`Failed to geocode address "${address}"`);
      continue;
    }
    const pickedAddress = geocodeResult.pickedAddress;
    const candidateAddress = geocodeResult.candidateAddress;
    const coord = pickedAddress.center;
    const lng = Number(coord[0]);
    const lat = Number(coord[1]);
    if (
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      console.warn(`Invalid coordinates for "${address}" -> [${coord}], skipped`);
      continue;
    }
    points.push({
      lng,
      lat,
      addressName: address,
      color: color,
      candidateAddress: candidateAddress,
      candidateIndex: 0,
      colorPosition: position,
      size: size,
    });
  }
  return addPointByCoordinates(
    mapInstance,
    points,
    type,
    iconImage,
    cardId,
    isWaypoint,
    isCategoricalOrNumerical
  );
};

export const fetchRouteFeature = async (waypoints, profile = 'driving') => {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    console.warn('A route needs at least two points.');
    return null;
  }
  const coordinatesString = waypoints.map((point) => `${point.lng},${point.lat}`).join(';');
  const normalizedProfile = normalizeProfile(profile);
  const apiUrl = `https://api.mapbox.com/directions/v5/mapbox/${normalizedProfile}/${coordinatesString}?geometries=geojson&access_token=${mapboxAccessToken.value}`;
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      console.error('No valid route found:', data);
      return null;
    }
    const geometry = data.routes[0].geometry;
    return {
      geometry,
      feature: buildRouteFeature(geometry),
      profile: normalizedProfile,
    };
  } catch (error) {
    console.error('Failed to fetch route data:', error);
    return null;
  }
};

const addRouteByCoordinates = async (
  mapInstance,
  waypoints,
  lineVisualEncoding,
  bbox = null,
  profile = 'driving',
  cardId = 'global'
) => {
  if (!mapInstance) {
    console.error('Map instance is not loaded.');
    return null;
  }
  const color = (lineVisualEncoding && lineVisualEncoding.color) || '#FF0000';
  const lineStyle = (lineVisualEncoding && lineVisualEncoding.lineStyle) || 'solid';
  const strokeWidth = Number(lineVisualEncoding && lineVisualEncoding.strokeWidth) || 3;
  const layerId = `route-layer-${Date.now()}`;
  const sourceId = `route-source-${Date.now()}`;
  if (profile === 'flight') {
    const coordinates = waypoints.map((point) => [point.lng, point.lat]);
    const sourceData = {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates,
        },
      },
    };
    const layerData = {
      id: layerId,
      type: 'line',
      source: sourceId,
      metadata: { isCustom: true },
      paint: {
        'line-color': color,
        'line-width': strokeWidth,
        'line-opacity': 0.6,
      },
    };
    mapInstance.addSource(sourceId, sourceData);
    mapInstance.addLayer(layerData);

    const bounds = buildBoundsFromCoordinates(coordinates);
    mapInstance.fitBounds(bounds, { padding: 20 });
    if (lineStyle === 'dashed') {
      mapInstance.setPaintProperty(layerId, 'line-dasharray', [2, 2]);
    }

    const bgLayerData = {
      id: `${layerId}-bg`,
      type: 'line',
      source: sourceId,
      metadata: { isCustom: true },
      paint: {
        'line-color': color,
        'line-width': strokeWidth + 4,
        // Slight blur produces a soft glow underneath the line.
        'line-blur': 4,
        'line-opacity': 0.4,
      },
    };
    mapInstance.addLayer(bgLayerData);

    return {
      layerId,
      sourceId,
      bounds,
      profile: 'flight',
    };
  } else {
    const routeData = await fetchRouteFeature(waypoints, profile);
    if (!routeData) {
      return null;
    }
    const sourceData = {
      type: 'geojson',
      data: routeData.feature,
    };
    const layerData = {
      id: layerId,
      type: 'line',
      source: sourceId,
      metadata: { isCustom: true },
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': color,
        'line-width': strokeWidth,
        'line-opacity': 0.6,
      },
    };
    mapInstance.addSource(sourceId, sourceData);
    mapInstance.addLayer(layerData);
    if (lineStyle === 'dashed') {
      mapInstance.setPaintProperty(layerId, 'line-dasharray', [2, 2]);
    }
    layerData.paint['line-dasharray'] = [2, 2];

    const bgLayerData = {
      id: `${layerId}-bg`,
      type: 'line',
      source: sourceId,
      metadata: { isCustom: true },
      paint: {
        'line-color': color,
        'line-width': strokeWidth + 4,
        // Slight blur produces a soft glow underneath the line.
        'line-blur': 4,
        'line-opacity': 0.4,
      },
    };
    mapInstance.addLayer(bgLayerData);
    const bounds = buildBoundsFromCoordinates(routeData.geometry?.coordinates);

    return {
      layerId,
      sourceId,
      bounds,
      profile: routeData.profile,
    };
  }
};

export const addLineByCoordinates = async (
  mapInstance,
  waypoints,
  lineVisualEncoding,
  type,
  bbox = null,
  cardId = 'global'
) => {
  if (!mapInstance) return;
  let layerId = null;
  let sourceId = null;
  let arrowLayerId = null;
  let profile = 'driving';
  let routeBounds = null;
  const color = (lineVisualEncoding && lineVisualEncoding.color) || '#FF0000';
  const lineStyle = (lineVisualEncoding && lineVisualEncoding.lineStyle) || 'solid';
  const strokeWidth = Number(lineVisualEncoding && lineVisualEncoding.strokeWidth) || 3;
  const colorPosition = (lineVisualEncoding && lineVisualEncoding.position) || '';
  let sourceData = null;
  let layerData = null;
  if (type === 0) {
    const routeResult = await addRouteByCoordinates(
      mapInstance,
      waypoints,
      lineVisualEncoding,
      bbox,
      profile,
      cardId
    );
    if (!routeResult) return null;
    layerId = routeResult.layerId;
    sourceId = routeResult.sourceId;
    routeBounds = routeResult.bounds;
    profile = routeResult.profile;
  } else if (type === 3) {
    // lines
    sourceId = `line-source-${Date.now()}`;
    layerId = `line-layer-${Date.now()}`;
    const coordinates = waypoints.map((point) => [point.lng, point.lat]);
    sourceData = {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates,
        },
      },
    };
    layerData = {
      id: layerId,
      type: 'line',
      source: sourceId,
      metadata: { isCustom: true },
      paint: {
        'line-color': color,
        'line-width': strokeWidth,
        'line-opacity': 0.8,
      },
    };
  } else if (type === 2) {
    // arrow on the line
    sourceId = `arrow-line-source-${Date.now()}`;
    layerId = `arrow-line-layer-${Date.now()}`;
    const coordinates = waypoints.map((point) => [point.lng, point.lat]);
    // Use the first and last points to determine the arrow's bearing.
    const start = coordinates[0];
    const end = coordinates[1];
    if (!start || !end) return;
    sourceData = {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates,
        },
      },
    };
    layerData = {
      id: layerId,
      type: 'line',
      source: sourceId,
      metadata: { isCustom: true },
      paint: {
        'line-color': color,
        'line-width': strokeWidth,
        'line-opacity': 0.6,
      },
    };
    // Add the arrow icon layer.
    const center = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    const arrowSourceId = `arrow-layer-source-${Date.now()}`;
    arrowLayerId = arrowSourceId;

    // Compute the rotation needed by the arrow icon.
    const dy = end[0] - start[0];
    const dx = end[1] - start[1];
    const rotation = (Math.atan2(dy, dx) * 180) / Math.PI - 90;

    const arrowSourceData = {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: center,
            },
            properties: {
              rotation: rotation,
            },
          },
        ],
      },
    };
    const arrowLayerData = {
      id: arrowLayerId,
      type: 'symbol',
      source: arrowSourceId,
      metadata: { isCustom: true },
      layout: {
        'icon-image': 'arrow',
        'icon-size': 0.12,
        'icon-allow-overlap': true,
        'icon-rotate': ['get', 'rotation'],
        'symbol-placement': 'point',
      },
      paint: {
        'icon-color': color,
        'line-opacity': 0.6,
      },
    };

    mapInstance.addSource(arrowSourceId, arrowSourceData);
    mapInstance.addLayer(arrowLayerData);
  }
  if (type !== 0) {
    mapInstance.addSource(sourceId, sourceData);

    if (lineStyle === 'dashed') {
      layerData.paint['line-dasharray'] = [2, 2];
    } else if (lineStyle === 'dotted') {
      layerData.layout = {
        'line-cap': 'round',
        'line-join': 'round',
      };
      if (strokeWidth >= 3) {
        layerData.paint['line-dasharray'] = [0, 4];
      } else {
        layerData.paint['line-dasharray'] = [0, 10];
      }
    } else {
      const bgLayerData = {
        id: `${layerId}-bg`,
        type: 'line',
        source: sourceId,
        metadata: { isCustom: true },
        paint: {
          'line-color': color,
          'line-width': strokeWidth + 2,
          // Slight blur produces a soft glow underneath the line.
          'line-blur': 4,
          'line-opacity': 0.4,
        },
      };
      mapInstance.addLayer(bgLayerData);
    }
    mapInstance.addLayer(layerData);
  }

  const defaultBounds = new mapboxgl.LngLatBounds(
    [waypoints[0].lng, waypoints[0].lat],
    [waypoints[waypoints.length - 1].lng, waypoints[waypoints.length - 1].lat]
  );
  const bounds = routeBounds || defaultBounds;

  mapInstance.fitBounds(bounds, {
    padding: 20,
  });
  const pointIds = [];
  // if (type === 2) {
  // }
  if (waypoints[0]) {
    const tmpPointIds = addPointByCoordinates(mapInstance, waypoints, 0, null, cardId, layerId);
    pointIds.push(...tmpPointIds);
  }
  return LineStore.add(cardId, {
    id: layerId,
    sourceId,
    type: type,
    waypoints: pointIds,
    strokeColor: color,
    strokeWidth: strokeWidth,
    strokeType: 0, // solid line
    arrowLayerId: arrowLayerId,
    profile: type === 0 ? profile : null,
    colorPosition: colorPosition,
  });
};

// lineVisualEncoding: { color: "#FF0000", lineStyle: "solid", strokeWidth: 1 }

const getWayGeojson = async (cardid, wayName) => {
  const scope = getMapScope(cardid);
  const bbox = scope && scope.bbox ? scope.bbox : null;
  // wayName = `${wayName}, ${scope ? scope.scopeName : ''}`;
  try {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(wayName)}&format=json&polygon_geojson=1`;
    if ((scope && scope.scopeLevel === 'country') || scope.scopeLevel === 2) {
      if (countryCodeMap[scope.scopeName]) {
        url += `&countrycodes=${countryCodeMap[scope.scopeName]}`;
      }
    }
    const response = await fetch(url);
    const data = await response.json();
    if (data.length > 0) {
      // const geoJSON = {
      //     type: "FeatureCollection",
      //     features: [{
      //         type: "Feature",
      //         properties: { name: wayName },
      //         geometry: data[0].geojson
      //     }]
      // };
      if (bbox) {
        // Filter GeoJSON features so only the parts within bbox remain.
        const [minLng, minLat, maxLng, maxLat] = bbox;
        const filtered = data.filter((feature) => {
          const coords = feature.boundingbox;
          const featureMinLat = parseFloat(coords[0]);
          const featureMaxLat = parseFloat(coords[1]);
          const featureMinLng = parseFloat(coords[2]);
          const featureMaxLng = parseFloat(coords[3]);
          return !(
            featureMaxLng < minLng ||
            featureMinLng > maxLng ||
            featureMaxLat < minLat ||
            featureMinLat > maxLat
          );
        });
        if (filtered.length === 0) {
          console.warn(
            'GeoJSON is empty after bbox filtering; no lines fall inside the bbox.',
            bbox
          );
          return null;
        }
        const geoJSON = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { name: filtered[0].display_name },
              geometry: filtered[0].geojson,
            },
          ],
        };
        const candidategeojson = filtered.map((f) => ({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { name: f.display_name },
              geometry: f.geojson,
            },
          ],
        }));
        return { geoJSON, data: candidategeojson };
      }
      // return {geoJSON, data};
    } else {
      throw new Error('Failed to fetch place boundary');
    }
  } catch (error) {
    console.error('Error fetching small place GeoJSON:', error);
  }
  return null;
};

const addGeoWayLineByAddress = async (
  mapInstance,
  cardId,
  wayName,
  lineVisualEncoding,
  bbox = null
) => {
  if (!mapInstance) {
    console.error('Map instance is not loaded.');
    return null;
  }
  wayName = wayName.replace('the ', '').replace('The ', '').trim();
  const geoData = await getWayGeojson(cardId, wayName);
  const geojson = geoData ? geoData.geoJSON : null;
  if (!geojson) {
    console.warn('No matching geographic lines were found.');
    return null;
  }
  const color = lineVisualEncoding.color || '#FF0000';
  const lineStyle = lineVisualEncoding.lineStyle || 'solid';
  const strokeWidth = Number(lineVisualEncoding.strokeWidth) || 3;
  const layerId = `geo-way-layer-${Date.now()}`;
  const sourceId = `geo-way-source-${Date.now()}`;

  const sourceData = {
    type: 'geojson',
    data: geojson,
  };
  const layerData = {
    id: layerId,
    type: 'line',
    source: sourceId,
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
    metadata: { isCustom: true },
    paint: {
      'line-color': color,
      'line-width': strokeWidth,
      'line-opacity': 0.6,
    },
  };
  mapInstance.addSource(sourceId, sourceData);
  mapInstance.addLayer(layerData);

  // Support both LineString and MultiLineString geometries.
  let coordinates = geojson.features[0].geometry.coordinates;
  if (geojson.features[0].geometry.type === 'MultiLineString') {
    // Flatten MultiLineString into a single coordinate array.
    coordinates = coordinates.flat();
  }
  // Validate that coordinates is a non-empty 2D array.
  if (
    !Array.isArray(coordinates) ||
    !Array.isArray(coordinates[0]) ||
    typeof coordinates[0][0] !== 'number'
  ) {
    console.warn('Invalid line coordinates:', coordinates);
    return null;
  }
  const bounds = buildBoundsFromCoordinates(coordinates);
  mapInstance.fitBounds(bounds, { padding: 20 });
  if (lineStyle === 'dashed') {
    mapInstance.setPaintProperty(layerId, 'line-dasharray', [2, 2]);
  }
  LineStore.add(cardId, {
    id: layerId,
    sourceId,
    type: 1,
    waypoints: [],
    geoLineName: wayName,
    strokeColor: color,
    strokeWidth: strokeWidth,
    strokeType: 0, // solid line
    profile: null,
    candidateAddress: geoData.data || [],
    candidateIndex: 0,
    colorPosition: lineVisualEncoding.position || '',
  });
  return {
    layerId,
    sourceId,
    bounds,
  };
};

export const addLineByAddress = async (
  mapInstance,
  cardId,
  addressListOrLine,
  lineVisualEncoding,
  type,
  bbox = null
) => {
  const waypoints = [];
  if (type === 1) {
    // line
    return await addGeoWayLineByAddress(
      mapInstance,
      cardId,
      addressListOrLine,
      lineVisualEncoding,
      bbox
    );
  }
  for (let i = 0; i < addressListOrLine.length; i++) {
    const address = addressListOrLine[i];
    const geocodeResult = await geocodeAddress(cardId, address, bbox);
    if (!geocodeResult || !geocodeResult.pickedAddress) {
      console.warn(`Failed to geocode address "${address}"`);
      continue;
    }
    const pickedAddress = geocodeResult.pickedAddress;
    const candidateAddress = geocodeResult.candidateAddress;
    const coord = pickedAddress.center;
    const pointColor =
      i === 0 ? '#339933' : i === addressListOrLine.length - 1 ? '#CC3333' : '#999999';
    waypoints.push({
      lng: coord[0],
      lat: coord[1],
      addressName: address,
      color: pointColor,
      candidateAddress: candidateAddress,
      candidateIndex: 0,
      colorPosition: (lineVisualEncoding && lineVisualEncoding.position) || '',
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return addLineByCoordinates(mapInstance, waypoints, lineVisualEncoding, type, bbox, cardId);
};

export const addPolygonByCoordinates = (
  mapInstance,
  points,
  visualEncoding,
  bbox = null,
  cardId = 'global',
  isDrawPoints = true
) => {
  if (!mapInstance) return;
  const sourceId = `polygon-source-${Date.now()}`;
  const layerId = `polygon-layer-${Date.now()}`;
  const coordinates = points.map((point) => [point.lng, point.lat]);
  coordinates.push([points[0].lng, points[0].lat]);
  const opacity = visualEncoding.opacity || 0.5;
  const color = visualEncoding.color || '#FF0000';
  const sourceData = {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates],
      },
    },
  };
  const layerData = {
    id: layerId,
    type: 'fill',
    source: sourceId,
    metadata: { isCustom: true },
    paint: {
      'fill-color': color,
      'fill-opacity': opacity,
    },
  };
  const outlineLayerData = {
    id: `${layerId}-outline`,
    type: 'line',
    source: sourceId,
    metadata: { isCustom: true },
    paint: {
      'line-color': '#FFFFFF',
      'line-width': 1,
    },
  };
  mapInstance.addSource(sourceId, sourceData);
  mapInstance.addLayer(layerData);
  mapInstance.addLayer(outlineLayerData);

  const pointIds = [];
  if (isDrawPoints) {
    const tmpPointIds = addPointByCoordinates(mapInstance, points, 0, null, cardId, layerId);
    pointIds.push(...tmpPointIds);
  }

  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  coordinates.forEach((coord) => {
    if (coord[0] < minLng) minLng = coord[0];
    if (coord[1] < minLat) minLat = coord[1];
    if (coord[0] > maxLng) maxLng = coord[0];
    if (coord[1] > maxLat) maxLat = coord[1];
  });
  const boundingbox = [minLng, minLat, maxLng, maxLat];
  const bounds = new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
  mapInstance.fitBounds(bounds, {
    padding: 20,
  });

  const polygonId = AreaStore.add(cardId, {
    id: layerId,
    type: 1,
    height: 10,
    points: pointIds,
    boundingbox: boundingbox,
    fillColor: color,
    fillOpacity: opacity,
    borderColor: '#FFFFFF',
    borderWidth: 1,
    sourceId: sourceId,
    colorPosition: visualEncoding.position || '',
  });
  return polygonId;
};

export const addPolygonByAddress = async (
  mapInstance,
  cardId,
  addressList,
  visualEncoding,
  bbox = null
) => {
  const points = [];
  for (const address of addressList) {
    const geocodeResult = await geocodeAddress(cardId, address, bbox);
    if (!geocodeResult || !geocodeResult.pickedAddress) {
      console.warn(`Failed to geocode address "${address}"`);
      continue;
    }
    const pickedAddress = geocodeResult.pickedAddress;
    const candidateAddress = geocodeResult.candidateAddress;
    const coord = pickedAddress.center;
    points.push({
      lng: coord[0],
      lat: coord[1],
      addressName: address,
      color: visualEncoding.color,
      candidateAddress: candidateAddress,
    });
  }
  return addPolygonByCoordinates(mapInstance, points, visualEncoding, bbox, cardId);
};

export const addCircleByCoordinates = (
  mapInstance,
  center,
  radius,
  address,
  candidateAddress,
  visualEncoding,
  cardId = 'global',
  isCategoricalOrNumerical = 'None'
) => {
  if (!mapInstance) return;
  const sourceId = `circle-source-${Date.now()}`;
  const layerId = `circle-layer-${Date.now()}`;
  const options = { steps: 64, units: 'meters' };
  const circleFeature = turf.circle([center.lng, center.lat], radius, options);
  const opacity = visualEncoding.opacity || 0.5;
  const color = visualEncoding.color || '#FF0000';
  const lineWidth = visualEncoding.lineWidth || 4;

  const sourceData = {
    type: 'geojson',
    data: circleFeature,
  };
  const layerData = {
    id: layerId,
    type: 'fill',
    source: sourceId,
    metadata: { isCustom: true },
    paint: {
      'fill-color': color,
      'fill-opacity': opacity,
    },
  };
  const outlineLayerBGData = {
    id: `${layerId}-outline-bg`,
    type: 'line',
    source: sourceId,
    metadata: { isCustom: true },
    paint: {
      'line-color': '#FFFFFF',
      'line-width': lineWidth + 2,
      'line-opacity': 0.5,
    },
  };
  const outlineLayerData = {
    id: `${layerId}-outline`,
    type: 'line',
    source: sourceId,
    metadata: { isCustom: true },
    paint: {
      'line-color': color,
      'line-width': lineWidth,
      'line-dasharray': [3, 2],
    },
  };

  mapInstance.addSource(sourceId, sourceData);
  mapInstance.addLayer(layerData);
  mapInstance.addLayer(outlineLayerBGData);
  mapInstance.addLayer(outlineLayerData);

  const bgLayerData = {
    id: `${layerId}-bg`,
    type: 'line',
    source: sourceId,
    metadata: { isCustom: true },
    paint: {
      'line-color': color,
      'line-width': lineWidth + 8,
      // Slight blur produces a soft glow underneath the line.
      'line-blur': 4,
      'line-opacity': 0.2,
    },
  };
  mapInstance.addLayer(bgLayerData);

  // Compute bounds.
  const bounds = buildBoundsFromCoordinates(circleFeature.geometry.coordinates[0]);
  mapInstance.fitBounds(bounds, {
    padding: 20,
  });

  // Build the boundingbox in [south, north, west, east] order.
  const boundingbox = [bounds.getSouth(), bounds.getNorth(), bounds.getWest(), bounds.getEast()];
  const circleId = AreaStore.add(cardId, {
    id: layerId,
    type: 2,
    center: center,
    radius: radius,
    height: 10,
    fillColor: color,
    fillOpacity: opacity,
    borderColor: '#FFFFFF',
    borderWidth: 1,
    boundingbox: boundingbox,
    candidateAddress: candidateAddress,
    addressName: address,
    sourceId: sourceId,
    colorPosition: visualEncoding.position || '',
    isCategoricalOrNumerical: isCategoricalOrNumerical, // 'Categorical', 'Numerical', 'None'
  });
  return circleId;
};

export const addCircleByAddress = async (
  mapInstance,
  cardId,
  address,
  radius,
  visualEncoding,
  bbox = null,
  isCategoricalOrNumerical = 'None'
) => {
  const geocodeResult = await geocodeAddress(cardId, address, bbox);
  if (!geocodeResult || !geocodeResult.pickedAddress) {
    console.warn(`Failed to geocode address "${address}"`);
    return null;
  }
  const pickedAddress = geocodeResult.pickedAddress;
  const candidateAddress = geocodeResult.candidateAddress;

  const coord = pickedAddress.center;
  const center = { lng: coord[0], lat: coord[1] };
  return addCircleByCoordinates(
    mapInstance,
    center,
    radius,
    address,
    candidateAddress,
    visualEncoding,
    cardId,
    isCategoricalOrNumerical
  );
};

export const addRectangleByAddress = async (
  mapInstance,
  cardId,
  corner1,
  corner2,
  visualEncoding,
  bbox = null
) => {
  const geocodeResult1 = await geocodeAddress(cardId, corner1, bbox);
  const geocodeResult2 = await geocodeAddress(cardId, corner2, bbox);
  if (!geocodeResult1 || !geocodeResult1.pickedAddress) {
    console.warn(`Failed to geocode address "${corner1}"`);
    return null;
  }
  if (!geocodeResult2 || !geocodeResult2.pickedAddress) {
    console.warn(`Failed to geocode address "${corner2}"`);
    return null;
  }
  const coord1 = geocodeResult1.pickedAddress.center;
  const coord2 = geocodeResult2.pickedAddress.center;

  const lng1 = coord1[0];
  const lat1 = coord1[1];
  const lng2 = coord2[0];
  const lat2 = coord2[1];
  const color = visualEncoding.color || '#FF0000';

  const points = [
    { lng: Math.min(lng1, lng2), lat: Math.min(lat1, lat2), color }, // bottom-left
    { lng: Math.max(lng1, lng2), lat: Math.min(lat1, lat2), color }, // bottom-right
    { lng: Math.max(lng1, lng2), lat: Math.max(lat1, lat2), color }, // top-right
    { lng: Math.min(lng1, lng2), lat: Math.max(lat1, lat2), color }, // top-left
  ];
  return addPolygonByCoordinates(mapInstance, points, visualEncoding, bbox, cardId, false);
};

const anotherSearchRegion = async (cardId, placeName, scope_level = -1, bbox = null) => {
  const key = 'd2a023c4ca464627a0146260632ddad2';
  const scope = getMapScope(cardId);
  const scopeName = scope ? scope.scopeName : null;
  placeName = scopeName ? `${placeName}, ${scopeName}` : placeName;
  bbox = bbox || (scope ? scope.bbox : null);
  // Step 1: geocoding -> get place_id
  const geoRes = await fetch(
    `https://api.geoapify.com/v1/geocode/search?text=${placeName}&apiKey=${key}`
  ).then((r) => r.json());

  const placeId = geoRes.features?.[0]?.properties?.place_id;
  if (!placeId) throw new Error('No place found');

  // Step 2: place-details -> get polygon
  const detailRes = await fetch(
    `https://api.geoapify.com/v2/place-details?id=${placeId}&apiKey=${key}`
  ).then((r) => r.json());
  return detailRes;
};

// Compute a rough [south, north, west, east] bounding box from GeoJSON.
const computeBoundingBoxFromGeoJSON = (geojson) => {
  if (!geojson || !geojson.coordinates) return null;

  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;

  const walkCoords = (coords) => {
    // Point coordinates: [lng, lat]
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    // Nested arrays (LineString / Polygon / MultiPolygon, ...)
    coords.forEach(walkCoords);
  };

  walkCoords(geojson.coordinates);

  if (!isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) {
    return null;
  }
  // Match the order Nominatim returns: [south, north, west, east].
  return [minLat, maxLat, minLng, maxLng];
};

/**
 * Helper: convert Amap polyline strings into GeoJSON geometries.
 */
const amapPolylineToGeoJSON = (polylineStr) => {
  if (!polylineStr) return null;

  const parts = polylineStr.split('|');
  const polygons = parts.map((part) => {
    const points = part.split(';').map((p) => {
      const [lng, lat] = p.split(',').map(Number);
      return [lng, lat];
    });
    // GeoJSON polygons require the ring to be explicitly closed.
    if (
      points[0][0] !== points[points.length - 1][0] ||
      points[0][1] !== points[points.length - 1][1]
    ) {
      points.push(points[0]);
    }
    // GeoJSON Polygon coordinates is a 3D array of rings.
    return [points];
  });

  if (polygons.length > 1) {
    return {
      type: 'MultiPolygon',
      coordinates: polygons,
    };
  } else {
    return {
      type: 'Polygon',
      coordinates: polygons[0],
    };
  }
};

const searchChinaRegion = async (cardId, placeName, scopeName, scope_level = -1, bbox = null) => {
  let searchName = placeName;
  if (scope_level === 8) {
    searchName = `${scopeName}${placeName}`;
  }
  const url = `https://restapi.amap.com/v3/config/district?key=${amapKey}&keywords=${encodeURIComponent(searchName)}&subdistrict=0&extensions=all`;
  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== '1' || !data.districts || data.districts.length === 0) {
      throw new Error(`Amap returned no administrative boundary for: ${searchName}`);
    }

    // Pick the top-ranked match.
    const district = data.districts[0];

    // 3. Convert Amap's polyline string into GeoJSON format.
    // Amap response format: "lng,lat;lng,lat|lng,lat;lng,lat" (| separates disjoint polygons).
    const geojson = amapPolylineToGeoJSON(district.polyline);

    // 4. Build a bounding box (Amap does not return one directly, so derive it from coordinates).
    const boundingbox = computeBoundingBoxFromGeoJSON(geojson);

    // 5. Reshape the result to match what callers expect.
    // NOTE: Amap's `level` field maps to province/city/district/...; align with scope_level when needed.
    return {
      geojson,
      // Keep the original Amap results for callers that need them.
      results: data.districts,
      boundingbox: [
        boundingbox[0], // minLng (west)
        boundingbox[2], // maxLng (east)
        boundingbox[1], // minLat (south)
        boundingbox[3], // maxLat (north)
      ],
    };
  } catch (error) {
    console.error('Amap district query failed, falling back:', error);
    // Fall through to the original fallback logic.
    if (typeof anotherSearchRegion === 'function') {
      const result = await anotherSearchRegion(cardId, placeName, scope_level, bbox);
      return result;
    }
    return null;
  }
};

export const searchRegion = async (cardId, placeName, scope_level = -1, bbox = null) => {
  const saved = await getSavedRegionGeojsonByAddress(placeName);
  if (saved) {
    const boundingbox = computeBoundingBoxFromGeoJSON(saved.features[0].geometry);
    const results = saved.features.filter((f) => f.geometry && f.geometry.type !== 'Point');
    return { geojson: results[0].geometry, results: results, boundingbox: boundingbox };
  }
  let res = null;
  let geojson = null;
  let results = [];
  let boundingbox = null;
  const scope = getMapScope(cardId);
  const scopeName = scope ? scope.scopeName : null;
  if (scopeInChina(cardId, placeName)) {
    const result = await searchChinaRegion(cardId, placeName, scopeName, scope_level, bbox);
    if (
      result &&
      (result.geojson || (result.features && result.features[0].geometry.type !== 'Point'))
    ) {
      geojson = result.geojson || result.features[0].geometry;
      boundingbox = result.boundingbox || computeBoundingBoxFromGeoJSON(geojson);
      return { geojson, results: result.features, boundingbox };
    }
  }
  placeName = scopeName ? `${placeName}, ${scopeName}` : placeName;
  if (!bbox) {
    bbox = scope ? scope.bbox : null;
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=${encodeURIComponent(
    placeName
  )}`;

  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'GeoSearch Demo' },
    });
    results = await res.json();
    if (results.length === 0) return null;

    const filteredByBbox = bbox
      ? results.filter((r) => {
          const bb = r.boundingbox.map(Number);
          const placeSouth = bb[0];
          const placeNorth = bb[1];
          const placeWest = bb[2];
          const placeEast = bb[3];
          const bboxSouth = bbox[1];
          const bboxNorth = bbox[3];
          const bboxWest = bbox[0];
          const bboxEast = bbox[2];
          // Require the place to be fully contained inside the bbox.
          return (
            placeWest >= bboxWest &&
            placeEast <= bboxEast &&
            placeSouth >= bboxSouth &&
            placeNorth <= bboxNorth
          );
        })
      : results;
    if (filteredByBbox.length === 0) {
      throw new Error(`No administrative boundary found for: ${placeName}`);
    }

    let found_osm = null;

    if (scope_level !== -1) {
      const matched = filteredByBbox.find(
        (r) => r.type === 'administrative' && Number(r?.extratags?.admin_level) === scope_level
      );
      found_osm = matched || filteredByBbox[0];
    } else {
      found_osm = filteredByBbox.find((r) => r.osm_type === 'relation') || filteredByBbox[0];
    }
    geojson = found_osm.geojson;
    if (!geojson || geojson.type === 'Point') {
      throw new Error('No geojson found for the region');
    }
    boundingbox = found_osm.boundingbox.map(Number);
  } catch (error) {
    console.error('Error fetching from Nominatim:', error);
  }

  try {
    const anotherResult = await anotherSearchRegion(cardId, placeName, scope_level, bbox);
    if (!anotherResult || !anotherResult.features?.[0]?.geometry) {
      console.error('No administrative boundary found for:', placeName);
    }
    const anotherResults = anotherResult.features.filter(
      (f) => f.geometry && f.geometry.type !== 'Point'
    );
    results.push(...anotherResults);
  } catch (error) {
    console.error('Error fetching from anotherSearchRegion:', error);
  }
  geojson = geojson || (results[0] && results[0].geometry);
  return { geojson, results, boundingbox };
};

/**
 * Map of incoming geocoded place names to a locally-shipped GeoJSON file.
 *
 * Keys come from upstream geocoders (Mapbox / Nominatim / Amap) or from
 * test-data inputs, so they MUST stay byte-identical to whatever is being
 * looked up at runtime. Values point to area files under `public/geojsons/areas/`
 * and follow this naming scheme:
 *   `<iso2-country>-<region>[-<sub-region>].json`
 * where `iso2-country` is the lowercase ISO 3166-1 alpha-2 code.
 *
 * @type {Record<string, string>}
 */
const SavedRegionMap = {
  // United States
  'New York': '/geojsons/areas/us-new-york-state.json',
  'New York State': '/geojsons/areas/us-new-york-state.json',
  'Williamson County, Tennessee': '/geojsons/areas/us-tn-williamson-county.json',
  "Franklin's Williamson County": '/geojsons/areas/us-tn-williamson-county.json',

  // Morocco
  'Chichaoua province': '/geojsons/areas/ma-chichaoua-province.json',
  Chichaoua: '/geojsons/areas/ma-chichaoua-province.json',

  // China
  Shanghai: '/geojsons/areas/cn-shanghai.json',
  Minhang: '/geojsons/areas/cn-shanghai-minhang.json',
  SH_new_district: '/geojsons/areas/cn-shanghai-new-districts.json',
};

const getSavedRegionGeojsonByAddress = async (address) => {
  const currentKeys = Object.keys(SavedRegionMap);
  if (!currentKeys.includes(address)) {
    return null;
  }
  try {
    // Read the GeoJSON straight from /public via fetch.
    const response = await fetch(SavedRegionMap[address]);
    if (!response.ok) {
      console.warn(`Local GeoJSON not found: ${response.status}`);
      return null;
    }
    const geo = await response.json();
    return geo;
  } catch (error) {
    console.error('Failed to read or parse JSON:', error);
    return null;
  }
};

export const addRegionByAddress = async (
  mapInstance,
  cardId,
  placeName,
  irregularAreaVisualEncoding,
  bbox = null,
  isCategoricalOrNumerical = 'None'
) => {
  const result = await searchRegion(cardId, placeName, -1, bbox);
  if (!result || !result.geojson) {
    console.error('No administrative boundary found for:', placeName);
    return;
  }
  const color = (irregularAreaVisualEncoding && irregularAreaVisualEncoding.color) || '#FF0000';
  const opacity = (irregularAreaVisualEncoding && irregularAreaVisualEncoding.opacity) || 0.5;
  const all_results = result.results;
  const geojson = result.geojson;
  const boundingbox = result.boundingbox;
  // const geojson = await getBoundaryGeoJSON(osmId);
  const sourceID = `region-source-${Date.now()}`;
  const layerID = `region-layer-${Date.now()}`;
  if (geojson.type === 'Point') {
    console.warn('Invalid geojson, skipping area addition.', geojson);
    return;
  }
  // Add or update the source on the map.
  if (mapInstance.getSource(sourceID)) {
    mapInstance.getSource(sourceID).setData(geojson);
  } else {
    const sourceData = {
      type: 'geojson',
      data: geojson,
    };
    const layerData = {
      id: `${layerID}`,
      type: 'fill',
      source: sourceID,
      metadata: { isCustom: true },
      paint: {
        'fill-color': color,
        'fill-opacity': opacity,
      },
    };
    const outlineLayerData = {
      id: `${layerID}-outline`,
      type: 'line',
      source: sourceID,
      metadata: { isCustom: true },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 1,
      },
    };
    const bgLayerData = {
      id: `${layerID}-bg`,
      type: 'line',
      source: sourceID,
      metadata: { isCustom: true },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': 4,
        // Slight blur on the border produces a soft glow.
        'line-blur': 4,
      },
    };
    mapInstance.addSource(sourceID, sourceData);
    mapInstance.addLayer(bgLayerData);
    mapInstance.addLayer(layerData);
    mapInstance.addLayer(outlineLayerData);
  }
  // Auto-fit the camera.
  const bounds = new mapboxgl.LngLatBounds();

  // Normalise different GeoJSON shapes into a coordinate ring.
  let coordinates = null;
  if (geojson.type === 'Feature') {
    // Feature: pull coordinates out of the inner geometry.
    coordinates = geojson.geometry?.coordinates;
  } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
    // Bare Geometry: use its coordinates directly.
    coordinates = geojson.coordinates;
  } else if (geojson.coordinates) {
    // Fallback: any object that exposes `coordinates`.
    coordinates = geojson.coordinates;
  }

  if (boundingbox) {
    bounds.extend([boundingbox[2], boundingbox[0]]);
    bounds.extend([boundingbox[3], boundingbox[1]]);
  } else {
    coordinates.forEach((coord) => {
      if (Array.isArray(coord[0])) {
        // MultiPolygon or polygon-with-holes (multiple rings).
        coord.forEach((ring) => {
          ring.forEach((point) => {
            bounds.extend(point);
          });
        });
        return;
      }
      bounds.extend(coord);
    });
  }

  if (bounds.isEmpty()) {
    console.warn('Bounds are empty; skipping auto fit.');
  } else {
    mapInstance.fitBounds(bounds, { padding: 20 });
  }

  const polygonId = AreaStore.add(cardId, {
    id: layerID,
    sourceId: sourceID,
    type: 0,
    boundingbox: boundingbox,
    fillColor: color,
    fillOpacity: opacity,
    borderColor: '#FFFFFF',
    borderWidth: 1,
    height: 10,
    addressName: placeName,
    candidateAddress: all_results,
    colorPosition: (irregularAreaVisualEncoding && irregularAreaVisualEncoding.position) || '',
    isCategoricalOrNumerical: isCategoricalOrNumerical, // 'Categorical', 'Numerical', 'None'
  });
  return polygonId;
};

export const get3DRegionHeight = (cardId, normalizedValue, bbox = null) => {
  const scope = getMapScope(cardId);
  // if (!scope) return 10000;
  const scopeBbox = bbox || (scope ? scope.bbox : null);
  function getMaxHeightByScopeBbox() {
    // bbox = [minLng, minLat, maxLng, maxLat]
    // Fallback height when no scope bbox is available.
    if (!scopeBbox) return 18000;
    const area =
      Math.abs(scopeBbox[2] - scopeBbox[0]) *
      Math.abs(scopeBbox[3] - scopeBbox[1]) *
      111000 *
      // Approximate area in square metres (1 degree ~ 111 km at the equator).
      111000;
    if (area < 1e9) {
      return 500;
    }
    if (area < 1e10) {
      return 4000;
    } else if (area < 1e11) {
      // < 10 km^2
      return 10000;
    } else if (area < 1e12) {
      // < 100 km^2
      return 40000; //
    } else if (area < 1e13) {
      // < 1000 km^2
      return 100000; //
    } else {
      // Larger regions get the tallest extrusion (~100 m visual cap).
      return 300000;
    }
    return area / 1e6;
  }
  // Map the normalised value to extrusion height in metres.
  const height = (normalizedValue + 0.01 || 0) * getMaxHeightByScopeBbox();
  return height;
};

export const add3DRegionByAddress = async (
  mapInstance,
  cardId,
  placeName,
  normalizedValue,
  visualEncoding = {},
  bbox = null,
  isCategoricalOrNumerical = 'None'
) => {
  if (!mapInstance) return;
  // changeTo3D(mapInstance, cardId);
  const color = visualEncoding.color || '#FF0000';
  const opacity = visualEncoding.opacity || 0.6;
  const result = await searchRegion(cardId, placeName, -1, bbox);
  if (!result || !result.geojson) {
    console.error('No administrative boundary found for:', placeName);
    return;
  }
  const all_results = result.results;
  const geojson = result.geojson;
  const boundingbox = result.boundingbox;
  const height = get3DRegionHeight(cardId, normalizedValue, bbox);

  const sourceID = `3d-region-source-${Date.now()}`;
  const layerID = `3d-region-layer-${Date.now()}`;
  const sourceData = {
    type: 'geojson',
    data: geojson,
  };
  const layerData = {
    id: layerID,
    type: 'fill-extrusion',
    source: sourceID,
    metadata: { isCustom: true },
    paint: {
      // Extrusion height (metres).
      'fill-extrusion-height': height,
      // Base offset from the ground (metres).
      'fill-extrusion-base': 0,
      // Fill color (could be data-driven for richer thematic maps).
      'fill-extrusion-color': color,
      'fill-extrusion-opacity': opacity,
      // Ambient occlusion adds shading at edges for depth.
      'fill-extrusion-vertical-gradient': true,
    },
  };
  const outlineLayerData = {
    id: `${layerID}-outline`,
    type: 'line',
    source: sourceID,
    metadata: { isCustom: true },
    paint: {
      'line-color': '#FFFFFF',
      'line-width': 1,
      'line-opacity': 0.0,
    },
  };
  mapInstance.addSource(sourceID, sourceData);
  mapInstance.addLayer(outlineLayerData);
  mapInstance.addLayer(layerData);

  // Auto-fit and tilt the camera to emphasise the 3D extrusions.
  mapInstance.easeTo({
    pitch: 60, // tilt enough to see the sides of extrusions
    bearing: -10, // rotate slightly to enhance the 3D feel
    duration: 1000,
  });
  setMap3DMode(cardId, true);
  const bounds = new mapboxgl.LngLatBounds();
  if (boundingbox) {
    bounds.extend([boundingbox[2], boundingbox[0]]);
    bounds.extend([boundingbox[3], boundingbox[1]]);
  } else {
    // Normalise different GeoJSON shapes into a coordinate ring.
    let coordinates = null;
    if (geojson.type === 'Feature') {
      // Feature: pull coordinates out of the inner geometry.
      coordinates = geojson.geometry?.coordinates;
    } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
      // Bare Geometry: use its coordinates directly.
      coordinates = geojson.coordinates;
    } else if (geojson.coordinates) {
      // Fallback: any object that exposes `coordinates`.
      coordinates = geojson.coordinates;
    }

    coordinates.forEach((coord) => {
      bounds.extend(coord);
    });
  }
  const polygonId = AreaStore.add(cardId, {
    id: layerID,
    sourceId: sourceID,
    type: 0,
    boundingbox: boundingbox,
    fillColor: color,
    fillOpacity: opacity,
    borderColor: '#FFFFFF',
    borderWidth: 1,
    addressName: placeName,
    candidateAddress: all_results,
    height: height,
    isCategoricalOrNumerical: isCategoricalOrNumerical, // 'Categorical', 'Numerical', 'None'
    colorPosition: visualEncoding.position || '',
  });
  return polygonId;
};

export const addTextByCoordinates = (
  mapInstance,
  cardId,
  position,
  text,
  textVisualEncoding = {}
) => {
  if (!mapInstance) return;
  const sourceId = `text-source-${Date.now()}`;
  const layerId = `text-layer-${Date.now()}`;
  const color = textVisualEncoding.color || '#333333';
  const size = textVisualEncoding.size || 14;

  const sourceData = {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [position.lng, position.lat],
          },
          properties: {
            text: text,
          },
        },
      ],
    },
  };
  const layerData = {
    id: layerId,
    type: 'symbol',
    source: sourceId,
    layout: {
      'text-field': ['get', 'text'],
      'text-size': size,
      'text-anchor': 'top',
      'text-offset': [0, 0.5],
    },
    paint: {
      'text-color': color,
      'text-halo-color': '#FFFFFF',
      'text-halo-width': 5,
      'text-halo-blur': 1,
    },
  };
  mapInstance.addSource(sourceId, sourceData);
  mapInstance.addLayer(layerData);

  // return PointStore.add(cardId, {
  //     id: layerId,
  //     sourceId,
  //     type: 2, // text
  //     coordinates: position,
  //     text: text,
  //     textColor: color,
  //     textSize: size,
  // });
};

export const removePointByLayerId = (mapInstance, cardId, layerId, removeFromStore = true) => {
  layerId = String(layerId);

  const layer = mapInstance.getLayer(layerId);
  if (layer) {
    const sourceId = layer.source;
    mapInstance.removeLayer(layerId);
    const labelLayerId = `${layerId}-label`;
    if (mapInstance.getLayer(labelLayerId)) {
      mapInstance.removeLayer(labelLayerId);
    }
    if (mapInstance.getSource(sourceId)) {
      mapInstance.removeSource(sourceId);
    }
  } else {
    console.warn(`✗ Point layer ${layerId} NOT found on map`);
  }

  if (removeFromStore) {
    PointStore.removeById(cardId, layerId);
  }
};

export const removeLineByLayerId = (mapInstance, cardId, layerId, removeFromStore = true) => {
  layerId = String(layerId);

  if (mapInstance.getLayer(layerId)) {
    const sourceId = mapInstance.getLayer(layerId).source;
    mapInstance.removeLayer(layerId);
    const bgLayerId = `${layerId}-bg`;
    if (mapInstance.getLayer(bgLayerId)) {
      mapInstance.removeLayer(bgLayerId);
    }
    if (mapInstance.getSource(sourceId)) {
      mapInstance.removeSource(sourceId);
    }
  } else {
    console.warn(`Line layer ${layerId} not found on map`);
  }

  const line = LineStore.getById(cardId, layerId);
  if (line) {
    const points = line.waypoints;
    if (points && Array.isArray(points)) {
      points.forEach((pointId, index) => {
        const pointIdStr = String(pointId);
        if (mapInstance.getLayer(pointIdStr)) {
          removePointByLayerId(mapInstance, cardId, pointIdStr, removeFromStore);
        } else {
          console.warn(
            `    ⚠ Waypoint layer ${pointIdStr} not found on map, only removing from store`
          );
          if (removeFromStore) {
            PointStore.removeById(cardId, pointIdStr);
          }
        }
      });
    } else {
      console.warn(`Line waypoints is not a valid array:`, points);
    }

    if (line.arrowLayerId) {
      const arrowLayer = mapInstance.getLayer(line.arrowLayerId);
      if (arrowLayer) {
        const arrowSourceId = arrowLayer.source;
        mapInstance.removeLayer(line.arrowLayerId);
        if (mapInstance.getSource(arrowSourceId)) {
          mapInstance.removeSource(arrowSourceId);
        }
      } else {
        console.warn(`Arrow layer ${line.arrowLayerId} not found on map`);
      }
    }
  } else {
    console.warn(`Line not found in store for cardId ${cardId}, layerId ${layerId}`);
  }
  if (removeFromStore) {
    LineStore.removeById(cardId, layerId);
  }
};

export const removeAreaByLayerId = (mapInstance, cardId, layerId, removeFromStore = true) => {
  layerId = String(layerId);
  if (mapInstance.getLayer(layerId)) {
    const sourceId = mapInstance.getLayer(layerId).source;
    mapInstance.removeLayer(layerId);
    mapInstance.removeLayer(`${layerId}-outline`);
    if (mapInstance.getLayer(`${layerId}-bg`)) {
      mapInstance.removeLayer(`${layerId}-bg`);
    }
    if (mapInstance.getSource(sourceId)) {
      mapInstance.removeSource(sourceId);
    }
  }
  const area = AreaStore.getById(cardId, layerId);
  if (area) {
    const points = area.points;
    if (points) {
      points.forEach((pointId) => {
        removePointByLayerId(mapInstance, cardId, pointId, removeFromStore);
      });
    }
  }
  if (removeFromStore) {
    AreaStore.removeById(cardId, layerId);
  }
};

const TypeName2StoreType = {
  dot: 0,
  marker: 1,
  'other icon': 2,
  trajectory: 0,
  line: 1,
  direction: 2,
  'irregular area': 0,
  'regular shape': 1,
  0: 0,
  1: 1,
  2: 2,
  3: 0,
  4: 1,
  5: 2,
  6: 0,
  7: 1,
};

export const removeElementByType = (mapInstance, cardId, type, removeFromStore = true) => {
  if (!mapInstance) return;
  if (type === 'dot' || type === 'marker' || type === 'other icon' || type < 3) {
    const points = PointStore.getAllByType(cardId, TypeName2StoreType[type]);
    points.forEach((point) => {
      removePointByLayerId(mapInstance, cardId, point.id, removeFromStore);
    });
  } else if (type === 'line' || type === 'trajectory' || type === 'direction' || type < 6) {
    const lines = LineStore.getAllByType(cardId, TypeName2StoreType[type]);
    lines.forEach((line) => {
      removeLineByLayerId(mapInstance, cardId, line.id, removeFromStore);
    });
  } else if (
    type === 'irregular area' ||
    type === 'polygon' ||
    type === 'regular shape' ||
    type < 9
  ) {
    const areas = AreaStore.getAllByType(cardId, TypeName2StoreType[type]);
    areas.forEach((area) => {
      removeAreaByLayerId(mapInstance, cardId, area.id, removeFromStore);
    });
  }
};

export const reloadPointsFromStoreByType = (mapInstance, cardId, type, isOverWrite = false) => {
  if (!mapInstance) return;
  const points = PointStore.getAllByType(cardId, type);
  points.forEach((point) => {
    const coord = [point.coordinates.lng, point.coordinates.lat];
    const color = point.color || '#FF0000';
    const sourceId = point.sourceId;
    const layerId = point.id;
    if (mapInstance.getLayer(layerId)) {
      if (isOverWrite) {
        removePointByLayerId(mapInstance, cardId, layerId);
      } else {
        return;
      }
    }
    mapInstance.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              lng: coord[0],
              lat: coord[1],
            },
            geometry: {
              type: 'Point',
              coordinates: coord,
            },
          },
        ],
      },
    });
    if (type === 0) {
      // dot
      mapInstance.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        metadata: { isCustom: true },
        paint: {
          'circle-radius': point.radius || 6,
          'circle-color': color,
          // Translucent stroke + slight blur produce a soft halo.
          'circle-stroke-width': 2,
          'circle-stroke-color': color,
          'circle-stroke-opacity': 0.3,
          'circle-blur': 0.2,
        },
      });
    } else if (type === 1) {
      // marker
      mapInstance.addLayer({
        id: layerId,
        type: 'symbol',
        source: sourceId,
        metadata: { isCustom: true },
        layout: {
          'icon-image': 'pin',
          'icon-size': point.iconSize || 0.18,
          'icon-anchor': 'bottom',
        },
        paint: {
          'icon-color': color,
        },
      });
    } else if (type === 2) {
      // other icon
      mapInstance.addLayer({
        id: layerId,
        type: 'symbol',
        source: sourceId,
        metadata: { isCustom: true },
        layout: {
          'icon-image': point.iconImage || 'default-other-icon',
          'icon-size': point.iconSize || 0.18,
          'icon-anchor': 'center',
        },
      });
    }
  });
};

export const removeElementById = (mapInstance, cardId, elementId, type, removeFromStore = true) => {
  if (!mapInstance) return;
  if (
    type === 'point' ||
    type === 'dot' ||
    type === 'marker' ||
    type === 'other icon' ||
    type < 3
  ) {
    removePointByLayerId(mapInstance, cardId, elementId, removeFromStore);
  } else if (type === 'line' || type === 'trajectory' || type === 'direction' || type < 6) {
    removeLineByLayerId(mapInstance, cardId, elementId, removeFromStore);
  } else if (
    type === 'area' ||
    type === 'irregular area' ||
    type === 'polygon' ||
    type === 'regular shape' ||
    type < 9
  ) {
    removeAreaByLayerId(mapInstance, cardId, elementId, removeFromStore);
  }
};

export const changeAllTo2D = (mapInstance, cardId) => {
  if (!mapInstance) return;
  const areas = AreaStore.getAll(cardId);
  areas.forEach((area) => {
    mapInstance.removeLayer(area.id);
    const layerData = {
      id: `${area.id}`,
      type: 'fill',
      source: area.sourceId,
      metadata: { isCustom: true },
      paint: {
        'fill-color': area.fillColor,
        'fill-opacity': area.fillOpacity || 0.5,
      },
    };
    // AreaStore.upsert(cardId, {
    //     ...area,

    // });
    mapInstance.addLayer(layerData);
    const outlineLayerId = `${area.id}-outline`;
    mapInstance.setPaintProperty(outlineLayerId, 'line-opacity', 1);
  });
};

export const changeAllTo3D = (mapInstance, cardId) => {
  if (!mapInstance) return;
  const areas = AreaStore.getAll(cardId);
  areas.forEach((area) => {
    mapInstance.removeLayer(area.id);
    const layerData = {
      id: area.id,
      type: 'fill-extrusion',
      source: area.sourceId,
      metadata: { isCustom: true },
      paint: {
        // Extrusion height (metres).
        'fill-extrusion-height': area.height || 10,
        // Base offset from the ground (metres).
        'fill-extrusion-base': 0,
        // Fill color (could be data-driven for richer thematic maps).
        'fill-extrusion-color': area.fillColor || '#888888',
        'fill-extrusion-opacity': area.fillOpacity || 0.8,
        // Ambient occlusion adds shading at edges for depth.
        'fill-extrusion-vertical-gradient': true,
      },
    };
    mapInstance.addLayer(layerData);
    const outlineLayerId = `${area.id}-outline`;
    mapInstance.setPaintProperty(outlineLayerId, 'line-opacity', 0);
  });
};

export const changeTo3D = (mapInstance, cardId) => {
  if (!mapInstance) return;
  const currentPitch = mapInstance.getPitch();
  if (currentPitch < 60) {
    setMap3DMode(cardId, true);

    mapInstance.easeTo({ pitch: 60, bearing: -10, duration: 1000 });
    mapInstance.setFog({
      range: [0.5, 10],
      // Dark base colour to keep the 3D extrusions readable.
      color: '#242b3b',
      'horizon-blend': 0.1,
    });
    changeAllTo3D(mapInstance, cardId);
  } else {
    setMap3DMode(cardId, false);
    mapInstance.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
    mapInstance.setFog(null);
    changeAllTo2D(mapInstance, cardId);
  }
};
