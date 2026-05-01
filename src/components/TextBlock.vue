<template>
  <div
    class="bg-gray-100 border border-gray-200 rounded-lg shadow-lg overflow-hidden"
    draggable="true"
    @dragstart="onDragStart"
  >
    <div @contextmenu.prevent="onContextMenu($event)" @dragover.prevent @drop.prevent>
      <div :id="`editor-container-${cardId}`" class="p-4"></div>
    </div>
    <!-- Color picker popup -->
    <div
      v-if="colorPopup.visible"
      class="color-overlay"
      @click="
        colorPopup.visible = false;
        closeColorEditor();
      "
    ></div>
    <div
      v-if="colorPopup.visible"
      class="color-popup flex flex-col p-2 shadow-lg rounded-md bg-white"
      :style="{ left: colorPopup.x + 'px', top: colorPopup.y + 70 + 'px' }"
    >
      <div class="color-popup-title">Please Select Color</div>
      <div class="flex flex-col gap-2">
        <div
          v-for="(color, idx) in colorPopup.colors"
          :key="idx"
          @dblclick.stop="handleDoubleClick(idx)"
          :style="{ border: '1px solid ' + (idx === colorPopup.selectedIdx ? '#ddd' : '#FFFFFF') }"
          class="flex flex-row items-center gap-2 justify-between colors-popup-row"
        >
          <span class="color-type">{{ colorPopup.types[idx] + ': ' }}</span>
          <div class="flex flex-row items-center gap-1">
            <div
              class="color-popup-item"
              :style="{ background: color, border: '2px solid ' + (idx === 0 ? '#333' : '#ccc') }"
              @click.stop="handleSingleClick(idx, $event)"
            ></div>
            <input
              type="text"
              v-model="colorPopup.colors[idx]"
              @change="onColorModified(idx, $event)"
              @mousedown.stop
              @click.stop
              class="color-text-input"
            />
          </div>
        </div>
      </div>
    </div>
    <input
      v-if="colorEditor.visible"
      type="color"
      class="color-editor"
      ref="colorEditorInput"
      v-model="colorEditor.color"
      :style="{ left: colorEditor.x + 'px', top: colorEditor.y + 'px' }"
      @input="onColorModified(colorEditor.idx, $event)"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from 'vue';
import Quill from 'quill';
import { EventBus } from '@/utils/EventBus';
import { PointStore, LineStore, AreaStore, CategoricalStore } from '../utils/Store.js';
import { getDescriptiveColorName, getMinMaxColorByNumericalData } from '../utils/MapTools.js';
const Inline = Quill.import('blots/inline');
const colorEditorInput = ref(null);

class AddressBorderBlot extends Inline {
  static blotName = 'address-border';
  static tagName = 'span';

  static create(value) {
    const node = super.create();
    if (value) {
      node.setAttribute('data-border-color', value);
      node.style.border = `2px solid ${value}`;
      node.style.padding = '0 2px';
      node.style.borderRadius = '1px';
    }
    return node;
  }

  static formats(node) {
    return node.getAttribute('data-border-color') || undefined;
  }
}

// Custom underline Blot (rendered slightly farther from the baseline).
class CustomUnderlineBlot extends Inline {
  static blotName = 'custom-underline';
  static tagName = 'span';

  static create(value) {
    const node = super.create();
    node.classList.add('custom-underline');
    return node;
  }

  static formats(node) {
    return node.classList.contains('custom-underline') ? true : undefined;
  }
}

// Register the custom Blots with Quill.
Quill.register(AddressBorderBlot);
Quill.register(CustomUnderlineBlot);

const props = defineProps({
  cardId: String,
  title: String,
  content: String,
});

const emit = defineEmits(['update:content', 'drag-start', 'split-request']);

const onDragStart = (event) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', props.cardId || '');
  }
  emit('drag-start', props.cardId);
};

const onContextMenu = (event) => {
  event.preventDefault();
  if (!quill) return;

  // Resolve the caret position underneath the mouse, falling back across browsers.
  const range = document.caretRangeFromPoint
    ? document.caretRangeFromPoint(event.clientX, event.clientY)
    : document.caretPositionFromPoint
      ? document.caretPositionFromPoint(event.clientX, event.clientY)
      : null;

  if (range) {
    if (range.startContainer) {
      // 1) Move the native caret to the clicked location first.
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      // 2) Let Quill resolve a flat index via getSelection on the next tick
      //    so that selectionchange has a chance to sync internally.
      quill.focus();
      setTimeout(() => {
        const sel = quill.getSelection();
        if (sel && typeof sel.index === 'number') {
          const text = quill.getText();
          const before = text.slice(0, sel.index).trim() || '';
          const after = text.slice(sel.index).trim() || '';
          emit('split-request', { before, after });
        }
      }, 0);
    }
  }
};

