<template>
  <div class="flex flex-row gap-1" :id="mapContainerID">
    <div
      class="map-card bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden flex-grow relative"
      :style="{ height: mapHeight + 'px' }"
    >
      <div :id="mapID" class="map-placeholder" @click="displayMap"></div>

      <div
        v-if="isSelectingMultipleLocations"
        class="selection-toolbar flex flex-col items-start"
        draggable="true"
        @dragstart="handleSelectionToolbarDragStart"
      >
        <button class="selection-toolbar-close" @click="cancelSelectingLocations">×</button>
        <span v-if="!spatialRelationshipResult" class="selection-info"
          >Selected {{ selectedLocations.length }} locations:
          {{ selectedLocations.map((location) => location.placeName).join('; ') }}</span
        >
        <div v-else class="selection-info">
          <div class="spatial-relationship-result">
            Generated Spatial Relationship: {{ spatialRelationshipResult }}
          </div>
        </div>
        <div v-if="!spatialRelationshipResult" class="selection-buttons">
          <button class="selection-btn" @click="generateSpatialRelationshipDescriptions">
            Generate
          </button>
        </div>
      </div>

      <!-- search bar -->
      <div v-if="isSearch" class="search-bar">
        <div class="search-inputs flex flex-col gap-1">
          <div class="flex flex-row gap-1">
            <img
              v-if="selectedSearchType === 1"
              src="../assets/svgs/minus.svg"
              alt="Search"
              @click="removeWaypoint(0)"
              style="color: white; width: 20px"
            />
            <img
              v-else
              src="../assets/svgs/minus.svg"
              alt="Search"
              @click="removeSearchAddress(0)"
              style="color: white; width: 20px"
            />

            <input
              class="search-input"
              type="text"
              v-model="searchAddress"
              placeholder="Enter address"
              @keydown.enter="performSearch"
            />
          </div>
          <div
            v-if="selectedSearchType === 1"
            v-for="(waypoint, index) in wayPointsForSearch"
            :key="index"
            class="flex flex-row gap-1"
          >
            <img
              src="../assets/svgs/minus.svg"
              alt="Search"
              @click="removeWaypoint(index + 1)"
              style="color: white; width: 20px"
            />
            <input
              class="search-input"
              type="text"
              v-model="wayPointsForSearch[index]"
              placeholder="Enter address"
              @keydown.enter="performSearch"
            />
          </div>
          <div v-else v-for="(address, i) in searchAddresses" :key="i" class="flex flex-row gap-1">
            <img
              src="../assets/svgs/minus.svg"
              alt="Search"
              @click="removeSearchAddress(i + 1)"
              style="color: white; width: 20px"
            />
            <input
              class="search-input"
              type="text"
              v-model="searchAddresses[i]"
              placeholder="Enter address"
              @keydown.enter="performSearch"
            />
          </div>
          <div
            v-if="selectedSearchType === 1"
            style="margin-top: 4px"
            class="flex flex-row gap-2"
            @click="addWaypoint"
          >
            <img src="../assets/svgs/add.svg" alt="Search" style="color: white; width: 20px" />
            <span>Add Waypoint</span>
          </div>
          <div v-else style="margin-top: 4px" class="flex flex-row gap-2" @click="addSearchAddress">
            <img src="../assets/svgs/add.svg" alt="Search" style="color: white; width: 20px" />
            <span>Add Address</span>
          </div>
        </div>
        <button class="search-button" @click="performSearch">
          <img src="../assets/svgs/search_white.svg" alt="Search" style="color: white" />
        </button>
        <!-- <button class="search-button" @click="changeSearchType">
          <img src="../assets/svgs/change.svg" alt="Search" style="color: white;" />
        </button> -->
        <div
          class="dropdown-wrapper search-button"
          style="position: relative; display: inline-block"
        >
          <img
            v-if="selectedSearchType === 0"
            src="../assets/svgs/pin-white.svg"
            alt="Search"
            style="color: white"
            @click="showDropdown = !showDropdown"
          />
          <img
            v-else-if="selectedSearchType === 1"
            src="../assets/svgs/trajectory-white.svg"
            alt="Search"
            style="color: white"
            @click="showDropdown = !showDropdown"
          />
          <img
            v-else-if="selectedSearchType === 2"
            src="../assets/svgs/area.svg"
            alt="Search"
            style="color: white"
            @click="showDropdown = !showDropdown"
          />
        </div>
        <div v-if="showDropdown" class="dropdown-menu flex flex-row" style="z-index: 1000">
          <img
            src="../assets/svgs/pin-white.svg"
            alt="Search"
            style="color: white; border: none"
            @click="
              selectedSearchType = 0;
              showDropdown = false;
            "
            class="select-icon"
          />
          <img
            src="../assets/svgs/trajectory-white.svg"
            alt="Search"
            style="color: white"
            @click="
              selectedSearchType = 1;
              showDropdown = false;
            "
            class="select-icon"
          />
          <img
            src="../assets/svgs/area.svg"
            alt="Search"
            style="color: white"
            @click="
              selectedSearchType = 2;
              showDropdown = false;
            "
            class="select-icon"
          />
        </div>
      </div>

      <!-- Geographical info popup -->
      <div
        v-if="locationInfoVisible"
        class="location-info-popup"
        :style="{ top: locationInfoPosition.y + 'px', left: locationInfoPosition.x + 'px' }"
        draggable="true"
        @dragstart="handleLocationInfoDragStart"
      >
        <div class="location-info-popup__header">
          <span class="location-info-popup__title">Geographical Information</span>
          <button class="location-info-popup__close" @click="closeLocationInfo">×</button>
        </div>
        <div class="location-info-popup__content">
          <div v-if="locationInfoLoading" class="location-info-popup__loading">Loading...</div>
          <div v-else>
            <div class="location-info-item">
              <span class="location-info-label">Address:</span>
              <span class="location-info-value">{{ locationInfo.placeName }}</span>
            </div>
            <div class="location-info-item">
              <span class="location-info-label">Coordinates:</span>
              <span class="location-info-value"
                >{{ locationInfo.coordinates.lng.toFixed(6) }},
                {{ locationInfo.coordinates.lat.toFixed(6) }}</span
              >
            </div>
            <div
              v-if="locationInfo.context && locationInfo.context.length > 0"
              class="location-info-item"
            >
              <span class="location-info-label">Detailed Information:</span>
              <div class="location-info-context">
                <div
                  v-for="(item, index) in locationInfo.context"
                  :key="index"
                  class="location-info-context-item"
                >
                  {{ item.text || item.id }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="resize-handle" @mousedown="startResize"></div>

      <div
        v-if="isAddingTexture && inputTexturePosition.x !== 0 && inputTexturePosition.y !== 0"
        class="texture-input-popup"
        :style="{
          position: 'fixed',
          left: inputTexturePosition.x + 'px',
          top: inputTexturePosition.y + 'px',
          zIndex: 2000,
        }"
      >
        <input
          type="text"
          v-model="inputTextureValue"
          ref="textureInputRef"
          @keydown.enter="handleTextureInputEnter"
          @blur="resetTextureInput"
          placeholder="Enter the annotation and press Enter"
          class="texture-input-box"
        />
      </div>
    </div>

    <div class="map-tools flex flex-col gap-1">
      <div class="btn" @click="hiddenMap">
        <img :src="close" alt="Close" />
      </div>
      <div class="btn" @click="changeStyle">
        <img :src="map" alt="Map" />
      </div>
      <div class="btn" @click="changeTo3DFunc">
        <img :src="threeD" alt="3D" />
      </div>
      <div class="btn" @click="startAddDot">
        <img :src="dot" alt="Dot" />
      </div>
      <div class="btn" @click="startAddMarker">
        <img :src="pin2" alt="Pin" />
      </div>
      <div class="btn" @click="openIconUploadDialog">
        <img :src="plus" alt="Plus" />
      </div>
      <div class="btn" @click="startAddLine">
        <img :src="line" alt="Line" />
      </div>
      <div class="btn" @click="startAddRoute">
        <img :src="route" alt="Route" />
      </div>
      <div class="btn" @click="startAddDirection">
        <img :src="direction" alt="Direction" />
      </div>
      <!-- <div class="btn" @click="startDrawRect">
        <img :src="rect" alt="Rect">
      </div> -->
      <div class="btn" @click="startAddCircle">
        <img :src="circle" alt="Circle" />
      </div>
      <div class="btn" @click="startAddPolygon">
        <img :src="poly" alt="Poly" />
      </div>
      <div class="btn" @click="startAddTexture">
        <img :src="text" alt="Text" />
      </div>
      <div class="btn" @click="startAddSearch">
        <img :src="search" alt="Search" />
      </div>
      <!-- test ---------------------- -->
      <!-- <div class="btn" @click="testLinesMap">
        <img :src="dot" alt="dot">
      </div> -->
      <input
        ref="iconFileInput"
        type="file"
        accept="image/svg+xml,.svg"
        class="hidden"
        @change="onIconFileSelected"
      />
    </div>

    <div v-if="stylePopupVisible" class="style-dialog-overlay" @click="closeStylePopup"></div>

    <div v-if="stylePopupVisible" class="style-dialog" @click.stop>
      <div class="style-dialog-header">
        <span class="style-dialog-title">Style Settings</span>
        <button class="style-dialog-close" type="button" @click="closeStylePopup">×</button>
      </div>
      <div class="style-dialog-content">
        <div v-if="stylePopupTarget && stylePopupType === 'point'" class="style-section">
          <div class="style-item">
            <label>Fill Color</label>
            <div class="color-input-wrapper">
              <input type="color" v-model="styleForm.pointColor" @change="applyStylePopup" />
              <input
                type="text"
                v-model="styleForm.pointColor"
                @change="applyStylePopup"
                class="color-text-input"
              />
            </div>
          </div>
          <div class="style-item" v-if="styleForm.pointSubtype == 0">
            <label>Radius</label>
            <input
              type="number"
              v-model.number="styleForm.pointRadius"
              @change="applyStylePopup"
              min="1"
              max="50"
              class="number-input"
            />
          </div>
          <div class="style-item" v-else>
            <label>Icon Size</label>
            <input
              type="number"
              v-model.number="styleForm.pointIconSize"
              @change="applyStylePopup"
              min="0.1"
              max="5"
              step="0.1"
              class="number-input"
            />
          </div>
        </div>

        <!-- Line style settings -->
        <div v-if="stylePopupTarget && stylePopupType === 'line'" class="style-section">
          <div class="style-item">
            <label>Line Color</label>
            <div class="color-input-wrapper">
              <div :style="{ backgroundColor: styleForm.strokeColor }">
                <input
                  type="color"
                  v-model="styleForm.strokeColor"
                  @change="applyStylePopup"
                  class="w-10 h-10 opacity-0 cursor-pointer"
                />
              </div>
              <input
                type="text"
                v-model="styleForm.strokeColor"
                @change="applyStylePopup"
                class="color-text-input"
              />
            </div>
          </div>
          <div class="style-item">
            <label>Line Width</label>
            <input
              type="number"
              v-model.number="styleForm.strokeWidth"
              @change="applyStylePopup"
              min="1"
              max="20"
              class="number-input"
            />
          </div>
          <div class="style-item">
            <label>Line Opacity</label>
            <div class="flex flex-row items-center gap-1">
              <input
                type="range"
                v-model.number="styleForm.strokeOpacity"
                @change="applyStylePopup"
                min="0"
                max="1"
                step="0.1"
                class="range-input"
              />
              <span class="range-value">{{ (styleForm.strokeOpacity * 100).toFixed(0) }}%</span>
            </div>
          </div>
          <div class="style-item">
            <label>Line Style</label>
            <select v-model="styleForm.strokeType" @change="applyStylePopup" class="select-input">
              <option :value="0">Solid</option>
              <option :value="1">Dashed</option>
            </select>
          </div>
          <div class="style-item" v-if="styleForm.strokeType == 1">
            <label>Dashed Interval</label>
            <div class="dash-array-inputs">
              <input
                type="number"
                v-model.number="styleForm.dashArray[0]"
                @change="applyStylePopup"
                min="1"
                max="20"
                class="number-input-small"
              />
              <span>:</span>
              <input
                type="number"
                v-model.number="styleForm.dashArray[1]"
                @change="applyStylePopup"
                min="1"
                max="20"
                class="number-input-small"
              />
            </div>
          </div>

          <div class="style-item" v-if="styleForm.lineProfile">
            <label>Route Profile</label>
            <select v-model="styleForm.lineProfile" @change="applyStylePopup" class="select-input">
              <option value="driving">Driving</option>
              <option value="walking">Walking</option>
              <option value="cycling">Cycling</option>
              <option value="flight">Flight</option>
            </select>
          </div>
        </div>

        <!-- Area style settings -->
        <div v-if="stylePopupTarget && stylePopupType === 'area'" class="style-section">
          <div class="style-item">
            <label>Fill Color</label>
            <div class="color-input-wrapper">
              <div :style="{ backgroundColor: styleForm.areaFillColor }">
                <input
                  type="color"
                  v-model="styleForm.areaFillColor"
                  @change="applyStylePopup"
                  class="w-10 h-10 opacity-0 cursor-pointer"
                />
              </div>
              <input
                type="text"
                v-model="styleForm.areaFillColor"
                @change="applyStylePopup"
                class="color-text-input"
              />
            </div>
          </div>
          <div class="style-item">
            <label>Fill Opacity</label>
            <div class="flex flex-row items-center gap-1">
              <input
                type="range"
                v-model.number="styleForm.areaFillOpacity"
                @change="applyStylePopup"
                min="0"
                max="1"
                step="0.1"
                class="range-input"
              />
              <span class="range-value">{{ (styleForm.areaFillOpacity * 100).toFixed(0) }}%</span>
            </div>
          </div>
          <div class="style-item">
            <label>Border Color</label>
            <div class="color-input-wrapper">
              <div :style="{ backgroundColor: styleForm.areaBorderColor }">
                <input
                  type="color"
                  v-model="styleForm.areaBorderColor"
                  @change="applyStylePopup"
                  class="w-10 h-10 opacity-0 cursor-pointer"
                />
              </div>
              <input
                type="text"
                v-model="styleForm.areaBorderColor"
                @change="applyStylePopup"
                class="color-text-input"
              />
            </div>
          </div>
          <div class="style-item">
            <label>Border Width</label>
            <input
              type="number"
              v-model.number="styleForm.areaBorderWidth"
              @change="applyStylePopup"
              min="1"
              max="10"
              class="number-input"
            />
          </div>
          <div class="style-item" v-if="styleForm.areaRadius">
            <label>Radius</label>
            <input
              type="number"
              v-model.number="styleForm.areaRadius"
              @change="applyStylePopup"
              class="number-input"
            />
          </div>
          <div class="style-item" v-if="styleForm.height">
            <label>Height</label>
            <input
              type="number"
              v-model.number="styleForm.height"
              @change="applyStylePopup"
              class="number-input"
            />
          </div>
          <div
            v-if="!isMap3DMode(cardId)"
            class="style-item"
            style="display: flex; justify-content: space-between; align-items: center"
          >
            <label>Highlight as Mask</label>
            <button
              type="button"
              :class="['toggle-switch', { on: styleForm.isMaskHighlight }]"
              @click="((styleForm.isMaskHighlight = !styleForm.isMaskHighlight), applyStylePopup())"
              :aria-pressed="styleForm.isMaskHighlight ? 'true' : 'false'"
              style="
                width: 40px;
                height: 20px;
                border-radius: 16px;
                border: 1px solid #cbd5e1;
                background: #e6e7eb;
                position: relative;
                cursor: pointer;
                padding: 0;
              "
            >
              <span
                style="
                  display: block;
                  width: 14px;
                  height: 14px;
                  border-radius: 50%;
                  background: white;
                  position: absolute;
                  top: 2px;
                  left: 2px;
                  transition:
                    left 0.18s ease,
                    background 0.18s ease;
                "
                :style="{
                  left: styleForm.isMaskHighlight ? '22px' : '2px',
                  background: styleForm.isMaskHighlight ? '#3b82f6' : '#ffffff',
                }"
              ></span>
            </button>
          </div>
        </div>

        <div class="descriptions-section style-section">
          <label>Descriptions</label>
          <!-- <textarea 
          :ref="el => setDescriptionsInputRef(el)"
          class="descriptions-input" v-if="styleForm.selectedDescription"
          :style="{ height: descriptionsInputRef?.scrollHeight ? descriptionsInputRef.scrollHeight + 'px' : 'auto' }"
          v-model="styleForm.selectedDescription">
          </textarea> -->

          <textarea
            :ref="(el) => setDescriptionsInputRef(el)"
            class="descriptions-input"
            v-if="styleForm.selectedDescription"
            :style="{
              height: descriptionsInputRef?.scrollHeight
                ? descriptionsInputRef.scrollHeight + 'px'
                : 'auto',
            }"
            v-model="styleForm.selectedDescription"
          ></textarea>

          <div
            class="descriptions-item"
            v-if="!styleForm.selectedDescription"
            v-for="description in generatedDescriptions"
            :key="description.id || description"
            @dblclick="handleDescriptionDblClick(description)"
          >
            <span class="descriptions-item-text">{{ description }}</span>
          </div>
          <button
            v-if="!styleForm.selectedDescription && generatedDescriptions.length === 0"
            class="descriptions-btn bg-gray-700 text-white"
            @click="generateDescriptions"
          >
            {{
              !styleForm.selectedDescription && generatedDescriptions.length > 0
                ? 'Descriptions Generated'
                : 'Generate Descriptions'
            }}
          </button>
          <button
            v-if="styleForm.selectedDescription"
            class="descriptions-btn bg-gray-700 text-white"
            @click="addDescriptionToTextBlock"
          >
            Add Description to Text Block
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { ref, reactive, nextTick } from 'vue';
import close from '../assets/svgs/close.svg';
import plus from '../assets/svgs/plus.svg';
import map from '../assets/svgs/map.svg';
import dot from '../assets/svgs/dot.svg';
import direction from '../assets/svgs/direction.svg';
import pin2 from '../assets/svgs/pin2.svg';
import rect from '../assets/svgs/rect.svg';
import circle from '../assets/svgs/circle.svg';
import poly from '../assets/svgs/poly.svg';
import text from '../assets/svgs/text.svg';
import line from '../assets/svgs/line.svg';
import route from '../assets/svgs/route.svg';
import threeD from '../assets/svgs/map-3d.svg';
import search from '../assets/svgs/search.svg';

