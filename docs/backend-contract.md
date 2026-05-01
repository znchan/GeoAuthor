# Backend Contract

`src/utils/BackendMsgs.js` is the frontend source of truth for backend integration. The helpers currently prefer mock/stub data in several places so GeoAuthor can run without a backend, but the axios branches are kept as the intended wire contract.

## Rules

- All endpoints use `POST`.
- Keep endpoint paths, request field names, and response keys stable unless the contract is versioned.
- Keep mock/stub defaults available for frontend-only development.
- Keep `text2json` category names aligned with `src/utils/Store.js`, `src/utils/MapTools.js`, and map rendering code.

## Endpoints

| Helper | Path | Request fields | Response shape used by UI |
| --- | --- | --- | --- |
| `get_mapbackground` | `/get_mapbackground` | `text` | One of `standard map`, `satellite map`, `traffic map`, `dark mode map`; mapped to numeric style ids. |
| `get_mapscope` | `/get_mapscope` | `text` | Object with `primary_region`, `scope_level`, `reasoning`. `scope_level` must match `LEVEL_MAP` keys. |
| `text2json` | `/text2json` | `text` | Object keyed by map object types: `marker`, `dot`, `other icon`, `trajectory`, `line`, `direction`, `regular shape`, `irregular area`. |
| `get_explanatory_text` | `/get_explanatory_text` | `text`, `json_result` | Object keyed by the same map object type names, values are explanatory strings. |
| `update_explanatory_text` | `/update_explanatory_text` | `text`, `explanatory_text_old`, `explanatory_text_new`, `json_result` | Updated `text2json`-style object. |
| `get_purpose` | `/get_purpose` | `text`, `imported_data` | Object with `purpose` set to `categorical` or `numerical`, plus place, attribute, and color fields. |
| `generate_textual_descriptions_for_geo_element` | `/generate_textual_descriptions_for_geo_element` | `text`, `geo_element` | Array of generated description strings. |
| `continue_writing_based_on_a_place` | `/continue_writing_based_on_a_place` | `text`, `place_name` | String appended to the current article text. |
| `generate_descriptions_of_spatial_relationships` | `/generate_descriptions_of_spatial_relationships` | `place_names` | Generated spatial relationship description string. |
| `continue_writing_an_analytical_summary_of_the_data` | `/continue_writing_an_analytical_summary_of_the_data` | `text`, `imported_data` | String appended to the current article text. |
| `modify_tag_LINE` | `/modify_tag_LINE` | `text`, `old_tag`, `new_tag` | Object with `updated_json` and `explanatory_text`. |
| `modify_tag_AREA` | `/modify_tag_AREA` | `text`, `old_tag`, `new_tag` | Object with `updated_json` and `explanatory_text`. |
| `modify_major_tag` | `/modify_major_tag` | `text`, `new_tag_major_category`, `new_tag_sub_category` | Updated map object JSON keyed by major map type. |
| `modify_tag_categorical_or_numerical` | `/modify_tag_categorical_or_numerical` | `text`, `imported_data`, `new_tag` | Purpose object using the same categorical/numerical shape as `get_purpose`. |

## `text2json` Categories

The following keys are treated as stable schema labels:

- `marker`
- `dot`
- `other icon`
- `trajectory`
- `line`
- `direction`
- `regular shape`
- `irregular area`

Avoid renaming these keys. They are displayed in the illustration panel, rebuilt from `Store.js`, and consumed by map drawing flows.