let quill = null;
// Map of place name -> assigned colors / metadata used for outlining text.
const wordColorRectMap = ref(new Map());
// The single word that should be highlighted in highlight mode.
const highlightWord = ref(null);
// Map of place name -> list of map layer IDs referencing it.
const addressToLayerIdsMap = ref(new Map());
// Whether we are currently in hover-driven highlight mode.
const isHoverHighlightMode = ref(false);
// Addresses currently being hovered on the map and that should be highlighted.
const hoverAddresses = ref([]);
let editorKeydownHandler = null;

const colorPopup = ref({
  visible: false,
  address: '',
  colors: [],
  types: [],
  lowerAddr: '',
  x: 0,
  y: 0,
  selectedIdx: 0,
});

const colorEditor = ref({
  visible: false,
  idx: null,
  color: '#ffffff',
  x: 0,
  y: 0,
});

const processTextForQuill = (text) => {
  // Convert plain newlines into a Quill-compatible delta op stream.
  if (!text) return '';
  const lines = text.split('\n');
  const ops = [];
  lines.forEach((line, idx) => {
    if (line) {
      ops.push({ insert: line });
    }
    if (idx < lines.length - 1) {
      ops.push({ insert: '\n' });
    }
  });
  return { ops };
};

const applyContentToQuill = (text) => {
  if (!quill) return;
  const ops = processTextForQuill(text).ops;
  quill.setContents({ ops });
};

onMounted(() => {
  const editorId = `editor-container-${props.cardId}`;
  // Initialize the Quill editor (no built-in toolbar).
  quill = new Quill(`#${editorId}`, {
    theme: 'snow',
    modules: {
      toolbar: false,
    },
  });

  if (props.content) {
    applyContentToQuill(props.content);
  }

  EventBus.on(`highlight-text-${props.cardId}`, updateHighlights);
  EventBus.on(`hover-map-object-${props.cardId}`, handleHoverHighlight);
  EventBus.on(`clear-all-highlights-${props.cardId}`, clearAllHighlights);
  EventBus.on(`highlight-color-position-${props.cardId}`, highlightColorPosition);
  EventBus.on(`clear-color-position-highlight-${props.cardId}`, clearColorPositionHighlight);
  // Wire up the place-name hover listener inside the editor DOM.
  setupTextHoverListener();

  // Capture Ctrl+S / Cmd+S inside the editor to reload the whole Row.
  const editorElement = quill.root;
  editorKeydownHandler = (e) => {
    const isSave = (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S');
    if (!isSave) return;
    e.preventDefault();
    // Ask App.vue to remount the Row for this cardId, which rebuilds
    // Map / Illustration / TextBlock cleanly.
    EventBus.emit('reload-row', { cardId: props.cardId });
  };
  editorElement.addEventListener('keydown', editorKeydownHandler);

  editorElement.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    const span = target.closest('span[data-border-color]');
    if (!span) return;
    const word = span.textContent.trim();
    if (!word) return;
    const lowerWord = word.toLowerCase();
    const entry = wordColorRectMap.value.get(lowerWord);
    if (!entry || !entry.colors) return;
    showColorSelectPopup(word, entry.colors, entry.types, entry.selectedIdx, lowerWord, e);
  });

  updateHighlights();

  quill.on('text-change', () => {
    const text = quill.getText();
    emit('update:content', text);
  });
});

// Show a popup that lists every color associated with a place and lets the user pick one.
const showColorSelectPopup = (address, colors, types, selectedIdx, lowerAddr, event) => {
  const span = event.target.closest('span[data-border-color]');
  if (!span) return;
  const rect = span.getBoundingClientRect();
  colorPopup.value = {
    visible: true,
    address,
    colors,
    types,
    lowerAddr,
    selectedIdx,
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY - 40,
  };
};

const selectColor = (idx) => {
  const entry = wordColorRectMap.value.get(colorPopup.value.lowerAddr);
  if (entry) {
    entry.selectedIdx = idx;
    wordColorRectMap.value.set(colorPopup.value.lowerAddr, entry);
    applyHighlights();
  }
  colorPopup.value.visible = false;
};

