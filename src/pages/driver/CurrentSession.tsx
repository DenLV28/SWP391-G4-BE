import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BadgeInfo, Car, CheckCircle, Clock, Lock, MapPin, Ticket, Unlock, X } from 'lucide-react';
import { ParkingSession, PricingRule, Reservation, SavedVehicle, User, Slot, Payment } from '../../data/mockData';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import SectionTitle from '../../components/SectionTitle';
import { createVNPayPayment } from '../../services/vnpayService';
import { createPayment } from '../../services/paymentService';

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
): { totalMins: number; extraHours: number; parkingFee: number; serviceFee: number; total: number } {
  const start = new Date(checkInIso.replace(' ', 'T'));
  const end = new Date(checkOutIso.replace(' ', 'T'));
  const totalMins = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
  const extraHours = totalMins > 60 ? Math.ceil((totalMins - 60) / 60) : 0;
  const parkingFee = rule.firstHourPrice + extraHours * rule.nextHourPrice;
  const serviceFee = rule.extraServiceFee;
  return { totalMins, extraHours, parkingFee, serviceFee, total: parkingFee + serviceFee };
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
}: CurrentSessionProps) {
  // All currently parked vehicles for this user
  const checkedInVehicles = useMemo(
    () => reservations.filter((r) => r.status === 'Checked-in'),
    [reservations],
  );

  // Index of the vehicle that matches currentSession (by licensePlate)
  const primaryIdx = useMemo(
    () => checkedInVehicles.findIndex((r) => r.licensePlate === currentSession.licensePlate),
    [checkedInVehicles, currentSession.licensePlate],
  );

  // Default selection = primary session vehicle (or first)
  const [selectedIdx, setSelectedIdx] = useState<number>(() => Math.max(0, primaryIdx));

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

  const isPrimarySelected =
    hasSession &&
    selectedRes !== null &&
    (selectedRes.licensePlate === currentSession.licensePlate || checkedInVehicles.length === 1);

  // Build a virtual session from reservation when it doesn't map to currentSession
  const virtualSession = useMemo<ParkingSession | null>(() => {
    if (!selectedRes || isPrimarySelected) return null;
    return {
      id: `VIR-${selectedRes.id}`,
      userId: currentUser.id,
      ticketCode: `TMP-${selectedRes.reservationCode}`,
      licensePlate: selectedRes.licensePlate,
      vehicleType: selectedRes.vehicleType,
      checkInTime: `${selectedRes.date} ${selectedRes.startTime}`,
      expectedEndTime: selectedRes.endTime ? `${selectedRes.date} ${selectedRes.endTime}` : undefined,
      entryGate: 'Gate A - Entrance',
      floor: selectedRes.floor,
      area: selectedRes.area,
      slotCode: selectedRes.slotCode ?? '—',
      estimatedFee: selectedRes.estimatedCost ?? 0,
      paymentStatus: 'Unpaid',
      sessionStatus: 'Active',
      barrierStatus: 'Closed',
    };
  }, [selectedRes, isPrimarySelected, currentUser.id]);

  // The session object to drive the detail panel
  const activeSession = isPrimarySelected ? currentSession : virtualSession;

  // Pricing rule for selected vehicle
  const pricingRule = useMemo(
    () =>
      pricingRules.find((rule) => rule.vehicleType === (activeSession?.vehicleType ?? 'car')) ??
      pricingRules[0],
    [pricingRules, activeSession],
  );

  // Pending confirmed reservation (shown when no vehicles are parked at all)
  const pendingReservation =
    checkedInVehicles.length === 0 && !hasSession
      ? reservations.find((r) => r.status === 'Confirmed') ?? null
      : null;

  // ── checkout modal state ──────────────────────────────────────────────────
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkOutTimeInput, setCheckOutTimeInput] = useState(() =>
    new Date().toISOString().slice(0, 16).replace('T', ' '),
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('VNPay');
  const [barrierStatus, setBarrierStatus] = useState<'Closed' | 'Opened'>('Closed');
  const [paymentStatus, setPaymentStatus] = useState<'Unpaid' | 'Paid' | 'Failed'>('Unpaid');
  const [loadingVNPay, setLoadingVNPay] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Refresh current time every 30 seconds to drive overstay detection
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Overstay detection for prepaid reservations
  const overstayInfo = useMemo(() => {
    if (!activeSession || activeSession.paymentStatus !== 'Paid' || !activeSession.expectedEndTime) return null;
    const expectedEnd = new Date(activeSession.expectedEndTime.replace(' ', 'T'));
    const diffMins = Math.floor((nowMs - expectedEnd.getTime()) / 60_000);
    if (diffMins <= 0) return null;
    const periods = Math.ceil(diffMins / 30);
    const fee = periods * (pricingRule?.overtimeRatePer30Minutes ?? 0);
    return { diffMins, periods, fee, expectedEndDisplay: activeSession.expectedEndTime };
  }, [activeSession, pricingRule, nowMs]);

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
    if (!activeSession) return { totalMins: 0, extraHours: 0, parkingFee: 0, serviceFee: 0, total: 0 };
    return calcFee(activeSession.checkInTime, checkOutTimeInput, pricingRule);
  }, [activeSession, checkOutTimeInput, pricingRule]);

  const openCheckout = () => {
    if (!activeSession) return;
    if (activeSession.sessionStatus !== 'Active') {
      alert('Lượt gửi đã hoàn tất hoặc đã bị hủy.');
      return;
    }
    setCheckOutTimeInput(new Date().toISOString().slice(0, 16).replace('T', ' '));
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
        const created = await createPayment({
          id: `PAY-VNP-${Date.now()}`,
          userId: currentUser.id,
          ticketCode: activeSession.ticketCode,
          parkingFee: feeBreakdown.parkingFee,
          extraServiceFee: feeBreakdown.serviceFee,
          lostTicketFee: 0,
          discount: 0,
          totalAmount: checkoutFee,
          method: '',
          status: 'Unpaid',
          createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
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
      <SectionTitle
        title="Lượt gửi hiện tại"
        subtitle="Theo dõi giờ vào, ô đỗ, phí tạm tính và thao tác khi xe ra"
      />

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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {checkedInVehicles.map((res, idx) => {
              const isSelected = idx === selectedIdx;
              const isThisPrimary =
                hasSession && res.licensePlate === currentSession.licensePlate;
              const rule =
                pricingRules.find((r) => r.vehicleType === res.vehicleType) ?? pricingRules[0];
              const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 16);
              const estFee = calcFee(`${res.date} ${res.startTime}`, nowIso, rule).total;

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
                      <span className="font-semibold text-slate-700">{res.startTime.slice(0, 5)}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">Thời gian</span>
                      <span className="font-semibold text-slate-700">
                        {formatDuration(`${res.date} ${res.startTime}`)}
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
            <InfoBox title="Tòa nhà" value="Tòa bãi đỗ trung tâm" />
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

          {/* Overstay notification banner */}
          {overstayInfo && activeSession.sessionStatus === 'Active' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-black text-amber-800">Quá giờ đặt chỗ!</p>
                  <p className="mt-1 text-[12px] text-amber-700">
                    Xe đã quá giờ dự kiến ra (<strong>{formatDateTime(overstayInfo.expectedEndDisplay)}</strong>) được{' '}
                    <strong>{overstayInfo.diffMins} phút</strong>. Phí phát sinh sẽ được tính khi thanh toán.
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="rounded-xl bg-white border border-amber-200 px-2 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-amber-500">Quá giờ</p>
                      <p className="mt-1 font-black text-amber-800">{overstayInfo.diffMins} phút</p>
                    </div>
                    <div className="rounded-xl bg-white border border-amber-200 px-2 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-amber-500">Số kỳ</p>
                      <p className="mt-1 font-black text-amber-800">{overstayInfo.periods} × 30 phút</p>
                    </div>
                    <div className="rounded-xl bg-amber-600 px-2 py-2 text-white">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-amber-100">Phí phát sinh</p>
                      <p className="mt-1 font-black">{formatMoney(overstayInfo.fee)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                  Mô phỏng quét khi ra
                </button>
              </>
            )}
            {activeSession.sessionStatus === 'Completed' && (
              <button
                type="button"
                onClick={() => setView('myparking')}
                className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Quay lại trang của tôi
              </button>
            )}
          </div>
        </div>
      ) : checkedInVehicles.length === 0 && pendingReservation ? (
        /* ── Confirmed reservation waiting for check-in ── */
        <div className="space-y-4 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                Đặt chỗ đã xác nhận — Chờ vào bãi
              </p>
              <p className="text-base font-bold text-slate-800">{pendingReservation.reservationCode}</p>
            </div>
            <span className="ml-auto inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              ĐÃ XÁC NHẬN
            </span>
          </div>

          <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <InfoBox title="Biển số xe" value={pendingReservation.licensePlate || '—'} />
            <InfoBox title="Loại xe" value={vehicleLabel(pendingReservation.vehicleType)} />
            <InfoBox
              title="Thời gian đặt"
              value={`${formatDateTime(`${pendingReservation.date} ${pendingReservation.startTime}`)}${pendingReservation.endTime ? ` – ${pendingReservation.endTime.slice(0, 5)}` : ''}`}
            />
            <InfoBox
              title="Phí dự kiến"
              value={formatMoney(pendingReservation.vehicleType === 'motorbike' ? 10000 : pendingReservation.vehicleType === 'electric vehicle' ? 30000 : 25000)}
              tone="emerald"
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">Vị trí</p>
              <p className="font-bold text-slate-800">
                {pendingReservation.floor} — {pendingReservation.area.split(' - ').pop()}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
            Vui lòng đến bãi xe và bấm <strong>"Check-in"</strong> trong mục{' '}
            <strong>"Đặt chỗ của tôi"</strong> để kích hoạt lượt gửi.
          </div>

          <button
            type="button"
            onClick={() => setView('reservations')}
            className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500"
          >
            Đến trang Đặt chỗ → Check-in
          </button>
        </div>
      ) : checkedInVehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="Chưa có lượt gửi đang hoạt động"
          description="Dữ liệu vào bãi sẽ được tạo tự động từ lịch sử quét cổng."
        />
      ) : null}

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
          subtitle={overstayInfo ? 'Có phí quá giờ — Thanh toán thêm để ra' : 'Đã thanh toán — Xác nhận mở barie'}
        >
          {/* Overstay warning inside modal */}
          {overstayInfo ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="text-xs font-black">Phát hiện quá giờ đặt trước!</p>
              </div>
              <div className="rounded-xl bg-white border border-amber-200 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-400">Giờ kết thúc dự kiến:</span>
                  <span className="font-semibold text-slate-700">{formatDateTime(overstayInfo.expectedEndDisplay)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-400">Quá giờ:</span>
                  <span className="font-semibold text-amber-700">{overstayInfo.diffMins} phút ({overstayInfo.periods} kỳ × 30 phút)</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1">
                  <span className="text-slate-400">Đã thanh toán trước:</span>
                  <span className="font-semibold text-emerald-700">
                    {formatMoney(payments.find((p) => p.ticketCode === activeSession.ticketCode && p.status === 'Paid')?.totalAmount ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-bold text-slate-900">Phí quá giờ phát sinh:</span>
                  <span className="font-black text-rose-600 text-sm">{formatMoney(overstayInfo.fee)}</span>
                </div>
              </div>
              <p className="text-[11px] text-amber-700">
                Bạn cần thanh toán thêm <strong>{formatMoney(overstayInfo.fee)}</strong> phí quá giờ trước khi mở barie.
              </p>
            </div>
          ) : (
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
          )}
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
          {!overstayInfo && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
              Phí đã được thanh toán đầy đủ. Barie sẽ mở ngay khi xác nhận.
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCheckoutModal(false)}
              className="w-1/2 cursor-pointer rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            {overstayInfo ? (
              <button
                type="button"
                onClick={() => {
                  const success = onCheckOutSession(activeSession.ticketCode, 'Cash', overstayInfo.fee);
                  if (success) {
                    setBarrierStatus('Opened');
                    setTimeout(() => setShowCheckoutModal(false), 1000);
                  }
                }}
                className="flex w-1/2 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-3 text-xs font-bold text-white transition hover:bg-amber-500"
              >
                <Unlock className="h-3.5 w-3.5" />
                Trả phí & Mở barie →
              </button>
            ) : (
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
            )}
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
                    setCheckOutTimeInput(next.toISOString().slice(0, 16).replace('T', ' '));
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
              <Row label="Giờ đầu tiên" value={formatMoney(pricingRule.firstHourPrice)} />
              {feeBreakdown.extraHours > 0 && (
                <Row
                  label={`${feeBreakdown.extraHours} giờ tiếp × ${formatMoney(pricingRule.nextHourPrice)}`}
                  value={formatMoney(feeBreakdown.extraHours * pricingRule.nextHourPrice)}
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
