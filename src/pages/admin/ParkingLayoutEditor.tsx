import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LogIn, LogOut, Plus, Save, Trash2 } from 'lucide-react';
import ParkingFloorMap, { type MapGate, type MapSlot } from '../../components/ParkingFloorMap';
import type { LotGate, LotGridSlot, ParkingLotInfo } from '../../utils/parkingLots';
import { updateParkingLot } from '../../services/parkingLotService';

/**
 * Trình thiết kế sơ đồ của Admin. Dùng lại đúng mặt bằng mẫu mà mọi role đang
 * xem (ParkingFloorMap ở designMode) thay vì một canvas kéo-thả riêng, nên bãi
 * mới trông y hệt các bãi cũ — Admin chỉ cần bấm chọn ô đỗ và đặt cổng.
 */

type VehicleKey = LotGridSlot['vehicleType'];

const VEHICLE_LABEL: Record<VehicleKey, string> = {
  car: 'Ô tô (xăng)',
  motorbike: 'Xe máy',
  'electric vehicle': 'Ô tô điện (EV)',
};

// Loại xe mặc định của từng dãy — khớp ROW_DEFAULTS bên backend.
const ROW_VEHICLE: Record<string, VehicleKey> = {
  A: 'car', B: 'motorbike', C: 'electric vehicle', D: 'car', E: 'motorbike',
};

const GATE_POSITIONS: { value: LotGate['position']; label: string }[] = [
  { value: 'left', label: 'Trái' },
  { value: 'center', label: 'Giữa' },
  { value: 'right', label: 'Phải' },
];

export default function ParkingLayoutEditor({
  lot,
  setView,
  onSaved,
}: {
  lot: ParkingLotInfo | null;
  setView: (view: string) => void;
  onSaved: () => Promise<void>;
}) {
  const [slots, setSlots] = useState<LotGridSlot[]>([]);
  const [gates, setGates] = useState<LotGate[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lot) {
      setView('parkinglotmanagement');
      return;
    }
    setSlots(lot.slots.map((s) => ({ ...s })));
    setGates(lot.gates.map((g) => ({ ...g })));
    setSelectedCode(null);
    setMessage('');
    setError('');
  }, [lot, setView]);

  // ParkingFloorMap khớp ô theo `code`; ở designMode chỉ cần biết ô nào tồn tại.
  const mapSlots: MapSlot[] = useMemo(
    () => slots.map((s) => ({ id: s.code, code: s.code, status: 'Available' as MapSlot['status'] })),
    [slots],
  );
  const mapGates: MapGate[] = useMemo(
    () => gates.map((g) => ({ kind: g.kind, label: g.label, position: g.position })),
    [gates],
  );

  if (!lot) return null;

  const selected = selectedCode ? slots.find((s) => s.code === selectedCode) : null;

  const handleToggleSlot = (code: string) => {
    setMessage('');
    setSlots((prev) => {
      const exists = prev.some((s) => s.code === code);
      if (exists) {
        setSelectedCode(null);
        return prev.filter((s) => s.code !== code);
      }
      setSelectedCode(code);
      return [...prev, { code, vehicleType: ROW_VEHICLE[code[0]] ?? 'car' }];
    });
  };

  const handleChangeVehicleType = (vehicleType: VehicleKey) => {
    if (!selectedCode) return;
    setSlots((prev) => prev.map((s) => (s.code === selectedCode ? { ...s, vehicleType } : s)));
  };

  const handleAddGate = (kind: LotGate['kind']) => {
    setGates((prev) => [
      ...prev,
      { kind, label: kind === 'entry' ? 'Cổng vào' : 'Cổng ra', position: 'left' },
    ]);
  };

  const handleUpdateGate = (index: number, patch: Partial<LotGate>) => {
    setGates((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    const result = await updateParkingLot(lot.id, {
      name: lot.name,
      bookingLabel: lot.bookingLabel,
      address: lot.address,
      description: lot.description,
      imageData: lot.imageData,
      mapsUrl: lot.mapsUrl,
      status: lot.status,
      slots,
      gates,
    });
    setSaving(false);
    await onSaved();
    if (!result.ok) {
      // 409 = có ô đang có xe/đặt chỗ nên không bỏ được; phần còn lại đã lưu.
      setError(result.error || 'Không thể lưu sơ đồ.');
      if (result.lot) setSlots(result.lot.slots.map((s) => ({ ...s })));
      return;
    }
    setMessage('Đã lưu sơ đồ bãi đỗ.');
  };

  const countByType = (t: VehicleKey) => slots.filter((s) => s.vehicleType === t).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('parkinglotmanagement')}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            title="Quay lại danh sách bãi đỗ"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Thiết kế sơ đồ: {lot.name}</h1>
            <p className="text-xs text-slate-500">
              Bấm vào ô trên sơ đồ để thêm hoặc bỏ ô đỗ. Ô nét đứt là chưa có trong bãi.
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Đang lưu...' : 'Lưu sơ đồ'}
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <ParkingFloorMap
            slots={mapSlots}
            gates={mapGates}
            designMode
            onToggleSlot={handleToggleSlot}
            selectedId={selectedCode}
            level={1}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Sức chứa</h3>
            <p className="mt-2 text-2xl font-black text-slate-900">{slots.length} <span className="text-sm font-bold text-slate-400">ô đỗ</span></p>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              {(Object.keys(VEHICLE_LABEL) as VehicleKey[]).map((t) => (
                <div key={t} className="flex justify-between">
                  <span>{VEHICLE_LABEL[t]}</span>
                  <span className="font-bold text-slate-800">{countByType(t)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Ô đang chọn</h3>
            {selected ? (
              <div className="mt-2 space-y-2">
                <p className="font-mono text-sm font-black text-slate-900">{selected.code}</p>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Loại xe</label>
                <select
                  value={selected.vehicleType}
                  onChange={(e) => handleChangeVehicleType(e.target.value as VehicleKey)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                >
                  {(Object.keys(VEHICLE_LABEL) as VehicleKey[]).map((t) => (
                    <option key={t} value={t}>{VEHICLE_LABEL[t]}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleToggleSlot(selected.code)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Bỏ ô này khỏi bãi
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Bấm một ô trên sơ đồ để chỉnh loại xe.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cổng vào / ra</h3>
            <div className="mt-2 space-y-2">
              {gates.length === 0 && (
                <p className="text-xs text-slate-400">Chưa có cổng nào. Thêm ít nhất 1 cổng vào và 1 cổng ra.</p>
              )}
              {gates.map((g, i) => (
                <div key={i} className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        g.kind === 'entry'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {g.kind === 'entry' ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                      {g.kind === 'entry' ? 'Vào' : 'Ra'}
                    </span>
                    <button
                      onClick={() => setGates((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-rose-600"
                      title="Xóa cổng"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    value={g.label}
                    onChange={(e) => handleUpdateGate(i, { label: e.target.value })}
                    placeholder="Tên cổng"
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-600"
                  />
                  <select
                    value={g.position}
                    onChange={(e) => handleUpdateGate(i, { position: e.target.value as LotGate['position'] })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-600"
                  >
                    {GATE_POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>Vị trí: {p.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleAddGate('entry')}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-50 px-2 py-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Cổng vào
              </button>
              <button
                onClick={() => handleAddGate('exit')}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-rose-50 px-2 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Cổng ra
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
