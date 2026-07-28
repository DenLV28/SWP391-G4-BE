/**
 * Authentication Service
 * Handles API communication for login, register, and authentication
 */

import { buildApiUrl as buildUrl, defaultHeaders as getAuthHeaders } from './apiConfig';

export interface LoginCredentials {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    isActive: boolean;
    createdAt: string | null;
    passwordUpdatedAt?: string | null;
  };
}

export interface RegisterCredentials {
  fullName: string;
  email: string;
  phone: string;
  plateNumber: string;
  vehicleType: string;
  brand?: string;
  model?: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    isActive: boolean;
    createdAt: string | null;
    passwordUpdatedAt?: string | null;
  };
}

export interface ApiError {
  error: string;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await fetch(buildUrl('/api/auth/login'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      if (!response.ok) {
        const errorData = data as ApiError;
        throw new Error(errorData.error || 'Đăng nhập thất bại');
      }
      return data as LoginResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Lỗi kết nối đến máy chủ. Vui lòng thử lại sau.');
    }
  }

  async register(credentials: RegisterCredentials): Promise<RegisterResponse> {
    try {
      const response = await fetch(buildUrl('/api/auth/register'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      if (!response.ok) {
        const errorData = data as ApiError;
        throw new Error(errorData.error || 'Đăng ký thất bại');
      }
      return data as RegisterResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Lỗi kết nối đến máy chủ. Vui lòng thử lại sau.');
    }
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  }

  setAuthToken(token: string): void {
    localStorage.setItem('authToken', token);
  }

  getAuthToken(): string | null {
    return localStorage.getItem('authToken');
  }

  clearAuthToken(): void {
    localStorage.removeItem('authToken');
  }
}

export default new AuthService();

// Role policies and helpers (used by the router and staff portal)
import type { Role, User } from '../data/mockData';
import { rolesList } from '../data/mockData';

export const PUBLIC_ROUTES = ['home', 'baixe', 'info', 'slots', 'pricing', 'pricing-detail', 'contact', 'terms', 'privacy', 'help'];

export type RolePolicy = {
  label: string;
  home: string;
  routes: string[];
  permissions: string[];
};

const permissionsFor = (role: Role): string[] =>
  rolesList.find((r) => r.name === role)?.permissions ?? [];

export const ROLE_POLICY: Record<Role, RolePolicy> = {
  'System Administrator': {
    label: 'System Administrator',
    home: 'admindashboard',
    routes: ['admindashboard', 'usermanagement', 'rolemanagement', 'systemconfig'],
    permissions: permissionsFor('System Administrator'),
  },
  'Parking Manager': {
    label: 'Parking Manager',
    home: 'managerdashboard',
    routes: ['managerdashboard', 'parkinglots', 'parkinglotdetail', 'pricing-vehicles', 'reports', 'monthlycards', 'exceptions', 'feedback', 'profile'],
    permissions: permissionsFor('Parking Manager'),
  },
  'Parking Staff': {
    label: 'Parking Staff',
    home: 'staffdashboard',
    routes: ['staffdashboard', 'gatecontrol', 'parkingmonitor', 'activitylog', 'emergency', 'profile'],
    permissions: permissionsFor('Parking Staff'),
  },
  'Parking User / Driver': {
    label: 'Parking User / Driver',
    home: 'myparking',
    routes: ['myparking', 'reservations', 'payments', 'feedback', 'profile', 'vnpay-return'],
    permissions: permissionsFor('Parking User / Driver'),
  },
};

export function getHomeRoute(role: Role): string {
  return ROLE_POLICY[role]?.home ?? 'home';
}

export function getAccessibleRoutes(role: Role): string[] {
  return ROLE_POLICY[role]?.routes ?? [];
}

export function canAccessRoute(role: Role, route: string): boolean {
  if (PUBLIC_ROUTES.includes(route)) return true;
  return getAccessibleRoutes(role).includes(route);
}

export function can(role: Role, permission: string): boolean {
  return (ROLE_POLICY[role]?.permissions ?? []).includes(permission);
}

// ─── user-management permissions ───────────────────────────────────────────
// Mirrors backend/server.js::canManageRole — the backend is the actual
// enforcement point, this copy only drives what the UI shows/hides so the
// two stay in sync. Admin: full manage over every role. Manager: no access —
// "Quản lý người dùng"/"Quyền và vai trò" were removed from the Manager portal.
export function canManageUserRole(actorRole: Role, targetRole: Role): boolean {
  void targetRole;
  return actorRole === 'System Administrator';
}

const ALL_ROLES: Role[] = ['Parking User / Driver', 'Parking Staff', 'Parking Manager', 'System Administrator'];

/** Roles `actorRole` is allowed to create accounts for / reassign users into. */
export function assignableRoles(actorRole: Role): Role[] {
  return ALL_ROLES.filter((r) => canManageUserRole(actorRole, r));
}

export const ALL_PROTECTED_ROUTES: string[] = Object.values(ROLE_POLICY).flatMap((p) => p.routes);

export type LoginResult = {
  ok: boolean;
  user?: User;
  field?: 'email' | 'password';
  error?: string;
};

export function login(email: string, password: string, users: User[]): LoginResult {
  const matched = users.find(
    (u) => u.email.trim().toLowerCase() === email.trim().toLowerCase(),
  );
  if (!matched) {
    return { ok: false, field: 'email', error: 'Không tìm thấy tài khoản nào khớp với email này.' };
  }
  const expected = matched.password || '123456';
  if (password !== expected) {
    return { ok: false, field: 'password', error: 'Mật khẩu bạn nhập không chính xác.' };
  }
  if (matched.status === 'Locked') {
    return { ok: false, field: 'email', error: 'Tài khoản này đã bị khóa. Vui lòng liên hệ hỗ trợ.' };
  }
  if (matched.status === 'Inactive') {
    return { ok: false, field: 'email', error: 'Tài khoản này đang tạm ngưng. Vui lòng kích hoạt để tiếp tục.' };
  }
  return { ok: true, user: matched };
}

export const DEMO_ACCOUNTS: { email: string; password: string; role: Role }[] = [
  { email: 'driver@parking.vn', password: 'driver123', role: 'Parking User / Driver' },
  { email: 'manager@parking.vn', password: 'manager123', role: 'Parking Manager' },
  { email: 'admin@parking.vn', password: 'admin123', role: 'System Administrator' },
  { email: 'staff@parking.vn', password: 'staff123', role: 'Parking Staff' },
];
