import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeInfo, Car, CheckCircle, Clock, Lock, MapPin, Search, Ticket, Unlock, X } from 'lucide-react';
import { ParkingSession, PricingRule, Reservation, SavedVehicle, User, Slot, Payment } from '../../data/mockData';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import SectionTitle from '../../components/SectionTitle';
import ConfirmModal from '../../components/ConfirmModal';
import { createVNPayPayment } from '../../services/vnpayService';
import { createPayment, updatePayment } from '../../services/paymentService';
import { perVisitOverstay, overstayDue, buildCheckedInVehicles, realtimeParkingFee } from '../../utils/reservationPricing';
import { nowLocalStr } from '../../utils/helpers';

type PaymentMethod = 'Cash' | 'Card' | 'E-Wallet' | 'QR Banking' | 'Crypto' | 'VNPay';

interface CurrentSessionProps {
  currentSession: ParkingSession;
  setView: (view: string) => void;
  onCheckOutSession: (ticketCode: string, paymentMethod: PaymentMethod, finalAmount: number) => boolean;
  pricingRules: PricingRule[];
  currentUser: User;
  slots: Slot[];
  payments?: Payment[];
  reservations?: Reservation[];
  savedVehicles?: SavedVehicle[];
  onDismissSession?: () => void;
  /** Tiêu đề trang — cổng Staff dùng lại component này dưới tên "Theo dõi bãi xe". */
  title?: string;
  subtitle?: string;
  /** Vé cổng (khách lượt) đang hoạt động — Staff truyền vào để theo dõi xe trong bãi thời gian thực. */
  activeSessions?: ParkingSession[];
  /** Staff truyền vào để có thể hủy đặt chỗ trước của khách ngay tại "Theo dõi bãi xe". */
  onCancelReservation?: (id: string) => void;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function formatMoney(value: number) {
  return value.toLocaleString('vi-VN') + 'đ';
}

function vehicleLabel(type: string) {
  const map: Record<string, string> = {
    car: 'Ô tô 4-7 chỗ (Xăng)',
    motorbike: 'Xe máy / Xe máy điện',
    'electric vehicle': 'Ô tô 4-7 chỗ (Điện)',
  };
  return map[type] ?? type;
}

function vehicleIcon(type: string) {
  if (type === 'motorbike') return '🛵';
  if (type === 'electric vehicle') return '⚡';
  return '🚗';
}

function formatDateTime(value: string) {
  if (!value) return '';
  const d = new Date(value.replace(' ', 'T'));
  if (isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(startIso: string, endIso?: string): string {
  const start = new Date(startIso.replace(' ', 'T'));
  const end = endIso ? new Date(endIso.replace(' ', 'T')) : new Date();
  if (isNaN(start.getTime())) return 'Đang diễn ra';
  const diffMins = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
  if (diffMins < 60) return `${diffMins} phút`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours} giờ${mins > 0 ? ` ${mins} phút` : ''}`;
}

function calcFee(
  checkInIso: string,
  checkOutIso: string,
  rule: PricingRule,
): { totalMins: number; parkingFee: number; nights: number; nightsFee: number; serviceFee: number; total: number } {
  const start = new Date(checkInIso.replace(' ', 'T'));
  const end = new Date(checkOutIso.replace(' ', 'T'));
  const totalMins = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
  // "Theo lượt" là MỘT MỨC GIÁ CỐ ĐỊNH (giá giờ đầu), không cộng dồn theo số
  // giờ đã đỗ. Qua 00:00: cộng thêm giá qua đêm cho mỗi đêm — xem
  // utils/reservationPricing::realtimeParkingFee.
  const fee = realtimeParkingFee(checkInIso, end.getTime(), rule);
  const nights = fee.overstayed ? Math.max(1, Math.round(fee.surcharge / (rule.overnightPrice || 1))) : 0;
  const serviceFee = rule.extraServiceFee;
  return { totalMins, parkingFee: fee.base, nights, nightsFee: fee.surcharge, serviceFee, total: fee.total + serviceFee };
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function CurrentSession({
  currentSession,
  setView,
  onCheckOutSession,
  pricingRules,
  currentUser,
  slots,
  payments = [],
  reservations = [],
  savedVehicles: _savedVehicles = [],
  onDismissSession,
  title = 'Lượt gửi hiện tại',
  subtitle = 'Theo dõi giờ vào, ô đỗ, phí tạm tính và thao tác khi xe ra',
  activeSessions = [],
  onCancelReservation,
}: CurrentSessionProps) {
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  // All currently parked vehicles for this user — includes walk-ins (no prior
  // reservation) synthesized from activeSessions, not just checked-in
  // reservations, so a car that just drove up without booking still shows here.
  const checkedInVehicles = useMemo(
    () => buildCheckedInVehicles(reservations, activeSessions),
    [reservations, activeSessions],
  );

  // Index of the vehicle that matches currentSession (by licensePlate)
  const primaryIdx = useMemo(
    () => checkedInVehicles.findIndex((r) => r.licensePlate === currentSession.licensePlate),
    [checkedInVehicles, currentSession.licensePlate],
  );

  // Default selection = primary session vehicle (or first)
  const [selectedIdx, setSelectedIdx] = useState<number>(() => Math.max(0, primaryIdx));

  // Tìm biển số — lọc thẻ xe hiển thị (bỏ qua dấu gạch/chấm khi so khớp)
  const [plateSearch, setPlateSearch] = useState('');
  const normPlate = (p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, '');
  const searchHits = useMemo(() => {
    const q = normPlate(plateSearch);
    return checkedInVehicles.filter((r) => !q || normPlate(r.licensePlate).includes(q));
  }, [checkedInVehicles, plateSearch]);

  // Keep selection in sync if reservations change (e.g. a vehicle checks out)
  useEffect(() => {
    setSelectedIdx((prev) => {
      if (checkedInVehicles.length === 0) return 0;
      return Math.min(prev, checkedInVehicles.length - 1);
    });
  }, [checkedInVehicles.length]);

  const selectedRes = checkedInVehicles[selectedIdx] ?? null;

  // Is the selected vehicle the one backed by a real ParkingSession?
  const hasSession =
    currentSession?.ticketCode &&
    currentSession.userId === currentUser.id &&
    (currentSession.sessionStatus === 'Active' || currentSession.sessionStatus === 'Completed');

  // dbo.parking_sessions (currentSession) and dbo.reservations (checkedInVehicles)
  // are updated by separate calls and can drift apart — e.g. checkout flips the
  // reservation to "Completed" but that's tracked independently of the session
  // row, and multiple check-ins over time can leave reservations with no row
  // still sitting at "Checked-in" at all. So: default to showing the primary
  // session whenever it exists: only defer to a *different* picked vehicle when
  // the checked-in picker is actually showing one that isn't the primary car.
  const isPrimarySelected =
    hasSession &&
    (selectedRes === null ||
      selectedRes.licensePlate === currentSession.licensePlate ||
      checkedInVehicles.length === 1);

  // Build a virtual session from reservation when it doesn't map to currentSession
  const virtualSession = useMemo<ParkingSession | null>(() => {
    if (!selectedRes || isPrimarySelected) return null;
    // Qua 00:00: đã thanh toán → chỉ còn phần qua đêm phát sinh; chưa → giá vé + phần qua đêm.
    const overstay = perVisitOverstay(selectedRes, pricingRules);
    // The fabricated session must still reflect the real paid state — a Paid
    // payment row linked to this reservation (reservationCode survives the
    // check-in ticketCode rewrite; ticketCode covers legacy rows) means this
    // car has settled its bill even though we have no session row to read.
    const isPaid = payments.some(
      (p) =>
        p.status === 'Paid' &&
        (p.reservationCode === selectedRes.reservationCode ||
          p.ticketCode === selectedRes.reservationCode),
    );
    return {
      id: `VIR-${selectedRes.id}`,
      userId: currentUser.id,
      ticketCode: `TMP-${selectedRes.reservationCode}`,
      licensePlate: selectedRes.licensePlate,
      vehicleType: selectedRes.vehicleType,
      // Mốc check-in THẬT (staff quẹt thẻ) — không phải khung giờ dự kiến lúc
      // đặt, vốn có thể lệch xa giờ xe thực sự vào bãi.
      checkInTime: selectedRes.checkedInAt || `${selectedRes.date} ${selectedRes.startTime}`,
      expectedEndTime: selectedRes.endTime ? `${selectedRes.date} ${selectedRes.endTime}` : undefined,
      entryGate: 'Gate A - Entrance',
      floor: selectedRes.floor,
      area: selectedRes.area,
      slotCode: selectedRes.slotCode ?? '—',
      estimatedFee: overstay.overstayed ? overstayDue(overstay, isPaid) : selectedRes.estimatedCost ?? 0,
      paymentStatus: isPaid ? 'Paid' : 'Unpaid',
      sessionStatus: 'Active',
      barrierStatus: 'Closed',
    };
  }, [selectedRes, isPrimarySelected, currentUser.id, payments, pricingRules]);

  // The session object to drive the detail panel
  const activeSession = isPrimarySelected ? currentSession : virtualSession;

  // Which ParkFlow lot this session belongs to — saved on the reservation when
  // the driver booked (Chọn bãi đỗ). Sessions don't carry it, so resolve via
  // the reservation for the same plate; older bookings predate the field and
  // fall back to the default lot the form always offered.
  const activeLot = useMemo(() => {
    if (!isPrimarySelected) return selectedRes?.parkingLot || 'ParkFlow Quận 9 - Lò Lu';
    const match = reservations.find(
      (r) =>
        r.licensePlate === currentSession.licensePlate &&
        (r.status === 'Checked-in' || r.status === 'Confirmed' || r.status === 'Completed'),
    );
    return match?.parkingLot || 'ParkFlow Quận 9 - Lò Lu';
  }, [isPrimarySelected, selectedRes, reservations, currentSession.licensePlate]);

  // Pricing rule for selected vehicle
  const pricingRule = useMemo(
    () =>
      pricingRules.find((rule) => rule.vehicleType === (activeSession?.vehicleType ?? 'car')) ??
      pricingRules[0],
    [pricingRules, activeSession],
  );

  // Every Confirmed-but-not-checked-in reservation — shown regardless of
  // whether other vehicles are already parked, so a user who booked 3 cars
  // sees all 3 (not just whichever happens to be first/none at all).
  const pendingReservations = useMemo(
    () => reservations.filter((r) => r.status === 'Confirmed'),
    [reservations],
  );

  // ── checkout modal state ──────────────────────────────────────────────────
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showBarrierOpenedModal, setShowBarrierOpenedModal] = useState(false);
  const [checkOutTimeInput, setCheckOutTimeInput] = useState(() => nowLocalStr());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('VNPay');
  const [barrierStatus, setBarrierStatus] = useState<'Closed' | 'Opened'>('Closed');
  const [paymentStatus, setPaymentStatus] = useState<'Unpaid' | 'Paid' | 'Failed'>('Unpaid');
  const [loadingVNPay, setLoadingVNPay] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Đồng hồ thời gian thực (mỗi giây) — cấp cho bảng "Xe trong bãi" của staff
  // lẫn phát hiện quá giờ của driver.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Reset modal state when selected vehicle changes
  const prevIdxRef = useRef(selectedIdx);
  useEffect(() => {
    if (prevIdxRef.current !== selectedIdx) {
      prevIdxRef.current = selectedIdx;
      setShowCheckoutModal(false);
      setShowQRModal(false);
      setBarrierStatus('Closed');
      setPaymentStatus('Unpaid');
    }
  }, [selectedIdx]);

  const checkoutFee = useMemo(() => {
    if (!activeSession) return 0;
    return calcFee(activeSession.checkInTime, checkOutTimeInput, pricingRule).total;
  }, [activeSession, checkOutTimeInput, pricingRule]);

  const feeBreakdown = useMemo(() => {
    if (!activeSession) return { totalMins: 0, parkingFee: 0, nights: 0, nightsFee: 0, serviceFee: 0, total: 0 };
    return calcFee(activeSession.checkInTime, checkOutTimeInput, pricingRule);
  }, [activeSession, checkOutTimeInput, pricingRule]);

  const openCheckout = () => {
    if (!activeSession) return;
    if (activeSession.sessionStatus !== 'Active') {
      alert('Lượt gửi đã hoàn tất hoặc đã bị hủy.');
      return;
    }
    setCheckOutTimeInput(nowLocalStr());
    setPaymentMethod('VNPay');
    setBarrierStatus('Closed');
    setPaymentStatus(activeSession.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid');
    setShowCheckoutModal(true);
  };

  const handleConfirmCheckout = async () => {
    if (!activeSession) return;

    if (paymentMethod === 'VNPay') {
      try {
        setLoadingVNPay(true);
        // Reuse the "Unpaid" placeholder created at check-in (same ticketCode)
        // instead of creating a second record — otherwise the placeholder is
        // left behind forever at "Chưa thanh toán — 0đ" once this new one gets
        // marked Paid, showing up as a phantom extra invoice for the same car.
        const existing = payments?.find(
          (p) => p.ticketCode === activeSession.ticketCode && p.status !== 'Paid',
        );
        const matchedRes = reservations.find(
          (r) => r.licensePlate === activeSession.licensePlate && r.status === 'Checked-in',
        );
        const created = existing
          ? await updatePayment(existing.id, {
              totalAmount: checkoutFee,
              parkingFee: feeBreakdown.parkingFee,
              extraServiceFee: feeBreakdown.serviceFee,
              overtimeFee: feeBreakdown.nightsFee,
            })
          : await createPayment({
              id: `PAY-VNP-${Date.now()}`,
              userId: currentUser.id,
              ticketCode: activeSession.ticketCode,
              reservationCode: matchedRes?.reservationCode,
              parkingFee: feeBreakdown.parkingFee,
              extraServiceFee: feeBreakdown.serviceFee,
              overtimeFee: feeBreakdown.nightsFee,
              lostTicketFee: 0,
              discount: 0,
              totalAmount: checkoutFee,
              method: '',
              status: 'Unpaid',
              createdAt: nowLocalStr(),
            });
        localStorage.setItem(
          'pf_vnpay_ctx',
          JSON.stringify({
            paymentId: created.id,
            sessionId: activeSession.id,
            ticketCode: activeSession.ticketCode,
            amount: checkoutFee,
          }),
        );
        const url = await createVNPayPayment(
          created.id,
          checkoutFee,
          `Thanh toan phi giu xe ${activeSession.ticketCode}`,
        );
        window.location.href = url;
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Không thể kết nối VNPay. Vui lòng thử lại.');
      } finally {
        setLoadingVNPay(false);
      }
      return;
    }

    const success = onCheckOutSession(
      activeSession.ticketCode,
      paymentMethod as Exclude<PaymentMethod, 'VNPay'>,
      checkoutFee,
    );
    if (!success) {
      setPaymentStatus('Failed');
      alert('Giao dịch thanh toán thất bại.');
      return;
    }
    setPaymentStatus('Paid');
    setBarrierStatus('Opened');
    setTimeout(() => setShowCheckoutModal(false), 1200);
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <SectionTitle title={title} subtitle={subtitle} />

      {/* ── XE TRONG BÃI (vé cổng, khách lượt) — thời gian thực từ trạm OCR ── */}
      {activeSessions.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between px-5 py-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Car className="h-4 w-4 text-blue-600" /> Xe đang trong bãi — vé cổng
            </h4>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {activeSessions.length} xe · thời gian thực
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Vé</th>
                  <th className="px-5 py-3">Biển số</th>
                  <th className="px-5 py-3">Loại xe</th>
                  <th className="px-5 py-3">Cổng vào</th>
                  <th className="px-5 py-3">Giờ vào</th>
                  <th className="px-5 py-3">Đã gửi</th>
                  <th className="px-5 py-3 text-right">Phí tạm tính</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.map((s) => {
                  const entry = new Date(s.checkInTime.replace(' ', 'T'));
                  const validEntry = !Number.isNaN(entry.getTime());
                  const elapsedSec = validEntry ? Math.max(0, Math.floor((nowMs - entry.getTime()) / 1000)) : 0;
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const liveDuration = `${pad(Math.floor(elapsedSec / 3600))}:${pad(Math.floor((elapsedSec % 3600) / 60))}:${pad(elapsedSec % 60)}`;
                  const rule = pricingRules.find((p) => p.vehicleType === s.vehicleType);
                  // Xe vào bằng đặt chỗ trước đã có giá chốt (gói "Gửi theo lượt"/"Qua
                  // đêm") — phải dùng perVisitOverstay trên đúng reservation đó (giống
                  // hệt bảng "Xe đang đỗ trong bãi" bên dưới) để 2 nơi luôn khớp số,
                  // thay vì tính lại theo giờ như khách vãng lai thật sự không đặt trước.
                  const matchedReservationForFee = reservations.find(
                    (r) => r.status === 'Checked-in' && normPlate(r.licensePlate) === normPlate(s.licensePlate),
                  );
                  const estFee = matchedReservationForFee
                    ? perVisitOverstay(matchedReservationForFee, pricingRules, nowMs).total
                    : realtimeParkingFee(s.checkInTime, nowMs, rule).total;
                  return (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 font-mono font-semibold text-blue-700">{s.ticketCode || '—'}</td>
                      <td className="px-5 py-3 font-bold text-slate-800">{s.licensePlate}</td>
                      <td className="px-5 py-3 text-slate-600">{vehicleLabel(s.vehicleType)}</td>
                      <td className="px-5 py-3 text-slate-600">{s.entryGate || '—'}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDateTime(s.checkInTime)}</td>
                      <td className="px-5 py-3 font-mono font-semibold text-slate-800">{validEntry ? liveDuration : '—'}</td>
                      <td className="px-5 py-3 text-right font-bold text-rose-600">{formatMoney(estFee)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VEHICLE PICKER (only shown when ≥ 1 parked vehicle) ── */}
      {checkedInVehicles.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Xe đang đỗ trong bãi
              </h4>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {checkedInVehicles.length} xe · Chọn xe để xem chi tiết hoặc thực hiện thao tác
              </p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-[12px] font-black text-white">
              {checkedInVehicles.length}
            </span>
          </div>

          {/* Tìm biển số → xem loại xe & vị trí đỗ */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={plateSearch}
              onChange={(e) => setPlateSearch(e.target.value.toUpperCase())}
              placeholder="Tìm biển số xe (vd: 29C1-38383)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm uppercase tracking-wider focus:border-blue-400 focus:bg-white focus:outline-none"
            />
          </div>
          {plateSearch && (
            <p className="mb-3 text-[11px] text-slate-400">
              {searchHits.length > 0
                ? `Tìm thấy ${searchHits.length} xe khớp "${plateSearch}"`
                : `Không có xe nào khớp "${plateSearch}"`}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {checkedInVehicles.map((res, idx) => {
              // Ẩn thẻ không khớp ô tìm kiếm (giữ nguyên idx thật để chọn đúng xe)
              if (plateSearch && !searchHits.includes(res)) return null;
              const isSelected = idx === selectedIdx;
              const isThisPrimary =
                hasSession && res.licensePlate === currentSession.licensePlate;
              // Same source everywhere this fee is shown (this picker, the
              // detail panel below, and "Trang của tôi"): perVisitOverstay
              // falls back to the pricing rule's first-hour price when there's
              // no quoted estimatedCost (walk-ins with no reservation), so
              // those still show a real number instead of 0đ.
              const estFee = isThisPrimary
                ? currentSession.estimatedFee
                : perVisitOverstay(res, pricingRules, nowMs).total;

              return (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`relative w-full rounded-xl border p-4 text-left transition focus:outline-none ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40'
                  }`}
                >
                  {isThisPrimary && (
                    <span className="absolute right-2 top-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                      Lượt chính
                    </span>
                  )}
                  {isSelected && (
                    <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-blue-500" />
                  )}

                  <div className="flex items-start gap-3 pt-1">
                    <span className="text-2xl leading-none">{vehicleIcon(res.vehicleType)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[15px] font-black text-slate-900">
                        {res.licensePlate}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{vehicleLabel(res.vehicleType)}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">Ô đỗ</span>
                      <span className="font-semibold text-slate-700">{res.slotCode ?? res.floor}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">Giờ vào</span>
                      <span className="font-semibold text-slate-700">
                        {res.checkedInAt ? res.checkedInAt.slice(11, 16) : res.startTime.slice(0, 5)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">Thời gian</span>
                      <span className="font-semibold text-slate-700">
                        {formatDuration(res.checkedInAt || `${res.date} ${res.startTime}`)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">Phí tạm tính</span>
                      <span className="font-semibold text-blue-600">{formatMoney(estFee)}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                      Đang đỗ
                    </span>
                    {isSelected ? (
                      <span className="text-[11px] font-bold text-blue-600">Đang xem ↓</span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Nhấn để chọn →</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PENDING CHECK-IN (Confirmed reservations not yet parked) ──
          Shown independently of the picker above so a user who booked
          multiple cars sees every one of them, whether or not some are
          already checked in. ── */}
      {pendingReservations.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Xe đã đặt chỗ — Chờ vào bãi</h4>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {pendingReservations.length} xe · Chưa check-in tại cổng
              </p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-[12px] font-black text-white">
              {pendingReservations.length}
            </span>
          </div>

          <div className="space-y-4">
            {pendingReservations.map((res) => {
              const estFee =
                res.estimatedCost && res.estimatedCost > 0
                  ? res.estimatedCost
                  : res.vehicleType === 'motorbike' ? 10000 : res.vehicleType === 'electric vehicle' ? 30000 : 25000;
              return (
                <div key={res.id} className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                      <Ticket className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                        Đặt chỗ đã xác nhận — Chờ vào bãi
                      </p>
                      <p className="text-base font-bold text-slate-800">{res.reservationCode}</p>
                    </div>
                    <span className="ml-auto inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      ĐÃ XÁC NHẬN
                    </span>
                  </div>

                  <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <InfoBox title="Biển số xe" value={res.licensePlate || '—'} />
                    <InfoBox title="Loại xe" value={vehicleLabel(res.vehicleType)} />
                    <InfoBox
                      title="Thời gian đặt"
                      value={`${formatDateTime(`${res.date} ${res.startTime}`)}${res.endTime ? ` – ${res.endTime.slice(0, 5)}` : ''}`}
                    />
                    <InfoBox title="Phí dự kiến" value={formatMoney(estFee)} tone="emerald" />
                  </div>

                  <div className="flex items-start gap-2 rounded-xl bg-white px-4 py-3 text-xs">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase text-slate-400">Vị trí</p>
                      <p className="font-bold text-slate-800">
                        {res.slotCode ? `Ô ${res.slotCode} · ` : ''}
                        {res.floor} — {res.area.split(' - ').pop()}
                      </p>
                    </div>
                  </div>

                  {onCancelReservation && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setCancelTarget(res)}
                        className="cursor-pointer rounded-lg border border-rose-200 px-4 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                      >
                        Hủy đặt chỗ
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
            Vui lòng đến bãi xe — nhân viên hoặc hệ thống quét thẻ RFID tại cổng sẽ ghi nhận xe vào và kích hoạt lượt gửi.
          </div>

          <button
            type="button"
            onClick={() => setView('reservations')}
            className="mt-3 cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500"
          >
            Xem chi tiết đặt chỗ
          </button>
        </div>
      )}

      {/* ── SELECTED VEHICLE DETAIL ── */}
      {activeSession ? (
        <div className="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-50 pb-4 sm:flex-row">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mã vé gửi xe</span>
              <h3 className="mt-0.5 text-xl font-bold text-slate-800">{activeSession.ticketCode}</h3>
              {!isPrimarySelected && (
                <p className="mt-1 text-[10px] font-semibold text-amber-600">
                  ⚠ Phiên này được tạo từ đặt chỗ — dữ liệu thực tế cần đồng bộ từ cổng
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={activeSession.sessionStatus} />
              <StatusBadge status={activeSession.paymentStatus} />
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                  activeSession.barrierStatus === 'Opened'
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    : 'border-rose-100 bg-rose-50 text-rose-700'
                }`}
              >
                {activeSession.barrierStatus === 'Opened' ? 'Barie mở' : 'Barie đóng'}
              </span>
            </div>
          </div>

