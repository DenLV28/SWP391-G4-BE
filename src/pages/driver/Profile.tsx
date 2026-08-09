import React, { useEffect, useMemo, useState } from 'react';
import {
  CarFront,
  CirclePlus,
  Lock,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
import { SavedVehicle, User, VehicleKey, validateEmail, validateLicensePlate, validatePhone, validateRequired } from '../../data/mockData';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import ConfirmModal from '../../components/ConfirmModal';
import userService from '../../services/userService';

/** Nhan loai xe hien cho nguoi dung — dung chung cho cac thong bao trung xe. */
const VEHICLE_TYPE_LABEL: Record<VehicleKey, string> = {
  car: 'Ô tô 4-7 chỗ (Xăng)',
  motorbike: 'Xe máy / Xe máy điện',
  'electric vehicle': 'Ô tô 4-7 chỗ (Điện / EV)',
};

export default function Profile({
  user,
  savedVehicles,
  onUpdateUser,
  onAddVehicle,
  onUpdateVehicle,
  onSetDefaultVehicle,
  onDeleteVehicle,
}: {
  user: User;
  savedVehicles: SavedVehicle[];
  onUpdateUser: (up: Partial<User>) => Promise<{ ok: boolean; error?: string }>;
  onAddVehicle: (veh: any) => boolean;
  onUpdateVehicle?: (
    vehicleId: string,
    updates: { licensePlate: string; vehicleType: VehicleKey; brand: string; model: string },
  ) => Promise<{ ok: boolean; error?: string }>;
  onSetDefaultVehicle?: (vehicleId: string) => void;
  /** Xóa hẳn một xe khỏi hồ sơ (và khỏi dbo.vehicles). */
  onDeleteVehicle?: (vehicleId: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email);
  const [address, setAddress] = useState(user.address ?? '');

  // Keep form state in sync when user prop is refreshed from API/login
  useEffect(() => {
    setFullName(user.fullName);
    setPhone(user.phone);
    setEmail(user.email);
    setAddress(user.address ?? '');
  }, [user.id, user.fullName, user.phone, user.email, user.address]);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [plate, setPlate] = useState('');
  const [vType, setVType] = useState<VehicleKey>('car');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');

  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [vehicleErrors, setVehicleErrors] = useState<Record<string, string>>({});

  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editPlate, setEditPlate] = useState('');
  const [editType, setEditType] = useState<VehicleKey>('car');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [savingVehicleId, setSavingVehicleId] = useState<string | null>(null);
  // Xóa xe cần hỏi lại: xóa nhầm là mất luôn hồ sơ xe và liên kết thẻ RFID.
  const [deleteTarget, setDeleteTarget] = useState<SavedVehicle | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);

  const userVehicles = useMemo(
    () => savedVehicles.filter((v) => v.userId === user.id),
    [savedVehicles, user.id],
  );

  const currentVehicle = useMemo(
    () => userVehicles.find((vehicle) => vehicle.isDefault) ?? userVehicles[0] ?? null,
    [userVehicles],
  );

  const [savingProfile, setSavingProfile] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    const nameErr = validateRequired(fullName, 'Họ và tên');
    if (nameErr) tempErrors.fullName = nameErr;

    const phoneErr = validatePhone(phone);
    if (phoneErr) tempErrors.phone = phoneErr;

    const emailErr = validateEmail(email);
    if (emailErr) tempErrors.email = emailErr;

    if (Object.keys(tempErrors).length > 0) {
      setProfileErrors(tempErrors);
      return;
    }

    setProfileErrors({});
    setSavingProfile(true);
    const result = await onUpdateUser({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim() || undefined,
    });
    setSavingProfile(false);

    if (result.ok) {
      setIsEditingProfile(false);
      alert('Đã cập nhật thông tin tài khoản.');
    } else {
      setProfileErrors({ general: result.error || 'Không thể cập nhật thông tin. Vui lòng thử lại.' });
    }
  };

  /**
   * Trùng khi và chỉ khi TRÙNG CẢ biển số LẪN loại xe.
   *
   * Cùng một biển vẫn đăng ký được nhiều lần nếu loại xe khác nhau. So biển đã
   * chuẩn hoá (bỏ gạch/chấm/khoảng trắng) để "59A-99999" và "59A99999" không
   * lách thành hai bản ghi. Backend áp cùng quy tắc này bằng chỉ mục duy nhất
   * ghép (license_plate, vehicle_type) — đây chỉ là lớp báo sớm cho người dùng.
   */
  const isDuplicateVehicle = (p: string, type: VehicleKey, exceptId?: string) => {
    const norm = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const target = norm(p);
    return userVehicles.some(
      (v) => v.id !== exceptId && norm(v.licensePlate) === target && v.vehicleType === type,
    );
  };

  const handleAddVeh = (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    const plateErr = validateLicensePlate(plate);
    if (plateErr) {
      tempErrors.licensePlate = plateErr;
    } else if (isDuplicateVehicle(plate, vType)) {
      // Chỉ cấm trùng CẢ biển số LẪN loại xe — cùng biển mà khác loại vẫn được.
      tempErrors.licensePlate = `Biển ${plate.trim().toUpperCase()} với loại xe "${VEHICLE_TYPE_LABEL[vType]}" đã có trong danh sách. Cùng biển số vẫn thêm được nếu chọn loại xe khác.`;
    }

    const brandErr = validateRequired(brand, 'Hãng xe');
    if (brandErr) tempErrors.brand = brandErr;

    const modelErr = validateRequired(model, 'Dòng xe');
    if (modelErr) tempErrors.model = modelErr;

    if (Object.keys(tempErrors).length > 0) {
      setVehicleErrors(tempErrors);
      return;
    }

    setVehicleErrors({});
    const success = onAddVehicle({
      licensePlate: plate.trim().toUpperCase(),
      vehicleType: vType,
      brand: brand.trim(),
      model: model.trim(),
    });

    if (success) {
      setPlate('');
      setBrand('');
      setModel('');
      setShowVehicleForm(false);
      alert('Đã thêm phương tiện mới.');
    }
  };

  const handleDeleteVehicle = async () => {
    if (!deleteTarget || !onDeleteVehicle) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setDeletingVehicleId(target.id);
    const result = await onDeleteVehicle(target.id);
    setDeletingVehicleId(null);
    // Backend chặn xóa xe đang đỗ trong bãi (409 VEHICLE_IN_USE) — hiện đúng
    // câu đó thay vì một thông báo chung chung.
    if (!result.ok) alert(result.error || 'Không thể xóa phương tiện. Vui lòng thử lại.');
  };

  const startEditVehicle = (vehicle: SavedVehicle) => {
    setEditingVehicleId(vehicle.id);
    setEditPlate(vehicle.licensePlate);
    setEditType(vehicle.vehicleType);
    setEditBrand(vehicle.brand ?? '');
    setEditModel(vehicle.model ?? '');
    setEditErrors({});
  };

  const cancelEditVehicle = () => {
    setEditingVehicleId(null);
    setEditErrors({});
  };

  const handleSaveVehicle = async (e: React.FormEvent, vehicleId: string) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    const plateErr = validateLicensePlate(editPlate);
    if (plateErr) {
      tempErrors.licensePlate = plateErr;
    } else if (isDuplicateVehicle(editPlate, editType, vehicleId)) {
      tempErrors.licensePlate = `Biển ${editPlate.trim().toUpperCase()} với loại xe "${VEHICLE_TYPE_LABEL[editType]}" đã có trong danh sách. Cùng biển số vẫn thêm được nếu chọn loại xe khác.`;
    }

    const brandErr = validateRequired(editBrand, 'Hãng xe');
    if (brandErr) tempErrors.brand = brandErr;

    const modelErr = validateRequired(editModel, 'Dòng xe');
    if (modelErr) tempErrors.model = modelErr;

    if (Object.keys(tempErrors).length > 0) {
      setEditErrors(tempErrors);
      return;
    }

    setEditErrors({});
    setSavingVehicleId(vehicleId);
    const result = await onUpdateVehicle?.(vehicleId, {
      licensePlate: editPlate.trim().toUpperCase(),
      vehicleType: editType,
      brand: editBrand.trim(),
      model: editModel.trim(),
    });
    setSavingVehicleId(null);

    if (!result || result.ok) {
      setEditingVehicleId(null);
      alert('Đã cập nhật thông tin xe.');
    } else {
      setEditErrors({ general: result.error || 'Không thể cập nhật phương tiện. Vui lòng thử lại.' });
    }
  };

  const handleChangePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const updated = await userService.changePassword(user.id, currentPassword, newPassword);
      await onUpdateUser({ passwordUpdatedAt: updated?.passwordUpdatedAt ?? new Date().toISOString() });
      alert('Đổi mật khẩu thành công.');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Không thể đổi mật khẩu.' };
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,42,81,0.06)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-slate-900">Thông tin cá nhân</h2>
            <p className="mt-1 text-[15px] text-slate-500">Cập nhật thông tin liên hệ và địa chỉ của bạn</p>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingProfile((prev) => !prev)}
            className="inline-flex items-center gap-2 self-start rounded-[14px] bg-[#eff5ff] px-5 py-3 text-[15px] font-medium text-[#1f67db] transition hover:bg-[#e3eeff]"
          >
            <Pencil className="h-4 w-4" />
            {isEditingProfile ? 'Hủy chỉnh sửa' : 'Chỉnh sửa'}
          </button>
        </div>

        {isEditingProfile ? (
          <form onSubmit={handleUpdate} className="grid gap-5 px-6 py-6 md:grid-cols-2">
            {profileErrors.general && (
              <p className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
                {profileErrors.general}
              </p>
            )}

            <ProfileField label="Họ và tên" error={profileErrors.fullName}>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[16px] text-slate-800 outline-none transition focus:border-blue-500"
              />
            </ProfileField>

            <ProfileField label="Số điện thoại" error={profileErrors.phone}>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[16px] text-slate-800 outline-none transition focus:border-blue-500"
              />
            </ProfileField>

            <ProfileField label="Email" error={profileErrors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[16px] text-slate-800 outline-none transition focus:border-blue-500"
              />
            </ProfileField>

            <ProfileField label="Địa chỉ (tùy chọn)">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Nhập địa chỉ của bạn..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[16px] text-slate-800 outline-none transition focus:border-blue-500"
              />
            </ProfileField>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-[14px] bg-[#1f67db] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#1659bf] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-x-10 gap-y-8 px-6 py-7 md:grid-cols-2">
            <StaticInfo label="Họ và tên" value={user.fullName} />
            <StaticInfo label="Số điện thoại" value={formatPhone(user.phone)} />
            <StaticInfo label="Email" value={user.email} />
            {user.address && <StaticInfo label="Địa chỉ" value={user.address} />}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,42,81,0.06)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[22px] font-bold tracking-tight text-slate-900">Quản lý xe</h2>
            <p className="mt-1 text-[15px] text-slate-500">Danh sách phương tiện đang sử dụng dịch vụ</p>
          </div>

          <button
            type="button"
            onClick={() => setShowVehicleForm((prev) => !prev)}
            className="inline-flex items-center gap-2 self-start rounded-[14px] bg-[#1f67db] px-5 py-3 text-[15px] font-medium text-white transition hover:bg-[#1659bf]"
          >
            <CirclePlus className="h-5 w-5" />
            Thêm xe mới
          </button>
        </div>

        <div className="grid gap-5 px-6 py-7 xl:grid-cols-2">
          {userVehicles.length === 0 && (
            <article className="rounded-[18px] border border-slate-200 bg-white p-5">
              <p className="text-[15px] text-slate-500">Chưa có phương tiện nào được đăng ký.</p>
            </article>
          )}

          {userVehicles.map((vehicle) =>
            editingVehicleId === vehicle.id ? (
              <article key={vehicle.id} className="rounded-[18px] border-2 border-[#1f67db]/25 bg-[#f8fbff] p-5">
                <form onSubmit={(e) => handleSaveVehicle(e, vehicle.id)} className="space-y-4">
                  <h3 className="text-[18px] font-semibold text-slate-900">Chỉnh sửa phương tiện</h3>

                  {editErrors.general && (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
                      {editErrors.general}
                    </p>
                  )}

                  <ProfileField label="Biển số" error={editErrors.licensePlate}>
                    <input
                      type="text"
                      value={editPlate}
                      onChange={(e) => setEditPlate(e.target.value.toUpperCase())}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] uppercase outline-none transition focus:border-blue-500"
                    />
                  </ProfileField>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ProfileField label="Loại xe">
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as VehicleKey)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] outline-none transition focus:border-blue-500"
                      >
                        <option value="car">Ô tô 4-7 chỗ (Xăng)</option>
                        <option value="motorbike">Xe máy / Xe máy điện</option>
                        <option value="electric vehicle">Ô tô 4-7 chỗ (Điện)</option>
                      </select>
                    </ProfileField>

                    <ProfileField label="Hãng xe" error={editErrors.brand}>
                      <input
                        type="text"
                        value={editBrand}
                        onChange={(e) => setEditBrand(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] outline-none transition focus:border-blue-500"
                      />
                    </ProfileField>
                  </div>

                  <ProfileField label="Dòng xe" error={editErrors.model}>
                    <input
                      type="text"
                      value={editModel}
                      onChange={(e) => setEditModel(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] outline-none transition focus:border-blue-500"
                    />
                  </ProfileField>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={savingVehicleId === vehicle.id}
                      className="rounded-[14px] bg-[#1f67db] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#1659bf] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingVehicleId === vehicle.id ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditVehicle}
                      className="rounded-[14px] border border-slate-200 px-5 py-3 text-[15px] font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </article>
            ) : (
              <article key={vehicle.id} className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_18px_rgba(15,42,81,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eff5ff] text-[#1f67db]">
                    <CarFront className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    {vehicle.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-700">
                        <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" /> Mặc định
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetDefaultVehicle?.(vehicle.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[12px] font-medium text-slate-500 transition hover:border-blue-300 hover:text-[#1f67db]"
                      >
                        <Star className="h-3 w-3" /> Đặt mặc định
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEditVehicle(vehicle)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[12px] font-medium text-slate-500 transition hover:border-blue-300 hover:text-[#1f67db]"
                    >
                      <Pencil className="h-3 w-3" /> Sửa
                    </button>
                    {onDeleteVehicle && (
                      <button
                        type="button"
                        disabled={deletingVehicleId === vehicle.id}
                        onClick={() => setDeleteTarget(vehicle)}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-[12px] font-medium text-rose-600 transition hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        {deletingVehicleId === vehicle.id ? 'Đang xóa...' : 'Xóa'}
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="mt-5 text-[18px] font-semibold text-slate-900">{vehicleTitle(vehicle.vehicleType)}</h3>

                <div className="mt-5 grid gap-3 text-[15px] text-slate-700 sm:grid-cols-2">
                  <VehicleMeta label="Biển số" value={vehicle.licensePlate} />
                  <VehicleMeta label="Dòng xe" value={[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Chưa cập nhật'} />
                  <VehicleMeta label="Loại xe" value={vehicleTypeLabel(vehicle.vehicleType)} />
                  <VehicleMeta label="Trạng thái" value="Kích hoạt" />
                </div>
              </article>
            ),
          )}

          <div className={`rounded-[18px] border-2 border-dashed ${showVehicleForm ? 'border-[#1f67db]/25 bg-[#f8fbff]' : 'border-slate-200 bg-white'} p-5`}>
            {showVehicleForm ? (
              <form onSubmit={handleAddVeh} className="space-y-4">
                <h3 className="text-[18px] font-semibold text-slate-900">Đăng ký thêm xe</h3>

                <ProfileField label="Biển số" error={vehicleErrors.licensePlate}>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="Ví dụ: 29C1-38383"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] uppercase outline-none transition focus:border-blue-500"
                  />
                </ProfileField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <ProfileField label="Loại xe">
                    <select
                      value={vType}
                      onChange={(e) => setVType(e.target.value as VehicleKey)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] outline-none transition focus:border-blue-500"
                    >
                      <option value="car">Ô tô 4-7 chỗ (Xăng)</option>
                      <option value="motorbike">Xe máy / Xe máy điện</option>
                      <option value="electric vehicle">Ô tô 4-7 chỗ (Điện)</option>
                    </select>
                  </ProfileField>

                  <ProfileField label="Hãng xe" error={vehicleErrors.brand}>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Toyota"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] outline-none transition focus:border-blue-500"
                    />
                  </ProfileField>
                </div>

                <ProfileField label="Dòng xe" error={vehicleErrors.model}>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Camry"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] outline-none transition focus:border-blue-500"
                  />
                </ProfileField>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="rounded-[14px] bg-[#1f67db] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#1659bf]"
                  >
                    Lưu xe mới
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVehicleForm(false)}
                    className="rounded-[14px] border border-slate-200 px-5 py-3 text-[15px] font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowVehicleForm(true)}
                className="flex h-full min-h-[214px] w-full flex-col items-center justify-center gap-4 text-center text-slate-500 transition hover:text-[#1f67db]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-300 text-slate-400">
                  <CirclePlus className="h-7 w-7" />
                </div>
                <span className="text-[18px]">Đăng ký thêm xe</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,42,81,0.06)]">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-[22px] font-bold tracking-tight text-slate-900">Bảo mật tài khoản</h2>
          <p className="mt-1 text-[15px] text-slate-500">Quản lý mật khẩu và các phương thức xác thực</p>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eff5ff] text-slate-700">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[18px] font-medium text-slate-900">Mật khẩu đăng nhập</h3>
                <p className="mt-1 text-[15px] italic text-slate-500">
                  {user.passwordUpdatedAt
                    ? `Cập nhật lần cuối: ${formatRelativeTime(user.passwordUpdatedAt)}`
                    : 'Chưa từng đổi mật khẩu kể từ khi tạo tài khoản'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="rounded-[14px] border border-slate-300 px-6 py-3 text-[15px] font-medium text-slate-800 transition hover:bg-slate-50"
            >
              Đổi mật khẩu
            </button>
          </div>
        </div>
      </section>

      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSubmit={handleChangePassword}
      />

      {/* Xóa xe là thao tác không lùi được — hỏi lại và nói rõ hệ quả. */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Xóa phương tiện khỏi hồ sơ?"
        message={
          deleteTarget
            ? `Xe ${deleteTarget.licensePlate} (${VEHICLE_TYPE_LABEL[deleteTarget.vehicleType]}) sẽ bị xóa khỏi hồ sơ của bạn. ` +
              `Thẻ RFID đang gắn với xe (nếu có) sẽ được gỡ ra. Lịch sử gửi xe và hóa đơn cũ vẫn được giữ nguyên.`
            : ''
        }
        onConfirm={handleDeleteVehicle}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function formatRelativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return value;
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} tháng trước`;
  const years = Math.floor(months / 12);
  return `${years} năm trước`;
}

function StaticInfo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-[17px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ProfileField({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[12px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[12px] font-medium text-rose-500">{error}</span> : null}
    </label>
  );
}

function VehicleMeta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </div>
  );
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return value;
}

function vehicleTypeLabel(type: VehicleKey) {
  switch (type) {
    case 'car':
      return 'Ô tô 4-7 chỗ (Xăng)';
    case 'motorbike':
      return 'Xe máy / Xe máy điện';
    case 'electric vehicle':
      return 'Ô tô 4-7 chỗ (Điện)';
    default:
      return type;
  }
}

function vehicleTitle(type: VehicleKey) {
  switch (type) {
    case 'car':
      return 'Ô tô 4-7 chỗ (Xăng)';
    case 'motorbike':
      return 'Xe máy / Xe máy điện';
    case 'electric vehicle':
      return 'Ô tô 4-7 chỗ (Điện)';
    default:
      return vehicleTypeLabel(type);
  }
}
