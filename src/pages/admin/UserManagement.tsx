import React, { useState } from 'react';
import { Edit, Eye, Lock, Plus, Trash2, Unlock, Users, X } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import FormInput from '../../components/FormInput';
import SectionTitle from '../../components/SectionTitle';
import StatusBadge from '../../components/StatusBadge';
import { Role, User, validateEmail, validatePhone, validateRequired } from '../../data/mockData';
import { assignableRoles, canManageUserRole } from '../../services/authService';

// The 3 real ParkFlow parking lots — staff can only be assigned to one of these.
const PARKING_LOT_OPTIONS = ['ParkFlow Quận 9', 'ParkFlow Thủ Đức', 'ParkFlow Long Phước'];

export default function UserManagement({
  users,
  onCreateUser,
  onEditUser,
  onDeleteUser,
  onToggleLockUser,
  activeAdminEmail,
  viewerRole,
}: {
  users: User[];
  onCreateUser: (u: any) => boolean | Promise<boolean>;
  onEditUser: (id: string, u: any) => boolean | Promise<boolean>;
  onDeleteUser: (id: string) => void | Promise<void>;
  onToggleLockUser: (id: string) => void | Promise<void>;
  activeAdminEmail: string;
  /** Role of the account currently viewing this page — governs which rows can be edited/locked/deleted vs. view-only. */
  viewerRole: Role;
}) {
  const editableRoles = assignableRoles(viewerRole);
  // Always allow editing your own row (profile-style edits) even if your role
  // wouldn't normally manage accounts of your own role bucket (e.g. an Admin
  // viewing their own Admin row) — Lock/Delete still separately refuse "self".
  const canManage = (u: User) => u.email === activeAdminEmail || canManageUserRole(viewerRole, u.role);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [formMode, setFormMode] = useState<'List' | 'Create' | 'Edit' | 'View'>('List');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('123456');
  const [role, setRole] = useState<Role>('Parking User / Driver');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Locked'>('Active');
  const [assignedParkingLot, setAssignedParkingLot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenCreate = () => {
    setFormMode('Create');
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('123456');
    setRole('Parking User / Driver');
    setStatus('Active');
    setAssignedParkingLot('');
    setErrors({});
  };

  const handleOpenEdit = (u: User) => {
    setSelectedUser(u);
    setFormMode('Edit');
    setFullName(u.fullName);
    setEmail(u.email);
    setPhone(u.phone);
    setRole(u.role);
    setStatus(u.status);
    setAssignedParkingLot(u.assignedParkingLot || '');
    setErrors({});
  };

  const handleOpenView = (u: User) => {
    setSelectedUser(u);
    setFormMode('View');
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempErrors: Record<string, string> = {};

    const nameErr = validateRequired(fullName, 'Họ và tên');
    if (nameErr) tempErrors.fullName = 'Họ và tên là bắt buộc.';

    const emailErr = validateEmail(email);
    if (emailErr) {
      tempErrors.email = 'Email không hợp lệ.';
    } else {
      const dup = users.some((u) => u.email.trim().toLowerCase() === email.trim().toLowerCase());
      if (dup) tempErrors.email = 'Địa chỉ email này đã tồn tại trong hệ thống.';
    }

    const phoneErr = validatePhone(phone);
    if (phoneErr) tempErrors.phone = 'Số điện thoại không hợp lệ.';

    if (!password) {
      tempErrors.password = 'Mật khẩu là bắt buộc.';
    } else if (password.length < 6) {
      tempErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
    }

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    setErrors({});
    const success = await onCreateUser({ fullName, email, phone, role, status, password, assignedParkingLot });
    if (success) setFormMode('List');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const tempErrors: Record<string, string> = {};

    const nameErr = validateRequired(fullName, 'Họ và tên');
    if (nameErr) tempErrors.fullName = 'Họ và tên là bắt buộc.';

    const emailErr = validateEmail(email);
    if (emailErr) {
      tempErrors.email = 'Email không hợp lệ.';
    } else {
      const dup = users.some((u) => u.id !== selectedUser.id && u.email.trim().toLowerCase() === email.trim().toLowerCase());
      if (dup) tempErrors.email = 'Địa chỉ email này đã tồn tại trong cơ sở dữ liệu người dùng.';
    }

    const phoneErr = validatePhone(phone);
    if (phoneErr) tempErrors.phone = 'Số điện thoại không hợp lệ.';

    if (Object.keys(tempErrors).length > 0) {
      setErrors(tempErrors);
      return;
    }

    setErrors({});
    const success = await onEditUser(selectedUser.id, { fullName, email, phone, role, status, assignedParkingLot });
    if (success) setFormMode('List');
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search);
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <SectionTitle title="Trung tâm quản lý người dùng" subtitle="Quản lý thông tin tài khoản, gán quyền và khóa hoặc mở truy cập." />

      <div className="space-y-4 animate-fadeIn">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:flex-row">
          <input
            type="text"
            placeholder="Tìm theo tên, email hoặc số điện thoại..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-600"
          />
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none"
            >
              <option value="All">Tất cả vai trò</option>
              <option value="Parking User / Driver">Người dùng / tài xế</option>
              <option value="Parking Staff">Nhân viên</option>
              <option value="Parking Manager">Quản lý</option>
              <option value="System Administrator">Quản trị viên</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none"
            >
              <option value="All">Tất cả trạng thái</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Locked">Locked</option>
            </select>
            <button
              onClick={handleOpenCreate}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              <span>Thêm người dùng</span>
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                  <th className="p-4">Hồ sơ người dùng</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Vai trò</th>
                  <th className="p-4">Bãi xe phụ trách</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {filtered.map((u) => (
                  <tr key={u.id} className="transition hover:bg-slate-50/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-bold uppercase text-slate-700">
                          {u.fullName.charAt(0)}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-800">{u.fullName}</span>
                          <span className="block text-[10px] text-slate-400">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{u.phone}</td>
                    <td className="p-4 font-semibold">{roleLabel(u.role)}</td>
                    <td className="p-4">
                      {u.role === 'Parking Staff' && u.assignedParkingLot ? (
                        <span className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">{u.assignedParkingLot}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="whitespace-nowrap p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenView(u)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" title="Xem chi tiết">
                          <Eye className="h-4 w-4" />
                        </button>
                        {!canManage(u) ? (
                          <span className="rounded-lg px-2 py-1 text-[10px] font-semibold uppercase text-slate-300" title="Bạn chỉ có quyền xem tài khoản này.">
                            Chỉ xem
                          </span>
                        ) : (
                          <>
                            <button onClick={() => handleOpenEdit(u)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" title="Sửa người dùng">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (u.email === activeAdminEmail) {
                                  alert('Bạn không thể tự khóa tài khoản đang đăng nhập của chính mình.');
                                  return;
                                }
                                onToggleLockUser(u.id);
                              }}
                              className={`rounded-lg p-1.5 transition ${u.status === 'Locked' ? 'text-emerald-500 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}`}
                              title={u.status === 'Locked' ? 'Mở khóa người dùng' : 'Khóa người dùng'}
                            >
                              {u.status === 'Locked' ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => {
                                if (u.email === activeAdminEmail) {
                                  alert('Bạn không thể tự xóa tài khoản đang đăng nhập của chính mình.');
                                  return;
                                }
                                setDeleteConfirmId(u.id);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa người dùng"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <EmptyState icon={Users} title="Không có hồ sơ phù hợp." description="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc." />
          )}
        </div>
      </div>

      {formMode === 'View' && selectedUser && (
        <ModalShell onClose={() => setFormMode('List')} title={`Thông tin tài khoản: ${selectedUser.fullName}`}>
          <div className="grid gap-4 text-xs sm:grid-cols-2">
            <InfoTile label="Mã người dùng" value={selectedUser.id} />
            <InfoTile label="Địa chỉ email" value={selectedUser.email} />
            <InfoTile label="Số điện thoại" value={selectedUser.phone} />
            <InfoTile label="Vai trò" value={roleLabel(selectedUser.role)} />
            <div className="rounded-xl bg-slate-50 p-3">
              <span className="block font-semibold text-slate-400">Trạng thái bảo mật</span>
              <span className="mt-1 block"><StatusBadge status={selectedUser.status} /></span>
            </div>
            <InfoTile label="Ngày tạo" value={selectedUser.createdAt} />
            {selectedUser.role === 'Parking Staff' && (
              <div className="sm:col-span-2">
                <InfoTile label="Bãi xe phụ trách" value={selectedUser.assignedParkingLot || '(Chưa gán)'} />
              </div>
            )}
          </div>
          <div className="pt-2 text-right">
            <button onClick={() => setFormMode('List')} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
              Đóng
            </button>
          </div>
        </ModalShell>
      )}

      {formMode === 'Edit' && selectedUser && (
        <ModalShell onClose={() => setFormMode('List')} title="Sửa tài khoản người dùng">
          <form className="space-y-4 text-xs" onSubmit={handleEditSubmit}>
            <FormInput label="Họ và tên" value={fullName} onChange={(e: any) => setFullName(e.target.value)} error={errors.fullName} />
            <FormInput label="Địa chỉ email" value={email} onChange={(e: any) => setEmail(e.target.value)} error={errors.email} />
            <FormInput label="Số điện thoại" value={phone} onChange={(e: any) => setPhone(e.target.value)} error={errors.phone} />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Vai trò</label>
                <select
                  value={role}
                  disabled={selectedUser.email === activeAdminEmail}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {/* Always include the account's current role even if it falls outside what the
                      viewer can newly assign (e.g. an Admin viewing their own Admin row, disabled
                      above) — otherwise the browser silently falls back to showing another option. */}
                  {(editableRoles.includes(selectedUser.role) ? editableRoles : [selectedUser.role, ...editableRoles]).map((r) => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Trạng thái</label>
                <select
                  value={status}
                  disabled={selectedUser.email === activeAdminEmail}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Locked">Locked</option>
                </select>
              </div>
            </div>

            {role === 'Parking Staff' && (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Bãi xe phụ trách</label>
                <select
                  value={assignedParkingLot}
                  onChange={(e) => setAssignedParkingLot(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-300"
                >
                  <option value="">— Chọn bãi xe —</option>
                  {PARKING_LOT_OPTIONS.map((lot) => (
                    <option key={lot} value={lot}>{lot}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFormMode('List')} className="rounded-lg border border-slate-200 px-4 py-2 font-bold text-slate-600 transition hover:bg-slate-50">
                Hủy
              </button>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white transition hover:bg-indigo-500">
                Cập nhật tài khoản
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {formMode === 'Create' && (
        <ModalShell onClose={() => setFormMode('List')} title="Tạo tài khoản mới">
          <form className="space-y-4 text-xs" onSubmit={handleCreateSubmit}>
            <FormInput label="Họ và tên" value={fullName} onChange={(e: any) => setFullName(e.target.value)} error={errors.fullName} placeholder="Nguyễn Văn A" />
            <FormInput label="Địa chỉ email" value={email} onChange={(e: any) => setEmail(e.target.value)} error={errors.email} placeholder="nguyenvana@example.com" />
            <FormInput label="Số điện thoại" value={phone} onChange={(e: any) => setPhone(e.target.value)} error={errors.phone} placeholder="0901234567" />
            <FormInput label="Mật khẩu" type="password" value={password} onChange={(e: any) => setPassword(e.target.value)} error={errors.password} placeholder="••••••••" />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Vai trò hệ thống</label>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 outline-none">
                  {editableRoles.map((r) => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Trạng thái</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 outline-none">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Locked">Locked</option>
                </select>
              </div>
            </div>

            {role === 'Parking Staff' && (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Bãi xe phụ trách</label>
                <select
                  value={assignedParkingLot}
                  onChange={(e) => setAssignedParkingLot(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 outline-none focus:ring-1 focus:ring-indigo-300"
                >
                  <option value="">— Chọn bãi xe —</option>
                  {PARKING_LOT_OPTIONS.map((lot) => (
                    <option key={lot} value={lot}>{lot}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setFormMode('List')} className="rounded-lg border border-slate-200 px-4 py-2 font-bold text-slate-600 transition hover:bg-slate-50">
                Hủy
              </button>
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white transition hover:bg-indigo-500">
                Tạo tài khoản
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteConfirmId)}
        title="Xóa tài khoản người dùng"
        message="Thao tác này không thể hoàn tác. Bạn có chắc muốn xóa tài khoản này không?"
        onConfirm={() => {
          if (deleteConfirmId) {
            onDeleteUser(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}

function roleLabel(role: Role) {
  switch (role) {
    case 'Parking User / Driver':
      return 'Người dùng / tài xế';
    case 'Parking Staff':
      return 'Nhân viên';
    case 'Parking Manager':
      return 'Quản lý';
    case 'System Administrator':
      return 'Quản trị viên';
    default:
      return role;
  }
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <span className="block font-semibold text-slate-400">{label}</span>
      <span className="mt-1 block font-bold text-slate-800">{value}</span>
    </div>
  );
}
