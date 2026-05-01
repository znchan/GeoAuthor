/**
 * Shared in-memory stores for map objects, scoped by `cardId`.
 *
 * The records mirror the `text2json` schema documented in
 * `docs/backend-contract.md`. The category labels and type numbers below are
 * part of the public contract; do not change them without updating the
 * backend integration docs and the frontend rendering code.
 *
 *   Point.type:  0 = dot,             1 = marker,        2 = other icon
 *   Line.type:   0 = trajectory,      1 = geo line,      2 = direction line
 *   Area.type:   0 = irregular area,  1 = regular polygon shape,
 *                2 = regular circle shape,
 *                3 = mask-style irregular area (looked up alongside type 0)
 */

/**
 * @typedef {Object} PointRecord
 * @property {string} id
 * @property {string} cardId
 * @property {?string} sourceId
 * @property {0|1|2} type
 * @property {?[number, number]} coordinates
 * @property {?string} color
 * @property {?string} iconImage
 * @property {number} iconSize
 * @property {?string} addressName
 * @property {number} radius
 * @property {?string} isWaypoint Owning line id when used as a waypoint, otherwise null.
 * @property {Array<Object>} candidateAddress
 * @property {number} candidateIndex
 * @property {?string} description
 * @property {string} colorPosition
 * @property {'Categorical'|'Numerical'|'None'} isCategoricalOrNumerical
 */

/**
 * @typedef {Object} LineRecord
 * @property {string} id
 * @property {string} cardId
 * @property {?string} sourceId
 * @property {0|1|2} type
 * @property {?Array<Object>} waypoints
 * @property {?string} geoLineName
 * @property {string} strokeColor
 * @property {number} strokeWidth
 * @property {0|1} strokeType 0 = solid, 1 = dashed.
 * @property {?string} arrowLayerId
 * @property {?string} profile Routing profile (e.g. 'driving').
 * @property {?string} description
 * @property {string} colorPosition
 * @property {Array<Object>} candidateAddress
 * @property {number} candidateIndex
 * @property {number} strokeOpacity
 */

/**
 * @typedef {Object} AreaRecord
 * @property {string} id
 * @property {string} cardId
 * @property {?string} sourceId
 * @property {0|1|2|3} type
 * @property {?Array} points
 * @property {?string} addressName
 * @property {?Array<number>} boundingbox
 * @property {?[number, number]} center
 * @property {?number} radius
 * @property {string} fillColor
 * @property {number} fillOpacity
 * @property {string} borderColor
 * @property {number} borderWidth
 * @property {Array<Object>} candidateAddress
 * @property {number} candidateIndex
 * @property {?string} description
 * @property {string} colorPosition
 * @property {number} height
 * @property {'Categorical'|'Numerical'|'None'} isCategoricalOrNumerical
 * @property {boolean} isMaskHighlight
 */

const DEFAULT_CARD_ID = 'global';

/** cardId -> Map<pointId, PointRecord> */
const pointMap = new Map();
/** cardId -> Map<lineId, LineRecord> */
const lineMap = new Map();
/** cardId -> Map<areaId, AreaRecord> */
const areaMap = new Map();

let autoIncrementPointId = 0;
let autoIncrementLineId = 0;
let autoIncrementAreaId = 0;

const getCardKey = (cardId) => cardId || DEFAULT_CARD_ID;

const ensureCardMap = (rootMap, cardId) => {
  const key = getCardKey(cardId);
  if (!rootMap.has(key)) {
    rootMap.set(key, new Map());
  }
  return rootMap.get(key);
};

const ensurePointCardMap = (cardId) => ensureCardMap(pointMap, cardId);
const ensureLineCardMap = (cardId) => ensureCardMap(lineMap, cardId);
const ensureAreaCardMap = (cardId) => ensureCardMap(areaMap, cardId);

const normalizePointRecord = (input, cardId) => {
  const id = input.id || `point-${Date.now()}-${++autoIncrementPointId}-${cardId}`;
  return {
    id,
    cardId: getCardKey(cardId),
    sourceId: input.sourceId ?? null,
    type: input.type !== undefined ? Number(input.type) : 0,
    coordinates: input.coordinates ?? null,
    color: input.color ?? null,
    iconImage: input.iconImage ?? null,
    iconSize: input.iconSize ?? 1,
    addressName: input.addressName ?? null,
    radius: input.radius ?? 6,
    isWaypoint: input.isWaypoint ?? null,
    candidateAddress: input.candidateAddress ?? [],
    candidateIndex: input.candidateIndex ?? 0,
    description: input.description ?? null,
    colorPosition: input.colorPosition ?? '',
    isCategoricalOrNumerical: input.isCategoricalOrNumerical ?? 'None',
  };
};

