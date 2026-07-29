import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Car, CheckCircle, Clock3, Info, Moon, Triangle, X } from 'lucide-react';
import { PricingRule, Reservation, SavedVehicle, Slot, User, VehicleKey, validateLicensePlate } from '../../data/mockData';
import parkingSecurityImage from '../../assets/images/an-ninh.jpg';
import VietQRModal from '../../components/VietQRModal';
import ParkingFloorMap, { MapSlot } from '../../components/ParkingFloorMap';
import { createVNPayPayment } from '../../services/vnpayService';
import { createPayment } from '../../services/paymentService';
import { PARKING_LOTS, lotKeyOrDefault, isLotUnavailable } from '../../utils/parkingLots';
import type { ParkingLotStatus } from '../../services/parkingLotService';
import { nowLocalStr } from '../../utils/helpers';
import { addOneMonth, findActiveMonthlyReservation } from '../../utils/reservationPricing';

interface Props {
  setView: (view: string) => void;
  slots: Slot[];
  isLoggedIn: boolean;
  currentUser: User | null;
  savedVehicles: SavedVehicle[];
  onAddReservation: (res: any) => Reservation | null;
  onCancelReservation?: (id: string) => void;
  /** Hủy ngay đặt chỗ vừa tạo từ modal thành công — xóa hẳn, không lưu bản ghi Cancelled. */
  onDiscardReservation?: (id: string) => void;
  reservations: Reservation[];
  pricingRules: PricingRule[];
  lotStatuses?: ParkingLotStatus[];
}

type PackageKey = 'hour' | 'overnight' | 'month';

// LƯU Ý: không dùng toISOString() ở đây — nó quy đổi về UTC, nên từ 00:00 đến
// trước 07:00 giờ Việt Nam (UTC+7) sẽ trả về NGÀY HÔM QUA. Phải lấy đúng
// ngày/tháng/năm theo giờ địa phương của trình duyệt (giờ Việt Nam).
const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const WEEKDAY_VI = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** '2026-07-25' → 'Thứ Bảy, 25/07/2026' — chỉ dùng để hiển thị "hôm nay". */
function formatTodayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${WEEKDAY_VI[d.getDay()]}, ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Selectable arrival times for overnight/multi-day bookings — every 30 minutes.
const ARRIVAL_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

/** Grace window after the scheduled arrival before the booking is auto-cancelled. */
export const CHECKIN_GRACE_HOURS = 2;

