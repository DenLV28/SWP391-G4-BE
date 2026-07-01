/**
 * Reservation store.
 *
 * Reservations are the one piece of state that two different roles act on:
 * a driver creates them, a staff member sees and confirms them. To make that
 * handshake work across page reloads, separate logins (driver → log out →
 * staff) and even separate browser tabs, we persist reservations in
 * localStorage and broadcast changes.
 *
 * When a real backend reservation API exists, swap load/save for fetch calls;
 * the rest of the app talks to reservations through React state either way.
 */

import type { Reservation } from '../data/mockData';

const STORAGE_KEY = 'parkflow.reservations.v1';
/** Fired in the *same* tab after a save (the native 'storage' event only fires in other tabs). */
const LOCAL_EVENT = 'parkflow:reservations-changed';

/** Load persisted reservations, or null if none have been stored yet. */
export function loadReservations(): Reservation[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Reservation[]) : null;
  } catch {
    return null;
  }
}

/** Persist reservations and notify listeners in this tab. */
export function saveReservations(reservations: Reservation[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
  } catch {
    /* storage full or unavailable — ignore, app still works in-memory */
  }
}

/**
 * Subscribe to reservation changes. By default only listens to *other* tabs
 * (native 'storage' event), which avoids a save↔sync loop in the writing tab.
 * Pass { includeSameTab: true } to also react to writes in the current tab.
 * Returns an unsubscribe function.
 */
export function subscribeReservations(
  onChange: (reservations: Reservation[]) => void,
  options: { includeSameTab?: boolean } = {},
): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const next = loadReservations();
      if (next) onChange(next);
    }
  };
  const handleLocal = () => {
    const next = loadReservations();
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

/** Wipe stored reservations (handy for a demo "reset" button). */
export function clearReservations(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
  } catch {
    /* ignore */
  }
}
