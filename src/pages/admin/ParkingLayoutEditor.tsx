import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LogIn, LogOut, Move, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
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

// Cỡ ô mặc định của lưới mẫu (khớp ROW_W/ROW_H trong ParkingFloorMap) — dùng
// làm giá trị hiển thị cho ô chưa từng được kéo dãn.
const DEFAULT_SLOT_SIZE = { w: 54, h: 40 };

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
  const [movingCode, setMovingCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // Form "thêm ô đỗ bất kỳ"
  const [newCode, setNewCode] = useState('');
  const [newVehicleType, setNewVehicleType] = useState<VehicleKey>('car');
  const [codeDraft, setCodeDraft] = useState('');

  useEffect(() => {
    if (!lot) setView('parkinglotmanagement');
  }, [lot, setView]);

  // Chỉ nạp lại state khi ĐỔI SANG BÃI KHÁC (theo lot.id), không phải mỗi lần
  // component re-render. Trước đây phụ thuộc cả object `lot` và `setView` nên
  // mọi lần App re-render (đồng bộ 30s, sự kiện SSE) đều ghi đè phần Admin đang
  // sửa dở — chỉnh cổng/ô đỗ xong là lập tức quay về như cũ.
  const lotId = lot?.id ?? null;
  useEffect(() => {
    if (!lot) return;
    setSlots(lot.slots.map((s) => ({ ...s })));
    setGates(lot.gates.map((g) => ({ ...g })));
    setSelectedCode(null);
    setMovingCode(null);
    setMessage('');
    setError('');
    // `lot` cố tình không nằm trong deps — xem chú thích trên.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotId]);

  // ParkingFloorMap khớp ô theo `code`; ở designMode chỉ cần biết ô nào tồn tại
  // và toạ độ kéo thả (null = để sơ đồ tự xếp theo lưới mẫu).
  const mapSlots: MapSlot[] = useMemo(
    () => slots.map((s) => ({
      id: s.code,
      code: s.code,
      status: 'Available' as MapSlot['status'],
      x: s.x ?? null,
      y: s.y ?? null,
      w: s.w ?? null,
      h: s.h ?? null,
    })),
    [slots],
  );
  const mapGates: MapGate[] = useMemo(
    () => gates.map((g) => ({ kind: g.kind, label: g.label, position: g.position })),
    [gates],
  );

  if (!lot) return null;

  const selected = selectedCode ? slots.find((s) => s.code === selectedCode) : null;

  // Ô nhập "mã ô" bám theo ô đang chọn — người dùng sửa xong mới ghi vào state
  // (onBlur/Enter), nên không gõ được nửa chừng là mã đã đổi.
  useEffect(() => { setCodeDraft(selectedCode ?? ''); }, [selectedCode]);

  const hasSlot = (code: string) => slots.some((s) => s.code === code);

  /**
   * Bấm một ô trên sơ đồ. Ba ngữ cảnh:
   *  - đang đổi vị trí → ô trống được chọn làm đích, dời ô đang giữ tới đó
   *  - ô chưa có       → thêm ngay (thao tác hay dùng nhất, giữ 1 chạm)
   *  - ô đã có         → chỉ chọn; xóa/đổi chỗ làm bằng nút để tránh bấm nhầm
   *                      mất ô đỗ.
   */
  const handleCellClick = (code: string) => {
    setMessage('');
    setError('');

    if (movingCode) {
      if (code === movingCode) { setMovingCode(null); return; }
      if (hasSlot(code)) {
        setError(`Vị trí ${code} đã có ô đỗ. Chọn một vị trí còn trống.`);
        return;
      }
      setSlots((prev) => prev.map((s) => (s.code === movingCode ? { ...s, code } : s)));
      setSelectedCode(code);
      setMovingCode(null);
      setMessage(`Đã chuyển ô ${movingCode} sang vị trí ${code}.`);
      return;
    }

    if (!hasSlot(code)) {
      setSlots((prev) => [...prev, { code, vehicleType: ROW_VEHICLE[code[0]] ?? 'car' }]);
    }
    setSelectedCode(code);
  };

  const handleAddSlot = (code: string) => {
    if (hasSlot(code)) return;
    setSlots((prev) => [...prev, { code, vehicleType: ROW_VEHICLE[code[0]] ?? 'car' }]);
    setMessage('');
    setError('');
  };

  /** Kéo thả: ghi toạ độ mới cho ô (hệ toạ độ SVG của sơ đồ). */
  const handleMoveSlot = (code: string, x: number, y: number) => {
    setSlots((prev) => prev.map((s) => (s.code === code ? { ...s, x, y } : s)));
  };

  /** Kéo dãn: ghi kích thước mới cho ô. */
  const handleResizeSlot = (code: string, w: number, h: number) => {
    setSlots((prev) => prev.map((s) => (s.code === code ? { ...s, w, h } : s)));
  };

  /** Đưa ô về đúng vị trí VÀ kích thước mặc định của lưới mẫu. */
  const handleResetPosition = (code: string) => {
    setSlots((prev) => prev.map((s) => (s.code === code ? { ...s, x: null, y: null, w: null, h: null } : s)));
    setMessage(`Đã đưa ô ${code} về vị trí và kích thước mặc định.`);
  };

  /** Thêm ô mã tùy ý; đặt giữa bãi để Admin kéo tới chỗ mong muốn. */
  const handleCreateCustomSlot = () => {
    const code = newCode.trim().toUpperCase();
    setMessage('');
    if (!/^[A-Z0-9]{1,10}$/.test(code)) {
      setError('Mã ô chỉ gồm chữ và số, tối đa 10 ký tự (ví dụ: A12, VIP1, EV01).');
      return;
    }
    if (hasSlot(code)) {
      setError(`Mã ô "${code}" đã tồn tại trong bãi này.`);
      return;
    }
    setError('');
    // Rải so le quanh giữa bãi để nhiều ô mới không chồng khít lên nhau.
    const n = slots.filter((s) => typeof s.x === 'number').length;
    setSlots((prev) => [...prev, {
      code,
      vehicleType: newVehicleType,
      x: 360 + (n % 5) * 62,
      y: 250 + Math.floor(n / 5) * 50,
    }]);
    setSelectedCode(code);
    setNewCode('');
    setMessage(`Đã thêm ô ${code}. Kéo ô trên sơ đồ để đặt vào vị trí mong muốn.`);
  };

  /** Đổi mã của ô đang chọn (giữ nguyên loại xe và vị trí). */
  const handleRenameSlot = (nextRaw: string) => {
    const next = nextRaw.trim().toUpperCase();
    if (!selectedCode || next === selectedCode) return;
    if (!/^[A-Z0-9]{1,10}$/.test(next)) {
      setError('Mã ô chỉ gồm chữ và số, tối đa 10 ký tự.');
      return;
    }
    if (hasSlot(next)) {
      setError(`Mã ô "${next}" đã tồn tại trong bãi này.`);
      return;
    }
    setError('');
    setSlots((prev) => prev.map((s) => (s.code === selectedCode ? { ...s, code: next } : s)));
    setSelectedCode(next);
    setMessage(`Đã đổi mã ô thành ${next}.`);
  };

  const handleRemoveSlot = (code: string) => {
    setSlots((prev) => prev.filter((s) => s.code !== code));
    setMovingCode(null);
    setMessage('');
    setError('');
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
          {movingCode && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs font-semibold text-amber-800">
                Đang chuyển ô <span className="font-mono font-black">{movingCode}</span> — bấm một ô trống (viền cam) để đặt vào đó.
              </p>
              <button
                onClick={() => setMovingCode(null)}
                className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
              >
                Hủy
              </button>
            </div>
          )}
          <ParkingFloorMap
            slots={mapSlots}
            gates={mapGates}
            designMode
            onToggleSlot={handleCellClick}
            onMoveSlot={handleMoveSlot}
            onResizeSlot={handleResizeSlot}
            selectedId={movingCode ?? selectedCode}
            highlightEmpty={!!movingCode}
            level={1}
          />
          <p className="mt-2 text-[11px] text-slate-400">
            Mẹo: kéo thân ô để di chuyển. Chọn một ô rồi kéo <span className="font-bold text-blue-600">nút vuông ở góc dưới-phải</span> để phóng to / thu nhỏ ô đó.
          </p>
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Thêm ô đỗ mới</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Đặt mã bất kỳ (chữ + số), chọn loại xe, rồi kéo ô tới vị trí mong muốn.
            </p>
            <div className="mt-2 space-y-2">
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCustomSlot(); } }}
                placeholder="Mã ô, ví dụ: VIP1"
                maxLength={10}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs uppercase text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <select
                value={newVehicleType}
                onChange={(e) => setNewVehicleType(e.target.value as VehicleKey)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >
                {(Object.keys(VEHICLE_LABEL) as VehicleKey[]).map((t) => (
                  <option key={t} value={t}>{VEHICLE_LABEL[t]}</option>
                ))}
              </select>
              <button
                onClick={handleCreateCustomSlot}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm ô đỗ
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Ô đang chọn</h3>
            {!selectedCode ? (
              <p className="mt-2 text-xs text-slate-400">
                Bấm một ô trên sơ đồ. Ô trống sẽ được thêm ngay; ô đã có thì chọn để sửa loại xe, đổi vị trí hoặc xóa.
              </p>
            ) : selected ? (
              <div className="mt-2 space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Mã ô đỗ</label>
                <input
                  value={codeDraft}
                  onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
                  onBlur={() => handleRenameSlot(codeDraft)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleRenameSlot(codeDraft); }
                    if (e.key === 'Escape') setCodeDraft(selected.code);
                  }}
                  maxLength={10}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm font-black uppercase text-slate-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
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
                  onClick={() => setMovingCode(movingCode === selected.code ? null : selected.code)}
                  className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${
                    movingCode === selected.code
                      ? 'bg-amber-500 text-white hover:bg-amber-400'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <Move className="h-3.5 w-3.5" />
                  {movingCode === selected.code ? 'Đang chọn vị trí mới...' : 'Đổi vị trí ô này'}
                </button>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Kích thước ô (rộng × cao)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={24}
                    max={300}
                    value={Math.round(selected.w ?? DEFAULT_SLOT_SIZE.w)}
                    onChange={(e) => handleResizeSlot(selected.code, Number(e.target.value), selected.h ?? DEFAULT_SLOT_SIZE.h)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-400">×</span>
                  <input
                    type="number"
                    min={20}
                    max={240}
                    value={Math.round(selected.h ?? DEFAULT_SLOT_SIZE.h)}
                    onChange={(e) => handleResizeSlot(selected.code, selected.w ?? DEFAULT_SLOT_SIZE.w, Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                {(typeof selected.x === 'number' || typeof selected.w === 'number') && (
                  <button
                    onClick={() => handleResetPosition(selected.code)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Về vị trí & cỡ mặc định
                  </button>
                )}
                <button
                  onClick={() => handleRemoveSlot(selected.code)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa ô này khỏi bãi
                </button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="font-mono text-sm font-black text-slate-900">{selectedCode}</p>
                <p className="text-[11px] text-slate-500">Vị trí này chưa có ô đỗ.</p>
                <button
                  onClick={() => handleAddSlot(selectedCode)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm ô đỗ tại đây
                </button>
              </div>
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
