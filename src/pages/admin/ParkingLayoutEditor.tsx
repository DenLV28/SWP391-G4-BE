import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, RotateCcw, RotateCw, Save, Trash2 } from 'lucide-react';
import {
  type AdminParkingLot,
  type AdminParkingSlot,
  type AdminSlotStatus,
  type AdminVehicleType,
  createAdminParkingSlot,
  deleteAdminParkingSlot,
  fetchAdminParkingSlots,
  saveAdminParkingLayout,
  updateAdminParkingSlot,
} from '../../services/adminParkingLotService';

const VEHICLE_LABEL: Record<AdminVehicleType, string> = {
  car: 'Ô tô',
  motorbike: 'Xe máy',
  bicycle: 'Xe đạp',
};

const STATUS_COLOR: Record<AdminSlotStatus, { fill: string; border: string; text: string }> = {
  Available: { fill: '#ffffff', border: '#3b82f6', text: '#1d4ed8' },
  Occupied: { fill: '#ecfdf5', border: '#10b981', text: '#047857' },
  Maintenance: { fill: '#fef2f2', border: '#ef4444', text: '#b91c1c' },
};

const CANVAS_W = 1400;
const CANVAS_H = 800;

type DragState = { id: number; startX: number; startY: number; slotX: number; slotY: number };

