import { buildApiUrl, defaultHeaders } from './apiConfig';

export type LotStatus = 'Hoạt động' | 'Bảo trì' | 'Đóng cửa';

export type ParkingLotStatus = {
  name: string;
  status: LotStatus;
  updatedAt: string;
};

/** Trạng thái vận hành hiện tại của cả 3 bãi — nguồn chân lý duy nhất cho mọi
 * nơi cần biết bãi nào đang Bảo trì (booking của user, dashboard staff, trang
 * quản lý bãi của manager). */
export async function fetchParkingLotStatuses(): Promise<ParkingLotStatus[]> {
  try {
    const res = await fetch(buildApiUrl('/api/parking-lots'), { headers: defaultHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function updateParkingLotStatus(name: string, status: LotStatus): Promise<ParkingLotStatus | null> {
  try {
    const res = await fetch(buildApiUrl(`/api/parking-lots/${encodeURIComponent(name)}`), {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return null;
    return (await res.json()) as ParkingLotStatus;
  } catch {
    return null;
  }
}
