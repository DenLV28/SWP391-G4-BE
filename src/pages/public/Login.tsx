import React, { useState } from 'react';
import { ParkingCircle } from 'lucide-react';
import FormInput from '../../components/FormInput';
import authService, { login as mockLogin } from '../../services/authService';

interface LoginPageProps {
  onLogin: (user: any) => void;
  setView: (view: string) => void;
  users?: any[];
}

export default function Login({ onLogin, setView, users = [] }: LoginPageProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const tempErrors: Record<string, string> = {};

    if (!identifier.trim()) {
      tempErrors.identifier = 'Vui lòng nhập email hoặc số điện thoại.';
    }

    if (!password) {
      tempErrors.password = 'Vui lòng nhập mật khẩu.';
    }

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    setIsLoading(true);
    try {
      // Try API login first
      const response = await authService.login({
        identifier: identifier.trim(),
        password: password,
      });

      const user = {
        id: response.user.id,
        fullName: response.user.fullName,
        email: response.user.email,
        phone: response.user.phone,
        role: response.user.role,
        status: response.user.status,
        createdAt: response.user.createdAt || new Date().toISOString(),
      };

      if (user.status !== 'Active') {
        setErrors({ general: 'Tài khoản đã bị khóa hoặc bị vô hiệu hóa.' });
        return;
      }

      onLogin(user as any);
      setIdentifier('');
      setPassword('');
      setErrors({});
    } catch {
      // API unavailable — fall back to local mock data
      const result = mockLogin(identifier.trim(), password, users);
      if (!result.ok || !result.user) {
        setErrors({ general: result.error ?? 'Email/Số điện thoại hoặc mật khẩu không chính xác.' });
        setIsLoading(false);
        return;
      }
      onLogin(result.user);
      setIdentifier('');
      setPassword('');
      setErrors({});
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center py-10 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-100 bg-white p-8 shadow-md">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <ParkingCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Đăng nhập vào ParkFlow</h2>
          <p className="text-xs text-slate-400">Thông tin vai trò và quyền truy cập sẽ được tải từ hệ thống.</p>
        </div>

        {errors.general && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {errors.general}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormInput
            label="Email hoặc Số điện thoại"
            value={identifier}
            onChange={(e: any) => {
              setIdentifier(e.target.value);
              if (errors.identifier) {
                setErrors(prev => ({ ...prev, identifier: undefined }));
              }
            }}
            error={errors.identifier}
            placeholder="Nhập email hoặc số điện thoại"
          />
          <FormInput
            label="Mật khẩu"
            type="password"
            value={password}
            onChange={(e: any) => {
              setPassword(e.target.value);
              if (errors.password) {
                setErrors(prev => ({ ...prev, password: undefined }));
              }
            }}
            error={errors.password}
            placeholder="••••••••"
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
                  Đang xác thực...
                </>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </div>
        </form>

        <div className="text-center text-xs space-y-2 text-slate-500 pt-2">
          <p>
            Chưa có tài khoản?{' '}
            <button onClick={() => setView('register')} className="text-blue-600 font-bold hover:underline">
              Tạo tài khoản
            </button>
          </p>
          <button onClick={() => setView('home')} className="text-xs text-slate-400 hover:text-slate-600 block mx-auto pt-2">
            ← Quay về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
