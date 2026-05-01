import mapboxgl from 'mapbox-gl';
import { ref, isRef } from 'vue';
import pin from '../assets/pngs/pin2.png';
import caret from '../assets/pngs/caret.png';
import arrow from '../assets/pngs/arrow.png';
import tinycolor from 'tinycolor2';
import {
  get_mapbackground,
  get_mapscope,
  text2json,
  get_explanatory_text,
  modify_tag_LINE,
  modify_tag_AREA,
  modify_major_tag,
} from '../utils/BackendMsgs.js';
import { EventBus } from './EventBus';
import { PointStore, LineStore, AreaStore, NumericalStore, CategoricalStore } from './Store';
import defaultOtherIcon from '../assets/pngs/default-other-icon.png';
import * as turf from '@turf/turf';
import { MAPBOX_STYLES } from './mapServiceConfig';
import {
  mapboxAccessToken,
  normalizeProfile,
  buildBoundsFromCoordinates,
  getMapScope,
  setMapScope,
  setMap3DMode,
  isMap3DMode,
  addPointByAddress,
  addLineByAddress,
  addPolygonByAddress,
  fetchRouteFeature,
  searchRegion,
  addRegionByAddress,
  addCircleByAddress,
  addRectangleByAddress,
  add3DRegionByAddress,
  get3DRegionHeight,
  removePointByLayerId,
  removeLineByLayerId,
  removeAreaByLayerId,
  removeElementByType,
  reloadPointsFromStoreByType,
  changeTo3D,
  LEVEL_MAP,
  addCircleByCoordinates,
  addLineByCoordinates,
  addPointByCoordinates,
} from './BasicMapTools';

export { MAPBOX_STYLES };

/**
 * @typedef {Object} Point
 * @property {Object} coordinates {lng: number, lat: number}
 * @property {number} type {0: dot, 1: marker, 2: custom-icon}
 * @property {?string} addressName
 * @property {string} color
 * @property {number} radius
 * @property {?string} iconImage
 */

/**
 * @typedef {Object} Line
 * @property {Point} waypoints
 * @property {number} type {0: route, 1: line, 2: arrow-line}
 * @property {string} strokeColor
 * @property {number} strokeWidth
 * @property {number} strokeType {0: solid, 1: dashed}
 */

/**
 * @typedef {Object} Area
 * @property {number} type {0: regular-shape, 1: irregular-area}
 * @property {?string} addressName
 * @property {Line} borderLine
 * @property {string} fillColor
 * @property {string} fillOpacity
 * @property {string} borderColor
 * @property {number} borderWidth
 */

export const loadCustomImagesIntoMap = (mapInstance) => {
  const pinImage = new Image();
  pinImage.src = pin;

  pinImage.onload = () => {
    mapInstance.addImage('pin', pinImage, {
      sdf: true,
    });
  };

  pinImage.onerror = () => {
    console.error('Failed to load pin image from URL:', pin);
  };

  const caretImage = new Image();
  caretImage.src = caret;

  caretImage.onload = () => {
    mapInstance.addImage('caret', caretImage, {
      sdf: true,
    });
  };

  const arrowImage = new Image();
  arrowImage.src = arrow;

  arrowImage.onload = () => {
    mapInstance.addImage('arrow', arrowImage, {
      sdf: true,
    });
  };

  const defaultOtherIconImage = new Image();
  defaultOtherIconImage.src = defaultOtherIcon;

  defaultOtherIconImage.onload = () => {
    if (!mapInstance.hasImage('default-other-icon')) {
      mapInstance.addImage('default-other-icon', defaultOtherIconImage, {
        sdf: true,
      });
    }
  };
};

export const createRateLimitedExecutor = (fn, delay) => {
  const queue = [];
  let isProcessing = false;

  const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;

    isProcessing = true;
    const { args, resolve, reject } = queue.shift();

    try {
      const result = await fn(...args);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      // Always wait `delay` ms before draining the next call, regardless
      // of success/failure, to keep upstream rate limits happy.
      setTimeout(() => {
        isProcessing = false;
        processQueue();
      }, delay);
    }
  };

  return (...args) => {
    return new Promise((resolve, reject) => {
      queue.push({ args, resolve, reject });
      processQueue();
    });
  };
};

export const initMapInstance = async (version, containerId, content, cardid) => {
  EventBus.emit('start-loading', 'Parsing the article...');
  mapboxgl.accessToken = mapboxAccessToken.value;
  let bounds = null;
  let styleIdx = 0;
  let bbox = null;
  let cardId = cardid || 'global';
  PointStore.clear(cardId);
  LineStore.clear(cardId);
  AreaStore.clear(cardId);
  if (version !== 0) {
    try {
      styleIdx = await get_mapbackground(content);
      const scope = await get_mapscope(content);
      const primary_region = scope.primary_region;
      const scope_level = LEVEL_MAP[scope.scope_level] || 2;
      if (primary_region) {
        const result = await searchRegion(cardId, primary_region, scope_level);
        const scopeCenter = result.geojson ? turf.center(result.geojson) : null;
        let bbox = result.boundingbox;
        if (result && result.geojson && bbox) {
          bounds = new mapboxgl.LngLatBounds();
          bounds.extend([bbox[2], bbox[0]]);
          bounds.extend([bbox[3], bbox[1]]);
        }
        setMapScope(cardId, {
          scopeName: scope.primary_region,
          scopeLevel: scope.scope_level,
          scopeCenter: scopeCenter ? scopeCenter.geometry.coordinates : null,
          bbox: [
            result.boundingbox[2],
            result.boundingbox[0],
            result.boundingbox[3],
            result.boundingbox[1],
          ],
        });
        setMap3DMode(cardId, false);
      }
    } catch (err) {
      console.error('setupMap failed', err);
    }
  }

  let center = [139.6917, 35.6895]; // Tokyo as the default fallback center
  if (bounds && typeof bounds.getCenter === 'function') {
    const c = bounds.getCenter();
    if (c && typeof c.lng === 'number' && typeof c.lat === 'number') {
      center = [c.lng, c.lat];
    }
  }
  const mapInstance = new mapboxgl.Map({
    container: containerId,
    style: MAPBOX_STYLES[styleIdx],
    center: center,
    zoom: 10,
    projection: 'mercator',
    attributionControl: false,
    logoControl: false,
  });

  mapInstance.on('load', async () => {
    loadCustomImagesIntoMap(mapInstance);

    if (bounds) {
      mapInstance.fitBounds(bounds, {
        padding: 20,
      });
    }
    if (version !== 0) {
      await processJsonData(mapInstance, content, cardId, bbox);
    }
  });
  EventBus.emit('loading-done');

  // setMapInstance(cardId, mapInstance);
  return mapInstance;
};

export const processJsonData = async (
  mapInstance,
  text,
  cardId,
  bbox = null,
  isUpdating = false,
  newJson = null
) => {
  let data = null;
  EventBus.emit('start-loading', 'Loading map data...');
  const start = performance.now();
  if (newJson) {
    data = JSON.parse(JSON.stringify(newJson));
  } else {
    data = await text2json(text);
  }

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse data:', e, data);
      data = {};
    }
  }

  const irregularArea = data['irregular area'];
  const addRegionByAddressSafe = createRateLimitedExecutor(addRegionByAddress, 1005);
  if (irregularArea) {
    await Promise.all(
      irregularArea.map(async (area) => {
        const areaVisualEncoding = area.visualEncoding;
        if (areaVisualEncoding.opacity) {
          areaVisualEncoding.opacity = areaVisualEncoding.opacity * 0.5;
        }
        await addRegionByAddressSafe(mapInstance, cardId, area.content, areaVisualEncoding, bbox);
        // await add3DRegionByAddress(mapInstance, cardId, area.content, 0.5, areaVisualEncoding, bbox);
      })
    );
  }

  const regularShapes = data['regular shape'];
  if (regularShapes) {
    for (const regularShape of regularShapes) {
      const regularShapeVisualEncoding = regularShape.visualEncoding;
      if (regularShapeVisualEncoding.opacity) {
        regularShapeVisualEncoding.opacity = regularShapeVisualEncoding.opacity * 0.5;
      }
      if (regularShape.type === 'circle') {
        await addCircleByAddress(
          mapInstance,
          cardId,
          regularShape.center,
          regularShape.radius * 1000,
          regularShapeVisualEncoding,
          bbox,
          cardId
        );
      } else if (regularShape.type === 'rectangle') {
        await addRectangleByAddress(
          mapInstance,
          cardId,
          regularShape.corner1,
          regularShape.corner2,
          regularShapeVisualEncoding,
          bbox,
          cardId
        );
      } else if (regularShape.type === 'polygon') {
        await addPolygonByAddress(
          mapInstance,
          cardId,
          regularShape.vertex,
          regularShapeVisualEncoding,
          bbox,
          cardId
        );
      }
    }
  }

  const directions = data.direction;
  if (directions) {
    for (const dir of directions) {
      const visualEncoding = dir.visualEncoding;
      await addLineByAddress(mapInstance, cardId, [dir.from, dir.to], visualEncoding, 2, bbox);
    }
  }

  const lines = data.line;
  if (lines) {
    for (const line of lines) {
      const lineVisualEncoding = line.visualEncoding;
      await addLineByAddress(mapInstance, cardId, line.content, lineVisualEncoding, 1, bbox);
    }
  }

  const trajectorys = data.trajectory;
  if (trajectorys) {
    for (const trajectory of trajectorys) {
      const trajectoryVisualEncoding = trajectory.visualEncoding;
      await addLineByAddress(
        mapInstance,
        cardId,
        trajectory.sequence,
        trajectoryVisualEncoding,
        0,
        bbox
      );
    }
  }
  const markers = data.marker;
  if (markers) {
    for (const marker of markers) {
      const markerVisualEncoding = marker.visualEncoding;
      const address = marker.content ?? marker.sequence;
      await addPointByAddress(mapInstance, cardId, [address], 1, null, bbox, markerVisualEncoding);
    }
  }
  const dots = data.dot;
  if (dots) {
    for (const dot of dots) {
      const dotVisualEncoding = dot.visualEncoding;
      const address = dot.content ?? dot.sequence;
      await addPointByAddress(mapInstance, cardId, [address], 0, null, bbox, dotVisualEncoding);
    }
    // const dotsVisualEncoding = dots.visualEncoding;
    // const position = dotsVisualEncoding.position || '';
    // await addPointByAddress(mapInstance, cardId, dots.content, 0, null, bbox, dotsVisualEncoding.color, null, position);
  }

  const otherIcons = data['other icon'];
  if (otherIcons) {
    let iconImage = null;

    const customIconName = `custom-icons-${cardId}`;
    try {
      const stored = localStorage.getItem(customIconName);
      if (stored) {
        const icons = JSON.parse(stored);
        const foundIcon = icons.find(
          (i) => i.name === customIconName || i.name === otherIcons.iconImage
        );

        if (foundIcon) {
          const img = new Image();
          img.onload = () => {
            if (!mapInstance.hasImage(foundIcon.name)) {
              mapInstance.addImage(foundIcon.name, img);
            }
            iconImage = foundIcon.name;
          };
          img.src = foundIcon.dataUrl;
        }
      }
    } catch (error) {
      console.error('Failed to load custom icon from storage:', error);
    }

    if (!iconImage) {
      iconImage = 'default-other-icon';
      if (!mapInstance.hasImage('default-other-icon')) {
        const defaultImg = new Image();
        defaultImg.src = defaultOtherIcon;
        defaultImg.onload = () => {
          if (!mapInstance.hasImage('default-other-icon')) {
            mapInstance.addImage('default-other-icon', defaultImg);
          }
        };
      }
    }

    for (const otherIcon of otherIcons) {
      const otherIconVisualEncoding = otherIcon.visualEncoding;
      await addPointByAddress(
        mapInstance,
        cardId,
        [otherIcon.content],
        2,
        iconImage,
        bbox,
        otherIconVisualEncoding
      );
    }
  }

  if (isUpdating) {
    EventBus.emit(`clear-all-highlights-${cardId}`);
    EventBus.emit(`highlight-text-${cardId}`);
    EventBus.emit('loading-done');
    return;
  }
  EventBus.emit('start-loading', 'Loading the view...');
  const prompt_data_json = await getAndParseExplanatoryText(text, data);

  EventBus.emit(`update-prompt-${cardId}`, {
    prompt_data_json: prompt_data_json,
    json_data: data,
  });
  // Refresh text highlights so the article reflects the new map state.
  EventBus.emit(`clear-all-highlights-${cardId}`);
  EventBus.emit(`highlight-text-${cardId}`);
  EventBus.emit('loading-done');

  // `start` is captured for ad-hoc profiling during development.
  void start;
};

