import React, { useEffect, useRef, useState } from 'react';
import { Bell, UserRound, Wallet, User as UserIcon, LogOut } from 'lucide-react';
import { User } from '../data/mockData';

export type BellNotification = {
  id: string;
  type: 'reservation' | 'feedback';
  title: string;
  body: string;
  targetView: string;
};

export default function PublicNavbar({
  currentView,
  setView,
  user,
  onLogout,
  brandLabel,
  notificationCount = 0,
  onClearNotifications,
  bellNotifications = [],
}: {
  currentView: string;
  setView: (view: string) => void;
  user: User | null;
  onLogout: () => void;
  brandLabel?: string;
  notificationCount?: number;
  onClearNotifications?: () => void;
  bellNotifications?: BellNotification[];
}) {
  const isDriverUser = user?.role === 'Parking User / Driver';
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const tabs = [
    { key: 'home', label: 'Trang chủ' },
    { key: 'baixe', label: 'Bãi xe' },
    { key: 'slots', label: 'Đặt chỗ' },
    { key: 'contact', label: 'Liên hệ' },
    { key: 'info', label: 'Giới thiệu' },
    ...(isDriverUser ? [{ key: 'myparking', label: 'My Parking' }] : []),
  ];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBellToggle = () => {
    if (!bellOpen) onClearNotifications?.();
    setBellOpen((o) => !o);
  };

  return (
    <nav className="public-nav sticky top-0 z-30 w-full border-b backdrop-blur">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-[56px] items-center justify-between sm:h-[60px]">
          <button
            type="button"
            onClick={() => (isDriverUser ? setView('myparking') : setView('home'))}
            className="flex items-center text-left"
          >
            <span className="text-[22px] font-extrabold tracking-tight text-[#1a56db]">
              {brandLabel ?? 'ParkFlow'}
            </span>
          </button>

          <div className="hidden items-center gap-8 md:flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`pb-1 text-[15px] font-medium transition ${
                  currentView === tab.key
                    ? 'border-b-2 border-[#1a56db] text-[#1a56db]'
                    : 'text-slate-600 hover:text-[#1a56db]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Bell notification */}
                <div className="relative" ref={bellRef}>
                  <button
                    type="button"
                    aria-label="Thông báo"
                    onClick={handleBellToggle}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-50 hover:text-[#1a56db]"
                  >
                    <Bell className="h-5 w-5" />
                    {notificationCount > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </span>
                    ) : (
                      <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                    )}
                  </button>

                  {bellOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-100 bg-white shadow-xl z-50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thông báo</h4>
                        {bellNotifications.length > 0 && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-600">
                            {bellNotifications.length} mới
                          </span>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                        {bellNotifications.length > 0 ? (
                          bellNotifications.map((n) => (
                            <div
                              key={n.id}
                              className="px-4 py-3 hover:bg-slate-50 cursor-pointer"
                              onClick={() => { setBellOpen(false); setView(n.targetView); }}
                            >
                              <p className={`text-[10px] font-bold uppercase ${n.type === 'reservation' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                {n.title}
                              </p>
                              <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">{n.body}</p>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-8 text-center">
                            <p className="text-xs text-slate-400">Không có thông báo mới</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    aria-label="Tài khoản"
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2d78e5] text-white shadow-[0_8px_16px_rgba(45,120,229,0.24)] transition hover:bg-[#2568cb]"
                  >
                    <UserRound className="h-4.5 w-4.5" />
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 top-11 z-50 w-44 rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl">
                      <div className="border-b border-slate-50 px-4 py-2.5">
                        <p className="text-[11px] font-bold text-slate-800 truncate">{user.fullName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => { setShowUserMenu(false); setView('payments'); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50"
                      >
                        <Wallet className="h-4 w-4 text-slate-400" />
                        Ví tiền
                      </button>
                      <button
                        onClick={() => { setShowUserMenu(false); setView('profile'); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50"
                      >
                        <UserIcon className="h-4 w-4 text-slate-400" />
                        Hồ sơ
                      </button>
                      <div className="border-t border-slate-50 mt-1">
                        <button
                          onClick={() => { setShowUserMenu(false); onLogout(); }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[13px] font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Đăng xuất
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setView('login')}
                  className="text-[15px] font-medium text-[#1a56db] transition hover:text-blue-800"
                >
                  Đăng nhập
                </button>
                <button
                  onClick={() => setView('register')}
                  className="text-[15px] font-medium text-slate-700 transition hover:text-[#1a56db]"
                >
                  Đăng ký
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
