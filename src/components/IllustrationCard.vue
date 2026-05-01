<template>
  <div class="bg-zinc-100 border border-gray-200 rounded-lg shadow-md overflow-visible mb-4">
    <div
      class="bg-zinc-600 px-3 py-1 rounded-t-lg flex flex-row items-center justify-between text-white"
      :style="{ overflow: 'visible' }"
    >
      <span class="title text-lg font-bold">{{ title }}</span>
      <div :style="{ position: 'relative', overflow: 'visible' }">
        <img
          class="w-5 h-5 cursor-pointer"
          :src="twoDots"
          alt="Two Dots"
          @click="toggleAddPromptMenu"
        />
        <div
          v-if="addPromptMenuVisible"
          class="absolute right-0 mt-2 bg-white border border-gray-300 rounded shadow-lg z-1001"
        >
          <div
            v-for="option in availablePromptTypes"
            :key="option.type"
            class="px-4 py-2 text-gray-800 cursor-pointer hover:bg-gray-100 text-sm whitespace-nowrap"
            @click="addPromptType(option.type, option.label)"
          >
            {{ option.label }}
          </div>
          <div v-if="availablePromptTypes.length === 0" class="px-4 py-2 text-gray-500 text-sm">
            All types added
          </div>
        </div>
      </div>
    </div>
    <div class="textblock-drop-zone">
      <div class="p-3" v-for="promptType in Object.keys(promptMap)" :key="promptType">
        <div class="tags">
          <img class="w-4 h-4" :src="dustbin" alt="Dustbin" @click="removePromptType(promptType)" />
          <select
            v-model="promptMap[promptType].tagList[0]"
            class="tag-select bg-zinc-600 text-white"
            @change="onChangeMajorType(promptType, $event)"
          >
            <option v-for="option in typeTags" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
          <!-- <div v-if="promptMap[promptType].tagList[0]" class="tag-select bg-zinc-600 text-white">
            {{ promptMap[promptType].tagList[0] }}
          </div> -->

          <select
            v-model="promptMap[promptType].tagList[1]"
            class="tag-select bg-zinc-600 text-white"
            @change="onChangeSubType(promptType, $event)"
          >
            <option
              v-for="option in subTypeTags[promptMap[promptType].tagList[0]]"
              :key="option"
              :value="option"
            >
              {{ option }}
            </option>
          </select>

          <div v-if="promptMap[promptType].tagList[2]" class="tag-select bg-zinc-600 text-white">
            {{ promptMap[promptType].tagList[2] }}
          </div>
          <!-- <select v-if="promptMap[promptType].tagList[2]" v-model="promptMap[promptType].tagList[2]"
            class="tag-select bg-zinc-600 text-white" @change="onChangePurposeType(promptType, $event)">
            <option v-for="option in purposeTags" :key="option" :value="option">
              {{ option }}
            </option>
          </select> -->

          <button class="add-tag-button" v-if="!promptMap[promptType].tagList[2]">
            <img
              class="w-5 h-5 ml-1"
              :src="add"
              alt="add"
              @click="openPurposeTagSelect(promptType)"
            />
          </button>
        </div>
        <div class="detail-table flex flex-col bg-zinc-200">
          <div
            class="bg-zinc-600 text-white py-1 px-2"
            :style="{ borderRadius: promptMap[promptType].expanded ? '4px 4px 0 0' : '4px' }"
          >
            <textarea
              v-model="promptMap[promptType].prompt"
              :ref="(el) => setPromptTextareaRef(el, promptType)"
              @input="onPromptInput(promptType)"
              style="line-height: 1.2"
            />
            <div class="flex justify-end mt-1 gap-2">
              <button class="expand-btn" type="button" @click="togglePromptExpand(promptType)">
                <i v-if="!promptMap[promptType].expanded" class="bi bi-chevron-down text-white"></i>
                <i v-else class="bi bi-chevron-up text-white"></i>
              </button>
              <button class="expand-btn" @click="handleSavePrompt(promptType)">
                <i class="bi bi-check-circle text-white"></i>
              </button>
            </div>
          </div>

          <div class="flex flex-row text-black" v-show="promptMap[promptType].expanded">
            <div class="flex-1 flex-[4_4_0%] border-r border-zinc-400">
              <div class="flex flex-row border-b border-zinc-400">
                <div class="px-1 font-bold flex-1" style="font-weight: 500">Imported Data</div>
                <div class="flex justify-end mt-1 gap-1 pr-1">
                  <button
                    class="expand-btn"
                    type="button"
                    @click="handleMagicButtonClick(promptType)"
                  >
                    <img class="w-3 h-3 cursor-pointer" :src="magic" alt="magic" />
                  </button>
                  <button
                    class="expand-btn"
                    type="button"
                    @click="handleCsvButtonClick(promptType)"
                  >
                    <img
                      v-if="!hasCsvData(promptType)"
                      class="w-3 h-3 cursor-pointer"
                      :src="fileUpload"
                      alt="fileUpload"
                    />
                    <img v-else class="w-3 h-3 cursor-pointer" :src="remove" alt="remove" />
                  </button>
                </div>
              </div>

              <div class="px-1 flex flex-row border-b border-zinc-400 text-xs items-center">
                <div class="flex-2 border-r border-zinc-400 flex-[4_4_0%]">Attribute</div>
                <div class="flex-3 pl-1 flex-[5_5_0%] flex items-center gap-1">
                  <span>Sample Data</span>
                  <div class="flex flex-col sample-nav">
                    <button
                      class="sample-nav-btn"
                      type="button"
                      @click="changeSampleRow(-1, promptType)"
                      :disabled="!canShowPrevSample(promptType)"
                    >
                      ▲
                    </button>
                    <button
                      class="sample-nav-btn"
                      type="button"
                      @click="changeSampleRow(1, promptType)"
                      :disabled="!canShowNextSample(promptType)"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>
              <div
                v-for="attribute in promptMap[promptType].attributesList || []"
                :key="attribute.attribute"
                class="px-1 flex flex-row border-b border-zinc-400 text-xs"
              >
                <div
                  class="flex-2 border-r border-zinc-400 flex-[4_4_0%] text-ellipsis overflow-hidden whitespace-nowrap"
                >
                  {{ attribute.attribute }}
                </div>
                <div
                  class="flex-3 pl-1 flex-[5_5_0%] text-ellipsis overflow-hidden whitespace-nowrap"
                >
                  {{ attribute.sampleData }}
                </div>
              </div>
            </div>

            <div class="flex-1 flex-[4_4_0%]">
              <div class="px-1 font-bold" style="font-weight: 500">Object Style</div>
              <div class="flex flex-col">
                <div
                  v-for="object in promptMap[promptType].objects"
                  :key="object.id"
                  class="px-1 text-xs pb-2 pr-2"
                >
                  <div class="flex items-center flex-row gap-1">
                    <img :src="dot" alt="dot" style="width: 14px" />
                    {{ object.name }}
                  </div>
                  <div v-if="object.addressName">({{ object.addressName }})</div>

                  <div class="flex w-full flex-row items-center gap-2">
                    <!-- points -->
                    <div
                      v-if="promptType <= 2 && !isNumerical(object.name)"
                      class="flex flex-row flex-1 items-center gap-2"
                    >
                      <div class="flex flex-row items-center gap-1">
                        <span>Fill</span>
                        <div
                          class="relative w-2 h-2 overflow-hidden border border-gray-300 shadow-sm ml-1 mr-2"
                          :style="{ backgroundColor: object.fill }"
                        >
                          <input
                            type="color"
                            v-model="object.fill"
                            @change="onPointStyleChange(promptType, object)"
                            class="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div v-if="promptType == 0" class="flex flex-row items-center gap-1">
                        <span>Radius</span>
                        <input
                          type="number"
                          v-model="object.radius"
                          @change="onPointStyleChange(promptType, object)"
                          class="w-9 pl-1 border border-gray-300 rounded text-xxs"
                          min="1"
                        />
                      </div>
                      <div v-else class="flex flex-row items-center gap-1">
                        <span>Size</span>
                        <input
                          type="number"
                          v-model="object.iconSize"
                          @change="onPointStyleChange(promptType, object)"
                          class="w-11 pl-1 border border-gray-300 rounded text-xxs"
                          min="0.1"
                          max="5"
                          step="0.1"
                        />
                      </div>
                    </div>

                    <div
                      v-if="promptType <= 2 && isNumerical(object.name)"
                      class="flex flex-row flex-1 items-center gap-2"
                    >
                      <div class="flex flex-row items-center gap-1">
                        <span>Min</span>
                        <div
                          class="relative w-2 h-2 overflow-hidden border border-gray-300 shadow-sm ml-1 mr-2"
                          :style="{ backgroundColor: promptMap[promptType].colorRamp[0] }"
                        >
                          <input
                            type="color"
                            v-model="promptMap[promptType].colorRamp[0]"
                            @change="onPointNumericalStyleChange(promptType, object)"
                            class="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div class="flex flex-row items-center gap-1">
                        <span>Max</span>
                        <div
                          class="relative w-2 h-2 overflow-hidden border border-gray-300 shadow-sm ml-1 mr-2"
                          :style="{ backgroundColor: promptMap[promptType].colorRamp[1] }"
                        >
                          <input
                            type="color"
                            v-model="promptMap[promptType].colorRamp[1]"
                            @change="onPointNumericalStyleChange(promptType, object)"
                            class="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    <!-- line -->
                    <div
                      v-if="promptType > 2 && promptType <= 5"
                      class="flex flex-row flex-1 items-center gap-2"
                    >
                      <div class="flex flex-row items-center gap-1">
                        <span>Color</span>
                        <div
                          class="relative w-2 h-2 overflow-hidden border border-gray-300 shadow-sm ml-1 mr-2"
                          :style="{ backgroundColor: object.strokeColor }"
                        >
                          <input
                            type="color"
                            v-model="object.strokeColor"
                            @change="onLineStyleChange(object)"
                            class="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div class="flex flex-row items-center gap-1">
                        <span>Style</span>
                        <select
                          v-model="object.strokeType"
                          style="font-size: 10px"
                          @change="onLineStyleChange(object)"
                          class="w-11 border border-gray-300 rounded focus:outline-none"
                        >
                          <option value="0">Solid</option>
                          <option value="1">Dashed</option>
                        </select>
                      </div>
                    </div>

                    <!-- area -->
                    <div
                      v-if="promptType > 5 && !isNumerical(object.name)"
                      class="flex flex-row flex-1 items-center gap-2"
                    >
                      <div class="flex flex-row items-center gap-1">
                        <span>Fill</span>
                        <div
                          class="relative w-2 h-2 overflow-hidden border border-gray-300 shadow-sm ml-1 mr-2"
                          :style="{ backgroundColor: object.fillColor }"
                        >
                          <input
                            type="color"
                            v-model="object.fillColor"
                            @change="onAreaStyleChange(promptType, object)"
                            class="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div class="flex flex-row items-center gap-1">
                        <span>Stroke</span>
                        <div
                          class="relative w-2 h-2 overflow-hidden border border-gray-300 shadow-sm ml-1 mr-2"
                          :style="{ backgroundColor: object.borderColor }"
                        >
                          <input
                            type="color"
                            v-model="object.borderColor"
                            @change="onAreaStyleChange(promptType, object)"
                            class="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="promptType > 5 && isNumerical(object.name)"
                      class="flex flex-row flex-1 items-center gap-2"
                    >
                      <div class="flex flex-row items-center gap-1">
                        <span>Min</span>
                        <div
                          class="relative w-2 h-2 overflow-hidden border border-gray-300 shadow-sm ml-1 mr-2"
                          :style="{ backgroundColor: promptMap[promptType].colorRamp[0] }"
                        >
                          <input
                            type="color"
                            v-model="promptMap[promptType].colorRamp[0]"
                            @change="onAreaNumericalStyleChange(promptType, object)"
                            class="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div class="flex flex-row items-center gap-1">
                        <span>Max</span>
                        <div
                          class="relative w-2 h-2 overflow-hidden border border-gray-300 shadow-sm ml-1 mr-2"
                          :style="{ backgroundColor: promptMap[promptType].colorRamp[1] }"
                        >
                          <input
                            type="color"
                            v-model="promptMap[promptType].colorRamp[1]"
                            @change="onAreaNumericalStyleChange(promptType, object)"
                            class="absolute -top-2 -left-2 w-10 h-10 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    <img
                      class="w-4 h-4 cursor-pointer"
                      :src="colorPalette"
                      alt="colorPalette"
                      @click="openStyleDialog(object, promptType)"
                    />
                    <img
                      class="w-4 h-4 cursor-pointer"
                      :src="fileSearch"
                      alt="underline"
                      @click="openModifyColorPositionDialog(object, promptType)"
                      @mouseenter="onColorPositionHover(object)"
                      @mouseleave="onColorPositionLeave"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Style settings popup -->
    <div v-if="styleDialogVisible" class="style-dialog-overlay" @click="closeStyleDialog">
      <div class="style-dialog" @click.stop>
        <div class="style-dialog-header">
          <span class="style-dialog-title">Style Settings</span>
          <button class="style-dialog-close" @click="closeStyleDialog">×</button>
        </div>
        <div class="style-dialog-content">
          <!-- Point style settings -->
          <div
            v-if="
              currentEditingObject &&
              currentEditingType <= 2 &&
              !isNumerical(currentEditingObject.name)
            "
            class="style-section"
          >
            <div class="style-item">
              <label>Fill Color</label>
              <div class="color-input-wrapper">
                <input
                  type="color"
                  v-model="currentEditingObject.fill"
                  @change="onPointStyleChange(currentEditingType, currentEditingObject)"
                />
                <input
                  type="text"
                  v-model="currentEditingObject.fill"
                  @change="onPointStyleChange(currentEditingType, currentEditingObject)"
                  class="color-text-input"
                />
              </div>
            </div>
            <div class="style-item" v-if="currentEditingType === 0">
              <label>Radius</label>
              <input
                type="number"
                v-model.number="currentEditingObject.radius"
                @change="onPointStyleChange(currentEditingType, currentEditingObject)"
                min="1"
                max="50"
                class="number-input"
              />
            </div>
            <div class="style-item" v-else>
              <label>Icon Size</label>
              <input
                type="number"
                v-model.number="currentEditingObject.iconSize"
                @change="onPointStyleChange(currentEditingType, currentEditingObject)"
                min="0.1"
                max="5"
                step="0.1"
                class="number-input"
              />
            </div>
          </div>

          <div
            v-if="
              currentEditingObject &&
              currentEditingType <= 2 &&
              isNumerical(currentEditingObject.name)
            "
            class="style-section"
          >
            <div class="style-item">
              <label>Min Data Color</label>
              <div class="color-input-wrapper">
                <input
                  type="color"
                  v-model="promptMap[currentEditingType].colorRamp[0]"
                  @change="onPointNumericalStyleChange(currentEditingType, currentEditingObject)"
                />
                <input
                  type="text"
                  v-model="promptMap[currentEditingType].colorRamp[0]"
                  @change="onPointNumericalStyleChange(currentEditingType, currentEditingObject)"
                  class="color-text-input"
                />
              </div>
            </div>
            <div class="style-item">
              <label>Max Data Color</label>
              <div class="color-input-wrapper">
                <input
                  type="color"
                  v-model="promptMap[currentEditingType].colorRamp[1]"
                  @change="onPointNumericalStyleChange(currentEditingType, currentEditingObject)"
                />
                <input
                  type="text"
                  v-model="promptMap[currentEditingType].colorRamp[1]"
                  @change="onPointNumericalStyleChange(currentEditingType, currentEditingObject)"
                  class="color-text-input"
                />
              </div>
            </div>

            <div class="style-item" v-if="currentEditingType === 0">
              <label>Radius</label>
              <input
                type="number"
                v-model.number="currentEditingObject.radius"
                @change="onPointNumericalStyleChange(currentEditingType, currentEditingObject)"
                min="1"
                max="50"
                class="number-input"
              />
            </div>
            <div class="style-item" v-else>
              <label>Icon Size</label>
              <input
                type="number"
                v-model.number="currentEditingObject.iconSize"
                @change="onPointNumericalStyleChange(currentEditingType, currentEditingObject)"
                min="0.1"
                max="5"
                step="0.1"
                class="number-input"
              />
            </div>
          </div>

          <!-- Line style settings -->
          <div
            v-if="currentEditingObject && currentEditingType > 2 && currentEditingType <= 5"
            class="style-section"
          >
            <div class="style-item">
              <label>Line Color</label>
              <div class="color-input-wrapper">
                <div :style="{ backgroundColor: currentEditingObject.strokeColor }">
                  <input
                    type="color"
                    v-model="currentEditingObject.strokeColor"
                    @change="onLineStyleChange(currentEditingObject)"
                    class="w-10 h-10 opacity-0 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  v-model="currentEditingObject.strokeColor"
                  @change="onLineStyleChange(currentEditingObject)"
                  class="color-text-input"
                />
              </div>
            </div>
            <div class="style-item">
              <label>Line Width</label>
              <input
                type="number"
                v-model.number="currentEditingObject.strokeWidth"
                @change="onLineStyleChange(currentEditingObject)"
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
                  v-model.number="currentEditingObject.strokeOpacity"
                  @change="onLineStyleChange(currentEditingObject)"
                  min="0"
                  max="1"
                  step="0.1"
                  class="range-input"
                />
                <span class="range-value"
                  >{{ (currentEditingObject.strokeOpacity * 100).toFixed(0) }}%</span
                >
              </div>
            </div>
            <div class="style-item">
              <label>Line Style</label>
              <select
                v-model="currentEditingObject.strokeType"
                @change="onLineStyleChange(currentEditingObject)"
                class="select-input"
              >
                <option :value="0">Solid</option>
                <option :value="1">Dashed</option>
              </select>
            </div>
            <div class="style-item" v-if="currentEditingObject.strokeType == 1">
              <label>Dashed Interval</label>
              <div class="dash-array-inputs">
                <input
                  type="number"
                  v-model.number="dashArray[0]"
                  @change="updateDashArray"
                  min="1"
                  max="20"
                  class="number-input-small"
                />
                <span>:</span>
                <input
                  type="number"
                  v-model.number="dashArray[1]"
                  @change="updateDashArray"
                  min="1"
                  max="20"
                  class="number-input-small"
                />
              </div>
            </div>
            <div class="style-item" v-if="currentEditingType === 3">
              <label>Line Profile</label>
              <select
                v-model="currentEditingObject.profile"
                @change="onLineStyleChange(currentEditingObject)"
                class="select-input"
              >
                <option value="driving">Driving</option>
                <option value="walking">Walking</option>
                <option value="cycling">Cycling</option>
                <option value="flight">Flight</option>
              </select>
            </div>
            <div class="flex flex-col" v-if="currentEditingType === 3">
              <label class="font-bold text-gray-700 mb-4">Way Points</label>
              <draggable
                v-model="currentEditingObject.waypoints"
                item-key="id"
                handle=".drag-handle"
                animation="200"
                ghost-class="ghost-card"
                class="waypoints-list space-y-2 flex flex-col gap-1"
                @change="isChangedWaypoints = true"
              >
                <template #item="{ element, index }">
                  <div class="waypoint-card group">
                    <div class="drag-handle cursor-move text-gray-400 hover:text-gray-600 p-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path
                          d="M8 6a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM8 12a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM8 18a2 2 0 1 0-4 0 2 2 0 0 0 4 0zM14 6a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM14 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM14 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"
                        />
                      </svg>
                    </div>

                    <span class="text-xs text-gray-400 font-mono w-4">{{ index + 1 }}</span>

                    <input
                      type="text"
                      v-model="element.addressName"
                      placeholder="Please enter waypoint address"
                      class="waypoint-input"
                      @change="isChangedWaypoints = true"
                    />

                    <button
                      type="button"
                      class="delete-waypoint-btn"
                      @click="removeWaypoint(index)"
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </template>
              </draggable>

              <div
                v-if="currentEditingObject.waypoints.length === 0"
                class="text-center text-xs text-gray-400 py-4 border border-dashed rounded"
              >
                No waypoints added.
              </div>
              <button class="add-waypoint-btn" @click="addWaypoint">+ Add Waypoint</button>
            </div>
          </div>
          <!-- Area style settings -->
          <div
            v-if="
              currentEditingObject &&
              currentEditingType > 5 &&
              !isNumerical(currentEditingObject.name)
            "
            class="style-section"
          >
            <div class="style-item">
              <label>Fill Color</label>
              <div class="color-input-wrapper">
                <div :style="{ backgroundColor: currentEditingObject.fillColor }">
                  <input
                    type="color"
                    v-model="currentEditingObject.fillColor"
                    @change="onAreaStyleChange(currentEditingType, currentEditingObject)"
                    class="w-10 h-10 opacity-0 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  v-model="currentEditingObject.fillColor"
                  @change="onAreaStyleChange(currentEditingType, currentEditingObject)"
                  class="color-text-input"
                />
              </div>
            </div>
            <div class="style-item">
              <label>Fill Opacity</label>
              <div class="flex flex-row items-center gap-1">
                <input
                  type="range"
                  v-model.number="currentEditingObject.fillOpacity"
                  @change="onAreaStyleChange(currentEditingType, currentEditingObject)"
                  min="0"
                  max="1"
                  step="0.1"
                  class="range-input"
                />
                <span class="range-value"
                  >{{ (currentEditingObject.fillOpacity * 100).toFixed(0) }}%</span
                >
              </div>
            </div>
            <div class="style-item">
              <label>Border Color</label>
              <div class="color-input-wrapper">
                <div :style="{ backgroundColor: currentEditingObject.borderColor }">
                  <input
                    type="color"
                    v-model="currentEditingObject.borderColor"
                    @change="onAreaStyleChange(currentEditingType, currentEditingObject)"
                    class="w-10 h-10 opacity-0 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  v-model="currentEditingObject.borderColor"
                  @change="onAreaStyleChange(currentEditingType, currentEditingObject)"
                  class="color-text-input"
                />
              </div>
            </div>
            <div class="style-item">
              <label>Border Width</label>
              <input
                type="number"
                v-model.number="currentEditingObject.borderWidth"
                @change="onAreaStyleChange(currentEditingType, currentEditingObject)"
                min="1"
                max="10"
                class="number-input"
              />
            </div>
            <div class="style-item" v-if="currentEditingObject.radius">
              <label>Radius</label>
              <input
                type="number"
                v-model.number="currentEditingObject.radius"
                @change="onAreaStyleChange(currentEditingType, currentEditingObject)"
                class="number-input"
              />
            </div>
            <div class="style-item" v-if="currentEditingObject.height">
              <label>Height</label>
              <input
                type="number"
                v-model.number="currentEditingObject.height"
                @change="onAreaStyleChange(currentEditingType, currentEditingObject)"
                class="number-input"
              />
            </div>
          </div>

          <div
            v-if="
              currentEditingObject &&
              currentEditingType > 5 &&
              isNumerical(currentEditingObject.name)
            "
            class="style-section"
          >
            <div class="style-item">
              <label>Min Data Color</label>
              <div class="color-input-wrapper">
                <div :style="{ backgroundColor: promptMap[currentEditingType].colorRamp[0] }">
                  <input
                    type="color"
                    v-model="promptMap[currentEditingType].colorRamp[0]"
                    @change="onAreaNumericalStyleChange(currentEditingType, currentEditingObject)"
                    class="w-10 h-10 opacity-0 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  v-model="promptMap[currentEditingType].colorRamp[0]"
                  @change="onAreaNumericalStyleChange(currentEditingType, currentEditingObject)"
                  class="color-text-input"
                />
              </div>
            </div>
            <div class="style-item">
              <label>Max Data Color</label>
              <div class="color-input-wrapper">
                <div :style="{ backgroundColor: promptMap[currentEditingType].colorRamp[1] }">
                  <input
                    type="color"
                    v-model="promptMap[currentEditingType].colorRamp[1]"
                    @change="onAreaNumericalStyleChange(currentEditingType, currentEditingObject)"
                    class="w-10 h-10 opacity-0 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  v-model="promptMap[currentEditingType].colorRamp[1]"
                  @change="onAreaNumericalStyleChange(currentEditingType, currentEditingObject)"
                  class="color-text-input"
                />
              </div>
            </div>
            <div class="style-item">
              <label>Fill Opacity</label>
              <div class="flex flex-row items-center gap-1">
                <input
                  type="range"
                  v-model.number="currentEditingObject.fillOpacity"
                  @change="onAreaNumericalStyleChange(currentEditingType, currentEditingObject)"
                  min="0"
                  max="1"
                  step="0.1"
                  class="range-input"
                />
                <span class="range-value"
                  >{{ (currentEditingObject.fillOpacity * 100).toFixed(0) }}%</span
                >
              </div>
            </div>
            <div class="style-item">
              <label>Border Color</label>
              <div class="color-input-wrapper">
                <div :style="{ backgroundColor: currentEditingObject.borderColor }">
                  <input
                    type="color"
                    v-model="currentEditingObject.borderColor"
                    @change="onAreaNumericalStyleChange(currentEditingType, currentEditingObject)"
                    class="w-10 h-10 opacity-0 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  v-model="currentEditingObject.borderColor"
                  @change="onAreaNumericalStyleChange(currentEditingType, currentEditingObject)"
                  class="color-text-input"
                />
              </div>
            </div>
            <div class="style-item">
              <label>Border Width</label>
              <input
                type="number"
                v-model.number="currentEditingObject.borderWidth"
                @change="onAreaNumericalStyleChange(currentEditingType, currentEditingObject)"
                min="1"
                max="10"
                class="number-input"
              />
            </div>
            <div class="style-item" v-if="currentEditingObject.radius">
              <label>Radius</label>
              <input
                type="number"
                v-model.number="currentEditingObject.radius"
                @change="onAreaNumericalStyleChange(currentEditingType, currentEditingObject)"
                class="number-input"
              />
            </div>
          </div>
        </div>
        <div class="style-dialog-footer">
          <button class="style-dialog-btn delete-btn" @click="deleteObject">Delete Object</button>
          <button class="style-dialog-btn style-dialog-btn-primary" @click="closeStyleDialog">
            Confirm
          </button>
        </div>
      </div>
    </div>

    <!-- colorPosition editor popup -->
    <div
      v-if="colorPositionDialogVisible"
      class="color-position-dialog-overlay"
      @click="closeColorPositionDialog"
    >
      <div class="color-position-dialog" @click.stop>
        <div class="color-position-dialog-header">
          <span class="color-position-dialog-title">Select Text for Color Position</span>
          <button class="color-position-dialog-close" @click="closeColorPositionDialog">×</button>
        </div>
        <div class="color-position-dialog-content">
          <div class="text-container">
            <p class="text-instruction">
              Please select the text that describes this color's position:
            </p>
            <div class="text-display" @mouseup="onTextSelection">{{ contentText }}</div>
            <div v-if="selectedColorPosition" class="selected-text">
              <span class="selected-label">Selected:</span>
              <span class="selected-value">"{{ selectedColorPosition }}"</span>
            </div>
          </div>
        </div>
        <div class="color-position-dialog-footer">
          <button class="dialog-btn dialog-btn-secondary" @click="closeColorPositionDialog">
            Cancel
          </button>
          <button
            class="dialog-btn dialog-btn-primary"
            @click="confirmColorPosition"
            :disabled="!selectedColorPosition"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="purposeSelectDialogVisible"
      class="purpose-dialog-overlay"
      @click="closePurposeDialog"
    >
      <div class="purpose-dialog" @click.stop>
        <div class="purpose-dialog-header">
          <span class="purpose-dialog-title">Select Purpose</span>
          <button class="purpose-dialog-close" @click="closePurposeDialog">×</button>
        </div>
        <div class="purpose-dialog-content">
          <div class="purpose-options">
            <label class="purpose-options-title">Type: </label>
            <label class="purpose-option">
              <input type="radio" value="Categorical" v-model="selectedPurposeOption" />
              <span>Categorical</span>
            </label>
            <label class="purpose-option">
              <input type="radio" value="Numerical" v-model="selectedPurposeOption" />
              <span>Numerical</span>
            </label>
          </div>
          <!-- Categorical -->
          <div class="purpose-upload" v-if="selectedPurposeOption === 'Categorical'">
            <div class="upload-missing">
              <button
                class="purpose-upload-btn"
                type="button"
                @click="getCategorical(purposeSelectPromptType)"
              >
                Generate Data
              </button>
              <button
                class="purpose-upload-btn"
                type="button"
                @click="getCategorical(purposeSelectPromptType)"
              >
                Select Data
              </button>
              <!-- <span>Please upload CSV data first.</span> -->
            </div>
          </div>

          <!-- Numerical -->
          <div class="purpose-options" v-if="selectedPurposeOption === 'Numerical'">
            <!-- <div v-if="hasCsvData(purposeSelectPromptType)" class="upload-ok">CSV data detected.</div> -->
            <div v-if="!hasCsvData(purposeSelectPromptType)" class="upload-missing">
              <button class="purpose-upload-btn" type="button" @click="triggerPurposeCsvUpload">
                Upload CSV
              </button>
              <!-- <span>Please upload CSV data first.</span> -->
            </div>
            <div v-else class="numerical-mapping-section">
              <!-- Column header selector and gradient color band UI -->
              <div class="numerical-column-select mb-2">
                <label class="purpose-options-title">Address Columns: </label>
                <select
                  v-model="promptMap[purposeSelectPromptType].addressColumn"
                  class="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value="" disabled>Select address column</option>
                  <option
                    v-for="header in promptMap[purposeSelectPromptType]?.csvHeaders || []"
                    :key="header"
                    :value="header"
                  >
                    {{ header }}
                  </option>
                </select>
                <div
                  v-if="(promptMap[purposeSelectPromptType].addressColumn || []).length === 0"
                  class="text-xs text-red-400 mt-1"
                >
                  Please select an address column.
                </div>
              </div>
              <div class="numerical-column-select mb-2">
                <label class="purpose-options-title">Data Columns: </label>
                <label class="block text-sm font-bold" style="margin-bottom: 5px"
                  >Please select 1-2 columns for numerical mapping</label
                >
                <div class="flex flex-wrap gap-2">
                  <label
                    v-for="header in promptMap[purposeSelectPromptType]?.csvHeaders || []"
                    :key="header"
                    class="flex items-center gap-1 text-sm border border-gray-300 rounded px-2 py-1 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      class="w-3 h-3"
                      :value="header"
                      :checked="
                        (promptMap[purposeSelectPromptType].selectedColumns || []).includes(header)
                      "
                      :disabled="
                        !(promptMap[purposeSelectPromptType].selectedColumns || []).includes(
                          header
                        ) && (promptMap[purposeSelectPromptType].selectedColumns || []).length >= 2
                      "
                      @change="onNumericalColumnSelect(purposeSelectPromptType, header, $event)"
                    />
                    {{ header }}
                  </label>
                </div>
                <div
                  v-if="(promptMap[purposeSelectPromptType].selectedColumns || []).length === 0"
                  class="text-xs text-red-400 mt-1"
                >
                  Please select at least one column.
                </div>
                <div
                  v-if="(promptMap[purposeSelectPromptType].selectedColumns || []).length > 0"
                  class="text-xs text-gray-500 mb-1"
                >
                  Sorted By: {{ promptMap[purposeSelectPromptType].selectedColumns.join('/ ') }}
                </div>
              </div>
              <div class="numerical-color-ramp flex flex-col gap-1 mb-2">
                <!-- <label class="text-sm font-bold">Color Ramp:</label> -->
                <label class="purpose-options-title">Color Ramp (Min - Max): </label>
                <div class="flex items-center gap-1">
                  <div class="color-input-wrapper">
                    <!-- <label class="text-xs ">min</label> -->
                    <input
                      class="color-input"
                      type="color"
                      v-model="promptMap[purposeSelectPromptType].colorRamp[0]"
                      @input="onColorRampChange(0, $event)"
                    />
                  </div>
                  <div
                    class="color-ramp-bar h-4 w-32 rounded border border-gray-300"
                    :style="colorRampGradientStyle(purposeSelectPromptType)"
                  ></div>
                  <div class="color-input-wrapper">
                    <input
                      class="color-input"
                      type="color"
                      v-model="promptMap[purposeSelectPromptType].colorRamp[1]"
                      @input="onColorRampChange(1, $event)"
                    />
                    <!-- <label class="text-xs ">max</label> -->
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="selectedPurposeOption === 'Numerical' && hasCsvData(purposeSelectPromptType)"
            class="upload-missing"
          >
            <button
              :disabled="
                !(
                  ((promptMap[purposeSelectPromptType].selectedColumns || []).length === 2 ||
                    (promptMap[purposeSelectPromptType].selectedColumns || []).length === 1) &&
                  promptMap[purposeSelectPromptType].addressColumn !== ''
                )
              "
              class="purpose-upload-btn"
              type="button"
              @click="getNumericalData(purposeSelectPromptType)"
            >
              Generate Numerical Data
            </button>
            <!-- <span>Please upload CSV data first.</span> -->
          </div>
        </div>

        <!-- <div class="purpose-dialog-footer" v-if="selectedPurposeOption === 'Numerical'">
          <button class="dialog-btn dialog-btn-secondary" type="button" @click="closePurposeDialog">Cancel</button>
          <button class="dialog-btn dialog-btn-primary" type="button"
          :disabled="!((promptMap[purposeSelectPromptType].selectedColumns||[]).length === 2 || (promptMap[purposeSelectPromptType].selectedColumns||[]).length === 1)"
          @click="confirmPurposeSelection">Confirm</button>
        </div> -->
      </div>
    </div>
    <!-- Global CSV file picker; the result is routed to whichever promptType triggered it. -->
    <input
      ref="csvFileInputRef"
      type="file"
      accept=".csv,text/csv"
      class="hidden"
      @change="onCsvFileSelected"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, onUnmounted, computed } from 'vue';
