import React, { useRef, useState } from 'react';
import { ImagePlus, MessageSquareWarning, X } from 'lucide-react';
import { Feedback, validateRequired } from '../../data/mockData';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import SectionTitle from '../../components/SectionTitle';

type FeedbackPriority = 'Low' | 'Medium' | 'High';

export default function FeedbackPage({
  feedbacks,
  onSubmitFeedback,
}: {
  feedbacks: Feedback[];
  onSubmitFeedback: (fb: any) => void;
}) {
  const [type, setType] = useState('Mất thẻ xe');
  const [ticketCode, setTicketCode] = useState('TK-480921');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<FeedbackPriority>('Medium');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Chỉ cho phép tải lên tệp hình ảnh (JPG, PNG, GIF...).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Kích thước ảnh tối đa là 5MB.');
      return;
    }
    setAttachmentFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAttachmentPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    const typeErr = validateRequired(type, 'Loại phản hồi');
    if (typeErr) tempErrors.type = typeErr;


    const priorityErr = validateRequired(priority, 'Mức độ ưu tiên');
    if (priorityErr) tempErrors.priority = priorityErr;

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    setErrors({});
    onSubmitFeedback({
      type,
      ticketCode: ticketCode.trim(),
      description: description.trim(),
      priority,
      attachmentUrl: attachmentPreview ?? undefined,
    });
    setDescription('');
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    alert('Đã gửi phản hồi thành công.');
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Phản hồi và hỗ trợ" subtitle="Báo lỗi mất thẻ, sai phí, khó tìm xe hoặc các vấn đề trong bãi" />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Gửi yêu cầu hỗ trợ</h3>
          <form className="space-y-3.5 text-xs" onSubmit={handleSubmit}>
            <Field label="Loại phản hồi">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="Mất thẻ xe">Mất thẻ xe</option>
                <option value="Sai phí">Sai phí</option>
                <option value="Không tìm thấy xe">Không tìm thấy xe</option>
                <option value="Ô bị chiếm">Ô bị chiếm (chỗ đặt trước đã bị lấy)</option>
                <option value="Sai biển số">Sai thông tin biển số từ camera</option>
                <option value="Vấn đề khác">Vấn đề khác trong bãi</option>
              </select>
              {errors.type && <span className="text-[10px] font-semibold text-rose-500">{errors.type}</span>}
            </Field>

            <Field label="Mã vé liên quan (không bắt buộc)">
              <input
                type="text"
                value={ticketCode}
                onChange={(e) => setTicketCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 outline-none"
                placeholder="Ví dụ: TK-480921"
              />
            </Field>

            <Field label="Mô tả sự cố (tùy chọn)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-slate-200 p-2.5 outline-none focus:ring-1 focus:ring-blue-600"
                placeholder="Mô tả ngắn gọn vấn đề hoặc sự cố đang gặp phải..."
              />
            </Field>

            <Field label="Mức độ ưu tiên">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as FeedbackPriority)}
                className="w-full rounded-xl border border-slate-200 p-2.5 outline-none"
              >
                <option value="Low">Thấp, góp ý chung</option>
                <option value="Medium">Trung bình, ảnh hưởng lượt gửi hiện tại</option>
                <option value="High">Cao, cần hỗ trợ gấp</option>
              </select>
              {errors.priority && <span className="text-[10px] font-semibold text-rose-500">{errors.priority}</span>}
            </Field>

            <Field label="Tệp đính kèm (không bắt buộc)">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {attachmentPreview ? (
                <div className="relative rounded-xl border border-slate-200 overflow-hidden">
                  <img src={attachmentPreview} alt="Ảnh đính kèm" className="max-h-40 w-full object-contain bg-slate-50" />
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-500 hover:text-rose-600 shadow"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <p className="bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500 truncate">{attachmentFile?.name}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-blue-400 hover:bg-blue-50"
                >
                  <ImagePlus className="h-5 w-5 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500">Nhấn để chọn ảnh</span>
                  <span className="text-[9px] text-slate-400">JPG, PNG, GIF – Tối đa 5MB</span>
                </button>
              )}
            </Field>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-3 text-xs font-bold text-white transition hover:bg-blue-500"
            >
              Gửi yêu cầu hỗ trợ
            </button>
          </form>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Lịch sử phản hồi</h3>
          {feedbacks.length > 0 ? (
            <div className="space-y-3">
              {feedbacks.map((feedback) => (
                <div key={feedback.id} className="space-y-2 rounded-xl border border-slate-100 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-[9px] font-bold uppercase text-slate-400">Mã hỗ trợ</span>
                      <h4 className="text-sm font-bold text-slate-800">{feedback.feedbackCode}</h4>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge status={feedback.priority} />
                      <StatusBadge status={feedback.status} />
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-50 pt-2 text-slate-500">
                    <Row label="Loại" value={feedback.type} />
                    {feedback.ticketCode && <Row label="Mã vé" value={feedback.ticketCode} />}
                    <div className="mt-1 rounded-lg border border-slate-100 bg-slate-50 p-2.5 italic text-slate-650">
                      "{feedback.description}"
                    </div>
                    {feedback.attachmentUrl && (
                      <div className="rounded-lg overflow-hidden border border-slate-100">
                        <img src={feedback.attachmentUrl} alt="Ảnh đính kèm" className="max-h-32 w-full object-contain bg-slate-50" />
                      </div>
                    )}
                    <span className="block pt-1 text-right text-[9px] text-slate-400">Tạo lúc: {feedback.createdAt}</span>
                  </div>

                  {feedback.staffResponse && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 mt-2">
                      <span className="block text-[9px] font-bold uppercase text-blue-600 mb-1">Phản hồi từ nhân viên</span>
                      <p className="text-[11px] text-blue-900">{feedback.staffResponse}</p>
                      {feedback.staffRespondedAt && (
                        <span className="block text-right text-[9px] text-blue-400 mt-1">{feedback.staffRespondedAt}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={MessageSquareWarning} title="Chưa có phản hồi nào" description="Các yêu cầu bạn gửi và phản hồi từ nhân viên sẽ hiển thị tại đây." />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}:</span>
      <span className="font-bold text-slate-700">{value}</span>
    </div>
  );
}
