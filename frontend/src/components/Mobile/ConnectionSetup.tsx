import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  parseConnectionUrl,
  setApiBaseUrl,
  setApiToken,
  apiFetch,
} from "../../config/api";

interface ConnectionSetupProps {
  onConnected: () => void;
}

export function ConnectionSetup({ onConnected }: ConnectionSetupProps) {
  const { t } = useTranslation();
  const [manualUrl, setManualUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Check if URL params contain connection info (from QR code)
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      const baseUrl = window.location.origin;
      tryConnect(baseUrl, token);
    }
  });

  async function tryConnect(baseUrl: string, token: string) {
    setConnecting(true);
    setError(null);
    try {
      setApiBaseUrl(baseUrl);
      setApiToken(token);
      const res = await apiFetch("/api/health");
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      // Clean URL params
      window.history.replaceState({}, "", window.location.pathname);
      onConnected();
    } catch (e) {
      setError(
        t(
          "mobile.connection.error",
          "Connection failed. Check the URL and try again.",
        ),
      );
    } finally {
      setConnecting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseConnectionUrl(manualUrl);
    if (parsed) {
      tryConnect(parsed.baseUrl, parsed.token);
    } else {
      setError(
        t(
          "mobile.connection.invalidUrl",
          "Invalid URL. Use the QR code or paste the full connection URL.",
        ),
      );
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-notion-bg-primary p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-notion-text-primary">
            Life Editor
          </h1>
          <p className="mt-2 text-sm text-notion-text-secondary">
            {t("mobile.connection.subtitle", "Connect to your desktop app")}
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-notion-border bg-notion-bg-secondary p-4">
            <h2 className="mb-2 text-sm font-medium text-notion-text-primary">
              {t("mobile.connection.howTo", "How to connect")}
            </h2>
            <ol className="space-y-1 text-xs text-notion-text-secondary">
              <li>
                1.{" "}
                {t(
                  "mobile.connection.step1",
                  "Open Life Editor on your desktop",
                )}
              </li>
              <li>
                2.{" "}
                {t(
                  "mobile.connection.step2",
                  'Go to Settings → "Mobile Access"',
                )}
              </li>
              <li>
                3.{" "}
                {t(
                  "mobile.connection.step3",
                  "Scan the QR code or paste the URL below",
                )}
              </li>
            </ol>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="http://192.168.1.x:13456?token=..."
              className="w-full rounded-lg border border-notion-border bg-notion-bg-primary px-3 py-2.5 text-sm text-notion-text-primary placeholder:text-notion-text-secondary/50 focus:border-notion-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={connecting || !manualUrl}
              className="w-full rounded-lg bg-notion-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {connecting
                ? t("mobile.connection.connecting", "Connecting...")
                : t("mobile.connection.connect", "Connect")}
            </button>
          </form>

          {error && <p className="text-center text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
