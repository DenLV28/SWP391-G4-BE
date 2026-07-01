/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Key, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Mail, Phone, Users, ShieldAlert, Sparkles
} from 'lucide-react';
import { LoginForm, FormErrors } from '../types';
import authService from '../services/authService';

interface LoginViewProps {
  onSuccess: (data: LoginForm) => void;
  onNavigateToRegister: () => void;
  onShowModal: (title: string, content: string) => void;
}

export default function LoginView({ onSuccess, onNavigateToRegister, onShowModal }: LoginViewProps) {
  const [form, setForm] = useState<LoginForm>({
    identifier: '',
    password: '',
    rememberMe: false
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const tempErrors: FormErrors = {};

    if (!form.identifier.trim()) {
      tempErrors.identifier = 'Vui lòng điền số điện thoại hoặc biển số xe của bạn';
    } else if (form.identifier.trim().length < 4) {
      tempErrors.identifier = 'Nhập thông tin hợp lệ (tối thiểu 4 kí tự)';
    }

    if (!form.password) {
      tempErrors.password = 'Vui lòng nhập mật khẩu';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      // Call API to authenticate user from database
      const response = await authService.login({
        identifier: form.identifier,
        password: form.password,
      });

      // Store auth token if needed
      if (form.rememberMe) {
        authService.setAuthToken(JSON.stringify(response.user));
      }

      // Clear form and pass response to parent component
      setErrors({});
      setForm({
        identifier: '',
        password: '',
        rememberMe: false,
      });

      // Call parent's onSuccess with user data
      onSuccess({
        ...form,
        identifier: form.identifier // preserve identifier for display
      });
    } catch (error) {
      // Handle API errors
      const errorMessage = error instanceof Error ? error.message : 'Đăng nhập thất bại';
      setErrors({
        general: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    onShowModal(
      'Khôi phục mật khẩu',
      'Để khôi phục mật khẩu bãi xe ParkFlow của bạn, vui lòng liên hệ với Quản trị viên hệ thống của cơ quan bạn hoặc gửi yêu cầu khôi phục tới email admin@parkflow.vn đính kèm thông tin SĐT và Biển số xe đăng ký.'
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-6xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col lg:flex-row min-h-[620px] border border-gray-100"
    >
      {/* Left side: Premium blue brand block */}
      <div className="lg:w-[42%] bg-park-blue-600 text-white relative flex flex-col justify-between p-10 overflow-hidden shrink-0">
        
        {/* Subtle decorative futuristic gradient bg background */}
        <div className="absolute inset-0 z-0 opacity-40">
          <img 
            src="/src/assets/images/parkflow_bg_1779336618673.png" 
            alt="Futuristic parking login" 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover scale-110 blur-[1px]"
          />
          <div className="absolute inset-0 bg-park-blue-700/80 mix-blend-multiply" />
        </div>

        {/* Top brand header */}
        <div className="relative z-10">
          <div className="font-display font-black text-2xl tracking-tight text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-white text-park-blue-600 flex items-center justify-center text-lg font-black shadow-md">P</span>
            ParkFlow
          </div>
        </div>

        {/* Main hero brand message */}
        <div className="relative z-10 my-auto py-12">
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="space-y-4"
          >
            <h1 className="text-3xl md:text-4xl font-display font-extrabold leading-tight tracking-tight text-white max-w-sm">
              Quản lý bãi xe thông minh & hiệu quả.
            </h1>
            <p className="text-park-blue-100/90 leading-relaxed text-sm md:text-base font-normal max-w-xs md:max-w-md">
              Tối ưu hóa quy trình vận hành, nâng cao trải nghiệm khách hàng và kiểm soát doanh thu thời gian thực.
            </p>
          </motion.div>
        </div>

        {/* Dynamic client social proof */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex items-center gap-4">
          <div className="flex -space-x-3 overflow-hidden">
            <img
              className="inline-block h-9 w-9 rounded-full ring-2 ring-park-blue-600 object-cover"
              src="https://scontent.fsgn2-7.fna.fbcdn.net/v/t39.30808-6/270961679_10159870536636108_2642967668131478092_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeHUDqLygsfHrxdjIIP_oZtFKmwUhI5YCb0qbBSEjlgJvRRVqaW6_PVblr2EVxezLYGFea6eOH1576pRoyBL257J&_nc_ohc=69FrO3xzxbAQ7kNvwHIrpiU&_nc_oc=AdrXrfKdgy4ngEni0NDaVLG0WeCN8lnQNpLWSdBd0WHzbqewifNykpnTvjPTDxd2CL0&_nc_zt=23&_nc_ht=scontent.fsgn2-7.fna&_nc_gid=Z75Ovy8G9pfjMOAIeNl8cQ&_nc_ss=7b2a8&oh=00_Af5FSVoHMkwe1C6TZptvFtdgN-HM8siznbFyI8mbbgsEFg&oe=6A1568D7"
              alt="User"
              referrerPolicy="no-referrer"
            />
            <img
              className="inline-block h-9 w-9 rounded-full ring-2 ring-park-blue-600 object-cover"
              src="https://scontent.fsgn2-11.fna.fbcdn.net/v/t39.30808-6/567161346_10163547366686108_3621299530202515324_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=127cfc&_nc_eui2=AeGtG_-lypn3mxIGzvbq_o5_6i1Yo9IpgTXqLVij0imBNZgUPJPAyXknn8o9Gy9RWbiIPv7IB8mmg6irprX6Txwa&_nc_ohc=UVHjvfZ3heAQ7kNvwGJOOka&_nc_oc=Adr-y54Ewn2Qb6BIB1AEif2ZTA-DuMnCYsOQQ7ZCMx4uYts7ypGs39wtMUvMDhpJurs&_nc_zt=23&_nc_ht=scontent.fsgn2-11.fna&_nc_gid=LXIpQPS4EA-c-Y5bWt0B3A&_nc_ss=7b2a8&oh=00_Af719taxuadvR1SbRlJmzgkN8gt7jBEY1VTVxh7A96nSEQ&oe=6A156103"
              alt="User"
              referrerPolicy="no-referrer"
            />
            <img
              className="inline-block h-9 w-9 rounded-full ring-2 ring-park-blue-600 object-cover"
              src="https://scontent.fsgn2-10.fna.fbcdn.net/v/t1.6435-9/94329636_3027232187315522_8546756478319460352_n.jpg?_nc_cat=109&ccb=1-7&_nc_sid=f727a1&_nc_eui2=AeHweTv1agsWUPtj-b-FL9fgd6u8fwAu9H93q7x_AC70fxFUYF4mcsoBQIjUlxmme93wggblv9OE9-kl0gcihLfp&_nc_ohc=95_FHWoq4LgQ7kNvwHyPGXL&_nc_oc=AdqA-PmCKxGYIhYfPK7UwRvs7lhmtsNs993Ja8FlBS0_oJsek6asuzqpV7PGHSbs270&_nc_zt=23&_nc_ht=scontent.fsgn2-10.fna&_nc_gid=IwWq-WlfQt-Lvkv29DC-Ig&_nc_ss=7b2a8&oh=00_Af55FzM9j87YQi4VV4655nQhukshTwHudRAoiFEyt_7n8g&oe=6A36FAAC"
              alt="User"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="text-xs text-park-blue-50 font-medium">
            <p className="text-white font-bold text-sm">Được tin dùng bởi</p>
            <p className="opacity-90">hơn 500+ doanh nghiệp bãi xe</p>
          </div>
        </div>
      </div>

      {/* Right side: Login form */}
      <div className="flex-1 p-8 md:p-12 lg:p-16 flex flex-col justify-center">
        {/* Headings */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-display font-extrabold text-gray-900 tracking-tight">
            Chào mừng trở lại
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Vui lòng đăng nhập vào tài khoản của bạn để tiếp tục.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* General error message */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">{errors.general}</p>
              </div>
            </div>
          )}
          
          {/* Identifier Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 block">Số điện thoại hoặc Biển số xe</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <span className="text-sm font-semibold select-none">@</span>
              </div>
              <input
                type="text"
                name="identifier"
                value={form.identifier}
                onChange={handleInputChange}
                placeholder="090... hoặc 29A-..."
                className={`w-full pl-9 pr-4 py-3 bg-gray-50/60 hover:bg-gray-50/90 focus:bg-white text-gray-900 text-sm rounded-xl border ${
                  errors.identifier ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200/90 focus:ring-park-blue-100'
                } transition-all focus:outline-hidden focus:ring-4 focus:border-park-blue-500`}
              />
            </div>
            {errors.identifier && <p className="text-xs font-semibold text-rose-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-rose-500 inline-block"></span>{errors.identifier}</p>}
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 block">Mật khẩu</label>
              <a
                href="#forgot-password"
                onClick={handleForgotPassword}
                className="text-xs font-semibold text-park-blue-600 hover:text-park-blue-700 hover:underline transition-colors"
              >
                Quên mật khẩu?
              </a>
            </div>
            <div className="relative col-span-2">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 py-3 bg-gray-50/60 hover:bg-gray-50/90 focus:bg-white text-gray-900 text-sm rounded-xl border ${
                  errors.password ? 'border-rose-400 focus:ring-rose-200' : 'border-gray-200/90 focus:ring-park-blue-100'
                } transition-all focus:outline-hidden focus:ring-4 focus:border-park-blue-500`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
            {errors.password && <p className="text-xs font-semibold text-rose-500 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-rose-500 inline-block"></span>{errors.password}</p>}
          </div>

          {/* Remember me toggle */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-600 select-none">
              <input
                type="checkbox"
                name="rememberMe"
                checked={form.rememberMe}
                onChange={handleInputChange}
                className="rounded-sm border-gray-300 text-park-blue-600 focus:ring-park-blue-500 w-4 h-4 cursor-pointer"
              />
              <span>Ghi nhớ đăng nhập trên thiết bị này</span>
            </label>
          </div>

          {/* Submit button */}
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
                Xác thực thông tin...
              </span>
            ) : (
              <>
                Đăng nhập vào hệ thống <ArrowRight className="w-4.5 h-4.5" />
              </>
            )}
          </button>
        </form>

        {/* Link navigation */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Chưa có tài khoản ParkFlow?{' '}
            <button
              onClick={onNavigateToRegister}
              className="text-park-blue-600 hover:text-park-blue-700 font-bold hover:underline transition-all cursor-pointer"
            >
              Đăng ký ngay
            </button>
          </p>
        </div>

        {/* Divider */}
        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-gray-100"></div>
          <span className="flex-shrink mx-4 text-[10px] font-bold text-gray-400 tracking-wider">HOẶC KẾT NỐI QUA</span>
          <div className="flex-grow border-t border-gray-100"></div>
        </div>

        {/* Social login buttons (Google & Microsoft as shown in Login Form mockup) */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onShowModal('Đăng nhập qua Google', 'Hệ thống đang tích hợp cổng xác thực Google Single-Sign-On cho doanh nghiệp. Tính năng này sẽ sớm hoạt động.')}
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
            onClick={() => onShowModal('Đăng nhập qua Microsoft', 'Hệ thống đang định cấu hình liên kết Microsoft Azure Active Directory (Azure AD/Entra ID) cho các tổ chức.')}
            className="flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200/90 rounded-xl text-xs font-semibold text-gray-700 shadow-xs hover:shadow-sm active:scale-98 transition-all cursor-pointer"
          >
            {/* Microsoft 4-quadrant colored square icon */}
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 23 23">
              <rect x="0" y="0" width="10" height="10" fill="#f25022" />
              <rect x="11" y="0" width="10" height="10" fill="#7fba00" />
              <rect x="0" y="11" width="10" height="10" fill="#00a4ef" />
              <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
            </svg>
            Microsoft
          </button>
        </div>
      </div>
    </motion.div>
  );
}
