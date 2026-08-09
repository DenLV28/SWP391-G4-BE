import type { AccessLog } from '../types/staff';

/**
 * Bộ nhớ đệm nhật ký qua cổng trên máy nhân viên — TÁCH RIÊNG THEO TỪNG BÃI.
 *
 * Trước đây toàn hệ thống dùng chung đúng một khoá 'parkflow.accessLogs.v1',
 * nên nhật ký của mọi bãi bị trộn vào một chỗ: nhân viên được chuyển sang bãi
 * khác (hoặc hai nhân viên khác bãi dùng chung một máy) vẫn thấy nguyên nhật ký
 * của bãi cũ, và những dòng đó còn bị đẩy ngược lên server gắn nhãn bãi mới.
 *
 * Nay mỗi bãi có khoá riêng. Bãi là một phần của danh tính bản ghi, không phải
 * thuộc tính phụ.
 */
const KEY_PREFIX = 'parkflow.accessLogs.v2';
/** Khoá dùng chung thời trước — dữ liệu lẫn lộn bãi, không cứu được. */
const LEGACY_KEY = 'parkflow.accessLogs.v1';
// Giữ tối đa ngần này dòng — nhật ký tích lũy vô hạn theo phiên làm việc sẽ
// làm phình localStorage nếu không cắt bớt.
const MAX_ENTRIES = 300;

/** Chuẩn hoá tên bãi thành hậu tố khoá ổn định (bỏ dấu, gộp khoảng trắng). */
function keyOf(parkingLot?: string): string {
  const slug = (parkingLot ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${KEY_PREFIX}::${slug || 'chua-phan-cong'}`;
}

/**
 * Dọn khoá cũ dùng chung. Không cố chia lại dữ liệu đó về từng bãi: các dòng
 * trong đó không mang tên bãi nên không có cách nào biết chúng thuộc bãi nào.
 * Bản trên server (dbo.access_logs) mới là bản có gắn bãi.
 */
function dropLegacy(): void {
  try { window.localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}

export function loadAccessLogs(parkingLot?: string): AccessLog[] | null {
  dropLegacy();
  try {
    const raw = window.localStorage.getItem(keyOf(parkingLot));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AccessLog[]) : null;
  } catch {
    return null;
  }
}

export function saveAccessLogs(logs: AccessLog[], parkingLot?: string): void {
  try {
    window.localStorage.setItem(keyOf(parkingLot), JSON.stringify(logs.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage full or unavailable — ignore */
  }
}