import { EventBus } from '@/utils/EventBus';
import twoDots from '../assets/svgs/two-dots.svg';
import dustbin from '../assets/svgs/dustbin.svg';
import colorPalette from '../assets/svgs/colorPalette.svg';
import magic from '../assets/svgs/magic.svg';
import fileUpload from '../assets/svgs/fileUpload.svg';
import remove from '../assets/svgs/remove.svg';
import underline from '../assets/svgs/underline.svg';
import fileSearch from '../assets/svgs/fileSearch.svg';
import draggable from 'vuedraggable';
import { AreaStore, LineStore, NumericalStore, PointStore } from '../utils/Store.js';
import {
  update_explanatory_text,
  get_purpose,
  continue_writing_an_analytical_summary_of_the_data,
  modify_tag_categorical_or_numerical,
} from '../utils/BackendMsgs.js';
import {
  CHANGE_TYPE_MAP,
  PROMPT_TYPE_OPTIONS,
  PURPOSE_TAGS,
  SUB_TYPE_TAGS,
  TYPE_TAGS,
  createPromptItem,
  parseCsvLine,
} from '../utils/illustrationConfig.js';
import add from '../assets/svgs/add.svg';
import dot from '../assets/svgs/dot.svg';

const props = defineProps({
  cardId: String,
  title: String,
  content: String,
});

