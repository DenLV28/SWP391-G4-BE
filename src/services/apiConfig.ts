const STORAGE_KEY = 'parkflow.backendUrl';
// Build-time env var takes absolute priority (set VITE_API_URL in .env.local at build time)
const ENV_URL: string = (import.meta.env.VITE_API_URL as string) ?? '';

/** Returns the backend base URL in effect right now. */
export function getApiBaseUrl(): string {
  if (ENV_URL) return ENV_URL;
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Builds a full API URL using the current backend base. */
export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
}

/**
 * URL cho các lệnh cần phản hồi TỨC THÌ (mở/đóng rào, lệnh IoT).
 * App giữ nhiều luồng SSE nên pool 6 kết nối/origin của trình duyệt với origin
 * dev (5173) thường kín — request mới phải xếp hàng có khi 20+ giây. Khi chạy
 * qua Vite dev server, gọi THẲNG origin backend (cùng hostname, port 4000,
 * backend đã bật CORS) để dùng pool kết nối riêng còn trống.
 * Có VITE_API_URL/localStorage (ngrok, production) → dùng như buildApiUrl.
 */
export function buildDirectApiUrl(path: string): string {
  const base = getApiBaseUrl();
  if (base) return `${base}${path}`;
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:4000${path}`;
  }
  return path;
}

/** Saves backend URL to localStorage then reloads so every service picks it up. */
export function saveApiBaseUrl(url: string): void {
  const trimmed = url.trim().replace(/\/$/, '');
  try {
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export { STORAGE_KEY as BACKEND_URL_KEY };

/** Common headers for all API requests (includes ngrok bypass). */
export function defaultHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'ngrok-skip-browser-warning': '1',
    ...extra,
  };
}
