import React, { useState } from 'react';
import { User, validateEmail, validateLicensePlate, validatePhone, validateRequired } from '../../data/mockData';
import FormInput from '../../components/FormInput';
import authService from '../../services/authService';
import { localDateISO } from '../../utils/helpers';

export default function Register({ onRegister, setView, users }: {
  onRegister: (newUser: User, plateNumber: string, vehicleType: string, brand: string, model: string) => void;
  setView: (view: string) => void;
  users: User[];
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    const nameErr = validateRequired(fullName, 'Họ và tên');
    if (nameErr) tempErrors.fullName = nameErr;

    const emailErr = validateEmail(email);
    if (emailErr) tempErrors.email = emailErr;

    const phoneErr = validatePhone(phone);
    if (phoneErr) tempErrors.phone = phoneErr;

    const plateErr = validateLicensePlate(plateNumber);
    if (plateErr) tempErrors.plateNumber = plateErr;
    if (!vehicleType) tempErrors.vehicleType = 'Vui lòng chọn loại phương tiện.';

    const brandErr = validateRequired(brand, 'Hãng xe');
    if (brandErr) tempErrors.brand = brandErr;

    const modelErr = validateRequired(model, 'Dòng xe');
    if (modelErr) tempErrors.model = modelErr;

    if (!password) {
      tempErrors.password = 'Vui lòng nhập mật khẩu.';
    } else if (password.length < 6) {
      tempErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
    }

    if (confirmPassword !== password) tempErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    setIsLoading(true);
    try {
      // Try API register first
      const response = await authService.register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        plateNumber: plateNumber.trim(),
        vehicleType,
        brand: brand.trim(),
        model: model.trim(),
        password,
      });

      const newUser: User = {
        id: response.user.id,
        fullName: response.user.fullName,
        email: response.user.email,
        phone: response.user.phone,
        role: response.user.role as any,
        status: response.user.status as any,
        createdAt: response.user.createdAt || localDateISO(),
        password,
      };

      setErrors({});
      onRegister(newUser, plateNumber.trim(), vehicleType, brand.trim(), model.trim());
      alert('Tạo tài khoản thành công!');
      setView('login');
    } catch {
      // API unavailable — create user locally in mock data
      const emailLower = email.trim().toLowerCase();
      if (users.some((u) => u.email.toLowerCase() === emailLower)) {
        setErrors({ general: 'Email này đã được sử dụng. Vui lòng dùng email khác.' });
        setIsLoading(false);
        return;
      }

      const newUser: User = {
        id: `USR-${Date.now()}`,
        fullName: fullName.trim(),
        email: emailLower,
        phone: phone.trim(),
        role: 'Parking User / Driver',
        status: 'Active',
        createdAt: localDateISO(),
        password,
      };

      setErrors({});
      onRegister(newUser, plateNumber.trim(), vehicleType, brand.trim(), model.trim());
      alert('Tạo tài khoản thành công!');
      setView('login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center py-8 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-md">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-slate-800">Tạo tài khoản người dùng</h2>
          <p className="text-xs text-slate-400">Truy cập ngay vào cổng đặt chỗ và quản lý lượt gửi xe</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {errors.general && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              {errors.general}
            </div>
          )}

          <FormInput
            label="Họ và tên"
            value={fullName}
            onChange={(e: any) => { setFullName(e.target.value); if (errors.fullName) setErrors(p => ({ ...p, fullName: undefined })); }}
            error={errors.fullName}
            placeholder="Nguyễn Văn A"
          />
          <FormInput
            label="Địa chỉ email"
            value={email}
            onChange={(e: any) => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })); }}
            error={errors.email}
            placeholder="tenban@example.com"
          />
          <FormInput
            label="Số điện thoại"
            value={phone}
            onChange={(e: any) => { setPhone(e.target.value); if (errors.phone) setErrors(p => ({ ...p, phone: undefined })); }}
            error={errors.phone}
            placeholder="0901234567"
          />

          {/* Vehicle info section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Thông tin phương tiện</p>

            <FormInput
              label="Biển số xe"
              value={plateNumber}
              onChange={(e: any) => { setPlateNumber(e.target.value.toUpperCase()); if (errors.plateNumber) setErrors(p => ({ ...p, plateNumber: undefined })); }}
              error={errors.plateNumber}
              placeholder="29C1-38383"
            />

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Loại phương tiện</label>
              <select
                value={vehicleType}
                onChange={(e: any) => { setVehicleType(e.target.value); if (errors.vehicleType) setErrors(p => ({ ...p, vehicleType: undefined })); }}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${errors.vehicleType ? 'border-red-400' : 'border-slate-300'} focus:outline-none focus:ring-2 ${errors.vehicleType ? 'focus:ring-red-500' : 'focus:ring-blue-500'} bg-white`}
              >
                <option value="">Chọn loại phương tiện</option>
                <option value="motorbike">Xe máy / Xe máy điện</option>
                <option value="car">Ô tô 4-7 chỗ (Xăng)</option>
                <option value="electric vehicle">Ô tô 4-7 chỗ (Điện)</option>
              </select>
              {errors.vehicleType && <p className="text-xs text-red-700 mt-1">{errors.vehicleType}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormInput
                label="Hãng xe"
                value={brand}
                onChange={(e: any) => { setBrand(e.target.value); if (errors.brand) setErrors(p => ({ ...p, brand: undefined })); }}
                error={errors.brand}
                placeholder="Toyota, Honda..."
              />
              <FormInput
                label="Dòng xe"
                value={model}
                onChange={(e: any) => { setModel(e.target.value); if (errors.model) setErrors(p => ({ ...p, model: undefined })); }}
                error={errors.model}
                placeholder="Camry, SH..."
              />
            </div>
          </div>

          <FormInput
            label="Mật khẩu"
            type="password"
            value={password}
            onChange={(e: any) => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })); }}
            error={errors.password}
            placeholder="Tối thiểu 6 ký tự"
          />
          <FormInput
            label="Xác nhận mật khẩu"
            type="password"
            value={confirmPassword}
            onChange={(e: any) => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(p => ({ ...p, confirmPassword: undefined })); }}
            error={errors.confirmPassword}
            placeholder="Nhập lại mật khẩu"
          />

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-blue-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang tạo tài khoản...
                </>
              ) : (
                'Đăng ký tài khoản'
              )}
            </button>
          </div>
        </form>

        <div className="text-center text-xs text-slate-500 pt-1">
          <p>
            Đã có tài khoản?{' '}
            <button onClick={() => setView('login')} className="text-blue-600 font-bold hover:underline">
              Đăng nhập ngay
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
