import { useState } from 'react';
import { Car, CheckCircle2, AlertTriangle, MoreVertical, Monitor, X } from 'lucide-react';
import type { AccessLog } from '../../types/staff';
import type { Reservation, Slot, Payment, ParkingSession, User } from '../../data/mockData';
import PaymentWalletCard from '../../components/PaymentWalletCard';
import ConfirmModal from '../../components/ConfirmModal';
import EmergencyPanel from './EmergencyPanel';
import { buildCheckedInVehicles } from '../../utils/reservationPricing';

interface StaffOverviewProps {
  accessLogs: AccessLog[];
  reservations: Reservation[];
  /** Phiên gửi xe đang hoạt động của bãi phụ trách — gồm cả xe vào không đặt trước (walk-in). */
  sessions?: ParkingSession[];
  slots: Slot[];
  payments: Payment[];
  confirmedReservations: Set<string>;
  onConfirmReservation: (id: string) => void;
  onCancelReservation: (id: string) => void;
  onNavigate: (view: string) => void;
  /** Danh bạ người dùng — panel xe tháng dùng để hiện tên chủ xe. */
  users?: User[];
  addToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onSetSlotStatus?: (slotCode: string, status: Slot['status']) => Promise<boolean>;
  /** Bãi staff phụ trách — panel sơ đồ chỉ hiển thị đúng bãi này. */
  assignedLot?: string;
  /** id của nhân viên đang đăng nhập — backend dùng để xác thực thao tác chuyển ô đỗ. */
  actorId?: string;
  /** Bãi đang Bảo trì/Đóng cửa — khóa mọi nút thao tác, chỉ cho xem. */
  isUnderMaintenance?: boolean;
}

const vehicleLabel: Record<string, string> = {
  car:              'Ô tô 4-7 chỗ (Xăng)',
  motorbike:        'Xe máy / Xe máy điện',
  'electric vehicle': 'Ô tô 4-7 chỗ (Điện / EV)',
};

const actionLabel = (log: AccessLog) => {
  const dir  = log.direction === 'entry' ? 'Vào' : 'Ra';
  const kind =
    log.recognition === 'subscriber' ? 'Tháng'
    : log.recognition === 'unknown'  ? 'Khách'
    : 'Lượt';
  return `${dir} (${kind})`;
};

