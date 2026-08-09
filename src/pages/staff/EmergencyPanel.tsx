import React, { useMemo, useState } from 'react';
import {
  Car, AlertTriangle, Bike, Monitor, Search, MapPin, ArrowLeftRight, X, CalendarClock,
} from 'lucide-react';
import type { Slot, Reservation, ParkingSession, VehicleKey, User } from '../../data/mockData';
import ParkingFloorMap, { type MapSlot } from '../../components/ParkingFloorMap';
import { findLot } from '../../utils/parkingLots';
import { relocateSlot } from '../../services/slotService';
import { addOneMonth } from '../../utils/reservationPricing';

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  car: 'Ô tô 4-7 chỗ (Xăng)',
  motorbike: 'Xe máy / Xe máy điện',
  'electric vehicle': 'Ô tô 4-7 chỗ (Điện / EV)',
};

/**
 * "Sự cố Khẩn cấp" panel — báo cáo khẩn cấp + sơ đồ trực tiếp + nhật ký.
 * Lives on the staff Bảng điều khiển (StaffOverview).
 */

const STATUS_VI: Record<string, string> = {
  Available:   'Trống',
  Occupied:    'Đang đỗ',
  Reserved:    'Đã đặt',
  Pending:     'Chờ duyệt',
  Maintenance: 'Bảo trì',
  Locked:      'Đã khóa',
};

