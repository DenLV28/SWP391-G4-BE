import React, { useState } from 'react';
import { Building2, Edit, LayoutGrid, MapPin, Plus, Trash2, X } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import FormInput from '../../components/FormInput';
import SectionTitle from '../../components/SectionTitle';
import type { ParkingLotInfo } from '../../utils/parkingLots';
import { lotImageOf } from '../../utils/lotImages';
import {
  type LotStatus,
  type ParkingLotInput,
  createParkingLot,
  deleteParkingLot,
  updateParkingLot,
} from '../../services/parkingLotService';

const STATUS_STYLE: Record<LotStatus, string> = {
  'Hoạt động': 'bg-green-100 text-green-700 border border-green-200',
  'Bảo trì':   'bg-slate-100 text-slate-600 border border-slate-200',
  'Đóng cửa':  'bg-red-100   text-red-600   border border-red-200',
};

const LOT_STATUSES: LotStatus[] = ['Hoạt động', 'Bảo trì', 'Đóng cửa'];

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ParkingLotManagement({
  lots,
  onReload,
  onOpenLayout,
}: {
  /** Danh mục bãi từ dbo.parking_lots (App.tsx tải và giữ). */
  lots: ParkingLotInfo[];
  onReload: () => Promise<void>;
  onOpenLayout: (lot: ParkingLotInfo) => void;
}) {
  const [formMode, setFormMode] = useState<'List' | 'Create' | 'Edit'>('List');
  const [selectedLot, setSelectedLot] = useState<ParkingLotInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ParkingLotInfo | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const [name, setName] = useState('');
  const [bookingLabel, setBookingLabel] = useState('');
  const [address, setAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [description, setDescription] = useState('');
  const [imageData, setImageData] = useState('');
  const [status, setStatus] = useState<LotStatus>('Hoạt động');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleOpenCreate = () => {
    setFormMode('Create');
    setSelectedLot(null);
    setName('');
    setBookingLabel('');
    setAddress('');
    setMapsUrl('');
    setDescription('');
    setImageData('');
    setStatus('Hoạt động');
    setErrors({});
  };

  const handleOpenEdit = (lot: ParkingLotInfo) => {
    setSelectedLot(lot);
    setFormMode('Edit');
    setName(lot.name);
    setBookingLabel(lot.bookingLabel);
    setAddress(lot.address);
    setMapsUrl(lot.mapsUrl);
    setDescription(lot.description);
    setImageData(lot.imageData);
    setStatus(lot.status);
    setErrors({});
  };

  /** Link Maps đang hiệu lực: Admin nhập gì dùng nấy, bỏ trống thì suy từ địa chỉ. */
  const effectiveMapsUrl =
    mapsUrl.trim() ||
    (address.trim()
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
      : '');

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageData(await readFileAsBase64(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Tên bãi đỗ là bắt buộc.' });
      return;
    }
    setErrors({});
    setSubmitting(true);

    const payload: ParkingLotInput = { name, bookingLabel, address, mapsUrl, description, imageData, status };
    // Sửa bãi: KHÔNG gửi slots/gates ở form này — chúng thuộc trình thiết kế sơ
    // đồ. Backend bỏ qua khi trường vắng mặt nên sơ đồ giữ nguyên.
    const result =
      formMode === 'Edit' && selectedLot
        ? await updateParkingLot(selectedLot.id, payload)
        : await createParkingLot(payload);
    setSubmitting(false);

    if (!result.ok || !result.lot) {
      setErrors({ name: result.error || 'Không thể lưu bãi đỗ.' });
      return;
    }
    setFormMode('List');
    await onReload();
    // Bãi vừa tạo chưa có ô đỗ nào → mở thẳng trình thiết kế để Admin thêm ô
    // đỗ, entry và exit ngay, đúng luồng "tạo bãi xong là thiết kế sơ đồ".
    if (formMode === 'Create') onOpenLayout(result.lot);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deleteParkingLot(deleteTarget.id);
    if (!result.ok) {
      setDeleteError(result.error || 'Không thể xóa bãi đỗ.');
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    setDeleteError('');
    await onReload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle
          title="Quản lý bãi đỗ"
          subtitle="Thêm, sửa, xóa bãi đỗ và thiết kế sơ đồ ô đỗ / cổng vào ra cho từng bãi."
        />
        <button
          onClick={handleOpenCreate}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm bãi đỗ</span>
        </button>
      </div>

      {deleteError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {deleteError}
        </div>
      )}

      {lots.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Chưa có bãi đỗ nào."
          description="Bấm “Thêm bãi đỗ” để tạo bãi đỗ đầu tiên và bắt đầu thiết kế sơ đồ."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => {
            const image = lotImageOf(lot);
            return (
              <div key={lot.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex h-32 items-center justify-center bg-slate-50">
                  {image ? (
                    <img src={image} alt={lot.name} className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-10 w-10 text-slate-300" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-800">{lot.name}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[lot.status]}`}>
                      {lot.status}
                    </span>
                  </div>
                  {lot.address && (
                    <p className="flex items-start gap-1 text-[11px] text-slate-500">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-2">{lot.address}</span>
                    </p>
                  )}
                  <p className="line-clamp-2 flex-1 text-xs text-slate-500">
                    {lot.description || 'Chưa có mô tả.'}
                  </p>
                  <span className="text-[11px] font-semibold text-slate-400">
                    {lot.slotCount} ô đỗ · {lot.gates.filter((g) => g.kind === 'entry').length} cổng vào ·{' '}
                    {lot.gates.filter((g) => g.kind === 'exit').length} cổng ra
                  </span>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => onOpenLayout(lot)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                    >
                      <LayoutGrid className="h-4 w-4" />
                      Thiết kế sơ đồ
                    </button>
                    <button
                      onClick={() => handleOpenEdit(lot)}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                      title="Sửa bãi đỗ"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setDeleteError(''); setDeleteTarget(lot); }}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="Xóa bãi đỗ"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(formMode === 'Create' || formMode === 'Edit') && (
        <ModalShell
          title={formMode === 'Create' ? 'Thêm bãi đỗ mới' : `Sửa bãi đỗ: ${selectedLot?.name}`}
          onClose={() => setFormMode('List')}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Tên bãi đỗ"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              error={errors.name}
              placeholder="ParkFlow Quận 1"
            />
            <FormInput
              label="Nhãn trên form đặt chỗ (tùy chọn)"
              value={bookingLabel}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBookingLabel(e.target.value)}
              placeholder="ParkFlow Quận 1 - Bến Thành"
            />
            <FormInput
              label="Địa chỉ (tùy chọn)"
              value={address}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
              placeholder="123 Đường Lê Lợi, Quận 1, Hồ Chí Minh"
            />
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Định vị Google Map (tùy chọn)
              </label>
              <input
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="Dán link Google Maps của bãi, hoặc để trống"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <p className="text-[11px] text-slate-400">
                  {mapsUrl.trim()
                    ? 'Dùng link bạn dán — ghim đúng vị trí trên bản đồ.'
                    : 'Để trống thì hệ thống tự tra theo địa chỉ ở trên.'}
                </p>
                {effectiveMapsUrl && (
                  <a
                    href={effectiveMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    <MapPin className="h-3 w-3" />
                    Xem thử
                  </a>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Trạng thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LotStatus)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              >
                {LOT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Mô tả (tùy chọn)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Bãi đỗ trong nhà, có camera 24/7 và trạm sạc EV."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Hình ảnh (tùy chọn)</label>
              <input type="file" accept="image/*" onChange={handleImagePick} className="block w-full text-xs text-slate-500" />
              {imageData && <img src={imageData} alt="preview" className="mt-2 h-24 w-full rounded-lg object-cover" />}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFormMode('List')}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {formMode === 'Create' ? 'Tạo & thiết kế sơ đồ' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Xóa bãi đỗ"
        message={`Bạn có chắc muốn xóa bãi đỗ "${deleteTarget?.name}"? Toàn bộ ô đỗ và sơ đồ của bãi này sẽ bị xóa vĩnh viễn.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