export default function StaffOverview({
  accessLogs,
  reservations,
  sessions = [],
  slots,
  payments,
  confirmedReservations,
  onConfirmReservation,
  onCancelReservation,
  onNavigate,
  users = [],
  addToast,
  onSetSlotStatus,
  assignedLot,
  actorId,
  isUnderMaintenance = false,
}: StaffOverviewProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);

  // Số xe đang thật sự đỗ trong bãi (đặt trước đã check-in + khách vãng lai) —
  // lấy trực tiếp từ dữ liệu server, không dùng accessLogs (chỉ tồn tại tạm
  // trong bộ nhớ trình duyệt, mất khi tải lại trang nên dễ đếm thiếu).
  const parkedNow = buildCheckedInVehicles(reservations, sessions).length;
  // Chỗ trống của CẢ BÃI đang phụ trách.
  //
  // Công thức cũ lọc `areaName.includes('A')` với ý định "Khu A", nhưng chữ 'A'
  // khớp cả "Floor 1 - Car Area", "Motorbike Area"... nên thực chất đếm một tập
  // ô ngẫu nhiên: con số đó không bao giờ khớp với sơ đồ hay với "Xe đang đỗ"
  // (báo lỗi: 3 xe đang đỗ nhưng vẫn hiện 16/18).
  //
  // Chỉ 'Available' mới là trống thật: 'Locked' là ô đang giữ cho thẻ tháng,
  // 'Maintenance' là ô đang hỏng — không ô nào trong hai loại đó nhận xe được.
  const lotFree  = slots.filter((s) => s.status === 'Available').length;
  const lotTotal = slots.length;
  // Phần còn lại của tổng, tách ra để chú thích bên dưới con số cho staff biết
  // vì sao "trống" nhỏ hơn "tổng trừ số xe": ô giữ cho thẻ tháng và ô đang hỏng
  // cũng nằm trong tổng nhưng không nhận xe được.
  const lotOccupied = slots.filter((s) => s.status === 'Occupied' || s.status === 'Reserved').length;
  const lotUnusable = lotTotal - lotFree - lotOccupied;
  // Cảnh báo = CHỈ số ô đang bảo trì / hỏng trong bãi phụ trách.
  //
  // Trước đây còn cộng thêm số lượt quét thẻ bị từ chối. Hai thứ
  // đó khác hẳn nhau: ô hỏng là hạ tầng cần đi sửa, còn quét thẻ trượt là việc
  // thường ngày ở cổng và đã có hàng đợi riêng lo. Gộp lại làm con số phồng lên
  // (ảnh báo lỗi: "4 lỗi" trong khi không ô nào đang bảo trì) và staff không
  // biết phải đi xử lý cái gì.
  const totalAlerts = slots.filter((s) => s.status === 'Maintenance').length;

  const statusOrder: Record<string, number> = { Pending: 0, Confirmed: 1, Cancelled: 2 };
  const upcoming = reservations
    .filter((r) => r.status === 'Pending' || r.status === 'Confirmed' || r.status === 'Cancelled')
    .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
    .slice(0, 8);
  const recent = accessLogs.slice(0, 5);

  return (
    <div className="space-y-6">

      {/* 4 Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Xe đang đỗ */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Xe đang đỗ</p>
            <p className="text-2xl font-bold text-slate-800">{parkedNow} xe</p>
          </div>
        </div>

        {/* Chỗ trống Khu A */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Chỗ trống trong bãi</p>
            {/* LUÔN hiện dạng "trống / tổng". Trước đây bãi chưa có ô nào thì
                rơi về hiện mỗi số 0 trơ trọi, không rõ là 0 chỗ trống hay bãi
                chưa được cấu hình. */}
            <p className="text-2xl font-bold text-slate-800">
              {lotFree} <span className="text-slate-400">/ {lotTotal}</span>
            </p>
            {lotTotal === 0 ? (
              <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                Bãi chưa có ô đỗ nào — cần Quản trị tạo sơ đồ ô.
              </p>
            ) : lotUnusable > 0 ? (
              <p className="mt-0.5 text-[11px] text-slate-400">
                {lotOccupied} ô có xe · {lotUnusable} ô giữ chỗ tháng / bảo trì
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-slate-400">{lotOccupied} ô đang có xe</p>
            )}
          </div>
        </div>

        {/* Cảnh báo */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Ô đỗ đang bảo trì</p>
            <p className="text-2xl font-bold text-slate-800">{totalAlerts} ô</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {totalAlerts === 0 ? 'Không có ô nào đang hỏng' : 'Cần sửa chữa trước khi nhận xe'}
            </p>
          </div>
        </div>

        {/* Trạng thái bãi xe */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isUnderMaintenance ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
            <Monitor className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Trạng thái bãi xe</p>
            <p className={`text-2xl font-bold ${isUnderMaintenance ? 'text-amber-600' : 'text-emerald-600'}`}>
              {isUnderMaintenance ? 'Bảo trì' : 'Hoạt động'}
            </p>
          </div>
        </div>
      </div>

      {isUnderMaintenance && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[14px] text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>
            <strong>Bãi đang tạm ngưng để bảo trì.</strong> Bạn chỉ có thể xem — mọi thao tác (quét thẻ, mở cổng,
            xác nhận/hủy đặt chỗ, đổi trạng thái ô đỗ) đều bị khóa cho đến khi quản lý mở lại hoạt động.
          </span>
        </div>
      )}

      {/* Sơ đồ bãi trực tiếp + xe tháng + xe đang đỗ.
          Biểu mẫu "Gửi cảnh báo" đã gỡ, nên panel không còn phụ thuộc
          onSubmitEmergency và luôn hiển thị. */}
      <EmergencyPanel
        slots={slots}
        reservations={reservations}
        sessions={sessions}
        assignedLot={assignedLot}
        addToast={addToast}
        onSetSlotStatus={onSetSlotStatus}
        actorId={actorId}
        users={users}
      />

      <PaymentWalletCard payments={payments} />

      {/* Reservation requests */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-5">
          <h3 className="text-lg font-bold text-slate-800">Yêu cầu Đặt chỗ trước</h3>
          <div className="flex items-center gap-3">
            <button className="text-sm font-bold text-blue-600 hover:underline">Xem lịch đặt</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3">Giờ đến thực tế</th>
                <th className="px-6 py-3">Biển số</th>
                <th className="px-6 py-3">Ô đỗ</th>
                <th className="px-6 py-3">Loại xe</th>
                <th className="px-6 py-3">Trạng thái</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {upcoming.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    Chưa có yêu cầu đặt chỗ nào.
                  </td>
                </tr>
              )}
              {upcoming.map((r) => {
                const isCancelled = r.status === 'Cancelled';
                const isConfirmed = !isCancelled && (r.status === 'Confirmed' || confirmedReservations.has(r.id));
                const isPending   = !isCancelled && !isConfirmed;
                return (
                  <tr key={r.id} className={`border-b border-slate-50 last:border-0 ${isCancelled ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 text-slate-600 font-semibold">
                      {r.startTime.slice(0, 5)}
                      {r.endTime ? ` - ${r.endTime.slice(0, 5)}` : ''}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{r.licensePlate || '—'}</td>
                    <td className="px-6 py-4 font-mono text-blue-700 font-semibold">{r.slotCode || '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{vehicleLabel[r.vehicleType] ?? r.vehicleType}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                        isCancelled ? 'bg-rose-50 text-rose-600'
                        : isConfirmed ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-orange-50 text-orange-600'
                      }`}>
                        {isCancelled ? 'ĐÃ HỦY' : isConfirmed ? 'ĐÃ XÁC NHẬN' : 'CHỜ DUYỆT'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isCancelled ? null : (
                        <div className="flex items-center justify-end gap-2">
                          {isPending && (
                            <button
                              onClick={() => onConfirmReservation(r.id)}
                              disabled={isUnderMaintenance}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              XÁC NHẬN
                            </button>
                          )}
                          {/* Thẻ tháng là hợp đồng trọn tháng đã thu tiền —
                              chỉ Quản lý mới được chấm dứt. Backend cũng chặn
                              (403 MONTHLY_CANCEL_REQUIRES_MANAGER), đây chỉ là
                              phần cho nhân viên thấy lý do ngay tại chỗ. */}
                          {r.note === 'Theo tháng' ? (
                            <span
                              title="Thẻ tháng chỉ Quản lý mới được hủy"
                              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-400"
                            >
                              THẺ THÁNG — LIÊN HỆ QUẢN LÝ
                            </span>
                          ) : (
                            <button
                              onClick={() => setCancelTarget(r)}
                              disabled={isUnderMaintenance}
                              className="rounded-lg border border-rose-200 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              HỦY
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity log */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-5">
          <h3 className="text-lg font-bold text-slate-800">Nhật Ký Hoạt Động Gần Đây</h3>
          <button
            onClick={() => onNavigate('activitylog')}
            className="text-sm font-bold text-blue-600 hover:underline"
          >
            Xem tất cả
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3">Thời gian</th>
                <th className="px-6 py-3">Biển số</th>
                <th className="px-6 py-3">Hành động</th>
                <th className="px-6 py-3">Trạng thái</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Đang chờ dữ liệu từ camera AI…
                  </td>
                </tr>
              )}
              {recent.map((log) => {
                const ok = log.status === 'GRANTED' || log.status === 'OVERRIDE';
                return (
                  <tr key={log.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-6 py-3.5 text-slate-500">{log.time}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800">{log.vehicleId}</td>
                    <td className="px-6 py-3.5 text-slate-600">{log.action || actionLabel(log)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                        ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {ok ? 'THÀNH CÔNG' : 'CẢNH BÁO'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button className="p-1 text-slate-400 hover:text-slate-600">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/25 transition"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="xem ảnh"
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <ConfirmModal
        isOpen={cancelTarget !== null}
        title="Hủy đặt chỗ của khách?"
        message={cancelTarget ? `Đặt chỗ ${cancelTarget.reservationCode} (biển số ${cancelTarget.licensePlate || '—'}) sẽ bị hủy. Khách sẽ nhận được thông báo.` : ''}
        onConfirm={() => {
          if (cancelTarget) onCancelReservation(cancelTarget.id);
          setCancelTarget(null);
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
