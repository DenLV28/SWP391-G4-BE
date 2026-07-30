import { buildApiUrl, defaultHeaders } from './apiConfig';

/** Standalone lot-design tool for Admin — separate from the live parking_lots/
 * parking_slots tables used by booking/staff/manager (see backend/server.js). */

export type AdminVehicleType = 'car' | 'motorbike' | 'bicycle';
export type AdminSlotStatus = 'Available' | 'Occupied' | 'Maintenance';

export type AdminParkingLot = {
  id: number;
  name: string;
  description: string;
  imageData: string;
  slotCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminParkingSlot = {
  id: number;
  lotId: number;
  code: string;
  vehicleType: AdminVehicleType;
  status: AdminSlotStatus;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
};

export type SlotLayoutPosition = {
  slotId: number;
  x: number;
  y: number;
  rotation?: number;
};

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAdminParkingLots(): Promise<AdminParkingLot[]> {
  try {
    const res = await fetch(buildApiUrl('/api/admin/parking-lots'), { headers: defaultHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Plain optional-field shape (not a discriminated union): this project's
// tsconfig doesn't enable strictNullChecks, under which `if (!result.ok)`
// fails to narrow a `{ok:true}|{ok:false}` union — callers instead check
// `!result.ok || !result.lot`, which narrows fine without strict mode.
export type LotMutationResult = { ok: boolean; lot?: AdminParkingLot; error?: string };

export async function createAdminParkingLot(input: {
  name: string;
  description?: string;
  imageData?: string;
}): Promise<LotMutationResult> {
  try {
    const res = await fetch(buildApiUrl('/api/admin/parking-lots'), {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(input),
    });
    const body = await readJson<AdminParkingLot & { error?: string }>(res);
    if (!res.ok || !body) return { ok: false, error: body?.error || 'Không thể tạo bãi đỗ.' };
    return { ok: true, lot: body };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

export async function updateAdminParkingLot(
  id: number,
  input: { name: string; description?: string; imageData?: string },
): Promise<LotMutationResult> {
  try {
    const res = await fetch(buildApiUrl(`/api/admin/parking-lots/${id}`), {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(input),
    });
    const body = await readJson<AdminParkingLot & { error?: string }>(res);
    if (!res.ok || !body) return { ok: false, error: body?.error || 'Không thể cập nhật bãi đỗ.' };
    return { ok: true, lot: body };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

export async function deleteAdminParkingLot(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(buildApiUrl(`/api/admin/parking-lots/${id}`), {
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

export async function fetchAdminParkingSlots(lotId: number): Promise<AdminParkingSlot[]> {
  try {
    const res = await fetch(buildApiUrl(`/api/admin/parking-lots/${lotId}/slots`), { headers: defaultHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Plain optional-field shape — see LotMutationResult comment above.
export type SlotMutationResult = { ok: boolean; slot?: AdminParkingSlot; error?: string };

export async function createAdminParkingSlot(input: {
  lotId: number;
  code: string;
  vehicleType: AdminVehicleType;
  status?: AdminSlotStatus;
  x: number;
  y: number;
  rotation?: number;
  width?: number;
  height?: number;
}): Promise<SlotMutationResult> {
  try {
    const res = await fetch(buildApiUrl('/api/admin/parking-slots'), {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(input),
    });
    const body = await readJson<AdminParkingSlot & { error?: string }>(res);
    if (!res.ok || !body) return { ok: false, error: body?.error || 'Không thể tạo ô đỗ.' };
    return { ok: true, slot: body };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

export async function updateAdminParkingSlot(
  id: number,
  input: Partial<{
    code: string;
    vehicleType: AdminVehicleType;
    status: AdminSlotStatus;
    x: number;
    y: number;
    rotation: number;
    width: number;
    height: number;
  }>,
): Promise<SlotMutationResult> {
  try {
    const res = await fetch(buildApiUrl(`/api/admin/parking-slots/${id}`), {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(input),
    });
    const body = await readJson<AdminParkingSlot & { error?: string }>(res);
    if (!res.ok || !body) return { ok: false, error: body?.error || 'Không thể cập nhật ô đỗ.' };
    return { ok: true, slot: body };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

export async function deleteAdminParkingSlot(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(buildApiUrl(`/api/admin/parking-slots/${id}`), {
      method: 'DELETE',
      headers: defaultHeaders(),
    });
    if (!res.ok) {
      const body = await readJson<{ error?: string }>(res);
      return { ok: false, error: body?.error || 'Không thể xóa ô đỗ.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

export async function saveAdminParkingLayout(
  lotId: number,
  positions: SlotLayoutPosition[],
): Promise<{ ok: boolean; slots?: AdminParkingSlot[]; error?: string }> {
  try {
    const res = await fetch(buildApiUrl(`/api/admin/parking-lots/${lotId}/layout`), {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(positions),
    });
    const body = await readJson<AdminParkingSlot[] | { error?: string }>(res);
    if (!res.ok || !Array.isArray(body)) {
      return { ok: false, error: (body as { error?: string } | null)?.error || 'Không thể lưu sơ đồ.' };
    }
    return { ok: true, slots: body };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}
