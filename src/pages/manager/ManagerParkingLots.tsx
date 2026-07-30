import { useMemo, useState } from 'react';
import { MapPin, LayoutGrid, List, X, Building2, Car, BarChart3, UserCog } from 'lucide-react';
import { Floor, Area, Slot, User } from '../../data/mockData';
import { sameLot, findLotStatus } from '../../utils/parkingLots';
import type { ParkingLotStatus, LotStatus } from '../../services/parkingLotService';
// Same real lot photos the public "Bãi xe nổi bật" list uses (per-lot match)
import baiXeQuan9Img from '../../assets/images/bai-xe-quan-9.jpg';
import baiXeThuDucImg from '../../assets/images/bai-xe-thu-duc.jpg';
import baiXeLongPhuocImg from '../../assets/images/bai-xe-long-phuoc.jpg';
// Nhà Văn Hóa chưa có ảnh chụp thật — dùng ảnh chi nhánh ParkFlow chung làm placeholder.
import baiXeNhaVanHoaImg from '../../assets/images/xe-trong.jpg';

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
  users?: User[];
  setView: (view: string) => void;
  onAssignStaff?: (userId: string, lotName: string) => Promise<boolean>;
  /** Bấm "Xem chi tiết" — báo cho ManagerDashboard biết bãi nào để trang chi tiết render đúng bãi. */
  onViewDetail?: (lot: { name: string; address: string; status: string }) => void;
  /** Trạng thái vận hành thật của từng bãi (nguồn: dbo.parking_lots qua App.tsx) — ghi đè status tĩnh bên dưới. */
  lotStatuses?: ParkingLotStatus[];
  onUpdateLotStatus?: (name: string, status: LotStatus) => Promise<boolean>;
}