const clickTimer = ref(null);
const handleSingleClick = (idx, event) => {
  const target = event?.currentTarget;
  const rect = target ? target.getBoundingClientRect() : null;
  clearTimeout(clickTimer.value);
  clickTimer.value = setTimeout(() => {
    if (!rect) return;
    openColorEditor(idx, rect);
  }, 240);
};

const handleDoubleClick = (idx) => {
  if (clickTimer.value) {
    clearTimeout(clickTimer.value);
    clickTimer.value = null;
  }
  selectColor(idx);
};

const openColorEditor = (idx, rect) => {
  const color = colorPopup.value.colors[idx] || '#ffffff';
  if (!rect) return;
  colorEditor.value = {
    visible: true,
    idx,
    color,
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY + rect.height + 6,
  };
  nextTick(() => {
    if (colorEditorInput.value) {
      colorEditorInput.value.focus();
      colorEditorInput.value.click();
    }
  });
};

const closeColorEditor = () => {
  colorEditor.value.visible = false;
};

// Triggered after the user picks a color from the palette / native picker.
const onColorModified = (idx, event) => {
  if (idx === null || idx === undefined) return;
  const newColor = event.target.value;
  colorEditor.value.color = newColor;
  const entry = wordColorRectMap.value.get(colorPopup.value.lowerAddr);
  if (!entry) return;
  entry.colors[idx] = newColor;
  wordColorRectMap.value.set(colorPopup.value.lowerAddr, entry);
  colorPopup.value.colors[idx] = newColor;
  applyHighlights();
  const modifiedId = entry.ids[idx];
  const modifiedType = entry.types[idx];
  if (modifiedType === 'Dot' || modifiedType === 'Marker' || modifiedType === 'Other Icon') {
    const point = PointStore.getById(props.cardId, modifiedId);
    if (!point) return;
    const isCategoricalOrNumerical = point.isCategoricalOrNumerical;
    if (
      !isCategoricalOrNumerical.includes('Categorical') &&
      !isCategoricalOrNumerical.includes('Numerical')
    ) {
      EventBus.emit(`update-point-style-${props.cardId}`, {
        pointId: point.id,
        style: { fill: newColor },
      });
    } else if (isCategoricalOrNumerical.includes('Categorical')) {
      const categoricalStore = CategoricalStore.getByType(props.cardId, modifiedType.toLowerCase());
      const id1s = categoricalStore ? categoricalStore.id1s : [];
      const id2s = categoricalStore ? categoricalStore.id2s : [];
      const returnIds = id1s.includes(point.id) ? id1s : id2s;
      EventBus.emit(`update-categorical-point-style-${props.cardId}`, {
        categoricalId: isCategoricalOrNumerical,
        pointIds: returnIds,
        style: { fill: newColor },
      });
    } else if (isCategoricalOrNumerical.includes('Numerical')) {
      const newColors = getMinMaxColorByNumericalData(
        props.cardId,
        modifiedType,
        point.id,
        newColor
      );

      EventBus.emit(`update-numerical-point-style-${props.cardId}`, {
        type: modifiedType,
        pointIds: newColors.numericalIds,
        style: {
          minColor: newColors.minColor,
          maxColor: newColors.maxColor,
        },
      });
    }
  } else if (
    modifiedType === 'Trajectory' ||
    modifiedType === 'Geographical Line' ||
    modifiedType === 'Direction'
  ) {
    const line = LineStore.getById(props.cardId, modifiedId);
    if (line) {
      EventBus.emit(`update-line-style-${props.cardId}`, {
        lineId: line.id,
        style: { strokeColor: newColor },
      });
    }
  } else if (modifiedType === 'Irregular Area' || modifiedType === 'Regular Shape') {
    const area = AreaStore.getById(props.cardId, modifiedId);
    if (!area) return;
    const isCategoricalOrNumerical = area.isCategoricalOrNumerical;
    if (
      !isCategoricalOrNumerical.includes('Categorical') &&
      !isCategoricalOrNumerical.includes('Numerical')
    ) {
      EventBus.emit(`update-area-style-${props.cardId}`, {
        areaId: area.id,
        style: { fillColor: newColor },
      });
    } else if (isCategoricalOrNumerical.includes('Categorical')) {
      const categoricalStore = CategoricalStore.getByType(props.cardId, modifiedType.toLowerCase());
      const id1s = categoricalStore ? categoricalStore.id1s : [];
      const id2s = categoricalStore ? categoricalStore.id2s : [];
      const returnIds = id1s.includes(area.id) ? id1s : id2s;
      EventBus.emit(`update-categorical-area-style-${props.cardId}`, {
        categoricalId: isCategoricalOrNumerical,
        areaIds: returnIds,
        style: { fillColor: newColor },
      });
    } else if (isCategoricalOrNumerical.includes('Numerical')) {
      const newColors = getMinMaxColorByNumericalData(
        props.cardId,
        modifiedType.toLowerCase(),
        area.id,
        newColor
      );
      EventBus.emit(`update-numerical-area-style-${props.cardId}`, {
        type: modifiedType,
        areaIds: newColors.numericalIds,
        style: {
          minColor: newColors.minColor,
          maxColor: newColors.maxColor,
        },
      });
    }
  }
  EventBus.emit(`update-objects-by-type-${props.cardId}`, 'all');
};

