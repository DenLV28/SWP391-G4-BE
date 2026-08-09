/**
 * Nhật ký qua cổng dùng chung giữa Staff (ghi) và Manager (đọc).
 *
 * Nhật ký vốn chỉ nằm trong localStorage của máy staff (accessLogStore.ts) nên
 * Manager không xem được hoạt động của bãi mình phụ trách. Module này đẩy cùng
 * dữ liệu đó lên dbo.access_logs kèm tên bãi, và cho Manager đọc lại.
 *
 * localStorage vẫn giữ nguyên vai trò: staff mất mạng vẫn thấy nhật ký ca của
 * mình. Backend là bản sao để chia sẻ, không phải nguồn duy nhất.
 */
import type { AccessLog } from '../types/staff';

/** Bản ghi Manager đọc về — như AccessLog nhưng biết mình thuộc bãi nào. */
export type SharedAccessLog = AccessLog & { parkingLot: string; loggedAt?: string };

/** Đẩy một hoặc nhiều dòng nhật ký lên backend. Lỗi mạng nuốt im lặng: nhật
 *  ký là dữ liệu phụ trợ, không được phép chặn luồng mở rào ở cổng. */
export async function pushAccessLogs(logs: AccessLog[], parkingLot: string): Promise<boolean> {
  if (!logs.length) return false;
  try {
    const res = await fetch('/api/access-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parkingLot, logs }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Đọc nhật ký. Bỏ trống `lot` để lấy toàn hệ thống (Manager lọc phía UI). */
export async function fetchAccessLogs(lot?: string, limit = 500): Promise<SharedAccessLog[]> {
  try {
    const qs = new URLSearchParams();
    if (lot) qs.set('lot', lot);
    qs.set('limit', String(limit));
    const res = await fetch(`/api/access-logs?${qs.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as SharedAccessLog[]) : [];
  } catch {
    return [];
  }
}
