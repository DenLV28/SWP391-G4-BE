import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  FileText,
  History,
  MapPin,
  Printer,
  Ticket,
  Trash2,
  X,
} from 'lucide-react';
import {
  Area,
  Floor,
  ParkingSession,
  Payment,
  PricingRule,
  Reservation,
  SavedVehicle,
  Slot,
  SystemConfig,
  User,
} from '../../data/mockData';
import ConfirmModal from '../../components/ConfirmModal';
import parkingHeroImage from '../../assets/images/parkflow_bg_1779336618673.png';
import QRCode from 'react-qr-code';
// isReservationPaid: file này đã có sẵn hàm cục bộ cùng logic (dùng cho getPaymentStatusMeta)
import { perVisitOverstay, overstayDue, minutesSinceCreated, SELF_CANCEL_WINDOW_MINUTES, synthesizeWalkInReservations } from '../../utils/reservationPricing';

export default function MyReservations({
  reservations,
  activeSessions = [],
  payments = [],
  onAddReservation: _onAddReservation,
  onCancelReservation,
  floors: _floors,
  areas: _areas,
  slots,
  driverStatus: _driverStatus,
  savedVehicles,
  systemConfig: _systemConfig,
  onExpireReservation,
  onClearHistory,
  setView: _setView,
  currentUser,
  currentSession,
  pricingRules = [],
}: {
  reservations: Reservation[];
  /** Phiên gửi xe đang hoạt động của tài khoản — bổ sung xe vãng lai (không đặt chỗ trước) vào danh sách. */
  activeSessions?: ParkingSession[];
  payments?: Payment[];
  onAddReservation: (reservation: any) => void;
  onCancelReservation: (id: string) => void;
  floors: Floor[];
  areas: Area[];
  slots: Slot[];
  driverStatus: string;
  savedVehicles: SavedVehicle[];
  systemConfig: SystemConfig;
  onExpireReservation: (id: string) => void;
  onClearHistory?: (ids: string[]) => void;
  setView: (view: string) => void;
  currentUser: User;
  currentSession: ParkingSession;
  pricingRules?: PricingRule[];
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [detailReservation, setDetailReservation] = useState<Reservation | null>(null);
  const [invoiceReservation, setInvoiceReservation] = useState<Reservation | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Xe vãng lai đang đỗ (không qua đặt chỗ trước) — không có bản ghi
  // reservation nào nên tự thân sẽ không bao giờ xuất hiện ở "Lịch sử đỗ xe"
  // trừ khi được bổ sung thủ công vào đây (giả lập thành Reservation trạng
  // thái "Checked-in" để tái dùng nguyên UI danh sách bên dưới).
  const allReservations = useMemo(
    () => [...reservations, ...synthesizeWalkInReservations(reservations, activeSessions)],
    [reservations, activeSessions],
  );

  const reservationStats = useMemo(() => {
    return allReservations.reduce(
      (acc, reservation) => {
        acc.total += 1;
        if (reservation.status === 'Confirmed') acc.confirmed += 1;
        if (reservation.status === 'Pending') acc.pending += 1;
        if (reservation.status === 'Completed') acc.completed += 1;
        if (reservation.status === 'Checked-in') acc.checkedIn += 1;
        return acc;
      },
      { total: 0, confirmed: 0, pending: 0, completed: 0, checkedIn: 0 },
    );
  }, [allReservations]);

  const sortedReservations = useMemo(() => {
    return [...allReservations].sort((a, b) => {
      const first = new Date(`${b.date}T${b.startTime}:00`).getTime();
      const second = new Date(`${a.date}T${a.startTime}:00`).getTime();
      return first - second;
    });
  }, [allReservations]);

  const filteredReservations = useMemo(() => {
    return sortedReservations.filter((reservation) => {
      const matchesStatus = statusFilter === 'all' || reservation.status === statusFilter;
      const matchesVehicle = vehicleFilter === 'all' || reservation.vehicleType === vehicleFilter;
      const query = searchText.trim().toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        reservation.reservationCode.toLowerCase().includes(query) ||
        reservation.licensePlate.toLowerCase().includes(query) ||
        trimAreaName(reservation.area).toLowerCase().includes(query);

      return matchesStatus && matchesVehicle && matchesSearch;
    });
  }, [searchText, sortedReservations, statusFilter, vehicleFilter]);
  const defaultVehicle = savedVehicles.find((vehicle) => vehicle.isDefault) ?? savedVehicles[0] ?? null;

  const handleCancelClick = (reservation: Reservation) => {
    if (isReservationPaid(reservation, payments)) {
      alert('Bạn không thể hủy đặt chỗ này vì đã thanh toán. Vui lòng liên hệ bộ phận CSKH để được hỗ trợ.');
      return;
    }
    if (minutesSinceCreated(reservation) > SELF_CANCEL_WINDOW_MINUTES) {
      alert(`Chỉ có thể tự hủy đặt chỗ trong vòng ${SELF_CANCEL_WINDOW_MINUTES} phút sau khi đặt. Vui lòng liên hệ nhân viên bãi đỗ để được hỗ trợ hủy.`);
      return;
    }
    setCancelConfirmId(reservation.id);
  };

  return (
    <div className="space-y-6 pb-6">
      <section className="relative overflow-hidden rounded-[26px] border border-white/40 bg-[#1f67db] shadow-[0_18px_48px_rgba(31,103,219,0.18)]">
        <img
          src={parkingHeroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(20,96,218,0.96)_0%,rgba(31,103,219,0.94)_55%,rgba(53,126,232,0.9)_100%)]" />
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-24 h-44 w-44 rounded-full bg-sky-200/10 blur-3xl" />

        <div className="relative px-6 py-7 sm:px-8 sm:py-8 lg:px-10">
          <div className="max-w-4xl">
            <h1 className="max-w-3xl text-[34px] font-black tracking-tight text-white sm:text-[42px] sm:leading-[1.08]">
              Chào mừng, {currentUser.fullName}!
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/84 sm:text-[16px]">
              Theo dõi và quản lý phương tiện của bạn một cách thông minh. Tiết kiệm thời gian và tận hưởng sự tiện lợi.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 grid-cols-1">
        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,42,81,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1f67db]/10 text-[#1f67db]">
                <History className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-[22px] font-bold tracking-tight text-slate-900">Lịch sử đỗ xe</h2>
            </div>
            <div className="flex items-center gap-3 self-start">
              {onClearHistory && reservations.some(r => ['Completed', 'Cancelled', 'Expired'].includes(r.status)) && (
                confirmClearHistory ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-slate-500">Xác nhận xóa?</span>
                    <button
                      onClick={() => {
                        const ids = reservations.filter(r => ['Completed', 'Cancelled', 'Expired'].includes(r.status)).map(r => r.id);
                        onClearHistory(ids);
                        setConfirmClearHistory(false);
                      }}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-rose-500 transition"
                    >Xóa</button>
                    <button
                      onClick={() => setConfirmClearHistory(false)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition"
                    >Hủy</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClearHistory(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa lịch sử
                  </button>
                )
              )}
            </div>
          </div>

          <div className="grid gap-3 border-b border-slate-100 px-6 py-4 sm:grid-cols-2 xl:grid-cols-4 sm:px-7">
            <FilterField label="Trạng thái">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500"
              >
                <option value="all">Tất cả</option>
                <option value="Confirmed">Đã xác nhận</option>
                <option value="Pending">Đang chờ</option>
                <option value="Checked-in">Đã vào bãi</option>
                <option value="Completed">Hoàn tất</option>
                <option value="Expired">Hết hạn</option>
                <option value="Cancelled">Đã hủy</option>
              </select>
            </FilterField>

            <FilterField label="Loại xe">
              <select
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500"
              >
                <option value="all">Tất cả</option>
                <option value="car">Ô tô (Xăng)</option>
                <option value="motorbike">Xe máy / Xe máy điện</option>
                <option value="electric vehicle">Ô tô (Điện)</option>
              </select>
            </FilterField>

            <div className="sm:col-span-2">
              <FilterField label="Tìm kiếm">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Mã đặt chỗ, biển số, khu vực"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-500"
                />
              </FilterField>
            </div>
          </div>

          <div className="grid gap-3 px-6 py-4 xl:hidden sm:px-7">
            {filteredReservations.length > 0 ? (
              filteredReservations.map((reservation) => {
                const statusMeta = getDisplayStatusMeta(reservation, pricingRules);
                return (
                  <article
                    key={reservation.id}
                    onClick={() => setDetailReservation(reservation)}
                    className="cursor-pointer rounded-[18px] border border-slate-200 bg-slate-50/60 p-4 transition hover:border-blue-200 hover:bg-blue-50/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-slate-950">
                          {reservation.createdAt
                            ? formatCreatedAt(reservation.createdAt)
                            : formatDateTimeLine(reservation.date, reservation.startTime)}
                        </p>
                        <p className="mt-1 text-[13px] text-slate-500">
                          {reservation.slotCode ? `${reservation.slotCode} · ${reservation.floor}` : reservation.floor}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-medium ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                        {(() => {
                          const pm = getPaymentStatusMeta(reservation, payments);
                          return (
                            <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-medium ${pm.className}`}>
                              {pm.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <CompactInfo label="Thời gian" value={formatDateTimeLine(reservation.date, reservation.startTime)} />
                      <CompactInfo label="Chi phí" value={formatMoney(estimateReservationCost(reservation, pricingRules, payments))} accent />
                      <CompactInfo label="Biển số" value={reservation.licensePlate} />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); setInvoiceReservation(reservation); }}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Hóa đơn
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="px-1 py-10 text-center">
                <p className="text-[15px] text-slate-500">Chưa có lịch sử phù hợp.</p>
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto px-6 py-2 xl:block sm:px-7">
            {filteredReservations.length > 0 ? (
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-[16px] font-medium text-slate-700">
                    <th className="pb-5 pr-6 font-medium">Ngày đặt</th>
                    <th className="pb-5 pr-6 font-medium">Biển số</th>
                    <th className="pb-5 pr-6 font-medium">Vị trí</th>
                    <th className="pb-5 pr-6 font-medium">Thời gian</th>
                    <th className="pb-5 pr-6 font-medium">Chi phí</th>
                    <th className="pb-5 pr-6 font-medium">Trạng thái</th>
                    <th className="pb-5 font-medium">Thanh toán</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReservations.map((reservation) => {
                    const statusMeta = getDisplayStatusMeta(reservation, pricingRules);
                    return (
                      <tr
                        key={reservation.id}
                        onClick={() => setDetailReservation(reservation)}
                        className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50/70"
                      >
                        <td className="border-t border-slate-100 py-5 pr-6 align-top">
                          <div className="text-[16px] font-semibold text-slate-950">
                            {reservation.createdAt
                              ? formatCreatedAt(reservation.createdAt)
                              : formatDateTimeLine(reservation.date, reservation.startTime)}
                          </div>
                        </td>
                        <td className="border-t border-slate-100 py-5 pr-6 align-top">
                          <div className="font-mono text-[15px] font-semibold text-slate-800">{reservation.licensePlate}</div>
                        </td>
                        <td className="border-t border-slate-100 py-5 pr-6 align-top">
                          <div className="text-[16px] text-slate-900">
                            {reservation.slotCode ? reservation.slotCode : reservation.floor}
                          </div>
                          {reservation.slotCode && (
                            <div className="mt-0.5 text-[13px] text-slate-400">{reservation.floor}</div>
                          )}
                          {/* Which of the 3 ParkFlow lots this booking belongs to (legacy rows predate the field) */}
                          <div className="mt-0.5 text-[13px] font-medium text-[#1f67db]">
                            {reservation.parkingLot || 'ParkFlow Quận 9 - Lò Lu'}
                          </div>
                        </td>
                        <td className="border-t border-slate-100 py-5 pr-6 align-top">
                          {/* Giờ đến dự kiến — the arrival the driver picked when booking */}
                          <div className="text-[16px] text-slate-900">{reservation.startTime.slice(0, 5)}</div>
                          <div className="mt-0.5 text-[13px] text-slate-400">{formatDate(reservation.date)}</div>
                        </td>
                        <td className="border-t border-slate-100 py-5 pr-6 align-top">
                          <div className="text-[22px] font-semibold tracking-tight text-[#1f67db]">
                            {formatMoney(estimateReservationCost(reservation, pricingRules, payments))}
                          </div>
                        </td>
                        <td className="border-t border-slate-100 py-5 pr-6 align-top">
                          <span className={`inline-flex rounded-full px-4 py-1.5 text-[14px] font-medium ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="border-t border-slate-100 py-5 align-top">
                          <div className="flex flex-col items-start gap-2">
                            {(() => {
                              const pm = getPaymentStatusMeta(reservation, payments);
                              return (
                                <span className={`inline-flex rounded-full px-3 py-1.5 text-[13px] font-medium ${pm.className}`}>
                                  {pm.label}
                                </span>
                              );
                            })()}
                            <button
                              onClick={(e) => { e.stopPropagation(); setInvoiceReservation(reservation); }}
                              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                            >
                              <FileText className="h-3 w-3" />
                              Hóa đơn
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="px-1 py-10 text-center">
                <p className="text-[15px] text-slate-500">Chưa có lịch sử đỗ xe phù hợp.</p>
              </div>
            )}
          </div>

        </section>
      </div>

      <ConfirmModal
        isOpen={cancelConfirmId !== null}
        title="Hủy đặt chỗ"
        message="Bạn có chắc muốn hủy chỗ đặt này? Ô đỗ đã giữ trước sẽ được trả lại cho hệ thống ngay lập tức."
        onConfirm={() => {
          if (cancelConfirmId) {
            onCancelReservation(cancelConfirmId);
            setCancelConfirmId(null);
            setDetailReservation(null);
          }
        }}
        onCancel={() => setCancelConfirmId(null)}
      />

      {invoiceReservation && (
        <ReservationInvoiceModal
          reservation={invoiceReservation}
          pricingRules={pricingRules}
          payments={payments}
          onClose={() => setInvoiceReservation(null)}
        />
      )}

      {detailReservation && (
        <ReservationDetailModal
          reservation={detailReservation}
          pricingRules={pricingRules}
          onClose={() => setDetailReservation(null)}
          onCancel={() => handleCancelClick(detailReservation)}
          onExpire={() => onExpireReservation(detailReservation.id)}
        />
      )}
    </div>
  );
}

function formatDate(value: string) {
  const dateOnly = value.split('T')[0];
  const [year, month, day] = dateOnly.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatDateTimeLine(date: string, time: string) {
  return `${formatDate(date)} • ${time.slice(0, 5)}`;
}

/** "2026-07-22 10:25" (mốc giờ thật lưu ở backend) → "10:25 · 22/07/2026". */
function formatTimelineStamp(value?: string) {
  if (!value) return '';
  const [datePart, timePart] = value.split(' ');
  return `${(timePart || '').slice(0, 5)} · ${formatDate(datePart || value)}`;
}

/** Monthly subscription validity runs 1 calendar month from the booking date. */
function addOneMonth(value: string) {
  const dateOnly = value.split('T')[0];
  const d = new Date(`${dateOnly}T00:00:00`);
  if (isNaN(d.getTime())) return value;
  d.setMonth(d.getMonth() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatCreatedAt(value: string) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMoney(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}

function trimAreaName(value: string) {
  return value.split(' - ')[1] || value;
}

/** "2026-07-22 10:25" (mốc giờ thật lưu ở backend) → epoch ms, hoặc NaN. */
function parseStamp(value?: string): number {
  if (!value) return NaN;
  return new Date(value.replace(' ', 'T')).getTime();
}

function toDurationHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Thời lượng gửi xe:
 * - Đang đỗ (Checked-in): tính THỜI GIAN THỰC từ lúc check-in tới `nowMs` — chạy
 *   từng giây, không phải khung giờ dự kiến lúc đặt.
 * - Đã xong (Completed): thời lượng THẬT từ check-in tới check-out (cố định).
 * - Chưa vào bãi (Pending/Confirmed...): vẫn dùng khung giờ dự kiến để ước tính.
 */
function durationLabel(reservation: Reservation, nowMs?: number) {
  const checkedIn = parseStamp(reservation.checkedInAt);
  if (!Number.isNaN(checkedIn)) {
    if (reservation.status === 'Checked-in' && nowMs != null) {
      return toDurationHMS((nowMs - checkedIn) / 1000);
    }
    const completed = parseStamp(reservation.completedAt);
    if (!Number.isNaN(completed)) {
      return toDurationHMS((completed - checkedIn) / 1000);
    }
  }
  if (!reservation.endTime) return '01:00:00';
  const startMinutes = toMinutes(reservation.startTime);
  const endMinutes = toMinutes(reservation.endTime);
  const diff = Math.max(30, endMinutes - startMinutes);
  return toDuration(diff);
}

function estimateReservationCost(reservation: Reservation, rules: PricingRule[] = [], payments: Payment[] = []) {
  // Đã qua ít nhất 1 đêm (00:00) kể từ giờ vào: đã thanh toán thì chỉ còn phần
  // qua đêm phát sinh; chưa thanh toán thì giá vé + phần qua đêm.
  const overstay = perVisitOverstay(reservation, rules);
  if (overstay.overstayed) return overstayDue(overstay, isReservationPaid(reservation, payments));
  // Use the price actually shown/agreed to at booking time (set in AvailableSlots.tsx's
  // flat package pricing) so this matches the "Đặt chỗ" flow exactly. Only recompute
  // from hourly pricingRules as a fallback for older records that predate this field.
  if (reservation.estimatedCost != null && reservation.estimatedCost > 0) {
    return reservation.estimatedCost;
  }
  const rule = rules.find((r) => r.vehicleType === reservation.vehicleType);
  if (rule) return rule.firstHourPrice + rule.extraServiceFee;
  const fallback: Record<string, number> = { car: 25000, motorbike: 10000, 'electric vehicle': 30000 };
  return fallback[reservation.vehicleType] ?? 10000;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function toDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function vehicleLabel(value: string) {
  switch (value) {
    case 'car':
      return 'Ô tô 4-7 chỗ (Xăng)';
    case 'motorbike':
      return 'Xe máy / Xe máy điện';
    case 'electric vehicle':
      return 'Ô tô 4-7 chỗ (Điện)';
    default:
      return value;
  }
}

/** Badge hiển thị: vé đã check-in mà thật sự phát sinh thêm phí qua đêm được gắn "Quá giờ" thay cho "Đã vào bãi".
 *  Dùng surcharge > 0 chứ không phải overstayed — vé "Qua đêm" luôn overstayed
 *  ngay từ đêm đầu (đã trả trước, surcharge = 0) nên không tính là quá giờ. */
function getDisplayStatusMeta(reservation: Reservation, rules: PricingRule[] = []) {
  if (perVisitOverstay(reservation, rules).surcharge > 0) {
    return { label: 'Quá giờ', className: 'bg-amber-100 text-amber-700' };
  }
  return getReservationStatusMeta(reservation.status);
}

function getReservationStatusMeta(status: Reservation['status']) {
  switch (status) {
    case 'Confirmed':
      return { label: 'Thành công', className: 'bg-emerald-50 text-emerald-700' };
    case 'Pending':
      return { label: 'Đang chờ', className: 'bg-amber-50 text-amber-700' };
    case 'Cancelled':
      return { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700' };
    case 'Completed':
      return { label: 'Hoàn tất', className: 'bg-slate-100 text-slate-700' };
    case 'Checked-in':
      return { label: 'Đã vào bãi', className: 'bg-blue-50 text-blue-700' };
    case 'Expired':
      return { label: 'Hết hạn', className: 'bg-slate-100 text-slate-600' };
    default:
      return { label: status, className: 'bg-slate-100 text-slate-700' };
  }
}

/** A reservation counts as paid once a real Payment row for it clears "Paid" — not
 * derived from reservation.status, since pre-payment (VNPay at booking time) can
 * succeed well before the reservation itself transitions to Checked-in/Completed.
 * Matches on reservationCode (stable) rather than just ticketCode, since check-in
 * rewrites a payment's ticketCode to the session's TCK-... code — ticketCode is
 * kept as a fallback only for payment rows created before this field existed. */
function isReservationPaid(reservation: Reservation, payments: Payment[]): boolean {
  return payments.some(
    (p) =>
      p.status === 'Paid' &&
      (p.reservationCode === reservation.reservationCode || p.ticketCode === reservation.reservationCode),
  );
}

function getPaymentStatusMeta(reservation: Reservation, payments: Payment[]) {
  const wasPaid = isReservationPaid(reservation, payments);
  if (reservation.status === 'Cancelled' || reservation.status === 'Expired') {
    // Không có cơ chế hoàn tiền trong hệ thống — xe đã trả tiền trước mà bị
    // hủy/hết hạn (không tới) thì số tiền đó bị mất. Phải hiện rõ ra đây,
    // không được để dấu "—" khiến khách tưởng nhầm là không mất gì.
    return wasPaid
      ? { label: 'Đã mất (không hoàn tiền)', className: 'bg-rose-50 text-rose-700' }
      : { label: '—', className: 'bg-slate-100 text-slate-400' };
  }
  if (wasPaid) {
    return { label: 'Đã thanh toán', className: 'bg-emerald-50 text-emerald-700' };
  }
  return { label: 'Chưa thanh toán', className: 'bg-amber-50 text-amber-700' };
}

function CompactInfo({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-1 text-[14px] font-semibold ${accent ? 'text-[#1f67db]' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function DetailRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'blue' | 'amber' | 'rose' }) {
  return (
    <div className={`flex justify-between border-b border-slate-100 pb-1.5 ${tone === 'blue' ? 'text-blue-600' : tone === 'amber' ? 'text-amber-600' : tone === 'rose' ? 'text-rose-600' : ''}`}>
      <span className="text-slate-400">{label}:</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  );
}

function ReservationInvoiceModal({
  reservation,
  pricingRules,
  payments = [],
  onClose,
}: {
  reservation: Reservation;
  pricingRules: PricingRule[];
  payments?: Payment[];
  onClose: () => void;
}) {
  const statusMeta = getDisplayStatusMeta(reservation, pricingRules);
  const resPaid = isReservationPaid(reservation, payments);

  // Xe đang đỗ trong bãi (Checked-in) → tick mỗi giây để thời lượng VÀ phí quá
  // giờ (perVisitOverstay/estimateReservationCost tự lấy Date.now() mới nhất
  // mỗi lần render) chạy thời gian thực; xe đã ra hoặc chưa vào bãi thì đứng
  // yên, khỏi tốn render vô ích.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (reservation.status !== 'Checked-in') return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [reservation.status]);

  const estimatedCost = estimateReservationCost(reservation, pricingRules, payments);
  const overstay = perVisitOverstay(reservation, pricingRules);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-blue-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-100">ParkFlow</p>
                <h3 className="text-lg font-bold">Hóa đơn đặt chỗ</h3>
              </div>
            </div>
            <button onClick={onClose} className="rounded-full p-1.5 text-white/70 hover:bg-white/20 transition">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mã đặt chỗ</p>
              <p className="mt-1 text-sm font-bold text-slate-800 font-mono">{reservation.reservationCode}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Biển số xe</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{reservation.licensePlate}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ngày đặt</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">{formatDate(reservation.date)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Khung giờ</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {reservation.startTime}{reservation.endTime ? ` - ${reservation.endTime}` : ''}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vị trí</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {reservation.slotCode ? `${reservation.slotCode} · ` : ''}{reservation.floor}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-[#1f67db]">
                {reservation.parkingLot || 'ParkFlow Quận 9 - Lò Lu'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Loại xe</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">{vehicleLabel(reservation.vehicleType)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-500">
                Thời lượng
                {reservation.status === 'Checked-in' && (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> trực tiếp
                  </span>
                )}
              </span>
              <span className="text-xs font-bold text-slate-700 tabular-nums">{durationLabel(reservation, nowMs)}</span>
            </div>
            {overstay.overstayed && (
              <>
                {resPaid ? (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50/60">
                    <span className="text-xs text-emerald-700">Giá vé gửi xe — đã thanh toán</span>
                    <span className="text-xs font-bold text-emerald-700">{formatMoney(overstay.base)}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/60">
                    <span className="text-xs text-amber-700">Giá vé gửi xe (chưa thanh toán)</span>
                    <span className="text-xs font-bold text-amber-700">{formatMoney(overstay.base)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50/60">
                  <span className="text-xs text-amber-700">
                    Phí qua đêm
                  </span>
                  <span className="text-xs font-bold text-amber-700">{formatMoney(overstay.surcharge)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50">
              <span className="text-sm font-bold text-blue-800">
                {overstay.overstayed ? 'Còn phải thanh toán' : 'Tổng chi phí ước tính'}
              </span>
              <span className="text-lg font-black text-blue-700">{formatMoney(estimatedCost)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <span className="text-xs font-semibold text-slate-500">Trạng thái</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </div>

          {/* Dòng thời gian — mốc giờ THẬT của từng lần chuyển trạng thái, đồng
              bộ từ thao tác staff tại cổng (xác nhận/check-in/check-out). */}
          <div className="rounded-xl border border-slate-100 p-3.5">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Dòng thời gian</p>
            <div className="space-y-2.5">
              {[
                { label: 'Đặt chỗ thành công', time: reservation.createdAt, done: true },
                { label: 'Nhân viên xác nhận', time: reservation.confirmedAt, done: !!reservation.confirmedAt },
                { label: 'Xe check-in vào bãi', time: reservation.checkedInAt, done: !!reservation.checkedInAt },
                reservation.cancelledAt
                  ? { label: 'Đã hủy', time: reservation.cancelledAt, done: true, danger: true }
                  : { label: 'Xe check-out — hoàn tất', time: reservation.completedAt, done: !!reservation.completedAt },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      step.danger ? 'bg-rose-500' : step.done ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                  <span className={`flex-1 text-xs ${step.done ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                  <span className={`text-[11px] ${step.danger ? 'text-rose-600' : 'text-slate-400'}`}>
                    {step.time ? formatTimelineStamp(step.time) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white hover:bg-slate-700 transition"
          >
            <Printer className="h-4 w-4" />
            In hóa đơn
          </button>
        </div>
      </div>
    </div>
  );
}

function ReservationDetailModal({
  reservation,
  pricingRules = [],
  onClose,
  onCancel,
  onExpire,
}: {
  reservation: Reservation;
  pricingRules?: PricingRule[];
  onClose: () => void;
  onCancel: () => void;
  onExpire: () => void;
}) {
  const statusMeta = getDisplayStatusMeta(reservation, pricingRules);
  const canSelfCancel = minutesSinceCreated(reservation) <= SELF_CANCEL_WINDOW_MINUTES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-md max-h-[85vh] flex-col space-y-3 overflow-y-auto rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 cursor-pointer rounded-full p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-slate-100 pb-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1f67db]">Chi tiết đặt chỗ</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-black tracking-tight text-slate-900">{reservation.reservationCode}</h3>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <DetailRow label="Ngày đặt" value={formatDate(reservation.date)} />
          <DetailRow label="Khung giờ" value={`${reservation.startTime}${reservation.endTime ? ` - ${reservation.endTime}` : ''}`} />
          <DetailRow label="Tầng" value={reservation.floor} />
          <DetailRow label="Ô đỗ" value={reservation.slotCode || 'Chưa gán'} />
          <DetailRow label="Loại xe" value={vehicleLabel(reservation.vehicleType)} />
          <DetailRow label="Biển số" value={reservation.licensePlate} />
        </div>

        {reservation.note && (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <span className="font-semibold text-slate-900">Ghi chú: </span>
            {reservation.note}
          </div>
        )}

        {reservation.note === 'Theo tháng' && (
          <div className="rounded-2xl border border-slate-100 p-4">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1f67db]">
              Mã QR gửi xe theo tháng
            </p>
            <div className="mt-2.5 flex justify-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-2.5">
                <QRCode
                  value={`PARKFLOW-MONTHLY|${reservation.reservationCode}|${reservation.licensePlate}|${reservation.date}|${addOneMonth(reservation.date)}`}
                  size={104}
                />
              </div>
            </div>

            <div className="mt-2.5 flex justify-between border-t border-slate-100 pt-2.5 text-sm">
              <span className="text-slate-500">Thời hạn đăng ký</span>
              <span className="font-semibold text-slate-900">
                {formatDate(reservation.date)} - {formatDate(addOneMonth(reservation.date))}
              </span>
            </div>
          </div>
        )}

        {(reservation.status === 'Confirmed' || reservation.status === 'Pending') && !canSelfCancel && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs leading-5 text-amber-700">
            Đã quá {SELF_CANCEL_WINDOW_MINUTES} phút kể từ lúc đặt — bạn không thể tự hủy nữa. Vui lòng liên hệ nhân viên bãi đỗ để được hỗ trợ hủy.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {reservation.status === 'Confirmed' && (
            <>
              {canSelfCancel && <ActionButton tone="rose" onClick={onCancel}>Hủy đặt chỗ</ActionButton>}
              <ActionButton tone="slate" onClick={onExpire}>Đánh dấu hết hạn</ActionButton>
            </>
          )}
          {reservation.status === 'Pending' && canSelfCancel && (
            <ActionButton tone="rose" onClick={onCancel}>Hủy đặt chỗ</ActionButton>
          )}
        </div>

        <button onClick={onClose} className="w-full cursor-pointer rounded-xl bg-slate-900 py-3 text-xs font-bold text-white transition hover:bg-slate-800">
          Đóng
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  children,
  tone = 'slate',
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'slate' | 'rose' | 'blue';
}) {
  const style =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
      : tone === 'blue'
      ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-500'
      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${style}`}
    >
      {children}
    </button>
  );
}
