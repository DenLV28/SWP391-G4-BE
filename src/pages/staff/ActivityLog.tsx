import { useState } from 'react';
import type { ReactNode } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Eye, Mail, Phone, User as UserIcon, X } from 'lucide-react';
import type { AccessLog } from '../../types/staff';
import type { Reservation, User } from '../../data/mockData';

interface ActivityLogProps {
  /** `loggedAt` chỉ có ở bản ghi đọc từ server — dùng để hiện ĐÚNG ngày. */
  accessLogs: (AccessLog & { loggedAt?: string })[];
  reservations?: Reservation[];
  users?: User[];
  /** Manager dùng lại bảng này cho nhật ký từng bãi nên cần đổi tiêu đề… */
  title?: string;
  subtitle?: string;
  /** …và chèn bộ lọc bãi vào cạnh tiêu đề. */
  headerRight?: ReactNode;
}

type ExtRow = {
  id: string;
  timeHMS: string;
  dateStr: string;
  dateISO: string;
  platePfx: string;
  plateNum: string;
  plateFull: string;
  vehicleType: string;
  // 'awaiting': đơn đặt chỗ mới — xe chưa tới bãi, staff chưa check-in (không
  // phải sự kiện qua cổng thật nên tách khỏi entry/exit).
  direction: 'entry' | 'exit' | 'awaiting';
  lane: string;
  action: string;
  status: 'ok' | 'err' | 'override' | 'pending';
  statusLabel: string;
  customerType: string;
};

// Không dùng toISOString() — quy về UTC nên từ 00:00 đến trước 07:00 giờ VN
// (UTC+7) sẽ trả về ngày hôm qua. Lấy theo ngày/tháng/năm địa phương.
const todayDate = new Date();
const todayISO = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

/**
 * NGÀY THẬT CỦA MỘT DÒNG NHẬT KÝ.
 *
 * Bản ghi đọc từ server có `loggedAt` (ISO, giờ UTC). Trước đây mọi dòng đều
 * bị gán cứng là "Hôm nay" — đúng với nhân viên vì họ chỉ xem nhật ký ca đang
 * trực, nhưng sai hoàn toàn khi Quản lý mở nhật ký của bãi và kéo về hàng trăm
 * dòng của nhiều ngày trước: tất cả đều hiện "Hôm nay" và bộ lọc theo ngày trở
 * nên vô nghĩa. Cộng +7h để ra ngày theo giờ VN, khớp với cột giờ đang hiển thị.
 */
function realDateOf(log: AccessLog & { loggedAt?: string }): { dateISO: string; dateStr: string } {
  if (!log.loggedAt) return { dateISO: todayISO, dateStr: 'Hôm nay' };
  const t = new Date(log.loggedAt).getTime();
  if (Number.isNaN(t)) return { dateISO: todayISO, dateStr: 'Hôm nay' };
  const vn = new Date(t + 7 * 3600 * 1000);
  const dateISO = vn.toISOString().slice(0, 10);
  if (dateISO === todayISO) return { dateISO, dateStr: 'Hôm nay' };
  const [y, m, d] = dateISO.split('-');
  return { dateISO, dateStr: `${d}/${m}/${y}` };
}

/** Maps real gate-scan events into table rows — no fake/sample rows mixed in. */
function buildRows(realLogs: (AccessLog & { loggedAt?: string })[]): ExtRow[] {
  return realLogs.map((log) => {
    const parts = log.vehicleId.split(' ');
    const pfx = parts[0] ?? log.vehicleId;
    const num = parts.slice(1).join(' ') || '—';
    const ok = log.status === 'GRANTED' || log.status === 'OVERRIDE';
    const pending = !ok && log.status === 'PENDING';
    const when = realDateOf(log);
    return {
      id: log.id,
      timeHMS: log.time,
      dateStr: when.dateStr,
      dateISO: when.dateISO,
      platePfx: pfx,
      plateNum: num,
      plateFull: log.vehicleId,
      // Loại xe thật ghi tại thời điểm quét — không đoán từ loại khách nữa
      vehicleType: log.vehicleType || '—',
      direction: log.notArrivedYet ? 'awaiting' : log.direction,
      lane: `Cổng ${log.gateId}`,
      action: log.action || '',
      status: ok ? 'ok' : pending ? 'pending' : 'err',
      statusLabel: ok ? 'Thành công' : pending ? 'Đang chờ' : 'Lỗi / Thanh toán',
      customerType: log.recognition === 'subscriber' ? 'Khách tháng' : 'Khách vãng lai',
    };
  });
}

