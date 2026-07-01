import React, { useState } from 'react';
import { Role, User, rolesList } from '../../data/mockData';
import SectionTitle from '../../components/SectionTitle';

export default function RoleManagement({
  users,
  onAssignRole,
  activeAdminEmail,
}: {
  users: User[];
  onAssignRole: (userId: string, newRole: Role) => void;
  activeAdminEmail: string;
}) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<Role>('Parking Staff');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      alert('Vui lòng chọn một tài khoản người dùng.');
      return;
    }

    const targetUser = users.find((user) => user.id === userId);
    if (targetUser && targetUser.email === activeAdminEmail && role !== 'System Administrator') {
      alert('Bạn không thể tự giảm quyền quản trị của chính mình.');
      return;
    }

    onAssignRole(userId, role);
    setUserId('');
    alert('Đã cập nhật vai trò người dùng.');
  };

  const filteredUsers = users.filter(
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
              const count = users.filter((user) => user.role === item.name).length;
              return (
                <div key={item.id} className="space-y-2 rounded-xl border border-slate-100 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800">{roleLabel(item.name as Role)}</h4>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">{count} người dùng</span>
                  </div>
                  <p className="font-medium italic text-slate-400">{roleDescription(item.name as Role)}</p>
                  <div className="flex flex-wrap gap-1 pt-2">
                    {item.permissions.map((permission, index) => (
                      <span key={index} className="text-nowrap rounded border border-slate-100 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                        {permissionLabel(permission)}
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
                <option value="Parking User / Driver">Người dùng / tài xế</option>
                <option value="Parking Staff">Nhân viên bãi xe</option>
                <option value="Parking Manager">Quản lý bãi xe</option>
                <option value="System Administrator">Quản trị hệ thống</option>
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
