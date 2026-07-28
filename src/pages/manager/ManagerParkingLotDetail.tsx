import { useEffect } from 'react';
import {
  MapPin, Car, Bookmark, Wrench,
  LayoutGrid, ArrowLeft,
} from 'lucide-react';
import type { Slot } from '../../data/mockData';
import ParkingFloorMap, { type MapSlot } from '../../components/ParkingFloorMap';
import { sameLot } from '../../utils/parkingLots';

/** Bãi đang xem chi tiết — do ManagerParkingLots truyền qua khi bấm "Xem chi tiết". */
export interface LotDetailInfo {
  name: string;
  address: string;
  status: string;
}

interface ManagerParkingLotDetailProps {
  setView: (v: string) => void;
  /** Bãi được chọn; thiếu (vd. F5 giữa chừng) → quay về danh sách. */
  lot?: LotDetailInfo | null;
  /** Toàn bộ ô đỗ hệ thống — trang tự lọc theo bãi đang xem. */
  slots?: Slot[];
}

const ACTIVITY_LOG = [
  { time: '14:32:01', plate: '51G-888.99', action: 'Vào (Tháng)',  type: 'Ô tô 4-7 chỗ', status: 'Thành công' },
  { time: '14:30:15', plate: '29A-123.45', action: 'Ra (Lượt)',    type: 'Ô tô 4-7 chỗ', status: 'Thành công' },
  { time: '14:28:44', plate: '60B-456.78', action: 'Vào (Lượt)',   type: 'Xe máy',        status: 'Cảnh báo'  },
  { time: '14:25:30', plate: '59H-999.00', action: 'Ra (Tháng)',   type: 'Ô tô 4-7 chỗ', status: 'Thành công' },
];

const statusBadge = (s: string) => {
  if (s === 'Thành công') return 'bg-green-100 text-green-700';
  if (s === 'Cảnh báo')   return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

export default function ManagerParkingLotDetail({ setView, lot, slots = [] }: ManagerParkingLotDetailProps) {
  // Không biết đang xem bãi nào (vd. refresh trang) → về danh sách bãi
  useEffect(() => {
    if (!lot) setView('parkinglots');
  }, [lot, setView]);
  if (!lot) return null;

  // Cùng nguồn ô đỗ với sơ đồ của Staff và form Đặt chỗ của User — mọi role
  // nhìn cùng một trạng thái bãi.
  const lotSlots = slots.filter((s) => sameLot(s.parkingLot, lot.name));
  const mapSlots: MapSlot[] = lotSlots.map((s) => ({
    id: s.slotCode,
    code: s.slotCode.split('-').pop() ?? s.slotCode,
    status: s.status as MapSlot['status'],
  }));

  const occupied    = lotSlots.filter((s) => s.status === 'Occupied').length;
  const reserved    = lotSlots.filter((s) => s.status === 'Reserved' || s.status === 'Pending').length;
  const maintenance = lotSlots.filter((s) => s.status === 'Maintenance' || s.status === 'Locked').length;

  const isActive = lot.status === 'Hoạt động';

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Back link */}
      <button
        onClick={() => setView('parkinglots')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
      </button>

      {/* Building header */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{lot.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
              isActive
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-400'}`} />
              {isActive ? 'Đang hoạt động' : lot.status}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {lot.address}
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards — số liệu thật của bãi đang xem */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {([
          { icon: LayoutGrid, color: 'text-slate-600', border: 'border-slate-200', label: 'Tổng số vị trí', value: lotSlots.length },
          { icon: Car,        color: 'text-blue-600',  border: 'border-blue-200',  label: 'Đang dùng',      value: occupied },
          { icon: Bookmark,   color: 'text-purple-600',border: 'border-purple-200',label: 'Đã đặt',         value: reserved },
          { icon: Wrench,     color: 'text-red-500',   border: 'border-red-200',   label: 'Bảo trì',        value: maintenance },
        ] as const).map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-2xl border ${s.border} bg-white p-4 shadow-sm`}>
              <Icon className={`h-5 w-5 ${s.color}`} />
              <p className="mt-3 text-xs text-slate-500">{s.label}</p>
              <p className={`mt-0.5 text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Floor map — cùng sơ đồ mà Staff phụ trách bãi này và User đặt chỗ nhìn thấy */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Sơ đồ vị trí chi tiết</h2>
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            {lot.name}
          </span>
        </div>

        {lotSlots.length > 0 ? (
          <ParkingFloorMap slots={mapSlots} level={1} />
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            Bãi này chưa có dữ liệu ô đỗ trong hệ thống.
          </p>
        )}
      </div>

      {/* Activity log */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Nhật ký hoạt động gần đây</h2>
          <button className="text-xs font-semibold text-blue-600 hover:underline">Xem tất cả</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 pr-3">Thời gian</th>
                <th className="py-2.5 pr-3">Biển số</th>
                <th className="py-2.5 pr-3">Hành động</th>
                <th className="py-2.5 pr-3">Loại xe</th>
                <th className="py-2.5 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITY_LOG.map((row) => (
                <tr key={`${row.time}-${row.plate}`} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{row.time}</td>
                  <td className="py-2.5 pr-3 font-mono font-bold text-slate-800">{row.plate}</td>
                  <td className="py-2.5 pr-3 text-slate-600">{row.action}</td>
                  <td className="py-2.5 pr-3 text-slate-500">{row.type}</td>
                  <td className="py-2.5 text-right">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
