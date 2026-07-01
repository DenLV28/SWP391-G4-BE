import React, { useState } from 'react';
import {
  ShieldAlert, RefreshCw, Clock3, Timer,
  ChevronDown, Search, SlidersHorizontal,
  Car, Bike, Truck, Zap, Flame, AlertTriangle, MapPin,
  ChevronLeft, ChevronRight, MoreHorizontal,
} from 'lucide-react';
import type { EmergencyLog } from '../../types/staff';

interface ManagerExceptionsProps {
  setView: (view: string) => void;
  emergencyLogs?: EmergencyLog[];
}

type ExStatus = 'pending' | 'processing' | 'resolved';

interface ExceptionRow {
  id: string;
  date: string;
  time: string;
  plate: string;
  vehicleDesc: string;
  vehicleType: 'car' | 'motorbike' | 'truck' | 'ev';
  lot: string;
  title: string;
  description: string;
  status: ExStatus;
}

const ROWS: ExceptionRow[] = [
  {
    id: 'EX-001',
    date: '24/10/2023', time: '14:32:05',
    plate: '30F-123.45', vehicleDesc: 'Sedan - Toyota Camry', vehicleType: 'car',
    lot: 'ParkFlow Central',
    title: 'Quá giờ đỗ xe (>48h)',
    description: 'Xe chưa rời bãi sau 2 ngày, không thể liên lạc chủ xe qua SDT đã đăng ký.',
    status: 'pending',
  },
  {
    id: 'EX-002',
    date: '24/10/2023', time: '13:15:20',
    plate: '29K1-888.88', vehicleDesc: 'Xe máy - Honda SH', vehicleType: 'motorbike',
    lot: 'ParkFlow Thủ Đức',
    title: 'Lỗi đọc thẻ tại lối ra',
    description: 'Mã thẻ ID: #PF-00921 không khớp với lịch sử vào. Nghi vấn nhầm thẻ.',
    status: 'processing',
  },
  {
    id: 'EX-003',
    date: '24/10/2023', time: '10:05:00',
    plate: '15C-555.55', vehicleDesc: 'Xe tải - Isuzu', vehicleType: 'truck',
    lot: 'ParkFlow Quận 9',
    title: 'Cảnh báo Đen (Blacklist)',
    description: 'Biển số nằm trong danh sách hạn chế của ban quản lý. Hệ thống tự động khóa cổng.',
    status: 'resolved',
  },
  {
    id: 'EX-004',
    date: '23/10/2023', time: '22:45:12',
    plate: '51H-999.01', vehicleDesc: 'Xe điện - Tesla Model 3', vehicleType: 'ev',
    lot: 'ParkFlow Central',
    title: 'Lỗi Thanh toán MoMo',
    description: 'Giao dịch đã trừ tiền trên app nhưng hệ thống chưa ghi nhận trạng thái thành công.',
    status: 'pending',
  },
];

const BAR_DATA = [
  { day: 'Thứ 2', h: 38 },
  { day: 'Thứ 3', h: 52 },
  { day: 'Hôm nay', h: 84, today: true },
  { day: 'Thứ 5', h: 0 },
  { day: 'Thứ 6', h: 0 },
  { day: 'Thứ 7', h: 0 },
  { day: 'CN',    h: 0 },
];

const STATUS_STYLE: Record<ExStatus, { badge: string; label: string }> = {
  pending:    { badge: 'bg-pink-100 text-pink-700 border border-pink-200',   label: 'Đang chờ'     },
  processing: { badge: 'bg-slate-100 text-slate-600 border border-slate-200',label: 'Đang xử lý'   },
  resolved:   { badge: 'bg-green-100 text-green-700 border border-green-200',label: 'Đã giải quyết'},
};

const VehicleIcon = ({ type }: { type: ExceptionRow['vehicleType'] }) => {
  const cls = 'h-5 w-5';
  if (type === 'motorbike') return <Bike className={cls} />;
  if (type === 'truck')     return <Truck className={cls} />;
  if (type === 'ev')        return <Zap className={cls} />;
  return <Car className={cls} />;
};

const ICON_BG: Record<ExceptionRow['vehicleType'], string> = {
  car:       'bg-blue-50 text-blue-600',
  motorbike: 'bg-orange-50 text-orange-600',
  truck:     'bg-slate-100 text-slate-600',
  ev:        'bg-emerald-50 text-emerald-600',
};

const EMERGENCY_STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  NEW:      { badge: 'bg-rose-100 text-rose-700 border border-rose-200',       label: 'MỚI'       },
  LOGGED:   { badge: 'bg-amber-100 text-amber-700 border border-amber-200',    label: 'ĐÃ GHI'    },
  RESOLVED: { badge: 'bg-slate-100 text-slate-600 border border-slate-200',    label: 'ĐÃ XỬ'     },
  FIXED:    { badge: 'bg-green-100 text-green-700 border border-green-200',    label: 'ĐÃ SỬA'    },
};