// Refresh every text highlight overlay (border, hover, color underline).
const updateHighlights = () => {
  if (!quill) return;
  buildHighlightMap();
  buildColorWordsSet();
  applyHighlights();
  applyHoverHighlight();
  applyColorUnderlines();
};

// React to map hover events by toggling hover-highlight mode.
const handleHoverHighlight = (payload) => {
  // An empty payload means "stop hover highlighting" and restore the default.
  if (!payload || !payload.addresses || payload.addresses.length === 0) {
    isHoverHighlightMode.value = false;
    hoverAddresses.value = [];
    applyHighlights();
    applyColorUnderlines();
    return;
  }

  isHoverHighlightMode.value = true;
  hoverAddresses.value = payload.addresses.slice();
  applyHoverHighlight();
};

const applyHoverHighlight = () => {
  if (!quill) return;
  clearHoverHighlight();
  const currentSelection = quill.getSelection();

  const text = quill.getText();
  if (!text || text.trim().length === 0) return;

  // Sort by length descending so longer place names match before shorter substrings.
  const sortedAddresses = hoverAddresses.value
    .map((addr) => addr.toLowerCase())
    .sort((a, b) => b.length - a.length);

  sortedAddresses.forEach((lowerAddress) => {
    // Find every (case-insensitive) occurrence of this address in the text.
    const regex = new RegExp(escapeRegExp(lowerAddress), 'gi');

    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
      });
    }

    // Apply formatting from the end backwards so earlier indices stay valid.
    matches.reverse().forEach(({ index, length }) => {
      if (isHoverHighlightMode.value) {
        quill.formatText(index, length, 'background', '#ffeb3b');
      }
    });
  });

  if (currentSelection) {
    quill.setSelection(currentSelection.index, currentSelection.length);
  }
};

const clearHoverHighlight = () => {
  if (!quill) return;

  const text = quill.getText();
  if (!text) return;

  // Strip every background format in one pass.
  const length = text.length;
  quill.formatText(0, length, 'background', false);
};

// Highlight a specific colorPosition phrase that came from a map layer click.
const highlightColorPosition = (payload) => {
  if (!quill || !payload) return;
  if (!payload.colorPosition) {
    // No phrase to match: just highlight every layer associated with this place.
    EventBus.emit(`handle-no-color-position-${props.cardId}`, {
      layerId: payload.id,
    });
    return;
  }
  const text = quill.getText();
  if (!text) return;
  const currentSelection = quill.getSelection();

  clearColorPositionHighlight();

  const colorPosition = payload.colorPosition;
  const regex = new RegExp(escapeRegExp(colorPosition), 'gi');

  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
    });
  }

  // Paint each occurrence with a pale yellow background.
  matches.reverse().forEach(({ index, length }) => {
    quill.formatText(index, length, 'background', '#ffeb3b');
  });

  if (currentSelection) {
    quill.setSelection(currentSelection.index, currentSelection.length);
  }
};

const clearColorPositionHighlight = () => {
  if (!quill) return;

  const text = quill.getText();
  if (!text) return;

  // Strip every background format in one pass.
  const length = text.length;
  quill.formatText(0, length, 'background', false);

  EventBus.emit(`handle-no-color-position-${props.cardId}`, {
    layerId: null,
  });
};