import mapboxgl from 'mapbox-gl';
import {
  generate_textual_descriptions_for_geo_element,
  generate_descriptions_of_spatial_relationships,
} from '../utils/BackendMsgs.js';
import {
  reverseGeocode,
  addPointByCoordinates,
  addLineByCoordinates,
  addPolygonByCoordinates,
  addCircleByCoordinates,
  addTextByCoordinates,
  addPointByAddress,
  addRegionByAddress,
  addLineByAddress,
  removePointByLayerId,
  removeLineByLayerId,
  removeAreaByLayerId,
  removeElementById,
  removeElementByType,
  isMap3DMode,
  changeTo3D,
} from '../utils/BasicMapTools.js';

import {
  initMapInstance,
  loadCustomImagesIntoMap,
  MAPBOX_STYLES,
  updatePointStyle,
  updateLineStyle,
  updateAreaStyle,
  updatePurpose,
  cyclePointCandidate,
  cycleAreaCandidate,
  cycleLineCandidate,
  updateRouteProfile,
  updateWaypointOfLine,
  clearAllSelectedLocationPoints,
  clearAllIllustrationDrawingPoints,
  updateChangedSubType,
  updateChangedMajorType,
  removeCategoricalOrNumericalObjects,
  processJsonData,
  changeToMaskHighlight,
  removeMaskHighlight,
  updateCategoricalPointStyle,
  updateCategoricalAreaStyle,
  updateNumericalPointStyle,
  updateNumericalAreaStyle,
  getMinMaxColorByNumericalData,
  createRateLimitedExecutor,
  generateBarMap,
  generateLinesMap,
} from '../utils/MapTools.js';
import {
  AreaStore,
  PointStore,
  LineStore,
  CategoricalStore,
  NumericalStore,
} from '../utils/Store.js';
import { EventBus } from '../utils/EventBus.js';
import {
  clamp,
  createDefaultStyleForm,
  safeNumber,
} from '../utils/mapDisplayConfig.js';

const props = defineProps({
  cardId: String,
  content: String,
  version: Number,
});

const mapContainerID = ref(`map-container-${props.cardId}`);
const mapID = ref(`map-${props.cardId}`);
// const mapHeight = ref(1100);
const mapHeight = ref(600);

const mapInstance = ref(null);

const routeMenuVisible = ref(false);
const routeMenuPosition = ref({ x: 0, y: 0 });
const routeMenuLineId = ref(null);
const isUpdatingRoute = ref(false);
const locationInfoVisible = ref(false);
const locationInfoPosition = ref({ x: 0, y: 0 });
const locationInfoLoading = ref(false);
const locationInfo = ref({
  placeName: '',
  address: '',
  context: [],
  coordinates: { lng: 0, lat: 0 },
});

const stylePopupVisible = ref(false);
const stylePopupType = ref(null);
const stylePopupTarget = ref(null);
const styleForm = reactive(createDefaultStyleForm());

const maskHighlightList = ref([]);

const generatedDescriptions = ref([]);

const descriptionsInputRef = ref(null);
const descriptionsHeight = ref(0);

const autoResizeDescriptions = () => {
  const el = descriptionsInputRef.value;
  if (!el) return;
  el.style.height = 'auto';
  descriptionsHeight.value = el.scrollHeight;
};

const setDescriptionsInputRef = (el) => {
  descriptionsInputRef.value = el;
  if (el) {
    // Wait for the current frame to render before measuring.
    nextTick(() => autoResizeDescriptions());
  }
};

const hideRouteMenu = () => {
  routeMenuVisible.value = false;
  routeMenuLineId.value = null;
};

const handlePointContextMenu = (event) => {
  if (!mapInstance.value) return false;
  const features = mapInstance.value.queryRenderedFeatures(event.point);
  if (!features?.length) return false;
  for (const feature of features) {
    const layerId = feature?.layer?.id;
    if (!layerId) continue;
    const point = PointStore.getById(props.cardId, layerId);
    if (point) {
      event.preventDefault?.();
      cyclePointCandidate(mapInstance.value, props.cardId, point.id);
      if (point.isWaypoint) {
        updateWaypointOfLine(mapInstance.value, props.cardId, point.isWaypoint);
      }
      hideRouteMenu();
      return true;
    }
  }
  return false;
};

