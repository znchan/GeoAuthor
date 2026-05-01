/**
 * Backend integration helpers.
 *
 * GeoAuthor can run without a live backend by returning mock payloads from
 * each helper before the live axios branch executes. The mock data documents
 * the wire contract that the production service is expected to honor; please
 * keep it aligned with `docs/backend-contract.md`.
 *
 * When refactoring this module:
 *  - Do not rename endpoint paths, request field names, or response keys
 *    without updating `docs/backend-contract.md`.
 *  - Keep both the mock return values and the axios branches around. The mock
 *    branch ensures the frontend works in isolation; the axios branch shows
 *    contributors how the live service is consumed.
 *  - Both `snake_case` (legacy) and `camelCase` aliases are exported. New
 *    code is encouraged to use the `camelCase` names; the legacy names are
 *    kept for backward compatibility with existing imports.
 */

import axios from 'axios';

export const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';

export const BACKEND_ENDPOINTS = Object.freeze({
  getMapBackground: '/get_mapbackground',
  getMapScope: '/get_mapscope',
  textToJson: '/text2json',
  getExplanatoryText: '/get_explanatory_text',
  updateExplanatoryText: '/update_explanatory_text',
  getPurpose: '/get_purpose',
  generateTextualDescriptionsForGeoElement: '/generate_textual_descriptions_for_geo_element',
  continueWritingBasedOnAPlace: '/continue_writing_based_on_a_place',
  generateDescriptionsOfSpatialRelationships: '/generate_descriptions_of_spatial_relationships',
  continueWritingAnalyticalSummary: '/continue_writing_an_analytical_summary_of_the_data',
  modifyTagLine: '/modify_tag_LINE',
  modifyTagArea: '/modify_tag_AREA',
  modifyMajorTag: '/modify_major_tag',
  modifyTagCategoricalOrNumerical: '/modify_tag_categorical_or_numerical',
});

const backendUrl = (endpoint) => `${BACKEND_API_URL}${endpoint}`;

/* ------------------------------------------------------------------ */
/* Map background / scope                                              */
/* ------------------------------------------------------------------ */

/**
 * Return a numeric Mapbox style index suggested for the given article text.
 *
 * The live service is expected to respond with one of:
 *   `standard map`, `satellite map`, `traffic map`, `dark mode map`.
 *
 * @param {string} text Article text to analyze.
 * @returns {Promise<number>} Style index used by `MAPBOX_STYLES`.
 */
export const get_mapbackground = async (text) => {
  // eslint-disable-next-line no-unreachable -- axios branch documents the live contract.
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.getMapBackground);
    const response = await axios.post(gptUrl, { text });
    switch (response.data) {
      case 'standard map':
        return 0;
      case 'satellite map':
        return 1;
      case 'traffic map':
        return 2;
      case 'dark mode map':
        return 3;
      default:
        return 0;
    }
  } catch (error) {
    /* fall through to default */
  }
  return 0;
};

/**
 * Detect the primary geographic region described by the article text.
 *
 * Response shape:
 *   `{ primary_region: string, scope_level: keyof LEVEL_MAP, reasoning: string }`
 *
 * @param {string} text Article text.
 */
export const get_mapscope = async (text) => {
  // eslint-disable-next-line no-unreachable -- axios branch documents the live contract.
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.getMapScope);
    const response = await axios.post(gptUrl, { text });
    return response.data;
  } catch (error) {
    return {
      primary_region: 'England',
      scope_level: 'country',
      reasoning: 'Analysis covers multiple U.S. states requiring national-level view',
    };
  }
};

/* ------------------------------------------------------------------ */
/* text2json + explanatory text                                        */
/* ------------------------------------------------------------------ */

/**
 * Translate article text into a structured map-object payload keyed by the
 * stable categories listed in `docs/backend-contract.md`:
 * `marker`, `dot`, `other icon`, `trajectory`, `line`, `direction`,
 * `regular shape`, `irregular area`.
 *
 * @param {string} text Article text.
 */
export const text2json = async (text) => {
  // eslint-disable-next-line no-unreachable -- axios branch documents the live contract.
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.textToJson);
    const response = await axios.post(gptUrl, { text });
    return response.data;
  } catch (error) {
    /* fall through */
  }
  return null;
};

/**
 * Generate explanatory descriptions for the parsed map objects.
 * The response is keyed by the same map object types returned by `text2json`.
 *
 * @param {string} text
 * @param {Object} json_result
 */
export const get_explanatory_text = async (text, json_result) => {
  // eslint-disable-next-line no-unreachable -- axios branch documents the live contract.
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.getExplanatoryText);
    const response = await axios.post(gptUrl, { text, json_result });
    return response.data;
  } catch (error) {
    return null;
  }
};

/**
 * Send the rewritten article (`explanatory_text_new`) to the service so the
 * backend can keep its `text2json` payload in sync. Returns the updated JSON
 * (same shape as `text2json`).
 */
