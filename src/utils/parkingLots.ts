/**
 * Danh mục 3 bãi đỗ của hệ thống — nguồn chân lý duy nhất cho mọi nơi cần
 * danh sách bãi (form đặt chỗ, gán staff, bộ lọc manager, lọc dữ liệu staff).
 *
 * Lưu ý lịch sử: tên bãi được lưu dưới 2 biến thể chuỗi — bản ngắn ở
 * users.assigned_parking_lot / trang Manager ("ParkFlow Quận 9") và bản dài ở
 * reservations.parking_lot ("ParkFlow Quận 9 - Lò Lu"). `lotKeyOf` chuẩn hóa
 * mọi biến thể về một key để so sánh, nên đừng so sánh chuỗi tên trực tiếp.
 */

export type LotKey = 'quan9' | 'thuduc' | 'longphuoc';

export type ParkingLotInfo = {
  key: LotKey;
  /** Tên ngắn — dùng cho gán staff, hiển thị quản trị. */
  name: string;
  /** Nhãn đầy đủ trên form đặt chỗ (đã tồn tại trong dữ liệu reservations). */
  bookingLabel: string;
};

export const PARKING_LOTS: ParkingLotInfo[] = [
  { key: 'quan9',     name: 'ParkFlow Quận 9',     bookingLabel: 'ParkFlow Quận 9 - Lò Lu' },
  { key: 'thuduc',    name: 'ParkFlow Thủ Đức',    bookingLabel: 'ParkFlow Thủ Đức - Linh Xuân' },
  { key: 'longphuoc', name: 'ParkFlow Long Phước', bookingLabel: 'ParkFlow Long Phước' },
];

/** Chuẩn hóa mọi biến thể tên bãi về LotKey; null nếu không nhận ra / rỗng. */
export function lotKeyOf(value?: string | null): LotKey | null {
  const v = (value ?? '').toLowerCase();
  if (!v.trim()) return null;
  // "Long Phước" đứng trước vì một số nhãn cũ chứa cả chữ "Thủ Đức" trong địa chỉ
  if (v.includes('long phước') || v.includes('long phuoc')) return 'longphuoc';
  if (v.includes('quận 9') || v.includes('quan 9')) return 'quan9';
  if (v.includes('thủ đức') || v.includes('thu duc')) return 'thuduc';
  return null;
}

/** Hai chuỗi tên bãi (biến thể bất kỳ) có trỏ về cùng một bãi không. */
export function sameLot(a?: string | null, b?: string | null): boolean {
  const ka = lotKeyOf(a);
  return ka !== null && ka === lotKeyOf(b);
}

/**
 * Dữ liệu cũ tạo trước khi hệ thống đa bãi thuộc về bãi gốc (Quận 9) — dùng
 * cho reservations/slots không có trường bãi.
 */
export function lotKeyOrDefault(value?: string | null): LotKey {
  return lotKeyOf(value) ?? 'quan9';
}