          <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <InfoBox title="Biển số xe" value={activeSession.licensePlate} />
            <InfoBox title="Loại xe" value={vehicleLabel(activeSession.vehicleType)} />
            <InfoBox title="Giờ vào" value={formatDateTime(activeSession.checkInTime)} />
            {activeSession.expectedEndTime ? (
              <InfoBox title="Giờ kết thúc dự kiến" value={formatDateTime(activeSession.expectedEndTime)} tone="blue" />
            ) : (
              <InfoBox title="Phí tạm tính" value={formatMoney(activeSession.estimatedFee || pricingRule.firstHourPrice)} tone="emerald" />
            )}
            <InfoBox title="Bãi đỗ" value={activeLot} />
            <InfoBox title="Tầng" value={activeSession.floor} />
            <InfoBox title="Ô đỗ được gán" value={activeSession.slotCode} tone="blue" />
            <InfoBox title="Thời gian đỗ" value={formatDuration(activeSession.checkInTime)} />
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-800">
              Dòng thời gian lượt gửi
            </h4>
            <div className="relative space-y-4 pl-6 text-xs">
              <div className="absolute bottom-1 top-1 left-[5px] w-px bg-slate-200" />
              {activeSession.sessionStatus === 'Completed' && activeSession.checkOutTime && (
                <TimelineItem
                  tone="emerald"
                  time={formatDateTime(activeSession.checkOutTime)}
                  title="Thanh toán khi ra thành công"
                  description="Lượt gửi đã kết thúc. Barie đã mở và ô đỗ đã được trả về danh sách trống."
                />
              )}
              <TimelineItem
                tone="blue"
                time={formatDateTime(activeSession.checkInTime)}
                title="Xe đã vào cổng"
                description={`Quét barie vào tự động hoàn tất tại ${activeSession.entryGate}.`}
              />
              <TimelineItem
                tone="blue"
                time={formatDateTime(activeSession.checkInTime)}
                title="Đã gán ô đỗ"
                description={`Hệ thống đã cấp ô ${activeSession.slotCode} tại ${activeSession.floor}.`}
              />
              {activeSession.sessionStatus === 'Active' && (
                <TimelineItem
                  tone="indigo"
                  time="Đang diễn ra"
                  title="Xe đang đỗ trong bãi"
                  description="Phí sẽ tăng theo thời gian theo quy định của bãi."
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {activeSession.sessionStatus === 'Active' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowQRModal(true)}
                  className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Xem mã QR vé xe
                </button>
                <button
                  type="button"
                  onClick={openCheckout}
                  className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500"
                >
                  Cho xe ra
                </button>
              </>
            )}
            {activeSession.sessionStatus === 'Completed' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBarrierOpenedModal(true)}
                  className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
                >
                  Mở barie
                </button>
                <button
                  type="button"
                  onClick={() => setView('myparking')}
                  className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Quay lại trang của tôi
                </button>
              </>
            )}
          </div>
        </div>
      ) : checkedInVehicles.length === 0 && pendingReservations.length === 0 ? (
        <EmptyState
          icon={Car}
          title="Chưa có lượt gửi đang hoạt động"
          description="Dữ liệu vào bãi sẽ được tạo tự động từ lịch sử quét cổng."
        />
      ) : null}

      {/* ── Barrier opened confirmation (Completed sessions) ── */}
      {showBarrierOpenedModal && activeSession && (
        <Modal
          onClose={() => {
            setShowBarrierOpenedModal(false);
            onDismissSession?.();
          }}
          title="Mở barie"
          subtitle={activeSession.ticketCode}
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">Mở barie thành công</p>
              <p className="mt-1 text-xs text-slate-500">
                Xe {activeSession.licensePlate} đã rời khỏi bãi. Ô đỗ {activeSession.slotCode} đã được trả về danh sách trống.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowBarrierOpenedModal(false);
              onDismissSession?.();
            }}
            className="w-full cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500"
          >
            Đóng
          </button>
        </Modal>
      )}

      {/* ── QR Modal ── */}
      {showQRModal && activeSession && (
        <Modal onClose={() => setShowQRModal(false)} title="Vé quét khi ra" subtitle={activeSession.ticketCode}>
          <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
            <div className="space-y-1.5 p-2 text-center">
              <span className="block font-mono text-[9px] text-slate-400">MÃ QR ĐIỆN TỬ</span>
              <span className="block font-mono text-xs font-bold text-slate-700">{activeSession.ticketCode}</span>
            </div>
          </div>
          <div className="space-y-1.5 border-t border-slate-100 pt-4 text-left text-[11px] text-slate-500">
            <Row label="Biển số" value={activeSession.licensePlate} />
            <Row label="Tầng / ô" value={`${activeSession.floor} • ${activeSession.slotCode}`} />
            <Row label="Giờ vào" value={formatDateTime(activeSession.checkInTime)} />
          </div>
          <p className="text-[9px] italic text-slate-400">Vui lòng quét tại làn ra để hoàn tất thanh toán.</p>
        </Modal>
      )}

      {/* ── Checkout modal (already paid) ── */}
      {showCheckoutModal && activeSession?.paymentStatus === 'Paid' && (
        <Modal
          onClose={() => setShowCheckoutModal(false)}
          title="Xe ra cổng"
          subtitle="Đã thanh toán — Xác nhận mở barie"
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">Đã thanh toán trước</p>
              <p className="mt-1 text-xs text-slate-500">
                Không cần thanh toán thêm. Xác nhận để hệ thống ghi nhận xe ra và mở barie.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1.5 text-xs">
            {[
              { label: 'Mã vé', value: activeSession.ticketCode },
              { label: 'Biển số xe', value: activeSession.licensePlate },
              { label: 'Loại xe', value: vehicleLabel(activeSession.vehicleType) },
              { label: 'Giờ vào', value: formatDateTime(activeSession.checkInTime) },
              { label: 'Thời gian gửi', value: formatDuration(activeSession.checkInTime) },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-3 border-b border-slate-100 pb-1 last:border-0">
                <span className="text-slate-400">{row.label}:</span>
                <span className="font-semibold text-slate-700">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            Phí đã được thanh toán đầy đủ. Barie sẽ mở ngay khi xác nhận.
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCheckoutModal(false)}
              className="w-1/2 cursor-pointer rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                const paidRecord = payments.find(
                  (p) => p.ticketCode === activeSession.ticketCode && p.status === 'Paid',
                );
                const paidAmt = paidRecord?.totalAmount ?? checkoutFee;
                const success = onCheckOutSession(activeSession.ticketCode, 'QR Banking', paidAmt);
                if (success) {
                  setBarrierStatus('Opened');
                  setTimeout(() => setShowCheckoutModal(false), 1000);
                }
              }}
              className="flex w-1/2 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white transition hover:bg-emerald-500"
            >
              <Unlock className="h-3.5 w-3.5" />
              Mở barie →
            </button>
          </div>
        </Modal>
      )}

      {/* ── Checkout modal (unpaid) ── */}
      {showCheckoutModal && activeSession && activeSession.paymentStatus !== 'Paid' && (
        <Modal onClose={() => setShowCheckoutModal(false)} title="Mô phỏng quét khi xe ra" subtitle="Tóm tắt hóa đơn thanh toán">
          <div className="rounded-2xl border border-indigo-100/50 bg-indigo-50/50 p-4">
            <label className="block text-xs font-bold text-slate-700 mb-2">Chọn thời điểm xe ra</label>
            <input
              type="datetime-local"
              value={checkOutTimeInput.replace(' ', 'T')}
              onChange={(e) => setCheckOutTimeInput(e.target.value.replace('T', ' '))}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
              {['+30 phút', '+2 giờ', '+1 ngày (qua đêm)'].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const next = new Date(
                      Date.now() +
                        (label.includes('30') ? 30 : label.includes('2 giờ') ? 120 : 1440) * 60000,
                    );
                    setCheckOutTimeInput(nowLocalStr(false, next));
                  }}
                  className="cursor-pointer rounded bg-white px-2 py-1 text-slate-600 transition hover:bg-slate-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs space-y-2.5">
            <Row label="Mã vé" value={activeSession.ticketCode} />
            <Row label="Biển số / loại xe" value={`${activeSession.licensePlate} (${vehicleLabel(activeSession.vehicleType)})`} />
            <Row label="Giờ vào" value={formatDateTime(activeSession.checkInTime)} />
            <Row label="Giờ ra thực tế" value={formatDateTime(checkOutTimeInput)} />
            <Row label="Thời gian gửi xe" value={formatDuration(activeSession.checkInTime, checkOutTimeInput)} />
            <div className="border-t border-slate-200/60 pt-2 mt-1 space-y-1.5">
              <Row label="Phí gửi theo lượt" value={formatMoney(feeBreakdown.parkingFee)} />
              {feeBreakdown.nights > 0 && (
                <Row
                  label={`Qua đêm — ${feeBreakdown.nights} đêm × ${formatMoney(pricingRule.overnightPrice)}`}
                  value={formatMoney(feeBreakdown.nightsFee)}
                />
              )}
              {feeBreakdown.serviceFee > 0 && <Row label="Phí dịch vụ" value={formatMoney(feeBreakdown.serviceFee)} />}
              <div className="flex justify-between gap-3 pt-1.5 border-t border-slate-200/60">
                <span className="font-bold text-slate-900">Tổng cộng</span>
                <span className="font-bold text-indigo-600 text-sm">{formatMoney(checkoutFee)}</span>
              </div>
            </div>
            <Row label="Trạng thái thanh toán" value={<StatusBadge status={paymentStatus} />} />
            <Row
              label="Trạng thái barie"
              value={
                <span
                  className={`inline-flex items-center gap-1 rounded border border-dashed bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                    barrierStatus === 'Opened' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {barrierStatus === 'Opened' ? (
                    <><Unlock className="h-2.5 w-2.5" /> Mở</>
                  ) : (
                    <><Lock className="h-2.5 w-2.5" /> Đóng</>
                  )}
                </span>
              }
            />
          </div>

          {paymentStatus === 'Unpaid' && checkoutFee > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] text-blue-700">
              <span className="mt-0.5 text-base leading-none">💳</span>
              <span>
                Bạn sẽ được chuyển đến cổng thanh toán VNPay để hoàn tất. Sau khi thanh toán thành
                công, hóa đơn sẽ được cập nhật tự động và barie mở.
              </span>
            </div>
          )}

          {paymentStatus === 'Failed' && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-600">
              <BadgeInfo className="mt-0.5 h-4 w-4 shrink-0" />
              Giao dịch thanh toán thất bại.
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCheckoutModal(false)}
              className="w-1/2 cursor-pointer rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Hủy mô phỏng
            </button>
            <button
              type="button"
              onClick={handleConfirmCheckout}
              disabled={loadingVNPay}
              className="flex w-1/2 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              {loadingVNPay ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Đang chuyển hướng...
                </>
              ) : (
                <>
                  <span className="text-sm leading-none">💳</span>
                  Thanh toán qua VNPay →
                </>
              )}
            </button>
          </div>
        </Modal>
      )}

      <ConfirmModal
        isOpen={cancelTarget !== null}
        title="Hủy đặt chỗ của khách?"
        message={cancelTarget ? `Đặt chỗ ${cancelTarget.reservationCode} (biển số ${cancelTarget.licensePlate || '—'}) sẽ bị hủy. Khách sẽ nhận được thông báo.` : ''}
        onConfirm={() => {
          if (cancelTarget) onCancelReservation?.(cancelTarget.id);
          setCancelTarget(null);
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoBox({ title, value, tone }: { title: string; value: React.ReactNode; tone?: 'blue' | 'emerald' }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <span className={`block text-[9px] font-semibold uppercase ${tone === 'blue' ? 'text-blue-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-slate-400'}`}>
        {title}
      </span>
      <span className="mt-1 block font-bold text-slate-850">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-200/50 pb-1">
      <span className="text-slate-400">{label}:</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function TimelineItem({
  tone,
  time,
  title,
  description,
}: {
  tone: 'emerald' | 'blue' | 'indigo';
  time: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative">
      <div
        className={`absolute -left-6 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ${
          tone === 'emerald' ? 'bg-emerald-600' : tone === 'indigo' ? 'bg-indigo-500' : 'bg-blue-600'
        } text-white shadow-sm`}
      />
      <div>
        <span className={`block text-[10px] font-semibold ${tone === 'emerald' ? 'text-emerald-600' : tone === 'indigo' ? 'text-indigo-500' : 'text-slate-400'}`}>
          {time}
        </span>
        <span className="block font-bold text-slate-800">{title}</span>
        <p className="mt-0.5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 cursor-pointer rounded-full p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            {subtitle && <span className="text-[10px] font-semibold uppercase text-slate-400">{subtitle}</span>}
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}
