import type { SavedVehicle, VehicleKey } from '../data/mockData';
import { buildApiUrl as buildUrl } from './apiConfig';
const headers = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'ngrok-skip-browser-warning': '1' });

export interface VehicleRecord {
  id: string | number;
  userId: string | number;
  licensePlate: string;
  vehicleType: string;
  brand: string;
  model: string;
  isDefault: boolean;
}

function toSavedVehicle(r: VehicleRecord): SavedVehicle {
  return {
    id: String(r.id),
    userId: String(r.userId),
    licensePlate: r.licensePlate,
    vehicleType: r.vehicleType as VehicleKey,
    brand: r.brand ?? '',
    model: r.model ?? '',
    isDefault: Boolean(r.isDefault),
  };
}

/**
 * Dựng Error mang theo thông báo & mã lỗi của backend.
 *
 * Backend từ chối có lý do đọc được (409 VEHICLE_DUPLICATE — trùng cả biển lẫn
 * loại xe; 409 VEHICLE_IN_USE — xe đang đỗ trong bãi). Nuốt thành
 * "Vehicle API 409" là mất sạch phần hữu ích nhất cho người dùng.
 */
async function apiError(res: Response): Promise<Error & { code?: string; status?: number }> {
  let message = `Vehicle API ${res.status}`;
  let code = '';
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
    if (body?.code) code = body.code;
  } catch { /* body không phải JSON — dùng thông báo mặc định */ }
  const err = new Error(message) as Error & { code?: string; status?: number };
  err.code = code;
  err.status = res.status;
  return err;
}

/** Fetch all vehicles for a specific user from the backend. */
export async function fetchVehiclesByUser(userId: string): Promise<SavedVehicle[]> {
  const res = await fetch(buildUrl(`/api/vehicles?userId=${encodeURIComponent(userId)}`), {
    headers: headers(),
  });
  if (!res.ok) throw await apiError(res);
  const data = await res.json();
  const list: VehicleRecord[] = Array.isArray(data)
    ? data
    : Array.isArray(data.vehicles)
      ? data.vehicles
      : [];
  return list.map(toSavedVehicle);
}

/** Create a vehicle in the backend. */
export async function createVehicle(payload: {
  userId: string;
  licensePlate: string;
  vehicleType: string;
  brand: string;
  model: string;
  isDefault: boolean;
}): Promise<SavedVehicle> {
  const res = await fetch(buildUrl('/api/vehicles'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await apiError(res);
  const data = await res.json();

  // 202 = đã ghi nhận đăng ký nhưng CHƯA chuyển quyền sở hữu, vì xe còn đang
  // đỗ trong bãi. Không có bản ghi xe trả về — ném ra để nơi gọi báo cho người
  // dùng và KHÔNG thêm xe vào hồ sơ, thay vì vỡ khi đọc `data.vehicle`.
  if (res.status === 202 || !data?.vehicle) {
    const err = new Error(
      data?.message || 'Đã ghi nhận đăng ký — quyền sở hữu sẽ chuyển khi xe ra khỏi bãi.',
    ) as Error & { code?: string; status?: number };
    err.code = data?.code || 'OWNERSHIP_PENDING';
    err.status = res.status;
    throw err;
  }

  const record: VehicleRecord = data.vehicle;
  return toSavedVehicle(record);
}

/** Update a vehicle's license plate, type, brand and model. */
export async function updateVehicle(
  vehicleId: string,
  payload: { licensePlate: string; vehicleType: string; brand: string; model: string },
): Promise<SavedVehicle> {
  const res = await fetch(buildUrl(`/api/vehicles/${vehicleId}`), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await apiError(res);
  const data = await res.json();
  const record: VehicleRecord = data.vehicle ?? data;
  return toSavedVehicle(record);
}

/** Mark a vehicle as default (unset others for the same user). */
export async function setDefaultVehicle(vehicleId: string): Promise<void> {
  const res = await fetch(buildUrl(`/api/vehicles/${vehicleId}/default`), {
    method: 'PUT',
    headers: headers(),
  });
  if (!res.ok) throw await apiError(res);
}

/** Xóa hẳn một phương tiện khỏi dbo.vehicles. */
export async function deleteVehicle(vehicleId: string): Promise<void> {
  const res = await fetch(buildUrl(`/api/vehicles/${vehicleId}`), {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw await apiError(res);
}
