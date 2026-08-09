import { buildApiUrl, defaultHeaders } from './apiConfig';

/**
 * Báo cáo doanh thu — SỐ LIỆU TỔNG HỢP TẠI SERVER.
 *
 * Trang Quản lý trước đây tải toàn bộ dbo.payments về rồi tự cộng ở trình
 * duyệt, và tự tra ngược bãi qua reservationCode. Hoá đơn nào tra không ra thì
 * bị gán vào bãi mặc định, nên tiền của bãi này hiện sang bãi khác. Toàn bộ
 * phép cộng nay nằm ở /api/reports/revenue, nơi có đủ 3 bảng để nối đúng.
 */
export type RevenueReport = {
  from: string;
  to: string;
  filters: { lot: string; vehicleType: string; method: string };
  /** Doanh thu từng bãi — KHÔNG áp bộ lọc bãi, để luôn so sánh được các bãi. */
  byLot: { lot: string; revenue: number; count: number }[];
  /** Tổng của phần đang xem (đã áp cả bộ lọc bãi). */
  total: number;
  count: number;
  bySource: { source: string; revenue: number; count: number }[];
  byMethod: { method: string; revenue: number; count: number }[];
  /** Theo ngày (YYYY-MM-DD). enters/exits đếm trên vé gửi xe, không phải hoá đơn. */
  byDate: { date: string; revenue: number; count: number; enters: number; exits: number }[];
};

const EMPTY: RevenueReport = {
  from: '', to: '',
  filters: { lot: '', vehicleType: '', method: '' },
  byLot: [], total: 0, count: 0, bySource: [], byMethod: [], byDate: [],
};

/** Số liệu cho trang Tổng quan của Quản lý — tổng hợp tại server. */
export type OverviewReport = {
  today: string;
  todayRevenue: number;
  /** Số giao dịch CỦA CHÍNH HÔM NAY (cùng phạm vi với todayRevenue). */
  todayPaidCount: number;
  /** Xe đang đỗ — đếm vé còn mở, không đếm ô: xe chưa được xếp ô vẫn là xe trong bãi. */
  activeSessions: number;
  totalSlots: number;
  occupiedSlots: number;
  byVehicle: { vehicleType: string; enters: number; exits: number; current: number }[];
  week: { date: string; weekday: number; enters: number }[];
  period: OverviewPeriod;
  periodRevenue: number;
  prevPeriodRevenue: number;
  /** null = kỳ trước chưa có doanh thu nên KHÔNG có % để so sánh. */
  growthPct: number | null;
  /** Lưu lượng theo kỳ: 7 ngày → cột/ngày, tháng → cột/tuần, năm → cột/tháng. */
  chart: { label: string; value: number }[];
};

export type OverviewPeriod = '7days' | 'month' | 'year';

const EMPTY_OVERVIEW: OverviewReport = {
  today: '', todayRevenue: 0, todayPaidCount: 0, activeSessions: 0,
  totalSlots: 0, occupiedSlots: 0, byVehicle: [], week: [],
  period: '7days', periodRevenue: 0, prevPeriodRevenue: 0, growthPct: null, chart: [],
};

export async function fetchOverviewReport(
  lot?: string,
  period?: OverviewPeriod,
): Promise<OverviewReport> {
  try {
    const q = new URLSearchParams({
      ...(lot ? { lot } : {}),
      ...(period ? { period } : {}),
    }).toString();
    const res = await fetch(buildApiUrl(`/api/reports/overview${q ? `?${q}` : ''}`), {
      headers: defaultHeaders(),
    });
    if (!res.ok) return EMPTY_OVERVIEW;
    return (await res.json()) as OverviewReport;
  } catch {
    return EMPTY_OVERVIEW;
  }
}

export async function fetchRevenueReport(params: {
  from: string;
  to: string;
  lot?: string;
  vehicleType?: string;
  method?: string;
}): Promise<RevenueReport> {
  try {
    const q = new URLSearchParams({
      from: params.from,
      to: params.to,
      ...(params.lot ? { lot: params.lot } : {}),
      ...(params.vehicleType ? { vehicleType: params.vehicleType } : {}),
      ...(params.method ? { method: params.method } : {}),
    });
    const res = await fetch(buildApiUrl(`/api/reports/revenue?${q}`), { headers: defaultHeaders() });
    if (!res.ok) return EMPTY;
    return (await res.json()) as RevenueReport;
  } catch {
    return EMPTY;
  }
}
