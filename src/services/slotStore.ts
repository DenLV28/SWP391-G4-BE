import type { Slot } from '../data/mockData';

const STORAGE_KEY = 'parkflow.slots.v1';
const LOCAL_EVENT  = 'parkflow:slots-changed';

export function loadSlots(): Slot[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Slot[]) : null;
  } catch {
    return null;
  }
}

export function saveSlots(slots: Slot[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
  } catch {
    /* storage full — ignore, app still works in-memory */
  }
}

export function subscribeSlots(
  onChange: (slots: Slot[]) => void,
  options: { includeSameTab?: boolean } = {},
): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const next = loadSlots();
      if (next) onChange(next);
    }
  };
  const handleLocal = () => {
    const next = loadSlots();
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