export default function ParkingLayoutEditor({
  lot,
  setView,
}: {
  lot: AdminParkingLot | null;
  setView: (view: string) => void;
}) {
  const [slots, setSlots] = useState<AdminParkingSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [panelError, setPanelError] = useState('');
  const dragState = useRef<DragState | null>(null);

  useEffect(() => {
    if (!lot) {
      setView('parkinglotmanagement');
      return;
    }
    (async () => {
      setLoading(true);
      const data = await fetchAdminParkingSlots(lot.id);
      setSlots(data);
      setLoading(false);
    })();
  }, [lot, setView]);

  if (!lot) return null;

  const selected = slots.find((s) => s.id === selectedId) || null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, slot: AdminParkingSlot) => {
    // Capture on the slot element itself, not e.target — a press that lands on
    // the inner code/type label would otherwise capture the <span>.
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(slot.id);
    dragState.current = { id: slot.id, startX: e.clientX, startY: e.clientY, slotX: slot.x, slotY: slot.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const nextX = Math.min(Math.max(0, d.slotX + dx), CANVAS_W - 20);
    const nextY = Math.min(Math.max(0, d.slotY + dy), CANVAS_H - 20);
    setSlots((prev) => prev.map((s) => (s.id === d.id ? { ...s, x: nextX, y: nextY } : s)));
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  const handleAddSlot = async () => {
    // Both the code and the drop position are derived from what's actually in
    // the lot, not from slots.length — otherwise adding a slot after codes have
    // been renamed collides (409) and the new slot lands on top of one the
    // admin already dragged somewhere.
    const usedCodes = new Set(slots.map((s) => s.code));
    let n = 1;
    while (usedCodes.has(`A${String(n).padStart(2, '0')}`)) n += 1;
    const code = `A${String(n).padStart(2, '0')}`;

    const NEW_W = 60;
    const NEW_H = 40;
    const overlaps = (x: number, y: number) =>
      slots.some((s) => x < s.x + s.width && x + NEW_W > s.x && y < s.y + s.height && y + NEW_H > s.y);
    let pos = { x: 40, y: 40 };
    outer: for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 14; col += 1) {
        const x = 40 + col * 90;
        const y = 40 + row * 70;
        if (x + NEW_W <= CANVAS_W && y + NEW_H <= CANVAS_H && !overlaps(x, y)) {
          pos = { x, y };
          break outer;
        }
      }
    }

    const result = await createAdminParkingSlot({
      lotId: lot.id,
      code,
      vehicleType: 'car',
      status: 'Available',
      x: pos.x,
      y: pos.y,
      rotation: 0,
      width: NEW_W,
      height: NEW_H,
    });
    if (!result.ok || !result.slot) {
      setPanelError(result.error || 'Không thể tạo ô đỗ.');
    } else {
      const created = result.slot;
      setSlots((prev) => [...prev, created]);
      setSelectedId(created.id);
    }
  };

  const handleDeleteSlot = async (id: number) => {
    await deleteAdminParkingSlot(id);
    setSlots((prev) => prev.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const patchSelected = (patch: Partial<AdminParkingSlot>) => {
    if (!selectedId) return;
    setSlots((prev) => prev.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)));
  };

  const handleSaveSlotDetails = async () => {
    if (!selected) return;
    setPanelError('');
    const result = await updateAdminParkingSlot(selected.id, {
      code: selected.code,
      vehicleType: selected.vehicleType,
      status: selected.status,
      width: selected.width,
      height: selected.height,
      rotation: selected.rotation,
    });
    if (!result.ok || !result.slot) {
      setPanelError(result.error || 'Không thể cập nhật ô đỗ.');
      return;
    }
    const updated = result.slot;
    setSlots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    setSaveMessage('');
    const result = await saveAdminParkingLayout(
      lot.id,
      slots.map((s) => ({ slotId: s.id, x: s.x, y: s.y, rotation: s.rotation })),
    );
    setSaving(false);
    setSaveMessage(result.ok ? 'Đã lưu sơ đồ.' : result.error || 'Không thể lưu sơ đồ.');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => setView('parkinglotmanagement')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại danh sách bãi đỗ
          </button>
          <h2 className="mt-1 text-lg font-bold text-slate-800">Sơ đồ bãi đỗ: {lot.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddSlot}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" /> Thêm ô đỗ
          </button>
          <button
            onClick={handleSaveLayout}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? 'Đang lưu...' : 'Lưu sơ đồ'}
          </button>
        </div>
      </div>

      {saveMessage && <p className="text-xs font-semibold text-emerald-600">{saveMessage}</p>}

      <div className="flex gap-4">
        <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-slate-50" style={{ maxHeight: 640 }}>
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Đang tải sơ đồ...</div>
          ) : (
            <div
              className="relative"
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                backgroundImage: lot.imageData ? `url(${lot.imageData})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              onClick={() => setSelectedId(null)}
            >
              {lot.imageData && <div className="absolute inset-0 bg-white/70" />}
              {slots.map((slot) => {
                const c = STATUS_COLOR[slot.status];
                const isSelected = slot.id === selectedId;
                return (
                  <div
                    key={slot.id}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handlePointerDown(e, slot);
                    }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    // The canvas's onClick clears the selection — without this a
                    // click on a slot would select it on pointerdown, then bubble
                    // up and immediately deselect it again.
                    onClick={(e) => e.stopPropagation()}
                    className="absolute flex cursor-grab select-none flex-col items-center justify-center rounded-lg border-2 text-[10px] font-bold shadow-sm active:cursor-grabbing"
                    style={{
                      left: slot.x,
                      top: slot.y,
                      width: slot.width,
                      height: slot.height,
                      transform: `rotate(${slot.rotation}deg)`,
                      background: c.fill,
                      borderColor: isSelected ? '#4f46e5' : c.border,
                      color: c.text,
                      boxShadow: isSelected ? '0 0 0 2px #4f46e5' : undefined,
                    }}
                  >
                    <span>{slot.code}</span>
                    <span className="text-[8px] font-semibold opacity-70">{VEHICLE_LABEL[slot.vehicleType]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-72 shrink-0 space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Chi tiết ô đỗ</h3>
          {!selected ? (
            <p className="text-xs text-slate-400">Chọn một ô đỗ trên sơ đồ để xem và chỉnh sửa.</p>
          ) : (
            <div className="space-y-3">
              {panelError && <p className="text-[11px] font-semibold text-rose-500">{panelError}</p>}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase text-slate-400">Mã ô đỗ</label>
                <input
                  value={selected.code}
                  onChange={(e) => patchSelected({ code: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase text-slate-400">Loại phương tiện</label>
                <select
                  value={selected.vehicleType}
                  onChange={(e) => patchSelected({ vehicleType: e.target.value as AdminVehicleType })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none"
                >
                  <option value="car">Ô tô</option>
                  <option value="motorbike">Xe máy</option>
                  <option value="bicycle">Xe đạp</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase text-slate-400">Trạng thái</label>
                <select
                  value={selected.status}
                  onChange={(e) => patchSelected({ status: e.target.value as AdminSlotStatus })}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none"
                >
                  <option value="Available">Trống</option>
                  <option value="Occupied">Đang đỗ</option>
                  <option value="Maintenance">Bảo trì</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase text-slate-400">Rộng</label>
                  <input
                    type="number"
                    value={selected.width}
                    onChange={(e) => patchSelected({ width: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase text-slate-400">Cao</label>
                  <input
                    type="number"
                    value={selected.height}
                    onChange={(e) => patchSelected({ height: Number(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase text-slate-400">Xoay ({selected.rotation}°)</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => patchSelected({ rotation: (selected.rotation - 15 + 360) % 360 })}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs hover:bg-slate-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> -15°
                  </button>
                  <button
                    onClick={() => patchSelected({ rotation: (selected.rotation + 15) % 360 })}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs hover:bg-slate-50"
                  >
                    <RotateCw className="h-3.5 w-3.5" /> +15°
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveSlotDetails}
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                >
                  Lưu thông tin ô
                </button>
                <button
                  onClick={() => handleDeleteSlot(selected.id)}
                  className="rounded-lg border border-rose-200 p-2 text-rose-500 hover:bg-rose-50"
                  title="Xóa ô đỗ"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