const handleAreaContextMenu = (event) => {
  if (!mapInstance.value) return false;
  const features = mapInstance.value.queryRenderedFeatures(event.point);
  if (!features?.length) return false;
  for (const feature of features) {
    const layerId = feature?.layer?.id;
    if (!layerId) continue;
    const area = AreaStore.getById(props.cardId, layerId);
    if (area) {
      event.preventDefault?.();
      cycleAreaCandidate(mapInstance.value, props.cardId, area.id);
      hideRouteMenu();
      return true;
    }
  }
  return false;
};

const handleRouteContextMenu = (event) => {
  if (!mapInstance.value) return false;
  const features = mapInstance.value.queryRenderedFeatures(event.point);
  if (!features?.length) return false;
  for (const feature of features) {
    const layerId = feature?.layer?.id;
    if (!layerId) continue;
    const line = LineStore.getById(props.cardId, layerId);
    if (line && line.type === 0) {
      event.preventDefault?.();
      const container = mapInstance.value.getContainer();
      const rect = container?.getBoundingClientRect();
      const clientX = event.originalEvent?.clientX ?? null;
      const clientY = event.originalEvent?.clientY ?? null;
      const offsetX = rect && clientX !== null ? clientX - rect.left : event.point.x;
      const offsetY = rect && clientY !== null ? clientY - rect.top : event.point.y;
      routeMenuPosition.value = { x: offsetX, y: offsetY };
      routeMenuLineId.value = line.id;
      routeMenuVisible.value = true;
      return true;
    } else if (line && line.type === 1) {
      event.preventDefault?.();
      cycleLineCandidate(mapInstance.value, props.cardId, line.id);
      hideRouteMenu();
      return true;
    }
  }
  return false;
};

const handleMapContextMenu = async (event) => {
  if (handleRouteContextMenu(event)) return;
  if (handleAreaContextMenu(event)) return;
  if (handlePointContextMenu(event)) return;
  hideRouteMenu();

  // Otherwise (right-click on empty map), show the geo info popup at the cursor.
  if (!mapInstance.value) return;
  const container = mapInstance.value.getContainer();
  const rect = container?.getBoundingClientRect();
  const clientX = event.originalEvent?.clientX ?? null;
  const clientY = event.originalEvent?.clientY ?? null;
  const screenX = clientX !== null ? clientX : rect ? rect.left + event.point.x : event.point.x;
  const screenY = clientY !== null ? clientY : rect ? rect.top + event.point.y : event.point.y;

  locationInfoPosition.value = { x: screenX, y: screenY };
  locationInfoVisible.value = true;
  locationInfoLoading.value = true;

  // Reverse-geocode the clicked coordinates.
  const lng = event.lngLat.lng;
  const lat = event.lngLat.lat;

  try {
    const zoom = mapInstance.value.getZoom();
    const result = await reverseGeocode(props.cardId, lng, lat, zoom);
    locationInfo.value = result;
  } catch (error) {
    console.error('Failed to fetch geographic info:', error);
    locationInfo.value = {
      placeName: 'Unable to resolve address',
      address: '',
      context: [],
      coordinates: { lng, lat },
    };
  } finally {
    locationInfoLoading.value = false;
  }
};

const handleLocationInfoDragStart = (event) => {
  if (!locationInfo.value || !locationInfo.value.placeName) return;
  if (!event.dataTransfer) return;
  const payload = {
    cardId: props.cardId,
    placeName: locationInfo.value.placeName,
    coordinates: locationInfo.value.coordinates,
  };
  event.dataTransfer.setData('application/x-geo-place', JSON.stringify(payload));
};

const handleSelectionToolbarDragStart = (event) => {
  if (!isSelectingMultipleLocations.value) return;
  if (!event.dataTransfer) return;
  const payload = {
    cardId: props.cardId,
    locations: selectedLocations.value.map((loc) => ({
      placeName: loc.placeName,
      coordinates: loc.coordinates,
    })),
    description: spatialRelationshipResult.value,
  };
  event.dataTransfer.setData('application/x-geo-multiple-places', JSON.stringify(payload));
};

const closeLocationInfo = () => {
  locationInfoVisible.value = false;
  locationInfoLoading.value = false;
  locationInfo.value = {
    placeName: '',
    address: '',
    context: [],
    coordinates: { lng: 0, lat: 0 },
  };
};

const addDescriptionToTextBlock = () => {
  EventBus.emit('append-description', {
    description: styleForm.selectedDescription,
    cardId: props.cardId,
  });
};

const closeStylePopup = () => {
  // applyStylePopup();
  stylePopupVisible.value = false;
  stylePopupTarget.value = null;
  stylePopupType.value = null;
  styleForm.selectedDescription = null;
  generatedDescriptions.value = [];
  clearMapHighlight();
};

const openStylePopup = (
  type,
  entity,
  point,
  isCategoricalOrNumerical = null,
  isWaypoint = null
) => {
  if (!mapInstance.value || !entity) return;
  stylePopupType.value = type;
  stylePopupTarget.value = { id: entity.id, isCategoricalOrNumerical: isCategoricalOrNumerical };

  if (type === 'point') {
    styleForm.pointColor = entity.color || '#FF0000';
    styleForm.pointRadius = entity.radius ?? 6;
    styleForm.pointIconSize = entity.iconSize ?? 1;
    styleForm.pointSubtype = entity.type ?? 0;
    styleForm.isWaypoint = isWaypoint ?? null;
  } else if (type === 'line') {
    styleForm.strokeColor = entity.strokeColor || '#000000';
    styleForm.strokeWidth = entity.strokeWidth ?? 4;
    styleForm.strokeOpacity = entity.strokeOpacity ?? 1.0;
    styleForm.strokeType = entity.strokeType ?? 0;
    styleForm.dashArray = entity.dashArray ?? [2, 3];
    if (entity.type === 0 && entity.profile) {
      styleForm.lineProfile = entity.profile;
    } else {
      styleForm.lineProfile = null;
    }
  } else if (type === 'area') {
    styleForm.areaFillColor = entity.fillColor || '#ffffff';
    styleForm.areaFillOpacity = entity.fillOpacity ?? 0.5;
    styleForm.areaBorderColor = entity.borderColor || '#000000';
    styleForm.areaBorderWidth = entity.borderWidth ?? 2;
    styleForm.areaRadius = entity.radius ?? 0;
    styleForm.height = entity.height ?? null;
    styleForm.isMaskHighlight = entity.isMaskHighlight ?? false;
    styleForm.areaSubtype = entity.type ?? 0;
    // styleForm.isMaskHighlight = maskHighlightList.value.includes(entity.id);
  }
  styleForm.selectedDescription = entity.description ?? null;
  nextTick(() => autoResizeDescriptions());

  stylePopupVisible.value = true;
};

const applyStylePopup = () => {
  if (!stylePopupVisible.value || !stylePopupTarget.value || !mapInstance.value) return;
  const targetId = stylePopupTarget.value.id;
  const isCategoricalOrNumerical = stylePopupTarget.value.isCategoricalOrNumerical;
  try {
    if (stylePopupType.value === 'point') {
      const payload = {
        fill: styleForm.pointColor,
      };
      if (styleForm.pointSubtype === 0) {
        payload.radius = Math.max(1, safeNumber(styleForm.pointRadius, 6));
      } else {
        payload.iconSize = Math.max(0.1, safeNumber(styleForm.pointIconSize, 1));
      }
      const typeName =
        styleForm.pointSubtype === 0
          ? 'dot'
          : styleForm.pointSubtype === 1
            ? 'marker'
            : 'other icon';
      if (isCategoricalOrNumerical.includes('Categorical')) {
        const categoricalStore = CategoricalStore.getByType(props.cardId, typeName);
        const id1s = categoricalStore ? categoricalStore.id1s : [];
        const id2s = categoricalStore ? categoricalStore.id2s : [];
        const returnIds = id1s.includes(targetId) ? id1s : id2s;
        updateCategoricalPointStyle(
          mapInstance.value,
          props.cardId,
          isCategoricalOrNumerical,
          returnIds,
          payload
        );
      } else if (isCategoricalOrNumerical.includes('Numerical')) {
        const newColors = getMinMaxColorByNumericalData(
          props.cardId,
          typeName,
          targetId,
          styleForm.pointColor
        );
        const newPayload = {
          minColor: newColors.minColor,
          maxColor: newColors.maxColor,
          radius: payload.radius,
          iconSize: payload.iconSize,
        };
        updateNumericalPointStyle(
          mapInstance.value,
          props.cardId,
          typeName,
          newColors.numericalIds,
          newPayload
        );
      } else if (styleForm.isWaypoint) {
        const lineId = styleForm.isWaypoint;
        const line = LineStore.getById(props.cardId, lineId);
        if (line) {
          const waypoints = line.waypoints || [];
          const idx = waypoints.findIndex((wp) => wp === targetId);
          if (idx === -1) return;
          if (idx === 0 || idx === waypoints.length - 1) {
            // Start or end of the polyline.
            payload.description = styleForm.selectedDescription;
            updatePointStyle(mapInstance.value, props.cardId, targetId, payload);
          } else {
            // Intermediate waypoint: re-style every middle point.
            const midWaypoints = waypoints.slice(1, waypoints.length - 1);
            midWaypoints.forEach((wp) => {
              updatePointStyle(mapInstance.value, props.cardId, wp, payload);
            });
          }
        }
      } else {
        payload.description = styleForm.selectedDescription;
        updatePointStyle(mapInstance.value, props.cardId, targetId, payload);
      }
    } else if (stylePopupType.value === 'line') {
      const payload = {
        strokeColor: styleForm.strokeColor,
        strokeWidth: Math.max(1, safeNumber(styleForm.strokeWidth, 3)),
        strokeType: Number(styleForm.strokeType) || 0,
        dashArray: styleForm.dashArray,
        description: styleForm.selectedDescription,
        profile: styleForm.lineProfile,
        strokeOpacity: clamp(Number(styleForm.strokeOpacity) || 1.0, 0, 1),
      };
      updateLineStyle(mapInstance.value, props.cardId, targetId, payload);
    } else if (stylePopupType.value === 'area') {
      const payload = {
        fillColor: styleForm.areaFillColor,
        fillOpacity: clamp(Number(styleForm.areaFillOpacity) || 0.5, 0, 1),
        borderColor: styleForm.areaBorderColor,
        borderWidth: Math.max(0, safeNumber(styleForm.areaBorderWidth, 1)),
        description: styleForm.selectedDescription,
        radius: Math.max(0, safeNumber(styleForm.areaRadius, 0)),
        height: styleForm.height ? Math.max(0, safeNumber(styleForm.height, 0)) : null,
        isMaskHighlight: styleForm.isMaskHighlight,
      };
      const typeName = styleForm.areaSubtype === 0 ? 'irregular area' : 'regular shape';
      if (isCategoricalOrNumerical.includes('Categorical')) {
        const categoricalStore = CategoricalStore.getByType(props.cardId, typeName);
        const id1s = categoricalStore ? categoricalStore.id1s : [];
        const id2s = categoricalStore ? categoricalStore.id2s : [];
        const returnIds = id1s.includes(targetId) ? id1s : id2s;
        updateCategoricalAreaStyle(
          mapInstance.value,
          props.cardId,
          isCategoricalOrNumerical,
          returnIds,
          payload
        );
        returnIds.forEach((id) => {
          if (styleForm.isMaskHighlight) {
            changeToMaskHighlight(mapInstance.value, props.cardId, id);
          } else {
            removeMaskHighlight(mapInstance.value, props.cardId, id);
          }
        });
      } else if (isCategoricalOrNumerical.includes('Numerical')) {
        const newColors = getMinMaxColorByNumericalData(
          props.cardId,
          typeName,
          targetId,
          styleForm.areaFillColor
        );
        const newPayload = {
          minColor: newColors.minColor,
          maxColor: newColors.maxColor,
          fillOpacity: payload.fillOpacity,
          borderColor: payload.borderColor,
          borderWidth: payload.borderWidth,
          radius: payload.radius,
          isMaskHighlight: payload.isMaskHighlight,
        };
        updateNumericalAreaStyle(
          mapInstance.value,
          props.cardId,
          typeName,
          newColors.numericalIds,
          newPayload
        );

        if (styleForm.isMaskHighlight && !isMap3DMode(props.cardId)) {
          newColors.numericalIds.forEach((id) => {
            changeToMaskHighlight(mapInstance.value, props.cardId, id);
          });
        } else {
          newColors.numericalIds.forEach((id) => {
            removeMaskHighlight(mapInstance.value, props.cardId, id);
          });
        }
      } else {
        updateAreaStyle(mapInstance.value, props.cardId, targetId, payload);
        if (styleForm.isMaskHighlight) {
          changeToMaskHighlight(mapInstance.value, props.cardId, targetId);
        } else {
          removeMaskHighlight(mapInstance.value, props.cardId, targetId);
        }
      }
    }
  } finally {
    // Notify the matching TextBlock so it can re-derive descriptive text.
    EventBus.emit(`update-objects-by-type-${props.cardId}`, stylePopupType.value);
  }
};

