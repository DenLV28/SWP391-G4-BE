import { buildApiUrl as buildUrl } from './apiConfig';

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  isActive: boolean;
  assignedParkingLot?: string;
  createdAt: string | null;
}

class UserService {
  async fetchUsers(): Promise<UserRecord[]> {
    const response = await fetch(buildUrl('/api/users'));
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Không thể tải danh sách người dùng');
    }
    return response.json();
  }

  async createUser(payload: {
    fullName: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    password?: string;
    assignedParkingLot?: string;
  }): Promise<UserRecord> {
    const response = await fetch(buildUrl('/api/users'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Không thể tạo người dùng');
    }
    return data.user;
  }

  async updateUser(id: string, payload: {
    fullName?: string;
    email?: string;
    phone?: string;
    role?: string;
    status?: string;
    assignedParkingLot?: string;
  }): Promise<UserRecord> {
    const response = await fetch(buildUrl(`/api/users/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Không thể cập nhật người dùng');
    }
    return data.user;
  }

  async deleteUser(id: string): Promise<void> {
    const response = await fetch(buildUrl(`/api/users/${id}`), {
      method: 'DELETE',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Không thể xóa người dùng');
    }
  }
}

const userService = new UserService();
export default userService;

// ---------------------------------------------------------------------------
// Backward-compatibility shim for the legacy components/DashboardView.tsx
// (kept so the project type-checks; maps the new UserRecord shape to the old).
// ---------------------------------------------------------------------------
export interface ParkingUser {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
}

export async function fetchParkingUsers(): Promise<ParkingUser[]> {
  const records = await userService.fetchUsers();
  return records.map((r) => ({
    user_id: r.id,
    full_name: r.fullName,
    email: r.email,
    phone: r.phone,
    role: r.role,
    active: r.isActive,
  }));
}
