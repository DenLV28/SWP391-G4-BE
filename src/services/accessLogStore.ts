import type { AccessLog } from '../types/staff';

const STORAGE_KEY = 'parkflow.accessLogs.v1';
// Giữ tối đa ngần này dòng — nhật ký tích lũy vô hạn theo phiên làm việc sẽ
// làm phình localStorage nếu không cắt bớt.
const MAX_ENTRIES = 300;

export function loadAccessLogs(): AccessLog[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AccessLog[]) : null;
  } catch {
    return null;
  }
}

export function saveAccessLogs(logs: AccessLog[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage full or unavailable — ignore */
  }
}
