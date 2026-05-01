/**
 * Default values and small helpers used by the map display panel.
 */

/**
 * Build the form state used to drive the per-card style editor.
 * Keys here mirror those consumed by the map renderer.
 */
export const createDefaultStyleForm = () => ({
  pointColor: '#FF0000',
  pointRadius: 6,
  pointIconSize: 1,
  pointSubtype: 0,
  strokeColor: '#000000',
  strokeWidth: 4,
  strokeType: 0,
  areaFillColor: '#ffffff',
  areaFillOpacity: 0.5,
  areaBorderColor: '#000000',
  areaBorderWidth: 2,
  areaSubtype: 0,
  dashArray: [2, 3],
  selectedDescription: null,
  areaRadius: null,
  lineProfile: null,
  height: null,
  isMaskHighlight: false,
  strokeOpacity: 1.0,
  isWaypoint: null,
});

/** Clamp `value` to the `[min, max]` range. */
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Coerce `value` to a finite number, or fall back to `fallback` when the
 * conversion produces `NaN` / `Infinity`.
 */
export const safeNumber = (value, fallback = 1) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