const handleExistingFeatureClick = (event) => {
  if (!mapInstance.value) return false;
  const features = mapInstance.value.queryRenderedFeatures(event.point);
  if (!features || !features.length) return false;
  for (const feature of features) {
    const layerId = feature?.layer?.id;
    if (!layerId) continue;
    const point = PointStore.getById(props.cardId, layerId);
    if (point) {
      openStylePopup('point', point, event.point, point.isCategoricalOrNumerical, point.isWaypoint);
      return true;
    }

    const line = LineStore.getById(props.cardId, layerId);
    if (line) {
      openStylePopup('line', line, event.point);
      return true;
    }

    const area = AreaStore.getById(props.cardId, layerId);
    if (area) {
      openStylePopup('area', area, event.point, area.isCategoricalOrNumerical);
      return true;
    }
  }
  return false;
};

const isAddingMarker = ref(false);
const isAddingDot = ref(false);
const isAddingLine = ref(false);
const linePoints = ref([]);
const isAddingDirection = ref(false);
const directionPoints = ref([]);
const isAddingRoute = ref(false);
const routePoints = ref([]);
const drawingRouteLineId = ref(null);
const isAddingPolygon = ref(false);
const polygonPoints = ref([]);
const polygonID = ref(null);
const isDrawingRect = ref(false);
const startDrawRectPoint = ref(null);
const isAddingTexture = ref(false);
const inputTexturePosition = ref({ x: 0, y: 0 });
const inputTextureValue = ref('');
const textureInputRef = ref(null);
const isAddingCircle = ref(false);
const circleCenter = ref(null);
// Default radius for newly drawn circles (meters).
const circleRadius = ref(500);
const isSearch = ref(false);
const searchAddress = ref('');
const searchAddresses = ref([]);
const wayPointsForSearch = ref([]);

const addTextLabelToMap = (lng, lat, text) => {
  if (!mapInstance.value || !text) return;
  // Render via a custom HTML mapboxgl.Marker.
  addTextByCoordinates(mapInstance.value, props.cardId, { lng, lat }, text);
};

const handleTextureInputEnter = (e) => {
  if (!inputTextureValue.value.trim()) return;
  // Resolve the geographic coordinates of the input box.
  const { lng, lat } = inputTexturePositionGeo.value;
  addTextLabelToMap(lng, lat, inputTextureValue.value.trim());
  resetTextureInput();
};

const resetTextureInput = () => {
  isAddingTexture.value = false;
  inputTexturePosition.value = { x: 0, y: 0 };
  inputTexturePositionGeo.value = { lng: 0, lat: 0 };
  inputTextureValue.value = '';
};

const inputTexturePositionGeo = ref({ lng: 0, lat: 0 });

const iconFileInput = ref(null);
const isAddingCustomIcon = ref(false);
const pendingCustomIconName = ref(null);
const customIconCache = new Map();
const CUSTOM_ICONS_STORAGE_KEY = `custom-icons-${props.cardId}`;

// Restore custom-icon images previously saved to localStorage.
const loadCustomIconsFromStorage = () => {
  try {
    const stored = localStorage.getItem(CUSTOM_ICONS_STORAGE_KEY);
    if (stored) {
      const icons = JSON.parse(stored);
      icons.forEach(({ name, dataUrl }) => {
        const img = new Image();
        img.onload = () => {
          customIconCache.set(name, img);
          reAddCustomIcons();
        };
        img.src = dataUrl;
      });
    }
  } catch (error) {
    console.error('Failed to load custom icons from storage:', error);
  }
};

