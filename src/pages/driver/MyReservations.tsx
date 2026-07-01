import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle,
  ChevronRight,
  FileText,
  History,
  MapPin,
  ParkingSquare,
  Printer,
  Ticket,
  Trash2,
  UserCircle2,
  X,
} from 'lucide-react';
import {
  Area,
  Floor,
  ParkingSession,
  PricingRule,
  Reservation,
  SavedVehicle,
  Slot,
  SystemConfig,
  User,
} from '../../data/mockData';
import ConfirmModal from '../../components/ConfirmModal';
import parkingHeroImage from '../../assets/images/parkflow_bg_1779336618673.png';

export default function MyReservations({
  reservations,
  onAddReservation: _onAddReservation,
  onCancelReservation,
  floors: _floors,
  areas,
  slots,
  driverStatus,
  savedVehicles,
  systemConfig: _systemConfig,
  onCheckInReservation,
  onExpireReservation,
  onClearHistory,
  setView,
  currentUser,
  currentSession,
  pricingRules = [],
}: {
  reservations: Reservation[];
  onAddReservation: (reservation: any) => void;
  onCancelReservation: (id: string) => void;
  floors: Floor[];
  areas: Area[];
  slots: Slot[];
  driverStatus: string;
  savedVehicles: SavedVehicle[];
  systemConfig: SystemConfig;
  onCheckInReservation: (reservationId: string) => { success: boolean; ticketCode?: string; slotCode?: string; error?: string };
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
  const [checkInSuccessData, setCheckInSuccessData] = useState<{ ticketCode: string; slotCode: string; floor: string; area: string } | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const reservationStats = useMemo(() => {
    return reservations.reduce(
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
  }, [reservations]);

  const sortedReservations = useMemo(() => {
    return [...reservations].sort((a, b) => {
      const first = new Date(`${b.date}T${b.startTime}:00`).getTime();
      const second = new Date(`${a.date}T${a.startTime}:00`).getTime();
      return first - second;
    });
  }, [reservations]);

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
  const nextReservation = useMemo(() => {
    return [...reservations]
      .filter((reservation) => reservation.status === 'Confirmed' || reservation.status === 'Pending')
      .sort((a, b) => {
        const first = new Date(`${a.date}T${a.startTime}:00`).getTime();
        const second = new Date(`${b.date}T${b.startTime}:00`).getTime();
        return first - second;
      })[0] ?? null;
  }, [reservations]);

  const defaultVehicle = savedVehicles.find((vehicle) => vehicle.isDefault) ?? savedVehicles[0] ?? null;
  const activeSession = currentSession.sessionStatus === 'Active' ? currentSession : null;
  const availableSlotCount = slots.filter((slot) => slot.status === 'Available').length;
  const occupancyRate = Math.round(((slots.length - availableSlotCount) / Math.max(1, slots.length)) * 100);

  const heroStatusText = activeSession
    ? `Xe đang đỗ tại: ${activeSession.floor}`
    : nextReservation
    ? `Lượt gần nhất: ${formatDate(nextReservation.date)} • ${nextReservation.startTime}${nextReservation.endTime ? ` - ${nextReservation.endTime}` : ''}`
    : 'Chưa có lượt đỗ nào được xác nhận.';

  const heroStatusDetail = activeSession
    ? activeSession.floor
    : nextReservation
    ? nextReservation.floor
    : 'Bạn có thể đặt chỗ mới ngay từ danh sách bãi trống.';

  const handleCancelClick = (reservation: Reservation) => {
    const dateOnly = reservation.date.split('T')[0];
    const timeOnly = reservation.startTime.slice(0, 5);
    const startDate = new Date(`${dateOnly}T${timeOnly}:00`);
    const diffMs = startDate.getTime() - Date.now();
    if (diffMs > 0 && diffMs < 15 * 60 * 1000) {
      alert('Chỉ có thể hủy đặt chỗ trước ít nhất 15 phút so với giờ bắt đầu.');
      return;
    }
    setCancelConfirmId(reservation.id);
  };

  const handleSimulateCheckIn = (reservation: Reservation) => {
    if (reservation.status !== 'Confirmed') {
      alert(statusMessage(reservation.status));
      return;
    }
    if (driverStatus !== 'Active') {
      alert('Tài khoản hiện không hoạt động.');
      return;
    }

    const areaRecord = areas.find((area) => area.areaName === reservation.area);
    if (!areaRecord) {
      alert('Khu vực đặt trước không còn hợp lệ hoặc không tồn tại.');
      return;
    }
    if (areaRecord.vehicleType !== reservation.vehicleType) {
      alert('Khu vực đã chọn không hỗ trợ loại xe này.');
      return;
    }

    const result = onCheckInReservation(reservation.id);
    if (result.success && result.ticketCode && result.slotCode) {
      setCheckInSuccessData({
        ticketCode: result.ticketCode,
        slotCode: result.slotCode,
        floor: reservation.floor,
        area: reservation.area,
      });
      setDetailReservation(null);
    } else {
      alert(result.error || 'Không thể vào bãi.');
    }
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

            <div className="mt-8 max-w-[700px] rounded-[22px] border border-white/20 bg-white/12 p-4 shadow-[0_12px_24px_rgba(7,35,92,0.12)] backdrop-blur-sm sm:p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/18 text-white shadow-inner">
                  <ParkingSquare className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    TRẠNG THÁI HIỆN TẠI
                  </p>
                  <p className="mt-2 text-[20px] font-bold leading-8 text-white sm:text-[25px]">
                    {heroStatusText}
                  </p>
                  <p className="mt-1.5 text-[14px] leading-6 text-white/78">
                    {heroStatusDetail}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] 2xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="space-y-4 xl:max-w-[400px]">
          <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,42,81,0.06)]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f67db]/10 text-[#1f67db]">
                <span className="text-[15px] font-extrabold leading-none">P</span>
              </div>
              <h2 className="text-[16px] font-bold tracking-tight text-slate-900">Số chỗ trống</h2>
            </div>

            <div className="mt-3 rounded-[14px] bg-[#f3f7ff] px-4 py-3 text-center">
              <div className="flex items-end justify-center gap-1.5">
                <span className="text-[42px] font-black leading-none text-[#1f67db]">
                  {availableSlotCount}
                </span>
                <span className="pb-1 text-[18px] font-semibold leading-none text-slate-700">
                  / {slots.length}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Chỗ trống hiện tại
              </p>

              <div className="mt-3 h-1.5 rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-[#1f67db]"
                  style={{ width: `${Math.max(6, availableSlotCount > 0 ? (availableSlotCount / Math.max(1, slots.length)) * 100 : 6)}%` }}
                />
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] italic text-slate-400">
              * Dữ liệu được cập nhật theo thời gian thực
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <MiniMetric label="Đang chiếm" value={slots.length - availableSlotCount} tone="blue" />
              <MiniMetric label="Tỉ lệ lấp đầy" value={`${occupancyRate}%`} tone="slate" />
            </div>
          </section>

          <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_8px_20px_rgba(15,42,81,0.06)]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f67db]/10 text-[#1f67db]">
                <UserCircle2 className="h-4 w-4" />
              </div>
              <h2 className="text-[16px] font-bold tracking-tight text-slate-900">Thông tin cá nhân</h2>
            </div>

            <div className="mt-3 rounded-[14px] border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8f1ff] text-[#1f67db] text-[16px] font-black">
                  {currentUser.fullName ? currentUser.fullName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() : <UserCircle2 className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-500">Họ và tên</p>
                  <p className="mt-0.5 text-[16px] font-black tracking-tight text-slate-950 leading-tight truncate">
                    {currentUser.fullName || 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
              <InfoCard label="Email" value={currentUser.email || 'Chưa cập nhật'} />
              <InfoCard label="Số điện thoại" value={currentUser.phone || 'Chưa cập nhật'} />
            </div>
          </section>
        </div>

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
              <button
                type="button"
                onClick={() => setView('slots')}
                className="text-[14px] font-medium text-[#1f67db] transition hover:text-[#0f57cb]"
              >
                Xem tất cả
              </button>
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
                const statusMeta = getReservationStatusMeta(reservation.status);
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
                          const pm = getPaymentStatusMeta(reservation.status);
                          return (
                            <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-medium ${pm.className}`}>
                              {pm.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <CompactInfo label="Thời lượng" value={durationLabel(reservation)} />
                      <CompactInfo label="Chi phí" value={formatMoney(estimateReservationCost(reservation, pricingRules))} accent />
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
                    <th className="pb-5 pr-6 font-medium">Thời gian</th>
                    <th className="pb-5 pr-6 font-medium">Biển số</th>
                    <th className="pb-5 pr-6 font-medium">Vị trí</th>
                    <th className="pb-5 pr-6 font-medium">Thời lượng</th>
                    <th className="pb-5 pr-6 font-medium">Chi phí</th>
                    <th className="pb-5 pr-6 font-medium">Trạng thái</th>
                    <th className="pb-5 font-medium">Thanh toán</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReservations.map((reservation) => {
                    const statusMeta = getReservationStatusMeta(reservation.status);
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
                          <div className="mt-1 text-[14px] text-slate-500">
                            {reservation.date ? formatDateTimeLine(reservation.date, reservation.startTime) : ''}
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
                        </td>
                        <td className="border-t border-slate-100 py-5 pr-6 align-top">
                          <div className="text-[16px] text-slate-900">{durationLabel(reservation)}</div>
                        </td>
                        <td className="border-t border-slate-100 py-5 pr-6 align-top">
                          <div className="text-[22px] font-semibold tracking-tight text-[#1f67db]">
                            {formatMoney(estimateReservationCost(reservation, pricingRules))}
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
                              const pm = getPaymentStatusMeta(reservation.status);
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
          }
        }}
        onCancel={() => setCancelConfirmId(null)}
      />

      {invoiceReservation && (
        <ReservationInvoiceModal
          reservation={invoiceReservation}
          pricingRules={pricingRules}
          onClose={() => setInvoiceReservation(null)}
        />
      )}

      {detailReservation && (
        <ReservationDetailModal
          reservation={detailReservation}
          onClose={() => setDetailReservation(null)}
          onCancel={() => handleCancelClick(detailReservation)}
          onCheckIn={() => handleSimulateCheckIn(detailReservation)}
          onExpire={() => onExpireReservation(detailReservation.id)}
          onOpenSession={() => setView('session')}
        />
      )}

      {checkInSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Check-in thành công</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Mã vé gửi xe của bạn là <span className="font-mono font-bold text-blue-600">{checkInSuccessData.ticketCode}</span>.
              </p>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-xs">
              <DetailRow label="Tầng" value={checkInSuccessData.floor} />
              <DetailRow label="Khu vực" value={trimAreaName(checkInSuccessData.area)} />
              <DetailRow label="Ô đỗ" value={checkInSuccessData.slotCode} tone="blue" />
            </div>

            <p className="rounded-xl border border-amber-100 bg-amber-50 p-2.5 text-[11px] font-bold text-amber-600">
              Vui lòng di chuyển ngay đến ô {checkInSuccessData.slotCode}.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setCheckInSuccessData(null)}
                className="w-1/2 cursor-pointer rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setCheckInSuccessData(null);
                  setView('session');
                }}
                className="w-1/2 cursor-pointer rounded-xl bg-blue-600 py-3 text-xs font-bold text-white transition hover:bg-blue-500"
              >
                Xem lượt gửi
              </button>
            </div>
          </div>
        </div>
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

function durationLabel(reservation: Reservation) {
  if (!reservation.endTime) return '01:00:00';
  const startMinutes = toMinutes(reservation.startTime);
  const endMinutes = toMinutes(reservation.endTime);
  const diff = Math.max(30, endMinutes - startMinutes);
  return toDuration(diff);
}

function estimateReservationCost(reservation: Reservation, rules: PricingRule[] = []) {
  const durationMinutes = reservation.endTime ? Math.max(30, toMinutes(reservation.endTime) - toMinutes(reservation.startTime)) : 60;
  const durationHours = Math.max(1, Math.ceil(durationMinutes / 60));
  const rule = rules.find((r) => r.vehicleType === reservation.vehicleType);
  if (rule) {
    const extraHours = Math.max(0, durationHours - 1);
    return rule.firstHourPrice + extraHours * rule.nextHourPrice + rule.extraServiceFee;
  }
  const fallback: Record<string, number> = { car: 25000, motorbike: 10000, 'electric vehicle': 30000 };
  return durationHours * (fallback[reservation.vehicleType] ?? 10000);
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

function getPaymentStatusMeta(status: Reservation['status']) {
  switch (status) {
    case 'Completed':
      return { label: 'Đã thanh toán', className: 'bg-emerald-50 text-emerald-700' };
    case 'Cancelled':
    case 'Expired':
      return { label: '—', className: 'bg-slate-100 text-slate-400' };
    default:
      return { label: 'Chưa thanh toán', className: 'bg-amber-50 text-amber-700' };
  }
}

function statusMessage(status: Reservation['status']) {
  switch (status) {
    case 'Cancelled':
      return 'Đặt chỗ đã bị hủy.';
    case 'Expired':
      return 'Đặt chỗ đã hết hạn.';
    case 'Checked-in':
      return 'Đặt chỗ đã được ghi nhận vào bãi trước đó.';
    case 'Completed':
      return 'Đặt chỗ đã hoàn tất.';
    default:
      return `Trạng thái đặt chỗ hiện tại là ${status}.`;
  }
}

function MiniMetric({ label, value, tone }: { label: string; value: React.ReactNode; tone: 'blue' | 'slate' }) {
  return (
    <div className={`rounded-xl border px-3 py-3 ${tone === 'blue' ? 'border-blue-100 bg-blue-50/70' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 text-[20px] font-black ${tone === 'blue' ? 'text-[#1f67db]' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
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

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-slate-200 bg-white px-3 py-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-[14px] font-bold text-slate-900" title={typeof value === 'string' ? value : undefined}>{value}</p>
    </div>
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
  onClose,
}: {
  reservation: Reservation;
  pricingRules: PricingRule[];
  onClose: () => void;
}) {
  const statusMeta = getReservationStatusMeta(reservation.status);
  const estimatedCost = estimateReservationCost(reservation, pricingRules);

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
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Loại xe</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">{vehicleLabel(reservation.vehicleType)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 divide-y divide-slate-50">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs text-slate-500">Thời lượng</span>
              <span className="text-xs font-bold text-slate-700">{durationLabel(reservation)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50">
              <span className="text-sm font-bold text-blue-800">Tổng chi phí ước tính</span>
              <span className="text-lg font-black text-blue-700">{formatMoney(estimatedCost)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
            <span className="text-xs font-semibold text-slate-500">Trạng thái</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
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
  onClose,
  onCancel,
  onCheckIn,
  onExpire,
  onOpenSession,
}: {
  reservation: Reservation;
  onClose: () => void;
  onCancel: () => void;
  onCheckIn: () => void;
  onExpire: () => void;
  onOpenSession: () => void;
}) {
  const statusMeta = getReservationStatusMeta(reservation.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 cursor-pointer rounded-full p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-slate-100 pb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1f67db]">Chi tiết đặt chỗ</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-black tracking-tight text-slate-900">{reservation.reservationCode}</h3>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>{statusMeta.label}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailRow label="Ngày đặt" value={formatDate(reservation.date)} />
          <DetailRow label="Khung giờ" value={`${reservation.startTime}${reservation.endTime ? ` - ${reservation.endTime}` : ''}`} />
          <DetailRow label="Tầng" value={reservation.floor} />
          <DetailRow label="Loại xe" value={vehicleLabel(reservation.vehicleType)} />
          <DetailRow label="Biển số" value={reservation.licensePlate} />
        </div>

        {reservation.note && (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <span className="font-semibold text-slate-900">Ghi chú: </span>
            {reservation.note}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {reservation.status === 'Confirmed' && (
            <>
              <ActionButton tone="blue" onClick={onCheckIn}>Check-in</ActionButton>
              <ActionButton tone="rose" onClick={onCancel}>Hủy đặt chỗ</ActionButton>
              <ActionButton tone="slate" onClick={onExpire}>Đánh dấu hết hạn</ActionButton>
            </>
          )}
          {reservation.status === 'Pending' && (
            <ActionButton tone="rose" onClick={onCancel}>Hủy đặt chỗ</ActionButton>
          )}
          {reservation.status === 'Checked-in' && (
            <ActionButton tone="blue" onClick={onOpenSession}>Xem lượt gửi hiện tại</ActionButton>
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