// Build the place-name -> colors map and the address -> layer-id index.
const buildHighlightMap = () => {
  // Remember the previously selected type for each address so we can restore it.
  const formerSelectedTypesMap = new Map();
  wordColorRectMap.value.forEach((value, key) => {
    formerSelectedTypesMap.set(key, value.types[value.selectedIdx]);
  });
  wordColorRectMap.value.clear();
  highlightWord.value = null;
  addressToLayerIdsMap.value.clear();

  const pointTypeMap = {
    0: 'Dot',
    1: 'Marker',
    2: 'Other Icon',
  };
  const lineTypeMap = {
    0: 'Trajectory',
    1: 'Geographical Line',
    2: 'Direction',
  };

  // Index every line first so each waypoint contributes its line color/type.
  const lines = LineStore.getAll(props.cardId);

  lines.forEach((line) => {
    if (line.waypoints && line.waypoints.length > 0) {
      line.waypoints.forEach((waypointId) => {
        const waypoint = PointStore.getById(props.cardId, waypointId);

        if (waypoint.addressName) {
          const typeName = lineTypeMap[line.type] || 'Unknown';
          const addressParts = waypoint.addressName.split(',').map((s) => s.trim());
          addressParts.forEach((addr) => {
            if (addr && addr.length > 0) {
              const lowerAddr = addr.toLowerCase();
              if (!wordColorRectMap.value.has(lowerAddr)) {
                wordColorRectMap.value.set(lowerAddr, {
                  colors: [line.strokeColor || '#0000FF'],
                  types: [typeName],
                  ids: [line.id],
                  selectedIdx: 0,
                  original: addr,
                });
              } else {
                const entry = wordColorRectMap.value.get(lowerAddr);
                entry.colors.push(line.strokeColor || '#0000FF');
                entry.types.push(typeName);
                entry.ids.push(line.id);
              }

              if (formerSelectedTypesMap.has(lowerAddr)) {
                const formerType = formerSelectedTypesMap.get(lowerAddr);
                const idx = wordColorRectMap.value.get(lowerAddr).types.indexOf(formerType);
                if (idx !== -1) {
                  wordColorRectMap.value.get(lowerAddr).selectedIdx = idx;
                }
              }

              if (!addressToLayerIdsMap.value.has(lowerAddr)) {
                addressToLayerIdsMap.value.set(lowerAddr, []);
              }
              addressToLayerIdsMap.value.get(lowerAddr).push({
                type: 'line',
                layerId: line.id,
              });
            }
          });
        }
      });
    }
  });

  // Then index every standalone point.
  const points = PointStore.getAll(props.cardId);

  points.forEach((point) => {
    if (!point.addressName) return;

    const addressParts = point.addressName.split(',').map((s) => s.trim());
    addressParts.forEach((addr) => {
      if (addr && addr.length > 0) {
        const lowerAddr = addr.toLowerCase();
        const pointColor = point.color || '#FF0000';
        const typeName = pointTypeMap[point.type] || 'Unknown';
        // Dot type: skip waypoint points but still record the layer mapping.
        if (point.type === 0 && point.isWaypoint) {
          if (!addressToLayerIdsMap.value.has(lowerAddr)) {
            addressToLayerIdsMap.value.set(lowerAddr, []);
          }
          addressToLayerIdsMap.value.get(lowerAddr).push({
            type: 'point',
            layerId: point.id,
          });
          return;
        }
        // Append color (no de-duplication: multiple layers may share the address).
        if (!wordColorRectMap.value.has(lowerAddr)) {
          wordColorRectMap.value.set(lowerAddr, {
            colors: [pointColor],
            selectedIdx: 0,
            types: [typeName],
            ids: [point.id],
            original: addr,
          });
        } else {
          const entry = wordColorRectMap.value.get(lowerAddr);
          entry.colors.push(pointColor);
          entry.types.push(typeName);
          entry.ids.push(point.id);
        }

        if (formerSelectedTypesMap.has(lowerAddr)) {
          const formerType = formerSelectedTypesMap.get(lowerAddr);
          const idx = wordColorRectMap.value.get(lowerAddr).types.indexOf(formerType);
          if (idx !== -1) {
            wordColorRectMap.value.get(lowerAddr).selectedIdx = idx;
          }
        }
        if (!addressToLayerIdsMap.value.has(lowerAddr)) {
          addressToLayerIdsMap.value.set(lowerAddr, []);
        }
        addressToLayerIdsMap.value.get(lowerAddr).push({
          type: 'point',
          layerId: point.id,
        });
      }
    });
  });

  // Finally index every area.
  const areas = AreaStore.getAll(props.cardId);
  const areaTypeMap = {
    0: 'Irregular Area',
    1: 'Regular Shape',
  };
  areas.forEach((area) => {
    if (area.addressName) {
      const typeName = areaTypeMap[area.type] || 'Unknown';
      const addressParts = area.addressName.split(',').map((s) => s.trim());
      addressParts.forEach((addr) => {
        if (addr && addr.length > 0) {
          const lowerAddr = addr.toLowerCase();
          if (!wordColorRectMap.value.has(lowerAddr)) {
            wordColorRectMap.value.set(lowerAddr, {
              colors: [area.fillColor || '#FFFF00'],
              types: [typeName],
              selectedIdx: 0,
              ids: [area.id],
              original: addr,
            });
          } else {
            const entry = wordColorRectMap.value.get(lowerAddr);
            entry.colors.push(area.fillColor || '#FFFF00');
            entry.types.push(typeName);
            entry.ids.push(area.id);
          }

          if (formerSelectedTypesMap.has(lowerAddr)) {
            const formerType = formerSelectedTypesMap.get(lowerAddr);
            const idx = wordColorRectMap.value.get(lowerAddr).types.indexOf(formerType);
            if (idx !== -1) {
              wordColorRectMap.value.get(lowerAddr).selectedIdx = idx;
            }
          }
          if (!addressToLayerIdsMap.value.has(lowerAddr)) {
            addressToLayerIdsMap.value.set(lowerAddr, []);
          }
          addressToLayerIdsMap.value.get(lowerAddr).push({
            type: 'area',
            layerId: area.id,
          });
        }
      });
    }
  });
};

