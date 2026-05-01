# Frontend Contracts

This file documents the client-side contracts that tie together `App.vue`, `TextBlock.vue`, `MapDisplay.vue`, `IllustrationCard.vue`, and map utilities. Treat these names and data shapes as stable while refactoring.

## EventBus Channels

`src/utils/EventBus.js` is a small pub/sub wrapper. The event strings below are part of the component contract.

### Global events

| Event | Payload | Primary consumers |
| --- | --- | --- |
| `start-loading` | loading message string | `App.vue` |
| `loading-done` | none | `App.vue` |
| `append-description` | `{ description, cardId }` | `App.vue` |
| `reload-row` | `{ cardId }` | `App.vue` |
| `continues-write-by-csv` | `{ cardId, newText }` | `App.vue` |
| `update-color-position` | `{ cardId, ... }` | `App.vue` |

### Card-scoped events

Most card events include the card id in the event name: ``event-name-${cardId}``.

| Event pattern | Purpose |
| --- | --- |
| `highlight-text-${cardId}` | Rebuild text highlights after map object changes. |
| `clear-all-highlights-${cardId}` | Clear text highlights for a card. |
| `hover-map-object-${cardId}` | Mirror map hover state into text. |
| `hover-text-address-${cardId}` | Mirror text hover state into map. |
| `highlight-color-position-${cardId}` | Highlight a color-position span in text. |
| `clear-color-position-highlight-${cardId}` | Clear color-position highlighting. |
| `update-prompt-${cardId}` | Refresh illustration prompts from parsed map objects. |
| `update-objects-by-type-${cardId}` | Refresh objects for one prompt/map type. |
| `update-explain-prompt-by-type-${cardId}` | Refresh explanation text for a prompt type. |
| `update-color-position-for-object-${cardId}` | Update stored color-position metadata. |
| `handle-no-color-position-${cardId}` | Handle style updates when text lacks color-position metadata. |
| `update-point-style-${cardId}` | Apply point style changes. |
| `update-categorical-point-style-${cardId}` | Apply categorical point style changes. |
| `update-numerical-point-style-${cardId}` | Apply numerical point style changes. |
| `update-line-style-${cardId}` | Apply line or trajectory style changes. |
| `update-area-style-${cardId}` | Apply area style changes. |
| `update-categorical-area-style-${cardId}` | Apply categorical area style changes. |
| `update-numerical-area-style-${cardId}` | Apply numerical area style changes. |
| `update-purpose-${cardId}` | Send categorical/numerical purpose data to the map. |
| `remove-prompt-type-${cardId}` | Remove a prompt group from the illustration panel. |
| `update-map-objects-by-sub-type-${cardId}` | Reclassify map objects by subtype. |
| `update-map-objects-by-major-type-${cardId}` | Reclassify map objects by major type. |
| `delete-object-${cardId}` | Delete a map object and its prompt entry. |
| `remove-purpose-data-${cardId}` | Clear purpose-driven styling data. |
| `close-geo-place-popup-${cardId}` | Close the place continuation popup. |
| `update-json-by-type-${cardId}` | Replace JSON for a specific map object type. |
| `update-trajectory-waypoints-${cardId}` | Rebuild trajectory waypoints after edits. |

## Store Shapes

`src/utils/Store.js` stores normalized records in module-level maps keyed by `cardId`.

### PointStore

Point `type` values:

- `0`: `dot`
- `1`: `marker`
- `2`: `other icon`

Stable fields include `id`, `cardId`, `sourceId`, `type`, `coordinates`, `color`, `iconImage`, `iconSize`, `addressName`, `radius`, `isWaypoint`, `candidateAddress`, `candidateIndex`, `description`, `colorPosition`, and `isCategoricalOrNumerical`.

### LineStore

Line `type` values:

- `0`: `trajectory`
- `1`: `line`
- `2`: `direction`

Stable fields include `id`, `cardId`, `sourceId`, `type`, `waypoints`, `geoLineName`, `strokeColor`, `strokeWidth`, `strokeType`, `arrowLayerId`, `profile`, `description`, `colorPosition`, `candidateAddress`, `candidateIndex`, and `strokeOpacity`.

### AreaStore

Area `type` values:

- `0`: `irregular area`
- `1`: regular polygon shape
- `2`: regular circle shape
- `3`: irregular/mask-style area handled with type `0` lookups

Stable fields include `id`, `cardId`, `sourceId`, `type`, `points`, `addressName`, `boundingbox`, `center`, `radius`, `fillColor`, `fillOpacity`, `borderColor`, `borderWidth`, `candidateAddress`, `candidateIndex`, `description`, `colorPosition`, `height`, `isCategoricalOrNumerical`, and `isMaskHighlight`.

### Purpose Stores

`NumericalStore` and `CategoricalStore` hold purpose-driven styling data for imported datasets. Their `type` keys are used to look up color encodings from the illustration and map panels.
