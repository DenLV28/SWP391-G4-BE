import React, { useEffect, useState } from 'react';
import { Building2, Edit, LayoutGrid, Plus, Trash2, X } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import FormInput from '../../components/FormInput';
import SectionTitle from '../../components/SectionTitle';
import {
  type AdminParkingLot,
  createAdminParkingLot,
  deleteAdminParkingLot,
  fetchAdminParkingLots,
  updateAdminParkingLot,
} from '../../services/adminParkingLotService';

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
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
  setView,
  onOpenLayout,
}: {
  setView: (view: string) => void;
  onOpenLayout: (lot: AdminParkingLot) => void;
}) {
  const [lots, setLots] = useState<AdminParkingLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<'List' | 'Create' | 'Edit'>('List');
  const [selectedLot, setSelectedLot] = useState<AdminParkingLot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminParkingLot | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageData, setImageData] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await fetchAdminParkingLots();
    setLots(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenCreate = () => {
    setFormMode('Create');
    setName('');
    setDescription('');
    setImageData('');
    setErrors({});
  };

  const handleOpenEdit = (lot: AdminParkingLot) => {
    setSelectedLot(lot);
    setFormMode('Edit');
    setName(lot.name);
    setDescription(lot.description);
    setImageData(lot.imageData);
    setErrors({});
  };

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
    const result =
      formMode === 'Edit' && selectedLot
        ? await updateAdminParkingLot(selectedLot.id, { name, description, imageData })
        : await createAdminParkingLot({ name, description, imageData });
    setSubmitting(false);
    if (!result.ok || !result.lot) {
      setErrors({ name: result.error || 'Không thể lưu bãi đỗ.' });
      return;
    }
    setFormMode('List');
    await load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteAdminParkingLot(deleteTarget.id);
    setDeleteTarget(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionTitle
          title="Quản lý bãi đỗ"
          subtitle="Tạo bãi đỗ mới và thiết kế sơ đồ ô đỗ trực quan bằng kéo-thả."
        />
        <button
          onClick={handleOpenCreate}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm bãi đỗ</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Đang tải danh sách bãi đỗ...</div>
      ) : lots.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Chưa có bãi đỗ nào."
          description="Bấm “Thêm bãi đỗ” để tạo bãi đỗ đầu tiên và bắt đầu thiết kế sơ đồ."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => (
            <div key={lot.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex h-32 items-center justify-center bg-slate-50">
                {lot.imageData ? (
                  <img src={lot.imageData} alt={lot.name} className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-10 w-10 text-slate-300" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="text-sm font-bold text-slate-800">{lot.name}</h3>
                <p className="line-clamp-2 flex-1 text-xs text-slate-500">
                  {lot.description || 'Chưa có mô tả.'}
                </p>
                <span className="text-[11px] font-semibold text-slate-400">{lot.slotCount ?? 0} ô đỗ</span>
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
                    onClick={() => setDeleteTarget(lot)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    title="Xóa bãi đỗ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
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
              placeholder="Building A - Floor 1"
            />
            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Mô tả (tùy chọn)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Indoor parking area for cars."
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
                {formMode === 'Create' ? 'Tạo bãi đỗ' : 'Lưu thay đổi'}
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