const getAndParseExplanatoryText = async (text, text2jsonData, prompt_data = null) => {
  if (!prompt_data) {
    const keys = Object.keys(text2jsonData);
    keys.forEach((key) => {
      const value = text2jsonData[key];
      if (
        value === null ||
        value === undefined ||
        (typeof value === 'object' &&
          value !== null &&
          ((Array.isArray(value) && value.length === 0) ||
            (Object.prototype.toString.call(value) === '[object Object]' &&
              Object.keys(value).length === 0)))
      ) {
        delete text2jsonData[key];
      }
    });
    prompt_data = await get_explanatory_text(text, text2jsonData);
  }

  // Normalise prompt_data into a plain object: parse strings, keep objects.
  let prompt_data_json;
  if (typeof prompt_data === 'string') {
    try {
      prompt_data_json = JSON.parse(prompt_data);
    } catch (error) {
      console.error('Failed to parse prompt_data as JSON:', error);
      console.error('Error position:', error.message);

      try {
        // First-pass repair: walk the string, escape control chars
        // that appear inside JSON string literals so JSON.parse can
        // accept them (the backend occasionally returns raw \n etc.).
        let fixed = '';
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < prompt_data.length; i++) {
          const char = prompt_data[i];
          const charCode = char.charCodeAt(0);

          if (escapeNext) {
            fixed += char;
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            fixed += char;
            escapeNext = true;
            continue;
          }

          if (char === '"') {
            inString = !inString;
            fixed += char;
            continue;
          }

          if (inString) {
            if (charCode >= 0x00 && charCode <= 0x1f) {
              // C0 control characters: escape the well-known
              // ones, drop everything else.
              if (char === '\n') {
                fixed += '\\n';
              } else if (char === '\r') {
                fixed += '\\r';
              } else if (char === '\t') {
                fixed += '\\t';
              } else if (char === '\f') {
                fixed += '\\f';
              } else if (char === '\b') {
                fixed += '\\b';
              } else {
                continue;
              }
            } else if (charCode >= 0x7f && charCode <= 0x9f) {
              // C1 control characters: drop them.
              continue;
            } else {
              fixed += char;
            }
          } else {
            fixed += char;
          }
        }

        prompt_data_json = JSON.parse(fixed);
      } catch (e) {
        console.error('Failed to parse even after fixing control characters:', e);
        // Second-pass repair: strip every remaining control character
        // and try once more. This is a last-resort cleanup.
        try {
          let aggressive = prompt_data.replace(/[\x00-\x1F\x7F-\x9F]/g, (match) => {
            const code = match.charCodeAt(0);
            if (code === 0x0a) return '\\n';
            if (code === 0x0d) return '\\r';
            if (code === 0x09) return '\\t';
            if (code === 0x0c) return '\\f';
            if (code === 0x08) return '\\b';
            return '';
          });
          prompt_data_json = JSON.parse(aggressive);
        } catch (e2) {
          console.error('Failed even with aggressive cleaning:', e2);
          prompt_data_json = {};
        }
      }
    }
  } else if (typeof prompt_data === 'object' && prompt_data !== null) {
    prompt_data_json = prompt_data;
  } else {
    console.warn('prompt_data is neither string nor object:', typeof prompt_data, prompt_data);
    prompt_data_json = {};
  }

  // Strip control characters (including backspace) from string values.
  if (prompt_data_json && typeof prompt_data_json === 'object') {
    Object.keys(prompt_data_json).forEach((key) => {
      if (typeof prompt_data_json[key] === 'string') {
        prompt_data_json[key] = prompt_data_json[key]
          .replace(/[\b]/g, '')
          .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
          .trim();
      }
    });
  }
  return prompt_data_json;
};

// Update the visual style of a single point.
export const updatePointStyle = (mapInstance, cardId, pointId, style) => {
  if (!mapInstance) return;
  const point = PointStore.getById(cardId, pointId);
  if (!point) return;

  const layerId = point.id;
  const layer = mapInstance.getLayer(layerId);
  if (!layer) return;
  const newColorName = getDescriptiveColorName(style.fill);
  const oldColorName = getDescriptiveColorName(point.color);
  const colorPosition = style.colorPosition || point.colorPosition;
  const newColorPosition = colorPosition ? colorPosition.replace(oldColorName, newColorName) : '';
  if (newColorPosition !== point.colorPosition) {
    EventBus.emit(`update-color-position`, {
      cardId: cardId,
      oldColorPosition: point.colorPosition,
      newColorPosition: newColorPosition,
    });
    EventBus.emit(`update-color-position-for-object-${cardId}`, {
      newColorPosition: newColorPosition,
      type: point.type,
      id: point.id,
    });
  }

  PointStore.upsert(cardId, {
    id: pointId,
    color: style.fill !== undefined ? style.fill : point.color,
    radius: style.radius !== undefined ? style.radius : point.radius,
    iconSize: style.iconSize !== undefined ? style.iconSize : point.iconSize,
    description: style.description !== undefined ? style.description : point.description,
    colorPosition: newColorPosition !== undefined ? newColorPosition : point.colorPosition,
    isCategoricalOrNumerical:
      style.isCategoricalOrNumerical !== undefined
        ? style.isCategoricalOrNumerical
        : point.isCategoricalOrNumerical,
  });

  // Map style updates depend on the point's render type:
  //   0 = dot, 1 = built-in marker, 2 = custom icon (no color override).
  if (point.type === 0) {
    if (style.fill !== undefined) {
      mapInstance.setPaintProperty(layerId, 'circle-color', style.fill);
      mapInstance.setPaintProperty(layerId, 'circle-stroke-color', style.fill);
    }
    if (style.radius !== undefined) {
      mapInstance.setPaintProperty(layerId, 'circle-radius', style.radius);
    }
  } else if (point.type === 1) {
    if (style.fill !== undefined) {
      mapInstance.setPaintProperty(layerId, 'icon-color', style.fill);
    }
    if (style.iconSize !== undefined) {
      mapInstance.setLayoutProperty(layerId, 'icon-size', style.iconSize);
    }
  } else if (point.type === 2) {
    if (style.iconSize !== undefined) {
      mapInstance.setLayoutProperty(layerId, 'icon-size', style.iconSize);
    }
  }
  EventBus.emit(`highlight-text-${cardId}`);
};

