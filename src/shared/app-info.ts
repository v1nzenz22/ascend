// Basic facts about the app, shared by the main process and the UI.
export const APP_NAME = "ascend";

// Only these URL schemes may be loaded in a tab from user input. Everything
// else (file:, javascript:, data:, custom app schemes) is rejected.
// The single exception is `about:blank`, used for new empty tabs; it is
// handled separately because it never touches the network.
export const ALLOWED_SCHEMES = ["http:", "https:"] as const;
