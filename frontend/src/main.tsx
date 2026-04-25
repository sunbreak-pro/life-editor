import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./utils/migrateStorageKeys";
import "./i18n";
import App from "./App.tsx";
import { MobileApp } from "./MobileApp.tsx";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { SyncProvider } from "./context/SyncContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { DesktopProviders } from "./providers/DesktopProviders";
import { MobileProviders } from "./providers/MobileProviders";
import { isTauriMobile } from "./services/bridge";

const isMobile = isTauriMobile();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <SyncProvider>
            {isMobile ? (
              <MobileProviders>
                <MobileApp />
              </MobileProviders>
            ) : (
              <DesktopProviders>
                <App />
              </DesktopProviders>
            )}
          </SyncProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