const normalizePlate = (plate: string) => plate.replace(/[\s.-]/g, '').toUpperCase();

const PAGE_SIZE = 25;

// Kept in sync with the vehicle types offered during booking (see AvailableSlots.tsx vehicleLabelMap).
const VEHICLE_FILTER_OPTS = ['Tất cả', 'Ô tô 4-7 chỗ (Xăng)', 'Xe máy / Xe máy điện', 'Ô tô 4-7 chỗ (Điện / EV)'];
const ACTION_FILTER_OPTS  = ['Tất cả', 'VÀO', 'RA', 'CHƯA VÀO'];

export default function ActivityLog({ accessLogs, reservations = [], users = [], title, subtitle, headerRight }: ActivityLogProps) {
  const allRows = buildRows(accessLogs);

  const [vehicleFilter, setVehicleFilter] = useState('Tất cả');
  const [actionFilter, setActionFilter]   = useState('Tất cả');
  const [selectedDate, setSelectedDate]   = useState(todayISO);
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<ExtRow | null>(null);

  const findBooking = (row: ExtRow) => {
    const plate = normalizePlate(row.plateFull);
    const candidates = reservations
      .filter((r) => normalizePlate(r.licensePlate) === plate)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const reservation = candidates.find((r) => r.status === 'Checked-in') ?? candidates[0] ?? null;
    const bookingUser = reservation ? users.find((u) => u.id === reservation.userId) ?? null : null;
    return { reservation, bookingUser };
  };

  const filtered = allRows.filter((r) => {
    if (r.dateISO !== selectedDate) return false;
    if (vehicleFilter !== 'Tất cả' && r.vehicleType !== vehicleFilter) return false;
    if (actionFilter === 'VÀO' && r.direction !== 'entry') return false;
    if (actionFilter === 'RA'  && r.direction !== 'exit')  return false;
    if (actionFilter === 'CHƯA VÀO' && r.direction !== 'awaiting') return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const startIdx   = (page - 1) * PAGE_SIZE + 1;
  const endIdx     = Math.min(page * PAGE_SIZE, filtered.length);

  const visiblePageNums = (() => {
    const nums: (number | '…')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) nums.push(i);
    } else {
      nums.push(1, 2, 3, '…', totalPages);
    }
    return nums;
  })();

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title ?? 'Nhật ký hoạt động'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {subtitle ?? 'Lịch sử thời gian thực của tất cả các phương tiện di chuyển qua các cổng cơ sở.'}
          </p>
        </div>
        {headerRight}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
        {/* Date picker */}
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 cursor-pointer">
          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
            className="bg-transparent text-sm text-slate-600 focus:outline-none"
          />
        </label>

        {/* Vehicle type */}
        <div className="relative">
          <select
            value={vehicleFilter}
            onChange={(e) => { setVehicleFilter(e.target.value); setPage(1); }}
            className="appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {VEHICLE_FILTER_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Action */}
        <div className="relative">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {ACTION_FILTER_OPTS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-widest text-slate-400">
                <th className="px-5 py-3">Thời gian</th>
                <th className="px-5 py-3">Biển số</th>
                <th className="px-5 py-3">Loại xe</th>
                <th className="px-5 py-3">Hành động</th>
                <th className="px-5 py-3">Làn / Cổng</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Phân loại khách</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    Không có bản ghi phù hợp.
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  {/* Time */}
                  <td className="px-5 py-3.5">
                    <span className="block text-sm font-bold text-blue-600">{row.timeHMS}</span>
                    <span className="block text-[11px] text-slate-400">{row.dateStr}</span>
                  </td>

                  {/* Plate */}
                  <td className="px-5 py-3.5">
                    <span className="block text-sm font-bold text-blue-600">{row.platePfx}</span>
                    <span className="block text-[11px] font-medium text-slate-500">{row.plateNum}</span>
                  </td>

                  {/* Vehicle type */}
                  <td className="px-5 py-3.5 text-slate-700">{row.vehicleType}</td>

                  {/* Direction badge */}
                  <td className="px-5 py-3.5">
                    {row.direction === 'entry' ? (
                      <span className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white">
                        VÀO
                      </span>
                    ) : row.direction === 'exit' ? (
                      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                        RA
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">
                        CHƯA VÀO
                      </span>
                    )}
                  </td>

                  {/* Lane/Gate */}
                  <td className="px-5 py-3.5 text-slate-600 text-xs">{row.lane}</td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    {row.status === 'ok' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {row.statusLabel}
                      </span>
                    ) : row.status === 'override' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        {row.statusLabel}
                      </span>
                    ) : row.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        {row.statusLabel}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-xs font-semibold text-rose-600">Lỗi</span>
                        <span className="text-xs text-slate-400">/</span>
                        <span className="text-xs font-semibold text-rose-500">Thanh toán</span>
                      </span>
                    )}
                  </td>

                  {/* Customer type */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      row.customerType === 'Khách tháng'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {row.customerType}
                    </span>
                  </td>

                  {/* Eye */}
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => setDetailRow(row)}
                      className="text-slate-400 hover:text-blue-600 transition"
                      title="Xem chi tiết"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-500">
            Hiển thị <span className="font-semibold text-slate-700">{startIdx} - {endIdx}</span> trên{' '}
            <span className="font-semibold text-slate-700">{filtered.length.toLocaleString('vi-VN')} bản ghi</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {visiblePageNums.map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-slate-400 text-sm">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${
                    page === p
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {detailRow && (() => {
        const { reservation, bookingUser } = findBooking(detailRow);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
            onClick={() => setDetailRow(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-bold text-slate-800">Chi tiết lượt di chuyển</h3>
                <button
                  onClick={() => setDetailRow(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
                {/* Vehicle / scan info */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Thông tin phương tiện</p>
                  <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-sm">
                    {[
                      { label: 'Biển số', value: detailRow.plateFull },
                      { label: 'Loại xe', value: detailRow.vehicleType },
                      { label: 'Thời gian', value: `${detailRow.timeHMS} · ${detailRow.dateStr}` },
                      { label: 'Hành động', value: detailRow.direction === 'entry' ? 'VÀO' : detailRow.direction === 'exit' ? 'RA' : 'CHƯA VÀO' },
                      { label: 'Làn / Cổng', value: detailRow.lane },
                      { label: 'Trạng thái', value: detailRow.statusLabel },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between gap-3">
                        <span className="shrink-0 text-xs text-slate-400">{row.label}</span>
                        <span className="text-right text-xs font-semibold text-slate-800">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Booking info */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Thông tin đặt chỗ</p>
                  {reservation ? (
                    <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-sm">
                      {[
                        { label: 'Mã đặt chỗ', value: reservation.reservationCode },
                        { label: 'Ô đỗ', value: reservation.slotCode || '—' },
                        { label: 'Ngày / Giờ', value: `${reservation.date} ${reservation.startTime}` },
                        { label: 'Trạng thái', value: reservation.status },
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between gap-3">
                          <span className="shrink-0 text-xs text-slate-400">{row.label}</span>
                          <span className="text-right text-xs font-semibold text-slate-800">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3.5 py-3 text-xs text-slate-400">
                      Không tìm thấy đặt chỗ liên kết với biển số này.
                    </p>
                  )}
                </div>

                {/* Booking user info */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Người đặt chỗ</p>
                  {bookingUser ? (
                    <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-sm">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800">{bookingUser.fullName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-600">{bookingUser.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-600">{bookingUser.phone || '—'}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3.5 py-3 text-xs text-slate-400">
                      Không có thông tin người dùng.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