// Update the visual style of a single line.
export const updateLineStyle = (mapInstance, cardId, lineId, style) => {
  if (!mapInstance) return;
  const line = LineStore.getById(cardId, lineId);
  if (!line) return;

  const layerId = line.id;
  const layer = mapInstance.getLayer(String(layerId));
  if (!layer) return;

  const newColorName = getDescriptiveColorName(style.strokeColor);
  const oldColorName = getDescriptiveColorName(line.strokeColor);
  const colorPosition = style.colorPosition || line.colorPosition;
  const profile = style.profile || line.profile;
  const newColorPosition = colorPosition ? colorPosition.replace(oldColorName, newColorName) : '';
  if (newColorPosition !== line.colorPosition) {
    EventBus.emit(`update-color-position`, {
      cardId: cardId,
      oldColorPosition: line.colorPosition,
      newColorPosition: newColorPosition,
    });
    EventBus.emit(`update-color-position-for-object-${cardId}`, {
      newColorPosition: newColorPosition,
      // Lines occupy slots 3..5 in the unified style-event taxonomy.
      type: line.type + 3,
      id: line.id,
    });
  }

  const updates = {};
  if (style.strokeColor !== undefined) updates.strokeColor = style.strokeColor;
  if (style.strokeWidth !== undefined) updates.strokeWidth = style.strokeWidth;
  if (style.strokeOpacity !== undefined) updates.strokeOpacity = style.strokeOpacity;
  if (style.strokeType !== undefined) updates.strokeType = style.strokeType;
  if (style.description !== undefined) updates.description = style.description;
  if (newColorPosition !== undefined) updates.colorPosition = newColorPosition;
  if (profile !== undefined) updates.profile = normalizeProfile(profile);
  updateRouteProfile(mapInstance, cardId, lineId, normalizeProfile(profile));
  LineStore.upsert(cardId, { id: lineId, ...updates });

  if (style.strokeColor !== undefined) {
    mapInstance.setPaintProperty(layerId, 'line-color', style.strokeColor);
    // Mirror the new color onto the optional arrow layer if present.
    if (line.arrowLayerId && mapInstance.getLayer(line.arrowLayerId)) {
      mapInstance.setPaintProperty(line.arrowLayerId, 'icon-color', style.strokeColor);
    }
    if (mapInstance.getLayer(`${layerId}-bg`)) {
      mapInstance.setPaintProperty(`${layerId}-bg`, 'line-color', style.strokeColor);
    }
  }
  if (style.strokeWidth !== undefined) {
    mapInstance.setPaintProperty(layerId, 'line-width', style.strokeWidth);
    if (mapInstance.getLayer(`${layerId}-bg`)) {
      mapInstance.setPaintProperty(`${layerId}-bg`, 'line-width', style.strokeWidth + 4);
    }
  }
  if (style.strokeOpacity !== undefined) {
    mapInstance.setPaintProperty(layerId, 'line-opacity', style.strokeOpacity);
    if (mapInstance.getLayer(`${layerId}-bg`)) {
      mapInstance.setPaintProperty(`${layerId}-bg`, 'line-opacity', style.strokeOpacity * 0.3);
    }
  }
  if (style.strokeType !== undefined) {
    // strokeType: 0 = solid, 1 = dashed
    const strokeTypeNum = Number(style.strokeType);
    if (strokeTypeNum === 1) {
      const dashArray = style.dashArray || [2, 3];
      mapInstance.setPaintProperty(layerId, 'line-dasharray', dashArray);
      const bgLayerId = `${layerId}-bg`;
      if (line.type !== 3) {
        if (mapInstance.getLayer(bgLayerId)) {
          mapInstance.setPaintProperty(bgLayerId, 'line-dasharray', dashArray);
        }
      } else {
        if (mapInstance.getLayer(bgLayerId)) {
          mapInstance.setPaintProperty(bgLayerId, 'line-width', style.strokeWidth + 8);
        }
      }
    } else {
      mapInstance.setPaintProperty(layerId, 'line-dasharray', undefined);
    }
  }

  EventBus.emit(`highlight-text-${cardId}`);
};

// Update the visual style of a single area.
export const updateAreaStyle = (mapInstance, cardId, areaId, style) => {
  if (!mapInstance) return;
  const area = AreaStore.getById(cardId, areaId);
  if (!area) return;

  const layerId = area.id;
  const newColorName = getDescriptiveColorName(style.fillColor);
  const oldColorName = getDescriptiveColorName(area.fillColor);
  const colorPosition = style.colorPosition || area.colorPosition;
  const newColorPosition = colorPosition ? colorPosition.replace(oldColorName, newColorName) : '';
  if (newColorPosition !== area.colorPosition) {
    EventBus.emit(`update-color-position`, {
      cardId: cardId,
      oldColorPosition: area.colorPosition,
      newColorPosition: newColorPosition,
    });

    EventBus.emit(`update-color-position-for-object-${cardId}`, {
      newColorPosition: newColorPosition,
      // Areas occupy slots 6..8 in the unified style-event taxonomy.
      type: area.type + 6,
      id: area.id,
    });
  }

  const updates = {};
  if (style.fillColor !== undefined) updates.fillColor = style.fillColor;
  if (style.fillOpacity !== undefined) updates.fillOpacity = style.fillOpacity;
  if (style.borderColor !== undefined) updates.borderColor = style.borderColor;
  if (style.borderWidth !== undefined) updates.borderWidth = style.borderWidth;
  if (style.description !== undefined) updates.description = style.description;
  if (style.radius !== undefined) updates.radius = style.radius;
  if (style.height !== undefined) updates.height = style.height;
  if (style.isMaskHighlight !== undefined) updates.isMaskHighlight = style.isMaskHighlight;
  if (newColorPosition !== undefined) updates.colorPosition = newColorPosition;
  if (style.isCategoricalOrNumerical !== undefined)
    updates.isCategoricalOrNumerical = style.isCategoricalOrNumerical;
  AreaStore.upsert(cardId, { id: areaId, ...updates });

  // Pick the right Mapbox property family per area type:
  //   0 = irregular region (admin), 1 = regular polygon, 2 = circle.
  if (area.type === 0) {
    const fillLayerId = `${layerId}`;
    const outlineLayerId = `${layerId}-outline`;
    if (isMap3DMode(cardId)) {
      if (style.height !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-extrusion-height', style.height);
      }
      if (style.fillColor !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-extrusion-color', style.fillColor);
      }
      if (style.fillOpacity !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-extrusion-opacity', style.fillOpacity);
      }
    } else {
      if (style.fillColor !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-color', style.fillColor);
      }
      if (style.fillOpacity !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-opacity', style.fillOpacity);
      }
      if (style.borderColor !== undefined && mapInstance.getLayer(outlineLayerId)) {
        mapInstance.setPaintProperty(outlineLayerId, 'line-color', style.borderColor);
      }
      if (style.borderWidth !== undefined && mapInstance.getLayer(outlineLayerId)) {
        mapInstance.setPaintProperty(outlineLayerId, 'line-width', style.borderWidth);
      }
    }
  } else if (area.type === 1) {
    const fillLayerId = layerId;
    const outlineLayerId = `${layerId}-outline`;
    if (!isMap3DMode(cardId)) {
      if (style.fillColor !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-color', style.fillColor);
      }
      if (style.fillOpacity !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-opacity', style.fillOpacity);
      }
      if (style.borderColor !== undefined && mapInstance.getLayer(outlineLayerId)) {
        mapInstance.setPaintProperty(outlineLayerId, 'line-color', style.borderColor);
      }
      if (style.borderWidth !== undefined && mapInstance.getLayer(outlineLayerId)) {
        mapInstance.setPaintProperty(outlineLayerId, 'line-width', style.borderWidth);
      }
    } else {
      if (style.height !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-extrusion-height', style.height);
      }
      if (style.fillColor !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-extrusion-color', style.fillColor);
      }
      if (style.fillOpacity !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-extrusion-opacity', style.fillOpacity);
      }
    }
  } else if (area.type === 2) {
    const fillLayerId = layerId;
    const outlineLayerId = `${layerId}-outline`;
    if (!isMap3DMode(cardId)) {
      if (style.fillColor !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-color', style.fillColor);
      }
      if (style.fillOpacity !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-opacity', style.fillOpacity);
      }
      if (style.borderColor !== undefined && mapInstance.getLayer(outlineLayerId)) {
        mapInstance.setPaintProperty(outlineLayerId, 'line-color', style.borderColor);
      }
      if (style.borderWidth !== undefined && mapInstance.getLayer(outlineLayerId)) {
        mapInstance.setPaintProperty(outlineLayerId, 'line-width', style.borderWidth);
      }
    } else {
      if (style.height !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-extrusion-height', style.height);
      }
      if (style.fillColor !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-extrusion-color', style.fillColor);
      }
      if (style.fillOpacity !== undefined && mapInstance.getLayer(fillLayerId)) {
        mapInstance.setPaintProperty(fillLayerId, 'fill-extrusion-opacity', style.fillOpacity);
      }
    }
    if (style.radius !== undefined && mapInstance.getLayer(fillLayerId)) {
      // Re-generate the circle's GeoJSON polygon for the new radius.
      const area = AreaStore.getById(cardId, areaId);
      if (!area || !area.center) return;
      const sourceId = area.sourceId;
      const center = { lng: area.center.lng, lat: area.center.lat };
      const options = { steps: 64, units: 'meters' };

      const circleFeature = turf.circle([center.lng, center.lat], style.radius, options);

      const source = mapInstance.getSource(sourceId);
      if (source && source.setData) {
        source.setData(circleFeature);
      }
    }
  }
  EventBus.emit(`highlight-text-${cardId}`);
};

export const updateWaypointOfLine = (mapInstance, cardId, layerId) => {
  if (!mapInstance) return;
  const line = LineStore.getById(cardId, layerId);
  if (!line) return;
  if (line.type === 0) {
    updateRouteProfile(mapInstance, cardId, layerId, line.profile);
  } else {
    if (!line.waypoints || !line.waypoints.length) {
      console.warn(`Line ${layerId} is missing waypoints`);
      return;
    }
    const waypointPoints = line.waypoints
      .map((pointId) => PointStore.getById(cardId, pointId))
      .filter((point) => point && point.coordinates);
    if (waypointPoints.length < 2) {
      console.warn(`Line ${layerId} needs at least two valid coordinates`);
      return;
    }
    const waypoints = waypointPoints.map((point) => ({
      lng: point.coordinates.lng,
      lat: point.coordinates.lat,
    }));
    const coordinates = waypoints.map((point) => [point.lng, point.lat]);
    const source = mapInstance.getSource(line.sourceId);
    if (!source || !source.setData) {
      console.warn(`No data source found for line ${layerId}`);
      return;
    }
    source.setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
    });
    const bounds = buildBoundsFromCoordinates(coordinates);
    if (bounds && !bounds.isEmpty()) {
      mapInstance.fitBounds(bounds, { padding: 20 });
    }

    if (line.type === 2 && line.arrowLayerId && mapInstance.getLayer(line.arrowLayerId)) {
      const dy = coordinates[1][0] - coordinates[0][0];
      const dx = coordinates[1][1] - coordinates[0][1];
      const center = [
        (coordinates[0][0] + coordinates[1][0]) / 2,
        (coordinates[0][1] + coordinates[1][1]) / 2,
      ];
      const rotation = (Math.atan2(dy, dx) * 180) / Math.PI - 90;

      const arrowSource = mapInstance.getSource(line.arrowLayerId);
      if (!arrowSource || !arrowSource.setData) {
        console.warn(`No data source found for arrow layer ${line.arrowLayerId}`);
        return;
      }
      arrowSource.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: center },
            properties: { rotation: rotation },
          },
        ],
      });
    }
  }
};