const changeTypeMap = CHANGE_TYPE_MAP;

const promptMap = ref({}); // key: type, value: prompt
const CategoricalMap = ref({}); // key: type, value: {categoricaOrNumericallName: [dataIds]}
const NumericalMap = ref({}); // key: type, value: [dataIds]}}
const csvFileInputRef = ref(null);
const currentCsvPromptType = ref(null);
const styleDialogVisible = ref(false);
const currentEditingObject = ref(null);
const currentEditingType = ref(null);
const dashArray = ref([2, 3]);
const currentPromptJson = ref({});
const colorPositionDialogVisible = ref(false);
const colorPositionDialogObject = ref(null);
const colorPositionDialogPromptType = ref(null);
const selectedColorPosition = ref('');
const contentText = ref('');
const isChangedWaypoints = ref(false);

const typeTags = TYPE_TAGS;
const subTypeTags = SUB_TYPE_TAGS;
const purposeTags = PURPOSE_TAGS;

const purposeSelectDialogVisible = ref(false);
const purposeSelectPromptType = ref(null);
const selectedPurposeOption = ref('Categorical');

const addPromptMenuVisible = ref(false);
const availablePromptTypes = computed(() => {
  return PROMPT_TYPE_OPTIONS.filter((item) => !(item.type in promptMap.value));
});

