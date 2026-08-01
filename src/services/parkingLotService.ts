import { buildApiUrl, defaultHeaders } from './apiConfig';
import type { LotGate, LotGridSlot, ParkingLotInfo } from '../utils/parkingLots';

export type LotStatus = 'Hoạt động' | 'Bảo trì' | 'Đóng cửa';

/** Phần tối thiểu mà các trang cũ đọc (tên + trạng thái) — DTO đầy đủ mở rộng từ đây. */
export type ParkingLotStatus = {
  name: string;
  status: LotStatus;
  updatedAt: string;
};

/** Dữ liệu Admin gửi lên khi tạo/sửa bãi. */
export type ParkingLotInput = {
  name: string;
  bookingLabel?: string;
  address?: string;
  description?: string;
  imageData?: string;
  mapsUrl?: string;
  status?: LotStatus;
  slots?: LotGridSlot[];
  gates?: LotGate[];
};

// Shape phẳng có trường tùy chọn (không phải discriminated union): tsconfig của
// dự án không bật strictNullChecks, dưới đó `if (!result.ok)` không thu hẹp được
// union `{ok:true}|{ok:false}` — caller kiểm tra `!result.ok || !result.lot`.
export type LotMutationResult = { ok: boolean; lot?: ParkingLotInfo; error?: string };

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Danh mục bãi đầy đủ — nguồn chân lý duy nhất cho mọi nơi cần biết bãi nào tồn
 * tại, bãi nào đang Bảo trì (booking của user, dashboard staff, trang quản lý
 * bãi của manager, quản lý bãi của admin).
 */
export async function fetchParkingLots(): Promise<ParkingLotInfo[]> {
  try {
    const res = await fetch(buildApiUrl('/api/parking-lots'), { headers: defaultHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Giữ tên cũ cho các call site chỉ quan tâm tên + trạng thái. */
export const fetchParkingLotStatuses = fetchParkingLots;

export async function createParkingLot(input: ParkingLotInput): Promise<LotMutationResult> {
  try {
    const res = await fetch(buildApiUrl('/api/parking-lots'), {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(input),
    });
    const body = await readJson<ParkingLotInfo & { error?: string }>(res);
    if (!res.ok || !body) return { ok: false, error: body?.error || 'Không thể tạo bãi đỗ.' };
    return { ok: true, lot: body };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

export async function updateParkingLot(id: number, input: ParkingLotInput): Promise<LotMutationResult> {
  try {
    const res = await fetch(buildApiUrl(`/api/parking-lots/${id}`), {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(input),
    });
    const body = await readJson<ParkingLotInfo & { error?: string; lot?: ParkingLotInfo }>(res);
    if (!res.ok || !body) {
      // 409 khi có ô không xóa được: phần còn lại VẪN đã lưu, backend trả kèm
      // bãi sau khi lưu ở `lot` để UI hiển thị đúng thực tế cùng với cảnh báo.
      return { ok: false, error: body?.error || 'Không thể cập nhật bãi đỗ.', lot: body?.lot };
    }
    return { ok: true, lot: body };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

export async function deleteParkingLot(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(buildApiUrl(`/api/parking-lots/${id}`), {
      method: 'DELETE',
      headers: defaultHeaders(),
    });
    if (!res.ok) {
      const body = await readJson<{ error?: string }>(res);
      return { ok: false, error: body?.error || 'Không thể xóa bãi đỗ.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

/** Manager đổi trạng thái vận hành theo tên bãi (không đụng phần metadata). */
export async function updateParkingLotStatus(name: string, status: LotStatus): Promise<ParkingLotInfo | null> {
  try {
    const res = await fetch(buildApiUrl(`/api/parking-lots/${encodeURIComponent(name)}/status`), {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ParkingLotInfo;
  } catch {
    return null;
  }
}
