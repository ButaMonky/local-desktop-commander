/**
 * Central constants and shape contracts for UI resource identifiers. It gives one source of truth for URIs/tool metadata shared between server handlers and UI loaders.
 */
export const FILE_PREVIEW_RESOURCE_URI = 'ui://desktop-commander/file-preview';
export const CONFIG_EDITOR_RESOURCE_URI = 'ui://desktop-commander/config-editor';
export function buildUiToolMeta(resourceUri, widgetAccessible = false, showMcpUiPreviews = true) {
    // ISOLATED EXPERIMENT ONLY: omit automatic widget advertisement.
    // Tool handlers, schemas and model-facing results are not modified.
    return undefined;
}