// colorPosition (full sentence) -> { color, colorWords (descriptive names) }
const colorPositionMap = ref(new Map());
const buildColorWordsSet = () => {
  colorPositionMap.value.clear();
  const points = PointStore.getAll(props.cardId);
  points.forEach((point) => {
    if (point.colorPosition && point.colorPosition.trim() && point.color) {
      const colorPosition = point.colorPosition.trim();
      const colorNames = [getDescriptiveColorName(point.color)];
      if (colorNames.length > 0) {
        colorPositionMap.value.set(colorPosition, {
          color: point.color,
          colorWords: colorNames,
        });
      }
    }
  });

  const lines = LineStore.getAll(props.cardId);
  lines.forEach((line) => {
    if (line.colorPosition && line.colorPosition.trim() && line.strokeColor) {
      const colorPosition = line.colorPosition.trim();
      const colorNames = [getDescriptiveColorName(line.strokeColor)];
      if (colorNames.length > 0) {
        colorPositionMap.value.set(colorPosition, {
          color: line.strokeColor,
          colorWords: colorNames,
        });
      }
    }
  });

  const areas = AreaStore.getAll(props.cardId);
  areas.forEach((area) => {
    if (area.colorPosition && area.colorPosition.trim()) {
      const colorPosition = area.colorPosition.trim();
      const colorValue = area.fillColor || area.borderColor;
      if (colorValue) {
        const colorNames = [getDescriptiveColorName(colorValue)];
        if (colorNames.length > 0) {
          colorPositionMap.value.set(colorPosition, {
            color: colorValue,
            colorWords: colorNames,
          });
        }
      }
    }
  });
};

// Underline color words inside their owning sentences (e.g. "vibrant red dot").
const applyColorUnderlines = () => {
  if (!quill) return;

  const text = quill.getText();
  if (!text || text.trim().length === 0) return;

  const currentSelection = quill.getSelection();

  // Clear any existing color-word underlines first.
  clearColorUnderlines();

  colorPositionMap.value.forEach(({ color, colorWords }, colorPosition) => {
    // Locate every (case-insensitive) occurrence of the sentence in the text.
    const positionRegex = new RegExp(escapeRegExp(colorPosition), 'gi');
    const positionMatches = [];
    let positionMatch;

    while ((positionMatch = positionRegex.exec(text)) !== null) {
      positionMatches.push({
        index: positionMatch.index,
        length: positionMatch[0].length,
      });
    }

    positionMatches.forEach(({ index: sentenceIndex, length: sentenceLength }) => {
      const sentenceText = text.substring(sentenceIndex, sentenceIndex + sentenceLength);

      // Sort by length descending so longer color phrases are matched first.
      const sortedColorWords = colorWords.slice().sort((a, b) => b.length - a.length);

      sortedColorWords.forEach((colorWord) => {
        const colorRegex = new RegExp(`\\b${escapeRegExp(colorWord)}\\b`, 'gi');
        const colorMatches = [];
        let colorMatch;

        while ((colorMatch = colorRegex.exec(sentenceText)) !== null) {
          colorMatches.push({
            index: sentenceIndex + colorMatch.index,
            length: colorMatch[0].length,
          });
        }

        colorMatches.reverse().forEach(({ index, length }) => {
          const format = quill.getFormat(index, length);
          if (!format['custom-underline']) {
            quill.formatText(index, length, 'custom-underline', true);
          }
        });
      });
    });
  });

  if (currentSelection) {
    quill.setSelection(currentSelection.index, currentSelection.length);
  }
};