export const normalizeColor = (colorName) => {
  // 1. Try the input as-is.
  let color = tinycolor(colorName);

  // 2. Handle compound names like "deep blue" / "light pink" by stripping
  //    the modifier and tweaking the base color manually.
  if (!color.isValid()) {
    const lower = colorName.toLowerCase();

    if (lower.includes('deep') || lower.includes('dark')) {
      const baseColor = lower.replace(/(deep|dark)\s*/, '');
      color = tinycolor(baseColor).darken(20);
    } else if (lower.includes('light') || lower.includes('pale')) {
      const baseColor = lower.replace(/(light|pale)\s*/, '');
      color = tinycolor(baseColor).lighten(20);
    }
  }

  // 3. Return a hex color, falling back to mid-grey when still invalid.
  return color.isValid() ? color.toHexString() : '#888888';
};

export const cyclePointCandidate = (mapInstance, cardId, pointId) => {
  if (!mapInstance) return;
  const point = PointStore.getById(cardId, pointId);
  if (!point) return;

  const candidates = Array.isArray(point.candidateAddress) ? point.candidateAddress : [];
  if (!candidates.length) {
    console.warn(`Point ${pointId} has no candidate addresses to cycle through`);
    return;
  }

  const currentIndex = point.candidateIndex ?? 0;
  const nextIndex = (currentIndex + 1) % candidates.length;
  const nextCandidate = candidates[nextIndex];
  if (!nextCandidate || !Array.isArray(nextCandidate.center)) {
    console.warn(`Point ${pointId} candidate address is missing coordinates`);
    return;
  }
  const [lng, lat] = nextCandidate.center;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    console.warn(`Candidate coordinates are invalid:`, nextCandidate.center);
    return;
  }

  const source = mapInstance.getSource(point.sourceId);
  if (!source || !source.setData) {
    console.warn(`No data source found for point ${pointId}`);
    return;
  }

  source.setData({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          lng,
          lat,
        },
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      },
    ],
  });

  PointStore.upsert(cardId, {
    id: pointId,
    coordinates: { lng, lat },
    addressName: nextCandidate.place_name ?? point.addressName,
    candidateIndex: nextIndex,
  });

  if (isMap3DMode(cardId)) {
    mapInstance.flyTo({
      center: [lng, lat],
      zoom: 16,
      pitch: 60,
      bearing: -10,
      speed: 1.2,
      curve: 1.42,
      essential: true,
    });
  } else {
    mapInstance.flyTo({
      center: [lng, lat],
      zoom: 10,
      speed: 1.2,
      curve: 1.42,
      essential: true,
    });
  }
};

export const cycleLineCandidate = (mapInstance, cardId, lineId) => {
  if (!mapInstance) return;
  const line = LineStore.getById(cardId, lineId);
  if (!line) return;
  const candidates = Array.isArray(line.candidateAddress) ? line.candidateAddress : [];
  if (!candidates.length) {
    console.warn(`Line ${lineId} has no candidate addresses to cycle through`);
    return;
  }

  const currentIndex = line.candidateIndex ?? 0;
  const nextIndex = (currentIndex + 1) % candidates.length;
  const nextCandidate = candidates[nextIndex];
  const source = mapInstance.getSource(line.sourceId);
  if (!source || !source.setData) {
    console.warn(`No data source found for line ${lineId}`);
    return;
  }
  source.setData(nextCandidate);
  const bounds = buildBoundsFromCoordinates(nextCandidate.features[0].geometry.coordinates);
  if (isMap3DMode(cardId)) {
    mapInstance.fitBounds(bounds, {
      padding: 20,
      pitch: 60,
      bearing: -10,
    });
  } else {
    mapInstance.fitBounds(bounds, {
      padding: 20,
    });
  }
  const boundingbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  nextCandidate.boundingbox = boundingbox;

  LineStore.upsert(cardId, {
    id: lineId,
    candidateIndex: nextIndex,
    addressName: nextCandidate.place_name ?? line.addressName,
    boundingbox: nextCandidate.boundingbox ?? line.boundingbox,
    geojson: nextCandidate.geojson ?? line.geojson,
  });
};

export const cycleAreaCandidate = (mapInstance, cardId, areaId) => {
  if (!mapInstance) return;
  const area = AreaStore.getById(cardId, areaId);
  if (!area) return;
  const candidates = Array.isArray(area.candidateAddress) ? area.candidateAddress : [];
  if (!candidates.length) {
    console.warn(`Area ${areaId} has no candidate addresses to cycle through`);
    return;
  }

  const currentIndex = area.candidateIndex ?? 0;
  const nextIndex = (currentIndex + 1) % candidates.length;
  const nextCandidate = candidates[nextIndex];
  if (!nextCandidate) {
    console.warn(`Area ${areaId} candidate address is missing coordinates`);
    return;
  }
  const source = mapInstance.getSource(area.sourceId);
  if (!source || !source.setData) {
    console.warn(`No data source found for area ${areaId}`);
    return;
  }
  if (area.type === 2) {
    const center = nextCandidate.center;
    const options = { steps: 64, units: 'meters' };
    // Default radius is 5km when the candidate did not specify one.
    const radius = nextCandidate.radius || 5000;
    const circleFeature = turf.circle(center, radius, options);

    source.setData(circleFeature);
    const bounds = buildBoundsFromCoordinates(circleFeature.geometry.coordinates[0]);
    if (isMap3DMode(cardId)) {
      mapInstance.fitBounds(bounds, {
        padding: 20,
        pitch: 60,
        bearing: -10,
      });
    } else {
      mapInstance.fitBounds(bounds, {
        padding: 20,
      });
    }
    const boundingbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    nextCandidate.boundingbox = boundingbox;
  } else {
    if (!nextCandidate.geojson && !nextCandidate.geometry) {
      console.warn(`Area ${areaId} candidate address is missing geojson data`);
      return;
    }
    const data = nextCandidate.geojson || nextCandidate.geometry;
    source.setData(data);
    // Pull `coordinates` from a Feature.geometry or a raw geometry object.
    const coordinates = data.geometry?.coordinates || data.coordinates;
    if (!coordinates || !coordinates[0]) {
      console.warn(`Area ${areaId} GeoJSON has no valid coordinates`);
      return;
    }
    // Polygon: coordinates[0] is the outer ring [[lng,lat], ...]. If the
    // ring is one level deeper (MultiPolygon-style nesting), unwrap it.
    let ring = coordinates[0];
    if (Array.isArray(ring[0]) && Array.isArray(ring[0][0])) {
      ring = ring[0];
    }
    const bounds = buildBoundsFromCoordinates(ring);
    if (isMap3DMode(cardId)) {
      mapInstance.fitBounds(bounds, {
        padding: 20,
        pitch: 60,
        bearing: -10,
      });
    } else {
      mapInstance.fitBounds(bounds, {
        padding: 20,
      });
    }
    const boundingbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    nextCandidate.boundingbox = boundingbox;
  }

  AreaStore.upsert(cardId, {
    id: areaId,
    candidateIndex: nextIndex,
    addressName: nextCandidate.place_name ?? area.addressName,
    boundingbox: nextCandidate.boundingbox ?? area.boundingbox,
    center: nextCandidate.center
      ? { lng: nextCandidate.center[0], lat: nextCandidate.center[1] }
      : area.center,
    geojson: nextCandidate.geojson ?? area.geojson,
  });
};

export const updateRouteProfile = async (mapInstance, cardId, lineId, profile) => {
  if (!mapInstance) return;
  const normalizedProfile = normalizeProfile(profile);
  const line = LineStore.getById(cardId, lineId);
  if (!line || line.type !== 0) {
    console.warn(`Line ${lineId} is not a route, cannot switch travel profile`);
    return;
  }
  if (!line.waypoints || !line.waypoints.length) {
    console.warn(`Line ${lineId} is missing waypoints`);
    return;
  }
  const waypointPoints = line.waypoints
    .map((pointId) => PointStore.getById(cardId, pointId))
    .filter((point) => point && point.coordinates);
  if (waypointPoints.length < 2) {
    console.warn(`Line ${lineId} needs at least two valid coordinates`);
    return;
  }
  const waypoints = waypointPoints.map((point) => ({
    lng: point.coordinates.lng,
    lat: point.coordinates.lat,
  }));

  if (normalizedProfile === 'flight') {
    const coordinates = waypoints.map((point) => [point.lng, point.lat]);
    const source = mapInstance.getSource(line.sourceId);
    if (!source || !source.setData) {
      console.warn(`No data source found for line ${lineId}`);
      return;
    }
    source.setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates,
      },
    });
    const bounds = buildBoundsFromCoordinates(coordinates);
    if (bounds && !bounds.isEmpty()) {
      mapInstance.fitBounds(bounds, { padding: 20 });
    }
  } else {
    const routeData = await fetchRouteFeature(waypoints, normalizedProfile);
    if (!routeData) {
      return;
    }
    if (!line.sourceId) {
      console.warn(`Line ${lineId} has no sourceId, cannot update route`);
      return;
    }
    const source = mapInstance.getSource(line.sourceId);
    if (!source || !source.setData) {
      console.warn(`No data source found for line ${lineId}`);
      return;
    }
    source.setData(routeData.feature);
    const bounds = buildBoundsFromCoordinates(routeData.geometry?.coordinates);
    if (bounds && !bounds.isEmpty()) {
      mapInstance.fitBounds(bounds, { padding: 20 });
    }
  }
  LineStore.upsert(cardId, {
    id: lineId,
    profile: normalizedProfile,
  });
};

