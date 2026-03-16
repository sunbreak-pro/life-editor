const STORAGE_KEY_BASE_URL = "life-editor-api-base-url";
const STORAGE_KEY_TOKEN = "life-editor-api-token";

let baseUrl: string | null = null;
let token: string | null = null;

export function getApiBaseUrl(): string {
  if (!baseUrl) {
    baseUrl = localStorage.getItem(STORAGE_KEY_BASE_URL) || "";
  }
  return baseUrl;
}

export function setApiBaseUrl(url: string): void {
  baseUrl = url;
  localStorage.setItem(STORAGE_KEY_BASE_URL, url);
}

export function getApiToken(): string {
  if (!token) {
    token = localStorage.getItem(STORAGE_KEY_TOKEN) || "";
  }
  return token;
}

export function setApiToken(t: string): void {
  token = t;
  localStorage.setItem(STORAGE_KEY_TOKEN, t);
}

export function clearApiCredentials(): void {
  baseUrl = null;
  token = null;
  localStorage.removeItem(STORAGE_KEY_BASE_URL);
  localStorage.removeItem(STORAGE_KEY_TOKEN);
}

export function isApiConfigured(): boolean {
  return !!getApiBaseUrl() && !!getApiToken();
}

/**
 * Parse connection URL from QR code: http://192.168.1.x:13456?token=abc...
 */
export function parseConnectionUrl(url: string): {
  baseUrl: string;
  token: string;
} | null {
  try {
    const parsed = new URL(url);
    const t = parsed.searchParams.get("token");
    if (!t) return null;
    parsed.searchParams.delete("token");
    // Remove trailing slash
    const base = parsed.origin;
    return { baseUrl: base, token: t };
  } catch {
    return null;
  }
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${getApiBaseUrl()}${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${getApiToken()}`);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}