export const PointStore = {
  /**
   * Insert a new point and return its id.
   * @param {string} cardId
   * @param {Partial<PointRecord>} record
   * @returns {string}
   */
  add(cardId, record) {
    const normalized = normalizePointRecord(record, cardId);
    const cardMap = ensurePointCardMap(normalized.cardId);
    cardMap.set(normalized.id, normalized);
    return normalized.id;
  },

  /**
   * Update an existing point or insert it if it does not exist.
   * @param {string} cardId
   * @param {Partial<PointRecord>} record
   */
  upsert(cardId, record) {
    const key = getCardKey(cardId);
    const cardMap = ensurePointCardMap(key);
    if (record.id && cardMap.has(record.id)) {
      const current = cardMap.get(record.id);
      const updated = { ...current, ...record, cardId: key };
      cardMap.set(updated.id, updated);
      return updated;
    }
    return this.add(key, record);
  },

  /**
   * Remove a point by id.
   * @param {string} cardId
   * @param {string|number} id
   * @returns {boolean} Whether a record was removed.
   */
  removeById(cardId, id) {
    const key = getCardKey(cardId);
    const stringId = String(id);
    const cardMap = pointMap.get(key);
    if (!cardMap || !cardMap.has(stringId)) return false;
    cardMap.delete(stringId);
    return true;
  },

  /** @returns {?PointRecord} */
  getById(cardId, id) {
    const cardMap = pointMap.get(getCardKey(cardId));
    return cardMap?.get(id) || null;
  },

  /**
   * When `cardId` is provided returns an array of records for that card.
   * Otherwise returns an array of `{ cardId, points }` for every card.
   */
  getAll(cardId) {
    if (cardId) {
      return Array.from(ensurePointCardMap(cardId).values());
    }
    return Array.from(pointMap.entries()).map(([cid, map]) => ({
      cardId: cid,
      points: Array.from(map.values()),
    }));
  },

  getAllByType(cardId, type) {
    const target = Number(type);
    if (cardId) {
      return Array.from(ensurePointCardMap(cardId).values()).filter(
        (point) => Number(point.type) === target
      );
    }
    return Array.from(pointMap.entries()).map(([cid, map]) => ({
      cardId: cid,
      points: Array.from(map.values()).filter((point) => Number(point.type) === target),
    }));
  },

  removeByLayer(cardId, layerID) {
    const key = getCardKey(cardId);
    const cardMap = pointMap.get(key);
    if (!cardMap) return false;
    cardMap.forEach((record) => {
      if (record.layerId === layerID) {
        cardMap.delete(record.id);
      }
    });
    return true;
  },

  clear(cardId) {
    if (cardId) {
      const key = getCardKey(cardId);
      const cardMap = pointMap.get(key);
      if (cardMap) {
        cardMap.clear();
        pointMap.delete(key);
      }
      return;
    }
    pointMap.clear();
  },

  /**
   * Rebuild the `text2json` payload for a single point category from the
   * current store contents. Keeps the keys (`dot` / `marker` / `other icon`)
   * aligned with the backend contract.
   */
  rebuildText2JsonByType(cardId, type) {
    const target = Number(type);
    const json = {};
    const points = this.getAllByType(cardId, target);
    if (target === 0) {
      const content = points.length > 0 ? points.map((p) => p.addressName) : [];
      const visualEncoding =
        points.length > 0
          ? points.map((p) => ({
              color: p.color,
              radius: p.radius,
            }))
          : [];
      json['dot'] = { content, visualEncoding };
    } else if (target === 1) {
      const content = points.length > 0 ? points.map((p) => p.addressName) : [];
      json['marker'] = { content };
    } else if (target === 2) {
      const content = points.length > 0 ? points.map((p) => p.addressName) : [];
      json['other icon'] = { content };
    }
    return json;
  },
};

const normalizeLineRecord = (input, cardId) => {
  const id = input.id || `line-${Date.now()}-${++autoIncrementLineId}-${cardId}`;
  const resolvedProfile =
    input.profile !== undefined ? input.profile : input.type === 0 ? 'driving' : null;
  return {
    id,
    cardId: getCardKey(cardId),
    sourceId: input.sourceId ?? null,
    type: input.type !== undefined ? Number(input.type) : 0,
    waypoints: input.waypoints ?? null,
    geoLineName: input.geoLineName ?? null,
    strokeColor: input.strokeColor ?? '#000000',
    strokeWidth: input.strokeWidth ?? 4,
    strokeType: input.strokeType ?? 0,
    arrowLayerId: input.arrowLayerId ?? null,
    profile: resolvedProfile,
    description: input.description ?? null,
    colorPosition: input.colorPosition ?? '',
    candidateAddress: input.candidateAddress ?? [],
    candidateIndex: input.candidateIndex ?? 0,
    strokeOpacity: input.strokeOpacity ?? 1,
  };
};

