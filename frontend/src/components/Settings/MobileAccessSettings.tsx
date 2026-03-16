import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone, Copy, RefreshCw, Power, PowerOff } from "lucide-react";
import qrcode from "qrcode-generator";

const SERVER_PORT = 13456;

export function MobileAccessSettings() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fetch server status and token from main process
    if (window.electronAPI) {
      window.electronAPI
        .invoke<{ enabled: boolean; token: string | null; ip: string | null }>(
          "server:getStatus",
        )
        .then((status) => {
          setEnabled(status.enabled);
          setToken(status.token);
          setLocalIp(status.ip);
        })
        .catch(() => {});
    }
  }, []);

  const connectionUrl = useMemo(() => {
    if (!localIp || !token) return null;
    return `http://${localIp}:${SERVER_PORT}?token=${token}`;
  }, [localIp, token]);

  const qrSvg = useMemo(() => {
    if (!connectionUrl) return null;
    const qr = qrcode(0, "M");
    qr.addData(connectionUrl);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 4 });
  }, [connectionUrl]);

  async function handleToggle() {
    if (!window.electronAPI) return;
    try {
      if (enabled) {
        await window.electronAPI.invoke("server:disable");
        setEnabled(false);
        setToken(null);
      } else {
        const result = await window.electronAPI.invoke<{
          token: string;
          ip: string;
        }>("server:enable");
        setEnabled(true);
        setToken(result.token);
        setLocalIp(result.ip);
      }
    } catch (e) {
      console.error("Failed to toggle mobile access:", e);
    }
  }

  async function handleRegenerateToken() {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.invoke<{
        token: string;
        ip: string;
      }>("server:regenerateToken");
      setToken(result.token);
      setLocalIp(result.ip);
    } catch (e) {
      console.error("Failed to regenerate token:", e);
    }
  }

  function handleCopyUrl() {
    if (!connectionUrl) return;
    navigator.clipboard.writeText(connectionUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-4" data-section-id="mobile">
      <div className="flex items-center gap-2">
        <Smartphone size={18} className="text-notion-text-secondary" />
        <h3 className="text-base font-medium text-notion-text-primary">
          {t("settings.mobileAccess.title", "Mobile Access")}
        </h3>
      </div>

      <p className="text-xs text-notion-text-secondary">
        {t(
          "settings.mobileAccess.description",
          "Access Life Editor from your iPhone/iPad on the same WiFi network.",
        )}
      </p>

      {/* Enable/Disable toggle */}
      <button
        onClick={handleToggle}
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          enabled
            ? "bg-red-50 text-red-600 hover:bg-red-100"
            : "bg-notion-accent/10 text-notion-accent hover:bg-notion-accent/20"
        }`}
      >
        {enabled ? <PowerOff size={16} /> : <Power size={16} />}
        {enabled
          ? t("settings.mobileAccess.disable", "Disable Mobile Access")
          : t("settings.mobileAccess.enable", "Enable Mobile Access")}
      </button>

      {enabled && connectionUrl && (
        <div className="space-y-4 rounded-lg border border-notion-border p-4">
          {/* QR Code */}
          {qrSvg && (
            <div className="flex justify-center">
              <div
                className="rounded-lg bg-white p-2"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </div>
          )}

          <p className="text-center text-xs text-notion-text-secondary">
            {t(
              "settings.mobileAccess.scanQr",
              "Scan this QR code with your phone's camera",
            )}
          </p>

          {/* Connection URL */}
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-notion-bg-secondary px-2 py-1 text-xs text-notion-text-secondary">
              {connectionUrl}
            </code>
            <button
              onClick={handleCopyUrl}
              className="shrink-0 rounded p-1.5 text-notion-text-secondary hover:bg-notion-hover"
              title={t("settings.mobileAccess.copy", "Copy URL")}
            >
              <Copy size={14} />
            </button>
          </div>

          {copied && (
            <p className="text-center text-xs text-green-600">
              {t("settings.mobileAccess.copied", "Copied!")}
            </p>
          )}

          {/* Regenerate Token */}
          <button
            onClick={handleRegenerateToken}
            className="flex items-center gap-1.5 text-xs text-notion-text-secondary hover:text-notion-text-primary"
          >
            <RefreshCw size={12} />
            {t(
              "settings.mobileAccess.regenerate",
              "Regenerate Token (invalidates current sessions)",
            )}
          </button>
        </div>
      )}
    </div>
  );
}