// Persist a custom icon (data URL) to localStorage so it survives reloads.
const saveCustomIconToStorage = (iconName, dataUrl) => {
  try {
    const stored = localStorage.getItem(CUSTOM_ICONS_STORAGE_KEY) || '[]';
    const icons = JSON.parse(stored);

    // Drop any existing entry with the same name first.
    const filtered = icons.filter((icon) => icon.name !== iconName);

    filtered.push({ name: iconName, dataUrl });

    localStorage.setItem(CUSTOM_ICONS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to save custom icon to storage:', error);
  }
};

const isResizing = ref(false);
const startY = ref(0);
const startHeight = ref(0);
const mapStyleIdx = ref(0);

const onMouseMove = (event) => {
  if (!isResizing.value) return;
  const delta = event.clientY - startY.value;
  const newHeight = Math.max(150, startHeight.value + delta);
  mapHeight.value = newHeight;
  if (mapInstance.value) {
    mapInstance.value.resize();
  }
};

const onMouseUp = () => {
  if (!isResizing.value) return;
  isResizing.value = false;
};

const reAddCustomIcons = () => {
  if (!mapInstance.value) return;
  customIconCache.forEach((image, name) => {
    if (!mapInstance.value.hasImage(name)) {
      mapInstance.value.addImage(name, image);
    }
  });
};

const registerCustomIcon = (iconName, image) => {
  if (!mapInstance.value) return;
  if (mapInstance.value.hasImage(iconName)) {
    mapInstance.value.removeImage(iconName);
  }
  mapInstance.value.addImage(iconName, image);
  customIconCache.set(iconName, image);
};

const resetInteractionModes = () => {
  isAddingDot.value = false;
  isAddingMarker.value = false;
  isAddingDirection.value = false;
  isAddingRoute.value = false;
  isAddingLine.value = false;
  isDrawingRect.value = false;
  isAddingCustomIcon.value = false;
  pendingCustomIconName.value = null;
  routePoints.value = [];
  drawingRouteLineId.value = null;
  directionPoints.value = [];
  linePoints.value = [];
  startDrawRectPoint.value = null;
  isAddingPolygon.value = false;
  polygonPoints.value = [];
  polygonID.value = null;
  isAddingTexture.value = false;
  inputTexturePosition.value = { x: 0, y: 0 };
  inputTextureValue.value = '';
  isAddingCircle.value = false;
  circleCenter.value = null;
  isSearch.value = false;
  searchAddress.value = '';
  wayPointsForSearch.value = [''];
  searchAddresses.value = [];
};

const activateCustomIconPlacement = (iconName) => {
  resetInteractionModes();
  pendingCustomIconName.value = iconName;
  isAddingCustomIcon.value = true;
};

const openIconUploadDialog = () => {
  if (!mapInstance.value) return;
  iconFileInput.value?.click();
};

const onIconFileSelected = (event) => {
  const files = event.target.files;
  const file = files && files[0];
  if (!file || !mapInstance.value) {
    return;
  }
  const mimeType = file.type.toLowerCase();
  if (!(mimeType === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg'))) {
    console.warn('Please choose an SVG image file');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const imageSrc = reader.result;
    const img = new Image();
    img.onload = () => {
      const iconName = `custom-icon-${Date.now()}`;
      registerCustomIcon(iconName, img);
      saveCustomIconToStorage(iconName, imageSrc);
      activateCustomIconPlacement(iconName);
    };
    img.onerror = (err) => {
      console.error('Failed to load custom icon image', err);
    };
    img.src = imageSrc;
  };
  reader.onerror = (err) => {
    console.error('Failed to read icon file', err);
  };
  reader.readAsDataURL(file);
  event.target.value = '';
};

const highlightedLayers = ref([]);

// Highlight a map feature in response to a hover/click on related text.
const highlightMapLayer = (type, layerId) => {
  if (!mapInstance.value) return;

  const layer = mapInstance.value.getLayer(layerId);
  if (!layer) {
    console.warn(`Layer not found: ${layerId}`);
    return;
  }

  try {
    if (type === 'point') {
      const point = PointStore.getById(props.cardId, layerId);
      if (!point) {
        console.warn(`Point not found in store: ${layerId}`);
        return;
      }

      // Apply a "halo" by enlarging the marker / outlining the circle.
      if (point.type === 0) {
        // Plain dot.
        mapInstance.value.setPaintProperty(layerId, 'circle-radius', point.radius * 1.5);
        mapInstance.value.setPaintProperty(layerId, 'circle-stroke-width', 3);
        mapInstance.value.setPaintProperty(layerId, 'circle-stroke-color', '#ffeb3b');
        mapInstance.value.setPaintProperty(layerId, 'circle-stroke-opacity', 1);
        mapInstance.value.setPaintProperty(layerId, 'circle-blur', 0);
      } else if (point.type === 1) {
        // Built-in marker icon: enlarge by 1.5x.
        mapInstance.value.setLayoutProperty(layerId, 'icon-size', point.iconSize * 1.5);
      } else if (point.type === 2) {
        // Custom icon: enlarge by 1.5x.
        mapInstance.value.setLayoutProperty(layerId, 'icon-size', point.iconSize * 1.5);
      }

      // Pan the map to the highlighted point.
      if (isMap3DMode(props.cardId)) {
        mapInstance.value.flyTo({
          center: [point.coordinates.lng, point.coordinates.lat],
          zoom: Math.max(mapInstance.value.getZoom(), 12),
          pitch: 60,
          bearing: -10,
          duration: 500,
        });
        mapInstance.value.setFog({
          range: [0.5, 10],
          color: '#242b3b',
          'horizon-blend': 0.1,
        });
      } else {
        mapInstance.value.flyTo({
          center: [point.coordinates.lng, point.coordinates.lat],
          zoom: Math.max(mapInstance.value.getZoom(), 10),
          duration: 500,
        });
      }

      highlightedLayers.value.push({ type, layerId, point });
    } else if (type === 'line') {
      const line = LineStore.getById(props.cardId, layerId);
      if (!line) {
        console.warn(`Line not found in store: ${layerId}`);
        return;
      }

      // Apply a "halo" by enlarging the line and tinting it yellow.
      mapInstance.value.setPaintProperty(layerId, 'line-width', line.strokeWidth * 1.5);
      mapInstance.value.setPaintProperty(layerId, 'line-blur', 2);
      mapInstance.value.setPaintProperty(layerId, 'line-color', '#ffeb3b');

      // Pan the map to the line's first waypoint.
      if (line.waypoints && Array.isArray(line.waypoints) && line.waypoints.length > 0) {
        const firstWaypoint = PointStore.getById(props.cardId, line.waypoints[0]);
        if (
          firstWaypoint &&
          firstWaypoint.coordinates &&
          Array.isArray(firstWaypoint.coordinates) &&
          firstWaypoint.coordinates.length === 2
        ) {
          if (isMap3DMode(props.cardId)) {
            mapInstance.value.flyTo({
              center: [firstWaypoint.coordinates[0], firstWaypoint.coordinates[1]],
              zoom: Math.max(mapInstance.value.getZoom(), 12),
              pitch: 60,
              bearing: -10,
              duration: 500,
            });
            mapInstance.value.setFog({
              range: [0.5, 10],
              color: '#242b3b',
              'horizon-blend': 0.1,
            });
          } else {
            mapInstance.value.flyTo({
              center: [firstWaypoint.coordinates[0], firstWaypoint.coordinates[1]],
              zoom: Math.max(mapInstance.value.getZoom(), 10),
              duration: 500,
            });
          }
        }
      }

      highlightedLayers.value.push({ type, layerId, line });
    } else if (type === 'area') {
      const area = AreaStore.getById(props.cardId, layerId);
      if (!area) {
        console.warn(`Area not found in store: ${layerId}`);
        return;
      }

      const outlineId = `${layerId}-outline`;
      // Thicken and recolor the outline to draw attention.
      mapInstance.value.setPaintProperty(outlineId, 'line-width', area.borderWidth * 2);
      mapInstance.value.setPaintProperty(outlineId, 'line-color', '#ffeb3b');

      const bounds = new mapboxgl.LngLatBounds(
        [area.boundingbox[2], area.boundingbox[0]],
        [area.boundingbox[3], area.boundingbox[1]]
      );
      if (isMap3DMode(props.cardId)) {
        const newHeight = area.height * 1.1 > 50 ? area.height * 1.1 : 50;
        mapInstance.value.setPaintProperty(layerId, 'fill-extrusion-height', newHeight);

        mapInstance.value.fitBounds(bounds, {
          padding: 20,
          pitch: 60,
          bearing: -10,
        });
        mapInstance.value.setFog({
          range: [0.5, 10],
          color: '#242b3b',
          'horizon-blend': 0.1,
        });
      } else {
        mapInstance.value.fitBounds(bounds, { padding: 20 });
      }
      highlightedLayers.value.push({ type, layerId, area });
    }
  } catch (error) {
    console.error('Error highlighting map layer:', error, { type, layerId });
  }
};

// Reverse the highlight applied by highlightMapLayer.
const clearMapHighlight = () => {
  if (!mapInstance.value) return;

  highlightedLayers.value.forEach(({ type, layerId, point, line, area }) => {
    try {
      const layer = mapInstance.value.getLayer(layerId);
      if (!layer) {
        console.warn(`Layer not found when clearing highlight: ${layerId}`);
        return;
      }

      if (type === 'point' && point) {
        if (point.type === 0) {
          // Plain dot.
          mapInstance.value.setPaintProperty(layerId, 'circle-radius', point.radius);
          mapInstance.value.setPaintProperty(layerId, 'circle-stroke-width', 2);
          mapInstance.value.setPaintProperty(layerId, 'circle-stroke-color', point.color);
          mapInstance.value.setPaintProperty(layerId, 'circle-stroke-opacity', 0.3);
          mapInstance.value.setPaintProperty(layerId, 'circle-blur', 0.2);
        } else if (point.type === 1) {
          // Built-in marker icon.
          mapInstance.value.setLayoutProperty(layerId, 'icon-size', point.iconSize);
        } else if (point.type === 2) {
          // Custom icon.
          mapInstance.value.setLayoutProperty(layerId, 'icon-size', point.iconSize);
        }
      } else if (type === 'line' && line) {
        mapInstance.value.setPaintProperty(layerId, 'line-width', line.strokeWidth);
        mapInstance.value.setPaintProperty(layerId, 'line-blur', 0);
        mapInstance.value.setPaintProperty(layerId, 'line-color', line.strokeColor);
      } else if (type === 'area' && area) {
        const outlineId = `${layerId}-outline`;
        mapInstance.value.setPaintProperty(outlineId, 'line-width', area.borderWidth);
        mapInstance.value.setPaintProperty(outlineId, 'line-color', area.borderColor);
        if (isMap3DMode(props.cardId)) {
          mapInstance.value.setPaintProperty(layerId, 'fill-extrusion-height', area.height);
        }
      }
    } catch (error) {
      console.error('Error clearing map highlight:', error, { type, layerId });
    }
  });

  highlightedLayers.value = [];
  EventBus.emit(`hover-map-object-${props.cardId}`);
};

// Convert a hex color code into a coarse human-readable color name.
const hexToColorName = (hex) => {
  if (!hex) return '';
  hex = hex.toLowerCase().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return '';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Bucket the (r, g, b) triple into a small set of named colors.
  if (r > 230 && g > 230 && b < 100) return 'Light Yellow';
  if (r > 200 && g > 200 && b < 100) return 'Yellow';
  if (r > 200 && g > 200 && b > 200) return 'White';
  if (r > 200 && g < 100 && b < 100) return 'Red';
  if (r > 200 && g < 150 && b > 150) return 'Pink';
  if (r > 200 && g > 150 && g < 200 && b < 100) return 'Orange';
  if (r < 100 && g > 200 && b < 100) return 'Green';
  if (r < 100 && g > 200 && b > 100 && b < 200) return 'Teal';
  if (r < 100 && g > 200 && b > 200) return 'Cyan';
  if (r < 100 && g < 100 && b > 200) return 'Blue';
  if (r < 100 && g > 100 && g < 200 && b > 200) return 'Sky Blue';
  if (r < 100 && g < 100 && b > 230) return 'Deep Blue';
  if (r < 50 && g < 50 && b < 50) return 'Black';
  if (r > 100 && r < 200 && g > 100 && g < 200 && b > 100 && b < 200) return 'Gray';
  if (r < 100 && g > 150 && b < 100) return 'Dark Green';
  if (r > 200 && g > 200 && b < 50) return 'Gold';
  return hex;
};

const generateDescriptions = async () => {
  if (!mapInstance.value || !stylePopupTarget.value) return;

  const targetId = stylePopupTarget.value.id;
  const targetType = stylePopupType.value;
  const target =
    targetType === 'point'
      ? PointStore.getById(props.cardId, targetId)
      : targetType === 'line'
        ? LineStore.getById(props.cardId, targetId)
        : AreaStore.getById(props.cardId, targetId);
  if (!target) {
    console.error('Target not found:', targetId, targetType);
    return;
  }
  EventBus.emit('start-loading', 'Generating descriptions...');
  const geo_element = {
    type: targetType,
    addressName: target.addressName,
  };

  if (targetType === 'point') {
    geo_element.coordinates = target.coordinates;
    geo_element.radius = target.radius;
    geo_element.iconSize = target.iconSize;
    if (target.iconImage) {
      geo_element.iconImage = target.iconImage;
    }
  } else if (targetType === 'line') {
    const waypoints = target.waypoints.map((waypointId) =>
      PointStore.getById(props.cardId, waypointId)
    );
    geo_element.waypoints = waypoints.map((waypoint) => ({
      coordinates: waypoint.coordinates,
      addressName: waypoint.addressName,
    }));
    geo_element.strokeColor = target.strokeColor;
    geo_element.strokeWidth = target.strokeWidth;
    geo_element.strokeType = target.strokeType;
  } else if (targetType === 'area') {
    if (target.points) {
      const points = target.points.map((pointId) => PointStore.getById(props.cardId, pointId));
      geo_element.points = points.map((point) => ({
        coordinates: point.coordinates,
        addressName: point.addressName,
      }));
    }
    geo_element.fillColor = target.fillColor;
    geo_element.fillOpacity = target.fillOpacity;
    geo_element.borderColor = target.borderColor;
    geo_element.borderWidth = target.borderWidth;
  }
  if (geo_element.fillColor && geo_element.fillColor[0] === '#') {
    geo_element.fillColorName = hexToColorName(geo_element.fillColor);
  }
  if (geo_element.borderColor && geo_element.borderColor[0] === '#') {
    geo_element.borderColorName = hexToColorName(geo_element.borderColor);
  }
  try {
    const descriptions = await generate_textual_descriptions_for_geo_element(
      props.content,
      geo_element
    );
    if (descriptions) {
      generatedDescriptions.value = descriptions;
    } else {
      console.error('Error generating descriptions:', descriptions);
    }
  } catch (error) {
    console.error('Error generating descriptions:', error);
  }
  EventBus.emit('loading-done');
};

const handleDescriptionDblClick = (description) => {
  // The description may be either a plain string or an object with a text field.
  let text = '';
  if (typeof description === 'string') {
    text = description;
  } else if (description && typeof description === 'object') {
    text = description.text || description.description || String(description);
  }
  text = (text || '').trim();
  if (!text) return;

  styleForm.selectedDescription = text;
  generatedDescriptions.value = [];
  nextTick(() => autoResizeDescriptions());
};

const isSelectingMultipleLocations = ref(false);
// Tracks { lng, lat, placeName, zoom } for each clicked location.
const selectedLocations = ref([]);
const spatialRelationshipPopupVisible = ref(false);
const spatialRelationshipResult = ref('');

const startSelectingLocations = () => {
  resetInteractionModes();
  isSelectingMultipleLocations.value = true;
  selectedLocations.value = [];
};

const cancelSelectingLocations = () => {
  isSelectingMultipleLocations.value = false;
  selectedLocations.value = [];
  clearAllSelectedLocationPoints(mapInstance.value, props.cardId);
};

const closeSpatialRelationshipPopup = () => {
  spatialRelationshipPopupVisible.value = false;
  spatialRelationshipResult.value = '';
};

const handleMultiLocationSelect = async (event) => {
  if (!isSelectingMultipleLocations.value || !mapInstance.value) return;
  const lng = event.lngLat.lng;
  const lat = event.lngLat.lat;
  addPointByCoordinates(
    mapInstance.value,
    [
      {
        lng: lng,
        lat: lat,
        color: '#000033',
      },
    ],
    0,
    null,
    props.cardId,
    'selected-location'
  );

  try {
    const zoom = mapInstance.value.getZoom();
    const result = await reverseGeocode(props.cardId, lng, lat, zoom);
    selectedLocations.value.push({
      placeName: result.placeName,
      coordinates: { lng, lat },
      lng,
      lat,
      zoom: zoom,
    });
  } catch (error) {
    console.error('Failed to fetch geographic info:', error);
    selectedLocations.value.push({
      placeName: `(${lng.toFixed(5)}, ${lat.toFixed(5)})`,
      coordinates: { lng, lat },
      lng,
      lat,
      zoom: zoom,
    });
  }
};

const generateSpatialRelationshipDescriptions = async () => {
  if (selectedLocations.value.length < 2) {
    alert('Please select at least two locations');
    return;
  }
  EventBus.emit('start-loading', 'Generating descriptions...');
  spatialRelationshipPopupVisible.value = true;
  try {
    // Collect the selected locations for the backend request.
    const locationsData = selectedLocations.value.map((loc, idx) => ({
      index: idx,
      placeName: loc.placeName,
      coordinates: { lng: loc.lng, lat: loc.lat },
      zoom: loc.zoom,
    }));

    const place_names = locationsData.map((loc) => loc.placeName).join('; ');

    // Call backend API
    const result = await generate_descriptions_of_spatial_relationships(place_names);
    if (result) {
      spatialRelationshipResult.value = result;
    } else {
      spatialRelationshipResult.value = '';
    }
  } catch (error) {
    console.error('Failed to generate spatial-relationship descriptions:', error);
    spatialRelationshipResult.value = `Error: ${error.message}`;
  }
  EventBus.emit('loading-done');
};

const addSelectedLocationToText = () => {
  if (!spatialRelationshipResult.value) return;
  EventBus.emit('append-description', {
    description: spatialRelationshipResult.value,
    cardId: props.cardId,
  });
  closeSpatialRelationshipPopup();
  cancelSelectingLocations();
  clearAllSelectedLocationPoints(mapInstance.value, props.cardId);
};

const startAddCircle = () => {
  resetInteractionModes();
  isAddingCircle.value = true;
  circleCenter.value = null;
};

const handleMapClickForCircle = (e) => {
  if (!isAddingCircle.value) return false;
  if (!circleCenter.value) {
    circleCenter.value = { lng: e.lngLat.lng, lat: e.lngLat.lat };
    // TODO: expose a UI control for the radius.
    circleRadius.value = 500;
    addCircleByCoordinates(
      mapInstance.value,
      circleCenter.value,
      circleRadius.value,
      '#3388ff',
      0.4,
      props.cardId
    );
    isAddingCircle.value = false;
    circleCenter.value = null;
    return true;
  }
  return false;
};

const handleHoverOnObject = (layerId) => {
  clearMapHighlight();
  const point = PointStore.getById(props.cardId, layerId);
  let payload = null;
  if (point) {
    const addresses = [];
    if (point.addressName) {
      point.addressName
        .split(',')
        .map((s) => s.trim())
        .forEach((addr) => {
          if (addr) addresses.push(addr);
        });
    }
    payload = {
      type: 'point',
      id: point.id,
      addresses,
    };
    return payload;
  }

  // Then try to match an area.
  const area = AreaStore.getById(props.cardId, layerId);
  if (area) {
    const addresses = [];
    if (area.addressName) {
      area.addressName
        .split(',')
        .map((s) => s.trim())
        .forEach((addr) => {
          if (addr) addresses.push(addr);
        });
    } else if (area.points) {
      area.points.forEach((pointId) => {
        const point = PointStore.getById(props.cardId, pointId);
        if (point && point.addressName) {
          point.addressName
            .split(',')
            .map((s) => s.trim())
            .forEach((addr) => {
              if (addr) addresses.push(addr);
            });
        }
      });
    }
    payload = {
      type: 'area',
      id: area.id,
      addresses,
    };
    return payload;
  }

  // Finally try to match a line (route / direction / plain line).
  const line = LineStore.getById(props.cardId, layerId);
  if (line) {
    if (line.type === 1) {
      const geoLineName = line.geoLineName;
      payload = {
        type: 'line',
        id: line.id,
        addresses: geoLineName ? [geoLineName] : [],
      };
    } else {
      const addresses = [];
      if (line.waypoints && line.waypoints.length > 0) {
        line.waypoints.forEach((waypointId) => {
          const waypoint = PointStore.getById(props.cardId, waypointId);
          if (waypoint && waypoint.addressName) {
            waypoint.addressName
              .split(',')
              .map((s) => s.trim())
              .forEach((addr) => {
                if (addr) addresses.push(addr);
              });
          }
        });
      }
      payload = {
        type: 'line',
        id: line.id,
        addresses,
      };
    }
    return payload;
  }
  return null;
};

const handleNoColorPosition = (cardId, data) => {
  clearMapHighlight();
  const layerId = data.layerId;
  const payload = handleHoverOnObject(layerId);
  if (!payload) return;
  EventBus.emit(`hover-map-object-${cardId}`, payload);
  highlightMapLayer(payload.type, layerId);
};

// EventBus handlers (named so they can be detached on unmount).
const handleUpdatePointStyle = (data) => {
  if (mapInstance.value) {
    updatePointStyle(mapInstance.value, props.cardId, data.pointId, data.style);
  }
};

const handleUpdateLineStyle = (data) => {
  if (mapInstance.value) {
    updateLineStyle(mapInstance.value, props.cardId, data.lineId, data.style);
  }
};

const handleUpdateAreaStyle = (data) => {
  if (mapInstance.value) {
    updateAreaStyle(mapInstance.value, props.cardId, data.areaId, data.style);
  }
};

const handleUpdatePurpose = (data) => {
  if (mapInstance.value) {
    updatePurpose(mapInstance.value, props.cardId, data);
  }
};

const handleRemovePromptType = (data) => {
  if (mapInstance.value) {
    removeElementByType(mapInstance.value, props.cardId, data);
  }
  EventBus.emit(`highlight-text-${props.cardId}`);
};

const handleHoverTextAddress = (payload) => {
  if (!mapInstance.value) return;
  clearMapHighlight();
  if (!payload || !payload.layerIds || payload.layerIds.length === 0) {
    return;
  }
  payload.layerIds.forEach(({ type, layerId }) => {
    highlightMapLayer(type, layerId);
  });
};

const handleUpdateMapObjectsBySubType = (data) => {
  if (mapInstance.value) {
    updateChangedSubType(mapInstance.value, props.cardId, data, props.content);
  }
};

const handleUpdateMapObjectsByMajorType = (data) => {
  if (mapInstance.value) {
    updateChangedMajorType(mapInstance.value, props.cardId, data, props.content);
  }
};

const handleDeleteObject = (data) => {
  if (mapInstance.value) {
    removeElementById(mapInstance.value, props.cardId, data.objectId, data.objectType);
    EventBus.emit(`highlight-text-${props.cardId}`);
  }
};

const handleRemovePurposeData = (data) => {
  if (mapInstance.value) {
    const { type, targetPurpose } = data;
    removeCategoricalOrNumericalObjects(mapInstance.value, props.cardId, type, targetPurpose);
  }
};

const handleCloseGeoPlacePopup = () => {
  closeLocationInfo();
};

const handleUpdateJsonByType = (data) => {
  if (mapInstance.value) {
    updateJsonByType(props.cardId, data.type, data.json);
  }
};

const handleUpdateTrajectoryWaypoints = (data) => {
  if (mapInstance.value) {
    updateTrajectoryWaypoints(props.cardId, data.trajectoryId, data.waypoints);
  }
};

const handleUpdateCategoricalPointStyle = (data) => {
  if (mapInstance.value) {
    updateCategoricalPointStyle(
      mapInstance.value,
      props.cardId,
      data.categoricalId,
      data.pointIds,
      data.style
    );
  }
};

const handleUpdateCategoricalAreaStyle = (data) => {
  if (mapInstance.value) {
    updateCategoricalAreaStyle(
      mapInstance.value,
      props.cardId,
      data.categoricalId,
      data.areaIds,
      data.style
    );
  }
};

const handleUpdateNumericalPointStyle = (data) => {
  if (mapInstance.value) {
    updateNumericalPointStyle(
      mapInstance.value,
      props.cardId,
      data.type,
      data.pointIds,
      data.style
    );
  }
};

const handleUpdateNumericalAreaStyle = (data) => {
  if (mapInstance.value) {
    updateNumericalAreaStyle(mapInstance.value, props.cardId, data.type, data.areaIds, data.style);
  }
};

onMounted(async () => {
  // Restore any custom icons from previous sessions before initializing.
  loadCustomIconsFromStorage();

  mapInstance.value = await initMapInstance(
    props.version,
    mapID.value,
    props.content,
    props.cardId
  );
  mapInstance.value.on('load', () => {
    // 1. Recolor water bodies for a calmer base map.
    mapInstance.value.setPaintProperty('water', 'fill-color', 'rgb(204, 214, 215)');

    // 2. Recolor parks / green spaces (works against the Mapbox Streets schema).
    mapInstance.value.setPaintProperty('landuse', 'fill-color', [
      'match',
      ['get', 'class'],
      'park',
      'rgb(222, 229, 229)',
      'cemetery',
      'rgb(181, 210, 159)',
      'hospital',
      'rgb(240, 240, 240)',
      'rgb(240, 240, 240)',
    ]);
  });
  mapInstance.value.on('style.load', () => {
    if (mapInstance.value.getProjection && mapInstance.value.setProjection) {
      // Force a flat (Mercator) projection so all rendering math is 2D.
      mapInstance.value.setProjection('mercator');
    }
  });
  mapInstance.value.on('styledata', reAddCustomIcons);
  mapInstance.value.on('contextmenu', handleMapContextMenu);
  // Subscribe to per-card style update events.
  EventBus.on(`handle-no-color-position-${props.cardId}`, (data) => {
    if (mapInstance.value) {
      handleNoColorPosition(props.cardId, data);
    }
  });

  EventBus.on(`update-point-style-${props.cardId}`, handleUpdatePointStyle);
  EventBus.on(`update-categorical-point-style-${props.cardId}`, handleUpdateCategoricalPointStyle);
  EventBus.on(`update-numerical-point-style-${props.cardId}`, handleUpdateNumericalPointStyle);

  EventBus.on(`update-line-style-${props.cardId}`, handleUpdateLineStyle);

  EventBus.on(`update-area-style-${props.cardId}`, handleUpdateAreaStyle);
  EventBus.on(`update-categorical-area-style-${props.cardId}`, handleUpdateCategoricalAreaStyle);
  EventBus.on(`update-numerical-area-style-${props.cardId}`, handleUpdateNumericalAreaStyle);

  EventBus.on(`update-purpose-${props.cardId}`, handleUpdatePurpose);

  EventBus.on(`remove-prompt-type-${props.cardId}`, handleRemovePromptType);

  // Highlight matching map features when text addresses are hovered.
  EventBus.on(`hover-text-address-${props.cardId}`, handleHoverTextAddress);

  // Hover-driven highlight: resolve the feature under the cursor (point / line /
  // area) and tell the text component to highlight the corresponding address.
  mapInstance.value.on('mousemove', (e) => {
    if (!mapInstance.value) return;
    const features = mapInstance.value.queryRenderedFeatures(e.point);
    if (!features || !features.length) {
      EventBus.emit(`hover-map-object-${props.cardId}`, null);
      return;
    }

    let payload = null;

    for (const feature of features) {
      const layerId = feature?.layer?.id;
      if (!layerId) continue;
      payload = handleHoverOnObject(layerId);
      if (payload) break;
    }

    EventBus.emit(`hover-map-object-${props.cardId}`, payload);
  });

  mapInstance.value.on('mousedown', async (e) => {
    if (e.originalEvent.shiftKey) {
      e.preventDefault?.();

      if (!isSelectingMultipleLocations.value) {
        startSelectingLocations();
      }

      await handleMultiLocationSelect(e);
    }
    closeSpatialRelationshipPopup();
  });

  mapInstance.value.on('click', async (e) => {
    if (handleMapClickForCircle(e)) return;
    hideRouteMenu();
    closeLocationInfo();
    if (isAddingCustomIcon.value && pendingCustomIconName.value) {
      addPointByCoordinates(
        mapInstance.value,
        [{ lng: e.lngLat.lng, lat: e.lngLat.lat }],
        2,
        pendingCustomIconName.value,
        props.cardId
      );
      isAddingCustomIcon.value = false;
      pendingCustomIconName.value = null;
      return;
    }
    if (isAddingDot.value) {
      addPointByCoordinates(
        mapInstance.value,
        [{ lng: e.lngLat.lng, lat: e.lngLat.lat, color: '#FF0000' }],
        0,
        null,
        props.cardId
      );
      isAddingDot.value = false;
    } else if (isAddingMarker.value) {
      addPointByCoordinates(
        mapInstance.value,
        [{ lng: e.lngLat.lng, lat: e.lngLat.lat }],
        1,
        null,
        props.cardId
      );
      isAddingMarker.value = false;
    } else if (isAddingDirection.value) {
      if (directionPoints.value.length === 0) {
        addPointByCoordinates(
          mapInstance.value,
          [{ lng: e.lngLat.lng, lat: e.lngLat.lat, color: '#228B22' }],
          0,
          null,
          props.cardId,
          'drawing-point'
        );
        directionPoints.value.push([e.lngLat.lng, e.lngLat.lat]);
      } else {
        // addPointByCoordinates(mapInstance.value, [{ lng: e.lngLat.lng, lat: e.lngLat.lat, color: '#B22222' }], 0, null, props.cardId);
        directionPoints.value.push([e.lngLat.lng, e.lngLat.lat]);
        addLineByCoordinates(
          mapInstance.value,
          [
            {
              lng: directionPoints.value[0][0],
              lat: directionPoints.value[0][1],
              color: '#228B22',
            },
            {
              lng: directionPoints.value[1][0],
              lat: directionPoints.value[1][1],
              color: '#B22222',
            },
          ],
          '#003366',
          2,
          null,
          props.cardId
        );
        directionPoints.value = [];
        isAddingDirection.value = false;
        clearAllIllustrationDrawingPoints(mapInstance.value, props.cardId);
      }
    } else if (isAddingRoute.value) {
      routePoints.value.push({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      if (routePoints.value.length >= 2) {
        if (drawingRouteLineId.value) {
          removeLineByLayerId(mapInstance.value, props.cardId, drawingRouteLineId.value);
        }
        drawingRouteLineId.value = await addLineByCoordinates(
          mapInstance.value,
          routePoints.value,
          { color: '#B22222' },
          0,
          null,
          props.cardId
        );
        // clearAllIllustrationDrawingPoints(mapInstance.value, props.cardId);
      } else {
        addPointByCoordinates(
          mapInstance.value,
          [{ lng: e.lngLat.lng, lat: e.lngLat.lat }],
          0,
          null,
          props.cardId,
          'drawing-point'
        );
      }
    } else if (isDrawingRect.value) {
      startDrawRectPoint.value = [e.lngLat.lng, e.lngLat.lat];
    } else if (isAddingLine.value) {
      linePoints.value.push([e.lngLat.lng, e.lngLat.lat]);
      // ------------ draw gallery
      addPointByCoordinates(
        mapInstance.value,
        [{ lng: e.lngLat.lng, lat: e.lngLat.lat, color: '#B22222' }],
        0,
        null,
        props.cardId,
        'drawing-point'
      );
      if (linePoints.value.length >= 2) {
        const lineCoords = [];
        for (let i = 0; i < linePoints.value.length - 1; i++) {
          lineCoords.push([
            { lng: linePoints.value[i][0], lat: linePoints.value[i][1], color: '#B22222' },
            { lng: linePoints.value[i + 1][0], lat: linePoints.value[i + 1][1], color: '#B22222' },
          ]);
        }
        lineCoords.forEach((coordPair) => {
          addLineByCoordinates(mapInstance.value, coordPair, '#7B68EE', 3, null, props.cardId);
        });
        linePoints.value = [];
        isAddingLine.value = false;
        // clearAllIllustrationDrawingPoints(mapInstance.value, props.cardId);
      }
    } else if (isAddingPolygon.value) {
      polygonPoints.value.push({ lng: e.lngLat.lng, lat: e.lngLat.lat, color: '#B22222' });
      addPointByCoordinates(
        mapInstance.value,
        [{ lng: e.lngLat.lng, lat: e.lngLat.lat, color: '#B22222' }],
        0,
        null,
        props.cardId,
        'drawing-point'
      );
      if (polygonPoints.value.length >= 3) {
        if (polygonID.value) {
          removeElementById(mapInstance.value, props.cardId, polygonID.value, 'polygon');
          polygonID.value = null;
        }
        const polygonId = addPolygonByCoordinates(
          mapInstance.value,
          polygonPoints.value,
          '#000000',
          null,
          props.cardId
        );
        polygonID.value = polygonId;
      }
    } else if (isAddingTexture.value) {
      // Capture both pixel and geographic coordinates so the input box can
      // float over the click while the label is anchored to the map.
      const container = mapInstance.value.getContainer();
      const rect = container.getBoundingClientRect();
      inputTexturePosition.value = {
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
      };
      inputTexturePositionGeo.value = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      nextTick(() => {
        textureInputRef.value && textureInputRef.value.focus();
      });
      return;
    } else if (!e.originalEvent.shiftKey && !handleExistingFeatureClick(e)) {
      closeStylePopup();
    }

    EventBus.emit(`update-objects-by-type-${props.cardId}`, 'All');
  });

  // todo: add rectangle drawing mode
  mapInstance.value.on('mousemove', (e) => {
    if (isDrawingRect.value && startDrawRectPoint.value) {
      const endPoint = [e.lngLat.lng, e.lngLat.lat];

      const coords = [
        startDrawRectPoint.value,
        [endPoint[0], startDrawRectPoint.value[1]],
        endPoint,
        [startDrawRectPoint.value[0], endPoint[1]],
        // Repeat the first point to close the polygon ring.
        startDrawRectPoint.value,
      ];

      mapInstance.value.getSource('rectangle').setData({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      });
    }
  });

  mapInstance.value.on('mouseup', (e) => {
    if (isDrawingRect.value && startDrawRectPoint.value) {
      const endPoint = [e.lngLat.lng, e.lngLat.lat];

      const coords = [
        startDrawRectPoint.value,
        [endPoint[0], startDrawRectPoint.value[1]],
        endPoint,
        [startDrawRectPoint.value[0], endPoint[1]],
        // Repeat the first point to close the polygon ring.
        startDrawRectPoint.value,
      ];
      const sourceId = `rectangle`;
      const layerId = `rectangle`;
      mapInstance.value.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [coords],
          },
        },
      });

      mapInstance.value.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        layout: {},
        paint: {
          'fill-color': '#088',
          'fill-opacity': 0.5,
        },
      });

      isDrawingRect.value = false;
      startDrawRectPoint.value = null;
    }
  });

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  if (mapInstance.value) {
    mapInstance.value.off('contextmenu', handleMapContextMenu);
    mapInstance.value.off('styledata', reAddCustomIcons);
  }
  // Drop any active highlights so they don't linger after unmount.
  clearMapHighlight();
  closeStylePopup();
});

