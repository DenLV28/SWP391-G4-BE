import { buildApiUrl, defaultHeaders } from './apiConfig';

export type RfidInfo = {
  rfidUid: string;
  vehicle: {
    id: string;
    licensePlate: string;
    vehicleType: string;
    brand: string;
    model: string;
  };
  owner: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    role: string;
  };
};

export type RfidLookupResult =
  | { ok: true; data: RfidInfo }
  | { ok: false; error: string };

export async function fetchRfidInfo(uid: string): Promise<RfidLookupResult> {
  try {
    const res = await fetch(buildApiUrl(`/api/rfid/${encodeURIComponent(uid)}`), {
      headers: defaultHeaders(),
    });
    const body: { error?: string } & Partial<RfidInfo> = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message: string = body.error || 'Không tìm thấy thẻ RFID.';
      return { ok: false, error: message };
    }
    const data: RfidInfo = body as RfidInfo;
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}

/** Xe ra cổng xong → gỡ liên kết để thẻ dùng lại được cho khách khác. */
export async function unlinkRfidCard(uid: string): Promise<boolean> {
  try {
    const res = await fetch(buildApiUrl('/api/rfid/unlink'), {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ uid }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function linkRfidCard(
  uid: string,
  licensePlate: string,
  vehicleType?: string,
  /** Bãi của cổng đang thao tác — backend chỉ chặn xe thẻ tháng CỦA CHÍNH bãi
   *  này; thẻ tháng mua ở bãi khác thì ở đây khách là khách vãng lai bình thường. */
  parkingLot?: string,
): Promise<{ ok: boolean; error?: string; created?: boolean; code?: string }> {
  try {
    const res = await fetch(buildApiUrl('/api/rfid/link'), {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ uid, licensePlate, vehicleType, parkingLot }),
    });
    const body: { error?: string; created?: boolean; code?: string } = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message: string = body.error || 'Không thể liên kết thẻ.';
      // Trả kèm `code` để nơi gọi phân biệt được lý do từ chối — nhất là
      // MONTHLY_CANNOT_LINK_RFID: xe tháng thì phải DỪNG HẲN luồng vãng lai,
      // không chỉ báo lỗi rồi vẫn cho vào bãi.
      return { ok: false, error: message, code: body.code };
    }
    return { ok: true, created: body.created };
  } catch {
    return { ok: false, error: 'Không kết nối được tới máy chủ.' };
  }
}
