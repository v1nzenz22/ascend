// Types for Vite-specific imports, e.g. `import css from './x.css?raw'`.
/// <reference types="vite/client" />
// Types for `import { registerSW } from "virtual:pwa-register"` (src/app/update.ts).
/// <reference types="vite-plugin-pwa/vanillajs" />

/** The app version from package.json, inserted by Vite at build time. */
declare const __APP_VERSION__: string;