export const generateColorGradient = (color1, color2, comparisonCol) => {
  // `comparisonCol` is a numeric array. Each element is mapped to a color
  // along the gradient between color1 (min) and color2 (max) via linear
  // interpolation in RGB space.
  if (!Array.isArray(comparisonCol) || comparisonCol.length === 0) {
    return [];
  }

  color1 = normalizeColor(color1);
  color2 = normalizeColor(color2);

  const max = Math.max(...comparisonCol);
  const min = Math.min(...comparisonCol);
  const range = max - min;

  // If every value is identical, just paint everything in `color1`.
  if (!isFinite(range) || range === 0) {
    return comparisonCol.map(() => color1);
  }

  // Parse a #rgb / #rrggbb color into integer rgb components.
  function hexToRgb(hex) {
    let normalized = hex.replace('#', '');
    if (normalized.length === 3) {
      normalized = normalized
        .split('')
        .map((x) => x + x)
        .join('');
    }
    const num = parseInt(normalized, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  // Parse rgb()/rgba() (and a few other formats) into rgb components.
  function parseColor(str) {
    str = str.trim();
    if (str.startsWith('#')) return hexToRgb(str);
    const rgbMatch = str.match(/^rgb\s*\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})\s*\)$/i);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3]),
      };
    }
    const rgbaMatch = str.match(
      /^rgba\s*\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})[,\s]+([.\d]+)\s*\)$/i
    );
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1]),
        g: parseInt(rgbaMatch[2]),
        b: parseInt(rgbaMatch[3]),
      };
    }
    // hsl/hsla support is intentionally omitted; fall back to black.
    return { r: 0, g: 0, b: 0 };
  }

  function rgbToHex({ r, g, b }) {
    const v = (x) => {
      const h = x.toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return `#${v(r)}${v(g)}${v(b)}`;
  }

  const c1 = parseColor(color1);
  const c2 = parseColor(color2);

  // Map each value to a position in [0, 1] within [min, max] and lerp.
  const colors = comparisonCol.map((value) => {
    const ratio = (value - min) / range; // 0 -> color1, 1 -> color2
    const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
    const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
    const b = Math.round(c1.b + (c2.b - c1.b) * ratio);
    return rgbToHex({ r, g, b });
  });

  return colors;
};

export const generateColorGradient2 = (
  minColor,
  maxColor,
  comparisonCol,
  customMidpoint = null
) => {
  if (!Array.isArray(comparisonCol) || comparisonCol.length === 0) {
    return [];
  }

  function hexToRgb(hex) {
    let normalized = hex.replace('#', '');
    if (normalized.length === 3) {
      normalized = normalized
        .split('')
        .map((x) => x + x)
        .join('');
    }
    const num = parseInt(normalized, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function parseColor(str) {
    // Coerce nullish values into a sensible default to avoid crashes.
    str = str ? str.trim() : '#000000';
    if (str.startsWith('#')) return hexToRgb(str);
    const rgbMatch = str.match(/^rgb\s*\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})\s*\)$/i);
    if (rgbMatch) {
      return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
    }
    const rgbaMatch = str.match(
      /^rgba\s*\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})[,\s]+([.\d]+)\s*\)$/i
    );
    if (rgbaMatch) {
      return { r: parseInt(rgbaMatch[1]), g: parseInt(rgbaMatch[2]), b: parseInt(rgbaMatch[3]) };
    }
    return { r: 0, g: 0, b: 0 };
  }

  function rgbToHex({ r, g, b }) {
    const v = (x) => {
      // Clamp each channel to the valid 0-255 range before formatting.
      const h = Math.min(255, Math.max(0, x)).toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return `#${v(r)}${v(g)}${v(b)}`;
  }

  // Diverging gradient: minColor -> midColor (light grey) -> maxColor.
  const midColor = '#F8F8F8';
  const cMin = parseColor(minColor);
  const cMid = parseColor(midColor);
  const cMax = parseColor(maxColor);

  const dataMin = Math.min(...comparisonCol);
  const dataMax = Math.max(...comparisonCol);

  // Pick the diverging midpoint. Callers (e.g. election diffs) should pass
  // an explicit value (often 0). Otherwise fall back to the data midpoint.
  let midVal = customMidpoint;
  if (midVal === null || midVal === undefined) {
    midVal = (dataMin + dataMax) / 2;
  }

  const colors = comparisonCol.map((value) => {
    let startColor, endColor, ratio;

    if (value < midVal) {
      // Left half: [dataMin, midVal] -> minColor blends into midColor.
      startColor = cMin;
      endColor = cMid;
      const range = midVal - dataMin;
      ratio = range === 0 ? 0 : (value - dataMin) / range;
    } else {
      // Right half: [midVal, dataMax] -> midColor blends into maxColor.
      startColor = cMid;
      endColor = cMax;
      const range = dataMax - midVal;
      ratio = range === 0 ? 0 : (value - midVal) / range;
    }

    const r = Math.round(startColor.r + (endColor.r - startColor.r) * ratio);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * ratio);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * ratio);

    return rgbToHex({ r, g, b });
  });

  return colors;
};

export const updatePurpose = async (mapInstance, cardId, purposeData) => {
  if (!mapInstance) return;
  if (!purposeData) {
    console.warn('updatePurpose called without purpose data');
    return;
  }
  EventBus.emit('start-loading', 'Parsing data...');
  const changeType = purposeData.changeType;
  const purpose = purposeData.purpose;
  const purposeType = purpose.purpose;
  if (purposeType === 'categorical') {
    const rawPlaceName1 = purpose.place_name1 ?? [];
    const rawPlaceName2 = purpose.place_name2 ?? [];
    const color1 = normalizeColor(purpose.color1);
    const color2 = normalizeColor(purpose.color2);

    const placeName1 = Array.isArray(rawPlaceName1)
      ? rawPlaceName1
      : [rawPlaceName1].filter(Boolean);
    const placeName2 = Array.isArray(rawPlaceName2)
      ? rawPlaceName2
      : [rawPlaceName2].filter(Boolean);
    const addRegionByAddressSafe = createRateLimitedExecutor(addRegionByAddress, 1005);

    async function updateCategoricalData(placeName, color, className) {
      const name = `Categorical-${className}`;
      if (changeType === 'irregular area') {
        const regions = AreaStore.getAllByType(cardId, 0);
        let found = false;
        for (const region of regions) {
          if (region.type === 0 && region.addressName && region.addressName === placeName) {
            updateAreaStyle(mapInstance, cardId, region.id, {
              fillColor: color,
              borderColor: 'white',
              borderWidth: 1,
              height: 10,
              fillOpacity: 0.5,
              isCategoricalOrNumerical: name,
            });
            found = true;
            return region.id;
          }
        }
        if (!found) {
          return await addRegionByAddressSafe(
            mapInstance,
            cardId,
            placeName,
            { color, opacity: 0.3 },
            null,
            name
          );
        }
      } else if (changeType === 'marker') {
        const points = PointStore.getAllByType(cardId, 1);
        let found = false;
        for (const point of points) {
          if (point.type === 1 && point.addressName === placeName) {
            updatePointStyle(mapInstance, cardId, point.id, {
              fill: color,
              isCategoricalOrNumerical: name,
            });
            found = true;
            return point.id;
          }
        }
        if (!found) {
          return await addPointByAddress(
            mapInstance,
            cardId,
            [placeName],
            1,
            null,
            null,
            { color },
            null,
            name
          );
        }
      } else if (changeType === 'other icon') {
        const points = PointStore.getAllByType(cardId, 2);
        let found = false;
        for (const point of points) {
          if (point.type === 2 && point.addressName === placeName) {
            updatePointStyle(mapInstance, cardId, point.id, {
              fill: color,
              isCategoricalOrNumerical: name,
            });
            found = true;
            return point.id;
          }
        }
        if (!found) {
          return await addPointByAddress(
            mapInstance,
            cardId,
            [placeName],
            2,
            null,
            null,
            { color },
            null,
            name
          );
        }
      } else if (changeType === 'dot') {
        const points = PointStore.getAllByType(cardId, 0);
        let found = false;
        for (const point of points) {
          if (point.type === 0 && point.addressName === placeName) {
            updatePointStyle(mapInstance, cardId, point.id, {
              fill: color,
              radius: 6,
              isCategoricalOrNumerical: name,
            });
            found = true;
            return point.id;
          }
        }
        if (!found) {
          return await addPointByAddress(
            mapInstance,
            cardId,
            [placeName],
            0,
            null,
            null,
            { color },
            null,
            name
          );
        }
      }
    }
    const id1 = [];
    const id2 = [];

    const tasks1 =
      color1 && placeName1.length
        ? placeName1.map((placeName) => updateCategoricalData(placeName, color1, '1'))
        : [];
    const tasks2 =
      color2 && placeName2.length
        ? placeName2.map((placeName) => updateCategoricalData(placeName, color2, '2'))
        : [];

    const [results1, results2] = await Promise.all([Promise.all(tasks1), Promise.all(tasks2)]);

    id1.push(...results1.filter((x) => x !== null && x !== undefined).flat());
    id2.push(...results2.filter((x) => x !== null && x !== undefined).flat());

    EventBus.emit(`update-objects-by-type-${cardId}`, changeType);
    EventBus.emit(`highlight-text-${cardId}`);
    EventBus.emit('loading-done');

    CategoricalStore.add(cardId, {
      type: changeType,
      cardId: cardId,
      id1s: id1,
      id2s: id2,
      color1: color1,
      color2: color2,
    });
  } else if (purposeType === 'numerical') {
    let color1 = purpose.color1;
    let color2 = purpose.color2;
    if (!color1 || !color2) {
      color1 = '#0000ff';
      color2 = '#ff0000';
    }
    let normalizedComparisonCol = [];
    const addressCol = purposeData.addressCol;
    const attrCol1 = purposeData.attrCol1;
    const attrCol2 = purposeData.attrCol2;
    if (purpose.attribute1 !== purpose.attribute2) {
      const comparisonCol = attrCol2.map((value, index) => {
        return attrCol1[index] - value;
      });
      const max = Math.max(...comparisonCol);
      const min = Math.min(...comparisonCol);
      const range = max - min;
      if (range === 0) {
        normalizedComparisonCol = comparisonCol.map(() => 0.5);
      } else {
        normalizedComparisonCol = comparisonCol.map((value) => {
          return (value - min) / range;
        });
      }
    } else {
      const max = Math.max(...attrCol1);
      const min = Math.min(...attrCol1);
      const range = max - min;
      if (range === 0) {
        normalizedComparisonCol = attrCol1.map(() => 0.5);
      } else {
        normalizedComparisonCol = attrCol1.map((value) => {
          return (value - min) / range;
        });
      }
    }

    addressCol.sort((a, b) => {
      const indexA = addressCol.indexOf(a);
      const indexB = addressCol.indexOf(b);
      return normalizedComparisonCol[indexA] - normalizedComparisonCol[indexB];
    });
    normalizedComparisonCol.sort((a, b) => a - b);

    const colorList = generateColorGradient2(color1, color2, normalizedComparisonCol);
    const add3DRegionByAddressSafe = createRateLimitedExecutor(add3DRegionByAddress, 1005);

    async function updateNumericalData(placeName, color, normalizedValue) {
      if (changeType === 'marker') {
        const points = PointStore.getAllByType(cardId, 1);
        let found = false;
        for (const point of points) {
          if (point.type === 1 && point.addressName === placeName) {
            updatePointStyle(mapInstance, cardId, point.id, {
              fill: color,
              isCategoricalOrNumerical: 'Numerical',
            });
            return point.id;
          }
        }
        if (!found) {
          return await addPointByAddress(
            mapInstance,
            cardId,
            [placeName],
            1,
            null,
            null,
            { color },
            null,
            'Numerical'
          );
        }
      } else if (changeType === 'dot') {
        const points = PointStore.getAllByType(cardId, 0);
        let found = false;
        for (const point of points) {
          if (point.type === 0 && point.addressName === placeName) {
            updatePointStyle(mapInstance, cardId, point.id, {
              fill: color,
              radius: 6,
              isCategoricalOrNumerical: 'Numerical',
            });
            found = true;
            return point.id;
          }
        }
        if (!found) {
          return await addPointByAddress(
            mapInstance,
            cardId,
            [placeName],
            0,
            null,
            null,
            { color },
            null,
            'Numerical'
          );
        }
      } else if (changeType === 'other icon') {
        const points = PointStore.getAllByType(cardId, 2);
        let found = false;
        for (const point of points) {
          if (point.type === 2 && point.addressName === placeName) {
            updatePointStyle(mapInstance, cardId, point.id, {
              fill: color,
              isCategoricalOrNumerical: 'Numerical',
            });
            found = true;
            return point.id;
          }
        }
        if (!found) {
          return await addPointByAddress(
            mapInstance,
            cardId,
            [placeName],
            2,
            null,
            null,
            { color },
            null,
            'Numerical'
          );
        }
      } else if (changeType === 'irregular area') {
        const regions = AreaStore.getAllByType(cardId, 0);
        let found = false;
        for (const region of regions) {
          if (region.type === 0 && region.addressName === placeName) {
            const height = get3DRegionHeight(cardId, normalizedValue);
            updateAreaStyle(mapInstance, cardId, region.id, {
              fillColor: color,
              isCategoricalOrNumerical: 'Numerical',
              height: height,
              borderColor: 'white',
              borderWidth: 1,
              fillOpacity: 0.5,
            });
            return region.id;
          }
        }
        if (!found) {
          return await add3DRegionByAddressSafe(
            mapInstance,
            cardId,
            placeName,
            normalizedValue,
            { color },
            null,
            'Numerical'
          );
          // await addRegionByAddress(mapInstance, cardId, placeName, {color}, null, 'Numerical');
        }
      }
    }
    const promises = [];
    // if (color1 && placeName1) {
    //     promises.push(updateNumericalData(placeName1, color1));
    // }
    // if (color2 && placeName2) {
    //     promises.push(updateNumericalData(placeName2, color2));
    // }
    if (addressCol.length > 0) {
      const tasks = addressCol.forEach((address, index) => {
        promises.push(
          updateNumericalData(address, colorList[index], normalizedComparisonCol[index])
        );
      });
    }
    const scope = getMapScope(cardId);
    const scopeBbox = scope?.bbox;
    if (scopeBbox) {
      const bounds = new mapboxgl.LngLatBounds(
        [scopeBbox[0], scopeBbox[1]],
        [scopeBbox[2], scopeBbox[3]]
      );
      mapInstance.fitBounds(bounds, {
        padding: 20,
      });
    }
    // const results = await Promise.all(promises).then(() => {
    //     EventBus.emit(`update-objects-by-type-${cardId}`, changeType);
    //     EventBus.emit(`highlight-text-${cardId}`);
    //     EventBus.emit("loading-done");
    // });

    const results = await Promise.all(promises);
    EventBus.emit(`update-objects-by-type-${cardId}`, changeType);
    EventBus.emit(`highlight-text-${cardId}`);
    EventBus.emit('loading-done');

    const created = results.filter((x) => x !== null).flat();
    NumericalStore.add(cardId, {
      type: changeType,
      cardId: cardId,
      minColor: color1,
      maxColor: color2,
      normalizedValues: normalizedComparisonCol,
      numericalIds: created,
      colorArray: colorList,
    });
  }
};

