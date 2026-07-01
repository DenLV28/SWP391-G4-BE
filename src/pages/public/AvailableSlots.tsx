import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Car, CheckCircle, Clock3, Info, Moon, Triangle, X } from 'lucide-react';
import { Reservation, SavedVehicle, Slot, User, VehicleKey } from '../../data/mockData';
import parkingSecurityImage from '../../assets/images/an-ninh.jpg';
import VietQRModal from '../../components/VietQRModal';
import ParkingFloorMap, { MapSlot } from '../../components/ParkingFloorMap';
import { createVNPayPayment } from '../../services/vnpayService';
import { createPayment } from '../../services/paymentService';

interface Props {
  setView: (view: string) => void;
  slots: Slot[];
  isLoggedIn: boolean;
  currentUser: User | null;
  savedVehicles: SavedVehicle[];
  onAddReservation: (res: any) => Reservation | null;
  reservations: Reservation[];
}

type PackageKey = 'hour' | 'overnight' | 'month';

const pricingRows = [
  { key: 'motorbike', label: 'Xe máy / Xe máy điện', sub: 'Mô tô, tay ga, xe điện 2 bánh', price: '10.000đ', unit: '/lượt' },
  { key: 'car',       label: 'Ô tô 4-7 chỗ (Xăng)',  sub: 'Sedan, SUV, Hatchback', price: '25.000đ', unit: '/giờ' },
  { key: 'ev',        label: 'Ô tô 4-7 chỗ (Điện / EV)', sub: 'EV + trạm sạc kèm theo', price: '30.000đ', unit: '/giờ' },
];

const LOT_OPTIONS = [
  'ParkFlow Quận 9 - Lò Lu',
  'ParkFlow Thủ Đức - Linh Trung',
  'ParkFlow Long Phước',
];

// Legend items

const vehicleLabelMap: Record<string, string> = {
  car: 'Ô tô 4-7 chỗ (Xăng)',
  motorbike: 'Xe máy / Xe máy điện',
  'electric vehicle': 'Ô tô 4-7 chỗ (Điện / EV)',
};

