/**
 * Static configuration shared by the illustration panel and the map renderer.
 *
 * The numeric `type` values, `TYPE_TAGS`, and `SUB_TYPE_TAGS` strings are used
 * by both the illustration panel and `text2json` rendering. Keep them aligned
 * with `docs/backend-contract.md` and the rest of the codebase.
 */

/** Numeric prompt type -> backend category label used in `text2json`. */
export const CHANGE_TYPE_MAP = {
  0: 'dot',
  1: 'marker',
  2: 'other icon',
  3: 'trajectory',
  4: 'line',
  5: 'direction',
  6: 'irregular area',
  7: 'regular shape',
};

export const TYPE_TAGS = ['Point', 'Line', 'Area'];

export const SUB_TYPE_TAGS = {
  Point: ['Dot', 'Marker', 'Other Icon'],
  Line: ['Line', 'Direction', 'Trajectory'],
  Area: ['Irregular', 'Regular'],
};

export const PURPOSE_TAGS = ['Categorical', 'Numerical', 'None'];

export const PROMPT_TYPE_OPTIONS = [
  { type: 0, label: 'Point - Dot' },
  { type: 1, label: 'Point - Marker' },
  { type: 2, label: 'Point - Other Icon' },
  { type: 3, label: 'Line - Trajectory' },
  { type: 4, label: 'Line - Line' },
  { type: 5, label: 'Line - Direction' },
  { type: 6, label: 'Area - Irregular' },
  { type: 7, label: 'Area - Regular' },
];

/**
 * Build an empty prompt item used by the illustration panel.
 *
 * @param {string} label A label of the form `"Major - Sub"` (e.g. `"Point - Dot"`).
 */
export const createPromptItem = (label) => ({
  prompt: '',
  expanded: true,
  tagList: label.split(' - '),
  objects: [],
  csvHeaders: [],
  csvDataRows: [],
  currentSampleRowIndex: -1,
  attributesList: [],
  wayPoints: [],
  selectedColumns: [],
  colorRamp: ['#0000ff', '#ff0000'],
  addressColumn: '',
});

/**
 * Parse a single CSV line, honouring double-quoted fields and escaped quotes.
 *
 * @param {string} line One textual CSV line, without the trailing newline.
 * @returns {string[]} Parsed and trimmed cell values.
 */
export const parseCsvLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};
