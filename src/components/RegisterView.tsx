/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  User, Mail, Phone, Car, Lock, ShieldCheck, ArrowRight, Sparkles, Shield, ChevronDown, Check, Info
} from 'lucide-react';
import { RegisterForm, FormErrors, VehicleOption } from '../types';

interface RegisterViewProps {
  onSuccess: (data: RegisterForm) => void;
  onNavigateToLogin: () => void;
  onShowModal: (title: string, content: string) => void;
}

const VEHICLE_OPTIONS: VehicleOption[] = [
  { value: 'motorbike',       label: 'Xe máy / Xe máy điện',    icon: '🏍️' },
  { value: 'car',             label: 'Ô tô 4-7 chỗ (Xăng)',     icon: '🚗' },
  { value: 'electric vehicle', label: 'Ô tô 4-7 chỗ (Điện / EV)', icon: '⚡' },
];

export default function RegisterView({ onSuccess, onNavigateToLogin, onShowModal }: RegisterViewProps) {
  const [form, setForm] = useState<RegisterForm>({
    fullName: '',
    email: '',
    phone: '',
    plateNumber: '',
    vehicleType: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error on change
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const selectVehicleType = (val: string) => {
    setForm(prev => ({ ...prev, vehicleType: val }));
    setShowVehicleDropdown(false);
    if (errors.vehicleType) {
      setErrors(prev => ({ ...prev, vehicleType: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const tempErrors: FormErrors = {};
    
    if (!form.fullName.trim()) {
      tempErrors.fullName = 'Vui lòng nhập họ và tên của bạn';
    } else if (form.fullName.trim().split(' ').length < 2) {
      tempErrors.fullName = 'Họ tên nên bao gồm cả họ và tên (vd: Nguyễn Văn A)';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email) {
      tempErrors.email = 'Vui lòng nhập địa chỉ email';
    } else if (!emailRegex.test(form.email)) {
      tempErrors.email = 'Email không hợp lệ (vd: nguyen@example.com)';
    }

    const phoneRegex = /^(0|84)[3|5|7|8|9][0-9]{8}$/;
    if (!form.phone) {
      tempErrors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!phoneRegex.test(form.phone.replace(/\s/g, ''))) {
      tempErrors.phone = 'SĐT không hợp lệ (đầu số VN, 10 số, vd: 0901234567)';
    }

    const plateRegex = /^[0-9]{2}[A-Z]-[0-9]{3,5}(\.[0-9]{2})?$/i;
    if (!form.plateNumber) {
      tempErrors.plateNumber = 'Vui lòng nhập biển số xe';
    } else {
      // Basic check for spacing or standard formatting
      const cleanPlate = form.plateNumber.replace(/\s/g, '').toUpperCase();
      if (cleanPlate.length < 4) {
        tempErrors.plateNumber = 'Biển số xe quá ngắn';
      }
    }

    if (!form.vehicleType) {
      tempErrors.vehicleType = 'Vui lòng chọn loại phương tiện';
    }

    if (!form.password) {
      tempErrors.password = 'Vui lòng điền mật khẩu đăng nhập';
    } else if (form.password.length < 6) {
      tempErrors.password = 'Mật khẩu cần tối thiểu 6 ký tự';
    }

    if (form.password !== form.confirmPassword) {
      tempErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    if (!form.agreeTerms) {
      tempErrors.agreeTerms = 'Bạn cần đồng ý với các điều khoản dịch vụ';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSuccess(form);
    }, 1200);
  };

  const selectedOption = VEHICLE_OPTIONS.find(opt => opt.value === form.vehicleType);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-6xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col lg:flex-row min-h-[720px] border border-gray-100"
    >
      {/* Side Banner (Neon Blue Modern) */}
      <div className="lg:w-[42%] bg-park-blue-900 text-white relative flex flex-col justify-between p-10 overflow-hidden shrink-0">
        {/* Futuristic Background overlay with neon blue gradient lights */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/src/assets/images/parkflow_bg_1779336618673.png" 
            alt="Futuristic parking" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-35 mix-blend-luminosity scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-park-blue-900/90 via-park-blue-600/70 to-park-blue-900/95" />
          {/* Subtle neon lines or accents */}
          <div className="absolute top-1/4 left-0 w-full h-px bg-cyan-400/30 blur-xs" />
          <div className="absolute bottom-1/3 left-1/4 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl" />
        </div>

        {/* Top Header */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="font-display font-black text-2xl tracking-tight text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-white text-park-blue-700 flex items-center justify-center text-lg font-black shadow-lg">P</span>
            ParkFlow
          </div>
        </div>

        {/* Content area */}
        <div className="relative z-10 my-auto pt-16 pb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-display font-extrabold leading-tight text-white tracking-tight mb-5">
              Bắt đầu hành trình cùng ParkFlow
            </h1>
            <p className="text-park-blue-100/90 leading-relaxed text-sm md:text-base font-normal max-w-md">
              Tham gia cộng đồng quản lý bãi xe thông minh nhất. Tối ưu hóa không gian, tăng doanh thu và mang lại trải nghiệm tuyệt vời cho khách hàng của bạn.
            </p>
          </motion.div>
        </div>

        {/* Feature list bullets */}
        <div className="relative z-10 space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-full bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Thiết lập nhanh chóng trong 5 phút</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Bảo mật dữ liệu chuẩn quốc tế</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Area */}
      <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
        {/* Headings */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-display font-extrabold text-gray-900 tracking-tight">
            Tạo tài khoản mới
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Vui lòng điền thông tin chi tiết bên dưới để đăng ký bãi đỗ của bạn.
          </p>
        </div>

        {/* Actual Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Full Name field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">Họ tên</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handleInputChange}
                placeholder="Nguyễn Văn A"
                className={`w-full pl-10 pr-4 py-2.5 bg-gray-50/60 hover:bg-gray-50/90 focus:bg-white text-gray-900 text-sm rounded-xl border ${
                  errors.fullName ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200/90 focus:ring-park-blue-100'
                } transition-all focus:outline-hidden focus:ring-4 focus:border-park-blue-500`}
              />
            </div>
            {errors.fullName && <p className="text-xs font-semibold text-rose-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-rose-500 inline-block"></span>{errors.fullName}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleInputChange}
                  placeholder="example@parkflow.vn"
                  className={`w-full pl-10 pr-4 py-2.5 bg-gray-50/60 hover:bg-gray-50/90 focus:bg-white text-gray-900 text-sm rounded-xl border ${
                    errors.email ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200/90 focus:ring-park-blue-100'
                  } transition-all focus:outline-hidden focus:ring-4 focus:border-park-blue-500`}
                />
              </div>
              {errors.email && <p className="text-xs font-semibold text-rose-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-rose-500 inline-block"></span>{errors.email}</p>}
            </div>

            {/* Phone Number Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">Số điện thoại</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleInputChange}
                  placeholder="090 123 4567"
                  className={`w-full pl-10 pr-4 py-2.5 bg-gray-50/60 hover:bg-gray-50/90 focus:bg-white text-gray-900 text-sm rounded-xl border ${
                    errors.phone ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200/90 focus:ring-park-blue-100'
                  } transition-all focus:outline-hidden focus:ring-4 focus:border-park-blue-500`}
                />
              </div>
              {errors.phone && <p className="text-xs font-semibold text-rose-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-rose-500 inline-block"></span>{errors.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Plate Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">Biển số xe đại diện (áp dụng thử)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <span className="text-xs font-mono font-bold select-none px-0.5 rounded-sm bg-gray-200 text-gray-600">PLATE</span>
                </div>
                <input
                  type="text"
                  name="plateNumber"
                  value={form.plateNumber}
                  onChange={handleInputChange}
                  placeholder="29A-123.45"
                  className={`w-full pl-15 pr-4 py-2.5 bg-gray-50/60 hover:bg-gray-50/90 focus:bg-white text-gray-900 text-sm rounded-xl border ${
                    errors.plateNumber ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200/90 focus:ring-park-blue-100'
                  } transition-all focus:outline-hidden" focus:ring-4 focus:border-park-blue-500`}
                />
              </div>
              {errors.plateNumber && <p className="text-xs font-semibold text-rose-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-rose-500 inline-block"></span>{errors.plateNumber}</p>}
            </div>

            {/* Vehicle Type Dropdown Selector */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-semibold text-gray-700 block">Loại xe</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
                  className={`w-full px-4 py-2.5 bg-gray-50/60 hover:bg-gray-50/90 focus:bg-white text-gray-900 text-sm rounded-xl border text-left flex items-center justify-between ${
                    errors.vehicleType ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200/90'
                  } transition-all focus:outline-hidden focus:ring-4 focus:ring-park-blue-100/50`}
                >
                  <span className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className={selectedOption ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                      {selectedOption ? `${selectedOption.icon} ${selectedOption.label}` : 'Chọn loại xe'}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showVehicleDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Box Overlay */}
                {showVehicleDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowVehicleDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1.5 w-full bg-white rounded-xl border border-gray-100 shadow-xl z-20 overflow-hidden py-1">
                      {VEHICLE_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => selectVehicleType(opt.value)}
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-park-blue-50 hover:text-park-blue-900 transition-colors flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="text-base leading-none">{opt.icon}</span>
                            <span>{opt.label}</span>
                          </span>
                          {form.vehicleType === opt.value && <Check className="w-4 h-4 text-park-blue-600" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {errors.vehicleType && <p className="text-xs font-semibold text-rose-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-rose-500 inline-block"></span>{errors.vehicleType}</p>}
            </div>
          </div>

          {/* Password fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">Mật khẩu</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-4 py-2.5 bg-gray-50/60 hover:bg-gray-50/90 focus:bg-white text-gray-900 text-sm rounded-xl border ${
                    errors.password ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200/90 focus:ring-park-blue-100'
                  } transition-all focus:outline-hidden focus:ring-4 focus:border-park-blue-500`}
                />
              </div>
              {errors.password && <p className="text-xs font-semibold text-rose-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-rose-500 inline-block"></span>{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 block">Xác nhận mật khẩu</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-4 py-2.5 bg-gray-50/60 hover:bg-gray-50/90 focus:bg-white text-gray-900 text-sm rounded-xl border ${
                    errors.confirmPassword ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200/90 focus:ring-park-blue-100'
                  } transition-all focus:outline-hidden focus:ring-4 focus:border-park-blue-500`}
                />
              </div>
              {errors.confirmPassword && <p className="text-xs font-semibold text-rose-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-rose-500 inline-block"></span>{errors.confirmPassword}</p>}
            </div>
          </div>

          {/* Agree Terms Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer text-xs text-gray-600 select-none">
              <input
                type="checkbox"
                name="agreeTerms"
                checked={form.agreeTerms}
                onChange={handleInputChange}
                className="mt-0.5 rounded-sm border-gray-300 text-park-blue-600 focus:ring-park-blue-500 w-4 h-4 cursor-pointer"
              />
              <span>
                Tôi đồng ý với{' '}
                <a 
                  href="#terms" 
                  onClick={(e) => { e.preventDefault(); onShowModal('Điều khoản dịch vụ', 'Chào mừng bạn đến với ParkFlow. Khi sử dụng hệ thống quản lý bãi xe thông minh của chúng tôi, bạn đồng ý tuân thủ các quy định bảo mật, quản lý luồng đỗ xe hợp pháp, không lưu trữ thông tin trái phép và chịu trách nhiệm bảo mật thông tin tài khoản cá nhân.'); }}
                  className="text-park-blue-600 hover:underline font-semibold"
                >
                  Điều khoản dịch vụ
                </a>{' '}
                và{' '}
                <a 
                  href="#privacy" 
                  onClick={(e) => { e.preventDefault(); onShowModal('Chính sách bảo mật', 'Chính sách bảo mật của ParkFlow quy định cách thức chúng tôi thu thập biển số xe, số điện thoại, mật khẩu mã hóa một chiều (hashing). Chúng tôi cam kết bảo mật thông tin bãi xe của bạn.'); }}
                  className="text-park-blue-600 hover:underline font-semibold"
                >
                  Chính sách bảo mật
                </a>{' '}
                của ParkFlow.
              </span>
            </label>
            {errors.agreeTerms && <p className="text-xs font-semibold text-rose-500 mt-1">{errors.agreeTerms}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-4 bg-park-blue-600 hover:bg-park-blue-700 text-white font-semibold text-sm py-3 px-4 rounded-xl shadow-md shadow-park-blue-100 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang khởi tạo tài khoản...
              </span>
            ) : (
              <>
                Tạo tài khoản <ArrowRight className="w-4.5 h-4.5" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-gray-100"></div>
          <span className="flex-shrink mx-4 text-[10px] font-bold text-gray-400 tracking-wider">HOẶC ĐĂNG KÝ BẰNG</span>
          <div className="flex-grow border-t border-gray-100"></div>
        </div>

        {/* Social login buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onShowModal('Đăng nhập qua Google', 'Hệ thống đang tích hợp cổng xác thực Google Single-Sign-On. Tính năng này sẽ sớm hoạt động vào phiên bản kế tiếp.')}
            className="flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200/90 rounded-xl text-xs font-semibold text-gray-700 shadow-xs hover:shadow-sm active:scale-98 transition-all cursor-pointer"
          >
            {/* Google colored G icon */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99C6.15 6.94 8.85 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.49 12.27c0-.82-.07-1.61-.21-2.38H12v4.51h6.43c-.28 1.46-1.11 2.7-2.35 3.53l3.66 2.84c2.14-1.97 3.75-4.88 3.75-8.5z" />
              <path fill="#FBBC05" d="M5.24 10.55c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.39 2.96C.5 4.74 0 6.74 0 8.8c0 2.06.5 4.06 1.39 5.84l3.85-2.99z" />
              <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.1.74-2.51 1.18-4.3 1.18-3.15 0-5.85-1.9-6.76-4.51L1.39 16.9C3.37 20.33 7.35 23 12 23z" />
            </svg>
            Google
          </button>

          <button
            type="button"
            onClick={() => onShowModal('Đăng nhập qua Facebook', 'Hệ thống đang tích hợp cổng xác thực Facebook authentication. Dữ liệu sẽ được bảo vệ đa lớp.')}
            className="flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200/90 rounded-xl text-xs font-semibold text-gray-700 shadow-xs hover:shadow-sm active:scale-98 transition-all cursor-pointer"
          >
            {/* Facebook blue icon */}
            <svg className="w-4 h-4 shrink-0 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Facebook
          </button>
        </div>
      </div>
    </motion.div>
  );
}
