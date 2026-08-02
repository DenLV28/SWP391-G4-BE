/**
 * Danh mục bãi đỗ của hệ thống — nguồn chân lý duy nhất cho mọi nơi cần danh
 * sách bãi (form đặt chỗ, gán staff, bộ lọc manager, lọc dữ liệu staff).
 *
 * Danh mục này ĐỘNG: dữ liệu đến từ dbo.parking_lots qua GET /api/parking-lots,
 * Admin thêm/sửa/xóa bãi được. Trước đây 4 bãi bị hardcode ở đây nên không bãi
 * nào thêm được. `setLotCatalog` được App.tsx gọi ngay sau mỗi lần fetch; cache
 * cấp module tồn tại để các hàm thuần (lotKeyOf/sameLot) — vốn được gọi từ sâu
 * trong logic lọc, không tiện truyền catalog xuống — vẫn tra cứu được.
 *
 * Lưu ý lịch sử: tên bãi được lưu dưới 2 biến thể chuỗi — bản ngắn ở
 * users.assigned_parking_lot / trang Manager ("ParkFlow Quận 9") và bản dài ở
 * reservations.parking_lot ("ParkFlow Quận 9 - Lò Lu"). `lotKeyOf` chuẩn hóa
 * mọi biến thể về một key để so sánh, nên đừng so sánh chuỗi tên trực tiếp.
 */

/** Khoá bãi — trước là union 4 giá trị cố định, nay là lot_id dạng chuỗi. */
export type LotKey = string;

export type LotStatusValue = 'Hoạt động' | 'Bảo trì' | 'Đóng cửa';

export type LotGate = {
  id?: number;
  kind: 'entry' | 'exit';
  label: string;
  position: 'left' | 'center' | 'right';
};

/**
 * Một ô đỗ trên sơ đồ. `code` là mã hiển thị Admin tự đặt ('A01', 'VIP1'...),
 * không phải slot_code đầy đủ trong DB (đó là `<codePrefix>F1-<code>`).
 * `x`/`y` là toạ độ kéo thả trong hệ toạ độ SVG của sơ đồ; null nghĩa là chưa
 * kéo bao giờ → sơ đồ tự xếp theo công thức lưới mẫu.
 */
export type LotGridSlot = {
  code: string;
  vehicleType: 'car' | 'motorbike' | 'electric vehicle';
  x?: number | null;
  y?: number | null;
  /** Kích thước sau khi Admin kéo dãn; null = cỡ mặc định của lưới mẫu. */
  w?: number | null;
  h?: number | null;
};

export type ParkingLotInfo = {
  id: number;
  key: LotKey;
  /** Tên ngắn — dùng cho gán staff, hiển thị quản trị. */
  name: string;
  /** Nhãn đầy đủ trên form đặt chỗ (đã tồn tại trong dữ liệu reservations). */
  bookingLabel: string;
  status: LotStatusValue;
  updatedAt: string;
  /** Tiền tố mã ô giữ slot_code UNIQUE toàn cục ('TD-', 'LP-', '' cho bãi gốc). */
  codePrefix: string;
  address: string;
  description: string;
  /** Trỏ tới ảnh bundled sẵn của 4 bãi gốc; bãi mới dùng imageData thay thế. */
  imageKey: string;
  imageData: string;
  mapsUrl: string;
  slotCount: number;
  slots: LotGridSlot[];
  gates: LotGate[];
};

// ── Cache cấp module ────────────────────────────────────────────────────────
let CATALOG: ParkingLotInfo[] = [];

/** App.tsx gọi sau mỗi lần tải danh mục bãi từ API. */
export function setLotCatalog(lots: ParkingLotInfo[]): void {
  CATALOG = Array.isArray(lots) ? lots : [];
}

/** Danh mục hiện tại. Component nên đọc qua props/state để re-render đúng. */
export function getLotCatalog(): ParkingLotInfo[] {
  return CATALOG;
}

/**
 * Bí danh cho dữ liệu lịch sử: reservations/users cũ lưu tên bãi ở nhiều biến
 * thể ("Quận 9 - Lò Lu", "ParkFlow Thu Duc"...). Dò theo tên bãi trong danh mục
 * là đủ cho bãi mới, nhưng 4 bãi gốc cần thêm các mẩu chuỗi này để dữ liệu cũ
 * vẫn khớp. Danh sách chỉ dùng làm phương án dự phòng khi dò theo tên trượt.
 */
