import React, { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, UserCircle2, Zap } from 'lucide-react';
import { ParkingSession, User } from '../data/mockData';

export default function Topbar({
  user,
  title,
  currentSession,
  onLogout,
}: {
  user: User;
  title: string;
  currentSession?: ParkingSession;
  onLogout?: () => void;
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const initials = user.fullName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(-2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-100 bg-white/90 px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-black tracking-tight text-slate-800">{title}</h2>
        {currentSession && currentSession.sessionStatus === 'Active' && (
          <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800 animate-pulse">
            <Zap className="h-3 w-3 fill-amber-500 text-amber-500" />
            Lượt gửi đang hoạt động: {currentSession.ticketCode}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button className="relative rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600">
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>

        <div className="h-7 w-[1px] bg-slate-100" />

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition"
            title={user.fullName}
          >
            {initials}
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-100 bg-white shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-800 truncate">{user.fullName}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                <span className="mt-0.5 inline-block text-[9px] font-bold uppercase text-blue-600">Quản trị viên</span>
              </div>
              <button
                onClick={() => setUserMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                <UserCircle2 className="h-4 w-4 text-slate-400" />
                Hồ sơ
              </button>
              {onLogout && (
                <button
                  onClick={() => { setUserMenuOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