export const update_explanatory_text = async (
  text,
  explanatory_text_old,
  explanatory_text_new,
  json_result
) => {
  // eslint-disable-next-line no-unreachable -- axios branch documents the live contract.
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.updateExplanatoryText);
    const response = await axios.post(gptUrl, {
      text,
      explanatory_text_old: JSON.stringify(explanatory_text_old),
      explanatory_text_new: JSON.stringify(explanatory_text_new),
      json_result: JSON.stringify(json_result),
    });
    return response.data;
  } catch (error) {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/* Purpose / categorical & numerical encoding                          */
/* ------------------------------------------------------------------ */

/**
 * Detect whether the article (and any imported dataset) implies a
 * `categorical` or `numerical` visualization purpose. See `docs/backend-contract.md`
 * for the full response shape.
 */
export const get_purpose = async (text) => {
  // eslint-disable-next-line no-unreachable -- axios branch documents the live contract.
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.getPurpose);
    const response = await axios.post(gptUrl, { text, imported_data: null });
    return response.data;
  } catch (error) {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/* Continue-writing helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Generate alternative textual descriptions for a single geographic element
 * mentioned in the article. Returns an array of strings.
 */
export const generate_textual_descriptions_for_geo_element = async (text, geo_element) => {
  // eslint-disable-next-line no-unreachable -- axios branch documents the live contract.
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.generateTextualDescriptionsForGeoElement);
    const response = await axios.post(gptUrl, { text, geo_element });
    return response.data;
  } catch (error) {
    return null;
  }
};

/**
 * Continue writing the article based on the provided place name. Returns the
 * generated continuation as a single string.
 */
export const continue_writing_based_on_a_place = async (text, place_name) => {
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.continueWritingBasedOnAPlace);
    const response = await axios.post(gptUrl, {
        text: text,
        place_name: place_name
    });
    return response.data;
  } catch (error) {
    return null;
  }
}

/**
 * Generate a description of spatial relationships among multiple places.
 */
export const generate_descriptions_of_spatial_relationships = async (place_names) => {
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.generateDescriptionsOfSpatialRelationships);
    const response = await axios.post(gptUrl, { place_names });
    return response.data;
  } catch (error) {
    return null;
  }
};

/**
 * Generate an analytical summary of an imported tabular dataset.
 */
export const continue_writing_an_analytical_summary_of_the_data = async (text, imported_data) => {
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.continueWritingAnalyticalSummary);
    const response = await axios.post(gptUrl, {
      text,
      imported_data: JSON.stringify(imported_data),
    });
    return response.data;
  } catch (error) {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/* Tag editing                                                         */
/* ------------------------------------------------------------------ */

/**
 * Update tags for a `LINE` map object. Returns `{ updated_json, explanatory_text }`.
 */
export const modify_tag_LINE = async (text, old_tag, new_tag) => {
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.modifyTagLine);
    const response = await axios.post(gptUrl, { text, old_tag, new_tag });
    return response.data;
  } catch (error) {
    return null;
  }
};

/**
 * Update tags for an `AREA` map object. Returns `{ updated_json, explanatory_text }`.
 */
export const modify_tag_AREA = async (text, old_tag, new_tag) => {
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.modifyTagArea);
    const response = await axios.post(gptUrl, { text, old_tag, new_tag });
    return response.data;
  } catch (error) {
    return null;
  }
};

/**
 * Reclassify a map object by major/sub category.
 */
export const modify_major_tag = async (text, new_tag_major_category, new_tag_sub_category) => {
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.modifyMajorTag);
    const response = await axios.post(gptUrl, {
      text,
      new_tag_major_category,
      new_tag_sub_category,
    });
    return response.data;
  } catch (error) {
    return null;
  }
};

/**
 * Update the categorical/numerical tag for a tagged dataset.
 */
export const modify_tag_categorical_or_numerical = async (text, imported_data, new_tag) => {
  try {
    const gptUrl = backendUrl(BACKEND_ENDPOINTS.modifyTagCategoricalOrNumerical);
    const response = await axios.post(gptUrl, {
      text,
      imported_data: JSON.stringify(imported_data),
      new_tag,
    });
    return response.data;
  } catch (error) {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/* camelCase aliases                                                    */
/*                                                                       */
/* New code should prefer these names. The original snake_case exports   */
/* are kept above for backward compatibility with existing imports.      */
/* ------------------------------------------------------------------ */

export const getMapBackground = get_mapbackground;
export const getMapScope = get_mapscope;
export const textToJson = text2json;
export const getExplanatoryText = get_explanatory_text;
export const updateExplanatoryText = update_explanatory_text;
export const getPurpose = get_purpose;
export const generateTextualDescriptionsForGeoElement =
  generate_textual_descriptions_for_geo_element;
export const continueWritingBasedOnAPlace = continue_writing_based_on_a_place;
export const generateDescriptionsOfSpatialRelationships =
  generate_descriptions_of_spatial_relationships;
export const continueWritingAnalyticalSummary = continue_writing_an_analytical_summary_of_the_data;
export const modifyTagLine = modify_tag_LINE;
export const modifyTagArea = modify_tag_AREA;
export const modifyMajorTag = modify_major_tag;
export const modifyTagCategoricalOrNumerical = modify_tag_categorical_or_numerical;
