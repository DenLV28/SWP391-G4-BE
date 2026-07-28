import React, { useEffect, useState } from 'react';
import { Pencil, X as XIcon } from 'lucide-react';
import { Role, User, rolesList } from '../../data/mockData';
import SectionTitle from '../../components/SectionTitle';
import { assignableRoles, canManageUserRole } from '../../services/authService';
import roleDefinitionService, { roleKeyOf, type RoleDefinitionRecord } from '../../services/roleDefinitionService';

export default function RoleManagement({
  users,
  onAssignRole,
  activeAdminEmail,
  viewerRole,
  viewerId,
}: {
  users: User[];
  onAssignRole: (userId: string, newRole: Role) => boolean | Promise<boolean>;
  activeAdminEmail: string;
  /** Role of the account currently viewing this page — governs which users/roles can be assigned. */
  viewerRole: Role;
  /** id of the logged-in viewer — only needed so Admin edits to role definitions can be attributed/authorized. */
  viewerId?: string;
}) {
  const assignable = assignableRoles(viewerRole);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Role>(assignable[0] ?? 'Parking Staff');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // ── Định nghĩa vai trò — Admin có thể sửa mô tả + danh sách quyền, lưu ──
  // thật vào DB (dbo.role_definitions).
  const canEditDefinitions = viewerRole === 'System Administrator';
  const [definitions, setDefinitions] = useState<Record<string, RoleDefinitionRecord>>({});
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [newPermissionInput, setNewPermissionInput] = useState('');
  const [savingDefinition, setSavingDefinition] = useState(false);

  useEffect(() => {
    roleDefinitionService
      .fetchRoleDefinitions()
      .then((defs) => {
        const map: Record<string, RoleDefinitionRecord> = {};
        defs.forEach((d) => { map[d.roleKey] = d; });
        setDefinitions(map);
      })
      .catch(() => {
        // Backend không sẵn sàng — giữ nội dung mặc định (roleDescription/permissionLabel) bên dưới.
      });
  }, []);

  const descriptionFor = (r: Role) => definitions[roleKeyOf(r)]?.description ?? roleDescription(r);
  const permissionsFor = (r: Role, fallbackPermissions: string[]) =>
    definitions[roleKeyOf(r)]?.permissions ?? fallbackPermissions.map(permissionLabel);

  const handleStartEditDefinition = (r: Role, fallbackPermissions: string[]) => {
    setEditingRole(r);
    setEditDescription(descriptionFor(r));
    setEditPermissions([...permissionsFor(r, fallbackPermissions)]);
    setNewPermissionInput('');
  };

  const handleCancelEditDefinition = () => {
    setEditingRole(null);
    setNewPermissionInput('');
  };

  const handleAddPermissionTag = () => {
    const value = newPermissionInput.trim();
    if (!value || editPermissions.includes(value)) {
      setNewPermissionInput('');
      return;
    }
    setEditPermissions((prev) => [...prev, value]);
    setNewPermissionInput('');
  };

  const handleRemovePermissionTag = (index: number) => {
    setEditPermissions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDefinition = async (r: Role) => {
    if (!editDescription.trim()) {
      alert('Mô tả vai trò không được để trống.');
      return;
    }
    setSavingDefinition(true);
    try {
      const updated = await roleDefinitionService.updateRoleDefinition(r, {
        description: editDescription.trim(),
        permissions: editPermissions,
        actorId: viewerId,
      });
      setDefinitions((prev) => ({ ...prev, [updated.roleKey]: updated }));
      setEditingRole(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không thể cập nhật định nghĩa vai trò.');
    } finally {
      setSavingDefinition(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      alert('Vui lòng chọn một tài khoản người dùng.');
      return;
    }

    const targetUser = users.find((user) => user.id === userId);
    if (targetUser && targetUser.email === activeAdminEmail && role !== targetUser.role) {
      alert('Bạn không thể tự thay đổi vai trò của chính mình.');
      return;
    }
    if (targetUser && !canManageUserRole(viewerRole, targetUser.role)) {
      alert('Bạn không có quyền chỉnh sửa vai trò của tài khoản này.');
      return;
    }

    const ok = await onAssignRole(userId, role);
    if (ok) {
      setUserId('');
      alert('Đã cập nhật vai trò người dùng.');
    }
  };

  // Chỉ hiện những tài khoản mà viewer thực sự có quyền gán lại vai trò.
  const filteredUsers = users
    .filter((user) => canManageUserRole(viewerRole, user.role))
    .filter(
      (user) => user.fullName.toLowerCase().includes(userSearch.toLowerCase()) || user.email.toLowerCase().includes(userSearch.toLowerCase())
    );

  return (
    <div className="space-y-6">
      <SectionTitle title="Quản lý quyền và vai trò" subtitle="Xem danh sách vai trò, quyền hạn và cập nhật cấp truy cập cho người dùng." />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Định nghĩa vai trò</h3>
          <div className="space-y-4">
            {rolesList.map((item) => {
              const roleValue = item.name as Role;
              const count = users.filter((user) => user.role === roleValue).length;
              const isEditing = editingRole === roleValue;

              if (isEditing) {
                return (
                  <div key={item.id} className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-800">{roleLabel(roleValue)}</h4>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">{count} người dùng</span>
                    </div>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="Mô tả vai trò..."
                    />
                    <div className="flex flex-wrap gap-1 pt-1">
                      {editPermissions.map((permission, index) => (
                        <span key={index} className="flex items-center gap-1 text-nowrap rounded border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                          {permission}
                          <button type="button" onClick={() => handleRemovePermissionTag(index)} className="text-slate-400 hover:text-rose-600">
                            <XIcon className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="text"
                        value={newPermissionInput}
                        onChange={(e) => setNewPermissionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleAddPermissionTag(); }
                        }}
                        placeholder="Thêm quyền mới..."
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                      <button type="button" onClick={handleAddPermissionTag} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                        Thêm
                      </button>
                    </div>
                    <div className="flex justify-end gap-2 pt-1.5">
                      <button
                        type="button"
                        onClick={handleCancelEditDefinition}
                        disabled={savingDefinition}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveDefinition(roleValue)}
                        disabled={savingDefinition}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {savingDefinition ? 'Đang lưu...' : 'Lưu'}
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={item.id} className="space-y-2 rounded-xl border border-slate-100 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800">{roleLabel(roleValue)}</h4>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">{count} người dùng</span>
                      {canEditDefinitions && (
                        <button
                          type="button"
                          onClick={() => handleStartEditDefinition(roleValue, item.permissions)}
                          className="rounded-lg p-1 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                          title="Sửa định nghĩa vai trò"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="font-medium italic text-slate-400">{descriptionFor(roleValue)}</p>
                  <div className="flex flex-wrap gap-1 pt-2">
                    {permissionsFor(roleValue, item.permissions).map((permission, index) => (
                      <span key={index} className="text-nowrap rounded border border-slate-100 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/25 p-6 shadow-sm">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Gán cấp quyền</h3>
            <p className="text-xs leading-relaxed text-slate-500">
              Chọn một tài khoản người dùng rồi cập nhật vai trò của họ trong hệ thống.
            </p>
          </div>

          <form className="space-y-4 pt-4 text-xs" onSubmit={handleAssign}>
            <div className="relative">
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Chọn tài khoản</label>
              <div
                className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-2.5"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={`font-semibold ${userId ? 'text-slate-800' : 'text-slate-400'}`}>
                  {userId
                    ? (() => {
                        const selectedUser = users.find((user) => user.id === userId);
                        return selectedUser ? `${selectedUser.fullName} (${roleLabel(selectedUser.role)})` : '-- Chọn tài khoản --';
                      })()
                    : '-- Chọn tài khoản --'}
                </span>
                <span className="text-xs text-slate-400">▼</span>
              </div>

              {isDropdownOpen && (
                <div className="absolute z-10 mt-1 flex max-h-64 w-full flex-col space-y-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Tìm theo tên hoặc email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full shrink-0 rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <div className="flex-1 space-y-1 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => {
                          setUserId(user.id);
                          setRole(user.role);
                          setIsDropdownOpen(false);
                          setUserSearch('');
                        }}
                        className={`cursor-pointer rounded-lg p-2 text-xs font-semibold transition hover:bg-indigo-50 ${userId === user.id ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span>{user.fullName}</span>
                          <span className="text-[10px] font-normal text-slate-400">{roleLabel(user.role)}</span>
                        </div>
                      </div>
                    ))}
                    {filteredUsers.length === 0 && <div className="p-3 text-center text-xs text-slate-400">Không tìm thấy hồ sơ</div>}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Vai trò mới</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-semibold text-slate-700 outline-none"
              >
                {assignable.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="w-full rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500">
              Gán vai trò
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: Role) {
  switch (role) {
    case 'Parking User / Driver':
      return 'Người dùng / tài xế';
    case 'Parking Staff':
      return 'Nhân viên bãi xe';
    case 'Parking Manager':
      return 'Quản lý bãi xe';
    case 'System Administrator':
      return 'Quản trị hệ thống';
    default:
      return role;
  }
}

function roleDescription(role: Role) {
  switch (role) {
    case 'Parking User / Driver':
      return 'Chỉ có quyền gửi xe, đặt chỗ và thanh toán.';
    case 'Parking Staff':
      return 'Phụ trách kiểm soát làn, hỗ trợ check-in và xử lý tại bãi.';
    case 'Parking Manager':
      return 'Theo dõi vận hành, phê duyệt và kiểm soát cấu hình bãi xe.';
    case 'System Administrator':
      return 'Toàn quyền quản trị người dùng, hệ thống và cấu hình.';
    default:
      return role;
  }
}

function permissionLabel(permission: string) {
  const map: Record<string, string> = {
    'View parking information': 'Xem thông tin bãi đỗ',
    'View available slots': 'Xem chỗ trống',
    'Create reservation': 'Tạo đặt chỗ',
    'View own parking session': 'Xem lượt gửi hiện tại',
    'Make payment': 'Thanh toán',
    'Submit feedback': 'Gửi phản hồi',
    'Manage own profile': 'Quản lý hồ sơ cá nhân',
    'Create parking session': 'Tạo lượt gửi xe',
    'Process vehicle entry': 'Xử lý xe vào',
    'Process vehicle exit': 'Xử lý xe ra',
    'Update slot status': 'Cập nhật trạng thái chỗ',
    'Handle lost ticket': 'Xử lý mất vé',
    'Manage parking building': 'Quản lý bãi đỗ',
    'Manage floors and slots': 'Quản lý tầng và chỗ đỗ',
    'Manage pricing rules': 'Quản lý bảng giá',
    'View reports': 'Xem báo cáo',
    'Manage parking policies': 'Quản lý chính sách',
    'Manage users': 'Quản lý người dùng',
    'Manage roles': 'Quản lý vai trò',
    'Manage system configuration': 'Quản lý cấu hình hệ thống',
  };
  return map[permission] ?? permission;
}