export const LineStore = {
  /**
   * @param {string} cardId
   * @param {Partial<LineRecord>} record
   * @returns {string}
   */
  add(cardId, record) {
    const normalized = normalizeLineRecord(record, cardId);
    const cardMap = ensureLineCardMap(normalized.cardId);
    cardMap.set(normalized.id, normalized);
    return normalized.id;
  },

  upsert(cardId, record) {
    const key = getCardKey(cardId);
    const cardMap = ensureLineCardMap(key);
    if (record.id && cardMap.has(record.id)) {
      const current = cardMap.get(record.id);
      const updated = { ...current, ...record, cardId: key };
      cardMap.set(updated.id, updated);
      return updated;
    }
    return this.add(key, record);
  },

  removeById(cardId, id) {
    const stringId = String(id);
    const key = getCardKey(cardId);
    const cardMap = lineMap.get(key);
    if (!cardMap || !cardMap.has(stringId)) return false;
    cardMap.delete(stringId);
    return true;
  },

  getById(cardId, id) {
    const cardMap = lineMap.get(getCardKey(cardId));
    return cardMap?.get(id) || null;
  },

  getAll(cardId) {
    if (cardId) {
      return Array.from(ensureLineCardMap(cardId).values());
    }
    return Array.from(lineMap.entries()).map(([cid, map]) => ({
      cardId: cid,
      lines: Array.from(map.values()),
    }));
  },

  getAllByType(cardId, type) {
    const target = Number(type);
    if (cardId) {
      return Array.from(ensureLineCardMap(cardId).values()).filter(
        (line) => Number(line.type) === target
      );
    }
    return Array.from(lineMap.entries()).map(([cid, map]) => ({
      cardId: cid,
      lines: Array.from(map.values()).filter((line) => Number(line.type) === target),
    }));
  },

  clear(cardId) {
    if (cardId) {
      const key = getCardKey(cardId);
      const cardMap = lineMap.get(key);
      if (cardMap) {
        cardMap.clear();
        lineMap.delete(key);
      }
      return;
    }
    lineMap.clear();
  },
};

const normalizeAreaRecord = (input, cardId) => {
  const id = input.id || `area-${Date.now()}-${++autoIncrementAreaId}-${cardId}`;
  return {
    id,
    cardId: getCardKey(cardId),
    sourceId: input.sourceId ?? null,
    type: input.type !== undefined ? Number(input.type) : 0,
    points: input.points ?? null,
    addressName: input.addressName ?? null,
    boundingbox: input.boundingbox ?? null,
    center: input.center ?? null,
    radius: input.radius ?? null,
    fillColor: input.fillColor ?? '#FFFFFF',
    fillOpacity: input.fillOpacity ?? 0.8,
    borderColor: input.borderColor ?? '#000000',
    borderWidth: input.borderWidth ?? 2,
    candidateAddress: input.candidateAddress ?? [],
    candidateIndex: input.candidateIndex ?? 0,
    description: input.description ?? null,
    colorPosition: input.colorPosition ?? '',
    height: input.height ?? 10,
    isCategoricalOrNumerical: input.isCategoricalOrNumerical ?? 'None',
    isMaskHighlight: input.isMaskHighlight ?? false,
  };
};