const toggleAddPromptMenu = () => {
  addPromptMenuVisible.value = !addPromptMenuVisible.value;
};

const addPromptType = (type, label) => {
  if (type in promptMap.value) return;
  promptMap.value[type] = createPromptItem(label);
  addPromptMenuVisible.value = false;
};

const hasCsvData = (promptType) => {
  const item = promptMap.value[promptType];
  return !!(item && item.csvDataRows && item.csvDataRows.length > 0);
};
const canShowPrevSample = (promptType) => {
  const item = promptMap.value[promptType];
  if (!item || !item.csvDataRows) return false;
  const idx = item.currentSampleRowIndex ?? -1;
  return item.csvDataRows.length > 0 && idx > 0;
};
const canShowNextSample = (promptType) => {
  const item = promptMap.value[promptType];
  if (!item || !item.csvDataRows) return false;
  const idx = item.currentSampleRowIndex ?? -1;
  return item.csvDataRows.length > 0 && idx >= 0 && idx < item.csvDataRows.length - 1;
};

const handleCsvButtonClick = (promptType) => {
  currentCsvPromptType.value = promptType;
  if (hasCsvData(promptType)) {
    resetUploadedAttributes(promptType);
    return;
  }
  const inputEl = csvFileInputRef.value;
  if (inputEl && typeof inputEl.click === 'function') {
    inputEl.click();
  }
};

const handleMagicButtonClick = async (promptType) => {
  const item = promptMap.value[promptType];
  if (!item) return;
  EventBus.emit('start-loading', 'Generating analytical summary from CSV data...');
  await nextTick();
  try {
    const json_data = item.csvDataRows.map((row) => {
      const obj = {};
      item.csvHeaders.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
    if (json_data.length === 0) {
      console.warn('No CSV data available for analysis.');
      EventBus.emit('loading-done');
      return;
    }
    const result = await continue_writing_an_analytical_summary_of_the_data(
      props.content,
      json_data
    );
    EventBus.emit('continues-write-by-csv', {
      cardId: props.cardId,
      newText: result,
    });
  } catch (error) {
    console.error('Error generating textual descriptions:', error);
  }
};

const onNumericalColumnSelect = (promptType, column, event) => {
  // Handle numerical column selection
  const item = promptMap.value[promptType];
  if (!item) return;
  const selectedColumns = item.selectedColumns || [];
  if (event.target.checked) {
    if (!selectedColumns.includes(column) && selectedColumns.length < 2) {
      selectedColumns.push(column);
    }
  } else {
    const index = selectedColumns.indexOf(column);
    if (index !== -1) {
      selectedColumns.splice(index, 1);
    }
  }
  item.selectedColumns = selectedColumns;
};

const colorRampGradientStyle = (promptType) => {
  const item = promptMap.value[promptType];
  if (!item || !item.colorRamp || item.colorRamp.length < 2) {
    return '';
  }
  return `background: linear-gradient(to right, ${item.colorRamp[0]}, ${item.colorRamp[1]});`;
};

const getNumericalData = (promptType) => {
  // EventBus.emit('start-loading', 'Loading purpose analysis...');
  const item = promptMap.value[promptType];
  if (!item) return;
  const selectedColumns = item.selectedColumns || [];
  const addressColumn = item.addressColumn || '';
  if (selectedColumns.length === 0) {
    console.warn('Please select at least one column for numerical mapping.');
    // EventBus.emit('loading-done');
    return;
  }
  const attrCol1 = [];
  const attrCol2 = [];
  const addressCol = [];
  const result = {
    purpose: 'numerical',
    attribute1: selectedColumns[0],
    attribute2: selectedColumns[1] || selectedColumns[0],
    color1: item.colorRamp[0],
    color2: item.colorRamp[1],
  };
  // promptMap.value[promptType].purpose = purpose;
  const tag_name = 'Numerical';
  const tags = promptMap.value[promptType].tagList;
  if (tags.length >= 3) {
    tags[2] = tag_name;
  } else {
    tags.push(tag_name);
  }
  const attr1 = result.attribute1;
  const attr2 = result.attribute2;

  // Extract attr1 and attr2 columns from imported_data (CSV text)

  // Basic CSV parsing: split into lines, get headers, then find attribute1/2 index
  const lines = item.csvDataRows;
  if (lines.length > 1) {
    const headers = item.csvHeaders;
    const idx1 = headers.indexOf(attr1);
    const idx2 = headers.indexOf(attr2);
    const addrIdx = headers.indexOf(addressColumn);
    // Grab all rows for those columns (excluding header)
    for (let i = 0; i < lines.length; ++i) {
      const row = lines[i];
      if (idx1 !== -1 && row[idx1] !== undefined) attrCol1.push(row[idx1]);
      if (idx2 !== -1 && row[idx2] !== undefined) attrCol2.push(row[idx2]);
      if (addrIdx !== -1 && row[addrIdx] !== undefined) addressCol.push(row[addrIdx]);
    }
  }

  EventBus.emit(`update-purpose-${props.cardId}`, {
    changeType: changeTypeMap[promptType],
    purpose: result,
    attrCol1: attrCol1,
    attrCol2: attrCol2,
    addressCol: addressCol,
  });

  closePurposeDialog();
  // EventBus.emit('loading-done');
};

const getCategorical = async (promptType) => {
  EventBus.emit('start-loading', 'Loading Categorical data...');
  await nextTick();
  try {
    let result = null;
    result = await get_purpose(props.content);
    if (result) {
      const purpose = result.purpose;
      if (purpose && purpose.length > 0) {
        // promptMap.value[promptType].purpose = purpose;
        const tag_name = purpose.toLowerCase().includes('categorical')
          ? 'Categorical'
          : purpose.toLowerCase().includes('numerical')
            ? 'Numerical'
            : 'None';
        const tags = promptMap.value[promptType].tagList;
        if (tags.length >= 3) {
          tags[2] = tag_name;
        } else {
          tags.push(tag_name);
        }

        EventBus.emit(`update-purpose-${props.cardId}`, {
          changeType: changeTypeMap[promptType],
          purpose: result,
        });
      }
    }
    // EventBus.emit('loading-done');
  } catch (error) {
    console.error('Error getting purpose:', error);
  }
  closePurposeDialog();
};

const getPurpose = async (text, imported_data, promptType, changeType = null) => {
  try {
    EventBus.emit('start-loading', 'Loading purpose analysis...');
    let result = null;
    if (changeType) {
      result = await modify_tag_categorical_or_numerical(text, imported_data, changeType);
    } else {
      result = await get_purpose(text, imported_data);
    }
    if (result) {
      const purpose = result.purpose;
      const attrCol1 = [];
      const attrCol2 = [];
      const addressCol = [];
      if (purpose && purpose.length > 0) {
        // promptMap.value[promptType].purpose = purpose;
        const tag_name = purpose.toLowerCase().includes('categorical')
          ? 'Categorical'
          : purpose.toLowerCase().includes('numerical')
            ? 'Numerical'
            : 'None';
        const tags = promptMap.value[promptType].tagList;
        if (tags.length >= 3) {
          tags[2] = tag_name;
        } else {
          tags.push(tag_name);
        }
        const attr1 = result.attribute1;
        const attr2 = result.attribute2;
        // Extract attr1 and attr2 columns from imported_data (CSV text)

        if (imported_data) {
          // Basic CSV parsing: split into lines, get headers, then find attribute1/2 index
          const lines = imported_data.split(/\r?\n/).filter((line) => line.trim() !== '');
          if (lines.length > 1) {
            const headers = lines[0].split(',');
            const idx1 = headers.indexOf(attr1);
            const idx2 = headers.indexOf(attr2);
            const addrIdx = 1; // todo: get the index of the address column
            // Grab all rows for those columns (excluding header)
            for (let i = 1; i < lines.length; ++i) {
              const row = lines[i].split(',');
              if (idx1 !== -1 && row[idx1] !== undefined) attrCol1.push(row[idx1]);
              if (idx2 !== -1 && row[idx2] !== undefined) attrCol2.push(row[idx2]);
              if (addrIdx !== -1 && row[addrIdx] !== undefined) addressCol.push(row[addrIdx]);
            }
          }
        }

        EventBus.emit(`update-purpose-${props.cardId}`, {
          changeType: changeTypeMap[promptType],
          purpose: result,
          attrCol1: attrCol1,
          attrCol2: attrCol2,
          addressCol: addressCol,
        });
      }
    }
    EventBus.emit('loading-done');
  } catch (error) {
    console.error('Error getting purpose:', error);
  }
};

const onCsvFileSelected = async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const isCsv =
    file.type === 'text/csv' ||
    file.type === 'application/vnd.ms-excel' ||
    file.name.toLowerCase().endsWith('.csv');
  if (!isCsv) {
    console.warn('Please select a CSV file.');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      // getPurpose(props.content, reader.result, currentCsvPromptType.value);
      parseCsvContent(reader.result, currentCsvPromptType.value);
    } catch (err) {
      console.error('Failed to parse CSV:', err);
      if (currentCsvPromptType.value != null) {
        resetUploadedAttributes(currentCsvPromptType.value);
      }
    } finally {
      event.target.value = '';
    }
  };

  reader.onerror = (err) => {
    console.error('Failed to read CSV file:', err);
    event.target.value = '';
  };
  reader.readAsText(file);
};

