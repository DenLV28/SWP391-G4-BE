import { useState } from 'react';
import { Car, CheckCircle2, AlertTriangle, MoreVertical, Monitor, X, Bike } from 'lucide-react';
import type { AccessLog } from '../../types/staff';
import type { Reservation, Slot, Feedback } from '../../data/mockData';
import ParkingFloorMap, { type MapSlot } from '../../components/ParkingFloorMap';

interface StaffOverviewProps {
  accessLogs: AccessLog[];
  reservations: Reservation[];
  slots: Slot[];
  feedbacks: Feedback[];
  alertsCount: number;
  confirmedReservations: Set<string>;
  onConfirmReservation: (id: string) => void;
  onRespondFeedback: (id: string, response: string, status?: Feedback['status']) => void;
  onNavigate: (view: string) => void;
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
  slots,
  feedbacks: _feedbacks,
  alertsCount,
  confirmedReservations,
  onConfirmReservation,
  onNavigate,
  onRespondFeedback: _onRespondFeedback,
}: StaffOverviewProps) {
  const [dismissedResIds, setDismissedResIds] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [areaMode, setAreaMode] = useState<'all' | 'car' | 'motorbike'>('all');

  const processedToday = accessLogs.length;
  const zoneAFree  = slots.filter((s) => s.areaName?.includes('A') && s.status === 'Available').length;
  const zoneATotal = slots.filter((s) => s.areaName?.includes('A')).length || 150;

  const statusOrder: Record<string, number> = { Pending: 0, Confirmed: 1, Cancelled: 2 };
  const upcoming = reservations
    .filter((r) => (r.status === 'Pending' || r.status === 'Confirmed' || r.status === 'Cancelled') && !dismissedResIds.has(r.id))
    .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
    .slice(0, 8);
  const recent = accessLogs.slice(0, 5);

  const handleClearAll = () => {
    const ids = reservations
      .filter((r) => r.status === 'Pending' || r.status === 'Confirmed' || r.status === 'Cancelled')
      .map((r) => r.id);
    setDismissedResIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <div className="space-y-6">

      {/* 4 Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Lượt xử lý */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Lượt xử lý</p>
            <p className="text-2xl font-bold text-slate-800">{processedToday} xe</p>
          </div>
        </div>

        {/* Chỗ trống Khu A */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Chỗ trống Khu A</p>
            <p className="text-2xl font-bold text-slate-800">
              {zoneATotal > 0 ? `${zoneAFree} / ${zoneATotal}` : zoneAFree}
            </p>
          </div>
        </div>

        {/* Cảnh báo */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Cảnh báo</p>
            <p className="text-2xl font-bold text-slate-800">{alertsCount} lỗi</p>
          </div>
        </div>

        {/* Trạng thái cổng */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Monitor className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Trạng thái cổng</p>
            <p className="text-2xl font-bold text-emerald-600">Hoạt động</p>
          </div>
        </div>
      </div>

      {/* Live floor map */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">Sơ đồ bãi đỗ — Trực tiếp</h3>
            <p className="text-xs text-slate-400 mt-0.5">Trạng thái các ô đỗ cập nhật theo thời gian thực</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Area toggle */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
              {([
                { key: 'all',       label: 'Tất cả',   icon: Monitor },
                { key: 'car',       label: 'Ô tô',     icon: Car },
                { key: 'motorbike', label: 'Xe máy',   icon: Bike },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setAreaMode(key)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                    areaMode === key ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px]">
              {[
                { color: 'bg-white border border-blue-400', label: 'Trống' },
                { color: 'bg-green-600', label: 'Đang đỗ' },
                { color: 'bg-amber-100 border border-amber-400', label: 'Chờ duyệt' },
                { color: 'bg-amber-400', label: 'Đã đặt' },
                { color: 'bg-rose-500', label: 'Bảo trì' },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1 text-slate-500">
                  <span className={`inline-block h-3 w-3 rounded-sm ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4">
          <ParkingFloorMap
            slots={slots.map((s) => ({
              id: s.id,
              code: s.slotCode.split('-').pop() ?? s.slotCode,
              status: s.status,
            } as MapSlot))}
            interactive={false}
            areaMode={areaMode}
          />
        </div>
      </div>

      {/* Reservation requests */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-5">
          <h3 className="text-lg font-bold text-slate-800">Yêu cầu Đặt chỗ trước</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClearAll}
              className="text-sm font-bold text-rose-500 hover:text-rose-700 transition"
            >
              Xóa tất cả
            </button>
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
                      {isCancelled ? null : isConfirmed ? (
                        <button className="p-1 text-slate-400 hover:text-slate-600">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onConfirmReservation(r.id)}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          XÁC NHẬN
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity log + Shift info (2-col) */}
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">

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

        {/* Shift info card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Thông tin ca trực</p>
          {[
            { label: 'Nhân viên trực', value: 'Nguyễn Văn A' },
            { label: 'Bắt đầu',        value: '08:00, Hôm nay' },
            { label: 'Kết thúc dự kiến', value: '16:00, Hôm nay' },
            { label: 'Vị trí',          value: 'Cổng 2 · Ca A' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
              <span className="text-xs text-slate-500">{row.label}</span>
              <span className="text-xs font-bold text-slate-800">{row.value}</span>
            </div>
          ))}
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
    </div>
  );
}
