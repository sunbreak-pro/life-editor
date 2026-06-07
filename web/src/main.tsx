import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { i18n, I18nProvider } from "@life-editor/shared";
import "./index.css";
import App from "./App.tsx";

// I18nProvider wraps the app so every screen can call useTranslation against
// the shared en/ja catalog (W0-4). Importing `i18n` from shared also runs its
// idempotent init side-effect.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      <App />
    </I18nProvider>
  </StrictMode>,
);