/** Next half-hour slot from now (+10' buffer) — sensible default arrival for per-visit bookings. */
function nextHalfHourLabel(): string {
  const d = new Date(Date.now() + 10 * 60 * 1000);
  let h = d.getHours();
  let m = d.getMinutes() === 0 ? 0 : d.getMinutes() <= 30 ? 30 : 0;
  if (m === 0 && d.getMinutes() > 30) h += 1;
  if (h > 23) { h = 23; m = 30; }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** '18:00' + 2h → '20:00' (wraps past midnight; endTime is informational only). */
function addHoursLabel(hhmm: string, hours: number): string {
  const h = (Number(hhmm.slice(0, 2)) + hours) % 24;
  return `${String(h).padStart(2, '0')}:${hhmm.slice(3, 5)}`;
}

const PRICING_ROW_META: Record<VehicleKey, { sub: string; unit: string }> = {
  motorbike: { sub: 'Mô tô, tay ga, xe điện 2 bánh', unit: '/lượt' },
  car: { sub: 'Sedan, SUV, Hatchback', unit: '/giờ' },
  'electric vehicle': { sub: 'EV + trạm sạc kèm theo', unit: '/giờ' },
};

// Danh sách bãi lấy từ nguồn chung — nhãn giữ nguyên như dữ liệu đặt chỗ cũ.
const LOT_OPTIONS = PARKING_LOTS.map((l) => l.bookingLabel);

// Legend items

const vehicleLabelMap: Record<string, string> = {
  car: 'Ô tô 4-7 chỗ (Xăng)',
  motorbike: 'Xe máy / Xe máy điện',
  'electric vehicle': 'Ô tô 4-7 chỗ (Điện / EV)',
};

export default function AvailableSlots({
  setView,
  slots,
  isLoggedIn,
  currentUser,
  savedVehicles,
  onAddReservation,
  onCancelReservation,
  onDiscardReservation,
  reservations,
  pricingRules,
  lotStatuses = [],
}: Props) {
  // Hủy từ modal thành công: ưu tiên xóa hẳn; thiếu prop thì rơi về hủy thường.
  const discardBooking = (id: string) => (onDiscardReservation ?? onCancelReservation)?.(id);
  const [selectedLot, setSelectedLot] = useState(LOT_OPTIONS[0]);
  const [fullName, setFullName] = useState(currentUser?.fullName ?? 'Nguyễn Văn A');
  const [phone, setPhone] = useState(currentUser?.phone ?? '090 123 4567');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleKey>('car');
  const [packageKey, setPackageKey] = useState<PackageKey>('hour');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [bookedReservation, setBookedReservation] = useState<Reservation | null>(null);
  // Per-visit & overnight/multi-day: the customer picks when they'll actually arrive.
  const [arrivalDate, setArrivalDate] = useState(todayISO);
  const [arrivalTime, setArrivalTime] = useState('18:00');
  const [showPayNow, setShowPayNow] = useState(false);

  // Each package gets a sensible default arrival: evening for overnight stays,
  // the next upcoming half-hour for per-visit parking.
  useEffect(() => {
    setArrivalDate(todayISO());
    setArrivalTime(packageKey === 'overnight' ? '18:00' : nextHalfHourLabel());
  }, [packageKey]);

  // Chỉ nhận đặt chỗ trong ngày — "Ngày đến" không còn là ô chọn, luôn khóa
  // theo ngày thực tế. Đồng bộ định kỳ để nếu trang mở qua nửa đêm thì ngày
  // hiển thị vẫn tự chuyển sang hôm mới, không bị đứng ở ngày hôm qua.
  useEffect(() => {
    const syncToday = () => {
      const today = todayISO();
      setArrivalDate((prev) => (prev === today ? prev : today));
    };
    const id = setInterval(syncToday, 30_000);
    return () => clearInterval(id);
  }, []);
  const [loadingVNPay, setLoadingVNPay] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  const userVehicles = useMemo(
    () => savedVehicles.filter((v) => v.userId === currentUser?.id),
    [savedVehicles, currentUser?.id],
  );

  // Sync name/phone when user changes
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName);
      setPhone(currentUser.phone);
    }
  }, [currentUser?.id, currentUser?.fullName, currentUser?.phone]);

  // Auto-select default vehicle
  useEffect(() => {
    const uv = savedVehicles.filter((v) => v.userId === currentUser?.id);
    const def = uv.find((v) => v.isDefault) ?? uv[0] ?? null;
    if (def) {
      setSelectedVehicleId(def.id);
      setVehicleType(def.vehicleType as VehicleKey);
      setLicensePlate(def.licensePlate);
    } else {
      setSelectedVehicleId(null);
      setLicensePlate('');
      setVehicleType('car');
    }
  }, [savedVehicles, currentUser?.id]);

  const handleSelectVehicle = (v: SavedVehicle) => {
    setSelectedVehicleId(v.id);
    setVehicleType(v.vehicleType as VehicleKey);
    setLicensePlate(v.licensePlate);
  };

  // Mỗi bãi có kho ô đỗ riêng — sơ đồ và việc gán ô chỉ nhìn ô của bãi đã chọn.
  const lotSlots = useMemo(
    () => slots.filter((s) => lotKeyOrDefault(s.parkingLot) === lotKeyOrDefault(selectedLot)),
    [slots, selectedLot],
  );

  // Đổi bãi thì ô đã chọn (thuộc bãi cũ) không còn hợp lệ.
  useEffect(() => {
    setSelectedSlotId(null);
  }, [selectedLot]);

  const matchedSlot = useMemo(() => {
    // Only look up a real slot — skip virtual map spaces (no backing data)
    if (selectedSlotId && !selectedSlotId.startsWith('virtual-')) {
      const found = lotSlots.find((s) => s.id === selectedSlotId);
      if (found) return found;
    }
    // Auto-assign: prefer matching vehicle type, then fallback
    const order: VehicleKey[] = [vehicleType, 'car', 'motorbike', 'electric vehicle'];
    for (const type of order) {
      const slot = lotSlots.find((s) => s.status === 'Available' && s.vehicleType === type);
      if (slot) return slot;
    }
    return lotSlots.find((s) => s.status === 'Available') ?? null;
  }, [lotSlots, vehicleType, selectedSlotId]);

  // Bãi đã hết ô trống phù hợp loại xe đang chọn — chặn đặt chỗ và báo rõ cho
  // khách thay vì để họ loay hoay tìm ô trên sơ đồ mà không có ô nào để chọn.
  const isLotFull = useMemo(
    () => !lotSlots.some((s) => s.status === 'Available' && s.vehicleType === vehicleType),
    [lotSlots, vehicleType],
  );

  // Bãi đang Bảo trì/Đóng cửa → chỉ cho xem sơ đồ, chặn hẳn việc đặt chỗ.
  const isLotUnderMaintenance = useMemo(
    () => isLotUnavailable(lotStatuses, selectedLot),
    [lotStatuses, selectedLot],
  );

  const reservationMeta = useMemo(() => {
    if (packageKey === 'overnight')
      // Overnight/multi-day: arrival is user-chosen; no fixed end (car may stay several days).
      return { reservationType: 'Fixed-time' as const, startTime: arrivalTime, endTime: undefined, label: 'Qua đêm' };
    if (packageKey === 'month')
      return { reservationType: 'Flexible' as const, startTime: '09:00', endTime: undefined, label: 'Theo tháng' };
    // Per-visit: user-chosen arrival with an indicative 2-hour window.
    return { reservationType: 'Fixed-time' as const, startTime: arrivalTime, endTime: addHoursLabel(arrivalTime, 2), label: 'Gửi theo lượt' };
  }, [packageKey, arrivalTime]);

  // Package price comes straight from Manager's live pricing_rules — "lượt"
  // uses the first-hour/flat rate, "qua đêm" the overnight rate, "tháng" the
  // monthly rate. Falls back to the car rule (or 0) if a type isn't priced yet.
  const estimatedCost = useMemo(() => {
    const rule = pricingRules.find((r) => r.vehicleType === vehicleType) ?? pricingRules[0];
    if (!rule) return 0;
    if (packageKey === 'month') return rule.monthlyPrice;
    if (packageKey === 'overnight') return rule.overnightPrice;
    return rule.firstHourPrice;
  }, [vehicleType, packageKey, pricingRules]);

  const pricingRows = useMemo(
    () =>
      pricingRules.map((rule) => ({
        key: rule.vehicleType,
        label: vehicleLabelMap[rule.vehicleType] ?? rule.vehicleType,
        sub: PRICING_ROW_META[rule.vehicleType]?.sub ?? '',
        price: `${rule.firstHourPrice.toLocaleString('vi-VN')}đ`,
        unit: PRICING_ROW_META[rule.vehicleType]?.unit ?? '/lượt',
      })),
    [pricingRules],
  );

  const isSlotExplicitlySelected = selectedSlotId !== null && !selectedSlotId.startsWith('virtual-');

  const handleBook = () => {
    // Debounce: block re-entry while a submission is already in flight, so a
    // rapid double-click (or double Enter-key) can't fire onAddReservation twice.
    if (isSubmittingBooking) return;
    if (!isLoggedIn) { setView('login'); return; }
    // Bãi đang bảo trì — chặn TRƯỚC mọi kiểm tra khác, không chỉ dựa vào nút
    // đã bị vô hiệu hoá (trạng thái có thể vừa đổi ngay trước khi bấm).
    if (isLotUnderMaintenance) {
      alert('Bãi đỗ này đang tạm ngưng nhận xe để bảo trì. Vui lòng chọn bãi khác hoặc quay lại sau.');
      return;
    }
    // Kiểm tra lại lúc bấm (không chỉ dựa vào nút đã bị vô hiệu hoá) — sơ đồ
    // cập nhật theo thời gian thực nên ô vừa chọn có thể vừa bị người khác
    // đặt mất ngay trước khi bấm; luôn báo rõ ràng thay vì lỗi chung chung.
    if (isLotFull || !matchedSlot || matchedSlot.status !== 'Available') {
      alert('Rất tiếc, bãi đỗ hiện đã hết chỗ trống phù hợp với loại xe bạn chọn. Vui lòng thử lại sau.');
      setSelectedSlotId(null);
      return;
    }
    if (!isSlotExplicitlySelected) {
      alert('Vui lòng chọn ô đỗ trên sơ đồ bãi trước khi đặt chỗ.');
      return;
    }
    const plateErr = validateLicensePlate(licensePlate);
    if (plateErr) { alert(plateErr); return; }
    if (packageKey !== 'month') {
      // A past arrival would be auto-cancelled by the 2-hour no-show rule
      // almost immediately — reject it up front instead.
      const arrival = new Date(`${arrivalDate}T${arrivalTime}:00`);
      if (Number.isNaN(arrival.getTime()) || arrival.getTime() < Date.now()) {
        alert('Giờ đến dự kiến phải ở thời điểm tương lai. Vui lòng chọn lại.');
        return;
      }
    }
    // Gửi theo tháng bắt buộc thanh toán trước — đặt chỗ chỉ được TẠO sau khi
    // VNPay xác nhận thành công, không tạo đơn Pending rồi mới hỏi thanh toán
    // như 2 gói còn lại (khách có thể lách bằng "Thanh toán sau").
    if (packageKey === 'month') {
      // Mỗi xe chỉ được 1 thẻ tháng còn hiệu lực tại một thời điểm — chặn TRƯỚC
      // khi cho thanh toán, tránh mất tiền oan rồi mới bị từ chối tạo đặt chỗ.
      const existingMonthly = findActiveMonthlyReservation(licensePlate, reservations ?? []);
      if (existingMonthly) {
        alert(
          `Xe ${licensePlate.trim().toUpperCase()} đang có một thẻ tháng còn hiệu lực (${existingMonthly.reservationCode}, hết hạn ${addOneMonth(existingMonthly.date.split('T')[0])}). Vui lòng đợi thẻ hết hạn rồi mới đặt lại.`,
        );
        return;
      }
      void handlePayThenBookMonthly();
      return;
    }
    setIsSubmittingBooking(true);
    try {
      const created = onAddReservation({
        reservationType: reservationMeta.reservationType,
        slotAssignmentMode: 'Auto',
        vehicleType,
        licensePlate: licensePlate.trim().toUpperCase(),
        date: arrivalDate,
        startTime: reservationMeta.startTime,
        endTime: reservationMeta.endTime,
        floor: matchedSlot.floorName,
        area: matchedSlot.areaName,
        slotCode: matchedSlot.slotCode,
        note: reservationMeta.label,
        estimatedCost,
        parkingLot: selectedLot,
      });
      if (created) setBookedReservation(created);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  /** Gói tháng: tạo hóa đơn Unpaid + lưu tạm thông tin đặt chỗ vào localStorage
   *  (khớp mẫu `pf_vnpay_ctx` đã dùng cho các luồng VNPay khác), rồi chuyển
   *  thẳng sang VNPay. Đặt chỗ THẬT chỉ được tạo ở VNPayReturn sau khi thanh
   *  toán thành công (xem `pf_pending_monthly_booking` trong App.tsx) — nếu
   *  khách không thanh toán/hủy giữa chừng, không có đặt chỗ nào được tạo. */
  const handlePayThenBookMonthly = async () => {
    if (!currentUser || !matchedSlot) return;
    setIsSubmittingBooking(true);
    setLoadingVNPay(true);
    const reservationCode = `RSV-${Math.floor(1000 + Math.random() * 9000)}`;
    const paymentId = `PAY-${reservationCode}-${Date.now()}`;
    const plateVal = licensePlate.trim().toUpperCase();
    try {
      const pendingBooking = {
        reservationCode,
        reservationType: reservationMeta.reservationType,
        // Không khóa cứng slotCode: ô đã xem lúc đặt có thể bị chiếm mất trong
        // lúc khách thao tác trên trang VNPay — để backend tự xếp ô Available
        // còn trống cùng khu/tầng/loại xe tại đúng thời điểm thanh toán xong.
        slotAssignmentMode: 'Auto' as const,
        vehicleType,
        licensePlate: plateVal,
        date: todayISO(),
        startTime: reservationMeta.startTime,
        endTime: reservationMeta.endTime,
        floor: matchedSlot.floorName,
        area: matchedSlot.areaName,
        note: reservationMeta.label,
        estimatedCost,
        parkingLot: selectedLot,
      };
      localStorage.setItem('pf_pending_monthly_booking', JSON.stringify({ paymentId, booking: pendingBooking }));
      await createPayment({
        id: paymentId,
        userId: currentUser.id,
        ticketCode: reservationCode,
        reservationCode,
        licensePlate: plateVal,
        parkingFee: estimatedCost,
        extraServiceFee: 0,
        lostTicketFee: 0,
        discount: 0,
        totalAmount: estimatedCost,
        method: '',
        status: 'Unpaid',
        createdAt: nowLocalStr(),
      });
      const url = await createVNPayPayment(paymentId, estimatedCost, `Dat xe thang ${reservationCode}`);
      window.location.href = url;
    } catch (err) {
      localStorage.removeItem('pf_pending_monthly_booking');
      alert(err instanceof Error ? err.message : 'Không thể kết nối VNPay. Vui lòng thử lại.');
      setIsSubmittingBooking(false);
      setLoadingVNPay(false);
    }
  };

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    handleBook();
  };

  const handlePayVNPay = async () => {
    if (!bookedReservation || !currentUser) return;
    try {
      setLoadingVNPay(true);
      const paymentId = `PAY-${bookedReservation.reservationCode}-${Date.now()}`;
      await createPayment({
        id: paymentId,
        userId: currentUser.id,
        ticketCode: bookedReservation.reservationCode,
        reservationCode: bookedReservation.reservationCode,
        licensePlate: bookedReservation.licensePlate,
        parkingFee: estimatedCost,
        extraServiceFee: 0,
        lostTicketFee: 0,
        discount: 0,
        totalAmount: estimatedCost,
        method: '',
        status: 'Unpaid',
        createdAt: nowLocalStr(),
      });
      const url = await createVNPayPayment(
        paymentId,
        estimatedCost,
        `Dat cho truoc ${bookedReservation.reservationCode}`,
      );
      window.location.href = url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể kết nối VNPay. Vui lòng thử lại.');
      setLoadingVNPay(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="space-y-6">

          {/* ── Form + Pricing (2-col) ── */}
          <div className="grid gap-6 lg:grid-cols-[7fr_5fr] lg:items-start">

            {/* LEFT: Booking form (without map) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Thông tin đặt chỗ</h2>

              {!isLoggedIn && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-700 leading-6">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                  Bạn đang xem ở chế độ khách. Hãy đăng nhập để xác nhận đặt chỗ.
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Chọn bãi đỗ */}
                <Field label="Chọn bãi đỗ">
                  <div className="relative">
                    <select
                      value={selectedLot}
                      onChange={(e) => setSelectedLot(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-[15px] text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                    >
                      {LOT_OPTIONS.map((opt) => (
                        <option key={opt}>
                          {isLotUnavailable(lotStatuses, opt) ? `${opt} (Đang bảo trì)` : opt}
                        </option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </Field>

                {/* Name + Phone */}
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Họ và tên">
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="h-12 w-full rounded-xl border border-slate-300 px-4 text-[15px] outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                    />
                  </Field>
                  <Field label="Số điện thoại">
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="090 123 4567"
                      className="h-12 w-full rounded-xl border border-slate-300 px-4 text-[15px] outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                    />
                  </Field>
                </div>

                {/* Plate + Type */}
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Biển số xe">
                    <input
                      value={licensePlate}
                      onChange={(e) => { setLicensePlate(e.target.value.toUpperCase()); setSelectedVehicleId(null); }}
                      placeholder="29C1-38383"
                      className="h-12 w-full rounded-xl border border-slate-300 px-4 text-[15px] uppercase outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                    />
                  </Field>
                  <Field label="Loại phương tiện">
                    <div className="relative">
                      <select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value as VehicleKey)}
                        className="h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-10 text-[15px] outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                      >
                        <option value="motorbike">Xe máy / Xe máy điện</option>
                        <option value="car">Ô tô 4-7 chỗ (Xăng)</option>
                        <option value="electric vehicle">Ô tô 4-7 chỗ (Điện / EV)</option>
                      </select>
                      <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </Field>
                </div>

                {/* Vehicle quick-select (logged in) */}
                {isLoggedIn && userVehicles.length > 0 && (
                  <div>
                    <span className="mb-3 block text-[14px] font-semibold text-slate-700">Chọn xe đã lưu</span>
                    <div className="flex flex-wrap gap-2">
                      {userVehicles.map((v) => {
                        const isSelected = selectedVehicleId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleSelectVehicle(v)}
                            className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left text-[14px] transition ${
                              isSelected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                            }`}
                          >
                            <Car className="h-4 w-4 shrink-0" />
                            <div>
                              <div className="font-semibold leading-tight">{v.licensePlate}</div>
                              <div className="text-[12px] text-slate-500 leading-tight">
                                {vehicleLabelMap[v.vehicleType] ?? v.vehicleType}
                                {v.brand ? ` · ${v.brand}` : ''}
                                {v.isDefault ? ' · Mặc định' : ''}
                              </div>
                            </div>
                            {isSelected && <CheckCircle className="h-4 w-4 text-blue-600 ml-1 shrink-0" />}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => { setSelectedVehicleId(null); setLicensePlate(''); setVehicleType('car'); }}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[14px] transition ${
                          selectedVehicleId === null ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'
                        }`}
                      >
                        + Nhập thủ công
                      </button>
                    </div>
                  </div>
                )}

                {/* Parking map — above duration picker */}
                <div>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="text-[14px] font-semibold text-slate-700">Sơ đồ bãi đỗ — Chọn ô đỗ</span>
                    <div className="flex items-center gap-2 text-[10px]">
                      {[
                        { color: 'bg-white border border-blue-400', label: 'Trống' },
                        { color: 'bg-green-600', label: 'Đang đỗ' },
                        { color: 'bg-amber-400', label: 'Đã đặt' },
                        { color: 'bg-slate-200', label: 'Loại xe khác' },
                      ].map((l) => (
                        <span key={l.label} className="flex items-center gap-1 text-slate-500">
                          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${l.color}`} />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 overflow-hidden">
                    <ParkingFloorMap
                      slots={lotSlots.map((s) => ({ id: s.id, code: s.slotCode.split('-').pop() ?? s.slotCode, status: s.status } as MapSlot))}
                      selectedId={selectedSlotId}
                      onSelect={(id) => setSelectedSlotId((prev) => (prev === id ? null : id))}
                      interactive={true}
                      level={1}
                      filterVehicleType={
                        vehicleType === 'motorbike' ? 'motorbike' :
                        vehicleType === 'electric vehicle' ? 'ev' :
                        'car'
                      }
                    />
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <span className="mb-3 block text-[14px] font-semibold text-slate-700">Thời gian gửi dự kiến</span>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: 'hour' as const, icon: Clock3, label: 'Gửi theo lượt' },
                      { key: 'overnight' as const, icon: Moon, label: 'Qua đêm' },
                      { key: 'month' as const, icon: CalendarDays, label: 'Theo tháng' },
                    ].map((item) => {
                      const Icon = item.icon;
                      const active = packageKey === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setPackageKey(item.key)}
                          className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-center transition ${
                            active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[13px] font-semibold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Arrival schedule — per-visit & overnight customers pick when they'll arrive */}
                {packageKey !== 'month' && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-4">
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="Ngày đến">
                        <div className="flex h-12 w-full items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 text-[15px] text-slate-700">
                          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate font-semibold">{formatTodayLabel(arrivalDate)}</span>
                        </div>
                      </Field>
                      <Field label="Giờ đến dự kiến">
                        <div className="relative">
                          <select
                            value={arrivalTime}
                            onChange={(e) => setArrivalTime(e.target.value)}
                            className="h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-10 text-[15px] outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                          >
                            {ARRIVAL_TIME_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
                          </svg>
                        </div>
                      </Field>
                    </div>
                    <p className="flex items-start gap-2 text-[12px] leading-5 text-slate-600">
                      <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                      <span>
                        Hệ thống chỉ nhận đặt chỗ <strong>trong ngày</strong> — chọn giờ bạn sẽ đưa xe đến bãi hôm nay.{' '}
                        Nếu bạn không check-in trong vòng <strong>{CHECKIN_GRACE_HOURS} giờ</strong> sau giờ
                        đến dự kiến, đặt chỗ sẽ <strong>tự động bị hủy</strong> để nhường chỗ cho khách khác —
                        nếu bạn đã thanh toán trước, <strong>số tiền đó sẽ không được hoàn lại</strong>.
                      </span>
                    </p>
                    <p className="flex items-start gap-2 text-[12px] leading-5 text-amber-700">
                      <Triangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500 fill-amber-500" />
                      <span>
                        Xe đỗ qua <strong>0h00</strong> sẽ được tự động cộng thêm <strong>giá qua đêm</strong> cho mỗi
                        đêm ở lại (mỗi xe).{' '}
                        {packageKey === 'overnight'
                          ? 'Giá đã chốt lúc đặt tính cho đêm đầu tiên — chỉ cộng thêm từ đêm thứ 2 trở đi.'
                          : 'Vé đã thanh toán chỉ thu phần phát sinh qua đêm; vé chưa thanh toán thu đủ giá vé + phần qua đêm.'}
                      </span>
                    </p>
                  </div>
                )}

                {packageKey === 'month' && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                    <p className="flex items-start gap-2 text-[12px] leading-5 text-slate-600">
                      <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                      <span>
                        Gửi xe <strong>theo tháng</strong> yêu cầu <strong>thanh toán trước qua VNPay</strong> ngay khi đặt —
                        đặt chỗ chỉ được tạo sau khi thanh toán thành công, không có lựa chọn "thanh toán sau".
                      </span>
                    </p>
                  </div>
                )}

                {/* Selected slot indicator */}
                {isLotUnderMaintenance ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                    <Triangle className="h-4 w-4 shrink-0" />
                    <span>
                      <strong>Bãi đang tạm ngưng để bảo trì</strong> — chưa thể đặt chỗ, vui lòng chọn bãi khác hoặc quay lại sau.
                    </span>
                  </div>
                ) : isLotFull ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                    <Triangle className="h-4 w-4 shrink-0" />
                    <span>
                      <strong>Bãi đã hết chỗ</strong> cho loại xe bạn chọn — vui lòng đặt lại sau hoặc thử loại xe/bãi khác.
                    </span>
                  </div>
                ) : isSlotExplicitlySelected && matchedSlot ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>
                      Ô đã chọn: <strong>{matchedSlot.slotCode}</strong> — {matchedSlot.floorName} · {matchedSlot.areaName}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
                    <Triangle className="h-4 w-4 shrink-0" />
                    <span>Vui lòng chọn ô đỗ trên sơ đồ phía trên <strong>(bắt buộc)</strong></span>
                  </div>
                )}

                {/* Submit — stays inside form for enter-key support */}
                <button
                  type={isLoggedIn ? 'submit' : 'button'}
                  onClick={() => { if (!isLoggedIn) setView('login'); }}
                  disabled={isLoggedIn && (isLotUnderMaintenance || isLotFull || !isSlotExplicitlySelected || isSubmittingBooking)}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition hover:bg-blue-700 mt-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {!isLoggedIn
                    ? 'Đăng nhập để đặt chỗ'
                    : isLotUnderMaintenance
                    ? 'Bãi đang bảo trì'
                    : isLotFull
                    ? 'Bãi đã hết chỗ'
                    : isSubmittingBooking
                    ? (packageKey === 'month' ? 'Đang chuyển tới VNPay...' : 'Đang xử lý...')
                    : packageKey === 'month'
                    ? 'Thanh toán & Đặt chỗ tháng'
                    : 'Xác nhận đặt chỗ'}
                  <ArrowRight className="h-5 w-5" />
                </button>
              </form>
            </section>

            {/* RIGHT: Pricing + AI card */}
            <aside className="space-y-6">
              {/* Pricing */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="mb-4 text-[13px] font-bold uppercase tracking-widest text-blue-700">Tham khảo giá</p>
                <div className="space-y-3">
                  {pricingRows.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-blue-300"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                          <Car className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-slate-800">{row.label}</p>
                          <p className="text-[13px] text-slate-500">{row.sub}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[16px] font-bold text-blue-600">{row.price}</p>
                        <p className="text-[12px] text-slate-400">{row.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Warning */}
                <div className="mt-3 flex gap-3 border-t border-slate-100 pt-4 text-[13px] text-slate-600">
                  <Triangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500 fill-amber-500" />
                  <p>
                    <strong>Lưu ý:</strong> Sau 2 tiếng nếu xe chưa đến thì hệ thống sẽ tự động xóa chỗ đã đặt trước.
                  </p>
                </div>
              </div>

              {/* AI card */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <img
                  src={parkingSecurityImage}
                  alt="ParkFlow AI"
                  className="h-48 w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <h3 className="text-xl font-bold leading-tight">An tâm tuyệt đối với ParkFlow</h3>
                  <p className="mt-1 text-[13px] text-white/85">Hệ thống nhận diện biển số tự động chính xác 99.9%</p>
                </div>
              </div>
            </aside>
          </div>


        </div>
      </main>

      {/* ── Success modal ── */}
      {bookedReservation && !showPayNow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            {/* Đóng modal bằng X = HỦY đặt chỗ vừa tạo — không tự giữ chỗ khi
                user không xác nhận hướng thanh toán. */}
            <button
              type="button"
              onClick={() => {
                discardBooking(bookedReservation.id);
                setBookedReservation(null);
              }}
              title="Hủy đặt chỗ này"
              className="absolute right-4 top-4 text-slate-400 hover:text-rose-600 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Đặt chỗ thành công!</h3>
              <p className="text-[11px] text-slate-400">
                Mã đặt chỗ: <strong className="font-mono text-slate-700">{bookedReservation.reservationCode}</strong>
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-1.5 text-[11px]">
              {[
                { label: 'Bãi đỗ', value: bookedReservation.parkingLot || '—' },
                { label: 'Biển số xe', value: bookedReservation.licensePlate },
                { label: 'Ô đỗ', value: `${bookedReservation.slotCode} · ${bookedReservation.floor}` },
                { label: 'Ngày giờ', value: `${bookedReservation.date} ${bookedReservation.startTime}` },
                { label: 'Phí ước tính', value: `${estimatedCost.toLocaleString('vi-VN')}đ`, blue: true },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-slate-400">{row.label}</span>
                  <span className={row.blue ? 'font-bold text-blue-700' : 'font-semibold text-slate-700'}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  discardBooking(bookedReservation.id);
                  setBookedReservation(null);
                }}
                className="flex-1 rounded-xl border border-rose-200 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
              >
                Hủy đặt chỗ
              </button>
              <button
                type="button"
                onClick={() => { setBookedReservation(null); setView('reservations'); }}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Thanh toán sau
              </button>
              <button
                type="button"
                onClick={handlePayVNPay}
                disabled={loadingVNPay}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {loadingVNPay ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Đang chuyển...
                  </>
                ) : (
                  '💳 Thanh toán VNPay'
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {bookedReservation && showPayNow && (
        <VietQRModal
          amount={estimatedCost}
          description={`ParkFlow ${bookedReservation.reservationCode}`}
          onConfirm={() => { setShowPayNow(false); setBookedReservation(null); setView('reservations'); }}
          onClose={() => setShowPayNow(false)}
          onPayLater={() => { setShowPayNow(false); setBookedReservation(null); setView('reservations'); }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
