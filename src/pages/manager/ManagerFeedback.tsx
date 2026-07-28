import React, { useState } from 'react';
import { Send, MessageSquare, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, Loader, X } from 'lucide-react';
import type { Feedback } from '../../data/mockData';

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

interface ManagerFeedbackProps {
  feedbacks?: Feedback[];
  onRespondFeedback?: (id: string, response: string, status: Feedback['status']) => void;
  addToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function ManagerFeedback({
  feedbacks = [],
  onRespondFeedback,
  addToast,
}: ManagerFeedbackProps) {
  const [fbFilter,   setFbFilter]   = useState<'all' | Feedback['status']>('all');
  const [fbSelected, setFbSelected] = useState<Feedback | null>(null);
  const [fbReply,     setFbReply]     = useState('');
  const [fbNewStatus, setFbNewStatus] = useState<Feedback['status']>('In Progress');
  const [fbSaving, setFbSaving] = useState(false);

  const handleSelect = (fb: Feedback) => {
    setFbSelected(fb);
    setFbReply(fb.staffResponse ?? '');
    setFbNewStatus(fb.status === 'New' ? 'In Progress' : fb.status);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Phản hồi Người dùng</h1>
        <p className="mt-1 text-sm text-slate-500">
          Xem xét và xử lý các phản hồi, yêu cầu hỗ trợ gửi từ khách hàng.
        </p>
      </div>

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
                    onClick={() => handleSelect(fb)}
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
                        <p className="mt-1 text-[10px] text-slate-400">
                          <span className="font-semibold text-slate-500">{fb.userName || 'Khách'}</span>
                          {' · '}{fb.createdAt}
                        </p>
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
          {fbSelected ? (() => {
            const isLocked = fbSelected.status === 'Resolved' || fbSelected.status === 'Rejected';
            return (
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
                    { label: 'Người gửi', value: fbSelected.userName || 'Khách' },
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

                {/* Previous response */}
                {fbSelected.staffResponse && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">
                      Phản hồi trước — {fbSelected.staffRespondedAt ?? ''}
                    </p>
                    <p className="text-sm text-slate-700">{fbSelected.staffResponse}</p>
                  </div>
                )}

                {isLocked && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    Phản hồi này đã được xử lý xong ({FB_STATUS_META[fbSelected.status].label}) và không thể chỉnh sửa thêm.
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
                          disabled={isLocked}
                          onClick={() => setFbNewStatus(s)}
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
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
                    disabled={isLocked}
                    placeholder="Nhập nội dung phản hồi hoặc ghi chú kết quả xử lý..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-400 focus:outline-none resize-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t border-slate-100 p-4 flex gap-2">
                {!isLocked && (
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
                )}
                <button
                  type="button"
                  onClick={() => setFbSelected(null)}
                  className={`rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition ${isLocked ? 'flex-1' : ''}`}
                >
                  Đóng
                </button>
              </div>
            </div>
            );
          })() : (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 gap-3 p-8 text-center">
              <MessageSquare className="h-10 w-10 text-slate-200" />
              <p className="text-sm font-semibold">Chọn một phản hồi từ danh sách để xem chi tiết và xử lý</p>
              <p className="text-xs">Bạn có thể cập nhật trạng thái, phản hồi người dùng và ghi chú kết quả xử lý.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
