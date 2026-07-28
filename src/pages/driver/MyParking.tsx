import React, { useEffect, useState } from 'react';
import { Ticket, Receipt, Car, Clock, MapPin, CreditCard, Hash, DoorOpen, Trash2, Building2 } from 'lucide-react';
import { User, ParkingSession, Reservation, Feedback, SavedVehicle, PricingRule, Slot } from '../../data/mockData';
import { PARKING_LOTS } from '../../utils/parkingLots';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { perVisitOverstay, buildCheckedInVehicles } from '../../utils/reservationPricing';

const vehicleLabelMap: Record<string, string> = {
  car: 'Ô tô 4-7 chỗ (Xăng)', motorbike: 'Xe máy / Xe máy điện', 'electric vehicle': 'Ô tô 4-7 chỗ (Điện)',
};
function vehicleLabel(t: string) { return vehicleLabelMap[t] ?? t; }

function formatDateTime(v: string) {
  if (!v) return '';
  const d = new Date(v.replace(' ', 'T'));
  if (isNaN(d.getTime())) return v;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Tên bãi đỗ của một xe đang đỗ — ưu tiên `parkingLot` của reservation (luôn có,
 * kể cả khách vãng lai không có bản ghi này), nếu không thì tra theo slotCode
 * trong kho ô (`slots[].parkingLot`, đồng bộ trực tiếp từ DB). */
function lotLabelFor(res: Reservation, slots: Slot[]): string {
  if (res.parkingLot) return res.parkingLot;
  const slot = slots.find((s) => s.slotCode === res.slotCode);
  return slot?.parkingLot || PARKING_LOTS.find((l) => l.key === 'quan9')!.name;
}

/** Đã gửi bao lâu, chạy real-time (HH:MM:SS) từ mốc check-in tới `nowMs`. */
function elapsedSince(checkInStamp: string, nowMs: number): string {
  const start = new Date(checkInStamp.replace(' ', 'T')).getTime();
  if (Number.isNaN(start)) return '';
  const s = Math.max(0, Math.floor((nowMs - start) / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export default function MyParking({ user, setView, currentSession, activeSessions = [], reservations, unpaidTotal, unpaidIsEstimate, unpaidSessionAmount = 0, unpaidReservationAmount = 0, unpaidOtherAmount = 0, feedbacks, savedVehicles, pricingRules = [], slots = [], onClearCheckedIn }: {
  user: User;
  setView: (view: string) => void;
  currentSession: ParkingSession;
  /** Toàn bộ phiên gửi xe đang hoạt động của tài khoản này — một tài khoản có thể có nhiều xe đỗ cùng lúc, không chỉ currentSession. */
  activeSessions?: ParkingSession[];
  reservations: Reservation[];
  unpaidTotal: number;
  unpaidIsEstimate?: boolean;
  unpaidSessionAmount?: number;
  unpaidReservationAmount?: number;
  unpaidOtherAmount?: number;
  feedbacks: Feedback[];
  savedVehicles: SavedVehicle[];
  pricingRules?: PricingRule[];
  /** Kho ô đỗ — dùng để suy ra tên bãi cho xe vãng lai (không có reservation.parkingLot). */
  slots?: Slot[];
  onClearCheckedIn?: (ids: string[]) => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const activeFeedback = feedbacks.find(f => f.status !== 'Resolved');
  const defaultVeh = savedVehicles.find(v => v.userId === user.id && v.isDefault);
  const isMySession = currentSession.userId === user.id;

  // All checked-in reservations = vehicles currently at the lot (includes
  // walk-ins synthesized from activeSessions — see buildCheckedInVehicles).
  const checkedInList = buildCheckedInVehicles(reservations, activeSessions);
  // Pending and confirmed reservations = booked but not yet checked in
  const pendingList = reservations.filter(r => r.status === 'Pending' || r.status === 'Confirmed');

  // Xe đang đỗ → tick mỗi giây để "Phí tạm tính" (tính lại real-time qua
  // perVisitOverstay) và thời lượng đã gửi chạy sống, không đứng yên như cũ.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (checkedInList.length === 0) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [checkedInList.length]);

  // Breakdown so "Số dư chưa thanh toán" doesn't read as a single unexplained
  // lump sum that looks inconsistent with the per-vehicle "Phí tạm tính".
  const balanceParts: string[] = [];
  if (unpaidSessionAmount > 0) balanceParts.push(`xe đang đỗ ${unpaidSessionAmount.toLocaleString()}đ`);
  if (unpaidReservationAmount > 0) balanceParts.push(`đặt chỗ sắp tới ${unpaidReservationAmount.toLocaleString()}đ`);
  if (unpaidOtherAmount > 0) balanceParts.push(`khoản khác ${unpaidOtherAmount.toLocaleString()}đ`);
  const balanceHelper = balanceParts.length > 0
    ? `Gồm: ${balanceParts.join(' + ')}`
    : (unpaidIsEstimate ? 'Ước tính theo thời gian hiện tại' : 'Các khoản cần thanh toán');

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-950 p-6 text-white shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold">Chào mừng quay lại, {user?.fullName || 'bạn'}!</h3>
          <p className="text-xs text-blue-200 max-w-xl">
            Đặt chỗ, thanh toán hóa đơn, theo dõi lượt gửi hiện tại và gửi phản hồi hỗ trợ đều nằm ở đây.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setView('slots')}
            className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-blue-900 hover:bg-blue-50 transition"
          >
            Đặt chỗ gửi xe
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Xe đang đỗ tại bãi" value={checkedInList.length > 0 ? `${checkedInList.length} xe` : '0 xe'} helper={checkedInList.length > 0 ? checkedInList.map(r => r.licensePlate).join(', ') : 'Chưa có xe nào đang đỗ'} icon={Ticket} accentClass="text-sky-600" bgIconClass="bg-sky-50" />
        <StatCard
          title="Số dư chưa thanh toán"
          value={`${unpaidIsEstimate ? '~' : ''}${unpaidTotal.toLocaleString()} VND`}
          helper={balanceHelper}
          icon={Receipt}
          accentClass="text-rose-600"
          bgIconClass="bg-rose-50"
        />
        <StatCard title="Xe mặc định" value={defaultVeh ? defaultVeh.licensePlate : 'Không có'} helper={defaultVeh ? `${defaultVeh.brand} ${defaultVeh.model}` : 'Chưa có biển số mặc định'} icon={Car} accentClass="text-indigo-600" bgIconClass="bg-indigo-50" />
      </section>

      {/* Pending / Confirmed reservations — show immediately after booking */}
      {pendingList.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-50 bg-amber-50/60 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Đặt chỗ đang chờ / Chờ xác nhận</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Yêu cầu đặt chỗ của bạn đang chờ nhân viên xác nhận.</p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-700">{pendingList.length} chờ</span>
          </div>
          <div className="divide-y divide-slate-50">
            {pendingList.map((res) => (
              <div key={res.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                  <Car className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-800 text-sm">{res.licensePlate || '—'}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      res.status === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {res.status === 'Confirmed' ? 'ĐÃ XÁC NHẬN' : 'CHỜ DUYỆT'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {vehicleLabel(res.vehicleType)}
                    {res.slotCode ? ` · Ô ${res.slotCode}` : ''}
                    {` · ${res.date} ${res.startTime.slice(0, 5)}`}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">{res.reservationCode}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-50 pb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Xe đang đỗ tại bãi</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Danh sách xe của bạn đang được ghi nhận trong bãi đỗ.</p>
            </div>
            {checkedInList.length > 0 && onClearCheckedIn && (
              confirmClear ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold text-slate-500">Xác nhận xóa?</span>
                  <button
                    onClick={() => { onClearCheckedIn(checkedInList.map(r => r.id)); setConfirmClear(false); }}
                    className="rounded-lg bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-rose-500 transition"
                  >Xóa</button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition"
                  >Hủy</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition"
                >
                  <Trash2 className="h-3 w-3" />
                  Dọn sạch
                </button>
              )
            )}
          </div>

          {checkedInList.length > 0 ? (
            <div className="space-y-3">
              {checkedInList.map((res) => {
                // Supplement with session data if this reservation's vehicle matches
                const matchedSession =
                  activeSessions.find((s) => s.licensePlate === res.licensePlate) ??
                  (isMySession && currentSession.licensePlate === res.licensePlate ? currentSession : null);
                const sv = savedVehicles.find(v => v.licensePlate === res.licensePlate && v.userId === user.id);
                // Mốc check-in THẬT (ghi ở backend lúc staff quét thẻ) — ưu tiên
                // hơn cả session lẫn khung giờ dự kiến lúc đặt.
                const checkInStamp = res.checkedInAt || matchedSession?.checkInTime || `${res.date} ${res.startTime}`;
                const checkInTime = formatDateTime(checkInStamp);
                const liveElapsed = elapsedSince(checkInStamp, nowMs);
                const ticketCode = matchedSession?.ticketCode ?? '—';
                // Phí tạm tính CHẠY REAL-TIME: tính lại theo giờ hiện tại mỗi giây
                // qua perVisitOverstay (cộng phụ phí quá giờ nếu có) thay vì đứng
                // yên ở con số quote lúc đặt/check-in.
                const estimatedFee = perVisitOverstay(res, pricingRules, nowMs).total;
                const entryGate = matchedSession?.entryGate ?? '—';

                return (
                  <div key={res.id} className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                          <Car className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-sm leading-tight">{res.licensePlate}</p>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {vehicleLabel(res.vehicleType)}
                            {sv?.brand ? ` · ${sv.brand} ${sv.model ?? ''}`.trim() : ''}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600">Đang đỗ</span>
                    </div>

                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 block font-semibold text-[9px] uppercase leading-tight">Giờ vào</span>
                          <span className="font-semibold text-slate-700">{checkInTime}</span>
                          {liveElapsed && (
                            <span className="ml-1.5 inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-600">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> {liveElapsed}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 block font-semibold text-[9px] uppercase leading-tight">Vị trí</span>
                          <span className="font-semibold text-slate-700">{res.slotCode || '—'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 block font-semibold text-[9px] uppercase leading-tight">Bãi đỗ</span>
                          <span className="font-semibold text-slate-700">{lotLabelFor(res, slots)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <CreditCard className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 block font-semibold text-[9px] uppercase leading-tight">Phí tạm tính</span>
                          <span className="font-bold text-rose-600 tabular-nums">{estimatedFee.toLocaleString()} VND</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <DoorOpen className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 block font-semibold text-[9px] uppercase leading-tight">Cổng vào</span>
                          <span className="font-semibold text-slate-700">{entryGate}</span>
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center gap-1.5 text-slate-600">
                        <Hash className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <div>
                          <span className="text-slate-400 block font-semibold text-[9px] uppercase leading-tight">Mã đặt chỗ / Vé</span>
                          <span className="font-semibold text-slate-700 font-mono">{ticketCode !== '—' ? ticketCode : res.reservationCode}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Car} title="Chưa có xe nào đang đỗ tại bãi" description="Thông tin xe vào bãi sẽ xuất hiện tự động khi được ghi nhận tại cổng." />
          )}
        </div>

        {activeFeedback && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm space-y-1.5 self-start">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-indigo-700 uppercase">Phiếu hỗ trợ</span>
              <StatusBadge status={activeFeedback.status} />
            </div>
            <h5 className="text-xs font-bold text-slate-800">{activeFeedback.type}</h5>
            <p className="text-[10px] text-slate-500 line-clamp-2 italic">"{activeFeedback.description}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
