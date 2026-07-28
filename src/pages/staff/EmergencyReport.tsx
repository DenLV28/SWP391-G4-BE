import React, { useState } from 'react';
import {
  Send, Car, AlertTriangle,
  Wrench, Upload, Bike, LayoutList,
} from 'lucide-react';
import type { Slot, SlotIssue, IssueType, User } from '../../data/mockData';
import ParkingFloorMap, { type MapSlot } from '../../components/ParkingFloorMap';

// ── Issue configs ────────────────────────────────────────────────────────────

const ISSUE_TYPES: IssueType[] = [
  'Charging Station Failure',
  'Parking Sensor Failure',
  'Parking Slot Damaged',
  'Vehicle Parked Incorrectly',
  'Other',
];

const ISSUE_TYPE_VI: Record<string, string> = {
  'Charging Station Failure':   'Lỗi trạm sạc',
  'Parking Sensor Failure':     'Lỗi cảm biến ô đỗ',
  'Parking Slot Damaged':       'Ô đỗ bị hỏng',
  'Vehicle Parked Incorrectly': 'Xe đỗ sai vị trí',
  'Other':                      'Khác',
};

const STATUS_VI: Record<string, string> = {
  Available:   'Trống',
  Occupied:    'Đang đỗ',
  Reserved:    'Đã đặt',
  Pending:     'Chờ duyệt',
  Maintenance: 'Bảo trì',
  Locked:      'Đã khóa',
};

// ── Component ────────────────────────────────────────────────────────────────

interface EmergencyReportProps {
  slots?: Slot[];
  currentUser?: User;
  addToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onCreateIssue?: (issue: Omit<SlotIssue, 'id' | 'reportedAt' | 'status'>) => Promise<void>;
  onForceClearSlot?: (slotCode: string, reason: string) => Promise<boolean>;
  onSetSlotStatus?: (slotCode: string, status: Slot['status']) => Promise<boolean>;
}

