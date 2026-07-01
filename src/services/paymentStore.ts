import type { Payment } from '../data/mockData';

const STORAGE_KEY = 'parkflow.payments.v1';
const LOCAL_EVENT = 'parkflow:payments-changed';

export function loadPayments(): Payment[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Payment[]) : null;
  } catch {
    return null;
  }
}

export function savePayments(payments: Payment[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

export function subscribePayments(
  onChange: (payments: Payment[]) => void,
  options: { includeSameTab?: boolean } = {},
): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const next = loadPayments();
      if (next) onChange(next);
    }
  };
  const handleLocal = () => {
    const next = loadPayments();
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
