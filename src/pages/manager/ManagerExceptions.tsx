import { useMemo, useState } from 'react';
import {
  Wrench, Clock3, CheckCircle2,
  ChevronDown, Search, Info, X, Image as ImageIcon,
  Flame, AlertTriangle, MapPin,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { EmergencyLog } from '../../types/staff';
import type { SlotIssue } from '../../data/mockData';
import { ISSUE_TYPE_LABELS, STATUS_CONFIG } from './ManagerIssues';

interface ManagerExceptionsProps {
  setView: (view: string) => void;
  emergencyLogs?: EmergencyLog[];
  /** Sự cố ô đỗ thật do nhân viên báo cáo — nguồn dữ liệu chính của trang này. */
  issues?: SlotIssue[];
  // 3 hành động này dùng LẠI ĐÚNG luồng nghiệp vụ đã có ở trang Sự cố Ô đỗ
  // (ManagerIssues) — không nhân bản logic, chỉ hiện lại ở đây cho tiện thao
  // tác ngay trong modal Chi tiết của Xử lý Ngoại lệ.
  /** Chờ duyệt → Approved ("Đang bảo trì"), đặt ô đỗ vào trạng thái Bảo trì. */
  onApproveIssue?: (id: string) => void;
  /** Chờ duyệt → Rejected (từ chối báo cáo, ô đỗ giữ nguyên). */
  onRejectIssue?: (id: string) => void;
  /** Approved → Resolved, trả ô đỗ về Available (hoàn thành bảo trì). */
  onRestoreIssue?: (id: string) => void;
}

const EMERGENCY_STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  NEW:      { badge: 'bg-rose-100 text-rose-700 border border-rose-200',       label: 'MỚI'       },
  LOGGED:   { badge: 'bg-amber-100 text-amber-700 border border-amber-200',    label: 'ĐÃ GHI'    },
  RESOLVED: { badge: 'bg-slate-100 text-slate-600 border border-slate-200',    label: 'ĐÃ XỬ'     },
  FIXED:    { badge: 'bg-green-100 text-green-700 border border-green-200',    label: 'ĐÃ SỬA'    },
};

const PAGE_SIZE = 8;

type StatusFilter = 'all' | keyof typeof STATUS_CONFIG;

