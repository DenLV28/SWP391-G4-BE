/**
 * Feedback store.
 *
 * Feedbacks cross role boundaries: a driver submits them, a staff member
 * sees and responds to them. To make that handshake work across page
 * reloads, separate logins (driver → log out → staff) and separate browser
 * tabs, we persist feedbacks in localStorage and broadcast changes.
 */

import type { Feedback } from '../data/mockData';

const STORAGE_KEY = 'parkflow.feedbacks.v1';
const LOCAL_EVENT = 'parkflow:feedbacks-changed';

export function loadFeedbacks(): Feedback[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Feedback[]) : null;
  } catch {
    return null;
  }
}

export function saveFeedbacks(feedbacks: Feedback[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(feedbacks));
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

export function subscribeFeedbacks(
  onChange: (feedbacks: Feedback[]) => void,
  options: { includeSameTab?: boolean } = {},
): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const next = loadFeedbacks();
      if (next) onChange(next);
    }
  };
  const handleLocal = () => {
    const next = loadFeedbacks();
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
