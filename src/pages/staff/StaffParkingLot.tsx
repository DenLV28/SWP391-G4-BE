import React, { useState } from 'react';
import { Building2, MapPin, Printer, Edit3 } from 'lucide-react';

const FLOORS = ['Tầng G', 'Tầng B1', 'Tầng B2'];

type SlotStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

interface SlotCell {
  id: string;
  label: string;
  status: SlotStatus;
}

const makeRow = (prefix: string, count: number, statuses: SlotStatus[]): SlotCell[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    label: `${prefix}${i + 1}`,
    status: statuses[i] ?? 'available',
  }));

const G_STATUSES_A: SlotStatus[] = ['occupied','occupied','occupied','occupied','occupied','occupied','available','maintenance','available','available'];
const G_STATUSES_B: SlotStatus[] = ['occupied','occupied','occupied','occupied','reserved','available','available','available','available','available'];
const B1_STATUSES_C: SlotStatus[] = ['occupied','occupied','occupied','occupied','occupied','occupied','occupied','available','available','available'];
const B1_STATUSES_D: SlotStatus[] = ['occupied','occupied','occupied','occupied','occupied','maintenance','available','available','available','available'];
const B2_STATUSES_E: SlotStatus[] = ['occupied','occupied','occupied','occupied','available','available','available','available','available','available'];
const B2_STATUSES_F: SlotStatus[] = ['occupied','occupied','occupied','reserved','available','available','available','available','available','available'];

const FLOOR_SLOTS: Record<string, SlotCell[]> = {
  'Tầng G':  [...makeRow('A', 10, G_STATUSES_A),  ...makeRow('B', 10, G_STATUSES_B)],
  'Tầng B1': [...makeRow('C', 10, B1_STATUSES_C), ...makeRow('D', 10, B1_STATUSES_D)],
  'Tầng B2': [...makeRow('E', 10, B2_STATUSES_E), ...makeRow('F', 10, B2_STATUSES_F)],
};

const SLOT_STYLE: Record<SlotStatus, string> = {
  available:   'bg-green-50  border-green-300  text-green-700',
  occupied:    'bg-blue-50   border-blue-300   text-blue-700',
  reserved:    'bg-yellow-50 border-yellow-300 text-yellow-700',
  maintenance: 'bg-red-50    border-red-300    text-red-700',
};

const ACTIVITY_LOG = [
  { time: '08:32', plate: '51A-123.45', action: 'Vào bãi',   type: 'Ô tô',    status: 'Thành công' },
  { time: '08:15', plate: '59B-678.90', action: 'Ra bãi',    type: 'Xe máy',  status: 'Thành công' },
  { time: '07:55', plate: '51F-234.56', action: 'Đặt chỗ',   type: 'Ô tô',    status: 'Đang chờ'   },
  { time: '07:40', plate: '51G-345.67', action: 'Vào bãi',   type: 'Ô tô',    status: 'Thành công' },
  { time: '07:22', plate: '51H-456.78', action: 'Ra bãi',    type: 'Xe máy',  status: 'Thất bại'   },
  { time: '07:10', plate: '51K-567.89', action: 'Đặt chỗ',   type: 'Ô tô',    status: 'Thành công' },
];

const statusBadge = (s: string) => {
  if (s === 'Thành công') return 'bg-green-100 text-green-700';
  if (s === 'Thất bại')   return 'bg-red-100   text-red-700';
  return 'bg-yellow-100 text-yellow-700';
};

export default function StaffParkingLot({ setView: _setView }: { setView: (v: string) => void }) {
  const [activeFloor, setActiveFloor] = useState('Tầng G');
  const slots = FLOOR_SLOTS[activeFloor] ?? [];

  return (
    <div className="space-y-6">
      {/* Building header */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">Toà nhà ParkFlow Central</h1>
                <span className="rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Đang hoạt động
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-3.5 w-3.5" />
                79 Đường Lê Lợi, Quận 1, TP. HCM
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <Printer className="h-4 w-4" />
              In Báo Cáo
            </button>
            <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              <Edit3 className="h-4 w-4" />
              Chỉnh sửa toà nhà
            </button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {([
          { label: 'Tổng số vị trí', value: 500, sub: '',    color: 'text-slate-800', bg: 'bg-white',       border: 'border-slate-100' },
          { label: 'Còn trống',      value: 240, sub: '48%', color: 'text-green-700', bg: 'bg-green-50',    border: 'border-green-100' },
          { label: 'Đang dùng',      value: 210, sub: '42%', color: 'text-blue-700',  bg: 'bg-blue-50',     border: 'border-blue-100'  },
          { label: 'Đã đặt',         value: 35,  sub: '7%',  color: 'text-yellow-700',bg: 'bg-yellow-50',   border: 'border-yellow-100'},
          { label: 'Bảo trì',        value: 15,  sub: '3%',  color: 'text-red-700',   bg: 'bg-red-50',      border: 'border-red-100'   },
        ] as const).map((s) => (
          <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-4 shadow-sm`}>
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
            <p className={`mt-1 text-3xl font-bold ${s.color}`}>{s.value}</p>
            {s.sub && <p className="mt-0.5 text-xs text-slate-400">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Floor map */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-slate-800">Sơ đồ vị trí chi tiết</h2>

        {/* Floor tabs */}
        <div className="mb-4 flex gap-2">
          {FLOORS.map((floor) => (
            <button
              key={floor}
              onClick={() => setActiveFloor(floor)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                activeFloor === floor
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {floor}
            </button>
          ))}
        </div>

        {/* Slot grid */}
        <div className="grid grid-cols-10 gap-1.5">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className={`cursor-default select-none rounded-lg border py-2 text-center text-xs font-semibold ${SLOT_STYLE[slot.status]}`}
            >
              {slot.label}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
          {([
            { cls: 'bg-green-50  border-green-300',  label: 'Còn trống' },
            { cls: 'bg-blue-50   border-blue-300',   label: 'Đang dùng' },
            { cls: 'bg-yellow-50 border-yellow-300', label: 'Đã đặt'    },
            { cls: 'bg-red-50    border-red-300',    label: 'Bảo trì'   },
          ] as const).map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded border ${l.cls}`} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Activity log */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Nhật ký hoạt động gần đây</h2>
          <button className="text-xs font-medium text-blue-600 hover:underline">Xem tất cả</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Thời gian', 'Biển số', 'Hành động', 'Loại xe', 'Trạng thái'].map((h) => (
                  <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ACTIVITY_LOG.map((log, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2.5 text-slate-500">{log.time}</td>
                  <td className="py-2.5 font-mono text-slate-800">{log.plate}</td>
                  <td className="py-2.5 text-slate-700">{log.action}</td>
                  <td className="py-2.5 text-slate-600">{log.type}</td>
                  <td className="py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(log.status)}`}>
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
