import { buildApiUrl as buildUrl } from './apiConfig';
import type { Role } from '../data/mockData';

export interface RoleDefinitionRecord {
  roleKey: string;
  description: string;
  permissions: string[];
  updatedAt: string | null;
  updatedBy: string;
}

// Mirrors backend/server.js::normalizeRoleForStorage — the 4 fixed roles map
// 1:1 to short DB keys ('user'/'staff'/'manager'/'admin').
const ROLE_KEY_BY_ROLE: Record<Role, string> = {
  'Parking User / Driver': 'user',
  'Parking Staff': 'staff',
  'Parking Manager': 'manager',
  'System Administrator': 'admin',
};

export function roleKeyOf(role: Role): string {
  return ROLE_KEY_BY_ROLE[role];
}

class RoleDefinitionService {
  async fetchRoleDefinitions(): Promise<RoleDefinitionRecord[]> {
    const response = await fetch(buildUrl('/api/role-definitions'));
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Không thể tải định nghĩa vai trò');
    }
    return response.json();
  }

  async updateRoleDefinition(
    role: Role,
    payload: { description: string; permissions: string[]; actorId?: string },
  ): Promise<RoleDefinitionRecord> {
    const response = await fetch(buildUrl(`/api/role-definitions/${roleKeyOf(role)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Không thể cập nhật định nghĩa vai trò');
    }
    return data;
  }
}

const roleDefinitionService = new RoleDefinitionService();
export default roleDefinitionService;