const resetUploadedAttributes = (promptType) => {
  const item = promptMap.value[promptType];
  if (!item) return;
  item.csvHeaders = [];
  item.csvDataRows = [];
  item.currentSampleRowIndex = -1;
  item.attributesList = [];
};

const parseCsvContent = (content, promptType) => {
  const item = promptMap.value[promptType];
  if (!item) return;
  if (!content) {
    throw new Error('CSV content is empty');
  }
  const rows = String(content)
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  if (rows.length === 0) {
    throw new Error('CSV does not contain any data');
  }

  const headers = parseCsvLine(rows[0]);
  const dataRows = rows.slice(1).map(parseCsvLine);

  item.csvHeaders = headers;
  item.csvDataRows = dataRows;
  item.currentSampleRowIndex = dataRows.length > 0 ? 0 : -1;

  updateAttributesFromCsv(item.currentSampleRowIndex, promptType);
};

const updateAttributesFromCsv = (rowIndex, promptType) => {
  const item = promptMap.value[promptType];
  if (!item) return;
  const headers = item.csvHeaders || [];
  const dataRows = item.csvDataRows || [];
  if (!headers.length) {
    item.attributesList = [];
    return;
  }
  const row = rowIndex >= 0 && dataRows[rowIndex] ? dataRows[rowIndex] : [];
  item.attributesList = headers.map((header, index) => ({
    attribute: header || `Column ${index + 1}`,
    sampleData: row[index] || '',
  }));
};

const changeSampleRow = (delta, promptType) => {
  const item = promptMap.value[promptType];
  if (!item || !item.csvDataRows || !item.csvDataRows.length) return;
  const nextIndex = (item.currentSampleRowIndex ?? 0) + delta;
  if (nextIndex < 0 || nextIndex >= item.csvDataRows.length) return;
  item.currentSampleRowIndex = nextIndex;
  updateAttributesFromCsv(nextIndex, promptType);
};

const promptTextareaRefs = ref({});
const MIN_HEIGHT = 20;

const setPromptTextareaRef = (el, promptType) => {
  if (el) {
    promptTextareaRefs.value[promptType] = el;
  } else {
    delete promptTextareaRefs.value[promptType];
  }
};

