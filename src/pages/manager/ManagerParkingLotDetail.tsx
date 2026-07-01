import React, { useState } from 'react';
import {
  MapPin, Printer, Settings2, Car, Bookmark, Wrench,
  LayoutGrid, ArrowLeft,
} from 'lucide-react';
import ParkingFloorMap, { type MapSlot } from '../../components/ParkingFloorMap';

const FLOORS = ['Tầng G', 'Tầng B1', 'Tầng B2'];

type SlotStatus = 'empty' | 'occupied' | 'reserved' | 'maintenance';

interface SlotCell { id: string; label: string; status: SlotStatus }

const makeRow = (prefix: string, statuses: SlotStatus[]): SlotCell[] =>
  statuses.map((status, i) => ({ id: `${prefix}${i + 1}`, label: `${prefix}${i + 1}`, status }));

const FLOOR_DATA: Record<string, SlotCell[]> = {
  'Tầng G': [
    ...makeRow('A', ['empty','occupied','empty','maintenance','empty','reserved','empty','occupied','empty','empty']),
    ...makeRow('B', ['empty','empty','reserved','empty','empty','occupied','empty','empty','maintenance','empty']),
  ],
  'Tầng B1': [
    ...makeRow('A', ['occupied','occupied','empty','empty','reserved','occupied','empty','maintenance','empty','empty']),
    ...makeRow('B', ['empty','reserved','empty','occupied','empty','empty','occupied','empty','empty','maintenance']),
  ],
  'Tầng B2': [
    ...makeRow('A', ['empty','empty','occupied','empty','maintenance','empty','reserved','empty','occupied','empty']),
    ...makeRow('B', ['occupied','empty','empty','reserved','empty','occupied','empty','empty','empty','maintenance']),
  ],
};

const STATUS_MAP: Record<SlotStatus, MapSlot['status']> = {
  empty: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  maintenance: 'Maintenance',
};

function toMapSlots(cells: SlotCell[]): MapSlot[] {
  return cells
    .map((cell) => ({
      id: cell.id,
      code: `${cell.id[0]}${cell.id.slice(1).padStart(2, '0')}`,
      status: STATUS_MAP[cell.status],
    }))
    .filter((s) => {
      const num = parseInt(s.code.slice(1), 10);
      const p = s.code[0];
      return (p === 'A' && num <= 11) || (p === 'B' && num <= 5);
    });
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

export default function ManagerParkingLotDetail({ setView }: { setView: (v: string) => void }) {
  const [activeFloor, setActiveFloor] = useState('Tầng G');
  const mapSlots = toMapSlots(FLOOR_DATA[activeFloor] ?? []);
  const mapLevel = activeFloor === 'Tầng G' ? 1 : 2;

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Toà nhà ParkFlow Central</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Đang hoạt động
              </span>
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-3.5 w-3.5" />
                79 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <Printer className="h-4 w-4" />
              In Báo Cáo
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              <Settings2 className="h-4 w-4" />
              Chỉnh sửa toà nhà
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards — 4 cards, no occupancy percentage */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {([
          { icon: LayoutGrid, color: 'text-slate-600', border: 'border-slate-200', label: 'Tổng số vị trí', value: 500, sub: '+12 tháng này' },
          { icon: Car,        color: 'text-blue-600',  border: 'border-blue-200',  label: 'Đang dùng',      value: 210, sub: '' },
          { icon: Bookmark,   color: 'text-purple-600',border: 'border-purple-200',label: 'Đã đặt',         value: 35,  sub: '' },
          { icon: Wrench,     color: 'text-red-500',   border: 'border-red-200',   label: 'Bảo trì',        value: 15,  sub: '' },
        ] as const).map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-2xl border ${s.border} bg-white p-4 shadow-sm`}>
              <div className="flex items-center justify-between">
                <Icon className={`h-5 w-5 ${s.color}`} />
                {s.sub && <span className="text-[10px] text-slate-400">{s.sub}</span>}
              </div>
              <p className="mt-3 text-xs text-slate-500">{s.label}</p>
              <p className={`mt-0.5 text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Floor map */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Sơ đồ vị trí chi tiết</h2>
          <div className="flex gap-1">
            {FLOORS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFloor(f)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                  activeFloor === f
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <ParkingFloorMap slots={mapSlots} level={mapLevel} />
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
              <tr className="border-b border-slate-100">
                {['Thời gian', 'Biển số', 'Hành động', 'Loại xe', 'Trạng thái'].map((h) => (
                  <th key={h} className="pb-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ACTIVITY_LOG.map((log, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="py-3 text-slate-500">{log.time}</td>
                  <td className="py-3 font-mono font-semibold text-slate-800">{log.plate}</td>
                  <td className="py-3 text-slate-700">{log.action}</td>
                  <td className="py-3 text-slate-600">{log.type}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(log.status)}`}>
                      {log.status}
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
