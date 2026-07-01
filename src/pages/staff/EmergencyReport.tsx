import React, { useState } from 'react';
import {
  Send, Flame, Car, Server, ShieldAlert, HeartPulse, AlertTriangle,
  Wrench, Upload, Bike, MessageSquare, ChevronDown, ChevronUp, Clock,
  CheckCircle, XCircle, Loader, LayoutList, X,
} from 'lucide-react';
import type { EmergencyLog, IncidentType, EmergencyStatus } from '../../types/staff';
import { incidentTypes } from '../../types/staff';
import type { Slot, SlotIssue, IssueType, User, Feedback } from '../../data/mockData';
import ParkingFloorMap, { type MapSlot } from '../../components/ParkingFloorMap';

// ── Emergency configs ────────────────────────────────────────────────────────

const statusPill: Record<EmergencyStatus, { label: string; cls: string }> = {
  NEW:      { label: 'MỚI',     cls: 'bg-amber-500   text-white'     },
  LOGGED:   { label: 'ĐÃ GHI',  cls: 'bg-slate-200   text-slate-700' },
  RESOLVED: { label: 'ĐÃ XỬ',   cls: 'bg-rose-600    text-white'     },
  FIXED:    { label: 'ĐÃ SỬA',  cls: 'bg-emerald-600 text-white'     },
};

const typeLabel: Record<IncidentType, string> = {
  'Fire / Smoke':       'Hỏa hoạn / Khói',
  'Vehicle Collision':  'Va chạm xe cộ',
  'Security Breach':    'Vi phạm an ninh',
  'Equipment Failure':  'Thiết bị hỏng hóc',
  'Medical Emergency':  'Cấp cứu y tế',
  'Other':              'Khác',
};

const typeIcon: Record<string, { icon: React.ElementType; wrap: string }> = {
  'Fire / Smoke':      { icon: Flame,        wrap: 'bg-rose-50    text-rose-600'    },
  'Vehicle Collision': { icon: Car,          wrap: 'bg-blue-50    text-blue-600'    },
  'Equipment Failure': { icon: Server,       wrap: 'bg-violet-50  text-violet-600'  },
  'Security Breach':   { icon: ShieldAlert,  wrap: 'bg-slate-100  text-slate-600'   },
  'Medical Emergency': { icon: HeartPulse,   wrap: 'bg-emerald-50 text-emerald-600' },
  'Other':             { icon: AlertTriangle, wrap: 'bg-amber-50  text-amber-600'   },
};

const SLOT_COLORS: Record<string, string> = {
  available: 'bg-slate-100   hover:bg-slate-200',
  occupied:  'bg-blue-400    text-white',
  reserved:  'bg-amber-300   text-white',
  broken:    'bg-rose-400    text-white',
  exit:      'bg-green-400   text-white',
};

const SLOT_LEGEND = [
  { label: 'Trống',     cls: 'bg-slate-200' },
  { label: 'Đã đỗ',    cls: 'bg-blue-400'  },
  { label: 'Giữ chỗ',  cls: 'bg-amber-300' },
  { label: 'Hỏng hóc', cls: 'bg-rose-400'  },
  { label: 'Sơ thoát', cls: 'bg-green-400' },
];

type FloorTab = 'G' | '1' | '2';
const buildSlots = (floor: FloorTab) =>
  ['A', 'B'].flatMap((row) =>
    Array.from({ length: 9 }, (_, i) => {
      const id = `${row}${i}`;
      let type: keyof typeof SLOT_COLORS = 'available';
      if (floor === 'G' && id === 'A6') type = 'broken';
      else if (['A1','A2','A4','B0','B2','B3'].includes(id)) type = 'occupied';
      else if (['A3','B5'].includes(id)) type = 'reserved';
      else if (['A8','B8'].includes(id)) type = 'exit';
      return { id, type };
    }),
  );

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

// ── Feedback helpers ─────────────────────────────────────────────────────────

