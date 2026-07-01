import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CarFront,
  CirclePlus,
  Lock,
  Pencil,
  Star,
} from 'lucide-react';
import { SavedVehicle, User, VehicleKey, validatePhone, validateRequired } from '../../data/mockData';

export default function Profile({
  user,
  savedVehicles,
  onUpdateUser,
  onAddVehicle,
  onSetDefaultVehicle,
}: {
  user: User;
  savedVehicles: SavedVehicle[];
  onUpdateUser: (up: any) => void;
  onAddVehicle: (veh: any) => boolean;
  onSetDefaultVehicle?: (vehicleId: string) => void;
}) {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [address, setAddress] = useState(user.address ?? '');

  // Keep form state in sync when user prop is refreshed from API/login
  useEffect(() => {
    setFullName(user.fullName);
    setPhone(user.phone);
    setAddress(user.address ?? '');
  }, [user.id, user.fullName, user.phone, user.address]);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const [plate, setPlate] = useState('');
  const [vType, setVType] = useState<VehicleKey>('car');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');

  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [vehicleErrors, setVehicleErrors] = useState<Record<string, string>>({});

  const userVehicles = useMemo(
    () => savedVehicles.filter((v) => v.userId === user.id),
    [savedVehicles, user.id],
  );

  const currentVehicle = useMemo(
    () => userVehicles.find((vehicle) => vehicle.isDefault) ?? userVehicles[0] ?? null,
    [userVehicles],
  );

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    const nameErr = validateRequired(fullName, 'Họ và tên');
    if (nameErr) tempErrors.fullName = nameErr;

    const phoneErr = validatePhone(phone);
    if (phoneErr) tempErrors.phone = phoneErr;

    if (Object.keys(tempErrors).length > 0) {
      setProfileErrors(tempErrors);
      return;
    }

    setProfileErrors({});
    onUpdateUser({
      fullName: fullName.trim(),
      phone: phone.trim(),
      address: address.trim() || undefined,
    });
    setIsEditingProfile(false);
    alert('Đã cập nhật thông tin tài khoản.');
  };

  const handleAddVeh = (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    const plateErr = validateRequired(plate, 'Biển số');
    if (plateErr) {
      tempErrors.licensePlate = plateErr;
    } else if (savedVehicles.some((vehicle) => vehicle.licensePlate.trim().toLowerCase() === plate.trim().toLowerCase())) {
      tempErrors.licensePlate = 'Biển số này đã được thêm vào danh sách xe của bạn.';
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
      licensePlate: plate.trim(),
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

            <ProfileField label="Email">
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full cursor-not-allowed rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-[16px] text-slate-400"
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
                className="rounded-[14px] bg-[#1f67db] px-5 py-3 text-[15px] font-semibold text-white transition hover:bg-[#1659bf]"
              >
                Lưu thông tin
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

          {userVehicles.map((vehicle) => (
            <article key={vehicle.id} className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-[0_8px_18px_rgba(15,42,81,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eff5ff] text-[#1f67db]">
                  <CarFront className="h-6 w-6" />
                </div>
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
              </div>

              <h3 className="mt-5 text-[18px] font-semibold text-slate-900">{vehicleTitle(vehicle.vehicleType)}</h3>

              <div className="mt-5 grid gap-3 text-[15px] text-slate-700 sm:grid-cols-2">
                <VehicleMeta label="Biển số" value={vehicle.licensePlate} />
                <VehicleMeta label="Dòng xe" value={[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Chưa cập nhật'} />
                <VehicleMeta label="Loại xe" value={vehicleTypeLabel(vehicle.vehicleType)} />
                <VehicleMeta label="Trạng thái" value="Kích hoạt" />
              </div>
            </article>
          ))}

          <div className={`rounded-[18px] border-2 border-dashed ${showVehicleForm ? 'border-[#1f67db]/25 bg-[#f8fbff]' : 'border-slate-200 bg-white'} p-5`}>
            {showVehicleForm ? (
              <form onSubmit={handleAddVeh} className="space-y-4">
                <h3 className="text-[18px] font-semibold text-slate-900">Đăng ký thêm xe</h3>

                <ProfileField label="Biển số" error={vehicleErrors.licensePlate}>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="Ví dụ: 30A - 123.45"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] outline-none transition focus:border-blue-500"
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
                <p className="mt-1 text-[15px] italic text-slate-500">Cập nhật lần cuối: 3 tháng trước</p>
              </div>
            </div>

            <button
              type="button"
              className="rounded-[14px] border border-slate-300 px-6 py-3 text-[15px] font-medium text-slate-800 transition hover:bg-slate-50"
            >
              Đổi mật khẩu
            </button>
          </div>

          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eff5ff] text-slate-700">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[18px] font-medium text-slate-900">Xác thực 2 yếu tố (2FA)</h3>
                <p className="mt-1 text-[15px] text-slate-500">Tăng cường bảo mật cho tài khoản của bạn</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setTwoFactorEnabled((prev) => !prev)}
              className={`relative h-8 w-14 rounded-full transition ${twoFactorEnabled ? 'bg-[#1f67db]' : 'bg-slate-300'}`}
              aria-label="Bật tắt xác thực 2 lớp"
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${twoFactorEnabled ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
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
