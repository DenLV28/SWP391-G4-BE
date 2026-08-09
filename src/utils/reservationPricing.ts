import type { Reservation, PricingRule, Payment, ParkingSession } from '../data/mockData';

/**
 * Xe khách vãng lai đang có vé mở (walk-in, không qua đặt chỗ) chưa có
 * reservation nào khớp biển số — "giả lập" thành Reservation (status luôn
 * Checked-in) để tái dùng mọi UI/hàm tính phí vốn chỉ nhận Reservation.
 */
export function synthesizeWalkInReservations(
  reservations: Reservation[],
  activeSessions: ParkingSession[],
): Reservation[] {
  const reservedPlates = new Set(
    reservations.filter((r) => r.status === 'Checked-in').map((r) => r.licensePlate),
  );
  return activeSessions
    .filter((s) => s.sessionStatus === 'Active' && s.licensePlate && !reservedPlates.has(s.licensePlate))
    .map((s) => ({
      id: `session-${s.id}`,
      userId: s.userId,
      reservationCode: s.ticketCode,
      reservationType: 'Flexible',
      slotAssignmentMode: 'Auto',
      vehicleType: s.vehicleType,
      licensePlate: s.licensePlate,
      date: s.checkInTime.split(' ')[0] || '',
      startTime: s.checkInTime.split(' ')[1] || '00:00',
      floor: s.floor,
      area: s.area,
      slotCode: s.slotCode,
      // BÃI ĐỖ phải đi theo vé. Thiếu trường này thì mọi nơi hiển thị lượt gửi
      // suy ra từ phiên gửi xe đều không biết xe đang ở bãi nào, và rơi vào
      // giá trị mặc định — khách đỗ ở Long Phước lại thấy ghi Quận 9.
      parkingLot: s.parkingLot,
      status: 'Checked-in',
      note: '',
      estimatedCost: s.estimatedFee,
      checkedInAt: s.checkInTime,
    }));
}

/**
 * Xe đang đỗ (Checked-in) của MỘT tài khoản — gộp 2 nguồn: reservations đã
 * check-in (đặt trước) và các phiên gửi xe đang hoạt động (walk-in, không qua
 * đặt chỗ) chưa có reservation nào khớp biển số. Dùng chung giữa "Trang của
 * tôi" (danh sách xe + Phí tạm tính từng xe) và tổng "Số dư chưa thanh toán"
 * để 2 nơi luôn khớp số với nhau.
 */
export function buildCheckedInVehicles(
  reservations: Reservation[],
  activeSessions: ParkingSession[],
): Reservation[] {
  return [
    ...synthesizeWalkInReservations(reservations, activeSessions),
    ...reservations.filter((r) => r.status === 'Checked-in'),
  ];
}

/**
 * Quy tắc tính phí gửi xe theo thời gian thực — áp dụng đồng nhất cho khách
 * vãng lai, khách đặt "Gửi theo lượt" và khách đặt "Qua đêm":
 * - Trong ngày (chưa qua 00:00 kể từ giờ vào): tính theo lượt — MỘT MỨC GIÁ
 *   CỐ ĐỊNH duy nhất (giá giờ đầu), không cộng dồn theo số giờ đã đỗ. Khách
 *   đặt trước dùng đúng giá đã chốt lúc đặt (cũng là một mức cố định).
 * - Mỗi lần đồng hồ qua mốc 00:00 (tính theo NGÀY DƯƠNG LỊCH của giờ vào,
 *   không phải tròn 24h): cộng thêm đúng 1 lần giá "qua đêm" cho đêm đó.
 * - Khách đặt gói "Qua đêm" đã trả trước cho đêm đầu tiên trong giá chốt lúc
 *   đặt, nên chỉ cộng thêm từ đêm thứ 2 trở đi.
 * - Vé CHƯA thanh toán → còn phải thu = base + surcharge (total).
 * - Vé ĐÃ thanh toán   → còn phải thu = chỉ surcharge (phần qua đêm phát sinh).
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Gói "Gửi theo lượt" (Fixed-time có khung giờ). */
export function isPerVisitReservation(r: Reservation): boolean {
  if (r.note?.startsWith('Gửi theo lượt')) return true;
  return r.reservationType === 'Fixed-time' && !!r.endTime;
}

/** Gói "Qua đêm" (Fixed-time không có endTime — xe có thể ở nhiều ngày). */
export function isOvernightReservation(r: Reservation): boolean {
  if (r.note?.startsWith('Qua đêm')) return true;
  return r.reservationType === 'Fixed-time' && !r.endTime;
}