const displayMap = () => {
  const mapContainer = document.getElementById(mapContainerID.value);
  mapContainer.style.opacity = '1';
};

const hiddenMap = () => {
  const mapContainer = document.getElementById(mapContainerID.value);
  mapContainer.style.opacity = '0';
};

const changeStyle = () => {
  if (!mapInstance.value) return;

  const style = mapInstance.value.getStyle();

  // 1. Snapshot every custom Source so we can re-attach it after the style
  //    swap (Mapbox's default 'composite' source is provided by the new style).
  const prevSources = {};
  Object.keys(style.sources).forEach((id) => {
    if (id !== 'composite') {
      prevSources[id] = style.sources[id];
    }
  });

  // 2. Snapshot every custom Layer (we mark them via metadata.isCustom).
  const prevLayers = style.layers.filter((layer) => {
    return layer.metadata && layer.metadata.isCustom;
  });

  // Cycle to the next built-in style.
  mapStyleIdx.value = (mapStyleIdx.value + 1) % MAPBOX_STYLES.length;
  mapInstance.value.setStyle(MAPBOX_STYLES[mapStyleIdx.value]);

  // 3. Re-inject the snapshotted sources/layers once the new style is ready.
  mapInstance.value.once('style.load', () => {
    loadCustomImagesIntoMap(mapInstance.value);
    Object.entries(prevSources).forEach(([id, config]) => {
      if (!mapInstance.value.getSource(id)) {
        mapInstance.value.addSource(id, config);
      }
    });

    prevLayers.forEach((layer) => {
      if (!mapInstance.value.getLayer(layer.id)) {
        mapInstance.value.addLayer(layer);
      }
    });
  });
};

