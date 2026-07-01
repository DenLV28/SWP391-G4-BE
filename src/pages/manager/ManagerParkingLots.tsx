import { useState } from 'react';
import { MapPin, Plus, Filter, LayoutGrid, List, X, Building2, Car, BarChart3 } from 'lucide-react';
import { Floor, Area, Slot } from '../../data/mockData';

type LotStatus = 'Hoạt động' | 'Bảo trì' | 'Đóng cửa';

interface ParkingLot {
  id: string;
  name: string;
  address: string;
  status: LotStatus;
  totalSlots: number;
  occupied: number;
  imageUrl: string;
}

interface ManagerParkingLotsProps {
  floors?: Floor[];
  areas?: Area[];
  slots?: Slot[];
  setView: (view: string) => void;
}

const INITIAL_LOTS: ParkingLot[] = [
  {
    id: 'lot-1',
    name: 'ParkFlow Central',
    address: '123 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM',
    status: 'Hoạt động',
    totalSlots: 600,
    occupied: 450,
    imageUrl: 'https://picsum.photos/seed/parkcentral/400/240',
  },
  {
    id: 'lot-2',
    name: 'ParkFlow Thủ Đức',
    address: 'Đường số 7, Linh Trung, Thủ Đức, TP.HCM',
    status: 'Hoạt động',
    totalSlots: 400,
    occupied: 180,
    imageUrl: 'https://picsum.photos/seed/parkthuduc/400/240',
  },
  {
    id: 'lot-3',
    name: 'ParkFlow Quận 9',
    address: 'Phường Trường Thạnh, Quận 9, TP.HCM',
    status: 'Bảo trì',
    totalSlots: 500,
    occupied: 0,
    imageUrl: 'https://picsum.photos/seed/parkquan9/400/240',
  },
];

const STATUS_STYLE: Record<LotStatus, string> = {
  'Hoạt động': 'bg-green-100 text-green-700 border border-green-200',
  'Bảo trì':   'bg-slate-100 text-slate-600 border border-slate-200',
  'Đóng cửa':  'bg-red-100   text-red-600   border border-red-200',
};

const STATUS_DOT: Record<LotStatus, string> = {
  'Hoạt động': 'bg-green-500',
  'Bảo trì':   'bg-slate-400',
  'Đóng cửa':  'bg-red-500',
};

const EMPTY_FORM = { name: '', address: '', totalSlots: '', status: 'Hoạt động' as LotStatus };

export default function ManagerParkingLots({ setView }: ManagerParkingLotsProps) {
  const [lots, setLots] = useState<ParkingLot[]>(INITIAL_LOTS);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<typeof EMPTY_FORM>>({});

  const totalCapacity = lots.reduce((s, l) => s + l.totalSlots, 0);
  const activeLots = lots.filter((l) => l.status === 'Hoạt động');
  const activeOccupancy = activeLots.length > 0
    ? Math.round((activeLots.reduce((s, l) => s + l.occupied, 0) / activeLots.reduce((s, l) => s + l.totalSlots, 0)) * 100)
    : 0;

  const validate = () => {
    const e: Partial<typeof EMPTY_FORM> = {};
    if (!form.name.trim()) e.name = 'Bắt buộc';
    if (!form.address.trim()) e.address = 'Bắt buộc';
    if (!form.totalSlots || Number(form.totalSlots) <= 0) e.totalSlots = 'Nhập số > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = () => {
    if (!validate()) return;
    const newLot: ParkingLot = {
      id: `lot-${Date.now()}`,
      name: form.name.trim(),
      address: form.address.trim(),
      status: form.status,
      totalSlots: Number(form.totalSlots),
      occupied: 0,
      imageUrl: 'https://picsum.photos/seed/parknew/400/240',
    };
    setLots((prev) => [...prev, newLot]);
    setShowAdd(false);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Quản lý Bãi đỗ xe</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          Thêm bãi đỗ mới
        </button>
      </div>

      {/* 3 stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Tổng số bãi</p>
            <p className="mt-1 text-4xl font-bold text-slate-900">{String(lots.length).padStart(2, '0')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Sức chứa</p>
            <p className="mt-1 text-4xl font-bold text-slate-900">{totalCapacity.toLocaleString('vi-VN')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Tỷ lệ lấp đầy</p>
            <p className="mt-1 text-4xl font-bold text-slate-900">{activeOccupancy}%</p>
          </div>
        </div>
      </div>

      {/* List header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Danh sách bãi đỗ</h2>
        <div className="flex items-center gap-2">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 transition">
            <Filter className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md p-1.5 transition ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-md p-1.5 transition ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lot cards */}
      <div className={`space-y-4 ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4 !space-y-0' : ''}`}>
        {lots.map((lot) => {
          const pct = lot.totalSlots > 0 ? Math.round((lot.occupied / lot.totalSlots) * 100) : 0;
          return (
            <div key={lot.id} className="flex overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow">
              {/* Lot image */}
              <div className="hidden sm:block w-52 shrink-0 overflow-hidden">
                <img
                  src={lot.imageUrl}
                  alt={lot.name}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-900">{lot.name}</h3>
                    <span className={`rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLE[lot.status]}`}>
                      <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[lot.status]}`} />
                      {lot.status === 'Hoạt động' ? 'Đang hoạt động' : lot.status}
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {lot.address}
                  </p>
                </div>

                {/* Occupancy bar */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Tình trạng: {lot.occupied.toLocaleString('vi-VN')}/{lot.totalSlots.toLocaleString('vi-VN')}
                    </span>
                    <span className="font-bold text-blue-600">{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                    Chỉnh sửa
                  </button>
                  <button
                    onClick={() => setView('parkinglotdetail')}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition"
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-slate-400">
        © 2024 ParkFlow Manager — Hệ thống quản lý vận hành bãi xe thông minh
      </p>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Thêm bãi đỗ xe mới</h2>
                <p className="mt-0.5 text-sm text-slate-500">Điền thông tin để thêm bãi vào hệ thống</p>
              </div>
              <button
                onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); setErrors({}); }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                { key: 'name' as const, label: 'Tên bãi đỗ xe', placeholder: 'VD: ParkFlow Bình Thạnh', type: 'text' },
                { key: 'address' as const, label: 'Địa chỉ', placeholder: 'VD: 2 Hải Triều, Quận 1, TP.HCM', type: 'text' },
                { key: 'totalSlots' as const, label: 'Tổng số chỗ', placeholder: '500', type: 'number' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => { setForm((prev) => ({ ...prev, [f.key]: e.target.value })); setErrors((prev) => ({ ...prev, [f.key]: '' })); }}
                    className={`w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${errors[f.key] ? 'border-red-300' : 'border-slate-200'}`}
                  />
                  {errors[f.key] && <p className="mt-1 text-[11px] text-red-500">{errors[f.key]}</p>}
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Trạng thái</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as LotStatus }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="Hoạt động">Hoạt động</option>
                  <option value="Bảo trì">Bảo trì</option>
                  <option value="Đóng cửa">Đóng cửa</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); setErrors({}); }}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition"
                >
                  Thêm bãi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