// Remove every color-word underline previously applied by applyColorUnderlines.
const clearColorUnderlines = () => {
  if (!quill) return;

  const text = quill.getText();
  if (!text) return;

  const allColorWords = new Set();
  colorPositionMap.value.forEach(({ colorWords }) => {
    colorWords.forEach((word) => allColorWords.add(word));
  });

  allColorWords.forEach((colorWord) => {
    const regex = new RegExp(`\\b${escapeRegExp(colorWord)}\\b`, 'gi');
    let match;
    const matches = [];

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
      });
    }

    matches.reverse().forEach(({ index, length }) => {
      const format = quill.getFormat(index, length);
      if (format['custom-underline']) {
        quill.formatText(index, length, 'custom-underline', false);
      }
    });
  });
};

// Outline every place name with the color of its currently selected layer.
const applyHighlights = () => {
  if (!quill) return;
  const currentSelection = quill.getSelection();

  const text = quill.getText();
  if (!text || text.trim().length === 0) return;

  clearAutoHighlights();

  // Sort by length descending so longer place names are matched first.
  const sortedAddresses = Array.from(wordColorRectMap.value.entries()).sort(
    (a, b) => b[1].original.length - a[1].original.length
  );

  sortedAddresses.forEach(([lowerAddress, { colors, original, selectedIdx }]) => {
    const color = colors && colors.length > selectedIdx ? colors[selectedIdx] : '#FF0000';
    const regex = new RegExp(escapeRegExp(original), 'gi');

    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
      });
    }

    matches.reverse().forEach(({ index, length }) => {
      const format = quill.getFormat(index, length);
      if (!format['address-border']) {
        quill.formatText(index, length, 'address-border', color);
      }
    });
  });

  if (currentSelection) {
    quill.setSelection(currentSelection.index, currentSelection.length);
  }
};

// Clear only the auto-applied highlights for addresses we currently track.
const clearAutoHighlights = () => {
  if (!quill) return;

  const text = quill.getText();
  if (!text) return;

  const addressesToClear = Array.from(wordColorRectMap.value.values()).map((v) => v.original);

  addressesToClear.forEach((original) => {
    const regex = new RegExp(escapeRegExp(original), 'gi');
    let match;
    const matches = [];

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
      });
    }

    matches.reverse().forEach(({ index, length }) => {
      const format = quill.getFormat(index, length);
      if (format['address-border']) {
        quill.formatText(index, length, 'address-border', false);
      }
      // Also strip any pale-yellow hover background that may overlap.
      if (format['background']) {
        quill.formatText(index, length, 'background', false);
      }
    });
  });
};

// Clear every highlight regardless of the current map state.
const clearAllHighlights = () => {
  if (!quill) return;

  const text = quill.getText();
  if (!text) return;

  const length = text.length;
  quill.formatText(0, length, 'address-border', false);
  quill.formatText(0, length, 'background', false);
};

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Keep the editor in sync when props.content is updated externally.
watch(
  () => props.content,
  (newContent) => {
    if (!quill) return;
    const currentText = quill.getText();
    // Compare without trailing newlines so "foo" and "foo\n" do not refresh.
    const trim = (s) => (s || '').replace(/\n+$/, '');
    if (trim(newContent) === trim(currentText)) return;
    const selection = quill.getSelection();
    applyContentToQuill(newContent || '');
    if (selection) {
      quill.setSelection(selection.index, selection.length);
    }
  }
);

