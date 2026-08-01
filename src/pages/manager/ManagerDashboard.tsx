import { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart3, AlertCircle, Bell, LayoutDashboard, DollarSign, LogOut, UserCircle2, Building2, MessageCircle, MessageSquare, TrendingUp, Calendar, Car, Bike, Zap, LayoutGrid, List, ChevronDown, Wrench, X } from 'lucide-react';
import { User, Slot, Reservation, Payment, PricingRule, Floor, Area, Feedback, SlotIssue } from '../../data/mockData';
import type { EmergencyLog } from '../../types/staff';
import ParkingFloorMap, { type MapSlot } from '../../components/ParkingFloorMap';
import PaymentWalletCard from '../../components/PaymentWalletCard';
import StaffManagerChat from '../../components/StaffManagerChat';
import RoleProfilePage from '../../components/RoleProfilePage';
import { formatCurrency, localDateISO } from '../../utils/helpers';
import { lotKeyOrDefault, type LotKey, type ParkingLotInfo } from '../../utils/parkingLots';
import type { LotStatus } from '../../services/parkingLotService';
import ManagerParkingLots from './ManagerParkingLots';
import ManagerParkingLotDetail, { type LotDetailInfo } from './ManagerParkingLotDetail';
import ManagerPricingVehicles from './ManagerPricingVehicles';
import ManagerReports from './ManagerReports';
import ManagerExceptions from './ManagerExceptions';
import ManagerFeedback from './ManagerFeedback';
import ManagerMonthlyCards from './ManagerMonthlyCards';

interface ManagerDashboardProps {
  slots: Slot[];
  payments: Payment[];
  reservations: Reservation[];
  users: User[];
  pricingRules?: PricingRule[];
  feedbacks?: Feedback[];
  issues?: SlotIssue[];
  setView: (view: string) => void;
  currentView?: string;
  floors?: Floor[];
  areas?: Area[];
  currentUser?: User;
  onLogout?: () => void;
  emergencyLogs?: EmergencyLog[];
  onApproveIssue?: (id: string) => void;
  onRejectIssue?: (id: string) => void;
  onRestoreIssue?: (id: string) => void;
  onForceClearSlot?: (slotCode: string, reason: string) => Promise<boolean>;
  onRespondFeedback?: (id: string, response: string, status: Feedback['status']) => void;
  addToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onUpdateUser?: (up: Partial<User>) => Promise<{ ok: boolean; error?: string }>;
  onAssignStaff?: (userId: string, lotName: string) => Promise<boolean>;
  lotStatuses?: ParkingLotInfo[];
  onUpdateLotStatus?: (name: string, status: LotStatus) => Promise<boolean>;
}

