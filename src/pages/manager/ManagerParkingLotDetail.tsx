import { useEffect, useState } from 'react';
import {
  MapPin, Car, Bookmark, Wrench,
  LayoutGrid, ArrowLeft, RefreshCw,
} from 'lucide-react';
import type { Reservation, Slot, User } from '../../data/mockData';
import ParkingFloorMap, { type MapSlot } from '../../components/ParkingFloorMap';
import { findLot, sameLot } from '../../utils/parkingLots';
import ActivityLog from '../staff/ActivityLog';
import { fetchAccessLogs, type SharedAccessLog } from '../../services/accessLogService';

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
  /** Cho bảng nhật ký tra ra người đặt chỗ khi bấm xem chi tiết một lượt. */
  reservations?: Reservation[];
  users?: User[];
}

export default function ManagerParkingLotDetail({
  setView,
  lot,
  slots = [],
  reservations = [],
  users = [],
}: ManagerParkingLotDetailProps) {
  // ── Nhật ký qua cổng CỦA ĐÚNG BÃI NÀY ──────────────────────────────────────
  //
  // Trước đây khối này là 4 dòng viết cứng (51G-888.99, 29A-123.45...) hiện
  // giống hệt nhau ở mọi bãi. Nay đọc dbo.access_logs — chính dữ liệu nhân
  // viên ghi ở trang "Nhật ký hoạt động" — và lọc theo tên bãi đang xem.
  const lotName = lot?.name ?? '';
  const [logs, setLogs] = useState<SharedAccessLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!lotName) return;
    let cancelled = false;
    setLoadingLogs(true);
    fetchAccessLogs(lotName, 500).then((rows) => {
      if (cancelled) return;
      setLogs(rows);
      setLoadingLogs(false);
    });
    return () => { cancelled = true; };
  }, [lotName, reloadTick]);

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
    // Vẽ ô đúng chỗ Admin đã kéo thả trong trình thiết kế
    x: s.posX ?? null,
    y: s.posY ?? null,
    w: s.posW ?? null,
    h: s.posH ?? null,
    // Loai xe THAT cua o — khong suy tu chu cai dau ma o
    vehicleType: s.vehicleType,
  }));
  // Cổng vào/ra do Admin đặt riêng cho bãi này.
  const lotGates = findLot(lot.name)?.gates;

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
          <ParkingFloorMap slots={mapSlots} gates={lotGates} level={1} />
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            Bãi này chưa có dữ liệu ô đỗ trong hệ thống.
          </p>
        )}
      </div>

      {/* Nhật ký hoạt động — dùng LẠI đúng bảng của nhân viên (đủ bộ lọc theo
          ngày / loại xe / hành động, tìm biển số, phân trang và nút xem chi
          tiết từng lượt), chỉ đổi tiêu đề và giới hạn dữ liệu về bãi này. */}
      {loadingLogs ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Đang tải nhật ký của bãi…
        </div>
      ) : (
        <ActivityLog
          accessLogs={logs}
          reservations={reservations}
          users={users}
          title="Nhật ký hoạt động"
          subtitle={`Toàn bộ lượt xe qua cổng do nhân viên ${lot.name} ghi nhận — ${logs.length} lượt.`}
          headerRight={
            <button
              onClick={() => setReloadTick((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Làm mới
            </button>
          }
        />
      )}
    </div>
  );
}
