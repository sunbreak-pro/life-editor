import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  i18n,
  I18nProvider,
  ThemeProvider,
  migrateLegacyPreferenceKeys,
} from "@life-editor/shared";
import "./index.css";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

// #718: carry the three legacy un-prefixed Notes keys over to their
// `life-editor:` names. Must run before the first render — the owning hooks
// read localStorage in a `useState` initializer. Idempotent, so the second and
// every later start is a no-op.
migrateLegacyPreferenceKeys();

// I18nProvider wraps the app so every screen can call useTranslation against
// the shared en/ja catalog (W0-4). Importing `i18n` from shared also runs its
// idempotent init side-effect.
//
// ThemeProvider (W1) sits inside I18nProvider (it forwards language changes to
// the shared i18n singleton) and applies data-theme + root font-size to
// documentElement. Per CLAUDE.md §6.2 Theme is outer, so it wraps the whole
// App — the existing lean Provider nesting in MainScreen is untouched.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      {/*
       * #1199: the outermost catch. Below I18nProvider because the fallback
       * is translated; above everything else so a throw in any Provider or
       * screen shows a page the user can act on instead of a white screen.
       */}
      <AppErrorBoundary variant="page">
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AppErrorBoundary>
    </I18nProvider>
  </StrictMode>,
);