const LEGACY_NAME_HINTS: { hints: string[]; lotName: string }[] = [
  // "Long Phước" đứng trước vì một số nhãn cũ chứa cả chữ "Thủ Đức" trong địa chỉ
  { hints: ['long phuoc'],            lotName: 'ParkFlow Long Phước' },
  { hints: ['quan 9', 'lo lu'],       lotName: 'ParkFlow Quận 9' },
  { hints: ['thu duc', 'linh xuan'],  lotName: 'ParkFlow Thủ Đức' },
  { hints: ['nha van hoa'],           lotName: 'ParkFlow Nhà Văn Hóa' },
];

/** Bỏ dấu + gộp khoảng trắng để so khớp tên bãi không phụ thuộc cách gõ. */
function normalize(value?: string | null): string {
  // Dải U+0300–U+036F là các dấu tổ hợp NFD tách ra; viết bằng escape thay vì
  // ký tự thẳng để không phụ thuộc cách file được encode.
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chuẩn hóa mọi biến thể tên bãi về LotKey; null nếu không nhận ra / rỗng. */
export function lotKeyOf(value?: string | null): LotKey | null {
  const v = normalize(value);
  if (!v) return null;

  // 1. Khớp chính xác tên hoặc nhãn đặt chỗ.
  const exact = CATALOG.find((l) => normalize(l.name) === v || normalize(l.bookingLabel) === v);
  if (exact) return exact.key;

  // 2. Khớp chứa nhau — bắt các biến thể "…Quận 9 - Lò Lu" ⊃ "…Quận 9".
  //    Ưu tiên tên dài nhất để "Long Phước" không bị "ParkFlow" chung nuốt mất.
  const contains = CATALOG
    .filter((l) => {
      const n = normalize(l.name);
      return n.length > 0 && (v.includes(n) || normalize(l.bookingLabel).includes(v));
    })
    .sort((a, b) => normalize(b.name).length - normalize(a.name).length)[0];
  if (contains) return contains.key;

  // 3. Dự phòng cho dữ liệu lịch sử của 4 bãi gốc.
  for (const { hints, lotName } of LEGACY_NAME_HINTS) {
    if (!hints.some((h) => v.includes(h))) continue;
    const lot = CATALOG.find((l) => l.name === lotName);
    if (lot) return lot.key;
  }
  return null;
}

/** Hai chuỗi tên bãi (biến thể bất kỳ) có trỏ về cùng một bãi không. */
export function sameLot(a?: string | null, b?: string | null): boolean {
  const ka = lotKeyOf(a);
  return ka !== null && ka === lotKeyOf(b);
}

/**
 * Dữ liệu cũ tạo trước khi hệ thống đa bãi thuộc về bãi gốc (Quận 9) — dùng
 * cho reservations/slots không có trường bãi. Bãi gốc là bãi có codePrefix rỗng
 * (mã ô không mang tiền tố); nếu đã bị xóa thì lấy bãi đầu danh mục.
 */
export function lotKeyOrDefault(value?: string | null): LotKey {
  const key = lotKeyOf(value);
  if (key !== null) return key;
  const base = CATALOG.find((l) => l.codePrefix === '') ?? CATALOG[0];
  return base ? base.key : '';
}

/** Tra bãi trong danh mục theo mọi biến thể tên. */
export function findLot(nameOrLabel?: string | null): ParkingLotInfo | undefined {
  const key = lotKeyOf(nameOrLabel);
  if (!key) return undefined;
  return CATALOG.find((l) => l.key === key);
}

/** Tra trạng thái (Hoạt động/Bảo trì/Đóng cửa) của bãi khớp `nameOrLabel` (biến thể tên bất kỳ). */
export function findLotStatus<T extends { name: string; status: string }>(
  lotStatuses: T[],
  nameOrLabel?: string | null,
): T | undefined {
  const key = lotKeyOf(nameOrLabel);
  if (!key) return undefined;
  return lotStatuses.find((l) => lotKeyOf(l.name) === key);
}

/** Bãi đang Bảo trì hoặc Đóng cửa → không cho đặt chỗ / thao tác, chỉ xem. */
export function isLotUnavailable<T extends { name: string; status: string }>(
  lotStatuses: T[],
  nameOrLabel?: string | null,
): boolean {
  const lot = findLotStatus(lotStatuses, nameOrLabel);
  return lot ? lot.status !== 'Hoạt động' : false;
}
