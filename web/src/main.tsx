import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { i18n, I18nProvider, ThemeProvider } from "@life-editor/shared";
import "./index.css";
import App from "./App.tsx";

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
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