const FB_STATUS_META: Record<Feedback['status'], { label: string; cls: string; icon: React.ElementType }> = {
  'New':         { label: 'Mới',          cls: 'bg-amber-100  text-amber-700',   icon: Clock       },
  'In Progress': { label: 'Đang xử lý',   cls: 'bg-blue-100   text-blue-700',    icon: Loader      },
  'Resolved':    { label: 'Đã giải quyết', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  'Rejected':    { label: 'Từ chối',      cls: 'bg-rose-100   text-rose-700',    icon: XCircle     },
};

const FB_PRIORITY_META: Record<Feedback['priority'], { label: string; cls: string }> = {
  'Low':    { label: 'Thấp',   cls: 'bg-slate-100 text-slate-600'  },
  'Medium': { label: 'Trung bình', cls: 'bg-amber-100 text-amber-700' },
  'High':   { label: 'Cao',    cls: 'bg-rose-100  text-rose-700'   },
};

// ── Component ────────────────────────────────────────────────────────────────

type PageTab = 'emergency' | 'slot-issue' | 'user-feedback';

interface EmergencyReportProps {
  emergencyLogs: EmergencyLog[];
  onSubmit: (type: IncidentType, description: string, slotCode?: string, floor?: string) => void;
  slots?: Slot[];
  currentUser?: User;
  addToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onCreateIssue?: (issue: Omit<SlotIssue, 'id' | 'reportedAt' | 'status'>) => Promise<void>;
  feedbacks?: Feedback[];
  onRespondFeedback?: (id: string, response: string, status: Feedback['status']) => void;
}

export default function EmergencyReport({
  emergencyLogs,
  onSubmit,
  slots = [],
  currentUser,
  addToast,
  onCreateIssue,
  feedbacks = [],
  onRespondFeedback,
}: EmergencyReportProps) {
  const [pageTab, setPageTab] = useState<PageTab>('emergency');

  // ── Emergency form state
  const [eType, setEType]               = useState<IncidentType | ''>('');
  const [eDesc, setEDesc]               = useState('');
  const [floor, setFloor]               = useState<FloorTab>('G');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // ── Slot issue form state
  const [issueVehicleType, setIssueVehicleType] = useState<'car' | 'motorbike' | 'all'>('all');
  const [issueSlotCode,    setIssueSlotCode]    = useState('');
  const [issueType,        setIssueType]        = useState<IssueType>('Parking Sensor Failure');
  const [issueDesc,        setIssueDesc]        = useState('');
  const [issueImage,       setIssueImage]       = useState('');
  const [issueSubmitting,  setIssueSubmitting]  = useState(false);

  // ── User feedback state
  const [fbFilter,       setFbFilter]       = useState<'all' | Feedback['status']>('all');
  const [fbSelected,     setFbSelected]     = useState<Feedback | null>(null);
  const [fbReply,        setFbReply]        = useState('');
  const [fbNewStatus,    setFbNewStatus]    = useState<Feedback['status']>('In Progress');
  const [fbSaving,       setFbSaving]       = useState(false);

  const mapSlots = buildSlots(floor);

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

  const handleSendEmergency = () => {
    if (!eType) { addToast?.('Vui lòng chọn loại sự cố.', 'error'); return; }
    if (!eDesc.trim()) { addToast?.('Vui lòng mô tả chi tiết sự cố.', 'error'); return; }
    onSubmit(eType, eDesc.trim(), selectedSlot ?? undefined, floor);
    setEType(''); setEDesc(''); setSelectedSlot(null);
  };

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
        <h1 className="text-2xl font-bold text-slate-900">Quản lý Sự cố</h1>
        <p className="mt-1 text-sm text-slate-500">
          Báo cáo sự cố khẩn cấp hoặc sự cố ô đỗ xe — mọi thông tin được gửi ngay tới quản lý.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 w-fit">
        <button
          onClick={() => setPageTab('emergency')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
            pageTab === 'emergency'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Sự cố Khẩn cấp
        </button>
        <button
          onClick={() => setPageTab('slot-issue')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
            pageTab === 'slot-issue'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-800'
          }`}
        >
          <Wrench className="h-4 w-4" />
          Sự cố Ô đỗ
        </button>
        <button
          onClick={() => setPageTab('user-feedback')}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
            pageTab === 'user-feedback'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-white hover:text-slate-800'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Phản hồi Người dùng
          {feedbacks.filter((f) => f.status === 'New').length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-blue-600 text-[10px] font-black">
              {feedbacks.filter((f) => f.status === 'New').length}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab 1: Emergency ── */}
      {pageTab === 'emergency' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Form */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Báo cáo Sự cố Khẩn cấp</p>
                <p className="text-xs text-slate-400">Gửi ngay tới ban quản lý & an ninh</p>
              </div>
            </div>

            {/* Floor tabs */}
            <div>
              <p className="mb-2 text-xs font-bold text-slate-600">Vị trí (Tầng)</p>
              <div className="flex items-center gap-2">
                {(['G', '1', '2'] as FloorTab[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFloor(f)}
                    className={`rounded-lg px-5 py-2 text-sm font-bold border transition ${
                      floor === f
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    Tầng {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Slot grid */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600">Sơ đồ bãi đỗ (Chọn vị trí sự cố)</p>
                <div className="flex items-center gap-2">
                  {SLOT_LEGEND.map((l) => (
                    <span key={l.label} className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span className={`inline-block h-3 w-3 rounded-sm ${l.cls}`} />
                      {l.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-9 gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3">
                {mapSlots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlot(slot.id === selectedSlot ? null : slot.id)}
                    className={`flex h-8 items-center justify-center rounded text-[10px] font-bold transition
                      ${selectedSlot === slot.id ? 'ring-2 ring-rose-500 ring-offset-1' : ''}
                      ${SLOT_COLORS[slot.type]}`}
                  >
                    {slot.id}
                  </button>
                ))}
              </div>
              {selectedSlot && (
                <p className="mt-2 text-xs text-rose-600 font-semibold">
                  Vị trí đã chọn: <span className="font-bold">{selectedSlot}</span>
                </p>
              )}
            </div>

            {/* Incident type */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">Loại sự cố</label>
              <select
                value={eType}
                onChange={(e) => setEType(e.target.value as IncidentType)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="">— Chọn loại sự cố —</option>
                {incidentTypes.map((t) => (
                  <option key={t} value={t}>{typeLabel[t] ?? t}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">Mô tả chi tiết</label>
              <textarea
                value={eDesc}
                onChange={(e) => setEDesc(e.target.value)}
                placeholder="Cung cấp mô tả chi tiết về sự cố xảy ra..."
                rows={4}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleSendEmergency}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white hover:bg-rose-700 transition"
              >
                <Send className="h-4 w-4" /> Gửi cảnh báo
              </button>
              <button
                onClick={() => { setEType(''); setEDesc(''); setSelectedSlot(null); }}
                className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition"
              >
                Hủy bỏ
              </button>
            </div>
          </div>

          {/* Recent logs */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Nhật ký khẩn cấp gần đây</h3>
            </div>
            <div className="space-y-4">
              {emergencyLogs.slice(0, 5).map((log) => {
                const meta  = typeIcon[log.type] ?? typeIcon.Other;
                const Icon  = meta.icon;
                const badge = statusPill[log.status];
                return (
                  <div key={log.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.wrap}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-800 text-sm leading-snug">{log.title}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{log.createdAt}</p>
                          </div>
                          <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">{log.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {emergencyLogs.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">Chưa có sự cố khẩn cấp</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Slot Issue ── */}
      {pageTab === 'slot-issue' && (
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
      )}

      {/* ── Tab 3: User Feedback Management ── */}
      {pageTab === 'user-feedback' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Feedback list */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="font-bold text-slate-900">Danh sách phản hồi người dùng</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {feedbacks.length} phản hồi — nhấn vào để xem chi tiết và xử lý
                </p>
              </div>
              <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {(['all', 'New', 'In Progress', 'Resolved', 'Rejected'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFbFilter(s)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      fbFilter === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {s === 'all' ? 'Tất cả' : FB_STATUS_META[s]?.label}
                    {s !== 'all' && (
                      <span className="ml-1 text-[10px] text-slate-400">
                        ({feedbacks.filter((f) => f.status === s).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {feedbacks
                .filter((f) => fbFilter === 'all' || f.status === fbFilter)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((fb) => {
                  const sm = FB_STATUS_META[fb.status];
                  const pm = FB_PRIORITY_META[fb.priority];
                  const StatusIcon = sm.icon;
                  const isSelected = fbSelected?.id === fb.id;
                  return (
                    <button
                      key={fb.id}
                      type="button"
                      onClick={() => {
                        setFbSelected(fb);
                        setFbReply(fb.staffResponse ?? '');
                        setFbNewStatus(fb.status === 'New' ? 'In Progress' : fb.status);
                      }}
                      className={`w-full text-left px-5 py-4 transition ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-blue-600">{fb.feedbackCode}</span>
                            <span className="text-[11px] font-semibold text-slate-700">{fb.type}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pm.cls}`}>
                              {pm.label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">{fb.description}</p>
                          <p className="mt-1 text-[10px] text-slate-400">{fb.createdAt}</p>
                        </div>
                        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${sm.cls}`}>
                          <StatusIcon className="h-3 w-3" />
                          {sm.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              {feedbacks.filter((f) => fbFilter === 'all' || f.status === fbFilter).length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400">Không có phản hồi nào</div>
              )}
            </div>
          </div>

          {/* Detail / Reply panel */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            {fbSelected ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Chi tiết phản hồi</p>
                    <p className="font-bold text-slate-900 mt-0.5">{fbSelected.feedbackCode}</p>
                  </div>
                  <button onClick={() => setFbSelected(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'Loại', value: fbSelected.type },
                      { label: 'Mã vé', value: fbSelected.ticketCode || '—' },
                      { label: 'Ngày gửi', value: fbSelected.createdAt },
                      { label: 'Mức độ ưu tiên', value: <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${FB_PRIORITY_META[fbSelected.priority].cls}`}>{FB_PRIORITY_META[fbSelected.priority].label}</span> },
                    ].map((row) => (
                      <div key={row.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{row.label}</p>
                        <p className="mt-1 font-semibold text-slate-800">{row.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Nội dung phản hồi</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{fbSelected.description}</p>
                  </div>

                  {/* Previous staff response */}
                  {fbSelected.staffResponse && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">
                        Phản hồi trước — {fbSelected.staffRespondedAt ?? ''}
                      </p>
                      <p className="text-sm text-slate-700">{fbSelected.staffResponse}</p>
                    </div>
                  )}

                  {/* Status update */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Cập nhật trạng thái</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['In Progress', 'Resolved', 'Rejected'] as Feedback['status'][]).map((s) => {
                        const meta = FB_STATUS_META[s];
                        const Icon = meta.icon;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setFbNewStatus(s)}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                              fbNewStatus === s
                                ? `${meta.cls} border-current`
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reply textarea */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">Phản hồi / Ghi chú xử lý</label>
                    <textarea
                      value={fbReply}
                      onChange={(e) => setFbReply(e.target.value)}
                      rows={4}
                      placeholder="Nhập nội dung phản hồi hoặc ghi chú kết quả xử lý..."
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="border-t border-slate-100 p-4 flex gap-2">
                  <button
                    type="button"
                    disabled={fbSaving}
                    onClick={async () => {
                      if (!fbReply.trim()) { addToast?.('Vui lòng nhập nội dung phản hồi.', 'error'); return; }
                      setFbSaving(true);
                      try {
                        onRespondFeedback?.(fbSelected.id, fbReply.trim(), fbNewStatus);
                        addToast?.('Đã lưu phản hồi và cập nhật trạng thái.', 'success');
                        setFbSelected(null);
                      } finally {
                        setFbSaving(false);
                      }
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-60 transition"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {fbSaving ? 'Đang lưu…' : 'Lưu phản hồi & Cập nhật'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFbSelected(null)}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 gap-3 p-8 text-center">
                <MessageSquare className="h-10 w-10 text-slate-200" />
                <p className="text-sm font-semibold">Chọn một phản hồi từ danh sách để xem chi tiết và xử lý</p>
                <p className="text-xs">Bạn có thể cập nhật trạng thái, phản hồi người dùng và ghi chú kết quả xử lý.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
