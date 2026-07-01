import { useState } from 'react';
import { Clock, Car, AlertTriangle, ClipboardList, UserCheck, ChevronDown, Download, Plus } from 'lucide-react';
import type { ShiftLog } from '../../types/staff';

interface ShiftLogsProps {
  shiftLogs: ShiftLog[];
}

const EXTENDED_SHIFTS: ShiftLog[] = [
  { id: 'SH-1', staffName: 'Nguyễn Văn A',  gate: 'Cổng A1 - Khu A', shiftStart: 'Hôm nay 06:00',          vehiclesHandled: 142, alerts: 2, status: 'On duty'   },
  { id: 'SH-2', staffName: 'Trần Thị B',     gate: 'Cổng B - Khu B',  shiftStart: 'Hôm nay 06:00', shiftEnd: 'Hôm nay 14:00',      vehiclesHandled: 98,  alerts: 0, status: 'Completed', note: 'Ca suôn sẻ, không có sự cố.' },
  { id: 'SH-3', staffName: 'Phạm Minh C',    gate: 'Cổng A1 - Khu A', shiftStart: 'Hôm qua 14:00', shiftEnd: 'Hôm qua 22:00',      vehiclesHandled: 167, alerts: 3, status: 'Completed', note: 'Camera OCR tại A1 cần vệ sinh.' },
  { id: 'SH-4', staffName: 'Lê Hoàng D',     gate: 'Cổng C - Khu C',  shiftStart: 'Hôm qua 22:00', shiftEnd: 'Hôm nay 06:00',      vehiclesHandled: 54,  alerts: 1, status: 'Completed', note: 'Phát hiện 1 xe không biển số vào lúc 02:15.' },
  { id: 'SH-5', staffName: 'Vũ Thị E',       gate: 'Cổng B - Khu B',  shiftStart: 'Hôm nay 06:00',          vehiclesHandled: 38,  alerts: 0, status: 'On duty'   },
];

export default function ShiftLogs({ shiftLogs: _shiftLogs }: ShiftLogsProps) {
  const shifts = EXTENDED_SHIFTS;
  const [filterStatus, setFilterStatus] = useState<'all' | 'On duty' | 'Completed'>('all');

  const filtered = shifts.filter((s) => filterStatus === 'all' || s.status === filterStatus);

  const onDutyCount      = shifts.filter((s) => s.status === 'On duty').length;
  const totalVehicles    = shifts.reduce((acc, s) => acc + s.vehiclesHandled, 0);
  const totalAlerts      = shifts.reduce((acc, s) => acc + s.alerts, 0);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nhật ký Ca trực</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tổng hợp lịch sử ca làm việc của từng nhân viên theo cổng và khu vực.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition">
            <Download className="h-3.5 w-3.5" /> Xuất Excel
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">
            <Plus className="h-3.5 w-3.5" /> Thêm ca trực
          </button>
        </div>
      </div>

      {/* 3 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Đang trực</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{String(onDutyCount).padStart(2, '0')}</p>
            <p className="text-[11px] text-slate-400">nhân viên</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tổng xe xử lý</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{totalVehicles.toLocaleString('vi-VN')}</p>
            <p className="text-[11px] text-slate-400">lượt hôm nay</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Cảnh báo</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{String(totalAlerts).padStart(2, '0')}</p>
            <p className="text-[11px] text-slate-400">sự cố phát sinh</p>
          </div>
        </div>
      </div>

      {/* Filter + table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">

        {/* Table header with filter */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-400" />
            <h2 className="font-semibold text-slate-800">Danh sách ca trực</h2>
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-8 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="On duty">Đang trực</option>
                <option value="Completed">Đã hoàn thành</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-bold uppercase tracking-widest text-slate-400">
                <th className="px-6 py-3">Nhân viên</th>
                <th className="px-6 py-3">Cổng / Khu vực</th>
                <th className="px-6 py-3">Bắt đầu</th>
                <th className="px-6 py-3">Kết thúc</th>
                <th className="px-6 py-3 text-center">Xe xử lý</th>
                <th className="px-6 py-3 text-center">Cảnh báo</th>
                <th className="px-6 py-3">Trạng thái</th>
                <th className="px-6 py-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    Không có ca trực nào phù hợp.
                  </td>
                </tr>
              )}
              {filtered.map((shift) => (
                <tr key={shift.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  {/* Staff name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {shift.staffName.split(' ').map((w) => w[0]).slice(-2).join('')}
                      </div>
                      <span className="font-semibold text-slate-800">{shift.staffName}</span>
                    </div>
                  </td>

                  {/* Gate */}
                  <td className="px-6 py-4 text-slate-600">{shift.gate}</td>

                  {/* Start */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {shift.shiftStart}
                    </div>
                  </td>

                  {/* End */}
                  <td className="px-6 py-4 text-slate-600">
                    {shift.shiftEnd ?? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Đang trực
                      </span>
                    )}
                  </td>

                  {/* Vehicles handled */}
                  <td className="px-6 py-4 text-center">
                    <span className="font-bold text-slate-800">{shift.vehiclesHandled}</span>
                  </td>

                  {/* Alerts */}
                  <td className="px-6 py-4 text-center">
                    <span className={`font-bold ${shift.alerts > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {shift.alerts}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    {shift.status === 'On duty' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Đang trực
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Đã hoàn thành
                      </span>
                    )}
                  </td>

                  {/* Note */}
                  <td className="px-6 py-4">
                    {shift.note ? (
                      <span className="text-xs italic text-slate-500 line-clamp-1">"{shift.note}"</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-3">
          <p className="text-xs text-slate-400">
            Hiển thị <span className="font-semibold text-slate-600">{filtered.length}</span> trong tổng số{' '}
            <span className="font-semibold text-slate-600">{shifts.length} ca trực</span>
          </p>
        </div>
      </div>
    </div>
  );
}