export default function ManagerExceptions({ setView: _setView, emergencyLogs = [] }: ManagerExceptionsProps) {
  const [searchLot,    setSearchLot]    = useState('Bãi đỗ xe');
  const [searchPlate,  setSearchPlate]  = useState('');
  const [filterType,   setFilterType]   = useState('Loại Ngoại lệ');
  const [filterStatus, setFilterStatus] = useState('Trạng thái');

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Ngoại lệ</h1>
          <p className="mt-1 text-sm text-slate-500">Giám sát và giải quyết các sự cố bất thường trong hệ thống.</p>
        </div>
        <button className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
          <ShieldAlert className="h-4 w-4" />
          Giải quyết Ngoại lệ
        </button>
      </div>

      {/* ── Staff Emergency Alerts ── */}
      {emergencyLogs.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-5 w-5 text-rose-600" />
            <h2 className="font-bold text-rose-800">Cảnh báo khẩn cấp từ nhân viên</h2>
            <span className="ml-auto rounded-full bg-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-700">
              {emergencyLogs.filter(l => l.status === 'NEW').length} mới
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {emergencyLogs.map((log) => {
              const st = EMERGENCY_STATUS_STYLE[log.status] ?? EMERGENCY_STATUS_STYLE.NEW;
              return (
                <div key={log.id} className="rounded-xl border border-rose-100 bg-white p-4 shadow-sm space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                      <span className="text-sm font-bold text-slate-800 leading-snug line-clamp-1">{log.title}</span>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${st.badge}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{log.description}</p>
                  {(log.slotCode || log.floor) && (
                    <div className="flex items-center gap-1 text-[11px] text-rose-600 font-semibold">
                      <MapPin className="h-3 w-3" />
                      {[log.floor, log.slotCode].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>{log.createdAt}</span>
                    <span className="font-semibold">Báo cáo bởi: {log.reportedBy}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([
          {
            icon: Timer,      iconBg: 'bg-blue-50   text-blue-500',
            tag: 'Tháng này', tagColor: 'text-slate-400',
            label: 'Tổng Ngoại lệ', value: '1,284',
            sub: '+12%↑', subColor: 'text-blue-500',
          },
          {
            icon: RefreshCw,  iconBg: 'bg-orange-50 text-orange-500',
            tag: 'Cần xử lý', tagColor: 'text-slate-400',
            label: 'Chờ Giải quyết', value: '42',
            sub: '-5%↓', subColor: 'text-green-500',
          },
          {
            icon: ShieldAlert, iconBg: 'bg-red-50    text-red-500',
            tag: 'Khẩn cấp',  tagColor: 'text-red-500',
            label: 'Sự cố Bảo mật', value: '08',
            sub: 'Nghiêm trọng', subColor: 'text-red-500',
          },
          {
            icon: Clock3,     iconBg: 'bg-green-50  text-green-500',
            tag: 'Trung bình', tagColor: 'text-slate-400',
            label: 'TG Phản hồi TB', value: '14.5',
            sub: 'phút', subColor: 'text-slate-400',
          },
        ] as const).map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`text-[11px] font-semibold ${s.tagColor}`}>{s.tag}</span>
              </div>
              <p className="mt-3 text-xs text-slate-500">{s.label}</p>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-3xl font-bold text-slate-800">{s.value}</span>
                <span className={`mb-0.5 text-xs font-semibold ${s.subColor}`}>{s.sub}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Lot dropdown */}
        <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
          {searchLot}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {/* Plate search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchPlate}
            onChange={(e) => setSearchPlate(e.target.value)}
            placeholder="Tìm biển số/ID..."
            className="w-52 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Type dropdown */}
        <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
          {filterType}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {/* Status dropdown */}
        <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
          {filterStatus}
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {/* Filter icon */}
        <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Ngày & Giờ','Thông tin Xe','Bãi đỗ','Mô tả Ngoại lệ','Trạng thái','Thao tác'].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ROWS.map((row) => {
              const st = STATUS_STYLE[row.status];
              return (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  {/* Date & Time */}
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800">{row.date}</p>
                    <p className="text-xs text-slate-400">{row.time}</p>
                  </td>

                  {/* Vehicle */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_BG[row.vehicleType]}`}>
                        <VehicleIcon type={row.vehicleType} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{row.plate}</p>
                        <p className="text-xs text-slate-400">{row.vehicleDesc}</p>
                      </div>
                    </div>
                  </td>

                  {/* Lot */}
                  <td className="px-5 py-4 text-slate-700">{row.lot}</td>

                  {/* Description */}
                  <td className="max-w-xs px-5 py-4">
                    <p className="font-semibold text-slate-800">{row.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{row.description}</p>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.badge}`}>
                      {st.label}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    {row.status === 'resolved' ? (
                      <div className="flex items-center gap-2">
                        <button className="text-sm font-medium text-blue-600 hover:underline">Xem lại</button>
                        <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button className={`rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 ${row.status === 'processing' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          Chi tiết
                        </button>
                        <button className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${row.status === 'processing' ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                          Giải quyết
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-500">Hiển thị 1 - 10 trong 42 ngoại lệ đang chờ</p>
          <div className="flex items-center gap-1">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {[1,2,3].map((n) => (
              <button key={n} className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${n === 1 ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {n}
              </button>
            ))}
            <span className="px-1 text-slate-400">...</span>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">5</button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom row: trend chart + AI insight ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bar chart */}
        <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-800">Xu hướng Ngoại lệ</h3>
          <div className="flex items-end gap-3" style={{ height: 100 }}>
            {BAR_DATA.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-md ${d.today ? 'bg-slate-800' : 'bg-blue-200'}`}
                  style={{ height: d.h > 0 ? `${d.h}px` : '4px', opacity: d.h === 0 ? 0.2 : 1 }}
                />
                <span className={`text-[10px] ${d.today ? 'font-bold text-slate-700' : 'text-slate-400'}`}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insight */}
        <div className="rounded-2xl bg-blue-600 p-6 text-white shadow-sm">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/50">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold">ParkFlow AI Insight</h3>
          <p className="mt-2 text-sm text-blue-100">
            Hôm nay số lượng ngoại lệ "Lỗi thẻ" tăng 15% so với trung bình. Chúng tôi đề xuất kiểm tra đầu đọc thẻ tại Lối ra số 03.
          </p>
          <button className="mt-4 w-full rounded-xl bg-white py-2.5 text-sm font-bold text-blue-600 transition hover:bg-blue-50">
            Chạy Chẩn đoán
          </button>
        </div>
      </div>
    </div>
  );
}
