import type { ParkingSession } from '../data/mockData';

const STORAGE_KEY = 'parkflow.sessions.v1';
const LOCAL_EVENT = 'parkflow:sessions-changed';

export function loadSessions(): ParkingSession[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ParkingSession[]) : null;
  } catch {
    return null;
  }
}

export function saveSessions(sessions: ParkingSession[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

export function subscribeSessions(
  onChange: (sessions: ParkingSession[]) => void,
  options: { includeSameTab?: boolean } = {},
): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const next = loadSessions();
      if (next) onChange(next);
    }
  };
  const handleLocal = () => {
    const next = loadSessions();
    if (next) onChange(next);
  };
  window.addEventListener('storage', handleStorage);
  if (options.includeSameTab) {
    window.addEventListener(LOCAL_EVENT, handleLocal as EventListener);
  }
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(LOCAL_EVENT, handleLocal as EventListener);
  };
}