export const AreaStore = {
  /**
   * @param {string} cardId
   * @param {Partial<AreaRecord>} record
   * @returns {string}
   */
  add(cardId, record) {
    const normalized = normalizeAreaRecord(record, cardId);
    const cardMap = ensureAreaCardMap(normalized.cardId);
    cardMap.set(normalized.id, normalized);
    return normalized.id;
  },

  upsert(cardId, record) {
    const key = getCardKey(cardId);
    const cardMap = areaMap.get(key);
    if (record.id && cardMap.has(record.id)) {
      const current = cardMap.get(record.id);
      const updated = { ...current, ...record, cardId: key };
      cardMap.set(updated.id, updated);
      return updated;
    }
    return this.add(key, record);
  },

  removeById(cardId, id) {
    const key = getCardKey(cardId);
    const cardMap = areaMap.get(key);
    if (!cardMap || !cardMap.has(id)) return false;
    cardMap.delete(id);
    return true;
  },

  getById(cardId, id) {
    const cardMap = areaMap.get(getCardKey(cardId));
    return cardMap?.get(id) || null;
  },

  getAll(cardId) {
    if (cardId) {
      return Array.from(ensureAreaCardMap(cardId).values());
    }
    return Array.from(areaMap.entries()).map(([cid, map]) => ({
      cardId: cid,
      areas: Array.from(map.values()),
    }));
  },

  /**
   * For a given card, type 0 returns irregular and mask-style areas
   * (types 0 and 3). Other type values return regular shapes (types 1 and 2).
   * Without `cardId` the regular per-card filter is applied to every card.
   */
  getAllByType(cardId, type) {
    const target = Number(type);
    if (cardId) {
      if (target === 0) {
        return Array.from(ensureAreaCardMap(cardId).values()).filter(
          (area) => Number(area.type) === 0 || Number(area.type) === 3
        );
      }
      return Array.from(ensureAreaCardMap(cardId).values()).filter(
        (area) => Number(area.type) === 1 || Number(area.type) === 2
      );
    }
    return Array.from(areaMap.entries()).map(([cid, map]) => ({
      cardId: cid,
      areas: Array.from(map.values()).filter((area) => Number(area.type) === target),
    }));
  },

  removeByLayer(cardId, layerID) {
    const key = getCardKey(cardId);
    const cardMap = areaMap.get(key);
    if (!cardMap) return false;
    cardMap.forEach((record) => {
      if (record.layerId === layerID) {
        cardMap.delete(record.id);
      }
    });
    return true;
  },

  clear(cardId) {
    if (cardId) {
      const key = getCardKey(cardId);
      const cardMap = areaMap.get(key);
      if (cardMap) {
        cardMap.clear();
        areaMap.delete(key);
      }
      return;
    }
    areaMap.clear();
  },
};

/** cardId -> Map<type, NumericalRecord> */
const NumericalMap = new Map();
/** cardId -> Map<type, CategoricalRecord> */
const CategoricalMap = new Map();

const normalizePointNumericalRecord = (input, cardId) => ({
  type: input.type || `numerical-${Date.now()}-${cardId}`,
  cardId,
  minColor: input.minColor || '#0000FF',
  maxColor: input.maxColor || '#FF0000',
  normalizedValues: input.normalizedValues || [],
  numericalIds: input.numericalIds || [],
  colorArray: input.colorArray || [],
});

export const NumericalStore = {
  ensureNumericalCardMap(cardId) {
    return ensureCardMap(NumericalMap, cardId);
  },

  add(cardId, record) {
    const normalized = normalizePointNumericalRecord(record, cardId);
    const cardMap = this.ensureNumericalCardMap(cardId);
    cardMap.set(normalized.type, normalized);
    return normalized.type;
  },

  getByType(cardId, type) {
    const lower = type.toLowerCase();
    const key = getCardKey(cardId);
    const cardMap = NumericalMap.get(key);
    return cardMap?.get(lower) || null;
  },

  upsert(cardId, record) {
    const key = getCardKey(cardId);
    const cardMap = this.ensureNumericalCardMap(key);
    if (record.id && cardMap.has(record.id)) {
      const current = cardMap.get(record.id);
      const updated = { ...current, ...record, cardId: key };
      cardMap.set(updated.id, updated);
      return updated;
    }
    const normalized = normalizePointNumericalRecord(record, key);
    cardMap.set(normalized.id, normalized);
    return normalized;
  },
};

const normalizeCategoricalRecord = (input, cardId) => ({
  type: input.type || `categorical-${Date.now()}-${cardId}`,
  cardId,
  id1s: input.id1s || [],
  id2s: input.id2s || [],
  color1: input.color1 || '#0000FF',
  color2: input.color2 || '#FF0000',
});

export const CategoricalStore = {
  ensureCategoricalCardMap(cardId) {
    return ensureCardMap(CategoricalMap, cardId);
  },

  add(cardId, record) {
    const normalized = normalizeCategoricalRecord(record, cardId);
    const cardMap = this.ensureCategoricalCardMap(cardId);
    cardMap.set(normalized.type, normalized);
    return normalized.type;
  },

  getByType(cardId, type) {
    const key = getCardKey(cardId);
    const cardMap = CategoricalMap.get(key);
    return cardMap?.get(type) || null;
  },

  upsert(cardId, record) {
    const key = getCardKey(cardId);
    const cardMap = this.ensureCategoricalCardMap(key);
    if (record.id && cardMap.has(record.id)) {
      const current = cardMap.get(record.id);
      const updated = { ...current, ...record, cardId: key };
      cardMap.set(updated.id, updated);
      return updated;
    }
    const normalized = normalizeCategoricalRecord(record, key);
    cardMap.set(normalized.type, normalized);
    return normalized;
  },
};