// Tên/địa chỉ/ảnh/sức chứa tĩnh — chỉ "status" là đổi được, và status thật
// nằm ở dbo.parking_lots (xem lotStatuses prop), không phải giá trị tĩnh dưới đây.
const INITIAL_LOTS: ParkingLot[] = [
  {
    id: 'lot-1',
    name: 'ParkFlow Long Phước',
    address: 'Tp, 15/3 Đ. Số 3, Thủ Đức, Hồ Chí Minh 720300, Việt Nam',
    status: 'Hoạt động',
    totalSlots: 600,
    occupied: 450,
    imageUrl: baiXeLongPhuocImg,
  },
  {
    id: 'lot-2',
    name: 'ParkFlow Thủ Đức',
    address: '86/33 Đ. Số 5, khu phố 3, Linh Xuân, Hồ Chí Minh, Việt Nam',
    status: 'Hoạt động',
    totalSlots: 400,
    occupied: 180,
    imageUrl: baiXeThuDucImg,
  },
  {
    id: 'lot-3',
    name: 'ParkFlow Quận 9',
    address: '5A Đường Lò Lu, KP. Phước Hiệp, P, Long Phước, Hồ Chí Minh 700000, Việt Nam',
    status: 'Bảo trì',
    totalSlots: 500,
    occupied: 0,
    imageUrl: baiXeQuan9Img,
  },
  {
    id: 'lot-4',
    name: 'ParkFlow Nhà Văn Hóa',
    address: 'Nhà Văn Hóa Sinh Viên, Đông Hòa, Dĩ An, Bình Dương, Việt Nam',
    status: 'Hoạt động',
    totalSlots: 250,
    occupied: 90,
    imageUrl: baiXeNhaVanHoaImg,
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

export default function ManagerParkingLots({ setView, users = [], slots = [], onAssignStaff, onViewDetail, lotStatuses = [], onUpdateLotStatus }: ManagerParkingLotsProps) {
  // Status thật lấy từ dbo.parking_lots (lotStatuses); còn lotStatuses chưa
  // tải xong (mảng rỗng lúc mới mount) thì tạm dùng giá trị tĩnh bên trên.
  const lots = useMemo(
    () =>
      INITIAL_LOTS.map((l) => {
        const dbStatus = findLotStatus(lotStatuses, l.name);
        return dbStatus ? { ...l, status: dbStatus.status } : l;
      }),
    [lotStatuses],
  );
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [assigningLot, setAssigningLot] = useState<string | null>(null);
  // "Chỉnh sửa" — switch a lot between "Hoạt động" and "Bảo trì".
  const [editingLot, setEditingLot] = useState<ParkingLot | null>(null);
  const [editStatus, setEditStatus] = useState<LotStatus>('Hoạt động');
  const [savingStatus, setSavingStatus] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSaveStatus = async () => {
    if (!editingLot) return;
    setSavingStatus(true);
    setSaveError('');
    const ok = await onUpdateLotStatus?.(editingLot.name, editStatus);
    setSavingStatus(false);
    if (ok === false) {
      setSaveError('Không thể lưu trạng thái. Vui lòng thử lại.');
      return;
    }
    setEditingLot(null);
  };

  const staffUsers = users.filter((u) => u.role === 'Parking Staff');

  /** Staff đang phụ trách một bãi (so khớp mọi biến thể tên bãi). */
  const staffOfLot = (lotName: string) =>
    staffUsers.find((u) => sameLot(u.assignedParkingLot, lotName));

  // Quy tắc 1 bãi ↔ 1 nhân viên: gán người mới thì gỡ người cũ của bãi đó;
  // chọn "— Chưa gán —" thì gỡ người đang phụ trách. users.assigned_parking_lot
  // chỉ có 1 cột nên staff được gán bãi mới tự động rời bãi cũ.
  const handleAssignChange = async (lotName: string, userId: string) => {
    if (!onAssignStaff) return;
    setAssigningLot(lotName);
    try {
      const current = staffOfLot(lotName);
      if (current && current.id !== userId) {
        await onAssignStaff(current.id, '');
      }
      if (userId && current?.id !== userId) {
        await onAssignStaff(userId, lotName);
      }
    } finally {
      setAssigningLot(null);
    }
  };

  /** Sức chứa/lấp đầy thật từ kho ô đỗ của bãi; bãi chưa có ô đỗ → dùng số tĩnh. */
  const lotStats = (lot: ParkingLot) => {
    const lotSlots = slots.filter((s) => sameLot(s.parkingLot, lot.name));
    if (lotSlots.length === 0) return { totalSlots: lot.totalSlots, occupied: lot.occupied };
    return {
      totalSlots: lotSlots.length,
      occupied: lotSlots.filter((s) => s.status === 'Occupied').length,
    };
  };

  const totalCapacity = lots.reduce((s, l) => s + lotStats(l).totalSlots, 0);
  const activeLots = lots.filter((l) => l.status === 'Hoạt động');
  const activeOccupancy = activeLots.length > 0
    ? Math.round((activeLots.reduce((s, l) => s + lotStats(l).occupied, 0) / Math.max(1, activeLots.reduce((s, l) => s + lotStats(l).totalSlots, 0))) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50/60 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Quản lý Bãi đỗ xe</h1>
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
          const { totalSlots, occupied } = lotStats(lot);
          const pct = totalSlots > 0 ? Math.round((occupied / totalSlots) * 100) : 0;
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
                      Tình trạng: {occupied.toLocaleString('vi-VN')}/{totalSlots.toLocaleString('vi-VN')}
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

                {/* Staff assignment */}
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <UserCog className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="shrink-0 text-xs text-slate-500">Nhân viên phụ trách:</span>
                  <select
                    value={staffOfLot(lot.name)?.id ?? ''}
                    onChange={(e) => handleAssignChange(lot.name, e.target.value)}
                    disabled={assigningLot === lot.name}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
                  >
                    <option value="">— Chưa gán —</option>
                    {staffUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingLot(lot);
                      setEditStatus(lot.status === 'Bảo trì' ? 'Bảo trì' : 'Hoạt động');
                      setSaveError('');
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    onClick={() => {
                      onViewDetail?.({ name: lot.name, address: lot.address, status: lot.status });
                      setView('parkinglotdetail');
                    }}
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

      {/* Edit status Modal */}
      {editingLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Chỉnh sửa trạng thái bãi xe</h2>
                <p className="mt-0.5 text-sm text-slate-500">{editingLot.name}</p>
              </div>
              <button
                onClick={() => setEditingLot(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs font-semibold text-slate-600">Chọn trạng thái hoạt động</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'Hoạt động' as LotStatus, label: 'Đang hoạt động', desc: 'Bãi mở cửa, nhận xe bình thường' },
                  { key: 'Bảo trì' as LotStatus, label: 'Bảo trì', desc: 'Tạm ngưng nhận xe để bảo trì' },
                ]).map((opt) => {
                  const active = editStatus === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setEditStatus(opt.key)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? opt.key === 'Hoạt động'
                            ? 'border-green-400 bg-green-50 ring-2 ring-green-200'
                            : 'border-slate-400 bg-slate-50 ring-2 ring-slate-200'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[opt.key]}`} />
                        {opt.label}
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-slate-500">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
              {saveError && <p className="text-[11px] font-medium text-red-500">{saveError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingLot(null)}
                  disabled={savingStatus}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveStatus}
                  disabled={savingStatus}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingStatus ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