// Listen for hover events inside the editor to highlight matching map layers.
const setupTextHoverListener = () => {
  if (!quill) return;

  const editorElement = quill.root;
  let hoverTimeout = null;

  editorElement.addEventListener('mousemove', (e) => {
    if (!quill) return;

    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }

    const target = e.target;
    if (!target) {
      EventBus.emit(`hover-text-address-${props.cardId}`, null);
      return;
    }

    // Only fire when hovering over a span that carries our address-border or
    // hover-background formatting.
    const spanElement = target.closest('span[data-border-color], span[style*="background"]');
    if (!spanElement) {
      EventBus.emit(`hover-text-address-${props.cardId}`, null);
      return;
    }

    const word = spanElement.textContent.trim();
    if (!word) {
      EventBus.emit(`hover-text-address-${props.cardId}`, null);
      return;
    }

    // Resolve the layer IDs associated with the hovered phrase, with a partial
    // fallback in case the user hovered only part of an address.
    const lowerWord = word.toLowerCase();
    let layerIds = addressToLayerIdsMap.value.get(lowerWord);

    if (!layerIds || layerIds.length === 0) {
      for (const [address, ids] of addressToLayerIdsMap.value.entries()) {
        if (address.includes(lowerWord) || lowerWord.includes(address)) {
          layerIds = ids;
          break;
        }
      }
    }

    if (layerIds && layerIds.length > 0) {
      // Debounce a little so quick movements do not flood the bus.
      hoverTimeout = setTimeout(() => {
        EventBus.emit(`hover-text-address-${props.cardId}`, {
          address: word,
          layerIds: layerIds,
        });
      }, 100);
    } else {
      EventBus.emit(`hover-text-address-${props.cardId}`, null);
    }
  });

  editorElement.addEventListener('mouseleave', () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    EventBus.emit(`hover-text-address-${props.cardId}`, null);
  });
};

onBeforeUnmount(() => {
  EventBus.off(`highlight-text-${props.cardId}`, updateHighlights);
  EventBus.off(`hover-map-object-${props.cardId}`, handleHoverHighlight);
  EventBus.off(`clear-all-highlights-${props.cardId}`, clearAllHighlights);
  EventBus.off(`highlight-color-position-${props.cardId}`, highlightColorPosition);
  EventBus.off(`clear-color-position-highlight-${props.cardId}`, clearColorPositionHighlight);

  // Detach the in-editor keyboard shortcut listener.
  if (quill && editorKeydownHandler) {
    const editorElement = quill.root;
    editorElement.removeEventListener('keydown', editorKeydownHandler);
  }
  if (clickTimer.value) {
    clearTimeout(clickTimer.value);
    clickTimer.value = null;
  }
});
</script>

<style scoped>
.editor-wrapper {
  width: 100%;
}

.ql-toolbar {
  margin-bottom: 10px;
  font-size: 12px;
}

/* Justify body text by default. */
:deep(.ql-editor) {
  text-align: justify;
}

:deep(.ql-editor p) {
  text-align: justify;
}

/* Custom outline applied to highlighted addresses. */
:deep(.ql-editor span[data-border-color]) {
  display: inline-block;
  line-height: 1.2;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

/* Custom underline used to mark color words inside addressed sentences. */
:deep(.ql-editor .custom-underline) {
  position: relative;
  display: inline;
  padding-bottom: 1px;
  border-bottom: 1px solid #000000;
  /* Remove the default text-decoration so it doesn't double up. */
  text-decoration: none !important;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.custom-btn {
  font-size: 12px;
  padding: 2px 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  color: #333;
  margin-right: 4px;
}

.color-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.color-popup {
  position: absolute;
  z-index: 3000;
  background: #fff;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 5px 12px;
  min-width: 160px;
  max-width: 260px;
}

.color-popup-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.color-popup-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 5px;
}

.colors-popup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 5px;
  padding: 4px 6px;
}

.color-type {
  font-size: 14px;
  color: #555;
}

.color-popup-item {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #222;
  transition: box-shadow 0.2s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  position: relative;
}

.color-popup-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  border-color: #2563eb;
}

.color-text-input {
  width: 100px;
  padding: 4px 6px;
  font-size: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  transition: border-color 0.2s;
}

.color-tooltip {
  display: none;
  position: absolute;
  bottom: 110%;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  color: #333;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  z-index: 10;
  pointer-events: none;
}

.color-popup-item:hover .color-tooltip {
  display: block;
}

.color-popup-close {
  margin-top: 2px;
  padding: 2px 10px;
  border-radius: 4px;
  border: none;
  background: #f3f4f6;
  color: #333;
  font-size: 12px;
  cursor: pointer;
}

.color-popup-close:hover {
  background: #e5e7eb;
}

.color-editor {
  position: absolute;
  z-index: 3100;
  width: 1px;
  height: 1px;
}
</style>
