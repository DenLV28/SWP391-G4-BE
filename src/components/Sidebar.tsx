import React from 'react';
import {
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquareWarning,
  ParkingCircle,
  Settings,
  ShieldCheck,
  Ticket,
  UserCircle2,
  Users,
} from 'lucide-react';
import { ParkingSession, User } from '../data/mockData';

export function AdminSidebar({
  currentView,
  setView,
  onLogout,
  user,
}: {
  currentView: string;
  setView: (view: string) => void;
  onLogout: () => void;
  user: User | null;
}) {
  const menuItems = [
    { key: 'admindashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { key: 'usermanagement', label: 'Quản lý người dùng', icon: Users },
    { key: 'rolemanagement', label: 'Quyền và vai trò', icon: ShieldCheck },
    { key: 'systemconfig', label: 'Cấu hình hệ thống', icon: Settings },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col justify-between border-r border-slate-100 bg-white">
      <div className="flex flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-slate-50 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
            <ParkingCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-black tracking-tight text-slate-800">
              Park<span className="text-blue-600">Flow</span>
            </span>
            <span className="block text-[8px] font-bold uppercase leading-none tracking-widest text-slate-400">
              Cổng quản trị
            </span>
          </div>
        </div>

        <nav className="space-y-1 px-4 py-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 border-t border-slate-50 p-4">
        {user && (
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="block max-w-[130px] truncate text-xs font-bold leading-none text-slate-800">
                {user.fullName}
              </span>
              <span className="mt-1 block max-w-[130px] truncate text-[9px] leading-none text-slate-400">
                {user.email}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
        >
          <LogOut className="h-4.5 w-4.5" />
          Đăng xuất khỏi hệ thống
        </button>
      </div>
    </aside>
  );
}

export function DriverSidebar({
  currentView,
  setView,
  onLogout,
  user,
  currentSession,
}: {
  currentView: string;
  setView: (view: string) => void;
  onLogout: () => void;
  user: User | null;
  currentSession: ParkingSession;
}) {
  const menuItems = [
    { key: 'myparking', label: 'Trang của tôi', icon: LayoutDashboard },
    { key: 'session', label: 'Lượt gửi hiện tại', icon: Ticket, badge: currentSession?.sessionStatus === 'Active' },
    { key: 'reservations', label: 'Đặt chỗ của tôi', icon: CalendarClock },
    { key: 'payments', label: 'Thanh toán', icon: CreditCard },
    { key: 'feedback', label: 'Phản hồi / Hỗ trợ', icon: MessageSquareWarning },
    { key: 'profile', label: 'Hồ sơ', icon: UserCircle2 },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col justify-between border-r border-slate-100 bg-white">
      <div className="flex flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-slate-50 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <ParkingCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-sm font-black tracking-tight text-slate-800">
              Park<span className="text-blue-600">Flow</span>
            </span>
            <span className="block text-[8px] font-bold uppercase leading-none tracking-widest text-slate-400">
              Cổng người dùng
            </span>
          </div>
        </div>

        <nav className="space-y-1 px-4 py-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-white' : 'bg-blue-600 animate-ping'}`} />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 border-t border-slate-50 p-4">
        {user && (
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600">
              <UserCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="block max-w-[130px] truncate text-xs font-bold leading-none text-slate-800">
                {user.fullName}
              </span>
              <span className="mt-1 block max-w-[130px] truncate text-[9px] leading-none text-slate-400">
                {user.email}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
        >
          <LogOut className="h-4.5 w-4.5" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