const autoResize = (promptType) => {
  nextTick(() => {
    const item = promptMap.value[promptType];
    const el = promptTextareaRefs.value[promptType];
    if (!el) return;
    el.style.overflow = 'auto';
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight < MIN_HEIGHT ? MIN_HEIGHT : el.scrollHeight}px`;
  });
};

const autoResizeAll = () => {
  nextTick(() => {
    Object.keys(promptMap.value).forEach((promptType) => {
      autoResize(promptType);
    });
  });
};

const togglePromptExpand = (promptType) => {
  const item = promptMap.value[promptType];
  if (!item) return;
  item.expanded = !item.expanded;
  // autoResize(promptType);
};

const onPromptInput = (promptType) => {
  autoResize(promptType);
};

const oldPromptMap = ref({});

// Persist a freshly edited prompt and ask the backend to re-derive the JSON.
const handleSavePrompt = async (promptType) => {
  const item = promptMap.value[promptType];
  if (!item) return;

  const newPrompt = item.prompt || '';
  const oldPrompt = oldPromptMap.value[promptType] || '';

  if (newPrompt === oldPrompt) {
    return;
  }

  const changeType = changeTypeMap[promptType];
  if (!changeType) return;

  const updatedJson = {
    [changeType]: text2jsonData.value[changeType] || {},
  };

  const explanatoryTextOld = {};
  explanatoryTextOld[changeType] = oldPrompt;

  const explanatoryTextNew = {};
  explanatoryTextNew[changeType] = newPrompt;

  const text = props.content || '';

  try {
    const result = await update_explanatory_text(
      text,
      explanatoryTextOld,
      explanatoryTextNew,
      updatedJson
    );
    oldPromptMap.value[promptType] = newPrompt;

    EventBus.emit(`update-json-by-type-${props.cardId}`, {
      type: changeType,
      json: result,
    });
  } catch (error) {
    console.error('Error updating explanatory text:', error);
  }
};

// Handle a point style change from the editor.
const onPointStyleChange = (promptType, object) => {
  if (isCategorical(object.id)) {
    EventBus.emit(`update-categorical-point-style-${props.cardId}`, {
      categoricalId: object.id,
      pointIds: CategoricalMap.value[promptType][object.id] || [],
      style: {
        fill: object.fill,
        radius: Number(object.radius),
        iconSize: Number(object.iconSize),
      },
    });
  } else {
    EventBus.emit(`update-point-style-${props.cardId}`, {
      pointId: object.id,
      style: {
        fill: object.fill,
        radius: Number(object.radius),
        iconSize: Number(object.iconSize),
        colorPosition: object.colorPosition || null,
      },
    });
  }
  // Also mirror the change inside promptMap so the UI stays in sync.
  Object.keys(promptMap.value).forEach((promptType) => {
    const pm = promptMap.value[promptType];
    if (pm && pm.objects) {
      const target = pm.objects.find((o) => o.id === object.id);
      if (target) {
        target.fill = object.fill;
        if (object.radius !== undefined) target.radius = Number(object.radius);
        if (object.iconSize !== undefined) target.iconSize = Number(object.iconSize);
      }
    }
  });
};

// Handle a line style change from the editor.
const onLineStyleChange = (object) => {
  const style = {
    strokeColor: object.strokeColor,
    strokeType:
      typeof object.strokeType === 'string' ? Number(object.strokeType) : object.strokeType,
  };
  if (object.strokeWidth !== undefined) {
    style.strokeWidth = object.strokeWidth;
  }
  if (object.strokeOpacity !== undefined) {
    style.strokeOpacity = object.strokeOpacity;
  }
  if (object.dashArray) {
    style.dashArray = object.dashArray;
  }
  if (object.strokeType == 1 && object.dashArray) {
    style.dashArray = [...object.dashArray];
  }
  if (object.colorPosition) {
    style.colorPosition = object.colorPosition;
  }
  if (object.profile) {
    style.profile = object.profile;
  }

  EventBus.emit(`update-line-style-${props.cardId}`, {
    lineId: object.id,
    style: style,
  });
  // Mirror the change inside promptMap as well.
  Object.keys(promptMap.value).forEach((promptType) => {
    const pm = promptMap.value[promptType];
    if (pm && pm.objects) {
      const target = pm.objects.find((o) => o.id === object.id);
      if (target) {
        target.strokeColor = object.strokeColor;
        target.strokeType =
          typeof object.strokeType === 'string' ? Number(object.strokeType) : object.strokeType;
        if (object.strokeWidth !== undefined) target.strokeWidth = object.strokeWidth;
        if (object.dashArray) target.dashArray = [...object.dashArray];
        if (object.profile) target.profile = object.profile;
        if (object.strokeOpacity !== undefined) target.strokeOpacity = object.strokeOpacity;
      }
    }
  });
};

// Handle an area style change from the editor.
const onAreaStyleChange = (promptType, object) => {
  if (isCategorical(object.id)) {
    EventBus.emit(`update-categorical-area-style-${props.cardId}`, {
      categoricalId: object.id,
      areaIds: CategoricalMap.value[promptType][object.id] || [],
      style: {
        fillColor: object.fillColor,
        fillOpacity: object.fillOpacity,
        borderColor: object.borderColor,
        borderWidth: object.borderWidth,
        colorPosition: object.colorPosition || null,
        radius: object.radius || null,
        height: object.height || null,
      },
    });
  } else {
    EventBus.emit(`update-area-style-${props.cardId}`, {
      areaId: object.id,
      style: {
        fillColor: object.fillColor,
        fillOpacity: object.fillOpacity,
        borderColor: object.borderColor,
        borderWidth: object.borderWidth,
        colorPosition: object.colorPosition || null,
        radius: object.radius || null,
        height: object.height || null,
      },
    });
  }

  Object.keys(promptMap.value).forEach((promptType) => {
    const pm = promptMap.value[promptType];
    if (pm && pm.objects) {
      const target = pm.objects.find((o) => o.id === object.id);
      if (target) {
        target.fillColor = object.fillColor;
        target.fillOpacity = object.fillOpacity;
        target.borderColor = object.borderColor;
        target.borderWidth = object.borderWidth;
        target.radius = object.radius;
        target.height = object.height;
      }
    }
  });
};

const onPointNumericalStyleChange = (promptType, object) => {
  EventBus.emit(`update-numerical-point-style-${props.cardId}`, {
    pointIds: NumericalMap.value[promptType] || [],
    type: promptType,
    style: {
      minColor: promptMap.value[promptType].colorRamp[0],
      maxColor: promptMap.value[promptType].colorRamp[1],
      radius: Number(object.radius),
      iconSize: Number(object.iconSize),
    },
  });
};

const onAreaNumericalStyleChange = (promptType, object) => {
  EventBus.emit(`update-numerical-area-style-${props.cardId}`, {
    areaIds: NumericalMap.value[promptType] || [],
    type: promptType,
    style: {
      minColor: promptMap.value[promptType].colorRamp[0],
      maxColor: promptMap.value[promptType].colorRamp[1],
      radius: Number(object.radius),
      borderColor: object.borderColor,
      borderWidth: object.borderWidth,
      fillOpacity: object.fillOpacity,
    },
  });
};

// Open the style settings popup for the given object.
const openStyleDialog = (object, promptType) => {
  currentEditingObject.value = { ...object };
  currentEditingType.value = Number(promptType);
  // Initialize the dashed-line spec (for stroke type 1).
  if (object.strokeType == 1 && object.dashArray) {
    dashArray.value = [...object.dashArray];
  } else {
    dashArray.value = [2, 3];
  }
  // Ensure sensible defaults for every editable property.
  if (currentEditingType.value <= 2) {
    if (!currentEditingObject.value.fill) currentEditingObject.value.fill = '#FF0000';
    if (!currentEditingObject.value.radius) currentEditingObject.value.radius = 6;
    if (!currentEditingObject.value.iconSize) currentEditingObject.value.iconSize = 0.18;
  } else if (currentEditingType.value > 2 && currentEditingType.value <= 5) {
    if (!currentEditingObject.value.strokeColor) currentEditingObject.value.strokeColor = '#000000';
    if (!currentEditingObject.value.strokeWidth) currentEditingObject.value.strokeWidth = 3;
    if (!currentEditingObject.value.strokeOpacity) currentEditingObject.value.strokeOpacity = 1;
    if (currentEditingObject.value.strokeType === undefined)
      currentEditingObject.value.strokeType = 0;
    if (currentEditingObject.value.strokeType == 1 && !currentEditingObject.value.dashArray) {
      currentEditingObject.value.dashArray = [2, 3];
    }
    if (!currentEditingObject.value.profile && currentEditingType.value === 3)
      currentEditingObject.value.profile = '';
    if (!currentEditingObject.value.wayPoints && currentEditingType.value === 3) {
      currentEditingObject.value.wayPoints = [];
    }
  } else {
    if (!currentEditingObject.value.fillColor) currentEditingObject.value.fillColor = '#FFFFFF';
    if (currentEditingObject.value.fillOpacity === undefined)
      currentEditingObject.value.fillOpacity = 0.8;
    if (!currentEditingObject.value.borderColor) currentEditingObject.value.borderColor = '#FFFFFF';
    if (!currentEditingObject.value.borderWidth) currentEditingObject.value.borderWidth = 2;
  }
  styleDialogVisible.value = true;
};

// Close the style settings popup.
const closeStyleDialog = () => {
  if (currentEditingType.value === 3 && isChangedWaypoints.value) {
    EventBus.emit(`update-trajectory-waypoints-${props.cardId}`, {
      trajectoryId: currentEditingObject.value.id,
      waypoints: currentEditingObject.value.waypoints,
    });
    isChangedWaypoints.value = false;
  }
  styleDialogVisible.value = false;
  currentEditingObject.value = null;
  currentEditingType.value = null;
};

const deleteObject = () => {
  if (!currentEditingObject.value) return;
  const objectId = currentEditingObject.value.id;
  promptMap.value[currentEditingType.value].objects = promptMap.value[
    currentEditingType.value
  ].objects.filter((obj) => obj.id !== objectId);
  EventBus.emit(`delete-object-${props.cardId}`, {
    objectId: objectId,
    objectType: currentEditingType.value,
  });
  closeStyleDialog();
};

// Apply the latest dashed-line spec to the line being edited.
const updateDashArray = () => {
  if (currentEditingObject.value && currentEditingObject.value.strokeType == 1) {
    currentEditingObject.value.dashArray = [...dashArray.value];
    onLineStyleChange(currentEditingObject.value);
  }
};

const addWaypoint = () => {
  if (currentEditingObject.value && Array.isArray(currentEditingObject.value.waypoints)) {
    isChangedWaypoints.value = true;
    currentEditingObject.value.waypoints.push({
      id: `new-waypoint-${Date.now()}`,
      addressName: '',
      coordinate: {
        lat: 0,
        lng: 0,
      },
      isNewAdded: true,
    });
  }
};

const removeWaypoint = (idx) => {
  if (currentEditingObject.value && Array.isArray(currentEditingObject.value.waypoints)) {
    currentEditingObject.value.waypoints.splice(idx, 1);
    isChangedWaypoints.value = true;
  }
};

const text2jsonData = ref(null);

const updatePrompt = (data) => {
  const promptJson = data.prompt_data_json;
  // const jsonData =
  text2jsonData.value = data.json_data;
  currentPromptJson.value = promptJson;
  promptMap.value = {};

  if (promptJson.dot && promptJson.dot.length !== 0) {
    promptMap.value[0] = {
      type: 0,
      tagList: ['Point', 'Dot'],
      prompt: promptJson.dot,
      expanded: false,
      objects: [],
      csvHeaders: [],
      csvDataRows: [],
      currentSampleRowIndex: -1,
      attributesList: [],
      colorRamp: ['#0000ff', '#ff0000'], // default blue to red
      selectedColumns: [],
      addressColumn: '',
    };
    // Remember the previous prompt so we can detect future changes.
    oldPromptMap.value[0] = promptJson.dot;
  }
  if (promptJson.marker && promptJson.marker.length !== 0) {
    promptMap.value[1] = {
      type: 1,
      tagList: ['Point', 'Marker'],
      prompt: promptJson.marker,
      expanded: false,
      objects: [],
      csvHeaders: [],
      csvDataRows: [],
      currentSampleRowIndex: -1,
      attributesList: [],
      colorRamp: ['#0000ff', '#ff0000'], // default blue to red
      selectedColumns: [],
      addressColumn: '',
    };
    oldPromptMap.value[1] = promptJson.marker;
  }
  if (promptJson['other icon'] && promptJson['other icon'].length !== 0) {
    promptMap.value[2] = {
      type: 2,
      tagList: ['Point', 'Other Icon'],
      prompt: promptJson['other icon'],
      expanded: false,
      objects: [],
      csvHeaders: [],
      csvDataRows: [],
      currentSampleRowIndex: -1,
      attributesList: [],
      colorRamp: ['#0000ff', '#ff0000'], // default blue to red
      selectedColumns: [],
      addressColumn: '',
    };
    oldPromptMap.value[2] = promptJson['other icon'];
  }
  if (promptJson.trajectory && promptJson.trajectory.length !== 0) {
    promptMap.value[3] = {
      type: 3,
      tagList: ['Line', 'Trajectory'],
      prompt: promptJson.trajectory,
      expanded: false,
      objects: [],
      csvHeaders: [],
      csvDataRows: [],
      currentSampleRowIndex: -1,
      attributesList: [],
      wayPoints: [],
      colorRamp: ['#0000ff', '#ff0000'], // default blue to red
      selectedColumns: [],
      addressColumn: '',
    };
    oldPromptMap.value[3] = promptJson.trajectory;
  }
  if (promptJson.line && promptJson.line.length !== 0) {
    promptMap.value[4] = {
      type: 4,
      tagList: ['Line', 'Line'],
      prompt: promptJson.line,
      expanded: false,
      objects: [],
      csvHeaders: [],
      csvDataRows: [],
      currentSampleRowIndex: -1,
      attributesList: [],
      colorRamp: ['#0000ff', '#ff0000'], // default blue to red
      selectedColumns: [],
      addressColumn: '',
    };
    oldPromptMap.value[4] = promptJson.line;
  }
  if (promptJson.direction && promptJson.direction.length !== 0) {
    promptMap.value[5] = {
      type: 5,
      tagList: ['Line', 'Direction'],
      prompt: promptJson.direction,
      expanded: false,
      objects: [],
      csvHeaders: [],
      csvDataRows: [],
      currentSampleRowIndex: -1,
      attributesList: [],
      colorRamp: ['#0000ff', '#ff0000'], // default blue to red
      selectedColumns: [],
      addressColumn: '',
    };
    oldPromptMap.value[5] = promptJson.direction;
  }
  if (promptJson['irregular area'] && promptJson['irregular area'].length !== 0) {
    promptMap.value[6] = {
      type: 6,
      tagList: ['Area', 'Irregular'],
      prompt: promptJson['irregular area'],
      expanded: false,
      objects: [],
      csvHeaders: [],
      csvDataRows: [],
      currentSampleRowIndex: -1,
      attributesList: [],
      colorRamp: ['#0000ff', '#ff0000'], // default blue to red
      selectedColumns: [],
      addressColumn: '',
    };
    oldPromptMap.value[6] = promptJson['irregular area'];
  }
  if (promptJson['regular shape'] && promptJson['regular shape'].length !== 0) {
    promptMap.value[7] = {
      type: 7,
      tagList: ['Area', 'Regular'],
      prompt: promptJson['regular shape'],
      expanded: false,
      objects: [],
      csvHeaders: [],
      csvDataRows: [],
      currentSampleRowIndex: -1,
      attributesList: [],
      colorRamp: ['#0000ff', '#ff0000'], // default blue to red
      selectedColumns: [],
      addressColumn: '',
    };
    oldPromptMap.value[7] = promptJson['regular shape'];
  }

  autoResizeAll();
  updateObjects();
};

const isNeedToAdd = (typeKey, categoryName) => {
  // Always add the object unless it is a categorical/numerical bucket that
  // we have already registered under the given typeKey.
  if (!isCategorical(categoryName) && !isNumerical(categoryName)) return true;
  if (isCategorical(categoryName)) {
    const catMap = CategoricalMap.value[typeKey];
    if (!catMap) return true;
    const categories = Object.keys(catMap);
    return !categories.includes(categoryName);
  } else if (isNumerical(categoryName)) {
    const numList = NumericalMap.value[typeKey];
    if (!numList) return true;
    return numList.length === 0;
  }
};

const isCategorical = (categoryName) => {
  return categoryName.includes('Categorical');
};

const isNumerical = (categoryName) => {
  return categoryName.includes('Numerical');
};

const updateObjects = () => {
  // Reset the object lists on every promptItem before rebuilding them.
  Object.keys(promptMap.value).forEach((key) => {
    if (promptMap.value[key]) {
      promptMap.value[key].objects = [];
    }
  });

  CategoricalMap.value = {};
  NumericalMap.value = {};

  const points = PointStore.getAll(props.cardId);
  points.forEach((point, i) => {
    if (point.isWaypoint) return;
    const typeKey = String(point.type);
    const promptItem = promptMap.value[typeKey];
    const categoricaOrNumericallName = point.isCategoricalOrNumerical;
    const name =
      point.type === 0
        ? 'Dot'
        : point.type === 1
          ? 'Marker'
          : point.type === 2
            ? 'Other Icon'
            : 'Other';
    // TODO: assign more descriptive names to the generated objects.
    const id = isCategorical(categoricaOrNumericallName) ? categoricaOrNumericallName : point.id;
    const addressName =
      isCategorical(categoricaOrNumericallName) || isNumerical(categoricaOrNumericallName)
        ? null
        : point.addressName;
    const objectName = isCategorical(categoricaOrNumericallName)
      ? `${categoricaOrNumericallName}`
      : isNumerical(categoricaOrNumericallName)
        ? `${categoricaOrNumericallName}`
        : `${name} ${i + 1}`;
    const colorPosition =
      isCategorical(categoricaOrNumericallName) || isNumerical(categoricaOrNumericallName)
        ? null
        : point.colorPosition;
    if (promptItem) {
      if (isNeedToAdd(typeKey, categoricaOrNumericallName)) {
        promptItem.objects.push({
          id: id,
          name: objectName,
          addressName: addressName,
          coordinates: point.coordinates,
          fill: point.color,
          radius: point.radius,
          iconImage: point.iconImage,
          iconSize: point.iconSize,
          colorPosition: colorPosition,
        });
      }
    } else {
      CategoricalMap.value[typeKey] = {};
      NumericalMap.value[typeKey] = [];

      promptMap.value[typeKey] = {
        type: Number(typeKey),
        prompt: '',
        expanded: true,
        tagList: ['Point', name],
        objects: [
          {
            id: id,
            name: objectName,
            addressName: addressName,
            coordinates: point.coordinates,
            fill: point.color,
            radius: point.radius,
            iconImage: point.iconImage,
            iconSize: point.iconSize,
            colorPosition: colorPosition,
          },
        ],
        csvHeaders: [],
        csvDataRows: [],
        currentSampleRowIndex: -1,
        attributesList: [],
        colorRamp: ['#0000ff', '#ff0000'], // default blue to red
        selectedColumns: [],
        addressColumn: '',
      };
    }
    if (isCategorical(categoricaOrNumericallName)) {
      if (!CategoricalMap.value[typeKey]) {
        CategoricalMap.value[typeKey] = {};
      }
      if (!CategoricalMap.value[typeKey][categoricaOrNumericallName]) {
        CategoricalMap.value[typeKey][categoricaOrNumericallName] = [point.id];
      } else {
        CategoricalMap.value[typeKey][categoricaOrNumericallName].push(point.id);
      }
    } else if (isNumerical(categoricaOrNumericallName)) {
      if (!NumericalMap.value[typeKey]) {
        NumericalMap.value[typeKey] = [];
      }
      NumericalMap.value[typeKey].push(point.id);
      const numerical = NumericalStore.getByType(props.cardId, name.toLowerCase());
      if (numerical) {
        promptMap.value[typeKey].colorRamp = [numerical.minColor, numerical.maxColor];
      }
    }
  });

  const lines = LineStore.getAll(props.cardId);
  lines.forEach((line, i) => {
    if (line.type === 3) {
      return; // todo: now skip straight lines
    }
    const typeKey =
      line.type === 0
        ? 3 // trajectory line
        : line.type === 1
          ? 4 // geographical line
          : line.type === 2
            ? 5
            : null; // direction line
    const promptItem = promptMap.value[typeKey];

    const name =
      line.type === 1
        ? 'Line line' // regular line
        : line.type === 2
          ? 'Direction' // direction line
          : line.type === 0
            ? 'Trajectory'
            : 'Line'; // trajectory line
    const waypoints = [];
    if (line.type === 0 && line.waypoints && line.waypoints.length > 0) {
      line.waypoints.forEach((wp) => {
        const point = PointStore.getById(props.cardId, wp);
        if (point) {
          waypoints.push({
            id: point.id,
            addressName: point.addressName,
            isNewAdded: false,
          });
        }
      });
    }
    if (promptItem) {
      promptItem.objects.push({
        id: line.id,
        name: `${name} ${i + 1}`,
        strokeType: line.strokeType,
        strokeColor: line.strokeColor,
        strokeWidth: line.strokeWidth,
        waypoints: waypoints,
        colorPosition: line.colorPosition,
        profile: line.profile,
        addressName: line.geoLineName,
        strokeOpacity: line.strokeOpacity,
      });
    } else {
      promptMap.value[typeKey] = {
        type: Number(typeKey),
        prompt: '',
        expanded: true,
        tagList: ['Line', name],
        objects: [
          {
            id: line.id,
            name: `${name} ${i + 1}`,
            strokeType: line.strokeType,
            strokeColor: line.strokeColor,
            strokeWidth: line.strokeWidth,
            waypoints: waypoints,
            colorPosition: line.colorPosition,
            profile: line.profile,
            addressName: line.geoLineName,
            strokeOpacity: line.strokeOpacity,
          },
        ],
        csvHeaders: [],
        csvDataRows: [],
        currentSampleRowIndex: -1,
        attributesList: [],
        colorRamp: ['#0000ff', '#ff0000'], // default blue to red
        selectedColumns: [],
        addressColumn: '',
      };
    }
  });

  const areas = AreaStore.getAll(props.cardId);
  areas.forEach((area, i) => {
    const categoricaOrNumericallName = area.isCategoricalOrNumerical;
    const typeKey =
      area.type === 0 || area.type === 3
        ? 6 // irregular area
        : area.type === 1 || area.type === 2
          ? 7
          : null; // regular shape
    const promptItem = promptMap.value[typeKey];
    const name =
      area.type === 0 || area.type === 3
        ? 'Region' // irregular area
        : area.type === 1
          ? 'Polygon' // polygon
          : area.type === 2
            ? 'Circle'
            : 'Area'; // regular shape
    const tagName =
      area.type === 0 || area.type === 3
        ? 'Irregular' // irregular area
        : 'Regular'; // regular shape
    const id = isCategorical(categoricaOrNumericallName) ? categoricaOrNumericallName : area.id;
    const addressName =
      isCategorical(categoricaOrNumericallName) || isNumerical(categoricaOrNumericallName)
        ? null
        : area.addressName;
    const objectName = isCategorical(categoricaOrNumericallName)
      ? `${categoricaOrNumericallName}`
      : isNumerical(categoricaOrNumericallName)
        ? `${categoricaOrNumericallName}`
        : `${name} ${i + 1}`;
    const colorPosition =
      isCategorical(categoricaOrNumericallName) || isNumerical(categoricaOrNumericallName)
        ? null
        : area.colorPosition;
    if (promptItem) {
      if (isNeedToAdd(typeKey, categoricaOrNumericallName)) {
        promptItem.objects.push({
          id: id,
          name: objectName,
          fillColor: area.fillColor,
          fillOpacity: area.fillOpacity,
          borderColor: area.borderColor,
          borderWidth: area.borderWidth,
          points: area.points,
          addressName: addressName,
          radius: area.radius,
          colorPosition: colorPosition,
          height: area.height,
        });
      }
    } else {
      CategoricalMap.value[typeKey] = {};
      NumericalMap.value[typeKey] = [];

      promptMap.value[typeKey] = {
        type: Number(typeKey),
        prompt: '',
        expanded: true,
        tagList: ['Area', tagName],
        objects: [
          {
            id: id,
            name: objectName,
            fillColor: area.fillColor,
            fillOpacity: area.fillOpacity,
            borderColor: area.borderColor,
            borderWidth: area.borderWidth,
            points: area.points,
            addressName: addressName,
            radius: area.radius,
            colorPosition: colorPosition,
            height: area.height,
          },
        ],
        csvHeaders: [],
        csvDataRows: [],
        currentSampleRowIndex: -1,
        attributesList: [],
        colorRamp: ['#0000ff', '#ff0000'], // default blue to red
        selectedColumns: [],
        addressColumn: '',
      };
    }

    if (isCategorical(categoricaOrNumericallName)) {
      if (!CategoricalMap.value[typeKey]) {
        CategoricalMap.value[typeKey] = {};
      }
      if (!CategoricalMap.value[typeKey][categoricaOrNumericallName]) {
        CategoricalMap.value[typeKey][categoricaOrNumericallName] = [area.id];
      } else {
        CategoricalMap.value[typeKey][categoricaOrNumericallName].push(area.id);
      }
    } else if (isNumerical(categoricaOrNumericallName)) {
      if (!NumericalMap.value[typeKey]) {
        NumericalMap.value[typeKey] = [];
      }
      const numericalTypeName =
        area.type === 0 || area.type === 3
          ? 'irregular area' // irregular area
          : 'regular shape'; // regular shape
      NumericalMap.value[typeKey].push(area.id);
      const numerical = NumericalStore.getByType(props.cardId, numericalTypeName.toLowerCase());
      if (numerical) {
        promptMap.value[typeKey].colorRamp = [numerical.minColor, numerical.maxColor];
      }
    }
  });

  Object.keys(promptMap.value).forEach((key) => {
    if (promptMap.value[key] && promptMap.value[key].objects.length === 0) {
      delete promptMap.value[key];
    }
  });
};

const updateObjectsByType = (type) => {
  updateObjects();
};

const targetMajorType = ref(null);
const onChangeMajorType = (promptType, $event) => {
  targetMajorType.value = $event.target.value;
};

const onChangeSubType = async (promptType, $event) => {
  const targetType = $event.target.value;
  function getPromptTypeBySubType(subType) {
    if (promptType < 3) {
      return subType === 'Dot' ? '0' : subType === 'Marker' ? '1' : '2';
    } else if (promptType < 6) {
      return subType === 'Trajectory' ? '3' : subType === 'Line' ? '4' : '5';
    } else {
      return subType === 'Irregular' ? '6' : '7';
    }
  }
  const newPromptType = getPromptTypeBySubType(targetType);
  const orginalItem = promptMap.value[promptType];
  if (!targetMajorType.value) {
    if (promptMap.value[newPromptType]) {
      promptMap.value[newPromptType].prompt =
        `${promptMap.value[newPromptType].prompt} \n\n ${orginalItem.prompt}`;
      promptMap.value[newPromptType].objects = [
        ...promptMap.value[newPromptType].objects,
        ...orginalItem.objects,
      ];
    } else {
      promptMap.value[newPromptType] = orginalItem;
      promptMap.value[newPromptType].tagList[1] = targetType;
    }
    // EventBus.emit(`change-object-type-${props.cardId}`,{
    //   oldPromptType: promptType,
    //   newPromptType: newPromptType
    // });
    // promptMap.value[promptType] = null;
    delete promptMap.value[promptType];

    // changeObjectsType(props.cardId, promptType, newPromptType);
    // EventBus.emit(`update-objects-by-type-${props.cardId}`, newPromptType);
    EventBus.emit(`update-map-objects-by-sub-type-${props.cardId}`, {
      oldPromptType: promptType,
      newPromptType: newPromptType,
    });
  } else {
    delete promptMap.value[promptType];
    const new_tag_major_category =
      targetMajorType.value === 'Point'
        ? 'point'
        : targetMajorType.value === 'Line'
          ? 'line'
          : 'area';
    const new_tag_sub_category = targetType;
    EventBus.emit(`update-map-objects-by-major-type-${props.cardId}`, {
      new_tag_major_category: new_tag_major_category,
      new_tag_sub_category: new_tag_sub_category,
      old_tag: promptType,
    });
  }
};

const removePromptType = (promptType) => {
  delete promptMap.value[promptType];
  EventBus.emit(`remove-prompt-type-${props.cardId}`, promptType);
};

const onChangePurposeType = async (promptType, $event) => {
  const targetPurpose = $event.target.value;
  const item = promptMap.value[promptType];

  if (!targetPurpose || targetPurpose === 'None') {
    // Drop the purpose tag.
    if (item.tagList.length === 3) {
      item.tagList.pop();
    }
    return;
  }
  const formerTag = targetPurpose === 'Categorical' ? 'Numerical' : 'Categorical';
  EventBus.emit(`remove-purpose-data-${props.cardId}`, {
    type: promptType,
    targetPurpose: formerTag,
  });
  if (!item) return;
  const imported_data = item.csvDataRows.map((row) => row.join(',')).join('\n');

  await getPurpose(props.content, imported_data, promptType, targetPurpose);
};

const openPurposeTagSelect = (promptType) => {
  purposeSelectPromptType.value = promptType;
  selectedPurposeOption.value = 'Categorical';
  purposeSelectDialogVisible.value = true;
};

const closePurposeDialog = () => {
  purposeSelectDialogVisible.value = false;
  purposeSelectPromptType.value = null;
};

const triggerPurposeCsvUpload = () => {
  if (purposeSelectPromptType.value == null) return;
  currentCsvPromptType.value = purposeSelectPromptType.value;
  const inputEl = csvFileInputRef.value;
  if (inputEl && typeof inputEl.click === 'function') {
    inputEl.click();
  }
};

const confirmPurposeSelection = async () => {
  const promptType = purposeSelectPromptType.value;
  if (promptType == null) return;
  if (!hasCsvData(promptType)) return;
  const item = promptMap.value[promptType];
  if (!item) return;
  const targetPurpose = selectedPurposeOption.value;
  if (item.tagList.length >= 3) {
    item.tagList[2] = targetPurpose;
  } else {
    item.tagList.push(targetPurpose);
  }
  const imported_data = item.csvDataRows.map((row) => row.join(',')).join('\n');
  await getPurpose(props.content, imported_data, promptType, targetPurpose);
  purposeSelectDialogVisible.value = false;
  purposeSelectPromptType.value = null;
};

// Highlight the color-position phrase associated with the hovered object.
const onColorPositionHover = (object) => {
  if (!object) return;
  if (isCategorical(object.id) || isNumerical(object.id)) return;
  EventBus.emit(`highlight-color-position-${props.cardId}`, {
    colorPosition: object.colorPosition,
    id: object.id,
  });
};

const onColorPositionLeave = () => {
  EventBus.emit(`clear-color-position-highlight-${props.cardId}`);
};

const updateExplainPromptByType = (data) => {
  const promptType = data.prompt_type;
  const explanatory_text = data.explanatory_text;
  const item = promptMap.value[promptType];
  if (item) {
    item.prompt = explanatory_text;
    oldPromptMap.value[promptType] = explanatory_text;
    autoResize(promptType);
  }
};

// Open the colorPosition editor popup.
const openModifyColorPositionDialog = (object, promptType) => {
  colorPositionDialogObject.value = object;
  colorPositionDialogPromptType.value = promptType;
  selectedColorPosition.value = object.colorPosition || '';
  contentText.value = props.content || '';
  colorPositionDialogVisible.value = true;
};

// Close the colorPosition editor popup.
const closeColorPositionDialog = () => {
  colorPositionDialogVisible.value = false;
  colorPositionDialogObject.value = null;
  colorPositionDialogPromptType.value = null;
  selectedColorPosition.value = '';
  contentText.value = '';
};

// Capture the user's text selection for the colorPosition editor.
const onTextSelection = () => {
  const selection = window.getSelection();
  if (selection && selection.toString().length > 0) {
    selectedColorPosition.value = selection.toString().trim();
  }
};

// Apply the selected colorPosition to the current object.
const confirmColorPosition = () => {
  if (!selectedColorPosition.value || !colorPositionDialogObject.value) return;

  const object = colorPositionDialogObject.value;
  const promptType = colorPositionDialogPromptType.value;

  object.colorPosition = selectedColorPosition.value;

  // Mirror the change in promptMap so the object list stays in sync.
  if (promptMap.value[promptType] && promptMap.value[promptType].objects) {
    const targetObject = promptMap.value[promptType].objects.find((o) => o.id === object.id);
    if (targetObject) {
      targetObject.colorPosition = selectedColorPosition.value;
    }
  }

  if (promptType <= 2) {
    onPointStyleChange(promptType, object);
  } else if (promptType > 2 && promptType <= 5) {
    onLineStyleChange(object);
  } else {
    onAreaStyleChange(promptType, object);
  }

  EventBus.emit(`clear-color-position-highlight-${props.cardId}`);
  EventBus.emit(`highlight-text-${props.cardId}`);

  closeColorPositionDialog();
};

const updateColorPosition = (data) => {
  const objectId = data.id;
  const objectType = data.type;
  const colorPosition = data.newColorPosition;

  if (promptMap.value[objectType] && promptMap.value[objectType].objects) {
    const targetObject = promptMap.value[objectType].objects.find((o) => o.id === objectId);
    if (targetObject) {
      targetObject.colorPosition = colorPosition;
    }
  }
};

onMounted(() => {
  nextTick(() => {
    autoResizeAll();
  });

  EventBus.on(`update-prompt-${props.cardId}`, updatePrompt);
  EventBus.on(`update-objects-by-type-${props.cardId}`, updateObjectsByType);
  EventBus.on(`update-explain-prompt-by-type-${props.cardId}`, updateExplainPromptByType);
  EventBus.on(`update-color-position-for-object-${props.cardId}`, updateColorPosition);
});

onUnmounted(() => {
  EventBus.off(`update-prompt-${props.cardId}`, updatePrompt);
  EventBus.off(`update-objects-by-type-${props.cardId}`, updateObjectsByType);
  EventBus.off(`update-explain-prompt-by-type-${props.cardId}`, updateExplainPromptByType);
  EventBus.off(`update-color-position-for-object-${props.cardId}`, updateColorPosition);
});
</script>

<style scoped>
.title {
  font-size: 1.1rem;
  font-weight: 500;
}

.tags {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  align-items: center;
}

.add-tag-button {
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.2rem;
  height: 1.2rem;
}

.tag-select {
  padding: 0.01rem 0.2rem;
  border-radius: 4px;
  font-size: 0.7rem;
  background-color: #52525b;
  border: none;
  outline: none;
  color: #ffffff;
  text-align: center;
  white-space: nowrap;
  display: inline-block;
  /* Hide the default browser dropdown arrow. */
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: none;
}

.sample-nav-btn {
  /* border: 1px solid #d4d4d4; */
  /* background: #f5f5f5; */
  color: #333;
  font-size: 8px;
  line-height: 8px;
  padding: 0;
  width: 10px;
  height: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.sample-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.detail-table {
  margin-top: 0.5rem;
  border-radius: 4px;
  width: 100%;
}

.detail-table textarea {
  width: 100%;
  /* height: 100%; */
  border: none;
  outline: none;
  resize: none;
  background-color: transparent;
  color: white;
  font-size: 0.9rem;
}

.expand-btn {
  font-size: 0.75rem;
  /* padding: 2px 6px; */
  background-color: transparent;
  color: white;
  cursor: pointer;
}

.expand-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.rotate-180 {
  transform: rotate(180deg);
}

/* Style settings dialog. */
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
}

.style-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
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
  gap: 16px;
}

.style-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.style-item label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.color-ramp-bar {
  height: 25px;
  width: 60%;
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input-wrapper input[type='color'] {
  width: 30px;
  height: 32px;
  /* border: 1px solid #d1d5db; */
  border-radius: 4px;
  cursor: pointer;
}

.color-text-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  width: 120px;
}

.number-input {
  width: 120px;
  padding: 6px 10px;
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
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  background: white;
}

.range-input {
  width: 150px;
  margin: 8px 0;
}

.range-value {
  font-size: 0.875rem;
  color: #6b7280;
  margin-left: 8px;
}

.dash-array-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.style-dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.style-dialog-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  width: 40%;
}

.delete-btn {
  background-color: #e86161;
  color: white;
}

.style-dialog-btn-primary {
  background-color: #6297ed;
  color: white;
}

.style-dialog-btn-primary:hover {
  background-color: #2563eb;
}

/* colorPosition editor dialog. */
.color-position-dialog-overlay {
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

.color-position-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 60%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.color-position-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.color-position-dialog-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
}

.color-position-dialog-close {
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

.color-position-dialog-close:hover {
  color: #1f2937;
}

.color-position-dialog-content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.text-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.text-instruction {
  font-size: 0.9rem;
  color: #374151;
  margin: 0;
  font-weight: 500;
}

.text-display {
  padding: 12px;
  background-color: #f9fafb;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #1f2937;
  line-height: 1.6;
  min-height: 150px;
  max-height: 300px;
  overflow-y: auto;
  user-select: text;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.selected-text {
  padding: 10px 12px;
  background-color: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.selected-label {
  font-weight: 600;
  color: #1e40af;
  flex-shrink: 0;
}

.selected-value {
  color: #1f2937;
  font-size: 0.875rem;
  word-break: break-word;
}

.color-position-dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dialog-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
}

.dialog-btn-secondary {
  background-color: #e5e7eb;
  color: #374151;
}

.dialog-btn-secondary:hover {
  background-color: #d1d5db;
}

.dialog-btn-primary {
  background-color: #3b82f6;
  color: white;
}

.dialog-btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.dialog-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.purpose-dialog-overlay {
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

.purpose-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 380px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
}

.purpose-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.purpose-dialog-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
}

.purpose-dialog-close {
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

.purpose-dialog-close:hover {
  color: #1f2937;
}

.purpose-dialog-content {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.purpose-options {
  display: flex;
  gap: 12px;
  align-items: center;
}

.purpose-options-title {
  font-size: 1rem;
  font-weight: 500;
  color: #374151;
}

.purpose-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.purpose-upload {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.9rem;
  margin-top: 5px;
}

.purpose-upload-btn {
  padding: 6px 30px;
  width: 100%;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  border: 1px solid #d1d5db;
  background-color: #f7f7f7;
  color: rgb(0, 0, 0);
}

.numerical-color-ramp {
  margin-top: 12px;
}

.upload-ok {
  color: #15803d;
  font-weight: 600;
}

.upload-missing {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #b91c1c;
}

.purpose-dialog-footer {
  padding: 12px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.add-prompt-type-popup {
  position: fixed;
  z-index: 1001;
}

.waypoints-list {
  margin-top: 8px;
}

.waypoint-card {
  display: flex;
  align-items: center;
  gap: 5px;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 3px 8px;
  transition: all 0.2s ease;
}

/* Subtle shadow on hover. */
.waypoint-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

/* Ghost element shown while a card is being dragged. */
.ghost-card {
  opacity: 0.5;
  background: #f3f4f6;
  border: 1px dashed #9ca3af;
}

/* Inline input styling: no default border, only highlight on focus. */
.waypoint-input {
  /* Take up remaining row space. */
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #374151;
  padding: 2px 0;
  /* Prevent the input from forcing the row to overflow. */
  min-width: 0;
}

.waypoint-input::placeholder {
  color: #9ca3af;
}

/* Delete-waypoint icon button. */
.delete-waypoint-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: #9ca3af;
  transition: all 0.2s;
}

/* Drag-handle cursor. */
.drag-handle {
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.add-waypoint-btn {
  /* color: #3b82f6; */
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 3px 8px;
  margin-top: 5px;
  background-color: #f9fafb;
  transition: all 0.2s ease;
}

.numerical-column-select {
  margin-bottom: 10px;
}
</style>