const changeTo3DFunc = () => {
  if (!mapInstance.value) return;
  changeTo3D(mapInstance.value, props.cardId);
};

const startAddDot = () => {
  resetInteractionModes();
  isAddingDot.value = true;
};

const startAddMarker = () => {
  resetInteractionModes();
  isAddingMarker.value = true;
};

const startAddLine = () => {
  resetInteractionModes();
  isAddingLine.value = true;
};

const startAddRoute = () => {
  if (isAddingRoute.value) {
    resetInteractionModes();
    return;
  }
  resetInteractionModes();
  isAddingRoute.value = true;
};

const startAddDirection = () => {
  resetInteractionModes();
  isAddingDirection.value = true;
};

const startDrawRect = () => {
  resetInteractionModes();
  isDrawingRect.value = true;
};

const startAddPolygon = () => {
  const formerState = isAddingPolygon.value;
  resetInteractionModes();
  isAddingPolygon.value = !formerState;
};

const startAddTexture = () => {
  resetInteractionModes();
  isAddingTexture.value = true;
};

const startAddSearch = () => {
  resetInteractionModes();
  isSearch.value = true;
};

const showDropdown = ref(false);
const selectedSearchType = ref(0);
const addRegionByAddressSafe = createRateLimitedExecutor(addRegionByAddress, 1005);

const performSearch = async () => {
  if (!isSearch.value || !mapInstance.value || !searchAddress.value) return;
  EventBus.emit('start-loading', 'Searching...');

  try {
    if (selectedSearchType.value === 0) {
      const addresses = [searchAddress.value, ...searchAddresses.value];
      newAddedId.value = await addPointByAddress(mapInstance.value, props.cardId, addresses, 1);
    } else if (selectedSearchType.value === 2) {
      const addresses = [searchAddress.value, ...searchAddresses.value];
      // Sequential await keeps geocoder rate-limits happy; do not parallelise.
      for (let i = 0; i < addresses.length; i++) {
        await addRegionByAddressSafe(mapInstance.value, props.cardId, addresses[i]);
      }
    } else {
      const addresses = [searchAddress.value, ...wayPointsForSearch.value];
      if (addresses.length < 2) {
        alert('Please add at least one waypoint for route/direction search.');
        return;
      }
      newAddedId.value = await addLineByAddress(
        mapInstance.value,
        props.cardId,
        addresses,
        { color: '#FF0000' },
        0,
        null
      );
    }
    searchAddress.value = '';
    wayPointsForSearch.value = [];
    searchAddresses.value = [];
    isSearch.value = false;
    EventBus.emit('loading-done');
    EventBus.emit(`highlight-text-${props.cardId}`);
    EventBus.emit(`update-objects-by-type-${props.cardId}`, 'All');
  } catch (error) {
    console.error('Search error:', error);
  }
};