export type PerVisitOverstay = {
  /** Đã qua ít nhất 1 lần 00:00 kể từ giờ vào (đang được tính thêm phí qua đêm). */
  overstayed: boolean;
  /** Phần "theo lượt" — giá theo giờ (vãng lai) hoặc giá đã chốt lúc đặt. */
  base: number;
  /** Phần cộng thêm do qua đêm = (số đêm tính phí) × giá qua đêm. */
  surcharge: number;
  /** base + surcharge — số phải thu khi vé CHƯA thanh toán. */
  total: number;
};

/**
 * Phí gửi xe tính theo thời gian thực dùng chung cho mọi loại vé đang đỗ.
 * `quotedBase` = giá đã chốt lúc đặt (nếu có) — bỏ trống để tính theo giờ
 * (khách vãng lai). `overnightBooked` = true nếu đây là gói "Qua đêm" (giá
 * chốt đã bao gồm đêm đầu tiên).
 */
export function realtimeParkingFee(
  checkInIso: string,
  at: number,
  rule: PricingRule | undefined,
  opts: { quotedBase?: number; overnightBooked?: boolean } = {},
): PerVisitOverstay {
  const fallbackBase = opts.quotedBase ?? rule?.firstHourPrice ?? 0;
  const none: PerVisitOverstay = { overstayed: false, base: fallbackBase, surcharge: 0, total: fallbackBase };
  if (!rule) return none;
  const checkIn = new Date(checkInIso.replace(' ', 'T'));
  if (Number.isNaN(checkIn.getTime())) return none;

  // Mốc 00:00 đầu tiên SAU giờ vào — đỗ 23:50 sang 00:10 vẫn tính là đã qua
  // đêm, không đợi đủ tròn 24 giờ.
  const checkInDayStart = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate()).getTime();
  const firstMidnight = checkInDayStart + ONE_DAY_MS;
  const nightsCrossed = at < firstMidnight ? 0 : Math.floor((at - firstMidnight) / ONE_DAY_MS) + 1;

  if (opts.overnightBooked) {
    const base = opts.quotedBase ?? rule.overnightPrice;
    const extraNights = Math.max(0, nightsCrossed - 1);
    const surcharge = extraNights * rule.overnightPrice;
    return { overstayed: nightsCrossed > 0, base, surcharge, total: base + surcharge };
  }

  // Khách vãng lai (không giá chốt) hoặc gói "Gửi theo lượt" — "theo lượt" là
  // MỘT MỨC GIÁ CỐ ĐỊNH (giá giờ đầu), không cộng dồn thêm theo số giờ đã đỗ
  // trong ngày — khớp đúng cách khách đặt trước "Gửi theo lượt" đã luôn được
  // tính (giá chốt lúc đặt = firstHourPrice, không nhân theo giờ). Phần qua
  // đêm cộng thêm riêng theo số đêm, không phụ thuộc phần "theo lượt" này.
  const base = opts.quotedBase ?? rule.firstHourPrice;
  const surcharge = nightsCrossed * rule.overnightPrice;
  return { overstayed: nightsCrossed > 0, base, surcharge, total: base + surcharge };
}

export function perVisitOverstay(
  r: Reservation,
  rules: PricingRule[] = [],
  at: number = Date.now(),
): PerVisitOverstay {
  const rule = rules.find((x) => x.vehicleType === r.vehicleType) ?? rules[0];
  const flatBase = r.estimatedCost ?? rule?.firstHourPrice ?? 0;
  const none: PerVisitOverstay = { overstayed: false, base: flatBase, surcharge: 0, total: flatBase };

  // Vé tháng (Flexible, gói "Theo tháng") giờ BẮT BUỘC thanh toán trước khi
  // được tạo (xem AvailableSlots.handlePayThenBookMonthly) — nghĩa là mọi vé
  // tháng đang tồn tại trong hệ thống đã luôn được trả tiền từ đầu. Không áp
  // mô hình theo lượt/qua đêm thực tế của bãi, và KHÔNG hiện lại giá tháng
  // như một khoản "còn phải thu" mỗi khi xe đang đỗ trong bãi — total phải là
  // 0, không phải r.estimatedCost (giá tháng đã trả).
  if (r.reservationType === 'Flexible' && r.note === 'Theo tháng') {
    return { overstayed: false, base: 0, surcharge: 0, total: 0 };
  }
  // Chỉ tính khi xe THẬT SỰ đang ở trong bãi — chưa check-in thì chưa phát sinh phí.
  if (r.status !== 'Checked-in') return none;

  const checkInStamp = r.checkedInAt || `${r.date} ${r.startTime}`;
  const quotedBase = r.estimatedCost != null && r.estimatedCost > 0 ? r.estimatedCost : undefined;
  return realtimeParkingFee(checkInStamp, at, rule, {
    quotedBase,
    overnightBooked: isOvernightReservation(r),
  });
}

