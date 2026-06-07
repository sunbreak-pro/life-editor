import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { i18n, I18nProvider } from "@life-editor/shared";
import "./index.css";
import App from "./App.tsx";
import { W0Demo } from "./_w0demo/W0Demo.tsx";

// THROWAWAY (W0): `/?w0demo` mounts the design-system verification screen
// instead of the real app, so the shared primitives + tokens can be
// eyeballed without auth. Remove this branch and ./_w0demo after sign-off.
const isW0Demo =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("w0demo");

// I18nProvider wraps both the real app and the throwaway W0 demo so every
// screen can call useTranslation against the shared en/ja catalog (W0-4).
// Importing `i18n` from shared also runs its idempotent init side-effect.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      {isW0Demo ? <W0Demo /> : <App />}
    </I18nProvider>
  </StrictMode>,
);