const removeWaypoint = (index) => {
  if (index < 0 || index >= wayPointsForSearch.value.length) return;
  if (index === 0) {
    searchAddress.value = wayPointsForSearch.value[0];
    wayPointsForSearch.value.splice(0, 1);
    return;
  }
  wayPointsForSearch.value.splice(index - 1, 1);
};

const removeSearchAddress = (index) => {
  if (index < 0 || index >= searchAddresses.value.length) return;
  if (index === 0) {
    searchAddress.value = searchAddresses.value[0];
    searchAddresses.value.splice(0, 1);
    return;
  }
  searchAddresses.value.splice(index - 1, 1);
};

const addWaypoint = () => {
  wayPointsForSearch.value.push('');
};

const addSearchAddress = () => {
  searchAddresses.value.push('');
};

const newAddedId = ref(null);

const startResize = (event) => {
  const container = document.getElementById(mapContainerID.value);
  if (!container) return;
  isResizing.value = true;
  startY.value = event.clientY;
  // The visible map height is driven by the inner white .map-card element.
  const card = container.querySelector('.map-card');
  startHeight.value = card ? card.getBoundingClientRect().height : mapHeight.value;
};

const updateJsonByType = async (cardId, type, json, bbox = null) => {
  if (!mapInstance.value) {
    console.error('Map instance not found for cardId:', cardId);
    return;
  }
  const typeJson = {
    [type]: json[type],
  };
  removeElementByType(mapInstance.value, cardId, type);
  await processJsonData(mapInstance.value, typeJson, cardId, bbox, true, typeJson);
  EventBus.emit(`update-objects-by-type-${cardId}`, type);
  // Re-run text highlights so labels stay in sync with the new map state.
  EventBus.emit(`highlight-text-${cardId}`);
};

const updateTrajectoryWaypoints = async (cardId, lineId, waypoints) => {
  if (!mapInstance.value) {
    console.error('Map instance not found for cardId:', cardId);
    return;
  }
  EventBus.emit('start-loading', 'Updating trajectory waypoints...');
  const line = LineStore.getById(cardId, lineId);
  if (!line) {
    return;
  }
  const lineVisualEncoding = {
    color: line.strokeColor,
    strokeWidth: line.strokeWidth,
    lineStyle: line.strokeType,
  };
  await addLineByAddress(
    mapInstance.value,
    cardId,
    waypoints.map((wp) => wp.addressName),
    lineVisualEncoding,
    0,
    null
  );

  removeLineByLayerId(mapInstance.value, props.cardId, lineId);
  EventBus.emit(`update-objects-by-type-${cardId}`, 'trajectory');
  EventBus.emit('loading-done');
};

onMounted(() => {
  EventBus.on(`update-map-objects-by-sub-type-${props.cardId}`, handleUpdateMapObjectsBySubType);

  EventBus.on(
    `update-map-objects-by-major-type-${props.cardId}`,
    handleUpdateMapObjectsByMajorType
  );

  EventBus.on(`delete-object-${props.cardId}`, handleDeleteObject);

  EventBus.on(`remove-purpose-data-${props.cardId}`, handleRemovePurposeData);

  EventBus.on(`close-geo-place-popup-${props.cardId}`, handleCloseGeoPlacePopup);

  EventBus.on(`update-json-by-type-${props.cardId}`, handleUpdateJsonByType);

  EventBus.on(`update-trajectory-waypoints-${props.cardId}`, handleUpdateTrajectoryWaypoints);
});

onBeforeUnmount(() => {
  EventBus.off(`handle-no-color-position-${props.cardId}`);
  EventBus.off(`update-point-style-${props.cardId}`, handleUpdatePointStyle);
  EventBus.off(`update-line-style-${props.cardId}`, handleUpdateLineStyle);
  EventBus.off(`update-area-style-${props.cardId}`, handleUpdateAreaStyle);
  EventBus.off(`update-purpose-${props.cardId}`, handleUpdatePurpose);
  EventBus.off(`remove-prompt-type-${props.cardId}`, handleRemovePromptType);
  EventBus.off(`hover-text-address-${props.cardId}`, handleHoverTextAddress);
  EventBus.off(`update-map-objects-by-sub-type-${props.cardId}`, handleUpdateMapObjectsBySubType);
  EventBus.off(
    `update-map-objects-by-major-type-${props.cardId}`,
    handleUpdateMapObjectsByMajorType
  );
  EventBus.off(`delete-object-${props.cardId}`, handleDeleteObject);
  EventBus.off(`remove-purpose-data-${props.cardId}`, handleRemovePurposeData);
  EventBus.off(`close-geo-place-popup-${props.cardId}`, handleCloseGeoPlacePopup);
  EventBus.off(`update-json-by-type-${props.cardId}`, handleUpdateJsonByType);
  EventBus.off(`update-trajectory-waypoints-${props.cardId}`, handleUpdateTrajectoryWaypoints);
});
</script>

<style scoped>
.map-display {
  display: flex;
  flex-direction: row;
  flex-grow: 1;
}

.map-placeholder {
  flex-grow: 1;
  width: 100%;
  height: 100%;
  min-height: 200px;
  overflow: hidden;
}

.map-placeholder :deep(.mapboxgl-ctrl-attrib),
.map-placeholder :deep(.mapboxgl-ctrl-bottom-left),
.map-placeholder :deep(.mapboxgl-ctrl-bottom-right) {
  display: none !important;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 10%;
  background-color: #fff;
  cursor: pointer;
  border: 1px solid #ccc;
  padding: 1px;
}

.resize-handle {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 6px;
  cursor: ns-resize;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.08));
}

.route-context-menu {
  position: absolute;
  min-width: 100px;
  max-width: 110px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  padding: 6px 8px;
  z-index: 30;
}

.route-context-menu__title {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 2px;
}

.route-context-menu__item {
  width: 100%;
  text-align: left;
  border-top: 1px solid #d1d5db;
  background: transparent;
  padding: 2px 2px;
  font-size: 12px;
  color: #111827;
  cursor: pointer;
}

.route-context-menu__item:hover:not(:disabled) {
  background: #f3f4f6;
}

.route-context-menu__item:disabled {
  opacity: 0.6;
  cursor: wait;
}

.style-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.style-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 50%;
  max-width: 400px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  z-index: 1001;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.style-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.style-dialog-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
}

.style-dialog-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.style-dialog-close:hover {
  color: #1f2937;
}

.style-dialog-content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.style-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.style-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
}

.style-item label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input-wrapper input[type='color'] {
  width: 30px;
  height: 28px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
}

.color-text-input {
  flex: 1;
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  width: 120px;
}

.number-input {
  width: 120px;
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.number-input-small {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.select-input {
  width: 120px;
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  background: white;
}

.range-input {
  width: 120px;
  margin: 8px 0;
}

.range-value {
  font-size: 0.875rem;
  color: #6b7280;
  margin-left: 6px;
}

.dash-array-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.descriptions-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }
}

.descriptions-btn {
  width: 100%;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  /* background-color: #3b82f6; */
  color: white;
}

.descriptions-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s ease-in-out;
}

.descriptions-item:hover {
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.1);
}

.descriptions-item-text {
  font-size: 0.875rem;
  color: #1f2937;
  /* margin-bottom: 8px; */
}

.descriptions-title {
  font-size: 1rem;
  color: #1f2937;
  margin-bottom: 4px;
  /* font-weight: 600; */
}

.descriptions-input {
  width: 100%;
  border-radius: 4px;
  padding: 4px;
  font-size: 0.875rem;
  color: #1f2937;
  resize: none;
  overflow: auto;
  min-height: 120px;
}

.location-info-popup {
  position: fixed;
  min-width: 280px;
  max-width: 400px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  z-index: 1002;
}

.location-info-popup__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.location-info-popup__title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.location-info-popup__close {
  background: none;
  border: none;
  font-size: 20px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.location-info-popup__close:hover {
  color: #1f2937;
}

.location-info-popup__content {
  padding: 12px;
}

.location-info-popup__loading {
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
  padding: 8px 0;
}

.location-info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.location-info-item:last-child {
  margin-bottom: 0;
}

.location-info-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
}

.location-info-value {
  font-size: 0.875rem;
  color: #1f2937;
  word-break: break-word;
}

.location-info-context {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}

.location-info-context-item {
  font-size: 0.75rem;
  color: #4b5563;
  padding-left: 8px;
}

.search-bar {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 400px;
  z-index: 100;
  display: flex;
  gap: 4px;
  /* justify-items: center; */
  align-items: flex-start;
}

.search-inputs {
  width: 50%;
}

.search-input {
  width: 100%;
  padding: 4px 10px;
  border: none;
  border-radius: 5px;
  font-size: 0.875rem;
  outline: none;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #d1d5db;
  border-radius: 5px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.search-button {
  padding: 6px;
  border: none;
  border-radius: 5px;
  background: #666666d6;
  color: white;
  font-size: 0.85rem;
  width: 32px;
  height: 32px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-bar button:hover {
  background: #4b5563;
}

.selection-toolbar {
  position: absolute;
  top: 5px;
  left: 5px;
  width: 95%;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 7px 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
  gap: 5px;
  cursor: move;
}

.selection-toolbar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.selection-toolbar-close {
  position: absolute;
  top: 5px;
  right: 5px;
  background: none;
  border: none;
  font-size: 16px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.selection-info {
  font-size: 0.875rem;
  color: #374151;
}

.selection-buttons {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 2px;
}

.selection-btn {
  position: relative;
  left: auto;
  padding: 2px 8px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.selection-btn:hover {
  background-color: #2563eb;
}

.spatial-relationship-popup {
  position: fixed;
  min-width: 320px;
  max-width: 500px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  z-index: 1002;
  max-height: 400px;
  display: flex;
  flex-direction: column;
}

.spatial-relationship-popup__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.spatial-relationship-popup__title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.spatial-relationship-popup__close {
  background: none;
  border: none;
  font-size: 20px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  line-height: 1;
}

.spatial-relationship-popup__close:hover {
  color: #1f2937;
}

.spatial-relationship-popup__content {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

.spatial-relationship-popup__loading {
  text-align: center;
  color: #6b7280;
  font-size: 0.875rem;
  padding: 20px 0;
}

.spatial-relationship-result {
  font-size: 0.875rem;
  color: #1f2937;
  line-height: 1.6;
  word-break: break-word;
  margin-bottom: 12px;
}

.spatial-relationship-btn {
  width: 100%;
  padding: 8px 12px;
  background-color: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.spatial-relationship-btn:hover {
  background-color: #2563eb;
}

.texture-input-popup {
  background: transparent;
  padding: 0;
}

.texture-input-box {
  min-width: 120px;
  max-width: 220px;
  font-size: 14px;
  padding: 4px 8px;
  border: 1px solid #bbb;
  border-radius: 4px;
  outline: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.map-text-label {
  pointer-events: none;
  user-select: none;
  font-size: 14px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 4px;
  color: #222;
  padding: 2px 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  white-space: pre;
}

.dropdown-menu {
  background: #666666d6;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  padding: 3px 1px;
}
.dropdown-item {
  padding: 6px 16px;
  cursor: pointer;
}
.dropdown-item:hover {
  background: #f3f4f6;
}

.select-icon {
  width: 32px;
  height: 26px;
  padding: 2px 6px;
  border-left: 1px solid #8f8f8f;
}

.select-icon:hover {
  background: #4b5563;
  border-radius: 5px;
}
</style>