export const clearAllSelectedLocationPoints = (mapInstance, cardId) => {
  if (!mapInstance) return;
  const points = PointStore.getAll(cardId);
  points.forEach((point) => {
    if (point.isWaypoint && point.isWaypoint === 'selected-location') {
      removePointByLayerId(mapInstance, cardId, point.id);
    }
  });
};

export const clearAllIllustrationDrawingPoints = (mapInstance, cardId) => {
  if (!mapInstance) return;
  const points = PointStore.getAll(cardId);
  points.forEach((point) => {
    if (point.isWaypoint && point.isWaypoint === 'drawing-point') {
      removePointByLayerId(mapInstance, cardId, point.id);
    }
  });
};

const tagMap = {
  0: 'dot',
  1: 'marker',
  2: 'other icon',
  3: 'trajectory',
  4: 'line',
  5: 'direction',
  6: 'irregular',
  7: 'regular',
};

export const updateChangedSubType = async (mapInstance, cardId, changeData, content) => {
  if (!mapInstance) return;
  const oldType = Number(changeData.oldPromptType);
  const newType = Number(changeData.newPromptType);
  let prompt_json = {};
  // todo: change objects type
  if (oldType < 3) {
    const points = PointStore.getAllByType(cardId, oldType);
    points.forEach((point) => {
      removePointByLayerId(mapInstance, cardId, point.id, false);
      point.type = newType;
      point.iconSize = point.iconSize ?? 0.18;
      point.radius = 6;
      PointStore.upsert(cardId, point);
    });
    reloadPointsFromStoreByType(mapInstance, cardId, newType);
    const pointJson = PointStore.rebuildText2JsonByType(cardId, newType);
    const jsonData = await getAndParseExplanatoryText(content, pointJson, null);

    // ---- hard code for video  ----
    // prompt_json = jsonData[tagMap[newType]] || {};
    prompt_json = 'Use blue dots to indicate Senso-ji Temple, and the statue of Hachiko';
  } else if (oldType < 6) {
    // line
    const newLineData = await modify_tag_LINE(content, tagMap[oldType], tagMap[newType]);
    const updated_json = newLineData.updated_json;
    const explanatory_text = newLineData.explanatory_text;
    removeElementByType(mapInstance, cardId, oldType);
    await processJsonData(mapInstance, content, cardId, null, true, updated_json);
    const jsonData = await getAndParseExplanatoryText(null, null, explanatory_text);
    prompt_json = jsonData[tagMap[newType]] || {};
  } else if (oldType < 8) {
    const newAreaData = await modify_tag_AREA(content, tagMap[oldType], tagMap[newType]);
    const updated_json = newAreaData.updated_json;
    const explanatory_text = newAreaData.explanatory_text;
    removeElementByType(mapInstance, cardId, oldType);
    await processJsonData(mapInstance, content, cardId, null, true, updated_json);
    const jsonData = await getAndParseExplanatoryText(null, null, explanatory_text);
    prompt_json =
      newType === 6 ? jsonData['irregular area'] || {} : jsonData['regular shape'] || {};
  }
  EventBus.emit(`update-objects-by-type-${cardId}`, 'area');
  EventBus.emit(`highlight-text-${cardId}`);
  EventBus.emit(`update-explain-prompt-by-type-${cardId}`, {
    prompt_type: newType,
    explanatory_text: prompt_json,
  });
};

export const updateChangedMajorType = async (mapInstance, cardId, changeData, content) => {
  if (!mapInstance) return;
  const new_tag_major_category = changeData.new_tag_major_category;
  const old_tag = Number(changeData.old_tag);
  let new_tag_sub_category = changeData.new_tag_sub_category;
  if (new_tag_sub_category === 'Marker') {
    new_tag_sub_category = 'marker';
  } else if (new_tag_sub_category === 'Other Icon') {
    new_tag_sub_category = 'other icon';
  } else if (new_tag_sub_category === 'Dot') {
    new_tag_sub_category = 'dot';
  } else if (new_tag_sub_category === 'Irregular') {
    new_tag_sub_category = 'irregular area';
  } else if (new_tag_sub_category === 'Regular') {
    new_tag_sub_category = 'regular shape';
  } else if (new_tag_sub_category === 'Line') {
    new_tag_sub_category = 'line';
  } else if (new_tag_sub_category === 'Trajectory') {
    new_tag_sub_category = 'trajectory';
  } else if (new_tag_sub_category === 'Direction') {
    new_tag_sub_category = 'direction';
  }
  const result = await modify_major_tag(content, new_tag_major_category, new_tag_sub_category);
  const updated_json = {
    [new_tag_sub_category]: result,
  };
  removeElementByType(mapInstance, cardId, old_tag);
  await processJsonData(mapInstance, content, cardId, null, true, updated_json);
  EventBus.emit(`update-objects-by-type-${cardId}`, new_tag_major_category.toLowerCase());
  EventBus.emit(`highlight-text-${cardId}`);
};

