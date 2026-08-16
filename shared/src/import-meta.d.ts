/*
 * Minimal ambient typing for Vite's `import.meta.env`.
 * shared/ is consumed by Vite-based hosts (web/, later desktop/mobile),
 * but does not depend on the Vite package itself, so the env shape is
 * declared locally. Extend as more VITE_ vars are introduced.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /**
   * Where a password-recovery link should land when the request was made from
   * a shell whose origin is not an http(s) URL (#919). Optional — the deployed
   * web URL is the built-in default.
   */
  readonly VITE_PUBLIC_WEB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