export default function EmergencyReport({
  slots = [],
  currentUser,
  addToast,
  onCreateIssue,
}: EmergencyReportProps) {
  // ── Slot issue form state
  const [issueVehicleType, setIssueVehicleType] = useState<'car' | 'motorbike' | 'all'>('all');
  const [issueSlotCode,    setIssueSlotCode]    = useState('');
  const [issueType,        setIssueType]        = useState<IssueType>('Parking Sensor Failure');
  const [issueDesc,        setIssueDesc]        = useState('');
  const [issueImage,       setIssueImage]       = useState('');
  const [issueSubmitting,  setIssueSubmitting]  = useState(false);

  // Convert Slot[] → MapSlot[] for the ParkingFloorMap
  // code must be just the slot label (e.g. "A01"), not the full "Khu A-A01" path
  const mapSlotData: MapSlot[] = slots.map((s) => ({
    id: s.slotCode,
    code: s.slotCode.split('-').pop() ?? s.slotCode,
    status: s.status as MapSlot['status'],
  }));

  // Strip the "virtual-" prefix that ParkingFloorMap adds for unmatched spaces
  const cleanIssueSlotCode = issueSlotCode.startsWith('virtual-')
    ? issueSlotCode.slice('virtual-'.length)
    : issueSlotCode;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setIssueImage(ev.target?.result as string ?? '');
    reader.readAsDataURL(file);
  };

  const handleSubmitIssue = async () => {
    if (!cleanIssueSlotCode) { addToast?.('Vui lòng chọn ô đỗ.', 'error'); return; }
    setIssueSubmitting(true);
    try {
      await onCreateIssue?.({
        slotCode: cleanIssueSlotCode,
        issueType,
        description: issueDesc,
        imageUrl: issueImage,
        reportedBy: currentUser?.fullName ?? 'Nhân viên',
      });
      addToast?.(`Đã gửi báo cáo sự cố ô ${cleanIssueSlotCode} tới Quản lý.`, 'success');
      setIssueSlotCode(''); setIssueDesc(''); setIssueImage('');
      setIssueType('Parking Sensor Failure');
    } catch {
      addToast?.('Không thể gửi báo cáo. Vui lòng thử lại.', 'error');
    } finally {
      setIssueSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Báo cáo Sự cố Ô đỗ</h1>
        <p className="mt-1 text-sm text-slate-500">
          Báo cáo sự cố ô đỗ xe — thông tin được gửi ngay tới quản lý.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Form */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100">
              <Wrench className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900">Báo cáo Sự cố Ô đỗ</p>
              <p className="text-xs text-slate-400">Bấm vào ô đỗ trên sơ đồ để chọn vị trí cần báo cáo</p>
            </div>
          </div>

          {/* Vehicle type toggle */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">Lọc theo khu vực</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setIssueVehicleType('all'); setIssueSlotCode(''); }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  issueVehicleType === 'all'
                    ? 'bg-slate-700 border-slate-700 text-white shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:border-slate-400'
                }`}
              >
                <LayoutList className="h-4 w-4" /> Tất cả
              </button>
              <button
                type="button"
                onClick={() => { setIssueVehicleType('car'); setIssueSlotCode(''); }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  issueVehicleType === 'car'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300'
                }`}
              >
                <Car className="h-4 w-4" /> Ô tô
              </button>
              <button
                type="button"
                onClick={() => { setIssueVehicleType('motorbike'); setIssueSlotCode(''); }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  issueVehicleType === 'motorbike'
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300'
                }`}
              >
                <Bike className="h-4 w-4" /> Xe máy
              </button>
            </div>
          </div>

          {/* 2D Parking Map */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-600">
                Sơ đồ bãi đỗ —{' '}
                {issueVehicleType === 'all' ? 'Toàn bộ bãi đỗ' : issueVehicleType === 'car' ? 'Khu Ô tô (A, D)' : 'Khu Xe máy (B, E)'}
                <span className="ml-2 font-normal text-slate-400">Bấm vào ô cần báo cáo</span>
              </p>
              {cleanIssueSlotCode && (
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                  Đã chọn: {cleanIssueSlotCode} — {STATUS_VI[slots.find(s => s.slotCode.split('-').pop() === cleanIssueSlotCode)?.status ?? ''] ?? ''}
                </span>
              )}
            </div>
            <ParkingFloorMap
              slots={mapSlotData}
              selectedId={issueSlotCode || null}
              onSelect={(id) => setIssueSlotCode(id)}
              interactive={true}
              issueMode={true}
              areaMode={issueVehicleType === 'all' ? undefined : issueVehicleType === 'motorbike' ? 'motorbike' : 'car'}
            />
            {!cleanIssueSlotCode && (
              <p className="mt-2 text-xs text-amber-600 font-medium">
                ↑ Bấm vào ô đỗ trên sơ đồ để chọn vị trí sự cố
              </p>
            )}
          </div>

          {/* Issue type */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Loại sự cố <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ISSUE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setIssueType(t)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold text-left transition ${
                    issueType === t
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50/40'
                  }`}
                >
                  {ISSUE_TYPE_VI[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Mô tả chi tiết</label>
            <textarea
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              rows={3}
              placeholder="Mô tả cụ thể sự cố đang xảy ra tại ô đỗ..."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-orange-400 focus:outline-none resize-none"
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Ảnh đính kèm <span className="text-slate-400">(tùy chọn)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 hover:border-orange-400 hover:bg-orange-50/40 transition">
              <Upload className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-500">
                {issueImage ? 'Đã chọn ảnh ✓ — click để đổi' : 'Chọn ảnh từ thiết bị'}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
            {issueImage && (
              <img src={issueImage} alt="Xem trước" className="mt-3 max-h-32 rounded-xl border border-slate-200 object-cover" />
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={handleSubmitIssue}
              disabled={issueSubmitting || !cleanIssueSlotCode}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <Send className="h-4 w-4" />
              {issueSubmitting ? 'Đang gửi…' : 'Gửi báo cáo'}
            </button>
            <button
              onClick={() => { setIssueSlotCode(''); setIssueDesc(''); setIssueImage(''); }}
              className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition"
            >
              Xóa biểu mẫu
            </button>
          </div>
        </div>

        {/* Side info */}
        <div className="space-y-4">
          {/* Workflow card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Quy trình xử lý</h3>
            <div className="space-y-3">
              {[
                { num: '1', color: 'bg-orange-500', label: 'Nhân viên gửi báo cáo', sub: 'Ô đỗ chuyển sang trạng thái Chờ duyệt' },
                { num: '2', color: 'bg-blue-500', label: 'Quản lý nhận thông báo', sub: 'Popup hiển thị ngay lập tức' },
                { num: '3', color: 'bg-red-500', label: 'Quản lý Duyệt', sub: 'Ô đỗ chuyển sang Bảo trì (đỏ)' },
                { num: '3', color: 'bg-slate-400', label: 'Quản lý Từ chối', sub: 'Ô đỗ về trạng thái Trống' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${step.color} text-[10px] font-bold text-white`}>
                    {step.num}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{step.label}</p>
                    <p className="text-[11px] text-slate-400">{step.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Issue type reference */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Loại sự cố</h3>
            <div className="space-y-2">
              {ISSUE_TYPES.map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                  <span className="text-xs text-slate-600">{ISSUE_TYPE_VI[t]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Chỉ báo cáo sự cố thực sự. Báo cáo sai sẽ ảnh hưởng đến hoạt động bãi đỗ.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