/** So khớp biển số bất chấp dấu gạch/chấm: "29C138383" tìm ra "29C1-383.83". */
const normalizePlate = (p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Một hàng trong bảng "Xe đang đỗ trong bãi" — hợp nhất từ Reservation hoặc ParkingSession. */
type ParkedVehicleRow = {
  id: string;
  licensePlate: string;
  slotCode: string;
  floor: string;
  vehicleType: VehicleKey;
  dateLabel: string;
  timeLabel: string;
};

interface EmergencyPanelProps {
  /** Ô đỗ CỦA BÃI STAFF PHỤ TRÁCH (StaffDashboard đã lọc sẵn theo bãi). */
  slots?: Slot[];
  /** Đặt chỗ của bãi phụ trách — nguồn cho bảng "xe đang đỗ ở đâu". */
  reservations?: Reservation[];
  /** Phiên gửi xe đang hoạt động của bãi phụ trách — bổ sung xe vào không đặt trước (walk-in) mà reservations không có. */
  sessions?: ParkingSession[];
  /** Bãi staff phụ trách — hiển thị cố định, staff không đổi được bãi. */
  assignedLot?: string;
  addToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onSetSlotStatus?: (slotCode: string, status: Slot['status']) => Promise<boolean>;
  /** id của nhân viên đang đăng nhập — backend dùng để xác thực thao tác chuyển ô đỗ. */
  actorId?: string;
  /** Danh bạ người dùng — chỉ để hiện TÊN CHỦ XE trong bảng xe tháng. */
  users?: User[];
}

/** Một ô tháng + chi tiết chiếc xe đang được giữ chỗ ở đó. */
type MonthlySlotRow = {
  reservationId: string;
  slotCode: string;
  licensePlate: string;
  vehicleType: VehicleKey;
  ownerName: string;
  reservationCode: string;
  startDate: string;
  expiryDate: string;
  daysLeft: number;
  /** Xe có đang thật sự nằm trong bãi lúc này không (khách tháng ra/vào tự do). */
  inLot: boolean;
  /** Trạng thái ô trên sơ đồ — 'Locked' là đang giữ chỗ, 'Occupied' là có xe. */
  slotStatus?: Slot['status'];
};

const normalizePlateKey = (p: string) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export default function EmergencyPanel({
  slots = [],
  reservations = [],
  sessions = [],
  assignedLot,
  addToast,
  onSetSlotStatus,
  actorId,
  users = [],
}: EmergencyPanelProps) {
  const [eAreaMode, setEAreaMode] = useState<'all' | 'car' | 'motorbike'>('all');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // ── Bãi phụ trách ───────────────────────────────────────────────────────────
  // Staff chỉ làm việc trên đúng bãi được Quản lý phân công — không còn dropdown
  // chọn bãi. Nhãn đầy đủ lấy từ danh mục bãi (vd. "ParkFlow Quận 9 - Lò Lu").
  const assignedLotLabel = useMemo(
    () => findLot(assignedLot)?.name ?? assignedLot ?? '',
    [assignedLot],
  );
  const lotSlots = slots;
  // Bị phân công lại bãi khác giữa phiên → ô đang chọn (bãi cũ) không còn hợp lệ
  React.useEffect(() => {
    setSelectedSlot(null);
  }, [assignedLot]);

  // ── Tra cứu biển số → vị trí đỗ (trong bãi phụ trách) ───────────────────────
  const [searchPlate, setSearchPlate] = useState('');
  // Nguồn "xe đang đỗ" gộp từ 2 bảng: reservations (xe đặt trước đã check-in)
  // VÀ parking_sessions (mọi xe đang có vé mở, kể cả khách vãng lai không đặt
  // trước — reservations không có các xe này). Một xe đặt trước sau khi vào
  // bãi có CẢ HAI bản ghi cùng slot_code, nên loại trùng theo slotCode.
  const parkedVehicles: ParkedVehicleRow[] = useMemo(() => {
    const fromReservations: ParkedVehicleRow[] = reservations
      .filter((r) => r.status === 'Checked-in' && r.slotCode)
      .map((r) => ({
        id: `res-${r.id}`,
        licensePlate: r.licensePlate,
        slotCode: r.slotCode as string,
        floor: r.floor,
        vehicleType: r.vehicleType,
        dateLabel: r.date?.split('T')[0] ?? '',
        timeLabel: r.startTime?.slice(0, 5) ?? '',
      }));
    const coveredSlotCodes = new Set(fromReservations.map((r) => r.slotCode));
    // XE CHƯA XẾP Ô VẪN LÀ XE ĐANG ĐỖ.
    //
    // Bãi chưa có ô cho loại xe đó thì vé được mở với slot_code rỗng. Bộ lọc cũ
    // đòi `s.slotCode` nên những xe này biến mất khỏi bảng — nhân viên thấy xe
    // đứng trong bãi mà hệ thống thì không, đúng như báo lỗi "cho xe máy vào rồi
    // không thấy xe máy đâu". Vẫn loại trùng theo ô, nhưng chỉ với vé CÓ ô.
    const fromWalkInSessions: ParkedVehicleRow[] = sessions
      .filter((s) => !s.slotCode || !coveredSlotCodes.has(s.slotCode))
      .map((s) => {
        const [dateLabel = '', timeLabel = ''] = (s.checkInTime || '').split(' ');
        return {
          id: `session-${s.id}`,
          licensePlate: s.licensePlate,
          slotCode: s.slotCode,
          floor: s.floor,
          vehicleType: s.vehicleType,
          dateLabel,
          timeLabel: timeLabel.slice(0, 5),
        };
      });
    return [...fromReservations, ...fromWalkInSessions];
  }, [reservations, sessions]);
  const matchedVehicles = useMemo(() => {
    const q = normalizePlate(searchPlate);
    if (!q) return parkedVehicles;
    return parkedVehicles.filter((r) => normalizePlate(r.licensePlate).includes(q));
  }, [parkedVehicles, searchPlate]);

  // ── Xe tháng đang giữ ô trong bãi ──────────────────────────────────────────
  //
  // CHỈ lấy đăng ký tháng ĐÃ CÓ Ô. Khách tháng chưa được xếp ô thì chưa có "ô
  // tháng" nào để nói tới — đưa vào danh sách sẽ thành một dòng trỏ vào hư
  // không. Số này được đếm riêng và ghi chú bên dưới bảng để không giấu mất.
  //
  // Khác hẳn bảng "Xe đang đỗ trong bãi" ở cột bên: ô tháng vẫn thuộc về khách
  // kể cả lúc xe đi vắng, nên bảng này liệt kê theo Ô chứ không theo lượt gửi.
  const todayIso = new Date().toISOString().slice(0, 10);
  const activeMonthly = useMemo(
    () =>
      reservations.filter(
        (r) =>
          r.note === 'Theo tháng' &&
          r.status !== 'Cancelled' &&
          r.status !== 'Expired' &&
          todayIso <= addOneMonth(r.date.split('T')[0]),
      ),
    [reservations, todayIso],
  );
  const monthlyWithoutSlot = activeMonthly.filter((r) => !r.slotCode).length;

  const monthlySlotRows: MonthlySlotRow[] = useMemo(() => {
    const parkedPlates = new Set(
      [
        ...sessions.map((s) => s.licensePlate),
        ...reservations.filter((r) => r.status === 'Checked-in').map((r) => r.licensePlate),
      ].map(normalizePlateKey),
    );
    // Một ô chỉ thuộc về MỘT khách tháng. Gia hạn tạo đăng ký mới trên cùng ô,
    // nên giữ bản có ngày bắt đầu muộn nhất — đó mới là hợp đồng đang hiệu lực.
    const bySlot = new Map<string, Reservation>();
    for (const r of activeMonthly) {
      if (!r.slotCode) continue;
      const cur = bySlot.get(r.slotCode);
      if (!cur || r.date > cur.date) bySlot.set(r.slotCode, r);
    }
    return [...bySlot.values()]
      .map((r) => {
        const startDate = r.date.split('T')[0];
        const expiryDate = addOneMonth(startDate);
        const msLeft = new Date(`${expiryDate}T23:59:59`).getTime() - Date.now();
        return {
          reservationId: r.id,
          slotCode: r.slotCode as string,
          licensePlate: r.licensePlate,
          vehicleType: r.vehicleType,
          ownerName: users.find((u) => String(u.id) === String(r.userId))?.fullName ?? '',
          reservationCode: r.reservationCode,
          startDate,
          expiryDate,
          daysLeft: Math.ceil(msLeft / 86400000),
          inLot: parkedPlates.has(normalizePlateKey(r.licensePlate)),
          slotStatus: lotSlots.find((s) => s.slotCode === r.slotCode)?.status,
        };
      })
      .sort((a, b) => a.slotCode.localeCompare(b.slotCode));
  }, [activeMonthly, sessions, reservations, users, lotSlots]);

  const mapSlotData: MapSlot[] = lotSlots.map((s) => ({
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

  const cleanSelectedSlot = selectedSlot?.startsWith('virtual-')
    ? selectedSlot.slice('virtual-'.length)
    : selectedSlot;

  const selectedSlotData = cleanSelectedSlot
    ? lotSlots.find((s) => s.slotCode === cleanSelectedSlot)
    : undefined;

  // ── Chuyển ô đỗ cho xe đang đỗ ───────────────────────────────────────────
  const [moveTarget, setMoveTarget] = useState<ParkedVehicleRow | null>(null);
  const [moveToSlot, setMoveToSlot] = useState('');
  const [moving, setMoving] = useState(false);

  // Ô đích hợp lệ: đang Trống VÀ đúng loại xe với xe đang chuyển — không cho
  // đỗ xe máy vào ô ô tô hay ngược lại. Backend xác thực lại lần nữa, đây chỉ
  // để không hiện lựa chọn sai cho nhân viên.
  const moveDestinationOptions = useMemo(() => {
    if (!moveTarget) return [];
    return lotSlots.filter((s) => s.status === 'Available' && s.vehicleType === moveTarget.vehicleType);
  }, [lotSlots, moveTarget]);

  const openMoveModal = (v: ParkedVehicleRow) => {
    setMoveTarget(v);
    setMoveToSlot('');
  };

  const closeMoveModal = () => {
    if (moving) return;
    setMoveTarget(null);
    setMoveToSlot('');
  };

  const handleConfirmMove = async () => {
    if (!moveTarget || !moveToSlot || !actorId) return;
    setMoving(true);
    const result = await relocateSlot(moveTarget.slotCode, moveToSlot, actorId);
    setMoving(false);
    if (result.ok === true) {
      addToast?.(`Đã chuyển xe ${moveTarget.licensePlate} sang ô ${result.toSlotCode}.`, 'success');
      setSelectedSlot(result.toSlotCode);
      setMoveTarget(null);
      setMoveToSlot('');
      return;
    }
    addToast?.(result.ok === false ? result.error : 'Không thể chuyển ô đỗ.', 'error');
  };

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Form */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
        {/* Bãi phụ trách — cố định theo phân công của Quản lý, không chọn được */}
        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-600">Bãi đỗ phụ trách</label>
          <div className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5">
            <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
            <span className="text-sm font-semibold text-slate-800">
              {assignedLotLabel || 'Chưa được phân công bãi'}
            </span>
          </div>
        </div>

        {/* Live parking floor map */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-600">Sơ đồ bãi đỗ — Trực tiếp</p>
              <p className="text-[11px] text-slate-400">Bấm vào ô để chọn vị trí sự cố</p>
            </div>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
              {([
                { key: 'all',       label: 'Tất cả', icon: Monitor },
                { key: 'car',       label: 'Ô tô',   icon: Car },
                { key: 'motorbike', label: 'Xe máy', icon: Bike },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setEAreaMode(key)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                    eAreaMode === key ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <ParkingFloorMap
              slots={mapSlotData}
              gates={findLot(assignedLot)?.gates}
              selectedId={selectedSlot}
              onSelect={(id) => setSelectedSlot(id === selectedSlot ? null : id)}
              interactive={true}
              issueMode={true}
              areaMode={eAreaMode}
            />
          </div>
          {cleanSelectedSlot && (
            <div className="mt-2 rounded-xl border border-slate-100 bg-white p-3">
              <p className="text-xs font-semibold text-rose-600">
                Vị trí đã chọn: <span className="font-bold">{selectedSlotData?.slotCode.split('-').pop() ?? cleanSelectedSlot}</span>
                {selectedSlotData && (
                  <span className="ml-2 font-normal text-slate-400">
                    ({selectedSlotData.floorName} · {STATUS_VI[selectedSlotData.status] ?? selectedSlotData.status})
                  </span>
                )}
              </p>
              {/* Bỏ khối "Đổi trạng thái ô đỗ".
                  Trạng thái ô phải phản ánh thực tế do luồng vào/ra/đặt chỗ
                  sinh ra; cho phép đặt tay ở đây tạo ra ô "Đang đỗ" mà không có
                  vé nào, hoặc "Đã đặt" mà không có đặt chỗ nào — sai lệch mà
                  không lần ra được nguồn gốc. Trang này chỉ để BÁO SỰ CỐ. */}
            </div>
          )}
        </div>

      </div>

      {/* Cột phải: xe tháng đang giữ ô trong bãi (thay cho nhật ký khẩn cấp) */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800">Thông tin xe tháng trong bãi</h3>
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-600">
              {monthlySlotRows.length} ô tháng
            </span>
          </div>

          <div className="space-y-3">
            {monthlySlotRows.map((row) => {
              // Sắp hết hạn thì phải đập vào mắt — nhân viên là người nhắc khách
              // gia hạn trước khi ô bị trả về cho bãi.
              const expiring = row.daysLeft <= 7;
              return (
                <div
                  key={row.reservationId}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                        {row.vehicleType === 'motorbike' ? <Bike className="h-5 w-5" /> : <Car className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-bold text-slate-800">
                          {row.licensePlate}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {VEHICLE_TYPE_LABEL[row.vehicleType] ?? row.vehicleType}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-violet-600 px-2 py-1 text-[11px] font-bold text-white">
                      {row.slotCode.split('-').pop()}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                    <div>
                      <dt className="text-slate-400">Chủ xe</dt>
                      <dd className="truncate font-semibold text-slate-700">{row.ownerName || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Mã đăng ký</dt>
                      <dd className="truncate font-semibold text-slate-700">{row.reservationCode}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Bắt đầu</dt>
                      <dd className="font-semibold text-slate-700">{row.startDate}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Hết hạn</dt>
                      <dd className={`font-semibold ${expiring ? 'text-rose-600' : 'text-slate-700'}`}>
                        {row.expiryDate}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        row.inLot ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {row.inLot ? 'Xe đang trong bãi' : 'Xe không có trong bãi'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                        expiring ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {row.daysLeft > 0 ? `Còn ${row.daysLeft} ngày` : 'Hết hạn hôm nay'}
                    </span>
                    {/* Ô tháng đúng ra phải là Locked (đang giữ) hoặc Occupied (xe
                        đang đỗ). Rơi vào trạng thái khác nghĩa là ô đã bị trả về
                        cho bãi trong khi thẻ tháng còn hạn — sai, cần báo lên. */}
                    {row.slotStatus && row.slotStatus !== 'Locked' && row.slotStatus !== 'Occupied' && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        Ô đang ở trạng thái {STATUS_VI[row.slotStatus] ?? row.slotStatus}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {monthlySlotRows.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                Bãi chưa có ô nào đăng ký theo tháng
              </p>
            )}

            {monthlyWithoutSlot > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                {monthlyWithoutSlot} thẻ tháng còn hạn nhưng CHƯA được xếp ô — không hiện ở
                trên vì chưa có ô tháng nào để hiển thị.
              </p>
            )}
          </div>
        </div>

        {/* Tra cứu biển số → vị trí xe đang đỗ */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-800">Xe đang đỗ trong bãi</h3>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-600">
              {parkedVehicles.length} xe
            </span>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
              placeholder="Tìm biển số (vd: 29C1-38383)..."
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm uppercase tracking-wider focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div className="max-h-72 overflow-y-auto">
            {matchedVehicles.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-2">Biển số</th>
                    <th className="py-2 pr-2">Vị trí</th>
                    <th className="py-2 pr-2 text-right">Giờ đến</th>
                    <th className="py-2 pl-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {matchedVehicles.map((v) => {
                    const isLocated = selectedSlot === v.slotCode;
                    return (
                      <tr
                        key={v.id}
                        // Bấm một xe → highlight đúng ô của nó trên sơ đồ bên trái
                        onClick={() => setSelectedSlot(isLocated ? null : v.slotCode ?? null)}
                        className={`cursor-pointer border-b border-slate-50 last:border-0 transition ${
                          isLocated ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                        title="Bấm để xem vị trí trên sơ đồ"
                      >
                        <td className="py-2.5 pr-2 font-mono font-bold text-slate-800">{v.licensePlate}</td>
                        <td className="py-2.5 pr-2">
                          {/* Xe vào lúc bãi chưa có ô cho loại của nó → chưa có
                              ô nào để chỉ. Nói thẳng thay vì để trống. */}
                          {v.slotCode ? (
                            <>
                              <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                                <MapPin className="h-3.5 w-3.5" />
                                {v.slotCode.split('-').pop() ?? v.slotCode}
                              </span>
                              <span className="block text-[10px] text-slate-400">{v.floor}</span>
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                <AlertTriangle className="h-3 w-3" /> CHƯA XẾP Ô
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                Bãi chưa có ô {VEHICLE_TYPE_LABEL[v.vehicleType] ?? v.vehicleType}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="py-2.5 pr-2 text-right text-xs text-slate-500">
                          {v.dateLabel}
                          <span className="block font-semibold text-slate-700">{v.timeLabel}</span>
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openMoveModal(v); }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            title="Chuyển xe sang ô đỗ khác"
                          >
                            <ArrowLeftRight className="h-3 w-3" />
                            Chuyển ô
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                {parkedVehicles.length === 0
                  ? 'Chưa có xe nào đang đỗ trong bãi'
                  : `Không tìm thấy biển số "${searchPlate}"`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Chuyển ô đỗ */}
    {moveTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Chuyển ô đỗ</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Xe <span className="font-mono font-bold text-slate-700">{moveTarget.licensePlate}</span>{' '}
                ({VEHICLE_TYPE_LABEL[moveTarget.vehicleType] ?? moveTarget.vehicleType}) — đang ở ô{' '}
                <span className="font-bold text-slate-700">{moveTarget.slotCode}</span>
              </p>
            </div>
            <button onClick={closeMoveModal} className="text-slate-400 hover:text-slate-700" disabled={moving}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-600">Chuyển đến ô</label>
            {moveDestinationOptions.length > 0 ? (
              <select
                value={moveToSlot}
                onChange={(e) => setMoveToSlot(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm text-slate-800 outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">— Chọn ô trống —</option>
                {moveDestinationOptions.map((s) => (
                  <option key={s.slotCode} value={s.slotCode}>
                    {s.slotCode} — {s.floorName} · {s.areaName}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                Không còn ô trống nào cùng loại xe ({VEHICLE_TYPE_LABEL[moveTarget.vehicleType] ?? moveTarget.vehicleType}) trong bãi.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeMoveModal}
              disabled={moving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmMove}
              disabled={!moveToSlot || moving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {moving ? 'Đang chuyển...' : 'Xác nhận chuyển'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