/** Số phút user còn được tự hủy đơn (kể từ lúc tạo) trước khi chỉ staff mới hủy được. */
export const SELF_CANCEL_WINDOW_MINUTES = 5;

/** Số phút đã trôi qua kể từ khi đơn được tạo — dùng cho cửa sổ tự hủy 5 phút. */
export function minutesSinceCreated(r: Reservation, now: number = Date.now()): number {
  const base = r.createdAt || `${r.date} ${r.startTime}`;
  const [datePart, timePart] = base.split(' ');
  const [year, month, day] = (datePart || '').split('-').map(Number);
  const [hour, min] = (timePart ?? '00:00').split(':').map(Number);
  const createdMs = new Date(year, (month || 1) - 1, day || 1, hour || 0, min || 0).getTime();
  if (Number.isNaN(createdMs)) return Infinity;
  return (now - createdMs) / 60000;
}

/** Vé đã có giao dịch Paid gắn với nó chưa (reservationCode giữ nguyên qua check-in; ticketCode cho bản ghi cũ). */
export function isReservationPaid(r: Reservation, payments: Payment[] = []): boolean {
  return payments.some(
    (p) =>
      p.status === 'Paid' &&
      (p.reservationCode === r.reservationCode || p.ticketCode === r.reservationCode),
  );
}

/** Số tiền còn phải thu khi quá giờ: đã thanh toán → chỉ phụ phí; chưa → giá vé + phụ phí. */
export function overstayDue(info: PerVisitOverstay, paid: boolean): number {
  return paid ? info.surcharge : info.total;
}

/**
 * Hóa đơn "đã hủy thanh toán" — không còn ý nghĩa gì và KHÔNG được tính vào
 * bất kỳ tổng tiền/nợ nào của khách (Số dư chưa thanh toán, danh sách Thanh
 * toán...): backend đã đánh dấu Failed, hoặc còn Unpaid nhưng đặt chỗ gắn với
 * nó (qua reservationCode/ticketCode) đã Cancelled/Expired hoặc bị xóa hẳn
 * (hủy ngay sau khi vừa đặt). Payment không gắn đặt chỗ (vé phiên gửi xe
 * walk-in, ticketCode không có dạng RSV-xxxx) thì không bị coi là hủy ở đây.
 */
export function isPaymentVoided(payment: Payment, reservations: Reservation[]): boolean {
  if (payment.status === 'Paid') return false;
  if (payment.status === 'Failed') return true;
  const code = payment.reservationCode || payment.ticketCode;
  if (!code) return false;
  const res = reservations.find((r) => r.reservationCode === code);
  if (res) return res.status === 'Cancelled' || res.status === 'Expired';
  return /^RSV-/i.test(code);
}

/** Cùng công thức "+1 tháng" dùng khắp nơi cho thẻ tháng (đặt chỗ của driver,
 *  quét QR thẻ tháng của staff, danh sách thẻ tháng của manager). */
export function addOneMonth(value: string): string {
  const d = new Date(`${value.split('T')[0]}T00:00:00`);
  if (isNaN(d.getTime())) return value;
  d.setMonth(d.getMonth() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const normalizePlate = (p: string) => String(p || '').trim().toUpperCase().replace(/\s+/g, '');

/**
 * Thẻ tháng ("Theo tháng") của biển số này còn hiệu lực không (chưa hủy/hết
 * hạn VÀ hôm nay vẫn trong khoảng ngày đăng ký → +1 tháng)? Cố ý KHÔNG dựa
 * vào `status` (Pending/Confirmed/Checked-in/Completed) — thẻ tháng dao động
 * qua lại giữa Checked-in/Completed mỗi lần xe ra/vào trong tháng, "Completed"
 * không có nghĩa là thẻ đã hết hạn. Dùng để chặn đặt thêm thẻ tháng thứ 2 cho
 * cùng một xe khi thẻ hiện tại chưa hết hạn.
 */
export function findActiveMonthlyReservation(
  licensePlate: string,
  reservations: Reservation[],
  todayIso: string = new Date().toISOString().slice(0, 10),
): Reservation | undefined {
  const plate = normalizePlate(licensePlate);
  if (!plate) return undefined;
  return reservations.find((r) => {
    if (r.note !== 'Theo tháng') return false;
    if (r.status === 'Cancelled' || r.status === 'Expired') return false;
    if (normalizePlate(r.licensePlate) !== plate) return false;
    const start = r.date.split('T')[0];
    return todayIso <= addOneMonth(start);
  });
}