export const getDescriptiveColorName = (hex) => {
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
    // Not a hex color we recognise; return the input unchanged.
    return hex;
  }

  // 1. Normalise the hex string to 6 chars and split out R/G/B bytes.
  let c = hex.substring(1).split('');
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  c = '0x' + c.join('');
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;

  // 2. Convert RGB (0-255) into HSL (h: 0-360, s/l: 0-1).
  const rNorm = r / 255,
    gNorm = g / 255,
    bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm),
    min = Math.min(rNorm, gNorm, bNorm);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    // Achromatic (grey).
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h *= 60;
  }

  // Round to friendlier units for the comparisons below.
  const hue = Math.round(h);
  const sat = Math.round(s * 100);
  const lig = Math.round(l * 100);

  // 3. Map HSL to a human-readable name.

  // 3a. Achromatic / near-monochrome shades.
  if (sat < 10) {
    if (lig > 95) return 'White';
    if (lig < 5) return 'Black';
    if (lig > 60) return 'Light Gray';
    if (lig < 40) return 'Dark Gray';
    return 'Gray';
  }
  if (lig < 5) return 'Black';
  if (lig > 97) return 'White';

  // 3b. Pick the base hue.
  let baseColor = 'Red';
  if (hue >= 15 && hue < 45) baseColor = 'Orange';
  else if (hue >= 45 && hue < 70) baseColor = 'Yellow';
  else if (hue >= 70 && hue < 150) baseColor = 'Green';
  else if (hue >= 150 && hue < 190) baseColor = 'Cyan';
  else if (hue >= 190 && hue < 255) baseColor = 'Blue';
  else if (hue >= 255 && hue < 285) baseColor = 'Purple';
  else if (hue >= 285 && hue < 330) baseColor = 'Pink';
  else if (hue >= 330 || hue < 15) baseColor = 'Red';

  // 3c. Special case: dark orange/yellow reads as brown.
  if ((baseColor === 'Orange' || baseColor === 'Yellow') && lig < 50) {
    baseColor = 'Brown';
  }

  // 3d. Append a modifier based on lightness or saturation.
  let modifier = '';

  if (lig < 25) modifier = 'Very Dark ';
  else if (lig < 45) modifier = 'Dark ';
  else if (lig > 85) modifier = 'Very Light ';
  else if (lig > 65) modifier = 'Light ';

  if (modifier === '') {
    if (sat < 30) modifier = 'Grayish ';
    else if (sat < 60) modifier = 'Muted ';
    else if (sat > 90) modifier = 'Vivid ';
  }

  return modifier + baseColor;
};

export const removeCategoricalOrNumericalObjects = (mapInstance, cardId, type, targetPurpose) => {
  if (!mapInstance) return;
  if (type < 3) {
    const points = PointStore.getAllByType(cardId, type);
    points.forEach((point) => {
      if (point.isCategoricalOrNumerical.includes(targetPurpose)) {
        removePointByLayerId(mapInstance, cardId, point.id, true);
      }
    });
  } else if (type < 6) {
    const obj_type = type - 3;
    const lines = LineStore.getAllByType(cardId, obj_type);
    lines.forEach((line) => {
      if (line.isCategoricalOrNumerical.includes(targetPurpose)) {
        removeLineByLayerId(mapInstance, cardId, line.id, true);
      }
    });
  } else {
    const obj_type = type - 6;
    const areas = AreaStore.getAllByType(cardId, obj_type);
    areas.forEach((area) => {
      if (area.isCategoricalOrNumerical.includes(targetPurpose)) {
        removeAreaByLayerId(mapInstance, cardId, area.id, true);
      }
    });
  }
};

export const changeToMaskHighlight = (mapInstance, cardId, areaId) => {
  if (!mapInstance) return;

  // 1. Look up the area and validate its GeoJSON before touching the map.
  const area = AreaStore.getById(cardId, areaId);
  if (!area) {
    console.error(`Area not found: ${areaId}`);
    return;
  }

  const candidates = area.candidateAddress || [];
  const index = area.candidateIndex || 0;
  const currentGeojson = candidates[index]?.geojson || candidates[index]?.geometry;

  if (!currentGeojson) {
    console.warn(`Area ${areaId} has invalid or missing GeoJSON`, area);
    return;
  }

  // Hide the area's own fill/outline so the mask reads as the highlight.
  if (mapInstance.getLayer(area.id)) {
    mapInstance.setPaintProperty(area.id, 'fill-opacity', 0);
  }
  const outlineLayerId = `${area.id}-outline`;
  if (mapInstance.getLayer(outlineLayerId)) {
    mapInstance.setPaintProperty(outlineLayerId, 'line-opacity', 0);
  }

  const MASK_SOURCE = 'mask-source';
  const MASK_LAYER = 'mask-layer';
  const OUTLINE_SOURCE = 'mask-outline-source';
  const OUTLINE_LAYER = 'mask-outline-layer';

  // 2. Track the highlighted features on the map instance itself so future
  //    calls can update the same mask without duplicating sources/layers.
  if (!mapInstance._highlightFeatures) {
    mapInstance._highlightFeatures = {
      type: 'FeatureCollection',
      features: [],
    };
  }

  const isExisted = mapInstance._highlightFeatures.features.some(
    (f) => f.properties?.id === area.id
  );
  if (!isExisted) {
    const feature = {
      type: 'Feature',
      geometry: currentGeojson,
      properties: { id: area.id },
    };
    mapInstance._highlightFeatures.features.push(feature);
  }

  // 3. Build the dim mask. turf.mask punches the highlighted features as
  //    holes through a world-sized polygon.
  const maskedData = turf.mask(mapInstance._highlightFeatures);

  let maskSource = mapInstance.getSource(MASK_SOURCE);
  if (!maskSource) {
    mapInstance.addSource(MASK_SOURCE, { type: 'geojson', data: maskedData });
    mapInstance.addLayer({
      id: MASK_LAYER,
      type: 'fill',
      source: MASK_SOURCE,
      paint: {
        'fill-color': '#000000',
        'fill-opacity': 0.3,
        'fill-antialias': true,
      },
    });
  } else {
    maskSource.setData(maskedData);
  }

  // 4. Draw a dashed white outline on top of each highlighted feature.
  let outlineSource = mapInstance.getSource(OUTLINE_SOURCE);
  if (!outlineSource) {
    mapInstance.addSource(OUTLINE_SOURCE, {
      type: 'geojson',
      data: mapInstance._highlightFeatures,
    });
    mapInstance.addLayer({
      id: OUTLINE_LAYER,
      type: 'line',
      source: OUTLINE_SOURCE,
      paint: {
        'line-color': '#ffffff',
        'line-width': 3,
        'line-dasharray': [2, 2],
      },
    });
  } else {
    outlineSource.setData(mapInstance._highlightFeatures);
  }

  area.isMaskHighlight = true;
  AreaStore.upsert(cardId, area);
};

export const removeMaskHighlight = (mapInstance, cardId, areaId) => {
  if (!mapInstance || !mapInstance._highlightFeatures) return;

  const area = AreaStore.getById(cardId, areaId);
  if (!area) return;

  // Restore the original area's visibility (we hid it in changeToMaskHighlight).
  if (mapInstance.getLayer(area.id)) {
    mapInstance.setPaintProperty(area.id, 'fill-opacity', area.fillOpacity || 0.6);
  }
  const outlineLayerId = `${area.id}-outline`;
  if (mapInstance.getLayer(outlineLayerId)) {
    mapInstance.setPaintProperty(outlineLayerId, 'line-opacity', 1);
  }

  // Drop this feature from the in-memory highlight set.
  mapInstance._highlightFeatures.features = mapInstance._highlightFeatures.features.filter(
    (f) => f.properties?.id !== areaId
  );
  const MASK_SOURCE = 'mask-source';
  const MASK_LAYER = 'mask-layer';
  const OUTLINE_SOURCE = 'mask-outline-source';
  const OUTLINE_LAYER = 'mask-outline-layer';

  const hasRemaining = mapInstance._highlightFeatures.features.length > 0;

  if (hasRemaining) {
    // Case A: more highlights remain - recompute the mask in place.
    const maskedData = turf.mask(mapInstance._highlightFeatures);

    const maskSource = mapInstance.getSource(MASK_SOURCE);
    if (maskSource) maskSource.setData(maskedData);

    const outlineSource = mapInstance.getSource(OUTLINE_SOURCE);
    if (outlineSource) outlineSource.setData(mapInstance._highlightFeatures);
  } else {
    // Case B: no highlights left - tear down all mask layers/sources.
    if (mapInstance.getLayer(MASK_LAYER)) mapInstance.removeLayer(MASK_LAYER);
    if (mapInstance.getSource(MASK_SOURCE)) mapInstance.removeSource(MASK_SOURCE);

    if (mapInstance.getLayer(OUTLINE_LAYER)) mapInstance.removeLayer(OUTLINE_LAYER);
    if (mapInstance.getSource(OUTLINE_SOURCE)) mapInstance.removeSource(OUTLINE_SOURCE);

    mapInstance._highlightFeatures = null;
  }

  area.isMaskHighlight = false;
  AreaStore.upsert(cardId, area);
};

export const updateCategoricalPointStyle = (
  mapInstance,
  cardId,
  categoricalId,
  pointIds,
  newStyle
) => {
  if (!mapInstance) return;
  pointIds.forEach((pointId) => {
    const point = PointStore.getById(cardId, pointId);
    if (point && point.isCategoricalOrNumerical === categoricalId) {
      updatePointStyle(mapInstance, cardId, pointId, newStyle);
    }
  });
};

export const updateCategoricalAreaStyle = (
  mapInstance,
  cardId,
  categoricalId,
  areaIds,
  newStyle
) => {
  if (!mapInstance) return;
  areaIds.forEach((areaId) => {
    const area = AreaStore.getById(cardId, areaId);
    if (area && area.isCategoricalOrNumerical === categoricalId) {
      updateAreaStyle(mapInstance, cardId, areaId, newStyle);
    }
  });
};

