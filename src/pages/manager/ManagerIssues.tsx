import { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Image } from 'lucide-react';
import type { SlotIssue } from '../../data/mockData';

const ISSUE_TYPE_LABELS: Record<string, string> = {
  'Charging Station Failure':   'Lỗi trạm sạc',
  'Parking Sensor Failure':     'Lỗi cảm biến ô đỗ',
  'Parking Slot Damaged':       'Ô đỗ bị hỏng',
  'Vehicle Parked Incorrectly': 'Xe đỗ sai vị trí',
  'Other':                      'Khác',
  // backward compat
  'Charging Failure': 'Lỗi sạc',
  'Sensor Failure':   'Lỗi cảm biến',
  'Occupied Error':   'Lỗi trạng thái ô',
};

const STATUS_CONFIG = {
  Pending:  { label: 'Chờ duyệt',  bg: 'bg-amber-50',   text: 'text-amber-700',  icon: Clock },
  Approved: { label: 'Đã duyệt',   bg: 'bg-red-50',     text: 'text-red-700',    icon: CheckCircle },
  Rejected: { label: 'Đã từ chối', bg: 'bg-slate-100',  text: 'text-slate-500',  icon: XCircle },
};

interface Props {
  issues: SlotIssue[];
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
}

export default function ManagerIssues({ issues, onApprove, onReject }: Props) {
  const [filter, setFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter === 'all' ? issues : issues.filter((i) => i.status === filter);

  const pendingCount = issues.filter((i) => i.status === 'Pending').length;

  return (
    <div className="space-y-5">
      {/* Header + filter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Quản lý Sự cố Ô đỗ</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Xem xét và xử lý các báo cáo sự cố từ nhân viên
          </p>
        </div>
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-700">
            {pendingCount} chờ duyệt
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'Pending', 'Approved', 'Rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              filter === f
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
            }`}
          >
            {f === 'all' ? 'Tất cả' : STATUS_CONFIG[f].label}
            {f !== 'all' && (
              <span className="ml-2 rounded-full bg-white/20 px-1.5 text-xs">
                {issues.filter((i) => i.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Issue list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-slate-400 font-medium">Không có sự cố nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => {
            const cfg = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG.Pending;
            const StatusIcon = cfg.icon;
            const isExpanded = expandedId === issue.id;

            return (
              <div
                key={issue.id}
                className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden"
              >
                {/* Row summary */}
                <div
                  className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50/60 transition"
                  onClick={() => setExpandedId(isExpanded ? null : issue.id)}
                >
                  {/* Status icon */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                    <StatusIcon className={`h-5 w-5 ${cfg.text}`} />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-800 text-sm">{issue.slotCode}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                        {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {issue.reportedBy} · {issue.reportedAt}
                    </p>
                  </div>

                  {/* Actions (only for Pending) */}
                  {issue.status === 'Pending' && (
                    <div
                      className="flex gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onReject(issue.id)}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                      >
                        Từ chối
                      </button>
                      <button
                        onClick={() => onApprove(issue.id)}
                        className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
                      >
                        Duyệt — Bảo trì
                      </button>
                    </div>
                  )}

                  {/* Expand toggle */}
                  <div className="shrink-0 text-slate-400">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-50 px-6 py-4 bg-slate-50/40 space-y-3">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Ô đỗ</span>
                        <span className="font-mono font-bold text-slate-800">{issue.slotCode}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Loại sự cố</span>
                        <span className="text-slate-700">{ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Nhân viên báo cáo</span>
                        <span className="text-slate-700">{issue.reportedBy || '—'}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block">Thời gian báo cáo</span>
                        <span className="text-slate-700">{issue.reportedAt}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-xs text-slate-400 font-semibold block mb-1">Mô tả</span>
                        <p className="text-slate-700 text-sm leading-relaxed">
                          {issue.description || 'Không có mô tả.'}
                        </p>
                      </div>
                    </div>

                    {/* Image */}
                    {issue.imageUrl ? (
                      <div>
                        <span className="text-xs text-slate-400 font-semibold block mb-2">Ảnh đính kèm</span>
                        <img
                          src={issue.imageUrl}
                          alt="Ảnh sự cố"
                          className="max-h-48 rounded-xl border border-slate-200 object-contain bg-white"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Image className="h-4 w-4" />
                        Không có ảnh đính kèm
                      </div>
                    )}

                    {/* Bottom actions for Pending */}
                    {issue.status === 'Pending' && (
                      <div className="flex gap-3 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => onReject(issue.id)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
                        >
                          <XCircle className="h-4 w-4" />
                          Từ chối — Ô đỗ về Available
                        </button>
                        <button
                          onClick={() => onApprove(issue.id)}
                          className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Duyệt — Đặt ô đỗ thành Bảo trì
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
