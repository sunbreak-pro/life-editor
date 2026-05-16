/*
 * Minimal ambient typing for Vite's `import.meta.env`.
 * shared/ is consumed by Vite-based hosts (web/, later desktop/mobile),
 * but does not depend on the Vite package itself, so the env shape is
 * declared locally. Extend as more VITE_ vars are introduced.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