export default function ManagerDashboard({
  slots: allSlots,
  payments,
  reservations: allReservations,
  users,
  pricingRules = [],
  feedbacks = [],
  issues = [],
  setView,
  currentView = 'managerdashboard',
  floors = [],
  areas = [],
  currentUser,
  onLogout,
  emergencyLogs = [],
  onApproveIssue,
  onRejectIssue,
  onRestoreIssue,
  onForceClearSlot,
  onRespondFeedback,
  addToast,
  onUpdateUser,
  onAssignStaff,
  lotStatuses = [],
  onUpdateLotStatus,
}: ManagerDashboardProps) {
  // Không còn bộ chọn bãi ở header — Tổng quan luôn gộp dữ liệu cả 3 bãi;
  // sơ đồ bãi đỗ (không gộp được, mỗi bãi trùng mã ô A01...) có bộ chọn riêng
  // của chính nó bên trong DashboardContent.
  const slots = allSlots;
  const reservations = allReservations;

  // Bãi đang mở trang "Xem chi tiết" — do ManagerParkingLots đặt khi bấm nút
  const [detailLot, setDetailLot] = useState<LotDetailInfo | null>(null);

  const [bellOpen, setBellOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const prevIssuesRef = useRef(issues);
  const [issueAlert, setIssueAlert] = useState<SlotIssue | null>(null);

  const managerInitials = (currentUser?.fullName ?? 'M')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(-2)
    .join('')
    .toUpperCase();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!['managerdashboard', 'parkinglots', 'parkinglotdetail', 'pricing-vehicles', 'reports', 'monthlycards', 'exceptions', 'feedback', 'profile'].includes(currentView)) {
      setView('managerdashboard');
    }
  }, [currentView, setView]);

  // Detect new Pending issues → show popup
  useEffect(() => {
    const prev = prevIssuesRef.current;
    const newIssues = issues.filter(
      (i) => i.status === 'Pending' && !prev.find((p) => p.id === i.id),
    );
    if (newIssues.length > 0) setIssueAlert(newIssues[0]);
    prevIssuesRef.current = issues;
  }, [issues]);

  const menuItems = [
    { key: 'managerdashboard', label: 'Tổng quan',          icon: LayoutDashboard },
    { key: 'parkinglots',      label: 'Quản lý Bãi xe',     icon: Building2       },
    { key: 'pricing-vehicles', label: 'Bảng giá & Loại xe', icon: DollarSign      },
    { key: 'reports',          label: 'Báo cáo',             icon: BarChart3       },
    { key: 'monthlycards',     label: 'Xe Thẻ tháng',       icon: Calendar        },
    { key: 'exceptions',       label: 'Xử lý Ngoại lệ',     icon: AlertCircle, badge: issues.filter(i => i.status === 'Pending').length },
    { key: 'feedback',         label: 'Phản hồi Người dùng', icon: MessageSquare, badge: feedbacks.filter(f => f.status === 'New').length },
  ];

  const handleMenuClick = (menuKey: string) => {
    setView(menuKey);
  };

  const pendingIssueCount = issues.filter((i) => i.status === 'Pending').length;

  const renderContent = () => {
    switch (currentView) {
      case 'parkinglots':
        // Trang danh sách bãi hiển thị cả 3 bãi → dùng allSlots (không theo bộ lọc bãi)
        return <ManagerParkingLots floors={floors} areas={areas} slots={allSlots} users={users} setView={setView} onAssignStaff={onAssignStaff} onViewDetail={setDetailLot} lotStatuses={lotStatuses} onUpdateLotStatus={onUpdateLotStatus} />;
      case 'parkinglotdetail':
        return <ManagerParkingLotDetail setView={setView} lot={detailLot} slots={allSlots} />;
      case 'pricing-vehicles':
        return <ManagerPricingVehicles setView={setView} />;
      case 'reports':
        // Báo cáo có bộ lọc bãi + thời gian riêng — nhận dữ liệu toàn hệ thống
        return <ManagerReports payments={payments} reservations={allReservations} parkingLots={lotStatuses} />;
      case 'monthlycards':
        return <ManagerMonthlyCards reservations={reservations} users={users} />;
      case 'exceptions':
        return (
          <ManagerExceptions
            setView={setView}
            emergencyLogs={emergencyLogs}
            issues={issues}
            onApproveIssue={onApproveIssue}
            onRejectIssue={onRejectIssue}
            onRestoreIssue={onRestoreIssue}
          />
        );
      case 'feedback':
        return (
          <ManagerFeedback
            feedbacks={feedbacks}
            onRespondFeedback={onRespondFeedback}
            addToast={addToast}
          />
        );
      case 'profile':
        return currentUser ? (
          <RoleProfilePage
            user={currentUser}
            roleLabel="Quản lý"
            locationLabel={currentUser.assignedParkingLot}
            onUpdateUser={onUpdateUser ?? (async () => ({ ok: false, error: 'Không khả dụng.' }))}
          />
        ) : null;
      default:
        return (
          <DashboardContent
            slots={slots}
            payments={payments}
            reservations={reservations}
            users={users}
            pricingRules={pricingRules}
            allSlots={allSlots}
            parkingLots={lotStatuses}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Fixed Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-56 border-r border-slate-100 bg-white flex flex-col overflow-y-auto z-40">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
          <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 text-white font-black text-lg">
            P
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 leading-tight">Quản trị ParkFlow</p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-tight mt-0.5">Quản lý thông minh</p>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === 'parkinglots'
              ? currentView === 'parkinglots' || currentView === 'parkinglotdetail'
              : currentView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleMenuClick(item.key)}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-blue-300" />
                )}
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {'badge' in item && (item as any).badge > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${isActive ? 'bg-white/30 text-white' : 'bg-red-100 text-red-600'}`}>
                    {(item as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-5 space-y-1 border-t border-slate-100 pt-3">
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-56 flex flex-col min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="relative max-w-xs flex-1">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input placeholder="Tìm kiếm ngoại lệ, biển số..." className="w-full rounded-xl bg-slate-100/70 py-2 pl-9 pr-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-300" />
            </div>
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              {(() => {
                const newFeedbacks = feedbacks.filter((f) => f.status === 'New');
                const pendingRes = allReservations.filter((r) => r.status === 'Pending');
                const bellCount = newFeedbacks.length + pendingRes.length + pendingIssueCount;
                return (
                  <div className="relative" ref={bellRef}>
                    <button
                      type="button"
                      onClick={() => setBellOpen((o) => !o)}
                      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 transition hover:bg-slate-100"
                      title="Thông báo"
                    >
                      <Bell className="h-5 w-5 text-slate-600" />
                      {bellCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          {bellCount > 9 ? '9+' : bellCount}
                        </span>
                      )}
                    </button>

                    {bellOpen && (
                      <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-slate-100 bg-white shadow-xl z-50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Thông báo</h4>
                          {bellCount > 0 && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-600">{bellCount} mới</span>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                          {newFeedbacks.map((fb) => (
                            <div
                              key={fb.id}
                              className="px-4 py-3 hover:bg-slate-50 cursor-pointer"
                              onClick={() => { setBellOpen(false); setView('feedback'); }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-rose-600 uppercase">Yêu cầu hỗ trợ mới</p>
                                  <p className="text-xs font-semibold text-slate-800 truncate">{fb.type}</p>
                                  <p className="text-[10px] text-slate-400 italic line-clamp-1">"{fb.description}"</p>
                                </div>
                                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${fb.priority === 'High' ? 'bg-rose-100 text-rose-600' : fb.priority === 'Medium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                  {fb.priority}
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-400 mt-1">{fb.createdAt}</p>
                            </div>
                          ))}
                          {pendingRes.map((res) => (
                            <div
                              key={res.id}
                              className="px-4 py-3 hover:bg-slate-50 cursor-pointer"
                              onClick={() => { setBellOpen(false); setView('managerdashboard'); }}
                            >
                              <p className="text-[10px] font-bold text-blue-600 uppercase">Đặt chỗ chờ xác nhận</p>
                              <p className="text-xs font-semibold text-slate-800">{res.reservationCode}</p>
                              <p className="text-[10px] text-slate-400">{res.licensePlate} • {res.date} {res.startTime}</p>
                            </div>
                          ))}
                          {issues.filter((i) => i.status === 'Pending').map((issue) => (
                            <div
                              key={issue.id}
                              className="px-4 py-3 hover:bg-slate-50 cursor-pointer"
                              onClick={() => { setBellOpen(false); setView('exceptions'); }}
                            >
                              <p className="text-[10px] font-bold text-red-600 uppercase">Sự cố ô đỗ mới</p>
                              <p className="text-xs font-semibold text-slate-800">{issue.slotCode} — {issue.issueType}</p>
                              <p className="text-[10px] text-slate-400">{issue.reportedBy} • {issue.reportedAt}</p>
                            </div>
                          ))}
                          {bellCount === 0 && (
                            <div className="px-4 py-8 text-center">
                              <p className="text-xs text-slate-400">Không có thông báo mới</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 transition hover:bg-slate-100"
                title="Trao đổi với Nhân viên"
              >
                <MessageCircle className="h-5 w-5 text-slate-600" />
              </button>

              {currentUser && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 transition"
                    title={currentUser.fullName}
                  >
                    {managerInitials}
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-100 bg-white shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-800 truncate">{currentUser.fullName || 'Manager'}</p>
                        <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
                        <span className="mt-0.5 inline-block text-[9px] font-bold uppercase text-blue-600">Quản lý</span>
                      </div>
                      <button
                        onClick={() => { setUserMenuOpen(false); setView('profile'); }}
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
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1 p-8 overflow-auto">{renderContent()}</main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-4 px-8 text-center text-xs text-slate-500">
          <p>Cổng Quản lý • Hệ thống Quản lý Bãi đỗ xe v1.0 • © 2026</p>
        </footer>
      </div>

      {/* New issue alert popup */}
      {issueAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 bg-red-600 px-5 py-4">
              <Wrench className="h-6 w-6 text-white animate-pulse" />
              <div>
                <p className="text-xs font-bold text-red-100 uppercase tracking-wider">Sự cố ô đỗ mới</p>
                <p className="text-base font-black text-white">Cần xem xét phê duyệt!</p>
              </div>
              <button
                onClick={() => setIssueAlert(null)}
                className="ml-auto text-white/70 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2 text-sm">
                {[
                  { label: 'Ô đỗ',            value: issueAlert.slotCode },
                  { label: 'Loại sự cố',       value: issueAlert.issueType },
                  { label: 'Báo cáo bởi',      value: issueAlert.reportedBy },
                  { label: 'Thời gian',         value: issueAlert.reportedAt },
                  { label: 'Mô tả',             value: issueAlert.description || '—' },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between gap-3">
                    <span className="text-slate-400 text-xs shrink-0">{row.label}</span>
                    <span className="font-semibold text-slate-800 text-xs text-right">{row.value}</span>
                  </div>
                ))}
              </div>
              {issueAlert.imageUrl && (
                <img src={issueAlert.imageUrl} alt="Ảnh sự cố" className="w-full max-h-40 rounded-xl object-cover" />
              )}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { onRejectIssue?.(issueAlert.id); setIssueAlert(null); }}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Từ chối
                </button>
                <button
                  onClick={() => { onApproveIssue?.(issueAlert.id); setIssueAlert(null); }}
                  className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition"
                >
                  Duyệt Bảo trì
                </button>
              </div>
              <button
                onClick={() => { setIssueAlert(null); setView('exceptions'); }}
                className="w-full text-xs text-blue-600 hover:underline"
              >
                Xem tất cả sự cố →
              </button>
            </div>
          </div>
        </div>
      )}

      {currentUser && (
        <StaffManagerChat isOpen={chatOpen} onClose={() => setChatOpen(false)} currentUser={currentUser} />
      )}
    </div>
  );
}

function formatVnd(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`;
}

