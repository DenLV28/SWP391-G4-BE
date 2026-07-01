import React from 'react';
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  BarChart3,
  AlertCircle,
  LogOut,
  ParkingCircle,
  ChevronRight,
} from 'lucide-react';
import { User } from '../data/mockData';

interface ManagerSidebarProps {
  currentView: string;
  setView: (view: string) => void;
  onLogout: () => void;
  user: User | null;
}

const menuItems = [
  { key: 'managerdashboard', label: 'Bảng điều khiển', icon: LayoutDashboard },
  { key: 'parkinglots',      label: 'Bãi đỗ xe',       icon: Building2      },
  { key: 'pricing-vehicles', label: 'Giá & Loại xe',   icon: DollarSign     },
  { key: 'reports',          label: 'Báo cáo',          icon: BarChart3      },
  { key: 'exceptions',       label: 'Ngoại lệ',         icon: AlertCircle    },
];

export default function ManagerSidebar({
  currentView,
  setView,
  onLogout,
  user,
}: ManagerSidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-72 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-slate-700 flex flex-col">
      {/* Logo Section */}
      <div className="h-20 flex items-center px-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3 w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
            <ParkingCircle className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold tracking-tight text-white truncate block">
              Park<span className="text-blue-400">Flow</span>
            </span>
            <span className="text-[10px] font-bold uppercase leading-none tracking-widest text-blue-400/70 block">
              Manager
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.key;

          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 group relative overflow-hidden ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300 rounded-r-full" />
              )}

              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>

              {/* Hover arrow */}
              <ChevronRight
                className={`h-4 w-4 flex-shrink-0 transition-transform ${
                  isActive ? 'translate-x-1 opacity-100' : 'translate-x-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-1'
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-slate-700/50 p-4 space-y-4">
        {user && (
          <div className="px-4 py-3 rounded-lg bg-slate-700/30 border border-slate-600/50">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-2">
              Người dùng
            </p>
            <p className="text-sm font-semibold text-white truncate">{user.fullName}</p>
            <p className="text-xs text-slate-400 mt-1">{user.email}</p>
            <p className="text-xs text-blue-400 font-medium mt-2">{user.role}</p>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 hover:text-red-300 font-medium text-sm transition-all duration-200 border border-red-600/20 hover:border-red-600/40"
        >
          <LogOut className="h-5 w-5" />
          <span>Đăng xuất</span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-3 text-center border-t border-slate-700/50">
        <p className="text-xs text-slate-500">Cổng Quản lý v1.0</p>
      </div>
    </aside>
  );
}