export default function AvailableSlots({
  setView,
  slots,
  isLoggedIn,
  currentUser,
  savedVehicles,
  onAddReservation,
}: Props) {
  const [selectedLot, setSelectedLot] = useState(LOT_OPTIONS[0]);
  const [fullName, setFullName] = useState(currentUser?.fullName ?? 'Nguyễn Văn A');
  const [phone, setPhone] = useState(currentUser?.phone ?? '090 123 4567');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleKey>('car');
  const [packageKey, setPackageKey] = useState<PackageKey>('hour');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [bookedReservation, setBookedReservation] = useState<Reservation | null>(null);
  const [showPayNow, setShowPayNow] = useState(false);
  const [loadingVNPay, setLoadingVNPay] = useState(false);

  const userVehicles = useMemo(
    () => savedVehicles.filter((v) => v.userId === currentUser?.id),
    [savedVehicles, currentUser?.id],
  );

  // Sync name/phone when user changes
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName);
      setPhone(currentUser.phone);
    }
  }, [currentUser?.id, currentUser?.fullName, currentUser?.phone]);

  // Auto-select default vehicle
  useEffect(() => {
    const uv = savedVehicles.filter((v) => v.userId === currentUser?.id);
    const def = uv.find((v) => v.isDefault) ?? uv[0] ?? null;
    if (def) {
      setSelectedVehicleId(def.id);
      setVehicleType(def.vehicleType as VehicleKey);
      setLicensePlate(def.licensePlate);
    } else {
      setSelectedVehicleId(null);
      setLicensePlate('');
      setVehicleType('car');
    }
  }, [savedVehicles, currentUser?.id]);

  const handleSelectVehicle = (v: SavedVehicle) => {
    setSelectedVehicleId(v.id);
    setVehicleType(v.vehicleType as VehicleKey);
    setLicensePlate(v.licensePlate);
  };

  const matchedSlot = useMemo(() => {
    // Only look up a real slot — skip virtual map spaces (no backing data)
    if (selectedSlotId && !selectedSlotId.startsWith('virtual-')) {
      const found = slots.find((s) => s.id === selectedSlotId);
      if (found) return found;
    }
    // Auto-assign: prefer matching vehicle type, then fallback
    const order: VehicleKey[] = [vehicleType, 'car', 'motorbike', 'electric vehicle'];
    for (const type of order) {
      const slot = slots.find((s) => s.status === 'Available' && s.vehicleType === type);
      if (slot) return slot;
    }
    return slots.find((s) => s.status === 'Available') ?? null;
  }, [slots, vehicleType, selectedSlotId]);

  const reservationMeta = useMemo(() => {
    if (packageKey === 'overnight')
      return { reservationType: 'Fixed-time' as const, startTime: '18:00', endTime: '23:30', label: 'Qua đêm' };
    if (packageKey === 'month')
      return { reservationType: 'Flexible' as const, startTime: '09:00', endTime: undefined, label: 'Theo tháng' };
    return { reservationType: 'Fixed-time' as const, startTime: '09:00', endTime: '11:00', label: 'Gửi theo lượt' };
  }, [packageKey]);

  const estimatedCost = useMemo(() => {
    const isMoto = vehicleType === 'motorbike';
    const isEV   = vehicleType === 'electric vehicle';
    if (isMoto) return packageKey === 'month' ? 200000 : packageKey === 'overnight' ? 30000 : 10000;
    if (packageKey === 'month') return isEV ? 1200000 : 700000;
    if (packageKey === 'overnight') return isEV ? 100000 : 80000;
    return isEV ? 30000 : 25000;
  }, [vehicleType, packageKey]);

  const isSlotExplicitlySelected = selectedSlotId !== null && !selectedSlotId.startsWith('virtual-');

  const handleBook = () => {
    if (!isLoggedIn) { setView('login'); return; }
    if (!isSlotExplicitlySelected) {
      alert('Vui lòng chọn ô đỗ trên sơ đồ bãi bên dưới trước khi đặt chỗ.');
      return;
    }
    if (!matchedSlot) { alert('Hiện không còn chỗ phù hợp.'); return; }
    const created = onAddReservation({
      reservationType: reservationMeta.reservationType,
      slotAssignmentMode: 'Auto',
      vehicleType,
      licensePlate: licensePlate.trim(),
      date: new Date().toISOString().split('T')[0],
      startTime: reservationMeta.startTime,
      endTime: reservationMeta.endTime,
      floor: matchedSlot.floorName,
      area: matchedSlot.areaName,
      slotCode: matchedSlot.slotCode,
      note: reservationMeta.label,
      estimatedCost,
    });
    if (created) setBookedReservation(created);
  };

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    handleBook();
  };

  const handlePayVNPay = async () => {
    if (!bookedReservation || !currentUser) return;
    try {
      setLoadingVNPay(true);
      const paymentId = `PAY-${bookedReservation.reservationCode}-${Date.now()}`;
      await createPayment({
        id: paymentId,
        userId: currentUser.id,
        ticketCode: bookedReservation.reservationCode,
        licensePlate: bookedReservation.licensePlate,
        parkingFee: estimatedCost,
        extraServiceFee: 0,
        lostTicketFee: 0,
        discount: 0,
        totalAmount: estimatedCost,
        method: '',
        status: 'Unpaid',
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      });
      const url = await createVNPayPayment(
        paymentId,
        estimatedCost,
        `Dat cho truoc ${bookedReservation.reservationCode}`,
      );
      window.location.href = url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể kết nối VNPay. Vui lòng thử lại.');
      setLoadingVNPay(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="space-y-6">

          {/* ── TOP: Parking slot map ── */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800">Sơ đồ bãi đỗ — Chọn ô đỗ</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chỉ hiển thị khu vực phù hợp với loại xe đã chọn. Nhấp vào ô trắng để chọn vị trí.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {[
                  { color: 'bg-white border border-blue-400', label: 'Trống' },
                  { color: 'bg-green-600', label: 'Đang đỗ' },
                  { color: 'bg-amber-100 border border-amber-400', label: 'Chờ duyệt' },
                  { color: 'bg-amber-400', label: 'Đã đặt' },
                  { color: 'bg-slate-200', label: 'Loại xe khác' },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1 text-slate-500">
                    <span className={`inline-block h-3 w-3 rounded-sm ${l.color}`} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="p-5">
              <ParkingFloorMap
                slots={slots.map((s) => ({ id: s.id, code: s.slotCode.split('-').pop() ?? s.slotCode, status: s.status } as MapSlot))}
                selectedId={selectedSlotId}
                onSelect={(id) => setSelectedSlotId((prev) => (prev === id ? null : id))}
                interactive={true}
                level={1}
                filterVehicleType={
                  vehicleType === 'motorbike' ? 'motorbike' :
                  vehicleType === 'electric vehicle' ? 'ev' :
                  'car'
                }
              />
            </div>
          </div>

          {/* ── BOTTOM: Form + Pricing (2-col) ── */}
          <div className="grid gap-6 lg:grid-cols-[7fr_5fr] lg:items-start">

            {/* LEFT: Booking form (without map) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Thông tin đặt chỗ</h2>

              {!isLoggedIn && (
                <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-700 leading-6">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                  Bạn đang xem ở chế độ khách. Hãy đăng nhập để xác nhận đặt chỗ.
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Chọn bãi đỗ */}
                <Field label="Chọn bãi đỗ">
                  <div className="relative">
                    <select
                      value={selectedLot}
                      onChange={(e) => setSelectedLot(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-[15px] text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                    >
                      {LOT_OPTIONS.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </Field>

                {/* Name + Phone */}
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Họ và tên">
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="h-12 w-full rounded-xl border border-slate-300 px-4 text-[15px] outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                    />
                  </Field>
                  <Field label="Số điện thoại">
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="090 123 4567"
                      className="h-12 w-full rounded-xl border border-slate-300 px-4 text-[15px] outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                    />
                  </Field>
                </div>

                {/* Plate + Type */}
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Biển số xe">
                    <input
                      value={licensePlate}
                      onChange={(e) => { setLicensePlate(e.target.value); setSelectedVehicleId(null); }}
                      placeholder="51A-123.45"
                      className="h-12 w-full rounded-xl border border-slate-300 px-4 text-[15px] uppercase outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                    />
                  </Field>
                  <Field label="Loại phương tiện">
                    <div className="relative">
                      <select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value as VehicleKey)}
                        className="h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-10 text-[15px] outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
                      >
                        <option value="motorbike">Xe máy / Xe máy điện</option>
                        <option value="car">Ô tô 4-7 chỗ (Xăng)</option>
                        <option value="electric vehicle">Ô tô 4-7 chỗ (Điện / EV)</option>
                      </select>
                      <svg className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </Field>
                </div>

                {/* Vehicle quick-select (logged in) */}
                {isLoggedIn && userVehicles.length > 0 && (
                  <div>
                    <span className="mb-3 block text-[14px] font-semibold text-slate-700">Chọn xe đã lưu</span>
                    <div className="flex flex-wrap gap-2">
                      {userVehicles.map((v) => {
                        const isSelected = selectedVehicleId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleSelectVehicle(v)}
                            className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left text-[14px] transition ${
                              isSelected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                            }`}
                          >
                            <Car className="h-4 w-4 shrink-0" />
                            <div>
                              <div className="font-semibold leading-tight">{v.licensePlate}</div>
                              <div className="text-[12px] text-slate-500 leading-tight">
                                {vehicleLabelMap[v.vehicleType] ?? v.vehicleType}
                                {v.brand ? ` · ${v.brand}` : ''}
                                {v.isDefault ? ' · Mặc định' : ''}
                              </div>
                            </div>
                            {isSelected && <CheckCircle className="h-4 w-4 text-blue-600 ml-1 shrink-0" />}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => { setSelectedVehicleId(null); setLicensePlate(''); setVehicleType('car'); }}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[14px] transition ${
                          selectedVehicleId === null ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'
                        }`}
                      >
                        + Nhập thủ công
                      </button>
                    </div>
                  </div>
                )}

                {/* Duration */}
                <div>
                  <span className="mb-3 block text-[14px] font-semibold text-slate-700">Thời gian gửi dự kiến</span>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: 'hour' as const, icon: Clock3, label: 'Gửi theo lượt' },
                      { key: 'overnight' as const, icon: Moon, label: 'Qua đêm' },
                      { key: 'month' as const, icon: CalendarDays, label: 'Theo tháng' },
                    ].map((item) => {
                      const Icon = item.icon;
                      const active = packageKey === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setPackageKey(item.key)}
                          className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-center transition ${
                            active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-[13px] font-semibold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected slot indicator */}
                {isSlotExplicitlySelected && matchedSlot ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span>
                      Ô đã chọn: <strong>{matchedSlot.slotCode}</strong> — {matchedSlot.floorName} · {matchedSlot.areaName}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
                    <Triangle className="h-4 w-4 shrink-0" />
                    <span>Vui lòng chọn ô đỗ trên sơ đồ bên dưới <strong>(bắt buộc)</strong></span>
                  </div>
                )}

                {/* Submit — stays inside form for enter-key support */}
                <button
                  type={isLoggedIn ? 'submit' : 'button'}
                  onClick={() => { if (!isLoggedIn) setView('login'); }}
                  disabled={isLoggedIn && !isSlotExplicitlySelected}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-blue-600 text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition hover:bg-blue-700 mt-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  {isLoggedIn ? 'Xác nhận đặt chỗ' : 'Đăng nhập để đặt chỗ'}
                  <ArrowRight className="h-5 w-5" />
                </button>
              </form>
            </section>

            {/* RIGHT: Pricing + AI card */}
            <aside className="space-y-6">
              {/* Pricing */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="mb-4 text-[13px] font-bold uppercase tracking-widest text-blue-700">Tham khảo giá</p>
                <div className="space-y-3">
                  {pricingRows.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-blue-300"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                          <Car className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-slate-800">{row.label}</p>
                          <p className="text-[13px] text-slate-500">{row.sub}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[16px] font-bold text-blue-600">{row.price}</p>
                        <p className="text-[12px] text-slate-400">{row.unit}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Info note */}
                <div className="mt-5 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-[13px] text-slate-600 leading-relaxed">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                  Giá vé có thể thay đổi tùy theo khung giờ cao điểm và ngày lễ. Quý khách vui lòng kiểm tra kỹ trước khi thanh toán.
                </div>

                {/* Warning */}
                <div className="mt-3 flex gap-3 border-t border-slate-100 pt-4 text-[13px] text-slate-600">
                  <Triangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500 fill-amber-500" />
                  <p>
                    <strong>Lưu ý:</strong> Sau 2 tiếng nếu xe chưa đến thì hệ thống sẽ tự động xóa chỗ đã đặt trước.
                  </p>
                </div>
              </div>

              {/* AI card */}
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <img
                  src={parkingSecurityImage}
                  alt="ParkFlow AI"
                  className="h-48 w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                  <h3 className="text-xl font-bold leading-tight">An tâm tuyệt đối với ParkFlow AI</h3>
                  <p className="mt-1 text-[13px] text-white/85">Hệ thống nhận diện biển số tự động chính xác 99.9%</p>
                </div>
              </div>
            </aside>
          </div>


        </div>
      </main>

      {/* ── Success modal ── */}
      {bookedReservation && !showPayNow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => { setBookedReservation(null); setView('reservations'); }}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Đặt chỗ thành công!</h3>
              <p className="text-[11px] text-slate-400">
                Mã đặt chỗ: <strong className="font-mono text-slate-700">{bookedReservation.reservationCode}</strong>
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-1.5 text-[11px]">
              {[
                { label: 'Biển số xe', value: bookedReservation.licensePlate },
                { label: 'Ô đỗ', value: `${bookedReservation.slotCode} · ${bookedReservation.floor}` },
                { label: 'Ngày giờ', value: `${bookedReservation.date} ${bookedReservation.startTime}` },
                { label: 'Phí ước tính', value: `${estimatedCost.toLocaleString('vi-VN')}đ`, blue: true },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-slate-400">{row.label}</span>
                  <span className={row.blue ? 'font-bold text-blue-700' : 'font-semibold text-slate-700'}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setBookedReservation(null); setView('reservations'); }}
                className="w-1/2 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Thanh toán sau
              </button>
              <button
                type="button"
                onClick={handlePayVNPay}
                disabled={loadingVNPay}
                className="w-1/2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {loadingVNPay ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Đang chuyển...
                  </>
                ) : (
                  '💳 Thanh toán VNPay'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {bookedReservation && showPayNow && (
        <VietQRModal
          amount={estimatedCost}
          description={`ParkFlow ${bookedReservation.reservationCode}`}
          onConfirm={() => { setShowPayNow(false); setBookedReservation(null); setView('reservations'); }}
          onClose={() => setShowPayNow(false)}
          onPayLater={() => { setShowPayNow(false); setBookedReservation(null); setView('reservations'); }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}