const MANAGER_VEHICLE_LABEL: Record<string, string> = {
  motorbike: 'Xe máy',
  car: 'Ô tô 4-7 chỗ',
  'electric vehicle': 'Ô tô Điện/EV',
};
const MANAGER_VEHICLE_ICON: Record<string, string> = {
  motorbike: '🏍️',
  car: '🚗',
  'electric vehicle': '⚡',
};

function DashboardContent({
  slots,
  payments,
  reservations: _reservations,
  users: _users,
  pricingRules,
  allSlots,
  parkingLots = [],
}: {
  slots: Slot[];
  payments: Payment[];
  reservations: Reservation[];
  users: User[];
  pricingRules: PricingRule[];
  /** Toàn bộ ô đỗ của mọi bãi — cho bộ chọn bãi riêng của sơ đồ. */
  allSlots?: Slot[];
  /** Danh mục bãi từ backend. */
  parkingLots?: ParkingLotInfo[];
}) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [areaMode, setAreaMode] = useState<'all' | 'car' | 'motorbike'>('all');

  // ── Chọn bãi đỗ cho sơ đồ (giống form Đặt chỗ của user) ─────────────────────
  // Sơ đồ luôn hiển thị MỘT bãi cụ thể (mỗi bãi có kho ô riêng trùng mã A01...,
  // gộp chung sẽ chồng ô lên nhau) — không còn đồng bộ theo bộ chọn ở header
  // (đã bỏ), tự quản lý bãi đang xem bằng dropdown riêng bên dưới.
  const [mapLot, setMapLot] = useState<LotKey>('');
  // Danh mục tải bất đồng bộ → chọn bãi đầu tiên khi có, đổi bãi nếu bãi đang
  // xem bị Admin xóa.
  useEffect(() => {
    if (!parkingLots.length) return;
    if (!mapLot || !parkingLots.some((l) => l.key === mapLot)) setMapLot(parkingLots[0].key);
  }, [parkingLots, mapLot]);
  const selectedLot = parkingLots.find((l) => l.key === mapLot);
  const mapSlots = useMemo(
    () => (allSlots ?? slots).filter((s) => lotKeyOrDefault(s.parkingLot) === mapLot),
    [allSlots, slots, mapLot],
  );

  const now = new Date();
  const dayNames = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dateLabel = `${dayNames[now.getDay()]}, ${now.getDate()} Tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;

  const totalSlots = slots.length;
  const occupiedCount = slots.filter((s) => s.status === 'Occupied').length;
  const occupancyPct = totalSlots > 0 ? Math.round((occupiedCount / totalSlots) * 100) : 0;

  const todayStr = localDateISO(now);
  const paidPayments = payments.filter((p) => p.status === 'Paid');
  const todayRevenue = paidPayments
    .filter((p) => (p.paidAt || p.createdAt || '').startsWith(todayStr))
    .reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Greeting row */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chào buổi sáng, Quản lý!</h1>
          <p className="mt-1 text-sm text-slate-500">Hôm nay: {dateLabel}</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition">
          <Calendar className="h-4 w-4 text-blue-500" />
          7 ngày qua
        </button>
      </div>

      {/* 2 summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Doanh thu hôm nay</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(todayRevenue).replace('₫', '')} <span className="text-sm font-normal text-slate-400">VND</span>
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-slate-500">
            <TrendingUp className="h-3.5 w-3.5" /> {paidPayments.length} giao dịch đã thanh toán
          </p>
          <Car className="absolute -right-3 -bottom-3 h-20 w-20 text-slate-100" />
        </div>

        {/* Active sessions — synced with real checked-in/occupied slots, matching the driver's booking status */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Phiên hoạt động</p>
          <p className="mt-2 text-5xl font-bold text-slate-900">{occupiedCount.toLocaleString('vi-VN')}</p>
          <p className="mt-0.5 text-xs text-slate-500">Xe đang đỗ tại bãi</p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${occupancyPct}%` }} />
          </div>
        </div>
      </div>

      {/* Vehicle traffic */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Thống kê lượng xe ra vào hôm nay</h2>
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-md p-1.5 transition ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md p-1.5 transition ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
          {([
            { label: 'Xe máy',         icon: Bike,  bg: 'bg-orange-50', color: 'text-orange-500', vao: 1240, ra: 1080, hienCo: 467 },
            { label: 'Ô tô 4-7 chỗ',  icon: Car,   bg: 'bg-blue-50',   color: 'text-blue-500',   vao: 452,  ra: 380,  hienCo: 158 },
            { label: 'Ô tô Điện/EV',   icon: Zap,   bg: 'bg-emerald-50', color: 'text-emerald-500', vao: 86,   ra: 72,   hienCo: 24  },
          ] as const).map((v) => {
            const Icon = v.icon;
            return (
              <div key={v.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${v.bg}`}>
                    <Icon className={`h-4 w-4 ${v.color}`} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{v.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {([['Vào', v.vao, 'text-slate-800'], ['Ra', v.ra, 'text-slate-800'], ['Hiện có', v.hienCo, 'text-blue-600']] as const).map(([lbl, val, cls]) => (
                    <div key={lbl}>
                      <p className="text-[10px] font-medium text-slate-400">{lbl}</p>
                      <p className={`text-xl font-bold ${cls}`}>{Number(val).toLocaleString('vi-VN')}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom 2-col */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Traffic chart */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Thống kê lưu lượng</h3>
            <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
              Tháng này <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-end gap-2" style={{ height: 96 }}>
            {[28, 45, 32, 58, 72, 51, 40].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-blue-100" style={{ height: `${h}px` }} />
                <span className="text-[9px] text-slate-400">{['T2','T3','T4','T5','T6','T7','CN'][i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing preview */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Bảng giá &amp; Loại xe</h3>
            <button className="text-xs font-semibold text-blue-600 hover:underline transition">✎ Chỉnh sửa</button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-2 text-left font-medium text-slate-400">Loại xe</th>
                <th className="pb-2 text-right font-medium text-slate-400">Theo lượt</th>
                <th className="pb-2 text-right font-medium text-blue-500">Vé tháng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(['motorbike', 'car', 'electric vehicle'] as const).map((vt) => {
                const rule = pricingRules.find((p) => p.vehicleType === vt);
                if (!rule) return null;
                return (
                  <tr key={vt} className="hover:bg-slate-50">
                    <td className="py-2.5">
                      <span className="mr-1.5">{MANAGER_VEHICLE_ICON[vt]}</span>
                      <span className="font-medium text-slate-700">{MANAGER_VEHICLE_LABEL[vt]}</span>
                    </td>
                    <td className="py-2.5 text-right text-slate-600">{formatVnd(rule.firstHourPrice)}</td>
                    <td className="py-2.5 text-right font-semibold text-blue-600">{formatVnd(rule.monthlyPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live parking floor map */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800">Sơ đồ bãi đỗ — Trực tiếp</h2>
            <p className="text-xs text-slate-400 mt-0.5">Trạng thái ô đỗ đồng bộ với hoạt động đặt chỗ của người dùng</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Area toggle */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
              {([
                { key: 'all'       as const, label: 'Tất cả', icon: LayoutGrid },
                { key: 'car'       as const, label: 'Ô tô',   icon: Car },
                { key: 'motorbike' as const, label: 'Xe máy', icon: Bike },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setAreaMode(key)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                    areaMode === key ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px]">
              {[
                { color: 'bg-white border border-blue-400', label: 'Trống' },
                { color: 'bg-green-600',  label: 'Đang đỗ' },
                { color: 'bg-amber-100 border border-amber-400', label: 'Chờ duyệt' },
                { color: 'bg-amber-400', label: 'Đã đặt' },
                { color: 'bg-rose-500',  label: 'Bảo trì' },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-slate-500">
                  <span className={`inline-block h-3 w-3 rounded-sm ${l.color}`} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Chọn bãi đỗ — giống list ở chức năng Đặt chỗ của user */}
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-3">
          <label className="mb-1.5 block text-xs font-bold text-slate-600">Chọn bãi đỗ</label>
          <div className="relative max-w-sm">
            <select
              value={mapLot}
              onChange={(e) => setMapLot(e.target.value as LotKey)}
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
            >
              {parkingLots.map((lot) => (
                <option key={lot.key} value={lot.key}>{lot.bookingLabel}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        <div className="p-5">
          <ParkingFloorMap
            slots={mapSlots.map((s) => ({
              id: s.id,
              code: s.slotCode.split('-').pop() ?? s.slotCode,
              status: s.status,
            } as MapSlot))}
            gates={selectedLot?.gates}
            interactive={false}
            areaMode={areaMode}
          />
        </div>
      </div>

      <PaymentWalletCard payments={payments} />
    </div>
  );
}
