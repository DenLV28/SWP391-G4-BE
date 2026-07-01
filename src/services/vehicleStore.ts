import type { SavedVehicle } from '../data/mockData';

const STORAGE_KEY = 'parkflow.vehicles.v1';
const LOCAL_EVENT = 'parkflow:vehicles-changed';

export function loadVehicles(): SavedVehicle[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedVehicle[]) : null;
  } catch {
    return null;
  }
}

export function saveVehicles(vehicles: SavedVehicle[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

export function subscribeVehicles(
  onChange: (vehicles: SavedVehicle[]) => void,
  options: { includeSameTab?: boolean } = {},
): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const next = loadVehicles();
      if (next) onChange(next);
    }
  };
  const handleLocal = () => {
    const next = loadVehicles();
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