export const updateNumericalPointStyle = (mapInstance, cardId, type, pointIds, newStyle) => {
  if (!mapInstance) return;
  const typeName = tagMap[Number(type)] || type;
  const numericalData = NumericalStore.getByType(cardId, typeName);
  if (!numericalData) return;
  const newMinColor = newStyle.minColor;
  const newMaxColor = newStyle.maxColor;
  if (newMinColor !== numericalData.minColor || newMaxColor !== numericalData.maxColor) {
    const normalizedValues = numericalData.normalizedValues;
    const updatedColors = generateColorGradient2(newMinColor, newMaxColor, normalizedValues);
    numericalData.colorArray = updatedColors;
    numericalData.minColor = newMinColor;
    numericalData.maxColor = newMaxColor;
    NumericalStore.upsert(cardId, numericalData);
  }

  pointIds.forEach((pointId) => {
    const point = PointStore.getById(cardId, pointId);
    if (point && numericalData.numericalIds.includes(pointId)) {
      const index = numericalData.numericalIds.indexOf(pointId);
      const updatedColor = numericalData.colorArray[index];
      const style = {
        fill: updatedColor,
        radius: newStyle.radius,
        iconSize: newStyle.iconSize,
      };
      updatePointStyle(mapInstance, cardId, pointId, style);
    }
  });
};

export const updateNumericalAreaStyle = (mapInstance, cardId, type, areaIds, newStyle) => {
  if (!mapInstance) return;
  const typeName =
    Number(type) === 6 || type === 'irregular area' || type === 'Irregular Area'
      ? 'irregular area'
      : 'regular shape';
  const numericalData = NumericalStore.getByType(cardId, typeName);
  if (!numericalData) return;
  const newMinColor = newStyle.minColor;
  const newMaxColor = newStyle.maxColor;
  if (newMinColor !== numericalData.minColor || newMaxColor !== numericalData.maxColor) {
    const normalizedValues = numericalData.normalizedValues;
    const updatedColors = generateColorGradient2(newMinColor, newMaxColor, normalizedValues);
    numericalData.colorArray = updatedColors;
    numericalData.minColor = newMinColor;
    numericalData.maxColor = newMaxColor;
    NumericalStore.upsert(cardId, numericalData);
  }
  areaIds.forEach((areaId) => {
    const area = AreaStore.getById(cardId, areaId);
    if (area && numericalData.numericalIds.includes(areaId)) {
      const index = numericalData.numericalIds.indexOf(areaId);
      const updatedColor = numericalData.colorArray[index];
      const style = {
        fillColor: updatedColor,
        ...newStyle,
      };
      updateAreaStyle(mapInstance, cardId, areaId, style);
    }
  });
};

export const getMinMaxColorByNumericalData = (cardId, modifiedType, id, newColor) => {
  const numericalStore = NumericalStore.getByType(cardId, modifiedType);
  const numericalIds = numericalStore ? numericalStore.numericalIds : [];
  const normalizedValues = numericalStore ? numericalStore.normalizedValues : [];
  const idx = numericalIds.indexOf(id);
  if (idx === -1) return;
  let minColor = numericalStore.minColor;
  let maxColor = numericalStore.maxColor;
  if (idx === 0) {
    minColor = newColor;
  } else if (idx === numericalIds.length - 1) {
    maxColor = newColor;
  } else {
    // The user changed an intermediate stop on a numerical gradient. We
    // need to back out new endpoint colors so the gradient still passes
    // through `newColor` at the original ratio. Done channel-by-channel.
    function recalculateSmartGradient(newColor, idx, values, currentMinColor, currentMaxColor) {
      const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));

      const hexToRgb = (hex) => ({
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
      });

      const rgbToHex = (r, g, b) =>
        `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;

      // Compute the modified stop's relative position along the axis.
      const totalDist = values[values.length - 1] - values[0];

      if (totalDist === 0) return { minColor: newColor, maxColor: newColor };

      let ratio = (values[idx] - values[0]) / totalDist;

      if (ratio <= 0.0001) return { minColor: newColor, maxColor: currentMaxColor };
      if (ratio >= 0.9999) return { minColor: currentMinColor, maxColor: newColor };

      // Single-channel solver. Returns { min, max } such that
      //   val = min*(1-ratio) + max*ratio
      // and clamps to [0, 255], shifting the partner endpoint when
      // the requested value would push us out of range.
      const solveChannel = (val, min, max) => {
        let resultMin = min;
        let resultMax = max;

        if (ratio >= 0.5) {
          // Strategy A: stop is in the upper half - prefer to keep
          // Min fixed and recompute Max from
          //   Max = (Val - Min) / ratio + Min
          let calculatedMax = (val - min) / ratio + min;

          if (calculatedMax > 255) {
            // Overflow: clamp Max at 255 and back-solve Min from
            //   Val = Min*(1-r) + Max*r  =>  Min = (Val - Max*r) / (1-r)
            resultMax = 255;
            resultMin = (val - 255 * ratio) / (1 - ratio);
          } else if (calculatedMax < 0) {
            // Underflow: clamp Max at 0 and back-solve Min.
            resultMax = 0;
            resultMin = (val - 0 * ratio) / (1 - ratio);
          } else {
            resultMax = calculatedMax;
            resultMin = min;
          }
        } else {
          // Strategy B: stop is in the lower half - prefer to keep
          // Max fixed and recompute Min from
          //   Min = (Val - Max * ratio) / (1 - ratio)
          let calculatedMin = (val - max * ratio) / (1 - ratio);

          if (calculatedMin > 255) {
            // Overflow: clamp Min at 255 and back-solve Max.
            resultMin = 255;
            resultMax = (val - 255) / ratio + 255;
          } else if (calculatedMin < 0) {
            // Underflow: clamp Min at 0 and back-solve Max.
            resultMin = 0;
            resultMax = (val - 0) / ratio + 0;
          } else {
            resultMin = calculatedMin;
            resultMax = max;
          }
        }

        return { min: resultMin, max: resultMax };
      };

      const oldMin = hexToRgb(currentMinColor);
      const oldMax = hexToRgb(currentMaxColor);
      const target = hexToRgb(newColor);

      const rRes = solveChannel(target.r, oldMin.r, oldMax.r);
      const gRes = solveChannel(target.g, oldMin.g, oldMax.g);
      const bRes = solveChannel(target.b, oldMin.b, oldMax.b);

      // rgbToHex clamps each channel as a final guard against any
      // residual overflow from extreme slopes.
      return {
        minColor: rgbToHex(rRes.min, gRes.min, bRes.min),
        maxColor: rgbToHex(rRes.max, gRes.max, bRes.max),
      };
    }

    const res = recalculateSmartGradient(newColor, idx, normalizedValues, minColor, maxColor);
    minColor = res.minColor;
    maxColor = res.maxColor;
  }
  return { minColor, maxColor, numericalIds };
};

// gallery
const createBar = async (mapInstance, location, value, maxHeight, meanData) => {
  const sourceID = `bar-source-${location.lng}-${location.lat}-${Date.now()}`;
  const layerID = `bar-layer-${location.lng}-${location.lat}-${Date.now()}`;
  const barHeight = value * maxHeight;
  const options = { steps: 32, units: 'meters' };
  const circleFeature = turf.circle([location.lng, location.lat], 50, options);
  const sourceData = {
    type: 'FeatureCollection',
    features: [circleFeature],
  };

  const layerData = {
    id: layerID,
    type: 'fill-extrusion',
    source: sourceID,
    metadata: { isCustom: true },
    paint: {
      'fill-extrusion-color': value > meanData ? '#ffffff' : '#ff5733',
      'fill-extrusion-height': barHeight,
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.8,
    },
  };

  mapInstance.addSource(sourceID, {
    type: 'FeatureCollection',
    data: sourceData,
  });
  mapInstance.addLayer(layerData);
};

const createBarByGeoJSON = async (mapInstance, geojson, value, maxHeight, meanData) => {
  const sourceID = `bar-source-${Date.now()}`;
  const layerID = `bar-layer-${Date.now()}`;
  const barHeight = value * maxHeight;
  const sourceData = geojson;

  const layerData = {
    id: layerID,
    type: 'fill-extrusion',
    source: sourceID,
    metadata: { isCustom: true },
    paint: {
      'fill-extrusion-color': value > meanData ? '#ffffff' : '#ff5733',
      'fill-extrusion-height': barHeight,
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.8,
    },
  };

  mapInstance.addSource(sourceID, {
    type: 'geojson',
    data: sourceData,
  });
  mapInstance.addLayer(layerData);
};

export const generateBarMap = async (mapInstance, cardId, jsonData) => {
  if (!mapInstance) return;
  mapInstance.flyTo({
    center: [-74.04387761639944, 40.69018767587384],
    zoom: 8,
    pitch: 60,
    bearing: -10,
    duration: 500,
  });
  const features = jsonData.features;
  const values = features.map((item) => item.properties.shape_leng);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;
  const normalizedValues = values.map((v) => (v - minValue) / valueRange);
  const maxHeight = get3DRegionHeight(cardId, normalizedValues) * 2;
  const meanData = normalizedValues.reduce((a, b) => a + b, 0) / normalizedValues.length;
  features.forEach((dataItem, i) => {
    createBarByGeoJSON(mapInstance, dataItem, normalizedValues[i], maxHeight, meanData);
  });
};

export const generateLinesMap = async (mapInstance, cardId, data) => {
  if (!mapInstance) return;
  const nodes = data.nodes;
  const links = data.links;
  nodes.forEach((node) => {
    const point = {
      lng: node.coordinates[0],
      lat: node.coordinates[1],
      size: node.radius_size,
      opacity: 0.5,
      color: node.color,
    };
    addPointByCoordinates(mapInstance, [point], 3);
  });
  links.forEach((link) => {
    const source = nodes.find((node) => node.id === link.source);
    const target = nodes.find((node) => node.id === link.target);
    if (source && target) {
      const waypoints = [
        { lng: source.coordinates[0], lat: source.coordinates[1] },
        { lng: target.coordinates[0], lat: target.coordinates[1] },
      ];
      addLineByCoordinates(
        mapInstance,
        waypoints,
        { color: link.line_color, strokeWidth: link.value, lineStyle: link.line_style },
        3
      );
    }
  });
};