export default function ManagerExceptions({
  setView: _setView,
  emergencyLogs = [],
  issues = [],
  onApproveIssue,
  onRejectIssue,
  onRestoreIssue,
}: ManagerExceptionsProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [detailIssue, setDetailIssue] = useState<SlotIssue | null>(null);

  const openDetail = (issue: SlotIssue) => setDetailIssue(issue);
  const closeDetail = () => setDetailIssue(null);

  const typeOptions = useMemo(
    () => Array.from(new Set(issues.map((i) => i.issueType))),
    [issues],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues
      .filter((i) => statusFilter === 'all' || i.status === statusFilter)
      .filter((i) => typeFilter === 'all' || i.issueType === typeFilter)
      .filter((i) => {
        if (!q) return true;
        return (
          i.slotCode.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.reportedBy.toLowerCase().includes(q) ||
          (ISSUE_TYPE_LABELS[i.issueType] ?? i.issueType).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }, [issues, search, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(() => {
    const c: Record<keyof typeof STATUS_CONFIG, number> = { Pending: 0, Approved: 0, Rejected: 0, Resolved: 0 };
    issues.forEach((i) => { c[i.status] += 1; });
    return c;
  }, [issues]);

  const changeFilter = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quản lý Ngoại lệ</h1>
        <p className="mt-1 text-sm text-slate-500">Giám sát và giải quyết các sự cố ô đỗ bất thường trong hệ thống.</p>
      </div>

      {/* ── Staff Emergency Alerts ── */}
      {emergencyLogs.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-5 w-5 text-rose-600" />
            <h2 className="font-bold text-rose-800">Cảnh báo khẩn cấp từ nhân viên</h2>
            <span className="ml-auto rounded-full bg-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-700">
              {emergencyLogs.filter(l => l.status === 'NEW').length} mới
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {emergencyLogs.map((log) => {
              const st = EMERGENCY_STATUS_STYLE[log.status] ?? EMERGENCY_STATUS_STYLE.NEW;
              return (
                <div key={log.id} className="rounded-xl border border-rose-100 bg-white p-4 shadow-sm space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
                      <span className="text-sm font-bold text-slate-800 leading-snug line-clamp-1">{log.title}</span>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${st.badge}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{log.description}</p>
                  {(log.slotCode || log.floor) && (
                    <div className="flex items-center gap-1 text-[11px] text-rose-600 font-semibold">
                      <MapPin className="h-3 w-3" />
                      {[log.floor, log.slotCode].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>{log.createdAt}</span>
                    <span className="font-semibold">Báo cáo bởi: {log.reportedBy}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stat cards (số thật từ Sự cố Ô đỗ) ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([
          { icon: Wrench,      iconBg: 'bg-blue-50   text-blue-500',   label: 'Tổng sự cố',    value: issues.length },
          { icon: Clock3,      iconBg: 'bg-amber-50  text-amber-500',  label: 'Chờ duyệt',      value: counts.Pending },
          { icon: AlertTriangle, iconBg: 'bg-red-50  text-red-500',    label: 'Đang bảo trì',   value: counts.Approved },
          { icon: CheckCircle2, iconBg: 'bg-emerald-50 text-emerald-500', label: 'Đã hoàn thành', value: counts.Resolved },
        ] as const).map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-xs text-slate-500">{s.label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-800">{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Plate/slot search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => changeFilter(() => setSearch(e.target.value))}
            placeholder="Tìm ô đỗ, người báo cáo, mô tả..."
            className="w-64 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {/* Type dropdown */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => changeFilter(() => setTypeFilter(e.target.value))}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none"
          >
            <option value="all">Tất cả loại sự cố</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{ISSUE_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Status dropdown */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => changeFilter(() => setStatusFilter(e.target.value as StatusFilter))}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-9 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            {(Object.keys(STATUS_CONFIG) as (keyof typeof STATUS_CONFIG)[]).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {paged.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center text-slate-400">
            <Wrench className="h-10 w-10 text-slate-200" />
            <p className="text-sm font-semibold">Không có sự cố nào khớp bộ lọc</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Ngày & Giờ', 'Ô đỗ', 'Loại sự cố', 'Người báo cáo', 'Trạng thái', 'Thao tác'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paged.map((issue) => {
                const st = STATUS_CONFIG[issue.status];
                const StatusIcon = st.icon;
                const [datePart, timePart] = issue.reportedAt.split(' ');
                return (
                  <tr key={issue.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{datePart}</p>
                      <p className="text-xs text-slate-400">{timePart ?? ''}</p>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{issue.slotCode}</td>
                    <td className="px-5 py-4 text-slate-700">{ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}</td>
                    <td className="px-5 py-4 text-slate-700">{issue.reportedBy}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${st.bg} ${st.text}`}>
                        <StatusIcon className="h-3 w-3" />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openDetail(issue)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <Info className="h-3.5 w-3.5" />
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">
              Hiển thị {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, filtered.length)} trong {filtered.length} ngoại lệ
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-medium text-slate-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {detailIssue && (() => {
        const cfg = STATUS_CONFIG[detailIssue.status];
        const StatusIcon = cfg.icon;
        const locked = detailIssue.status === 'Resolved' || detailIssue.status === 'Rejected';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={closeDetail}>
            <div
              className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Chi tiết ngoại lệ</p>
                  <p className="mt-0.5 font-mono font-bold text-slate-900">{detailIssue.slotCode}</p>
                </div>
                <button onClick={closeDetail} className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Loại sự cố</p>
                    <p className="mt-1 font-semibold text-slate-800">{ISSUE_TYPE_LABELS[detailIssue.issueType] ?? detailIssue.issueType}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Trạng thái hiện tại</p>
                    <p className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Người báo cáo</p>
                    <p className="mt-1 font-semibold text-slate-800">{detailIssue.reportedBy || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Thời gian báo cáo</p>
                    <p className="mt-1 font-semibold text-slate-800">{detailIssue.reportedAt}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Mô tả</p>
                  <p className="text-sm leading-relaxed text-slate-700">{detailIssue.description || 'Không có mô tả.'}</p>
                </div>

                {detailIssue.imageUrl ? (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Ảnh đính kèm</p>
                    <img
                      src={detailIssue.imageUrl}
                      alt="Ảnh sự cố"
                      className="max-h-48 rounded-xl border border-slate-200 bg-white object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <ImageIcon className="h-4 w-4" />
                    Không có ảnh đính kèm
                  </div>
                )}

                {/* Trạng thái xử lý — Duyệt/Từ chối (Pending) hoặc Khôi phục (Approved),
                    dùng đúng 3 hành động đã có ở trang Sự cố Ô đỗ. */}
                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">Trạng thái xử lý</label>
                  {locked ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Sự cố này đã ở trạng thái cuối ({cfg.label}) — không thể chỉnh sửa thêm.
                    </div>
                  ) : detailIssue.status === 'Approved' ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => { onRestoreIssue?.(detailIssue.id); closeDetail(); }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Hoàn thành bảo trì — Khôi phục ô đỗ
                      </button>
                      <p className="text-[11px] text-slate-500">
                        Ô đỗ <strong>{detailIssue.slotCode}</strong> đang ở trạng thái Bảo trì — bấm để trả về Trống.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { onRejectIssue?.(detailIssue.id); closeDetail(); }}
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                      >
                        Từ chối
                      </button>
                      <button
                        type="button"
                        onClick={() => { onApproveIssue?.(detailIssue.id); closeDetail(); }}
                        className="rounded-xl bg-red-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-red-700"
                      >
                        Duyệt — Bảo trì
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 border-t border-slate-100 p-4">
                <button
                  type="button"
                  onClick={closeDetail}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
